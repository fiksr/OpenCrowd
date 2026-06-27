import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Redis from 'ioredis';

// --- Configuration ---
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// --- Services ---
const prisma = new PrismaClient();
const redis = new Redis(REDIS_URL);
const fastify = Fastify({ logger: true });

// --- Schemas ---
const submitSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  timestamp: z.string().datetime(), // Client provided ISO timestamp
  sessionId: z.string().min(1),
  turnstileToken: z.string().optional(),
});

// --- Plugins ---
fastify.register(cors, { origin: '*' });

// --- Endpoints ---

// 1. Submit Location
fastify.post('/api/submit', async (request, reply) => {
  try {
    const data = submitSchema.parse(request.body);

    // Filter out very poor accuracy
    if (data.accuracy > 50) {
      return reply.status(400).send({ error: 'GPS accuracy too low (must be < 50m)' });
    }
    
    // Sanity check timestamp (must not be in the future, must not be older than 12 hours)
    const clientTime = new Date(data.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - clientTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < -1 || hoursDiff > 12) {
      return reply.status(400).send({ error: 'Invalid timestamp. Must be within the last 12 hours.' });
    }

    // Rate Limiting (Redis)
    const ip = request.ip;
    const rateLimitKey = `rate_limit:${ip}`;
    const requests = await redis.incr(rateLimitKey);
    if (requests === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }
    if (requests > 10) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    // Insert into database
    await prisma.submission.create({
      data: {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        timestamp: clientTime,
        sessionId: data.sessionId,
      },
    });

    return reply.status(200).send({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation failed', details: err.errors });
    }
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// 2. Get Live Stats (Area Estimate)
fastify.get('/api/stats', async (request, reply) => {
  try {
    // In MVP, we use PostGIS to cluster and calculate area of the footprint
    // For now, we return a simple aggregate of total pings.
    // To do true Area Mapping, we would execute a raw SQL query like ST_Area(ST_ConcaveHull(...))
    
    // We'll write a raw query to calculate the bounding box area roughly:
    const result: any = await prisma.$queryRaw`
      WITH points AS (
        SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326) as geom
        FROM "Submission"
        WHERE timestamp > NOW() - INTERVAL '4 hours'
      ),
      hull AS (
        SELECT ST_ConcaveHull(ST_Collect(geom), 0.8) as polygon
        FROM points
      )
      SELECT 
        COUNT(*) as total_pings,
        COALESCE(ST_Area(polygon::geography), 0) as area_sqm
      FROM points
      CROSS JOIN hull;
    `;

    const totalPings = Number(result[0]?.total_pings || 0);
    const areaSqm = Number(result[0]?.area_sqm || 0);
    
    // Jacobs' Crowd Formula estimates:
    // Light crowd: 1 person per ~1.0 sqm
    // Dense crowd: 1 person per ~0.25 sqm (approx 4 people/sqm)
    const estimateMin = Math.floor(areaSqm * 1);
    const estimateMax = Math.floor(areaSqm * 4);

    return reply.status(200).send({
      total_pings: totalPings,
      area_sqm: Math.floor(areaSqm),
      estimate_min: estimateMin,
      estimate_max: estimateMax,
    });
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch stats' });
  }
});

// --- Start Server ---
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

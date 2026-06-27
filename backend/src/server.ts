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
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1),
  deviceId: z.string().min(1),
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
    
    const clientTime = new Date(data.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - clientTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < -1 || hoursDiff > 12) {
      return reply.status(400).send({ error: 'Invalid timestamp. Must be within the last 12 hours.' });
    }

    const ip = request.ip;
    const rateLimitKey = `rate_limit:${ip}`;
    const requests = await redis.incr(rateLimitKey);
    if (requests === 1) {
      await redis.expire(rateLimitKey, 60);
    }
    if (requests > 10) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    // Upsert into database to guarantee 1 device = 1 record
    await prisma.submission.upsert({
      where: { deviceId: data.deviceId },
      update: {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        timestamp: clientTime,
        sessionId: data.sessionId,
      },
      create: {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        timestamp: clientTime,
        sessionId: data.sessionId,
        deviceId: data.deviceId,
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

// 2. Get Live Stats (Dual View: Strict Counter & Area Estimate)
fastify.get('/api/stats', async (request, reply) => {
  try {
    // We execute two queries simultaneously for performance:
    // 1. A fast COUNT DISTINCT for the strict fingerprint counter
    // 2. A PostGIS ST_Union polygon calculation for the area footprint
    const [countResult, spatialResult]: any = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "deviceId") as total_unique_people
        FROM "Submission"
        WHERE timestamp > NOW() - INTERVAL '12 hours'
      `,
      prisma.$queryRaw`
        WITH points AS (
          SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography as geog
          FROM "Submission"
          WHERE timestamp > NOW() - INTERVAL '12 hours'
        ),
        buffers AS (
          SELECT ST_Buffer(geog, 2)::geometry as geom
          FROM points
        ),
        hull AS (
          SELECT ST_Union(geom) as polygon
          FROM buffers
        )
        SELECT COALESCE(ST_Area(polygon::geography), 0) as area_sqm
        FROM hull;
      `
    ]);

    const totalPings = Number(countResult[0]?.total_unique_people || 0);
    const areaSqm = Number(spatialResult[0]?.area_sqm || 0);

    // Jacobs' Crowd Formula estimates:
    const estimateMin = Math.floor(areaSqm * 1); // 1 person per sqm
    const estimateMax = Math.floor(areaSqm * 4); // 4 people per sqm

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

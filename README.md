# OpenCrowd

**OpenCrowd** is an open-source, privacy-first tool designed to cryptographically map crowd footprints and provide undeniable proof of attendance at public protests.

When governments and media drastically undercount the size of protests, OpenCrowd provides verifiable, data-backed evidence of crowd sizes using two complementary approaches.

## The Dual-View System

OpenCrowd features a dual-view analytics engine that gives you the best of both worlds:

1. **Strict Counter (The Hard Proof):** A massive absolute counter. OpenCrowd uses browser and hardware fingerprinting (`FingerprintJS`) to assign an unbreakable "Device ID" to every user. This ensures **1 Device = 1 Vote**. Even if an attacker opens 100 Incognito tabs to try and inflate the numbers, the database strictly blocks duplicates.
2. **Scientific Estimate (Area Footprint Mapping):** When cellular networks jam at massive protests, not everyone can check in. To account for this, the database uses PostGIS to draw a 2-meter physical circle around every single GPS ping, merging them all into one massive spatial polygon. We then apply **Jacobs' Crowd Formula** (1 to 4 people per m²) to scientifically extrapolate the true size of the gathering based on the physical square meterage of the crowd footprint.

## Features
- **Privacy-First:** No accounts, no names, no personal data.
- **Hardware Fingerprinting:** Immune to incognito/private-browsing spam.
- **Dual Analytics:** Toggle between strict Verified Participants and Scientific Footprint Estimates.
- **Offline-Sync Queue:** If cellular networks drop, the app silently queues your GPS check-in offline and background-syncs to the server the moment your 4G/5G connection returns.
- **Cloudflare Ready:** Built to sit behind Cloudflare Turnstile for enterprise-grade bot protection.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Leaflet, FingerprintJS
- **Backend:** Node.js, Fastify, Prisma ORM, Redis
- **Database:** PostgreSQL with PostGIS extension (kartoza/postgis:16-3.4 for ARM64 compatibility)

## Deployment (Production & Local)

The entire application (Frontend, Backend, Database, and Redis) is fully containerized.

1. Ensure Docker and Docker Compose are installed.
2. Clone the repository and configure your `.env` files (see `.env.example` inside backend and frontend folders).
3. Build and deploy the entire stack:
   ```bash
   docker compose up -d --build
   ```

*Built to support civil transparency. Open source forever.*

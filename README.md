# OpenCrowd

**OpenCrowd** is an open-source, privacy-first tool designed to cryptographically map crowd footprints and estimate attendance at public protests.

Instead of relying on subjective user estimates or manual headcounts, OpenCrowd uses the GPS signals of participants to mathematically draw a bounding box (polygon) around the contiguous crowd footprint. Using Jacobs' Crowd Formula, this area is then used to scientifically extrapolate minimum and maximum crowd size estimates.

## Features
- **Privacy-First:** No accounts, no names, no personal data.
- **Area Footprint Mapping:** Uses PostGIS to dynamically cluster check-ins and calculate square meterage.
- **Offline-Sync Queue:** If cellular networks are jammed during a protest, the app securely queues check-ins in local storage and background-syncs them to the server the moment an internet connection is re-established.
- **Security-Hardened:** Built with Zod validation, invisible Turnstile CAPTCHA (ready), and Redis-backed strict rate limiting to prevent DDoS or bot-brigading.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Leaflet
- **Backend:** Node.js, Fastify, Prisma ORM, Redis
- **Database:** PostgreSQL with PostGIS extension

## Quickstart (Local Development)

The easiest way to run the database layer is via Docker.

1. Start the PostgreSQL (PostGIS) and Redis containers:
   ```bash
   docker compose up -d
   ```
2. Start the Backend API:
   ```bash
   cd backend
   npm install
   npx prisma db push
   npm start
   ```
3. Start the Frontend App:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

*Built to support civil transparency. Open source forever.*

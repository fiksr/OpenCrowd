# OpenCrowd

**OpenCrowd** is an open-source, privacy-first tool designed to cryptographically map crowd footprints and provide undeniable proof of attendance at public protests.

When governments and media drastically undercount the size of protests, OpenCrowd provides verifiable, data-backed evidence of crowd sizes using two complementary approaches.

## Live Demo & Testing

A live testing instance of the application is available at: **[https://opencrowd.fikser.lol/](https://opencrowd.fikser.lol/)**

## The Dual-View System

OpenCrowd features a dual-view analytics engine that gives you the best of both worlds:

1. **Strict Counter (The Hard Proof):** A massive absolute counter. OpenCrowd uses browser and hardware fingerprinting (`FingerprintJS`) to assign an unbreakable "Device ID" to every user. This ensures **1 Device = 1 Vote**. Even if an attacker opens 100 Incognito tabs to try and inflate the numbers, the database strictly blocks duplicates.
2. **Scientific Estimate (Area Footprint Mapping):** When cellular networks jam at massive protests, not everyone can check in. To account for this, the database uses PostGIS to draw a 2-meter physical circle around every single GPS ping, merging them all into one massive spatial polygon. We then apply **Jacobs' Crowd Formula** (1 to 4 people per m²) to scientifically extrapolate the true size of the gathering based on the physical square meterage of the crowd footprint.

## How the Hardware ID Works (Incognito-Proof)

To block spam, OpenCrowd implements a custom, **storage-independent hardware fingerprinting** system:

* **The Problem with Standard Fingerprinting:** Standard fingerprinting libraries typically rely on `localStorage`, `sessionStorage`, cookies, or browser database mechanisms to store and track unique visitor IDs. When a user switches to Incognito/Private Browsing, these storages are isolated or cleared, allowing a malicious actor to generate a new ID and submit multiple votes from the same device.
* **The OpenCrowd Solution:** OpenCrowd bypasses the library's standard `visitorId` and instead extracts the raw, hardware-only entropy signals gathered by the library:
  - **Canvas & WebGL:** Mathematical rendering characteristics of 2D/3D shapes, along with the unmasked GPU chip vendor and renderer details (e.g. `webGlBasics` and `webGlExtensions`).
  - **System Specifications:** Physical CPU core count (`hardwareConcurrency`), estimated system RAM size (`deviceMemory`), and platform type.
  - **Subsystems:** The mathematical profile of the browser's audio processing architecture (`audio`).
  - **Display Metrics:** Physical screen resolution, color depth, and system timezone.
* **Cryptographic Hashing:** These stable, hardware-tied metrics are serialized into a JSON string and hashed client-side using a **SHA-256** digest via the native Web Crypto API (`crypto.subtle`). 

Since none of these hardware attributes change when opening a private tab, the resulting SHA-256 hash is identical whether the user is in normal browsing, private browsing, or incognito mode.

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

## Production Notes: Bot Protection (Cloudflare Turnstile)

To protect the submission API against programmatic bot spam (which bypasses browser fingerprinting), the system is designed to support **Cloudflare Turnstile**:
* **Current Status:** The backend has a placeholder in its validation schema (`turnstileToken: z.string().optional()`), but the verification logic is not yet active.
* **Todo (Setup Required):** To fully enable Turnstile:
  1. Register your domain on Cloudflare and obtain a Turnstile Site Key and Secret Key.
  2. Load the Turnstile API script and render the widget in the React frontend.
  3. Send the generated token in the `POST /api/submit` request.
  4. Implement the backend `siteverify` request to `https://challenges.cloudflare.com/turnstile/v0/siteverify` using the token and your Secret Key.

## Current Web Platform Limitations

While the web-based client is highly accessible and requires zero installation, the web platform imposes several strict security and hardware limitations:

* **Spoofing & Emulation Risks:** Web browsers do not have hardware-level cryptographic keys. A sophisticated attacker running headless browsers (like Puppeteer or Playwright) can programmatically spoof user agents, canvas fingerprints, and WebGL specifications to bypass duplicate checks.
* **Aggressive Background Sleep:** Mobile operating systems (iOS and Android) aggressively freeze or suspend browser tabs when they are minimized or when the screen is locked. This means offline check-in syncing cannot run continuously in the background.
* **No Offline Peer-to-Peer Relay:** Web browsers do not expose access to raw Bluetooth or Wi-Fi Direct radios. If cellular networks (4G/5G) are jammed at a protest site, web users cannot check in or relay their location pings through nearby devices.
* **Notification Barriers:** Real-time push alerts are difficult to deliver on mobile web browsers. On iOS, for example, web push notifications are blocked unless the visitor manually adds the site to their home screen as a Progressive Web App (PWA).

## Future Roadmap: Native Mobile Apps (Android APK & iOS)

A major item on the project's TODO list is developing native mobile clients (Android/iOS). Transitioning from a web-based client to native applications provides critical advantages:

* **Anti-Jamming Mesh Networking (P2P):** During large protests, governments frequently throttle or shut down mobile networks (4G/5G/LTE). Native apps can use hardware radios to establish **Bluetooth Low Energy (BLE) or Wi-Fi Direct peer-to-peer (P2P) mesh networks**. Users can sign and pass their attendance hashes locally through nearby devices until a peer's device with a working internet connection is able to sync the whole pool to the server.
* **Reliable Background Syncing:** Web browsers heavily restrict background execution and GPS access when a tab is minimized or the screen is turned off. A native app can run background location services and retry syncing queued check-ins much more reliably under extreme network conditions.
* **Hardened Device Attestation:** Web-based fingerprinting is susceptible to browser emulation and spoofing. Native apps can utilize platform-level security APIs (like **Google Play Integrity API** and **Apple DeviceCheck / App Attest**) to cryptographically verify the device is genuine, untampered, and running a signed version of the app.
* **Emergency Push Alerts:** Native push notifications can alert users in real time of police movements, safe exit routes, or cellular network status updates without needing an open browser tab.

*Built to support civil transparency. Open source forever.*

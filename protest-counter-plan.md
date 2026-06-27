# 🔢 Crowdsourced Protest Attendance Counter
### Project Plan v0.1

---

## Problem Statement

The Serbian government consistently under-reports protest attendance to delegitimize the student movement. At the March 15, 2025 protest, the government reported 107,000 participants while independent monitors counted 275,000–325,000. Currently the only independent counter is one NGO (Arhiv Javnih Skupova) doing manual estimates. This tool makes the count live, citizen-powered, and hard to dispute.

---

## How It Works — The Jacobs Method

The protest area is divided into a grid of zones (~50x50m squares). Citizens at the protest open the app, their GPS zone is detected, they tap "I'm here." The app aggregates submissions per zone, multiplies by known crowd density constants, and outputs a total estimate with a confidence interval. This is the gold standard method used by professional crowd scientists.

---

## Core Features (MVP)

### User-facing
- 📍 Live map of the protest area with grid zones
- ☝️ One-tap anonymous "I'm here" submission — no account needed
- 📊 Live counter updating in real time
- 🌡️ Heatmap showing crowd density per zone
- 📤 Shareable image/card after protest: *"Citizens counted: 287,432"*

### Admin/backend
- 📥 Submission ingestion with deduplication
- 🚩 Anomaly flagging (velocity spikes, suspicious patterns)
- 📦 Raw data export (CSV) for journalists and researchers
- 📋 Final certified count report published post-protest

---

## Data Model

Each submission stores only:

```
zone_id      | string    — which grid zone the user is in
timestamp    | datetime  — when the submission was made
session_token| string    — one-time cryptographic token per device load
cell_tower   | string    — (optional) for cross-validation
```

**No personal data. No accounts. No names.**

---

## Security & Credibility Hardening

| Threat | Mitigation |
|---|---|
| Bot submissions | Device fingerprinting — 1 submission per unique device |
| GPS spoofing | Cross-reference with cell tower ping |
| Coordinated brigading | Velocity limiting — flag bursts from same tower |
| Replay attacks | One-time cryptographic session tokens, rejected server-side |
| Stationary bots | Accelerometer cross-check — real crowd = movement |
| General manipulation | Open source code + raw data published for audit |

### Credibility layer
- Fully open source — anyone can audit the code
- Raw data downloadable by journalists and researchers
- Methodology documented publicly — confidence intervals included
- Cross-validated against aerial photos and drone footage where available

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Leaflet.js (map) |
| Backend | Node.js / Express |
| Database | PostgreSQL |
| Hosting | Any VPS (Hetzner, DigitalOcean) |
| Geofencing | PostGIS extension |
| Security | JWT session tokens, rate limiting, device fingerprinting |

---

## The Reddit Moment

After every protest, one post goes up:

> *"The government said 95,000. Here's what 14,000 citizens with phones counted: 312,000."*
> [heatmap image attached]

This is the shareable, pinnable, undeniable output that makes the project go viral on r/serbia after every protest.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Government attempts to discredit | Open source code + full methodology = nothing to hide |
| Low adoption at first protest | Partner with student movement to promote before event |
| GPS accuracy in dense crowds | Zone size (50x50m) is large enough to absorb GPS drift |
| Server overload during protest | CDN + horizontal scaling, load test beforehand |
| Legal pressure | No personal data collected = nothing to seize or subpoena |

---

## Roadmap

### Phase 1 — MVP (2–3 weeks)
- [ ] Map with protest zone grid
- [ ] Anonymous one-tap submission
- [ ] Live counter
- [ ] Basic deduplication

### Phase 2 — Hardening (1–2 weeks)
- [ ] Device fingerprinting
- [ ] Anomaly detection
- [ ] Raw data export
- [ ] Shareable result card generator

### Phase 3 — Launch
- [ ] Partner with student movement / r/serbia for promotion
- [ ] Load testing
- [ ] Open source the repo on GitHub
- [ ] Document methodology publicly

---

## Open Questions
- Who maintains the zone grid for each new protest location?
- Do we need a moderation team for anomaly review?
- Should the heatmap be live during the protest or only published after?

---

*Built to support the Serbian student movement. Open source. No personal data collected.*

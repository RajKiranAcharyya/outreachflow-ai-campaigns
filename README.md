# OutreachFlow – AI Cold-Email Campaign Tool (Full Stack)

[![Tests](https://img.shields.io/badge/Jest%20Tests-42%20Passed-emerald.svg)](https://github.com/RajKiranAcharyya/outreachflow-ai-campaigns)
[![Tech Stack](https://img.shields.io/badge/Tech%20Stack-Node.js%20%E2%80%A2%20TypeScript%20%E2%80%A2%20Next.js%20%E2%80%A2%20SQLite-indigo.svg)](https://github.com/RajKiranAcharyya/outreachflow-ai-campaigns)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-ready full-stack AI cold-email platform built with **Node.js, TypeScript, Express, Next.js, React, Tailwind CSS, SQLite (Knex), Google Gemini API, and Nodemailer sandbox SMTP**.

OutreachFlow automates multi-step outbound email sequences with custom delay intervals, provides an interactive dashboard with live `sent / opened / pending / failed` analytics, leverages **Gemini AI** to craft personalized opening lines with strict latency and prompt-injection safety guards, enforces **database-backed idempotency**, and executes background sending via a resilient worker with **exponential-backoff retries, daily send limits, and crash recovery**.

---

## 🚀 Key Highlights & Architecture

| Feature | Engineering Details |
|---|---|
| **Multi-Step Sequences** | Multi-step campaigns with configurable delays (minutes, hours, or days) advancing automatically upon verified dispatch. |
| **Database-Backed Queue** | SQLite (Knex) send queue with background worker polling, locking, and execution. |
| **Idempotency Guarantee** | Deterministic key `campaign_{id}_step_{step}_contact_{id}` with unique DB constraints guarantees **zero duplicate sends**. |
| **Crash Recovery** | Automatically discovers and revives stuck `sending` jobs older than 5 minutes on restart or routine polling. |
| **Exponential Backoff** | Failed SMTP dispatches trigger progressive exponential backoff (`base * 2^(attempts-1)`), failing gracefully after 3 attempts. |
| **Daily Send Limits** | Enforces campaign-level daily dispatch limits, deferring surplus emails to the next daily cycle without dropping jobs. |
| **Gemini AI Openers** | Calls Google Gemini API (`gemini-1.5-flash`) with an **8-second timeout (`AbortSignal`)**, automated retry, deterministic fallback, and a **prompt-injection guard** sanitizing contact inputs and validating model outputs. |
| **Tracking & Unsubscribes** | Injects 1x1 transparent GIF open-tracking pixels and **HMAC-SHA256 signed one-click unsubscribe links** that instantly cancel pending steps. |
| **Sandbox Mode (Safe)** | Uses Nodemailer with Ethereal SMTP test accounts / stream transport so **no real external emails are ever dispatched**. |
| **API Security & OpenAPI** | Secured via `x-admin-token` header and `express-rate-limit`; documented interactively with Swagger/OpenAPI at `/api-docs`. |
| **Test Coverage** | **42 passing Jest tests** covering the worker, idempotency, prompt-injection sanitization, fallbacks, and API endpoints. |

---

## 🛠 Tech Stack

- **Backend:** Node.js, TypeScript, Express.js, Knex.js, better-sqlite3 / sqlite3
- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript
- **AI & LLM:** Google Gemini API (`gemini-1.5-flash`)
- **Email & Queue:** Nodemailer (Sandbox / Ethereal SMTP), Database-backed background worker
- **Security & Quality:** Helmet, CORS, Express-Rate-Limit, Crypto (HMAC-SHA256), Zod, Jest, Supertest
- **Documentation:** Swagger UI, OpenAPI 3.0
- **DevOps & Deploy:** Docker, Docker Compose, Render (Backend), Vercel (Frontend)

---

## 📋 System Architecture

```
[ Next.js 14 Frontend (Tailwind CSS) ]
        │                       │
        │ (Admin Token Auth)    │ (Tracking Pixel & Unsubscribe)
        ▼                       ▼
[ Express.js REST API Server + Swagger UI (/api-docs) ]
        │
        ├──► [ Gemini API Service ] (8s timeout, prompt guard, fallback)
        ├──► [ Tracking Service ] (HMAC-SHA256 signed links, 1x1 GIF)
        ├──► [ SQLite Database (Knex) ]
        │       ├── contacts
        │       ├── campaigns & campaign_steps
        │       ├── enrollments
        │       └── emails (send queue)
        │
        ▼
[ Background Send Worker ]
        ├── Crash Recovery (resets stuck jobs > 5m)
        ├── Daily Limit Enforcer (prevents exceeding daily send cap)
        ├── Idempotency Gate (prevents duplicate step dispatch)
        ├── Exponential-Backoff Retrier (attempts 1..3 with backoff)
        └── Nodemailer Sandbox SMTP (captures preview URL, no real emails)
```

---

## 🧪 Jest Test Suite (42 Passed)

All 42 tests pass across 7 comprehensive test suites:

```bash
PASS src/tests/worker_queue.test.ts
  Send Queue & Background Worker
    Idempotency & Enqueueing
      √ should generate deterministic idempotency keys
      √ should prevent duplicate emails with the same idempotency key
    Worker Processing & Multi-Step Sequence
      √ should process a pending email and advance to the next step
    Exponential Backoff & Retries
      √ should retry with exponential backoff on send failure
      √ should mark email as failed after maximum retry attempts
    Crash Recovery for Stuck Jobs
      √ should recover jobs stuck in "sending" status due to server crashes
    Daily Send Limits
      √ should defer jobs when campaign daily send limit is reached

PASS src/tests/api.test.ts
  API Routes & Security
    Authentication & Public Routes
      √ GET /health should return 200 without token
      √ GET /api/contacts should reject unauthorized requests with 401
      √ GET /api/contacts should accept valid x-admin-token
    Contacts API & CSV Import
      √ POST /api/contacts should create a valid contact
      √ POST /api/contacts/import should import contacts from CSV text
    Campaigns API & Multi-step Enrollment
      √ POST /api/campaigns should create a campaign with steps
      √ POST /api/campaigns/:id/enroll should enroll contacts and generate AI opening
    Dashboard Statistics
      √ GET /api/dashboard/stats should return dashboard key metrics
    Tracking Endpoints
      √ GET /api/track/open/:emailId should return 1x1 GIF image

PASS src/tests/gemini.test.ts
  Gemini Service & AI Personalization
    Prompt Injection Guard & Sanitization
      √ should strip injection instructions like "ignore previous instructions"
      √ should strip system tokens, code fences, and markdown formatting
      √ should truncate input exceeding max length
    Model Output Validation
      √ should accept clean, concise single-sentence opening lines
      √ should reject outputs that are too short or too long
      √ should reject outputs containing HTML or markdown headers
      √ should reject outputs leaking AI system self-referencing phrases
    Deterministic Fallback
      √ should generate personalized fallback with name, company, and role
      √ should generate graceful fallback when only company is provided
      √ should generate default fallback when contact details are empty
      √ should safely fall back when API key is unconfigured

PASS src/tests/tracking.test.ts
  Tracking & Unsubscribe Service
    Signed Unsubscribe Links
      √ should generate valid HMAC-SHA256 signatures
      √ should verify matching signature
      √ should reject tampered email or enrollment ID
      √ should build proper unsubscribe URLs
    Open Tracking Pixel
      √ should return a valid 1x1 transparent GIF buffer
      √ should record open timestamp in emails table

PASS src/tests/csvParser.test.ts
PASS src/tests/verifier.test.ts
PASS src/tests/health.test.ts

Test Suites: 7 passed, 7 total
Tests:       42 passed, 42 total
```

To run tests:
```bash
cd backend
npm test
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 2. Backend Setup
```bash
cd backend
npm install
npm run migrate
npm run seed     # Seeds demo contacts and sample campaign
npm run dev      # Starts API on http://localhost:3000
```
- Swagger UI Documentation: `http://localhost:3000/api-docs`
- Health check: `http://localhost:3000/health`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev      # Starts Next.js on http://localhost:3001
```
Open `http://localhost:3001` in your browser.

---

## 🐳 Docker & Docker Compose

Run the entire full-stack application with a single command:

```bash
docker compose up --build
```

- **Frontend:** `http://localhost:3001`
- **Backend API & Swagger:** `http://localhost:3000/api-docs`

---

## 🌐 Production Deployment Guide

### A. Deploy Backend on Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect this repository (`outreachflow-ai-campaigns`).
3. Set the following build and start settings:
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npx knex migrate:latest --knexfile knexfile.ts && node dist/index.js`
4. Add a **Persistent Disk** on Render:
   - Mount Path: `/var/data`
   - Size: 1 GB
5. Configure Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DB_PATH`: `/var/data/outreachflow.db`
   - `ADMIN_TOKEN`: `<your-secure-admin-token>`
   - `APP_SECRET`: `<your-random-32-char-secret>`
   - `GEMINI_API_KEY`: `<your-gemini-api-key>`
   - `GEMINI_MODEL`: `gemini-1.5-flash`
   - `CORS_ORIGIN`: `https://your-frontend.vercel.app`

### B. Deploy Frontend on Vercel
1. Import the repository on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend.onrender.com`
4. Click **Deploy**.

---

## 📄 License
MIT © Raj Kiran Acharyya

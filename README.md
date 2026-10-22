# GymTrack 🏋️‍♂️

> A modern, offline-first gym workout tracker and learning-focused full-stack engineering project. Built with **React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Node.js, Express, Prisma ORM, PostgreSQL, Redis, and Backblaze B2 (S3)**.

---

## 🌟 Key Highlights & Engineering Features

- **⚡ Dual-Layer Caching**:
  - **Frontend**: TanStack Query (React Query v5) caching with `staleTime: 2m`, `gcTime: 10m`, and optimistic UI updates.
  - **Backend**: Resilient Redis cache-aside layer (`cacheAside`) with automated pattern-based invalidation (`invalidateCachePattern`) and graceful zero-downtime database fallback.
- **📱 Offline-First PWA**:
  - Progressive Web App with service worker caching.
  - Custom IndexedDB sync queue (`idb`) that holds workout logs created or modified offline and seamlessly replays them upon network reconnection.
- **🔒 Enterprise Security & Auth**:
  - Stateless JWT authentication, Bcrypt password hashing, Role-Based Access Control (`MEMBER` vs `ADMIN`).
  - Strict CORS origin validation, Helmet security headers, and rate limiting with Redis store option.
- **🛰️ Deep Observability & Live Telemetry**:
  - Distributed `X-Trace-Id` tracking across HTTP requests, AsyncLocalStorage, and PostgreSQL query execution.
  - Interactive Admin Traffic Map and database query latency tracing.
- **☁️ Cloud Object Storage**:
  - Zero-disk avatar media handling with Backblaze B2 (S3-compatible) and time-limited presigned URLs.
- **🤖 Chat Assistant (Rules First, LLM Fallback)**:
  - Log workouts ("bench 3x8 60kg", "I did 4 sets of 10 pull ups") and ask about your training from a floating chat panel.
  - Common phrases are handled by a free, instant rule-based parser; everything else goes to Cloudflare Workers AI with read-only tools.
  - The bot only proposes workouts; nothing is saved until you confirm, through the same offline-capable path as the form.

---

## 📂 Project Structure

```text
gymtrack/
├── ARCHITECTURE.md          # Complete architectural specification & design patterns
├── render.yaml              # Render PaaS deployment blueprint
├── .github/workflows/       # GitHub Actions CI/CD workflows
│   └── ci.yml
├── client/                  # Frontend SPA & PWA (React + Vite + Tailwind)
│   ├── public/              # Static assets & PWA manifest icons
│   ├── src/
│   │   ├── api/             # Typed HTTP client modules (auth, workouts, templates, etc.)
│   │   ├── components/      # Modular UI components (Cards, Forms, Charts, Shell)
│   │   ├── context/         # React Contexts (AppDataContext, ToastContext)
│   │   ├── hooks/           # Custom React Query & utility hooks
│   │   ├── pages/           # Route views (Workouts, Templates, Exercises, Admin, etc.)
│   │   ├── offlineStore.ts  # IndexedDB sync queue for offline operations
│   │   ├── App.tsx          # Root router & layout
│   │   └── main.tsx         # App entry, QueryClient setup, and SW registration
│   └── package.json
└── server/                  # Backend REST API (Node.js + Express + Prisma)
    ├── prisma/
    │   ├── schema.prisma    # Relational database schema & indexes
    │   └── seed.js          # Default exercise database seeder
    ├── src/
    │   ├── config/          # Environment variable parser & validation
    │   ├── controllers/     # Route HTTP adapters (workouts, exercises, auth, etc.)
    │   ├── services/        # Pure domain business logic (workouts, exercises)
    │   │   └── chat/        # Chat assistant: intents, tools, LLM orchestration
    │   ├── db/              # Prisma client singleton
    │   ├── lib/             # Shared libraries (redis.ts, storage.ts, dbTrace.ts, llm.ts, etc.)
    │   ├── middleware/      # Auth, error handling, rate limiting, and telemetry
    │   ├── routes/          # Express route definitions
    │   ├── schemas/         # Zod runtime input validation schemas
    │   ├── types/           # TypeScript domain definitions
    │   ├── app.ts           # Express application configuration & middleware chain
    │   └── server.ts        # Server bootstrap & graceful shutdown handler
    └── package.json
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Node.js (v20+ recommended)
- PostgreSQL database (local or hosted e.g. Supabase, Neon, Render)
- Redis instance (optional: app runs in graceful fallback mode if Redis is offline)

### 2. Backend Setup
```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Configure environment variables (create .env based on sample values)
# DATABASE_URL, DIRECT_URL, JWT_SECRET, REDIS_URL, B2_* keys
# Optional chat assistant LLM (rule-based commands work without these):
# CF_ACCOUNT_ID, CF_AI_TOKEN, CF_AI_MODEL, CHAT_LLM_DAILY_LIMIT
# In production the server refuses to start without a private JWT_SECRET.

# Run database migrations & generate Prisma client
npx prisma migrate dev
npx prisma db seed

# Start server in watch mode
npm run dev
```
Backend runs by default at `http://localhost:4000`.

### 3. Frontend Setup
```bash
# Navigate to client
cd client

# Install dependencies
npm install

# Point the client at your local API
echo "VITE_API_URL=http://localhost:4000" > .env.local

# Start Vite development server
npm run dev
```
Frontend runs by default at `http://localhost:3000`.

---

## 🗺️ Master Plan & Future Development Roadmap

### Phase 1: Stabilization & Code Quality (Completed ✅)
- [x] **Fix CI Workflow**: Updated `.github/workflows/ci.yml` from `node --check src/server.js` to `npm run typecheck` (`tsc --noEmit`) and Node 22 test runners.
- [x] **Extract Service Layer**: Refactored controllers into lightweight HTTP adapters and created pure domain services (`workouts.service.ts`, `exercises.service.ts`).
- [x] **Automated Testing Suite**: Native zero-dependency test runner (`node:test`) covering schemas, auth guards, Redis caching, telemetry ring buffers, workout normalization, and the chat assistant (86 backend + 8 frontend tests).
- [x] **Pre-Push Quality Gate**: Git pre-push hook ([`.githooks/pre-push`](.githooks/pre-push)) verifying typechecks, test suites, and frontend build before any code leaves the developer machine.

### Phase 2: Core Domain & Analytics Enhancements
- [ ] **1RM (One Rep Max) & Volume Analytics**:
  - Compute estimated 1RM using Epley or Brzycki formulas.
  - Track total tonnage (volume = sets × reps × weight) per muscle group over time.
- [ ] **Calendar & Consistency Heatmap**:
  - GitHub-style workout consistency heatmap showing training frequency.
- [ ] **Rest Timer & Active Workout Mode**:
  - Live training overlay with audio notifications / vibration API for rest countdowns between sets.

### Phase 3: Advanced Real-time & Synchronization
- [ ] **WebSockets / SSE for Telemetry**:
  - Replace admin polling with Server-Sent Events (SSE) or WebSockets for live traffic stream.
- [ ] **Robust Conflict Resolution**:
  - Implement a timestamped Last-Write-Wins (LWW) or version vector approach for syncing offline edits to prevent overwriting updates made from other devices.

### Phase 4: Production Infrastructure & DevOps
- [ ] **Docker & Docker Compose**:
  - Multi-container local setup (`docker-compose.yml`) spinning up PostgreSQL, Redis, Node backend, and Vite frontend with one command.
- [ ] **Database Backup & Disaster Recovery**:
  - Automated WAL backups and snapshot policies for PostgreSQL.
- [ ] **Centralized Structured Logging**:
  - Transition console logs to Pino or Winston with JSON formatting ready for Datadog, Grafana Loki, or Logtail.

### Phase 5: Mobile & Native Ecosystem
- [ ] **Capacitor Integration**:
  - Package the existing PWA into iOS & Android native wrappers with hardware haptics.
- [ ] **Background Sync & Web Push**:
  - Integrate Background Sync API to replay queued workouts even if the browser tab is closed.

---

## 📚 Technical Documentation
For full architectural deep-dives, caching diagrams, database relationships, and security policies, see:
👉 [**ARCHITECTURE.md**](file:///d:/gymtrack/ARCHITECTURE.md)


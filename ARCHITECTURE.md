# GymTrack System Architecture & Engineering Handbook

> **Project Mission**: A production-grade, offline-capable fitness tracking platform and learning playground built with modern TypeScript, React, Node.js, PostgreSQL, and Redis.

---

## 1. System Overview & Mental Model

GymTrack is architected as an **offline-first, distributed full-stack application**. It balances rapid client responsiveness (via PWA service workers and React Query client caches) with high-throughput backend efficiency (via Redis cache-aside, resilient fallbacks, and indexed PostgreSQL relational queries).

```mermaid
graph TD
    subgraph Client ["Client Layer (Browser / PWA)"]
        UI["React 18 + Tailwind + Framer Motion"]
        RQ["TanStack React Query Cache (staleTime: 2m, gcTime: 10m)"]
        IDB["IndexedDB Store (Offline Operation Queue)"]
        SW["Service Worker (Cache-first asset delivery)"]
        UI --> RQ
        UI --> IDB
        UI --> SW
    end

    subgraph Edge ["Network & Edge Security"]
        ReverseProxy["Reverse Proxy (Render / Nginx / Cloudflare)"]
        CORS["Strict CORS Filter"]
        Helmet["Helmet Security Headers"]
        RateLimit["Rate Limiter (Express + Redis Store)"]
    end

    subgraph Backend ["Server Layer (Node.js / Express / TypeScript)"]
        Telemetry["Telemetry & Tracing (AsyncLocalStorage + X-Trace-Id)"]
        Router["Express Routers"]
        AuthMiddleware["JWT Authentication & RBAC Guard"]
        Validation["Zod Request Validation"]
        Controllers["Controllers (Workouts, Exercises, Auth, Admin)"]
    end

    subgraph Data ["Data & Storage Layer"]
        RedisCache["Redis (ioredis Cache-Aside & Fallback)"]
        PrismaORM["Prisma ORM (Client-side Query Tracing)"]
        Postgres[("PostgreSQL Database (Supabase / Render)")]
        B2["Backblaze B2 (S3-Compatible Object Storage for Avatars)"]
    end

    Client -->|HTTPS + JWT Bearer| ReverseProxy
    ReverseProxy --> CORS
    CORS --> Helmet
    Helmet --> RateLimit
    RateLimit --> Telemetry
    Telemetry --> Router
    Router --> AuthMiddleware
    AuthMiddleware --> Validation
    Validation --> Controllers

    Controllers -->|Check / Invalidate| RedisCache
    Controllers -->|dbTrace wrapper| PrismaORM
    PrismaORM --> Postgres
    Controllers -->|AWS SDK v3 / Presigned URLs| B2
```

---

## 2. Core Architectural Pillars

### 2.1 Separation of Concerns & Clean Layering

A scalable enterprise system enforces strict boundaries between layers:

```
Request ──> [Routes] ──> [Middleware] ──> [Controllers] ──> [Services / Libs] ──> [Prisma / Redis]
```

1. **Routes (`src/routes/`)**:
   - Sole responsibility: Map URI paths and HTTP verbs to middlewares and controllers.
   - Example: [`workouts.routes.ts`](file:///d:/gymtrack/server/src/routes/workouts.routes.ts).
2. **Middleware (`src/middleware/`)**:
   - Cross-cutting concerns: Authentication ([`auth.ts`](file:///d:/gymtrack/server/src/middleware/auth.ts)), schema validation ([`validate.ts`](file:///d:/gymtrack/server/src/middleware/validate.ts)), telemetry ([`tracker.ts`](file:///d:/gymtrack/server/src/middleware/tracker.ts)), security headers ([`helmet`](https://helmetjs.github.io/)).
3. **Controllers (`src/controllers/`)**:
   - HTTP transport layer: Parses queries/body, calls caching/data operations, sets status codes, formats JSON responses.
4. **Data Access & Storage (`src/db/`, `src/lib/`)**:
   - Database client abstraction ([`prisma.ts`](file:///d:/gymtrack/server/src/db/prisma.ts)).
   - Distributed cache wrapper with graceful degradation ([`redis.ts`](file:///d:/gymtrack/server/src/lib/redis.ts)).
   - S3-compatible cloud object storage ([`storage.ts`](file:///d:/gymtrack/server/src/lib/storage.ts)).

---

### 2.2 Dual-Layer Caching Strategy

Caching is implemented symmetrically at both ends of the wire to maximize perceived speed while minimizing database load:

| Metric / Dimension | Frontend (TanStack Query) | Backend (Redis Cache-Aside) |
| :--- | :--- | :--- |
| **Storage Engine** | Browser Memory (JavaScript heap) | Redis In-Memory KV Store |
| **Cache Key Strategy** | Hierarchical array: `['workouts', { date }]` | Colon-delimited: `exercises:userId:muscle:equipment:page:limit` |
| **Freshness (TTL)** | `staleTime: 2 minutes`, `gcTime: 10 minutes` | `TTL: 1800 seconds (30 minutes)` |
| **Invalidation Hook** | `queryClient.invalidateQueries(...)` on mutations | `invalidateCachePattern('exercises:*')` on create/edit |
| **Resilience Mechanism** | Offline fallback to IndexedDB queue | Graceful fallback to direct PostgreSQL if Redis is down |

#### Backend Cache-Aside Pattern ([`redis.ts`](file:///d:/gymtrack/server/src/lib/redis.ts))
```typescript
export async function cacheAside<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  // 1. Check Redis if available
  if (redis && isRedisConnected()) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T; // CACHE HIT
  }
  // 2. CACHE MISS -> Fetch from PostgreSQL
  const data = await fetcher();
  // 3. Asynchronously populate cache (non-blocking)
  if (redis && isRedisConnected() && data != null) {
    redis.setex(key, ttlSeconds, JSON.stringify(data)).catch(console.warn);
  }
  return data;
}
```

---

### 2.3 Offline-First Architecture & Sync Lifecycle

GymTrack operates reliably even in basement gym settings without Wi-Fi or cellular connectivity:

```mermaid
sequenceDiagram
    autonumber
    actor User as Athlete
    participant App as React App
    participant IDB as IndexedDB Queue
    participant Net as Network Monitor
    participant API as Backend API
    participant DB as PostgreSQL

    User->>App: Logs Workout / Set
    alt Device is Online
        App->>API: POST /api/workouts
        API->>DB: INSERT into Workouts & Sets
        DB-->>API: Saved
        API-->>App: 201 Created (with server ID)
        App->>App: TanStack Query cache updated
    else Device is Offline
        App->>IDB: addPendingOperation(userId, draft)
        IDB-->>App: Assigned localId ("local-173...")
        App->>User: Instant UI Update + "Saved to offline queue" toast
        Note over App,Net: Athlete trains without interruption
        Net->>App: "online" event fired
        App->>IDB: getAllPending(userId)
        loop For each pending item
            App->>API: POST /api/workouts (Replay)
            API->>DB: Commit transaction
            API-->>App: 201 Created
            App->>IDB: removePending(localId)
        end
        App->>User: "Synced offline workouts!" toast
    end
```

---

### 2.4 Observability, Tracing, and Telemetry

Instead of treating server operations as a black box, GymTrack embeds **distributed tracing**:

1. **`X-Trace-Id`**: Every incoming HTTP request is assigned a UUID. This ID flows through:
   - Request logger
   - Response headers (`exposedHeaders: ['X-Trace-Id']`)
   - AsyncLocalStorage context ([`asyncContext.ts`](file:///d:/gymtrack/server/src/lib/asyncContext.ts))
   - Database query logs ([`dbTrace.ts`](file:///d:/gymtrack/server/src/lib/dbTrace.ts))
2. **Database Query Tracing (`dbTrace`)**:
   - Wraps every Prisma invocation to measure exact execution time in milliseconds.
   - Attaches execution metrics to live admin telemetry logs.
3. **Live Admin Traffic Map**:
   - Captures client IP, geolocation, request status, duration, and associated DB query for security auditing and performance tuning.

---

### 2.5 Cloud Storage & Media Handling

User avatars use an **enterprise zero-disk architecture**:
- Uploaded file streams directly from client multipart form data into Node memory buffer via `multer.memoryStorage()`.
- Uploaded directly into Backblaze B2 (S3-compatible) using AWS SDK v3 `PutObjectCommand`.
- The database stores **only the storage key** (e.g., `avatars/user-uuid-1729.png`), never binary BLOBs.
- Read operations generate **time-limited presigned URLs** (`getSignedUrl` from `@aws-sdk/s3-request-presigner`) valid for 24 hours, ensuring private bucket security without proxying heavy media bytes through the Node server.

---

## 3. Database Schema Design (Prisma)

```
[User] 1 ────< [Workout] 1 ────< [WorkoutSet]
  │
  ├──────< [Template] 1 ───< [TemplateExercise]
  │
  └──────< [Exercise] (Public or Custom)
```

- **Referential Integrity**: Cascading deletes (`onDelete: Cascade`) guarantee that removing a workout automatically wipes its nested sets, and removing an account purges all associated workout logs and private routines.
- **Ownership Isolation**: Every query in [`workouts.controller.ts`](file:///d:/gymtrack/server/src/controllers/workouts.controller.ts) strictly filters by `userId: req.user.id`, preventing horizontal privilege escalation.
- **Performance Indexes**: Multi-column indexes on `Exercise(muscleGroup)` and `Exercise(userId)` accelerate filtered and user-custom searches.

---

## 4. Engineering Standards & Code Conventions

1. **Type Safety Across the Wire**:
   - Frontend and backend TypeScript definitions mirror each other.
   - Runtime inputs are validated using Zod before reaching any business logic.
2. **Defensive Async Handling**:
   - Unhandled rejections are caught by the centralized Express [`errorHandler.ts`](file:///d:/gymtrack/server/src/middleware/errorHandler.ts).
   - Redis operations are non-blocking; a Redis downtime never crashes an HTTP route.
3. **Security Standards**:
   - Passwords hashed with Bcrypt (salt rounds: 10+).
   - Strict CORS origin whitelisting.
   - Helmet for HTTP header protection.
   - Rate limiting per IP to mitigate brute force attempts.


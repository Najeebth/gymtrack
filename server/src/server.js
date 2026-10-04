import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { requestTracker } from './middleware/tracker.js';
import traceRoutes from './routes/trace.js';
import { getCurrentTrace } from './asyncContext.js';
import { startStep, finishStep } from './requestTracker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Prisma Client with query logging enabled
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' }
  ]
});

// In-memory traffic ring buffer (last 50 requests)
const requestLogs = [];

// Track the most recent SQL query telemetry
let lastDbQuery = null;

prisma.$on('query', (e) => {
  // Keep for console logging only — async context is disconnected here
  // so we cannot reliably call getCurrentTrace() from this event handler.
  lastDbQuery = {
    query: e.query,
    durationMs: e.duration,
    timestamp: new Date().toISOString()
  };
  console.log(`[SQL QUERY] (${e.duration}ms) ${e.query}`);
});

/**
 * Wraps any Prisma call with request-trace step recording.
 * Because this runs in the same async context as the route handler,
 * getCurrentTrace() reliably returns the current request's trace.
 *
 * Usage:
 *   const workouts = await dbTrace('findMany Workout', () => prisma.workout.findMany(...));
 */
async function dbTrace(label, queryFn) {
  const trace = getCurrentTrace();
  const step = trace ? startStep(trace, `db: ${label}`) : null;
  try {
    const result = await queryFn();
    return result;
  } finally {
    if (step) {
      finishStep(step);
      // Push updated trace to any live SSE subscriber
      if (trace.push) trace.push(trace);
    }
  }
}

// --- 1. Middleware ---
app.use(cors({
  exposedHeaders: ['X-Trace-Id']  // allow browser to read this custom header
}));
app.use(express.json());

// --- 2. Traffic Telemetry Middleware (Legacy & New) ---
app.use(requestTracker); // New advanced tracker

app.use((req, res, next) => {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();
  lastDbQuery = null; // Reset per request

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = parseFloat(((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2));

    const logEntry = {
      id: req.traceId || ('req_' + Date.now() + Math.random().toString(36).substring(2, 5)),
      timestamp,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      httpDurationMs: durationMs,
      dbQuery: lastDbQuery ? { ...lastDbQuery } : null,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };

    requestLogs.unshift(logEntry);
    if (requestLogs.length > 50) requestLogs.pop();

    const dbInfo = logEntry.dbQuery ? ` | DB: ${logEntry.dbQuery.durationMs}ms` : '';
    console.log(`[TRAFFIC] ${logEntry.timestamp} | ${logEntry.method} ${logEntry.url} | ${logEntry.status} | Total: ${logEntry.httpDurationMs}ms${dbInfo}`);
  });

  next();
});

// --- 3. Endpoints ---
app.use('/api/traces', traceRoutes);


// Health & System Telemetry Endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await dbTrace('SELECT 1 (health check)', () => prisma.$queryRaw`SELECT 1`);
    dbStatus = 'connected (PostgreSQL)';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  res.json({
    status: 'healthy',
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsageMB: {
      rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
      heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2),
      heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
    }
  });
});

// Traffic Monitor Endpoint (for frontend live inspector)
app.get('/api/traffic', (req, res) => {
  res.json({
    trackedCount: requestLogs.length,
    requests: requestLogs
  });
});

// Normalizes a raw sets payload (array of {reps, weightKg}) into
// Prisma nested-create rows with sequential setNumbers.
function normalizeSets(rawSets) {
  if (!Array.isArray(rawSets) || rawSets.length === 0) return [];
  return rawSets.map((s, idx) => ({
    setNumber: idx + 1,
    reps: Number(s.reps),
    weightKg: Number(s.weightKg)
  }));
}

// GET all workouts from PostgreSQL (each with its nested sets)
// Optional ?date=YYYY-MM-DD query param filters to workouts logged on that date.
app.get('/api/workouts', async (req, res) => {
  const { date } = req.query;

  try {
    const workouts = await dbTrace(
      date ? `findMany Workout (date:${date})` : 'findMany Workout (ordered by createdAt desc)',
      () =>
        prisma.workout.findMany({
          where: date ? { date: String(date) } : undefined,
          orderBy: { createdAt: 'desc' },
          include: { sets: { orderBy: { setNumber: 'asc' } } }
        })
    );
    res.json(workouts);
  } catch (err) {
    console.error('Error fetching workouts from Postgres:', err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// POST a new workout entry (with one or more sets) to PostgreSQL
app.post('/api/workouts', async (req, res) => {
  const { date, muscleGroup, exercise, notes, sets } = req.body;
  const normalizedSets = normalizeSets(sets);

  if (!exercise || normalizedSets.length === 0) {
    return res.status(400).json({ error: 'Exercise and at least one set (reps, weightKg) are required.' });
  }
  if (normalizedSets.some((s) => Number.isNaN(s.reps) || Number.isNaN(s.weightKg))) {
    return res.status(400).json({ error: 'Each set requires valid numeric reps and weightKg.' });
  }

  try {
    const workout = await dbTrace('create Workout (with sets)', () =>
      prisma.workout.create({
        data: {
          date: date || new Date().toISOString().split('T')[0],
          muscleGroup: muscleGroup || 'General',
          exercise: exercise.trim(),
          notes: notes || '',
          sets: { create: normalizedSets }
        },
        include: { sets: { orderBy: { setNumber: 'asc' } } }
      })
    );
    res.status(201).json(workout);
  } catch (err) {
    console.error('Error creating workout in Postgres:', err);
    res.status(500).json({ error: 'Failed to create workout' });
  }
});

// POST additional set(s) onto an existing workout
app.post('/api/workouts/:id/sets', async (req, res) => {
  const { id } = req.params;
  const newSets = Array.isArray(req.body.sets) ? req.body.sets : [req.body];

  try {
    const workout = await dbTrace(`findUnique Workout id:${id} (for set append)`, () =>
      prisma.workout.findUnique({ where: { id }, include: { sets: true } })
    );
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const startingSetNumber = workout.sets.length;
    const setsToCreate = newSets.map((s, idx) => ({
      setNumber: startingSetNumber + idx + 1,
      reps: Number(s.reps),
      weightKg: Number(s.weightKg),
      workoutId: id
    }));

    if (setsToCreate.some((s) => Number.isNaN(s.reps) || Number.isNaN(s.weightKg))) {
      return res.status(400).json({ error: 'Each set requires valid numeric reps and weightKg.' });
    }

    await dbTrace('createMany WorkoutSet', () =>
      prisma.workoutSet.createMany({ data: setsToCreate })
    );

    const updated = await dbTrace(`findUnique Workout id:${id} (after set append)`, () =>
      prisma.workout.findUnique({ where: { id }, include: { sets: { orderBy: { setNumber: 'asc' } } } })
    );

    res.status(201).json(updated);
  } catch (err) {
    console.error('Error adding set(s) to workout in Postgres:', err);
    res.status(500).json({ error: 'Failed to add set(s) to workout' });
  }
});

// DELETE a single set from a workout
app.delete('/api/workouts/:id/sets/:setId', async (req, res) => {
  const { id, setId } = req.params;

  try {
    await dbTrace(`delete WorkoutSet id:${setId}`, () =>
      prisma.workoutSet.delete({ where: { id: setId } })
    );
    const updated = await dbTrace(`findUnique Workout id:${id} (after set delete)`, () =>
      prisma.workout.findUnique({ where: { id }, include: { sets: { orderBy: { setNumber: 'asc' } } } })
    );
    res.json(updated || { success: true });
  } catch (err) {
    console.error('Error deleting set in Postgres:', err);
    res.status(404).json({ error: 'Set not found or already deleted' });
  }
});

// DELETE a workout entry (and its sets, via cascade) from PostgreSQL
app.delete('/api/workouts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await dbTrace(`delete Workout id:${id}`, () =>
      prisma.workout.delete({ where: { id } })
    );
    res.json({ success: true, message: `Workout ${id} deleted` });
  } catch (err) {
    console.error('Error deleting workout in Postgres:', err);
    res.status(404).json({ error: 'Workout not found or already deleted' });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  GymTrack API running on: http://localhost:${PORT}`);
  console.log(`  Connected DB: PostgreSQL via Prisma ORM`);
  console.log(`  - Health:   http://localhost:${PORT}/api/health`);
  console.log(`  - Traffic:  http://localhost:${PORT}/api/traffic`);
  console.log(`  - Workouts: http://localhost:${PORT}/api/workouts`);
  console.log(`===============================================`);
});

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

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
  lastDbQuery = {
    query: e.query,
    durationMs: e.duration,
    timestamp: new Date().toISOString()
  };
  console.log(`[SQL QUERY] (${e.duration}ms) ${e.query}`);
});

// --- 1. Traffic Telemetry Middleware ---
app.use((req, res, next) => {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();
  lastDbQuery = null; // Reset per request

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = parseFloat(((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2));

    const logEntry = {
      id: 'req_' + Date.now() + Math.random().toString(36).substring(2, 5),
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

// --- 2. Middleware ---
app.use(cors());
app.use(express.json());

// --- 3. Endpoints ---

// Health & System Telemetry Endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    // Run a quick raw SQL check to verify Postgres connection
    await prisma.$queryRaw`SELECT 1`;
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

// GET all workouts from PostgreSQL
app.get('/api/workouts', async (req, res) => {
  try {
    const workouts = await prisma.workout.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(workouts);
  } catch (err) {
    console.error('Error fetching workouts from Postgres:', err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// POST a new workout entry to PostgreSQL
app.post('/api/workouts', async (req, res) => {
  const { date, muscleGroup, exercise, sets, reps, weightKg, notes } = req.body;

  if (!exercise || sets === undefined || reps === undefined || weightKg === undefined) {
    return res.status(400).json({ error: 'Exercise, sets, reps, and weightKg are required.' });
  }

  try {
    const workout = await prisma.workout.create({
      data: {
        date: date || new Date().toISOString().split('T')[0],
        muscleGroup: muscleGroup || 'General',
        exercise: exercise.trim(),
        sets: Number(sets),
        reps: Number(reps),
        weightKg: Number(weightKg),
        notes: notes || ''
      }
    });

    res.status(201).json(workout);
  } catch (err) {
    console.error('Error creating workout in Postgres:', err);
    res.status(500).json({ error: 'Failed to create workout' });
  }
});

// DELETE a workout entry from PostgreSQL
app.delete('/api/workouts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.workout.delete({
      where: { id }
    });
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

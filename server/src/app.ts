import express from 'express';
import cors from 'cors';
import { requestTracker } from './middleware/tracker.js';
import { trafficLogger } from './middleware/trafficLogger.js';
import { requireAdmin } from './middleware/auth.js';
import authRoutes from './routes/auth.routes.js';
import traceRoutes from './routes/trace.routes.js';
import healthRoutes from './routes/health.routes.js';
import trafficRoutes from './routes/traffic.routes.js';
import workoutsRoutes from './routes/workouts.routes.js';

export const app = express();

// --- Middleware ---
app.use(
  cors({
    exposedHeaders: ['X-Trace-Id'], // allow browser to read this custom header
  })
);
app.use(express.json());

// --- Traffic Telemetry Middleware ---
app.use(requestTracker);
app.use(trafficLogger);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/traces', requireAdmin, traceRoutes);
app.use('/api/health', requireAdmin, healthRoutes);
app.use('/api/traffic', requireAdmin, trafficRoutes);
app.use('/api/workouts', workoutsRoutes);

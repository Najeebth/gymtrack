import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { CLIENT_URL } from './config/env.js';
import { requestTracker } from './middleware/tracker.js';
import { trafficLogger } from './middleware/trafficLogger.js';
import { requireAdmin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import traceRoutes from './routes/trace.routes.js';
import healthRoutes from './routes/health.routes.js';
import trafficRoutes from './routes/traffic.routes.js';
import workoutsRoutes from './routes/workouts.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import usersRoutes from './routes/users.routes.js';
import exercisesRoutes from './routes/exercises.routes.js';
import profileRoutes from './routes/profile.routes.js';

export const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy, so req.ip would
// otherwise be the proxy's address — needed for rate limiting and the
// traffic logger's IP field to reflect the real client.
app.set('trust proxy', 1);

// --- Security Headers (Helmet) ---
// Protects against clickjacking, MIME sniffing, XSS, and strips X-Powered-By
app.use(helmet());

// --- Strict CORS ---
// Only allow trusted frontend client origins
app.use(
  cors({
    origin: [
      CLIENT_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://gymtrack-prdf.onrender.com',
    ],
    credentials: true,
    exposedHeaders: ['X-Trace-Id'], // allow browser to read telemetry trace header
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
app.use('/api/users', requireAdmin, usersRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/profile', profileRoutes);

// --- Global Error Handling ---
app.use(notFoundHandler);
app.use(errorHandler);

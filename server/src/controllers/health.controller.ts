import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  let dbStatus = 'disconnected';
  try {
    await dbTrace('SELECT 1 (health check)', () => prisma.$queryRaw`SELECT 1`);
    dbStatus = 'connected (PostgreSQL)';
  } catch (err) {
    dbStatus = `error: ${(err as Error).message}`;
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
      heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    },
  });
}

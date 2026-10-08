import { PrismaClient, Prisma } from '@prisma/client';
import { recordDbQuery } from '../lib/trafficLog.js';

// Single shared Prisma Client instance with query logging enabled.
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
  ],
});

prisma.$on('query', (e: Prisma.QueryEvent) => {
  // Keep for console logging only — async context is disconnected here
  // so we cannot reliably call getCurrentTrace() from this event handler.
  recordDbQuery({
    query: e.query,
    durationMs: e.duration,
    timestamp: new Date().toISOString(),
  });
  console.log(`[SQL QUERY] (${e.duration}ms) ${e.query}`);
});

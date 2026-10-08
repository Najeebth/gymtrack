import type { Request, Response, NextFunction } from 'express';
import { addRequestLog, getLastDbQuery, resetLastDbQuery } from '../lib/trafficLog.js';
import type { TrafficLogEntry } from '../types/index.js';

export function trafficLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();
  resetLastDbQuery(); // Reset per request

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = parseFloat(((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2));
    const dbQuery = getLastDbQuery();

    const logEntry: TrafficLogEntry = {
      id: req.traceId || 'req_' + Date.now() + Math.random().toString(36).substring(2, 5),
      timestamp,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      httpDurationMs: durationMs,
      dbQuery: dbQuery ? { ...dbQuery } : null,
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    addRequestLog(logEntry);

    const dbInfo = logEntry.dbQuery ? ` | DB: ${logEntry.dbQuery.durationMs}ms` : '';
    console.log(
      `[TRAFFIC] ${logEntry.timestamp} | ${logEntry.method} ${logEntry.url} | ${logEntry.status} | Total: ${logEntry.httpDurationMs}ms${dbInfo}`
    );
  });

  next();
}

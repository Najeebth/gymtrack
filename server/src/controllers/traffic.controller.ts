import type { Request, Response } from 'express';
import { getRequestLogs } from '../lib/trafficLog.js';

export function getTraffic(_req: Request, res: Response): void {
  const requestLogs = getRequestLogs();
  res.json({
    trackedCount: requestLogs.length,
    requests: requestLogs,
  });
}

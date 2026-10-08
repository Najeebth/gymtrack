import type { Request, Response } from 'express';
import { getStore } from '../lib/requestTracker.js';

export function listTraces(_req: Request, res: Response): void {
  const traces = Array.from(getStore().values()).map((t) => ({
    id: t.id,
    method: t.method,
    url: t.url,
    startTime: t.startTime,
    stepsCount: t.steps.length,
  }));
  res.json(traces);
}

export function streamTrace(req: Request, res: Response): void {
  const { id } = req.params;
  const trace = getStore().get(id);

  if (!trace) {
    res.status(404).send('not found');
    return;
  }

  // Set SSE headers
  res.set({
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  // Initial payload
  res.write(`data: ${JSON.stringify(trace)}\n\n`);

  // Save the push function so the tracker can call it later
  trace.push = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Keep the connection alive (ping every 15s)
  const keepAlive = setInterval(() => res.write(':\n\n'), 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    trace.push = undefined;
  });
}

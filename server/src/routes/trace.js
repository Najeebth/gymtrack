import { Router } from 'express';
import { getStore } from '../requestTracker.js';

const router = Router();

// List all active/recent requests
router.get('/list', (req, res) => {
  const traces = Array.from(getStore().values()).map(t => ({
    id: t.id,
    method: t.method,
    url: t.url,
    startTime: t.startTime,
    stepsCount: t.steps.length,
  }));
  res.json(traces);
});

// Stream details of a single request
router.get('/stream/:id', (req, res) => {
  const { id } = req.params;
  const trace = getStore().get(id);
  
  if (!trace) {
    return res.status(404).send('not found');
  }

  // Set SSE headers
  res.set({
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
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
});

export default router;

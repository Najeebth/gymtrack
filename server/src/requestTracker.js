import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

// In-memory store - keep only recent N requests
const STORE = new Map();
const MAX_STORE = 200;

export function getStore() { 
  return STORE; 
}

export function addTrace(trace) {
  if (STORE.size >= MAX_STORE) {
    // delete the oldest entry (simple FIFO)
    const oldestKey = STORE.keys().next().value;
    STORE.delete(oldestKey);
  }
  STORE.set(trace.id, trace);
}

// Helper to start a step
export function startStep(trace, name) {
  const step = {
    name,
    startMs: performance.now(),
    cpuStart: process.cpuUsage(),
    memStart: process.memoryUsage(),
  };
  trace.steps.push(step);
  return step;
}

// Helper to finish a step
export function finishStep(step) {
  step.endMs = performance.now();
  step.durationMs = step.endMs - step.startMs;
  step.cpuEnd = process.cpuUsage();
  step.memEnd = process.memoryUsage();
}

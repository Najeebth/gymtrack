import { performance } from 'perf_hooks';
import type { Step, Trace } from '../types/index.js';

// In-memory store - keep only recent N requests
const STORE = new Map<string, Trace>();
const MAX_STORE = 200;

export function getStore(): Map<string, Trace> {
  return STORE;
}

export function addTrace(trace: Trace): void {
  if (STORE.size >= MAX_STORE) {
    // delete the oldest entry (simple FIFO)
    const oldestKey = STORE.keys().next().value;
    if (oldestKey !== undefined) STORE.delete(oldestKey);
  }
  STORE.set(trace.id, trace);
}

// Helper to start a step
export function startStep(trace: Trace, name: string): Step {
  const step: Step = {
    name,
    startMs: performance.now(),
    cpuStart: process.cpuUsage(),
    memStart: process.memoryUsage(),
  };
  trace.steps.push(step);
  return step;
}

// Helper to finish a step
export function finishStep(step: Step): void {
  step.endMs = performance.now();
  step.durationMs = step.endMs - step.startMs;
  step.cpuEnd = process.cpuUsage();
  step.memEnd = process.memoryUsage();
}

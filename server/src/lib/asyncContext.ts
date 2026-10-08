import asyncHooks from 'async_hooks';
import type { Trace } from '../types/index.js';

const asyncMap = new Map<number, Trace>();

export const asyncHook = asyncHooks.createHook({
  init(asyncId, _type, triggerAsyncId) {
    // Propagate the trace from the parent to the child async resource
    const parentTrace = asyncMap.get(triggerAsyncId);
    if (parentTrace) {
      asyncMap.set(asyncId, parentTrace);
    }
  },
  destroy(asyncId) {
    asyncMap.delete(asyncId);
  },
}).enable();

export function bindTraceToCurrentContext(trace: Trace): void {
  const eid = asyncHooks.executionAsyncId();
  asyncMap.set(eid, trace);
}

// Helper used by the Prisma query hook
export function getCurrentTrace(): Trace | undefined {
  const eid = asyncHooks.executionAsyncId();
  return asyncMap.get(eid);
}

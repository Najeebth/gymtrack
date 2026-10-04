import asyncHooks from 'async_hooks';

const asyncMap = new Map();

export const asyncHook = asyncHooks.createHook({
  init(asyncId, type, triggerAsyncId) {
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

export function bindTraceToCurrentContext(trace) {
  const eid = asyncHooks.executionAsyncId();
  asyncMap.set(eid, trace);
}

// Helper used by the Prisma query hook
export function getCurrentTrace() {
  const eid = asyncHooks.executionAsyncId();
  return asyncMap.get(eid);
}

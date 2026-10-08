import { getCurrentTrace } from './asyncContext.js';
import { startStep, finishStep } from './requestTracker.js';

/**
 * Wraps any Prisma call with request-trace step recording.
 * Because this runs in the same async context as the route handler,
 * getCurrentTrace() reliably returns the current request's trace.
 *
 * Usage:
 *   const workouts = await dbTrace('findMany Workout', () => prisma.workout.findMany(...));
 */
export async function dbTrace<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  const trace = getCurrentTrace();
  const step = trace ? startStep(trace, `db: ${label}`) : null;
  try {
    return await queryFn();
  } finally {
    if (step) {
      finishStep(step);
      // Push updated trace to any live SSE subscriber
      if (trace?.push) trace.push(trace);
    }
  }
}

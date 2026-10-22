import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { redis } from '../../lib/redis.js';
import { ChatTools, formatSets, type ChatToolDeps } from './tools.js';

// tools.ts imports the real services for its defaults, which opens a Redis
// connection that would otherwise keep the test process alive.
after(() => {
  redis?.disconnect();
});

const scope = { userId: 'user-1', today: '2026-10-22' };

const benchWorkout = {
  id: 'w1',
  date: '2026-10-20',
  exercise: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  notes: '',
  createdAt: new Date(),
  userId: 'user-1',
  sets: [
    { id: 's1', setNumber: 1, reps: 8, weightKg: 60, workoutId: 'w1', createdAt: new Date() },
    { id: 's2', setNumber: 2, reps: 6, weightKg: 62.5, workoutId: 'w1', createdAt: new Date() },
  ],
};

/** Fake services that record which userId every query was scoped to. */
function fakeDeps() {
  const calls: { method: string; userId: string; arg?: unknown }[] = [];
  const deps = {
    workouts: {
      listWorkouts: async (userId: string, date?: string) => {
        calls.push({ method: 'listWorkouts', userId, arg: date });
        return date === '2026-10-20' ? [benchWorkout] : [];
      },
      listWorkoutsSince: async (userId: string, since: string) => {
        calls.push({ method: 'listWorkoutsSince', userId, arg: since });
        return [benchWorkout];
      },
      listLoggedExerciseNames: async (userId: string) => {
        calls.push({ method: 'listLoggedExerciseNames', userId });
        return ['Barbell Bench Press'];
      },
      getPersonalBest: async (userId: string, exercise: string) => {
        calls.push({ method: 'getPersonalBest', userId, arg: exercise });
        return exercise === 'Barbell Bench Press'
          ? { ...benchWorkout.sets[1], workout: { date: '2026-10-20', exercise: 'Barbell Bench Press' } }
          : null;
      },
      getLastWorkout: async (userId: string, filter: unknown) => {
        calls.push({ method: 'getLastWorkout', userId, arg: filter });
        return benchWorkout;
      },
    },
    exercises: {
      listExerciseIndex: async (userId: string) => {
        calls.push({ method: 'listExerciseIndex', userId });
        return [
          { name: 'Barbell Bench Press', muscleGroup: 'Chest' },
          { name: 'Close-Grip Bench Press', muscleGroup: 'Arms' },
          { name: 'Barbell Squat', muscleGroup: 'Legs' },
        ];
      },
    },
  } as unknown as ChatToolDeps;
  return { deps, calls };
}

describe('ChatTools', () => {
  it('should format sets compactly with BW for bodyweight', () => {
    assert.equal(formatSets([{ reps: 8, weightKg: 60 }, { reps: 10, weightKg: 0 }]), '60kg×8, BW×10');
  });

  it('should resolve short exercise names before looking up a personal best', async () => {
    const { deps } = fakeDeps();
    const result = await new ChatTools(scope, deps).personalBest('bench');
    assert.deepEqual(result, { found: true, exercise: 'Barbell Bench Press', weightKg: 62.5, reps: 6, date: '2026-10-20' });
  });

  it('should report not found instead of throwing', async () => {
    const { deps } = fakeDeps();
    const result = await new ChatTools(scope, deps).personalBest('squat');
    assert.deepEqual(result, { found: false, exercise: 'Barbell Squat' });
  });

  it('should load exercise candidates only once per request', async () => {
    const { deps, calls } = fakeDeps();
    const tools = new ChatTools(scope, deps);
    await tools.resolveExercise('bench');
    await tools.resolveExercise('squat');
    await tools.muscleGroupFor('Barbell Squat');
    assert.equal(calls.filter((c) => c.method === 'listExerciseIndex').length, 1);
  });

  it('should take the muscle group from the library, else from history', async () => {
    const { deps } = fakeDeps();
    const tools = new ChatTools(scope, deps);
    assert.equal(await tools.muscleGroupFor('barbell squat'), 'Legs');
    assert.equal(await tools.muscleGroupFor('Some Custom Move'), 'Chest'); // fake getLastWorkout returns the bench workout
  });

  it('should scope every query to the authenticated user, ignoring model arguments', async () => {
    const { deps, calls } = fakeDeps();
    const tools = new ChatTools(scope, deps);
    await tools.execute({ name: 'get_personal_best', arguments: { exercise: 'bench', userId: 'attacker' } });
    await tools.execute({ name: 'get_recent_training', arguments: { days: 7 } });
    assert.ok(calls.length > 0);
    assert.ok(calls.every((c) => c.userId === 'user-1'));
  });

  it('should resolve relative dates in list_workouts_on_date', async () => {
    const { deps } = fakeDeps();
    const result = await new ChatTools({ ...scope, today: '2026-10-21' }, deps).execute({
      name: 'list_workouts_on_date',
      arguments: { date: 'yesterday' },
    });
    assert.deepEqual(result, {
      date: '2026-10-20',
      workouts: [{ date: '2026-10-20', exercise: 'Barbell Bench Press', muscleGroup: 'Chest', sets: '60kg×8, 62.5kg×6' }],
    });
  });

  it('should compute the recent training window from the client date', async () => {
    const { deps, calls } = fakeDeps();
    await new ChatTools(scope, deps).execute({ name: 'get_recent_training', arguments: { days: '7' } });
    assert.equal(calls.find((c) => c.method === 'listWorkoutsSince')?.arg, '2026-10-16');
  });

  it('should return readable errors for unknown tools and invalid arguments', async () => {
    const { deps } = fakeDeps();
    const tools = new ChatTools(scope, deps);
    assert.deepEqual(await tools.execute({ name: 'drop_tables', arguments: {} }), { error: 'Unknown tool: drop_tables' });

    const invalidDate = (await tools.execute({ name: 'list_workouts_on_date', arguments: { date: 'last tuesday' } })) as { error: string };
    assert.match(invalidDate.error, /Invalid arguments for list_workouts_on_date/);

    const missing = (await tools.execute({ name: 'get_last_workout', arguments: {} })) as { error: string };
    assert.match(missing.error, /exercise or muscle_group is required/);

    const tooMany = (await tools.execute({ name: 'get_recent_training', arguments: { days: 365 } })) as { error: string };
    assert.match(tooMany.error, /Invalid arguments/);
  });
});

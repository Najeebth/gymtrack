// Database-backed methods of WorkoutsService, with Prisma replaced by mocks.
// These assert the queries the service builds, above all that every one is
// scoped to the user. (The pure normalizeSets helper is tested in
// workouts.service.test.ts.)

jest.mock('../db/prisma.js', () => ({
  prisma: {
    workout: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
    },
    workoutSet: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '../db/prisma.js';
import { workoutsService } from './workouts.service.js';

const workout = prisma.workout as unknown as Record<string, jest.Mock>;
const workoutSet = prisma.workoutSet as unknown as Record<string, jest.Mock>;
const withOrderedSets = { sets: { orderBy: { setNumber: 'asc' } } };

beforeEach(() => {
  [...Object.values(workout), ...Object.values(workoutSet)].forEach((fn) => fn.mockReset());
});

describe('WorkoutsService.listWorkouts', () => {
  it("only asks for the user's workouts, newest first, with sets in order", async () => {
    workout.findMany.mockResolvedValue([]);

    await workoutsService.listWorkouts('user-1');

    expect(workout.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      include: withOrderedSets,
    });
  });

  it('adds the date filter when given', async () => {
    workout.findMany.mockResolvedValue([]);

    await workoutsService.listWorkouts('user-1', '2026-11-12');

    expect(workout.findMany.mock.calls[0][0].where).toEqual({ userId: 'user-1', date: '2026-11-12' });
  });
});

describe('WorkoutsService.createWorkout', () => {
  it('stores the user id, a trimmed exercise name and 1-based set numbers', async () => {
    workout.create.mockResolvedValue({ id: 'w1' });

    await workoutsService.createWorkout('user-1', {
      date: '2026-11-12',
      muscleGroup: 'Chest',
      exercise: '  Bench Press  ',
      notes: 'felt strong',
      sets: [
        { reps: 10, weightKg: 60 },
        { reps: 8, weightKg: 70 },
      ],
    });

    expect(workout.create.mock.calls[0][0].data).toEqual({
      date: '2026-11-12',
      muscleGroup: 'Chest',
      exercise: 'Bench Press',
      notes: 'felt strong',
      userId: 'user-1',
      sets: {
        create: [
          { setNumber: 1, reps: 10, weightKg: 60 },
          { setNumber: 2, reps: 8, weightKg: 70 },
        ],
      },
    });
  });

  it("defaults the date to today, the muscle group to 'General' and notes to empty", async () => {
    workout.create.mockResolvedValue({ id: 'w1' });

    await workoutsService.createWorkout('user-1', { exercise: 'Squat', sets: [{ reps: 5, weightKg: 100 }] });

    const data = workout.create.mock.calls[0][0].data;
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.muscleGroup).toBe('General');
    expect(data.notes).toBe('');
  });
});

describe('WorkoutsService.updateWorkout', () => {
  it("returns null and writes nothing when the workout isn't the user's", async () => {
    workout.findFirst.mockResolvedValue(null);

    const result = await workoutsService.updateWorkout('w1', 'user-1', { exercise: 'Row' });

    expect(result).toBeNull();
    expect(workout.findFirst).toHaveBeenCalledWith({ where: { id: 'w1', userId: 'user-1' } });
    expect(workout.update).not.toHaveBeenCalled();
  });

  it('updates only the fields provided and trims the exercise name', async () => {
    workout.findFirst.mockResolvedValue({ id: 'w1' });
    workout.update.mockResolvedValue({ id: 'w1' });

    await workoutsService.updateWorkout('w1', 'user-1', { exercise: '  Row  ', notes: '' });

    expect(workout.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { exercise: 'Row', notes: '' },
      include: withOrderedSets,
    });
  });
});

describe('WorkoutsService.updateSet', () => {
  it('reports WORKOUT_NOT_FOUND without touching sets when the workout belongs to someone else', async () => {
    workout.findFirst.mockResolvedValue(null);

    const result = await workoutsService.updateSet('w1', 's1', 'user-1', 5, 50);

    expect(result).toEqual({ status: 'WORKOUT_NOT_FOUND' });
    expect(workoutSet.updateMany).not.toHaveBeenCalled();
  });

  it('only matches a set that belongs to that workout, so a set from another workout cannot be edited', async () => {
    workout.findFirst.mockResolvedValue({ id: 'w1' });
    workoutSet.updateMany.mockResolvedValue({ count: 0 });

    const result = await workoutsService.updateSet('w1', 'foreign-set', 'user-1', 5, 50);

    expect(workoutSet.updateMany).toHaveBeenCalledWith({
      where: { id: 'foreign-set', workoutId: 'w1' },
      data: { reps: 5, weightKg: 50 },
    });
    expect(result).toEqual({ status: 'SET_NOT_FOUND' });
  });

  it('returns the refreshed workout on success', async () => {
    workout.findFirst.mockResolvedValue({ id: 'w1' });
    workoutSet.updateMany.mockResolvedValue({ count: 1 });
    workout.findUnique.mockResolvedValue({ id: 'w1', sets: [] });

    const result = await workoutsService.updateSet('w1', 's1', 'user-1', 12, 65);

    expect(result).toEqual({ status: 'SUCCESS', data: { id: 'w1', sets: [] } });
  });
});

describe('WorkoutsService.addSets', () => {
  it("returns null when the workout isn't the user's", async () => {
    workout.findFirst.mockResolvedValue(null);

    expect(await workoutsService.addSets('w1', 'user-1', [{ reps: 5, weightKg: 50 }])).toBeNull();
    expect(workoutSet.createMany).not.toHaveBeenCalled();
  });

  it('continues numbering after the existing sets', async () => {
    workout.findFirst.mockResolvedValue({ id: 'w1', sets: [{}, {}, {}] }); // 3 sets so far
    workoutSet.createMany.mockResolvedValue({ count: 2 });
    workout.findUnique.mockResolvedValue({ id: 'w1' });

    await workoutsService.addSets('w1', 'user-1', [
      { reps: 6, weightKg: 80 },
      { reps: '4' as any, weightKg: '85' as any },
    ]);

    expect(workoutSet.createMany).toHaveBeenCalledWith({
      data: [
        { setNumber: 4, reps: 6, weightKg: 80, workoutId: 'w1' },
        { setNumber: 5, reps: 4, weightKg: 85, workoutId: 'w1' },
      ],
    });
  });
});

describe('WorkoutsService.deleteSet', () => {
  it('reports WORKOUT_NOT_FOUND when the workout belongs to someone else', async () => {
    workout.findFirst.mockResolvedValue(null);

    expect(await workoutsService.deleteSet('w1', 's1', 'user-1')).toEqual({ status: 'WORKOUT_NOT_FOUND' });
    expect(workoutSet.deleteMany).not.toHaveBeenCalled();
  });

  it('scopes the delete to the workout and reports SET_NOT_FOUND when nothing matched', async () => {
    workout.findFirst.mockResolvedValue({ id: 'w1' });
    workoutSet.deleteMany.mockResolvedValue({ count: 0 });

    const result = await workoutsService.deleteSet('w1', 's1', 'user-1');

    expect(workoutSet.deleteMany).toHaveBeenCalledWith({ where: { id: 's1', workoutId: 'w1' } });
    expect(result).toEqual({ status: 'SET_NOT_FOUND' });
  });

  it('returns the refreshed workout on success', async () => {
    workout.findFirst.mockResolvedValue({ id: 'w1' });
    workoutSet.deleteMany.mockResolvedValue({ count: 1 });
    workout.findUnique.mockResolvedValue({ id: 'w1', sets: [] });

    expect(await workoutsService.deleteSet('w1', 's1', 'user-1')).toEqual({
      status: 'SUCCESS',
      data: { id: 'w1', sets: [] },
    });
  });
});

describe('WorkoutsService.deleteWorkout', () => {
  it('deletes only when both the id and the owner match', async () => {
    workout.deleteMany.mockResolvedValue({ count: 1 });

    expect(await workoutsService.deleteWorkout('w1', 'user-1')).toBe(true);
    expect(workout.deleteMany).toHaveBeenCalledWith({ where: { id: 'w1', userId: 'user-1' } });
  });

  it('returns false when nothing was deleted', async () => {
    workout.deleteMany.mockResolvedValue({ count: 0 });

    expect(await workoutsService.deleteWorkout('w1', 'user-2')).toBe(false);
  });
});

describe('WorkoutsService read helpers used by the chat assistant', () => {
  it('listWorkoutsSince filters by user and a lower date bound, newest first', async () => {
    workout.findMany.mockResolvedValue([]);

    await workoutsService.listWorkoutsSince('user-1', '2026-11-01');

    expect(workout.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 'user-1', date: { gte: '2026-11-01' } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('listLoggedExerciseNames returns just the names', async () => {
    workout.groupBy.mockResolvedValue([{ exercise: 'Squat' }, { exercise: 'Bench Press' }]);

    expect(await workoutsService.listLoggedExerciseNames('user-1')).toEqual(['Squat', 'Bench Press']);
    expect(workout.groupBy.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
  });

  it('getPersonalBest looks for the heaviest set, case-insensitively, for this user only', async () => {
    workoutSet.findFirst.mockResolvedValue({ weightKg: 140 });

    await workoutsService.getPersonalBest('user-1', 'deadlift');

    const args = workoutSet.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ workout: { userId: 'user-1', exercise: { equals: 'deadlift', mode: 'insensitive' } } });
    expect(args.orderBy).toEqual([{ weightKg: 'desc' }, { reps: 'desc' }]);
  });

  it('getLastWorkout filters by exercise or by muscle group', async () => {
    workout.findFirst.mockResolvedValue(null);

    await workoutsService.getLastWorkout('user-1', { exercise: 'Squat' });
    await workoutsService.getLastWorkout('user-1', { muscleGroup: 'Legs' });

    expect(workout.findFirst.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      exercise: { equals: 'Squat', mode: 'insensitive' },
    });
    expect(workout.findFirst.mock.calls[1][0].where).toEqual({
      userId: 'user-1',
      muscleGroup: { equals: 'Legs', mode: 'insensitive' },
    });
  });
});

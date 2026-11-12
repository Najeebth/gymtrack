jest.mock('../db/prisma.js', () => ({
  prisma: {
    exercise: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));
jest.mock('../lib/redis.js', () => ({
  cacheAside: jest.fn((_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidateCachePattern: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../db/prisma.js';
import { cacheAside, invalidateCachePattern } from '../lib/redis.js';
import { exercisesService } from './exercises.service.js';

const exercise = prisma.exercise as unknown as Record<string, jest.Mock>;
const cache = cacheAside as unknown as jest.Mock;
const invalidate = invalidateCachePattern as unknown as jest.Mock;

beforeEach(() => {
  Object.values(exercise).forEach((fn) => fn.mockReset());
  exercise.count.mockResolvedValue(0);
  exercise.findMany.mockResolvedValue([]);
  invalidate.mockClear();
  cache.mockClear();
});

/** The `where` passed to findMany by listExercises. */
const listedWhere = () => exercise.findMany.mock.calls[0][0].where;

describe('ExercisesService.listExercises', () => {
  it("shows the public library plus the signed-in user's custom exercises", async () => {
    await exercisesService.listExercises({ userId: 'user-1' });

    expect(listedWhere().AND[0]).toEqual({ OR: [{ isCustom: false }, { userId: 'user-1' }] });
  });

  it('shows only the public library when there is no user', async () => {
    await exercisesService.listExercises({});

    expect(listedWhere().AND[0]).toEqual({ OR: [{ isCustom: false }] });
  });

  it('adds trimmed, case-insensitive search, muscle group and equipment filters', async () => {
    await exercisesService.listExercises({ search: '  press ', muscleGroup: ' Chest ', equipment: 'Barbell' });

    expect(listedWhere().AND.slice(1)).toEqual([
      { name: { contains: 'press', mode: 'insensitive' } },
      { muscleGroup: { equals: 'Chest', mode: 'insensitive' } },
      { equipment: { equals: 'Barbell', mode: 'insensitive' } },
    ]);
  });

  it("treats 'All' as no filter", async () => {
    await exercisesService.listExercises({ muscleGroup: 'All', equipment: 'All' });

    expect(listedWhere().AND).toHaveLength(1);
  });

  it('computes skip/take from the page and caps the page size at 50', async () => {
    await exercisesService.listExercises({ page: 3, limit: 500 });

    expect(exercise.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 50 });
  });

  it('clamps a negative page to 1 and a negative limit to 1', async () => {
    await exercisesService.listExercises({ page: -4, limit: -1 });

    expect(exercise.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 1 });
  });

  it('defaults to page 1 with 12 per page when none are given', async () => {
    await exercisesService.listExercises({});

    expect(exercise.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 12 });
  });

  it('lists custom exercises first, then alphabetically', async () => {
    await exercisesService.listExercises({});

    expect(exercise.findMany.mock.calls[0][0].orderBy).toEqual([{ isCustom: 'desc' }, { name: 'asc' }]);
  });

  it('returns pagination totals', async () => {
    exercise.count.mockResolvedValue(25);
    exercise.findMany.mockResolvedValue([{ id: 'e1' }]);

    const result = await exercisesService.listExercises({ page: 2, limit: 10 });

    expect(result).toEqual({ data: [{ id: 'e1' }], pagination: { total: 25, page: 2, limit: 10, totalPages: 3 } });
  });

  it('reports one page, not zero, when there are no results', async () => {
    const result = await exercisesService.listExercises({});

    expect(result.pagination.totalPages).toBe(1);
  });

  it('caches per user and per filter combination for 30 minutes', async () => {
    await exercisesService.listExercises({ userId: 'user-1', muscleGroup: 'Chest', page: 2, limit: 10 });
    await exercisesService.listExercises({});

    expect(cache.mock.calls[0][0]).toBe('exercises:user-1:Chest:all:none:p2:l10');
    expect(cache.mock.calls[0][1]).toBe(1800);
    expect(cache.mock.calls[1][0]).toBe('exercises:public:all:all:none:p1:l12');
  });
});

describe('ExercisesService.createCustomExercise', () => {
  const input = { name: '  Cable Fly ', muscleGroup: ' Chest ', equipment: ' Cable ', notes: ' slow tempo ' };

  it("checks for a duplicate among public exercises and the user's own, case-insensitively", async () => {
    exercise.findFirst.mockResolvedValue(null);
    exercise.create.mockResolvedValue({ id: 'e1' });

    await exercisesService.createCustomExercise('user-1', input);

    expect(exercise.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Cable Fly', mode: 'insensitive' }, OR: [{ isCustom: false }, { userId: 'user-1' }] },
    });
  });

  it('returns DUPLICATE and creates nothing when the name is taken', async () => {
    exercise.findFirst.mockResolvedValue({ id: 'existing' });

    const result = await exercisesService.createCustomExercise('user-1', input);

    expect(result).toEqual({ status: 'DUPLICATE' });
    expect(exercise.create).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('trims the values and marks the exercise as custom and owned by the user', async () => {
    exercise.findFirst.mockResolvedValue(null);
    exercise.create.mockResolvedValue({ id: 'e1' });

    const result = await exercisesService.createCustomExercise('user-1', input);

    expect(exercise.create).toHaveBeenCalledWith({
      data: {
        name: 'Cable Fly',
        muscleGroup: 'Chest',
        equipment: 'Cable',
        notes: 'slow tempo',
        isCustom: true,
        userId: 'user-1',
      },
    });
    expect(result).toEqual({ status: 'SUCCESS', data: { id: 'e1' } });
  });

  it("defaults blank equipment to 'Other' and blank notes to null", async () => {
    exercise.findFirst.mockResolvedValue(null);
    exercise.create.mockResolvedValue({ id: 'e1' });

    await exercisesService.createCustomExercise('user-1', {
      name: 'Fly',
      muscleGroup: 'Chest',
      equipment: '  ',
      notes: '  ',
    });

    expect(exercise.create.mock.calls[0][0].data).toMatchObject({ equipment: 'Other', notes: null });
  });

  it("clears the user's cached lists and the public ones", async () => {
    exercise.findFirst.mockResolvedValue(null);
    exercise.create.mockResolvedValue({ id: 'e1' });

    await exercisesService.createCustomExercise('user-1', input);

    expect(invalidate).toHaveBeenCalledWith('exercises:user-1:*');
    expect(invalidate).toHaveBeenCalledWith('exercises:public:*');
  });
});

describe('ExercisesService.deleteCustomExercise', () => {
  it('returns NOT_FOUND for an unknown id', async () => {
    exercise.findUnique.mockResolvedValue(null);

    expect(await exercisesService.deleteCustomExercise('e1', 'user-1')).toEqual({ status: 'NOT_FOUND' });
    expect(exercise.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete an exercise from the public library', async () => {
    exercise.findUnique.mockResolvedValue({ id: 'e1', isCustom: false, userId: null });

    expect(await exercisesService.deleteCustomExercise('e1', 'user-1')).toEqual({ status: 'FORBIDDEN' });
    expect(exercise.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete another user's custom exercise", async () => {
    exercise.findUnique.mockResolvedValue({ id: 'e1', isCustom: true, userId: 'user-2' });

    expect(await exercisesService.deleteCustomExercise('e1', 'user-1')).toEqual({ status: 'FORBIDDEN' });
    expect(exercise.delete).not.toHaveBeenCalled();
  });

  it("deletes the owner's custom exercise and clears the caches", async () => {
    exercise.findUnique.mockResolvedValue({ id: 'e1', isCustom: true, userId: 'user-1' });
    exercise.delete.mockResolvedValue({});

    expect(await exercisesService.deleteCustomExercise('e1', 'user-1')).toEqual({ status: 'SUCCESS' });
    expect(exercise.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    expect(invalidate).toHaveBeenCalledWith('exercises:user-1:*');
    expect(invalidate).toHaveBeenCalledWith('exercises:public:*');
  });
});

describe('ExercisesService.listExerciseIndex', () => {
  it("selects just name and muscle group for the user's visible exercises, cached under their key", async () => {
    exercise.findMany.mockResolvedValue([{ name: 'Squat', muscleGroup: 'Legs' }]);

    const result = await exercisesService.listExerciseIndex('user-1');

    expect(result).toEqual([{ name: 'Squat', muscleGroup: 'Legs' }]);
    expect(cache.mock.calls[0][0]).toBe('exercises:user-1:index');
    expect(exercise.findMany.mock.calls[0][0]).toMatchObject({
      where: { OR: [{ isCustom: false }, { userId: 'user-1' }] },
      select: { name: true, muscleGroup: true },
    });
  });
});

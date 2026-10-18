import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';
import type { NormalizedSet, SetInput } from '../types/index.js';

/**
 * Normalizes raw set payloads into sequential 1-based setNumbers.
 */
export function normalizeSets(rawSets: SetInput[]): NormalizedSet[] {
  if (!Array.isArray(rawSets) || rawSets.length === 0) return [];
  return rawSets.map((s, idx) => ({
    setNumber: idx + 1,
    reps: Number(s.reps),
    weightKg: Number(s.weightKg),
  }));
}

/**
 * Confirms workout ownership to prevent horizontal privilege escalation.
 */
export async function findOwnedWorkout(id: string, userId: string) {
  return prisma.workout.findFirst({ where: { id, userId } });
}

export interface CreateWorkoutInput {
  date?: string;
  muscleGroup?: string;
  exercise: string;
  notes?: string;
  sets: SetInput[];
}

export interface UpdateWorkoutInput {
  date?: string;
  muscleGroup?: string;
  exercise?: string;
  notes?: string;
}

export class WorkoutsService {
  /**
   * Retrieves all workouts for a user, optionally filtered by date.
   */
  async listWorkouts(userId: string, date?: string) {
    return dbTrace(
      date ? `findMany Workout (date:${date})` : 'findMany Workout (ordered by createdAt desc)',
      () =>
        prisma.workout.findMany({
          where: { userId, ...(date ? { date: String(date) } : {}) },
          orderBy: { createdAt: 'desc' },
          include: { sets: { orderBy: { setNumber: 'asc' } } },
        })
    );
  }

  /**
   * Creates a new workout with nested sequential sets.
   */
  async createWorkout(userId: string, input: CreateWorkoutInput) {
    const normalizedSets = normalizeSets(input.sets);

    return dbTrace('create Workout (with sets)', () =>
      prisma.workout.create({
        data: {
          date: input.date || new Date().toISOString().split('T')[0],
          muscleGroup: input.muscleGroup || 'General',
          exercise: input.exercise.trim(),
          notes: input.notes || '',
          userId,
          sets: { create: normalizedSets },
        },
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );
  }

  /**
   * Updates an owned workout's metadata. Returns null if not found/unauthorized.
   */
  async updateWorkout(id: string, userId: string, input: UpdateWorkoutInput) {
    const owned = await findOwnedWorkout(id, userId);
    if (!owned) return null;

    const data: Record<string, unknown> = {};
    if (input.date !== undefined) data.date = input.date;
    if (input.muscleGroup !== undefined) data.muscleGroup = input.muscleGroup;
    if (input.exercise !== undefined) data.exercise = input.exercise.trim();
    if (input.notes !== undefined) data.notes = input.notes;

    return dbTrace(`update Workout id:${id}`, () =>
      prisma.workout.update({
        where: { id },
        data,
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );
  }

  /**
   * Updates an individual set within an owned workout.
   */
  async updateSet(workoutId: string, setId: string, userId: string, reps: number, weightKg: number) {
    const owned = await findOwnedWorkout(workoutId, userId);
    if (!owned) return { status: 'WORKOUT_NOT_FOUND' as const };

    const result = await dbTrace(`update WorkoutSet id:${setId}`, () =>
      prisma.workoutSet.updateMany({
        where: { id: setId, workoutId },
        data: { reps, weightKg },
      })
    );

    if (result.count === 0) {
      return { status: 'SET_NOT_FOUND' as const };
    }

    const updated = await dbTrace(`findUnique Workout id:${workoutId} (after set update)`, () =>
      prisma.workout.findUnique({
        where: { id: workoutId },
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );

    return { status: 'SUCCESS' as const, data: updated };
  }

  /**
   * Appends sets to an existing workout, calculating next setNumbers.
   */
  async addSets(workoutId: string, userId: string, newSets: SetInput[]) {
    const workout = await dbTrace(`findUnique Workout id:${workoutId} (for set append)`, () =>
      prisma.workout.findFirst({ where: { id: workoutId, userId }, include: { sets: true } })
    );

    if (!workout) return null;

    const startingSetNumber = workout.sets.length;
    const setsToCreate = newSets.map((s, idx) => ({
      setNumber: startingSetNumber + idx + 1,
      reps: Number(s.reps),
      weightKg: Number(s.weightKg),
      workoutId,
    }));

    await dbTrace('createMany WorkoutSet', () =>
      prisma.workoutSet.createMany({ data: setsToCreate })
    );

    return dbTrace(`findUnique Workout id:${workoutId} (after set append)`, () =>
      prisma.workout.findUnique({
        where: { id: workoutId },
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );
  }

  /**
   * Deletes a single set from a workout.
   */
  async deleteSet(workoutId: string, setId: string, userId: string) {
    const owned = await findOwnedWorkout(workoutId, userId);
    if (!owned) return { status: 'WORKOUT_NOT_FOUND' as const };

    const result = await dbTrace(`delete WorkoutSet id:${setId}`, () =>
      prisma.workoutSet.deleteMany({ where: { id: setId, workoutId } })
    );

    if (result.count === 0) {
      return { status: 'SET_NOT_FOUND' as const };
    }

    const updated = await dbTrace(`findUnique Workout id:${workoutId} (after set delete)`, () =>
      prisma.workout.findUnique({
        where: { id: workoutId },
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );

    return { status: 'SUCCESS' as const, data: updated };
  }

  /**
   * Deletes an entire workout and cascades to its sets.
   */
  async deleteWorkout(id: string, userId: string) {
    const result = await dbTrace(`delete Workout id:${id}`, () =>
      prisma.workout.deleteMany({ where: { id, userId } })
    );

    return result.count > 0;
  }
}

export const workoutsService = new WorkoutsService();

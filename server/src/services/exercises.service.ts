import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';
import { cacheAside, invalidateCachePattern } from '../lib/redis.js';
import type { Prisma } from '@prisma/client';

export interface ListExercisesParams {
  userId?: string;
  page?: number;
  limit?: number;
  search?: string;
  muscleGroup?: string;
  equipment?: string;
}

export interface CreateExerciseInput {
  name: string;
  muscleGroup: string;
  equipment?: string;
  notes?: string | null;
}

export class ExercisesService {
  /**
   * Retrieves paginated exercise library with Redis caching and graceful DB fallback.
   */
  async listExercises(params: ListExercisesParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 12));
    const skip = (page - 1) * limit;

    const search = params.search ? params.search.trim() : '';
    const muscleGroup = params.muscleGroup ? params.muscleGroup.trim() : '';
    const equipment = params.equipment ? params.equipment.trim() : '';
    const userId = params.userId;

    const cacheKey = `exercises:${userId || 'public'}:${muscleGroup || 'all'}:${equipment || 'all'}:${search || 'none'}:p${page}:l${limit}`;

    return cacheAside(cacheKey, 1800, async () => {
      const whereConditions: Prisma.ExerciseWhereInput[] = [
        {
          OR: [
            { isCustom: false },
            ...(userId ? [{ userId }] : []),
          ],
        },
      ];

      if (search) {
        whereConditions.push({
          name: { contains: search, mode: 'insensitive' },
        });
      }

      if (muscleGroup && muscleGroup !== 'All') {
        whereConditions.push({
          muscleGroup: { equals: muscleGroup, mode: 'insensitive' },
        });
      }

      if (equipment && equipment !== 'All') {
        whereConditions.push({
          equipment: { equals: equipment, mode: 'insensitive' },
        });
      }

      const where: Prisma.ExerciseWhereInput = {
        AND: whereConditions,
      };

      const [total, exercises] = await dbTrace('listExercises (paginated with filters)', () =>
        prisma.$transaction([
          prisma.exercise.count({ where }),
          prisma.exercise.findMany({
            where,
            skip,
            take: limit,
            orderBy: [
              { isCustom: 'desc' },
              { name: 'asc' },
            ],
          }),
        ])
      );

      return {
        data: exercises,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    });
  }

  /**
   * Name + muscle group of every exercise visible to the user (public library
   * + their custom ones). The key sits under exercises:{userId}:* so
   * creating/deleting a custom exercise already invalidates it.
   */
  async listExerciseIndex(userId: string): Promise<{ name: string; muscleGroup: string }[]> {
    return cacheAside(`exercises:${userId}:index`, 1800, () =>
      dbTrace('findMany Exercise (name index)', () =>
        prisma.exercise.findMany({
          where: { OR: [{ isCustom: false }, { userId }] },
          select: { name: true, muscleGroup: true },
          orderBy: { name: 'asc' },
        })
      )
    );
  }

  /**
   * Creates a user-custom exercise, checking for duplicates and invalidating Redis caches.
   */
  async createCustomExercise(userId: string, input: CreateExerciseInput) {
    const trimmedName = input.name.trim();
    const trimmedMuscle = input.muscleGroup.trim();
    const trimmedEquipment = input.equipment && input.equipment.trim() ? input.equipment.trim() : 'Other';
    const trimmedNotes = input.notes && input.notes.trim() ? input.notes.trim() : null;

    // Check for duplicate exercise for this user or public library
    const existing = await dbTrace('check existing custom exercise', () =>
      prisma.exercise.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          OR: [
            { isCustom: false },
            { userId },
          ],
        },
      })
    );

    if (existing) {
      return { status: 'DUPLICATE' as const };
    }

    const exercise = await dbTrace('create custom exercise', () =>
      prisma.exercise.create({
        data: {
          name: trimmedName,
          muscleGroup: trimmedMuscle,
          equipment: trimmedEquipment,
          notes: trimmedNotes,
          isCustom: true,
          userId,
        },
      })
    );

    // Invalidate cached exercise lists
    await invalidateCachePattern(`exercises:${userId}:*`);
    await invalidateCachePattern('exercises:public:*');

    return { status: 'SUCCESS' as const, data: exercise };
  }

  /**
   * Deletes a custom exercise owned by the user, invalidating Redis caches.
   */
  async deleteCustomExercise(id: string, userId: string) {
    const exercise = await dbTrace('find exercise for delete', () =>
      prisma.exercise.findUnique({ where: { id } })
    );

    if (!exercise) {
      return { status: 'NOT_FOUND' as const };
    }

    if (!exercise.isCustom || exercise.userId !== userId) {
      return { status: 'FORBIDDEN' as const };
    }

    await dbTrace('delete custom exercise', () =>
      prisma.exercise.delete({ where: { id } })
    );

    await invalidateCachePattern(`exercises:${userId}:*`);
    await invalidateCachePattern('exercises:public:*');

    return { status: 'SUCCESS' as const };
  }
}

export const exercisesService = new ExercisesService();


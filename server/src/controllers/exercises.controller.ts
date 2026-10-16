import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';
import { cacheAside, invalidateCachePattern } from '../lib/redis.js';
import type { Prisma } from '@prisma/client';

export async function listExercises(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12));
  const skip = (page - 1) * limit;

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const muscleGroup = typeof req.query.muscleGroup === 'string' ? req.query.muscleGroup.trim() : '';
  const equipment = typeof req.query.equipment === 'string' ? req.query.equipment.trim() : '';

  // Unique cache key per user and filter combination
  const cacheKey = `exercises:${userId || 'public'}:${muscleGroup || 'all'}:${equipment || 'all'}:${search || 'none'}:p${page}:l${limit}`;

  const result = await cacheAside(cacheKey, 1800, async () => {
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

  res.json(result);
}

export async function createExercise(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, muscleGroup, equipment, notes } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Exercise name must be at least 2 characters long' });
    return;
  }

  if (!muscleGroup || typeof muscleGroup !== 'string') {
    res.status(400).json({ error: 'Muscle group is required' });
    return;
  }

  const trimmedName = name.trim();
  const trimmedMuscle = muscleGroup.trim();
  const trimmedEquipment = typeof equipment === 'string' && equipment.trim() ? equipment.trim() : 'Other';
  const trimmedNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null;

  // Check for duplicate custom exercise for this user
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
    res.status(409).json({ error: 'An exercise with this name already exists' });
    return;
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

  // Invalidate any cached exercise lists for this user & public lists
  await invalidateCachePattern(`exercises:${userId}:*`);
  await invalidateCachePattern('exercises:public:*');

  res.status(201).json(exercise);
}

export async function deleteExercise(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const exercise = await dbTrace('find exercise for delete', () =>
    prisma.exercise.findUnique({ where: { id } })
  );

  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  if (!exercise.isCustom || exercise.userId !== userId) {
    res.status(403).json({ error: 'Forbidden: You can only delete your own custom exercises' });
    return;
  }

  await dbTrace('delete custom exercise', () =>
    prisma.exercise.delete({ where: { id } })
  );

  // Invalidate any cached exercise lists for this user & public lists
  await invalidateCachePattern(`exercises:${userId}:*`);
  await invalidateCachePattern('exercises:public:*');

  res.json({ message: 'Exercise deleted successfully' });
}


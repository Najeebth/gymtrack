import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';
import type { NormalizedSet, SetInput } from '../types/index.js';

// Normalizes a raw sets payload (array of {reps, weightKg}) into
// Prisma nested-create rows with sequential setNumbers.
function normalizeSets(rawSets: SetInput[]): NormalizedSet[] {
  if (!Array.isArray(rawSets) || rawSets.length === 0) return [];
  return rawSets.map((s, idx) => ({
    setNumber: idx + 1,
    reps: Number(s.reps),
    weightKg: Number(s.weightKg),
  }));
}

// Every mutation below confirms the workout belongs to the authenticated
// user before touching it (or its nested sets), so one member can never
// read or modify another member's data even by guessing a workout/set id.
async function findOwnedWorkout(id: string, userId: string) {
  return prisma.workout.findFirst({ where: { id, userId } });
}

// GET all workouts belonging to the authenticated user (each with its
// nested sets). Optional ?date=YYYY-MM-DD query param filters to workouts
// logged on that date.
export async function listWorkouts(req: Request, res: Response): Promise<void> {
  const { date } = req.query;
  const userId = req.user!.id;

  try {
    const workouts = await dbTrace(
      date ? `findMany Workout (date:${date})` : 'findMany Workout (ordered by createdAt desc)',
      () =>
        prisma.workout.findMany({
          where: { userId, ...(date ? { date: String(date) } : {}) },
          orderBy: { createdAt: 'desc' },
          include: { sets: { orderBy: { setNumber: 'asc' } } },
        })
    );
    res.json(workouts);
  } catch (err) {
    console.error('Error fetching workouts from Postgres:', err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
}

// POST a new workout entry (with one or more sets), owned by the
// authenticated user.
export async function createWorkout(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { date, muscleGroup, exercise, notes, sets } = req.body;
  const normalizedSets = normalizeSets(sets);

  if (!exercise || normalizedSets.length === 0) {
    res.status(400).json({ error: 'Exercise and at least one set (reps, weightKg) are required.' });
    return;
  }
  if (normalizedSets.some((s) => Number.isNaN(s.reps) || Number.isNaN(s.weightKg))) {
    res.status(400).json({ error: 'Each set requires valid numeric reps and weightKg.' });
    return;
  }

  try {
    const workout = await dbTrace('create Workout (with sets)', () =>
      prisma.workout.create({
        data: {
          date: date || new Date().toISOString().split('T')[0],
          muscleGroup: muscleGroup || 'General',
          exercise: exercise.trim(),
          notes: notes || '',
          userId,
          sets: { create: normalizedSets },
        },
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );
    res.status(201).json(workout);
  } catch (err) {
    console.error('Error creating workout in Postgres:', err);
    res.status(500).json({ error: 'Failed to create workout' });
  }
}

// PUT update a workout's own fields (date, muscleGroup, exercise, notes)
export async function updateWorkout(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user!.id;
  const { date, muscleGroup, exercise, notes } = req.body;

  if (exercise !== undefined && !String(exercise).trim()) {
    res.status(400).json({ error: 'Exercise name cannot be empty.' });
    return;
  }

  try {
    const owned = await findOwnedWorkout(id, userId);
    if (!owned) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (date !== undefined) data.date = date;
    if (muscleGroup !== undefined) data.muscleGroup = muscleGroup;
    if (exercise !== undefined) data.exercise = exercise.trim();
    if (notes !== undefined) data.notes = notes;

    const updated = await dbTrace(`update Workout id:${id}`, () =>
      prisma.workout.update({
        where: { id },
        data,
        include: { sets: { orderBy: { setNumber: 'asc' } } },
      })
    );
    res.json(updated);
  } catch (err) {
    console.error('Error updating workout in Postgres:', err);
    res.status(404).json({ error: 'Workout not found' });
  }
}

// PUT update a single set's reps/weightKg
export async function updateSet(req: Request, res: Response): Promise<void> {
  const { id, setId } = req.params;
  const userId = req.user!.id;
  const { reps, weightKg } = req.body;

  const numReps = Number(reps);
  const numWeight = Number(weightKg);
  if (Number.isNaN(numReps) || Number.isNaN(numWeight)) {
    res.status(400).json({ error: 'Valid numeric reps and weightKg are required.' });
    return;
  }

  try {
    const owned = await findOwnedWorkout(id, userId);
    if (!owned) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    // Matched on workoutId too: owning the workout in the URL must not let a
    // caller reach a set that belongs to someone else's workout.
    const result = await dbTrace(`update WorkoutSet id:${setId}`, () =>
      prisma.workoutSet.updateMany({
        where: { id: setId, workoutId: id },
        data: { reps: numReps, weightKg: numWeight },
      })
    );
    if (result.count === 0) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }
    const updated = await dbTrace(`findUnique Workout id:${id} (after set update)`, () =>
      prisma.workout.findUnique({ where: { id }, include: { sets: { orderBy: { setNumber: 'asc' } } } })
    );
    res.json(updated);
  } catch (err) {
    console.error('Error updating set in Postgres:', err);
    res.status(404).json({ error: 'Set not found' });
  }
}

// POST additional set(s) onto an existing workout
export async function addSets(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user!.id;
  const newSets: SetInput[] = Array.isArray(req.body.sets) ? req.body.sets : [req.body];

  try {
    const workout = await dbTrace(`findUnique Workout id:${id} (for set append)`, () =>
      prisma.workout.findFirst({ where: { id, userId }, include: { sets: true } })
    );
    if (!workout) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    const startingSetNumber = workout.sets.length;
    const setsToCreate = newSets.map((s, idx) => ({
      setNumber: startingSetNumber + idx + 1,
      reps: Number(s.reps),
      weightKg: Number(s.weightKg),
      workoutId: id,
    }));

    if (setsToCreate.some((s) => Number.isNaN(s.reps) || Number.isNaN(s.weightKg))) {
      res.status(400).json({ error: 'Each set requires valid numeric reps and weightKg.' });
      return;
    }

    await dbTrace('createMany WorkoutSet', () => prisma.workoutSet.createMany({ data: setsToCreate }));

    const updated = await dbTrace(`findUnique Workout id:${id} (after set append)`, () =>
      prisma.workout.findUnique({ where: { id }, include: { sets: { orderBy: { setNumber: 'asc' } } } })
    );

    res.status(201).json(updated);
  } catch (err) {
    console.error('Error adding set(s) to workout in Postgres:', err);
    res.status(500).json({ error: 'Failed to add set(s) to workout' });
  }
}

// DELETE a single set from a workout
export async function deleteSet(req: Request, res: Response): Promise<void> {
  const { id, setId } = req.params;
  const userId = req.user!.id;

  try {
    const owned = await findOwnedWorkout(id, userId);
    if (!owned) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    const result = await dbTrace(`delete WorkoutSet id:${setId}`, () =>
      prisma.workoutSet.deleteMany({ where: { id: setId, workoutId: id } })
    );
    if (result.count === 0) {
      res.status(404).json({ error: 'Set not found or already deleted' });
      return;
    }
    const updated = await dbTrace(`findUnique Workout id:${id} (after set delete)`, () =>
      prisma.workout.findUnique({ where: { id }, include: { sets: { orderBy: { setNumber: 'asc' } } } })
    );
    res.json(updated || { success: true });
  } catch (err) {
    console.error('Error deleting set in Postgres:', err);
    res.status(404).json({ error: 'Set not found or already deleted' });
  }
}

// DELETE a workout entry (and its sets, via cascade)
export async function deleteWorkout(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const result = await dbTrace(`delete Workout id:${id}`, () =>
      prisma.workout.deleteMany({ where: { id, userId } })
    );
    if (result.count === 0) {
      res.status(404).json({ error: 'Workout not found or already deleted' });
      return;
    }
    res.json({ success: true, message: `Workout ${id} deleted` });
  } catch (err) {
    console.error('Error deleting workout in Postgres:', err);
    res.status(404).json({ error: 'Workout not found or already deleted' });
  }
}

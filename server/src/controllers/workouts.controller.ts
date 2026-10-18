import type { Request, Response } from 'express';
import { workoutsService, normalizeSets } from '../services/workouts.service.js';

// Re-export for backward compatibility with existing tests
export { normalizeSets };

// GET all workouts belonging to the authenticated user
export async function listWorkouts(req: Request, res: Response): Promise<void> {
  const { date } = req.query;
  const userId = req.user!.id;

  try {
    const workouts = await workoutsService.listWorkouts(userId, date ? String(date) : undefined);
    res.json(workouts);
  } catch (err) {
    console.error('Error fetching workouts from Postgres:', err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
}

// POST a new workout entry with sets
export async function createWorkout(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { date, muscleGroup, exercise, notes, sets } = req.body;

  if (!exercise || !Array.isArray(sets) || sets.length === 0) {
    res.status(400).json({ error: 'Exercise and at least one set (reps, weightKg) are required.' });
    return;
  }

  const normalized = normalizeSets(sets);
  if (normalized.some((s) => Number.isNaN(s.reps) || Number.isNaN(s.weightKg))) {
    res.status(400).json({ error: 'Each set requires valid numeric reps and weightKg.' });
    return;
  }

  try {
    const workout = await workoutsService.createWorkout(userId, {
      date,
      muscleGroup,
      exercise,
      notes,
      sets,
    });
    res.status(201).json(workout);
  } catch (err) {
    console.error('Error creating workout in Postgres:', err);
    res.status(500).json({ error: 'Failed to create workout' });
  }
}

// PUT update a workout's top-level fields
export async function updateWorkout(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user!.id;
  const { date, muscleGroup, exercise, notes } = req.body;

  if (exercise !== undefined && !String(exercise).trim()) {
    res.status(400).json({ error: 'Exercise name cannot be empty.' });
    return;
  }

  try {
    const updated = await workoutsService.updateWorkout(id, userId, {
      date,
      muscleGroup,
      exercise,
      notes,
    });

    if (!updated) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

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
    const result = await workoutsService.updateSet(id, setId, userId, numReps, numWeight);

    if (result.status === 'WORKOUT_NOT_FOUND' || result.status === 'SET_NOT_FOUND') {
      res.status(404).json({ error: result.status === 'SET_NOT_FOUND' ? 'Set not found' : 'Workout not found' });
      return;
    }

    res.json(result.data);
  } catch (err) {
    console.error('Error updating set in Postgres:', err);
    res.status(404).json({ error: 'Set not found' });
  }
}

// POST additional set(s) onto an existing workout
export async function addSets(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user!.id;
  const newSets = Array.isArray(req.body.sets) ? req.body.sets : [req.body];

  if (newSets.some((s: any) => Number.isNaN(Number(s.reps)) || Number.isNaN(Number(s.weightKg)))) {
    res.status(400).json({ error: 'Each set requires valid numeric reps and weightKg.' });
    return;
  }

  try {
    const updated = await workoutsService.addSets(id, userId, newSets);
    if (!updated) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
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
    const result = await workoutsService.deleteSet(id, setId, userId);

    if (result.status === 'WORKOUT_NOT_FOUND' || result.status === 'SET_NOT_FOUND') {
      res.status(404).json({ error: result.status === 'SET_NOT_FOUND' ? 'Set not found or already deleted' : 'Workout not found' });
      return;
    }

    res.json(result.data || { success: true });
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
    const deleted = await workoutsService.deleteWorkout(id, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Workout not found or already deleted' });
      return;
    }
    res.json({ success: true, message: `Workout ${id} deleted` });
  } catch (err) {
    console.error('Error deleting workout in Postgres:', err);
    res.status(404).json({ error: 'Workout not found or already deleted' });
  }
}

import type { Request, Response } from 'express';
import { exercisesService } from '../services/exercises.service.js';

export async function listExercises(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const page = parseInt(String(req.query.page || '1'), 10) || 1;
  const limit = parseInt(String(req.query.limit || '12'), 10) || 12;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const muscleGroup = typeof req.query.muscleGroup === 'string' ? req.query.muscleGroup : undefined;
  const equipment = typeof req.query.equipment === 'string' ? req.query.equipment : undefined;

  try {
    const result = await exercisesService.listExercises({
      userId,
      page,
      limit,
      search,
      muscleGroup,
      equipment,
    });
    res.json(result);
  } catch (err) {
    console.error('Error in listExercises:', err);
    res.status(500).json({ error: 'Failed to retrieve exercises' });
  }
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

  try {
    const result = await exercisesService.createCustomExercise(userId, {
      name,
      muscleGroup,
      equipment,
      notes,
    });

    if (result.status === 'DUPLICATE') {
      res.status(409).json({ error: 'An exercise with this name already exists' });
      return;
    }

    res.status(201).json(result.data);
  } catch (err) {
    console.error('Error creating custom exercise:', err);
    res.status(500).json({ error: 'Failed to create exercise' });
  }
}

export async function deleteExercise(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await exercisesService.deleteCustomExercise(id, userId);

    if (result.status === 'NOT_FOUND') {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    if (result.status === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden: You can only delete your own custom exercises' });
      return;
    }

    res.json({ message: 'Exercise deleted successfully' });
  } catch (err) {
    console.error('Error deleting exercise:', err);
    res.status(500).json({ error: 'Failed to delete exercise' });
  }
}

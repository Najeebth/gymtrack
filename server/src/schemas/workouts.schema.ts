import { z } from 'zod';

export const setInputSchema = z.object({
  reps: z.coerce.number().int().min(1, 'Reps must be at least 1').max(500, 'Reps cannot exceed 500'),
  weightKg: z.coerce.number().min(0, 'Weight must be non-negative').max(1000, 'Weight cannot exceed 1000kg'),
});

export const createWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  muscleGroup: z.string().min(1, 'Muscle group is required'),
  exercise: z.string().min(2, 'Exercise name must be at least 2 characters').max(100),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').nullable().optional(),
  sets: z.array(setInputSchema).min(1, 'Workout must have at least one set'),
});

export const updateWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
  muscleGroup: z.string().min(1).optional(),
  exercise: z.string().min(2).max(100).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const addSetsSchema = z.object({
  sets: z.array(setInputSchema).min(1, 'Must provide at least one set'),
});

export const updateSetSchema = z.object({
  reps: z.coerce.number().int().min(1).max(500).optional(),
  weightKg: z.coerce.number().min(0).max(1000).optional(),
});


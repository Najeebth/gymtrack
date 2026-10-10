import { z } from 'zod';

export const createExerciseSchema = z.object({
  name: z.string().trim().min(2, 'Exercise name must be at least 2 characters').max(100),
  muscleGroup: z.string().trim().min(1, 'Muscle group is required'),
  equipment: z.string().trim().min(1, 'Equipment is required').default('Other'),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').nullable().optional(),
});


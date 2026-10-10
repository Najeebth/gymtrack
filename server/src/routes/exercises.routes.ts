import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listExercises,
  createExercise,
  deleteExercise,
} from '../controllers/exercises.controller.js';

import { validateBody } from '../middleware/validate.js';
import { createExerciseSchema } from '../schemas/exercises.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/', listExercises);
router.post('/', validateBody(createExerciseSchema), createExercise);
router.delete('/:id', deleteExercise);

export default router;


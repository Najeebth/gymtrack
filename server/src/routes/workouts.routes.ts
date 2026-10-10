import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listWorkouts,
  createWorkout,
  updateWorkout,
  updateSet,
  addSets,
  deleteSet,
  deleteWorkout,
} from '../controllers/workouts.controller.js';

import { validateBody } from '../middleware/validate.js';
import {
  createWorkoutSchema,
  updateWorkoutSchema,
  addSetsSchema,
  updateSetSchema,
} from '../schemas/workouts.schema.js';

const router = Router();

// Every workout lives under a user now, so every route below requires a
// logged-in account and each controller scopes its query to req.user.id.
router.use(requireAuth);

router.get('/', listWorkouts);
router.post('/', validateBody(createWorkoutSchema), createWorkout);
router.put('/:id', validateBody(updateWorkoutSchema), updateWorkout);
router.put('/:id/sets/:setId', validateBody(updateSetSchema), updateSet);
router.post('/:id/sets', validateBody(addSetsSchema), addSets);
router.delete('/:id/sets/:setId', deleteSet);
router.delete('/:id', deleteWorkout);

export default router;

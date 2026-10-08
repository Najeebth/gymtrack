import { Router } from 'express';
import {
  listWorkouts,
  createWorkout,
  updateWorkout,
  updateSet,
  addSets,
  deleteSet,
  deleteWorkout,
} from '../controllers/workouts.controller.js';

const router = Router();

router.get('/', listWorkouts);
router.post('/', createWorkout);
router.put('/:id', updateWorkout);
router.put('/:id/sets/:setId', updateSet);
router.post('/:id/sets', addSets);
router.delete('/:id/sets/:setId', deleteSet);
router.delete('/:id', deleteWorkout);

export default router;

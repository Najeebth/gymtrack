import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/templates.controller.js';

const router = Router();

// Templates are per-user, like workouts.
router.use(requireAuth);

router.get('/', listTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;

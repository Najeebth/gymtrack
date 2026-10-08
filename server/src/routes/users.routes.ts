import { Router } from 'express';
import { listUsers, deleteUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/', listUsers);
router.delete('/:id', deleteUser);

export default router;

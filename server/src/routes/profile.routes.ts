import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import {
  getProfile,
  updateAvatar,
  removeAvatar,
} from '../controllers/profile.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', getProfile);
router.post('/avatar', uploadAvatar.single('avatar'), updateAvatar);
router.delete('/avatar', removeAvatar);

export default router;


import { Router } from 'express';
import { login, signup } from '../controllers/auth.controller.js';
import { loginRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', loginRateLimit, login);
router.post('/signup', loginRateLimit, signup);

export default router;

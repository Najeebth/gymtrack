import { Router } from 'express';
import { login, signup } from '../controllers/auth.controller.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, signupSchema } from '../schemas/auth.schema.js';

const router = Router();

router.post('/login', loginRateLimit, validateBody(loginSchema), login);
router.post('/signup', loginRateLimit, validateBody(signupSchema), signup);

export default router;

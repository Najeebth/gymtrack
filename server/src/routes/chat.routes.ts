import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { chatRateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { chatMessageSchema } from '../schemas/chat.schema.js';
import { sendMessage, getHistory, clearHistory } from '../controllers/chat.controller.js';

const router = Router();

// Chat history is per user, so every route requires a logged-in account and
// the service scopes all reads/writes (and LLM tool calls) to req.user.id.
router.use(requireAuth);

router.post('/', chatRateLimit, validateBody(chatMessageSchema), sendMessage);
router.get('/history', getHistory);
router.delete('/history', clearHistory);

export default router;

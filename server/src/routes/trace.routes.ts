import { Router } from 'express';
import { listTraces, streamTrace } from '../controllers/trace.controller.js';

const router = Router();

// List all active/recent requests
router.get('/list', listTraces);

// Stream details of a single request
router.get('/stream/:id', streamTrace);

export default router;

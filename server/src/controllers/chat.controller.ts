import type { Request, Response } from 'express';
import { chatService } from '../services/chat/chat.service.js';

// POST a chat message; returns the saved user message and the assistant's reply
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { message, today } = req.body;

  try {
    const result = await chatService.send(userId, message, today);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error handling chat message:', err);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
}

// GET the authenticated user's recent chat history, oldest first
export async function getHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const requested = Number(req.query.limit);
  const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 50;

  try {
    const messages = await chatService.listHistory(userId, limit);
    res.json(messages);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
}

// DELETE the authenticated user's entire chat history
export async function clearHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const deleted = await chatService.clearHistory(userId);
    res.json({ success: true, deleted });
  } catch (err) {
    console.error('Error clearing chat history:', err);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
}

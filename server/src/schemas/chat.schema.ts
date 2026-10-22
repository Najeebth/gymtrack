import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(500, 'Message cannot exceed 500 characters'),
  // The client's local date, so "today" matches the user's timezone rather than the server's
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'today must be formatted as YYYY-MM-DD'),
});

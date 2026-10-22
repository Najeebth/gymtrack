import { authFetch, errorMessage } from './http';
import type { ChatMessage } from '../types';

export interface ChatExchange {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export async function sendChatMessageApi(token: string, message: string, today: string): Promise<ChatExchange> {
  const res = await authFetch(token, '/api/chat', { method: 'POST', json: { message, today } });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to send message'));
  return res.json();
}

export async function fetchChatHistoryApi(token: string, limit = 50): Promise<ChatMessage[]> {
  const res = await authFetch(token, `/api/chat/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to load chat history (${res.status})`);
  return res.json();
}

export async function clearChatHistoryApi(token: string): Promise<void> {
  const res = await authFetch(token, '/api/chat/history', { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to clear chat'));
}

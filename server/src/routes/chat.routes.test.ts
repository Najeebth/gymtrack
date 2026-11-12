import request from 'supertest';

jest.mock('../db/prisma.js', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock('../lib/redis.js', () => ({
  redis: null,
  isRedisConnected: () => false,
  cacheAside: (_key: string, _ttl: number, fetcher: () => unknown) => fetcher(),
  invalidateCachePattern: async () => {},
}));
jest.mock('../middleware/rateLimit.js', () => {
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return { loginRateLimit: passThrough, apiRateLimit: passThrough, chatRateLimit: passThrough };
});
jest.mock('../services/chat/chat.service.js', () => ({
  chatService: { send: jest.fn(), listHistory: jest.fn(), clearHistory: jest.fn() },
}));

import { app } from '../app.js';
import { prisma } from '../db/prisma.js';
import { chatService } from '../services/chat/chat.service.js';
import { MEMBER, bearer, silenceConsole, userLookup } from '../test/helpers.js';

const findUser = prisma.user.findUnique as unknown as jest.Mock;
const service = chatService as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  silenceConsole();
  findUser.mockReset().mockImplementation(userLookup(MEMBER));
  Object.values(service).forEach((fn) => fn.mockReset());
});

describe('authentication', () => {
  it('requires a token on every route', async () => {
    expect((await request(app).post('/api/chat')).status).toBe(401);
    expect((await request(app).get('/api/chat/history')).status).toBe(401);
    expect((await request(app).delete('/api/chat/history')).status).toBe(401);
  });
});

describe('POST /api/chat', () => {
  it("sends the message as the signed-in user with the client's local date", async () => {
    service.send.mockResolvedValue({ userMessage: { id: 'm1' }, assistantMessage: { id: 'm2' } });

    const res = await request(app)
      .post('/api/chat')
      .set(bearer(MEMBER))
      .send({ message: '  how much chest this week?  ', today: '2026-11-12' });

    expect(res.status).toBe(201);
    expect(res.body.assistantMessage.id).toBe('m2');
    expect(service.send).toHaveBeenCalledWith(MEMBER.id, 'how much chest this week?', '2026-11-12');
  });

  it.each([
    ['an empty message', { message: '   ', today: '2026-11-12' }],
    ['a message over 500 characters', { message: 'a'.repeat(501), today: '2026-11-12' }],
    ['a missing date', { message: 'hi' }],
    ['a badly formatted date', { message: 'hi', today: '12-11-2026' }],
  ])('rejects %s with a 400', async (_label, body) => {
    const res = await request(app).post('/api/chat').set(bearer(MEMBER)).send(body);

    expect(res.status).toBe(400);
    expect(service.send).not.toHaveBeenCalled();
  });

  it('returns 500 when the chat service fails', async () => {
    service.send.mockRejectedValue(new Error('llm exploded'));

    const res = await request(app).post('/api/chat').set(bearer(MEMBER)).send({ message: 'hi', today: '2026-11-12' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to process chat message');
  });
});

describe('GET /api/chat/history', () => {
  it('defaults to 50 messages', async () => {
    service.listHistory.mockResolvedValue([]);

    await request(app).get('/api/chat/history').set(bearer(MEMBER));

    expect(service.listHistory).toHaveBeenCalledWith(MEMBER.id, 50);
  });

  it.each([
    ['20', 20],
    ['500', 100], // capped
    ['0', 1], // floored
    ['-5', 1],
    ['abc', 50], // junk falls back to the default
    ['2.5', 50],
  ])('limit=%s is used as %i', async (limit, expected) => {
    service.listHistory.mockResolvedValue([]);

    await request(app).get(`/api/chat/history?limit=${limit}`).set(bearer(MEMBER));

    expect(service.listHistory).toHaveBeenCalledWith(MEMBER.id, expected);
  });
});

describe('DELETE /api/chat/history', () => {
  it("clears the signed-in user's history and reports how many messages went", async () => {
    service.clearHistory.mockResolvedValue(7);

    const res = await request(app).delete('/api/chat/history').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: 7 });
    expect(service.clearHistory).toHaveBeenCalledWith(MEMBER.id);
  });
});

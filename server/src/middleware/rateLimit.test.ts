import express from 'express';
import request from 'supertest';

// Without Redis the limiters fall back to express-rate-limit's in-memory store.
jest.mock('../lib/redis.js', () => ({ redis: null, isRedisConnected: () => false }));

import { apiRateLimit, chatRateLimit, loginRateLimit } from './rateLimit.js';

function appWith(limiter: express.RequestHandler, user?: { id: string }) {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, _res, next) => {
    if (user) req.user = user as any;
    next();
  });
  app.post('/hit', limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('loginRateLimit', () => {
  it('allows 5 attempts then answers 429 with a JSON message', async () => {
    const app = appWith(loginRateLimit);

    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/hit')).status).toBe(200);
    }
    const blocked = await request(app).post('/hit');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many attempts/i);
  });

  it('counts each IP separately', async () => {
    const app = appWith(loginRateLimit);

    // Burn the budget for one address (the other tests used the default 127.0.0.1)
    for (let i = 0; i < 6; i++) await request(app).post('/hit').set('X-Forwarded-For', '203.0.113.7');

    const blocked = await request(app).post('/hit').set('X-Forwarded-For', '203.0.113.7');
    const otherIp = await request(app).post('/hit').set('X-Forwarded-For', '203.0.113.8');

    expect(blocked.status).toBe(429);
    expect(otherIp.status).toBe(200);
  });

  it('sends standard RateLimit headers and no legacy X-RateLimit headers', async () => {
    const app = appWith(loginRateLimit);

    const res = await request(app).post('/hit').set('X-Forwarded-For', '203.0.113.50');

    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('apiRateLimit', () => {
  it('allows 200 requests per window, then answers 429', async () => {
    const app = appWith(apiRateLimit);

    let lastOk = 0;
    for (let i = 0; i < 200; i++) lastOk = (await request(app).post('/hit')).status;
    const blocked = await request(app).post('/hit');

    expect(lastOk).toBe(200);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/slow down/i);
  });
});

describe('chatRateLimit', () => {
  it('limits per account: 20 messages a minute, and users do not share a budget', async () => {
    const alice = appWith(chatRateLimit, { id: 'alice' });
    const bob = appWith(chatRateLimit, { id: 'bob' });

    for (let i = 0; i < 20; i++) expect((await request(alice).post('/hit')).status).toBe(200);
    const aliceBlocked = await request(alice).post('/hit');
    const bobOk = await request(bob).post('/hit');

    expect(aliceBlocked.status).toBe(429);
    expect(aliceBlocked.body.error).toMatch(/too fast/i);
    expect(bobOk.status).toBe(200);
  });
});

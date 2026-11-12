import request from 'supertest';

jest.mock('./db/prisma.js', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock('./lib/redis.js', () => ({
  redis: null,
  isRedisConnected: () => false,
  cacheAside: (_key: string, _ttl: number, fetcher: () => unknown) => fetcher(),
  invalidateCachePattern: async () => {},
}));
jest.mock('./middleware/rateLimit.js', () => {
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return { loginRateLimit: passThrough, apiRateLimit: passThrough, chatRateLimit: passThrough };
});

import { app } from './app.js';
import { silenceConsole } from './test/helpers.js';

beforeEach(silenceConsole);

describe('unknown routes', () => {
  it('returns a JSON 404 naming the method and path', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Cannot GET /api/does-not-exist' });
  });
});

describe('request tracing', () => {
  it('stamps every response with a unique X-Trace-Id', async () => {
    const a = await request(app).get('/api/nope');
    const b = await request(app).get('/api/nope');

    expect(a.headers['x-trace-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers['x-trace-id']).not.toBe(b.headers['x-trace-id']);
  });

  it('lets browsers read the trace id cross-origin', async () => {
    const res = await request(app).get('/api/nope').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-expose-headers']).toContain('X-Trace-Id');
  });
});

describe('security headers', () => {
  it('sets Helmet headers and hides X-Powered-By', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

describe('CORS', () => {
  it.each([
    'http://localhost:5173',
    'http://localhost:3000',
    'https://gymtrack-prdf.onrender.com',
    'https://some-preview.onrender.com',
  ])('allows %s', async (origin) => {
    const res = await request(app).get('/api/nope').set('Origin', origin);

    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows requests with no Origin header (curl, mobile apps)', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404); // reached the app, not blocked
  });

  it.each(['https://evil.example', 'https://onrender.com.evil.example', 'http://localhost:9999'])(
    'blocks %s',
    async (origin) => {
      const res = await request(app).get('/api/nope').set('Origin', origin);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  );

  it('answers a preflight request from an allowed origin', async () => {
    const res = await request(app)
      .options('/api/workouts')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

describe('body parsing', () => {
  it('returns 400, not 500, for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c", ');

    expect(res.status).toBe(400);
  });
});

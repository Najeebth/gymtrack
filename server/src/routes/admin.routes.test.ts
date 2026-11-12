import request from 'supertest';

jest.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
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

import { app } from '../app.js';
import { prisma } from '../db/prisma.js';
import { ADMIN, MEMBER, OTHER_MEMBER, bearer, silenceConsole, userLookup } from '../test/helpers.js';

const user = prisma.user as unknown as Record<string, jest.Mock>;
const queryRaw = (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw;

beforeEach(() => {
  silenceConsole();
  Object.values(user).forEach((fn) => fn.mockReset());
  user.findUnique.mockImplementation(userLookup(MEMBER, OTHER_MEMBER, ADMIN));
  queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);
});

describe.each([
  ['GET', '/api/users'],
  ['DELETE', '/api/users/user-2'],
  ['GET', '/api/health'],
  ['GET', '/api/traffic'],
  ['GET', '/api/traces'],
])('admin-only route %s %s', (method, url) => {
  const call = () => (request(app) as any)[method.toLowerCase()](url);

  it('rejects a request without a token (401)', async () => {
    expect((await call()).status).toBe(401);
  });

  it('rejects a regular member (403)', async () => {
    const res = await call().set(bearer(MEMBER));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admins only/i);
  });
});

describe('role is read from the database, not the token', () => {
  it('rejects a member whose token claims to be an admin', async () => {
    const forged = bearer({ ...MEMBER, role: 'ADMIN' }); // token says ADMIN, the account is a MEMBER

    const res = await request(app).get('/api/users').set(forged);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users', () => {
  it('lists accounts with activity counts and no password hashes', async () => {
    user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'member@gymtrack.io',
        role: 'MEMBER',
        createdAt: '2026-01-01T00:00:00.000Z',
        _count: { workouts: 4, templates: 2 },
        workouts: [{ date: '2026-11-10' }],
      },
      {
        id: 'user-2',
        email: 'other@gymtrack.io',
        role: 'MEMBER',
        createdAt: '2026-02-01T00:00:00.000Z',
        _count: { workouts: 0, templates: 0 },
        workouts: [],
      },
    ]);

    const res = await request(app).get('/api/users').set(bearer(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'user-1',
        email: 'member@gymtrack.io',
        role: 'MEMBER',
        createdAt: '2026-01-01T00:00:00.000Z',
        workoutCount: 4,
        templateCount: 2,
        lastWorkoutDate: '2026-11-10',
      },
      {
        id: 'user-2',
        email: 'other@gymtrack.io',
        role: 'MEMBER',
        createdAt: '2026-02-01T00:00:00.000Z',
        workoutCount: 0,
        templateCount: 0,
        lastWorkoutDate: null,
      },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(user.findMany.mock.calls[0][0].select).not.toHaveProperty('password');
  });

  it('returns 500 when the database fails', async () => {
    user.findMany.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/users').set(bearer(ADMIN));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes another account', async () => {
    user.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app).delete('/api/users/user-2').set(bearer(ADMIN));

    expect(res.status).toBe(200);
    expect(user.deleteMany).toHaveBeenCalledWith({ where: { id: 'user-2' } });
  });

  it("refuses to delete the admin's own account", async () => {
    const res = await request(app).delete(`/api/users/${ADMIN.id}`).set(bearer(ADMIN));

    expect(res.status).toBe(400);
    expect(user.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown account', async () => {
    user.deleteMany.mockResolvedValue({ count: 0 });

    const res = await request(app).delete('/api/users/ghost').set(bearer(ADMIN));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/health', () => {
  it('reports a healthy server with a connected database', async () => {
    const res = await request(app).get('/api/health').set(bearer(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toMatch(/connected/);
    expect(res.body.nodeVersion).toBe(process.version);
  });

  it('still answers, but reports the error, when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('no route to host'));

    const res = await request(app).get('/api/health').set(bearer(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.database).toBe('error: no route to host');
  });
});

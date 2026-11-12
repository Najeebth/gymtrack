import request from 'supertest';

jest.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    template: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
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
import { MEMBER, bearer, silenceConsole, userLookup } from '../test/helpers.js';

const findUser = prisma.user.findUnique as unknown as jest.Mock;
const template = prisma.template as unknown as Record<string, jest.Mock>;

const validTemplate = {
  name: '  Push Day  ',
  exercises: [
    { muscleGroup: 'Chest', exercise: 'Bench Press', sets: [{ reps: 8, weightKg: 80 }] },
    { exercise: ' Overhead Press ', sets: [{ reps: '10', weightKg: '40' }] },
  ],
};

beforeEach(() => {
  silenceConsole();
  findUser.mockReset().mockImplementation(userLookup(MEMBER));
  Object.values(template).forEach((fn) => fn.mockReset());
});

describe('authentication', () => {
  it('requires a token on every route', async () => {
    expect((await request(app).get('/api/templates')).status).toBe(401);
    expect((await request(app).post('/api/templates')).status).toBe(401);
    expect((await request(app).put('/api/templates/t1')).status).toBe(401);
    expect((await request(app).delete('/api/templates/t1')).status).toBe(401);
  });
});

describe('GET /api/templates', () => {
  it("lists only the signed-in user's templates", async () => {
    template.findMany.mockResolvedValue([{ id: 't1', name: 'Push Day', exercises: [] }]);

    const res = await request(app).get('/api/templates').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(template.findMany.mock.calls[0][0].where).toEqual({ userId: MEMBER.id });
  });

  it('returns 500 when the database fails', async () => {
    template.findMany.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/templates').set(bearer(MEMBER));

    expect(res.status).toBe(500);
  });
});

describe('POST /api/templates', () => {
  it('trims names, defaults the muscle group, coerces numbers and numbers the positions', async () => {
    template.create.mockImplementation(async ({ data }: any) => ({ id: 't1', ...data }));

    const res = await request(app).post('/api/templates').set(bearer(MEMBER)).send(validTemplate);

    expect(res.status).toBe(201);
    const data = template.create.mock.calls[0][0].data;
    expect(data.name).toBe('Push Day');
    expect(data.userId).toBe(MEMBER.id);
    expect(data.exercises.create).toEqual([
      { position: 0, muscleGroup: 'Chest', exercise: 'Bench Press', sets: [{ reps: 8, weightKg: 80 }] },
      { position: 1, muscleGroup: 'General', exercise: 'Overhead Press', sets: [{ reps: 10, weightKg: 40 }] },
    ]);
  });

  it.each([
    ['a missing name', { name: '   ' }, /name is required/i],
    ['a name over 60 characters', { name: 'x'.repeat(61) }, /60 characters/],
    ['no exercises', { exercises: [] }, /at least one exercise/i],
    ['more than 20 exercises', { exercises: Array(21).fill(validTemplate.exercises[0]) }, /at most 20 exercises/],
    ['an exercise without a name', { exercises: [{ sets: [{ reps: 5, weightKg: 10 }] }] }, /Exercise 1 needs a name/],
    ['an exercise without sets', { exercises: [{ exercise: 'Squat', sets: [] }] }, /needs at least one set/],
    ['fractional reps', { exercises: [{ exercise: 'Squat', sets: [{ reps: 2.5, weightKg: 10 }] }] }, /whole-number reps/],
    ['zero reps', { exercises: [{ exercise: 'Squat', sets: [{ reps: 0, weightKg: 10 }] }] }, /whole-number reps/],
    ['negative weight', { exercises: [{ exercise: 'Squat', sets: [{ reps: 5, weightKg: -5 }] }] }, /weight of 0 or more/],
  ])('rejects %s with a 400', async (_label, override, message) => {
    const res = await request(app)
      .post('/api/templates')
      .set(bearer(MEMBER))
      .send({ ...validTemplate, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(template.create).not.toHaveBeenCalled();
  });

  it('rejects more than 20 sets in one exercise', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set(bearer(MEMBER))
      .send({ name: 'Big', exercises: [{ exercise: 'Squat', sets: Array(21).fill({ reps: 5, weightKg: 50 }) }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 20 sets/);
  });
});

describe('PUT /api/templates/:id', () => {
  it('replaces the template after confirming the user owns it', async () => {
    template.findFirst.mockResolvedValue({ id: 't1' });
    template.update.mockResolvedValue({ id: 't1', name: 'Push Day' });

    const res = await request(app).put('/api/templates/t1').set(bearer(MEMBER)).send(validTemplate);

    expect(res.status).toBe(200);
    expect(template.findFirst.mock.calls[0][0].where).toEqual({ id: 't1', userId: MEMBER.id });
    expect(template.update.mock.calls[0][0].data.exercises.deleteMany).toEqual({});
  });

  it("returns 404 and writes nothing for a template the user doesn't own", async () => {
    template.findFirst.mockResolvedValue(null);

    const res = await request(app).put('/api/templates/someone-elses').set(bearer(MEMBER)).send(validTemplate);

    expect(res.status).toBe(404);
    expect(template.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid body before the ownership lookup', async () => {
    const res = await request(app).put('/api/templates/t1').set(bearer(MEMBER)).send({ name: '', exercises: [] });

    expect(res.status).toBe(400);
    expect(template.findFirst).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/templates/:id', () => {
  it('scopes the delete to the signed-in user', async () => {
    template.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app).delete('/api/templates/t1').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(template.deleteMany.mock.calls[0][0].where).toEqual({ id: 't1', userId: MEMBER.id });
  });

  it('returns 404 when nothing was deleted', async () => {
    template.deleteMany.mockResolvedValue({ count: 0 });

    const res = await request(app).delete('/api/templates/t1').set(bearer(MEMBER));

    expect(res.status).toBe(404);
  });
});

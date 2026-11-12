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
jest.mock('../services/exercises.service.js', () => ({
  exercisesService: { listExercises: jest.fn(), createCustomExercise: jest.fn(), deleteCustomExercise: jest.fn() },
}));

import { app } from '../app.js';
import { prisma } from '../db/prisma.js';
import { exercisesService } from '../services/exercises.service.js';
import { MEMBER, bearer, silenceConsole, userLookup } from '../test/helpers.js';

const findUser = prisma.user.findUnique as unknown as jest.Mock;
const service = exercisesService as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  silenceConsole();
  findUser.mockReset().mockImplementation(userLookup(MEMBER));
  Object.values(service).forEach((fn) => fn.mockReset());
});

describe('authentication', () => {
  it('requires a token on every route', async () => {
    expect((await request(app).get('/api/exercises')).status).toBe(401);
    expect((await request(app).post('/api/exercises')).status).toBe(401);
    expect((await request(app).delete('/api/exercises/e1')).status).toBe(401);
  });
});

describe('GET /api/exercises', () => {
  it('passes parsed filters and the user id to the service', async () => {
    service.listExercises.mockResolvedValue({ data: [], pagination: { total: 0, page: 2, limit: 5, totalPages: 0 } });

    const res = await request(app)
      .get('/api/exercises?page=2&limit=5&search=press&muscleGroup=Chest&equipment=Barbell')
      .set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(service.listExercises).toHaveBeenCalledWith({
      userId: MEMBER.id,
      page: 2,
      limit: 5,
      search: 'press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
    });
  });

  it('falls back to page 1 with 12 per page for missing or junk values', async () => {
    service.listExercises.mockResolvedValue({ data: [] });

    await request(app).get('/api/exercises?page=abc&limit=').set(bearer(MEMBER));

    expect(service.listExercises).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 12 }));
  });

  it('returns 500 when the service fails', async () => {
    service.listExercises.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/exercises').set(bearer(MEMBER));

    expect(res.status).toBe(500);
  });
});

describe('POST /api/exercises', () => {
  const valid = { name: 'Cable Fly', muscleGroup: 'Chest', equipment: 'Cable' };

  it('creates a custom exercise', async () => {
    service.createCustomExercise.mockResolvedValue({ status: 'SUCCESS', data: { id: 'e1', ...valid } });

    const res = await request(app).post('/api/exercises').set(bearer(MEMBER)).send(valid);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('e1');
    expect(service.createCustomExercise).toHaveBeenCalledWith(MEMBER.id, expect.objectContaining(valid));
  });

  it("trims input and defaults equipment to 'Other'", async () => {
    service.createCustomExercise.mockResolvedValue({ status: 'SUCCESS', data: {} });

    await request(app)
      .post('/api/exercises')
      .set(bearer(MEMBER))
      .send({ name: '  Cable Fly  ', muscleGroup: ' Chest ' });

    expect(service.createCustomExercise.mock.calls[0][1]).toMatchObject({
      name: 'Cable Fly',
      muscleGroup: 'Chest',
      equipment: 'Other',
    });
  });

  it('returns 409 for a duplicate name', async () => {
    service.createCustomExercise.mockResolvedValue({ status: 'DUPLICATE' });

    const res = await request(app).post('/api/exercises').set(bearer(MEMBER)).send(valid);

    expect(res.status).toBe(409);
  });

  it.each([
    ['a one-letter name', { name: 'x' }],
    ['a missing muscle group', { muscleGroup: '' }],
    ['notes over 500 characters', { notes: 'n'.repeat(501) }],
  ])('rejects %s with a 400', async (_label, override) => {
    const res = await request(app)
      .post('/api/exercises')
      .set(bearer(MEMBER))
      .send({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(service.createCustomExercise).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/exercises/:id', () => {
  it('deletes the exercise', async () => {
    service.deleteCustomExercise.mockResolvedValue({ status: 'SUCCESS' });

    const res = await request(app).delete('/api/exercises/e1').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(service.deleteCustomExercise).toHaveBeenCalledWith('e1', MEMBER.id);
  });

  it('returns 404 for an unknown exercise', async () => {
    service.deleteCustomExercise.mockResolvedValue({ status: 'NOT_FOUND' });

    expect((await request(app).delete('/api/exercises/e1').set(bearer(MEMBER))).status).toBe(404);
  });

  it("returns 403 when the exercise is in the public library or isn't the user's", async () => {
    service.deleteCustomExercise.mockResolvedValue({ status: 'FORBIDDEN' });

    expect((await request(app).delete('/api/exercises/e1').set(bearer(MEMBER))).status).toBe(403);
  });
});

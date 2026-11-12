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
jest.mock('../lib/socket.js', () => ({ emitToUser: jest.fn() }));
// Keep the real normalizeSets, replace the database-backed service.
jest.mock('../services/workouts.service.js', () => ({
  ...jest.requireActual('../services/workouts.service.js'),
  workoutsService: {
    listWorkouts: jest.fn(),
    createWorkout: jest.fn(),
    updateWorkout: jest.fn(),
    updateSet: jest.fn(),
    addSets: jest.fn(),
    deleteSet: jest.fn(),
    deleteWorkout: jest.fn(),
  },
}));

import { app } from '../app.js';
import { prisma } from '../db/prisma.js';
import { emitToUser } from '../lib/socket.js';
import { workoutsService } from '../services/workouts.service.js';
import { MEMBER, bearer, silenceConsole, userLookup } from '../test/helpers.js';

const findUser = prisma.user.findUnique as unknown as jest.Mock;
const service = workoutsService as unknown as Record<string, jest.Mock>;
const emit = emitToUser as unknown as jest.Mock;

const validWorkout = {
  date: '2026-11-12',
  muscleGroup: 'Chest',
  exercise: 'Bench Press',
  notes: 'felt strong',
  sets: [
    { reps: 10, weightKg: 60 },
    { reps: 8, weightKg: 70 },
  ],
};

beforeEach(() => {
  silenceConsole();
  findUser.mockReset().mockImplementation(userLookup(MEMBER));
  Object.values(service).forEach((fn) => fn.mockReset());
});

describe('authentication', () => {
  it.each([
    ['GET', '/api/workouts'],
    ['POST', '/api/workouts'],
    ['PUT', '/api/workouts/w1'],
    ['DELETE', '/api/workouts/w1'],
  ])('%s %s requires a token', async (method, url) => {
    const res = await (request(app) as any)[method.toLowerCase()](url);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token provided/i);
  });

  it('rejects a valid token whose account has been deleted', async () => {
    findUser.mockImplementation(userLookup()); // nobody exists

    const res = await request(app).get('/api/workouts').set(bearer(MEMBER));

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no longer exists/i);
    expect(service.listWorkouts).not.toHaveBeenCalled();
  });
});

describe('GET /api/workouts', () => {
  it("lists the signed-in user's workouts only", async () => {
    service.listWorkouts.mockResolvedValue([{ id: 'w1', exercise: 'Squat' }]);

    const res = await request(app).get('/api/workouts').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'w1', exercise: 'Squat' }]);
    expect(service.listWorkouts).toHaveBeenCalledWith(MEMBER.id, undefined);
  });

  it('passes the date filter through', async () => {
    service.listWorkouts.mockResolvedValue([]);

    await request(app).get('/api/workouts?date=2026-11-12').set(bearer(MEMBER));

    expect(service.listWorkouts).toHaveBeenCalledWith(MEMBER.id, '2026-11-12');
  });

  it('returns 500 when the service fails', async () => {
    service.listWorkouts.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/workouts').set(bearer(MEMBER));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch workouts');
  });
});

describe('POST /api/workouts', () => {
  it('creates a workout for the signed-in user and notifies their other devices', async () => {
    const created = { id: 'w1', ...validWorkout };
    service.createWorkout.mockResolvedValue(created);

    const res = await request(app).post('/api/workouts').set(bearer(MEMBER)).send(validWorkout);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
    expect(service.createWorkout).toHaveBeenCalledWith(MEMBER.id, expect.objectContaining({ exercise: 'Bench Press' }));
    expect(emit).toHaveBeenCalledWith(MEMBER.id, 'workout:created', created);
  });

  it('ignores a userId in the body, so a workout cannot be created for someone else', async () => {
    service.createWorkout.mockResolvedValue({ id: 'w1' });

    await request(app)
      .post('/api/workouts')
      .set(bearer(MEMBER))
      .send({ ...validWorkout, userId: 'user-2' });

    expect(service.createWorkout.mock.calls[0][0]).toBe(MEMBER.id);
    expect(service.createWorkout.mock.calls[0][1]).not.toHaveProperty('userId');
  });

  it('coerces numeric strings in sets', async () => {
    service.createWorkout.mockResolvedValue({ id: 'w1' });

    await request(app)
      .post('/api/workouts')
      .set(bearer(MEMBER))
      .send({ ...validWorkout, sets: [{ reps: '12', weightKg: '72.5' }] });

    expect(service.createWorkout.mock.calls[0][1].sets).toEqual([{ reps: 12, weightKg: 72.5 }]);
  });

  it.each([
    ['a bad date format', { date: '12/11/2026' }, 'date'],
    ['a missing muscle group', { muscleGroup: '' }, 'muscleGroup'],
    ['a one-letter exercise name', { exercise: 'x' }, 'exercise'],
    ['no sets', { sets: [] }, 'sets'],
    ['zero reps', { sets: [{ reps: 0, weightKg: 50 }] }, 'sets.0.reps'],
    ['a negative weight', { sets: [{ reps: 5, weightKg: -1 }] }, 'sets.0.weightKg'],
    ['an impossible weight', { sets: [{ reps: 5, weightKg: 5000 }] }, 'sets.0.weightKg'],
  ])('rejects %s with a 400', async (_label, override, field) => {
    const res = await request(app)
      .post('/api/workouts')
      .set(bearer(MEMBER))
      .send({ ...validWorkout, ...override });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(service.createWorkout).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('returns 500 and does not emit when the service fails', async () => {
    service.createWorkout.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/workouts').set(bearer(MEMBER)).send(validWorkout);

    expect(res.status).toBe(500);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('PUT /api/workouts/:id', () => {
  it('updates and emits workout:updated', async () => {
    const updated = { id: 'w1', exercise: 'Incline Press' };
    service.updateWorkout.mockResolvedValue(updated);

    const res = await request(app).put('/api/workouts/w1').set(bearer(MEMBER)).send({ exercise: 'Incline Press' });

    expect(res.status).toBe(200);
    expect(service.updateWorkout).toHaveBeenCalledWith('w1', MEMBER.id, expect.objectContaining({ exercise: 'Incline Press' }));
    expect(emit).toHaveBeenCalledWith(MEMBER.id, 'workout:updated', updated);
  });

  it("returns 404 for a workout that isn't the user's", async () => {
    service.updateWorkout.mockResolvedValue(null);

    const res = await request(app).put('/api/workouts/not-mine').set(bearer(MEMBER)).send({ exercise: 'Row' });

    expect(res.status).toBe(404);
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects an invalid date with a 400', async () => {
    const res = await request(app).put('/api/workouts/w1').set(bearer(MEMBER)).send({ date: 'yesterday' });

    expect(res.status).toBe(400);
    expect(service.updateWorkout).not.toHaveBeenCalled();
  });
});

describe('PUT /api/workouts/:id/sets/:setId', () => {
  it('updates a set', async () => {
    service.updateSet.mockResolvedValue({ status: 'SUCCESS', data: { id: 'w1' } });

    const res = await request(app).put('/api/workouts/w1/sets/s1').set(bearer(MEMBER)).send({ reps: 12, weightKg: 65 });

    expect(res.status).toBe(200);
    expect(service.updateSet).toHaveBeenCalledWith('w1', 's1', MEMBER.id, 12, 65);
    expect(emit).toHaveBeenCalledWith(MEMBER.id, 'workout:updated', { id: 'w1' });
  });

  it.each([
    ['WORKOUT_NOT_FOUND', 'Workout not found'],
    ['SET_NOT_FOUND', 'Set not found'],
  ])('maps %s to a 404', async (status, message) => {
    service.updateSet.mockResolvedValue({ status });

    const res = await request(app).put('/api/workouts/w1/sets/s1').set(bearer(MEMBER)).send({ reps: 5, weightKg: 50 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(message);
  });
});

describe('POST /api/workouts/:id/sets', () => {
  it('adds sets and returns 201', async () => {
    service.addSets.mockResolvedValue({ id: 'w1' });

    const res = await request(app)
      .post('/api/workouts/w1/sets')
      .set(bearer(MEMBER))
      .send({ sets: [{ reps: 6, weightKg: 80 }] });

    expect(res.status).toBe(201);
    expect(service.addSets).toHaveBeenCalledWith('w1', MEMBER.id, [{ reps: 6, weightKg: 80 }]);
  });

  it('rejects an empty sets array', async () => {
    const res = await request(app).post('/api/workouts/w1/sets').set(bearer(MEMBER)).send({ sets: [] });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the workout isn't the user's", async () => {
    service.addSets.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/workouts/w1/sets')
      .set(bearer(MEMBER))
      .send({ sets: [{ reps: 6, weightKg: 80 }] });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/workouts/:id/sets/:setId', () => {
  it('deletes a set and returns the updated workout', async () => {
    service.deleteSet.mockResolvedValue({ status: 'SUCCESS', data: { id: 'w1', sets: [] } });

    const res = await request(app).delete('/api/workouts/w1/sets/s1').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'w1', sets: [] });
    expect(service.deleteSet).toHaveBeenCalledWith('w1', 's1', MEMBER.id);
  });

  it('returns 404 for a missing set', async () => {
    service.deleteSet.mockResolvedValue({ status: 'SET_NOT_FOUND' });

    const res = await request(app).delete('/api/workouts/w1/sets/s1').set(bearer(MEMBER));

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/workouts/:id', () => {
  it('deletes and emits workout:deleted', async () => {
    service.deleteWorkout.mockResolvedValue(true);

    const res = await request(app).delete('/api/workouts/w1').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(service.deleteWorkout).toHaveBeenCalledWith('w1', MEMBER.id);
    expect(emit).toHaveBeenCalledWith(MEMBER.id, 'workout:deleted', { id: 'w1' });
  });

  it("returns 404 when the workout doesn't exist or isn't the user's", async () => {
    service.deleteWorkout.mockResolvedValue(false);

    const res = await request(app).delete('/api/workouts/w1').set(bearer(MEMBER));

    expect(res.status).toBe(404);
    expect(emit).not.toHaveBeenCalled();
  });
});

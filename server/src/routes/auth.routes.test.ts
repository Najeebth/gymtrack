import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// The database, Redis and the rate limiter are replaced so these tests exercise
// only the HTTP layer: routing, validation, controllers and the JWT handling.
jest.mock('../db/prisma.js', () => ({
  prisma: { user: { findUnique: jest.fn(), create: jest.fn() } },
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
import { silenceConsole } from '../test/helpers.js';

const db = prisma.user as unknown as { findUnique: jest.Mock; create: jest.Mock };

const PASSWORD = 'secret123';
let storedUser: { id: string; email: string; password: string; role: string };

beforeAll(() => {
  // Low cost factor keeps the hashing fast; the controller only compares.
  storedUser = { id: 'user-1', email: 'member@gymtrack.io', password: bcrypt.hashSync(PASSWORD, 4), role: 'MEMBER' };
});

beforeEach(() => {
  silenceConsole();
  db.findUnique.mockReset();
  db.create.mockReset();
});

describe('POST /api/auth/login', () => {
  it('returns a signed token for valid credentials', async () => {
    db.findUnique.mockResolvedValue(storedUser);

    const res = await request(app).post('/api/auth/login').send({ email: storedUser.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: storedUser.email, role: 'MEMBER' });
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(payload).toMatchObject({ id: 'user-1', email: storedUser.email, role: 'MEMBER' });
    expect(payload.exp! - payload.iat!).toBe(24 * 60 * 60);
  });

  it('never returns the password hash', async () => {
    db.findUnique.mockResolvedValue(storedUser);

    const res = await request(app).post('/api/auth/login').send({ email: storedUser.email, password: PASSWORD });

    expect(JSON.stringify(res.body)).not.toContain(storedUser.password);
  });

  it('rejects an unknown email with 401', async () => {
    db.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@gymtrack.io', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('gives the same error for a wrong password, so accounts cannot be enumerated', async () => {
    db.findUnique.mockResolvedValue(storedUser);

    const res = await request(app).post('/api/auth/login').send({ email: storedUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects a malformed email with a 400 before touching the database', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details[0].field).toBe('email');
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a too-short password with a 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: storedUser.email, password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });

  it('rejects a missing body with a 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it('returns 500 when the database fails', async () => {
    db.findUnique.mockRejectedValue(new Error('connection lost'));

    const res = await request(app).post('/api/auth/login').send({ email: storedUser.email, password: PASSWORD });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('POST /api/auth/signup', () => {
  it('creates a MEMBER account, stores a hash instead of the password, and returns a token', async () => {
    db.findUnique.mockResolvedValue(null);
    db.create.mockImplementation(async ({ data }: { data: { email: string; password: string; role: string } }) => ({
      id: 'new-user',
      ...data,
    }));

    const res = await request(app).post('/api/auth/signup').send({ email: 'new@gymtrack.io', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new@gymtrack.io', role: 'MEMBER' });
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET!)).toMatchObject({ id: 'new-user' });

    const saved = db.create.mock.calls[0][0].data;
    expect(saved.password).not.toBe(PASSWORD);
    expect(bcrypt.compareSync(PASSWORD, saved.password)).toBe(true);
  });

  it('ignores a role sent in the body, so nobody can self-sign-up as an admin', async () => {
    db.findUnique.mockResolvedValue(null);
    db.create.mockImplementation(async ({ data }: { data: Record<string, string> }) => ({ id: 'new-user', ...data }));

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'sneaky@gymtrack.io', password: PASSWORD, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MEMBER');
    expect(db.create.mock.calls[0][0].data.role).toBe('MEMBER');
  });

  it('returns 409 when the email is already registered', async () => {
    db.findUnique.mockResolvedValue(storedUser);

    const res = await request(app).post('/api/auth/signup').send({ email: storedUser.email, password: PASSWORD });

    expect(res.status).toBe(409);
    expect(db.create).not.toHaveBeenCalled();
  });

  it('rejects invalid input with a 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'bad', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(2);
    expect(db.create).not.toHaveBeenCalled();
  });

  it('returns 500 when the database fails', async () => {
    db.findUnique.mockResolvedValue(null);
    db.create.mockRejectedValue(new Error('unique constraint'));

    const res = await request(app).post('/api/auth/signup').send({ email: 'new@gymtrack.io', password: PASSWORD });

    expect(res.status).toBe(500);
  });
});

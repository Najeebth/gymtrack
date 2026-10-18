import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireAuth, requireAdmin } from './auth.js';
import { JWT_SECRET } from '../config/env.js';

interface MockResponse {
  statusCode: number;
  body: any;
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe('Authentication & Authorization Middlewares', () => {
  it('should reject requests with missing Authorization header (401)', async () => {
    const req: any = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /no token provided/i);
  });

  it('should reject requests with non-Bearer Authorization header (401)', async () => {
    const req: any = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /no token provided/i);
  });

  it('should reject invalid or tampered JWT tokens (401)', async () => {
    const req: any = { headers: { authorization: 'Bearer invalid.tampered.signature' } };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /invalid token/i);
  });

  it('should reject expired tokens or tokens signed with a different secret (401)', async () => {
    const fakeToken = jwt.sign({ id: 'user-123', email: 'test@gymtrack.io' }, 'wrong-secret-key');
    const req: any = { headers: { authorization: `Bearer ${fakeToken}` } };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /invalid token/i);
  });
});


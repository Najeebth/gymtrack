import type { AppError } from './errorHandler.js';

function mockRes(statusCode = 200) {
  const res: any = {
    statusCode,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res;
}

const req: any = { method: 'POST', originalUrl: '/api/things', traceId: 'trace-123' };

// errorHandler reads NODE_ENV once when its module loads, so each environment
// needs a fresh copy of the module.
function loadHandlers(nodeEnv: string) {
  let mod!: typeof import('./errorHandler.js');
  jest.isolateModules(() => {
    jest.doMock('../config/env.js', () => ({ NODE_ENV: nodeEnv }));
    mod = require('./errorHandler.js');
  });
  return mod;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.dontMock('../config/env.js');
});

describe('notFoundHandler', () => {
  it('returns a 404 that names the method and URL', () => {
    const { notFoundHandler } = loadHandlers('test');
    const res = mockRes();

    notFoundHandler({ method: 'GET', originalUrl: '/api/missing?x=1' } as any, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Cannot GET /api/missing?x=1' });
  });
});

describe('errorHandler (development)', () => {
  const { errorHandler } = loadHandlers('development');

  it('uses the error statusCode and shows the real message and stack', () => {
    const err: AppError = Object.assign(new Error('Title too long'), { name: 'ValidationError', statusCode: 422 });
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('ValidationError');
    expect(res.body.message).toBe('Title too long');
    expect(res.body.stack).toContain('Title too long');
  });

  it('defaults to 500 and labels it Internal Server Error', () => {
    const res = mockRes();

    errorHandler(new Error('boom'), req, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBe('boom');
  });

  it('keeps a 4xx status that was already set on the response', () => {
    const res = mockRes(403);

    errorHandler(new Error('nope'), req, res, jest.fn());

    expect(res.statusCode).toBe(403);
  });

  it('includes details when the error carries them', () => {
    const err: AppError = Object.assign(new Error('bad'), { statusCode: 400, details: [{ field: 'email' }] });
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.body.details).toEqual([{ field: 'email' }]);
  });

  it('logs the full error with the trace id', () => {
    const err = new Error('boom');

    errorHandler(err, req, mockRes(), jest.fn());

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('trace-123'), err);
  });
});

describe('errorHandler (production)', () => {
  const { errorHandler } = loadHandlers('production');

  it('hides the message and stack of a 5xx error', () => {
    const res = mockRes();

    errorHandler(new Error('relation "User" does not exist'), req, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('An unexpected error occurred. Please try again later.');
    expect(JSON.stringify(res.body)).not.toContain('relation');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('still shows the message of a 4xx error, but never the stack', () => {
    const err: AppError = Object.assign(new Error('Title too long'), { name: 'ValidationError', statusCode: 400 });
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Title too long');
    expect(res.body).not.toHaveProperty('stack');
  });
});

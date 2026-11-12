import { z } from 'zod';
import { validateBody } from './validate.js';

const schema = z.object({
  name: z.string().min(2, 'Name is too short'),
  reps: z.coerce.number().int().min(1, 'Reps must be at least 1'),
  nested: z.object({ weight: z.number().min(0, 'Weight must be non-negative') }).optional(),
});

function run(body: unknown) {
  const req: any = { body };
  const res: any = {
    statusCode: 200,
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
  const next = jest.fn();
  validateBody(schema)(req, res, next);
  return { req, res, next };
}

describe('validateBody', () => {
  it('calls next() and leaves no response for a valid body', () => {
    const { res, next } = run({ name: 'Squat', reps: 5 });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
  });

  it('replaces req.body with the coerced value', () => {
    const { req } = run({ name: 'Squat', reps: '12' });

    expect(req.body.reps).toBe(12);
  });

  it('strips keys the schema does not know (mass-assignment protection)', () => {
    const { req } = run({ name: 'Squat', reps: 5, role: 'ADMIN', userId: 'someone-else' });

    expect(req.body).toEqual({ name: 'Squat', reps: 5 });
  });

  it('responds 400 without calling next() for an invalid body', () => {
    const { res, next } = run({ name: 'x', reps: 0 });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('lists every problem with its field', () => {
    const { res } = run({ name: 'x', reps: 0 });

    expect(res.body.details).toEqual([
      { field: 'name', message: 'Name is too short' },
      { field: 'reps', message: 'Reps must be at least 1' },
    ]);
  });

  it('uses the first problem as the headline message', () => {
    const { res } = run({ name: 'x', reps: 0 });

    expect(res.body.message).toBe('Name is too short');
  });

  it('joins nested paths with dots', () => {
    const { res } = run({ name: 'Squat', reps: 5, nested: { weight: -1 } });

    expect(res.body.details).toEqual([{ field: 'nested.weight', message: 'Weight must be non-negative' }]);
  });

  it.each([undefined, null, 'a string', 42])('reports a non-object body (%p) as a body-level error', (body) => {
    const { res, next } = run(body);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0].field).toBe('body');
  });
});

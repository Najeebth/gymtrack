import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSets } from './workouts.service.js';

describe('WorkoutsService - Core Logic', () => {
  it('should format raw sets into sequential 1-based set records', () => {
    const raw = [
      { reps: 10, weightKg: 100 },
      { reps: 8, weightKg: 105 },
      { reps: 6, weightKg: 110 },
    ];

    const normalized = normalizeSets(raw);
    assert.equal(normalized.length, 3);
    assert.deepEqual(normalized[0], { setNumber: 1, reps: 10, weightKg: 100 });
    assert.deepEqual(normalized[1], { setNumber: 2, reps: 8, weightKg: 105 });
    assert.deepEqual(normalized[2], { setNumber: 3, reps: 6, weightKg: 110 });
  });

  it('should safely coerce numeric strings into floating point and integers', () => {
    const raw = [{ reps: '12', weightKg: '72.5' }];
    const normalized = normalizeSets(raw);

    assert.equal(normalized[0].reps, 12);
    assert.equal(normalized[0].weightKg, 72.5);
    assert.equal(typeof normalized[0].reps, 'number');
    assert.equal(typeof normalized[0].weightKg, 'number');
  });

  it('should return empty list when given invalid or empty set arrays', () => {
    assert.deepEqual(normalizeSets([]), []);
    assert.deepEqual(normalizeSets(null as any), []);
    assert.deepEqual(normalizeSets(undefined as any), []);
  });
});


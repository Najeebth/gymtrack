import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSets } from './workouts.controller.js';

describe('Workout Controller Helper Functions', () => {
  it('should normalize sets into sequential 1-based setNumbers', () => {
    const rawSets = [
      { reps: 12, weightKg: 60 },
      { reps: 10, weightKg: 70 },
      { reps: 8, weightKg: 80 },
    ];

    const normalized = normalizeSets(rawSets);
    assert.equal(normalized.length, 3);
    assert.deepEqual(normalized, [
      { setNumber: 1, reps: 12, weightKg: 60 },
      { setNumber: 2, reps: 10, weightKg: 70 },
      { setNumber: 3, reps: 8, weightKg: 80 },
    ]);
  });

  it('should cast numeric strings to numbers accurately', () => {
    const rawSets = [
      { reps: '15' as any, weightKg: '22.5' as any },
    ];

    const normalized = normalizeSets(rawSets);
    assert.equal(normalized[0].setNumber, 1);
    assert.equal(normalized[0].reps, 15);
    assert.equal(normalized[0].weightKg, 22.5);
  });

  it('should return empty array for empty or non-array inputs', () => {
    assert.deepEqual(normalizeSets([]), []);
    assert.deepEqual(normalizeSets(null as any), []);
    assert.deepEqual(normalizeSets(undefined as any), []);
  });
});


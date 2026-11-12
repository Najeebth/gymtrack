import { normalizeSets } from './workouts.controller.js';

describe('Workout Controller Helper Functions', () => {
  it('should normalize sets into sequential 1-based setNumbers', () => {
    const rawSets = [
      { reps: 12, weightKg: 60 },
      { reps: 10, weightKg: 70 },
      { reps: 8, weightKg: 80 },
    ];

    const normalized = normalizeSets(rawSets);
    expect(normalized.length).toBe(3);
    expect(normalized).toEqual([
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
    expect(normalized[0].setNumber).toBe(1);
    expect(normalized[0].reps).toBe(15);
    expect(normalized[0].weightKg).toBe(22.5);
  });

  it('should return empty array for empty or non-array inputs', () => {
    expect(normalizeSets([])).toEqual([]);
    expect(normalizeSets(null as any)).toEqual([]);
    expect(normalizeSets(undefined as any)).toEqual([]);
  });
});


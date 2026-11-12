import { normalizeSets } from './workouts.service.js';

describe('WorkoutsService - Core Logic', () => {
  it('should format raw sets into sequential 1-based set records', () => {
    const raw = [
      { reps: 10, weightKg: 100 },
      { reps: 8, weightKg: 105 },
      { reps: 6, weightKg: 110 },
    ];

    const normalized = normalizeSets(raw);
    expect(normalized.length).toBe(3);
    expect(normalized[0]).toEqual({ setNumber: 1, reps: 10, weightKg: 100 });
    expect(normalized[1]).toEqual({ setNumber: 2, reps: 8, weightKg: 105 });
    expect(normalized[2]).toEqual({ setNumber: 3, reps: 6, weightKg: 110 });
  });

  it('should safely coerce numeric strings into floating point and integers', () => {
    const raw = [{ reps: '12', weightKg: '72.5' }];
    const normalized = normalizeSets(raw);

    expect(normalized[0].reps).toBe(12);
    expect(normalized[0].weightKg).toBe(72.5);
    expect(typeof normalized[0].reps).toBe('number');
    expect(typeof normalized[0].weightKg).toBe('number');
  });

  it('should return empty list when given invalid or empty set arrays', () => {
    expect(normalizeSets([])).toEqual([]);
    expect(normalizeSets(null as any)).toEqual([]);
    expect(normalizeSets(undefined as any)).toEqual([]);
  });
});


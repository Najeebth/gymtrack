import { looksLikeWorkoutReport, normalizeProposalExercise, normalizeProposalSets } from './proposal.js';

describe('looksLikeWorkoutReport', () => {
  it('should accept workout descriptions with digits or number words', () => {
    expect(looksLikeWorkoutReport('I did three sets of eight on bench with 60 kilos')).toBe(true);
    expect(looksLikeWorkoutReport('just finished squats: 100kg for 5, then 105 for 3')).toBe(true);
    expect(looksLikeWorkoutReport('did 4 sets of 10 pull ups')).toBe(true);
  });

  it('should reject questions and messages without numbers', () => {
    // Live model invented a workout log for this question before the guard existed
    expect(looksLikeWorkoutReport('which muscle group have I trained the least recently?')).toBe(false);
    expect(looksLikeWorkoutReport('how has my training been over the last 2 weeks?')).toBe(false);
    expect(looksLikeWorkoutReport('should I do 5x5 or 3x8')).toBe(false);
    expect(looksLikeWorkoutReport('great session at the gym')).toBe(false);
  });
});

// Argument payloads below were captured from the live Workers AI model
// (@cf/meta/llama-3.1-8b-instruct), including its quirks.

describe('normalizeProposalSets', () => {
  it('should expand set_count x uniform reps/weight', () => {
    const sets = normalizeProposalSets({
      exercise: 'bench press',
      set_count: 3,
      reps: 8,
      weight_kg: 60,
      sets: "[{'reps': 8, 'weight_kg': 60}, {'reps': 8, 'weight_kg': 60}, {'reps': 8, 'weight_kg': 60}]",
    });
    expect(sets).toEqual([
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 60 },
    ]);
  });

  it('should coerce numbers sent as strings and trust set_count over a collapsed sets array', () => {
    const sets = normalizeProposalSets({
      exercise: 'pull ups',
      set_count: '4',
      reps: '10',
      weight_kg: '0',
      sets: '[{"reps": 10, "weight_kg": 0}]',
    });
    expect(sets?.length).toBe(4);
    expect(sets?.[0]).toEqual({ reps: 10, weightKg: 0 });
  });

  it('should zip per-set lists sent as strings', () => {
    const sets = normalizeProposalSets({
      exercise: 'squats',
      set_count: 2,
      reps: '[5, 3]',
      weight_kg: '[100, 105]',
      sets: "[{'reps': 5, 'weight_kg': 100}, {'reps': 3, 'weight_kg': 105}]",
    });
    expect(sets).toEqual([
      { reps: 5, weightKg: 100 },
      { reps: 3, weightKg: 105 },
    ]);
  });

  it('should prefer a varied sets array over a reps list paired with a single weight', () => {
    const sets = normalizeProposalSets({
      exercise: 'squats',
      set_count: '2',
      reps: '[5, 3]',
      weight_kg: '100',
      sets: "[{'reps': 5, 'weight_kg': 100}, {'reps': 3, 'weight_kg': 105}]",
    });
    expect(sets).toEqual([
      { reps: 5, weightKg: 100 },
      { reps: 3, weightKg: 105 },
    ]);
  });

  it('should fall back to a Python-quoted sets array when no flat fields are given', () => {
    const sets = normalizeProposalSets({ exercise: 'squats', sets: "[{'reps': 5, 'weight_kg': 100}]" });
    expect(sets).toEqual([{ reps: 5, weightKg: 100 }]);
  });

  it('should default a missing weight to bodyweight and a missing set_count to one set', () => {
    expect(normalizeProposalSets({ exercise: 'dips', reps: 12 })).toEqual([{ reps: 12, weightKg: 0 }]);
  });

  it('should reject implausible or missing values', () => {
    expect(normalizeProposalSets({ exercise: 'squat', reps: 500, weight_kg: 100 })).toBe(null);
    expect(normalizeProposalSets({ exercise: 'squat', set_count: 50, reps: 5 })).toBe(null);
    expect(normalizeProposalSets({ exercise: 'squat', sets: [{ reps: 500, weight_kg: 100 }] })).toBe(null);
    expect(normalizeProposalSets({ exercise: 'squat', reps: 'lots' })).toBe(null);
    expect(normalizeProposalSets({ exercise: 'squat' })).toBe(null);
  });
});

describe('normalizeProposalExercise', () => {
  it('should trim and require a name', () => {
    expect(normalizeProposalExercise({ exercise: '  squats ' })).toBe('squats');
    expect(normalizeProposalExercise({ exercise: '' })).toBe(null);
    expect(normalizeProposalExercise({})).toBe(null);
  });
});

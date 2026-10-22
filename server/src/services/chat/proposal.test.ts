import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeWorkoutReport, normalizeProposalExercise, normalizeProposalSets } from './proposal.js';

describe('looksLikeWorkoutReport', () => {
  it('should accept workout descriptions with digits or number words', () => {
    assert.equal(looksLikeWorkoutReport('I did three sets of eight on bench with 60 kilos'), true);
    assert.equal(looksLikeWorkoutReport('just finished squats: 100kg for 5, then 105 for 3'), true);
    assert.equal(looksLikeWorkoutReport('did 4 sets of 10 pull ups'), true);
  });

  it('should reject questions and messages without numbers', () => {
    // Live model invented a workout log for this question before the guard existed
    assert.equal(looksLikeWorkoutReport('which muscle group have I trained the least recently?'), false);
    assert.equal(looksLikeWorkoutReport('how has my training been over the last 2 weeks?'), false);
    assert.equal(looksLikeWorkoutReport('should I do 5x5 or 3x8'), false);
    assert.equal(looksLikeWorkoutReport('great session at the gym'), false);
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
    assert.deepEqual(sets, [
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
    assert.equal(sets?.length, 4);
    assert.deepEqual(sets?.[0], { reps: 10, weightKg: 0 });
  });

  it('should zip per-set lists sent as strings', () => {
    const sets = normalizeProposalSets({
      exercise: 'squats',
      set_count: 2,
      reps: '[5, 3]',
      weight_kg: '[100, 105]',
      sets: "[{'reps': 5, 'weight_kg': 100}, {'reps': 3, 'weight_kg': 105}]",
    });
    assert.deepEqual(sets, [
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
    assert.deepEqual(sets, [
      { reps: 5, weightKg: 100 },
      { reps: 3, weightKg: 105 },
    ]);
  });

  it('should fall back to a Python-quoted sets array when no flat fields are given', () => {
    const sets = normalizeProposalSets({ exercise: 'squats', sets: "[{'reps': 5, 'weight_kg': 100}]" });
    assert.deepEqual(sets, [{ reps: 5, weightKg: 100 }]);
  });

  it('should default a missing weight to bodyweight and a missing set_count to one set', () => {
    assert.deepEqual(normalizeProposalSets({ exercise: 'dips', reps: 12 }), [{ reps: 12, weightKg: 0 }]);
  });

  it('should reject implausible or missing values', () => {
    assert.equal(normalizeProposalSets({ exercise: 'squat', reps: 500, weight_kg: 100 }), null);
    assert.equal(normalizeProposalSets({ exercise: 'squat', set_count: 50, reps: 5 }), null);
    assert.equal(normalizeProposalSets({ exercise: 'squat', sets: [{ reps: 500, weight_kg: 100 }] }), null);
    assert.equal(normalizeProposalSets({ exercise: 'squat', reps: 'lots' }), null);
    assert.equal(normalizeProposalSets({ exercise: 'squat' }), null);
  });
});

describe('normalizeProposalExercise', () => {
  it('should trim and require a name', () => {
    assert.equal(normalizeProposalExercise({ exercise: '  squats ' }), 'squats');
    assert.equal(normalizeProposalExercise({ exercise: '' }), null);
    assert.equal(normalizeProposalExercise({}), null);
  });
});

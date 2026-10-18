import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, signupSchema } from './auth.schema.js';
import { createWorkoutSchema, setInputSchema, updateSetSchema } from './workouts.schema.js';
import { createExerciseSchema } from './exercises.schema.js';

describe('Auth Schemas Validation', () => {
  it('should accept valid login credentials', () => {
    const valid = { email: 'athlete@gymtrack.io', password: 'secretpassword123' };
    const result = loginSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('should reject invalid email formats', () => {
    const invalid = { email: 'not-an-email', password: 'secretpassword123' };
    const result = loginSchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /valid email/i);
    }
  });

  it('should reject passwords shorter than 4 characters', () => {
    const invalid = { email: 'user@example.com', password: '12' };
    const result = signupSchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /at least 4 characters/i);
    }
  });
});

describe('Workout Schemas Validation', () => {
  it('should coerce and validate numeric sets properly', () => {
    const rawSet = { reps: '10', weightKg: '80.5' };
    const parsed = setInputSchema.safeParse(rawSet);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.reps, 10);
      assert.equal(parsed.data.weightKg, 80.5);
    }
  });

  it('should reject negative reps and negative weights', () => {
    const invalidReps = setInputSchema.safeParse({ reps: 0, weightKg: 50 });
    assert.equal(invalidReps.success, false);

    const invalidWeight = setInputSchema.safeParse({ reps: 10, weightKg: -5 });
    assert.equal(invalidWeight.success, false);
  });

  it('should enforce date format YYYY-MM-DD on workout creation', () => {
    const validWorkout = {
      date: '2026-10-18',
      muscleGroup: 'Chest',
      exercise: 'Bench Press',
      notes: 'Felt strong today',
      sets: [{ reps: 8, weightKg: 100 }],
    };
    const validResult = createWorkoutSchema.safeParse(validWorkout);
    assert.equal(validResult.success, true);

    const invalidDate = {
      ...validWorkout,
      date: '18-10-2026', // wrong date format
    };
    const invalidResult = createWorkoutSchema.safeParse(invalidDate);
    assert.equal(invalidResult.success, false);
  });

  it('should require at least one set in a new workout', () => {
    const noSets = {
      date: '2026-10-18',
      muscleGroup: 'Back',
      exercise: 'Deadlift',
      sets: [],
    };
    const result = createWorkoutSchema.safeParse(noSets);
    assert.equal(result.success, false);
  });

  it('should allow partial updates on setSchema', () => {
    const partialUpdate = { reps: 12 };
    const result = updateSetSchema.safeParse(partialUpdate);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.reps, 12);
      assert.equal(result.data.weightKg, undefined);
    }
  });
});

describe('Exercise Schemas Validation', () => {
  it('should trim whitespace and provide default equipment', () => {
    const rawExercise = {
      name: '  Overhead Press  ',
      muscleGroup: 'Shoulders',
      notes: 'Standing strict press',
    };
    const result = createExerciseSchema.safeParse(rawExercise);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.name, 'Overhead Press');
      assert.equal(result.data.equipment, 'Other'); // default value
    }
  });

  it('should reject exercises with names shorter than 2 characters', () => {
    const result = createExerciseSchema.safeParse({
      name: 'A',
      muscleGroup: 'Chest',
    });
    assert.equal(result.success, false);
  });
});


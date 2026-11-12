import { loginSchema, signupSchema } from './auth.schema.js';
import { createWorkoutSchema, setInputSchema, updateSetSchema } from './workouts.schema.js';
import { createExerciseSchema } from './exercises.schema.js';
import { chatMessageSchema } from './chat.schema.js';

describe('Chat Schema Validation', () => {
  it('should accept a message with the client date and trim whitespace', () => {
    const result = chatMessageSchema.safeParse({ message: '  bench 3x8 60kg  ', today: '2026-10-23' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe('bench 3x8 60kg');
  });

  it('should reject empty, oversized, or undated messages', () => {
    expect(chatMessageSchema.safeParse({ message: '   ', today: '2026-10-23' }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ message: 'x'.repeat(501), today: '2026-10-23' }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ message: 'hi' }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ message: 'hi', today: '23/10/2026' }).success).toBe(false);
  });
});

describe('Auth Schemas Validation', () => {
  it('should accept valid login credentials', () => {
    const valid = { email: 'athlete@gymtrack.io', password: 'secretpassword123' };
    const result = loginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email formats', () => {
    const invalid = { email: 'not-an-email', password: 'secretpassword123' };
    const result = loginSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/valid email/i);
    }
  });

  it('should reject passwords shorter than 4 characters', () => {
    const invalid = { email: 'user@example.com', password: '12' };
    const result = signupSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/at least 4 characters/i);
    }
  });
});

describe('Workout Schemas Validation', () => {
  it('should coerce and validate numeric sets properly', () => {
    const rawSet = { reps: '10', weightKg: '80.5' };
    const parsed = setInputSchema.safeParse(rawSet);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reps).toBe(10);
      expect(parsed.data.weightKg).toBe(80.5);
    }
  });

  it('should reject negative reps and negative weights', () => {
    const invalidReps = setInputSchema.safeParse({ reps: 0, weightKg: 50 });
    expect(invalidReps.success).toBe(false);

    const invalidWeight = setInputSchema.safeParse({ reps: 10, weightKg: -5 });
    expect(invalidWeight.success).toBe(false);
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
    expect(validResult.success).toBe(true);

    const invalidDate = {
      ...validWorkout,
      date: '18-10-2026', // wrong date format
    };
    const invalidResult = createWorkoutSchema.safeParse(invalidDate);
    expect(invalidResult.success).toBe(false);
  });

  it('should require at least one set in a new workout', () => {
    const noSets = {
      date: '2026-10-18',
      muscleGroup: 'Back',
      exercise: 'Deadlift',
      sets: [],
    };
    const result = createWorkoutSchema.safeParse(noSets);
    expect(result.success).toBe(false);
  });

  it('should allow partial updates on setSchema', () => {
    const partialUpdate = { reps: 12 };
    const result = updateSetSchema.safeParse(partialUpdate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reps).toBe(12);
      expect(result.data.weightKg).toBe(undefined);
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
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Overhead Press');
      expect(result.data.equipment).toBe('Other'); // default value
    }
  });

  it('should reject exercises with names shorter than 2 characters', () => {
    const result = createExerciseSchema.safeParse({
      name: 'A',
      muscleGroup: 'Chest',
    });
    expect(result.success).toBe(false);
  });
});


import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, shiftDate } from './intents.js';
import { matchExercise } from './exerciseMatch.js';

const ctx = { today: '2026-10-22' };

describe('parseIntent - LOG_WORKOUT', () => {
  it('should parse "<exercise> <sets>x<reps> <weight>kg"', () => {
    assert.deepEqual(parseIntent('bench 3x8 60kg', ctx), {
      type: 'LOG_WORKOUT',
      exercise: 'bench',
      sets: [
        { reps: 8, weightKg: 60 },
        { reps: 8, weightKg: 60 },
        { reps: 8, weightKg: 60 },
      ],
    });
  });

  it('should accept prefixes, @, and decimal weights', () => {
    const intent = parseIntent('Log squat 5x5 @ 102.5', ctx);
    assert.equal(intent?.type, 'LOG_WORKOUT');
    if (intent?.type === 'LOG_WORKOUT') {
      assert.equal(intent.exercise, 'squat');
      assert.equal(intent.sets.length, 5);
      assert.equal(intent.sets[0].weightKg, 102.5);
    }
  });

  it('should parse "N sets of M at W" phrasing', () => {
    const intent = parseIntent('deadlift 3 sets of 5 at 140kg', ctx);
    assert.ok(intent?.type === 'LOG_WORKOUT');
    assert.deepEqual(intent.sets[0], { reps: 5, weightKg: 140 });
  });

  it('should parse weight-first phrasing', () => {
    const intent = parseIntent('incline db press 30kg 4x10', ctx);
    assert.ok(intent?.type === 'LOG_WORKOUT');
    assert.equal(intent.exercise, 'incline db press');
    assert.deepEqual(intent.sets[3], { reps: 10, weightKg: 30 });
  });

  it('should treat a missing weight as bodyweight (0 kg)', () => {
    const intent = parseIntent('pull-ups 3x10', ctx);
    assert.ok(intent?.type === 'LOG_WORKOUT');
    assert.equal(intent.sets[0].weightKg, 0);
  });

  it('should convert lbs to kg', () => {
    const intent = parseIntent('bench 3x5 225lbs', ctx);
    assert.ok(intent?.type === 'LOG_WORKOUT');
    assert.equal(intent.sets[0].weightKg, 102.1);
  });

  it('should reject implausible numbers so the LLM can handle them', () => {
    assert.equal(parseIntent('bench 50x8 60kg', ctx), null);
    assert.equal(parseIntent('squat 3x5 5000kg', ctx), null);
  });

  it('should prefer logging over date questions', () => {
    const intent = parseIntent('log bench 3x8 60kg today', ctx);
    assert.ok(intent?.type === 'LOG_WORKOUT');
    assert.equal(intent.exercise, 'bench');
    assert.equal(parseIntent('bench 3x8 today', ctx)?.type, 'LOG_WORKOUT');
  });
});

describe('parseIntent - questions', () => {
  it('should resolve today and yesterday from the client date', () => {
    assert.deepEqual(parseIntent('what did I do today?', ctx), { type: 'WORKOUTS_ON_DATE', date: '2026-10-22' });
    assert.deepEqual(parseIntent("show yesterday's workout", ctx), { type: 'WORKOUTS_ON_DATE', date: '2026-10-21' });
    assert.deepEqual(parseIntent('workouts on 2026-10-01', ctx), { type: 'WORKOUTS_ON_DATE', date: '2026-10-01' });
  });

  it('should parse personal best questions', () => {
    assert.deepEqual(parseIntent("What's my best squat?", ctx), { type: 'PERSONAL_BEST', exercise: 'squat' });
    assert.deepEqual(parseIntent('pr bench', ctx), { type: 'PERSONAL_BEST', exercise: 'bench' });
    assert.deepEqual(parseIntent('deadlift max', ctx), { type: 'PERSONAL_BEST', exercise: 'deadlift' });
  });

  it('should distinguish muscle groups from exercises for last workout', () => {
    assert.deepEqual(parseIntent('last chest workout', ctx), { type: 'LAST_WORKOUT', muscleGroup: 'Chest' });
    assert.deepEqual(parseIntent('when did I last train legs', ctx), { type: 'LAST_WORKOUT', muscleGroup: 'Legs' });
    assert.deepEqual(parseIntent('last time I did squats', ctx), { type: 'LAST_WORKOUT', exercise: 'squats' });
  });

  it('should recognise greetings and help', () => {
    assert.deepEqual(parseIntent('Hey!', ctx), { type: 'GREETING' });
    assert.deepEqual(parseIntent('what can you do?', ctx), { type: 'HELP' });
  });

  it('should return null for open-ended questions (LLM fallback)', () => {
    assert.equal(parseIntent('why has my squat stalled for 3 weeks?', ctx), null);
    assert.equal(parseIntent('suggest a shoulder-friendly push day', ctx), null);
    assert.equal(parseIntent('', ctx), null);
  });
});

describe('shiftDate', () => {
  it('should cross month boundaries', () => {
    assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
  });
});

describe('matchExercise', () => {
  const library = [
    'Barbell Bench Press',
    'Close-Grip Bench Press',
    'Deadlift',
    'Romanian Deadlift',
    'Barbell Squat',
    'Pull-Up',
    'Incline Dumbbell Press',
  ];

  it('should resolve short names and aliases to library names', () => {
    assert.equal(matchExercise('bench', { history: [], library }), 'Barbell Bench Press');
    assert.equal(matchExercise('squats', { history: [], library }), 'Barbell Squat');
    assert.equal(matchExercise('rdl', { history: [], library }), 'Romanian Deadlift');
    assert.equal(matchExercise('pullups', { history: [], library }), 'Pull-Up');
    assert.equal(matchExercise('pull ups', { history: [], library }), 'Pull-Up'); // seen from the live model
    assert.equal(matchExercise('incline db press', { history: [], library }), 'Incline Dumbbell Press');
  });

  it('should prefer an exact match over a longer one', () => {
    assert.equal(matchExercise('deadlift', { history: [], library }), 'Deadlift');
  });

  it("should prefer the user's own history on ambiguity", () => {
    assert.equal(matchExercise('bench', { history: ['Close-Grip Bench Press'], library }), 'Close-Grip Bench Press');
  });

  it('should return null when nothing contains every word', () => {
    assert.equal(matchExercise('zercher squat', { history: [], library }), null);
  });
});

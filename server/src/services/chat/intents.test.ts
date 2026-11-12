import { parseIntent, shiftDate } from './intents.js';
import { matchExercise } from './exerciseMatch.js';

const ctx = { today: '2026-10-22' };

describe('parseIntent - LOG_WORKOUT', () => {
  it('should parse "<exercise> <sets>x<reps> <weight>kg"', () => {
    expect(parseIntent('bench 3x8 60kg', ctx)).toEqual({
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
    expect(intent?.type).toBe('LOG_WORKOUT');
    if (intent?.type === 'LOG_WORKOUT') {
      expect(intent.exercise).toBe('squat');
      expect(intent.sets.length).toBe(5);
      expect(intent.sets[0].weightKg).toBe(102.5);
    }
  });

  it('should parse "N sets of M at W" phrasing', () => {
    const intent = parseIntent('deadlift 3 sets of 5 at 140kg', ctx);
    if (intent?.type !== 'LOG_WORKOUT') throw new Error('expected a LOG_WORKOUT intent');
    expect(intent.sets[0]).toEqual({ reps: 5, weightKg: 140 });
  });

  it('should parse weight-first phrasing', () => {
    const intent = parseIntent('incline db press 30kg 4x10', ctx);
    if (intent?.type !== 'LOG_WORKOUT') throw new Error('expected a LOG_WORKOUT intent');
    expect(intent.exercise).toBe('incline db press');
    expect(intent.sets[3]).toEqual({ reps: 10, weightKg: 30 });
  });

  it('should treat a missing weight as bodyweight (0 kg)', () => {
    const intent = parseIntent('pull-ups 3x10', ctx);
    if (intent?.type !== 'LOG_WORKOUT') throw new Error('expected a LOG_WORKOUT intent');
    expect(intent.sets[0].weightKg).toBe(0);
  });

  it('should convert lbs to kg', () => {
    const intent = parseIntent('bench 3x5 225lbs', ctx);
    if (intent?.type !== 'LOG_WORKOUT') throw new Error('expected a LOG_WORKOUT intent');
    expect(intent.sets[0].weightKg).toBe(102.1);
  });

  it('should reject implausible numbers so the LLM can handle them', () => {
    expect(parseIntent('bench 50x8 60kg', ctx)).toBe(null);
    expect(parseIntent('squat 3x5 5000kg', ctx)).toBe(null);
  });

  it('should prefer logging over date questions', () => {
    const intent = parseIntent('log bench 3x8 60kg today', ctx);
    if (intent?.type !== 'LOG_WORKOUT') throw new Error('expected a LOG_WORKOUT intent');
    expect(intent.exercise).toBe('bench');
    expect(parseIntent('bench 3x8 today', ctx)?.type).toBe('LOG_WORKOUT');
  });
});

describe('parseIntent - questions', () => {
  it('should resolve today and yesterday from the client date', () => {
    expect(parseIntent('what did I do today?', ctx)).toEqual({ type: 'WORKOUTS_ON_DATE', date: '2026-10-22' });
    expect(parseIntent("show yesterday's workout", ctx)).toEqual({ type: 'WORKOUTS_ON_DATE', date: '2026-10-21' });
    expect(parseIntent('workouts on 2026-10-01', ctx)).toEqual({ type: 'WORKOUTS_ON_DATE', date: '2026-10-01' });
  });

  it('should treat a bare date as a workouts-on-date question', () => {
    // From real use: "yesterday" alone went to the LLM, which leaked tool-call text
    expect(parseIntent('yesterday', ctx)).toEqual({ type: 'WORKOUTS_ON_DATE', date: '2026-10-21' });
    expect(parseIntent('and today?', ctx)).toEqual({ type: 'WORKOUTS_ON_DATE', date: '2026-10-22' });
    expect(parseIntent('yesterday workouts', ctx)).toEqual({ type: 'WORKOUTS_ON_DATE', date: '2026-10-21' });
  });

  it('should understand day-of-month and month-name dates', () => {
    const on = (text: string) => (parseIntent(text, ctx) as { date?: string } | null)?.date;
    expect(on('ok workouts done in 17 of this month')).toBe('2026-10-17'); // from real use
    expect(on('on the 17th')).toBe('2026-10-17');
    expect(on('what did I do on oct 17')).toBe('2026-10-17');
    expect(on('workouts 17 october')).toBe('2026-10-17');
    expect(on('show 17/10')).toBe('2026-10-17');
  });

  it('should never resolve a yearless date into the future', () => {
    const on = (text: string) => (parseIntent(text, ctx) as { date?: string } | null)?.date;
    expect(on('on the 25th')).toBe('2026-09-25'); // the 25th hasn't happened yet this month
    expect(on('workouts on dec 3')).toBe('2025-12-03');
    expect(on('on the 31st')).toBe('2026-08-31'); // September has no 31st, so the most recent one is August's
    expect(parseIntent('on the 5th', { today: '2026-01-03' }) && (parseIntent('on the 5th', { today: '2026-01-03' }) as { date: string }).date).toBe('2025-12-05');
  });

  it('should leave invalid dates and non-date questions to the LLM', () => {
    expect(parseIntent('show 31/02', ctx)).toBe(null);
    expect(parseIntent('why was my squat weak yesterday', ctx)).toBe(null);
  });

  it('should parse personal best questions', () => {
    expect(parseIntent("What's my best squat?", ctx)).toEqual({ type: 'PERSONAL_BEST', exercise: 'squat' });
    expect(parseIntent('pr bench', ctx)).toEqual({ type: 'PERSONAL_BEST', exercise: 'bench' });
    expect(parseIntent('deadlift max', ctx)).toEqual({ type: 'PERSONAL_BEST', exercise: 'deadlift' });
  });

  it('should distinguish muscle groups from exercises for last workout', () => {
    expect(parseIntent('last chest workout', ctx)).toEqual({ type: 'LAST_WORKOUT', muscleGroup: 'Chest' });
    expect(parseIntent('when did I last train legs', ctx)).toEqual({ type: 'LAST_WORKOUT', muscleGroup: 'Legs' });
    expect(parseIntent('last time I did squats', ctx)).toEqual({ type: 'LAST_WORKOUT', exercise: 'squats' });
  });

  it('should recognise greetings and help', () => {
    expect(parseIntent('Hey!', ctx)).toEqual({ type: 'GREETING' });
    expect(parseIntent('what can you do?', ctx)).toEqual({ type: 'HELP' });
  });

  it('should return null for open-ended questions (LLM fallback)', () => {
    expect(parseIntent('why has my squat stalled for 3 weeks?', ctx)).toBe(null);
    expect(parseIntent('suggest a shoulder-friendly push day', ctx)).toBe(null);
    expect(parseIntent('', ctx)).toBe(null);
  });
});

describe('shiftDate', () => {
  it('should cross month boundaries', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31');
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
    expect(matchExercise('bench', { history: [], library })).toBe('Barbell Bench Press');
    expect(matchExercise('squats', { history: [], library })).toBe('Barbell Squat');
    expect(matchExercise('rdl', { history: [], library })).toBe('Romanian Deadlift');
    expect(matchExercise('pullups', { history: [], library })).toBe('Pull-Up');
    expect(matchExercise('pull ups', { history: [], library })).toBe('Pull-Up'); // seen from the live model
    expect(matchExercise('incline db press', { history: [], library })).toBe('Incline Dumbbell Press');
  });

  it('should prefer an exact match over a longer one', () => {
    expect(matchExercise('deadlift', { history: [], library })).toBe('Deadlift');
  });

  it("should prefer the user's own history on ambiguity", () => {
    expect(matchExercise('bench', { history: ['Close-Grip Bench Press'], library })).toBe('Close-Grip Bench Press');
  });

  it('should return null when nothing contains every word', () => {
    expect(matchExercise('zercher squat', { history: [], library })).toBe(null);
  });
});

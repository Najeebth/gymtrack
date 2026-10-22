/**
 * Rule-based intent parser: the free, instant "flow" layer of the chatbot.
 * Pure functions with no DB/LLM access. Returns null when no rule matches,
 * which tells the chat service to fall back to the LLM.
 */

export interface ParsedSet {
  reps: number;
  weightKg: number;
}

export type Intent =
  | { type: 'GREETING' }
  | { type: 'HELP' }
  | { type: 'LOG_WORKOUT'; exercise: string; sets: ParsedSet[] }
  | { type: 'WORKOUTS_ON_DATE'; date: string }
  | { type: 'PERSONAL_BEST'; exercise: string }
  | { type: 'LAST_WORKOUT'; exercise: string }
  | { type: 'LAST_WORKOUT'; muscleGroup: string };

export interface IntentContext {
  /** The user's local date (YYYY-MM-DD). The client sends it because "today" depends on their timezone. */
  today: string;
}

const LIMITS = { maxSets: 20, maxReps: 100, maxWeightKg: 1000 };
const LBS_TO_KG = 0.453592;

const MUSCLE_GROUP_ALIASES: Record<string, string> = {
  chest: 'Chest', pecs: 'Chest',
  back: 'Back', lats: 'Back',
  legs: 'Legs', leg: 'Legs', quads: 'Legs', hamstrings: 'Legs',
  shoulders: 'Shoulders', shoulder: 'Shoulders', delts: 'Shoulders',
  arms: 'Arms', arm: 'Arms', biceps: 'Arms', triceps: 'Arms',
  core: 'Core', abs: 'Core',
};

export function resolveMuscleGroup(text: string): string | null {
  return MUSCLE_GROUP_ALIASES[text.trim().toLowerCase()] ?? null;
}

export function parseIntent(input: string, ctx: IntentContext): Intent | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
  if (!text) return null;

  if (/^(hi|hello|hey|yo|hola|namaste)( there)?$/.test(text)) return { type: 'GREETING' };
  if (/^(help|commands|what can you do)$/.test(text)) return { type: 'HELP' };

  // Order matters: logging is checked before date questions so
  // "log bench 3x8 today" is a log, not "show today's workouts".
  return parseLogWorkout(text) ?? parseWorkoutsOnDate(text, ctx) ?? parsePersonalBest(text) ?? parseLastWorkout(text);
}

// --- LOG_WORKOUT -----------------------------------------------------------

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const UNIT = String.raw`(kg|kgs|lb|lbs)?`;
const PREFIX = String.raw`^(?:log|add|i did|did)?\s*`;

// Checked in order; the first match wins.
const LOG_PATTERNS: { re: RegExp; pick: (m: RegExpMatchArray) => [string, string, string, string?, string?] }[] = [
  // "bench 60kg 3x8": weight first. Must run before the next pattern, whose
  // lazy exercise group would otherwise swallow "60kg" into the name.
  {
    re: new RegExp(`${PREFIX}(.+?) ${NUM} ?(kg|kgs|lb|lbs) (\\d+) ?[x×*] ?(\\d+)$`),
    pick: (m) => [m[1], m[4], m[5], m[2], m[3]],
  },
  // "bench 3x8 60kg", "log squat 5x5 @ 100", "pull-ups 3x10"
  {
    re: new RegExp(`${PREFIX}(.+?) (\\d+) ?[x×*] ?(\\d+)(?: ?(?:@|at|with)? ?${NUM} ?${UNIT})?$`),
    pick: (m) => [m[1], m[2], m[3], m[4], m[5]],
  },
  // "deadlift 3 sets of 5 at 140kg"
  {
    re: new RegExp(`${PREFIX}(.+?) (\\d+) sets? (?:of|x) (\\d+)(?: reps?)?(?: ?(?:@|at|with) ?${NUM} ?${UNIT})?$`),
    pick: (m) => [m[1], m[2], m[3], m[4], m[5]],
  },
];

function parseLogWorkout(text: string): Intent | null {
  // Workouts are logged for today anyway, so a trailing "today" carries no information
  const withoutToday = text.replace(/ today$/, '');

  for (const { re, pick } of LOG_PATTERNS) {
    const match = withoutToday.match(re);
    if (!match) continue;

    const [rawExercise, rawSets, rawReps, rawWeight, unit] = pick(match);
    const exercise = rawExercise.replace(/ for$/, '').trim();
    if (!/[a-z]/.test(exercise)) return null;

    const sets = Number(rawSets);
    const reps = Number(rawReps);
    let weightKg = rawWeight ? Number(rawWeight) : 0; // no weight = bodyweight
    if (unit?.startsWith('lb')) weightKg = Math.round(weightKg * LBS_TO_KG * 10) / 10;

    // Implausible numbers are more likely a misparse than a real workout: let the LLM handle it
    if (sets < 1 || sets > LIMITS.maxSets || reps < 1 || reps > LIMITS.maxReps || weightKg > LIMITS.maxWeightKg) {
      return null;
    }

    return {
      type: 'LOG_WORKOUT',
      exercise,
      sets: Array.from({ length: sets }, () => ({ reps, weightKg })),
    };
  }
  return null;
}

// --- WORKOUTS_ON_DATE -------------------------------------------------------

function parseWorkoutsOnDate(text: string, ctx: IntentContext): Intent | null {
  const dateMatch = text.match(/\b(today|yesterday|\d{4}-\d{2}-\d{2})\b/);
  if (!dateMatch) return null;
  if (!/\b(workouts?|did|do|train(ed)?|lift(ed)?|show|session|log)\b|today's|yesterday's/.test(text)) return null;

  const word = dateMatch[1];
  const date = word === 'today' ? ctx.today : word === 'yesterday' ? shiftDate(ctx.today, -1) : word;
  return { type: 'WORKOUTS_ON_DATE', date };
}

export function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// --- PERSONAL_BEST ----------------------------------------------------------

function parsePersonalBest(text: string): Intent | null {
  const match =
    text.match(/^(?:what(?:'s| is) my )?(?:best|pr|max|heaviest|personal (?:best|record)) (?:on |for |in )?(.+)$/) ??
    text.match(/^(?:my )?(.+?) (?:pr|max|personal best|personal record)$/);
  if (!match) return null;
  return { type: 'PERSONAL_BEST', exercise: match[1].trim() };
}

// --- LAST_WORKOUT -----------------------------------------------------------

function parseLastWorkout(text: string): Intent | null {
  const match =
    text.match(/^(?:my |show (?:me )?(?:my )?)?last (.+?) (?:workout|session|day)$/) ??
    text.match(/^when did i last (?:do|train|hit|work) (?:on )?(.+)$/) ??
    text.match(/^last time i (?:did|trained) (.+)$/);
  if (!match) return null;

  const target = match[1].trim();
  const muscleGroup = resolveMuscleGroup(target);
  return muscleGroup ? { type: 'LAST_WORKOUT', muscleGroup } : { type: 'LAST_WORKOUT', exercise: target };
}

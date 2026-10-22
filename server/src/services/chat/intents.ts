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

const ACTIVITY_WORDS = /\b(workouts?|did|do|done|train(ed)?|lift(ed)?|show|sessions?|log(ged)?)\b/;
// Words that add nothing beyond "show me workouts on <date>"
const FILLER_WORDS =
  /\b(ok|okay|so|and|what|whats|about|how|on|the|in|of|for|this|month|show|me|my|i|did|do|done|workouts?|sessions?|trained|train|lifted|lift|log|logged|day|was|there|any)\b/g;

function parseWorkoutsOnDate(text: string, ctx: IntentContext): Intent | null {
  const found = extractDate(text, ctx.today);
  if (!found) return null;

  // A bare date ("yesterday", "on the 17th") or a date plus an activity word.
  // Anything else ("why was my squat weak yesterday") is a question for the LLM.
  const rest = text
    .replace(found.match, ' ')
    .replace(/'s\b/g, ' ')
    .replace(FILLER_WORDS, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (rest && !ACTIVITY_WORDS.test(text)) return null;

  return { type: 'WORKOUTS_ON_DATE', date: found.date };
}

const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MONTH_PREFIXES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ORDINAL = '(?:st|nd|rd|th)';

/**
 * Finds a calendar date in the text, resolved against the user's local date.
 * Dates without a year mean the most recent such day (never the future):
 * "the 25th" said on Oct 22 is Sep 25.
 */
export function extractDate(text: string, today: string): { date: string; match: string } | null {
  const [year, month, day] = today.split('-').map(Number);
  let m: RegExpMatchArray | null;

  if ((m = text.match(/\b\d{4}-\d{2}-\d{2}\b/))) return { date: m[0], match: m[0] };
  if ((m = text.match(/\btoday\b/))) return { date: today, match: m[0] };
  if ((m = text.match(/\byesterday\b/))) return { date: shiftDate(today, -1), match: m[0] };

  const resolve = (d: number, monthIndex: number, match: string) => {
    let candidate = isoDate(year, monthIndex, d);
    if (candidate && candidate > today) candidate = isoDate(year - 1, monthIndex, d);
    return candidate ? { date: candidate, match } : null;
  };
  const monthIndex = (name: string) => MONTH_PREFIXES.indexOf(name.slice(0, 3));

  // "17 oct", "17th of october"
  if ((m = text.match(new RegExp(`\\b(\\d{1,2})${ORDINAL}?(?: of)? ${MONTH}\\b`)))) return resolve(+m[1], monthIndex(m[2]), m[0]);
  // "oct 17", "october 17th"
  if ((m = text.match(new RegExp(`\\b${MONTH} (\\d{1,2})${ORDINAL}?\\b`)))) return resolve(+m[2], monthIndex(m[1]), m[0]);
  // "17/10", "17-10": day first, like the app's dd-mm-yyyy date inputs
  if ((m = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/))) return resolve(+m[1], +m[2] - 1, m[0]);
  // "17th", "on the 17th", "17 of this month": this month, or last month if that day hasn't come yet
  if ((m = text.match(new RegExp(`\\b(\\d{1,2})${ORDINAL}\\b`)) ?? text.match(/\b(\d{1,2})(?: of)? this month\b/))) {
    const d = +m[1];
    if (d < 1 || d > 31) return null;
    // Step back month by month to the most recent month that has this day
    // ("the 31st" on Oct 22 skips 30-day September and lands on Aug 31)
    for (let back = d <= day ? 0 : 1; back <= 12; back++) {
      const total = year * 12 + (month - 1) - back;
      const candidate = isoDate(Math.floor(total / 12), total % 12, d);
      if (candidate) return { date: candidate, match: m[0] };
    }
  }
  return null;
}

/** YYYY-MM-DD for a real calendar day (monthIndex 0-11), or null ("31/02"). */
function isoDate(year: number, monthIndex: number, day: number): string | null {
  if (monthIndex < 0 || monthIndex > 11 || day < 1) return null;
  const d = new Date(Date.UTC(year, monthIndex, day));
  if (d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return null;
  return d.toISOString().split('T')[0];
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

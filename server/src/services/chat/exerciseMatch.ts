/**
 * Resolves what the user typed ("bench", "rdl", "pullups") to a known
 * exercise name ("Barbell Bench Press", "Romanian Deadlift", "Pull-Up").
 * Pure: the caller supplies candidate names.
 */

const ALIASES: Record<string, string> = {
  bench: 'bench press',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  pullup: 'pull up',
  pullups: 'pull up',
  chinup: 'chin up',
  pushup: 'push up',
  pushups: 'push up',
  db: 'dumbbell',
  bb: 'barbell',
  lat: 'lat pulldown',
};

function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .flatMap((t) => (ALIASES[t] ?? t).split(' '))
    // "squats" -> "squat", "ups" -> "up"; "press" keeps its "ss". Safe because
    // queries and exercise names go through the same normalization.
    .map((t) => (t.length >= 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
  return [...new Set(tokens)]; // "bench press" -> alias expands "bench" to "bench press" again
}

export interface ExerciseCandidates {
  /** Names the user has actually logged before: preferred on ambiguity. */
  history: string[];
  /** Public library + the user's custom exercises. */
  library: string[];
}

/**
 * Returns the best candidate containing every word the user typed, or null.
 * Ranking: exact match > user's history > library; shortest name breaks ties
 * ("bench" -> "Barbell Bench Press", not "Close-Grip Bench Press").
 */
export function matchExercise(query: string, candidates: ExerciseCandidates): string | null {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return null;
  const queryKey = [...queryTokens].sort().join(' ');

  const matches = (names: string[]) =>
    names
      .filter((name) => {
        const nameTokens = tokenize(name);
        return queryTokens.every((t) => nameTokens.includes(t));
      })
      .sort((a, b) => a.length - b.length);

  const historyMatches = matches(candidates.history);
  const libraryMatches = matches(candidates.library);

  const exact = [...historyMatches, ...libraryMatches].find(
    (name) => [...tokenize(name)].sort().join(' ') === queryKey
  );

  return exact ?? historyMatches[0] ?? libraryMatches[0] ?? null;
}

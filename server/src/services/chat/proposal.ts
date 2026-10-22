import { z } from 'zod';
import type { LlmTool } from '../../lib/llm.js';
import type { ParsedSet } from './intents.js';

/**
 * The LLM's propose_workout_log tool. Small models are unreliable with nested
 * arrays of objects (they collapse "3 sets" into one entry, or emit
 * Python-style quotes), so the schema leads with flat scalar fields and every
 * shape observed from the live model is normalized here.
 */
export const PROPOSE_WORKOUT_TOOL: LlmTool = {
  name: 'propose_workout_log',
  description: 'Propose logging a workout the user did. The user must confirm before it is saved.',
  parameters: {
    type: 'object',
    properties: {
      exercise: { type: 'string', description: 'Exercise name' },
      set_count: { type: 'integer', description: 'Number of sets' },
      reps: { type: 'integer', description: 'Reps per set' },
      weight_kg: { type: 'number', description: 'Weight per set in kg, 0 for bodyweight' },
      sets: { type: 'array', description: 'Only if sets differ: one {reps, weight_kg} per set', items: { type: 'object' } },
    },
    required: ['exercise'],
  },
};

const MAX_SETS = 20;

const NUMBER_WORDS =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozen)\b/;
const QUESTION_START = /^(what|which|how|when|why|who|where|should|can|could|would|is|are|am|do|does)\b/;

/**
 * Whether a message could be someone reporting a workout. Only then is
 * propose_workout_log offered to the model: in live testing the small model
 * otherwise "proposed" invented workouts in reply to plain questions.
 * A report always carries numbers (sets/reps/weight) and isn't a question.
 */
export function looksLikeWorkoutReport(message: string): boolean {
  const text = message.trim().toLowerCase();
  const hasNumbers = /\d/.test(text) || NUMBER_WORDS.test(text);
  const isQuestion = text.endsWith('?') || QUESTION_START.test(text);
  return hasNumbers && !isQuestion;
}

const setSchema = z.object({
  reps: z.coerce.number().int().min(1).max(100),
  weightKg: z.coerce.number().min(0).max(1000),
});

/** Parses JSON that may arrive as a string, including Python-style 'single quotes'. */
function parseLoose(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!/^[[{]/.test(trimmed)) return value; // plain scalar like "10": leave for z.coerce
  for (const candidate of [trimmed, trimmed.replace(/'/g, '"')]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  return value;
}

function validSets(candidate: unknown[] | null): ParsedSet[] | null {
  if (!candidate || candidate.length === 0 || candidate.length > MAX_SETS) return null;
  const parsed = z.array(setSchema).safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Turns the model's arguments into validated sets, or null if they can't be trusted.
 *
 * The model often repeats the same workout across several fields with a
 * mistake in one of them (e.g. reps as a list but a single weight, while the
 * sets array is right), so the most specific self-consistent field wins:
 *   1. the sets array, when it matches set_count or its sets differ
 *   2. per-set lists in reps / weight_kg ("100kg for 5, then 105 for 3")
 *   3. set_count × uniform reps / weight_kg
 *   4. any valid sets array
 */
export function normalizeProposalSets(args: Record<string, unknown>): ParsedSet[] | null {
  const reps = parseLoose(args.reps);
  const weight = parseLoose(args.weight_kg) ?? 0;
  const rawSets = parseLoose(args.sets);
  const setCount = args.set_count === undefined ? undefined : Number(args.set_count);

  const fromSetsArray = validSets(
    Array.isArray(rawSets)
      ? rawSets.map((s) => {
          const entry = (s ?? {}) as Record<string, unknown>;
          return { reps: entry.reps, weightKg: entry.weight_kg ?? entry.weightKg ?? 0 };
        })
      : null
  );
  const setsVary = fromSetsArray?.some((s) => s.reps !== fromSetsArray[0].reps || s.weightKg !== fromSetsArray[0].weightKg);
  if (fromSetsArray && (fromSetsArray.length === setCount || setsVary)) return fromSetsArray;

  if (Array.isArray(reps)) {
    const fromLists = validSets(reps.map((r, i) => ({ reps: r, weightKg: Array.isArray(weight) ? weight[i] : weight })));
    if (fromLists) return fromLists;
  }

  if (reps !== undefined && !Array.isArray(reps) && !Array.isArray(weight)) {
    const count = setCount ?? 1;
    if (Number.isInteger(count) && count >= 1 && count <= MAX_SETS) {
      const uniform = validSets(Array.from({ length: count }, () => ({ reps, weightKg: weight })));
      if (uniform) return uniform;
    }
  }

  return fromSetsArray;
}

export function normalizeProposalExercise(args: Record<string, unknown>): string | null {
  const parsed = z.string().trim().min(1).max(100).safeParse(args.exercise);
  return parsed.success ? parsed.data : null;
}

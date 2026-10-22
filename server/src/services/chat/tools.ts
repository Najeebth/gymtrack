import { z } from 'zod';
import type { LlmTool, LlmToolCall } from '../../lib/llm.js';
import { workoutsService, type WorkoutsService } from '../workouts.service.js';
import { exercisesService, type ExercisesService } from '../exercises.service.js';
import { matchExercise, type ExerciseCandidates } from './exerciseMatch.js';
import { resolveMuscleGroup, shiftDate } from './intents.js';

/**
 * Read-only data access for the chatbot, shared by the rule-based intents and
 * the LLM. The userId comes from the authenticated request (scope), never from
 * model output, so a manipulated prompt can't read another user's data.
 */

export interface ToolScope {
  userId: string;
  /** The user's local date (YYYY-MM-DD), for relative dates like "yesterday". */
  today: string;
}

export interface ChatToolDeps {
  workouts: Pick<
    WorkoutsService,
    'listWorkouts' | 'listWorkoutsSince' | 'listLoggedExerciseNames' | 'getPersonalBest' | 'getLastWorkout'
  >;
  exercises: Pick<ExercisesService, 'listExerciseIndex'>;
}

const defaultDeps: ChatToolDeps = { workouts: workoutsService, exercises: exercisesService };

interface WorkoutLike {
  date: string;
  exercise: string;
  muscleGroup: string;
  sets: { reps: number; weightKg: number }[];
}

/** "60kg×8, 60kg×8, BW×10": compact to keep LLM prompts (and tokens) small. */
export function formatSets(sets: { reps: number; weightKg: number }[]): string {
  return sets.map((s) => `${s.weightKg > 0 ? `${s.weightKg}kg` : 'BW'}×${s.reps}`).join(', ');
}

export function summarizeWorkout(w: WorkoutLike) {
  return { date: w.date, exercise: w.exercise, muscleGroup: w.muscleGroup, sets: formatSets(w.sets) };
}

export type WorkoutSummary = ReturnType<typeof summarizeWorkout>;

const MAX_RECENT_WORKOUTS = 40;

export class ChatTools {
  private lookup?: Promise<{ candidates: ExerciseCandidates; index: { name: string; muscleGroup: string }[] }>;

  constructor(
    private readonly scope: ToolScope,
    private readonly deps: ChatToolDeps = defaultDeps
  ) {}

  /** Loaded once per chat request and only when a lookup actually needs it. */
  private getLookup() {
    this.lookup ??= Promise.all([
      this.deps.workouts.listLoggedExerciseNames(this.scope.userId),
      this.deps.exercises.listExerciseIndex(this.scope.userId),
    ]).then(([history, index]) => ({ candidates: { history, library: index.map((e) => e.name) }, index }));
    return this.lookup;
  }

  /** "bench" -> "Barbell Bench Press"; null when nothing known matches. */
  async resolveExercise(query: string): Promise<string | null> {
    return matchExercise(query, (await this.getLookup()).candidates);
  }

  /** Muscle group from the library, else from the last time the user logged it. */
  async muscleGroupFor(exercise: string): Promise<string | null> {
    const { index } = await this.getLookup();
    const fromLibrary = index.find((e) => e.name.toLowerCase() === exercise.toLowerCase());
    if (fromLibrary) return fromLibrary.muscleGroup;
    const last = await this.deps.workouts.getLastWorkout(this.scope.userId, { exercise });
    return last?.muscleGroup ?? null;
  }

  async workoutsOnDate(date: string): Promise<WorkoutSummary[]> {
    const workouts = await this.deps.workouts.listWorkouts(this.scope.userId, date);
    return workouts.map(summarizeWorkout);
  }

  async personalBest(query: string) {
    const exercise = (await this.resolveExercise(query)) ?? query;
    const best = await this.deps.workouts.getPersonalBest(this.scope.userId, exercise);
    if (!best) return { found: false as const, exercise };
    return { found: true as const, exercise: best.workout.exercise, weightKg: best.weightKg, reps: best.reps, date: best.workout.date };
  }

  async lastWorkout(filter: { exercise: string } | { muscleGroup: string }) {
    const resolved =
      'exercise' in filter ? { exercise: (await this.resolveExercise(filter.exercise)) ?? filter.exercise } : filter;
    const workout = await this.deps.workouts.getLastWorkout(this.scope.userId, resolved);
    return workout ? { found: true as const, workout: summarizeWorkout(workout) } : { found: false as const, ...resolved };
  }

  async recentTraining(days: number) {
    const since = shiftDate(this.scope.today, -(days - 1));
    const workouts = await this.deps.workouts.listWorkoutsSince(this.scope.userId, since);
    return {
      since,
      totalWorkouts: workouts.length,
      workouts: workouts.slice(0, MAX_RECENT_WORKOUTS).map(summarizeWorkout),
      truncated: workouts.length > MAX_RECENT_WORKOUTS,
    };
  }

  /**
   * Runs a tool the LLM asked for. Model output is untrusted input, so
   * arguments are validated with Zod; failures return an error object the
   * model can read instead of throwing.
   */
  async execute(call: LlmToolCall): Promise<unknown> {
    const tool = TOOL_ARGS[call.name as ToolName];
    if (!tool) return { error: `Unknown tool: ${call.name}` };

    const parsed = tool.safeParse(call.arguments);
    if (!parsed.success) {
      return { error: `Invalid arguments for ${call.name}: ${parsed.error.issues.map((i) => i.message).join('; ')}` };
    }

    switch (call.name as ToolName) {
      case 'list_workouts_on_date': {
        const { date } = parsed.data as z.infer<typeof TOOL_ARGS.list_workouts_on_date>;
        const resolved = date === 'today' ? this.scope.today : date === 'yesterday' ? shiftDate(this.scope.today, -1) : date;
        return { date: resolved, workouts: await this.workoutsOnDate(resolved) };
      }
      case 'get_personal_best': {
        const { exercise } = parsed.data as z.infer<typeof TOOL_ARGS.get_personal_best>;
        return this.personalBest(exercise);
      }
      case 'get_last_workout': {
        const args = parsed.data as z.infer<typeof TOOL_ARGS.get_last_workout>;
        const muscleGroup = args.muscle_group ? resolveMuscleGroup(args.muscle_group) ?? args.muscle_group : null;
        return this.lastWorkout(muscleGroup ? { muscleGroup } : { exercise: args.exercise! });
      }
      case 'get_recent_training': {
        const { days } = parsed.data as z.infer<typeof TOOL_ARGS.get_recent_training>;
        return this.recentTraining(days);
      }
    }
  }
}

const TOOL_ARGS = {
  list_workouts_on_date: z.object({
    date: z.union([z.literal('today'), z.literal('yesterday'), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  }),
  get_personal_best: z.object({ exercise: z.string().trim().min(1).max(100) }),
  get_last_workout: z
    .object({
      exercise: z.string().trim().min(1).max(100).optional(),
      muscle_group: z.string().trim().min(1).max(30).optional(),
    })
    .refine((a) => a.exercise || a.muscle_group, { message: 'exercise or muscle_group is required' }),
  get_recent_training: z.object({ days: z.coerce.number().int().min(1).max(90).default(14) }),
};

type ToolName = keyof typeof TOOL_ARGS;

/** Tool descriptions sent to the LLM. Keep them short: they cost tokens on every call. */
export const CHAT_TOOLS: LlmTool[] = [
  {
    name: 'list_workouts_on_date',
    description: "List the user's logged workouts on one date.",
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, "today" or "yesterday"' } },
      required: ['date'],
    },
  },
  {
    name: 'get_personal_best',
    description: "Get the user's heaviest logged set for an exercise.",
    parameters: {
      type: 'object',
      properties: { exercise: { type: 'string', description: 'Exercise name, e.g. "bench press"' } },
      required: ['exercise'],
    },
  },
  {
    name: 'get_last_workout',
    description: "Get the user's most recent workout for an exercise or a muscle group.",
    parameters: {
      type: 'object',
      properties: {
        exercise: { type: 'string', description: 'Exercise name' },
        muscle_group: { type: 'string', description: 'Chest, Back, Legs, Shoulders, Arms or Core' },
      },
    },
  },
  {
    name: 'get_recent_training',
    description: "Get all of the user's workouts from the last N days, for progress or trend questions.",
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'How many days back, 1-90 (default 14)' } },
    },
  },
];

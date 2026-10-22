import type { ChatMessage, ChatRole, ChatSource, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { dbTrace } from '../../lib/dbTrace.js';
import { CHAT_LLM_DAILY_LIMIT } from '../../config/env.js';
import { getLlmProvider, llmTrace, LlmError, type LlmMessage, type LlmProvider } from '../../lib/llm.js';
import { parseIntent, shiftDate, type Intent, type ParsedSet } from './intents.js';
import { ChatTools, CHAT_TOOLS, formatSets, type ToolScope } from './tools.js';
import { tryConsumeLlmQuota } from './llmQuota.js';
import {
  PROPOSE_WORKOUT_TOOL,
  looksLikeWorkoutReport,
  normalizeProposalExercise,
  normalizeProposalSets,
} from './proposal.js';

/**
 * Chatbot orchestration: rule-based intents first (free, instant), the LLM
 * with read-only tools for everything else, and a canned fallback when the
 * LLM is unconfigured, over quota, or failing.
 *
 * The bot never writes workouts. Logging returns a CREATE_WORKOUT draft that
 * the client confirms and saves through the normal (offline-capable) API.
 */

export interface WorkoutDraft {
  date: string;
  exercise: string;
  muscleGroup: string;
  sets: ParsedSet[];
}

export type ChatAction = { type: 'CREATE_WORKOUT'; draft: WorkoutDraft };

interface AssistantReply {
  content: string;
  source: ChatSource;
  action?: ChatAction;
}

const HISTORY_LIMIT = 10;
const MAX_TOOL_ROUNDS = 3;
const MAX_TOOL_CALLS_PER_ROUND = 3;

// --- Persistence -------------------------------------------------------------

export interface ChatStore {
  /** The user's latest messages in chronological order. */
  recentMessages(userId: string, limit: number): Promise<ChatMessage[]>;
  saveMessage(
    userId: string,
    data: { role: ChatRole; content: string; source?: ChatSource; action?: ChatAction }
  ): Promise<ChatMessage>;
  clear(userId: string): Promise<number>;
}

export const prismaChatStore: ChatStore = {
  async recentMessages(userId, limit) {
    const newestFirst = await dbTrace(`findMany ChatMessage (last ${limit})`, () =>
      prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
    );
    return newestFirst.reverse();
  },
  async saveMessage(userId, data) {
    return dbTrace(`create ChatMessage (${data.role})`, () =>
      prisma.chatMessage.create({
        data: {
          userId,
          role: data.role,
          content: data.content,
          source: data.source,
          action: data.action as unknown as Prisma.InputJsonValue | undefined,
        },
      })
    );
  },
  async clear(userId) {
    const result = await dbTrace('deleteMany ChatMessage', () => prisma.chatMessage.deleteMany({ where: { userId } }));
    return result.count;
  },
};

// --- Copy ----------------------------------------------------------------------

const EXAMPLES = [
  '• "bench 3x8 60kg": log a workout',
  '• "what did I do today?"',
  '• "best squat" / "pr bench"',
  '• "last chest workout"',
];

const REPLIES = {
  greeting: 'Hey! Log a workout like "bench 3x8 60kg" or ask "what did I do today?"',
  help: ['Here is what I can do:', ...EXAMPLES].join('\n'),
  notUnderstood: ["I didn't catch that. Try:", ...EXAMPLES].join('\n'),
  quota: "I've hit today's AI limit, but quick commands still work:\n" + EXAMPLES.join('\n'),
  timeout: 'The AI is taking too long right now. Try again in a moment, or use a quick command like "best squat".',
  unavailable: 'The AI is unavailable right now. Quick commands like "bench 3x8 60kg" still work.',
  badProposal: 'I couldn\'t work out the sets. Try the quick format: "bench 3x8 60kg".',
};

function systemPrompt(today: string, canPropose: boolean): string {
  return [
    `You are the training assistant inside GymTrack, a personal workout log. Today is ${today}. Weights are in kg.`,
    'Reply in at most 4 short sentences, in plain language. Never write tool names or JSON in your reply.',
    "For anything about the user's own training, call a tool. Never invent numbers, dates or workouts.",
    'After a tool returns data, answer with the actual exercises, sets and weights from it.',
    'For advice on what to train next, first call get_recent_training and suggest muscle groups the user has not trained recently.',
    // Only mention the logging tool when it is offered: naming an unavailable tool
    // made the model print "propose_workout_log ..." as plain text
    ...(canPropose
      ? ['If the user describes a workout they did, call propose_workout_log. It only shows a confirm button; nothing is saved until they confirm.']
      : []),
    'You may answer general training questions from knowledge. For pain or injury, suggest seeing a professional.',
    'Use the earlier conversation to understand short follow-ups. If a message is still unclear, ask one short clarifying question.',
    'Politely decline requests clearly unrelated to training.',
  ].join('\n');
}

const PLAIN_ANSWER_NUDGE = 'Answer the user in plain sentences using the information above. Do not write tool names, function calls or JSON.';

const TOOL_NAMES = [...CHAT_TOOLS, PROPOSE_WORKOUT_TOOL].map((t) => t.name);

/**
 * Small models sometimes write a tool call as text ("propose_workout_log 2026-10-22")
 * instead of making one. Such replies are never shown, saved, or fed back as history.
 */
export function looksLikeLeakedToolCall(text: string): boolean {
  const trimmed = text.trim();
  return TOOL_NAMES.some((name) => trimmed.includes(name)) || /^[[{]/.test(trimmed) || /<\/?(tool|function)/i.test(trimmed);
}

// --- Service -------------------------------------------------------------------

export interface ChatServiceDeps {
  store: ChatStore;
  getLlm: () => LlmProvider | null;
  consumeQuota: (userId: string) => Promise<boolean>;
  createTools: (scope: ToolScope) => ChatTools;
}

const defaultDeps: ChatServiceDeps = {
  store: prismaChatStore,
  getLlm: getLlmProvider,
  consumeQuota: (userId) => tryConsumeLlmQuota(userId, CHAT_LLM_DAILY_LIMIT),
  createTools: (scope) => new ChatTools(scope),
};

export class ChatService {
  constructor(private readonly deps: ChatServiceDeps = defaultDeps) {}

  async listHistory(userId: string, limit = 50) {
    return this.deps.store.recentMessages(userId, limit);
  }

  async clearHistory(userId: string) {
    return this.deps.store.clear(userId);
  }

  /**
   * Handles one user message and returns both persisted messages.
   * `today` is the client's local date, used for "today"/"yesterday".
   */
  async send(userId: string, message: string, today: string) {
    // Read history before saving, so the new message isn't duplicated in the LLM prompt
    const history = await this.deps.store.recentMessages(userId, HISTORY_LIMIT);
    const userMessage = await this.deps.store.saveMessage(userId, { role: 'USER', content: message });

    const tools = this.deps.createTools({ userId, today });
    const intent = parseIntent(message, { today });
    const reply = intent
      ? await this.handleIntent(intent, tools, today)
      : await this.askLlm(userId, message, history, tools, today);

    const assistantMessage = await this.deps.store.saveMessage(userId, { role: 'ASSISTANT', ...reply });
    return { userMessage, assistantMessage };
  }

  // --- Rule path ---------------------------------------------------------------

  private async handleIntent(intent: Intent, tools: ChatTools, today: string): Promise<AssistantReply> {
    const rule = (content: string, action?: ChatAction): AssistantReply => ({ content, source: 'RULE', action });

    switch (intent.type) {
      case 'GREETING':
        return rule(REPLIES.greeting);

      case 'HELP':
        return rule(REPLIES.help);

      case 'LOG_WORKOUT': {
        const { content, action } = await this.buildWorkoutDraft(tools, intent.exercise, intent.sets, today);
        return rule(content, action);
      }

      case 'WORKOUTS_ON_DATE': {
        const workouts = await tools.workoutsOnDate(intent.date);
        const label = dateLabel(intent.date, today);
        if (workouts.length === 0) return rule(`No workouts logged ${label}.`);
        const lines = workouts.map((w) => `• ${w.exercise}: ${w.sets}`);
        return rule([`${capitalize(label)}:`, ...lines].join('\n'));
      }

      case 'PERSONAL_BEST': {
        const best = await tools.personalBest(intent.exercise);
        if (!best.found) return rule(`No ${best.exercise} logged yet.`);
        const load = best.weightKg > 0 ? `${best.weightKg}kg` : 'bodyweight';
        return rule(`Your best ${best.exercise}: ${load} × ${best.reps} (${dateLabel(best.date, today)}).`);
      }

      case 'LAST_WORKOUT': {
        const result = await tools.lastWorkout('muscleGroup' in intent ? { muscleGroup: intent.muscleGroup } : { exercise: intent.exercise });
        if (!result.found) {
          const target = 'muscleGroup' in result ? `${result.muscleGroup} workouts` : result.exercise;
          return rule(`No ${target} logged yet.`);
        }
        const w = result.workout;
        return rule(`Last time (${dateLabel(w.date, today)}): ${w.exercise}: ${w.sets}`);
      }
    }
  }

  /** Shared by the rule path and the LLM's propose_workout_log tool. */
  private async buildWorkoutDraft(tools: ChatTools, rawExercise: string, sets: ParsedSet[], today: string) {
    const resolved = await tools.resolveExercise(rawExercise);
    const exercise = resolved ?? capitalizeWords(rawExercise);
    const muscleGroup = (await tools.muscleGroupFor(exercise)) ?? 'General';
    const isNew = resolved ? '' : ' (new exercise)';

    return {
      content: `Log ${exercise}${isNew}: ${formatSets(sets)}?`,
      action: { type: 'CREATE_WORKOUT' as const, draft: { date: today, exercise, muscleGroup, sets } },
    };
  }

  // --- LLM path ----------------------------------------------------------------

  private async askLlm(
    userId: string,
    message: string,
    history: ChatMessage[],
    tools: ChatTools,
    today: string
  ): Promise<AssistantReply> {
    const fallback = (content: string): AssistantReply => ({ content, source: 'FALLBACK' });

    const llm = this.deps.getLlm();
    if (!llm) return fallback(REPLIES.notUnderstood);

    // One unit of quota per user message, however many tool rounds it takes
    if (!(await this.deps.consumeQuota(userId))) return fallback(REPLIES.quota);

    // Questions never get the logging tool, so the model can't "propose" an invented workout
    const canPropose = looksLikeWorkoutReport(message);
    const toolset = canPropose ? [...CHAT_TOOLS, PROPOSE_WORKOUT_TOOL] : CHAT_TOOLS;

    // Canned fallbacks and leaked tool-call text are noise the model would imitate
    const usefulHistory = history.filter(
      (m) => m.role === 'USER' || (m.source !== 'FALLBACK' && !looksLikeLeakedToolCall(m.content))
    );

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt(today, canPropose) },
      ...usefulHistory.map((m): LlmMessage => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: message },
    ];

    let nudged = false;

    try {
      for (let round = 1; round <= MAX_TOOL_ROUNDS + 1; round++) {
        // The final round (and a retry after leaked text) offers no tools, forcing a plain answer
        const offerTools = round <= MAX_TOOL_ROUNDS && !nudged;
        const result = await llmTrace(`${llm.name} round ${round}`, () =>
          llm.chat({ messages, tools: offerTools ? toolset : undefined })
        );

        if (result.toolCalls.length === 0) {
          if (!result.text) return fallback(REPLIES.notUnderstood);
          if (!looksLikeLeakedToolCall(result.text)) return { content: result.text, source: 'LLM' };
          // Retry once without tools; a second leak gives the canned reply instead of garbage
          if (nudged || round > MAX_TOOL_ROUNDS) return fallback(REPLIES.notUnderstood);
          nudged = true;
          messages.push({ role: 'system', content: PLAIN_ANSWER_NUDGE });
          continue;
        }

        // propose_workout_log is handled here, not in ChatTools: it ends the turn
        // with an action for the client instead of reading data
        // A proposal only counts if the tool was offered; otherwise it falls through
        // to tools.execute as an unknown tool, and the model is told so
        const proposal = toolset.includes(PROPOSE_WORKOUT_TOOL)
          ? result.toolCalls.find((c) => c.name === PROPOSE_WORKOUT_TOOL.name)
          : undefined;
        if (proposal) {
          const exercise = normalizeProposalExercise(proposal.arguments);
          const sets = normalizeProposalSets(proposal.arguments);
          if (!exercise || !sets) return fallback(REPLIES.badProposal);
          const { content, action } = await this.buildWorkoutDraft(tools, exercise, sets, today);
          return { content, source: 'LLM', action };
        }

        // Record what the model asked for, then feed each tool's result back to it
        const calls = result.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND);
        messages.push({ role: 'assistant', content: JSON.stringify(calls) });
        for (const call of calls) {
          const output = await tools.execute(call);
          messages.push({ role: 'tool', name: call.name, content: JSON.stringify(output) });
        }
      }
      return fallback(REPLIES.notUnderstood);
    } catch (err) {
      if (!(err instanceof LlmError)) throw err;
      console.warn(`[Chat] LLM ${err.reason}: ${err.message}`);
      if (err.reason === 'QUOTA') return fallback(REPLIES.quota);
      if (err.reason === 'TIMEOUT') return fallback(REPLIES.timeout);
      return fallback(REPLIES.unavailable);
    }
  }
}

function dateLabel(date: string, today: string): string {
  if (date === today) return 'today';
  if (date === shiftDate(today, -1)) return 'yesterday';
  return `on ${date}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function capitalizeWords(text: string): string {
  return text.trim().split(/\s+/).map(capitalize).join(' ');
}

export const chatService = new ChatService();

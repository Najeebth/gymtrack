import type { ChatMessage } from '@prisma/client';
import { redis } from '../../lib/redis.js';
import { LlmError, type LlmChatRequest, type LlmChatResult, type LlmProvider } from '../../lib/llm.js';
import { ChatService, type ChatServiceDeps, type ChatStore } from './chat.service.js';
import { ChatTools, type ChatToolDeps } from './tools.js';

afterAll(() => {
  redis?.disconnect();
});

const TODAY = '2026-10-22';

const benchWorkout = {
  date: '2026-10-20',
  exercise: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  sets: [{ reps: 6, weightKg: 62.5 }],
};

const toolDeps = {
  workouts: {
    listWorkouts: async () => [benchWorkout],
    listWorkoutsSince: async () => [benchWorkout],
    listLoggedExerciseNames: async () => ['Barbell Bench Press'],
    getPersonalBest: async (_userId: string, exercise: string) =>
      exercise === 'Barbell Bench Press' ? { reps: 6, weightKg: 62.5, workout: { date: '2026-10-20', exercise } } : null,
    getLastWorkout: async () => null,
  },
  exercises: {
    listExerciseIndex: async () => [
      { name: 'Barbell Bench Press', muscleGroup: 'Chest' },
      { name: 'Barbell Squat', muscleGroup: 'Legs' },
    ],
  },
} as unknown as ChatToolDeps;

function memoryStore(seed: Partial<ChatMessage>[] = []): ChatStore & { saved: ChatMessage[] } {
  const saved = seed.map((m, i) => ({ id: `seed-${i}`, source: null, action: null, createdAt: new Date(), userId: 'u1', ...m }) as ChatMessage);
  return {
    saved,
    async recentMessages(_userId, limit) {
      return saved.slice(-limit);
    },
    async saveMessage(userId, data) {
      const msg = { id: `m${saved.length}`, userId, createdAt: new Date(), source: null, action: null, ...data } as ChatMessage;
      saved.push(msg);
      return msg;
    },
    async clear() {
      const n = saved.length;
      saved.length = 0;
      return n;
    },
  };
}

/** Fake LLM that replays scripted results and records every request. */
function scriptedLlm(script: (LlmChatResult | Error)[]): LlmProvider & { requests: LlmChatRequest[] } {
  const requests: LlmChatRequest[] = [];
  return {
    name: 'fake',
    requests,
    async chat(request) {
      requests.push(structuredClone(request));
      const next = script.shift();
      if (!next) throw new Error('LLM called more times than scripted');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

function service(overrides: Partial<ChatServiceDeps> = {}) {
  const store = memoryStore();
  const deps: ChatServiceDeps = {
    store,
    getLlm: () => null,
    consumeQuota: async () => true,
    createTools: (scope) => new ChatTools(scope, toolDeps),
    ...overrides,
  };
  return { chat: new ChatService(deps), store: (overrides.store as ReturnType<typeof memoryStore>) ?? store };
}

describe('ChatService - rule path', () => {
  it('should answer rule intents without calling the LLM', async () => {
    const llm = scriptedLlm([]);
    const { chat, store } = service({ getLlm: () => llm });

    const { assistantMessage } = await chat.send('u1', 'pr bench', TODAY);

    expect(assistantMessage.source).toBe('RULE');
    expect(assistantMessage.content).toBe('Your best Barbell Bench Press: 62.5kg × 6 (on 2026-10-20).');
    expect(llm.requests.length).toBe(0);
    expect(store.saved.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
  });

  it('should turn a log command into a confirmable draft, not a saved workout', async () => {
    const { chat } = service();
    const { assistantMessage } = await chat.send('u1', 'bench 2x8 60kg', TODAY);

    expect(assistantMessage.content).toBe('Log Barbell Bench Press: 60kg×8, 60kg×8?');
    expect(assistantMessage.action).toEqual({
      type: 'CREATE_WORKOUT',
      draft: {
        date: TODAY,
        exercise: 'Barbell Bench Press',
        muscleGroup: 'Chest',
        sets: [
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
        ],
      },
    });
  });

  it('should flag unknown exercises as new and default the muscle group', async () => {
    const { chat } = service();
    const { assistantMessage } = await chat.send('u1', 'zercher squat 3x5 80kg', TODAY);
    expect(assistantMessage.content).toMatch(/^Log Zercher Squat \(new exercise\)/);
    expect((assistantMessage.action as { draft: { muscleGroup: string } }).draft.muscleGroup).toBe('General');
  });
});

describe('ChatService - LLM path', () => {
  it('should fall back when no LLM is configured', async () => {
    const { chat } = service();
    const { assistantMessage } = await chat.send('u1', 'why has my squat stalled?', TODAY);
    expect(assistantMessage.source).toBe('FALLBACK');
    expect(assistantMessage.content).toMatch(/didn't catch that/);
  });

  it('should not call the LLM once the daily quota is used up', async () => {
    const llm = scriptedLlm([]);
    const { chat } = service({ getLlm: () => llm, consumeQuota: async () => false });
    const { assistantMessage } = await chat.send('u1', 'why has my squat stalled?', TODAY);
    expect(assistantMessage.source).toBe('FALLBACK');
    expect(assistantMessage.content).toMatch(/AI limit/);
    expect(llm.requests.length).toBe(0);
  });

  it('should run a tool call and feed the result back to the model', async () => {
    const llm = scriptedLlm([
      { text: '', toolCalls: [{ name: 'get_personal_best', arguments: { exercise: 'bench' } }] },
      { text: 'Your bench PR is 62.5kg for 6. Nice work!', toolCalls: [] },
    ]);
    const { chat } = service({ getLlm: () => llm });

    const { assistantMessage } = await chat.send('u1', 'how strong is my bench these days?', TODAY);

    expect(assistantMessage.source).toBe('LLM');
    expect(assistantMessage.content).toBe('Your bench PR is 62.5kg for 6. Nice work!');
    const toolMessage = llm.requests[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.name).toBe('get_personal_best');
    expect(toolMessage!.content).toMatch(/"weightKg":62.5/);
  });

  it('should include system prompt, prior history and the new message', async () => {
    const llm = scriptedLlm([{ text: 'Sure.', toolCalls: [] }]);
    const store = memoryStore([
      { role: 'USER', content: 'hi' },
      { role: 'ASSISTANT', content: 'Hey!' },
    ]);
    const { chat } = service({ getLlm: () => llm, store });

    await chat.send('u1', 'tell me about deloads', TODAY);

    const roles = llm.requests[0].messages.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    expect(llm.requests[0].messages[0].content).toMatch(/Today is 2026-10-22/);
    expect(llm.requests[0].messages.at(-1)?.content).toBe('tell me about deloads');
  });

  it('should turn propose_workout_log into a draft action', async () => {
    const llm = scriptedLlm([
      {
        text: '',
        toolCalls: [{ name: 'propose_workout_log', arguments: { exercise: 'squats', sets: [{ reps: 5, weight_kg: 100 }] } }],
      },
    ]);
    const { chat } = service({ getLlm: () => llm });

    const { assistantMessage } = await chat.send('u1', 'just did five squats with a hundred kilos', TODAY);

    expect(assistantMessage.source).toBe('LLM');
    expect(assistantMessage.content).toBe('Log Barbell Squat: 100kg×5?');
    expect((assistantMessage.action as { type: string }).type).toBe('CREATE_WORKOUT');
  });

  it('should reject invalid proposals from the model', async () => {
    const llm = scriptedLlm([
      { text: '', toolCalls: [{ name: 'propose_workout_log', arguments: { exercise: 'squat', sets: [{ reps: 500, weight_kg: 100 }] } }] },
    ]);
    const { chat } = service({ getLlm: () => llm });
    const { assistantMessage } = await chat.send('u1', 'did squats, like 500 reps at 100', TODAY);
    expect(assistantMessage.source).toBe('FALLBACK');
    expect(assistantMessage.action).toBe(null);
  });

  it('should not offer or accept the logging tool for questions', async () => {
    // Live model once answered this question by proposing an invented workout
    const llm = scriptedLlm([
      { text: '', toolCalls: [{ name: 'propose_workout_log', arguments: { exercise: 'curl', reps: 12 } }] },
      { text: 'You trained arms least recently.', toolCalls: [] },
    ]);
    const { chat } = service({ getLlm: () => llm });

    const { assistantMessage } = await chat.send('u1', 'which muscle group have I trained the least recently?', TODAY);

    expect(!llm.requests[0].tools?.some((t) => t.name === 'propose_workout_log')).toBeTruthy();
    expect(assistantMessage.action).toBe(null);
    expect(assistantMessage.content).toBe('You trained arms least recently.');
    const toolResult = llm.requests[1].messages.find((m) => m.role === 'tool');
    expect(toolResult!.content).toMatch(/Unknown tool: propose_workout_log/);
  });

  it('should stop offering tools after the max number of rounds', async () => {
    const loopingCall = { text: '', toolCalls: [{ name: 'get_recent_training', arguments: { days: 7 } }] };
    const llm = scriptedLlm([loopingCall, loopingCall, loopingCall, { text: 'Here is a summary.', toolCalls: [] }]);
    const { chat } = service({ getLlm: () => llm });

    const { assistantMessage } = await chat.send('u1', 'summarise my week', TODAY);

    expect(assistantMessage.content).toBe('Here is a summary.');
    expect(llm.requests.length).toBe(4);
    expect(llm.requests[3].tools).toBe(undefined);
  });

  it('should retry without tools when the model writes a tool call as text', async () => {
    // From real use: the model replied with the literal text "propose_workout_log 2026-10-22"
    const llm = scriptedLlm([
      { text: 'propose_workout_log 2026-10-22', toolCalls: [] },
      { text: 'You had no workouts logged that day.', toolCalls: [] },
    ]);
    const { chat } = service({ getLlm: () => llm });

    const { assistantMessage } = await chat.send('u1', 'anything worth noting about my recovery', TODAY);

    expect(assistantMessage.content).toBe('You had no workouts logged that day.');
    expect(llm.requests[1].tools).toBe(undefined);
    expect(llm.requests[1].messages.at(-1)!.content).toMatch(/plain sentences/);
  });

  it('should never save leaked tool-call text, even after a retry', async () => {
    const llm = scriptedLlm([
      { text: 'propose_workout_log 2026-10-17', toolCalls: [] },
      { text: '{"name": "list_workouts_on_date"}', toolCalls: [] },
    ]);
    const { chat } = service({ getLlm: () => llm });
    const { assistantMessage } = await chat.send('u1', 'where are they', TODAY);
    expect(assistantMessage.source).toBe('FALLBACK');
    expect(assistantMessage.content).not.toMatch(/propose_workout_log|list_workouts_on_date/);
  });

  it('should keep fallbacks and leaked replies out of the history sent to the model', async () => {
    const llm = scriptedLlm([{ text: 'Sure.', toolCalls: [] }]);
    const store = memoryStore([
      { role: 'USER', content: 'yesterday' },
      { role: 'ASSISTANT', content: 'propose_workout_log 2026-10-22', source: 'LLM' },
      { role: 'USER', content: 'hmm' },
      { role: 'ASSISTANT', content: "I didn't catch that.", source: 'FALLBACK' },
      { role: 'USER', content: 'tell me about rest days' },
      { role: 'ASSISTANT', content: 'Rest days help recovery.', source: 'LLM' },
    ]);
    const { chat } = service({ getLlm: () => llm, store });

    await chat.send('u1', 'how many per week', TODAY);

    const sent = llm.requests[0].messages.map((m) => m.content);
    expect(!sent.some((c) => c.includes('propose_workout_log 2026'))).toBeTruthy();
    expect(!sent.includes("I didn't catch that.")).toBeTruthy();
    expect(sent.includes('Rest days help recovery.')).toBeTruthy();
  });

  it('should only mention the logging tool in the prompt when it is offered', async () => {
    const llm = scriptedLlm([
      { text: 'Rest 2-3 minutes.', toolCalls: [] },
      { text: '', toolCalls: [{ name: 'propose_workout_log', arguments: { exercise: 'squat', set_count: 3, reps: 5, weight_kg: 100 } }] },
    ]);
    const { chat } = service({ getLlm: () => llm });

    await chat.send('u1', 'how long should I rest between sets?', TODAY);
    await chat.send('u1', 'did 3 sets of 5 squats at 100', TODAY);

    expect(llm.requests[0].messages[0].content).not.toMatch(/propose_workout_log/);
    expect(llm.requests[1].messages[0].content).toMatch(/propose_workout_log/);
  });

  it('should map provider errors to friendly fallbacks', async () => {
    for (const [reason, pattern] of [
      ['QUOTA', /AI limit/],
      ['TIMEOUT', /taking too long/],
      ['HTTP', /unavailable/],
    ] as const) {
      const llm = scriptedLlm([new LlmError(reason, 'boom')]);
      const { chat } = service({ getLlm: () => llm });
      const { assistantMessage } = await chat.send('u1', 'why has my squat stalled?', TODAY);
      expect(assistantMessage.source).toBe('FALLBACK');
      expect(assistantMessage.content).toMatch(pattern);
    }
  });
});

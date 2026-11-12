import { LlmError, WorkersAiProvider, parseWorkersAiResult } from './llm.js';

// Awaits a promise that must reject with an LlmError carrying the given reason.
async function expectLlmError(promise: Promise<unknown>, reason: string) {
  const err = await promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(LlmError);
  expect((err as LlmError).reason).toBe(reason);
}

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
}

function provider(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new WorkersAiProvider({ accountId: 'acc', token: 'tok', model: '@cf/test/model', fetchImpl, timeoutMs });
}

const ask = { messages: [{ role: 'user' as const, content: 'hi' }] };

describe('Workers AI LLM adapter', () => {
  it('should return trimmed text from a successful response', async () => {
    const llm = provider(fakeFetch(200, { success: true, result: { response: '  Hello!  ' } }));
    const result = await llm.chat(ask);
    expect(result.text).toBe('Hello!');
    expect(result.toolCalls).toEqual([]);
  });

  it('should send tools in the OpenAI function format', async () => {
    let sentBody: any;
    const capturingFetch = (async (_url: string, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ success: true, result: { response: 'ok' } }), { status: 200 });
    }) as typeof fetch;
    const tool = { name: 'get_personal_best', description: 'PR', parameters: { type: 'object' as const, properties: {} } };

    await provider(capturingFetch).chat({ ...ask, tools: [tool] });
    expect(sentBody.tools).toEqual([{ type: 'function', function: tool }]);

    await provider(capturingFetch).chat(ask);
    expect(sentBody.tools).toBe(undefined);
  });

  it('should map HTTP 429 to a QUOTA error', async () => {
    const llm = provider(fakeFetch(429, { success: false, errors: [{ message: 'Too many requests' }] }));
    await expectLlmError(llm.chat(ask), 'QUOTA');
  });

  it('should map daily allocation errors to QUOTA even without a 429', async () => {
    const llm = provider(
      fakeFetch(400, { success: false, errors: [{ message: 'You have used up your daily free allocation' }] })
    );
    await expectLlmError(llm.chat(ask), 'QUOTA');
  });

  it('should map other failures to an HTTP error', async () => {
    const llm = provider(fakeFetch(500, { success: false, errors: [{ message: 'Internal error' }] }));
    await expectLlmError(llm.chat(ask), 'HTTP');
  });

  it('should map a slow provider to a TIMEOUT error', async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        // Reject with an error built inside the test sandbox. The DOMException that
        // AbortSignal.timeout() produces comes from Node's outer realm, so under Jest
        // it fails llm.ts's `err instanceof Error` check, which holds in production.
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }))
        );
      })) as typeof fetch;
    const llm = provider(hangingFetch, 20);
    await expectLlmError(llm.chat(ask), 'TIMEOUT');
  });
});

describe('parseWorkersAiResult', () => {
  it('should parse flat tool calls with object arguments', () => {
    const result = parseWorkersAiResult({
      response: '',
      tool_calls: [{ name: 'get_personal_best', arguments: { exercise: 'Squat' } }],
    });
    expect(result.toolCalls).toEqual([{ name: 'get_personal_best', arguments: { exercise: 'Squat' } }]);
  });

  it('should parse OpenAI-style tool calls with JSON string arguments', () => {
    const result = parseWorkersAiResult({
      tool_calls: [{ function: { name: 'list_workouts', arguments: '{"date":"2026-10-22"}' } }],
    });
    expect(result.toolCalls).toEqual([{ name: 'list_workouts', arguments: { date: '2026-10-22' } }]);
  });

  it('should read OpenAI-style choices when legacy fields are absent', () => {
    const result = parseWorkersAiResult({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ function: { name: 'get_personal_best', arguments: '{"exercise": "bench press"}' } }],
          },
        },
      ],
    });
    expect(result).toEqual({ text: '', toolCalls: [{ name: 'get_personal_best', arguments: { exercise: 'bench press' } }] });

    expect(parseWorkersAiResult({ choices: [{ message: { content: ' Hi ' } }] }).text).toBe('Hi');
  });

  it('should tolerate malformed arguments and nameless calls', () => {
    const result = parseWorkersAiResult({
      tool_calls: [{ name: 'list_workouts', arguments: '{not json' }, { arguments: {} }],
    });
    expect(result.toolCalls).toEqual([{ name: 'list_workouts', arguments: {} }]);
  });
});

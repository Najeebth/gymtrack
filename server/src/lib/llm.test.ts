import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LlmError, WorkersAiProvider, parseWorkersAiResult } from './llm.js';

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
    assert.equal(result.text, 'Hello!');
    assert.deepEqual(result.toolCalls, []);
  });

  it('should map HTTP 429 to a QUOTA error', async () => {
    const llm = provider(fakeFetch(429, { success: false, errors: [{ message: 'Too many requests' }] }));
    await assert.rejects(llm.chat(ask), (err) => err instanceof LlmError && err.reason === 'QUOTA');
  });

  it('should map daily allocation errors to QUOTA even without a 429', async () => {
    const llm = provider(
      fakeFetch(400, { success: false, errors: [{ message: 'You have used up your daily free allocation' }] })
    );
    await assert.rejects(llm.chat(ask), (err) => err instanceof LlmError && err.reason === 'QUOTA');
  });

  it('should map other failures to an HTTP error', async () => {
    const llm = provider(fakeFetch(500, { success: false, errors: [{ message: 'Internal error' }] }));
    await assert.rejects(llm.chat(ask), (err) => err instanceof LlmError && err.reason === 'HTTP');
  });

  it('should map a slow provider to a TIMEOUT error', async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      })) as typeof fetch;
    const llm = provider(hangingFetch, 20);
    await assert.rejects(llm.chat(ask), (err) => err instanceof LlmError && err.reason === 'TIMEOUT');
  });
});

describe('parseWorkersAiResult', () => {
  it('should parse flat tool calls with object arguments', () => {
    const result = parseWorkersAiResult({
      response: '',
      tool_calls: [{ name: 'get_personal_best', arguments: { exercise: 'Squat' } }],
    });
    assert.deepEqual(result.toolCalls, [{ name: 'get_personal_best', arguments: { exercise: 'Squat' } }]);
  });

  it('should parse OpenAI-style tool calls with JSON string arguments', () => {
    const result = parseWorkersAiResult({
      tool_calls: [{ function: { name: 'list_workouts', arguments: '{"date":"2026-10-22"}' } }],
    });
    assert.deepEqual(result.toolCalls, [{ name: 'list_workouts', arguments: { date: '2026-10-22' } }]);
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
    assert.deepEqual(result, { text: '', toolCalls: [{ name: 'get_personal_best', arguments: { exercise: 'bench press' } }] });

    assert.equal(parseWorkersAiResult({ choices: [{ message: { content: ' Hi ' } }] }).text, 'Hi');
  });

  it('should tolerate malformed arguments and nameless calls', () => {
    const result = parseWorkersAiResult({
      tool_calls: [{ name: 'list_workouts', arguments: '{not json' }, { arguments: {} }],
    });
    assert.deepEqual(result.toolCalls, [{ name: 'list_workouts', arguments: {} }]);
  });
});

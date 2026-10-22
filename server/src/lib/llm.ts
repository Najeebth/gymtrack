import { CF_ACCOUNT_ID, CF_AI_MODEL, CF_AI_TOKEN, isLlmConfigured } from '../config/env.js';
import { getCurrentTrace } from './asyncContext.js';
import { startStep, finishStep } from './requestTracker.js';

/**
 * Provider-agnostic LLM adapter. The chat service only depends on the
 * LlmProvider interface, so swapping Workers AI for Claude/OpenAI later means
 * adding one class here, not touching business logic.
 */

export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmMessage {
  role: LlmRole;
  content: string;
  /** Tool name, set on role: 'tool' messages that carry a tool result. */
  name?: string;
}

/** A function the model may ask us to run, described with JSON Schema. */
export interface LlmTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LlmToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmChatRequest {
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens?: number;
}

export interface LlmChatResult {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  readonly name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResult>;
}

export type LlmErrorReason = 'TIMEOUT' | 'QUOTA' | 'HTTP' | 'BAD_RESPONSE';

/** Thrown for any provider failure so callers can fall back with one catch. */
export class LlmError extends Error {
  constructor(public readonly reason: LlmErrorReason, message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface WorkersAiConfig {
  accountId: string;
  token: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Cloudflare Workers AI over its REST API:
 *   POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/{model}
 */
export class WorkersAiProvider implements LlmProvider {
  readonly name = 'workers-ai';
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: WorkersAiConfig) {
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResult> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run/${this.config.model}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: request.messages,
          ...(request.tools?.length ? { tools: request.tools } : {}),
          max_tokens: request.maxTokens ?? 300,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new LlmError('TIMEOUT', `Workers AI did not respond within ${this.timeoutMs}ms`);
      }
      throw new LlmError('HTTP', `Workers AI request failed: ${(err as Error).message}`);
    }

    const body = (await response.json().catch(() => null)) as WorkersAiResponse | null;

    if (!response.ok || !body?.success) {
      const detail = body?.errors?.map((e) => e.message).join('; ') || response.statusText;
      // Free-tier exhaustion surfaces as 429 or an "allocation" error message
      if (response.status === 429 || /allocation|quota|rate limit/i.test(detail)) {
        throw new LlmError('QUOTA', `Workers AI quota exhausted: ${detail}`);
      }
      throw new LlmError('HTTP', `Workers AI error ${response.status}: ${detail}`);
    }

    return parseWorkersAiResult(body.result);
  }
}

interface WorkersAiResponse {
  success: boolean;
  errors?: { message: string }[];
  result?: {
    response?: unknown;
    tool_calls?: RawToolCall[];
    // Newer models also return an OpenAI-style chat.completion body
    choices?: { message?: { content?: string | null; tool_calls?: RawToolCall[] } }[];
  };
}

// Models differ: some return { name, arguments }, others the OpenAI-style
// { function: { name, arguments } }, and arguments may be an object or a JSON string.
type RawToolCall = {
  name?: string;
  arguments?: unknown;
  function?: { name?: string; arguments?: unknown };
};

export function parseWorkersAiResult(result: WorkersAiResponse['result']): LlmChatResult {
  if (!result) throw new LlmError('BAD_RESPONSE', 'Workers AI returned no result');

  const message = result.choices?.[0]?.message;
  const rawText = result.response ?? message?.content;
  const text = typeof rawText === 'string' ? rawText.trim() : rawText == null ? '' : JSON.stringify(rawText);

  const rawToolCalls = result.tool_calls?.length ? result.tool_calls : (message?.tool_calls ?? []);
  const toolCalls = rawToolCalls.flatMap((raw): LlmToolCall[] => {
    const name = raw.name ?? raw.function?.name;
    if (!name) return [];
    return [{ name, arguments: parseArguments(raw.arguments ?? raw.function?.arguments) }];
  });

  return { text, toolCalls };
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Wraps an LLM call with request-trace step recording, mirroring dbTrace,
 * so LLM latency shows up next to DB queries in the live trace view.
 */
export async function llmTrace<T>(label: string, callFn: () => Promise<T>): Promise<T> {
  const trace = getCurrentTrace();
  const step = trace ? startStep(trace, `llm: ${label}`) : null;
  try {
    return await callFn();
  } finally {
    if (step) {
      finishStep(step);
      if (trace?.push) trace.push(trace);
    }
  }
}

let provider: LlmProvider | null | undefined;

/** Returns the configured provider, or null when no LLM credentials are set. */
export function getLlmProvider(): LlmProvider | null {
  if (provider === undefined) {
    provider = isLlmConfigured
      ? new WorkersAiProvider({ accountId: CF_ACCOUNT_ID, token: CF_AI_TOKEN, model: CF_AI_MODEL })
      : null;
  }
  return provider;
}

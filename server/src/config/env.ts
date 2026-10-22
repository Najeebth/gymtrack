import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEV_JWT_SECRET = 'gymtrack_super_secret_key';

/**
 * Validates process.env once at startup. Defaults keep local dev friction-free,
 * while production refuses to boot with insecure or missing secrets.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    JWT_SECRET: z.string().min(1).default(DEV_JWT_SECRET),
    CLIENT_URL: z.string().default('http://localhost:5173'),

    B2_ACCESS_KEY_ID: z.string().default(''),
    B2_SECRET_ACCESS_KEY: z.string().default(''),
    B2_REGION: z.string().default('us-east-005'),
    B2_BUCKET: z.string().default(''),
    B2_ENDPOINT: z.string().default('https://s3.us-east-005.backblazeb2.com'),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

    // Cloudflare Workers AI (chatbot LLM fallback). Optional: when unset, the
    // chatbot degrades to rule-based intents only, like Redis falls back to Postgres.
    CF_ACCOUNT_ID: z.string().default(''),
    CF_AI_TOKEN: z.string().default(''),
    // Picked by benchmarking free-plan models on real chat questions: 6/6 correct
    // at ~2.4s, where llama-3.1-8b misread data and hallucinated tool names
    CF_AI_MODEL: z.string().default('@cf/openai/gpt-oss-120b'),
    CHAT_LLM_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(50),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'must be set to a private value in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

const env = parsed.data;

export const NODE_ENV = env.NODE_ENV;
export const PORT = env.PORT;
export const JWT_SECRET = env.JWT_SECRET;
export const CLIENT_URL = env.CLIENT_URL;

export const B2_ACCESS_KEY_ID = env.B2_ACCESS_KEY_ID;
export const B2_SECRET_ACCESS_KEY = env.B2_SECRET_ACCESS_KEY;
export const B2_REGION = env.B2_REGION;
export const B2_BUCKET = env.B2_BUCKET;
export const B2_ENDPOINT = env.B2_ENDPOINT;
export const REDIS_URL = env.REDIS_URL;

export const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID;
export const CF_AI_TOKEN = env.CF_AI_TOKEN;
export const CF_AI_MODEL = env.CF_AI_MODEL;
export const CHAT_LLM_DAILY_LIMIT = env.CHAT_LLM_DAILY_LIMIT;
export const isLlmConfigured = Boolean(CF_ACCOUNT_ID && CF_AI_TOKEN);

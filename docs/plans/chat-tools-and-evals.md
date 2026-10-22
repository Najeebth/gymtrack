# Plan: Chat assistant — muscle-group summary tool & saved eval suite

**Status:** Planned · **Created:** 2026-10-23 · **Area:** `server/src/services/chat/`, new `server/evals/`

## Why

The assistant's prompt has one scenario-specific rule:

> "For advice on what to train next, first call get_recent_training and suggest muscle groups the user has not trained recently."

Rules like this don't scale: each new question type would add another line, the prompt grows, rules start to conflict, and every line costs tokens on every call. Two practices replace them:

1. **Tools that already contain the answer.** If a tool returns "Chest: never trained, Legs: 6 days ago", the model needs no instructions to suggest chest.
2. **Evals instead of guesswork.** A saved set of real questions with pass/fail checks, re-run whenever the prompt, tools, or model change. So far this was an ad-hoc scratch script (`model-bench.mts`) that found real bugs; it should live in the repo.

## Step 1 — `get_muscle_group_summary` tool

**Service** (`WorkoutsService.getMuscleGroupSummary(userId, since, today)`): one row per muscle group, including groups never trained:

```json
{
  "since": "2026-09-24",
  "groups": [
    { "muscleGroup": "Legs",  "lastTrained": "2026-10-17", "daysSince": 6,    "sessions": 4, "sets": 12, "volumeKg": 7600 },
    { "muscleGroup": "Chest", "lastTrained": null,         "daysSince": null, "sessions": 0, "sets": 0,  "volumeKg": 0 }
  ]
}
```

- Canonical groups: Chest, Back, Legs, Shoulders, Arms, Core. Include any other group present in the data (e.g. "General" from chat drafts with unknown exercises).
- `lastTrained` is all-time (Prisma `groupBy` on `muscleGroup` with `_max.date`); `sessions` / `sets` / `volumeKg` cover the window (default 30 days, max 90).
- `daysSince` is computed from the client's `today`, consistent with the rest of the chat.

**Tool** (`tools.ts`): description *"Per muscle group: when it was last trained and how much in the last N days. Use for balance, recovery, and what-to-train-next questions."* Zod-validated `days` argument. `userId` from scope, as for every tool.

**Prompt:** delete the "what to train next" line. The remaining prompt should only hold general policy.

**Tests:** service aggregation (never-trained groups present, window boundaries, the "General" group), tool argument validation, compact output.

## Step 2 — Saved eval suite (`server/evals/chat/`)

**Layout**

```
server/evals/chat/
├── fixtures.ts   # a fixed training history served by fake ChatToolDeps (no DB needed)
├── cases.ts      # typed eval cases
└── run.ts        # runner: npm run eval:chat -- [--model <id>] [--case <id>] [--repeat 3]
```

**Deterministic data:** `ChatTools` already accepts injected dependencies, so evals use fixture-backed fake services instead of the local database. Results then depend only on the model and prompt, and the suite runs the same on any machine.

**Case format**

```ts
{
  id: 'heaviest-follow-up',
  history: [['USER', 'workouts on the 17th'], ['ASSISTANT', '<rule reply listing the 17th>']],
  message: 'which one was the heaviest?',
  expect: { source: 'LLM', contains: [/leg press/i, /120/], notContains: [LEAK] },
}
```

Checks: `source`, `contains` / `notContains` patterns, `action` (draft exercise + exact sets), and "no tool names or JSON in the reply".

**Initial cases** (every real failure so far, plus the benchmark):

| Case | Origin |
|---|---|
| "which one was the heaviest?" (follow-up) | llama-3.1-8b answered Squat 70kg |
| "what should I train next time?" | generic / "no such function" replies |
| "which muscle group have I trained the least recently?" | invented a workout log |
| "how has my training been over the last 2 weeks?" | baseline |
| "I did three sets of eight on bench with 60 kilos" | collapsed to 1 set |
| "just finished squats: 100kg for 5, then 105 for 3" | wrong weights, Python-quoted args |
| "did 4 sets of 10 pull ups" | "pull ups" not matched to Pull-Up |
| "where?" after a date listing | leaked `propose_workout_log` text |
| "yesterday" / "on the 17th" | must stay on the rule path (`source: RULE`, no LLM call) |
| An unrelated request ("write me a poem") | polite decline, no tool calls |

**Runner output:** a pass/fail table per case and model, average latency, and LLM calls per case. With `--repeat 3`, report consistency (3/3, 2/3, …), since model output is non-deterministic and a single pass can be luck. Exit non-zero below a threshold, so it can gate a manual release check.

**When to run:** manually, before changing the prompt, tools, or model, and when evaluating a new model. **Not in CI:** it uses Workers AI quota (roughly 30–60 calls per model per run) and is non-deterministic.

**Growing it:** when a real conversation goes wrong, add it as a case first (it should fail), then fix the tool, code, or model, and re-run everything to catch regressions.

## Step 3 (optional) — Feedback on AI replies

👍/👎 on `source: LLM` replies, stored on `ChatMessage` (e.g. `feedback: UP | DOWN`). A 👎 conversation is a ready-made candidate for a new eval case.

## Acceptance criteria

- [ ] `get_muscle_group_summary` implemented with unit tests; the "what to train next" prompt line is removed.
- [ ] `npm run eval:chat` runs all initial cases against fixture data with no database.
- [ ] `@cf/openai/gpt-oss-120b` passes every case 3/3 with the scenario line removed.
- [ ] A baseline run for `@cf/meta/llama-3.1-8b-instruct` is recorded for comparison.
- [ ] ARCHITECTURE.md §2.6 documents the eval workflow.

## Backlog (noticed, not in this plan)

- **Workouts page lost offline saving.** It uses `useWorkoutsQuery().createWorkout`, which has no IndexedDB fallback; its `'queued'` branch can never run (the remaining TS2367 error in `WorkoutsPage.tsx`).
- **Cross-device draft status.** Confirmed/dismissed drafts are remembered per device only; a `PATCH /api/chat/:id/action` would sync them.
- **Structured outputs.** Workers AI JSON mode could replace parts of the lenient argument parsing in `proposal.ts`.
- **Routing when the app grows.** Split the assistant into small domain flows (logging, analytics, …), each with its own short prompt and toolset, behind the existing rules-first router.

# Task

Short name: Class Trial DeepSeek Thinking Budget

Goal: Prevent `deepseek-v4-flash` class-trial action and speech calls from returning empty extracted text or adding long retry latency because the model spends too much work on reasoning tokens before final content.

Why it matters: The class-trial game now uses DeepSeek as its single game brain. If DeepSeek receives too small a `max_tokens` budget, the provider can return `finish_reason: "length"` with non-empty `reasoning_content` but empty `message.content`, causing same-model retries and local fallback.

## Task Gate

Task type: AI provider behavior

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: direct real DeepSeek probe through `callRoutedModelJson` using the local `.env` route; confirm action and speech return non-empty text with the lower caller budgets.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped:
- Reason:
- Residual risk:

## Context To Read First

- `docs/tasks/2026-05-class-trial-deepseek-brain.md`
- `progress.md`
- `session-handoff.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/modelLlms.ts`
- `src/ai/modelLlms.test.ts`
- Harness state docs

Files or directories the agent should not edit:

- `.env`
- provider secrets
- generated audio/image caches
- unrelated game rules, UI, or deployment modules

## Definition Of Done

This task is complete when:

- Root cause is recorded as DeepSeek reasoning-token-heavy responses exhausting completion budget before final content.
- DeepSeek action and speech calls default to `thinking: disabled` unless explicitly overridden by env.
- DeepSeek action and speech calls keep a normal completion budget floor of 900.
- Focused tests prove the DeepSeek thinking/budget defaults are applied even when callers request the old lower budgets.
- A real local DeepSeek probe and narrow class-trial loop return non-empty action/speech text without printing secrets.

## Verification

Required checks:

- `npm run test -- src/ai/modelLlms.test.ts`
- `npm run test -- src/ai/modelLlms.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-token-budget.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- Real DeepSeek probe through Vite `ssrLoadModule('/src/ai/modelLlms.ts')` with `maxTokens: 220` for action and `maxTokens: 900` for speech.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Root cause investigation found DeepSeek empty output occurred when `max_tokens` was too low and all completion tokens were consumed as `reasoning_tokens`.
- A/B probe found action/speech `thinking: disabled` is the faster and more reliable default for the real class-trial prompts.
- Added DeepSeek defaults: `thinking: disabled` for action/speech and normal token floor 900.
- Added regression tests for DeepSeek thinking/budget defaults.
- Real local DeepSeek probe returned non-empty JSON text for both action and speech through the actual routed model helper.

Changed files:
- src/ai/modelLlms.ts
- src/ai/modelLlms.test.ts
- docs/tasks/2026-05-class-trial-deepseek-token-budget.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- `npm run test -- src/ai/modelLlms.test.ts` red-green: failed first because DeepSeek action/speech did not both send `thinking: disabled`; then passed after implementation.
- `npm run test -- src/ai/modelLlms.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` passed, 3 files / 102 tests.
- Real DeepSeek probe returned non-empty `deepseek-action:deepseek-v4-flash` text and non-empty `deepseek-speech:deepseek-v4-flash` text.
- Narrow class-trial real loop ran 8 LLM calls through the game engine: providers were DeepSeek-only, fallback count was 0, and 3 first attempts had empty raw text but recovered on the second DeepSeek attempt.
- Follow-up narrow class-trial real loop after disabling DeepSeek thinking ran 5 LLM calls in about 29s: providers were DeepSeek-only, fallback count 0, empty attempt count 0, and the only retry was a speech validation repair.
- `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning.
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-token-budget.md` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- Disabling thinking may reduce some deep chain-of-thought style deliberation, but it fits the current game need better: faster structured JSON and fewer empty attempts.
- The remaining observed retry was a speech-contract validation repair, not an empty provider response. Future work should target speech constraints/prompting if that becomes frequent.
```

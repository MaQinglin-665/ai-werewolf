# Task

Short name: Class Trial DeepSeek Brain

Goal: Make the local-only `学级裁判主题局` use DeepSeek-v4 as the exclusive game reasoning model for fixed class-trial characters.

Why it matters: The class-trial UI already says `DeepSeek-v4 主脑`; game reasoning should match that promise instead of silently rotating to GPT/Claude after malformed action JSON.

## Task Gate

Task type: AI routing behavior

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: `http://127.0.0.1:51625` class-trial local game; confirm logged model attempts stay on DeepSeek for a new class-trial action or speech.
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

- `docs/tasks/2026-05-class-trial-llm-runtime.md`
- `docs/superpowers/plans/2026-05-29-class-trial-deepseek-brain.md`
- `session-handoff.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- Harness state docs

Files or directories the agent should not edit:

- `.env`
- provider secrets
- generated audio/image caches
- unrelated rule-engine, room, or deployment modules

## Definition Of Done

This task is complete when:

- `buildClassTrialAiFriends` keeps fixed character identity and role cards but uses the DeepSeek base persona for every class-trial seat.
- Class-trial action JSON repair attempts retry DeepSeek instead of switching to GPT/Claude/GLM persona fallbacks.
- Class-trial speech repair attempts retry DeepSeek instead of switching to GPT/Claude/GLM persona fallbacks.
- Focused tests prove old non-class-trial fallback behavior still works.
- Live smoke confirms a new class-trial game no longer logs GPT model attempts for the checked class-trial action or speech path.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-brain.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- Browser smoke through `http://127.0.0.1:51625`
- Query `AiCallLog` for the smoke game and confirm provider attempts are DeepSeek-only for the observed class-trial AI call.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Class-trial fixed characters now keep their fixed ids, display names, and role cards while using the DeepSeek base brain persona.
- Class-trial action repair attempts stay on DeepSeek instead of rotating to GPT/Claude/GLM persona fallbacks.
- Class-trial speech repair attempts stay on DeepSeek instead of rotating to GPT/Claude/GLM persona fallbacks.
- Live class-trial smoke confirmed the home/table DeepSeek status and observed DeepSeek-only provider attempts in `AiCallLog`.

Changed files:
- src/components/game/classTrialTheme.ts
- src/components/game/classTrialTheme.test.ts
- src/ai/actionProviders.ts
- src/ai/actionProviders.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- docs/superpowers/plans/2026-05-29-class-trial-deepseek-brain.md
- docs/tasks/2026-05-class-trial-deepseek-brain.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green focused tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` first failed for mixed base personas / GPT repair fallback, then passed after implementation.
- Lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- TypeScript: `npx tsc --noEmit` passed.
- Build: `npm run build` passed with the existing Turbopack NFT trace warning.
- Task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-brain.md` passed.
- Harness: `npm run harness:check` passed.
- Whitespace: `git diff --check` passed with CRLF warnings only.
- Browser/live smoke: `http://127.0.0.1:51625` showed `真实 LLM · DeepSeek-v4 主脑`; live game `6010e73b-e191-4d53-a3ca-9efc2f939c95` logged observed action repair attempts as `deepseek-action:deepseek-v4-flash` only and an observed speech repair attempt as `deepseek-speech:deepseek-v4-flash` only.

Remaining risks:
- Live latency and JSON quality still depend on DeepSeek-v4 behavior and configured provider availability.
- The observed live DeepSeek action/speech attempts returned empty extracted content for several calls, so they retried DeepSeek and then fell back locally. The next quality slice should inspect the raw provider response shape / text extractor before tuning prompts.
```

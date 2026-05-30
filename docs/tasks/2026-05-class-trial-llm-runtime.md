# Task

Short name: Class Trial LLM Runtime

Goal: Make the local-only `学级裁判主题局` use real LLM runtime by default and make that runtime visible on the home card and themed table.

Why it matters: The class-trial theme depends on character reasoning and speech quality. If it silently sends `aiRuntimeMode: "mock"`, connected DeepSeek/Mimo providers are unused even when configured.

## Task Gate

Task type: UI/runtime behavior

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: `http://127.0.0.1:51625` class-trial local game with a continue action; confirm UI shows real LLM and backend AI call logs are not mock.
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

- `docs/working-agreements.md`
- `docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
- `session-handoff.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/aiFriendStorage.ts`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/ClassTrialGameTable.tsx`
- Focused tests for the above files
- `src/app/globals.css`
- Harness state docs

Files or directories the agent should not edit:

- `.env`
- generated caches
- local audio/image asset caches
- unrelated rules, room, or AI provider modules

## Definition Of Done

This task is complete when:

- Class-trial themed games resolve to `aiRuntimeMode: "llm"` even if stored global mode is `mock`.
- The class-trial home entry and themed table show `真实 LLM` / `DeepSeek-v4` status.
- Continue/lookahead requests use the effective runtime mode.
- Focused tests and selected harness checks pass.
- A live or API smoke verifies real AI routing instead of mock for a class-trial continue.

## Verification

Required checks:

- `npm run test -- src/components/game/aiFriendStorage.test.ts src/components/game/gamePanelsMobile.test.ts src/components/game/classTrialGameTable.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-llm-runtime.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- Browser smoke through `http://127.0.0.1:51625`
- Query `AiCallLog` for the smoke game and confirm provider is not `mock-speech` / `mock-action`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added class-trial effective runtime resolution that forces LLM mode for the local theme.
- Surfaced real LLM / DeepSeek-v4 status on the home card and class-trial table.
- Routed visible and background class-trial continue requests through the effective runtime mode.

Changed files:
- src/components/game/aiFriendStorage.ts
- src/components/game/aiFriendStorage.test.ts
- src/components/game/LandingPanel.tsx
- src/components/game/gamePanelsMobile.test.ts
- src/components/game/ClassTrialGameTable.tsx
- src/components/game/classTrialGameTable.test.ts
- src/components/GameClient.tsx
- src/app/globals.css
- docs/tasks/2026-05-class-trial-llm-runtime.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green focused tests: `npm run test -- src/components/game/aiFriendStorage.test.ts src/components/game/gamePanelsMobile.test.ts src/components/game/classTrialGameTable.test.ts` first failed for the missing effective runtime helper and missing status copy, then passed, 3 files / 37 tests.
- `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- Browser smoke at `http://127.0.0.1:51625` confirmed the home card and themed table show `真实 LLM · DeepSeek-v4`.
- Live smoke game `8943cd42-566f-411f-8c78-6795cc4cefdd` logged real model attempts including `deepseek-action:deepseek-v4-flash`, not mock-only output.
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-llm-runtime.md` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- Live LLM latency still depends on the configured local/remote providers.
- One live DeepSeek action attempt returned invalid JSON and was recovered by model fallback; a later slice can tighten DeepSeek action formatting if we want DeepSeek-only behavior.
```

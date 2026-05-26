# 任务卡：GameClient 最近对局 Store 提取

## Task

Short name: gameclient recent games store

Goal: Slim `src/components/GameClient.tsx` by extracting recent-game localStorage and subscription behavior into a focused helper under `src/components/game/**`.

Why it matters: `GameClient.tsx` should stay an orchestration layer. Recent-game persistence is a pure frontend helper and can be tested independently without touching rules, AI, server, room state, or API routes.

## Task Gate

Task type: Frontend/UI

Risk level: low

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL:
- If skipped, reason: The change moves recent-game storage helpers without changing rendered UI. Manual browser verification becomes required if start/load/home visible behavior changes.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Browser/manual flow
- Reason: No rendered UI or interaction surface should change.
- Residual risk: A browser-only localStorage/event edge case could be missed by the node-environment focused test.

## Context To Read First

- `AGENTS.md`
- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/feature-registry.md`
- `docs/tasks/2026-05-frontend-css-boundary-map.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/recentGamesStore.ts`
- `src/components/game/recentGamesStore.test.ts`
- `docs/tasks/2026-05-gameclient-recent-games-store.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `src/game/**`
- `src/ai/**`
- `src/server/**`
- `src/app/api/**`
- `prisma/**`
- `.env`
- generated caches
- deployment files
- unrelated modules

## Definition Of Done

This task is complete when:

- Recent-game read, remember, clear, and subscription helpers live outside `GameClient.tsx`.
- `GameClient.tsx` imports those helpers and no longer owns recent-game cache globals.
- Focused helper tests pass.
- `npm run lint` passes.
- Verification and skipped browser rationale are recorded.

## Verification

Required checks:

- `npm run test -- src/components/game/recentGamesStore.test.ts`
- `npm run lint`
- `npm run harness:task-card -- docs/tasks/2026-05-gameclient-recent-games-store.md`

Optional deeper checks:

- Browser/manual home -> start -> return home -> recent game list if visible recent-game behavior changes.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- ...

Changed files:
- ...

Verification:
- ...

Remaining risks:
- ...
```

## Execution Record

Completed:
- Added focused tests for recent-game localStorage ordering, local change
  subscriptions, server snapshot behavior, and current-game cleanup.
- Watched the test fail first because `recentGamesStore` did not exist.
- Extracted recent-game storage keys, cache, read, remember, clear, and
  subscription helpers from `GameClient.tsx` into
  `src/components/game/recentGamesStore.ts`.
- Updated `GameClient.tsx` to import the helper and keep only orchestration.

Changed files:
- `src/components/GameClient.tsx`
- `src/components/game/recentGamesStore.ts`
- `src/components/game/recentGamesStore.test.ts`
- `docs/tasks/2026-05-gameclient-recent-games-store.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm run test -- src/components/game/recentGamesStore.test.ts` passed.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md docs/tasks/2026-05-gameclient-recent-games-store.md` passed.
- `npm run harness:check` passed.

Remaining risks:
- Browser/manual verification was skipped because rendered UI did not change.
- A browser-only storage/event quirk could still be missed by the node
  environment fake-window test.

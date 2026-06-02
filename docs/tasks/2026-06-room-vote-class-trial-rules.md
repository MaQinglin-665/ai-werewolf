# Room Vote And Class Trial Rules

Status: done

## Task

Short name: room-vote-class-trial-rules

Goal: Make ordinary public-room vote smoke complete reliably, then separate class-trial theme flow and role-first speech direction from ordinary Werewolf rules.

Why it matters: Local single-player and public multiplayer should share ordinary Werewolf rules, while the local class-trial theme can feel like a trial through its own UI flow and persona director.

## Task Gate

Task type: Room / multiplayer flow + rules engine + AI speech + frontend UI + architecture

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local app class-trial theme flow on the selected localhost port; verify trial-step labels and hidden ordinary night labels.
- If skipped, reason: record the tool/browser availability issue in Acceptance Notes and Handoff.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production deploy/preflight.
- Reason: user scope was GitHub push only; no Tencent Cloud or Render deployment in scope.
- Residual risk: production host behavior still needs the documented deployment flow if this branch is deployed later.

## Context To Read First

- `README.md`
- `docs/harness-orientation.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/README.md`
- `docs/feature-registry.md`
- `docs/working-agreements.md`
- `docs/superpowers/specs/2026-06-02-room-vote-and-class-trial-rules-design.md`
- `docs/superpowers/plans/2026-06-02-room-vote-and-class-trial-rules.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/server/roomAdvance.ts`
- `src/server/roomService.ts`
- `src/app/api/rooms/api.test.ts`
- `scripts/room-action-smoke.mjs`
- `src/components/game/classTrialThemeFlow.ts`
- `src/components/game/classTrialFlowModel.ts`
- `src/components/game/classTrialTableModel.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/app/globals.css`
- `src/ai/classTrialPersonaDirector.ts`
- `src/ai/classTrialSpeechDirector.ts`
- `src/ai/speechProviders.ts`
- Related focused tests for the files above.
- `docs/tasks/2026-06-room-vote-class-trial-rules.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- database files
- generated audio caches
- `.next`
- `node_modules`
- `tmp`
- private local assets under `local-assets`
- unrelated modules

## Definition Of Done

This task is complete when:

- Ordinary public-room host continue reaches the next meaningful human/public stop without changing ordinary rules for local single-player and public multiplayer.
- `smoke:room-action:vote` can reach speech, vote, and vote resolution under mock AI.
- Class-trial mode renders theme trial-step labels and minimizes ordinary hidden-night labels.
- Class-trial AI speech guidance allows low-information character texture without forcing追问、反驳、转票, while blocking private/system leaks.
- Required focused tests, type/lint/build checks, room smokes, and browser/manual verification are recorded.
- `feature_list.json`, `progress.md`, `session-handoff.md`, and this task card contain final evidence.
- The current branch is committed and pushed to GitHub.

## Verification

Required checks:

- `npm run test -- src/server/roomAdvance.test.ts src/app/api/rooms/api.test.ts`
- `npm run test -- src/components/game/classTrialThemeFlow.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts`
- `npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts`
- `ROOM_SMOKE_BASE_URL=http://127.0.0.1:<port> npm run smoke:room-action:vote`
- `ROOM_SMOKE_BASE_URL=http://127.0.0.1:<port> npm run smoke:room-sse`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

Optional deeper checks:

- In-app browser or Playwright class-trial visual smoke.
- `npm run preflight:production` only if a release/deployment task is added.

If a check cannot be run, record the reason in the handoff.

## Acceptance Notes

- Focused room/API tests passed: `npm run test -- src/server/roomAdvance.test.ts src/app/api/rooms/api.test.ts` passed 2 files / 23 tests.
- Class-trial UI/model tests passed: `npm run test -- src/components/game/classTrialThemeFlow.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts` passed 4 files / 48 tests.
- Class-trial AI director tests passed: `npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts` passed 3 files / 140 tests.
- `npx tsc --noEmit` passed with no output.
- `npm run lint` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- `ROOM_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:room-action:vote` passed with `coveredActionTypes` containing `seerCheck`, `witchAction`, `speak`, and `vote`; `voteResolved` was `true`.
- `ROOM_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:room-sse` passed with lobby, join, and start events.
- In-app browser verification confirmed `闭庭整理` as the class-trial main hidden-night status and `证言审理` as the day-speech main status. Screenshot: `tmp/class-trial-room-vote-rules-visual.png`.

## Handoff

```text
Completed:
- Stabilized public-room host continue and room vote smoke diagnostics.
- Added class-trial theme flow labels/details and minimized ordinary hidden-night main status.
- Added class-trial persona director guidance for low-information role texture and leak guards.

Changed files:
- `src/server/roomAdvance.ts`
- `src/server/roomService.ts`
- `scripts/room-action-smoke.mjs`
- `src/app/api/rooms/api.test.ts`
- `src/components/game/classTrialThemeFlow.ts`
- `src/components/game/classTrialFlowModel.ts`
- `src/components/game/classTrialTableModel.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/app/globals.css`
- `src/ai/classTrialPersonaDirector.ts`
- `src/ai/classTrialSpeechDirector.ts`
- `src/ai/speechProviders.ts`
- Related focused tests and project state docs.

Verification:
- Focused room/API, class-trial UI/model, and AI director tests passed.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed.
- `smoke:room-action:vote` and `smoke:room-sse` passed locally on `http://127.0.0.1:3000`.
- In-app browser class-trial visual verification passed for `闭庭整理` and `证言审理`.

Remaining risks:
- Production deployment was intentionally skipped; verify through `docs/tencent-cloud-deploy.md` if deployed later.
- Browser automation cannot judge subjective AI dialogue quality across a full voiced Day 1; it only verified the UI state and one visible flow.
```

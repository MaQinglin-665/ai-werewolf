# Room Vote And Class Trial Rules

Status: in-progress

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

- Check skipped: none yet.
- Reason: final verification pending.
- Residual risk: final smoke/browser results are not recorded yet.

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

- Initial state: implementation Tasks 1-4 are committed; final end-to-end verification is pending.
- Required final evidence: focused room/API tests, class-trial flow/UI tests, class-trial AI director tests, `smoke:room-action:vote`, `smoke:room-sse`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## Handoff

```text
Completed:
- Pending final verification.

Changed files:
- Pending final verification.

Verification:
- Pending final verification.

Remaining risks:
- Pending final verification.
```

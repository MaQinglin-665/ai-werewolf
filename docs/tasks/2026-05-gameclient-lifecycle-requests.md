# GameClient Lifecycle Requests

## Task

Short name: GameClient lifecycle requests

Goal: Extract single-player game lifecycle request helpers from `GameClient.tsx` into `src/components/game/gameClientRequests.ts`.

Why it matters: `GameClient.tsx` should remain the orchestration layer, while request construction, response parsing, and stream-continue context preparation live in a focused, testable frontend module.

## Task Gate

Task type: Frontend/UI + Single-player main game

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL:
- If skipped, reason: The change should not alter visible layout or user-facing interaction. Local `smoke:main-game` is required because lifecycle request helpers touch creation, command submission, and continue flow surfaces.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production/release check
- Reason: This is a local frontend refactor with no deployment, environment, or public release change.
- Residual risk: Production health is not proven by this task.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-review.md`
- `progress.md`
- `session-handoff.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `docs/tasks/2026-05-gameclient-lifecycle-requests.md`
- `docs/superpowers/plans/2026-05-26-gameclient-lifecycle-requests.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `src/game/**`
- `src/server/**`
- `src/app/api/**`
- `src/components/RoomClient.tsx`
- generated caches

## Definition Of Done

This task is complete when:

- `GameClient.tsx` imports focused helpers for load, create, normal command submission, and stream-continue speech context.
- Focused tests describe request URLs, bodies, error behavior, and stream speaker context.
- Existing user-visible behavior remains unchanged.
- Required verification commands pass or skipped checks are explained.
- Feature/progress/handoff files name the completed boundary and next step.

## Verification

Required checks:

- `npm run test -- src/components/game/gameClientRequests.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lifecycle-requests.md`
- `npm run harness:check`
- `npm run audit:structure`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000`
- `git diff --check`

Optional deeper checks:

- `npm run build` if TypeScript or smoke output suggests route payload or bundling risk.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Extracted lifecycle request helpers to src/components/game/gameClientRequests.ts.
- Added focused tests for load, create, normal command submission, and stream-continue speech context.
- Wired GameClient.tsx to keep React orchestration local while moving request construction and response parsing out.

Changed files:
- src/components/GameClient.tsx
- src/components/game/gameClientRequests.ts
- src/components/game/gameClientRequests.test.ts
- docs/tasks/2026-05-gameclient-lifecycle-requests.md
- docs/superpowers/plans/2026-05-26-gameclient-lifecycle-requests.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- RED: npm run test -- src/components/game/gameClientRequests.test.ts failed because ./gameClientRequests did not exist.
- GREEN: npm run test -- src/components/game/gameClientRequests.test.ts
- npm run lint
- npx tsc --noEmit
- npm run harness:task-card -- docs/tasks/2026-05-gameclient-lifecycle-requests.md
- npm run harness:check
- npm run audit:structure
- npm run smoke:main-game -- --base-url=http://127.0.0.1:3010
- npm run build
- git diff --check

Remaining risks:
- Production/release checks were skipped because no deployment or public runtime configuration changed.
- The first smoke attempt against http://127.0.0.1:3000 timed out because an old dev server process was unhealthy; PID 47860 was stopped and a clean dev server on port 3010 passed the smoke.
- Build still reports the existing Turbopack NFT warning for next.config.ts -> src/server/roomService.ts.
```

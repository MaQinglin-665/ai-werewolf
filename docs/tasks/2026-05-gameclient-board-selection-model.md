# GameClient Board Selection Model

## Task

Short name: GameClient board selection model

Goal: Extract the landing-page board toggle and human-seat transition rules from `GameClient.tsx` into the existing tested `src/components/game/boardSelectionModel.ts` module.

Why it matters: Board selection is UI state modeling, not React orchestration. Moving the transition rules into a helper makes the landing flow easier to reason about and gives future board-selection UI work a tested boundary.

## Task Gate

Task type: Frontend/UI structure

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
- If skipped, reason: This task only moves board-selection state transition logic and does not change rendered layout or interaction behavior.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Browser/manual flow
- Reason: No UI layout, styling, or interaction behavior is intended to change.
- Residual risk: Visual rendering is not rechecked beyond type/lint/test confidence.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `docs/tasks/2026-05-gameclient-event-feed-model.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/boardSelectionModel.ts`
- `src/components/game/boardSelectionModel.test.ts`
- `docs/tasks/2026-05-gameclient-board-selection-model.md`
- `docs/superpowers/plans/2026-05-26-gameclient-board-selection-model.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated modules
- `src/game/**`
- `src/ai/**`
- `src/server/**`
- `src/app/api/**`

## Definition Of Done

This task is complete when:

- `GameClient.tsx` imports a tested helper for board toggle state transitions.
- The helper covers toggling the current board off, spectator mode, fixed-seat preservation, and fixed-seat invalidation.
- Verification commands pass or skipped checks are recorded with a reason.
- Progress and handoff files describe the completed extraction and next restart path.

## Verification

Required checks:

- `npm run test -- src/components/game/boardSelectionModel.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-gameclient-board-selection-model.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run audit:structure`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added tested board selection transition helper to the existing board selection model.
- Updated GameClient to import the helper and keep only state setter wiring.
- Updated feature/progress/session handoff state.

Changed files:
- src/components/GameClient.tsx
- src/components/game/boardSelectionModel.ts
- src/components/game/boardSelectionModel.test.ts
- docs/tasks/2026-05-gameclient-board-selection-model.md
- docs/superpowers/plans/2026-05-26-gameclient-board-selection-model.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/boardSelectionModel.test.ts
- npm run lint
- npx tsc --noEmit
- npm run harness:task-card -- docs/tasks/2026-05-gameclient-board-selection-model.md
- npm run harness:check
- npm run audit:structure

Remaining risks:
- Browser/manual flow was skipped because rendered layout and interactions did not change.
- Production/release checks were skipped because no deploy or public runtime configuration changed.
```

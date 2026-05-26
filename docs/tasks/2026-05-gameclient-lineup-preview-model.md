# GameClient Lineup Preview Model

## Task

Short name: GameClient lineup preview model

Goal: Extract the landing-page AI lineup preview calculation from `GameClient.tsx` into a focused, tested `src/components/game/landingLineupPreview.ts` helper.

Why it matters: The landing screen preview is UI data modeling, not React orchestration. Moving it out makes `GameClient.tsx` smaller and gives future landing-panel work a clear, tested boundary.

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
- If skipped, reason: This task only moves a pure lineup-preview calculation and does not change rendered layout or interaction behavior.

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
- `docs/tasks/2026-05-gameclient-helper-extractions.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/landingLineupPreview.ts`
- `src/components/game/landingLineupPreview.test.ts`
- `docs/tasks/2026-05-gameclient-lineup-preview-model.md`
- `docs/superpowers/plans/2026-05-26-gameclient-lineup-preview-model.md`
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

- `GameClient.tsx` imports a tested helper for the landing lineup preview.
- The helper covers random/fixed human seat mode and spectator mode.
- Verification commands pass or skipped checks are recorded with a reason.
- Progress and handoff files describe the completed extraction and next restart path.

## Verification

Required checks:

- `npm run test -- src/components/game/landingLineupPreview.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lineup-preview-model.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run audit:structure`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added tested landing lineup preview helper module.
- Updated GameClient to import the helper and keep only memoization/state wiring.
- Updated feature/progress/session handoff state.

Changed files:
- src/components/GameClient.tsx
- src/components/game/landingLineupPreview.ts
- src/components/game/landingLineupPreview.test.ts
- docs/tasks/2026-05-gameclient-lineup-preview-model.md
- docs/superpowers/plans/2026-05-26-gameclient-lineup-preview-model.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/landingLineupPreview.test.ts
- npm run lint
- npx tsc --noEmit
- npm run harness:task-card -- docs/tasks/2026-05-gameclient-lineup-preview-model.md
- npm run harness:check
- npm run audit:structure

Remaining risks:
- Browser/manual flow was skipped because rendered layout and interactions did not change.
- Production/release checks were skipped because no deploy or public runtime configuration changed.
```

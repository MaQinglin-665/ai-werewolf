# GameClient Event Feed Model

## Task

Short name: GameClient event feed model

Goal: Extract the table event feed filtering, limit, and ordering calculation from `GameClient.tsx` into a focused, tested `src/components/game/tableEventFeed.ts` helper.

Why it matters: The event feed shown in desktop and mobile table panels is UI data shaping, not React orchestration. Moving it out gives the behavior a clear name and keeps `GameClient.tsx` shrinking through low-risk, test-backed steps.

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
- If skipped, reason: This task only moves a pure event-feed calculation and does not change rendered layout or interaction behavior.

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
- `docs/tasks/2026-05-gameclient-lineup-preview-model.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/tableEventFeed.ts`
- `src/components/game/tableEventFeed.test.ts`
- `docs/tasks/2026-05-gameclient-event-feed-model.md`
- `docs/superpowers/plans/2026-05-26-gameclient-event-feed-model.md`
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

- `GameClient.tsx` imports a tested helper for the table event feed.
- The helper filters out `DAY_SPEECH` events, keeps the newest 18 remaining events, and returns newest-first order.
- Verification commands pass or skipped checks are recorded with a reason.
- Progress and handoff files describe the completed extraction and next restart path.

## Verification

Required checks:

- `npm run test -- src/components/game/tableEventFeed.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-gameclient-event-feed-model.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run audit:structure`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added tested table event feed helper module.
- Updated GameClient to import the helper and keep only memoization/prop wiring.
- Updated feature/progress/session handoff state.

Changed files:
- src/components/GameClient.tsx
- src/components/game/tableEventFeed.ts
- src/components/game/tableEventFeed.test.ts
- docs/tasks/2026-05-gameclient-event-feed-model.md
- docs/superpowers/plans/2026-05-26-gameclient-event-feed-model.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/tableEventFeed.test.ts
- npm run lint
- npx tsc --noEmit
- npm run harness:task-card -- docs/tasks/2026-05-gameclient-event-feed-model.md
- npm run harness:check
- npm run audit:structure

Remaining risks:
- Browser/manual flow was skipped because rendered layout and interactions did not change.
- Production/release checks were skipped because no deploy or public runtime configuration changed.
```

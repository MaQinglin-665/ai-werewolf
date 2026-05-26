# Frontend Structure Boundaries Design

## Purpose

This design defines a conservative frontend structure path for `ai-werewolf`.
The goal is not to rewrite the app framework. The goal is to make future UI
work easier for agents to scope, verify, and hand off without destabilizing the
rules engine, AI behavior, room state, or production Alpha flow.

Current structure audit signals:

- `src/app/globals.css` is the largest file at 4602 lines.
- `src/components/RoomClient.tsx` is 2126 lines.
- `src/components/GameClient.tsx` is 1865 lines.
- `src/components/game/**` already contains useful extracted panels, helpers,
  mobile table components, and tests.

The first production-code phase should therefore govern existing frontend
boundaries before moving more behavior. It should start with CSS and display
structure, then move toward `GameClient` orchestration helpers only after the
style boundary is clear.

## Target Boundaries

### `src/components/GameClient.tsx`

Long-term role: game-page orchestration layer.

It may own top-level game view state, API request wiring, coordination between
desktop and mobile compositions, and host audio / AI speech / auto-advance
orchestration until those hooks are explicitly extracted.

It should not accumulate large presentational subtrees, pure formatting helpers,
CSS-specific layout decisions, rule decisions, or AI strategy/fallback logic.

### `src/components/game/**`

Long-term role: table UI feature package.

This directory should contain presentational panels, table surfaces,
mobile-only table components, pure frontend model helpers, and tests. It should
avoid direct persistence, rule mutation, LLM behavior, and room-service state
transitions.

### `src/components/RoomClient.tsx` And `src/components/rooms/**`

Long-term role: multiplayer room UI orchestration and room-specific surfaces.

Future room UI extraction should follow the same shape as `src/components/game`:
keep `RoomClient.tsx` as orchestration, move presentational lobby/table pieces
and pure room UI models into `src/components/rooms/**`.

This design does not make room extraction the first phase because room flow is
more tightly coupled to SSE, tokens, recovery, and public Alpha smoke checks.

### `src/app/globals.css`

Long-term role: global tokens, reset, shared utilities, and temporary legacy CSS
while frontend styles are migrated.

It should be split conceptually before being split physically. The next task
should map and group existing CSS into stable sections:

- global reset and base typography;
- app-wide tokens and utility classes;
- landing/home styles;
- game table desktop styles;
- game table mobile styles;
- room lobby and room flow styles;
- admin/health/release page styles;
- motion and reduced-motion rules.

Physical file splitting should happen only after the map is stable and the repo
chooses the target mechanism, such as imported CSS partials or component CSS
modules. The first phase should not change visual behavior.

## Phased Roadmap

### Phase 1: CSS And Frontend Boundary Map

Create a low-risk structure task that reads the current frontend files, marks
the intended CSS sections, and records which future moves are safe. If code is
changed, limit it to comments/section headers or non-behavioral CSS grouping.

Recommended verification:

- `npm run audit:structure`
- `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md`
- `npm run harness:check`
- `npm run lint` if package scripts, JS, TS, or meaningful CSS structure changes
  are made

Browser verification is not required for docs-only planning. It becomes
required if CSS selectors or rendered layout behavior change.

### Phase 2: Safe Frontend Helper Extraction

Use the Phase 1 map to select one small `GameClient` extraction. Good
candidates are non-rule, non-AI helpers near display formatting, local UI state,
or request helpers that already have a nearby pattern such as
`src/components/game/streamingContinue.ts`.

### Phase 3: Mobile And Room Surface Alignment

Apply the same boundary pattern to `RoomClient.tsx` and `src/components/rooms`.
Do this only after Phase 1 and one small Phase 2 extraction prove the workflow.

### Phase 4: Core Engine And AI Planning

After frontend boundaries are stable, create separate designs for AI helper
extraction and rules/server extraction. These should be separate task tracks
because they require stronger behavior tests and can affect game correctness.

## Out Of Scope

- No immediate rewrite of `GameClient.tsx`, `RoomClient.tsx`, `engine.ts`,
  `roomService.ts`, or AI provider files.
- No dependency or framework migration.
- No changes to `.env`, databases, generated caches, production deployment, or
  public Alpha server state.
- No visual redesign as part of the structure planning task.

## Success Criteria

- Future frontend agents can tell whether a proposed change belongs in
  `GameClient.tsx`, `src/components/game/**`, `RoomClient.tsx`,
  `src/components/rooms/**`, or `src/app/globals.css`.
- The first task card is narrow enough to execute without touching rules, AI,
  server, API routes, database files, or deployment.
- Verification requirements are explicit before any code movement starts.
- Any skipped browser/manual check has a clear reason and residual risk.

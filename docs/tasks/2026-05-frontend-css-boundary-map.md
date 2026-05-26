# 任务卡：前端 CSS 与结构边界地图

## Task

Short name: frontend css boundary map

Goal: Create the first low-risk frontend structure task from the frontend
boundary design: map `src/app/globals.css` sections and document the safe
boundary between `GameClient.tsx`, `src/components/game/**`, `RoomClient.tsx`,
`src/components/rooms/**`, and global styles.

Why it matters: The structure audit shows `src/app/globals.css`,
`src/components/RoomClient.tsx`, and `src/components/GameClient.tsx` are major
frontend pressure points. The repo already has useful extracted frontend
components, so the next improvement should make the existing boundaries
explicit before moving more behavior.

## Task Gate

Task type: Structure / framework audit

Risk level: low

Required verification tier:

- [x] Docs/readback only
- [ ] Focused automated test
- [ ] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL:
- If skipped, reason: This first task is planning and boundary mapping only. It
  must not change rendered UI or CSS behavior.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because: State updates are required for this tracked structure
  task.

Skipped checks must record:

- Check skipped: Browser/manual flow
- Reason: No rendered behavior should change in this planning task.
- Residual risk: The map may miss a visual coupling that only becomes obvious
  when CSS is later moved.

## Context To Read First

- `AGENTS.md`
- `feature_list.json`
- `progress.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`

## Allowed Scope

Files or directories the agent may edit:

- `docs/tasks/2026-05-frontend-css-boundary-map.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `progress.md`
- `session-handoff.md`
- `feature_list.json`
- `src/app/globals.css` only for non-behavioral section comments or grouping
  if the agent explicitly records that no selectors, declarations, or ordering
  semantics changed

Files or directories the agent should not edit:

- `src/components/**`
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

- The current CSS section map is documented with enough detail for a later
  agent to choose a safe first CSS move.
- The intended frontend ownership boundaries are recorded in the relevant docs
  or in this task card.
- Any `globals.css` edit is non-behavioral and reviewed by reading back the
  changed sections.
- The next executable frontend refactor candidate is named.
- Verification results are recorded in the handoff.

## Verification

Required checks:

- `npm run audit:structure`
- `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run lint` if JavaScript, TypeScript, package scripts, or meaningful CSS
  structure changes are made.
- Browser/mobile manual verification if selectors, declarations, layout order,
  or rendered behavior changes.

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
- Read the frontend structure design, architecture doc, feature registry,
  frontend thread doc, and current `src/app/globals.css` outline.
- Confirmed no production code movement is needed for this phase.
- Recorded the current CSS section map and ownership boundary for future
  frontend agents.

Current CSS map:
- Lines 1-43: global Tailwind import, root theme tokens, body/html base styles,
  and app-wide scroll behavior.
- Lines 44-65: small shared mobile/home/AI-pool utility selectors that currently
  live before the main phone media block.
- Lines 66-487: phone-only landing, AI pool, and early mobile layout rules under
  `@media (max-width: 639px)`.
- Lines 488-1154: desktop/shared game presentation rules, including role intro,
  idiot reveal, phase curtain, phase rhythm, flow status, table stage, night
  actions, vote surfaces, review debug UI, seat token, voice wave, and speech
  cursor styles.
- Lines 1155-1350: admin/metrics dashboard visual system.
- Lines 1351-2079: animation keyframes for metrics, role reveal, phase
  curtains, table/seat motion, mobile seat feedback, voice wave, vote reveal,
  and speech cursor.
- Lines 2080-4464: main phone-only game, room lobby, drawer, mobile table,
  mobile action, and mobile room layout rules under `@media (max-width: 639px)`.
- Lines 4465-4505: compact-height phone overrides under
  `@media (max-width: 639px) and (max-height: 700px)`.
- Lines 4506-4595: reduced-motion overrides.
- Lines 4596-4602: final narrow mobile overflow guard under
  `@media (max-width: 640px)`.

Ownership boundary:
- `GameClient.tsx` remains the single-player game orchestration layer.
- `src/components/game/**` owns presentational table/game UI, mobile table
  surfaces, and pure frontend view helpers.
- `RoomClient.tsx` remains the room orchestration layer.
- `src/components/rooms/**` should own future room lobby/table presentation and
  pure room UI models.
- `src/app/globals.css` remains a temporary shared style surface. Future CSS
  work should first add non-behavioral section headers, then consider physical
  splitting only after the import mechanism is chosen.

Next executable frontend refactor candidate:
- Completed: added explicit non-behavioral section comments to
  `src/app/globals.css` using the map above, without moving selectors or
  changing declarations.
- Next candidate: choose one small `GameClient` helper extraction that can be
  protected by a focused test.

Changed files:
- `docs/tasks/2026-05-frontend-css-boundary-map.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `src/app/globals.css`

Verification:
- `npm run audit:structure` passed before CSS comments were added.
- `npm run audit:structure` passed after CSS comments were added.
- `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md docs/tasks/2026-05-gameclient-recent-games-store.md` passed.
- `npm run harness:check` passed.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.

Remaining risks:
- The CSS map is line-based and will drift as styles move.
- Some selectors in the large mobile media block mix game-table and room-lobby
  concerns; those should not be separated without visual verification.

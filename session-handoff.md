# Session Handoff

## Current Objective

- Goal: Complete the three recommended `GameClient.tsx` helper extractions under the harness.
- Current status: Auto-advance, host audio cue, and AI speech audio helpers have been extracted into focused `src/components/game/**` modules with tests. `GameClient.tsx` is now primarily orchestration for state, refs, effects, and callbacks.
- Branch / commit: `main`; latest committed baseline before this task was `6da7e55`.

## Completed This Session

- [x] Added task gate fields to `docs/tasks/HARNESS_TASK_TEMPLATE.md`.
- [x] Added `scripts/task-card-check.mjs` and `npm run harness:task-card`.
- [x] Updated `scripts/harness-check.mjs` to guard task gate markers.
- [x] Added `docs/tasks/2026-05-task-execution-gate.md`.
- [x] Updated `feature_list.json` and `progress.md` for the new harness capability.
- [x] Created `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`.
- [x] Created `docs/tasks/2026-05-frontend-css-boundary-map.md`.
- [x] Recorded `frontend-structure-boundaries` in `feature_list.json`.
- [x] Updated `progress.md` with the selected frontend/CSS-first planning direction.
- [x] Created `docs/superpowers/plans/2026-05-26-frontend-css-boundary-map.md`.
- [x] Recorded the current `src/app/globals.css` section map in the frontend CSS task card.
- [x] Updated `docs/architecture.md` and `docs/feature-registry.md` so future frontend structure work starts from the new boundary docs.
- [x] Added non-behavioral section comments to `src/app/globals.css`.
- [x] Created `docs/tasks/2026-05-gameclient-recent-games-store.md`.
- [x] Added `src/components/game/recentGamesStore.ts` and focused tests.
- [x] Updated `src/components/GameClient.tsx` to import recent-game store helpers instead of owning the storage/cache implementation.
- [x] Created `docs/tasks/2026-05-gameclient-helper-extractions.md`.
- [x] Created `docs/superpowers/plans/2026-05-26-gameclient-helper-extractions.md`.
- [x] Added `src/components/game/autoAdvance.ts` and `src/components/game/autoAdvance.test.ts`.
- [x] Added `src/components/game/hostAudioCues.ts` and `src/components/game/hostAudioCues.test.ts`.
- [x] Added `src/components/game/aiSpeechAudio.ts` and `src/components/game/aiSpeechAudio.test.ts`.
- [x] Updated `src/components/GameClient.tsx` to import the extracted helpers and keep orchestration local.
- [x] Updated `feature_list.json` and `progress.md` for the new helper extraction features.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Task-card gate | `npm run harness:task-card -- docs/tasks/HARNESS_TASK_TEMPLATE.md docs/tasks/2026-05-task-execution-gate.md` | passed | Confirms required task-card gate sections. |
| Harness check | `npm run harness:check` | passed | Confirms gate markers and harness files/scripts. |
| Lint | `npm run lint` | passed | Confirms the new Node script parses under the repo lint rules. |
| Frontend task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md` | passed | Confirms the first frontend structure task includes required gate fields. |
| Feature list JSON | `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"` | passed | Confirms feature tracker JSON remains valid. |
| Structure audit | `npm run audit:structure` | passed | Confirms the current structure signals and CSS pressure point remain visible. |
| Recent-game focused test | `npm run test -- src/components/game/recentGamesStore.test.ts` | passed | Confirms the extracted helper behavior. |
| Frontend task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md docs/tasks/2026-05-gameclient-recent-games-store.md` | passed | Confirms both frontend task cards satisfy the harness gate. |
| Lint | `npm run lint` | passed | Confirms TS/CSS/doc-adjacent code style. |
| TypeScript | `npx tsc --noEmit` | passed | Confirms the extracted helper import path and types. |
| Helper focused tests | `npm run test -- src/components/game/autoAdvance.test.ts src/components/game/hostAudioCues.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | Confirms all three extracted helper modules. |
| Lint | `npm run lint` | passed | Confirms there are no ESLint errors or warnings after the extraction. |
| TypeScript | `npx tsc --noEmit` | passed | Confirms extracted helper imports and types. |
| Build | `npm run build` | passed | Production build passed; Next/Turbopack repeated the existing NFT trace warning for `next.config.ts` -> `src/server/roomService.ts`. |
| Helper task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-gameclient-helper-extractions.md` | passed | Confirms the new task card satisfies harness fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Structure audit | `npm run audit:structure` | passed | Confirms structure audit still passes; `GameClient.tsx` dropped to 1028 lines in the audit output. |
| Local main-game smoke | `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000` | passed | Covered local 6p beginner seer creation, retry path for non-night human roles, a werewolf night action, stream continue, and final `DAY_SPEECH`. |

## Files Changed

- `docs/tasks/HARNESS_TASK_TEMPLATE.md`
- `docs/tasks/2026-05-task-execution-gate.md`
- `scripts/task-card-check.mjs`
- `scripts/harness-check.mjs`
- `package.json`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`
- `docs/superpowers/plans/2026-05-26-frontend-css-boundary-map.md`
- `docs/tasks/2026-05-frontend-css-boundary-map.md`
- `docs/tasks/2026-05-gameclient-recent-games-store.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `src/app/globals.css`
- `src/components/GameClient.tsx`
- `src/components/game/recentGamesStore.ts`
- `src/components/game/recentGamesStore.test.ts`
- `docs/tasks/2026-05-gameclient-helper-extractions.md`
- `docs/superpowers/plans/2026-05-26-gameclient-helper-extractions.md`
- `src/components/game/autoAdvance.ts`
- `src/components/game/autoAdvance.test.ts`
- `src/components/game/hostAudioCues.ts`
- `src/components/game/hostAudioCues.test.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`

## Decisions Made

- Future non-trivial work should start from a task card that declares task type, risk, required verification tier, browser/manual decision, state updates, and skipped-check rationale.
- Keep the checker structural: it verifies required fields exist, while `docs/verification-matrix.md` remains the source for choosing meaningful checks.
- Start framework optimization from frontend/CSS boundaries, not from rules/server or AI internals.
- Use an agent-friendly roadmap with conservative execution: Phase 1 maps CSS and frontend ownership, Phase 2 extracts one small `GameClient` helper, Phase 3 aligns room UI, Phase 4 plans AI and engine/server work separately.
- Keep `GameClient.tsx` as the orchestration layer for now. Extract helpers only when a focused test can describe the boundary first.
- Host audio playback remains in `GameClient.tsx` because it owns refs and status state; only cue construction moved out.
- AI speech audio queue and preparation helpers moved out, while network fetch and playback status updates remain in `GameClient.tsx`.

## Blockers / Risks

- The task-card checker verifies required fields but cannot judge whether the chosen checks are sufficient.
- Docs-only and harness-only work still needs human judgment about whether broader code checks are necessary.
- The frontend structure plan does not reduce source line count yet; it creates the route for a later low-risk refactor.
- The CSS map is line-based and should be refreshed after any large style move.
- The large phone media block mixes mobile game table and mobile room lobby styles, so later physical splitting needs visual verification.
- Browser/manual recent-game flow was skipped because rendered UI did not change; run home -> start game -> return home -> recent game list if this storage path is touched again.
- Production/release checks were skipped because this was a local frontend structure refactor with no deploy or public configuration change.
- Browser-render visual flow was skipped because layout and visible UI were not changed; local `smoke:main-game` was used for the auto-advance/audio gating surface.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json` and `progress.md`.
3. Review this handoff.
4. Read `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`.
5. Read `docs/tasks/2026-05-frontend-css-boundary-map.md`.
6. Read `docs/tasks/2026-05-gameclient-helper-extractions.md` if continuing frontend slimming.
7. Run `powershell -NoProfile -ExecutionPolicy Bypass -File init.ps1`, `./init.sh`, or `npm run harness:check` before editing.

## Recommended Next Step

- Next recommended code-facing step: review and optionally commit this extraction batch. If continuing frontend slimming, pick a UI presentation/action-panel boundary next rather than more audio flow work in the same batch.

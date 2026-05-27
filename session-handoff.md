# Session Handoff

## Current Objective

- Goal: Implement the `/ai-pool` character roster workflow under the harness.
- Current status: Implementation is complete and deployed to Tencent Cloud primary Alpha. Next step is user inspection and merge decision.
- Branch / commit: `codex/ai-pool-character-roster`; latest deployed source is `a6be5d8`.

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
- [x] Created `docs/tasks/2026-05-gameclient-lineup-preview-model.md`.
- [x] Created `docs/superpowers/plans/2026-05-26-gameclient-lineup-preview-model.md`.
- [x] Added `src/components/game/landingLineupPreview.ts` and `src/components/game/landingLineupPreview.test.ts`.
- [x] Updated `src/components/GameClient.tsx` to import the lineup preview helper.
- [x] Updated `feature_list.json` and `progress.md` for the new lineup preview model feature.
- [x] Created `docs/tasks/2026-05-gameclient-event-feed-model.md`.
- [x] Created `docs/superpowers/plans/2026-05-26-gameclient-event-feed-model.md`.
- [x] Added `src/components/game/tableEventFeed.ts` and `src/components/game/tableEventFeed.test.ts`.
- [x] Updated `src/components/GameClient.tsx` to import the table event feed helper.
- [x] Updated `feature_list.json` and `progress.md` for the new event feed model feature.
- [x] Created `docs/tasks/2026-05-gameclient-board-selection-model.md`.
- [x] Created `docs/superpowers/plans/2026-05-26-gameclient-board-selection-model.md`.
- [x] Added `resolveBoardSelectionToggle` to `src/components/game/boardSelectionModel.ts`.
- [x] Added focused board transition coverage to `src/components/game/boardSelectionModel.test.ts`.
- [x] Updated `src/components/GameClient.tsx` to import the board selection transition helper.
- [x] Updated `feature_list.json` and `progress.md` for the new board selection model feature.
- [x] Created `docs/tasks/2026-05-frontend-structure-review.md`.
- [x] Created `docs/superpowers/specs/2026-05-26-frontend-structure-review.md`.
- [x] Updated `feature_list.json` and `progress.md` for the structure review feature.
- [x] Created `docs/tasks/2026-05-gameclient-lifecycle-requests.md`.
- [x] Created `docs/superpowers/plans/2026-05-26-gameclient-lifecycle-requests.md`.
- [x] Added `src/components/game/gameClientRequests.ts`.
- [x] Added `src/components/game/gameClientRequests.test.ts`.
- [x] Updated `src/components/GameClient.tsx` to import lifecycle request helpers while keeping orchestration local.
- [x] Updated `feature_list.json` and `progress.md` for the lifecycle request feature.
- [x] Created `docs/superpowers/specs/2026-05-27-ai-pool-bulk-llm-presets-design.md`.
- [x] Created `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`.
- [x] Recorded the planned feature in `feature_list.json`.
- [x] Updated `progress.md` and this handoff for the design review state.
- [x] Created `docs/superpowers/plans/2026-05-27-ai-pool-bulk-llm-presets.md`.
- [x] Added `src/components/game/aiFriendLlmPresets.ts` and focused tests.
- [x] Added `src/app/api/ai-config/test-llm/route.ts` and focused route tests.
- [x] Added the bulk LLM preset panel to `src/components/AiPoolClient.tsx`.
- [x] Updated mobile/static layout coverage and responsive CSS hooks.
- [x] Verified desktop and 390x844 mobile `/ai-pool` in the in-app Browser.
- [x] Created `docs/superpowers/specs/2026-05-27-ai-pool-character-roster-design.md`.
- [x] Created `docs/tasks/2026-05-ai-pool-character-roster.md`.
- [x] Created `docs/superpowers/plans/2026-05-27-ai-pool-character-roster.md`.
- [x] Recorded the planned character roster feature in `feature_list.json` and `progress.md`.
- [x] Added local role-card storage, validation, safe role-only import/export, append, and overwrite behavior.
- [x] Propagated role cards from `/api/games` into AI personas.
- [x] Added role-card guidance to real LLM speech and action prompts while keeping user-authored role text out of the action system prompt.
- [x] Upgraded `/ai-pool` into a character roster UI with avatar, role name, source, speaking style, reasoning style, avoid field, mock warning, and import/export controls.
- [x] Verified the visible `/ai-pool` flow on desktop and mobile viewports with Chrome headless.
- [x] Fixed the Prisma transaction client type annotation that blocked production `next build`.
- [x] Deployed the character roster build to Tencent Cloud primary Alpha at `https://175.178.199.245`.

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
| Lineup preview focused test | `npm run test -- src/components/game/landingLineupPreview.test.ts` | passed | Confirms fixed-seat, spectator-mode, and not-ready preview behavior. |
| Lint | `npm run lint` | passed | Confirms the extraction has no ESLint errors or warnings. |
| TypeScript | `npx tsc --noEmit` | passed | Confirms the new helper import and types. |
| Lineup preview task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lineup-preview-model.md` | passed | Confirms the new task card satisfies harness fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Structure audit | `npm run audit:structure` | passed | Confirms structure audit still passes; `GameClient.tsx` dropped to 1004 lines in the audit output. |
| Event feed focused test | `npm run test -- src/components/game/tableEventFeed.test.ts` | passed | Confirms speech events are filtered, newest 18 events are kept, and output is newest-first. |
| Lint | `npm run lint` | passed | Confirms the extraction has no ESLint errors or warnings. |
| TypeScript | `npx tsc --noEmit` | passed | Confirms the new helper import and event fixture types. |
| Event feed task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-gameclient-event-feed-model.md` | passed | Confirms the new task card satisfies harness fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Structure audit | `npm run audit:structure` | passed | Confirms structure audit still passes; `GameClient.tsx` dropped to 1002 lines in the audit output. |
| Board selection focused test | `npm run test -- src/components/game/boardSelectionModel.test.ts` | passed | Confirms board toggle, spectator mode, fixed-seat preservation, and invalid fixed-seat fallback behavior. |
| Lint | `npm run lint` | passed | Confirms the extraction has no ESLint errors or warnings. |
| TypeScript | `npx tsc --noEmit` | passed | Confirms the helper import and narrowed board input type. |
| Board selection task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-gameclient-board-selection-model.md` | passed | Confirms the new task card satisfies harness fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Structure audit | `npm run audit:structure` | passed | Confirms structure audit still passes; `GameClient.tsx` dropped to 993 lines in the audit output. |
| Structure review task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-frontend-structure-review.md` | passed | Confirms the review task card satisfies harness fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Feature list JSON | `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"` | passed | Confirms feature tracker JSON remains valid. |
| Diff check | `git diff --check` | passed | Only CRLF conversion warnings from Git were reported. |
| Lifecycle request RED test | `npm run test -- src/components/game/gameClientRequests.test.ts` | failed as expected | Failed because `./gameClientRequests` did not exist yet. |
| Lifecycle request focused test | `npm run test -- src/components/game/gameClientRequests.test.ts` | passed | Confirms load, create, normal command submission, and stream context helpers. |
| TypeScript | `npx tsc --noEmit` | passed | Confirms GameClient helper imports and request helper types. |
| Lint | `npm run lint` | passed | Confirms no ESLint errors or warnings after extraction. |
| Lifecycle request task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lifecycle-requests.md` | passed | Confirms the new task card satisfies harness fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Structure audit | `npm run audit:structure` | passed | Confirms structure audit still passes; `GameClient.tsx` is 987 lines in the audit output. |
| Local main-game smoke | `npm run smoke:main-game -- --base-url=http://127.0.0.1:3010` | passed | Covered local 6p beginner seer creation, a werewolf night action, stream continue, and final `DAY_SPEECH`. |
| Build | `npm run build` | passed | Production build passed with the existing Turbopack NFT warning for `next.config.ts` -> `src/server/roomService.ts`. |
| AI pool preset design checks | `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`; `npm run harness:check`; `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`; `git diff --check` | passed | `git diff --check` reported only CRLF replacement warnings for existing Windows line-ending behavior. |
| AI pool preset focused tests | `npm run test -- src/components/game/aiFriendLlmPresets.test.ts src/app/api/ai-config/test-llm/route.test.ts src/components/AiPoolClient.mobile.test.ts` | passed | Covers local preset storage/apply, test route redaction, and static UI placement. |
| AI pool preset lint | `npm run lint` | passed | Caught and fixed an initial React purity issue from generating ids during render. |
| AI pool preset typecheck | `npx tsc --noEmit` | passed | Confirms route and client types. |
| AI pool browser desktop | Browser at `http://127.0.0.1:3010/ai-pool` | passed | Bulk panel opened; preset fields, shortcuts, test, apply buttons present; single-AI model/voice config remained reachable. |
| AI pool browser mobile | Browser viewport `390x844` at `http://127.0.0.1:3010/ai-pool` | passed | Bulk entry and opened panel controls were reachable in phone viewport. |
| AI pool build | `npm run build` | passed | Existing Turbopack NFT warning for `next.config.ts` -> `src/server/roomService.ts` remained. |
| Character roster task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-character-roster.md` | passed | Confirms the new role roster task card satisfies harness fields. |
| Character roster focused tests | `npm run test -- src/components/game/aiFriendRoleRoster.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/AiPoolClient.mobile.test.ts` | passed | 5 files, 113 tests. Covers role roster storage/import/export, API propagation, prompt wiring, and static UI. |
| Character roster lint | `npm run lint` | passed | Passed with two existing unused-parameter warnings in `src/ai/speechProviders.test.ts`. |
| Character roster typecheck | `npx tsc --noEmit` | passed | Confirms role-card type propagation. |
| Character roster build | `npm run prisma:generate`; `npm run build` | passed | Build passed with the existing Turbopack NFT warning for `next.config.ts` -> `src/server/roomService.ts`. |
| Character roster browser desktop | Chrome headless at `http://127.0.0.1:3011/ai-pool` | passed | Verified roster, source text, mock warning, import/export, quick add, and queue visibility without horizontal overflow. |
| Character roster browser mobile | Chrome headless 390x844 at `http://127.0.0.1:3011/ai-pool` | passed | Verified roster cards, source text, mock warning, import/export, and import dialog append/overwrite controls without horizontal overflow. |
| Tencent Cloud candidate build | server `docker build` from clean archive | passed | Docker build ran `npm ci`, `npm run prisma:generate`, `npm run build`, and `npm prune --omit=dev`. |
| Tencent Cloud preflight | `npm run preflight:production -- --base-url=https://175.178.199.245` | passed | `ok=true`, production minimum checks passed. |
| Tencent Cloud room SSE smoke | `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm run smoke:room-sse` | passed | `ok=true`, room `RPBY6V`, host seat `1`, guest seat `2`. |
| Tencent Cloud main-game smoke | `npm run smoke:main-game -- --base-url=https://175.178.199.245` | passed | `ok=true`, board `6p-beginner-seer`, human seat `1`, submitted `wolfKill`, final phase `DAY_SPEECH`. |
| Tencent Cloud AI pool probe | `curl.exe -k -L --max-time 30 https://175.178.199.245/ai-pool` | passed | Public HTML includes the character roster labels and role-card fields. |

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
- `docs/tasks/2026-05-gameclient-lineup-preview-model.md`
- `docs/superpowers/plans/2026-05-26-gameclient-lineup-preview-model.md`
- `src/components/game/landingLineupPreview.ts`
- `src/components/game/landingLineupPreview.test.ts`
- `docs/tasks/2026-05-gameclient-event-feed-model.md`
- `docs/superpowers/plans/2026-05-26-gameclient-event-feed-model.md`
- `src/components/game/tableEventFeed.ts`
- `src/components/game/tableEventFeed.test.ts`
- `docs/tasks/2026-05-gameclient-board-selection-model.md`
- `docs/superpowers/plans/2026-05-26-gameclient-board-selection-model.md`
- `docs/tasks/2026-05-frontend-structure-review.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-review.md`
- `docs/tasks/2026-05-gameclient-lifecycle-requests.md`
- `docs/superpowers/plans/2026-05-26-gameclient-lifecycle-requests.md`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `docs/superpowers/specs/2026-05-27-ai-pool-bulk-llm-presets-design.md`
- `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`
- `docs/superpowers/plans/2026-05-27-ai-pool-bulk-llm-presets.md`
- `src/components/game/aiFriendLlmPresets.ts`
- `src/components/game/aiFriendLlmPresets.test.ts`
- `src/app/api/ai-config/test-llm/route.ts`
- `src/app/api/ai-config/test-llm/route.test.ts`
- `src/components/game/aiFriendRoleRoster.ts`
- `src/components/game/aiFriendRoleRoster.test.ts`
- `src/game/aiFriends.ts`
- `src/game/types.ts`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/components/AiPoolClient.tsx`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/server/gameService.ts`
- `docs/current-release.md`

## Decisions Made

- Future non-trivial work should start from a task card that declares task type, risk, required verification tier, browser/manual decision, state updates, and skipped-check rationale.
- Keep the checker structural: it verifies required fields exist, while `docs/verification-matrix.md` remains the source for choosing meaningful checks.
- Start framework optimization from frontend/CSS boundaries, not from rules/server or AI internals.
- Use an agent-friendly roadmap with conservative execution: Phase 1 maps CSS and frontend ownership, Phase 2 extracts one small `GameClient` helper, Phase 3 aligns room UI, Phase 4 plans AI and engine/server work separately.
- Keep `GameClient.tsx` as the orchestration layer for now. Extract helpers only when a focused test can describe the boundary first.
- Host audio playback remains in `GameClient.tsx` because it owns refs and status state; only cue construction moved out.
- AI speech audio queue and preparation helpers moved out, while network fetch and playback status updates remain in `GameClient.tsx`.
- Landing-page lineup preview is now treated as a UI data model, while `GameClient.tsx` keeps only memoization and state wiring for it.
- Table event feed filtering and ordering is now treated as a UI data model, while `GameClient.tsx` keeps only memoization and prop wiring for it.
- Board toggle and human-seat transition rules are now treated as landing UI state modeling, while `GameClient.tsx` keeps only state setter wiring for them.
- Stop micro-extracting tiny helpers for now. The next useful code-facing boundary is a medium-risk `gameClientRequests` extraction that separates request construction/response parsing from UI orchestration.
- Game lifecycle request construction, response parsing, and stream-continue speech context are now treated as a frontend request boundary. `GameClient.tsx` should keep state transitions, refs, and UI orchestration local.
- AI pool real-model setup should move toward local LLM presets plus bulk apply to currently selected AI friends. First implementation slice should cover LLM only, while reserving the same framework for TTS later.
- Character roster role-play text should guide model behavior without becoming hard authority. The action provider keeps role-card text in prompt input data, while system text remains reserved for legal-action and private-info guardrails.

## Blockers / Risks

- The task-card checker verifies required fields but cannot judge whether the chosen checks are sufficient.
- Docs-only and harness-only work still needs human judgment about whether broader code checks are necessary.
- The frontend structure plan does not reduce source line count yet; it creates the route for a later low-risk refactor.
- The CSS map is line-based and should be refreshed after any large style move.
- The large phone media block mixes mobile game table and mobile room lobby styles, so later physical splitting needs visual verification.
- Browser/manual recent-game flow was skipped because rendered UI did not change; run home -> start game -> return home -> recent game list if this storage path is touched again.
- Production/release checks were skipped because this was a local frontend structure refactor with no deploy or public configuration change.
- Browser-render visual flow was skipped because layout and visible UI were not changed; local `smoke:main-game` was used for the auto-advance/audio gating surface.
- Browser/manual flow was skipped for lineup preview because the rendered layout and interactions did not change; the pure calculation is covered by focused tests.
- Browser/manual flow was skipped for event feed because the rendered layout and interactions did not change; the pure calculation is covered by focused tests.
- Browser/manual flow was skipped for board selection because the intended behavior is unchanged and covered by focused transition tests.
- Browser/manual flow and automated code tests were skipped for the structure review because no production code changed.
- Browser/manual flow was skipped for lifecycle requests because the visible UI contract did not change; local `smoke:main-game` covered creation, command submission, stream continue, and `DAY_SPEECH`.
- The first smoke attempt against `http://127.0.0.1:3000` timed out because an old dev server process was unhealthy. PID `47860` was stopped and a clean dev server on `http://127.0.0.1:3010` passed the smoke.
- Production/release checks were skipped because no deployment, public URL, or runtime configuration changed.
- Real-provider connection testing was skipped because no safe disposable API key was provided and the test route can create model cost.
- In-app Browser screenshot capture timed out, so the UI verification evidence is DOM/viewport based rather than screenshot based.
- Real-provider role-play validation was skipped because no safe disposable API key was provided and live model calls can create cost.
- Render mirror was not deployed; this rollout targeted the Tencent Cloud primary Alpha only.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json` and `progress.md`.
3. Review this handoff.
4. Read `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`.
5. Read `docs/tasks/2026-05-frontend-css-boundary-map.md`.
6. Read `docs/tasks/2026-05-gameclient-helper-extractions.md` if continuing frontend slimming.
7. Read `docs/tasks/2026-05-gameclient-lineup-preview-model.md` if continuing landing-page model extraction.
8. Read `docs/tasks/2026-05-gameclient-event-feed-model.md` if continuing table event-feed model extraction.
9. Read `docs/tasks/2026-05-gameclient-board-selection-model.md` if continuing landing board-selection model extraction.
10. Read `docs/superpowers/specs/2026-05-26-frontend-structure-review.md` before starting the next larger frontend boundary.
11. Read `docs/tasks/2026-05-gameclient-lifecycle-requests.md` if touching single-player lifecycle requests again.
12. Read `docs/superpowers/specs/2026-05-27-ai-pool-bulk-llm-presets-design.md` and `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md` before editing AI pool preset work.
13. Read `docs/superpowers/specs/2026-05-27-ai-pool-character-roster-design.md`, `docs/tasks/2026-05-ai-pool-character-roster.md`, and `docs/superpowers/plans/2026-05-27-ai-pool-character-roster.md` before editing character roster work.
14. Run `powershell -NoProfile -ExecutionPolicy Bypass -File init.ps1`, `./init.sh`, or `npm run harness:check` before editing.

## Recommended Next Step

- Next recommended step: let the user inspect `https://175.178.199.245/ai-pool`; if accepted, merge the worktree branch back to the main checkout.

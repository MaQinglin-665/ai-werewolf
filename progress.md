# Session Progress Log

## Current State

**Last Updated:** 2026-05-27 01:30 Asia/Shanghai
**Session ID:** ai-pool character roster
**Active Feature:** ai-pool-character-roster - AI Pool Character Roster

## Status

### What's Done

- [x] Core repository harness exists in `AGENTS.md` and `docs/harness-*`.
- [x] Verification routing exists in `docs/verification-matrix.md`.
- [x] Feature/code routing exists in `docs/feature-registry.md`.
- [x] Mechanical harness check exists as `npm run harness:check`.
- [x] Single-player main game smoke exists as `npm run smoke:main-game`.
- [x] Standard lifecycle files exist: `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`, and `init.ps1`.
- [x] External `harness-creator` structural score improved from `32/100` to `100/100`.
- [x] Structure pressure points identified: `src/ai/speechProviders.ts`, `src/server/roomService.ts`, `src/game/engine.ts`, `src/components/GameClient.tsx`, `src/app/globals.css`.
- [x] `npm run audit:structure` added and verified.
- [x] Task-card gate fields added to `docs/tasks/HARNESS_TASK_TEMPLATE.md`.
- [x] `npm run harness:task-card -- <task-file>` added for mechanical task-card checks.
- [x] `npm run harness:check` now guards task gate markers.
- [x] Frontend structure planning direction selected: agent-friendly roadmap, conservative execution, and long-term framework target.
- [x] Frontend boundary design created for `GameClient.tsx`, `src/components/game/**`, `RoomClient.tsx`, `src/components/rooms/**`, and `src/app/globals.css`.
- [x] First low-risk frontend task card created for CSS and structure boundary mapping.
- [x] Current `src/app/globals.css` section map recorded in `docs/tasks/2026-05-frontend-css-boundary-map.md`.
- [x] Frontend ownership boundaries routed through `docs/architecture.md` and `docs/feature-registry.md`.
- [x] Non-behavioral section comments added to `src/app/globals.css` without moving selectors or declarations.
- [x] Recent-game localStorage and subscription helpers extracted from `GameClient.tsx` to `src/components/game/recentGamesStore.ts`.
- [x] Focused recent-game store tests added and watched fail before implementation, then pass after extraction.
- [x] Auto-advance delay and AI speech selection helpers extracted to `src/components/game/autoAdvance.ts`.
- [x] Host audio cue and clip helpers extracted to `src/components/game/hostAudioCues.ts`.
- [x] AI speech audio cue, TTS chunking, streaming queue, unavailable-error, and audio preparation helpers extracted to `src/components/game/aiSpeechAudio.ts`.
- [x] Focused helper tests added and watched fail before implementation, then pass after each extraction.
- [x] Local main-game smoke passed after the helper extractions.
- [x] Landing-page AI lineup preview calculation extracted to `src/components/game/landingLineupPreview.ts`.
- [x] Focused lineup preview tests added and watched fail before implementation, then pass after extraction.
- [x] Table event feed filtering, limit, and ordering extracted to `src/components/game/tableEventFeed.ts`.
- [x] Focused event feed tests added and watched fail before implementation, then pass after extraction.
- [x] Landing-page board toggle and human-seat transition rules extracted to `src/components/game/boardSelectionModel.ts`.
- [x] Focused board selection transition tests added and watched fail before implementation, then pass after extraction.
- [x] `GameClient.tsx` dropped below 1000 lines in `npm run audit:structure`.
- [x] Frontend structure review recorded current `GameClient.tsx` responsibilities and the next larger lifecycle request boundary.
- [x] Game lifecycle request helpers extracted to `src/components/game/gameClientRequests.ts`.
- [x] Focused lifecycle request tests added and watched fail before implementation, then pass after extraction.
- [x] Local main-game smoke passed on a clean dev server at `http://127.0.0.1:3010`.
- [x] AI Pool Bulk LLM Presets implemented for `/ai-pool`: local presets, bulk apply, user-triggered test route, responsive panel, and result summary.
- [x] AI Pool Character Roster design approved and implementation plan written.

### What's In Progress

- [ ] AI Pool Character Roster implementation is planned but not started.
  - Details: `/ai-pool` should become a local character roster with role-card fields, safe role-only import/export, and real LLM speech/action role-play guidance.
  - Blockers: none.

### What's Next

1. Ask the user to choose execution mode for `docs/superpowers/plans/2026-05-27-ai-pool-character-roster.md`.
2. If implementation starts, follow the plan task-by-task and keep commits focused.
3. Skip real-provider role-play validation unless the user provides a safe disposable key and accepts possible model cost.

## Blockers / Risks

- [x] Generic validators may under-score project-specific docs unless standard root files route to them.
- [x] `init.sh` is a Bash entrypoint; on Windows, use `init.ps1`.
- [x] The task-card checker verifies structure, not judgment quality; agents still need to choose checks from `docs/verification-matrix.md`.
- [x] Frontend planning does not reduce line count yet; it creates the route for a later low-risk refactor.
- [ ] The CSS map is line-based and will drift as styles move.
- [x] Local `smoke:main-game` passed after touching auto-advance and audio gating helpers.
- [ ] Browser-render visual flow was not exercised because this batch moved helper logic without changing layout or visible UI.

## Decisions Made

- **Keep project-specific docs as primary detail**: standard root files are a compatibility and restart layer, not a replacement for `docs/harness-*`.
  - Context: `D:\ai-werewolf` already has a useful harness structure.
  - Alternatives considered: copying the generic templates verbatim, which would duplicate or obscure project-specific guidance.
- **Add a task execution gate to the template**: future non-trivial work should name task type, risk, verification tier, browser/manual decision, state updates, and skipped-check rationale.
  - Context: the harness is structurally mature; the next quality gain is reducing vague task closure.
  - Alternatives considered: relying on prose only in `AGENTS.md`, which is easier for agents to skip.
- **Start framework optimization from frontend/CSS boundaries**: use an agent-friendly roadmap, conservative execution, and long-term architecture as the framing.
  - Context: the structure audit found frontend pressure in `globals.css`, `RoomClient.tsx`, and `GameClient.tsx`, while existing `src/components/game` extractions mean a boundary map should come before more movement.
  - Alternatives considered: immediate AI helper extraction or rules/server extraction, both of which carry stronger behavior-risk and verification needs.

## Files Modified This Session

- `docs/tasks/HARNESS_TASK_TEMPLATE.md` - adds task gate fields.
- `docs/tasks/2026-05-task-execution-gate.md` - task card for this harness enhancement.
- `scripts/task-card-check.mjs` - mechanical task-card gate checker.
- `scripts/harness-check.mjs` - verifies the template still contains gate markers.
- `package.json` - adds `harness:task-card`.
- `feature_list.json` - records the task execution gate as completed harness capability.
- `progress.md` - records current harness state.
- `session-handoff.md` - records restart path and evidence.
- `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md` - frontend structure roadmap and boundaries.
- `docs/tasks/2026-05-frontend-css-boundary-map.md` - first frontend structure task card.
- `docs/superpowers/plans/2026-05-26-frontend-css-boundary-map.md` - implementation plan for the boundary-map task.
- `docs/architecture.md` - records frontend structure governance boundaries.
- `docs/feature-registry.md` - routes future table UI structure work through the new design and task card.
- `src/app/globals.css` - adds non-behavioral section comments.
- `src/components/GameClient.tsx` - imports recent-game store helpers.
- `src/components/game/recentGamesStore.ts` - extracted recent-game localStorage and subscription helper.
- `src/components/game/recentGamesStore.test.ts` - focused helper coverage.
- `docs/tasks/2026-05-gameclient-recent-games-store.md` - task card and execution record for the GameClient slimming step.
- `docs/tasks/2026-05-gameclient-helper-extractions.md` - task card for the three helper extractions.
- `docs/superpowers/plans/2026-05-26-gameclient-helper-extractions.md` - implementation plan for the three helper extractions.
- `src/components/game/autoAdvance.ts` - extracted auto-advance and AI speech selection helpers.
- `src/components/game/autoAdvance.test.ts` - focused auto-advance helper coverage.
- `src/components/game/hostAudioCues.ts` - extracted host audio cue and clip helpers.
- `src/components/game/hostAudioCues.test.ts` - focused host audio cue coverage.
- `src/components/game/aiSpeechAudio.ts` - extracted AI speech audio cue, TTS queue, chunking, and audio preparation helpers.
- `src/components/game/aiSpeechAudio.test.ts` - focused AI speech audio helper coverage.
- `docs/tasks/2026-05-gameclient-lineup-preview-model.md` - task card for the landing lineup preview extraction.
- `docs/superpowers/plans/2026-05-26-gameclient-lineup-preview-model.md` - implementation plan for the lineup preview extraction.
- `src/components/game/landingLineupPreview.ts` - extracted landing lineup preview data model.
- `src/components/game/landingLineupPreview.test.ts` - focused landing lineup preview coverage.
- `docs/tasks/2026-05-gameclient-event-feed-model.md` - task card for the table event feed extraction.
- `docs/superpowers/plans/2026-05-26-gameclient-event-feed-model.md` - implementation plan for the event feed extraction.
- `src/components/game/tableEventFeed.ts` - extracted table event feed data model.
- `src/components/game/tableEventFeed.test.ts` - focused table event feed coverage.
- `docs/tasks/2026-05-gameclient-board-selection-model.md` - task card for board selection transition extraction.
- `docs/superpowers/plans/2026-05-26-gameclient-board-selection-model.md` - implementation plan for board selection transition extraction.
- `src/components/game/boardSelectionModel.ts` - extracted board selection transition model.
- `src/components/game/boardSelectionModel.test.ts` - focused board selection transition coverage.
- `docs/tasks/2026-05-frontend-structure-review.md` - task card for the accumulated frontend structure review.
- `docs/superpowers/specs/2026-05-26-frontend-structure-review.md` - review document naming the next larger frontend boundary.
- `docs/tasks/2026-05-gameclient-lifecycle-requests.md` - task card for the lifecycle request helper extraction.
- `docs/superpowers/plans/2026-05-26-gameclient-lifecycle-requests.md` - implementation plan for the lifecycle request helper extraction.
- `src/components/game/gameClientRequests.ts` - extracted lifecycle request helpers and stream-continue speech context.
- `src/components/game/gameClientRequests.test.ts` - focused request-helper coverage.
- `docs/superpowers/specs/2026-05-27-ai-pool-bulk-llm-presets-design.md` - design for local LLM presets, connection tests, and bulk apply in `/ai-pool`.
- `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md` - task card for the design and later implementation.
- `docs/superpowers/plans/2026-05-27-ai-pool-bulk-llm-presets.md` - implementation plan for the LLM preset workflow.
- `src/components/game/aiFriendLlmPresets.ts` - local preset storage, sanitization, and bulk apply rules.
- `src/components/game/aiFriendLlmPresets.test.ts` - focused preset storage and apply coverage.
- `src/app/api/ai-config/test-llm/route.ts` - user-triggered custom LLM test route.
- `src/app/api/ai-config/test-llm/route.test.ts` - API key redaction and route behavior coverage.
- `src/components/AiPoolClient.tsx` - bulk LLM preset panel and wiring.
- `src/components/AiPoolClient.mobile.test.ts` - static layout coverage for the bulk LLM entry.
- `src/app/globals.css` - responsive styling hooks for the bulk LLM panel.

## Evidence of Completion

- [x] Harness check: `npm run harness:check`
- [x] External structural validator: `node %TEMP%/learn-harness-engineering/skills/harness-creator/scripts/validate-harness.mjs --target D:/ai-werewolf`
- [x] Manual verification: external score improved from `32/100` to `100/100`.
- [x] Windows init: `powershell -NoProfile -ExecutionPolicy Bypass -File init.ps1`
- [x] Lint: `npm run lint`
- [x] Structure audit: `npm run audit:structure`
- [x] Task-card gate: `npm run harness:task-card -- docs/tasks/HARNESS_TASK_TEMPLATE.md docs/tasks/2026-05-task-execution-gate.md`
- [x] Frontend task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md docs/tasks/2026-05-gameclient-recent-games-store.md`
- [x] Recent-game focused test: `npm run test -- src/components/game/recentGamesStore.test.ts`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Helper focused tests: `npm run test -- src/components/game/autoAdvance.test.ts src/components/game/hostAudioCues.test.ts src/components/game/aiSpeechAudio.test.ts`
- [x] Lint: `npm run lint`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Build: `npm run build` passed with the existing Turbopack NFT warning for `next.config.ts` -> `src/server/roomService.ts`.
- [x] Helper task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-helper-extractions.md`
- [x] Harness check: `npm run harness:check`
- [x] Structure audit: `npm run audit:structure`
- [x] Local main-game smoke: `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000`
- [x] Lineup preview focused test: `npm run test -- src/components/game/landingLineupPreview.test.ts`
- [x] Lint: `npm run lint`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Lineup preview task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lineup-preview-model.md`
- [x] Harness check: `npm run harness:check`
- [x] Structure audit: `npm run audit:structure`
- [x] Event feed focused test: `npm run test -- src/components/game/tableEventFeed.test.ts`
- [x] Lint: `npm run lint`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Event feed task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-event-feed-model.md`
- [x] Harness check: `npm run harness:check`
- [x] Structure audit: `npm run audit:structure`
- [x] Board selection focused test: `npm run test -- src/components/game/boardSelectionModel.test.ts`
- [x] Lint: `npm run lint`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Board selection task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-board-selection-model.md`
- [x] Harness check: `npm run harness:check`
- [x] Structure audit: `npm run audit:structure`
- [x] Structure review task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-frontend-structure-review.md`
- [x] Harness check: `npm run harness:check`
- [x] Feature list JSON: `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`
- [x] Diff check: `git diff --check`
- [x] Lifecycle request focused test: `npm run test -- src/components/game/gameClientRequests.test.ts`
- [x] Lint: `npm run lint`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Lifecycle request task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lifecycle-requests.md`
- [x] Harness check: `npm run harness:check`
- [x] Structure audit: `npm run audit:structure`
- [x] Local main-game smoke: `npm run smoke:main-game -- --base-url=http://127.0.0.1:3010`
- [x] Build: `npm run build`
- [x] AI pool bulk LLM preset design checks: `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`; `npm run harness:check`; `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`; `git diff --check` passed with only CRLF warnings.
- [x] AI pool bulk preset focused tests: `npm run test -- src/components/game/aiFriendLlmPresets.test.ts src/app/api/ai-config/test-llm/route.test.ts src/components/AiPoolClient.mobile.test.ts`
- [x] AI pool bulk preset lint/type/build: `npm run lint`; `npx tsc --noEmit`; `npm run build`
- [x] AI pool browser checks: desktop and 390x844 mobile viewport at `http://127.0.0.1:3010/ai-pool`

## Notes for Next Session

Use `AGENTS.md` first. Then read this file, `feature_list.json`, and
`session-handoff.md` for restart state. Use `docs/verification-matrix.md` to
choose task-specific checks.

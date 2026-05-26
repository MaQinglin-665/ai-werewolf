# Frontend Structure Review

## Current Snapshot

`GameClient.tsx` has moved from a broad mixed-responsibility client into a smaller orchestration layer. The latest structure audit reports it at 993 lines, below the previous 1000-line pressure threshold.

Completed helper/model boundaries:

- Recent game storage: `src/components/game/recentGamesStore.ts`
- Auto-advance decisions: `src/components/game/autoAdvance.ts`
- Host audio cue construction: `src/components/game/hostAudioCues.ts`
- AI speech audio helpers: `src/components/game/aiSpeechAudio.ts`
- Landing AI lineup preview: `src/components/game/landingLineupPreview.ts`
- Table event feed model: `src/components/game/tableEventFeed.ts`
- Landing board selection transitions: `src/components/game/boardSelectionModel.ts`

## Remaining GameClient Responsibilities

`GameClient.tsx` still owns state, refs, effects, and callback wiring. That is acceptable for now, but several groups are now visible:

- Landing state and local startup hydration: board list, AI friends, selected friends, runtime mode, recent games.
- Audio orchestration: refs, run ids, status updates, playback callbacks, localStorage toggles.
- Game lifecycle API callbacks: load game, start game, return home, submit command, streaming continue handling.
- Overlay/effect orchestration: role intro, phase curtain, idiot reveal, auto-advance, host audio, AI speech playback.
- Render composition: mobile table, desktop table shell, overlays, and header wiring.

## Recommendation

Stop micro-extracting tiny pure helpers for the moment. The next useful frontend boundary should be a task-carded game lifecycle client boundary:

`src/components/game/gameClientRequests.ts`

Suggested scope:

- Move request-shape helpers for `loadGameById`, `startGame`, normal command submission, and streaming continue setup out of `GameClient.tsx`.
- Keep React state setters, refs, and UI status transitions inside `GameClient.tsx`.
- Do not move audio playback refs or auto-advance effects in the same batch.

Why this is the next meaningful boundary:

- It separates API request construction and response parsing from UI orchestration.
- It reduces the highest-risk remaining callback cluster without changing rules or server code.
- It gives future action-panel work a cleaner command surface.

## Risk And Verification

Risk level: medium.

Required verification for the next implementation task:

- Focused tests for request helpers before production code changes.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000` against a local dev server.
- `npm run build` if request helper types cross route payload boundaries.

Manual/browser verification can be skipped only if local `smoke:main-game` covers game creation, first human action, stream continue, and `DAY_SPEECH`. If the implementation changes visible loading/error behavior, run a browser smoke as well.

## Explicit Non-Goals

- Do not touch `src/game/**`, `src/server/**`, or `src/app/api/**` for this frontend boundary.
- Do not change command payload semantics.
- Do not combine room UI alignment with single-player `GameClient` lifecycle extraction.
- Do not continue one-off two-line extractions unless they directly support the lifecycle boundary.

## Restart Path

For the next code-facing task:

1. Create `docs/tasks/2026-05-gameclient-lifecycle-requests.md`.
2. Create an implementation plan under `docs/superpowers/plans/`.
3. Write failing focused tests for request helpers first.
4. Extract only request construction/parsing, then wire `GameClient.tsx`.
5. Run focused tests, lint, typecheck, harness checks, and local `smoke:main-game`.

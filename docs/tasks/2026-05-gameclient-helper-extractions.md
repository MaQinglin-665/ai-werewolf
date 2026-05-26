# GameClient Helper Extractions

## Task

Short name: GameClient helper extractions

Goal: Extract auto-advance, host audio cue, and AI speech audio helper logic from `src/components/GameClient.tsx` into focused `src/components/game/**` modules with tests.

Why it matters: `GameClient.tsx` is still a large orchestration file. Moving pure decision and cue-building helpers behind tested module boundaries makes later UI work safer without changing rules, server state, or AI behavior.

## Task Gate

Task type: Frontend/UI structure

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: run local main-game smoke against a dev server because auto-advance and audio gating affect the single-player table flow.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This task is a local frontend structure refactor and does not deploy or change public runtime configuration.
- Residual risk: Production host state is not proven by this task.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/verification-matrix.md`
- `docs/feature-registry.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`
- `docs/tasks/2026-05-frontend-css-boundary-map.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/autoAdvance.ts`
- `src/components/game/autoAdvance.test.ts`
- `src/components/game/hostAudioCues.ts`
- `src/components/game/hostAudioCues.test.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `docs/tasks/2026-05-gameclient-helper-extractions.md`
- `docs/superpowers/plans/2026-05-26-gameclient-helper-extractions.md`
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

- Auto-advance delay and AI-speech-read helper logic lives outside `GameClient.tsx` and is covered by focused tests.
- Host audio cue construction lives outside `GameClient.tsx` and is covered by focused tests.
- AI speech audio cue, TTS chunking, unavailable-error, and audio preparation helpers live outside `GameClient.tsx` and are covered by focused tests.
- `GameClient.tsx` remains the orchestration layer that wires refs, state, effects, and callbacks.
- Verification commands pass or skipped checks are recorded with a reason.
- Progress and handoff files describe the completed extraction and next restart path.

## Verification

Required checks:

- `npm run test -- src/components/game/autoAdvance.test.ts src/components/game/hostAudioCues.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-gameclient-helper-extractions.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run audit:structure`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added tested auto-advance helper module.
- Added tested host audio cue helper module.
- Added tested AI speech audio helper module.
- Updated GameClient to import helpers and keep orchestration local.
- Updated feature/progress/session handoff state.

Changed files:
- src/components/GameClient.tsx
- src/components/game/autoAdvance.ts
- src/components/game/autoAdvance.test.ts
- src/components/game/hostAudioCues.ts
- src/components/game/hostAudioCues.test.ts
- src/components/game/aiSpeechAudio.ts
- src/components/game/aiSpeechAudio.test.ts
- docs/tasks/2026-05-gameclient-helper-extractions.md
- docs/superpowers/plans/2026-05-26-gameclient-helper-extractions.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/autoAdvance.test.ts src/components/game/hostAudioCues.test.ts src/components/game/aiSpeechAudio.test.ts
- npm run lint
- npx tsc --noEmit
- npm run build
- npm run harness:task-card -- docs/tasks/2026-05-gameclient-helper-extractions.md
- npm run harness:check
- npm run audit:structure
- npm run smoke:main-game -- --base-url=http://127.0.0.1:3000

Remaining risks:
- Production/release checks were skipped because no deploy or public runtime configuration changed.
- Browser-render visual flow was skipped because no layout or visible UI was changed; local main-game smoke covered the auto-advance/audio-gating path.
```

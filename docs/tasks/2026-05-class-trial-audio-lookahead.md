# 学级裁判主题局后台预推进与语音预生成

## Task

Short name: class-trial-audio-lookahead

Goal: Reduce the long wait before each new character's first GPT-SoVITS line by starting the next class-trial `continue` step and next speech audio preparation while the current speech audio is already playing.

Why it matters: The previous latency slice made the wait visible, but every new role still has to wait for the next game step plus TTS generation. Background lookahead should move much of that work into the current playback window without changing visible class-trial focus.

## Task Gate

Task type: frontend async playback flow + client request helper

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: Start local app at `http://127.0.0.1:51625` or another dev port, keep GPT-SoVITS at `http://127.0.0.1:9880`, open homepage -> 学级裁判主题局 -> enable AI speech -> 9 人预女猎 -> 无真人观战 -> trigger at least two AI speeches -> confirm the current speaker remains visible while audio plays, the continue button is disabled during buffered playback, and following speakers can enter with less visible waiting when background preparation finishes in time.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This is a local-only class-trial frontend behavior depending on private local GPT-SoVITS audio.
- Residual risk: Public/rooms deployment remains out of scope.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/threads/ai-speech.md`
- `docs/tasks/2026-05-class-trial-audio-latency.md`
- `src/components/GameClient.tsx`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/ClassTrialGameTable.tsx`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/classTrialAudioLookahead.ts`
- `src/components/game/classTrialAudioLookahead.test.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-audio-lookahead.md`
- `docs/superpowers/plans/2026-05-28-class-trial-audio-lookahead.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `src/game/**`
- `src/ai/**`
- `src/server/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- Class-trial AI speech playback starts a single background `continue` lookahead only when the current state has exactly one `continue` action.
- The current speech key is treated as completed when selecting the next lookahead audio cue, so the pre-generation targets the following speaker.
- The buffered game view is applied only after the matching current audio run completes.
- The class-trial continue button is disabled while active audio or a buffered continue is in flight, reducing duplicate server advances.
- Failed or stale lookahead work clears safely and falls back to the existing auto-advance path.
- Focused tests, lint, type check, build, harness checks, diff check, and browser/manual flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialAudioLookahead.test.ts src/components/game/gameClientRequests.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-lookahead.md`
- `npm run harness:check`
- `git diff --check`
- Browser/manual local GPT-SoVITS flow.

Optional deeper checks:

- `npm run test`
- Timing instrumentation around background `continue` and `/api/ai-speech-audio`.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added class-trial audio lookahead guards and active-run matching helpers.
- Added a non-streaming continue request helper for background lookahead.
- Updated GameClient to start one background class-trial continue after current speech audio playback begins.
- Prepares the next speech audio from the buffered game view while the current speaker remains visible.
- Applies the buffered game view only after the matching current speech audio completes.

Changed files:
- src/components/game/classTrialAudioLookahead.ts
- src/components/game/classTrialAudioLookahead.test.ts
- src/components/game/gameClientRequests.ts
- src/components/game/gameClientRequests.test.ts
- src/components/GameClient.tsx
- docs/tasks/2026-05-class-trial-audio-lookahead.md
- docs/superpowers/plans/2026-05-28-class-trial-audio-lookahead.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green: npm run test -- src/components/game/classTrialAudioLookahead.test.ts failed first for missing/stubbed lookahead behavior, then passed.
- Red-green: npm run test -- src/components/game/gameClientRequests.test.ts failed first because submitContinueCommand did not exist, then passed.
- npm run test -- src/components/game/classTrialAudioLookahead.test.ts src/components/game/gameClientRequests.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts passed, 5 files / 51 tests.
- npx tsc --noEmit passed.
- npm run lint passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-lookahead.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.
- Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8 returned StatusCode 200.
- Browser http://127.0.0.1:51625 class-trial 9p AI-only smoke confirmed controls stay disabled during audio/buffered playback; a very short first speech still left visible generation on the second speaker, while the longer second speech gave the third speaker enough lookahead time to enter directly with full dialogue. Screenshot saved at tmp/class-trial-audio-lookahead-smoke.png.

Remaining risks:
- Lookahead hides wait only when the current audio playback window is long enough for the next continue step and next TTS generation.
- Background continue mutates server state before the UI advances; duplicate prevention is handled by disabling class-trial controls and matching the buffered audio run.
- Production/release checks were skipped because this is local-only and depends on private GPT-SoVITS files.
```

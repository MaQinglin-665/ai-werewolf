# 学级裁判主题局音频同步打字机

## Task

Short name: class-trial-audio-synced-typewriter

Goal: Drive the class-trial dialogue typewriter from real AI speech audio playback progress, while keeping the current fixed-speed typewriter as fallback.

Why it matters: GPT-SoVITS audio can take time to generate and has character-specific pacing. The class-trial scene should wait while audio loads and reveal Chinese dialogue in step with the actual voice instead of racing ahead.

## Task Gate

Task type: frontend playback state + class-trial UI rendering

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: Start local app at `http://127.0.0.1:51625` or another dev port, keep GPT-SoVITS at `http://127.0.0.1:9880`, open homepage -> 学级裁判主题局 -> enable AI speech -> 9 人预女猎 -> 无真人观战 -> play at least one AI speech -> confirm dialogue remains `正在思考/准备发言。` before audio starts and then reveals Chinese text in sync with the playing audio.
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
- `docs/superpowers/specs/2026-05-28-class-trial-audio-synced-typewriter-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-audio-synced-typewriter.md`
- `src/components/GameClient.tsx`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialDialogue.ts`
- `src/components/game/aiSpeechAudio.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/classTrialDialogue.ts`
- `src/components/game/classTrialDialogue.test.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/game/clientTypes.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/GameClient.tsx`
- `src/app/audio/ai-speech/[fileName]/route.ts`
- `src/app/audio/ai-speech/[fileName]/route.test.ts`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `src/game/**`
- `src/ai/**`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/rooms/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- Audio loading state keeps class-trial dialogue on `正在思考/准备发言。`.
- Audio playing state with valid `duration` drives dialogue progress from `audio.currentTime / audio.duration`.
- Invalid duration falls back to the current fixed-speed typewriter.
- Implausibly short class-trial audio does not force a long line to dump at audio speed; it falls back to readable text timing and holds a tail window before completion.
- Audio-disabled or unplayed class-trial speech still gets timed text playback and blocks auto-advance until the visible line has a readable window.
- Reduced-motion still renders full text.
- Default non-class-trial table UI remains unaffected.
- Focused tests, lint, type check, build, harness checks, diff check, and browser/manual flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`
- `npm run harness:check`
- `git diff --check`
- Browser/manual local GPT-SoVITS flow.
- Browser/manual audio-disabled local class-trial flow.

Optional deeper checks:

- `npm run test`
- Direct route smoke for GPT-SoVITS audio before browser flow.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added audio-progress dialogue frame mapping with invalid-progress and reduced-motion fallbacks.
- Added AI speech playback sync/status helpers and extended audio status types.
- Wired ClassTrialGameTable to consume live AI speech, active audio typewriter state, loading-state thinking text, and audio-speaker focus handoff when the game has already advanced.
- Wired GameClient to publish streaming TTS loading state and real HTMLAudioElement playback progress.
- Follow-up tightened long-speech frames to 4 display chars, capped audio-synced reveal by readable wall-clock progress, kept updating text during ended-audio tail time, and held the completed line briefly before speaker handoff.
- Follow-up treats the selected class-trial theme as the readable-sync guard, not only `roleCard.theme`, so streaming playback keeps readable timing even if cue metadata is incomplete.

Changed files:
- src/components/game/classTrialDialogue.ts
- src/components/game/classTrialDialogue.test.ts
- src/components/game/aiSpeechAudio.ts
- src/components/game/aiSpeechAudio.test.ts
- src/components/game/clientTypes.ts
- src/components/game/ClassTrialGameTable.tsx
- src/components/game/classTrialGameTable.test.ts
- src/components/GameClient.tsx
- feature_list.json
- progress.md
- session-handoff.md
- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md

Verification:
- npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts passed, 3 files / 37 tests.
- npm run lint passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- Browser clean-tab smoke on http://127.0.0.1:51625 confirmed the class-trial dialogue stays on full 正在思考/准备发言。 while GPT-SoVITS audio is generating instead of typewriting the thinking text; generated wav files continued appearing under ignored public/audio/ai-speech.
- Follow-up browser QA on http://127.0.0.1:51627 reproduced the skip/jump risk, then after the fix confirmed 苗木诚 wait -> text reveal -> 雾切响子 handoff without silent skip.
- Follow-up browser QA with AI speech off confirmed death seats still show 已退场 and 苗木诚 timed text fallback appears instead of immediate skip.
- Follow-up tests passed: npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/autoAdvance.test.ts, 4 files / 54 tests.
- Follow-up tests passed: npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts, 4 files / 58 tests.
- Follow-up lint passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- Follow-up TypeScript and build passed: npx tsc --noEmit; npm run build with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- Follow-up harness checks passed: npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md; npm run harness:check; git diff --check passed with CRLF warnings only.
- Follow-up local health passed: app http://127.0.0.1:51629/alpha-health returned 200; GPT-SoVITS http://127.0.0.1:9880/openapi.json returned 200.
- Follow-up browser QA on http://127.0.0.1:51629 with AI speech enabled confirmed game bb78bcca-e25b-4ea5-a1a5-363bb2f3846b displayed the complete normalized 69-char 苗木诚 first speech before handoff to 雾切响子.
- No-sound follow-up root-caused the silent browser playback to runtime-generated `/audio/ai-speech/*.wav` returning 404 under `next start`; added a dynamic cache route so generated mp3/wav files stream from `public/audio/ai-speech`.
- No-sound follow-up tests passed: npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts, 5 files / 61 tests.
- No-sound follow-up verification passed: npm run lint; npx tsc --noEmit; npm run build. Restarted `next start -p 51629` and confirmed a latest generated wav URL returned 200 with `Content-Type: audio/wav`.

Remaining risks:
- Browser automation confirmed complete visible first-speech text before handoff, but it cannot hear GPT-SoVITS output; automated tests cover progress mapping, readable wall-clock cap, active-run guard, audio-speaker focus handoff, and invalid-duration fallback.
- Browser automation cannot hear GPT-SoVITS output; after the 404 fix it verifies URL availability and visible state/timing only. Human listening is still required for audio gap and pacing judgment.
- A long browser trace timed out before preserving a complete black-white-bear segment, so the next manual pass should listen through at least the first 4 speakers.
- Production/release checks skipped because this is a local-only class-trial frontend behavior depending on private GPT-SoVITS audio.
```

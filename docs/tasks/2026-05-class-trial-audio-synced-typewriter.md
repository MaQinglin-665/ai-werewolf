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

Optional deeper checks:

- `npm run test`
- Direct route smoke for GPT-SoVITS audio before browser flow.

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

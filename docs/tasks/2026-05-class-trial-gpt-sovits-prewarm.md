# 学级裁判 GPT-SoVITS 预热与串行合成

## Task

Short name: class-trial-gpt-sovits-prewarm

Goal: Reduce first-speech wait for each new local class-trial voice by prewarming the current speaker's GPT-SoVITS voice before the speech is generated, and protect the single GPT-SoVITS service from overlapping weight-switch/TTS work.

Why it matters: Timing logs showed new-role speech can spend many seconds in GPT-SoVITS after switching weights. Streaming chunks can also create multiple overlapping local TTS requests, which is risky because GPT-SoVITS uses global active weights.

## Task Gate

Task type: local-only TTS latency and correctness optimization

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: Keep GPT-SoVITS at `http://127.0.0.1:9880` and the local app at `http://127.0.0.1:51625`. Run direct `/api/ai-speech-audio` smokes for class-trial role cards and inspect `[class-trial-gpt-sovits]` timing logs. Browser flow is useful when the Browser tool is available.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This is a private local class-trial GPT-SoVITS path using ignored local voice weights.
- Residual risk: Public Alpha and rooms are out of scope.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- `docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
- `src/server/gptSoVitsTts.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/GameClient.tsx`

## Allowed Scope

Files or directories the agent may edit:

- `src/server/gptSoVitsTts.ts`
- `src/server/gptSoVitsTts.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/GameClient.tsx`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `src/game/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- GPT-SoVITS switch-and-synthesize work is serialized so overlapping requests cannot race global active weights.
- Class-trial streaming TTS can defer chunk audio loading until the playback drain reaches each chunk, avoiding a burst of simultaneous GPT-SoVITS/rewrite requests.
- `GameClient` starts an invisible class-trial voice prewarm request for the current AI speaker while the table is waiting on `continue`.
- The prewarm request is class-trial-only and does not play audio or change game state.
- Focused tests, type check, lint/build, harness checks, diff check, GPT-SoVITS health, and direct route smoke are recorded.

## Verification

Required checks:

- `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md`
- `npm run harness:check`
- `git diff --check`
- `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8`
- Direct local `/api/ai-speech-audio` route smoke with class-trial role cards.

Optional deeper checks:

- Browser class-trial AI-only flow with AI speech enabled.
- Longer live run to compare first-speech wait before and after prewarm.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added a GPT-SoVITS synthesis queue around switch + TTS work.
- Added a class-trial current-speaker voice prewarm cue.
- Wired GameClient to fire invisible prewarm requests while waiting on class-trial continue.
- Added deferred streaming chunk loading for class-trial so chunks do not all generate at once.

Changed files:
- src/server/gptSoVitsTts.ts
- src/server/gptSoVitsTts.test.ts
- src/app/api/ai-speech-audio/route.ts
- src/app/api/ai-speech-audio/route.test.ts
- src/components/game/aiSpeechAudio.ts
- src/components/game/aiSpeechAudio.test.ts
- src/components/GameClient.tsx
- docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green focused tests first failed for missing synthesis queue / prewarm cue / deferred chunk loading, then passed.
- Direct route smoke with Tomori and Kirigiri class-trial role cards returned provider gpt-sovits wav URLs.

Remaining risks:
- Prewarming shifts some cost earlier; it cannot remove GPT-SoVITS cold-start cost entirely.
- Browser flow still needs a longer subjective listening pass for real player feel.
```

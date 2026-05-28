# 学级裁判主题局 GPT-SoVITS 日语语音

## Task

Short name: class-trial-gpt-sovits-voice

Goal: Connect local-only class-trial AI speech playback to the local GPT-SoVITS `api_v2.py` service, keeping on-screen text Chinese while playing per-character Japanese voice.

Why it matters: The class-trial theme should sound like a character-driven trial scene while preserving the existing Chinese game state, review, and player-readable logic.

## Task Gate

Task type: AI speech / local TTS integration + frontend request plumbing

Risk level: high

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: Start GPT-SoVITS `api_v2.py` at `http://127.0.0.1:9880`, start local ai-werewolf, open homepage -> 学级裁判主题局 -> enable AI speech -> 无真人观战 -> advance through at least two different AI speakers -> confirm Japanese audio plays while Chinese text remains visible; confirm fallback by stopping GPT-SoVITS or forcing one unavailable profile.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: GPT-SoVITS integration is local-only and depends on private local files under `D:\AI\GPT-SoVITS`.
- Residual risk: Any future public or room-based release needs a separate provider/security design.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-28-class-trial-gpt-sovits-voice-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-voice.md`
- `src/app/api/ai-speech-audio/route.ts`
- `src/server/mimoTts.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/GameClient.tsx`
- `src/components/game/classTrialTheme.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/server/gptSoVitsTts.ts`
- `src/server/gptSoVitsTts.test.ts`
- `src/ai/classTrialVoiceProfiles.ts`
- `src/ai/classTrialVoiceProfiles.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `src/components/game/clientTypes.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/GameClient.tsx`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-voice.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**` except read-only inspection
- `local-assets/**` except read-only inspection
- `public/audio/ai-speech/**` generated cache
- `src/game/engine.ts`
- `src/game/projection.ts`
- `src/ai/speechProviders.ts` unless the rewrite helper cannot use the existing routed model API without it
- `src/app/rooms/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- Class-trial AI speech requests carry enough role-card context for the backend to identify a class-trial Japanese voice profile.
- The backend can resolve all 9 class-trial voice profiles from `D:\AI\GPT-SoVITS`, including black-white bear `hei_bai_xiong_clean_denoised` and Anon's `logs/AI_voice_1` reference prompt source.
- The backend can call GPT-SoVITS `/set_gpt_weights`, `/set_sovits_weights`, and `POST /tts`.
- Chinese on-screen speech remains unchanged in `GameState`, `recentSpeeches`, and the class-trial dialogue UI.
- GPT-SoVITS receives a temporary Japanese rewrite for TTS only.
- GPT-SoVITS audio is cached with a cache key that includes role/profile/weights/reference/prompt/text/parameters.
- GPT-SoVITS or rewrite failure falls back to the existing Chinese Mimo TTS path, and then to current no-audio behavior if Mimo is unavailable.
- Ordinary non-class-trial AI speech still uses the existing path.
- Focused tests, lint, type check, build, harness checks, diff check, and browser/manual flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/server/gptSoVitsTts.test.ts src/ai/classTrialVoiceProfiles.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/voiceProfiles.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-voice.md`
- `npm run harness:check`
- `git diff --check`
- Browser/manual local GPT-SoVITS flow.

Optional deeper checks:

- Direct `Invoke-WebRequest http://127.0.0.1:9880/openapi.json` before browser smoke.
- Direct single-role route POST for a known class-trial role before full browser flow.

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


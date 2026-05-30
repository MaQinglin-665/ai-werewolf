# 学级裁判主题局语音等待与预加载

## Task

Short name: class-trial-audio-latency

Goal: Reduce the perceived GPT-SoVITS wait in the local class-trial theme by making audio preparation visible immediately and reusing a small prepared-audio queue before playback.

Why it matters: GPT-SoVITS generation can take many seconds per role. The class-trial table should feel like it is staging testimony, not freezing, and cached or already-prepared audio should begin playback without another request.

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
- If yes, flow or URL: Start local app at `http://127.0.0.1:51625` or another dev port, keep GPT-SoVITS at `http://127.0.0.1:9880`, open homepage -> 学级裁判主题局 -> enable AI speech -> 9 人预女猎 -> 无真人观战 -> trigger at least one AI speech -> confirm the dialogue immediately shows an audio-preparation status, then plays with synced typewriter when audio starts.
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
- `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`
- `src/components/GameClient.tsx`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/ClassTrialGameTable.tsx`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/game/clientTypes.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/GameClient.tsx`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-audio-latency.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `src/game/**`
- `src/ai/**`
- `src/server/**`
- `src/app/api/**`
- `src/app/rooms/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- Class-trial audio loading statuses distinguish preparing/generating/ready enough for the table to show a clear waiting line.
- The frontend keeps a tiny prepared-audio cache keyed by speech key and reuses it for playback when available.
- Failed audio preparation falls back to existing text behavior without blocking the game forever.
- The existing audio-synced typewriter remains driven by `HTMLAudioElement.currentTime / duration`.
- Default non-class-trial table UI remains unaffected.
- Focused tests, lint, type check, build, harness checks, diff check, and browser/manual flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-latency.md`
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
- Added class-trial audio preparation stages: queued, generating, and ready.
- Added a prepared-audio promise cache keyed by speech key, including rejection cleanup.
- Updated ClassTrialGameTable to show stage-specific waiting text.
- Updated GameClient to prepare class-trial speech audio before playback and reuse the prepared promise when playback begins.

Changed files:
- src/components/game/aiSpeechAudio.ts
- src/components/game/aiSpeechAudio.test.ts
- src/components/game/clientTypes.ts
- src/components/game/ClassTrialGameTable.tsx
- src/components/game/classTrialGameTable.test.ts
- src/components/GameClient.tsx
- feature_list.json
- progress.md
- session-handoff.md
- docs/tasks/2026-05-class-trial-audio-latency.md
- docs/superpowers/plans/2026-05-28-class-trial-audio-latency.md

Verification:
- Red-green: npm run test -- src/components/game/aiSpeechAudio.test.ts failed first for missing preparation stage/helper, then passed.
- Red-green: npm run test -- src/components/game/classTrialGameTable.test.ts failed first for missing stage-specific copy, then passed.
- npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts passed, 3 files / 41 tests.
- npm run lint passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-latency.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.
- Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8 returned StatusCode 200.
- Browser http://127.0.0.1:51625 class-trial 9p AI-only with AI speech enabled showed 正在生成语音。 immediately and later showed 正在调取证言。 / 正在生成语音。 on following speakers; fresh naegi/kirigiri wav cache files appeared under ignored public/audio/ai-speech.

Remaining risks:
- This reduces perceived wait and duplicate preparation, but GPT-SoVITS synthesis can still take many seconds.
- Browser automation still did not reliably capture a clean partial audio-progress reveal frame; automated tests cover the progress mapping from the previous slice and this slice covers preparation states.
- Browser screenshot capture timed out during smoke; DOM state and wav cache evidence were collected instead.
- Production/release checks were skipped because this is local-only and depends on private GPT-SoVITS files.
```

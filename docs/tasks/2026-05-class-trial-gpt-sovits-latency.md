# 学级裁判 GPT-SoVITS 后端延迟诊断与权重去重

## Task

Short name: class-trial-gpt-sovits-latency

Goal: Reduce repeated GPT-SoVITS setup overhead and make local class-trial speech latency observable by timing rewrite, weight switch, TTS, write, and total stages.

Why it matters: Frontend lookahead can only hide latency when the previous line is long enough. The next useful backend slice is to avoid redundant `/set_gpt_weights` and `/set_sovits_weights` calls, then log where the remaining time is spent.

## Task Gate

Task type: local-only backend TTS optimization + diagnostics

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: Keep GPT-SoVITS at `http://127.0.0.1:9880` and the local app at `http://127.0.0.1:51625`. Send two class-trial `/api/ai-speech-audio` requests for the same role with different speech keys/text, then confirm the second log reports skipped weight switches when the same role remains active.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This is a local-only class-trial GPT-SoVITS behavior depending on private local voice weights.
- Residual risk: Public/rooms deployment remains out of scope.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/tasks/2026-05-class-trial-audio-lookahead.md`
- `src/server/gptSoVitsTts.ts`
- `src/server/gptSoVitsTts.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/server/gptSoVitsTts.ts`
- `src/server/gptSoVitsTts.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- `docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-latency.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `src/game/**`
- `src/components/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- `switchGptSoVitsWeights` tracks active GPT and SoVITS weight paths by base URL.
- Repeated requests for the same active GPT/SoVITS weights skip the corresponding control endpoint.
- Weight switch calls return a timing report with per-step `durationMs` and `skipped` flags.
- Class-trial GPT-SoVITS route logs sanitized stage timings for rewrite, weight switch, TTS, write, and total.
- Timing logs do not include local file paths, prompt text, generated text, or secrets.
- Focused tests, lint, type check, build, harness checks, diff check, and a local GPT-SoVITS smoke pass or skipped checks are recorded.

## Verification

Required checks:

- `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- `npm run harness:check`
- `git diff --check`
- Direct local GPT-SoVITS route smoke.

Optional deeper checks:

- `npm run test`
- Browser class-trial AI speech run with console/server log inspection.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added active GPT-SoVITS weight tracking keyed by normalized base URL.
- Skips repeated GPT and SoVITS control endpoint calls when the same weights are already active.
- Returns per-step duration/skipped reports from switchGptSoVitsWeights.
- Logs sanitized class-trial GPT-SoVITS timing JSON from /api/ai-speech-audio.

Changed files:
- src/server/gptSoVitsTts.ts
- src/server/gptSoVitsTts.test.ts
- src/app/api/ai-speech-audio/route.ts
- src/app/api/ai-speech-audio/route.test.ts
- docs/tasks/2026-05-class-trial-gpt-sovits-latency.md
- docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-latency.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green: npm run test -- src/server/gptSoVitsTts.test.ts failed first because the cache/timing API did not exist, then passed.
- Red-green: npm run test -- src/app/api/ai-speech-audio/route.test.ts failed first because no timing log was emitted, then passed.
- npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts passed, 2 files / 7 tests.
- npm run lint passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-latency.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.
- GPT-SoVITS health check returned StatusCode 200 from http://127.0.0.1:9880/openapi.json.
- Direct route smoke posted two same-role 高松灯/Tomori requests to http://127.0.0.1:51625/api/ai-speech-audio and both returned provider: gpt-sovits with wav URLs: latency-smoke:20260528225927:1 -> /audio/ai-speech/tomori-1fbc2cd4c7e2aaf14abcaf51.wav in 10046ms; latency-smoke:20260528225927:2 -> /audio/ai-speech/tomori-6cf79401120b7e52341978a0.wav in 4981ms.
- Follow-up timing diagnosis from tmp/dev-51625-restart.log used five real GPT-SoVITS route samples. Average total was 7032ms: rewrite 5101ms / 72.5%, switch 263ms / 3.7%, TTS 1664ms / 23.7%, write 2ms. Four of five samples skipped both weight switches; the one new-role Kirigiri sample spent 1313ms switching weights.
- Dev-server terminal log inspection was not captured because no app terminal session was attached; automated route/helper tests cover the timing payload and skipped-switch flags.

Remaining risks:
- The in-memory active-weight cache resets when the Next.js/server process restarts.
- If another external client changes GPT-SoVITS weights outside this app, the cache can be stale until the next forced switch or process restart.
- This reduces repeated setup cost; it does not shorten the GPT-SoVITS synthesis itself.
- Current real-sample bottleneck is the LLM rewrite stage, not weight switching. The next performance slice should avoid or shrink rewrite work before deeper GPT-SoVITS tuning.
```

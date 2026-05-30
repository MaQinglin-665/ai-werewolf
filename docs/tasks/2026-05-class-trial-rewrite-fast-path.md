# 学级裁判 Rewrite 快速通道

## Task

Short name: class-trial-rewrite-fast-path

Goal: Reduce class-trial GPT-SoVITS wait time by skipping slow LLM rewrite for safe high-frequency short public-speech lines.

Why it matters: Real timing logs showed rewrite averages 5101ms / 72.5% of the GPT-SoVITS route time, much larger than weight switching.

## Task Gate

Task type: local-only backend TTS performance optimization

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: Keep GPT-SoVITS at `http://127.0.0.1:9880` and the local app at `http://127.0.0.1:51625`. Send a class-trial `/api/ai-speech-audio` request using a known fast-path line and confirm the timing log reports `rewriteMode:"fast"` with low `rewriteMs`.
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

- `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
- `docs/superpowers/specs/2026-05-28-class-trial-rewrite-fast-path-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-rewrite-fast-path.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `src/game/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- Known short explanation/vote/suspicion/contradiction lines can use local fast rewrite.
- Complex lines still fall back to the existing LLM rewrite and validation.
- Repeated same role/text rewrites can use the process cache.
- Class-trial GPT-SoVITS timing logs include `rewriteMode`.
- Focused tests, lint, type check, build, harness checks, diff check, and local route smoke are recorded.

## Verification

Required checks:

- `npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
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
- Added a metadata-returning class-trial rewrite helper with modes: cache, fast, and llm.
- Added process-local rewrite cache keyed by role id plus normalized source text.
- Added conservative fast rewrites for explanation, vote, suspicion, and contradiction short lines.
- Preserved existing LLM fallback and seat-number validation for complex lines.
- Added rewriteMode to class-trial GPT-SoVITS timing logs.

Changed files:
- src/ai/classTrialSpeechRewrite.ts
- src/ai/classTrialSpeechRewrite.test.ts
- src/app/api/ai-speech-audio/route.ts
- src/app/api/ai-speech-audio/route.test.ts
- docs/superpowers/specs/2026-05-28-class-trial-rewrite-fast-path-design.md
- docs/superpowers/plans/2026-05-28-class-trial-rewrite-fast-path.md
- docs/tasks/2026-05-class-trial-rewrite-fast-path.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green: npm run test -- src/ai/classTrialSpeechRewrite.test.ts failed first because clearClassTrialSpeechRewriteCache / rewriteClassTrialSpeechForJapaneseTtsWithMeta did not exist, then passed.
- Red-green: npm run test -- src/app/api/ai-speech-audio/route.test.ts failed first because timing logs omitted rewriteMode, then passed.
- npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts passed, 2 files / 8 tests.
- npm run lint passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- GPT-SoVITS health check returned StatusCode 200 from http://127.0.0.1:9880/openapi.json.
- App health check returned StatusCode 200 from http://127.0.0.1:51625.
- Direct route smoke rewrite-fast-smoke:20260528235235:tomori returned provider: gpt-sovits with /audio/ai-speech/tomori-b6dddce2800c00ad58bead8d.wav in 3014ms; log showed rewriteMode fast, rewriteMs 0, switchMs 1484, ttsMs 1319, totalMs 2806.
- Direct route smoke rewrite-fast-smoke:20260528235311:tomori-cache returned provider: gpt-sovits with /audio/ai-speech/tomori-b969b8577d8f8ed70712f562.wav in 1053ms; log showed rewriteMode cache, rewriteMs 1, switchMs 0, both weight switches skipped, ttsMs 965, totalMs 968.

Remaining risks:
- Fast rewrite only covers intentionally narrow short public-speech patterns; complex lines still use the slower LLM rewrite.
- Rewrite cache is process-local and resets when the Next.js/server process restarts.
- Timing improvement depends on the generated line matching a safe fast-path pattern.
```

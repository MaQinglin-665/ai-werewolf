# 学级裁判整段语音与角色化发言

## Task

Short name: class-trial-speech-persona-audio-gap

Goal: Remove mid-speech GPT-SoVITS gaps in local class-trial speech playback and make real LLM speeches lean harder into each character role card instead of generic Werewolf table templates.

Why it matters: Live timing logs showed 苗木诚 no longer spent time switching GPT-SoVITS weights after prewarm, but later speech chunks still waited on per-chunk LLM voice rewrite. A follow-up live run also showed whole-speech rewrite could still take about 76s for a complex first line, and over-strict speech validation could reject good characterful DeepSeek samples into generic Werewolf fallback. The user also reported that class-trial lines felt too much like normal Werewolf templates and not enough like the characters.

## Task Gate

Task type: local-only speech quality and audio playback polish

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? preferred
- If yes, flow or URL: `http://127.0.0.1:51625` local class-trial theme flow with AI speech enabled.
- If skipped, reason: Browser automation tool was not exposed in this turn; local app health checks were used instead.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This is a private local class-trial GPT-SoVITS and prompt-quality path.
- Residual risk: Subjective player-feel still needs a longer listening pass in the open browser.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/GameClient.tsx`
- `src/ai/speechProviders.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/game/classTrialDialogue.ts`
- `src/components/game/classTrialDialogue.test.ts`
- `src/components/GameClient.tsx`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `local-assets/**`
- `public/audio/ai-speech/**`
- production deployment docs

## Definition Of Done

This task is complete when:

- Class-trial visible streaming text can still update while TTS waits for the final speech.
- Class-trial TTS playback generates one whole-speech audio chunk instead of multiple per-sentence chunks.
- Class-trial transient TTS failures do not mark the global AI speech system unavailable or skip an unplayed speaker; they use a timed visible text fallback.
- Long class-trial dialogue lines reveal in compact segments instead of dumping a full sentence or punctuation-light paragraph at once.
- Non-class-trial streaming TTS keeps the existing stable chunk behavior.
- Class-trial role-card guidance explicitly pushes character performance over generic Werewolf templates while preserving public-information boundaries.
- Complex class-trial Japanese TTS rewrite has a deterministic local path before the slower LLM rewrite for common public-logic speech.
- Class-trial speech validation is tight enough to avoid report-style templates but not so tight that good characterful speeches fall into generic fallback.
- Class-trial fallback speech itself is role-specific and does not reuse old Werewolf table templates.
- 千早爱音's Japanese TTS rewrite limits filler words to rare, well-placed beats.
- Focused tests, TypeScript, lint, build, and local app health checks are recorded.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `Invoke-WebRequest -Uri 'http://127.0.0.1:51625/' -UseBasicParsing -TimeoutSec 10`
- `Invoke-WebRequest -Uri 'http://127.0.0.1:51625/alpha-health' -UseBasicParsing -TimeoutSec 10`

Optional deeper checks:

- Browser class-trial AI-only flow with AI speech enabled, listening specifically for 苗木诚 mid-speech gaps.
- Longer live run comparing number of `[class-trial-gpt-sovits]` route calls per final speech.

## Handoff

```text
Completed:
- Added a whole-speech TTS chunk mode and enabled it for class-trial visible continues.
- Kept non-class-trial streaming chunk behavior unchanged.
- Added class-trial text fallback for unplayed TTS failures so a speaker is shown for an estimated reading duration instead of being skipped.
- Split long class-trial dialogue into smaller cumulative frames so punctuation-light lines no longer pop in as one large block.
- Strengthened class-trial role-card speech guidance against generic Werewolf templates, with named character performance cues and a tuned 3-sentence / 260-char contract.
- Preserved richer role-card fields through `/api/ai-speech-audio` into Japanese rewrite and added 千早爱音 filler-word timing guards.
- Added deterministic `rewriteMode:"local"` for complex class-trial Japanese TTS rewrite before falling back to LLM rewrite; the same 苗木诚 sample improved from about 76.3s total to about 6.3s.
- Relaxed the class-trial speech contract to 3 sentences / 260 chars after live DeepSeek samples showed good persona lines were being rejected into fallback.
- Added class-trial-specific role fallback speech so rejected/failed speech does not fall back to generic Werewolf templates.

Changed files:
- src/components/game/aiSpeechAudio.ts
- src/components/game/aiSpeechAudio.test.ts
- src/components/game/classTrialDialogue.ts
- src/components/game/classTrialDialogue.test.ts
- src/components/GameClient.tsx
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/classTrialSpeechRewrite.ts
- src/ai/classTrialSpeechRewrite.test.ts
- src/app/api/ai-speech-audio/route.ts
- src/app/api/ai-speech-audio/route.test.ts
- docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green focused tests first failed for missing compact dialogue frames, missing class-trial text fallback helpers, missing anti-template persona contract, missing Anon filler guard, and dropped route role-card fields; then passed.
- Follow-up red-green tests first failed for missing deterministic local rewrite, over-strict class-trial contract expectations, and generic fallback wording; then passed.
- `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` passed.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed.
- `Invoke-WebRequest` to `/` and `/alpha-health` on `http://127.0.0.1:51625` returned 200.
- Live API/log regression game `68d9b996-e4f3-4518-b0e0-e146ac7c6328`: initial 苗木诚 GPT-SoVITS route took about 76.3s with `rewriteMode:"llm"` and `rewriteMs:63779`; after local rewrite, the same text took about 6.3s with `rewriteMode:"local"` and `rewriteMs:0`.
- Same live run generated 江之岛盾子 GPT-SoVITS audio successfully in about 5.1s, and later speaker samples stayed around 3.8-5.4s.

Remaining risks:
- The first audio wait can be longer because class-trial TTS now waits for final speech before generating audio.
- Subjective persona quality still depends on the next real DeepSeek samples and a human listening pass.
- The deterministic local rewrite is faster but less semantically rich than LLM translation, so voice wording may need subjective tuning.
- Later real speeches can still converge on the same target point; a future slice may need anti-duplicate debate focus.
- Browser automation was not exposed in this turn and local Playwright was not installed, so no new screenshot/listening smoke was captured.
```

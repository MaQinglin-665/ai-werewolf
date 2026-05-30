# 学级裁判角色行为透镜

## Task

Short name: class-trial-character-lens

Goal: Give local class-trial characters distinct public reasoning, pressure, and vote-rationale behavior through a reusable character lens layer.

Why it matters: The user wants character feel to come from how each role reads and pressures the table, not only from surface speech style.

Direction update: Keep the lens as soft LLM director guidance. Do not use it as a keyword-matching validator; hard checks should only guard length, out-of-game text, hidden-info leaks, invalid JSON, and obvious generic templates. Repairs should preserve LLM freeplay, and repeated abstract pressure should be handled with soft role examples / dynamic director prompts before hard validators.

## Task Gate

Task type: AI speech + AI action input quality

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? preferred
- If yes, flow or URL: `http://127.0.0.1:51625` local class-trial Day 1 speech/listening pass.
- If skipped, reason: Browser/manual listening is preferred but not required for this input-contract slice; focused prompt/input tests and local health checks are required.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: Local-only private class-trial prompt/input behavior.
- Residual risk: Subjective character feel still needs user listening feedback.

## Context To Read First

- `docs/superpowers/specs/2026-05-29-class-trial-character-lens-design.md`
- `docs/superpowers/plans/2026-05-29-class-trial-character-lens.md`
- `src/ai/speechProviders.ts`
- `src/ai/actionProviders.ts`
- `docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `D:\AI\GPT-SoVITS\**`
- production deployment docs

## Definition Of Done

This task is complete when:

- A reusable class-trial character lens module exists for the fixed 9-character roster.
- White-day speech input includes character attention and pressure behavior, not only style text.
- Day-vote action input includes character vote-rationale behavior while night actions remain unaffected.
- The character lens stays as soft LLM guidance rather than a required-keyword validator.
- Obvious generic class-trial Werewolf-template speech can still trigger baseline style validation or repair.
- Class-trial fallback speech uses the lens.
- Class-trial speech repair preserves character freeplay and only fixes the specific validation problem.
- Class-trial speech prompt includes a soft anti-repeat cue for later speakers.
- Class-trial lens includes role-specific transformation examples that show how different characters turn the same table material into different debate moves.
- Class-trial speech prompt includes a dynamic director cue when previous speakers repeat the same abstract pressure motif.
- Dynamic director motifs cover `没给结论/验证方向`, `没给站边/票口`, `镜像攻击`, `干净模板/后置责任`, and `平安夜复读`.
- Class-trial speech-order guards reject premature trust/suspicion/vote labels on unspoken seats unless there is public hard info.
- Class-trial low-info first speakers must leave a verifiable hook instead of only saying there is no information or no reference point.
- Class-trial speakers cannot directly demand process, logic, or vote clarification from seats that already spoke, including cross-sentence direct-address wording.
- Focused tests, TypeScript, lint, build, task-card, harness, and whitespace checks are recorded.

## Verification

Required checks:

- `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `Invoke-WebRequest -Uri 'http://127.0.0.1:51625/' -UseBasicParsing -TimeoutSec 10`
- `Invoke-WebRequest -Uri 'http://127.0.0.1:51625/alpha-health' -UseBasicParsing -TimeoutSec 10`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- Local Day 1 class-trial live run with 9 AI speakers, checking whether at least 6 roles show distinct reasoning/pressure styles.

## Handoff

```text
Completed:
- Added the class-trial character lens module and wired it into speech and day-vote action input.
- Softened the lens into LLM director guidance instead of keyword-based speech validation.
- Kept obvious generic-template blocking in the baseline class-trial style guard.
- Preserved LLM freeplay during class-trial speech repair and added a soft anti-repeat debate cue.
- Added role-specific transformation examples and dynamic repeated-focus director guidance.
- Expanded repeated-focus detection after production-preview text samples exposed `没给站边/票口` and `干净模板/后置责任` as common loops.
- Added hard public-order guards for unspoken-seat trust/vote labels, low-info opener hooks, and direct process demands to already-spoken seats.

Changed files:
- src/ai/classTrialCharacterLens.ts
- src/ai/classTrialCharacterLens.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/actionProviders.ts
- src/ai/actionProviders.test.ts
- docs/tasks/2026-05-class-trial-character-lens.md
- docs/superpowers/specs/2026-05-29-class-trial-character-lens-design.md
- docs/superpowers/plans/2026-05-29-class-trial-character-lens.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green director tests first failed for missing role-specific transformation examples and missing dynamic repeated-focus guidance, then passed.
- npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts passed, 3 files / 110 tests.
- npx tsc --noEmit passed.
- npm run lint passed with 0 errors and 3 existing warnings in src/server/gptSoVitsTts.test.ts.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- Real LLM freeplay smoke game e38aeb06-a684-40f3-88ba-a41035a32d0a generated 5 Day 1 class-trial speeches; 4 of 5 speech logs were non-fallback DeepSeek outputs, and the only fallback came from the existing already-spoken-player guard, not the character lens.
- Full Day 1 LLM sample game 60f17301-15c4-41a9-a134-7c2adba47c92 generated 9 of 9 Day 1 class-trial speeches as non-fallback DeepSeek outputs; repeated abstract pressure in later seats drove the soft anti-repeat prompt.
- Anti-repeat smoke game ca0d5a71-261c-4d47-87b1-877c7336a77a exercised the new prompt path for first speakers; later fallbacks were caused by transient DeepSeek fetch failures, not character-lens validation.
- Production-preview text sample game 64183909-65b9-44f2-9c35-4a3b89692904 generated 9 Day 1 speeches in about 75s and exposed the `没给站边/票口` loop.
- Production-preview text sample game 309698cb-5ffc-40d6-af6d-c349b849fbd2 generated 9 Day 1 speeches in about 64s, with better role pressure shifts and one 高松灯 fallback after validation retry.
- Follow-up red-green speech-order tests first failed for missing unspoken-seat trust guard, missing opener hook validation, and missing already-spoken direct-demand validation, then passed.
- npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts passed, 3 files / 112 tests.
- Production-preview text sample game 89c345c8-b272-457f-b4f1-244a53c8c597 on http://127.0.0.1:51629 generated first four Day 1 speeches in about 39s; 苗木诚 left a共同验证断点, 雾切响子 reviewed 1号原话 instead of asking him to补过程, and 腐川冬子 did not prematurely信任9号.
- Invoke-WebRequest -Uri 'http://127.0.0.1:51625/' -UseBasicParsing -TimeoutSec 10 returned StatusCode 200.
- Invoke-WebRequest -Uri 'http://127.0.0.1:51625/alpha-health' -UseBasicParsing -TimeoutSec 10 returned StatusCode 200.
- Invoke-WebRequest -Uri 'http://127.0.0.1:9880/openapi.json' -UseBasicParsing -TimeoutSec 10 returned StatusCode 200.
- Invoke-WebRequest for http://127.0.0.1:51629/ and /alpha-health returned StatusCode 200.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.

Remaining risks:
- Subjective character feel still needs a longer Day 1 listening pass.
- The soft anti-repeat and dynamic director cues may need an evaluator layer if DeepSeek still repeats the same abstract pressure across seats.
- One production-preview sample still had a role-specific fallback; audio/browser review should judge whether that feels acceptable.
```

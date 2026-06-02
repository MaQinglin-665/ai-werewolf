# Task

Short name: Speech de-template persona layer

Goal: Add a shared speech-quality layer that reduces canned table phrases and repeated pressure moves in both ordinary werewolf and class-trial themed rooms, while keeping bluffing, tempo pressure, and role/persona-driven speech expressive.

Why it matters: The public evidence-boundary fix prevents private judgment leaks, but player feel can still flatten if every AI says the same safe table phrases. The next layer should push speakers toward different public reasoning moves and character/persona cadence instead of repeating "我先按公开信息盘 / 疑点未解除 / 票口先放这里" or only attacking "没站边 / 没票口 / 证据链缺口".

## Task Gate

Task type: AI speech / LLM contract

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If skipped, reason: This task changes speech input guidance, rendered-speech validation, and fallback phrasing only; no UI flow or browser-visible layout changes are expected.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Browser/manual speech sample
- Reason: This slice changed prompt/validation behavior and has focused automated coverage; no UI layout or local audio path changed.
- Residual risk: Automated tests prove the guide and validator are present, but subjective persona feel still needs a longer live transcript/listening pass.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/verification-matrix.md`
- `docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-05-speech-de-template-persona-layer.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated UI or rules modules
- `src/game/engine.ts`
- `src/components/**`

## Definition Of Done

This task is complete when:

- Ordinary werewolf LLM input includes a universal de-template guide with alternative public reasoning moves.
- Class-trial LLM input keeps the character lens and also benefits from the universal de-template layer.
- Rendered-speech validation rejects obvious empty-template chains in ordinary rooms, without blocking concrete bluffing, suspicion, or pressure.
- Existing class-trial public-expression and role-lens protections remain covered.
- Provider-error fallback speech avoids reverting to the most obvious canned template phrases.

## Verification

Required checks:

- `npm run test -- src/ai/speechProviders.test.ts -t "<new regression test>"`
- `npm run test -- src/ai/speechProviders.test.ts src/ai/tableRead.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-speech-de-template-persona-layer.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- `npm run build`
- `npm run llm:check -- --task=speech --persona=deepseek --retries=0`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added universal de-template guidance to ordinary and class-trial speech input.
- Added ordinary Werewolf validation for obvious empty-template chains.
- Preserved concrete pressure and later-seat verification wording after a focused false-positive test failure.

Changed files:
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- docs/tasks/2026-05-speech-de-template-persona-layer.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Red-green: npm run test -- src/ai/speechProviders.test.ts -t "universal de-template|ordinary empty-template" first failed because ordinary speech input lacked 通用去模板 guidance and ordinary empty-template chains returned no validation error, then passed.
- Focused: npm run test -- src/ai/speechProviders.test.ts src/ai/tableRead.test.ts passed, 2 files / 113 tests.
- npm run lint passed.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning for next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts.
- npm run harness:task-card -- docs/tasks/2026-05-speech-de-template-persona-layer.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.

Remaining risks:
- No real-LLM/browser transcript sample was run for this slice; subjective character feel and live phrasing variety should be judged in a later Day 1 listening/text sample.
```

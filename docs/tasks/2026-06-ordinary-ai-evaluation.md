# Ordinary AI Evaluation

Status: done

## Task

Short name: ordinary-ai-evaluation

Goal: Create a local ordinary Werewolf AI evaluation command that scores speech text, action/vote choices, and speech-to-vote continuity, with optional promptfoo LLM judging.

Why it matters: The project needs repeatable evidence for whether ordinary AI output sounds like a real table player, keeps public-information boundaries, and explains vote changes.

## Task Gate

Task type: evaluation tooling

Risk level: medium

Required verification tier:

- [x] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL: not applicable
- If skipped, reason: This is CLI evaluation tooling and does not change browser-visible gameplay.

State updates required:

- [ ] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: real LLM generation and promptfoo live judge
- Reason: cost control; user did not approve paid judge/model calls for this implementation pass
- Residual risk: scoring thresholds and judge behavior need calibration against reviewed real transcripts

## Context To Read First

- `README.md`
- `docs/harness-orientation.md`
- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/superpowers/specs/2026-06-08-ordinary-ai-evaluation-design.md`
- `docs/superpowers/plans/2026-06-08-ordinary-ai-evaluation.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `scripts/eval-ordinary-ai.mjs`
- `scripts/evaluate-llm-game.mjs`
- `scripts/promptfoo-ordinary-judge-provider.mjs`
- `prompts/evals/ordinary-ai-judge.md`
- `promptfoo.config.yaml`
- `package.json`
- `docs/tasks/2026-06-ordinary-ai-evaluation.md`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated modules
- production deploy scripts

## Definition Of Done

This task is complete when:

- Local scoring helpers have focused tests.
- `npm run eval:ordinary-ai` can score mock cases and existing exported cases.
- `npm run llm:evaluate -- --eval-cases-out=...` can export cases through a mock dry path.
- promptfoo cases can be generated offline without live judge calls.
- Focused tests, syntax checks, lint, TypeScript, task card gate, and diff check pass.
- Skipped cost-bearing checks are recorded.

## Verification

Required checks:

- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 1 file / 15 tests.
- `node --check scripts/eval-ordinary-ai-utils.mjs` passed.
- `node --check scripts/eval-ordinary-ai.mjs` passed.
- `node --check scripts/evaluate-llm-game.mjs` passed.
- `node --check scripts/promptfoo-ordinary-judge-provider.mjs` passed.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json` passed and generated 54 cases, average score 93.5.
- `npm run llm:evaluate -- --provider=mock --allow-mock --games=1 --max-llm-calls=2 --json --out=tmp/llm-eval-smoke.json --eval-cases-out=tmp/ordinary-ai-eval-cases.json` passed and generated 2 dry eval cases.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json --json --out=tmp/ordinary-ai-eval-existing.json` passed and read 2 cases.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --judge=promptfoo --json --out=tmp/ordinary-ai-eval-promptfoo-prep.json` passed and generated 54 promptfoo cases.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.

Optional deeper checks:

- Real LLM generation: skipped for cost control.
- promptfoo live judge: skipped because `PROMPTFOO_JUDGE_API_KEY` is not configured and paid judge calls were not approved.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added local ordinary AI scoring helpers and focused tests.
- Added eval:ordinary-ai CLI with mock and existing input sources.
- Added llm:evaluate eval-case export.
- Added optional promptfoo judge prompt/config/provider and offline case export.

Changed files:
- src/ai/llmEvaluation.ts
- src/ai/llmEvaluation.test.ts
- scripts/eval-ordinary-ai-utils.mjs
- scripts/eval-ordinary-ai.mjs
- scripts/evaluate-llm-game.mjs
- scripts/promptfoo-ordinary-judge-provider.mjs
- prompts/evals/ordinary-ai-judge.md
- promptfoo.config.yaml
- package.json
- docs/tasks/2026-06-ordinary-ai-evaluation.md
- progress.md
- session-handoff.md

Verification:
- Focused tests, syntax checks, CLI smoke checks, lint, TypeScript, task-card gate, and diff check pass.

Remaining risks:
- Scoring thresholds are provisional and should be calibrated with manually reviewed ordinary transcripts.
- Real LLM generation and promptfoo live judge were skipped for cost control.
```

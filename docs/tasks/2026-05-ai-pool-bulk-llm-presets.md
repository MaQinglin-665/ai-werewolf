# AI Pool Bulk LLM Presets

## Task

Short name: AI pool bulk LLM presets

Goal: Design and then implement a bulk LLM preset workflow for `/ai-pool`, so users can save reusable LLM presets and apply them to the currently selected AI friends without editing each AI one by one.

Why it matters: Real LLM setup is currently too repetitive, especially on mobile. A preset and bulk-apply flow lowers the cost of trying real models while keeping API keys local to the browser.

## Task Gate

Task type: Frontend/UI + AI speech / LLM configuration

Risk level: medium

Required verification tier:

- [x] Docs/readback only
- [ ] Focused automated test
- [ ] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no for design stage; yes for implementation stage if visible UI changes are made
- If yes, flow or URL: `/ai-pool` on desktop and mobile viewport
- If skipped, reason: this stage only records the approved design and implementation boundaries

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: focused tests, lint/type/build, browser/manual flow
- Reason: no production code changed in the design stage
- Residual risk: the design still needs implementation tests and browser verification once UI/API code changes begin

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/threads/ai-speech.md`
- `docs/feature-registry.md`
- `docs/superpowers/specs/2026-05-27-ai-pool-bulk-llm-presets-design.md`

## Allowed Scope

Files or directories the agent may edit for implementation:

- `src/components/AiPoolClient.tsx`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/components/game/aiFriendStorage.ts`
- `src/app/globals.css`
- focused helper/test files under `src/components/**`
- a focused API test route if the connection-test endpoint is added
- docs and harness state files for this task

Files or directories the agent should not edit:

- `.env`
- generated caches
- `public/audio/ai-speech/**`
- `node_modules/**`
- `.next/**`
- `prisma/**`
- `src/game/**`
- unrelated room/multiplayer files

## Definition Of Done

This task is complete when:

- The approved design is recorded in `docs/superpowers/specs/2026-05-27-ai-pool-bulk-llm-presets-design.md`.
- An implementation plan is written and approved before code changes begin.
- The implementation lets users create multiple local LLM presets and remember the last used preset.
- The implementation lets users apply a preset to currently selected AI friends with `fill blanks only` and `overwrite selected` behaviors.
- The implementation shows a per-AI result list after applying.
- The implementation keeps API keys browser-local for saved presets and does not persist keys server-side during tests.
- Relevant tests, lint/type checks, and browser/manual verification are run or explicitly skipped with reason.

## Verification

Required checks for design stage:

- `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`
- `npm run harness:check`
- `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`
- `git diff --check`

Required checks for implementation stage:

- Focused tests for local preset storage and bulk apply behavior.
- Focused tests for connection-test behavior, especially API key redaction/non-persistence.
- `npm run test -- src/components/AiPoolClient.mobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- Browser/manual `/ai-pool` check on desktop and mobile viewport.

Optional deeper checks:

- `npm run build`
- A manual real-provider connection test only if the user provides or confirms a safe test key.

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

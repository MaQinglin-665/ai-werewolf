# AI Pool Character Roster

## Task

Short name: AI pool character roster

Goal: Upgrade `/ai-pool` into a local AI character roster where each AI friend can carry a role card, uploaded avatar, existing tactic template, and role-play instructions that affect real LLM speech and decisions.

Why it matters: Users want AI players to feel like recognizable characters rather than generic model slots. A local character roster makes the setup more personal, keeps sharing safe by excluding keys, and gives real LLM games a stronger table identity.

## Task Gate

Task type: Frontend/UI + AI speech / LLM contract + AI behavior

Risk level: medium

Required verification tier:

- [x] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes for implementation stage because `/ai-pool` visible layout and import/export controls change
- If yes, flow or URL: `/ai-pool` on desktop and mobile viewport; verify roster layout, role-card editing, Mock warning, import/export entry points, and existing LLM/TTS advanced controls remain reachable
- If skipped, reason: not skipped

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: real provider role-play game test
- Reason: real LLM validation requires a safe disposable API key and may produce model cost
- Residual risk: provider-specific style adherence may vary; prompt construction and config propagation must still be covered with focused tests

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/feature-registry.md`
- `docs/superpowers/specs/2026-05-27-ai-pool-character-roster-design.md`

## Allowed Scope

Files or directories the agent may edit for implementation:

- `src/components/AiPoolClient.tsx`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/components/game/aiFriendStorage.ts`
- focused helper/test files under `src/components/game/**`
- `src/game/aiFriends.ts`
- `src/game/types.ts`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/app/globals.css`
- docs and harness state files for this task

Files or directories the agent should not edit:

- `.env`
- generated caches
- `public/audio/ai-speech/**`
- `node_modules/**`
- `.next/**`
- `prisma/**`
- room/multiplayer sync files
- rules-engine win-condition or phase-flow files
- production deployment configuration

## Definition Of Done

This task is complete when:

- The approved design is recorded in `docs/superpowers/specs/2026-05-27-ai-pool-character-roster-design.md`.
- An implementation plan is written and approved before code changes begin.
- `/ai-pool` presents the AI pool as a character roster with efficient editing.
- Each local AI friend can store role-card fields: source, speaking style, reasoning style, and avoid.
- Existing avatar upload, nickname, tactic template, LLM, TTS, and queue flows remain available.
- Real LLM speech and action prompts receive the role-card data.
- Mock mode clearly communicates that role-play instructions only affect real LLM.
- Role roster export/import supports a safe character-only JSON format.
- Import lets the user choose append or overwrite.
- Export excludes LLM/TTS/API Key/Base URL/model/voice configuration.
- Relevant tests, lint/type checks, and browser/manual verification are run or explicitly skipped with reason.

## Verification

Required checks for planning stage:

- `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-character-roster.md`
- `npm run harness:check`
- `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`
- `git diff --check`

Required checks for implementation stage:

- Focused tests for role-card storage, import, export, append, and overwrite.
- Focused tests that export excludes LLM/TTS/API Key/Base URL/model/voice configuration.
- Focused tests for `/api/games` role-card validation and propagation.
- Focused speech/action prompt tests proving role-card data reaches real LLM prompts while legal-action and private-info boundaries remain present.
- `npm run test -- src/components/AiPoolClient.mobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- Browser/manual `/ai-pool` check on desktop and mobile viewport.

Optional deeper checks:

- `npm run build`
- `npm run llm:check -- --task=speech` only if a safe test configuration is available and the user accepts possible model cost.

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

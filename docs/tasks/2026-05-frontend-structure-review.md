# Frontend Structure Review

## Task

Short name: Frontend structure review

Goal: Review the accumulated `GameClient.tsx` slimming work and record the next worthwhile frontend boundary before starting a larger refactor.

Why it matters: Several safe helper/model extractions have brought `GameClient.tsx` below 1000 lines. Continuing tiny extractions now has lower payoff; the next useful boundary touches API/game lifecycle callbacks and needs stronger verification.

## Task Gate

Task type: Structure / framework audit

Risk level: low

Required verification tier:

- [x] Docs/readback only
- [ ] Focused automated test
- [x] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL:
- If skipped, reason: This task only records a structure review and does not change runtime code or UI rendering.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Focused automated test
- Reason: No production code changed.
- Residual risk: The next recommended refactor still needs its own tests before implementation.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `progress.md`
- `session-handoff.md`

## Allowed Scope

Files or directories the agent may edit:

- `docs/tasks/2026-05-frontend-structure-review.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-review.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- runtime code
- unrelated modules

## Definition Of Done

This task is complete when:

- The current `GameClient.tsx` responsibility map is recorded.
- The next recommended boundary is named with scope, risk, and verification.
- Skipped checks are recorded with reasons.
- Progress and handoff files describe the review and next restart path.

## Verification

Required checks:

- `npm run audit:structure`
- `npm run harness:task-card -- docs/tasks/2026-05-frontend-structure-review.md`
- `npm run harness:check`
- `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`
- `git diff --check`

Optional deeper checks:

- `npm run lint` if shared docs or scripts are touched beyond Markdown and JSON.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Recorded the accumulated GameClient slimming snapshot and current remaining responsibilities.
- Chose `src/components/game/gameClientRequests.ts` as the next worthwhile frontend boundary.
- Updated feature, progress, and session handoff state for a restartable next session.

Changed files:
- docs/tasks/2026-05-frontend-structure-review.md
- docs/superpowers/specs/2026-05-26-frontend-structure-review.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run audit:structure
- npm run harness:task-card -- docs/tasks/2026-05-frontend-structure-review.md
- npm run harness:check
- node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"
- git diff --check

Remaining risks:
- No production code changed, so focused automated tests and browser/manual checks were skipped.
- The recommended `gameClientRequests` boundary is medium-risk and still needs its own task card, TDD pass, and local smoke verification.
```

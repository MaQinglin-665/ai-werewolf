# Task Execution Gate

## Task

Short name: Task execution gate

Goal: Add a repeatable task-card gate so future feature, optimization, and bugfix work must declare scope, risk, verification, browser/manual needs, and state updates before completion.

Why it matters: The harness should not only describe good behavior; it should give agents a small mechanical contract that reduces skipped checks and vague handoffs.

## Task Gate

Task type: Root harness / task templates

Risk level: low

Required verification tier:

- [x] Docs/readback only
- [x] Focused automated test
- [ ] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL:
- If skipped, reason: This change affects harness documents and Node scripts only; no browser-visible game behavior changed.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Browser smoke, production preflight, full app build.
- Reason: No frontend, route, game-rule, AI behavior, or deployment code changed.
- Residual risk: The gate enforces required sections but does not prove the selected checks are semantically sufficient for every future task.

## Context To Read First

- `AGENTS.md`
- `docs/tasks/HARNESS_TASK_TEMPLATE.md`
- `docs/verification-matrix.md`
- `scripts/harness-check.mjs`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

## Allowed Scope

Files or directories the agent may edit:

- `docs/tasks/HARNESS_TASK_TEMPLATE.md`
- `docs/tasks/2026-05-task-execution-gate.md`
- `scripts/harness-check.mjs`
- `scripts/task-card-check.mjs`
- `package.json`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- production game logic
- UI components
- unrelated modules

## Definition Of Done

This task is complete when:

- The task template includes explicit task gate fields.
- A runnable task-card checker exists.
- `npm run harness:check` verifies that the template still contains gate markers.
- This task card passes the new task-card checker.
- State and handoff files name the new gate and verification evidence.

## Verification

Required checks:

- `npm run harness:task-card -- docs/tasks/HARNESS_TASK_TEMPLATE.md docs/tasks/2026-05-task-execution-gate.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run lint` if script syntax or package scripts changed.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added task-card gate fields to the reusable template.
- Added a task-card checker script and package entry.
- Updated harness self-checks to guard the gate markers.

Changed files:
- docs/tasks/HARNESS_TASK_TEMPLATE.md
- scripts/task-card-check.mjs
- scripts/harness-check.mjs
- package.json
- docs/tasks/2026-05-task-execution-gate.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run harness:task-card -- docs/tasks/HARNESS_TASK_TEMPLATE.md docs/tasks/2026-05-task-execution-gate.md
- npm run harness:check
- npm run lint

Remaining risks:
- The checker verifies required structure, not the judgment quality of future verification choices.
```

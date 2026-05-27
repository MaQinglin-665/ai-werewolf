# Long-running Task Registry

## Task

Short name: Long-running task registry

Goal: Add a lightweight registry for work that spans sessions, blocks on external state, or needs resumable long-running diagnostics.

Why it matters: The existing harness already supports handoff, but long tasks need a machine-readable state list so future agents can see what is planned, running, blocked, failed, killed, or done.

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
- If skipped, reason: This change adds harness docs and Node validation only; no browser-visible behavior changed.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Browser smoke, production preflight, full app build.
- Reason: No frontend, route, game-rule, AI behavior, dependency, or deployment code changed.
- Residual risk: The registry validates structure but still depends on agents keeping task status current.

## Context To Read First

- `AGENTS.md`
- `docs/long-running-tasks.md`
- `long_running_tasks.json`
- `docs/verification-matrix.md`
- `scripts/harness-check.mjs`

## Allowed Scope

Files or directories the agent may edit:

- `AGENTS.md`
- `docs/README.md`
- `docs/long-running-tasks.md`
- `docs/tasks/2026-05-long-running-task-registry.md`
- `long_running_tasks.json`
- `scripts/long-running-tasks-check.mjs`
- `scripts/harness-check.mjs`
- `package.json`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- database files
- production game logic
- UI components
- unrelated modules

## Definition Of Done

This task is complete when:

- `long_running_tasks.json` exists with at least one valid registry entry.
- `docs/long-running-tasks.md` explains when and how to use the registry.
- `npm run harness:long-tasks` validates the registry.
- `npm run harness:check` requires the registry, docs, and script.
- Agent startup docs route long-running work to the registry.

## Verification

Required checks:

- `npm run harness:long-tasks`
- `npm run harness:task-card -- docs/tasks/2026-05-long-running-task-registry.md`
- `npm run harness:check`

Optional deeper checks:

- `npm run lint` if script syntax needs broader validation.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added long-running task registry docs, JSON state, and validation script.
- Routed the registry through AGENTS.md, docs/README.md, package scripts, and harness self-checks.

Changed files:
- AGENTS.md
- docs/README.md
- docs/long-running-tasks.md
- docs/tasks/2026-05-long-running-task-registry.md
- long_running_tasks.json
- scripts/long-running-tasks-check.mjs
- scripts/harness-check.mjs
- package.json
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run harness:long-tasks
- npm run harness:task-card -- docs/tasks/2026-05-long-running-task-registry.md
- npm run harness:check

Remaining risks:
- Registry freshness still depends on agents updating status as work progresses.
```

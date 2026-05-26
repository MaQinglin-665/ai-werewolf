# Harness Check Script

## Task

Short name: harness-check-script

Goal: Add a small read-only `npm run harness:check` command that verifies the mechanical parts of the agent harness.

Why it matters: the orientation checklist now has stable mechanical checks. A script can quickly confirm the harness files and expected validation scripts exist without replacing agent judgment.

## Context To Read First

- `AGENTS.md`
- `docs/harness-orientation.md`
- `docs/harness-state.md`
- `docs/verification-matrix.md`
- `package.json`

## Allowed Scope

Files or directories the agent may edit:

- `package.json`
- `scripts/harness-check.mjs`
- `docs/harness-orientation.md`
- `docs/harness-state.md`
- `docs/verification-matrix.md`
- `docs/tasks/2026-05-harness-check-script.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- production/deployment scripts unrelated to harness checking

## Definition Of Done

This task is complete when:

- `npm run harness:check` exists and runs a read-only check.
- The script reports git status, required harness files, and expected package scripts.
- Missing required files or package scripts make the command exit non-zero.
- The script does not run tests, access the network, read `.env`, or modify files.
- Orientation/state/verification docs mention the command as a mechanical startup check.

## Verification

Required checks:

- Run `npm run harness:check`.
- Read back `scripts/harness-check.mjs`, `package.json`, and changed harness docs.
- Run `git diff -- package.json scripts/harness-check.mjs docs/harness-orientation.md docs/harness-state.md docs/verification-matrix.md docs/tasks/2026-05-harness-check-script.md`.

Optional deeper checks:

- `npm run test` is not required because the script is standalone and read-only.

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

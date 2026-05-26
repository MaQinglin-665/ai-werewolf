# Harness State File

## Task

Short name: harness-state

Goal: Add a lightweight state and handoff file for the project harness so future AI agents can resume without relying on chat history.

Why it matters: instructions and verification rules tell an agent how to work, but state tells it where the project currently is. Without state, new sessions repeat discovery and miss recent harness lessons.

## Context To Read First

- `AGENTS.md`
- `docs/README.md`
- `docs/verification-matrix.md`
- `docs/tasks/HARNESS_TASK_TEMPLATE.md`

## Allowed Scope

Files or directories the agent may edit:

- `AGENTS.md`
- `docs/README.md`
- `docs/harness-state.md`
- `docs/tasks/2026-05-harness-state.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- scripts unrelated to harness state

## Definition Of Done

This task is complete when:

- `docs/harness-state.md` records the current harness structure, recent updates, open handoff items, and known environment notes.
- `AGENTS.md` tells future agents to read the state file during orientation.
- `docs/README.md` includes the state file in the documentation map.
- The state file stays concise and does not duplicate full task docs.
- The handoff records changed files, verification, and remaining risks.

## Verification

Required checks:

- Read back `AGENTS.md`, `docs/README.md`, and `docs/harness-state.md`.
- Run `git diff -- AGENTS.md docs/README.md docs/harness-state.md`.
- Use `git diff --no-index` for any new untracked harness files not shown by normal diff.

Optional deeper checks:

- `npm run lint` is not required for this docs-only change.

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

# Verification Matrix Harness

## Task

Short name: verification-matrix

Goal: Add a verification matrix that helps AI agents choose the smallest useful validation set for each task type.

Why it matters: harness work should make "done" harder to fake. A task-specific matrix reduces missed smoke tests, overbroad validation, and vague handoffs.

## Context To Read First

- `AGENTS.md`
- `docs/README.md`
- `docs/working-agreements.md`
- `docs/threads/verification.md`
- `docs/tasks/HARNESS_TASK_TEMPLATE.md`

## Allowed Scope

Files or directories the agent may edit:

- `AGENTS.md`
- `docs/README.md`
- `docs/verification-matrix.md`
- `docs/tasks/2026-05-verification-matrix.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- scripts unrelated to documentation entrypoints

## Definition Of Done

This task is complete when:

- `docs/verification-matrix.md` lists task types, required checks, deeper checks, and handoff notes.
- `AGENTS.md` links to the matrix from the verification section.
- `docs/README.md` includes the matrix in the documentation map.
- The matrix preserves a lightweight validation style instead of requiring every task to run every command.
- The handoff records changed files, verification, and remaining risks.

## Verification

Required checks:

- Read back `AGENTS.md`, `docs/README.md`, and `docs/verification-matrix.md`.
- Run `git diff -- AGENTS.md docs/README.md docs/verification-matrix.md`.
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

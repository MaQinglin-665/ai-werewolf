# Harness Orientation Checklist

## Task

Short name: harness-orientation

Goal: Add a lightweight orientation checklist that agents can follow before starting work in this repository.

Why it matters: the harness now has entrypoints, state, feature routing, verification, and retrospective write-back. Orientation ties those pieces into a repeatable startup sequence without prematurely adding a script.

## Context To Read First

- `AGENTS.md`
- `docs/harness-state.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `docs/harness-retrospective.md`

## Allowed Scope

Files or directories the agent may edit:

- `AGENTS.md`
- `docs/README.md`
- `docs/harness-state.md`
- `docs/harness-orientation.md`
- `docs/tasks/2026-05-harness-orientation.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- scripts unrelated to harness documentation

## Definition Of Done

This task is complete when:

- `docs/harness-orientation.md` gives a concise startup checklist for agents.
- `AGENTS.md` points agents to the orientation checklist during startup.
- `docs/README.md` includes the orientation file in the documentation map.
- `docs/harness-state.md` lists the orientation checklist in the current harness structure and records that scripts should wait until the checklist stabilizes.
- The checklist stays procedural and does not duplicate the full content of other harness files.

## Verification

Required checks:

- Read back `AGENTS.md`, `docs/README.md`, `docs/harness-state.md`, and `docs/harness-orientation.md`.
- Run `git diff -- AGENTS.md docs/README.md docs/harness-state.md docs/harness-orientation.md`.
- Use `git diff --no-index` for new untracked files not shown by normal diff.

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

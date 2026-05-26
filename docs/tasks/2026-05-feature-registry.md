# Feature Registry Harness

## Task

Short name: feature-registry

Goal: Add a medium-grain feature registry that maps common product areas to source entrypoints, tests, docs, and likely verification.

Why it matters: the harness already tells agents how to work. A feature registry tells agents where to work, reducing repeated repo searches and wrong-file edits.

## Context To Read First

- `AGENTS.md`
- `docs/harness-state.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/verification-matrix.md`
- Relevant `docs/threads/*.md`

## Allowed Scope

Files or directories the agent may edit:

- `AGENTS.md`
- `docs/README.md`
- `docs/harness-state.md`
- `docs/feature-registry.md`
- `docs/tasks/2026-05-feature-registry.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- scripts unrelated to harness documentation

## Definition Of Done

This task is complete when:

- `docs/feature-registry.md` maps common feature areas to source files, tests/scripts, docs, and verification hints.
- `AGENTS.md` tells agents to use the registry when locating code.
- `docs/README.md` includes the registry in the documentation map.
- `docs/harness-state.md` lists the registry in the current harness structure.
- The registry stays concise and does not duplicate full architecture docs.

## Verification

Required checks:

- Read back `AGENTS.md`, `docs/README.md`, `docs/harness-state.md`, and `docs/feature-registry.md`.
- Run `git diff -- AGENTS.md docs/README.md docs/harness-state.md docs/feature-registry.md`.
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

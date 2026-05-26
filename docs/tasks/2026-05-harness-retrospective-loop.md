# Harness Retrospective Loop

## Task

Short name: harness-retrospective-loop

Goal: Add a lightweight retrospective template that helps agents turn repeated failures, confusing checks, and useful lessons into harness updates.

Why it matters: a harness should improve from real work. Without a retro loop, lessons stay in chat history and future agents repeat the same discovery.

## Context To Read First

- `AGENTS.md`
- `docs/harness-state.md`
- `docs/verification-matrix.md`
- `docs/feature-registry.md`
- `docs/tasks/HARNESS_TASK_TEMPLATE.md`

## Allowed Scope

Files or directories the agent may edit:

- `AGENTS.md`
- `docs/README.md`
- `docs/harness-state.md`
- `docs/harness-retrospective.md`
- `docs/tasks/2026-05-harness-retrospective-loop.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- scripts unrelated to harness documentation

## Definition Of Done

This task is complete when:

- `docs/harness-retrospective.md` gives agents a clear rule for when to write back a lesson.
- The template distinguishes issue, evidence, harness update, and follow-up.
- `AGENTS.md` points agents to the retrospective loop during handoff.
- `docs/README.md` includes the retrospective file in the documentation map.
- `docs/harness-state.md` lists the retrospective loop in the current harness structure and next-step guidance.

## Verification

Required checks:

- Read back `AGENTS.md`, `docs/README.md`, `docs/harness-state.md`, and `docs/harness-retrospective.md`.
- Run `git diff -- AGENTS.md docs/README.md docs/harness-state.md docs/harness-retrospective.md`.
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

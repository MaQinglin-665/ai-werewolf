# Harness State

This file records the current state of the AI-agent harness for this repository.
Keep it short. Use it to resume work, not to replace task docs or commit
history.

Harness idea: instructions explain how to work; state explains where the work
currently stands.

## Current Harness Structure

- `AGENTS.md`: root agent entrypoint with orientation, scope rules,
  verification guidance, done criteria, and handoff format.
- `docs/README.md`: documentation map that routes agents to project docs,
  threads, tasks, and harness files.
- `docs/harness-orientation.md`: startup checklist for checking worktree state,
  classifying tasks, locating code, choosing verification, and handing off.
- `docs/tasks/HARNESS_TASK_TEMPLATE.md`: lightweight task-card template for
  scoped agent work.
- `docs/verification-matrix.md`: task-type matrix for choosing the smallest
  useful validation set.
- `docs/feature-registry.md`: medium-grain map from product areas to source
  files, tests, scripts, docs, and likely verification.
- `docs/harness-retrospective.md`: write-back loop for reusable task lessons,
  confusing checks, and repeated failure modes.
- `docs/threads/*.md`: existing responsibility boundaries for frontend,
  rules-engine, AI behavior, AI speech, verification, and docs.
- `docs/tasks/*.md`: task cards and acceptance notes.

## Recent Harness Updates

- Added root `AGENTS.md` so future agents start from repository instructions
  instead of chat memory.
- Added `docs/tasks/HARNESS_TASK_TEMPLATE.md` for scoped work.
- Routed `README.md` and `docs/README.md` toward `AGENTS.md` for AI-agent
  development work.
- Added `docs/verification-matrix.md` after a docs-entrypoint practice task.
- Ran a read-only AI speech/behavior diagnostic and refined the matrix:
  - Full `npm run llm:check -- --task=speech` can timeout.
  - Small diagnostics should start with one persona and no retries.
  - Small behavior diagnostics can use a bounded simulation sample.
- Added `docs/feature-registry.md` so agents can locate common feature areas
  without repeated broad repo searches.
- Added `docs/harness-retrospective.md` so repeated lessons can be written back
  into the right harness file instead of staying in chat history.
- Added `docs/harness-orientation.md` as a text-first startup checklist. Do not
  script it until the checklist proves stable through repeated use.

## Current Handoff Items

- Harness files are currently useful but still uncommitted unless a later
  session stages and commits them.
- Before starting a new feature task, read `AGENTS.md`, this file,
  `docs/feature-registry.md`, `docs/verification-matrix.md`, the relevant
  `docs/threads/*.md`, and the relevant task card.
- After a task, use `docs/harness-retrospective.md` if the work revealed a
  reusable lesson or a harness gap.
- If no task card exists and the task is larger than a small fix, create one
  from `docs/tasks/HARNESS_TASK_TEMPLATE.md`.

## Known Environment Notes

- `npm run simulate:ai -- --games=10 --seed-start=91` completed successfully in
  the harness practice run with 10/10 games completed and zero fallback
  decisions.
- `npm run llm:check -- --task=speech` timed out in a full speech check during
  the practice run.
- `npm run llm:check -- --task=speech --persona=deepseek --retries=0` passed in
  the practice run.
- A Vite message like `WebSocket server error: Port 24678 is already in use`
  can appear even when the command exits 0. Record it as environment noise
  unless the command fails or diagnostic output is missing.

## Suggested Next Harness Enhancements

1. Use `docs/harness-orientation.md` on several real tasks, then decide whether
   a small `npm run harness:check` script is worth adding.
2. Run a clean staged review/commit once the current harness files are ready.

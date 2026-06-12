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

- Recorded the post-Mimo Public Alpha checkpoint on 2026-06-12:
  - ordinary Mimo speech-quality work reached the user-accepted "good enough to
    ship" bar and was committed;
  - Tencent Cloud primary Alpha was deployed and verified;
  - `docs/current-release.md` now records the deployed source, rollback tree,
    preflight result, room SSE smoke, and vote action smoke.
- Added `docs/tasks/2026-06-public-alpha-consolidation-roadmap.md` so future
  agents treat the next phase as Public Alpha consolidation rather than another
  default Fable5/Mimo repair loop.
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
- Added `npm run harness:check` for read-only mechanical checks: git status,
  required harness files, and expected package scripts.
- Added `npm run smoke:main-game` for a fast single-player HTTP smoke covering
  6-player game creation, first human night action, stream continue, and entry
  into day speech.

## Current Handoff Items

- Current primary runtime target is Tencent Cloud:
  `https://175.178.199.245`.
- Latest Tencent runtime source is
  `a0c100c Fix AI pool editable friend build blocker`; the later
  `6b79b8f docs: record Tencent deployment` commit is release documentation.
- Ordinary Mimo speech-quality work is accepted enough to ship. Do not reopen a
  broad phrase-ban, hard-fallback, or repeated Fable5 review loop unless the
  user explicitly asks for another subjective style pass or a no-fallback paid
  sample.
- The next large task is Public Alpha consolidation. Start from
  `docs/tasks/2026-06-public-alpha-consolidation-roadmap.md`.
- The local working tree may contain unrelated frontend/API changes. Before
  deployment or feature work, inspect `git status --short` and group those
  changes intentionally.
- Before starting a new feature task, read `AGENTS.md`, this file,
  `docs/feature-registry.md`, `docs/verification-matrix.md`, the relevant
  `docs/threads/*.md`, and the relevant task card.
- After a task, use `docs/harness-retrospective.md` if the work revealed a
  reusable lesson or a harness gap.
- If no task card exists and the task is larger than a small fix, create one
  from `docs/tasks/HARNESS_TASK_TEMPLATE.md`.

## Known Environment Notes

- Do not print, write, or persist Mimo/API keys. Any paid live model check must
  use temporary process environment only and stay bounded.
- Render is a backup mirror and may lag behind Tencent Cloud until a separate
  Render deployment task updates it.
- The legacy `ai-werewolf` container on the Tencent host can be unhealthy; the
  current success signal is nginx-fronted `ai-werewolf-app` plus public
  preflight/smoke checks.
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

1. Add a lightweight dirty-worktree triage routine or task-card pattern for
   splitting unrelated frontend/API changes before release work.
2. Keep `npm run harness:check` mechanical; use task cards and the verification
   matrix for judgment-heavy decisions.
3. Consider a browser-rendering smoke only when UI layout or hydration changes
   need visual confidence beyond HTTP room/game smokes.
4. After the first real Public Alpha playtest round, write a retrospective entry
   for which smoke checks caught issues and which player reports escaped them.

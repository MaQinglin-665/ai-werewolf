# AI Werewolf Agent Harness

This file is the project entry point for AI coding agents. Treat it as the
agent-readable operating manual for this repository.

Harness idea: do not rely on chat memory. Read the repository, pick a narrow
scope, verify the change, and leave a clean handoff.

## Start Here

Before changing files, read:

1. `README.md` for the product overview and local setup.
2. `docs/README.md` for the project documentation map.
3. `docs/harness-state.md` for current harness status and recent handoff notes.
4. `docs/feature-registry.md` when you need to locate source files, tests, or scripts.
5. `docs/working-agreements.md` for multi-thread collaboration rules.
6. The relevant `docs/threads/*.md` file for the task area.
7. The relevant `docs/tasks/*.md` task file if one exists.

If no task file exists and the task is larger than a small fix, create or ask
for a task card using `docs/tasks/HARNESS_TASK_TEMPLATE.md`.

## Project Shape

`ai-werewolf` is a Next.js social-deduction game with AI player behavior,
rules-engine logic, room/multiplayer flows, deployment scripts, and public
Alpha documentation.

Common ownership areas:

- Frontend/UI: `src/components/**`, related styles, and browser-visible flows.
- Rules engine: `src/game/**` and rules-focused tests.
- AI behavior and speech: `src/ai/**`, prompt contracts, schemas, fallback
  behavior, and LLM evaluation scripts.
- Verification: `src/**/*.test.ts`, `scripts/**`, smoke tests, simulation
  reports, and task acceptance notes.
- Docs and release state: `docs/**`, promotion material, deployment notes, and
  current release records.

## Scope Rules

- Work on one clear task at a time.
- Do not make drive-by refactors.
- Do not edit `.env`, secrets, database files, generated audio caches, `.next`,
  `node_modules`, or `tmp` unless the user explicitly asks.
- Be careful with large shared files, especially `src/components/GameClient.tsx`
  and `src/game/engine.ts`. Prefer small, targeted edits.
- If a change affects game rules, add or update tests first when practical.
- If a change affects AI output structure, check schema, fallback behavior, and
  relevant evaluation or smoke scripts.
- If a change affects UI, run a browser/manual flow when feasible, or clearly
  explain why it was not done.

## Verification Guide

Pick the smallest verification set that actually proves the task.
For task-specific guidance, use `docs/verification-matrix.md`.

Baseline checks:

- `npm run lint`
- `npm run test`
- `npm run build`

Useful targeted checks:

- TypeScript/build confidence: `npx tsc --noEmit`
- AI provider output: `npm run llm:check`
- AI simulation: `npm run simulate:ai`
- Balance attribution: `npm run simulate:diagnose`
- Local Alpha smoke: `npm run smoke:alpha`
- Room SSE smoke: `npm run smoke:room-sse`
- Room action smoke: `npm run smoke:room-action:vote`
- Production preflight: `npm run preflight:production`

Production checks should use the documented deployment flow in
`docs/tencent-cloud-deploy.md` and `docs/current-release.md`.

## Done Means

A task is not done until:

- The requested behavior is implemented or the requested analysis is complete.
- Relevant tests, lint, build, smoke, or manual checks have been run.
- Any skipped verification is named with the reason.
- User-visible behavior, changed files, and remaining risks are summarized.
- The working tree is not polluted by unrelated edits.

## Handoff Format

End substantial work with this format:

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

Harness idea: the next session should be able to resume from the repository and
the final handoff, not from hidden context in the previous chat.

If a task reveals a reusable lesson, update or propose an update using
`docs/harness-retrospective.md`.

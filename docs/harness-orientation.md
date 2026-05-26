# Harness Orientation

Use this checklist at the start of a new task or new agent session. It is a
human-readable checklist first; script only the stable mechanical parts later.

Harness idea: orientation should make the first five minutes boring and
repeatable, while still leaving judgment to the agent.

## Startup Checklist

1. Check the working tree:
   - Run `git status --short`.
   - Optionally run `npm run harness:check` for mechanical harness checks.
   - Identify uncommitted changes before editing.
   - Do not overwrite unrelated user or parallel-agent changes.

2. Read the harness entrypoints:
   - `AGENTS.md`
   - `docs/harness-state.md`
   - `docs/README.md`

3. Classify the task:
   - Docs-only
   - Frontend/UI
   - Rules engine
   - AI behavior
   - AI speech / LLM contract
   - Room / multiplayer
   - Production / release
   - Config / dependency / build

4. Locate the likely work area:
   - Use `docs/feature-registry.md` to find source files, tests, scripts, and
     relevant docs.
   - In PowerShell, prefer `rg --files` and then filter paths instead of relying
     on shell-style globs.
   - Read the matching `docs/threads/*.md` file before editing.

5. Confirm task scope:
   - If a relevant `docs/tasks/*.md` task card exists, read it.
   - If the task is larger than a small fix and no card exists, create one from
     `docs/tasks/HARNESS_TASK_TEMPLATE.md` or ask whether to create it.
   - Name allowed files and out-of-scope files before large edits.

6. Choose verification before implementation:
   - Use `docs/verification-matrix.md`.
   - Pick the smallest checks that prove the requested behavior.
   - Note any checks that are too slow, unavailable, or not relevant.

7. End with a handoff:
   - Summarize completed work, changed files, verification, and remaining risk.
   - If the task revealed a reusable lesson, update or propose an update using
     `docs/harness-retrospective.md`.

## When To Stop And Ask

Ask before proceeding when:

- The task would require editing `.env`, secrets, generated caches, or database
  files.
- The working tree has unrelated changes in files you need to edit.
- A requested change crosses multiple ownership areas and no task card exists.
- The verification matrix says a production or real-provider check is needed
  but credentials, network, or server state are unclear.

## Future Script Candidate

`npm run harness:check` now automates only mechanical checks:

- `git status --short`
- required harness files exist
- current package scripts include expected validation commands

Do not expand the script to classify tasks or choose verification until the
text checklist has proven that those decisions are stable enough to automate.

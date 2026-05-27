# Long-running Tasks

Use this file with `long_running_tasks.json` when work spans multiple sessions,
requires long diagnostics, or can be resumed by another AI agent.

Harness idea: long work should have a visible state machine. Do not leave a
future agent guessing whether a task is still running, blocked, failed, or done.

## When To Register A Task

Create or update an entry in `long_running_tasks.json` when:

- A task is expected to span more than one session.
- A command or diagnostic may run for a long time.
- Work is blocked and needs a clear next action.
- Multiple agents or threads may touch related files.
- A task is paused but should be resumed later.

Small one-turn fixes do not need a long-running task entry unless they leave
unfinished follow-up work.

## Status Values

Use one of these statuses:

- `planned` - known work that has not started.
- `running` - active work in the current or recent session.
- `blocked` - cannot move without a decision, dependency, credential, or external state change.
- `failed` - attempted and stopped because verification or execution failed.
- `killed` - intentionally stopped and should not resume automatically.
- `done` - completed with verification or an explicit reason why verification was skipped.

## Required Fields

Each task should include:

- `id` - stable prefixed id, such as `lrt-ai-balance-001`.
- `title` - short human-readable name.
- `status` - one of the allowed status values.
- `owner` - person, thread, or agent currently responsible.
- `scope` - files, directories, or systems the task may touch.
- `started_at` and `updated_at` - ISO-like timestamps with timezone when possible.
- `related_task_card` - path to the task card, if one exists.
- `handoff_pointer` - file or section where restart details live.
- `last_verified_command` - latest meaningful verification command and result.
- `next_action` - one concrete action for the next session.
- `notes` - short context that does not belong in the always-read startup path.

## Operating Rules

- Keep only active or recently completed long-running work in the JSON file.
- Prefer one owner per task unless the scope is explicitly split.
- Update `updated_at` whenever status, owner, scope, verification, or next action changes.
- Record terminal states before cleanup: `done`, `failed`, `blocked`, `killed`.
- Link to task cards and handoff files instead of pasting long logs into JSON.
- Do not store secrets, API keys, private logs, database dumps, or generated cache content.

## Verification

Run:

```powershell
npm run harness:long-tasks
```

This verifies that `long_running_tasks.json` is valid JSON, uses allowed status
values, and includes the required restart fields.

For substantial harness edits, also run:

```powershell
npm run harness:check
```

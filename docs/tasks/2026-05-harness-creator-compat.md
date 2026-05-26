# 任务卡：对齐 harness-creator 标准生命周期文件

## Task

Short name: harness-creator compatibility

Goal: Use the external `harness-creator` skill to audit this repository harness and add the smallest standard lifecycle layer that improves restartability and structural validation.

Why it matters: The existing project harness is useful, but generic mature-harness tools expect standard root artifacts such as `feature_list.json`, `progress.md`, `session-handoff.md`, and `init.sh`. Adding them makes the harness easier for more agents and tools to discover without replacing project-specific docs.

## Context To Read First

- `AGENTS.md`
- `docs/harness-state.md`
- `docs/verification-matrix.md`
- External skill: `skills/harness-creator/SKILL.md`

## Allowed Scope

Files or directories the agent may edit:

- Root lifecycle files: `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`
- `AGENTS.md`
- `scripts/harness-check.mjs`
- `docs/tasks/`
- `docs/harness-state.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated product, rule, AI, or UI code

## Definition Of Done

This task is complete when:

- External `harness-creator` validation score improves materially from the initial `32/100`.
- Standard lifecycle files route to existing project-specific harness docs instead of duplicating all detail.
- `npm run harness:check` includes the new lifecycle files.

## Verification

Required checks:

- `npm run harness:check`
- `node %TEMP%/learn-harness-engineering/skills/harness-creator/scripts/validate-harness.mjs --target D:/ai-werewolf`

Optional deeper checks:

- `npm run lint` if JS/TS code changes.

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

## 执行记录

Completed:
- Read the external `harness-creator` skill.
- Ran `validate-harness.mjs` before changes: `32/100`, bottleneck `state`.
- Added standard lifecycle files: `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`.
- Added `init.ps1` after `bash init.sh` failed on this Windows environment because WSL lacked `/bin/bash`.
- Updated `AGENTS.md` with explicit Startup Workflow, Definition of Done, End of Session, state-file routing, and one-feature-at-a-time language.
- Updated `scripts/harness-check.mjs` to require the lifecycle files.

Verification:
- `npm run harness:check` passed.
- `node %TEMP%/learn-harness-engineering/skills/harness-creator/scripts/validate-harness.mjs --target D:/ai-werewolf` passed with `100/100`.
- `npm run lint` passed.

Remaining risks:
- The external score is structural; it should be treated as compatibility evidence, not proof that future agents will always perform better.
- `init.sh` is Bash-oriented. Windows agents should use `init.ps1`.

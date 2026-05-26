# 任务卡：脚本化单机主路径 smoke

## Task

Short name: Main game smoke script

Goal: Add a small HTTP smoke script that verifies the single-player main game can create a 6-player game, submit a first human night action, and reach day speech.

Why it matters: The harness browser smoke found a real `/commands/stream` failure. A scriptable smoke gives future agents a quick repeatable check for the same player-facing path without manual clicking.

## Context To Read First

- `docs/harness-retrospective.md`
- `docs/verification-matrix.md`
- `scripts/room-action-smoke.mjs`
- `scripts/room-sse-smoke.mjs`

## Allowed Scope

Files or directories the agent may edit:

- `scripts/`
- `package.json`
- `docs/tasks/`
- `docs/verification-matrix.md`
- `scripts/harness-check.mjs`

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated game rules or UI modules

## Definition Of Done

This task is complete when:

- `npm run smoke:main-game` exists.
- The script can target `MAIN_GAME_SMOKE_BASE_URL` or `--base-url=...`.
- The script verifies a 6-player single-player game reaches `DAY_SPEECH` after a real human night action.
- `npm run harness:check` lists the new smoke script as a required harness script.

## Verification

Required checks:

- `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000`
- `npm run harness:check`

Optional deeper checks:

- `npm run lint`

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

## 执行记录

Completed:
- Added `scripts/main-game-smoke.mjs`.
- Added `npm run smoke:main-game`.
- Added `smoke:main-game` to `npm run harness:check`.
- Updated `docs/verification-matrix.md` with a single-player main game row.

Verification:
- `npm run harness:check`
- `npm run lint`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000`

Result:
- Smoke passed against local Next dev server.
- Covered board `6p-beginner-seer`, human seat `1`, role `WEREWOLF`, first human night action `wolfKill`, final phase `DAY_SPEECH`.

Remaining risks:
- This is an HTTP/API smoke, not a pixel/browser rendering smoke. It protects the main player flow and stream continue route, but it does not verify CSS/layout.

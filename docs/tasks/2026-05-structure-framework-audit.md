# 任务卡：项目结构与代码框架审计

## Task

Short name: structure framework audit

Goal: Check the project structure and code framework with the harness workflow, then add a lightweight repeatable structure audit so future optimization work has objective signals.

Why it matters: The repo has grown across game rules, AI behavior, speech, UI, rooms, deployment, and harness docs. Large files such as `src/ai/speechProviders.ts`, `src/server/roomService.ts`, `src/game/engine.ts`, `src/components/GameClient.tsx`, and `src/app/globals.css` are known maintenance pressure points. A repeatable audit helps choose safe refactor targets.

## Context To Read First

- `AGENTS.md`
- `feature_list.json`
- `progress.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `docs/threads/frontend.md`
- `docs/threads/rules-engine.md`

## Allowed Scope

Files or directories the agent may edit:

- `scripts/`
- `package.json`
- `docs/tasks/`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `src/game/**`
- `src/ai/**`
- `src/server/**`
- `src/components/**`
- `.env`
- generated caches

## Definition Of Done

This task is complete when:

- The current structure risks are documented with evidence.
- A repeatable command exists for future structure audits.
- The command avoids generated files and large binary assets.
- Verification is recorded.

## Verification

Required checks:

- `npm run audit:structure`
- `npm run harness:check`

Optional deeper checks:

- `npm run lint` if script or package metadata changes.

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
- Read harness startup files and architecture/thread docs.
- Identified current large-file pressure points with line-count evidence.
- Added `scripts/structure-audit.mjs`.
- Added `npm run audit:structure`.
- Updated `docs/verification-matrix.md` and `docs/architecture.md` to route framework audits through this command.

Changed files:
- `scripts/structure-audit.mjs`
- `package.json`
- `docs/verification-matrix.md`
- `docs/architecture.md`
- `docs/tasks/2026-05-structure-framework-audit.md`

Verification:
- `npm run audit:structure` passed.
- `npm run harness:check` passed.
- `npm run lint` passed.
- External `harness-creator` validator remained `100/100`.

Audit result:
- Scanned 248 files after excluding generated code and noisy docs artifacts.
- 13 files exceed 1200 lines.
- Largest source pressure points:
  - `src/app/globals.css` - 4602 lines
  - `src/ai/speechProviders.ts` - 3711 lines
  - `src/ai/tableRead.ts` - 3153 lines
  - `src/server/roomService.ts` - 2330 lines
  - `src/components/RoomClient.tsx` - 2126 lines
  - `src/game/engine.ts` - 1959 lines
  - `src/components/GameClient.tsx` - 1865 lines

Remaining risks:
- This task does not move production code. It improves observability and planning for future refactors.

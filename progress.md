# Session Progress Log

## Current State

**Last Updated:** 2026-05-26 19:30 Asia/Shanghai
**Session ID:** local harness optimization
**Active Feature:** structure-framework-audit - Structure Framework Audit

## Status

### What's Done

- [x] Core repository harness exists in `AGENTS.md` and `docs/harness-*`.
- [x] Verification routing exists in `docs/verification-matrix.md`.
- [x] Feature/code routing exists in `docs/feature-registry.md`.
- [x] Mechanical harness check exists as `npm run harness:check`.
- [x] Single-player main game smoke exists as `npm run smoke:main-game`.
- [x] Standard lifecycle files exist: `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`, and `init.ps1`.
- [x] External `harness-creator` structural score improved from `32/100` to `100/100`.
- [x] Structure pressure points identified: `src/ai/speechProviders.ts`, `src/server/roomService.ts`, `src/game/engine.ts`, `src/components/GameClient.tsx`, `src/app/globals.css`.
- [x] `npm run audit:structure` added and verified.

### What's In Progress

- [ ] Commit harness compatibility and structure audit changes.
  - Details: changes are verified and ready to stage if desired.
  - Blockers: none.

### What's Next

1. Commit the lifecycle compatibility layer and structure audit together, or split if desired.
2. For future code-framework optimization, start with one narrow refactor target from `npm run audit:structure`.
3. Recommended first production-code refactor target: extract pure CSS or UI helper modules before touching rules/AI behavior internals.

## Blockers / Risks

- [x] Generic validators may under-score project-specific docs unless standard root files route to them.
- [x] `init.sh` is a Bash entrypoint; on Windows, use `init.ps1`.

## Decisions Made

- **Keep project-specific docs as primary detail**: standard root files are a compatibility and restart layer, not a replacement for `docs/harness-*`.
  - Context: `D:\ai-werewolf` already has a useful harness structure.
  - Alternatives considered: copying the generic templates verbatim, which would duplicate or obscure project-specific guidance.

## Files Modified This Session

- `AGENTS.md` - route standard lifecycle files and name startup/done/end-session procedures.
- `feature_list.json` - standard feature tracker for harness status.
- `progress.md` - standard restartable progress log.
- `session-handoff.md` - standard handoff template.
- `init.sh` - fast initialization and verification entrypoint.
- `init.ps1` - Windows-native initialization and verification entrypoint.
- `scripts/structure-audit.mjs` - repeatable project structure audit.
- `docs/tasks/2026-05-structure-framework-audit.md` - task card for this audit.
- `docs/architecture.md` - points refactor planning to the structure audit command.
- `docs/verification-matrix.md` - adds structure/framework audit verification row.
- `package.json` - adds `audit:structure`.

## Evidence of Completion

- [x] Harness check: `npm run harness:check`
- [x] External structural validator: `node %TEMP%/learn-harness-engineering/skills/harness-creator/scripts/validate-harness.mjs --target D:/ai-werewolf`
- [x] Manual verification: external score improved from `32/100` to `100/100`.
- [x] Windows init: `powershell -NoProfile -ExecutionPolicy Bypass -File init.ps1`
- [x] Lint: `npm run lint`
- [x] Structure audit: `npm run audit:structure`

## Notes for Next Session

Use `AGENTS.md` first. Then read this file, `feature_list.json`, and
`session-handoff.md` for restart state. Use `docs/verification-matrix.md` to
choose task-specific checks.

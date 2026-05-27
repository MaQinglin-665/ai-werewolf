# Session Progress Log

## Current State

**Last Updated:** 2026-05-27 23:57 Asia/Shanghai
**Session ID:** class-trial fixed personas main merge
**Active Feature:** class-trial-fixed-personas - Class Trial Fixed Personas

## Status

### What's Done

- [x] Core harness files are present and validated by `npm run harness:check`.
- [x] Fixed 9-character persona design, implementation plan, and task card are recorded.
- [x] Local-only `学级裁判主题局` visual shell remains separate from `/rooms` and Public Alpha.
- [x] Safe `AiCharacterRoleCard` metadata is accepted through API game creation, sanitized, stored on AI seats, included in setup snapshots, shown only as safe public metadata, and passed into `AgentView`.
- [x] `src/components/game/classTrialTheme.ts` now parses local `personas.json`, reports missing/malformed role-card status, combines asset/role-card status, and builds the fixed 9-character AI lineup.
- [x] Complete role cards start theme games as fixed 9-AI spectator games on `9p-seer-witch-hunter`; missing role cards degrade to ordinary AI behavior with the visual theme still available.
- [x] Real LLM speech input includes local role-card speech style, reasoning bias, pressure response, catchphrase policy, and forbidden boundaries as soft guidance.
- [x] Real LLM action input includes local role-card decision guidance and explicit “role card is soft guidance” constraints.
- [x] Created ignored local file `local-assets/class-trial-pack/personas.json` with 9 role cards and confirmed it remains ignored.
- [x] Browser-level smoke verified homepage theme readiness, fixed 9-character seat order, AI speech progression, no visible hidden-role leak in the dialogue, and no `/rooms` theme entry.
- [x] Merged `codex/class-trial-theme-foundation` into local `main` with conflict resolution that preserved both long-running task registry and class-trial feature records.
- [x] Re-ran full tests, lint, typecheck, task-card gate, and harness check on the merged `main` result.

### What's In Progress

- [ ] No implementation work remains for this task; remaining work is post-merge cleanup and the next feature decision.

### What's Next

1. Restore the protected pre-existing `/ai-pool` main edits from stash after the merge commit is complete.
2. Later slice: GPT-SoVITS Japanese voice routing, Chinese dialogue/Japanese voice text separation, typewriter sync, and per-character voice fallback.
3. Later slice: richer themed controls if the user wants human seats inside the class-trial shell.

## Blockers / Risks

- [ ] `local-assets/class-trial-pack/personas.json` is intentionally ignored local data and must not be staged or committed.
- [ ] Existing local portraits/avatars are copyright/reference assets for private testing only; do not publish them in Public Alpha.
- [ ] This slice does not implement GPT-SoVITS routing, Japanese rewrite generation, or audio/typewriter synchronization.
- [ ] Browser verification used `DATABASE_URL=file:D:/ai-werewolf/prisma/dev.db` from the main local SQLite database because this isolated worktree has no `.env`; repository `.env` and database files were not edited.
- [ ] `git pull --ff-only` failed because local `main` and `origin/main` are not a simple fast-forward; remote synchronization remains separate from this local merge.

## Decisions Made

- Keep this as a local-only theme mode and do not expose it in rooms or Public Alpha.
- Keep existing werewolf rules unchanged; role cards are soft behavior/style guidance only.
- Fixed persona mode uses fixed seats and local-only `personas.json`, not random seats and not AI-pool skinning.
- Dialogue remains Chinese; future GPT-SoVITS should speak Japanese from a separately generated, lightly adapted voice script.
- 黑白熊 keeps a strong taunting/disruptive style, but prompt constraints require legal moves, public evidence, and camp win condition first.

## Files Modified This Session

- `docs/tasks/2026-05-class-trial-fixed-personas.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `src/ai/actionProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/app/api/games/route.ts`
- `src/components/GameClient.tsx`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/gameClientRequests.test.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/game/aiFriends.ts`
- `src/game/engine.ts`
- `src/game/projection.ts`
- `src/game/types.ts`
- `local-assets/class-trial-pack/personas.json` - ignored local private role-card file, not committed.

## Evidence of Completion

- [x] Focused tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts` passed, 7 files / 123 tests.
- [x] Lint: `npm run lint` passed.
- [x] TypeScript: `npx tsc --noEmit` passed.
- [x] Task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md` passed.
- [x] Harness check: `npm run harness:check` passed.
- [x] Local ignored persona file check: `git status --short --ignored local-assets/class-trial-pack/personas.json` returned `!! local-assets/`.
- [x] Browser/manual flow: Playwright at `http://127.0.0.1:51624`, homepage -> `学级裁判主题局` -> `进入牌桌` -> fixed 9-character table -> continued to AI speech; screenshot saved to ignored `tmp/class-trial-fixed-personas-smoke.png`.
- [x] Browser/manual rooms check: Playwright at `/rooms` did not contain `学级裁判主题局`.
- [x] Post-merge full tests on `main`: `npm run test` passed, 60 files / 546 tests.
- [x] Post-merge lint/type/harness on `main`: `npm run lint`; `npx tsc --noEmit`; `npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md`; `npm run harness:check` passed.

## Notes for Next Session

Use `AGENTS.md` first. Then read this file, `feature_list.json`, `session-handoff.md`, and `docs/tasks/2026-05-class-trial-fixed-personas.md`. The class-trial implementation has been merged locally; the next useful product slice is GPT-SoVITS voice routing unless cleanup or remote sync is requested first.

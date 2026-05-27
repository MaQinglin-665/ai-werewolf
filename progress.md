# Session Progress Log

## Current State

**Last Updated:** 2026-05-28 00:15 Asia/Shanghai
**Session ID:** main merge cleanup
**Active Feature:** class-trial-fixed-personas - Class Trial Fixed Personas

## Status

### What's Done

- [x] Core harness files are present and validated by `npm run harness:check`.
- [x] Long-running task registry exists and is validated by `npm run harness:long-tasks`.
- [x] AI Pool Character Roster is recorded as done: role-card fields, safe role-only import/export, prompt propagation, and responsive roster UI.
- [x] Class Trial fixed-persona design, implementation plan, and task card are recorded.
- [x] Local-only `学级裁判主题局` visual shell remains separate from `/rooms` and Public Alpha.
- [x] Safe `AiCharacterRoleCard` metadata is accepted through API game creation, sanitized, stored on AI seats, included in setup snapshots, shown only as safe public metadata, and passed into `AgentView`.
- [x] `src/components/game/classTrialTheme.ts` parses local `personas.json`, reports missing/malformed role-card status, combines asset/role-card status, and builds the fixed 9-character AI lineup.
- [x] Complete role cards start theme games as fixed 9-AI spectator games on `9p-seer-witch-hunter`; missing role cards degrade to ordinary AI behavior with the visual theme still available.
- [x] Real LLM speech/action inputs include local role-card guidance as soft style and decision hints while preserving legal action constraints.
- [x] Browser-level smoke verified homepage theme readiness, fixed 9-character seat order, AI speech progression, no visible hidden-role leak, and no `/rooms` theme entry.

### What's In Progress

- [ ] Finish local merge/stash cleanup.
  - Details: `docs/tasks/2026-05-ai-pool-character-roster.md`, `feature_list.json`, and this progress file are staged for the AI Pool completion record.
  - Blockers: none after resolving this file.

### What's Next

1. Commit the resolved AI Pool completion record.
2. Commit `scripts/harness-check.mjs` separately as the state-health gate enhancement.
3. Later slice: GPT-SoVITS Japanese voice routing, Chinese dialogue/Japanese voice text separation, typewriter sync, and per-character voice fallback.

## Blockers / Risks

- [ ] `local-assets/class-trial-pack/personas.json` is intentionally ignored local data and must not be staged or committed.
- [ ] Existing local portraits/avatars are copyright/reference assets for private testing only; do not publish them in Public Alpha.
- [ ] Class Trial does not yet implement GPT-SoVITS routing, Japanese rewrite generation, or audio/typewriter synchronization.
- [ ] AI Pool real-provider role-play validation was skipped because no safe disposable API key was provided and testing may produce model cost.
- [ ] AI Pool build was attempted but failed type-checking on a pre-existing unrelated `src/server/gameService.ts:739` implicit `any`; existing Turbopack NFT warning remained.

## Decisions Made

- Keep Class Trial as a local-only theme mode and do not expose it in rooms or Public Alpha.
- Keep existing werewolf rules unchanged; role cards are soft behavior/style guidance only.
- Fixed persona mode uses fixed seats and local-only `personas.json`, not random seats and not AI-pool skinning.
- Dialogue remains Chinese; future GPT-SoVITS should speak Japanese from a separately generated, lightly adapted voice script.
- Long-running or blocked work should be recorded in `long_running_tasks.json`, with detailed restart context linked from task cards or handoff files.

## Files Modified This Session

- `docs/tasks/2026-05-ai-pool-character-roster.md` - implementation record for the character roster.
- `feature_list.json` - marks `ai-pool-character-roster` done with verification evidence.
- `progress.md` - resolves merge/stash progress state.
- `scripts/harness-check.mjs` - unstaged follow-up: state-health gate enhancement.

## Evidence of Completion

- [x] AI pool character roster focused tests: `npm run test -- src/components/game/aiFriendRoleRoster.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/AiPoolClient.mobile.test.ts`
- [x] AI pool character roster harness/static checks: `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-character-roster.md`; `npm run harness:check`; feature list JSON parse; `git diff --check`
- [x] AI pool character roster lint/type: `npm run lint`; `npx tsc --noEmit`
- [x] AI pool character roster browser checks: Chrome headless desktop and 390x844 mobile viewport at `http://127.0.0.1:3011/ai-pool`
- [x] Class Trial focused tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts`
- [x] Class Trial post-merge full tests on `main`: `npm run test` passed, 60 files / 546 tests.
- [x] Class Trial post-merge lint/type/harness on `main`: `npm run lint`; `npx tsc --noEmit`; `npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md`; `npm run harness:check` passed.

## Notes for Next Session

Use `AGENTS.md` first. Then read this file, `feature_list.json`, `session-handoff.md`, `docs/tasks/2026-05-ai-pool-character-roster.md`, and `docs/tasks/2026-05-class-trial-fixed-personas.md`.

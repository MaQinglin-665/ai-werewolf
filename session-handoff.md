# Session Handoff

## Current Objective

- Goal: Finish the local-only `学级裁判主题局` fixed 9-character AI persona layer.
- Current status: Complete. Role cards are stored safely, fixed class-trial AI lineups can start local spectator games, speech/action prompts receive role-card guidance, and harness/browser verification passed.
- Branch / worktree: `codex/class-trial-theme-foundation` at `D:\ai-werewolf\.worktrees\class-trial-theme-foundation`.
- Base note: this worktree was created from `c75b4f5`; the main worktree had unrelated dirty changes and should be merged carefully.

## Completed This Session

- [x] Added shared `AiCharacterRoleCard` metadata across game types, AI friend configs, setup snapshots, human views, and agent views.
- [x] Added API validation for safe role-card payloads in `/api/games`.
- [x] Added tests proving role cards survive API game creation without leaking secret/api-key style data.
- [x] Added local class-trial `personas.json` parsing, status reporting, combined readiness messaging, and fixed 9-character AI friend construction.
- [x] Wired `GameClient` to fetch `/class-trial-pack/personas.json` and start complete theme games as fixed 9-AI spectator games on `9p-seer-witch-hunter`.
- [x] Updated landing copy/status so missing local role cards degrade to visual-only mode instead of blocking the theme.
- [x] Injected role-card guidance into real LLM speech input as soft table-player style and forbidden boundaries.
- [x] Injected role-card guidance into real LLM action input as soft decision constraints that cannot override legal candidates, public evidence, hidden-information boundaries, or camp win condition.
- [x] Created ignored local role-card data at `local-assets/class-trial-pack/personas.json` and confirmed it remains untracked.
- [x] Updated `feature_list.json`, `progress.md`, this handoff, and the fixed-persona task card.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Focused task tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts` | passed | 7 files, 123 tests. API test used a temp copy of `D:\ai-werewolf\prisma\dev.db`. |
| Lint | `npm run lint` | passed | ESLint clean. |
| TypeScript | `npx tsc --noEmit` | passed | Type-level confidence for changed contracts. |
| Task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md` | passed | Confirms task card remains complete. |
| Harness check | `npm run harness:check` | passed | Mechanical harness checks passed. |
| Ignored persona file | `git status --short --ignored local-assets/class-trial-pack/personas.json` | passed | Output: `!! local-assets/`; file remains ignored. |
| Browser/manual theme flow | Playwright at `http://127.0.0.1:51624` | passed | Homepage -> `学级裁判主题局` -> fixed 9-character spectator table -> AI speech. |
| Browser/manual rooms check | Playwright at `http://127.0.0.1:51624/rooms` | passed | `/rooms` did not contain `学级裁判主题局`. |

## Files Changed

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
- `local-assets/class-trial-pack/personas.json` - ignored local private role-card data, not committed.

## Decisions Made

- Fixed-persona mode uses a local ignored `personas.json` and fixed seat order.
- Role cards are soft style/strategy guidance only; the rules engine, legal candidates, public evidence, hidden-information boundaries, and camp win condition remain authoritative.
- Missing or malformed role cards do not break the visual theme; they fall back to ordinary AI behavior.
- This feature remains local-only and is not exposed through `/rooms` or Public Alpha.
- Future Japanese voice output should be a separate GPT-SoVITS/text-rewrite slice.

## Blockers / Risks

- Local role cards, portraits, and avatars are private testing material and must not be committed or published.
- This slice does not implement GPT-SoVITS routing, Japanese rewrite generation, audio fallback, or typewriter sync.
- Browser verification used `DATABASE_URL=file:D:/ai-werewolf/prisma/dev.db` because the isolated worktree has no `.env`; no `.env` or database files were edited.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `progress.md`, `feature_list.json`, and this handoff.
3. Read `docs/tasks/2026-05-class-trial-fixed-personas.md`.
4. Check `git status --short --ignored local-assets/class-trial-pack/personas.json`.
5. Decide whether to commit the implementation or continue into the GPT-SoVITS voice-routing slice.

## Recommended Next Step

- Commit/integrate this fixed-persona slice, then plan the Japanese voice text + GPT-SoVITS routing slice.

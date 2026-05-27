# Session Handoff

## Current Objective

- Goal: Ship the first local-only `学级裁判主题局` foundation slice for single-player AI Werewolf.
- Current status: Model, homepage entry, missing-pack status, localStorage mode selection, local ignored asset pack, first themed table shell, and browser/manual verification are complete. Branch is ready for integration choice.
- Branch / worktree: `codex/class-trial-theme-foundation` at `D:\ai-werewolf\.worktrees\class-trial-theme-foundation`.
- Base note: this worktree was created from `c75b4f5`; the main worktree had unrelated dirty changes and should be merged carefully.

## Completed This Session

- [x] Created `docs/superpowers/specs/2026-05-27-class-trial-theme-mode-design.md`.
- [x] Created `docs/superpowers/plans/2026-05-27-class-trial-theme-mode-foundation.md`.
- [x] Created and validated `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`.
- [x] Added `/local-assets/` to `.gitignore` for private portraits, manifests, and voice assets.
- [x] Added `src/components/game/classTrialTheme.ts` and focused tests for roster metadata, asset pack probe behavior, and mode storage keys.
- [x] Added a homepage `学级裁判主题局` local theme selector to `src/components/game/LandingPanel.tsx`.
- [x] Wired theme mode and missing-pack status in `src/components/GameClient.tsx`.
- [x] Added `src/components/game/ClassTrialGameTable.tsx` and CSS for the first ring-table visual shell.
- [x] Exported the themed table through `src/components/game/GamePanels.tsx`.
- [x] Added/updated focused UI tests for theme entry and themed table rendering.
- [x] Updated `feature_list.json`, `progress.md`, and this handoff for restartability.
- [x] Hid the global identity button while the class-trial theme shell is active.
- [x] Verified the local browser flow and confirmed `/rooms` does not expose the theme.
- [x] Downloaded local private test portraits and generated avatars under ignored `local-assets/class-trial-pack`.
- [x] Added a local-only `/class-trial-pack/...` route that serves files from `local-assets/class-trial-pack`.
- [x] Wired the theme table to show the fixed 9-character roster, seat avatars, and active speaker portrait.
- [x] Replaced mixed-size speaking portraits with closer-size fullbody transparent PNGs, roughly matching `千早爱音`; old half-body downloads are backed up in ignored `local-assets/class-trial-pack/portraits-halfbody-backup`.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Theme model focused test | `npm run test -- src/components/game/classTrialTheme.test.ts` | passed | Covers roster, pack status, and mode key basics. |
| Landing panel regression test | `npm run test -- src/components/game/gamePanelsMobile.test.ts` | passed | Covers homepage theme entry and existing panel behavior. |
| Themed table focused test | `npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` | passed | Covers shell rendering and no visible role identity. |
| Combined focused tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` | passed | 3 files, 18 tests. |
| Lint | `npm run lint` | passed | Confirms ESLint state after UI changes. |
| TypeScript | `npx tsc --noEmit` | failed | Pre-existing unrelated `src/server/gameService.ts(739,36)` implicit-any issue. |
| Task-card gate | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-theme-mode-foundation.md` | passed | Confirms required task-card fields. |
| Harness check | `npm run harness:check` | passed | Confirms mechanical harness files and package scripts. |
| Feature list JSON | `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"` | passed | Confirms feature tracker JSON remains valid. |
| Diff whitespace | `git diff --check` | passed | Exit 0 with CRLF replacement warnings only. |
| Browser/manual theme flow | in-app Browser at `http://127.0.0.1:3012`, homepage -> theme -> 9p spectator -> themed shell | passed | Shell rendered; global visible identity button count was 0; shell role words were absent. |
| Browser/manual rooms check | in-app Browser at `http://127.0.0.1:3012/rooms` | passed | `/rooms` did not contain `学级裁判主题局`. |
| Asset route focused tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts` | passed | 3 files, 10 tests. |
| Local asset HTTP checks | `GET /class-trial-pack/manifest.json`; `GET /class-trial-pack/portraits/苗木诚.png` | passed | Both returned 200; portrait content type was `image/png`. |
| Browser/manual asset flow | in-app Browser at `http://127.0.0.1:3012` | passed | 9 seat avatars rendered; after continuing into speech, active portrait rendered for `江之岛盾子`. |
| Browser/manual portrait sizing | in-app Browser at `http://127.0.0.1:3012` | passed | Continued through speech samples; human character portraits used the same visible 352px image box and closer source heights. |

## Files Changed

- `.gitignore`
- `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `src/app/globals.css`
- `src/app/class-trial-pack/[...assetPath]/route.ts`
- `src/app/class-trial-pack/[...assetPath]/route.test.ts`
- `src/components/GameClient.tsx`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/GamePanels.tsx`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/gamePanelsMobile.test.ts`
- `local-assets/class-trial-pack/**` - ignored local private test assets, not committed.

## Decisions Made

- This mode is local-only and not exposed in rooms or Public Alpha.
- The first slice is visual/entry foundation only; no rules, server, room, real asset, or TTS routing changes.
- The hidden role identity remains hidden in the themed shell.
- Private asset packs should live in ignored local paths and be loaded by convention later.

## Blockers / Risks

- `npx tsc --noEmit` is blocked by an unrelated pre-existing server typing issue at `src/server/gameService.ts(739,36)`.
- Local portraits/avatars are copyright/reference assets for local private testing only; do not publish them in Public Alpha or commit them to Git.
- 黑白熊 remains a special case because the best available fullbody source is much shorter than human characters.
- First slice now proves local image display, but still does not prove voice playback, typewriter sync, or character-persona prompting.
- The themed shell should be expanded later for human action controls, asset-manifest loading, and the 9 GPT-SoVITS voice routes.
- Browser verification used the main local SQLite `DATABASE_URL` because this isolated worktree has no `.env`; repository `.env` and database files were not edited.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `progress.md`, `feature_list.json`, and this handoff.
3. Read `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`.
4. Use the verification evidence above before deciding whether to merge.
5. Continue from `D:\ai-werewolf\.worktrees\class-trial-theme-foundation` on branch `codex/class-trial-theme-foundation`.

## Recommended Next Step

- Choose whether to merge the worktree branch or keep it isolated for the next slice.

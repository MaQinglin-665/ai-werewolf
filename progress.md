# Session Progress Log

## Current State

**Last Updated:** 2026-05-27 22:38 Asia/Shanghai
**Session ID:** class-trial fixed personas plan
**Active Feature:** class-trial-fixed-personas - Class Trial Fixed Personas

## Status

### What's Done

- [x] Core harness files are present: `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, and `init.ps1`.
- [x] Product design recorded in `docs/superpowers/specs/2026-05-27-class-trial-theme-mode-design.md`.
- [x] Implementation plan recorded in `docs/superpowers/plans/2026-05-27-class-trial-theme-mode-foundation.md`.
- [x] Task card created and validated at `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`.
- [x] Private local theme assets are kept out of git via `/local-assets/` in `.gitignore`.
- [x] Class-trial theme model added in `src/components/game/classTrialTheme.ts` with focused tests.
- [x] Homepage can choose default mode or local-only `学级裁判主题局`.
- [x] Missing local pack state is shown from a tolerant `/class-trial-pack/manifest.json` probe.
- [x] Theme mode selection is stored in localStorage.
- [x] A first themed table shell renders a 9-player ring, central phase/speaker panel, foreground speaker portrait placeholder, and dialogue box.
- [x] Theme game mode hides the global identity button so identities are not exposed during play.
- [x] Local ignored asset pack created at `local-assets/class-trial-pack` with 9 portraits and 9 generated avatars using the user's Chinese filename preference.
- [x] Local route `/class-trial-pack/...` serves ignored manifest/image files from `local-assets/class-trial-pack`.
- [x] Theme table maps seats to the fixed 9-character class-trial roster and displays pack avatars/portraits when present.
- [x] Speaking portraits were switched from mixed half-body crops to closer-size fullbody transparent PNGs, roughly matching `千早爱音` height; the old half-body downloads are backed up in ignored `local-assets/class-trial-pack/portraits-halfbody-backup`.
- [x] Default rooms/Public Alpha surfaces were not edited.
- [x] Fixed 9-character persona design recorded in `docs/superpowers/specs/2026-05-27-class-trial-fixed-personas-design.md`.
- [x] Fixed 9-character persona implementation plan recorded in `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`.
- [x] Fixed persona task card created at `docs/tasks/2026-05-class-trial-fixed-personas.md`.

### What's In Progress

- [ ] Awaiting user choice of execution mode for the fixed-persona implementation plan.

### What's Next

1. Choose execution mode for `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`.
2. Implement local `personas.json`, fixed 9-person AI lineup replacement, and prompt injection.
3. Keep GPT-SoVITS and Japanese voice-line generation as a later slice.

## Blockers / Risks

- [ ] `npx tsc --noEmit` currently fails on a pre-existing unrelated server issue: `src/server/gameService.ts(739,36): Parameter 'tx' implicitly has an 'any' type`.
- [ ] The local pack now has downloaded test portraits/avatars, but they are copyright/reference assets for local private testing only and must not be published in Public Alpha.
- [ ] 黑白熊 uses a much shorter source image than the human characters; keep it if the stylized size feels right, or replace it with another render later.
- [ ] This slice still does not include GPT-SoVITS routing, typewriter voice sync, or LLM character behavior.
- [ ] The themed table shell is aimed at local spectator/continue flow first; richer human-action controls belong in a later slice.
- [ ] This worktree was created from `c75b4f5`, while the main worktree already had unrelated dirty changes. Merge back carefully.
- [ ] Browser verification used the main local SQLite `DATABASE_URL` because this isolated worktree has no `.env`; repository `.env` and database files were not edited.

## Decisions Made

- Keep this as a local-only theme mode and do not expose it in rooms or Public Alpha.
- Keep existing werewolf rules unchanged; the theme only changes presentation and later voice/persona routing.
- Store private images and voice assets under ignored local paths, not in git.
- Wait for all 9 role voices before implementing full GPT-SoVITS routing.
- Fixed persona slice uses fixed seats and local-only `personas.json`, overriding the earlier open idea of random seats for this theme.
- The dialogue box remains Chinese; later GPT-SoVITS should speak Japanese from a separately generated, lightly adapted voice script.

## Files Modified This Session

- `.gitignore`
- `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`
- `docs/tasks/2026-05-class-trial-fixed-personas.md`
- `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`
- `docs/superpowers/specs/2026-05-27-class-trial-fixed-personas-design.md`
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

## Evidence of Completion

- [x] Theme model test: `npm run test -- src/components/game/classTrialTheme.test.ts`
- [x] Landing-panel regression test: `npm run test -- src/components/game/gamePanelsMobile.test.ts`
- [x] Table shell focused test: `npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- [x] Lint: `npm run lint`
- [x] Task-card gate: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-theme-mode-foundation.md`
- [x] Combined focused tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- [x] Harness check: `npm run harness:check`
- [x] Browser/manual local flow: in-app Browser at `http://127.0.0.1:3012`, homepage -> `学级裁判主题局` -> `9 人预女猎` -> `无真人` -> themed shell.
- [x] Browser/manual rooms check: `/rooms` did not contain `学级裁判主题局`.
- [x] Final feature-list JSON check: `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"`
- [x] Diff whitespace check: `git diff --check` exited 0 with CRLF replacement warnings only.
- [x] TypeScript check attempted: `npx tsc --noEmit` failed on pre-existing `src/server/gameService.ts(739,36)` implicit-any issue.
- [x] Local pack HTTP checks: `GET /class-trial-pack/manifest.json` and `GET /class-trial-pack/portraits/苗木诚.png` returned 200.
- [x] Browser/manual asset flow: 9 seat avatars rendered, then after advancing to speech the active portrait rendered for `江之岛盾子`.
- [x] Browser/manual sizing check: after continuing through speech, `苗木诚`, `雾切响子`, `腐川冬子`, `江之岛盾子`, `塞蕾丝缇雅`, and `十神白夜` used the same visible portrait box height; source heights are now close to `千早爱音` except `黑白熊`.
- [x] Fixed persona spec self-review: no TODO/TBD placeholders; local-only, fixed seats, Public Alpha exclusion, and future Japanese voice-line boundary are explicit.
- [x] Fixed persona plan/task-card written: `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`; `docs/tasks/2026-05-class-trial-fixed-personas.md`.

## Notes for Next Session

Use `AGENTS.md` first. Then read this file, `feature_list.json`, `session-handoff.md`,
`docs/tasks/2026-05-class-trial-theme-mode-foundation.md`, and
`docs/superpowers/specs/2026-05-27-class-trial-fixed-personas-design.md`, then
`docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md` and
`docs/tasks/2026-05-class-trial-fixed-personas.md`.

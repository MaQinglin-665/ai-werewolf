# 学级裁判主题局第一期

## Task

Short name: class-trial-theme-mode-foundation

Goal: Add a local-only class trial theme entry and visual shell without changing rules, rooms, or Public Alpha behavior.

Why it matters: The theme mode needs a safe local foundation before adding private assets, GPT-SoVITS routing, or LLM character behavior.

## Task Gate

Task type: Frontend/UI

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> select 学级裁判主题局 -> start a 9p spectator game -> confirm themed shell; also confirm /rooms does not show the theme.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production/release check
- Reason: first slice is local-only and must not change Public Alpha or deployment.
- Residual risk: local browser verification does not prove later GPT-SoVITS or real LLM behavior.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-27-class-trial-theme-mode-design.md`
- `docs/superpowers/plans/2026-05-27-class-trial-theme-mode-foundation.md`

## Allowed Scope

Files or directories the agent may edit:

- `.gitignore`
- `src/components/GameClient.tsx`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/GamePanels.tsx`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialTheme.ts`
- `src/app/class-trial-pack/[...assetPath]/route.ts`
- `src/components/game/*.test.ts`
- `src/app/globals.css`
- `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- `src/game/**`
- `src/server/**`
- `src/app/api/**`
- `src/app/rooms/**`
- `local-assets/**` real private assets, unless the user explicitly asks to place local-only private test material.

## Definition Of Done

This task is complete when:

- The local asset directory is ignored.
- The homepage can select default or 学级裁判主题局.
- Missing local pack state is explained clearly.
- Starting a local game in theme mode shows the class-trial visual shell.
- Rooms/Public Alpha surfaces are unchanged.
- Focused tests, lint, and browser flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- Browser/manual local flow.

Optional deeper checks:

- `npx tsc --noEmit`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:<port>`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added ignored local asset convention via /local-assets/.
- Added class trial theme model, roster metadata, pack status helper, and focused tests.
- Added homepage 学级裁判主题局 selector with missing-pack status and localStorage mode persistence.
- Added first class-trial ring-table shell with central phase/speaker info, foreground speaker placeholder, dialogue box, and hidden identity.
- Hid the global identity button while the class-trial theme shell is active.
- Added ignored local asset pack files under local-assets/class-trial-pack with 9 portraits and 9 generated avatars.
- Added local-only class-trial-pack route and wired the theme shell to display roster avatars and active speaker portrait.
- Replaced mixed-size speaking portraits with closer-size fullbody transparent PNGs, roughly matching 千早爱音.
- Left rooms/Public Alpha and rules/server code untouched.

Changed files:
- .gitignore
- src/components/GameClient.tsx
- src/components/game/LandingPanel.tsx
- src/components/game/GamePanels.tsx
- src/components/game/ClassTrialGameTable.tsx
- src/components/game/classTrialTheme.ts
- src/app/class-trial-pack/[...assetPath]/route.ts
- src/app/class-trial-pack/[...assetPath]/route.test.ts
- src/components/game/classTrialTheme.test.ts
- src/components/game/classTrialGameTable.test.ts
- src/components/game/gamePanelsMobile.test.ts
- src/app/globals.css
- feature_list.json
- progress.md
- session-handoff.md
- docs/tasks/2026-05-class-trial-theme-mode-foundation.md

Verification:
- Passed: npm run test -- src/components/game/classTrialTheme.test.ts
- Passed: npm run test -- src/components/game/gamePanelsMobile.test.ts
- Passed: npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
- Passed: npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
- Passed: npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts
- Passed: npm run lint
- Passed: npm run harness:task-card -- docs/tasks/2026-05-class-trial-theme-mode-foundation.md
- Passed: npm run harness:check
- Passed: browser/manual flow at http://127.0.0.1:3012, homepage -> 学级裁判主题局 -> 9 人预女猎 -> 无真人 -> themed shell.
- Passed: browser/manual /rooms check did not expose 学级裁判主题局.
- Passed: browser/manual asset check rendered 9 seat avatars and an active speaker portrait.
- Passed: browser/manual portrait sizing check kept sampled human character portraits in the same visible image box height.
- Known unrelated failure: npx tsc --noEmit fails at src/server/gameService.ts(739,36) for an implicit-any tx parameter.

Remaining risks:
- Local portraits/avatars are copyright/reference assets for local private testing only; do not publish or commit them.
- 黑白熊 is still a special-size source asset compared with human characters.
- First slice does not include GPT-SoVITS routing, typewriter voice sync, or LLM persona behavior.
- Themed shell is optimized for local spectator/continue flow first; richer human action controls should be a later slice.
```

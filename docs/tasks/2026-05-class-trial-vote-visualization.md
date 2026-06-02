# 学级裁判主题局投票阶段可视化

## Task

Short name: class-trial-vote-visualization

Goal: Upgrade only the local-only class-trial common exile vote phase so `DAY_VOTE` shows sealed voting progress without exposing targets, then reveals the completed vote result in one dramatic class-trial surface.

Why it matters: The current class-trial vote phase is too flat for recording and review. It needs visible tension while preserving the core social-deduction privacy boundary.

## Task Gate

Task type: Frontend/UI + public projection

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> reach `DAY_VOTE` -> confirm `封票中` shows locked/waiting states without targets -> complete all votes -> confirm `开票揭示` shows tally and ledger.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: this is a local-only class-trial theme surface and must not change Public Alpha or `/rooms`.
- Residual risk: public multiplayer voting still needs its own release checks before future public rollout.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/threads/rules-engine.md`
- `docs/tasks/2026-05-class-trial-flow-scenes.md`
- `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `docs/superpowers/specs/2026-05-31-class-trial-vote-visualization-design.md`
- `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/game/types.ts`
- `src/game/projection.ts`
- `src/game/engine.test.ts`
- `src/components/game/ClassTrialVoteStage.tsx`
- `src/components/game/classTrialVoteStage.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialPhaseScenes.ts`
- `src/components/game/classTrialPhaseScenes.test.ts`
- `src/app/globals.css`
- `docs/tasks/2026-05-class-trial-vote-visualization.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- `local-assets/class-trial-pack/**`
- `src/game/engine.ts`
- `src/components/game/VotePanels.tsx`
- `src/app/rooms/**`
- `src/server/roomService.ts`
- Public Alpha deployment docs unless a later release task asks for it

## Definition Of Done

This task is complete when:

- `DAY_VOTE` public projection exposes only eligible, locked, and pending seat ids.
- `DAY_VOTE` projection keeps `votes`, `tally`, targets, reasons, and leaders hidden.
- The class-trial table shows `封票中`, lock count, and per-seat `已锁票` / `等待中`.
- The class-trial reveal shows `开票揭示`, tally ranking, abstain count, and voter-to-target ledger in one view.
- The sole leading seat receives a visible class-trial focus marker after reveal.
- Ordinary discussion turns do not show the vote stage.
- Generic vote UI, sheriff vote UI, room UI, and Public Alpha surfaces are unchanged.
- Browser/manual verification confirms the local themed flow.

## Verification

Required checks:

- `npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-visualization.md`
- `npm run harness:check`
- `git diff --check`
- Browser/manual local flow.

Optional deeper checks:

- `npm run smoke:main-game` if a local server is already running and the route is useful for reaching the single-player table quickly.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added safe hidden vote-progress projection for DAY_VOTE.
- Added ClassTrialVoteStage for sealed vote progress and one-shot reveal.
- Wired class-trial table seat locked/waiting chips, reveal focus, and updated phase copy.
- Kept non-theme vote UI, rooms, and Public Alpha unchanged.

Changed files:
- src/game/types.ts
- src/game/projection.ts
- src/game/engine.test.ts
- src/components/game/ClassTrialVoteStage.tsx
- src/components/game/classTrialVoteStage.test.ts
- src/components/game/ClassTrialGameTable.tsx
- src/components/game/classTrialGameTable.test.ts
- src/components/game/classTrialPhaseScenes.ts
- src/components/game/classTrialPhaseScenes.test.ts
- src/app/globals.css
- docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md
- docs/tasks/2026-05-class-trial-vote-visualization.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/game/engine.test.ts -t "keeps votes private until resolution reveals tally and public vote reasons" failed first, then passed.
- npm run test -- src/components/game/classTrialVoteStage.test.ts passed.
- npm run test -- src/components/game/classTrialGameTable.test.ts passed.
- npm run test -- src/components/game/classTrialPhaseScenes.test.ts passed.
- npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts passed 6 files / 170 tests.
- npm run lint passed.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-visualization.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.
- Browser http://127.0.0.1:51631 confirmed sealed DAY_VOTE progress with 3 / 9, 已锁票/等待中, no arrows/targets, plus 开票揭示 tally/ledger/focus-seat reveal.

Remaining risks:
- This slice is local-only class-trial UI/projection work and intentionally did not exercise /rooms or production release checks.
- Mobile-specific class-trial vote layout was not separately screen-captured; automated mobile panel tests were included in the focused regression pack.
```

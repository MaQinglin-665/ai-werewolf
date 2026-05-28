# 学级裁判主题局审判场背景与终局复盘

## Task

Short name: class-trial-verdict-review

Goal: Add a local-only red/black court background, persistent death-seat markers, and automatic class-trial verdict review after game over.

Why it matters: The class-trial theme needs to feel like a complete recording-ready trial scene, not only a reskinned werewolf table.

## Task Gate

Task type: Frontend/UI + local-only visual asset

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> 无真人观战 -> confirm red/black court background, persistent dead-seat marker without identity leak, automatic verdict review at GAME_OVER, and no theme entry on /rooms.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: this is local-only private theme UI and must not be exposed in Public Alpha.
- Residual risk: public room surfaces still need their existing release checks before any future public rollout.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-28-class-trial-verdict-review-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-verdict-review.md`
- `docs/tasks/2026-05-class-trial-flow-scenes.md`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/ReviewPanel.tsx`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/ClassTrialVerdictReview.tsx`
- `src/components/game/classTrialVerdictReview.test.ts`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/app/globals.css`
- `local-assets/class-trial-pack/backgrounds/court-main.png` as ignored local-only data
- `local-assets/class-trial-pack/manifest.json` as ignored local-only data
- `docs/tasks/2026-05-class-trial-verdict-review.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- tracked image/audio assets
- generated caches
- `src/game/**`
- `src/ai/**`
- `src/app/rooms/**`
- `src/server/**`
- Public Alpha deployment docs unless a later release task asks for it

## Definition Of Done

This task is complete when:

- A local ignored red/black court background image exists under `local-assets/class-trial-pack/backgrounds`.
- The local manifest can expose `backgrounds.courtMain` while older manifests still work.
- Class-trial games use the local court background when present and CSS fallback when absent.
- Dead class-trial seats show a persistent `已退场` marker.
- Dead class-trial seats do not reveal identity, camp, or death reason before terminal review.
- `GAME_OVER` class-trial games automatically show a themed verdict review.
- Verdict review shows final verdict, key evidence, vote fog, departure list, and role reveal from existing `GameReview` data.
- Default games and `/rooms` remain unchanged.
- Focused tests, lint, type check, build, task-card check, harness check, diff check, and browser flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialVerdictReview.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-verdict-review.md`
- `npm run harness:check`
- `git diff --check`
- Browser/manual local flow.

Optional deeper checks:

- API full-game smoke with local class-trial `aiFriends` and `aiRuntimeMode: "mock"`.

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

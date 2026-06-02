# 学级裁判投票爆发演出

## Task

Short name: class-trial-vote-burst-animation

Goal: Add a local-only class-trial vote burst animation layer for vote start and vote reveal while keeping sealed vote privacy and the existing readable tally/ledger layout.

Why it matters: The current vote visualization is readable but still too flat for the desired弹丸式审判演出. This slice adds impact at the two important moments without making sealed information leak or turning the whole vote phase into noise.

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
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> reach sealed DAY_VOTE -> confirm TRIAL VOTE burst, readable sealed progress, no target leak -> load revealed exile fixture -> confirm seat spotlight plus 开票揭示 -> load no-exile fixture -> confirm 未达成处刑.
- If skipped, reason:

State updates required:

- [x] feature_list.json
- [x] progress.md
- [x] session-handoff.md
- [x] Relevant docs/tasks/*.md
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: this is a local-only class-trial theme surface and does not touch /rooms or Public Alpha.
- Residual risk: future public/multiplayer vote animation requires separate room and release verification.

## Context To Read First

- docs/working-agreements.md
- docs/threads/frontend.md
- docs/tasks/2026-05-class-trial-vote-visualization.md
- docs/superpowers/specs/2026-05-31-class-trial-vote-burst-animation-design.md
- docs/superpowers/plans/2026-05-31-class-trial-vote-burst-animation.md

## Allowed Scope

Files or directories the agent may edit:

- src/components/game/ClassTrialVoteStage.tsx
- src/components/game/classTrialVoteStage.test.ts
- src/components/game/classTrialGameTable.test.ts
- src/app/globals.css
- docs/tasks/2026-05-class-trial-vote-burst-animation.md
- feature_list.json
- progress.md
- session-handoff.md

Files or directories the agent should not edit:

- .env
- generated caches
- local-assets/class-trial-pack/**
- src/game/engine.ts
- src/game/projection.ts
- src/components/game/VotePanels.tsx
- src/app/rooms/**
- src/server/roomService.ts
- Public Alpha deployment docs

## Definition Of Done

This task is complete when:

- Sealed DAY_VOTE renders a short TRIAL VOTE / 封票开始 burst overlay.
- Sealed常态 remains readable with low-frequency scanline/pulse pressure.
- Sealed state still renders no vote target, tally, ledger, trend, arrow, or vote reason.
- Revealed unique-leader state renders a burst overlay with the public leading target and 开票揭示.
- Revealed no-exile or tied state renders 未达成处刑 without focusing a seat.
- Reduced-motion users do not receive high-speed animations.
- Existing vote tally and ledger layout remains present and readable.
- Browser/manual verification confirms sealed, exile, and no-exile states.

## Verification

Required checks:

- npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts
- npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts
- npm run lint
- npx tsc --noEmit
- npm run build
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-burst-animation.md
- npm run harness:check
- git diff --check
- Browser/manual local flow.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added class-trial vote burst overlay.
- Added no-exile reveal presentation.
- Kept sealed vote targets hidden.

Changed files:
- src/components/game/ClassTrialVoteStage.tsx
- src/components/game/classTrialVoteStage.test.ts
- src/components/game/classTrialGameTable.test.ts
- src/app/globals.css
- docs/tasks/2026-05-class-trial-vote-burst-animation.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts passed 2 files / 35 tests.
- npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts passed 6 files / 172 tests.
- npm run lint passed.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-burst-animation.md passed.
- npm run harness:check passed.
- git diff --check passed with CRLF warnings only.
- Browser http://127.0.0.1:51631 confirmed sealed TRIAL VOTE burst/readable progress/no target leak, unique exile spotlight with focus seat 6, and no-exile 未达成处刑 with focus count 0.

Remaining risks:
- This is local-only class-trial UI work and does not cover rooms or production release.
- Browser automation cannot judge subjective animation taste; a human recording review may still tune timing.
```

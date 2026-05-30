# 学级裁判主题局流程过场

## Task

Short name: class-trial-flow-scenes

Goal: Give the local-only class-trial spectator flow independent 3-second full-screen scenes for visible transition moments while keeping hidden night actions on the table view and showing the revealed vote ledger.

Why it matters: The theme needs to feel complete enough for a first recording pass even while GPT-SoVITS and LLM character speech are still future work.

## Task Gate

Task type: UI/game-flow polish

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> 无真人观战 -> confirm 狼人/预言家/女巫夜行动 do not show full-screen scenes, then confirm vote resolution shows 票型汇总 and 逐票.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: this is a local-only private theme flow and must not be exposed in Public Alpha.
- Residual risk: public room surfaces still need their existing release checks before any future public rollout.

## Context To Read First

- `docs/working-agreements.md`
- `docs/tasks/2026-05-class-trial-portrait-calibration.md`
- `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `src/components/game/PhaseCurtain.tsx`
- `src/components/GameClient.tsx`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/PhaseCurtain.tsx`
- `src/components/game/PhaseCurtain.test.ts`
- `src/components/game/classTrialPhaseScenes.ts`
- `src/components/game/classTrialPhaseScenes.test.ts`
- `src/components/game/phaseCurtainModel.ts`
- `src/components/game/phaseCurtainModel.test.ts`
- `src/components/GameClient.tsx`
- `src/app/globals.css`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-05-class-trial-flow-scenes.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- `local-assets/class-trial-pack/**` unless the user explicitly asks for another local visual asset replacement
- unrelated rules, room, deployment, or Public Alpha modules

## Definition Of Done

This task is complete when:

- Class-trial games use a class-trial presentation for phase curtains while ordinary games keep the existing default curtain.
- The curtain duration is 3000ms for the class-trial theme.
- Dawn, vote, exile/last-word, and final settlement phases have independent dramatic copy and result lines where relevant.
- Hidden night actions, including 狼人行动、预言家查验、女巫行动, do not show full-screen class-trial scenes.
- Vote resolution shows both vote tally summary and voter-to-target ledger when public vote data is available.
- A mock/local AI spectator flow can progress through the class-trial game to `GAME_OVER`.
- Browser/manual verification confirms the phase scene renders in the local theme.
- State and handoff files record the completed slice and verification evidence.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/phaseCurtainModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-flow-scenes.md`
- `npm run harness:check`
- `git diff --check`
- Browser/manual local flow at `http://127.0.0.1:51625`

Optional deeper checks:

- API full-game smoke with local class-trial `aiFriends` and `aiRuntimeMode: "mock"`.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added `getClassTrialPhaseCurtainCue` for class-trial phase-specific full-screen scenes.
- Added `presentation: "class-trial"` rendering in `PhaseCurtain` with verdict/result lines, 3000ms duration, and reduced-motion handling.
- Routed active class-trial games through the themed curtain model while ordinary games keep the default phase curtain.
- Updated hidden night actions to skip full-screen scenes.
- Added vote ledger result lines for vote resolution and exile verdict scenes.
- Browser-verified 狼人行动、预言家查验、女巫行动 have no full-screen scene, and vote resolution shows 票型汇总 plus 逐票.

Changed files:
- src/components/game/classTrialPhaseScenes.ts
- src/components/game/classTrialPhaseScenes.test.ts
- src/components/game/PhaseCurtain.tsx
- src/components/game/PhaseCurtain.test.ts
- src/components/game/phaseCurtainModel.ts
- src/components/game/phaseCurtainModel.test.ts
- src/components/GameClient.tsx
- src/app/globals.css
- docs/tasks/2026-05-class-trial-flow-scenes.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/classTrialPhaseScenes.test.ts src/components/game/phaseCurtainModel.test.ts passed, 2 files / 8 tests after red-green update.
- npm run test -- src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/phaseCurtainModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/gamePanelsMobile.test.ts passed, 7 files / 45 tests.
- npm run lint passed.
- npx tsc --noEmit passed.
- npm run build passed with the existing Turbopack NFT trace warning for the debug-cleanup route import trace.
- API mock/local full-game smoke at http://127.0.0.1:51625 reached GAME_OVER in 43 continue steps with the fixed 9-character roster.
- Browser at http://127.0.0.1:51625 confirmed 狼人行动、预言家查验、女巫行动 have `forbidden=false` for the old full-screen night copy.
- Browser at http://127.0.0.1:51625 confirmed vote resolution shows `票型汇总` and `逐票`.

Remaining risks:
- This does not integrate LLM speech, GPT-SoVITS, Japanese voice rewrite, or audio-synced typewriter timing.
- This is local-only private theme UI and must not be treated as Public Alpha release work.
```

# 学级裁判主题局 UI 打磨与高松灯替换

## Task

Short name: class-trial-ui-polish-tomori

Goal: Replace seat 8 Hagakure with Takamatsu Tomori and polish the local class-trial speaking UI.

Why it matters: The theme should be video-ready while GPT-SoVITS voices are still being trained.

## Task Gate

Task type: Frontend/UI + local assets + AI persona metadata

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> start game -> confirm seat 8 is 高松灯 -> continue to at least one AI speech -> confirm left portrait/right dialogue, thinking pause, typewriter display, and no /rooms theme entry.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production/release check
- Reason: this slice is local-only and must not change Public Alpha or deployment.
- Residual risk: local browser verification cannot prove future GPT-SoVITS voice timing.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-28-class-trial-ui-polish-tomori-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-ui-polish-tomori.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/classTrialDialogue.ts`
- `src/components/game/classTrialDialogue.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/app/globals.css`
- `local-assets/class-trial-pack/manifest.json` as ignored local-only data
- `local-assets/class-trial-pack/personas.json` as ignored local-only data
- `local-assets/class-trial-pack/avatars/高松灯.png` as ignored local-only data
- `local-assets/class-trial-pack/portraits/高松灯.png` as ignored local-only data
- `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- committed image/audio assets
- generated caches
- `src/game/engine.ts`
- `src/app/rooms/**`
- `src/server/roomService.ts`
- Public Alpha deployment docs unless a later release task asks for it

## Definition Of Done

This task is complete when:

- Fixed class-trial roster uses `tomori` and `高松灯` at seat 8.
- Ignored local manifest and personas file use Tomori instead of Hagakure.
- Ignored local avatar and portrait files for 高松灯 exist and remain untracked.
- Theme game seat order is 苗木诚、雾切响子、腐川冬子、黑白熊、江之岛盾子、塞蕾丝缇雅、十神白夜、高松灯、千早爱音.
- Speaking focus uses left portrait plus right large dialogue box.
- Background ring is visually weaker while active speaker remains identifiable.
- Dialogue shows thinking pause and hybrid typewriter behavior.
- Reduced-motion or animation fallback shows plain text.
- Identity labels remain hidden from the dialogue UI.
- `/rooms` remains unchanged.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `npm run harness:check`
- Browser/manual local flow.

Optional deeper checks:

- `npm run test`

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

## Completion Evidence

Completed on: 2026-05-28 11:59 Asia/Shanghai

Completed:
- Replaced seat 8 Hagakure with Takamatsu Tomori in the fixed class-trial roster.
- Updated ignored local manifest, personas, avatar, and portrait files for 高松灯.
- Added hybrid dialogue timeline helper and focused tests.
- Wired left portrait plus right large dialogue box into `ClassTrialGameTable`.
- Fixed latest-speaker fallback so post-speech UI does not show `等待发言` beside a real speech.
- Wrapped class-trial CSS in `@layer components` so Tailwind preserves the visual layout.
- Confirmed `/rooms` remains unchanged.

Verification:
- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` passed.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md` passed.
- `npm run harness:check` passed.
- `git diff --check` passed.
- Browser smoke at `http://127.0.0.1:51624` passed for local readiness, Tomori seat 8, left portrait/right dialogue, typewriter mode, no hidden role labels in dialogue, and no theme entry on `/rooms`.

Remaining risks:
- GPT-SoVITS routing, Japanese rewrite generation, and audio-synced typewriter remain future work.
- Local assets are private ignored files and must not be committed or published.

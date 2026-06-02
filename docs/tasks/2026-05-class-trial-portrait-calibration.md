# 学级裁判主题局立绘比例校准

## Task

Short name: class-trial-portrait-calibration

Goal: Make the local class-trial speaking portrait area use a fixed visual container and per-character portrait calibration so character changes do not cause visible size jumps.

Why it matters: Recording should feel stable when switching speakers, especially with mixed PNG/WebP source canvases and transparent padding.

## Task Gate

Task type: Frontend/UI + local-only visual polish

Risk level: low

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> 无真人观战 -> advance through several speakers and confirm portraits stay in a fixed frame without moving the dialogue box.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production/release check
- Reason: this is local-only visual polish for a private theme and does not affect Public Alpha deployment.
- Residual risk: browser smoke only sampled several speakers; exact per-character scale may still need hand tuning after recording review.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-28-class-trial-ui-polish-tomori-design.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/GameClient.tsx`
- `src/app/globals.css`
- `docs/tasks/2026-05-class-trial-portrait-calibration.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- tracked image/audio assets
- `local-assets/class-trial-pack/**` unless explicitly asked for local visual asset replacement
- generated caches except temporary `.next` cleanup when needed for verification
- `src/game/**`
- `src/ai/**`
- `src/app/rooms/**`

## Definition Of Done

This task is complete when:

- Each fixed class-trial character has a portrait layout entry.
- 千早爱音 uses the accepted transparent standing portrait and is calibrated with enough top headroom in the fixed portrait frame.
- The speaking portrait image receives CSS variables for scale and offset.
- The portrait frame has stable dimensions and bottom-centered containment.
- Dialogue layout remains left portrait plus right speech box, with hidden identities.
- Portrait and dialogue focus only appears while a character has an active speaking turn; non-speaking action/wait phases keep only the ring seats and central information table.
- The ring background remains clear during non-speaking phases and only becomes weakened/blurred while the speaking focus is visible.
- Speaking focus has a staged presentation: active seat callout, background weakening, portrait/dialogue enter animation, and a short exit fade after the speaking turn ends.
- Class-trial games use a class-trial court style background instead of the default werewolf table background.
- Browser/manual flow shows several speakers in the same stable frame.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-portrait-calibration.md`
- `npm run harness:check`
- `git diff --check`
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

Completed on: 2026-05-28 12:45 Asia/Shanghai

Completed:
- Added class-trial portrait layout metadata for all 9 fixed characters, with 千早爱音 later tuned larger/higher after its transparent portrait replacement.
- Added rendering of portrait CSS variables on the speaking portrait image.
- Changed the speaking portrait frame to a fixed responsive container with bottom-centered image containment.
- Browser-checked the local theme flow at `http://localhost:51625`, including 雾切响子、江之岛盾子、苗木诚 and 高松灯.
- Cleared stale `.next` generated cache after Next dev wrote a corrupted `.next/dev/types/routes.d.ts`; verification passed after regeneration.
- Follow-up headroom pass: increased the portrait frame height and adjusted non-baseline character y/scale values so tall hairstyles such as 腐川冬子 and 塞蕾丝缇雅 no longer touch the top edge.
- Follow-up Tomori pass: replaced the unsuitable square/card-style 高松灯 portrait with the local ignored `Mygo_anime_tomori.png` full-body standing portrait, kept a local source backup, cropped excess transparent side padding, and returned 高松灯 to normal full-body portrait calibration.
- Follow-up recording-cleanliness pass: split action-seat highlighting from speaking focus so portrait/dialogue only render for `currentSpeakerSeatId`; action and waiting phases hide the focus area.
- Follow-up background clarity pass: ring blur/opacity now follows the speaking focus state, so non-speaking action/wait phases keep a clear ring table.
- Follow-up speech staging pass: added class-trial focus enter/exit state, active-seat callout, portrait slide/fade, dialogue pop-in, and reduced-motion fallbacks.
- Follow-up 千早爱音 pass: replaced the unsuitable scene/card portrait with the local ignored transparent `Mygo_anime_anon.png` standing portrait, updated its source page in the ignored local manifest, initially enlarged it, then corrected the local speaking-frame layout to `scale: 1.02`, `y: 4` after recording review showed the head was clipped.
- Follow-up class-trial background pass: switched active class-trial games from the default werewolf table background to a CSS-built court stage with dark red/black depth, gold guide lines, and class-trial ring styling.

Verification:
- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` passed, 4 files / 36 tests.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed; it still reports the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-portrait-calibration.md` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with line-ending normalization warnings only.
- Browser/manual local flow passed for sampled class-trial speakers, including 腐川冬子 and 塞蕾丝缇雅 headroom, plus the final cropped 高松灯 full-body portrait.
- Browser/manual local flow passed for the speech-only focus rule: 狼人行动 showed no portrait/dialogue, then 白天发言 showed the active speaker portrait/dialogue.
- Browser/manual local flow passed for background clarity: 狼人行动 computed `filter: none` and 白天发言 computed `blur(2.4px)`.
- Browser/manual local flow passed for speech staging: 白天发言 rendered `class-trial-focus-enter` with active speaker portrait and weakened background.
- Browser/manual local flow passed for the court background: after restarting the local dev server, active class-trial games rendered `class-trial-app-shell`, `class-trial-court-stage`, and the new dark red/black court gradients at `http://127.0.0.1:51625`; screenshot evidence saved to ignored `tmp/class-trial-background-smoke.png`.

Remaining risks:
- Exact per-character scale values may still need subjective tuning after a real recording pass, but 高松灯's final local portrait candidate has been accepted for this slice.
- The local asset pack remains ignored private data and must not be committed or published.

# 学级裁判主题局固定角色 AI

## Task

Short name: class-trial-fixed-personas

Goal: Add a local-only fixed 9-character AI persona layer for 学级裁判主题局.

Why it matters: The theme should feel like fixed characters seriously playing狼人杀, not normal AI with swapped images.

## Task Gate

Task type: Frontend/UI + AI behavior + AI speech

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> start game -> confirm fixed 9-character spectator table -> continue to at least one AI speech -> confirm /rooms does not expose the theme.
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
- Residual risk: browser verification cannot prove every future GPT-SoVITS voice path.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/threads/ai-behavior.md`
- `docs/threads/ai-speech.md`
- `docs/superpowers/specs/2026-05-27-class-trial-fixed-personas-design.md`
- `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/game/types.ts`
- `src/game/aiFriends.ts`
- `src/game/engine.ts`
- `src/game/projection.ts`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/components/GameClient.tsx`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `local-assets/class-trial-pack/personas.json` as ignored local-only data
- `docs/tasks/2026-05-class-trial-fixed-personas.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- committed image/audio assets
- generated caches
- `src/game/engine.ts` rule behavior beyond carrying role-card metadata
- `src/app/rooms/**`
- `src/server/roomService.ts`
- Public Alpha deployment docs unless a later release task asks for it

## Definition Of Done

This task is complete when:

- `local-assets/class-trial-pack/personas.json` exists locally and remains ignored.
- The homepage reports local role-card readiness.
- Complete role cards cause theme games to start as fixed 9-AI spectator games on `9p-seer-witch-hunter`.
- Seat order matches the approved 9-character roster.
- Role cards are stored on AI seats and passed into `AgentView`.
- Real LLM speech input includes role-card speech guidance and safety boundaries.
- Real LLM action input includes role-card decision guidance and safety boundaries.
- Missing or malformed role cards degrade to visual theme plus ordinary AI behavior.
- Default mode and `/rooms` are unchanged.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts`
- `npm run lint`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md`
- `npm run harness:check`
- Browser/manual local flow.

Optional deeper checks:

- `npx tsc --noEmit`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:<port>`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Planning only so far.

Changed files:
- docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md
- docs/tasks/2026-05-class-trial-fixed-personas.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Pending implementation execution.

Remaining risks:
- Local role-card prompts still need implementation and browser verification.
- local-assets/class-trial-pack/personas.json must remain ignored and uncommitted.
- Public Alpha and /rooms must remain unaffected.
```

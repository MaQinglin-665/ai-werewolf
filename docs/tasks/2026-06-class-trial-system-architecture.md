# 学级裁判系统架构整理

## Task

Short name: class-trial-system-architecture

Goal: 用一个统一目标整理学级裁判和全局狼人杀的客户端/UI、AI 发言与语音、规则阶段、投票、公网房间影响面，并最终推送 GitHub。

Why it matters: 当前问题集中表现为 AI 逻辑像模板、规则阶段混乱、投票不好看。需要用可测试的模型边界解决，而不是继续在大文件里叠加判断。

## Task Gate

Task type: Frontend/UI + AI speech/behavior + rules/projection + room impact

Risk level: high

Required verification tier:

- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Room vote smoke if rule/projection behavior changes

Browser/manual verification:

- Required? yes
- Flow or URL: 本地启动后从首页选择 `学级裁判主题局`，进入 9 人观战局，至少观察开场、夜幕、Day 1 发言、投票封票和揭示。
- If skipped, reason: in-app Browser/Playwright 工具本轮不可用；改用本地 `127.0.0.1:3000` HTTP + API smoke，确认首页 200、boards API 200、9 人学级裁判局可创建且返回 `phaseSteps` 与 `tableSummary.voteSnapshot`。投票视觉由 SSR 组件测试覆盖 sealed/reveal/no-exile。

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`

Skipped checks must record:

- Check skipped: full browser visual run and completed `npm run smoke:room-action:vote`.
- Reason: Browser automation tools were not available in this run; `smoke:room-action:vote` first failed because it defaulted to port 3003 while the dev server was on 3000, then timed out in the existing room AI night-advance path after `NIGHT_WOLVES -> NIGHT_SEER` even with a mock production server.
- Residual risk: public-room vote action end-to-end timing still needs a dedicated follow-up or a faster room smoke harness; focused room API/SSE tests and shared phase/vote model tests passed.

## Context To Read First

- `AGENTS.md`
- `README.md`
- `docs/harness-orientation.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `docs/threads/frontend.md`
- `docs/threads/ai-behavior.md`
- `docs/threads/ai-speech.md`
- `docs/threads/rules-engine.md`
- `docs/threads/verification.md`
- `docs/superpowers/specs/2026-06-02-class-trial-system-architecture-design.md`
- `docs/superpowers/plans/2026-06-02-class-trial-system-architecture.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/**`
- `src/app/globals.css`
- `src/ai/**`
- `src/game/**`
- `src/server/roomService.ts` only when replacing duplicated phase/vote semantics
- `src/app/api/**` only when route tests require shape updates
- `docs/**`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `.next`
- `node_modules`
- `tmp`
- `public/audio/ai-speech`
- `local-assets`
- database files
- unrelated room UI or deployment scripts unless verification proves they are affected

## Definition Of Done

This task is complete when:

- Phase semantics and vote snapshot/presentation have reusable pure models and tests.
- Class-trial table/vote UI consumes presentation models instead of duplicating phase/vote inference.
- GameClient uses a class-trial flow model for intro/curtain/audio/advance gating.
- Class-trial AI speech director, validation, and fallback are separated from generic speech orchestration enough to reduce `speechProviders.ts` responsibility.
- Any global rule or projection change is covered by focused tests and room vote smoke when relevant.
- Browser smoke confirms the improved class-trial flow.
- Git commit and GitHub push succeed.

## Verification

Required checks:

- `npm run test -- src/game/engine.test.ts src/game/projection.test.ts`
- `npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/phaseCurtainModel.test.ts`
- `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run smoke:main-game -- --base-url=<local-url>`
- `npm run smoke:room-action:vote -- --base-url=<local-url>` if projection/rules changes affect room view or vote behavior

Optional deeper checks:

- `npm run llm:check -- --task=speech --persona=deepseek --retries=0`
- `npm run simulate:ai -- --games=10 --seed-start=91`
- Human listening pass if GPT-SoVITS is running

## Handoff

```text
Completed:
- Extracted shared phase semantics into src/game/phaseSemantics.ts and reused them from single-player projection and room turn views.
- Extracted public vote snapshots into src/game/voteSnapshot.ts and class-trial vote presentation into src/components/game/classTrialVotePresentation.ts.
- Extracted GameClient intro/night-curtain/audio/auto-advance gating into src/components/game/classTrialFlowModel.ts.
- Extracted ClassTrialGameTable focus/night/vote status calculation into src/components/game/classTrialTableModel.ts.
- Extracted class-trial AI speech director guidance into src/ai/classTrialSpeechDirector.ts and kept speechProviders as orchestration.

Changed files:
- src/game/phaseSemantics.ts, src/game/voteSnapshot.ts, src/game/projection.ts, src/server/roomService.ts
- src/components/GameClient.tsx, src/components/game/ClassTrialGameTable.tsx, src/components/game/ClassTrialVoteStage.tsx
- src/components/game/classTrialVotePresentation.ts, src/components/game/classTrialFlowModel.ts, src/components/game/classTrialTableModel.ts
- src/ai/classTrialSpeechDirector.ts, src/ai/speechProviders.ts
- related tests plus docs/progress/feature registry

Verification:
- npm run test -- src/game/phaseSemantics.test.ts src/game/voteSnapshot.test.ts src/game/projection.test.ts src/game/engine.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/phaseCurtainModel.test.ts src/components/game/classTrialVotePresentation.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts passed, 12 files / 324 tests.
- npm run test -- src/app/api/rooms/api.test.ts passed, 1 file / 19 tests.
- npx tsc --noEmit passed.
- npm run lint passed.
- npm run build passed with existing Turbopack NFT trace warning.
- HTTP/API smoke on 127.0.0.1:3000 passed for /, /api/games/boards, and creating a 9p class-trial game.
- ROOM_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:room-sse passed.

Remaining risks:
- Full browser visual pass was not completed because the Browser/Playwright tool was unavailable.
- npm run smoke:room-action:vote did not complete; manual tracing showed it timed out after room play moved from NIGHT_WOLVES to NIGHT_SEER in the existing room AI night-advance path.
```

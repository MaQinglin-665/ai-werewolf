# Feature Registry

Use this registry to locate the likely files, docs, tests, and verification
commands for common work areas. It is an index, not a full architecture guide.

Harness idea: after an agent knows how to work, it still needs to know where to
work.

## Local Game Creation And Resume

- Source entrypoints: `src/app/api/games/**`, `src/server/gameService.ts`,
  `src/game/engine.ts`, `src/game/projection.ts`.
- Related tests: `src/app/api/games/*.test.ts`, `src/game/projection.test.ts`,
  `src/game/engine.test.ts`, focused `src/game/*.test.ts` files.
- Docs to read: `docs/architecture.md`, `docs/threads/rules-engine.md`.
- Verification hints: use focused API or engine tests first, then `npm run test`
  when state shape or hydration behavior changes.

## Night, Day, Vote, And Win Rules

- Source entrypoints: `src/game/engine.ts`, `src/game/projection.ts`,
  `src/game/speechText.ts`, `src/game/claims.ts`, `src/game/stances.ts`.
- Related tests: `src/game/engine.test.ts`, `src/game/witch*.test.ts`,
  `src/game/*seer*.test.ts`, `src/game/*hunter*.test.ts`,
  `src/game/*voting*.test.ts`, `src/game/boards.test.ts`.
- Docs to read: `docs/threads/rules-engine.md`,
  `docs/decisions/0001-game-state-source-of-truth.md`.
- Verification hints: add or update a focused regression test for rule changes;
  run `npm run test -- src/game/engine.test.ts` or the focused test file, then
  broaden to `npm run test` when phase flow or win conditions change.

## AI Action Strategy

- Source entrypoints: `src/ai/mockAgent.ts`, `src/ai/actionProviders.ts`,
  `src/ai/tableRead.ts`, `src/ai/seatMemory.ts`, `src/game/tableMemory.ts`.
- Related tests: `src/ai/actionProviders.test.ts`,
  `src/ai/mockAgent*.test.ts`, `src/ai/tableRead.test.ts`,
  `src/ai/wolfVoting.test.ts`, `src/game/tableMemory.test.ts`.
- Docs to read: `docs/threads/ai-behavior.md`,
  `docs/evaluations/2026-05-simulation-attribution.md`.
- Verification hints: use focused tests for a strategy change; use
  `npm run simulate:ai -- --games=10 --seed-start=91` for small diagnostics and
  `npm run simulate:diagnose` for balance attribution.

## AI Speech And LLM Output

- Source entrypoints: `src/ai/speechProviders.ts`, `src/ai/modelLlms.ts`,
  `src/ai/voiceProfiles.ts`, `scripts/check-llm-output.mjs`,
  `scripts/evaluate-llm-game.mjs`.
- Related tests: `src/ai/speechProviders.test.ts`,
  `src/ai/modelLlms.test.ts`, `src/ai/voiceProfiles.test.ts`,
  `src/ai/llmEvaluation.test.ts`.
- Docs to read: `docs/threads/ai-speech.md`,
  `docs/evaluations/2026-05-llm-smoke.md`,
  `docs/evaluations/2026-05-llm-multiseed-smoke.md`.
- Verification hints: for small diagnostics, start with
  `npm run llm:check -- --task=speech --persona=deepseek --retries=0`; broaden
  to full `npm run llm:check -- --task=speech` only for prompt, schema,
  fallback, or release-confidence work.

## AI Pool And Model Configuration

- Source entrypoints: `src/app/ai-pool/page.tsx`,
  `src/components/AiPoolClient*`, `src/ai/types.ts`, `src/ai/modelLlms.ts`.
- Related tests: `src/components/AiPoolClient.mobile.test.ts`,
  `src/ai/modelLlms.test.ts`, `src/ai/mockAgentRuntimeMode.test.ts`.
- Docs to read: `README.md`, `docs/threads/frontend.md`,
  `docs/threads/ai-speech.md`.
- Verification hints: combine focused component/model tests with a browser or
  manual check when changing visible configuration behavior.

## Table UI And Action Panels

- Source entrypoints: `src/components/GameClient.tsx`,
  `src/components/game/**`, `src/app/globals.css`.
- Related tests: `src/components/game/*.test.ts`,
  `src/components/AiPoolClient.mobile.test.ts`, `src/app/layout.test.ts`.
- Docs to read: `docs/threads/frontend.md`,
  `docs/superpowers/specs/*mobile*.md` when touching mobile table behavior.
- Verification hints: run `npm run lint` and focused component tests; manually
  exercise the affected flow when UI behavior changes.

## Rooms And Multiplayer Flow

- Source entrypoints: `src/app/rooms/**`, `src/app/api/rooms/**`,
  `src/server/roomService.ts`, `src/server/roomAnalytics.ts`,
  `src/server/roomRateLimit.ts`.
- Related tests: `src/app/api/rooms/api.test.ts`,
  `src/app/api/rooms/routeUtils.ts`, `src/app/admin/metrics/page.test.ts`,
  `src/app/alpha-health/healthPanel.test.ts`.
- Docs to read: `docs/tasks/2026-05-room-render-production-minimum.md`,
  `docs/alpha-playtest.md`, `docs/alpha-feedback-ops.md`.
- Verification hints: use focused API tests first, then
  `npm run smoke:room-sse` or `npm run smoke:room-action:vote` for room-flow
  confidence.

## Alpha, Release, And Health Checks

- Source entrypoints: `docs/current-release.md`,
  `docs/tencent-cloud-deploy.md`, `docs/render-deploy.md`,
  `scripts/room-production-preflight.mjs`, `scripts/room-sse-smoke.mjs`,
  `scripts/room-action-smoke.mjs`, `scripts/alpha-smoke.mjs`.
- Related tests/scripts: `npm run preflight:production`,
  `npm run smoke:room-sse`, `npm run smoke:room-action:vote`,
  `npm run smoke:alpha`.
- Docs to read: `docs/current-release.md`, `docs/tencent-cloud-deploy.md`,
  `docs/render-deploy.md`, `docs/production-minimum.md`.
- Verification hints: include target URL and whether the check is local,
  Tencent Cloud, or Render. Do not treat a local smoke as production proof.

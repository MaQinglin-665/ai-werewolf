# Frontend UX And Maintainability Fable5 Review Pack

Updated: 2026-06-12 Asia/Shanghai

## Purpose

Reduce Fable5 spend for a frontend-focused pass. Do not ask Fable5 to scan the
whole repository.

The current target is:

- make the in-game frontend experience smoother;
- improve frontend maintainability around `GameClient.tsx`;
- avoid AI behavior, rules-engine, API, deployment, and provider-token work.

This pack is intended to be given to Fable5 as a constrained review prompt, not
as permission to perform a full-repo audit.

## Current Fable5 Cost Estimate

Official pricing checked on 2026-06-12:

- Anthropic models/pricing docs list Claude Fable 5 at `$10 / MTok` input and
  `$50 / MTok` output.
- Anthropic launch page states the same `$10 per million input tokens` and
  `$50 per million output tokens`.
- Pricing docs also list prompt cache prices separately: `$12.50 / MTok` for
  5-minute cache writes, `$20 / MTok` for 1-hour cache writes, and `$1 / MTok`
  for cache hits/refreshes.

Sources:

- https://docs.anthropic.com/en/docs/about-claude/pricing
- https://docs.anthropic.com/en/docs/about-claude/models
- https://www.anthropic.com/news/claude-fable-5-mythos-5

Cost formula:

```text
cost_usd = input_tokens / 1_000_000 * 10
         + output_tokens / 1_000_000 * 50
```

If "500k tokens" means total input plus output, rough API cost is:

| Split | Input | Output | USD |
| --- | ---: | ---: | ---: |
| mostly read/review | 450k | 50k | $7.00 |
| typical coding review | 400k | 100k | $9.00 |
| heavier agentic output | 350k | 150k | $11.00 |
| half input / half output | 250k | 250k | $15.00 |
| worst case, all output | 0 | 500k | $25.00 |

If the run is interpreted as `500k input + 100k output`, cost is about `$10`.
If it becomes `500k input + 500k output`, cost is about `$30`.

Using a 2026-06-12 USD/CNY reference around `1 USD = 6.76 CNY`, the typical
`$7-$11` range is roughly `47-74 CNY`, before platform markups, subscription
limits, retries, cache behavior, or failed runs.

## Local Context Snapshot

Commands already run locally:

```text
npm run audit:structure
```

Relevant output:

- scanned files: 392
- large file count: 16
- `src/app/globals.css`: 5785 local lines in this checkout
- `src/components/GameClient.tsx`: 1618 local lines in this checkout
- `src/components/AiPoolClient.tsx`: 2246 lines
- `src/components/RoomClient.tsx`: 2135 lines

Frontend source scale:

- `src/components`: 112 files, about 25.6k lines from structure audit
- `src/app`: 49 files, about 13.0k lines from structure audit

Dirty worktree warning:

- The repo currently has many unrelated local changes, especially in
  `src/ai/**`, `src/game/**`, API routes, `progress.md`, and active ordinary
  Mimo evaluation docs.
- A Fable5 frontend pass must not stage, revert, or rework unrelated AI/rules
  changes.

## Existing Frontend Boundary

Read these first if source inspection is needed:

- `docs/threads/frontend.md`
- `docs/feature-registry.md`, only the "Table UI And Action Panels" section
- `docs/superpowers/specs/2026-05-26-frontend-structure-boundaries-design.md`
- `docs/superpowers/specs/2026-05-26-frontend-structure-review.md`
- `docs/tasks/2026-05-gameclient-lifecycle-requests.md`

Known completed `GameClient` extractions:

- `src/components/game/recentGamesStore.ts`
- `src/components/game/autoAdvance.ts`
- `src/components/game/hostAudioCues.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/landingLineupPreview.ts`
- `src/components/game/tableEventFeed.ts`
- `src/components/game/boardSelectionModel.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/classTrialFlowModel.ts`

Current `GameClient.tsx` responsibility groups:

- top-level game state and startup hydration;
- selected board, human seat, AI friend, runtime mode, and class-trial pack
  wiring;
- host audio and AI speech audio orchestration;
- class-trial intro, curtain, audio lookahead, and continue-buffering flow;
- lifecycle callbacks that call extracted request helpers;
- final render composition for landing, ordinary mobile table, ordinary desktop
  table, class-trial table, and overlays.

## Minimal Source List For Fable5

Start with this pack only. Then read source files only as needed:

- `src/components/GameClient.tsx`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/classTrialFlowModel.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/classTrialAudioLookahead.ts`
- `src/components/game/MobileGameTable.tsx`
- `src/components/game/mobileTableModel.ts`
- `src/components/game/ActionPanel.tsx`
- `src/components/game/ClassTrialGameTable.tsx`
- focused tests matching any file under review

Do not read all of `src/app/globals.css` by default. Use the CSS section map in
`docs/tasks/2026-05-frontend-css-boundary-map.md`, then inspect only selectors
directly relevant to a chosen UX issue.

## Avoid Reading

Avoid unless a specific frontend type error proves it is necessary:

- `.env`, secrets, database files, `.next`, `node_modules`, `tmp`
- `src/ai/**`
- `src/game/**`
- `src/server/**`
- `src/app/api/**`
- deployment docs and scripts
- old `tmp/*` evaluation outputs
- ordinary Mimo speech quality docs unless the task changes AI speech quality

## Recommended Fable5 Budget Strategy

Do not spend 500k tokens upfront.

Recommended sequence:

1. Local agent performs structure audit and prepares this review pack.
2. Ask Fable5 for a bounded review only: choose the next 1-2 frontend changes
   with the best UX/maintainability payoff.
3. Local agent implements the selected narrow change and runs tests.
4. Send only the final diff and verification output back to Fable5 if external
   review is still needed.

Expected Fable5 token range with this pack:

- bounded review only: 40k-90k input, 5k-15k output;
- review plus targeted source inspection: 90k-180k input, 10k-25k output;
- full direct implementation by Fable5: likely 300k-600k total, not recommended
  until the target is narrower.

## Candidate Local Optimization Targets

Prefer these before paying Fable5 for implementation:

1. `GameClient` audio orchestration boundary
   - Why: this is still a dense callback/effect cluster.
   - Risk: medium-high because it touches playback timing and class-trial
     continue buffering.
   - Better first step: ask Fable5 to review the boundary, not to implement it.

2. Ordinary mobile table polish
   - Why: user-visible, already has `MobileGameTable` and `mobileTableModel`
     tests.
   - Risk: medium because CSS and mobile layout can regress visually.
   - Verification: focused mobile tests plus browser viewport screenshot.

3. Render composition extraction from `GameClient`
   - Why: lower behavioral risk than audio extraction; may split landing,
     ordinary game, class-trial game, and overlays into clearer components.
   - Risk: medium because props can become large.
   - Verification: TypeScript, existing component tests, one browser game flow.

Avoid for this pass:

- AI prompt/output quality;
- rules behavior;
- room/multiplayer recovery;
- deployment;
- broad CSS physical splitting;
- full `GameClient` rewrite.

## Token-Saving Prompt For Fable5

```text
You are reviewing D:\ai-werewolf, but do not scan the whole repo.

Goal: frontend UX smoothness and maintainability only. Default scope is
src/components/GameClient.tsx, src/components/game/**, and targeted
src/app/globals.css selectors. Do not touch src/ai/**, src/game/**,
src/server/**, src/app/api/**, .env, database files, tmp, node_modules, or
deployment.

Read first:
- docs/evaluations/2026-06-12-frontend-ux-maintainability-fable5-review.md
- docs/threads/frontend.md
- docs/superpowers/specs/2026-05-26-frontend-structure-review.md
- docs/tasks/2026-05-gameclient-lifecycle-requests.md

Task: choose the next 1-2 frontend changes that give the best UX and
maintainability payoff per token. Prefer changes that local Codex can implement
after your review. Do not produce a large patch. Do not ask to read the entire
repo. If you need more context, ask for one specific file or selector group.

Answer format:
1. Highest-value target
2. Why this target, grounded in the files above
3. Files to inspect or edit
4. Tests/browser checks required
5. What to avoid
6. Stop condition for this pass

Budget discipline: target under 100k input and 15k output. Stop before
implementation if the target is still ambiguous.
```

## Questions For Fable5

1. Is the next best frontend target audio orchestration, mobile table polish,
   or render composition extraction?
2. Which target gives the best user-visible improvement without crossing into
   AI/rules/API behavior?
3. What exact files should the local agent inspect before implementation?
4. What test/browser checks are enough for this pass?
5. What should be explicitly deferred to avoid a 500k-token run?

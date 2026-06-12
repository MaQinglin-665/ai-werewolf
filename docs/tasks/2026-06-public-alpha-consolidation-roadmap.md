# 2026-06 Public Alpha Consolidation Roadmap

## Task

Summarize the current project state after the ordinary Mimo speech-quality push,
reset the agent handoff toward Public Alpha consolidation, and plan the next
development phase.

This task is a planning and harness update. It does not authorize new gameplay,
frontend, deployment, or paid-model work by itself.

## Task Gate

Task type: Docs-only / root harness / roadmap
Risk level: medium
Required verification tier: harness docs checks
Browser/manual verification: not required; no UI or runtime behavior changes
State updates required: `progress.md`, `session-handoff.md`,
`docs/harness-state.md`, `docs/roadmap.md`, `long_running_tasks.json`, and
`feature_list.json` if feature status changes
Skipped checks must record: code tests, browser checks, and production checks
are skipped because this task only updates planning and harness state

## Context To Read First

- `AGENTS.md`
- `README.md`
- `docs/harness-orientation.md`
- `docs/harness-state.md`
- `docs/README.md`
- `docs/roadmap.md`
- `docs/current-release.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `docs/evaluations/2026-06-12-ordinary-mimo-v46-final-acceptance-gate.md`

## Allowed Scope

Allowed:

- Project status and roadmap docs.
- Harness state and lifecycle handoff files.
- Task registry and feature registry entries that describe current status.

Out of scope:

- Business logic, AI prompt logic, UI components, rules engine, deployment
  scripts, `.env`, secrets, databases, generated caches, and tmp sample files.
- Another paid Mimo run unless a later task explicitly asks for it.
- Another Fable5 review loop unless the user explicitly asks for a subjective
  style pass.

## Definition Of Done

- The current project status is summarized in repository state files.
- Ordinary Mimo speech-quality work is recorded as accepted enough to ship, with
  residual quality risks named rather than reopened as the default next task.
- The next development phase is framed around Public Alpha consolidation:
  dirty-worktree triage, Tencent-first release hygiene, real-player playtest
  loop, mobile/room reliability, and narrow AI table-feel follow-ups.
- The next agent can resume from repository files without reading this chat.

## Verification

Run the smallest checks that prove the harness update:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-public-alpha-consolidation-roadmap.md
npm run harness:long-tasks
npm run harness:check
git diff --check -- docs/tasks/2026-06-public-alpha-consolidation-roadmap.md docs/roadmap.md docs/harness-state.md progress.md session-handoff.md long_running_tasks.json feature_list.json
```

Code tests, browser checks, and production checks are not required unless this
task changes executable code or runtime commands.

## Handoff

Completed:
- Updated project progress and harness state for the post-Mimo, post-Tencent
  deployment checkpoint.
- Added or updated roadmap and registry entries for the next Public Alpha
  consolidation phase.
- Triaged the remaining local frontend/API dirty files into submit, keep,
  defer, and discard buckets.

## 2026-06-12 Local Dirty Worktree Triage

Scope inspected:

- `src/app/api/games/aiFriends.test.ts`
- `src/app/api/games/route.ts`
- `src/app/api/rooms/api.test.ts`
- `src/app/api/rooms/route.ts`
- `src/app/globals.css`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/components/AiPoolClient.tsx`
- `src/components/GameClient.tsx`
- `src/components/RoomClient.tsx`
- `src/components/game/GameClientLoadedSurface.tsx`
- `src/components/game/GameClientLoadedSurface.test.ts`
- `src/components/game/aiFriendLlmPresets.test.ts`
- `src/components/game/aiFriendLlmPresets.ts`
- `src/components/game/aiFriendStorage.test.ts`
- `src/components/game/aiFriendStorage.ts`
- `docs/evaluations/2026-06-12-frontend-ux-maintainability-fable5-review.md`

Submit group A: AI friend profile propagation and AI Pool cleanup.

- Files:
  - `src/app/api/games/route.ts`
  - `src/app/api/games/aiFriends.test.ts`
  - `src/app/api/rooms/route.ts`
  - `src/app/api/rooms/api.test.ts`
  - `src/components/RoomClient.tsx`
  - `src/components/game/aiFriendStorage.ts`
  - `src/components/game/aiFriendStorage.test.ts`
  - `src/components/game/aiFriendLlmPresets.ts`
  - `src/components/game/aiFriendLlmPresets.test.ts`
  - `src/components/AiPoolClient.tsx`
  - `src/components/AiPoolClient.mobile.test.ts`
  - `src/app/globals.css`
- Reason: selected AI friends now preserve `ordinaryPlayerProfile` and
  `roleCard` through single-player and room creation; room creation sends the
  selected AI friend snapshot; AI Pool removes duplicate/legacy tuning reference
  UI and keeps slider edits synchronized through `ordinaryPlayerProfileTuning`.
- Recommendation: commit as one product-facing AI Pool / room setup fix after a
  quick `/ai-pool` and `/rooms` browser smoke if this is going to a public
  release.

Submit group B: `GameClient` loaded surface extraction.

- Files:
  - `src/components/GameClient.tsx`
  - `src/components/game/GameClientLoadedSurface.tsx`
  - `src/components/game/GameClientLoadedSurface.test.ts`
- Reason: this is a behavior-preserving render-composition extraction from
  `GameClient.tsx`; it moves ordinary/class-trial loaded-game render surfaces
  into a focused component and adds server-rendered component coverage.
- Recommendation: commit separately from group A. It is a maintainability
  change, not an urgent product fix. Before public deployment, add one browser
  smoke for ordinary game and one class-trial path if feasible.

Keep, but do not bundle with runtime commits.

- File:
  - `docs/evaluations/2026-06-12-frontend-ux-maintainability-fable5-review.md`
- Reason: useful as a bounded future review pack for frontend maintainability
  and Fable5 cost control.
- Recommendation: keep as reference material or commit with docs/planning only;
  do not bundle into either runtime commit above.

Defer.

- Fable5 frontend review itself. The review pack is ready, but the next project
  phase should prioritize Public Alpha playtest feedback before paying for a
  broad frontend review.
- Broad audio-orchestration extraction from `GameClient.tsx`; it is higher risk
  than the current loaded-surface extraction and should wait for a dedicated
  task card.

Discard.

- No frontend/API code file currently looks like it should be discarded outright.
  The inspected code is coherent and verified. If the user wants the smallest
  possible release diff, the only discard candidate is the unused Fable5 review
  pack, but it is safer to keep it as a docs-only reference.

Changed files:
- `docs/tasks/2026-06-public-alpha-consolidation-roadmap.md`
- `docs/roadmap.md`
- `docs/harness-state.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`
- `feature_list.json`

Verification:
- `npm run harness:task-card -- docs/tasks/2026-06-public-alpha-consolidation-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- JSON parse for `feature_list.json` and `long_running_tasks.json` passed.
- `npm run harness:check` passed.
- `git diff --check -- docs/tasks/2026-06-public-alpha-consolidation-roadmap.md docs/roadmap.md docs/harness-state.md progress.md session-handoff.md long_running_tasks.json feature_list.json` passed with LF/CRLF warnings only.

Remaining risks:
- Public Alpha is smoke-tested but not yet an open beta.
- Render mirror may lag behind Tencent unless a separate deployment task updates
  it.
- Local dirty frontend/API work must be triaged before the next release.

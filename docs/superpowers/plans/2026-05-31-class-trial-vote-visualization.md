# Class Trial Vote Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade only the local-only `学级裁判主题局` common exile vote phase so `DAY_VOTE` visibly shows vote lock progress without exposing targets, and the completed vote result appears as a dramatic one-shot class-trial reveal.

**Architecture:** Add a non-sensitive vote progress projection to `PublicVoteSnapshot`, build a class-trial-only presenter component, wire it into `ClassTrialGameTable`, and style it inside the existing class-trial CSS system. The rules engine, generic `VotePanels`, multiplayer room UI, and non-class-trial vote flows remain unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library/server rendering, existing CSS in `src/app/globals.css`.

---

## User Decisions Captured

- Scope is `C`: only the common class-trial voting screen changes.
- The first version is `C`: show both voting-in-progress and reveal, but keep the reveal lightweight.
- During voting, keep the current table visible and add a HUD/seat status layer.
- After all votes are locked, switch to a dramatic reveal-style result surface.
- Reveal cadence is `B`: one-shot reveal after transition, not逐票 animation.
- During voting, show `已锁票` / `等待中`; do not show vote targets, tallies, trends, or who voted for whom.
- Implementation approach is `B`: hybrid voting performance.

---

## Task 1: Add Hidden Vote Progress To Public Projection

**Purpose:** Give the class-trial UI enough data to show lock progress while preserving the existing vote privacy boundary.

**Files:**

- `src/game/types.ts`
- `src/game/projection.ts`
- `src/game/engine.test.ts`

**Steps:**

- [ ] Extend `PublicVoteSnapshot` with optional progress-only fields:

```ts
export type PublicVoteSnapshot = {
  votes: PublicVoteItem[];
  tally: Array<{ target: ActionTarget; count: number }>;
  abstainCount?: number;
  leaders: ActionTarget[];
  revealed: boolean;
  eligibleSeatIds?: number[];
  lockedSeatIds?: number[];
  pendingSeatIds?: number[];
};
```

- [ ] Add failing assertions to the existing privacy test `keeps votes private until resolution reveals tally and public vote reasons` in `src/game/engine.test.ts`:

```ts
const hiddenVoteSnapshot = buildHumanView(state).tableSummary.voteSnapshot;

expect(hiddenVoteSnapshot.revealed).toBe(false);
expect(hiddenVoteSnapshot.votes).toHaveLength(0);
expect(hiddenVoteSnapshot.tally).toHaveLength(0);
expect(hiddenVoteSnapshot.lockedSeatIds).toEqual([1]);
expect(hiddenVoteSnapshot.pendingSeatIds).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
expect(JSON.stringify(hiddenVoteSnapshot)).not.toContain("测试理由");
expect(JSON.stringify(hiddenVoteSnapshot)).not.toContain("target");
```

- [ ] Run the targeted failing test:

```powershell
npm run test -- src/game/engine.test.ts -t "keeps votes private until resolution reveals tally and public vote reasons"
```

Expected before implementation: the test fails because `lockedSeatIds` and `pendingSeatIds` are not projected during `DAY_VOTE`.

- [ ] Add a projection helper in `src/game/projection.ts`:

```ts
function buildHiddenVoteProgress(
  state: GameState,
): Pick<PublicVoteSnapshot, "eligibleSeatIds" | "lockedSeatIds" | "pendingSeatIds"> {
  const eligibleSeatIds = state.seats
    .filter((seat) => canSeatVote(state, seat.seatId))
    .map((seat) => seat.seatId)
    .sort((a, b) => a - b);
  const lockedSeatIds = eligibleSeatIds
    .filter((seatId) => hasVoted(state, seatId))
    .sort((a, b) => a - b);
  const lockedSeatIdSet = new Set(lockedSeatIds);

  return {
    eligibleSeatIds,
    lockedSeatIds,
    pendingSeatIds: eligibleSeatIds.filter((seatId) => !lockedSeatIdSet.has(seatId)),
  };
}
```

- [ ] Spread the helper into the hidden `DAY_VOTE` branch:

```ts
if (state.phase === "DAY_VOTE") {
  return {
    votes: [],
    tally: [],
    leaders: [],
    revealed: false,
    ...buildHiddenVoteProgress(state),
  };
}
```

- [ ] Re-run the targeted test:

```powershell
npm run test -- src/game/engine.test.ts -t "keeps votes private until resolution reveals tally and public vote reasons"
```

Expected after implementation: the test passes, and the hidden snapshot contains only seat ids for progress.

- [ ] Commit after this task if working incrementally:

```powershell
git add src/game/types.ts src/game/projection.ts src/game/engine.test.ts
git commit -m "feat: expose class trial vote progress safely"
```

---

## Task 2: Build Class-Trial Vote Presenter

**Purpose:** Keep vote visualization class-trial-specific instead of changing generic `VotePanels`.

**Files:**

- `src/components/game/ClassTrialVoteStage.tsx`
- `src/components/game/classTrialVoteStage.test.ts`

**Steps:**

- [ ] Create a state helper and component:

```tsx
import type { ActionTarget, HumanGameView } from "@/game/types";

type VoteStageVariant = "sealing" | "reveal";

export type ClassTrialVoteStageState =
  | {
      variant: "sealing";
      eligibleSeatIds: number[];
      lockedSeatIds: number[];
      pendingSeatIds: number[];
    }
  | {
      variant: "reveal";
      votes: HumanGameView["tableSummary"]["voteSnapshot"]["votes"];
      tally: HumanGameView["tableSummary"]["voteSnapshot"]["tally"];
      abstainCount: number;
      leaders: ActionTarget[];
      focusSeatId?: number;
    };

export function getClassTrialVoteState(game: HumanGameView): ClassTrialVoteStageState | null {
  const snapshot = game.tableSummary.voteSnapshot;

  if (game.phase === "DAY_VOTE" && !snapshot.revealed) {
    return {
      variant: "sealing",
      eligibleSeatIds: snapshot.eligibleSeatIds ?? [],
      lockedSeatIds: snapshot.lockedSeatIds ?? [],
      pendingSeatIds: snapshot.pendingSeatIds ?? [],
    };
  }

  if (snapshot.revealed && snapshot.votes.length > 0) {
    const onlyLeader = snapshot.leaders.length === 1 ? snapshot.leaders[0] : undefined;

    return {
      variant: "reveal",
      votes: snapshot.votes,
      tally: snapshot.tally,
      abstainCount: snapshot.abstainCount ?? 0,
      leaders: snapshot.leaders,
      focusSeatId: onlyLeader?.type === "seat" ? onlyLeader.seatId : undefined,
    };
  }

  return null;
}
```

- [ ] Render the `sealing` variant with:
  - headline `封票中`
  - progress count such as `3 / 9`
  - pending count such as `等待 6 人`
  - a compact eligible-seat rail showing locked and waiting states
  - no target names, arrows, tally numbers, or vote reasons

- [ ] Render the `reveal` variant with:
  - headline `开票揭示`
  - a ranking/tally block
  - a compact ledger `投票者 -> 目标`
  - abstain rows using `弃票`
  - a focus label for the sole leading seat when available

- [ ] Add tests using static markup rendering and `createElement`, matching the existing component test style:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassTrialVoteStage, getClassTrialVoteState } from "./ClassTrialVoteStage";
```

- [ ] Test the hidden progress state:

```ts
it("shows lock progress during class trial voting without exposing targets", () => {
  const html = renderToStaticMarkup(createElement(ClassTrialVoteStage, { game: dayVoteGame }));

  expect(html).toContain("封票中");
  expect(html).toContain("1 / 3");
  expect(html).toContain("等待 2 人");
  expect(html).toContain("已锁票");
  expect(html).toContain("等待中");
  expect(html).not.toContain("->");
  expect(html).not.toContain("测试理由");
});
```

- [ ] Test the one-shot reveal state:

```ts
it("renders revealed vote tally and ledger", () => {
  const html = renderToStaticMarkup(createElement(ClassTrialVoteStage, { game: revealedVoteGame }));

  expect(html).toContain("开票揭示");
  expect(html).toContain("6号");
  expect(html).toContain("2票");
  expect(html).toContain("1号 -> 6号");
  expect(html).toContain("弃票");
});
```

- [ ] Test non-vote phases return no stage:

```ts
expect(getClassTrialVoteState(daySpeechGame)).toBeNull();
```

- [ ] Run the new component test:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts
```

Expected after implementation: all new presenter tests pass.

- [ ] Commit after this task if working incrementally:

```powershell
git add src/components/game/ClassTrialVoteStage.tsx src/components/game/classTrialVoteStage.test.ts
git commit -m "feat: add class trial vote stage"
```

---

## Task 3: Wire Vote Stage Into ClassTrialGameTable

**Purpose:** Make the voting phase visible in the existing themed table without replacing ordinary discussion UI.

**Files:**

- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`

**Steps:**

- [ ] Import the vote presenter:

```tsx
import {
  ClassTrialVoteStage,
  getClassTrialVoteState,
} from "./ClassTrialVoteStage";
```

- [ ] Compute vote state near the existing active-seat values:

```tsx
const classTrialVoteState = getClassTrialVoteState(game);
const voteLockedSeatIds =
  classTrialVoteState?.variant === "sealing" ? new Set(classTrialVoteState.lockedSeatIds) : new Set<number>();
const votePendingSeatIds =
  classTrialVoteState?.variant === "sealing" ? new Set(classTrialVoteState.pendingSeatIds) : new Set<number>();
const voteFocusSeatId =
  classTrialVoteState?.variant === "reveal" ? classTrialVoteState.focusSeatId : undefined;
```

- [ ] Add table-level classes:

```tsx
<section
  className={[
    "class-trial-table",
    classTrialVoteState ? "class-trial-table-vote-active" : "",
    classTrialVoteState?.variant === "reveal" ? "class-trial-table-vote-reveal" : "",
  ]
    .filter(Boolean)
    .join(" ")}
>
```

- [ ] Add seat-level classes:

```tsx
className={[
  "class-trial-seat",
  seat.alive ? "" : "class-trial-seat-dead",
  seat.seatId === activeSeatId ? "class-trial-seat-active" : "",
  voteLockedSeatIds.has(seat.seatId) ? "class-trial-seat-vote-locked" : "",
  votePendingSeatIds.has(seat.seatId) ? "class-trial-seat-vote-waiting" : "",
  voteFocusSeatId === seat.seatId ? "class-trial-seat-vote-focus" : "",
]
  .filter(Boolean)
  .join(" ")}
```

- [ ] Add alive-seat status chips under the existing dead-seat status:

```tsx
{seat.alive && voteLockedSeatIds.has(seat.seatId) && (
  <span className="class-trial-seat-vote-status">已锁票</span>
)}
{seat.alive && votePendingSeatIds.has(seat.seatId) && (
  <span className="class-trial-seat-vote-status class-trial-seat-vote-status-waiting">
    等待中
  </span>
)}
```

- [ ] Render the stage between the table/ring context and the dialogue focus:

```tsx
{classTrialVoteState && <ClassTrialVoteStage game={game} />}
```

- [ ] Add table tests:
  - `DAY_VOTE` with `lockedSeatIds` and `pendingSeatIds` renders `封票中`, `已锁票`, `等待中`, `class-trial-seat-vote-locked`, and `class-trial-seat-vote-waiting`.
  - `DAY_VOTE` markup does not include vote arrows, target names from hidden votes, vote reasons, or tally counts.
  - Revealed snapshot renders `开票揭示`, tally rows, ledger rows, and `class-trial-seat-vote-focus` for the sole leading seat.
  - `DAY_SPEECH` still renders the existing discussion table without `class-trial-vote-stage`.

- [ ] Run table tests:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts
```

Expected after implementation: existing class-trial table tests and new vote-stage assertions pass.

- [ ] Commit after this task if working incrementally:

```powershell
git add src/components/game/ClassTrialGameTable.tsx src/components/game/classTrialGameTable.test.ts
git commit -m "feat: wire class trial vote visuals"
```

---

## Task 4: Add Class-Trial Vote Styling

**Purpose:** Match the approved image2 direction with red/black/gold class-trial energy while keeping the UI readable and responsive.

**Files:**

- `src/app/globals.css`

**Steps:**

- [ ] Add styles inside the existing class-trial component section:

```css
.class-trial-table-vote-active .class-trial-ring {
  filter: drop-shadow(0 0 28px rgba(248, 196, 91, 0.16));
}

.class-trial-vote-stage {
  width: min(100%, 780px);
  margin: 16px auto 0;
  border: 1px solid rgba(248, 196, 91, 0.36);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(54, 8, 16, 0.94), rgba(14, 14, 18, 0.95)),
    repeating-linear-gradient(90deg, rgba(248, 196, 91, 0.07) 0 1px, transparent 1px 11px);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.34);
  color: #fff5d6;
  overflow: hidden;
}

.class-trial-vote-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(248, 196, 91, 0.24);
}

.class-trial-vote-title {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0;
}

.class-trial-vote-meter {
  min-width: 112px;
  text-align: right;
  color: #f8c45b;
  font-variant-numeric: tabular-nums;
}

.class-trial-vote-body {
  padding: 14px;
}

.class-trial-vote-seat-rail,
.class-trial-vote-ledger,
.class-trial-vote-tally {
  display: grid;
  gap: 8px;
}

.class-trial-vote-seat-rail {
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
}

.class-trial-vote-seat-token,
.class-trial-vote-ledger-row,
.class-trial-vote-tally-row {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.24);
  padding: 8px 10px;
}

.class-trial-vote-seat-token-locked {
  border-color: rgba(248, 196, 91, 0.62);
  box-shadow: inset 0 0 0 1px rgba(248, 196, 91, 0.12);
}

.class-trial-vote-seat-token-waiting {
  color: rgba(255, 245, 214, 0.68);
}

.class-trial-seat-vote-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(248, 196, 91, 0.18);
  color: #f8c45b;
  font-size: 0.68rem;
  line-height: 1;
}

.class-trial-seat-vote-status-waiting {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 245, 214, 0.72);
}

.class-trial-seat-vote-locked {
  border-color: rgba(248, 196, 91, 0.72);
}

.class-trial-seat-vote-waiting {
  opacity: 0.78;
}

.class-trial-seat-vote-focus {
  border-color: rgba(255, 74, 92, 0.82);
  box-shadow: 0 0 0 2px rgba(255, 74, 92, 0.24), 0 0 26px rgba(255, 74, 92, 0.22);
}
```

- [ ] Add responsive rules near existing class-trial media queries:

```css
@media (max-width: 720px) {
  .class-trial-vote-stage-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .class-trial-vote-meter {
    min-width: 0;
    text-align: left;
  }
}
```

- [ ] Add reduced-motion support near the existing reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
  .class-trial-table-vote-active .class-trial-ring,
  .class-trial-seat-vote-focus {
    transition: none;
  }
}
```

- [ ] Run CSS-sensitive checks:

```powershell
npm run lint
npx tsc --noEmit
```

Expected after implementation: no lint or type errors from new classes/components.

- [ ] Commit after this task if working incrementally:

```powershell
git add src/app/globals.css
git commit -m "style: polish class trial vote stage"
```

---

## Task 5: Align Class-Trial Phase Copy And State Docs

**Purpose:** Make transition text match the new privacy/reveal behavior and keep the repo handoff current.

**Files:**

- `src/components/game/classTrialPhaseScenes.ts`
- `src/components/game/classTrialPhaseScenes.test.ts`
- `docs/tasks/2026-05-class-trial-vote-visualization.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

**Steps:**

- [ ] Update the `DAY_VOTE` cue text to emphasize sealed voting:

```ts
case "DAY_VOTE":
  return {
    presentation: "class-trial",
    title: "封票审判开始",
    subtitle: "所有人的投票已经进入票箱，目标将在开票时一次性公开。",
    resultLines: ["投票阶段：当前只公开封票进度，不公开投票目标。"],
  };
```

- [ ] Keep `EXILE_RESOLUTION` focused on one-shot reveal:

```ts
case "EXILE_RESOLUTION":
  return {
    presentation: "class-trial",
    title: "开票揭示",
    subtitle: "票箱开启，所有指向一次性成为公开证据。",
    resultLines: formatVoteResultLines(game, fallbackEvent),
  };
```

- [ ] Update existing phase-scene tests or add assertions for the new text.

- [ ] Create `docs/tasks/2026-05-class-trial-vote-visualization.md` with `apply_patch`, using `docs/tasks/HARNESS_TASK_TEMPLATE.md` as the structure reference.

- [ ] Fill the task card with:
  - title: `Class trial vote visualization`
  - scope: local-only class-trial common exile vote
  - acceptance criteria from this plan
  - verification commands and final browser/manual evidence
  - explicit note that generic vote UI and room flows are out of scope

- [ ] Update `feature_list.json`, `progress.md`, and `session-handoff.md` only with this task’s status/evidence. Preserve unrelated existing edits in those files.

- [ ] Run doc/state checks:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-visualization.md
npm run harness:check
```

Expected after implementation: task card and harness state pass the repository checks.

- [ ] Commit after this task if working incrementally:

```powershell
git add src/components/game/classTrialPhaseScenes.ts src/components/game/classTrialPhaseScenes.test.ts docs/tasks/2026-05-class-trial-vote-visualization.md feature_list.json progress.md session-handoff.md
git commit -m "docs: record class trial vote visualization work"
```

---

## Task 6: End-To-End Verification And Browser Review

**Purpose:** Prove the UI behavior and privacy boundary before calling the work complete.

**Steps:**

- [ ] Run targeted tests:

```powershell
npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: all listed suites pass.

- [ ] Run baseline checks:

```powershell
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Expected: lint passes, TypeScript passes, production build succeeds, and no whitespace errors are reported.

- [ ] Start the local app if no usable dev server is already running:

```powershell
npm run dev
```

Expected: Next.js starts and reports a local URL such as `http://localhost:3000`.

- [ ] Use the in-app Browser to inspect the class-trial local flow. If the in-app Browser blocks localhost again, use Playwright against the local dev server and record the fallback reason in the final handoff.

- [ ] Browser/manual acceptance checks:
  - `DAY_VOTE` shows the class-trial table plus `封票中`.
  - Living eligible seats show `已锁票` or `等待中`.
  - The voting-in-progress view does not show targets, arrows, vote reasons, tally rankings, or leading player.
  - After all votes lock and the phase reaches reveal, `开票揭示` shows tally and voter-to-target ledger in one view.
  - Non-class-trial voting screens still use the old generic vote UI.

- [ ] Inspect the final diff:

```powershell
git status --short
git diff -- src/game/types.ts src/game/projection.ts src/game/engine.test.ts src/components/game/ClassTrialVoteStage.tsx src/components/game/classTrialVoteStage.test.ts src/components/game/ClassTrialGameTable.tsx src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.ts src/components/game/classTrialPhaseScenes.test.ts src/app/globals.css docs/tasks/2026-05-class-trial-vote-visualization.md feature_list.json progress.md session-handoff.md
```

- [ ] Final handoff must include:

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

---

## Rollback Plan

- Remove the `ClassTrialVoteStage` import and render call from `ClassTrialGameTable`.
- Remove the class-trial vote CSS block from `src/app/globals.css`.
- Keep or remove the optional `PublicVoteSnapshot` progress fields depending on whether any other UI starts using them; they are non-sensitive and backward-compatible because they are optional.
- Re-run the targeted tests and `npx tsc --noEmit`.

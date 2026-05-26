# GameClient Event Feed Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the table event feed calculation from `GameClient.tsx` into a tested helper.

**Architecture:** Keep `GameClient.tsx` responsible for memoizing the current game-derived event feed, but move the pure filtering and ordering logic to `src/components/game/tableEventFeed.ts`.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing `HumanGameView` type.

---

### Task 1: Event Feed Helper

**Files:**
- Create: `src/components/game/tableEventFeed.test.ts`
- Create: `src/components/game/tableEventFeed.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing test**

Create tests that prove the helper filters `DAY_SPEECH`, limits to 18 events, and returns newest-first order.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/game/tableEventFeed.test.ts`
Expected: FAIL because `src/components/game/tableEventFeed.ts` does not exist yet.

- [ ] **Step 3: Move the helper implementation**

Move the existing `latestEvents` calculation from `GameClient.tsx` into `buildTableEventFeed`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/game/tableEventFeed.test.ts`
Expected: PASS.

### Task 2: Integration And Handoff

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-gameclient-event-feed-model.md`

- [ ] **Step 1: Run required checks**

Run: `npm run test -- src/components/game/tableEventFeed.test.ts`
Run: `npm run lint`
Run: `npx tsc --noEmit`
Run: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-event-feed-model.md`
Run: `npm run harness:check`
Expected: PASS.

- [ ] **Step 2: Run optional structure audit**

Run: `npm run audit:structure`
Expected: PASS.

- [ ] **Step 3: Update state files**

Record the changed files, verification evidence, skipped browser/manual flow, and next restart path in the task card, `feature_list.json`, `progress.md`, and `session-handoff.md`.

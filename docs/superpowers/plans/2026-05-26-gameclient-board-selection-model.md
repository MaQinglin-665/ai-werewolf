# GameClient Board Selection Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract landing-page board toggle and human-seat transition rules from `GameClient.tsx` into the existing board selection model.

**Architecture:** Keep `GameClient.tsx` responsible for state setters and callbacks, but move pure transition decisions to `src/components/game/boardSelectionModel.ts`. Inject the random seat picker so tests remain deterministic.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing `BoardOption` and `HumanSeatMode` types.

---

### Task 1: Board Toggle Transition Helper

**Files:**
- Modify: `src/components/game/boardSelectionModel.test.ts`
- Modify: `src/components/game/boardSelectionModel.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing tests**

Create tests that prove the helper clears selection when toggling the current board, preserves spectator mode with no human seat, preserves valid fixed seats, and switches invalid fixed seats back to random with a provided fallback seat.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/components/game/boardSelectionModel.test.ts`
Expected: FAIL because the transition helper does not exist yet.

- [ ] **Step 3: Add the helper and wire GameClient**

Add `resolveBoardSelectionToggle` to `boardSelectionModel.ts` and call it from `GameClient.tsx` inside `selectBoard`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/components/game/boardSelectionModel.test.ts`
Expected: PASS.

### Task 2: Integration And Handoff

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-gameclient-board-selection-model.md`

- [ ] **Step 1: Run required checks**

Run: `npm run test -- src/components/game/boardSelectionModel.test.ts`
Run: `npm run lint`
Run: `npx tsc --noEmit`
Run: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-board-selection-model.md`
Run: `npm run harness:check`
Expected: PASS.

- [ ] **Step 2: Run optional structure audit**

Run: `npm run audit:structure`
Expected: PASS.

- [ ] **Step 3: Update state files**

Record the changed files, verification evidence, skipped browser/manual flow, and next restart path in the task card, `feature_list.json`, `progress.md`, and `session-handoff.md`.

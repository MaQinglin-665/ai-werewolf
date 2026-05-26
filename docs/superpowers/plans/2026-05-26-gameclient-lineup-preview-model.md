# GameClient Lineup Preview Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the landing-page lineup preview calculation from `GameClient.tsx` into a tested helper.

**Architecture:** Keep `GameClient.tsx` responsible for state and memoization, but move the pure preview array construction to `src/components/game/landingLineupPreview.ts`. The helper accepts board seat count, human seat mode, selected human seat, and selected AI friends, then returns `AiLineupPreviewItem[]`.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing `AiFriendConfig`, `BoardOption`, `HumanSeatMode`, and `AiLineupPreviewItem` types.

---

### Task 1: Lineup Preview Helper

**Files:**
- Create: `src/components/game/landingLineupPreview.test.ts`
- Create: `src/components/game/landingLineupPreview.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing test**

Create tests for fixed-human-seat preview and spectator-mode preview.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/game/landingLineupPreview.test.ts`
Expected: FAIL because `src/components/game/landingLineupPreview.ts` does not exist yet.

- [ ] **Step 3: Move the helper implementation**

Move the existing `aiLineupPreview` array construction from `GameClient.tsx` into `buildLandingLineupPreview`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/game/landingLineupPreview.test.ts`
Expected: PASS.

### Task 2: Integration And Handoff

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-gameclient-lineup-preview-model.md`

- [ ] **Step 1: Run required checks**

Run: `npm run test -- src/components/game/landingLineupPreview.test.ts`
Run: `npm run lint`
Run: `npx tsc --noEmit`
Run: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-lineup-preview-model.md`
Run: `npm run harness:check`
Expected: PASS.

- [ ] **Step 2: Run optional structure audit**

Run: `npm run audit:structure`
Expected: PASS.

- [ ] **Step 3: Update state files**

Record the changed files, verification evidence, skipped browser/manual flow, and next restart path in the task card, `feature_list.json`, `progress.md`, and `session-handoff.md`.

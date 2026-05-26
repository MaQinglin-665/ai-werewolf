# First-Game Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the first-game loop by clarifying player actions, reducing high-frequency AI table-feel warnings, and making the review panel easier to trust.

**Architecture:** Keep the existing `HumanGameView` flow. Add small pure helpers for action guidance and review highlights, then render them in existing panels. Tighten AI vote/duel heuristics in the existing table-read/action-provider layer without changing engine rules.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, existing AI simulation/audit scripts.

---

## File Structure

- Create `src/components/game/actionGuidance.ts`: pure phase/action guidance text used by `ActionPanel`.
- Create `src/components/game/actionGuidance.test.ts`: unit tests for action guidance.
- Modify `src/components/game/ActionPanel.tsx`: render guidance chips and consequence copy.
- Modify `src/ai/tableRead.ts`: reduce wolf teammate vote selection and strengthen dead-seer gold-water protection.
- Modify `src/ai/actionProviders.ts`: make knight duel candidate ordering more conservative.
- Modify `src/ai/actionProviders.test.ts`: regression coverage for knight duel constraints.
- Modify `src/ai/tableRead.test.ts`: regression coverage for wolf vote and dead-seer gold-water behavior.
- Create `src/game/reviewHighlights.ts`: pure review summary helper.
- Create `src/game/reviewHighlights.test.ts`: unit tests for review highlights.
- Modify `src/components/game/ReviewPanel.tsx`: render the summary helper above detailed sections.
- Keep `docs/superpowers/specs/2026-05-20-first-game-experience-design.md` and this plan in the final commit.

## Task 1: Current Action Guidance

**Files:**
- Create: `src/components/game/actionGuidance.ts`
- Create: `src/components/game/actionGuidance.test.ts`
- Modify: `src/components/game/ActionPanel.tsx`

- [ ] **Step 1: Write failing guidance tests**

Add tests that import `buildActionGuidance` and assert that `seerCheck`, `witchAction`, `vote`, `continue`, and `speak` return task, privacy, and outcome text.

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/components/game/actionGuidance.test.ts`

Expected: fail because `actionGuidance.ts` does not exist.

- [ ] **Step 3: Implement helper and render it**

Create `buildActionGuidance(action, game)` returning `{ task, privacy, outcome, risk }`. In `ActionPanel`, render a compact guidance block under the action title and inside the continue-only panel.

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/components/game/actionGuidance.test.ts`

Expected: pass.

## Task 2: AI Day-One Table Feel

**Files:**
- Modify: `src/ai/tableRead.ts`
- Modify: `src/ai/tableRead.test.ts`
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Write failing AI behavior tests**

Add tests for:

- A wolf vote plan prefers a non-teammate public target over a teammate unless distancing has strong public evidence.
- A dead-seer gold-water target is not selected by good-side vote planning when another legal target exists.
- Knight duel constraints say counterclaim alone is not enough and candidate ordering keeps weak black-check targets behind stronger public evidence.

- [ ] **Step 2: Run red tests**

Run: `npm run test -- src/ai/tableRead.test.ts src/ai/actionProviders.test.ts`

Expected: at least one new assertion fails against current heuristics.

- [ ] **Step 3: Implement heuristic tightening**

In `createVotePlan`, keep wolf day votes on non-teammates unless `chooseWolfDistanceVoteTarget` sees strong public evidence. Increase dead-seer gold-water protection in vote scoring and reason text. In `knightDuelTargetScore`, penalize weak black checks and protected claims more heavily.

- [ ] **Step 4: Run green tests**

Run: `npm run test -- src/ai/tableRead.test.ts src/ai/actionProviders.test.ts`

Expected: pass.

## Task 3: Review Credibility Summary

**Files:**
- Create: `src/game/reviewHighlights.ts`
- Create: `src/game/reviewHighlights.test.ts`
- Modify: `src/components/game/ReviewPanel.tsx`

- [ ] **Step 1: Write failing review tests**

Add tests that build a completed game and assert `buildReviewCredibilityHighlights(game)` returns highlights for result, claims/checks, votes, and strong actions when data exists.

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/game/reviewHighlights.test.ts`

Expected: fail because `reviewHighlights.ts` does not exist.

- [ ] **Step 3: Implement helper and render summary**

Create a pure helper that reads `HumanGameView["review"]` and returns 3-5 concise highlights. Render them near the top of `ReviewPanel`, above detailed claims/vote sections.

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/game/reviewHighlights.test.ts`

Expected: pass.

## Task 4: Integrated Verification And Git

**Files:**
- All files changed above.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test -- src/components/game/actionGuidance.test.ts src/ai/tableRead.test.ts src/ai/actionProviders.test.ts src/game/reviewHighlights.test.ts
```

- [ ] **Step 2: Run project checks**

Run:

```powershell
npx tsc --noEmit
npm run test -- src/game/engine.test.ts
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/first-game-experience-audit-after.json
```

- [ ] **Step 3: Browser check**

Use a current local dev server if available, otherwise start one. Create or load a game and inspect the action panel and review summary.

- [ ] **Step 4: Git commit**

Stage only the spec, plan, and source/test files changed for this task. Commit with:

```powershell
git commit -m "feat: improve first-game experience loop"
```

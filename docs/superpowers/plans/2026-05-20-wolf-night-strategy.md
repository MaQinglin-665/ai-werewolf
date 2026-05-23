# Wolf Night Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-night private wolf-team strategy note that human wolves can see and wolf AI can use without leaking hidden information to good-side seats.

**Architecture:** Extend the existing `WolfTeamPlan` returned by `buildWolfTeamPlan(state)` with a `nightStrategy` object. `buildAgentView` already attaches `wolfTeamPlan` only to wolf seats; `buildPlayerView` will expose a sanitized human-facing copy only for wolf human seats. The UI renders the note near the action panel, while LLM action and speech inputs receive the strategy only through private wolf context.

**Tech Stack:** TypeScript, Next.js React components, Vitest, existing ai-werewolf game projection and AI provider modules.

---

## File Structure

- Modify `src/game/types.ts`: add `WolfNightStrategy`, attach it to `WolfTeamPlan`, and add `wolfStrategy?: WolfNightStrategy` to `HumanGameView`.
- Modify `src/game/campStrategy.ts`: compute deterministic `nightStrategy` from live wolves, legal non-wolf targets, public table memory, and existing assignments.
- Modify `src/game/projection.ts`: expose `wolfStrategy` only to wolf human viewers.
- Modify `src/components/game/ActionPanel.tsx`: render a compact private wolf strategy panel when `game.wolfStrategy` exists.
- Modify `src/ai/actionProviders.ts`: include the private night strategy in `selfContext.wolfPlan` for wolf seats only and prefer the planned kill candidate first.
- Modify `src/ai/speechProviders.ts`: include a public-safe private instruction from the night strategy in `privateContext.wolfSpeechAssignment`.
- Modify tests:
  - `src/game/engine.test.ts`
  - `src/game/projection.test.ts`
  - `src/ai/actionProviders.test.ts`
  - `src/ai/speechProviders.test.ts`

## Tasks

### Task 1: Strategy Model And Projection

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/campStrategy.ts`
- Modify: `src/game/projection.ts`
- Test: `src/game/engine.test.ts`
- Test: `src/game/projection.test.ts`

- [ ] **Step 1: Write failing projection tests**

Add tests that expect:

```ts
expect(wolfView.privateKnowledge.wolfTeamPlan?.nightStrategy?.summary).toContain("首夜");
expect(wolfView.privateKnowledge.wolfTeamPlan?.nightStrategy?.nightTarget).toBeDefined();
expect(goodView.privateKnowledge.wolfTeamPlan).toBeUndefined();
expect(buildPlayerView(state, wolf.seatId).wolfStrategy?.discussion.length).toBeGreaterThan(0);
expect(buildPlayerView(state, good.seatId).wolfStrategy).toBeUndefined();
expect(JSON.stringify(buildPlayerView(state, good.seatId))).not.toMatch(/狼队首夜|战术|队友/);
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test -- src/game/projection.test.ts src/game/engine.test.ts
```

Expected: fail because `nightStrategy` and `wolfStrategy` do not exist.

- [ ] **Step 3: Add the model fields**

Add:

```ts
export type WolfNightStrategy = {
  nightTarget?: ActionTarget;
  dayPressureTarget?: ActionTarget;
  summary: string;
  discussion: string[];
};

export type WolfTeamPlan = {
  day: number;
  strategy: "COUNTERCLAIM" | "SHADOW" | "SURVIVE";
  summary: string;
  nightStrategy?: WolfNightStrategy;
  primaryTarget?: ActionTarget;
  threat?: ActionTarget;
  counterclaimSeat?: ActionTarget;
  assignments: WolfTeamAssignment[];
};
```

Add `wolfStrategy?: WolfNightStrategy` to `HumanGameView`.

- [ ] **Step 4: Compute the deterministic night strategy**

In `buildWolfTeamPlan`, compute:

```ts
const nightTarget = pickNightTarget(state, memory, wolfSeatIds, externalSeerClaim?.claimant);
const dayPressureTarget = primaryTarget ?? memory.focus.find((focus) => !wolfSeatIds.has(focus.seat.seatId))?.seat ?? nightTarget;
const assignments = buildAssignments(wolves, counterclaimSeat, dayPressureTarget, externalSeerClaim?.claimant);
```

Return `nightStrategy: buildNightStrategy({ state, wolves, nightTarget, dayPressureTarget, assignments, strategy })`.

- [ ] **Step 5: Project only to wolf humans**

In `buildPlayerView`, compute `const wolfPlan = human && isWolfRole(human.role, state.rules.wolfRoles) ? buildWolfTeamPlan(state) : undefined;` once and set:

```ts
wolfTeammates: wolfPlan ? state.seats.filter(...).map(toTarget) : [],
wolfStrategy: wolfPlan?.nightStrategy,
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
npm run test -- src/game/projection.test.ts src/game/engine.test.ts
```

Expected: pass.

### Task 2: AI Private Context And Planned Night Kill

**Files:**
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/speechProviders.ts`
- Test: `src/ai/actionProviders.test.ts`
- Test: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write failing AI context tests**

Add tests that build wolf and good `AgentView` values and assert:

```ts
expect(wolfInput.selfContext.wolfPlan?.nightStrategy?.summary).toContain("首夜");
expect(wolfInput.selfContext.wolfPlan?.nightStrategy?.nightTarget).toBeDefined();
expect(goodInput.selfContext.wolfPlan).toBeUndefined();
expect(JSON.stringify(goodInput)).not.toMatch(/狼队首夜|战术|nightStrategy/);
expect(wolfSpeechInput.privateContext.wolfSpeechAssignment?.nightInstruction).toContain("首夜");
expect(goodSpeechInput.privateContext.wolfSpeechAssignment).toBeUndefined();
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
```

Expected: fail because action and speech private contexts do not include `nightStrategy`.

- [ ] **Step 3: Extend action private context**

Add `nightStrategy` to `selfContext.wolfPlan`:

```ts
nightStrategy: wolfPlan.nightStrategy
  ? {
      nightTarget: wolfPlan.nightStrategy.nightTarget,
      dayPressureTarget: wolfPlan.nightStrategy.dayPressureTarget,
      summary: wolfPlan.nightStrategy.summary,
      discussion: wolfPlan.nightStrategy.discussion,
    }
  : undefined,
```

When building `NIGHT_WOLVES` candidates, add the planned target before sorted fallback candidates if it remains legal.

- [ ] **Step 4: Extend speech private context**

Add `nightInstruction` to `wolfSpeechAssignment`:

```ts
nightInstruction: view.privateKnowledge.wolfTeamPlan?.nightStrategy?.summary,
```

Use this only inside private context. Do not add the text to public context, public prompts, or public table memory.

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
```

Expected: pass.

### Task 3: Human Wolf Strategy Panel

**Files:**
- Modify: `src/components/game/ActionPanel.tsx`

- [ ] **Step 1: Add a small render helper**

Add `WolfStrategyPanel({ strategy })` under `ActionGuidanceStrip` with:

```tsx
<div className="mb-4 rounded-2xl border border-[#d84a3a]/24 bg-[#2b1110]/55 p-3 text-xs leading-5 text-[#ffd8cf]">
  <div className="text-sm font-semibold text-[#ffe5da]">狼队首夜战术</div>
  ...
</div>
```

Render target rows for `nightTarget`, `dayPressureTarget`, `discussion`, and wolf assignments from `strategy.discussion`.

- [ ] **Step 2: Render only when present**

In the normal action panel and continue-only panel, render:

```tsx
{game.wolfStrategy && <WolfStrategyPanel strategy={game.wolfStrategy} />}
```

No extra visibility logic belongs in the component; projection owns privacy.

- [ ] **Step 3: Type-check**

Run:

```powershell
npx tsc --noEmit
```

Expected: pass.

### Task 4: Full Validation And Git

**Files:**
- All modified files from Tasks 1-3.

- [ ] **Step 1: Focused tests**

Run:

```powershell
npm run test -- src/game/projection.test.ts src/game/engine.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
```

Expected: all pass.

- [ ] **Step 2: Type-check**

Run:

```powershell
npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: AI audit**

Run:

```powershell
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/wolf-night-strategy-audit.json
```

Expected: completes with no fallback increase; remaining gameplay warnings are recorded.

- [ ] **Step 4: Browser verification**

Start the app and verify a wolf-seat first-night game when feasible. Confirm a wolf human sees `狼队首夜战术`, a good human does not, and public event text does not contain the strategy.

- [ ] **Step 5: Commit and push**

Run:

```powershell
git status --short
git add docs/superpowers/plans/2026-05-20-wolf-night-strategy.md src/game/types.ts src/game/campStrategy.ts src/game/projection.ts src/game/engine.test.ts src/game/projection.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/components/game/ActionPanel.tsx
git commit -m "feat: add private wolf night strategy"
git push
```

Expected: branch `codex/render-main-game-env-fix` pushes successfully.

## Self-Review

- Spec coverage: the plan covers private model, wolf-only projection, AI private context, UI surface, leak tests, type-check, AI audit, browser verification, and git.
- Placeholder scan: no step depends on undefined work or future full chat.
- Type consistency: `WolfNightStrategy` is the shared type for `WolfTeamPlan.nightStrategy`, `HumanGameView.wolfStrategy`, action private context, speech private context, and UI rendering.

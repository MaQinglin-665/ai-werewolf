# Class Trial Vote Burst Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only class-trial burst animation layer for vote start and vote reveal while keeping the existing sealed-progress and tally/ledger layout readable.

**Architecture:** Extend the existing `ClassTrialVoteStage` presenter with reveal verdict metadata and a pure CSS overlay component. Keep the vote privacy boundary in `getClassTrialVoteState`: sealed state only uses eligible/locked/pending ids, and reveal-only UI uses revealed tally/votes/leaders. Add CSS-only motion with reduced-motion fallbacks, plus task/state docs and browser verification.

**Tech Stack:** Next.js App Router, React client/server-renderable components, TypeScript, Vitest + `react-dom/server`, plain CSS in `src/app/globals.css`, local browser verification.

---

## Files And Responsibilities

- `src/components/game/ClassTrialVoteStage.tsx`: owns vote-stage UI state mapping, burst overlay rendering, reveal/no-exile copy, tally, and ledger.
- `src/components/game/classTrialVoteStage.test.ts`: protects sealed privacy, burst overlay text, reveal spotlight, and no-exile copy.
- `src/components/game/classTrialGameTable.test.ts`: protects table integration and verifies no-exile reveal does not focus a seat.
- `src/app/globals.css`: adds CSS-only burst overlay, scanline/pulse pressure, locked-seat stamp, reveal/no-exile styling, responsive and reduced-motion behavior.
- `docs/tasks/2026-05-class-trial-vote-burst-animation.md`: executable task card and final evidence record.
- `feature_list.json`, `progress.md`, `session-handoff.md`: harness state updates after implementation and verification.

---

### Task 1: Add Reveal Verdict Metadata

**Files:**
- Modify: `src/components/game/ClassTrialVoteStage.tsx`
- Test: `src/components/game/classTrialVoteStage.test.ts`

- [ ] **Step 1: Add the failing no-exile state test**

Append this test inside the existing `ClassTrialVoteStage` describe block after the existing revealed tally test:

```ts
  it("labels revealed tied votes as no exile without focusing a target", () => {
    const game = makeGame({
      phase: "EXILE_RESOLUTION",
      phaseLabel: "放逐结算",
      tableSummary: {
        ...makeGame().tableSummary,
        voteSnapshot: {
          votes: [
            {
              seq: 10,
              day: 2,
              voter: { seatId: 1, name: "角色1" },
              target: { seatId: 6, name: "角色6" },
            },
            {
              seq: 11,
              day: 2,
              voter: { seatId: 2, name: "角色2" },
              target: { seatId: 7, name: "角色7" },
            },
            {
              seq: 12,
              day: 2,
              voter: { seatId: 3, name: "角色3" },
              abstained: true,
            },
          ],
          tally: [
            { target: { seatId: 6, name: "角色6" }, count: 1 },
            { target: { seatId: 7, name: "角色7" }, count: 1 },
          ],
          abstainCount: 1,
          leaders: [
            { seatId: 6, name: "角色6" },
            { seatId: 7, name: "角色7" },
          ],
          revealed: true,
        },
      },
    });
    const state = getClassTrialVoteState(game);
    const html = normalizeHtml(renderToStaticMarkup(createElement(ClassTrialVoteStage, { game })));

    expect(state).toMatchObject({ variant: "reveal", verdict: "no-exile", focusSeatId: undefined });
    expect(html).toContain("未达成处刑");
    expect(html).toContain("票箱未形成唯一处刑目标");
    expect(html).toContain("1号 -> 6号");
    expect(html).toContain("2号 -> 7号");
    expect(html).toContain("3号 -> 弃票");
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts -t "no exile"
```

Expected: FAIL because the reveal state does not expose `verdict`, and the rendered HTML does not contain `未达成处刑`.

- [ ] **Step 3: Replace the vote stage state type**

In `src/components/game/ClassTrialVoteStage.tsx`, replace the `ClassTrialVoteStageState` type with:

```ts
export type ClassTrialVoteStageState =
  | {
      variant: "sealing";
      eligibleSeatIds: number[];
      lockedSeatIds: number[];
      pendingSeatIds: number[];
    }
  | {
      variant: "reveal";
      verdict: "exile" | "no-exile";
      votes: HumanGameView["tableSummary"]["voteSnapshot"]["votes"];
      tally: HumanGameView["tableSummary"]["voteSnapshot"]["tally"];
      abstainCount: number;
      leaders: ActionTarget[];
      focusSeatId?: number;
      focusTarget?: ActionTarget;
    };
```

- [ ] **Step 4: Replace the reveal branch in `getClassTrialVoteState`**

Replace the existing `if (snapshot.revealed && (snapshot.votes.length > 0 || snapshot.tally.length > 0 || snapshot.abstainCount))` block with:

```ts
  if (snapshot.revealed && (snapshot.votes.length > 0 || snapshot.tally.length > 0 || snapshot.abstainCount)) {
    const onlyLeader = snapshot.leaders.length === 1 ? snapshot.leaders[0] : undefined;
    const hasWinningTarget = Boolean(
      onlyLeader && snapshot.tally.some((item) => item.target.seatId === onlyLeader.seatId && item.count > 0),
    );
    const focusTarget = hasWinningTarget ? onlyLeader : undefined;

    return {
      variant: "reveal",
      verdict: focusTarget ? "exile" : "no-exile",
      votes: snapshot.votes,
      tally: snapshot.tally,
      abstainCount: snapshot.abstainCount ?? 0,
      leaders: snapshot.leaders,
      focusSeatId: focusTarget?.seatId,
      focusTarget,
    };
  }
```

- [ ] **Step 5: Update reveal title and focus label helpers**

Replace the reveal stage header title and meter values in `ClassTrialVoteRevealStage` with:

```tsx
          <p className="class-trial-vote-kicker">VERDICT OPEN</p>
          <h2 className="class-trial-vote-title">{getRevealTitle(voteState)}</h2>
```

and:

```tsx
          <strong>{formatFocusLabel(voteState)}</strong>
          <span>{voteState.verdict === "exile" ? "公开证据" : "票箱未形成唯一处刑目标"}</span>
```

Replace `formatFocusLabel` at the bottom of the file with:

```ts
function getRevealTitle(voteState: Extract<ClassTrialVoteStageState, { variant: "reveal" }>): string {
  return voteState.verdict === "exile" ? "开票揭示" : "未达成处刑";
}

function formatFocusLabel(voteState: Extract<ClassTrialVoteStageState, { variant: "reveal" }>): string {
  return voteState.focusTarget ? `${voteState.focusTarget.seatId}号` : "无处刑";
}
```

- [ ] **Step 6: Run the focused test and verify it passes**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts -t "no exile"
```

Expected: PASS for the no-exile test.

- [ ] **Step 7: Run all vote-stage tests**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts
```

Expected: PASS for all tests in the file.

- [ ] **Step 8: Commit the state metadata change**

```powershell
git add src/components/game/ClassTrialVoteStage.tsx src/components/game/classTrialVoteStage.test.ts
git commit -m "feat: classify class trial vote verdict"
```

---

### Task 2: Add The Burst Overlay Markup

**Files:**
- Modify: `src/components/game/ClassTrialVoteStage.tsx`
- Test: `src/components/game/classTrialVoteStage.test.ts`

- [ ] **Step 1: Add failing overlay expectations**

In the sealed-progress test, add these assertions after the existing positive assertions:

```ts
    expect(html).toContain("class-trial-vote-burst-sealing");
    expect(html).toContain("TRIAL VOTE");
    expect(html).toContain("封票开始");
```

In the existing revealed vote tally test, add:

```ts
    expect(html).toContain("class-trial-vote-burst-exile");
    expect(html).toContain("处刑目标");
    expect(html).toContain("6号 角色6");
```

In the no-exile test from Task 1, add:

```ts
    expect(html).toContain("class-trial-vote-burst-no-exile");
    expect(html).not.toContain("class-trial-vote-burst-exile");
```

- [ ] **Step 2: Run the overlay tests and verify they fail**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts -t "lock progress|revealed vote tally|no exile"
```

Expected: FAIL because `ClassTrialVoteBurstOverlay` has not been rendered.

- [ ] **Step 3: Add overlay types and component**

Add this code below `ClassTrialVoteStage` and above `ClassTrialVoteSealingStage`:

```tsx
type ClassTrialVoteBurstOverlayVariant = "sealing" | "exile" | "no-exile";

function ClassTrialVoteBurstOverlay({
  variant,
  title,
  subtitle,
  focusTarget,
}: {
  variant: ClassTrialVoteBurstOverlayVariant;
  title: string;
  subtitle: string;
  focusTarget?: ActionTarget;
}) {
  return (
    <div
      className={["class-trial-vote-burst-overlay", `class-trial-vote-burst-${variant}`].join(" ")}
      aria-hidden="true"
    >
      <div className="class-trial-vote-burst-slice" />
      <div className="class-trial-vote-burst-copy">
        {focusTarget && <span className="class-trial-vote-burst-target">{formatTargetLabel(focusTarget)}</span>}
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Render the sealed overlay**

Inside `ClassTrialVoteSealingStage`, add the overlay as the first child of the `<section>`:

```tsx
      <ClassTrialVoteBurstOverlay variant="sealing" title="TRIAL VOTE" subtitle="封票开始" />
```

The beginning of the return should read:

```tsx
    <section className="class-trial-vote-stage class-trial-vote-stage-sealing" aria-label="投票封票进度">
      <ClassTrialVoteBurstOverlay variant="sealing" title="TRIAL VOTE" subtitle="封票开始" />
      <header className="class-trial-vote-stage-header">
```

- [ ] **Step 5: Render the reveal overlay**

Inside `ClassTrialVoteRevealStage`, add these constants before the `return`:

```tsx
  const revealTitle = getRevealTitle(voteState);
  const revealSubtitle =
    voteState.verdict === "exile" && voteState.focusTarget ? "处刑目标" : "票箱未形成唯一处刑目标";
```

Then add the overlay as the first child of the `<section>`:

```tsx
      <ClassTrialVoteBurstOverlay
        variant={voteState.verdict === "exile" ? "exile" : "no-exile"}
        title={revealTitle}
        subtitle={revealSubtitle}
        focusTarget={voteState.focusTarget}
      />
```

Use `revealTitle` in the `<h2>`:

```tsx
          <h2 className="class-trial-vote-title">{revealTitle}</h2>
```

- [ ] **Step 6: Run vote-stage tests**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts
```

Expected: PASS. The sealed test must still prove no target, target name, arrow, or vote reason leaks during `DAY_VOTE`.

- [ ] **Step 7: Commit the overlay markup**

```powershell
git add src/components/game/ClassTrialVoteStage.tsx src/components/game/classTrialVoteStage.test.ts
git commit -m "feat: add class trial vote burst overlay"
```

---

### Task 3: Add Table Integration Guard For No-Exile

**Files:**
- Modify: `src/components/game/classTrialGameTable.test.ts`

- [ ] **Step 1: Add a failing table-level no-exile test**

Append this test after `renders the one-shot vote reveal and focuses the leading seat`:

```ts
  it("renders no-exile vote reveal without focusing a seat", () => {
    const baseGame = makeGame();
    const html = normalizeHtml(
      renderToStaticMarkup(
        createElement(ClassTrialGameTable, {
          game: makeGame({
            currentSpeakerSeatId: undefined,
            phase: "EXILE_RESOLUTION",
            phaseLabel: "放逐结算",
            tableSummary: {
              ...baseGame.tableSummary,
              voteSnapshot: {
                votes: [
                  {
                    seq: 10,
                    day: 2,
                    voter: { seatId: 1, name: "角色1" },
                    target: { seatId: 6, name: "角色6" },
                  },
                  {
                    seq: 11,
                    day: 2,
                    voter: { seatId: 2, name: "角色2" },
                    target: { seatId: 7, name: "角色7" },
                  },
                ],
                tally: [
                  { target: { seatId: 6, name: "角色6" }, count: 1 },
                  { target: { seatId: 7, name: "角色7" }, count: 1 },
                ],
                abstainCount: 0,
                leaders: [
                  { seatId: 6, name: "角色6" },
                  { seatId: 7, name: "角色7" },
                ],
                revealed: true,
              },
            },
          }),
          loading: false,
          onReturnHome: () => undefined,
          onSubmit: async () => undefined,
        }),
      ),
    );

    expect(html).toContain("未达成处刑");
    expect(html).toContain("class-trial-vote-burst-no-exile");
    expect(html).not.toContain("class-trial-seat-vote-focus");
  });
```

- [ ] **Step 2: Run the table test and verify the current state**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts -t "no-exile vote reveal"
```

Expected after Tasks 1 and 2: PASS.

- [ ] **Step 3: Commit the integration guard**

```powershell
git add src/components/game/classTrialGameTable.test.ts
git commit -m "test: cover class trial no-exile reveal"
```

---

### Task 4: Add CSS Burst Motion And Reduced-Motion Fallback

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/components/game/classTrialVoteStage.test.ts`

- [ ] **Step 1: Add CSS hook expectations to the component tests**

In the sealed-progress test, add:

```ts
    expect(html).toContain("class-trial-vote-burst-copy");
    expect(html).toContain("class-trial-vote-burst-slice");
```

In the revealed vote tally test, add:

```ts
    expect(html).toContain("class-trial-vote-burst-target");
```

- [ ] **Step 2: Run tests and confirm hooks already pass after Task 2**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts -t "lock progress|revealed vote tally"
```

Expected: PASS. These tests protect the DOM hooks before CSS is added.

- [ ] **Step 3: Add stage layering and scanline CSS**

In `src/app/globals.css`, within the existing class-trial vote CSS section, add:

```css
.class-trial-vote-stage::before,
.class-trial-vote-stage::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
}

.class-trial-vote-stage::before {
  z-index: 0;
  background:
    linear-gradient(115deg, transparent 0 42%, rgba(240, 75, 103, 0.16) 44% 48%, transparent 50%),
    repeating-linear-gradient(0deg, rgba(255, 242, 190, 0.08) 0 1px, transparent 1px 5px);
  mix-blend-mode: screen;
  opacity: 0.28;
  animation: class-trial-vote-scanline 2600ms linear infinite;
}

.class-trial-vote-stage::after {
  z-index: 0;
  background: radial-gradient(circle at 50% 50%, rgba(216, 195, 109, 0.18), transparent 58%);
  opacity: 0.34;
  animation: class-trial-vote-pressure-pulse 2200ms ease-in-out infinite;
}

.class-trial-vote-stage-header,
.class-trial-vote-body {
  position: relative;
  z-index: 2;
}
```

- [ ] **Step 4: Add burst overlay CSS**

Add:

```css
.class-trial-vote-burst-overlay {
  position: absolute;
  inset: -1px;
  z-index: 3;
  display: grid;
  place-items: center;
  overflow: hidden;
  pointer-events: none;
  background:
    linear-gradient(105deg, rgba(150, 13, 29, 0.96) 0 48%, rgba(10, 10, 14, 0.98) 49% 100%),
    repeating-linear-gradient(-12deg, rgba(255, 242, 190, 0.16) 0 2px, transparent 2px 9px);
  animation: class-trial-vote-burst-flash 980ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.class-trial-vote-burst-exile {
  background:
    linear-gradient(105deg, rgba(185, 12, 34, 0.98) 0 52%, rgba(8, 8, 12, 0.98) 53% 100%),
    repeating-linear-gradient(-12deg, rgba(255, 242, 190, 0.18) 0 2px, transparent 2px 9px);
}

.class-trial-vote-burst-no-exile {
  background:
    linear-gradient(105deg, rgba(80, 14, 28, 0.98) 0 52%, rgba(16, 16, 22, 0.98) 53% 100%),
    repeating-linear-gradient(-12deg, rgba(255, 242, 190, 0.14) 0 2px, transparent 2px 9px);
}

.class-trial-vote-burst-slice {
  position: absolute;
  inset: -18% -24%;
  background:
    linear-gradient(112deg, transparent 0 36%, rgba(255, 242, 190, 0.92) 37% 39%, transparent 40% 56%, rgba(240, 75, 103, 0.78) 57% 61%, transparent 62%),
    repeating-linear-gradient(90deg, transparent 0 18px, rgba(0, 0, 0, 0.24) 18px 22px);
  transform: translateX(-18%) skewX(-12deg);
  animation: class-trial-vote-burst-slice 980ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.class-trial-vote-burst-copy {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.24rem;
  padding: 0.9rem 1.2rem;
  color: #fff2be;
  text-align: center;
  text-shadow: 0 0 18px rgba(0, 0, 0, 0.72), 0 0 28px rgba(240, 75, 103, 0.44);
  transform: rotate(-2deg);
  animation: class-trial-vote-burst-copy 980ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.class-trial-vote-burst-copy strong {
  font-size: clamp(2rem, 8vw, 5rem);
  font-weight: 1000;
  line-height: 0.9;
}

.class-trial-vote-burst-copy span {
  font-size: clamp(0.78rem, 2.6vw, 1.25rem);
  font-weight: 950;
}

.class-trial-vote-burst-target {
  padding: 0.18rem 0.55rem;
  color: #26070c;
  background: #fff2be;
  box-shadow: 0 0 0 3px rgba(240, 75, 103, 0.5);
}
```

- [ ] **Step 5: Add locked-token stamp CSS**

Update `.class-trial-vote-seat-token` by adding these properties to the existing rule:

```css
  position: relative;
  overflow: hidden;
```

Then add:

```css
.class-trial-vote-seat-token-locked::after {
  position: absolute;
  right: 0.28rem;
  bottom: 0.24rem;
  padding: 0.05rem 0.18rem;
  color: rgba(216, 195, 109, 0.72);
  font-size: 0.52rem;
  font-weight: 1000;
  letter-spacing: 0.04em;
  border: 1px solid rgba(216, 195, 109, 0.42);
  transform: rotate(-10deg);
  content: "LOCK";
  animation: class-trial-vote-token-stamp 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

- [ ] **Step 6: Add keyframes and reduced-motion rules**

Add the keyframes near the existing class-trial keyframes:

```css
@keyframes class-trial-vote-scanline {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 64px 0, 0 28px;
  }
}

@keyframes class-trial-vote-pressure-pulse {
  0%,
  100% {
    opacity: 0.18;
    transform: scale(0.98);
  }
  50% {
    opacity: 0.42;
    transform: scale(1.02);
  }
}

@keyframes class-trial-vote-burst-flash {
  0% {
    opacity: 0;
    transform: scale(1.08) skewX(-8deg);
  }
  12%,
  76% {
    opacity: 1;
    transform: scale(1) skewX(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(0.98) skewX(6deg);
  }
}

@keyframes class-trial-vote-burst-slice {
  0% {
    opacity: 0;
    transform: translateX(-28%) skewX(-16deg);
  }
  22% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(24%) skewX(-16deg);
  }
}

@keyframes class-trial-vote-burst-copy {
  0% {
    opacity: 0;
    transform: translateX(-1.4rem) rotate(-5deg) scale(1.18);
  }
  18%,
  70% {
    opacity: 1;
    transform: translateX(0) rotate(-2deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(1rem) rotate(1deg) scale(0.98);
  }
}

@keyframes class-trial-vote-token-stamp {
  from {
    opacity: 0;
    transform: scale(1.8) rotate(-18deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(-10deg);
  }
}
```

Inside the existing `@media (prefers-reduced-motion: reduce)` block, add these selectors to the animation-disabled group:

```css
  .class-trial-vote-stage::before,
  .class-trial-vote-stage::after,
  .class-trial-vote-burst-overlay,
  .class-trial-vote-burst-slice,
  .class-trial-vote-burst-copy,
  .class-trial-vote-seat-token-locked::after {
    animation: none;
  }

  .class-trial-vote-burst-overlay {
    opacity: 0;
  }
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts
```

Expected: PASS. CSS changes do not affect server-rendered HTML, but this guards the DOM hooks and table integration.

- [ ] **Step 8: Commit CSS motion**

```powershell
git add src/app/globals.css src/components/game/classTrialVoteStage.test.ts
git commit -m "style: add class trial vote burst motion"
```

---

### Task 5: Add Task Card And State Updates

**Files:**
- Create: `docs/tasks/2026-05-class-trial-vote-burst-animation.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Create the task card**

Create `docs/tasks/2026-05-class-trial-vote-burst-animation.md` with:

```md
# 学级裁判投票爆发演出

## Task

Short name: class-trial-vote-burst-animation

Goal: Add a local-only class-trial vote burst animation layer for vote start and vote reveal while keeping sealed vote privacy and the existing readable tally/ledger layout.

Why it matters: The current vote visualization is readable but still too flat for the desired弹丸式审判演出. This slice adds impact at the two important moments without making sealed information leak or turning the whole vote phase into noise.

## Task Gate

Task type: Frontend/UI

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> reach sealed DAY_VOTE -> confirm TRIAL VOTE burst, readable sealed progress, no target leak -> load revealed exile fixture -> confirm seat spotlight plus 开票揭示 -> load no-exile fixture -> confirm 未达成处刑.
- If skipped, reason:

State updates required:

- [x] feature_list.json
- [x] progress.md
- [x] session-handoff.md
- [x] Relevant docs/tasks/*.md
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: this is a local-only class-trial theme surface and does not touch /rooms or Public Alpha.
- Residual risk: future public/multiplayer vote animation requires separate room and release verification.

## Context To Read First

- docs/working-agreements.md
- docs/threads/frontend.md
- docs/tasks/2026-05-class-trial-vote-visualization.md
- docs/superpowers/specs/2026-05-31-class-trial-vote-burst-animation-design.md
- docs/superpowers/plans/2026-05-31-class-trial-vote-burst-animation.md

## Allowed Scope

Files or directories the agent may edit:

- src/components/game/ClassTrialVoteStage.tsx
- src/components/game/classTrialVoteStage.test.ts
- src/components/game/classTrialGameTable.test.ts
- src/app/globals.css
- docs/tasks/2026-05-class-trial-vote-burst-animation.md
- feature_list.json
- progress.md
- session-handoff.md

Files or directories the agent should not edit:

- .env
- generated caches
- local-assets/class-trial-pack/**
- src/game/engine.ts
- src/game/projection.ts
- src/components/game/VotePanels.tsx
- src/app/rooms/**
- src/server/roomService.ts
- Public Alpha deployment docs

## Definition Of Done

This task is complete when:

- Sealed DAY_VOTE renders a short TRIAL VOTE / 封票开始 burst overlay.
- Sealed常态 remains readable with low-frequency scanline/pulse pressure.
- Sealed state still renders no vote target, tally, ledger, trend, arrow, or vote reason.
- Revealed unique-leader state renders a burst overlay with the public leading target and 开票揭示.
- Revealed no-exile or tied state renders 未达成处刑 without focusing a seat.
- Reduced-motion users do not receive high-speed animations.
- Existing vote tally and ledger layout remains present and readable.
- Browser/manual verification confirms sealed, exile, and no-exile states.

## Verification

Required checks:

- npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts
- npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts
- npm run lint
- npx tsc --noEmit
- npm run build
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-burst-animation.md
- npm run harness:check
- git diff --check
- Browser/manual local flow.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added class-trial vote burst overlay.
- Added no-exile reveal presentation.
- Kept sealed vote targets hidden.

Changed files:
- src/components/game/ClassTrialVoteStage.tsx
- src/components/game/classTrialVoteStage.test.ts
- src/components/game/classTrialGameTable.test.ts
- src/app/globals.css
- docs/tasks/2026-05-class-trial-vote-burst-animation.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- Focused vote tests passed.
- Lint, typecheck, build, task-card, harness, diff checks passed.
- Browser local flow confirmed sealed, exile, and no-exile states.

Remaining risks:
- This is local-only class-trial UI work and does not cover rooms or production release.
- Browser automation cannot judge subjective animation taste; a human recording review may still tune timing.
```
```

- [ ] **Step 2: Update `feature_list.json`**

Add a new feature object after `class-trial-vote-visualization`:

```json
{
  "id": "class-trial-vote-burst-animation",
  "name": "Class Trial Vote Burst Animation",
  "description": "Add a local-only弹丸式 burst animation layer for class-trial vote start, exile reveal, and no-exile reveal while preserving sealed vote privacy and the existing tally layout.",
  "dependencies": [
    "class-trial-vote-visualization"
  ],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-05-31-class-trial-vote-burst-animation-design.md; docs/superpowers/plans/2026-05-31-class-trial-vote-burst-animation.md; docs/tasks/2026-05-class-trial-vote-burst-animation.md; src/components/game/ClassTrialVoteStage.tsx; src/components/game/classTrialVoteStage.test.ts; src/components/game/classTrialGameTable.test.ts; src/app/globals.css; focused vote tests passed; lint/type/build passed; harness/task-card/diff checks passed; browser local flow confirmed sealed burst, readable sealed progress without target leak, exile spotlight reveal, and no-exile reveal."
}
```

- [ ] **Step 3: Update `progress.md`**

At the top of `progress.md`, set:

```md
**Last Updated:** 2026-05-31 HH:mm Asia/Shanghai
**Session ID:** class trial vote burst animation
**Active Feature:** class-trial-vote-burst-animation - Class Trial Vote Burst Animation (done)
```

Add these bullets near the top of `### What's Done`:

```md
- [x] Added class-trial vote burst overlay for sealed vote start and revealed vote result states.
- [x] Added no-exile vote verdict handling so tied/no-target reveals show `未达成处刑` without focusing a seat.
- [x] Added CSS-only red/black slash burst, scanline/pulse pressure, and locked-seat stamp effects with reduced-motion fallback.
- [x] Browser verification confirmed sealed progress stays readable and does not expose vote targets.
```

- [ ] **Step 4: Update `session-handoff.md`**

At the top, replace the current objective bullets with:

```md
- Goal: Add burst-style visual impact to the local-only class-trial vote phase without changing vote privacy, layout, audio, rules, rooms, or Public Alpha.
- Current status: Done. Sealed vote has `TRIAL VOTE` / `封票开始` burst plus low-frequency pressure; unique revealed vote has public target spotlight plus `开票揭示`; tied/no-exile reveal has `未达成处刑`.
- Local note: This is CSS/React presentation only. No sound hooks, no room route changes, and no rule-engine vote changes were made.
```

Add a verification row:

```md
| Vote burst browser QA | `http://127.0.0.1:<port>` | passed | Confirmed sealed burst, readable sealed status with no target leak, public exile spotlight, and no-exile `未达成处刑`. |
```

- [ ] **Step 5: Run task-card gate**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-burst-animation.md
```

Expected: PASS.

- [ ] **Step 6: Commit state updates**

```powershell
git add docs/tasks/2026-05-class-trial-vote-burst-animation.md feature_list.json progress.md session-handoff.md
git commit -m "docs: record class trial vote burst animation"
```

---

### Task 6: Final Verification And Browser QA

**Files:**
- No code changes unless verification finds a defect.

- [ ] **Step 1: Run the focused vote test pack**

Run:

```powershell
npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the regression pack**

Run:

```powershell
npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint, typecheck, and build**

Run:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Expected: PASS. If build prints the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`, record it as existing warning.

- [ ] **Step 4: Run harness and whitespace checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-burst-animation.md
npm run harness:check
git diff --check
```

Expected: task-card and harness PASS. `git diff --check` may print LF/CRLF warnings only; record the exact result.

- [ ] **Step 5: Start or reuse a local dev server**

If port 3000 is in use, use a high port such as 51632:

```powershell
$port = 51632
$out = "tmp/class-trial-vote-burst-$port.out.log"
$err = "tmp/class-trial-vote-burst-$port.err.log"
Start-Process -WindowStyle Hidden -FilePath "npm" -ArgumentList @("run","dev","--","-p",$port) -RedirectStandardOutput $out -RedirectStandardError $err
```

Verify health:

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/" -TimeoutSec 10 | Select-Object StatusCode
```

Expected: `StatusCode` is 200.

- [ ] **Step 6: Browser-verify sealed state**

Use the in-app Browser. Navigate to the local app, select `学级裁判主题局`, open or fixture a `DAY_VOTE` class-trial game, and confirm:

- `TRIAL VOTE` and `封票开始` appear as a burst overlay at entry.
- `封票中` panel remains readable after the burst.
- `x / 9`, `已锁票`, and `等待中` are visible.
- There is no `->`, no target name from hidden votes, no vote reason, and no tally before reveal.

If browser automation stalls, use `domcontentloaded` or direct DOM snapshots instead of `networkidle`.

- [ ] **Step 7: Browser-verify unique revealed state**

Use a revealed fixture where one target is the sole leader and confirm:

- Public target seat/name flashes in the burst overlay.
- `开票揭示` appears.
- Existing tally rows and ledger rows are still readable.
- The leading seat has `class-trial-seat-vote-focus`.

- [ ] **Step 8: Browser-verify no-exile state**

Use a revealed fixture with tied leaders and confirm:

- `未达成处刑` appears.
- No seat receives `class-trial-seat-vote-focus`.
- Existing tally rows and ledger rows are still readable.

- [ ] **Step 9: Update evidence if browser results differ**

If browser verification finds copy/layout issues, fix the smallest relevant CSS or component issue, rerun focused tests, and repeat browser verification for the affected state.

- [ ] **Step 10: Final git review**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only this task's files plus pre-existing unrelated dirty files are listed. Do not stage unrelated pre-existing changes.

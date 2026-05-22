# Mobile Table UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the mobile-only game table feel with avatar action feedback, seat speech filtering, drawer signals, shorter mobile action surfaces, and a light phase transition signal.

**Architecture:** Keep all new behavior local to the mobile table. Pure derivation helpers live in `mobileTableModel.ts`; React state and rendering stay in `MobileGameTable.tsx`; visual treatment is mobile-only CSS inside `@media (max-width: 639px)`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, server-side static markup component tests.

---

## File Structure

- Modify `src/components/game/mobileTableModel.ts`
  - Add pure helpers for speech filtering, drawer snapshot derivation, recommended drawer, and phase signal tone.
- Modify `src/components/game/mobileTableModel.test.ts`
  - Add RED/GREEN tests for the helper behavior.
- Modify `src/components/game/MobileGameTable.tsx`
  - Add local UI state for selected speech seat, pending avatar feedback, seen drawer markers, and phase signal.
  - Pass derived drawer models to the dock and speech filter state to the drawer.
  - Keep avatar action taps from also opening speech filtering.
- Modify `src/components/game/mobileGameTable.test.ts`
  - Add static-render tests for new classes, badges, and filtered drawer markup where possible.
- Modify `src/app/globals.css`
  - Add mobile-only classes for feedback strip, selected avatar glow, drawer dot/meta/recommended state, speech filter chip, and phase signal.

## Task 1: Mobile Model Helpers

**Files:**
- Modify: `src/components/game/mobileTableModel.ts`
- Test: `src/components/game/mobileTableModel.test.ts`

- [ ] **Step 1: Write failing tests for drawer snapshot, recommendation, speech filtering, and phase tone**

Add tests like:

```ts
describe("getMobileDrawerSnapshot", () => {
  it("summarizes speech, vote, and log activity", () => {
    const game = buildGame({
      phase: "DAY_VOTE",
      tableSummary: {
        ...buildGame().tableSummary,
        recentSpeeches: [speechOne, speechTwo],
        voteSnapshot: { entries: [], pendingSeatIds: [], votes: [{ seq: 7, voter: { seatId: 1, name: "You" }, target: { seatId: 2, name: "DeepSeek" } }] } as any,
      },
      publicEvents: [{ seq: 9, day: 1, phase: "DAY_VOTE", message: "Vote locked" }],
    });

    expect(getMobileDrawerSnapshot(game, game.publicEvents)).toMatchObject({
      latestSpeechSeq: 2,
      latestSpeechSeatId: 4,
      latestSpeechLabel: "4号 GPT",
      voteMarker: 1,
      logMarker: 9,
      recommendedTab: "vote",
    });
  });
});

describe("getMobileFilteredSpeeches", () => {
  it("keeps only speeches from the selected seat", () => {
    expect(getMobileFilteredSpeeches([speechOne, speechTwo, speechThree], 5)).toEqual([speechThree]);
  });
});

describe("getMobilePhaseSignalTone", () => {
  it("maps mobile phase labels to signal tones", () => {
    expect(getMobilePhaseSignalTone("NIGHT_SEER" as any)).toBe("night");
    expect(getMobilePhaseSignalTone("DAY_VOTE" as any)).toBe("vote");
    expect(getMobilePhaseSignalTone("LAST_WORDS" as any)).toBe("danger");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/components/game/mobileTableModel.test.ts`

Expected: FAIL because `getMobileDrawerSnapshot`, `getMobileFilteredSpeeches`, and `getMobilePhaseSignalTone` are not exported.

- [ ] **Step 3: Implement the pure helpers**

Add exports shaped like:

```ts
export type MobileDrawerSeenState = {
  latestSpeechSeq: number;
  voteMarker: number;
  logMarker: number;
};

export type MobileDrawerSnapshot = MobileDrawerSeenState & {
  latestSpeechSeatId?: number;
  latestSpeechLabel?: string;
  recommendedTab: MobileInfoTabKey;
};

export function getMobileFilteredSpeeches(
  speeches: HumanGameView["tableSummary"]["recentSpeeches"],
  selectedSeatId: number | null,
): HumanGameView["tableSummary"]["recentSpeeches"] {
  if (!selectedSeatId) return speeches;
  return speeches.filter((speech) => speech.speaker?.seatId === selectedSeatId);
}
```

`getMobileDrawerSnapshot(game, events)` should derive markers from existing props only. `getMobilePhaseSignalTone(phase)` should return `"night" | "day" | "vote" | "danger" | "end"`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- src/components/game/mobileTableModel.test.ts`

Expected: PASS.

## Task 2: Drawer Signals And Seat Speech Filter UI

**Files:**
- Modify: `src/components/game/MobileGameTable.tsx`
- Test: `src/components/game/mobileGameTable.test.ts`

- [ ] **Step 1: Write failing static markup tests**

Add tests that expect:

```ts
expect(html).toContain("mobile-drawer-tab-recommended");
expect(html).toContain("mobile-drawer-tab-dot");
expect(html).toContain("mobile-drawer-tab-meta");
```

Add one drawer-rendering case that passes an active speech drawer path and expects:

```ts
expect(html).toContain("mobile-speech-filter-chip");
expect(html).toContain("mobile-speech-filter-clear");
expect(html).toContain("mobile-empty-speech-filter");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/components/game/mobileGameTable.test.ts`

Expected: FAIL because the classes do not exist yet.

- [ ] **Step 3: Implement drawer signal rendering**

In `MobileGameTable.tsx`:

- import `useEffect`, `useMemo`, and the new model helpers.
- compute `drawerSnapshot`.
- keep `seenDrawerState` in local state initialized from `drawerSnapshot`.
- mark a tab as seen when it is opened.
- pass derived tab models to `MobileDrawerDock`.

`MobileDrawerDock` should render each button with:

```tsx
<span className="mobile-drawer-tab-label">{tab.label}</span>
{tab.meta && <span className="mobile-drawer-tab-meta">{tab.meta}</span>}
{tab.hasDot && <span className="mobile-drawer-tab-dot" aria-hidden="true" />}
```

- [ ] **Step 4: Implement speech filter rendering**

Add `selectedSpeechSeatId` state in `MobileGameTable`. Pass it to `MobileInfoDrawer`, and filter the mobile drawer speech feed with `getMobileFilteredSpeeches`.

Inside the speech drawer render:

```tsx
{selectedSpeechSeat && (
  <div className="mobile-speech-filter-chip">
    <span>{seatNumber(selectedSpeechSeat)} {selectedSpeechSeat.name}</span>
    <button type="button" className="mobile-speech-filter-clear" onClick={onClearSpeechSeatFilter}>全部</button>
  </div>
)}
```

If filtered speeches are empty, render `mobile-empty-speech-filter`.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test -- src/components/game/mobileGameTable.test.ts`

Expected: PASS.

## Task 3: Avatar Action Feedback And Phase Signal

**Files:**
- Modify: `src/components/game/MobileGameTable.tsx`
- Test: `src/components/game/mobileGameTable.test.ts`

- [ ] **Step 1: Write failing static markup tests for initial feedback surfaces**

Add tests that render actionable seats and expect the new affordance classes to be present:

```ts
expect(html).toContain("mobile-seat-action-feedback-source");
expect(html).toContain("mobile-seat-open-speech");
```

Add a phase-signal test expecting:

```ts
expect(html).toContain("mobile-phase-signal");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/components/game/mobileGameTable.test.ts`

Expected: FAIL because the classes do not exist yet.

- [ ] **Step 3: Implement avatar feedback state**

Add local state:

```ts
type MobileSeatFeedback = {
  seatId: number;
  seatName: string;
  actionLabel: string;
  commandType: CommandPayload["type"];
};
```

When an avatar action button is clicked:

1. call `setSeatFeedback(...)`.
2. call `onSubmit(payload)`.
3. keep the feedback visible while `loading` or `pendingCommandType` matches.
4. clear it after a timeout or when phase/game id changes.

- [ ] **Step 4: Implement non-action seat tap speech filter**

Wrap or buttonize non-action seat cards so tapping a seat with no avatar action:

```ts
setSelectedSpeechSeatId(seat.seatId);
setActiveTab("speech");
```

Do not trigger this path from avatar action buttons; keep `event.stopPropagation()` on action buttons.

- [ ] **Step 5: Implement mobile phase signal**

Track the previous phase label. On phase label changes, render:

```tsx
<div className={`mobile-phase-signal mobile-phase-signal-${tone}`} role="status">
  <span>{game.phaseLabel}</span>
</div>
```

Use `getMobilePhaseSignalTone(game.phase)`.

- [ ] **Step 6: Run tests to verify pass**

Run: `npm run test -- src/components/game/mobileGameTable.test.ts`

Expected: PASS.

## Task 4: Mobile-Only CSS And Verification

**Files:**
- Modify: `src/app/globals.css`
- Test: no direct CSS unit test; verify through build/typecheck and browser.

- [ ] **Step 1: Add mobile-only CSS**

Inside `@media (max-width: 639px)` add styles for:

- `.mobile-seat-feedback-strip`
- `.mobile-seat-token-selected`
- `.mobile-seat-action-feedback-source`
- `.mobile-seat-open-speech`
- `.mobile-drawer-tab-recommended`
- `.mobile-drawer-tab-dot`
- `.mobile-drawer-tab-meta`
- `.mobile-speech-filter-chip`
- `.mobile-speech-filter-clear`
- `.mobile-empty-speech-filter`
- `.mobile-phase-signal`

- [ ] **Step 2: Run targeted tests**

Run: `npm run test -- src/components/game/mobileTableModel.test.ts src/components/game/mobileGameTable.test.ts`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Run browser verification**

Start or reuse a local dev server, open a mobile viewport, and verify:

- avatar actions show selected feedback;
- tapping a non-action seat opens the speech drawer filtered to that player;
- drawer tabs show recommended/dot/meta states;
- phase signal appears without blocking play.

Record any limitation if a full manual playthrough is blocked by existing unrelated worktree state.

## Self-Review

- Spec coverage: all five approved requirements are covered; speech keywords and current-round summary are explicitly absent.
- Placeholder scan: no planned step contains TBD/TODO/fill-in instructions.
- Type consistency: helper names and state names are repeated consistently across tasks.

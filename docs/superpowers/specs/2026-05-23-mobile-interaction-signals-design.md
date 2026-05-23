# Mobile Interaction Signals Design

Date: 2026-05-23

## Scope

This spec covers the next mobile-only polish pass for the in-game table:

- avatar action feedback after tapping a seat;
- bottom drawer recommendation, unread, and activity signals;
- speech drawer seat filtering feedback.

The change should stay within the mobile table surface:

- `src/components/game/MobileGameTable.tsx`
- `src/components/game/MobileInfoDrawer.tsx`
- `src/components/game/MobileSeatStage.tsx`
- `src/components/game/mobileTableModel.ts`
- mobile-focused tests beside those files
- mobile-only CSS in `src/app/globals.css`

Desktop UI, rules engine behavior, API contracts, AI decisions, speech keyword extraction, round summaries, night-flow copy, and phase-transition changes are out of scope for this pass.

## Goals

1. Make seat-target actions feel immediately confirmed on phone screens.
2. Make the bottom drawer dock communicate where the player should look next.
3. Make speech filtering after tapping a seat obvious and reversible.
4. Keep all signals derived from existing client state and local UI state.

## Non-Goals

- No speech keyword labels.
- No "current round key information" summary.
- No backend speech analysis.
- No desktop layout changes.
- No new game-state or command payload fields.
- No broad phase curtain or night action rewrite in this pass.

## Recommended Approach

Use a conservative mobile UI pass that builds on the existing implementation instead of replacing it.

The current code already has:

- `seatFeedback` in `MobileGameTable`;
- `MobileSeatFeedbackStrip`;
- selected-seat highlighting in `MobileSeatStage`;
- drawer snapshots and seen state in `mobileTableModel`;
- speech drawer filtering by selected seat.

This pass should make those existing pieces more readable and more game-like:

- strengthen the selected seat highlight and feedback strip;
- expose clearer drawer activity labels and unread dots;
- show an active speech-filter chip and empty state with more deliberate visual hierarchy.

## Interaction Design

### Avatar Action Feedback

When the player taps a target on the mobile table, the UI should immediately show a lightweight confirmation:

- the tapped avatar gets a short selected/glow state;
- the feedback strip says the equivalent of `已选择 5号 豆包 · 查验中` while the command is pending;
- after the command settles, the strip remains briefly and then fades;
- disabled/loading state should prevent repeated taps from looking like multiple separate choices.

This feedback is local UI only. It does not confirm that the server accepted the command until the next game state arrives.

### Bottom Drawer Dock Signals

The drawer dock keeps the four existing tabs: `身份`, `发言`, `票型`, `记录`.

Each tab may show:

- a recommended style when it is the most useful tab for the current phase;
- a small unread dot when relevant data changed after the player last viewed that tab;
- a compact activity label, such as the latest speaker for `发言`, current vote marker for `票型`, or event count for `记录`.

The dock should not force-open any drawer. It only nudges.

### Speech Seat Filter

Tapping a non-action seat opens the speech drawer with that seat selected.

Inside the drawer:

- show a filter chip with `5号 豆包`;
- show a clear control to return to all speeches;
- show only that player's recent speeches while filtered;
- if there is no speech, show a quiet empty state rather than a broken-looking blank panel.

Avatar action taps keep priority over speech filtering. If a seat has a legal action, tapping the action should submit the action, not open the speech drawer.

## Data Flow

All state remains local to `MobileGameTable`:

- `seatFeedback` records the last tapped action target and command type;
- `selectedSpeechSeatId` controls drawer filtering;
- `seenDrawerState` records the last seen speech, vote, and log markers;
- `getMobileDrawerSnapshot` derives current activity from `game` and `events`.

No server field is added.

## Testing

Focused tests should cover pure derivation first:

- drawer recommendation by phase;
- speech latest-speaker activity label;
- vote/log markers and seen-state clearing;
- filtered speech list behavior.

Component/static-render tests should cover whichever markup is practical:

- action feedback classes or strip content after a local target action;
- speech filter chip and empty state;
- drawer tab dot/recommended classes.

Manual browser verification is required on a phone viewport before deployment because the value of this pass is visual feedback and touch feel.

Minimum verification after implementation:

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts src/components/game/mobileGameTable.test.ts
npx tsc --noEmit
npm run lint
```

If the implementation changes shared rendering or CSS enough to affect production output, also run:

```powershell
npm run build
```

## Rollout

After implementation and local verification:

1. Run mobile browser verification.
2. Commit the mobile UI changes.
3. Push the source branch.
4. Deploy to Render if the public mirror should update.
5. Deploy to Tencent Cloud if the primary Alpha should update.
6. Update `docs/current-release.md` with the new runtime baseline and smoke results.

# Mobile Table UX Polish Design

Date: 2026-05-22

## Scope

Only the mobile game table UI is in scope. The implementation should stay within:

- `src/components/game/MobileGameTable.tsx`
- `src/components/game/mobileTableModel.ts`
- mobile-focused tests beside those files
- mobile-only CSS under `@media (max-width: 639px)` in `src/app/globals.css`

Desktop panels, rules engine code, server/API code, AI behavior, and persistent game-state formats are out of scope.

## Goals

Improve mobile game feel without adding semantic guesses that can be wrong.

1. Make avatar-based actions feel confirmed.
2. Let tapping a seat quickly filter that player's speeches on mobile.
3. Make the bottom drawers feel more like an in-game control dock.
4. Keep night/action prompts shorter on mobile when avatar actions already carry the choice.
5. Add light phase-transition rhythm on mobile.

## Non-Goals

- No speech keyword labels.
- No "current round key information" summary.
- No backend-derived speech analysis.
- No desktop UI redesign.
- No rule or action-contract changes.

## Interaction Design

### Avatar Action Feedback

When the user taps a mobile avatar action such as kill, check, poison, vote, guard, charm, duel, handoff, or shoot:

- The tapped seat gets a short selected/highlight state.
- A compact top feedback strip appears with the selected seat and action label, such as `Selected seat 5 - Check`.
- The feedback remains visible while the command is loading and fades after the state advances.

This is local UI feedback only. It should not change command payloads or game rules.

### Seat Speech Filter

Tapping a non-action seat on the mobile table opens or switches to the speech drawer with that seat selected as a filter.

Inside the mobile speech drawer:

- Show a small filter chip for the selected seat.
- Show only that seat's recent speeches while the filter is active.
- Provide a clear-all control.
- If the filtered seat has no recent speech, show a quiet empty state.

Avatar action taps should prioritize the action and not also open the speech drawer.

### Bottom Drawer Dock

The four mobile drawers remain `identity`, `speech`, `vote`, and `log`.

Mobile-only dock behavior:

- Highlight the most useful drawer for the current phase without forcibly opening it.
- Show speech activity on the speech tab, such as the latest speaker or a compact unread count.
- Show a small dot on vote/log tabs when their underlying data changed since the drawer was last viewed.

This should be derived from existing `game` props and local component state.

### Mobile Action Copy

For mobile compact action surfaces:

- Prefer short labels and direct buttons.
- Hide verbose guidance when the same choice can be made by tapping an avatar.
- Preserve necessary mixed-action controls, especially witch save/skip controls.

### Phase Rhythm

Mobile phase transitions should reuse the existing lightweight phase signal/curtain visual language:

- Show a short overlay or top signal when the phase label changes.
- Keep it non-blocking and brief.
- Avoid large modal interruptions.

## Data Flow

All new state should remain local to the mobile table:

- `selectedSpeechSeatId`
- `pendingSeatFeedback`
- per-tab seen counters or sequence markers
- previous phase label for transition signal

No new server fields are required.

## Testing

Add or update focused tests for:

- Seat speech filtering markup/state derivation.
- Mobile drawer dock badges and phase recommendations.
- Avatar action feedback markup after local selection where practical.
- Existing avatar action behavior still does not render the middle action panel for avatar-only actions.

Run at least:

- `npm run test -- src/components/game/mobileTableModel.test.ts src/components/game/mobileGameTable.test.ts`
- `npx tsc --noEmit`

Manual mobile browser verification is expected after implementation.

# Mobile Werewolf Table Design

## Context

The current mobile in-game page inherits the desktop panel stack. On a phone, the player sees phase rhythm, host stage, status, seat board, action panel, vote table, speech feed, and auxiliary panels as a long vertical stream. This makes the game feel crowded and forces repeated scrolling just to understand the current phase or complete an action.

The target direction is closer to a native mobile Werewolf app: the table is the persistent stage, the current action is always reachable at the bottom, and long supporting information is opened on demand.

## Goals

- Let a phone player complete the current phase action from the first viewport whenever practical.
- Keep the table, current phase, current actor or speaker, and available action visible without searching through stacked cards.
- Move speech history, vote state, private info, notes, and public log behind compact tabs, sheets, or focused overlays.
- Preserve existing desktop layout and existing game behavior.
- Keep implementation in the frontend thread scope: `src/components/**` and `src/app/globals.css`.

## Non-Goals

- Do not change game rules, API payloads, AI decisions, speech generation, room storage, or persistence format.
- Do not redesign the landing page or multiplayer room lobby in this pass.
- Do not remove existing desktop panels; adapt the mobile presentation separately.
- Do not require native mobile packaging, PWA work, accounts, or push notifications.

## Selected Direction

Use a mobile-only table shell, tentatively named `MobileGameTable`, rendered for small screens while desktop keeps the current `PhaseRhythm`, `HostStage`, `FlowStatusBar`, `SeatBoard`, `ActionPanel`, `VoteTable`, and `AuxiliaryInfoPanel` composition.

The mobile shell has four layers:

1. Top status strip
   - Shows day, phase label, alive/dead counts, and whether the player needs to act.
   - Replaces the separate mobile need for `PhaseRhythm`, `HostStage`, and `FlowStatusBar` in the first viewport.

2. Fixed table stage
   - Shows seats around a compact round-table layout.
   - Shows the current actor or speaker clearly in the center.
   - Each seat remains tappable in future iterations, but this pass can start with visual status only.

3. Bottom action sheet
   - Stays reachable at the bottom of the viewport.
   - Contains the current action controls, target buttons, speak textarea, continue/skip button, or game-over buttons.
   - Can expand for longer controls, but its collapsed state must still show what the user should do next.

4. Bottom information tabs
   - Tabs: `身份`, `发言`, `票型`, `记录`.
   - These replace always-visible mobile `VoteTable` and `AuxiliaryInfoPanel`.
   - Each tab opens a compact sheet or inline panel above the action area.

## Information Priority

The mobile first viewport should answer these questions in order:

1. What phase is this?
2. Who is currently acting or speaking?
3. Am I required to act?
4. Which player can I choose, or can I skip/continue?
5. What is the latest speech or table event if I need context?

Everything else is secondary and should be one tap away, not permanently occupying vertical space.

## Component Shape

- Add a mobile-specific composition component under `src/components/game/`.
- Reuse existing view helpers, action metadata, `ActionPanel` subcontrols where sensible, and current `HumanGameView` props.
- Prefer extracting reusable compact pieces instead of copying entire panels.
- Keep `GameClient.tsx` as orchestration; it should choose desktop vs mobile composition and pass the same handlers.
- Add CSS classes in `src/app/globals.css` for fixed mobile viewport sizing, seat orbit positioning, bottom sheet layering, safe-area padding, and reduced-motion compatibility.

## Responsive Rules

- Apply the mobile table shell at phone widths, likely `max-width: 640px`.
- Avoid viewport-width font scaling.
- Use fixed responsive zones: top strip, table stage, tab rail, bottom sheet.
- Avoid nested cards and long always-open panels on mobile.
- Keep buttons at touch-friendly sizes, but compress labels where needed.
- Prevent text overlap by truncating seat metadata and moving details into sheets.

## Acceptance Criteria

- On a 390px-wide mobile viewport, a started game first viewport shows phase, seat table, current action, and available primary controls without needing to scroll.
- During night action, day speech, day vote, auto-continue, and game-over states, the main next action remains visible or one bottom-sheet expansion away.
- Speech feed, vote table, private info, notes, and public log are still accessible on mobile.
- Desktop layout remains visually and structurally unchanged.
- The mobile page no longer presents the in-game experience as a long uninterrupted stack of large cards.
- Validation includes typecheck/lint and manual browser screenshots for at least one mobile started-game state.

## Suggested Verification

- `npx tsc --noEmit`
- `npm run lint`
- Browser verification at a 390px viewport:
  - new game / role intro dismissed
  - night action
  - day speech or auto speech playback
  - vote phase if reachable
  - game-over or review accessibility if reachable

## Open Implementation Notes

- If the existing `ActionPanel` is too tall on mobile, split its internal controls into compact mobile subcomponents rather than styling the full panel down.
- The first implementation can support visual seat taps later; tap-to-open seat detail is useful but not required to solve the crowding issue.
- The bottom information tabs should be local UI state only and should not alter game state.

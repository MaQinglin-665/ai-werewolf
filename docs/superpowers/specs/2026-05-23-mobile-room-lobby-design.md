# Mobile Room Lobby Design

Date: 2026-05-23

## Scope

This spec covers a phone-first polish pass for the online room lobby before the game starts.

In scope:

- the `/rooms` lobby view after a player has created or joined a room;
- mobile layout for room status, seat selection, player presence, invite/recovery actions, and host start controls;
- focused tests for any pure mobile lobby helpers or static-rendered lobby markup;
- mobile-only CSS in `src/app/globals.css`.

Out of scope:

- room API, SSE, storage, presence, rate limiting, or deployment changes;
- rules engine, AI behavior, game state contracts, and command payloads;
- the already-started in-game mobile table, except for preserving its existing handoff from the room shell;
- desktop room layout redesign.

## Goals

1. Make the mobile room lobby feel like players have entered a Werewolf table, not a form page.
2. Keep first-time friend-testers oriented with visible room code, room status, online count, and their own seat.
3. Make the main actions easy to reach: invite, refresh, change seat, view players, copy recovery links, and start the game.
4. Preserve existing room behavior and desktop behavior.

## Non-Goals

- No new account system.
- No new invite permission model.
- No change to host authority, seat ownership, or removal rules.
- No analytics or telemetry in this pass.
- No production deployment work in the implementation plan unless explicitly requested later.

## Recommended Approach

Use the approved B+A hybrid direction:

- B: a mobile table-stage lobby as the main visual, with circular seat positions and a center status seal;
- A: a clear status header and fixed bottom action dock so users do not have to interpret the visual stage alone.

This should be implemented as a conservative mobile-only composition rather than a rewrite of `RoomClient`.

The implementation shape is:

- keep `RoomClient.tsx` as the room orchestration layer;
- add `src/components/rooms/MobileRoomLobby.tsx` for the room-specific mobile lobby;
- add `src/components/rooms/mobileRoomLobbyModel.ts` for seat ids, density classes, status copy, and accessible labels;
- base the mobile room seat positions on the existing `LandingLobbyControls.tsx` 6/9/12-seat geometry, without importing the landing component into the room component;
- render the mobile lobby only below the phone breakpoint and keep the existing desktop lobby intact.

## Interaction Design

### Mobile Header

The first viewport should start with a compact room status header:

- room code, such as `房间 M7Q2K9`;
- board name and room status, such as `9 人标准局 · 选座中`;
- human count and online count;
- a visible invite action.

Long board names, room codes, or status copy must truncate or wrap cleanly without causing horizontal overflow.

### Table Stage

The central lobby area should use an oval/circular table stage:

- all seats for the selected board are visible on phone widths for 6, 9, and 12 player boards;
- occupied seats show player name or compact identity, with host and self states visually distinct;
- empty seats are clearly tappable when the player can move into them;
- the current player's seat is highlighted in green;
- the host seat is marked without crowding the stage;
- disconnected or offline players get a subtle warning state when that data is available.

The center seal should summarize occupancy, for example `3 / 9 已入座`, and the current waiting state.

### Seat Actions

On mobile:

- tapping an empty seat should call the existing seat-change handler;
- tapping the player's own occupied seat should not cause an accidental leave unless an explicit leave-seat control is shown elsewhere;
- unavailable occupied seats should look occupied and not invite tapping;
- disabled/loading states should keep the stage visually stable while a seat request is pending.

The existing `SeatPicker` forms can remain for desktop and for the pre-room create/join panel. The joined-room mobile lobby should prefer direct stage seat tapping.

### Bottom Action Dock

Below the table stage, use a compact action dock:

- primary status line: current seat state, such as `你在 2 号位` or `尚未入座`;
- secondary hint: one short sentence explaining the next step;
- small actions: `玩家`, `刷新`, and `恢复` or equivalent labels;
- host-only primary action: `开始游戏`;
- non-host users should see a waiting state instead of a disabled host-only control.

The dock should respect safe-area bottom padding and avoid being hidden behind mobile browser chrome.

### Player Drawer

Move secondary lobby details into a mobile player drawer:

- player list with seat number, name, host marker, and online/offline state;
- host-only remove action;
- recovery-link copy actions where the current room rules allow them;
- a clear empty/unseated state.

This keeps the first viewport focused on table state and the next action while preserving the room management tools.

### Started Game Handoff

When the room status moves to `in_game`, the existing started-game mobile table should remain the main game surface.

The room shell may keep a compact room code/online strip, but it should not reintroduce the old desktop-like stacked layout on phone widths.

## Data Flow

No server fields are required.

The mobile lobby should derive all display state from the existing `RoomView`:

- `room.board` for seat count, board name, and role summary;
- `room.seats` for occupied/open seat state;
- `room.players` for player names, host state, online state, and recovery actions;
- `room.status` for lobby versus in-game handoff;
- `playerId` and `playerSeatId` for the self marker;
- the existing pending state for disabled/loading visuals.

Any new UI state should remain local to the mobile lobby component, for example:

- whether the player drawer is open;
- the latest tapped seat while a seat request is pending;
- compact feedback text after a seat change is requested.

## Accessibility And Responsiveness

- Seat buttons need accessible labels such as `选择 3 号空位`, `2 号 你 当前座位`, or `5 号 小明 已占用`.
- Touch targets should be large enough for phone use, including dense 12-player layouts.
- Text must not overflow its container on 360-390px widths.
- The layout must not create horizontal scrolling.
- Reduced-motion preferences should disable any new seat pulse or transition animation.

## Testing

Use TDD during implementation.

Focused tests should cover:

- mobile lobby seat id and density derivation for 6, 9, and 12 seats if helpers are extracted or added;
- static markup for mobile lobby header, stage, self seat, empty seat, host marker, and action dock;
- host versus non-host mobile actions;
- disabled/loading state for seat changes;
- preservation of the existing desktop lobby markup and handlers.

Minimum verification after implementation:

```powershell
npm run test -- src/components/rooms/mobileRoomLobby.test.ts
npx tsc --noEmit
npm run lint
```

If the implementation touches `RoomClient.tsx` enough to affect shared rendering, also run:

```powershell
npm run test -- src/app/api/rooms/api.test.ts
npm run build
```

Manual browser verification is required on a phone viewport, ideally 390px wide:

- create a room;
- confirm the mobile lobby shows header, table stage, self seat, invite, refresh, player drawer, and host start action;
- join or simulate a second player where feasible;
- change seats by tapping an empty seat;
- start the game and confirm the existing mobile game table appears.

## Rollout

This is a local frontend polish pass by default.

After implementation:

1. Commit the mobile lobby UI changes.
2. Run local mobile browser verification.
3. Push and deploy only if the user asks to update the public Alpha.

## Design Decision

The approved product direction is B+A: table-stage visual with clear status and controls.

Room lobby code should live under `src/components/rooms/` so future room work is easy to find and does not couple multiplayer lobby behavior to the single-player landing page.

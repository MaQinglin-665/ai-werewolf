# Anonymous Room Flow Observability Design

## Goal

During the waiting period for real mobile playtests, add a narrow anonymous observability layer that helps identify where public Alpha room flows stall.

The feature should answer:

- Did players reach `/rooms`?
- Did a room get created?
- Did another player join?
- Did the room start?
- Did the room reach speech?
- Did the room reach voting?
- Did voting resolve?
- Did a refresh/session restore succeed?

This is not a tutorial system, account system, user tracking system, or gameplay analytics product.

## Current Context

The repo already has an owner-only metrics path:

- event writer: `recordRoomAnalyticsEvent` in `src/server/roomAnalytics.ts`
- existing room events: `room_created`, `player_joined`, `room_started`, `room_finished`
- existing public home event: `home_view`
- owner JSON endpoint: `/api/rooms/metrics?token=...`
- owner dashboard: `/admin/metrics?token=...`

Render can act as the shared historical analytics dashboard, and Tencent Cloud can write into the same analytics database through `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL`.

## Non-Goals

- No accounts.
- No user profiles.
- No IP, user-agent, browser fingerprint, or device fingerprint storage.
- No player names, room invite tokens, recovery tokens, API keys, or model prompts in analytics payloads.
- No public analytics page.
- No cross-server live room federation.
- No per-player behavioral timeline.
- No rule coaching or new player education.

## Data Model

Extend the existing analytics event type with these anonymous room-flow milestones:

- `room_page_view`: browser opened the room entry page.
- `room_recovery_restored`: a stored or URL recovery session successfully restored a room view.
- `room_speech_reached`: a room reached a human-visible day speech phase.
- `room_vote_reached`: a room reached a day voting phase.
- `room_vote_resolved`: a room completed at least one vote into the next phase.

Existing events remain the source for:

- `room_created`
- `player_joined`
- `room_started`
- `room_finished`

For milestone events, store only:

- `eventType`
- `roomId` when the event is tied to a room
- `roomCode` only where existing room analytics already uses it
- `occurredAt`
- a small payload such as `{ "phase": "DAY_VOTE" }` or `{ "source": "stored-session" }`

Do not store player names, tokens, raw commands, or free-form text.

## Event Capture

Client-side capture:

- `room_page_view` is sent from the `/rooms` client using the existing beacon-style analytics pattern.
- `room_recovery_restored` is sent after `RoomClient` successfully restores a stored session or URL recovery session.

Server-side capture:

- Keep the existing create/join/start/finish writes in room service.
- Add phase milestone writes when a room game first reaches speech, vote, or vote resolution.
- Milestone writes may be emitted more than once; aggregation should count distinct rooms for milestone totals so retries and refreshes do not inflate the owner summary.

Failure handling:

- Analytics write failures must never block room creation, joining, starting, commands, recovery, or rendering.
- Server warnings should stay concise and never include credentials or sensitive payloads.

## Owner Summary

Extend the existing private metrics summary instead of adding a new dashboard.

The owner dashboard should show a compact "room flow funnel":

1. Room page opens.
2. Rooms created.
3. Players joined.
4. Rooms started.
5. Rooms reached speech.
6. Rooms reached vote.
7. Votes resolved.
8. Rooms finished.
9. Recoveries restored.

The dashboard copy should keep the current distinction:

- historical analytics can be shared across Render and Tencent Cloud when both write to the same analytics database;
- live room state is local to the currently serving deployment.

## Privacy Boundary

This feature is anonymous aggregate observability for public Alpha operations.

Allowed:

- random room ids already used by the server;
- event type;
- timestamp;
- coarse phase milestone;
- aggregate counters and recent-day counts.

Not allowed:

- player display names;
- player tokens or recovery links;
- raw chat, speeches, voice transcripts, prompts, model outputs, or commands;
- IP addresses;
- user-agent strings;
- browser fingerprints;
- exact click trails per user.

## Testing

Automated tests should cover:

- `roomAnalytics` accepts the new event types and summarizes funnel counts.
- Duplicate phase milestone events count as one room in the funnel where appropriate.
- The public analytics event route accepts `room_page_view` but rejects free-form or sensitive payloads.
- Room service create/join/start metrics still pass existing tests.
- A focused room-flow test verifies speech/vote/vote-resolved milestones are emitted without changing gameplay state.
- The admin metrics page renders the new funnel labels with mocked metrics.

Manual or smoke verification should cover:

- Local `/rooms` load records a page-view event.
- A create/join/start path increments the funnel.
- A smoke game that reaches voting increments speech/vote/vote-resolved.
- Production preflight and room smoke still pass after deployment.

## Rollout

1. Implement locally behind the existing analytics system.
2. Run focused analytics and room tests, then `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
3. Deploy to Tencent Cloud first because it is the primary public Alpha.
4. Deploy to Render mirror.
5. Verify both public URLs with preflight and room smoke.
6. Open the private metrics dashboard and confirm the funnel counters move after one controlled room smoke.

## Success Criteria

- Public Alpha players see no new required action.
- Gameplay and room flows continue to work if analytics writes fail.
- The owner can tell whether real playtests are stalling before create, before join, before start, before speech, before vote, or before vote resolution.
- No new personal data collection is introduced.

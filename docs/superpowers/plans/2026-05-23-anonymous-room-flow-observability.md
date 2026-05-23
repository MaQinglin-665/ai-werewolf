# Anonymous Room Flow Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task.

**Goal:** Add anonymous room-flow milestone metrics to the existing owner-only analytics pipeline so public Alpha playtests show where players stall between `/rooms`, room creation, join, start, speech, voting, vote resolution, recovery, and finish.

**Architecture:** Reuse the existing best-effort `recordRoomAnalyticsEvent` writer in `src/server/roomAnalytics.ts`, add a small anonymous client beacon for `/rooms` page and session recovery, add server-side milestone recording around room state transitions, and extend the owner metrics API/dashboard with a compact room flow funnel. Analytics failures remain non-blocking and no player-identifying payloads are stored.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod, PostgreSQL or in-process analytics, Vitest, existing room service APIs, owner-protected `/admin/metrics`.

---

## Desired Event Contract

Add these event types to the existing `RoomAnalyticsEventType` union:

```ts
| "room_page_view"
| "room_recovery_restored"
| "room_speech_reached"
| "room_vote_reached"
| "room_vote_resolved"
```

Preserve the existing events:

```ts
| "home_view"
| "main_game_started"
| "main_game_finished"
| "room_created"
| "player_joined"
| "room_started"
| "room_finished"
```

Anonymous payload rules:

```ts
// Allowed payload examples:
{ path: "/rooms" }
{ recoverySource: "localStorage" }
{ phase: "DAY_SPEECH", round: 1 }

// Not allowed:
// player names, room invite tokens, recovery tokens, request IPs, user-agent strings,
// browser fingerprints, API keys, model prompts, raw chat, raw speeches, raw commands.
```

---

## File Changes

### `src/server/roomAnalytics.ts`

- [ ] Extend `RoomAnalyticsEventType`.
- [ ] Extend `RoomAnalyticsHistorySnapshot` with anonymous funnel counters.
- [ ] Extend `RoomAnalyticsDayBucket` with day-level room-flow counters.
- [ ] Count page/recovery events as event counts.
- [ ] Count milestone events as distinct-room counts so retries and duplicate writes do not inflate the funnel.
- [ ] Keep Postgres and in-process summaries behaviorally aligned.

Add snapshot fields:

```ts
roomPageViews: number;
roomRecoveriesRestored: number;
roomsReachedSpeech: number;
roomsReachedVote: number;
roomsResolvedVote: number;
```

Add day bucket fields:

```ts
roomPageViews: number;
roomRecoveriesRestored: number;
roomsReachedSpeech: number;
roomsReachedVote: number;
roomsResolvedVote: number;
```

Postgres aggregation shape:

```ts
COUNT(*) FILTER (WHERE event_type = 'room_page_view')::int AS room_page_views,
COUNT(*) FILTER (WHERE event_type = 'room_recovery_restored')::int AS room_recoveries_restored,
COUNT(DISTINCT room_id) FILTER (WHERE event_type = 'room_speech_reached')::int AS rooms_reached_speech,
COUNT(DISTINCT room_id) FILTER (WHERE event_type = 'room_vote_reached')::int AS rooms_reached_vote,
COUNT(DISTINCT room_id) FILTER (WHERE event_type = 'room_vote_resolved')::int AS rooms_resolved_vote
```

In-process aggregation should use a helper like this:

```ts
function countDistinctRooms(events: RoomAnalyticsEvent[], eventType: RoomAnalyticsEventType): number {
  return new Set(
    events
      .filter((event) => event.eventType === eventType)
      .map((event) => event.roomId)
      .filter((roomId): roomId is string => Boolean(roomId)),
  ).size;
}
```

Day buckets should count distinct rooms per day for milestone events:

```ts
const roomMilestonesByDay = new Map<string, Map<RoomAnalyticsEventType, Set<string>>>();
```

### `src/app/api/analytics/events/route.ts`

- [ ] Accept `home_view` and `room_page_view` from the public beacon endpoint.
- [ ] Keep request validation strict.
- [ ] Only accept `path` values that begin with `/`.
- [ ] Do not accept room codes, player names, tokens, or free-form identity fields.

Use a schema like:

```ts
const analyticsEventSchema = z.object({
  eventType: z.enum(["home_view", "room_page_view"]),
  path: z.string().startsWith("/").max(120).optional(),
});
```

Record page views without identity:

```ts
await recordRoomAnalyticsEvent({
  eventType: body.eventType,
  subjectId: randomUUID(),
  payload: body.path ? { path: body.path } : undefined,
});
```

### `src/components/rooms/roomFlowAnalytics.ts`

- [ ] Add a small client utility for anonymous room-flow beacons.
- [ ] Use `navigator.sendBeacon` when available and `fetch(..., { keepalive: true })` as the fallback.
- [ ] Reuse this utility from `RoomClient`.

Create this file:

```ts
"use client";

type RoomFlowAnalyticsBody = {
  eventType: "room_page_view" | "room_recovery_restored";
  path?: string;
};

export function sendRoomFlowAnalytics(body: RoomFlowAnalyticsBody): void {
  const payload = JSON.stringify(body);

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/events", blob);
    return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
```

If `room_recovery_restored` needs room context, send it through a dedicated server endpoint instead of the public page-view endpoint. The default implementation should keep `room_recovery_restored` server-side in `RoomClient` by calling an authenticated room API action only if such a route already exists. If no existing safe route exists, record recovery as a page-level anonymous count through `/api/analytics/events` and do not include `roomId`.

### `src/components/RoomClient.tsx`

- [ ] Emit `room_page_view` once when the `/rooms` client mounts.
- [ ] Emit `room_recovery_restored` once after the client successfully restores a room session from local storage or URL recovery.
- [ ] Do not include room code, player name, player id, recovery token, or invite token in the client beacon.

Mount effect:

```tsx
const didTrackRoomPageViewRef = useRef(false);

useEffect(() => {
  if (didTrackRoomPageViewRef.current) {
    return;
  }
  didTrackRoomPageViewRef.current = true;
  sendRoomFlowAnalytics({ eventType: "room_page_view", path: "/rooms" });
}, []);
```

Recovery effect integration:

```tsx
const didTrackRecoveryRef = useRef(false);

function trackRecoveryRestored() {
  if (didTrackRecoveryRef.current) {
    return;
  }
  didTrackRecoveryRef.current = true;
  sendRoomFlowAnalytics({ eventType: "room_recovery_restored", path: "/rooms" });
}
```

Call `trackRecoveryRestored()` only after `applyRoomView(view)` succeeds for a restored session.

### `src/server/roomService.ts`

- [ ] Record room milestone events server-side after state transitions.
- [ ] Capture speech reached, vote reached, and vote resolved.
- [ ] Preserve existing create, join, start, finish analytics.
- [ ] Keep analytics writes best-effort and non-blocking to player action success.

Add helpers near existing analytics helpers:

```ts
async function recordRoomFlowMilestones(
  room: RoomRecord,
  previousState: GameState | null | undefined,
): Promise<void> {
  const nextState = room.gameState;
  if (!nextState) {
    return;
  }

  const base = {
    roomId: room.id,
    roomCode: room.code,
    payload: {
      phase: nextState.phase,
      round: nextState.round,
      boardId: room.boardId,
    },
  };

  if (nextState.phase === "DAY_SPEECH" && previousState?.phase !== "DAY_SPEECH") {
    await recordRoomAnalyticsEvent({ eventType: "room_speech_reached", ...base });
  }

  if (nextState.phase === "DAY_VOTE" && previousState?.phase !== "DAY_VOTE") {
    await recordRoomAnalyticsEvent({ eventType: "room_vote_reached", ...base });
  }

  if (previousState?.phase === "DAY_VOTE" && nextState.phase !== "DAY_VOTE") {
    await recordRoomAnalyticsEvent({ eventType: "room_vote_resolved", ...base });
  }
}
```

Call it after any successful state transition that can move phases:

```ts
const previousState = room.gameState;
room.gameState = nextState;
await touchRoom(room);
await recordRoomFlowMilestones(room, previousState);
await recordRoomFinishedIfNeeded(room, previousState?.phase === "FINISHED");
```

Also call it after `startRoomSession` produces the initial game state:

```ts
await recordRoomFlowMilestones(room, null);
```

If the repo's actual `GamePhase` names differ, inspect the current union and map the helper to the exact existing phase strings before editing. The tracked semantic points are first entry into speech, first entry into voting, and first transition out of voting.

### `src/app/admin/metrics/page.tsx`

- [ ] Expand the room funnel display with the new counters.
- [ ] Keep the existing compact dashboard visual style.
- [ ] Label counters in Chinese with short English notes.

Use this funnel order:

```ts
const roomFunnelSteps = [
  { label: "打开", note: "/rooms View", value: metrics.history.roomPageViews },
  { label: "建房", note: "Room Created", value: metrics.history.totalRoomsEver },
  { label: "加入", note: "Room Players", value: metrics.history.totalPlayersEver },
  { label: "开局", note: "Room Started", value: metrics.history.gamesStarted },
  { label: "发言", note: "Speech", value: metrics.history.roomsReachedSpeech },
  { label: "投票", note: "Vote", value: metrics.history.roomsReachedVote },
  { label: "票决", note: "Resolved", value: metrics.history.roomsResolvedVote },
  { label: "完局", note: "Finished", value: metrics.history.gamesFinished },
  { label: "恢复", note: "Restored", value: metrics.history.roomRecoveriesRestored },
];
```

### Tests

- [ ] Add or update focused analytics tests for the new summary fields.
- [ ] Extend the owner metrics API test to assert the new fields exist.
- [ ] Update the admin metrics page test to render the new funnel labels.
- [ ] Add a client utility test for beacon/fetch fallback if there is an existing test pattern for client browser APIs.

Preferred focused server test:

```ts
it("counts anonymous room flow milestones without inflating duplicate room milestones", async () => {
  clearRoomAnalyticsForTests();

  await recordRoomAnalyticsEvent({ eventType: "room_page_view", subjectId: "view-1" });
  await recordRoomAnalyticsEvent({ eventType: "room_recovery_restored", subjectId: "restore-1" });
  await recordRoomAnalyticsEvent({ eventType: "room_speech_reached", roomId: "room-1", roomCode: "ABC123" });
  await recordRoomAnalyticsEvent({ eventType: "room_speech_reached", roomId: "room-1", roomCode: "ABC123" });
  await recordRoomAnalyticsEvent({ eventType: "room_vote_reached", roomId: "room-1", roomCode: "ABC123" });
  await recordRoomAnalyticsEvent({ eventType: "room_vote_resolved", roomId: "room-1", roomCode: "ABC123" });

  const history = await getRoomAnalyticsHistorySnapshot({ days: 7 });

  expect(history.roomPageViews).toBe(1);
  expect(history.roomRecoveriesRestored).toBe(1);
  expect(history.roomsReachedSpeech).toBe(1);
  expect(history.roomsReachedVote).toBe(1);
  expect(history.roomsResolvedVote).toBe(1);
});
```

Preferred endpoint validation test:

```ts
it("accepts anonymous room page views", async () => {
  const response = await POST(
    new Request("http://localhost/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({ eventType: "room_page_view", path: "/rooms" }),
      headers: { "Content-Type": "application/json" },
    }),
  );

  expect(response.status).toBe(200);
});
```

Preferred owner metrics assertion:

```ts
expect(metrics.history).toMatchObject({
  roomPageViews: expect.any(Number),
  roomRecoveriesRestored: expect.any(Number),
  roomsReachedSpeech: expect.any(Number),
  roomsReachedVote: expect.any(Number),
  roomsResolvedVote: expect.any(Number),
});
```

---

## Implementation Tasks

### Task 1: Add Analytics Contract and Aggregation

- [ ] Update `RoomAnalyticsEventType`.
- [ ] Add snapshot and day bucket fields.
- [ ] Update Postgres summary query aliases.
- [ ] Update in-process summary and recent day buckets.
- [ ] Add focused test coverage for duplicate milestone events.

### Task 2: Add Anonymous Client Beacon Support

- [ ] Extend `/api/analytics/events` schema to accept `room_page_view`.
- [ ] Add `src/components/rooms/roomFlowAnalytics.ts`.
- [ ] Wire `room_page_view` into `RoomClient`.
- [ ] Wire `room_recovery_restored` after successful restored-session apply.
- [ ] Add endpoint/client tests.

### Task 3: Add Server-Side Room Milestones

- [ ] Inspect actual game phase strings in `src/lib/game` and `src/server/roomService.ts`.
- [ ] Add `recordRoomFlowMilestones`.
- [ ] Call helper after `startRoomSession`.
- [ ] Call helper after human command submission and idempotent command submission.
- [ ] Call helper after any continue/AI progression path that mutates `room.gameState`.
- [ ] Ensure finish analytics still fires exactly as before.

### Task 4: Update Owner Dashboard

- [ ] Expand `roomFunnelSteps`.
- [ ] Update day bucket rendering if the page shows daily room data.
- [ ] Update admin metrics page tests.
- [ ] Keep mobile dashboard layout from wrapping into unreadable text.

### Task 5: Verify Locally

Run focused tests first:

```powershell
$env:DATABASE_URL='file:./dev.db'
npx vitest run src/server/roomAnalytics.test.ts src/app/api/analytics/events/route.test.ts src/app/admin/metrics/page.test.tsx
```

Run existing room API coverage:

```powershell
$env:DATABASE_URL='file:./dev.db'
npx vitest run src/app/api/rooms/api.test.ts
```

Run full checks:

```powershell
npm run test
npx tsc --noEmit
npm run lint
npm run build
```

Manual local browser checks:

```powershell
npm run dev
```

Verify:

- [ ] `/rooms` loads on desktop and mobile widths.
- [ ] Creating and joining a room still works.
- [ ] Starting a room still works.
- [ ] A speech phase and vote phase can be reached.
- [ ] `/admin/metrics?token=<ROOM_ANALYTICS_OWNER_TOKEN>` shows the expanded funnel.

### Task 6: Deploy and Smoke

Tencent Cloud first:

```powershell
git status --short
git log --oneline -3
```

Deploy using the existing Tencent release path for `/opt/ai-werewolf/app`.

Post-deploy Tencent checks:

```powershell
npm run preflight:production -- --base-url https://werewolf.mql.dpdns.org
npm run smoke:sse -- --base-url https://werewolf.mql.dpdns.org
npm run smoke:room-action -- --base-url https://werewolf.mql.dpdns.org
```

Render mirror:

```powershell
git -c http.sslBackend=openssl push origin codex/room-render-production-minimum
```

Post-deploy Render checks:

```powershell
npm run preflight:production -- --base-url https://ai-werewolf-free.onrender.com
npm run smoke:sse -- --base-url https://ai-werewolf-free.onrender.com
npm run smoke:room-action -- --base-url https://ai-werewolf-free.onrender.com
```

Owner dashboard production check:

- [ ] Confirm expanded room funnel renders on Tencent.
- [ ] Confirm expanded room funnel renders on Render after deploy has switched.
- [ ] Confirm no analytics event payload exposes player names, invite tokens, recovery tokens, or raw speech text.

---

## Completion Criteria

- [ ] Anonymous page/recovery events are recorded without user identity.
- [ ] Server-side speech/vote/vote-resolved milestones are recorded from authoritative room state transitions.
- [ ] Aggregates expose distinct-room milestone counts.
- [ ] Owner dashboard shows the expanded room flow funnel.
- [ ] Existing room creation/join/start/finish metrics still work.
- [ ] Focused tests, full tests, TypeScript, lint, and production build pass.
- [ ] Tencent and Render public smoke checks pass after deployment.

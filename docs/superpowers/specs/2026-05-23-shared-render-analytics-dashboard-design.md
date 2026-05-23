# Shared Render Analytics Dashboard Design

Date: 2026-05-23
Project: AI Werewolf public Alpha

## Goal

Use the existing private Render metrics dashboard as the first shared owner dashboard for public Alpha usage across both live servers:

- Render: `https://ai-werewolf-free.onrender.com`
- Tencent Cloud: `https://175.178.199.245`

The first version should collect anonymous aggregate usage only. It should answer:

1. Are people opening the project through the public servers?
2. Are they starting games?
3. Are they finishing games?
4. Is usage changing by day?
5. Is there obvious start-to-finish drop-off?

## Current Context

The repo already has a private metrics surface:

- owner page: `/admin/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>`
- JSON source: `/api/rooms/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>`
- access guard: `src/server/roomMetricsAccess.ts`
- aggregation logic: `src/server/roomAnalytics.ts`
- existing dashboard UI: `src/app/admin/metrics/page.tsx`

The analytics store already supports PostgreSQL through `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL`, with fallback to `AI_WEREWOLF_ROOM_DATABASE_URL` or `DATABASE_URL` when they are PostgreSQL URLs.

## Decision

Use Render PostgreSQL as the shared analytics database for the first version.

Render keeps serving the private dashboard. Tencent Cloud writes its anonymous analytics events into the same Render PostgreSQL analytics table by setting `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` to the Render PostgreSQL external connection string.

Game state remains separate:

- Render rooms and games keep running on Render.
- Tencent Cloud rooms and games keep running on Tencent Cloud.
- Only analytics events are shared.

This keeps the implementation small and avoids introducing accounts, user identity, or a new public dashboard.

## Data Scope

Include only anonymous aggregate events already supported by the analytics pipeline:

- `home_view`
- `main_game_started`
- `main_game_finished`
- `room_created`
- `player_joined`
- `room_started`
- `room_finished`

The dashboard should continue to show:

- homepage opens;
- main-interface starts and finishes;
- room creates, joins, starts, and finishes;
- completion rates;
- pending started games;
- cumulative and average game durations;
- recent daily activity.

## Privacy Boundaries

The first version must not collect:

- raw IP addresses;
- browser fingerprints;
- account identity;
- login information;
- personal profiles;
- public leaderboards;
- per-user journey replay.

Room IDs, game IDs, and player IDs are internal random identifiers used only for aggregation. They should not be shown as individual user records in the first dashboard.

## Important Metric Caveat

The existing dashboard combines two different kinds of data:

1. Historical analytics events from `roomAnalytics`.
2. Current live room state from the server process handling the dashboard request.

After Tencent Cloud writes analytics events into Render PostgreSQL, historical counters can become shared totals across both servers. However, current live room state is still local to the Render app process unless room state is also shared.

For the first version, do not claim that current room status is a total across both servers.

Acceptable first-version behavior:

- keep the current room-state panel, but label it as Render-local runtime state; or
- move it below shared historical totals with explanatory copy; or
- hide/de-emphasize it when the dashboard is configured as a shared analytics dashboard.

Out of scope for this version:

- total live room count across both servers;
- cross-server live presence;
- cross-server room-state federation.

## Architecture

### Components

1. **Render app**
   - Continues serving `/admin/metrics`.
   - Writes its own analytics events into Render PostgreSQL.
   - Reads shared historical analytics from Render PostgreSQL.

2. **Tencent Cloud app**
   - Continues serving the public Alpha game.
   - Continues using its own runtime configuration for gameplay.
   - Writes analytics events into Render PostgreSQL through `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL`.

3. **Render PostgreSQL analytics table**
   - Existing table: `ai_werewolf_room_analytics_events`.
   - Stores anonymous event type, subject ID, optional room code/player ID, timestamp, and payload.

4. **Owner dashboard**
   - Existing private page protected by `AI_WEREWOLF_METRICS_TOKEN`.
   - Displays shared historical aggregates.
   - Clearly labels any local-only live room state.

### Data Flow

1. A player opens or plays on Render.
2. Render calls `recordRoomAnalyticsEvent`.
3. The event is inserted into Render PostgreSQL.
4. A player opens or plays on Tencent Cloud.
5. Tencent Cloud calls the same `recordRoomAnalyticsEvent`.
6. The event is inserted into the same Render PostgreSQL analytics table.
7. The owner opens Render `/admin/metrics?token=...`.
8. Render queries the shared analytics table and displays combined historical totals.

## Configuration

Render:

- Keep `AI_WEREWOLF_METRICS_TOKEN` private.
- Keep Render's PostgreSQL analytics configuration working as it does today.
- Prefer using the internal Render database URL for the Render service itself when available.

Tencent Cloud:

- Add `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` as a secret environment variable.
- Use the Render PostgreSQL external connection string, not a repo-committed value.
- Restart the app container after setting the variable.

No database URL or metrics token should be written into source control, docs with real values, shell history snippets, or final user-facing summaries.

## Error Handling

Analytics must remain best-effort:

- If the shared database is unavailable, gameplay should continue.
- Failed analytics writes should log a concise warning without exposing credentials.
- The dashboard should still render with available data.

If Tencent Cloud cannot connect to Render PostgreSQL because external access is unavailable or unreliable, the fallback design is to use a neutral hosted PostgreSQL database and point both servers at it.

## Testing

Implementation verification should prove both write paths and the dashboard read path.

Recommended local checks:

```powershell
npm run test -- src/app/api/rooms/api.test.ts src/app/api/games/api.test.ts
npx tsc --noEmit
npm run lint
```

Deployment checks:

1. Confirm Render dashboard loads with the owner token.
2. Trigger one known analytics event on Render, such as loading the homepage or starting a game.
3. Trigger one known analytics event on Tencent Cloud.
4. Reopen the Render dashboard and confirm the shared historical counter increases.
5. Confirm gameplay still works on both servers.
6. Confirm no secret values appear in logs or committed files.

If production smoke is needed after deployment:

```powershell
npm run preflight:production -- --base-url=https://ai-werewolf-free.onrender.com
$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run smoke:room-sse
npm run preflight:production -- --base-url=https://175.178.199.245
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-sse
```

## Rollout

1. Confirm Render PostgreSQL exposes a usable external connection string.
2. Configure Tencent Cloud with `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL`.
3. Restart Tencent Cloud service.
4. Run the event-write verification from both servers.
5. Update dashboard copy so shared historical metrics and Render-local live room state are not confused.
6. Update deployment docs with the shared analytics setup, using placeholder names only.

## Out of Scope

This design does not include:

- a new analytics product or separate admin app;
- account/login support;
- IP or fingerprint tracking;
- public analytics pages;
- per-player timelines;
- cross-server live room federation;
- dashboards for AI quality, voting behavior, or detailed phase-level diagnosis.

Those can be added later after the anonymous aggregate dashboard proves useful.

## Success Criteria

The design is successful when:

- Render `/admin/metrics` shows shared historical aggregate usage from both Render and Tencent Cloud.
- Tencent Cloud gameplay is unaffected by analytics write failures.
- No personal identity or IP data is collected.
- Dashboard labels make it clear which data is shared historical aggregate data and which data is local live runtime state.
- The setup can be repeated from documentation without exposing secrets.

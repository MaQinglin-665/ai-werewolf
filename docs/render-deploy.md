# Render Deployment

This is the quickest hosted production-minimum path for public room testing.

## What Render Creates

`render.yaml` defines:

- one Docker web service named `ai-werewolf`;
- one Render Postgres database named `ai-werewolf-room-db`;
- PostgreSQL-backed room state, realtime fanout, presence, and rate limits;
- PostgreSQL-backed main single-player snapshots, so mobile backgrounding is not coupled to Render container disk;
- mock AI mode by default, so infrastructure smoke does not spend model quota.

The service starts with `npm run start:production`, which also initializes the current SQLite Prisma tables used by the main single-player page. On Render, the app can use `RENDER_EXTERNAL_URL` as the public origin for the initial `*.onrender.com` URL. After you add a custom domain, set `AI_WEREWOLF_PUBLIC_ORIGIN` to that final HTTPS origin.

## Deploy

1. Push this repo to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Confirm the service and database from `render.yaml`.
4. Deploy.
5. Open the service URL and check `/alpha-health`.
6. After the health panel is green, open `/alpha-playtest` and use it as the small-group playtest handoff page.

Render Blueprint fields used here are the standard Docker web service fields, `healthCheckPath`, and `fromDatabase` environment references.

## Free Demo Blueprint

If Render asks for payment information while you are only trying to get a public demo link, use `render.free.yaml` as the Blueprint path instead of the default `render.yaml`.

Render setup fields:

- Blueprint Name: `ai-werewolf-free`
- Branch: `codex/room-render-production-minimum`
- Blueprint Path: `render.free.yaml`

This creates:

- a free Docker web service named `ai-werewolf-free`;
- a free Render Postgres database named `ai-werewolf-room-db-free`;
- the same PostgreSQL-backed room state, realtime fanout, presence, and rate limits;
- the same PostgreSQL-backed main single-player snapshots;
- a generated private metrics token for the admin-only stats page;
- mock AI mode by default.

Use this only for public-link smoke testing. Free Render resources can sleep, have capacity limits, and are not the production target. For a stable public test, switch back to `render.yaml` and use the paid `starter` web service plus `basic-256mb` Postgres.

## Private Metrics

The app exposes an owner-only usage dashboard at:

```text
https://your-service.onrender.com/admin/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>
```

The JSON source is:

```text
https://your-service.onrender.com/api/rooms/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>
```

`render.yaml` and `render.free.yaml` both generate `AI_WEREWOLF_METRICS_TOKEN` through the Render Blueprint. Copy it from the Render service environment variables page. Do not publish this URL publicly.

The metrics track public-test usage:

- homepage opens for the main single-player interface;
- main-interface game starts and completed games;
- cumulative and average main-interface game duration;
- cumulative rooms and players from room create/join events;
- room started and finished games;
- cumulative room duration, including observed in-progress room time but excluding idle retention time after no players are online;
- sitewide completion rate, pending started games, and in-game rooms with no active presence connection.

They do not track raw IP addresses, browser fingerprints, or model/API keys.

### Shared Render Analytics Dashboard

For the first two-server public Alpha, keep Render as the owner dashboard and use the Render PostgreSQL analytics table as the shared historical metrics store.

Configuration shape:

- Render continues to serve `/admin/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>`.
- Render writes analytics through its existing PostgreSQL-backed room analytics configuration.
- Tencent Cloud sets `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` to the Render PostgreSQL external connection string.
- The connection string is a secret environment variable and must not be committed or copied into public docs.

With this setup, historical counters such as homepage opens, starts, finishes, durations, completion rates, and recent-day trends can include events from both Render and Tencent Cloud. Current live room state remains local to the service instance serving the dashboard unless room state is also shared, so do not read the live room panels as cross-server totals.

If Render PostgreSQL external access is unavailable or unreliable from Tencent Cloud, use a neutral hosted PostgreSQL database for `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` on both servers instead.

## After First Deploy

First open:

```text
https://your-service.onrender.com/alpha-health
```

The page should show whether the deployment is still local/single-node, online single-node, or production-minimum ready. It also prints the next smoke command for the detected origin.

After the smoke commands pass, open the playtest handoff page:

```text
https://your-service.onrender.com/alpha-playtest
```

Use this page when sending the Alpha to friends. It links to `/rooms`, explains the first-room flow, lists the real-player checklist, and calls out the current free-Render and Alpha limitations.

If a player hits a problem, send them the local-only feedback template page:

```text
https://your-service.onrender.com/alpha-report
```

It generates copyable text in the browser and does not submit data to the server.

From your local machine:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run preflight:production
$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run smoke:room-sse
$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run smoke:alpha:vote
```

When testing a Docker container through a local forwarded port while the app is configured with a hosted public origin, pass the expected public origin explicitly:

```powershell
npm run preflight:production -- --base-url=http://127.0.0.1:3015 --expected-public-origin=https://your-service.onrender.com
```

If you bind a custom domain:

1. Add the custom domain in Render.
2. Set `AI_WEREWOLF_PUBLIC_ORIGIN` in the web service env to the custom HTTPS origin.
3. Redeploy.
4. Open `https://your-domain.example/alpha-health`.
5. Rerun `preflight:production` and `smoke:room-sse` against the custom domain.

## Current Limits

- Keep one web service instance for the first public test.
- The room runtime is PostgreSQL-backed, but each browser SSE connection is still held by the Node process.
- The default `DATABASE_URL=file:./prod.db` is only for the current SQLite Prisma datasource and is initialized by `npm run start:production`. Room state is stored in PostgreSQL through `AI_WEREWOLF_ROOM_DATABASE_URL`; main single-player snapshots are stored through `AI_WEREWOLF_MAIN_GAME_DATABASE_URL` when `AI_WEREWOLF_MAIN_GAME_STORE_ADAPTER=postgres`.
- Switch AI providers from mock only after the public infrastructure smoke is green.

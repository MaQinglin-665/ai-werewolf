# Render Deployment

This is the quickest hosted production-minimum path for public room testing.

## What Render Creates

`render.yaml` defines:

- one Docker web service named `ai-werewolf`;
- one Render Postgres database named `ai-werewolf-room-db`;
- PostgreSQL-backed room state, realtime fanout, presence, and rate limits;
- mock AI mode by default, so infrastructure smoke does not spend model quota.

The service starts with `npm run start:production`. On Render, the app can use `RENDER_EXTERNAL_URL` as the public origin for the initial `*.onrender.com` URL. After you add a custom domain, set `AI_WEREWOLF_PUBLIC_ORIGIN` to that final HTTPS origin.

## Deploy

1. Push this repo to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Confirm the service and database from `render.yaml`.
4. Deploy.
5. Open the service URL and check `/api/rooms/health`.

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

The metrics track room usage only:

- cumulative rooms and players from room create/join events;
- started and finished games;
- current online room players from presence connections;
- average finished-game duration.

They do not track raw IP addresses or normal homepage visits outside the room flow.

## After First Deploy

From your local machine:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run preflight:production
$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run smoke:room-sse
```

When testing a Docker container through a local forwarded port while the app is configured with a hosted public origin, pass the expected public origin explicitly:

```powershell
npm run preflight:production -- --base-url=http://127.0.0.1:3015 --expected-public-origin=https://your-service.onrender.com
```

If you bind a custom domain:

1. Add the custom domain in Render.
2. Set `AI_WEREWOLF_PUBLIC_ORIGIN` in the web service env to the custom HTTPS origin.
3. Redeploy.
4. Rerun `preflight:production` and `smoke:room-sse` against the custom domain.

## Current Limits

- Keep one web service instance for the first public test.
- The room runtime is PostgreSQL-backed, but each browser SSE connection is still held by the Node process.
- The default `DATABASE_URL=file:./prod.db` is only for the current SQLite Prisma datasource. Room state is stored in PostgreSQL through `AI_WEREWOLF_ROOM_DATABASE_URL`.
- Switch AI providers from mock only after the public infrastructure smoke is green.

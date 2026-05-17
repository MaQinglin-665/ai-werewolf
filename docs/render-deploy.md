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

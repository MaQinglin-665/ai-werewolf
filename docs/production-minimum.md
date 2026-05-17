# Production Minimum Loop

This is the smallest production-style deployment target for public link testing:

- one fixed HTTPS domain;
- PostgreSQL-backed room state;
- PostgreSQL-backed room update notifications;
- PostgreSQL-backed player presence;
- PostgreSQL-backed room API rate limiting;
- current browser-facing SSE room stream unchanged.

This removes the biggest state, realtime, presence, and quota blockers without changing the client protocol.

## Target Topology

```text
player browser
  -> https://werewolf.example.com
  -> reverse proxy / platform HTTPS
  -> Node process(es): npm run start -- --hostname 0.0.0.0 --port 3004
  -> PostgreSQL: ai_werewolf_room_sessions
  -> PostgreSQL NOTIFY: ai_werewolf_room_events
  -> PostgreSQL: ai_werewolf_room_presence, ai_werewolf_room_presence_connections
  -> PostgreSQL: ai_werewolf_room_rate_limits
```

Use one Node process for the first public run. After PostgreSQL state, realtime, presence, and rate limiting are enabled, multiple Node processes can share the critical room runtime data, but you should still run a real two-device smoke before adding traffic.

## Runtime Choice

Use a long-running Node runtime for the first public room test:

- good first choices: Render Web Service, Railway service, Fly.io app, or a VPS running Docker;
- acceptable local-public rehearsal: a Cloudflare Tunnel or similar tunnel to one local Node process;
- avoid as the first room runtime: short-lived Serverless functions, because room SSE connections need stable long-lived HTTP streams.

The repo includes a production `Dockerfile`. Platforms that build Docker images can use:

```bash
docker build -t ai-werewolf .
docker run --rm -p 3000:3000 --env-file .env.production ai-werewolf
```

The container command runs `npm run start:production`, which checks the production environment, initializes the current SQLite Prisma tables for the single-player flow, and then starts Next on `0.0.0.0:$PORT`.

For Render, use the checked-in `render.yaml` Blueprint and follow `docs/render-deploy.md`. The first deploy can use Render's generated `*.onrender.com` HTTPS origin through `RENDER_EXTERNAL_URL`; set `AI_WEREWOLF_PUBLIC_ORIGIN` explicitly when you add a custom domain.

If you only need a no-card public smoke test first, use `render.free.yaml` as the Render Blueprint path. That file keeps the same production-minimum adapters but selects Render free instance types and `-free` resource names so it does not conflict with the stable paid Blueprint. Treat it as a temporary demo environment, not the production target.

Both Render Blueprints also create a generated `AI_WEREWOLF_METRICS_TOKEN` for the private owner dashboard at `/admin/metrics?token=<token>`. Keep that token out of public links.

## DNS And HTTPS

1. Point `werewolf.example.com` to the server or platform.
2. Terminate HTTPS at the platform, Caddy, Nginx, or another reverse proxy.
3. Set the public origin without a path:

```bash
AI_WEREWOLF_PUBLIC_ORIGIN="https://werewolf.example.com"
AI_WEREWOLF_ROOM_DEPLOYMENT="single-node-online"
```

The app health endpoint normalizes this value and uses it for invite/recovery links and smoke output.

## Production Environment Template

Use `.env.production.example` as the source of truth for platform environment variables. Replace the sample domain and PostgreSQL connection strings before deploying.

Important: the current Prisma datasource in `prisma/schema.prisma` is still `sqlite`, so do not put the hosted PostgreSQL URL in `DATABASE_URL` yet. Keep `DATABASE_URL` as a `file:` URL for the existing single-player game tables, and use `AI_WEREWOLF_ROOM_DATABASE_URL` for the room runtime PostgreSQL store.

Before starting the server, validate the production env values:

```bash
npm run check:production-env
```

The check is static. It does not connect to the database; `preflight:production` verifies the live service after deployment.

## PostgreSQL Room State

Set the room store adapter to PostgreSQL:

```bash
AI_WEREWOLF_ROOM_STORE_ADAPTER="postgres"
AI_WEREWOLF_ROOM_DATABASE_URL="postgresql://user:password@host:5432/ai_werewolf?sslmode=require"
```

For hosted providers, use a normal PostgreSQL connection string that supports long-lived sessions. Avoid transaction-pooling URLs for this room runtime because PostgreSQL `LISTEN/NOTIFY` needs a persistent connection.

On first use, the app creates this table if needed:

```sql
create table if not exists ai_werewolf_room_sessions (
  id text primary key,
  code text not null unique,
  status text not null,
  revision integer not null,
  updated_at timestamptz not null,
  payload jsonb not null
);
```

The store keeps the existing room revision CAS contract, so stale writes still fail with `409`.

## PostgreSQL Realtime Fanout

Keep the browser-facing room stream as SSE, but broadcast room updates through PostgreSQL:

```bash
AI_WEREWOLF_ROOM_REALTIME_ADAPTER="postgres"
```

Each Node process listens on `ai_werewolf_room_events`. When any process writes a room update, other processes receive a PostgreSQL notification and refresh their local SSE subscribers.

## PostgreSQL Presence

Use PostgreSQL-backed presence so online/offline state is shared across Node processes:

```bash
AI_WEREWOLF_ROOM_PRESENCE_ADAPTER="postgres"
AI_WEREWOLF_ROOM_PRESENCE_DATABASE_URL="postgresql://user:password@host:5432/ai_werewolf?sslmode=require"
AI_WEREWOLF_ROOM_PRESENCE_HEARTBEAT_MS="5000"
AI_WEREWOLF_ROOM_PRESENCE_TTL_MS="20000"
```

The server writes one short-lived presence connection per SSE connection and refreshes it on a heartbeat. On first use, the app creates these tables if needed:

```sql
create table if not exists ai_werewolf_room_presence (
  room_id text not null,
  player_id text not null,
  last_seen_at timestamptz not null,
  primary key (room_id, player_id)
);

create table if not exists ai_werewolf_room_presence_connections (
  connection_id text primary key,
  room_id text not null,
  player_id text not null,
  last_seen_at timestamptz not null,
  expires_at timestamptz not null
);
```

## Basic Rate Limiting

Default limits are enabled unless `AI_WEREWOLF_ROOM_RATE_LIMIT="0"`. Use PostgreSQL for shared production quotas:

```bash
AI_WEREWOLF_ROOM_RATE_LIMIT="1"
AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER="postgres"
AI_WEREWOLF_ROOM_RATE_LIMIT_DATABASE_URL="postgresql://user:password@host:5432/ai_werewolf?sslmode=require"
AI_WEREWOLF_ROOM_RATE_LIMIT_WINDOW_MS="60000"
AI_WEREWOLF_ROOM_CREATE_LIMIT="20"
AI_WEREWOLF_ROOM_JOIN_LIMIT="120"
AI_WEREWOLF_ROOM_WRITE_LIMIT="240"
AI_WEREWOLF_ROOM_READ_LIMIT="600"
AI_WEREWOLF_ROOM_STREAM_LIMIT="120"
AI_WEREWOLF_ROOM_DEBUG_LIMIT="20"
```

The limiter keys by client IP, operation bucket, and room scope. Put the app behind a proxy that forwards `x-forwarded-for`, `cf-connecting-ip`, or `x-real-ip`.

On first use, the PostgreSQL limiter creates this table if needed:

```sql
create table if not exists ai_werewolf_room_rate_limits (
  key text primary key,
  bucket text not null,
  count integer not null,
  reset_at timestamptz not null
);
```

## Start

For a raw Node server:

```bash
npm ci
npm run check:production-env
npm run prisma:generate
npm run build
npm run start:production
```

Set `PORT=3004` if your host does not inject a port automatically.

`npm run start:production` initializes the existing Prisma game tables for the current SQLite datasource. Room state uses the dedicated PostgreSQL table above and does not require changing the current SQLite Prisma provider for local development.

## Verify

Check health:

```bash
curl https://werewolf.example.com/api/rooms/health
```

Or run the production preflight script:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://werewolf.example.com"; npm run preflight:production
```

For local Docker smoke against a forwarded port while the app reports a hosted public origin, keep the checked base URL local and pass the expected public origin:

```powershell
npm run preflight:production -- --base-url=http://127.0.0.1:3015 --expected-public-origin=https://werewolf.example.com
```

If you only have a PostgreSQL URL and want to test the production adapters locally before buying or wiring a domain:

```powershell
npm run smoke:production:postgres -- -DatabaseUrl "postgresql://user:password@host:5432/ai_werewolf?sslmode=require"
```

That script starts `next start` locally, temporarily enables all four PostgreSQL room adapters, runs `preflight:production`, and then runs the room SSE smoke. Add `-RunActionSmoke` if you also want a human-action smoke pass.

For this production minimum loop, the important fields are:

- `deployment.target: "single-node-online"`
- `deployment.productionMinimumReady: true`
- `storage.mode: "postgres"`
- `storage.adapter: "postgres-room-store"`
- `realtime.mode: "postgres-notify"`
- `realtime.crossProcessFanout: true`
- `presence.adapter: "postgres"`
- `presence.shared: true`
- `rateLimit.adapter: "postgres"`
- `rateLimit.shared: true`
- `deployment.requirements.postgresRoomState: true`
- `deployment.requirements.sharedRealtime: true`
- `deployment.requirements.sharedPresence: true`
- `deployment.requirements.basicRateLimit: true`
- `deployment.requirements.sharedRateLimit: true`
- `deployment.requirements.httpsPublicOrigin: true`

Then run the room smoke script against the fixed domain:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://werewolf.example.com"; npm run smoke:online
```

## Current Limits

- SSE connections are still held by each Node process, but updates can fan out through PostgreSQL.
- This still does not add accounts, moderation, payment, replay storage, or autoscaling policy.

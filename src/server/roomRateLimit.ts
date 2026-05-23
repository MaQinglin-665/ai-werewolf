import { Pool } from "pg";

export type RoomRateLimitBucket = "create" | "debug" | "join" | "read" | "stream" | "write";

type RoomRateLimitEntry = {
  count: number;
  resetAt: number;
};

type RoomRateLimitAdapter = "in-process" | "postgres";

type RoomRateLimitDecision =
  | {
      allowed: true;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      limit: number;
      resetAt: number;
      retryAfterMs: number;
    };

const DEFAULT_ROOM_RATE_LIMIT_WINDOW_MS = 60_000;
const POSTGRES_ROOM_RATE_LIMIT_TABLE = "ai_werewolf_room_rate_limits";
const DEFAULT_ROOM_RATE_LIMITS: Record<RoomRateLimitBucket, number> = {
  create: 20,
  debug: 20,
  join: 120,
  read: 600,
  stream: 120,
  write: 240,
};

const ROOM_RATE_LIMIT_ENV: Record<RoomRateLimitBucket, string> = {
  create: "AI_WEREWOLF_ROOM_CREATE_LIMIT",
  debug: "AI_WEREWOLF_ROOM_DEBUG_LIMIT",
  join: "AI_WEREWOLF_ROOM_JOIN_LIMIT",
  read: "AI_WEREWOLF_ROOM_READ_LIMIT",
  stream: "AI_WEREWOLF_ROOM_STREAM_LIMIT",
  write: "AI_WEREWOLF_ROOM_WRITE_LIMIT",
};

const globalForRoomRateLimit = globalThis as unknown as {
  aiWerewolfPostgresRoomRateLimitPool?: Pool;
  aiWerewolfPostgresRoomRateLimitReady?: Promise<void>;
  aiWerewolfRoomRateLimits?: Map<string, RoomRateLimitEntry>;
};

const roomRateLimits = globalForRoomRateLimit.aiWerewolfRoomRateLimits ?? new Map<string, RoomRateLimitEntry>();
globalForRoomRateLimit.aiWerewolfRoomRateLimits = roomRateLimits;

export async function applyRoomRateLimit(
  request: Request | undefined,
  bucket: RoomRateLimitBucket,
  scope = "global",
): Promise<Response | undefined> {
  if (!request || !isRoomRateLimitEnabled()) return undefined;

  const decision = await checkRoomRateLimit({
    bucket,
    clientId: readClientId(request),
    scope,
  });
  if (decision.allowed) return undefined;

  return Response.json(
    {
      error: "请求过于频繁，请稍后再试。",
      rateLimit: {
        bucket,
        limit: decision.limit,
        resetAt: new Date(decision.resetAt).toISOString(),
      },
    },
    {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
      },
      status: 429,
    },
  );
}

export function getRoomRateLimitStatus() {
  const now = Date.now();
  pruneRoomRateLimits(now);
  const adapter = readRoomRateLimitAdapter();
  return {
    enabled: isRoomRateLimitEnabled(),
    adapter,
    shared: adapter === "postgres",
    windowMs: readRoomRateLimitWindowMs(),
    buckets: {
      create: readRoomRateLimit("create"),
      join: readRoomRateLimit("join"),
      write: readRoomRateLimit("write"),
      read: readRoomRateLimit("read"),
      stream: readRoomRateLimit("stream"),
      debug: readRoomRateLimit("debug"),
    },
    trackedKeys: adapter === "in-process" ? roomRateLimits.size : undefined,
  };
}

export function clearRoomRateLimitsForTests(): void {
  roomRateLimits.clear();
}

async function checkRoomRateLimit({
  bucket,
  clientId,
  scope,
}: {
  bucket: RoomRateLimitBucket;
  clientId: string;
  scope: string;
}): Promise<RoomRateLimitDecision> {
  const now = Date.now();
  const limit = readRoomRateLimit(bucket);
  const windowMs = readRoomRateLimitWindowMs();

  if (limit <= 0) {
    return { allowed: true, limit, remaining: Number.POSITIVE_INFINITY, resetAt: now + windowMs };
  }

  const key = `${bucket}:${scope}:${clientId}`;
  if (readRoomRateLimitAdapter() === "postgres") {
    return checkPostgresRoomRateLimit({ bucket, key, limit, now, windowMs });
  }

  pruneRoomRateLimits(now);
  const current = roomRateLimits.get(key);
  if (!current || current.resetAt <= now) {
    roomRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      resetAt: current.resetAt,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  return { allowed: true, limit, remaining: limit - current.count, resetAt: current.resetAt };
}

async function checkPostgresRoomRateLimit({
  bucket,
  key,
  limit,
  now,
  windowMs,
}: {
  bucket: RoomRateLimitBucket;
  key: string;
  limit: number;
  now: number;
  windowMs: number;
}): Promise<RoomRateLimitDecision> {
  const pool = getPostgresRoomRateLimitPool();
  await ensurePostgresRoomRateLimitSchema(pool);
  const resetAt = new Date(now + windowMs);
  const result = await pool.query<{ count: number; reset_at: Date }>(
    `
      insert into ${POSTGRES_ROOM_RATE_LIMIT_TABLE} (key, bucket, count, reset_at)
      values ($1, $2, 1, $3)
      on conflict (key) do update set
        count = case
          when ${POSTGRES_ROOM_RATE_LIMIT_TABLE}.reset_at <= now() then 1
          else ${POSTGRES_ROOM_RATE_LIMIT_TABLE}.count + 1
        end,
        reset_at = case
          when ${POSTGRES_ROOM_RATE_LIMIT_TABLE}.reset_at <= now() then excluded.reset_at
          else ${POSTGRES_ROOM_RATE_LIMIT_TABLE}.reset_at
        end,
        bucket = excluded.bucket
      returning count, reset_at
    `,
    [key, bucket, resetAt],
  );
  const row = result.rows[0];
  const currentResetAt = row?.reset_at instanceof Date ? row.reset_at.getTime() : resetAt.getTime();
  const count = row?.count ?? 1;
  if (count > limit) {
    return {
      allowed: false,
      limit,
      resetAt: currentResetAt,
      retryAfterMs: Math.max(0, currentResetAt - now),
    };
  }
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: currentResetAt,
  };
}

async function ensurePostgresRoomRateLimitSchema(pool: Pool): Promise<void> {
  globalForRoomRateLimit.aiWerewolfPostgresRoomRateLimitReady ??= pool
    .query(
      `
        create table if not exists ${POSTGRES_ROOM_RATE_LIMIT_TABLE} (
          key text primary key,
          bucket text not null,
          count integer not null,
          reset_at timestamptz not null
        );
        create index if not exists ${POSTGRES_ROOM_RATE_LIMIT_TABLE}_reset_at_idx
          on ${POSTGRES_ROOM_RATE_LIMIT_TABLE} (reset_at);
      `,
    )
    .then(() => undefined);
  await globalForRoomRateLimit.aiWerewolfPostgresRoomRateLimitReady;
}

function getPostgresRoomRateLimitPool(): Pool {
  globalForRoomRateLimit.aiWerewolfPostgresRoomRateLimitPool ??= new Pool({
    connectionString: getPostgresRoomRateLimitDatabaseUrl(),
  });
  return globalForRoomRateLimit.aiWerewolfPostgresRoomRateLimitPool;
}

function getPostgresRoomRateLimitDatabaseUrl(): string {
  const url = process.env.AI_WEREWOLF_ROOM_RATE_LIMIT_DATABASE_URL ?? process.env.AI_WEREWOLF_ROOM_DATABASE_URL ?? process.env.DATABASE_URL;
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) return url;
  throw new Error(
    'AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER="postgres" 时必须配置 PostgreSQL 连接串 AI_WEREWOLF_ROOM_RATE_LIMIT_DATABASE_URL、AI_WEREWOLF_ROOM_DATABASE_URL 或 DATABASE_URL。',
  );
}

function isRoomRateLimitEnabled(): boolean {
  return process.env.AI_WEREWOLF_ROOM_RATE_LIMIT !== "0";
}

function readRoomRateLimitAdapter(): RoomRateLimitAdapter {
  return process.env.AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER === "postgres" ? "postgres" : "in-process";
}

function readRoomRateLimit(bucket: RoomRateLimitBucket): number {
  return readPositiveIntegerEnv(ROOM_RATE_LIMIT_ENV[bucket], DEFAULT_ROOM_RATE_LIMITS[bucket]);
}

function readRoomRateLimitWindowMs(): number {
  return readPositiveIntegerEnv("AI_WEREWOLF_ROOM_RATE_LIMIT_WINDOW_MS", DEFAULT_ROOM_RATE_LIMIT_WINDOW_MS);
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function pruneRoomRateLimits(now: number): void {
  for (const [key, value] of roomRateLimits) {
    if (value.resetAt <= now) {
      roomRateLimits.delete(key);
    }
  }
}

function readClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

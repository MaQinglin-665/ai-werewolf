import { Pool } from "pg";

export type RoomAnalyticsEventType = "room_created" | "player_joined" | "room_started" | "room_finished";

export type RoomAnalyticsEventInput = {
  eventType: RoomAnalyticsEventType;
  roomCode?: string;
  roomId: string;
  playerId?: string;
  payload?: Record<string, unknown>;
};

export type RoomAnalyticsDayBucket = {
  date: string;
  roomsCreated: number;
  playersJoined: number;
  gamesStarted: number;
  gamesFinished: number;
};

export type RoomAnalyticsHistorySnapshot = {
  adapter: "in-process" | "postgres";
  averageFinishedGameMinutes: number | null;
  gamesFinished: number;
  gamesStarted: number;
  recentDays: RoomAnalyticsDayBucket[];
  totalPlayersEver: number;
  totalRoomsEver: number;
  trackedSince?: string;
};

type StoredRoomAnalyticsEvent = RoomAnalyticsEventInput & {
  occurredAt: string;
};

const POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE = "ai_werewolf_room_analytics_events";
const METRICS_TIME_ZONE = "Asia/Shanghai";

const globalForRoomAnalytics = globalThis as unknown as {
  aiWerewolfRoomAnalyticsEvents?: StoredRoomAnalyticsEvent[];
  aiWerewolfRoomAnalyticsPool?: Pool;
  aiWerewolfRoomAnalyticsReady?: Promise<void>;
};

const roomAnalyticsEvents = globalForRoomAnalytics.aiWerewolfRoomAnalyticsEvents ?? [];
globalForRoomAnalytics.aiWerewolfRoomAnalyticsEvents = roomAnalyticsEvents;

export async function recordRoomAnalyticsEvent(input: RoomAnalyticsEventInput): Promise<void> {
  const event: StoredRoomAnalyticsEvent = {
    ...input,
    occurredAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };

  try {
    if (isPostgresRoomAnalyticsEnabled()) {
      const pool = getPostgresRoomAnalyticsPool();
      await ensurePostgresRoomAnalyticsSchema(pool);
      await pool.query(
        `
          insert into ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
            (event_type, room_id, room_code, player_id, occurred_at, payload)
          values ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [event.eventType, event.roomId, event.roomCode ?? null, event.playerId ?? null, event.occurredAt, JSON.stringify(event.payload)],
      );
      return;
    }

    roomAnalyticsEvents.push(event);
  } catch (error) {
    console.warn(`记录房间统计事件失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getRoomAnalyticsHistorySnapshot(): Promise<RoomAnalyticsHistorySnapshot> {
  if (isPostgresRoomAnalyticsEnabled()) {
    return getPostgresRoomAnalyticsHistorySnapshot();
  }
  return summarizeInProcessRoomAnalytics(roomAnalyticsEvents);
}

export async function clearRoomAnalyticsForTests(): Promise<void> {
  roomAnalyticsEvents.length = 0;
  if (globalForRoomAnalytics.aiWerewolfRoomAnalyticsPool) {
    await ensurePostgresRoomAnalyticsSchema(globalForRoomAnalytics.aiWerewolfRoomAnalyticsPool);
    await globalForRoomAnalytics.aiWerewolfRoomAnalyticsPool.query(`delete from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}`);
  }
}

async function getPostgresRoomAnalyticsHistorySnapshot(): Promise<RoomAnalyticsHistorySnapshot> {
  const pool = getPostgresRoomAnalyticsPool();
  await ensurePostgresRoomAnalyticsSchema(pool);
  const [totals, duration, days, trackedSince] = await Promise.all([
    pool.query<{
      games_finished: number;
      games_started: number;
      total_players_ever: number;
      total_rooms_ever: number;
    }>(
      `
        select
          count(distinct room_id) filter (where event_type = 'room_created')::int as total_rooms_ever,
          count(distinct player_id) filter (where event_type in ('room_created', 'player_joined') and player_id is not null)::int as total_players_ever,
          count(distinct room_id) filter (where event_type = 'room_started')::int as games_started,
          count(distinct room_id) filter (where event_type = 'room_finished')::int as games_finished
        from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
      `,
    ),
    pool.query<{ average_seconds: number | null }>(
      `
        with started as (
          select room_id, min(occurred_at) as started_at
          from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
          where event_type = 'room_started'
          group by room_id
        ),
        finished as (
          select room_id, min(occurred_at) as finished_at
          from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
          where event_type = 'room_finished'
          group by room_id
        )
        select avg(extract(epoch from (finished.finished_at - started.started_at)))::float as average_seconds
        from started
        join finished on finished.room_id = started.room_id
        where finished.finished_at >= started.started_at
      `,
    ),
    pool.query<{ count: number; day: string; event_type: RoomAnalyticsEventType }>(
      `
        select
          to_char(occurred_at at time zone '${METRICS_TIME_ZONE}', 'YYYY-MM-DD') as day,
          event_type,
          case
            when event_type in ('room_created', 'player_joined') then count(distinct player_id)::int
            else count(distinct room_id)::int
          end as count
        from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
        where occurred_at >= now() - interval '6 days'
        group by day, event_type
        order by day asc
      `,
    ),
    pool.query<{ tracked_since: Date | null }>(
      `select min(occurred_at) as tracked_since from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}`,
    ),
  ]);
  const totalRow = totals.rows[0];
  const averageSeconds = duration.rows[0]?.average_seconds;
  const trackedSinceValue = trackedSince.rows[0]?.tracked_since;
  return {
    adapter: "postgres",
    averageFinishedGameMinutes: typeof averageSeconds === "number" ? roundOneDecimal(averageSeconds / 60) : null,
    gamesFinished: totalRow?.games_finished ?? 0,
    gamesStarted: totalRow?.games_started ?? 0,
    recentDays: buildRecentDayBuckets(new Date(), days.rows),
    totalPlayersEver: totalRow?.total_players_ever ?? 0,
    totalRoomsEver: totalRow?.total_rooms_ever ?? 0,
    trackedSince: trackedSinceValue ? trackedSinceValue.toISOString() : undefined,
  };
}

function summarizeInProcessRoomAnalytics(events: StoredRoomAnalyticsEvent[]): RoomAnalyticsHistorySnapshot {
  const roomIds = new Set<string>();
  const playerIds = new Set<string>();
  const startedRoomIds = new Set<string>();
  const finishedRoomIds = new Set<string>();
  const startedAtByRoom = new Map<string, number>();
  const finishedDurationsSeconds: number[] = [];
  let trackedSinceMs: number | undefined;

  for (const event of events) {
    const occurredAtMs = Date.parse(event.occurredAt);
    if (Number.isFinite(occurredAtMs)) {
      trackedSinceMs = trackedSinceMs === undefined ? occurredAtMs : Math.min(trackedSinceMs, occurredAtMs);
    }
    if (event.eventType === "room_created") roomIds.add(event.roomId);
    if ((event.eventType === "room_created" || event.eventType === "player_joined") && event.playerId) {
      playerIds.add(event.playerId);
    }
    if (event.eventType === "room_started") {
      startedRoomIds.add(event.roomId);
      if (Number.isFinite(occurredAtMs) && !startedAtByRoom.has(event.roomId)) {
        startedAtByRoom.set(event.roomId, occurredAtMs);
      }
    }
    if (event.eventType === "room_finished") {
      finishedRoomIds.add(event.roomId);
      const startedAt = startedAtByRoom.get(event.roomId);
      if (startedAt !== undefined && Number.isFinite(occurredAtMs) && occurredAtMs >= startedAt) {
        finishedDurationsSeconds.push((occurredAtMs - startedAt) / 1000);
      }
    }
  }

  return {
    adapter: "in-process",
    averageFinishedGameMinutes:
      finishedDurationsSeconds.length > 0
        ? roundOneDecimal(finishedDurationsSeconds.reduce((sum, value) => sum + value, 0) / finishedDurationsSeconds.length / 60)
        : null,
    gamesFinished: finishedRoomIds.size,
    gamesStarted: startedRoomIds.size,
    recentDays: buildRecentDayBuckets(
      new Date(),
      events.map((event) => ({
        count: 1,
        day: formatMetricsDay(new Date(event.occurredAt)),
        event_type: event.eventType,
      })),
    ),
    totalPlayersEver: playerIds.size,
    totalRoomsEver: roomIds.size,
    trackedSince: trackedSinceMs === undefined ? undefined : new Date(trackedSinceMs).toISOString(),
  };
}

function buildRecentDayBuckets(
  now: Date,
  rows: Array<{ count: number; day: string; event_type: RoomAnalyticsEventType }>,
): RoomAnalyticsDayBucket[] {
  const buckets = new Map<string, RoomAnalyticsDayBucket>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - offset);
    const key = formatMetricsDay(day);
    buckets.set(key, {
      date: key,
      roomsCreated: 0,
      playersJoined: 0,
      gamesStarted: 0,
      gamesFinished: 0,
    });
  }

  for (const row of rows) {
    const bucket = buckets.get(row.day);
    if (!bucket) continue;
    const count = row.count ?? 0;
    if (row.event_type === "room_created") bucket.roomsCreated += count;
    if (row.event_type === "player_joined") bucket.playersJoined += count;
    if (row.event_type === "room_started") bucket.gamesStarted += count;
    if (row.event_type === "room_finished") bucket.gamesFinished += count;
  }

  return [...buckets.values()];
}

function formatMetricsDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: METRICS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function isPostgresRoomAnalyticsEnabled(): boolean {
  const url = getPostgresRoomAnalyticsDatabaseUrl();
  return Boolean(url?.startsWith("postgres://") || url?.startsWith("postgresql://"));
}

function getPostgresRoomAnalyticsPool(): Pool {
  globalForRoomAnalytics.aiWerewolfRoomAnalyticsPool ??= new Pool({
    connectionString: getPostgresRoomAnalyticsDatabaseUrl(),
  });
  return globalForRoomAnalytics.aiWerewolfRoomAnalyticsPool;
}

function getPostgresRoomAnalyticsDatabaseUrl(): string | undefined {
  return (
    process.env.AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL ??
    process.env.AI_WEREWOLF_ROOM_DATABASE_URL ??
    process.env.DATABASE_URL
  );
}

async function ensurePostgresRoomAnalyticsSchema(pool: Pool): Promise<void> {
  globalForRoomAnalytics.aiWerewolfRoomAnalyticsReady ??= pool
    .query(
      `
        create table if not exists ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE} (
          id bigserial primary key,
          event_type text not null,
          room_id text not null,
          room_code text,
          player_id text,
          occurred_at timestamptz not null,
          payload jsonb not null default '{}'::jsonb
        );
        create index if not exists ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}_occurred_at_idx
          on ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE} (occurred_at desc);
        create index if not exists ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}_room_type_idx
          on ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE} (room_id, event_type);
      `,
    )
    .then(() => undefined);
  await globalForRoomAnalytics.aiWerewolfRoomAnalyticsReady;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

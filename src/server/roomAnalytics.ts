import { Pool } from "pg";

export type RoomAnalyticsEventType =
  | "home_view"
  | "main_game_started"
  | "main_game_finished"
  | "room_created"
  | "player_joined"
  | "room_started"
  | "room_finished";

export type RoomAnalyticsEventInput = {
  eventType: RoomAnalyticsEventType;
  roomCode?: string;
  roomId?: string;
  playerId?: string;
  payload?: Record<string, unknown>;
  subjectId?: string;
};

export type RoomAnalyticsDayBucket = {
  date: string;
  homeViews: number;
  mainGamesFinished: number;
  mainGamesStarted: number;
  roomsCreated: number;
  playersJoined: number;
  gamesStarted: number;
  gamesFinished: number;
};

export type RoomAnalyticsHistorySnapshot = {
  adapter: "in-process" | "postgres";
  averageFinishedGameMinutes: number | null;
  averageMainGameMinutes: number | null;
  averageSiteGameMinutes: number | null;
  gamesFinished: number;
  gamesStarted: number;
  homeViews: number;
  mainCompletionRate: number | null;
  mainGamesFinished: number;
  mainGamesStarted: number;
  recentDays: RoomAnalyticsDayBucket[];
  roomCompletionRate: number | null;
  siteCompletionRate: number | null;
  totalFinishedGameMinutes: number;
  totalMainGameMinutes: number;
  totalSiteGameMinutes: number;
  totalPlayersEver: number;
  totalRoomsEver: number;
  trackedSince?: string;
};

type StoredRoomAnalyticsEvent = Omit<RoomAnalyticsEventInput, "roomId" | "subjectId"> & {
  occurredAt: string;
  roomId: string;
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
  const subjectId = input.roomId ?? input.subjectId;
  if (!subjectId) return;
  const event = {
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
        [event.eventType, subjectId, event.roomCode ?? null, event.playerId ?? null, event.occurredAt, JSON.stringify(event.payload)],
      );
      return;
    }

    roomAnalyticsEvents.push({ ...event, roomId: subjectId });
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
  const [totals, duration, mainDuration, days, trackedSince] = await Promise.all([
    pool.query<{
      games_finished: number;
      games_started: number;
      home_views: number;
      main_games_finished: number;
      main_games_started: number;
      total_players_ever: number;
      total_rooms_ever: number;
    }>(
      `
        select
          count(*) filter (where event_type = 'home_view')::int as home_views,
          count(distinct room_id) filter (where event_type = 'main_game_started')::int as main_games_started,
          count(distinct room_id) filter (where event_type = 'main_game_finished')::int as main_games_finished,
          count(distinct room_id) filter (where event_type = 'room_created')::int as total_rooms_ever,
          count(distinct player_id) filter (where event_type in ('room_created', 'player_joined') and player_id is not null)::int as total_players_ever,
          count(distinct room_id) filter (where event_type = 'room_started')::int as games_started,
          count(distinct room_id) filter (where event_type = 'room_finished')::int as games_finished
        from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
      `,
    ),
    pool.query<{ average_seconds: number | null; total_seconds: number | null }>(
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
        select
          avg(extract(epoch from (finished.finished_at - started.started_at)))::float as average_seconds,
          coalesce(sum(extract(epoch from (finished.finished_at - started.started_at))), 0)::float as total_seconds
        from started
        join finished on finished.room_id = started.room_id
        where finished.finished_at >= started.started_at
      `,
    ),
    pool.query<{ average_seconds: number | null; total_seconds: number | null }>(
      `
        with started as (
          select room_id, min(occurred_at) as started_at
          from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
          where event_type = 'main_game_started'
          group by room_id
        ),
        finished as (
          select room_id, min(occurred_at) as finished_at
          from ${POSTGRES_ROOM_ANALYTICS_EVENTS_TABLE}
          where event_type = 'main_game_finished'
          group by room_id
        )
        select
          avg(extract(epoch from (finished.finished_at - started.started_at)))::float as average_seconds,
          coalesce(sum(extract(epoch from (finished.finished_at - started.started_at))), 0)::float as total_seconds
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
            when event_type = 'home_view' then count(*)::int
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
  const totalFinishedSeconds = duration.rows[0]?.total_seconds ?? 0;
  const averageMainSeconds = mainDuration.rows[0]?.average_seconds;
  const totalMainSeconds = mainDuration.rows[0]?.total_seconds ?? 0;
  const trackedSinceValue = trackedSince.rows[0]?.tracked_since;
  const mainGamesStarted = totalRow?.main_games_started ?? 0;
  const mainGamesFinished = totalRow?.main_games_finished ?? 0;
  const gamesStarted = totalRow?.games_started ?? 0;
  const gamesFinished = totalRow?.games_finished ?? 0;
  const siteGamesStarted = mainGamesStarted + gamesStarted;
  const siteGamesFinished = mainGamesFinished + gamesFinished;
  const totalSiteSeconds = totalMainSeconds + totalFinishedSeconds;
  return {
    adapter: "postgres",
    averageFinishedGameMinutes: typeof averageSeconds === "number" ? roundOneDecimal(averageSeconds / 60) : null,
    averageMainGameMinutes: typeof averageMainSeconds === "number" ? roundOneDecimal(averageMainSeconds / 60) : null,
    averageSiteGameMinutes: siteGamesFinished > 0 ? roundOneDecimal(totalSiteSeconds / siteGamesFinished / 60) : null,
    gamesFinished,
    gamesStarted,
    homeViews: totalRow?.home_views ?? 0,
    mainCompletionRate: mainGamesStarted > 0 ? Math.round((mainGamesFinished / mainGamesStarted) * 100) : null,
    mainGamesFinished,
    mainGamesStarted,
    recentDays: buildRecentDayBuckets(new Date(), days.rows, trackedSinceValue ?? undefined),
    roomCompletionRate: gamesStarted > 0 ? Math.round((gamesFinished / gamesStarted) * 100) : null,
    siteCompletionRate: siteGamesStarted > 0 ? Math.round((siteGamesFinished / siteGamesStarted) * 100) : null,
    totalFinishedGameMinutes: roundOneDecimal(totalFinishedSeconds / 60),
    totalMainGameMinutes: roundOneDecimal(totalMainSeconds / 60),
    totalSiteGameMinutes: roundOneDecimal(totalSiteSeconds / 60),
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
  const mainStartedGameIds = new Set<string>();
  const mainFinishedGameIds = new Set<string>();
  const startedAtByRoom = new Map<string, number>();
  const mainStartedAtByGame = new Map<string, number>();
  const finishedDurationsSeconds: number[] = [];
  const mainDurationsSeconds: number[] = [];
  let totalFinishedDurationSeconds = 0;
  let totalMainDurationSeconds = 0;
  let homeViews = 0;
  let trackedSinceMs: number | undefined;

  for (const event of events) {
    const occurredAtMs = Date.parse(event.occurredAt);
    if (Number.isFinite(occurredAtMs)) {
      trackedSinceMs = trackedSinceMs === undefined ? occurredAtMs : Math.min(trackedSinceMs, occurredAtMs);
    }
    if (event.eventType === "home_view") homeViews += 1;
    if (event.eventType === "main_game_started" && event.roomId) {
      mainStartedGameIds.add(event.roomId);
      if (Number.isFinite(occurredAtMs) && !mainStartedAtByGame.has(event.roomId)) {
        mainStartedAtByGame.set(event.roomId, occurredAtMs);
      }
    }
    if (event.eventType === "main_game_finished" && event.roomId) {
      mainFinishedGameIds.add(event.roomId);
      const startedAt = mainStartedAtByGame.get(event.roomId);
      if (startedAt !== undefined && Number.isFinite(occurredAtMs) && occurredAtMs >= startedAt) {
        const durationSeconds = (occurredAtMs - startedAt) / 1000;
        mainDurationsSeconds.push(durationSeconds);
        totalMainDurationSeconds += durationSeconds;
      }
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
        const durationSeconds = (occurredAtMs - startedAt) / 1000;
        finishedDurationsSeconds.push(durationSeconds);
        totalFinishedDurationSeconds += durationSeconds;
      }
    }
  }

  const siteGamesStarted = mainStartedGameIds.size + startedRoomIds.size;
  const siteGamesFinished = mainFinishedGameIds.size + finishedRoomIds.size;
  const totalSiteDurationSeconds = totalMainDurationSeconds + totalFinishedDurationSeconds;

  return {
    adapter: "in-process",
    averageFinishedGameMinutes:
      finishedDurationsSeconds.length > 0
        ? roundOneDecimal(finishedDurationsSeconds.reduce((sum, value) => sum + value, 0) / finishedDurationsSeconds.length / 60)
        : null,
    averageMainGameMinutes:
      mainDurationsSeconds.length > 0
        ? roundOneDecimal(mainDurationsSeconds.reduce((sum, value) => sum + value, 0) / mainDurationsSeconds.length / 60)
        : null,
    averageSiteGameMinutes: siteGamesFinished > 0 ? roundOneDecimal(totalSiteDurationSeconds / siteGamesFinished / 60) : null,
    gamesFinished: finishedRoomIds.size,
    gamesStarted: startedRoomIds.size,
    homeViews,
    mainCompletionRate:
      mainStartedGameIds.size > 0 ? Math.round((mainFinishedGameIds.size / mainStartedGameIds.size) * 100) : null,
    mainGamesFinished: mainFinishedGameIds.size,
    mainGamesStarted: mainStartedGameIds.size,
    recentDays: buildRecentDayBuckets(
      new Date(),
      events.map((event) => ({
        count: 1,
        day: formatMetricsDay(new Date(event.occurredAt)),
        event_type: event.eventType,
      })),
      trackedSinceMs === undefined ? undefined : new Date(trackedSinceMs),
    ),
    roomCompletionRate:
      startedRoomIds.size > 0 ? Math.round((finishedRoomIds.size / startedRoomIds.size) * 100) : null,
    siteCompletionRate: siteGamesStarted > 0 ? Math.round((siteGamesFinished / siteGamesStarted) * 100) : null,
    totalFinishedGameMinutes: roundOneDecimal(totalFinishedDurationSeconds / 60),
    totalMainGameMinutes: roundOneDecimal(totalMainDurationSeconds / 60),
    totalSiteGameMinutes: roundOneDecimal(totalSiteDurationSeconds / 60),
    totalPlayersEver: playerIds.size,
    totalRoomsEver: roomIds.size,
    trackedSince: trackedSinceMs === undefined ? undefined : new Date(trackedSinceMs).toISOString(),
  };
}

function buildRecentDayBuckets(
  now: Date,
  rows: Array<{ count: number; day: string; event_type: RoomAnalyticsEventType }>,
  trackedSince?: Date,
): RoomAnalyticsDayBucket[] {
  const buckets = new Map<string, RoomAnalyticsDayBucket>();
  const earliestVisibleDay = trackedSince ? formatMetricsDay(trackedSince) : formatMetricsDay(now);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - offset);
    const key = formatMetricsDay(day);
    if (key < earliestVisibleDay) continue;
    buckets.set(key, {
      date: key,
      homeViews: 0,
      mainGamesFinished: 0,
      mainGamesStarted: 0,
      roomsCreated: 0,
      playersJoined: 0,
      gamesStarted: 0,
      gamesFinished: 0,
    });
  }
  if (buckets.size === 0) {
    const key = formatMetricsDay(now);
    buckets.set(key, {
      date: key,
      homeViews: 0,
      mainGamesFinished: 0,
      mainGamesStarted: 0,
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
    if (row.event_type === "home_view") bucket.homeViews += count;
    if (row.event_type === "main_game_started") bucket.mainGamesStarted += count;
    if (row.event_type === "main_game_finished") bucket.mainGamesFinished += count;
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

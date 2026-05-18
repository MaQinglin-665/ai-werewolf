import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { advanceOneAiStep, advancePendingAiTurns, advancePendingAiVotes, createConfiguredAiOptions } from "@/ai/mockAgent";
import { getBoardPreset, toBoardSnapshot } from "@/game/boards";
import { toHumanCommand } from "@/game/commandSchemas";
import type { HumanCommandInput } from "@/game/commandSchemas";
import { applyCommand, applySystemStep, createGame, getTurnRequirement } from "@/game/engine";
import { buildPlayerView } from "@/game/projection";
import type { AiFriendConfig, BoardSnapshot, GameState, HumanGameView, Phase, TurnRequirement } from "@/game/types";
import { getRoomAnalyticsHistorySnapshot, recordRoomAnalyticsEvent } from "@/server/roomAnalytics";
import { getRoomRateLimitStatus } from "@/server/roomRateLimit";
import { Pool } from "pg";

export type RoomStatus = "lobby" | "in_game" | "finished";

export type RoomPlayerView = {
  playerId: string;
  playerToken?: string;
  name: string;
  isHost: boolean;
  online: boolean;
  seatId?: number;
  lastSeenAt?: string;
};

export type RoomSeatView = {
  seatId: number;
  controller: "open" | "human" | "ai";
  playerId?: string;
  playerName?: string;
  aiName?: string;
};

export type RoomTurnView = {
  type: "lobby" | "finished" | TurnRequirement["type"];
  phase?: Phase;
  actorSeatId?: number;
  actorName?: string;
  actorController?: "human" | "ai";
  isSelfActor: boolean;
  canHostContinue: boolean;
  title: string;
  detail: string;
};

export type RoomView = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    revision: number;
    updatedAt: string;
    board: BoardSnapshot;
    hostPlayerId: string;
    players: RoomPlayerView[];
    seats: RoomSeatView[];
    gameId?: string;
  };
  turn: RoomTurnView;
  playerId?: string;
  playerToken?: string;
  playerSeatId?: number;
  game?: HumanGameView;
};

type RoomPlayer = {
  playerId: string;
  playerToken?: string;
  name: string;
  isHost: boolean;
  seatId?: number;
  joinedAt: string;
};

type RoomIdempotentWriteScope = "command";

type RoomIdempotentWrite = {
  scope: RoomIdempotentWriteScope;
  key: string;
  playerId: string;
  fingerprint: string;
  revision: number;
  createdAt: string;
};

type RoomRecord = {
  id: string;
  code: string;
  status: Exclude<RoomStatus, "finished">;
  boardId: string;
  hostPlayerId: string;
  players: RoomPlayer[];
  aiFriends?: AiFriendConfig[];
  gameState?: GameState;
  idempotentWrites?: RoomIdempotentWrite[];
  revision?: number;
  createdAt: string;
  updatedAt: string;
};

type PersistedRoomSessions = {
  version: 1;
  rooms: RoomRecord[];
};

type RoomCleanupPolicy = {
  enabled: boolean;
  lobbyIdleMs: number;
  inGameIdleMs: number;
  finishedIdleMs: number;
};

type RoomCleanupRun = {
  at: string;
  removed: number;
  roomCodes: string[];
  policy: RoomCleanupPolicy;
};

type RoomDebugCleanupResult = {
  ok: true;
  mode: "inactive";
  removed: number;
  roomCodes: string[];
  kept: {
    connected: number;
    excludedCurrent: boolean;
  };
  rooms: RoomRuntimeCounts;
};

type RoomCleanupState = {
  lastRunAt?: string;
  removedLastRun: number;
  roomCodesLastRun: string[];
};

type RoomPlayerPresence = {
  connections: number;
  lastSeenAt?: string;
};

type RoomRuntimeCounts = {
  total: number;
  lobby: number;
  inGame: number;
  maxRevision: number;
};

export type RoomMetricsSnapshot = {
  checkedAt: string;
  current: {
    humanPlayers: number;
    onlineConnections: number;
    onlinePlayers: number;
    rooms: {
      activeInGame: number;
      finished: number;
      inactiveInGame: number;
      lobby: number;
      total: number;
    };
  };
  history: Awaited<ReturnType<typeof getRoomAnalyticsHistorySnapshot>>;
};

type RoomDeploymentTarget = "single-node" | "single-node-online";
type RoomStorageMode = "memory-only" | "local-json" | "postgres";

type CreateRoomOptions = {
  boardId?: string;
  hostName?: string;
  hostSeatId?: number;
  aiFriends?: AiFriendConfig[];
};

type JoinRoomOptions = {
  playerName?: string;
  seatId?: number;
};

type RoomWriteOptions = {
  expectedRevision?: number;
  idempotencyKey?: string;
};

type RoomIdempotencyContext = {
  scope: RoomIdempotentWriteScope;
  key: string;
  playerId: string;
  fingerprint: string;
};

type PendingRoomWrite = {
  fingerprint: string;
  promise: Promise<RoomView>;
};

export type RoomPlayerCredential =
  | string
  | {
      playerId?: string;
      playerToken?: string;
    };

export type RoomUpdateEvent = {
  roomId: string;
  version: number;
  updatedAt: string;
};

export type RoomLeaveResult = {
  roomId: string;
  roomCode: string;
  playerId: string;
  deleted: boolean;
  nextHostPlayerId?: string;
};

type RoomUpdateListener = (event: RoomUpdateEvent) => void;

type RoomEventHub = {
  versions: Map<string, number>;
  subscribers: Map<string, Set<RoomUpdateListener>>;
};

type RoomRealtimeMode = "postgres-notify" | "sse-in-process";

type RoomRealtimeStatus = {
  mode: RoomRealtimeMode;
  channel?: string;
  crossProcessFanout: boolean;
};

type RoomRealtimeBus = {
  ensureReady(): Promise<void>;
  publish(event: RoomUpdateEvent): Promise<void>;
  status(): RoomRealtimeStatus;
};

type RoomPresenceStatus = {
  adapter: "in-process" | "postgres";
  heartbeatMs: number;
  shared: boolean;
  ttlMs: number;
};

type RoomPresenceConnection = {
  disconnect(): Promise<void>;
  refresh(): Promise<void>;
};

type RoomPresenceStore = {
  clear(): Promise<void>;
  connect(roomId: string, playerId: string): Promise<RoomPresenceConnection>;
  deleteRoom(roomId: string): Promise<void>;
  ensureReady(): Promise<void>;
  markSeen(roomId: string, playerId: string): Promise<void>;
  readRoom(roomId: string): Promise<Map<string, RoomPlayerPresence>>;
  status(): RoomPresenceStatus;
};

type RoomStore = {
  adapter: string;
  atomicWrites: boolean;
  all(): Promise<RoomRecord[]>;
  clear(): Promise<void>;
  compareAndSet(
    room: RoomRecord,
    options: { previousRevision: number },
  ): Promise<{ ok: true } | { ok: false; currentRevision?: number }>;
  delete(roomId: string): Promise<void>;
  get(roomId: string): Promise<RoomRecord | undefined>;
  persistenceEnabled(): boolean;
  persist(): Promise<void>;
  removePersisted(): Promise<void>;
  replaceAll(nextRooms: Iterable<RoomRecord>): Promise<void>;
  set(room: RoomRecord): Promise<void>;
  storageMode(): RoomStorageMode;
  storePath(): string;
  writeMode: string;
};

export const ROOM_SSE_HEARTBEAT_MS = 5000;
const DEFAULT_LOBBY_IDLE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_IN_GAME_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FINISHED_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const ROOM_IDEMPOTENCY_TTL_MS = 30 * 60 * 1000;
const ROOM_IDEMPOTENCY_MAX_PER_ROOM = 100;
const ROOM_IDEMPOTENCY_KEY_MAX_LENGTH = 120;
const POSTGRES_ROOM_TABLE = "ai_werewolf_room_sessions";
const POSTGRES_ROOM_EVENTS_CHANNEL = "ai_werewolf_room_events";
const POSTGRES_ROOM_PRESENCE_TABLE = "ai_werewolf_room_presence";
const POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE = "ai_werewolf_room_presence_connections";
const ROOM_PROCESS_ID = randomUUID();
const DEFAULT_ROOM_PRESENCE_HEARTBEAT_MS = ROOM_SSE_HEARTBEAT_MS;
const DEFAULT_ROOM_PRESENCE_TTL_MS = 20_000;

const BATCH_AI_AFTER_HUMAN_PHASES = new Set<Phase>([
  "DAY_VOTE",
  "SHERIFF_NOMINATION",
  "SHERIFF_WITHDRAWAL",
  "SHERIFF_VOTE",
  "SHERIFF_PK_VOTE",
]);

export class RoomSessionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RoomSessionError";
    this.status = status;
  }
}

const globalForRooms = globalThis as unknown as {
  aiWerewolfRoomEvents?: RoomEventHub;
  aiWerewolfRoomCleanupState?: RoomCleanupState;
  aiWerewolfRoomPresence?: Map<string, Map<string, RoomPlayerPresence>>;
  aiWerewolfRoomPresenceStore?: RoomPresenceStore;
  aiWerewolfRoomPendingWrites?: Map<string, PendingRoomWrite>;
  aiWerewolfRoomRealtimeBus?: RoomRealtimeBus;
  aiWerewolfRooms?: Map<string, RoomRecord>;
  aiWerewolfRoomStore?: RoomStore;
};

const roomStore = resolveRoomStore(globalForRooms.aiWerewolfRoomStore);
globalForRooms.aiWerewolfRoomStore = roomStore;
const roomRealtimeBus = resolveRoomRealtimeBus(globalForRooms.aiWerewolfRoomRealtimeBus);
globalForRooms.aiWerewolfRoomRealtimeBus = roomRealtimeBus;
const roomPresenceStore = resolveRoomPresenceStore(globalForRooms.aiWerewolfRoomPresenceStore);
globalForRooms.aiWerewolfRoomPresenceStore = roomPresenceStore;
const roomEvents = globalForRooms.aiWerewolfRoomEvents ?? {
  versions: new Map<string, number>(),
  subscribers: new Map<string, Set<RoomUpdateListener>>(),
};
globalForRooms.aiWerewolfRoomEvents = roomEvents;
const roomCleanupState = globalForRooms.aiWerewolfRoomCleanupState ?? {
  removedLastRun: 0,
  roomCodesLastRun: [],
};
globalForRooms.aiWerewolfRoomCleanupState = roomCleanupState;
const roomPresence = globalForRooms.aiWerewolfRoomPresence ?? new Map<string, Map<string, RoomPlayerPresence>>();
globalForRooms.aiWerewolfRoomPresence = roomPresence;
const roomPendingWrites = globalForRooms.aiWerewolfRoomPendingWrites ?? new Map<string, PendingRoomWrite>();
globalForRooms.aiWerewolfRoomPendingWrites = roomPendingWrites;
let roomRuntimeReady: Promise<void> | undefined;

async function ensureRoomRuntimeReady(): Promise<void> {
  roomRuntimeReady ??= (async () => {
    await roomRealtimeBus.ensureReady();
    await roomPresenceStore.ensureReady();
    if (await ensureAllRoomRuntimeMetadata()) {
      await roomStore.persist();
    }
  })();
  await roomRuntimeReady;
}

function resolveRoomStore(existingStore: RoomStore | undefined): RoomStore {
  if (
    existingStore &&
    typeof existingStore.compareAndSet === "function" &&
    typeof existingStore.atomicWrites === "boolean" &&
    typeof existingStore.writeMode === "string"
  ) {
    return existingStore;
  }

  if (isPostgresRoomStoreEnabled()) {
    return createPostgresRoomStore();
  }

  const existingRooms = globalForRooms.aiWerewolfRooms?.values() ?? loadPersistedRoomSessions().values();
  return createInProcessRoomStore(new Map([...existingRooms].map((room) => [room.id, room])));
}

function isPostgresRoomStoreEnabled(): boolean {
  return (
    process.env.AI_WEREWOLF_ROOM_STORE_ADAPTER === "postgres" ||
    process.env.AI_WEREWOLF_ROOM_STATE_ADAPTER === "postgres"
  );
}

function getPostgresRoomDatabaseUrl(): string {
  const url = process.env.AI_WEREWOLF_ROOM_DATABASE_URL ?? process.env.DATABASE_URL;
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) return url;
  throw new RoomSessionError(
    'AI_WEREWOLF_ROOM_STORE_ADAPTER="postgres" 时必须配置 PostgreSQL 连接串 AI_WEREWOLF_ROOM_DATABASE_URL 或 DATABASE_URL。',
    500,
  );
}

function resolveRoomRealtimeBus(existingBus: RoomRealtimeBus | undefined): RoomRealtimeBus {
  if (existingBus) return existingBus;
  if (isPostgresRoomRealtimeEnabled()) {
    return createPostgresRoomRealtimeBus();
  }
  return createInProcessRoomRealtimeBus();
}

function isPostgresRoomRealtimeEnabled(): boolean {
  return (
    process.env.AI_WEREWOLF_ROOM_REALTIME_ADAPTER === "postgres" ||
    process.env.AI_WEREWOLF_ROOM_EVENTS_ADAPTER === "postgres"
  );
}

function createInProcessRoomRealtimeBus(): RoomRealtimeBus {
  return {
    ensureReady: async () => undefined,
    publish: async () => undefined,
    status: () => ({
      mode: "sse-in-process",
      crossProcessFanout: false,
    }),
  };
}

function createPostgresRoomRealtimeBus(): RoomRealtimeBus {
  const databaseUrl = getPostgresRoomDatabaseUrl();
  const publishPool = new Pool({ connectionString: databaseUrl });
  let ready: Promise<void> | undefined;

  const ensureReady = async () => {
    ready ??= (async () => {
      const client = await publishPool.connect();
      client.on("notification", (message) => {
        if (message.channel !== POSTGRES_ROOM_EVENTS_CHANNEL || !message.payload) return;
        const event = decodePostgresRoomUpdate(message.payload);
        if (!event || event.sourceId === ROOM_PROCESS_ID) return;
        dispatchRoomUpdate(event);
      });
      client.on("error", (error) => {
        console.warn(`PostgreSQL 房间实时通道连接异常：${error.message}`);
        ready = undefined;
      });
      await client.query(`listen ${POSTGRES_ROOM_EVENTS_CHANNEL}`);
    })();
    await ready;
  };

  return {
    ensureReady,
    publish: async (event) => {
      await ensureReady();
      const payload = JSON.stringify({ ...event, sourceId: ROOM_PROCESS_ID });
      await publishPool.query("select pg_notify($1, $2)", [POSTGRES_ROOM_EVENTS_CHANNEL, payload]);
    },
    status: () => ({
      mode: "postgres-notify",
      channel: POSTGRES_ROOM_EVENTS_CHANNEL,
      crossProcessFanout: true,
    }),
  };
}

function decodePostgresRoomUpdate(payload: string): (RoomUpdateEvent & { sourceId?: string }) | undefined {
  try {
    const parsed = JSON.parse(payload) as Partial<RoomUpdateEvent & { sourceId?: string }>;
    if (
      typeof parsed.roomId === "string" &&
      typeof parsed.version === "number" &&
      Number.isInteger(parsed.version) &&
      parsed.version >= 1 &&
      typeof parsed.updatedAt === "string"
    ) {
      return {
        roomId: parsed.roomId,
        version: parsed.version,
        updatedAt: parsed.updatedAt,
        sourceId: typeof parsed.sourceId === "string" ? parsed.sourceId : undefined,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function resolveRoomPresenceStore(existingStore: RoomPresenceStore | undefined): RoomPresenceStore {
  if (existingStore) return existingStore;
  if (isPostgresRoomPresenceEnabled()) {
    return createPostgresRoomPresenceStore();
  }
  return createInProcessRoomPresenceStore();
}

function isPostgresRoomPresenceEnabled(): boolean {
  return process.env.AI_WEREWOLF_ROOM_PRESENCE_ADAPTER === "postgres";
}

function createInProcessRoomPresenceStore(): RoomPresenceStore {
  return {
    clear: async () => {
      roomPresence.clear();
    },
    connect: async (roomId, playerId) => {
      let closed = false;
      await updateInProcessRoomPresence(roomId, playerId, (presence) => ({
        connections: presence.connections + 1,
        lastSeenAt: new Date().toISOString(),
      }));
      return {
        disconnect: async () => {
          if (closed) return;
          closed = true;
          await updateInProcessRoomPresence(roomId, playerId, (presence) => ({
            connections: Math.max(0, presence.connections - 1),
            lastSeenAt: new Date().toISOString(),
          }));
        },
        refresh: async () => {
          if (closed) return;
          await updateInProcessRoomPresence(roomId, playerId, (presence) => ({
            ...presence,
            lastSeenAt: new Date().toISOString(),
          }));
        },
      };
    },
    deleteRoom: async (roomId) => {
      roomPresence.delete(roomId);
    },
    ensureReady: async () => undefined,
    markSeen: async (roomId, playerId) => {
      await updateInProcessRoomPresence(roomId, playerId, (presence) => ({
        ...presence,
        lastSeenAt: new Date().toISOString(),
      }));
    },
    readRoom: async (roomId) => new Map(roomPresence.get(roomId) ?? []),
    status: () => ({
      adapter: "in-process",
      heartbeatMs: readRoomPresenceHeartbeatMs(),
      shared: false,
      ttlMs: readRoomPresenceTtlMs(),
    }),
  };
}

function createPostgresRoomPresenceStore(): RoomPresenceStore {
  const databaseUrl = getPostgresRoomPresenceDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl });
  let initialized: Promise<void> | undefined;

  const ensureReady = async () => {
    initialized ??= pool.query(createPostgresRoomPresenceSchemaSql()).then(() => undefined);
    await initialized;
  };

  return {
    clear: async () => {
      await ensureReady();
      await pool.query(`delete from ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE}`);
      await pool.query(`delete from ${POSTGRES_ROOM_PRESENCE_TABLE}`);
    },
    connect: async (roomId, playerId) => {
      await ensureReady();
      const connectionId = randomUUID();
      let closed = false;
      const refresh = async () => {
        if (closed) return;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + readRoomPresenceTtlMs());
        await pool.query(
          `
            insert into ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE}
              (connection_id, room_id, player_id, last_seen_at, expires_at)
            values ($1, $2, $3, $4, $5)
            on conflict (connection_id) do update set
              last_seen_at = excluded.last_seen_at,
              expires_at = excluded.expires_at
          `,
          [connectionId, roomId, playerId, now, expiresAt],
        );
        await markPostgresRoomPlayerSeen(pool, roomId, playerId, now);
      };
      await refresh();
      return {
        disconnect: async () => {
          if (closed) return;
          closed = true;
          await pool.query(`delete from ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} where connection_id = $1`, [connectionId]);
          await markPostgresRoomPlayerSeen(pool, roomId, playerId, new Date());
        },
        refresh,
      };
    },
    deleteRoom: async (roomId) => {
      await ensureReady();
      await pool.query(`delete from ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} where room_id = $1`, [roomId]);
      await pool.query(`delete from ${POSTGRES_ROOM_PRESENCE_TABLE} where room_id = $1`, [roomId]);
    },
    ensureReady,
    markSeen: async (roomId, playerId) => {
      await ensureReady();
      await markPostgresRoomPlayerSeen(pool, roomId, playerId, new Date());
    },
    readRoom: async (roomId) => {
      await ensureReady();
      await pool.query(`delete from ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} where expires_at <= now()`);
      const result = await pool.query<{ connections: number; last_seen_at: Date | null; player_id: string }>(
        `
          select
            seen.player_id,
            seen.last_seen_at,
            count(conn.connection_id)::int as connections
          from ${POSTGRES_ROOM_PRESENCE_TABLE} seen
          left join ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} conn
            on conn.room_id = seen.room_id
            and conn.player_id = seen.player_id
            and conn.expires_at > now()
          where seen.room_id = $1
          group by seen.player_id, seen.last_seen_at
        `,
        [roomId],
      );
      return new Map(
        result.rows.map((row) => [
          row.player_id,
          {
            connections: row.connections,
            lastSeenAt: row.last_seen_at?.toISOString(),
          },
        ]),
      );
    },
    status: () => ({
      adapter: "postgres",
      heartbeatMs: readRoomPresenceHeartbeatMs(),
      shared: true,
      ttlMs: readRoomPresenceTtlMs(),
    }),
  };
}

async function updateInProcessRoomPresence(
  roomId: string,
  playerId: string,
  update: (presence: RoomPlayerPresence) => RoomPlayerPresence,
): Promise<void> {
  const byPlayer = roomPresence.get(roomId) ?? new Map<string, RoomPlayerPresence>();
  const current = byPlayer.get(playerId) ?? { connections: 0 };
  byPlayer.set(playerId, update(current));
  roomPresence.set(roomId, byPlayer);
}

async function markPostgresRoomPlayerSeen(pool: Pool, roomId: string, playerId: string, seenAt: Date): Promise<void> {
  await pool.query(
    `
      insert into ${POSTGRES_ROOM_PRESENCE_TABLE} (room_id, player_id, last_seen_at)
      values ($1, $2, $3)
      on conflict (room_id, player_id) do update set
        last_seen_at = greatest(${POSTGRES_ROOM_PRESENCE_TABLE}.last_seen_at, excluded.last_seen_at)
    `,
    [roomId, playerId, seenAt],
  );
}

function createPostgresRoomPresenceSchemaSql(): string {
  return `
    create table if not exists ${POSTGRES_ROOM_PRESENCE_TABLE} (
      room_id text not null,
      player_id text not null,
      last_seen_at timestamptz not null,
      primary key (room_id, player_id)
    );
    create table if not exists ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} (
      connection_id text primary key,
      room_id text not null,
      player_id text not null,
      last_seen_at timestamptz not null,
      expires_at timestamptz not null
    );
    create index if not exists ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE}_room_player_idx
      on ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} (room_id, player_id, expires_at);
    create index if not exists ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE}_expires_at_idx
      on ${POSTGRES_ROOM_PRESENCE_CONNECTIONS_TABLE} (expires_at);
  `;
}

function getPostgresRoomPresenceDatabaseUrl(): string {
  const url = process.env.AI_WEREWOLF_ROOM_PRESENCE_DATABASE_URL ?? process.env.AI_WEREWOLF_ROOM_DATABASE_URL ?? process.env.DATABASE_URL;
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) return url;
  throw new RoomSessionError(
    'AI_WEREWOLF_ROOM_PRESENCE_ADAPTER="postgres" 时必须配置 PostgreSQL 连接串 AI_WEREWOLF_ROOM_PRESENCE_DATABASE_URL、AI_WEREWOLF_ROOM_DATABASE_URL 或 DATABASE_URL。',
    500,
  );
}

function readRoomPresenceHeartbeatMs(): number {
  return readNonNegativeIntegerEnv("AI_WEREWOLF_ROOM_PRESENCE_HEARTBEAT_MS", DEFAULT_ROOM_PRESENCE_HEARTBEAT_MS);
}

function readRoomPresenceTtlMs(): number {
  return readNonNegativeIntegerEnv("AI_WEREWOLF_ROOM_PRESENCE_TTL_MS", DEFAULT_ROOM_PRESENCE_TTL_MS);
}

function getRoomStorePath(): string {
  return process.env.AI_WEREWOLF_ROOM_STORE_PATH ?? join(process.cwd(), ".local", "rooms.json");
}

function isRoomPersistenceEnabled(): boolean {
  if (process.env.AI_WEREWOLF_ROOM_PERSISTENCE === "0") return false;
  return process.env.NODE_ENV !== "test" || Boolean(process.env.AI_WEREWOLF_ROOM_STORE_PATH);
}

function loadPersistedRoomSessions(): Map<string, RoomRecord> {
  if (!isRoomPersistenceEnabled()) return new Map();

  const storePath = getRoomStorePath();
  if (!existsSync(storePath)) return new Map();

  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as Partial<PersistedRoomSessions>;
    if (parsed.version !== 1 || !Array.isArray(parsed.rooms)) return new Map();
    return new Map(parsed.rooms.filter(isPersistableRoomRecord).map((room) => [room.id, room]));
  } catch (error) {
    console.warn(`读取房间持久化文件失败：${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
}

function createInProcessRoomStore(initialRooms: Map<string, RoomRecord>): RoomStore {
  const records = new Map([...initialRooms].map(([roomId, room]) => [roomId, cloneRoomRecord(room)]));
  return {
    adapter: "in-process-room-store",
    atomicWrites: true,
    all: async () => [...records.values()].map(cloneRoomRecord),
    clear: async () => {
      records.clear();
    },
    compareAndSet: async (room, options) => {
      const current = records.get(room.id);
      if (!current || roomRevision(current) !== options.previousRevision || roomRevision(room) !== options.previousRevision + 1) {
        return { ok: false, currentRevision: current ? roomRevision(current) : undefined };
      }
      records.set(room.id, cloneRoomRecord(room));
      return { ok: true };
    },
    delete: async (roomId) => {
      records.delete(roomId);
    },
    get: async (roomId) => {
      const room = records.get(roomId);
      return room ? cloneRoomRecord(room) : undefined;
    },
    persistenceEnabled: isRoomPersistenceEnabled,
    persist: async () => persistRoomRecords(records.values()),
    removePersisted: async () => removePersistedRoomRecords(),
    replaceAll: async (nextRooms) => {
      records.clear();
      for (const room of nextRooms) {
        records.set(room.id, cloneRoomRecord(room));
      }
    },
    set: async (room) => {
      records.set(room.id, cloneRoomRecord(room));
    },
    storageMode: () => (isRoomPersistenceEnabled() ? "local-json" : "memory-only"),
    storePath: getRoomStorePath,
    writeMode: "compare-and-set",
  };
}

function createPostgresRoomStore(): RoomStore {
  const databaseUrl = getPostgresRoomDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl });
  let initialized: Promise<void> | undefined;

  const ensureInitialized = async () => {
    initialized ??= pool.query(createPostgresRoomStoreSchemaSql()).then(() => undefined);
    await initialized;
  };

  const writeRoom = async (room: RoomRecord) => {
    await ensureInitialized();
    await pool.query(
      `
        insert into ${POSTGRES_ROOM_TABLE} (id, code, status, revision, updated_at, payload)
        values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (id) do update set
          code = excluded.code,
          status = excluded.status,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `,
      [room.id, room.code, room.status, roomRevision(room), room.updatedAt, JSON.stringify(cloneRoomRecord(room))],
    );
  };

  return {
    adapter: "postgres-room-store",
    atomicWrites: true,
    all: async () => {
      await ensureInitialized();
      const result = await pool.query<{ payload: unknown }>(
        `select payload from ${POSTGRES_ROOM_TABLE} order by updated_at desc`,
      );
      return result.rows.flatMap((row) => decodePostgresRoomRecord(row.payload));
    },
    clear: async () => {
      await ensureInitialized();
      await pool.query(`delete from ${POSTGRES_ROOM_TABLE}`);
    },
    compareAndSet: async (room, options) => {
      await ensureInitialized();
      if (roomRevision(room) !== options.previousRevision + 1) {
        return { ok: false, currentRevision: undefined };
      }
      const result = await pool.query(
        `
          update ${POSTGRES_ROOM_TABLE}
          set code = $2, status = $3, revision = $4, updated_at = $5, payload = $6::jsonb
          where id = $1 and revision = $7
        `,
        [
          room.id,
          room.code,
          room.status,
          roomRevision(room),
          room.updatedAt,
          JSON.stringify(cloneRoomRecord(room)),
          options.previousRevision,
        ],
      );
      if (result.rowCount === 1) return { ok: true };
      const current = await pool.query<{ revision: number }>(`select revision from ${POSTGRES_ROOM_TABLE} where id = $1`, [
        room.id,
      ]);
      return { ok: false, currentRevision: current.rows[0]?.revision };
    },
    delete: async (roomId) => {
      await ensureInitialized();
      await pool.query(`delete from ${POSTGRES_ROOM_TABLE} where id = $1`, [roomId]);
    },
    get: async (roomId) => {
      await ensureInitialized();
      const result = await pool.query<{ payload: unknown }>(`select payload from ${POSTGRES_ROOM_TABLE} where id = $1`, [
        roomId,
      ]);
      return decodePostgresRoomRecord(result.rows[0]?.payload)[0];
    },
    persistenceEnabled: () => true,
    persist: async () => undefined,
    removePersisted: async () => {
      await ensureInitialized();
      await pool.query(`delete from ${POSTGRES_ROOM_TABLE}`);
    },
    replaceAll: async (nextRooms) => {
      await ensureInitialized();
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(`delete from ${POSTGRES_ROOM_TABLE}`);
        for (const room of nextRooms) {
          await client.query(
            `
              insert into ${POSTGRES_ROOM_TABLE} (id, code, status, revision, updated_at, payload)
              values ($1, $2, $3, $4, $5, $6::jsonb)
            `,
            [room.id, room.code, room.status, roomRevision(room), room.updatedAt, JSON.stringify(cloneRoomRecord(room))],
          );
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    set: writeRoom,
    storageMode: () => "postgres",
    storePath: () => redactPostgresUrl(databaseUrl),
    writeMode: "postgres-compare-and-set",
  };
}

function createPostgresRoomStoreSchemaSql(): string {
  return `
    create table if not exists ${POSTGRES_ROOM_TABLE} (
      id text primary key,
      code text not null unique,
      status text not null,
      revision integer not null,
      updated_at timestamptz not null,
      payload jsonb not null
    );
    create index if not exists ${POSTGRES_ROOM_TABLE}_updated_at_idx on ${POSTGRES_ROOM_TABLE} (updated_at desc);
  `;
}

function decodePostgresRoomRecord(value: unknown): RoomRecord[] {
  if (value === undefined || value === null) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return isPersistableRoomRecord(parsed) ? [cloneRoomRecord(parsed)] : [];
  } catch {
    return [];
  }
}

function redactPostgresUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) url.username = "user";
    if (url.password) url.password = "";
    return url.toString();
  } catch {
    return "postgres";
  }
}

function cloneRoomRecord(room: RoomRecord): RoomRecord {
  return JSON.parse(JSON.stringify(room)) as RoomRecord;
}

function persistRoomRecords(roomRecords: Iterable<RoomRecord>): void {
  if (!isRoomPersistenceEnabled()) return;

  const storePath = getRoomStorePath();
  try {
    mkdirSync(dirname(storePath), { recursive: true });
    const payload: PersistedRoomSessions = {
      version: 1,
      rooms: [...roomRecords],
    };
    writeFileSync(storePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    console.warn(`写入房间持久化文件失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function removePersistedRoomRecords(): void {
  if (!isRoomPersistenceEnabled()) return;
  rmSync(getRoomStorePath(), { force: true });
}

function isPersistableRoomRecord(value: unknown): value is RoomRecord {
  if (!value || typeof value !== "object") return false;
  const room = value as Partial<RoomRecord>;
  return (
    typeof room.id === "string" &&
    typeof room.code === "string" &&
    (room.status === "lobby" || room.status === "in_game") &&
    typeof room.boardId === "string" &&
    typeof room.hostPlayerId === "string" &&
    Array.isArray(room.players) &&
    room.players.every(isPersistableRoomPlayer) &&
    (room.idempotentWrites === undefined ||
      (Array.isArray(room.idempotentWrites) && room.idempotentWrites.every(isPersistableRoomIdempotentWrite))) &&
    (room.revision === undefined || (typeof room.revision === "number" && Number.isInteger(room.revision) && room.revision >= 1)) &&
    typeof room.createdAt === "string" &&
    typeof room.updatedAt === "string"
  );
}

function isPersistableRoomIdempotentWrite(value: unknown): value is RoomIdempotentWrite {
  if (!value || typeof value !== "object") return false;
  const write = value as Partial<RoomIdempotentWrite>;
  return (
    write.scope === "command" &&
    typeof write.key === "string" &&
    typeof write.playerId === "string" &&
    typeof write.fingerprint === "string" &&
    typeof write.revision === "number" &&
    Number.isInteger(write.revision) &&
    write.revision >= 1 &&
    typeof write.createdAt === "string"
  );
}

function isPersistableRoomPlayer(value: unknown): value is RoomPlayer {
  if (!value || typeof value !== "object") return false;
  const player = value as Partial<RoomPlayer>;
  return (
    typeof player.playerId === "string" &&
    (player.playerToken === undefined || typeof player.playerToken === "string") &&
    typeof player.name === "string" &&
    typeof player.isHost === "boolean" &&
    (player.seatId === undefined || typeof player.seatId === "number") &&
    typeof player.joinedAt === "string"
  );
}

export async function createRoomSession(options: CreateRoomOptions = {}): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  await cleanupExpiredRoomSessions();
  const board = getBoardPreset(options.boardId);
  const now = new Date().toISOString();
  const hostPlayerId = randomUUID();
  const room: RoomRecord = {
    id: randomUUID(),
    code: await createUniqueRoomCode(),
    status: "lobby",
    boardId: board.id,
    hostPlayerId,
    revision: 1,
    players: [
      {
        playerId: hostPlayerId,
        playerToken: createPlayerToken(),
        name: sanitizePlayerName(options.hostName, "房主"),
        isHost: true,
        joinedAt: now,
      },
    ],
    aiFriends: options.aiFriends,
    createdAt: now,
    updatedAt: now,
  };

  await roomStore.set(room);
  if (options.hostSeatId !== undefined) {
    await assignSeat(room, hostPlayerId, options.hostSeatId);
  } else {
    await roomStore.persist();
  }
  await recordRoomAnalyticsEvent({
    eventType: "room_created",
    playerId: hostPlayerId,
    roomCode: room.code,
    roomId: room.id,
    payload: {
      boardId: room.boardId,
      hostSeatId: options.hostSeatId,
      playerCount: room.players.length,
    },
  });
  return buildRoomView(room, hostPlayerId);
}

export async function joinRoomSession(roomIdOrCode: string, options: JoinRoomOptions = {}): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  const previousRevision = roomRevision(room);
  if (room.status !== "lobby") {
    return restoreStartedRoomPlayer(room, options);
  }

  const board = getBoardPreset(room.boardId);
  if (room.players.length >= board.seatCount) {
    throw new RoomSessionError("房间真人人数已满。");
  }

  const player: RoomPlayer = {
    playerId: randomUUID(),
    playerToken: createPlayerToken(),
    name: sanitizePlayerName(options.playerName, `玩家${room.players.length + 1}`),
    isHost: false,
    seatId: pickJoinSeatId(room, options.seatId),
    joinedAt: new Date().toISOString(),
  };
  room.players.push(player);
  await touchRoom(room, { previousRevision });
  await recordRoomAnalyticsEvent({
    eventType: "player_joined",
    playerId: player.playerId,
    roomCode: room.code,
    roomId: room.id,
    payload: {
      boardId: room.boardId,
      playerCount: room.players.length,
      seatId: player.seatId,
    },
  });

  return buildRoomView(room, player.playerId);
}

async function restoreStartedRoomPlayer(room: RoomRecord, options: JoinRoomOptions): Promise<RoomView> {
  if (!options.seatId) {
    throw new RoomSessionError("房间已经开局，请选择你原来的座位并使用相同昵称恢复。", 409);
  }

  const expectedName = sanitizePlayerName(options.playerName, "");
  const player = room.players.find((item) => item.seatId === options.seatId);
  if (!player) {
    throw new RoomSessionError("房间已经开局，不能加入新座位。请选择你原来的座位恢复。", 409);
  }

  if (expectedName && player.name !== expectedName) {
    throw new RoomSessionError("房间已经开局，昵称和原座位不匹配。请使用原昵称或恢复链接。", 409);
  }

  return buildRoomView(room, player.playerId);
}

export async function setRoomPlayerSeat(
  roomIdOrCode: string,
  credential: RoomPlayerCredential,
  seatId: number | null,
  options: RoomWriteOptions = {},
): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  assertLobby(room);
  const previousRevision = assertExpectedRoomRevision(room, options.expectedRevision);
  const player = requirePlayerByCredential(room, credential);
  if (seatId === null) {
    room.players = room.players.map((item) => (item.playerId === player.playerId ? { ...item, seatId: undefined } : item));
    await touchRoom(room, { previousRevision });
    return buildRoomView(room, player.playerId);
  }

  await assignSeat(room, player.playerId, seatId, previousRevision);
  return buildRoomView(room, player.playerId);
}

export async function leaveRoomSession(
  roomIdOrCode: string,
  credential: RoomPlayerCredential,
  options: RoomWriteOptions = {},
): Promise<RoomLeaveResult> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  assertLobby(room);
  const previousRevision = assertExpectedRoomRevision(room, options.expectedRevision);
  const leavingPlayer = requirePlayerByCredential(room, credential);
  const result: RoomLeaveResult = {
    roomId: room.id,
    roomCode: room.code,
    playerId: leavingPlayer.playerId,
    deleted: false,
  };

  room.players = room.players.filter((player) => player.playerId !== leavingPlayer.playerId);
  if (room.players.length === 0) {
    bumpRoomRevision(room, { previousRevision });
    await roomStore.delete(room.id);
    await roomStore.persist();
    await publishRoomUpdate(room);
    return { ...result, deleted: true };
  }

  if (room.hostPlayerId === leavingPlayer.playerId) {
    const nextHost = room.players[0];
    room.hostPlayerId = nextHost.playerId;
    room.players = room.players.map((player) => ({
      ...player,
      isHost: player.playerId === nextHost.playerId,
    }));
    result.nextHostPlayerId = nextHost.playerId;
  }

  await touchRoom(room, { previousRevision });
  return result;
}

export async function removeRoomPlayerSession(
  roomIdOrCode: string,
  requesterCredential: RoomPlayerCredential,
  targetPlayerId: string,
  options: RoomWriteOptions = {},
): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  assertLobby(room);
  const previousRevision = assertExpectedRoomRevision(room, options.expectedRevision);
  const requester = requirePlayerByCredential(room, requesterCredential);
  requirePlayer(room, targetPlayerId);

  if (!requester.isHost) {
    throw new RoomSessionError("只有房主可以移除房间玩家。", 403);
  }
  if (requester.playerId === targetPlayerId) {
    throw new RoomSessionError("房主不能移除自己，请使用离开房间。", 409);
  }

  room.players = room.players.filter((player) => player.playerId !== targetPlayerId);
  await touchRoom(room, { previousRevision });
  return buildRoomView(room, requester.playerId);
}

export async function startRoomSession(
  roomIdOrCode: string,
  credential: RoomPlayerCredential,
  options: RoomWriteOptions = {},
): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  assertLobby(room);
  const previousRevision = assertExpectedRoomRevision(room, options.expectedRevision);
  const requester = requirePlayerByCredential(room, credential);
  if (!requester.isHost) {
    throw new RoomSessionError("只有房主可以开始房间。", 403);
  }

  autoAssignUnseatedPlayers(room);
  const humanSeatIds = new Set(room.players.map((player) => player.seatId).filter((seatId): seatId is number => Boolean(seatId)));
  if (humanSeatIds.size === 0) {
    throw new RoomSessionError("至少需要一名真人玩家入座。");
  }

  const primaryHumanSeatId = requester.seatId ?? [...humanSeatIds][0];
  let state = createGame({
    boardId: room.boardId,
    humanSeatId: primaryHumanSeatId,
    aiFriends: room.aiFriends,
  });
  state = applyRoomSeatControllers(state, room.players);
  room.gameState = state;
  room.status = "in_game";
  await touchRoom(room, { previousRevision });
  await recordRoomAnalyticsEvent({
    eventType: "room_started",
    playerId: requester.playerId,
    roomCode: room.code,
    roomId: room.id,
    payload: {
      boardId: room.boardId,
      humanPlayers: room.players.length,
      seatCount: getBoardPreset(room.boardId).seatCount,
    },
  });

  return buildRoomView(room, requester.playerId);
}

export async function getRoomSessionView(roomIdOrCode: string, credential?: RoomPlayerCredential): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  const player = credential === undefined ? undefined : requirePlayerByCredential(room, credential);
  return buildRoomView(room, player?.playerId);
}

export async function subscribeRoomSessionUpdates(
  roomIdOrCode: string,
  credential: RoomPlayerCredential,
  listener: RoomUpdateListener,
): Promise<() => void> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  const player = requirePlayerByCredential(room, credential);
  const subscribers = roomEvents.subscribers.get(room.id) ?? new Set<RoomUpdateListener>();
  const presenceConnection = await markRoomPlayerConnected(room, player.playerId);
  const presenceHeartbeatTimer = setInterval(() => {
    void presenceConnection.refresh();
  }, readRoomPresenceHeartbeatMs());
  await publishRoomUpdate(room, { crossProcess: false });
  subscribers.add(listener);
  roomEvents.subscribers.set(room.id, subscribers);

  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      roomEvents.subscribers.delete(room.id);
    }
    clearInterval(presenceHeartbeatTimer);
    void presenceConnection.disconnect();
    void publishRoomUpdate(room, { crossProcess: false });
  };
}

export async function submitRoomPlayerCommand(
  roomIdOrCode: string,
  credential: RoomPlayerCredential,
  input: HumanCommandInput,
  options: RoomWriteOptions = {},
): Promise<RoomView> {
  await ensureRoomRuntimeReady();
  const room = await requireRoom(roomIdOrCode);
  const player = requirePlayerByCredential(room, credential);
  assertInGame(room);
  const idempotencyKey = normalizeRoomIdempotencyKey(options.idempotencyKey);
  const idempotency: RoomIdempotencyContext | undefined = idempotencyKey
    ? {
        scope: "command",
        key: idempotencyKey,
        playerId: player.playerId,
        fingerprint: createRoomCommandFingerprint(input),
      }
    : undefined;

  if (idempotency) {
    const replayed = readCompletedRoomIdempotentWrite(room, idempotency);
    if (replayed) {
      return buildRoomView(room, player.playerId);
    }

    const pendingKey = createPendingRoomWriteKey(room.id, idempotency);
    const pending = roomPendingWrites.get(pendingKey);
    if (pending) {
      assertSameRoomIdempotencyFingerprint(pending.fingerprint, idempotency.fingerprint);
      return pending.promise;
    }

    return applyPendingRoomPlayerCommand(room, player, input, options.expectedRevision, idempotency);
  }

  const previousRevision = assertExpectedRoomRevision(room, options.expectedRevision);

  if (input.type === "continue") {
    return continueRoom(room, player);
  }

  if (!player.seatId) {
    throw new RoomSessionError("玩家尚未入座，不能提交动作。", 409);
  }

  const state = room.gameState;
  if (!state) {
    throw new RoomSessionError("房间尚未开局。", 409);
  }
  const wasFinished = Boolean(state.result);

  const playerView = buildPlayerView(state, player.seatId, { allowFlowControls: player.isHost });
  const allowedAction = playerView.availableActions.find((action) => action.type === input.type);
  if (!allowedAction) {
    throw new RoomSessionError("还没有轮到该玩家执行这个动作。", 409);
  }

  let nextState = applyCommand(state, toHumanCommand(input, player.seatId));
  if (shouldBatchAiAfterHumanCommand(input.type)) {
    const advanced = await advancePendingAiTurns(nextState, BATCH_AI_AFTER_HUMAN_PHASES, createConfiguredAiOptions());
    nextState = revealCompletedVote(advanced.state);
  }

  room.gameState = nextState;
  await touchRoom(room, { previousRevision });
  await recordRoomFinishedIfNeeded(room, wasFinished);
  return buildRoomView(room, player.playerId);
}

async function applyPendingRoomPlayerCommand(
  room: RoomRecord,
  player: RoomPlayer,
  input: HumanCommandInput,
  expectedRevision: number | undefined,
  idempotency: RoomIdempotencyContext,
): Promise<RoomView> {
  let resolvePending: (view: RoomView) => void = () => undefined;
  let rejectPending: (error: unknown) => void = () => undefined;
  const pendingPromise = new Promise<RoomView>((resolve, reject) => {
    resolvePending = resolve;
    rejectPending = reject;
  });
  pendingPromise.catch(() => undefined);
  roomPendingWrites.set(createPendingRoomWriteKey(room.id, idempotency), {
    fingerprint: idempotency.fingerprint,
    promise: pendingPromise,
  });

  try {
    const view = await applyIdempotentRoomPlayerCommand(room, player, input, expectedRevision, idempotency);
    resolvePending(view);
    return view;
  } catch (error) {
    rejectPending(error);
    throw error;
  } finally {
    roomPendingWrites.delete(createPendingRoomWriteKey(room.id, idempotency));
  }
}

async function applyIdempotentRoomPlayerCommand(
  room: RoomRecord,
  player: RoomPlayer,
  input: HumanCommandInput,
  expectedRevision: number | undefined,
  idempotency: RoomIdempotencyContext,
): Promise<RoomView> {
  const previousRevision = assertExpectedRoomRevision(room, expectedRevision);

  if (input.type === "continue") {
    return continueRoom(room, player, idempotency);
  }

  if (!player.seatId) {
    throw new RoomSessionError("玩家尚未入座，不能提交动作。", 409);
  }

  const state = room.gameState;
  if (!state) {
    throw new RoomSessionError("房间尚未开局。", 409);
  }
  const wasFinished = Boolean(state.result);

  const playerView = buildPlayerView(state, player.seatId, { allowFlowControls: player.isHost });
  const allowedAction = playerView.availableActions.find((action) => action.type === input.type);
  if (!allowedAction) {
    throw new RoomSessionError("还没有轮到该玩家执行这个动作。", 409);
  }

  let nextState = applyCommand(state, toHumanCommand(input, player.seatId));
  if (shouldBatchAiAfterHumanCommand(input.type)) {
    const advanced = await advancePendingAiTurns(nextState, BATCH_AI_AFTER_HUMAN_PHASES, createConfiguredAiOptions());
    nextState = revealCompletedVote(advanced.state);
  }

  room.gameState = nextState;
  rememberCompletedRoomIdempotentWrite(room, idempotency);
  await touchRoom(room, { previousRevision });
  await recordRoomFinishedIfNeeded(room, wasFinished);
  return buildRoomView(room, player.playerId);
}

export async function clearRoomSessionsForTests(options: { keepStorage?: boolean } = {}): Promise<void> {
  await roomStore.clear();
  roomEvents.versions.clear();
  roomEvents.subscribers.clear();
  await roomPresenceStore.clear();
  roomPendingWrites.clear();
  if (!options.keepStorage) {
    await roomStore.removePersisted();
  }
  roomRuntimeReady = undefined;
}

export async function reloadRoomSessionsFromStorageForTests(): Promise<void> {
  await roomStore.replaceAll(loadPersistedRoomSessions().values());
  if (await ensureAllRoomRuntimeMetadata()) {
    await roomStore.persist();
  }
}

export async function cleanupExpiredRoomSessions(now = new Date()): Promise<RoomCleanupRun> {
  const policy = getRoomCleanupPolicy();
  const at = now.toISOString();
  const rooms = await roomStore.all();
  const expiredRooms = policy.enabled
    ? rooms.filter((room) => !roomEvents.subscribers.has(room.id) && isRoomExpired(room, now.getTime(), policy))
    : [];

  await removeRoomRecords(expiredRooms);

  const result: RoomCleanupRun = {
    at,
    removed: expiredRooms.length,
    roomCodes: expiredRooms.map((room) => room.code),
    policy,
  };
  roomCleanupState.lastRunAt = result.at;
  roomCleanupState.removedLastRun = result.removed;
  roomCleanupState.roomCodesLastRun = result.roomCodes;
  return result;
}

export async function cleanupInactiveRoomSessionsForDev(
  options: { excludeRoomIdOrCode?: string } = {},
): Promise<RoomDebugCleanupResult> {
  await ensureRoomRuntimeReady();
  if (!isRoomDebugCleanupEnabled()) {
    throw new RoomSessionError("房间调试清理仅在开发环境可用。", 403);
  }

  await cleanupExpiredRoomSessions();
  const excludedRoom = options.excludeRoomIdOrCode ? await findRoomRecord(options.excludeRoomIdOrCode) : undefined;
  const rooms = await roomStore.all();
  const inactiveRooms = rooms.filter((room) => room.id !== excludedRoom?.id && !roomEvents.subscribers.has(room.id));
  await removeRoomRecords(inactiveRooms);

  roomCleanupState.lastRunAt = new Date().toISOString();
  roomCleanupState.removedLastRun = inactiveRooms.length;
  roomCleanupState.roomCodesLastRun = inactiveRooms.map((room) => room.code);

  return {
    ok: true,
    mode: "inactive",
    removed: inactiveRooms.length,
    roomCodes: inactiveRooms.map((room) => room.code),
    kept: {
      connected: (await roomStore.all()).filter((room) => roomEvents.subscribers.has(room.id)).length,
      excludedCurrent: Boolean(excludedRoom),
    },
    rooms: await summarizeRoomCounts(),
  };
}

export async function getRoomRuntimeStatus() {
  await ensureRoomRuntimeReady();
  const cleanup = await cleanupExpiredRoomSessions();
  const storageEnabled = roomStore.persistenceEnabled();
  const storePath = roomStore.storePath();
  const storageMode = roomStore.storageMode();
  const rateLimit = getRoomRateLimitStatus();
  const realtimeStatus = roomRealtimeBus.status();
  const presenceStatus = roomPresenceStore.status();
  const subscriberCount = [...roomEvents.subscribers.values()].reduce((sum, subscribers) => sum + subscribers.size, 0);
  const deploymentTarget = readRoomDeploymentTarget();
  const publicOrigin = readRoomPublicOrigin();
  const deploymentRequirements = {
    atomicRoomWrites: roomStore.atomicWrites,
    basicRateLimit: rateLimit.enabled,
    httpsPublicOrigin: Boolean(publicOrigin?.startsWith("https://")),
    persistentRoomStore: storageEnabled,
    postgresRoomState: storageMode === "postgres",
    sharedRateLimit: rateLimit.shared,
    sharedPresence: presenceStatus.shared,
    sharedRealtime: realtimeStatus.crossProcessFanout,
    singleNodeProcess: true,
    sseRealtime: true,
  };
  const onlineReady =
    deploymentTarget === "single-node-online" &&
    deploymentRequirements.atomicRoomWrites &&
    deploymentRequirements.httpsPublicOrigin &&
    deploymentRequirements.persistentRoomStore &&
    deploymentRequirements.singleNodeProcess &&
    deploymentRequirements.sseRealtime;
  const productionMinimumReady =
    onlineReady &&
    deploymentRequirements.basicRateLimit &&
    deploymentRequirements.postgresRoomState &&
    deploymentRequirements.sharedRateLimit &&
    deploymentRequirements.sharedPresence &&
    deploymentRequirements.sharedRealtime;

  return {
    ok: true,
    rooms: await summarizeRoomCounts(),
    cleanup: {
      enabled: cleanup.policy.enabled,
      lastRunAt: cleanup.at,
      removedLastRun: cleanup.removed,
      roomCodesLastRun: cleanup.roomCodes,
      policy: {
        lobbyIdleMs: cleanup.policy.lobbyIdleMs,
        inGameIdleMs: cleanup.policy.inGameIdleMs,
        finishedIdleMs: cleanup.policy.finishedIdleMs,
      },
    },
    storage: {
      adapter: roomStore.adapter,
      enabled: storageEnabled,
      mode: storageMode,
      revisioned: true,
      revisionMode: "monotonic-room-revision",
      atomicWrites: roomStore.atomicWrites,
      writeMode: roomStore.writeMode,
      path: storageEnabled ? storePath : undefined,
      envPathConfigured: Boolean(process.env.AI_WEREWOLF_ROOM_STORE_PATH || process.env.AI_WEREWOLF_ROOM_DATABASE_URL),
    },
    realtime: {
      mode: realtimeStatus.mode,
      channel: realtimeStatus.channel,
      crossProcessFanout: realtimeStatus.crossProcessFanout,
      heartbeatMs: ROOM_SSE_HEARTBEAT_MS,
      roomsWithSubscribers: roomEvents.subscribers.size,
      subscriberCount,
    },
    presence: presenceStatus,
    rateLimit,
    deployment: {
      target: deploymentTarget,
      onlineReady,
      productionMinimumReady,
      publicOrigin,
      publicOriginConfigured: Boolean(publicOrigin),
      requirements: deploymentRequirements,
      processLocalEvents: !realtimeStatus.crossProcessFanout,
      multiInstanceSafe: false,
      warnings: [
        ...(deploymentTarget === "single-node-online" && !onlineReady
          ? ["线上单节点模式尚未满足所有最低条件，请检查 public origin、持久化和实时通道。"]
          : []),
        ...(deploymentTarget === "single-node" ? ["当前仍是本地/内测单节点模式，未声明公网联机入口。"] : []),
        ...(realtimeStatus.crossProcessFanout
          ? ["SSE 连接仍由各 Node 进程持有，PostgreSQL NOTIFY 负责跨进程唤醒。"]
          : ["房间 SSE 事件当前只在同一个 Node 进程内广播。"]),
        ...(storageMode !== "postgres" ? ["本地 JSON 持久化适合单进程 Alpha，不适合多实例或 Serverless 横向扩容。"] : []),
        ...(storageMode !== "postgres" ? ["生产化最小闭环需要 PostgreSQL 房间状态。"] : []),
        ...(!realtimeStatus.crossProcessFanout ? ["生产化最小闭环需要 PostgreSQL 房间实时通知。"] : []),
        ...(rateLimit.enabled && !rateLimit.shared
          ? ["基础限流当前仍在单进程内统计，横向扩容前需要换成共享限流。"]
          : []),
        ...(!presenceStatus.shared ? ["在线状态当前仍在单进程内统计，多进程部署前需要共享 presence。"] : []),
        "公网部署前需要固定玩家凭据、HTTPS 和可跨实例同步的房间状态。",
      ],
    },
  };
}

export async function getRoomMetricsSnapshot(): Promise<RoomMetricsSnapshot> {
  await ensureRoomRuntimeReady();
  await cleanupExpiredRoomSessions();
  const rooms = await roomStore.all();
  const currentUniquePlayerIds = new Set<string>();
  const onlinePlayerIds = new Set<string>();
  const checkedAt = new Date();
  let inactiveInGameRooms = 0;
  let onlineConnections = 0;
  let activeRoomGameSeconds = 0;
  for (const room of rooms) {
    for (const player of room.players) {
      currentUniquePlayerIds.add(player.playerId);
    }
    const presence = await readRoomPresence(room);
    let roomOnlinePlayers = 0;
    for (const [playerId, value] of presence) {
      if ((value.connections ?? 0) <= 0) continue;
      onlinePlayerIds.add(playerId);
      roomOnlinePlayers += 1;
      onlineConnections += value.connections;
    }
    if (room.status === "in_game" && !room.gameState?.result && roomOnlinePlayers === 0) {
      inactiveInGameRooms += 1;
    }
    if (room.status === "in_game" && !room.gameState?.result) {
      activeRoomGameSeconds += getRoomObservedElapsedSeconds(room, presence, roomOnlinePlayers > 0, checkedAt);
    }
  }

  const history = await getRoomAnalyticsHistorySnapshot();
  const activeRoomGameMinutes = roundOneDecimal(activeRoomGameSeconds / 60);
  const totalRoomGameMinutes = roundOneDecimal(history.totalFinishedGameMinutes + activeRoomGameMinutes);
  return {
    checkedAt: checkedAt.toISOString(),
    current: {
      humanPlayers: currentUniquePlayerIds.size,
      onlineConnections,
      onlinePlayers: onlinePlayerIds.size,
      rooms: {
        activeInGame: rooms.filter((room) => room.status === "in_game" && !room.gameState?.result).length,
        finished: rooms.filter((room) => Boolean(room.gameState?.result)).length,
        inactiveInGame: inactiveInGameRooms,
        lobby: rooms.filter((room) => room.status === "lobby").length,
        total: rooms.length,
      },
    },
    history: {
      ...history,
      activeRoomGameMinutes,
      totalPlayersEver: Math.max(history.totalPlayersEver, currentUniquePlayerIds.size),
      totalRoomGameMinutes,
      totalRoomsEver: Math.max(history.totalRoomsEver, rooms.length),
      totalSiteGameMinutes: roundOneDecimal(history.totalMainGameMinutes + totalRoomGameMinutes),
    },
  };
}

function getRoomObservedElapsedSeconds(
  room: RoomRecord,
  presence: Map<string, RoomPlayerPresence>,
  hasOnlinePlayers: boolean,
  now: Date,
): number {
  const startedAtMs = Date.parse(room.gameState?.createdAt ?? room.updatedAt);
  if (!Number.isFinite(startedAtMs)) return 0;
  const endAtMs = hasOnlinePlayers ? now.getTime() : getLastObservedRoomActivityMs(room, presence, startedAtMs);
  return Math.max(0, (endAtMs - startedAtMs) / 1000);
}

function getLastObservedRoomActivityMs(
  room: RoomRecord,
  presence: Map<string, RoomPlayerPresence>,
  fallbackMs: number,
): number {
  const updatedAtMs = Date.parse(room.updatedAt);
  let latestMs = Number.isFinite(updatedAtMs) ? updatedAtMs : fallbackMs;
  for (const value of presence.values()) {
    if (!value.lastSeenAt) continue;
    const lastSeenAtMs = Date.parse(value.lastSeenAt);
    if (Number.isFinite(lastSeenAtMs)) {
      latestMs = Math.max(latestMs, lastSeenAtMs);
    }
  }
  return latestMs;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function readRoomDeploymentTarget(): RoomDeploymentTarget {
  return process.env.AI_WEREWOLF_ROOM_DEPLOYMENT === "single-node-online" ? "single-node-online" : "single-node";
}

function readRoomPublicOrigin(): string | undefined {
  return normalizeRoomOrigin(
    process.env.AI_WEREWOLF_PUBLIC_ORIGIN ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      process.env.RENDER_EXTERNAL_URL,
  );
}

function normalizeRoomOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const raw = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

async function continueRoom(room: RoomRecord, player: RoomPlayer, idempotency?: RoomIdempotencyContext): Promise<RoomView> {
  const previousRevision = roomRevision(room);
  if (!player.isHost) {
    throw new RoomSessionError("只有房主可以推进房间流程。", 403);
  }

  const state = room.gameState;
  if (!state) {
    throw new RoomSessionError("房间尚未开局。", 409);
  }
  const wasFinished = Boolean(state.result);

  const requirement = getTurnRequirement(state);
  if (requirement.type === "human") {
    throw new RoomSessionError("正在等待真人玩家行动，不能由房主跳过。", 409);
  }

  const advanced =
    state.phase === "DAY_VOTE"
      ? await advancePendingAiVotes(state, createConfiguredAiOptions())
      : await advanceOneAiStep(state, createConfiguredAiOptions());
  room.gameState = state.phase === "DAY_VOTE" ? revealCompletedVote(advanced.state) : advanced.state;
  if (idempotency) {
    rememberCompletedRoomIdempotentWrite(room, idempotency);
  }
  await touchRoom(room, { previousRevision });
  await recordRoomFinishedIfNeeded(room, wasFinished);
  return buildRoomView(room, player.playerId);
}

async function recordRoomFinishedIfNeeded(room: RoomRecord, wasFinished: boolean): Promise<void> {
  const result = room.gameState?.result;
  if (wasFinished || !result) return;
  await recordRoomAnalyticsEvent({
    eventType: "room_finished",
    roomCode: room.code,
    roomId: room.id,
    payload: {
      boardId: room.boardId,
      humanPlayers: room.players.length,
      winner: result.winner,
    },
  });
}

function revealCompletedVote(state: GameState): GameState {
  return state.phase === "EXILE_RESOLUTION" ? applySystemStep(state) : state;
}

function shouldBatchAiAfterHumanCommand(type: HumanCommandInput["type"]): boolean {
  return type === "vote" || type === "sheriffNominate" || type === "sheriffWithdraw" || type === "sheriffVote";
}

function applyRoomSeatControllers(state: GameState, players: RoomPlayer[]): GameState {
  const playerBySeatId = new Map(players.flatMap((player) => (player.seatId ? [[player.seatId, player]] : [])));
  for (const seat of state.seats) {
    const player = playerBySeatId.get(seat.seatId);
    if (!player) {
      seat.isAi = true;
      continue;
    }

    seat.name = player.name;
    seat.isAi = false;
    seat.persona = undefined;
    seat.aiFriendId = undefined;
    seat.avatarDataUrl = undefined;
    seat.llmConfig = undefined;
    seat.ttsVoice = undefined;
    seat.ttsConfig = undefined;
  }
  state.setup = state.setup
    ? {
        ...state.setup,
        aiFriends: state.setup.aiFriends.filter((friend) => !playerBySeatId.has(friend.seatId)),
      }
    : undefined;
  state.spectatorMode = false;
  return state;
}

async function buildRoomView(room: RoomRecord, playerId: string | undefined): Promise<RoomView> {
  if (ensureRoomRuntimeMetadata(room)) {
    await roomStore.set(room);
    await roomStore.persist();
  }
  const player = playerId ? room.players.find((item) => item.playerId === playerId) : undefined;
  if (player) {
    await markRoomPlayerSeen(room, player.playerId);
  }
  const roomPresenceByPlayer = await readRoomPresence(room);
  const canViewPlayerTokens = Boolean(player?.isHost);
  const board = toBoardSnapshot(getBoardPreset(room.boardId));
  const status: RoomStatus = room.gameState?.result ? "finished" : room.status;
  const requirement = room.gameState ? getTurnRequirement(room.gameState) : undefined;
  const canHostContinue = Boolean(player?.isHost && requirement && requirement.type !== "human");

  return {
    room: {
      id: room.id,
      code: room.code,
      status,
      revision: roomRevision(room),
      updatedAt: room.updatedAt,
      board,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((item) => ({
        playerId: item.playerId,
        playerToken: canViewPlayerTokens || item.playerId === player?.playerId ? item.playerToken : undefined,
        name: item.name,
        isHost: item.isHost,
        online: isRoomPlayerOnline(roomPresenceByPlayer, item.playerId),
        seatId: item.seatId,
        lastSeenAt: roomPresenceByPlayer.get(item.playerId)?.lastSeenAt,
      })),
      seats: buildRoomSeats(room, board.seatCount),
      gameId: room.gameState?.id,
    },
    turn: buildRoomTurnView(room, player, requirement),
    playerId,
    playerToken: player?.playerToken,
    playerSeatId: player?.seatId,
    game: room.gameState
      ? buildPlayerView(room.gameState, player?.seatId ?? null, {
          allowFlowControls: canHostContinue,
        })
      : undefined,
  };
}

function buildRoomTurnView(
  room: RoomRecord,
  player: RoomPlayer | undefined,
  requirement: TurnRequirement | undefined,
): RoomTurnView {
  const state = room.gameState;
  if (!state) {
    return {
      type: "lobby",
      isSelfActor: false,
      canHostContinue: false,
      title: "大厅中",
      detail: "等待玩家入座和房主开局。",
    };
  }

  if (state.result) {
    return {
      type: "finished",
      phase: state.phase,
      isSelfActor: false,
      canHostContinue: false,
      title: "游戏结束",
      detail: state.result.winner === "GOOD" ? "好人阵营胜利。" : "狼人阵营胜利。",
    };
  }

  const currentRequirement = requirement ?? getTurnRequirement(state);
  const isActorRequirement = currentRequirement.type === "human" || currentRequirement.type === "ai";
  const rawActorSeatId = isActorRequirement ? currentRequirement.actorSeatId : undefined;
  const actorIsVisible =
    rawActorSeatId !== undefined &&
    (currentRequirement.type === "ai" ||
      rawActorSeatId === player?.seatId ||
      isPublicRoomActorPhase(state.phase));
  const actor = actorIsVisible ? state.seats.find((seat) => seat.seatId === rawActorSeatId) : undefined;
  const isSelfActor = Boolean(currentRequirement.type === "human" && rawActorSeatId === player?.seatId);
  const canHostContinue = Boolean(player?.isHost && currentRequirement.type !== "human");

  if (currentRequirement.type === "human") {
    if (isSelfActor) {
      return {
        type: "human",
        phase: state.phase,
        actorSeatId: rawActorSeatId,
        actorName: actor?.name,
        actorController: "human",
        isSelfActor,
        canHostContinue,
        title: "轮到你行动",
        detail: "提交动作后房间会自动刷新到下一步。",
      };
    }

    return {
      type: "human",
      phase: state.phase,
      actorSeatId: actor?.seatId,
      actorName: actor?.name,
      actorController: actor ? "human" : undefined,
      isSelfActor,
      canHostContinue,
      title: actor ? `等待 ${actor.seatId}号 ${actor.name}` : "等待真人玩家",
      detail: actor ? "当前真人玩家尚未提交动作。" : "当前是私密行动阶段，等待对应真人玩家提交。",
    };
  }

  if (currentRequirement.type === "ai") {
    return {
      type: "ai",
      phase: state.phase,
      actorSeatId: actor?.seatId,
      actorName: actor?.name,
      actorController: "ai",
      isSelfActor,
      canHostContinue,
      title: actor ? `等待 AI ${actor.seatId}号` : "等待 AI 行动",
      detail: canHostContinue ? "房主可以推进 AI 流程。" : "等待房主推进 AI 流程。",
    };
  }

  if (currentRequirement.type === "system") {
    return {
      type: "system",
      phase: state.phase,
      isSelfActor,
      canHostContinue,
      title: "等待系统流程",
      detail: canHostContinue ? "房主可以继续结算当前阶段。" : "等待房主继续结算当前阶段。",
    };
  }

  return {
    type: "none",
    phase: state.phase,
    isSelfActor,
    canHostContinue,
    title: "暂无待处理动作",
    detail: "当前阶段没有等待中的真人或 AI 动作。",
  };
}

function buildRoomSeats(room: RoomRecord, seatCount: number): RoomSeatView[] {
  return Array.from({ length: seatCount }, (_, index) => {
    const seatId = index + 1;
    const player = room.players.find((item) => item.seatId === seatId);
    if (player) {
      return {
        seatId,
        controller: "human",
        playerId: player.playerId,
        playerName: player.name,
      };
    }

    const aiSeat = room.gameState?.seats.find((seat) => seat.seatId === seatId);
    return {
      seatId,
      controller: room.status === "lobby" ? "open" : "ai",
      aiName: room.status === "lobby" ? undefined : aiSeat?.name,
    };
  });
}

function isPublicRoomActorPhase(phase: Phase): boolean {
  return (
    phase === "DAY_SPEECH" ||
    phase === "DAY_VOTE" ||
    phase === "LAST_WORDS" ||
    phase === "WOLF_KING_SHOT" ||
    phase === "SHERIFF_NOMINATION" ||
    phase === "SHERIFF_SPEECH" ||
    phase === "SHERIFF_WITHDRAWAL" ||
    phase === "SHERIFF_VOTE" ||
    phase === "SHERIFF_PK_SPEECH" ||
    phase === "SHERIFF_PK_VOTE" ||
    phase === "SHERIFF_HANDOFF"
  );
}

async function assignSeat(room: RoomRecord, playerId: string, seatId: number, previousRevision = roomRevision(room)): Promise<void> {
  const board = getBoardPreset(room.boardId);
  if (seatId < 1 || seatId > board.seatCount) {
    throw new RoomSessionError(`座位必须在 1 到 ${board.seatCount} 之间。`);
  }

  const player = requirePlayer(room, playerId);
  const occupied = room.players.find((item) => item.playerId !== playerId && item.seatId === seatId);
  if (occupied) {
    throw new RoomSessionError(`${seatId}号位已被占用。`, 409);
  }

  player.seatId = seatId;
  await touchRoom(room, { previousRevision });
}

function pickJoinSeatId(room: RoomRecord, requestedSeatId: number | undefined): number {
  const board = getBoardPreset(room.boardId);
  const occupied = new Set(room.players.map((player) => player.seatId).filter((seatId): seatId is number => Boolean(seatId)));
  if (
    requestedSeatId !== undefined &&
    requestedSeatId >= 1 &&
    requestedSeatId <= board.seatCount &&
    !occupied.has(requestedSeatId)
  ) {
    return requestedSeatId;
  }

  const firstOpenSeatId = Array.from({ length: board.seatCount }, (_, index) => index + 1).find((seatId) => !occupied.has(seatId));
  if (!firstOpenSeatId) {
    throw new RoomSessionError("没有空座位可以分配。");
  }
  return firstOpenSeatId;
}

function autoAssignUnseatedPlayers(room: RoomRecord): void {
  const board = getBoardPreset(room.boardId);
  const occupied = new Set(room.players.map((player) => player.seatId).filter((seatId): seatId is number => Boolean(seatId)));
  for (const player of room.players) {
    if (player.seatId) continue;
    const seatId = Array.from({ length: board.seatCount }, (_, index) => index + 1).find((candidate) => !occupied.has(candidate));
    if (!seatId) {
      throw new RoomSessionError("没有空座位可以分配。");
    }
    player.seatId = seatId;
    occupied.add(seatId);
  }
}

async function requireRoom(roomIdOrCode: string): Promise<RoomRecord> {
  await cleanupExpiredRoomSessions();
  const room = await findRoomRecord(roomIdOrCode);
  if (room) return room;

  throw new RoomSessionError("房间不存在。", 404);
}

async function findRoomRecord(roomIdOrCode: string): Promise<RoomRecord | undefined> {
  const direct = await roomStore.get(roomIdOrCode);
  if (direct) return direct;

  const normalizedCode = roomIdOrCode.trim().toUpperCase();
  return (await roomStore.all()).find((room) => room.code === normalizedCode);
}

function requirePlayerByCredential(room: RoomRecord, credential: RoomPlayerCredential): RoomPlayer {
  const playerId = typeof credential === "string" ? credential : credential.playerId;
  const playerToken = typeof credential === "string" ? undefined : credential.playerToken;

  if (playerToken) {
    const player = room.players.find((item) => item.playerToken === playerToken);
    if (!player) {
      throw new RoomSessionError("玩家凭据无效。", 403);
    }
    if (playerId && player.playerId !== playerId) {
      throw new RoomSessionError("玩家凭据和玩家身份不匹配。", 403);
    }
    return player;
  }

  if (!playerId) {
    throw new RoomSessionError("缺少玩家凭据。", 400);
  }
  return requirePlayer(room, playerId);
}

function requirePlayer(room: RoomRecord, playerId: string): RoomPlayer {
  const player = room.players.find((item) => item.playerId === playerId);
  if (!player) {
    throw new RoomSessionError("玩家不在该房间。", 403);
  }
  return player;
}

function assertLobby(room: RoomRecord): void {
  if (room.status !== "lobby") {
    throw new RoomSessionError("房间已经开局，不能再修改座位。", 409);
  }
}

function assertInGame(room: RoomRecord): void {
  if (room.status !== "in_game" || !room.gameState) {
    throw new RoomSessionError("房间尚未开局。", 409);
  }
}

function assertExpectedRoomRevision(room: RoomRecord, expectedRevision: number | undefined): number {
  const currentRevision = roomRevision(room);
  if (expectedRevision === undefined) return currentRevision;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new RoomSessionError("房间版本参数不合法。", 400);
  }
  if (expectedRevision !== currentRevision) {
    throw new RoomSessionError("房间状态已更新，请刷新后重试。", 409);
  }
  return currentRevision;
}

function normalizeRoomIdempotencyKey(idempotencyKey: string | undefined): string | undefined {
  if (idempotencyKey === undefined) return undefined;
  const clean = idempotencyKey.trim();
  if (!clean || clean.length > ROOM_IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new RoomSessionError("幂等键参数不合法。", 400);
  }
  return clean;
}

function createRoomCommandFingerprint(input: HumanCommandInput): string {
  return stableStringify(input);
}

function createPendingRoomWriteKey(roomId: string, idempotency: RoomIdempotencyContext): string {
  return stableStringify([roomId, idempotency.scope, idempotency.playerId, idempotency.key]);
}

function readCompletedRoomIdempotentWrite(
  room: RoomRecord,
  idempotency: RoomIdempotencyContext,
): RoomIdempotentWrite | undefined {
  pruneRoomIdempotentWrites(room);
  const write = room.idempotentWrites?.find(
    (item) => item.scope === idempotency.scope && item.playerId === idempotency.playerId && item.key === idempotency.key,
  );
  if (!write) return undefined;
  assertSameRoomIdempotencyFingerprint(write.fingerprint, idempotency.fingerprint);
  return write;
}

function rememberCompletedRoomIdempotentWrite(room: RoomRecord, idempotency: RoomIdempotencyContext): void {
  pruneRoomIdempotentWrites(room);
  const write: RoomIdempotentWrite = {
    ...idempotency,
    revision: roomRevision(room) + 1,
    createdAt: new Date().toISOString(),
  };
  const existingWrites = room.idempotentWrites ?? [];
  room.idempotentWrites = [
    ...existingWrites.filter(
      (item) => !(item.scope === idempotency.scope && item.playerId === idempotency.playerId && item.key === idempotency.key),
    ),
    write,
  ].slice(-ROOM_IDEMPOTENCY_MAX_PER_ROOM);
}

function pruneRoomIdempotentWrites(room: RoomRecord): void {
  if (!room.idempotentWrites?.length) return;
  const cutoff = Date.now() - ROOM_IDEMPOTENCY_TTL_MS;
  const nextWrites = room.idempotentWrites
    .filter((write) => {
      const createdAtMs = Date.parse(write.createdAt);
      return Number.isFinite(createdAtMs) && createdAtMs >= cutoff;
    })
    .slice(-ROOM_IDEMPOTENCY_MAX_PER_ROOM);
  room.idempotentWrites = nextWrites.length > 0 ? nextWrites : undefined;
}

function assertSameRoomIdempotencyFingerprint(left: string, right: string): void {
  if (left !== right) {
    throw new RoomSessionError("该幂等键已用于其他动作。", 409);
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

async function touchRoom(room: RoomRecord, options: { previousRevision?: number } = {}): Promise<void> {
  const previousRevision = options.previousRevision ?? roomRevision(room);
  if (roomRevision(room) !== previousRevision) {
    throw new RoomSessionError("房间状态已更新，请刷新后重试。", 409);
  }
  room.revision = previousRevision + 1;
  room.updatedAt = new Date().toISOString();
  const result = await roomStore.compareAndSet(room, { previousRevision });
  if (!result.ok) {
    throw new RoomSessionError("房间状态已更新，请刷新后重试。", 409);
  }
  await roomStore.persist();
  await publishRoomUpdate(room);
}

async function removeRoomRecords(removedRooms: RoomRecord[]): Promise<void> {
  for (const room of removedRooms) {
    bumpRoomRevision(room);
    await roomStore.delete(room.id);
    await roomPresenceStore.deleteRoom(room.id);
  }
  if (removedRooms.length > 0) {
    await roomStore.persist();
  }
  for (const room of removedRooms) {
    await publishRoomUpdate(room);
    if (!roomEvents.subscribers.has(room.id)) {
      roomEvents.versions.delete(room.id);
    }
  }
}

async function summarizeRoomCounts(): Promise<RoomRuntimeCounts> {
  const roomList = await roomStore.all();
  return {
    total: roomList.length,
    lobby: roomList.filter((room) => room.status === "lobby").length,
    inGame: roomList.filter((room) => room.status === "in_game").length,
    maxRevision: roomList.reduce((max, room) => Math.max(max, roomRevision(room)), 0),
  };
}

function readRoomPresence(room: RoomRecord): Promise<Map<string, RoomPlayerPresence>> {
  return roomPresenceStore.readRoom(room.id);
}

function markRoomPlayerSeen(room: RoomRecord, playerId: string): Promise<void> {
  return roomPresenceStore.markSeen(room.id, playerId);
}

function markRoomPlayerConnected(room: RoomRecord, playerId: string): Promise<RoomPresenceConnection> {
  return roomPresenceStore.connect(room.id, playerId);
}

function isRoomPlayerOnline(roomPresenceByPlayer: Map<string, RoomPlayerPresence>, playerId: string): boolean {
  return (roomPresenceByPlayer.get(playerId)?.connections ?? 0) > 0;
}

function roomRevision(room: RoomRecord): number {
  const revision = room.revision;
  return typeof revision === "number" && Number.isInteger(revision) && revision > 0 ? revision : 1;
}

function bumpRoomRevision(room: RoomRecord, options: { previousRevision?: number } = {}): void {
  const previousRevision = options.previousRevision ?? roomRevision(room);
  if (roomRevision(room) !== previousRevision) {
    throw new RoomSessionError("房间状态已更新，请刷新后重试。", 409);
  }
  room.revision = previousRevision + 1;
  room.updatedAt = new Date().toISOString();
}

function createPlayerToken(): string {
  return `rpt_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
}

async function ensureAllRoomRuntimeMetadata(): Promise<boolean> {
  let changed = false;
  for (const room of await roomStore.all()) {
    if (ensureRoomRuntimeMetadata(room)) {
      await roomStore.set(room);
      changed = true;
    }
  }
  return changed;
}

function ensureRoomRuntimeMetadata(room: RoomRecord): boolean {
  let changed = false;
  if (!Number.isInteger(room.revision) || (room.revision ?? 0) < 1) {
    room.revision = 1;
    changed = true;
  }
  for (const player of room.players) {
    if (!player.playerToken) {
      player.playerToken = createPlayerToken();
      changed = true;
    }
  }
  return changed;
}

function isRoomDebugCleanupEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.AI_WEREWOLF_ROOM_DEBUG_TOOLS === "1";
}

function getRoomCleanupPolicy(): RoomCleanupPolicy {
  return {
    enabled: process.env.AI_WEREWOLF_ROOM_CLEANUP !== "0",
    lobbyIdleMs: readNonNegativeIntegerEnv("AI_WEREWOLF_ROOM_LOBBY_IDLE_TTL_MS", DEFAULT_LOBBY_IDLE_TTL_MS),
    inGameIdleMs: readNonNegativeIntegerEnv("AI_WEREWOLF_ROOM_IN_GAME_IDLE_TTL_MS", DEFAULT_IN_GAME_IDLE_TTL_MS),
    finishedIdleMs: readNonNegativeIntegerEnv("AI_WEREWOLF_ROOM_FINISHED_IDLE_TTL_MS", DEFAULT_FINISHED_IDLE_TTL_MS),
  };
}

function readNonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function isRoomExpired(room: RoomRecord, nowMs: number, policy: RoomCleanupPolicy): boolean {
  const updatedAtMs = Date.parse(room.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return true;
  const idleMs = Math.max(0, nowMs - updatedAtMs);
  const status = room.gameState?.result ? "finished" : room.status;
  if (status === "lobby") return idleMs >= policy.lobbyIdleMs;
  if (status === "finished") return idleMs >= policy.finishedIdleMs;
  return idleMs >= policy.inGameIdleMs;
}

async function publishRoomUpdate(room: RoomRecord, options: { crossProcess?: boolean } = {}): Promise<void> {
  const version = roomRevision(room);
  const event: RoomUpdateEvent = {
    roomId: room.id,
    version,
    updatedAt: room.updatedAt,
  };

  dispatchRoomUpdate(event);
  if (options.crossProcess !== false) {
    await roomRealtimeBus.publish(event);
  }
}

function dispatchRoomUpdate(event: RoomUpdateEvent): void {
  roomEvents.versions.set(event.roomId, event.version);
  for (const listener of roomEvents.subscribers.get(event.roomId) ?? []) {
    listener(event);
  }
}

async function createUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!(await roomStore.all()).some((room) => room.code === code)) return code;
  }
  return randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
}

function sanitizePlayerName(value: string | undefined, fallback: string): string {
  const clean = value?.trim().replace(/\s+/g, " ").slice(0, 16);
  return clean || fallback;
}

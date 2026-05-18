import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { clearRoomSessionsForTests, reloadRoomSessionsFromStorageForTests } from "@/server/roomService";
import { clearRoomAnalyticsForTests } from "@/server/roomAnalytics";
import { clearRoomRateLimitsForTests } from "@/server/roomRateLimit";
import type { RoomView } from "@/server/roomService";
import type { AvailableHumanAction } from "@/game/types";
import { POST as submitRoomCommand } from "./[roomId]/commands/route";
import { POST as joinRoom } from "./[roomId]/join/route";
import { POST as leaveRoom } from "./[roomId]/leave/route";
import { POST as removeRoomPlayer } from "./[roomId]/remove/route";
import { POST as setRoomSeat } from "./[roomId]/seats/route";
import { POST as startRoom } from "./[roomId]/start/route";
import { POST as debugCleanupRooms } from "./debug-cleanup/route";
import { GET as streamRoom } from "./[roomId]/stream/route";
import { GET as getRoomView } from "./[roomId]/view/route";
import { GET as getRoomHealth } from "./health/route";
import { GET as getRoomMetrics } from "./metrics/route";
import { POST as createRoom } from "./route";

describe("room api routes", () => {
  beforeEach(async () => {
    await clearRoomSessionsForTests();
    await clearRoomAnalyticsForTests();
    clearRoomRateLimitsForTests();
  });

  it("creates a room, joins a second player, starts with AI fill, and returns private player views", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as RoomView;

    const joinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.code}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(joinResponse.status).toBe(200);
    const joined = (await joinResponse.json()) as RoomView;
    expect(created.playerToken).toMatch(/^rpt_/);
    expect(joined.playerToken).toMatch(/^rpt_/);
    expect(created.room.revision).toBeGreaterThanOrEqual(1);
    expect(created.room.updatedAt).toEqual(expect.any(String));
    expect(joined.room.revision).toBeGreaterThan(created.room.revision);
    expect(created.room.players.find((player) => player.playerId === created.playerId)?.playerToken).toBe(created.playerToken);
    expect(joined.room.players.find((player) => player.playerId === joined.playerId)?.playerToken).toBe(joined.playerToken);

    const startResponse = await startRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/start`, {
        method: "POST",
        body: JSON.stringify({ playerId: created.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(startResponse.status).toBe(200);
    const hostStarted = (await startResponse.json()) as RoomView;
    expect(hostStarted.room.status).toBe("in_game");
    expect(hostStarted.room.revision).toBeGreaterThan(joined.room.revision);
    expect(hostStarted.room.seats.filter((seat) => seat.controller === "human")).toHaveLength(2);
    expect(hostStarted.room.seats.filter((seat) => seat.controller === "ai")).toHaveLength(7);
    expect(hostStarted.game?.humanSeatId).toBe(1);
    expect(hostStarted.game?.myRole).toBeDefined();
    expectVisibleRoleIsOnlySelfOrWolfTeammate(hostStarted, 2);

    const guestViewResponse = await getRoomView(
      new Request(`http://localhost/api/rooms/${created.room.id}/view?playerId=${joined.playerId}`),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(guestViewResponse.status).toBe(200);
    const guestView = (await guestViewResponse.json()) as RoomView;
    expect(guestView.game?.humanSeatId).toBe(2);
    expect(guestView.game?.myRole).toBeDefined();
    expectVisibleRoleIsOnlySelfOrWolfTeammate(guestView, 1);
    expect(guestView.game?.seats.find((seat) => seat.seatId === 2)?.isHuman).toBe(true);
    expect(guestView.game?.seats.find((seat) => seat.seatId === 1)?.isHuman).toBe(false);
  });

  it("reports room runtime health and online deployment constraints", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
      }),
    );
    expect(createResponse.status).toBe(200);

    const healthResponse = await getRoomHealth();
    expect(healthResponse.status).toBe(200);
    const health = (await healthResponse.json()) as {
      ok: boolean;
      cleanup: {
        enabled: boolean;
        policy: { finishedIdleMs: number; inGameIdleMs: number; lobbyIdleMs: number };
        removedLastRun: number;
      };
      rooms: { total: number; lobby: number; inGame: number; maxRevision: number };
      storage: {
        adapter: string;
        enabled: boolean;
        envPathConfigured: boolean;
        mode: string;
        atomicWrites: boolean;
        revisioned: boolean;
        revisionMode: string;
        writeMode: string;
      };
      realtime: { mode: string; heartbeatMs: number; crossProcessFanout: boolean; channel?: string };
      presence: { adapter: string; heartbeatMs: number; shared: boolean; ttlMs: number };
      rateLimit: {
        enabled: boolean;
        adapter: string;
        shared: boolean;
        windowMs: number;
        buckets: { create: number; debug: number; join: number; read: number; stream: number; write: number };
        trackedKeys?: number;
      };
      deployment: {
        target: string;
        onlineReady: boolean;
        productionMinimumReady: boolean;
        publicOrigin?: string;
        publicOriginConfigured: boolean;
        requirements: {
          atomicRoomWrites: boolean;
          basicRateLimit: boolean;
          httpsPublicOrigin: boolean;
          persistentRoomStore: boolean;
          postgresRoomState: boolean;
          sharedPresence: boolean;
          sharedRateLimit: boolean;
          sharedRealtime: boolean;
          singleNodeProcess: boolean;
          sseRealtime: boolean;
        };
        processLocalEvents: boolean;
        multiInstanceSafe: boolean;
        warnings: string[];
      };
    };

    expect(health.ok).toBe(true);
    expect(health.cleanup).toMatchObject({
      enabled: true,
      removedLastRun: 0,
      policy: {
        finishedIdleMs: expect.any(Number),
        inGameIdleMs: expect.any(Number),
        lobbyIdleMs: expect.any(Number),
      },
    });
    expect(health.rooms).toMatchObject({ total: 1, lobby: 1, inGame: 0, maxRevision: expect.any(Number) });
    expect(health.rooms.maxRevision).toBeGreaterThanOrEqual(1);
    expect(["memory-only", "local-json"]).toContain(health.storage.mode);
    expect(health.storage.mode).toBe(health.storage.enabled ? "local-json" : "memory-only");
    expect(health.storage).toMatchObject({
      adapter: "in-process-room-store",
      atomicWrites: true,
      revisioned: true,
      revisionMode: "monotonic-room-revision",
      writeMode: "compare-and-set",
    });
    expect(health.realtime).toMatchObject({ mode: "sse-in-process", heartbeatMs: 5000, crossProcessFanout: false });
    expect(health.presence).toMatchObject({
      adapter: "in-process",
      heartbeatMs: expect.any(Number),
      shared: false,
      ttlMs: expect.any(Number),
    });
    expect(health.rateLimit).toMatchObject({
      enabled: true,
      adapter: "in-process",
      shared: false,
      windowMs: expect.any(Number),
      buckets: {
        create: expect.any(Number),
        debug: expect.any(Number),
        join: expect.any(Number),
        read: expect.any(Number),
        stream: expect.any(Number),
        write: expect.any(Number),
      },
    });
    expect(health.deployment).toMatchObject({
      target: "single-node",
      onlineReady: false,
      productionMinimumReady: false,
      publicOriginConfigured: false,
      requirements: {
        atomicRoomWrites: true,
        basicRateLimit: true,
        httpsPublicOrigin: false,
        persistentRoomStore: health.storage.enabled,
        postgresRoomState: false,
        sharedPresence: false,
        sharedRateLimit: false,
        sharedRealtime: false,
        singleNodeProcess: true,
        sseRealtime: true,
      },
      processLocalEvents: true,
      multiInstanceSafe: false,
    });
    expect(health.deployment.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Node 进程")]));
  });

  it("records private room usage metrics behind an owner token", async () => {
    const previousMetricsToken = process.env.AI_WEREWOLF_METRICS_TOKEN;
    process.env.AI_WEREWOLF_METRICS_TOKEN = "test-owner-token";

    try {
      const createResponse = await createRoom(
        new Request("http://localhost/api/rooms", {
          method: "POST",
          body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
        }),
      );
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as RoomView;

      const joinResponse = await joinRoom(
        new Request(`http://localhost/api/rooms/${created.room.code}/join`, {
          method: "POST",
          body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
        }),
        { params: Promise.resolve({ roomId: created.room.code }) },
      );
      expect(joinResponse.status).toBe(200);

      const startResponse = await startRoom(
        new Request(`http://localhost/api/rooms/${created.room.id}/start`, {
          method: "POST",
          body: JSON.stringify({ playerId: created.playerId }),
        }),
        { params: Promise.resolve({ roomId: created.room.id }) },
      );
      expect(startResponse.status).toBe(200);

      const blockedResponse = await getRoomMetrics(new Request("http://localhost/api/rooms/metrics"));
      expect(blockedResponse.status).toBe(404);

      const metricsResponse = await getRoomMetrics(new Request("http://localhost/api/rooms/metrics?token=test-owner-token"));
      expect(metricsResponse.status).toBe(200);
      const metrics = (await metricsResponse.json()) as {
        current: {
          humanPlayers: number;
          onlinePlayers: number;
          rooms: { activeInGame: number; inactiveInGame: number; lobby: number; total: number };
        };
        history: {
          adapter: string;
          gamesStarted: number;
          roomCompletionRate: number | null;
          recentDays: Array<{ gamesStarted: number; playersJoined: number; roomsCreated: number }>;
          siteCompletionRate: number | null;
          totalFinishedGameMinutes: number;
          totalPlayersEver: number;
          totalRoomsEver: number;
          totalSiteGameMinutes: number;
        };
      };

      expect(metrics.current).toMatchObject({
        humanPlayers: 2,
        onlinePlayers: 0,
        rooms: {
          activeInGame: 1,
          inactiveInGame: 1,
          lobby: 0,
          total: 1,
        },
      });
      expect(metrics.history).toMatchObject({
        adapter: "in-process",
        gamesStarted: 1,
        roomCompletionRate: 0,
        siteCompletionRate: 0,
        totalFinishedGameMinutes: 0,
        totalPlayersEver: 2,
        totalRoomsEver: 1,
        totalSiteGameMinutes: 0,
      });
      expect(metrics.history.recentDays[metrics.history.recentDays.length - 1]).toMatchObject({
        gamesStarted: 1,
        playersJoined: 1,
        roomsCreated: 1,
      });
    } finally {
      if (previousMetricsToken === undefined) {
        delete process.env.AI_WEREWOLF_METRICS_TOKEN;
      } else {
        process.env.AI_WEREWOLF_METRICS_TOKEN = previousMetricsToken;
      }
    }
  });

  it("rate limits repeated room creation from the same client", async () => {
    const previousEnabled = process.env.AI_WEREWOLF_ROOM_RATE_LIMIT;
    const previousCreateLimit = process.env.AI_WEREWOLF_ROOM_CREATE_LIMIT;
    const previousWindowMs = process.env.AI_WEREWOLF_ROOM_RATE_LIMIT_WINDOW_MS;
    process.env.AI_WEREWOLF_ROOM_RATE_LIMIT = "1";
    process.env.AI_WEREWOLF_ROOM_CREATE_LIMIT = "1";
    process.env.AI_WEREWOLF_ROOM_RATE_LIMIT_WINDOW_MS = "60000";
    clearRoomRateLimitsForTests();

    try {
      const firstResponse = await createRoom(
        new Request("http://localhost/api/rooms", {
          headers: { "x-forwarded-for": "203.0.113.10" },
          method: "POST",
          body: JSON.stringify({ hostName: "房主" }),
        }),
      );
      expect(firstResponse.status).toBe(200);

      const secondResponse = await createRoom(
        new Request("http://localhost/api/rooms", {
          headers: { "x-forwarded-for": "203.0.113.10" },
          method: "POST",
          body: JSON.stringify({ hostName: "房主2" }),
        }),
      );
      expect(secondResponse.status).toBe(429);
      expect(secondResponse.headers.get("Retry-After")).toBeTruthy();
      const payload = (await secondResponse.json()) as { error?: string; rateLimit?: { bucket?: string; limit?: number } };
      expect(payload).toMatchObject({
        error: "请求过于频繁，请稍后再试。",
        rateLimit: {
          bucket: "create",
          limit: 1,
        },
      });
    } finally {
      clearRoomRateLimitsForTests();
      if (previousEnabled === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_RATE_LIMIT;
      } else {
        process.env.AI_WEREWOLF_ROOM_RATE_LIMIT = previousEnabled;
      }
      if (previousCreateLimit === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_CREATE_LIMIT;
      } else {
        process.env.AI_WEREWOLF_ROOM_CREATE_LIMIT = previousCreateLimit;
      }
      if (previousWindowMs === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_RATE_LIMIT_WINDOW_MS;
      } else {
        process.env.AI_WEREWOLF_ROOM_RATE_LIMIT_WINDOW_MS = previousWindowMs;
      }
    }
  });

  it("reports single-node online readiness when public origin and persistence are configured", async () => {
    const previousDeployment = process.env.AI_WEREWOLF_ROOM_DEPLOYMENT;
    const previousPublicOrigin = process.env.AI_WEREWOLF_PUBLIC_ORIGIN;
    const previousStorePath = process.env.AI_WEREWOLF_ROOM_STORE_PATH;
    const tempDir = mkdtempSync(join(tmpdir(), "ai-werewolf-online-"));
    process.env.AI_WEREWOLF_ROOM_DEPLOYMENT = "single-node-online";
    process.env.AI_WEREWOLF_PUBLIC_ORIGIN = "https://werewolf.example.com/play";
    process.env.AI_WEREWOLF_ROOM_STORE_PATH = join(tempDir, "rooms.json");

    try {
      const healthResponse = await getRoomHealth();
      expect(healthResponse.status).toBe(200);
      const health = (await healthResponse.json()) as {
        deployment: {
          target: string;
          onlineReady: boolean;
          publicOrigin?: string;
          publicOriginConfigured: boolean;
          requirements: {
            atomicRoomWrites: boolean;
            httpsPublicOrigin: boolean;
            persistentRoomStore: boolean;
            singleNodeProcess: boolean;
            sseRealtime: boolean;
          };
        };
        storage: { enabled: boolean };
      };

      expect(health.storage.enabled).toBe(true);
      expect(health.deployment).toMatchObject({
        target: "single-node-online",
        onlineReady: true,
        publicOrigin: "https://werewolf.example.com",
        publicOriginConfigured: true,
        requirements: {
          atomicRoomWrites: true,
          httpsPublicOrigin: true,
          persistentRoomStore: true,
          singleNodeProcess: true,
          sseRealtime: true,
        },
      });
    } finally {
      if (previousDeployment === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_DEPLOYMENT;
      } else {
        process.env.AI_WEREWOLF_ROOM_DEPLOYMENT = previousDeployment;
      }
      if (previousPublicOrigin === undefined) {
        delete process.env.AI_WEREWOLF_PUBLIC_ORIGIN;
      } else {
        process.env.AI_WEREWOLF_PUBLIC_ORIGIN = previousPublicOrigin;
      }
      if (previousStorePath === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_STORE_PATH;
      } else {
        process.env.AI_WEREWOLF_ROOM_STORE_PATH = previousStorePath;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("cleans expired lobby rooms from local persistence before reporting health", async () => {
    const previousStorePath = process.env.AI_WEREWOLF_ROOM_STORE_PATH;
    const previousLobbyTtlMs = process.env.AI_WEREWOLF_ROOM_LOBBY_IDLE_TTL_MS;
    const tempDir = mkdtempSync(join(tmpdir(), "ai-werewolf-rooms-"));
    const storePath = join(tempDir, "rooms.json");
    process.env.AI_WEREWOLF_ROOM_STORE_PATH = storePath;
    process.env.AI_WEREWOLF_ROOM_LOBBY_IDLE_TTL_MS = String(60 * 60 * 1000);

    try {
      const createResponse = await createRoom(
        new Request("http://localhost/api/rooms", {
          method: "POST",
          body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
        }),
      );
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as RoomView;
      const staleTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const persisted = JSON.parse(readFileSync(storePath, "utf8")) as {
        rooms: Array<{ createdAt: string; updatedAt: string }>;
      };
      persisted.rooms[0].createdAt = staleTime;
      persisted.rooms[0].updatedAt = staleTime;
      writeFileSync(storePath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
      await clearRoomSessionsForTests({ keepStorage: true });
      await reloadRoomSessionsFromStorageForTests();

      const healthResponse = await getRoomHealth();
      expect(healthResponse.status).toBe(200);
      const health = (await healthResponse.json()) as {
        cleanup: { removedLastRun: number; roomCodesLastRun: string[] };
        rooms: { total: number; lobby: number; inGame: number };
      };
      expect(health.rooms).toMatchObject({ total: 0, lobby: 0, inGame: 0 });
      expect(health.cleanup.removedLastRun).toBe(1);
      expect(health.cleanup.roomCodesLastRun).toEqual([created.room.code]);

      const staleViewResponse = await getRoomView(
        new Request(`http://localhost/api/rooms/${created.room.id}/view?playerId=${created.playerId}`),
        { params: Promise.resolve({ roomId: created.room.id }) },
      );
      expect(staleViewResponse.status).toBe(404);
    } finally {
      await clearRoomSessionsForTests();
      if (previousStorePath === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_STORE_PATH;
      } else {
        process.env.AI_WEREWOLF_ROOM_STORE_PATH = previousStorePath;
      }
      if (previousLobbyTtlMs === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_LOBBY_IDLE_TTL_MS;
      } else {
        process.env.AI_WEREWOLF_ROOM_LOBBY_IDLE_TTL_MS = previousLobbyTtlMs;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("lets dev cleanup remove inactive rooms while preserving the current room", async () => {
    const keepResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
      }),
    );
    const keepRoom = (await keepResponse.json()) as RoomView;

    const removableResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "旧房间", hostSeatId: 2 }),
      }),
    );
    const removableRoom = (await removableResponse.json()) as RoomView;

    const cleanupResponse = await debugCleanupRooms(
      new Request("http://localhost/api/rooms/debug-cleanup", {
        method: "POST",
        body: JSON.stringify({ excludeRoomId: keepRoom.room.id }),
      }),
    );
    expect(cleanupResponse.status).toBe(200);
    const cleanup = (await cleanupResponse.json()) as {
      removed: number;
      roomCodes: string[];
      rooms: { total: number; lobby: number; inGame: number };
    };
    expect(cleanup.removed).toBe(1);
    expect(cleanup.roomCodes).toEqual([removableRoom.room.code]);
    expect(cleanup.rooms).toMatchObject({ total: 1, lobby: 1, inGame: 0 });

    const keepViewResponse = await getRoomView(
      new Request(`http://localhost/api/rooms/${keepRoom.room.id}/view?playerId=${keepRoom.playerId}`),
      { params: Promise.resolve({ roomId: keepRoom.room.id }) },
    );
    expect(keepViewResponse.status).toBe(200);

    const removedViewResponse = await getRoomView(
      new Request(`http://localhost/api/rooms/${removableRoom.room.id}/view?playerId=${removableRoom.playerId}`),
      { params: Promise.resolve({ roomId: removableRoom.room.id }) },
    );
    expect(removedViewResponse.status).toBe(404);
  });

  it("auto-assigns occupied join seats, rejects later occupied seat changes, and keeps start host-only", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "房主", hostSeatId: 3 }),
      }),
    );
    const created = (await createResponse.json()) as RoomView;

    const fallbackJoinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 3 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(fallbackJoinResponse.status).toBe(200);
    const fallbackJoined = (await fallbackJoinResponse.json()) as RoomView;
    expect(fallbackJoined.room.players).toHaveLength(2);
    expect(fallbackJoined.playerSeatId).toBeDefined();
    expect(fallbackJoined.playerSeatId).not.toBe(3);
    expect(fallbackJoined.room.seats.find((seat) => seat.playerId === fallbackJoined.playerId)?.seatId).toBe(
      fallbackJoined.playerSeatId,
    );

    const occupiedSeatResponse = await setRoomSeat(
      new Request(`http://localhost/api/rooms/${created.room.id}/seats`, {
        method: "POST",
        body: JSON.stringify({ playerId: fallbackJoined.playerId, seatId: 3 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(occupiedSeatResponse.status).toBe(409);

    const nonHostStartResponse = await startRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/start`, {
        method: "POST",
        body: JSON.stringify({ playerId: fallbackJoined.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(nonHostStartResponse.status).toBe(403);
  });

  it("rejects stale expectedRevision writes", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "房主", hostSeatId: 1 }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as RoomView;

    const joinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(joinResponse.status).toBe(200);
    const joined = (await joinResponse.json()) as RoomView;
    expect(joined.room.revision).toBeGreaterThan(created.room.revision);

    const staleSeatResponse = await setRoomSeat(
      new Request(`http://localhost/api/rooms/${created.room.id}/seats`, {
        method: "POST",
        body: JSON.stringify({ expectedRevision: created.room.revision, playerId: created.playerId, seatId: 3 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(staleSeatResponse.status).toBe(409);
    const staleSeatPayload = (await staleSeatResponse.json()) as { error?: string };
    expect(staleSeatPayload.error).toBe("房间状态已更新，请刷新后重试。");

    const freshSeatResponse = await setRoomSeat(
      new Request(`http://localhost/api/rooms/${created.room.id}/seats`, {
        method: "POST",
        body: JSON.stringify({ expectedRevision: joined.room.revision, playerId: created.playerId, seatId: 3 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(freshSeatResponse.status).toBe(200);
  });

  it("allows a player to change and leave seats before start", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "房主" }),
      }),
    );
    const created = (await createResponse.json()) as RoomView;

    const seatedResponse = await setRoomSeat(
      new Request(`http://localhost/api/rooms/${created.room.id}/seats`, {
        method: "POST",
        body: JSON.stringify({ playerId: created.playerId, seatId: 5 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    const seated = (await seatedResponse.json()) as RoomView;
    expect(seated.playerSeatId).toBe(5);

    const clearedResponse = await setRoomSeat(
      new Request(`http://localhost/api/rooms/${created.room.id}/seats`, {
        method: "POST",
        body: JSON.stringify({ playerId: created.playerId, seatId: null }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    const cleared = (await clearedResponse.json()) as RoomView;
    expect(cleared.playerSeatId).toBeUndefined();
    expect(cleared.room.seats.every((seat) => seat.controller === "open")).toBe(true);
  });

  it("lets lobby players leave, releases seats, and transfers host before start", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "房主", hostSeatId: 1 }),
      }),
    );
    const created = (await createResponse.json()) as RoomView;

    const joinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    const joined = (await joinResponse.json()) as RoomView;

    const guestLeaveResponse = await leaveRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/leave`, {
        method: "POST",
        body: JSON.stringify({ playerId: joined.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(guestLeaveResponse.status).toBe(200);
    const afterGuestLeave = await readRoomView(created.room.id, created.playerId!);
    expect(afterGuestLeave.room.players).toHaveLength(1);
    expect(afterGuestLeave.room.seats.find((seat) => seat.seatId === 2)?.controller).toBe("open");

    const rejoinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    const rejoined = (await rejoinResponse.json()) as RoomView;

    const hostLeaveResponse = await leaveRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/leave`, {
        method: "POST",
        body: JSON.stringify({ playerId: created.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(hostLeaveResponse.status).toBe(200);
    const afterHostLeave = await readRoomView(created.room.id, rejoined.playerId!);
    expect(afterHostLeave.room.players).toHaveLength(1);
    expect(afterHostLeave.room.hostPlayerId).toBe(rejoined.playerId);
    expect(afterHostLeave.room.players[0]).toMatchObject({ playerId: rejoined.playerId, isHost: true, seatId: 2 });
  });

  it("lets only the host remove lobby players and release their seats", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "房主", hostSeatId: 1 }),
      }),
    );
    const created = (await createResponse.json()) as RoomView;

    const joinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    const joined = (await joinResponse.json()) as RoomView;

    const nonHostRemoveResponse = await removeRoomPlayer(
      new Request(`http://localhost/api/rooms/${created.room.id}/remove`, {
        method: "POST",
        body: JSON.stringify({ requesterPlayerId: joined.playerId, targetPlayerId: created.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(nonHostRemoveResponse.status).toBe(403);

    const selfRemoveResponse = await removeRoomPlayer(
      new Request(`http://localhost/api/rooms/${created.room.id}/remove`, {
        method: "POST",
        body: JSON.stringify({ requesterPlayerId: created.playerId, targetPlayerId: created.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(selfRemoveResponse.status).toBe(409);

    const guestStreamResponse = await streamRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/stream?playerId=${joined.playerId}`),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(guestStreamResponse.status).toBe(200);
    expect(guestStreamResponse.body).toBeTruthy();
    const guestStreamReader = guestStreamResponse.body!.getReader();
    const readState = createSseReadState();

    try {
      const guestInitialEvent = await readNextSseEvent(guestStreamReader, readState);
      expect(guestInitialEvent.event).toBe("room");

      const hostRemoveResponse = await removeRoomPlayer(
        new Request(`http://localhost/api/rooms/${created.room.id}/remove`, {
          method: "POST",
          body: JSON.stringify({ requesterPlayerId: created.playerId, targetPlayerId: joined.playerId }),
        }),
        { params: Promise.resolve({ roomId: created.room.id }) },
      );
      expect(hostRemoveResponse.status).toBe(200);
      const hostView = (await hostRemoveResponse.json()) as RoomView;
      expect(hostView.playerId).toBe(created.playerId);
      expect(hostView.room.players).toHaveLength(1);
      expect(hostView.room.seats.find((seat) => seat.seatId === 2)?.controller).toBe("open");

      const removedStreamEvent = await readNextSseEvent(guestStreamReader, readState);
      expect(removedStreamEvent.event).toBe("error");
      expect(JSON.parse(removedStreamEvent.data)).toMatchObject({ error: "玩家不在该房间。" });
    } finally {
      await guestStreamReader.cancel();
    }

    const removedPlayerViewResponse = await getRoomView(
      new Request(`http://localhost/api/rooms/${created.room.id}/view?playerId=${joined.playerId}`),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(removedPlayerViewResponse.status).toBe(403);
  });

  it("submits only the current player's room action", async () => {
    const { roomId, hostPlayerId, guestPlayerId } = await createStartedTwoPlayerRoom();
    const current = await findNextHumanAction(roomId, hostPlayerId, guestPlayerId);
    const wrongPlayerId = current.playerId === hostPlayerId ? guestPlayerId : hostPlayerId;
    const payload = commandFromAction(current.action);

    const wrongResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify({ playerId: wrongPlayerId, ...payload }),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(wrongResponse.status).toBe(409);

    const submitResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify({ playerId: current.playerId, ...payload }),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(submitResponse.status).toBe(200);
    const submitted = (await submitResponse.json()) as RoomView;
    expect(submitted.playerId).toBe(current.playerId);
    expect(submitted.game?.id).toBe(current.view.game?.id);
    expect(submitted.game?.humanSeatId).toBe(current.view.playerSeatId);
  });

  it("replays duplicate room command idempotency keys without applying twice", async () => {
    const { roomId, hostPlayerId, guestPlayerId } = await createStartedTwoPlayerRoom();
    const current = await findNextHumanAction(roomId, hostPlayerId, guestPlayerId);
    const payload = commandFromAction(current.action);
    const commandBody = {
      expectedRevision: current.view.room.revision,
      idempotencyKey: "test-idempotent-room-command-1",
      playerId: current.playerId,
      ...payload,
    };

    const firstResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify(commandBody),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(firstResponse.status).toBe(200);
    const firstView = (await firstResponse.json()) as RoomView;

    const duplicateResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify(commandBody),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(duplicateResponse.status).toBe(200);
    const duplicateView = (await duplicateResponse.json()) as RoomView;
    expect(duplicateView.room.revision).toBe(firstView.room.revision);

    const conflictResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify({
          expectedRevision: current.view.room.revision,
          idempotencyKey: commandBody.idempotencyKey,
          playerId: current.playerId,
          type: "continue",
        }),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(conflictResponse.status).toBe(409);
  });

  it("does not expose host continue while waiting for another human", async () => {
    const { roomId, hostPlayerId, guestPlayerId } = await createStartedTwoPlayerRoom();
    const guestTurn = await findNextSpecificHumanAction(roomId, hostPlayerId, guestPlayerId, guestPlayerId);
    const hostView = await readRoomView(roomId, hostPlayerId);

    expect(guestTurn.view.turn.isSelfActor).toBe(true);
    expect(hostView.turn.type).toBe("human");
    expect(hostView.turn.canHostContinue).toBe(false);
    expect(hostView.game?.availableActions.some((action) => action.type === "continue")).toBe(false);
  });

  it("keeps continue as a host-only room control", async () => {
    const { roomId, guestPlayerId } = await createStartedTwoPlayerRoom();

    const response = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify({ playerId: guestPlayerId, type: "continue" }),
      }),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(403);
  });

  it("recovers started room private views by saved room credentials", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as RoomView;

    const joinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.code}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(joinResponse.status).toBe(200);
    const joined = (await joinResponse.json()) as RoomView;

    const startResponse = await startRoom(
      new Request(`http://localhost/api/rooms/${created.room.id}/start`, {
        method: "POST",
        body: JSON.stringify({ playerId: created.playerId }),
      }),
      { params: Promise.resolve({ roomId: created.room.id }) },
    );
    expect(startResponse.status).toBe(200);

    const hostById = await readRoomView(created.room.id, created.playerId!);
    const hostByCode = await readRoomView(created.room.code, created.playerId!);
    const hostByToken = await readRoomViewByToken(created.room.code, created.playerToken!);
    const guestByCode = await readRoomView(created.room.code, joined.playerId!);
    const guestByToken = await readRoomViewByToken(created.room.code, joined.playerToken!);

    expect(hostById.room.id).toBe(created.room.id);
    expect(hostByCode.room.id).toBe(created.room.id);
    expect(hostByToken.playerId).toBe(created.playerId);
    expect(hostByToken.playerToken).toBe(created.playerToken);
    expect(hostByCode.room.status).toBe("in_game");
    expect(hostByCode.playerSeatId).toBe(1);
    expect(hostByCode.game?.humanSeatId).toBe(1);
    expect(hostByCode.game?.myRole).toBeDefined();

    expect(guestByCode.room.id).toBe(created.room.id);
    expect(guestByCode.playerSeatId).toBe(2);
    expect(guestByCode.game?.humanSeatId).toBe(2);
    expect(guestByCode.game?.myRole).toBeDefined();
    expect(guestByToken.playerId).toBe(joined.playerId);
    expect(guestByToken.playerToken).toBe(joined.playerToken);
    expect(guestByToken.playerSeatId).toBe(2);
    expectVisibleRoleIsOnlySelfOrWolfTeammate(guestByCode, 1);

    const guestByJoinFormResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.code}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(guestByJoinFormResponse.status).toBe(200);
    const guestByJoinForm = (await guestByJoinFormResponse.json()) as RoomView;
    expect(guestByJoinForm.room.status).toBe("in_game");
    expect(guestByJoinForm.room.players).toHaveLength(2);
    expect(guestByJoinForm.playerId).toBe(joined.playerId);
    expect(guestByJoinForm.playerSeatId).toBe(2);
    expect(guestByJoinForm.game?.humanSeatId).toBe(2);
    expect(guestByJoinForm.game?.myRole).toBeDefined();

    const wrongNameStartedJoinResponse = await joinRoom(
      new Request(`http://localhost/api/rooms/${created.room.code}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "陌生人", seatId: 2 }),
      }),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(wrongNameStartedJoinResponse.status).toBe(409);
    const wrongNamePayload = (await wrongNameStartedJoinResponse.json()) as { error?: string };
    expect(wrongNamePayload.error).toBe("房间已经开局，昵称和原座位不匹配。请使用原昵称或恢复链接。");

    const staleResponse = await getRoomView(
      new Request(`http://localhost/api/rooms/${created.room.code}/view?playerId=stale-player`),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(staleResponse.status).toBe(403);
    const stalePayload = (await staleResponse.json()) as { error?: string };
    expect(stalePayload.error).toBe("玩家不在该房间。");

    const staleTokenResponse = await getRoomView(
      new Request(`http://localhost/api/rooms/${created.room.code}/view?playerToken=rpt_0000000000000000000000000000000000000000000000000000000000000000`),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(staleTokenResponse.status).toBe(403);
    const staleTokenPayload = (await staleTokenResponse.json()) as { error?: string };
    expect(staleTokenPayload.error).toBe("玩家凭据无效。");
  });

  it("streams private room view updates for saved player credentials", async () => {
    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as RoomView;

    const streamResponse = await streamRoom(
      new Request(`http://localhost/api/rooms/${created.room.code}/stream?playerToken=${created.playerToken}`),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get("Content-Type")).toContain("text/event-stream");
    expect(streamResponse.body).toBeTruthy();

    const reader = streamResponse.body!.getReader();
    const readState = createSseReadState();
    try {
      const initialEvent = await readNextSseEvent(reader, readState);
      expect(initialEvent.id).toBe("0");
      expect(initialEvent.event).toBe("room");
      const initialView = JSON.parse(initialEvent.data) as RoomView;
      expect(initialView.room.id).toBe(created.room.id);
      expect(initialView.playerId).toBe(created.playerId);
      expect(initialView.playerToken).toBe(created.playerToken);
      expect(initialView.playerSeatId).toBe(1);
      expect(initialView.room.players).toHaveLength(1);
      expect(initialView.room.players[0]).toMatchObject({
        online: true,
        playerId: created.playerId,
      });
      expect(initialView.room.players[0].lastSeenAt).toEqual(expect.any(String));

      const joinResponse = await joinRoom(
        new Request(`http://localhost/api/rooms/${created.room.code}/join`, {
          method: "POST",
          body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
        }),
        { params: Promise.resolve({ roomId: created.room.code }) },
      );
      expect(joinResponse.status).toBe(200);

      const updateEvent = await readNextSseEvent(reader, readState);
      expect(updateEvent.event).toBe("room");
      expect(Number(updateEvent.id)).toBeGreaterThan(0);
      const updatedView = JSON.parse(updateEvent.data) as RoomView;
      expect(updatedView.room.id).toBe(created.room.id);
      expect(updatedView.playerId).toBe(created.playerId);
      expect(updatedView.playerSeatId).toBe(1);
      expect(updatedView.room.players).toHaveLength(2);
      expect(updatedView.room.players.find((player) => player.playerId === created.playerId)).toMatchObject({ online: true });
      expect(updatedView.room.players.find((player) => player.playerId !== created.playerId)).toMatchObject({ online: false });
    } finally {
      await reader.cancel();
    }

    const afterStreamClose = await readRoomView(created.room.id, created.playerId!);
    expect(afterStreamClose.room.players.find((player) => player.playerId === created.playerId)).toMatchObject({
      online: false,
      lastSeenAt: expect.any(String),
    });

    const staleResponse = await streamRoom(
      new Request(`http://localhost/api/rooms/${created.room.code}/stream?playerToken=rpt_0000000000000000000000000000000000000000000000000000000000000000`),
      { params: Promise.resolve({ roomId: created.room.code }) },
    );
    expect(staleResponse.status).toBe(403);
    const stalePayload = (await staleResponse.json()) as { error?: string };
    expect(stalePayload.error).toBe("玩家凭据无效。");
  });

  it("restores rooms from the local persistence file", async () => {
    const previousStorePath = process.env.AI_WEREWOLF_ROOM_STORE_PATH;
    const tempDir = mkdtempSync(join(tmpdir(), "ai-werewolf-rooms-"));
    process.env.AI_WEREWOLF_ROOM_STORE_PATH = join(tempDir, "rooms.json");

    try {
      const createResponse = await createRoom(
        new Request("http://localhost/api/rooms", {
          method: "POST",
          body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
        }),
      );
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as RoomView;

      await clearRoomSessionsForTests({ keepStorage: true });
      await reloadRoomSessionsFromStorageForTests();

      const restored = await readRoomView(created.room.id, created.playerId!);
      expect(restored.room.id).toBe(created.room.id);
      expect(restored.room.code).toBe(created.room.code);
      expect(restored.playerSeatId).toBe(1);
      expect(restored.room.players).toHaveLength(1);
    } finally {
      await clearRoomSessionsForTests();
      if (previousStorePath === undefined) {
        delete process.env.AI_WEREWOLF_ROOM_STORE_PATH;
      } else {
        process.env.AI_WEREWOLF_ROOM_STORE_PATH = previousStorePath;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

async function createStartedTwoPlayerRoom(): Promise<{
  roomId: string;
  hostPlayerId: string;
  guestPlayerId: string;
}> {
  const createResponse = await createRoom(
    new Request("http://localhost/api/rooms", {
      method: "POST",
      body: JSON.stringify({ boardId: "9p-seer-witch-hunter", hostName: "房主", hostSeatId: 1 }),
    }),
  );
  const created = (await createResponse.json()) as RoomView;

  const joinResponse = await joinRoom(
    new Request(`http://localhost/api/rooms/${created.room.id}/join`, {
      method: "POST",
      body: JSON.stringify({ playerName: "朋友", seatId: 2 }),
    }),
    { params: Promise.resolve({ roomId: created.room.id }) },
  );
  const joined = (await joinResponse.json()) as RoomView;

  const startResponse = await startRoom(
    new Request(`http://localhost/api/rooms/${created.room.id}/start`, {
      method: "POST",
      body: JSON.stringify({ playerId: created.playerId }),
    }),
    { params: Promise.resolve({ roomId: created.room.id }) },
  );
  expect(startResponse.status).toBe(200);

  return {
    roomId: created.room.id,
    hostPlayerId: created.playerId!,
    guestPlayerId: joined.playerId!,
  };
}

async function findNextSpecificHumanAction(
  roomId: string,
  hostPlayerId: string,
  guestPlayerId: string,
  targetPlayerId: string,
): Promise<{ playerId: string; view: RoomView; action: Exclude<AvailableHumanAction, { type: "continue" }> }> {
  const otherPlayerId = targetPlayerId === hostPlayerId ? guestPlayerId : hostPlayerId;

  for (let step = 0; step < 120; step += 1) {
    const targetView = await readRoomView(roomId, targetPlayerId);
    const targetAction = readPlayableAction(targetView);
    if (targetAction) return { playerId: targetPlayerId, view: targetView, action: targetAction };
    expect(targetView.game?.result).toBeUndefined();

    const otherView = await readRoomView(roomId, otherPlayerId);
    const otherAction = readPlayableAction(otherView);
    if (otherAction) {
      const response = await submitRoomCommand(
        new Request(`http://localhost/api/rooms/${roomId}/commands`, {
          method: "POST",
          body: JSON.stringify({ playerId: otherPlayerId, ...commandFromAction(otherAction) }),
        }),
        { params: Promise.resolve({ roomId }) },
      );
      expect(response.status).toBe(200);
      continue;
    }

    const continueResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify({ playerId: hostPlayerId, type: "continue" }),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(continueResponse.status).toBe(200);
  }

  throw new Error("Could not reach the requested human action.");
}

async function findNextHumanAction(
  roomId: string,
  hostPlayerId: string,
  guestPlayerId: string,
): Promise<{ playerId: string; view: RoomView; action: Exclude<AvailableHumanAction, { type: "continue" }> }> {
  for (let step = 0; step < 80; step += 1) {
    const hostView = await readRoomView(roomId, hostPlayerId);
    const hostAction = readPlayableAction(hostView);
    if (hostAction) return { playerId: hostPlayerId, view: hostView, action: hostAction };

    const guestView = await readRoomView(roomId, guestPlayerId);
    const guestAction = readPlayableAction(guestView);
    if (guestAction) return { playerId: guestPlayerId, view: guestView, action: guestAction };

    expect(hostView.game?.result).toBeUndefined();
    const continueResponse = await submitRoomCommand(
      new Request(`http://localhost/api/rooms/${roomId}/commands`, {
        method: "POST",
        body: JSON.stringify({ playerId: hostPlayerId, type: "continue" }),
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(continueResponse.status).toBe(200);
  }

  throw new Error("Could not reach a room human action.");
}

async function readRoomView(roomId: string, playerId: string): Promise<RoomView> {
  const response = await getRoomView(new Request(`http://localhost/api/rooms/${roomId}/view?playerId=${playerId}`), {
    params: Promise.resolve({ roomId }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as RoomView;
}

async function readRoomViewByToken(roomId: string, playerToken: string): Promise<RoomView> {
  const response = await getRoomView(new Request(`http://localhost/api/rooms/${roomId}/view?playerToken=${playerToken}`), {
    params: Promise.resolve({ roomId }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as RoomView;
}

function readPlayableAction(view: RoomView): Exclude<AvailableHumanAction, { type: "continue" }> | undefined {
  return view.game?.availableActions.find(
    (action): action is Exclude<AvailableHumanAction, { type: "continue" }> => action.type !== "continue",
  );
}

function expectVisibleRoleIsOnlySelfOrWolfTeammate(view: RoomView, seatId: number): void {
  const seat = view.game?.seats.find((item) => item.seatId === seatId);
  if (!seat?.role) return;
  expect(view.game?.wolfTeammates.some((teammate) => teammate.seatId === seatId)).toBe(true);
}

type SseReadState = {
  decoder: TextDecoder;
  text: string;
};

type SseEvent = {
  id?: string;
  event?: string;
  data: string;
};

function createSseReadState(): SseReadState {
  return {
    decoder: new TextDecoder(),
    text: "",
  };
}

async function readNextSseEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  state: SseReadState,
): Promise<SseEvent> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const boundary = state.text.indexOf("\n\n");
    if (boundary !== -1) {
      const raw = state.text.slice(0, boundary);
      state.text = state.text.slice(boundary + 2);
      const event = parseSseEvent(raw);
      if (event.event) return event;
      continue;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Timed out waiting for SSE event.");
    }

    const result = await Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for SSE event.")), remainingMs);
      }),
    ]);
    if (result.done) {
      throw new Error("SSE stream ended before the next event.");
    }
    state.text += state.decoder.decode(result.value, { stream: true });
  }
}

function parseSseEvent(raw: string): SseEvent {
  const data: string[] = [];
  const event: SseEvent = { data: "" };
  for (const line of raw.split("\n")) {
    const cleanLine = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (cleanLine.startsWith("id:")) {
      event.id = cleanLine.slice(3).trim();
    } else if (cleanLine.startsWith("event:")) {
      event.event = cleanLine.slice(6).trim();
    } else if (cleanLine.startsWith("data:")) {
      data.push(cleanLine.slice(5).trimStart());
    }
  }
  event.data = data.join("\n");
  return event;
}

function commandFromAction(action: AvailableHumanAction): Record<string, unknown> {
  switch (action.type) {
    case "wolfKill":
    case "seerCheck":
    case "vote":
      return { type: action.type, targetSeatId: action.targets[0].seatId };
    case "guardAction":
      return action.targets[0] ? { type: "guardAction", targetSeatId: action.targets[0].seatId } : { type: "guardAction" };
    case "witchAction":
      if (action.canSave) return { type: "witchAction", mode: "save" };
      if (action.canPoison && action.poisonTargets[0]) {
        return { type: "witchAction", mode: "poison", targetSeatId: action.poisonTargets[0].seatId };
      }
      return { type: "witchAction", mode: "skip" };
    case "wolfBeautyCharm":
      return action.targets[0] ? { type: "wolfBeautyCharm", targetSeatId: action.targets[0].seatId } : { type: "wolfBeautyCharm" };
    case "speak":
      return { type: "speak", message: "我先按当前公开信息发言，重点看谁在回避关键位置。" };
    case "lastWords":
      return { type: "lastWords", message: "我留下最后视角，后面重点复盘票型和发言顺序。" };
    case "hunterShoot":
      return action.targets[0] ? { type: "hunterShoot", targetSeatId: action.targets[0].seatId } : { type: "hunterShoot" };
    case "wolfKingShoot":
      return action.targets[0] ? { type: "wolfKingShoot", targetSeatId: action.targets[0].seatId } : { type: "wolfKingShoot" };
    case "whiteWolfKingExplode":
      return { type: "whiteWolfKingExplode", targetSeatId: action.targets[0].seatId };
    case "knightDuel":
      return action.targets[0] ? { type: "knightDuel", targetSeatId: action.targets[0].seatId } : { type: "knightDuel" };
    case "sheriffNominate":
      return { type: "sheriffNominate", run: true };
    case "sheriffSpeech":
      return { type: "sheriffSpeech", message: "我竞选警长会按发言和票型组织桌面。" };
    case "sheriffWithdraw":
      return { type: "sheriffWithdraw", withdraw: false };
    case "sheriffVote":
      return action.targets[0] ? { type: "sheriffVote", targetSeatId: action.targets[0].seatId } : { type: "sheriffVote" };
    case "sheriffHandoff":
      return action.targets[0]
        ? { type: "sheriffHandoff", targetSeatId: action.targets[0].seatId }
        : { type: "sheriffHandoff" };
    case "continue":
      return { type: "continue" };
  }

  throw new Error(`Unsupported action type: ${(action as { type: string }).type}`);
}

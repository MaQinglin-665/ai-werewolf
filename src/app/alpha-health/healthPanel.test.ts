import { describe, expect, it } from "vitest";
import {
  buildRequirementRows,
  buildSmokeCommands,
  countPassedRequirements,
  formatDuration,
  selectReadinessSummary,
  type AlphaHealthStatus,
} from "./healthPanel";

describe("alpha health panel helpers", () => {
  it("recommends production preflight commands for the production minimum loop", () => {
    const health = makeHealth({
      deployment: {
        productionMinimumReady: true,
        publicOrigin: "https://werewolf.example.com/rooms",
        requirements: {
          atomicRoomWrites: true,
          basicRateLimit: true,
          httpsPublicOrigin: true,
          mainGameDurableStore: true,
          persistentRoomStore: true,
          postgresRoomState: true,
          sharedPresence: true,
          sharedRateLimit: true,
          sharedRealtime: true,
          singleNodeProcess: true,
          sseRealtime: true,
        },
        target: "single-node-online",
      },
    });

    expect(selectReadinessSummary(health)).toMatchObject({
      label: "生产最小闭环就绪",
      tone: "good",
    });
    expect(buildSmokeCommands(health, "http://127.0.0.1:3000")).toEqual([
      {
        command: '$env:ROOM_SMOKE_BASE_URL="https://werewolf.example.com"; npm run preflight:production',
        label: "生产预检",
        tone: "good",
      },
      {
        command: '$env:ROOM_SMOKE_BASE_URL="https://werewolf.example.com"; npm run smoke:room-sse',
        label: "房间 SSE",
        tone: "good",
      },
      {
        command: '$env:ROOM_SMOKE_BASE_URL="https://werewolf.example.com"; npm run smoke:alpha',
        label: "Alpha 聚合",
        tone: "neutral",
      },
    ]);

    const rows = buildRequirementRows(health);
    expect(countPassedRequirements(rows)).toEqual({ passed: 11, total: 11 });
  });

  it("keeps online single-node smoke separate from the production minimum", () => {
    const health = makeHealth({
      deployment: {
        onlineReady: true,
        productionMinimumReady: false,
        publicOrigin: "https://alpha.example.com",
        target: "single-node-online",
      },
    });

    expect(selectReadinessSummary(health)).toMatchObject({
      label: "线上单节点就绪",
      tone: "warn",
    });
    expect(buildSmokeCommands(health)).toEqual([
      {
        command: '$env:ROOM_SMOKE_BASE_URL="https://alpha.example.com"; npm run smoke:online',
        label: "线上单节点",
        tone: "good",
      },
    ]);
  });

  it("uses local alpha smoke for local origins and tunnel smoke for public origins", () => {
    const health = makeHealth();

    expect(buildSmokeCommands(health, "http://127.0.0.1:3003")).toEqual([
      {
        command: '$env:ROOM_SMOKE_BASE_URL="http://127.0.0.1:3003"; npm run smoke:alpha',
        label: "本地 Alpha",
        tone: "neutral",
      },
    ]);
    expect(buildSmokeCommands(health, "https://preview.example.com")).toEqual([
      {
        command: '$env:ROOM_SMOKE_BASE_URL="https://preview.example.com"; npm run smoke:tunnel',
        label: "公网/隧道",
        tone: "warn",
      },
    ]);
  });

  it("formats durations for operator-facing rows", () => {
    expect(formatDuration(undefined)).toBe("未配置");
    expect(formatDuration(500)).toBe("500 ms");
    expect(formatDuration(5000)).toBe("5 秒");
    expect(formatDuration(5 * 60 * 1000)).toBe("5 分钟");
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2 小时");
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe("3 天");
  });
});

function makeHealth(overrides: Partial<AlphaHealthStatus> = {}): AlphaHealthStatus {
  return {
    ...overrides,
    ok: overrides.ok ?? true,
    deployment: {
      multiInstanceSafe: false,
      onlineReady: false,
      productionMinimumReady: false,
      target: "single-node",
      ...overrides.deployment,
    },
  };
}

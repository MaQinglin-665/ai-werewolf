import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminMetricsPage from "./page";
import { checkRoomMetricsAccess } from "@/server/roomMetricsAccess";
import type { RoomMetricsSnapshot } from "@/server/roomService";
import { getRoomMetricsSnapshot } from "@/server/roomService";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/server/roomMetricsAccess", () => ({
  checkRoomMetricsAccess: vi.fn(),
}));

vi.mock("@/server/roomService", () => ({
  getRoomMetricsSnapshot: vi.fn(),
}));

const mockCheckRoomMetricsAccess = vi.mocked(checkRoomMetricsAccess);
const mockGetRoomMetricsSnapshot = vi.mocked(getRoomMetricsSnapshot);

describe("AdminMetricsPage", () => {
  beforeEach(() => {
    mockCheckRoomMetricsAccess.mockReturnValue({ allowed: true, mode: "token" });
    mockGetRoomMetricsSnapshot.mockResolvedValue(createMetricsSnapshot());
  });

  it("labels shared historical analytics separately from local live room state", async () => {
    const element = await AdminMetricsPage({
      searchParams: Promise.resolve({ token: "test-owner-token" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("共享历史指标");
    expect(html).toContain("打开、开局、房间发言/投票里程碑、完局和趋势会按同一个 PostgreSQL 指标库合计");
    expect(html).toContain("本机实时状态");
    expect(html).toContain("不代表腾讯云实时房间总量");
    expect(html).toContain("本机实时房间光谱");
    expect(html).toContain("本机房间状态和风险");
  });

  it("renders expanded room flow funnel milestones", async () => {
    const element = await AdminMetricsPage({
      searchParams: Promise.resolve({ token: "test-owner-token" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/rooms View");
    expect(html).toContain("Room Created");
    expect(html).toContain("Room Players");
    expect(html).toContain("Room Started");
    expect(html).toContain("Speech");
    expect(html).toContain("Vote");
    expect(html).toContain("Resolved");
    expect(html).toContain("Finished");
    expect(html).toContain("Restored");
  });
});

function createMetricsSnapshot(): RoomMetricsSnapshot {
  return {
    checkedAt: "2026-05-23T03:00:00.000Z",
    current: {
      humanPlayers: 2,
      onlineConnections: 0,
      onlinePlayers: 0,
      rooms: {
        activeInGame: 1,
        finished: 0,
        inactiveInGame: 1,
        lobby: 1,
        total: 2,
      },
    },
    history: {
      activeRoomGameMinutes: 2.5,
      adapter: "postgres",
      averageFinishedGameMinutes: 12,
      averageMainGameMinutes: 8,
      averageSiteGameMinutes: 10,
      gamesFinished: 1,
      gamesStarted: 2,
      homeViews: 9,
      mainCompletionRate: 50,
      mainGamesFinished: 1,
      mainGamesStarted: 2,
      roomPageViews: 12,
      roomRecoveriesRestored: 3,
      roomsReachedSpeech: 5,
      roomsReachedVote: 4,
      roomsResolvedVote: 3,
      recentDays: [
        {
          date: "2026-05-23",
          gamesFinished: 1,
          gamesStarted: 2,
          homeViews: 9,
          mainGamesFinished: 1,
          mainGamesStarted: 2,
          playersJoined: 2,
          roomPageViews: 12,
          roomRecoveriesRestored: 3,
          roomsReachedSpeech: 5,
          roomsReachedVote: 4,
          roomsResolvedVote: 3,
          roomsCreated: 1,
        },
      ],
      roomCompletionRate: 50,
      siteCompletionRate: 50,
      totalFinishedGameMinutes: 12,
      totalMainGameMinutes: 8,
      totalPlayersEver: 2,
      totalRoomGameMinutes: 12,
      totalRoomsEver: 1,
      totalSiteGameMinutes: 20,
      trackedSince: "2026-05-23T02:00:00.000Z",
    },
  };
}

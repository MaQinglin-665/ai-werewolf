import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomView } from "@/server/roomService";
import { MobileRoomLobby } from "./MobileRoomLobby";

type RoomViewOverrides = Omit<Partial<RoomView>, "room" | "turn"> & {
  room?: Partial<RoomView["room"]>;
  turn?: Partial<RoomView["turn"]>;
};

function buildRoomView(overrides: RoomViewOverrides = {}): RoomView {
  const base: RoomView = {
    room: {
      id: "room-1",
      code: "M7Q2K9",
      status: "lobby",
      revision: 3,
      updatedAt: "2026-05-23T05:30:00.000Z",
      board: {
        id: "9p-seer-witch-hunter",
        name: "9 人标准局",
        seatCount: 9,
        roleSummary: "3狼 3民 预言家 女巫 猎人",
        description: "测试板子",
        hasGuard: false,
        hasSheriff: false,
        winCondition: "side-slaughter",
      },
      hostPlayerId: "host",
      players: [
        { playerId: "host", playerToken: "host-token", name: "Alpha", isHost: true, online: true, seatId: 1 },
        { playerId: "self", playerToken: "self-token", name: "Beta", isHost: false, online: true, seatId: 2 },
        {
          playerId: "offline",
          playerToken: "offline-token",
          name: "Gamma",
          isHost: false,
          online: false,
          seatId: 4,
          lastSeenAt: "2026-05-23T05:20:00.000Z",
        },
      ],
      seats: [
        { seatId: 1, controller: "human", playerId: "host", playerName: "Alpha" },
        { seatId: 2, controller: "human", playerId: "self", playerName: "Beta" },
        { seatId: 4, controller: "human", playerId: "offline", playerName: "Gamma" },
      ],
    },
    turn: {
      type: "lobby",
      isSelfActor: false,
      canHostContinue: false,
      title: "等待开局",
      detail: "房主开局后进入游戏。",
    },
    playerId: "host",
    playerToken: "host-token",
    playerSeatId: 1,
  };

  return {
    ...base,
    ...overrides,
    room: {
      ...base.room,
      ...overrides.room,
      board: { ...base.room.board, ...overrides.room?.board },
      players: overrides.room?.players ?? base.room.players,
      seats: overrides.room?.seats ?? base.room.seats,
    },
    turn: { ...base.turn, ...overrides.turn },
  };
}

function renderLobby(props: Partial<Parameters<typeof MobileRoomLobby>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(MobileRoomLobby, {
      isHost: true,
      onCopyInviteLink: () => undefined,
      onCopyPlayerRecoveryLink: () => undefined,
      onCopyRecoveryLink: () => undefined,
      onRefresh: () => undefined,
      onRemovePlayer: () => undefined,
      onSeatChange: () => undefined,
      onStart: () => undefined,
      pending: null,
      roomView: buildRoomView(),
      seatIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      shareOrigin: "https://example.test",
      ...props,
    }),
  );
}

describe("MobileRoomLobby", () => {
  it("keeps all RoomClient lobby actions represented on mobile", () => {
    const html = renderLobby({ isHost: true });

    expect(html).toContain("邀请");
    expect(html).toContain("刷新");
    expect(html).toContain("恢复");
    expect(html).toContain("玩家");
    expect(html).toContain("开始游戏");
    expect(html).toContain("复制恢复");
    expect(html).toContain("移除");
  });

  it("renders the mobile lobby shell, header, and stage", () => {
    const html = renderLobby();

    expect(html).toContain("mobile-room-lobby");
    expect(html).toContain("mobile-room-lobby-header");
    expect(html).toContain("mobile-room-lobby-header-copy");
    expect(html).toContain("mobile-room-lobby-code");
    expect(html).toContain("房间 M7Q2K9");
    expect(html).toContain("9 人标准局 · 大厅");
    expect(html).toContain("真人 3 / 9");
    expect(html).toContain("在线 2 / 3");
    expect(html).toContain("mobile-room-lobby-stage");
    expect(html).toContain("mobile-room-lobby-center-seal");
    expect(html).toContain("mobile-room-lobby-dock-status");
    expect(html).toContain("3 / 9");
    expect(html).toContain("已入座");
  });

  it("marks self, host, offline, and open seats with accessible labels", () => {
    const html = renderLobby();

    expect(html).toContain("mobile-room-lobby-seat-self");
    expect(html).toContain("mobile-room-lobby-seat-host");
    expect(html).toContain("mobile-room-lobby-seat-offline");
    expect(html).toContain("mobile-room-lobby-seat-open");
    expect(html).toContain("mobile-room-lobby-seat-core");
    expect(html).toContain('aria-label="1 号 玩家 Alpha 房主 在线 当前玩家"');
    expect(html).toContain('aria-label="2 号 玩家 Beta 在线"');
    expect(html).toContain('aria-label="4 号 玩家 Gamma 离线"');
    expect(html).toContain("离线");
  });

  it("renders host start controls and player management", () => {
    const html = renderLobby();

    expect(html).toContain("mobile-room-lobby-start-button");
    expect(html).toContain("开始游戏");
    expect(html).toContain("mobile-room-lobby-player-drawer");
    expect(html).toContain("复制恢复");
    expect(html).toContain("移除");
    expect(html).toContain("mobile-room-lobby-player-backdrop");
    expect(html).toContain("mobile-room-lobby-player-head");
    expect(html).toContain("mobile-room-lobby-host-pill");
    expect(html).toContain("mobile-room-lobby-player-actions");
    expect(html).toContain("手机链接将使用：https://example.test");
  });

  it("mounts the player drawer closed by default without exposing it to accessibility", () => {
    const html = renderLobby();
    const drawerIndex = html.indexOf('class="mobile-room-lobby-player-drawer');
    const playerListIndex = html.indexOf('<section aria-label="房间玩家列表"', drawerIndex);

    expect(drawerIndex).toBeGreaterThan(-1);
    expect(playerListIndex).toBeGreaterThan(drawerIndex);
    expect(html).not.toContain("mobile-room-lobby-player-drawer-open");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/tab(?:I|i)ndex="-1"/);
    expect(html).toContain("复制恢复");
    expect(html).toContain("移除");
  });

  it("counts human-controlled seats instead of connected players", () => {
    const html = renderLobby({
      roomView: buildRoomView({
        room: {
          players: [
            { playerId: "host", playerToken: "host-token", name: "Alpha", isHost: true, online: true, seatId: 1 },
            { playerId: "self", playerToken: "self-token", name: "Beta", isHost: false, online: true, seatId: 2 },
            { playerId: "spectator", playerToken: "spectator-token", name: "Delta", isHost: false, online: true },
          ],
          seats: [
            { seatId: 1, controller: "human", playerId: "host", playerName: "Alpha" },
            { seatId: 2, controller: "human", playerId: "self", playerName: "Beta" },
          ],
        },
      }),
    });

    expect(html).toContain("真人 2 / 9");
    expect(html).toContain("2 / 9");
  });

  it("renders a non-host waiting state without the start button", () => {
    const html = renderLobby({
      isHost: false,
      roomView: buildRoomView({ playerId: "self", playerToken: "self-token", playerSeatId: 2 }),
    });

    expect(html).toContain("等待房主开局");
    expect(html).not.toContain("mobile-room-lobby-start-button");
  });

  it("renders a pending seat state", () => {
    const html = renderLobby({ pending: "seat" });

    expect(html).toContain('aria-label="3 号空位 操作中"');
    expect(html).toContain("mobile-room-lobby-seat-pending");
    expect(html).toContain("换座中...");
  });
});

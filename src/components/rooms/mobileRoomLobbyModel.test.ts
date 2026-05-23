import { describe, expect, it } from "vitest";
import type { RoomView } from "@/server/roomService";
import {
  buildMobileRoomLobbySeatIds,
  getMobileRoomLobbyDockCopy,
  getMobileRoomLobbySeatDensityClass,
  getMobileRoomLobbySeatState,
  getMobileRoomLobbySeatStyle,
} from "./mobileRoomLobbyModel";

function buildRoomView(overrides: Partial<RoomView> = {}): RoomView {
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
      },
      hostPlayerId: "host",
      players: [
        { playerId: "host", playerToken: "host-token", name: "房主", isHost: true, online: true, seatId: 1 },
        { playerId: "self", playerToken: "self-token", name: "你", isHost: false, online: true, seatId: 2 },
        {
          playerId: "offline",
          playerToken: "offline-token",
          name: "小明",
          isHost: false,
          online: false,
          seatId: 5,
          lastSeenAt: "2026-05-23T05:20:00.000Z",
        },
      ],
      seats: [
        { seatId: 1, controller: "human", playerId: "host", playerName: "房主" },
        { seatId: 2, controller: "human", playerId: "self", playerName: "你" },
        { seatId: 5, controller: "human", playerId: "offline", playerName: "小明" },
      ],
    },
    turn: {
      type: "lobby",
      isSelfActor: false,
      canHostContinue: false,
      title: "等待开局",
      detail: "房主开局后进入游戏。",
    },
    playerId: "self",
    playerToken: "self-token",
    playerSeatId: 2,
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

describe("mobile room lobby model", () => {
  it("builds bounded visible seat ids", () => {
    expect(buildMobileRoomLobbySeatIds(6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buildMobileRoomLobbySeatIds(9)).toHaveLength(9);
    expect(buildMobileRoomLobbySeatIds(12)).toHaveLength(12);
    expect(buildMobileRoomLobbySeatIds(99)).toHaveLength(12);
    expect(buildMobileRoomLobbySeatIds(0)).toEqual([1]);
  });

  it("uses compact density and stable CSS variables for dense boards", () => {
    expect(getMobileRoomLobbySeatDensityClass(6)).toBe("");
    expect(getMobileRoomLobbySeatDensityClass(9)).toBe("mobile-room-lobby-seat-many");
    expect(getMobileRoomLobbySeatDensityClass(12)).toBe("mobile-room-lobby-seat-dense");
    expect(getMobileRoomLobbySeatStyle(0, 12)).toEqual({
      "--room-lobby-seat-size": "38px",
      "--room-lobby-seat-x": "24.0%",
      "--room-lobby-seat-y": "16.0%",
    });
  });

  it("derives self, host, offline, and empty seat labels", () => {
    const roomView = buildRoomView();

    expect(getMobileRoomLobbySeatState({ roomView, seatId: 1, pending: null })).toMatchObject({
      canSelect: false,
      isHostSeat: true,
      isOpen: false,
      label: "房主",
      statusLabel: "房主",
      ariaLabel: "1 号 房主 房主 已占用",
    });

    expect(getMobileRoomLobbySeatState({ roomView, seatId: 2, pending: null })).toMatchObject({
      canSelect: false,
      isSelf: true,
      label: "你",
      statusLabel: "你",
      ariaLabel: "2 号 你 当前座位",
    });

    expect(getMobileRoomLobbySeatState({ roomView, seatId: 5, pending: null })).toMatchObject({
      canSelect: false,
      isOffline: true,
      label: "小明",
      statusLabel: "离线",
      ariaLabel: "5 号 小明 已占用 离线",
    });

    expect(getMobileRoomLobbySeatState({ roomView, seatId: 3, pending: null })).toMatchObject({
      canSelect: true,
      isOpen: true,
      label: "空位",
      statusLabel: "可选",
      ariaLabel: "选择 3 号空位",
    });
  });

  it("disables empty seat selection while a seat request is pending", () => {
    const state = getMobileRoomLobbySeatState({ roomView: buildRoomView(), seatId: 3, pending: "seat" });

    expect(state.canSelect).toBe(false);
    expect(state.ariaLabel).toBe("3 号空位 操作中");
  });

  it("builds host and non-host dock copy", () => {
    const roomView = buildRoomView();

    expect(getMobileRoomLobbyDockCopy({ isHost: true, roomView })).toEqual({
      primary: "你在 2 号位",
      secondary: "可以换座；人数确认后开始游戏。",
      primaryAction: "开始游戏",
    });

    expect(getMobileRoomLobbyDockCopy({ isHost: false, roomView })).toEqual({
      primary: "你在 2 号位",
      secondary: "等待房主开局；可以先换到空位。",
      primaryAction: "等待房主开局",
    });

    expect(getMobileRoomLobbyDockCopy({ isHost: false, roomView: buildRoomView({ playerSeatId: undefined }) })).toEqual({
      primary: "尚未入座",
      secondary: "点一个空位加入牌桌。",
      primaryAction: "等待入座",
    });
  });
});

import type * as React from "react";
import type { RoomPlayerView, RoomSeatView, RoomView } from "@/server/roomService";

export type MobileRoomLobbyPending = "command" | "create" | "debugCleanup" | "join" | "refresh" | "remove" | "seat" | "start" | null;

export type MobileRoomLobbySeatStyle = React.CSSProperties & {
  "--room-lobby-seat-size": string;
  "--room-lobby-seat-x": string;
  "--room-lobby-seat-y": string;
};

type MobileRoomLobbySeatPoint = {
  x: number;
  y: number;
  size: number;
};

export type MobileRoomLobbySeatState = {
  seatId: number;
  seat?: RoomSeatView;
  player?: RoomPlayerView;
  label: string;
  statusLabel: string;
  ariaLabel: string;
  canSelect: boolean;
  isAi: boolean;
  isHostSeat: boolean;
  isOffline: boolean;
  isOpen: boolean;
  isSelf: boolean;
};

export type MobileRoomLobbyDockCopy = {
  primary: string;
  secondary: string;
  primaryAction: string;
};

const MOBILE_ROOM_LOBBY_SEAT_POINTS: Record<number, MobileRoomLobbySeatPoint[]> = {
  6: [
    { x: 22, y: 20, size: 52 },
    { x: 78, y: 20, size: 52 },
    { x: 7, y: 50, size: 52 },
    { x: 93, y: 50, size: 52 },
    { x: 22, y: 80, size: 52 },
    { x: 78, y: 80, size: 52 },
  ],
  9: [
    { x: 23, y: 18, size: 44 },
    { x: 77, y: 18, size: 44 },
    { x: 11, y: 34, size: 44 },
    { x: 89, y: 34, size: 44 },
    { x: 7, y: 52, size: 44 },
    { x: 93, y: 52, size: 44 },
    { x: 15, y: 70, size: 44 },
    { x: 85, y: 70, size: 44 },
    { x: 50, y: 84, size: 44 },
  ],
  12: [
    { x: 24, y: 16, size: 38 },
    { x: 76, y: 16, size: 38 },
    { x: 11, y: 28, size: 38 },
    { x: 89, y: 28, size: 38 },
    { x: 21, y: 42, size: 38 },
    { x: 79, y: 42, size: 38 },
    { x: 8, y: 58, size: 38 },
    { x: 92, y: 58, size: 38 },
    { x: 21, y: 72, size: 38 },
    { x: 79, y: 72, size: 38 },
    { x: 16, y: 88, size: 38 },
    { x: 84, y: 88, size: 38 },
  ],
};

export function buildMobileRoomLobbySeatIds(seatCount: number): number[] {
  const visibleCount = Math.max(1, Math.min(12, Math.floor(seatCount)));
  return Array.from({ length: visibleCount }, (_, index) => index + 1);
}

export function getMobileRoomLobbySeatDensityClass(seatCount: number): string {
  if (seatCount >= 10) return "mobile-room-lobby-seat-dense";
  if (seatCount >= 8) return "mobile-room-lobby-seat-many";
  return "";
}

export function getMobileRoomLobbySeatStyle(index: number, seatCount: number): MobileRoomLobbySeatStyle {
  const presetPoint = MOBILE_ROOM_LOBBY_SEAT_POINTS[seatCount]?.[index];
  if (presetPoint) {
    return {
      "--room-lobby-seat-size": `${presetPoint.size}px`,
      "--room-lobby-seat-x": `${presetPoint.x.toFixed(1)}%`,
      "--room-lobby-seat-y": `${presetPoint.y.toFixed(1)}%`,
    };
  }

  const pairCount = Math.max(1, Math.ceil(seatCount / 2));
  const pairIndex = Math.floor(index / 2);
  const progress = pairCount === 1 ? 0.5 : pairIndex / (pairCount - 1);
  const sideArc = Math.abs(progress - 0.5) * 2;
  const isRightSide = index % 2 === 1;
  const isOddCenterSeat = seatCount % 2 === 1 && index === seatCount - 1;
  const xInset = seatCount >= 10 ? 8 + sideArc * 10 : 8 + sideArc * 14;
  const x = isOddCenterSeat ? 50 : isRightSide ? 100 - xInset : xInset;
  const y = seatCount >= 10 ? 16 + progress * 72 : seatCount >= 8 ? 18 + progress * 68 : 18 + progress * 66;
  const size = seatCount >= 10 ? 38 : seatCount >= 8 ? 44 : 52;

  return {
    "--room-lobby-seat-size": `${size}px`,
    "--room-lobby-seat-x": `${x.toFixed(1)}%`,
    "--room-lobby-seat-y": `${y.toFixed(1)}%`,
  };
}

export function getMobileRoomLobbySeatState({
  pending,
  roomView,
  seatId,
}: {
  pending: MobileRoomLobbyPending;
  roomView: RoomView;
  seatId: number;
}): MobileRoomLobbySeatState {
  const seat = roomView.room.seats.find((item) => item.seatId === seatId);
  const player = seat?.playerId ? roomView.room.players.find((item) => item.playerId === seat.playerId) : undefined;
  const isOpen = !seat || seat.controller === "open";
  const isSelf = Boolean(seat?.playerId && seat.playerId === roomView.playerId);
  const isHostSeat = Boolean(seat?.playerId && seat.playerId === roomView.room.hostPlayerId);
  const isAi = seat?.controller === "ai";
  const isOffline = Boolean(player && !player.online);
  const label = isOpen ? "空位" : seat?.playerName ?? seat?.aiName ?? player?.name ?? "已占用";
  const statusLabel = isSelf ? "你" : isHostSeat ? "房主" : isOffline ? "离线" : isOpen ? "可选" : isAi ? "AI" : "真人";
  const canSelect = isOpen && pending === null;

  return {
    seatId,
    seat,
    player,
    label,
    statusLabel,
    ariaLabel: buildSeatAriaLabel({ canSelect, isHostSeat, isOffline, isOpen, isSelf, label, pending, seatId }),
    canSelect,
    isAi,
    isHostSeat,
    isOffline,
    isOpen,
    isSelf,
  };
}

export function getMobileRoomLobbyDockCopy({ isHost, roomView }: { isHost: boolean; roomView: RoomView }): MobileRoomLobbyDockCopy {
  const seatCopy = roomView.playerSeatId ? `你在 ${roomView.playerSeatId} 号位` : "尚未入座";

  if (!roomView.playerSeatId) {
    return {
      primary: seatCopy,
      secondary: "点一个空位加入牌桌。",
      primaryAction: "等待入座",
    };
  }

  if (isHost) {
    return {
      primary: seatCopy,
      secondary: "可以换座；人数确认后开始游戏。",
      primaryAction: "开始游戏",
    };
  }

  return {
    primary: seatCopy,
    secondary: "等待房主开局；可以先换到空位。",
    primaryAction: "等待房主开局",
  };
}

function buildSeatAriaLabel({
  canSelect,
  isHostSeat,
  isOffline,
  isOpen,
  isSelf,
  label,
  pending,
  seatId,
}: {
  canSelect: boolean;
  isHostSeat: boolean;
  isOffline: boolean;
  isOpen: boolean;
  isSelf: boolean;
  label: string;
  pending: MobileRoomLobbyPending;
  seatId: number;
}): string {
  if (isOpen) {
    if (canSelect) return `选择 ${seatId} 号空位`;
    return `${seatId} 号空位${pending === "seat" ? " 操作中" : ""}`.trim();
  }

  if (isSelf) return `${seatId} 号 ${label} 当前座位`;

  const parts = [`${seatId} 号 ${label}`];
  if (isHostSeat) parts.push("房主");
  parts.push("已占用");
  if (isOffline) parts.push("离线");
  return parts.join(" ");
}

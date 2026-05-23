# Mobile Room Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first online room lobby that uses a table-stage seat layout with clear room status and reachable lobby actions.

**Architecture:** Keep `RoomClient.tsx` as the orchestration layer and move the new mobile lobby surface into `src/components/rooms/`. Add a pure model helper for seat geometry, labels, and status copy so most behavior can be covered with fast Vitest tests. The mobile component renders only on phone widths while the existing desktop lobby remains the source for larger breakpoints.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, React server static rendering via `react-dom/server`, existing Tailwind utility classes, and mobile-only CSS in `src/app/globals.css`.

---

## File Structure

- Create `src/components/rooms/mobileRoomLobbyModel.ts`
  - Pure helpers for mobile lobby seat ids, seat geometry, density classes, seat state, and dock copy.
  - No React component rendering except a `React.CSSProperties` type import for CSS variables.
- Create `src/components/rooms/mobileRoomLobbyModel.test.ts`
  - Unit tests for 6/9/12-seat layout, self/host/offline state, empty-seat accessibility labels, and host/non-host dock copy.
- Create `src/components/rooms/MobileRoomLobby.tsx`
  - Phone-only room lobby composition: header, table stage, seat buttons, dock, and player drawer.
  - Receives handlers from `RoomClient` and never calls room APIs directly.
- Create `src/components/rooms/mobileRoomLobby.test.ts`
  - Static-render tests for markup, host/non-host controls, player drawer content, and disabled states.
- Modify `src/components/RoomClient.tsx`
  - Import `MobileRoomLobby`.
  - Render `MobileRoomLobby` inside the existing `LobbyView` for mobile widths.
  - Hide the existing desktop lobby grid on phone widths and keep it unchanged for `sm` and above.
- Modify `src/app/globals.css`
  - Add mobile-only `.mobile-room-lobby-*` styles under `@media (max-width: 639px)`.
  - Add reduced-motion coverage for new mobile seat animations.

No task should modify `src/server/**`, `src/app/api/**`, `src/game/**`, `src/ai/**`, Prisma files, room storage, or deployment configuration.

---

### Task 1: Mobile Lobby Model

**Files:**
- Create: `src/components/rooms/mobileRoomLobbyModel.test.ts`
- Create: `src/components/rooms/mobileRoomLobbyModel.ts`

- [ ] **Step 1: Write the failing model tests**

Create `src/components/rooms/mobileRoomLobbyModel.test.ts`:

```typescript
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
        { playerId: "offline", playerToken: "offline-token", name: "小明", isHost: false, online: false, seatId: 5, lastSeenAt: "2026-05-23T05:20:00.000Z" },
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
```

- [ ] **Step 2: Run the model tests and verify RED**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts
```

Expected: FAIL because `src/components/rooms/mobileRoomLobbyModel.ts` does not exist.

- [ ] **Step 3: Implement the mobile lobby model**

Create `src/components/rooms/mobileRoomLobbyModel.ts`:

```typescript
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
```

- [ ] **Step 4: Run the model tests and verify GREEN**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts
```

Expected: PASS for all `mobile room lobby model` tests.

- [ ] **Step 5: Commit the model**

Run:

```powershell
git add src/components/rooms/mobileRoomLobbyModel.ts src/components/rooms/mobileRoomLobbyModel.test.ts
git commit -m "feat: add mobile room lobby model"
```

Expected: commit succeeds and only the two model files are staged.

---

### Task 2: Mobile Room Lobby Component

**Files:**
- Create: `src/components/rooms/mobileRoomLobby.test.ts`
- Create: `src/components/rooms/MobileRoomLobby.tsx`
- Use: `src/components/rooms/mobileRoomLobbyModel.ts`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/rooms/mobileRoomLobby.test.ts`:

```typescript
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomView } from "@/server/roomService";
import { MobileRoomLobby } from "./MobileRoomLobby";

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
        { playerId: "offline", playerToken: "offline-token", name: "小明", isHost: false, online: false, seatId: 5, lastSeenAt: "2026-05-23T05:20:00.000Z" },
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

function renderLobby(props: Partial<Parameters<typeof MobileRoomLobby>[0]> = {}) {
  const roomView = props.roomView ?? buildRoomView();
  return renderToStaticMarkup(
    createElement(MobileRoomLobby, {
      isHost: false,
      onCopyInviteLink: () => undefined,
      onCopyPlayerRecoveryLink: () => undefined,
      onCopyRecoveryLink: () => undefined,
      onRefresh: () => undefined,
      onRemovePlayer: () => undefined,
      onSeatChange: () => undefined,
      onStart: () => undefined,
      pending: null,
      roomView,
      seatIds: Array.from({ length: roomView.room.board.seatCount }, (_, index) => index + 1),
      shareOrigin: "https://example.test",
      ...props,
    }),
  );
}

describe("MobileRoomLobby", () => {
  it("renders the B+A mobile room lobby shell", () => {
    const html = renderLobby();

    expect(html).toContain("mobile-room-lobby");
    expect(html).toContain("mobile-room-lobby-header");
    expect(html).toContain("房间 M7Q2K9");
    expect(html).toContain("9 人标准局 · 大厅");
    expect(html).toContain("真人 3 / 9");
    expect(html).toContain("在线 2 / 3");
    expect(html).toContain("mobile-room-lobby-stage");
    expect(html).toContain("mobile-room-lobby-center-seal");
    expect(html).toContain("3 / 9");
    expect(html).toContain("已入座");
  });

  it("marks self, host, offline, and open seats on the table stage", () => {
    const html = renderLobby();

    expect(html).toContain("mobile-room-lobby-seat-self");
    expect(html).toContain("mobile-room-lobby-seat-host");
    expect(html).toContain("mobile-room-lobby-seat-offline");
    expect(html).toContain("mobile-room-lobby-seat-open");
    expect(html).toContain('aria-label="2 号 你 当前座位"');
    expect(html).toContain('aria-label="选择 3 号空位"');
    expect(html).toContain("离线");
  });

  it("renders host start controls and player management entries", () => {
    const html = renderLobby({ isHost: true });

    expect(html).toContain("开始游戏");
    expect(html).toContain("mobile-room-lobby-player-drawer");
    expect(html).toContain("复制恢复");
    expect(html).toContain("移除");
    expect(html).toContain("手机链接将使用：https://example.test");
  });

  it("shows a waiting primary action for non-host players", () => {
    const html = renderLobby({ isHost: false });

    expect(html).toContain("等待房主开局");
    expect(html).not.toContain("mobile-room-lobby-start-button");
  });

  it("disables seat and dock actions while a seat request is pending", () => {
    const html = renderLobby({ pending: "seat" });

    expect(html).toContain('aria-label="3 号空位 操作中"');
    expect(html).toContain("mobile-room-lobby-seat-pending");
    expect(html).toContain("换座中...");
  });
});
```

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobby.test.ts
```

Expected: FAIL because `src/components/rooms/MobileRoomLobby.tsx` does not exist.

- [ ] **Step 3: Implement the mobile room lobby component**

Create `src/components/rooms/MobileRoomLobby.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { RoomPlayerView, RoomView } from "@/server/roomService";
import {
  buildMobileRoomLobbySeatIds,
  getMobileRoomLobbyDockCopy,
  getMobileRoomLobbySeatDensityClass,
  getMobileRoomLobbySeatState,
  getMobileRoomLobbySeatStyle,
  type MobileRoomLobbyPending,
} from "./mobileRoomLobbyModel";

export function MobileRoomLobby({
  isHost,
  onCopyInviteLink,
  onCopyPlayerRecoveryLink,
  onCopyRecoveryLink,
  onRefresh,
  onRemovePlayer,
  onSeatChange,
  onStart,
  pending,
  roomView,
  seatIds,
  shareOrigin,
}: {
  isHost: boolean;
  onCopyInviteLink: () => void;
  onCopyPlayerRecoveryLink: (player: RoomPlayerView) => void;
  onCopyRecoveryLink: () => void;
  onRefresh: () => void;
  onRemovePlayer: (playerId: string) => void;
  onSeatChange: (seatId: number | null) => void;
  onStart: () => void;
  pending: MobileRoomLobbyPending;
  roomView: RoomView;
  seatIds: number[];
  shareOrigin?: string;
}) {
  const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);
  const visibleSeatIds = seatIds.length > 0 ? seatIds : buildMobileRoomLobbySeatIds(roomView.room.board.seatCount);
  const densityClass = getMobileRoomLobbySeatDensityClass(visibleSeatIds.length);
  const humanCount = roomView.room.seats.filter((seat) => seat.controller === "human").length;
  const onlineCount = roomView.room.players.filter((player) => player.online).length;
  const dockCopy = getMobileRoomLobbyDockCopy({ isHost, roomView });
  const isBusy = pending !== null;
  const isSeatBusy = pending === "seat";

  return (
    <section className="mobile-room-lobby sm:hidden" aria-label="手机选座大厅">
      <header className="mobile-room-lobby-header">
        <div className="mobile-room-lobby-header-copy">
          <div className="mobile-room-lobby-code">房间 {roomView.room.code}</div>
          <h2>{roomView.room.board.name} · 大厅</h2>
          <p>
            真人 {humanCount} / {roomView.room.board.seatCount} · 在线 {onlineCount} / {roomView.room.players.length}
          </p>
          {shareOrigin ? <small>手机链接将使用：{shareOrigin}</small> : null}
        </div>
        <button className="mobile-room-lobby-invite" disabled={isBusy} onClick={onCopyInviteLink} type="button">
          邀请
        </button>
      </header>

      <div className="mobile-room-lobby-stage" aria-label={`${roomView.room.board.seatCount}人房间座位`}>
        <div className="mobile-room-lobby-moon" aria-hidden="true" />
        <div className="mobile-room-lobby-table-glow" aria-hidden="true" />
        <div className="mobile-room-lobby-seat-ring">
          {visibleSeatIds.map((seatId, index) => {
            const seatState = getMobileRoomLobbySeatState({ pending, roomView, seatId });
            return (
              <button
                aria-label={seatState.ariaLabel}
                className={[
                  "mobile-room-lobby-seat",
                  densityClass,
                  seatState.isOpen ? "mobile-room-lobby-seat-open" : "mobile-room-lobby-seat-filled",
                  seatState.isSelf ? "mobile-room-lobby-seat-self" : "",
                  seatState.isHostSeat ? "mobile-room-lobby-seat-host" : "",
                  seatState.isOffline ? "mobile-room-lobby-seat-offline" : "",
                  isSeatBusy && seatState.isOpen ? "mobile-room-lobby-seat-pending" : "",
                ].join(" ")}
                disabled={!seatState.canSelect}
                key={seatId}
                onClick={() => onSeatChange(seatId)}
                style={getMobileRoomLobbySeatStyle(index, visibleSeatIds.length)}
                type="button"
              >
                <span className="mobile-room-lobby-seat-core" aria-hidden="true">
                  <span className="mobile-room-lobby-seat-number">{seatId}</span>
                  <span className="mobile-room-lobby-seat-name">{seatState.isSelf ? "你" : seatState.label}</span>
                  <span className="mobile-room-lobby-seat-status">{seatState.statusLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mobile-room-lobby-center-seal" aria-hidden="true">
          <span>WAITING ROOM</span>
          <strong>
            {humanCount} / {roomView.room.board.seatCount}
          </strong>
          <small>已入座</small>
        </div>
      </div>

      <div className="mobile-room-lobby-dock">
        <div className="mobile-room-lobby-dock-status">
          <strong>{dockCopy.primary}</strong>
          <span>{isSeatBusy ? "换座中..." : dockCopy.secondary}</span>
        </div>
        <div className="mobile-room-lobby-dock-actions">
          <button type="button" onClick={() => setIsPlayerDrawerOpen(true)}>
            玩家
          </button>
          <button type="button" disabled={isBusy} onClick={onRefresh}>
            {pending === "refresh" ? "刷新中" : "刷新"}
          </button>
          <button type="button" disabled={isBusy || !roomView.playerId} onClick={onCopyRecoveryLink}>
            恢复
          </button>
        </div>
        {isHost ? (
          <button
            className="mobile-room-lobby-start-button"
            disabled={isBusy || humanCount === 0}
            onClick={onStart}
            type="button"
          >
            {pending === "start" ? "开局中..." : dockCopy.primaryAction}
          </button>
        ) : (
          <div className="mobile-room-lobby-waiting-action">{dockCopy.primaryAction}</div>
        )}
      </div>

      <div className={["mobile-room-lobby-player-drawer", isPlayerDrawerOpen ? "mobile-room-lobby-player-drawer-open" : ""].join(" ")}>
        <button className="mobile-room-lobby-player-backdrop" aria-label="关闭玩家列表" onClick={() => setIsPlayerDrawerOpen(false)} type="button" />
        <section aria-label="房间玩家列表">
          <div className="mobile-room-lobby-player-head">
            <strong>玩家</strong>
            <button onClick={() => setIsPlayerDrawerOpen(false)} type="button">
              关闭
            </button>
          </div>
          <div className="mobile-room-lobby-player-list">
            {roomView.room.players.map((player) => (
              <div className="mobile-room-lobby-player-row" key={player.playerId}>
                <div className="mobile-room-lobby-player-main">
                  <strong>
                    {player.seatId ? `${player.seatId}号 · ` : ""}
                    {player.name}
                  </strong>
                  <span>{player.online ? "在线" : "离线"}</span>
                </div>
                <div className="mobile-room-lobby-player-actions">
                  {player.isHost ? <span className="mobile-room-lobby-host-pill">房主</span> : null}
                  {isHost ? (
                    <button disabled={isBusy} onClick={() => onCopyPlayerRecoveryLink(player)} type="button">
                      复制恢复
                    </button>
                  ) : null}
                  {isHost && player.playerId !== roomView.playerId ? (
                    <button disabled={isBusy} onClick={() => onRemovePlayer(player.playerId)} type="button">
                      {pending === "remove" ? "移除中" : "移除"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the component tests and verify GREEN**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobby.test.ts
```

Expected: PASS for all `MobileRoomLobby` tests.

- [ ] **Step 5: Run model and component tests together**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts src/components/rooms/mobileRoomLobby.test.ts
```

Expected: PASS for both room mobile lobby test files.

- [ ] **Step 6: Commit the component**

Run:

```powershell
git add src/components/rooms/MobileRoomLobby.tsx src/components/rooms/mobileRoomLobby.test.ts
git commit -m "feat: add mobile room lobby component"
```

Expected: commit succeeds and only the component/test files are staged.

---

### Task 3: Wire Mobile Lobby Into RoomClient

**Files:**
- Modify: `src/components/RoomClient.tsx`
- Test: `src/components/rooms/mobileRoomLobby.test.ts`

- [ ] **Step 1: Extend the component test with the full prop surface**

Update `src/components/rooms/mobileRoomLobby.test.ts` by adding this test inside `describe("MobileRoomLobby", () => { ... })`:

```typescript
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
```

- [ ] **Step 2: Run the component test and verify it still passes before wiring**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobby.test.ts
```

Expected: PASS. This confirms the mobile component has the full action surface before it is wired into `RoomClient`.

- [ ] **Step 3: Import the mobile lobby component**

Modify the imports at the top of `src/components/RoomClient.tsx` so the block includes:

```typescript
import { MobileRoomLobby } from "@/components/rooms/MobileRoomLobby";
```

The top import section should look like this after the edit:

```typescript
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionPanel,
  AuxiliaryInfoPanel,
  FlowStatusBar,
  HostStage,
  IdiotRevealOverlay,
  PhaseCurtain,
  PhaseRhythm,
  ReviewPanel,
  SeatBoard,
  VoteTable,
  buildIdiotRevealCue,
  getPhaseCurtainCue,
  type PhaseCurtainCue,
  type IdiotRevealCue,
} from "@/components/game/GamePanels";
import type { CommandPayload, HostAudioStatus } from "@/components/game/clientTypes";
import { MobileRoomLobby } from "@/components/rooms/MobileRoomLobby";
import type { HumanCommandInput } from "@/game/commandSchemas";
import type { HumanGameView } from "@/game/types";
import type { RoomPlayerView, RoomSeatView, RoomView } from "@/server/roomService";
```

- [ ] **Step 4: Pass toolbar actions into `LobbyView`**

In `src/components/RoomClient.tsx`, update the `LobbyView` usage inside `RoomClient` so it passes the invite, recovery, refresh, start, and share origin props:

```tsx
                    <LobbyView
                      isHost={isHost}
                      onCopyInviteLink={() => void handleCopyInviteLink()}
                      onCopyPlayerRecoveryLink={(player) => void handleCopyPlayerRecoveryLink(player)}
                      onCopyRecoveryLink={() => void handleCopyRecoveryLink()}
                      onRefresh={() => void refreshView(false)}
                      onRemovePlayer={(playerId) => void handleRemovePlayer(playerId)}
                      onSeatChange={(seatId) => void handleSeatChange(seatId)}
                      onStart={() => void handleStartRoom()}
                      pending={pending}
                      roomView={roomView}
                      seatIds={boardSeatIds}
                      shareOrigin={shareOrigin}
                    />
```

- [ ] **Step 5: Extend the `LobbyView` function signature**

Modify the `LobbyView` signature in `src/components/RoomClient.tsx` to accept the new props:

```tsx
function LobbyView({
  isHost,
  onCopyInviteLink,
  onCopyPlayerRecoveryLink,
  onCopyRecoveryLink,
  onRefresh,
  onRemovePlayer,
  onSeatChange,
  onStart,
  pending,
  roomView,
  seatIds,
  shareOrigin,
}: {
  isHost: boolean;
  onCopyInviteLink: () => void;
  onCopyPlayerRecoveryLink: (player: RoomPlayerView) => void;
  onCopyRecoveryLink: () => void;
  onRefresh: () => void;
  onRemovePlayer: (playerId: string) => void;
  onSeatChange: (seatId: number | null) => void;
  onStart: () => void;
  pending: PendingKind;
  roomView: RoomView;
  seatIds: number[];
  shareOrigin?: string;
}) {
```

- [ ] **Step 6: Render mobile and desktop lobby surfaces separately**

In `src/components/RoomClient.tsx`, replace the first line of the `LobbyView` return from:

```tsx
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
```

to this wrapper:

```tsx
    <>
      <MobileRoomLobby
        isHost={isHost}
        onCopyInviteLink={onCopyInviteLink}
        onCopyPlayerRecoveryLink={onCopyPlayerRecoveryLink}
        onCopyRecoveryLink={onCopyRecoveryLink}
        onRefresh={onRefresh}
        onRemovePlayer={onRemovePlayer}
        onSeatChange={onSeatChange}
        onStart={onStart}
        pending={pending}
        roomView={roomView}
        seatIds={seatIds}
        shareOrigin={shareOrigin}
      />
      <div className="hidden gap-5 sm:grid lg:grid-cols-[minmax(0,1fr)_280px]">
```

Then replace the final closing tag of `LobbyView` from:

```tsx
    </div>
```

to:

```tsx
      </div>
    </>
```

Do not change the existing desktop seat grid or player list inside that desktop `<div>`.

- [ ] **Step 7: Run TypeScript and focused tests**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts src/components/rooms/mobileRoomLobby.test.ts
npx tsc --noEmit
```

Expected:

- room mobile lobby tests pass;
- TypeScript passes with no new errors.

- [ ] **Step 8: Commit RoomClient wiring**

Run:

```powershell
git add src/components/RoomClient.tsx src/components/rooms/mobileRoomLobby.test.ts
git commit -m "feat: wire mobile room lobby"
```

Expected: commit succeeds and only `RoomClient.tsx` plus the test update are staged.

---

### Task 4: Mobile Room Lobby Styling

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/components/rooms/mobileRoomLobby.test.ts`

- [ ] **Step 1: Extend component tests for CSS hook classes**

Update `src/components/rooms/mobileRoomLobby.test.ts` by adding this test inside `describe("MobileRoomLobby", () => { ... })`:

```typescript
  it("exposes stable CSS hooks for the mobile table-stage design", () => {
    const html = renderLobby({ isHost: true });

    expect(html).toContain("mobile-room-lobby-table-glow");
    expect(html).toContain("mobile-room-lobby-seat-ring");
    expect(html).toContain("mobile-room-lobby-dock");
    expect(html).toContain("mobile-room-lobby-dock-actions");
    expect(html).toContain("mobile-room-lobby-player-backdrop");
  });
```

- [ ] **Step 2: Run the component tests**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobby.test.ts
```

Expected: PASS. These classes are already present from Task 2; this test protects them before adding CSS.

- [ ] **Step 3: Add mobile-only CSS**

In `src/app/globals.css`, inside the existing `@media (max-width: 639px)` block and before `@media (max-width: 639px) and (max-height: 700px)`, add:

```css
  .mobile-room-lobby {
    display: grid;
    gap: 12px;
    min-height: min(720px, calc(100svh - 128px));
    color: #f7ead5;
  }

  .mobile-room-lobby-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    overflow: hidden;
    border: 1px solid rgba(241, 199, 110, 0.2);
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.28);
    padding: 10px;
  }

  .mobile-room-lobby-header-copy {
    min-width: 0;
  }

  .mobile-room-lobby-code {
    overflow: hidden;
    color: #f1c76e;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-room-lobby-header h2 {
    overflow: hidden;
    margin-top: 3px;
    color: #fff4ce;
    font-size: 16px;
    font-weight: 950;
    line-height: 1.18;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-room-lobby-header p,
  .mobile-room-lobby-header small {
    display: block;
    overflow: hidden;
    margin-top: 4px;
    color: #cdbb9a;
    font-size: 11px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-room-lobby-invite {
    min-height: 38px;
    border-radius: 999px;
    border: 1px solid rgba(241, 199, 110, 0.32);
    background: rgba(241, 199, 110, 0.12);
    padding: 8px 10px;
    color: #f1d796;
    font-size: 11px;
    font-weight: 900;
  }

  .mobile-room-lobby-invite:disabled,
  .mobile-room-lobby-dock button:disabled,
  .mobile-room-lobby-start-button:disabled,
  .mobile-room-lobby-player-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .mobile-room-lobby-stage {
    position: relative;
    isolation: isolate;
    min-width: 0;
    height: min(43svh, 318px);
    min-height: 276px;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(241, 199, 110, 0.2);
    background:
      linear-gradient(180deg, rgba(21, 13, 9, 0.12), rgba(0, 0, 0, 0.75)),
      url("/images/werewolf-table-bg.jpg") center / cover;
    box-shadow:
      0 16px 34px rgba(0, 0, 0, 0.28),
      inset 0 -80px 100px rgba(0, 0, 0, 0.38);
  }

  .mobile-room-lobby-moon,
  .mobile-room-lobby-table-glow,
  .mobile-room-lobby-center-seal,
  .mobile-room-lobby-seat-ring {
    position: absolute;
  }

  .mobile-room-lobby-moon {
    top: 14px;
    right: 16px;
    z-index: 1;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: radial-gradient(circle at 35% 32%, rgba(255, 255, 255, 0.95), rgba(218, 233, 255, 0.65) 44%, rgba(125, 168, 227, 0.18) 70%, transparent 72%);
    box-shadow: 0 0 24px rgba(184, 214, 255, 0.32);
  }

  .mobile-room-lobby-table-glow {
    left: 50%;
    top: 52%;
    z-index: 1;
    width: min(58vw, 218px);
    height: min(30vw, 112px);
    transform: translate(-50%, -42%);
    border-radius: 999px;
    background: radial-gradient(ellipse at center, rgba(241, 199, 110, 0.24), rgba(91, 50, 24, 0.12) 48%, transparent 72%);
    box-shadow: 0 0 46px rgba(241, 199, 110, 0.18);
  }

  .mobile-room-lobby-seat-ring {
    inset: 0;
    z-index: 4;
  }

  .mobile-room-lobby-seat {
    position: absolute;
    top: var(--room-lobby-seat-y, 50%);
    left: var(--room-lobby-seat-x, 50%);
    display: grid;
    width: var(--room-lobby-seat-size, 44px);
    height: var(--room-lobby-seat-size, 44px);
    transform: translate(-50%, -50%);
    place-items: center;
    border-radius: 999px;
    border: 1.5px solid rgba(241, 199, 110, 0.28);
    background:
      radial-gradient(circle at 38% 30%, rgba(255, 255, 255, 0.13), transparent 26%),
      linear-gradient(145deg, rgba(30, 24, 19, 0.8), rgba(7, 6, 6, 0.56));
    color: #f1d796;
    box-shadow:
      0 9px 18px rgba(0, 0, 0, 0.26),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .mobile-room-lobby-seat:focus-visible {
    outline: 2px solid rgba(184, 214, 255, 0.9);
    outline-offset: 3px;
  }

  .mobile-room-lobby-seat-open:not(:disabled) {
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.22);
  }

  .mobile-room-lobby-seat-self {
    border-color: rgba(119, 216, 152, 0.72);
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(119, 216, 152, 0.1);
  }

  .mobile-room-lobby-seat-host {
    border-color: rgba(241, 199, 110, 0.7);
  }

  .mobile-room-lobby-seat-offline {
    border-color: rgba(228, 109, 85, 0.48);
    opacity: 0.82;
  }

  .mobile-room-lobby-seat-pending {
    animation: mobile-seat-confirm-flash 1050ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .mobile-room-lobby-seat-core {
    display: grid;
    min-width: 0;
    justify-items: center;
    gap: 1px;
    padding: 3px;
    text-align: center;
  }

  .mobile-room-lobby-seat-number,
  .mobile-room-lobby-seat-name,
  .mobile-room-lobby-seat-status {
    max-width: calc(var(--room-lobby-seat-size, 44px) - 8px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-room-lobby-seat-number {
    color: #f1c76e;
    font-size: 10px;
    font-weight: 950;
  }

  .mobile-room-lobby-seat-name {
    color: #fff4ce;
    font-size: 10px;
    font-weight: 900;
  }

  .mobile-room-lobby-seat-status {
    color: rgba(247, 234, 213, 0.68);
    font-size: 8px;
    font-weight: 800;
  }

  .mobile-room-lobby-seat-dense .mobile-room-lobby-seat-name,
  .mobile-room-lobby-seat-dense .mobile-room-lobby-seat-status {
    font-size: 8px;
  }

  .mobile-room-lobby-center-seal {
    left: 50%;
    top: 50%;
    z-index: 2;
    display: grid;
    width: min(36vw, 130px);
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    place-items: center;
    border-radius: 999px;
    border: 1px solid rgba(241, 199, 110, 0.24);
    background: radial-gradient(circle, rgba(241, 199, 110, 0.12), rgba(0, 0, 0, 0.16) 62%);
    text-align: center;
  }

  .mobile-room-lobby-center-seal span,
  .mobile-room-lobby-center-seal small {
    color: #cdbb9a;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.12em;
  }

  .mobile-room-lobby-center-seal strong {
    color: #fff3ca;
    font-size: 24px;
    font-weight: 950;
  }

  .mobile-room-lobby-dock {
    display: grid;
    gap: 8px;
    border: 1px solid rgba(241, 199, 110, 0.16);
    border-radius: 22px;
    background: rgba(12, 8, 7, 0.78);
    padding: 10px 10px calc(env(safe-area-inset-bottom, 0px) + 10px);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.26);
  }

  .mobile-room-lobby-dock-status {
    display: grid;
    gap: 3px;
    border-radius: 16px;
    border: 1px solid rgba(119, 216, 152, 0.22);
    background: rgba(18, 48, 30, 0.42);
    padding: 10px;
  }

  .mobile-room-lobby-dock-status strong {
    color: #dff4df;
    font-size: 13px;
    font-weight: 950;
  }

  .mobile-room-lobby-dock-status span {
    color: #a8f0b6;
    font-size: 11px;
    line-height: 1.35;
  }

  .mobile-room-lobby-dock-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }

  .mobile-room-lobby-dock-actions button,
  .mobile-room-lobby-start-button,
  .mobile-room-lobby-waiting-action {
    min-height: 42px;
    border-radius: 13px;
    font-size: 12px;
    font-weight: 850;
  }

  .mobile-room-lobby-dock-actions button {
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: #f7ead5;
  }

  .mobile-room-lobby-start-button {
    border: 0;
    background: #f1c76e;
    color: #1c1208;
    font-size: 14px;
    font-weight: 950;
    box-shadow: 0 12px 22px rgba(241, 199, 110, 0.16);
  }

  .mobile-room-lobby-waiting-action {
    display: grid;
    place-items: center;
    border: 1px solid rgba(125, 168, 227, 0.28);
    background: #142638;
    color: #cfe1ff;
  }

  .mobile-room-lobby-player-drawer {
    position: fixed;
    inset: 0;
    z-index: 70;
    pointer-events: none;
  }

  .mobile-room-lobby-player-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0);
    transition: background 180ms ease;
  }

  .mobile-room-lobby-player-drawer > section {
    position: absolute;
    inset: auto 0 0;
    max-height: min(72svh, 520px);
    overflow: auto;
    border-radius: 24px 24px 0 0;
    border: 1px solid rgba(241, 199, 110, 0.18);
    background: rgba(14, 9, 8, 0.96);
    padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
    transform: translateY(102%);
    transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .mobile-room-lobby-player-drawer-open {
    pointer-events: auto;
  }

  .mobile-room-lobby-player-drawer-open .mobile-room-lobby-player-backdrop {
    background: rgba(0, 0, 0, 0.55);
  }

  .mobile-room-lobby-player-drawer-open > section {
    transform: translateY(0);
  }

  .mobile-room-lobby-player-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
  }

  .mobile-room-lobby-player-head strong {
    color: #fff4ce;
    font-size: 16px;
    font-weight: 950;
  }

  .mobile-room-lobby-player-head button,
  .mobile-room-lobby-player-actions button,
  .mobile-room-lobby-host-pill {
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    padding: 5px 8px;
    color: #f7ead5;
    font-size: 11px;
    font-weight: 850;
  }

  .mobile-room-lobby-player-list {
    display: grid;
    gap: 8px;
  }

  .mobile-room-lobby-player-row {
    display: grid;
    gap: 8px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.24);
    padding: 10px;
  }

  .mobile-room-lobby-player-main {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .mobile-room-lobby-player-main strong {
    min-width: 0;
    overflow: hidden;
    color: #fff4ce;
    font-size: 13px;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-room-lobby-player-main span {
    color: #cdbb9a;
    font-size: 11px;
    font-weight: 800;
  }

  .mobile-room-lobby-player-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mobile-room-lobby-host-pill {
    border-color: rgba(241, 199, 110, 0.28);
    background: rgba(241, 199, 110, 0.12);
    color: #f1d796;
  }
```

- [ ] **Step 4: Add reduced-motion coverage**

Inside the existing `@media (prefers-reduced-motion: reduce)` block in `src/app/globals.css`, include the new animated selector with the existing mobile seat selectors:

```css
  .mobile-room-lobby-seat-pending,
```

Expected: mobile lobby pending-seat flash is disabled for reduced-motion users.

- [ ] **Step 5: Run tests, typecheck, and lint**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts src/components/rooms/mobileRoomLobby.test.ts
npx tsc --noEmit
npm run lint
```

Expected:

- room mobile lobby tests pass;
- TypeScript passes;
- lint passes.

- [ ] **Step 6: Commit mobile lobby CSS**

Run:

```powershell
git add src/app/globals.css src/components/rooms/mobileRoomLobby.test.ts
git commit -m "style: add mobile room lobby layout"
```

Expected: commit succeeds and only CSS plus the test update are staged.

---

### Task 5: Local Browser Verification

**Files:**
- No required source edits unless verification finds a bug.

- [ ] **Step 1: Run shared room tests and production build**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts src/components/rooms/mobileRoomLobby.test.ts src/app/api/rooms/api.test.ts
npm run build
```

Expected:

- all listed tests pass;
- build succeeds;
- if the known Turbopack NFT trace warning appears for room routes, record it as existing warning rather than treating it as a mobile lobby regression.

- [ ] **Step 2: Start or reuse a local dev server**

First check whether a dev server is already running:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

If nothing is listening, start one:

```powershell
npm run dev
```

Expected: a local Next.js server is available at `http://localhost:3000`.

- [ ] **Step 3: Open `/rooms` in a 390px mobile viewport**

Use Browser with a 390px-wide viewport and open:

```text
http://localhost:3000/rooms
```

Expected:

- page loads without console errors;
- there is no horizontal scroll on the initial `/rooms` page.

- [ ] **Step 4: Create a room and verify the mobile lobby first viewport**

In the browser:

1. Enter a host nickname.
2. Keep or choose a 9-player board.
3. Create the room.

Expected:

- the joined-room lobby uses the mobile table-stage layout;
- room code, board/status, human count, and online count are visible;
- the current player seat is green/self-marked;
- empty seats are visible around the stage;
- invite, players, refresh, recovery, and host start actions are visible or reachable;
- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

- [ ] **Step 5: Verify seat changing**

In the browser:

1. Tap an empty seat.
2. Wait for the lobby to refresh.

Expected:

- tapped seat submits through the existing seat-change handler;
- self marker moves to the new seat;
- no desktop lobby grid appears on the phone viewport.

- [ ] **Step 6: Verify the player drawer**

In the browser:

1. Tap `玩家`.
2. Inspect the drawer.
3. Close the drawer.

Expected:

- drawer shows player name, seat number, online state, and host marker;
- host-only controls are visible for the host;
- drawer closes without leaving the page in a covered state.

- [ ] **Step 7: Start the game and verify handoff**

In the browser:

1. Tap `开始游戏`.
2. Wait for the room to enter the game.

Expected:

- existing mobile game table appears;
- the phone viewport does not fall back to the old desktop stacked layout.

- [ ] **Step 8: Fix verification bugs with TDD if needed**

If verification exposes a real bug, first add or update the smallest failing test that captures it, then patch the implementation.

For example, if 12-seat labels overflow, add this assertion to `src/components/rooms/mobileRoomLobby.test.ts`:

```typescript
  it("uses dense seat classes for 12-player mobile rooms", () => {
    const roomView = buildRoomView({
      room: {
        board: { seatCount: 12, name: "12 人标准警长局" },
        seats: [],
      } as Partial<RoomView["room"]> as RoomView["room"],
      playerSeatId: undefined,
    });
    const html = renderLobby({
      roomView,
      seatIds: Array.from({ length: 12 }, (_, index) => index + 1),
    });

    expect(html.match(/mobile-room-lobby-seat-dense/g) ?? []).toHaveLength(12);
  });
```

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobby.test.ts
```

Expected: FAIL before the fix, PASS after the fix.

- [ ] **Step 9: Final verification commands**

Run:

```powershell
npm run test -- src/components/rooms/mobileRoomLobbyModel.test.ts src/components/rooms/mobileRoomLobby.test.ts src/app/api/rooms/api.test.ts
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all commands pass, with only known pre-existing warnings recorded if present.

- [ ] **Step 10: Final commit**

If Task 5 required fixes, commit only those fixes:

```powershell
git add src/components/rooms src/components/RoomClient.tsx src/app/globals.css
git commit -m "fix: polish mobile room lobby verification"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Phone-first `/rooms` lobby after create/join: Tasks 2-4 implement and wire `MobileRoomLobby`.
- Room status, seat selection, player presence, invite/recovery/start controls: Task 2 component and Task 3 RoomClient wiring cover all handlers.
- Focused tests: Tasks 1-4 add model and static-render tests.
- Mobile-only CSS: Task 4 adds styles under the existing phone media block.
- Desktop preservation: Task 3 hides the old lobby only below `sm`, preserving the desktop markup for larger breakpoints.
- No API/rules/storage changes: file structure and task scopes exclude server, API, game, and AI directories.
- Browser verification: Task 5 covers create room, seat change, drawer, and started-game handoff at 390px.

Placeholder scan:

- No placeholder tokens or undefined task references remain.
- Each code-changing step includes the exact code or CSS to add.

Type consistency:

- `MobileRoomLobbyPending` mirrors the current `RoomClient.tsx` `PendingKind`.
- `MobileRoomLobby` props match the handlers available in `RoomClient`.
- `RoomView`, `RoomPlayerView`, and `RoomSeatView` are imported from `@/server/roomService`, matching the existing room client types.

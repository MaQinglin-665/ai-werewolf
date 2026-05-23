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
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);
  const board = roomView.room.board;
  const visibleSeatIds = seatIds.length > 0 ? seatIds : buildMobileRoomLobbySeatIds(board.seatCount);
  const dockCopy = getMobileRoomLobbyDockCopy({ isHost, roomView });
  const humanCount = roomView.room.seats.filter((seat) => seat.controller === "human").length;
  const playerCount = roomView.room.players.length;
  const onlineCount = roomView.room.players.filter((player) => player.online).length;
  const disabled = pending !== null;
  const drawerControlDisabled = disabled || !playerDrawerOpen;
  const drawerControlTabIndex = playerDrawerOpen ? undefined : -1;

  return (
    <section className="mobile-room-lobby sm:hidden" aria-label="手机选座大厅">
      <header className="mobile-room-lobby-header">
        <div className="mobile-room-lobby-header-copy">
          <div className="mobile-room-lobby-room-code mobile-room-lobby-code">房间 {roomView.room.code}</div>
          <div className="mobile-room-lobby-board-title">{board.name} · 大厅</div>
          <div className="mobile-room-lobby-header-counts" aria-label="房间人数">
            <span>真人 {humanCount} / {board.seatCount}</span>
            <span>在线 {onlineCount} / {playerCount}</span>
          </div>
        </div>
        {shareOrigin ? <div className="mobile-room-lobby-share-origin">手机链接将使用：{shareOrigin}</div> : null}
        <button className="mobile-room-lobby-invite-button" disabled={disabled} onClick={onCopyInviteLink} type="button">
          复制邀请
        </button>
      </header>

      <div className="mobile-room-lobby-stage" aria-label="选座牌桌">
        <div className="mobile-room-lobby-moon" aria-hidden="true" />
        <div className="mobile-room-lobby-table-glow" aria-hidden="true" />
        <div className="mobile-room-lobby-seat-ring">
          {visibleSeatIds.map((seatId, index) => {
            const seatState = getMobileRoomLobbySeatState({ pending, roomView, seatId });
            return (
              <button
                aria-label={getSeatAriaLabel(seatState)}
                className={joinClassNames(
                  "mobile-room-lobby-seat",
                  getMobileRoomLobbySeatDensityClass(board.seatCount),
                  seatState.isSelf && "mobile-room-lobby-seat-self",
                  seatState.isHostSeat && "mobile-room-lobby-seat-host",
                  seatState.isOffline && "mobile-room-lobby-seat-offline",
                  seatState.isOpen && "mobile-room-lobby-seat-open",
                  seatState.isAi && "mobile-room-lobby-seat-ai",
                  !seatState.isOpen && "mobile-room-lobby-seat-occupied",
                  pending === "seat" && seatState.isOpen && "mobile-room-lobby-seat-pending",
                )}
                disabled={!seatState.canSelect}
                key={seatId}
                onClick={() => onSeatChange(seatId)}
                style={getMobileRoomLobbySeatStyle(index, board.seatCount)}
                type="button"
              >
                <span className="mobile-room-lobby-seat-core">
                  <span className="mobile-room-lobby-seat-number">{seatId}</span>
                  <span className="mobile-room-lobby-seat-name">{seatState.label}</span>
                  <span className="mobile-room-lobby-seat-status">{seatState.statusLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mobile-room-lobby-center-seal" aria-label="大厅入座状态">
          <span>WAITING ROOM</span>
          <strong>{humanCount} / {board.seatCount}</strong>
          <span>已入座</span>
        </div>
      </div>

      <div className="mobile-room-lobby-dock">
        <div className="mobile-room-lobby-dock-copy mobile-room-lobby-dock-status">
          <strong>{dockCopy.primary}</strong>
          <span>{pending === "seat" ? "换座中..." : dockCopy.secondary}</span>
        </div>
        <div className="mobile-room-lobby-dock-actions">
          <button className="mobile-room-lobby-players-button" onClick={() => setPlayerDrawerOpen(true)} type="button">
            玩家
          </button>
          <button className="mobile-room-lobby-refresh-button" disabled={disabled} onClick={onRefresh} type="button">
            刷新
          </button>
          <button className="mobile-room-lobby-recovery-button" disabled={disabled} onClick={onCopyRecoveryLink} type="button">
            恢复
          </button>
        </div>
        {isHost ? (
          <button className="mobile-room-lobby-start-button" disabled={disabled} onClick={onStart} type="button">
            {pending === "start" ? "开局中..." : dockCopy.primaryAction}
          </button>
        ) : (
          <div className="mobile-room-lobby-waiting-action">{dockCopy.primaryAction}</div>
        )}
        {roomView.playerSeatId ? (
          <button
            className="mobile-room-lobby-leave-seat-button"
            disabled={disabled}
            onClick={() => onSeatChange(null)}
            type="button"
          >
            离开座位
          </button>
        ) : null}
      </div>

      <div className={joinClassNames("mobile-room-lobby-player-drawer", playerDrawerOpen && "mobile-room-lobby-player-drawer-open")}>
        <button
          aria-label="关闭玩家列表"
          className="mobile-room-lobby-player-backdrop"
          disabled={!playerDrawerOpen}
          onClick={() => setPlayerDrawerOpen(false)}
          tabIndex={drawerControlTabIndex}
          type="button"
        />
        <section aria-label="房间玩家列表" aria-hidden={!playerDrawerOpen}>
          <div className="mobile-room-lobby-player-head">
            <h2>房间玩家列表</h2>
            <button
              aria-label="关闭玩家列表"
              disabled={drawerControlDisabled}
              onClick={() => setPlayerDrawerOpen(false)}
              tabIndex={drawerControlTabIndex}
              type="button"
            >
              收起
            </button>
          </div>
          <div className="mobile-room-lobby-player-list">
            {roomView.room.players.map((player) => (
              <div className="mobile-room-lobby-player-row" key={player.playerId}>
                <div className="mobile-room-lobby-player-main">
                  <span className="mobile-room-lobby-player-name">{player.name}</span>
                  {player.isHost ? <span className="mobile-room-lobby-host-pill">房主</span> : null}
                </div>
                <div className="mobile-room-lobby-player-meta">
                  <span>{player.seatId ? `${player.seatId} 号位` : "未入座"}</span>
                  <span className={player.online ? "mobile-room-lobby-player-online" : "mobile-room-lobby-player-offline"}>
                    {player.online ? "在线" : "离线"}
                  </span>
                </div>
                {isHost ? (
                  <div className="mobile-room-lobby-player-actions">
                    <button
                      disabled={drawerControlDisabled}
                      onClick={() => onCopyPlayerRecoveryLink(player)}
                      tabIndex={drawerControlTabIndex}
                      type="button"
                    >
                      复制恢复
                    </button>
                    {player.playerId !== roomView.playerId ? (
                      <button
                        disabled={drawerControlDisabled}
                        onClick={() => onRemovePlayer(player.playerId)}
                        tabIndex={drawerControlTabIndex}
                        type="button"
                      >
                        {pending === "remove" ? "移除中" : "移除"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function getSeatAriaLabel(seatState: ReturnType<typeof getMobileRoomLobbySeatState>): string {
  if (seatState.isOpen) return seatState.ariaLabel;

  const parts = [`${seatState.seatId} 号 玩家 ${seatState.label}`];
  if (seatState.isHostSeat) parts.push("房主");
  parts.push(seatState.isOffline ? "离线" : "在线");
  if (seatState.isSelf) parts.push("当前玩家");
  return parts.join(" ");
}

function joinClassNames(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type * as React from "react";
import { getBoardPreset } from "@/game/boards";
import { DEATH_LABELS } from "@/game/labels";
import type { AvailableHumanAction, HumanGameView, Role } from "@/game/types";
import type {
  AiSpeechAudioStatus,
  AiLineupPreviewItem,
  BoardOption,
  HumanSeatMode,
  LiveAiSpeech,
  SeatVoiceActivity,
  SeatVoiceState,
} from "./clientTypes";
import {
  MODEL_CARD_IMAGES,
  ROLE_CARD_ASPECT_RATIOS,
  ROLE_CARD_BOOK_IMAGES,
  ROLE_CARD_IMAGES,
  getSeatCardImage,
  getSeatOrbitStyle,
} from "./viewHelpers";
import type { SeatOrbitStyle } from "./viewHelpers";
import { StatusPill } from "./PanelPrimitives";
import { SpeechFeed } from "./TablePanels";
export { ActionPanel } from "./ActionPanel";
export { ReviewPanel } from "./ReviewPanel";
export { AuxiliaryInfoPanel, VoteTable } from "./TablePanels";
export { FlowStatusBar, HostStage, PhaseCurtain, PhaseRhythm, getPhaseCurtainCue } from "./HostStage";
export type { PhaseCurtainCue } from "./HostStage";

export function RoomHeader({
  game,
  loading,
  aiSpeechAudioEnabled,
  aiSpeechAudioUnavailable,
  hostAudioEnabled,
  onNewGame,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView | null;
  loading: boolean;
  aiSpeechAudioEnabled: boolean;
  aiSpeechAudioUnavailable: boolean;
  hostAudioEnabled: boolean;
  onNewGame: () => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  const gameMeta = game
    ? game.humanSeatId === null
      ? `${game.board.name} · 观战模式 · AI ${game.setup?.aiFriends.length ?? game.seats.filter((seat) => seat.isAi).length}位`
      : `${game.board.name} · ${game.humanSeatId}号位 · 你是${game.myRoleLabel ?? "未知身份"} · AI ${game.setup?.aiFriends.length ?? game.seats.filter((seat) => seat.isAi).length}位`
    : "选择板子后可指定真人座位或观战 AI 对局";

  return (
    <header className="mobile-home-header flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f1c76e]/25 bg-[#130d0b]/75 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="mobile-home-logo grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#f1c76e]/45 bg-[#2a1712] text-lg font-semibold text-[#f1c76e] shadow-inner">
          狼
        </div>
        <div className="mobile-home-brand min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">单人 AI 狼人杀</h1>
          <p className="mt-1 text-xs text-[#cab995] sm:text-sm">
            {gameMeta}
          </p>
        </div>
      </div>

      <div className="mobile-home-header-actions flex flex-wrap items-center gap-2">
        {game && (
          <>
            <StatusPill tone="gold">第 {game.day} 天</StatusPill>
            <StatusPill tone={game.phase.startsWith("NIGHT") ? "blue" : "green"}>{game.phaseLabel}</StatusPill>
          </>
        )}
        <Link
          href="/rooms"
          className="mobile-home-quick-action rounded-full border border-[#77d898]/35 bg-[#12301f]/70 px-4 py-2 text-sm font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75"
        >
          <MobileHomeToolContent icon="房" label="联机" />
        </Link>
        <button
          type="button"
          onClick={onOpenIdentityBook}
          className="mobile-home-quick-action rounded-full border border-[#f1c76e]/25 bg-black/15 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
        >
          <MobileHomeToolContent icon="书" label="身份" />
        </button>
        <button
          type="button"
          onClick={onOpenGlossary}
          className="mobile-home-quick-action rounded-full border border-[#7da8e3]/25 bg-black/15 px-4 py-2 text-sm font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
        >
          <MobileHomeToolContent icon="?" label="术语" />
        </button>
        <button
          type="button"
          onClick={onToggleHostAudio}
          aria-pressed={hostAudioEnabled}
          className={[
            "mobile-home-quick-action mobile-home-audio-toggle rounded-full border px-4 py-2 text-sm font-semibold transition",
            hostAudioEnabled
              ? "border-[#77d898]/35 bg-[#14311f]/70 text-[#a8f0b6] hover:bg-[#1d4e33]/75"
              : "border-[#f1c76e]/25 bg-black/15 text-[#f1d796] hover:bg-[#f1c76e]/10",
          ].join(" ")}
        >
          <MobileHomeToolContent icon="音" label={hostAudioEnabled ? "主持开" : "主持关"} />
        </button>
        <button
          type="button"
          onClick={onToggleAiSpeechAudio}
          aria-pressed={aiSpeechAudioEnabled}
          className={[
            "mobile-home-quick-action mobile-home-audio-toggle rounded-full border px-4 py-2 text-sm font-semibold transition",
            aiSpeechAudioEnabled && !aiSpeechAudioUnavailable
              ? "border-[#77d898]/35 bg-[#14311f]/70 text-[#a8f0b6] hover:bg-[#1d4e33]/75"
              : aiSpeechAudioUnavailable
                ? "border-[#f1c76e]/30 bg-[#261510]/70 text-[#f1d796] hover:bg-[#322014]/80"
              : "border-[#f1c76e]/25 bg-black/15 text-[#f1d796] hover:bg-[#f1c76e]/10",
          ].join(" ")}
        >
          <MobileHomeToolContent icon="播" label={aiSpeechAudioUnavailable ? "转写" : aiSpeechAudioEnabled ? "AI开" : "AI关"} />
        </button>
        {game && (
          <button
            onClick={onNewGame}
            disabled={loading}
            className="mobile-home-quick-action mobile-home-header-start rounded-full bg-[#b74332] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#220806]/35 transition hover:bg-[#cf513d] disabled:opacity-60"
          >
            <MobileHomeToolContent icon="新" label="新局" />
          </button>
        )}
      </div>
    </header>
  );
}

function MobileHomeToolContent({ icon, label }: { icon: string; label: string }) {
  return (
    <>
      <span className="mobile-home-tool-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mobile-home-tool-label">{label}</span>
    </>
  );
}

export function LandingPanel({
  loading,
  boards,
  selectedBoardId,
  onSelectBoard,
  humanSeatMode,
  selectedHumanSeatId,
  onSelectRandomHumanSeat,
  onSelectFixedHumanSeat,
  onSelectNoHumanSeat,
  selectedAiFriendCount,
  customAiFriendCount,
  aiLineupPreview,
  recentGameIds,
  onLoadGame,
  onStartGame,
}: {
  loading: boolean;
  boards: BoardOption[];
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
  onSelectRandomHumanSeat: () => void;
  onSelectFixedHumanSeat: (seatId: number) => void;
  onSelectNoHumanSeat: () => void;
  selectedAiFriendCount: number;
  customAiFriendCount: number;
  aiLineupPreview: AiLineupPreviewItem[];
  recentGameIds: string[];
  onLoadGame: (gameId: string) => Promise<void>;
  onStartGame: () => Promise<void>;
}) {
  const selectedBoard = selectedBoardId ? boards.find((board) => board.id === selectedBoardId) : undefined;
  const humanModeLabel = !selectedBoard
    ? "待选板子"
    : humanSeatMode === "none"
      ? "纯 AI 观战"
      : selectedHumanSeatId
        ? `${selectedHumanSeatId}号真人`
        : "随机真人座位";
  const boardSummaryLabel = selectedBoard ? `${selectedBoard.name} · ${selectedBoard.seatCount}人` : "待选板子";
  const aiSummaryLabel = selectedAiFriendCount > 0 ? `${selectedAiFriendCount} 位 AI 入局` : "默认 AI 阵容";
  const lobbySeatIds = buildMobileLobbySeatIds(selectedBoard?.seatCount ?? 6);
  const lobbySeatDensityClass = getMobileLobbySeatDensityClass(lobbySeatIds.length);
  const lobbyLineupBySeatId = new Map(aiLineupPreview.map((friend) => [friend.seatId, friend]));

  return (
    <section className="mobile-home-shell flex flex-1 items-start justify-center py-4 lg:py-6">
      <div className="mobile-home-layout grid w-full max-w-[1240px] gap-4 xl:grid-cols-[minmax(0,1fr)_382px]">
        <div className="mobile-home-card overflow-hidden rounded-[28px] border border-[#f1c76e]/22 bg-[#120d0b]/86 shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="mobile-home-hero-grid grid lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="mobile-home-intro p-4 sm:p-5">
              <div className="mobile-home-title-row mb-5 flex flex-col gap-3 border-b border-[#f1c76e]/12 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f1c76e]/64">AI Werewolf Studio</div>
                  <h2 className="text-2xl font-semibold leading-tight text-[#f7ead5] sm:text-3xl">开一桌 AI 狼人杀</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cdbb9a]">
                    选择板子、真人座位和 AI 阵容，确认后直接进入牌桌。
                  </p>
                </div>
                <div className="mobile-home-status-bar flex flex-wrap gap-2 text-xs">
                  <StatusPill tone="gold">{selectedBoard ? `${selectedBoard.seatCount} 人局` : "未选板子"}</StatusPill>
                  <StatusPill tone={humanSeatMode === "none" ? "green" : "blue"}>{humanModeLabel}</StatusPill>
                </div>
              </div>

            </div>

            <LandingPromoCard boardLabel={boardSummaryLabel} humanLabel={humanModeLabel} aiLabel={aiSummaryLabel} />
          </div>

          <div className="mobile-lobby-stage" aria-label="手机端狼人杀房间大厅预览">
            <div className="mobile-lobby-moon" />
            <div className="mobile-lobby-table-glow" />
            <div className="mobile-lobby-seat-ring">
              {lobbySeatIds.map((seatId, index) => {
                const lineupSeat = lobbyLineupBySeatId.get(seatId);
                const isHumanSeat = lineupSeat?.isHuman ?? (humanSeatMode !== "none" && selectedHumanSeatId === seatId);
                const avatarImage = lineupSeat && !lineupSeat.isHuman ? getLineupAvatarImage(lineupSeat) : undefined;
                return (
                  <div
                    key={`${seatId}-${index}`}
                    aria-label={lineupSeat ? `${seatId}号 ${lineupSeat.nickname}` : `${seatId}号空位`}
                    className={[
                      "mobile-lobby-seat",
                      `mobile-lobby-seat-${index + 1}`,
                      lobbySeatDensityClass,
                      avatarImage ? "mobile-lobby-seat-with-avatar" : "",
                      isHumanSeat ? "mobile-lobby-seat-human" : "",
                    ].join(" ")}
                    style={getMobileLobbySeatStyle(index, lobbySeatIds.length)}
                  >
                    {avatarImage ? (
                      <span className="mobile-lobby-seat-avatar" aria-hidden="true" style={{ backgroundImage: `url(${avatarImage})` }} />
                    ) : (
                      <span className="mobile-lobby-seat-empty" aria-hidden="true" />
                    )}
                    <span className="mobile-lobby-seat-number">{seatId}</span>
                    {isHumanSeat && <em>你</em>}
                  </div>
                );
              })}
            </div>
            <div className="mobile-lobby-stage-core">
              <div className="mobile-lobby-orbit" />
              <div className="mobile-lobby-room-seal">
                <span>{selectedBoard?.seatCount ?? 6}</span>
              </div>
              <div className="mobile-lobby-primary-copy">
                <span>AI WEREWOLF ROOM</span>
                <strong>{selectedBoard ? `${selectedBoard.seatCount} 位入座` : "开一桌 AI 狼人杀"}</strong>
                <small>{humanModeLabel} · {aiSummaryLabel}</small>
              </div>
            </div>
          </div>

          <div className="mobile-home-dock px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="mobile-dock-grip" />
            <div className="mobile-dock-board-console">
              <div className="mobile-dock-board-copy min-w-0">
                <span>选择板子</span>
                <strong>{selectedBoard?.name ?? "待选板子"}</strong>
              </div>
              <Link
                href="/ai-pool"
                className="mobile-dock-ai-pool-action inline-flex shrink-0 items-center justify-center rounded-full border border-[#77d898]/28 bg-[#10271d] px-3 py-1.5 text-xs font-semibold text-[#a8f0b6] shadow-lg shadow-black/20 transition hover:bg-[#183b2a] sm:hidden"
              >
                AI阵容 {selectedAiFriendCount}位 ›
              </Link>
            </div>
            <div className="mobile-board-strip grid gap-3 md:grid-cols-2">
              {boards.map((board) => {
                const selected = selectedBoardId === board.id;
                return (
                  <button
                    key={board.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? `取消选择${board.name}` : `选择${board.name}`}
                    onClick={() => onSelectBoard(board.id)}
                    className={[
                      "mobile-board-chip group min-h-[148px] rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-[#f1c76e]/68 bg-[#2c2015]/88 shadow-lg shadow-black/24"
                        : "border-white/10 bg-black/20 hover:border-[#f1c76e]/40 hover:bg-[#1c1512]/84",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-[#f7ead5]">{board.name}</div>
                        <div className="mt-1 text-xs leading-5 text-[#dcc9a7]">{board.roleSummary}</div>
                      </div>
                      <span
                        className={[
                          "mobile-board-badge shrink-0 rounded-full border px-2 py-0.5 text-xs",
                          selected ? "border-[#f1c76e]/38 bg-[#f1c76e]/12 text-[#f1d796]" : "border-white/12 text-[#ad9c7d]",
                        ].join(" ")}
                      >
                        {selected ? "取消选择" : `${board.seatCount} 人`}
                      </span>
                    </div>
                    <div className="mt-3 border-t border-white/8 pt-3 text-xs leading-5 text-[#ad9c7d]">{board.description}</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-[#7da8e3]/18 bg-[#0d1623]/42 px-2 py-0.5 text-[10px] text-[#b8d6ff]">
                        {board.seatCount} 座
                      </span>
                      <span className="rounded-full border border-[#77d898]/18 bg-[#0f2118]/42 px-2 py-0.5 text-[10px] text-[#a8f0b6]">
                        AI 自动补位
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBoard && (
              <div className="mobile-seat-console">
                <HumanSeatPicker
                  seatCount={selectedBoard.seatCount}
                  mode={humanSeatMode}
                  selectedSeatId={selectedHumanSeatId}
                  onRandom={onSelectRandomHumanSeat}
                  onSelect={onSelectFixedHumanSeat}
                  onNone={onSelectNoHumanSeat}
                />
              </div>
            )}

            <div className="mobile-cta-console mobile-home-actions mt-4 flex flex-col gap-3 border-t border-[#f1c76e]/12 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs leading-5 text-[#ad9c7d]">
                {selectedBoard ? "当前配置会自动补齐 AI 阵容并保存最近对局入口。" : "先选择一个板子，再确认真人座位。"}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Link
                  href="/rooms"
                  className="mobile-home-secondary-action inline-flex min-h-11 items-center justify-center rounded-xl border border-[#77d898]/28 bg-[#10271d] px-6 py-3 text-sm font-semibold text-[#a8f0b6] shadow-lg shadow-black/20 transition hover:bg-[#183b2a]"
                >
                  进入联机房间
                </Link>
                <button
                  onClick={onStartGame}
                  disabled={loading || !selectedBoardId}
                  className="mobile-home-primary-action inline-flex min-h-11 items-center justify-center rounded-xl bg-[#c64f3c] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:bg-[#dc5b45] disabled:cursor-not-allowed disabled:bg-[#6f3b31] disabled:text-white/55"
                >
                  {loading ? "创建中" : selectedBoardId ? "进入牌桌" : "先选择板子"}
                </button>
              </div>
            </div>

            <RulesMiniCard />
          </div>
        </div>

        <div className="mobile-home-secondary-rail grid gap-4 xl:content-start">
          <AiPoolEntryCard selectedCount={selectedAiFriendCount} customCount={customAiFriendCount} />
          <AiLineupPreviewCard lineup={aiLineupPreview} />
          <RecentGamesCard loading={loading} recentGameIds={recentGameIds} onLoadGame={onLoadGame} />
        </div>
      </div>
    </section>
  );
}

type MobileLobbySeatStyle = React.CSSProperties & {
  "--lobby-seat-size": string;
  "--lobby-seat-x": string;
  "--lobby-seat-y": string;
};

type MobileLobbySeatPoint = {
  x: number;
  y: number;
  size: number;
};

const MOBILE_LOBBY_SEAT_POINTS: Record<number, MobileLobbySeatPoint[]> = {
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

function buildMobileLobbySeatIds(seatCount: number): number[] {
  const visibleCount = Math.max(1, Math.min(12, Math.floor(seatCount)));
  return Array.from({ length: visibleCount }, (_, index) => index + 1);
}

function getMobileLobbySeatDensityClass(seatCount: number): string {
  if (seatCount >= 10) return "mobile-lobby-seat-dense";
  if (seatCount >= 8) return "mobile-lobby-seat-many";
  return "";
}

function getMobileLobbySeatStyle(index: number, seatCount: number): MobileLobbySeatStyle {
  const presetPoint = MOBILE_LOBBY_SEAT_POINTS[seatCount]?.[index];
  if (presetPoint) {
    return {
      "--lobby-seat-size": `${presetPoint.size}px`,
      "--lobby-seat-x": `${presetPoint.x.toFixed(1)}%`,
      "--lobby-seat-y": `${presetPoint.y.toFixed(1)}%`,
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
    "--lobby-seat-size": `${size}px`,
    "--lobby-seat-x": `${x.toFixed(1)}%`,
    "--lobby-seat-y": `${y.toFixed(1)}%`,
  };
}

function LandingPromoCard({ boardLabel, humanLabel, aiLabel }: { boardLabel: string; humanLabel: string; aiLabel: string }) {
  return (
    <div className="mobile-home-promo relative min-h-[260px] overflow-hidden border-t border-[#f1c76e]/14 bg-[#0d1018] lg:min-h-full lg:border-l lg:border-t-0">
      <Image
        src="/images/promo-ai-werewolf-reference-personas.png"
        alt="AI 狼人杀宣传图"
        fill
        priority
        unoptimized
        sizes="(min-width: 1024px) 300px, 100vw"
        className="object-cover object-top opacity-[0.88]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#100b0a] via-[#100b0a]/28 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 grid gap-2 p-4">
        <div className="inline-flex w-fit rounded-full border border-[#f1c76e]/24 bg-black/42 px-3 py-1 text-[11px] font-semibold text-[#f1d796] backdrop-blur">
          多模型 AI 同桌博弈
        </div>
        <div className="grid gap-1.5 text-xs text-[#f7ead5]">
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">{boardLabel}</div>
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">{humanLabel}</div>
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">{aiLabel}</div>
        </div>
      </div>
    </div>
  );
}

function HumanSeatPicker({
  seatCount,
  mode,
  selectedSeatId,
  onRandom,
  onSelect,
  onNone,
}: {
  seatCount: number;
  mode: HumanSeatMode;
  selectedSeatId: number | null;
  onRandom: () => void;
  onSelect: (seatId: number) => void;
  onNone: () => void;
}) {
  if (seatCount <= 0) return null;
  const seats = Array.from({ length: seatCount }, (_, index) => index + 1);
  const seatLabel = mode === "none" ? "无真人" : selectedSeatId ? `${selectedSeatId}号` : "随机";
  return (
    <section className="mobile-seat-picker mt-4 rounded-lg border border-[#7da8e3]/18 bg-[#0d1623]/48 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#e4efff]">真人座位</h3>
        <span className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/10 px-2.5 py-1 text-xs text-[#b8d6ff]">
          {seatLabel}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRandom}
          className={[
            "mobile-seat-mode-button rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition",
            mode === "random" ? "border-[#7da8e3]/50 bg-[#0d2642]/78 text-[#d8e7ff]" : "border-[#7da8e3]/16 bg-black/18 text-[#b8d6ff] hover:bg-[#7da8e3]/10",
          ].join(" ")}
        >
          真人模式{selectedSeatId ? ` · 本局预览 ${selectedSeatId}号` : ""}
        </button>
        <button
          type="button"
          onClick={onNone}
          className={[
            "mobile-seat-mode-button rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition",
            mode === "none" ? "border-[#77d898]/50 bg-[#12301e]/78 text-[#dff4df]" : "border-[#77d898]/16 bg-black/18 text-[#a8f0b6] hover:bg-[#77d898]/10",
          ].join(" ")}
        >
          无真人 · 只看 AI 对局
        </button>
        <div className="mobile-seat-strip grid grid-cols-6 gap-1.5 sm:col-span-2 md:grid-cols-9">
          {seats.map((seatId) => {
            const selected = mode === "fixed" && selectedSeatId === seatId;
            return (
              <button
                key={seatId}
                type="button"
                onClick={() => onSelect(seatId)}
                className={[
                  "mobile-seat-chip-option min-h-10 rounded-md border px-2 py-2 text-sm font-semibold transition",
                  selected ? "border-[#f1c76e]/58 bg-[#3a2412]/88 text-[#f1d796]" : "border-white/10 bg-black/18 text-[#dcc9a7] hover:bg-white/8",
                ].join(" ")}
              >
                {seatId}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function getLineupAvatarImage(friend: AiLineupPreviewItem): string | undefined {
  return friend.avatarDataUrl ?? (friend.personaName ? MODEL_CARD_IMAGES[friend.personaName] : undefined);
}

function CustomAvatarCardArt({ src }: { src: string }) {
  return (
    <>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(119,216,152,0.22),transparent_56%),linear-gradient(145deg,#0b2d20,#16442f_52%,#070d0a)]" />
      <span className="absolute inset-[10%] rounded-md border border-[#77d898]/22" />
      <span
        className="absolute rounded-md border border-white/12 bg-cover bg-center shadow-inner shadow-black/40"
        style={{ inset: "18% 16%", backgroundImage: `url(${src})` }}
      />
    </>
  );
}

function AiLineupPreviewCard({ lineup }: { lineup: AiLineupPreviewItem[] }) {
  const autoFillCount = lineup.filter((friend) => friend.autoFilled).length;
  const hasHumanSeat = lineup.some((friend) => friend.isHuman);
  return (
    <section className="rounded-xl border border-[#77d898]/20 bg-[#0d1b14]/84 p-4 shadow-xl shadow-black/24 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#dff4df]">座位预览</h2>
        <span className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2.5 py-1 text-xs text-[#a8f0b6]">
          {lineup.length} 人
        </span>
      </div>
      <div className="soft-scrollbar max-h-[340px] space-y-2 overflow-auto pr-1">
        {lineup.map((friend) => {
          const avatarImage = getLineupAvatarImage(friend);
          return (
            <div
              key={`${friend.seatId}-${friend.nickname}`}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                friend.isHuman ? "border-[#f1c76e]/30 bg-[#342414]/70" : "border-[#77d898]/14 bg-black/20",
              ].join(" ")}
            >
              <span
                className={[
                  "relative grid shrink-0 place-items-center overflow-hidden border bg-cover bg-center text-xs font-semibold",
                  friend.isHuman
                    ? "h-9 w-9 rounded-xl border-[#f1c76e]/24 bg-[#c64f3c] text-white"
                    : friend.avatarDataUrl
                      ? "h-10 w-7 rounded-lg border-[#77d898]/30 bg-[#0d2118]"
                      : "h-10 w-7 rounded-lg border-[#7da8e3]/24 bg-[#0d1623] text-[#a8f0b6]",
                ].join(" ")}
                style={
                  !friend.isHuman && avatarImage && !friend.avatarDataUrl
                    ? {
                        backgroundImage: `url(${avatarImage})`,
                      }
                    : undefined
                }
              >
                {friend.isHuman || !avatarImage ? friend.seatId : null}
                {!friend.isHuman && friend.avatarDataUrl && avatarImage && <CustomAvatarCardArt src={avatarImage} />}
                {!friend.isHuman && avatarImage && (
                  <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/72 px-1 text-[9px] text-[#f7ead5]">{friend.seatId}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-[#f7ead5]">{friend.nickname}</span>
                  {friend.personaName && (
                    <span className="rounded-full border border-[#f1c76e]/18 px-2 py-0.5 text-[10px] text-[#f1d796]">{friend.personaName}</span>
                  )}
                </div>
                {friend.modelLabel && <div className="mt-0.5 truncate text-[11px] text-[#9fc8a7]">{friend.modelLabel}</div>}
                {friend.ttsVoice && <div className="mt-0.5 truncate text-[11px] text-[#b8d6ff]">TTS {friend.ttsVoice}</div>}
              </div>
              <span
                className={[
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                  friend.autoFilled ? "border-[#7da8e3]/20 bg-[#0d1623]/55 text-[#b8d6ff]" : "border-[#77d898]/18 bg-[#77d898]/8 text-[#a8f0b6]",
                ].join(" ")}
              >
                {friend.isHuman ? "真人" : friend.autoFilled ? "补齐" : "已选"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#9fc8a7]">
        {hasHumanSeat ? "AI 按队列填入非真人座位" : "AI 会填满所有座位"}
        ；选择不足时自动补齐{autoFillCount > 0 ? ` ${autoFillCount} 位` : ""}。
      </p>
    </section>
  );
}

function AiPoolEntryCard({ selectedCount, customCount }: { selectedCount: number; customCount: number }) {
  return (
    <section className="rounded-xl border border-[#7da8e3]/22 bg-[#0c1420]/86 p-4 shadow-xl shadow-black/24 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#e4efff]">AI池</h2>
        <span className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/10 px-2.5 py-1 text-xs text-[#b8d6ff]">
          {selectedCount} 入局 · {customCount} 自定义AI
        </span>
      </div>
      <div className="rounded-lg border border-[#7da8e3]/14 bg-black/20 px-3 py-3 text-xs leading-5 text-[#d8e7ff]">
        管理可入局的 AI、复制内置模型、编辑自定义AI，并导入或导出配置。12 人局不足 11 位 AI 时会循环默认 AI 自动补齐。
      </div>
      <Link
        href="/ai-pool"
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#7da8e3]/25 bg-[#101f32]/70 px-4 py-2 text-sm font-semibold text-[#cfe4ff] transition hover:bg-[#17304e]"
      >
        打开 AI池
      </Link>
    </section>
  );
}

function RulesMiniCard() {
  const rules = [
    "9人局保留原基础流程。",
    "12人局加入守卫、警长竞选和警徽。",
    "白天顺序发言，放逐投票可弃票。",
    "只有终局复盘显示真实身份。",
  ];

  return (
    <section className="mobile-home-rules mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#dff4df]">流程提示</h3>
        <span className="text-xs text-[#86c797]">本地规则引擎</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rules.map((rule) => (
          <div key={rule} className="rounded-lg border border-[#77d898]/12 bg-[#0c1812]/70 px-3 py-2 text-xs leading-5 text-[#cdebd2]">
            {rule}
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentGamesCard({
  loading,
  recentGameIds,
  onLoadGame,
}: {
  loading: boolean;
  recentGameIds: string[];
  onLoadGame: (gameId: string) => Promise<void>;
}) {
  return (
    <section className="rounded-xl border border-[#f1c76e]/20 bg-[#140d0b]/84 p-4 shadow-xl shadow-black/24 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#f7ead5]">最近对局</h2>
        <span className="text-xs text-[#ad9c7d]">最多 5 局</span>
      </div>
      {recentGameIds.length === 0 ? (
        <div className="grid min-h-[118px] place-items-center rounded-lg border border-dashed border-[#f1c76e]/20 bg-black/14 text-center text-sm leading-6 text-[#ad9c7d]">
          暂无本地记录
        </div>
      ) : (
        <div className="grid gap-2">
          {recentGameIds.map((gameId, index) => (
            <button
              key={gameId}
              onClick={() => onLoadGame(gameId)}
              disabled={loading}
              className="rounded-lg border border-[#f1c76e]/18 bg-[#211410]/72 px-3 py-2.5 text-left transition hover:border-[#f1c76e]/42 hover:bg-[#2b1a13] disabled:opacity-60"
            >
              <div className="text-sm font-semibold text-[#f7ead5]">{index === 0 ? "继续上一局" : "查看最近终局"}</div>
              <div className="mt-1 text-xs text-[#ad9c7d]">{gameId.slice(0, 8)}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type RoleCamp = "好人阵营" | "狼人阵营";

type RoleIntro = {
  title: string;
  camp: RoleCamp;
  goal: string;
  timing: string;
  ability: string;
  limits: string;
  tip: string;
};

type IdentityBookFilter = "all" | "good" | "werewolves";

type RolePhaseHint = {
  title: string;
  detail: string;
  tone: "gold" | "green" | "blue" | "red";
};

type RoleLinkTip = {
  title: string;
  detail: string;
  relatedRoles?: Role[];
  keywords?: string[];
};

type GlossaryEntry = {
  term: string;
  alias?: string;
  meaning: string;
  tableUse: string;
  example: string;
  tone: "gold" | "green" | "blue" | "red";
};

type GlossarySection = {
  title: string;
  description: string;
  entries: GlossaryEntry[];
};

const IDENTITY_BOOK_ROLE_ORDER: Role[] = [
  "VILLAGER",
  "SEER",
  "WITCH",
  "HUNTER",
  "IDIOT",
  "GUARD",
  "KNIGHT",
  "WEREWOLF",
  "WOLF_KING",
  "WHITE_WOLF_KING",
  "WOLF_BEAUTY",
];

const IDENTITY_BOOK_FILTERS: { id: IdentityBookFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "good", label: "好人" },
  { id: "werewolves", label: "狼人" },
];

const GLOSSARY_SECTIONS: GlossarySection[] = [
  {
    title: "身份和信息",
    description: "围绕身份声明、查验和夜间信息的常见说法。",
    entries: [
      {
        term: "跳身份",
        alias: "拍身份",
        meaning: "公开声称自己是某个角色，例如预言家、女巫、猎人或守卫。",
        tableUse: "跳身份可以争取信任，也会暴露给狼人；AI 说“拍身份”通常是在要求某人明确身份。",
        example: "“你如果是猎人就拍清楚，不要只给模糊站边。”",
        tone: "gold",
      },
      {
        term: "悍跳",
        meaning: "狼人或假身份玩家强行跳重要神牌，最常见是悍跳预言家。",
        tableUse: "听到“悍跳狼”时，意思是发言者认为这个人不是他声称的身份，而是在抢身份线。",
        example: "“2号像悍跳，警徽流和查验理由都太硬凑。”",
        tone: "red",
      },
      {
        term: "对跳",
        meaning: "两个或更多玩家声称同一个身份，形成身份冲突。",
        tableUse: "对跳不等于必有狼人，但通常会成为当天讨论和投票焦点。",
        example: "“3号和7号对跳预言家，今天先听两边查验逻辑。”",
        tone: "blue",
      },
      {
        term: "金水",
        meaning: "预言家查验结果为好人的玩家。",
        tableUse: "真预言家的金水可信度高；假预言家也可能发假金水拉票。",
        example: "“5号是我昨晚验出的金水，先不要进狼坑。”",
        tone: "green",
      },
      {
        term: "查杀",
        meaning: "预言家查验结果为狼人的玩家。",
        tableUse: "查杀会强烈推动放逐，但要先判断报查杀的人是否可信。",
        example: "“我查杀8号，今天优先出8。”",
        tone: "red",
      },
      {
        term: "银水",
        meaning: "女巫使用解药救过的人，通常来自夜间刀口信息。",
        tableUse: "银水不等于铁好人；狼人也可能自刀制造身份。",
        example: "“4号是首夜银水，但不能因为银水就完全放下。”",
        tone: "green",
      },
      {
        term: "刀口",
        meaning: "狼人夜里选择击杀的目标。",
        tableUse: "刀口常被用来推断狼人怕谁、想污谁，或者女巫的救人信息。",
        example: "“昨晚刀口落在预言家边上，狼队可能在控轮次。”",
        tone: "red",
      },
      {
        term: "同守同救",
        meaning: "守卫守护和女巫解药同时落在同一名玩家身上。",
        tableUse: "本项目规则里同守同救会产生风险，所以守卫和女巫需要隐藏节奏、避免撞保护。",
        example: "“女巫如果救过，守卫今晚别盲守同一个位置。”",
        tone: "blue",
      },
      {
        term: "铁好人",
        alias: "铁好",
        meaning: "可信度极高、暂时几乎不进狼坑的好人位置。",
        tableUse: "铁好人通常来自强查验、强技能信息或极高质量发言，但仍可能被狼人伪造身份。",
        example: "“7号这轮可以先当铁好人用，归票权给他没问题。”",
        tone: "green",
      },
      {
        term: "明神",
        meaning: "身份已经公开或基本坐实的神职玩家。",
        tableUse: "明神会成为狼人夜间优先处理的目标，也常承担白天归票责任。",
        example: "“女巫已经明神了，今晚守卫要考虑保护节奏。”",
        tone: "green",
      },
      {
        term: "穿衣服",
        meaning: "不是某个身份，却用发言表现得像那个身份。",
        tableUse: "好人可能穿神衣挡刀，狼人也可能穿神衣抢身份；关键看动机和信息来源。",
        example: "“4号一直穿猎人衣服，但没交出猎人应有的视角。”",
        tone: "gold",
      },
      {
        term: "脱衣服",
        meaning: "撤回自己暗示过的身份，说明自己并不是那个角色。",
        tableUse: "脱衣服可能是好人解除误会，也可能是狼人压力下改口。",
        example: "“你上一轮像穿女巫衣服，这轮又脱衣服，解释一下动机。”",
        tone: "gold",
      },
      {
        term: "盲毒",
        meaning: "女巫在信息不足时使用毒药。",
        tableUse: "盲毒收益高但风险大；毒错好人会明显压缩好人轮次。",
        example: "“现在没有强查杀，女巫别盲毒焦点外的人。”",
        tone: "red",
      },
      {
        term: "空守",
        meaning: "守卫夜里选择不守护任何玩家。",
        tableUse: "空守可以避免同守同救或连续守护限制，但会放弃一晚保护机会。",
        example: "“昨晚女巫可能会救，守卫空守一晚也能接受。”",
        tone: "blue",
      },
    ],
  },
  {
    title: "发言和站边",
    description: "用来描述发言质量、逻辑选择和身份判断的桌面黑话。",
    entries: [
      {
        term: "站边",
        meaning: "选择相信某一条身份线或某个玩家的逻辑。",
        tableUse: "AI 说“站边谁”，是在问你当前更信哪一边，不是要求永久锁死。",
        example: "“我暂时站边7号预言家，但要看明天警徽流。”",
        tone: "blue",
      },
      {
        term: "狼坑",
        meaning: "当前最像狼的一组嫌疑位置。",
        tableUse: "狼坑是推理集合，会随着发言、投票、死亡信息变化。",
        example: "“我的狼坑先放2、6、9，里面至少开两狼。”",
        tone: "red",
      },
      {
        term: "抿身份",
        meaning: "通过语气、视角、发言习惯推测别人可能是什么身份。",
        tableUse: "抿身份不是硬证据，更多是辅助判断。",
        example: "“1号一直躲女巫视角，我感觉他在抿神位。”",
        tone: "gold",
      },
      {
        term: "爆点",
        meaning: "发言或行为里明显不自然、前后矛盾的地方。",
        tableUse: "AI 说“爆点”时，通常是在抓某句话为什么不像好人视角。",
        example: "“你先说不信3号，后面又跟3号归票，这里是爆点。”",
        tone: "red",
      },
      {
        term: "视角",
        meaning: "一个玩家根据自己身份和已知信息自然应该看到的局面。",
        tableUse: "视角不对常被认为有狼面，因为狼人知道更多隐藏信息。",
        example: "“你不是女巫，却一直默认昨晚救人成功，这个视角很奇怪。”",
        tone: "blue",
      },
      {
        term: "划水",
        meaning: "发言很空、不给判断、不承担投票责任。",
        tableUse: "划水玩家不一定是狼，但容易被抗推或成为狼队藏身位。",
        example: "“6号两轮都在划水，今天必须交站边。”",
        tone: "gold",
      },
      {
        term: "抗推",
        meaning: "好人因为信息少、发言弱或被污，被推上放逐位。",
        tableUse: "听到“抗推位”时，意思是这个人可能只是容易被推出去，不一定真狼。",
        example: "“别急着出9号，他像抗推好人，不像核心狼。”",
        tone: "green",
      },
      {
        term: "做好",
        meaning: "某人的行为或信息让他更像好人。",
        tableUse: "做好是相对判断，不等于身份完全坐实。",
        example: "“4号敢先点狼坑，这轮发言我给他做好。”",
        tone: "green",
      },
      {
        term: "聊爆",
        meaning: "发言中出现严重视角错误或逻辑漏洞，暴露出狼人可能性。",
        tableUse: "聊爆通常比普通爆点更重，可能直接推动当天放逐。",
        example: "“你说知道女巫没救人，这不是闭眼好人视角，已经聊爆了。”",
        tone: "red",
      },
      {
        term: "身份面",
        meaning: "从身份关系和技能信息看，一个玩家像好人还是狼人。",
        tableUse: "身份面通常和发言面、票型面一起判断。",
        example: "“5号发言一般，但身份面被2号查验做高了。”",
        tone: "gold",
      },
    ],
  },
  {
    title: "投票和轮次",
    description: "白天放逐、警长局和团队投票里常出现的说法。",
    entries: [
      {
        term: "归票",
        meaning: "明确号召大家把票集中投给某个目标。",
        tableUse: "归票能避免分票，但坏人也会用归票带节奏。",
        example: "“今天我归票8号，理由是查杀和发言爆点重合。”",
        tone: "gold",
      },
      {
        term: "冲票",
        meaning: "一组玩家快速或集中投向同一目标，像是有组织地出人。",
        tableUse: "冲票可能暴露狼队协同，也可能只是好人统一判断。",
        example: "“最后三票同时冲到5号，票型要重点复盘。”",
        tone: "red",
      },
      {
        term: "分票",
        meaning: "票散在多个目标上，导致真正想出的人未必能出局。",
        tableUse: "好人分票容易被狼队利用，所以关键轮次需要明确归票。",
        example: "“别分票，2号和8号只能先出一个。”",
        tone: "blue",
      },
      {
        term: "轮次",
        meaning: "双方还剩几次白天放逐或夜晚击杀机会的节奏。",
        tableUse: "轮次紧张时，投错一个好人可能直接让狼人获胜。",
        example: "“现在轮次不够，不能再出疑似平民抗推位。”",
        tone: "red",
      },
      {
        term: "绑票",
        meaning: "狼人票数接近或达到控制白天投票结果的状态。",
        tableUse: "接近绑票时，好人需要更重视统一票型和神牌信息。",
        example: "“如果场上三狼还在，今天分票就可能被绑票。”",
        tone: "red",
      },
      {
        term: "警上",
        meaning: "参与警长竞选的玩家。",
        tableUse: "12 人警长局里，警上发言会影响警徽归属和预言家可信度。",
        example: "“警上只有两个预言家对跳，警下票很关键。”",
        tone: "blue",
      },
      {
        term: "警徽流",
        meaning: "预言家提前说明接下来想查验谁，常用于死后留下信息。",
        tableUse: "警徽流清晰能提高可信度；乱给警徽流会被认为编造视角。",
        example: "“我的警徽流先验6再验10，如果我倒牌按这个看。”",
        tone: "gold",
      },
      {
        term: "退水",
        meaning: "警长竞选中撤回参选。",
        tableUse: "退水可能是好人让票，也可能是假跳玩家规避压力。",
        example: "“3号悍跳后退水，不能直接放下。”",
        tone: "gold",
      },
      {
        term: "票型",
        meaning: "一轮投票中每个人投给谁形成的结构。",
        tableUse: "票型是复盘狼队位置的重要证据，尤其看谁跟票、改票、分票、救人或制造平票。",
        example: "“昨天票型里，6号最后一票救了8号，关系很重。”",
        tone: "blue",
      },
      {
        term: "PK 台",
        meaning: "平票或警长竞选后进入再次发言、再次投票的候选席。",
        tableUse: "PK 台上的发言压力更大，也更容易暴露视角问题。",
        example: "“现在2号和8号上 PK 台，警下玩家必须说明票给谁。”",
        tone: "blue",
      },
      {
        term: "出人",
        meaning: "白天通过投票放逐某个玩家。",
        tableUse: "说“今天出谁”就是讨论本轮放逐目标。",
        example: "“今天不能散，必须在3和7里面出一个。”",
        tone: "red",
      },
    ],
  },
  {
    title: "狼人策略",
    description: "判断狼人行为和团队配合时常用的词。",
    entries: [
      {
        term: "倒钩",
        meaning: "狼人故意站边真预言家或攻击狼队友，以换取好人信任。",
        tableUse: "倒钩狼看起来可能很像好人；主动打狼队友也可能是在打倒钩，需要结合票型和关键轮次判断。",
        example: "“1号一直踩狼队友，可能是深水倒钩。”",
        tone: "red",
      },
      {
        term: "垫飞",
        meaning: "狼人用很差的支持方式去帮某条身份线，反而让那条线显得更假。",
        tableUse: "有人说“被垫飞”，意思是这个人可能被坏人故意拉低可信度。",
        example: "“6号发言太像垫飞7号，不能只因为6站7就打死7。”",
        tone: "red",
      },
      {
        term: "深水狼",
        meaning: "隐藏很深、长期不在焦点里的狼人。",
        tableUse: "局面后期如果焦点位都不像狼，就要回头找深水位置。",
        example: "“前排打得太热，真正的深水狼可能在10号。”",
        tone: "red",
      },
      {
        term: "自刀",
        meaning: "狼人夜里选择击杀狼队友，制造身份或骗取女巫解药。",
        tableUse: "自刀不是每局都会发生，但银水和刀口异常时会被讨论。",
        example: "“首夜银水也可能是自刀，别把他当铁好人。”",
        tone: "red",
      },
      {
        term: "卖队友",
        meaning: "狼人主动攻击或投出狼队友，换取自己的长期生存空间。",
        tableUse: "卖队友和真好人找狼很像，要看他是否在关键轮次真的承担票。",
        example: "“4号踩8号很早，但最后没投8，卖队友力度不够。”",
        tone: "red",
      },
      {
        term: "冲锋狼",
        meaning: "发言和投票都很主动地帮助狼队推进目标的狼人。",
        tableUse: "冲锋狼通常站队明显、攻击性强，但也可能伪装成强势好人。",
        example: "“6号一直帮悍跳位冲票，像冲锋狼。”",
        tone: "red",
      },
      {
        term: "狼队视角",
        meaning: "发言里不自然地知道狼人阵营才该知道的信息。",
        tableUse: "狼队视角是高危爆点，因为好人通常只能从公开信息推理。",
        example: "“你默认昨晚刀口是狼队控出来的，这像狼队视角。”",
        tone: "red",
      },
      {
        term: "做身份",
        meaning: "通过投票、攻击队友或制造行为来让自己显得像好人。",
        tableUse: "做身份不一定说明行为为真，要结合收益判断是不是狼人的表演。",
        example: "“他早踩狼队友可能是在做身份，别直接放成铁好。”",
        tone: "red",
      },
    ],
  },
];

const ROLE_INTROS: Record<Role, RoleIntro> = {
  WEREWOLF: {
    title: "狼人",
    camp: "狼人阵营",
    goal: "让所有平民出局，或让所有神职出局。",
    timing: "夜间狼队行动时刀人；白天发言和投票时伪装好人。",
    ability: "每晚与狼队选择一名玩家作为刀口，白天通过发言、站边和投票制造好人焦点。",
    limits: "狼人知道队友，但白天只能用公开信息包装判断；被查杀、对跳或票型暴露后会进入高危位。",
    tip: "不要过早暴露狼队视角，发言时尽量用公开信息包装你的怀疑。",
  },
  WOLF_KING: {
    title: "狼王",
    camp: "狼人阵营",
    goal: "与狼队一起屠边获胜，同时利用出局枪扩大狼队收益。",
    timing: "夜间参与狼队刀人；白天被放逐或被猎人枪带走后进入开枪窗口。",
    ability: "出局枪可以带走一名玩家，常用于处理明神、强归票位或关键好人。",
    limits: "被夜间击杀或女巫毒死不能开枪；枪口不能只靠狼队私密视角决定。",
    tip: "白天不要轻易暴露狼王身份。出局枪要结合公开票型和发言压力，避免暴露狼队私密视角。",
  },
  WHITE_WOLF_KING: {
    title: "白狼王",
    camp: "狼人阵营",
    goal: "与狼队一起屠边获胜，在关键白天用自爆带人改变轮次。",
    timing: "夜间参与狼队刀人；自己的白天发言窗口可以主动自爆。",
    ability: "自爆后带走一名玩家，清空当天后续发言与投票，并直接结算进入夜晚。",
    limits: "只能在自己白天发言窗口发动，不能带走自己；过早自爆会减少狼队白天操作空间。",
    tip: "不要过早交出技能。自爆目标要优先瞄准公开高价值身份或能改变票型的关键好人。",
  },
  WOLF_BEAUTY: {
    title: "狼美人",
    camp: "狼人阵营",
    goal: "与狼队一起屠边获胜，用夜间魅惑制造白天出局连锁收益。",
    timing: "夜间狼队刀人后选择是否魅惑；自己白天出局时触发殉情。",
    ability: "每晚可以魅惑一名玩家。若狼美人因放逐、决斗或白天枪出局，当前魅惑目标会一同出局。",
    limits: "不能魅惑自己；夜间被杀或被毒不会触发白天殉情收益。",
    tip: "魅惑优先找公开高价值好人或能扰乱归票的位置，发言仍要只使用公开逻辑包装狼队视角。",
  },
  VILLAGER: {
    title: "平民",
    camp: "好人阵营",
    goal: "找出并放逐所有狼人。",
    timing: "白天发言、投票和复盘票型时发挥作用。",
    ability: "没有夜晚技能，主要依靠发言质量、投票责任和死亡信息帮助好人统一狼坑。",
    limits: "没有私有信息，不能把猜测包装成确定信息；发言过空容易成为抗推位。",
    tip: "你是闭眼视角，重点观察谁在回避逻辑、谁在强行带节奏。",
  },
  SEER: {
    title: "预言家",
    camp: "好人阵营",
    goal: "通过查验帮助好人找出狼人。",
    timing: "每晚查验一名玩家；白天选择是否公开查验和警徽流。",
    ability: "查验可得知目标属于狼人阵营或好人阵营，是好人推进狼坑的核心信息。",
    limits: "每天只能产生一条查验信息；报结果时要承担站边、警徽流和归票压力。",
    tip: "查验结果是你的核心信息。什么时候报、怎么归票，会直接影响局势。",
  },
  WITCH: {
    title: "女巫",
    camp: "好人阵营",
    goal: "利用药品保护关键好人，并找机会毒杀狼人。",
    timing: "解药未用时夜间得知刀口并选择用药；白天根据银水、毒口和发言决定是否公开信息。",
    ability: "拥有一瓶解药和一瓶毒药，解药可救刀口，毒药可毒死一名玩家。",
    limits: "首夜可以自救，第二夜起不能自救；解药用完后不再获知后续刀口，盲毒错误会明显压缩好人轮次。",
    tip: "药品很珍贵。先听发言，再决定是否公开自己的判断。",
  },
  HUNTER: {
    title: "猎人",
    camp: "好人阵营",
    goal: "用发言和最后一枪帮助好人扩大优势。",
    timing: "被狼人击杀或白天放逐后进入开枪窗口。",
    ability: "出局时可以选择开枪带走一名玩家，也可以不开枪保留信息压力。",
    limits: "被女巫毒死不能开枪；枪口需要基于公开狼面，误枪好人会损失轮次。",
    tip: "你有威慑力，但不必一开始亮身份。把枪口留给最值得怀疑的人。",
  },
  IDIOT: {
    title: "白痴",
    camp: "好人阵营",
    goal: "帮助好人找出狼人，并在关键抗推位用翻牌保住轮次。",
    timing: "白天发言和投票阶段发挥作用；被白天放逐时触发翻牌。",
    ability: "被放逐时不会出局，而是公开翻牌免死；翻牌后仍可继续发言。",
    limits: "翻牌后失去投票权，不能再作为放逐投票目标；夜间死亡、女巫毒杀和枪杀仍正常出局。",
    tip: "不要只靠技能吃抗推。翻牌前要把公开逻辑讲清楚，翻牌后更要帮有票权的好人收束狼坑。",
  },
  KNIGHT: {
    title: "骑士",
    camp: "好人阵营",
    goal: "用发言和一次决斗帮助好人验证关键狼坑。",
    timing: "白天发言结束后、投票前，系统会给骑士一次决斗窗口。",
    ability: "决斗命中狼人阵营时目标出局并结束白天；决斗命中好人阵营时骑士自己出局并继续投票。",
    limits: "整局只能发动一次，不能决斗自己；错误决斗会让好人少一神并留下投票压力。",
    tip: "决斗不是替代推理。先用公开发言、身份线和票型坐实目标狼面，再决定是否发动。",
  },
  GUARD: {
    title: "守卫",
    camp: "好人阵营",
    goal: "保护关键好人，并协助放逐所有狼人。",
    timing: "每晚选择守护目标或空守，白天复盘刀口和可能的保护节奏。",
    ability: "守护可以阻止目标当晚被狼人击杀，也可以空守来调整节奏。",
    limits: "不能连续两晚守护同一名玩家；同守同救存在风险，要避免和女巫节奏撞车。",
    tip: "守护节奏很重要。不要轻易暴露守护目标，尤其注意同守同救的风险。",
  },
};

const ROLE_LINK_TIPS: Record<Role, RoleLinkTip[]> = {
  WEREWOLF: [
    {
      title: "特殊狼要分工隐藏",
      detail: "狼王、白狼王、狼美人都能改变白天轮次，普通狼人发言时不要过早把特殊狼位置聊出来。",
      relatedRoles: ["WOLF_KING", "WHITE_WOLF_KING", "WOLF_BEAUTY"],
      keywords: ["狼队", "特殊狼", "分工"],
    },
  ],
  WOLF_KING: [
    {
      title: "被猎人枪带走仍可开枪",
      detail: "狼王被白天放逐或被猎人带走会进入狼王枪窗口；被夜间击杀或女巫毒死不会开枪。",
      relatedRoles: ["HUNTER", "WITCH"],
      keywords: ["狼王枪", "猎人枪", "毒"],
    },
  ],
  WHITE_WOLF_KING: [
    {
      title: "自爆会跳过后续白天流程",
      detail: "白狼王只能在自己的白天发言窗口自爆。自爆带人后，当天后续发言和投票会被清空并直接结算。",
      keywords: ["自爆", "带人", "跳过投票"],
    },
  ],
  WOLF_BEAUTY: [
    {
      title: "白天出局才触发殉情",
      detail: "狼美人被放逐、骑士决斗命中、猎人枪或狼王枪带走时会触发当前魅惑目标殉情；夜间死亡或被毒不会触发。",
      relatedRoles: ["KNIGHT", "HUNTER", "WOLF_KING", "WITCH"],
      keywords: ["殉情", "魅惑", "决斗", "枪"],
    },
  ],
  VILLAGER: [
    {
      title: "平民负责把技能信息翻译成票型",
      detail: "平民没有夜间信息，价值在于把查验、银水、枪口、决斗结果转成清晰狼坑和投票方向。",
      relatedRoles: ["SEER", "WITCH", "HUNTER", "KNIGHT"],
      keywords: ["票型", "狼坑", "闭眼"],
    },
  ],
  SEER: [
    {
      title: "查验能给骑士决斗垫证据",
      detail: "查杀或稳定身份关系能帮助骑士判断是否发动决斗，但骑士仍需要结合发言和票型避免误决斗。",
      relatedRoles: ["KNIGHT"],
      keywords: ["查杀", "金水", "决斗"],
    },
  ],
  WITCH: [
    {
      title: "毒中猎人会阻断猎人枪",
      detail: "猎人被女巫毒死不能开枪。用毒前要确认收益，避免毒掉能帮好人翻轮次的猎人。",
      relatedRoles: ["HUNTER"],
      keywords: ["毒", "猎人枪", "开枪"],
    },
    {
      title: "注意同守同救",
      detail: "守卫和女巫同时保护同一目标会产生风险。女巫救人后，白天不要过早暴露具体银水节奏。",
      relatedRoles: ["GUARD"],
      keywords: ["同守同救", "解药", "银水", "守护"],
    },
  ],
  HUNTER: [
    {
      title: "被毒不能开枪",
      detail: "猎人被狼人击杀或白天放逐可以开枪，被女巫毒死不能开枪。发言时要保护枪口可信度。",
      relatedRoles: ["WITCH"],
      keywords: ["毒", "猎人枪", "枪口"],
    },
    {
      title: "枪中特殊狼会继续结算",
      detail: "猎人枪带走狼王会触发狼王枪，带走狼美人会触发殉情。枪口收益要把连锁死亡也算进去。",
      relatedRoles: ["WOLF_KING", "WOLF_BEAUTY"],
      keywords: ["狼王枪", "殉情", "连锁"],
    },
  ],
  IDIOT: [
    {
      title: "翻牌后失去投票权",
      detail: "白痴被放逐会翻牌免死，但之后不能投票；仍然可以发言、施压和留下公开逻辑。",
      relatedRoles: ["SEER", "WITCH", "HUNTER"],
      keywords: ["白痴", "翻牌", "免死", "投票权"],
    },
    {
      title: "夜间和枪杀仍正常出局",
      detail: "白痴技能只处理白天放逐。狼人夜刀、女巫毒药、猎人枪等死亡结算不会触发免死。",
      relatedRoles: ["WEREWOLF", "WITCH", "HUNTER"],
      keywords: ["夜刀", "毒", "枪", "出局"],
    },
  ],
  KNIGHT: [
    {
      title: "决斗狼美人会触发殉情",
      detail: "骑士决斗命中狼美人时，狼美人出局并触发当前魅惑目标殉情。发动前要评估连锁收益和风险。",
      relatedRoles: ["WOLF_BEAUTY"],
      keywords: ["决斗", "狼美人", "殉情"],
    },
    {
      title: "决斗最好承接查验和票型",
      detail: "骑士不是替代推理的按钮。查杀、对跳矛盾、连续冲票这些公开证据越集中，决斗越有价值。",
      relatedRoles: ["SEER"],
      keywords: ["查杀", "票型", "对跳"],
    },
  ],
  GUARD: [
    {
      title: "注意同守同救",
      detail: "守卫保护和女巫解药撞到同一人会产生风险。守卫要用空守和错位守护调节节奏。",
      relatedRoles: ["WITCH"],
      keywords: ["同守同救", "守护", "解药", "空守"],
    },
  ],
};

function RoleCardArtwork({
  role,
  title,
  src = ROLE_CARD_IMAGES[role],
  className = "",
  imageClassName = "object-contain",
  priority = false,
  sizes = "120px",
  style,
}: {
  role: Role;
  title: string;
  src?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={["relative shrink-0 overflow-hidden bg-[#120c0a]", className].join(" ")}
      style={{ aspectRatio: ROLE_CARD_ASPECT_RATIOS[role], ...style }}
    >
      <Image
        fill
        priority={priority}
        sizes={sizes}
        className={imageClassName}
        src={src}
        alt={`${title}身份牌`}
      />
    </div>
  );
}

export type IdiotRevealCue = {
  key: string;
  seatId: number;
  seatName: string;
  message: string;
};

export function buildIdiotRevealCue(
  game: HumanGameView,
  event: HumanGameView["publicEvents"][number],
): IdiotRevealCue | null {
  if (event.type !== "IDIOT_REVEALED") return null;
  const payloadSeatId = typeof event.payload.seatId === "number" ? event.payload.seatId : undefined;
  const seatId = payloadSeatId ?? event.actorSeatId;
  if (!seatId) return null;
  const seat = game.seats.find((item) => item.seatId === seatId);
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    seatId,
    seatName: seat ? `${seat.seatId}号 ${seat.name}` : `${seatId}号`,
    message: event.message || `${seatId}号是白痴，翻牌免死，失去投票权。`,
  };
}

export function IdiotRevealOverlay({ cue }: { cue: IdiotRevealCue }) {
  return (
    <div className="idiot-reveal-backdrop fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-black/88 px-4 py-6 backdrop-blur-md">
      <div className="idiot-reveal-table" aria-hidden="true" />
      <section className="idiot-reveal-stage relative z-10 grid w-full max-w-4xl justify-items-center gap-5 text-center">
        <div className="idiot-reveal-copy">
          <div className="inline-flex rounded-full border border-[#77d898]/28 bg-[#0f2118]/78 px-3 py-1 text-xs font-semibold text-[#a8f0b6] shadow-lg shadow-black/30">
            白痴技能发动
          </div>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#f7ead5] sm:text-5xl">翻牌免死</h2>
          <p className="mt-3 text-sm leading-6 text-[#dcc9a7] sm:text-base">{cue.message}</p>
        </div>

        <div className="idiot-reveal-card-scene" aria-label={`${cue.seatName} 翻开白痴角色卡牌`}>
          <div className="idiot-reveal-card">
            <div className="idiot-reveal-face idiot-reveal-card-back">
              <Image
                fill
                priority
                sizes="280px"
                src={ROLE_CARD_IMAGES.HIDDEN}
                alt=""
                aria-hidden="true"
                className="rounded-[20px] object-cover"
              />
            </div>
            <div className="idiot-reveal-face idiot-reveal-card-front">
              <RoleCardArtwork
                role="IDIOT"
                title="白痴"
                priority
                sizes="280px"
                className="h-full w-full rounded-[20px] border border-[#77d898]/48 shadow-2xl shadow-black/70"
                imageClassName="object-cover object-center"
              />
            </div>
          </div>
        </div>

        <div className="idiot-reveal-seat rounded-full border border-[#f1c76e]/24 bg-[#21160d]/78 px-4 py-2 text-sm font-semibold text-[#f1d796] shadow-xl shadow-black/30">
          {cue.seatName}
        </div>
      </section>
    </div>
  );
}

export function RoleIntroOverlay({ game, onEnter }: { game: HumanGameView; onEnter: () => void }) {
  if (!game.myRole) return null;
  const intro = ROLE_INTROS[game.myRole];
  const teammates = game.wolfTeammates.map((seat) => seat.name).join("、");

  return (
    <div className="role-intro-backdrop role-intro-mobile-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/86 px-4 py-6 backdrop-blur-md">
      <section className="role-intro-shell mx-auto grid w-full max-w-5xl gap-6 rounded-[30px] border border-[#f1c76e]/30 bg-[#120c0a]/95 p-4 shadow-2xl shadow-black/70 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="role-intro-hero flex min-h-[500px] flex-col items-center justify-start rounded-[24px] border border-[#f1c76e]/18 bg-black/28 p-5 sm:p-6">
          <div className="role-card-scene role-intro-card-scene mt-1">
            <Image
              fill
              sizes="240px"
              className="role-card-shadow-card rounded-[18px] border border-[#f1c76e]/22 object-cover"
              src={ROLE_CARD_IMAGES.HIDDEN}
              alt=""
              aria-hidden="true"
            />
            <RoleCardArtwork
              role={game.myRole}
              title={intro.title}
              priority
              sizes="240px"
              className="role-card-reveal rounded-[18px] border border-[#f1c76e]/60 shadow-2xl"
            />
          </div>
          <div className="role-intro-identity mt-6 text-center">
            <div className="role-intro-eyebrow text-xs uppercase tracking-[0.28em] text-[#ad9c7d]">Your Role</div>
            <div className="role-intro-title mt-2 text-3xl font-semibold text-[#f1d796]">{intro.title}</div>
          </div>
        </div>

        <div className="role-intro-copy flex min-w-0 flex-col justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-[#f1c76e]/25 bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">
              身份已发放
            </div>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#f7ead5] sm:text-4xl">
              你是 {intro.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dcc9a7]">
              记住你的身份和胜利目标。确认后进入牌桌，系统会以主持人节奏自动推进到你需要行动的时刻。
            </p>
          </div>

          <div className="role-intro-detail-grid grid gap-3 sm:grid-cols-2">
            <RoleIntroItem label="阵营" value={intro.camp} />
            <RoleIntroItem label="胜利条件" value={intro.goal} />
            <RoleIntroItem label="行动时机" value={intro.timing} />
            <RoleIntroItem label="技能效果" value={intro.ability} />
            <RoleIntroItem label="限制条件" value={intro.limits} />
            <RoleIntroItem label="发言建议" value={intro.tip} />
            {teammates && <RoleIntroItem label="狼队友" value={teammates} />}
          </div>

          <button
            onClick={onEnter}
            className="role-intro-confirm min-h-12 rounded-full bg-[#b74332] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-black/35 transition hover:bg-[#cf513d]"
          >
            确认身份，进入游戏
          </button>
        </div>
      </section>
    </div>
  );
}

function RoleIntroItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="role-intro-item rounded-2xl border border-[#f1c76e]/16 bg-black/24 px-4 py-3">
      <div className="mb-1 text-xs text-[#ad9c7d]">{label}</div>
      <div className="text-sm leading-6 text-[#f7ead5]">{value}</div>
    </div>
  );
}

export function IdentityBookOverlay({
  game,
  activeBoardId,
  onClose,
}: {
  game?: HumanGameView | null;
  activeBoardId?: string;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<IdentityBookFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const activeBoard = activeBoardId ? getBoardPreset(activeBoardId) : undefined;
  const activeBoardRoleSet = useMemo(() => new Set(activeBoard?.roles ?? []), [activeBoard]);
  const activeBoardRoleCounts = useMemo(() => getRoleCounts(activeBoard?.roles), [activeBoard]);
  const currentRole = game && game.humanSeatId !== null ? game.myRole : undefined;
  const hasActiveBoard = Boolean(activeBoard);
  const enabledRoleCount = IDENTITY_BOOK_ROLE_ORDER.filter((role) => activeBoardRoleSet.has(role)).length;
  const normalizedSearchQuery = normalizeIdentityBookSearch(searchQuery);
  const visibleRoles = useMemo(
    () =>
      IDENTITY_BOOK_ROLE_ORDER.filter((role) => {
        const enabled = activeBoardRoleSet.has(role);
        const searchRoleSet = hasActiveBoard && enabled ? activeBoardRoleSet : undefined;
        return (
          identityBookRoleMatchesFilter(role, filter) &&
          identityBookRoleMatchesSearch(role, normalizedSearchQuery, searchRoleSet)
        );
      }),
    [activeBoardRoleSet, filter, hasActiveBoard, normalizedSearchQuery],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-book-title"
      className="role-intro-backdrop mobile-knowledge-overlay fixed inset-0 z-50 overflow-y-auto bg-black/86 px-3 py-5 backdrop-blur-md sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mobile-knowledge-card mx-auto w-full max-w-6xl rounded-[30px] border border-[#f1c76e]/30 bg-[#120c0a]/96 p-4 shadow-2xl shadow-black/70 sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mobile-knowledge-head mb-4 flex flex-col gap-3 border-b border-[#f1c76e]/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-full border border-[#f1c76e]/24 bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">
              身份书 · {visibleRoles.length}/{IDENTITY_BOOK_ROLE_ORDER.length} 个角色
            </div>
            <h2 id="identity-book-title" className="text-2xl font-semibold leading-tight text-[#f7ead5] sm:text-3xl">
              角色玩法技能
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#dcc9a7]">
              {activeBoard
                ? `当前板子：${activeBoard.name} · 启用 ${enabledRoleCount} 个身份`
                : "当前未绑定板子，按全部身份展示。"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-[#f1c76e]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
          >
            关闭
          </button>
        </div>

        <IdentityBookFocusPanel
          game={game ?? null}
          currentRole={currentRole}
          roleCounts={activeBoardRoleCounts}
          activeRoleSet={hasActiveBoard ? activeBoardRoleSet : undefined}
          onPreview={setPreviewRole}
        />

        <div className="mobile-knowledge-tools mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/14 bg-black/20 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto]">
            <div className="flex min-h-10 items-center rounded-full border border-[#f1c76e]/18 bg-[#090605]/70 px-3 focus-within:border-[#f1c76e]/48">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="搜索身份书"
                placeholder="搜索身份、技能或关键词"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#f7ead5] outline-none placeholder:text-[#7e6f5c]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-xs font-semibold text-[#ad9c7d] transition hover:text-[#f1d796]"
                >
                  清空
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {IDENTITY_BOOK_FILTERS.map((item) => {
                const active = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(item.id)}
                    className={[
                      "min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "border-[#f1c76e]/55 bg-[#3a2412]/82 text-[#f1d796]"
                        : "border-white/10 bg-black/18 text-[#ad9c7d] hover:border-[#f1c76e]/32 hover:text-[#f1d796]",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs lg:justify-end">
            {normalizedSearchQuery && (
              <span className="rounded-full border border-[#f1c76e]/18 bg-[#2a1b10]/46 px-2.5 py-1 text-[#f1d796]">
                匹配 {visibleRoles.length} 个
              </span>
            )}
            <span className="rounded-full border border-[#77d898]/18 bg-[#0f2118]/48 px-2.5 py-1 text-[#a8f0b6]">本板子</span>
            <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[#ad9c7d]">未启用置灰</span>
          </div>
        </div>

        <div className="soft-scrollbar mobile-knowledge-scroll grid gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3" style={{ maxHeight: "min(74vh, 760px)" }}>
          {visibleRoles.length > 0 ? (
            visibleRoles.map((role) => {
              const enabled = !hasActiveBoard || activeBoardRoleSet.has(role);
              return (
                <IdentityBookRoleCard
                  key={role}
                  role={role}
                  enabled={enabled}
                  hasActiveBoard={hasActiveBoard}
                  isCurrentRole={role === currentRole}
                  phaseHint={game ? getRolePhaseHint(role, game, role === currentRole) : undefined}
                  linkTips={getRoleLinkTips(role, enabled && hasActiveBoard ? activeBoardRoleSet : undefined)}
                  onPreview={setPreviewRole}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-[#f1c76e]/16 bg-[#1b120d]/56 px-4 py-8 text-center text-sm leading-6 text-[#ad9c7d] md:col-span-2 xl:col-span-3">
              未找到匹配身份。可以搜索“毒”“自爆”“决斗”“同守同救”“殉情”等关键词。
            </div>
          )}
        </div>
      </section>
      {previewRole && (
        <IdentityBookPreview
          role={previewRole}
          enabled={!hasActiveBoard || activeBoardRoleSet.has(previewRole)}
          hasActiveBoard={hasActiveBoard}
          boardName={activeBoard?.name}
          isCurrentRole={previewRole === currentRole}
          phaseHint={game ? getRolePhaseHint(previewRole, game, previewRole === currentRole) : undefined}
          linkTips={getRoleLinkTips(previewRole, hasActiveBoard && activeBoardRoleSet.has(previewRole) ? activeBoardRoleSet : undefined)}
          onClose={() => setPreviewRole(null)}
        />
      )}
    </div>
  );
}

function getRoleCounts(roles: readonly Role[] | undefined): { role: Role; count: number }[] {
  const counts = new Map<Role, number>();
  for (const role of roles ?? []) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  return IDENTITY_BOOK_ROLE_ORDER.map((role) => ({ role, count: counts.get(role) ?? 0 })).filter((item) => item.count > 0);
}

function IdentityBookFocusPanel({
  game,
  currentRole,
  roleCounts,
  activeRoleSet,
  onPreview,
}: {
  game: HumanGameView | null;
  currentRole?: Role;
  roleCounts: { role: Role; count: number }[];
  activeRoleSet?: ReadonlySet<Role>;
  onPreview: (role: Role) => void;
}) {
  if (!currentRole && roleCounts.length === 0) return null;

  const currentIntro = currentRole ? ROLE_INTROS[currentRole] : undefined;
  const currentHint = currentRole && game ? getRolePhaseHint(currentRole, game, true) : undefined;
  const currentLinkTips = currentRole ? getRoleLinkTips(currentRole, activeRoleSet).slice(0, 2) : [];
  const currentTone = currentIntro ? roleCampTone(currentIntro.camp) : undefined;

  return (
    <div className="mobile-knowledge-focus mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/16 bg-[#1b120d]/58 p-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[#f1c76e]/16 bg-black/20 p-3">
        {currentIntro && currentRole ? (
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <RoleCardArtwork
                role={currentRole}
                title={currentIntro.title}
                src={ROLE_CARD_BOOK_IMAGES[currentRole]}
                sizes="96px"
                className="w-[78px] rounded-xl border border-[#f1c76e]/36 shadow-lg shadow-black/35"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-[#f1c76e]/28 bg-[#3a2412]/58 px-2.5 py-1 text-xs font-semibold text-[#f1d796]">
                    你的身份
                  </span>
                  {currentTone && (
                    <span className={`${currentTone.pill} rounded-full border px-2.5 py-1 text-xs font-semibold`}>{currentIntro.camp}</span>
                  )}
                </div>
                <h3 className="mt-2 text-xl font-semibold text-[#f7ead5]">你是 {currentIntro.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#ad9c7d]">{game ? `当前阶段：${game.phaseLabel}` : "开局后显示阶段提示"}</p>
              </div>
            </div>
            {currentHint && <RolePhaseHintBox hint={currentHint} />}
            {currentLinkTips.length > 0 && <RoleLinkTipList tips={currentLinkTips} compact />}
            <button
              type="button"
              onClick={() => onPreview(currentRole)}
              className="min-h-10 rounded-xl border border-[#f1c76e]/25 bg-[#2c1b11]/74 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#3a2412]"
            >
              查看你的身份大图
            </button>
          </div>
        ) : (
          <div className="grid min-h-[140px] place-items-center rounded-xl border border-dashed border-[#f1c76e]/20 bg-black/16 px-4 py-5 text-center text-sm leading-6 text-[#ad9c7d]">
            开局后这里会固定显示你的身份和当前阶段提示。
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#f1c76e]/16 bg-black/18 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#f7ead5]">本局启用身份</h3>
          <span className="rounded-full border border-[#77d898]/18 bg-[#0f2118]/48 px-2.5 py-1 text-xs text-[#a8f0b6]">
            {roleCounts.length} 类
          </span>
        </div>
        {roleCounts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {roleCounts.map(({ role, count }) => {
              const intro = ROLE_INTROS[role];
              const tone = roleCampTone(intro.camp);
              const selected = role === currentRole;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => onPreview(role)}
                  className={[
                    "rounded-full border px-3 py-2 text-xs font-semibold transition",
                    selected
                      ? "border-[#f1c76e]/55 bg-[#3a2412]/84 text-[#f1d796]"
                      : `${tone.pill} hover:border-[#f1c76e]/40 hover:text-[#f1d796]`,
                  ].join(" ")}
                  aria-label={`查看本局身份${intro.title}`}
                >
                  {intro.title}
                  {count > 1 ? ` ×${count}` : ""}
                  {selected ? " · 你" : ""}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/16 px-3 py-4 text-sm text-[#ad9c7d]">当前未选择板子。</div>
        )}
      </section>
    </div>
  );
}

function RolePhaseHintBox({ hint }: { hint: RolePhaseHint }) {
  return (
    <div className={`${rolePhaseHintClass(hint.tone)} rounded-xl border px-3 py-2`}>
      <div className="mb-1 text-xs font-semibold">{hint.title}</div>
      <div className="text-xs leading-5">{hint.detail}</div>
    </div>
  );
}

function rolePhaseHintClass(tone: RolePhaseHint["tone"]): string {
  const tones = {
    green: "border-[#77d898]/24 bg-[#0f2118]/46 text-[#dff4df]",
    gold: "border-[#f1c76e]/24 bg-[#2a1b10]/46 text-[#f1d796]",
    blue: "border-[#7da8e3]/22 bg-[#0d1623]/48 text-[#d8e7ff]",
    red: "border-[#e46d55]/24 bg-[#351210]/46 text-[#ffd8cf]",
  };
  return tones[tone];
}

function RoleLinkTipList({ tips, compact = false }: { tips: RoleLinkTip[]; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-2" : "mt-4 grid gap-2"}>
      {!compact && <h4 className="text-sm font-semibold text-[#f7ead5]">身份联动提醒</h4>}
      <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
        {tips.map((tip) => (
          <div key={`${tip.title}-${tip.detail}`} className="rounded-xl border border-[#f1c76e]/14 bg-black/20 px-3 py-2">
            <div className="mb-1 text-xs font-semibold text-[#f1d796]">{tip.title}</div>
            <div className="text-xs leading-5 text-[#dcc9a7]">{tip.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRoleLinkTips(role: Role, activeRoleSet?: ReadonlySet<Role>): RoleLinkTip[] {
  const tips = ROLE_LINK_TIPS[role] ?? [];
  if (!activeRoleSet || activeRoleSet.size === 0) return tips;
  return tips.filter((tip) => !tip.relatedRoles || tip.relatedRoles.some((relatedRole) => activeRoleSet.has(relatedRole)));
}

function hasHumanAction(game: HumanGameView, type: AvailableHumanAction["type"]): boolean {
  return game.availableActions.some((action) => action.type === type);
}

function getActiveHumanActionHint(role: Role, game: HumanGameView): RolePhaseHint | undefined {
  if (hasHumanAction(game, "whiteWolfKingExplode")) {
    return {
      title: "现在可以自爆",
      detail: "这是白狼王的发言窗口。自爆会带走一名玩家，并跳过今天剩余发言和投票。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "wolfKill")) {
    return {
      title: "现在可以刀人",
      detail: "狼队夜间行动中，选择刀口时仍要考虑白天如何解释局势和票型。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "wolfBeautyCharm")) {
    return {
      title: "现在可以魅惑",
      detail: "魅惑目标会在狼美人白天出局时殉情。优先考虑明神、强归票位或会改变轮次的位置。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "guardAction")) {
    return {
      title: "现在可以守护",
      detail: "选择保护目标或空守。注意不能连续守同一人，也要避开可能的同守同救。",
      tone: "blue",
    };
  }
  if (hasHumanAction(game, "seerCheck")) {
    return {
      title: "现在可以查验",
      detail: "查验结果会成为白天最重要的信息。提前想好明天是否报结果和警徽流。",
      tone: "blue",
    };
  }
  const witchAction = game.availableActions.find((action) => action.type === "witchAction");
  if (witchAction?.type === "witchAction") {
    const medicine = [witchAction.canSave ? "解药" : "", witchAction.canPoison ? "毒药" : ""].filter(Boolean).join("或") || "药品";
    return {
      title: `现在可以使用${medicine}`,
      detail: "每晚最多使用一瓶药。救人、毒人或留药都会影响后续轮次和白天发言压力。",
      tone: "blue",
    };
  }
  if (hasHumanAction(game, "knightDuel")) {
    return {
      title: "现在可以决斗",
      detail: "决斗命中狼人会直接放逐目标；决斗好人则骑士出局。先确认目标狼面足够集中。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "hunterReveal")) {
    return {
      title: "现在确认是否翻牌",
      detail: "翻牌后会公开猎人身份并必须带走一名玩家；不翻牌则不会公开猎人发动技能。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "hunterShoot")) {
    return {
      title: "现在可以开枪",
      detail: "你已经翻牌发动猎人技能，必须选择一名存活玩家带走。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "wolfKingShoot")) {
    return {
      title: "现在可以开狼王枪",
      detail: "狼王枪要优先破坏好人归票或处理明神，但理由要能从公开信息解释。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "lastWords")) {
    return {
      title: "现在轮到你留遗言",
      detail: "遗言要明确身份信息、怀疑对象和投票建议，避免只做情绪表达。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "vote") || hasHumanAction(game, "sheriffVote")) {
    return {
      title: "现在需要投票",
      detail: "投票是公开信息。给出能被复盘的理由，比单纯跟票更有价值。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "speak") || hasHumanAction(game, "sheriffSpeech")) {
    return {
      title: "现在轮到你发言",
      detail: ROLE_INTROS[role].camp === "狼人阵营" ? "尽量用公开信息包装判断，避免暴露狼队视角。" : "说明你的信息来源、狼坑和投票倾向，帮助好人统一判断。",
      tone: "green",
    };
  }
  if (hasHumanAction(game, "sheriffNominate") || hasHumanAction(game, "sheriffWithdraw") || hasHumanAction(game, "sheriffHandoff")) {
    return {
      title: "现在是警长相关操作",
      detail: "警徽会影响归票权和票重。选择时要考虑谁的信息最稳定、谁能带队复盘。",
      tone: "gold",
    };
  }

  return undefined;
}

function getRolePhaseHint(role: Role, game: HumanGameView, isCurrentRole: boolean): RolePhaseHint {
  const activeHint = isCurrentRole ? getActiveHumanActionHint(role, game) : undefined;
  if (activeHint) return activeHint;

  const intro = ROLE_INTROS[role];
  const isWolf = intro.camp === "狼人阵营";

  if (game.result) {
    return {
      title: "对局已结束",
      detail: "现在适合回看发言、票型和技能触发点，把身份说明和复盘信息对照起来。",
      tone: "green",
    };
  }

  switch (game.phase) {
    case "NIGHT_WOLVES":
      return isWolf
        ? { title: "夜间狼队行动", detail: `${intro.title}此时参与狼队刀人，下一天要能解释刀口带来的局势。`, tone: "red" }
        : { title: "夜间等待信息", detail: `${intro.title}此时通常不行动，重点准备根据天亮信息更新狼坑。`, tone: "blue" };
    case "NIGHT_WOLF_BEAUTY":
      return role === "WOLF_BEAUTY"
        ? { title: "狼美人行动段", detail: "此时选择魅惑目标或跳过，白天自己出局时才会触发殉情。", tone: "red" }
        : { title: "夜间等待结算", detail: "狼美人行动不会公开，白天需要结合死亡和发言判断是否存在连锁风险。", tone: "blue" };
    case "NIGHT_GUARD":
      return role === "GUARD"
        ? { title: "守卫行动段", detail: "此时选择守护目标或空守，注意连续守护和同守同救限制。", tone: "blue" }
        : { title: "夜间等待守护", detail: "当前是守卫行动段，白天只会看到结算结果，不会公开守护目标。", tone: "blue" };
    case "NIGHT_SEER":
      return role === "SEER"
        ? { title: "预言家行动段", detail: "此时查验一名玩家，明天要决定查验结果如何进入发言和归票。", tone: "blue" }
        : { title: "夜间等待查验", detail: "当前是预言家行动段，白天要通过报验、对跳和票型判断真假信息。", tone: "blue" };
    case "NIGHT_WITCH":
      return role === "WITCH"
        ? { title: "女巫行动段", detail: "解药未用时可见刀口；解药用完后只能盲毒或留药。每晚最多使用一瓶药。", tone: "blue" }
        : { title: "夜间等待药品结算", detail: "当前是女巫行动段，天亮后的死亡信息可能受救人或毒人影响。", tone: "blue" };
    case "DAY_SPEECH":
      if (role === "WHITE_WOLF_KING") {
        return { title: "发言期可自爆", detail: "白狼王只有在自己的发言窗口才能自爆带人，未轮到时先听信息和找目标。", tone: "red" };
      }
      return {
        title: "白天发言期",
        detail: isWolf ? "此时重点是伪装视角、推动好人焦点，并避免狼队信息外泄。" : "此时重点是交清信息、站边理由、狼坑和投票倾向。",
        tone: isWolf ? "red" : "gold",
      };
    case "KNIGHT_DUEL":
      return role === "KNIGHT"
        ? { title: "骑士决斗窗口", detail: "现在是骑士决斗阶段。命中狼人收益很高，错决斗会让好人少一神。", tone: "gold" }
        : { title: "等待骑士选择", detail: "骑士是否发动会直接改变白天是否进入投票。", tone: "gold" };
    case "DAY_VOTE":
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE":
      return { title: "投票阶段", detail: "所有阵营都要通过投票留下公开立场。票型会成为后续复盘证据。", tone: "gold" };
    case "HUNTER_REVEAL":
      return role === "HUNTER"
        ? { title: "猎人翻牌确认", detail: "你已死亡出局，先选择是否翻牌发动技能；不翻牌不会公开猎人播报。", tone: "gold" }
        : { title: "等待出局结算", detail: "出局玩家正在完成结算，随后继续遗言或后续流程。", tone: "gold" };
    case "HUNTER_SHOT":
      return role === "HUNTER"
        ? { title: "猎人开枪窗口", detail: "猎人已经翻牌，必须选择一名存活玩家带走。", tone: "gold" }
        : { title: "等待猎人枪", detail: "猎人已翻牌发动技能，枪口会改变死亡名单和后续遗言顺序。", tone: "gold" };
    case "WOLF_KING_SHOT":
      return role === "WOLF_KING"
        ? { title: "狼王开枪窗口", detail: "狼王出局后可以开枪带人，优先破坏好人核心信息位。", tone: "red" }
        : { title: "等待狼王枪", detail: "狼王枪会改变死亡名单和好人轮次。", tone: "red" };
    case "LAST_WORDS":
      return { title: "遗言阶段", detail: "出局玩家留下的信息会影响后续站边和票型。注意区分事实、判断和情绪。", tone: "gold" };
    case "SHERIFF_NOMINATION":
    case "SHERIFF_SPEECH":
    case "SHERIFF_WITHDRAWAL":
    case "SHERIFF_PK_SPEECH":
    case "SHERIFF_HANDOFF":
      return { title: "警长流程", detail: "警徽影响归票权和票重。身份发言要围绕谁更适合带队展开。", tone: "gold" };
    case "EXILE_RESOLUTION":
    case "DAY_ANNOUNCEMENT":
      return { title: "结算阶段", detail: "此时重点看死亡、放逐和技能公开结果，再更新身份关系。", tone: "gold" };
    default:
      return {
        title: "等待流程推进",
        detail: `${intro.title}当前没有专属操作，先根据公开信息准备下一轮发言或投票。`,
        tone: isWolf ? "red" : "blue",
      };
  }
}

export function GlossaryOverlay({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = normalizeGlossarySearch(searchQuery);
  const totalEntries = GLOSSARY_SECTIONS.reduce((total, section) => total + section.entries.length, 0);
  const filteredSections = useMemo(
    () =>
      normalizedSearchQuery
        ? GLOSSARY_SECTIONS.map((section) => ({
            ...section,
            entries: section.entries.filter((entry) => glossaryEntryMatchesSearch(section, entry, normalizedSearchQuery)),
          })).filter((section) => section.entries.length > 0)
        : GLOSSARY_SECTIONS,
    [normalizedSearchQuery],
  );
  const visibleEntryCount = filteredSections.reduce((total, section) => total + section.entries.length, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-title"
      className="role-intro-backdrop mobile-knowledge-overlay fixed inset-0 z-50 overflow-y-auto bg-black/86 px-3 py-5 backdrop-blur-md sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mobile-knowledge-card mx-auto w-full max-w-6xl rounded-[30px] border border-[#7da8e3]/30 bg-[#0d1118]/96 p-4 shadow-2xl shadow-black/70 sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mobile-knowledge-head mb-4 flex flex-col gap-3 border-b border-[#7da8e3]/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-full border border-[#7da8e3]/24 bg-[#7da8e3]/10 px-3 py-1 text-xs text-[#b8d6ff]">
              术语表 · {normalizedSearchQuery ? `${visibleEntryCount}/${totalEntries}` : totalEntries} 个常见说法
            </div>
            <h2 id="glossary-title" className="text-2xl font-semibold leading-tight text-[#f7ead5] sm:text-3xl">
              狼人杀桌面用语
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cdbb9a]">
              AI 发言、投票理由和复盘里常出现这些说法。这里按当前项目的规则语境解释，重点说明它们在桌面推理里通常代表什么。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-[#7da8e3]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
          >
            关闭
          </button>
        </div>

        <div className="mobile-knowledge-tools mb-4 grid gap-2 rounded-2xl border border-[#7da8e3]/18 bg-black/22 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="搜索狼人杀术语"
            placeholder="搜索术语或关键词"
            className="min-h-11 w-full rounded-xl border border-[#7da8e3]/18 bg-[#07101a]/78 px-3 py-2 text-sm text-[#e4efff] outline-none transition placeholder:text-[#7f91ad] focus:border-[#7da8e3]/52 focus:bg-[#0d1623]"
          />
          <div className="flex items-center justify-between gap-3 text-xs text-[#9fb2d0] sm:justify-end">
            <span>{normalizedSearchQuery ? `匹配 ${visibleEntryCount} 个` : `共 ${totalEntries} 个`}</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
              >
                清空
              </button>
            )}
          </div>
        </div>

        <div className="soft-scrollbar mobile-knowledge-scroll grid gap-5 overflow-y-auto pr-1" style={{ maxHeight: "min(74vh, 760px)" }}>
          {filteredSections.length > 0 ? (
            filteredSections.map((section) => (
              <section key={section.title} className="grid gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#e4efff]">{section.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#9fb2d0]">{section.description}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {section.entries.map((entry) => (
                    <GlossaryTermCard key={`${section.title}-${entry.term}`} entry={entry} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-2xl border border-[#7da8e3]/18 bg-[#0d1623]/54 px-4 py-8 text-center text-sm text-[#b8d6ff]">
              未找到匹配术语
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function normalizeGlossarySearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function glossaryEntryMatchesSearch(section: GlossarySection, entry: GlossaryEntry, query: string): boolean {
  return [section.title, section.description, entry.term, entry.alias ?? "", entry.meaning, entry.tableUse, entry.example].some((value) =>
    normalizeGlossarySearch(value).includes(query),
  );
}

function normalizeIdentityBookSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function identityBookRoleMatchesSearch(role: Role, query: string, activeRoleSet?: ReadonlySet<Role>): boolean {
  if (!query) return true;
  const intro = ROLE_INTROS[role];
  const linkTips = getRoleLinkTips(role, activeRoleSet);
  return [
    intro.title,
    intro.camp,
    intro.goal,
    intro.timing,
    intro.ability,
    intro.limits,
    intro.tip,
    ...linkTips.flatMap((tip) => [tip.title, tip.detail, ...(tip.keywords ?? [])]),
  ].some((value) => normalizeIdentityBookSearch(value).includes(query));
}

function identityBookRoleMatchesFilter(role: Role, filter: IdentityBookFilter): boolean {
  if (filter === "all") return true;
  const camp = ROLE_INTROS[role].camp;
  return filter === "werewolves" ? camp === "狼人阵营" : camp === "好人阵营";
}

function roleCampTone(camp: RoleCamp): { card: string; pill: string; mutedCard: string } {
  if (camp === "狼人阵营") {
    return {
      card: "border-[#e46d55]/24 bg-[#27110f]/78",
      pill: "border-[#e46d55]/25 bg-[#572017]/38 text-[#ffb1a4]",
      mutedCard: "border-[#6f5148]/20 bg-[#18110f]/62",
    };
  }

  return {
    card: "border-[#77d898]/18 bg-[#0f2118]/62",
    pill: "border-[#77d898]/25 bg-[#1d4e33]/34 text-[#a8f0b6]",
    mutedCard: "border-[#52665c]/20 bg-[#101713]/58",
  };
}

function IdentityBookRoleCard({
  role,
  enabled,
  hasActiveBoard,
  isCurrentRole,
  phaseHint,
  linkTips,
  onPreview,
}: {
  role: Role;
  enabled: boolean;
  hasActiveBoard: boolean;
  isCurrentRole: boolean;
  phaseHint?: RolePhaseHint;
  linkTips: RoleLinkTip[];
  onPreview: (role: Role) => void;
}) {
  const intro = ROLE_INTROS[role];
  const tone = roleCampTone(intro.camp);
  const boardBadge = !hasActiveBoard ? "全部板子" : enabled ? "本板子" : "未启用";

  return (
    <button
      type="button"
      onClick={() => onPreview(role)}
      className={[
        enabled ? tone.card : tone.mutedCard,
        "mobile-knowledge-role-card group grid min-h-[330px] gap-3 rounded-2xl border p-3 text-left shadow-xl shadow-black/24 transition",
        "hover:-translate-y-0.5 hover:border-[#f1c76e]/44 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#f1d796]/55",
        enabled ? "" : "opacity-58 grayscale-[0.72] hover:opacity-88 hover:grayscale-0",
      ].join(" ")}
      aria-label={`查看${intro.title}玩法技能`}
    >
      <div className="flex items-start gap-3">
        <RoleCardArtwork
          role={role}
          title={intro.title}
          src={ROLE_CARD_BOOK_IMAGES[role]}
          sizes="112px"
          className="mobile-knowledge-role-art w-[92px] rounded-xl border border-[#f1c76e]/28 shadow-lg shadow-black/30"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {isCurrentRole && (
              <span className="inline-flex rounded-full border border-[#f1c76e]/35 bg-[#3a2412]/70 px-2.5 py-1 text-xs font-semibold text-[#f1d796]">
                你的身份
              </span>
            )}
            <span className={`${tone.pill} inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold`}>{intro.camp}</span>
            <span
              className={[
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                enabled ? "border-[#77d898]/24 bg-[#0f2118]/45 text-[#a8f0b6]" : "border-white/10 bg-black/20 text-[#ad9c7d]",
              ].join(" ")}
            >
              {boardBadge}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-[#f7ead5]">{intro.title}</h3>
          <p className="mobile-knowledge-role-summary mt-2 text-xs leading-5 text-[#ad9c7d]">{intro.goal}</p>
        </div>
      </div>

      <div className="mobile-knowledge-role-lines grid gap-2 text-xs leading-5">
        {isCurrentRole && phaseHint && <RoleBookLine label="当前阶段" value={phaseHint.title} />}
        {linkTips[0] && <RoleBookLine label="联动提醒" value={linkTips[0].detail} />}
        <RoleBookLine label="行动时机" value={intro.timing} />
        <RoleBookLine label="技能效果" value={intro.ability} />
      </div>
    </button>
  );
}

function IdentityBookPreview({
  role,
  enabled,
  hasActiveBoard,
  boardName,
  isCurrentRole,
  phaseHint,
  linkTips,
  onClose,
}: {
  role: Role;
  enabled: boolean;
  hasActiveBoard: boolean;
  boardName?: string;
  isCurrentRole: boolean;
  phaseHint?: RolePhaseHint;
  linkTips: RoleLinkTip[];
  onClose: () => void;
}) {
  const intro = ROLE_INTROS[role];
  const tone = roleCampTone(intro.camp);
  const boardStatus = !hasActiveBoard ? "全部板子可查看" : enabled ? `已加入${boardName ?? "当前板子"}` : `未加入${boardName ?? "当前板子"}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-book-preview-title"
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/82 px-3 py-5 backdrop-blur-sm sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="grid w-full max-w-5xl gap-5 rounded-[28px] border border-[#f1c76e]/30 bg-[#100b09]/97 p-4 shadow-2xl shadow-black/75 sm:p-5 lg:grid-cols-[330px_minmax(0,1fr)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="grid content-start justify-items-center gap-3 rounded-[22px] border border-[#f1c76e]/16 bg-black/28 p-4">
          <RoleCardArtwork
            role={role}
            title={intro.title}
            src={ROLE_CARD_IMAGES[role]}
            sizes="(min-width: 1024px) 300px, min(82vw, 340px)"
            className="w-full max-w-[280px] rounded-[18px] border border-[#f1c76e]/42 shadow-2xl shadow-black/55"
          />
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {isCurrentRole && (
              <span className="rounded-full border border-[#f1c76e]/35 bg-[#3a2412]/70 px-3 py-1 font-semibold text-[#f1d796]">
                你的身份
              </span>
            )}
            <span className={`${tone.pill} rounded-full border px-3 py-1 font-semibold`}>{intro.camp}</span>
            <span
              className={[
                "rounded-full border px-3 py-1 font-semibold",
                enabled ? "border-[#77d898]/24 bg-[#0f2118]/45 text-[#a8f0b6]" : "border-white/10 bg-black/20 text-[#ad9c7d]",
              ].join(" ")}
            >
              {boardStatus}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 border-b border-[#f1c76e]/14 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="identity-book-preview-title" className="text-2xl font-semibold text-[#f7ead5] sm:text-3xl">
                {intro.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#dcc9a7]">{intro.goal}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-full border border-[#f1c76e]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
            >
              关闭预览
            </button>
          </div>

          {phaseHint && (
            <div className="mb-4">
              <RolePhaseHintBox hint={phaseHint} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <RoleIntroItem label="阵营" value={intro.camp} />
            <RoleIntroItem label="胜利条件" value={intro.goal} />
            <RoleIntroItem label="行动时机" value={intro.timing} />
            <RoleIntroItem label="技能效果" value={intro.ability} />
            <RoleIntroItem label="限制条件" value={intro.limits} />
            <RoleIntroItem label="发言建议" value={intro.tip} />
          </div>

          {linkTips.length > 0 && <RoleLinkTipList tips={linkTips} />}
        </div>
      </section>
    </div>
  );
}

function RoleBookLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mobile-knowledge-line rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="mb-1 text-[11px] text-[#ad9c7d]">{label}</div>
      <div className="text-[#f7ead5]">{value}</div>
    </div>
  );
}

function GlossaryTermCard({ entry }: { entry: GlossaryEntry }) {
  const toneClass = glossaryToneClass(entry.tone);
  return (
    <article className={`${toneClass.card} mobile-knowledge-term-card grid min-h-[250px] gap-3 rounded-2xl border p-3 shadow-xl shadow-black/24`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${toneClass.pill} rounded-full border px-2.5 py-1 text-sm font-semibold`}>{entry.term}</span>
          {entry.alias && <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-xs text-white/55">也叫 {entry.alias}</span>}
        </div>
        <p className="mt-3 text-sm leading-6 text-[#f7ead5]">{entry.meaning}</p>
      </div>
      <div className="grid gap-2 text-xs leading-5">
        <GlossaryLine label="桌面含义" value={entry.tableUse} />
        <GlossaryLine label="常见说法" value={entry.example} />
      </div>
    </article>
  );
}

function GlossaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mobile-knowledge-line rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="mb-1 text-[11px] text-[#9fb2d0]">{label}</div>
      <div className="text-[#dce8f8]">{value}</div>
    </div>
  );
}

function glossaryToneClass(tone: GlossaryEntry["tone"]): { card: string; pill: string } {
  const tones = {
    gold: {
      card: "border-[#f1c76e]/20 bg-[#21180f]/72",
      pill: "border-[#f1c76e]/28 bg-[#f1c76e]/12 text-[#f1d796]",
    },
    green: {
      card: "border-[#77d898]/18 bg-[#0f2118]/68",
      pill: "border-[#77d898]/25 bg-[#1d4e33]/30 text-[#a8f0b6]",
    },
    blue: {
      card: "border-[#7da8e3]/20 bg-[#0d1623]/72",
      pill: "border-[#7da8e3]/25 bg-[#7da8e3]/12 text-[#b8d6ff]",
    },
    red: {
      card: "border-[#e46d55]/22 bg-[#2a1110]/72",
      pill: "border-[#e46d55]/28 bg-[#572017]/34 text-[#ffb1a4]",
    },
  };
  return tones[tone];
}

export function SeatBoard({
  game,
  liveAiSpeech,
  aiSpeechAudioStatus,
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
}) {
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  const deadCount = game.seats.length - aliveCount;
  const compactSeats = game.seats.length >= 12;
  const activeVoice: SeatVoiceActivity | undefined = aiSpeechAudioStatus
    ? { seatId: aiSpeechAudioStatus.speaker.seatId, state: aiSpeechAudioStatus.state }
    : liveAiSpeech
      ? { seatId: liveAiSpeech.speaker.seatId, state: "generating" }
      : undefined;

  return (
    <section
      className={[
        "table-stage relative overflow-hidden rounded-[30px] border border-[#f1c76e]/25 bg-[#120b09]/70 bg-cover bg-center p-4 shadow-2xl shadow-black/45",
        compactSeats ? "lg:min-h-[820px] xl:min-h-[840px]" : "lg:min-h-[780px] xl:min-h-[820px]",
      ].join(" ")}
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(8,6,5,0.20), rgba(8,6,5,0.78)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="table-stage-light pointer-events-none absolute inset-0" />

      <div className="relative mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/20 bg-black/35 p-3 text-sm text-[#dcc9a7] lg:hidden">
        <div className="flex items-center justify-between">
          <span>{game.phaseLabel}</span>
          <span>
            存活 {aliveCount} · 出局 {deadCount}
          </span>
        </div>
      </div>

      <div
        className={[
          "table-orbit relative z-10 grid grid-cols-3 gap-3 lg:block",
          compactSeats ? "lg:min-h-[590px] xl:min-h-[610px]" : "lg:min-h-[560px] xl:min-h-[580px]",
        ].join(" ")}
      >
        <div className={["hidden lg:absolute lg:grid lg:place-items-center", compactSeats ? "lg:inset-[29%]" : "lg:inset-[21%]"].join(" ")}>
          <div
            className={[
              "table-phase-core grid aspect-square w-full place-items-center rounded-full border border-[#f1c76e]/30 bg-[#130d0b]/70 text-center shadow-2xl shadow-black/45 backdrop-blur-sm",
              compactSeats ? "max-w-[250px] p-5" : "max-w-[340px] p-8",
            ].join(" ")}
          >
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-[#ad9c7d]">Room Phase</div>
              <div className={["mt-3 font-semibold text-[#f1d796]", compactSeats ? "text-3xl" : "text-4xl"].join(" ")}>第 {game.day} 天</div>
              <div className={["mt-3 text-[#f7ead5]", compactSeats ? "text-base" : "text-lg"].join(" ")}>{game.phaseLabel}</div>
              <div className="mt-5 flex justify-center gap-2 text-xs">
                <StatusPill tone="green">存活 {aliveCount}</StatusPill>
                <StatusPill tone="red">出局 {deadCount}</StatusPill>
              </div>
            </div>
          </div>
        </div>

        {game.seats.map((seat) => (
          <SeatToken
            key={seat.seatId}
            game={game}
            seat={seat}
            activeVoice={activeVoice}
            orbitStyle={getSeatOrbitStyle(seat.seatId, game.seats.length)}
            compact={compactSeats}
          />
        ))}
      </div>

      <div className="relative z-20 mt-4 lg:mt-7 xl:mt-8">
        <SpeechFeed game={game} liveAiSpeech={liveAiSpeech} variant="table" />
      </div>
    </section>
  );
}

function SeatToken({
  game,
  seat,
  activeVoice,
  orbitStyle,
  compact,
}: {
  game: HumanGameView;
  seat: HumanGameView["seats"][number];
  activeVoice?: SeatVoiceActivity;
  orbitStyle: SeatOrbitStyle;
  compact: boolean;
}) {
  const isCurrent = game.currentActorSeatId === seat.seatId;
  const isSpeaking = game.currentSpeakerSeatId === seat.seatId;
  const voiceState = activeVoice?.seatId === seat.seatId ? activeVoice.state : undefined;
  const isVoiceActive = Boolean(voiceState);
  const currentLabel = voiceState ? voiceStateLabel(voiceState) : isSpeaking ? "发言中" : isCurrent ? "行动中" : undefined;
  const cardImage = getSeatCardImage(seat);
  const isKnown = Boolean(seat.role);
  const isSheriffBadgeHolder = game.sheriff?.badgeHolder?.seatId === seat.seatId;
  const hasAiAvatar = Boolean(seat.avatarDataUrl);
  const isModelCard = seat.isAi && !hasAiAvatar && Boolean(MODEL_CARD_IMAGES[seat.personaName ?? seat.name]);
  const seatStyle = { ...orbitStyle, "--seat-index": seat.seatId - 1 } as React.CSSProperties & Record<
    "--seat-x" | "--seat-y" | "--seat-index",
    string | number
  >;

  return (
    <div
      style={seatStyle}
      className={[
        "seat-token group min-w-0",
        compact
          ? "lg:absolute lg:left-[var(--seat-x)] lg:top-[var(--seat-y)] lg:w-[128px] lg:-translate-x-1/2 lg:-translate-y-1/2 xl:w-[136px]"
          : "lg:absolute lg:left-[var(--seat-x)] lg:top-[var(--seat-y)] lg:w-[148px] lg:-translate-x-1/2 lg:-translate-y-1/2",
      ].join(" ")}
    >
      <div
        className={[
          "seat-token-shell border bg-[#180f0c]/88 shadow-xl shadow-black/35 backdrop-blur-md",
          compact ? "rounded-xl" : "rounded-2xl",
          compact ? "p-1.5" : "p-2",
          seat.alive ? "border-[#f1c76e]/28" : "border-[#8b4a3d]/55 opacity-75",
          isVoiceActive
            ? `seat-token-voice seat-token-voice-${voiceState} ring-2 ring-[#77d898]`
            : isSpeaking
              ? "ring-2 ring-[#77d898]"
              : isCurrent
                ? "ring-2 ring-[#f1d796]"
                : "",
          isVoiceActive || isSpeaking || isCurrent ? "seat-token-active" : "",
          seat.isHuman ? "bg-[#25130f]/92" : "",
        ].join(" ")}
      >
        <div
          className={
            compact
              ? "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2"
              : "flex flex-col items-center gap-2"
          }
        >
        <div
          className={[
            "relative shrink-0 overflow-hidden border bg-cover bg-center shadow-lg",
            compact ? "h-[42px] w-[31px] rounded-md" : "h-[70px] w-[48px] rounded-lg",
            seat.alive ? "border-[#f1c76e]/45" : "border-[#8b4a3d]/70 grayscale",
            hasAiAvatar ? "bg-[#0d2118]" : "",
          ].join(" ")}
          style={hasAiAvatar ? undefined : { backgroundImage: `url(${cardImage})` }}
          aria-label={
            hasAiAvatar
              ? `${seat.name}AI牌`
              : isModelCard
                ? `${seat.personaName ?? seat.name}模型牌`
                : isKnown
                  ? `${seat.roleLabel}身份牌`
                  : "未揭晓身份牌"
          }
        >
          {hasAiAvatar && <CustomAvatarCardArt src={cardImage} />}
          {!isKnown && !isModelCard && !hasAiAvatar && <div className="absolute inset-0 bg-black/10" />}
        </div>
        <div className={["min-w-0 flex-1", compact ? "text-left" : "text-center lg:w-full"].join(" ")}>
          <div className={["flex items-center", compact ? "justify-start gap-1" : "justify-center gap-2"].join(" ")}>
            <span className={["rounded-full bg-black/35 py-0.5 text-[#f1d796]", compact ? "px-1.5 text-[10px]" : "px-2 text-[11px]"].join(" ")}>{seat.seatId}号</span>
            {seat.isHuman && (
              <span className={["rounded-full bg-[#b74332] py-0.5 text-white", compact ? "px-1.5 text-[10px]" : "px-2 text-[11px]"].join(" ")}>我</span>
            )}
            {isSheriffBadgeHolder && (
              <span className={["rounded-full bg-[#f1c76e] py-0.5 text-[#2b1608]", compact ? "px-1.5 text-[10px]" : "px-2 text-[11px]"].join(" ")}>
                警长
              </span>
            )}
          </div>
          <div className={["flex flex-wrap items-center gap-1", compact ? "mt-1 justify-start" : "mt-2 justify-center"].join(" ")}>
            <span className={["min-w-0 truncate font-semibold text-[#f7ead5]", compact ? "max-w-[86px] text-[11px]" : "max-w-[132px] text-sm"].join(" ")}>
              {seat.name}
            </span>
            {seat.personaModelLabel && (
              <span
                className={[
                  "max-w-full truncate rounded-full border border-[#7da8e3]/18 bg-[#0d1623]/58 text-[#b8d6ff]",
                  compact ? "px-1 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]",
                ].join(" ")}
                title={seat.personaModelLabel}
              >
                {seat.personaModelLabel}
              </span>
            )}
          </div>
          <div className={["flex flex-wrap gap-1 leading-4", compact ? "mt-0.5 justify-start text-[9px]" : "mt-1 justify-center text-[11px]"].join(" ")}>
            <span className={seat.alive ? "text-[#9fe0a4]" : "text-[#ffb1a4]"}>{seat.alive ? "存活" : "出局"}</span>
            {seat.roleLabel && <span className="text-[#f1d796]">{seat.roleLabel}</span>}
            {seat.deathReason && <span className="text-[#c8b99a]">{DEATH_LABELS[seat.deathReason]}</span>}
            {currentLabel && <span className="text-[#f1d796]">{currentLabel}</span>}
          </div>
          {isVoiceActive && (
            <div className={`voice-wave voice-wave-${voiceState} mt-2 flex h-4 items-end justify-center gap-1`} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function voiceStateLabel(state: SeatVoiceState): string {
  if (state === "loading" || state === "generating") return "生成中";
  if (state === "paused") return "已暂停";
  return "播放中";
}

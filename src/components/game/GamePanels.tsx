"use client";

import Image from "next/image";
import Link from "next/link";
import type * as React from "react";
import { DEATH_LABELS } from "@/game/labels";
import type { HumanGameView } from "@/game/types";
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
export { GlossaryOverlay, IdentityBookOverlay, IdiotRevealOverlay, RoleIntroOverlay, buildIdiotRevealCue } from "./RoleKnowledgePanels";
export type { IdiotRevealCue } from "./RoleKnowledgePanels";

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

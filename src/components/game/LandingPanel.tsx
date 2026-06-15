"use client";

import Link from "next/link";
import { useState } from "react";
import type { AiRuntimeMode } from "@/game/types";
import type { AiLineupPreviewItem, BoardOption, HumanSeatMode } from "./clientTypes";
import type { ClassTrialThemeMode } from "./classTrialTheme";
import { HomepageDesktopLobby } from "./HomepageDesktopLobby";
import { buildHomepageBoardCards, HOME_BOARD_ART_BY_ID } from "./homepageBoardModel";
import { StatusPill } from "./PanelPrimitives";
import {
  buildMobileLobbySeatIds,
  getMobileLobbySeatDensityClass,
  getMobileLobbySeatStyle,
} from "./LandingLobbyControls";
import { AiLineupPreviewCard, AiPoolEntryCard, getLineupAvatarImage, RecentGamesCard, RulesMiniCard } from "./LandingRailCards";

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
  onOpenIdentityBook = () => undefined,
  onOpenGlossary = () => undefined,
  classTrialThemeMode = "default",
  classTrialAiRuntimeMode = "mock",
  classTrialPackAvailable = false,
  classTrialPackMessage = "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。",
  classTrialIntroMessage,
  onSelectClassTrialThemeMode = () => undefined,
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
  onOpenIdentityBook?: () => void;
  onOpenGlossary?: () => void;
  classTrialThemeMode?: ClassTrialThemeMode;
  classTrialAiRuntimeMode?: AiRuntimeMode;
  classTrialPackAvailable?: boolean;
  classTrialPackMessage?: string;
  classTrialIntroMessage?: string;
  onSelectClassTrialThemeMode?: (mode: ClassTrialThemeMode) => void;
}) {
  const [mobileBoardsOpen, setMobileBoardsOpen] = useState(false);
  const selectedBoard = selectedBoardId ? boards.find((board) => board.id === selectedBoardId) : undefined;
  const humanModeLabel = !selectedBoard
    ? "待选板子"
    : humanSeatMode === "none"
      ? "纯 AI 观战"
      : selectedHumanSeatId
        ? `${selectedHumanSeatId}号真人`
        : "随机真人座位";
  const aiSummaryLabel = selectedAiFriendCount > 0 ? `${selectedAiFriendCount} 位 AI 入局` : "默认 AI 阵容";
  const lobbySeatIds = buildMobileLobbySeatIds(selectedBoard?.seatCount ?? 6);
  const lobbySeatDensityClass = getMobileLobbySeatDensityClass(lobbySeatIds.length);
  const lobbyLineupBySeatId = new Map(aiLineupPreview.map((friend) => [friend.seatId, friend]));
  const recommendedBoardCards = buildHomepageBoardCards(boards);
  const mobileBoardCards =
    recommendedBoardCards.length > 0
      ? recommendedBoardCards
      : boards.map((board) => ({
          board,
          badge: board.seatCount <= 6 ? "新手友好" : board.seatCount >= 12 ? "高压进阶" : "进阶标准",
          displayTitle: board.name,
          displaySubtitle: `${board.seatCount}人局`,
          tone: "classic" as const,
          art: HOME_BOARD_ART_BY_ID["6p-beginner-seer"],
        }));
  const selectedBoardArt =
    mobileBoardCards.find((card) => card.board.id === selectedBoard?.id)?.art.src ?? HOME_BOARD_ART_BY_ID["6p-beginner-seer"].src;
  const visibleAiFriends = aiLineupPreview.filter((friend) => !friend.isHuman);
  const requiredAiFriendCount = selectedBoard ? Math.max(0, selectedBoard.seatCount - (humanSeatMode === "none" ? 0 : 1)) : selectedAiFriendCount;
  const tableAiFriendCount = visibleAiFriends.length > 0 ? visibleAiFriends.length : Math.min(selectedAiFriendCount, requiredAiFriendCount);
  const selectMobileBoard = (boardId: string) => {
    onSelectBoard(boardId);
    setMobileBoardsOpen(false);
  };

  return (
    <>
      <div className="hidden lg:block">
        <HomepageDesktopLobby
          loading={loading}
          boards={boards}
          selectedBoardId={selectedBoardId}
          onSelectBoard={onSelectBoard}
          humanSeatMode={humanSeatMode}
          selectedHumanSeatId={selectedHumanSeatId}
          onSelectRandomHumanSeat={onSelectRandomHumanSeat}
          onSelectFixedHumanSeat={onSelectFixedHumanSeat}
          onSelectNoHumanSeat={onSelectNoHumanSeat}
          selectedAiFriendCount={selectedAiFriendCount}
          customAiFriendCount={customAiFriendCount}
          aiLineupPreview={aiLineupPreview}
          recentGameIds={recentGameIds}
          onLoadGame={onLoadGame}
          onStartGame={onStartGame}
          onOpenIdentityBook={onOpenIdentityBook}
          onOpenGlossary={onOpenGlossary}
          classTrialThemeMode={classTrialThemeMode}
          classTrialAiRuntimeMode={classTrialAiRuntimeMode}
          classTrialPackAvailable={classTrialPackAvailable}
          classTrialPackMessage={classTrialPackMessage}
          classTrialIntroMessage={classTrialIntroMessage}
          onSelectClassTrialThemeMode={onSelectClassTrialThemeMode}
        />
      </div>

      <section className="mobile-home-shell flex flex-1 items-start justify-center py-4 lg:hidden">
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
                  <button
                    key={`${seatId}-${index}`}
                    type="button"
                    onClick={() => onSelectFixedHumanSeat(seatId)}
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
                  </button>
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
              <div className="mobile-dock-board-actions">
                <button
                  type="button"
                  onClick={() => setMobileBoardsOpen(true)}
                  className="mobile-dock-more-board-action"
                >
                  更多对局
                </button>
                <Link
                  href="/ai-pool"
                  className="mobile-dock-ai-pool-action inline-flex shrink-0 items-center justify-center rounded-full border border-[#77d898]/28 bg-[#10271d] px-3 py-1.5 text-xs font-semibold text-[#a8f0b6] shadow-lg shadow-black/20 transition hover:bg-[#183b2a] sm:hidden"
                >
                  AI阵容 {selectedAiFriendCount}位 ›
                </Link>
              </div>
            </div>
            <div className="mobile-board-strip grid gap-3 md:grid-cols-2">
              {mobileBoardCards.map((card) => {
                const board = card.board;
                const selected = selectedBoardId === board.id;
                return (
                  <button
                    key={board.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? `取消选择${board.name}` : `选择${board.name}`}
                    onClick={() => onSelectBoard(board.id)}
                    className={[
                      "mobile-board-chip mobile-board-image-chip group min-h-[148px] rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-[#f1c76e]/68 bg-[#2c2015]/88 shadow-lg shadow-black/24"
                        : "border-white/10 bg-black/20 hover:border-[#f1c76e]/40 hover:bg-[#1c1512]/84",
                    ].join(" ")}
                    style={{ backgroundImage: `url(${card.art.src})` }}
                  >
                    <span className="mobile-board-checkmark" aria-hidden="true">{selected ? "✓" : ""}</span>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-[#f7ead5]">{board.name}</div>
                        <div className="mt-1 text-xs leading-5 text-[#dcc9a7]">{board.seatCount}人局</div>
                      </div>
                      <span
                        className={[
                          "mobile-board-badge shrink-0 rounded-full border px-2 py-0.5 text-xs",
                          selected ? "border-[#f1c76e]/38 bg-[#f1c76e]/12 text-[#f1d796]" : "border-white/12 text-[#ad9c7d]",
                        ].join(" ")}
                      >
                        {selected ? "已选" : card.badge}
                      </span>
                    </div>
                    <div className="mt-3 border-t border-white/8 pt-3 text-xs leading-5 text-[#ad9c7d]">{board.roleSummary}</div>
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

            <section className="mobile-current-selection-card" aria-label="当前选择">
              <div className="mobile-current-selection-header">
                <span>当前选择</span>
                <em>配置有效</em>
              </div>
              <div className="mobile-current-selection-grid">
                <div className="mobile-current-board-art" aria-hidden="true" style={{ backgroundImage: `url(${selectedBoardArt})` }} />
                <div className="mobile-current-board-copy">
                  <span>已选牌板</span>
                  <strong>{selectedBoard ? `${selectedBoard.name} · ${selectedBoard.seatCount}人局` : "待选板子"}</strong>
                  <small>{selectedBoard?.roleSummary ?? "先选择一个板子"}</small>
                </div>
                <div className="mobile-current-metrics-row">
                  <div className="mobile-current-metric">
                    <span>真人座位</span>
                    <strong>{humanModeLabel}</strong>
                  </div>
                  <div className="mobile-current-metric">
                    <span>AI 阵容</span>
                    <strong>{tableAiFriendCount}/{requiredAiFriendCount}</strong>
                  </div>
                </div>
              </div>
            </section>

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
      {mobileBoardsOpen && (
        <div className="mobile-board-picker" role="dialog" aria-modal="true" aria-label="选择更多对局">
          <button
            type="button"
            className="mobile-board-picker-backdrop"
            aria-label="关闭更多对局"
            onClick={() => setMobileBoardsOpen(false)}
          />
          <section className="mobile-board-picker-panel">
            <div className="mobile-board-picker-grip" />
            <div className="mobile-board-picker-head">
              <div>
                <span>全部对局</span>
                <strong>选择更多板子</strong>
              </div>
              <button type="button" onClick={() => setMobileBoardsOpen(false)}>
                关闭
              </button>
            </div>
            <div className="mobile-board-picker-list">
              {boards.map((board) => {
                const selected = board.id === selectedBoardId;
                return (
                  <button
                    key={board.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectMobileBoard(board.id)}
                    className={selected ? "mobile-board-picker-item mobile-board-picker-item-selected" : "mobile-board-picker-item"}
                  >
                    <span>{board.seatCount}人</span>
                    <strong>{board.name}</strong>
                    <small>{board.roleSummary}</small>
                    <em>{selected ? "已选" : "选择"}</em>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      </section>
    </>
  );
}

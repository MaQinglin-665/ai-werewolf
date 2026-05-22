"use client";

import Image from "next/image";
import Link from "next/link";
import type * as React from "react";
import type { AiLineupPreviewItem, BoardOption, HumanSeatMode } from "./clientTypes";
import { StatusPill } from "./PanelPrimitives";
import { CustomAvatarCardArt } from "./CustomAvatarCardArt";
import { MODEL_CARD_IMAGES } from "./viewHelpers";

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

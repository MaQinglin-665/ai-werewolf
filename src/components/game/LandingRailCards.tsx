"use client";

import Link from "next/link";
import type { AiLineupPreviewItem } from "./clientTypes";
import { CustomAvatarCardArt } from "./CustomAvatarCardArt";
import { MODEL_CARD_IMAGES } from "./viewHelpers";

export function getLineupAvatarImage(friend: AiLineupPreviewItem): string | undefined {
  return friend.avatarDataUrl ?? (friend.personaName ? MODEL_CARD_IMAGES[friend.personaName] : undefined);
}

export function AiLineupPreviewCard({ lineup }: { lineup: AiLineupPreviewItem[] }) {
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

export function AiPoolEntryCard({ selectedCount, customCount }: { selectedCount: number; customCount: number }) {
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

export function RulesMiniCard() {
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

export function RecentGamesCard({
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

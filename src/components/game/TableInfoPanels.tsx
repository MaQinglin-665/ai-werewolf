"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/game/labels";
import type { HumanGameView } from "@/game/types";
import { InfoRow } from "./PanelPrimitives";
import { ROLE_CARD_IMAGES, formatSystemMessage } from "./viewHelpers";

type AuxiliaryInfoTab = "private" | "notes" | "log";

export function AuxiliaryInfoPanel({
  game,
  events,
  initialTab = "private",
}: {
  game: HumanGameView;
  events: HumanGameView["publicEvents"];
  initialTab?: AuxiliaryInfoTab;
}) {
  const [activeTab, setActiveTab] = useState<AuxiliaryInfoTab>(initialTab);
  const eventCount = events.length;
  const tabs: Array<{ key: AuxiliaryInfoTab; label: string; meta: string }> = [
    { key: "private", label: "私密", meta: game.myRoleLabel ?? "观战" },
    { key: "notes", label: "局势", meta: "公开线" },
    { key: "log", label: "记录", meta: eventCount > 0 ? `${eventCount} 条` : "暂无" },
  ];

  return (
    <section className="aux-info-panel overflow-hidden rounded-[24px] border border-[#f1c76e]/22 bg-[#130d0b]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="border-b border-[#f1c76e]/15 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#f7ead5]">辅助信息</h2>
          <span className="text-xs text-[#ad9c7d]">局内辅助层</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-[#f1c76e]/14 bg-black/20 p-1">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "box-border h-14 min-w-0 rounded-full px-2 text-center text-xs leading-tight transition-colors duration-150",
                  selected
                    ? "bg-[#f1c76e]/16 text-[#f1d796]"
                    : "text-[#ad9c7d] hover:bg-white/6 hover:text-[#f7ead5]",
                ].join(" ")}
              >
                <span className="block font-semibold">{tab.label}</span>
                <span className="mt-0.5 block truncate text-[10px] opacity-70">{tab.meta}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {activeTab === "private" && <InfoPanel game={game} embedded />}
        {activeTab === "notes" && <TableNotesPanel game={game} embedded />}
        {activeTab === "log" && <PublicLog game={game} events={events} embedded />}
      </div>
    </section>
  );
}

export function TableNotesPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
  const memory = game.tableSummary.tableMemory;
  const latestVote = memory.voteHistory.at(-1);

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-[#8fd29a]/15 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#dff4df]">局势笔记</h2>
          <a href="#private-info" className="text-xs text-[#a8f0b6] underline-offset-4 hover:underline">
            我的私密信息
          </a>
        </div>
      )}
      {embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#dff4df]">局势笔记</h3>
          <span className="text-xs text-[#9ecfac]">公开辅助线</span>
        </div>
      )}
      <div className={`${embedded ? "grid gap-4 text-sm text-[#dff4df]" : "grid gap-4 p-4 text-sm text-[#dff4df]"}`}>
        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">站边时间线</div>
          {memory.stanceBoard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无明确站边
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.stanceBoard.slice(-5).map((stance) => (
                <div key={stance.stanceId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2 text-xs leading-5">
                  D{stance.day} · {stance.actor.seatId}号{stance.kindLabel}
                  {stance.target.seatId}号{stance.targetRoleLabel ? `的${stance.targetRoleLabel}` : ""}
                </div>
              ))}
            </div>
          )}
          {memory.stanceShifts.length > 0 && (
            <div className="mt-2 grid gap-2">
              {memory.stanceShifts.slice(-2).map((shift) => (
                <div key={`${shift.actor.seatId}-${shift.target.seatId}-${shift.toDay}`} className="rounded-2xl border border-[#e46d55]/20 bg-[#2b1110]/42 px-3 py-2 text-xs leading-5 text-[#ffd8cf]">
                  {shift.actor.seatId}号改口：{shift.fromKindLabel} → {shift.toKindLabel} {shift.target.seatId}号
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">当前焦点</div>
          {memory.focus.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无明显公开焦点
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.focus.slice(0, 3).map((item) => (
                <div key={item.seat.seatId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.seat.seatId}号 · {item.seat.name}</span>
                    <span className="text-xs text-[#9ecfac]">{item.score}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#9ecfac]">{item.reasons.join("、")}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">公开推理线索</div>
          {memory.reasoningCues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无可复盘的公开推理线索
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.reasoningCues.slice(0, 4).map((cue) => (
                <div key={cue.cueId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2 text-xs leading-5">
                  <div className="font-semibold text-[#dff4df]">{cue.summary}</div>
                  {cue.evidence[0] && <div className="mt-1 text-[#9ecfac]">{cue.evidence[0]}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">公开票数历史</div>
          {!latestVote || latestVote.tally.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无已公开票数
            </div>
          ) : (
            <div className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2 text-xs leading-5 text-[#dff4df]">
              D{latestVote.day} · {latestVote.tally.map((item) => `${item.target.seatId}号${item.count}票`).join("，")}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#8fd29a]/25 bg-[#0f2118]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      {content}
    </section>
  );
}

export function InfoPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
  if (!game.myRole) {
    const spectatorContent = (
      <div className="grid gap-3 text-sm text-[#dcc9a7]">
        <div className="rounded-2xl border border-[#7da8e3]/20 bg-[#0d1623]/46 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#e4efff]">观战模式</h2>
          <p className="mt-2 text-xs leading-5 text-[#b8d6ff]">
            本局没有真人座位，所有玩家由 AI 控制。身份信息会在终局复盘中揭晓。
          </p>
        </div>
        {game.sheriff?.badgeHolder && (
          <InfoRow label="警徽">{game.sheriff.badgeHolder.seatId}号持有警徽，白天放逐投票计 1.5 票</InfoRow>
        )}
      </div>
    );

    if (embedded) return <div id="private-info">{spectatorContent}</div>;

    return (
      <section id="private-info" className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
        {spectatorContent}
      </section>
    );
  }

  const content = (
    <>
      <div className={embedded ? "flex items-start gap-3" : "flex items-start gap-4"}>
        <div
          className={[
            embedded ? "h-28 w-20" : "h-36 w-24",
            "shrink-0 rounded-xl border border-[#f1c76e]/35 bg-cover bg-center shadow-xl",
          ].join(" ")}
          style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[game.myRole]})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#f7ead5]">我的身份</h2>
            {game.result && (
              <span className="rounded-full bg-[#b74332] px-2 py-1 text-xs font-medium text-white">
                {game.result.winner === "GOOD" ? "好人胜利" : "狼人胜利"}
              </span>
            )}
          </div>
          <div className="mt-2 text-3xl font-semibold text-[#f1d796]">{ROLE_LABELS[game.myRole]}</div>
          <div className="mt-3 text-xs leading-5 text-[#ad9c7d]">
            你的私密信息只在这里展示，其他 AI 身份会在终局复盘中揭晓。
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-[#dcc9a7]">
        {game.wolfTeammates.length > 0 && (
          <InfoRow label="狼队友">{game.wolfTeammates.map((seat) => seat.name).join("、")}</InfoRow>
        )}
        {game.seerChecks.length > 0 && (
          <InfoRow label="查验">
            {game.seerChecks.map((check) => (
              <div key={`${check.day}-${check.targetSeatId}`}>
                D{check.day} · {check.targetSeatId}号 · {check.result === "WEREWOLF" ? "狼人" : "好人"}
              </div>
            ))}
          </InfoRow>
        )}
        {game.myRole === "WITCH" && (
          <InfoRow label="药品">
            解药 {game.witch?.antidoteAvailable ? "可用" : "已用"} · 毒药 {game.witch?.poisonAvailable ? "可用" : "已用"}
          </InfoRow>
        )}
        {game.myRole === "GUARD" && (
          <InfoRow label="守卫">
            {game.guard?.lastGuardedSeatId ? `上一晚守护 ${game.guard.lastGuardedSeatId}号` : "尚未守护任何玩家"}
          </InfoRow>
        )}
        {game.sheriff?.badgeHolder && (
          <InfoRow label="警徽">{game.sheriff.badgeHolder.seatId}号持有警徽，白天放逐投票计 1.5 票</InfoRow>
        )}
        {game.privateEvents.slice(-4).map((event) => (
          <div key={event.seq} className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 px-3 py-2 text-[#dcc9a7]">
            {formatSystemMessage(game, event.message)}
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return <div id="private-info">{content}</div>;

  return (
    <section id="private-info" className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      {content}
    </section>
  );
}

export function PublicLog({
  game,
  events,
  embedded = false,
}: {
  game: HumanGameView;
  events: HumanGameView["publicEvents"];
  embedded?: boolean;
}) {
  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-[#f1c76e]/15 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#f7ead5]">公开记录</h2>
          <span className="text-xs text-[#ad9c7d]">夜晚 / 白天 / 投票 / 系统</span>
        </div>
      )}
      {embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#f7ead5]">公开记录</h3>
          <span className="text-xs text-[#ad9c7d]">夜晚 / 白天 / 投票</span>
        </div>
      )}
      <div className={`${embedded ? "flex max-h-[420px] flex-col gap-3 overflow-y-auto" : "flex max-h-[620px] flex-col gap-3 overflow-y-auto p-4"}`}>
        {events.map((event) => (
          <div key={event.seq} className={`${eventClassName(event.phase)} rounded-2xl border px-3 py-2 text-sm leading-6`}>
            <div className="mb-1 text-xs opacity-75">
              D{event.day} · {phaseCategory(event.phase)}
            </div>
            {formatSystemMessage(game, event.message)}
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <section className="min-h-[360px] overflow-hidden rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 shadow-2xl shadow-black/35 backdrop-blur-md">
      {content}
    </section>
  );
}

function eventClassName(phase: HumanGameView["phase"]): string {
  if (phase.startsWith("NIGHT")) return "border-[#6797d5]/25 bg-[#0d1623]/65 text-[#d8e6f7]";
  if (phase === "DAY_VOTE" || phase === "EXILE_RESOLUTION" || phase === "LAST_WORDS" || phase === "SHERIFF_HANDOFF") return "border-[#e46d55]/30 bg-[#2b1110]/70 text-[#ffd8cf]";
  if (phase.startsWith("SHERIFF")) return "border-[#f1c76e]/25 bg-[#3a2412]/65 text-[#f1d796]";
  if (phase === "DAY_SPEECH") return "border-[#77d898]/25 bg-[#0f2118]/70 text-[#dff4df]";
  return "border-[#f1c76e]/25 bg-[#261510]/65 text-[#dcc9a7]";
}

function phaseCategory(phase: HumanGameView["phase"]): string {
  if (phase.startsWith("NIGHT")) return "夜晚";
  if (phase === "DAY_SPEECH") return "白天";
  if (phase === "DAY_VOTE" || phase === "EXILE_RESOLUTION" || phase === "LAST_WORDS") return "投票";
  if (phase.startsWith("SHERIFF")) return "警长";
  return "系统";
}

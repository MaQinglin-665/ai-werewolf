"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABELS } from "@/game/labels";
import type { HumanGameView } from "@/game/types";
import type { CommandPayload, LiveAiSpeech, SpeechItem } from "./clientTypes";
import { InfoRow } from "./PanelPrimitives";
import { ROLE_CARD_IMAGES, formatSystemMessage, seatNumber } from "./viewHelpers";

type AuxiliaryInfoTab = "private" | "notes" | "log";

export function AuxiliaryInfoPanel({ game, events }: { game: HumanGameView; events: HumanGameView["publicEvents"] }) {
  const [activeTab, setActiveTab] = useState<AuxiliaryInfoTab>("private");
  const memory = game.tableSummary.tableMemory;
  const claimCount = memory.claimBoard.length;
  const eventCount = events.length;
  const tabs: Array<{ key: AuxiliaryInfoTab; label: string; meta: string }> = [
    { key: "private", label: "私密", meta: game.myRoleLabel ?? "观战" },
    { key: "notes", label: "局势", meta: claimCount > 0 ? `${claimCount} 声明` : "公开线" },
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
          <div className="mb-2 text-xs text-[#9ecfac]">身份声明</div>
          {memory.claimBoard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无玩家公开声称身份
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.claimBoard.slice(0, 5).map((claim) => (
                <div key={claim.claimId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#f7ead5]">
                      {claim.claimant.seatId}号 · {claim.claimant.name}
                    </span>
                    <span className="rounded-full bg-[#8fd29a]/12 px-2 py-0.5 text-xs text-[#a8f0b6]">
                      {claim.strength === "hard" ? "明确声称" : "软声明"}{claim.claimedRoleLabel}
                    </span>
                  </div>
                  {claim.checks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {claim.checks.map((check) => (
                        <span key={`${claim.claimId}-${check.day}-${check.target.seatId}-${check.result}`} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-xs text-[#dff4df]">
                          D{check.day} 报{check.target.seatId}号{check.result === "WEREWOLF" ? "查杀" : "金水"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {memory.counterclaims.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-[#9ecfac]">对跳关系</div>
            <div className="grid gap-2">
              {memory.counterclaims.map((group) => (
                <div key={group.claimedRole} className="rounded-2xl border border-[#e46d55]/20 bg-[#2b1110]/42 px-3 py-2 text-[#ffd8cf]">
                  {group.claimedRoleLabel}：{group.claimants.map((seat) => `${seat.seatId}号`).join("、")}
                </div>
              ))}
            </div>
          </div>
        )}

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

export function SpeechFeed({
  game,
  liveAiSpeech,
  variant = "sidebar",
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  variant?: "sidebar" | "table";
}) {
  const speeches = game.tableSummary.recentSpeeches;
  const activeLiveAiSpeech =
    liveAiSpeech &&
    !speeches.some(
      (speech) =>
        speech.speaker?.seatId === liveAiSpeech.speaker.seatId &&
        liveAiSpeech.text &&
        speech.message.startsWith(liveAiSpeech.text),
    )
      ? liveAiSpeech
      : null;
  const currentSpeaker = game.currentSpeakerSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;
  const isTableVariant = variant === "table";
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [activeLiveAiSpeech?.text, speeches.length]);

  return (
    <section
      className={[
        "overflow-hidden rounded-[24px] border border-[#77d898]/25 bg-[#0f2118]/82 shadow-2xl shadow-black/35 backdrop-blur-md",
        isTableVariant ? "table-speech-feed" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-[#77d898]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#dff4df]">发言席</h2>
        <span className="text-xs text-[#9ecfac]">
          {currentSpeaker ? `当前：${seatNumber(currentSpeaker)}` : game.phase === "DAY_SPEECH" ? "等待发言" : "非发言阶段"}
        </span>
      </div>
      <div
        ref={scrollRef}
        className={[
          "grid gap-3 overflow-y-auto p-4",
          isTableVariant ? "max-h-[280px] lg:max-h-[260px]" : "max-h-[300px]",
        ].join(" ")}
      >
        {speeches.length === 0 && !activeLiveAiSpeech ? (
          <div className="rounded-2xl border border-dashed border-[#77d898]/20 px-3 py-6 text-center text-sm text-[#9ecfac]">
            暂无公开发言
          </div>
        ) : (
          <>
            {speeches.map((speech, index) => {
              const isHuman = speech.speaker?.seatId === game.humanSeatId;
              const startsNewDay = speeches[index - 1]?.day !== speech.day;
              const claims = speech.speaker
                ? game.tableSummary.claimBoard.filter(
                    (claim) => claim.claimant.seatId === speech.speaker?.seatId && claim.sourceSpeechSeq === speech.seq,
                  )
                : [];

              return (
                <SpeechFeedItem
                  key={`speech-day-block-${speech.seq}`}
                  claims={claims}
                  day={speech.day}
                  isHuman={isHuman}
                  isStreaming={false}
                  message={speech.message}
                  speaker={speech.speaker}
                  startsNewDay={startsNewDay && index > 0}
                />
              );
            })}
            {activeLiveAiSpeech && <LiveSpeechFeedItem liveAiSpeech={activeLiveAiSpeech} />}
          </>
        )}
      </div>
    </section>
  );
}

function SpeechFeedItem({
  claims,
  day,
  isHuman,
  isStreaming,
  message,
  speaker,
  startsNewDay,
}: {
  claims: HumanGameView["tableSummary"]["claimBoard"];
  day: number;
  isHuman: boolean;
  isStreaming: boolean;
  message: string;
  speaker: SpeechItem["speaker"];
  startsNewDay: boolean;
}) {
  return (
    <div className={["grid gap-2", startsNewDay ? "pt-3" : ""].filter(Boolean).join(" ")}>
      {startsNewDay && (
        <div className="flex items-center gap-3" aria-label={`第${day}天发言`}>
          <div className="h-px flex-1 bg-[#77d898]/16" />
          <span className="rounded-full border border-[#77d898]/22 bg-[#14311f]/72 px-3 py-1 text-[11px] font-semibold text-[#a8f0b6] shadow-sm shadow-black/20">
            第 {day} 天发言
          </span>
          <div className="h-px flex-1 bg-[#77d898]/16" />
        </div>
      )}
      <div
        className={[
          "rounded-2xl border px-3 py-2 text-sm leading-6",
          startsNewDay ? "border-t-[#77d898]/45" : "",
          isHuman ? "border-[#f1c76e]/30 bg-[#2b2110]/75 text-[#f7ead5]" : "border-[#77d898]/18 bg-black/22 text-[#dff4df]",
        ].join(" ")}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
          <span className="min-w-0">{speaker ? `${speaker.seatId}号 · ${speaker.name}` : "未知发言人"}</span>
          <span>D{day}</span>
        </div>
        {claims.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {claims.map((claim) => (
              <span key={claim.claimId} className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2 py-0.5 text-[11px] text-[#a8f0b6]">
                玩家声称{claim.claimedRoleLabel}
              </span>
            ))}
          </div>
        )}
        <span>{message}</span>
        {isStreaming && <span className="speech-stream-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

function LiveSpeechFeedItem({ liveAiSpeech }: { liveAiSpeech: LiveAiSpeech }) {
  return (
    <div className="rounded-2xl border border-[#77d898]/35 bg-[#0a2a1a]/72 px-3 py-2 text-sm leading-6 text-[#dff4df] shadow-lg shadow-black/20">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
        <span className="min-w-0">
          {liveAiSpeech.speaker.seatId}号 · {liveAiSpeech.speaker.name}
        </span>
        <span>生成中</span>
      </div>
      <span>{liveAiSpeech.text || "正在组织发言..."}</span>
      <span className="speech-stream-cursor" aria-hidden="true" />
    </div>
  );
}

export function VoteTable({
  game,
  loading,
  pendingCommandType,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
}) {
  const sheriffSnapshot = game.tableSummary.sheriffVoteSnapshot;
  const isSheriffVoteInProgress = game.phase === "SHERIFF_VOTE" || game.phase === "SHERIFF_PK_VOTE";
  const shouldShowSheriffSnapshot =
    Boolean(sheriffSnapshot) &&
    (isSheriffVoteInProgress || (!game.tableSummary.voteSnapshot.revealed && game.tableSummary.voteSnapshot.tally.length === 0));
  const snapshot = shouldShowSheriffSnapshot ? sheriffSnapshot! : game.tableSummary.voteSnapshot;
  const voteKind: "exile" | "sheriff" = shouldShowSheriffSnapshot ? "sheriff" : "exile";
  const isVoteInProgress = voteKind === "sheriff" ? isSheriffVoteInProgress : game.phase === "DAY_VOTE";
  const aliveSeats = game.seats.filter((seat) => seat.alive);
  const candidateSeatIds = new Set(getSheriffVoteCandidateIds(game));
  const pendingVoteSeats =
    voteKind === "sheriff" && candidateSeatIds.size > 0
      ? aliveSeats.filter((seat) => !candidateSeatIds.has(seat.seatId))
      : aliveSeats;
  const maxVotes = snapshot.tally[0]?.count ?? 0;
  const statusLabel = isVoteInProgress
    ? voteKind === "sheriff"
      ? "警长票封存"
      : "票箱封存"
    : snapshot.leaders.length > 1
      ? `平票：${snapshot.leaders.map((seat) => `${seat.seatId}号`).join("、")}`
      : snapshot.leaders.length === 1
        ? voteKind === "sheriff"
          ? `警长：${snapshot.leaders[0].seatId}号`
          : `焦点：${snapshot.leaders[0].seatId}号`
        : "暂无票型";
  const sectionLabel = voteKind === "sheriff" ? (game.phase === "SHERIFF_PK_VOTE" ? "警长 PK 票" : "警长投票") : "放逐投票";

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e46d55]/25 bg-[#2b1110]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#e46d55]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#ffd8cf]">投票台</h2>
        <span className="text-xs text-[#d9a099]">{statusLabel}</span>
      </div>

      <div className="grid gap-3 p-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[#d9a099]">
            <span>{snapshot.revealed ? "开票结果" : "投票状态"}</span>
            <span>{sectionLabel}</span>
          </div>
          {loading && pendingCommandType === (voteKind === "sheriff" ? "sheriffVote" : "vote") ? (
            <div className="vote-sealed-card rounded-2xl border border-[#77d898]/24 bg-[#14311f]/55 px-3 py-4">
              <div className="text-center text-sm font-semibold text-[#a8f0b6]">你已锁票</div>
              <div className="mt-1 text-center text-xs text-[#9ecfac]">等待其他玩家完成投票，开票前不显示任何人的投票对象。</div>
            </div>
          ) : isVoteInProgress ? (
            <div className="vote-sealed-card rounded-2xl border border-dashed border-[#e46d55]/22 bg-black/18 px-3 py-4">
              <div className="text-center text-sm font-semibold text-[#ffd8cf]">
                {voteKind === "sheriff" ? "等待警下玩家锁票" : "等待所有玩家锁票"}
              </div>
              <div className="mt-1 text-center text-xs text-[#d9a099]">
                {voteKind === "sheriff" ? "警长票不会实时公开，结束后一次性揭晓。" : "票型不会实时公开，进入结算后一次性揭晓。"}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {pendingVoteSeats.map((seat, index) => (
                  <span
                    key={seat.seatId}
                    style={{ animationDelay: `${index * 64}ms` }}
                    className="vote-sealed-chip rounded-full border border-[#e46d55]/14 bg-[#351210]/42 px-2 py-1 text-center text-xs text-[#ffd8cf]/72"
                  >
                    {seat.seatId}号
                  </span>
                ))}
              </div>
            </div>
          ) : snapshot.tally.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e46d55]/20 px-3 py-5 text-center text-sm text-[#d9a099]">
              {snapshot.revealed ? (voteKind === "sheriff" ? "无人获得警长票" : "无人获得放逐票") : "还没有公开票数"}
              {snapshot.abstainCount ? `，弃票 ${snapshot.abstainCount} 票` : ""}
            </div>
          ) : (
            <div className="grid gap-2">
              <VoteResultBanner snapshot={snapshot} kind={voteKind} />
              {snapshot.tally.map((item) => (
                <div
                  key={item.target.seatId}
                  className={[
                    "vote-reveal-card rounded-2xl border px-3 py-2",
                    snapshot.leaders.some((seat) => seat.seatId === item.target.seatId)
                      ? "border-[#ff9a6b]/34 bg-[#351210]/58"
                      : "border-[#e46d55]/18 bg-black/22",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3 text-sm text-[#ffd8cf]">
                    <span>
                      {item.target.seatId}号
                    </span>
                    <strong>{item.count} 票</strong>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                    <div
                      className="vote-reveal-bar h-full rounded-full bg-[#e46d55]"
                      style={{ width: `${maxVotes > 0 ? Math.max(12, (item.count / maxVotes) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {snapshot.abstainCount ? (
                <div className="rounded-2xl border border-[#f1c76e]/18 bg-black/18 px-3 py-2 text-sm text-[#f1d796]">
                  弃票 {snapshot.abstainCount} 票
                </div>
              ) : null}
            </div>
          )}
        </div>

        {snapshot.votes.length > 0 && <VoteRevealLedger snapshot={snapshot} />}

        {game.result && game.tableSummary.aiReasonHighlights.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-[#d9a099]">局势提示</div>
            <div className="grid gap-2">
              {game.tableSummary.aiReasonHighlights.map((reason) => (
                <div key={reason} className="rounded-2xl bg-black/22 px-3 py-2 text-xs leading-5 text-[#ffd8cf]">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type VoteSnapshotView = HumanGameView["tableSummary"]["voteSnapshot"];

function getSheriffVoteCandidateIds(game: HumanGameView): number[] {
  const sheriff = game.sheriff;
  if (!sheriff) return [];
  const withdrawnSeatIds = new Set(sheriff.withdrawnSeatIds);
  return (game.phase === "SHERIFF_PK_VOTE" ? sheriff.pkCandidates ?? [] : sheriff.candidates)
    .filter((candidate) => !withdrawnSeatIds.has(candidate.seatId))
    .map((candidate) => candidate.seatId);
}

export function VoteResultBanner({
  snapshot,
  compact = false,
  kind = "exile",
}: {
  snapshot: VoteSnapshotView;
  compact?: boolean;
  kind?: "exile" | "sheriff";
}) {
  if (!snapshot.revealed) return null;

  const topVoteCount = snapshot.tally[0]?.count ?? 0;
  const bannerClass = compact
    ? "vote-result-banner rounded-xl border px-3 py-2 text-xs leading-5"
    : "vote-result-banner rounded-2xl border px-3 py-3 text-sm leading-6";

  if (topVoteCount === 0 || snapshot.leaders.length === 0) {
    return (
      <div className={`${bannerClass} border-[#f1c76e]/22 bg-black/18 text-[#f1d796]`}>
        {kind === "sheriff" ? "没有有效警长票，本局没有产生警长。" : "没有有效放逐票，今日无人出局。"}
      </div>
    );
  }

  if (snapshot.leaders.length > 1) {
    return (
      <div className={`${bannerClass} border-[#f1c76e]/22 bg-black/18 text-[#f1d796]`}>
        {kind === "sheriff" ? "警长票" : "最高票"}平票：{snapshot.leaders.map((seat) => `${seat.seatId}号`).join("、")}
        {kind === "sheriff" ? "。" : "，本轮无人放逐。"}
      </div>
    );
  }

  const leader = snapshot.leaders[0];
  return (
    <div className={`${bannerClass} border-[#ff9a6b]/28 bg-[#351210]/54 text-[#ffd8cf]`}>
      {kind === "sheriff" ? "警长票最高" : "最高票"}：{leader.seatId}号，获得 {topVoteCount} 票。
    </div>
  );
}

export function VoteRevealLedger({ snapshot, compact = false }: { snapshot: VoteSnapshotView; compact?: boolean }) {
  if (!snapshot.votes.length) return null;

  return (
    <div className={compact ? "mt-1 grid gap-1.5" : "grid gap-2"}>
      <div className="flex items-center justify-between gap-3 text-xs text-[#d9a099]">
        <span>{compact ? "投向明细" : "逐票揭示"}</span>
        <span>{snapshot.votes.length} 票</span>
      </div>
      <div className={compact ? "grid gap-1.5" : "grid gap-2"}>
        {snapshot.votes.map((vote, index) => (
          <div
            key={vote.seq}
            style={{ animationDelay: `${index * 92}ms` }}
            className={[
              "vote-ledger-item flex min-h-10 items-center gap-2 rounded-2xl border border-[#e46d55]/18 bg-black/18 px-3 py-2 text-xs leading-5 text-[#ffd8cf]",
              compact ? "rounded-xl px-2.5 py-1.5" : "",
            ].join(" ")}
          >
            <span className="vote-ledger-index shrink-0 rounded-full border border-[#e46d55]/20 bg-[#351210]/62 px-2 py-0.5 text-[11px] text-[#d9a099]">
              第{index + 1}票
            </span>
            <span className="shrink-0 font-semibold">{vote.voter.seatId}号</span>
            <span className="text-[#d9a099]">→</span>
            <span className="min-w-0 font-semibold">{vote.target ? `${vote.target.seatId}号` : "弃票"}</span>
          </div>
        ))}
      </div>
    </div>
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

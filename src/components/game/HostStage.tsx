"use client";

import type * as React from "react";
import { stripSpeechStageDirections } from "@/game/speechText";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import { getActionMeta } from "./ActionPanel";
import type { AiSpeechAudioStatus, CommandPayload, HostAudioStatus, LiveAiSpeech } from "./clientTypes";
import { VoteResultBanner, VoteRevealLedger } from "./TablePanels";
import { formatSystemMessage, getNightRoleTrackSteps, seatNumber } from "./viewHelpers";

export type PhaseCurtainCue = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
  durationMs: number;
  presentation?: "curtain" | "ribbon";
};

export function PhaseCurtain({ cue }: { cue: PhaseCurtainCue }) {
  if (cue.presentation === "ribbon") {
    return (
      <div
        className={`${phaseCurtainToneClass(cue.tone)} phase-signal pointer-events-none fixed left-3 right-3 top-[72px] z-40 sm:left-6 sm:right-auto sm:top-[78px] lg:left-8`}
        style={{ "--curtain-duration": `${cue.durationMs}ms` } as React.CSSProperties}
      >
        <div className="phase-signal-card flex w-full max-w-[320px] items-center gap-3 rounded-xl border px-3 py-2.5 shadow-xl shadow-black/35 sm:w-[320px]">
          <div className="phase-signal-mark grid h-9 w-9 shrink-0 place-items-center rounded-full border" aria-hidden="true">
            <span className="phase-signal-mark-core h-2.5 w-2.5 rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="phase-signal-eyebrow text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">
              {cue.eyebrow}
            </div>
            <div className="phase-signal-title mt-0.5 text-sm font-semibold leading-tight text-white sm:text-base">
              {cue.title}
            </div>
            <div className="phase-signal-subtitle mt-0.5 text-xs leading-5 text-white/60">{cue.subtitle}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${phaseCurtainToneClass(cue.tone)} phase-curtain pointer-events-none fixed inset-0 z-40 overflow-hidden`}
      style={{ "--curtain-duration": `${cue.durationMs}ms` } as React.CSSProperties}
    >
      <div className="phase-curtain-bg" aria-hidden="true" />
      <div className="phase-curtain-vignette" aria-hidden="true" />
      <div className="phase-curtain-table-ring" aria-hidden="true" />
      <div className="phase-curtain-panel phase-curtain-panel-top" aria-hidden="true" />
      <div className="phase-curtain-panel phase-curtain-panel-bottom" aria-hidden="true" />
      <div className="phase-curtain-sweep" aria-hidden="true" />

      <div className="phase-curtain-stage mx-auto flex h-full w-full max-w-[1500px] items-end px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-20">
        <div className="phase-curtain-copy max-w-3xl">
          <div className="phase-curtain-eyebrow text-sm font-semibold text-white/62">{cue.eyebrow}</div>
          <div className="phase-curtain-title mt-3 text-5xl font-semibold leading-none text-white sm:text-7xl">
            {cue.title}
          </div>
          <div className="phase-curtain-subtitle mt-5 max-w-xl text-base leading-7 text-white/74 sm:text-lg">
            {cue.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

export function getPhaseCurtainCue(game: HumanGameView): PhaseCurtainCue {
  switch (game.phase) {
    case "NIGHT_WOLVES":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "天黑请闭眼",
        subtitle: "狼人请睁眼，选择今晚的刀口。",
        tone: "night",
        durationMs: 1650,
      };
    case "NIGHT_WOLF_BEAUTY":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "狼美人请睁眼",
        subtitle: "选择今晚魅惑的玩家。",
        tone: "night",
        durationMs: 950,
        presentation: "ribbon",
      };
    case "NIGHT_SEER":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "预言家请睁眼",
        subtitle: "选择一名玩家查验身份。",
        tone: "night",
        durationMs: 900,
        presentation: "ribbon",
      };
    case "NIGHT_WITCH":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "女巫请睁眼",
        subtitle: "确认刀口，决定是否使用药品。",
        tone: "night",
        durationMs: 900,
        presentation: "ribbon",
      };
    case "DAY_ANNOUNCEMENT":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "天亮了",
        subtitle: "主持人公布昨夜情况。",
        tone: "day",
        durationMs: 1650,
      };
    case "DAY_SPEECH":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "开始发言",
        subtitle: "存活玩家按座位顺序依次发言。",
        tone: "day",
        durationMs: 1450,
      };
    case "DAY_VOTE":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "开始投票",
        subtitle: "投票过程保密，结束后统一开票。",
        tone: "vote",
        durationMs: 1450,
      };
    case "KNIGHT_DUEL":
      return {
        eyebrow: "骑士阶段",
        title: "骑士决斗窗口",
        subtitle: "骑士可以选择是否发动一次决斗。",
        tone: "danger",
        durationMs: 1300,
        presentation: "ribbon",
      };
    case "EXILE_RESOLUTION":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "公布票数",
        subtitle: "结算今日放逐结果。",
        tone: "vote",
        durationMs: 1550,
      };
    case "LAST_WORDS":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "请发表遗言",
        subtitle: "出局玩家留下最后一段公开信息。",
        tone: "danger",
        durationMs: 1200,
        presentation: "ribbon",
      };
    case "HUNTER_REVEAL":
      return {
        eyebrow: "出局结算",
        title: "等待结算",
        subtitle: "出局玩家正在完成后续流程。",
        tone: "danger",
        durationMs: 1300,
      };
    case "HUNTER_SHOT":
      return {
        eyebrow: "猎人阶段",
        title: "猎人请行动",
        subtitle: "猎人已翻牌，必须带走一名玩家。",
        tone: "danger",
        durationMs: 1450,
      };
    case "WOLF_KING_SHOT":
      return {
        eyebrow: "狼王阶段",
        title: "狼王请行动",
        subtitle: "选择是否发动出局枪。",
        tone: "danger",
        durationMs: 1450,
      };
    case "GAME_OVER":
      return {
        eyebrow: "终局",
        title: "游戏结束",
        subtitle: game.result?.reason ?? "查看复盘了解关键节点。",
        tone: "end",
        durationMs: 1800,
      };
    default:
      return {
        eyebrow: "准备",
        title: "准备开局",
        subtitle: "正在生成本局身份。",
        tone: "day",
        durationMs: 1200,
      };
  }
}

function phaseCurtainToneClass(tone: PhaseCurtainCue["tone"]): string {
  const tones = {
    night: "phase-curtain-night",
    day: "phase-curtain-day",
    vote: "phase-curtain-vote",
    danger: "phase-curtain-danger",
    end: "phase-curtain-end",
  };
  return tones[tone];
}

export function PhaseRhythm({ game }: { game: HumanGameView }) {
  const steps = game.tableSummary.phaseSteps;
  const currentIndex = Math.max(
    steps.findIndex((step) => step.status === "current"),
    0,
  );
  const progressWidth = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <section
      key={`${game.id}-${game.day}-${game.phase}-rhythm`}
      className="phase-rhythm-panel rounded-[22px] border border-[#f1c76e]/20 bg-[#130d0b]/72 px-3 py-3 shadow-xl shadow-black/25 backdrop-blur-md"
    >
      <div className="phase-rhythm-track" aria-hidden="true">
        <div className="phase-rhythm-progress" style={{ width: `${progressWidth}%` }} />
      </div>
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className={`phase-step phase-step-${step.status} min-w-0`} style={{ animationDelay: `${index * 55}ms` }}>
            <div className="flex items-center gap-2">
              <div
                className={[
                  "phase-step-dot grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  step.status === "done"
                    ? "border-[#77d898]/35 bg-[#1d4e33]/70 text-[#a8f0b6]"
                    : step.status === "current"
                      ? "border-[#f1c76e]/65 bg-[#4a2d12] text-[#f1d796] shadow-lg shadow-[#f1c76e]/10"
                      : "border-[#f1c76e]/18 bg-black/25 text-[#8f8065]",
                ].join(" ")}
              >
                {index + 1}
              </div>
              {index < game.tableSummary.phaseSteps.length - 1 && (
                <div
                  className={[
                    "phase-step-connector hidden h-px flex-1 sm:block",
                    step.status === "done" ? "bg-[#77d898]/35" : "bg-[#f1c76e]/15",
                  ].join(" ")}
                />
              )}
            </div>
            <div
              className={[
                "mt-2 truncate text-xs",
                step.status === "current" ? "font-semibold text-[#f1d796]" : step.status === "done" ? "text-[#a8f0b6]" : "text-[#8f8065]",
              ].join(" ")}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type HostCue = {
  badge: string;
  title: string;
  line: string;
  detail: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
};

export function HostStage({ game }: { game: HumanGameView }) {
  const cue = getHostCue(game);
  const action = game.availableActions[0];
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;

  return (
    <section
      key={`${game.id}-${game.day}-${game.phase}-${game.currentActorSeatId ?? "host"}`}
      className={`${hostToneClass(cue.tone)} flow-panel overflow-hidden rounded-[26px] border p-4 shadow-2xl shadow-black/35 backdrop-blur-md`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-black/24 px-3 py-1 text-xs font-semibold text-white/82">
              主持人
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/70">
              {cue.badge}
            </span>
            {currentActor && (
              <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-xs text-white/72">
                当前：{currentActor.seatId}号
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{cue.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/78">{cue.line}</p>
          <p className="mt-1 text-xs leading-5 text-white/56">{cue.detail}</p>
        </div>

        <div className="flow-detail-card rounded-2xl border border-white/12 bg-black/20 p-3">
          <HostStageDetail game={game} action={action} />
        </div>
      </div>
    </section>
  );
}

function HostStageDetail({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
  if (game.phase.startsWith("NIGHT")) {
    return <NightRoleTrack game={game} />;
  }

  if (game.phase === "DAY_SPEECH") {
    return <SpeechOrderStrip game={game} />;
  }

  if (game.phase === "DAY_VOTE") {
    return <VotePrivacyStrip game={game} action={action} />;
  }

  if (game.phase.startsWith("SHERIFF")) {
    return <SheriffStatusStrip game={game} />;
  }

  if (game.phase === "EXILE_RESOLUTION") {
    return <VoteRevealStrip game={game} />;
  }

  if (game.phase === "LAST_WORDS") {
    const speaker = game.currentActorSeatId ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId) : undefined;
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Last Words</div>
        <div>{speaker ? `${speaker.seatId}号${speaker.isHuman ? "（你）" : ""}发表遗言。` : "等待出局玩家发表遗言。"}</div>
      </div>
    );
  }

  if (game.phase === "DAY_ANNOUNCEMENT") {
    const latestAnnouncement = [...game.publicEvents]
      .reverse()
      .find((event) => event.day === game.day && event.phase === "DAY_ANNOUNCEMENT");
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Dawn Report</div>
        <div>{formatSystemMessage(game, latestAnnouncement?.message ?? "等待公布昨夜死亡情况。")}</div>
      </div>
    );
  }

  if (game.phase === "HUNTER_REVEAL") {
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Death Resolve</div>
        <div>出局玩家正在完成结算，随后继续遗言或后续流程。</div>
      </div>
    );
  }

  if (game.phase === "HUNTER_SHOT") {
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Hunter Window</div>
        <div>猎人已翻牌发动技能，必须带走一名存活玩家。</div>
      </div>
    );
  }

  if (game.phase === "WOLF_KING_SHOT") {
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Wolf King Window</div>
        <div>狼王进入出局行动窗口，结算完成后继续遗言、警徽或夜晚流程。</div>
      </div>
    );
  }

  if (game.phase === "SHERIFF_HANDOFF") {
    const holder = game.sheriff?.badgeHolder;
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Sheriff Badge</div>
        <div>{holder ? `${holder.seatId}号警长出局，等待移交或撕毁警徽。` : "等待警徽结算。"}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm leading-6 text-white/75">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Result</div>
      <div>{game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：${game.result.reason}` : "流程继续推进。"}</div>
    </div>
  );
}

function NightRoleTrack({ game }: { game: HumanGameView }) {
  const steps = getNightRoleTrackSteps(game.board);
  const currentIndex = steps.findIndex((step) => step.phase === game.phase);

  return (
    <div className="grid gap-3">
      {steps.map((step, index) => {
        const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <div
            key={step.phase}
            style={{ animationDelay: `${index * 65}ms` }}
            className={[
              "flow-track-item flex items-center justify-between gap-3 rounded-2xl border px-3 py-2",
              status === "done"
                ? "border-[#77d898]/25 bg-[#153421]/50 text-[#c9f6d0]"
                : status === "current"
                  ? "flow-track-current border-[#7da8e3]/40 bg-[#132942]/70 text-[#d8e6f7]"
                  : "border-white/10 bg-black/18 text-white/45",
            ].join(" ")}
          >
            <div>
              <div className="text-sm font-semibold">{step.label}</div>
              <div className="mt-0.5 text-xs opacity-70">{step.detail}</div>
            </div>
            <span className="text-xs">{status === "done" ? "已完成" : status === "current" ? "进行中" : "等待"}</span>
          </div>
        );
      })}
    </div>
  );
}

function SpeechOrderStrip({ game }: { game: HumanGameView }) {
  const spokenSeatIds = new Set(
    game.publicEvents
      .filter((event) => event.day === game.day && event.phase === "DAY_SPEECH" && typeof event.actorSeatId === "number")
      .map((event) => event.actorSeatId),
  );
  const aliveSeats = game.seats.filter((seat) => seat.alive);
  const dawnReport = getLatestDawnReport(game);

  return (
    <div className="grid gap-3">
      {dawnReport && (
        <div className="rounded-2xl border border-[#7da8e3]/20 bg-[#0d1623]/48 px-3 py-2 text-sm leading-6 text-[#d8e6f7]">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9dbbe6]">昨夜情况</div>
          {dawnReport}
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-white/58">
        <span>本轮发言顺序</span>
        <span>
          已发言 {spokenSeatIds.size}/{aliveSeats.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {aliveSeats.map((seat) => {
          const isCurrent = game.currentSpeakerSeatId === seat.seatId;
          const hasSpoken = spokenSeatIds.has(seat.seatId);
          return (
            <span
              key={seat.seatId}
              style={{ animationDelay: `${seat.seatId * 22}ms` }}
              className={[
                "rounded-full border px-3 py-1 text-xs transition-all duration-500 ease-out",
                isCurrent
                  ? "flow-current-pill border-[#f1c76e]/55 bg-[#4a2d12]/80 text-[#f1d796]"
                  : hasSpoken
                    ? "flow-done-pill border-[#77d898]/25 bg-[#153421]/55 text-[#a8f0b6]"
                    : "border-white/10 bg-black/20 text-white/50",
              ].join(" ")}
            >
              {seat.seatId}号{seat.isHuman ? " 你" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function getLatestDawnReport(game: HumanGameView): string | undefined {
  const event = [...game.publicEvents]
    .reverse()
    .find((item) => item.day === game.day && item.type === "DAY_STARTED");
  return event ? formatSystemMessage(game, event.message) : undefined;
}

function VotePrivacyStrip({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
  const isHumanVote = action?.type === "vote";
  const aliveSeats = game.seats.filter((seat) => seat.alive);

  return (
    <div className="grid gap-3 text-sm leading-6 text-white/75">
      <div className="vote-sealed-card rounded-2xl border border-[#e46d55]/25 bg-[#351210]/45 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[#ffd8cf]">投票箱封存中</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-xs text-white/62">
            {isHumanVote ? "等待你锁票" : `${aliveSeats.length} 人同时锁票`}
          </span>
        </div>
        <div className="mt-1 text-xs text-[#ffd8cf]/68">票型和投票对象全部保密，结束后统一开票。</div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {aliveSeats.map((seat, index) => (
          <span
            key={seat.seatId}
            style={{ animationDelay: `${index * 70}ms` }}
            className="vote-sealed-chip rounded-full border border-white/10 bg-black/20 px-2 py-1 text-center text-xs text-white/62"
          >
            {seat.seatId}号
          </span>
        ))}
      </div>
    </div>
  );
}

function VoteRevealStrip({ game }: { game: HumanGameView }) {
  const snapshot = game.tableSummary.voteSnapshot;
  const tally = snapshot.tally;
  const maxVotes = tally[0]?.count ?? 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Final Tally</div>
        <span className="rounded-full border border-[#e46d55]/25 bg-[#351210]/45 px-2 py-0.5 text-xs text-[#ffd8cf]/70">
          统一开票
        </span>
      </div>
      {snapshot.revealed && <VoteResultBanner snapshot={snapshot} compact />}
      {tally.length === 0 ? (
        <div className="text-sm text-white/65">等待公开投票结果。</div>
      ) : (
        tally.map((item, index) => (
          <div
            key={item.target.seatId}
            className={[
              "flow-vote-row vote-reveal-card rounded-2xl border px-3 py-2 text-sm text-[#ffd8cf]",
              index === 0 ? "border-[#ff9a6b]/34 bg-[#351210]/64" : "border-[#e46d55]/20 bg-black/20",
            ].join(" ")}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{item.target.seatId}号</span>
              <strong>{item.count} 票</strong>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
              <div
                className="vote-reveal-bar h-full rounded-full bg-[#e46d55]"
                style={{ width: `${maxVotes > 0 ? Math.max(12, (item.count / maxVotes) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))
      )}
      {snapshot.revealed && <VoteRevealLedger snapshot={snapshot} compact />}
    </div>
  );
}

function SheriffStatusStrip({ game }: { game: HumanGameView }) {
  const sheriff = game.sheriff;
  const candidates = sheriff?.pkCandidates ?? sheriff?.candidates ?? [];
  const withdrawnSeatIds = new Set(sheriff?.withdrawnSeatIds ?? []);
  const activeCandidates = candidates.filter((candidate) => !withdrawnSeatIds.has(candidate.seatId));
  const offPoliceSeats = game.seats.filter((seat) => sheriff?.nominationDecisions[String(seat.seatId)] === false);
  const pendingNominationSeats =
    game.phase === "SHERIFF_NOMINATION"
      ? game.seats.filter((seat) => seat.alive && sheriff?.nominationDecisions[String(seat.seatId)] === undefined)
      : [];
  const latestDawnReport = getLatestDawnReport(game);
  return (
    <div className="grid gap-3 text-sm leading-6 text-white/75">
      <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[#f1d796]">警长流程</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-xs text-white/62">
            {sheriff?.badgeHolder ? `${sheriff.badgeHolder.seatId}号警长` : "竞选中"}
          </span>
        </div>
        <div className="mt-1 text-xs text-[#f1d796]/72">{game.phaseLabel}</div>
      </div>
      {latestDawnReport && (
        <div className="rounded-2xl border border-[#7da8e3]/18 bg-[#0d1623]/42 px-3 py-2 text-xs leading-5 text-[#d8e6f7]">
          <span className="font-semibold text-[#9dbbe6]">昨夜情况：</span>
          {latestDawnReport}
        </div>
      )}
      <div className="grid gap-2">
        <SheriffSeatList title={game.phase === "SHERIFF_PK_SPEECH" || game.phase === "SHERIFF_PK_VOTE" ? "PK 台上" : "警上"} seats={activeCandidates} tone="gold" empty="暂无上警玩家" />
        {withdrawnSeatIds.size > 0 && (
          <SheriffSeatList
            title="已退水"
            seats={(sheriff?.candidates ?? []).filter((candidate) => withdrawnSeatIds.has(candidate.seatId))}
            tone="red"
            empty="无人退水"
          />
        )}
        {offPoliceSeats.length > 0 && <SheriffSeatList title="警下" seats={offPoliceSeats} tone="muted" empty="暂无警下玩家" />}
        {pendingNominationSeats.length > 0 && (
          <SheriffSeatList title="待选择" seats={pendingNominationSeats} tone="blue" empty="已完成上警选择" />
        )}
      </div>
    </div>
  );
}

function SheriffSeatList({
  title,
  seats,
  tone,
  empty,
}: {
  title: string;
  seats: Array<{ seatId: number; isHuman?: boolean }>;
  tone: "gold" | "red" | "blue" | "muted";
  empty: string;
}) {
  const toneClass = {
    gold: "border-[#f1c76e]/22 bg-[#3a2412]/42 text-[#f1d796]",
    red: "border-[#e46d55]/22 bg-[#351210]/42 text-[#ffd8cf]",
    blue: "border-[#7da8e3]/20 bg-[#0d1623]/45 text-[#b8d6ff]",
    muted: "border-white/10 bg-black/18 text-white/58",
  }[tone];

  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-white/50">{title}</div>
      {seats.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {seats.map((seat) => (
            <span key={seat.seatId} className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>
              {seat.seatId}号{seat.isHuman ? " 你" : ""}
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/14 px-3 py-2 text-xs text-white/42">{empty}</div>
      )}
    </div>
  );
}

function getHostCue(game: HumanGameView): HostCue {
  switch (game.phase) {
    case "NIGHT_WOLVES":
      return {
        badge: `第 ${game.day} 夜`,
        title: "天黑请闭眼",
        line: "狼人请睁眼，选择今晚的击杀目标。其他身份暂时闭眼等待。",
        detail: "如果轮到 AI，点击继续会播放下一步；如果你是狼人，则直接选择刀口。",
        tone: "night",
      };
    case "NIGHT_WOLF_BEAUTY":
      return {
        badge: `第 ${game.day} 夜`,
        title: "狼美人请睁眼",
        line: "狼美人选择今晚魅惑的玩家，也可以跳过。",
        detail: "狼美人白天出局时，当前魅惑目标会殉情出局；夜间死亡不触发。",
        tone: "night",
      };
    case "NIGHT_GUARD":
      return {
        badge: `第 ${game.day} 夜`,
        title: "守卫请睁眼",
        line: "守卫选择今晚的守护目标，也可以空守。",
        detail: "守卫不能连续两晚守同一名玩家；同守同救同一刀口会导致目标死亡。",
        tone: "night",
      };
    case "NIGHT_SEER":
      return {
        badge: `第 ${game.day} 夜`,
        title: "预言家请睁眼",
        line: "预言家选择一名玩家查验身份，查验结果只进入预言家的私密信息。",
        detail: "这一阶段不会公开查验对象和结果。",
        tone: "night",
      };
    case "NIGHT_WITCH":
      return {
        badge: `第 ${game.day} 夜`,
        title: "女巫请睁眼",
        line: "女巫根据可见刀口和药品状态决定是否使用解药或毒药。",
        detail: "首夜可以自救，第二夜起不能自救；解药用完后不再获知后续刀口。",
        tone: "night",
      };
    case "DAY_ANNOUNCEMENT":
      return {
        badge: `第 ${game.day} 天`,
        title: "天亮了",
        line: "主持人公布昨夜死亡情况，随后进入白天发言。",
        detail: "死亡信息公开，身份仍然只在终局复盘揭晓。",
        tone: "day",
      };
    case "SHERIFF_NOMINATION":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长竞选开始",
        line: "所有存活玩家依次选择是否上警。",
        detail: "上警玩家稍后发表竞选发言，警下玩家参与警长投票。",
        tone: "day",
      };
    case "SHERIFF_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "警上发言",
        line: "警上候选人依次发表竞选发言。",
        detail: "发言结束后候选人可以选择退水或留在警上。",
        tone: "day",
      };
    case "SHERIFF_WITHDRAWAL":
      return {
        badge: `第 ${game.day} 天`,
        title: "退水选择",
        line: "警上候选人依次选择是否退水。",
        detail: "剩余候选人进入警长投票；如果只剩一人则直接当选。",
        tone: "day",
      };
    case "SHERIFF_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "警下投票",
        line: "警下玩家投票选出警长。",
        detail: "平票会进入一次 PK 发言和复投，复平则本局无警长。",
        tone: "vote",
      };
    case "SHERIFF_PK_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长 PK 发言",
        line: "平票候选人进行 PK 发言。",
        detail: "发言结束后进入警长 PK 复投。",
        tone: "day",
      };
    case "SHERIFF_PK_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长 PK 投票",
        line: "非 PK 玩家在平票候选人中复投。",
        detail: "复投仍平票则本局无警长。",
        tone: "vote",
      };
    case "DAY_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "按座位顺序发言",
        line: "所有存活玩家依次发言。发言结束后才进入投票。",
        detail: "AI 只读取公开信息和自己的私密信息，不能看到完整身份表。",
        tone: "day",
      };
    case "DAY_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "开始投票",
        line: "所有存活玩家投票放逐一名玩家。投票结束前，票型和投票对象全部保密。",
        detail: "结束后只公布每名候选人的得票数，再结算放逐或平票。",
        tone: "vote",
      };
    case "KNIGHT_DUEL":
      return {
        badge: `第 ${game.day} 天`,
        title: "骑士决斗窗口",
        line: "骑士可以选择是否发动决斗。目标为狼人阵营时目标出局，否则骑士出局。",
        detail: "跳过决斗会进入正常投票，骑士技能保留到后续白天。",
        tone: "danger",
      };
    case "EXILE_RESOLUTION":
      return {
        badge: `第 ${game.day} 天`,
        title: "公布投票结果",
        line: "主持人公开最终票数，并结算今日放逐结果。",
        detail: "这里不会展示个人投票理由，避免复盘之外的信息影响过程体验。",
        tone: "vote",
      };
    case "LAST_WORDS":
      return {
        badge: `第 ${game.day} 天`,
        title: "遗言时间",
        line: "出局玩家发表最后一段公开发言，随后继续结算猎人或夜晚流程。",
        detail: "遗言会进入公开发言席，也会影响后续玩家的桌面判断。",
        tone: "danger",
      };
    case "HUNTER_REVEAL":
      return {
        badge: `第 ${game.day} 天`,
        title: "出局结算",
        line: "出局玩家正在完成后续结算。",
        detail: "如果后续有公开技能结果，系统会在结果产生后再播报。",
        tone: "danger",
      };
    case "HUNTER_SHOT":
      return {
        badge: `第 ${game.day} 天`,
        title: "猎人行动窗口",
        line: "猎人已翻牌发动技能，必须带走一名存活玩家。",
        detail: "如果猎人选择不翻牌，或被女巫毒死，则不会进入这个公开开枪阶段。",
        tone: "danger",
      };
    case "WOLF_KING_SHOT":
      return {
        badge: `第 ${game.day} 天`,
        title: "狼王行动窗口",
        line: "狼王出局后可以选择是否发动狼王枪带走一名玩家。",
        detail: "被夜间击杀或女巫毒死不会触发狼王枪。",
        tone: "danger",
      };
    case "SHERIFF_HANDOFF":
      return {
        badge: `第 ${game.day} 天`,
        title: "警徽移交",
        line: "警长出局后选择移交警徽或撕掉警徽。",
        detail: "警徽持有者白天放逐投票计 1.5 票。",
        tone: "danger",
      };
    case "GAME_OVER":
      return {
        badge: "终局",
        title: "游戏结束",
        line: game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜。` : "对局已经结束。",
        detail: game.result?.reason ?? "可以查看复盘了解关键节点。",
        tone: "end",
      };
    default:
      return {
        badge: "准备",
        title: "准备开局",
        line: "正在创建本局座位和身份。",
        detail: "规则引擎会先生成事件，再投影出当前玩家视角。",
        tone: "day",
      };
  }
}

function hostToneClass(tone: HostCue["tone"]): string {
  const tones = {
    night: "border-[#6d93d4]/28 bg-[#0c1424]/82",
    day: "border-[#f1c76e]/26 bg-[#1c150e]/82",
    vote: "border-[#e46d55]/28 bg-[#2a1110]/84",
    danger: "border-[#ff9a6b]/30 bg-[#30140d]/86",
    end: "border-[#77d898]/28 bg-[#0f2118]/84",
  };
  return tones[tone];
}

export function FlowStatusBar({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  onPauseAiSpeechAudio,
  onResumeAiSpeechAudio,
  onSkipAiSpeechAudio,
  onToggleAiSpeechAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  onPauseAiSpeechAudio: () => void;
  onResumeAiSpeechAudio: () => void;
  onSkipAiSpeechAudio: () => void;
  onToggleAiSpeechAudio: () => void;
}) {
  const status = getFlowStatus(
    game,
    loading,
    pendingCommandType,
    liveAiSpeech,
    hostAudioStatus,
    aiSpeechAudioStatus,
    aiSpeechAudioUnavailable,
  );
  const isPaused = aiSpeechAudioStatus?.state === "paused";
  const isLoadingSpeechAudio = aiSpeechAudioStatus?.state === "loading";
  const speechTextPreview = aiSpeechAudioStatus?.text ? stripSpeechStageDirections(aiSpeechAudioStatus.text).trim() : "";

  return (
    <section className={`${flowStatusToneClass(status.tone)} flow-status-bar rounded-[22px] border px-4 py-3 shadow-xl shadow-black/25 backdrop-blur-md`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flow-status-pulse h-2.5 w-2.5 rounded-full" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/48">System Status</span>
            {status.seatLabel && (
              <span className="rounded-full border border-white/12 bg-black/18 px-2 py-0.5 text-xs text-white/68">
                {status.seatLabel}
              </span>
            )}
          </div>
          <div className="text-base font-semibold text-white sm:text-lg">{status.title}</div>
          <div className="mt-1 text-sm leading-6 text-white/64">{status.detail}</div>
        </div>

        {aiSpeechAudioStatus && (
          <div className="grid shrink-0 gap-2 lg:min-w-[310px]">
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              <button
                type="button"
                disabled={isLoadingSpeechAudio}
                onClick={isPaused ? onResumeAiSpeechAudio : onPauseAiSpeechAudio}
                className="rounded-full border border-[#77d898]/28 bg-[#14311f]/58 px-3 py-2 text-xs font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isLoadingSpeechAudio ? "准备中" : isPaused ? "继续语音" : "暂停语音"}
              </button>
              <button
                type="button"
                onClick={onSkipAiSpeechAudio}
                className="rounded-full border border-[#f1c76e]/25 bg-black/18 px-3 py-2 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
              >
                跳过当前
              </button>
              <button
                type="button"
                onClick={onToggleAiSpeechAudio}
                className="rounded-full border border-white/12 bg-black/18 px-3 py-2 text-xs font-semibold text-white/68 transition hover:bg-white/8"
              >
                关闭语音
              </button>
            </div>
            {speechTextPreview && (
              <div className="line-clamp-2 rounded-2xl border border-white/10 bg-black/18 px-3 py-2 text-xs leading-5 text-white/58 lg:text-right">
                {seatNumber(aiSpeechAudioStatus.speaker)}：{speechTextPreview}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function getFlowStatus(
  game: HumanGameView,
  loading: boolean,
  pendingCommandType: CommandPayload["type"] | null,
  liveAiSpeech: LiveAiSpeech | null,
  hostAudioStatus: HostAudioStatus | null,
  aiSpeechAudioStatus: AiSpeechAudioStatus | null,
  aiSpeechAudioUnavailable: boolean,
): { title: string; detail: string; tone: "green" | "gold" | "blue" | "red"; seatLabel?: string } {
  if (liveAiSpeech) {
    return {
      title: "AI 正在生成发言",
      detail: aiSpeechAudioUnavailable
        ? "语音已自动降级为文字，流程会按发言长度留出阅读时间。"
        : liveAiSpeech.text
          ? "文字正在流式出现，语音会跟随生成并按顺序播放。"
          : "模型正在整理公开信息和自己的私有视角。",
      tone: "green",
      seatLabel: seatNumber(liveAiSpeech.speaker),
    };
  }

  if (aiSpeechAudioStatus) {
    const stateText =
      aiSpeechAudioStatus.state === "loading"
        ? "正在生成这一段 TTS"
        : aiSpeechAudioStatus.state === "paused"
          ? "AI 语音已暂停"
          : "正在播放 AI 发言";
    return {
      title: stateText,
      detail: aiSpeechAudioStatus.state === "paused" ? "继续后才会进入下一步。" : "这段说完后，系统再进入下一段强交互。",
      tone: "green",
      seatLabel: seatNumber(aiSpeechAudioStatus.speaker),
    };
  }

  if (hostAudioStatus) {
    return {
      title: "主持人正在播报",
      detail: "系统节点音频播放完成后，流程会继续推进。",
      tone: game.phase.startsWith("NIGHT") ? "blue" : game.phase === "DAY_VOTE" || game.phase === "EXILE_RESOLUTION" ? "red" : "gold",
    };
  }

  if (aiSpeechAudioUnavailable && game.phase === "DAY_SPEECH") {
    return {
      title: "AI 语音已转文字",
      detail: "TTS 暂不可用，本局不会反复请求语音；系统仍会等文字读完再推进。",
      tone: "gold",
    };
  }

  if (loading && pendingCommandType === "vote") {
    return {
      title: "你已锁票",
      detail: "正在等待其他玩家完成投票；开票前不会显示任何人的投票对象。",
      tone: "red",
    };
  }

  if (loading) {
    return {
      title: pendingCommandType === "continue" ? "正在推进流程" : "正在结算你的操作",
      detail: pendingCommandType === "continue" ? "系统正在处理下一位玩家或主持节点。" : "规则引擎正在写入结果并刷新牌桌。",
      tone: game.phase.startsWith("NIGHT") ? "blue" : "gold",
    };
  }

  const action = game.availableActions[0];
  if (action?.type === "continue") {
    return {
      title: "系统会自动播放下一步",
      detail: action.description,
      tone: game.phase.startsWith("NIGHT") ? "blue" : game.phase === "DAY_VOTE" || game.phase === "EXILE_RESOLUTION" ? "red" : "gold",
    };
  }

  if (action) {
    const meta = getActionMeta(action);
    return {
      title: meta.title,
      detail: meta.description,
      tone: action.type === "vote" ? "red" : game.phase.startsWith("NIGHT") ? "blue" : "gold",
    };
  }

  return {
    title: game.phase === "DAY_VOTE" ? "等待投票完成" : "等待流程推进",
    detail: game.phase === "DAY_VOTE" ? "票箱封存中，统一开票前只显示锁票状态。" : "当前没有需要你点击的操作。",
    tone: game.phase === "DAY_VOTE" ? "red" : "gold",
  };
}

function flowStatusToneClass(tone: "green" | "gold" | "blue" | "red"): string {
  const tones = {
    green: "border-[#77d898]/24 bg-[#0f2118]/80",
    gold: "border-[#f1c76e]/24 bg-[#1c150e]/80",
    blue: "border-[#7da8e3]/24 bg-[#0d1623]/82",
    red: "border-[#e46d55]/26 bg-[#2b1110]/82",
  };
  return tones[tone];
}

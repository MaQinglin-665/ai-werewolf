"use client";

import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import { VoteResultBanner, VoteRevealLedger } from "./TablePanels";
import { formatSystemMessage, getNightRoleTrackSteps } from "./viewHelpers";

export function HostStageDetail({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
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

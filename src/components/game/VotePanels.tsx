"use client";

import type { HumanGameView } from "@/game/types";
import type { CommandPayload } from "./clientTypes";

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

"use client";

import { DEATH_LABELS } from "@/game/labels";
import { buildReviewCredibilityHighlights } from "@/game/reviewHighlights";
import { isWolfRole } from "@/game/roleUtils";
import type { HumanGameView } from "@/game/types";
import { SectionTitle } from "./PanelPrimitives";
import { ROLE_CARD_IMAGES, formatSystemMessage } from "./viewHelpers";
import { ReviewAnalysisDrawer } from "./ReviewAnalysisPanels";
import { ReviewCredibilityStrip, PlayerFeedbackPanel, ReviewVoteImpactPanel } from "./ReviewSummaryPanels";
import { ReviewDayRounds, ReviewNightRounds } from "./ReviewRoundPanels";

export function ReviewPanel({
  game,
  reviewId = "review",
  reviewEventsId = "review-events",
}: {
  game: HumanGameView;
  reviewId?: string;
  reviewEventsId?: string;
}) {
  const review = game.review;
  if (!review) return null;
  const credibilityHighlights = buildReviewCredibilityHighlights(game);

  return (
    <section id={reviewId} className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1c76e]/15 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#f7ead5]">终局复盘</h2>
          <p className="mt-1 text-sm text-[#dcc9a7]">
            {review.result?.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜 · {review.result?.reason}
          </p>
        </div>
        <a
          href={`#${reviewEventsId}`}
          className="rounded-full border border-[#f1c76e]/30 px-4 py-2 text-sm text-[#f1d796] transition hover:bg-[#f1c76e]/10"
        >
          查看关键事件
        </a>
      </div>

      {credibilityHighlights.length > 0 && <ReviewCredibilityStrip highlights={credibilityHighlights} />}

      {review.turningPoints.length > 0 && (
        <div className="mt-4">
          <SectionTitle>关键转折</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {review.turningPoints.map((point, index) => (
              <div key={`${point.day}-${point.title}-${index}`} className="rounded-2xl border border-[#f1c76e]/18 bg-[#261510]/75 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#f1c76e]/12 px-2 py-1 text-xs text-[#f1d796]">D{point.day}</span>
                  <span className="text-xs text-[#ad9c7d]">#{index + 1}</span>
                </div>
                <div className="text-sm font-semibold text-[#f7ead5]">{point.title}</div>
                <p className="mt-2 text-xs leading-5 text-[#dcc9a7]">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {review.playerFeedback.length > 0 && <PlayerFeedbackPanel game={game} />}

      {review.voteImpacts.length > 0 && <ReviewVoteImpactPanel game={game} />}

      {(review.aiInsights.length > 0 || game.reviewDebug) && <ReviewAnalysisDrawer game={game} />}

      {review.stanceShifts.length > 0 && (
        <div className="mt-4">
          <SectionTitle>站边变化</SectionTitle>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {review.stanceShifts.map((shift) => (
              <div key={`${shift.actor.seatId}-${shift.target.seatId}-${shift.fromDay}-${shift.toDay}`} className="rounded-2xl border border-[#e46d55]/18 bg-[#2b1110]/40 p-3 text-sm text-[#ffd8cf]">
                D{shift.fromDay}→D{shift.toDay} · {shift.actor.name} 对 {shift.target.name}：
                {shift.fromKindLabel} 改为 {shift.toKindLabel}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.strategyNotes.length > 0 && (
        <div className="mt-4">
          <SectionTitle>阵营策略</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.strategyNotes.map((note, index) => (
              <div
                key={`${note.day}-${note.title}-${index}`}
                className={[
                  "rounded-2xl border p-3 text-sm",
                  note.camp === "WEREWOLVES"
                    ? "border-[#e46d55]/22 bg-[#2b1110]/42 text-[#ffd8cf]"
                    : "border-[#8fd29a]/22 bg-[#0f2118]/45 text-[#dff4df]",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#f7ead5]">{note.title}</span>
                  <span className="text-xs opacity-75">D{note.day}</span>
                </div>
                <p className="text-xs leading-5 opacity-90">{note.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <SectionTitle>身份揭晓</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {review.roleReveal.map((seat) => (
              <div key={seat.seatId} className="flex gap-3 rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm">
                <div
                  className="h-16 w-11 shrink-0 rounded-md border border-[#f1c76e]/30 bg-cover bg-center"
                  style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[seat.role]})` }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#f7ead5]">
                    {seat.seatId}号 · {seat.name}
                  </div>
                  <div className={isWolfRole(seat.role) ? "mt-1 text-[#ff8c78]" : "mt-1 text-[#9fe0a4]"}>
                    {seat.roleLabel}
                  </div>
                  <div className="mt-1 text-xs text-[#ad9c7d]">
                    {seat.alive ? "存活到终局" : seat.deathReason ? DEATH_LABELS[seat.deathReason] : "已出局"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>死亡时间线</SectionTitle>
          <div className="mt-3 grid gap-2">
            {review.deathTimeline.length === 0 ? (
              <p className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm text-[#ad9c7d]">没有玩家死亡。</p>
            ) : (
              review.deathTimeline.map((death, index) => (
                <div key={`${death.day}-${death.seat.seatId}-${index}`} className="rounded-2xl bg-[#261510]/85 p-3 text-sm text-[#dcc9a7]">
                  D{death.day} · {death.seat.name} · {death.reasonLabel}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReviewNightRounds game={game} />
        <ReviewDayRounds game={game} />
      </div>

      <div id={reviewEventsId} className="mt-5">
        <SectionTitle>关键事件</SectionTitle>
        <div className="mt-3 grid gap-2">
          {review.keyEvents.map((event) => (
            <div key={event.seq} className="border-l-2 border-[#f1c76e] bg-black/15 py-2 pl-3 text-sm leading-6 text-[#dcc9a7]">
              <span className="text-xs text-[#ad9c7d]">D{event.day} · {event.phase}</span>
              <br />
              {formatSystemMessage(game, event.message)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

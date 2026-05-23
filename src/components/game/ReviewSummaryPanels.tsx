"use client";

import type { ReviewCredibilityHighlight } from "@/game/reviewHighlights";
import { isWolfRole } from "@/game/roleUtils";
import type { HumanGameView } from "@/game/types";
import { SectionTitle } from "./PanelPrimitives";

export function ReviewCredibilityStrip({ highlights }: { highlights: ReviewCredibilityHighlight[] }) {
  const toneClass: Record<ReviewCredibilityHighlight["tone"], string> = {
    good: "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]",
    warning: "border-[#f1c76e]/22 bg-[#261510]/54 text-[#f1d796]",
    neutral: "border-[#f1c76e]/18 bg-black/20 text-[#dcc9a7]",
    danger: "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]",
  };

  return (
    <div className="mt-4">
      <SectionTitle>本局结论</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {highlights.map((item) => (
          <div key={item.title} className={`${toneClass[item.tone]} rounded-2xl border p-3 text-sm`}>
            <div className="font-semibold text-[#f7ead5]">{item.title}</div>
            <p className="mt-2 text-xs leading-5 opacity-90">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerFeedbackPanel({ game }: { game: HumanGameView }) {
  const feedback = game.review?.playerFeedback ?? [];
  if (feedback.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionTitle>你的本局反馈</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {feedback.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className={[
              "rounded-2xl border p-3 text-sm",
              item.tone === "positive"
                ? "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]"
                : item.tone === "warning"
                  ? "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]"
                  : "border-[#f1c76e]/18 bg-black/20 text-[#dcc9a7]",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-[#f7ead5]">{item.title}</span>
              {item.day && <span className="text-xs opacity-75">D{item.day}</span>}
            </div>
            <p className="text-xs leading-5 opacity-90">{item.description}</p>
            {item.relatedSeats.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {item.relatedSeats.slice(0, 4).map((seat) => (
                  <span key={`${item.title}-${seat.seatId}`} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] opacity-85">
                    {seat.seatId}号
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewVoteImpactPanel({ game }: { game: HumanGameView }) {
  const impacts = game.review?.voteImpacts ?? [];
  if (impacts.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionTitle>票型影响</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {impacts.map((impact) => {
          const targetIsWolf = isWolfRole(impact.targetRole);
          return (
            <div
              key={`${impact.day}-${impact.title}`}
              className={[
                "rounded-2xl border p-3 text-sm",
                impact.outcome === "tie"
                  ? "border-[#f1c76e]/22 bg-[#261510]/50 text-[#f1d796]"
                  : targetIsWolf
                    ? "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]"
                    : "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]",
              ].join(" ")}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-black/22 px-2 py-1 text-xs opacity-80">D{impact.day}</span>
                  <div className="mt-2 font-semibold text-[#f7ead5]">{impact.title}</div>
                </div>
                {impact.target && impact.targetRoleLabel && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs">
                    {impact.target.seatId}号 · {impact.targetRoleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs leading-5 opacity-90">{impact.description}</p>

              {impact.leaders.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {impact.leaders.map((leader) => (
                    <span key={`${impact.day}-${leader.target.seatId}`} className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[11px] opacity-85">
                      {leader.target.seatId}号 {leader.count}票 · {leader.roleLabel}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] leading-5">
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  总票<br />
                  {impact.totalVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  好人票<br />
                  {impact.goodVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  狼票<br />
                  {impact.wolfVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  弃票<br />
                  {impact.abstainCount}
                </div>
              </div>

              {impact.decisiveVoters.length > 0 && (
                <div className="mt-3 text-xs leading-5 opacity-80">
                  关键票：{impact.decisiveVoters.map((seat) => `${seat.seatId}号`).join("、")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

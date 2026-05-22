"use client";

import type { HumanGameView } from "@/game/types";
import { SectionTitle } from "./PanelPrimitives";

export function ReviewNightRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>夜晚记录</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.nightRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#5e87b9]/25 bg-[#0d1623]/55 p-3 text-sm leading-6 text-[#d8e6f7]">
            <strong>第 {round.day} 夜</strong>
            <div>狼人刀口：{round.wolfTarget?.name ?? "无"}</div>
            <div>
              查验：
              {round.seerCheck
                ? `${round.seerCheck.seer.name} 查验 ${round.seerCheck.target.name} 为 ${
                    round.seerCheck.result === "WEREWOLF" ? "狼人" : "好人"
                  }`
                : "无"}
            </div>
            <div>
              女巫：
              {round.witchAction
                ? round.witchAction.mode === "save"
                  ? `救了 ${round.witchAction.target?.name ?? "刀口"}`
                  : round.witchAction.mode === "poison"
                    ? `毒了 ${round.witchAction.target?.name ?? "未知目标"}`
                    : "未用药"
                : "无行动"}
            </div>
            <div>死亡：{round.deaths.length > 0 ? round.deaths.map((seat) => seat.name).join("、") : "平安夜"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewDayRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>白天投票</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.dayRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#8fd29a]/25 bg-[#0f2118]/60 p-3 text-sm leading-6 text-[#dff4df]">
            <strong>第 {round.day} 天</strong>
            <div>发言数：{round.speechCount}</div>
            <div>
              票数：
              {round.voteTally.length > 0
                ? round.voteTally.map((item) => `${item.target.name} ${item.count}票`).join("，")
                : "无"}
            </div>
            {round.votes.length > 0 && (
              <div>
                投票解释：
                {round.votes
                  .slice(0, 4)
                  .map((vote) => `${vote.voter.name}投${vote.target?.name ?? "弃票"}${vote.reason ? `（${vote.reason}）` : ""}`)
                  .join("；")}
              </div>
            )}
            <div>
              结果：
              {round.exiled
                ? `${round.exiled.name} 被放逐`
                : round.tiedSeatIds.length > 0
                  ? `平票：${round.tiedSeatIds.join("、")}号`
                  : "无放逐"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

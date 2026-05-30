import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { ClassTrialVerdictReview } from "./ClassTrialVerdictReview";

function makeGameWithReview(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "class-trial-review",
    day: 3,
    phase: "GAME_OVER",
    phaseLabel: "游戏结束",
    board: {
      id: "9p-seer-witch-hunter",
      name: "9人预女猎",
      description: "test",
      seatCount: 9,
      roleSummary: "3狼 3民 预言家 女巫 猎人",
      hasGuard: false,
      hasSheriff: false,
      winCondition: "side-slaughter",
    },
    humanSeatId: null,
    seats: [],
    publicEvents: [],
    privateEvents: [],
    availableActions: [],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      claimBoard: [],
      aiReasonHighlights: [],
      phaseSteps: [],
      tableMemory: {
        day: 3,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    result: { winner: "GOOD", reason: "所有狼人出局" },
    review: {
      result: { winner: "GOOD", reason: "所有狼人出局" },
      roleReveal: [
        { seatId: 1, name: "苗木诚", role: "VILLAGER", roleLabel: "平民", camp: "GOOD", alive: true },
        { seatId: 4, name: "黑白熊", role: "WEREWOLF", roleLabel: "狼人", camp: "WEREWOLVES", alive: false, deathReason: "EXILED" },
      ],
      claims: [],
      stanceShifts: [],
      strategyNotes: [],
      voteImpacts: [
        {
          day: 2,
          title: "票型放逐狼人",
          description: "黑白熊以 5 票出局，关键票中好人 4 票、狼人 1 票。",
          outcome: "exile",
          target: { seatId: 4, name: "黑白熊" },
          targetRole: "WEREWOLF",
          targetRoleLabel: "狼人",
          targetCamp: "WEREWOLVES",
          leaders: [{ target: { seatId: 4, name: "黑白熊" }, count: 5, role: "WEREWOLF", roleLabel: "狼人", camp: "WEREWOLVES" }],
          decisiveVoters: [{ seatId: 1, name: "苗木诚" }],
          goodVotes: 4,
          wolfVotes: 1,
          abstainCount: 0,
          totalVotes: 9,
        },
      ],
      aiInsights: [],
      playerFeedback: [],
      nightRounds: [],
      dayRounds: [],
      deathTimeline: [{ day: 2, seat: { seatId: 4, name: "黑白熊" }, reason: "EXILED", reasonLabel: "放逐" }],
      keyEvents: [{ seq: 99, day: 3, phase: "GAME_OVER", message: "好人阵营获胜：所有狼人出局。" }],
      turningPoints: [{ day: 2, title: "关键投票", description: "黑白熊被放逐，这是白天票型最直接的转折点。" }],
    },
    ...overrides,
  };
}

describe("ClassTrialVerdictReview", () => {
  it("renders the final verdict, evidence, vote fog, departures, and role reveal", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialVerdictReview, {
        game: makeGameWithReview(),
        onReturnHome: () => undefined,
      }),
    );

    expect(html).toContain("class-trial-verdict-review");
    expect(html).toContain("最终裁决");
    expect(html).toContain("好人阵营胜利");
    expect(html).toContain("所有狼人出局");
    expect(html).toContain("关键证据");
    expect(html).toContain("关键投票");
    expect(html).toContain("票型迷雾");
    expect(html).toContain("票型放逐狼人");
    expect(html).toContain("退场名单");
    expect(html).toContain("D2 · 4号黑白熊 · 放逐");
    expect(html).toContain("身份揭晓");
    expect(html).toContain("4号 · 黑白熊");
    expect(html).toContain("狼人");
  });

  it("does not crash when optional review arrays are empty", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialVerdictReview, {
        game: makeGameWithReview({
          review: {
            result: { winner: "WEREWOLVES", reason: "好人阵营无人存活" },
            roleReveal: [],
            claims: [],
            stanceShifts: [],
            strategyNotes: [],
            voteImpacts: [],
            aiInsights: [],
            playerFeedback: [],
            nightRounds: [],
            dayRounds: [],
            deathTimeline: [],
            keyEvents: [],
            turningPoints: [],
          },
          result: { winner: "WEREWOLVES", reason: "好人阵营无人存活" },
        }),
        onReturnHome: () => undefined,
      }),
    );

    expect(html).toContain("最终裁决");
    expect(html).toContain("狼人阵营胜利");
    expect(html).toContain("暂无退场记录");
  });

  it("shows a graceful fallback if the terminal view has no review yet", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialVerdictReview, {
        game: makeGameWithReview({ review: undefined }),
        onReturnHome: () => undefined,
      }),
    );

    expect(html).toContain("审判记录整理中");
    expect(html).toContain("返回首页");
  });
});

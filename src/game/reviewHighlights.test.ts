import { describe, expect, it } from "vitest";
import type { HumanGameView } from "./types";
import { buildReviewCredibilityHighlights } from "./reviewHighlights";

describe("buildReviewCredibilityHighlights", () => {
  it("summarizes result, claim truth, vote shape, and power actions from the review", () => {
    const game = {
      review: {
        result: { winner: "GOOD", reason: "狼人全部出局" },
        claims: [
          {
            claimant: { seatId: 2, name: "Claude" },
            claimedRole: "SEER",
            claimedRoleLabel: "预言家",
            trueRole: "WEREWOLF",
            trueRoleLabel: "狼人",
            truthful: false,
            isCounterclaim: true,
            checks: [],
          },
        ],
        voteImpacts: [
          {
            day: 1,
            title: "D1 放逐狼人",
            description: "好人票集中，狼人被推出局。",
            outcome: "exile",
            target: { seatId: 2, name: "Claude" },
            targetRole: "WEREWOLF",
            targetRoleLabel: "狼人",
            targetCamp: "WEREWOLVES",
            leaders: [],
            decisiveVoters: [{ seatId: 1, name: "You" }],
            goodVotes: 4,
            wolfVotes: 1,
            abstainCount: 0,
            totalVotes: 5,
          },
        ],
        turningPoints: [{ day: 1, title: "骑士没有乱戳", description: "技能保留后，票型继续形成。" }],
        roleReveal: [],
        stanceShifts: [],
        strategyNotes: [],
        aiInsights: [],
        playerFeedback: [],
        nightRounds: [],
        dayRounds: [],
        deathTimeline: [{ day: 1, seat: { seatId: 4, name: "GPT" }, reason: "NIGHT_KILL", reasonLabel: "夜间死亡" }],
        keyEvents: [],
      },
    } as unknown as HumanGameView;

    const titles = buildReviewCredibilityHighlights(game).map((item) => item.title);

    expect(titles).toContain("胜负原因");
    expect(titles).toContain("身份线");
    expect(titles).toContain("票型");
    expect(titles).toContain("关键转折");
  });
});

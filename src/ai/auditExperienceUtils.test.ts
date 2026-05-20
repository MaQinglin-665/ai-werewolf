import { describe, expect, it } from "vitest";
import {
  buildSeerGoldTargets,
  isProtectedSeerGoldVoteTarget,
  shouldWarnWolfTeamVote,
} from "../../scripts/audit-ai-experience-utils.mjs";

describe("wolf teammate vote audit classification", () => {
  it("does not warn for classified planned distance or emergency cut votes", () => {
    expect(shouldWarnWolfTeamVote({ votePlan: { wolfVoteTactic: "planned_distance" } })).toBe(false);
    expect(shouldWarnWolfTeamVote({ votePlan: { wolfVoteTactic: "emergency_cut" } })).toBe(false);
  });

  it("keeps warnings for unclassified or low-value teammate vote tactics", () => {
    expect(shouldWarnWolfTeamVote({})).toBe(true);
    expect(shouldWarnWolfTeamVote({ votePlan: {} })).toBe(true);
    expect(shouldWarnWolfTeamVote({ votePlan: { wolfVoteTactic: "team_target" } })).toBe(true);
    expect(shouldWarnWolfTeamVote({ votePlan: { wolfVoteTactic: "avoid_teammate" } })).toBe(true);
  });
});

describe("seer gold vote audit classification", () => {
  it("uses the public day of each gold check instead of the seer claim start day", () => {
    const state = {
      roleClaims: [
        {
          claimantSeatId: 7,
          claimedRole: "SEER",
          day: 1,
          checks: [
            { day: 1, targetSeatId: 9, result: "WEREWOLF" },
            { day: 2, targetSeatId: 8, result: "GOOD" },
          ],
        },
      ],
    };

    expect(buildSeerGoldTargets(state, 7)).toEqual([{ targetSeatId: 8, claimDay: 2 }]);
  });

  it("only treats gold votes as protected after the seer death is public", () => {
    const goldTargets = [{ targetSeatId: 8, claimDay: 2 }];

    expect(isProtectedSeerGoldVoteTarget(goldTargets, 8, undefined, 2)).toBe(false);
    expect(isProtectedSeerGoldVoteTarget(goldTargets, 8, 3, 2)).toBe(false);
    expect(isProtectedSeerGoldVoteTarget(goldTargets, 8, 3, 3)).toBe(true);
  });
});

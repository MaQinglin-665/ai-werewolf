import { describe, expect, it } from "vitest";
import { shouldWarnWolfTeamVote } from "../../scripts/audit-ai-experience-utils.mjs";

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

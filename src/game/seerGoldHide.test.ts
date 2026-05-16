import { describe, expect, it } from "vitest";
import { createSpeechPlan } from "@/ai/tableRead";
import type { AgentView, ClaimBoardItem, TableMemory } from "./types";

describe("seer gold-water reveal timing", () => {
  it("keeps an unpressured day-two good check hidden", () => {
    const plan = createSpeechPlan(seerView({ day: 2, result: "GOOD" }));

    expect(plan.kind).toBe("defend");
    expect(plan.claimIntent).toBeUndefined();
  });

  it("reveals a wolf check immediately", () => {
    const plan = createSpeechPlan(seerView({ day: 2, result: "WEREWOLF" }));

    expect(plan.kind).toBe("claim-check");
    expect(plan.claimIntent).toMatchObject({
      claimedRole: "SEER",
      check: { targetSeatId: 2, result: "WEREWOLF" },
    });
  });

  it("reveals a good check after holding it into day three", () => {
    const plan = createSpeechPlan(seerView({ day: 3, result: "GOOD" }));

    expect(plan.kind).toBe("claim-check");
    expect(plan.claimIntent).toMatchObject({
      claimedRole: "SEER",
      check: { targetSeatId: 2, result: "GOOD" },
    });
  });

  it("reveals a good check immediately on wolf-king sheriff boards", () => {
    const plan = createSpeechPlan(
      seerView({
        day: 1,
        result: "GOOD",
        rules: {
          hasGuard: true,
          guardSaveConflictKills: true,
          hasWolfBeauty: false,
          hasKnight: false,
          wolfRoles: ["WEREWOLF", "WOLF_KING"],
        },
        aliveSeatCount: 12,
      }),
    );

    expect(plan.kind).toBe("claim-check");
    expect(plan.claimIntent).toMatchObject({
      claimedRole: "SEER",
      check: { targetSeatId: 2, result: "GOOD" },
    });
  });

  it("continues reporting good checks after the seer already claimed", () => {
    const selfClaim = seerClaim();
    const plan = createSpeechPlan(
      seerView({
        day: 2,
        result: "GOOD",
        tableMemory: emptyTableMemory({ claimBoard: [selfClaim] }),
      }),
    );

    expect(plan.kind).toBe("claim-check");
    expect(plan.claimIntent?.check?.result).toBe("GOOD");
  });
});

function seerView({
  day,
  result,
  tableMemory = emptyTableMemory(),
  rules = { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false },
  aliveSeatCount = 2,
}: {
  day: number;
  result: "WEREWOLF" | "GOOD";
  tableMemory?: TableMemory;
  rules?: AgentView["rules"];
  aliveSeatCount?: number;
}): AgentView {
  const aliveSeats = [
    { seatId: 1, name: "Seer" },
    { seatId: 2, name: "Target" },
    ...Array.from({ length: Math.max(0, aliveSeatCount - 2) }, (_, index) => ({
      seatId: index + 3,
      name: `${index + 3}号`,
    })),
  ];

  return {
    gameId: "test",
    mySeatId: 1,
    myRole: "SEER",
    phase: "DAY_SPEECH",
    day,
    rules,
    aliveSeats,
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: tableMemory.claimBoard,
      tableMemory,
    },
    privateKnowledge: {
      seerChecks: [{ day, seerSeatId: 1, targetSeatId: 2, result }],
    },
    allowedActions: [{ type: "speak" }],
  } as AgentView;
}

function seerClaim(): ClaimBoardItem {
  return {
    claimId: "seer-1",
    claimant: { seatId: 1, name: "Seer" },
    claimedRole: "SEER",
    claimedRoleLabel: "预言家",
    strength: "hard",
    checks: [],
    summary: "Seer has claimed.",
    lastUpdatedDay: 2,
    sourceSpeechSeq: 10,
  };
}

function emptyTableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 2,
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
    ...overrides,
  };
}

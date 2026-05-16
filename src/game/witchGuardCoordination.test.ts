import { describe, expect, it } from "vitest";
import { createMockCommand } from "@/ai/mockAgent";
import type { AgentView, AiTableRead, ClaimBoardItem, SeatRead, TableMemory } from "./types";

describe("witch and guard save coordination", () => {
  it("does not antidote a public seer on a guard-conflict board", () => {
    const seerClaim = publicSeerClaim();
    const command = createMockCommand(
      witchView({
        rules: { hasGuard: true, guardSaveConflictKills: true, hasWolfBeauty: false, hasKnight: false },
        saveTarget: { seatId: 2, name: "Public Seer" },
      }),
      tableRead([
        seatRead({
          seatId: 2,
          name: "Public Seer",
          publicClaims: [seerClaim],
        }),
      ]),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "skip",
    });
  });

  it("still antidotes a public seer when there is no guard-save conflict rule", () => {
    const seerClaim = publicSeerClaim();
    const command = createMockCommand(
      witchView({
        rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false },
        saveTarget: { seatId: 2, name: "Public Seer" },
      }),
      tableRead([
        seatRead({
          seatId: 2,
          name: "Public Seer",
          publicClaims: [seerClaim],
        }),
      ]),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "save",
    });
  });
});

function witchView({
  rules,
  saveTarget,
}: {
  rules: AgentView["rules"];
  saveTarget: { seatId: number; name: string };
}): AgentView {
  return {
    gameId: "test",
    mySeatId: 1,
    myRole: "WITCH",
    phase: "NIGHT_WITCH",
    day: 2,
    rules,
    publicEvents: [],
    aliveSeats: [
      { seatId: 1, name: "Witch" },
      saveTarget,
    ],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory: emptyTableMemory(),
    },
    privateKnowledge: {},
    allowedActions: [
      {
        type: "witchAction",
        canSave: true,
        saveTarget,
        canPoison: false,
        poisonTargets: [],
      },
    ],
  } as AgentView;
}

function tableRead(seats: SeatRead[]): AiTableRead {
  const self = seatRead({
    seatId: 1,
    name: "Witch",
    suspicion: 0,
    trust: 100,
    pressure: ["self"],
    isSelf: true,
  });

  return {
    mySeatId: 1,
    myRole: "WITCH",
    day: 2,
    seats: [self, ...seats],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [],
    focus: seats[0],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory: emptyTableMemory(),
    tableMood: "test",
  } as AiTableRead;
}

function seatRead(overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    seatId: 2,
    name: "Seat",
    suspicion: 50,
    trust: 50,
    pressure: [],
    isSelf: false,
    isKnownWolf: false,
    isKnownGood: false,
    isWolfTeammate: false,
    speechCount: 1,
    votesReceived: 0,
    publicClaims: [],
    publicChecksAgainst: [],
    publicStancesGiven: [],
    publicStancedBy: [],
    ...overrides,
  };
}

function publicSeerClaim(): ClaimBoardItem {
  return {
    claimId: "seer-2",
    claimant: { seatId: 2, name: "Public Seer" },
    claimedRole: "SEER",
    claimedRoleLabel: "预言家",
    strength: "hard",
    checks: [],
    summary: "Public Seer claims seer.",
    lastUpdatedDay: 2,
    sourceSpeechSeq: 10,
  };
}

function emptyTableMemory(): TableMemory {
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
  };
}

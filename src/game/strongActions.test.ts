import { describe, expect, it } from "vitest";
import { createMockCommand } from "@/ai/mockAgent";
import type { ActionTarget, AgentView, AiTableRead, SeatRead } from "./types";

describe("mock AI strong actions", () => {
  it("skips a hunter shot when suspicion only comes from personal or vote noise", () => {
    const command = createMockCommand(hunterView(), tableReadWithTarget({ pressure: ["投过我", "当前吃到 1 票"] }));

    expect(command).toMatchObject({
      type: "hunterShoot",
      targetSeatId: undefined,
    });
  });

  it("allows a hunter shot when the target has public pressure evidence", () => {
    const command = createMockCommand(
      hunterView(),
      tableReadWithTarget({
        pressure: ["Claude施压这里"],
        publicStancedBy: [
          {
            stanceId: "3:2:PRESSURE:ANY:1:0",
            day: 2,
            actor: { seatId: 3, name: "Claude" },
            target: { seatId: 2, name: "Target" },
            kind: "PRESSURE",
            kindLabel: "施压",
            summary: "施压Target",
          },
        ],
      }),
    );

    expect(command).toMatchObject({
      type: "hunterShoot",
      targetSeatId: 2,
    });
  });

  it("falls through to the best eligible hunter shot target when the top suspicion is only noise", () => {
    const tableRead = tableReadWithTarget({
      suspicion: 98,
      trust: 20,
      pressure: ["投过我", "当前吃到 2 票"],
      votesReceived: 2,
    });
    tableRead.seats.push({
      ...tableRead.seats[1],
      seatId: 3,
      name: "Eligible",
      suspicion: 88,
      trust: 40,
      pressure: ["Claude施压这里"],
      publicStancedBy: [
        {
          stanceId: "4:3:PRESSURE:ANY:1:0",
          day: 2,
          actor: { seatId: 4, name: "Claude" },
          target: { seatId: 3, name: "Eligible" },
          kind: "PRESSURE",
          kindLabel: "施压",
          summary: "施压Eligible",
        },
      ],
    });

    const command = createMockCommand(
      hunterView([
        { seatId: 2, name: "Target" },
        { seatId: 3, name: "Eligible" },
      ]),
      tableRead,
    );

    expect(command).toMatchObject({
      type: "hunterShoot",
      targetSeatId: 3,
    });
  });
});

function hunterView(targets: ActionTarget[] = [{ seatId: 2, name: "Target" }]): AgentView {
  return {
    gameId: "test",
    mySeatId: 1,
    myRole: "HUNTER",
    phase: "HUNTER_SHOT",
    day: 2,
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false },
    aliveSeats: [
      { seatId: 1, name: "Hunter" },
      ...targets,
    ],
    publicEvents: [],
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
    allowedActions: [{ type: "hunterShoot", targets, canSkip: true }],
  } as AgentView;
}

function tableReadWithTarget(overrides: Partial<SeatRead>): AiTableRead {
  const target = {
    seatId: 2,
    name: "Target",
    suspicion: 88,
    trust: 40,
    pressure: [],
    isSelf: false,
    isKnownWolf: false,
    isKnownGood: false,
    isWolfTeammate: false,
    speechCount: 1,
    votesReceived: 1,
    publicClaims: [],
    publicChecksAgainst: [],
    publicStancesGiven: [],
    publicStancedBy: [],
    ...overrides,
  } satisfies SeatRead;

  return {
    mySeatId: 1,
    myRole: "HUNTER",
    day: 2,
    seats: [
      {
        ...target,
        seatId: 1,
        name: "Hunter",
        suspicion: 0,
        trust: 100,
        pressure: ["自己视角"],
        isSelf: true,
      },
      target,
    ],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [],
    focus: target,
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory: emptyTableMemory(),
    tableMood: "test",
  } as AiTableRead;
}

function emptyTableMemory(): AgentView["publicSummary"]["tableMemory"] {
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

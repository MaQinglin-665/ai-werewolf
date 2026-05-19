import { describe, expect, it } from "vitest";
import { createVotePlan } from "./tableRead";
import type { ActionTarget, AgentView, AiTableRead, SeatRead, TableMemory } from "@/game/types";

describe("wolf voting distance", () => {
  it("does not vote a teammate when there is no public table reason", () => {
    const wolf = { seatId: 1, name: "Wolf Voter" };
    const teammate = { seatId: 2, name: "Quiet Teammate" };
    const outsider = { seatId: 3, name: "Open Focus" };
    const memory = tableMemory({
      focus: [{ seat: outsider, reasons: ["公开发言焦点"], score: 55 }],
    });

    const plan = createVotePlan(
      wolfVoteView(wolf, [teammate], [teammate, outsider], memory),
      tableRead(
        [
          seatRead({
            ...teammate,
            isWolfTeammate: true,
            suspicion: 88,
            trust: 32,
          }),
          seatRead({
            ...outsider,
            suspicion: 58,
            trust: 45,
            pressure: ["公开发言焦点"],
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(outsider.seatId);
    expect(plan.reason).not.toMatch(/队友|狼队|同狼/);
  });
});

function wolfVoteView(
  wolf: ActionTarget,
  wolfTeammates: ActionTarget[],
  targets: ActionTarget[],
  tableMemory: TableMemory,
): AgentView {
  return {
    gameId: "test",
    mySeatId: wolf.seatId,
    myRole: "WEREWOLF",
    phase: "DAY_VOTE",
    day: 2,
    rules: {
      hasGuard: false,
      guardSaveConflictKills: false,
      hasWolfBeauty: false,
      hasKnight: false,
      wolfRoles: ["WEREWOLF"],
    },
    persona: {
      id: "high-risk-wolf",
      name: "High Risk",
      label: "悍跳型",
      modelLabel: "High Risk",
      style: "aggressive",
      goal: "survive",
      riskTolerance: 0.98,
      bluffing: 0.98,
    },
    aliveSeats: [wolf, ...targets],
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
      wolfTeammates,
      wolfTeamPlan: {
        day: 2,
        strategy: "SHADOW",
        summary: "test",
        assignments: [
          {
            seat: wolf,
            task: "DISTANCE",
            taskLabel: "切割倒钩",
            supportSeat: wolfTeammates[0],
            reason: "test distance",
          },
        ],
      },
    },
    allowedActions: [
      {
        type: "vote",
        targets,
        canAbstain: false,
      },
    ],
  } as AgentView;
}

function tableRead(seats: SeatRead[], tableMemory: TableMemory): AiTableRead {
  return {
    mySeatId: 1,
    myRole: "WEREWOLF",
    day: 2,
    seats: [
      seatRead({
        seatId: 1,
        name: "Wolf Voter",
        suspicion: 0,
        trust: 100,
        isSelf: true,
      }),
      ...seats,
    ],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [2],
    focus: seats[0],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory,
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

function tableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
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

import { describe, expect, it } from "vitest";
import { createVotePlan } from "./tableRead";
import type { ActionTarget, AgentView, AiTableRead, SeatRead, StanceBoardItem, TableMemory, WolfTeamAssignment } from "@/game/types";

describe("wolf voting discipline", () => {
  it("follows the assigned non-teammate day target for PUSH_MISLYNCH", () => {
    const wolf = target(1, "Wolf Voter");
    const teammate = target(2, "Quiet Teammate");
    const assigned = target(3, "Assigned Outsider");
    const noisy = target(4, "Noisy Outsider");
    const memory = tableMemory({
      focus: [
        { seat: noisy, reasons: ["public noise"], score: 90 },
        { seat: assigned, reasons: ["team target"], score: 55 },
      ],
    });

    const plan = createVotePlan(
      wolfVoteView({
        wolf,
        wolfTeammates: [teammate],
        targets: [teammate, assigned, noisy],
        tableMemory: memory,
        assignment: assignmentFor(wolf, "PUSH_MISLYNCH", assigned),
      }),
      tableRead(
        [
          seatRead({ ...teammate, isWolfTeammate: true, suspicion: 92, trust: 18 }),
          seatRead({ ...assigned, suspicion: 54, trust: 46, pressure: ["open table focus"] }),
          seatRead({ ...noisy, suspicion: 88, trust: 24, pressure: ["loud but not the wolf plan"] }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(assigned.seatId);
    expect(plan.wolfVoteTactic).toBe("team_target");
    expect(plan.reason).not.toMatch(/teammate|wolf team|WEREWOLF|private/i);
  });

  it("uses a non-teammate target for HIDE when teammate pressure is weak", () => {
    const wolf = target(1, "Wolf Voter");
    const teammate = target(2, "Weak Pressure Teammate");
    const outsider = target(3, "Open Focus");
    const memory = tableMemory({
      focus: [{ seat: outsider, reasons: ["public focus"], score: 55 }],
    });

    const plan = createVotePlan(
      wolfVoteView({
        wolf,
        wolfTeammates: [teammate],
        targets: [teammate, outsider],
        tableMemory: memory,
        assignment: assignmentFor(wolf, "HIDE"),
      }),
      tableRead(
        [
          seatRead({
            ...teammate,
            isWolfTeammate: true,
            suspicion: 88,
            trust: 32,
            pressure: ["single weak question"],
            publicStancedBy: [stance({ actor: outsider, target: teammate, kind: "QUESTION" })],
          }),
          seatRead({
            ...outsider,
            suspicion: 58,
            trust: 45,
            pressure: ["public focus"],
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(outsider.seatId);
    expect(plan.wolfVoteTactic).toBe("avoid_teammate");
    expect(plan.reason).not.toMatch(/teammate|wolf team|WEREWOLF|private/i);
  });

  it("allows assigned DISTANCE teammate vote only under hard public pressure", () => {
    const wolf = target(1, "Wolf Voter");
    const teammate = target(2, "Compromised Claimant");
    const outsider = target(3, "Open Outsider");
    const publicActorA = target(4, "Question A");
    const publicActorB = target(5, "Question B");
    const memory = tableMemory({
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "seer",
          claimants: [teammate, publicActorA],
        },
      ],
      reasoningCues: [
        {
          cueId: "cue-distance-1",
          day: 2,
          kind: "counterclaim",
          weight: "strong",
          target: teammate,
          summary: "counterclaim pressure",
          evidence: ["two public players are pressing the claim"],
        },
      ],
    });

    const plan = createVotePlan(
      wolfVoteView({
        wolf,
        wolfTeammates: [teammate],
        targets: [teammate, outsider],
        tableMemory: memory,
        assignment: assignmentFor(wolf, "DISTANCE", undefined, teammate),
      }),
      tableRead(
        [
          seatRead({
            ...teammate,
            isWolfTeammate: true,
            suspicion: 88,
            trust: 18,
            publicClaims: [claim({ claimant: teammate })],
            publicChecksAgainst: [{ claimant: publicActorA, result: "WEREWOLF", day: 2 }],
            publicStancedBy: [
              stance({ actor: publicActorA, target: teammate, kind: "PRESSURE" }),
              stance({ actor: publicActorB, target: teammate, kind: "QUESTION" }),
            ],
          }),
          seatRead({ ...outsider, suspicion: 48, trust: 50, pressure: ["ordinary focus"] }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(teammate.seatId);
    expect(plan.wolfVoteTactic).toBe("planned_distance");
    expect(plan.reason).not.toMatch(/teammate|wolf team|WEREWOLF|private/i);
  });
});

function target(seatId: number, name: string): ActionTarget {
  return { seatId, name };
}

function assignmentFor(
  wolf: ActionTarget,
  task: WolfTeamAssignment["task"],
  dayTarget?: ActionTarget,
  supportSeat?: ActionTarget,
): WolfTeamAssignment {
  return {
    seat: wolf,
    task,
    taskLabel: task,
    target: dayTarget,
    supportSeat,
    reason: `${task} test assignment`,
  };
}

function wolfVoteView({
  wolf,
  wolfTeammates,
  targets,
  tableMemory,
  assignment,
}: {
  wolf: ActionTarget;
  wolfTeammates: ActionTarget[];
  targets: ActionTarget[];
  tableMemory: TableMemory;
  assignment: WolfTeamAssignment;
}): AgentView {
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
      label: "High Risk",
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
        assignments: [assignment],
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

function stance({
  actor,
  target,
  kind,
}: {
  actor: ActionTarget;
  target: ActionTarget;
  kind: StanceBoardItem["kind"];
}): StanceBoardItem {
  return {
    stanceId: `stance-${actor.seatId}-${target.seatId}-${kind}`,
    day: 2,
    actor,
    target,
    kind,
    kindLabel: kind,
    summary: `${actor.name} ${kind} ${target.name}`,
  };
}

function claim({ claimant }: { claimant: ActionTarget }) {
  return {
    claimId: `claim-${claimant.seatId}`,
    claimant,
    claimedRole: "SEER" as const,
    claimedRoleLabel: "seer",
    strength: "hard" as const,
    checks: [],
    summary: `${claimant.name} claims seer`,
    lastUpdatedDay: 2,
  };
}

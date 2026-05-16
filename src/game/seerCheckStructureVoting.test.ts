import { describe, expect, it } from "vitest";
import { createVotePlan } from "@/ai/tableRead";
import type { ActionTarget, AgentView, AiTableRead, ClaimBoardItem, SeatRead, TableMemory } from "./types";

describe("seer counterclaim check-structure voting", () => {
  it("prefers pressuring a black-only seer counterclaim over a gold-water line", () => {
    const goldClaim = seerClaim({ seatId: 2, name: "Gold Seer" }, [
      { day: 1, target: { seatId: 9, name: "Gold Target" }, result: "GOOD" },
    ]);
    const blackOnlyClaim = seerClaim({ seatId: 3, name: "Black-Only Seer" }, [
      { day: 1, target: { seatId: 8, name: "Black Target" }, result: "WEREWOLF" },
    ]);
    const memory = tableMemory({
      claimBoard: [goldClaim, blackOnlyClaim],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [goldClaim.claimant, blackOnlyClaim.claimant],
        },
      ],
    });

    const plan = createVotePlan(
      voteView(memory),
      tableRead(
        [
          seatRead({
            seatId: 2,
            name: "Gold Seer",
            suspicion: 90,
            trust: 60,
            publicClaims: [goldClaim],
          }),
          seatRead({
            seatId: 3,
            name: "Black-Only Seer",
            suspicion: 82,
            trust: 60,
            publicClaims: [blackOnlyClaim],
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(3);
  });

  it("does not consolidate votes onto a trusted public gold-water target", () => {
    const trustedSeerClaim = seerClaim({ seatId: 2, name: "Trusted Seer" }, [
      { day: 2, target: { seatId: 3, name: "Gold Target" }, result: "GOOD" },
    ]);
    const memory = tableMemory({
      claimBoard: [trustedSeerClaim],
      focus: [{ seat: { seatId: 3, name: "Gold Target" }, reasons: ["public focus"], score: 60 }],
    });

    const plan = createVotePlan(
      voteView(memory, [
        { seatId: 3, name: "Gold Target" },
        { seatId: 4, name: "Open Focus" },
      ]),
      tableRead(
        [
          seatRead({
            seatId: 2,
            name: "Trusted Seer",
            suspicion: 18,
            trust: 88,
            publicClaims: [trustedSeerClaim],
          }),
          seatRead({
            seatId: 3,
            name: "Gold Target",
            suspicion: 95,
            trust: 24,
          }),
          seatRead({
            seatId: 4,
            name: "Open Focus",
            suspicion: 56,
            trust: 42,
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(4);
  });

  it("lets a trusted gold-water voter follow the trusted seer black-check line", () => {
    const trustedSeerClaim = seerClaim({ seatId: 2, name: "Trusted Seer" }, [
      { day: 2, target: { seatId: 1, name: "Gold Voter" }, result: "GOOD" },
      { day: 2, target: { seatId: 4, name: "Black Target" }, result: "WEREWOLF" },
    ]);
    const memory = tableMemory({ claimBoard: [trustedSeerClaim] });

    const plan = createVotePlan(
      voteView(memory, [
        { seatId: 4, name: "Black Target" },
        { seatId: 5, name: "Alternative" },
      ]),
      tableRead(
        [
          seatRead({
            seatId: 2,
            name: "Trusted Seer",
            suspicion: 18,
            trust: 88,
            publicClaims: [trustedSeerClaim],
          }),
          seatRead({
            seatId: 4,
            name: "Black Target",
            suspicion: 48,
            trust: 48,
            publicChecksAgainst: [{ claimant: trustedSeerClaim.claimant, result: "WEREWOLF", day: 2 }],
          }),
          seatRead({
            seatId: 5,
            name: "Alternative",
            suspicion: 72,
            trust: 36,
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(4);
  });

  it("does not day-one consolidate onto a gold-claim seer only because of a reactive black check", () => {
    const goldSeerClaim = seerClaim(
      { seatId: 2, name: "Gold Seer" },
      [{ day: 1, target: { seatId: 9, name: "Gold Target" }, result: "GOOD" }],
      10,
    );
    const reactiveBlackClaim = seerClaim(
      { seatId: 3, name: "Reactive Seer" },
      [{ day: 1, target: { seatId: 2, name: "Gold Seer" }, result: "WEREWOLF" }],
      20,
    );
    const memory = tableMemory({
      claimBoard: [goldSeerClaim, reactiveBlackClaim],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [goldSeerClaim.claimant, reactiveBlackClaim.claimant],
        },
      ],
      focus: [{ seat: { seatId: 4, name: "Open Focus" }, reasons: ["public focus"], score: 55 }],
    });

    const plan = createVotePlan(
      voteView(
        memory,
        [
          { seatId: 2, name: "Gold Seer" },
          { seatId: 3, name: "Reactive Seer" },
          { seatId: 4, name: "Open Focus" },
        ],
        1,
      ),
      tableRead(
        [
          seatRead({
            seatId: 2,
            name: "Gold Seer",
            suspicion: 78,
            trust: 58,
            publicClaims: [goldSeerClaim],
            publicChecksAgainst: [{ claimant: reactiveBlackClaim.claimant, result: "WEREWOLF", day: 1 }],
          }),
          seatRead({
            seatId: 3,
            name: "Reactive Seer",
            suspicion: 62,
            trust: 54,
            publicClaims: [reactiveBlackClaim],
          }),
          seatRead({
            seatId: 4,
            name: "Open Focus",
            suspicion: 60,
            trust: 42,
          }),
        ],
        memory,
        1,
      ),
    );

    expect(plan.target.seatId).not.toBe(2);
  });
});

function voteView(
  tableMemory: TableMemory,
  targets: ActionTarget[] = [
    { seatId: 2, name: "Gold Seer" },
    { seatId: 3, name: "Black-Only Seer" },
  ],
  day = 2,
): AgentView {
  return {
    gameId: "test",
    mySeatId: 1,
    myRole: "VILLAGER",
    phase: "DAY_VOTE",
    day,
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false },
    aliveSeats: [{ seatId: 1, name: "Voter" }, ...targets],
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
    privateKnowledge: {},
    allowedActions: [
      {
        type: "vote",
        targets,
        canAbstain: false,
      },
    ],
  } as AgentView;
}

function tableRead(seats: SeatRead[], tableMemory: TableMemory, day = 2): AiTableRead {
  const self = seatRead({
    seatId: 1,
    name: "Voter",
    suspicion: 0,
    trust: 100,
    isSelf: true,
    pressure: ["self"],
  });

  return {
    mySeatId: 1,
    myRole: "VILLAGER",
    day,
    seats: [self, ...seats],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [],
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

function seerClaim(claimant: ActionTarget, checks: ClaimBoardItem["checks"], sourceSpeechSeq = 10 + claimant.seatId): ClaimBoardItem {
  return {
    claimId: `seer-${claimant.seatId}`,
    claimant,
    claimedRole: "SEER",
    claimedRoleLabel: "预言家",
    strength: "hard",
    checks,
    summary: `${claimant.name} claims seer.`,
    lastUpdatedDay: 2,
    sourceSpeechSeq,
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

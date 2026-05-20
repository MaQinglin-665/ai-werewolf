import { describe, expect, it } from "vitest";
import { createMockCommand } from "@/ai/mockAgent";
import type {
  ActionTarget,
  AgentView,
  AiTableRead,
  ClaimBoardItem,
  PublicReasoningCue,
  SeatRead,
  StanceBoardItem,
  TableMemory,
} from "./types";

describe("mock AI witch poison evidence", () => {
  it("skips poison when a target only has generic public pressure", () => {
    const target = seatRead({
      suspicion: 100,
      trust: 42,
      pressure: ["speech is thin", "current vote leader"],
      publicStancedBy: [
        stance(3, 2, "QUESTION"),
        stance(4, 2, "PRESSURE"),
        stance(5, 2, "QUESTION"),
        stance(6, 2, "PRESSURE"),
        stance(7, 2, "QUESTION"),
      ],
      votesReceived: 4,
    });

    const command = createMockCommand(witchView(), tableRead([target]));

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "skip",
    });
  });

  it("allows poison on a strongly pressured seer counterclaimant", () => {
    const targetClaim = seerClaim({ seatId: 2, name: "Target" }, 12);
    const otherClaim = seerClaim({ seatId: 3, name: "Other Seer" }, 8);
    const target = seatRead({
      suspicion: 100,
      trust: 55,
      pressure: ["seer counterclaim", "vote pressure"],
      publicClaims: [targetClaim],
      publicStancedBy: [stance(4, 2, "PRESSURE"), stance(5, 2, "QUESTION")],
      votesReceived: 3,
    });

    const command = createMockCommand(
      witchView(),
      tableRead([target, seatRead({ seatId: 3, name: "Other Seer", publicClaims: [otherClaim] })], {
        claimBoard: [targetClaim, otherClaim],
        counterclaims: [
          {
            claimedRole: "SEER",
            claimedRoleLabel: "预言家",
            claimants: [targetClaim.claimant, otherClaim.claimant],
          },
        ],
      }),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "poison",
      targetSeatId: 2,
    });
  });

  it("does not poison from an untrusted public black check alone", () => {
    const fakeClaim = seerClaim({ seatId: 3, name: "Fake Seer" }, 8);
    const target = seatRead({
      suspicion: 100,
      trust: 43,
      pressure: ["black check from an untrusted claimant"],
      publicChecksAgainst: [{ claimant: fakeClaim.claimant, result: "WEREWOLF", day: 2 }],
    });
    const fakeSeer = seatRead({
      seatId: 3,
      name: "Fake Seer",
      suspicion: 82,
      trust: 45,
      publicClaims: [fakeClaim],
    });

    const command = createMockCommand(
      witchView(),
      tableRead([target, fakeSeer], {
        claimBoard: [fakeClaim],
      }),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "skip",
    });
  });

  it("allows poison from a dead seer legacy black check", () => {
    const legacySeer = { seatId: 3, name: "Dead Seer" };
    const target = seatRead({
      suspicion: 92,
      trust: 44,
      pressure: ["dead seer legacy black check"],
    });

    const command = createMockCommand(
      witchView(),
      tableRead([target], {
        seerLegacies: [
          {
            claimant: legacySeer,
            deathDay: 2,
            checks: [{ day: 1, target: { seatId: 2, name: "Target" }, result: "WEREWOLF" }],
            stancesGiven: [],
            summary: "Dead Seer left a black check.",
          },
        ],
      }),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "poison",
      targetSeatId: 2,
    });
  });

  it("does not poison from an exiled seer legacy black check alone", () => {
    const legacySeer = { seatId: 3, name: "Exiled Seer Claimant" };
    const target = seatRead({
      suspicion: 92,
      trust: 44,
      pressure: ["dead seer legacy black check"],
    });

    const command = createMockCommand(
      witchView(),
      tableRead([target], {
        seerLegacies: [
          {
            claimant: legacySeer,
            deathDay: 2,
            deathKind: "exile",
            checks: [{ day: 1, target: { seatId: 2, name: "Target" }, result: "WEREWOLF" }],
            stancesGiven: [],
            summary: "Exiled seer claimant left a black check.",
          },
        ],
      }),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "skip",
    });
  });

  it("allows poison from a strong public reasoning loop and explains the evidence", () => {
    const target = { seatId: 2, name: "Target" };
    const command = createMockCommand(
      witchView(),
      tableRead(
        [
          seatRead({
            suspicion: 94,
            trust: 42,
            pressure: ["站边和票型没有闭环"],
            publicStancedBy: [stance(4, 2, "PRESSURE"), stance(5, 2, "QUESTION")],
          }),
        ],
        {
          reasoningCues: [
            reasoningCue(target, "vote", "strong", "站边和上一轮票型断开", ["先质疑预言家又跟票同一边"]),
          ],
        },
      ),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "poison",
      targetSeatId: 2,
    });
    expect(command.reason).toContain("站边和上一轮票型断开");
    expect(command.reason).toContain("先质疑预言家又跟票同一边");
  });

  it("skips poison from a lone strong reasoning cue without corroboration", () => {
    const target = { seatId: 2, name: "Target" };
    const command = createMockCommand(
      witchView(),
      tableRead(
        [
          seatRead({
            suspicion: 96,
            trust: 42,
            pressure: ["站边和票型没有闭环"],
            publicStancedBy: [stance(4, 2, "PRESSURE")],
          }),
        ],
        {
          reasoningCues: [
            reasoningCue(target, "vote", "strong", "站边和上一轮票型断开", ["先质疑预言家又跟票同一边"]),
          ],
        },
      ),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "skip",
    });
  });

  it("does not let an untrusted black check become poisonable through public pressure", () => {
    const fakeClaim = seerClaim({ seatId: 9, name: "Fake Seer" }, 20);
    const target = { seatId: 2, name: "Target" };
    const command = createMockCommand(
      witchView(),
      tableRead(
        [
          seatRead({
            suspicion: 100,
            trust: 42,
            pressure: ["被Fake Seer公开报查杀", "站边和票型没有闭环"],
            publicChecksAgainst: [{ claimant: fakeClaim.claimant, result: "WEREWOLF", day: 2 }],
            publicStancedBy: [stance(4, 2, "QUESTION"), stance(5, 2, "PRESSURE"), stance(9, 2, "PRESSURE")],
          }),
        ],
        {
          claimBoard: [fakeClaim],
          reasoningCues: [
            reasoningCue(target, "speech_influence", "strong", "Target被多名后续发言者接住压力", [
              "Seat 4后续继续施压Target",
              "Fake Seer后续继续施压Target",
            ]),
          ],
        },
      ),
    );

    expect(command).toMatchObject({
      type: "witchAction",
      mode: "skip",
    });
  });
});

function witchView(): AgentView {
  return {
    gameId: "test",
    mySeatId: 1,
    myRole: "WITCH",
    phase: "NIGHT_WITCH",
    day: 2,
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false },
    aliveSeats: [
      { seatId: 1, name: "Witch" },
      { seatId: 2, name: "Target" },
      { seatId: 3, name: "Other Seer" },
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
    allowedActions: [
      {
        type: "witchAction",
        canSave: false,
        canPoison: true,
        poisonTargets: [{ seatId: 2, name: "Target" }],
      },
    ],
  } as AgentView;
}

function tableRead(seats: SeatRead[], memoryOverrides: Partial<TableMemory> = {}): AiTableRead {
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
    tableMemory: emptyTableMemory(memoryOverrides),
    tableMood: "test",
  } as AiTableRead;
}

function seatRead(overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    seatId: 2,
    name: "Target",
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

function seerClaim(claimant: ActionTarget, seq: number): ClaimBoardItem {
  return {
    claimId: `seer-${claimant.seatId}`,
    claimant,
    claimedRole: "SEER",
    claimedRoleLabel: "预言家",
    strength: "hard",
    checks: [],
    summary: `${claimant.name} claims seer.`,
    lastUpdatedDay: 2,
    sourceSpeechSeq: seq,
  };
}

function stance(actorSeatId: number, targetSeatId: number, kind: "QUESTION" | "PRESSURE"): StanceBoardItem {
  return {
    stanceId: `${actorSeatId}:${targetSeatId}:${kind}`,
    day: 2,
    actor: { seatId: actorSeatId, name: `Seat ${actorSeatId}` },
    target: { seatId: targetSeatId, name: `Seat ${targetSeatId}` },
    kind,
    kindLabel: kind === "QUESTION" ? "质疑" : "施压",
    summary: "public pressure",
  };
}

function reasoningCue(
  target: ActionTarget,
  kind: PublicReasoningCue["kind"],
  weight: PublicReasoningCue["weight"],
  summary: string,
  evidence: string[],
): PublicReasoningCue {
  return {
    cueId: `${kind}:${target.seatId}`,
    day: 2,
    kind,
    weight,
    summary,
    target,
    evidence,
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

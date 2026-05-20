import { describe, expect, it } from "vitest";
import { createMockCommand } from "@/ai/mockAgent";
import type { ActionTarget, AgentView, AiTableRead, ClaimBoardItem, PublicReasoningCue, SeatRead } from "./types";

describe("mock AI strong actions", () => {
  it("declines hunter reveal when suspicion only comes from personal or vote noise", () => {
    const command = createMockCommand(hunterRevealView(), tableReadWithTarget({ pressure: ["投过我", "当前吃到 1 票"] }));

    expect(command).toMatchObject({
      type: "hunterReveal",
      reveal: false,
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

  it("allows a hunter shot from a strong public reasoning cue and explains the evidence", () => {
    const target = { seatId: 2, name: "Target" };
    const tableRead = tableReadWithTarget({
      suspicion: 92,
      trust: 42,
      pressure: ["站边和票型没有闭环"],
      publicStancedBy: [publicPressure({ seatId: 4, name: "Checker" }, target)],
    });
    tableRead.tableMemory.reasoningCues = [
      reasoningCue(target, "vote", "strong", "站边和上一轮票型断开", ["先质疑预言家又跟票同一边"]),
    ];

    const command = createMockCommand(hunterView(), tableRead);

    expect(command).toMatchObject({
      type: "hunterShoot",
      targetSeatId: 2,
    });
    expect(command.reason).toContain("站边和上一轮票型断开");
    expect(command.reason).toContain("先质疑预言家又跟票同一边");
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

  it("declines hunter reveal for a hard power claim from public black-check pressure alone", () => {
    const claim = powerClaim({ seatId: 2, name: "Target" }, "WITCH");
    const command = createMockCommand(
      hunterRevealView(),
      tableReadWithTarget({
        suspicion: 96,
        trust: 28,
        pressure: ["Claude施压这里", "被Claude公开报查杀", "公开声称女巫"],
        publicClaims: [claim],
        publicChecksAgainst: [{ claimant: { seatId: 3, name: "Claude" }, result: "WEREWOLF", day: 2 }],
        publicStancedBy: [
          publicPressure({ seatId: 3, name: "Claude" }, { seatId: 2, name: "Target" }),
          publicPressure({ seatId: 4, name: "GPT" }, { seatId: 2, name: "Target" }),
          publicPressure({ seatId: 5, name: "Mimo" }, { seatId: 2, name: "Target" }),
        ],
      }),
    );

    expect(command).toMatchObject({
      type: "hunterReveal",
      reveal: false,
    });
  });

  it("declines hunter reveal for a non-claim target from an untrusted public black check alone", () => {
    const command = createMockCommand(
      hunterRevealView(),
      tableReadWithTarget({
        suspicion: 94,
        trust: 30,
        pressure: ["被Claude公开报查杀", "Claude施压这里"],
        publicChecksAgainst: [{ claimant: { seatId: 3, name: "Claude" }, result: "WEREWOLF", day: 2 }],
        publicStancedBy: [
          publicPressure({ seatId: 3, name: "Claude" }, { seatId: 2, name: "Target" }),
          publicPressure({ seatId: 4, name: "GPT" }, { seatId: 2, name: "Target" }),
        ],
      }),
    );

    expect(command).toMatchObject({
      type: "hunterReveal",
      reveal: false,
    });
  });

  it("declines hunter reveal for a non-claim target from an unresolved seer-counterclaim black check alone", () => {
    const target = { seatId: 2, name: "Target" };
    const seer = { seatId: 3, name: "Contested Seer" };
    const otherSeer = { seatId: 4, name: "Other Seer" };
    const tableRead = tableReadWithTarget({
      suspicion: 96,
      trust: 28,
      pressure: ["被Contested Seer公开报查杀", "Contested Seer施压这里"],
      publicChecksAgainst: [{ claimant: seer, result: "WEREWOLF", day: 2 }],
      publicStancedBy: [
        publicPressure(seer, target),
        publicPressure({ seatId: 5, name: "Follower" }, target),
        publicPressure({ seatId: 6, name: "Follower B" }, target),
      ],
    });
    tableRead.tableMemory.counterclaims = [
      {
        claimedRole: "SEER",
        claimedRoleLabel: "预言家",
        claimants: [seer, otherSeer],
      },
    ];

    const command = createMockCommand(hunterRevealView(), tableRead);

    expect(command).toMatchObject({
      type: "hunterReveal",
      reveal: false,
    });
  });

  it("can still shoot a power claim named by a dead seer legacy", () => {
    const target = { seatId: 2, name: "Target" };
    const legacySeer = { seatId: 6, name: "Dead Seer" };
    const claim = powerClaim(target, "WITCH");
    const tableRead = tableReadWithTarget({
      suspicion: 90,
      trust: 36,
      pressure: ["Dead Seer夜死后遗留查杀", "公开声称女巫"],
      publicClaims: [claim],
    });
    tableRead.tableMemory.seerLegacies = [
      {
        claimant: legacySeer,
        deathDay: 2,
        summary: "Dead Seer died with a black check.",
        checks: [{ day: 2, target, result: "WEREWOLF" }],
        stancesGiven: [],
      },
    ];

    const command = createMockCommand(hunterView(), tableRead);

    expect(command).toMatchObject({
      type: "hunterShoot",
      targetSeatId: 2,
    });
  });

  it("declines hunter reveal from an exiled seer legacy black check alone", () => {
    const target = { seatId: 2, name: "Target" };
    const legacySeer = { seatId: 6, name: "Exiled Seer Claimant" };
    const tableRead = tableReadWithTarget({
      suspicion: 92,
      trust: 36,
      pressure: ["Exiled Seer Claimant澶滄鍚庨仐鐣欐煡鏉€"],
    });
    tableRead.tableMemory.seerLegacies = [
      {
        claimant: legacySeer,
        deathDay: 2,
        deathKind: "exile",
        summary: "Exiled seer claimant left a black check.",
        checks: [{ day: 2, target, result: "WEREWOLF" }],
        stancesGiven: [],
      },
    ];

    const command = createMockCommand(hunterRevealView(), tableRead);

    expect(command).toMatchObject({
      type: "hunterReveal",
      reveal: false,
    });
  });

});

function publicPressure(actor: ActionTarget, target: ActionTarget): SeatRead["publicStancedBy"][number] {
  return {
    stanceId: `${actor.seatId}:${target.seatId}:PRESSURE`,
    day: 2,
    actor,
    target,
    kind: "PRESSURE",
    kindLabel: "施压",
    summary: `施压${target.name}`,
  };
}

function powerClaim(claimant: ActionTarget, claimedRole: ClaimBoardItem["claimedRole"]): ClaimBoardItem {
  return {
    claimId: `${claimant.seatId}:${claimedRole}`,
    claimant,
    claimedRole,
    claimedRoleLabel: claimedRole === "WITCH" ? "女巫" : claimedRole,
    strength: "hard",
    checks: [],
    summary: `声称${claimedRole}`,
    lastUpdatedDay: 2,
    sourceSpeechSeq: 10,
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

function hunterRevealView(targets: ActionTarget[] = [{ seatId: 2, name: "Target" }]): AgentView {
  return {
    ...hunterView(targets),
    phase: "HUNTER_REVEAL",
    allowedActions: [{ type: "hunterReveal", canReveal: true }],
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

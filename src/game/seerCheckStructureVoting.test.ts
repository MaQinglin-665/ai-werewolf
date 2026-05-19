import { describe, expect, it } from "vitest";
import { createVotePlan } from "@/ai/tableRead";
import type { ActionTarget, AgentView, AiTableRead, ClaimBoardItem, PublicReasoningCue, Role, SeatRead, TableMemory } from "./types";

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

  it("pressures a seer counterclaim whose black check hits an unchallenged power claim", () => {
    const hunter = { seatId: 2, name: "Hunter Claim" };
    const openTarget = { seatId: 4, name: "Open Target" };
    const powerBlackClaim = seerClaim(
      { seatId: 5, name: "Power Black Seer" },
      [{ day: 1, target: hunter, result: "WEREWOLF" }],
      22,
    );
    const cleanerClaim = seerClaim(
      { seatId: 6, name: "Cleaner Seer" },
      [{ day: 1, target: openTarget, result: "WEREWOLF" }],
      12,
    );
    const hunterClaim = roleClaim(hunter, "HUNTER");
    const memory = tableMemory({
      day: 1,
      claimBoard: [hunterClaim, powerBlackClaim, cleanerClaim],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [powerBlackClaim.claimant, cleanerClaim.claimant],
        },
      ],
    });

    const plan = createVotePlan(
      voteView(memory, [hunter, powerBlackClaim.claimant, cleanerClaim.claimant, openTarget], 1),
      tableRead(
        [
          seatRead({
            ...hunter,
            suspicion: 92,
            trust: 28,
            publicClaims: [hunterClaim],
            publicChecksAgainst: [{ claimant: powerBlackClaim.claimant, result: "WEREWOLF", day: 1 }],
          }),
          seatRead({
            ...powerBlackClaim.claimant,
            suspicion: 52,
            trust: 54,
            publicClaims: [powerBlackClaim],
          }),
          seatRead({
            ...cleanerClaim.claimant,
            suspicion: 58,
            trust: 50,
            publicClaims: [cleanerClaim],
          }),
          seatRead({
            ...openTarget,
            suspicion: 62,
            trust: 44,
            publicChecksAgainst: [{ claimant: cleanerClaim.claimant, result: "WEREWOLF", day: 1 }],
          }),
        ],
        memory,
        1,
      ),
    );

    expect(plan.target.seatId).toBe(5);
    expect(plan.alternatives.map((target) => target.seatId)).not.toContain(2);
  });

  it("prioritizes the surviving seer counterclaim after a night-dead seer legacy", () => {
    const deadSeer = { seatId: 2, name: "Dead Seer" };
    const liveSeer = { seatId: 3, name: "Live Counterclaim" };
    const legacyTarget = { seatId: 4, name: "Legacy Black" };
    const outsideFocus = { seatId: 5, name: "Outside Focus" };
    const deadClaim = seerClaim(deadSeer, [{ day: 1, target: legacyTarget, result: "WEREWOLF" }], 10);
    const liveClaim = seerClaim(liveSeer, [{ day: 2, target: outsideFocus, result: "WEREWOLF" }], 24);
    const memory = tableMemory({
      day: 2,
      claimBoard: [deadClaim, liveClaim],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [deadSeer, liveSeer],
        },
      ],
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: deadClaim.checks,
          stancesGiven: [],
          summary: "Dead Seer died at night with a black check.",
        },
      ],
      focus: [{ seat: outsideFocus, reasons: ["outside focus"], score: 90 }],
    });

    const plan = createVotePlan(
      voteView(memory, [liveSeer, legacyTarget, outsideFocus], 2),
      tableRead(
        [
          seatRead({
            ...liveSeer,
            suspicion: 56,
            trust: 54,
            publicClaims: [liveClaim],
          }),
          seatRead({
            ...legacyTarget,
            suspicion: 54,
            trust: 48,
          }),
          seatRead({
            ...outsideFocus,
            suspicion: 82,
            trust: 35,
            publicChecksAgainst: [{ claimant: liveSeer, result: "WEREWOLF", day: 2 }],
          }),
        ],
        memory,
        2,
      ),
    );

    expect(plan.target.seatId).toBe(3);
    expect(plan.reason).toContain("夜死");
  });

  it("follows a night-dead seer black-check legacy when there is no surviving counterclaim", () => {
    const deadSeer = { seatId: 2, name: "Dead Seer" };
    const legacyTarget = { seatId: 4, name: "Legacy Black" };
    const outsideFocus = { seatId: 5, name: "Outside Focus" };
    const deadClaim = seerClaim(deadSeer, [{ day: 1, target: legacyTarget, result: "WEREWOLF" }], 10);
    const memory = tableMemory({
      day: 2,
      claimBoard: [deadClaim],
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: deadClaim.checks,
          stancesGiven: [],
          summary: "Dead Seer died at night with a black check.",
        },
      ],
      focus: [{ seat: outsideFocus, reasons: ["outside focus"], score: 90 }],
    });

    const plan = createVotePlan(
      voteView(memory, [legacyTarget, outsideFocus], 2),
      tableRead(
        [
          seatRead({
            ...legacyTarget,
            suspicion: 48,
            trust: 48,
          }),
          seatRead({
            ...outsideFocus,
            suspicion: 86,
            trust: 30,
          }),
        ],
        memory,
        2,
      ),
    );

    expect(plan.target.seatId).toBe(4);
    expect(plan.reason).toContain("夜死后遗留");
  });

  it("does not vote out a night-dead sole seer's gold-water target", () => {
    const deadSeer = { seatId: 2, name: "Dead Seer" };
    const goldTarget = { seatId: 4, name: "Legacy Gold" };
    const outsideFocus = { seatId: 5, name: "Outside Focus" };
    const deadClaim = seerClaim(deadSeer, [{ day: 1, target: goldTarget, result: "GOOD" }], 10);
    const memory = tableMemory({
      day: 2,
      claimBoard: [deadClaim],
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: deadClaim.checks,
          stancesGiven: [],
          summary: "Dead Seer died at night with a gold-water check.",
        },
      ],
      focus: [{ seat: goldTarget, reasons: ["public focus"], score: 95 }],
    });

    const plan = createVotePlan(
      voteView(memory, [goldTarget, outsideFocus], 2),
      tableRead(
        [
          seatRead({
            ...goldTarget,
            suspicion: 98,
            trust: 18,
            pressure: ["公开焦点位"],
          }),
          seatRead({
            ...outsideFocus,
            suspicion: 54,
            trust: 43,
          }),
        ],
        memory,
        2,
      ),
    );

    expect(plan.target.seatId).toBe(5);
    expect(plan.alternatives.map((target) => target.seatId)).not.toContain(4);
  });

  it("keeps a night-dead seer gold-water target protected despite a later single black check", () => {
    const deadSeer = { seatId: 2, name: "Dead Seer" };
    const liveCounter = { seatId: 3, name: "Live Counter" };
    const goldTarget = { seatId: 4, name: "Legacy Gold" };
    const outsideFocus = { seatId: 5, name: "Outside Focus" };
    const deadClaim = seerClaim(deadSeer, [{ day: 1, target: goldTarget, result: "GOOD" }], 10);
    const counterClaim = seerClaim(liveCounter, [{ day: 2, target: goldTarget, result: "WEREWOLF" }], 24);
    const memory = tableMemory({
      day: 3,
      claimBoard: [deadClaim, counterClaim],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [deadSeer, liveCounter],
        },
      ],
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: deadClaim.checks,
          stancesGiven: [],
          summary: "Dead Seer died at night with a gold-water check.",
        },
      ],
      focus: [{ seat: goldTarget, reasons: ["public focus"], score: 95 }],
    });

    const plan = createVotePlan(
      voteView(memory, [goldTarget, outsideFocus], 3),
      tableRead(
        [
          seatRead({
            ...goldTarget,
            suspicion: 96,
            trust: 24,
            pressure: ["被Live Counter公开报查杀", "公开焦点位"],
            publicChecksAgainst: [{ claimant: liveCounter, result: "WEREWOLF", day: 2 }],
            publicStancedBy: [publicPressure(liveCounter, goldTarget)],
          }),
          seatRead({
            ...outsideFocus,
            suspicion: 54,
            trust: 43,
          }),
        ],
        memory,
        3,
      ),
    );

    expect(plan.target.seatId).toBe(outsideFocus.seatId);
    expect(plan.alternatives.map((target) => target.seatId)).not.toContain(goldTarget.seatId);
  });

  it("abstains instead of falling back onto a protected dead-seer gold-water target", () => {
    const deadSeer = { seatId: 2, name: "Dead Seer" };
    const goldTarget = { seatId: 4, name: "Legacy Gold" };
    const deadClaim = seerClaim(deadSeer, [{ day: 1, target: goldTarget, result: "GOOD" }], 10);
    const memory = tableMemory({
      day: 2,
      claimBoard: [deadClaim],
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: deadClaim.checks,
          stancesGiven: [],
          summary: "Dead Seer died at night with a gold-water check.",
        },
      ],
      focus: [{ seat: goldTarget, reasons: ["public focus"], score: 95 }],
    });

    const plan = createVotePlan(
      voteView(memory, [goldTarget], 2, true),
      tableRead(
        [
          seatRead({
            ...goldTarget,
            suspicion: 99,
            trust: 10,
            pressure: ["公开焦点位"],
          }),
        ],
        memory,
        2,
      ),
    );

    expect(plan.abstain).toBe(true);
    expect(plan.target.seatId).toBe(goldTarget.seatId);
    expect(plan.reason).toContain("公开金水");
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

  it("consolidates a post-tie vote onto an evidenced tied seat instead of a louder outside focus", () => {
    const tiedPressure = { seatId: 2, name: "Tied Pressure" };
    const tiedWitch = { seatId: 3, name: "Tied Witch" };
    const outsideFocus = { seatId: 4, name: "Outside Focus" };
    const witchClaim = roleClaim(tiedWitch, "WITCH");
    const memory = tableMemory({
      claimBoard: [witchClaim],
      focus: [{ seat: outsideFocus, reasons: ["outside focus"], score: 70 }],
      voteHistory: [
        {
          day: 1,
          tally: [
            { target: tiedPressure, count: 2 },
            { target: tiedWitch, count: 2 },
            { target: outsideFocus, count: 1 },
          ],
          leaders: [tiedPressure, tiedWitch],
          tiedSeatIds: [2, 3],
        },
      ],
    });

    const plan = createVotePlan(
      voteView(memory, [tiedPressure, tiedWitch, outsideFocus], 2),
      tableRead(
        [
          seatRead({
            ...tiedPressure,
            suspicion: 58,
            trust: 42,
            publicStancedBy: [
              publicPressure({ seatId: 6, name: "Questioner A" }, tiedPressure),
              publicPressure({ seatId: 7, name: "Questioner B" }, tiedPressure),
            ],
          }),
          seatRead({
            ...tiedWitch,
            suspicion: 88,
            trust: 24,
            publicClaims: [witchClaim],
          }),
          seatRead({
            ...outsideFocus,
            suspicion: 78,
            trust: 35,
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(2);
    expect(plan.reason).toContain("平票");
  });

  it("keeps an unchallenged day-one power claim out of generic public-focus voting", () => {
    const hunter = { seatId: 2, name: "Hunter Claim" };
    const openTarget = { seatId: 4, name: "Open Target" };
    const hunterClaim = roleClaim(hunter, "HUNTER");
    const memory = tableMemory({
      day: 1,
      claimBoard: [hunterClaim],
      focus: [{ seat: hunter, reasons: ["public focus"], score: 90 }],
    });

    const plan = createVotePlan(
      voteView(memory, [hunter, openTarget], 1),
      tableRead(
        [
          seatRead({
            ...hunter,
            suspicion: 96,
            trust: 20,
            publicClaims: [hunterClaim],
          }),
          seatRead({
            ...openTarget,
            suspicion: 54,
            trust: 43,
          }),
        ],
        memory,
        1,
      ),
    );

    expect(plan.target.seatId).toBe(4);
  });

  it("treats a day-one soft power hint as a low-evidence protection boundary", () => {
    const hintedSeat = { seatId: 2, name: "Soft Hint" };
    const openTarget = { seatId: 4, name: "Open Target" };
    const memory = tableMemory({
      day: 1,
      focus: [{ seat: hintedSeat, reasons: ["public focus"], score: 85 }],
    });

    const plan = createVotePlan(
      voteView(memory, [hintedSeat, openTarget], 1),
      tableRead(
        [
          seatRead({
            ...hintedSeat,
            suspicion: 90,
            trust: 24,
            lastSpeech: "我底牌不虚但不急着拍身份，先看谁强行归票。",
          }),
          seatRead({
            ...openTarget,
            suspicion: 52,
            trust: 44,
          }),
        ],
        memory,
        1,
      ),
    );

    expect(plan.target.seatId).toBe(4);
  });

  it("prefers a public reasoning loop over soft short-speech suspicion", () => {
    const softNoise = { seatId: 2, name: "Soft Noise" };
    const loopTarget = { seatId: 4, name: "Loop Target" };
    const memory = tableMemory({
      focus: [
        { seat: softNoise, reasons: ["发言偏短"], score: 76 },
        { seat: loopTarget, reasons: ["站边和票型不闭合"], score: 28 },
      ],
      reasoningCues: [
        reasoningCue(loopTarget, "speech_influence", "strong", "4号站边和上一轮票型不闭合", [
          "先质疑预言家又跟票同一边",
        ]),
      ],
    });

    const plan = createVotePlan(
      voteView(memory, [softNoise, loopTarget], 2),
      tableRead(
        [
          seatRead({
            ...softNoise,
            suspicion: 94,
            trust: 24,
            pressure: ["发言偏短", "信息量少"],
          }),
          seatRead({
            ...loopTarget,
            suspicion: 58,
            trust: 44,
            pressure: ["站边和票型没有闭环"],
            publicStancedBy: [publicPressure({ seatId: 6, name: "Checker" }, loopTarget)],
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(4);
    expect(plan.reason).toContain("公开推理线索");
    expect(plan.reason).toContain("证据链");
  });
});

function voteView(
  tableMemory: TableMemory,
  targets: ActionTarget[] = [
    { seatId: 2, name: "Gold Seer" },
    { seatId: 3, name: "Black-Only Seer" },
  ],
  day = 2,
  canAbstain = false,
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
        canAbstain,
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

function roleClaim(claimant: ActionTarget, claimedRole: Role): ClaimBoardItem {
  return {
    claimId: `${claimedRole.toLowerCase()}-${claimant.seatId}`,
    claimant,
    claimedRole,
    claimedRoleLabel: roleLabel(claimedRole),
    strength: "hard",
    checks: [],
    summary: `${claimant.name} claims ${claimedRole}.`,
    lastUpdatedDay: 1,
    sourceSpeechSeq: 10 + claimant.seatId,
  };
}

function roleLabel(role: Role): string {
  if (role === "HUNTER") return "猎人";
  if (role === "WITCH") return "女巫";
  if (role === "SEER") return "预言家";
  return role;
}

function publicPressure(actor: ActionTarget, target: ActionTarget): SeatRead["publicStancedBy"][number] {
  return {
    stanceId: `pressure-${actor.seatId}-${target.seatId}`,
    day: 1,
    actor,
    target,
    kind: "PRESSURE",
    kindLabel: "施压",
    summary: `${actor.name} pressure ${target.name}`,
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
    cueId: `${kind}-${target.seatId}`,
    day: 2,
    kind,
    weight,
    summary,
    target,
    evidence,
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

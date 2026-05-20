import { describe, expect, it } from "vitest";
import type { ActionTarget, AgentView, AiTableRead, ClaimBoardItem, PublicVoteSnapshot, SeatRead, TableMemory } from "@/game/types";
import { createSpeechPlan, createVotePlan } from "./tableRead";

const target = (seatId: number, name = `P${seatId}`): ActionTarget => ({ seatId, name });

const emptyVoteSnapshot: PublicVoteSnapshot = {
  votes: [],
  tally: [],
  leaders: [],
  revealed: false,
};

function createSeat(overrides: Partial<SeatRead> & Pick<SeatRead, "seatId">): SeatRead {
  const { seatId, ...rest } = overrides;
  return {
    seatId,
    name: rest.name ?? `P${seatId}`,
    suspicion: 45,
    trust: 45,
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
    ...rest,
  };
}

function createTableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 1,
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

function createView(tableMemory: TableMemory): AgentView {
  return {
    gameId: "test-game",
    day: 1,
    phase: "DAY_VOTE",
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false, wolfRoles: ["WEREWOLF"] },
    mySeatId: 1,
    myRole: "WEREWOLF",
    persona: {
      id: "reckless",
      name: "Reckless",
      modelLabel: "mock",
      label: "高风险倒钩",
      style: "aggressive",
      goal: "win",
      riskTolerance: 0.95,
      bluffing: 0.9,
    },
    aliveSeats: [target(1), target(2), target(3)],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [{ seq: 3, day: 1, speaker: target(3), message: "3 号认为 2 号跳预言家但过程不足" }],
      recentVotes: [],
      voteSnapshot: emptyVoteSnapshot,
      recentDeaths: [],
      deathSummary: [],
      claimBoard: tableMemory.claimBoard,
      tableMemory,
    },
    privateKnowledge: {
      wolfTeammates: [target(2)],
      aiMemory: {
        seatId: 1,
        day: 1,
        beliefs: [],
      },
    },
    allowedActions: [
      {
        type: "vote",
        targets: [target(2), target(3)],
        canAbstain: true,
      },
    ],
  };
}

describe("createVotePlan", () => {
  it("does not let a wolf vote a teammate on day one just because one public player questioned them", () => {
    const seerClaim: ClaimBoardItem = {
      claimId: "claim-2",
      claimant: target(2),
      claimedRole: "SEER",
      claimedRoleLabel: "预言家",
      strength: "hard",
      checks: [],
      summary: "2 号跳预言家",
      lastUpdatedDay: 1,
      sourceSpeechSeq: 2,
    };
    const pressure = {
      stanceId: "stance-3-2",
      day: 1,
      actor: target(3),
      target: target(2),
      kind: "QUESTION",
      kindLabel: "质疑",
      summary: "3 号质疑 2 号预言家过程不足",
      sourceSpeechSeq: 3,
    } as const;
    const tableMemory = createTableMemory({
      claimBoard: [seerClaim],
      counterclaims: [{ claimedRole: "SEER", claimedRoleLabel: "预言家", claimants: [target(2), target(4)] }],
    });
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "WEREWOLF",
      day: 1,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({
          seatId: 2,
          name: "Wolf Mate",
          suspicion: 82,
          trust: 22,
          pressure: ["明确声称预言家", "3 号质疑这里"],
          isWolfTeammate: true,
          publicClaims: [seerClaim],
          publicStancedBy: [pressure],
        }),
        createSeat({
          seatId: 3,
          name: "Villager",
          suspicion: 54,
          trust: 42,
          pressure: ["发言理由不完整"],
        }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [2],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory,
      tableMood: "首日信息还在形成",
    };

    const plan = createVotePlan(createView(tableMemory), tableRead);

    expect(plan.target.seatId).toBe(3);
  });

  it("keeps a dead seer's legacy gold water off good-side vote plans while alternatives exist", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Gold Water");
    const tableMemory = createTableMemory({
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 1,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "4 号夜死后留下 2 号金水",
        },
      ],
    });
    const view = {
      ...createView(tableMemory),
      myRole: "VILLAGER",
      privateKnowledge: { aiMemory: { seatId: 1, day: 1, beliefs: [] } },
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "Gold Water", suspicion: 78, trust: 20, pressure: ["短发言"] }),
        createSeat({ seatId: 3, name: "Alternative", suspicion: 56, trust: 42, pressure: ["发言理由不完整"] }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: ["4 号夜死"],
      tableMemory,
      tableMood: "死预信息需要复盘",
    };

    const plan = createVotePlan(view, tableRead);

    expect(plan.target.seatId).toBe(3);
    expect(plan.reason).not.toContain("Gold Water");
  });

  it("keeps an unchallenged public seer gold water off good-side vote plans", () => {
    const seer = target(4, "Public Seer");
    const gold = target(2, "Public Gold");
    const goldClaim: ClaimBoardItem = {
      claimId: "claim-4",
      claimant: seer,
      claimedRole: "SEER",
      claimedRoleLabel: "预言家",
      strength: "hard",
      checks: [{ day: 2, target: gold, result: "GOOD" }],
      summary: "4 号跳预言家并报 2 号金水",
      lastUpdatedDay: 2,
      sourceSpeechSeq: 8,
    };
    const tableMemory = createTableMemory({ day: 2, claimBoard: [goldClaim] });
    const view = {
      ...createView(tableMemory),
      day: 2,
      myRole: "VILLAGER",
      privateKnowledge: { aiMemory: { seatId: 1, day: 2, lastVoteTargetSeatId: 2, beliefs: [] } },
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 2,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "Public Gold", suspicion: 84, trust: 22, pressure: ["上一轮被投过"] }),
        createSeat({ seatId: 3, name: "Alternative", suspicion: 55, trust: 45, pressure: ["发言理由不完整"] }),
        createSeat({ seatId: 4, name: "Public Seer", suspicion: 58, trust: 52, publicClaims: [goldClaim] }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory,
      tableMood: "公开金水需要先放一轮",
    };

    const plan = createVotePlan(view, tableRead);

    expect(plan.target.seatId).toBe(3);
    expect(plan.reason).not.toContain("Public Gold");
  });

  it("keeps wolves from parking votes on a night-dead seer's gold water without hard counter-evidence", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Legacy Gold");
    const alternative = target(3, "Open Focus");
    const tableMemory = createTableMemory({
      day: 2,
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "4 号夜死后留下 2 号金水",
        },
      ],
      focus: [{ seat: gold, reasons: ["上一轮票过"], score: 90 }],
    });
    const view = {
      ...createView(tableMemory),
      day: 2,
      aliveSeats: [target(1, "Wolf"), gold, alternative],
      privateKnowledge: {
        wolfTeammates: [target(5, "Wolf Mate")],
        aiMemory: { seatId: 1, day: 2, lastVoteTargetSeatId: gold.seatId, beliefs: [] },
      },
      allowedActions: [{ type: "vote", targets: [gold, alternative], canAbstain: false }],
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "WEREWOLF",
      day: 2,
      seats: [
        createSeat({ seatId: 1, name: "Wolf", isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({
          seatId: gold.seatId,
          name: gold.name,
          suspicion: 92,
          trust: 18,
          pressure: ["上一轮被投过", "发言偏短"],
        }),
        createSeat({
          seatId: alternative.seatId,
          name: alternative.name,
          suspicion: 58,
          trust: 42,
          pressure: ["发言理由不完整"],
        }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [5],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: ["4 号夜死"],
      tableMemory,
      tableMood: "夜死预言家金水不适合继续硬推",
    };

    const plan = createVotePlan(view, tableRead);

    expect(plan.target.seatId).toBe(alternative.seatId);
    expect(plan.reason).not.toContain("上一轮");
    expect(plan.alternatives.map((item) => item.seatId)).not.toContain(gold.seatId);
  });
});

describe("createSpeechPlan", () => {
  it("does not turn a dead seer's legacy gold water into the next speech pressure target", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Gold Water");
    const tableMemory = createTableMemory({
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 1,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "4 号夜死后留下 2 号金水",
        },
      ],
    });
    const view = {
      ...createView(tableMemory),
      myRole: "VILLAGER",
      persona: {
        id: "steady-villager",
        name: "Steady",
        modelLabel: "mock",
        label: "稳健闭眼好人",
        style: "steady",
        goal: "win",
        riskTolerance: 0.45,
        bluffing: 0.1,
      },
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [{ seq: 5, day: 1, speaker: gold, message: "我先把票型和站边讲清楚。" }],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: 1, day: 1, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "Gold Water", suspicion: 72, trust: 24, pressure: ["发言偏短"] }),
        createSeat({ seatId: 3, name: "Alternative", suspicion: 48, trust: 44, pressure: ["发言理由不完整"] }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["4 号夜死"],
      tableMemory,
      tableMood: "死预信息需要复盘",
    };

    const plan = createSpeechPlan(view, tableRead);
    const speechText = [plan.stance, ...plan.talkingPoints].join("\n");

    expect(plan.target?.seatId).not.toBe(2);
    expect(speechText).not.toContain("Gold Water");
    expect(speechText).not.toContain("2号");
  });
});

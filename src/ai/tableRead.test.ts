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

function createPressure(
  actor: ActionTarget,
  pressureTarget: ActionTarget,
  kind: "QUESTION" | "PRESSURE" = "PRESSURE",
) {
  return {
    stanceId: `stance-${actor.seatId}-${pressureTarget.seatId}-${kind}`,
    day: 3,
    actor,
    target: pressureTarget,
    kind,
    kindLabel: kind,
    summary: `${actor.name} pressures ${pressureTarget.name}`,
  };
}

function classTrialRoleCard(id: string, displayName: string): NonNullable<AgentView["roleCard"]> {
  return {
    id,
    displayName,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "真诚但戏剧化。",
    reasoningBias: "共同验证。",
    voteBias: "先看公开矛盾。",
    nightActionBias: "稳健。",
    asVillager: "组织桌面。",
    asWerewolf: "伪装组织桌面。",
    pressureResponse: "承认疑点再解释。",
    relationshipHints: [],
    catchphrasePolicy: "短句。",
    forbidden: [],
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
  it("splits close soft day-vote targets by seat instead of forcing one public focus", () => {
    const tableMemory = createTableMemory();
    const baseView = {
      ...createView(tableMemory),
      myRole: "VILLAGER",
      privateKnowledge: { aiMemory: { seatId: 1, day: 1, beliefs: [] } },
      allowedActions: [{ type: "vote", targets: [target(2), target(3), target(4)], canAbstain: true }],
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "Soft Focus", suspicion: 62, trust: 44, pressure: ["发言标准偏空"] }),
        createSeat({ seatId: 3, name: "Close Alternative", suspicion: 58, trust: 43, pressure: ["跟压但没有新理由"] }),
        createSeat({ seatId: 4, name: "Third Option", suspicion: 52, trust: 48, pressure: ["态度保守"] }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory,
      tableMood: "首日软证据接近",
    };

    const oddPlan = createVotePlan({ ...baseView, mySeatId: 1, persona: { ...baseView.persona!, id: "logic-checker" } }, tableRead);
    const evenPlan = createVotePlan({ ...baseView, mySeatId: 2, persona: { ...baseView.persona!, id: "careful-follower" } }, tableRead);

    expect(oddPlan.target.seatId).toBe(2);
    expect(evenPlan.target.seatId).toBe(3);
    expect(evenPlan.reason).toMatch(/分歧票|弱证据|替代/);
    expect(evenPlan.confidence).toBeLessThan(oddPlan.confidence);
  });

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
  it("allows voting a dead-seer gold water target once hard public counter-evidence exists", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Legacy Gold");
    const alternative = target(3, "Open Focus");
    const checkerA = target(5, "Live Seer A");
    const checkerB = target(6, "Live Seer B");
    const tableMemory = createTableMemory({
      day: 3,
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead seer left a gold-water result.",
        },
      ],
      focus: [{ seat: gold, reasons: ["multiple public black checks"], score: 96 }],
      reasoningCues: [
        {
          cueId: "legacy-gold-hard-counter",
          day: 3,
          kind: "counterclaim",
          weight: "strong",
          target: gold,
          summary: "two living seer claims both challenge the legacy gold",
          evidence: ["two public black checks"],
        },
      ],
    });
    const view = {
      ...createView(tableMemory),
      day: 3,
      myRole: "VILLAGER",
      aliveSeats: [target(1, "Voter"), gold, alternative, checkerA, checkerB],
      privateKnowledge: { aiMemory: { seatId: 1, day: 3, beliefs: [] } },
      allowedActions: [{ type: "vote", targets: [gold, alternative], canAbstain: false }],
    } as AgentView;
    const goldSeat = createSeat({
      seatId: gold.seatId,
      name: gold.name,
      suspicion: 94,
      trust: 18,
      pressure: ["two public black checks", "shared vote focus"],
      votesReceived: 2,
      publicChecksAgainst: [
        { claimant: checkerA, result: "WEREWOLF", day: 3 },
        { claimant: checkerB, result: "WEREWOLF", day: 3 },
      ],
      publicStancedBy: [createPressure(checkerA, gold), createPressure(checkerB, gold, "QUESTION")],
    });
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 3,
      seats: [
        createSeat({ seatId: 1, name: "Voter", isSelf: true, suspicion: 0, trust: 100 }),
        goldSeat,
        createSeat({ seatId: alternative.seatId, name: alternative.name, suspicion: 42, trust: 48 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: goldSeat,
      voteSnapshot: {
        ...emptyVoteSnapshot,
        leaders: [gold],
      },
      recentSpeeches: [],
      recentDeaths: ["Dead Seer died"],
      tableMemory,
      tableMood: "hard public evidence challenges a legacy gold",
    };

    const plan = createVotePlan(view, tableRead);

    expect(plan.target.seatId).toBe(gold.seatId);
  });
});

describe("createSpeechPlan", () => {
  it("does not turn private trust for an unevidenced class-trial back seat into public talking points", () => {
    const speaker = target(3, "腐川冬子");
    const focus = target(1, "苗木诚");
    const trustedBackSeat = target(5, "江之岛盾子");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      roleCard: classTrialRoleCard("fukawa", speaker.name),
      aliveSeats: [focus, target(2, "雾切响子"), speaker, target(4, "黑白熊"), trustedBackSeat],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          { seq: 1, day: 1, speaker: focus, message: "1号发言。我跳预言家，2号金水，今天先看谁借身份线收票。" },
          { seq: 2, day: 1, speaker: target(2, "雾切响子"), message: "2号发言。1号没有把观察点落到具体收益位，我先记这个断点。" },
        ],
        tableMemory,
      },
      privateKnowledge: {
        aiMemory: {
          seatId: speaker.seatId,
          day: 1,
          trustedSeatId: trustedBackSeat.seatId,
          beliefs: [{ seatId: trustedBackSeat.seatId, suspicion: 20, trust: 80, reasons: ["私人节奏判断偏稳"] }],
        },
      },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const focusRead = createSeat({
      seatId: focus.seatId,
      name: focus.name,
      suspicion: 72,
      trust: 38,
      pressure: ["观察点没有落到具体收益位"],
      lastSpeechDay: 1,
      lastSpeech: "1号发言。我跳预言家，2号金水，今天先看谁借身份线收票。",
    });
    const tableRead: AiTableRead = {
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        focusRead,
        createSeat({ seatId: 2, name: "雾切响子", suspicion: 46, trust: 50, lastSpeechDay: 1 }),
        createSeat({ seatId: speaker.seatId, name: speaker.name, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 4, name: "黑白熊", suspicion: 45, trust: 45 }),
        createSeat({ seatId: trustedBackSeat.seatId, name: trustedBackSeat.name, suspicion: 32, trust: 78 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: focusRead,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "学级裁判首日公开焦点在前置发言",
    };

    const plan = createSpeechPlan(view, tableRead);
    const speechText = [plan.stance, ...plan.talkingPoints].join("\n");

    expect(speechText).not.toContain(`更信${trustedBackSeat.seatId}号`);
    expect(speechText).not.toContain(`${trustedBackSeat.seatId}号`);
    expect(speechText).toContain(`${focus.seatId}号`);
  });

  it("can reference a privately trusted seat when the public table has visible speech evidence", () => {
    const speaker = target(4, "黑白熊");
    const focus = target(1, "苗木诚");
    const trustedSpokenSeat = target(5, "江之岛盾子");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      roleCard: classTrialRoleCard("monokuma", speaker.name),
      aliveSeats: [focus, target(2, "雾切响子"), target(3, "腐川冬子"), speaker, trustedSpokenSeat],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          { seq: 1, day: 1, speaker: focus, message: "1号发言。我跳预言家，2号金水，今天先看谁借身份线收票。" },
          { seq: 2, day: 1, speaker: trustedSpokenSeat, message: "5号发言。我不急着接1号预言家，先看谁把票口压得太早。" },
          { seq: 3, day: 1, speaker: target(3, "腐川冬子"), message: "3号发言。1号身份线还缺收益解释。" },
        ],
        tableMemory,
      },
      privateKnowledge: {
        aiMemory: {
          seatId: speaker.seatId,
          day: 1,
          trustedSeatId: trustedSpokenSeat.seatId,
          beliefs: [{ seatId: trustedSpokenSeat.seatId, suspicion: 20, trust: 80, reasons: ["私人节奏判断偏稳"] }],
        },
      },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const focusRead = createSeat({
      seatId: focus.seatId,
      name: focus.name,
      suspicion: 72,
      trust: 38,
      pressure: ["身份线还缺收益解释"],
      lastSpeechDay: 1,
      lastSpeech: "1号发言。我跳预言家，2号金水，今天先看谁借身份线收票。",
    });
    const tableRead: AiTableRead = {
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        focusRead,
        createSeat({ seatId: 2, name: "雾切响子", suspicion: 46, trust: 50 }),
        createSeat({ seatId: 3, name: "腐川冬子", suspicion: 50, trust: 44, lastSpeechDay: 1 }),
        createSeat({ seatId: speaker.seatId, name: speaker.name, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({
          seatId: trustedSpokenSeat.seatId,
          name: trustedSpokenSeat.name,
          suspicion: 32,
          trust: 78,
          lastSpeechDay: 1,
          lastSpeech: "5号发言。我不急着接1号预言家，先看谁把票口压得太早。",
        }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: focusRead,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "学级裁判首日有公开发言对照",
    };

    const plan = createSpeechPlan(view, tableRead);
    const speechText = [plan.stance, ...plan.talkingPoints].join("\n");

    expect(speechText).toContain(`${trustedSpokenSeat.seatId}号已经给过公开发言`);
    expect(speechText).not.toContain(`更信${trustedSpokenSeat.seatId}号`);
    expect(speechText).toContain(`${focus.seatId}号`);
  });

  it("starts day-one speech with one concrete observation instead of assigning full-table homework", () => {
    const tableMemory = createTableMemory({
      deathAnnouncements: ["第1天清晨，昨夜平安夜。"],
    });
    const view = {
      ...createView(tableMemory),
      myRole: "VILLAGER",
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [],
        recentDeaths: ["第1天清晨，昨夜平安夜。"],
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
        createSeat({ seatId: 1, name: "Speaker", isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "Later", suspicion: 45, trust: 45 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "首日信息还在形成",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.tableTask?.mode).toBe("set-standard");
    expect(plan.tableTask?.line).toContain("前面没人可接");
    expect(plan.tableTask?.line).toContain("信息少");
    expect(plan.tableTask?.line).toContain("平安夜");
    expect(plan.tableTask?.line).toContain("只作背景");
    expect(plan.tableTask?.line).not.toMatch(/处理边界|处理动作|主盘药线|给可验证的发言标准|后置位任务/);
    expect(plan.tableTask?.directives.join("\n")).toContain("前面没人可接");
    expect(plan.tableTask?.directives.join("\n")).not.toMatch(/处理边界|给标准|给后置位任务|给观察点/);
  });

  it("treats ordinary day-one no-guard single death as settled common sense instead of a rule lecture", () => {
    const tableMemory = createTableMemory({
      deathAnnouncements: ["第1天清晨，4号 死亡。"],
      reasoningCues: [
        {
          cueId: "death-shape:1:single:4",
          day: 1,
          kind: "death_shape",
          weight: "medium",
          summary: "首夜单死（4号）：狼刀成功，女巫没救；发言里只一句带过，马上接怀疑、暂放、追问或投票条件。",
          target: target(4, "Dead"),
          evidence: ["第1天清晨，4号 死亡。"],
        },
      ],
    });
    const view = {
      ...createView(tableMemory),
      mySeatId: 1,
      myRole: "VILLAGER",
      phase: "DAY_SPEECH",
      publicEvents: [
        {
          seq: 1,
          type: "DAY_STARTED",
          day: 1,
          phase: "DAY_ANNOUNCEMENT",
          message: "第1天清晨，4号 死亡。",
          payload: { deadSeatIds: [4] },
        },
      ],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [],
        recentDeaths: ["第1天清晨，4号 死亡。"],
        tableMemory,
      },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, name: "Speaker", isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "Later", suspicion: 45, trust: 45 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: ["第1天清晨，4号 死亡。"],
      tableMemory,
      tableMood: "首日单死",
    };

    const plan = createSpeechPlan(view, tableRead);
    const planText = [plan.tableTask?.line, ...(plan.tableTask?.directives ?? [])].join("\n");

    expect(planText).toContain("狼刀打中");
    expect(planText).toContain("我现在想听谁");
    expect(planText).toContain("先暂放");
    expect(planText).not.toMatch(/处理动作|公开规则依据|反面解释|毒口|药瓶|狼首夜必刀|解药/);
  });

  it("marks already-spoken targets as review-only in the speech plan", () => {
    const spokenTarget = target(2, "Spoken Target");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      myRole: "VILLAGER",
      aliveSeats: [target(1, "Speaker"), spokenTarget, target(3, "Unspoken")],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [{ seq: 8, day: 1, speaker: spokenTarget, message: "2号已经给过站边和票口。" }],
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
        createSeat({ seatId: 1, name: "Speaker", isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: spokenTarget.seatId, name: spokenTarget.name, suspicion: 80, trust: 20, pressure: ["站边和票口不闭合"], lastSpeechDay: 1 }),
        createSeat({ seatId: 3, name: "Unspoken", suspicion: 45, trust: 45 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: createSeat({ seatId: spokenTarget.seatId, name: spokenTarget.name, suspicion: 80, trust: 20, pressure: ["站边和票口不闭合"], lastSpeechDay: 1 }),
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: [],
      tableMemory,
      tableMood: "目标已发言",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.target?.seatId).toBe(spokenTarget.seatId);
    expect(plan.targetSpeechStatus).toBe("spoken");
    expect(plan.allowedInteraction).toBe("review_spoken");
    expect(plan.speechMove).toBe("review_spoken_target");
  });

  it("marks unspoken targets as future-ask only in the speech plan", () => {
    const unspokenTarget = target(2, "Unspoken Target");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      myRole: "VILLAGER",
      aliveSeats: [target(1, "Speaker"), unspokenTarget, target(3, "Other")],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [{ seq: 8, day: 1, speaker: target(3, "Other"), message: "3号刚才压了2号。" }],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: 1, day: 1, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const focusSeat = createSeat({ seatId: unspokenTarget.seatId, name: unspokenTarget.name, suspicion: 82, trust: 20, pressure: ["被前置位压过但尚未发言"] });
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, name: "Speaker", isSelf: true, suspicion: 0, trust: 100 }),
        focusSeat,
        createSeat({ seatId: 3, name: "Other", suspicion: 45, trust: 45, lastSpeechDay: 1 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: focusSeat,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: [],
      tableMemory,
      tableMood: "目标未发言",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.target?.seatId).toBe(unspokenTarget.seatId);
    expect(plan.targetSpeechStatus).toBe("unspoken");
    expect(plan.allowedInteraction).toBe("ask_future");
    expect(plan.speechMove).toBe("ask_unspoken_target");
  });

  it("does not turn an unsupported unspoken back seat into an early witch ticket target", () => {
    const priorSpeaker = target(1, "Prior Speaker");
    const witch = target(2, "Witch");
    const unsupportedBackSeat = target(9, "Back Seat");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      mySeatId: witch.seatId,
      myRole: "WITCH",
      aliveSeats: [priorSpeaker, witch, target(3, "Other"), unsupportedBackSeat],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          {
            seq: 1,
            day: 1,
            speaker: priorSpeaker,
            message: "1号发言。平安夜背景先定住，不展开药线。",
          },
        ],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: witch.seatId, day: 1, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const unanchoredFocus = createSeat({
      seatId: unsupportedBackSeat.seatId,
      name: unsupportedBackSeat.name,
      suspicion: 92,
      trust: 18,
      pressure: ["随机分偏高但没有公开发言锚点"],
    });
    const tableRead: AiTableRead = {
      mySeatId: witch.seatId,
      myRole: "WITCH",
      day: 1,
      seats: [
        createSeat({
          seatId: priorSpeaker.seatId,
          name: priorSpeaker.name,
          suspicion: 50,
          trust: 44,
          lastSpeechDay: 1,
          lastSpeech: "1号发言。平安夜背景先定住，不展开药线。",
        }),
        createSeat({ seatId: witch.seatId, name: witch.name, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 3, name: "Other", suspicion: 46, trust: 45 }),
        unanchoredFocus,
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: unanchoredFocus,
      backupFocus: createSeat({
        seatId: priorSpeaker.seatId,
        name: priorSpeaker.name,
        suspicion: 50,
        trust: 44,
        lastSpeechDay: 1,
        lastSpeech: "1号发言。平安夜背景先定住，不展开药线。",
      }),
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: [],
      tableMemory,
      tableMood: "只有前置位发言",
    };

    const plan = createSpeechPlan(view, tableRead);
    const speechText = [plan.stance, ...plan.talkingPoints].join("\n");

    expect(plan.target?.seatId).not.toBe(unsupportedBackSeat.seatId);
    expect(plan.allowedInteraction).not.toBe("ask_future");
    expect(plan.speechMove).not.toBe("ask_unspoken_target");
    expect(speechText).not.toContain("9号");
  });

  it("treats a low-info day-one opener as an opening-standard audit, not a stance-ticket gap", () => {
    const opener = target(1, "Opener");
    const speaker = target(2, "Speaker");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      aliveSeats: [opener, speaker, target(3, "Other")],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          {
            seq: 1,
            day: 1,
            speaker: opener,
            message: "1号发言。平安夜过，女巫用药了。我先看后置位谁主动给身份信息。",
          },
        ],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: speaker.seatId, day: 1, suspectedSeatId: opener.seatId, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const openerRead = createSeat({
      seatId: opener.seatId,
      name: opener.name,
      suspicion: 58,
      trust: 42,
      lastSpeechDay: 1,
      lastSpeech: "1号发言。平安夜过，女巫用药了。我先看后置位谁主动给身份信息。",
      pressure: ["开口观察点偏泛"],
    });
    const tableRead: AiTableRead = {
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      day: 1,
      seats: [openerRead, createSeat({ seatId: speaker.seatId, name: speaker.name, isSelf: true, suspicion: 0, trust: 100 }), createSeat({ seatId: 3, name: "Other" })],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: openerRead,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "首日低信息开局",
    };

    const plan = createSpeechPlan(view, tableRead);
    const speechText = [plan.tableTask?.line, plan.interaction?.line, plan.stance, ...plan.talkingPoints].join("\n");

    expect(plan.tableTask?.line).toContain("只检查观察点和跟压收益");
    expect(speechText).toContain("不要因为任何前置位没表态或没给投票方向去硬打");
    expect(speechText).not.toContain("前面持续怀疑1号");
    expect(speechText).not.toMatch(/1号[^。\n]{0,24}(?:补|解释|说清|交代).{0,12}(?:站边|票口)/);
  });

  it("does not treat a future voting-review phrase as hard day-one information", () => {
    const opener = target(1, "苗木诚");
    const speaker = target(3, "腐川冬子");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      phase: "DAY_SPEECH",
      aliveSeats: [opener, target(2, "雾切响子"), speaker],
      roleCard: classTrialRoleCard("fukawa", "腐川冬子"),
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          {
            seq: 1,
            day: 1,
            speaker: opener,
            message: "平安夜是公开信息，我先留共同验证点：发言顺序和给出的理由，能否在投票时形成闭环。",
          },
        ],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: speaker.seatId, day: 1, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const openerRead = createSeat({
      seatId: opener.seatId,
      name: opener.name,
      suspicion: 50,
      trust: 45,
      lastSpeechDay: 1,
      lastSpeech: view.publicSummary.recentSpeeches[0]!.message,
    });
    const tableRead: AiTableRead = {
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      day: 1,
      seats: [openerRead, createSeat({ seatId: 2, name: "雾切响子" }), createSeat({ seatId: speaker.seatId, name: speaker.name, isSelf: true })],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: openerRead,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "首日低信息开局",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.tableTask?.mode).toBe("set-standard");
    expect(plan.tableTask?.line).toContain("低信息首轮");
    expect(plan.tableTask?.line).not.toContain("票型已经有焦点");
  });

  it("does not treat a negative no-ticket phrase as hard day-one information", () => {
    const opener = target(1, "苗木诚");
    const speaker = target(5, "江之岛盾子");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      phase: "DAY_SPEECH",
      aliveSeats: [opener, target(2, "雾切响子"), speaker],
      roleCard: classTrialRoleCard("enoshima", "江之岛盾子"),
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          {
            seq: 1,
            day: 1,
            speaker: opener,
            message: "目前还没有任何人给出站边或票口，我先只看谁把平安夜拿去做文章。",
          },
        ],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: speaker.seatId, day: 1, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const openerRead = createSeat({
      seatId: opener.seatId,
      name: opener.name,
      suspicion: 50,
      trust: 45,
      lastSpeechDay: 1,
      lastSpeech: view.publicSummary.recentSpeeches[0]!.message,
    });
    const tableRead: AiTableRead = {
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      day: 1,
      seats: [openerRead, createSeat({ seatId: 2, name: "雾切响子" }), createSeat({ seatId: speaker.seatId, name: speaker.name, isSelf: true })],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: openerRead,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "首日低信息开局",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.tableTask?.mode).toBe("set-standard");
    expect(plan.tableTask?.line).toContain("低信息首轮");
    expect(plan.tableTask?.line).not.toContain("票型已经有焦点");
  });

  it("turns repeated pressure on the same opener into a pressure-chain audit", () => {
    const opener = target(1, "Opener");
    const speaker = target(5, "Speaker");
    const tableMemory = createTableMemory({
      speechInfluence: [
        {
          sourceSpeechSeq: 2,
          day: 1,
          speaker: target(2, "P2"),
          target: opener,
          direction: "pressure",
          summary: "多人接住1号开口过泛的压力",
          followupActors: [target(3, "P3"), target(4, "P4")],
          followupCount: 2,
        },
      ],
    });
    const speeches = [
      { seq: 1, day: 1, speaker: opener, message: "1号发言。平安夜过，女巫用药了，我先看后置位。" },
      { seq: 2, day: 1, speaker: target(2, "P2"), message: "2号发言。1号开口太泛，我先压一下。" },
      { seq: 3, day: 1, speaker: target(3, "P3"), message: "3号发言。1号这个观察点太泛，我也记。" },
      { seq: 4, day: 1, speaker: target(4, "P4"), message: "4号发言。前面都在压1号，我先看谁跟压。" },
    ];
    const view = {
      ...createView(tableMemory),
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      aliveSeats: [opener, target(2, "P2"), target(3, "P3"), target(4, "P4"), speaker],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: speeches,
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: speaker.seatId, day: 1, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const focus = createSeat({ seatId: opener.seatId, name: opener.name, suspicion: 62, trust: 40, pressure: ["开口观察点偏泛"] });
    const tableRead: AiTableRead = {
      mySeatId: speaker.seatId,
      myRole: "VILLAGER",
      day: 1,
      seats: [
        focus,
        createSeat({ seatId: 2, name: "P2", suspicion: 50, trust: 44 }),
        createSeat({ seatId: 3, name: "P3", suspicion: 50, trust: 44 }),
        createSeat({ seatId: 4, name: "P4", suspicion: 50, trust: 44 }),
        createSeat({ seatId: speaker.seatId, name: speaker.name, isSelf: true, suspicion: 0, trust: 100 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: speeches,
      recentDeaths: ["第1天清晨，昨夜平安夜。"],
      tableMemory,
      tableMood: "多人已经接住同一压力",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.tableTask?.line).toContain("必须换角度");
    expect(plan.tableTask?.line).not.toContain("检查谁在借这个焦点做收益");
    expect(plan.tableTask?.line).toContain("谁公开替焦点改方向");
    expect(plan.talkingPoints.join("\n")).not.toMatch(/1号[^。\n]{0,24}(?:没给|没有).{0,12}(?:站边|票口)/);
  });

  it("marks a real seer black check as a final black-check interaction", () => {
    const checkedWolf = target(2, "Checked Wolf");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      myRole: "SEER",
      aliveSeats: [target(1, "Seer"), checkedWolf, target(3, "Other")],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [],
        tableMemory,
      },
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: checkedWolf.seatId, result: "WEREWOLF" }],
      },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const checkedSeat = createSeat({ seatId: checkedWolf.seatId, name: checkedWolf.name, suspicion: 96, trust: 4, pressure: ["私密查验指向狼人"] });
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, name: "Seer", isSelf: true, suspicion: 0, trust: 100 }),
        checkedSeat,
        createSeat({ seatId: 3, name: "Other", suspicion: 45, trust: 45 }),
      ],
      knownWolfSeatIds: [checkedWolf.seatId],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: checkedSeat,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory,
      tableMood: "预言家查杀",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.kind).toBe("claim-check");
    expect(plan.target?.seatId).toBe(checkedWolf.seatId);
    expect(plan.targetSpeechStatus).toBe("unspoken");
    expect(plan.allowedInteraction).toBe("finalize_black_check");
    expect(plan.speechMove).toBe("claim_black_check");
  });

  it("gives class-trial hard-info seer black checks enough substance to avoid result-only speeches", () => {
    const checkedWolf = target(3, "腐川冬子");
    const tableMemory = createTableMemory();
    const view = {
      ...createView(tableMemory),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      roleCard: classTrialRoleCard("naegi", "苗木诚"),
      aliveSeats: [target(1, "苗木诚"), target(2, "雾切响子"), checkedWolf],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [],
        recentDeaths: ["第1天清晨，9号千早爱音倒牌。"],
        deathSummary: ["第1天清晨，9号千早爱音倒牌。"],
        tableMemory,
      },
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: checkedWolf.seatId, result: "WEREWOLF" }],
      },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const checkedSeat = createSeat({
      seatId: checkedWolf.seatId,
      name: checkedWolf.name,
      suspicion: 96,
      trust: 4,
      pressure: ["私密查验指向狼人"],
    });
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      personaLabel: "苗木诚",
      seats: [
        createSeat({ seatId: 1, name: "苗木诚", isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "雾切响子", suspicion: 45, trust: 48 }),
        checkedSeat,
      ],
      knownWolfSeatIds: [checkedWolf.seatId],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: checkedSeat,
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: ["第1天清晨，9号千早爱音倒牌。"],
      tableMemory,
      tableMood: "预言家查杀",
    };

    const plan = createSpeechPlan(view, tableRead);
    const planText = [plan.stance, plan.tableTask?.line, ...plan.talkingPoints].join("\n");

    expect(plan.speechMove).toBe("claim_black_check");
    expect(planText).not.toContain("必须交代验人理由");
    expect(planText).not.toContain("票口边界");
    expect(planText).not.toContain("外置硬身份反证");
    expect(planText).not.toContain("身份动作");
    expect(planText).not.toContain("外置位");
    expect(planText).not.toContain("更硬的身份信息");
    expect(planText).not.toContain("观察位");
    expect(planText).not.toContain("等他发言时讲清自己的逻辑");
    expect(planText).not.toContain("不要只报结论");
    expect(planText).not.toContain("轻放");
    expect(planText).not.toContain("可商量观察");
    expect(planText).not.toContain("降温");
    expect(planText).not.toContain("观望");
    expect(planText).not.toContain("他发言只影响别人怎么接");
    expect(planText).not.toContain("不改变我这条结果");
    expect(planText).toContain("查杀位");
    expect(planText).toContain("我跳预言家");
    expect(planText).toContain("昨晚查验");
    expect(planText).toContain("今天我的票先压");
    expect(planText).toContain("公开和我的结果对撞");
  });

  it("gives a class-trial black-check target a direct response plan before relationship flavor", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(3, "腐川冬子");
    const blackCheckClaim: ClaimBoardItem = {
      claimId: "claim-1",
      claimant,
      claimedRole: "SEER",
      claimedRoleLabel: "预言家",
      strength: "hard",
      checks: [{ day: 1, target: checked, result: "WEREWOLF" }],
      summary: "苗木诚跳预言家报腐川冬子查杀",
      lastUpdatedDay: 1,
      sourceSpeechSeq: 1,
    };
    const tableMemory = createTableMemory({ claimBoard: [blackCheckClaim] });
    const view = {
      ...createView(tableMemory),
      phase: "DAY_SPEECH",
      mySeatId: checked.seatId,
      myRole: "WEREWOLF",
      roleCard: classTrialRoleCard("fukawa", "腐川冬子"),
      aliveSeats: [claimant, target(2, "雾切响子"), checked, target(7, "十神白夜")],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [
          {
            seq: 1,
            day: 1,
            speaker: claimant,
            message: "苗木诚。我跳预言家，3号腐川冬子是查杀；今天票口先压3号。",
          },
        ],
        claimBoard: [blackCheckClaim],
        tableMemory,
      },
      persona: {
        ...createView(tableMemory).persona!,
        id: "cornered-fukawa",
        riskTolerance: 0.35,
        bluffing: 0.25,
      },
      privateKnowledge: {
        wolfTeammates: [target(4, "黑白熊")],
        aiMemory: { seatId: checked.seatId, day: 1, beliefs: [] },
      },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: checked.seatId,
      myRole: "WEREWOLF",
      day: 1,
      personaLabel: "腐川冬子",
      seats: [
        createSeat({ seatId: claimant.seatId, name: claimant.name, suspicion: 35, trust: 65, publicClaims: [blackCheckClaim] }),
        createSeat({ seatId: 2, name: "雾切响子", suspicion: 44, trust: 50 }),
        createSeat({
          seatId: checked.seatId,
          name: checked.name,
          isSelf: true,
          suspicion: 92,
          trust: 8,
          publicChecksAgainst: [{ claimant, result: "WEREWOLF", day: 1 }],
          pressure: ["被1号苗木诚公开报查杀"],
        }),
        createSeat({ seatId: 7, name: "十神白夜", suspicion: 45, trust: 45 }),
      ],
      knownWolfSeatIds: [4],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [4],
      focus: createSeat({ seatId: claimant.seatId, name: claimant.name, suspicion: 35, trust: 65, publicClaims: [blackCheckClaim] }),
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: [],
      tableMemory,
      tableMood: "被预言家查杀",
    };

    const plan = createSpeechPlan(view, tableRead);
    const planText = [plan.stance, plan.tableTask?.line, ...plan.talkingPoints].join("\n");

    expect(plan.target?.seatId).toBe(claimant.seatId);
    expect(planText).toContain("不认");
    expect(planText).toContain("查杀");
    expect(planText).not.toContain("验人理由");
    expect(planText).not.toContain("起跳收益");
    expect(planText).not.toContain("票口边界");
    expect(planText).toContain("一句话把我按死");
    expect(planText).not.toContain("谁最轻松");
    expect(planText).toContain("我哪里不接");
    expect(planText).toContain("我今天怎么活");
    expect(planText).not.toContain("十神");
  });

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

  it("allows speech pressure on a dead-seer gold water target after hard public counter-evidence", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Legacy Gold");
    const alternative = target(3, "Alternative");
    const checkerA = target(5, "Live Seer A");
    const checkerB = target(6, "Live Seer B");
    const tableMemory = createTableMemory({
      day: 3,
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead seer left a gold-water result.",
        },
      ],
      focus: [{ seat: gold, reasons: ["multiple public black checks"], score: 96 }],
      reasoningCues: [
        {
          cueId: "legacy-gold-speech-hard-counter",
          day: 3,
          kind: "counterclaim",
          weight: "strong",
          target: gold,
          summary: "two living seer claims both challenge the legacy gold",
          evidence: ["two public black checks"],
        },
      ],
    });
    const goldSeat = createSeat({
      seatId: gold.seatId,
      name: gold.name,
      suspicion: 94,
      trust: 18,
      pressure: ["two public black checks"],
      votesReceived: 2,
      publicChecksAgainst: [
        { claimant: checkerA, result: "WEREWOLF", day: 3 },
        { claimant: checkerB, result: "WEREWOLF", day: 3 },
      ],
      publicStancedBy: [createPressure(checkerA, gold), createPressure(checkerB, gold, "QUESTION")],
    });
    const view = {
      ...createView(tableMemory),
      day: 3,
      myRole: "VILLAGER",
      aliveSeats: [target(1, "Speaker"), gold, alternative, checkerA, checkerB],
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches: [{ seq: 12, day: 3, speaker: checkerA, message: "5 points at 2 with a public black check." }],
        tableMemory,
      },
      privateKnowledge: { aiMemory: { seatId: 1, day: 3, beliefs: [] } },
      allowedActions: [{ type: "speak" }],
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "VILLAGER",
      day: 3,
      seats: [
        createSeat({ seatId: 1, name: "Speaker", isSelf: true, suspicion: 0, trust: 100 }),
        goldSeat,
        createSeat({ seatId: alternative.seatId, name: alternative.name, suspicion: 42, trust: 48 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      focus: goldSeat,
      voteSnapshot: {
        ...emptyVoteSnapshot,
        leaders: [gold],
      },
      recentSpeeches: view.publicSummary.recentSpeeches,
      recentDeaths: ["Dead Seer died"],
      tableMemory,
      tableMood: "hard public evidence challenges a legacy gold",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.target?.seatId).toBe(gold.seatId);
  });
});

describe("class-trial dramatic speech planning", () => {
  it("replaces vague hidden seer-check wording in class-trial mode", () => {
    const view = {
      ...createView(createTableMemory()),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      roleCard: classTrialRoleCard("naegi", "苗木诚"),
      aliveSeats: Array.from({ length: 10 }, (_, index) => target(index + 1, `${index + 1}号`)),
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: 2, result: "GOOD" }],
      },
    } as AgentView;

    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      personaLabel: "苗木诚",
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "雾切响子", suspicion: 38, trust: 62 }),
        createSeat({ seatId: 3, name: "腐川冬子", suspicion: 49, trust: 42, pressure: ["解释还没接上"] }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [2],
      wolfTeammateSeatIds: [],
      focus: createSeat({ seatId: 3, name: "腐川冬子", suspicion: 49, trust: 42, pressure: ["解释还没接上"] }),
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory: createTableMemory(),
      tableMood: "首日学级裁判低信息",
    };

    const plan = createSpeechPlan(view, tableRead);
    const planText = [plan.stance, ...plan.talkingPoints].join("\n");

    expect(planText).not.toContain("偏好信息");
    expect(planText).not.toContain("2号");
    expect(planText).not.toContain("雾切响子");
    expect(planText).toContain("验人线");
    expect(planText).toContain("裁判席");
  });

  it("does not reintroduce a hidden class-trial good-check target through repeated pressure table tasks", () => {
    const hiddenGood = target(2, "雾切响子");
    const pressureSpeaker = target(3, "腐川冬子");
    const tableMemory = createTableMemory({
      speechInfluence: [
        {
          sourceSpeechSeq: 2,
          day: 1,
          speaker: pressureSpeaker,
          target: hiddenGood,
          direction: "pressure",
          summary: "多人接住2号压力",
          followupActors: [target(4, "黑白熊"), target(5, "江之岛盾子")],
          followupCount: 2,
        },
      ],
    });
    const recentSpeeches = [
      { seq: 1, day: 1, speaker: target(1, "苗木诚"), message: "1号发言。平安夜先按女巫用药处理。" },
      { seq: 2, day: 1, speaker: pressureSpeaker, message: "3号发言。2号这段解释还没接上。" },
      { seq: 3, day: 1, speaker: target(4, "黑白熊"), message: "4号发言。我也接2号这个压力。" },
    ];
    const view = {
      ...createView(tableMemory),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      roleCard: classTrialRoleCard("naegi", "苗木诚"),
      aliveSeats: Array.from({ length: 10 }, (_, index) => target(index + 1, `${index + 1}号`)),
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches,
        tableMemory,
      },
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: hiddenGood.seatId, result: "GOOD" }],
      },
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      personaLabel: "苗木诚",
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: hiddenGood.seatId, name: hiddenGood.name, suspicion: 62, trust: 38 }),
        createSeat({ seatId: pressureSpeaker.seatId, name: pressureSpeaker.name, suspicion: 49, trust: 42 }),
        createSeat({ seatId: 4, name: "黑白熊", suspicion: 45, trust: 45 }),
        createSeat({ seatId: 5, name: "江之岛盾子", suspicion: 44, trust: 45 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [hiddenGood.seatId],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches,
      recentDeaths: [],
      tableMemory,
      tableMood: "hidden good check under repeated public pressure",
    };

    const plan = createSpeechPlan(view, tableRead);
    const talkingPointText = plan.talkingPoints.join("\n");

    expect(talkingPointText).not.toContain("偏好信息");
    expect(talkingPointText).not.toContain("2号");
    expect(talkingPointText).not.toContain("雾切响子");
    expect(talkingPointText).toContain("验人线");
    expect(talkingPointText).toContain("裁判席");
  });

  it("protects earlier hidden class-trial good checks from repeated pressure table tasks", () => {
    const hiddenEarlierGood = target(2, "雾切响子");
    const hiddenLatestGood = target(5, "江之岛盾子");
    const pressureSpeaker = target(3, "腐川冬子");
    const tableMemory = createTableMemory({
      speechInfluence: [
        {
          sourceSpeechSeq: 2,
          day: 1,
          speaker: pressureSpeaker,
          target: hiddenEarlierGood,
          direction: "pressure",
          summary: "多人接住2号压力",
          followupActors: [target(4, "黑白熊"), target(6, "塞蕾丝缇雅")],
          followupCount: 2,
        },
      ],
    });
    const recentSpeeches = [
      { seq: 1, day: 1, speaker: target(1, "苗木诚"), message: "1号发言。平安夜先按女巫用药处理。" },
      { seq: 2, day: 1, speaker: pressureSpeaker, message: "3号发言。2号这段解释还没接上。" },
      { seq: 3, day: 1, speaker: target(4, "黑白熊"), message: "4号发言。我也接2号这个压力。" },
    ];
    const view = {
      ...createView(tableMemory),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      roleCard: classTrialRoleCard("naegi", "苗木诚"),
      aliveSeats: Array.from({ length: 10 }, (_, index) => target(index + 1, `${index + 1}号`)),
      publicSummary: {
        ...createView(tableMemory).publicSummary,
        recentSpeeches,
        tableMemory,
      },
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [
          { day: 1, seerSeatId: 1, targetSeatId: hiddenEarlierGood.seatId, result: "GOOD" },
          { day: 1, seerSeatId: 1, targetSeatId: hiddenLatestGood.seatId, result: "GOOD" },
        ],
      },
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      personaLabel: "苗木诚",
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: hiddenEarlierGood.seatId, name: hiddenEarlierGood.name, suspicion: 62, trust: 38 }),
        createSeat({ seatId: pressureSpeaker.seatId, name: pressureSpeaker.name, suspicion: 49, trust: 42 }),
        createSeat({ seatId: 4, name: "黑白熊", suspicion: 45, trust: 45 }),
        createSeat({ seatId: hiddenLatestGood.seatId, name: hiddenLatestGood.name, suspicion: 50, trust: 50 }),
        createSeat({ seatId: 6, name: "塞蕾丝缇雅", suspicion: 44, trust: 45 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [hiddenEarlierGood.seatId, hiddenLatestGood.seatId],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches,
      recentDeaths: [],
      tableMemory,
      tableMood: "earlier hidden good check under repeated public pressure",
    };

    const plan = createSpeechPlan(view, tableRead);
    const talkingPointText = plan.talkingPoints.join("\n");

    expect(plan.tableTask?.target?.seatId).not.toBe(hiddenEarlierGood.seatId);
    expect(plan.tableTask?.line ?? "").not.toContain("2号");
    expect(talkingPointText).not.toContain("偏好信息");
    expect(talkingPointText).not.toContain("2号");
    expect(talkingPointText).not.toContain("雾切响子");
    expect(talkingPointText).toContain("验人线");
    expect(talkingPointText).toContain("裁判席");
  });

  it("keeps ordinary hidden seer-check wording outside class-trial mode", () => {
    const view = {
      ...createView(createTableMemory()),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: 2, result: "GOOD" }],
      },
    } as AgentView;
    const tableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      seats: [createSeat({ seatId: 1, isSelf: true }), createSeat({ seatId: 2, name: "P2", suspicion: 35, trust: 65 })],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [2],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory: createTableMemory(),
      tableMood: "ordinary",
    } as AiTableRead;

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.talkingPoints.join("\n")).toContain("偏好信息");
  });

  it("uses class-trial witch hard-claim wording only in class-trial mode", () => {
    const tableMemory = createTableMemory();
    const classTrialView = {
      ...createView(tableMemory),
      phase: "DAY_SPEECH",
      myRole: "WITCH",
      roleCard: classTrialRoleCard("celestia", "塞蕾丝缇雅"),
      privateKnowledge: { aiMemory: { seatId: 1, day: 1, beliefs: [] } },
    } as AgentView;
    const ordinaryView = {
      ...classTrialView,
      roleCard: undefined,
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "WITCH",
      day: 1,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 65, trust: 40 }),
        createSeat({ seatId: 2, name: "P2", suspicion: 50, trust: 42 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory,
      tableMood: "self pressure",
    };

    const classTrialPlan = createSpeechPlan(classTrialView, tableRead);
    const ordinaryPlan = createSpeechPlan(ordinaryView, tableRead);

    expect(classTrialPlan.talkingPoints.join("\n")).toContain("女巫在这里");
    expect(classTrialPlan.talkingPoints.join("\n")).toContain("裁判席");
    expect(ordinaryPlan.talkingPoints.join("\n")).toContain("我拍女巫");
    expect(ordinaryPlan.talkingPoints.join("\n")).not.toContain("裁判席");
  });

  it("uses class-trial hunter hard-claim wording only in class-trial mode", () => {
    const tableMemory = createTableMemory();
    const classTrialView = {
      ...createView(tableMemory),
      phase: "DAY_SPEECH",
      myRole: "HUNTER",
      roleCard: classTrialRoleCard("togami", "十神白夜"),
      privateKnowledge: { aiMemory: { seatId: 1, day: 1, beliefs: [] } },
    } as AgentView;
    const ordinaryView = {
      ...classTrialView,
      roleCard: undefined,
    } as AgentView;
    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "HUNTER",
      day: 1,
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 65, trust: 40 }),
        createSeat({ seatId: 2, name: "P2", suspicion: 50, trust: 42 }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory,
      tableMood: "self pressure",
    };

    const classTrialPlan = createSpeechPlan(classTrialView, tableRead);
    const ordinaryPlan = createSpeechPlan(ordinaryView, tableRead);

    expect(classTrialPlan.talkingPoints.join("\n")).toContain("猎人的枪就在这里");
    expect(ordinaryPlan.talkingPoints.join("\n")).toContain("我拍猎人，今天不要再分票");
  });
});

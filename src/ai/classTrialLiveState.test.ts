import { describe, expect, it } from "vitest";
import type { ActionTarget, AgentView, ClaimBoardItem, SpeechPlan } from "@/game/types";
import { buildClassTrialLiveState, formatClassTrialLiveStateForPrompt } from "./classTrialLiveState";

const target = (seatId: number, name = `P${seatId}`): ActionTarget => ({ seatId, name });

describe("buildClassTrialLiveState", () => {
  it("returns undefined outside class-trial roles", () => {
    const state = buildClassTrialLiveState(
      view({
        roleCard: { ...roleCard("kirigiri", "雾切响子"), theme: "default" },
      }),
      plan(),
    );

    expect(state).toBeUndefined();
  });

  it("turns public pressure on self into self-preserve state", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(3, "腐川冬子");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: checked.seatId,
        myRole: "WEREWOLF",
        roleCard: roleCard("fukawa", checked.name),
        aliveSeats: [claimant, target(2, "雾切响子"), checked],
        claimBoard: [seerClaim({ claimant, checked })],
      }),
      plan({ target: claimant, kind: "defend" }),
    );

    expect(state?.intent).toBe("self_preserve");
    expect(state?.emotionalPressure).toBe("high");
    expect(state?.target?.seatId).toBe(claimant.seatId);
    expect(state?.publicMove).toContain("不认");
    expect(formatClassTrialLiveStateForPrompt(state!)).toContain("self_preserve");
  });

  it("steers a black-check target away from reusing peaceful-night background", () => {
    const claimant = target(1, "苗木诚");
    const observer = target(2, "雾切响子");
    const checked = target(3, "腐川冬子");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: checked.seatId,
        myRole: "WEREWOLF",
        roleCard: roleCard("fukawa", checked.name),
        aliveSeats: [claimant, observer, checked],
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。" },
          { seq: 2, day: 1, speaker: observer, message: "平安夜，女巫用药了，这个先放一边。3号腐川冬子正面接结果。" },
        ],
      }),
      plan({ target: claimant, kind: "defend" }),
    );

    expect(state?.mustAvoidRepeating.join(" ")).toContain("被查杀位回应不要再借平安夜");
  });

  it("keeps an unopposed black-check claimant provisional instead of pressuring them as a villager", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(3, "腐川冬子");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 2,
        myRole: "VILLAGER",
        roleCard: roleCard("kirigiri", "雾切响子"),
        aliveSeats: [claimant, target(2, "雾切响子"), checked],
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [{ seq: 1, day: 1, speaker: claimant, message: "我跳预言家，3号腐川冬子查杀。" }],
      }),
      plan({ target: claimant }),
    );

    expect(state?.intent).toBe("test_reaction");
    expect(state?.target?.seatId).toBe(checked.seatId);
    expect(state?.publicMove).toContain("不替查杀位松绑");
    expect(state?.publicMove).toContain("不要追问首验理由");
    expect(state?.publicMove).toContain("不要评价首跳者票压太满");
    expect(state?.publicMove).toContain("被查杀位");
    expect(state?.publicMove).toContain("对跳");
    expect(state?.publicMove).not.toContain("报查杀者为什么现在要把票塞过来");
  });

  it("distances from a black-checked wolf teammate through reactions instead of reusing claimant pressure", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(3, "腐川冬子");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 5,
        myRole: "WEREWOLF",
        roleCard: roleCard("enoshima", "江之岛盾子"),
        aliveSeats: [claimant, target(2, "雾切响子"), checked, target(5, "江之岛盾子")],
        privateKnowledge: {
          wolfTeammates: [checked, target(5, "江之岛盾子")],
          aiMemory: { seatId: 5, day: 1, beliefs: [] },
        },
        claimBoard: [seerClaim({ claimant, checked })],
      }),
      plan({ target: claimant }),
    );

    expect(state?.intent).toBe("distance_teammate");
    expect(state?.target?.seatId).toBe(checked.seatId);
    expect(state?.publicMove).toContain("不复读查杀发言太满");
    expect(state?.publicMove).toContain("谁救得太快");
  });

  it("pivots later observers from checked-seat response to follow-up pressure after the checked seat has spoken", () => {
    const claimant = target(1, "苗木诚");
    const observer = target(2, "雾切响子");
    const checked = target(3, "腐川冬子");
    const follower = target(4, "黑白熊");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 6,
        myRole: "VILLAGER",
        roleCard: roleCard("celestia", "塞蕾丝缇雅"),
        aliveSeats: [claimant, observer, checked, follower, target(6, "塞蕾丝缇雅")],
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "我跳预言家，3号腐川冬子查杀，今天票先压这里。" },
          { seq: 2, day: 1, speaker: observer, message: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
          { seq: 3, day: 1, speaker: checked, message: "我不认这条查杀，苗木诚一句话就想把我按死。" },
          { seq: 4, day: 1, speaker: follower, message: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。" },
        ],
      }),
      plan({ target: checked }),
    );

    expect(state?.intent).toBe("test_reaction");
    expect(state?.target?.seatId).toBe(follower.seatId);
    expect(state?.publicMove).toContain("停止向她重复下注");
    expect(state?.publicMove).toContain("跟注者");
    expect(state?.publicMove).not.toContain("先逼被查杀位正面接");
  });

  it("turns Tomori's late black-check pivot into a voice-disconnect read instead of another checked-seat demand", () => {
    const claimant = target(1, "苗木诚");
    const observer = target(2, "雾切响子");
    const checked = target(3, "腐川冬子");
    const follower = target(6, "塞蕾丝缇雅");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 8,
        myRole: "VILLAGER",
        roleCard: roleCard("tomori", "高松灯"),
        aliveSeats: [claimant, observer, checked, follower, target(8, "高松灯")],
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "我跳预言家，3号腐川冬子查杀，今天票先压这里。" },
          { seq: 2, day: 1, speaker: observer, message: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
          { seq: 3, day: 1, speaker: checked, message: "我不认这条查杀，苗木诚一句话就想把我按死。" },
          { seq: 4, day: 1, speaker: target(4, "黑白熊"), message: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。" },
          { seq: 5, day: 1, speaker: follower, message: "黑白熊已经替你把话压到腐川脸上，你却选了一个更模糊的落脚点。" },
        ],
      }),
      plan({ target: checked }),
    );

    expect(state?.target?.seatId).toBe(follower.seatId);
    expect(state?.publicMove).toContain("声音");
    expect(state?.publicMove).toContain("没接上");
    expect(state?.publicMove).toContain("跟压");
    expect(state?.publicMove).not.toContain("不要再问被查杀位");
  });

  it("turns Anon's late wolf diversion into a social tempo pivot instead of dragging the table back to the claimant", () => {
    const claimant = target(1, "苗木诚");
    const observer = target(2, "雾切响子");
    const checked = target(3, "腐川冬子");
    const follower = target(6, "塞蕾丝缇雅");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 9,
        myRole: "WEREWOLF",
        roleCard: roleCard("anon", "千早爱音"),
        aliveSeats: [claimant, observer, checked, follower, target(9, "千早爱音")],
        privateKnowledge: {
          wolfTeammates: [checked, target(9, "千早爱音")],
          aiMemory: { seatId: 9, day: 1, beliefs: [] },
        },
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "我跳预言家，3号腐川冬子查杀，今天票先压这里。" },
          { seq: 2, day: 1, speaker: observer, message: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
          { seq: 3, day: 1, speaker: checked, message: "我不认这条查杀，苗木诚一句话就想把我按死。" },
          { seq: 4, day: 1, speaker: target(4, "黑白熊"), message: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。" },
          { seq: 5, day: 1, speaker: follower, message: "你问5号是不是在等后置位帮她把结论说圆，那你呢。" },
        ],
      }),
      plan({ target: claimant }),
    );

    expect(state?.intent).toBe("misdirect");
    expect(state?.target?.seatId).toBe(follower.seatId);
    expect(state?.publicMove).toContain("气氛");
    expect(state?.publicMove).toContain("关系链");
    expect(state?.publicMove).toContain("接话");
    expect(state?.publicMove).not.toContain("查杀位已经接过话");
  });

  it("lets a wolf teammate divert to a follower once the table is repeating the teammate's black-check response", () => {
    const claimant = target(1, "苗木诚");
    const observer = target(2, "雾切响子");
    const checked = target(3, "腐川冬子");
    const follower = target(4, "黑白熊");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 5,
        myRole: "WEREWOLF",
        roleCard: roleCard("enoshima", "江之岛盾子"),
        aliveSeats: [claimant, observer, checked, follower, target(5, "江之岛盾子")],
        privateKnowledge: {
          wolfTeammates: [checked, target(5, "江之岛盾子")],
          aiMemory: { seatId: 5, day: 1, beliefs: [] },
        },
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "我跳预言家，3号腐川冬子查杀，今天票先压这里。" },
          { seq: 2, day: 1, speaker: observer, message: "这条查杀先放桌面，3号腐川冬子必须正面接。" },
          { seq: 3, day: 1, speaker: checked, message: "我不认这条查杀，苗木诚一句话就想把我按死。" },
          { seq: 4, day: 1, speaker: follower, message: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。" },
        ],
      }),
      plan({ target: claimant }),
    );

    expect(state?.intent).toBe("misdirect");
    expect(state?.target?.seatId).toBe(follower.seatId);
    expect(state?.publicMove).toContain("跟压者");
    expect(state?.publicMove).toContain("别借同一句查杀表演");
    expect(state?.publicMove).not.toContain("被查杀者怎么接");
  });

  it("lets the same migrated role choose different live intents in different table states", () => {
    const opening = buildClassTrialLiveState(
      view({
        mySeatId: 2,
        roleCard: roleCard("kirigiri", "雾切响子"),
        aliveSeats: [target(1, "苗木诚"), target(2, "雾切响子"), target(3, "腐川冬子")],
      }),
      plan(),
    );
    const pressured = buildClassTrialLiveState(
      view({
        mySeatId: 2,
        roleCard: roleCard("kirigiri", "雾切响子"),
        aliveSeats: [target(1, "苗木诚"), target(2, "雾切响子"), target(3, "腐川冬子")],
        recentSpeeches: [{ seq: 1, day: 1, speaker: target(1, "苗木诚"), message: "2号雾切响子，你现在必须给站边。" }],
      }),
      plan({ target: target(1, "苗木诚") }),
    );

    expect(opening?.intent).toBe("withhold");
    expect(pressured?.intent).not.toBe(opening?.intent);
    expect(pressured?.target?.seatId).toBe(1);
  });

  it("carries role overuse bans into live state repetition avoidance", () => {
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 2,
        roleCard: roleCard("kirigiri", "雾切响子"),
        recentSpeeches: [{ seq: 1, day: 1, speaker: target(1, "苗木诚"), message: "这里证据链需要闭合，后续看验证。" }],
      }),
      plan(),
    );

    expect(state?.mustAvoidRepeating.join(" ")).toContain("证据链");
  });

  it("carries repeated black-check talk into live state repetition avoidance", () => {
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 5,
        myRole: "WEREWOLF",
        roleCard: roleCard("enoshima", "江之岛盾子"),
        privateKnowledge: {
          wolfTeammates: [target(3, "腐川冬子"), target(5, "江之岛盾子")],
          aiMemory: { seatId: 5, day: 1, beliefs: [] },
        },
        claimBoard: [seerClaim({ claimant: target(1, "苗木诚"), checked: target(3, "腐川冬子") })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: target(1, "苗木诚"), message: "我跳预言家，3号腐川冬子查杀，今天票先压这里。" },
          { seq: 2, day: 1, speaker: target(2, "雾切响子"), message: "这条查杀先放桌面，腐川冬子必须正面接。" },
          { seq: 3, day: 1, speaker: target(3, "腐川冬子"), message: "我不认这条查杀，苗木诚报得太干净了。" },
        ],
      }),
      plan({ target: target(1, "苗木诚") }),
    );

    expect(state?.mustAvoidRepeating.join(" ")).toContain("不要复读首跳查杀");
  });

  it("carries repeated black-check follower targets into live state repetition avoidance", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(3, "腐川冬子");
    const follower = target(4, "黑白熊");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 8,
        myRole: "VILLAGER",
        roleCard: roleCard("tomori", "高松灯"),
        aliveSeats: [claimant, checked, follower, target(5, "江之岛盾子"), target(7, "十神白夜"), target(8, "高松灯")],
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。" },
          { seq: 2, day: 1, speaker: checked, message: "腐川冬子。我不认1号苗木诚这条查杀；他一句话就想把我按死。" },
          { seq: 3, day: 1, speaker: follower, message: "我欣赏苗木诚干脆，但他这句查杀像把结果写死了。" },
          { seq: 4, day: 1, speaker: target(5, "江之岛盾子"), message: "4号黑白熊，你一边欣赏苗木诚干脆，一边说他写死结果，你到底站哪边。" },
          { seq: 5, day: 1, speaker: target(7, "十神白夜"), message: "黑白熊，你的标准到底是什么？你两头都站，等于没有标准。" },
        ],
      }),
      plan({ target: follower }),
    );

    expect(state?.mustAvoidRepeating.join(" ")).toContain("不要连续追4号黑白熊");
  });

  it("steers Togami away from copying Enoshima's previous question shape", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(6, "塞蕾丝缇雅");
    const counterClaimant = target(4, "黑白熊");
    const enoshima = target(5, "江之岛盾子");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 7,
        myRole: "HUNTER",
        roleCard: roleCard("togami", "十神白夜"),
        aliveSeats: [claimant, target(2, "雾切响子"), target(3, "腐川冬子"), counterClaimant, enoshima, checked, target(7, "十神白夜")],
        claimBoard: [
          seerClaim({ claimant, checked }),
          seerClaim({ claimant: counterClaimant, checked: claimant }),
        ],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "我是苗木诚，预言家。昨晚验了6号塞蕾丝缇雅，结果是狼。" },
          { seq: 2, day: 1, speaker: target(2, "雾切响子"), message: "苗木，你是首置位，目前没有对跳，我先不反推你。" },
          { seq: 3, day: 1, speaker: target(3, "腐川冬子"), message: "雾切只是把皮球踢给六号。苗木，你也别用安排任务的口气说话。" },
          { seq: 4, day: 1, speaker: counterClaimant, message: "我，黑白熊，现在正式宣布：昨晚我验了1号苗木诚，结果是狼人。" },
          {
            seq: 5,
            day: 1,
            speaker: enoshima,
            message:
              "黑白熊，你报查杀的时机才是全场最妙的。苗木刚跳完，你立刻反手查他——你是昨晚就预言了他会第一个跳预言家，还是刚好验到他，还是说，你就是等着他跳完才好跟？",
          },
          { seq: 6, day: 1, speaker: checked, message: "苗木同学，你报我查杀，这枚筹码我收到了。" },
        ],
      }),
      plan({ target: counterClaimant }),
    );

    const avoid = state?.mustAvoidRepeating.join(" ") ?? "";
    expect(avoid).toContain("不要复制5号江之岛盾子的问法");
    expect(avoid).toContain("十神的合格线");
  });

  it("steers late black-check speakers away from inventory recaps", () => {
    const claimant = target(1, "苗木诚");
    const checked = target(3, "腐川冬子");
    const state = buildClassTrialLiveState(
      view({
        mySeatId: 6,
        myRole: "VILLAGER",
        roleCard: roleCard("celestia", "塞蕾丝缇雅"),
        aliveSeats: [claimant, target(2, "雾切响子"), checked, target(4, "黑白熊"), target(5, "江之岛盾子"), target(6, "塞蕾丝缇雅")],
        claimBoard: [seerClaim({ claimant, checked })],
        recentSpeeches: [
          { seq: 1, day: 1, speaker: claimant, message: "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。" },
          { seq: 2, day: 1, speaker: target(2, "雾切响子"), message: "这条查杀先放桌面，等腐川冬子接。" },
          { seq: 3, day: 1, speaker: checked, message: "腐川冬子。我不认1号苗木诚这条查杀。" },
          { seq: 4, day: 1, speaker: target(4, "黑白熊"), message: "腐川冬子只说不认，没说苗木诚是悍跳还是瞎报。" },
          { seq: 5, day: 1, speaker: target(5, "江之岛盾子"), message: "雾切响子那句等验证太舒服了。" },
        ],
      }),
      plan({ target: target(4, "黑白熊") }),
    );

    expect(state?.mustAvoidRepeating.join(" ")).toContain("不要按顺序复盘苗木/雾切/腐川/黑白熊");
  });
});

function view(
  overrides: Partial<AgentView> & {
    claimBoard?: ClaimBoardItem[];
    recentSpeeches?: AgentView["publicSummary"]["recentSpeeches"];
  } = {},
): AgentView {
  const claimBoard = overrides.claimBoard ?? [];
  const recentSpeeches = overrides.recentSpeeches ?? [];

  return {
    gameId: "test-game",
    day: 1,
    phase: "DAY_SPEECH",
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false, wolfRoles: ["WEREWOLF"] },
    mySeatId: overrides.mySeatId ?? 2,
    myRole: overrides.myRole ?? "VILLAGER",
    roleCard: overrides.roleCard ?? roleCard("kirigiri", "雾切响子"),
    aliveSeats: overrides.aliveSeats ?? [target(1, "苗木诚"), target(2, "雾切响子"), target(3, "腐川冬子")],
    publicEvents: [],
    publicSummary: {
      recentSpeeches,
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard,
      tableMemory: {
        day: 1,
        claimBoard,
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
      },
    },
    privateKnowledge: overrides.privateKnowledge ?? { aiMemory: { seatId: overrides.mySeatId ?? 2, day: 1, beliefs: [] } },
    allowedActions: [],
    ...overrides,
  };
}

function roleCard(id: string, displayName: string): NonNullable<AgentView["roleCard"]> {
  return {
    id,
    displayName,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "",
    reasoningBias: "",
    voteBias: "",
    nightActionBias: "",
    asVillager: "",
    asWerewolf: "",
    pressureResponse: "",
    relationshipHints: [],
    catchphrasePolicy: "",
    forbidden: [],
    classTrialVoiceProfile: {
      personalityCore: ["在保留中施压"],
      valueBiases: ["怀疑过于顺滑的结论"],
      reactionTendencies: ["被催促时先质疑催促者"],
      lightCatchphrases: ["先别替我下结论。"],
      overuseBans: ["不要反复说证据链"],
      scenarioReactions: {
        lowInfoOpening: {
          innerDrive: "不急着贡献完整结论，先观察谁在过早定义局面。",
          speechMove: "只提出一个很窄的疑问，留下判断余地。",
          mustAvoid: "不要开局就做全场逻辑总结。",
        },
      },
      alignmentReactions: {},
      acceptableForms: ["发言短，但能把压力钉到具体人或具体动作上"],
      unacceptableForms: ["像中立审计员总结全场"],
      dramaticBoundaries: {
        allowSharpConflict: true,
        allowIrrationalMisread: true,
        allowDeceptionWhenAligned: true,
        mustStayInTurnOrder: true,
        mustRemainWerewolfPlayable: true,
      },
    },
  };
}

function plan(overrides: Partial<SpeechPlan> = {}): SpeechPlan {
  return {
    kind: "pressure",
    stance: "先保留",
    talkingPoints: ["观察谁急着定义局面"],
    risk: 0.3,
    ...overrides,
  };
}

function seerClaim({ claimant, checked }: { claimant: ActionTarget; checked: ActionTarget }): ClaimBoardItem {
  return {
    claimId: "seer-claim",
    claimant,
    claimedRole: "SEER",
    claimedRoleLabel: "预言家",
    strength: "hard",
    checks: [{ day: 1, target: checked, result: "WEREWOLF" }],
    summary: `${claimant.name}报${checked.name}查杀`,
    lastUpdatedDay: 1,
  };
}

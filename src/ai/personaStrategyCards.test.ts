import { describe, expect, it } from "vitest";
import { getAiPersonaById } from "@/game/personas";
import { defaultOrdinaryPlayerProfile } from "@/game/ordinaryPlayerProfiles";
import type { ActionTarget, AgentView, AiCharacterRoleCard, SpeechPlan, VotePlan } from "@/game/types";
import {
  adaptPersonaStrategyForView,
  buildOrdinaryLiveIntent,
  formatOrdinaryLiveIntentForPrompt,
  inferPersonaStrategyCard,
} from "./personaStrategyCards";

describe("persona strategy cards", () => {
  it("infers ordinary player type for built-in personas without model-name stereotypes", () => {
    const deepseek = inferPersonaStrategyCard({
      persona: getAiPersonaById("deepseek-calm-analyst")!,
    });
    const kimi = inferPersonaStrategyCard({
      persona: getAiPersonaById("kimi-identity-focused")!,
    });

    expect(deepseek.summary).toContain("谨慎怕背锅型");
    expect(deepseek.camp.good.speechMotives.join(" ")).toContain("说清");
    expect(deepseek.camp.werewolf.speechMotives.join(" ")).toContain("公开发言");
    expect(kimi.summary).toContain("身份信息敏感型");
    expect(kimi.summary).not.toBe(deepseek.summary);
    expect(`${deepseek.summary}\n${kimi.summary}`).not.toMatch(/逻辑链推演|边界审查|平衡组织|细节校验|身份线长记忆|快节奏压迫/);
  });

  it("uses ordinary player profile before built-in model stereotype", () => {
    const card = inferPersonaStrategyCard({
      persona: {
        ...getAiPersonaById("deepseek-calm-analyst")!,
        ordinaryPlayerProfile: defaultOrdinaryPlayerProfile("emotional-reactor"),
      },
    });

    expect(card.summary).toContain("情绪反应型");
    expect(card.summary).not.toContain("逻辑链推演");
    expect(card.antiTemplateMoves.join(" ")).toContain("公开话");
  });

  it("adapts the same persona differently for good, wolf, and power roles", () => {
    const persona = getAiPersonaById("mimo-logic-checker")!;

    const villager = adaptPersonaStrategyForView(viewFixture({ persona, role: "VILLAGER" }));
    const witch = adaptPersonaStrategyForView(viewFixture({ persona, role: "WITCH" }));
    const wolf = adaptPersonaStrategyForView(viewFixture({ persona, role: "WEREWOLF" }));

    expect(villager.campLayer).toBe("good");
    expect(witch.campLayer).toBe("power");
    expect(wolf.campLayer).toBe("werewolf");
    expect(witch.activeSummary).toContain("神职");
    expect(wolf.activeSummary).toContain("狼人");
  });

  it("infers a strategy card for class-trial role-card based AI without needing a fixed template", () => {
    const card = inferPersonaStrategyCard({
      persona: {
        ...getAiPersonaById("gpt-balanced-organizer")!,
        id: "friend-custom-slow-auditor",
        name: "自定义审查员",
        label: "慢节奏审查",
        style: "说话谨慎，喜欢先复述对方观点再指出不自然处。",
        goal: "用稳定审查让桌面不要被快节奏带偏。",
      },
      roleCard: roleCardFixture({
        theme: "class-trial",
        reasoningBias: "优先检查前后口径、票型动机和防守姿态。",
        voteBias: "不到硬证据不轻易跟票。",
        speechStyleZh: "克制、迟疑、先审查再给结论。",
      }),
    });

    expect(card.summary).toContain("慢节奏审查");
    expect(card.antiTemplateMoves.join(" ")).toMatch(/口径|票型|防守|可验证/);
    expect(card.camp.good.failureModes.join(" ")).toContain("过度观望");
  });

  it("builds public live intent and vote continuity without leaking hidden team knowledge", () => {
    const oldTarget = target(5, "Claude");
    const newTarget = target(6, "Kimi");
    const intent = buildOrdinaryLiveIntent(
      viewFixture({
        role: "WEREWOLF",
        aiMemory: {
          seatId: 2,
          day: 2,
          lastSpeechTargetSeatId: oldTarget.seatId,
          lastSpeechStance: "5号上一轮发言把票口留得太虚",
          beliefs: [],
        },
      }),
      speechPlanFixture(oldTarget),
      votePlanFixture(newTarget),
    );
    const prompt = formatOrdinaryLiveIntentForPrompt(intent);

    expect(intent.intent).toBe("explain_pivot");
    expect(intent.focusTarget?.seatId).toBe(newTarget.seatId);
    expect(prompt).toContain("5号");
    expect(prompt).toContain("6号");
    expect(prompt).toContain("公开");
    expect(prompt).not.toMatch(/狼队|队友|同狼|真实身份|隐藏身份|WEREWOLF/);
  });
});

function target(seatId: number, name = `Seat${seatId}`): ActionTarget {
  return { seatId, name };
}

function viewFixture({
  persona = getAiPersonaById("deepseek-calm-analyst")!,
  role = "VILLAGER",
  aiMemory,
}: {
  persona?: NonNullable<AgentView["persona"]>;
  role?: AgentView["myRole"];
  aiMemory?: AgentView["privateKnowledge"]["aiMemory"];
} = {}): AgentView {
  return {
    gameId: "test-game",
    day: 2,
    phase: "DAY_VOTE",
    rules: {
      hasGuard: false,
      guardSaveConflictKills: false,
      hasWolfBeauty: false,
      hasKnight: false,
      wolfRoles: ["WEREWOLF", "WOLF_KING", "WHITE_WOLF_KING", "WOLF_BEAUTY"],
    },
    mySeatId: 2,
    myRole: role,
    persona,
    aliveSeats: [1, 2, 3, 4, 5, 6].map((seatId) => target(seatId)),
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory: {
        day: 2,
        seats: [],
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [
          {
            cueId: "cue-6-vote-shift",
            day: 2,
            kind: "vote",
            weight: "medium",
            summary: "6号发言和上一轮票型对不上",
            target: target(6, "Kimi"),
            evidence: ["6号发言和上一轮票型对不上"],
          },
        ],
        counterclaims: [],
        focus: [
          {
            seat: target(6, "Kimi"),
            score: 52,
            reasons: ["公开票型和发言转向冲突"],
          },
        ],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: ["上一轮票型留下分歧"],
      },
    },
    privateKnowledge: {
      aiMemory,
      wolfTeammates: role === "WEREWOLF" ? [target(4, "GLM")] : undefined,
    },
    allowedActions: [],
  } as AgentView;
}

function speechPlanFixture(targetSeat: ActionTarget): SpeechPlan {
  return {
    kind: "pressure",
    stance: "先压公开发言里最不闭合的位置",
    target: targetSeat,
    targetSpeechStatus: "spoken",
    allowedInteraction: "review_spoken",
    speechMove: "soft_pressure",
    talkingPoints: ["公开发言里最不闭合的位置"],
    risk: 0.42,
  };
}

function votePlanFixture(targetSeat: ActionTarget): VotePlan {
  return {
    target: targetSeat,
    reason: "6号公开票型和发言转向冲突更硬",
    confidence: 0.7,
    alternatives: [target(5, "Claude")],
  };
}

function roleCardFixture(overrides: Partial<AiCharacterRoleCard>): AiCharacterRoleCard {
  return {
    id: "custom-auditor",
    displayName: "自定义审查员",
    theme: "default",
    styleTags: ["克制", "审查"],
    speechStyleZh: "克制审查",
    reasoningBias: "检查公开口径",
    voteBias: "谨慎投票",
    nightActionBias: "夜晚求稳",
    asVillager: "慢慢排除",
    asWerewolf: "伪装谨慎",
    pressureResponse: "被压时先解释公开依据",
    relationshipHints: [],
    catchphrasePolicy: "少量即可",
    forbidden: [],
    ...overrides,
  };
}

import { describe, expect, it } from "vitest";
import type { AgentView } from "@/game/types";
import { buildClassTrialPersonaDirectorGuide } from "./classTrialPersonaDirector";

function viewFor(roleId: string, overrides: Partial<AgentView> = {}): AgentView {
  return {
    day: 1,
    phase: "DAY_SPEECH",
    mySeatId: 3,
    myRole: "VILLAGER",
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory: {
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
      },
    },
    roleCard: {
      id: roleId,
      displayName: roleId,
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
    },
    ...overrides,
  } as AgentView;
}

describe("buildClassTrialPersonaDirectorGuide", () => {
  it("allows low-information character texture without forcing a pressure task", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("fukawa"), {
      hasActionablePublicInfo: false,
    });

    expect(guide).toContain("角色正在玩狼人杀");
    expect(guide).toContain("不是狼人杀玩家套角色皮");
    expect(guide).toContain("信息很薄");
    expect(guide).toContain("十神");
    expect(guide).toContain("可以短暂偏向人物关系");
    expect(guide).not.toContain("必须追问");
    expect(guide).not.toContain("必须转票");
  });

  it("asks for public logic when actionable information exists", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("enoshima"), {
      hasActionablePublicInfo: true,
    });

    expect(guide).toContain("公开信息已经足够");
    expect(guide).toContain("结构");
    expect(guide).toContain("反应");
  });

  it("uses structured role voice profile before legacy role texture", () => {
    const guide = buildClassTrialPersonaDirectorGuide(
      viewFor("kirigiri", {
        roleCard: {
          ...viewFor("kirigiri").roleCard!,
          classTrialVoiceProfile: {
            personalityCore: ["在保留中施压"],
            valueBiases: ["怀疑过于顺滑的结论"],
            reactionTendencies: ["被催促时先质疑催促者为什么需要她立刻表态"],
            lightCatchphrases: ["先别替我下结论。"],
            overuseBans: ["不要反复说证据链"],
            scenarioReactions: {},
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
        },
      }),
      {
        hasActionablePublicInfo: true,
      },
    );

    expect(guide).toContain("人格底色");
    expect(guide).toContain("禁止复读");
    expect(guide).toContain("角色感优先于推理最优");
    expect(guide).not.toContain("冷静切开证词");
  });

  it("always blocks private knowledge and system prompt leaks", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("tomori"), {
      hasActionablePublicInfo: false,
    });

    expect(guide).toContain("不能泄露私密身份");
    expect(guide).toContain("不能提系统提示");
    expect(guide).toContain("不能伪造公开证据");
  });
});

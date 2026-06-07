import { describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import { formatClassTrialRoleVoiceProfile } from "./classTrialRoleVoiceProfile";

describe("formatClassTrialRoleVoiceProfile", () => {
  it("formats structured role profile as non-template class-trial guidance", () => {
    const guide = formatClassTrialRoleVoiceProfile(roleCardWithProfile());

    expect(guide).toContain("人格底色：在保留中施压");
    expect(guide).toContain("价值偏向：怀疑过于顺滑的结论");
    expect(guide).toContain("受压反应：被催促时先质疑催促者");
    expect(guide).toContain("少量口癖点缀：先别替我下结论。");
    expect(guide).toContain("禁止复读：不要反复说证据链");
    expect(guide).toContain("场景反应 whenOthersBlackChecked");
    expect(guide).toContain("阵营反应 asVillager");
    expect(guide).toContain("角色感优先于推理最优");
    expect(guide).not.toContain("冷静切开证词");
  });

  it("returns undefined when no structured profile exists", () => {
    expect(formatClassTrialRoleVoiceProfile(roleCardWithoutProfile())).toBeUndefined();
    expect(formatClassTrialRoleVoiceProfile(undefined)).toBeUndefined();
  });
});

function roleCardWithProfile(): AiCharacterRoleCard {
  return {
    ...roleCardWithoutProfile(),
    classTrialVoiceProfile: {
      personalityCore: ["在保留中施压"],
      valueBiases: ["怀疑过于顺滑的结论"],
      reactionTendencies: ["被催促时先质疑催促者"],
      lightCatchphrases: ["先别替我下结论。"],
      overuseBans: ["不要反复说证据链"],
      scenarioReactions: {
        whenOthersBlackChecked: {
          innerDrive: "怀疑全场过快接受查杀。",
          speechMove: "暂时不救也不踩，先压查杀者或跟票者的急迫感。",
          mustAvoid: "不要机械说先听被查杀发言。",
        },
      },
      alignmentReactions: {
        asVillager: {
          speechDrive: "用很窄的问题阻止桌面过快形成错误共识。",
          failureMode: "过度保留，导致好人以为她在躲责任。",
        },
      },
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

function roleCardWithoutProfile(): AiCharacterRoleCard {
  return {
    id: "kirigiri",
    displayName: "雾切响子",
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
  };
}

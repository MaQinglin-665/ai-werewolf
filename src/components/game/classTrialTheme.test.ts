import { describe, expect, it } from "vitest";

import {
  CLASS_TRIAL_CHARACTER_IDS,
  CLASS_TRIAL_CHARACTER_ROSTER,
  CLASS_TRIAL_FIXED_SEAT_ROLES,
  CLASS_TRIAL_LOCAL_ASSET_ROOT,
  CLASS_TRIAL_THEME_MODE_STORAGE_KEY,
  CLASS_TRIAL_THEME_MODES,
  buildClassTrialAiFriends,
  getClassTrialCharacterForSeat,
  getClassTrialCourtBackgroundUrl,
  getClassTrialPackStatus,
  getClassTrialPersonasStatus,
  getClassTrialThemeStatusMessage,
  parseClassTrialThemeMode,
  sanitizeClassTrialPackManifest,
  sanitizeClassTrialPersonas,
  type ClassTrialPackManifest,
} from "./classTrialTheme";

describe("class trial theme model", () => {
  it("keeps the local asset path and storage key stable", () => {
    expect(CLASS_TRIAL_LOCAL_ASSET_ROOT).toBe("local-assets/class-trial-pack");
    expect(CLASS_TRIAL_THEME_MODE_STORAGE_KEY).toBe("ai-werewolf-class-trial-theme-mode");
  });

  it("parses only supported theme modes", () => {
    expect(CLASS_TRIAL_THEME_MODES).toEqual(["default", "class-trial"]);
    expect(parseClassTrialThemeMode("class-trial")).toBe("class-trial");
    expect(parseClassTrialThemeMode("default")).toBe("default");
    expect(parseClassTrialThemeMode("公网")).toBe("default");
    expect(parseClassTrialThemeMode(null)).toBe("default");
  });

  it("requires the 9 expected local theme characters", () => {
    const manifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: CLASS_TRIAL_CHARACTER_IDS.map((id) => ({
        id,
        displayName: id,
        hasPortrait: true,
        hasThinkingPortrait: true,
        hasAvatar: true,
      })),
    };

    expect(getClassTrialPackStatus(manifest)).toEqual({
      available: true,
      message: "本地主题素材包已就绪。",
      missingCharacterIds: [],
    });
  });

  it("reads an optional class-trial court background from the manifest", () => {
    const manifest = sanitizeClassTrialPackManifest({
      id: "class-trial-pack",
      version: "local-test",
      backgrounds: { courtMain: "/class-trial-pack/backgrounds/court-main.png" },
      characters: [],
    });

    expect(manifest?.backgrounds?.courtMain).toBe("/class-trial-pack/backgrounds/court-main.png");
    expect(getClassTrialCourtBackgroundUrl(manifest)).toBe("/class-trial-pack/backgrounds/court-main.png");
  });

  it("keeps old class-trial manifests valid when backgrounds are absent", () => {
    const manifest = sanitizeClassTrialPackManifest({
      id: "class-trial-pack",
      version: "local-test",
      characters: [],
    });

    expect(manifest?.backgrounds).toBeUndefined();
    expect(getClassTrialCourtBackgroundUrl(manifest)).toBeUndefined();
  });

  it("maps table seats to the fixed class-trial roster and local pack URLs", () => {
    expect(CLASS_TRIAL_CHARACTER_ROSTER.map((character) => character.displayName)).toEqual([
      "苗木诚",
      "雾切响子",
      "腐川冬子",
      "黑白熊",
      "江之岛盾子",
      "塞蕾丝缇雅",
      "十神白夜",
      "高松灯",
      "千早爱音",
    ]);
    expect(CLASS_TRIAL_CHARACTER_IDS).toContain("tomori");
    expect(CLASS_TRIAL_CHARACTER_IDS).not.toContain("hagakure");

    const manifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: [
        {
          id: "kirigiri",
          displayName: "雾切响子",
          portraitUrl: "/p.png",
          thinkingPortraitUrl: "/thinking.png",
          avatarUrl: "/a.png",
          hasPortrait: true,
          hasThinkingPortrait: true,
          hasAvatar: true,
        },
      ],
    };

    expect(getClassTrialCharacterForSeat(1, manifest)).toMatchObject({
      id: "kirigiri",
      displayName: "雾切响子",
      portraitUrl: "/p.png",
      thinkingPortraitUrl: "/thinking.png",
      avatarUrl: "/a.png",
    });
    expect(getClassTrialCharacterForSeat(7, undefined)).toMatchObject({ id: "tomori", displayName: "高松灯" });
    expect(getClassTrialCharacterForSeat(8, undefined)).toMatchObject({ id: "anon", displayName: "千早爱音" });
  });

  it("requires thinking portraits as part of a complete local theme pack", () => {
    const completeManifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: CLASS_TRIAL_CHARACTER_IDS.map((id) => ({
        id,
        displayName: id,
        portraitUrl: `/portraits/${id}.png`,
        thinkingPortraitUrl: `/thinking-portraits/${id}.png`,
        avatarUrl: `/avatars/${id}.png`,
        hasPortrait: true,
        hasThinkingPortrait: true,
        hasAvatar: true,
      })),
    };
    const missingThinkingManifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: CLASS_TRIAL_CHARACTER_IDS.map((id) => ({
        id,
        displayName: id,
        portraitUrl: `/portraits/${id}.png`,
        avatarUrl: `/avatars/${id}.png`,
        hasPortrait: true,
        hasAvatar: true,
      })),
    };

    expect(getClassTrialPackStatus(completeManifest).available).toBe(true);
    expect(getClassTrialPackStatus(missingThinkingManifest)).toMatchObject({
      available: false,
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
    });
  });

  it("calibrates Chihaya Anon with top headroom after replacing her portrait", () => {
    const layouts = CLASS_TRIAL_CHARACTER_ROSTER.map((_, index) => getClassTrialCharacterForSeat(index, undefined).portraitLayout);

    expect(layouts).toHaveLength(9);
    expect(layouts.every(Boolean)).toBe(true);
    expect(getClassTrialCharacterForSeat(8, undefined).portraitLayout).toEqual({
      scale: 1.02,
      x: 0,
      y: 4,
    });
    expect(getClassTrialCharacterForSeat(7, undefined).portraitLayout).toMatchObject({
      scale: expect.any(Number),
      x: expect.any(Number),
      y: expect.any(Number),
    });
  });

  it("lets Chihaya Anon's thinking portrait inherit the speaking calibration", () => {
    const anon = getClassTrialCharacterForSeat(8, undefined);

    expect(anon.portraitLayout).toEqual({
      scale: 1.02,
      x: 0,
      y: 4,
    });
    expect(anon.thinkingPortraitLayout).toBeUndefined();
  });

  it("reserves top headroom for non-baseline speaking portraits", () => {
    for (const index of CLASS_TRIAL_CHARACTER_ROSTER.keys()) {
      const layout = getClassTrialCharacterForSeat(index, undefined).portraitLayout!;

      expect(layout.y).toBeGreaterThan(0);
    }

    expect(getClassTrialCharacterForSeat(2, undefined).portraitLayout?.scale).toBeLessThan(1);
    expect(getClassTrialCharacterForSeat(5, undefined).portraitLayout?.scale).toBeLessThan(1);
    expect(getClassTrialCharacterForSeat(2, undefined).portraitLayout?.scale).toBeGreaterThanOrEqual(0.98);
    expect(getClassTrialCharacterForSeat(5, undefined).portraitLayout?.scale).toBeGreaterThanOrEqual(0.98);
  });

  it("explains missing local pack data without enabling public use", () => {
    expect(getClassTrialPackStatus(undefined)).toEqual({
      available: false,
      message: "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
    });

    const manifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: [{ id: "kirigiri", displayName: "雾切响子", hasPortrait: true, hasAvatar: true }],
    };

    expect(getClassTrialPackStatus(manifest)).toMatchObject({
      available: false,
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
    });
  });

  it("validates a complete local personas file for the fixed 9-character roster", () => {
    const personas = makeCompletePersonas();
    const status = getClassTrialPersonasStatus(personas);

    expect(status).toEqual({
      available: true,
      message: "本地角色卡已就绪。",
      missingCharacterIds: [],
      invalidCharacterIds: [],
    });
  });

  it("reports missing and malformed local personas without blocking visual theme mode", () => {
    expect(getClassTrialPersonasStatus(undefined)).toEqual({
      available: false,
      message: "未找到本地角色卡。视觉主题可继续，AI 将使用普通行为。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
      invalidCharacterIds: [],
    });

    const partial = sanitizeClassTrialPersonas({
      id: "class-trial-personas",
      version: "local-test",
      characters: [{ id: "naegi", displayName: "苗木诚", seatId: 1, basePersonaId: "gpt-balanced-organizer" }],
    });

    expect(getClassTrialPersonasStatus(partial).message).toBe("本地角色卡缺少 8 个角色。");
  });

  it("builds fixed class-trial AI friends in the approved seat order", () => {
    const friends = buildClassTrialAiFriends(makeCompletePersonas(), "2026-05-27T00:00:00.000Z");

    expect(friends).toHaveLength(9);
    expect(friends.map((friend) => friend.nickname)).toEqual([
      "苗木诚",
      "雾切响子",
      "腐川冬子",
      "黑白熊",
      "江之岛盾子",
      "塞蕾丝缇雅",
      "十神白夜",
      "高松灯",
      "千早爱音",
    ]);
    expect(friends[7]?.id).toBe("class-trial:tomori");
    expect(friends[7]?.roleCard?.displayName).toBe("高松灯");
    expect(friends[3]?.id).toBe("class-trial:monokuma");
    expect(friends.every((friend) => friend.basePersonaId === "mimo-logic-checker")).toBe(true);
    expect(friends.every((friend) => friend.roleCard?.displayName)).toBe(true);
    expect(friends[3]?.roleCard?.displayName).toBe("黑白熊");
    expect(friends[3]?.roleCard?.forbidden.join(" ")).toContain("不能以主持人身份干预规则");
  });

  it("maps the approved class-trial characters to fixed Werewolf identities", () => {
    expect(CLASS_TRIAL_CHARACTER_ROSTER.map((character, index) => `${character.displayName}:${CLASS_TRIAL_FIXED_SEAT_ROLES[index]}`)).toEqual([
      "苗木诚:SEER",
      "雾切响子:WITCH",
      "腐川冬子:VILLAGER",
      "黑白熊:WEREWOLF",
      "江之岛盾子:WEREWOLF",
      "塞蕾丝缇雅:WEREWOLF",
      "十神白夜:HUNTER",
      "高松灯:VILLAGER",
      "千早爱音:VILLAGER",
    ]);
  });

  it("preserves structured class-trial role voice profiles on role cards", () => {
    const personas = makeCompletePersonas({
      kirigiri: {
        personalityCore: ["在保留中施压"],
        valueBiases: ["怀疑过于顺滑的结论"],
        reactionTendencies: ["被催促时先质疑催促者为什么需要她立刻表态"],
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
    });
    const friends = buildClassTrialAiFriends(personas, "2026-06-04T00:00:00.000Z");
    const kirigiriProfile = friends[1]?.roleCard?.classTrialVoiceProfile;

    expect(kirigiriProfile?.personalityCore).toEqual(["在保留中施压"]);
    expect(kirigiriProfile?.scenarioReactions.whenOthersBlackChecked?.speechMove).toContain("查杀者");
    expect(kirigiriProfile?.alignmentReactions.asVillager?.speechDrive).toContain("很窄的问题");
    expect(kirigiriProfile?.dramaticBoundaries.mustStayInTurnOrder).toBe(true);
    expect(friends[7]?.roleCard?.classTrialVoiceProfile).toBeUndefined();
  });

  it("combines asset and role-card status for the landing page", () => {
    const packStatus = getClassTrialPackStatus(undefined);
    const personaStatus = getClassTrialPersonasStatus(makeCompletePersonas());

    expect(getClassTrialThemeStatusMessage(packStatus, personaStatus)).toContain("素材包");
    expect(getClassTrialThemeStatusMessage(packStatus, personaStatus)).toContain("角色卡已就绪");
  });
});

type TestRoleVoiceProfile = NonNullable<ReturnType<typeof buildClassTrialAiFriends>[number]["roleCard"]>["classTrialVoiceProfile"];

function makeCompletePersonas(profileById: Partial<Record<(typeof CLASS_TRIAL_CHARACTER_IDS)[number], TestRoleVoiceProfile>> = {}) {
  return sanitizeClassTrialPersonas({
    id: "class-trial-personas",
    version: "local-test",
    characters: CLASS_TRIAL_CHARACTER_ROSTER.map((character, index) => ({
      id: character.id,
      displayName: character.displayName,
      seatId: index + 1,
      basePersonaId: character.id === "monokuma" ? "doubao-pressure-bluffer" : "gpt-balanced-organizer",
      styleTags: ["class-trial"],
      speechStyleZh: `${character.displayName} 的中文狼人杀发言风格。`,
      reasoningBias: "优先依据公开桌面推理。",
      voteBias: "认真服务阵营胜利。",
      nightActionBias: "夜晚行动遵守合法候选。",
      asVillager: "作为好人时按公开证据找狼。",
      asWerewolf: "作为狼人时只用公开理由伪装。",
      pressureResponse: "被怀疑时解释公开逻辑。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短口癖，不复刻大段原台词。",
      forbidden: character.id === "monokuma" ? ["不能以主持人身份干预规则。"] : ["不能泄露隐藏身份。"],
      classTrialVoiceProfile: profileById[character.id],
    })),
  })!;
}

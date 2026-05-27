import { describe, expect, it } from "vitest";

import {
  CLASS_TRIAL_CHARACTER_IDS,
  CLASS_TRIAL_CHARACTER_ROSTER,
  CLASS_TRIAL_LOCAL_ASSET_ROOT,
  CLASS_TRIAL_THEME_MODE_STORAGE_KEY,
  CLASS_TRIAL_THEME_MODES,
  getClassTrialCharacterForSeat,
  getClassTrialPackStatus,
  parseClassTrialThemeMode,
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
      characters: CLASS_TRIAL_CHARACTER_IDS.map((id) => ({ id, displayName: id, hasPortrait: true, hasAvatar: true })),
    };

    expect(getClassTrialPackStatus(manifest)).toEqual({
      available: true,
      message: "本地主题素材包已就绪。",
      missingCharacterIds: [],
    });
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
      "叶隐康比吕",
      "千早爱音",
    ]);

    const manifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: [{ id: "kirigiri", displayName: "雾切响子", portraitUrl: "/p.png", avatarUrl: "/a.png", hasPortrait: true, hasAvatar: true }],
    };

    expect(getClassTrialCharacterForSeat(1, manifest)).toMatchObject({
      id: "kirigiri",
      displayName: "雾切响子",
      portraitUrl: "/p.png",
      avatarUrl: "/a.png",
    });
    expect(getClassTrialCharacterForSeat(8, undefined)).toMatchObject({ id: "anon", displayName: "千早爱音" });
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
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS.filter((id) => id !== "kirigiri"),
    });
  });
});

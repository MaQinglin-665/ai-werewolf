export const CLASS_TRIAL_THEME_MODE_STORAGE_KEY = "ai-werewolf-class-trial-theme-mode";
export const CLASS_TRIAL_LOCAL_ASSET_ROOT = "local-assets/class-trial-pack";

export const CLASS_TRIAL_THEME_MODES = ["default", "class-trial"] as const;
export type ClassTrialThemeMode = (typeof CLASS_TRIAL_THEME_MODES)[number];

export const CLASS_TRIAL_CHARACTER_IDS = [
  "naegi",
  "kirigiri",
  "fukawa",
  "monokuma",
  "enoshima",
  "celestia",
  "togami",
  "hagakure",
  "anon",
] as const;

export type ClassTrialCharacterId = (typeof CLASS_TRIAL_CHARACTER_IDS)[number];

export const CLASS_TRIAL_CHARACTER_ROSTER: Array<{ id: ClassTrialCharacterId; displayName: string }> = [
  { id: "naegi", displayName: "苗木诚" },
  { id: "kirigiri", displayName: "雾切响子" },
  { id: "fukawa", displayName: "腐川冬子" },
  { id: "monokuma", displayName: "黑白熊" },
  { id: "enoshima", displayName: "江之岛盾子" },
  { id: "celestia", displayName: "塞蕾丝缇雅" },
  { id: "togami", displayName: "十神白夜" },
  { id: "hagakure", displayName: "叶隐康比吕" },
  { id: "anon", displayName: "千早爱音" },
];

export type ClassTrialPackCharacter = {
  id: string;
  displayName: string;
  portraitUrl?: string;
  avatarUrl?: string;
  hasPortrait?: boolean;
  hasAvatar?: boolean;
  sourcePage?: string;
};

export type ClassTrialPackManifest = {
  id: string;
  version: string;
  characters: ClassTrialPackCharacter[];
};

export type ClassTrialPackStatus = {
  available: boolean;
  message: string;
  missingCharacterIds: readonly string[];
};

export function parseClassTrialThemeMode(value: unknown): ClassTrialThemeMode {
  return value === "class-trial" ? "class-trial" : "default";
}

export function getClassTrialCharacterForSeat(
  seatIndex: number,
  manifest: ClassTrialPackManifest | undefined,
): ClassTrialPackCharacter {
  const fallback = CLASS_TRIAL_CHARACTER_ROSTER[seatIndex % CLASS_TRIAL_CHARACTER_ROSTER.length];
  const packed = manifest?.characters.find((character) => character.id === fallback.id);

  return {
    ...fallback,
    ...packed,
    displayName: packed?.displayName ?? fallback.displayName,
  };
}

export function getClassTrialPackStatus(manifest: ClassTrialPackManifest | undefined): ClassTrialPackStatus {
  if (!manifest) {
    return {
      available: false,
      message: "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
    };
  }

  const completeIds = new Set(
    manifest.characters
      .filter((character) => character.hasPortrait && character.hasAvatar)
      .map((character) => character.id),
  );
  const missingCharacterIds = CLASS_TRIAL_CHARACTER_IDS.filter((id) => !completeIds.has(id));

  return {
    available: missingCharacterIds.length === 0,
    message:
      missingCharacterIds.length === 0
        ? "本地主题素材包已就绪。"
        : `本地主题素材包缺少 ${missingCharacterIds.length} 个角色素材。`,
    missingCharacterIds,
  };
}

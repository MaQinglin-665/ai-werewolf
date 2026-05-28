import { getDefaultAiFriends } from "@/game/aiFriends";
import type { AiCharacterRoleCard, AiFriendConfig } from "@/game/types";

export const CLASS_TRIAL_THEME_MODE_STORAGE_KEY = "ai-werewolf-class-trial-theme-mode";
export const CLASS_TRIAL_LOCAL_ASSET_ROOT = "local-assets/class-trial-pack";
export const CLASS_TRIAL_DEFAULT_BOARD_ID = "9p-seer-witch-hunter";

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
  "tomori",
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
  { id: "tomori", displayName: "高松灯" },
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

export type ClassTrialCharacterPersona = {
  id: ClassTrialCharacterId;
  displayName: string;
  seatId: number;
  basePersonaId: string;
  styleTags: string[];
  speechStyleZh: string;
  reasoningBias: string;
  voteBias: string;
  nightActionBias: string;
  asVillager: string;
  asWerewolf: string;
  pressureResponse: string;
  relationshipHints: string[];
  catchphrasePolicy: string;
  forbidden: string[];
  voiceProfileId?: string;
  voiceLocale?: string;
  voiceRewritePolicy?: string;
};

export type ClassTrialPersonasFile = {
  id: string;
  version: string;
  characters: ClassTrialCharacterPersona[];
};

export type ClassTrialPersonasStatus = {
  available: boolean;
  message: string;
  missingCharacterIds: readonly string[];
  invalidCharacterIds: readonly string[];
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

export function sanitizeClassTrialPersonas(value: unknown): ClassTrialPersonasFile | undefined {
  if (!isRecord(value) || !Array.isArray(value.characters)) return undefined;
  const characters = value.characters
    .map(sanitizeClassTrialCharacterPersona)
    .filter((character): character is ClassTrialCharacterPersona => Boolean(character));
  return {
    id: readString(value.id, 80) || "class-trial-personas",
    version: readString(value.version, 80) || "local",
    characters,
  };
}

export function getClassTrialPersonasStatus(personas: ClassTrialPersonasFile | undefined): ClassTrialPersonasStatus {
  if (!personas) {
    return {
      available: false,
      message: "未找到本地角色卡。视觉主题可继续，AI 将使用普通行为。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
      invalidCharacterIds: [],
    };
  }

  const byId = new Map(personas.characters.map((character) => [character.id, character]));
  const missingCharacterIds = CLASS_TRIAL_CHARACTER_IDS.filter((id) => !byId.has(id));
  const invalidCharacterIds = CLASS_TRIAL_CHARACTER_IDS.filter((id, index) => {
    const character = byId.get(id);
    return Boolean(character && character.seatId !== index + 1);
  });

  return {
    available: missingCharacterIds.length === 0 && invalidCharacterIds.length === 0,
    message:
      missingCharacterIds.length > 0
        ? `本地角色卡缺少 ${missingCharacterIds.length} 个角色。`
        : invalidCharacterIds.length > 0
          ? `本地角色卡有 ${invalidCharacterIds.length} 个座位顺序不一致。`
          : "本地角色卡已就绪。",
    missingCharacterIds,
    invalidCharacterIds,
  };
}

export function getClassTrialThemeStatusMessage(
  packStatus: ClassTrialPackStatus,
  personasStatus: ClassTrialPersonasStatus,
): string {
  return `${packStatus.message} ${personasStatus.message}`;
}

export function buildClassTrialAiFriends(personas: ClassTrialPersonasFile | undefined, now = "class-trial-local"): AiFriendConfig[] {
  const status = getClassTrialPersonasStatus(personas);
  if (!personas || !status.available) return [];

  const defaults = getDefaultAiFriends(now);
  const defaultByPersonaId = new Map(defaults.map((friend) => [friend.basePersonaId, friend]));
  const byId = new Map(personas.characters.map((character) => [character.id, character]));

  return CLASS_TRIAL_CHARACTER_ROSTER.map((rosterCharacter) => {
    const character = byId.get(rosterCharacter.id)!;
    const base = defaultByPersonaId.get(character.basePersonaId) ?? defaults[0]!;
    return {
      ...base,
      id: `class-trial:${character.id}`,
      nickname: character.displayName.slice(0, 16),
      basePersonaId: base.basePersonaId,
      roleCard: toAiCharacterRoleCard(character),
      createdAt: now,
      updatedAt: now,
    };
  });
}

function toAiCharacterRoleCard(character: ClassTrialCharacterPersona): AiCharacterRoleCard {
  return {
    id: character.id,
    displayName: character.displayName,
    theme: "class-trial",
    styleTags: character.styleTags,
    speechStyleZh: character.speechStyleZh,
    reasoningBias: character.reasoningBias,
    voteBias: character.voteBias,
    nightActionBias: character.nightActionBias,
    asVillager: character.asVillager,
    asWerewolf: character.asWerewolf,
    pressureResponse: character.pressureResponse,
    relationshipHints: character.relationshipHints,
    catchphrasePolicy: character.catchphrasePolicy,
    forbidden: character.forbidden,
    voiceProfileId: character.voiceProfileId,
    voiceLocale: character.voiceLocale,
    voiceRewritePolicy: character.voiceRewritePolicy,
  };
}

function sanitizeClassTrialCharacterPersona(value: unknown): ClassTrialCharacterPersona | undefined {
  if (!isRecord(value)) return undefined;
  const id = parseClassTrialCharacterId(value.id);
  if (!id) return undefined;
  const rosterIndex = CLASS_TRIAL_CHARACTER_IDS.indexOf(id);
  const displayName = readString(value.displayName, 24) || CLASS_TRIAL_CHARACTER_ROSTER[rosterIndex]?.displayName;
  const seatId = readNumber(value.seatId, rosterIndex + 1);
  const basePersonaId = readString(value.basePersonaId, 80);
  if (!displayName || !basePersonaId) return undefined;

  return {
    id,
    displayName,
    seatId,
    basePersonaId,
    styleTags: readStringArray(value.styleTags, 8, 28),
    speechStyleZh: readString(value.speechStyleZh, 260) || "像狼人杀玩家一样自然发言，角色风格只作软约束。",
    reasoningBias: readString(value.reasoningBias, 220) || "优先依据公开桌面推理。",
    voteBias: readString(value.voteBias, 220) || "投票认真服务阵营胜利。",
    nightActionBias: readString(value.nightActionBias, 220) || "夜晚行动遵守合法候选。",
    asVillager: readString(value.asVillager, 220) || "作为好人时只按公开信息找狼。",
    asWerewolf: readString(value.asWerewolf, 220) || "作为狼人时只用公开理由伪装。",
    pressureResponse: readString(value.pressureResponse, 220) || "被怀疑时回应公开逻辑。",
    relationshipHints: readStringArray(value.relationshipHints, 8, 120),
    catchphrasePolicy: readString(value.catchphrasePolicy, 180) || "允许极短口癖，不复刻大段原台词。",
    forbidden: readStringArray(value.forbidden, 10, 120),
    voiceProfileId: readString(value.voiceProfileId, 80),
    voiceLocale: readString(value.voiceLocale, 16),
    voiceRewritePolicy: readString(value.voiceRewritePolicy, 120),
  };
}

function parseClassTrialCharacterId(value: unknown): ClassTrialCharacterId | undefined {
  return typeof value === "string" && CLASS_TRIAL_CHARACTER_IDS.includes(value as ClassTrialCharacterId)
    ? (value as ClassTrialCharacterId)
    : undefined;
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : undefined;
}

function readNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 9 ? number : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

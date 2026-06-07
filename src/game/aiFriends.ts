import { getAiPersonaById, getAiRoster } from "./personas";
import { formatAiFriendLlmModelLabel, sanitizeAiFriendLlmConfig, sanitizeAiFriendTtsConfig } from "./llmConfig";
import type { AiCharacterRoleCard, AiFriendConfig, AiFriendSeatSetup, AiPersona, AiPersonaPreferences } from "./types";

export const AI_FRIENDS_STORAGE_KEY = "ai-werewolf-ai-friends-v1";
export const AI_FRIEND_SELECTION_STORAGE_KEY = "ai-werewolf-selected-ai-friends-v1";
export const AI_FRIENDS_EXPORT_VERSION = 1;
export const DEFAULT_AI_FRIEND_ID_PREFIX = "default:";
export const AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH = 220_000;

const AI_FRIEND_AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;

export const AI_FRIEND_PREFERENCE_KEYS: Array<keyof AiPersonaPreferences> = [
  "logic",
  "identity",
  "vote",
  "emotion",
  "memory",
  "leadership",
  "deception",
  "caution",
];

export type AiFriendExport = {
  version: 1;
  friends: AiFriendConfig[];
};

export type ResolvedAiFriend = {
  config: AiFriendConfig;
  persona: AiPersona;
  displayName: string;
  setup: Omit<AiFriendSeatSetup, "seatId">;
};

export function getDefaultAiFriends(now = "built-in"): AiFriendConfig[] {
  return getAiRoster().map((persona) => ({
    id: `${DEFAULT_AI_FRIEND_ID_PREFIX}${persona.id}`,
    nickname: persona.name,
    basePersonaId: persona.id,
    riskTolerance: persona.riskTolerance,
    bluffing: persona.bluffing,
    preferences: normalizePreferences(persona.preferences),
    createdAt: now,
    updatedAt: now,
  }));
}

export function isDefaultAiFriend(friend: Pick<AiFriendConfig, "id">): boolean {
  return friend.id.startsWith(DEFAULT_AI_FRIEND_ID_PREFIX);
}

export function copyAiFriend(friend: AiFriendConfig, options: { id?: string; now?: string } = {}): AiFriendConfig {
  const sanitized = sanitizeAiFriendConfig(friend);
  if (!sanitized) {
    throw new Error("AI 好友基础模型不存在。");
  }
  const now = options.now ?? new Date().toISOString();
  return {
    ...sanitized,
    id: options.id ?? createAiFriendId(),
    nickname: uniqueCopyName(friend.nickname),
    createdAt: now,
    updatedAt: now,
  };
}

export function applyAiFriendPersonaTemplate(friend: AiFriendConfig, basePersonaId: string): AiFriendConfig {
  const basePersona = getAiPersonaById(basePersonaId) ?? getAiPersonaById(friend.basePersonaId);
  if (!basePersona) return friend;
  return {
    ...friend,
    basePersonaId: basePersona.id,
    riskTolerance: basePersona.riskTolerance,
    bluffing: basePersona.bluffing,
    preferences: normalizePreferences(basePersona.preferences),
  };
}

export function createAiFriendId(): string {
  return `friend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function serializeAiFriendExport(friends: AiFriendConfig[]): string {
  return JSON.stringify(
    {
      version: AI_FRIENDS_EXPORT_VERSION,
      friends: sanitizeCustomAiFriends(friends),
    } satisfies AiFriendExport,
    null,
    2,
  );
}

export function parseAiFriendExport(raw: string): AiFriendConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI 好友 JSON 格式不正确。");
  }

  if (!isRecord(parsed) || parsed.version !== AI_FRIENDS_EXPORT_VERSION || !Array.isArray(parsed.friends)) {
    throw new Error("AI 好友导入数据版本不正确。");
  }

  return sanitizeCustomAiFriends(parsed.friends);
}

export function sanitizeCustomAiFriends(values: unknown[]): AiFriendConfig[] {
  const friends = values.map((value) => sanitizeAiFriendConfig(value)).filter((friend): friend is AiFriendConfig => Boolean(friend));
  const seen = new Set<string>();
  return friends.filter((friend) => {
    if (isDefaultAiFriend(friend) || seen.has(friend.id)) return false;
    seen.add(friend.id);
    return true;
  });
}

export function sanitizeAiFriendConfig(value: unknown): AiFriendConfig | undefined {
  if (!isRecord(value)) return undefined;
  const basePersonaId = readString(value.basePersonaId, 80);
  const basePersona = basePersonaId ? getAiPersonaById(basePersonaId) : undefined;
  if (!basePersona) return undefined;

  const now = new Date().toISOString();
  return {
    id: readString(value.id, 80) || createAiFriendId(),
    nickname: sanitizeNickname(readString(value.nickname, 16) || basePersona.name),
    basePersonaId: basePersona.id,
    avatarDataUrl: sanitizeAiFriendAvatarDataUrl(value.avatarDataUrl),
    llmConfig: sanitizeAiFriendLlmConfig(value.llmConfig),
    ttsVoice: sanitizeTtsVoice(readString(value.ttsVoice, 80)),
    ttsConfig: sanitizeAiFriendTtsConfig(value.ttsConfig),
    roleCard: sanitizeAiCharacterRoleCard(value.roleCard),
    riskTolerance: clampUnit(value.riskTolerance, basePersona.riskTolerance),
    bluffing: clampUnit(value.bluffing, basePersona.bluffing),
    preferences: normalizePreferences(isRecord(value.preferences) ? value.preferences : basePersona.preferences),
    createdAt: readString(value.createdAt, 40) || now,
    updatedAt: readString(value.updatedAt, 40) || now,
  };
}

export function buildAiPersonaFromFriend(friend: AiFriendConfig): AiPersona {
  const base = getAiPersonaById(friend.basePersonaId) ?? getAiRoster()[0];
  const llmConfig = sanitizeAiFriendLlmConfig(friend.llmConfig);
  return {
    ...base,
    modelLabel: formatAiFriendLlmModelLabel(llmConfig) ?? base.modelLabel,
    riskTolerance: clampUnit(friend.riskTolerance, base.riskTolerance),
    bluffing: clampUnit(friend.bluffing, base.bluffing),
    preferences: normalizePreferences(friend.preferences),
  };
}

export function resolveAiFriendsForGame(selectedFriends: AiFriendConfig[] | undefined, aiSeatCount: number): ResolvedAiFriend[] {
  if (aiSeatCount <= 0) return [];
  const defaults = getDefaultAiFriends();
  const sanitizedSelected = sanitizeCustomAndDefaultFriends(selectedFriends ?? []);
  const candidates = sanitizedSelected.length > 0 ? sanitizedSelected : defaults;
  const resolved: ResolvedAiFriend[] = [];

  for (let index = 0; index < aiSeatCount; index += 1) {
    const friend = candidates[index] ?? defaults[(index - candidates.length) % defaults.length] ?? defaults[0];
    const config = sanitizeAiFriendConfig(friend) ?? defaults[index % defaults.length]!;
    const persona = buildAiPersonaFromFriend(config);
    resolved.push({
      config,
      persona,
      displayName: config.nickname,
      setup: {
        friendId: config.id,
        nickname: config.nickname,
        basePersonaId: config.basePersonaId,
        personaName: persona.name,
        modelLabel: persona.modelLabel,
        avatarDataUrl: config.avatarDataUrl,
        ttsVoice: config.ttsVoice,
        ttsConfig: config.ttsConfig,
        roleCard: config.roleCard,
        isDefault: isDefaultAiFriend(config),
      },
    });
  }

  return withUniqueDisplayNames(resolved);
}

function sanitizeCustomAndDefaultFriends(values: unknown[]): AiFriendConfig[] {
  return values.map((value) => sanitizeAiFriendConfig(value)).filter((friend): friend is AiFriendConfig => Boolean(friend));
}

function withUniqueDisplayNames(friends: ResolvedAiFriend[]): ResolvedAiFriend[] {
  const counts = new Map<string, number>();
  const used = new Set<string>();
  return friends.map((friend) => {
    const baseName = friend.displayName;
    let count = (counts.get(baseName) ?? 0) + 1;
    counts.set(baseName, count);
    let displayName = count === 1 ? baseName : `${baseName}${count}`;
    while (used.has(displayName)) {
      count += 1;
      counts.set(baseName, count);
      displayName = `${baseName}${count}`;
    }
    used.add(displayName);
    if (displayName === friend.displayName) return friend;
    return {
      ...friend,
      displayName,
    };
  });
}

function normalizePreferences(value: unknown): AiPersonaPreferences {
  const record = isRecord(value) ? value : {};
  return AI_FRIEND_PREFERENCE_KEYS.reduce((preferences, key) => {
    preferences[key] = clampUnit(record[key], 0.5);
    return preferences;
  }, {} as AiPersonaPreferences);
}

function sanitizeNickname(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ").slice(0, 16);
  return clean && clean !== "你" ? clean : "AI好友";
}

function uniqueCopyName(value: string): string {
  const clean = sanitizeNickname(value).replace(/副本\d*$/, "");
  return `${clean}副本`.slice(0, 16);
}

function sanitizeTtsVoice(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, "_").slice(0, 80);
  return clean || undefined;
}

export function sanitizeAiCharacterRoleCard(value: unknown): AiCharacterRoleCard | undefined {
  if (!isRecord(value)) return undefined;
  const id = readString(value.id, 80);
  const displayName = readString(value.displayName, 40);
  const theme = readString(value.theme, 60);
  const speechStyleZh = readString(value.speechStyleZh, 260);
  const reasoningBias = readString(value.reasoningBias, 220);
  const voteBias = readString(value.voteBias, 220);
  const nightActionBias = readString(value.nightActionBias, 220);
  const asVillager = readString(value.asVillager, 220);
  const asWerewolf = readString(value.asWerewolf, 220);
  const pressureResponse = readString(value.pressureResponse, 220);
  const catchphrasePolicy = readString(value.catchphrasePolicy, 220);
  if (
    !id ||
    !displayName ||
    !theme ||
    !speechStyleZh ||
    !reasoningBias ||
    !voteBias ||
    !nightActionBias ||
    !asVillager ||
    !asWerewolf ||
    !pressureResponse ||
    !catchphrasePolicy
  ) {
    return undefined;
  }

  return {
    id,
    displayName,
    theme,
    styleTags: readStringArray(value.styleTags, 8, 40),
    speechStyleZh,
    reasoningBias,
    voteBias,
    nightActionBias,
    asVillager,
    asWerewolf,
    pressureResponse,
    relationshipHints: readStringArray(value.relationshipHints, 12, 120),
    catchphrasePolicy,
    forbidden: readStringArray(value.forbidden, 12, 120),
    voiceProfileId: sanitizeOptionalIdentifier(readString(value.voiceProfileId, 80)),
    voiceLocale: sanitizeOptionalIdentifier(readString(value.voiceLocale, 20)),
    voiceRewritePolicy: readString(value.voiceRewritePolicy, 180),
    classTrialVoiceProfile: sanitizeClassTrialRoleVoiceProfile(value.classTrialVoiceProfile),
  };
}

function sanitizeClassTrialRoleVoiceProfile(value: unknown): AiCharacterRoleCard["classTrialVoiceProfile"] | undefined {
  if (!isRecord(value)) return undefined;

  return {
    personalityCore: readStringArray(value.personalityCore, 8, 180),
    valueBiases: readStringArray(value.valueBiases, 8, 180),
    reactionTendencies: readStringArray(value.reactionTendencies, 10, 220),
    lightCatchphrases: readStringArray(value.lightCatchphrases, 6, 80),
    overuseBans: readStringArray(value.overuseBans, 10, 160),
    scenarioReactions: sanitizeClassTrialScenarioReactions(value.scenarioReactions),
    alignmentReactions: sanitizeClassTrialAlignmentReactions(value.alignmentReactions),
    acceptableForms: readStringArray(value.acceptableForms, 8, 160),
    unacceptableForms: readStringArray(value.unacceptableForms, 8, 160),
    dramaticBoundaries: sanitizeClassTrialDramaticBoundaries(value.dramaticBoundaries),
  };
}

function sanitizeClassTrialScenarioReactions(
  value: unknown,
): NonNullable<AiCharacterRoleCard["classTrialVoiceProfile"]>["scenarioReactions"] {
  const reactions: NonNullable<AiCharacterRoleCard["classTrialVoiceProfile"]>["scenarioReactions"] = {};
  if (!isRecord(value)) return reactions;

  for (const [key, rawReaction] of Object.entries(value)) {
    if (!isRecord(rawReaction)) continue;
    const innerDrive = readString(rawReaction.innerDrive, 220);
    const speechMove = readString(rawReaction.speechMove, 220);
    const mustAvoid = readString(rawReaction.mustAvoid, 180);
    if (!innerDrive || !speechMove || !mustAvoid) continue;
    reactions[key] = { innerDrive, speechMove, mustAvoid };
  }

  return reactions;
}

function sanitizeClassTrialAlignmentReactions(
  value: unknown,
): NonNullable<AiCharacterRoleCard["classTrialVoiceProfile"]>["alignmentReactions"] {
  const reactions: NonNullable<AiCharacterRoleCard["classTrialVoiceProfile"]>["alignmentReactions"] = {};
  if (!isRecord(value)) return reactions;

  for (const [key, rawReaction] of Object.entries(value)) {
    if (!isRecord(rawReaction)) continue;
    const speechDrive = readString(rawReaction.speechDrive, 220);
    const failureMode = readString(rawReaction.failureMode, 180);
    if (!speechDrive || !failureMode) continue;
    reactions[key] = { speechDrive, failureMode };
  }

  return reactions;
}

function sanitizeClassTrialDramaticBoundaries(
  value: unknown,
): NonNullable<AiCharacterRoleCard["classTrialVoiceProfile"]>["dramaticBoundaries"] {
  const raw = isRecord(value) ? value : {};

  return {
    allowSharpConflict: readBoolean(raw.allowSharpConflict) === true,
    allowIrrationalMisread: readBoolean(raw.allowIrrationalMisread) === true,
    allowDeceptionWhenAligned: readBoolean(raw.allowDeceptionWhenAligned) === true,
    mustStayInTurnOrder: true,
    mustRemainWerewolfPlayable: true,
  };
}

function sanitizeAiFriendAvatarDataUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  if (clean.length > AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH) return undefined;
  return AI_FRIEND_AVATAR_DATA_URL_PATTERN.test(clean) ? clean : undefined;
}

function clampUnit(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function sanitizeOptionalIdentifier(value: string | undefined): string | undefined {
  const clean = value?.replace(/\s+/g, "-");
  return clean || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

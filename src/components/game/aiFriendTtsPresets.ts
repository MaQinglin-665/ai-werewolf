import type { AiFriendConfig, AiFriendTtsConfig } from "@/game/types";
import type { AiFriendLlmSecretMap } from "./aiFriendStorage";
import type { AiFriendOption } from "./clientTypes";

export const AI_FRIEND_TTS_PRESETS_STORAGE_KEY = "ai-werewolf-ai-friend-tts-presets-v1";

const CONFIGURED_AI_FRIEND_ID_PREFIX = "friend-configured-llm:";

export type AiFriendTtsPreset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  voice: string;
  apiKey?: string;
  format?: string;
  authHeader?: string;
  createdAt: string;
  updatedAt: string;
};

export type AiFriendTtsPresetState = {
  presets: AiFriendTtsPreset[];
  lastUsedPresetId?: string;
};

export type AiFriendTtsPresetApplyMode = "fill-blanks" | "overwrite";

export type AiFriendTtsPresetApplyResult = {
  friendId: string;
  nextFriendId?: string;
  friendName: string;
  status: "filled" | "overwritten" | "skipped";
  reason?: string;
};

export type ApplyTtsPresetInput = {
  aiFriends: AiFriendOption[];
  customAiFriends: AiFriendConfig[];
  selectedAiFriendIds: string[];
  aiLlmSecrets: AiFriendLlmSecretMap;
  preset: AiFriendTtsPreset;
  mode: AiFriendTtsPresetApplyMode;
  now: string;
};

export type ApplyTtsPresetOutput = {
  customAiFriends: AiFriendConfig[];
  selectedAiFriendIds: string[];
  aiLlmSecrets: AiFriendLlmSecretMap;
  results: AiFriendTtsPresetApplyResult[];
};

export function readStoredAiFriendTtsPresetState(): AiFriendTtsPresetState {
  if (typeof window === "undefined") return { presets: [] };
  const raw = window.localStorage.getItem(AI_FRIEND_TTS_PRESETS_STORAGE_KEY);
  if (!raw) return { presets: [] };
  try {
    return sanitizeAiFriendTtsPresetState(JSON.parse(raw));
  } catch {
    return { presets: [] };
  }
}

export function writeStoredAiFriendTtsPresetState(state: AiFriendTtsPresetState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_FRIEND_TTS_PRESETS_STORAGE_KEY, JSON.stringify(sanitizeAiFriendTtsPresetState(state)));
}

export function sanitizeAiFriendTtsPresetState(value: unknown): AiFriendTtsPresetState {
  if (!isRecord(value)) return { presets: [] };
  const presets = Array.isArray(value.presets)
    ? value.presets
        .map(sanitizeAiFriendTtsPreset)
        .filter((preset): preset is AiFriendTtsPreset => Boolean(preset))
        .slice(0, 20)
    : [];
  const lastUsedPresetId = readString(value.lastUsedPresetId, 80);
  return {
    presets,
    ...(lastUsedPresetId && presets.some((preset) => preset.id === lastUsedPresetId) ? { lastUsedPresetId } : {}),
  };
}

export function sanitizeAiFriendTtsPreset(value: unknown): AiFriendTtsPreset | undefined {
  if (!isRecord(value)) return undefined;
  const id = sanitizeId(readString(value.id, 80));
  const name = sanitizeLabel(readString(value.name, 40));
  const baseUrl = sanitizeBaseUrl(readString(value.baseUrl, 260));
  const model = readString(value.model, 120);
  const voice = sanitizeVoice(readString(value.voice, 80));
  const apiKey = readString(value.apiKey, 4096);
  const format = sanitizeFormat(readString(value.format, 16));
  const authHeader = sanitizeAuthHeader(readString(value.authHeader, 80));
  const createdAt = readString(value.createdAt, 40);
  const updatedAt = readString(value.updatedAt, 40);
  if (!id || !name || !baseUrl || !model || !voice || !createdAt || !updatedAt) return undefined;
  return {
    id,
    name,
    baseUrl,
    model,
    voice,
    ...(apiKey ? { apiKey } : {}),
    ...(format ? { format } : {}),
    ...(authHeader ? { authHeader } : {}),
    createdAt,
    updatedAt,
  };
}

export function buildTtsConfigFromPreset(preset: AiFriendTtsPreset): AiFriendTtsConfig {
  return {
    provider: "mimo-compatible",
    label: preset.name,
    baseUrl: preset.baseUrl,
    model: preset.model,
    voice: preset.voice,
    ...(preset.format ? { format: preset.format } : {}),
    ...(preset.authHeader ? { authHeader: preset.authHeader } : {}),
  };
}

export function applyTtsPresetToSelectedAiFriends(input: ApplyTtsPresetInput): ApplyTtsPresetOutput {
  const friendById = new Map(input.aiFriends.map((friend) => [friend.id, friend]));
  const nextCustomById = new Map(input.customAiFriends.map((friend) => [friend.id, friend]));
  const nextSecrets: AiFriendLlmSecretMap = { ...input.aiLlmSecrets };
  const replacementIds = new Map<string, string>();
  const results: AiFriendTtsPresetApplyResult[] = [];

  for (const friendId of input.selectedAiFriendIds) {
    const friend = friendById.get(friendId);
    if (!friend) continue;

    if (input.mode === "fill-blanks" && friend.ttsConfig) {
      results.push({
        friendId,
        friendName: friend.nickname,
        status: "skipped",
        reason: "已有自定义 TTS 配置",
      });
      continue;
    }

    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
      llmConfig: friend.llmConfig,
      ttsVoice: input.preset.voice,
      ttsConfig: buildTtsConfigFromPreset(input.preset),
      roleCard: friend.roleCard,
      ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
      riskTolerance: friend.riskTolerance,
      bluffing: friend.bluffing,
      preferences: friend.preferences,
      createdAt: friend.isDefault ? input.now : friend.createdAt,
      updatedAt: input.now,
    };

    nextCustomById.delete(friend.id);
    nextCustomById.set(targetId, nextFriend);
    replacementIds.set(friend.id, targetId);

    const currentSecret = nextSecrets[targetId] ?? nextSecrets[friend.id] ?? {};
    nextSecrets[targetId] = {
      ...currentSecret,
      ...(input.preset.apiKey ? { ttsApiKey: input.preset.apiKey } : {}),
    };
    if (targetId !== friend.id) delete nextSecrets[friend.id];

    results.push({
      friendId,
      nextFriendId: targetId,
      friendName: friend.nickname,
      status: friend.ttsConfig ? "overwritten" : "filled",
    });
  }

  return {
    customAiFriends: [...nextCustomById.values()],
    selectedAiFriendIds: uniqueValues(input.selectedAiFriendIds.map((id) => replacementIds.get(id) ?? id)),
    aiLlmSecrets: nextSecrets,
    results,
  };
}

function configuredFriendId(source: Pick<AiFriendOption, "basePersonaId">): string {
  return `${CONFIGURED_AI_FRIEND_ID_PREFIX}${source.basePersonaId}`.slice(0, 80);
}

function sanitizeBaseUrl(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, "").replace(/\/+$/, "");
  if (!clean) return undefined;
  try {
    const url = new URL(clean);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function sanitizeLabel(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, " ").slice(0, 40);
  return clean || undefined;
}

function sanitizeId(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 80);
  return clean || undefined;
}

function sanitizeVoice(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, "_").slice(0, 80);
  return clean || undefined;
}

function sanitizeFormat(value: string | undefined): string | undefined {
  const clean = value?.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return clean || undefined;
}

function sanitizeAuthHeader(value: string | undefined): string | undefined {
  const clean = value?.trim().slice(0, 80);
  return clean && /^[A-Za-z0-9-]+$/.test(clean) ? clean : undefined;
}

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

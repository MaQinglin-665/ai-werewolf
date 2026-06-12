import type { AiFriendConfig, AiFriendLlmConfig } from "@/game/types";
import type { AiFriendLlmSecretMap } from "./aiFriendStorage";
import type { AiFriendOption } from "./clientTypes";

export const AI_FRIEND_LLM_PRESETS_STORAGE_KEY = "ai-werewolf-ai-friend-llm-presets-v1";

const CONFIGURED_AI_FRIEND_ID_PREFIX = "friend-configured-llm:";

export type AiFriendLlmPreset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  mergeSystemIntoUser?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiFriendLlmPresetState = {
  presets: AiFriendLlmPreset[];
  lastUsedPresetId?: string;
};

export type AiFriendLlmPresetApplyMode = "fill-blanks" | "overwrite";

export type AiFriendLlmPresetApplyResult = {
  friendId: string;
  nextFriendId?: string;
  friendName: string;
  status: "filled" | "overwritten" | "skipped";
  reason?: string;
};

export type ApplyLlmPresetInput = {
  aiFriends: AiFriendOption[];
  customAiFriends: AiFriendConfig[];
  selectedAiFriendIds: string[];
  aiLlmSecrets: AiFriendLlmSecretMap;
  preset: AiFriendLlmPreset;
  mode: AiFriendLlmPresetApplyMode;
  now: string;
};

export type ApplyLlmPresetOutput = {
  customAiFriends: AiFriendConfig[];
  selectedAiFriendIds: string[];
  aiLlmSecrets: AiFriendLlmSecretMap;
  results: AiFriendLlmPresetApplyResult[];
};

export function readStoredAiFriendLlmPresetState(): AiFriendLlmPresetState {
  if (typeof window === "undefined") return { presets: [] };
  const raw = window.localStorage.getItem(AI_FRIEND_LLM_PRESETS_STORAGE_KEY);
  if (!raw) return { presets: [] };
  try {
    return sanitizeAiFriendLlmPresetState(JSON.parse(raw));
  } catch {
    return { presets: [] };
  }
}

export function writeStoredAiFriendLlmPresetState(state: AiFriendLlmPresetState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_FRIEND_LLM_PRESETS_STORAGE_KEY, JSON.stringify(sanitizeAiFriendLlmPresetState(state)));
}

export function sanitizeAiFriendLlmPresetState(value: unknown): AiFriendLlmPresetState {
  if (!isRecord(value)) return { presets: [] };
  const presets = Array.isArray(value.presets)
    ? value.presets
        .map(sanitizeAiFriendLlmPreset)
        .filter((preset): preset is AiFriendLlmPreset => Boolean(preset))
        .slice(0, 20)
    : [];
  const lastUsedPresetId = readString(value.lastUsedPresetId, 80);
  return {
    presets,
    ...(lastUsedPresetId && presets.some((preset) => preset.id === lastUsedPresetId) ? { lastUsedPresetId } : {}),
  };
}

export function sanitizeAiFriendLlmPreset(value: unknown): AiFriendLlmPreset | undefined {
  if (!isRecord(value)) return undefined;
  const id = sanitizeId(readString(value.id, 80));
  const name = sanitizeLabel(readString(value.name, 40));
  const baseUrl = sanitizeBaseUrl(readString(value.baseUrl, 260));
  const model = readString(value.model, 120);
  const apiKey = readString(value.apiKey, 4096);
  const createdAt = readString(value.createdAt, 40);
  const updatedAt = readString(value.updatedAt, 40);
  if (!id || !name || !baseUrl || !model || !createdAt || !updatedAt) return undefined;
  return {
    id,
    name,
    baseUrl,
    model,
    ...(apiKey ? { apiKey } : {}),
    ...(typeof value.mergeSystemIntoUser === "boolean" ? { mergeSystemIntoUser: value.mergeSystemIntoUser } : {}),
    createdAt,
    updatedAt,
  };
}

export function buildLlmConfigFromPreset(preset: AiFriendLlmPreset): AiFriendLlmConfig {
  return {
    provider: "openai-compatible",
    label: preset.name,
    baseUrl: preset.baseUrl,
    model: preset.model,
    ...(preset.mergeSystemIntoUser ? { mergeSystemIntoUser: true } : {}),
  };
}

export function applyLlmPresetToSelectedAiFriends(input: ApplyLlmPresetInput): ApplyLlmPresetOutput {
  const friendById = new Map(input.aiFriends.map((friend) => [friend.id, friend]));
  const nextCustomById = new Map(input.customAiFriends.map((friend) => [friend.id, friend]));
  const nextSecrets: AiFriendLlmSecretMap = { ...input.aiLlmSecrets };
  const replacementIds = new Map<string, string>();
  const results: AiFriendLlmPresetApplyResult[] = [];

  for (const friendId of input.selectedAiFriendIds) {
    const friend = friendById.get(friendId);
    if (!friend) continue;

    if (input.mode === "fill-blanks" && friend.llmConfig) {
      results.push({
        friendId,
        friendName: friend.nickname,
        status: "skipped",
        reason: "已有自定义 LLM 配置",
      });
      continue;
    }

    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
      llmConfig: buildLlmConfigFromPreset(input.preset),
      ttsVoice: friend.ttsVoice,
      ttsConfig: friend.ttsConfig,
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
      ...(input.preset.apiKey ? { apiKey: input.preset.apiKey } : {}),
    };
    if (targetId !== friend.id) delete nextSecrets[friend.id];

    results.push({
      friendId,
      nextFriendId: targetId,
      friendName: friend.nickname,
      status: friend.llmConfig ? "overwritten" : "filled",
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

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

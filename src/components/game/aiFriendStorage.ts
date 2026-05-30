import {
  AI_FRIEND_SELECTION_STORAGE_KEY,
  AI_FRIENDS_STORAGE_KEY,
  getDefaultAiFriends,
  parseAiFriendExport,
  serializeAiFriendExport,
} from "@/game/aiFriends";
import { formatAiFriendLlmModelLabel } from "@/game/llmConfig";
import { getAiPersonaById } from "@/game/personas";
import type { AiFriendConfig, AiFriendRuntimeLlmConfig, AiFriendRuntimeTtsConfig, AiRuntimeMode } from "@/game/types";
import type { AiFriendOption } from "./clientTypes";

const EMPTY_CUSTOM_AI_FRIENDS: AiFriendConfig[] = [];
export const AI_FRIEND_LLM_SECRETS_STORAGE_KEY = "ai-werewolf-ai-friend-llm-secrets-v1";
export const AI_RUNTIME_MODE_STORAGE_KEY = "ai-werewolf-ai-runtime-mode-v1";
export const DEFAULT_AI_RUNTIME_MODE: AiRuntimeMode = "mock";

export type AiFriendLlmSecretMap = Record<string, { apiKey?: string; ttsApiKey?: string }>;

export function getDefaultSelectedAiFriendIds(): string[] {
  return getDefaultAiFriends().map((friend) => friend.id);
}

export function buildAiFriendOptions(customFriends: AiFriendConfig[]): AiFriendOption[] {
  return [
    ...getDefaultAiFriends().map((friend) => toAiFriendOption(friend, true)),
    ...customFriends.map((friend) => toAiFriendOption(friend, false)),
  ];
}

export function readStoredCustomAiFriends(): AiFriendConfig[] {
  if (typeof window === "undefined") return EMPTY_CUSTOM_AI_FRIENDS;
  const raw = window.localStorage.getItem(AI_FRIENDS_STORAGE_KEY);
  if (!raw) return EMPTY_CUSTOM_AI_FRIENDS;
  try {
    return parseAiFriendExport(raw);
  } catch {
    return EMPTY_CUSTOM_AI_FRIENDS;
  }
}

export function writeStoredCustomAiFriends(friends: AiFriendConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_FRIENDS_STORAGE_KEY, serializeAiFriendExport(friends));
}

export function readStoredAiFriendLlmSecrets(): AiFriendLlmSecretMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(AI_FRIEND_LLM_SECRETS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([friendId, value]) => {
          const apiKey = isRecord(value) && typeof value.apiKey === "string" ? value.apiKey.trim().slice(0, 4096) : "";
          const ttsApiKey = isRecord(value) && typeof value.ttsApiKey === "string" ? value.ttsApiKey.trim().slice(0, 4096) : "";
          const secret = {
            ...(apiKey ? { apiKey } : {}),
            ...(ttsApiKey ? { ttsApiKey } : {}),
          };
          return apiKey || ttsApiKey ? [friendId.slice(0, 80), secret] : undefined;
        })
        .filter((entry): entry is [string, { apiKey?: string; ttsApiKey?: string }] => Boolean(entry)),
    );
  } catch {
    return {};
  }
}

export function writeStoredAiFriendLlmSecrets(secrets: AiFriendLlmSecretMap): void {
  if (typeof window === "undefined") return;
  const clean = Object.fromEntries(
    Object.entries(secrets)
      .map(([friendId, value]) => {
        const apiKey = value.apiKey?.trim().slice(0, 4096);
        const ttsApiKey = value.ttsApiKey?.trim().slice(0, 4096);
        const secret = {
          ...(apiKey ? { apiKey } : {}),
          ...(ttsApiKey ? { ttsApiKey } : {}),
        };
        return apiKey || ttsApiKey ? [friendId, secret] : undefined;
      })
      .filter((entry): entry is [string, { apiKey?: string; ttsApiKey?: string }] => Boolean(entry)),
  );
  window.localStorage.setItem(AI_FRIEND_LLM_SECRETS_STORAGE_KEY, JSON.stringify(clean));
}

export function readStoredAiRuntimeMode(): AiRuntimeMode {
  if (typeof window === "undefined") return DEFAULT_AI_RUNTIME_MODE;
  return window.localStorage.getItem(AI_RUNTIME_MODE_STORAGE_KEY) === "llm" ? "llm" : DEFAULT_AI_RUNTIME_MODE;
}

export function writeStoredAiRuntimeMode(mode: AiRuntimeMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_RUNTIME_MODE_STORAGE_KEY, mode);
}

export function resolveEffectiveAiRuntimeMode(
  selectedMode: AiRuntimeMode,
  classTrialThemeMode: "default" | "class-trial",
): AiRuntimeMode {
  return classTrialThemeMode === "class-trial" ? "llm" : selectedMode;
}

export function buildRuntimeAiLlmConfigs(
  friends: AiFriendConfig[],
  secrets: AiFriendLlmSecretMap,
): Record<string, AiFriendRuntimeLlmConfig> | undefined {
  const entries = friends
    .filter((friend) => friend.llmConfig)
    .map((friend) => {
      const apiKey = secrets[friend.id]?.apiKey?.trim();
      return [
        friend.id,
        {
          ...friend.llmConfig!,
          ...(apiKey ? { apiKey } : {}),
        },
      ] as const;
    });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function buildRuntimeAiTtsConfigs(
  friends: AiFriendConfig[],
  secrets: AiFriendLlmSecretMap,
): Record<string, AiFriendRuntimeTtsConfig> | undefined {
  const entries = friends
    .filter((friend) => friend.ttsConfig)
    .map((friend) => {
      const apiKey = secrets[friend.id]?.ttsApiKey?.trim();
      return [
        friend.id,
        {
          ...friend.ttsConfig!,
          ...(apiKey ? { apiKey } : {}),
        },
      ] as const;
    });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function readStoredSelectedAiFriendIds(): string[] {
  if (typeof window === "undefined") return getDefaultSelectedAiFriendIds();
  const raw = window.localStorage.getItem(AI_FRIEND_SELECTION_STORAGE_KEY);
  if (!raw) return getDefaultSelectedAiFriendIds();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : getDefaultSelectedAiFriendIds();
  } catch {
    return getDefaultSelectedAiFriendIds();
  }
}

export function writeStoredSelectedAiFriendIds(friendIds: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_FRIEND_SELECTION_STORAGE_KEY, JSON.stringify(friendIds));
}

export function resolveSelectedAiFriends(options: AiFriendOption[], selectedIds: string[]): AiFriendConfig[] {
  const byId = new Map(options.map((friend) => [friend.id, friend]));
  return selectedIds.map((id) => byId.get(id)).filter((friend): friend is AiFriendOption => Boolean(friend));
}

function toAiFriendOption(friend: AiFriendConfig, isDefault: boolean): AiFriendOption {
  const persona = getAiPersonaById(friend.basePersonaId);
  return {
    ...friend,
    isDefault,
    basePersonaName: persona?.name ?? "未知模型",
    basePersonaModelLabel: formatAiFriendLlmModelLabel(friend.llmConfig) ?? persona?.modelLabel,
    basePersonaLabel: persona?.label ?? "未知人格",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

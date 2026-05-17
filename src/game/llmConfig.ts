import type {
  AiFriendLlmConfig,
  AiFriendRuntimeLlmConfig,
  AiFriendRuntimeTtsConfig,
  AiFriendTtsConfig,
  AiRuntimeMode,
} from "./types";

export type RuntimeAiProviderMode = "mock" | "models";

export function sanitizeRuntimeAiProviderMode(value: unknown): RuntimeAiProviderMode | undefined {
  const clean = typeof value === "string" ? value.trim().toLowerCase() : "";
  return clean === "mock" || clean === "models" ? clean : undefined;
}

export function sanitizeAiFriendLlmConfig(value: unknown): AiFriendLlmConfig | undefined {
  if (!isRecord(value) || value.provider !== "openai-compatible") return undefined;
  const model = readString(value.model, 120);
  const baseUrl = sanitizeBaseUrl(readString(value.baseUrl, 260));
  if (!model || !baseUrl) return undefined;

  const label = readString(value.label, 40);
  return {
    provider: "openai-compatible",
    ...(label ? { label: sanitizeLlmLabel(label) } : {}),
    baseUrl,
    model,
    ...(typeof value.mergeSystemIntoUser === "boolean" ? { mergeSystemIntoUser: value.mergeSystemIntoUser } : {}),
  };
}

export function sanitizeAiFriendRuntimeLlmConfig(value: unknown): AiFriendRuntimeLlmConfig | undefined {
  const safeConfig = sanitizeAiFriendLlmConfig(value);
  if (!safeConfig || !isRecord(value)) return safeConfig;
  const apiKey = readString(value.apiKey, 4096);
  return {
    ...safeConfig,
    ...(apiKey ? { apiKey } : {}),
  };
}

export function sanitizeRuntimeAiLlmConfigMap(value: unknown): Record<string, AiFriendRuntimeLlmConfig> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .slice(0, 20)
    .map(([friendId, config]) => {
      const cleanFriendId = readString(friendId, 80);
      const cleanConfig = sanitizeAiFriendRuntimeLlmConfig(config);
      return cleanFriendId && cleanConfig ? ([cleanFriendId, cleanConfig] as const) : undefined;
    })
    .filter((entry): entry is readonly [string, AiFriendRuntimeLlmConfig] => Boolean(entry));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function sanitizeAiRuntimeMode(value: unknown): AiRuntimeMode | undefined {
  return value === "mock" || value === "llm" ? value : undefined;
}

export function sanitizeAiFriendTtsConfig(value: unknown): AiFriendTtsConfig | undefined {
  if (!isRecord(value) || value.provider !== "mimo-compatible") return undefined;
  const model = readString(value.model, 120);
  const baseUrl = sanitizeBaseUrl(readString(value.baseUrl, 260));
  const voice = sanitizeTtsVoice(readString(value.voice, 80));
  if (!model || !baseUrl || !voice) return undefined;

  const label = readString(value.label, 40);
  const format = sanitizeTtsFormat(readString(value.format, 16));
  const authHeader = sanitizeAuthHeader(readString(value.authHeader, 80));
  return {
    provider: "mimo-compatible",
    ...(label ? { label: sanitizeLlmLabel(label) } : {}),
    baseUrl,
    model,
    voice,
    ...(format ? { format } : {}),
    ...(authHeader ? { authHeader } : {}),
  };
}

export function sanitizeAiFriendRuntimeTtsConfig(value: unknown): AiFriendRuntimeTtsConfig | undefined {
  const safeConfig = sanitizeAiFriendTtsConfig(value);
  if (!safeConfig || !isRecord(value)) return safeConfig;
  const apiKey = readString(value.apiKey, 4096);
  return {
    ...safeConfig,
    ...(apiKey ? { apiKey } : {}),
  };
}

export function formatAiFriendLlmModelLabel(config: AiFriendLlmConfig | undefined): string | undefined {
  if (!config) return undefined;
  return config.label ? `${config.label} · ${config.model}` : config.model;
}

export function formatAiFriendTtsModelLabel(config: AiFriendTtsConfig | undefined): string | undefined {
  if (!config) return undefined;
  return config.label ? `${config.label} · ${config.model}` : config.model;
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

function sanitizeLlmLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

function sanitizeTtsVoice(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, "_").slice(0, 80);
  return clean || undefined;
}

function sanitizeTtsFormat(value: string | undefined): string | undefined {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

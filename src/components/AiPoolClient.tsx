"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH,
  copyAiFriend,
} from "@/game/aiFriends";
import {
  ORDINARY_PLAYER_TYPE_OPTIONS,
  applyOrdinaryPlayerTypePreset,
  sanitizeOrdinaryPlayerProfile,
} from "@/game/ordinaryPlayerProfiles";
import type {
  AiFriendConfig,
  AiFriendLlmConfig,
  AiFriendTtsConfig,
  AiOrdinaryPlayerProfileSliders,
  AiOrdinaryPlayerTypeId,
  AiRuntimeMode,
} from "@/game/types";
import {
  buildAiFriendOptions,
  getDefaultSelectedAiFriendIds,
  readStoredAiFriendLlmSecrets,
  readStoredAiRuntimeMode,
  readStoredCustomAiFriends,
  readStoredSelectedAiFriendIds,
  writeStoredAiFriendLlmSecrets,
  writeStoredAiRuntimeMode,
  writeStoredCustomAiFriends,
  writeStoredSelectedAiFriendIds,
  type AiFriendLlmSecretMap,
} from "./game/aiFriendStorage";
import type { AiFriendOption } from "./game/clientTypes";
import {
  applyLlmPresetToSelectedAiFriends,
  readStoredAiFriendLlmPresetState,
  writeStoredAiFriendLlmPresetState,
  type AiFriendLlmPreset,
  type AiFriendLlmPresetApplyMode,
  type AiFriendLlmPresetApplyResult,
  type AiFriendLlmPresetState,
} from "./game/aiFriendLlmPresets";
import {
  applyTtsPresetToSelectedAiFriends,
  readStoredAiFriendTtsPresetState,
  writeStoredAiFriendTtsPresetState,
  type AiFriendTtsPreset,
  type AiFriendTtsPresetApplyMode,
  type AiFriendTtsPresetApplyResult,
  type AiFriendTtsPresetState,
} from "./game/aiFriendTtsPresets";
import { MODEL_CARD_IMAGES, ROLE_CARD_IMAGES } from "./game/viewHelpers";

type AiRuntimeConfig = {
  llm: {
    providerMode: string;
    routingEnabled: boolean;
    routes: Array<{
      personaId: string;
      personaName: string;
      routeId?: string;
      model: string;
      defaultModel: string;
      connected: boolean;
      routingEnabled: boolean;
      providerMode: string;
    }>;
  };
  tts: {
    provider: string;
    available: boolean;
    model: string;
    format: string;
    voices: Array<{
      value: string;
      label: string;
    }>;
    profiles: Array<{
      id: string;
      personaName: string;
      voiceEnvKey: string;
      defaultVoice: string;
      resolvedVoice: string;
      style: string;
    }>;
  };
};

const FALLBACK_TTS_VOICES: AiRuntimeConfig["tts"]["voices"] = [
  { value: "mimo_default", label: "Mimo 默认" },
  { value: "default_zh", label: "中文自然" },
  { value: "default_en", label: "英文默认" },
];
const DEFAULT_CUSTOM_LLM_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CUSTOM_TTS_BASE_URL = "https://api.xiaomimimo.com";
const DEFAULT_CUSTOM_TTS_MODEL = "mimo-v2.5-tts";
const DEFAULT_CUSTOM_TTS_FORMAT = "mp3";
const CONFIGURED_AI_FRIEND_ID_PREFIX = "friend-configured-llm:";
const AI_FRIEND_AVATAR_FILE_MAX_BYTES = 4 * 1024 * 1024;
const AI_FRIEND_AVATAR_CANVAS_SIZE = 192;
const AI_FRIEND_AVATAR_OUTPUT_QUALITY = 0.86;
const AI_FRIEND_AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

type AiPoolFilterId = "all" | "reasoning" | "pressure" | "control" | "fun";
type AiEditSection = "overview" | "role" | "llm" | "tts" | "bulk";
type AiMobilePoolView = "overview" | "lineup" | "config";

const AI_POOL_FILTERS: Array<{ id: AiPoolFilterId; label: string }> = [
  { id: "all", label: "全部" },
  { id: "reasoning", label: "推理" },
  { id: "pressure", label: "进攻" },
  { id: "control", label: "控场" },
  { id: "fun", label: "娱乐" },
];

const AI_EDIT_SECTIONS: Array<{ id: AiEditSection; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "role", label: "角色信息" },
  { id: "llm", label: "LLM配置" },
  { id: "tts", label: "TTS配置" },
  { id: "bulk", label: "批量配置" },
];

const AI_MOBILE_POOL_VIEWS: Array<{ id: AiMobilePoolView; label: string }> = [
  { id: "overview", label: "角色总览" },
  { id: "lineup", label: "当前阵容" },
  { id: "config", label: "配置" },
];

function shuffleIds(ids: string[]): string[] {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
}

function getAiFriendAvatarImage(friend: Pick<AiFriendOption, "avatarDataUrl" | "basePersonaName" | "nickname">): string {
  return friend.avatarDataUrl ?? MODEL_CARD_IMAGES[friend.basePersonaName] ?? MODEL_CARD_IMAGES[friend.nickname] ?? ROLE_CARD_IMAGES.HIDDEN;
}

async function buildAiFriendAvatarDataUrl(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("头像只支持 PNG、JPG 或 WebP。");
  }
  if (file.size > AI_FRIEND_AVATAR_FILE_MAX_BYTES) {
    throw new Error("头像文件不能超过 4MB。");
  }

  const image = await loadImage(await readFileAsDataUrl(file));
  const canvas = document.createElement("canvas");
  canvas.width = AI_FRIEND_AVATAR_CANVAS_SIZE;
  canvas.height = AI_FRIEND_AVATAR_CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("浏览器无法处理这个头像。");
  }

  context.fillStyle = "#120d0b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);

  const dataUrl = canvas.toDataURL("image/webp", AI_FRIEND_AVATAR_OUTPUT_QUALITY);
  if (dataUrl.length > AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH) {
    throw new Error("头像压缩后仍然过大，请换一张更小的图。");
  }
  return dataUrl;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("头像读取失败。"));
      }
    };
    reader.onerror = () => reject(new Error("头像读取失败。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("头像图片无法解析。"));
    image.src = src;
  });
}

function getLlmRoute(config: AiRuntimeConfig | null, friend: Pick<AiFriendOption, "basePersonaId">) {
  return config?.llm.routes.find((route) => route.personaId === friend.basePersonaId);
}

function getTtsProfile(config: AiRuntimeConfig | null, friend: Pick<AiFriendOption, "basePersonaName">) {
  return config?.tts.profiles.find((profile) => profile.personaName === friend.basePersonaName);
}

function llmAvailabilityLabel(route: ReturnType<typeof getLlmRoute> | undefined): string {
  if (route?.connected) return "可用";
  if (route?.providerMode === "mock" || !route?.routingEnabled) return "试玩";
  return "暂不可用";
}

function ttsAvailabilityLabel(config: AiRuntimeConfig | null): string {
  return config?.tts.available ? "可用" : "文字模式";
}

function formatLlmStatus(config: AiRuntimeConfig | null, friend: AiFriendOption): string {
  if (friend.llmConfig) {
    return `${formatCustomLlmModel(friend.llmConfig)} · 自定义`;
  }
  const route = getLlmRoute(config, friend);
  if (!route) return friend.basePersonaModelLabel ?? "未检测";
  return `${route.model} · ${llmAvailabilityLabel(route)}`;
}

function formatTtsStatus(config: AiRuntimeConfig | null, friend: AiFriendOption): string {
  if (friend.ttsConfig) {
    return `${formatCustomTtsModel(friend.ttsConfig)} · ${friend.ttsConfig.voice} · 自定义TTS`;
  }
  const profile = getTtsProfile(config, friend);
  const voice = friend.ttsVoice ?? profile?.resolvedVoice ?? "跟随默认";
  if (!config) return `${voice} · 检测中`;
  return `${config.tts.model} · ${voice} · ${ttsAvailabilityLabel(config)}`;
}

function formatBaseOptionLabel(config: AiRuntimeConfig | null, friend: AiFriendOption): string {
  const route = getLlmRoute(config, friend);
  const model = route?.model ?? friend.basePersonaModelLabel;
  const status = llmAvailabilityLabel(route);
  return model ? `${friend.basePersonaName} · ${model} · ${status}` : friend.basePersonaName;
}

function formatPersonaTemplateOptionLabel(friend: AiFriendOption): string {
  return friend.basePersonaLabel;
}

function formatPersonaTemplateStatus(friend: AiFriendOption): string {
  return `打法模板 · ${friend.basePersonaLabel}`;
}

function formatCustomLlmModel(config: AiFriendLlmConfig): string {
  return config.label ? `${config.label} · ${config.model}` : config.model;
}

function formatCustomTtsModel(config: AiFriendTtsConfig): string {
  return config.label ? `${config.label} · ${config.model}` : config.model;
}

function buildCustomLlmConfig(values: {
  label: string;
  baseUrl: string;
  model: string;
  mergeSystemIntoUser?: boolean;
}): AiFriendLlmConfig | undefined {
  const model = values.model.trim().slice(0, 120);
  const baseUrl = values.baseUrl.trim().replace(/\s+/g, "").replace(/\/+$/, "").slice(0, 260);
  if (!model || !baseUrl) return undefined;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return {
    provider: "openai-compatible",
    ...(values.label.trim() ? { label: values.label.trim().replace(/\s+/g, " ").slice(0, 40) } : {}),
    baseUrl,
    model,
    ...(values.mergeSystemIntoUser ? { mergeSystemIntoUser: true } : {}),
  };
}

function buildCustomTtsConfig(values: {
  label: string;
  baseUrl: string;
  model: string;
  voice: string;
  format: string;
  authHeader: string;
}): AiFriendTtsConfig | undefined {
  const model = values.model.trim().slice(0, 120);
  const baseUrl = values.baseUrl.trim().replace(/\s+/g, "").replace(/\/+$/, "").slice(0, 260);
  const voice = values.voice.trim().replace(/\s+/g, "_").slice(0, 80);
  const format = values.format.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  const authHeader = values.authHeader.trim().slice(0, 80);
  if (!model || !baseUrl || !voice) return undefined;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  if (authHeader && !/^[A-Za-z0-9-]+$/.test(authHeader)) return undefined;
  return {
    provider: "mimo-compatible",
    ...(values.label.trim() ? { label: values.label.trim().replace(/\s+/g, " ").slice(0, 40) } : {}),
    baseUrl,
    model,
    voice,
    ...(format ? { format } : {}),
    ...(authHeader ? { authHeader } : {}),
  };
}

function customLlmKeyState(apiKey: string | undefined): string {
  return apiKey?.trim() ? "密钥已填" : "无密钥";
}

function customTtsKeyState(apiKey: string | undefined): string {
  return apiKey?.trim() ? "TTS Key 已填" : "缺少 TTS Key";
}

function buildEditableAiFriendConfig(
  friend: AiFriendOption,
  targetId: string,
  now: string,
  patch: Partial<AiFriendConfig> = {},
): AiFriendConfig {
  const safePatch = { ...patch };
  delete safePatch.id;
  delete safePatch.createdAt;
  delete safePatch.updatedAt;
  return {
    id: targetId,
    nickname: friend.nickname,
    basePersonaId: friend.basePersonaId,
    avatarDataUrl: friend.avatarDataUrl,
    llmConfig: friend.llmConfig,
    ttsVoice: friend.ttsVoice,
    ttsConfig: friend.ttsConfig,
    roleCard: friend.roleCard,
    ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
    riskTolerance: friend.riskTolerance,
    bluffing: friend.bluffing,
    preferences: friend.preferences,
    createdAt: friend.isDefault ? now : friend.createdAt,
    updatedAt: now,
    ...safePatch,
  };
}

function configuredFriendId(source: Pick<AiFriendOption, "basePersonaId">): string {
  return `${CONFIGURED_AI_FRIEND_ID_PREFIX}${source.basePersonaId}`.slice(0, 80);
}

function getAiFriendEditStateKey(friend: AiFriendOption): string {
  return friend.isDefault || isConfiguredFriendId(friend.id) ? `base:${friend.basePersonaId}` : friend.id;
}

function isPhoneAiPoolViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
}

function aiFriendMatchesPoolFilter(friend: AiFriendOption, filter: AiPoolFilterId): boolean {
  if (filter === "all") return true;
  const profile = sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile);
  const typeId = profile.playerTypeId;
  if (filter === "reasoning") return typeId === "one-line-catcher" || typeId === "role-sensitive" || friend.preferences.logic >= 0.68;
  if (filter === "pressure") return typeId === "impatient-pusher" || typeId === "emotional-reactor" || friend.preferences.vote >= 0.68;
  if (filter === "control") return typeId === "cautious-backpacker" || typeId === "quiet-watcher" || friend.preferences.caution >= 0.68;
  return typeId === "pivot-admitter" || typeId === "soft-follower" || friend.preferences.emotion >= 0.58;
}

function isConfiguredFriendId(friendId: string): boolean {
  return friendId.startsWith(CONFIGURED_AI_FRIEND_ID_PREFIX);
}

export function AiPoolClient() {
  const [loaded, setLoaded] = useState(false);
  const [customAiFriends, setCustomAiFriends] = useState<AiFriendConfig[]>([]);
  const [aiLlmSecrets, setAiLlmSecrets] = useState<AiFriendLlmSecretMap>({});
  const [selectedAiFriendIds, setSelectedAiFriendIds] = useState<string[]>(getDefaultSelectedAiFriendIds);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<AiRuntimeMode>("mock");
  const [quickAddNickname, setQuickAddNickname] = useState("");
  const [quickAddBaseId, setQuickAddBaseId] = useState(() => getDefaultSelectedAiFriendIds()[0] ?? "");
  const [quickAddUseCustomLlm, setQuickAddUseCustomLlm] = useState(false);
  const [quickAddLlmLabel, setQuickAddLlmLabel] = useState("");
  const [quickAddLlmBaseUrl, setQuickAddLlmBaseUrl] = useState(DEFAULT_CUSTOM_LLM_BASE_URL);
  const [quickAddLlmModel, setQuickAddLlmModel] = useState("");
  const [quickAddLlmApiKey, setQuickAddLlmApiKey] = useState("");
  const [quickAddMergeSystemIntoUser, setQuickAddMergeSystemIntoUser] = useState(false);
  const [quickAddTtsVoice, setQuickAddTtsVoice] = useState("");
  const [customAiError, setCustomAiError] = useState<string | null>(null);
  const [aiRuntimeConfig, setAiRuntimeConfig] = useState<AiRuntimeConfig | null>(null);
  const [aiPoolFilter, setAiPoolFilter] = useState<AiPoolFilterId>("all");
  const [llmPresetState, setLlmPresetState] = useState<AiFriendLlmPresetState>({ presets: [] });
  const [bulkLlmOpen, setBulkLlmOpen] = useState(false);
  const [bulkLlmSelectedPresetId, setBulkLlmSelectedPresetId] = useState("");
  const [bulkLlmDraftPresetId, setBulkLlmDraftPresetId] = useState("llm-preset:draft");
  const [bulkLlmName, setBulkLlmName] = useState("");
  const [bulkLlmBaseUrl, setBulkLlmBaseUrl] = useState(DEFAULT_CUSTOM_LLM_BASE_URL);
  const [bulkLlmModel, setBulkLlmModel] = useState("");
  const [bulkLlmApiKey, setBulkLlmApiKey] = useState("");
  const [bulkLlmMergeSystemIntoUser, setBulkLlmMergeSystemIntoUser] = useState(false);
  const [bulkLlmError, setBulkLlmError] = useState<string | null>(null);
  const [bulkLlmTestStatus, setBulkLlmTestStatus] = useState<string | null>(null);
  const [bulkLlmResults, setBulkLlmResults] = useState<AiFriendLlmPresetApplyResult[]>([]);
  const [ttsPresetState, setTtsPresetState] = useState<AiFriendTtsPresetState>({ presets: [] });
  const [bulkTtsOpen, setBulkTtsOpen] = useState(false);
  const [bulkTtsSelectedPresetId, setBulkTtsSelectedPresetId] = useState("");
  const [bulkTtsDraftPresetId, setBulkTtsDraftPresetId] = useState("tts-preset:draft");
  const [bulkTtsName, setBulkTtsName] = useState("");
  const [bulkTtsBaseUrl, setBulkTtsBaseUrl] = useState(DEFAULT_CUSTOM_TTS_BASE_URL);
  const [bulkTtsModel, setBulkTtsModel] = useState(DEFAULT_CUSTOM_TTS_MODEL);
  const [bulkTtsVoice, setBulkTtsVoice] = useState("mimo_default");
  const [bulkTtsApiKey, setBulkTtsApiKey] = useState("");
  const [bulkTtsFormat, setBulkTtsFormat] = useState(DEFAULT_CUSTOM_TTS_FORMAT);
  const [bulkTtsAuthHeader, setBulkTtsAuthHeader] = useState("Authorization");
  const [bulkTtsError, setBulkTtsError] = useState<string | null>(null);
  const [bulkTtsResults, setBulkTtsResults] = useState<AiFriendTtsPresetApplyResult[]>([]);
  const aiFriends = useMemo(() => buildAiFriendOptions(customAiFriends), [customAiFriends]);
  const baseAiFriends = useMemo(() => aiFriends.filter((friend) => friend.isDefault), [aiFriends]);
  const aiPoolFriends = useMemo(() => {
    const configuredByBaseId = new Map(
      aiFriends
        .filter((friend) => !friend.isDefault && isConfiguredFriendId(friend.id))
        .map((friend) => [friend.basePersonaId, friend]),
    );
    const standaloneCustomFriends = aiFriends.filter((friend) => !friend.isDefault && !isConfiguredFriendId(friend.id));
    return [...baseAiFriends.map((friend) => configuredByBaseId.get(friend.basePersonaId) ?? friend), ...standaloneCustomFriends];
  }, [aiFriends, baseAiFriends]);
  const filteredAiPoolFriends = useMemo(
    () => aiPoolFriends.filter((friend) => aiFriendMatchesPoolFilter(friend, aiPoolFilter)),
    [aiPoolFilter, aiPoolFriends],
  );
  const selectedAiFriends = useMemo(() => {
    const byId = new Map(aiFriends.map((friend) => [friend.id, friend]));
    return selectedAiFriendIds.map((id) => byId.get(id)).filter((friend): friend is AiFriendOption => Boolean(friend));
  }, [aiFriends, selectedAiFriendIds]);

  const loadBulkLlmPresetIntoForm = useCallback((preset: AiFriendLlmPreset) => {
    setBulkLlmSelectedPresetId(preset.id);
    setBulkLlmName(preset.name);
    setBulkLlmBaseUrl(preset.baseUrl);
    setBulkLlmModel(preset.model);
    setBulkLlmApiKey(preset.apiKey ?? "");
    setBulkLlmMergeSystemIntoUser(Boolean(preset.mergeSystemIntoUser));
    setBulkLlmError(null);
    setBulkLlmTestStatus(null);
  }, []);

  const clearBulkLlmPresetForm = useCallback(() => {
    setBulkLlmSelectedPresetId("");
    setBulkLlmDraftPresetId(`llm-preset:${Date.now().toString(36)}`);
    setBulkLlmName("");
    setBulkLlmBaseUrl(DEFAULT_CUSTOM_LLM_BASE_URL);
    setBulkLlmModel("");
    setBulkLlmApiKey("");
    setBulkLlmMergeSystemIntoUser(false);
    setBulkLlmError(null);
    setBulkLlmTestStatus(null);
    setBulkLlmResults([]);
  }, []);

  const loadBulkTtsPresetIntoForm = useCallback((preset: AiFriendTtsPreset) => {
    setBulkTtsSelectedPresetId(preset.id);
    setBulkTtsName(preset.name);
    setBulkTtsBaseUrl(preset.baseUrl);
    setBulkTtsModel(preset.model);
    setBulkTtsVoice(preset.voice);
    setBulkTtsApiKey(preset.apiKey ?? "");
    setBulkTtsFormat(preset.format ?? DEFAULT_CUSTOM_TTS_FORMAT);
    setBulkTtsAuthHeader(preset.authHeader ?? "Authorization");
    setBulkTtsError(null);
  }, []);

  const clearBulkTtsPresetForm = useCallback(() => {
    setBulkTtsSelectedPresetId("");
    setBulkTtsDraftPresetId(`tts-preset:${Date.now().toString(36)}`);
    setBulkTtsName("");
    setBulkTtsBaseUrl(DEFAULT_CUSTOM_TTS_BASE_URL);
    setBulkTtsModel(DEFAULT_CUSTOM_TTS_MODEL);
    setBulkTtsVoice("mimo_default");
    setBulkTtsApiKey("");
    setBulkTtsFormat(DEFAULT_CUSTOM_TTS_FORMAT);
    setBulkTtsAuthHeader("Authorization");
    setBulkTtsError(null);
    setBulkTtsResults([]);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCustomAiFriends(readStoredCustomAiFriends());
      setAiLlmSecrets(readStoredAiFriendLlmSecrets());
      setSelectedAiFriendIds(readStoredSelectedAiFriendIds());
      setAiRuntimeMode(readStoredAiRuntimeMode());
      const storedPresetState = readStoredAiFriendLlmPresetState();
      setLlmPresetState(storedPresetState);
      const selectedPreset =
        storedPresetState.presets.find((preset) => preset.id === storedPresetState.lastUsedPresetId) ?? storedPresetState.presets[0];
      if (selectedPreset) {
        loadBulkLlmPresetIntoForm(selectedPreset);
      }
      const storedTtsPresetState = readStoredAiFriendTtsPresetState();
      setTtsPresetState(storedTtsPresetState);
      const selectedTtsPreset =
        storedTtsPresetState.presets.find((preset) => preset.id === storedTtsPresetState.lastUsedPresetId) ??
        storedTtsPresetState.presets[0];
      if (selectedTtsPreset) {
        loadBulkTtsPresetIntoForm(selectedTtsPreset);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBulkLlmPresetIntoForm, loadBulkTtsPresetIntoForm]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ai-config")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("读取 AI 配置失败。"))))
      .then((data: AiRuntimeConfig) => {
        if (!cancelled) setAiRuntimeConfig(data);
      })
      .catch(() => {
        if (!cancelled) setAiRuntimeConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    writeStoredCustomAiFriends(customAiFriends);
  }, [customAiFriends, loaded]);

  useEffect(() => {
    if (!loaded) return;
    writeStoredAiFriendLlmSecrets(aiLlmSecrets);
  }, [aiLlmSecrets, loaded]);

  useEffect(() => {
    if (!loaded) return;
    writeStoredSelectedAiFriendIds(selectedAiFriendIds);
  }, [loaded, selectedAiFriendIds]);

  useEffect(() => {
    if (!loaded) return;
    writeStoredAiRuntimeMode(aiRuntimeMode);
  }, [aiRuntimeMode, loaded]);

  useEffect(() => {
    if (!loaded) return;
    writeStoredAiFriendLlmPresetState(llmPresetState);
  }, [llmPresetState, loaded]);

  useEffect(() => {
    if (!loaded) return;
    writeStoredAiFriendTtsPresetState(ttsPresetState);
  }, [ttsPresetState, loaded]);

  const toggleAiFriendSelection = useCallback((friendId: string) => {
    setSelectedAiFriendIds((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId],
    );
  }, []);

  const moveSelectedAiFriend = useCallback((friendId: string, direction: -1 | 1) => {
    setSelectedAiFriendIds((current) => {
      const index = current.indexOf(friendId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }, []);

  const removeSelectedAiFriend = useCallback((friendId: string) => {
    setSelectedAiFriendIds((current) => current.filter((id) => id !== friendId));
  }, []);

  const randomizeSelectedAiFriends = useCallback(() => {
    const validIds = new Set(aiFriends.map((friend) => friend.id));
    setSelectedAiFriendIds((current) => shuffleIds(current.filter((id) => validIds.has(id))));
  }, [aiFriends]);

  const currentBulkLlmPreset = useMemo((): AiFriendLlmPreset | undefined => {
    const name = bulkLlmName.trim().replace(/\s+/g, " ").slice(0, 40);
    const baseUrl = bulkLlmBaseUrl.trim().replace(/\s+/g, "").replace(/\/+$/, "").slice(0, 260);
    const model = bulkLlmModel.trim().slice(0, 120);
    if (!name || !baseUrl || !model) return undefined;
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    } catch {
      return undefined;
    }
    const now = new Date().toISOString();
    const existing = llmPresetState.presets.find((preset) => preset.id === bulkLlmSelectedPresetId);
    return {
      id: bulkLlmSelectedPresetId || bulkLlmDraftPresetId,
      name,
      baseUrl,
      model,
      ...(bulkLlmApiKey.trim() ? { apiKey: bulkLlmApiKey.trim().slice(0, 4096) } : {}),
      ...(bulkLlmMergeSystemIntoUser ? { mergeSystemIntoUser: true } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }, [
    bulkLlmApiKey,
    bulkLlmBaseUrl,
    bulkLlmMergeSystemIntoUser,
    bulkLlmModel,
    bulkLlmName,
    bulkLlmDraftPresetId,
    bulkLlmSelectedPresetId,
    llmPresetState.presets,
  ]);

  const currentBulkTtsPreset = useMemo((): AiFriendTtsPreset | undefined => {
    const name = bulkTtsName.trim().replace(/\s+/g, " ").slice(0, 40);
    const baseUrl = bulkTtsBaseUrl.trim().replace(/\s+/g, "").replace(/\/+$/, "").slice(0, 260);
    const model = bulkTtsModel.trim().slice(0, 120);
    const voice = bulkTtsVoice.trim().replace(/\s+/g, "_").slice(0, 80);
    const format = bulkTtsFormat.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
    const authHeader = bulkTtsAuthHeader.trim().slice(0, 80);
    if (!name || !baseUrl || !model || !voice) return undefined;
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    } catch {
      return undefined;
    }
    if (authHeader && !/^[A-Za-z0-9-]+$/.test(authHeader)) return undefined;
    const now = new Date().toISOString();
    const existing = ttsPresetState.presets.find((preset) => preset.id === bulkTtsSelectedPresetId);
    return {
      id: bulkTtsSelectedPresetId || bulkTtsDraftPresetId,
      name,
      baseUrl,
      model,
      voice,
      ...(bulkTtsApiKey.trim() ? { apiKey: bulkTtsApiKey.trim().slice(0, 4096) } : {}),
      ...(format ? { format } : {}),
      ...(authHeader ? { authHeader } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }, [
    bulkTtsApiKey,
    bulkTtsAuthHeader,
    bulkTtsBaseUrl,
    bulkTtsDraftPresetId,
    bulkTtsFormat,
    bulkTtsModel,
    bulkTtsName,
    bulkTtsSelectedPresetId,
    bulkTtsVoice,
    ttsPresetState.presets,
  ]);

  const saveBulkLlmPreset = useCallback(() => {
    if (!currentBulkLlmPreset) {
      setBulkLlmError("需要填写有效的预设名、Base URL 和模型名。");
      return;
    }
    setLlmPresetState((current) => ({
      presets: [...current.presets.filter((preset) => preset.id !== currentBulkLlmPreset.id), currentBulkLlmPreset],
      lastUsedPresetId: currentBulkLlmPreset.id,
    }));
    setBulkLlmSelectedPresetId(currentBulkLlmPreset.id);
    setBulkLlmDraftPresetId(`llm-preset:${Date.now().toString(36)}`);
    setBulkLlmError(null);
  }, [currentBulkLlmPreset]);

  const deleteBulkLlmPreset = useCallback(() => {
    if (!bulkLlmSelectedPresetId) return;
    const preset = llmPresetState.presets.find((item) => item.id === bulkLlmSelectedPresetId);
    if (!preset) return;
    if (!window.confirm(`删除 LLM 预设「${preset.name}」？`)) return;
    setLlmPresetState((current) => {
      const presets = current.presets.filter((item) => item.id !== preset.id);
      return { presets, ...(presets[0] ? { lastUsedPresetId: presets[0].id } : {}) };
    });
    clearBulkLlmPresetForm();
  }, [bulkLlmSelectedPresetId, clearBulkLlmPresetForm, llmPresetState.presets]);

  const saveBulkTtsPreset = useCallback(() => {
    if (!currentBulkTtsPreset) {
      setBulkTtsError("需要填写有效的预设名、TTS Base URL、模型名和 Voice ID。");
      return;
    }
    setTtsPresetState((current) => ({
      presets: [...current.presets.filter((preset) => preset.id !== currentBulkTtsPreset.id), currentBulkTtsPreset],
      lastUsedPresetId: currentBulkTtsPreset.id,
    }));
    setBulkTtsSelectedPresetId(currentBulkTtsPreset.id);
    setBulkTtsDraftPresetId(`tts-preset:${Date.now().toString(36)}`);
    setBulkTtsError(null);
  }, [currentBulkTtsPreset]);

  const deleteBulkTtsPreset = useCallback(() => {
    if (!bulkTtsSelectedPresetId) return;
    const preset = ttsPresetState.presets.find((item) => item.id === bulkTtsSelectedPresetId);
    if (!preset) return;
    if (!window.confirm(`删除 TTS 预设「${preset.name}」？`)) return;
    setTtsPresetState((current) => {
      const presets = current.presets.filter((item) => item.id !== preset.id);
      return { presets, ...(presets[0] ? { lastUsedPresetId: presets[0].id } : {}) };
    });
    clearBulkTtsPresetForm();
  }, [bulkTtsSelectedPresetId, clearBulkTtsPresetForm, ttsPresetState.presets]);

  const testBulkLlmPreset = useCallback(async () => {
    if (!currentBulkLlmPreset) {
      setBulkLlmError("需要填写有效的预设名、Base URL 和模型名后再测试。");
      return;
    }
    setBulkLlmTestStatus("测试中...");
    setBulkLlmError(null);
    try {
      const response = await fetch("/api/ai-config/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentBulkLlmPreset),
      });
      const data = (await response.json()) as {
        connectivity?: { ok?: boolean; error?: string };
        projectFormat?: { ok?: boolean; error?: string };
        error?: string;
      };
      if (!response.ok) {
        setBulkLlmTestStatus(data.error ?? "测试请求失败。");
        return;
      }
      const error = data.connectivity?.error ?? data.projectFormat?.error;
      setBulkLlmTestStatus(
        `接口${data.connectivity?.ok ? "可用" : "失败"} · 项目格式${data.projectFormat?.ok ? "可用" : "失败"}${
          error ? ` · ${error}` : ""
        }`,
      );
    } catch {
      setBulkLlmTestStatus("测试请求失败，请检查本地服务和网络。");
    }
  }, [currentBulkLlmPreset]);

  const applyBulkLlmPreset = useCallback(
    (mode: AiFriendLlmPresetApplyMode) => {
      if (!currentBulkLlmPreset) {
        setBulkLlmError("需要先保存或填写一个有效 LLM 预设。");
        return;
      }
      const result = applyLlmPresetToSelectedAiFriends({
        aiFriends,
        customAiFriends,
        selectedAiFriendIds,
        aiLlmSecrets,
        preset: currentBulkLlmPreset,
        mode,
        now: new Date().toISOString(),
      });
      setCustomAiFriends(result.customAiFriends);
      setAiLlmSecrets(result.aiLlmSecrets);
      setSelectedAiFriendIds(result.selectedAiFriendIds);
      setBulkLlmResults(result.results);
      setLlmPresetState((current) => ({
        presets: [...current.presets.filter((preset) => preset.id !== currentBulkLlmPreset.id), currentBulkLlmPreset],
        lastUsedPresetId: currentBulkLlmPreset.id,
      }));
      setBulkLlmSelectedPresetId(currentBulkLlmPreset.id);
      setBulkLlmDraftPresetId(`llm-preset:${Date.now().toString(36)}`);
      setBulkLlmError(null);
    },
    [aiFriends, aiLlmSecrets, currentBulkLlmPreset, customAiFriends, selectedAiFriendIds],
  );

  const applyBulkTtsPreset = useCallback(
    (mode: AiFriendTtsPresetApplyMode) => {
      if (!currentBulkTtsPreset) {
        setBulkTtsError("需要先保存或填写一个有效 TTS 预设。");
        return;
      }
      const result = applyTtsPresetToSelectedAiFriends({
        aiFriends,
        customAiFriends,
        selectedAiFriendIds,
        aiLlmSecrets,
        preset: currentBulkTtsPreset,
        mode,
        now: new Date().toISOString(),
      });
      setCustomAiFriends(result.customAiFriends);
      setAiLlmSecrets(result.aiLlmSecrets);
      setSelectedAiFriendIds(result.selectedAiFriendIds);
      setBulkTtsResults(result.results);
      setTtsPresetState((current) => ({
        presets: [...current.presets.filter((preset) => preset.id !== currentBulkTtsPreset.id), currentBulkTtsPreset],
        lastUsedPresetId: currentBulkTtsPreset.id,
      }));
      setBulkTtsSelectedPresetId(currentBulkTtsPreset.id);
      setBulkTtsDraftPresetId(`tts-preset:${Date.now().toString(36)}`);
      setBulkTtsError(null);
    },
    [aiFriends, aiLlmSecrets, currentBulkTtsPreset, customAiFriends, selectedAiFriendIds],
  );

  const copyFriendLlmConfigToSelected = useCallback(
    (source: AiFriendOption, mode: AiFriendLlmPresetApplyMode) => {
      if (!source.llmConfig) {
        setBulkLlmError("这个 AI 还没有自定义 LLM 配置，无法复制。");
        return;
      }
      const now = new Date().toISOString();
      const preset: AiFriendLlmPreset = {
        id: `llm-preset:copy:${source.id}:${Date.now().toString(36)}`.slice(0, 80),
        name: source.llmConfig.label ?? source.nickname,
        baseUrl: source.llmConfig.baseUrl,
        model: source.llmConfig.model,
        ...(source.llmConfig.mergeSystemIntoUser ? { mergeSystemIntoUser: true } : {}),
        ...(aiLlmSecrets[source.id]?.apiKey ? { apiKey: aiLlmSecrets[source.id]?.apiKey } : {}),
        createdAt: now,
        updatedAt: now,
      };
      const result = applyLlmPresetToSelectedAiFriends({
        aiFriends,
        customAiFriends,
        selectedAiFriendIds,
        aiLlmSecrets,
        preset,
        mode,
        now,
      });
      setCustomAiFriends(result.customAiFriends);
      setAiLlmSecrets(result.aiLlmSecrets);
      setSelectedAiFriendIds(result.selectedAiFriendIds);
      setBulkLlmResults(result.results);
      setBulkLlmError(null);
    },
    [aiFriends, aiLlmSecrets, customAiFriends, selectedAiFriendIds],
  );

  const copyFriendTtsConfigToSelected = useCallback(
    (source: AiFriendOption, mode: AiFriendTtsPresetApplyMode) => {
      if (!source.ttsConfig) {
        setBulkTtsError("这个 AI 还没有自定义 TTS 配置，无法复制。");
        return;
      }
      const now = new Date().toISOString();
      const preset: AiFriendTtsPreset = {
        id: `tts-preset:copy:${source.id}:${Date.now().toString(36)}`.slice(0, 80),
        name: source.ttsConfig.label ?? `${source.nickname}语音`,
        baseUrl: source.ttsConfig.baseUrl,
        model: source.ttsConfig.model,
        voice: source.ttsConfig.voice,
        ...(source.ttsConfig.format ? { format: source.ttsConfig.format } : {}),
        ...(source.ttsConfig.authHeader ? { authHeader: source.ttsConfig.authHeader } : {}),
        ...(aiLlmSecrets[source.id]?.ttsApiKey ? { apiKey: aiLlmSecrets[source.id]?.ttsApiKey } : {}),
        createdAt: now,
        updatedAt: now,
      };
      const result = applyTtsPresetToSelectedAiFriends({
        aiFriends,
        customAiFriends,
        selectedAiFriendIds,
        aiLlmSecrets,
        preset,
        mode,
        now,
      });
      setCustomAiFriends(result.customAiFriends);
      setAiLlmSecrets(result.aiLlmSecrets);
      setSelectedAiFriendIds(result.selectedAiFriendIds);
      setBulkTtsResults(result.results);
      setBulkTtsError(null);
    },
    [aiFriends, aiLlmSecrets, customAiFriends, selectedAiFriendIds],
  );

  const saveAiFriendLlmConfig = useCallback((friend: AiFriendOption, llmConfig: AiFriendLlmConfig, apiKey: string) => {
    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend = buildEditableAiFriendConfig(friend, targetId, now, {
      llmConfig,
      ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
    });

    setCustomAiFriends((current) => {
      const withoutTarget = current.filter((item) => item.id !== targetId && item.id !== friend.id);
      return [...withoutTarget, nextFriend];
    });
    setAiLlmSecrets((current) => ({
      ...current,
      [targetId]: { ...current[targetId], apiKey: apiKey.trim().slice(0, 4096) },
    }));
    setSelectedAiFriendIds((current) => {
      let replaced = false;
      const next = current
        .map((id) => {
          if (id === friend.id || id === targetId) {
            replaced = true;
            return targetId;
          }
          return id;
        })
        .filter((id, index, values) => values.indexOf(id) === index);
      return replaced ? next : [...next, targetId];
    });
    setCustomAiError(null);
  }, []);

  const saveAiFriendTtsConfig = useCallback((friend: AiFriendOption, ttsConfig: AiFriendTtsConfig, apiKey: string) => {
    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend = buildEditableAiFriendConfig(friend, targetId, now, {
      ttsVoice: ttsConfig.voice,
      ttsConfig,
      ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
    });

    setCustomAiFriends((current) => {
      const withoutTarget = current.filter((item) => item.id !== targetId && item.id !== friend.id);
      return [...withoutTarget, nextFriend];
    });
    setAiLlmSecrets((current) => ({
      ...current,
      [targetId]: { ...current[targetId], ttsApiKey: apiKey.trim().slice(0, 4096) },
    }));
    setSelectedAiFriendIds((current) => {
      let replaced = false;
      const next = current
        .map((id) => {
          if (id === friend.id || id === targetId) {
            replaced = true;
            return targetId;
          }
          return id;
        })
        .filter((id, index, values) => values.indexOf(id) === index);
      return replaced ? next : [...next, targetId];
    });
    setCustomAiError(null);
  }, []);

  const saveAiFriendProfile = useCallback((friend: AiFriendOption, nickname: string) => {
    const safeNickname = nickname.trim().replace(/\s+/g, " ").slice(0, 16);
    if (!safeNickname) {
      setCustomAiError("角色名称不能为空。");
      return;
    }

    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend = buildEditableAiFriendConfig(friend, targetId, now, {
      nickname: safeNickname,
      avatarDataUrl: friend.avatarDataUrl,
      ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
    });

    setCustomAiFriends((current) => {
      const withoutTarget = current.filter((item) => item.id !== targetId && item.id !== friend.id);
      return [...withoutTarget, nextFriend];
    });
    setSelectedAiFriendIds((current) => {
      let replaced = false;
      const next = current
        .map((id) => {
          if (id === friend.id || id === targetId) {
            replaced = true;
            return targetId;
          }
          return id;
        })
        .filter((id, index, values) => values.indexOf(id) === index);
      return replaced ? next : [...next, targetId];
    });
    setCustomAiError(null);
  }, []);

  const selectAiFriendOrdinaryPlayerType = useCallback((friend: AiFriendOption, typeId: AiOrdinaryPlayerTypeId) => {
    const currentProfile = sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile);
    if (currentProfile.playerTypeId === typeId) return;

    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend = applyOrdinaryPlayerTypePreset(
      buildEditableAiFriendConfig(friend, targetId, now, {
        ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
      }),
      typeId,
    );

    setCustomAiFriends((current) => {
      const withoutTarget = current.filter((item) => item.id !== targetId && item.id !== friend.id);
      return [...withoutTarget, nextFriend];
    });
    setSelectedAiFriendIds((current) => {
      let replaced = false;
      const next = current
        .map((id) => {
          if (id === friend.id || id === targetId) {
            replaced = true;
            return targetId;
          }
          return id;
        })
        .filter((id, index, values) => values.indexOf(id) === index);
      return replaced ? next : current;
    });
    setCustomAiError(null);
  }, []);

  const copyAiFriendToCustom = useCallback(
    (friendId: string) => {
      const source = aiFriends.find((friend) => friend.id === friendId);
      if (!source) return;
      const next = copyAiFriend(source);
      setCustomAiFriends((current) => [...current, next]);
      setSelectedAiFriendIds((current) => [...current, next.id]);
      setCustomAiError(null);
    },
    [aiFriends],
  );

  const addCustomAiFriend = useCallback(() => {
    const source = baseAiFriends.find((friend) => friend.id === quickAddBaseId) ?? baseAiFriends[0];
    if (!source) return;
    const nickname = quickAddNickname.trim().replace(/\s+/g, " ").slice(0, 16);
    const llmConfig = quickAddUseCustomLlm
      ? buildCustomLlmConfig({
          label: quickAddLlmLabel,
          baseUrl: quickAddLlmBaseUrl,
          model: quickAddLlmModel,
          mergeSystemIntoUser: quickAddMergeSystemIntoUser,
        })
      : undefined;
    if (quickAddUseCustomLlm && !llmConfig) {
      setCustomAiError("自定义大模型需要填写有效的接口地址和模型名称。");
      return;
    }
    const next = {
      ...copyAiFriend(source),
      nickname: nickname || `${source.basePersonaName}好友`.slice(0, 16),
      llmConfig,
      ttsVoice: quickAddTtsVoice || undefined,
    };
    setCustomAiFriends((current) => [...current, next]);
    if (llmConfig && quickAddLlmApiKey.trim()) {
      setAiLlmSecrets((current) => ({
        ...current,
        [next.id]: { apiKey: quickAddLlmApiKey.trim().slice(0, 4096) },
      }));
    }
    setSelectedAiFriendIds((current) => [...current, next.id]);
    setQuickAddNickname("");
    setQuickAddLlmApiKey("");
    setCustomAiError(null);
  }, [
    baseAiFriends,
    quickAddBaseId,
    quickAddLlmApiKey,
    quickAddLlmBaseUrl,
    quickAddLlmLabel,
    quickAddLlmModel,
    quickAddMergeSystemIntoUser,
    quickAddNickname,
    quickAddTtsVoice,
    quickAddUseCustomLlm,
  ]);

  const updateCustomAiFriend = useCallback((friendId: string, patch: Partial<AiFriendConfig>) => {
    setCustomAiFriends((current) =>
      current.map((friend) =>
        friend.id === friendId
          ? {
              ...friend,
              ...patch,
              id: friend.id,
              updatedAt: new Date().toISOString(),
            }
          : friend,
      ),
    );
  }, []);

  const refreshAiFriendStrategy = useCallback(
    (friend: AiFriendOption) => {
      if (friend.isDefault) return;
      updateCustomAiFriend(friend.id, { updatedAt: new Date().toISOString() });
    },
    [updateCustomAiFriend],
  );

  const saveAiFriendAvatar = useCallback(async (friend: AiFriendOption, file: File) => {
    try {
      const avatarDataUrl = await buildAiFriendAvatarDataUrl(file);
      const now = new Date().toISOString();
      const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
      const nextFriend = buildEditableAiFriendConfig(friend, targetId, now, {
        avatarDataUrl,
        ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
      });

      setCustomAiFriends((current) => {
        const withoutTarget = current.filter((item) => item.id !== targetId && item.id !== friend.id);
        return [...withoutTarget, nextFriend];
      });
      setSelectedAiFriendIds((current) => {
        let replaced = false;
        const next = current
          .map((id) => {
            if (id === friend.id || id === targetId) {
              replaced = true;
              return targetId;
            }
            return id;
          })
          .filter((id, index, values) => values.indexOf(id) === index);
        return replaced ? next : [...next, targetId];
      });
      setCustomAiError(null);
    } catch (error) {
      setCustomAiError(error instanceof Error ? error.message : "头像上传失败。");
    }
  }, []);

  const clearAiFriendAvatar = useCallback(
    (friend: AiFriendOption) => {
      if (friend.isDefault || !friend.avatarDataUrl) return;
      updateCustomAiFriend(friend.id, { avatarDataUrl: undefined });
      setCustomAiError(null);
    },
    [updateCustomAiFriend],
  );

  const deleteCustomAiFriend = useCallback((friendId: string) => {
    setCustomAiFriends((current) => current.filter((friend) => friend.id !== friendId));
    setAiLlmSecrets((current) => {
      if (!current[friendId]) return current;
      const next = { ...current };
      delete next[friendId];
      return next;
    });
    setSelectedAiFriendIds((current) => current.filter((id) => id !== friendId));
  }, []);

  const selectedCount = selectedAiFriends.length;

  return (
    <main
      className="ai-pool-redesign mobile-ai-pool-page min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.9)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mobile-ai-pool-shell mx-auto grid min-h-screen w-full max-w-[1680px] content-start gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <header className="mobile-ai-pool-header flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7da8e3]/24 bg-[#0d1623]/82 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f1c76e]/72">AI Character Pool</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">AI角色池</h1>
            <p className="mt-1 text-sm text-[#b8d6ff]/72">
              先按人格打法挑队友，再点编辑配置头像、LLM 和 TTS · {selectedCount} 位已加入本局阵容
            </p>
          </div>
          <Link
            href="/"
            className="ai-pool-home-link rounded-full border border-[#f1c76e]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
          >
            返回首页开局
          </Link>
        </header>

        <AiRuntimeModeCard mode={aiRuntimeMode} aiRuntimeConfig={aiRuntimeConfig} onModeChange={setAiRuntimeMode} />

        <section className="mobile-ai-pool-layout grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_380px]">
          <AiPoolList
            friends={filteredAiPoolFriends}
            allFriends={aiFriends}
            allFriendCount={aiPoolFriends.length}
            filter={aiPoolFilter}
            aiRuntimeConfig={aiRuntimeConfig}
            aiLlmSecrets={aiLlmSecrets}
            selectedIds={selectedAiFriendIds}
            selectedCount={selectedCount}
            bulkLlmOpen={bulkLlmOpen}
            llmPresets={llmPresetState.presets}
            bulkLlmSelectedPresetId={bulkLlmSelectedPresetId}
            bulkLlmName={bulkLlmName}
            bulkLlmBaseUrl={bulkLlmBaseUrl}
            bulkLlmModel={bulkLlmModel}
            bulkLlmApiKey={bulkLlmApiKey}
            bulkLlmMergeSystemIntoUser={bulkLlmMergeSystemIntoUser}
            bulkLlmError={bulkLlmError}
            bulkLlmTestStatus={bulkLlmTestStatus}
            bulkLlmResults={bulkLlmResults}
            bulkTtsOpen={bulkTtsOpen}
            ttsPresets={ttsPresetState.presets}
            bulkTtsSelectedPresetId={bulkTtsSelectedPresetId}
            bulkTtsName={bulkTtsName}
            bulkTtsBaseUrl={bulkTtsBaseUrl}
            bulkTtsModel={bulkTtsModel}
            bulkTtsVoice={bulkTtsVoice}
            bulkTtsApiKey={bulkTtsApiKey}
            bulkTtsFormat={bulkTtsFormat}
            bulkTtsAuthHeader={bulkTtsAuthHeader}
            bulkTtsError={bulkTtsError}
            bulkTtsResults={bulkTtsResults}
            onFilterChange={setAiPoolFilter}
            onToggle={toggleAiFriendSelection}
            onCopy={copyAiFriendToCustom}
            onProfileSave={saveAiFriendProfile}
            onAvatarUpload={saveAiFriendAvatar}
            onClearAvatar={clearAiFriendAvatar}
            onSaveLlmConfig={saveAiFriendLlmConfig}
            onSaveTtsConfig={saveAiFriendTtsConfig}
            onSelectOrdinaryPlayerType={selectAiFriendOrdinaryPlayerType}
            onRefreshStrategy={refreshAiFriendStrategy}
            onDelete={deleteCustomAiFriend}
            onBulkLlmOpenChange={setBulkLlmOpen}
            onLlmPresetSelect={loadBulkLlmPresetIntoForm}
            onNewLlmPreset={clearBulkLlmPresetForm}
            onBulkLlmNameChange={setBulkLlmName}
            onBulkLlmBaseUrlChange={setBulkLlmBaseUrl}
            onBulkLlmModelChange={setBulkLlmModel}
            onBulkLlmApiKeyChange={setBulkLlmApiKey}
            onBulkLlmMergeSystemIntoUserChange={setBulkLlmMergeSystemIntoUser}
            onSaveLlmPreset={saveBulkLlmPreset}
            onDeleteLlmPreset={deleteBulkLlmPreset}
            onTestLlmPreset={testBulkLlmPreset}
            onApplyLlmFillBlanks={() => applyBulkLlmPreset("fill-blanks")}
            onApplyLlmOverwrite={() => applyBulkLlmPreset("overwrite")}
            onCopyFriendLlmFillBlanks={(friend) => copyFriendLlmConfigToSelected(friend, "fill-blanks")}
            onCopyFriendLlmOverwrite={(friend) => copyFriendLlmConfigToSelected(friend, "overwrite")}
            onBulkTtsOpenChange={setBulkTtsOpen}
            onTtsPresetSelect={loadBulkTtsPresetIntoForm}
            onNewTtsPreset={clearBulkTtsPresetForm}
            onBulkTtsNameChange={setBulkTtsName}
            onBulkTtsBaseUrlChange={setBulkTtsBaseUrl}
            onBulkTtsModelChange={setBulkTtsModel}
            onBulkTtsVoiceChange={setBulkTtsVoice}
            onBulkTtsApiKeyChange={setBulkTtsApiKey}
            onBulkTtsFormatChange={setBulkTtsFormat}
            onBulkTtsAuthHeaderChange={setBulkTtsAuthHeader}
            onSaveTtsPreset={saveBulkTtsPreset}
            onDeleteTtsPreset={deleteBulkTtsPreset}
            onApplyTtsFillBlanks={() => applyBulkTtsPreset("fill-blanks")}
            onApplyTtsOverwrite={() => applyBulkTtsPreset("overwrite")}
            onCopyFriendTtsFillBlanks={(friend) => copyFriendTtsConfigToSelected(friend, "fill-blanks")}
            onCopyFriendTtsOverwrite={(friend) => copyFriendTtsConfigToSelected(friend, "overwrite")}
          />
          <div className="mobile-ai-pool-side grid content-start gap-4">
            <CustomAiTransferCard
              baseFriends={baseAiFriends}
              selectedFriends={selectedAiFriends}
              selectedCount={selectedCount}
              quickAddNickname={quickAddNickname}
              quickAddBaseId={quickAddBaseId}
              quickAddUseCustomLlm={quickAddUseCustomLlm}
              quickAddLlmLabel={quickAddLlmLabel}
              quickAddLlmBaseUrl={quickAddLlmBaseUrl}
              quickAddLlmModel={quickAddLlmModel}
              quickAddLlmApiKey={quickAddLlmApiKey}
              quickAddMergeSystemIntoUser={quickAddMergeSystemIntoUser}
              quickAddTtsVoice={quickAddTtsVoice}
              customAiError={customAiError}
              aiRuntimeConfig={aiRuntimeConfig}
              onQuickAddNicknameChange={setQuickAddNickname}
              onQuickAddBaseChange={setQuickAddBaseId}
              onQuickAddUseCustomLlmChange={setQuickAddUseCustomLlm}
              onQuickAddLlmLabelChange={setQuickAddLlmLabel}
              onQuickAddLlmBaseUrlChange={setQuickAddLlmBaseUrl}
              onQuickAddLlmModelChange={setQuickAddLlmModel}
              onQuickAddLlmApiKeyChange={setQuickAddLlmApiKey}
              onQuickAddMergeSystemIntoUserChange={setQuickAddMergeSystemIntoUser}
              onQuickAddTtsVoiceChange={setQuickAddTtsVoice}
              onQuickAdd={addCustomAiFriend}
              onMove={moveSelectedAiFriend}
              onRemove={removeSelectedAiFriend}
              onRandomize={randomizeSelectedAiFriends}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
function AiRuntimeModeCard({
  mode,
  aiRuntimeConfig,
  onModeChange,
}: {
  mode: AiRuntimeMode;
  aiRuntimeConfig: AiRuntimeConfig | null;
  onModeChange: (mode: AiRuntimeMode) => void;
}) {
  const llmReady = Boolean(aiRuntimeConfig?.llm.routingEnabled || aiRuntimeConfig?.llm.routes.some((route) => route.connected));
  const modeHint =
    mode === "mock"
      ? "不需要 API Key，对局只使用本地策略发言和行动。"
      : llmReady
        ? "对局会调用已配置的真实大模型；缺少单卡 Key 时使用全局配置。"
        : "已选择真实 LLM，但当前还没有检测到可用模型配置。";

  return (
    <section className="mobile-ai-mode-card rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#e4efff]">对局 AI 模式</h2>
          <p className="mt-1 text-xs leading-5 text-[#b8d6ff]/72">{modeHint}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-xs ${
            mode === "mock"
              ? "border-[#77d898]/22 bg-[#77d898]/10 text-[#a8f0b6]"
              : "border-[#f1c76e]/24 bg-[#f1c76e]/10 text-[#f1d796]"
          }`}
        >
          {mode === "mock" ? "Mock" : "LLM"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onModeChange("mock")}
          className={`rounded-2xl border px-3 py-3 text-left transition ${
            mode === "mock"
              ? "border-[#77d898]/42 bg-[#12351f] text-[#dff4df]"
              : "border-[#7da8e3]/14 bg-black/18 text-[#b8d6ff] hover:border-[#7da8e3]/34"
          }`}
        >
          <span className="block text-sm font-semibold">Mock 试玩</span>
          <span className="mt-1 block text-xs opacity-72">零配置、无费用</span>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("llm")}
          className={`rounded-2xl border px-3 py-3 text-left transition ${
            mode === "llm"
              ? "border-[#f1c76e]/42 bg-[#342713] text-[#f7ead5]"
              : "border-[#7da8e3]/14 bg-black/18 text-[#b8d6ff] hover:border-[#7da8e3]/34"
          }`}
        >
          <span className="block text-sm font-semibold">真实 LLM</span>
          <span className="mt-1 block text-xs opacity-72">使用模型配置</span>
        </button>
      </div>
    </section>
  );
}

function BulkLlmPresetCard({
  open,
  presets,
  selectedPresetId,
  selectedCount,
  name,
  baseUrl,
  model,
  apiKey,
  mergeSystemIntoUser,
  error,
  testStatus,
  results,
  onOpenChange,
  onPresetSelect,
  onNewPreset,
  onNameChange,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
  onMergeSystemIntoUserChange,
  onSave,
  onDelete,
  onTest,
  onApplyFillBlanks,
  onApplyOverwrite,
}: {
  open: boolean;
  presets: AiFriendLlmPreset[];
  selectedPresetId: string;
  selectedCount: number;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  mergeSystemIntoUser: boolean;
  error: string | null;
  testStatus: string | null;
  results: AiFriendLlmPresetApplyResult[];
  onOpenChange: (open: boolean) => void;
  onPresetSelect: (preset: AiFriendLlmPreset) => void;
  onNewPreset: () => void;
  onNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onMergeSystemIntoUserChange: (value: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onTest: () => void;
  onApplyFillBlanks: () => void;
  onApplyOverwrite: () => void;
}) {
  return (
    <section className="mobile-ai-bulk-llm-card rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#e4efff]">批量 LLM 配置</h2>
          <p className="mt-1 text-xs leading-5 text-[#b8d6ff]/72">
            目标：当前阵容 {selectedCount} 位 AI。补齐只处理还没有自定义 LLM 的 AI；覆盖会替换当前阵容全部 AI 的 LLM 配置。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="shrink-0 rounded-full border border-[#7da8e3]/25 bg-[#7da8e3]/10 px-3 py-2 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/16"
        >
          {open ? "收起" : "LLM 预设"}
        </button>
      </div>
      {open && (
        <div className="mobile-ai-bulk-llm-panel mt-4 grid gap-3 rounded-2xl border border-[#7da8e3]/14 bg-black/16 p-3">
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            LLM 预设
            <select
              value={selectedPresetId}
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) {
                  onPresetSelect(preset);
                } else {
                  onNewPreset();
                }
              }}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            >
              <option value="">新建预设</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} · {preset.model}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              预设名
              <input
                value={name}
                placeholder="例如：DeepSeek"
                onChange={(event) => onNameChange(event.target.value)}
                className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              模型名
              <input
                value={model}
                placeholder="deepseek-chat / gpt-4o-mini"
                onChange={(event) => onModelChange(event.target.value)}
                className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            Base URL
            <input
              value={baseUrl}
              onChange={(event) => onBaseUrlChange(event.target.value)}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["OpenAI", "https://api.openai.com/v1"],
              ["DeepSeek", "https://api.deepseek.com/v1"],
              ["OpenRouter", "https://openrouter.ai/api/v1"],
              ["本地", "http://localhost:11434/v1"],
            ].map(([label, value]) => (
              <button
                key={value}
                type="button"
                onClick={() => onBaseUrlChange(value)}
                className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/8 px-3 py-1.5 text-xs text-[#b8d6ff]"
              >
                {label}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            API Key
            <input
              type="password"
              value={apiKey}
              placeholder="仅保存在本机浏览器"
              onChange={(event) => onApiKeyChange(event.target.value)}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#ad9c7d]">
            <input
              type="checkbox"
              checked={mergeSystemIntoUser}
              onChange={(event) => onMergeSystemIntoUserChange(event.target.checked)}
              className="h-4 w-4 accent-[#7da8e3]"
            />
            将系统提示合并进用户消息
          </label>
          {error && <div className="rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">{error}</div>}
          {testStatus && <div className="rounded-xl border border-[#7da8e3]/18 bg-[#0d1623]/55 px-3 py-2 text-xs text-[#d8e7ff]">{testStatus}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSave} className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white">
              保存预设
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={!selectedPresetId}
              className="rounded-full border border-[#e46d55]/25 bg-[#2b1110]/50 px-4 py-2 text-xs font-semibold text-[#ffb1a4] disabled:opacity-45"
            >
              删除预设
            </button>
            <button
              type="button"
              onClick={onTest}
              className="rounded-full border border-[#f1c76e]/24 bg-black/18 px-4 py-2 text-xs font-semibold text-[#f1d796]"
            >
              测试连接
            </button>
          </div>
          <p className="text-[11px] leading-5 text-[#ad9c7d]">测试连接会调用一次模型，可能产生少量费用；保存和套用不强制要求测试通过。</p>
          <p className="text-[11px] leading-5 text-[#ad9c7d]">补齐配置只会修改当前阵容里还没有自定义 LLM 的 AI；覆盖配置会替换当前阵容全部 AI 的 LLM 设置。</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApplyFillBlanks}
              disabled={selectedCount === 0}
              className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/55 px-4 py-2 text-xs font-semibold text-[#a8f0b6] disabled:opacity-45"
            >
              补齐当前阵容未配置 AI
            </button>
            <button
              type="button"
              onClick={onApplyOverwrite}
              disabled={selectedCount === 0}
              className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
            >
              覆盖当前阵容全部 AI
            </button>
          </div>
          {results.length > 0 && (
            <div className="mobile-ai-bulk-llm-results grid gap-2 rounded-2xl border border-[#77d898]/14 bg-black/18 p-3">
              {results.map((result) => (
                <div key={`${result.friendId}:${result.nextFriendId ?? result.friendId}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-[#f7ead5]">{result.friendName}</span>
                  <span className="shrink-0 text-[#a8f0b6]">
                    {result.status === "filled" ? "已补齐配置" : result.status === "overwritten" ? "已覆盖配置" : "已有配置，已跳过"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BulkTtsPresetCard({
  open,
  presets,
  selectedPresetId,
  selectedCount,
  name,
  baseUrl,
  model,
  voice,
  apiKey,
  format,
  authHeader,
  error,
  results,
  onOpenChange,
  onPresetSelect,
  onNewPreset,
  onNameChange,
  onBaseUrlChange,
  onModelChange,
  onVoiceChange,
  onApiKeyChange,
  onFormatChange,
  onAuthHeaderChange,
  onSave,
  onDelete,
  onApplyFillBlanks,
  onApplyOverwrite,
}: {
  open: boolean;
  presets: AiFriendTtsPreset[];
  selectedPresetId: string;
  selectedCount: number;
  name: string;
  baseUrl: string;
  model: string;
  voice: string;
  apiKey: string;
  format: string;
  authHeader: string;
  error: string | null;
  results: AiFriendTtsPresetApplyResult[];
  onOpenChange: (open: boolean) => void;
  onPresetSelect: (preset: AiFriendTtsPreset) => void;
  onNewPreset: () => void;
  onNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onVoiceChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onAuthHeaderChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onApplyFillBlanks: () => void;
  onApplyOverwrite: () => void;
}) {
  return (
    <section className="mobile-ai-bulk-tts-card rounded-[24px] border border-[#77d898]/22 bg-[#0f2118]/68 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#dff4df]">批量 TTS 配置</h2>
          <p className="mt-1 text-xs leading-5 text-[#9fc8a7]">保存云语音预设，再批量应用到当前阵容 AI。</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="shrink-0 rounded-full border border-[#77d898]/25 bg-[#77d898]/10 px-3 py-2 text-xs font-semibold text-[#a8f0b6] transition hover:bg-[#77d898]/16"
        >
          {open ? "收起" : "TTS 预设"}
        </button>
      </div>
      {open && (
        <div className="mobile-ai-bulk-tts-panel mt-4 grid gap-3 rounded-2xl border border-[#77d898]/14 bg-black/16 p-3">
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            TTS 预设
            <select
              value={selectedPresetId}
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) onPresetSelect(preset);
              }}
              className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
            >
              <option value="">新建或手动填写</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} · {preset.model} · {preset.voice}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onNewPreset}
            className="justify-self-start rounded-full border border-[#77d898]/20 bg-[#77d898]/8 px-3 py-1.5 text-xs text-[#a8f0b6]"
          >
            清空，新建 TTS 预设
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              预设名
              <input
                value={name}
                placeholder="例如：Mimo 默认声音"
                onChange={(event) => onNameChange(event.target.value)}
                className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              TTS 模型
              <input
                value={model}
                placeholder={DEFAULT_CUSTOM_TTS_MODEL}
                onChange={(event) => onModelChange(event.target.value)}
                className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            TTS Base URL
            <input
              value={baseUrl}
              placeholder={DEFAULT_CUSTOM_TTS_BASE_URL}
              onChange={(event) => onBaseUrlChange(event.target.value)}
              className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              Voice ID
              <input
                value={voice}
                placeholder="mimo_default"
                onChange={(event) => onVoiceChange(event.target.value)}
                className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              音频格式
              <input
                value={format}
                placeholder={DEFAULT_CUSTOM_TTS_FORMAT}
                onChange={(event) => onFormatChange(event.target.value)}
                className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            TTS API Key
            <input
              type="password"
              value={apiKey}
              placeholder="仅保存在本机浏览器"
              onChange={(event) => onApiKeyChange(event.target.value)}
              className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
            />
          </label>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            鉴权 Header
            <input
              value={authHeader}
              placeholder="Authorization"
              onChange={(event) => onAuthHeaderChange(event.target.value)}
              className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
            />
          </label>
          {error && <div className="rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSave} className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white">
              保存 TTS 预设
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={!selectedPresetId}
              className="rounded-full border border-[#e46d55]/25 bg-[#2b1110]/50 px-4 py-2 text-xs font-semibold text-[#ffb1a4] disabled:opacity-45"
            >
              删除预设
            </button>
          </div>
          <p className="text-[11px] leading-5 text-[#ad9c7d]">补齐配置只会修改当前阵容里还没有自定义 TTS 的 AI；覆盖配置会替换当前阵容全部 AI 的 TTS 设置。</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApplyFillBlanks}
              disabled={selectedCount === 0}
              className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/55 px-4 py-2 text-xs font-semibold text-[#a8f0b6] disabled:opacity-45"
            >
              补齐当前阵容未配置 AI
            </button>
            <button
              type="button"
              onClick={onApplyOverwrite}
              disabled={selectedCount === 0}
              className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
            >
              覆盖当前阵容全部 AI
            </button>
          </div>
          {results.length > 0 && (
            <div className="mobile-ai-bulk-tts-results grid gap-2 rounded-2xl border border-[#77d898]/14 bg-black/18 p-3">
              {results.map((result) => (
                <div key={`${result.friendId}:${result.nextFriendId ?? result.friendId}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-[#f7ead5]">{result.friendName}</span>
                  <span className="shrink-0 text-[#a8f0b6]">
                    {result.status === "filled" ? "已补齐 TTS" : result.status === "overwritten" ? "已覆盖 TTS" : "已有 TTS，已跳过"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AiPoolList({
  friends,
  allFriends,
  allFriendCount,
  filter,
  aiRuntimeConfig,
  aiLlmSecrets,
  selectedIds,
  selectedCount,
  bulkLlmOpen,
  llmPresets,
  bulkLlmSelectedPresetId,
  bulkLlmName,
  bulkLlmBaseUrl,
  bulkLlmModel,
  bulkLlmApiKey,
  bulkLlmMergeSystemIntoUser,
  bulkLlmError,
  bulkLlmTestStatus,
  bulkLlmResults,
  bulkTtsOpen,
  ttsPresets,
  bulkTtsSelectedPresetId,
  bulkTtsName,
  bulkTtsBaseUrl,
  bulkTtsModel,
  bulkTtsVoice,
  bulkTtsApiKey,
  bulkTtsFormat,
  bulkTtsAuthHeader,
  bulkTtsError,
  bulkTtsResults,
  onFilterChange,
  onToggle,
  onCopy,
  onProfileSave,
  onAvatarUpload,
  onClearAvatar,
  onSaveLlmConfig,
  onSaveTtsConfig,
  onSelectOrdinaryPlayerType,
  onRefreshStrategy,
  onDelete,
  onBulkLlmOpenChange,
  onLlmPresetSelect,
  onNewLlmPreset,
  onBulkLlmNameChange,
  onBulkLlmBaseUrlChange,
  onBulkLlmModelChange,
  onBulkLlmApiKeyChange,
  onBulkLlmMergeSystemIntoUserChange,
  onSaveLlmPreset,
  onDeleteLlmPreset,
  onTestLlmPreset,
  onApplyLlmFillBlanks,
  onApplyLlmOverwrite,
  onCopyFriendLlmFillBlanks,
  onCopyFriendLlmOverwrite,
  onBulkTtsOpenChange,
  onTtsPresetSelect,
  onNewTtsPreset,
  onBulkTtsNameChange,
  onBulkTtsBaseUrlChange,
  onBulkTtsModelChange,
  onBulkTtsVoiceChange,
  onBulkTtsApiKeyChange,
  onBulkTtsFormatChange,
  onBulkTtsAuthHeaderChange,
  onSaveTtsPreset,
  onDeleteTtsPreset,
  onApplyTtsFillBlanks,
  onApplyTtsOverwrite,
  onCopyFriendTtsFillBlanks,
  onCopyFriendTtsOverwrite,
}: {
  friends: AiFriendOption[];
  allFriends: AiFriendOption[];
  allFriendCount: number;
  filter: AiPoolFilterId;
  aiRuntimeConfig: AiRuntimeConfig | null;
  aiLlmSecrets: AiFriendLlmSecretMap;
  selectedIds: string[];
  selectedCount: number;
  bulkLlmOpen: boolean;
  llmPresets: AiFriendLlmPreset[];
  bulkLlmSelectedPresetId: string;
  bulkLlmName: string;
  bulkLlmBaseUrl: string;
  bulkLlmModel: string;
  bulkLlmApiKey: string;
  bulkLlmMergeSystemIntoUser: boolean;
  bulkLlmError: string | null;
  bulkLlmTestStatus: string | null;
  bulkLlmResults: AiFriendLlmPresetApplyResult[];
  bulkTtsOpen: boolean;
  ttsPresets: AiFriendTtsPreset[];
  bulkTtsSelectedPresetId: string;
  bulkTtsName: string;
  bulkTtsBaseUrl: string;
  bulkTtsModel: string;
  bulkTtsVoice: string;
  bulkTtsApiKey: string;
  bulkTtsFormat: string;
  bulkTtsAuthHeader: string;
  bulkTtsError: string | null;
  bulkTtsResults: AiFriendTtsPresetApplyResult[];
  onFilterChange: (filter: AiPoolFilterId) => void;
  onToggle: (friendId: string) => void;
  onCopy: (friendId: string) => void;
  onProfileSave: (friend: AiFriendOption, nickname: string) => void;
  onAvatarUpload: (friend: AiFriendOption, file: File) => void;
  onClearAvatar: (friend: AiFriendOption) => void;
  onSaveLlmConfig: (friend: AiFriendOption, llmConfig: AiFriendLlmConfig, apiKey: string) => void;
  onSaveTtsConfig: (friend: AiFriendOption, ttsConfig: AiFriendTtsConfig, apiKey: string) => void;
  onSelectOrdinaryPlayerType: (friend: AiFriendOption, typeId: AiOrdinaryPlayerTypeId) => void;
  onRefreshStrategy: (friend: AiFriendOption) => void;
  onDelete: (friendId: string) => void;
  onBulkLlmOpenChange: (open: boolean) => void;
  onLlmPresetSelect: (preset: AiFriendLlmPreset) => void;
  onNewLlmPreset: () => void;
  onBulkLlmNameChange: (value: string) => void;
  onBulkLlmBaseUrlChange: (value: string) => void;
  onBulkLlmModelChange: (value: string) => void;
  onBulkLlmApiKeyChange: (value: string) => void;
  onBulkLlmMergeSystemIntoUserChange: (value: boolean) => void;
  onSaveLlmPreset: () => void;
  onDeleteLlmPreset: () => void;
  onTestLlmPreset: () => void;
  onApplyLlmFillBlanks: () => void;
  onApplyLlmOverwrite: () => void;
  onCopyFriendLlmFillBlanks: (friend: AiFriendOption) => void;
  onCopyFriendLlmOverwrite: (friend: AiFriendOption) => void;
  onBulkTtsOpenChange: (open: boolean) => void;
  onTtsPresetSelect: (preset: AiFriendTtsPreset) => void;
  onNewTtsPreset: () => void;
  onBulkTtsNameChange: (value: string) => void;
  onBulkTtsBaseUrlChange: (value: string) => void;
  onBulkTtsModelChange: (value: string) => void;
  onBulkTtsVoiceChange: (value: string) => void;
  onBulkTtsApiKeyChange: (value: string) => void;
  onBulkTtsFormatChange: (value: string) => void;
  onBulkTtsAuthHeaderChange: (value: string) => void;
  onSaveTtsPreset: () => void;
  onDeleteTtsPreset: () => void;
  onApplyTtsFillBlanks: () => void;
  onApplyTtsOverwrite: () => void;
  onCopyFriendTtsFillBlanks: (friend: AiFriendOption) => void;
  onCopyFriendTtsOverwrite: (friend: AiFriendOption) => void;
}) {
  const [activeEditSections, setActiveEditSections] = useState<Record<string, AiEditSection>>({});
  const [mobileView, setMobileView] = useState<AiMobilePoolView>("overview");
  const [mobileSearchTerm, setMobileSearchTerm] = useState("");
  const [mobileFocusedFriendId, setMobileFocusedFriendId] = useState("");
  const [mobileEditor, setMobileEditor] = useState<{ friendId: string; section: AiEditSection } | null>(null);

  const setFriendEditSection = useCallback((friendId: string, section: AiEditSection) => {
    setActiveEditSections((current) => ({
      ...current,
      [friendId]: section,
    }));
  }, []);

  const openFriendEditor = useCallback(
    (friend: AiFriendOption, section: AiEditSection) => {
      const editStateKey = getAiFriendEditStateKey(friend);
      setMobileFocusedFriendId(friend.id);
      setFriendEditSection(editStateKey, section);
      if (isPhoneAiPoolViewport()) {
        setMobileEditor({ friendId: friend.id, section });
        return;
      }
      if (typeof document === "undefined") return;

      const editors = Array.from(document.querySelectorAll<HTMLDetailsElement>("[data-ai-friend-editor]"));
      const editor = editors.find((node) => node.dataset.aiFriendEditor === editStateKey);
      editor?.setAttribute("open", "true");
    },
    [setFriendEditSection],
  );

  const setMobileEditorSection = useCallback(
    (friend: AiFriendOption, section: AiEditSection) => {
      setMobileFocusedFriendId(friend.id);
      setFriendEditSection(getAiFriendEditStateKey(friend), section);
      setMobileEditor({ friendId: friend.id, section });
    },
    [setFriendEditSection],
  );

  const keepEditorOnSavedFriend = useCallback((friend: AiFriendOption) => {
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    setMobileFocusedFriendId(targetId);
    setMobileEditor((current) => (current?.friendId === friend.id ? { ...current, friendId: targetId } : current));
  }, []);

  const saveProfileFromEditor = useCallback(
    (friend: AiFriendOption, nickname: string) => {
      onProfileSave(friend, nickname);
      keepEditorOnSavedFriend(friend);
    },
    [keepEditorOnSavedFriend, onProfileSave],
  );

  const uploadAvatarFromEditor = useCallback(
    (friend: AiFriendOption, file: File) => {
      onAvatarUpload(friend, file);
      keepEditorOnSavedFriend(friend);
    },
    [keepEditorOnSavedFriend, onAvatarUpload],
  );

  const visibleFriends = useMemo(() => {
    const query = mobileSearchTerm.trim().toLowerCase();
    if (!query) return friends;

    return friends.filter((friend) =>
      [
        friend.nickname,
        friend.basePersonaName,
        friend.basePersonaLabel,
        friend.basePersonaModelLabel,
        friend.ordinaryPlayerTypeLabel,
        friend.ordinaryPlayerTypeSummary,
        friend.strategySummary,
        formatLlmStatus(aiRuntimeConfig, friend),
        formatTtsStatus(aiRuntimeConfig, friend),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [aiRuntimeConfig, friends, mobileSearchTerm]);

  const allFriendsById = useMemo(() => new Map(allFriends.map((friend) => [friend.id, friend])), [allFriends]);
  const mobileLineupFriends = useMemo(
    () => selectedIds.map((id) => allFriendsById.get(id)).filter((friend): friend is AiFriendOption => Boolean(friend)),
    [allFriendsById, selectedIds],
  );
  const mobileFocusedFriend =
    allFriendsById.get(mobileFocusedFriendId) ?? mobileLineupFriends[0] ?? visibleFriends[0] ?? allFriends[0] ?? null;
  const mobileDisplayedFriends = mobileView === "overview" ? visibleFriends : [];
  const mobileFocusedEditStateKey = mobileFocusedFriend ? getAiFriendEditStateKey(mobileFocusedFriend) : "";
  const mobileFocusedEditSection = mobileFocusedEditStateKey
    ? (activeEditSections[mobileFocusedEditStateKey] ?? "overview")
    : "overview";
  const mobileFocusedProfile = mobileFocusedFriend ? sanitizeOrdinaryPlayerProfile(mobileFocusedFriend.ordinaryPlayerProfile) : null;
  const mobileEditorFriend = mobileEditor ? (allFriendsById.get(mobileEditor.friendId) ?? mobileFocusedFriend) : null;
  const mobileEditorEditStateKey = mobileEditorFriend ? getAiFriendEditStateKey(mobileEditorFriend) : "";
  const mobileEditorSection = mobileEditorFriend
    ? (activeEditSections[mobileEditorEditStateKey] ?? mobileEditor?.section ?? "overview")
    : "overview";
  const mobileLineupSlotCount = Math.max(8, mobileLineupFriends.length);

  return (
    <section
      className="mobile-ai-pool-list rounded-[28px] border border-[#77d898]/20 bg-[#0f2118]/76 p-4 shadow-2xl shadow-black/35 sm:p-5"
      data-mobile-ai-view={mobileView}
    >
      <div className="mobile-ai-pool-list-head mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#dff4df]">AI角色库</h2>
          <p className="mobile-ai-pool-description mt-1 text-sm text-[#9fc8a7]">
            按人格打法挑选本局 AI；模型和声音只作为状态标签，完整接入配置放在编辑弹窗里。
          </p>
        </div>
        <span className="mobile-ai-save-pill rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-3 py-1 text-xs text-[#a8f0b6]">
          {friends.length}/{allFriendCount} · 本地保存
        </span>
      </div>

      <div className="mobile-ai-view-switch" aria-label="AI池移动端视图">
        {AI_MOBILE_POOL_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mobileView === item.id}
            onClick={() => setMobileView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mobile-ai-overview-tools">
        <label className="mobile-ai-search-field">
          <span className="sr-only">搜索AI角色</span>
          <input
            type="search"
            value={mobileSearchTerm}
            onChange={(event) => setMobileSearchTerm(event.currentTarget.value)}
            placeholder="搜索AI/模型/打法"
          />
        </label>
        <button type="button" className="mobile-ai-config-shortcut" onClick={() => setMobileView("config")}>
          批量配置
        </button>
      </div>

      <div className="mobile-ai-lineup-rail" aria-label="本局AI阵容总览">
        <div className="mobile-ai-lineup-summary">
          <span>本局阵容</span>
          <strong>{mobileLineupFriends.length}/8</strong>
        </div>
        <div className="mobile-ai-lineup-slots">
          {Array.from({ length: mobileLineupSlotCount }).map((_, index) => {
            const friend = mobileLineupFriends[index];
            const focused = Boolean(friend && mobileFocusedFriend?.id === friend.id);
            return (
              <button
                key={friend?.id ?? `empty-slot-${index}`}
                type="button"
                disabled={!friend}
                aria-label={friend ? `查看 ${friend.nickname}` : `空阵位 ${index + 1}`}
                aria-pressed={focused}
                onClick={() => {
                  if (!friend) return;
                  setMobileFocusedFriendId(friend.id);
                }}
              >
                <span className="mobile-ai-lineup-index">{index + 1}</span>
                {friend ? (
                  <AiFriendAvatar friend={friend} size="small" className="mobile-ai-lineup-avatar" />
                ) : (
                  <span className="mobile-ai-lineup-empty">+</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ai-pool-filter-bar mb-4 flex flex-wrap gap-2">
        {AI_POOL_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            aria-pressed={filter === item.id}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === item.id
                ? "border-[#f1c76e]/44 bg-[#f1c76e]/14 text-[#f8dfab]"
                : "border-[#f1c76e]/14 bg-black/14 text-[#dcc9a7] hover:border-[#f1c76e]/32",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mobile-ai-lineup-board" aria-label="当前阵容列表">
        <div className="mobile-ai-mode-panel-head">
          <div>
            <span>当前阵容</span>
            <strong>{mobileLineupFriends.length} 位已入队</strong>
          </div>
          <button type="button" onClick={() => setMobileView("overview")}>继续挑选</button>
        </div>
        <div className="mobile-ai-lineup-list">
          {mobileLineupFriends.map((friend, index) => {
            const focused = mobileFocusedFriend?.id === friend.id;
            return (
              <article key={friend.id} className={focused ? "mobile-ai-lineup-row mobile-ai-lineup-row-active" : "mobile-ai-lineup-row"}>
                <button type="button" className="mobile-ai-lineup-row-main" onClick={() => setMobileFocusedFriendId(friend.id)} aria-pressed={focused}>
                  <span className="mobile-ai-lineup-row-index">{index + 1}</span>
                  <AiFriendAvatar friend={friend} size="small" />
                  <span className="mobile-ai-lineup-row-text">
                    <strong>{friend.nickname}</strong>
                    <small>{friend.ordinaryPlayerTypeLabel} · {formatLlmStatus(aiRuntimeConfig, friend)}</small>
                  </span>
                </button>
                <button type="button" className="mobile-ai-lineup-row-remove" onClick={() => onToggle(friend.id)}>移出</button>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mobile-ai-config-board" aria-label="移动端配置角色列表">
        <div className="mobile-ai-mode-panel-head">
          <div>
            <span>配置页</span>
            <strong>{mobileFocusedFriend ? mobileFocusedFriend.nickname : "未选择角色"}</strong>
          </div>
          <button type="button" onClick={() => mobileFocusedFriend && openFriendEditor(mobileFocusedFriend, mobileFocusedEditSection)}>
            打开编辑
          </button>
        </div>
        <div className="mobile-ai-config-role-list">
          {(mobileLineupFriends.length ? mobileLineupFriends : visibleFriends).map((friend) => {
            const focused = mobileFocusedFriend?.id === friend.id;
            return (
              <button
                key={friend.id}
                type="button"
                className={focused ? "mobile-ai-config-role mobile-ai-config-role-active" : "mobile-ai-config-role"}
                aria-pressed={focused}
                onClick={() => setMobileFocusedFriendId(friend.id)}
              >
                <AiFriendAvatar friend={friend} size="small" />
                <span>
                  <strong>{friend.nickname}</strong>
                  <small>LLM · {formatLlmStatus(aiRuntimeConfig, friend)}</small>
                  <small>TTS · {formatTtsStatus(aiRuntimeConfig, friend)}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mobile-ai-pool-grid ai-pool-card-grid grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {mobileDisplayedFriends.map((friend) => {
          const editStateKey = getAiFriendEditStateKey(friend);
          const selected = selectedIds.includes(friend.id);
          const hasCustomAvatar = Boolean(friend.avatarDataUrl);
          const llmRoute = getLlmRoute(aiRuntimeConfig, friend);
          const ttsProfile = getTtsProfile(aiRuntimeConfig, friend);
          const currentTtsVoice = friend.ttsConfig?.voice ?? friend.ttsVoice ?? ttsProfile?.resolvedVoice ?? "跟随默认";
          const personalityTags = Array.from(
            new Set([
              friend.basePersonaLabel,
              friend.ordinaryPlayerTypeLabel,
              ...(friend.roleCard?.styleTags ?? []),
            ]),
          ).slice(0, 5);
          const llmSummaryRows = [
            ["预设", friend.llmConfig?.label ?? friend.basePersonaName],
            ["Base URL", friend.llmConfig?.baseUrl ?? (llmRoute ? "跟随全局路由" : "未检测")],
            ["模型名称", friend.llmConfig?.model ?? llmRoute?.model ?? friend.basePersonaModelLabel ?? "未检测"],
            ["API Key", friend.llmConfig ? customLlmKeyState(aiLlmSecrets[friend.id]?.apiKey) : llmAvailabilityLabel(llmRoute)],
            ["合并系统提示", friend.llmConfig?.mergeSystemIntoUser ? "已开启" : "默认关闭"],
          ] as const;
          const ttsSummaryRows = [
            ["声音", friend.ttsConfig?.label ? `${friend.ttsConfig.label} · ${currentTtsVoice}` : currentTtsVoice],
            ["TTS Base URL", friend.ttsConfig?.baseUrl ?? (aiRuntimeConfig?.tts.available ? "跟随默认服务" : "未启用")],
            ["TTS 模型", friend.ttsConfig?.model ?? aiRuntimeConfig?.tts.model ?? DEFAULT_CUSTOM_TTS_MODEL],
            ["音频格式", friend.ttsConfig?.format ?? aiRuntimeConfig?.tts.format ?? DEFAULT_CUSTOM_TTS_FORMAT],
            ["API Key", friend.ttsConfig ? customTtsKeyState(aiLlmSecrets[friend.id]?.ttsApiKey) : ttsAvailabilityLabel(aiRuntimeConfig)],
          ] as const;
          const activeEditSection = activeEditSections[editStateKey] ?? "overview";
          return (
            <article
              key={editStateKey}
              className={[
                "mobile-ai-pool-card overflow-hidden rounded-2xl border transition",
                selected ? "border-[#77d898]/42 bg-[#10261a]/82" : "border-[#f1c76e]/14 bg-black/20",
                mobileFocusedFriend?.id === friend.id ? "mobile-ai-card-focused" : "",
              ].join(" ")}
            >
              <details className="mobile-ai-card-config mobile-ai-profile-card" data-ai-friend-editor={editStateKey}>
                <summary
                  className="mobile-ai-profile-summary cursor-pointer list-none p-3"
                  onClick={(event) => {
                    setMobileFocusedFriendId(friend.id);
                    if (isPhoneAiPoolViewport()) {
                      event.preventDefault();
                    }
                  }}
                >
                  <div className="mobile-ai-card-main ai-pool-character-card grid gap-3">
                    <div className="flex items-start gap-3">
                      <AiFriendAvatar friend={friend} size="large" />
                      <div className="mobile-ai-card-info min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="mobile-ai-card-name min-w-0 truncate font-semibold text-[#f7ead5]">{friend.nickname}</span>
                          <span className="mobile-ai-card-type shrink-0 rounded-full border border-[#77d898]/18 bg-[#0f2118]/44 px-2 py-0.5 text-[11px] text-[#a8f0b6]">
                            {selected ? "已入队" : "可加入"}
                          </span>
                        </div>
                        <div className="mobile-ai-card-persona mt-1 truncate text-xs text-[#ad9c7d]">{friend.ordinaryPlayerTypeLabel}</div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#dcc9a7]/76">{friend.ordinaryPlayerTypeSummary}</p>
                      </div>
                    </div>
                    <div className="mobile-ai-card-tags mobile-ai-summary-meta flex flex-wrap items-center gap-1.5">
                      <span className="mobile-ai-card-template rounded-full border border-[#f1c76e]/20 px-2 py-0.5 text-[11px] text-[#f1d796]">
                        {friend.basePersonaLabel}
                      </span>
                      <span className="mobile-ai-card-model max-w-[190px] truncate rounded-full border border-[#7da8e3]/20 bg-[#0d1623]/55 px-2 py-0.5 text-[11px] text-[#b8d6ff]" title={formatLlmStatus(aiRuntimeConfig, friend)}>
                        {formatLlmStatus(aiRuntimeConfig, friend)}
                      </span>
                      <span className="mobile-ai-card-voice max-w-[190px] truncate rounded-full border border-[#77d898]/18 bg-[#0f2118]/55 px-2 py-0.5 text-[11px] text-[#a8f0b6]" title={`发言声音：${formatTtsStatus(aiRuntimeConfig, friend)}`}>
                        声音 · {formatTtsStatus(aiRuntimeConfig, friend)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          setMobileFocusedFriendId(friend.id);
                          onToggle(friend.id);
                        }}
                        className={[
                          "rounded-full px-3 py-2 text-xs font-semibold transition",
                          selected
                            ? "border border-[#77d898]/28 bg-[#153c28] text-[#a8f0b6]"
                            : "border border-[#f1c76e]/26 bg-[#f1c76e]/10 text-[#f1d796] hover:bg-[#f1c76e]/16",
                        ].join(" ")}
                      >
                        {selected ? "移出阵容" : "加入阵容"}
                      </button>
                      <span className="mobile-ai-config-entry shrink-0 rounded-full border border-[#f1c76e]/24 bg-black/18 px-3 py-2 text-xs font-semibold text-[#f1d796]">
                        编辑
                      </span>
                    </div>
                  </div>
                </summary>

                <div className="mobile-ai-profile-panel ai-edit-modal border-t border-white/10 p-3" role="dialog" aria-modal="true" aria-label={`${friend.nickname}编辑AI`}>
                  <div className="mobile-ai-config-overlay-head ai-edit-header mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-[#f7ead5]">编辑 AI：{friend.nickname}</div>
                      <div className="mt-0.5 truncate text-xs text-[#ad9c7d]">左侧调整角色身份感，右侧管理 LLM、TTS 和批量预设。</div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                      className="ai-edit-close rounded-full border border-[#f1c76e]/24 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
                      aria-label="关闭编辑弹窗"
                    >
                      ×
                    </button>
                  </div>
                  <div className="ai-edit-tabs mb-3 flex flex-wrap gap-2" aria-label="编辑区域">
                    {AI_EDIT_SECTIONS.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setFriendEditSection(editStateKey, item.id)}
                        aria-pressed={activeEditSection === item.id}
                        className={[
                          "border px-3 py-1.5 text-xs font-semibold transition",
                          activeEditSection === item.id
                            ? "border-[#f1c76e]/44 bg-[#f1c76e]/14 text-[#f8dfab]"
                            : "border-white/10 bg-black/16 text-[#dcc9a7] hover:border-[#f1c76e]/28 hover:text-[#f8dfab]",
                        ].join(" ")}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="ai-edit-layout grid gap-4">
                    <aside className="ai-edit-preview ai-edit-profile-card rounded-2xl border border-[#f1c76e]/18 bg-[#130d0b]/72 p-3">
                      <div className="ai-edit-profile-portrait">
                        <AiFriendAvatar friend={friend} size="large" className="ai-edit-profile-avatar" />
                        <label className="ai-edit-avatar-edit cursor-pointer">
                          {hasCustomAvatar ? "更换" : "头像"}
                          <input
                            type="file"
                            accept={AI_FRIEND_AVATAR_ACCEPT}
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = "";
                              if (file) onAvatarUpload(friend, file);
                            }}
                          />
                        </label>
                      </div>
                      <div className="ai-edit-profile-name-row mt-3">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold text-[#f7ead5]">{friend.nickname}</div>
                          <div className="mt-1 text-xs text-[#dcc9a7]/72">{friend.isDefault ? "内置 AI" : "自定义 AI"}</div>
                        </div>
                        <span className="ai-edit-pencil" aria-hidden="true">✎</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="ai-edit-status-pill ai-edit-status-gold">{friend.basePersonaLabel}</span>
                        <span className="ai-edit-status-pill ai-edit-status-green">{selected ? "已入队" : "可加入"}</span>
                      </div>
                      <div className="ai-edit-side-field mt-3">
                        <span>LLM 模型</span>
                        <strong title={formatLlmStatus(aiRuntimeConfig, friend)}>{formatLlmStatus(aiRuntimeConfig, friend)}</strong>
                      </div>
                      <div className="ai-edit-side-field">
                        <span>发言声音</span>
                        <strong title={formatTtsStatus(aiRuntimeConfig, friend)}>{currentTtsVoice}</strong>
                        <button type="button" onClick={() => setFriendEditSection(editStateKey, "tts")}>配置</button>
                      </div>
                      <div className="ai-edit-tag-cloud mt-3">
                        {personalityTags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <section className="ai-edit-side-strategy mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>策略卡预览</span>
                          <button
                            type="button"
                            onClick={() => onRefreshStrategy(friend)}
                            disabled={friend.isDefault}
                            title={friend.isDefault ? "内置 AI 的策略卡随模板自动生成" : "按当前昵称、模型人格和角色卡重新推导策略摘要"}
                          >
                            刷新策略卡
                          </button>
                        </div>
                        <p>{friend.strategySummary}</p>
                      </section>
                      <div className="ai-edit-side-actions mt-3">
                        <button type="button" onClick={() => onToggle(friend.id)}>
                          {selected ? "从阵容移出" : "加入本局阵容"}
                        </button>
                        <button type="button" onClick={() => onCopy(friend.id)}>复制为自定义</button>
                        {hasCustomAvatar && <button type="button" onClick={() => onClearAvatar(friend)}>移除头像</button>}
                        {!friend.isDefault && <button type="button" onClick={() => onDelete(friend.id)}>删除</button>}
                      </div>
                    </aside>
                    <div className="ai-edit-content grid gap-4" data-ai-active-edit-section={activeEditSection}>
                      <section className="ai-edit-work-panel ai-edit-overview-panel" data-ai-edit-section="overview" hidden={activeEditSection !== "overview"}>
                        <h3>配置总览</h3>
                        <div className="ai-edit-overview-grid">
                          <article className="ai-edit-overview-card">
                            <span className="ai-edit-overview-icon ai-edit-overview-icon-llm" aria-hidden="true">◈</span>
                            <div>
                              <div className="ai-edit-overview-label">LLM 模型</div>
                              <strong title={formatLlmStatus(aiRuntimeConfig, friend)}>{formatLlmStatus(aiRuntimeConfig, friend)}</strong>
                              <p>{friend.llmConfig ? "自定义接入 · 已保存到本机" : "跟随当前运行时路由"}</p>
                            </div>
                          </article>
                          <article className="ai-edit-overview-card">
                            <span className="ai-edit-overview-icon ai-edit-overview-icon-tts" aria-hidden="true">≋</span>
                            <div>
                              <div className="ai-edit-overview-label">TTS 声音</div>
                              <strong title={formatTtsStatus(aiRuntimeConfig, friend)}>{currentTtsVoice}</strong>
                              <p>{friend.ttsConfig ? `${friend.ttsConfig.model} · ${friend.ttsConfig.format ?? DEFAULT_CUSTOM_TTS_FORMAT}` : formatTtsStatus(aiRuntimeConfig, friend)}</p>
                            </div>
                          </article>
                        </div>
                      </section>

                      <section className="ai-edit-work-panel" data-ai-edit-section="overview-actions" hidden={activeEditSection !== "overview"}>
                        <h3>快速操作</h3>
                        <div className="ai-edit-action-grid">
                          <button
                            type="button"
                            disabled={!friend.llmConfig && !friend.ttsConfig}
                            onClick={() => {
                              if (friend.llmConfig) onCopyFriendLlmFillBlanks(friend);
                              if (friend.ttsConfig) onCopyFriendTtsFillBlanks(friend);
                            }}
                          >
                            <span>复制此 AI 的配置</span>
                            <small>复制到当前阵容其他 AI 的空白项</small>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onBulkLlmOpenChange(true);
                              onBulkTtsOpenChange(true);
                              setFriendEditSection(editStateKey, "bulk");
                            }}
                          >
                            <span>保存为预设</span>
                            <small>在批量配置里保存 LLM/TTS 预设</small>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onBulkLlmOpenChange(true);
                              onBulkTtsOpenChange(true);
                              setFriendEditSection(editStateKey, "bulk");
                            }}
                          >
                            <span>应用预设到当前阵容</span>
                            <small>快速批量应用配置</small>
                          </button>
                        </div>
                      </section>

                      <section className="ai-edit-work-panel" data-ai-edit-section="overview-summary" hidden={activeEditSection !== "overview"}>
                        <h3>配置摘要</h3>
                        <div className="ai-config-summary-grid">
                          <article className="ai-config-summary-card">
                            <h4>LLM 配置</h4>
                            {llmSummaryRows.map(([label, value]) => (
                              <div key={label} className="ai-config-row">
                                <span>{label}</span>
                                <strong title={value}>{value}</strong>
                              </div>
                            ))}
                            <button type="button" onClick={() => setFriendEditSection(editStateKey, "llm")}>前往 LLM 配置</button>
                          </article>
                          <article className="ai-config-summary-card">
                            <h4>TTS 配置</h4>
                            {ttsSummaryRows.map(([label, value]) => (
                              <div key={label} className="ai-config-row">
                                <span>{label}</span>
                                <strong title={value}>{value}</strong>
                              </div>
                            ))}
                            <button type="button" onClick={() => setFriendEditSection(editStateKey, "tts")}>前往 TTS 配置</button>
                          </article>
                        </div>
                      </section>

                      <div className="mobile-ai-config-stack grid gap-3">
                        <section className="ai-edit-detail-panel ai-edit-role-panel" data-ai-edit-section="role" hidden={activeEditSection !== "role"}>
                          <div className="ai-edit-detail-head">
                            <div>
                              <h3>角色信息</h3>
                              <p>头像、身份感、发言方式和普通局打法集中在这里调整。</p>
                            </div>
                            <span>{friend.ordinaryPlayerTypeLabel}</span>
                          </div>
                          <AiProfileIdentityForm
                            friend={friend}
                            onProfileSave={saveProfileFromEditor}
                            onAvatarUpload={uploadAvatarFromEditor}
                            onClearAvatar={onClearAvatar}
                          />
                          <div className="ai-role-info-grid">
                            <article>
                              <span>角色底稿</span>
                              <strong>{friend.roleCard?.displayName ?? friend.basePersonaLabel}</strong>
                              <p>{friend.roleCard?.theme ?? friend.ordinaryPlayerTypeSummary}</p>
                            </article>
                            <article>
                              <span>说话风格</span>
                              <strong>{friend.roleCard?.speechStyleZh ?? friend.ordinaryPlayerTypeLabel}</strong>
                              <p>{friend.roleCard?.catchphrasePolicy ?? friend.ordinaryPlayerTypeSummary}</p>
                            </article>
                            <article>
                              <span>推理偏好</span>
                              <strong>{friend.roleCard?.reasoningBias ?? "按公开事实推进"}</strong>
                              <p>{friend.strategySummary}</p>
                            </article>
                          </div>
                          <div className="ai-edit-advanced-details ai-edit-role-tuning mt-3">
                            <OrdinaryPlayerTypePanel friend={friend} onSelectType={onSelectOrdinaryPlayerType} />
                          </div>
                        </section>
                        <section className="mobile-ai-config-section ai-edit-config-details rounded-2xl border border-[#7da8e3]/14 bg-[#0d1623]/42 p-3" data-ai-edit-section="llm" hidden={activeEditSection !== "llm"}>
                          <div className="ai-edit-detail-head">
                            <div>
                              <h3>LLM配置</h3>
                              <p>配置该 AI 的模型路由、Base URL、模型名称、API Key 和系统提示合并方式。</p>
                            </div>
                            <span title={formatLlmStatus(aiRuntimeConfig, friend)}>{formatLlmStatus(aiRuntimeConfig, friend)}</span>
                          </div>
                          <div className="mt-3">
                            <AiCardModelConfig
                              key={`${friend.id}:${friend.llmConfig?.baseUrl ?? ""}:${friend.llmConfig?.model ?? ""}:${aiLlmSecrets[friend.id]?.apiKey ?? ""}`}
                              friend={friend}
                              aiRuntimeConfig={aiRuntimeConfig}
                              apiKey={aiLlmSecrets[friend.id]?.apiKey ?? ""}
                              onSave={onSaveLlmConfig}
                            />
                          </div>
                        </section>
                        <section className="mobile-ai-config-section ai-edit-config-details rounded-2xl border border-[#77d898]/14 bg-[#0f2118]/42 p-3" data-ai-edit-section="tts" hidden={activeEditSection !== "tts"}>
                          <div className="ai-edit-detail-head">
                            <div>
                              <h3>TTS配置</h3>
                              <p>配置该 AI 的发言声音、TTS Base URL、模型、Voice ID、音频格式和鉴权信息。</p>
                            </div>
                            <span title={formatTtsStatus(aiRuntimeConfig, friend)}>{formatTtsStatus(aiRuntimeConfig, friend)}</span>
                          </div>
                          <div className="mt-3">
                            <AiCardTtsConfig
                              key={`${friend.id}:tts:${friend.ttsConfig?.baseUrl ?? ""}:${friend.ttsConfig?.model ?? ""}:${friend.ttsConfig?.voice ?? friend.ttsVoice ?? ""}:${aiLlmSecrets[friend.id]?.ttsApiKey ?? ""}`}
                              friend={friend}
                              aiRuntimeConfig={aiRuntimeConfig}
                              apiKey={aiLlmSecrets[friend.id]?.ttsApiKey ?? ""}
                              onSave={onSaveTtsConfig}
                            />
                          </div>
                        </section>
                        <section className="ai-bulk-config-panel rounded-2xl border border-[#f1c76e]/16 bg-[#160f0b]/58 p-3" data-ai-edit-section="bulk" hidden={activeEditSection !== "bulk"}>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold text-[#f1d796]">批量配置</div>
                              <p className="mt-1 text-[11px] leading-4 text-[#dcc9a7]/72">
                                当前阵容 {selectedCount} 位 AI，可用预设批量铺配置，也可从当前 AI 复制。
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onCopyFriendLlmFillBlanks(friend)}
                                className="rounded-full border border-[#7da8e3]/22 bg-[#0d1623]/55 px-3 py-1.5 text-xs font-semibold text-[#b8d6ff]"
                              >
                                复制此 AI 的 LLM 到未配置
                              </button>
                              <button
                                type="button"
                                onClick={() => onCopyFriendTtsFillBlanks(friend)}
                                className="rounded-full border border-[#77d898]/22 bg-[#0f2118]/55 px-3 py-1.5 text-xs font-semibold text-[#a8f0b6]"
                              >
                                复制此 AI 的 TTS 到未配置
                              </button>
                            </div>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <BulkLlmPresetCard
                              open={bulkLlmOpen}
                              presets={llmPresets}
                              selectedPresetId={bulkLlmSelectedPresetId}
                              selectedCount={selectedCount}
                              name={bulkLlmName}
                              baseUrl={bulkLlmBaseUrl}
                              model={bulkLlmModel}
                              apiKey={bulkLlmApiKey}
                              mergeSystemIntoUser={bulkLlmMergeSystemIntoUser}
                              error={bulkLlmError}
                              testStatus={bulkLlmTestStatus}
                              results={bulkLlmResults}
                              onOpenChange={onBulkLlmOpenChange}
                              onPresetSelect={onLlmPresetSelect}
                              onNewPreset={onNewLlmPreset}
                              onNameChange={onBulkLlmNameChange}
                              onBaseUrlChange={onBulkLlmBaseUrlChange}
                              onModelChange={onBulkLlmModelChange}
                              onApiKeyChange={onBulkLlmApiKeyChange}
                              onMergeSystemIntoUserChange={onBulkLlmMergeSystemIntoUserChange}
                              onSave={onSaveLlmPreset}
                              onDelete={onDeleteLlmPreset}
                              onTest={onTestLlmPreset}
                              onApplyFillBlanks={onApplyLlmFillBlanks}
                              onApplyOverwrite={onApplyLlmOverwrite}
                            />
                            <BulkTtsPresetCard
                              open={bulkTtsOpen}
                              presets={ttsPresets}
                              selectedPresetId={bulkTtsSelectedPresetId}
                              selectedCount={selectedCount}
                              name={bulkTtsName}
                              baseUrl={bulkTtsBaseUrl}
                              model={bulkTtsModel}
                              voice={bulkTtsVoice}
                              apiKey={bulkTtsApiKey}
                              format={bulkTtsFormat}
                              authHeader={bulkTtsAuthHeader}
                              error={bulkTtsError}
                              results={bulkTtsResults}
                              onOpenChange={onBulkTtsOpenChange}
                              onPresetSelect={onTtsPresetSelect}
                              onNewPreset={onNewTtsPreset}
                              onNameChange={onBulkTtsNameChange}
                              onBaseUrlChange={onBulkTtsBaseUrlChange}
                              onModelChange={onBulkTtsModelChange}
                              onVoiceChange={onBulkTtsVoiceChange}
                              onApiKeyChange={onBulkTtsApiKeyChange}
                              onFormatChange={onBulkTtsFormatChange}
                              onAuthHeaderChange={onBulkTtsAuthHeaderChange}
                              onSave={onSaveTtsPreset}
                              onDelete={onDeleteTtsPreset}
                              onApplyFillBlanks={onApplyTtsFillBlanks}
                              onApplyOverwrite={onApplyTtsOverwrite}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onCopyFriendLlmOverwrite(friend)}
                              className="rounded-full border border-[#7da8e3]/18 bg-black/14 px-3 py-1.5 text-xs text-[#b8d6ff]"
                            >
                              用此 AI LLM 覆盖当前阵容
                            </button>
                            <button
                              type="button"
                              onClick={() => onCopyFriendTtsOverwrite(friend)}
                              className="rounded-full border border-[#77d898]/18 bg-black/14 px-3 py-1.5 text-xs text-[#a8f0b6]"
                            >
                              用此 AI TTS 覆盖当前阵容
                            </button>
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                  <div className="ai-edit-footer">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      保存修改
                    </button>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      {mobileView === "overview" && mobileDisplayedFriends.length === 0 && (
        <div className="mobile-ai-empty-state">
          没有匹配的 AI 角色。
        </div>
      )}
      {mobileView === "lineup" && mobileLineupFriends.length === 0 && (
        <div className="mobile-ai-empty-state">
          当前没有已入队 AI，可切回角色总览继续挑选。
        </div>
      )}
      {mobileFocusedFriend && (
        <section className="mobile-ai-inspector" aria-label={`${mobileFocusedFriend.nickname}移动端概要`}>
          <div className="mobile-ai-inspector-head">
            <AiFriendAvatar friend={mobileFocusedFriend} size="small" className="mobile-ai-inspector-avatar" />
            <div>
              <span>{selectedIds.includes(mobileFocusedFriend.id) ? "已入队" : "可加入"}</span>
              <strong>{mobileFocusedFriend.nickname}</strong>
              <p>{mobileFocusedFriend.ordinaryPlayerTypeLabel}</p>
            </div>
            <button type="button" onClick={() => openFriendEditor(mobileFocusedFriend, mobileFocusedEditSection)}>
              编辑
            </button>
          </div>
          <div className="mobile-ai-inspector-tabs" aria-label="移动端配置页签">
            {AI_EDIT_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={mobileFocusedEditSection === item.id}
                onClick={() => setFriendEditSection(mobileFocusedEditStateKey, item.id)}
              >
                {item.id === "role" ? "角色" : item.id === "llm" ? "LLM" : item.id === "tts" ? "TTS" : item.id === "bulk" ? "批量" : "总览"}
              </button>
            ))}
          </div>
          <div className="mobile-ai-inspector-body" data-mobile-inspector-section={mobileFocusedEditSection}>
            {mobileFocusedEditSection === "overview" && (
              <div className="mobile-ai-inspector-summary-grid">
                <div>
                  <span>LLM</span>
                  <strong title={formatLlmStatus(aiRuntimeConfig, mobileFocusedFriend)}>
                    {formatLlmStatus(aiRuntimeConfig, mobileFocusedFriend)}
                  </strong>
                </div>
                <div>
                  <span>TTS</span>
                  <strong title={formatTtsStatus(aiRuntimeConfig, mobileFocusedFriend)}>
                    {formatTtsStatus(aiRuntimeConfig, mobileFocusedFriend)}
                  </strong>
                </div>
                <div>
                  <span>打法</span>
                  <strong>{mobileFocusedFriend.ordinaryPlayerTypeLabel}</strong>
                </div>
                <div>
                  <span>策略卡</span>
                  <strong>{mobileFocusedFriend.strategySummary}</strong>
                </div>
              </div>
            )}
            {mobileFocusedEditSection === "role" && mobileFocusedProfile && (
              <div className="mobile-ai-inspector-role">
                <p>{mobileFocusedFriend.ordinaryPlayerTypeSummary}</p>
                <div className="mobile-ai-inspector-meters">
                  {ORDINARY_PLAYER_SLIDER_CONTROLS.slice(0, 5).map((control) => {
                    const value = Math.round(mobileFocusedProfile.sliders[control.key] * 100);
                    return (
                      <div key={control.key}>
                        <span>
                          {control.label}
                          <em>{value}</em>
                        </span>
                        <i aria-hidden="true">
                          <b style={{ width: `${value}%` }} />
                        </i>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(mobileFocusedEditSection === "llm" || mobileFocusedEditSection === "tts" || mobileFocusedEditSection === "bulk") && (
              <div className="mobile-ai-inspector-config">
                <div>
                  <span>{mobileFocusedEditSection === "llm" ? "LLM 配置" : mobileFocusedEditSection === "tts" ? "TTS 配置" : "批量配置"}</span>
                  <strong>
                    {mobileFocusedEditSection === "llm"
                      ? formatLlmStatus(aiRuntimeConfig, mobileFocusedFriend)
                      : mobileFocusedEditSection === "tts"
                        ? formatTtsStatus(aiRuntimeConfig, mobileFocusedFriend)
                        : `当前阵容 ${selectedCount} 位 AI`}
                  </strong>
                </div>
                <button type="button" onClick={() => openFriendEditor(mobileFocusedFriend, mobileFocusedEditSection)}>
                  打开完整配置
                </button>
              </div>
            )}
          </div>
          <div className="mobile-ai-inspector-actions">
            <button type="button" onClick={() => onToggle(mobileFocusedFriend.id)}>
              {selectedIds.includes(mobileFocusedFriend.id) ? "移出阵容" : "加入阵容"}
            </button>
            <button type="button" onClick={() => openFriendEditor(mobileFocusedFriend, "llm")}>
              LLM
            </button>
            <button type="button" onClick={() => openFriendEditor(mobileFocusedFriend, "tts")}>
              TTS
            </button>
          </div>
        </section>
      )}
      {mobileEditorFriend && (
        <>
          <div className="mobile-ai-standalone-backdrop" onClick={() => setMobileEditor(null)} />
          <div
            className="mobile-ai-profile-panel ai-edit-modal mobile-ai-standalone-editor"
            role="dialog"
            aria-modal="true"
            aria-label={`${mobileEditorFriend.nickname}移动端编辑AI`}
          >
            <div className="mobile-ai-config-overlay-head ai-edit-header mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-[#f7ead5]">编辑 AI：{mobileEditorFriend.nickname}</div>
                <div className="mt-0.5 truncate text-xs text-[#ad9c7d]">手机端独立配置页，按页签切换角色、LLM、TTS 和批量配置。</div>
              </div>
              <button
                type="button"
                onClick={() => setMobileEditor(null)}
                className="ai-edit-close rounded-full border border-[#f1c76e]/24 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
                aria-label="关闭编辑弹窗"
              >
                ×
              </button>
            </div>
            <div className="ai-edit-tabs mobile-ai-standalone-tabs mb-3 flex flex-wrap gap-2" aria-label="手机端编辑区域">
              {AI_EDIT_SECTIONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setMobileEditorSection(mobileEditorFriend, item.id)}
                  aria-pressed={mobileEditorSection === item.id}
                  className={[
                    "border px-3 py-1.5 text-xs font-semibold transition",
                    mobileEditorSection === item.id
                      ? "border-[#f1c76e]/44 bg-[#f1c76e]/14 text-[#f8dfab]"
                      : "border-white/10 bg-black/16 text-[#dcc9a7] hover:border-[#f1c76e]/28 hover:text-[#f8dfab]",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mobile-ai-standalone-content">
              {mobileEditorSection === "overview" && (
                <section className="ai-edit-work-panel ai-edit-overview-panel">
                  <h3>配置总览</h3>
                  <div className="ai-edit-overview-grid">
                    <article className="ai-edit-overview-card">
                      <span className="ai-edit-overview-icon ai-edit-overview-icon-llm" aria-hidden="true">◈</span>
                      <div>
                        <div className="ai-edit-overview-label">LLM 模型</div>
                        <strong title={formatLlmStatus(aiRuntimeConfig, mobileEditorFriend)}>{formatLlmStatus(aiRuntimeConfig, mobileEditorFriend)}</strong>
                        <p>{mobileEditorFriend.llmConfig ? "自定义接入 · 已保存到本机" : "跟随当前运行时路由"}</p>
                      </div>
                    </article>
                    <article className="ai-edit-overview-card">
                      <span className="ai-edit-overview-icon ai-edit-overview-icon-tts" aria-hidden="true">≋</span>
                      <div>
                        <div className="ai-edit-overview-label">TTS 声音</div>
                        <strong title={formatTtsStatus(aiRuntimeConfig, mobileEditorFriend)}>{formatTtsStatus(aiRuntimeConfig, mobileEditorFriend)}</strong>
                        <p>{mobileEditorFriend.ttsConfig ? `${mobileEditorFriend.ttsConfig.model} · ${mobileEditorFriend.ttsConfig.format ?? DEFAULT_CUSTOM_TTS_FORMAT}` : formatTtsStatus(aiRuntimeConfig, mobileEditorFriend)}</p>
                      </div>
                    </article>
                  </div>
                  <div className="ai-edit-action-grid mt-3">
                    <button type="button" onClick={() => setMobileEditorSection(mobileEditorFriend, "role")}>
                      <span>角色信息</span>
                      <small>头像、打法类型和策略卡</small>
                    </button>
                    <button type="button" onClick={() => setMobileEditorSection(mobileEditorFriend, "llm")}>
                      <span>LLM 配置</span>
                      <small>模型、Base URL 和 API Key</small>
                    </button>
                    <button type="button" onClick={() => setMobileEditorSection(mobileEditorFriend, "tts")}>
                      <span>TTS 配置</span>
                      <small>声音、模型和鉴权信息</small>
                    </button>
                  </div>
                </section>
              )}
              {mobileEditorSection === "role" && (
                <section className="ai-edit-detail-panel ai-edit-role-panel">
                  <div className="ai-edit-detail-head">
                    <div>
                      <h3>角色信息</h3>
                      <p>普通局玩家类型可点击切换，数值条只是当前画像展示。</p>
                    </div>
                    <span>{mobileEditorFriend.ordinaryPlayerTypeLabel}</span>
                  </div>
                  <AiProfileIdentityForm
                    friend={mobileEditorFriend}
                    onProfileSave={saveProfileFromEditor}
                    onAvatarUpload={uploadAvatarFromEditor}
                    onClearAvatar={onClearAvatar}
                  />
                  <div className="mt-3">
                    <OrdinaryPlayerTypePanel friend={mobileEditorFriend} onSelectType={onSelectOrdinaryPlayerType} />
                  </div>
                </section>
              )}
              {mobileEditorSection === "llm" && (
                <section className="mobile-ai-config-section ai-edit-config-details rounded-2xl border border-[#7da8e3]/14 bg-[#0d1623]/42 p-3">
                  <div className="ai-edit-detail-head">
                    <div>
                      <h3>LLM配置</h3>
                      <p>配置该 AI 的模型路由、Base URL、模型名称、API Key 和系统提示合并方式。</p>
                    </div>
                    <span title={formatLlmStatus(aiRuntimeConfig, mobileEditorFriend)}>{formatLlmStatus(aiRuntimeConfig, mobileEditorFriend)}</span>
                  </div>
                  <div className="mt-3">
                    <AiCardModelConfig
                      key={`${mobileEditorFriend.id}:mobile:${mobileEditorFriend.llmConfig?.baseUrl ?? ""}:${mobileEditorFriend.llmConfig?.model ?? ""}:${aiLlmSecrets[mobileEditorFriend.id]?.apiKey ?? ""}`}
                      friend={mobileEditorFriend}
                      aiRuntimeConfig={aiRuntimeConfig}
                      apiKey={aiLlmSecrets[mobileEditorFriend.id]?.apiKey ?? ""}
                      onSave={onSaveLlmConfig}
                    />
                  </div>
                </section>
              )}
              {mobileEditorSection === "tts" && (
                <section className="mobile-ai-config-section ai-edit-config-details rounded-2xl border border-[#77d898]/14 bg-[#0f2118]/42 p-3">
                  <div className="ai-edit-detail-head">
                    <div>
                      <h3>TTS配置</h3>
                      <p>配置该 AI 的发言声音、TTS Base URL、模型、Voice ID、音频格式和鉴权信息。</p>
                    </div>
                    <span title={formatTtsStatus(aiRuntimeConfig, mobileEditorFriend)}>{formatTtsStatus(aiRuntimeConfig, mobileEditorFriend)}</span>
                  </div>
                  <div className="mt-3">
                    <AiCardTtsConfig
                      key={`${mobileEditorFriend.id}:mobile-tts:${mobileEditorFriend.ttsConfig?.baseUrl ?? ""}:${mobileEditorFriend.ttsConfig?.model ?? ""}:${mobileEditorFriend.ttsConfig?.voice ?? mobileEditorFriend.ttsVoice ?? ""}:${aiLlmSecrets[mobileEditorFriend.id]?.ttsApiKey ?? ""}`}
                      friend={mobileEditorFriend}
                      aiRuntimeConfig={aiRuntimeConfig}
                      apiKey={aiLlmSecrets[mobileEditorFriend.id]?.ttsApiKey ?? ""}
                      onSave={onSaveTtsConfig}
                    />
                  </div>
                </section>
              )}
              {mobileEditorSection === "bulk" && (
                <section className="ai-bulk-config-panel rounded-2xl border border-[#f1c76e]/16 bg-[#160f0b]/58 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-[#f1d796]">批量配置</div>
                      <p className="mt-1 text-[11px] leading-4 text-[#dcc9a7]/72">
                        当前阵容 {selectedCount} 位 AI，可用预设批量铺配置，也可从当前 AI 复制。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onCopyFriendLlmFillBlanks(mobileEditorFriend)}
                        className="rounded-full border border-[#7da8e3]/22 bg-[#0d1623]/55 px-3 py-1.5 text-xs font-semibold text-[#b8d6ff]"
                      >
                        复制此 AI 的 LLM 到未配置
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyFriendTtsFillBlanks(mobileEditorFriend)}
                        className="rounded-full border border-[#77d898]/22 bg-[#0f2118]/55 px-3 py-1.5 text-xs font-semibold text-[#a8f0b6]"
                      >
                        复制此 AI 的 TTS 到未配置
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <BulkLlmPresetCard
                      open={bulkLlmOpen}
                      presets={llmPresets}
                      selectedPresetId={bulkLlmSelectedPresetId}
                      selectedCount={selectedCount}
                      name={bulkLlmName}
                      baseUrl={bulkLlmBaseUrl}
                      model={bulkLlmModel}
                      apiKey={bulkLlmApiKey}
                      mergeSystemIntoUser={bulkLlmMergeSystemIntoUser}
                      error={bulkLlmError}
                      testStatus={bulkLlmTestStatus}
                      results={bulkLlmResults}
                      onOpenChange={onBulkLlmOpenChange}
                      onPresetSelect={onLlmPresetSelect}
                      onNewPreset={onNewLlmPreset}
                      onNameChange={onBulkLlmNameChange}
                      onBaseUrlChange={onBulkLlmBaseUrlChange}
                      onModelChange={onBulkLlmModelChange}
                      onApiKeyChange={onBulkLlmApiKeyChange}
                      onMergeSystemIntoUserChange={onBulkLlmMergeSystemIntoUserChange}
                      onSave={onSaveLlmPreset}
                      onDelete={onDeleteLlmPreset}
                      onTest={onTestLlmPreset}
                      onApplyFillBlanks={onApplyLlmFillBlanks}
                      onApplyOverwrite={onApplyLlmOverwrite}
                    />
                    <BulkTtsPresetCard
                      open={bulkTtsOpen}
                      presets={ttsPresets}
                      selectedPresetId={bulkTtsSelectedPresetId}
                      selectedCount={selectedCount}
                      name={bulkTtsName}
                      baseUrl={bulkTtsBaseUrl}
                      model={bulkTtsModel}
                      voice={bulkTtsVoice}
                      apiKey={bulkTtsApiKey}
                      format={bulkTtsFormat}
                      authHeader={bulkTtsAuthHeader}
                      error={bulkTtsError}
                      results={bulkTtsResults}
                      onOpenChange={onBulkTtsOpenChange}
                      onPresetSelect={onTtsPresetSelect}
                      onNewPreset={onNewTtsPreset}
                      onNameChange={onBulkTtsNameChange}
                      onBaseUrlChange={onBulkTtsBaseUrlChange}
                      onModelChange={onBulkTtsModelChange}
                      onVoiceChange={onBulkTtsVoiceChange}
                      onApiKeyChange={onBulkTtsApiKeyChange}
                      onFormatChange={onBulkTtsFormatChange}
                      onAuthHeaderChange={onBulkTtsAuthHeaderChange}
                      onSave={onSaveTtsPreset}
                      onDelete={onDeleteTtsPreset}
                      onApplyFillBlanks={onApplyTtsFillBlanks}
                      onApplyOverwrite={onApplyTtsOverwrite}
                    />
                  </div>
                </section>
              )}
            </div>
            <div className="ai-edit-footer mobile-ai-standalone-footer">
              <button type="button" onClick={() => setMobileEditor(null)}>取消</button>
              <button type="button" onClick={() => setMobileEditor(null)}>保存修改</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AiFriendAvatar({
  friend,
  className = "",
  size = "medium",
}: {
  friend: AiFriendOption;
  className?: string;
  size?: "small" | "medium" | "large";
}) {
  const hasCustomAvatar = Boolean(friend.avatarDataUrl);
  const image = getAiFriendAvatarImage(friend);
  const sizeClass = size === "small" ? "h-10 w-7" : size === "large" ? "h-14 w-10" : "h-11 w-8";
  return (
    <span
      className={[
        "relative block shrink-0 overflow-hidden rounded-lg border bg-cover bg-center shadow-lg shadow-black/20",
        sizeClass,
        hasCustomAvatar ? "border-[#77d898]/30 bg-[#0d2118]" : "border-[#7da8e3]/24 bg-[#0d1623]",
        className,
      ].join(" ")}
      style={hasCustomAvatar ? undefined : { backgroundImage: `url(${image})` }}
      aria-hidden="true"
    >
      {hasCustomAvatar && <AiAvatarCardArt src={image} />}
    </span>
  );
}

function AiAvatarCardArt({ src }: { src: string }) {
  return (
    <>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(119,216,152,0.22),transparent_56%),linear-gradient(145deg,#0b2d20,#16442f_52%,#070d0a)]" />
      <span className="absolute inset-[10%] rounded-md border border-[#77d898]/22" />
      <span
        className="absolute rounded-md border border-white/12 bg-cover bg-center shadow-inner shadow-black/40"
        style={{ inset: "18% 16%", backgroundImage: `url(${src})` }}
      />
    </>
  );
}

function AiProfileIdentityForm({
  friend,
  onProfileSave,
  onAvatarUpload,
  onClearAvatar,
}: {
  friend: AiFriendOption;
  onProfileSave: (friend: AiFriendOption, nickname: string) => void;
  onAvatarUpload: (friend: AiFriendOption, file: File) => void;
  onClearAvatar: (friend: AiFriendOption) => void;
}) {
  const sourceKey = `${friend.id}:${friend.nickname}`;
  const [nicknameDraft, setNicknameDraft] = useState({ sourceKey, nickname: friend.nickname });
  const nickname = nicknameDraft.sourceKey === sourceKey ? nicknameDraft.nickname : friend.nickname;
  const normalizedNickname = nickname.trim().replace(/\s+/g, " ").slice(0, 16);
  const canSaveName = normalizedNickname.length > 0 && normalizedNickname !== friend.nickname;
  const hasCustomAvatar = Boolean(friend.avatarDataUrl);

  return (
    <section className="ai-profile-identity-form" aria-label={`${friend.nickname}角色名称和头像`}>
      <div className="ai-profile-identity-avatar">
        <AiFriendAvatar friend={friend} size="large" className="ai-profile-identity-avatar-card" />
        <div className="ai-profile-identity-avatar-actions">
          <label>
            上传头像
            <input
              type="file"
              accept={AI_FRIEND_AVATAR_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAvatarUpload(friend, file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {hasCustomAvatar && (
            <button type="button" onClick={() => onClearAvatar(friend)}>
              移除头像
            </button>
          )}
        </div>
      </div>
      <label className="ai-profile-identity-name">
        <span>角色名称</span>
        <input
          value={nickname}
          maxLength={16}
          placeholder={friend.basePersonaName}
          onChange={(event) => setNicknameDraft({ sourceKey, nickname: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="ai-profile-identity-save"
        disabled={!canSaveName}
        onClick={() => {
          onProfileSave(friend, normalizedNickname);
          setNicknameDraft({ sourceKey: `${friend.id}:${normalizedNickname}`, nickname: normalizedNickname });
        }}
      >
        保存名称
      </button>
    </section>
  );
}

const ORDINARY_PLAYER_SLIDER_CONTROLS: Array<{
  key: keyof AiOrdinaryPlayerProfileSliders;
  label: string;
  hint: string;
}> = [
  { key: "directness", label: "说话方式", hint: "越高越直接给结论" },
  { key: "emotion", label: "情绪强度", hint: "越高越容易有即时情绪" },
  { key: "questionBias", label: "追问倾向", hint: "越高越爱追问别人补逻辑" },
  { key: "factBias", label: "思考偏好", hint: "越高越依赖公开事实" },
  { key: "nightAggression", label: "行动策略", hint: "越高夜间和投票越主动" },
];

function OrdinaryPlayerTypePanel({
  friend,
  onSelectType,
}: {
  friend: AiFriendOption;
  onSelectType: (friend: AiFriendOption, typeId: AiOrdinaryPlayerTypeId) => void;
}) {
  const profile = sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile);

  return (
    <section className="mobile-ai-ordinary-type-panel ordinary-player-readout-panel rounded-2xl border border-[#f1c76e]/14 bg-[#1a120b]/42 p-3">
      <div className="ordinary-player-readout-head">
        <div>
          <div className="text-xs font-semibold text-[#f1d796]">普通局玩家类型</div>
          <p className="mt-1 text-[11px] leading-4 text-[#dcc9a7]/76">
            模型只决定调用接口，点击类型卡切换发言和打法；右侧数值为当前画像展示。
          </p>
        </div>
        <span className="ordinary-player-active-pill">{friend.ordinaryPlayerTypeLabel}</span>
      </div>

      <div className="ordinary-player-readout-layout">
        <div className="ordinary-player-type-column">
          <div className="ordinary-player-type-grid" aria-label="普通局玩家类型列表">
            {ORDINARY_PLAYER_TYPE_OPTIONS.map((preset) => {
              const active = preset.id === profile.playerTypeId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  title={`${preset.label}：${preset.summary}`}
                  className={[
                    "ordinary-player-type-card",
                    active ? "ordinary-player-type-card-active" : "",
                  ].join(" ")}
                  onClick={() => onSelectType(friend, preset.id)}
                >
                  <span>{preset.label}</span>
                  <p>{preset.summary}</p>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="ordinary-player-stat-panel" aria-label="当前玩家类型数值">
          <div className="ordinary-player-current-summary">
            <span>当前类型</span>
            <strong>{friend.ordinaryPlayerTypeLabel}</strong>
            <p>{friend.ordinaryPlayerTypeSummary}</p>
          </div>
          <div className="ordinary-player-stat-list">
            {ORDINARY_PLAYER_SLIDER_CONTROLS.map((control) => {
              const value = Math.round(profile.sliders[control.key] * 100);
              return (
                <div key={control.key} className="ordinary-player-stat-row" title={`${control.label}：${control.hint}`}>
                  <div className="ordinary-player-stat-meta">
                    <span>
                      <strong>{control.label}</strong>
                      <small>{control.hint}</small>
                    </span>
                    <em>{value}</em>
                  </div>
                  <div className="ordinary-player-meter" aria-hidden="true">
                    <span style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AiCardModelConfig({
  friend,
  aiRuntimeConfig,
  apiKey,
  onSave,
}: {
  friend: AiFriendOption;
  aiRuntimeConfig: AiRuntimeConfig | null;
  apiKey: string;
  onSave: (friend: AiFriendOption, llmConfig: AiFriendLlmConfig, apiKey: string) => void;
}) {
  const route = getLlmRoute(aiRuntimeConfig, friend);
  const [label, setLabel] = useState(friend.llmConfig?.label ?? friend.basePersonaName);
  const [baseUrl, setBaseUrl] = useState(friend.llmConfig?.baseUrl ?? DEFAULT_CUSTOM_LLM_BASE_URL);
  const [model, setModel] = useState(friend.llmConfig?.model ?? route?.model ?? friend.basePersonaModelLabel ?? "");
  const [secret, setSecret] = useState(apiKey);
  const [mergeSystemIntoUser, setMergeSystemIntoUser] = useState(Boolean(friend.llmConfig?.mergeSystemIntoUser));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const llmConfig = buildCustomLlmConfig({
      label,
      baseUrl,
      model,
      mergeSystemIntoUser,
    });
    if (!llmConfig) {
      setError("需要填写有效的接口地址和模型名称。");
      return;
    }
    if (!secret.trim()) {
      setError("需要填写这个 AI 使用的 API Key。");
      return;
    }
    onSave(friend, llmConfig, secret);
    setError(null);
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-[#7da8e3]/14 bg-[#0d1623]/48 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          显示名
          <input
            value={label}
            placeholder={friend.basePersonaName}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
          />
        </label>
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          模型名称
          <input
            value={model}
            placeholder={route?.model ?? friend.basePersonaModelLabel ?? "模型名称"}
            onChange={(event) => setModel(event.target.value)}
            className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs text-[#ad9c7d]">
        Base URL
        <input
          value={baseUrl}
          placeholder={DEFAULT_CUSTOM_LLM_BASE_URL}
          onChange={(event) => setBaseUrl(event.target.value)}
          className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
        />
      </label>
      <label className="grid gap-1 text-xs text-[#ad9c7d]">
        API Key
        <input
          type="password"
          value={secret}
          placeholder="仅保存在本机浏览器"
          onChange={(event) => setSecret(event.target.value)}
          className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-[#ad9c7d]">
        <input
          type="checkbox"
          checked={mergeSystemIntoUser}
          onChange={(event) => setMergeSystemIntoUser(event.target.checked)}
          className="h-4 w-4 accent-[#7da8e3]"
        />
        将系统提示合并进用户消息
      </label>
      {error && <div className="rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">{error}</div>}
      <button
        type="button"
        onClick={save}
        className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-[#379566]"
      >
        保存到这个 AI
      </button>
    </div>
  );
}

function AiCardTtsConfig({
  friend,
  aiRuntimeConfig,
  apiKey,
  onSave,
}: {
  friend: AiFriendOption;
  aiRuntimeConfig: AiRuntimeConfig | null;
  apiKey: string;
  onSave: (friend: AiFriendOption, ttsConfig: AiFriendTtsConfig, apiKey: string) => void;
}) {
  const profile = getTtsProfile(aiRuntimeConfig, friend);
  const defaultVoice = profile?.resolvedVoice ?? "";
  const options = aiRuntimeConfig?.tts.voices ?? FALLBACK_TTS_VOICES;
  const [label, setLabel] = useState(friend.ttsConfig?.label ?? `${friend.basePersonaName}语音`);
  const [baseUrl, setBaseUrl] = useState(friend.ttsConfig?.baseUrl ?? DEFAULT_CUSTOM_TTS_BASE_URL);
  const [model, setModel] = useState(friend.ttsConfig?.model ?? aiRuntimeConfig?.tts.model ?? DEFAULT_CUSTOM_TTS_MODEL);
  const [secret, setSecret] = useState(apiKey);
  const [format, setFormat] = useState(friend.ttsConfig?.format ?? aiRuntimeConfig?.tts.format ?? DEFAULT_CUSTOM_TTS_FORMAT);
  const [authHeader, setAuthHeader] = useState(friend.ttsConfig?.authHeader ?? "Authorization");
  const [ttsVoice, setTtsVoice] = useState(friend.ttsConfig?.voice ?? friend.ttsVoice ?? "");
  const [customVoice, setCustomVoice] = useState(
    friend.ttsConfig?.voice && !options.some((voice) => voice.value === friend.ttsConfig?.voice)
      ? friend.ttsConfig.voice
      : friend.ttsVoice && !options.some((voice) => voice.value === friend.ttsVoice)
        ? friend.ttsVoice
        : "",
  );
  const [useCustomVoice, setUseCustomVoice] = useState(Boolean(customVoice));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const voice = useCustomVoice ? customVoice.trim().replace(/\s+/g, "_").slice(0, 80) : ttsVoice.trim() || defaultVoice;
    const ttsConfig = buildCustomTtsConfig({ label, baseUrl, model, voice, format, authHeader });
    if (!ttsConfig) {
      setError("需要填写有效的 TTS Base URL、模型名称和 voice。");
      return;
    }
    if (!secret.trim()) {
      setError("需要填写这个 AI 使用的 TTS API Key。");
      return;
    }
    onSave(friend, ttsConfig, secret);
    setError(null);
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-[#77d898]/14 bg-[#0f2118]/48 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-[#dff4df]">TTS 云语音</div>
        <span className="max-w-[160px] truncate rounded-full border border-[#77d898]/18 bg-black/20 px-2 py-0.5 text-[11px] text-[#a8f0b6]">
          {friend.ttsConfig ? customTtsKeyState(apiKey) : aiRuntimeConfig?.tts.available ? "默认 TTS 可用" : "文字模式"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          显示名
          <input
            value={label}
            placeholder={`${friend.basePersonaName}语音`}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
          />
        </label>
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          TTS 模型
          <input
            value={model}
            placeholder={aiRuntimeConfig?.tts.model ?? DEFAULT_CUSTOM_TTS_MODEL}
            onChange={(event) => setModel(event.target.value)}
            className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs text-[#ad9c7d]">
        TTS Base URL
        <input
          value={baseUrl}
          placeholder={DEFAULT_CUSTOM_TTS_BASE_URL}
          onChange={(event) => setBaseUrl(event.target.value)}
          className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
        />
      </label>
      <label className="grid gap-1 text-xs text-[#ad9c7d]">
        TTS API Key
        <input
          type="password"
          value={secret}
          placeholder="仅保存在本机浏览器"
          onChange={(event) => setSecret(event.target.value)}
          className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          音频格式
          <input
            value={format}
            placeholder={DEFAULT_CUSTOM_TTS_FORMAT}
            onChange={(event) => setFormat(event.target.value)}
            className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
          />
        </label>
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          鉴权 Header
          <input
            value={authHeader}
            placeholder="Authorization"
            onChange={(event) => setAuthHeader(event.target.value)}
            className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs text-[#ad9c7d]">
        Voice ID
        <select
          value={useCustomVoice ? "__custom" : ttsVoice}
          onChange={(event) => {
            if (event.target.value === "__custom") {
              setUseCustomVoice(true);
              setCustomVoice(customVoice || ttsVoice || defaultVoice);
            } else {
              setUseCustomVoice(false);
              setTtsVoice(event.target.value);
            }
          }}
          className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
        >
          <option value="">跟随默认声音{defaultVoice ? ` · ${defaultVoice}` : ""}</option>
          {options.map((voice) => (
            <option key={voice.value} value={voice.value}>
              {voice.label} · {voice.value}
            </option>
          ))}
          <option value="__custom">手动填写 voice id</option>
        </select>
      </label>
      {useCustomVoice && (
        <label className="grid gap-1 text-xs text-[#ad9c7d]">
          自定义 Voice ID
          <input
            value={customVoice}
            placeholder={defaultVoice || "mimo_default"}
            onChange={(event) => setCustomVoice(event.target.value)}
            className="rounded-xl border border-[#77d898]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#77d898]/45"
          />
        </label>
      )}
      {error && <div className="rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">{error}</div>}
      <button
        type="button"
        onClick={save}
        className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-[#379566]"
      >
        保存 TTS 到这个 AI
      </button>
    </div>
  );
}

function RuntimeConfigSummary({
  aiRuntimeConfig,
  friend,
  customLlmActive,
  customLlmConfig,
  customLlmApiKey,
  ttsVoice,
}: {
  aiRuntimeConfig: AiRuntimeConfig | null;
  friend?: AiFriendOption;
  customLlmActive?: boolean;
  customLlmConfig?: AiFriendLlmConfig;
  customLlmApiKey?: string;
  ttsVoice: string;
}) {
  if (!friend) return null;

  const route = getLlmRoute(aiRuntimeConfig, friend);
  const profile = getTtsProfile(aiRuntimeConfig, friend);
  const resolvedVoice = ttsVoice || profile?.resolvedVoice || "跟随默认";
  const llmState = llmAvailabilityLabel(route);
  const ttsState = ttsAvailabilityLabel(aiRuntimeConfig);
  const showCustomLlm = customLlmActive || Boolean(customLlmConfig);

  return (
    <div className="grid gap-2 rounded-2xl border border-[#7da8e3]/14 bg-black/18 px-3 py-3 text-xs leading-5 text-[#d8e7ff]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#b8d6ff]">{showCustomLlm ? "自定义大模型" : "AI 大模型"}</span>
        <span className="min-w-0 truncate text-right text-[#f7ead5]">
          {showCustomLlm
            ? customLlmConfig
              ? `${formatCustomLlmModel(customLlmConfig)} · ${customLlmKeyState(customLlmApiKey)}`
              : "待填写接口地址和模型名称"
            : `${route?.model ?? friend.basePersonaModelLabel ?? friend.basePersonaName} · ${llmState}`}
        </span>
      </div>
      {showCustomLlm && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#b8d6ff]">打法模板</span>
          <span className="min-w-0 truncate text-right text-[#f7ead5]">{friend.basePersonaLabel}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#b8d6ff]">发言声音</span>
        <span className="min-w-0 truncate text-right text-[#f7ead5]">
          {aiRuntimeConfig?.tts.model ?? "mimo-v2.5-tts"} · {resolvedVoice} · {ttsState}
        </span>
      </div>
    </div>
  );
}

function CustomAiTransferCard({
  baseFriends,
  aiRuntimeConfig,
  selectedFriends,
  selectedCount,
  quickAddNickname,
  quickAddBaseId,
  quickAddUseCustomLlm,
  quickAddLlmLabel,
  quickAddLlmBaseUrl,
  quickAddLlmModel,
  quickAddLlmApiKey,
  quickAddMergeSystemIntoUser,
  quickAddTtsVoice,
  customAiError,
  onQuickAddNicknameChange,
  onQuickAddBaseChange,
  onQuickAddUseCustomLlmChange,
  onQuickAddLlmLabelChange,
  onQuickAddLlmBaseUrlChange,
  onQuickAddLlmModelChange,
  onQuickAddLlmApiKeyChange,
  onQuickAddMergeSystemIntoUserChange,
  onQuickAddTtsVoiceChange,
  onQuickAdd,
  onMove,
  onRemove,
  onRandomize,
}: {
  baseFriends: AiFriendOption[];
  aiRuntimeConfig: AiRuntimeConfig | null;
  selectedFriends: AiFriendOption[];
  selectedCount: number;
  quickAddNickname: string;
  quickAddBaseId: string;
  quickAddUseCustomLlm: boolean;
  quickAddLlmLabel: string;
  quickAddLlmBaseUrl: string;
  quickAddLlmModel: string;
  quickAddLlmApiKey: string;
  quickAddMergeSystemIntoUser: boolean;
  quickAddTtsVoice: string;
  customAiError: string | null;
  onQuickAddNicknameChange: (value: string) => void;
  onQuickAddBaseChange: (value: string) => void;
  onQuickAddUseCustomLlmChange: (value: boolean) => void;
  onQuickAddLlmLabelChange: (value: string) => void;
  onQuickAddLlmBaseUrlChange: (value: string) => void;
  onQuickAddLlmModelChange: (value: string) => void;
  onQuickAddLlmApiKeyChange: (value: string) => void;
  onQuickAddMergeSystemIntoUserChange: (value: boolean) => void;
  onQuickAddTtsVoiceChange: (value: string) => void;
  onQuickAdd: () => void;
  onMove: (friendId: string, direction: -1 | 1) => void;
  onRemove: (friendId: string) => void;
  onRandomize: () => void;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddCustomLlmConfig = quickAddUseCustomLlm
    ? buildCustomLlmConfig({
        label: quickAddLlmLabel,
        baseUrl: quickAddLlmBaseUrl,
        model: quickAddLlmModel,
        mergeSystemIntoUser: quickAddMergeSystemIntoUser,
      })
    : undefined;
  const submitQuickAdd = () => {
    onQuickAdd();
    setQuickAddOpen(false);
  };

  return (
    <div className="grid content-start gap-4">
      <section className="mobile-ai-quick-add-entry rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#e4efff]">快速新增AI</h2>
            <p className="mt-1 text-xs text-[#b8d6ff]/72">填昵称，选择或填写 AI 大模型，再选发言声音，保存后自动加入本局队列。</p>
          </div>
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="rounded-full border border-[#7da8e3]/25 bg-[#7da8e3]/10 px-3 py-2 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/16"
          >
            新增
          </button>
        </div>
      </section>

      {quickAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-ai-title"
          className="mobile-ai-add-overlay fixed inset-0 z-[65] overflow-y-auto bg-black/86 px-3 py-5 backdrop-blur-md sm:px-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQuickAddOpen(false);
          }}
        >
          <section
            className="mobile-ai-add-card mx-auto w-full max-w-3xl rounded-[30px] border border-[#7da8e3]/30 bg-[#0d1623]/96 p-4 shadow-2xl shadow-black/70 sm:p-5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#7da8e3]/15 pb-4">
              <div className="min-w-0">
                <h2 id="quick-add-ai-title" className="text-xl font-semibold text-[#e4efff]">快速新增AI</h2>
                <p className="mt-1 text-xs leading-5 text-[#b8d6ff]/72">新增后会自动进入本局队列。</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="rounded-full border border-[#7da8e3]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
              >
                关闭
              </button>
            </div>
            <div className="grid gap-3">
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            昵称
            <input
              value={quickAddNickname}
              maxLength={16}
              placeholder="例如：冷静票型位"
              onChange={(event) => onQuickAddNicknameChange(event.target.value)}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#7da8e3]/14 bg-black/16 px-3 py-2 text-xs text-[#b8d6ff]">
            <input
              type="checkbox"
              checked={quickAddUseCustomLlm}
              onChange={(event) => onQuickAddUseCustomLlmChange(event.target.checked)}
              className="h-4 w-4 accent-[#7da8e3]"
            />
            自己填写 OpenAI 兼容大模型
          </label>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            {quickAddUseCustomLlm ? "打法模板" : "AI 大模型"}
            <select
              value={quickAddBaseId}
              onChange={(event) => onQuickAddBaseChange(event.target.value)}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            >
              {baseFriends.map((friend) => (
                <option key={friend.id} value={friend.id}>
                  {quickAddUseCustomLlm ? formatPersonaTemplateOptionLabel(friend) : formatBaseOptionLabel(aiRuntimeConfig, friend)}
                </option>
              ))}
            </select>
          </label>
          {quickAddUseCustomLlm && (
            <div className="grid gap-3 rounded-2xl border border-[#7da8e3]/14 bg-black/16 p-3">
              <label className="grid gap-1 text-xs text-[#ad9c7d]">
                显示名
                <input
                  value={quickAddLlmLabel}
                  placeholder="例如：我的模型"
                  onChange={(event) => onQuickAddLlmLabelChange(event.target.value)}
                  className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#ad9c7d]">
                接口地址
                <input
                  value={quickAddLlmBaseUrl}
                  placeholder={DEFAULT_CUSTOM_LLM_BASE_URL}
                  onChange={(event) => onQuickAddLlmBaseUrlChange(event.target.value)}
                  className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#ad9c7d]">
                模型名称
                <input
                  value={quickAddLlmModel}
                  placeholder="例如：gpt-4o-mini / deepseek-chat"
                  onChange={(event) => onQuickAddLlmModelChange(event.target.value)}
                  className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#ad9c7d]">
                API Key
                <input
                  type="password"
                  value={quickAddLlmApiKey}
                  placeholder="可选；仅保存在本机浏览器"
                  onChange={(event) => onQuickAddLlmApiKeyChange(event.target.value)}
                  className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[#ad9c7d]">
                <input
                  type="checkbox"
                  checked={quickAddMergeSystemIntoUser}
                  onChange={(event) => onQuickAddMergeSystemIntoUserChange(event.target.checked)}
                  className="h-4 w-4 accent-[#7da8e3]"
                />
                将系统提示合并进用户消息
              </label>
            </div>
          )}
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            发言声音
            <select
              value={quickAddTtsVoice}
              onChange={(event) => onQuickAddTtsVoiceChange(event.target.value)}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            >
              <option value="">跟随默认声音</option>
              {(aiRuntimeConfig?.tts.voices ?? FALLBACK_TTS_VOICES).map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label} · {voice.value}
                </option>
              ))}
            </select>
          </label>
          <RuntimeConfigSummary
            aiRuntimeConfig={aiRuntimeConfig}
            friend={baseFriends.find((friend) => friend.id === quickAddBaseId) ?? baseFriends[0]}
            customLlmActive={quickAddUseCustomLlm}
            customLlmConfig={quickAddCustomLlmConfig}
            customLlmApiKey={quickAddLlmApiKey}
            ttsVoice={quickAddTtsVoice}
          />
          {customAiError && (
            <div className="rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">
              {customAiError}
            </div>
          )}
          <button
            type="button"
            onClick={submitQuickAdd}
            disabled={baseFriends.length === 0}
            className="rounded-full bg-[#2f8157] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-[#379566] disabled:opacity-45"
          >
            添加并入队
          </button>
            </div>
          </section>
        </div>
      )}

      <section className="mobile-ai-queue-card rounded-[24px] border border-[#77d898]/22 bg-[#0f2118]/76 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#dff4df]">本局 AI 队列</h2>
            <p className="mt-1 text-xs text-[#9fc8a7]">按这里的顺序入场，开局页会按板子自动补齐。</p>
          </div>
          <span className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2 py-1 text-xs text-[#a8f0b6]">
            {selectedCount} 位
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRandomize}
            disabled={selectedFriends.length < 2}
            className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/55 px-3 py-2 text-xs font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75 disabled:opacity-45"
          >
            随机入场
          </button>
        </div>
        {selectedFriends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#77d898]/20 bg-black/16 px-3 py-5 text-center text-xs leading-5 text-[#9fc8a7]">
            暂未选择 AI，开局时会用默认 AI 自动补齐。
          </div>
        ) : (
          <div className="mobile-ai-queue-list max-h-[330px] space-y-2 overflow-auto pr-1">
            {selectedFriends.map((friend, index) => (
              <div key={friend.id} className="rounded-2xl border border-[#77d898]/14 bg-black/18 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/35 text-xs font-semibold text-[#a8f0b6]">
                    {index + 1}
                  </span>
                  <AiFriendAvatar friend={friend} size="small" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[#f7ead5]">{friend.nickname}</div>
                    <div className="mt-0.5 truncate text-[11px] text-[#9fc8a7]">
                      {friend.llmConfig
                        ? `${formatLlmStatus(aiRuntimeConfig, friend)} · ${formatPersonaTemplateStatus(friend)}`
                        : `${friend.basePersonaName} · ${formatLlmStatus(aiRuntimeConfig, friend)}`}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#b8d6ff]">
                      发言声音 · {formatTtsStatus(aiRuntimeConfig, friend)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onMove(friend.id, -1)}
                      disabled={index === 0}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/12 bg-black/16 text-xs text-[#dcc9a7] transition hover:bg-white/8 disabled:opacity-35"
                      aria-label={`${friend.nickname}上移`}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(friend.id, 1)}
                      disabled={index === selectedFriends.length - 1}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/12 bg-black/16 text-xs text-[#dcc9a7] transition hover:bg-white/8 disabled:opacity-35"
                      aria-label={`${friend.nickname}下移`}
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(friend.id)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-[#e46d55]/25 bg-[#2b1110]/50 text-xs text-[#ffb1a4] transition hover:bg-[#3a1712]"
                      aria-label={`${friend.nickname}移出队列`}
                      title="移出"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mobile-ai-custom-note rounded-[24px] border border-[#f1c76e]/22 bg-[#130d0b]/80 p-4 text-sm leading-6 text-[#dcc9a7] shadow-2xl shadow-black/30 backdrop-blur-md">
        复制内置 AI 后会生成一个可编辑的自定义AI。开局页会读取这里保存的入局选择。
      </section>
    </div>
  );
}

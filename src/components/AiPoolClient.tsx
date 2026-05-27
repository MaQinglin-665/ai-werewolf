"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH,
  applyAiFriendPersonaTemplate,
  copyAiFriend,
} from "@/game/aiFriends";
import type { AiFriendConfig, AiFriendLlmConfig, AiFriendTtsConfig, AiRuntimeMode } from "@/game/types";
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
  appendImportedRoleRoster,
  exportAiFriendRoleRoster,
  overwriteImportedRoleRoster,
  parseAiFriendRoleRosterExport,
} from "./game/aiFriendRoleRoster";
import { MODEL_CARD_IMAGES, ROLE_CARD_IMAGES } from "./game/viewHelpers";

const AI_TUNING_EXPLANATIONS: Array<{ label: string; detail: string }> = [
  { label: "逻辑链推演型", detail: "用公开事实链拆发言顺序、票型因果和前后矛盾，结论更克制。" },
  { label: "边界审查型", detail: "盯事实边界和越界发言，适合稳定归票、要求可疑位补站边。" },
  { label: "平衡组织型", detail: "先整理分散信息，再给综合判断，节奏稳但不会长期旁观。" },
  { label: "快节奏压迫型", detail: "用强压和即时反应带动桌面，更敢给身份压力和结论。" },
  { label: "细节校验型", detail: "抓上一轮发言、改口、票型变化和站边转向，适合查漏补缺。" },
  { label: "多线观察型", detail: "发言短、少站死边，但会留下清晰观察点，生存感更强。" },
  { label: "结构站边型", detail: "重视语气态度背后的结构矛盾，容易捕捉强势或回避的不自然感。" },
  { label: "长线记忆型", detail: "围绕身份线和历史发言追踪长期冲突，重视对跳、金水和查杀变化。" },
];

const AI_TUNING_EXPLANATION_BY_LABEL = new Map(AI_TUNING_EXPLANATIONS.map((item) => [item.label, item.detail]));

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

function configuredFriendId(source: Pick<AiFriendOption, "basePersonaId">): string {
  return `${CONFIGURED_AI_FRIEND_ID_PREFIX}${source.basePersonaId}`.slice(0, 80);
}

function isConfiguredFriendId(friendId: string): boolean {
  return friendId.startsWith(CONFIGURED_AI_FRIEND_ID_PREFIX);
}

function updateRoleCardField(
  friend: AiFriendOption,
  field: keyof NonNullable<AiFriendConfig["roleCard"]>,
  value: string,
): Partial<AiFriendConfig> {
  const roleCard = {
    source: friend.roleCard?.source ?? "",
    speakingStyle: friend.roleCard?.speakingStyle ?? "",
    reasoningStyle: friend.roleCard?.reasoningStyle ?? "",
    avoid: friend.roleCard?.avoid ?? "",
    [field]: value,
  };
  return { roleCard };
}

export function reconcileRoleRosterSelection({
  mode,
  currentSelectedIds,
  importedRoleIds,
}: {
  mode: "append" | "overwrite";
  currentSelectedIds: string[];
  importedRoleIds: string[];
}): string[] {
  const uniqueImportedIds = importedRoleIds.filter((id, index, values) => values.indexOf(id) === index);
  if (mode === "overwrite") return uniqueImportedIds;
  return [...currentSelectedIds, ...uniqueImportedIds].filter((id, index, values) => values.indexOf(id) === index);
}

export function pruneRoleRosterSecrets(secrets: AiFriendLlmSecretMap, allowedIds: Set<string>): AiFriendLlmSecretMap {
  return Object.fromEntries(Object.entries(secrets).filter(([friendId]) => allowedIds.has(friendId)));
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
  const [roleRosterImportText, setRoleRosterImportText] = useState("");
  const [roleRosterImportOpen, setRoleRosterImportOpen] = useState(false);
  const [roleRosterError, setRoleRosterError] = useState<string | null>(null);
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
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBulkLlmPresetIntoForm]);

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

  const exportRoleRoster = useCallback(() => {
    const raw = exportAiFriendRoleRoster(aiPoolFriends);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(raw);
    }
    setRoleRosterImportText(raw);
    setRoleRosterImportOpen(true);
    setRoleRosterError("角色名册 JSON 已生成；如果浏览器允许，也已复制到剪贴板。");
  }, [aiPoolFriends]);

  const importRoleRoster = useCallback(
    (mode: "append" | "overwrite") => {
      try {
        const imported = parseAiFriendRoleRosterExport(roleRosterImportText);
        const previousCustomCount = customAiFriends.length;
        const nextCustomAiFriends =
          mode === "append" ? appendImportedRoleRoster(customAiFriends, imported) : overwriteImportedRoleRoster(imported);
        const importedRoleIds =
          mode === "append" ? nextCustomAiFriends.slice(previousCustomCount).map((friend) => friend.id) : nextCustomAiFriends.map((friend) => friend.id);
        const nextSelectedIds = reconcileRoleRosterSelection({
          mode,
          currentSelectedIds: selectedAiFriendIds,
          importedRoleIds,
        });
        const allowedSecretIds = new Set([...nextCustomAiFriends.map((friend) => friend.id), ...nextSelectedIds]);
        setCustomAiFriends(nextCustomAiFriends);
        setSelectedAiFriendIds(nextSelectedIds);
        setAiLlmSecrets((current) => pruneRoleRosterSecrets(current, allowedSecretIds));
        setRoleRosterError(mode === "append" ? "已追加导入角色。" : "已覆盖当前本地角色。");
        setRoleRosterImportOpen(false);
      } catch (error) {
        setRoleRosterError(error instanceof Error ? error.message : "角色名册导入失败。");
      }
    },
    [customAiFriends, roleRosterImportText, selectedAiFriendIds],
  );

  const saveAiFriendLlmConfig = useCallback((friend: AiFriendOption, llmConfig: AiFriendLlmConfig, apiKey: string) => {
    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
      roleCard: friend.roleCard,
      llmConfig,
      ttsVoice: friend.ttsVoice,
      ttsConfig: friend.ttsConfig,
      riskTolerance: friend.riskTolerance,
      bluffing: friend.bluffing,
      preferences: friend.preferences,
      createdAt: friend.isDefault ? now : friend.createdAt,
      updatedAt: now,
    };

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
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
      roleCard: friend.roleCard,
      llmConfig: friend.llmConfig,
      ttsVoice: ttsConfig.voice,
      ttsConfig,
      riskTolerance: friend.riskTolerance,
      bluffing: friend.bluffing,
      preferences: friend.preferences,
      createdAt: friend.isDefault ? now : friend.createdAt,
      updatedAt: now,
    };

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

  const saveAiFriendAvatar = useCallback(async (friend: AiFriendOption, file: File) => {
    try {
      const avatarDataUrl = await buildAiFriendAvatarDataUrl(file);
      const now = new Date().toISOString();
      const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
      const nextFriend: AiFriendConfig = {
        id: targetId,
        nickname: friend.nickname,
        basePersonaId: friend.basePersonaId,
        avatarDataUrl,
        roleCard: friend.roleCard,
        llmConfig: friend.llmConfig,
        ttsVoice: friend.ttsVoice,
        ttsConfig: friend.ttsConfig,
        riskTolerance: friend.riskTolerance,
        bluffing: friend.bluffing,
        preferences: friend.preferences,
        createdAt: friend.isDefault ? now : friend.createdAt,
        updatedAt: now,
      };

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
      className="mobile-ai-pool-page min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.9)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mobile-ai-pool-shell mx-auto grid min-h-screen w-full max-w-[1400px] content-start gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <header className="mobile-ai-pool-header flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7da8e3]/24 bg-[#0d1623]/82 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b8d6ff]/68">AI Pool</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">AI池和自定义AI</h1>
            <p className="mt-1 text-sm text-[#b8d6ff]/72">
              {selectedCount} 位已加入本局队列 · {customAiFriends.length} 个自定义AI ·{" "}
              {aiRuntimeMode === "mock" ? "Mock 试玩" : "真实 LLM"}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-[#f1c76e]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
          >
            返回开局
          </Link>
        </header>

        <AiRuntimeModeCard mode={aiRuntimeMode} aiRuntimeConfig={aiRuntimeConfig} onModeChange={setAiRuntimeMode} />

        {aiRuntimeMode === "mock" && (
          <div className="rounded-2xl border border-[#f1c76e]/25 bg-[#2b2110]/58 px-4 py-3 text-sm leading-6 text-[#f1d796]">
            当前是 Mock 试玩：角色名和头像会显示，人设和打法扮演只在真实 LLM 生效。
          </div>
        )}

        <BulkLlmPresetCard
          open={bulkLlmOpen}
          presets={llmPresetState.presets}
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
          onOpenChange={setBulkLlmOpen}
          onPresetSelect={loadBulkLlmPresetIntoForm}
          onNewPreset={clearBulkLlmPresetForm}
          onNameChange={setBulkLlmName}
          onBaseUrlChange={setBulkLlmBaseUrl}
          onModelChange={setBulkLlmModel}
          onApiKeyChange={setBulkLlmApiKey}
          onMergeSystemIntoUserChange={setBulkLlmMergeSystemIntoUser}
          onSave={saveBulkLlmPreset}
          onDelete={deleteBulkLlmPreset}
          onTest={testBulkLlmPreset}
          onApplyFillBlanks={() => applyBulkLlmPreset("fill-blanks")}
          onApplyOverwrite={() => applyBulkLlmPreset("overwrite")}
        />

        <section className="mobile-ai-pool-layout grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <AiPoolList
            friends={aiPoolFriends}
            templateFriends={baseAiFriends}
            aiRuntimeConfig={aiRuntimeConfig}
            aiLlmSecrets={aiLlmSecrets}
            selectedIds={selectedAiFriendIds}
            onToggle={toggleAiFriendSelection}
            onCopy={copyAiFriendToCustom}
            onUpdate={updateCustomAiFriend}
            onAvatarUpload={saveAiFriendAvatar}
            onClearAvatar={clearAiFriendAvatar}
            onSaveLlmConfig={saveAiFriendLlmConfig}
            onSaveTtsConfig={saveAiFriendTtsConfig}
            onDelete={deleteCustomAiFriend}
            onExportRoleRoster={exportRoleRoster}
            onOpenRoleRosterImport={() => setRoleRosterImportOpen(true)}
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
            <AiTuningReference className="mobile-ai-tuning-reference" />
          </div>
        </section>

        {roleRosterError && (
          <div className="rounded-2xl border border-[#f1c76e]/20 bg-black/22 px-4 py-3 text-sm text-[#f1d796]">
            {roleRosterError}
          </div>
        )}

        {roleRosterImportOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-roster-import-title"
            className="fixed inset-0 z-[70] overflow-y-auto bg-black/84 px-3 py-5 backdrop-blur-md sm:px-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setRoleRosterImportOpen(false);
            }}
          >
            <section
              className="mx-auto grid w-full max-w-3xl gap-4 rounded-[28px] border border-[#7da8e3]/28 bg-[#0d1623]/96 p-4 shadow-2xl shadow-black/70 sm:p-5"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="role-roster-import-title" className="text-lg font-semibold text-[#e4efff]">导入角色名册</h2>
                <button
                  type="button"
                  onClick={() => setRoleRosterImportOpen(false)}
                  className="rounded-full border border-white/12 px-3 py-2 text-sm text-[#dcc9a7] transition hover:bg-white/8"
                >
                  关闭
                </button>
              </div>
              <textarea
                value={roleRosterImportText}
                onChange={(event) => setRoleRosterImportText(event.target.value)}
                rows={12}
                className="w-full resize-y rounded-2xl border border-[#7da8e3]/18 bg-black/32 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
                placeholder="粘贴角色名册 JSON"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => importRoleRoster("append")}
                  className="rounded-full bg-[#2f8157] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#379566]"
                >
                  追加导入
                </button>
                <button
                  type="button"
                  onClick={() => importRoleRoster("overwrite")}
                  className="rounded-full border border-[#e46d55]/30 bg-[#2b1110]/60 px-4 py-2 text-sm font-semibold text-[#ffb1a4] transition hover:bg-[#3a1712]"
                >
                  覆盖当前角色
                </button>
              </div>
            </section>
          </div>
        )}
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
            给当前勾选的 {selectedCount} 位 AI 批量套用 LLM 预设。可只补齐还没配置模型的 AI，也可以替换所有已勾选 AI 的 LLM 配置。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="shrink-0 rounded-full border border-[#7da8e3]/25 bg-[#7da8e3]/10 px-3 py-2 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/16"
        >
          {open ? "收起" : "配置"}
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
          <p className="text-[11px] leading-5 text-[#ad9c7d]">补齐配置只会修改还没有自定义 LLM 的 AI；覆盖配置会替换当前勾选 AI 的 LLM 设置。</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApplyFillBlanks}
              disabled={selectedCount === 0}
              className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/55 px-4 py-2 text-xs font-semibold text-[#a8f0b6] disabled:opacity-45"
            >
              补齐未配置 AI
            </button>
            <button
              type="button"
              onClick={onApplyOverwrite}
              disabled={selectedCount === 0}
              className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
            >
              覆盖已勾选 AI
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

function AiPoolList({
  friends,
  templateFriends,
  aiRuntimeConfig,
  aiLlmSecrets,
  selectedIds,
  onToggle,
  onCopy,
  onUpdate,
  onAvatarUpload,
  onClearAvatar,
  onSaveLlmConfig,
  onSaveTtsConfig,
  onDelete,
  onExportRoleRoster,
  onOpenRoleRosterImport,
}: {
  friends: AiFriendOption[];
  templateFriends: AiFriendOption[];
  aiRuntimeConfig: AiRuntimeConfig | null;
  aiLlmSecrets: AiFriendLlmSecretMap;
  selectedIds: string[];
  onToggle: (friendId: string) => void;
  onCopy: (friendId: string) => void;
  onUpdate: (friendId: string, patch: Partial<AiFriendConfig>) => void;
  onAvatarUpload: (friend: AiFriendOption, file: File) => void;
  onClearAvatar: (friend: AiFriendOption) => void;
  onSaveLlmConfig: (friend: AiFriendOption, llmConfig: AiFriendLlmConfig, apiKey: string) => void;
  onSaveTtsConfig: (friend: AiFriendOption, ttsConfig: AiFriendTtsConfig, apiKey: string) => void;
  onDelete: (friendId: string) => void;
  onExportRoleRoster: () => void;
  onOpenRoleRosterImport: () => void;
}) {
  const baseOptions = templateFriends;

  return (
    <section className="mobile-ai-pool-list mobile-ai-role-roster rounded-[28px] border border-[#77d898]/20 bg-[#0f2118]/76 p-4 shadow-2xl shadow-black/35 backdrop-blur-md sm:p-5">
      <div className="mobile-ai-pool-list-head mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#dff4df]">角色名册</h2>
          <p className="mobile-ai-pool-description mt-1 text-sm text-[#9fc8a7]">
            勾选后会按顺序加入下一局；角色名、头像和真实 LLM 人设会随开局配置进入牌桌。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onExportRoleRoster}
            className="rounded-full border border-[#f1c76e]/25 bg-[#f1c76e]/10 px-3 py-2 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/16"
          >
            导出角色
          </button>
          <button
            type="button"
            onClick={onOpenRoleRosterImport}
            className="rounded-full border border-[#7da8e3]/25 bg-[#7da8e3]/10 px-3 py-2 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/16"
          >
            导入角色
          </button>
          <span className="mobile-ai-save-pill rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-3 py-1 text-xs text-[#a8f0b6]">
            本地保存
          </span>
        </div>
      </div>
      <div className="mobile-ai-pool-grid grid gap-3 lg:grid-cols-2">
        {friends.map((friend) => {
          const selected = selectedIds.includes(friend.id);
          const hasCustomAvatar = Boolean(friend.avatarDataUrl);
          return (
            <article
              key={friend.id}
              className={[
                "mobile-ai-pool-card overflow-hidden rounded-2xl border transition",
                selected ? "border-[#77d898]/42 bg-[#10261a]/82" : "border-[#f1c76e]/14 bg-black/20",
              ].join(" ")}
            >
              <details className="mobile-ai-card-config mobile-ai-profile-card">
                <summary className="mobile-ai-profile-summary cursor-pointer list-none p-3">
                  <div className="mobile-ai-card-main flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggle(friend.id)}
                      className="mobile-ai-select h-4 w-4 accent-[#77d898]"
                      aria-label={`选择${friend.nickname}`}
                    />
                    <AiFriendAvatar friend={friend} size="large" />
                    <div className="mobile-ai-card-info min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="mobile-ai-card-name min-w-0 truncate font-semibold text-[#f7ead5]">{friend.nickname}</span>
                        <span className="mobile-ai-card-type shrink-0 rounded-full border border-[#77d898]/18 bg-[#0f2118]/44 px-2 py-0.5 text-[11px] text-[#a8f0b6]">
                          {selected ? "已入局" : "待入局"}
                        </span>
                      </div>
                      <div className="mobile-ai-card-persona mt-1 truncate text-xs text-[#ad9c7d]">{friend.basePersonaLabel}</div>
                      <div className="mobile-ai-card-source mt-1 truncate text-[11px] text-[#f1d796]">
                        人物来源 · {friend.roleCard?.source || "未填写"}
                      </div>
                      <div className="mobile-ai-card-tags mobile-ai-summary-meta mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="mobile-ai-card-template rounded-full border border-[#f1c76e]/20 px-2 py-0.5 text-[11px] text-[#f1d796]">
                          {formatPersonaTemplateStatus(friend)}
                        </span>
                        {friend.basePersonaModelLabel && (
                          <span className="mobile-ai-card-model max-w-[150px] truncate rounded-full border border-[#7da8e3]/20 bg-[#0d1623]/55 px-2 py-0.5 text-[11px] text-[#b8d6ff]" title={friend.basePersonaModelLabel}>
                            {formatLlmStatus(aiRuntimeConfig, friend)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="mobile-ai-config-entry shrink-0 rounded-full border border-[#f1c76e]/24 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#f1d796]">
                      配置
                    </span>
                  </div>
                </summary>

                <div className="mobile-ai-profile-panel border-t border-white/10 p-3" role="dialog" aria-label={`${friend.nickname}配置`}>
                  <div className="mobile-ai-config-overlay-head mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-[#f7ead5]">{friend.nickname}</div>
                      <div className="mt-0.5 truncate text-xs text-[#ad9c7d]">{friend.basePersonaLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                      className="rounded-full border border-[#f1c76e]/24 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
                    >
                      关闭
                    </button>
                  </div>
                  <div className="mobile-ai-panel-status mb-3 flex flex-wrap items-center gap-2">
                    <span className="mobile-ai-card-template rounded-full border border-[#f1c76e]/20 px-2 py-0.5 text-[11px] text-[#f1d796]">
                      {friend.isDefault ? "内置AI" : "自定义AI"}
                    </span>
                    <span className="mobile-ai-card-model max-w-[190px] truncate rounded-full border border-[#7da8e3]/20 bg-[#0d1623]/55 px-2 py-0.5 text-[11px] text-[#b8d6ff]" title={friend.basePersonaModelLabel ?? ""}>
                      {formatLlmStatus(aiRuntimeConfig, friend)}
                    </span>
                    <span className="mobile-ai-card-voice max-w-[220px] truncate rounded-full border border-[#77d898]/18 bg-[#0f2118]/55 px-2 py-0.5 text-[11px] text-[#a8f0b6]" title={`发言声音：${formatTtsStatus(aiRuntimeConfig, friend)}`}>
                      发言声音 · {formatTtsStatus(aiRuntimeConfig, friend)}
                    </span>
                  </div>
                  <div className="mobile-ai-avatar-actions flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/14 px-2 py-2">
                    <label className="mobile-ai-upload cursor-pointer rounded-full border border-[#7da8e3]/24 bg-[#0d1623]/55 px-3 py-1.5 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/12">
                      {hasCustomAvatar ? "更换头像" : "上传头像"}
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
                    {hasCustomAvatar && (
                      <button
                        type="button"
                        onClick={() => onClearAvatar(friend)}
                        className="rounded-full border border-[#e46d55]/25 bg-[#2b1110]/45 px-3 py-1.5 text-xs font-semibold text-[#ffb1a4] transition hover:bg-[#3a1712]"
                      >
                        移除头像
                      </button>
                    )}
                    <span className="mobile-ai-avatar-help text-[11px] text-[#9fc8a7]">头像会显示在开局预览和牌桌座位卡。</span>
                  </div>
                  <div className="mobile-ai-card-actions mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onCopy(friend.id)}
                      className="mobile-ai-copy-action rounded-full border border-[#f1c76e]/22 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
                    >
                      复制为自定义
                    </button>
                    {!friend.isDefault && (
                      <button
                        type="button"
                        onClick={() => onDelete(friend.id)}
                        className="rounded-full border border-[#e46d55]/25 bg-[#2b1110]/50 px-3 py-1.5 text-xs font-semibold text-[#ffb1a4] transition hover:bg-[#3a1712]"
                      >
                        删除
                      </button>
                    )}
                  </div>

                  <div className="mobile-ai-config-stack mt-3 grid gap-3">
                    <details className="mobile-ai-config-section rounded-2xl border border-[#f1c76e]/14 bg-black/16 p-3" open={!friend.isDefault}>
                      <summary className="mobile-ai-config-summary cursor-pointer list-none text-xs font-semibold text-[#f1d796]">
                        <span className="mobile-ai-config-title">角色详情</span>
                        <span className="mobile-ai-config-control text-[#f1d796]/72">
                          <span className="mobile-ai-config-status">{friend.roleCard?.source || (friend.isDefault ? "复制后编辑" : "待填写")}</span>
                          <span className="mobile-ai-config-action border-[#f1c76e]/25 bg-[#f1c76e]/10 text-[#f1d796]">
                            {friend.isDefault ? "只读" : "编辑"}
                          </span>
                          <span className="mobile-ai-config-chevron">⌄</span>
                        </span>
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1 text-xs text-[#ad9c7d]">
                          角色名
                          <input
                            value={friend.nickname}
                            maxLength={16}
                            placeholder="例如：侦探位"
                            disabled={friend.isDefault}
                            onChange={(event) => onUpdate(friend.id, { nickname: event.target.value.slice(0, 16) })}
                            className="rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[#ad9c7d]">
                          人物来源
                          <input
                            value={friend.roleCard?.source ?? ""}
                            maxLength={80}
                            placeholder="例如：名侦探角色 / 三国谋士 / 你喜欢的人物"
                            disabled={friend.isDefault}
                            onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "source", event.target.value))}
                            className="rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[#ad9c7d]">
                          说话方式
                          <textarea
                            value={friend.roleCard?.speakingStyle ?? ""}
                            maxLength={240}
                            rows={2}
                            placeholder="例如：短句、直接、先落结论。"
                            disabled={friend.isDefault}
                            onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "speakingStyle", event.target.value))}
                            className="resize-none rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[#ad9c7d]">
                          推理习惯
                          <textarea
                            value={friend.roleCard?.reasoningStyle ?? ""}
                            maxLength={240}
                            rows={2}
                            placeholder="例如：先找证据链，再压关键矛盾。"
                            disabled={friend.isDefault}
                            onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "reasoningStyle", event.target.value))}
                            className="resize-none rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[#ad9c7d]">
                          不要做什么
                          <textarea
                            value={friend.roleCard?.avoid ?? ""}
                            maxLength={240}
                            rows={2}
                            placeholder="例如：不要复读固定台词，不要出戏说自己是 AI。"
                            disabled={friend.isDefault}
                            onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "avoid", event.target.value))}
                            className="resize-none rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
                          />
                        </label>
                      </div>
                    </details>
                    <details className="mobile-ai-config-section rounded-2xl border border-[#7da8e3]/14 bg-[#0d1623]/42 p-3">
                      <summary className="mobile-ai-config-summary cursor-pointer list-none text-xs font-semibold text-[#d8e7ff]">
                        <span className="mobile-ai-config-title">模型接口</span>
                        <span className="mobile-ai-config-control text-[#b8d6ff]/72">
                          <span className="mobile-ai-config-status">{formatLlmStatus(aiRuntimeConfig, friend)}</span>
                          <span className="mobile-ai-config-action border-[#7da8e3]/25 bg-[#7da8e3]/10 text-[#b8d6ff]">配置</span>
                          <span className="mobile-ai-config-chevron">⌄</span>
                        </span>
                      </summary>
                      <div className="mt-3">
                        <AiCardModelConfig
                          key={`${friend.id}:${friend.llmConfig?.baseUrl ?? ""}:${friend.llmConfig?.model ?? ""}:${aiLlmSecrets[friend.id]?.apiKey ?? ""}`}
                          friend={friend}
                          aiRuntimeConfig={aiRuntimeConfig}
                          apiKey={aiLlmSecrets[friend.id]?.apiKey ?? ""}
                          onSave={onSaveLlmConfig}
                        />
                      </div>
                    </details>
                    <details className="mobile-ai-config-section rounded-2xl border border-[#77d898]/14 bg-[#0f2118]/42 p-3">
                      <summary className="mobile-ai-config-summary cursor-pointer list-none text-xs font-semibold text-[#dff4df]">
                        <span className="mobile-ai-config-title">语音接口</span>
                        <span className="mobile-ai-config-control text-[#a8f0b6]/72">
                          <span className="mobile-ai-config-status">{formatTtsStatus(aiRuntimeConfig, friend)}</span>
                          <span className="mobile-ai-config-action border-[#77d898]/25 bg-[#77d898]/10 text-[#a8f0b6]">配置</span>
                          <span className="mobile-ai-config-chevron">⌄</span>
                        </span>
                      </summary>
                      <div className="mt-3">
                        <AiCardTtsConfig
                          key={`${friend.id}:tts:${friend.ttsConfig?.baseUrl ?? ""}:${friend.ttsConfig?.model ?? ""}:${friend.ttsConfig?.voice ?? friend.ttsVoice ?? ""}:${aiLlmSecrets[friend.id]?.ttsApiKey ?? ""}`}
                          friend={friend}
                          aiRuntimeConfig={aiRuntimeConfig}
                          apiKey={aiLlmSecrets[friend.id]?.ttsApiKey ?? ""}
                          onSave={onSaveTtsConfig}
                        />
                      </div>
                    </details>
                  </div>
                  <PersonaTypeBriefList
                    options={baseOptions}
                    activeBasePersonaId={friend.basePersonaId}
                    onSelect={
                      friend.isDefault
                        ? undefined
                        : (basePersonaId) => onUpdate(friend.id, applyAiFriendPersonaTemplate(friend, basePersonaId))
                    }
                  />
                </div>
              </details>
            </article>
          );
        })}
      </div>
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

function PersonaTypeBriefList({
  options,
  activeBasePersonaId,
  onSelect,
}: {
  options: AiFriendOption[];
  activeBasePersonaId: string;
  onSelect?: (basePersonaId: string) => void;
}) {
  return (
    <section className="mobile-ai-persona-type-briefs mt-3 rounded-2xl border border-[#f1c76e]/12 bg-black/14 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-[#f1d796]">打法类型速览</h3>
        <span className="text-[11px] text-[#dcc9a7]/62">选择类型会自动套用默认倾向</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option.basePersonaId === activeBasePersonaId;
          const className = `mobile-ai-persona-type-option rounded-2xl border px-3 py-2 text-left ${
            active
              ? "border-[#f1c76e]/32 bg-[#2b220e]/70"
              : "border-[#f1c76e]/10 bg-black/16"
          }`;
          const content = (
            <>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="truncate text-xs font-semibold text-[#f1d796]">{option.basePersonaLabel}</div>
                {active && <span className="shrink-0 rounded-full bg-[#f1c76e]/14 px-2 py-0.5 text-[10px] text-[#f1d796]">当前</span>}
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#dcc9a7]/76">
                {AI_TUNING_EXPLANATION_BY_LABEL.get(option.basePersonaLabel) ?? `${option.basePersonaName} 的默认打法倾向。`}
              </div>
            </>
          );
          if (onSelect) {
            return (
              <button
                key={option.basePersonaId}
                type="button"
                onClick={() => onSelect(option.basePersonaId)}
                className={`${className} transition hover:border-[#f1c76e]/30 hover:bg-[#2b220e]/48`}
                aria-pressed={active}
              >
                {content}
              </button>
            );
          }
          return (
            <div key={option.basePersonaId} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AiTuningReference({ className = "" }: { className?: string }) {
  return (
    <aside className={`rounded-[24px] border border-[#77d898]/22 bg-[#0f2118]/76 p-4 text-xs leading-5 text-[#9fc8a7] shadow-2xl shadow-black/30 backdrop-blur-md ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-[#dff4df]">参数说明</span>
        <span className="text-[11px] text-[#77d898]/70">调参参考</span>
      </div>
      <div className="grid gap-2">
        {AI_TUNING_EXPLANATIONS.map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg border border-[#77d898]/10 bg-[#07140d]/42 px-2.5 py-2">
            <div className="font-semibold text-[#a8f0b6]">{item.label}</div>
            <div className="mt-0.5 text-[#b8e8c0]/82">{item.detail}</div>
          </div>
        ))}
      </div>
    </aside>
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

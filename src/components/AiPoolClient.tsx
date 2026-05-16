"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH,
  AI_FRIEND_PREFERENCE_KEYS,
  copyAiFriend,
  parseAiFriendExport,
  sanitizeCustomAiFriends,
  serializeAiFriendExport,
} from "@/game/aiFriends";
import type { AiFriendConfig, AiFriendLlmConfig, AiFriendTtsConfig, AiPersonaPreferences, AiRuntimeMode } from "@/game/types";
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
import { MODEL_CARD_IMAGES, ROLE_CARD_IMAGES } from "./game/viewHelpers";

const AI_FRIEND_PREFERENCE_LABELS: Record<keyof AiPersonaPreferences, string> = {
  logic: "逻辑",
  identity: "身份",
  vote: "票型",
  emotion: "情绪",
  memory: "记忆",
  leadership: "带队",
  deception: "诈术",
  caution: "谨慎",
};

const AI_TUNING_EXPLANATIONS: Array<{ label: string; detail: string }> = [
  { label: "风险", detail: "越高越敢强推、悍跳、硬站边；越低越偏保守观察。" },
  { label: "诈身份", detail: "越高越可能用身份口径施压或替神挡刀；越低越少假装神职。" },
  { label: "逻辑", detail: "重视发言顺序、矛盾、因果链，发言更像拆盘。" },
  { label: "身份", detail: "更关注预言家、女巫、猎人、守卫等身份线和对跳关系。" },
  { label: "票型", detail: "更重视投票结果、归票收益、分票和跟票行为。" },
  { label: "情绪", detail: "更容易根据强势发言、犹豫、攻击性调整判断和语气。" },
  { label: "记忆", detail: "更会引用前几轮发言、改口、历史站边和长期矛盾。" },
  { label: "带队", detail: "越高越主动归票、收束桌面；越低越倾向给观察和边界。" },
  { label: "诈术", detail: "更擅长伪装视角、切割、倒钩和制造公开逻辑压力。" },
  { label: "谨慎", detail: "越高越少冒进拍身份或冲票，更强调留后路和二次验证。" },
];

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

export function AiPoolClient() {
  const [loaded, setLoaded] = useState(false);
  const [customAiFriends, setCustomAiFriends] = useState<AiFriendConfig[]>([]);
  const [aiLlmSecrets, setAiLlmSecrets] = useState<AiFriendLlmSecretMap>({});
  const [selectedAiFriendIds, setSelectedAiFriendIds] = useState<string[]>(getDefaultSelectedAiFriendIds);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<AiRuntimeMode>("mock");
  const [aiTransferText, setAiTransferText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [quickAddNickname, setQuickAddNickname] = useState("");
  const [quickAddBaseId, setQuickAddBaseId] = useState(() => getDefaultSelectedAiFriendIds()[0] ?? "");
  const [quickAddUseCustomLlm, setQuickAddUseCustomLlm] = useState(false);
  const [quickAddLlmLabel, setQuickAddLlmLabel] = useState("");
  const [quickAddLlmBaseUrl, setQuickAddLlmBaseUrl] = useState(DEFAULT_CUSTOM_LLM_BASE_URL);
  const [quickAddLlmModel, setQuickAddLlmModel] = useState("");
  const [quickAddLlmApiKey, setQuickAddLlmApiKey] = useState("");
  const [quickAddMergeSystemIntoUser, setQuickAddMergeSystemIntoUser] = useState(false);
  const [quickAddTtsVoice, setQuickAddTtsVoice] = useState("");
  const [aiRuntimeConfig, setAiRuntimeConfig] = useState<AiRuntimeConfig | null>(null);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCustomAiFriends(readStoredCustomAiFriends());
      setAiLlmSecrets(readStoredAiFriendLlmSecrets());
      setSelectedAiFriendIds(readStoredSelectedAiFriendIds());
      setAiRuntimeMode(readStoredAiRuntimeMode());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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

  const saveAiFriendLlmConfig = useCallback((friend: AiFriendOption, llmConfig: AiFriendLlmConfig, apiKey: string) => {
    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
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
    setImportError(null);
  }, []);

  const saveAiFriendTtsConfig = useCallback((friend: AiFriendOption, ttsConfig: AiFriendTtsConfig, apiKey: string) => {
    const now = new Date().toISOString();
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
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
    setImportError(null);
  }, []);

  const copyAiFriendToCustom = useCallback(
    (friendId: string) => {
      const source = aiFriends.find((friend) => friend.id === friendId);
      if (!source) return;
      const next = copyAiFriend(source);
      setCustomAiFriends((current) => [...current, next]);
      setSelectedAiFriendIds((current) => [...current, next.id]);
      setImportError(null);
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
      setImportError("自定义大模型需要填写有效的接口地址和模型名称。");
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
    setImportError(null);
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
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "头像上传失败。");
    }
  }, []);

  const clearAiFriendAvatar = useCallback(
    (friend: AiFriendOption) => {
      if (friend.isDefault || !friend.avatarDataUrl) return;
      updateCustomAiFriend(friend.id, { avatarDataUrl: undefined });
      setImportError(null);
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

  const exportCustomAi = useCallback(() => {
    setAiTransferText(serializeAiFriendExport(customAiFriends));
    setImportError(null);
  }, [customAiFriends]);

  const importCustomAi = useCallback(() => {
    try {
      const imported = parseAiFriendExport(aiTransferText);
      const sanitized = sanitizeCustomAiFriends(imported);
      setCustomAiFriends(sanitized);
      setAiLlmSecrets((current) => {
        const validIds = new Set(sanitized.map((friend) => friend.id));
        return Object.fromEntries(Object.entries(current).filter(([friendId]) => validIds.has(friendId)));
      });
      setSelectedAiFriendIds((current) => [
        ...current.filter((id) => id.startsWith("default:")),
        ...sanitized.map((friend) => friend.id),
      ]);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "自定义AI导入失败。");
    }
  }, [aiTransferText]);

  const selectedCount = selectedAiFriends.length;

  return (
    <main
      className="min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.9)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mx-auto grid min-h-screen w-full max-w-[1400px] content-start gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7da8e3]/24 bg-[#0d1623]/82 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
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
          />
          <div className="grid content-start gap-4">
            <AiRuntimeModeCard mode={aiRuntimeMode} aiRuntimeConfig={aiRuntimeConfig} onModeChange={setAiRuntimeMode} />
            <CustomAiTransferCard
              baseFriends={baseAiFriends}
              selectedFriends={selectedAiFriends}
              selectedCount={selectedCount}
              customCount={customAiFriends.length}
              quickAddNickname={quickAddNickname}
              quickAddBaseId={quickAddBaseId}
              quickAddUseCustomLlm={quickAddUseCustomLlm}
              quickAddLlmLabel={quickAddLlmLabel}
              quickAddLlmBaseUrl={quickAddLlmBaseUrl}
              quickAddLlmModel={quickAddLlmModel}
              quickAddLlmApiKey={quickAddLlmApiKey}
              quickAddMergeSystemIntoUser={quickAddMergeSystemIntoUser}
              quickAddTtsVoice={quickAddTtsVoice}
              aiRuntimeConfig={aiRuntimeConfig}
              value={aiTransferText}
              error={importError}
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
              onChange={setAiTransferText}
              onExport={exportCustomAi}
              onImport={importCustomAi}
            />
            <AiTuningReference />
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
    <section className="rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
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
}) {
  const baseOptions = templateFriends;

  return (
    <section className="rounded-[28px] border border-[#77d898]/20 bg-[#0f2118]/76 p-4 shadow-2xl shadow-black/35 backdrop-blur-md sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#dff4df]">AI池</h2>
          <p className="mt-1 text-sm text-[#9fc8a7]">勾选后会按顺序加入下一局，不足座位由默认 AI 自动补齐；12 人局会补满 11 位 AI，并自动改名避免重名。</p>
        </div>
        <span className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-3 py-1 text-xs text-[#a8f0b6]">
          本地保存
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {friends.map((friend) => {
          const selected = selectedIds.includes(friend.id);
          const hasCustomAvatar = Boolean(friend.avatarDataUrl);
          return (
            <article
              key={friend.id}
              className={[
                "rounded-2xl border p-3 transition",
                selected ? "border-[#77d898]/42 bg-[#10261a]/82" : "border-[#f1c76e]/14 bg-black/20",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(friend.id)}
                  className="mt-1 h-4 w-4 accent-[#77d898]"
                  aria-label={`选择${friend.nickname}`}
                />
                <AiFriendAvatar friend={friend} className="mt-0.5" size="large" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#f7ead5]">{friend.nickname}</span>
                    <span className="rounded-full border border-[#f1c76e]/20 px-2 py-0.5 text-[11px] text-[#f1d796]">
                      {formatPersonaTemplateStatus(friend)}
                    </span>
                    {friend.basePersonaModelLabel && (
                    <span className="max-w-[150px] truncate rounded-full border border-[#7da8e3]/20 bg-[#0d1623]/55 px-2 py-0.5 text-[11px] text-[#b8d6ff]" title={friend.basePersonaModelLabel}>
                      {formatLlmStatus(aiRuntimeConfig, friend)}
                    </span>
                    )}
                    <span className="max-w-[170px] truncate rounded-full border border-[#77d898]/18 bg-[#0f2118]/55 px-2 py-0.5 text-[11px] text-[#a8f0b6]" title={`发言声音：${formatTtsStatus(aiRuntimeConfig, friend)}`}>
                      发言声音 · {formatTtsStatus(aiRuntimeConfig, friend)}
                    </span>
                    <span className="text-[11px] text-[#9fc8a7]">{friend.isDefault ? "内置AI" : "自定义AI"}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#ad9c7d]">{friend.basePersonaLabel}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/14 px-2 py-2">
                    <label className="cursor-pointer rounded-full border border-[#7da8e3]/24 bg-[#0d1623]/55 px-3 py-1.5 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/12">
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
                    <span className="text-[11px] text-[#9fc8a7]">头像会显示在开局预览和牌桌座位卡。</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onCopy(friend.id)}
                    className="rounded-full border border-[#f1c76e]/22 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
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
              </div>

              <details className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-[#dcc9a7]">配置这个 AI</summary>
                <div className="mt-3 grid gap-3">
                  <AiCardModelConfig
                    key={`${friend.id}:${friend.llmConfig?.baseUrl ?? ""}:${friend.llmConfig?.model ?? ""}:${aiLlmSecrets[friend.id]?.apiKey ?? ""}`}
                    friend={friend}
                    aiRuntimeConfig={aiRuntimeConfig}
                    apiKey={aiLlmSecrets[friend.id]?.apiKey ?? ""}
                    onSave={onSaveLlmConfig}
                  />
                  <AiCardTtsConfig
                    key={`${friend.id}:tts:${friend.ttsConfig?.baseUrl ?? ""}:${friend.ttsConfig?.model ?? ""}:${friend.ttsConfig?.voice ?? friend.ttsVoice ?? ""}:${aiLlmSecrets[friend.id]?.ttsApiKey ?? ""}`}
                    friend={friend}
                    aiRuntimeConfig={aiRuntimeConfig}
                    apiKey={aiLlmSecrets[friend.id]?.ttsApiKey ?? ""}
                    onSave={onSaveTtsConfig}
                  />
                  {!friend.isDefault && (
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-xs text-[#ad9c7d]">
                      昵称
                      <input
                        value={friend.nickname}
                        maxLength={16}
                        onChange={(event) => onUpdate(friend.id, { nickname: event.target.value })}
                        className="rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45"
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-[#ad9c7d]">
                      打法模板
                      <select
                        value={friend.basePersonaId}
                        onChange={(event) => onUpdate(friend.id, { basePersonaId: event.target.value })}
                        className="rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45"
                      >
                        {baseOptions.map((option) => (
                          <option key={option.basePersonaId} value={option.basePersonaId}>
                            {formatPersonaTemplateOptionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <AiPoolSlider label="风险" value={friend.riskTolerance} onChange={(value) => onUpdate(friend.id, { riskTolerance: value })} />
                        <AiPoolSlider label="诈身份" value={friend.bluffing} onChange={(value) => onUpdate(friend.id, { bluffing: value })} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          {AI_FRIEND_PREFERENCE_KEYS.map((key) => (
                            <AiPoolSlider
                              key={key}
                              label={AI_FRIEND_PREFERENCE_LABELS[key]}
                              value={friend.preferences[key]}
                              onChange={(value) =>
                                onUpdate(friend.id, {
                                  preferences: {
                                    ...friend.preferences,
                                    [key]: value,
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
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

function AiPoolSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs text-[#ad9c7d]">
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0">{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="w-full min-w-0 accent-[#77d898]"
      />
    </label>
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
  customCount,
  quickAddNickname,
  quickAddBaseId,
  quickAddUseCustomLlm,
  quickAddLlmLabel,
  quickAddLlmBaseUrl,
  quickAddLlmModel,
  quickAddLlmApiKey,
  quickAddMergeSystemIntoUser,
  quickAddTtsVoice,
  value,
  error,
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
  onChange,
  onExport,
  onImport,
}: {
  baseFriends: AiFriendOption[];
  aiRuntimeConfig: AiRuntimeConfig | null;
  selectedFriends: AiFriendOption[];
  selectedCount: number;
  customCount: number;
  quickAddNickname: string;
  quickAddBaseId: string;
  quickAddUseCustomLlm: boolean;
  quickAddLlmLabel: string;
  quickAddLlmBaseUrl: string;
  quickAddLlmModel: string;
  quickAddLlmApiKey: string;
  quickAddMergeSystemIntoUser: boolean;
  quickAddTtsVoice: string;
  value: string;
  error: string | null;
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
  onChange: (value: string) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const quickAddCustomLlmConfig = quickAddUseCustomLlm
    ? buildCustomLlmConfig({
        label: quickAddLlmLabel,
        baseUrl: quickAddLlmBaseUrl,
        model: quickAddLlmModel,
        mergeSystemIntoUser: quickAddMergeSystemIntoUser,
      })
    : undefined;

  return (
    <div className="grid content-start gap-4">
      <section className="rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#e4efff]">快速新增AI</h2>
            <p className="mt-1 text-xs text-[#b8d6ff]/72">填昵称，选择或填写 AI 大模型，再选发言声音，保存后自动加入本局队列。</p>
          </div>
          <span className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/10 px-2 py-1 text-xs text-[#b8d6ff]">
            表单
          </span>
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
          <button
            type="button"
            onClick={onQuickAdd}
            disabled={baseFriends.length === 0}
            className="rounded-full bg-[#2f8157] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-[#379566] disabled:opacity-45"
          >
            添加并入队
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#77d898]/22 bg-[#0f2118]/76 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
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
          <div className="max-h-[330px] space-y-2 overflow-auto pr-1">
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

      <section className="rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
        <details>
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#e4efff]">高级导入导出</h2>
              <span className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/10 px-2 py-1 text-xs text-[#b8d6ff]">
                {selectedCount} 入局 · {customCount} 已保存
              </span>
            </div>
            <p className="mt-1 text-xs text-[#b8d6ff]/68">迁移配置时再展开使用。</p>
          </summary>
          <div className="mt-3">
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              rows={9}
              className="w-full resize-none rounded-2xl border border-[#7da8e3]/16 bg-black/24 px-3 py-2 text-xs leading-5 text-[#d8e7ff] outline-none focus:border-[#7da8e3]/45"
            />
            {error && <div className="mt-2 rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">{error}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExport}
                className="rounded-full border border-[#7da8e3]/25 bg-black/18 px-3 py-2 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
              >
                导出 JSON
              </button>
              <button
                type="button"
                onClick={onImport}
                className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/55 px-3 py-2 text-xs font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75"
              >
                导入 JSON
              </button>
            </div>
          </div>
        </details>
      </section>
      <section className="rounded-[24px] border border-[#f1c76e]/22 bg-[#130d0b]/80 p-4 text-sm leading-6 text-[#dcc9a7] shadow-2xl shadow-black/30 backdrop-blur-md">
        复制内置 AI 后会生成一个可编辑的自定义AI。开局页会读取这里保存的入局选择。
      </section>
    </div>
  );
}

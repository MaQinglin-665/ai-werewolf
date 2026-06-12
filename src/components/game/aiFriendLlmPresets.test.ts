import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import { describe, expect, it, vi } from "vitest";
import { buildAiFriendOptions } from "./aiFriendStorage";
import {
  AI_FRIEND_LLM_PRESETS_STORAGE_KEY,
  applyLlmPresetToSelectedAiFriends,
  readStoredAiFriendLlmPresetState,
  writeStoredAiFriendLlmPresetState,
  type AiFriendLlmPreset,
} from "./aiFriendLlmPresets";

const now = "2026-05-27T00:00:00.000Z";

const preset: AiFriendLlmPreset = {
  id: "preset-deepseek",
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "secret-key",
  mergeSystemIntoUser: true,
  createdAt: now,
  updatedAt: now,
};

describe("aiFriendLlmPresets storage", () => {
  it("round-trips sanitized presets and the last used preset id", () => {
    withFakeWindow(() => {
      writeStoredAiFriendLlmPresetState({
        presets: [
          {
            ...preset,
            name: "  DeepSeek   Main  ",
            baseUrl: "https://api.deepseek.com/v1/",
            apiKey: "  secret-key  ",
          },
        ],
        lastUsedPresetId: "preset-deepseek",
      });

      expect(readStoredAiFriendLlmPresetState()).toEqual({
        presets: [
          {
            ...preset,
            name: "DeepSeek Main",
            baseUrl: "https://api.deepseek.com/v1",
          },
        ],
        lastUsedPresetId: "preset-deepseek",
      });
    });
  });

  it("ignores malformed storage values", () => {
    withFakeWindow((fakeWindow) => {
      fakeWindow.localStorage.setItem(AI_FRIEND_LLM_PRESETS_STORAGE_KEY, "{bad json");

      expect(readStoredAiFriendLlmPresetState()).toEqual({ presets: [] });
    });
  });
});

describe("applyLlmPresetToSelectedAiFriends", () => {
  it("fills only selected friends without custom LLM configs", () => {
    const defaults = buildAiFriendOptions([]);
    const configured = copyAiFriend(getDefaultAiFriends(now)[1]!, {
      id: "friend-configured-llm:claude",
      now,
    });
    configured.llmConfig = {
      provider: "openai-compatible",
      label: "Existing",
      baseUrl: "https://existing.example.com/v1",
      model: "existing-model",
    };
    const options = buildAiFriendOptions([configured]);

    const result = applyLlmPresetToSelectedAiFriends({
      aiFriends: options,
      customAiFriends: [configured],
      selectedAiFriendIds: [defaults[0]!.id, configured.id],
      aiLlmSecrets: { [configured.id]: { apiKey: "existing-secret" } },
      preset,
      mode: "fill-blanks",
      now,
    });

    expect(result.results).toEqual([
      expect.objectContaining({ friendName: defaults[0]!.nickname, status: "filled" }),
      expect.objectContaining({ friendName: configured.nickname, status: "skipped" }),
    ]);
    expect(result.selectedAiFriendIds).toEqual([`friend-configured-llm:${defaults[0]!.basePersonaId}`, configured.id]);
    expect(result.aiLlmSecrets[result.selectedAiFriendIds[0]!]?.apiKey).toBe("secret-key");
    expect(result.aiLlmSecrets[configured.id]?.apiKey).toBe("existing-secret");
  });

  it("overwrites all selected friends and preserves non-LLM fields", () => {
    const custom = copyAiFriend(getDefaultAiFriends(now)[2]!, {
      id: "custom-friend",
      now,
    });
    custom.nickname = "自定义玩家";
    custom.avatarDataUrl = "data:image/webp;base64,AAAA";
    custom.ttsVoice = "default_zh";
    custom.roleCard = {
      id: "local-role",
      displayName: "本地角色",
      theme: "ordinary",
      styleTags: ["steady"],
      speechStyleZh: "说人话，别绕。",
      reasoningBias: "抓公开发言。",
      voteBias: "按公开理由投。",
      nightActionBias: "合法行动。",
      asVillager: "正常找狼。",
      asWerewolf: "正常伪装。",
      pressureResponse: "解释自己听到的点。",
      relationshipHints: [],
      catchphrasePolicy: "不加口癖。",
      forbidden: [],
    };
    custom.llmConfig = {
      provider: "openai-compatible",
      label: "Old",
      baseUrl: "https://old.example.com/v1",
      model: "old-model",
    };

    const result = applyLlmPresetToSelectedAiFriends({
      aiFriends: buildAiFriendOptions([custom]),
      customAiFriends: [custom],
      selectedAiFriendIds: [custom.id],
      aiLlmSecrets: { [custom.id]: { apiKey: "old-secret", ttsApiKey: "tts-secret" } },
      preset,
      mode: "overwrite",
      now,
    });

    expect(result.results).toEqual([expect.objectContaining({ friendName: "自定义玩家", status: "overwritten" })]);
    expect(result.customAiFriends[0]).toMatchObject({
      id: "custom-friend",
      nickname: "自定义玩家",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      roleCard: custom.roleCard,
      ordinaryPlayerProfile: custom.ordinaryPlayerProfile,
      llmConfig: {
        provider: "openai-compatible",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        mergeSystemIntoUser: true,
      },
    });
    expect(result.aiLlmSecrets["custom-friend"]).toEqual({ apiKey: "secret-key", ttsApiKey: "tts-secret" });
  });
});

type FakeWindow = {
  localStorage: Storage;
};

function withFakeWindow(run: (fakeWindow: FakeWindow) => void): void {
  const storage = new Map<string, string>();
  const fakeWindow: FakeWindow = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    },
  };

  vi.stubGlobal("window", fakeWindow);
  try {
    run(fakeWindow);
  } finally {
    vi.unstubAllGlobals();
  }
}

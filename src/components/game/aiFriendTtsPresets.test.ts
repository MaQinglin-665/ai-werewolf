import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import { describe, expect, it, vi } from "vitest";
import { buildAiFriendOptions } from "./aiFriendStorage";
import {
  AI_FRIEND_TTS_PRESETS_STORAGE_KEY,
  applyTtsPresetToSelectedAiFriends,
  readStoredAiFriendTtsPresetState,
  writeStoredAiFriendTtsPresetState,
  type AiFriendTtsPreset,
} from "./aiFriendTtsPresets";

const now = "2026-06-14T00:00:00.000Z";

const preset: AiFriendTtsPreset = {
  id: "tts-preset-mimo",
  name: "Mimo 云语音",
  baseUrl: "https://api.xiaomimimo.com",
  model: "mimo-v2.5-tts",
  voice: "mimo_default",
  apiKey: "tts-secret-key",
  format: "mp3",
  authHeader: "Authorization",
  createdAt: now,
  updatedAt: now,
};

describe("aiFriendTtsPresets storage", () => {
  it("round-trips sanitized TTS presets and last used preset id", () => {
    withFakeWindow(() => {
      writeStoredAiFriendTtsPresetState({
        presets: [
          {
            ...preset,
            name: "  Mimo   Voice  ",
            baseUrl: "https://api.xiaomimimo.com/",
            voice: "  mimo default  ",
            apiKey: "  tts-secret-key  ",
          },
        ],
        lastUsedPresetId: "tts-preset-mimo",
      });

      expect(readStoredAiFriendTtsPresetState()).toEqual({
        presets: [
          {
            ...preset,
            name: "Mimo Voice",
            baseUrl: "https://api.xiaomimimo.com",
            voice: "mimo_default",
          },
        ],
        lastUsedPresetId: "tts-preset-mimo",
      });
    });
  });

  it("ignores malformed storage values", () => {
    withFakeWindow((fakeWindow) => {
      fakeWindow.localStorage.setItem(AI_FRIEND_TTS_PRESETS_STORAGE_KEY, "{bad json");

      expect(readStoredAiFriendTtsPresetState()).toEqual({ presets: [] });
    });
  });
});

describe("applyTtsPresetToSelectedAiFriends", () => {
  it("fills only selected friends without custom TTS configs", () => {
    const defaults = buildAiFriendOptions([]);
    const configured = copyAiFriend(getDefaultAiFriends(now)[1]!, {
      id: "friend-configured-llm:claude",
      now,
    });
    configured.ttsConfig = {
      provider: "mimo-compatible",
      label: "Existing Voice",
      baseUrl: "https://tts.example.com",
      model: "existing-tts",
      voice: "existing_voice",
      format: "wav",
    };
    const options = buildAiFriendOptions([configured]);

    const result = applyTtsPresetToSelectedAiFriends({
      aiFriends: options,
      customAiFriends: [configured],
      selectedAiFriendIds: [defaults[0]!.id, configured.id],
      aiLlmSecrets: { [configured.id]: { ttsApiKey: "existing-tts-secret" } },
      preset,
      mode: "fill-blanks",
      now,
    });

    expect(result.results).toEqual([
      expect.objectContaining({ friendName: defaults[0]!.nickname, status: "filled" }),
      expect.objectContaining({ friendName: configured.nickname, status: "skipped" }),
    ]);
    expect(result.selectedAiFriendIds).toEqual([`friend-configured-llm:${defaults[0]!.basePersonaId}`, configured.id]);
    expect(result.aiLlmSecrets[result.selectedAiFriendIds[0]!]?.ttsApiKey).toBe("tts-secret-key");
    expect(result.aiLlmSecrets[configured.id]?.ttsApiKey).toBe("existing-tts-secret");
  });

  it("overwrites selected friends and preserves LLM configs and secrets", () => {
    const custom = copyAiFriend(getDefaultAiFriends(now)[2]!, {
      id: "custom-friend",
      now,
    });
    custom.nickname = "自定义玩家";
    custom.llmConfig = {
      provider: "openai-compatible",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
    };
    custom.ttsConfig = {
      provider: "mimo-compatible",
      label: "Old Voice",
      baseUrl: "https://old-tts.example.com",
      model: "old-tts",
      voice: "old_voice",
    };

    const result = applyTtsPresetToSelectedAiFriends({
      aiFriends: buildAiFriendOptions([custom]),
      customAiFriends: [custom],
      selectedAiFriendIds: [custom.id],
      aiLlmSecrets: { [custom.id]: { apiKey: "llm-secret", ttsApiKey: "old-tts-secret" } },
      preset,
      mode: "overwrite",
      now,
    });

    expect(result.results).toEqual([expect.objectContaining({ friendName: "自定义玩家", status: "overwritten" })]);
    expect(result.customAiFriends[0]).toMatchObject({
      id: "custom-friend",
      nickname: "自定义玩家",
      llmConfig: custom.llmConfig,
      ttsVoice: "mimo_default",
      ttsConfig: {
        provider: "mimo-compatible",
        label: "Mimo 云语音",
        baseUrl: "https://api.xiaomimimo.com",
        model: "mimo-v2.5-tts",
        voice: "mimo_default",
        format: "mp3",
        authHeader: "Authorization",
      },
    });
    expect(result.aiLlmSecrets["custom-friend"]).toEqual({ apiKey: "llm-secret", ttsApiKey: "tts-secret-key" });
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

import { describe, expect, it } from "vitest";
import {
  copyAiFriend,
  getDefaultAiFriends,
  parseAiFriendExport,
  resolveAiFriendsForGame,
  serializeAiFriendExport,
} from "./aiFriends";

describe("ai friends", () => {
  it("builds default friends from the model personas", () => {
    const friends = getDefaultAiFriends("test");

    expect(friends).toHaveLength(8);
    expect(friends.map((friend) => friend.nickname)).toEqual([
      "DeepSeek",
      "Claude",
      "GPT",
      "豆包",
      "Mimo",
      "Gemini",
      "GLM",
      "Kimi",
    ]);
    expect(friends.every((friend) => friend.id.startsWith("default:"))).toBe(true);
  });

  it("copies a default friend into an editable custom friend", () => {
    const source = getDefaultAiFriends("test")[0];
    const copy = copyAiFriend(source, { id: "friend-copy", now: "2026-05-15T00:00:00.000Z" });

    expect(copy.id).toBe("friend-copy");
    expect(copy.nickname).toBe("DeepSeek副本");
    expect(copy.basePersonaId).toBe(source.basePersonaId);
    expect(copy.createdAt).toBe("2026-05-15T00:00:00.000Z");
  });

  it("round-trips custom friends through import and export JSON", () => {
    const custom = copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-gpt", now: "2026-05-15T00:00:00.000Z" });
    const exported = serializeAiFriendExport([custom]);
    const imported = parseAiFriendExport(exported);

    expect(imported).toEqual([custom]);
  });

  it("preserves custom OpenAI-compatible model config without API keys", () => {
    const custom = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-custom-llm", now: "2026-05-15T00:00:00.000Z" }),
      llmConfig: {
        provider: "openai-compatible" as const,
        label: "我的模型",
        baseUrl: "https://llm.example.com/v1",
        model: "custom-model",
        apiKey: "secret-key",
      },
    };

    const imported = parseAiFriendExport(serializeAiFriendExport([custom]));
    const resolved = resolveAiFriendsForGame(imported, 1);

    expect(imported[0]?.llmConfig).toEqual({
      provider: "openai-compatible",
      label: "我的模型",
      baseUrl: "https://llm.example.com/v1",
      model: "custom-model",
    });
    expect(JSON.stringify(imported)).not.toContain("secret-key");
    expect(resolved[0]?.persona.modelLabel).toBe("我的模型 · custom-model");
  });

  it("preserves custom TTS config without API keys", () => {
    const custom = {
      ...copyAiFriend(getDefaultAiFriends("test")[0], { id: "friend-custom-tts", now: "2026-05-15T00:00:00.000Z" }),
      ttsConfig: {
        provider: "mimo-compatible" as const,
        label: "我的语音",
        baseUrl: "https://tts.example.com/v1",
        model: "custom-tts",
        voice: "voice_a",
        format: "mp3",
        authHeader: "api-key",
        apiKey: "secret-tts-key",
      },
    };

    const imported = parseAiFriendExport(serializeAiFriendExport([custom]));
    const resolved = resolveAiFriendsForGame(imported, 1);

    expect(imported[0]?.ttsConfig).toEqual({
      provider: "mimo-compatible",
      label: "我的语音",
      baseUrl: "https://tts.example.com/v1",
      model: "custom-tts",
      voice: "voice_a",
      format: "mp3",
      authHeader: "api-key",
    });
    expect(JSON.stringify(imported)).not.toContain("secret-tts-key");
    expect(resolved[0]?.setup.ttsConfig?.voice).toBe("voice_a");
  });

  it("preserves custom avatar data URLs", () => {
    const avatarDataUrl = "data:image/webp;base64,AAAA";
    const custom = {
      ...copyAiFriend(getDefaultAiFriends("test")[0], { id: "friend-avatar", now: "2026-05-15T00:00:00.000Z" }),
      avatarDataUrl,
    };

    const imported = parseAiFriendExport(serializeAiFriendExport([custom]));
    const resolved = resolveAiFriendsForGame(imported, 1);

    expect(imported[0]?.avatarDataUrl).toBe(avatarDataUrl);
    expect(resolved[0]?.config.avatarDataUrl).toBe(avatarDataUrl);
    expect(resolved[0]?.setup.avatarDataUrl).toBe(avatarDataUrl);
  });

  it("rejects invalid import JSON", () => {
    expect(() => parseAiFriendExport("{not json")).toThrow(/JSON/);
    expect(() => parseAiFriendExport(JSON.stringify({ version: 2, friends: [] }))).toThrow(/版本/);
  });

  it("resolves selected friends, fills missing seats, and deduplicates display names", () => {
    const defaults = getDefaultAiFriends("test");
    const custom = {
      ...copyAiFriend(defaults[0], { id: "friend-1", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "同名",
    };
    const customTwin = {
      ...copyAiFriend(defaults[1], { id: "friend-2", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "同名",
    };

    const resolved = resolveAiFriendsForGame([custom, customTwin], 5);

    expect(resolved.map((friend) => friend.displayName)).toEqual(["同名", "同名2", "DeepSeek", "Claude", "GPT"]);
    expect(resolved[0].persona.name).toBe("DeepSeek");
    expect(resolved[1].persona.name).toBe("Claude");
  });
});

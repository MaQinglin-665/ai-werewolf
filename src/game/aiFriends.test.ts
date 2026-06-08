import { describe, expect, it } from "vitest";
import {
  copyAiFriend,
  getDefaultAiFriends,
  parseAiFriendExport,
  resolveAiFriendsForGame,
  serializeAiFriendExport,
} from "./aiFriends";
import type { AiFriendConfig } from "./types";

function withoutOrdinaryPlayerProfile(friend: AiFriendConfig): Omit<AiFriendConfig, "ordinaryPlayerProfile"> {
  const legacyFriend = { ...friend };
  delete legacyFriend.ordinaryPlayerProfile;
  return legacyFriend;
}

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

  it("assigns stable ordinary player types to default friends", () => {
    const friends = getDefaultAiFriends("test");

    expect(friends.map((friend) => friend.ordinaryPlayerProfile?.playerTypeId)).toEqual([
      "one-line-catcher",
      "cautious-backpacker",
      "soft-follower",
      "impatient-pusher",
      "pivot-admitter",
      "quiet-watcher",
      "emotional-reactor",
      "role-sensitive",
    ]);
  });

  it("copies a default friend into an editable custom friend", () => {
    const source = getDefaultAiFriends("test")[0];
    const copy = copyAiFriend(source, { id: "friend-copy", now: "2026-05-15T00:00:00.000Z" });

    expect(copy.id).toBe("friend-copy");
    expect(copy.nickname).toBe("DeepSeek副本");
    expect(copy.basePersonaId).toBe(source.basePersonaId);
    expect(copy.createdAt).toBe("2026-05-15T00:00:00.000Z");
  });

  it("applies a persona template as one complete tuning preset", async () => {
    const { applyAiFriendPersonaTemplate } = await import("./aiFriends");
    const source = getDefaultAiFriends("test")[0];
    const custom = {
      ...copyAiFriend(source, { id: "friend-template", now: "2026-05-15T00:00:00.000Z" }),
      riskTolerance: 1,
      bluffing: 1,
      preferences: {
        logic: 0,
        identity: 0,
        vote: 0,
        emotion: 0,
        memory: 0,
        leadership: 0,
        deception: 0,
        caution: 0,
      },
    };

    const result = applyAiFriendPersonaTemplate(custom, "doubao-pressure-bluffer");
    const doubao = getDefaultAiFriends("test").find((friend) => friend.basePersonaId === "doubao-pressure-bluffer")!;

    expect(result).toMatchObject({
      id: "friend-template",
      nickname: "DeepSeek副本",
      basePersonaId: "doubao-pressure-bluffer",
      ordinaryPlayerProfile: custom.ordinaryPlayerProfile,
      riskTolerance: doubao.riskTolerance,
      bluffing: doubao.bluffing,
      preferences: doubao.preferences,
    });
  });

  it("round-trips custom friends through import and export JSON", () => {
    const custom = copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-gpt", now: "2026-05-15T00:00:00.000Z" });
    const exported = serializeAiFriendExport([custom]);
    const imported = parseAiFriendExport(exported);

    expect(imported).toEqual([custom]);
  });

  it("copies ordinary player profiles when saving editable friend config", () => {
    const source = getDefaultAiFriends("test")[0]!;
    const copy = copyAiFriend(source, { id: "friend-copy-profile", now: "2026-06-08T00:00:00.000Z" });

    expect(copy.ordinaryPlayerProfile).toEqual(source.ordinaryPlayerProfile);
  });

  it("round-trips ordinary player profiles through export, import, and game resolution", () => {
    const custom = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-ordinary", now: "2026-05-15T00:00:00.000Z" }),
      ordinaryPlayerProfile: {
        playerTypeId: "quiet-watcher" as const,
        sliders: {
          directness: 0.2,
          emotion: 0.25,
          speechLength: 0.25,
          questionBias: 0.45,
          factBias: 0.7,
          identityBias: 0.5,
          voteBias: 0.35,
          memoryBias: 0.72,
          nightAggression: 0.2,
          voteFollow: 0.45,
          deception: 0.3,
          caution: 0.9,
        },
      },
    };

    const imported = parseAiFriendExport(serializeAiFriendExport([custom]));
    const resolved = resolveAiFriendsForGame(imported, 1);

    expect(imported[0]?.ordinaryPlayerProfile).toEqual(custom.ordinaryPlayerProfile);
    expect(resolved[0]?.config.ordinaryPlayerProfile).toEqual(custom.ordinaryPlayerProfile);
    expect(resolved[0]?.persona.ordinaryPlayerProfile).toEqual(custom.ordinaryPlayerProfile);
    expect(resolved[0]?.setup.ordinaryPlayerProfile).toEqual(custom.ordinaryPlayerProfile);
  });

  it("infers ordinary player profiles for legacy imported friends", () => {
    const legacyFriend = withoutOrdinaryPlayerProfile(
      copyAiFriend(getDefaultAiFriends("test").find((friend) => friend.basePersonaId === "gemini-quiet-observer")!, {
        id: "friend-legacy-gemini",
        now: "2026-06-08T00:00:00.000Z",
      }),
    );

    const imported = parseAiFriendExport(
      JSON.stringify({
        version: 1,
        friends: [legacyFriend],
      }),
    );
    const resolved = resolveAiFriendsForGame(imported, 1);

    expect(imported[0]?.ordinaryPlayerProfile?.playerTypeId).toBe("quiet-watcher");
    expect(resolved[0]?.config.ordinaryPlayerProfile?.playerTypeId).toBe("quiet-watcher");
    expect(resolved[0]?.persona.ordinaryPlayerProfile?.playerTypeId).toBe("quiet-watcher");
    expect(resolved[0]?.setup.ordinaryPlayerProfile?.playerTypeId).toBe("quiet-watcher");
  });

  it("falls back for malformed numeric tuning values in imported friends", () => {
    const defaultGemini = getDefaultAiFriends("test").find((friend) => friend.basePersonaId === "gemini-quiet-observer")!;
    const legacyFriend = withoutOrdinaryPlayerProfile(
      copyAiFriend(defaultGemini, {
        id: "friend-malformed-gemini",
        now: "2026-06-08T00:00:00.000Z",
      }),
    );

    const imported = parseAiFriendExport(
      JSON.stringify({
        version: 1,
        friends: [
          {
            ...legacyFriend,
            riskTolerance: null,
            bluffing: "",
            preferences: {
              ...legacyFriend.preferences,
              leadership: false,
              caution: true,
            },
          },
        ],
      }),
    );

    expect(imported[0]?.riskTolerance).toBe(defaultGemini.riskTolerance);
    expect(imported[0]?.bluffing).toBe(defaultGemini.bluffing);
    expect(imported[0]?.preferences.leadership).toBe(defaultGemini.preferences.leadership);
    expect(imported[0]?.preferences.caution).toBe(defaultGemini.preferences.caution);
    expect(imported[0]?.ordinaryPlayerProfile?.playerTypeId).toBe("quiet-watcher");
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

  it("preserves class-trial role voice profiles through friend resolution", () => {
    const custom = {
      ...copyAiFriend(getDefaultAiFriends("test")[0], { id: "friend-class-trial", now: "2026-05-15T00:00:00.000Z" }),
      roleCard: {
        id: "kirigiri",
        displayName: "Kirigiri",
        theme: "class-trial",
        styleTags: ["restrained"],
        speechStyleZh: "Stay precise.",
        reasoningBias: "Prefer narrow doubts.",
        voteBias: "Vote from public facts.",
        nightActionBias: "Use legal night actions.",
        asVillager: "Ask narrow questions.",
        asWerewolf: "Redirect real gaps.",
        pressureResponse: "Question the pressure.",
        relationshipHints: [],
        catchphrasePolicy: "Light seasoning only.",
        forbidden: [],
        classTrialVoiceProfile: {
          personalityCore: ["keeps emotional distance"],
          valueBiases: ["hates too-clean conclusions"],
          reactionTendencies: ["narrows one missing premise"],
          lightCatchphrases: ["one missing piece"],
          overuseBans: ["do not repeat evidence chain"],
          scenarioReactions: {
            lowInfoOpening: {
              innerDrive: "observe early definitions",
              speechMove: "ask one narrow question",
              mustAvoid: "do not summarize the room",
            },
          },
          alignmentReactions: {
            asVillager: {
              speechDrive: "block premature consensus",
              failureMode: "too reserved",
            },
          },
          acceptableForms: ["short pressure"],
          unacceptableForms: ["neutral audit"],
          dramaticBoundaries: {
            allowSharpConflict: true,
            allowIrrationalMisread: true,
            allowDeceptionWhenAligned: true,
            mustStayInTurnOrder: true as const,
            mustRemainWerewolfPlayable: true as const,
          },
        },
      },
    };

    const resolved = resolveAiFriendsForGame([custom], 1);

    expect(resolved[0]?.config.roleCard?.classTrialVoiceProfile?.overuseBans).toEqual(
      expect.arrayContaining(["do not repeat evidence chain"]),
    );
    expect(resolved[0]?.setup.roleCard?.classTrialVoiceProfile?.scenarioReactions.lowInfoOpening?.speechMove).toBe(
      "ask one narrow question",
    );
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

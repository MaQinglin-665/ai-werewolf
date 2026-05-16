import { describe, expect, it } from "vitest";
import { copyAiFriend, getDefaultAiFriends } from "./aiFriends";
import { createGame } from "./engine";

describe("createGame ai friends", () => {
  it("keeps the default AI assignment when no friends are provided", () => {
    const state = createGame({ seed: 1, humanSeatId: 1 });
    const aiSeats = state.seats.filter((seat) => seat.isAi);

    expect(aiSeats.map((seat) => seat.name)).toEqual(["DeepSeek", "Claude", "GPT", "豆包", "Mimo", "Gemini", "GLM", "Kimi"]);
    expect(aiSeats.every((seat) => seat.persona && seat.name === seat.persona.name)).toBe(true);
    expect(state.setup?.aiFriends).toHaveLength(8);
  });

  it("assigns selected custom friends to the first AI seats", () => {
    const defaults = getDefaultAiFriends("test");
    const friendA = { ...copyAiFriend(defaults[2], { id: "friend-a", now: "2026-05-15T00:00:00.000Z" }), nickname: "阿衡" };
    const friendB = {
      ...copyAiFriend(defaults[5], { id: "friend-b", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "小岚",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      ttsConfig: {
        provider: "mimo-compatible" as const,
        baseUrl: "https://tts.example.com/v1",
        model: "custom-tts",
        voice: "voice_b",
      },
    };
    const state = createGame({ seed: 1, humanSeatId: 1, aiFriends: [friendA, friendB] });
    const aiSeats = state.seats.filter((seat) => seat.isAi);

    expect(aiSeats[0].name).toBe("阿衡");
    expect(aiSeats[0].persona?.name).toBe("GPT");
    expect(aiSeats[1].name).toBe("小岚");
    expect(aiSeats[1].persona?.name).toBe("Gemini");
    expect(aiSeats[1].avatarDataUrl).toBe("data:image/webp;base64,AAAA");
    expect(aiSeats[1].ttsVoice).toBe("default_zh");
    expect(aiSeats[1].ttsConfig?.voice).toBe("voice_b");
    expect(state.setup?.aiFriends.slice(0, 2).map((friend) => friend.nickname)).toEqual(["阿衡", "小岚"]);
    expect(state.setup?.aiFriends[1]?.ttsVoice).toBe("default_zh");
    expect(state.setup?.aiFriends[1]?.avatarDataUrl).toBe("data:image/webp;base64,AAAA");
    expect(state.setup?.aiFriends[1]?.ttsConfig?.model).toBe("custom-tts");
  });

  it("fills missing seats with default friends", () => {
    const custom = { ...copyAiFriend(getDefaultAiFriends("test")[0], { id: "friend-only" }), nickname: "单人组" };
    const state = createGame({ seed: 1, humanSeatId: 1, aiFriends: [custom] });
    const aiSeats = state.seats.filter((seat) => seat.isAi);

    expect(aiSeats.map((seat) => seat.name).slice(0, 4)).toEqual(["单人组", "DeepSeek", "Claude", "GPT"]);
  });

  it("truncates extra friends beyond the AI seat count", () => {
    const defaults = getDefaultAiFriends("test");
    const friends = Array.from({ length: 10 }, (_, index) => ({
      ...copyAiFriend(defaults[index % defaults.length], { id: `friend-${index}` }),
      nickname: `友${index + 1}`,
    }));
    const state = createGame({ seed: 1, humanSeatId: 1, aiFriends: friends });
    const aiSeats = state.seats.filter((seat) => seat.isAi);

    expect(aiSeats).toHaveLength(8);
    expect(aiSeats.map((seat) => seat.name)).toEqual(["友1", "友2", "友3", "友4", "友5", "友6", "友7", "友8"]);
  });

  it("deduplicates cycled default names on larger boards", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1, humanSeatId: 1 });
    const aiNames = state.seats.filter((seat) => seat.isAi).map((seat) => seat.name);

    expect(aiNames).toHaveLength(11);
    expect(new Set(aiNames).size).toBe(11);
    expect(aiNames).toEqual(expect.arrayContaining(["DeepSeek", "DeepSeek2", "Claude2", "GPT2"]));
  });

  it("assigns AI friends by ascending seat while skipping a fixed human seat", () => {
    const defaults = getDefaultAiFriends("test");
    const friendA = { ...copyAiFriend(defaults[2], { id: "friend-seat-a" }), nickname: "一号AI" };
    const friendB = { ...copyAiFriend(defaults[5], { id: "friend-seat-b" }), nickname: "二号AI" };
    const state = createGame({ seed: 1, humanSeatId: 4, aiFriends: [friendA, friendB] });

    expect(state.humanSeatId).toBe(4);
    expect(state.seats.find((seat) => seat.seatId === 4)?.isAi).toBe(false);
    expect(state.seats.filter((seat) => seat.isAi).slice(0, 3).map((seat) => [seat.seatId, seat.name])).toEqual([
      [1, "一号AI"],
      [2, "二号AI"],
      [3, "DeepSeek"],
    ]);
  });

  it("can create a spectator game where every seat is AI-controlled", () => {
    const state = createGame({ seed: 1, humanSeatId: null });

    expect(state.spectatorMode).toBe(true);
    expect(state.seats.every((seat) => seat.isAi)).toBe(true);
    expect(state.setup?.aiFriends).toHaveLength(9);
  });
});

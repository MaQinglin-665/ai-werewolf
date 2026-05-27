import { describe, expect, it } from "vitest";
import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import type { HumanGameView } from "@/game/types";
import { POST as createGame } from "./route";

describe("game creation ai friends", () => {
  it("accepts selected AI friend snapshots", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-api", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "接口好友",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      ttsConfig: {
        provider: "mimo-compatible",
        baseUrl: "https://tts.example.com/v1",
        model: "api-tts",
        voice: "voice_api",
        apiKey: "secret-tts-key",
      },
    };
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.isAi);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("接口好友");
    expect(firstAiSeat?.personaName).toBe("GPT");
    expect(firstAiSeat?.avatarDataUrl).toBe("data:image/webp;base64,AAAA");
    expect(firstAiSeat?.ttsVoice).toBe("default_zh");
    expect(firstAiSeat?.ttsConfig?.voice).toBe("voice_api");
    expect(JSON.stringify(view)).not.toContain("secret-tts-key");
    expect(view.setup?.aiFriends[0]).toMatchObject({
      friendId: "friend-api",
      nickname: "接口好友",
      personaName: "GPT",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      ttsConfig: {
        model: "api-tts",
        voice: "voice_api",
      },
    });
  });

  it("accepts custom LLM config but does not expose API keys in the game view", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "friend-api-llm", now: "2026-05-15T00:00:00.000Z" }),
      nickname: "自选模型",
      llmConfig: {
        provider: "openai-compatible",
        label: "玩家模型",
        baseUrl: "https://llm.example.com/v1",
        model: "player-model",
        apiKey: "secret-key",
      },
    };
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.isAi);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("自选模型");
    expect(firstAiSeat?.personaModelLabel).toBe("玩家模型 · player-model");
    expect(JSON.stringify(view)).not.toContain("secret-key");
  });

  it("passes AI friend role cards into setup and seat personas", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[0], { id: "friend-role-card", now: "2026-05-27T00:00:00.000Z" }),
      nickname: "柯南",
      roleCard: {
        source: "名侦探角色",
        speakingStyle: "短句、直接、先落结论。",
        reasoningStyle: "先找证据链，再压关键矛盾。",
        avoid: "不要卖萌，不要说固定台词。",
      },
    };
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.isAi);

    expect(response.status).toBe(200);
    expect(view.setup?.aiFriends[0]).toMatchObject({
      friendId: "friend-role-card",
      nickname: "柯南",
      personaName: "DeepSeek",
      roleCard: {
        source: "名侦探角色",
        speakingStyle: "短句、直接、先落结论。",
        reasoningStyle: "先找证据链，再压关键矛盾。",
        avoid: "不要卖萌，不要说固定台词。",
      },
    });
    expect(firstAiSeat).toMatchObject({
      name: "柯南",
      personaName: "DeepSeek",
    });
  });

  it("accepts a fixed human seat id", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: 4 }),
      }),
    );
    const view = (await response.json()) as HumanGameView;

    expect(response.status).toBe(200);
    expect(view.humanSeatId).toBe(4);
    expect(view.seats.find((seat) => seat.seatId === 4)?.isHuman).toBe(true);
  });

  it("rejects a human seat id outside the board", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: 12 }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("accepts spectator mode without a human seat", async () => {
    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: null }),
      }),
    );
    const view = (await response.json()) as HumanGameView;

    expect(response.status).toBe(200);
    expect(view.humanSeatId).toBeNull();
    expect(view.myRole).toBeUndefined();
    expect(view.seats.every((seat) => seat.isAi && !seat.isHuman)).toBe(true);
    expect(view.availableActions).toEqual([
      expect.objectContaining({
        type: "continue",
      }),
    ]);
  });
});

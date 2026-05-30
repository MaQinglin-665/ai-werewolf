import type { HumanGameView } from "@/game/types";
import { describe, expect, it, vi } from "vitest";
import {
  buildStreamingContinueContext,
  createGameView,
  loadGameView,
  submitContinueCommand,
  submitGameCommand,
} from "./gameClientRequests";
import type { AiFriendConfig, AiFriendRuntimeLlmConfig } from "@/game/types";

describe("gameClientRequests", () => {
  it("loads a game by id and rejects missing games with the existing message", async () => {
    const view = { id: "game-1" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));

    await expect(loadGameView("game-1", fetchMock)).resolves.toEqual(view);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/game-1");

    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404 }));

    await expect(loadGameView("missing", fetchMock)).rejects.toThrow("对局不存在或已被清理。");
  });

  it("creates a game with selected board, nullable spectator seat, and selected AI friends", async () => {
    const view = { id: "game-2" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));
    const selectedAiFriends = [{ id: "friend-1", nickname: "阿一" }] as AiFriendConfig[];

    await expect(
      createGameView({
        boardId: undefined,
        selectedBoardId: "6p-beginner-seer",
        humanSeatMode: "none",
        selectedHumanSeatId: 2,
        selectedAiFriends,
        fetcher: fetchMock,
      }),
    ).resolves.toEqual(view);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/games");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      boardId: "6p-beginner-seer",
      humanSeatId: null,
      aiFriends: selectedAiFriends,
    });
  });

  it("creates a class-trial game with fixed 9 AI friends, fixed board, and spectator mode", async () => {
    const view = { id: "class-trial-game" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));
    const classTrialAiFriends = Array.from({ length: 9 }, (_, index) => ({
      id: `class-trial:${index + 1}`,
      nickname: `角色${index + 1}`,
      basePersonaId: "gpt-balanced-organizer",
      riskTolerance: 0.5,
      bluffing: 0.5,
      preferences: {
        logic: 0.5,
        identity: 0.5,
        vote: 0.5,
        emotion: 0.5,
        memory: 0.5,
        leadership: 0.5,
        deception: 0.5,
        caution: 0.5,
      },
      createdAt: "class-trial-local",
      updatedAt: "class-trial-local",
    })) as AiFriendConfig[];

    await createGameView({
      boardId: undefined,
      selectedBoardId: "6p-beginner-seer",
      humanSeatMode: "fixed",
      selectedHumanSeatId: 2,
      selectedAiFriends: [],
      boardIdOverride: "9p-seer-witch-hunter",
      humanSeatModeOverride: "none",
      aiFriendsOverride: classTrialAiFriends,
      fetcher: fetchMock,
    });

    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: null,
      aiFriends: classTrialAiFriends,
    });
  });

  it("submits normal commands with runtime mode and LLM configs", async () => {
    const view = { id: "game-3" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));

    await expect(
      submitGameCommand({
        gameId: "game-3",
        payload: { type: "vote", targetSeatId: 4 },
        aiRuntimeMode: "llm",
        aiLlmConfigs: { friend: { model: "demo" } as AiFriendRuntimeLlmConfig },
        fetcher: fetchMock,
      }),
    ).resolves.toEqual(view);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/game-3/commands");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      type: "vote",
      targetSeatId: 4,
      aiRuntimeMode: "llm",
      aiLlmConfigs: { friend: { model: "demo" } },
    });
  });

  it("submits a non-streaming continue command for background lookahead", async () => {
    const view = { id: "game-lookahead" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));

    await expect(
      submitContinueCommand({
        gameId: "game-lookahead",
        aiRuntimeMode: "llm",
        aiLlmConfigs: { friend: { model: "demo" } as AiFriendRuntimeLlmConfig },
        fetcher: fetchMock,
      }),
    ).resolves.toEqual(view);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/game-lookahead/commands");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      type: "continue",
      aiRuntimeMode: "llm",
      aiLlmConfigs: { friend: { model: "demo" } },
    });
  });

  it("builds stream context only for enabled AI speakers and preserves previous speech keys", () => {
    const game = {
      id: "game-4",
      day: 2,
      humanSeatId: 1,
      currentSpeakerSeatId: 3,
      seats: [{ seatId: 1 }, { seatId: 3, personaName: "deepseek", ttsVoice: "voice-3" }],
      tableSummary: { recentSpeeches: [{ seq: 7, day: 2, turn: 1, speakerSeatId: 3, message: "发言" }] },
    } as unknown as HumanGameView;

    const context = buildStreamingContinueContext(game, true);

    expect(context.streamingSpeaker?.seatId).toBe(3);
    expect(context.streamingSpeechKeyPrefix).toBe("game-4:2:live-tts:3");
    expect([...context.previousSpeechKeys]).toEqual(["game-4:7:2"]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createGame } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import { createSpeechPlan } from "./tableRead";
import { createConstrainedLlmSpeechProvider, routedModelSpeechProvider } from "./speechProviders";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("routed speech provider", () => {
  it("retries when speech output contains transport metadata", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let attempt = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => {
        attempt += 1;
        if (attempt === 1) {
          return 'data: {"object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":0}}';
        }
        return JSON.stringify({ speech: "我只按已经公开的发言判断，今天先把票型压集中。" });
      },
    });
    const state = createGame({ seed: 91 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain("票型压集中");
    expect(attempt).toBe(2);
  });

  it("uses a fallback persona provider when the primary speech request fails", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "0";
    process.env.AI_LLM_SPEECH_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.5";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { model: string };
      if (requestBody.model === "deepseek-v4-flash") {
        throw new TypeError("fetch failed");
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: "我先只看已经发过言的位置，前置位给的信息还不够集中，今天投票不要散。",
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    const result = await routedModelSpeechProvider.generateSpeech(view, plan);

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.5"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("gpt-speech:gpt-5.5");
    expect(result.speech).toContain("投票不要散");
  });
});

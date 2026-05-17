import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, createGame } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import type { Seat } from "@/game/types";
import { createSpeechPlan } from "./tableRead";
import { createConstrainedLlmSpeechProvider, mockSpeechProvider, routedModelSpeechProvider } from "./speechProviders";

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

describe("mock speech provider", () => {
  it("varies adjacent table-player bridge and vote-condition wording", async () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";

    const target = state.seats[0]!;
    const previous = state.seats[1]!;
    const gpt = state.seats[2]!;
    const doubao = state.seats[3]!;
    setTestPersona(target, "DeepSeek", "logic-checker", 0.42);
    setTestPersona(previous, "Claude", "careful-follower", 0.36);
    setTestPersona(gpt, "GPT", "steady-organizer", 0.48);
    setTestPersona(doubao, "豆包", "emotional-voter", 0.72);
    gpt.role = "VILLAGER";
    doubao.role = "VILLAGER";
    state.speechQueue = [previous.seatId, gpt.seatId, doubao.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "我先给边界，前置位信息还不够完整，后面要听1号怎么补站边。",
    });

    const gptView = buildAgentView(state, gpt.seatId);
    const gptPlan = {
      ...createSpeechPlan(gptView),
      kind: "pressure" as const,
      target,
      talkingPoints: ["1号的站边还没和票型闭合", "后置位需要给出反证"],
    };
    const gptResult = await mockSpeechProvider.generateSpeech(gptView, gptPlan);

    state = applyCommand(state, { type: "speak", actorSeatId: gpt.seatId, message: gptResult.speech });

    const doubaoView = buildAgentView(state, doubao.seatId);
    const doubaoPlan = {
      ...createSpeechPlan(doubaoView),
      kind: "pressure" as const,
      target,
      talkingPoints: ["1号的发言任务还没交卷", "我会看他能不能给即时反应"],
    };
    const doubaoResult = await mockSpeechProvider.generateSpeech(doubaoView, doubaoPlan);

    for (const speech of [gptResult.speech, doubaoResult.speech]) {
      expect(speech).not.toContain("票口暂时不被他带跑");
      expect(speech).not.toContain("后置仍只给结论不给过程");
      expect(speech).not.toMatch(/拆因果|第一点|盘问议程|追问先落|票口按这个条件|可改票条件/);
      expect(speech.length).toBeLessThanOrEqual(380);
    }
    expect(doubaoResult.speech).toContain("GPT");
    expect(gptResult.speech).not.toEqual(doubaoResult.speech);
  });

  it("renders human-seat pressure without prompt-like agenda labels", async () => {
    const state = createGame({ seed: 91, humanSeatId: 3 });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const target = state.seats.find((seat) => seat.seatId === 3)!;
    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      kind: "pressure" as const,
      target,
      talkingPoints: ["3号的站边还没和票型闭合", "后面需要给出能改票的反证"],
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).toContain("3号");
    expect(result.speech).not.toContain("3号你");
    expect(result.speech).not.toMatch(/拆因果|第一点|盘问议程|追问先落|票口按这个条件|可改票条件/);
    expect(result.speech.length).toBeLessThanOrEqual(380);
  });
});

function setTestPersona(seat: Seat, name: string, id: string, riskTolerance: number): void {
  seat.name = name;
  seat.persona = {
    id,
    name,
    modelLabel: name,
    label: "测试型",
    style: "按桌面公开信息发言",
    goal: "给出可验证的票口和追问",
    riskTolerance,
    bluffing: 0.3,
    preferences: {
      logic: 0.7,
      identity: 0.55,
      vote: 0.65,
      emotion: name === "豆包" ? 0.86 : 0.35,
      memory: 0.55,
      leadership: riskTolerance,
      deception: 0.3,
      caution: 1 - riskTolerance,
    },
  };
}

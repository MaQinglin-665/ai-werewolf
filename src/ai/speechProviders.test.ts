import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, applySystemStep, createGame } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import type { PublicReasoningCue, Seat } from "@/game/types";
import { advanceWithMockAi } from "./mockAgent";
import { createSpeechPlan } from "./tableRead";
import {
  buildConstrainedSpeechInput,
  createConstrainedLlmSpeechProvider,
  createConfiguredSpeechProvider,
  mockSpeechProvider,
  routedModelSpeechProvider,
  validateRenderedSpeech,
} from "./speechProviders";

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

  it("repairs dangling punctuation at the end of LLM speech", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () =>
        JSON.stringify({
          speech: "我先按公开信息盘，2号这轮只给流程没给票口，我想追问你今天的出人方向是：",
        }),
    });
    const state = createGame({ seed: 91 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech).toBe("我先按公开信息盘，2号这轮只给流程没给票口，我想追问你今天的出人方向是。");
    expect(result.speech).not.toMatch(/[，,;；:：、-]$/);
  });

  it("retries with concrete already-spoken seat guidance when a front seat is asked to answer later", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const finished = state.seats.find((seat) => seat.alive && seat.isAi && seat.name === "DeepSeek")!;
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== finished.seatId)!;
    const unspoken = state.seats.find((seat) => seat.alive && seat.seatId !== finished.seatId && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [finished.seatId, speaker.seatId, unspoken.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: finished.seatId,
      message: `${finished.seatId}号先把平安夜当女巫用药处理，今天看票口。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, unspoken.seatId];
    state.speechIndex = 0;

    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({ speech: `${finished.seatId}号等下再补一下站边和票口。` });
        }
        retryInput = input;
        return JSON.stringify({
          speech: `我回看${finished.seatId}号已经说过的票口，先不要求他补；${unspoken.seatId}号轮到时只接这个公开点。`,
        });
      },
    });
    const view = buildAgentView(state, speaker.seatId);
    const basePlan = createSpeechPlan(view);
    const plan = {
      ...basePlan,
      target: unspoken,
      targetSpeechStatus: "unspoken" as const,
      allowedInteraction: "ask_future" as const,
      speechMove: "ask_unspoken_target" as const,
    };

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(attempt).toBe(2);
    expect(retryInput?.stability?.repairInstructions).toBeDefined();
    const mustNotAsk = retryInput!.speechContract.mustNotAsk.join("\n");
    const repairInstructions = retryInput!.stability!.repairInstructions!.join("\n");
    expect(mustNotAsk).toContain(`${finished.seatId}号`);
    expect(repairInstructions).toContain(`${finished.seatId}号`);
    expect(repairInstructions).toContain("已经发言");
    expect(repairInstructions).toContain(`${unspoken.seatId}号`);
  });

  it("retries with concrete claim-attribution guidance when a black-check target is called seer", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const claimant = state.seats.find((seat) => seat.alive && seat.role === "SEER")!;
    const checkedTarget = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    const speaker = state.seats.find((seat) => seat.alive && seat.seatId !== claimant.seatId && seat.seatId !== checkedTarget.seatId)!;
    state.speechQueue = [claimant.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: claimant.seatId,
      message: `${claimant.seatId}号发言。我跳预言家，${checkedTarget.seatId}号是查杀。今天票口先压${checkedTarget.seatId}号。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    let attempt = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({ speech: `我认查杀位${checkedTarget.seatId}号是预言家，因为${claimant.seatId}号跳预言家给${checkedTarget.seatId}号查杀。` });
        }
        retryInput = input;
        return JSON.stringify({
          speech: `${claimant.seatId}号报${checkedTarget.seatId}号查杀，我先不把${checkedTarget.seatId}号说成预言家；这条线只看${claimant.seatId}号验人理由和${checkedTarget.seatId}号原话。`,
        });
      },
    });
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(attempt).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain(`把被查杀的${checkedTarget.seatId}号错认成预言家`);
    const repairInstructions = retryInput!.stability!.repairInstructions!.join("\n");
    expect(repairInstructions).toContain(`${claimant.seatId}号${claimant.name}才是预言家声明者`);
    expect(result.speech).not.toContain(`认${checkedTarget.seatId}号预言家`);
  });

  it("repairs a black-check target being called seer before falling back", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我跳预言家，2号Claude-DS-reason是我昨晚验的查杀，狼人。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () =>
        JSON.stringify({
          speech: "我暂时认2号预言家。3号跳预言家报2号查杀，但这条验人心路太薄，今天先压3号。",
        }),
    });
    const view = buildAgentView(state, 5);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain("不认3号预言家");
    expect(result.speech).toContain("保2号查杀位");
    expect(result.speech).not.toContain("认2号预言家");
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

  it("lets AI-pool custom LLM config override global model routing", async () => {
    process.env.AI_LLM_PROVIDER = "models";
    process.env.AI_LLM_API_KEY = "global-key";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_LLM_MAX_RETRIES = "0";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { model: string };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ speech: `自定义模型${requestBody.model}接管这轮发言。` }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = {
      ...buildAgentView(state, speaker.seatId),
      llmConfig: {
        provider: "openai-compatible" as const,
        baseUrl: "https://custom.example.com",
        model: "deepseek-chat",
        apiKey: "custom-key",
        mergeSystemIntoUser: true,
      },
    };

    const result = await createConfiguredSpeechProvider().generateSpeech(view, createSpeechPlan(view));

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { model: string };
    expect(body.model).toBe("deepseek-chat");
    expect(result.provider).toBe("custom-speech:deepseek-chat");
    expect(result.speech).toContain("自定义模型deepseek-chat");
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
      expect(countSpeechSentences(speech)).toBeLessThanOrEqual(4);
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
    expect(countSpeechSentences(result.speech)).toBeLessThanOrEqual(4);
  });

  it("does not judge an unspoken target as already failing to answer", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const target = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId, target.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      kind: "pressure" as const,
      target,
      talkingPoints: [`${target.seatId}号后面补站边和票口`],
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).toContain("轮到");
    expect(result.speech).not.toMatch(/还没发言.*别只给结论|没回应|已经信息少/);
    expect(result.speech.length).toBeLessThanOrEqual(380);
  });

  it("uses plan target status when mock speech phrases a review target", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    state.day = 1;
    state.speechIndex = 0;
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const target = state.seats.find(
      (seat) => seat.alive && seat.seatId !== speaker.seatId && Math.abs(31 + speaker.seatId * 17 + seat.seatId * 13 + 7) % 3 === 1,
    )!;
    state.speechQueue = [speaker.seatId];
    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      kind: "pressure" as const,
      target,
      targetSpeechStatus: "spoken" as const,
      allowedInteraction: "review_spoken" as const,
      talkingPoints: [`回看${target.seatId}号刚才发言和票口`],
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).not.toMatch(new RegExp(`(?:后面|轮到|等).{0,24}${target.seatId}号.{0,24}(?:补|回应|发言|讲)`));
    expect(result.speech).toContain("回看");
  });

  it("anchors mock speech to a public reasoning cue when one exists", async () => {
    const state = createGame({ seed: 93, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const target = state.seats.find((seat) => seat.isAi && seat.seatId !== speaker.seatId)!;
    const view = buildAgentView(state, speaker.seatId);
    view.publicSummary.tableMemory.reasoningCues = [
      reasoningCue(target, "speech_influence", "strong", "站边和上一轮票型不闭合", [
        "先质疑预言家又跟票同一边",
      ]),
    ];
    const plan = {
      ...createSpeechPlan(view),
      kind: "pressure" as const,
      target,
      talkingPoints: ["目标位的站边和票型不闭合"],
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).toContain("站边和上一轮票型不闭合");
    expect(result.speech).toContain("先质疑预言家又跟票同一边");
    expect(result.speech.length).toBeLessThanOrEqual(380);
    expect(countSpeechSentences(result.speech)).toBeLessThanOrEqual(4);
  });

  it("gives different seats different table tasks when one focus is being repeated", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    state.day = 1;
    const seats = state.seats.filter((seat) => seat.isAi);
    state.speechQueue = seats.map((seat) => seat.seatId);
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seats[0]!.seatId,
      message: "我先保留票口，只按后置位发言质量看。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seats[1]!.seatId,
      message: "1号只说发言质量但没有标准，这个点我先压他。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seats[2]!.seatId,
      message: "我也接2号这个点，1号需要解释什么叫发言质量。",
    });

    const fourthView = buildAgentView(state, seats[3]!.seatId);
    const fifthView = buildAgentView(state, seats[4]!.seatId);
    const influence = {
      sourceSpeechSeq: 2,
      day: 1,
      speaker: { seatId: seats[1]!.seatId, name: seats[1]!.name },
      target: { seatId: seats[0]!.seatId, name: seats[0]!.name },
      direction: "pressure" as const,
      summary: "多人接住1号发言质量标准过虚的压力",
      followupActors: [{ seatId: seats[2]!.seatId, name: seats[2]!.name }],
      followupCount: 1,
    };
    fourthView.publicSummary.tableMemory.speechInfluence = [influence];
    fifthView.publicSummary.tableMemory.speechInfluence = [influence];
    const fourthInput = buildConstrainedSpeechInput(fourthView, createSpeechPlan(fourthView));
    const fifthInput = buildConstrainedSpeechInput(fifthView, createSpeechPlan(fifthView));

    expect(fourthInput.playerSpeechGuide.tableTask?.line).toMatch(/不要复读|借这个焦点|保留.*好人面|转看/);
    expect(fifthInput.playerSpeechGuide.tableTask?.line).toMatch(/不要复读|借这个焦点|保留.*好人面|转看/);
    expect(fourthInput.playerSpeechGuide.tableTask?.mode).not.toBe(fifthInput.playerSpeechGuide.tableTask?.mode);
  });

  it("puts concrete death-shape wording guardrails into guided LLM input", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 92, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view));
    const allGuidance = JSON.stringify(input);

    expect(input.constraints?.join("\n")).toContain("死亡/平安夜直接按公开死亡形态处理");
    expect(allGuidance).toContain("女巫用药了");
    expect(allGuidance).toContain("不要把平安夜本身交给后置位重复解释");
    expect(allGuidance).toContain("不要把女巫是谁");
    expect(allGuidance).toContain("空刀");
    expect(allGuidance).not.toContain("近似忽略");
    expect(allGuidance).not.toContain("狼人不能空刀");
    expect(input.inferenceLayers.highProbability.join("\n")).toContain("女巫用药了");
    expect(input.inferenceLayers.lowProbability.join("\n")).toContain("空刀只作为边界");
    expect(input.inferenceLayers.privateUnknowns.join("\n")).toContain("女巫是谁");
  });

  it("treats repeated peaceful-night mentions as settled context instead of an active talking point", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 92, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const aiSeats = state.seats.filter((seat) => seat.isAi && seat.alive);
    const speaker = aiSeats[2]!;
    state.speechQueue = aiSeats.slice(0, 3).map((seat) => seat.seatId);
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: aiSeats[0]!.seatId,
      message: "平安夜按女巫用药处理，这条线先过，不展开。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: aiSeats[1]!.seatId,
      message: "平安夜已经按公开死亡形态处理，我只看1号刚才的票口。",
    });
    state.speechIndex = 2;

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const activeGuidance = [
      input.tableBriefing.legalSpeechFocus.join("\n"),
      input.playerSpeechGuide.tablePlayerStyle.join("\n"),
      input.playerSpeechGuide.softInteraction.join("\n"),
      input.speechContract.mayAsk.join("\n"),
      input.constraints?.join("\n") ?? "",
    ].join("\n");

    expect(activeGuidance).toContain("平安夜已作为公开死亡形态处理");
    expect(activeGuidance).toMatch(/不要主动复读|不主动复读/);
    expect(activeGuidance).toMatch(/只追一个具体位置|只留一个具体问题|一条当前发言链/);
    expect(activeGuidance).not.toMatch(/可以要求后置位.*补视角|所有人必须|所有后置位|补站边、补票口、补身份线/);
  });

  it("uses the full public speech history for late-seat order instead of only the recent slice", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const seats = state.seats.filter((seat) => seat.alive);
    state.speechQueue = seats.map((seat) => seat.seatId);
    state.speechIndex = 0;
    for (const seat of seats.slice(0, 7)) {
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seat.seatId,
        message: `${seat.seatId}号只讲一个观察点，先看前后理由。`,
      });
    }
    const speaker = seats[7]!;
    const frontSeat = seats[0]!;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const otherUnspokenSeat = seats.find(
      (seat) => seat.seatId !== speaker.seatId && !input.tableBriefing.speechProgress.spokenSeatIds.includes(seat.seatId),
    )!;

    expect(input.publicContext.speechOrder.speakersAlreadyFinished.map((seat) => seat.seatId)).toContain(frontSeat.seatId);
    expect(input.tableBriefing.speechProgress.spokenSeatIds).toContain(frontSeat.seatId);
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号后面再补一下站边。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${frontSeat.seatId}号后续补充发言`]),
    );
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号这轮没给方向，后置位听你补结论。`, "loose")).toEqual(
      expect.arrayContaining([`要求已发言的${frontSeat.seatId}号后续补充发言`]),
    );
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号要么补站边要么补票口，不然我盯着他打。`, "loose")).toEqual(
      expect.arrayContaining([`要求已发言的${frontSeat.seatId}号后续补充发言`]),
    );
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号先记下，等后置位有更多人站边再说。`, "loose")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号我先记下，${otherUnspokenSeat.seatId}号轮到你时只回答一个点。`, "loose")).toEqual([]);
  });

  it("rejects asking an already-spoken seat to report identity checks later", () => {
    let state = createGame({ seed: 97, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 7];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。6号倒牌，女巫没救，我先看后置位谁跳预言家、谁给查验。",
    });
    const view = buildAgentView(state, 7);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "7号发言。前面对1号的质疑我基本认，但我要看他后面报查验时怎么给判断标准，等他报完查验链再决定票口怎么跟。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(validateRenderedSpeech(view, plan, "7号发言。1号刚才只是说看后置位谁跳预言家，我只回看他把压力甩给后面的这个动作。", "guided")).toEqual([]);
  });

  it("rejects telling an already-spoken seat to answer again in the current round", () => {
    let state = createGame({ seed: 97, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先放一边，我想听后置位谁先定站边。",
    });
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。我直接给1号压力，你回答我：1号，你刚才说发言顺序本身是信息，到底是什么意思。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。那我先压你1号，你回我这个问题就行：你刚才是不是把票口悬空了。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。1号说得太轻了，你至少得说清楚自己现在倾向压谁、为什么。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "5号发言。1号，你那句底牌不怕被推没通过，那我直接问：你打算拿什么公开信息说服别人改方向。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。1号这个位置太灵活了，我要看你接下来怎么接后置位的话。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(validateRenderedSpeech(view, plan, "4号发言。我直接给1号压力，1号刚才说发言顺序本身是信息，但没有把自己的站边落下来。", "guided")).toEqual([]);
  });

  it("does not let peaceful-night witch-use wording become a public witch claim", () => {
    let state = createGame({ seed: 97, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜在我这里是女巫用药的结果，狼队空刀概率太低，我不按空刀来盘。",
    });
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");

    expect(input.tableBriefing.publicBoundary.join("\n")).toContain("不等于发言者自称女巫");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。1号自称女巫，首夜平安夜按用药处理没问题，但女巫自拍又没给刀口参考，这个女巫声明我先打一层边界。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把1号的女巫用药表述错当女巫声明"]));
    expect(
      validateRenderedSpeech(view, plan, "2号发言。1号把平安夜按女巫用药处理，这只是死亡形态推理，不等于他拍了女巫身份。", "guided"),
    ).toEqual([]);
  });

  it("keeps day-one peace-night wording concise and rejects verbose no-kill probability talk", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    });
    const speaker = state.seats.find((seat) => seat.alive && seat.seatId === 1)!;
    state.speechQueue = [speaker.seatId, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const briefing = [input.tableBriefing.text, input.publicContext.rules.deathInfoNote, input.inferenceLayers.lowProbability.join("\n")].join("\n");

    expect(briefing).toContain("平安夜只需短句带过");
    expect(briefing).not.toMatch(/空刀概率极其小|近似忽略|实战上可以近似忽略/);
    expect(input.tableBriefing.legalSpeechFocus.join("\n")).toContain("女巫用药了");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("不要求自己或下一位立刻站边");
    expect(input.playerSpeechGuide.tablePlayerStyle.join("\n")).toContain("低信息首轮不用强行站边或落票口");
  });

  it("rejects forcing a low-info first speaker to have a stance or vote outlet", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    });
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜过，女巫用药了。我先看后置位谁主动给身份信息。",
    });
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guidance = [
      input.tableBriefing.text,
      input.playerSpeechGuide.tableTask?.line,
      input.speechContract.mustSay.join("\n"),
      input.debateAgenda.crossExamination.join("\n"),
      input.debateAgenda.voteCommitments.join("\n"),
      input.debateAgenda.pressureLines.join("\n"),
    ].join("\n");
    const activeAttackLines = guidance
      .split("\n")
      .filter((line) => /1号[^。\n]{0,24}(?:没给|没有|未|补|解释).{0,10}(?:初始)?(?:站边|票口)/.test(line))
      .filter((line) => !/不要|不把|不用|别用/.test(line));

    expect(guidance).toContain("不要因为任何前置位没站边或没给票口去硬打");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("不要把1号DeepSeek没站边、没给票口或没给怀疑对象当攻击点");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("首日无硬信息阶段不要把任何已发言位");
    expect(activeAttackLines).toEqual([]);
  });

  it("guides a true witch to name the silver-water target when claiming the save", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    });
    const witch = state.seats.find((seat) => seat.alive && seat.role === "WITCH")!;
    const saved = state.seats.find((seat) => seat.alive && seat.seatId !== witch.seatId)!;
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;
    state.night.wolfTargetSeatId = saved.seatId;
    state.night.witchSavedSeatId = saved.seatId;
    state.witch.antidoteAvailable = false;
    state.witch.poisonAvailable = true;
    const view = buildAgentView(state, witch.seatId);
    const basePlan = createSpeechPlan(view);
    const plan = {
      ...basePlan,
      claimIntent: {
        claimedRole: "WITCH" as const,
        strength: "hard" as const,
      },
      speechMove: "identity_claim" as const,
      playMotive: {
        kind: "tempo_grab" as const,
        line: "女巫拍身份带队。",
        allowIdentityClaim: true,
      },
    };
    const input = buildConstrainedSpeechInput(view, plan, "strict");

    expect(input.speechContract.mustSay.join("\n")).toContain(`${saved.seatId}号是银水`);
    expect(input.tableBriefing.privateFacts.join("\n")).toContain(`你昨夜救过${saved.seatId}号`);
    expect(input.tableBriefing.privateBoundary.join("\n")).toContain("同时报出救的几号/银水");
  });

  it("fallback speech does not evaluate an unspoken target as an existing line", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "我是6号女巫，平安夜我救了9号，9号是银水。3号这轮发言有点空。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 7);
    const unspoken = state.seats.find((seat) => seat.seatId === 9)!;
    const plan = {
      ...createSpeechPlan(view),
      target: unspoken,
      targetSpeechStatus: "unspoken" as const,
      allowedInteraction: "ask_future" as const,
      speechMove: "ask_unspoken_target" as const,
    };
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => {
        throw new Error("provider down");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toMatch(/9号.*还没发言，我不提前评价/);
    expect(result.speech).not.toContain("9号这条线先留着");
  });

  it("exposes the complete current-day speech order to the LLM", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 1, 2, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我先报一个观察点，后面看1号和2号怎么接。",
    });
    const view = buildAgentView(state, 1);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");

    expect(input.publicContext.speechOrder.todaySpeechOrder.map((seat) => seat.seatId)).toEqual([3, 1, 2, 4, 5, 6, 7, 8, 9]);
    expect(input.publicContext.speechOrder.currentSpeakerOrderIndex).toBe(1);
    expect(input.publicContext.speechOrder.currentDayUnspokenSeats.map((seat) => seat.seatId)).toEqual([2, 4, 5, 6, 7, 8, 9]);
    expect(input.tableBriefing.publicFacts.join("\n")).toContain("今日完整发言顺序：3号");
    expect(input.tableBriefing.publicFacts.join("\n")).toContain("今日首置位：3号");
    expect(input.tableBriefing.publicFacts.join("\n")).toContain("当前是今日第2位发言");
  });

  it("guides future-seat mentions to follow today's order instead of jumping over middle seats", () => {
    let state = createGame({ seed: 97, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜过，女巫用药了，这个背景先放这。我最在意的是今天谁第一个跳身份、谁开始带队。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号刚才预设今天必须有人跳身份带队，我手里有一张偏好信息，今天先不把身份线打满。",
    });
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guidance = [
      input.tableBriefing.publicFacts.join("\n"),
      input.tableBriefing.legalSpeechFocus.join("\n"),
      input.speechContract.mustNotAsk.join("\n"),
    ].join("\n");

    expect(input.publicContext.speechOrder.currentDayUnspokenSeats.map((seat) => seat.seatId)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(guidance).toContain("后置位点名顺序");
    expect(guidance).toContain("下一位4号豆包");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号发言。2号这段偏好信息我先记下，我倾向先不站死边，等后置位4号豆包、8号Kimi这一圈过去再判断谁的信息更闭合。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["无理由跨过中间后置位点名"]));
    expect(validateRenderedSpeech(view, plan, "3号发言。2号这段偏好信息我先记下，我倾向先不站死边，等后置位这一圈过去再看信息闭合。", "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "3号发言。2号这段偏好信息我先记下，下一位4号豆包先接这个节奏点就够。", "guided")).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号发言。2号这段偏好信息我先记下，等后置位4号豆包、5号Mimo、6号Gemini这一段过去再看信息闭合。",
        "guided",
      ),
    ).toEqual([]);
  });

  it("allows reviewing a previous-day speech from a target who has not spoken today", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.seatId === 2)!;
    const target = state.seats.find((seat) => seat.seatId === 4)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [target.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: target.seatId,
      message: "4号发言。我打3号是因为他回避站边，票型先压过去。",
    });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, target.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "4号，你上一轮打3号回避站边，这个历史发言我要和今天票型一起核。", "loose"),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(view, plan, "4号当时想压6号，最后投7号，这个历史票型我要核。", "loose"),
    ).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "4号，你到现在还没有站边，信息量太少。", "loose")).toEqual(
      expect.arrayContaining(["把本轮未发言的4号当成已发言评价"]),
    );
  });

  it("allows public discussion of a witch target after the witch has claimed it", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const speaker = state.seats.find((seat) => seat.role === "VILLAGER" && seat.seatId !== 4)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: witch.seatId,
      message: "我是女巫，昨晚救过4号。",
    });
    state.speechIndex = 1;

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${witch.seatId}号女巫报救了4号，这个公开声明我先接着。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "女巫昨晚救了5号，这个公开声明我先接着。", "guided")).toEqual(
      expect.arrayContaining(["发言泄露或编造女巫用药细节"]),
    );
  });

  it("treats soft god identity as a baiting motive instead of forcing a hard claim", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const hunter = state.seats.find((seat) => seat.isAi && seat.role === "HUNTER")!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [hunter.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, hunter.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");

    expect(plan.claimIntent).toEqual(expect.objectContaining({ claimedRole: "HUNTER", strength: "soft" }));
    expect(plan.playMotive).toEqual(expect.objectContaining({ kind: "bait_kill", allowIdentityClaim: false }));
    expect(input.speechContract.move).not.toBe("identity_claim");
    expect(input.speechContract.mustSay.join("\n")).not.toContain("身份声明要与猎人一致");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("不要把软身份边界说成明确猎人身份");
    expect(validateRenderedSpeech(view, plan, "我是猎人，今天不会被抗推。", "guided")).toEqual(
      expect.arrayContaining(["软身份边界不应硬拍身份"]),
    );
    expect(validateRenderedSpeech(view, plan, "我底牌不虚，狼夜里可以来试，今天先按公开发言压票。", "guided")).toEqual([]);
  });

  it("keeps hard god claims available when the play motive is self-defense or tempo", () => {
    let state = createGame({ seed: 76, humanSeatId: 9 });
    const hunter = state.seats.find((seat) => seat.role === "HUNTER")!;
    const priorSpeaker = state.seats.find((seat) => seat.isAi && seat.seatId !== hunter.seatId)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [priorSpeaker.seatId, hunter.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: priorSpeaker.seatId,
      message: `我先压${hunter.seatId}号，如果后置仍只给结论不给过程，我会把票压过去。`,
    });

    const view = buildAgentView(state, hunter.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");

    expect(plan.claimIntent).toEqual(expect.objectContaining({ claimedRole: "HUNTER", strength: "hard" }));
    expect(plan.playMotive).toEqual(expect.objectContaining({ kind: "self_defense", allowIdentityClaim: true }));
    expect(input.speechContract.move).toBe("identity_claim");
    expect(validateRenderedSpeech(view, plan, "我拍猎人，今天不要把票浪费在我身上。", "guided")).toEqual([]);
  });

  it("passes structured interaction status into guided LLM input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const reviewedTarget = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      target: reviewedTarget,
      targetSpeechStatus: "spoken" as const,
      allowedInteraction: "review_spoken" as const,
      speechMove: "review_spoken_target" as const,
    };

    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const constraints = input.constraints?.join("\n") ?? "";

    expect(input.speechPlan?.targetSpeechStatus).toBe("spoken");
    expect(input.speechPlan?.allowedInteraction).toBe("review_spoken");
    expect(input.speechContract.move).toBe("review_spoken_target");
    expect(input.speechContract.targetSpeechStatus).toBe("spoken");
    expect(input.speechContract.allowedInteraction).toBe("review_spoken");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("后续补充");
    expect(input.speechContract.maxSentences).toBe(3);
    expect(constraints).toContain("allowedInteraction=review_spoken");
    expect(constraints).toContain("speechContract.move=review_spoken_target");
    expect(constraints).toContain("只能回看目标已发表内容");
    expect(input.publicContext.rules.speechTimelineNote).toContain("已经发过言的人不能被要求后续补充");
  });

  it("passes a final black-check contract into guided LLM input", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 140, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);

    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const constraints = input.constraints?.join("\n") ?? "";

    expect(input.speechContract.move).toBe("claim_black_check");
    expect(input.speechContract.target?.seatId).toBe(wolf.seatId);
    expect(input.speechContract.mustSay.join("\n")).toContain("查杀");
    expect(input.speechContract.voteBoundary).toContain("票口先压");
    expect(input.speechContract.mustNotAsk.join("\n")).toMatch(/改票|自证/);
    expect(constraints).toContain("speechContract.move=claim_black_check");
  });

  it("passes contract repair instructions on a validation retry", async () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 210, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      strictness: "guided",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({ speech: `我跳预言家，${wolf.seatId}号这张牌先重点观察。` });
        }

        expect(input.stability?.speechContract?.move).toBe("claim_black_check");
        const repairText = input.stability?.repairInstructions?.join("\n") ?? "";
        expect(repairText).toContain("speechContract.move=claim_black_check");
        expect(repairText).toContain(`${wolf.seatId}号`);
        expect(repairText).toContain("查杀");
        return JSON.stringify({ speech: `我跳预言家，${wolf.seatId}号是查杀。今天票口先压这里，外置位只给硬身份反证。` });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(attempts).toBe(2);
    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain(`${wolf.seatId}号是查杀`);
  });

  it("keeps provider-error fallback speech from reverting to report-like seat homework", async () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const seats = state.seats.filter((seat) => seat.alive);
    state.speechQueue = seats.map((seat) => seat.seatId);
    state.speechIndex = 0;
    for (const seat of seats.slice(0, 7)) {
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seat.seatId,
        message: `${seat.seatId}号只讲一个观察点，先看前后理由。`,
      });
    }
    const speaker = seats[7]!;
    const frontSeat = seats[0]!;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/不给全场作业|这一条能不能接上公开逻辑|按时间顺序记下来|目前我想多听/);
    expect(result.speech).not.toMatch(new RegExp(`${frontSeat.seatId}号.{0,24}(?:后面|轮到|等).{0,24}(?:接|补|回应|发言)`));
  });

  it("does not reveal a hidden seer good check in mock speech", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const target = state.seats.find((seat) => seat.seatId !== seer.seatId)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: target.seatId, result: "GOOD" }];

    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(plan.kind).toBe("defend");
    expect(result.speech).not.toContain("我跳预言家");
    expect(result.speech).not.toContain(`${target.seatId}号是金水`);
    expect(result.speech).not.toContain("昨晚验");
  });

  it("does not use an unchallenged public gold water as the fallback mock speech target", async () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 3, humanSeatId: null });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const speaker = state.seats.find((seat) => seat.seatId === 1)!;
    const gold = state.seats.find((seat) => seat.seatId === 2)!;
    speaker.role = "VILLAGER";
    gold.role = "VILLAGER";
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: seer.seatId,
      message: `我跳预言家，${gold.seatId}号是金水。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      target: undefined,
      talkingPoints: ["先听完整轮发言"],
    };
    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).not.toMatch(new RegExp(`${gold.seatId}号[^。！？；，、]{0,28}(讲实|票口|补清楚|放进观察|挂疑问|收票|压)`));
  });

  it("rewrites mock pressure on a dead-seer gold water target into protection", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 3, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.seatId === 1)!;
    const gold = state.seats.find((seat) => seat.seatId === 2)!;
    const deadSeer = state.seats.find((seat) => seat.role === "SEER")!;
    speaker.role = "VILLAGER";
    gold.role = "VILLAGER";
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    view.publicSummary.tableMemory.seerLegacies = [
      {
        claimant: { seatId: deadSeer.seatId, name: deadSeer.name },
        deathDay: 2,
        checks: [{ day: 1, target: { seatId: gold.seatId, name: gold.name }, result: "GOOD" }],
        stancesGiven: [],
        summary: `${deadSeer.name} died after leaving ${gold.name} as gold water.`,
      },
    ];
    const plan = {
      ...createSpeechPlan(view),
      kind: "pressure" as const,
      target: { seatId: gold.seatId, name: gold.name },
      talkingPoints: [`${gold.seatId}号今天要进出人焦点`, `${gold.seatId}号票口需要压清楚`],
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).toContain(`${gold.seatId}号先按公开金水放一轮`);
    expect(result.speech).not.toMatch(new RegExp(`${gold.seatId}号[^。！？；，、]{0,28}(出人焦点|票口需要压|先压)`));
  });

  it("keeps early mock speeches away from prompt-like report wording", async () => {
    const { aiLogs } = await advanceWithMockAi(createGame({ seed: 91, humanSeatId: null }), {
      ignoreHuman: true,
      maxSteps: 200,
    });
    const speeches = aiLogs
      .filter((log) => log.output.type === "speak" || log.output.type === "sheriffSpeech")
      .slice(0, 9)
      .map((log) => ("message" in log.output ? log.output.message : ""));

    expect(speeches.length).toBeGreaterThan(0);
    for (const speech of speeches) {
      expect(speech).not.toMatch(/理由是：|依据是|这个结论来自|什么公开反证|可改判断/);
      expect(speech).not.toMatch(/成为焦点是因为|我认这个点，是因为.+是因为|我打他的点是：/);
      expect(speech).not.toMatch(/被被|被处在身份对跳|被回避站边/);
      expect(speech).not.toMatch(/(.{4,36})，我认的点是\1/);
      expect(speech.length).toBeLessThanOrEqual(380);
      expect(countSpeechSentences(speech)).toBeLessThanOrEqual(4);
    }
  });

  it("guides model speech toward one concise table thread", () => {
    const state = createGame({ seed: 92, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view));
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join(" ");

    expect(guideText).toContain("2-3句短句");
    expect(guideText).toContain("只抓一条主线");
    expect(guideText).toContain("不要列第一、第二、第三");
    expect(guideText).toContain("不要连续多句都用“我先”开头");
  });

  it("includes wolf night instruction only in wolf private speech context", () => {
    const state = createGame({ seed: 47, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const good = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;

    const wolfInput = buildConstrainedSpeechInput(buildAgentView(state, wolf.seatId));
    const wolfAssignment = wolfInput.privateContext.wolfSpeechAssignment as typeof wolfInput.privateContext.wolfSpeechAssignment & {
      nightInstruction?: string;
    };
    const goodInput = buildConstrainedSpeechInput(buildAgentView(state, good.seatId));

    expect(wolfAssignment).toBeDefined();
    expect(wolfAssignment?.nightInstruction).toBeDefined();
    expect(wolfAssignment!.nightInstruction).toContain("首夜");
    expect(goodInput.privateContext.wolfSpeechAssignment).toBeUndefined();
    expect(JSON.stringify(goodInput)).not.toMatch(/狼队首夜|战术|nightInstruction/);
  });

  it("adds a strict model speech constraint for dead-seer gold water", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 3, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.seatId === 1)!;
    const gold = state.seats.find((seat) => seat.seatId === 2)!;
    const deadSeer = state.seats.find((seat) => seat.role === "SEER")!;
    speaker.role = "VILLAGER";
    gold.role = "VILLAGER";
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    view.publicSummary.tableMemory.seerLegacies = [
      {
        claimant: { seatId: deadSeer.seatId, name: deadSeer.name },
        deathDay: 2,
        checks: [{ day: 1, target: { seatId: gold.seatId, name: gold.name }, result: "GOOD" }],
        stancesGiven: [],
        summary: `${deadSeer.name} died after leaving ${gold.name} as gold water.`,
      },
    ];
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "strict");

    expect(input.constraints?.join("\n")).toContain(`dead seer gold seat ${gold.seatId}`);
  });

  it("briefs day-one single death as a public death-shape hypothesis without confirming potion use", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 94, humanSeatId: null });
    const deadSeat = state.seats.find((seat) => seat.role !== "WEREWOLF")!;
    const speaker = state.seats.find((seat) => seat.alive && seat.seatId !== deadSeat.seatId)!;
    deadSeat.alive = false;
    deadSeat.deathReason = "WOLF_KILL";
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });

    const input = buildConstrainedSpeechInput(buildAgentView(state, speaker.seatId));
    const briefingText = [
      input.tableBriefing.text,
      input.tableBriefing.publicReasoningCues.join("\n"),
      input.tableBriefing.publicBoundary.join("\n"),
      input.tableBriefing.unknowns.join("\n"),
      input.publicContext.rules.deathInfoNote,
    ].join("\n");

    expect(briefingText).toMatch(/首夜单死.*女巫没救.*合理简称/);
    expect(briefingText).toMatch(/不应只因.*女巫没救.*质疑/);
    expect(briefingText).toMatch(/平安夜直接按公开死亡形态处理/);
    expect(briefingText).toMatch(/女巫用药了/);
    expect(briefingText).toMatch(/不要把平安夜本身交给后置位重复解释/);
    expect(briefingText).toMatch(/空刀.*不作为|空刀只作为边界/);
    expect(briefingText).toMatch(/非女巫.*女巫是谁.*具体救了几号.*狼刀或毒口/);
    expect(briefingText).toMatch(/真女巫.*真实救毒信息/);
    expect(briefingText).toMatch(/药瓶状态.*公开死亡形态/);
    expect(briefingText).not.toMatch(/不能断定.*女巫用药|不能断定.*女巫动作/);
    expect(briefingText).not.toContain("狼人不能空刀");
    expect(briefingText).toContain("公开死亡形态");
  });

  it("allows public potion-line speculation but rejects hidden potion details and absolute no-kill claims", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 92, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "昨晚平安夜，女巫用药了，这个背景先放下。", "strict")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "昨晚平安夜，空刀可以认为不存在，先按女巫处理狼刀盘。", "strict")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "昨晚平安夜，狼人肯定空刀了。", "strict")).toEqual(
      expect.arrayContaining(["发言把极低概率空刀说成确定事实"]),
    );
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，狼人不能空刀，所以大概率女巫用药。")).toEqual(
      expect.arrayContaining(["发言把狼人空刀说成规则不可能"]),
    );
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，女巫用了解药，这个信息先放这里。", "strict")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，女巫用了解药，这个信息先放这里。")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，最直接的解释是女巫开了解药，但我不替女巫确认。")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，按板子先当女巫处理了狼刀来盘。")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，女巫用药了，我不展开空刀。")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，女巫救的是3号，3号先放。")).toEqual(
      expect.arrayContaining(["发言泄露或编造女巫用药细节"]),
    );
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，女巫已经没解药了。")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，女巫没有开毒，也就是说女巫手里现在是一瓶解药没用、一瓶毒药还在。")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，我更倾向药线成立，但不替女巫公开具体信息。", "strict")).not.toContain(
      "发言泄露或编造女巫用药细节",
    );
    expect(validateRenderedSpeech(view, plan, "我是DeepSeek，首夜平安夜，我更倾向药线成立，但不替女巫公开具体信息。")).toEqual([]);
  });

  it("rejects soft self-leaks of hidden witch save information", () => {
    let state = Array.from({ length: 30 }, (_, seed) => createGame({ seed: seed + 72, humanSeatId: 9 })).find((candidate) =>
      candidate.seats.some((seat) => seat.isAi && seat.role === "WITCH"),
    )!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const witch = state.seats.find((seat) => seat.isAi && seat.role === "WITCH")!;
    const victim = state.seats.find((seat) => seat.seatId !== witch.seatId && seat.role !== "WEREWOLF")!;
    state = applyCommand(state, {
      type: "wolfKill",
      actorSeatId: wolf.seatId,
      targetSeatId: victim.seatId,
    });
    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "save" });
    state = applySystemStep(state);
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, witch.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "我救过人的信息不会在这里展开。")).toEqual(
      expect.arrayContaining(["发言暗示私密女巫用药状态"]),
    );
    expect(validateRenderedSpeech(view, plan, "首夜平安夜，按女巫用药处理，别再让后置重复聊空刀。")).toEqual([]);
  });

  it("rejects asking later speakers to re-litigate peaceful night", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 92, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const laterSeat = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId, laterSeat.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `后置${laterSeat.seatId}号等下谈谈平安夜是女巫用药还是空刀。`)).toEqual(
      expect.arrayContaining(["平安夜不应被当成后置追问任务"]),
    );
  });

  it("rejects judgments that treat unspoken seats as already having answered", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const unspoken = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId, unspoken.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${unspoken.seatId}号查杀我之后又拿我的短发言做文章，这轮我先打他。`, "guided")).toEqual(
      expect.arrayContaining([`把本轮未发言的${unspoken.seatId}号当成已发言评价`]),
    );
  });

  it("allows future listening tasks for unspoken seats without treating them as already answered", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const unspoken = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    const namedUnspoken = state.seats.find((seat) => seat.alive && seat.name === "豆包")!;
    state.speechQueue = [speaker.seatId, unspoken.seatId, namedUnspoken.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `我重点听${unspoken.seatId}号的位置，他是我这轮第一个要确认态度的对象。`, "guided")).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `今天先看一圈发言顺序和站边理由，我重点听${namedUnspoken.seatId}号${namedUnspoken.name}的位置，他是我这轮第一个要确认态度的对象。`,
        "guided",
      ),
    ).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `我重点听${unspoken.seatId}号${namedUnspoken.name}的位置，他是我这轮第一个要确认态度的对象。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `后置位${unspoken.seatId}号可以稍后说说你对平安夜之后第一轮出人的看法。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${unspoken.seatId}号到现在还没有给态度，这轮我先打他。`, "guided")).toEqual(
      expect.arrayContaining([`把本轮未发言的${unspoken.seatId}号当成已发言评价`]),
    );
  });

  it("rejects asking already-spoken front seats to answer later", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const frontSeat = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== frontSeat.seatId)!;
    state.speechQueue = [frontSeat.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: frontSeat.seatId,
      message: "我先按平安夜女巫用药处理，今天看2号票口。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号后面再补一下站边和票口。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${frontSeat.seatId}号后续补充发言`]),
    );
  });

  it("allows reviewing that an already-spoken front seat did not give a vote target", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const frontSeat = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== frontSeat.seatId)!;
    state.speechQueue = [frontSeat.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: frontSeat.seatId,
      message: "我先按平安夜女巫用药处理，今天不急着给死票口。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号自己没给票口，只是在打1号的话术。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号没有明确站边和票口，这个缺口我先记。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号后面再给票口，不然我继续压他。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${frontSeat.seatId}号后续补充发言`]),
    );
  });

  it("allows real seed 95 review wording without treating it as a future ask", () => {
    let state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message:
        "1号发言。平安夜，女巫用药了，这个先过，不多展开。 我闭眼视角，今天第一轮发言，我会重点看谁在结论和过程之间缺逻辑链——比如直接报站边但给不出为什么，或者跳过理由只打情绪。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message:
        "2号发言。1号刚才说平安夜“女巫用药了”，这个结论你是闭眼视角怎么锁死的？按公开死亡形态推女巫用药可以，但你直接当既定事实来讲，我反而觉得你在给后面定调。",
    });

    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4];
    state.speechIndex = 0;
    const seerView = buildAgentView(state, 3);
    expect(
      validateRenderedSpeech(
        seerView,
        createSpeechPlan(seerView),
        "3号发言。我跳预言家，昨晚查了2号，结果是狼人。验他的理由是，他刚才质疑1号平安夜那句时自己也没给更合理的解释，反而在给后置位划范围。",
        "guided",
      ),
    ).toEqual([]);

    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我这里先把验人说清楚：2号Claude-DS-reason是查杀。今天票口先压这条查杀线，外置位只给硬身份反证。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const fourthView = buildAgentView(state, 4);

    expect(
      validateRenderedSpeech(
        fourthView,
        createSpeechPlan(fourthView),
        "4号发言。3号查杀我先记，但焦点转回1号，2号追问得很到位，你给不出闭环。我暂时更信2号，票口先压1号。",
        "guided",
      ),
    ).toEqual([]);
  });

  it("allows saying a finished speaker attacked another player's missing vote target", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const first = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const second = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== first.seatId)!;
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== first.seatId && seat.seatId !== second.seatId)!;
    state.speechQueue = [first.seatId, second.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: first.seatId,
      message: `${first.seatId}号先不落票口，只说平安夜背景。`,
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: second.seatId,
      message: `${second.seatId}号反打${first.seatId}号没给票口，但自己也先保留。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${second.seatId}号反打${first.seatId}号没给票口，但${second.seatId}号自己也没落身份线。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `后续${second.seatId}号反打${first.seatId}号没给票口，但${second.seatId}号自己也没落身份线。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${second.seatId}号你回击${first.seatId}号的标准，自己也没给落脚点，这个双标我先记着。`, "guided")).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `${second.seatId}号接${first.seatId}号的话点4号，这个动作本身是顺水推舟，没有独立判断依据，我按这个缺口先挂一票观察他。底牌不虚，但我不会在这轮替好人省推理，票口先压${second.seatId}号，等后置位发言看有没有人接这根线。`,
        "guided",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `${second.seatId}号刚才只说结论和依据还需要再对照，没给具体哪一点不闭环，这个空口保留我放不住。`,
        "guided",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `${second.seatId}号刚才只说结论和依据还需要再对照，没点明具体哪一条不闭环，这个空口保留我放不住。`,
        "guided",
      ),
    ).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${second.seatId}号后面再给票口，不然我继续压他。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${second.seatId}号后续补充发言`]),
    );
    expect(validateRenderedSpeech(view, plan, `${second.seatId}号后面回一下你刚才的标准。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${second.seatId}号后续补充发言`]),
    );
  });

  it("allows saying multiple finished speakers kept pressure without asking them to continue", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const first = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const second = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== first.seatId)!;
    const third = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== first.seatId && seat.seatId !== second.seatId)!;
    const speaker = state.seats.find(
      (seat) => seat.alive && seat.isAi && ![first.seatId, second.seatId, third.seatId].includes(seat.seatId),
    )!;
    state.speechQueue = [first.seatId, second.seatId, third.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: first.seatId,
      message: `${first.seatId}号先放一个观察点。`,
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: second.seatId,
      message: `${second.seatId}号开始压${first.seatId}号。`,
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: third.seatId,
      message: `${third.seatId}号继续压${first.seatId}号。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${second.seatId}号和${third.seatId}号连续施压${first.seatId}号，${first.seatId}号原话里没有闭环点。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${third.seatId}号后面继续补票口，不然我不认这条压力。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${third.seatId}号后续补充发言`]),
    );
  });

  it("allows asking an unspoken seat to comment on a finished speaker's previous line", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const finished = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== finished.seatId)!;
    const unspoken = state.seats.find((seat) => seat.alive && seat.seatId !== finished.seatId && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [finished.seatId, speaker.seatId, unspoken.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: finished.seatId,
      message: `${finished.seatId}号提前点了${unspoken.seatId}号的判断力。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, unspoken.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `后置位${unspoken.seatId}号，你刚才被${finished.seatId}号提前点名，怎么看${finished.seatId}号那句判断力？`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `${finished.seatId}号后面再解释那句判断力，不然我不认。`, "guided")).toEqual(
      expect.arrayContaining([`要求已发言的${finished.seatId}号后续补充发言`]),
    );
  });

  it("rejects contract violations when a review-only target is asked to answer later", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const reviewedTarget = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      target: reviewedTarget,
      targetSpeechStatus: "spoken" as const,
      allowedInteraction: "review_spoken" as const,
      speechMove: "review_spoken_target" as const,
    };

    expect(validateRenderedSpeech(view, plan, `${reviewedTarget.seatId}号等下再回应一下站边和票口。`, "guided")).toEqual(
      expect.arrayContaining([`speechContract要求只回看${reviewedTarget.seatId}号已发表内容`]),
    );
  });

  it("rejects vote-reversal conditions after a real seer black check", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 120, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    const claimCheck = { day: 1, claimantSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" as const };
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = {
      ...createSpeechPlan(view),
      kind: "claim-check" as const,
      target: wolf,
      claimIntent: {
        claimedRole: "SEER" as const,
        strength: "hard" as const,
        check: claimCheck,
      },
    };

    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我跳预言家，${wolf.seatId}号是查杀。今天先出${wolf.seatId}号，如果他后面能把逻辑闭环，我会改票。`,
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["真预言家查杀不能让查杀位靠自证改票"]));
  });

  it("rejects saying a black-check target is the seer claimant", () => {
    let state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const claimant = state.seats.find((seat) => seat.alive && seat.role === "SEER")!;
    const checkedTarget = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    const speaker = state.seats.find((seat) => seat.alive && seat.seatId !== claimant.seatId && seat.seatId !== checkedTarget.seatId)!;
    state.speechQueue = [claimant.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: claimant.seatId,
      message: `${claimant.seatId}号发言。我跳预言家，${checkedTarget.seatId}号是查杀。验他的理由是他首轮卡位太重。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我暂时认${checkedTarget.seatId}号预言家，因为${claimant.seatId}号跳预言家给${checkedTarget.seatId}号查杀。`,
        "guided",
      ),
    ).toEqual(expect.arrayContaining([`把被查杀的${checkedTarget.seatId}号错认成预言家`]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我暂时认${claimant.seatId}号预言家，因为他跳预言家给${checkedTarget.seatId}号查杀。`,
        "guided",
      ),
    ).toEqual([]);
  });

  it("puts black-check attribution alternatives into the speech contract", () => {
    let state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我跳预言家，2号Claude-DS-reason是我昨晚验的查杀，狼人。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view));
    const mustNotAsk = input.speechContract.mustNotAsk.join("\n");

    expect(mustNotAsk).toContain("不能说认2号预言家");
    expect(mustNotAsk).toContain("不认3号预言家");
    expect(mustNotAsk).toContain("保2号查杀位");
  });

  it("rejects unfinished why-question fragments in rendered speech", () => {
    const state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    state.seerChecks = [{ day: 1, seerSeatId: 3, targetSeatId: 2, result: "WEREWOLF" }];
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "3号发言。我跳预言家，2号是查杀，昨晚验的。为什么验他。", "guided")).toEqual(
      expect.arrayContaining(["发言存在未完成的问题句"]),
    );
    expect(validateRenderedSpeech(view, plan, "3号发言。我跳预言家，2号是查杀，昨晚验的。为什么验他？因为2号前置节奏给得太早。", "guided")).not.toContain(
      "发言存在未完成的问题句",
    );
  });

  it("rejects the real seed 95 wording that called the black-check target seer", () => {
    let state = createGame({ seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message:
        "1号发言。平安夜，我闭眼视角，女巫用药了，这个先过。 今天没有对跳，也没有查验冲突，我先看一圈发言里谁的解释缺过程、谁前后搭不上。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message:
        "1号你说平安夜“女巫用药了”，闭眼视角怎么直接跳过女巫没救或狼空刀的可能？这个结论太笃定，我先把这一点记着。3号你听完1号，觉得他这条线顺不顺？",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我跳预言家，2号Claude-DS-reason是我昨晚验的查杀，狼人。今天票口先压2号，外置位谁有硬身份反证可以出来挡，否则这轮先走查杀。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message:
        "我不想慢慢磨。刚才3号GPT-DS-chat-3这段我只抓一个点：给过身份信息，需要核对前后是否一致。2号Claude-DS-reason这条线先留着，票口看后面有没有硬证据。后面我只等5号Mimo-DS-chat-5接刚才这个点。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "5号发言。3号单边跳预言家，但2号问1号的那句“闭眼视角直接跳女巫用药”你作为预言家没接，只接2号的问题扔查杀，这个接话顺序我卡住了。我暂时认2号预言家，今天先压3号，票不要散。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把被查杀的2号错认成预言家"]));
  });

  it("rejects framing pre-black-check speech as a post-black-check reaction", () => {
    let state = createGame({ seed: 96, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜按女巫用药处理，我今天先不拍具体身份。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号说底牌够硬但不拍身份，这个模糊空间我先记着。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我是预言家，昨晚查验2号，查杀。今天票口先压2号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。3号跳预言家查杀2号，这个动作我认可。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 5,
      message: "5号发言。我倾向今天票口先压2号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 7, 8];
    state.speechIndex = 0;
    const view = buildAgentView(state, 8);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan);
    const facts = input.tableBriefing.publicFacts.join("\n");

    expect(facts).toContain("2号Claude的本日发言发生在3号GPT报查杀之前");
    expect(facts).toContain("2号查杀前的发言/原话");
    expect(facts).toContain("2号原话不是对3号查杀/验人理由的回应或质疑");

    expect(validateRenderedSpeech(view, plan, "4号发言。3号跳预言家查杀2号。2号被查杀后的反应是什么。", "guided")).toEqual(
      expect.arrayContaining(["把2号查杀公布前的发言说成查杀后反应"]),
    );
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "7号发言。如果2号真是狼，被查杀后第一反应应该是对跳或者递话，但他选择去打1号。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把2号查杀公布前的发言说成查杀后反应"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。2号被查杀后第一反应是转去打1号的留牌方式，这个回避动作本身就是一个缺口。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把2号查杀公布前的发言说成查杀后反应"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。我要转看一下2号——你被查杀后没有任何自辩，这个反应我单记一笔。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把2号查杀公布前的发言说成查杀后反应"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。2号在被查杀之前那段发言是转去打1号的留牌方式，这个前置动作我先记着。",
        "guided",
      ),
    ).not.toContain("把2号查杀公布前的发言说成查杀后反应");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "7号发言。3号查杀2号，但没交代为什么首验选2号——这个缺口在2号发言里已经被他点过，3号没有接。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把2号查杀公布前的发言说成已经质疑3号查杀线"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "7号发言。2号原话发生在3号报查杀之前，只能作为前置材料；3号首验2号的心路缺口由后置位继续追问。",
        "guided",
      ),
    ).not.toContain("把2号查杀公布前的发言说成已经质疑3号查杀线");
  });

  it("explains that front seats cannot answer later challenges in the same speech round", () => {
    let state = createGame({ seed: 96, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先按女巫用药处理，我不展开别的身份。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号没有明确票口，我先记一个模糊。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我是预言家，昨晚查验2号，查杀。今天票口先压2号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。3号只给查杀结论，没有解释为什么验2号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 5,
      message: "5号发言。3号单边预言家我先记着，但验人理由确实短。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "6号发言。3号首夜验2号的依据没有给，这个缺口我继续压。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 7,
      message: "7号发言。3号跳预言家报2号查杀，但整段只有结论没有验人思路。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [8];
    state.speechIndex = 0;
    const view = buildAgentView(state, 8);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan);
    const facts = input.tableBriefing.publicFacts.join("\n");

    expect(facts).toContain("后续多人追问3号GPT的验人理由");
    expect(facts).toContain("3号本轮尚无再次发言机会");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。4号6号7号全在问3号首夜验2号的依据，你一个字没回，这个缺口我先挂着。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把3号发言后的追问说成3号未回应"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。4号6号7号都在追问3号首夜验2号的依据，但这些追问发生在3号发言之后，我只能先记这个后置压力。",
        "guided",
      ),
    ).not.toContain("把3号发言后的追问说成3号未回应");
  });

  it("rejects guided seer speeches that skip the final black-check contract", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 170, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `我跳预言家，${wolf.seatId}号这张牌今天先重点观察。`, "guided")).toEqual(
      expect.arrayContaining([`speechContract要求报出${wolf.seatId}号查杀`]),
    );
  });

  it("rejects verbose report-style model speeches in guided mode", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const reportSpeech =
      "我需要你们现在把三件事说清楚：第一，你站哪边，第二，你认为3号查杀是真是假，第三，今天想出谁；如果后面每个人都只给结论不给过程，那今天的票口就全部压回2号，我会根据你们的回答再重新评估。";

    expect(validateRenderedSpeech(view, plan, reportSpeech, "guided")).toEqual(
      expect.arrayContaining(["发言过于冗长或报告化"]),
    );
  });

  it("lets the real witch reveal her actual saved target but rejects false potion targets", () => {
    let state = Array.from({ length: 30 }, (_, seed) => createGame({ seed: seed + 72, humanSeatId: 9 })).find((candidate) =>
      candidate.seats.some((seat) => seat.isAi && seat.role === "WITCH"),
    )!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const witch = state.seats.find((seat) => seat.isAi && seat.role === "WITCH")!;
    const victim = state.seats.find((seat) => seat.seatId !== witch.seatId && seat.role !== "WEREWOLF")!;
    const falseTarget = state.seats.find((seat) => seat.seatId !== victim.seatId && seat.seatId !== witch.seatId && seat.alive)!;
    state = applyCommand(state, {
      type: "wolfKill",
      actorSeatId: wolf.seatId,
      targetSeatId: victim.seatId,
    });
    state.phase = "NIGHT_WITCH";
    state = applyCommand(state, { type: "witchAction", actorSeatId: witch.seatId, mode: "save" });
    state = applySystemStep(state);
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, witch.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `我拍女巫，昨晚我救的是${victim.seatId}号。`)).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `我拍女巫，昨晚我救的是${falseTarget.seatId}号。`)).toEqual(
      expect.arrayContaining(["发言泄露或编造女巫用药细节"]),
    );
  });
});

function countSpeechSentences(speech: string): number {
  return speech.split(/[。！？]/).filter((part) => part.trim().length > 0).length;
}

function reasoningCue(
  target: { seatId: number; name: string },
  kind: PublicReasoningCue["kind"],
  weight: PublicReasoningCue["weight"],
  summary: string,
  evidence: string[],
): PublicReasoningCue {
  return {
    cueId: `${kind}:${target.seatId}`,
    day: 1,
    kind,
    weight,
    summary,
    target,
    evidence,
  };
}

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

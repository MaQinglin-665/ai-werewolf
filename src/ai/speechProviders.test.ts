import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, createGame } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import type { PublicReasoningCue, Seat } from "@/game/types";
import { advanceWithMockAi } from "./mockAgent";
import { createSpeechPlan } from "./tableRead";
import { buildConstrainedSpeechInput, createConstrainedLlmSpeechProvider, mockSpeechProvider, routedModelSpeechProvider } from "./speechProviders";

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

  it("keeps early mock speeches away from prompt-like report wording", async () => {
    const { aiLogs } = await advanceWithMockAi(createGame({ seed: 91, humanSeatId: null }), {
      ignoreHuman: true,
      maxSteps: 80,
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

    expect(guideText).toContain("2-4句短句");
    expect(guideText).toContain("只抓一条主线");
    expect(guideText).toContain("不要连续多句都用“我先”开头");
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

    expect(briefingText).toMatch(/首夜单死.*药线假设/);
    expect(briefingText).toMatch(/不能断定|不能说成确定死因/);
    expect(briefingText).toContain("公开死亡形态");
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

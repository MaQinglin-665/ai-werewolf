import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, applySystemStep, createGame } from "@/game/engine";
import { defaultOrdinaryPlayerProfile } from "@/game/ordinaryPlayerProfiles";
import { buildAgentView } from "@/game/projection";
import type { AiCharacterRoleCard, PublicReasoningCue, Seat, SpeechPlan } from "@/game/types";
import { advanceWithMockAi, createMockCommand } from "./mockAgent";
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
  it("rejects markdown emphasis wrappers in rendered speech", () => {
    const state = createGame({ seed: 91 });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "** “我先看1号这句查杀怎么被接。” **", "guided")).toContain(
      "发言包含非对白Markdown格式",
    );
  });

  it("rejects class-trial speech that ends mid-thought without a sentence close", () => {
    const state = createGame({ seed: 91 });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "千早爱音";
    speaker.roleCard = roleCardFixture("anon", "千早爱音");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "等一下，这里有点绕回来了。我先把关系接回来——塞蕾丝缇雅，你那句", "guided"),
    ).toContain("发言疑似被截断");
    expect(validateRenderedSpeech(view, plan, "塞蕾丝，你这枚筹码押得很轻。但这里面有个问题。", "guided")).toContain(
      "发言疑似被截断",
    );
  });

  it("rejects ordinary speech that ends after a previous-speaker pickup", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats[9]!;
    speaker.name = "Claude2";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "我是10号Claude2。刚才9号DeepSeek2说的", "guided")).toContain(
      "普通局发言疑似被截断",
    );
  });

  it("does not soft-accept ordinary speech that still ends as a fragment after retries", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [10];
    state.speechIndex = 0;
    const view = buildAgentView(state, 10);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-truncated-hard-reject-test",
      render: async () =>
        JSON.stringify({
          speech: "我先说9号DeepSeek2刚才那段。他抓6号Gemini那句",
        }),
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(JSON.stringify(result.rawOutput)).toContain("普通局发言疑似被截断");
    expect(result.speech).not.toContain("他抓6号Gemini那句");
  });

  it("rejects ordinary speech that ends at an empty rebuttal cue", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "今天票口先压2号Claude，外置位要反驳就拿硬身份来对撞，别光说",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
  });

  it("allows ordinary speakers to reference an immediately public Seer check", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.seats[1]!.role = "SEER";
    state.seats[1]!.name = "Claude";
    state.seats[10]!.name = "GPT2";
    state.speechQueue = [2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，预言家。昨晚验了11号GPT2，11号GPT2是查杀。今天票先压11号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(view.publicSummary.claimBoard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimedRole: "SEER",
          claimant: expect.objectContaining({ seatId: 2 }),
          checks: expect.arrayContaining([
            expect.objectContaining({
              target: expect.objectContaining({ seatId: 11 }),
              result: "WEREWOLF",
            }),
          ]),
        }),
      ]),
    );
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是3号GPT。接一下上一位2号Claude，他刚才跳预言家报11号GPT2查杀，票压11号。这个信息量我先认，但2号自己还在对跳压力里，所以今天我不替任何人结算。",
        "guided",
      ),
    ).not.toContain("凭空引用未公开查验结果");
  });

  it("strips full-width parenthetical stage directions from class-trial speech", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "stage-direction-test",
      render: async () =>
        JSON.stringify({
          speech:
            "苗木诚，你突然跳预言家，我先不急着接。（手指捏紧衣角）4号黑白熊，别绕圈子，正面接这个查验结果。",
        }),
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const fukawa = state.seats[2]!;
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [fukawa.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, fukawa.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toContain("手指捏紧衣角");
    expect(result.speech).toContain("4号黑白熊");
  });

  it("strips in-line class-trial table stage directions from speech", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "table-stage-direction-test",
      render: async () =>
        JSON.stringify({
          speech:
            "苗木诚，你刚才那句留断点我先记下。（转向桌面）4号黑白熊，你别顺着空话往下推。",
        }),
      strictness: "guided",
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const anon = state.seats[8]!;
    anon.name = "千早爱音";
    anon.roleCard = roleCardFixture("anon", "千早爱音");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [anon.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, anon.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toContain("转向桌面");
    expect(result.speech).toContain("4号");
  });

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
    expect(result.speech).toBe("我先说我听到的东西，2号这轮只给流程没给票口，我想追问你今天的出人方向是。");
    expect(result.speech).not.toMatch(/[，,;；:：、-]$/);
  });

  it("dedupes adjacent repeated sheriff claim sentences from LLM speech", async () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.phase = "SHERIFF_SPEECH";
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const target = state.seats.find((seat) => seat.seatId !== seer.seatId && seat.role === "WEREWOLF")!;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () =>
        JSON.stringify({
          speech: `我跳预言家，${target.seatId}号是查杀。我跳预言家，${target.seatId}号是查杀。今天票口先压${target.seatId}号。`,
        }),
    });
    state.sheriff = {
      candidates: [seer.seatId],
      speechQueue: [seer.seatId],
      speechIndex: 0,
      nominationDecisions: {},
      withdrawalDecisions: {},
      votes: {},
      withdrawnSeatIds: [],
      resolved: false,
    };
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: target.seatId, result: "WEREWOLF" }];
    const view = buildAgentView(state, seer.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech.match(/我跳预言家/g)).toHaveLength(1);
    expect(result.speech).toContain(`${target.seatId}号是查杀`);
    expect(result.speech).toContain(`今天票口先压${target.seatId}号`);
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

  it("keeps class-trial repair as LLM freeplay while removing illegal future asks", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const finished = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== finished.seatId)!;
    finished.name = "苗木诚";
    finished.roleCard = roleCardFixture("naegi", "苗木诚");
    speaker.name = "雾切响子";
    speaker.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [finished.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: finished.seatId,
      message: `${finished.seatId}号苗木诚只说先记录发言顺序。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({ speech: `${finished.seatId}号苗木诚后面再补一下你的判断标准。` });
        }
        retryInput = input;
        return JSON.stringify({ speech: `我是雾切响子。${finished.seatId}号苗木诚已经说过的话里，证据链缺的是判断标准；我只把这个断点放到裁判台上。` });
      },
    });
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(attempt).toBe(2);
    expect(result.isFallback).toBe(false);
    const repairInstructions = retryInput!.stability!.repairInstructions!.join("\n");
    expect(repairInstructions).toContain("学级裁判角色修复");
    expect(repairInstructions).toContain("LLM 自由发挥");
    expect(repairInstructions).toContain("不要改成模板兜底句");
    expect(result.speech).toContain("雾切响子");
    expect(result.speech).not.toContain("后面再补");
  });

  it("repairs class-trial reads that treat an unspoken seat as already silent", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const speaker = state.seats[4]!;
    const target = state.seats[7]!;
    speaker.name = "江之岛盾子";
    target.name = "高松灯";
    speaker.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    target.roleCard = roleCardFixture("tomori", "高松灯");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, target.seatId];
    state.speechIndex = 0;

    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({
            speech: `${target.seatId}号${target.name}到现在一个字没说，这种沉默本身就很绝望。`,
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: `${target.seatId}号${target.name}还没接这条线，我不替她摆表情；先看谁急着给她定性。`,
        });
      },
    });
    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      target: { seatId: target.seatId, name: target.name },
      targetSpeechStatus: "unspoken" as const,
      allowedInteraction: "ask_future" as const,
      speechMove: "ask_unspoken_target" as const,
    };

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(attempt).toBe(2);
    const repairInstructions = retryInput!.stability!.repairInstructions!.join("\n");
    expect(repairInstructions).toContain("本轮还没开口");
    expect(repairInstructions).toContain("不能写“到现在没说");
    expect(repairInstructions).toContain("轮到他时正面接");
  });

  it("keeps Day 2+ class-trial LLM input focused on role play instead of self-introduction scripts", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "雾切响子";
    speaker.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");

    const guide = [
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.avoid,
      ...input.speechContract.mustNotAsk,
    ].join("\n");

    expect(guide).toContain("本地主题角色：雾切响子");
    expect(guide).toContain("角色正在玩狼人杀");
    expect(guide).not.toContain("第二天以后");
    expect(guide).not.toContain("第一天早上的自我介绍已经结束");
    expect(guide).not.toContain("不要再自我介绍");
  });

  it("keeps class-trial template bans out of LLM-visible contract while validation rejects them", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "雾切响子";
    speaker.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const contractText = input.speechContract.mustNotAsk.join("\n");

    expect(contractText).toBe("");
    expect(
      validateRenderedSpeech(view, plan, "我是雾切响子。我是闭眼好人，目前信息不多，先听后置位发言。", "guided"),
    ).toEqual(expect.arrayContaining(["第二天以后不要再自我介绍", "学级裁判发言过于模板化"]));
  });

  it("keeps first-morning class-trial guide freeform instead of repeating self-introduction policy", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "苗木诚";
    speaker.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guide = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(guide).toContain("本地主题角色：苗木诚");
    expect(guide).toContain("角色正在玩狼人杀");
    expect(guide).not.toContain("只有第一天早上可以自然报一次");
    expect(guide).not.toContain("不要每轮重复");
  });

  it("rejects Day 2+ class-trial speeches that reopen with a self-introduction", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "雾切响子";
    speaker.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    expect(validateRenderedSpeech(view, createSpeechPlan(view), "我是雾切响子。昨晚的死讯让证据链更清楚了。", "guided")).toEqual(
      expect.arrayContaining(["第二天以后不要再自我介绍"]),
    );
    expect(validateRenderedSpeech(view, createSpeechPlan(view), "雾切响子。昨晚的死讯让证据链更清楚了。", "guided")).toEqual(
      expect.arrayContaining(["第二天以后不要再自我介绍"]),
    );
  });

  it("rejects Day 2 class-trial speakers repeating the same vote-mouth question chain", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 609, humanSeatId: null });
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    const celestia = state.seats[5]!;
    for (const [seat, id, name] of [
      [kirigiri, "kirigiri", "雾切响子"],
      [fukawa, "fukawa", "腐川冬子"],
      [monokuma, "monokuma", "黑白熊"],
      [enoshima, "enoshima", "江之岛盾子"],
      [celestia, "celestia", "塞蕾丝缇雅"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId, celestia.seatId];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [kirigiri.seatId, "6号，你昨天追3号的时候问得很清楚，筹码押在哪一侧。今天你的票口打算往哪里押？"],
      [fukawa.seatId, "2号，你刚才问6号筹码押在哪一侧，问得很顺。今天的票口，你打算往哪里押？别用问句把结论藏起来。"],
      [monokuma.seatId, "噗，3号，你自己不也在用问句追2号吗？今天的票口打算押哪边？我这边也需要一个公开落点。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号、3号、4号，一个追着一个问“今天的票口押哪边”，问得理直气壮，可答案呢？全都没有。尤其是4号，你刚才抓3号用问句藏结论，说得对。可你自己呢。",
        "guided",
      ),
    ).toContain("D2学级裁判不要复读同一票口问法链");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号黑白熊，你刚才像在照镜子审判别人。你抓3号用问句藏结论，可你真正急的是让所有人继续盯着谁没交答案；这个舞台我先拆给大家看。",
        "guided",
      ),
    ).not.toContain("D2学级裁判不要复读同一票口问法链");
  });

  it("rejects saying an earlier speaker targeted an unspoken seat they explicitly held back from pressing", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 610, humanSeatId: null });
    const celestia = state.seats[5]!;
    const togami = state.seats[6]!;
    const tomori = state.seats[7]!;
    for (const [seat, id, name] of [
      [celestia, "celestia", "塞蕾丝缇雅"],
      [togami, "togami", "十神白夜"],
      [tomori, "tomori", "高松灯"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [celestia.seatId, togami.seatId, tomori.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: celestia.seatId,
      message: "2号，你问我判断有没有变。这枚筹码不轻，我先押在这里：你今天的票口打算押哪边？",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: togami.seatId,
      message:
        "6号，你的反问押得很响，但筹码底下是空的。8号还没发言，我不提前压他；6号，你现在的状态就是今天需要公开补链的位置。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [tomori.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, tomori.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "七号刚才点我，说我不够格，因为六号还没给出判断，而我还没发言。可你给六号定达标线的时候，声音很急。",
        "guided",
      ),
    ).toContain("误读前置位对未发言座位的保留态度");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "七号刚才没有提前压我，他压的是6号那句空筹码。可他定达标线的时候声音很急，我想确认他是在审6号，还是在替自己找焦点。",
        "guided",
      ),
    ).not.toContain("误读前置位对未发言座位的保留态度");
  });

  it("allows critiquing a current target for asking an already-spoken seat to explain", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 611, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const celestia = state.seats[5]!;
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [kirigiri, "kirigiri", "雾切响子"],
      [celestia, "celestia", "塞蕾丝缇雅"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId, celestia.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚验了3号腐川冬子，她是好人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "苗木诚，你这个时机需要解释。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [celestia.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, celestia.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切响子，你把苗木诚的时机问题提出来，却没有说这和昨天票型怎么接。如果你只是想让苗木诚解释时机，那后面那段票型重述，是多余铺垫，还是你在替某个人降低解释成本？",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你这个预言家身份现在必须补完时机和昨天那1票，不然这张牌不够格。",
        "guided",
      ),
    ).toContain("要求已发言的1号后续补充发言");
  });

  it("allows waiting for external counterclaims after naming an already-spoken claimant", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.night.witchSavedSeatId = 4;
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "平安夜，女巫用药了。我首置位信息少，先留一个观察点。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是女巫，昨晚救的4号，4号是银水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号跳了女巫说救了4号，这个身份声明我先认，后面有没有对跳再说。我主要想聊1号，他首置位留观察点但没有给判断。",
        "guided",
      ),
    ).not.toContain("要求已发言的2号后续补充发言");
  });

  it("allows a black-check follower to challenge the unspoken checked target while judging the claimant", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 612, humanSeatId: null });
    const naegi = state.seats[0]!;
    const fukawa = state.seats[2]!;
    const enoshima = state.seats[4]!;
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [fukawa, "fukawa", "腐川冬子"],
      [enoshima, "enoshima", "江之岛盾子"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, fukawa.seatId, enoshima.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚查验5号江之岛盾子，查杀。今天票先压5号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [fukawa.seatId, enoshima.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, fukawa.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你这次倒是说得干脆，不像上一轮那样绕着定义打转了。可我得先听江之岛盾子自己怎么说；5号上一轮票口压在苗木诚身上，现在苗木诚亮预言家查杀她，5号必须正面接这个结果。苗木诚这张牌从第一天被质疑，到今天直接跳预言家查杀5号，这个转变够硬，谁急着替5号解围，我先怀疑谁。",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚……你这次倒是说得干脆，不像上一轮那样绕着定义打转了。可我得先听江之岛盾子自己怎么说——你苗木诚首置位报查杀，我没法替你松这个口，但我也不会现在就反压你。你敢在第二天直接拍身份，这份压力你自己得扛到底。倒是5号，上一轮你票口压在苗木诚身上，理由是定义漏洞还没解释清楚。现在苗木诚直接亮了预言家身份来查杀你，你打算怎么接？",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
  });

  it("allows judging a checked target response while naming the already-spoken claimant", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 613, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const anon = state.seats[8]!;
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [monokuma, "monokuma", "黑白熊"],
      [anon, "anon", "千早爱音"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, monokuma.seatId, anon.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚查验4号黑白熊，查杀。今天票先压4号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: monokuma.seatId,
      message: "噗，苗木诚查杀我？我不认。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [anon.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, anon.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "黑白熊刚才那段回应我听完了。你抓苗木诚节奏太顺，还问他有没有盘过别的可能性；苗木诚报你查杀，你的回应全在质疑报查杀的人，却没正面落过一句我为什么不是狼。苗木诚报了查杀，没有人对跳，查杀位自己也没有给出能让我改票的理由。",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
  });

  it("allows saying a front speaker has not had a chance to answer later challenges", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 614, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const anon = state.seats[8]!;
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [monokuma, "monokuma", "黑白熊"],
      [anon, "anon", "千早爱音"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, monokuma.seatId, anon.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚查验5号江之岛盾子，查杀。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: monokuma.seatId,
      message: "苗木诚这个预言家身份太顺了。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [anon.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, anon.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚后置位现在持续被追问身份和投票处理，他还没机会回应；但5号作为被查杀的人，自己的站边也不能只停在情绪上。",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
  });

  it("does not treat reviewing a claimant's target choice as an unspoken target read", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 615, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [monokuma, "monokuma", "黑白熊"],
      [enoshima, "enoshima", "江之岛盾子"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, monokuma.seatId, enoshima.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚查验5号江之岛盾子，查杀。今天票先压5号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [monokuma.seatId, enoshima.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, monokuma.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你验5号的逻辑是什么？你说第一天信息薄，那你验人顺序的理由呢？别光喊查杀就想定调。",
        "guided",
      ),
    ).not.toContain("把本轮未发言的5号当成已发言评价");
  });

  it("normalizes class-trial semicolon-heavy speech to the sentence-like limit", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "semicolon-heavy",
      render: async () => ({
        text:
          '{"speech":"哎呀，这就有趣了；苗木诚这张查杀来得太准。昨天他先定义平安夜。今天雾切一死他就甩查杀。腐川接得太顺。黑白熊在旁边鼓掌。我的结论是先看谁借这刀推票。"}',
        providerId: "semicolon-heavy",
      }),
    });
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "江之岛盾子";
    speaker.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.validationErrors).toBeUndefined();
    expect(result.speech).toBe(
      "哎呀，这就有趣了；苗木诚这张查杀来得太准。昨天他先定义平安夜。今天雾切一死他就甩查杀。腐川接得太顺。黑白熊在旁边鼓掌。",
    );
  });

  it("compacts overlong ordinary class-trial LLM speech before falling back", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "overlong-class-trial",
      render: async () => ({
        text: JSON.stringify({
          speech:
            "哎呀，这就有趣了。雾切响子第一个发言就急着把女巫用药摆上桌，黑白熊点她“生怕别人不知道”，这个反应我先记下。不过我今天更想盯一个人——十神白夜。你昨天最后一个发言，对着苗木诚喊“这不够格”，姿态倒是摆得很漂亮。可你自己呢？你说苗木诚躲在“等等看”的壳子里，那你昨天押在哪里？我回去翻了一下，你整段话都在定义别人没做到什么，你自己到底留了什么可以被全桌验证的点？苗木诚临走说“回头对照今天发言和票型”，现在3号死了，你昨天那么用力地推他上台，今天你的站边有没有变化？还是说，你打算继续躲在定义别人不够格的壳子里？",
        }),
        providerId: "overlong-class-trial",
      }),
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const enoshima = state.seats[4]!;
    const togami = state.seats[6]!;
    enoshima.name = "江之岛盾子";
    togami.name = "十神白夜";
    enoshima.role = "WEREWOLF";
    togami.role = "HUNTER";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId, togami.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, enoshima.seatId);
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "pressure",
      target: { seatId: togami.seatId, name: togami.name },
      targetSpeechStatus: "unspoken",
      allowedInteraction: "ask_future",
      speechMove: "ask_unspoken_target",
    };

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.validationErrors).toBeUndefined();
    expect(countSpeechSentences(result.speech)).toBeLessThanOrEqual(3);
    expect(result.speech.length).toBeLessThanOrEqual(360);
    expect(result.speech).toContain("十神白夜");
  });

  it("does not make Day 2+ class-trial fallback speeches reopen with a display-name beat", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    speaker.name = "雾切响子";
    speaker.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/^雾切响子[。！？，,]/);
    expect(result.speech).not.toContain("我是雾切响子");
    expect(result.speech).toMatch(/票下拉出来|桌面验证/);
    expect(result.speech).not.toMatch(/身份动作|公开边界|没有闭合|没闭合/);
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

  it("retries when class-trial speech invents a named seer counterclaim", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 603, humanSeatId: null });
    const naegi = state.seats[0]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    naegi.name = "苗木诚";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    enoshima.name = "江之岛盾子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    monokuma.role = "WITCH";
    enoshima.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId];
    state.speechIndex = 0;
    state.seerChecks = [{ day: 1, seerSeatId: naegi.seatId, targetSeatId: fukawa.seatId, result: "WEREWOLF" }];
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: `${naegi.seatId}号发言。我跳预言家，${fukawa.seatId}号是查杀。今天我的票先压${fukawa.seatId}号。`,
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: fukawa.seatId,
      message: `${fukawa.seatId}号发言。我不认${naegi.seatId}号查杀，他一句话把我按死，我先咬住这里。`,
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: monokuma.seatId,
      message: `${monokuma.seatId}号发言。腐川冬子没有反驳查杀本身，只绕去质疑苗木诚的起跳。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚和黑白熊都对跳了预言家，这个结构本身很刺激。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining([`把未公开身份的${monokuma.seatId}号说成预言家声明者`]));

    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({
            speech: `苗木诚首置位跳预言家，报${fukawa.seatId}号查杀，${monokuma.seatId}号黑白熊紧跟着也跳预言家。这个结构很有趣，我来拆一下。`,
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: `江之岛盾子。苗木诚报${fukawa.seatId}号查杀，黑白熊只是旁观点评，不是身份动作。把旁观点评偷换成对跳的人在制造混乱，这个伪装最有收益。`,
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(attempt).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain(`把未公开身份的${monokuma.seatId}号说成预言家声明者`);
    expect(retryInput!.stability!.repairInstructions!.join("\n")).toContain("没有公开身份声明的位置不要说跳、对跳、跟跳、明牌");
    expect(result.speech).not.toContain("黑白熊紧跟着也跳预言家");
    expect(result.speech).toContain("点评");
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

  it("does not use persona fallback providers when speech fallbacks are disabled", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "0";
    process.env.AI_LLM_SPEECH_FALLBACK_PERSONAS = "off";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.5";

    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
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
    expect(requestedModels).toEqual(["deepseek-v4-flash"]);
    expect(result.isFallback).toBe(true);
    expect(result.provider).toBe("model-routed-speech");
  });

  it("keeps class-trial speech repair attempts on Mimo instead of persona fallbacks", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_SPEECH_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_MIMO = "mimo-v2.5";
    process.env.AI_MODEL_GPT = "gpt-5.5";

    let requestCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      const requestBody = JSON.parse(String(init?.body)) as { model: string };
      if (requestBody.model !== "mimo-v2.5") {
        throw new Error(`unexpected model ${requestBody.model}`);
      }
      requestCount += 1;
      if (requestCount === 1) {
        throw new TypeError("fetch failed");
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: "雾切响子。可验证部分只有平安夜，空白部分是没有共同核对点；今天先不要把票打散。",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    setTestPersona(speaker, "Mimo", "mimo-logic-checker", 0.45);
    speaker.name = "雾切响子";
    speaker.roleCard = {
      id: "kirigiri",
      displayName: "雾切响子",
      theme: "class-trial",
      styleTags: ["calm", "deductive"],
      speechStyleZh: "冷静、简短、抓证据。",
      reasoningBias: "优先审查证据链和发言矛盾。",
      voteBias: "更愿意投公开证据闭合的位置。",
      nightActionBias: "夜晚行动谨慎，优先高信息收益。",
      asVillager: "作为好人时保持事实边界。",
      asWerewolf: "作为狼人时用冷静逻辑伪装。",
      pressureResponse: "被怀疑时要求对方给出证据链。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短角色感，不复刻大段原台词。",
      forbidden: ["不能泄露隐藏身份。"],
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    const result = await routedModelSpeechProvider.generateSpeech(view, createSpeechPlan(view));

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["mimo-v2.5", "mimo-v2.5"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("mimo-speech:mimo-v2.5");
    expect(result.speech).toContain("今天先不要把票打散");
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

  it("includes local character role-card guidance in real LLM speech input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const monokuma = state.seats.find((seat) => seat.isAi)!;
    monokuma.name = "黑白熊";
    monokuma.roleCard = {
      id: "monokuma",
      displayName: "黑白熊",
      theme: "class-trial",
      styleTags: ["taunting", "chaotic"],
      speechStyleZh: "强烈嘲讽、挑拨，但仍像狼人杀玩家。",
      reasoningBias: "放大矛盾，逼迫他人站边。",
      voteBias: "推动高互动票口。",
      nightActionBias: "夜晚偏激进但不送局。",
      asVillager: "作为好人时用公开证据施压。",
      asWerewolf: "作为狼人时只用公开理由伪装。",
      pressureResponse: "被怀疑时反咬对方逻辑漏洞。",
      relationshipHints: ["不能以主持人身份说话。"],
      catchphrasePolicy: "允许极短口癖，不复刻大段原台词。",
      forbidden: ["不能泄露隐藏身份。", "不能以主持人身份干预规则。"],
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [monokuma.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, monokuma.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");

    expect(input.characterRole?.displayName).toBe("黑白熊");
    const styleGuide = input.playerSpeechGuide.tablePlayerStyle.join("\n");
    const avoidGuide = input.playerSpeechGuide.avoid.join("\n");
    expect(styleGuide).toContain("本地主题角色：黑白熊");
    expect(styleGuide).toContain("学级裁判主题局");
    expect(styleGuide).toContain("角色正在玩狼人杀");
    expect(styleGuide).toContain("嘲讽");
    expect(styleGuide).toContain("不以主持人身份裁定规则");
    expect(styleGuide).not.toContain("强烈嘲讽、挑拨，但仍像狼人杀玩家");
    expect(styleGuide).not.toContain("本局阵营演法：作为好人时用公开证据施压。");
    expect(styleGuide).not.toContain("角色互动线索：不能以主持人身份说话。");
    expect(avoidGuide).toContain("不要复述系统任务");
    expect(avoidGuide).not.toContain("避免通用狼人杀模板句");
    expect(avoidGuide).not.toContain("不能以主持人身份干预规则");
  });

  it("allows low-information class-trial speech to use character texture without forced pressure", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const fukawa = state.seats.find((seat) => seat.seatId === 3)!;
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.speechQueue = [fukawa.seatId, 1, 2, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;

    const view = buildAgentView(state, fukawa.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(guideText).toContain("本地主题角色：腐川冬子");
    expect(guideText).toContain("低信息开局动作");
    expect(guideText).toContain("十神");
    expect(guideText).toContain("角色正在玩狼人杀");
    expect(guideText).not.toContain("信息很薄");
    expect(guideText).not.toContain("不必强行追问");
    expect(guideText).not.toContain("不能泄露私密身份");
    expect(guideText).not.toContain("必须追问");
    expect(guideText).not.toContain("必须转票");
  });

  it("adds class-trial behavior lens to speech input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const kirigiri = state.seats.find((seat) => seat.isAi)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, kirigiri.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(input.characterLens).toMatchObject({
      roleId: "kirigiri",
      displayName: "雾切响子",
    });
    expect(guideText).toContain("本地主题角色：雾切响子");
    expect(guideText).toContain("角色会优先注意");
    expect(guideText).toContain("角色施压方式");
    expect(guideText).toContain("过于顺滑");
    expect(guideText).toContain("急着让别人点头");
    expect(guideText).not.toContain("角色行为透镜：雾切响子");
    expect(guideText).not.toContain("狼人杀打法卡：雾切响子");
    expect(guideText).not.toContain("读牌优先级");
    expect(guideText).not.toContain("阵营打法");
    expect(guideText).not.toContain("投票理由");
  });

  it("preserves class-trial live state while stripping decision scripts", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const kirigiri = state.seats.find((seat) => seat.isAi)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = {
      ...roleCardFixture("kirigiri", "雾切响子"),
      classTrialVoiceProfile: {
        personalityCore: ["在保留中施压"],
        valueBiases: ["怀疑过于顺滑的结论"],
        reactionTendencies: ["被催促时先质疑催促者"],
        lightCatchphrases: ["先别替我下结论。"],
        overuseBans: ["不要反复说证据链"],
        scenarioReactions: {
          lowInfoOpening: {
            innerDrive: "不急着贡献完整结论，先观察谁在过早定义局面。",
            speechMove: "只提出一个很窄的疑问，留下判断余地。",
            mustAvoid: "不要开局就做全场逻辑总结。",
          },
        },
        alignmentReactions: {},
        acceptableForms: ["发言短，但能把压力钉到具体人或具体动作上"],
        unacceptableForms: ["像中立审计员总结全场"],
        dramaticBoundaries: {
          allowSharpConflict: true,
          allowIrrationalMisread: true,
          allowDeceptionWhenAligned: true,
          mustStayInTurnOrder: true,
          mustRemainWerewolfPlayable: true,
        },
      },
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, kirigiri.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(input.classTrialLiveState).toBeDefined();
    expect(input.speechPlan).toBeUndefined();
    expect(input.constraints).toBeUndefined();
    expect(guideText).toContain("本轮临场状态");
    expect(guideText).toContain("自己的发言轮");
    expect(guideText).toContain("角色感优先");
  });

  it("gives each class-trial role a distinct behavior lens instead of one werewolf template", () => {
    const classTrialRoles = [
      ["naegi", "苗木诚"],
      ["kirigiri", "雾切响子"],
      ["fukawa", "腐川冬子"],
      ["monokuma", "黑白熊"],
      ["enoshima", "江之岛盾子"],
      ["celestia", "塞蕾丝"],
      ["togami", "十神白夜"],
      ["tomori", "高松灯"],
      ["anon", "千早爱音"],
    ] as const;
    const sampleCadences = new Set<string>();
    const signatureMoves = new Set<string>();

    for (const [id, displayName] of classTrialRoles) {
      const state = createGame({ seed: 91, humanSeatId: null });
      const speaker = state.seats.find((seat) => seat.isAi)!;
      speaker.name = displayName;
      speaker.roleCard = roleCardFixture(id, displayName);
      state.phase = "DAY_SPEECH";
      state.speechQueue = [speaker.seatId];
      state.speechIndex = 0;

      const view = buildAgentView(state, speaker.seatId);
      const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
      const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

      expect(input.characterLens?.roleId).toBe(id);
      expect(input.characterLens?.displayName).toBe(displayName);
      expect(input.characterLens?.werewolfStrategy.voteLogic).toEqual([]);
      expect(guideText).toContain(`本地主题角色：${displayName}`);
      expect(guideText).toContain("角色正在玩狼人杀");
      expect(guideText).toContain("说话节奏");
      expect(guideText).not.toContain(`角色行为透镜：${displayName}`);
      expect(guideText).not.toContain("这些不是必选台词");
      expect(guideText).not.toContain("LLM 自由发挥");
      sampleCadences.add(input.characterLens!.sampleCadence);
      signatureMoves.add(input.characterLens!.signatureMoves.join(" / "));
    }

    expect(sampleCadences.size).toBeGreaterThanOrEqual(8);
    expect(signatureMoves.size).toBe(classTrialRoles.length);
  });

  it("adds dynamic class-trial director guidance when prior seats repeat the same abstract pressure", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 4)!;
    speaker.name = "黑白熊";
    speaker.roleCard = roleCardFixture("monokuma", "黑白熊");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。低信息首轮我先看大家逻辑能不能闭环。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号只说闭环，没有给出具体验证方向，这个点太泛。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。2号你也没给结论，只是说别人没有验证方向。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;

    const view = buildAgentView(state, 4);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：黑白熊");
    expect(guideText).toContain("角色施压方式");
    expect(guideText).toContain("嘲讽");
    expect(guideText).not.toContain("动态导演提示");
    expect(guideText).not.toContain("没给结论/验证方向");
    expect(guideText).not.toContain("不要再评价“没给结论”本身");
    expect(guideText).not.toContain("换一个镜头");
  });

  it("adds dynamic class-trial director guidance for repeated empty-stance and ticket-pressure loops", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 7)!;
    speaker.name = "十神白夜";
    speaker.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。我会看大家前后发言逻辑和站边是否一致。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号没有给出站边倾向或票口方向，这个观察框架太空。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我也觉得1号那个可验证观察点像空壳，没给票口。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。1号连半个票口方向都没给，这个空壳观察框架太安全。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7];
    state.speechIndex = 0;

    const view = buildAgentView(state, 7);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：十神白夜");
    expect(guideText).toContain("角色会优先注意");
    expect(guideText).toContain("标准");
    expect(guideText).not.toContain("动态导演提示");
    expect(guideText).not.toContain("没给表态/今天要压哪里");
    expect(guideText).not.toContain("不要继续评价表态或今天要压哪里空缺本身");
    expect(guideText).not.toContain("谁借这个空壳观察框架收票");
  });

  it("adds dynamic class-trial director guidance for repeated clean-template responsibility shifts", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 5)!;
    speaker.name = "江之岛盾子";
    speaker.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seats.find((seat) => seat.seatId === 4)!.name = "豆包-mimo-v25-pro-";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。我是平民，平安夜先认女巫用药。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号结构干净，但干净本身不代表身份。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。1号干净得像模板，把责任推给后置位补足。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。1号连试探都没有，等于把压力甩给后置位。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;

    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：江之岛盾子");
    expect(guideText).toContain("把小反应推上舞台");
    expect(guideText).not.toContain("动态导演提示");
    expect(guideText).not.toContain("干净模板/后置责任");
    expect(guideText).not.toContain("不要继续评价“太干净像模板”本身");
    expect(guideText).not.toContain("谁利用这份干净制造今天要压哪里");
  });

  it("adds role-specific live reaction guidance instead of another generic gap attack", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const enoshima = state.seats.find((seat) => seat.isAi && seat.seatId === 5)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号苗木先给框架，但没有往下推倾向。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号雾切指出1号这个缺口，但自己也没给结论。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号腐川继续说2号没把缺口往下推，也没有落方向。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;

    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：江之岛盾子");
    expect(guideText).toContain("把小反应推上舞台");
    expect(guideText).toContain("反应模式");
    expect(guideText).not.toContain("全场发言结构");
    expect(guideText).not.toContain("动态导演提示");
    expect(guideText).not.toContain("抽象压力空转");
    expect(guideText).not.toContain("角色性格化压力");
  });

  it("hardens the class-trial director note when everyone keeps attacking the same no-tendency gap", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 5)!;
    speaker.name = "江之岛盾子";
    speaker.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号苗木只留了共同验证点，没有给倾向。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号雾切说1号没给票口，这个缺口先挂着。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号腐川也觉得1号这个缺口没有被说圆。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;

    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：江之岛盾子");
    expect(guideText).toContain("把小反应推上舞台");
    expect(guideText).toContain("反应模式");
    expect(guideText).not.toContain("不能把这句作为主轴");
    expect(guideText).not.toContain("证词、声音、伪装、下注、合格线、关系链或反应差");
    expect(guideText).not.toContain("角色会注意到的选择");
  });

  it("steers repeated framework-slide criticism into role-specific benefit pressure", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 5)!;
    speaker.name = "江之岛盾子";
    speaker.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号苗木拿发言顺序当核对基准，但框架没有落地。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号雾切说1号把验证责任推给后面，自己也没放立场。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号腐川说2号也只是话滑过去，没把框架合上。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;

    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：江之岛盾子");
    expect(guideText).toContain("把小反应推上舞台");
    expect(guideText).toContain("反应模式");
    expect(guideText).not.toContain("框架滑移/话滑空转");
    expect(guideText).not.toContain("不要继续说框架空或谁滑了");
    expect(guideText).not.toContain("谁借这个框架拖延立场");
  });

  it("steers repeated peaceful-night vote-bait criticism away from one copied phrase", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 6)!;
    speaker.name = "塞蕾丝缇雅";
    speaker.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号苗木说谁借平安夜催票谁就解释动机。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号雾切继续看谁借平安夜催票，但没有补收益分析。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号腐川也说这条动机缺口还没补上。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6];
    state.speechIndex = 0;

    const view = buildAgentView(state, 6);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guideText).toContain("本地主题角色：塞蕾丝缇雅");
    expect(guideText).toContain("优雅下注");
    expect(guideText).toContain("筹码");
    expect(guideText).not.toContain("平安夜催票复读");
    expect(guideText).not.toContain("不要再复述谁借平安夜催票");
    expect(guideText).not.toContain("谁利用这个母题收取解释权");
  });

  it("guides public references to include names or short names", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 1)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const ordinaryInput = buildConstrainedSpeechInput(buildAgentView(state, speaker.seatId), createSpeechPlan(buildAgentView(state, speaker.seatId)), "guided");
    const ordinaryGuide = [...ordinaryInput.playerSpeechGuide.tablePlayerStyle, ...ordinaryInput.playerSpeechGuide.avoid].join("\n");
    expect(ordinaryGuide).toContain("称呼别人尽量带名字");
    expect(ordinaryGuide).toContain("2号Claude");

    const kirigiri = state.seats.find((seat) => seat.isAi && seat.seatId === 2)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    const classTrialInput = buildConstrainedSpeechInput(buildAgentView(state, kirigiri.seatId), createSpeechPlan(buildAgentView(state, kirigiri.seatId)), "guided");
    const classTrialGuide = [...classTrialInput.playerSpeechGuide.tablePlayerStyle, ...classTrialInput.playerSpeechGuide.avoid].join("\n");

    expect(classTrialGuide).toContain("本地主题角色：雾切响子");
    expect(classTrialGuide).toContain("角色正在玩狼人杀");
    expect(classTrialGuide).not.toContain("2号雾切");
    expect(classTrialGuide).not.toContain("5号江之岛");
    expect(classTrialGuide).not.toContain("6号塞蕾丝");
    expect(classTrialGuide).not.toContain("9号爱音");
  });

  it("keeps class-trial dialogue guidance role-first instead of rewrite-script driven", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    const enoshima = state.seats.find((seat) => seat.isAi && seat.seatId === 5)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;

    const input = buildConstrainedSpeechInput(buildAgentView(state, enoshima.seatId), createSpeechPlan(buildAgentView(state, enoshima.seatId)), "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(guideText).toContain("本地主题角色：江之岛盾子");
    expect(guideText).toContain("角色正在玩狼人杀");
    expect(guideText).toContain("把小反应推上舞台");
    expect(guideText).not.toContain("台词化转译");
    expect(guideText).not.toContain("表态/今天要压哪里/接上/没接上的地方");
    expect(guideText).not.toContain("不要把所有角色都说成筹码");
    expect(guideText).not.toContain("不要把每个人都写成结构分析");
  });

  it("context-gates Fukawa Togami references outside low-info openings", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const fukawa = state.seats.find((seat) => seat.isAi && seat.seatId === 3)!;
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.speechQueue = [fukawa.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, fukawa.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "雾切，你这句话没有把证据接上，我先把这个断点放在这里。", "guided"),
    ).not.toContain("腐川发言缺少十神情绪坐标");
    expect(
      validateRenderedSpeech(view, plan, "雾切，你这句话别把十神大人也拖进空话里；证据没接上，我先盯这里。", "guided"),
    ).toContain("腐川十神关系缺少公开触发");
  });

  it("does not force Fukawa to mention Togami when replying to a black check without a public Togami trigger", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 603, humanSeatId: null });
    const naegi = state.seats[0]!;
    const fukawa = state.seats[2]!;
    const togami = state.seats[6]!;
    naegi.name = "苗木诚";
    fukawa.name = "腐川冬子";
    togami.name = "十神白夜";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    togami.role = "WITCH";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我跳预言家，3号腐川冬子是查杀；今天票口先压3号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我不认1号苗木诚这条查杀。他只报结论没交代为什么验我；今天你们要推我，先看他这个起跳有没有过程。",
        "guided",
      ),
    ).not.toContain("腐川发言缺少十神情绪坐标");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我不认1号苗木诚这条查杀。他只报结论没交代为什么验我；今天你们要推我，先看他这个起跳有没有过程。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首置位直接报我查杀，连犹豫都没有，像是早就准备好这段词了；我倒想问问，你昨晚验我，为什么偏偏是我。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我不认1号苗木诚这条查杀，十神大人别被他带走；苗木没交代为什么验我。",
        "guided",
      ),
    ).toContain("腐川十神关系缺少公开触发");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木同学，你查杀我？我不认。你一句话就想把我钉死，我先说我哪里不接。",
        "guided",
      ),
    ).not.toContain("被查杀发言必须回应查杀");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "十神大人还在听啊，真好。不、不是只因为十神大人在，苗木诚你的证词好像什么都没合上。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["腐川十神关系缺少公开触发", "被查杀发言必须回应查杀"]));
  });

  it("accepts Monokuma's natural class-trial counterclaim phrasing", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 613, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    naegi.name = "苗木诚";
    monokuma.name = "黑白熊";
    monokuma.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是预言家。昨晚我验了3号腐川冬子，她是好人，金水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 1, name: "苗木诚" };
    const plan = createSpeechPlan(view);
    const counterclaimPlan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_black_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 1, claimantSeatId: 4, targetSeatId: 1, result: "WEREWOLF" },
        isCounterclaim: true,
      },
    };

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，苗木诚，你第一个跳预言家，只顾着报结果。我这边，昨晚验了1号苗木诚。查杀。今天我的票先压1号苗木诚。谁要保查杀位，就公开和我的结果对撞。",
        "guided",
      ),
    ).not.toContain("计划预言家声明没有说清身份线");
    const naturalCounterclaimErrors = validateRenderedSpeech(
      view,
      counterclaimPlan,
      "噗，苗木诚，你这预言家当得可真有意思啊。首置位直接跳出来报查验，还顺便给3号把后路堵死了——“如果有人要打3号，我希望你说清楚”，这话听着像不像提前给人递盾牌？我是预言家，昨晚验了你，1号苗木诚。查杀。今天我的票就挂在你1号身上了。谁要保他，就站出来和我的查验结果对撞。",
      "guided",
    );
    expect(naturalCounterclaimErrors).not.toContain("要求已发言的3号后续补充发言");
    expect(naturalCounterclaimErrors).not.toContain("预言家查杀缺少今天如何处理查杀位");

    const latestFullGameCounterclaimErrors = validateRenderedSpeech(
      view,
      counterclaimPlan,
      "噗，有意思。1号跳预言家报3号金水，2号不去盘预言家面，反而追着问“你为什么第一天就跳”——这步棋，我怎么看怎么觉得不对劲。等一下，让我捋清楚：你雾切响子，面对一个首置位跳预言家报查验的人，你的关注点是“你为什么要亮身份”？不是验人结果本身，不是3号接了金水之后的反应，而是质疑他跳的时机？哈，这逻辑链断得也太明显了吧。预言家第一天跳，有什么好质疑的？不跳，难道等狼人把身份穿完再出来？你这问题本身就是在把好人往坑里带。然后3号腐川冬子接了你的梗，反过来追你——行，这倒是正常反应。但我想问的是，你雾切响子到现在为止，对1号这个“预言家”到底是信还是不信？你一句话都没落。追了时机，追了选择，就是不肯说你站不站边。这不叫谨慎，这叫留后路。我先把我的态度放桌上：我是预言家，昨晚查验结果是1号苗木诚查杀。今天我的票先压1号苗木诚。谁要保1号苗木诚，就公开和我的结果对撞。",
      "guided",
    );
    expect(latestFullGameCounterclaimErrors).not.toContain("计划预言家声明没有说清身份线");
    expect(latestFullGameCounterclaimErrors).not.toContain("没有覆盖计划中的查验结果");
    expect(latestFullGameCounterclaimErrors).not.toContain("speechContract要求报出1号查杀");
    expect(latestFullGameCounterclaimErrors).not.toContain("预言家查杀缺少今天如何处理查杀位");
  });

  it("keeps planned Monokuma counterclaim information when normalizing a long lead-in", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 613, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    naegi.name = "苗木诚";
    monokuma.name = "黑白熊";
    monokuma.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是预言家。昨晚我验了3号腐川冬子，她是好人，金水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 1, name: "苗木诚" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_black_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 1, claimantSeatId: 4, targetSeatId: 1, result: "WEREWOLF" },
        isCounterclaim: true,
      },
    };
    const rawSpeech =
      "噗，有意思。1号跳预言家报3号金水，2号不去盘预言家面，反而追着问“你为什么第一天就跳”——这步棋，我怎么看怎么觉得不对劲。等一下，让我捋清楚：你雾切响子，面对一个首置位跳预言家报查验的人，你的关注点是“你为什么要亮身份”？不是验人结果本身，不是3号接了金水之后的反应，而是质疑他跳的时机？哈，这逻辑链断得也太明显了吧。预言家第一天跳，有什么好质疑的？不跳，难道等狼人把身份穿完再出来？你这问题本身就是在把好人往坑里带。然后3号腐川冬子接了你的梗，反过来追你——行，这倒是正常反应。但我想问的是，你雾切响子到现在为止，对1号这个“预言家”到底是信还是不信？你一句话都没落。追了时机，追了选择，就是不肯说你站不站边。这不叫谨慎，这叫留后路。我先把我的态度放桌上：我是预言家，昨晚查验结果是1号苗木诚查杀。今天我的票先压1号苗木诚。谁要保1号苗木诚，就公开和我的结果对撞。";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "long-monokuma-counterclaim",
      render: async () => JSON.stringify({ speech: rawSpeech }),
      strictness: "guided",
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain("我是预言家");
    expect(result.speech).toContain("1号苗木诚查杀");
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("does not treat a denial that a spoken seat can补牌 as asking them for more speech", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 614, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    monokuma.name = "黑白熊";
    celestia.name = "塞蕾丝缇雅";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 4, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是预言家。昨晚我验了3号腐川冬子，她是好人，金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "我跳预言家，昨晚验出1号苗木诚查杀。今天票先压1号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号黑白熊这枚后置筹码已经落下，1号苗木诚本轮不能再补牌。现在跟注太快的人，解释成本反而更高。",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
  });

  it("lets a real seer report a new check without re-answering yesterday's dead counterclaim", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 615, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    monokuma.name = "黑白熊";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    monokuma.role = "WEREWOLF";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是预言家。昨晚我验了3号腐川冬子，她是好人，金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "我跳预言家，昨晚验出1号苗木诚查杀。今天票先压1号。",
    });
    state.phase = "NIGHT_SEER";
    state = applyCommand(state, { type: "seerCheck", actorSeatId: 1, targetSeatId: 6 });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 5, 6, 7, 8];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是预言家，昨晚查验结果是6号塞蕾丝缇雅查杀。我知道这句话很重，今天我的票先压住6号塞蕾丝缇雅这条查杀。谁要保查杀位，就公开和我的结果对撞。",
        "guided",
      ),
    ).not.toContain("被查杀发言必须回应查杀");
  });

  it("allows Fukawa to mention Togami after his public hunter shot", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 616, humanSeatId: null });
    const fukawa = state.seats[2]!;
    const celestia = state.seats[5]!;
    const togami = state.seats[6]!;
    fukawa.name = "腐川冬子";
    celestia.name = "塞蕾丝缇雅";
    togami.name = "十神白夜";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 7,
      message: "我拍猎人，枪在这里。6号塞蕾丝缇雅这条线不达标。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "十神白夜的枪口已经公开落在6号塞蕾丝缇雅这条线上，后面要接这个翻牌结果。",
    });
    state.day = 3;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "5号，你昨天说我们追问平安夜的顺序像是排练好的。苗木诚翻牌出局预言家，十神大人的枪口证实了他的查验线——你当时那句排练好的，现在怎么看？",
        "guided",
      ),
    ).not.toContain("腐川十神关系缺少公开触发");
  });

  it("keeps Fukawa fallback on the black-check response instead of forcing Togami", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const fukawa = state.seats[2]!;
    const togami = state.seats[6]!;
    naegi.name = "苗木诚";
    fukawa.name = "腐川冬子";
    togami.name = "十神白夜";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    togami.role = "WITCH";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我跳预言家，3号腐川冬子是查杀；今天票口先压3号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("我不认");
    expect(result.speech).toContain("我先说我哪里不接");
    expect(result.speech).not.toContain("十神");
    expect(result.speech).not.toMatch(/谁最(?:省力|轻松|受益)/);
    expect(result.validationErrors ?? []).not.toContain("腐川十神关系缺少公开触发");
  });

  it("keeps Celestia black-check response fallback in her wager voice", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我跳预言家，6号塞蕾丝缇雅是查杀；今天票口先压6号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("筹码");
    expect(result.speech).toContain("我不认");
    expect(result.speech).toContain("跟注");
    expect(result.speech).not.toContain("他一句话就想把我按死，我先说我哪里不接");
  });

  it("keeps Kirigiri fallback neutral on an unresponded public black check", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    kirigiri.role = "WITCH";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我跳预言家，6号塞蕾丝缇雅是查杀；今天票口先压6号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("查杀先放桌面");
    expect(result.speech).toContain("6号塞蕾丝缇雅");
    expect(result.speech).toContain("正面接");
    expect(result.speech).not.toMatch(/苗木诚这句话还没有把自己从票下拉出来|票压得太死|站不站得住|这一步我不跟/);
    expect(result.validationErrors ?? []).not.toContain("D1首跳查杀未对跳前不要反压预言家");
  });

  it("keeps non-checked Fukawa fallback on the public black-check relation instead of a self-intro audit line", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    kirigiri.role = "WITCH";
    fukawa.role = "VILLAGER";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我跳预言家，6号塞蕾丝缇雅是查杀；今天票口先压6号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "苗木诚的查杀先放桌面，6号塞蕾丝缇雅必须正面接。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("别笑");
    expect(result.speech).toContain("6号塞蕾丝缇雅");
    expect(result.speech).toContain("不是在保1号苗木诚");
    expect(result.speech).not.toMatch(/^腐川冬子。/);
    expect(result.speech).not.toContain("2号雾切响子真正露出来的是");
    expect(result.validationErrors ?? []).not.toContain("腐川十神关系缺少公开触发");
  });

  it("gives Monokuma a characterful black-check claim fallback", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const monokuma = state.seats[3]!;
    const naegi = state.seats[0]!;
    monokuma.name = "黑白熊";
    naegi.name = "苗木诚";
    monokuma.role = "WEREWOLF";
    naegi.role = "SEER";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 1, name: "苗木诚" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_black_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 1, claimantSeatId: 4, targetSeatId: 1, result: "WEREWOLF" },
      },
    };
    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("噗");
    expect(result.speech).toContain("黑白");
    expect(result.speech).toContain("1号苗木诚查杀");
    expect(result.speech).not.toMatch(/^我跳预言家，昨晚查验结果是/);
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("rejects planned wolf seer counterclaims that omit the target check even in loose mode", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const monokuma = state.seats[3]!;
    const naegi = state.seats[0]!;
    monokuma.name = "黑白熊";
    naegi.name = "苗木诚";
    monokuma.role = "WEREWOLF";
    naegi.role = "SEER";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 1, name: "苗木诚" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_black_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 1, claimantSeatId: 4, targetSeatId: 1, result: "WEREWOLF" },
        isCounterclaim: true,
      },
    };

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，首置位跳预言家报查杀。你自己递出去的刀，自己没人接。这已经说明你的标准不够格。",
        "loose",
      ),
    ).toEqual(expect.arrayContaining(["计划预言家声明没有说清身份线", "没有覆盖计划中的查验结果", "speechContract要求报出1号查杀"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，黑白该分出来了。我跳预言家，昨晚验出1号苗木诚查杀。今天票先压这里；谁要保这个查杀位，就上来和我的结果对撞。",
        "loose",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，1号苗木诚，你跳得太早了。可惜，我才是预言家，昨晚验出1号苗木诚查杀。今天我的票先压1号，谁要保他就和我的结果对撞。",
        "loose",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，苗木诚，你倒是挑了个好时机跳出来。我昨晚验的是你，1号苗木诚，查杀。今天我的票先压1号，谁要保这个查杀位，就公开和我的结果对撞。",
        "loose",
      ),
    ).toEqual([]);
  });

  it("accepts planned wolf seer gold checks phrased as my gold water", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const monokuma = state.seats[3]!;
    const tomori = state.seats[7]!;
    monokuma.name = "黑白熊";
    tomori.name = "高松灯";
    monokuma.role = "WEREWOLF";
    tomori.role = "VILLAGER";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 8, name: "高松灯" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_gold_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 2, claimantSeatId: 4, targetSeatId: 8, result: "GOOD" },
      },
    };

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，2号雾切响子，你这手身份叠罗汉可真有意思。不过比起你这套，我更想盯一个细节：8号高松灯，她是我的金水。今天谁要是急着踩她或者反打她，那这反应本身就值得玩味。",
        "loose",
      ),
    ).toEqual([]);
  });

  it("keeps class-trial gold-check claim fallback on the planned good result", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const monokuma = state.seats[3]!;
    const tomori = state.seats[7]!;
    monokuma.name = "黑白熊";
    tomori.name = "高松灯";
    monokuma.role = "WEREWOLF";
    tomori.role = "VILLAGER";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 8, name: "高松灯" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_gold_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 2, claimantSeatId: 4, targetSeatId: 8, result: "GOOD" },
      },
    };
    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("8号高松灯");
    expect(result.speech).toContain("金水");
    expect(result.speech).not.toContain("8号高松灯查杀");
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("repairs planned wolf seer counterclaims with exact claim-check instructions", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const monokuma = state.seats[3]!;
    const naegi = state.seats[0]!;
    monokuma.name = "黑白熊";
    naegi.name = "苗木诚";
    monokuma.role = "WEREWOLF";
    naegi.role = "SEER";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const target = { seatId: 1, name: "苗木诚" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target,
      speechMove: "claim_black_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 1, claimantSeatId: 4, targetSeatId: 1, result: "WEREWOLF" },
        isCounterclaim: true,
      },
    };
    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({
            speech: "噗，苗木诚首置位报查杀，但你把平安夜和女巫药说得太满了。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "噗，黑白该分出来了。我跳预言家，昨晚验出1号苗木诚查杀。今天票先压这里；谁要保这个查杀位，就上来和我的结果对撞。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(attempt).toBe(2);
    expect(result.isFallback).toBe(false);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";
    expect(repairText).toContain("第一句就跳预言家");
    expect(repairText).toContain("1号苗木诚是查杀");
    expect(repairText).toContain("今天票先压");
    expect(repairText).toContain("不要再点评别人来替代悍跳");
  });

  it("repairs D1 first-check motive attacks by banning even deferred motive wording", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    kirigiri.role = "WITCH";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: naegi.seatId, targetSeatId: celestia.seatId, result: "WEREWOLF" }];
    state.speechQueue = [naegi.seatId, kirigiri.seatId, celestia.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: `${naegi.seatId}号苗木诚发言。我跳预言家，昨晚验了${celestia.seatId}号塞蕾丝缇雅，她是狼人。今天她必须正面接这个结果。`,
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId, celestia.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);
    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({
            speech: "苗木诚，你报了查杀，但你的起跳为什么选塞蕾丝缇雅，这个裂口我先压住。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "苗木诚的查杀先放桌面，我不替他加戏，也不替6号塞蕾丝缇雅松绑。6号还没发言，轮到她时正面接。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(attempt).toBe(2);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";
    expect(repairText).toContain("连“先不追这个”也不要说");
    expect(repairText).toContain("只看查杀位回应、有没有对跳、谁救或改焦点");
  });

  it("puts D1 black-check follow-up bans into non-claim class-trial speech contracts", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    fukawa.name = "腐川冬子";
    naegi.role = "SEER";
    fukawa.role = "VILLAGER";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, fukawa.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚查验结果是6号塞蕾丝缇雅查杀。今天我的票先压6号，谁要保她就公开对撞。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [fukawa.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, fukawa.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const banText = input.speechContract.mustNotAsk.join("\n");

    expect(input.speechContract.move).not.toBe("claim_black_check");
    expect(banText).toContain("不要追问或攻击首验理由");
    expect(banText).toContain("平安夜和女巫用药只可短句带过");
  });

  it("does not ask an already-spoken target to answer a later counter-check fallback", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const tomori = state.seats[7]!;
    naegi.name = "苗木诚";
    monokuma.name = "黑白熊";
    tomori.name = "高松灯";
    naegi.role = "SEER";
    monokuma.role = "WEREWOLF";
    tomori.role = "VILLAGER";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 4, 8];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我跳预言家，6号塞蕾丝缇雅是查杀；今天票口先压6号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "噗，黑白该分出来了。我跳预言家，昨晚验出1号苗木诚查杀。今天票先压这里；谁要保这个查杀位，就上来和我的结果对撞。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [8];
    state.speechIndex = 0;
    const view = buildAgentView(state, 8);
    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("4号黑白熊");
    expect(result.speech).toContain("1号苗木诚");
    expect(result.speech).toContain("本轮已经接不上");
    expect(result.speech).not.toContain("6号塞蕾丝缇雅已经接过查杀");
    expect(result.validationErrors ?? []).not.toContain("要求已发言的1号后续补充发言");
  });

  it("lets Togami hunter identity fallback actually claim hunter", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const togami = state.seats[6]!;
    const monokuma = state.seats[3]!;
    togami.name = "十神白夜";
    monokuma.name = "黑白熊";
    togami.role = "HUNTER";
    monokuma.role = "WEREWOLF";
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7];
    state.speechIndex = 0;
    const view = buildAgentView(state, 7);
    const target = { seatId: 4, name: "黑白熊" };
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "rally",
      target,
      speechMove: "identity_claim",
      claimIntent: { claimedRole: "HUNTER", strength: "hard" },
      playMotive: {
        kind: "tempo_grab",
        line: "用猎人身份收住票型。",
        allowIdentityClaim: true,
      },
    };
    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("猎人");
    expect(result.speech).toContain("枪");
    expect(result.speech).toContain("标准");
    expect(result.validationErrors ?? []).not.toContain("猎人软声明没有保留底牌视角");
  });

  it("rejects class-trial speeches that are mostly werewolf template terminology", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats.find((seat) => seat.isAi && seat.seatId === 2)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先按公开信息盘，1号没给站边，也没给票口，证据链闭环有缺口，后置位再看。",
        "guided",
      ),
    ).toContain("学级裁判术语过多");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木这段证词合不上；他把问题递给全场，却没有说明自己为什么急着收住话头。",
        "guided",
      ),
    ).not.toContain("学级裁判术语过多");
  });

  it("rejects bundled class-trial jargon that should be rewritten as character dialogue", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats.find((seat) => seat.isAi && seat.seatId === 2)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切这段检验线停在证据链不闭合，黑白熊还在二选一站边，8号也只问站边和票口。",
        "guided",
      ),
    ).toContain("学级裁判术语过多");
    expect(
      validateRenderedSpeech(view, plan, "平安夜只是背景，我要抓的是谁的证词还没闭合。", "guided"),
    ).toContain("学级裁判术语过多");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切这段证词没接上；黑白熊逼人二选一，但没有说明哪一句话真的露出伪装。",
        "guided",
      ),
    ).not.toContain("学级裁判术语过多");
  });

  it("rejects class-trial check-line references before any public seer claim", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const togami = state.seats[6]!;
    togami.name = "十神白夜";
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.speechQueue = [togami.seatId];
    state.speechIndex = 0;
    let view = buildAgentView(state, togami.seatId);
    let plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "好，我知道你手里还攥着一条验人线没摊开。", "guided"),
    ).toContain("查验线缺少公开身份依据");

    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "我跳预言家，昨晚验了1号，金水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [togami.seatId];
    state.speechIndex = 0;
    view = buildAgentView(state, togami.seatId);
    plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "2号雾切响子的验人线先接着看，我只审她前后证词有没有对上。", "guided"),
    ).not.toContain("查验线缺少公开身份依据");
  });

  it("rejects attributing role claims to seats that never publicly claimed them", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const celestia = state.seats[5]!;
    celestia.name = "塞蕾丝缇雅";
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.speechQueue = [celestia.seatId];
    state.speechIndex = 0;
    let view = buildAgentView(state, celestia.seatId);
    let plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "4号和5号也先后自称猎人，现在桌面上站着三张猎人。", "guided"),
    ).toContain("把未公开身份的4号说成猎人声明者");

    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "我拍猎人，今天先防止票乱散。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [celestia.seatId];
    state.speechIndex = 0;
    view = buildAgentView(state, celestia.seatId);
    plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "2号雾切响子自称猎人，这个身份声明我先接着看。", "guided"),
    ).not.toContain("把未公开身份的2号说成猎人声明者");
  });

  it("keeps class-trial low-info openings on role actions without director scripts", () => {
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
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const setup = [
      [1, "naegi", "苗木诚"],
      [2, "kirigiri", "雾切响子"],
      [3, "fukawa", "腐川冬子"],
      [4, "monokuma", "黑白熊"],
      [5, "enoshima", "江之岛盾子"],
      [6, "celestia", "塞蕾丝缇雅"],
      [7, "togami", "十神白夜"],
      [8, "tomori", "高松灯"],
      [9, "anon", "千早爱音"],
    ] as const;
    for (const [seatId, id, displayName] of setup) {
      const seat = state.seats[seatId - 1]!;
      seat.name = displayName;
      seat.roleCard = roleCardFixture(id, displayName);
    }

    const naegiView = buildAgentView(state, 1);
    const naegiInput = buildConstrainedSpeechInput(naegiView, createSpeechPlan(naegiView), "guided");
    const naegiGuide = [...naegiInput.playerSpeechGuide.tablePlayerStyle, ...naegiInput.playerSpeechGuide.avoid].join("\n");
    expect(naegiGuide).toContain("本地主题角色：苗木诚");
    expect(naegiGuide).toContain("希望型主持人");
    expect(naegiGuide).toContain("共同验证点");
    expect(naegiGuide).toContain("角色正在玩狼人杀");
    expect(naegiGuide).not.toContain("首日低信息开庭导演");
    expect(naegiGuide).not.toContain("不要写成“发言顺序、表态、投票选择一起校验”");

    const fukawaView = buildAgentView(state, 3);
    const fukawaInput = buildConstrainedSpeechInput(fukawaView, createSpeechPlan(fukawaView), "guided");
    const fukawaGuide = [...fukawaInput.playerSpeechGuide.tablePlayerStyle, ...fukawaInput.playerSpeechGuide.avoid].join("\n");
    expect(fukawaGuide).toContain("本地主题角色：腐川冬子");
    expect(fukawaGuide).toContain("十神大人");
    expect(fukawaGuide).not.toContain("不用等十神发言");
    expect(fukawaGuide).not.toContain("公开情绪");
  });

  it("rejects class-trial low-info openings that only announce generic audit frames", () => {
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
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "大家早，昨晚平安夜，女巫用药了。我会把今天的发言顺序、每个人的站边和票型放在一起校验，后置位谁跳身份、谁跟风或回避关键问题，我会先记下来。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "现在证据还少，但我想先定一个大家都能回头核对的点：谁把平安夜当成收票理由，谁只是承认不确定。这个点先放在裁判台上。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial first speakers that only greet and restate peace night", () => {
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
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "好的，雾切、大家，早安。平安夜，女巫用药了，至少第一天没人倒牌，这是个好的起点。我是1号苗木诚。", "guided"),
    ).toContain("首置位发言缺少可验证钩子");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜是好的起点，但我想先定一个共同验证点：谁把这件事当成收票理由，谁只是承认不确定。",
        "guided",
      ),
    ).not.toContain("首置位发言缺少可验证钩子");
  });

  it("rejects low-info class-trial openings that keep room-greeting boilerplate", () => {
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
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "大家早上好。昨夜平安夜，女巫用药了，首日信息不多，我想先一起确认一个可以回头验证的点：谁今天的发言是先给结论、再补过程。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜让我们都还站在裁判台上；我先把希望放在一个能共同确认的地方：谁把这件事拿去急着收票，谁就要把动机说清楚。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial openings that treat speech order as a system puzzle", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我今天坐首置位，信息确实不多，但我想先抛一个能一起检验的点：这条发言顺序是随机排的，还是后排的人故意留到后面？后置位8个人，谁先主动接话谁先跳身份，就是可以回头核对的记录。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先把希望放在一个能共同确认的地方：谁接平安夜时急着把别人推上裁判台，谁就要把动机说清楚。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial openings that turn later seats into a process checklist", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 1;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "后置位整体我会按发言顺序校验：下一位3号腐川冬子，你接这句话时是补上依据，还是继续留空。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木这句话少的是可复查标准；我先只切这一层，等有人真的把怀疑落到行为上，再看标准能不能成立。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects first-seat low-info openers that assign the next speaker homework", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "虽然现在信息很少，但我希望大家把发言顺序当成核对基础。下一位，2号雾切，我想先听听你对平安夜的第一反应。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "下一位，2号雾切，先听你的。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "下一位2号雾切，我想听你对平安夜本身会怎么定位。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜还没把答案交出来；我先把希望放在一个能共同确认的地方：谁急着把别人推上裁判台，谁就说明自己的动机。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects first-seat low-info openers that defer judgment until the full round finishes", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先提一个能回头核对的点：今天全桌的发言顺序和每个人的态度，等第一轮发言走完可以拉一条线来验证。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "这个前后顺序，等第一轮走完后我们能一起查。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "等所有人发完言后，看看谁在平安夜这个结果上带节奏。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "等到所有人发言结束之后，我们回头看看谁主动给出了怀疑方向。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "后面的人发言时，我会留意谁愿意把证词说清楚。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "后置位的各位，等你们发言时，我希望能看到明确的判断理由。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜还没把答案交出来；谁把不确定说成确定，谁就把依据说清楚。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial lines that wait for later seats before judging", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 1;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先轻记这个门槛，等后置位谁先在这里定人或推票，我再回头看这条动机链能不能合上。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木把门槛设在尚未发生的动作上；我现在只切这一点，不把判断推给别人替我完成。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial lines that wait for later-seat opinions as the main action", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先不多说，等听完雾切和后面几位的想法，我们再一起对照。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先把希望放在一条能共同确认的线上：谁把不确定说成确定，谁就把依据说清楚。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial variants that wait for all later seats to finish", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "第一天信息确实很少，我会先听着，等后置位都说完再对照每个人的逻辑。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "后置位我会跟听，今晚之前所有人的发言顺序和票型我会一起验证。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "平安夜还没把答案交出来；谁把不确定说成确定，谁就把依据说清楚。", "guided"),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects first-seat low-info openers that outsource suspicion targets to later seats", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先放一个全桌能回头看的点：后置位谁会在没有前置压力的情况下，主动提出一个明确的怀疑对象或出人方向。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜还没把答案交出来；我先把希望放在一个能共同确认的地方：谁把不确定说成确定，谁就把依据说清楚。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects first-seat low-info openers that wait for future claims as the main content", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "后面如果有人直接给出明确的身份声明或查验结论，我们就能拿那个人的前后发言对照着看。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "第一轮发言的态度和用词，我会记下来作为后续校验的起点。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜还没把答案交出来；我先把希望放在一个能共同确认的地方：谁把不确定说成确定，谁就把依据说清楚。",
        "guided",
      ),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial speakers who defer their own judgment to future identity claims", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 1;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "我先记下这个开口点的硬度，等后面身份声明出来再对照。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "我会先压1号苗木诚，等后面有人拍身份出来再调整。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "雾切原话是“等身份声明出来再对照”，我现在就审这句为什么把判断推迟了。", "guided"),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial lines that turn speech order into the pressure point", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "我想先从发言顺序上留一个共同验证点。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "我会把发言顺序和前后逻辑串起来看。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "平安夜还没把答案交出来；谁把不确定说成确定，谁就把依据说清楚。", "guided"),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial lines that park judgment on the whole later block", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const fukawa = state.seats[2]!;
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 2;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "后置位整体先听一轮，4号黑白熊如果也滑过去，今天这条链就全是空转。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "雾切响子把问题推回苗木诚，却没把自己的落点交出来；别把这种空白也拖到十神大人面前。", "guided"),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects class-trial low-info speech that names the opener as a low-floor start", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 1;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "苗木这个低保开局没有给我能复查的证据，只是把压力放给后面的人。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "苗木把证据留得太薄；我先切这一点，不替他把空白补成结论。", "guided"),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects low-info class-trial lines that turn the next seat into a dramatic assignment", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const fukawa = state.seats[2]!;
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 2;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "下一位黑白熊，你听好了：苗木和雾切都在绕圈，轮到你先告诉我这条空话里谁最受益。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "下一位5号江之岛盾子，轮到你时替我盯住：苗木这个框到底想收谁的跟风。",
        "guided",
      ),
    ).toContain("学级裁判低信息开局过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "苗木和雾切都把话说得太轻，别把这种空白也拖到十神大人面前碍眼。", "guided"),
    ).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("keeps Celestia's chip metaphor from spreading to every class-trial role", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 1;
    const kirigiriView = buildAgentView(state, 2);
    const kirigiriPlan = createSpeechPlan(kirigiriView);

    expect(
      validateRenderedSpeech(kirigiriView, kirigiriPlan, "苗木没有放任何筹码，我先把这个缺口记下。", "guided"),
    ).toContain("非塞蕾丝发言滥用筹码口吻");
    expect(
      validateRenderedSpeech(kirigiriView, kirigiriPlan, "苗木这句话少了可复查标准，我先把这个断点记下。", "guided"),
    ).not.toContain("非塞蕾丝发言滥用筹码口吻");

    const celestia = state.seats[5]!;
    celestia.name = "塞蕾丝缇雅";
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    const celestiaView = buildAgentView(state, 6);
    const celestiaPlan = createSpeechPlan(celestiaView);

    expect(
      validateRenderedSpeech(celestiaView, celestiaPlan, "这枚筹码我先压在苗木身上，看他怎么拆。", "guided"),
    ).not.toContain("非塞蕾丝发言滥用筹码口吻");
    expect(
      validateRenderedSpeech(
        celestiaView,
        celestiaPlan,
        "苗木诚这枚筹码押得太早，后置位还没发言之前，这桌赔率还没结算。",
        "guided",
      ),
    ).not.toContain("学级裁判术语过多");
  });

  it("requires Fukawa low-info openings to show Togami-oriented public emotion", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const fukawa = state.seats[2]!;
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 2;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切响子，你紧接着就咬苗木只给了已知信息，自己却也没给出任何方向，只是把他扔进观察位。",
        "guided",
      ),
    ).toContain("腐川低信息开局缺少十神情绪坐标");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "十神大人还没开口，我就已经受不了你们把空话堆到他面前；雾切，你把苗木挂起来，却没有承担结论。",
        "guided",
      ),
    ).not.toContain("腐川低信息开局缺少十神情绪坐标");
  });

  it("keeps low-info class-trial guards active when an opener only mentions future voting review", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "平安夜是公开信息，我先留共同验证点：发言顺序和给出的理由，能否在投票时形成闭环。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "可验证部分只有平安夜，空白部分是还没有共同核对点。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切，你刚才问苗木更关注哪类异常，自己却没落一个可验证倾向。",
        "guided",
      ),
    ).toContain("腐川低信息开局缺少十神情绪坐标");
  });

  it("requires Enoshima low-info openings to lead with analyst structure instead of empty spectacle", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const enoshima = state.seats[4]!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 4;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "前面几位绕着安全发言来回打转，等于四个人轮流把同一个空罐子传了一圈。", "guided"),
    ).toContain("江之岛低信息开局缺少分析师结构");
    expect(
      validateRenderedSpeech(view, plan, "苗木这条空转链上谁最受益，我先把这个裂口记下。", "guided"),
    ).toContain("江之岛低信息开局缺少分析师结构");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "结构分析先摆出来：这条空转链里最有收益的位置，是那个把安全发言变成跟压工具的人。",
        "guided",
      ),
    ).not.toContain("江之岛低信息开局缺少分析师结构");
  });

  it("keeps Enoshima analyst guard active after negative no-ticket wording", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    const enoshima = state.seats[4]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.speechQueue = [1, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "目前还没有任何人给出站边或票口，我先只看谁把平安夜拿去做文章。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "啊……绝望的开场。苗木把自己从路标下摘出去了。", "guided")).toContain(
      "江之岛低信息开局缺少分析师结构",
    );
    expect(validateRenderedSpeech(view, plan, "结构先摆出来：谁借平安夜空白获利，谁的反应模式最像伪装。", "guided")).not.toContain(
      "江之岛低信息开局缺少分析师结构",
    );
  });

  it("rejects generic class-trial waiting for all later seats to finish", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号苗木诚只说平安夜。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "我倾向先把苗木放进观察位，等后置位所有人过完一轮，再回看他有没有接应或跟压。", "guided"),
    ).toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "苗木这句只有平安夜事实，可验证部分到此为止；空白部分是他没有留下共同核对点。", "guided"),
    ).not.toContain("学级裁判发言过于模板化");
  });

  it("rejects host-like class-trial summaries that only praise earlier questions", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const setup = [
      [1, "naegi", "苗木诚"],
      [2, "kirigiri", "雾切响子"],
      [3, "fukawa", "腐川冬子"],
      [4, "monokuma", "黑白熊"],
      [5, "enoshima", "江之岛盾子"],
      [6, "celestia", "塞蕾丝缇雅"],
    ] as const;
    for (const [seatId, id, displayName] of setup) {
      const seat = state.seats[seatId - 1]!;
      seat.name = displayName;
      seat.roleCard = roleCardFixture(id, displayName);
    }
    state.speechQueue = [1, 2, 3, 4, 5, 6];
    state.speechIndex = 0;
    for (const [seatId, , displayName] of setup.slice(0, 5)) {
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seatId,
        message: `${displayName}围绕苗木诚查杀腐川冬子的发言做了一个公开判断。`,
      });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "好的，各位。前面几位已经把这盘棋的布局摆得很清楚了。苗木诚同学首置位跳预言家，干净利落地把查杀钉在3号腐川冬子身上。而2号雾切响子，你给出了一个非常谨慎的表态。接着江之岛盾子同学，你敏锐地抓住了这一点，问雾切响子她的结论到底是什么。这确实是个好问题。",
        "guided",
      ),
    ).toContain("学级裁判发言过于模板化");
  });

  it("rejects final class-trial speakers who keep waiting for later seats", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const setup = [
      [1, "naegi", "苗木诚"],
      [2, "kirigiri", "雾切响子"],
      [3, "fukawa", "腐川冬子"],
      [4, "monokuma", "黑白熊"],
      [5, "enoshima", "江之岛盾子"],
      [6, "celestia", "塞蕾丝缇雅"],
      [7, "togami", "十神白夜"],
      [8, "tomori", "高松灯"],
      [9, "anon", "千早爱音"],
    ] as const;
    for (const [seatId, id, displayName] of setup) {
      const seat = state.seats[seatId - 1]!;
      seat.name = displayName;
      seat.roleCard = roleCardFixture(id, displayName);
    }
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    for (const [seatId, , displayName] of setup.slice(0, 8)) {
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seatId,
        message: `${seatId}号${displayName}先留一个公开点。`,
      });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 9);
    const plan = createSpeechPlan(view);
    const guide = buildConstrainedSpeechInput(view, plan, "guided").playerSpeechGuide.tablePlayerStyle.join("\n");

    expect(guide).toContain("本地主题角色：千早爱音");
    expect(guide).not.toContain("今天最后一个发言位");
    expect(
      validateRenderedSpeech(view, plan, "6号塞蕾丝这个声明可以等后置位核对，我先不卡你跳的时机。", "guided"),
    ).toContain("最后位不能等待后置位");
    expect(
      validateRenderedSpeech(view, plan, "6号塞蕾丝这个声明已经到我这里收束，我不等后置，只看她跳身份前后有没有解释成本。", "guided"),
    ).not.toContain("最后位不能等待后置位");
  });

  it("keeps the class-trial lens as prompt guidance while baseline style checks catch templates", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const tomori = state.seats.find((seat) => seat.isAi)!;
    tomori.name = "高松灯";
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [tomori.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, tomori.seatId);
    const plan = createSpeechPlan(view);

    const genericErrors = validateRenderedSpeech(view, plan, "我先按公开信息盘，票口先放这里，这个疑点未解除。", "guided");
    const broadAnchorErrors = validateRenderedSpeech(view, plan, "我先按公开信息盘，票口先放这里，证据链还没闭合。", "guided");
    const flavorOnlyAnchorErrors = validateRenderedSpeech(view, plan, "我先按公开信息盘，票口先放这里，这个裂口还没收住。", "guided");

    expect(genericErrors).not.toContain("发言过于冗长或报告化");
    expect(genericErrors).toContain("学级裁判发言过于模板化");
    expect(broadAnchorErrors).toContain("学级裁判发言过于模板化");
    expect(flavorOnlyAnchorErrors).toContain("学级裁判发言过于模板化");
    expect(genericErrors).not.toContain("学级裁判发言缺少角色行为透镜");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "6号这段让我停了一下，理由没接上前面的票型；我想先确认这个声音是不是在躲。",
        "guided",
      ),
    ).not.toContain("学级裁判发言缺少角色行为透镜");
  });

  it("keeps concrete class-trial audit pressure lenient while still blocking non-speech placeholders", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const enoshima = state.seats.find((seat) => seat.isAi)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "1号那段没有给出站边倾向、没有票口、没有对任何人的态度，我先挂这个缺口。", "guided"),
    ).not.toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜没人倒牌，这个结果本身没给太多信息。我回看1号发言，内容很短，几乎没有给出任何立场、理由或可验证的逻辑链。",
        "guided",
      ),
    ).not.toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "1号急着把昨晚死讯翻篇，这个反应差太刺眼；我先把这个裂口放大。", "guided"),
    ).not.toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "1号这段像把证词藏进了????????里，我先压这个裂口。", "guided"),
    ).toContain("发言包含异常问号占位");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号给的是一个干干净净的空壳，没有站边，也没有为什么投给谁的理由。",
        "guided",
      ),
    ).not.toContain("学级裁判发言过于模板化");
  });

  it("rejects class-trial prompt terms leaking into character speech", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const naegi = state.seats.find((seat) => seat.isAi && seat.seatId === 1)!;
    const kirigiri = state.seats.find((seat) => seat.isAi && seat.seatId === 2)!;
    const fukawa = state.seats.find((seat) => seat.isAi && seat.seatId === 3)!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.name = "腐川冬子";
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "苗木诚。卡住我的是公开证据的闭合方式。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId, fukawa.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);
    const speech =
      "苗木诚，你前面说“卡住你的是公开证据的闭合方式”——但首夜平安夜，女巫用药了，没有任何查验或死亡信息，你在卡哪一段闭合？这个缺口本身更像是先画靶再射箭。后置位3号腐川冬子，我等你先给出一个具体的发言对比点，而不是复述第一天的通用观察。";

    expect(validateRenderedSpeech(view, plan, speech, "guided")).toEqual(
      expect.arrayContaining(["学级裁判发言包含提示词痕迹", "要求未发言的3号提供模板化材料"]),
    );
  });

  it("rejects class-trial audit-template chains that flatten quiet characters", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const monokuma = state.seats.find((seat) => seat.isAi && seat.seatId === 4)!;
    const tomori = state.seats.find((seat) => seat.isAi && seat.seatId === 8)!;
    const anon = state.seats.find((seat) => seat.isAi && seat.seatId === 9)!;
    monokuma.name = "黑白熊";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    tomori.name = "高松灯";
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    anon.name = "千早爱音";
    anon.roleCard = roleCardFixture("anon", "千早爱音");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: monokuma.seatId,
      message: "噗，平安夜这段最有趣的是谁想把死讯轻轻放过去。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [tomori.seatId, anon.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, tomori.seatId);
    const plan = createSpeechPlan(view);
    const speech =
      "4号黑白熊，你那句“平安夜哪来的闭合”——结合你前面三人的对话链，你也没有说明自己站在哪个方向。这个缺口先记下，我只等票型出来看你后续的站边能不能和今天的态度对上。9号千早爱音，后置位只留你一个位置了，我等你给出一个具体的发言对比点。";

    expect(validateRenderedSpeech(view, plan, speech, "guided")).toEqual(
      expect.arrayContaining(["学级裁判发言包含提示词痕迹", "要求未发言的9号提供模板化材料"]),
    );
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号黑白熊，结合前面三人的对话链，这个缺口先记下；等票型出来看你后续站边能不能和今天态度对上。",
        "guided",
      ),
    ).toContain("学级裁判发言包含提示词痕迹");
    expect(
      validateRenderedSpeech(view, plan, "4号那句把死讯说得太轻，我听着没接上；9号等你发言时，我只想听你有没有听到同一个停顿。", "guided"),
    ).not.toContain("学级裁判发言包含提示词痕迹");
  });

  it("lets class-trial character speeches breathe while blocking repeated table templates", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const naegi = state.seats.find((seat) => seat.isAi)!;
    naegi.name = "苗木诚";
    naegi.roleCard = {
      id: "naegi",
      displayName: "苗木诚",
      theme: "class-trial",
      styleTags: ["earnest", "bridge"],
      speechStyleZh: "真诚、先承认不确定，再抓一个能验证的希望点。",
      reasoningBias: "把矛盾拉回所有人都能核验的公开证据。",
      voteBias: "不轻易锁死，但需要给出可执行票口。",
      nightActionBias: "夜晚稳健行动。",
      asVillager: "作为好人时鼓励大家回到公开证据。",
      asWerewolf: "作为狼人时用诚恳语气降低敌意。",
      pressureResponse: "先承认疑点，再解释自己的判断过程。",
      relationshipHints: ["更愿意接住紧张气氛。"],
      catchphrasePolicy: "可以有希望感，但不要变成口号。",
      forbidden: [],
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, naegi.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(input.speechContract.maxSentences).toBeGreaterThan(3);
    expect(input.speechContract.maxChars).toBeGreaterThan(260);
    expect(guideText).toContain("苗木诚");
    expect(guideText).toContain("共同验证");
    expect(guideText).toContain("可查验条件");
    expect(guideText).toContain("角色正在玩狼人杀");
    expect(guideText).not.toContain("不要只说没信息");
    expect(guideText).not.toContain("禁止套用");
    expect(guideText).not.toContain("身份-信息-表态-今天要压哪里");
    expect(guideText).not.toContain("每轮先选一个角色动作");
    expect(guideText).not.toContain("我换一个角度");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "桌面已经很多人把压力给到3号了，但我不重复同一个票口；苗木诚先把这条压力拉回大家能共同验证的前后断点。",
        "guided",
      ),
    ).not.toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "桌面已经很多人把压力给到3号了，但我不重复同一个票口；苗木诚先把这条压力拉回大家能共同验证的前后断点。",
        "guided",
      ),
    ).not.toContain("发言过于冗长或报告化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先说一下身份，我是闭眼好人，目前信息不多，先听后置位发言。",
        "guided",
      ),
    ).toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "大家早。昨晚平安夜，女巫用药了，第一夜没出人命，至少在轮次上是平的。我坐在首置，没什么先入参照物。",
        "guided",
      ),
    ).toContain("首置位发言缺少可验证钩子");
  });

  it("keeps dramatic class-trial expression while still rejecting ordinary werewolf openers", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const enoshima = state.seats.find((seat) => seat.isAi)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，这个票口当然有理由。1号把身份线压成谜语，6号又把女巫牌摊到裁判席上，我偏要看谁最急着让这条裂口闭嘴。",
        "guided",
      ),
    ).not.toContain("学级裁判发言过于模板化");

    expect(
      validateRenderedSpeech(view, plan, "我先说一下身份，我是闭眼好人，目前信息不多，先听后置位发言。", "guided"),
    ).toContain("学级裁判发言过于模板化");
  });

  it("rejects class-trial fallback-flavored ordinary werewolf templates", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "我这轮按闭眼好人打，结论先留活口；平安夜只说女巫用药了。", "guided"),
    ).toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "我闭眼视角看，3号腐川冬子这条证词还没有合上。", "guided"),
    ).toContain("学级裁判发言过于模板化");
    expect(
      validateRenderedSpeech(view, plan, "我把能听到的点摆一下，发言顺序和票型我会一起看。", "guided"),
    ).toContain("学级裁判低信息开局过于模板化");
  });

  it("rejects leaked class-trial internal audit terminology", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    for (const speech of [
      "雾切响子。1号苗木诚的问题在身份动作和公开边界的连接没有闭合。",
      "腐川冬子。我不认这条查杀；他先把起跳收益和票口边界讲完整。",
      "苗木诚。我跳预言家，外置硬身份反证才能改变结构。",
      "雾切响子。从结构上看，这条线是闭合的，但不是唯一能接的线。",
      "雾切响子。苗木诚这条查杀只能等腐川回应和有没有对跳才能闭合。",
    ]) {
      expect(validateRenderedSpeech(view, plan, speech, "guided")).toEqual(
        expect.arrayContaining(["学级裁判发言包含内部术语"]),
      );
    }
  });

  it("repairs leaked class-trial audit terms in LLM speech before falling back", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "internal-term-repair-test",
      render: async () =>
        JSON.stringify({
          speech: "哎呀，十神白夜，你说雾切响子的校验没闭合，我倒觉得你自己也停在同一个地方。",
        }),
      strictness: "guided",
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const enoshima = state.seats[4]!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toContain("闭合");
    expect(result.speech).toContain("没接上");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).not.toContain("学级裁判发言包含内部术语");
  });

  it("keeps class-trial mock speech fallback away from ordinary werewolf phrasing", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const naegi = state.seats[0]!;
    naegi.name = "苗木诚";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).not.toMatch(/闭眼好人|发言顺序和票型/);
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).not.toContain("学级裁判发言过于模板化");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).not.toContain("学级裁判低信息开局过于模板化");
  });

  it("keeps ordinary first-seat mock speech from echoing table-task text or pressuring unspoken seats", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 131, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = state.seats.map((seat) => seat.seatId);
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toMatch(/首置位前面没人可接|处理边界|处理动作|不要展开药线|交投票方向|立刻表态/);
    expect(result.speech).not.toMatch(/(?:\d+号[^，。；]{0,16})?(?:先吃一点压力|已经说出口|这轮得把话讲实)/);
    expect(result.speech).not.toMatch(/刚才那句|上一位|等后置位把过程补出来/);
  });

  it("guides Chihaya Anon filler words as rare social beats instead of every clause", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const anon = state.seats.find((seat) => seat.isAi)!;
    anon.name = "千早爱音";
    anon.roleCard = {
      id: "anon",
      displayName: "千早爱音",
      theme: "class-trial",
      styleTags: ["social", "quick"],
      speechStyleZh: "轻快、会用社交感缓冲压力，但不要逃避结论。",
      reasoningBias: "先接住气氛，再指出具体发言违和。",
      voteBias: "倾向跟着明确矛盾推进。",
      nightActionBias: "夜晚避免冒险。",
      asVillager: "作为好人时把犹豫说清楚。",
      asWerewolf: "作为狼人时用轻快语气化解压力。",
      pressureResponse: "用一句语气词缓冲，再给理由。",
      relationshipHints: [],
      catchphrasePolicy: "嗯、啊、那个这类语气词最多一次，只放在开场或转折前。",
      forbidden: [],
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [anon.seatId];
    state.speechIndex = 0;

    const input = buildConstrainedSpeechInput(buildAgentView(state, anon.seatId), createSpeechPlan(buildAgentView(state, anon.seatId)), "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(guideText).toContain("千早爱音");
    expect(guideText).toContain("只允许少量转场语气词");
    expect(guideText).toContain("不乱塞语气词");
    expect(guideText).not.toContain("语气词最多一次");
    expect(guideText).not.toContain("不要把“嗯”“啊”“那个”塞在数字座位或投票目标中间");
  });

  it("uses character-specific class-trial fallback instead of generic table templates", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => JSON.stringify({ speech: "第一，我先按公开信息盘。第二，桌面已经很多人把压力给到3号了。第三，我换一个角度继续复盘。" }),
    });
    const state = createGame({ seed: 91, humanSeatId: null });
    const enoshima = state.seats.find((seat) => seat.isAi)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = {
      id: "enoshima",
      displayName: "江之岛盾子",
      theme: "class-trial",
      styleTags: ["chaotic", "dramatic"],
      speechStyleZh: "戏剧化、挑衅，但每句话都咬住公开矛盾。",
      reasoningBias: "放大公开发言里的反差。",
      voteBias: "喜欢把压力推向能制造反应的位置。",
      nightActionBias: "夜晚行动激进。",
      asVillager: "作为好人时用夸张语气逼出矛盾。",
      asWerewolf: "作为狼人时把混乱包装成公开推理。",
      pressureResponse: "被怀疑时反向挑衅。",
      relationshipHints: [],
      catchphrasePolicy: "允许绝望感短句，不复刻长段原台词。",
      forbidden: [],
    };
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;

    const result = await provider.generateSpeech(buildAgentView(state, enoshima.seatId), createSpeechPlan(buildAgentView(state, enoshima.seatId)));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/^江之岛盾子[。！？，,]/);
    expect(result.speech).toMatch(/绝望|裂口|反差/);
    expect(result.speech).not.toContain("我是江之岛盾子");
    expect(result.speech).not.toContain("按现在桌面看");
    expect(result.speech).not.toContain("我换一个角度");
  });

  it("does not frame public witch medicine as a role-claim gap in class-trial fallback", async () => {
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => JSON.stringify({ speech: "第一，我先按公开信息盘。第二，桌面已经很多人把压力给到1号了。第三，我换一个角度继续复盘。" }),
    });
    let state = createGame({ seed: 52930, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = {
      id: "kirigiri",
      displayName: "雾切响子",
      theme: "class-trial",
      styleTags: ["calm", "deductive"],
      speechStyleZh: "冷静、克制，优先指出证据链缺口。",
      reasoningBias: "更看重发言前后是否闭合。",
      voteBias: "倾向投证据链最不完整的位置。",
      nightActionBias: "夜晚行动谨慎。",
      asVillager: "作为好人时保持事实边界。",
      asWerewolf: "作为狼人时用冷静逻辑包装公开理由。",
      pressureResponse: "被怀疑时逐条拆解证据。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短冷静收束句。",
      forbidden: [],
    };
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "平安夜，女巫用药了，这一晚没有出事。首置位没什么硬信息可盘，我先记录每个人发言前后是否一致。",
    });

    const view = buildAgentView(state, kirigiri.seatId);
    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toContain("给过身份信息");
    expect(result.speech).toContain("平安夜只能当背景");
    expect(result.speech).not.toContain("平安夜药线");
  });
});

describe("mock speech provider", () => {
  it("dedupes direct mock command seer-claim lead in 12p sheriff speeches", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    state.day = 1;
    state.phase = "SHERIFF_SPEECH";
    state.sheriff = {
      candidates: [seer.seatId],
      speechQueue: [seer.seatId],
      speechIndex: 0,
      nominationDecisions: {},
      withdrawalDecisions: {},
      votes: {},
      withdrawnSeatIds: [],
      resolved: false,
    };
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];

    const command = createMockCommand(buildAgentView(state, seer.seatId));

    expect(command.type).toBe("sheriffSpeech");
    if (command.type !== "sheriffSpeech") return;
    expect(command.message.match(/我跳预言家/g)).toHaveLength(1);
    expect(command.message).toContain(`${wolf.seatId}号是查杀`);
    expect(command.message).not.toMatch(/我跳预言家，\d+号是查杀。我跳预言家/);
    expect(command.message).not.toContain("。。");
  });

  it("keeps direct mock hard-role sheriff speeches free of internal motive text", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    const hunter = state.seats.find((seat) => seat.role === "HUNTER")!;
    state.day = 1;
    state.phase = "SHERIFF_PK_SPEECH";
    state.sheriff = {
      candidates: [hunter.seatId],
      speechQueue: [hunter.seatId],
      speechIndex: 0,
      nominationDecisions: {},
      withdrawalDecisions: {},
      votes: {},
      withdrawnSeatIds: [],
      resolved: false,
    };

    const command = createMockCommand(buildAgentView(state, hunter.seatId));

    expect(command.type).toBe("sheriffSpeech");
    if (command.type !== "sheriffSpeech") return;
    expect(command.message).toContain("我拍猎人");
    expect(command.message.match(/我拍猎人/g)).toHaveLength(1);
    expect(command.message).not.toMatch(/拍身份是为了|用身份替代推理|底牌不虚但不乱拍身份/);
    expect(command.message).not.toContain("。。");
  });

  it("keeps ordinary live-intent scaffolding out of spoken mock text", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "Mimo") ?? state.seats.find((seat) => seat.isAi)!;
    const target = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    speaker.role = "VILLAGER";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    state.aiMemories = {
      [String(speaker.seatId)]: {
        seatId: speaker.seatId,
        day: 2,
        lastSpeechTargetSeatId: target.seatId,
        lastSpeechStance: `${target.seatId}号上一轮发言和票型没接上`,
        beliefs: [],
      },
    };
    const view = buildAgentView(state, speaker.seatId);
    const plan = {
      ...createSpeechPlan(view),
      kind: "pressure" as const,
      target,
      talkingPoints: [`${target.seatId}号上一轮发言和票型没接上`, "今天先看他怎么接这张压力"],
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.speech).toContain(`${target.seatId}号`);
    expect(result.speech).not.toMatch(
      /这条线我继续看公开过程|只打一条公开切口|发言只推进|后续投票要接得上|先放进今天的观察位|这里我只打一个具体疑点|卡我的是公开发言和票型还没接住|挑一个全桌能复核的压力点|我先看一处公开问题|发言和票型先合在一起看/,
    );
    expect(result.speech).not.toMatch(/普通局临场意图|liveIntent|publicReason|commitment|antiTemplateMove/);
  });

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

    expect(result.speech).toMatch(/轮到|后面补|后置位/);
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
    expect(result.speech).toMatch(/已发言|已经说出口|哪句话|投票|票口/);
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

    expect(fourthInput.playerSpeechGuide.tableTask?.line).toMatch(/不要复读|借这个焦点|好人解释|不直接打死|哪一步能自证|转看/);
    expect(fifthInput.playerSpeechGuide.tableTask?.line).toMatch(/不要复读|借这个焦点|好人解释|不直接打死|哪一步能自证|转看/);
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

    expect(input.constraints?.join("\n")).toContain("首夜单死只一句带过");
    expect(input.constraints?.join("\n")).toContain("平安夜只一句带过");
    expect(allGuidance).toContain("女巫没救");
    expect(allGuidance).toContain("女巫用了救药");
    expect(allGuidance).not.toMatch(/女巫没救\/没用解药|女巫没救或者没用解药|救药\/解药/);
    expect(allGuidance).toContain("不要把死亡形态当成发言主线");
    expect(allGuidance).toContain("不要展开夜间规则前提");
    expect(allGuidance).toContain("只说自己的状态和临时处理");
    expect(allGuidance).toContain("直接说先听、暂放或不压票");
    expect(allGuidance).not.toMatch(/谁急着借平安夜|谁急着借这个带票|看谁急着带票/);
    expect(allGuidance).toContain("空刀");
    expect(allGuidance).not.toContain("近似忽略");
    expect(allGuidance).not.toContain("狼人不能空刀");
    expect(input.inferenceLayers.highProbability.join("\n")).toContain("女巫用药了");
    expect(input.inferenceLayers.lowProbability.join("\n")).toContain("空刀只作为边界");
    expect(input.inferenceLayers.privateUnknowns.join("\n")).toContain("女巫是谁");
  });

  it("rejects ordinary peace-night speeches that expand into wolf knife and witch-action rule lectures", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 1)!;
    state.speechQueue = [speaker.seatId, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan);
    const guideText = JSON.stringify(input);

    expect(guideText).toContain("不要说狼队知道刀口");
    expect(guideText).toContain("不要说后置位越过闭眼视角");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了。我位置靠前，信息少，先说一个观察点：狼队昨晚刀了人，女巫救了，狼队现在知道自己刀口在哪，也知道救没救。如果后置位有人对平安夜的反应明显越过了闭眼视角，或者对刀口、女巫行动有超出公开信息的揣测，我会特别注意。",
        "guided",
      ),
    ).toContain("普通局平安夜不要展开刀口和女巫行动规则课");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用了救药。我是1号，第一个发言，信息确实少。现在我最想看的是后面谁急着拿这个平安夜做文章，谁急着定义刀口或者替女巫分析用药逻辑——这种话闭眼位说不出来，说得越具体越像在找女巫。",
        "guided",
      ),
    ).toContain("普通局平安夜不要展开刀口和女巫行动规则课");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我现在信息少，先不拿平安夜定人。谁急着借平安夜带票，我回头再压。",
        "guided",
      ),
    ).not.toContain("普通局平安夜不要展开刀口和女巫行动规则课");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜我当背景处理，不拿它定人。我底牌不虚，但也不急着交身份，先用闭眼视角聊几句。今天我的处理方式是先听一圈发言，重点看谁急着借平安夜带节奏。",
        "guided",
      ),
    ).not.toContain("普通局平安夜不要展开刀口和女巫行动规则课");
  });

  it("rejects ordinary day-one speeches that ask others to infer first-night wolf kill intent", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。4号倒牌，狼刀成功，女巫没救。后置位说一下狼队为什么会刀4号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。4号昨晚死了就当狼刀成功，女巫没救。我怎么猜狼队刀法意图？这个观察点要是后置位有人能直接答上来，我倒想知道。",
        "guided",
      ),
    ).toContain("普通局首夜不要追问狼刀意图");
  });

  it("rejects ordinary low-info direct tasks that skip the next unspoken seat", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 5, 6, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。4号倒牌，狼刀成功，女巫没救。我先看前置有没有人硬拿死讯带方向。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我不猜狼刀意图，先听谁会借4号倒牌压人。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号发言。1号和2号都没给出站边，我先不归死。6号Gemini，轮到你的时候我想听你怎么解释4号为什么会吃刀。",
        "guided",
      ),
    ).toContain("普通局低信息不要跳过下一位直接布置后置任务");
  });

  it("rejects ordinary low-info questions that skip the next unspoken seat even when only one future seat is named", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。7号倒牌，狼刀成功，女巫没救。我先看谁借死讯带方向。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我觉得1号把死讯和身份揉在一起。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。2号这个观察我听进去了，但我先不归死。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "6号，你还没说话，我先卡你一个点。如果1号是好人，2号和3号这么快联动踩他，你觉得收益点在哪？你的回答我得先听着。",
        "guided",
      ),
    ).toContain("普通局低信息不要跳过下一位直接布置后置任务");
  });

  it("rejects ordinary first-seat low-info openers that assign named future-seat homework", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫大概率用药了。我第一个发言，信息最少，但我会盯一个点：这轮如果有人急着定义平安夜我会卡他一下。3号GPT，轮到你时我想听你怎么看这个点。",
        "guided",
      ),
    ).toContain("普通局低信息首置位不要点名后置位布置任务");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫救了人，这个点先过去。我第一个发言，信息量有限，但我比较想看3号这轮怎么发言；如果他上来急着找神、铺身份线，我会比较在意。",
        "guided",
      ),
    ).toContain("普通局低信息首置位不要点名后置位布置任务");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我现在信息少，平安夜先当背景。谁急着拿平安夜带票，我再回头压。",
        "guided",
      ),
    ).not.toContain("普通局低信息首置位不要点名后置位布置任务");
  });

  it("rejects ordinary first-seat meta-audit openers without banning low-info water", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先说我会卡什么。平安夜女巫用药了，这点先放着，我主要看后面谁把话说满。",
        "guided",
      ),
    ).toContain("普通局首置位不要用审稿元话术开场");
    expect(
      validateRenderedSpeech(view, plan, "我这位置真没东西，先过。后面谁急着拿平安夜带票，我再看。", "guided"),
    ).not.toContain("普通局首置位不要用审稿元话术开场");
  });

  it("rejects ordinary empty micro-moves that only leave a vague doubt", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先当背景，我看谁急着拿这个带票。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号这句我先听进来，但我不急着站边。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "这段我先留一处疑问，后面看谁接。", "guided")).toContain(
      "普通局短发言必须有自己的处理动作",
    );
    expect(validateRenderedSpeech(view, plan, "我没听出2号的票口，但我先不投他，等他后面票往哪落。", "guided")).not.toContain(
      "普通局短发言必须有自己的处理动作",
    );
  });

  it("rejects ordinary later-chain wording that confuses the current speech order", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [1, "1号发言。平安夜先放着，我先说我怎么听。"],
      [2, "2号发言。1号没直接定人，我先认这一点。"],
      [3, "3号发言。我也不急着压票，先听后面怎么处理。"],
      [4, "4号发言。3号这段我没完全听顺，但先不打死。"],
      [5, "5号发言。我跟4号一点，3号的票口还不清楚。"],
    ] as Array<[number, string]>) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我听了一圈，3号那段先记着，目前我主要看3号后面的人怎么接这条线。",
        "guided",
      ),
    ).toContain("普通局不要用后置链路审计当前已过发言");
    expect(
      validateRenderedSpeech(view, plan, "我听了一圈，3号那段没听明白；今天我先不跟5号这票。", "guided"),
    ).not.toContain("普通局不要用后置链路审计当前已过发言");
  });

  it("rejects ordinary peace-night common-sense mentions framed as probing the witch", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
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
      message: "1号发言。平安夜，女巫用药了。我先看谁借这个背景收票。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜一句带过，先看1号。你自己首置位先提了女巫用药，这个说法本身就在往平安夜上靠。你到底是在观察别人怎么带票，还是自己先试探一下女巫会不会跳？",
        "guided",
      ),
    ).toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        '我是女巫，昨夜我救了4号豆包，4号是银水。1号DeepSeek，你说"平安夜女巫用了救药"，这句话你到底是在陈述一个按我理解，还是你有别的信息来源？如果是纯推理，那后面所有人包括你自己都可以说这句话，这个观察点就不太好用。',
        "guided",
      ),
    ).toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号提平安夜我只当背景；我更在意他有没有借这个背景往别人身上收票。",
        "guided",
      ),
    ).not.toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
  });

  it("rejects ordinary repeated 卡 surface loops after prior seats already used it", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [1, "1号发言。平安夜先当背景，我卡的点是谁会急着带票。"],
      [2, "2号发言。1号这句我先听进来，不急着压。"],
      [3, "3号发言。我先不跟票，再听一圈。"],
      [4, "4号发言。3号那句话我听着卡，但先不投死。"],
    ] as Array<[number, string]>) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "我听着也卡了一下，卡的是1号这边现在怎么回到票上。", "guided"),
    ).toContain("普通局不要连续复读卡句式");
    expect(
      validateRenderedSpeech(view, plan, "豆包刚才那句我先记着，他打1号那个点确实卡得准。", "guided"),
    ).toContain("普通局不要连续复读卡句式");
    expect(
      validateRenderedSpeech(view, plan, "我先换个说法，1号这边我暂放，今天不跟4号这票。", "guided"),
    ).not.toContain("普通局不要连续复读卡句式");
  });

  it("rejects ordinary single 卡 surface jargon in generated speech", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先当背景，我先看谁把票说死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我是女巫，昨晚救了4号，4号是银水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek，你刚才那句话我反复听了一遍，觉得有点卡。你说底牌不虚，但没有给今天的票口。",
        "guided",
      ),
    ).toContain("普通局不要用卡句式口癖");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号豆包发言。我直接说，我现在最卡1号DeepSeek。刚才1号那番话像是在提前铺垫。",
        "guided",
      ),
    ).toContain("普通局不要用卡句式口癖");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号豆包后半句引了1号那句谁急着带票，这里有个细节卡了我一下。",
        "guided",
      ),
    ).toContain("普通局不要用卡句式口癖");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek，你刚才那句话我反复听了一遍，有点没听明白。你说底牌不虚，但没有给今天的票口。",
        "guided",
      ),
    ).not.toContain("普通局不要用卡句式口癖");
  });

  it("rejects ordinary visible player-jargon surfaces in generated speech", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先当背景，我先看谁把票说死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我是女巫，昨晚救了4号，4号是银水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek，你这句话其实已经在给后面的人划线了；谁顺着平安夜往下盘，算不算触你这条线？",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek，你这是想提前给后面的人划一条线，看谁急着借这个带票。",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek后面那句抓谁的话前后对不上，等于给后置位布置了作业但自己没落具体。",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek这个发言像是在给别人画线，自己却完全不表态。",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude跳女巫报9号银水，目前没人对跳，我先认这个身份空间，但6号你没说打算怎么用这个信息。",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "昨天票型要拆开看，谁是起票的、谁是补票的、谁是最后跟票的，这个链路要审清楚。",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek，你留意别人借平安夜收票，这个我听懂了；但你自己今天准备先压谁，也得给一句话。",
        "guided",
      ),
    ).not.toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude跳女巫报9号银水，目前没人对跳，我先当真女巫听；6号你认不认这张女巫牌，票准备往哪放，要给一句话。",
        "guided",
      ),
    ).not.toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "昨天那轮票我想回看谁先把票带起来、谁顺着跟上；不是说谁跟票谁一定坏，我先看理由能不能接上。",
        "guided",
      ),
    ).not.toContain("普通局不要把内部审稿词说出口");
  });

  it("rejects ordinary copied prior surface phrasing", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [1, "1号发言。平安夜先当背景，我先看谁把票说死。"],
      [2, "2号发言。我是女巫，昨晚救了4号，4号是银水。"],
      [3, "3号发言。2号先留身份空间，等有没有人对跳。"],
      [4, "4号发言。2号报我银水，我先接这个身份信息。"],
      [
        5,
        "5号发言。1号，你这个观察点本身没问题，但你自己这句话其实已经在给后面的人划线了——谁借平安夜收票这个标准，你自己先立出来了。你后置位的人如果顺着平安夜盘女巫用药、盘谁可能被刀，算不算触你这条线？",
      ],
    ] as Array<[number, string]>) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek，你这个观察点本身没问题，但你自己这句话其实已经在给后面的人划线了——谁借平安夜收票这个标准，你自己先立出来了。你后置位的人如果顺着平安夜盘女巫用药、盘谁可能被刀，算不算触你这条线？",
        "guided",
      ),
    ).toContain("普通局不要复制前置位整段表述");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我不跟5号继续压1号。2号女巫和4号银水先放着，我现在更想听7号后面会不会对跳。",
        "guided",
      ),
    ).not.toContain("普通局不要复制前置位整段表述");
  });

  it("rejects ordinary duplicated-word slips in generated speech", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "我听了一圈，现在先先不把3号投死。", "guided")).toContain(
      "普通局发言不要出现重复口误",
    );
    expect(validateRenderedSpeech(view, plan, "我听了一圈，现在先不把3号投死。", "guided")).not.toContain(
      "普通局发言不要出现重复口误",
    );
  });

  it("adds universal de-template guidance to ordinary werewolf speech input", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。我先按公开信息盘，前面没人给站边就先观察。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号没有站边也没有票口，这个疑点先放着。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我也觉得1号没给票口，今天先看这个缺口。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;

    const view = buildAgentView(state, 4);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
      ...input.playerSpeechGuide.avoid,
    ].join("\n");

    expect(guideText).toContain("通用去模板");
    expect(guideText).toContain("不要继续复读没站边/没票口");
    expect(guideText).toContain("身份收益");
    expect(guideText).toContain("票型动机");
    expect(guideText).toContain("反应差");
    expect(guideText).toContain("可验证条件");
  });

  it("adds ordinary player-mouth guidance to ordinary werewolf speech input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    speaker.persona = {
      ...speaker.persona!,
      ordinaryPlayerProfile: defaultOrdinaryPlayerProfile("one-line-catcher"),
    };
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
      ...input.playerSpeechGuide.avoid,
    ].join("\n");

    expect(guideText).toContain("普通局玩家类型策略");
    expect(guideText).toContain("爱抓一句话");
    expect(guideText).toContain("第一人称");
    expect(guideText).toContain("真人微动作");
    expect(guideText).toContain("每段只选一个主动作");
    expect(guideText).toContain("普通玩家能听懂");
    expect(guideText).toContain("必要术语可以保留");
    expect(guideText).toContain("首置位默认不点名任何后置位");
    expect(guideText).toContain("说完可以停");
    expect(guideText).toContain("低信息过水：只说暂放/先听/不压票");
    expect(guideText).not.toMatch(/卡一句|卡的是哪句话|卡我的是/);
    expect(guideText).not.toContain("收益来源=为什么现在怀疑他");
    expect(guideText).not.toContain("发言链/闭合=前后有没有说清楚");
    expect(guideText).not.toContain("普通局模型人格策略");
  });

  it("adds a stable ordinary player voice card to the soft director", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "Mimo") ?? state.seats.find((seat) => seat.isAi)!;
    speaker.persona = {
      ...speaker.persona!,
      ordinaryPlayerProfile: defaultOrdinaryPlayerProfile("emotional-reactor"),
    };
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          playerVoiceCard?: {
            label?: string;
            traits?: string[];
            mouthHabit?: string;
            emotionTell?: string;
            riskHabit?: string;
            promptLines?: string[];
          };
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const guideText = [
      ...(director?.promptLines ?? []),
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
    ].join("\n");

    expect(director?.playerVoiceCard?.label).toContain("情绪反应型");
    expect(director?.playerVoiceCard?.traits?.join("\n")).toContain("情绪位");
    expect(director?.playerVoiceCard?.mouthHabit).toContain("不满");
    expect(director?.playerVoiceCard?.emotionTell).toContain("情绪");
    expect(director?.playerVoiceCard?.riskHabit).toContain("压");
    expect(guideText).toContain("普通局玩家小传");
    expect(guideText).toContain("口头习惯");
    expect(guideText).toContain("发言长度档位");
    expect(guideText).toContain("提问倾向");
    expect(guideText).toContain("口头填充");
    expect(guideText).toContain("情绪幅度");
    expect(guideText).toContain("默认风险姿态");
    expect(guideText).toContain("这不是台词模板");
  });

  it("adds ordinary self-history to the soft director", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.name === "Mimo") ?? state.seats.find((seat) => seat.isAi)!;
    const target = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId, target.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: speaker.seatId,
      message: `${speaker.seatId}号发言。我上一轮先压${target.seatId}号，因为他票口说得太虚。`,
    });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [target.seatId, speaker.seatId];
    state.speechIndex = 0;
    state.aiMemories = {
      [String(speaker.seatId)]: {
        seatId: speaker.seatId,
        day: 2,
        lastSpeechTargetSeatId: target.seatId,
        lastSpeechStance: `${target.seatId}号上一轮票口说得太虚`,
        lastVoteTargetSeatId: target.seatId,
        lastVoteReason: `${target.seatId}号白天没有把票口落下来`,
        beliefs: [],
      },
    };
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: target.seatId,
      message: `${target.seatId}号发言。${speaker.seatId}号你上一轮压我，但投票理由没说满，我要你这轮先回应这个改口压力。`,
    });

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          selfHistory?: {
            lastPublicSpeech?: string;
            lastSpeechTarget?: { seatId: number };
            lastSpeechStance?: string;
            lastVoteTarget?: { seatId: number };
            lastVoteReason?: string;
            promptLines?: string[];
          };
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const promptText = director?.promptLines?.join("\n") ?? "";

    expect(director?.selfHistory?.lastPublicSpeech).toContain(`先压${target.seatId}号`);
    expect(director?.selfHistory?.lastSpeechTarget?.seatId).toBe(target.seatId);
    expect(director?.selfHistory?.lastSpeechStance).toContain("票口说得太虚");
    expect(director?.selfHistory?.lastVoteTarget?.seatId).toBe(target.seatId);
    expect(director?.selfHistory?.lastVoteReason).toContain("没有把票口落下来");
    expect(promptText).toContain("普通局自我历史");
    expect(promptText).toContain("可以延续，也可以改口");
    expect(promptText).toContain("用第一人称说为什么");
    expect(promptText).toContain("这轮我被");
    expect(promptText).toContain(`${target.seatId}号`);
    expect(promptText).toContain("点过");
  });

  it("adds ordinary soft-director action candidates to ordinary speech input", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          currentPressure?: string;
          allowedSpeechMoves?: string[];
          tableObjects?: string[];
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const guideText = [
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
      ...input.playerSpeechGuide.avoid,
    ].join("\n");

    expect(director?.currentPressure).toBe("noInformation");
    expect(director?.allowedSpeechMoves).toEqual(["waterPass"]);
    expect(input.speechContract.maxSentences).toBe(2);
    expect(input.speechContract.maxChars).toBe(90);
    expect(input.speechContract.mustSay.join("\n")).toContain("只说自己当前处理");
    expect(input.speechContract.mayAsk).toEqual([]);
    expect(director?.tableObjects?.join("\n")).toContain("平安夜");
    expect(guideText).toContain("普通局软导演");
    expect(guideText).toContain("先选一个玩家动作");
    expect(guideText).toContain("当前自我状态");
    expect(guideText).toContain("局部公开对象");
    expect(guideText).toContain("玩家动作");
    expect(guideText).toContain("口吻纹理");
    expect(guideText).toContain("seatState");
    expect(guideText).toContain("localObject");
    expect(guideText).toContain("playerMove");
    expect(guideText).toContain("socialTexture");
    expect(guideText).toContain("tableContinuation");
    expect(guideText).toContain("不要输出动作名");
    expect(guideText).not.toMatch(/先铺一个观察点|先给(?:保留态度或)?观察点|可验证观察点/);
  });

  it("warns ordinary speech input away from repeated previous-seat pickup rhythm", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我先接上一位这个判断我听到了，平安夜先当背景，我暂时不站死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "上一位这个点我听到了，我先接一下，但我也先不把票压死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我先接上一位那句话，这个判断我听到了，后面再看谁跟。",
    });
    const view = buildAgentView(state, 4);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          allowedSpeechMoves?: string[];
          recentSurfaceMoves?: string[];
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const guideText = [
      ...(director?.promptLines ?? []),
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
    ].join("\n");

    expect(director?.recentSurfaceMoves).toContain("接上一位/我听到了");
    expect(director?.allowedSpeechMoves).not.toContain("quoteOneLine");
    expect(director?.allowedSpeechMoves).toEqual(expect.arrayContaining(["discomfort", "hold", "voteBoundary"]));
    expect(guideText).toContain("接上一位/我听到了");
    expect(guideText).toContain("这轮要换玩家动作");
    expect(guideText).toContain("承接不是礼仪");
    expect(guideText).toContain("可以直接反驳");
    expect(guideText).toContain("可以不点上一位");
    expect(guideText).toContain("可以短水");
    expect(guideText).toContain("可以护人");
    expect(guideText).toContain("可以换目标");
  });

  it("warns ordinary speech input away from repeated full-quote propagation", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [9, 1, 2, 3, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 9,
      message: "我上警不是抢带队，先给一个标准：警徽要给能听完对跳、还能把票口说清的人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "9号刚才那句“警徽要给能听完对跳、还能把票口说清的人”，我抓住了，但我要看他自己票口。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "9号那句“警徽要给能听完对跳、还能把票口说清的人”像在定标准，但落票没出来。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我也听到9号说“警徽要给能听完对跳、还能把票口说清的人”，这句已经被前面反复提了。",
    });
    const view = buildAgentView(state, 4);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          allowedSpeechMoves?: string[];
          recentSurfaceMoves?: string[];
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const promptText = director?.promptLines?.join("\n") ?? "";

    expect(director?.recentSurfaceMoves?.join("\n")).toContain("整句引用重复");
    expect(director?.allowedSpeechMoves).not.toContain("quoteOneLine");
    expect(promptText).toContain("前置位已经多次整句引用同一句");
    expect(promptText).toContain("不要再全文引用");
  });

  it("steers ordinary speech input away from over-cited shared pressure targets", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我首置位没什么信息，先听一圈，不急着站死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我先压1号，他说先听一圈但票口没讲清，后面得解释。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我也觉得1号哪里没说清，不是直接打死，但今天先看他怎么回应。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "1号这边先记着，票我暂时也会往他身上压。",
    });
    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          allowedSpeechMoves?: string[];
          recentSurfaceMoves?: string[];
          tableObjects?: string[];
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const promptText = director?.promptLines?.join("\n") ?? "";

    expect(director?.recentSurfaceMoves).toContain("同轴压力重复: 1号");
    expect(director?.allowedSpeechMoves).not.toContain("quoteOneLine");
    expect(director?.allowedSpeechMoves).not.toContain("halfAccept");
    expect(director?.allowedSpeechMoves).not.toContain("followPressure");
    expect(director?.allowedSpeechMoves).toEqual(expect.arrayContaining(["hold", "waterPass", "voteBoundary"]));
    expect(director?.tableObjects?.join("\n")).toContain("1号已被连续点到");
    expect(promptText).toContain("不要继续沿着同一压力轴复读");
    expect(promptText).toContain("共享压力预算已用完");
    expect(promptText).toContain("后续座位不要继续追同一个人同一个点");
  });

  it("diversifies ordinary public-role claim handling instead of one cautious bridge", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，预言家，昨晚验了9号DeepSeek2，9号是查杀。今天票先压9号。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          currentPressure?: string;
          allowedSpeechMoves?: string[];
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const promptText = director?.promptLines?.join("\n") ?? "";

    expect(director?.currentPressure).toBe("publicRoleClaim");
    expect(director?.allowedSpeechMoves).toEqual(expect.arrayContaining(["roleHandle", "voteBoundary", "hold"]));
    expect(director?.allowedSpeechMoves).toEqual(expect.arrayContaining(["changeRead", "discomfort"]));
    expect(director?.allowedSpeechMoves).not.toContain("quoteOneLine");
    expect(promptText).toContain("公开身份声明不是单一处理器");
    expect(promptText).toContain("直接站边");
    expect(promptText).toContain("质疑跳者动机");
    expect(promptText).toContain("护被查者");
    expect(promptText).toContain("要求对跳");
    expect(promptText).toContain("短水观望");
  });

  it("keeps repeated-axis steering active after a public role claim", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。平安夜信息少，我先听一圈，不急着定人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，女巫。昨晚救的是4号豆包，4号是银水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我还是要压1号，他说先听一圈，但票口没讲清。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "1号这边我也不舒服，底牌不虚这句和后面连不上，今天先看他怎么解释。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          currentPressure?: string;
          allowedSpeechMoves?: string[];
          recentSurfaceMoves?: string[];
          tableObjects?: string[];
        };
      }
    ).ordinarySpeechDirector;

    expect(director?.currentPressure).toBe("publicRoleClaim");
    expect(director?.recentSurfaceMoves).toContain("同轴压力重复: 1号");
    expect(director?.allowedSpeechMoves).toContain("roleHandle");
    expect(director?.allowedSpeechMoves).not.toContain("quoteOneLine");
    expect(director?.allowedSpeechMoves).not.toContain("halfAccept");
    expect(director?.allowedSpeechMoves).not.toContain("followPressure");
    expect(director?.allowedSpeechMoves).toEqual(expect.arrayContaining(["hold", "voteBoundary", "waterPass"]));
    expect(director?.tableObjects?.join("\n")).toContain("1号已被连续点到");
  });

  it("downgrades stale ordinary self-history targets that are no longer alive", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 3;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.alive)!;
    const staleTarget = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    staleTarget.alive = false;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    state.aiMemories = {
      [String(speaker.seatId)]: {
        seatId: speaker.seatId,
        day: 3,
        lastSpeechTargetSeatId: staleTarget.seatId,
        lastSpeechStance: `${staleTarget.seatId}号上一轮我觉得像悍跳`,
        lastVoteTargetSeatId: staleTarget.seatId,
        lastVoteReason: `${staleTarget.seatId}号对跳线更硬`,
        beliefs: [],
      },
    };

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          selfHistory?: {
            lastSpeechTarget?: { seatId: number };
            lastVoteTarget?: { seatId: number };
            promptLines?: string[];
          };
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const promptText = director?.promptLines?.join("\n") ?? "";

    expect(director?.selfHistory?.lastSpeechTarget).toBeUndefined();
    expect(director?.selfHistory?.lastVoteTarget).toBeUndefined();
    expect(promptText).not.toContain(`上一轮我发言主要点过${staleTarget.seatId}号`);
    expect(promptText).toContain(`${staleTarget.seatId}号`);
    expect(promptText).toContain("旧线");
    expect(promptText).toContain("不是当前可处理目标");
  });

  it("prioritizes ordinary defense moves when the current speaker is questioned", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜女巫用药了，这个我先当公开背景；2号你刚才如果也这么说，就解释下你不是在泄视角。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const director = (
      input as {
        ordinarySpeechDirector?: {
          currentPressure?: string;
          allowedSpeechMoves?: string[];
          tableObjects?: string[];
          promptLines?: string[];
        };
      }
    ).ordinarySpeechDirector;
    const promptText = director?.promptLines?.join("\n") ?? "";

    expect(director?.currentPressure).toBe("underQuestion");
    expect(director?.allowedSpeechMoves?.slice(0, 3)).toEqual(
      expect.arrayContaining(["defendSelf", "clarifyMotive"]),
    );
    expect(promptText).toContain("先回应自己被打到的点");
    expect(promptText).toContain("平安夜女巫用药");
  });

  it("rejects latest accepted ordinary audit surfaces without blocking weak low-info water", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。我不知道说什么太多，平安夜先当背景，我先不定人。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "当前先审你的发言缺口，1号这话本身我先放观察位，后面看观察条件怎么落。",
        "guided",
      ),
    ).toContain("普通局不要把内部审稿词说出口");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我不知道说什么太多，平安夜我先当背景。我先不定人，谁急着拿这个收票我再听。",
        "guided",
      ),
    ).not.toContain("普通局不要把内部审稿词说出口");
  });

  it("allows ordinary speech to describe a spoken seat's question to another seat", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek，平安夜先当背景，我更在意谁第一个借这个收票。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude。1号你是在说桌上有狼借这个点带节奏，还是你自己在先发制人？",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我是3号GPT。2号这个追问我听进来了，但我还没定1号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "我是4号豆包。3号说听进来但没落态度，这里我觉得有点滑。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    const errors = validateRenderedSpeech(
      view,
      plan,
      '我是5号Mimo。4号豆包说3号那句有点滑，这个我先记下，但我想先转回1号。1号你刚才说谁会第一个借平安夜收票，2号Claude追了你这个问题，问你是在说桌上有狼带节奏，还是你自己先发制人。我这里先不急着投你，今天看票怎么落。',
      "guided",
    );

    expect(errors).not.toContain("要求已发言的2号后续补充发言");
  });

  it("does not let ordinary fallback misread a concrete slippery-read as no suspicion", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-live-v04-sample",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "平安夜，女巫用药了。我是1号DeepSeek，底牌不虚，但今天先不拍身份，只说听法。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude。1号那句谁会第一个借平安夜收票，我有点没听懂。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我是3号GPT。2号这个追问我觉得问得还行，但你自己的回答呢？",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message:
        '我是4号豆包。平安夜过了，女巫用药，这个点不重复。3号GPT，你转头问2号"你自己现在怎么看1号这句话"，这话我听着有点滑。',
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.validationErrors ?? []).toEqual([]);
    expect(result.speech).not.toContain("只说了平安夜，但没说自己怀疑谁");
    expect(result.speech).not.toContain("我先说一个地方");
  });

  it("keeps ordinary provider-error first-seat fallback from assigning the next speaker", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/下一位|后置位|正常接麦/);
    expect(result.speech).toContain("我先不压票");
    expect(result.speech).toContain("先听一圈");
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("avoids reusing the public-claim fallback bridge already used this game", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，预言家，昨晚验了9号DeepSeek2，9号是查杀。今天票先压9号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "2号Claude报9号DeepSeek2查杀，这条线我先看今天怎么站边，不急着只听一个结论。9号先接查杀。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toContain("这条线我先看今天怎么站边，不急着只听一个结论");
    expect(result.speech).toMatch(/查杀|预言家|对跳|票口|保/);
  });

  it("makes ordinary provider-error fallback answer pressure before table review", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜女巫用药了，这个我先当公开背景；2号你如果也这么说，就解释下你不是在泄视角。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toMatch(/解释|不是泄视角|公开背景/);
    expect(result.speech).not.toMatch(/这段我先|留一处疑问|后置位|观察位|接这条线|身份线/);
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("keeps ordinary provider-error fallback from repeating the same note phrase", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    const previous = state.seats[4]!;
    const speaker = state.seats[5]!;
    setTestPersona(previous, "Mimo", "mimo", 0.5);
    setTestPersona(speaker, "Gemini", "gemini", 0.5);
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [previous.seatId, speaker.seatId, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "5号发言。我觉得2号这边给的信息有点绕，但暂时没有硬东西，我先按公开发言继续听大家。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/这段我先记下[，,]\s*这段我先记下/);
    expect(result.speech).not.toMatch(/身份线|观察位|发言缺口|身份空间|怎么用这个信息/);
  });

  it("keeps ordinary Kimi provider-error fallback in player language", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    const previous = state.seats[6]!;
    const speaker = state.seats[7]!;
    setTestPersona(previous, "GLM", "glm", 0.5);
    setTestPersona(speaker, "Kimi", "kimi", 0.5);
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [previous.seatId, speaker.seatId, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: previous.seatId,
      message: "7号发言。我先接前面几个人的说法，1号开场偏保守，2号拍女巫之后今天票别太散。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/身份线|身份关系|长线记忆|观察位|发言缺口|身份空间/);
    expect(result.speech).toMatch(/我/);
  });

  it("does not let ordinary fallback misread a peace-night action as no suspicion", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-fallback-speech",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我现在信息少，平安夜先当背景。谁急着拿这个带票，我再回头压。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我给一个边界，平安夜我不复读了。我现在只卡1号一句话，先不把票压死。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toContain("只说了平安夜，但没说自己怀疑谁");
    expect(result.speech).toMatch(/带票|压死|卡1号/);
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("keeps first-seat ordinary witch fallback from quoting unspoken seats", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "forced-first-seat-witch-fallback",
      render: async () => {
        throw new Error("forced fallback");
      },
    });
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 94, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    });
    const view = buildAgentView(state, 1);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/2号Claude刚才|2号刚才|刚才那句话|刚才那句/);
    expect(result.speech).not.toMatch(/谁急着拿这个带票|谁急着.*带票|看谁急着带方向/);
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("rejects ordinary day-one speeches that repeat an already repeated pressure-source question", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek，平安夜女巫用药了，重点看谁借平安夜带节奏、谁回避第一个压力。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "1号你说看谁回避压力，但现在只有你一个人发言，你观察的压力源在哪？",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "我也觉得1号这个点空，当时只有你一个人发过言，压力源在哪里？",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "前面都在压1号这句压力源，我先记下，但不展开。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    const errors = validateRenderedSpeech(
      view,
      plan,
      "我这轮还是转回1号DeepSeek的发言缺口。你当时说重点看谁借平安夜带节奏、谁回避第一个压力，但当时只有你一个人发言，这个观察点没有来源。2号Claude跳了女巫，目前没有对跳，我先认。",
      "guided",
    );
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guideText = [
      input.playerSpeechGuide.tableTask?.line,
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
    ].join("\n");

    expect(errors).toContain("普通局后置位不要复读同一发言缺口");
    expect(guideText).toContain("同一句压力源质疑已经被多人重复");
    expect(guideText).toContain("改审复读者");

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我还是回到1号DeepSeek。你是首置位，信息最少的时候恰恰应该最敢给方向，但你的发言里只有观察点，没有结论。2号Claude女巫先放着，今天先审1号这个缺口。",
        "guided",
      ),
    ).toContain("普通局后置位不要复读同一发言缺口");
  });

  it("rejects ordinary repeated same-axis pile-on around one fallback sentence", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。我这位置没东西，平安夜先当背景，谁借这个带票我再听。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我觉得1号只有观察点没有结论，这个发言缺口要先审。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我也回到1号这句话本身，观察条件没落下来。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。前面都在说1号，我继续看1号这句观察位怎么处理。",
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
        "我还是审1号这个发言缺口。1号这话本身只是观察点，观察条件没有落，我继续先压1号。",
        "guided",
      ),
    ).toContain("普通局不要连续围绕同一句做同质审计");
  });

  it("allows ordinary pressure-source callbacks when the speaker pivots to an identity line", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "平安夜，女巫用药了。我会特别留意后置位有没有人借平安夜这个公开信息带节奏。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是女巫，昨夜我救了4号豆包，4号是银水。1号刚才点后置位带节奏，我先卡一下。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "2号跳女巫报4号银水，我暂时先认。1号那句借平安夜带节奏点到我，我现在回应。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "2号报我银水我先认，但3号刚才重心还在1号身上，这条身份线没有接实。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];
    const plan = createSpeechPlan(view);

    const errors = validateRenderedSpeech(
      view,
      plan,
      '4号豆包的话我先记下，但我这轮想先转回1号DeepSeek。你刚才说"想听一轮发言"，但同一段话里又点3号重点关注，说要留意后置位有没有人借平安夜带节奏。2号Claude已经跳女巫报了4号银水，这条身份线摆在这里，你一句都没接，直接跳到观察3号。',
      "guided",
    );

    expect(errors).not.toContain("普通局后置位不要复读同一发言缺口");
    expect(errors).not.toContain("普通局发言必须推进一个游戏动作");
  });

  it("rejects ordinary speech that sounds like global table review or stacked internal jargon", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state.events.push({
      type: "DAY_STARTED",
      day: 1,
      message: "第1天清晨，4号 死亡。",
      payload: { deadSeatIds: [4] },
    } as never);
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先当背景，我会看谁顺手带节奏。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    const errors = validateRenderedSpeech(
      view,
      plan,
      "我是2号Claude。从全桌视角看，1号这条发言链没有闭合，今天收口就看这个压力源的收益来源。",
      "guided",
    );

    expect(errors).toContain("普通局发言不要像全桌复盘");
    expect(errors).toContain("普通局发言黑话堆叠");
  });

  it("rejects ordinary chained fallback-template phrases without banning normal observation words", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先当背景，我先听下一位怎么接。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号先放观察位，我不直接归死。这轮先看谁会把话说满。",
        "guided",
      ),
    ).toContain("普通局发言不要套兜底模板链");

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我听着1号这句有点别扭，先不投他；只问下一位怎么看这句。",
        "guided",
      ),
    ).toEqual([]);
  });

  it("rejects ordinary no-guard witch death-shape rule lectures without a game action", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const deadSeat = state.seats.find((seat) => seat.alive && seat.seatId !== 1 && seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });
    state.speechQueue = [1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    const errors = validateRenderedSpeech(
      view,
      plan,
      `${deadSeat.seatId}号死了。这是无守卫女巫局，按规则狼首夜必刀，女巫手里有解药。首夜单死说明大概率女巫没救${deadSeat.seatId}号，或者${deadSeat.seatId}号本身就是毒口和刀口重合。这个药瓶状态先记下。`,
      "guided",
    );

    expect(errors).toContain("普通局死亡形态不要展开规则课");
    expect(errors).toContain("普通局发言必须推进一个游戏动作");
  });

  it("keeps ordinary no-guard witch death-shape prompt guidance as one-line common sense", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const deadSeat = state.seats.find((seat) => seat.alive && seat.seatId !== 1 && seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });
    state.speechQueue = [1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [
      input.publicContext.rules.deathInfoNote,
      input.tableBriefing.publicFacts.join("\n"),
      input.playerSpeechGuide.tablePlayerStyle.join("\n"),
      input.playerSpeechGuide.softInteraction.join("\n"),
      input.constraints?.join("\n") ?? "",
    ].join("\n");

    expect(guideText).toContain("首夜单死只一句带过");
    expect(guideText).toContain("狼刀成功，女巫没救");
    expect(guideText).toContain("必须接一个怀疑、暂放、追问或投票条件");
    expect(guideText).not.toMatch(/毒口重合刀口|反面解释|药瓶状态|女巫手里有解药|狼首夜必刀/);
  });

  it("repairs ordinary no-guard witch rule lectures into player-mouth action", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const deadSeat = state.seats.find((seat) => seat.alive && seat.seatId !== 1 && seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });
    state.speechQueue = [1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-death-shape-repair-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech: `${deadSeat.seatId}号死了。这是无守卫女巫局，按规则狼首夜必刀，女巫手里有解药。首夜单死说明大概率女巫没救${deadSeat.seatId}号，或者${deadSeat.seatId}号本身就是毒口和刀口重合。这个药瓶状态先记下。`,
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: `${deadSeat.seatId}号昨晚倒牌，我只当狼刀成功、女巫没救。真正要看的不是药线，是谁开口急着借这个死讯带票；我这轮先盯第一个把话说满的人。`,
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局死亡形态不要展开规则课");
    expect(retryInput?.stability?.repairInstructions?.join("\n")).toContain("只一句处理死亡形态");
    expect(result.speech).toContain("狼刀成功");
    expect(result.speech).toContain("先盯");
    expect(result.speech).not.toMatch(/狼首夜必刀|女巫手里有解药|毒口和刀口重合|药瓶状态/);
  });

  it("rejects ordinary speeches that end with a cut-off seat reference", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。7号倒牌我只当狼刀成功，先听后面谁急着带方向。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我听到1号DeepSeek的发言了。现在信息这么少，你为什么觉得现在定投票纪律比先聊聊自己的身份感想更优先？我先把1",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是3号GPT。听完了前置两位。2号Claude刚才自己对1号的判断有个点我卡住了：1号",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "这个观察点要是后置位有人能直接答上来，我倒想知道",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号，女巫。昨晚救的是4号豆包，4号是银水，今天先不动他。1号你刚才那段话我听完有一个地方卡住了，你说信息太少只能从位置和发言顺序里找观察点，然后转头点3号要他聊，但你铺的那句",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号倒了，狼刀成功，女巫没救，这个背景先过了。我听下来，2号Claude刚才说1号DeepSeek保留很多但没有给清楚边界，我同意这个感觉。1号你说不站死谁，但又说要重点关注借死讯带票的人，这本身就是在用死讯给后置位划压力线。你留了",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号倒了，狼刀成功，女巫没救，这个背景先过了。我听下来，2号Claude刚才说1号DeepSeek保留很多但没有给清楚边界，我同意这个感觉。1号你说不站死谁，但又说要重点关注借死讯带票的人，这本身就是在用死讯给后置位划压力线。你留了",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是女巫，昨晚救的是4号豆包，4号是银水。1号DeepSeek你那个观察点我听懂了，但有个地方卡我——你说狼队会从3号那个位置安排悍跳，这句话的依据是什么？首置位给观察点没问题，但",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        '5号Mimo刚才说听了几遍1号的话，也说1号在等别人先动再决定压谁。我先不站死边，但3号GPT刚才那段发言，我有个点没听明白。你说你是闭眼视角，信息不多，然后先接了2号的女巫线，说暂时保护。这部分我理解。',
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是3号GPT。1号DeepSeek说昨夜平安夜先当背景，这句我先接住。但1号后面那个追问，我觉得方向有点问题。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        '听完1号DeepSeek，我第一遍觉得没什么问题；但回头再看1号那句"女巫用了救药"，确实有点奇怪。',
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是5号Mimo。4号豆包刚才问1号DeepSeek那句话我听懂了，但我现在想换个角度。我重新听1号DeepSeek的原话：'底牌不虚，但今天先不急着拍身份。' 这句话我现在越想越不对。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude。1号DeepSeek，你刚才那段话我听着有点怪。你说“昨夜平安夜，女巫用药了”，又说“现在信息太少，暂时不站死任何一边”。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先把2号Claude的女巫身份先认着，没对跳我今天不会去动这个身份。但我想说一个点，Claude你报了救4号豆包，这个信息我听进去了，可你后面又说",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先报身份，我是女巫。昨晚平安夜，我救的是4号豆包，4号是银水。听完1号DeepSeek的发言，你说",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是7号GLM。刚才Gemini说3号GPT那句",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是6号Gemini。5号Mimo刚才那段我听到了，他回看1号DeepSeek的点，这个方向我自己也有在想。但我想先换个位置看。3号GPT刚才那句话我有点没听明白。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(validateRenderedSpeech(view, plan, "我是6号Gemini。前面信息我先暂放。我主要想说1号DeepSeek。", "guided")).toContain(
      "普通局发言疑似被截断",
    );
    let v08State = createGame({ boardId: "9p-seer-witch-hunter", seed: 92, humanSeatId: null });
    v08State.day = 1;
    v08State.phase = "DAY_SPEECH";
    v08State.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    v08State.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [1, "平安夜，女巫用过药了。我首置位，信息确实少，先记一下谁急着借这个点带票。我底牌留一下，今天先看发言。"],
      [
        2,
        '平安夜这个点，1号DeepSeek你说了女巫用药，这个判断我暂时认同，但后面谁急着借这个点收票我也会记。不过1号你刚才说"底牌留一下，今天先看发言"，我有点没听明白。',
      ],
      [
        3,
        "我听完1号DeepSeek和2号Claude的发言，暂时不急着站边。2号你自己那句“谁急着借这个点收票我也会记”让我有点不舒服。",
      ],
      [
        4,
        '3号GPT，我接一下你这段。你说听完1号和2号之后暂时不急着站边，然后打2号那句"谁急着借这个点收票我也会记"像是给自己留后手。你自己的结论呢。',
      ],
      [
        5,
        "3号GPT，我接你这句。你打2号那个动作我能听，但你自己也没站边，也没说你更疑谁，然后让4号先表态。",
      ],
      [
        6,
        '平安夜这点，我听明白了。你说3号GPT打2号那句"谁急着借这个点收票我也会记"像是留后手，然后转头问4号豆包哪边更想追问。',
      ],
      [
        7,
        '6号Gemini你接Mimo那句，我听进去了。3号GPT打2号那句"留后手"，然后转头问4号表态，这个顺序确实有点别扭。',
      ],
    ] as Array<[number, string]>) {
      v08State = applyCommand(v08State, { type: "speak", actorSeatId, message });
    }
    v08State.phase = "DAY_SPEECH";
    v08State.speechQueue = [8, 9];
    v08State.speechIndex = 0;
    const v08View = buildAgentView(v08State, 8);
    const v08Plan = createSpeechPlan(v08View);

    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        '平安夜这点，我听明白了，女巫大概率用了药。 我先接上一位Mimo的话。你说3号GPT打2号那句"谁急着借这个点收票我也会记"像是留后手，然后转头问4号豆包哪边更想追问——这个顺序我确实也记了。3号你自己的结论呢。',
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        '6号Gemini你接Mimo那句，我听进去了——3号GPT打2号那句"留后手"，然后转头问4号表态，这个顺序确实有点别扭。你最后还是没说你自己的判断，只说"记了"，这我先放着。 我转回2号Claude。你那句"谁急着借这个点收票我也会记"，后置位好几个位置都在打这个点，豆包、Mimo、Gemini都接上了。',
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        '7号GLM，你最后那段打3号GPT的点我听明白了——他确实没给你一个结论就抛问题出去，这个动作值得记。 但我想把镜头转一下。 从4号豆包开始，后面Mimo、Gemini、GLM连续四个人都在打2号Claude那句"谁急着借这个点收票我也会记"。问题是，4号豆包打这个点的时候，说的还是"你认同了用药又说要记带票的人，这两句放一起像是给自己留后手"——这个观察我能听，他至少给了一个具体的不舒服在哪。',
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        "我是8号Kimi。 6号Gemini这张查杀拍下来，我先认这个身份，因为目前没有对跳。但今天这条线我有个地方没听明白——7号GLM刚才说，回头看3号查杀前的发言，他没有急着站边或收票，反而在挑2号Claude的毛病。这个观察我听进去了，但我想顺着往回多看一步。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        "我是8号Kimi。7号GLM刚才说6号Gemini重点放在2号查杀前的发言听感上，切入点有点软，我认同这一点。但我这轮更想说回2号Claude——你刚才怼1号DeepSeek那段原话，逻辑是闭眼视角信息少，所以觉得1号画的框架太宽。现在3号GPT公开报你查杀，前置位4号豆包认了这个预言家、5号Mimo和7号GLM都在压你，你那段原话能撑住的只有",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        "我是8号Kimi。接上一位GLM，他刚才提到后置位连续在打3号GPT同一个缺口——查杀对跳但心路没交代清楚。这个结构确实被接住了，4号豆包、5号Mimo、6号Gemini、7号GLM都在往这个方向施压。 但我现在想转一下视线。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        '我是9号DeepSeek2。上一位Kimi说后置位连续打3号GPT同一个缺口，这个结构他接住了，我认同。但他最后那句"我现在想转一下视线"，我想追一句：你往哪转，为什么这个点够了可以放？ 回到3号GPT，他刚才那段原话我再过一遍。',
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        "5号发言。我接上一位豆包。他说1号那句话带节奏，这点我部分认同。但我更想说的是，1号那句“我先记他”背后藏着一个前提，他预设了会有人借死讯带票。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        v08View,
        v08Plan,
        "8号Kimi发言。6号倒牌，狼刀成功，女巫没救，这句过了。我接上一位7号GLM，他说转回2号Claude那句“留一个能回头验证的疑惑”，我听进去了，也确实没听懂。2号Claude，你那句话我记到现在。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是6号Gemini。前面信息我先暂放。我主要想说1号DeepSeek，1号只说先看谁借这个点带票，但没有落自己先怀疑谁，所以我这轮先压1号把判断说清。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是5号Mimo。4号豆包刚才问1号DeepSeek那句话我听懂了，但我现在想换个角度。我重新听1号DeepSeek的原话：'底牌不虚，但今天先不急着拍身份。' 这句话我现在越想越不对，所以我这轮先压1号把自己的票点落清楚。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude。1号DeepSeek，你刚才那段话我听着有点怪。你说“昨夜平安夜，女巫用药了”，又说“现在信息太少，暂时不站死任何一边”。所以我这轮先不跟你压别人，等你下一轮把票点落清楚。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是6号Gemini。5号Mimo刚才那段我听到了，他回看1号DeepSeek的点，这个方向我自己也有在想。但我想先换个位置看。3号GPT刚才那句话我没听明白的是，他说暂放2号，却没说自己信不信女巫身份，所以我这轮先不跟3号。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
  });

  it("keeps ordinary provider-error fallback away from repeated audit templates", async () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。7号倒牌，狼刀成功，女巫没救。我先看谁急着借死讯定方向。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我觉得1号一上来定框架有点刻意，但我先不直接归死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。2号打1号可以理解，但你自己也得给7号倒牌后的判断。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。我先点6号，后面别只复盘前面几个人，要说7号倒牌对你判断有没有影响。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-fallback-template-quality-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/我抓一个细节|我只抓一个点|我只接一个点|我给一个边界|结论给出来了|中间过程|没完全说透|刚才那句话我先记下来|接一下这条前后说法/);
    expect(result.speech).not.toMatch(/身份线|先留一处疑问|观察位|谁会硬给|票口|这轮我只听谁把怀疑落到具体人身上|几个点合起来看|信息量偏少|这段我先记一下|这段我听着|mimo-v/i);
    expect(result.speech).toMatch(/我|先|看|问|盯|暂放|投票/);
  });

  it("keeps ordinary provider-error fallback aligned with public death announcements", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，7号 死亡。",
      payload: { deadSeatIds: [7] },
    });
    state.speechQueue = [1, 2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-death-fallback-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).toMatch(/7号|死讯|狼刀成功|女巫没救/);
    expect(result.speech).not.toMatch(/平安夜|无人死亡|没人倒牌|轮到\d+号|后面我想听/);
  });

  it("keeps day-two ordinary provider-error fallback away from short repeated no-stance templates", async () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4, 5, 6, 8, 9];
    state.speechIndex = 0;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 2,
      phase: "DAY_ANNOUNCEMENT",
      message: "第2天清晨，1号倒牌。",
      payload: { deadSeatIds: [1] },
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。我直接压3号，他这轮没说清楚要打谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-d2-fallback-template-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/我先只接一层|这句话太短|没听出.{0,12}想压谁|票先不压太死|先不站死，今天先看大家票怎么落/);
    expect(result.speech).toMatch(/我|先|压|盯|暂放|看/);
  });

  it("keeps ordinary provider-error fallback from assigning generic future-seat homework", async () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。7号倒牌，狼刀成功，女巫没救。我先看谁借死讯带方向。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-future-homework-fallback-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/轮到\d+号|轮到[^。！？；]{0,20}(?:时|的时候)|后面我想听|说清你最想暂放或怀疑谁/);
  });

  it("keeps planned ordinary witch provider-error fallback on the saved target", async () => {
    const previousRetries = process.env.AI_LLM_MAX_RETRIES;
    process.env.AI_LLM_MAX_RETRIES = "0";
    try {
      const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
      state.day = 1;
      state.phase = "DAY_SPEECH";
      state.night.witchSavedSeatId = 4;
      state.speechQueue = [2];
      state.speechIndex = 0;
      const view = buildAgentView(state, 2);
      const basePlan = createSpeechPlan(view);
      const savedTarget = view.privateKnowledge.witch?.savedTarget;
      const provider = createConstrainedLlmSpeechProvider({
        providerId: "ordinary-witch-fallback-saved-target-test",
        render: async () => {
          throw new Error("provider failed");
        },
      });
      const plan: SpeechPlan = {
        ...basePlan,
        kind: "pressure",
        speechMove: "identity_claim",
        claimIntent: { claimedRole: "WITCH", strength: "hard" },
      };

      expect(view.myRole).toBe("WITCH");
      expect(savedTarget).toBeTruthy();

      const result = await provider.generateSpeech(view, plan);

      expect(result.isFallback).toBe(true);
      expect(result.speech).toMatch(/我是女巫|我拍女巫|女巫牌/);
      expect(result.speech).toContain(`${savedTarget!.seatId}号`);
      expect(result.speech).toMatch(/救了|救的是|银水/);
      expect(result.speech).not.toMatch(/不把药线讲死|不急着拍身份|我不复读了/);
    } finally {
      if (previousRetries === undefined) {
        delete process.env.AI_LLM_MAX_RETRIES;
      } else {
        process.env.AI_LLM_MAX_RETRIES = previousRetries;
      }
    }
  });

  it("rejects ordinary speeches that attack settled single-death common sense as agenda setting", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，7号 死亡。",
      payload: { deadSeatIds: [7] },
    });
    state.speechQueue = [1, 2, 3, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "7号倒牌，狼刀成功，女巫没用解药。我先看谁借死讯往下压。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek你上来就给死讯定性为狼刀成功、女巫没用解药，这不是带节奏是什么？",
        "guided",
      ),
    ).toContain("普通局不要把死亡常识打成带节奏");
  });

  it("rejects ordinary observation-slot transcript templates that park a seat for later chain review", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [1, "平安夜，女巫应该用药了。我是首置位，先看3号会不会带节奏。"],
      [2, "我是女巫，昨晚救的是4号，4号是银水。我先问1号为什么提前点3号。"],
      [3, "几个点合起来看，身份我先不跟着定。"],
      [4, "我接3号，你这句话停在半路，结论没有给出来。"],
      [5, "我觉得3号这段别扭，但先不投他。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我听了一圈，先把3号GPT放进观察位。刚才3号那段我卡的点和4号一样，他说几个点合起来看，但结论没给出来。1号首置位给了观察点没问题，但目前我主要看3号后面的人怎么接这条线。",
        "guided",
      ),
    ).toContain("普通局不要用观察位模板继续等后面接线");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我听了一圈，3号那段我和4号一样没听明白。他说几个点合起来看，但结论没给出来；目前我主要看3号后面的人怎么接这条线。",
        "guided",
      ),
    ).toContain("普通局当前位不要把已过的后置反应说成还要看");
  });

  it("naturalizes ordinary successful LLM speech away from 卡我 wording", async () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "平安夜先当背景。我现在只看谁急着借这个带票。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-card-me-naturalize-test",
      render: async () => ({
        providerId: "custom-speech:mimo-v2.5-pro",
        text: JSON.stringify({
          speech: "1号你刚才那句话有个地方卡我，我先不投你。今天我看你后面投票往哪落。",
        }),
      }),
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toContain("卡我");
    expect(result.speech).toContain("我没听明白");
  });

  it("rejects ordinary speeches that ask for a basis already stated by the prior speaker", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message:
        "平安夜，女巫应该用药了。我是首置位，没前置发言可以参考。我比较想看3号GPT的发言，3号这个位置靠前但又不是最前面，狼队如果要安排悍跳或者带节奏，这个位置挺舒服，能听完前面两三个发言再决定打什么方向。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号DeepSeek你那个观察点我听懂了，但有个地方我没听明白——你说狼队会从3号那个位置安排悍跳，这句话的依据是什么？我先不投你。",
        "guided",
      ),
    ).toContain("普通局不要重复追问已经给过的依据");
  });

  it("rejects ordinary speeches that say they changed read without giving the new read", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。7号倒牌，狼刀成功，女巫没救。我先看后面谁急着带方向。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。我觉得1号先立规矩再提死亡，前后有点怪。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号豆包你点1号那句话点得挺准，我也正卡这儿。所以1号，我改口了。",
        "guided",
      ),
    ).toContain("普通局改口必须说清新判断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是5号Mimo。听完前面四个人的发言，我先承认一个事：我原来对1号DeepSeek的判断可能要改口。1号刚才说“底牌不虚，但先不急着拍身份”，又说“现在信息太少，暂时不站死任何一边”。这句话乍一听挺稳，但我回头想，2号Claude已经明确跳女巫给了4号银水。",
        "guided",
      ),
    ).toContain("普通局改口必须说清新判断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是5号Mimo。听完前面四个人的发言，我对1号DeepSeek的判断可能要改口。1号我先不压了，今天改看3号是不是借银水给4号布置票口。",
        "guided",
      ),
    ).not.toContain("普通局改口必须说清新判断");
  });

  it("retries ordinary LLM speech that uses global review and stacked jargon", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先当背景，我会看谁顺手带节奏。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-player-mouth-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech: "我是2号Claude。从整个桌面复盘看，1号这段发言像桌面整体审计材料，今天我先按全场总结去压他。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "我是2号Claude。1号刚才把平安夜当背景，我没完全听明白的是后面谁在顺着这句话下结论；这轮我先盯这个反应。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局发言不要像全桌复盘");
    expect(retryInput?.stability?.repairInstructions?.join("\n")).toContain("改成普通玩家第一人称");
    expect(result.speech).not.toMatch(/全桌视角|发言链|闭合|收口|压力源|收益来源/);
  });

  it("gives specific retry instructions for ordinary visible audit surfaces", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。昨夜平安夜，女巫用药了。我先不站死谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-visible-audit-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech: "我是2号Claude。1号DeepSeek这是想提前给后面的人划一条线，看谁触线；我先不压死你。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "我是2号Claude。1号DeepSeek前半句我能听懂，但后面又说信息太少，我这轮先不跟着压别人。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局不要把内部审稿词说出口");
    expect(repairText).toContain("删掉");
    expect(repairText).toContain("这句话本身");
    expect(repairText).toContain("引用后必须补一句自己怎么处理");
  });

  it("gives specific retry instructions for ordinary unfinished named focus", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。昨夜平安夜，女巫用药了。我先不站死谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-unfinished-named-focus-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech: "我是3号GPT。前面信息先暂放。我主要想说1号DeepSeek。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "我是3号GPT。前面信息先暂放。我主要想说1号DeepSeek，1号没有落自己先怀疑谁，所以我这轮先不跟着他压后置位。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局发言疑似被截断");
    expect(repairText).toContain("点名后必须");
    expect(result.speech).toContain("所以我这轮");
  });

  it("repairs ordinary surface-only audit words before validation instead of falling back", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。昨夜平安夜，女巫用药了。我先不站死谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-surface-prevalidation-repair-test",
      render: async () =>
        JSON.stringify({
          speech: "我是3号GPT。1号DeepSeek这话本身我认，但你刚才说信息少，我听着有点卡；我先不压死你。",
        }),
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toMatch(/这话本身|有点卡|卡句式/);
    expect(result.speech).toContain("我先不压死你");
  });

  it("naturalizes ordinary review-register words from accepted LLM speech", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，女巫，昨晚救了9号，9号是银水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "我是6号Gemini。2号女巫我先认，但我还没想好票往哪放。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 6, 7, 8, 9];
    state.speechIndex = 2;
    const view = buildAgentView(state, 7);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-review-register-naturalize-test",
      render: async () =>
        JSON.stringify({
          speech:
            "我是7号GLM。2号Claude跳女巫报9号银水，目前没人对跳，我先认这个身份空间。6号刚才认了身份空间，但没说自己打算怎么用这个信息，所以我这轮先不跟着投6号。",
        }),
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toMatch(/身份空间|发言缺口|怎么用这个信息/);
    expect(result.speech).toMatch(/这个身份我先认下来|我先当真女巫听/);
    expect(result.speech).toMatch(/票准备往哪放|票往哪放/);
  });

  it("accepts ordinary speech when only soft quality guards remain after retries", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。平安夜我先当背景，暂时不站死谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-soft-quality-pass-through-test",
      render: async () => {
        attempts += 1;
        return JSON.stringify({
          speech:
            attempts === 1
              ? "我是3号GPT。我先卡1号这句，但不把票压死。"
              : "我是3号GPT。1号这句我听着卡，但我先不投他，后面谁借这个平安夜带票我再回头压。",
        });
      },
    });

    expect(validateRenderedSpeech(view, plan, "我是3号GPT。我先卡1号这句，但不把票压死。", "guided")).toContain(
      "普通局不要用卡句式口癖",
    );

    const result = await provider.generateSpeech(view, plan);

    expect(attempts).toBe(2);
    expect(result.isFallback).toBe(false);
    expect(result.validationErrors).toBeUndefined();
    expect(result.speech).toContain("后面谁借这个平安夜带票我再回头压");
  });

  it("gives specific retry instructions for unresolved ordinary read changes", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。昨夜平安夜，女巫用药了。我先不站死谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-read-change-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech:
              "我是5号Mimo。我原来对1号DeepSeek的判断可能要改口。1号刚才说“底牌不虚，但先不急着拍身份”。这句话乍一听挺稳。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "我是5号Mimo。我对1号DeepSeek的判断可能要改口。1号我先不压了，今天改看后面谁继续借平安夜带票。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局改口必须说清新判断");
    expect(repairText).toContain("改口后必须立刻说新判断");
    expect(repairText).toContain("不要只引用前置发言");
  });

  it("gives specific retry instructions for half-accept speeches without landing", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。平安夜先当背景，谁急着拿这个带票我再压。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude。我是女巫，昨晚救了4号，4号是银水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-half-accept-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech:
              "我先接2号Claude的视角——他跳女巫、报银水4号，这个身份线目前没人对跳，我先认一半，但不站死。我现在更在意的是4号豆包，2号给了他银水身份，但他自己还没开口。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech:
            "我先接2号Claude一半：女巫和银水身份我暂时认着；另一半我不全跟，因为4号还没发言。今天我先不压4号，等4号自己把票点落出来。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局认同一半必须说清落点");
    expect(repairText).toContain("认一半后必须说清三件事");
  });

  it("gives specific retry instructions for repeated same-axis pile-on", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。我这位置没东西，平安夜先当背景，谁借这个带票我再听。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我觉得1号只有观察点没有结论，这个发言缺口要先审。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我也回到1号这句话本身，观察条件没落下来。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。前面都在说1号，我继续看1号这句观察位怎么处理。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 5);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-repeated-axis-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech: "我还是审1号这个发言缺口。1号这话本身只是观察点，观察条件没有落，我继续先压1号。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "前面都在打1号，我这里先换一下。2号和3号都顺着同一句往下压，我先看谁只是跟票，没有新增理由。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("普通局不要连续围绕同一句做同质审计");
    expect(repairText).toContain("同一句已经被多人打过");
    expect(repairText).toContain("换动作或换焦点");
  });

  it("gives specific retry instructions for ordinary D1 first-check motive attacks", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 6, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，预言家，昨晚验了9号DeepSeek2，查杀。今天票先压9号，谁保9号就和我的结果对撞。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [6, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 6);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-first-check-motive-retry-test",
      render: async (input) => {
        attempts += 1;
        if (attempts === 1) {
          return JSON.stringify({
            speech: "我是6号Gemini。2号Claude报9号查杀，但他说不清为什么验9号，这个验人心路太轻，我先压2号。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "我是6号Gemini。2号Claude报9号查杀，我先把结果放桌上。9号还没发言，轮到他先正面接；后面有人对跳再一起看。",
        });
      },
    });

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是6号Gemini。2号Claude报9号查杀，但他说不清为什么验9号，这个验人心路太轻，我先压2号。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");

    const result = await provider.generateSpeech(view, plan);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";

    expect(result.isFallback).toBe(false);
    expect(attempts).toBe(2);
    expect(retryInput?.stability?.previousIssue).toContain("D1首验理由不是主要攻击点");
    expect(repairText).toContain("普通局D1首验理由修复");
    expect(repairText).toContain("查杀位怎么回应");
  });

  it("rejects ordinary non-opening speakers that call themselves the first speaker", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。平安夜女巫用药了，我先看后置位怎么接。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude。平安夜，女巫用药了，这个先放着。我首置位没什么前置发言可抓，先看后置位整体。",
        "guided",
      ),
    ).toContain("普通局非首发位不要自称首置位");
  });

  it("rejects ordinary low-info openings copied from a prior speaker", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是1号DeepSeek。平安夜，女巫用药了，这个先放着。我首置位没什么前置发言可抓，先看后置位整体：谁第一个借平安夜带节奏、谁回避第一个压力，我记着。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guideText = [
      input.playerSpeechGuide.tableTask?.line,
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
    ].join("\n");

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude。平安夜，女巫用药了，这个先放着。前面1号已经说了，我换个角度看后置位整体：谁第一个借平安夜带节奏、谁回避第一个压力，我记着。",
        "guided",
      ),
    ).toContain("普通局不要复刻前置位低信息开场");
    expect(guideText).toContain("前置位已经说过平安夜/女巫用药先放着");
    expect(guideText).toContain("不能再自称首置位");
  });

  it("keeps a fourth useful sentence from ordinary real LLM speech instead of truncating the turn early", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.seatId === 5) ?? state.seats.find((seat) => seat.isAi)!;
    state.speechQueue = [1, 2, 3, 4, speaker.seatId];
    state.speechIndex = 0;
    for (const seatId of [1, 2, 3, 4]) {
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: seatId,
        message: `${seatId}号发言，1号的观察点有点空，但我先不把话说死。`,
      });
      state.phase = "DAY_SPEECH";
    }
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-four-sentence-test",
      render: async () =>
        JSON.stringify({
          speech:
            "2号Claude女巫先认，4号银水先放下。1号的观察点确实太空，但前面三个人都在重复这一句。我的视角先看6号为什么跟压没新理由。今天如果要动票，我会先压跟风位，不把1号单点打死。",
        }),
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain("不把1号单点打死");
    expect(countSpeechSentences(result.speech)).toBeLessThanOrEqual(4);
  });

  it("adds ordinary persona strategy and live intent to speech input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi && seat.persona?.name === "Mimo") ?? state.seats.find((seat) => seat.isAi)!;
    const target = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    state.aiMemories = {
      [String(speaker.seatId)]: {
        seatId: speaker.seatId,
        day: 2,
        lastSpeechTargetSeatId: target.seatId,
        lastSpeechStance: `${target.seatId}号上一轮票型解释不完整`,
        beliefs: [],
      },
    };

    const view = buildAgentView(state, speaker.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [
      input.personaStrategyCard?.activeSummary,
      input.ordinaryLiveIntent ? JSON.stringify(input.ordinaryLiveIntent) : "",
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
    ].join("\n");

    expect(input.personaStrategyCard?.modelName).toBe(speaker.persona?.name);
    expect(input.personaStrategyCard?.activeSummary).toMatch(/公开|狼人|神职/);
    expect(input.ordinaryLiveIntent?.focusTarget?.seatId).toBe(target.seatId);
    expect(guideText).toContain("普通局临场意图");
    expect(guideText).toContain("本轮换一种推进动作");
    expect(guideText).toContain(`${target.seatId}号`);
    expect(guideText).not.toContain("只打一条公开切口");
    expect(guideText).not.toContain("发言只推进");
    expect(guideText).not.toContain("后续投票要接得上");
  });

  it("uses ordinary live intent when provider-error fallback speech is needed", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.isAi)!;
    const target = state.seats.find((seat) => seat.alive && seat.seatId !== speaker.seatId)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    state.aiMemories = {
      [String(speaker.seatId)]: {
        seatId: speaker.seatId,
        day: 2,
        lastSpeechTargetSeatId: target.seatId,
        lastSpeechStance: `${target.seatId}号上一轮发言和票型没接上`,
        beliefs: [],
      },
    };
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-live-intent-fallback-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain(`${target.seatId}号`);
    expect(result.speech).toMatch(/上一轮|公开|票型|发言|回验|验证/);
    expect(result.speech).not.toContain("我先按公开信息盘");
  });

  it("keeps ordinary provider-error fallback in ordinary player language", async () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先放一下，我会看谁接得太顺。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    view.publicSummary.recentDeaths = ["第1天清晨，昨夜平安夜。"];
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-player-mouth-fallback-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toMatch(/我|没听明白|先不站死|先看|先记|为什么/);
    expect(result.speech).not.toMatch(/全桌视角|先放观察位|话说满|发言链|闭合|收口|压力源|收益来源/);
  });

  it("keeps ordinary low-info provider-error fallback short enough for its own validator", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-low-info-fallback-self-validation-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.validationErrors ?? []).not.toContain("发言过于冗长或报告化");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).toEqual([]);
    expect(countSpeechSentences(result.speech)).toBeLessThanOrEqual(3);
    expect(result.speech).not.toMatch(/后面我看谁继续复读这个点|这轮我只听谁把怀疑落到具体人身上/);
  });

  it("keeps ordinary hard-claim fallback away from 卡 surface wording", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seats[3]!.role = "HUNTER";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const basePlan = createSpeechPlan(view);
    const plan: SpeechPlan = {
      ...basePlan,
      target: undefined,
      kind: "pressure",
      speechMove: "identity_claim",
      claimIntent: { claimedRole: "HUNTER", strength: "hard" },
    };

    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).toMatch(/猎人|枪|归票/);
    expect(result.speech).not.toMatch(/我卡这里|卡(?:一个点|一句|得|我|住|一下|的点)/);
  });

  it("keeps ordinary provider-error fallback from recycling the same peace-night suspicion across seats", async () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message:
        "1号发言。我把能听到的点摆一下。昨夜是平安夜，我先当背景，不拿这个直接定人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。平安夜我不复读了，我现在只卡1号一句话，先不把票压死。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-repeated-fallback-axis-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.validationErrors ?? []).toEqual([]);
    expect(result.speech).not.toContain("只说了平安夜，但没说自己怀疑谁");
    expect(result.speech).not.toMatch(/卡(?:一个点|一句|得|我|住|一下|的点)|这句话本身|规则点|判断动作/);
    expect(result.speech).not.toMatch(/把平安夜先放成背景，留下的是谁顺手带票|后面我看谁继续复读这个点|等他自己把立场落下来/);
    expect(result.speech).not.toMatch(/这段我先留一处疑问：[^。]+。[^。]*这段我先留疑问/);
  });

  it("keeps ordinary wolf seer-claim provider-error fallback on the planned check", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const target = state.seats.find((seat) => seat.role !== "WEREWOLF" && seat.seatId !== wolf.seatId)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [wolf.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, wolf.seatId);
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "claim-check",
      target: { seatId: target.seatId, name: target.name },
      speechMove: "claim_black_check",
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: { day: 1, claimantSeatId: wolf.seatId, targetSeatId: target.seatId, result: "WEREWOLF" },
      },
    };
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-wolf-seer-claim-fallback-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("我跳预言家");
    expect(result.speech).toContain(`${target.seatId}号`);
    expect(result.speech).toContain("查杀");
    expect(result.validationErrors ?? []).toEqual([]);
  });

  it("naturalizes successful ordinary LLM speech before validation", async () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: "第1天清晨，4号 死亡。",
      payload: { deadSeatIds: [4] },
    });
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-success-naturalize-test",
      render: async () =>
        JSON.stringify({
          speech:
            "我首置位先不铺全场。4号这个死亡形态按规则推就是狼刀成功女巫没救。信息边界先别乱讲，我先看2号会不会借这个死讯带方向。",
        }),
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain("把全场都盘一遍");
    expect(result.speech).toContain("这个死法");
    expect(result.speech).toContain("按我理解");
    expect(result.speech).toContain("能确定的事");
    expect(result.speech).not.toMatch(/死亡形态|按规则推|毒药重合刀口|反面可能性|信息边界|铺全场/);
  });

  it("keeps ordinary fallback away from report-like death and audit wording", async () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先放一下，我会看谁接得太顺。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。平安夜我不复读了，我把1号放观察位，看前后理由能不能接上。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-player-mouth-fallback-audit-test",
      render: async () => {
        throw new Error("provider failed");
      },
    });

    const result = await provider.generateSpeech(view, createSpeechPlan(view));

    expect(result.isFallback).toBe(true);
    expect(result.speech).not.toMatch(/死亡名单|不直接反推|真正的判断动作|放一起核|前后理由能不能接上/);
    expect(result.speech).not.toMatch(/全桌视角|发言链|闭合|收口|压力源|收益来源/);
  });

  it("prioritizes class-trial characters playing werewolf over werewolf-player templates", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const monokuma = state.seats.find((seat) => seat.seatId === 4)!;
    monokuma.name = "黑白熊";
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    state.speechQueue = [1, 2, 3, monokuma.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "苗木诚。我先按公开信息盘，前面没人给站边就先观察。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "雾切响子。1号没有站边也没有票口，这个疑点先放着。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "腐川冬子。我也觉得1号没给票口，今天先看这个缺口。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [monokuma.seatId];
    state.speechIndex = 0;

    const input = buildConstrainedSpeechInput(buildAgentView(state, monokuma.seatId), createSpeechPlan(buildAgentView(state, monokuma.seatId)), "guided");
    const guideText = [
      ...input.playerSpeechGuide.tablePlayerStyle,
      ...input.playerSpeechGuide.softInteraction,
      ...input.playerSpeechGuide.avoid,
    ].join("\n");

    expect(guideText).toContain("角色正在玩狼人杀");
    expect(guideText).toContain("不是狼人杀玩家套角色皮");
    expect(guideText).toContain("审判");
    expect(guideText).not.toContain("必须改写成身份收益、票型动机");
    expect(guideText).not.toContain("优先换成身份收益、票型动机");
  });

  it("rejects ordinary empty-template chains without blocking concrete pressure", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "我先按公开信息盘，这个疑点未解除，票口先放这里。", "guided")).toContain(
      "发言过于模板化",
    );
    expect(validateRenderedSpeech(view, plan, "2号刚才把平安夜说死成女巫用药，我先压这个过度确定；后置位只看谁顺手拿它收票。", "guided")).not.toContain(
      "发言过于模板化",
    );
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
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号目前我先认可，但需要你后面给一个公开处理方向。`, "loose")).toEqual(
      expect.arrayContaining([`要求已发言的${frontSeat.seatId}号后续补充发言`]),
    );
    expect(validateRenderedSpeech(view, plan, `${frontSeat.seatId}号身份先认，他给了一个具体信息点，我后面会看票型和发言再验证。`, "loose")).toEqual(
      [],
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
    state.seats[0]!.name = "苗木诚";
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
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。我更想先听1号自己把这个收票方向补完，不然你刚才只是把话留给后面。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。1号你自己转过来之后呢，我没听懂你想往哪走。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。1号你自己的票口准备往哪放，这个我现在看不出来。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。苗木诚，轮到你的时候，只说你打算让这条查杀怎么被全桌验证就好。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。1号苗木诚，你首置位直接跳预言家报3号查杀，话很短。我暂时认你这个身份声明，但有一条需要你后续补上的前提：你今天打算怎么处理3号。",
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

  it("does not treat negated witch-boundary criticism as a witch claim attribution", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [10, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 10,
      message: "女巫牌先不急着跳。保留底牌威慑和挡刀空间，不把软身份边界说成明确拍身份。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "10号Claude2刚才那句话我听着有点拧，你像在替女巫划边界，但你又没有拍自己是女巫，我只看你后面怎么落票。",
        "guided",
      ),
    ).not.toEqual(expect.arrayContaining(["把10号的女巫用药表述错当女巫声明"]));
  });

  it("keeps a concise public witch save report visible as a real witch claim for later speakers", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，女巫。平安夜我救了4号豆包，4号是银水。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(view.publicSummary.claimBoard).toEqual(
      expect.arrayContaining([expect.objectContaining({ claimant: expect.objectContaining({ seatId: 2 }), claimedRole: "WITCH" })]),
    );
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号发言。2号Claude的女巫声明目前没人对跳，我先认，但4号银水还需要用发言把身份线闭合。",
        "guided",
      ),
    ).not.toEqual(expect.arrayContaining(["把2号的女巫用药表述错当女巫声明", "把未公开身份的2号说成女巫声明者"]));
  });

  it("allows the current speaker to hard claim witch with a saved target", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude，女巫牌。平安夜是我救的，救了4号豆包。拍身份是因为第一天信息少，想先收住票型。",
        "guided",
      ),
    ).not.toEqual(expect.arrayContaining(["把2号的女巫用药表述错当女巫声明"]));
  });

  it("does not attribute another player's recognized witch claim to the reviewer", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，女巫，昨晚救了4号豆包。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号GPT发言。2号Claude刚才跳了女巫，我先认这个身份。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [4];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。3号GPT刚才说认可2号Claude的女巫身份，这只是他在认2号的声明，不是3号自己跳女巫。",
        "guided",
      ),
    ).not.toEqual(expect.arrayContaining(["把3号的女巫用药表述错当女巫声明"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。3号GPT刚才说认女巫身份空间，但后面又追问女巫为什么救人；我只评价他的认身份幅度，不是说3号自己跳女巫。",
        "guided",
      ),
    ).not.toEqual(expect.arrayContaining(["把3号的女巫用药表述错当女巫声明"]));
  });

  it("rejects a non-witch accepting a misattributed self witch identity", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.seats[2]!.role = "VILLAGER";
    state.speechQueue = [2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "5号倒牌，狼刀成功，女巫没救。我是女巫，今天按公开证据走。上一轮你认了我的身份。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude，你点到我，我先接一下。你说我是女巫，这个身份我认。但你说先把票口收到3号这里，我没听明白。",
        "guided",
      ),
    ).toContain("发言误认自己是女巫身份");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude这个女巫身份我先认，但你说要把票口收到3号这里，我需要你把理由讲清楚。",
        "guided",
      ),
    ).not.toContain("发言误认自己是女巫身份");
  });

  it("rejects attributing a fabricated public check result to another claimant", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 7];
    state.speechIndex = 0;
    state.seats[1]!.role = "WITCH";
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，女巫。药线情况我先不展开，今天先看3号怎么接票口。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7];
    state.speechIndex = 0;
    const view = buildAgentView(state, 7);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude报了女巫，还给了5号Mimo查杀，这条线我先按查验压力看。",
        "guided",
      ),
    ).toContain("凭空引用未公开查验结果");

    state.roleClaims.push({
      id: "3:SEER",
      day: 2,
      claimantSeatId: 3,
      claimedRole: "SEER",
      strength: "hard",
      checks: [{ day: 2, claimantSeatId: 3, targetSeatId: 5, result: "WEREWOLF" }],
      message: "我是3号GPT，预言家，5号Mimo查杀。",
    });
    const viewWithCheck = buildAgentView(state, 7);
    const planWithCheck = createSpeechPlan(viewWithCheck);
    expect(
      validateRenderedSpeech(
        viewWithCheck,
        planWithCheck,
        "3号GPT报了5号Mimo查杀，这个公开查验我先接住，但今天还要听5号怎么回应。",
        "guided",
      ),
    ).not.toContain("凭空引用未公开查验结果");
  });

  it("accepts grounded public check attribution when a target name ends with a digit in speech", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.roleClaims.push({
      id: "8:SEER",
      day: 2,
      claimantSeatId: 8,
      claimedRole: "SEER",
      strength: "hard",
      checks: [{ day: 2, claimantSeatId: 8, targetSeatId: 9, result: "WEREWOLF" }],
      message: "我是8号Kimi，预言家，9号DeepSeek2查杀。",
    });
    state.speechQueue = [1];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号Kimi报了DeepSeek2查杀，这个公开查验我先接住，今天先听9号怎么回应。",
        "guided",
      ),
    ).not.toContain("凭空引用未公开查验结果");
  });

  it("does not cross-read witch silver water and a seer black check as fabricated public checks", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seats[9]!.role = "WITCH";
    state.roleClaims.push({
      id: "2:SEER",
      day: 1,
      claimantSeatId: 2,
      claimedRole: "SEER",
      strength: "hard",
      checks: [{ day: 1, claimantSeatId: 2, targetSeatId: 9, result: "WEREWOLF" }],
      message: "我是2号Claude，预言家，9号DeepSeek2查杀。",
    });
    state.speechQueue = [10];
    state.speechIndex = 0;
    const view = buildAgentView(state, 10);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是女巫，昨夜救的是2号Claude，银水。今天2号Claude跳预言家报9号DeepSeek2查杀，这条线我先认下。",
        "guided",
      ),
    ).not.toContain("凭空引用未公开查验结果");
  });

  it("allows generic counterclaim status after a public seer check", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "我是2号Claude，预言家，昨晚验了8号Kimi，8号是查杀。今天票口先压8号。",
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
        "2号Claude跳预言家报8号Kimi查杀，这条线我暂时认下，因为到现在没人对跳预言家。",
        "guided",
      ),
    ).not.toContain("报查验结果等同预言家声明，不能追问是否跳预言家");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude给出8号Kimi查杀，我先把结果放桌面，今天看有没有对跳和8号怎么正面接。",
        "guided",
      ),
    ).not.toContain("报查验结果等同预言家声明，不能追问是否跳预言家");
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

    expect(briefing).toContain("平安夜只作背景");
    expect(briefing).toContain("女巫用了救药");
    expect(briefing).not.toMatch(/救药\/解药|女巫没救\/没用解药|女巫没救或者没用解药/);
    expect(briefing).toContain("游戏动作");
    expect(briefing).not.toMatch(/空刀概率极其小|近似忽略|实战上可以近似忽略/);
    expect(input.tableBriefing.legalSpeechFocus.join("\n")).toContain("当下处理");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("默认不点名任何后置位");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("不要求下一位或远后置位立刻站边");
    expect(input.playerSpeechGuide.tablePlayerStyle.join("\n")).toContain("低信息首轮不用强行站边或落票口");
  });

  it("rejects ordinary peace-night speeches that hallucinate a dead seat", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
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
    state.speechQueue = [4, 5, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 4);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "4号发言。7号倒牌，狼刀成功女巫没救，这句过了。我先看2号和3号都在递问题。",
        "guided",
      ),
    ).toContain("平安夜不能凭空报夜死");
  });

  it("rejects ordinary speeches that invent night deaths after prior speakers framed peace night", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。昨夜是平安夜，我先当背景，不拿这个直接定人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号只说了平安夜，但没说自己怀疑谁。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "7号走的，狼刀成功女巫没救，一句话带过。我先亮身份，我是猎人。",
        "guided",
      ),
    ).toContain("平安夜不能凭空报夜死");
  });

  it("rejects ordinary speeches that invent night deaths without a public death announcement", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "7号走的，狼刀成功女巫没救，一句话带过。我先亮身份，我是猎人。",
        "guided",
      ),
    ).toContain("没有公开死讯不能报夜死");
  });

  it("does not treat a later public death as invented because an earlier day was peaceful", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 12, humanSeatId: null });
    state.day = 2;
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
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 2,
      phase: "DAY_ANNOUNCEMENT",
      message: "第2天清晨，1号倒牌。",
      payload: { deadSeatIds: [1] },
    });
    state.speechQueue = [2, 3, 4, 5, 6, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    const errors = validateRenderedSpeech(
      view,
      plan,
      "1号倒牌，狼刀成功女巫没救，这句我先当公开背景。今天我先压4号豆包昨天那段跟票理由。",
      "guided",
    );

    expect(errors).not.toContain("平安夜不能凭空报夜死");
    expect(errors).not.toContain("没有公开死讯不能报夜死");
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

  it("rejects stale last-night wording when a witch repeats a prior save claim on day two", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
    const witch = state.seats.find((seat) => seat.alive && seat.role === "WITCH")!;
    const saved = state.seats.find((seat) => seat.alive && seat.seatId !== witch.seatId)!;
    const victim = state.seats.find((seat) => seat.alive && seat.seatId !== witch.seatId && seat.seatId !== saved.seatId)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;
    const claimedState = applyCommand(state, {
      type: "speak",
      actorSeatId: witch.seatId,
      message: `我是女巫，昨晚救的是${saved.seatId}号，${saved.seatId}号是银水。`,
    });
    claimedState.day = 2;
    claimedState.phase = "DAY_SPEECH";
    claimedState.speechQueue = [witch.seatId];
    claimedState.speechIndex = 0;
    claimedState.night = { wolfTargetSeatId: victim.seatId };
    claimedState.witch.antidoteAvailable = false;
    claimedState.witch.poisonAvailable = true;
    claimedState.events.push({
      seq: claimedState.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 2,
      phase: "DAY_ANNOUNCEMENT",
      message: `第2天清晨，昨夜${victim.seatId}号倒牌。`,
      payload: { deadSeatIds: [victim.seatId] },
    });
    const view = buildAgentView(claimedState, witch.seatId);
    const plan = {
      ...createSpeechPlan(view),
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

    expect(validateRenderedSpeech(view, plan, `我是女巫，昨晚救的是${saved.seatId}号，${saved.seatId}号是银水。`, "guided")).toContain(
      "女巫旧救人信息不要说成昨晚救人",
    );
    expect(validateRenderedSpeech(view, plan, `我是女巫，首夜救的是${saved.seatId}号，${saved.seatId}号是银水。`, "guided")).not.toContain(
      "女巫旧救人信息不要说成昨晚救人",
    );
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

  it("class-trial low-info first-speaker fallback does not pressure an unspoken next seat", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const state = createGame({ seed: 91, humanSeatId: null });
    const naegi = state.seats.find((seat) => seat.seatId === 1)!;
    const kirigiri = state.seats.find((seat) => seat.seatId === 2)!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, naegi.seatId);
    const plan = {
      ...createSpeechPlan(view),
      target: kirigiri,
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
    expect(result.speech).not.toContain("2号雾切");
    expect(result.speech).toContain("希望");
    expect(result.speech).toContain("共同验证");
    expect(result.speech).not.toContain("信息少");
    expect(result.speech).not.toContain("借平安夜催票");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).not.toContain("提前评价未发言的2号站边或可信度");
  });

  it("class-trial low-info Fukawa fallback keeps Togami as the public emotion coordinate", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ seed: 91, humanSeatId: null });
    const namesBySeat = new Map<number, readonly [string, string]>([
      [1, ["naegi", "苗木诚"]],
      [2, ["kirigiri", "雾切响子"]],
      [3, ["fukawa", "腐川冬子"]],
      [7, ["togami", "十神白夜"]],
    ]);
    for (const seat of state.seats) {
      const fixture = namesBySeat.get(seat.seatId);
      if (!fixture) continue;
      seat.name = fixture[1];
      seat.roleCard = roleCardFixture(fixture[0], fixture[1]);
    }
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我们先留一个共同验证点，看谁借平安夜急着收票。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "可验证部分只有平安夜，空白部分是还没有共同核对点。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => {
        throw new Error("provider down");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("十神");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).not.toContain("腐川低信息开局缺少十神情绪坐标");
  });

  it("does not force Fukawa validation fallback to Togami after an unrelated hard-info turn", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    let state = createGame({ seed: 91, humanSeatId: null });
    const namesBySeat = new Map<number, readonly [string, string]>([
      [1, ["naegi", "苗木诚"]],
      [2, ["kirigiri", "雾切响子"]],
      [3, ["fukawa", "腐川冬子"]],
      [7, ["togami", "十神白夜"]],
    ]);
    for (const seat of state.seats) {
      const fixture = namesBySeat.get(seat.seatId);
      if (!fixture) continue;
      seat.name = fixture[1];
      seat.roleCard = roleCardFixture(fixture[0], fixture[1]);
    }
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "平安夜先留一个共同验证点，别急着收票。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "猎人的枪就在这里；谁把票往我身上推，先把公开理由说完整。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () =>
        JSON.stringify({
          speech: "雾切响子刚才把枪牌往桌上一放，我不吃这套；她把压力推回别人身上，这个动作我先记住。",
        }),
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toContain("十神");
    expect(result.speech).not.toContain("提到身份相关词");
    expect(result.speech).not.toContain("公开形态");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).not.toContain("腐川发言缺少十神情绪坐标");
  });

  it("keeps Togami low-info fallback in character instead of saying low-info jargon", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const state = createGame({ seed: 91, humanSeatId: null });
    const togami = state.seats.find((seat) => seat.seatId === 7)!;
    togami.name = "十神白夜";
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7];
    state.speechIndex = 0;
    const view = buildAgentView(state, 7);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => {
        throw new Error("provider down");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("合格线");
    expect(result.speech).not.toContain("低信息");
    expect(result.speech).not.toContain("站边");
    expect(result.speech).not.toContain("票口");
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

  it("rejects trust or vote labels on class-trial seats that have not spoken yet", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 97, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state.seats[0]!.name = "苗木诚";
    state.seats[0]!.roleCard = roleCardFixture("naegi", "苗木诚");
    state.seats[1]!.name = "雾切响子";
    state.seats[1]!.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.seats[2]!.name = "腐川冬子";
    state.seats[2]!.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.seats[8]!.name = "千早爱音";
    state.seats[8]!.roleCard = roleCardFixture("anon", "千早爱音");
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先按女巫用药处理，我只留一个观察点，看谁借这个背景收票。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。1号没有把观察点落到具体收益位，我先记这个断点，等发言链拉长再回看。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;

    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guidance = [...input.speechContract.mustNotAsk, ...input.playerSpeechGuide.avoid].join("\n");

    expect(guidance).not.toContain("未发言后置位");
    expect(guidance).not.toContain("更信");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号发言。2号这个断点我先记下，但我暂时更信9号，所以焦点先放回1号身上。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["提前评价未发言的9号站边或可信度"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号发言。2号这个断点我先记下，9号轮到你时只接一个具体问题：谁借平安夜收票。",
        "guided",
      ),
    ).not.toContain("提前评价未发言的9号站边或可信度");
  });

  it("rejects direct process demands to a class-trial seat that already spoke", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 97, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state.seats[0]!.name = "苗木诚";
    state.seats[0]!.roleCard = roleCardFixture("naegi", "苗木诚");
    state.seats[1]!.name = "雾切响子";
    state.seats[1]!.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜先按女巫用药处理，我看谁借这个背景收票。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;

    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。1号苗木诚只提平安夜，没有说身份方向；你这一轮给过程，不要只给结论。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["要求已发言的1号后续补充发言"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号发言。1号苗木诚只提平安夜，我只能回看他已经说出口的观察点，先看后置谁借这个背景收票。",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
  });

  it("allows reviewing a previous-day speech from a target who has not spoken today", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.seatId === 2)!;
    const target = state.seats.find((seat) => seat.seatId === 4)!;
    const checked = state.seats.find((seat) => seat.seatId === 1)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [target.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: target.seatId,
      message: `4号发言。我打3号是因为他回避站边，票型先压过去。我跳预言家，${checked.seatId}号是查杀。`,
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
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `4号报${checked.seatId}号查杀，这条线我先看今天怎么站边，不急着只听一个结论。`,
        "guided",
      ),
    ).not.toContain("把本轮未发言的4号当成已发言评价");
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

  it("allows quoting a public first-night witch save phrased as saved", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    const witch = state.seats.find((seat) => seat.role === "WITCH")!;
    const speaker = state.seats.find((seat) => seat.role === "VILLAGER" && seat.seatId !== witch.seatId)!;
    witch.name = "雾切响子";
    speaker.name = "江之岛盾子";
    witch.roleCard = roleCardFixture("kirigiri", "雾切响子");
    speaker.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId, speaker.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: witch.seatId,
      message: "我是女巫，第一夜救的3号。",
    });
    state.speechIndex = 1;

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(view, plan, "雾切响子，你说你是女巫，第一夜救了3号。现在苗木诚死了，这条救人声明我要接着审。", "guided"),
    ).not.toContain("发言泄露或编造女巫用药细节");
    expect(validateRenderedSpeech(view, plan, "雾切响子，你说你是女巫，第一夜救了4号。", "guided")).toContain(
      "发言泄露或编造女巫用药细节",
    );
  });

  it("accepts discussion of a class-trial dramatic witch claim recorded on claim board", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const witch = state.seats.find((seat) => seat.isAi)!;
    witch.name = "塞蕾丝缇雅";
    witch.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;
    state.roleClaims = [
      {
        id: `${witch.seatId}:WITCH`,
        day: 1,
        claimantSeatId: witch.seatId,
        claimedRole: "WITCH",
        strength: "hard",
        checks: [],
        message: "女巫在这里。药还握在我手上。",
      },
    ];

    const view = buildAgentView(state, witch.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${witch.seatId}号已经明牌女巫，这条身份线我先接住。`, "guided")).toEqual([]);
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
    hunter.name = "十神白夜";
    hunter.roleCard = roleCardFixture("togami", "十神白夜");
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
    expect(input.speechContract.mustSay.join("\n")).toContain("我拍猎人，枪在这里。");
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
    expect(input.speechContract.maxSentences).toBe(4);
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
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
    expect(input.privateContext.seerChecks?.[0]?.target.seatId).toBe(wolf.seatId);
    const contractText = [
      ...input.speechContract.mustSay,
      ...input.speechContract.mustNotAsk,
      input.speechContract.voteBoundary ?? "",
    ].join("\n");
    expect(contractText).toContain("预言家");
    expect(contractText).toContain(`${wolf.seatId}号腐川冬子`);
    expect(contractText).toContain("公开和我的结果对撞");
    expect(input.constraints).toBeUndefined();
    expect(constraints).toBe("");
  });

  it("hides class-trial decision and audit scripts from the initial LLM speech input", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 340, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);

    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const nonContractVisible = JSON.stringify(
      {
        tableBriefing: input.tableBriefing,
        characterLens: input.characterLens,
        expertStrategy: input.expertStrategy,
        advancedReasoning: input.advancedReasoning,
        inferenceLayers: input.inferenceLayers,
        reasoningFrame: input.reasoningFrame,
        rolePlaybook: input.rolePlaybook,
        claimAudit: input.claimAudit,
        debateAgenda: input.debateAgenda,
        playerSpeechGuide: input.playerSpeechGuide,
        speechPlan: input.speechPlan,
        constraints: input.constraints,
      },
      null,
      2,
    );

    expect(input.speechContract.move).toBe("claim_black_check");
    expect(input.speechContract.target?.seatId).toBe(wolf.seatId);
    expect(input.privateContext.seerChecks?.[0]?.target.seatId).toBe(wolf.seatId);
    expect(input.speechContract.mustSay.join("\n")).toContain("预言家");
    expect(input.speechContract.mustSay.join("\n")).toContain(`${wolf.seatId}号腐川冬子`);
    expect(input.speechContract.mayAsk.join("\n")).toContain("公开和我的结果对撞");
    expect(input.speechContract.voteBoundary).toContain(`${wolf.seatId}号腐川冬子`);
    expect(input.playerSpeechGuide.tableTask).toBeUndefined();
    expect(input.playerSpeechGuide.softInteraction.join("\n")).not.toMatch(/桌面任务|可选接话素材|可选打法重心|今天我的票先压|公开和我的结果对撞/);
    expect(input.speechPlan).toBeUndefined();
    expect(input.constraints).toBeUndefined();
    expect(input.expertStrategy).toEqual([]);
    expect(input.advancedReasoning).toEqual([]);
    expect(input.inferenceLayers).toEqual({ facts: [], highProbability: [], lowProbability: [], privateUnknowns: [] });
    expect(input.reasoningFrame).toEqual({
      hardEvidence: [],
      softSignals: [],
      counterHypotheses: [],
      validationQuestions: [],
      persuasionGoals: [],
    });
    expect(input.rolePlaybook.tacticalVariants).toEqual([]);
    expect(input.claimAudit.followupTests).toEqual([]);
    expect(input.debateAgenda.crossExamination).toEqual([]);
    expect(nonContractVisible).not.toMatch(
      /自证|改票|首验理由|审计|票口边界|可商量观察|降温|不改变我这条结果|SpeechPlan interaction contract/,
    );
  });

  it("uses expanded class-trial hard-info limits for real seer black checks", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 240, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.name = "腐川冬子";
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);

    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const guide = [...input.playerSpeechGuide.tablePlayerStyle, ...(input.constraints ?? [])].join("\n");

    expect(input.speechContract.move).toBe("claim_black_check");
    expect(input.speechContract.maxSentences).toBeGreaterThan(3);
    expect(input.speechContract.maxChars).toBeGreaterThan(260);
    expect(input.privateContext.seerChecks?.[0]?.target.seatId).toBe(wolf.seatId);
    const contractText = [
      ...input.speechContract.mustSay,
      ...input.speechContract.mustNotAsk,
      input.speechContract.voteBoundary ?? "",
    ].join("\n");
    expect(contractText).toContain("预言家");
    expect(contractText).toContain(`${wolf.seatId}号腐川冬子`);
    expect(contractText).toContain("公开和我的结果对撞");
    expect(input.constraints).toBeUndefined();
    expect(guide).not.toContain("今天我的票先压");
    expect(guide).not.toContain("公开和我的结果对撞");
    expect(guide).not.toContain("票口边界");
    expect(guide).not.toContain("验人理由");
    expect(guide).not.toContain("轻放");
    expect(guide).not.toContain("不要要求预言家解释首验理由");
    expect(guide).not.toContain("最多3句、260字以内");
  });

  it("does not route class-trial seer black-check fallback through low-info opening speech", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 260, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () => {
        throw new Error("provider down");
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(true);
    expect(result.speech).toContain("预言家");
    expect(result.speech).toContain(`${wolf.seatId}号`);
    expect(result.speech).toContain("查杀");
    expect(result.speech).toContain("昨晚查验结果");
    expect(result.speech).toContain("我的票先压这里");
    expect(result.speech).not.toMatch(/降温|观望|可商量观察|不改变我这条结果/);
    expect(result.speech).not.toContain("票口边界");
    expect(result.speech).not.toContain("外置硬身份反证");
    expect(result.speech).not.toContain("今天边界");
    expect(result.speech).not.toContain("选验");
    expect(result.speech).not.toContain("平安夜还没把答案交出来");
    expect(validateRenderedSpeech(view, plan, result.speech, "guided")).toEqual([]);
  });

  it("keeps class-trial hard-info black-check speeches from being normalized back to low-info length", async () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 270, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async () =>
        JSON.stringify({
          speech: `我是1号苗木诚。我跳预言家，昨晚查验了${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。今天我的票先压${wolf.seatId}号；谁要保她，就公开和我的结果对撞。`,
        }),
    });

    const result = await provider.generateSpeech(view, plan);

    expect(result.isFallback).toBe(false);
    expect(result.speech).not.toContain("选她验的理由");
    expect(result.speech).toContain("今天我的票先压");
    expect(result.speech).toContain("公开和我的结果对撞");
    expect(result.speech).not.toMatch(/降温|观望|可商量观察|不改变我这条结果/);
    expect(result.speech).not.toContain("更硬的身份信息");
  });

  it("passes contract repair instructions on a validation retry", async () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 210, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
        expect(input.stability?.speechContract?.target?.seatId).toBe(wolf.seatId);
        const repairText = input.stability?.repairInstructions?.join("\n") ?? "";
        expect(repairText).toContain("speechContract.move=claim_black_check");
        expect(repairText).toContain("删除内部审计词");
        expect(repairText).not.toContain("票口边界：");
        return JSON.stringify({
          speech: `我是苗木诚。我跳预言家，昨晚查验了${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。今天我的票先压${wolf.seatId}号；谁要保她，就公开和我的结果对撞。`,
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(attempts).toBe(2);
    expect(result.isFallback).toBe(false);
    expect(result.speech).toContain(`${wolf.seatId}号腐川冬子`);
    expect(result.speech).toContain(`${wolf.seatId}号是查杀`);
    expect(result.speech).not.toContain("外置硬身份反证");
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

    expect(result.speech).toMatch(new RegExp(`${gold.seatId}号[^。！？；，、]{0,18}(金水|不进票口|票先看外面|别从)`));
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

  it("keeps bounded mock transcripts from repeating the same previous-speaker bridge", async () => {
    const { aiLogs } = await advanceWithMockAi(createGame({ seed: 91, humanSeatId: null }), {
      ignoreHuman: true,
      maxSteps: 200,
    });
    const speeches = aiLogs
      .filter((log) => log.output.type === "speak" || log.output.type === "sheriffSpeech")
      .slice(0, 15)
      .map((log) => ("message" in log.output ? log.output.message : ""));
    const quoteCarryCount = speeches.filter((speech) =>
      /(?:上一位|我先接|我接一下|我听到|听进来|这句话我接|这点我接|刚才那段|刚才(?:的)?(?:判断|方向|发言|表态)|前面(?:一句|发言|说法)|接住[^。！？；]{0,10}这一段)/.test(speech),
    ).length;

    expect(speeches.length).toBeGreaterThanOrEqual(9);
    expect(speeches.join("\n")).not.toMatch(/(?:刚才给了一个方向|拿后面的票和回应对照|这轮我会把票型往)/);
    expect(speeches.join("\n")).not.toMatch(/(?:公开线索是|后续发言者|我没听明白的是)/);
    expect(speeches.join("\n")).not.toMatch(/(?:不靠一句话定人我|有反证我会改\d+号|因为\d+号[^。！？；]{0,20}我先暂放)/);
    expect((speeches.join("\n").match(/但我这轮要转回\d+号哪里没说清/g) ?? []).length).toBeLessThanOrEqual(2);
    expect((speeches.join("\n").match(/的说法先只当背景，不靠一句话定人/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((speeches.join("\n").match(/桌面压力落到/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((speeches.join("\n").match(/个参考，我还要看票和回应/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(speeches.join("\n")).not.toMatch(/(?:回应我保留|(?:下结论|照搬|直接定人)(?:我|\d+号))/);
    expect(speeches.join("\n")).not.toMatch(/不把直接打死/);
    expect(speeches.join("\n")).not.toMatch(/公开(?:动作|问题|过程|点|理由)|发言动作|闭合/);
    expect((speeches.join("\n").match(/打回\d+号(?:DeepSeek|Claude|Gemini|Kimi|Mimo|GPT|GLM|Human|豆包)?不是情绪牌，我只看他说过的话和怎么落票/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((speeches.join("\n").match(/回看他已发言的表态和票口：哪句话能撑住这条线，哪句话会把它拆掉/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((speeches.join("\n").match(/我接一下上一位[^，。！？；]+，他这段发言还缺把结论推出来的过程/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((speeches.join("\n").match(/被Claude施压、回避站边，另外他前面有回避站边的记录/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((speeches.join("\n").match(/这会儿被推到台前，主要卡在/g) ?? []).length).toBeLessThanOrEqual(1);
    for (const speech of speeches) {
      expect((speech.match(/1号DeepSeek/g) ?? []).length).toBeLessThanOrEqual(3);
    }
    expect(quoteCarryCount / speeches.length).toBeLessThan(0.7);
  });

  it("naturalizes numbered 12p speech-influence cues before briefing and mock speech", async () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.seatId === 1)!;
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const actor = { seatId: 3, name: "GPT" };
    const target = { seatId: 9, name: "DeepSeek2" };
    const followup = { seatId: 10, name: "Claude2" };
    const cue: PublicReasoningCue = {
      cueId: "speech-influence:41:9:pressure",
      day: 1,
      kind: "speech_influence",
      weight: "strong",
      summary: "GPT对DeepSeek2的压力被3名后续发言者接住",
      actor,
      target,
      evidence: ["Claude2后续继续施压DeepSeek2"],
    };
    view.publicSummary.tableMemory.reasoningCues = [cue];
    view.publicSummary.tableMemory.speechInfluence = [
      {
        sourceSpeechSeq: 41,
        day: 1,
        speaker: actor,
        target,
        direction: "pressure",
        summary: cue.summary,
        followupActors: [followup],
        followupCount: 1,
      },
    ];
    const plan: SpeechPlan = {
      ...createSpeechPlan(view),
      kind: "pressure",
      target,
      talkingPoints: ["9号这条线前后有人跟进"],
    };

    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const result = await mockSpeechProvider.generateSpeech(view, plan);

    expect(input.tableBriefing.text).toContain("9号DeepSeek2有压力链");
    expect(input.tableBriefing.text).not.toMatch(/压力被\d+名后续发言者接住|后续继续施压/);
    expect(result.speech).not.toMatch(/压力被\d+名(?:后续发言者|后面的人)接住|后续继续施压/);
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
    expect(wolfAssignment!.nightInstruction).toContain("夜间计划不能直接说出口");
    expect(wolfAssignment!.nightInstruction).not.toMatch(/狼队首夜|狼队视角|制造分歧/);
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

  it("briefs day-one single death as public death-shape reasoning without banning inferred potion lines", () => {
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

    expect(briefingText).toMatch(/首夜单死.*狼刀成功.*女巫没救/);
    expect(briefingText).toContain("怀疑、暂放、追问或投票条件");
    expect(briefingText).not.toMatch(/女巫没救.*合理简称/);
    expect(briefingText).toMatch(/有夜死|死亡名单/);
    expect(briefingText).not.toMatch(/不能确认女巫用药|不要确认女巫用药|不能说成确定事实/);
    expect(briefingText).not.toMatch(/平安夜直接按公开死亡形态处理/);
    expect(briefingText).not.toMatch(/发言里短句说“女巫用药了”即可|平安夜只需短句带过：可以说“女巫用药了”/);
    expect(briefingText).toMatch(/空刀.*不作为|空刀只作为边界/);
    expect(briefingText).toMatch(/非女巫.*女巫是谁.*具体救了几号/);
    expect(briefingText).toMatch(/不要展开药线、刀口或毒口规则课/);
    expect(briefingText).not.toMatch(/刀口.*毒口.*公开死亡形态|公开死亡形态.*刀口.*毒口|不能擅自说成确定的具体刀口、毒口/);
    expect(briefingText).toMatch(/真女巫.*真实救毒信息/);
    expect(briefingText).not.toMatch(/药瓶状态.*公开死亡形态|公开死亡形态.*药瓶状态/);
    expect(briefingText).not.toContain("狼人不能空刀");
    expect(briefingText).toContain("死亡形态本身是公开信息");

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，按本局狼必刀和女巫三选一来推，刀口就在${deadSeat.seatId}号，女巫没救下来。`,
      ),
    ).toContain("普通局死亡形态不要展开规则课");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，我倾向女巫没用药；如果她毒重了刀口，公开结果也可能只有这一个死，这点明天再校验。`,
      ),
    ).toContain("普通局死亡形态不要展开规则课");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，如果女巫毒重刀口，毒口也可能是${deadSeat.seatId}号；我只按公开结果留这个边界。`,
      ),
    ).toContain("普通局死亡形态不要展开规则课");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，我只当狼刀成功、女巫没救。今天真正要看的是谁急着借这个死讯带票。`,
      ),
    ).toEqual([]);
  });

  it("keeps day-one briefing neutral when there is no public death shape", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 95, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.alive)!;
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const input = buildConstrainedSpeechInput(buildAgentView(state, speaker.seatId));
    const briefingText = [
      input.tableBriefing.publicBoundary.join("\n"),
      input.tableBriefing.legalSpeechFocus.join("\n"),
      input.publicContext.rules.deathInfoNote,
    ].join("\n");

    expect(briefingText).toMatch(/没有需要展开的死亡形态|目前没有公开死讯/);
    expect(briefingText).not.toMatch(/有夜死时只能确认死亡名单|有夜死只需短句带过死亡名单/);
    expect(briefingText).not.toMatch(/平安夜只需短句带过：可以说“女巫用药了”|发言里短句说“女巫用药了”即可/);
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

  it("rejects making first-day peaceful-night witch use the main attack in no-guard boards", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const first = state.seats.find((seat) => seat.alive && seat.isAi)!;
    const second = state.seats.find((seat) => seat.alive && seat.isAi && seat.seatId !== first.seatId)!;
    first.name = "苗木诚";
    second.name = "雾切响子";
    first.roleCard = roleCardFixture("naegi", "苗木诚");
    second.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.speechQueue = [first.seatId, second.seatId];
    state.speechIndex = 0;
    state.events.push({
      type: "DAY_STARTED",
      day: 1,
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    } as never);
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: first.seatId,
      message: "1号发言。昨晚平安夜，女巫用药了，这个背景先放下。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [second.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, second.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木，这句话我不能放过：你把女巫用药说成定案，证据并没有在你手里。查杀之外，我先切这个证词层级。",
        "guided",
      ),
    ).toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木说平安夜女巫用药，这只是背景；我更在意他有没有留下后续能核验的证词。",
        "guided",
      ),
    ).not.toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
  });

  it("rejects treating peaceful-night witch-use common sense as hidden-view speech", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state.events.push({
      type: "DAY_STARTED",
      day: 1,
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    } as never);
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。昨夜平安夜，女巫用了救药，这个点我先当背景处理。谁借这个急着带票，我再回头压。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    for (const speech of [
      "我是女巫，昨夜救的4号豆包，4号是银水。1号DeepSeek，你说“女巫用了救药”，这句话我听着有点怪——你不是女巫，但说得像替女巫发言。我需要你解释一下：你凭什么确定女巫用了救药。",
      "1号一个闭眼平民替女巫说话，我问一句凭什么，这哪里方向有问题。",
      '我是女巫。1号DeepSeek，你刚才说"女巫用药了，这个先放着"，这句话的边界在哪里？你是从平安夜形态推出来的，还是你有别的信息来源。',
      "1号DeepSeek，你那句“女巫用药了”说得太顺了。既然你说信息少，怎么敢直接定性平安夜是女巫用药？我这轮先压1号。",
      "1号刚说信息少，可一开口就把平安夜定成女巫用药，这个依据我不认，我先把1号挂着。",
    ]) {
      expect(validateRenderedSpeech(view, plan, speech, "guided")).toContain(
        "平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点",
      );
    }

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号说平安夜女巫用药只是公共背景，我不打这个点；我只看他后面有没有借平安夜收票。",
        "guided",
      ),
    ).not.toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
  });

  it("rejects making bounded low-info first-seat water the main attack", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。平安夜，女巫用药了。我首置位信息少，先听一圈，不急着定人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我是女巫，昨晚救的是4号，4号是银水。1号首置位信息确实少，这个表态我暂时能接受。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 5];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    for (const speech of [
      '平安夜女巫用药这个判断没问题，1号DeepSeek说的这句我认。我是闭眼视角，现在公开信息不多，但1号首置位只说了一句"先听一圈不急着定人"，发言确实偏短，过程不太够，我暂时先记一下这个疑点。',
      "2号Claude已经拍女巫救4号豆包，这个身份我认，今天不会往2号放票。但1号DeepSeek，你首置位就一句“先听一圈不急定人”，发言太短了，过程不够。我怀疑你这个位置，你当时到底听到了什么。",
    ]) {
      expect(validateRenderedSpeech(view, plan, speech, "guided")).toContain(
        "普通局低信息首置位划水不应成为主要攻击点",
      );
    }

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号Claude拍女巫救4号豆包，这个身份线我先认，1号这句先听一圈我暂时不压；今天我先看有没有人对跳女巫。",
        "guided",
      ),
    ).not.toContain("普通局低信息首置位划水不应成为主要攻击点");
  });

  it("rejects first-seat future audit hooks while preserving bounded low-info water", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.alive && seat.isAi)!;
    state.speechQueue = [speaker.seatId, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state.events.push({
      type: "DAY_STARTED",
      day: 1,
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    } as never);
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药。我是1号DeepSeek，现在信息太少，我先听一圈。",
        "guided",
      ),
    ).not.toContain("普通局发言必须推进一个游戏动作");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了。我是首置位，前面没人发言，我先听一圈。底牌我不虚，但暂时不拍身份。我会从后面的人发言里找前后矛盾的点，看谁强推闭眼位，或者哪句话没说清楚。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药。我是首置位，信息确实少，先听一圈。我不会现在硬压谁，但后面会重点看谁反应最不自然。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是1号DeepSeek。昨夜平安夜，女巫用了救药，这个点先过。 我现在信息确实少，前面没有发言可以接，所以我的处理是先听一圈。等后面几位说完，我会特别留意有没有哪句话前后对不上的地方——哪位的表态我听不太明白，或者某个说法和后面人接不上，我会从那里开始追问。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号发言。昨夜平安夜，女巫用了救药。 我是前置位，现在信息确实少，我先不急着给谁压力。等后面一圈发言出来，再看有没有前后说法对不上的地方。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "昨夜平安夜，女巫用了救药。我是1号DeepSeek。第一天信息很少，我底牌不虚但不急着拍身份，先给个观察点：我会留意后面谁急着借平安夜带节奏，或者谁主动把焦点往闭眼位推。这个点后面能验，谁做了我再打。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "昨夜平安夜，女巫用药了。我这位置没东西，先不定人；这轮先听一圈。",
        "guided",
      ),
    ).not.toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜女巫用药，这句先过了。 我第一个发言，信息确实少。但我想先说一个点，我听发言习惯抓前后说法的一致性，后面谁要是借平安夜这个点急着收票或者安排别人表态，我会先记一笔。 暂时没有具体怀疑目标，先听一圈。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是1号DeepSeek。昨夜平安夜，女巫用药。第一天信息少，我先听一圈，不急着给结论。 不过我留意一个点：后置位如果有人借平安夜的背景，突然开始硬压某个人表态，或者要求别人先交投票方向，我会觉得这个反应不太对。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "昨夜平安夜，女巫用了救药。我信息少，先听一圈再说。底牌不虚，但身份先不交。今天主要看后置位谁先开口逼人表态，谁收着听。我暂时不压票，等一两个发言落点再动。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了。我底牌不虚，但这轮先听一圈，不急着定人。后置位如果有强神起跳，我先看发言质量；如果都没人跳，我就抓谁的话前后对不上。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜女巫用药了，我先听一圈。我一号位信息确实少，前置没有发言可接，后置也还没人说话。我现在没什么硬想法，先说一个我可能会跟的点：后面谁主动强推闭眼位，或者拿平安夜做文章去压人表态，我会多留一个疑问。今天第一轮先不压票，等发言出来再说。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了。我先把这点记下，后面再看谁急着借这个带票。我第一个发言，信息确实少。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了。我首置位，信息确实少，但不代表没东西可以聊。我现在更在意的是谁会借这个平安夜急着收票。3号GPT，我先记你一笔。",
        "guided",
      ),
    ).toContain("提前评价未发言的3号站边或可信度");

    const peaceState = createGame({ boardId: "9p-seer-witch-hunter", seed: 93, humanSeatId: null });
    peaceState.day = 1;
    peaceState.phase = "DAY_SPEECH";
    peaceState.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    peaceState.speechIndex = 0;
    peaceState.events.push({
      type: "DAY_STARTED",
      day: 1,
      message: "第1天清晨，昨夜平安夜。",
      payload: { deadSeatIds: [] },
    } as never);
    const peaceView = buildAgentView(peaceState, 1);
    const peacePlan = createSpeechPlan(peaceView);

    expect(
      validateRenderedSpeech(
        peaceView,
        peacePlan,
        "平安夜，女巫用药了。 我闭眼视角，首置位没有前置发言可以接，但有一个点我先记下来：后置位谁急着借这个点带票，我今天会重点关注。 我暂时不站死谁，先看发言顺序和表态理由。",
        "guided",
      ),
    ).toContain("普通局首置位不要设置未来观察点");
    expect(
      validateRenderedSpeech(
        peaceView,
        peacePlan,
        "平安夜女巫用药了，我先听一圈。信息太少，我暂时不压票。",
        "guided",
      ),
    ).not.toContain("普通局首置位不要设置未来观察点");
  });

  it("rejects courtroom register in true-witch reveals but allows direct player-mouth witch handling", () => {
    let state = Array.from({ length: 30 }, (_, seed) => createGame({ boardId: "9p-seer-witch-hunter", seed: seed + 72, humanSeatId: 9 })).find(
      (candidate) => candidate.seats.some((seat) => seat.isAi && seat.role === "WITCH"),
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

    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是女巫，昨晚救的是${victim.seatId}号，${victim.seatId}号是银水。我拍身份是因为今天票不能散。1号你那个观察点是空的，等于把举证责任全甩给后面的人；你这个打法是打算验谁。`,
        "guided",
      ),
    ).toContain("普通局强身份不要用审判腔");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我拍女巫，昨晚救的是${victim.seatId}号，${victim.seatId}号是银水。今天先别从${victim.seatId}号开，1号没给票口这个点我记着，但我先不拿这个直接打死他。`,
        "guided",
      ),
    ).not.toContain("普通局强身份不要用审判腔");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我拍女巫，昨晚救的是${victim.seatId}号，${victim.seatId}号是银水。1号刚才说女巫用药这句话没问题，但你后面那句闭眼好人视角我没接住：你既然不拍身份，凭什么替女巫下结论？我先不因为这个点直接打死你，但要看你后面怎么处理。`,
        "guided",
      ),
    ).not.toContain("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
  });

  it("rejects half-accept speeches that do not land an accepted part, reserved part, and handling", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "1号发言。昨夜平安夜，女巫用药了。我这位置没东西，先不定人。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "2号发言。我拍女巫，昨晚救的是4号，4号是银水。1号没给票口，这个点我先问一句。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3];
    state.speechIndex = 0;
    const view = buildAgentView(state, 3);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是3号GPT。2号Claude跳了女巫，说银水是4号豆包。目前没人对跳，我先把2号身份放一放，不急着打他。 但有个点我想接一下，2号刚才说1号DeepSeek给的观察点是空的，这话我认同一半。",
        "guided",
      ),
    ).toContain("普通局认同一半必须说清落点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "2号说1号没给票口，这话我认同一半：我认同1号没给具体对象，不认同现在直接打死他；今天我先不跟票1号，只把这个疑问暂放。",
        "guided",
      ),
    ).not.toContain("普通局认同一半必须说清落点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我接一下3号GPT，你刚才说认同一半2号Claude的观点，但你说了认同一半之后呢？你认同一半是哪一半？另一半不认同的又是什么？你没说完。",
        "guided",
      ),
    ).not.toContain("普通局认同一半必须说清落点");
  });

  it("rejects stale peaceful-night medicine-line wording on non-peaceful class-trial death days", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 603, humanSeatId: null });
    const kirigiri = state.seats[1]!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    state.events.push({
      type: "DAY_STARTED",
      day: 1,
      message: "第1天清晨，9号千早爱音倒牌。",
      payload: { deadSeatIds: [9] },
    } as never);
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先卡住平安夜药线和身份声明之间的边界，谁回避这个边界谁就可疑。",
        "guided",
      ),
    ).toContain("非平安夜不应复读平安夜药线");
    expect(
      validateRenderedSpeech(view, plan, "我先卡住死讯、身份声明和查杀线之间的边界，谁回避这个边界谁就可疑。", "guided"),
    ).not.toContain("非平安夜不应复读平安夜药线");
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
    expect(validateRenderedSpeech(view, plan, "我暂时不会把自己手里的信息全部摊开，有些牌留着对好人更有用。")).toEqual(
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

  it("allows a seer black-check claimant to ask the unspoken checked target to answer", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 6];
    state.speechIndex = 0;
    const view = buildAgentView(state, 1);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是预言家，昨晚验了6号塞蕾丝缇雅，查杀。6号接到查杀之后，要怎么接这个信息；重要的是，这个结果出来了，6号必须正面回应。今天出6号是底线。",
        "guided",
      ),
    ).not.toContain("把本轮未发言的6号当成已发言评价");
  });

  it("allows critiquing a prior speaker for overpressuring an unspoken black-check target", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 610, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId, celestia.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚验了6号塞蕾丝缇雅，查杀。今天全票出她。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "1号的查杀报得很直接，6号，你得接住这个。现在没有对跳，焦点就在你身上。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [fukawa.seatId, celestia.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, fukawa.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切，你刚才那句话，怎么听都像是在替1号预设立场。焦点是在6号没错，但6号还没说话，你就已经断定焦点只在她身上，我觉得有点不对劲。",
        "guided",
      ),
    ).not.toContain("把本轮未发言的6号当成已发言评价");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "雾切，你刚才那句话听起来像在替1号预设立场。焦点确实在6号，但你现在这么急着把压力全给她，是不是太快了？只是，1号的查杀报得这么顺，6号还没说话，你就已经断定焦点只在她身上。我觉得有点不对劲。6号，你待会接话的时候，最好把话说清楚。",
        "guided",
      ),
    ).not.toContain("把本轮未发言的6号当成已发言评价");
  });

  it("allows future listening tasks for unspoken seats without treating them as already answered", () => {
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    const frontSeat = state.seats[0]!;
    const speaker = state.seats[1]!;
    const unspoken = state.seats[2]!;
    state.speechQueue = [frontSeat.seatId, speaker.seatId, unspoken.seatId, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: frontSeat.seatId,
      message: "1号发言。平安夜先当背景，我看谁急着带票。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId, unspoken.seatId, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `我重点听${unspoken.seatId}号的位置，他是我这轮第一个要确认态度的对象。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `1号这句我先记着，我重点听${unspoken.seatId}号${unspoken.name}的位置。`, "guided")).toEqual([]);
    expect(validateRenderedSpeech(view, plan, `我重点听${unspoken.seatId}号${unspoken.name}的位置，他是我这轮第一个要确认态度的对象。`, "guided")).toEqual([]);
    expect(
      validateRenderedSpeech(view, plan, `后置位${unspoken.seatId}号可以稍后说说你对平安夜之后第一轮出人的看法。`, "guided"),
    ).not.toContain(`把本轮未发言的${unspoken.seatId}号当成已发言评价`);
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

  it("does not treat a later address to the checked target as asking the seer claimant to speak again", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const celestia = state.seats[5]!;
    const anon = state.seats[8]!;
    naegi.name = "苗木诚";
    celestia.name = "塞蕾丝缇雅";
    anon.name = "千早爱音";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    anon.roleCard = roleCardFixture("anon", "千早爱音");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 6, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是预言家，昨晚验了6号塞蕾丝缇雅，查杀。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "我不认这条查杀，但我不会急着自证。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 9);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "高松灯那个对称点抓得准，苗木诚和黑白熊的查杀顺序几乎一模一样。但塞蕾丝缇雅，你被查杀，苗木诚、雾切、盾子三个人连续压你，你一句身份没交。",
        "guided",
      ),
    ).not.toContain("要求已发言的1号后续补充发言");
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
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨天${checkedTarget.seatId}号DeepSeek被4票归出去，翻牌猎人带走了3号GPT。我昨天也投了${checkedTarget.seatId}号，理由是${claimant.seatId}号Kimi跳预言家发查杀，单边身份先认。但现在${checkedTarget.seatId}号翻枪牌，这个票型我要重新看。`,
        "guided",
      ),
    ).not.toContain(`把被查杀的${checkedTarget.seatId}号错认成预言家`);
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

  it("rejects ordinary speeches that end on a forward commitment without the follow-up", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    state.seats[1]!.role = "WITCH";
    state.night.witchSavedSeatId = 4;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude，女巫。昨晚救的是4号豆包，4号是银水。我先说一下为什么现在跳。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "前面都在追1号，我现在想换个方向看。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我是2号Claude，女巫。昨晚救的是4号豆包，4号是银水。我先说一下为什么现在跳：今天票不能散，我先把4号摘出来。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "前面都在追1号，我现在想换个方向看，先看6号为什么复读没有新理由。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我现在不舒服的是另一件事。1号DeepSeek刚才说信息少，先听一圈。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先接前面的票口，2号女巫我暂时不打死。还有个更让我别扭的地方。",
        "guided",
      ),
    ).toContain("普通局发言疑似被截断");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我先接前面的票口，2号女巫我暂时不打死。还有个更让我别扭的地方：3号认女巫身份，却没有解释为什么不接2号票口。",
        "guided",
      ),
    ).not.toContain("普通局发言疑似被截断");
  });

  it("soft accepts forward commitment endings after retry by cutting the trailing promise", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 95, humanSeatId: null });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2];
    state.speechIndex = 0;
    state.seats[1]!.role = "WITCH";
    state.night.witchSavedSeatId = 4;
    const view = buildAgentView(state, 2);
    const plan = createSpeechPlan(view);
    let attempts = 0;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "ordinary-forward-commitment-soft-cut-test",
      render: async () => {
        attempts += 1;
        return JSON.stringify({
          speech: "我是女巫，昨晚救的是4号豆包，4号是银水。我先说一下为什么现在跳。",
        });
      },
    });

    const result = await provider.generateSpeech(view, plan);

    expect(attempts).toBe(2);
    expect(result.isFallback).toBe(false);
    expect(result.validationErrors).toBeUndefined();
    expect(result.speech).toContain("我是女巫");
    expect(result.speech).toContain("4号是银水");
    expect(result.speech).not.toContain("我先说一下为什么现在跳");
  });

  it("allows quoted why-question fragments when judging a focus shift", () => {
    const state = createGame({ seed: 95, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [7];
    state.speechIndex = 0;
    const view = buildAgentView(state, 7);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "你到现在连一句身份声明都没有，却把焦点往“苗木诚为什么验我”上推，这本身就不达标。",
        "guided",
      ),
    ).not.toContain("发言存在未完成的问题句");
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
    expect(facts).toContain("2号原话不是对3号查杀声明的回应或质疑");

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
      message: "4号发言。3号跳预言家报2号查杀，今天怎么处理这条查杀要说清。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 5,
      message: "5号发言。3号单边预言家我先记着，但查杀位今天不能轻放。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "6号发言。3号报了查杀，外置位要拿更硬身份信息才能改结构。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 7,
      message: "7号发言。3号跳预言家报2号查杀，我先看谁急着把2号放过去。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [8];
    state.speechIndex = 0;
    const view = buildAgentView(state, 8);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan);
    const facts = input.tableBriefing.publicFacts.join("\n");

    expect(facts).toContain("后续多人追问3号GPT的身份和投票处理");
    expect(facts).toContain("3号本轮尚无再次发言机会");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。4号6号7号全在问3号这条查杀今天怎么处理，你一个字没回，这个缺口我先挂着。",
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["把3号发言后的追问说成3号未回应"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "8号发言。4号6号7号都在追问3号这条查杀今天怎么处理，但这些追问发生在3号发言之后，我只能先记这个后置压力。",
        "guided",
      ),
    ).not.toContain("把3号发言后的追问说成3号未回应");
  });

  it("allows a class-trial observer to question another seer claim without owning that black check", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 611, humanSeatId: null });
    const names = ["苗木诚", "雾切响子", "腐川冬子", "黑白熊", "江之岛盾子", "塞蕾丝缇雅", "十神白夜", "高松灯", "千早爱音"];
    const roleIds = ["naegi", "kirigiri", "fukawa", "monokuma", "enoshima", "celestia", "togami", "tomori", "anon"];
    state.seats.forEach((seat, index) => {
      seat.name = names[index] ?? seat.name;
      seat.roleCard = roleCardFixture(roleIds[index] ?? `seat-${seat.seatId}`, seat.name);
    });
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 1,
      message: "我是苗木诚，预言家。昨晚我验了3号腐川冬子，她是好人，金水。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "苗木诚，你报完金水后替3号铺路，这一步太顺了。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "雾切响子，你急着把我和苗木诚定成配合，我先咬住你这个反应。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "我是预言家，昨晚验了1号苗木诚，查杀。今天我的票先压1号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 5,
      message: "苗木诚被查杀了，我先看谁救他。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "苗木诚这枚筹码押得太稳，后置位谁替他摊薄解释成本我一起看。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 7,
      message: "6号塞蕾丝缇雅只说收益结构，没给今天的判断标准。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [8, 9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 8);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……4号黑白熊，你那段发言，我停在了一个地方。你先说‘你们三个这配合，是排练过的吗’，然后才接‘我是预言家，昨晚验了1号苗木诚，查杀’。……如果真的是你验出来的结果，为什么不是先说结果，再去看配合？你把‘配合’放在‘查杀’前面，像是先要给我们定一个‘他们三个是一伙’的印象，再报查杀。我想先确认这一点：你报查杀的时候，是真的先想到了结果，还是先想到了怎么把那三个人捆在一起？9号千早爱音还没说话，我希望她听完之后，也看看4号这段发言里查杀和铺垫的顺序。",
        "guided",
      ),
    ).not.toContain("预言家查杀缺少今天如何处理查杀位");
  });

  it("does not treat pressure on Enoshima as saying Fukawa failed to answer a later challenge", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 612, humanSeatId: null });
    const names = ["苗木诚", "雾切响子", "腐川冬子", "黑白熊", "江之岛盾子", "塞蕾丝缇雅", "十神白夜", "高松灯", "千早爱音"];
    const roleIds = ["naegi", "kirigiri", "fukawa", "monokuma", "enoshima", "celestia", "togami", "tomori", "anon"];
    state.seats.forEach((seat, index) => {
      seat.name = names[index] ?? seat.name;
      seat.roleCard = roleCardFixture(roleIds[index] ?? `seat-${seat.seatId}`, seat.name);
    });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [2, 3, 5, 6, 7, 8, 9];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 2,
      message: "这里少了一步。苗木诚夜死了，黑白熊出局了，桌上两条预言家线都断了。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "雾切响子，你这句少了一步到底在暗示什么？我说松了一口气，是因为苗木诚报我金水又压过我。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 5,
      message: "3号腐川冬子，你说松了一口气，这个反应比你前面所有话都诚实，但你没解释这口气到底站在哪边。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "3号腐川冬子这个反应有缺口，雾切响子追过你的地方你没有给出完整解释。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 7,
      message: "谁对腐川冬子这个公开金水位没有给出明确判断线，谁就没有资格带队。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 8,
      message: "5号江之岛盾子，你点别人绕路，但你自己第一天票的是苗木诚；今天他死了，你这条线没接起来。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [9];
    state.speechIndex = 0;
    const view = buildAgentView(state, 9);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "等一下，气氛跑得太快了——但这次不是要大家慢下来，是想把一个断掉的线接回来。刚才六个人都绕着雾切的“少了一步”在转，我先把关系接回来：现在桌上最该盯的，其实是5号江之岛盾子。你昨天票的是苗木诚，理由是“黑白熊查杀后他还没回应”。今天苗木诚夜死了，你第一个反应是接雾切的话，说“两条预言家线都断在桌上”，然后评价腐川冬子“松了一口气”比前面诚实——但你自己那条投票线呢？你昨天压苗木诚的理由，今天还成立吗？你顺着雾切的“少了一步”往下接，却没解释你自己昨天票型的缺口。十神白夜刚才点塞蕾丝缇雅没判断腐川冬子是狼是好人，你呢？你只说她“诚实”，但没判断这个反应指向什么——你也在跳这一步。高松灯刚才直接问你了，说你“顺着雾切的‘少了一步’往下接，却没解释你自己票型的缺口现在怎么接”。你刚才没接这个点。所以我想问你：苗木诚死了，你昨天票他的理由还成立吗？如果不成立，你今天对腐川冬子这个金水位，判断标准是什么？",
        "guided",
      ),
    ).not.toContain("把3号发言后的追问说成3号未回应");
  });

  it("allows saying an already-spoken checked target should not be asked again", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 610, humanSeatId: null });
    const naegi = state.seats[0]!;
    const celestia = state.seats[5]!;
    const togami = state.seats[6]!;
    naegi.name = "苗木诚";
    celestia.name = "塞蕾丝缇雅";
    togami.name = "十神白夜";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    togami.roleCard = roleCardFixture("togami", "十神白夜");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, celestia.seatId, togami.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚验了6号塞蕾丝缇雅，查杀。今天票先压6号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: celestia.seatId,
      message: "1号苗木诚给我查杀，我不认。这个结果可以摆出来，但别替我结算。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [togami.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, togami.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "6号塞蕾丝缇雅已经回应过查杀。重复逼她认不认没有价值；现在筛跟压者和救人者，谁的标准不达标谁出列。",
        "guided",
      ),
    ).not.toContain("要求已发言的6号后续补充发言");
  });

  it("allows quoting already-spoken seats who asked another target to respond", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 610, humanSeatId: null });
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const tomori = state.seats[7]!;
    const anon = state.seats[8]!;
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    tomori.name = "高松灯";
    anon.name = "千早爱音";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    anon.roleCard = roleCardFixture("anon", "千早爱音");
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId, fukawa.seatId, tomori.seatId, anon.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "8号高松灯，轮到你时正面接苗木诚留下的查杀。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: fukawa.seatId,
      message: "我也要听8号高松灯怎么接这条查杀。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: tomori.seatId,
      message: "我听见你们都在等我接，但我先说我听到的断点。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [anon.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, anon.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "等一下，8号高松灯，你说2号雾切响子和3号腐川冬子他们俩是说了“等你接”，但那是回应苗木诚留下的查验。",
        "guided",
      ),
    ).not.toContain("要求已发言的3号后续补充发言");
  });

  it("repairs post-speech challenge timelines by steering pressure onto later speakers", async () => {
    process.env.AI_LLM_MAX_RETRIES = "1";
    let state = createGame({ seed: 91, humanSeatId: null });
    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [3, 4, 6, 7, 8];
    state.speechIndex = 0;
    state.seats[7]!.role = "VILLAGER";
    state.seats[7]!.name = "高松灯";
    state.seats[7]!.roleCard = roleCardFixture("tomori", "高松灯");
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 3,
      message: "3号发言。我是预言家，昨晚查验2号，查杀。今天票口先压2号。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 4,
      message: "4号发言。3号跳预言家报2号查杀，今天怎么处理这条查杀要说清。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 6,
      message: "6号发言。3号报了查杀，外置位要拿更硬身份信息才能改结构。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: 7,
      message: "7号发言。3号跳预言家报2号查杀，我先看谁急着把2号放过去。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [8];
    state.speechIndex = 0;

    let attempt = 0;
    let retryInput: ReturnType<typeof buildConstrainedSpeechInput> | undefined;
    const provider = createConstrainedLlmSpeechProvider({
      providerId: "test-speech",
      render: async (input) => {
        attempt += 1;
        if (attempt === 1) {
          return JSON.stringify({
            speech: "8号发言。4号6号7号全在问3号这条查杀今天怎么处理，你一个字没回，这个缺口我先挂着。",
          });
        }
        retryInput = input;
        return JSON.stringify({
          speech: "8号发言。这些追问发生在3号发言之后，我只能先记后置压力。",
        });
      },
    });
    const view = buildAgentView(state, 8);
    const plan = createSpeechPlan(view);

    await provider.generateSpeech(view, plan);

    expect(attempt).toBe(2);
    const repairText = retryInput?.stability?.repairInstructions?.join("\n") ?? "";
    expect(repairText).toContain("后置追问发生在目标发言之后");
    expect(repairText).toContain("不能写他没接完");
    expect(repairText).toContain("改成评价后置位");
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

  it("requires class-trial seer black checks to give a vote boundary without making first-check motive mandatory", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 250, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        `好的，我会按预言家身份公开查验，并像苗木诚那样把桌面拉回可验证的链条上。--- 我是苗木诚。有件事必须先让大家确认，我昨晚查验了${wolf.seatId}号腐川冬子，结果是狼人。`,
        "guided",
      ),
    ).toEqual(expect.arrayContaining(["学级裁判发言包含提示词痕迹", "预言家查杀缺少今天如何处理查杀位"]));
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是1号苗木诚。我昨晚查验了${wolf.seatId}号腐川冬子，结果是狼人。验人理由是她的位置最容易藏住。既然查杀已经出来，今天票口应该先压${wolf.seatId}号腐川冬子。`,
        "guided",
      ),
    ).toContain("D1预言家不应主动展开首验理由");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是苗木诚。我跳预言家，昨晚查验了${wolf.seatId}号腐川冬子，结果是狼人。所以腐川是我的查杀。今天我的票先压${wolf.seatId}号；谁要保她，就公开和我的结果对撞。`,
        "guided",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是苗木诚。我跳预言家，${wolf.seatId}号腐川冬子是查杀。今天我的票先压${wolf.seatId}号；谁要保她，就公开和我的结果对撞。`,
        "guided",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是苗木诚，预言家。昨晚我验了${wolf.seatId}号腐川冬子，她是狼人。这不是猜测，是夜里拿到的查验结果，必须今天落桌。今天她必须正面接这个结果，全桌怎么处理她，就从她自己的回应开始。`,
        "guided",
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是1号苗木诚，预言家。昨晚验了${wolf.seatId}号腐川冬子，查杀。今天${wolf.seatId}号必须正面接我的查验，要么跳身份对撞，要么给一个能让全桌共同验证的回应。`,
        "guided",
      ),
    ).not.toContain("预言家查杀缺少今天如何处理查杀位");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是苗木诚，预言家。昨晚验了${wolf.seatId}号腐川冬子，查杀。今天全票必须走${wolf.seatId}号，这是我们今天唯一能共同验证的硬信息。`,
        "guided",
      ),
    ).not.toContain("预言家查杀缺少今天如何处理查杀位");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是苗木诚。我跳预言家，${wolf.seatId}号腐川冬子是查杀。我不展开第一晚为什么选他，今天先压住${wolf.seatId}号，外置位只有硬身份反证能改变结构。`,
        "guided",
      ),
    ).toContain("D1预言家不应主动展开首验理由");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是预言家，昨晚查验的是${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。平安夜说明女巫用药了，没法从刀口推更多信息，所以我直接把查杀放到桌面上。今天先压住${wolf.seatId}号。`,
        "guided",
      ),
    ).toContain("D1平安夜只能作背景，不当主要疑点或查杀依据");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是苗木诚。我跳预言家，${wolf.seatId}号腐川冬子是查杀。选她验的理由是她在发言顺序中段，很容易借首日空白藏住。今天票口先压${wolf.seatId}号，外置位只有硬身份反证能改变结构。`,
        "guided",
      ),
    ).toContain("D1预言家不应主动展开首验理由");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是预言家，昨晚查了${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。今天先压住${wolf.seatId}号，外置位只有更硬的身份信息能改变结构。`,
        "guided",
      ),
    ).toContain("真预言家查杀不能说成中立观察条件");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是预言家，昨晚查了${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。这不是我拿出来商量的观察点；今天我的票会压在${wolf.seatId}号身上。谁要保她，就公开和我的结果对撞。`,
        "guided",
      ),
    ).toEqual([]);
  });

  it("rejects seer black-check speeches written from a neutral table-observer perspective", () => {
    const state = Array.from({ length: 40 }, (_, seed) => createGame({ seed: seed + 320, humanSeatId: null })).find((candidate) => {
      const seer = candidate.seats.find((seat) => seat.isAi && seat.role === "SEER");
      const wolf = candidate.seats.find((seat) => seat.alive && seat.role === "WEREWOLF");
      return Boolean(seer && wolf && seer.seatId !== wolf.seatId);
    })!;
    const seer = state.seats.find((seat) => seat.isAi && seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.alive && seat.role === "WEREWOLF")!;
    seer.name = "苗木诚";
    wolf.name = "腐川冬子";
    seer.roleCard = roleCardFixture("naegi", "苗木诚");
    wolf.roleCard = roleCardFixture("fukawa", "腐川冬子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.seerChecks = [{ day: 1, seerSeatId: seer.seatId, targetSeatId: wolf.seatId, result: "WEREWOLF" }];
    state.speechQueue = [seer.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是预言家，昨晚查了${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。今天先别急着把${wolf.seatId}号放过去，除非之后有人拿出更硬的身份信息或直接反跳预言家，否则今天的讨论应该先压住这个位置。`,
        "guided",
      ),
    ).toContain("真预言家查杀不能说成中立观察条件");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `我是预言家，昨晚查了${wolf.seatId}号腐川冬子，${wolf.seatId}号是查杀。今天我投${wolf.seatId}号；谁要救她，就站出来和我的查验对撞。`,
        "guided",
      ),
    ).toEqual([]);
  });

  it("treats a check-result gold-water speech as a seer claim before Kirigiri responds", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    naegi.role = "SEER";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message:
        "大家……早上好。我知道第一天信息很少，平安夜也让我们暂时没有明确的伤亡可以讨论。但这就是我的查验结果，我必须说出来。 我们今天能一起验证的点，就是3号腐川冬子接了这张金水之后的发言。我希望你能先听听3号腐川冬子怎么聊，然后我们看看后面对这个查验结果的反应。我们先确认这一点：3号是好人，那么今天，我们的出人焦点就不应该在她身上。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");

    expect(view.publicSummary.claimBoard).toEqual([
      expect.objectContaining({
        claimedRole: "SEER",
        claimant: expect.objectContaining({ seatId: naegi.seatId }),
        checks: [
          expect.objectContaining({
            target: expect.objectContaining({ seatId: fukawa.seatId }),
            result: "GOOD",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(input.tableBriefing)).toContain("1号苗木诚声称预言家，报3号腐川冬子金水");
    const guideText = input.playerSpeechGuide.tablePlayerStyle.join("\n");
    expect(guideText).toContain("报查验结果、金水或查杀已经等同于预言家声明");
    expect(guideText).toContain("D1不要要求首验理由；一张金水或查杀是正常首夜查验量");
    expect(guideText).toContain("金水天然暂不进出人焦点，不要把报验者正常放下金水说成提前保护或额外设防");
    expect(guideText).not.toContain("金水保护");
    expect(guideText).not.toContain("护投票选择");
    expect(guideText).not.toContain("低信息开局动作");
    expect(guideText).not.toContain("观察谁急着让别人点头");
    expect(input.speechContract.mustNotAsk.join("\n")).toContain("D1已有预言家报验后，不要追问或攻击首验理由");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了，这点不需要重复。苗木，你报3号金水，但你的重点是让后置位验证3号的发言，再决定出人焦点。这里少了一步。你自己的身份呢？你说这是查验结果，但没说你是预言家。你跳预言家了吗？还是只说查验结果？你急着把3号的判断权交给后置位，为什么现在就需要她接话？",
        "guided",
      ),
    ).toContain("报查验结果等同预言家声明，不能追问是否跳预言家");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木，你说重点看谁无理由硬踩3号。但你现在手里只有一张金水，你自己为什么要查3号？查验理由和金水结果一起说，才完整。你这句提前保护金水票型，让我怎么接？",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木，你报3号金水之后立刻说别围绕这张金水出人，这句话就是在提前保护金水票型。你为什么要替3号护住位置？",
        "guided",
      ),
    ).toContain("报金水后放下金水位是正常处理，不能攻击为提前保护");
  });

  it("rejects making day-one first-check motive the main attack point", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 603, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message:
        "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。今天我的票先压这里；谁要保查杀位，就公开和我的结果对撞。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首置位跳预言家，查杀给3号腐川冬子。结论很直接，票也压得很紧。我不急着替他站台，也不替他松绑。现在的问题是被查杀的人还没开口。",
        "guided",
      ),
    ).toContain("D1首跳查杀未对跳前不要反压预言家");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你首置位跳预言家报查杀，结论很干脆。我先不接住这个结论——腐川冬子还没开口，你的查杀到底站不站得住，要等她正面接完再看。你急着把票锁死，这一步我不跟。",
        "guided",
      ),
    ).toContain("D1首跳查杀未对跳前不要反压预言家");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你报3号查杀，票压得准。现在桌面没有对跳，这条查杀先作硬信息挂着。3号腐川冬子，轮到你的时候正面接。",
        "guided",
      ),
    ).not.toContain("D1首跳查杀未对跳前不要反压预言家");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你首置位直接拍预言家报查杀，动作很干脆。但选3号查验的依据是什么？这个缺口我不跳过。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号，你坐在首置位直接报查杀，这个动作本身没有不合理。但我需要确认一个点——你选3号作为查验目标，是首夜睁眼之前就决定好的，还是看到号码时临时做的决定？",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚这一刀砍在3号身上，动作确实干脆，但首置位报查杀，选人依据是空的。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首置位直接拍预言家查杀3号，动作够干脆，但选她查杀的理由呢？你连个铺垫都没有。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号苗木诚跳预言家，报3号腐川冬子查杀。查杀本身是一回事，但你验人总有个理由——为什么是她，说清楚。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木同学，你这句“我验了3号”说得真干脆啊。可你越稳，我越想问——你凭什么觉得腐川是最容易被你推的那一个？",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首验查杀不给心路，只给一句边界，这个缺口我先压住；你连腐川发言都没听到就验她，像是在猜位置。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "整桌都在接苗木诚的压力，可苗木诚自己呢？首跳只给了查杀结果，没给验人判断的公开依据。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "你验了我的底牌，但我没见你解释为什么第一天夜里偏偏摸我；你既然要带队，就把选人理由也放桌上。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(view, plan, "苗木诚查杀落得又快又准，连心路都省了，这条线太干净。", "guided"),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(view, plan, "你报了查杀，但你的起跳为什么选腐川冬子，这个裂口我先压住。", "guided"),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(view, plan, "苗木诚这条查杀先放着，但他验人的心路没交代，这一点太轻了。", "guided"),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "你和1号之间有什么公开证据能说明这个验人落在你头上，而不是随便丢的。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木这个查杀落在腐川头上没有公开证据说明，不像自然验出来的。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你的发言我先记下。但你说“不展开第一晚为什么选他”——这里缺了一段：你验3号的理由是什么。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "他直接报查杀、没绕弯，但你只报了结论，没给验人选择逻辑，这个缺口先放在桌上。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "你今天不止要压死我，还得交代你到底怎么摸到我这来的。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "这条空转链绕了三轮，苗木那句验人选择一直悬着没落地，后面还要补验人依据。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号，你直接报查杀，这个动作我暂时认你是真预言家。但你的发言里只说了结果，没提今晚验谁，也没说如果3号拍身份你会怎么调整。",
        "guided",
      ),
    ).toContain("D1查杀后不要把后续验人或查杀位自证当主要追问");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你查杀给得够快，但你只说了结果，没说今晚验谁，也没说如果3号拍出身份你打算怎么调。",
        "guided",
      ),
    ).toContain("D1查杀后不要把后续验人或查杀位自证当主要追问");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "腐川冬子现在就算拍个民、说个今晚验谁、甚至编个假身份，我也只认她有没有把苗木这条查杀拆开。",
        "guided",
      ),
    ).toContain("D1查杀后不要把后续验人或查杀位自证当主要追问");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜没有死人，跟你验3号没有直接因果，你硬把它和查杀连起来，这句我先打。",
        "guided",
      ),
    ).toContain("D1平安夜只能作背景，不当主要疑点或查杀依据");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首置位跳预言家，平安夜、女巫用药、没人死，桌上连一个对跳都没有，你倒是挑了个最方便的位置起跳。",
        "guided",
      ),
    ).toContain("D1平安夜只能作背景，不当主要疑点或查杀依据");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜你一句“不是今天的主线”就切掉了，可女巫用药是公开规则推出来的，你连药瓶和刀口的反面解释都不留。",
        "guided",
      ),
    ).toContain("D1平安夜只能作背景，不当主要疑点或查杀依据");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚，你选一个刚好坐在你旁边、前置位还没发言的3号，这条链谁最省力。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首置位，没有铺垫，没有心路，上来就是3号查杀——你连犹豫都没犹豫一下，这个结果就这么稳？",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚这条查杀太完美了，没有铺垫也没有心路，像是先把结果摆出来再逼全桌跟。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "首置位起跳，直接甩查杀，没有心路铺垫，没有验人逻辑链，只有一句“这是我的结果”。这个起跳姿势太干净了。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号首置位丢查杀，他只有一个结论，没有给查验逻辑。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号苗木诚，你只报了结果，没给视角逻辑。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "1号首置位甩查杀，干净得不像一个需要思考的预言家。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木首置位直接甩查杀，没给心路，那这条查杀到底是怎么来的？验人顺序呢。",
        "guided",
      ),
    ).toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚这条查杀先作为最强证词放着；首验心路不是核心，我要看有没有对跳，以及腐川如何正面回应。",
        "guided",
      ),
    ).not.toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我注意到从1号苗木诚首跳开始，后面几个人顺着同一条压力往下打；这不是验人理由问题，我先看3号怎么正面接。",
        "guided",
      ),
    ).not.toContain("D1首验理由不是主要攻击点");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "3号腐川冬子，你接查杀的方式我已经听完了：不报身份，只反问苗木诚“凭什么让我先死”。这不是好人接查杀的打法。",
        "guided",
      ),
    ).not.toContain("D1首验理由不是主要攻击点");
  });

  it("rejects late class-trial speakers replaying the same black-check axis after the checked seat answered", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    enoshima.name = "江之岛盾子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    enoshima.role = "WEREWOLF";
    for (const seat of [naegi, kirigiri, fukawa, monokuma, enoshima]) {
      seat.roleCard = roleCardFixture(
        seat === naegi ? "naegi" : seat === kirigiri ? "kirigiri" : seat === fukawa ? "fukawa" : seat === monokuma ? "monokuma" : "enoshima",
        seat.name,
      );
    }
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。今天我的票先压这里。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "这条查杀先放桌面，3号腐川冬子必须正面接。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: fukawa.seatId,
      message: "我不认这条查杀，苗木诚一句话就想把我按死。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: monokuma.seatId,
      message: "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "哎呀，这就有趣了。苗木诚，首置位干干净净一张查杀拍出来，连口气都没抖一下。腐川冬子，你接查杀的方式倒是挺硬，可你避了一个问题——你打算用什么东西让后置位相信你不是在表演硬气？",
        "guided",
      ),
    ).toContain("学级裁判后置位不要复读首跳查杀轴");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "哎呀，这就有趣了。苗木诚首置位直接扔查杀，连停顿都没有——你昨晚就准备好今天要演这出戏了吧。腐川冬子接查杀的反应也太紧张了。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要复读首跳查杀轴");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "黑白熊，你刚才只把话留在裁判席中央，却不肯说真假。你是在暗示她装，还是不敢把话说满？这个半截反应比腐川那句不认更有趣。",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要复读首跳查杀轴");
  });

  it("rejects repeating the same checked-seat self-proof question after multiple followers already asked it", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 605, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    enoshima.name = "江之岛盾子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    enoshima.role = "WEREWOLF";
    for (const seat of [naegi, kirigiri, fukawa, monokuma, enoshima, celestia]) {
      seat.roleCard = roleCardFixture(
        seat === naegi
          ? "naegi"
          : seat === kirigiri
            ? "kirigiri"
            : seat === fukawa
              ? "fukawa"
              : seat === monokuma
                ? "monokuma"
                : seat === enoshima
                  ? "enoshima"
                  : "celestia",
        seat.name,
      );
    }
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId, celestia.seatId];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [naegi.seatId, "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。今天我的票先压这里。"],
      [kirigiri.seatId, "这条查杀先放桌面，3号腐川冬子必须正面接。"],
      [fukawa.seatId, "我不认这条查杀，苗木诚一句话就想把我按死。"],
      [monokuma.seatId, "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。"],
      [enoshima.seatId, "腐川冬子你打算怎么让后置位相信你不是被冤的？黑白熊你刚才像是在替她争取缓冲时间。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [celestia.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, celestia.seatId);
    const plan = createSpeechPlan(view);

    expect(view.roleCard?.theme).toBe("class-trial");
    expect(view.publicSummary.claimBoard.length).toBeGreaterThan(0);
    expect(view.publicSummary.recentSpeeches.length).toBeGreaterThanOrEqual(5);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "腐川冬子，你刚才说“不接这条查杀”，也说“别让他的结果替我把话说完”。但你没说你打算怎么把话说完。你打算今天跳身份吗？还是准备靠后置位帮你踩苗木诚来脱身。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜。苗木诚首置位跳预言家，给3号腐川冬子一张查杀。这张查杀本身我现在不下注，所以我先看接杀位的反应。3号腐川冬子，你说了“我不认”，但你只说了这一句。你连一个今天要打的对立面都没给出来——你要打苗木诚是悍跳，那你手里有没有身份。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "江之岛同学，你把黑白熊说成替腐川争取缓冲时间，这个转移很有趣。我要押一枚筹码在你这次改焦点上：你是在拆跟压者，还是在替查杀位换舞台？",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
  });

  it("rejects Tomori-style late repeats that still circle the checked seat after followers already did", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 606, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    const celestia = state.seats[5]!;
    const togami = state.seats[6]!;
    const tomori = state.seats[7]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    enoshima.name = "江之岛盾子";
    celestia.name = "塞蕾丝缇雅";
    togami.name = "十神白夜";
    tomori.name = "高松灯";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    enoshima.role = "WEREWOLF";
    for (const seat of [naegi, kirigiri, fukawa, monokuma, enoshima, celestia, togami, tomori]) {
      seat.roleCard = roleCardFixture(
        seat === naegi
          ? "naegi"
          : seat === kirigiri
            ? "kirigiri"
            : seat === fukawa
              ? "fukawa"
              : seat === monokuma
                ? "monokuma"
                : seat === enoshima
                  ? "enoshima"
                  : seat === celestia
                    ? "celestia"
                    : seat === togami
                      ? "togami"
                      : "tomori",
        seat.name,
      );
    }
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
    state.speechQueue = [
      naegi.seatId,
      kirigiri.seatId,
      fukawa.seatId,
      monokuma.seatId,
      enoshima.seatId,
      celestia.seatId,
      togami.seatId,
      tomori.seatId,
    ];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [naegi.seatId, "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。今天我的票先压这里。"],
      [kirigiri.seatId, "这条查杀先放桌面，3号腐川冬子必须正面接。"],
      [fukawa.seatId, "我不认这条查杀，苗木诚一句话就想把我按死。"],
      [monokuma.seatId, "腐川冬子只说不认，没说身份，也没说怎么接这个查杀。"],
      [enoshima.seatId, "腐川冬子你打算怎么让后置位相信你不是被冤的？黑白熊你刚才像是在替她争取缓冲时间。"],
      [celestia.seatId, "5号江之岛，你是在等后置位帮你把结论说圆，还是已经拿到了不需要站边的信息。"],
      [togami.seatId, "3号腐川冬子还没有达到能带队的标准，这句身份话交不出来就别谈让别人跟票。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [tomori.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, tomori.seatId);
    const plan = createSpeechPlan(view);

    expect(view.publicSummary.claimBoard.length).toBeGreaterThan(0);
    expect(view.publicSummary.recentSpeeches.length).toBeGreaterThanOrEqual(6);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……1号报了查杀，3号说不认，然后停在那里了。嗯……3号，你只说了不认，没说为什么。你说“别让他的结果替你把话说完”，可你自己的话也没说完。这个停顿，让我觉得你在等——等别人先帮你把路铺好。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……苗木诚首置位跳预言家报查杀，雾切问连接在哪，腐川用位置打反手。腐川冬子，你刚才说苗木诚留不出任何余地让你自证，可你也没说你自己是好人还是别的身份。你这句话接上了雾切的问题，但没有接上你自己的底牌。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……6号塞蕾丝，你刚才把5号的模糊落脚点轻轻放上桌，但声音没有接到自己这里。你说她在等别人说圆，可你这一句也像在等全场替你点头；这个没接上的地方，我先记住。",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
  });

  it("rejects late speakers repeatedly targeting the same black-check follower", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 607, humanSeatId: null });
    const naegi = state.seats[0]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    const togami = state.seats[6]!;
    const tomori = state.seats[7]!;
    naegi.name = "苗木诚";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    enoshima.name = "江之岛盾子";
    togami.name = "十神白夜";
    tomori.name = "高松灯";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    enoshima.role = "WEREWOLF";
    for (const seat of [naegi, fukawa, monokuma, enoshima, togami, tomori]) {
      seat.roleCard = roleCardFixture(
        seat === naegi
          ? "naegi"
          : seat === fukawa
            ? "fukawa"
            : seat === monokuma
              ? "monokuma"
              : seat === enoshima
                ? "enoshima"
                : seat === togami
                  ? "togami"
                  : "tomori",
        seat.name,
      );
    }
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
    state.speechQueue = [naegi.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId, togami.seatId, tomori.seatId];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [naegi.seatId, "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。今天我的票先压这里。"],
      [fukawa.seatId, "腐川冬子。我不认1号苗木诚这条查杀；他一句话就想把我按死。"],
      [monokuma.seatId, "我欣赏苗木诚干脆，但他这句查杀像把结果写死了。"],
      [enoshima.seatId, "4号黑白熊，你一边欣赏苗木诚干脆，一边说他写死结果，你到底站哪边。"],
      [togami.seatId, "黑白熊，你的标准到底是什么？你两头都站，等于没有标准。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [tomori.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, tomori.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……我这里停了一下。苗木诚说查杀腐川冬子，腐川冬子立即说“不认”。但真正让我停下来的，是后来跟上的声音。4号黑白熊，你一边说欣赏苗木诚干脆，一边又说他把结果写死了。这两句话没有接上——你到底认为他可信，还是认为他跳得太急、制造假焦点。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要连续追同一个跟压者");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……7号十神白夜，你刚才把黑白熊的问题审成没有标准，但你自己的声音也压得太满了。你不是在找狼，你是在让全场替你的判断点头。",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要连续追同一个跟压者");
  });

  it("allows auditing a follower who said they want to watch the checked seat answer", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 611, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const celestia = state.seats[5]!;
    const enoshima = state.seats[4]!;
    const togami = state.seats[6]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    celestia.name = "塞蕾丝缇雅";
    enoshima.name = "江之岛盾子";
    togami.name = "十神白夜";
    naegi.role = "SEER";
    celestia.role = "WEREWOLF";
    togami.role = "HUNTER";
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [kirigiri, "kirigiri", "雾切响子"],
      [fukawa, "fukawa", "腐川冬子"],
      [monokuma, "monokuma", "黑白熊"],
      [celestia, "celestia", "塞蕾丝缇雅"],
      [enoshima, "enoshima", "江之岛盾子"],
      [togami, "togami", "十神白夜"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId, celestia.seatId, togami.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚验了6号塞蕾丝缇雅，查杀。今天全票出她。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "1号的查杀报得很直接，6号，你得接住这个。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: fukawa.seatId,
      message: "谁急着替6号找台阶，我就先咬谁。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: monokuma.seatId,
      message: "我跳预言家，昨晚验出1号苗木诚查杀。今天票先压这里。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: enoshima.seatId,
      message: "我比起苗木和黑白熊谁更像，更想看6号塞蕾丝缇雅接查杀的样子。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: celestia.seatId,
      message: "苗木同学，这枚筹码我收到了。我不认这条查杀。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [togami.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, togami.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "5号江之岛盾子，你说想看6号怎么接查杀，但你自己对1号和4号谁更像预言家，一个字都没给。标准呢？还是说，你只想看戏，不打算承担判断的责任？这不够格。",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要继续追同一个查杀位自证问题");
  });

  it("rejects late class-trial speakers copying the previous speaker's question shape", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 608, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    const celestia = state.seats[5]!;
    const togami = state.seats[6]!;
    for (const [seat, id, name] of [
      [naegi, "naegi", "苗木诚"],
      [kirigiri, "kirigiri", "雾切响子"],
      [fukawa, "fukawa", "腐川冬子"],
      [monokuma, "monokuma", "黑白熊"],
      [enoshima, "enoshima", "江之岛盾子"],
      [celestia, "celestia", "塞蕾丝缇雅"],
      [togami, "togami", "十神白夜"],
    ] as const) {
      seat.name = name;
      seat.roleCard = roleCardFixture(id, name);
    }
    naegi.role = "SEER";
    kirigiri.role = "WITCH";
    monokuma.role = "WEREWOLF";
    enoshima.role = "WEREWOLF";
    celestia.role = "WEREWOLF";
    togami.role = "HUNTER";
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [
      naegi.seatId,
      kirigiri.seatId,
      fukawa.seatId,
      monokuma.seatId,
      enoshima.seatId,
      celestia.seatId,
      togami.seatId,
    ];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [naegi.seatId, "我是苗木诚，预言家。昨晚验了6号塞蕾丝缇雅，结果是狼。今天6号必须出。"],
      [kirigiri.seatId, "苗木，你是首置位，目前没有对跳，我先不反推你。今天先等6号回应。"],
      [fukawa.seatId, "雾切只是把皮球踢给六号。苗木，你也别用安排任务的口气说话。"],
      [monokuma.seatId, "我，黑白熊，现在正式宣布：昨晚我验了1号苗木诚，结果是狼人。今天我的票会挂在1号身上。"],
      [
        enoshima.seatId,
        "黑白熊，你报查杀的时机才是全场最妙的。苗木刚跳完，你立刻反手查他——你是昨晚就预言了他会第一个跳预言家，还是刚好验到他，还是说，你就是等着他跳完才好跟？",
      ],
      [celestia.seatId, "苗木同学，你报我查杀，这枚筹码我收到了。你是在用我的身份逼他们表态，还是在用他们的表态来加固你的预言家面？"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [togami.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, togami.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "黑白熊，你刚才那句“勇气可嘉”说得真漂亮，可你报查杀的时机才是全场最妙的。苗木刚跳完，你立刻反手查他——你是昨晚就预言了他会第一个跳预言家，还是刚好验到他，还是说，你就是等着他跳完才好跟？",
        "guided",
      ),
    ).toContain("学级裁判后置位不要复制前置发言句式");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "黑白熊，你的对跳只够把桌面弄乱，还不够达到能带队的标准。我要看的不是你表演得多快，而是你有没有资格让别人放弃1号和6号这组明面冲突；这条标准交不出来，就别谈让全场跟票。",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要复制前置发言句式");
  });

  it("rejects repeated global counterfactual-benefit framing after a day-one black check", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 605, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const enoshima = state.seats[4]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    enoshima.name = "江之岛盾子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId, state.seats[3]!.seatId, enoshima.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "苗木诚。我跳预言家，3号腐川冬子是查杀。今天我的票会压在3号身上，谁要保她就公开对撞。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: kirigiri.seatId,
      message: "雾切响子。我先不替腐川翻案，只记一个问题：如果3号是好人，谁借这条查杀最轻松。",
    });
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: fukawa.seatId,
      message: "腐川冬子。我不认苗木这条查杀，他一句话把我按死，这个动作我当然要反咬回去。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [state.seats[3]!.seatId, enoshima.seatId];
    state.speechIndex = 1;
    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "如果3号腐川冬子是好人，苗木这条查杀砸出来谁最轻松、谁在背后吃收益，这才是今天最该看的结构。",
        "guided",
      ),
    ).toContain("重复全局收益假设，缺少本角色第一人称动作");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木诚首置位直接按死3号，这种结构谁最受益？这才是今天最该看的结构。",
        "guided",
      ),
    ).toContain("重复全局收益假设，缺少本角色第一人称动作");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木把查杀钉出来，腐川反咬得太快；我不替她假设翻盘，我现在只看谁敢为了她把票从查杀上挪开。",
        "guided",
      ),
    ).not.toContain("重复全局收益假设，缺少本角色第一人称动作");
  });

  it("allows Kirigiri's short segmented evidence cuts after an early black check", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 609, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    kirigiri.role = "WITCH";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是苗木诚，预言家。昨晚验了6号塞蕾丝缇雅，结果是狼。今天6号必须出。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "苗木，你是首置位跳的，目前没有对跳。查杀报了，票也压了，这些我都听到了。但你让我、腐川、还有十神马上明确对查杀的初步判断，这一步我先不接。你现在需要的不是听我们点头，而是等6号塞蕾丝缇雅自己开口。她还没说话。我不会替她松绑，也不会在她接话之前就把票挂死。等她回应，看她的反应，再决定下一步。",
        "guided",
      ),
    ).not.toContain("发言过于冗长或报告化");
  });

  it("keeps class-trial post-black-check LLM input away from shared audit jargon", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message:
        "苗木诚。我跳预言家，3号腐川冬子是查杀。这条结果不能把查杀藏起来；今天先从这里开始，除非有人拿出更硬的身份信息。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan, "guided");
    const speechPlan = input.speechPlan!;
    const promptMaterial = JSON.stringify({
      tableBriefing: input.tableBriefing,
      advancedReasoning: input.advancedReasoning,
      reasoningFrame: input.reasoningFrame,
      rolePlaybook: input.rolePlaybook,
      claimAudit: input.claimAudit,
      debateAgenda: input.debateAgenda,
      playerSpeechGuide: input.playerSpeechGuide,
      speechContract: input.speechContract,
      speechPlan,
    });

    expect(promptMaterial).not.toMatch(
      /审计|站边|票口|票型|身份线|身份坑|预言家线审计|身份审计|闭合|闭环|为什么选验|为什么选他|不展开第一晚|今晚验谁|明晚验谁|明天验谁|后续验谁|拍(?:出)?身份[^。！？；]{0,16}(?:调整|怎么调|改票)|为什么验|为什么验这个人|验人和票型|验人心路|验人顺序|验人逻辑链|自然站边|能否闭合|是否闭合|公开缺口|反证缺口|一个字.*落桌|随便丢|验人落|落在[^。！？；]{0,12}头上|如果.{0,12}(?:是)?好人.{0,20}谁.{0,12}(?:收益|轻松|借)/,
    );
  });

  it("keeps hard seer counterclaim contracts visible in class-trial LLM input", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 612, humanSeatId: null });
    const naegi = state.seats[0]!;
    const monokuma = state.seats[3]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    monokuma.name = "黑白熊";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    monokuma.role = "WEREWOLF";
    celestia.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    monokuma.roleCard = roleCardFixture("monokuma", "黑白熊");
    celestia.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, monokuma.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "我是预言家，昨晚验了6号塞蕾丝缇雅，查杀。今天全票出她。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [monokuma.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, monokuma.seatId);
    const plan = {
      ...createSpeechPlan(view),
      speechMove: "claim_black_check" as const,
      allowedInteraction: "finalize_black_check" as const,
      target: { seatId: 1, name: "苗木诚" },
      claimIntent: {
        claimedRole: "SEER" as const,
        strength: "hard" as const,
        check: { day: 1, claimantSeatId: monokuma.seatId, targetSeatId: 1, result: "WEREWOLF" as const },
      },
    };
    const input = buildConstrainedSpeechInput(view, plan, "guided");

    expect(plan.speechMove).toBe("claim_black_check");
    expect(input.speechContract.mustSay.join(" ")).toContain("预言家");
    expect(input.speechContract.mustSay.join(" ")).toContain("1号苗木诚");
    expect(input.speechContract.voteBoundary).toContain("1号");
  });

  it("rejects class-trial peaceful-night report-only speeches after a black check", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 606, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: naegi.seatId,
      message: "苗木诚。我跳预言家，3号腐川冬子是查杀。今天我的票会压在3号身上，谁要保她就公开对撞。",
    });
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, kirigiri.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜，女巫用药了。我已经公开的结论只有这一个：首夜无人倒牌，药瓶用了。现在回看1号苗木诚的发言。",
        "guided",
      ),
    ).toContain("平安夜女巫用药不能作为完整发言");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "平安夜这句我只当背景。苗木报3号查杀后，我先看谁愿意公开和他的结果对撞。",
        "guided",
      ),
    ).not.toContain("平安夜女巫用药不能作为完整发言");
  });

  it("rejects black-check target responses that reuse peaceful-night background", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 606, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    naegi.roleCard = roleCardFixture("naegi", "苗木诚");
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
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
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [naegi.seatId, "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。今天我的票先压这里。"],
      [kirigiri.seatId, "苗木诚首置就跳预言家报查杀。平安夜，女巫用药了，这个先放一边。3号腐川冬子正面接结果。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [fukawa.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, fukawa.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……哈？查杀？苗木诚你开什么玩笑。你首置位跳预言家，报我查杀。平安夜，女巫用药了——这里我先接住雾切响子那句话，不绕药线。",
        "guided",
      ),
    ).toContain("被查杀位回应不要复述平安夜");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "……哈？查杀？苗木诚你开什么玩笑。你首置位跳预言家，报我查杀。好啊，那就拆你这句查杀：你想一句话把我按死，我今天先把你当悍跳打。",
        "guided",
      ),
    ).not.toContain("被查杀位回应不要复述平安夜");
  });

  it("rejects late class-trial black-check inventory recaps", () => {
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 608, humanSeatId: null });
    const naegi = state.seats[0]!;
    const kirigiri = state.seats[1]!;
    const fukawa = state.seats[2]!;
    const monokuma = state.seats[3]!;
    const enoshima = state.seats[4]!;
    const celestia = state.seats[5]!;
    naegi.name = "苗木诚";
    kirigiri.name = "雾切响子";
    fukawa.name = "腐川冬子";
    monokuma.name = "黑白熊";
    enoshima.name = "江之岛盾子";
    celestia.name = "塞蕾丝缇雅";
    naegi.role = "SEER";
    fukawa.role = "WEREWOLF";
    for (const seat of [naegi, kirigiri, fukawa, monokuma, enoshima, celestia]) {
      seat.roleCard = roleCardFixture(
        seat === naegi
          ? "naegi"
          : seat === kirigiri
            ? "kirigiri"
            : seat === fukawa
              ? "fukawa"
              : seat === monokuma
                ? "monokuma"
                : seat === enoshima
                  ? "enoshima"
                  : "celestia",
        seat.name,
      );
    }
    state.day = 1;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [naegi.seatId, kirigiri.seatId, fukawa.seatId, monokuma.seatId, enoshima.seatId, celestia.seatId];
    state.speechIndex = 0;
    for (const [actorSeatId, message] of [
      [naegi.seatId, "苗木诚。我跳预言家，昨晚查验结果是3号腐川冬子查杀。"],
      [kirigiri.seatId, "这条查杀先放桌面，等腐川冬子接。"],
      [fukawa.seatId, "腐川冬子。我不认1号苗木诚这条查杀。"],
      [monokuma.seatId, "腐川冬子只说不认，没说苗木诚是悍跳还是瞎报。"],
      [enoshima.seatId, "雾切响子那句等验证太舒服了。"],
    ] as const) {
      state = applyCommand(state, { type: "speak", actorSeatId, message });
    }
    state.phase = "DAY_SPEECH";
    state.speechQueue = [celestia.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, celestia.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "塞蕾丝缇雅。平安夜，女巫用药——这个信息暂且放下。苗木诚首置位跳预言家，报3号查杀。雾切响子没接也没跳，留一句“等验证”就收了。腐川冬子不认，但只说不认，没说苗木诚是悍跳还是在瞎报。黑白熊把这个缺口点出来了，很好——可点完之后他自己也没下注，只是把问题丢回去。",
        "guided",
      ),
    ).toContain("学级裁判后置位不要复盘整条查杀流水账");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "黑白熊，你刚才点出腐川冬子没选边，可你自己也没下注。你把问题丢回裁判席，筹码却不肯放下去。",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要复盘整条查杀流水账");
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "我把关系接回来。黑白熊，你刚才那句“今天票先压这里”语气太硬了，但你的接话时机有个问题——1号先手查杀3号，你跟在后面跳，查杀打回1号，却完全没提3号这条线。我先不跟着跑票，只想确认：你跳预言家的时候，对3号那条线到底怎么看？今天如果要出人，你先出谁？",
        "guided",
      ),
    ).not.toContain("学级裁判后置位不要复盘整条查杀流水账");
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

function roleCardFixture(id: string, displayName = id): AiCharacterRoleCard {
  return {
    id,
    displayName,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "本地学级裁判角色语气。",
    reasoningBias: "按公开信息推理。",
    voteBias: "认真服务阵营胜利。",
    nightActionBias: "夜晚行动不在本轮透镜范围内。",
    asVillager: "作为好人时按公开证据找狼。",
    asWerewolf: "作为狼人时只用公开理由伪装。",
    pressureResponse: "被怀疑时回应公开逻辑。",
    relationshipHints: [],
    catchphrasePolicy: "允许极短口癖，不复刻长台词。",
    forbidden: [],
  };
}

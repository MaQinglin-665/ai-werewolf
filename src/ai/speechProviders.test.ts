import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, applySystemStep, createGame } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import type { AiCharacterRoleCard, PublicReasoningCue, Seat, SpeechPlan } from "@/game/types";
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
    let state = createGame({ boardId: "9p-seer-witch-hunter", seed: 604, humanSeatId: null });
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
    expect(allGuidance).toContain("公开死亡形态推理");
    expect(allGuidance).toContain("不要伪装成私密直知");
    expect(allGuidance).toContain("空刀");
    expect(allGuidance).not.toContain("近似忽略");
    expect(allGuidance).not.toContain("狼人不能空刀");
    expect(input.inferenceLayers.highProbability.join("\n")).toContain("女巫用药了");
    expect(input.inferenceLayers.lowProbability.join("\n")).toContain("空刀只作为边界");
    expect(input.inferenceLayers.privateUnknowns.join("\n")).toContain("女巫是谁");
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
    expect(briefing).toContain("判断动作");
    expect(briefing).not.toMatch(/空刀概率极其小|近似忽略|实战上可以近似忽略/);
    expect(input.tableBriefing.legalSpeechFocus.join("\n")).toContain("判断动作");
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

    expect(briefingText).toMatch(/首夜单死.*女巫没救.*公开.*推理|首夜单死.*公开.*推理.*女巫没救/);
    expect(briefingText).not.toMatch(/女巫没救.*合理简称/);
    expect(briefingText).toMatch(/有夜死|死亡名单/);
    expect(briefingText).not.toMatch(/不能确认女巫用药|不要确认女巫用药|不能说成确定事实/);
    expect(briefingText).not.toMatch(/平安夜直接按公开死亡形态处理/);
    expect(briefingText).not.toMatch(/发言里短句说“女巫用药了”即可|平安夜只需短句带过：可以说“女巫用药了”/);
    expect(briefingText).toMatch(/空刀.*不作为|空刀只作为边界/);
    expect(briefingText).toMatch(/非女巫.*女巫是谁.*具体救了几号/);
    expect(briefingText).toMatch(/刀口.*毒口.*公开死亡形态|公开死亡形态.*刀口.*毒口/);
    expect(briefingText).not.toMatch(/不能擅自说成确定的具体刀口、毒口/);
    expect(briefingText).toMatch(/真女巫.*真实救毒信息/);
    expect(briefingText).toMatch(/药瓶状态.*公开死亡形态/);
    expect(briefingText).not.toContain("狼人不能空刀");
    expect(briefingText).toContain("公开死亡形态");

    const view = buildAgentView(state, speaker.seatId);
    const plan = createSpeechPlan(view);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，按本局狼必刀和女巫三选一来推，刀口就在${deadSeat.seatId}号，女巫没救下来。`,
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，我倾向女巫没用药；如果她毒重了刀口，公开结果也可能只有这一个死，这点明天再校验。`,
      ),
    ).toEqual([]);
    expect(
      validateRenderedSpeech(
        view,
        plan,
        `昨晚${deadSeat.seatId}号单死，如果女巫毒重刀口，毒口也可能是${deadSeat.seatId}号；我只按公开结果留这个边界。`,
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

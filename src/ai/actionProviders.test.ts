import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfiguredAiOptions, createMockCommand, mockActionProvider } from "./mockAgent";
import { mockSpeechProvider } from "./speechProviders";
import { buildConstrainedActionInput, routedModelActionProvider, validateActionDecision } from "./actionProviders";
import { buildAiTableRead, createVotePlan } from "./tableRead";
import { buildAgentView } from "@/game/projection";
import { createGame } from "@/game/engine";
import type { ActionTarget, AgentView, AiTableRead, Seat, SeatRead, TableMemory } from "@/game/types";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("configured AI options", () => {
  it("forceMock bypasses configured LLM providers", () => {
    const options = createConfiguredAiOptions({ forceMock: true });

    expect(options.actionProvider).toBe(mockActionProvider);
    expect(options.speechProvider).toBe(mockSpeechProvider);
  });
});

describe("routed action provider", () => {
  it("offers white wolf king self-explosion as a day-speech action candidate", () => {
    const state = createGame({ boardId: "12p-sheriff-white-wolf-king-seer-witch-hunter-guard", seed: 94, humanSeatId: null });
    const whiteWolfKing = state.seats.find((seat) => seat.role === "WHITE_WOLF_KING")!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [whiteWolfKing.seatId];
    state.speechIndex = 0;
    const view = buildAgentView(state, whiteWolfKing.seatId);
    const tableRead = buildAiTableRead(view);
    const fallbackCommand = createMockCommand(view, tableRead);

    const input = buildConstrainedActionInput(view, { tableRead, fallbackCommand });

    expect(input.candidates.some((candidate) => candidate.command.type === "speak")).toBe(true);
    expect(input.candidates.some((candidate) => candidate.command.type === "whiteWolfKingExplode")).toBe(true);
    expect(input.constraints.join("\n")).toContain("White wolf king self-explosion is optional");
  });

  it("includes local character role-card guidance in real LLM action input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const actor = state.seats.find((seat) => seat.isAi)!;
    actor.name = "雾切响子";
    actor.roleCard = {
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
    const view = buildAgentView(state, actor.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    expect(input.characterRole?.displayName).toBe("雾切响子");
    expect(input.characterLens).toMatchObject({
      roleId: "kirigiri",
      displayName: "雾切响子",
    });
    expect(input.constraints.join("\n")).toContain("role card is soft guidance");
    expect(input.constraints.join("\n")).toContain("学级裁判角色投票理由透镜：雾切响子");
    expect(input.constraints.join("\n")).toContain("过于顺滑的结论");
    expect(JSON.stringify(input.characterRole)).not.toContain("真实身份");
  });

  it("applies class-trial werewolf strategy to private night action input", () => {
    const state = createGame({ seed: 47, humanSeatId: null });
    state.phase = "NIGHT_WOLVES";
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    wolf.name = "江之岛盾子";
    wolf.roleCard = {
      id: "enoshima",
      displayName: "江之岛盾子",
      theme: "class-trial",
      styleTags: [],
      speechStyleZh: "戏剧化、挑衅。",
      reasoningBias: "放大公开反差。",
      voteBias: "喜欢把压力推向能制造反应的位置。",
      nightActionBias: "夜晚行动激进。",
      asVillager: "作为好人时用公开证据施压。",
      asWerewolf: "作为狼人时把混乱包装成公开推理。",
      pressureResponse: "被怀疑时反向挑衅。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短绝望感，不复刻长台词。",
      forbidden: [],
    };
    const view = buildAgentView(state, wolf.seatId);
    const tableRead = buildAiTableRead(view);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: createMockCommand(view, tableRead),
    });

    expect(input.characterRole?.displayName).toBe("江之岛盾子");
    expect(input.characterLens).toMatchObject({
      roleId: "enoshima",
      displayName: "江之岛盾子",
    });
    expect(input.constraints.join("\n")).toContain("学级裁判狼人杀行动策略：江之岛盾子");
    expect(input.constraints.join("\n")).toContain("夜晚行动倾向");
    expect(input.constraints.join("\n")).toContain("狼队打法");
  });

  it("offers class-trial last words with role-specific emotion", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "LAST_WORDS";
    const enoshima = state.seats.find((seat) => seat.isAi)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = {
      id: "enoshima",
      displayName: "江之岛盾子",
      theme: "class-trial",
      styleTags: ["dramatic"],
      speechStyleZh: "戏剧化、挑衅、愤怒。",
      reasoningBias: "放大公开裂口。",
      voteBias: "把裂口压成票口。",
      nightActionBias: "夜晚行动偏进攻。",
      asVillager: "作为好人时高压逼反应。",
      asWerewolf: "作为狼人时煽动互踩。",
      pressureResponse: "被怀疑时戏剧化反打。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短戏剧化感叹。",
      forbidden: ["不能泄露隐藏身份。"],
    };
    state.lastWordsSeatId = enoshima.seatId;
    const view = buildAgentView(state, enoshima.seatId);
    const tableRead = buildAiTableRead(view);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: createMockCommand(view, tableRead),
    });
    const messages = input.candidates
      .filter((candidate) => candidate.command.type === "lastWords")
      .map((candidate) => (candidate.command.type === "lastWords" ? candidate.command.message : ""))
      .join("\n");

    expect(messages).toContain("江之岛盾子");
    expect(messages).toMatch(/生气|愤怒|裂口|绝望/);
    expect(messages).not.toContain("我是江之岛盾子");
    expect(messages).not.toContain("我出局前留核心视角");
  });

  it("offers Kirigiri last words as resigned but rational analysis", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "LAST_WORDS";
    const kirigiri = state.seats.find((seat) => seat.isAi)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = {
      id: "kirigiri",
      displayName: "雾切响子",
      theme: "class-trial",
      styleTags: ["calm"],
      speechStyleZh: "冷静、无奈、理性。",
      reasoningBias: "优先审查证据链。",
      voteBias: "投证据链最完整的可疑位。",
      nightActionBias: "夜晚行动谨慎。",
      asVillager: "作为好人时保持事实边界。",
      asWerewolf: "作为狼人时冷静伪装。",
      pressureResponse: "被怀疑时逐条拆解。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短冷静收束句。",
      forbidden: ["不能泄露隐藏身份。"],
    };
    state.lastWordsSeatId = kirigiri.seatId;
    const view = buildAgentView(state, kirigiri.seatId);
    const tableRead = buildAiTableRead(view);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: createMockCommand(view, tableRead),
    });
    const messages = input.candidates
      .filter((candidate) => candidate.command.type === "lastWords")
      .map((candidate) => (candidate.command.type === "lastWords" ? candidate.command.message : ""))
      .join("\n");

    expect(messages).toContain("雾切响子");
    expect(messages).toMatch(/无奈|遗憾|证据链|理性/);
    expect(messages).not.toContain("我是雾切响子");
    expect(messages).not.toContain("我出局前留核心视角");
  });

  it("rejects class-trial last words that reintroduce the speaker by name", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "LAST_WORDS";
    const monokuma = state.seats.find((seat) => seat.isAi)!;
    monokuma.name = "黑白熊";
    monokuma.roleCard = {
      id: "monokuma",
      displayName: "黑白熊",
      theme: "class-trial",
      styleTags: ["taunting"],
      speechStyleZh: "嘲弄、夸张、像裁判长一样煽风点火。",
      reasoningBias: "用公开票型和死讯制造压迫感。",
      voteBias: "把公开裂口推成处刑压力。",
      nightActionBias: "夜晚行动偏制造混乱。",
      asVillager: "作为好人时用夸张语气逼反应。",
      asWerewolf: "作为狼人时用玩笑掩盖推动。",
      pressureResponse: "被怀疑时嘲弄反打。",
      relationshipHints: [],
      catchphrasePolicy: "保留短促的噗噗语气词。",
      forbidden: ["不能泄露隐藏身份。"],
    };
    state.lastWordsSeatId = monokuma.seatId;
    const view = buildAgentView(state, monokuma.seatId);
    const tableRead = buildAiTableRead(view);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: createMockCommand(view, tableRead),
    });

    const selfIntroErrors = validateActionDecision(view, input, {
      candidateId: "lastWords:custom",
      reason: "公开遗言补充票型判断",
      message: "噗噗，我是黑白熊。别以为我退场这场闹剧就结束了。",
    });
    const characterBeatErrors = validateActionDecision(view, input, {
      candidateId: "lastWords:custom",
      reason: "公开遗言补充票型判断",
      message: "噗噗，别以为我退场这场闹剧就结束了。明天继续互相审判吧。",
    });

    expect(selfIntroErrors).toContain("学级裁判遗言不要自我介绍");
    expect(characterBeatErrors).not.toContain("学级裁判遗言不要自我介绍");
  });

  it("offers wolf beauty charm as a night action candidate", () => {
    const state = createGame({ boardId: "12p-sheriff-wolf-beauty-knight", seed: 95, humanSeatId: null });
    const wolfBeauty = state.seats.find((seat) => seat.role === "WOLF_BEAUTY")!;
    state.phase = "NIGHT_WOLF_BEAUTY";
    const view = buildAgentView(state, wolfBeauty.seatId);
    const tableRead = buildAiTableRead(view);
    const fallbackCommand = createMockCommand(view, tableRead);

    const input = buildConstrainedActionInput(view, { tableRead, fallbackCommand });

    expect(input.candidates.some((candidate) => candidate.command.type === "wolfBeautyCharm")).toBe(true);
    expect(input.constraints.join("\n")).toContain("Wolf beauty charm is private night strategy");
  });

  it("includes private wolf night strategy only in wolf action input", () => {
    const state = createGame({ seed: 47, humanSeatId: null });
    state.phase = "NIGHT_WOLVES";
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    const good = state.seats.find((seat) => seat.isAi && seat.role === "VILLAGER")!;

    const wolfView = buildAgentView(state, wolf.seatId);
    const wolfTableRead = buildAiTableRead(wolfView);
    const wolfInput = buildConstrainedActionInput(wolfView, {
      tableRead: wolfTableRead,
      fallbackCommand: createMockCommand(wolfView, wolfTableRead),
    });
    const wolfPlan = wolfInput.selfContext.wolfPlan as typeof wolfInput.selfContext.wolfPlan & {
      nightStrategy?: {
        nightTarget?: ActionTarget;
        dayPressureTarget?: ActionTarget;
        summary: string;
        discussion: string[];
      };
    };
    const plannedTarget = wolfView.privateKnowledge.wolfTeamPlan?.nightStrategy?.nightTarget;
    const wolfKillTargets = wolfInput.candidates
      .filter((candidate) => candidate.command.type === "wolfKill" && "targetSeatId" in candidate.command)
      .map((candidate) => ("targetSeatId" in candidate.command ? candidate.command.targetSeatId : undefined));

    expect(wolfPlan?.nightStrategy).toBeDefined();
    expect(wolfPlan?.nightStrategy?.summary).toContain("首夜");
    expect(wolfPlan?.nightStrategy?.nightTarget).toEqual(plannedTarget);
    expect(wolfKillTargets[0]).toBe(plannedTarget?.seatId);

    const goodState = createGame({ seed: 47, humanSeatId: null });
    goodState.phase = "DAY_VOTE";
    const goodView = buildAgentView(goodState, good.seatId);
    const goodTableRead = buildAiTableRead(goodView);
    const goodInput = buildConstrainedActionInput(goodView, {
      tableRead: goodTableRead,
      votePlan: createVotePlan(goodView, goodTableRead),
      fallbackCommand: createMockCommand(goodView, goodTableRead),
    });

    expect(goodInput.selfContext.wolfPlan).toBeUndefined();
    expect(JSON.stringify(goodInput)).not.toMatch(/狼队首夜|战术|nightStrategy/);
  });

  it("strips wolf vote tactic metadata from good-side action input", () => {
    const state = createGame({ seed: 68, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const good = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const view = buildAgentView(state, good.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = { ...createVotePlan(view, tableRead), wolfVoteTactic: "team_target" as const };

    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    expect(JSON.stringify(input)).not.toContain("wolfVoteTactic");
  });

  it("tells day-vote models that vote-plan alternatives are credible divergence choices", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);

    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    expect(votePlan.alternatives.length).toBeGreaterThan(0);
    expect(input.constraints.join("\n")).toContain("votePlan.alternatives are credible legal vote lines");
    expect(input.constraints.join("\n")).toContain("If candidates include recommended: true");
    expect(input.candidates.find((candidate) => candidate.id === `vote:${votePlan.target.seatId}`)?.recommended).toBeUndefined();
    for (const alternative of votePlan.alternatives) {
      expect(input.candidates.find((candidate) => candidate.id === `vote:${alternative.seatId}`)?.reasonHint).toMatch(
        /备选票线|合法分歧/,
      );
    }
  });

  it("can lead with a credible vote alternative for even-position players when evidence is not hard", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const voter = state.seats.find((seat) => seat.isAi && seat.seatId === 2)!;
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);

    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });
    const firstVoteCandidate = input.candidates.find((candidate) => candidate.command.type === "vote");

    expect(votePlan.confidence).toBeLessThan(0.74);
    expect(firstVoteCandidate?.id).toBe(`vote:${votePlan.alternatives[0]?.seatId}`);
    expect(firstVoteCandidate?.recommended).toBe(true);
  });

  it("carries inference layers and speech-vote continuity into day-vote action input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const baseView = buildAgentView(state, voter.seatId);
    const voteAction = baseView.allowedActions.find((action) => action.type === "vote");
    const target = voteAction?.type === "vote" ? voteAction.targets[0] : undefined;
    if (!target) throw new Error("expected at least one vote target");
    const view = {
      ...baseView,
      privateKnowledge: {
        ...baseView.privateKnowledge,
        aiMemory: {
          seatId: voter.seatId,
          day: state.day,
          lastSpeechTargetSeatId: target.seatId,
          lastSpeechStance: `${target.seatId}号上一轮发言缺过程，我先压这里`,
          beliefs: [],
        },
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = {
      ...createVotePlan(view, tableRead),
      target: { seatId: target.seatId, name: target.name },
      reason: "公开证据更清晰，先按这里收束。",
      alternatives: [],
    };

    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    expect(input.inferenceLayers.highProbability.join("\n")).toContain("高概率推断");
    expect(input.inferenceLayers.lowProbability.join("\n")).toContain("低概率边界");
    expect(input.inferenceLayers.privateUnknowns.join("\n")).toContain("具体刀口");
    expect(input.publicContext.decisionSummary.speechVoteContinuity.join("\n")).toContain(`${target.seatId}号`);
    expect(input.constraints.join("\n")).toContain("speechVoteContinuity");
    expect(input.candidates.find((candidate) => candidate.id === `vote:${target.seatId}`)?.reasonHint).toMatch(/上一轮发言|speech-vote/i);
  });

  it("adds a speech-vote continuity hint when pivoting away from the previous speech target", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const baseView = buildAgentView(state, voter.seatId);
    const voteAction = baseView.allowedActions.find((action) => action.type === "vote");
    const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
    const oldTarget = legalTargets[0];
    const newTarget = legalTargets.find((target) => target.seatId !== oldTarget?.seatId);
    if (!oldTarget || !newTarget) throw new Error("expected at least two vote targets");
    const view = {
      ...baseView,
      privateKnowledge: {
        ...baseView.privateKnowledge,
        aiMemory: {
          seatId: voter.seatId,
          day: state.day,
          lastSpeechTargetSeatId: oldTarget.seatId,
          lastSpeechStance: `${oldTarget.seatId}号发言没有解释清楚夜里信息`,
          beliefs: [],
        },
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = {
      ...createVotePlan(view, tableRead),
      target: { seatId: newTarget.seatId, name: newTarget.name },
      reason: "公开证据更清晰，先按这里收束。",
      alternatives: [],
    };

    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    expect(input.candidates.find((candidate) => candidate.id === `vote:${newTarget.seatId}`)?.reasonHint).toMatch(
      /转票|更硬|speech-vote/i,
    );
  });

  it("rejects truncated action reasons that end with dangling punctuation", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    const errors = validateActionDecision(view, input, {
      candidateId: `vote:${votePlan.target.seatId}`,
      reason: "延续上一轮发言压力，",
      message: "",
    });

    expect(errors).toContain("reason is malformed");
  });

  it("rejects day-vote reasons that ignore required speech-vote continuity", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    const baseView = buildAgentView(state, voter.seatId);
    const voteAction = baseView.allowedActions.find((action) => action.type === "vote");
    const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
    const oldTarget = legalTargets[0];
    const newTarget = legalTargets.find((target) => target.seatId !== oldTarget?.seatId);
    if (!oldTarget || !newTarget) throw new Error("expected at least two vote targets");
    const view = {
      ...baseView,
      privateKnowledge: {
        ...baseView.privateKnowledge,
        aiMemory: {
          seatId: voter.seatId,
          day: state.day,
          lastSpeechTargetSeatId: oldTarget.seatId,
          lastSpeechStance: `${oldTarget.seatId}号发言没有解释清楚夜里信息`,
          beliefs: [],
        },
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = {
      ...createVotePlan(view, tableRead),
      target: { seatId: newTarget.seatId, name: newTarget.name },
      reason: "公开疑点较多，先投这里。",
      alternatives: [],
    };
    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    const errors = validateActionDecision(view, input, {
      candidateId: `vote:${newTarget.seatId}`,
      reason: "公开疑点较多，先投这里。",
      message: "",
    });

    expect(errors).toContain("reason misses required speech-vote continuity");
  });

  it("offers knight duel as an optional day action candidate", () => {
    const state = createGame({ boardId: "12p-sheriff-wolf-beauty-knight", seed: 96, humanSeatId: null });
    const knight = state.seats.find((seat) => seat.role === "KNIGHT")!;
    state.phase = "KNIGHT_DUEL";
    const view = buildAgentView(state, knight.seatId);
    const tableRead = buildAiTableRead(view);
    const fallbackCommand = createMockCommand(view, tableRead);

    const input = buildConstrainedActionInput(view, { tableRead, fallbackCommand });

    expect(input.candidates.some((candidate) => candidate.command.type === "knightDuel")).toBe(true);
    expect(input.constraints.join("\n")).toContain("Knight duel is optional");
    expect(input.constraints.join("\n")).toContain("single black-check pressure should rank below repeated public evidence");
  });

  it("ranks dead-seer legacy knight targets ahead of untrusted single black-check pressure", () => {
    const noisy = target(2, "Noisy Check");
    const legacyTarget = target(3, "Legacy Black");
    const deadSeer = target(6, "Dead Seer");
    const tableMemory = emptyTableMemory({
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 3,
          summary: "Dead Seer died with a black check.",
          checks: [{ day: 2, target: legacyTarget, result: "WEREWOLF" }],
          stancesGiven: [],
        },
      ],
    });
    const view = knightActionView([noisy, legacyTarget], tableMemory);
    const tableRead = actionTableRead(
      [
        seatRead(noisy, {
          suspicion: 98,
          trust: 20,
          pressure: ["Contested Seer公开报查杀", "多人跟进施压"],
          publicChecksAgainst: [{ claimant: target(4, "Contested Seer"), result: "WEREWOLF", day: 3 }],
        }),
        seatRead(legacyTarget, {
          suspicion: 82,
          trust: 38,
          pressure: ["Dead Seer夜死后遗留查杀"],
        }),
      ],
      tableMemory,
    );
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: { type: "knightDuel", actorSeatId: 1, targetSeatId: legacyTarget.seatId, reason: "死预遗产更硬。" },
    });

    const duelTargets = input.candidates
      .filter((candidate) => candidate.command.type === "knightDuel" && "targetSeatId" in candidate.command && candidate.command.targetSeatId)
      .map((candidate) => ("targetSeatId" in candidate.command ? candidate.command.targetSeatId : undefined));

    expect(duelTargets[0]).toBe(legacyTarget.seatId);
    expect(
      input.candidates.find(
        (candidate) => candidate.command.type === "knightDuel" && "targetSeatId" in candidate.command && candidate.command.targetSeatId === legacyTarget.seatId,
      )?.recommended,
    ).toBe(true);
  });

  it("demotes protected dead-seer gold water in day vote candidates", () => {
    const deadSeer = target(6, "Dead Seer");
    const gold = target(2, "Legacy Gold");
    const alternative = target(3, "Open Focus");
    const tableMemory = emptyTableMemory({
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          summary: "Dead Seer died with a gold-water check.",
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
        },
      ],
    });
    const view = voteActionView([gold, alternative], tableMemory);
    const tableRead = {
      ...actionTableRead(
        [
          seatRead(gold, {
            suspicion: 98,
            trust: 16,
            pressure: ["short speech", "soft vote noise"],
          }),
          seatRead(alternative, {
            suspicion: 56,
            trust: 44,
            pressure: ["open public focus"],
          }),
        ],
        tableMemory,
      ),
      myRole: "VILLAGER" as const,
    };
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: { type: "vote", actorSeatId: 1, targetSeatId: alternative.seatId, reason: "protect legacy gold" },
    });
    const voteCandidates = input.candidates.filter(
      (candidate) => candidate.command.type === "vote" && "targetSeatId" in candidate.command && candidate.command.targetSeatId,
    );

    expect(voteCandidates.map((candidate) => ("targetSeatId" in candidate.command ? candidate.command.targetSeatId : undefined))).toEqual([
      alternative.seatId,
      gold.seatId,
    ]);
    expect(voteCandidates.find((candidate) => candidate.target?.seatId === gold.seatId)?.reasonHint).toMatch(/夜死预言家保护的金水位/);
  });

  it("tries an action fallback persona after invalid primary JSON", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.4";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      if (requestBody.model === "deepseek-v4-flash") {
        return new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      const input = JSON.parse(requestBody.messages.at(-1)?.content ?? "{}") as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason: "public evidence is clearer here" }) } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.4"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("gpt-action:gpt-5.4");
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
  });

  it("keeps class-trial action repair attempts on Mimo instead of persona fallbacks", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_MIMO = "mimo-v2.5";
    process.env.AI_MODEL_GPT = "gpt-5.4";

    let requestCount = 0;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestCount += 1;
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      if (requestCount === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      const content = requestBody.messages.at(-1)?.content ?? "{}";
      const inputJson = content.includes("输入：") ? content.slice(content.indexOf("输入：") + "输入：".length) : content;
      const input = JSON.parse(inputJson) as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason: "公开证据更清楚，先压这里。" }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    voter.name = "雾切响子";
    setMimoPersona(voter);
    voter.roleCard = {
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
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["mimo-v2.5", "mimo-v2.5"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("mimo-action:mimo-v2.5");
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
  });

  it("lets AI-pool custom LLM config override global model routing for actions", async () => {
    process.env.AI_LLM_PROVIDER = "models";
    process.env.AI_LLM_API_KEY = "global-key";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_LLM_MAX_RETRIES = "0";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const content = requestBody.messages.at(-1)?.content ?? "{}";
      const inputJson = content.includes("输入：") ? content.slice(content.indexOf("输入：") + "输入：".length) : content;
      const input = JSON.parse(inputJson) as {
        fallbackCandidateId?: string;
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      const candidateId = candidate?.id ?? input.fallbackCandidateId;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId, reason: "公开证据更清晰，先按这个候选执行。" }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = {
      ...buildAgentView(state, voter.seatId),
      llmConfig: {
        provider: "openai-compatible" as const,
        baseUrl: "https://custom.example.com",
        model: "deepseek-chat",
        apiKey: "custom-key",
        mergeSystemIntoUser: true,
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const actionProvider = createConfiguredAiOptions().actionProvider;
    if (!actionProvider) throw new Error("expected configured action provider");
    const result = await actionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { model: string };
    expect(body.model).toBe("deepseek-chat");
    expect(result.error).toBeUndefined();
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("custom-action:deepseek-chat");
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
  });

  it("keeps rotating action fallback personas after invalid fallback JSON", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT,Claude,GLM";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.5";
    process.env.AI_MODEL_CLAUDE = "claude-opus-4-6";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      if (requestBody.model === "deepseek-v4-flash" || requestBody.model === "gpt-5.5") {
        return new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      const input = JSON.parse(requestBody.messages.at(-1)?.content ?? "{}") as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason: "claim and vote pressure align" }) } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.5", "claude-opus-4-6"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("claude-action:claude-opus-4-6");
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
  });

  it("retries action output when the selected candidate has a malformed reason", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.5";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const input = JSON.parse(requestBody.messages.at(-1)?.content ?? "{}") as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      const reason = requestBody.model === "deepseek-v4-flash" ? '":"当前' : "public pressure and vote focus both point here";

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason }) } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.5"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("gpt-action:gpt-5.5");
    expect(result.command).toMatchObject({
      type: "vote",
      actorSeatId: voter.seatId,
      reason: "备选票线：公开发言和票型压力可解释，作为合法分歧票口。",
    });
  });

  it("uses the candidate public reason hint when the action model omits a reason", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "0";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      const content = requestBody.messages.at(-1)?.content ?? "{}";
      const inputJson = content.includes("输入：") ? content.slice(content.indexOf("输入：") + "输入：".length) : content;
      const input = JSON.parse(inputJson) as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
    expect("reason" in result.command ? result.command.reason : "").toBeTruthy();
  });

  it("retries action output when the reason contains a JSON fragment around natural text", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.5";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const input = JSON.parse(requestBody.messages.at(-1)?.content ?? "{}") as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      const reason =
        requestBody.model === "deepseek-v4-flash"
          ? '\":\"延续上一轮发言压力，'
          : "public pressure and vote focus both point here";

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.5"]);
    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({
      type: "vote",
      actorSeatId: voter.seatId,
      reason: "备选票线：公开发言和票型压力可解释，作为合法分歧票口。",
    });
  });

  it("retries day-vote output when a continuity candidate reason does not explain the pivot", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.5";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const input = JSON.parse(requestBody.messages.at(-1)?.content ?? "{}") as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      const reason =
        requestBody.model === "deepseek-v4-flash"
          ? "公开疑点较多，先投这里。"
          : "从上一轮发言点过的旧目标转票到这里，因为新增票型证据更硬。";

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const baseView = buildAgentView(state, voter.seatId);
    const voteAction = baseView.allowedActions.find((action) => action.type === "vote");
    const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
    const oldTarget = legalTargets[0];
    const newTarget = legalTargets.find((target) => target.seatId !== oldTarget?.seatId);
    if (!oldTarget || !newTarget) throw new Error("expected at least two vote targets");
    const view = {
      ...baseView,
      privateKnowledge: {
        ...baseView.privateKnowledge,
        aiMemory: {
          seatId: voter.seatId,
          day: state.day,
          lastSpeechTargetSeatId: oldTarget.seatId,
          lastSpeechStance: `${oldTarget.seatId}号发言没有解释清楚夜里信息`,
          beliefs: [],
        },
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = {
      ...createVotePlan(view, tableRead),
      target: { seatId: newTarget.seatId, name: newTarget.name },
      reason: "公开疑点较多，先投这里。",
      alternatives: [],
    };
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.5"]);
    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({
      type: "vote",
      actorSeatId: voter.seatId,
      targetSeatId: newTarget.seatId,
      reason: "从上一轮发言点过的旧目标转票到这里，因为新增票型证据更硬。",
    });
  });

  it("merges a candidate continuity hint instead of retrying an otherwise public vote reason", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "0";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      const content = requestBody.messages.at(-1)?.content ?? "{}";
      const inputJson = content.includes("输入：") ? content.slice(content.indexOf("输入：") + "输入：".length) : content;
      const input = JSON.parse(inputJson) as {
        candidates: Array<{ id: string; reasonHint?: string; command: { type: string; targetSeatId?: number } }>;
      };
      const voteCandidate =
        input.candidates.find((item) => item.command.type === "vote" && /speech-vote continuity/i.test(item.reasonHint ?? "")) ??
        input.candidates.find((item) => item.command.type === "vote" && item.command.targetSeatId);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidateId: voteCandidate?.id,
                  reason: "公开记忆显示这个位置回避站边，且多人发言提及，疑点未解除，投票先按公开疑点走。",
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
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const baseView = buildAgentView(state, voter.seatId);
    const voteAction = baseView.allowedActions.find((action) => action.type === "vote");
    const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
    const oldTarget = legalTargets[0];
    const newTarget = legalTargets.find((target) => target.seatId !== oldTarget?.seatId);
    if (!oldTarget || !newTarget) throw new Error("expected at least two vote targets");
    const view = {
      ...baseView,
      privateKnowledge: {
        ...baseView.privateKnowledge,
        aiMemory: {
          seatId: voter.seatId,
          day: state.day,
          lastSpeechTargetSeatId: oldTarget.seatId,
          lastSpeechStance: `${oldTarget.seatId}号发言没有解释清楚夜里信息`,
          beliefs: [],
        },
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = {
      ...createVotePlan(view, tableRead),
      target: { seatId: newTarget.seatId, name: newTarget.name },
      reason: "公开疑点较多，先投这里。",
      alternatives: [],
    };
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.isFallback).toBe(false);
    expect(result.command).toMatchObject({
      type: "vote",
      actorSeatId: voter.seatId,
      targetSeatId: newTarget.seatId,
    });
    expect("reason" in result.command ? result.command.reason : "").toMatch(/转票|新增|更硬/);
    expect("reason" in result.command ? result.command.reason : "").not.toContain("。；");
  });

  it("drops English action-reason fragments when a Chinese continuity hint is available", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "0";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      const content = requestBody.messages.at(-1)?.content ?? "{}";
      const inputJson = content.includes("输入：") ? content.slice(content.indexOf("输入：") + "输入：".length) : content;
      const input = JSON.parse(inputJson) as {
        candidates: Array<{ id: string; reasonHint?: string; command: { type: string; targetSeatId?: number } }>;
      };
      const voteCandidate =
        input.candidates.find((item) => item.command.type === "vote" && /speech-vote continuity/i.test(item.reasonHint ?? "")) ??
        input.candidates.find((item) => item.command.type === "vote" && item.command.targetSeatId);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidateId: voteCandidate?.id,
                  reason: "GPT-DS-chat-3 is the main public focus due to",
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
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const baseView = buildAgentView(state, voter.seatId);
    const voteAction = baseView.allowedActions.find((action) => action.type === "vote");
    const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
    const oldTarget = legalTargets[0];
    const newTarget = legalTargets.find((target) => target.seatId !== oldTarget?.seatId);
    if (!oldTarget || !newTarget) throw new Error("expected at least two vote targets");
    const view = {
      ...baseView,
      privateKnowledge: {
        ...baseView.privateKnowledge,
        aiMemory: {
          seatId: voter.seatId,
          day: state.day,
          lastSpeechTargetSeatId: oldTarget.seatId,
          lastSpeechStance: `${oldTarget.seatId}号发言没有解释清楚夜里信息`,
          beliefs: [],
        },
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = {
      ...createVotePlan(view, tableRead),
      target: { seatId: newTarget.seatId, name: newTarget.name },
      reason: "公开疑点较多，先投这里。",
      alternatives: [],
    };
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });
    const reason = "reason" in result.command ? result.command.reason ?? "" : "";

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.isFallback).toBe(false);
    expect(reason).toMatch(/转票|新增|更硬/);
    expect(reason).not.toMatch(/\bis the main public focus due to\b/i);
  });

  it("uses a public candidate reason hint when the model returns an English reason fragment", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "0";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      const content = requestBody.messages.at(-1)?.content ?? "{}";
      const inputJson = content.includes("输入：") ? content.slice(content.indexOf("输入：") + "输入：".length) : content;
      const input = JSON.parse(inputJson) as {
        candidates: Array<{ id: string; reasonHint?: string; command: { type: string; targetSeatId?: number } }>;
      };
      const voteCandidate =
        input.candidates.find((item) => item.command.type === "vote" && item.reasonHint && !/[A-Za-z]{2,}/.test(item.reasonHint)) ??
        input.candidates.find((item) => item.command.type === "vote" && item.command.targetSeatId);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidateId: voteCandidate?.id,
                  reason: "Mimo-DS-chat-5 has a public speech gap and should be pressured",
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
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });
    const reason = "reason" in result.command ? result.command.reason ?? "" : "";

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.isFallback).toBe(false);
    expect(reason).toBeTruthy();
    expect(reason).not.toMatch(/\bhas a public speech gap\b/i);
  });
});

function target(seatId: number, name: string): ActionTarget {
  return { seatId, name };
}

function knightActionView(targets: ActionTarget[], tableMemory: TableMemory): AgentView {
  return {
    gameId: "test-action-input",
    mySeatId: 1,
    myRole: "KNIGHT",
    phase: "KNIGHT_DUEL",
    day: 3,
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: true },
    aliveSeats: [target(1, "Knight"), ...targets],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory,
    },
    privateKnowledge: {},
    allowedActions: [{ type: "knightDuel", targets, canSkip: true }],
  } as AgentView;
}

function voteActionView(targets: ActionTarget[], tableMemory: TableMemory): AgentView {
  return {
    gameId: "test-action-vote-input",
    mySeatId: 1,
    myRole: "VILLAGER",
    phase: "DAY_VOTE",
    day: 3,
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false, wolfRoles: ["WEREWOLF"] },
    aliveSeats: [target(1, "Voter"), ...targets],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory,
    },
    privateKnowledge: { aiMemory: { seatId: 1, day: 3, beliefs: [] } },
    allowedActions: [{ type: "vote", targets, canAbstain: true }],
  } as AgentView;
}

function actionTableRead(seats: SeatRead[], tableMemory: TableMemory): AiTableRead {
  return {
    mySeatId: 1,
    myRole: "KNIGHT",
    day: 3,
    seats: [
      seatRead(target(1, "Knight"), {
        suspicion: 0,
        trust: 100,
        isSelf: true,
      }),
      ...seats,
    ],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [],
    focus: seats[0],
    backupFocus: seats[1],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory,
    tableMood: "test",
  };
}

function seatRead(targetSeat: ActionTarget, overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    ...targetSeat,
    suspicion: 50,
    trust: 50,
    pressure: [],
    isSelf: false,
    isKnownWolf: false,
    isKnownGood: false,
    isWolfTeammate: false,
    speechCount: 1,
    votesReceived: 0,
    publicClaims: [],
    publicChecksAgainst: [],
    publicStancesGiven: [],
    publicStancedBy: [],
    ...overrides,
  };
}

function emptyTableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 3,
    claimBoard: [],
    stanceBoard: [],
    stanceShifts: [],
    seerLegacies: [],
    speechInfluence: [],
    reasoningCues: [],
    counterclaims: [],
    focus: [],
    seats: [],
    voteHistory: [],
    deathAnnouncements: [],
    publicSignals: [],
    ...overrides,
  };
}

function setMimoPersona(seat: Seat): void {
  seat.persona = {
    id: "mimo-logic-checker",
    name: "Mimo",
    modelLabel: "mimo-v2.5",
    label: "细节校验型",
    style: "抓前后矛盾和公开发言细节。",
    goal: "用细节逼迫可疑位补逻辑。",
    riskTolerance: 0.45,
    bluffing: 0.4,
    preferences: {
      logic: 0.88,
      identity: 0.46,
      vote: 0.62,
      emotion: 0.26,
      memory: 0.86,
      leadership: 0.48,
      deception: 0.38,
      caution: 0.6,
    },
  };
}

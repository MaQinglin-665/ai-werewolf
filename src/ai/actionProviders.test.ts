import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfiguredAiOptions, createMockCommand, mockActionProvider } from "./mockAgent";
import { mockSpeechProvider } from "./speechProviders";
import { buildConstrainedActionInput, routedModelActionProvider, validateActionDecision } from "./actionProviders";
import { buildAiTableRead, createVotePlan } from "./tableRead";
import { buildAgentView } from "@/game/projection";
import { createGame } from "@/game/engine";
import type { ActionTarget, AgentView, AiTableRead, SeatRead, TableMemory } from "@/game/types";

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

  it("passes role-card guidance to routed action models while preserving legal and private boundaries", async () => {
    process.env.AI_LLM_MAX_RETRIES = "0";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      const input = JSON.parse(requestBody.messages.find((message) => message.role === "user")?.content ?? "{}") as {
        fallbackCandidateId?: string;
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id ?? input.fallbackCandidateId, reason: "公开证据更清晰。" }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const baseView = buildAgentView(state, voter.seatId);
    const view = {
      ...baseView,
      persona: {
        ...baseView.persona!,
        name: "柯南",
        roleCard: {
          source: "名侦探角色",
          speakingStyle: "短句、直接、先落结论。",
          reasoningStyle: "先找证据链，再压关键矛盾。",
          avoid: "不要卖萌，不要说固定台词。",
        },
      },
      llmConfig: {
        provider: "openai-compatible" as const,
        baseUrl: "https://custom.example.com",
        model: "role-card-action-model",
        apiKey: "custom-key",
      },
    };
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ role: string; content: string }> };
    const systemText = body.messages.find((message) => message.role === "system")?.content ?? "";
    expect(systemText).toContain("柯南");
    expect(systemText).toContain("名侦探角色");
    expect(systemText).toContain("短句、直接、先落结论。");
    expect(systemText).toContain("先找证据链，再压关键矛盾。");
    expect(systemText).toContain("不要卖萌，不要说固定台词。");
    expect(systemText).toContain("legal candidates");
    expect(systemText).toContain("never invent actions");
    expect(systemText).toContain("private/system context");
    expect(result.isFallback).toBe(false);
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

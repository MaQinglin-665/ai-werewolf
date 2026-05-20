import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfiguredAiOptions, createMockCommand, mockActionProvider } from "./mockAgent";
import { mockSpeechProvider } from "./speechProviders";
import { buildConstrainedActionInput, routedModelActionProvider } from "./actionProviders";
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
      reason: "public pressure and vote focus both point here",
    });
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

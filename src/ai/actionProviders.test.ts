import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfiguredAiOptions, createMockCommand, mockActionProvider } from "./mockAgent";
import { mockSpeechProvider } from "./speechProviders";
import { buildConstrainedActionInput, routedModelActionProvider } from "./actionProviders";
import { buildAiTableRead, createVotePlan } from "./tableRead";
import { buildAgentView } from "@/game/projection";
import { createGame } from "@/game/engine";
import type { ActionTarget, AgentView, AiTableRead, ClaimBoardItem, SeatRead, TableMemory } from "@/game/types";

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
  it("does not offer an unchallenged seer as a good-side vote candidate", () => {
    const seer = actionTarget(2, "Short Seer");
    const openTarget = actionTarget(3, "Open Target");
    const gold = actionTarget(4, "Gold");
    const seerClaim = actionRoleClaim(seer, "SEER");
    seerClaim.checks = [{ day: 1, target: gold, result: "GOOD" }];
    const memory = actionTableMemory({ claimBoard: [seerClaim] });
    const view = actionVoteView([seer, openTarget], memory);
    const tableRead = actionTableRead(
      [
        actionSeatRead({
          ...seer,
          suspicion: 88,
          trust: 18,
          pressure: ["short speech"],
          publicClaims: [seerClaim],
        }),
        actionSeatRead({
          ...openTarget,
          suspicion: 52,
          trust: 35,
          pressure: ["vote loop"],
        }),
      ],
      memory,
    );
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const input = buildConstrainedActionInput(view, { tableRead, votePlan, fallbackCommand });
    const voteCandidateIds = input.candidates
      .filter((candidate) => candidate.command.type === "vote" && candidate.command.targetSeatId !== undefined)
      .map((candidate) => candidate.id);

    expect(votePlan.target.seatId).toBe(openTarget.seatId);
    expect(voteCandidateIds).toContain(`vote:${openTarget.seatId}`);
    expect(voteCandidateIds).not.toContain(`vote:${seer.seatId}`);
  });

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

function actionVoteView(targets: ActionTarget[], tableMemory: TableMemory): AgentView {
  return {
    gameId: "test-action-candidates",
    mySeatId: 1,
    myRole: "VILLAGER",
    phase: "DAY_VOTE",
    day: 2,
    rules: { hasGuard: false, guardSaveConflictKills: false, hasWolfBeauty: false, hasKnight: false, wolfRoles: ["WEREWOLF"] },
    aliveSeats: [actionTarget(1, "Voter"), ...targets],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: tableMemory.claimBoard,
      tableMemory,
    },
    privateKnowledge: {},
    allowedActions: [{ type: "vote", targets, canAbstain: false }],
  } as AgentView;
}

function actionTableRead(seats: SeatRead[], tableMemory: TableMemory): AiTableRead {
  const self = actionSeatRead({
    seatId: 1,
    name: "Voter",
    suspicion: 0,
    trust: 100,
    isSelf: true,
  });

  return {
    mySeatId: 1,
    myRole: "VILLAGER",
    day: 2,
    seats: [self, ...seats],
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
  } as AiTableRead;
}

function actionSeatRead(overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    seatId: 2,
    name: "Seat",
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

function actionRoleClaim(claimant: ActionTarget, claimedRole: ClaimBoardItem["claimedRole"]): ClaimBoardItem {
  return {
    claimId: `${claimedRole}-${claimant.seatId}`,
    claimant,
    claimedRole,
    claimedRoleLabel: claimedRole,
    strength: "hard",
    checks: [],
    summary: `${claimant.name} claims ${claimedRole}.`,
    lastUpdatedDay: 2,
    sourceSpeechSeq: claimant.seatId,
  };
}

function actionTableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 2,
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

function actionTarget(seatId: number, name: string): ActionTarget {
  return { seatId, name };
}

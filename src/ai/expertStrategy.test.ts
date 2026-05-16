import { describe, expect, it } from "vitest";
import { createMockCommand } from "./mockAgent";
import { buildConstrainedActionInput } from "./actionProviders";
import { buildExpertStrategyNotes } from "./expertStrategy";
import { buildConstrainedSpeechInput, mockSpeechProvider } from "./speechProviders";
import { buildAiTableRead, createSpeechPlan, createVotePlan } from "./tableRead";
import { createGame } from "@/game/engine";
import { BOARD_PRESETS } from "@/game/boards";
import { buildAgentView } from "@/game/projection";
import type { RoleClaim } from "@/game/types";

describe("expert werewolf strategy notes", () => {
  it("injects expert strategy into speech and action inputs for every official board", () => {
    for (const boardId of Object.keys(BOARD_PRESETS)) {
      const state = createGame({ boardId, seed: 1201, humanSeatId: null });
      const voter = state.seats.find((seat) => seat.role === "VILLAGER") ?? state.seats.find((seat) => seat.isAi)!;
      state.phase = "DAY_VOTE";
      const view = buildAgentView(state, voter.seatId);
      const tableRead = buildAiTableRead(view);
      const votePlan = createVotePlan(view, tableRead);
      const fallbackCommand = createMockCommand(view, tableRead, votePlan);

      const speechInput = buildConstrainedSpeechInput(view, createSpeechPlan(view, tableRead));
      const actionInput = buildConstrainedActionInput(view, { tableRead, votePlan, fallbackCommand });

      expect(speechInput.expertStrategy.length, boardId).toBeGreaterThan(0);
      expect(actionInput.expertStrategy, boardId).toEqual(speechInput.expertStrategy);
      expect(speechInput.expertStrategy.join("\n"), boardId).toContain("公开信息链");
      expect(speechInput.advancedReasoning.length, boardId).toBeGreaterThan(0);
      expect(actionInput.advancedReasoning, boardId).toEqual(speechInput.advancedReasoning);
      expect(speechInput.advancedReasoning.join("\n"), boardId).toContain("身份坑审计");
    }
  });

  it("adds sheriff and seer-counterclaim heuristics to LLM speech and action inputs", () => {
    const state = createStrategyState();
    const voter = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const speechInput = buildConstrainedSpeechInput(view, createSpeechPlan(view, tableRead));
    const actionInput = buildConstrainedActionInput(view, { tableRead, votePlan, fallbackCommand });
    const notes = speechInput.expertStrategy.join("\n");
    const audit = speechInput.advancedReasoning.join("\n");

    expect(notes).toContain("警徽");
    expect(notes).toContain("真假预言家");
    expect(notes).toContain("验人结构");
    expect(notes).toContain("观点-依据-验证");
    expect(notes).toContain("起票、谁补票、谁最后跟票");
    expect(notes).toContain("验人力度");
    expect(audit).toContain("身份坑审计");
    expect(audit).toContain("预言家线审计");
    expect(audit).toContain("轮次意识");
    expect(speechInput.tableBriefing.text).toContain("当前推理清单");
    expect(actionInput.expertStrategy).toEqual(speechInput.expertStrategy);
    expect(actionInput.advancedReasoning).toEqual(speechInput.advancedReasoning);
  });

  it("feeds advanced table audits into mock fallback speech", async () => {
    const state = createStrategyState();
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const view = buildAgentView(state, speaker.seatId);

    const result = await mockSpeechProvider.generateSpeech(view, createSpeechPlan(view));

    expect(result.speech).toContain("身份坑先看");
    expect(result.speech).toContain("预言家对跳");
  });

  it("keeps sheriff table briefings available on sheriff boards", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1203, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const input = buildConstrainedSpeechInput(buildAgentView(state, speaker.seatId));

    expect(input.publicContext.rules.sheriffEnabled).toBe(true);
    expect(input.tableBriefing.text).toContain("本局有警上、警下、警徽和警长投票");
    expect(input.tableBriefing.text).not.toContain("没有警上、警下、警徽、警长流程，不要使用这些概念");
    expect(input.advancedReasoning.join("\n")).toContain("警长审计");
  });

  it("keeps wolf strategy guidance public-safe", () => {
    const state = createStrategyState();
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const view = buildAgentView(state, wolf.seatId);

    const notes = buildExpertStrategyNotes(view).join("\n");

    expect(notes).toContain("悍跳");
    expect(notes).toContain("倒钩");
    expect(notes).toContain("不暴露狼队信息");
  });

  it("adds board-specific notes for no-sheriff, guard, wolf-king, and white-wolf-king boards", () => {
    const noSheriff = buildExpertStrategyNotes(
      buildAgentView(createGame({ boardId: "9p-seer-witch-hunter", seed: 1202, humanSeatId: null }), 1),
    ).join("\n");
    const guard = buildExpertStrategyNotes(
      buildAgentView(createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1202, humanSeatId: null }), 1),
    ).join("\n");
    const wolfKing = buildExpertStrategyNotes(
      buildAgentView(createGame({ boardId: "12p-sheriff-wolf-king-seer-witch-hunter-guard", seed: 1202, humanSeatId: null }), 1),
    ).join("\n");
    const whiteWolfKing = buildExpertStrategyNotes(
      buildAgentView(
        createGame({ boardId: "12p-sheriff-white-wolf-king-seer-witch-hunter-guard", seed: 1202, humanSeatId: null }),
        1,
      ),
    ).join("\n");

    expect(noSheriff).toContain("无警长局");
    expect(guard).toContain("守卫局");
    expect(wolfKing).toContain("狼王局");
    expect(whiteWolfKing).toContain("白狼王局");
  });
});

function createStrategyState(): ReturnType<typeof createGame> {
  const state = createGame({ boardId: "12p-sheriff-wolf-king-seer-witch-hunter-guard", seed: 1200, humanSeatId: null });
  const seer = state.seats.find((seat) => seat.role === "SEER")!;
  const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
  const goldTarget = state.seats.find((seat) => seat.role === "VILLAGER")!;

  state.phase = "DAY_VOTE";
  state.roleClaims = [
    seerClaim({
      claimantSeatId: seer.seatId,
      targetSeatId: goldTarget.seatId,
      result: "GOOD",
      sourceSpeechSeq: 10,
    }),
    seerClaim({
      claimantSeatId: wolf.seatId,
      targetSeatId: seer.seatId,
      result: "WEREWOLF",
      sourceSpeechSeq: 20,
    }),
  ];
  return state;
}

function seerClaim({
  claimantSeatId,
  targetSeatId,
  result,
  sourceSpeechSeq,
}: {
  claimantSeatId: number;
  targetSeatId: number;
  result: "GOOD" | "WEREWOLF";
  sourceSpeechSeq: number;
}): RoleClaim {
  return {
    id: `${claimantSeatId}:SEER`,
    day: 1,
    claimantSeatId,
    claimedRole: "SEER",
    strength: "hard",
    checks: [{ day: 1, claimantSeatId, targetSeatId, result, sourceSpeechSeq }],
    message: `${claimantSeatId}号跳预言家。`,
    sourceSpeechSeq,
    updatedAtSeq: sourceSpeechSeq,
  };
}

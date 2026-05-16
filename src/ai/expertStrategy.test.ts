import { describe, expect, it } from "vitest";
import { createMockCommand } from "./mockAgent";
import { buildConstrainedActionInput } from "./actionProviders";
import { buildExpertStrategyNotes } from "./expertStrategy";
import { buildConstrainedSpeechInput } from "./speechProviders";
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

    expect(notes).toContain("警徽");
    expect(notes).toContain("真假预言家");
    expect(notes).toContain("验人结构");
    expect(actionInput.expertStrategy).toEqual(speechInput.expertStrategy);
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

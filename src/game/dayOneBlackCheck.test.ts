import { describe, expect, it } from "vitest";
import { buildAiTableRead } from "@/ai/tableRead";
import { applyCommand, createGame } from "./engine";
import { buildAgentView } from "./projection";

describe("day one black-check voting caution", () => {
  it("discounts a day-one black-check target until they have a chance to respond", () => {
    const buildRead = (withResponse: boolean) => {
      let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1 });
      const target = state.seats.find((seat) => seat.role === "HUNTER")!;
      const claimant = state.seats.find((seat) => seat.seatId !== target.seatId && seat.isAi)!;
      const voter = state.seats.find(
        (seat) => seat.role === "VILLAGER" && seat.isAi && seat.seatId !== target.seatId && seat.seatId !== claimant.seatId,
      )!;

      state.phase = "DAY_SPEECH";
      state.speechQueue = withResponse ? [target.seatId, claimant.seatId, target.seatId] : [target.seatId, claimant.seatId];
      state.speechIndex = 0;
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: target.seatId,
        message: "我先听后置位发言，今天不要散票。",
      });
      state = applyCommand(state, {
        type: "speak",
        actorSeatId: claimant.seatId,
        message: `我跳预言家，${target.seatId}号是查杀。`,
      });
      if (withResponse) {
        state = applyCommand(state, {
          type: "speak",
          actorSeatId: target.seatId,
          message: `我回应${claimant.seatId}号的查杀，这条预言家线不成立。`,
        });
      }
      state.phase = "DAY_VOTE";

      const tableRead = buildAiTableRead(buildAgentView(state, voter.seatId));
      return {
        claimant,
        targetRead: tableRead.seats.find((seat) => seat.seatId === target.seatId)!,
      };
    };

    const unanswered = buildRead(false);
    const answered = buildRead(true);

    expect(unanswered.targetRead.pressure).toContain(`被${unanswered.claimant.name}后置查杀但尚未回应`);
    expect(answered.targetRead.pressure).toContain(`被${answered.claimant.name}公开报查杀`);
    expect(unanswered.targetRead.suspicion).toBeLessThan(answered.targetRead.suspicion);
  });
});

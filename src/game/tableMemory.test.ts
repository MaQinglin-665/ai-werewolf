import { describe, expect, it } from "vitest";
import { applyCommand, createGame } from "./engine";
import { buildTableMemory } from "./tableMemory";

describe("table memory stance shifts", () => {
  it("detects role-side switches across different seer claimants", () => {
    let state = createGame({ seed: 45 });
    const actorSeatId = state.humanSeatId;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [actorSeatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId,
      message: "我认3号预言家，今天先站3号这条线。",
    });

    state.day = 2;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [actorSeatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId,
      message: "我认4号预言家，今天重新站4号这条线。",
    });

    const memory = buildTableMemory(state);

    expect(memory.stanceShifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: expect.objectContaining({ seatId: actorSeatId }),
          fromTarget: expect.objectContaining({ seatId: 3 }),
          toTarget: expect.objectContaining({ seatId: 4 }),
          fromKind: "SUPPORT",
          toKind: "SUPPORT",
        }),
      ]),
    );
  });
});

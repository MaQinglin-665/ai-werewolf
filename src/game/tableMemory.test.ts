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

describe("table memory death-shape public cues", () => {
  it("treats a day-one single death as public potion-line context on no-guard witch boards", () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 91 });
    const deadSeat = state.seats.find((seat) => seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });

    const memory = buildTableMemory(state);

    expect(memory.reasoningCues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "death_shape",
          weight: "medium",
          target: expect.objectContaining({ seatId: deadSeat.seatId }),
          summary: expect.stringMatching(/首夜单死.*药线假设.*不能断定/),
        }),
      ]),
    );
    expect(memory.publicSignals.join("\n")).toMatch(/首夜单死.*药线假设/);
  });

  it("does not add no-guard potion-line cues on guard boards", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 91 });
    const deadSeat = state.seats.find((seat) => seat.role !== "WEREWOLF")!;
    state.events.push({
      seq: state.events.length + 1,
      type: "DAY_STARTED",
      visibility: "public",
      day: 1,
      phase: "DAY_ANNOUNCEMENT",
      message: `第1天清晨，${deadSeat.seatId}号 死亡。`,
      payload: { deadSeatIds: [deadSeat.seatId] },
    });

    const memory = buildTableMemory(state);

    expect(memory.reasoningCues.some((cue) => cue.kind === "death_shape")).toBe(false);
    expect(memory.publicSignals.join("\n")).not.toMatch(/药线假设/);
  });
});

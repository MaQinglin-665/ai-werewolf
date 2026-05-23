import { describe, expect, it } from "vitest";
import { applyCommand, createGame, getTurnRequirement } from "./engine";

function markHumanSeats(state: ReturnType<typeof createGame>, humanSeatIds: number[]) {
  const humanSeats = new Set(humanSeatIds);
  state.seats = state.seats.map((seat) => ({
    ...seat,
    isAi: !humanSeats.has(seat.seatId),
  }));
}

describe("multi-human engine scheduling", () => {
  it("queues every human voter before AI voters even when humanSeatId points elsewhere", () => {
    let state = createGame({ seed: 1, humanSeatId: 1 });
    state.phase = "DAY_VOTE";
    state.humanSeatId = 1;
    markHumanSeats(state, [2, 4]);

    expect(getTurnRequirement(state)).toMatchObject({ type: "human", actorSeatId: 2 });

    state = applyCommand(state, { type: "vote", actorSeatId: 2, targetSeatId: 1 });
    expect(getTurnRequirement(state)).toMatchObject({ type: "human", actorSeatId: 4 });

    state = applyCommand(state, { type: "vote", actorSeatId: 4, targetSeatId: 1 });
    expect(getTurnRequirement(state)).toMatchObject({ type: "ai", actorSeatId: 1 });
  });

  it("queues every human sheriff nomination before AI nomination choices", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 2, humanSeatId: 1 });
    state.phase = "SHERIFF_NOMINATION";
    state.sheriff = {
      candidates: [],
      nominationDecisions: {},
      withdrawnSeatIds: [],
      withdrawalDecisions: {},
      votes: {},
      speechQueue: [],
      speechIndex: 0,
      resolved: false,
    };
    markHumanSeats(state, [3, 5]);

    expect(getTurnRequirement(state)).toMatchObject({ type: "human", actorSeatId: 3 });

    state = applyCommand(state, { type: "sheriffNominate", actorSeatId: 3, run: false });
    expect(getTurnRequirement(state)).toMatchObject({ type: "human", actorSeatId: 5 });

    state = applyCommand(state, { type: "sheriffNominate", actorSeatId: 5, run: true });
    expect(getTurnRequirement(state)).toMatchObject({ type: "ai", actorSeatId: 1 });
  });

  it("queues every human sheriff withdrawal candidate before AI withdrawal choices", () => {
    let state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 3, humanSeatId: 1 });
    state.phase = "SHERIFF_WITHDRAWAL";
    state.sheriff = {
      candidates: [2, 4, 6],
      nominationDecisions: {},
      withdrawnSeatIds: [],
      withdrawalDecisions: {},
      votes: {},
      speechQueue: [],
      speechIndex: 0,
      resolved: false,
    };
    markHumanSeats(state, [2, 4]);

    expect(getTurnRequirement(state)).toMatchObject({ type: "human", actorSeatId: 2 });

    state = applyCommand(state, { type: "sheriffWithdraw", actorSeatId: 2, withdraw: false });
    expect(getTurnRequirement(state)).toMatchObject({ type: "human", actorSeatId: 4 });

    state = applyCommand(state, { type: "sheriffWithdraw", actorSeatId: 4, withdraw: false });
    expect(getTurnRequirement(state)).toMatchObject({ type: "ai", actorSeatId: 6 });
  });
});

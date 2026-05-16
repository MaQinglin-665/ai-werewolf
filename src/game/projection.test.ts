import { describe, expect, it } from "vitest";
import { createGame } from "./engine";
import { buildHumanView, buildPlayerView } from "./projection";

function createTwoHumanState() {
  const state = createGame({ seed: 1, humanSeatId: 1 });
  const seer = state.seats.find((seat) => seat.role === "SEER");
  const witch = state.seats.find((seat) => seat.role === "WITCH");

  if (!seer || !witch) {
    throw new Error("test seed must include a seer and witch");
  }

  state.spectatorMode = false;
  state.humanSeatId = seer.seatId;
  for (const seat of state.seats) {
    seat.isAi = true;
  }
  seer.isAi = false;
  witch.isAi = false;
  seer.name = `${seer.seatId}号 玩家`;
  witch.name = `${witch.seatId}号 玩家`;

  return {
    state,
    seerSeatId: seer.seatId,
    witchSeatId: witch.seatId,
  };
}

describe("human projection", () => {
  it("builds private views for each viewer seat", () => {
    const { state, seerSeatId, witchSeatId } = createTwoHumanState();

    const seerView = buildPlayerView(state, seerSeatId);
    const witchView = buildPlayerView(state, witchSeatId);

    expect(seerView.humanSeatId).toBe(seerSeatId);
    expect(seerView.myRole).toBe("SEER");
    expect(seerView.witch).toBeUndefined();
    expect(seerView.seats.find((seat) => seat.seatId === seerSeatId)?.isHuman).toBe(true);
    expect(seerView.seats.find((seat) => seat.seatId === witchSeatId)?.isHuman).toBe(false);
    expect(seerView.seats.find((seat) => seat.seatId === witchSeatId)?.role).toBeUndefined();

    expect(witchView.humanSeatId).toBe(witchSeatId);
    expect(witchView.myRole).toBe("WITCH");
    expect(witchView.witch).toEqual(state.witch);
    expect(witchView.seats.find((seat) => seat.seatId === witchSeatId)?.isHuman).toBe(true);
    expect(witchView.seats.find((seat) => seat.seatId === seerSeatId)?.isHuman).toBe(false);
    expect(witchView.seats.find((seat) => seat.seatId === seerSeatId)?.role).toBeUndefined();
  });

  it("filters private events by viewer seat", () => {
    const { state, seerSeatId, witchSeatId } = createTwoHumanState();

    const seerView = buildPlayerView(state, seerSeatId);
    const witchView = buildPlayerView(state, witchSeatId);

    expect(seerView.privateEvents.length).toBeGreaterThan(0);
    expect(witchView.privateEvents.length).toBeGreaterThan(0);
    expect(seerView.privateEvents.every((event) => event.actorSeatId === seerSeatId)).toBe(true);
    expect(witchView.privateEvents.every((event) => event.actorSeatId === witchSeatId)).toBe(true);
  });

  it("only gives the current public action to the active viewer", () => {
    const { state, seerSeatId, witchSeatId } = createTwoHumanState();
    state.phase = "DAY_SPEECH";
    state.speechQueue = [seerSeatId, witchSeatId];
    state.speechIndex = 0;

    const speakerView = buildPlayerView(state, seerSeatId);
    const waitingView = buildPlayerView(state, witchSeatId);
    const legacyView = buildHumanView(state);

    expect(speakerView.currentActorSeatId).toBe(seerSeatId);
    expect(speakerView.availableActions).toEqual([{ type: "speak" }]);
    expect(waitingView.currentActorSeatId).toBe(seerSeatId);
    expect(waitingView.availableActions).toEqual([]);
    expect(legacyView.availableActions).toEqual([{ type: "speak" }]);
  });

  it("hides private night actors from other human viewers", () => {
    const { state, seerSeatId, witchSeatId } = createTwoHumanState();
    state.phase = "NIGHT_SEER";

    const seerView = buildPlayerView(state, seerSeatId);
    const witchView = buildPlayerView(state, witchSeatId);

    expect(seerView.currentActorSeatId).toBe(seerSeatId);
    expect(seerView.availableActions[0]?.type).toBe("seerCheck");
    expect(witchView.currentActorSeatId).toBeUndefined();
    expect(witchView.availableActions).toEqual([]);
  });
});

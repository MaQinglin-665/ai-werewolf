import { describe, expect, it } from "vitest";
import { applyCommand, applySystemStep, createGame } from "./engine";
import { buildPublicVoteSnapshot } from "./voteSnapshot";

describe("public vote snapshot", () => {
  it("shows sealed vote progress during voting without leaking targets or reasons", () => {
    let state = createGame({ seed: 30 });
    state.phase = "DAY_VOTE";
    state = applyCommand(state, { type: "vote", actorSeatId: 1, targetSeatId: 2, reason: "测试理由" });

    const snapshot = buildPublicVoteSnapshot(state);

    expect(snapshot.revealed).toBe(false);
    expect(snapshot.votes).toEqual([]);
    expect(snapshot.tally).toEqual([]);
    expect(snapshot.leaders).toEqual([]);
    expect(snapshot.eligibleSeatIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(snapshot.lockedSeatIds).toEqual([1]);
    expect(snapshot.pendingSeatIds).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(JSON.stringify(snapshot)).not.toContain("测试理由");
    expect(JSON.stringify(snapshot)).not.toContain("target");
  });

  it("reveals public votes, tally, leaders, and abstain count after vote resolution", () => {
    let state = createGame({ seed: 31 });
    state.phase = "DAY_VOTE";
    state = applyCommand(state, { type: "vote", actorSeatId: 1, targetSeatId: 2, reason: "投2号" });
    state.votes = {
      "1": 2,
      "2": null,
      "3": 2,
      "4": 3,
    };
    state.phase = "EXILE_RESOLUTION";
    state = applySystemStep(state);

    const snapshot = buildPublicVoteSnapshot(state);

    expect(snapshot.revealed).toBe(true);
    expect(snapshot.tally).toEqual([
      { target: { seatId: 2, name: expect.any(String) }, count: 2 },
      { target: { seatId: 3, name: expect.any(String) }, count: 1 },
    ]);
    expect(snapshot.abstainCount).toBe(1);
    expect(snapshot.leaders).toEqual([{ seatId: 2, name: expect.any(String) }]);
    expect(snapshot.votes).toContainEqual(
      expect.objectContaining({
        voter: expect.objectContaining({ seatId: 1 }),
        target: expect.objectContaining({ seatId: 2 }),
        reason: "投2号",
      }),
    );
  });
});

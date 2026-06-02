import { describe, expect, it } from "vitest";
import { createGame } from "@/game/engine";
import { advanceRoomToNextStop, type RoomAdvanceStopReason } from "./roomAdvance";

describe("advanceRoomToNextStop", () => {
  it("advances ordinary AI and system night flow until the next human or public stop", async () => {
    const initial = createGame({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: 1,
      seed: 91,
    });

    const result = await advanceRoomToNextStop(initial, {
      maxSteps: 32,
      forceMockAi: true,
    });

    expect(result.state.phase).not.toBe("NIGHT_SEER");
    expect(["DAY_ANNOUNCEMENT", "DAY_SPEECH", "GAME_OVER"]).toContain(result.state.phase);
    expect(result.trace.length).toBeGreaterThan(1);
    expect(result.trace.map((entry) => entry.phase)).toContain("NIGHT_WOLVES");
    expect(result.stopReason satisfies RoomAdvanceStopReason).toBeTruthy();
  });

  it("stops immediately when a human action is pending", async () => {
    const initial = createGame({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: 1,
      seed: "room-advance-human-wolf",
    });

    const result = await advanceRoomToNextStop(initial, {
      maxSteps: 32,
      forceMockAi: true,
    });

    if (result.trace[0]?.requirementType === "human") {
      expect(result.state).toBe(initial);
      expect(result.stopReason).toBe("human-action");
    }
  });

  it("reports step-limit traces instead of looping forever", async () => {
    const initial = createGame({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: 1,
      seed: 91,
    });

    const result = await advanceRoomToNextStop(initial, {
      maxSteps: 0,
      forceMockAi: true,
    });

    expect(result.stopReason).toBe("step-limit");
    expect(result.trace).toHaveLength(1);
    expect(result.state).toBe(initial);
  });
});

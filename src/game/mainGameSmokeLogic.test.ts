import { describe, expect, it } from "vitest";
import { buildMainGameStreamCommandPath, shouldRetryMainGameSmokeAttempt } from "../../scripts/main-game-smoke-logic.mjs";

describe("shouldRetryMainGameSmokeAttempt", () => {
  it("uses the dev-server reachable stream command route", () => {
    expect(buildMainGameStreamCommandPath("game 1")).toBe("/api/games/game%201/stream-command");
    expect(buildMainGameStreamCommandPath("game-1")).not.toContain("/commands/stream");
  });

  it("retries when the first human action appears outside night before any human night action", () => {
    expect(
      shouldRetryMainGameSmokeAttempt({
        phase: "HUNTER_REVEAL",
        submittedHumanNightAction: false,
        humanActionType: "hunterReveal",
      }),
    ).toBe(true);
  });

  it("does not retry night human actions because the smoke can submit them", () => {
    expect(
      shouldRetryMainGameSmokeAttempt({
        phase: "NIGHT_SEER",
        submittedHumanNightAction: false,
        humanActionType: "seerCheck",
      }),
    ).toBe(false);
  });
});

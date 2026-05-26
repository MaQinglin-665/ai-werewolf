import { describe, expect, it } from "vitest";
import { shouldRetryMainGameSmokeAttempt } from "../../scripts/main-game-smoke-logic.mjs";

describe("shouldRetryMainGameSmokeAttempt", () => {
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

import { describe, expect, it } from "vitest";
import { getClassTrialThemeFlow, shouldMinimizeClassTrialPhase } from "./classTrialThemeFlow";

describe("classTrialThemeFlow", () => {
  it("minimizes ordinary night action labels for class-trial mode", () => {
    expect(shouldMinimizeClassTrialPhase("NIGHT_WOLVES")).toBe(true);
    expect(shouldMinimizeClassTrialPhase("NIGHT_SEER")).toBe(true);
    expect(shouldMinimizeClassTrialPhase("NIGHT_WITCH")).toBe(true);
    expect(shouldMinimizeClassTrialPhase("DAY_SPEECH")).toBe(false);
  });

  it("maps day speech to testimony instead of ordinary Werewolf speech", () => {
    const flow = getClassTrialThemeFlow({ phase: "DAY_SPEECH", day: 1, result: undefined });

    expect(flow.step).toBe("testimony");
    expect(flow.label).toBe("证言审理");
    expect(flow.showAsTrialSurface).toBe(true);
  });

  it("maps sealed and reveal vote states to trial steps", () => {
    expect(getClassTrialThemeFlow({ phase: "DAY_VOTE", day: 1, result: undefined }).step).toBe("sealed-vote");
    expect(getClassTrialThemeFlow({ phase: "EXILE_RESOLUTION", day: 1, result: undefined }).step).toBe("vote-reveal");
  });

  it("maps game over to verdict review", () => {
    const flow = getClassTrialThemeFlow({
      phase: "GAME_OVER",
      day: 2,
      result: { winner: "GOOD", reason: "所有狼人出局" },
    });

    expect(flow.step).toBe("review");
    expect(flow.label).toBe("审判复盘");
  });
});

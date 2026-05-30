import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { getThemedPhaseCurtainCue } from "./phaseCurtainModel";

function makeGame(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 1,
    phase: "NIGHT_WOLVES",
    phaseLabel: "狼人行动",
    board: {
      id: "9p-seer-witch-hunter",
      name: "9人预女猎",
      description: "test",
      seatCount: 9,
      roleSummary: "3狼 3民 预言家 女巫 猎人",
      hasGuard: false,
      hasSheriff: false,
      winCondition: "side-slaughter",
    },
    humanSeatId: null,
    seats: [],
    publicEvents: [],
    privateEvents: [],
    availableActions: [],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      claimBoard: [],
      aiReasonHighlights: [],
      phaseSteps: [],
      tableMemory: {
        day: 1,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    ...overrides,
  };
}

function expectCurtainCue(cue: ReturnType<typeof getThemedPhaseCurtainCue>) {
  expect(cue).not.toBeNull();
  if (!cue) throw new Error("Expected a phase curtain cue.");
  return cue;
}

describe("getThemedPhaseCurtainCue", () => {
  it("keeps default phase curtains for ordinary games", () => {
    const cue = expectCurtainCue(getThemedPhaseCurtainCue(makeGame(), { classTrialThemeActive: false }));

    expect(cue.presentation).not.toBe("class-trial");
    expect(cue.durationMs).toBe(1650);
    expect(cue.title).toBe("天黑请闭眼");
  });

  it("skips hidden night action curtains for themed games", () => {
    const cue = getThemedPhaseCurtainCue(makeGame(), { classTrialThemeActive: true });

    expect(cue).toBeNull();
  });

  it("uses class-trial phase scenes for visible themed transitions", () => {
    const cue = expectCurtainCue(
      getThemedPhaseCurtainCue(makeGame({ phase: "DAY_ANNOUNCEMENT", phaseLabel: "天亮公布" }), {
        classTrialThemeActive: true,
      }),
    );

    expect(cue.presentation).toBe("class-trial");
    expect(cue.durationMs).toBe(3000);
    expect(cue.title).toBe("天亮，结果公开");
  });
});

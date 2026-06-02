import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import {
  getClassTrialOpeningNightCurtainCue,
  getThemedPhaseCurtainCue,
  shouldRenderClassTrialOpeningNightCurtain,
  shouldRenderThemedPhaseCurtain,
} from "./phaseCurtainModel";

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

  it("uses class-trial night curtains so hidden role actions are visually paced", () => {
    const cue = expectCurtainCue(getThemedPhaseCurtainCue(makeGame(), { classTrialThemeActive: true }));

    expect(cue.presentation).toBe("class-trial");
    expect(cue.durationMs).toBe(3000);
    expect(cue.title).toBe("夜晚降临");
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

  it("defers the class-trial opening night curtain until the character intro has finished", () => {
    const game = makeGame({ id: "class-trial-game-1" });

    expect(
      shouldRenderThemedPhaseCurtain(game, {
        classTrialIntroPending: true,
        roleIntroGameId: null,
      }),
    ).toBe(false);
    expect(
      shouldRenderThemedPhaseCurtain(game, {
        classTrialIntroPending: false,
        roleIntroGameId: null,
      }),
    ).toBe(true);
  });

  it("still defers phase curtains while the human role intro is open", () => {
    const game = makeGame({ id: "game-with-role-intro" });

    expect(
      shouldRenderThemedPhaseCurtain(game, {
        classTrialIntroPending: false,
        roleIntroGameId: "game-with-role-intro",
      }),
    ).toBe(false);
  });

  it("shows a dedicated opening nightfall curtain after the class-trial character intro", () => {
    const game = makeGame({ id: "class-trial-game-1", day: 1, phase: "NIGHT_SEER" });

    expect(
      shouldRenderClassTrialOpeningNightCurtain(game, {
        classTrialThemeActive: true,
        classTrialIntroPending: false,
        completedClassTrialIntroGameId: "class-trial-game-1",
        completedClassTrialOpeningNightCurtainGameId: null,
        roleIntroGameId: null,
      }),
    ).toBe(true);

    const cue = getClassTrialOpeningNightCurtainCue(game);
    expect(cue.presentation).toBe("class-trial");
    expect(cue.durationMs).toBe(3000);
    expect(cue.title).toBe("夜晚降临");
  });

  it("does not repeat the opening nightfall curtain while intro or role cards are still blocking play", () => {
    const game = makeGame({ id: "class-trial-game-1", day: 1, phase: "NIGHT_SEER" });

    expect(
      shouldRenderClassTrialOpeningNightCurtain(game, {
        classTrialThemeActive: true,
        classTrialIntroPending: true,
        completedClassTrialIntroGameId: null,
        completedClassTrialOpeningNightCurtainGameId: null,
        roleIntroGameId: null,
      }),
    ).toBe(false);
    expect(
      shouldRenderClassTrialOpeningNightCurtain(game, {
        classTrialThemeActive: true,
        classTrialIntroPending: false,
        completedClassTrialIntroGameId: "class-trial-game-1",
        completedClassTrialOpeningNightCurtainGameId: null,
        roleIntroGameId: "class-trial-game-1",
      }),
    ).toBe(false);
  });

  it("does not repeat the opening nightfall curtain after it has already played", () => {
    const game = makeGame({ id: "class-trial-game-1", day: 1, phase: "NIGHT_SEER" });

    expect(
      shouldRenderClassTrialOpeningNightCurtain(game, {
        classTrialThemeActive: true,
        classTrialIntroPending: false,
        completedClassTrialIntroGameId: "class-trial-game-1",
        completedClassTrialOpeningNightCurtainGameId: "class-trial-game-1",
        roleIntroGameId: null,
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { getClassTrialFlowModel } from "./classTrialFlowModel";

type FlowGame = Pick<HumanGameView, "id" | "day" | "phase">;

function makeGame(overrides: Partial<FlowGame> = {}): FlowGame {
  return {
    id: "game-1",
    day: 1,
    phase: "NIGHT_WOLVES",
    ...overrides,
  };
}

function getModel(overrides: Partial<Parameters<typeof getClassTrialFlowModel>[0]> = {}) {
  return getClassTrialFlowModel({
    game: makeGame(),
    classTrialThemeActive: true,
    classTrialIntroGameId: null,
    completedClassTrialIntroGameId: null,
    completedClassTrialOpeningNightCurtainGameId: null,
    roleIntroGameId: null,
    ...overrides,
  });
}

describe("getClassTrialFlowModel", () => {
  it("returns a neutral model before a game is loaded", () => {
    expect(getModel({ game: null })).toEqual({
      roleIntroPending: false,
      introPending: false,
      openingNightCurtainPending: false,
      pauseAutoAdvance: false,
      pauseHostAudio: false,
      pauseAiAudio: false,
      pauseVoicePrewarm: false,
      allowThemedPhaseCurtain: false,
    });
  });

  it("pauses all automated flow while the class-trial opening intro is pending", () => {
    const model = getModel({
      classTrialIntroGameId: "game-1",
      completedClassTrialIntroGameId: null,
    });

    expect(model.introPending).toBe(true);
    expect(model.openingNightCurtainPending).toBe(false);
    expect(model.allowThemedPhaseCurtain).toBe(false);
    expect(model.pauseAutoAdvance).toBe(true);
    expect(model.pauseHostAudio).toBe(true);
    expect(model.pauseAiAudio).toBe(true);
    expect(model.pauseVoicePrewarm).toBe(true);
  });

  it("shows the dedicated opening night curtain after the class-trial intro completes", () => {
    const model = getModel({
      completedClassTrialIntroGameId: "game-1",
      completedClassTrialOpeningNightCurtainGameId: null,
    });

    expect(model.introPending).toBe(false);
    expect(model.openingNightCurtainPending).toBe(true);
    expect(model.allowThemedPhaseCurtain).toBe(true);
    expect(model.pauseAutoAdvance).toBe(true);
    expect(model.pauseHostAudio).toBe(true);
    expect(model.pauseAiAudio).toBe(true);
    expect(model.pauseVoicePrewarm).toBe(true);
  });

  it("does not repeat the opening night curtain once it has completed", () => {
    const model = getModel({
      completedClassTrialIntroGameId: "game-1",
      completedClassTrialOpeningNightCurtainGameId: "game-1",
    });

    expect(model.openingNightCurtainPending).toBe(false);
    expect(model.allowThemedPhaseCurtain).toBe(true);
    expect(model.pauseAutoAdvance).toBe(false);
  });

  it("uses the same pause surface while the human role intro blocks play", () => {
    const model = getModel({
      completedClassTrialIntroGameId: "game-1",
      roleIntroGameId: "game-1",
    });

    expect(model.roleIntroPending).toBe(true);
    expect(model.openingNightCurtainPending).toBe(false);
    expect(model.allowThemedPhaseCurtain).toBe(false);
    expect(model.pauseAutoAdvance).toBe(true);
    expect(model.pauseHostAudio).toBe(true);
    expect(model.pauseAiAudio).toBe(true);
    expect(model.pauseVoicePrewarm).toBe(true);
  });

  it("ignores stale class-trial intro ids and leaves ordinary flow unpaused", () => {
    const model = getModel({
      classTrialThemeActive: false,
      classTrialIntroGameId: "game-1",
      completedClassTrialIntroGameId: null,
    });

    expect(model.introPending).toBe(false);
    expect(model.openingNightCurtainPending).toBe(false);
    expect(model.allowThemedPhaseCurtain).toBe(true);
    expect(model.pauseAutoAdvance).toBe(false);
    expect(model.pauseHostAudio).toBe(false);
    expect(model.pauseAiAudio).toBe(false);
    expect(model.pauseVoicePrewarm).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildClassTrialLookaheadCompletedSpeechKeys,
  shouldAdvanceClassTrialLookaheadToSpeech,
  isMatchingClassTrialAudioLookahead,
  shouldStartClassTrialAudioLookahead,
  type ClassTrialAudioLookaheadRun,
} from "./classTrialAudioLookahead";

describe("classTrialAudioLookahead", () => {
  it("starts lookahead only for one class-trial continue step with speech audio enabled", () => {
    expect(
      shouldStartClassTrialAudioLookahead({
        enabled: true,
        classTrialThemeActive: true,
        roleIntroActive: false,
        availableActions: [{ type: "continue" }],
        sourceSpeechKey: "game-1:10:3",
        activeBufferedKey: null,
      }),
    ).toBe(true);

    expect(
      shouldStartClassTrialAudioLookahead({
        enabled: true,
        classTrialThemeActive: true,
        roleIntroActive: false,
        availableActions: [{ type: "vote" }],
        sourceSpeechKey: "game-1:10:3",
        activeBufferedKey: null,
      }),
    ).toBe(false);

    expect(
      shouldStartClassTrialAudioLookahead({
        enabled: true,
        classTrialThemeActive: true,
        roleIntroActive: false,
        availableActions: [{ type: "continue" }],
        sourceSpeechKey: "game-1:10:3",
        activeBufferedKey: "game-1:10:3",
      }),
    ).toBe(false);
  });

  it("treats the currently playing speech as completed when finding the next speech cue", () => {
    const completed = new Set(["game-1:8:1"]);
    const nextCompleted = buildClassTrialLookaheadCompletedSpeechKeys(completed, "game-1:10:3");

    expect([...nextCompleted].sort()).toEqual(["game-1:10:3", "game-1:8:1"]);
    expect(completed.has("game-1:10:3")).toBe(false);
  });

  it("continues one more background step when lookahead reaches the next speaker without a speech cue", () => {
    expect(
      shouldAdvanceClassTrialLookaheadToSpeech({
        enabled: true,
        classTrialThemeActive: true,
        roleIntroActive: false,
        phase: "DAY_SPEECH",
        currentSpeakerSeatId: 2,
        availableActions: [{ type: "continue" }],
        hasPendingSpeechCue: false,
      }),
    ).toBe(true);

    expect(
      shouldAdvanceClassTrialLookaheadToSpeech({
        enabled: true,
        classTrialThemeActive: true,
        roleIntroActive: false,
        phase: "DAY_SPEECH",
        currentSpeakerSeatId: 2,
        availableActions: [{ type: "continue" }],
        hasPendingSpeechCue: true,
      }),
    ).toBe(false);

    expect(
      shouldAdvanceClassTrialLookaheadToSpeech({
        enabled: true,
        classTrialThemeActive: true,
        roleIntroActive: false,
        phase: "DAY_VOTE",
        currentSpeakerSeatId: undefined,
        availableActions: [{ type: "continue" }],
        hasPendingSpeechCue: false,
      }),
    ).toBe(false);
  });

  it("consumes only the buffered continue result that matches the active audio run", () => {
    const buffered: ClassTrialAudioLookaheadRun<string> = {
      gameId: "game-1",
      sourceSpeechKey: "game-1:10:3",
      runId: 7,
      promise: Promise.resolve("next"),
    };

    expect(
      isMatchingClassTrialAudioLookahead(buffered, {
        gameId: "game-1",
        sourceSpeechKey: "game-1:10:3",
        runId: 7,
        activeRunId: 7,
      }),
    ).toBe(true);

    expect(
      isMatchingClassTrialAudioLookahead(buffered, {
        gameId: "game-1",
        sourceSpeechKey: "game-1:10:3",
        runId: 7,
        activeRunId: 8,
      }),
    ).toBe(false);
  });
});

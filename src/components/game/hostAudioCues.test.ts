import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { buildHostAudioCue, hostClipPreDelayMs, hostClipSrc } from "./hostAudioCues";

describe("hostAudioCues", () => {
  it("prompts the human speaker during day speech", () => {
    const game = gameView({
      phase: "DAY_SPEECH",
      currentSpeakerSeatId: 1,
      seats: [seat(1, true), seat(2, false)],
    });

    expect(buildHostAudioCue(game)).toEqual({
      key: "game-1:1:speech:human",
      clips: ["/audio/host/your-turn-speak.mp3"],
    });
  });

  it("prompts an AI speaker by seat during day speech", () => {
    const game = gameView({
      phase: "DAY_SPEECH",
      currentSpeakerSeatId: 2,
      seats: [seat(1, true), seat(2, false)],
    });

    expect(buildHostAudioCue(game)).toEqual({
      key: "game-1:1:speech:2",
      clips: ["/audio/host/seat-2.mp3", { src: "/audio/host/please-speak.mp3", playbackRate: 1.16, volume: 0.88 }],
    });
  });

  it("builds a dawn death report from the latest announcement message", () => {
    const game = gameView({
      phase: "DAY_ANNOUNCEMENT",
      publicEvents: [
        publicEvent({ seq: 1, phase: "NIGHT_WOLVES", message: "夜晚结束。" }),
        publicEvent({ seq: 2, phase: "DAY_ANNOUNCEMENT", message: "昨夜 2号死亡。" }),
      ],
    });

    expect(buildHostAudioCue(game)).toEqual({
      key: "game-1:1:dawn:2",
      clips: ["/audio/host/dawn-report.mp3", "/audio/host/dawn-deaths.mp3", "/audio/host/seat-2.mp3", "/audio/host/dead.mp3"],
    });
  });

  it("resolves clip source and pre-delay for playback orchestration", () => {
    expect(hostClipSrc("/audio/host/day-vote-start.mp3")).toBe("/audio/host/day-vote-start.mp3");
    expect(hostClipSrc({ src: "/audio/host/please.mp3", preDelayMs: 180 })).toBe("/audio/host/please.mp3");
    expect(hostClipPreDelayMs("/audio/host/day-vote-start.mp3")).toBe(0);
    expect(hostClipPreDelayMs({ src: "/audio/host/please.mp3", preDelayMs: 180 })).toBe(180);
  });
});

function gameView(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 1,
    phase: "DAY_SPEECH",
    phaseLabel: "白天发言",
    board: { id: "6p", name: "6人局", seatCount: 6, roles: [] },
    humanSeatId: 1,
    seats: [seat(1, true), seat(2, false)],
    publicEvents: [],
    privateEvents: [],
    availableActions: [{ type: "continue" }],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [] },
      claimBoard: [],
      tableMemory: {},
      aiReasonHighlights: [],
      phaseSteps: [],
    },
    ...overrides,
  } as HumanGameView;
}

function seat(seatId: number, isHuman: boolean): HumanGameView["seats"][number] {
  return {
    seatId,
    name: isHuman ? "你" : `${seatId}号`,
    isAi: !isHuman,
    isHuman,
    alive: true,
  };
}

function publicEvent(overrides: Partial<HumanGameView["publicEvents"][number]>): HumanGameView["publicEvents"][number] {
  return {
    seq: 1,
    type: "SYSTEM",
    day: 1,
    phase: "DAY_ANNOUNCEMENT",
    message: "",
    payload: {},
    ...overrides,
  } as HumanGameView["publicEvents"][number];
}

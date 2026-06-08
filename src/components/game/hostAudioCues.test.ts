import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { hostAudioFileName } from "./hostAudioFiles";
import { buildHostAudioCue, buildThemedHostAudioCue, hostClipPreDelayMs, hostClipSrc } from "./hostAudioCues";

describe("hostAudioCues", () => {
  it("prompts the human speaker during day speech", () => {
    const game = gameView({
      phase: "DAY_SPEECH",
      currentSpeakerSeatId: 1,
      seats: [seat(1, true), seat(2, false)],
    });

    expect(buildHostAudioCue(game)).toEqual({
      key: "game-1:1:speech:human",
      clips: ["/audio/host/轮到你发言.mp3"],
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
      clips: ["/audio/host/2号.mp3", { src: "/audio/host/请发言.mp3", playbackRate: 1.16, volume: 0.88 }],
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
      clips: ["/audio/host/天亮了-公布昨夜情况.mp3", "/audio/host/昨夜死亡的是.mp3", "/audio/host/2号.mp3", "/audio/host/死亡.mp3"],
    });
  });

  it("keeps class-trial host/system cues on the Werewolf broadcast clips with a themed key", () => {
    const game = gameView({
      phase: "DAY_SPEECH",
      currentSpeakerSeatId: 2,
      seats: [seat(1, true), seat(2, false)],
    });

    expect(buildThemedHostAudioCue(game, new Set(), { classTrialThemeActive: true })).toEqual({
      key: "class-trial:game-1:1:speech:2",
      clips: ["/audio/host/2号.mp3", { src: "/audio/host/请发言.mp3", playbackRate: 1.16, volume: 0.88 }],
    });
    expect(buildThemedHostAudioCue(game, new Set(), { classTrialThemeActive: false })).toEqual(buildHostAudioCue(game));
  });

  it("resolves clip source and pre-delay for playback orchestration", () => {
    expect(hostClipSrc("/audio/host/进入投票阶段.mp3")).toBe("/audio/host/进入投票阶段.mp3");
    expect(hostClipSrc({ src: "/audio/host/请.mp3", preDelayMs: 180 })).toBe("/audio/host/请.mp3");
    expect(hostClipPreDelayMs("/audio/host/进入投票阶段.mp3")).toBe(0);
    expect(hostClipPreDelayMs({ src: "/audio/host/请.mp3", preDelayMs: 180 })).toBe(180);
  });

  it("maps stable host audio keys to Chinese content file names", () => {
    expect(hostAudioFileName("night-wolves")).toBe("天黑请闭眼-狼人请睁眼-请选择今晚的击杀目标");
    expect(hostAudioFileName("sheriff-handoff-human")).toBe("轮到你选择移交警徽或撕掉警徽");
    expect(hostAudioFileName("seat-12")).toBe("12号");
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

import { describe, expect, it, vi } from "vitest";
import type { HumanGameView } from "@/game/types";
import type { SpeechItem } from "./clientTypes";
import {
  AiSpeechAudioUnavailableError,
  buildAiSpeechAudioCue,
  isAiSpeechAudioUnavailableError,
  prepareAiSpeechAudio,
  takeStableTtsChunk,
} from "./aiSpeechAudio";

describe("aiSpeechAudio helpers", () => {
  it("builds a TTS cue for the first unplayed AI speech with runtime voice config", () => {
    const speech = speechItem({ seq: 3, speakerSeatId: 2, message: "我认为2号视角偏好。" });
    const game = gameView({
      seats: [
        seat(1, true),
        { ...seat(2, false), personaName: "DeepSeek", ttsVoice: "fallback-voice", aiFriendId: "friend-2" },
      ],
      recentSpeeches: [speech],
    });
    const runtimeConfig = { friend: "runtime" } as never;

    expect(buildAiSpeechAudioCue(game, new Set(), { "friend-2": runtimeConfig })).toEqual({
      key: "game-1:3:10",
      gameId: "game-1",
      speech,
      voicePersonaName: "DeepSeek",
      ttsVoice: "fallback-voice",
      ttsConfig: runtimeConfig,
    });
  });

  it("recognizes unavailable audio errors from typed errors and provider messages", () => {
    expect(isAiSpeechAudioUnavailableError(new AiSpeechAudioUnavailableError("缺少 TTS 配置"))).toBe(true);
    expect(isAiSpeechAudioUnavailableError(new Error("503 unavailable"))).toBe(true);
    expect(isAiSpeechAudioUnavailableError(new Error("temporary playback failure"))).toBe(false);
  });

  it("takes only stable TTS chunks unless forced", () => {
    expect(takeStableTtsChunk("短句", 0, false)).toBeUndefined();
    expect(takeStableTtsChunk("短句", 0, true)).toEqual({ text: "短句", end: 2 });

    const chunk = takeStableTtsChunk("abcdefghijkl，mnopqrstuvwxyzABCDEFGHI", 0, false);
    expect(chunk).toEqual({ text: "abcdefghijkl，", end: 13 });
  });

  it("prepares an audio element with the AI speech playback settings", () => {
    const load = vi.fn();
    class FakeAudio {
      preload = "";
      volume = 1;
      playbackRate = 1;
      preservesPitch = false;
      constructor(public src: string) {}
      load = load;
    }
    vi.stubGlobal("Audio", FakeAudio);

    const audio = prepareAiSpeechAudio("/api/audio/speech.mp3") as HTMLAudioElement & FakeAudio;

    expect(audio.src).toBe("/api/audio/speech.mp3");
    expect(audio.preload).toBe("auto");
    expect(audio.volume).toBe(0.94);
    expect(audio.playbackRate).toBe(1.12);
    expect(audio.preservesPitch).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

function gameView(overrides: Partial<HumanGameView> & { recentSpeeches?: SpeechItem[] } = {}): HumanGameView {
  const recentSpeeches = overrides.recentSpeeches ?? [];
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
      recentSpeeches,
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

function speechItem({
  seq = 1,
  speakerSeatId = 2,
  message,
}: {
  seq?: number;
  speakerSeatId?: number;
  message: string;
}): SpeechItem {
  return {
    seq,
    speaker: { seatId: speakerSeatId, name: `${speakerSeatId}号` },
    message,
  } as SpeechItem;
}

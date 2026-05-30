import { describe, expect, it, vi } from "vitest";
import type { HumanGameView } from "@/game/types";
import type { SpeechItem } from "./clientTypes";
import {
  AiSpeechAudioUnavailableError,
  buildAiSpeechAudioCue,
  buildAiSpeechAudioLoadingStatus,
  buildAiSpeechAudioPlaybackStatusPatch,
  buildAiSpeechAudioPlaybackSync,
  buildClassTrialVoicePrewarmCue,
  createStreamingAiSpeechTtsQueue,
  estimateClassTrialTextFallbackDurationMs,
  getClassTrialFinalTextHoldMs,
  getClassTrialReadableAudioTailHoldMs,
  getOrCreatePreparedAiSpeechAudio,
  isAiSpeechAudioUnavailableError,
  prepareAiSpeechAudio,
  shouldMarkAiSpeechAudioUnavailable,
  shouldUseClassTrialTextFallback,
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

  it("includes the speaker role card in the AI speech audio cue", () => {
    const roleCard = {
      id: "tomori",
      displayName: "高松灯",
      theme: "class-trial",
      styleTags: ["sensitive"],
      speechStyleZh: "短句偏多。",
      reasoningBias: "关注发言变化。",
      voteBias: "谨慎投票。",
      nightActionBias: "谨慎行动。",
      asVillager: "按公开信息找狼。",
      asWerewolf: "用公开理由伪装。",
      pressureResponse: "先停顿，再解释。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短犹豫。",
      forbidden: ["不能泄露隐藏身份。"],
      voiceProfileId: "tomori-ja-local",
      voiceLocale: "ja-JP",
      voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
    };
    const speech = speechItem({ seq: 4, speakerSeatId: 8, message: "我觉得3号前后变化有点大。" });
    const game = gameView({
      seats: [
        seat(1, true),
        { ...seat(8, false), name: "高松灯", personaName: "Gemini", roleCard },
      ],
      recentSpeeches: [speech],
    });

    expect(buildAiSpeechAudioCue(game, new Set(), undefined)?.speech.message).toBe("我觉得3号前后变化有点大。");
    expect(buildAiSpeechAudioCue(game, new Set(), undefined)?.roleCard).toEqual(roleCard);
  });

  it("builds a class-trial voice prewarm cue for the current AI speaker", () => {
    const roleCard = {
      id: "tomori",
      displayName: "高松灯",
      theme: "class-trial",
      styleTags: ["sensitive"],
      speechStyleZh: "短句偏多。",
      reasoningBias: "关注发言变化。",
      voteBias: "谨慎投票。",
      nightActionBias: "谨慎行动。",
      asVillager: "按公开信息找狼。",
      asWerewolf: "用公开理由伪装。",
      pressureResponse: "先停顿，再解释。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短犹豫。",
      forbidden: ["不能泄露隐藏身份。"],
      voiceProfileId: "tomori-ja-local",
      voiceLocale: "ja-JP",
      voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
    };
    const game = gameView({
      currentSpeakerSeatId: 8,
      seats: [
        seat(1, true),
        { ...seat(8, false), name: "高松灯", personaName: "Gemini", roleCard },
      ],
      availableActions: [{ type: "continue", label: "继续", description: "继续流程" }],
    });

    expect(buildClassTrialVoicePrewarmCue(game, new Set(), undefined)).toEqual({
      gameId: "game-1",
      speechKey: "game-1:class-trial-voice-prewarm:tomori",
      speaker: { seatId: 8, name: "高松灯" },
      voicePersonaName: "Gemini",
      roleCard,
      text: "我想听1号解释。",
    });
    expect(buildClassTrialVoicePrewarmCue(game, new Set(["game-1:class-trial-voice-prewarm:tomori"]), undefined)).toBeUndefined();
  });

  it("recognizes unavailable audio errors from typed errors and provider messages", () => {
    expect(isAiSpeechAudioUnavailableError(new AiSpeechAudioUnavailableError("缺少 TTS 配置"))).toBe(true);
    expect(isAiSpeechAudioUnavailableError(new Error("503 unavailable"))).toBe(true);
    expect(isAiSpeechAudioUnavailableError(new Error("temporary playback failure"))).toBe(false);
  });

  it("keeps class-trial transient TTS failures out of the global unavailable switch", () => {
    const roleCard = roleCardFixture("enoshima");
    const error = new AiSpeechAudioUnavailableError("GPT-SoVITS 生成失败");

    expect(shouldMarkAiSpeechAudioUnavailable(error, { roleCard })).toBe(false);
    expect(shouldMarkAiSpeechAudioUnavailable(error, {})).toBe(true);
  });

  it("uses a timed text fallback for unplayed class-trial speech audio", () => {
    const roleCard = roleCardFixture("enoshima");

    expect(
      shouldUseClassTrialTextFallback({
        classTrialThemeActive: true,
        playedAny: false,
        roleCard,
      }),
    ).toBe(true);
    expect(
      shouldUseClassTrialTextFallback({
        classTrialThemeActive: true,
        playedAny: true,
        roleCard,
      }),
    ).toBe(false);
    expect(estimateClassTrialTextFallbackDurationMs("很短。")).toBeGreaterThanOrEqual(2600);
    expect(estimateClassTrialTextFallbackDurationMs("这是一段更长的学级裁判发言。".repeat(20))).toBeLessThanOrEqual(12000);
    expect(estimateClassTrialTextFallbackDurationMs("证".repeat(100))).toBeGreaterThanOrEqual(7000);
    expect(getClassTrialFinalTextHoldMs("完整台词。")).toBe(1000);
    expect(getClassTrialFinalTextHoldMs("   ")).toBe(0);
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

  it("builds synced typewriter progress from valid audio timing", () => {
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 2, duration: 8, ended: false })).toEqual({
      playbackDurationSec: 8,
      playbackProgress: 0.25,
      syncedTypewriter: true,
    });
  });

  it("clamps audio progress and treats ended audio as complete", () => {
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 12, duration: 8, ended: false })?.playbackProgress).toBe(1);
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 0.5, duration: 8, ended: true })?.playbackProgress).toBe(1);
  });

  it("returns undefined when audio duration cannot drive sync", () => {
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: Number.NaN, ended: false })).toBeUndefined();
    expect(
      buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: Number.POSITIVE_INFINITY, ended: false }),
    ).toBeUndefined();
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: 0, ended: false })).toBeUndefined();
  });

  it("does not sync long class-trial text to implausibly short audio", () => {
    const longText = "噗，苗木诚这段证词漂亮得像刚擦过的黑板，但他没有给出下一把尺子。".repeat(4);

    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: 2, ended: false }, longText)).toBeUndefined();
    expect(getClassTrialReadableAudioTailHoldMs(longText, { currentTime: 2, duration: 2 })).toBeGreaterThan(0);
  });

  it("caps class-trial synced text reveal to a readable wall-clock pace", () => {
    const longText = "噗，苗木诚这段证词漂亮得像刚擦过的黑板，但他没有给出下一把尺子。".repeat(4);
    const readableProgress = 1000 / estimateClassTrialTextFallbackDurationMs(longText);
    const syncWithReadableCap = buildAiSpeechAudioPlaybackSync(
      { currentTime: 6.4, duration: 7.2, ended: false },
      longText,
      { playbackStartedAtMs: 1000, nowMs: 2000 },
    );

    expect(syncWithReadableCap?.playbackProgress).toBeCloseTo(readableProgress, 3);
    expect(syncWithReadableCap?.playbackProgress).toBeLessThan(0.2);
  });

  it("keeps ended class-trial audio capped until readable tail time catches up", () => {
    const longText = "噗，苗木诚这段证词漂亮得像刚擦过的黑板，但他没有给出下一把尺子。".repeat(4);
    const readableProgress = 1000 / estimateClassTrialTextFallbackDurationMs(longText);

    const syncAtAudioEnd = buildAiSpeechAudioPlaybackSync(
      { currentTime: 7.2, duration: 7.2, ended: true },
      longText,
      { playbackStartedAtMs: 1000, nowMs: 2000 },
    );

    expect(syncAtAudioEnd?.playbackProgress).toBeCloseTo(readableProgress, 3);
    expect(syncAtAudioEnd?.playbackProgress).toBeLessThan(1);
  });

  it("builds a status patch only for the active speech run", () => {
    const cue = {
      gameId: "game-1",
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      text: "同步",
    };

    expect(
      buildAiSpeechAudioPlaybackStatusPatch({
        audio: { currentTime: 1, duration: 2, ended: false },
        cue,
        runId: 7,
        activeRunId: 7,
      }),
    ).toEqual({
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      state: "playing",
      text: "同步",
      playbackDurationSec: 2,
      playbackProgress: 0.5,
      syncedTypewriter: true,
    });

    expect(
      buildAiSpeechAudioPlaybackStatusPatch({
        audio: { currentTime: 1, duration: 2, ended: false },
        cue,
        runId: 6,
        activeRunId: 7,
      }),
    ).toBeUndefined();
  });

  it("can apply class-trial readable sync from the active theme even when a cue lacks a role card", () => {
    const cue = {
      gameId: "game-1",
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      text: "噗，苗木诚这段证词漂亮得像刚擦过的黑板，但他没有给出下一把尺子。".repeat(4),
    };

    const patch = buildAiSpeechAudioPlaybackStatusPatch({
      audio: { currentTime: 6.4, duration: 7.2, ended: false },
      cue,
      runId: 7,
      activeRunId: 7,
      classTrialThemeActive: true,
      playbackStartedAtMs: 1000,
      nowMs: 2000,
    });

    expect(patch?.playbackProgress).toBeLessThan(0.2);
    expect(patch?.syncedTypewriter).toBe(true);
  });

  it("builds an audio loading status from a text cue", () => {
    expect(
      buildAiSpeechAudioLoadingStatus({
        gameId: "game-1",
        speechKey: "game-1:10:3:chunk:0",
        speaker: { seatId: 3, name: "角色3" },
        text: "同步",
      }),
    ).toEqual({
      speechKey: "game-1:10:3:chunk:0",
      speaker: { seatId: 3, name: "角色3" },
      state: "loading",
      text: "同步",
    });
  });

  it("can mark audio loading status with a preparation stage", () => {
    expect(
      buildAiSpeechAudioLoadingStatus(
        {
          gameId: "game-1",
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          text: "同步",
        },
        { preparationStage: "generating" },
      ),
    ).toMatchObject({
      speechKey: "game-1:10:3",
      state: "loading",
      preparationStage: "generating",
    });
  });

  it("reuses a prepared audio promise and clears it after a failed preparation", async () => {
    const cue = {
      gameId: "game-1",
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      text: "同步",
    };
    const prepared = new Map<string, Promise<HTMLAudioElement>>();
    const load = vi.fn(async () => ({ src: "/audio.wav" }) as HTMLAudioElement);

    const first = getOrCreatePreparedAiSpeechAudio({ prepared, cue, load });
    const second = getOrCreatePreparedAiSpeechAudio({ prepared, cue, load });

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.promise).toBe(first.promise);
    expect(load).toHaveBeenCalledTimes(1);

    await expect(first.promise).resolves.toMatchObject({ src: "/audio.wav" });

    const failure = new Error("TTS failed");
    const failingLoad = vi.fn(async () => {
      throw failure;
    });
    const failingPrepared = new Map<string, Promise<HTMLAudioElement>>();
    const failed = getOrCreatePreparedAiSpeechAudio({ prepared: failingPrepared, cue, load: failingLoad });

    await expect(failed.promise).rejects.toThrow("TTS failed");
    expect(failingPrepared.has(cue.speechKey)).toBe(false);
  });

  it("can defer streaming chunk audio loading until the playback drain reaches each chunk", async () => {
    const releases: Array<() => void> = [];
    const loadChunk = vi.fn(
      async (cue) =>
        new Promise<HTMLAudioElement>((resolve) => {
          releases.push(() => resolve({ src: cue.speechKey } as HTMLAudioElement));
        }),
    );
    const played: string[] = [];
    const queue = createStreamingAiSpeechTtsQueue({
      gameId: "game-1",
      speechKeyPrefix: "game-1:1:live-tts:2",
      speaker: { seatId: 2, name: "2号" },
      runId: 1,
      loadChunk,
      playLoadedChunk: async (_audio, _runId, cue) => {
        played.push(cue.speechKey);
      },
      shouldContinue: () => true,
      onError: () => undefined,
      deferChunkLoadUntilDrain: true,
    });

    queue.push("abcdefghijkl。");
    queue.push("abcdefghijkl。mnopqrstuvwxyz。");
    await Promise.resolve();

    expect(loadChunk).toHaveBeenCalledTimes(1);
    releases[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadChunk).toHaveBeenCalledTimes(2);

    releases[1]?.();
    await queue.finish();
    expect(played).toEqual(["game-1:1:live-tts:2:chunk:0", "game-1:1:live-tts:2:chunk:1"]);
  });

  it("can wait for the final speech before loading one whole-speech TTS chunk", async () => {
    const loadChunk = vi.fn(async (cue) => ({ src: cue.text }) as HTMLAudioElement);
    const played: string[] = [];
    const queue = createStreamingAiSpeechTtsQueue({
      gameId: "game-1",
      speechKeyPrefix: "game-1:1:live-tts:2",
      speaker: { seatId: 2, name: "2号" },
      runId: 1,
      loadChunk,
      playLoadedChunk: async (_audio, _runId, cue) => {
        played.push(cue.text);
      },
      shouldContinue: () => true,
      onError: () => undefined,
      chunkMode: "whole-speech",
    });

    queue.push("abcdefghijkl。");
    queue.push("abcdefghijkl。mnopqrstuvwxyz。");
    await Promise.resolve();

    expect(loadChunk).not.toHaveBeenCalled();

    await queue.finish("abcdefghijkl。mnopqrstuvwxyz。最终补完。");

    expect(loadChunk).toHaveBeenCalledTimes(1);
    expect(loadChunk.mock.calls[0]?.[0]).toMatchObject({
      speechKey: "game-1:1:live-tts:2:chunk:0",
      text: "abcdefghijkl。mnopqrstuvwxyz。最终补完。",
    });
    expect(played).toEqual(["abcdefghijkl。mnopqrstuvwxyz。最终补完。"]);
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

function roleCardFixture(id: string): NonNullable<HumanGameView["seats"][number]["roleCard"]> {
  return {
    id,
    displayName: id,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "",
    reasoningBias: "",
    voteBias: "",
    nightActionBias: "",
    asVillager: "",
    asWerewolf: "",
    pressureResponse: "",
    relationshipHints: [],
    catchphrasePolicy: "",
    forbidden: [],
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

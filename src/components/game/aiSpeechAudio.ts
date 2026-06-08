import type { AiFriendRuntimeTtsConfig, HumanGameView } from "@/game/types";
import { getNextPlayableAiSpeech, speechStreamKey } from "./autoAdvance";
import type { AiSpeechAudioStatus, AiSpeechAudioTextCue, SpeechItem } from "./clientTypes";

const AI_SPEECH_AUDIO_PLAYBACK_RATE = 1.12;
const AI_SPEECH_TTS_MIN_CHUNK_CHARS = 12;
const AI_SPEECH_TTS_SOFT_CHUNK_CHARS = 28;
const AI_SPEECH_TTS_MAX_CHUNK_CHARS = 62;
const CLASS_TRIAL_TEXT_FALLBACK_MIN_MS = 2600;
const CLASS_TRIAL_TEXT_FALLBACK_MAX_MS = 16000;
const CLASS_TRIAL_TEXT_FALLBACK_MS_PER_CHAR = 72;
const CLASS_TRIAL_FINAL_TEXT_HOLD_MS = 1000;
const CLASS_TRIAL_AUDIO_SYNC_MIN_READ_RATIO = 0.7;
const CLASS_TRIAL_VOICE_PREWARM_TEXT = "我想听1号解释。";

type AudioPlaybackTiming = {
  currentTime: number;
  duration: number;
  ended: boolean;
};

type AudioPlaybackSyncOptions = {
  playbackStartedAtMs?: number;
  nowMs?: number;
};

export type AiSpeechAudioCue = {
  key: string;
  gameId: string;
  speech: SpeechItem;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
  roleCard?: HumanGameView["seats"][number]["roleCard"];
};

export class AiSpeechAudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSpeechAudioUnavailableError";
  }
}

export type PreparedAiSpeechAudioCache = Map<string, Promise<HTMLAudioElement>>;
type StreamingAiSpeechTtsChunkMode = "stable" | "whole-speech";

export function isAiSpeechAudioUnavailableError(error: unknown): boolean {
  if (error instanceof AiSpeechAudioUnavailableError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /缺少|missing|unavailable|503|无法生成 AI 发言音频/i.test(message);
}

export function shouldMarkAiSpeechAudioUnavailable(
  error: unknown,
  cue: Pick<AiSpeechAudioTextCue, "roleCard"> | Pick<AiSpeechAudioCue, "roleCard"> | undefined,
): boolean {
  if (!isAiSpeechAudioUnavailableError(error)) return false;
  return cue?.roleCard?.theme !== "class-trial";
}

export function shouldUseClassTrialTextFallback(options: {
  classTrialThemeActive: boolean;
  playedAny: boolean;
  roleCard?: HumanGameView["seats"][number]["roleCard"];
}): boolean {
  return options.classTrialThemeActive && !options.playedAny && options.roleCard?.theme === "class-trial";
}

export function estimateClassTrialTextFallbackDurationMs(text: string): number {
  const displayChars = Array.from(text.trim()).length;
  const duration = displayChars * CLASS_TRIAL_TEXT_FALLBACK_MS_PER_CHAR;
  return Math.min(CLASS_TRIAL_TEXT_FALLBACK_MAX_MS, Math.max(CLASS_TRIAL_TEXT_FALLBACK_MIN_MS, duration));
}

export function getClassTrialReadableAudioTailHoldMs(text: string, audio: Pick<AudioPlaybackTiming, "currentTime" | "duration">): number {
  const readableDurationMs = estimateClassTrialTextFallbackDurationMs(text);
  const playedMs = Number.isFinite(audio.currentTime)
    ? audio.currentTime * 1000
    : Number.isFinite(audio.duration)
      ? audio.duration * 1000
      : 0;
  return Math.max(0, readableDurationMs - playedMs);
}

export function getClassTrialFinalTextHoldMs(text: string): number {
  return text.trim() ? CLASS_TRIAL_FINAL_TEXT_HOLD_MS : 0;
}

export function getSeatPersonaName(game: HumanGameView, seatId: number | undefined): string | undefined {
  if (!seatId) return undefined;
  return game.seats.find((seat) => seat.seatId === seatId)?.personaName;
}

export function getSeatTtsVoice(game: HumanGameView, seatId: number | undefined): string | undefined {
  if (!seatId) return undefined;
  const seat = game.seats.find((item) => item.seatId === seatId);
  return seat?.ttsConfig?.voice ?? seat?.ttsVoice;
}

export function getSeatTtsConfig(
  game: HumanGameView,
  seatId: number | undefined,
  runtimeAiTtsConfigs: Record<string, AiFriendRuntimeTtsConfig> | undefined,
): AiFriendRuntimeTtsConfig | undefined {
  if (!seatId) return undefined;
  const seat = game.seats.find((item) => item.seatId === seatId);
  if (!seat) return undefined;
  return (seat.aiFriendId ? runtimeAiTtsConfigs?.[seat.aiFriendId] : undefined) ?? seat.ttsConfig;
}

export function getSeatRoleCard(game: HumanGameView, seatId: number | undefined) {
  if (!seatId) return undefined;
  return game.seats.find((seat) => seat.seatId === seatId)?.roleCard;
}

export function buildAiSpeechAudioCue(
  game: HumanGameView,
  completedKeys: ReadonlySet<string>,
  runtimeAiTtsConfigs: Record<string, AiFriendRuntimeTtsConfig> | undefined,
): AiSpeechAudioCue | undefined {
  const speech = getNextPlayableAiSpeech(game, completedKeys);
  if (!speech?.speaker) return undefined;
  return {
    key: speechStreamKey(game.id, speech),
    gameId: game.id,
    speech,
    voicePersonaName: getSeatPersonaName(game, speech.speaker.seatId),
    ttsVoice: getSeatTtsVoice(game, speech.speaker.seatId),
    ttsConfig: getSeatTtsConfig(game, speech.speaker.seatId, runtimeAiTtsConfigs),
    roleCard: getSeatRoleCard(game, speech.speaker.seatId),
  };
}

export function buildClassTrialVoicePrewarmCue(
  game: HumanGameView,
  completedKeys: ReadonlySet<string>,
  runtimeAiTtsConfigs: Record<string, AiFriendRuntimeTtsConfig> | undefined,
): AiSpeechAudioTextCue | undefined {
  const seatId = game.currentSpeakerSeatId;
  if (game.phase !== "DAY_SPEECH" || !seatId || seatId === game.humanSeatId) return undefined;
  if (game.availableActions.length !== 1 || game.availableActions[0]?.type !== "continue") return undefined;

  const seat = game.seats.find((item) => item.seatId === seatId);
  if (!seat?.roleCard || seat.roleCard.theme !== "class-trial") return undefined;

  const speechKey = `${game.id}:class-trial-voice-prewarm:${seat.roleCard.id}`;
  if (completedKeys.has(speechKey)) return undefined;

  return {
    gameId: game.id,
    speechKey,
    speaker: { seatId, name: seat.name },
    voicePersonaName: seat.personaName,
    ttsVoice: seat.ttsVoice,
    ttsConfig: getSeatTtsConfig(game, seatId, runtimeAiTtsConfigs),
    roleCard: seat.roleCard,
    text: CLASS_TRIAL_VOICE_PREWARM_TEXT,
  };
}

export function buildAiSpeechAudioPlaybackSync(audio: AudioPlaybackTiming, text?: string, options?: AudioPlaybackSyncOptions):
  | {
      playbackDurationSec: number;
      playbackProgress: number;
      syncedTypewriter: true;
    }
  | undefined;
export function buildAiSpeechAudioPlaybackSync(
  audio: AudioPlaybackTiming,
  text = "",
  options: AudioPlaybackSyncOptions = {},
):
  | {
      playbackDurationSec: number;
      playbackProgress: number;
      syncedTypewriter: true;
    }
  | undefined {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return undefined;
  const readableDurationSec = estimateClassTrialTextFallbackDurationMs(text) / 1000;
  if (text.trim() && audio.duration < readableDurationSec * CLASS_TRIAL_AUDIO_SYNC_MIN_READ_RATIO) return undefined;
  const audioProgress = audio.ended ? 1 : audio.currentTime / audio.duration;
  const rawProgress = Math.min(audioProgress, getReadableProgressCap(text, options) ?? Number.POSITIVE_INFINITY);
  return {
    playbackDurationSec: audio.duration,
    playbackProgress: Math.min(1, Math.max(0, rawProgress)),
    syncedTypewriter: true,
  };
}

function getReadableProgressCap(text: string, options: AudioPlaybackSyncOptions): number | undefined {
  if (!text.trim()) return undefined;
  const startedAt = options.playbackStartedAtMs;
  const now = options.nowMs;
  if (typeof startedAt !== "number" || typeof now !== "number") return undefined;
  if (!Number.isFinite(startedAt) || !Number.isFinite(now) || now < startedAt) return undefined;
  const readableDurationMs = estimateClassTrialTextFallbackDurationMs(text);
  return Math.min(1, Math.max(0, (now - startedAt) / readableDurationMs));
}

export function buildAiSpeechAudioLoadingStatus(
  cue: AiSpeechAudioTextCue,
  options: { preparationStage?: AiSpeechAudioStatus["preparationStage"] } = {},
): AiSpeechAudioStatus {
  return {
    speechKey: cue.speechKey,
    speaker: cue.speaker,
    state: "loading",
    ...(options.preparationStage ? { preparationStage: options.preparationStage } : {}),
    text: cue.text,
  };
}

export function getOrCreatePreparedAiSpeechAudio(options: {
  prepared: PreparedAiSpeechAudioCache;
  cue: AiSpeechAudioTextCue;
  load: (cue: AiSpeechAudioTextCue) => Promise<HTMLAudioElement>;
}): { promise: Promise<HTMLAudioElement>; reused: boolean } {
  const existing = options.prepared.get(options.cue.speechKey);
  if (existing) return { promise: existing, reused: true };

  const promise = options.load(options.cue).catch((error) => {
    if (options.prepared.get(options.cue.speechKey) === promise) {
      options.prepared.delete(options.cue.speechKey);
    }
    throw error;
  });
  options.prepared.set(options.cue.speechKey, promise);
  return { promise, reused: false };
}

export function buildAiSpeechAudioPlaybackStatusPatch(options: {
  audio: AudioPlaybackTiming;
  cue: AiSpeechAudioTextCue;
  runId: number;
  activeRunId: number;
  classTrialThemeActive?: boolean;
  playbackStartedAtMs?: number;
  nowMs?: number;
}): AiSpeechAudioStatus | undefined {
  if (options.runId !== options.activeRunId) return undefined;
  const syncOptions: AudioPlaybackSyncOptions = {};
  if (typeof options.playbackStartedAtMs === "number") syncOptions.playbackStartedAtMs = options.playbackStartedAtMs;
  if (typeof options.nowMs === "number") syncOptions.nowMs = options.nowMs;
  const shouldUseClassTrialSync = options.classTrialThemeActive || options.cue.roleCard?.theme === "class-trial";
  const playbackSync = buildAiSpeechAudioPlaybackSync(
    options.audio,
    shouldUseClassTrialSync ? options.cue.text : "",
    syncOptions,
  );
  return {
    speechKey: options.cue.speechKey,
    speaker: options.cue.speaker,
    state: "playing",
    text: options.cue.text,
    ...(playbackSync ?? {}),
  };
}

export function findNewAiSpeech(
  game: HumanGameView,
  previousKeys: ReadonlySet<string>,
  speakerSeatId: number,
): SpeechItem | undefined {
  return game.tableSummary.recentSpeeches.find((speech) => {
    if (!speech.speaker || speech.speaker.seatId !== speakerSeatId || speech.speaker.seatId === game.humanSeatId) {
      return false;
    }
    return !previousKeys.has(speechStreamKey(game.id, speech));
  });
}

export function createStreamingAiSpeechTtsQueue(options: {
  gameId: string;
  speechKeyPrefix: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
  roleCard?: HumanGameView["seats"][number]["roleCard"];
  runId: number;
  loadChunk: (cue: AiSpeechAudioTextCue) => Promise<HTMLAudioElement>;
  playLoadedChunk: (audio: HTMLAudioElement, runId: number, cue: AiSpeechAudioTextCue) => Promise<void>;
  shouldContinue: () => boolean;
  onError: (error: unknown) => void;
  deferChunkLoadUntilDrain?: boolean;
  chunkMode?: StreamingAiSpeechTtsChunkMode;
}) {
  const chunkMode = options.chunkMode ?? "stable";
  let latestText = "";
  let consumedLength = 0;
  let chunkIndex = 0;
  let isDraining = false;
  let playedAny = false;
  let cancelled = false;
  let lastError: unknown;
  const queue: Array<{
    audio?: Promise<
      | { ok: true; audio: HTMLAudioElement }
      | { ok: false; error: unknown }
    >;
    cue: AiSpeechAudioTextCue;
  }> = [];
  let idleResolve: (() => void) | undefined;
  let idlePromise = Promise.resolve();

  const resetIdlePromise = () => {
    if (!idleResolve) {
      idlePromise = new Promise<void>((resolve) => {
        idleResolve = resolve;
      });
    }
  };

  const resolveIdleIfDone = () => {
    if (queue.length > 0 || isDraining || !idleResolve) return;
    idleResolve();
    idleResolve = undefined;
  };

  const loadQueuedChunk = (cue: AiSpeechAudioTextCue) =>
    options.loadChunk(cue).then(
      (audio) => ({ ok: true as const, audio }),
      (error) => ({ ok: false as const, error }),
    );

  const drain = () => {
    if (isDraining) return;
    isDraining = true;
    void (async () => {
      try {
        while (!cancelled && options.shouldContinue() && queue.length > 0) {
          const item = queue.shift();
          if (!item) continue;
          const loaded = await (item.audio ?? loadQueuedChunk(item.cue));
          if (!loaded.ok) throw loaded.error;
          if (!options.shouldContinue()) return;
          if (options.deferChunkLoadUntilDrain && queue[0] && !queue[0].audio) {
            queue[0].audio = loadQueuedChunk(queue[0].cue);
          }
          await options.playLoadedChunk(loaded.audio, options.runId, item.cue);
          playedAny = true;
        }
      } catch (error) {
        lastError = error;
        options.onError(error);
        cancelled = true;
        queue.length = 0;
      } finally {
        if (!options.shouldContinue()) {
          cancelled = true;
          queue.length = 0;
        }
        isDraining = false;
        resolveIdleIfDone();
        if (!cancelled && queue.length > 0) {
          window.setTimeout(drain, 0);
        }
      }
    })();
  };

  const enqueue = (text: string) => {
    const clean = text.trim();
    if (!clean || cancelled) return;
    resetIdlePromise();
    const cue = {
      gameId: options.gameId,
      speechKey: `${options.speechKeyPrefix}:chunk:${chunkIndex}`,
      speaker: options.speaker,
      voicePersonaName: options.voicePersonaName,
      ttsVoice: options.ttsVoice,
      ttsConfig: options.ttsConfig,
      roleCard: options.roleCard,
      text: clean,
    };
    chunkIndex += 1;
    queue.push({
      cue,
      audio: options.deferChunkLoadUntilDrain ? undefined : loadQueuedChunk(cue),
    });
    drain();
  };

  const consumeStableChunks = (force: boolean) => {
    if (chunkMode === "whole-speech") {
      if (!force || cancelled) return;
      const pending = latestText.slice(consumedLength).trim();
      if (!pending) return;
      consumedLength = latestText.length;
      enqueue(pending);
      return;
    }

    while (!cancelled) {
      const chunk = takeStableTtsChunk(latestText, consumedLength, force);
      if (!chunk) break;
      consumedLength = chunk.end;
      enqueue(chunk.text);
      if (force) break;
    }
  };

  return {
    push(text: string) {
      if (cancelled || !text) return;
      if (text.length < consumedLength) consumedLength = 0;
      latestText = text;
      consumeStableChunks(false);
    },
    async finish(finalText?: string) {
      if (!options.shouldContinue()) {
        cancelled = true;
        queue.length = 0;
        resolveIdleIfDone();
        return;
      }
      if (finalText) {
        latestText = finalText;
      }
      consumeStableChunks(true);
      await idlePromise;
      if (lastError) throw lastError;
    },
    cancel() {
      cancelled = true;
      queue.length = 0;
      resolveIdleIfDone();
    },
    getLatestText() {
      return latestText;
    },
    hasPlayedAny() {
      return playedAny;
    },
  };
}

export function takeStableTtsChunk(
  text: string,
  cursor: number,
  force: boolean,
): { text: string; end: number } | undefined {
  const raw = text.slice(cursor);
  const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
  const start = cursor + leadingWhitespace;
  const pending = text.slice(start);
  if (!pending.trim()) return undefined;

  const strongBoundary = findBoundaryIndex(pending, /[。！？!?；;]/, AI_SPEECH_TTS_MIN_CHUNK_CHARS);
  if (strongBoundary >= 0) {
    return { text: pending.slice(0, strongBoundary + 1), end: start + strongBoundary + 1 };
  }

  if (pending.length >= AI_SPEECH_TTS_SOFT_CHUNK_CHARS) {
    const softBoundary = findBoundaryIndex(
      pending.slice(0, Math.min(pending.length, AI_SPEECH_TTS_MAX_CHUNK_CHARS)),
      /[，,、：:]/,
      AI_SPEECH_TTS_MIN_CHUNK_CHARS,
    );
    if (softBoundary >= 0) {
      return { text: pending.slice(0, softBoundary + 1), end: start + softBoundary + 1 };
    }
  }

  if (pending.length >= AI_SPEECH_TTS_MAX_CHUNK_CHARS) {
    const end = AI_SPEECH_TTS_MAX_CHUNK_CHARS;
    return { text: pending.slice(0, end), end: start + end };
  }

  if (force) {
    return { text: pending, end: text.length };
  }

  return undefined;
}

export function findBoundaryIndex(text: string, pattern: RegExp, minIndex: number): number {
  for (let index = text.length - 1; index >= minIndex; index -= 1) {
    if (pattern.test(text[index] ?? "")) return index;
  }
  return -1;
}

export function prepareAiSpeechAudio(url: string): HTMLAudioElement {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = 0.94;
  audio.playbackRate = AI_SPEECH_AUDIO_PLAYBACK_RATE;
  audio.preservesPitch = true;
  audio.load();
  return audio;
}

export function waitForAudioReady(audio: HTMLAudioElement, timeoutMs = 700): Promise<void> {
  if (audio.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const done = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("loadeddata", done);
      audio.removeEventListener("canplay", done);
      window.clearTimeout(timer);
      resolve();
    };
    timer = window.setTimeout(done, timeoutMs);
    audio.addEventListener("loadeddata", done, { once: true });
    audio.addEventListener("canplay", done, { once: true });
  });
}

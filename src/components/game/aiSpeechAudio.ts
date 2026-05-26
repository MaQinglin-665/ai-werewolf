import type { AiFriendRuntimeTtsConfig, HumanGameView } from "@/game/types";
import { getNextPlayableAiSpeech, speechStreamKey } from "./autoAdvance";
import type { AiSpeechAudioTextCue, SpeechItem } from "./clientTypes";

const AI_SPEECH_AUDIO_PLAYBACK_RATE = 1.12;
const AI_SPEECH_TTS_MIN_CHUNK_CHARS = 12;
const AI_SPEECH_TTS_SOFT_CHUNK_CHARS = 28;
const AI_SPEECH_TTS_MAX_CHUNK_CHARS = 62;

export type AiSpeechAudioCue = {
  key: string;
  gameId: string;
  speech: SpeechItem;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
};

export class AiSpeechAudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSpeechAudioUnavailableError";
  }
}

export function isAiSpeechAudioUnavailableError(error: unknown): boolean {
  if (error instanceof AiSpeechAudioUnavailableError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /缺少|missing|unavailable|503|无法生成 AI 发言音频/i.test(message);
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
  runId: number;
  loadChunk: (cue: AiSpeechAudioTextCue) => Promise<HTMLAudioElement>;
  playLoadedChunk: (audio: HTMLAudioElement, runId: number, cue: AiSpeechAudioTextCue) => Promise<void>;
  shouldContinue: () => boolean;
  onError: (error: unknown) => void;
}) {
  let latestText = "";
  let consumedLength = 0;
  let chunkIndex = 0;
  let isDraining = false;
  let playedAny = false;
  let cancelled = false;
  let lastError: unknown;
  const queue: Array<{
    audio: Promise<
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

  const drain = () => {
    if (isDraining) return;
    isDraining = true;
    void (async () => {
      try {
        while (!cancelled && options.shouldContinue() && queue.length > 0) {
          const item = queue.shift();
          if (!item) continue;
          const loaded = await item.audio;
          if (!loaded.ok) throw loaded.error;
          if (!options.shouldContinue()) return;
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
      text: clean,
    };
    chunkIndex += 1;
    queue.push({
      cue,
      audio: options.loadChunk(cue).then(
        (audio) => ({ ok: true, audio }),
        (error) => ({ ok: false, error }),
      ),
    });
    drain();
  };

  const consumeStableChunks = (force: boolean) => {
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

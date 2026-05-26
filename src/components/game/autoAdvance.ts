import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type { SpeechItem } from "./clientTypes";

const AI_SPEECH_MIN_READ_MS = 2600;
const AI_SPEECH_MAX_READ_MS = 22000;

export function getAutoAdvanceDelay(
  game: HumanGameView,
  action: AvailableHumanAction,
  speechToRead?: SpeechItem,
): number {
  if (action.type !== "continue") return 0;
  if (speechToRead) return getAiSpeechReadDelay(speechToRead);
  if (game.phase === "DAY_SPEECH") return AI_SPEECH_MIN_READ_MS;
  if (game.phase === "DAY_VOTE") return 900;
  if (game.phase === "DAY_ANNOUNCEMENT" || game.phase === "EXILE_RESOLUTION") return 1600;
  if (game.phase.startsWith("NIGHT")) return 1300;
  return 1200;
}

export function getAiSpeechReadDelay(speech: SpeechItem): number {
  return Math.min(AI_SPEECH_MAX_READ_MS, Math.max(AI_SPEECH_MIN_READ_MS, speech.message.length * 42 + 1200));
}

export function getLatestStreamableAiSpeech(game: HumanGameView): SpeechItem | undefined {
  const latestSpeech = game.tableSummary.recentSpeeches.at(-1);
  if (!latestSpeech?.speaker || latestSpeech.speaker.seatId === game.humanSeatId) return undefined;
  return latestSpeech;
}

export function getNextPlayableAiSpeech(game: HumanGameView, completedKeys: ReadonlySet<string>): SpeechItem | undefined {
  return game.tableSummary.recentSpeeches.find((speech) => {
    if (!speech.speaker || speech.speaker.seatId === game.humanSeatId) return false;
    return !completedKeys.has(speechStreamKey(game.id, speech));
  });
}

export function speechStreamKey(gameId: string, speech: SpeechItem): string {
  return `${gameId}:${speech.seq}:${speech.message.length}`;
}

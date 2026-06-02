import { isNightPhase } from "@/game/phaseSemantics";
import type { AiRuntimeMode, HumanGameView } from "@/game/types";
import { getClassTrialVotePresentation, type ClassTrialVotePresentationState } from "./classTrialVotePresentation";
import { getClassTrialCharacterForSeat, type ClassTrialPackCharacter, type ClassTrialPackManifest } from "./classTrialTheme";
import type { ClassTrialAudioTypewriterState, HostAudioStatus, LiveAiSpeech } from "./clientTypes";

export type ClassTrialSpeakingFocusView = {
  character: ClassTrialPackCharacter;
  key: string;
  message: string;
  speakerName: string;
  stage: "enter" | "exit";
};

export type ClassTrialTableModel = {
  seatCharacters: Map<number, ClassTrialPackCharacter>;
  activeAudioTypewriter?: ClassTrialAudioTypewriterState;
  audioSpeakerSeatId?: number;
  speakerSeatId?: number;
  activeSeatId?: number;
  activeCharacter?: ClassTrialPackCharacter;
  speakerCharacter?: ClassTrialPackCharacter;
  speakerName: string;
  centerStatus: string;
  message: string;
  currentSpeakingFocusKey: string;
  currentSpeakingFocus?: ClassTrialSpeakingFocusView;
  aiRuntimeLabel: string;
  classTrialVoteState: ClassTrialVotePresentationState | null;
  nightPhase: boolean;
  hostAudioLabel: string;
  voteLockedSeatIds: Set<number>;
  votePendingSeatIds: Set<number>;
  voteFocusSeatId?: number;
};

export function buildClassTrialTableModel(options: {
  game: HumanGameView;
  manifest?: ClassTrialPackManifest;
  audioTypewriter?: ClassTrialAudioTypewriterState;
  liveAiSpeech?: LiveAiSpeech | null;
  aiRuntimeMode?: AiRuntimeMode;
  hostAudioEnabled?: boolean;
  hostAudioStatus?: HostAudioStatus | null;
}): ClassTrialTableModel {
  const { game, manifest, audioTypewriter, liveAiSpeech, hostAudioStatus } = options;
  const seatCharacters = buildClassTrialSeatCharacters(game, manifest);
  const activeAudioTypewriter = isActiveClassTrialAudioTypewriter(audioTypewriter) ? audioTypewriter : undefined;
  const audioSpeakerSeatId = activeAudioTypewriter?.speaker.seatId;
  const speakerSeatId = audioSpeakerSeatId ?? game.currentSpeakerSeatId;
  const activeSeatId = audioSpeakerSeatId ?? getActiveSeatId(game);
  const activeCharacter = getSpeakerCharacter(activeSeatId, seatCharacters);
  const speakerCharacter = getSpeakerCharacter(speakerSeatId, seatCharacters);
  const speakerName = speakerCharacter?.displayName ?? "等待发言";
  const centerStatus = speakerCharacter
    ? `${speakerCharacter.displayName} 发言中`
    : activeCharacter
      ? `${activeCharacter.displayName} 行动中`
      : "等待发言";
  const message = speakerCharacter ? getLatestSpeakerMessage(game, speakerSeatId, liveAiSpeech) : "";
  const currentSpeakingFocusKey = speakerCharacter?.id ? `${speakerCharacter.id}\n${speakerSeatId ?? ""}\n${message}` : "";
  const currentSpeakingFocus: ClassTrialSpeakingFocusView | undefined = speakerCharacter
    ? {
        character: speakerCharacter,
        key: currentSpeakingFocusKey,
        message,
        speakerName,
        stage: "enter",
      }
    : undefined;
  const classTrialVoteState = getClassTrialVotePresentation(game);

  return {
    seatCharacters,
    activeAudioTypewriter,
    audioSpeakerSeatId,
    speakerSeatId,
    activeSeatId,
    activeCharacter,
    speakerCharacter,
    speakerName,
    centerStatus,
    message,
    currentSpeakingFocusKey,
    currentSpeakingFocus,
    aiRuntimeLabel: options.aiRuntimeMode === "llm" ? "真实 LLM · DeepSeek-v4" : "Mock AI",
    classTrialVoteState,
    nightPhase: isNightPhase(game.phase),
    hostAudioLabel: hostAudioStatus ? "播报中" : options.hostAudioEnabled ? "主持开" : "主持关",
    voteLockedSeatIds:
      classTrialVoteState?.variant === "sealing" ? new Set(classTrialVoteState.lockedSeatIds) : new Set<number>(),
    votePendingSeatIds:
      classTrialVoteState?.variant === "sealing" ? new Set(classTrialVoteState.pendingSeatIds) : new Set<number>(),
    voteFocusSeatId: classTrialVoteState?.variant === "reveal" ? classTrialVoteState.focusSeatId : undefined,
  };
}

export function buildClassTrialSeatCharacters(
  game: HumanGameView,
  manifest: ClassTrialPackManifest | undefined,
): Map<number, ClassTrialPackCharacter> {
  return new Map(game.seats.map((seat, index) => [seat.seatId, getClassTrialCharacterForSeat(index, manifest)]));
}

export function isMatchingAudioTypewriter(
  audioTypewriter: ClassTrialAudioTypewriterState | undefined,
  speakerSeatId: number | undefined,
): audioTypewriter is ClassTrialAudioTypewriterState {
  return Boolean(audioTypewriter && speakerSeatId && audioTypewriter.speaker.seatId === speakerSeatId);
}

export function getAudioWaitingText(audioTypewriter: ClassTrialAudioTypewriterState | undefined, fallback: string): string {
  if (audioTypewriter?.state === "paused") return "请点击播放语音。";
  if (audioTypewriter?.preparationStage === "generating") return "正在生成语音。";
  if (audioTypewriter?.preparationStage === "ready") return "准备播放。";
  if (audioTypewriter?.preparationStage === "queued") return "正在调取证言。";
  return fallback;
}

function isActiveClassTrialAudioTypewriter(
  audioTypewriter: ClassTrialAudioTypewriterState | undefined,
): audioTypewriter is ClassTrialAudioTypewriterState {
  return (
    audioTypewriter?.state === "loading" || audioTypewriter?.state === "playing" || audioTypewriter?.state === "paused"
  );
}

function getActiveSeatId(game: HumanGameView): number | undefined {
  return game.currentSpeakerSeatId ?? game.currentActorSeatId;
}

function getSpeakerCharacter(
  speakerSeatId: number | undefined,
  seatCharacters: Map<number, ClassTrialPackCharacter>,
): ClassTrialPackCharacter | undefined {
  const seatId = speakerSeatId;
  return seatId ? seatCharacters.get(seatId) : undefined;
}

function getLatestSpeakerMessage(
  game: HumanGameView,
  speakerSeatId: number | undefined,
  liveAiSpeech: LiveAiSpeech | null | undefined,
): string {
  const seatId = speakerSeatId;
  const liveText =
    liveAiSpeech && seatId && liveAiSpeech.speaker.seatId === seatId ? liveAiSpeech.text.trim() : undefined;
  if (liveText) return liveText;
  const speech = [...game.tableSummary.recentSpeeches].reverse().find((item) => !seatId || item.speaker?.seatId === seatId);
  return speech?.message ?? "正在思考/准备发言。";
}

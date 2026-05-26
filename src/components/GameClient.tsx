"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { resolveAiFriendsForGame } from "@/game/aiFriends";
import type {
  AiFriendConfig,
  AiFriendRuntimeTtsConfig,
  AiRuntimeMode,
  AvailableHumanAction,
  HumanGameView,
} from "@/game/types";
import {
  ActionPanel,
  AuxiliaryInfoPanel,
  FlowStatusBar,
  GlossaryOverlay,
  HostStage,
  IdentityBookOverlay,
  IdiotRevealOverlay,
  LandingPanel,
  PhaseCurtain,
  PhaseRhythm,
  ReviewPanel,
  RoleIntroOverlay,
  RoomHeader,
  SeatBoard,
  VoteTable,
  buildIdiotRevealCue,
  getPhaseCurtainCue,
} from "./game/GamePanels";
import {
  buildAiFriendOptions,
  buildRuntimeAiLlmConfigs,
  buildRuntimeAiTtsConfigs,
  getDefaultSelectedAiFriendIds,
  readStoredAiFriendLlmSecrets,
  readStoredAiRuntimeMode,
  readStoredCustomAiFriends,
  readStoredSelectedAiFriendIds,
  resolveSelectedAiFriends,
  type AiFriendLlmSecretMap,
} from "./game/aiFriendStorage";
import { getDefaultBoardOptions, getInitialBoardSelection } from "./game/boardSelectionModel";
import type { IdiotRevealCue, PhaseCurtainCue } from "./game/GamePanels";
import { MobileGameTable } from "./game/MobileGameTable";
import { submitStreamingContinue } from "./game/streamingContinue";
import type {
  AiSpeechAudioStatus,
  AiSpeechAudioTextCue,
  AiLineupPreviewItem,
  BoardOption,
  CommandPayload,
  HumanSeatMode,
  HostAudioStatus,
  LiveAiSpeech,
  SpeechItem,
} from "./game/clientTypes";
import { formatSystemMessage } from "./game/viewHelpers";

const CURRENT_GAME_KEY = "ai-werewolf-game-id";
const RECENT_GAMES_KEY = "ai-werewolf-recent-game-ids";
const HOST_AUDIO_ENABLED_KEY = "ai-werewolf-host-audio-enabled";
const AI_SPEECH_AUDIO_ENABLED_KEY = "ai-werewolf-ai-speech-audio-enabled";
const HOST_AUDIO_BASE_PATH = "/audio/host";
const EMPTY_RECENT_GAME_IDS: string[] = [];
let recentGameIdsRawCache: string | null = null;
let recentGameIdsSnapshotCache: string[] = EMPTY_RECENT_GAME_IDS;
const AI_SPEECH_MIN_READ_MS = 2600;
const AI_SPEECH_MAX_READ_MS = 22000;
const AI_SPEECH_AUDIO_MAX_ATTEMPTS = 1;
const DEFAULT_BOARD_OPTIONS = getDefaultBoardOptions();
const DEFAULT_BOARD_SELECTION = getInitialBoardSelection(DEFAULT_BOARD_OPTIONS);
const AI_SPEECH_AUDIO_PLAYBACK_RATE = 1.12;
const AI_SPEECH_TTS_MIN_CHUNK_CHARS = 12;
const AI_SPEECH_TTS_SOFT_CHUNK_CHARS = 28;
const AI_SPEECH_TTS_MAX_CHUNK_CHARS = 62;
const EMPTY_CUSTOM_AI_FRIENDS: AiFriendConfig[] = [];
const IDIOT_REVEAL_EVENT_TYPES = new Set(["IDIOT_REVEALED"]);

function randomSeatId(seatCount: number): number {
  return 1 + Math.floor(Math.random() * seatCount);
}

class AiSpeechAudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSpeechAudioUnavailableError";
  }
}

function isAiSpeechAudioUnavailableError(error: unknown): boolean {
  if (error instanceof AiSpeechAudioUnavailableError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /缺少|missing|unavailable|503|无法生成 AI 发言音频/i.test(message);
}

function getSeatPersonaName(game: HumanGameView, seatId: number | undefined): string | undefined {
  if (!seatId) return undefined;
  return game.seats.find((seat) => seat.seatId === seatId)?.personaName;
}

function getSeatTtsVoice(game: HumanGameView, seatId: number | undefined): string | undefined {
  if (!seatId) return undefined;
  const seat = game.seats.find((item) => item.seatId === seatId);
  return seat?.ttsConfig?.voice ?? seat?.ttsVoice;
}

function getSeatTtsConfig(
  game: HumanGameView,
  seatId: number | undefined,
  runtimeAiTtsConfigs: Record<string, AiFriendRuntimeTtsConfig> | undefined,
): AiFriendRuntimeTtsConfig | undefined {
  if (!seatId) return undefined;
  const seat = game.seats.find((item) => item.seatId === seatId);
  if (!seat) return undefined;
  return (seat.aiFriendId ? runtimeAiTtsConfigs?.[seat.aiFriendId] : undefined) ?? seat.ttsConfig;
}

function getAutoAdvanceDelay(game: HumanGameView, action: AvailableHumanAction, speechToRead?: SpeechItem): number {
  if (action.type !== "continue") return 0;
  if (speechToRead) return getAiSpeechReadDelay(speechToRead);
  if (game.phase === "DAY_SPEECH") return AI_SPEECH_MIN_READ_MS;
  if (game.phase === "DAY_VOTE") return 900;
  if (game.phase === "DAY_ANNOUNCEMENT" || game.phase === "EXILE_RESOLUTION") return 1600;
  if (game.phase.startsWith("NIGHT")) return 1300;
  return 1200;
}

function getAiSpeechReadDelay(speech: SpeechItem): number {
  return Math.min(AI_SPEECH_MAX_READ_MS, Math.max(AI_SPEECH_MIN_READ_MS, speech.message.length * 42 + 1200));
}

function getLatestStreamableAiSpeech(game: HumanGameView): SpeechItem | undefined {
  const latestSpeech = game.tableSummary.recentSpeeches.at(-1);
  if (!latestSpeech?.speaker || latestSpeech.speaker.seatId === game.humanSeatId) return undefined;
  return latestSpeech;
}

function getNextPlayableAiSpeech(game: HumanGameView, completedKeys: ReadonlySet<string>): SpeechItem | undefined {
  return game.tableSummary.recentSpeeches.find((speech) => {
    if (!speech.speaker || speech.speaker.seatId === game.humanSeatId) return false;
    return !completedKeys.has(speechStreamKey(game.id, speech));
  });
}

function speechStreamKey(gameId: string, speech: SpeechItem): string {
  return `${gameId}:${speech.seq}:${speech.message.length}`;
}

function latestPublicEvent(game: HumanGameView): HumanGameView["publicEvents"][number] | undefined {
  return game.publicEvents.at(-1);
}

function findLatestUnplayedPublicEvent(
  game: HumanGameView,
  completedKeys: ReadonlySet<string>,
  types: ReadonlySet<string>,
): HumanGameView["publicEvents"][number] | undefined {
  return [...game.publicEvents]
    .reverse()
    .find((event) => {
      const canCrossDayBoundary = event.type === "IDIOT_REVEALED";
      return (
        (event.day === game.day || canCrossDayBoundary) &&
        types.has(event.type) &&
        !completedKeys.has(`${game.id}:${event.seq}:${event.type}`)
      );
    });
}

type HostAudioClip =
  | string
  | {
      src: string;
      playbackRate?: number;
      volume?: number;
      preDelayMs?: number;
    };

type HostAudioCue = {
  key: string;
  clips: HostAudioClip[];
};

type AiSpeechAudioCue = {
  key: string;
  gameId: string;
  speech: SpeechItem;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
};

function hostClip(name: string, options?: Omit<Extract<HostAudioClip, { src: string }>, "src">): HostAudioClip {
  const src = `${HOST_AUDIO_BASE_PATH}/${name}.mp3`;
  return options ? { src, ...options } : src;
}

function seatClip(seatId: number): HostAudioClip {
  return hostClip(`seat-${seatId}`);
}

function hostClipSrc(clip: HostAudioClip): string {
  return typeof clip === "string" ? clip : clip.src;
}

function hostClipPreDelayMs(clip: HostAudioClip): number {
  return typeof clip === "string" ? 0 : (clip.preDelayMs ?? 0);
}

function dawnReportClip(): HostAudioClip {
  return hostClip("dawn-report");
}

function extractSeatNumbers(text: string): number[] {
  const seen = new Set<number>();
  for (const match of text.matchAll(/(\d{1,2})号/g)) {
    seen.add(Number(match[1]));
  }
  return [...seen];
}

function latestPublicMessageForPhase(game: HumanGameView, phase: HumanGameView["phase"]): string | undefined {
  return [...game.publicEvents].reverse().find((event) => event.day === game.day && event.phase === phase)?.message;
}

function buildDawnAudioCue(game: HumanGameView): HostAudioCue | undefined {
  const message = formatSystemMessage(game, latestPublicMessageForPhase(game, "DAY_ANNOUNCEMENT") ?? "");
  if (!message) return undefined;

  const deadSeatIds = extractSeatNumbers(message);
  if (message.includes("平安夜")) {
    return { key: `${game.id}:${game.day}:dawn:peaceful`, clips: [dawnReportClip(), hostClip("dawn-peaceful")] };
  }
  if (deadSeatIds.length > 0) {
    return {
      key: `${game.id}:${game.day}:dawn:${deadSeatIds.join("-")}`,
      clips: [dawnReportClip(), hostClip("dawn-deaths"), ...deadSeatIds.map(seatClip), hostClip("dead")],
    };
  }
  return { key: `${game.id}:${game.day}:dawn`, clips: [dawnReportClip()] };
}

function readEventSeatId(
  game: HumanGameView,
  event: HumanGameView["publicEvents"][number],
  key: "seatId" | "targetSeatId" | "wolfBeautySeatId" | "knightSeatId",
): number | undefined {
  const payloadSeatId = event.payload[key];
  return typeof payloadSeatId === "number"
    ? payloadSeatId
    : extractSeatNumbers(formatSystemMessage(game, event.message)).at(key === "targetSeatId" ? 1 : 0);
}

function readEventSeatIds(event: HumanGameView["publicEvents"][number], key: string): number[] {
  const value = event.payload[key];
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

function buildLastWordsAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  if (game.phase !== "LAST_WORDS" || !game.currentActorSeatId) return undefined;

  const actorSeatId = game.currentActorSeatId;
  const sourceEvent = [...game.publicEvents]
    .reverse()
    .find((event) => {
      if (event.type === "PLAYER_EXILED") return readEventSeatId(game, event, "seatId") === actorSeatId;
      if (event.type === "HUNTER_SHOT") return readEventSeatId(game, event, "targetSeatId") === actorSeatId;
      if (event.type === "WOLF_KING_SHOT") return readEventSeatId(game, event, "targetSeatId") === actorSeatId;
      return false;
    });
  if (!sourceEvent) return undefined;

  const key = `${game.id}:${sourceEvent.seq}:last-words:${actorSeatId}`;
  if (completedKeys.has(key)) return undefined;

  const resultClip =
    sourceEvent.type === "HUNTER_SHOT"
      ? hostClip("hunter-taken")
      : sourceEvent.type === "WOLF_KING_SHOT"
        ? hostClip("wolf-king-taken")
        : hostClip("exiled");
  return {
    key,
    clips: [seatClip(actorSeatId), resultClip, hostClip("last-words", { playbackRate: 1.08, volume: 0.9 })],
  };
}

function decisionCount(decisions: Record<string, unknown> | undefined): number {
  return Object.keys(decisions ?? {}).length;
}

function buildSeatPromptAudioCue({
  game,
  cueName,
  currentActor,
  includeIntro,
  introClip,
  humanClip,
  promptClip,
}: {
  game: HumanGameView;
  cueName: string;
  currentActor: HumanGameView["seats"][number] | undefined;
  includeIntro: boolean;
  introClip: string;
  humanClip: string;
  promptClip: string;
}): HostAudioCue {
  const clips: HostAudioClip[] = [];
  if (includeIntro) {
    clips.push(hostClip(introClip));
  }
  if (currentActor?.isHuman) {
    clips.push(hostClip(humanClip));
  } else if (currentActor) {
    clips.push(hostClip("please"), seatClip(currentActor.seatId), hostClip(promptClip));
  } else if (!includeIntro) {
    clips.push(hostClip(introClip));
  }
  return {
    key: `${game.id}:${game.day}:${cueName}:${currentActor?.seatId ?? "host"}:${includeIntro ? "intro" : "prompt"}`,
    clips,
  };
}

function buildPhaseIntroAudioCue(game: HumanGameView, cueName: string, introClip: string): HostAudioCue {
  return {
    key: `${game.id}:${game.day}:${cueName}:intro`,
    clips: [hostClip(introClip)],
  };
}

function buildSheriffResultAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  const event = findLatestUnplayedPublicEvent(
    game,
    completedKeys,
    new Set(["SHERIFF_NOMINATION_REVEALED", "SHERIFF_WITHDREW"]),
  );
  if (!event) return undefined;

  if (event.type === "SHERIFF_NOMINATION_REVEALED") {
    const candidateSeatIds = readEventSeatIds(event, "candidateSeatIds");
    return {
      key: `${game.id}:${event.seq}:${event.type}`,
      clips:
        candidateSeatIds.length > 0
          ? [...candidateSeatIds.map(seatClip), hostClip("sheriff-nominated")]
          : [hostClip("sheriff-nomination-none")],
    };
  }

  if (event.type === "SHERIFF_WITHDREW" && event.payload.withdraw === true) {
    const seatId = readEventSeatId(game, event, "seatId");
    if (!seatId) return undefined;
    return {
      key: `${game.id}:${event.seq}:${event.type}`,
      clips: [seatClip(seatId), hostClip("sheriff-withdrew")],
    };
  }

  return undefined;
}

function buildSheriffAudioCue(game: HumanGameView, currentActor: HumanGameView["seats"][number] | undefined): HostAudioCue | undefined {
  const sheriff = game.sheriff;

  switch (game.phase) {
    case "SHERIFF_NOMINATION":
      if (!currentActor?.isHuman) {
        return decisionCount(sheriff?.nominationDecisions) === 0
          ? buildPhaseIntroAudioCue(game, "sheriff-nomination", "sheriff-nomination-start")
          : undefined;
      }
      return buildSeatPromptAudioCue({
        game,
        cueName: "sheriff-nomination",
        currentActor,
        includeIntro: decisionCount(sheriff?.nominationDecisions) === 0,
        introClip: "sheriff-nomination-start",
        humanClip: "sheriff-nomination-human",
        promptClip: "sheriff-nomination-prompt",
      });
    case "SHERIFF_SPEECH":
      return buildSeatPromptAudioCue({
        game,
        cueName: "sheriff-speech",
        currentActor,
        includeIntro: (sheriff?.speechIndex ?? 0) === 0,
        introClip: "sheriff-speech-start",
        humanClip: "sheriff-speech-human",
        promptClip: "sheriff-speech-prompt",
      });
    case "SHERIFF_WITHDRAWAL":
      return buildPhaseIntroAudioCue(game, "sheriff-withdrawal", "sheriff-withdrawal-start");
    case "SHERIFF_VOTE":
      return buildPhaseIntroAudioCue(game, "sheriff-vote", "sheriff-vote-start");
    case "SHERIFF_PK_SPEECH":
      return buildSeatPromptAudioCue({
        game,
        cueName: "sheriff-pk-speech",
        currentActor,
        includeIntro: (sheriff?.speechIndex ?? 0) === 0,
        introClip: "sheriff-pk-speech-start",
        humanClip: "sheriff-pk-speech-human",
        promptClip: "sheriff-pk-speech-prompt",
      });
    case "SHERIFF_PK_VOTE":
      return buildPhaseIntroAudioCue(game, "sheriff-pk-vote", "sheriff-pk-vote-start");
    case "SHERIFF_HANDOFF":
      return buildSeatPromptAudioCue({
        game,
        cueName: "sheriff-handoff",
        currentActor,
        includeIntro: true,
        introClip: "sheriff-handoff-start",
        humanClip: "sheriff-handoff-human",
        promptClip: "sheriff-handoff-prompt",
      });
    default:
      return undefined;
  }
}

function buildWhiteWolfKingAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  const event = findLatestUnplayedPublicEvent(game, completedKeys, new Set(["WHITE_WOLF_KING_EXPLODED"]));
  if (!event) return undefined;

  const shooterSeatId = typeof event.payload.shooterSeatId === "number" ? event.payload.shooterSeatId : event.actorSeatId;
  const targetSeatId = readEventSeatId(game, event, "targetSeatId");
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    clips: [
      ...(shooterSeatId ? [seatClip(shooterSeatId), hostClip("white-wolf-king-exploded")] : [hostClip("white-wolf-king-exploded")]),
      ...(targetSeatId ? [seatClip(targetSeatId), hostClip("white-wolf-king-taken")] : []),
    ],
  };
}

function buildWolfBeautyAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  const event = findLatestUnplayedPublicEvent(game, completedKeys, new Set(["WOLF_BEAUTY_CHARM_TRIGGERED"]));
  if (!event) return undefined;

  const wolfBeautySeatId = readEventSeatId(game, event, "wolfBeautySeatId") ?? event.actorSeatId;
  const targetSeatId = readEventSeatId(game, event, "targetSeatId");
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    clips: [
      ...(wolfBeautySeatId ? [seatClip(wolfBeautySeatId), hostClip("wolf-beauty-charmed")] : [hostClip("wolf-beauty-charmed")]),
      ...(targetSeatId ? [seatClip(targetSeatId), hostClip("wolf-beauty-taken")] : []),
    ],
  };
}

function buildKnightAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  const event = findLatestUnplayedPublicEvent(game, completedKeys, new Set(["KNIGHT_DUEL_SUCCESS", "KNIGHT_DUEL_FAILED"]));
  if (!event) return undefined;

  const knightSeatId = readEventSeatId(game, event, "knightSeatId") ?? event.actorSeatId;
  const targetSeatId = readEventSeatId(game, event, "targetSeatId");
  const resultClip = event.type === "KNIGHT_DUEL_SUCCESS" ? "knight-duel-success" : "knight-duel-failed";
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    clips: [
      ...(knightSeatId ? [seatClip(knightSeatId), hostClip(resultClip)] : [hostClip(resultClip)]),
      ...(targetSeatId && event.type === "KNIGHT_DUEL_SUCCESS" ? [seatClip(targetSeatId), hostClip("knight-duel-taken")] : []),
    ],
  };
}

function buildIdiotAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  const event = findLatestUnplayedPublicEvent(game, completedKeys, new Set(["IDIOT_REVEALED"]));
  if (!event) return undefined;

  const seatId = readEventSeatId(game, event, "seatId") ?? event.actorSeatId;
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    clips: [...(seatId ? [seatClip(seatId)] : []), hostClip("idiot-revealed")],
  };
}

function buildHostAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string> = new Set()): HostAudioCue {
  const currentSpeaker = game.currentSpeakerSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;
  const pendingDawnCue = buildDawnAudioCue(game);
  const pendingLastWordsCue = buildLastWordsAudioCue(game, completedKeys);
  const pendingSheriffResultCue = buildSheriffResultAudioCue(game, completedKeys);
  const pendingWhiteWolfKingCue = buildWhiteWolfKingAudioCue(game, completedKeys);
  const pendingWolfBeautyCue = buildWolfBeautyAudioCue(game, completedKeys);
  const pendingKnightCue = buildKnightAudioCue(game, completedKeys);
  const pendingIdiotCue = buildIdiotAudioCue(game, completedKeys);

  if (pendingLastWordsCue) {
    return pendingLastWordsCue;
  }
  if (pendingIdiotCue && !completedKeys.has(pendingIdiotCue.key)) {
    return pendingIdiotCue;
  }
  if (pendingKnightCue && !completedKeys.has(pendingKnightCue.key)) {
    return pendingKnightCue;
  }
  if (pendingWolfBeautyCue && !completedKeys.has(pendingWolfBeautyCue.key)) {
    return pendingWolfBeautyCue;
  }
  if (pendingWhiteWolfKingCue && !completedKeys.has(pendingWhiteWolfKingCue.key)) {
    return pendingWhiteWolfKingCue;
  }
  if (pendingSheriffResultCue && !completedKeys.has(pendingSheriffResultCue.key)) {
    return pendingSheriffResultCue;
  }
  if (game.phase === "LAST_WORDS") {
    return { key: `${game.id}:${game.day}:last-words:idle:${game.currentActorSeatId ?? "host"}`, clips: [] };
  }

  if (game.phase === "DAY_SPEECH") {
    if (currentSpeaker?.isHuman) {
      return { key: `${game.id}:${game.day}:speech:human`, clips: [hostClip("your-turn-speak")] };
    }
    if (currentSpeaker) {
      return {
        key: `${game.id}:${game.day}:speech:${currentSpeaker.seatId}`,
        clips: [seatClip(currentSpeaker.seatId), hostClip("please-speak", { playbackRate: 1.16, volume: 0.88 })],
      };
    }
    return { key: `${game.id}:${game.day}:speech:complete`, clips: [] };
  }

  if (game.phase === "DAY_VOTE") {
    if (currentActor?.isHuman) {
      return { key: `${game.id}:${game.day}:vote:human`, clips: [hostClip("your-turn-vote")] };
    }
    if (currentActor) {
      return {
        key: `${game.id}:${game.day}:vote:${currentActor.seatId}`,
        clips: [hostClip("please"), seatClip(currentActor.seatId), hostClip("vote")],
      };
    }
    return { key: `${game.id}:${game.day}:vote:start`, clips: [hostClip("day-vote-start")] };
  }

  const pendingSheriffCue = buildSheriffAudioCue(game, currentActor);
  if (pendingSheriffCue) {
    return pendingSheriffCue;
  }

  if (game.phase === "DAY_ANNOUNCEMENT") {
    return pendingDawnCue ?? { key: `${game.id}:${game.day}:dawn:pending`, clips: [] };
  }

  if (game.phase === "EXILE_RESOLUTION") {
    const message = formatSystemMessage(game, latestPublicMessageForPhase(game, "EXILE_RESOLUTION") ?? "");
    const seatIds = extractSeatNumbers(message);
    if (message.includes("平票")) {
      return { key: `${game.id}:${game.day}:exile:tie`, clips: [hostClip("vote-tie")] };
    }
    if (message.includes("放逐") && seatIds[0]) {
      return {
        key: `${game.id}:${game.day}:exile:${seatIds[0]}`,
        clips: [seatClip(seatIds[0]), hostClip("exiled")],
      };
    }
    return { key: `${game.id}:${game.day}:exile`, clips: [hostClip("vote-revealed")] };
  }

  if (game.phase === "HUNTER_REVEAL") {
    return {
      key: `${game.id}:${game.day}:hunter-reveal:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [],
    };
  }

  if (game.phase === "HUNTER_SHOT") {
    return {
      key: `${game.id}:${game.day}:hunter:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [hostClip(currentActor?.isHuman ? "hunter-shot-human" : "hunter-shot")],
    };
  }

  if (game.phase === "WOLF_KING_SHOT") {
    return {
      key: `${game.id}:${game.day}:wolf-king:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [hostClip(currentActor?.isHuman ? "wolf-king-shot-human" : "wolf-king-shot")],
    };
  }

  if (game.phase === "KNIGHT_DUEL") {
    return {
      key: `${game.id}:${game.day}:knight:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [hostClip(currentActor?.isHuman ? "knight-duel-human" : "knight-duel")],
    };
  }

  if (game.phase === "GAME_OVER") {
    return {
      key: `${game.id}:game-over:${game.result?.winner ?? "unknown"}`,
      clips: [hostClip(game.result?.winner === "GOOD" ? "game-over-good" : "game-over-wolves")],
    };
  }

  const phaseClips: Partial<Record<HumanGameView["phase"], string>> = {
    NIGHT_WOLVES: "night-wolves",
    NIGHT_WOLF_BEAUTY: "night-wolf-beauty",
    NIGHT_GUARD: "night-guard",
    NIGHT_SEER: "night-seer",
    NIGHT_WITCH: "night-witch",
  };
  return {
    key: `${game.id}:${game.day}:${game.phase}:${latestPublicEvent(game)?.seq ?? 0}`,
    clips: [hostClip(phaseClips[game.phase] ?? "flow-next")],
  };
}

function buildAiSpeechAudioCue(
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

function findNewAiSpeech(
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

function createStreamingAiSpeechTtsQueue(options: {
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

function takeStableTtsChunk(
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

function findBoundaryIndex(text: string, pattern: RegExp, minIndex: number): number {
  for (let index = text.length - 1; index >= minIndex; index -= 1) {
    if (pattern.test(text[index] ?? "")) return index;
  }
  return -1;
}

function prepareAiSpeechAudio(url: string): HTMLAudioElement {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = 0.94;
  audio.playbackRate = AI_SPEECH_AUDIO_PLAYBACK_RATE;
  audio.preservesPitch = true;
  audio.load();
  return audio;
}

function waitForAudioReady(audio: HTMLAudioElement, timeoutMs = 700): Promise<void> {
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

async function tryPlayHostClip(audio: HTMLAudioElement, clip: string): Promise<void> {
  const sources = clip.endsWith(".mp3") ? [clip, clip.replace(/\.mp3$/, ".wav")] : [clip];
  let lastError: unknown;

  for (const source of sources) {
    try {
      audio.src = source;
      audio.load();
      await waitForAudioReady(audio);
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`音频加载失败：${source}`));
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function GameClient() {
  const [game, setGame] = useState<HumanGameView | null>(null);
  const [boards, setBoards] = useState<BoardOption[]>(DEFAULT_BOARD_OPTIONS);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(DEFAULT_BOARD_SELECTION.selectedBoardId);
  const [humanSeatMode, setHumanSeatMode] = useState<HumanSeatMode>("random");
  const [selectedHumanSeatId, setSelectedHumanSeatId] = useState<number | null>(DEFAULT_BOARD_SELECTION.selectedHumanSeatId);
  const [customAiFriends, setCustomAiFriends] = useState<AiFriendConfig[]>(EMPTY_CUSTOM_AI_FRIENDS);
  const [aiLlmSecrets, setAiLlmSecrets] = useState<AiFriendLlmSecretMap>({});
  const [selectedAiFriendIds, setSelectedAiFriendIds] = useState<string[]>(getDefaultSelectedAiFriendIds);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<AiRuntimeMode>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleIntroGameId, setRoleIntroGameId] = useState<string | null>(null);
  const [phaseCurtain, setPhaseCurtain] = useState<PhaseCurtainCue | null>(null);
  const [idiotReveal, setIdiotReveal] = useState<IdiotRevealCue | null>(null);
  const [identityBookOpen, setIdentityBookOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [hostAudioEnabled, setHostAudioEnabled] = useState(false);
  const [aiSpeechAudioEnabled, setAiSpeechAudioEnabled] = useState(false);
  const [liveAiSpeech, setLiveAiSpeech] = useState<LiveAiSpeech | null>(null);
  const [hostAudioStatus, setHostAudioStatus] = useState<HostAudioStatus | null>(null);
  const [aiSpeechAudioStatus, setAiSpeechAudioStatus] = useState<AiSpeechAudioStatus | null>(null);
  const [aiSpeechAudioUnavailable, setAiSpeechAudioUnavailable] = useState(false);
  const [pendingCommandType, setPendingCommandType] = useState<CommandPayload["type"] | null>(null);
  const [hostAudioCompletionTick, setHostAudioCompletionTick] = useState(0);
  const [aiSpeechAudioCompletionTick, setAiSpeechAudioCompletionTick] = useState(0);
  const lastCurtainKeyRef = useRef<string | null>(null);
  const activeIdiotRevealKeyRef = useRef<string | null>(null);
  const completedIdiotRevealKeysRef = useRef<Set<string>>(new Set());
  const idiotRevealTimerRef = useRef<number | null>(null);
  const autoReadGameIdRef = useRef<string | null>(null);
  const autoReadSpeechKeysRef = useRef<Set<string>>(new Set());
  const lastHostAudioKeyRef = useRef<string | null>(null);
  const completedHostAudioKeysRef = useRef<Set<string>>(new Set());
  const aiSpeechAudioGameIdRef = useRef<string | null>(null);
  const lastAiSpeechAudioKeyRef = useRef<string | null>(null);
  const completedAiSpeechAudioKeysRef = useRef<Set<string>>(new Set());
  const streamingAiSpeechAudioKeysRef = useRef<Set<string>>(new Set());
  const textFallbackAiSpeechKeysRef = useRef<Set<string>>(new Set());
  const aiSpeechAudioAttemptCountsRef = useRef<Map<string, number>>(new Map());
  const hostAudioRef = useRef<HTMLAudioElement | null>(null);
  const hostAudioRunRef = useRef(0);
  const aiSpeechAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiSpeechAudioRunRef = useRef(0);
  const recentGameIds = useSyncExternalStore(subscribeRecentGameIds, readRecentGameIds, getRecentGameIdsServerSnapshot);
  const effectiveAiSpeechAudioEnabled = aiSpeechAudioEnabled && !aiSpeechAudioUnavailable;
  const aiFriendOptions = useMemo(() => buildAiFriendOptions(customAiFriends), [customAiFriends]);
  const selectedAiFriends = useMemo(
    () => resolveSelectedAiFriends(aiFriendOptions, selectedAiFriendIds),
    [aiFriendOptions, selectedAiFriendIds],
  );
  const runtimeAiLlmConfigs = useMemo(
    () => (aiRuntimeMode === "llm" ? buildRuntimeAiLlmConfigs(customAiFriends, aiLlmSecrets) : undefined),
    [aiLlmSecrets, aiRuntimeMode, customAiFriends],
  );
  const runtimeAiTtsConfigs = useMemo(
    () => buildRuntimeAiTtsConfigs(customAiFriends, aiLlmSecrets),
    [aiLlmSecrets, customAiFriends],
  );
  const selectedBoard = useMemo(
    () => (selectedBoardId ? boards.find((board) => board.id === selectedBoardId) : undefined),
    [boards, selectedBoardId],
  );
  const aiLineupPreview = useMemo<AiLineupPreviewItem[]>(() => {
    const seatCount = selectedBoard?.seatCount ?? 0;
    const isSpectatorMode = humanSeatMode === "none";
    if (seatCount <= 0 || (!isSpectatorMode && !selectedHumanSeatId)) return [];
    const resolvedFriends = resolveAiFriendsForGame(selectedAiFriends, Math.max(0, isSpectatorMode ? seatCount : seatCount - 1));
    let aiIndex = 0;
    return Array.from({ length: seatCount }, (_, index) => {
      const seatId = index + 1;
      if (!isSpectatorMode && seatId === selectedHumanSeatId) {
        return {
          seatId,
          nickname: "你",
          isHuman: true,
          autoFilled: false,
        };
      }
      const friendIndex = aiIndex;
      const friend = resolvedFriends[friendIndex];
      aiIndex += 1;
      return {
        seatId,
        nickname: friend?.displayName ?? "AI",
        personaName: friend?.persona.name,
        modelLabel: friend?.persona.modelLabel,
        avatarDataUrl: friend?.config.avatarDataUrl,
        ttsVoice: friend?.config.ttsVoice,
        ttsConfig: friend?.config.ttsConfig,
        isHuman: false,
        autoFilled: friendIndex >= selectedAiFriends.length,
      };
    });
  }, [humanSeatMode, selectedAiFriends, selectedBoard?.seatCount, selectedHumanSeatId]);

  const selectBoard = useCallback(
    (boardId: string) => {
      if (selectedBoardId === boardId) {
        setSelectedBoardId(null);
        setHumanSeatMode("random");
        setSelectedHumanSeatId(null);
        return;
      }
      const board = boards.find((item) => item.id === boardId);
      setSelectedBoardId(boardId);
      if (!board) return;
      if (humanSeatMode === "none") {
        setSelectedHumanSeatId(null);
        return;
      }
      setSelectedHumanSeatId((current) => {
        if (humanSeatMode === "fixed" && current && current >= 1 && current <= board.seatCount) return current;
        return randomSeatId(board.seatCount);
      });
      if (humanSeatMode === "fixed" && selectedHumanSeatId && selectedHumanSeatId > board.seatCount) {
        setHumanSeatMode("random");
      }
    },
    [boards, humanSeatMode, selectedBoardId, selectedHumanSeatId],
  );

  const selectRandomHumanSeat = useCallback(() => {
    if (!selectedBoard) return;
    setHumanSeatMode("random");
    setSelectedHumanSeatId(randomSeatId(selectedBoard.seatCount));
  }, [selectedBoard]);

  const selectFixedHumanSeat = useCallback((seatId: number) => {
    setHumanSeatMode("fixed");
    setSelectedHumanSeatId(seatId);
  }, []);

  const selectNoHumanSeat = useCallback(() => {
    setHumanSeatMode("none");
    setSelectedHumanSeatId(null);
  }, []);

  const rememberGame = useCallback((gameId: string) => {
    try {
      const nextIds = [gameId, ...readRecentGameIds().filter((id) => id !== gameId)].slice(0, 5);
      window.localStorage.setItem(CURRENT_GAME_KEY, gameId);
      window.localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(nextIds));
    } catch {
      recentGameIdsRawCache = null;
      recentGameIdsSnapshotCache = EMPTY_RECENT_GAME_IDS;
    }
    try {
      window.dispatchEvent(new Event("ai-werewolf-recent-games-changed"));
    } catch {
      // Recent-game history is a convenience; it must not block starting a game.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHostAudioEnabled(window.localStorage.getItem(HOST_AUDIO_ENABLED_KEY) === "true");
      setAiSpeechAudioEnabled(window.localStorage.getItem(AI_SPEECH_AUDIO_ENABLED_KEY) === "true");
      setCustomAiFriends(readStoredCustomAiFriends());
      setAiLlmSecrets(readStoredAiFriendLlmSecrets());
      setSelectedAiFriendIds(readStoredSelectedAiFriendIds());
      setAiRuntimeMode(readStoredAiRuntimeMode());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (typeof fetch !== "function") return;
    void fetch("/api/games/boards")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("读取板子失败。"))))
      .then((data: { boards?: BoardOption[] }) => {
        if (cancelled) return;
        const nextBoards = data.boards ?? [];
        setBoards(nextBoards);
        setSelectedBoardId((current) => current ?? nextBoards[0]?.id ?? null);
        setSelectedHumanSeatId((current) => current ?? (nextBoards[0] ? randomSeatId(nextBoards[0].seatCount) : null));
      })
      .catch(() => {
        if (!cancelled) setError("读取板子列表失败。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopHostAudio = useCallback(() => {
    hostAudioRunRef.current += 1;
    if (hostAudioRef.current) {
      hostAudioRef.current.pause();
      hostAudioRef.current.src = "";
      hostAudioRef.current = null;
    }
    setHostAudioStatus(null);
  }, []);

  const stopAiSpeechAudio = useCallback(() => {
    aiSpeechAudioRunRef.current += 1;
    if (aiSpeechAudioRef.current) {
      aiSpeechAudioRef.current.pause();
      aiSpeechAudioRef.current.src = "";
      aiSpeechAudioRef.current = null;
    }
    setAiSpeechAudioStatus(null);
  }, []);

  const markAiSpeechAudioUnavailable = useCallback(
    (error: unknown) => {
      if (!isAiSpeechAudioUnavailableError(error)) return false;
      setAiSpeechAudioUnavailable(true);
      streamingAiSpeechAudioKeysRef.current.clear();
      stopAiSpeechAudio();
      return true;
    },
    [stopAiSpeechAudio],
  );

  const pauseAiSpeechAudio = useCallback(() => {
    const audio = aiSpeechAudioRef.current;
    if (!audio || audio.paused) return;
    audio.pause();
    setAiSpeechAudioStatus((current) => (current ? { ...current, state: "paused" } : current));
  }, []);

  const resumeAiSpeechAudio = useCallback(async () => {
    const audio = aiSpeechAudioRef.current;
    if (!audio || !audio.paused) return;
    try {
      await audio.play();
      setAiSpeechAudioStatus((current) => (current ? { ...current, state: "playing" } : current));
    } catch (audioError) {
      console.info(audioError instanceof Error ? audioError.message : "AI 发言音频恢复播放失败。");
    }
  }, []);

  const skipAiSpeechAudio = useCallback(() => {
    const speechKey = aiSpeechAudioStatus?.speechKey ?? lastAiSpeechAudioKeyRef.current;
    if (speechKey) {
      completedAiSpeechAudioKeysRef.current.add(speechKey);
      aiSpeechAudioAttemptCountsRef.current.delete(speechKey);
      streamingAiSpeechAudioKeysRef.current.delete(speechKey);
    }
    stopAiSpeechAudio();
    setAiSpeechAudioCompletionTick((tick) => tick + 1);
  }, [aiSpeechAudioStatus?.speechKey, stopAiSpeechAudio]);

  const toggleHostAudio = useCallback(() => {
    setHostAudioEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(HOST_AUDIO_ENABLED_KEY, String(next));
      if (next) {
        lastHostAudioKeyRef.current = null;
      } else {
        stopHostAudio();
      }
      return next;
    });
  }, [stopHostAudio]);

  const toggleAiSpeechAudio = useCallback(() => {
    setAiSpeechAudioEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(AI_SPEECH_AUDIO_ENABLED_KEY, String(next));
      if (next) {
        setAiSpeechAudioUnavailable(false);
        lastAiSpeechAudioKeyRef.current = null;
      } else {
        streamingAiSpeechAudioKeysRef.current.clear();
        stopAiSpeechAudio();
      }
      return next;
    });
  }, [stopAiSpeechAudio]);

  const playHostAudioCue = useCallback(
    async (cue: HostAudioCue, runId: number) => {
      setHostAudioStatus({ key: cue.key });
      for (const clip of cue.clips) {
        if (hostAudioRunRef.current !== runId) return;
        const preDelayMs = hostClipPreDelayMs(clip);
        if (preDelayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, preDelayMs));
          if (hostAudioRunRef.current !== runId) return;
        }
        const source = hostClipSrc(clip);
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.volume = typeof clip === "string" ? 0.92 : (clip.volume ?? 0.92);
        audio.playbackRate = typeof clip === "string" ? 1 : (clip.playbackRate ?? 1);
        hostAudioRef.current = audio;

        try {
          await tryPlayHostClip(audio, source);
        } catch {
          console.info(`主持音频未找到或被浏览器拦截：${source}`);
          return;
        }
      }
    },
    [],
  );

  const loadAiSpeechAudioUrl = useCallback(async (cue: AiSpeechAudioTextCue): Promise<string> => {
    const response = await fetch("/api/ai-speech-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: cue.gameId,
        speechKey: cue.speechKey,
        speakerSeatId: cue.speaker.seatId,
        speakerName: cue.voicePersonaName ?? cue.speaker.name,
        ttsVoice: cue.ttsVoice,
        ttsConfig: cue.ttsConfig,
        text: cue.text,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      const message = data.error ?? "AI 发言音频生成失败。";
      if (response.status === 503) {
        throw new AiSpeechAudioUnavailableError(message);
      }
      throw new Error(message);
    }
    return data.url;
  }, []);

  const loadAiSpeechAudioElement = useCallback(
    async (cue: AiSpeechAudioTextCue): Promise<HTMLAudioElement> => {
      const url = await loadAiSpeechAudioUrl(cue);
      return prepareAiSpeechAudio(url);
    },
    [loadAiSpeechAudioUrl],
  );

  const playAiSpeechAudioElement = useCallback(async (audio: HTMLAudioElement, runId: number, cue: AiSpeechAudioTextCue) => {
    if (aiSpeechAudioRunRef.current !== runId) return;

    aiSpeechAudioRef.current = audio;

    await waitForAudioReady(audio);
    await audio.play();
    setAiSpeechAudioStatus({
      speechKey: cue.speechKey,
      speaker: cue.speaker,
      state: "playing",
      text: cue.text,
    });
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error(`AI 发言音频加载失败：${audio.currentSrc || audio.src}`));
    });
  }, []);

  const playAiSpeechAudioText = useCallback(
    async (cue: AiSpeechAudioTextCue, runId: number) => {
      setAiSpeechAudioStatus({
        speechKey: cue.speechKey,
        speaker: cue.speaker,
        state: "loading",
        text: cue.text,
      });
      try {
        const audio = await loadAiSpeechAudioElement(cue);
        await playAiSpeechAudioElement(audio, runId, cue);
      } finally {
        if (aiSpeechAudioRunRef.current === runId) {
          setAiSpeechAudioStatus((current) => (current?.speechKey === cue.speechKey ? null : current));
        }
      }
    },
    [loadAiSpeechAudioElement, playAiSpeechAudioElement],
  );

  const playAiSpeechAudioCue = useCallback(
    async (cue: AiSpeechAudioCue, runId: number) => {
      const speaker = cue.speech.speaker;
      if (!speaker) return;
      await playAiSpeechAudioText(
        {
          gameId: cue.gameId,
          speechKey: cue.key,
          speaker,
          voicePersonaName: cue.voicePersonaName,
          ttsVoice: cue.ttsVoice,
          ttsConfig: cue.ttsConfig,
          text: cue.speech.message,
        },
        runId,
      );
    },
    [playAiSpeechAudioText],
  );

  const loadGameById = useCallback(
    async (gameId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) throw new Error("对局不存在或已被清理。");
        const view = (await response.json()) as HumanGameView;
        rememberGame(view.id);
        setRoleIntroGameId(null);
        setGame(view);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "读取对局失败。");
      } finally {
        setLoading(false);
      }
    },
    [rememberGame],
  );

  const startGame = useCallback(async (boardId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: boardId ?? selectedBoardId ?? undefined,
          humanSeatId: humanSeatMode === "none" ? null : selectedHumanSeatId ?? undefined,
          aiFriends: selectedAiFriends,
        }),
      });
      if (!response.ok) throw new Error("创建对局失败。");
      const view = (await response.json()) as HumanGameView;
      rememberGame(view.id);
      setRoleIntroGameId(view.humanSeatId === null ? null : view.id);
      setGame(view);
    } catch {
      setError("创建对局失败。");
    } finally {
      setLoading(false);
    }
  }, [humanSeatMode, rememberGame, selectedAiFriends, selectedBoardId, selectedHumanSeatId]);

  const returnHome = useCallback(() => {
    setGame(null);
    setLoading(false);
    setError(null);
    setRoleIntroGameId(null);
    setPhaseCurtain(null);
    setIdiotReveal(null);
    setIdentityBookOpen(false);
    setGlossaryOpen(false);
    setLiveAiSpeech(null);
    setPendingCommandType(null);
    stopHostAudio();
    stopAiSpeechAudio();
    lastCurtainKeyRef.current = null;
    activeIdiotRevealKeyRef.current = null;
    autoReadGameIdRef.current = null;
    autoReadSpeechKeysRef.current.clear();
    completedHostAudioKeysRef.current.clear();
    completedAiSpeechAudioKeysRef.current.clear();
    streamingAiSpeechAudioKeysRef.current.clear();
    textFallbackAiSpeechKeysRef.current.clear();
    aiSpeechAudioAttemptCountsRef.current.clear();
    aiSpeechAudioGameIdRef.current = null;
    lastHostAudioKeyRef.current = null;
    lastAiSpeechAudioKeyRef.current = null;
    if (idiotRevealTimerRef.current !== null) {
      window.clearTimeout(idiotRevealTimerRef.current);
      idiotRevealTimerRef.current = null;
    }
    try {
      window.localStorage.removeItem(CURRENT_GAME_KEY);
      window.dispatchEvent(new Event("ai-werewolf-recent-games-changed"));
    } catch {
      // Returning home is a UI transition; storage cleanup should not block it.
    }
  }, [stopAiSpeechAudio, stopHostAudio]);

  const submitCommand = useCallback(async (payload: CommandPayload) => {
    if (!game) return;
    setLoading(true);
    setError(null);
    setLiveAiSpeech(null);
    setPendingCommandType(payload.type);
    let streamingTts: ReturnType<typeof createStreamingAiSpeechTtsQueue> | undefined;
    try {
      if (payload.type === "continue") {
        const previousSpeechKeys = new Set(game.tableSummary.recentSpeeches.map((speech) => speechStreamKey(game.id, speech)));
        const streamingSpeaker = game.currentSpeakerSeatId
          ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
          : undefined;
        let streamingSpeechKeyPrefix: string | undefined;
        if (effectiveAiSpeechAudioEnabled && streamingSpeaker && streamingSpeaker.seatId !== game.humanSeatId) {
          stopAiSpeechAudio();
          const runId = aiSpeechAudioRunRef.current;
          const speechKeyPrefix = `${game.id}:${game.day}:live-tts:${streamingSpeaker.seatId}`;
          streamingSpeechKeyPrefix = speechKeyPrefix;
          streamingTts = createStreamingAiSpeechTtsQueue({
            gameId: game.id,
            speechKeyPrefix,
            speaker: streamingSpeaker,
            voicePersonaName: streamingSpeaker.personaName,
            ttsVoice: streamingSpeaker.ttsVoice,
            ttsConfig: getSeatTtsConfig(game, streamingSpeaker.seatId, runtimeAiTtsConfigs),
            runId,
            loadChunk: loadAiSpeechAudioElement,
            playLoadedChunk: playAiSpeechAudioElement,
            shouldContinue: () => aiSpeechAudioRunRef.current === runId,
            onError: (audioError) => {
              markAiSpeechAudioUnavailable(audioError);
              console.info(audioError instanceof Error ? audioError.message : "AI 发言流式音频播放失败。");
            },
          });
        }

        const streamedView = await submitStreamingContinue(
          game,
          payload,
          runtimeAiLlmConfigs,
          aiRuntimeMode,
          setLiveAiSpeech,
          streamingTts?.push,
        );
        const streamedSpeech =
          streamingTts && streamingSpeaker ? findNewAiSpeech(streamedView, previousSpeechKeys, streamingSpeaker.seatId) : undefined;
        if (streamingTts && streamedSpeech) {
          const streamedSpeechKey = speechStreamKey(streamedView.id, streamedSpeech);
          streamingAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
          lastAiSpeechAudioKeyRef.current = streamedSpeechKey;
          void streamingTts
            .finish(streamedSpeech.message)
            .then(() => {
              completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
              aiSpeechAudioAttemptCountsRef.current.delete(streamedSpeechKey);
            })
            .catch((audioError) => {
              const unavailable = markAiSpeechAudioUnavailable(audioError);
              console.info(audioError instanceof Error ? audioError.message : "AI 发言流式音频播放失败。");
              if (streamingTts?.hasPlayedAny()) {
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
              } else {
                textFallbackAiSpeechKeysRef.current.add(streamedSpeechKey);
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
                if (!unavailable) {
                  lastAiSpeechAudioKeyRef.current = null;
                }
              }
            })
            .finally(() => {
              streamingAiSpeechAudioKeysRef.current.delete(streamedSpeechKey);
              setAiSpeechAudioStatus((current) =>
                streamingSpeechKeyPrefix && current?.speechKey.startsWith(streamingSpeechKeyPrefix) ? null : current,
              );
              setAiSpeechAudioCompletionTick((tick) => tick + 1);
            });
        } else {
          streamingTts?.cancel();
        }
        setGame(streamedView);
        return;
      }

      const response = await fetch(`/api/games/${game.id}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, aiRuntimeMode, aiLlmConfigs: runtimeAiLlmConfigs }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "动作执行失败。");
      }
      setGame(data as HumanGameView);
    } catch (submitError) {
      streamingTts?.cancel();
      setError(submitError instanceof Error ? submitError.message : "动作执行失败。");
    } finally {
      setLiveAiSpeech(null);
      setPendingCommandType(null);
      setLoading(false);
    }
  }, [
    aiRuntimeMode,
    effectiveAiSpeechAudioEnabled,
    game,
    loadAiSpeechAudioElement,
    markAiSpeechAudioUnavailable,
    playAiSpeechAudioElement,
    runtimeAiLlmConfigs,
    runtimeAiTtsConfigs,
    stopAiSpeechAudio,
  ]);

  useEffect(() => {
    if (!game) return;
    const event = findLatestUnplayedPublicEvent(game, completedIdiotRevealKeysRef.current, IDIOT_REVEAL_EVENT_TYPES);
    if (!event) return;

    const cue = buildIdiotRevealCue(game, event);
    if (!cue || activeIdiotRevealKeyRef.current === cue.key) return;

    activeIdiotRevealKeyRef.current = cue.key;
    window.setTimeout(() => setIdiotReveal(cue), 0);
    if (idiotRevealTimerRef.current !== null) window.clearTimeout(idiotRevealTimerRef.current);
    idiotRevealTimerRef.current = window.setTimeout(() => {
      completedIdiotRevealKeysRef.current.add(cue.key);
      if (activeIdiotRevealKeyRef.current === cue.key) activeIdiotRevealKeyRef.current = null;
      setIdiotReveal((current) => (current?.key === cue.key ? null : current));
      idiotRevealTimerRef.current = null;
    }, 4200);
  }, [game]);

  useEffect(() => {
    return () => {
      if (idiotRevealTimerRef.current !== null) window.clearTimeout(idiotRevealTimerRef.current);
    };
  }, []);

  const phaseCurtainActive = Boolean(phaseCurtain);
  const idiotRevealActive = Boolean(idiotReveal);

  useEffect(() => {
    if (!game || loading || error || game.result || roleIntroGameId === game.id || phaseCurtainActive || idiotRevealActive) return;
    if (findLatestUnplayedPublicEvent(game, completedIdiotRevealKeysRef.current, IDIOT_REVEAL_EVENT_TYPES)) return;

    const currentSpeechKeys = new Set(game.tableSummary.recentSpeeches.map((speech) => speechStreamKey(game.id, speech)));
    if (autoReadGameIdRef.current !== game.id) {
      autoReadGameIdRef.current = game.id;
      autoReadSpeechKeysRef.current = currentSpeechKeys;
    }

    const action = game.availableActions[0];
    const isAutoStep = game.availableActions.length === 1 && action?.type === "continue";
    if (!isAutoStep) return;

    const pendingAiSpeechCue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
    const latestAiSpeech = getLatestStreamableAiSpeech(game);
    const latestAiSpeechKey = latestAiSpeech ? speechStreamKey(game.id, latestAiSpeech) : undefined;
    if (effectiveAiSpeechAudioEnabled && pendingAiSpeechCue) {
      return;
    }

    if (hostAudioEnabled) {
      const cue = buildHostAudioCue(game, completedHostAudioKeysRef.current);
      if (cue.clips.length > 0 && !completedHostAudioKeysRef.current.has(cue.key)) return;
    }

    const speechToRead =
      latestAiSpeech &&
      latestAiSpeechKey &&
      (!effectiveAiSpeechAudioEnabled || textFallbackAiSpeechKeysRef.current.has(latestAiSpeechKey)) &&
      !autoReadSpeechKeysRef.current.has(latestAiSpeechKey)
        ? latestAiSpeech
        : undefined;
    if (latestAiSpeechKey) {
      autoReadSpeechKeysRef.current.add(latestAiSpeechKey);
    }

    const timer = window.setTimeout(() => {
      void submitCommand({ type: "continue" });
    }, getAutoAdvanceDelay(game, action, speechToRead));

    return () => window.clearTimeout(timer);
  }, [
    aiSpeechAudioCompletionTick,
    effectiveAiSpeechAudioEnabled,
    error,
    game,
    hostAudioCompletionTick,
    hostAudioEnabled,
    idiotRevealActive,
    loading,
    phaseCurtainActive,
    roleIntroGameId,
    runtimeAiTtsConfigs,
    submitCommand,
  ]);

  useEffect(() => {
    if (!game || roleIntroGameId === game.id) return;

    const curtainKey = `${game.id}:${game.day}:${game.phase}`;
    if (lastCurtainKeyRef.current === curtainKey) return;
    lastCurtainKeyRef.current = curtainKey;

    const cue = getPhaseCurtainCue(game);
    setPhaseCurtain(cue);
    const timer = window.setTimeout(() => setPhaseCurtain(null), cue.durationMs);
    return () => window.clearTimeout(timer);
  }, [game, roleIntroGameId]);

  useEffect(() => {
    if (!game) return;
    if (aiSpeechAudioGameIdRef.current === game.id) return;

    aiSpeechAudioGameIdRef.current = game.id;
    lastAiSpeechAudioKeyRef.current = null;
    textFallbackAiSpeechKeysRef.current.clear();
    for (const speech of game.tableSummary.recentSpeeches) {
      completedAiSpeechAudioKeysRef.current.add(speechStreamKey(game.id, speech));
    }
  }, [game]);

  useEffect(() => {
    if (!game || !hostAudioEnabled || roleIntroGameId === game.id) return;

    if (effectiveAiSpeechAudioEnabled && game.phase !== "DAY_ANNOUNCEMENT") {
      const pendingAiSpeechCue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
      if (pendingAiSpeechCue && !completedAiSpeechAudioKeysRef.current.has(pendingAiSpeechCue.key)) return;
    }

    const cue = buildHostAudioCue(game, completedHostAudioKeysRef.current);
    if (completedHostAudioKeysRef.current.has(cue.key)) return;
    if (cue.clips.length === 0) {
      completedHostAudioKeysRef.current.add(cue.key);
      setHostAudioCompletionTick((tick) => tick + 1);
      return;
    }
    if (lastHostAudioKeyRef.current === cue.key) return;
    lastHostAudioKeyRef.current = cue.key;
    stopHostAudio();
    const runId = hostAudioRunRef.current;

    const delayMs = game.phase === "DAY_ANNOUNCEMENT" ? 0 : 260;
    const timer = window.setTimeout(() => {
      void playHostAudioCue(cue, runId).finally(() => {
        if (hostAudioRunRef.current === runId) {
          setHostAudioStatus(null);
          completedHostAudioKeysRef.current.add(cue.key);
          setHostAudioCompletionTick((tick) => tick + 1);
        }
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    aiSpeechAudioCompletionTick,
    effectiveAiSpeechAudioEnabled,
    game,
    hostAudioCompletionTick,
    hostAudioEnabled,
    playHostAudioCue,
    roleIntroGameId,
    runtimeAiTtsConfigs,
    stopHostAudio,
  ]);

  useEffect(() => {
    if (!game || !effectiveAiSpeechAudioEnabled || roleIntroGameId === game.id) return;

    const cue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
    if (!cue) return;
    if (completedAiSpeechAudioKeysRef.current.has(cue.key)) return;
    if (streamingAiSpeechAudioKeysRef.current.has(cue.key)) return;
    if (lastAiSpeechAudioKeyRef.current === cue.key) return;

    lastAiSpeechAudioKeyRef.current = cue.key;
    stopAiSpeechAudio();
    const runId = aiSpeechAudioRunRef.current;

    const timer = window.setTimeout(() => {
      void playAiSpeechAudioCue(cue, runId)
        .then(() => {
          completedAiSpeechAudioKeysRef.current.add(cue.key);
          aiSpeechAudioAttemptCountsRef.current.delete(cue.key);
        })
        .catch((audioError) => {
          const unavailable = markAiSpeechAudioUnavailable(audioError);
          console.info(audioError instanceof Error ? audioError.message : "AI 发言音频播放失败。");
          const attempts = (aiSpeechAudioAttemptCountsRef.current.get(cue.key) ?? 0) + 1;
          aiSpeechAudioAttemptCountsRef.current.set(cue.key, attempts);
          if (!unavailable) {
            lastAiSpeechAudioKeyRef.current = null;
          }
          if (attempts < AI_SPEECH_AUDIO_MAX_ATTEMPTS) return;
          completedAiSpeechAudioKeysRef.current.add(cue.key);
          textFallbackAiSpeechKeysRef.current.add(cue.key);
          aiSpeechAudioAttemptCountsRef.current.delete(cue.key);
        })
        .finally(() => {
          if (aiSpeechAudioRunRef.current === runId) {
            setAiSpeechAudioCompletionTick((tick) => tick + 1);
          }
        });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    aiSpeechAudioCompletionTick,
    effectiveAiSpeechAudioEnabled,
    game,
    markAiSpeechAudioUnavailable,
    playAiSpeechAudioCue,
    roleIntroGameId,
    runtimeAiTtsConfigs,
    stopAiSpeechAudio,
  ]);

  useEffect(() => {
    return () => {
      stopHostAudio();
      stopAiSpeechAudio();
    };
  }, [stopAiSpeechAudio, stopHostAudio]);

  const latestEvents = useMemo(
    () => game?.publicEvents.filter((event) => event.phase !== "DAY_SPEECH").slice(-18).reverse() ?? [],
    [game],
  );

  return (
    <main
      className="min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.88)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <div className={game ? "hidden sm:block" : ""}>
          <RoomHeader
            game={game}
            loading={loading}
            aiSpeechAudioEnabled={aiSpeechAudioEnabled}
            aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
            hostAudioEnabled={hostAudioEnabled}
            onNewGame={startGame}
            onReturnHome={game ? returnHome : undefined}
            onOpenIdentityBook={() => setIdentityBookOpen(true)}
            onOpenGlossary={() => setGlossaryOpen(true)}
            onToggleAiSpeechAudio={toggleAiSpeechAudio}
            onToggleHostAudio={toggleHostAudio}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-[#e46d55]/45 bg-[#381511]/90 px-4 py-3 text-sm text-[#ffd8cf] shadow-lg">
            {error}
          </div>
        )}

        {!game ? (
          <LandingPanel
            loading={loading}
            boards={boards}
            selectedBoardId={selectedBoardId}
            onSelectBoard={selectBoard}
            humanSeatMode={humanSeatMode}
            selectedHumanSeatId={selectedHumanSeatId}
            onSelectRandomHumanSeat={selectRandomHumanSeat}
            onSelectFixedHumanSeat={selectFixedHumanSeat}
            onSelectNoHumanSeat={selectNoHumanSeat}
            selectedAiFriendCount={selectedAiFriends.length}
            customAiFriendCount={customAiFriends.length}
            aiLineupPreview={aiLineupPreview}
            recentGameIds={recentGameIds}
            onLoadGame={loadGameById}
            onStartGame={() => startGame(selectedBoardId ?? undefined)}
          />
        ) : (
          <div className="grid flex-1 gap-4">
            <MobileGameTable
              game={game}
              loading={loading}
              pendingCommandType={pendingCommandType}
              liveAiSpeech={liveAiSpeech}
              hostAudioEnabled={hostAudioEnabled}
              aiSpeechAudioEnabled={aiSpeechAudioEnabled}
              hostAudioStatus={hostAudioStatus}
              aiSpeechAudioStatus={aiSpeechAudioStatus}
              aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
              events={latestEvents}
              onNewGame={() => startGame()}
              onReturnHome={returnHome}
              onSubmit={submitCommand}
              onOpenIdentityBook={() => setIdentityBookOpen(true)}
              onOpenGlossary={() => setGlossaryOpen(true)}
              onToggleAiSpeechAudio={toggleAiSpeechAudio}
              onToggleHostAudio={toggleHostAudio}
            />

            <div className="hidden gap-4 sm:grid">
              <PhaseRhythm game={game} />
              <HostStage game={game} />
              <FlowStatusBar
                game={game}
                loading={loading}
                pendingCommandType={pendingCommandType}
                liveAiSpeech={liveAiSpeech}
                hostAudioStatus={hostAudioStatus}
                aiSpeechAudioStatus={aiSpeechAudioStatus}
                aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
                onPauseAiSpeechAudio={pauseAiSpeechAudio}
                onResumeAiSpeechAudio={resumeAiSpeechAudio}
                onSkipAiSpeechAudio={skipAiSpeechAudio}
                onToggleAiSpeechAudio={toggleAiSpeechAudio}
              />
              <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,420px)]">
                <div className="grid content-start gap-4">
                  <SeatBoard game={game} liveAiSpeech={liveAiSpeech} aiSpeechAudioStatus={aiSpeechAudioStatus} />
                  {game.review && <ReviewPanel game={game} />}
                </div>

                <aside className="grid content-start gap-4">
                  <ActionPanel game={game} loading={loading} onNewGame={startGame} onReturnHome={returnHome} onSubmit={submitCommand} />
                  <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />
                  <AuxiliaryInfoPanel game={game} events={latestEvents} />
                </aside>
              </section>
            </div>
          </div>
        )}
      </div>

      {game && game.humanSeatId !== null && roleIntroGameId === game.id && (
        <RoleIntroOverlay game={game} onEnter={() => setRoleIntroGameId(null)} onReturnHome={returnHome} />
      )}
      {identityBookOpen && (
        <IdentityBookOverlay game={game} activeBoardId={game?.board.id ?? selectedBoardId ?? undefined} onClose={() => setIdentityBookOpen(false)} />
      )}
      {glossaryOpen && <GlossaryOverlay onClose={() => setGlossaryOpen(false)} />}
      {phaseCurtain && <PhaseCurtain cue={phaseCurtain} />}
      {idiotReveal && <IdiotRevealOverlay key={idiotReveal.key} cue={idiotReveal} />}
    </main>
  );
}

function readRecentGameIds(): string[] {
  if (typeof window === "undefined") {
    return EMPTY_RECENT_GAME_IDS;
  }

  try {
    const raw = window.localStorage.getItem(RECENT_GAMES_KEY);
    if (raw === recentGameIdsRawCache) {
      return recentGameIdsSnapshotCache;
    }

    recentGameIdsRawCache = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    recentGameIdsSnapshotCache = Array.isArray(parsed)
      ? parsed.filter((gameId): gameId is string => typeof gameId === "string").slice(0, 5)
      : EMPTY_RECENT_GAME_IDS;
    return recentGameIdsSnapshotCache;
  } catch {
    recentGameIdsRawCache = null;
    recentGameIdsSnapshotCache = EMPTY_RECENT_GAME_IDS;
    return EMPTY_RECENT_GAME_IDS;
  }
}

function getRecentGameIdsServerSnapshot(): string[] {
  return EMPTY_RECENT_GAME_IDS;
}

function subscribeRecentGameIds(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== CURRENT_GAME_KEY && event.key !== RECENT_GAMES_KEY) return;
    recentGameIdsRawCache = null;
    onStoreChange();
  };
  const handleLocalChange = () => {
    recentGameIdsRawCache = null;
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("ai-werewolf-recent-games-changed", handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("ai-werewolf-recent-games-changed", handleLocalChange);
  };
}

import type { HumanGameView } from "@/game/types";
import { formatSystemMessage } from "./viewHelpers";
import { hostAudioSrc } from "./hostAudioFiles";

export function latestPublicEvent(game: HumanGameView): HumanGameView["publicEvents"][number] | undefined {
  return game.publicEvents.at(-1);
}

export function findLatestUnplayedPublicEvent(
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

export type HostAudioClip =
  | string
  | {
      src: string;
      playbackRate?: number;
      volume?: number;
      preDelayMs?: number;
    };

export type HostAudioCue = {
  key: string;
  clips: HostAudioClip[];
};

export function hostClip(name: string, options?: Omit<Extract<HostAudioClip, { src: string }>, "src">): HostAudioClip {
  const src = hostAudioSrc(name);
  return options ? { src, ...options } : src;
}

export function seatClip(seatId: number): HostAudioClip {
  return hostClip(`seat-${seatId}`);
}

export function hostClipSrc(clip: HostAudioClip): string {
  return typeof clip === "string" ? clip : clip.src;
}

export function hostClipPreDelayMs(clip: HostAudioClip): number {
  return typeof clip === "string" ? 0 : (clip.preDelayMs ?? 0);
}

export function dawnReportClip(): HostAudioClip {
  return hostClip("dawn-report");
}

export function extractSeatNumbers(text: string): number[] {
  const seen = new Set<number>();
  for (const match of text.matchAll(/(\d{1,2})号/g)) {
    seen.add(Number(match[1]));
  }
  return [...seen];
}

export function latestPublicMessageForPhase(game: HumanGameView, phase: HumanGameView["phase"]): string | undefined {
  return [...game.publicEvents].reverse().find((event) => event.day === game.day && event.phase === phase)?.message;
}

export function buildDawnAudioCue(game: HumanGameView): HostAudioCue | undefined {
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

export function readEventSeatId(
  game: HumanGameView,
  event: HumanGameView["publicEvents"][number],
  key: "seatId" | "targetSeatId" | "wolfBeautySeatId" | "knightSeatId",
): number | undefined {
  const payloadSeatId = event.payload[key];
  return typeof payloadSeatId === "number"
    ? payloadSeatId
    : extractSeatNumbers(formatSystemMessage(game, event.message)).at(key === "targetSeatId" ? 1 : 0);
}

export function readEventSeatIds(event: HumanGameView["publicEvents"][number], key: string): number[] {
  const value = event.payload[key];
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

export function buildLastWordsAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
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

export function decisionCount(decisions: Record<string, unknown> | undefined): number {
  return Object.keys(decisions ?? {}).length;
}

export function buildSeatPromptAudioCue({
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

export function buildPhaseIntroAudioCue(game: HumanGameView, cueName: string, introClip: string): HostAudioCue {
  return {
    key: `${game.id}:${game.day}:${cueName}:intro`,
    clips: [hostClip(introClip)],
  };
}

export function buildSheriffResultAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
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

export function buildSheriffAudioCue(game: HumanGameView, currentActor: HumanGameView["seats"][number] | undefined): HostAudioCue | undefined {
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

export function buildWhiteWolfKingAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
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

export function buildWolfBeautyAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
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

export function buildKnightAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
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

export function buildIdiotAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string>): HostAudioCue | undefined {
  const event = findLatestUnplayedPublicEvent(game, completedKeys, new Set(["IDIOT_REVEALED"]));
  if (!event) return undefined;

  const seatId = readEventSeatId(game, event, "seatId") ?? event.actorSeatId;
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    clips: [...(seatId ? [seatClip(seatId)] : []), hostClip("idiot-revealed")],
  };
}

export function buildHostAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string> = new Set()): HostAudioCue {
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

export function buildThemedHostAudioCue(
  game: HumanGameView,
  completedKeys: ReadonlySet<string> = new Set(),
  options: { classTrialThemeActive: boolean },
): HostAudioCue {
  const cue = buildHostAudioCue(game, completedKeys);
  return options.classTrialThemeActive ? { ...cue, key: `class-trial:${cue.key}` } : cue;
}

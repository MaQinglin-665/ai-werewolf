import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import { MODEL_CARD_IMAGES, ROLE_CARD_IMAGES, getSeatCardImage } from "./viewHelpers";

export type MobileInfoTabKey = "identity" | "speech" | "vote" | "log";

export const MOBILE_INFO_TABS: Array<{ key: MobileInfoTabKey; label: string }> = [
  { key: "identity", label: "身份" },
  { key: "speech", label: "发言" },
  { key: "vote", label: "票型" },
  { key: "log", label: "记录" },
];

export type MobileSeatStageLayout = {
  compact: boolean;
  left: number;
  top: number;
  side: "left" | "right" | "ring";
};

export function getMobileSeatStageLayout(index: number, seatCount: number): MobileSeatStageLayout {
  if (seatCount <= 6) {
    const leftColumnCount = Math.ceil(seatCount / 2);
    const isLeft = index < leftColumnCount;
    const columnIndex = isLeft ? index : index - leftColumnCount;
    const rowsInColumn = isLeft ? leftColumnCount : seatCount - leftColumnCount;
    const topStart = 27;
    const topEnd = 75;
    const top = rowsInColumn <= 1 ? 51 : topStart + ((topEnd - topStart) / (rowsInColumn - 1)) * columnIndex;
    return {
      compact: false,
      left: isLeft ? 12 : 88,
      top: Math.round(top),
      side: isLeft ? "left" : "right",
    };
  }

  const angle = -90 + (index / Math.max(seatCount, 1)) * 360;
  const radians = (angle * Math.PI) / 180;
  return {
    compact: seatCount >= 10,
    left: Math.round(50 + Math.cos(radians) * 38),
    top: Math.round(49 + Math.sin(radians) * 33),
    side: "ring",
  };
}

export function getMobileSeatCounts(game: HumanGameView): { aliveCount: number; deadCount: number } {
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  return { aliveCount, deadCount: game.seats.length - aliveCount };
}

export function getMobileFocusSeat(
  game: HumanGameView,
):
  | { kind: "actor" | "speaker"; label: string; seat: HumanGameView["seats"][number] }
  | { kind: "none"; label: string; seat: undefined } {
  const actorSeat = game.seats.find((seat) => seat.seatId === game.currentActorSeatId);
  if (actorSeat) {
    return { kind: "actor", label: "行动中", seat: actorSeat };
  }

  const speakerSeat = game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId);
  if (speakerSeat) {
    return { kind: "speaker", label: "发言中", seat: speakerSeat };
  }

  return {
    kind: "none",
    label: game.phase.startsWith("NIGHT") ? "夜晚流程" : "桌面等待",
    seat: undefined,
  };
}

export function getMobileActionMode(
  game: HumanGameView,
  loading = false,
): { kind: "player" | "auto" | "waiting" | "loading" | "gameOver"; label: string; action?: AvailableHumanAction } {
  if (game.result) {
    return { kind: "gameOver", label: "终局" };
  }

  const firstAction = game.availableActions[0];
  if (loading) {
    return { kind: "loading", label: "结算中", action: firstAction };
  }

  if (!firstAction) {
    return { kind: "waiting", label: "等待 AI 行动" };
  }

  const playerAction = game.availableActions.find((action) => action.type !== "continue");
  if (playerAction) {
    return { kind: "player", label: "轮到你行动", action: firstAction };
  }

  return { kind: "auto", label: "自动播放", action: firstAction };
}

export function getMobileActionPanelLayout(
  game: HumanGameView,
  loading = false,
): { actionLayerClassName: string; dockClassName: string } {
  const actionMode = getMobileActionMode(game, loading);
  return {
    actionLayerClassName: `mobile-centered-action mobile-centered-action-stage mobile-centered-action-${actionMode.kind}`,
    dockClassName: "mobile-action-dock mobile-action-dock-drawers-only",
  };
}

export function hasMobileSpeechDrawerAction(game: HumanGameView): boolean {
  return game.availableActions.some(
    (action) => action.type === "speak" || action.type === "lastWords" || action.type === "sheriffSpeech",
  );
}

export function shouldShowMobileStageAction(game: HumanGameView): boolean {
  return !hasMobileSpeechDrawerAction(game);
}

export function getMobileSpeechInputPrompt(game: HumanGameView): { label: string; ariaLabel: string } | undefined {
  const action = game.availableActions.find(
    (availableAction) =>
      availableAction.type === "speak" || availableAction.type === "lastWords" || availableAction.type === "sheriffSpeech",
  );

  if (!action) return undefined;

  if (action.type === "lastWords") {
    return { label: "打开遗言", ariaLabel: "打开遗言输入" };
  }

  if (action.type === "sheriffSpeech") {
    return { label: "打开竞选发言", ariaLabel: "打开警长竞选发言输入" };
  }

  return { label: "打开发言", ariaLabel: "打开本轮发言输入" };
}

export function getMobileSpeechHighlights(
  speeches: HumanGameView["tableSummary"]["recentSpeeches"],
): {
  primary?: HumanGameView["tableSummary"]["recentSpeeches"][number];
  previous?: HumanGameView["tableSummary"]["recentSpeeches"][number];
} {
  const recent = speeches.slice(-2);
  return {
    primary: recent.at(-1),
    previous: recent.length > 1 ? recent[0] : undefined,
  };
}

export type MobilePhaseSignalTone = "night" | "day" | "vote" | "danger" | "end";

export type MobileDrawerSeenState = {
  latestSpeechSeq: number;
  voteMarker: number;
  logMarker: number;
};

export type MobileDrawerSnapshot = MobileDrawerSeenState & {
  latestSpeechSeatId?: number;
  latestSpeechLabel?: string;
  recommendedTab: MobileInfoTabKey;
};

export function getMobileFilteredSpeeches(
  speeches: HumanGameView["tableSummary"]["recentSpeeches"],
  selectedSeatId: number | null,
): HumanGameView["tableSummary"]["recentSpeeches"] {
  if (!selectedSeatId) return speeches;
  return speeches.filter((speech) => speech.speaker?.seatId === selectedSeatId);
}

export function getMobileDrawerSnapshot(
  game: HumanGameView,
  events: HumanGameView["publicEvents"],
): MobileDrawerSnapshot {
  const latestSpeech = game.tableSummary.recentSpeeches.at(-1);
  const voteMarker = countVoteSnapshotItems(game.tableSummary.voteSnapshot) + countVoteSnapshotItems(game.tableSummary.sheriffVoteSnapshot);
  const logMarker = events.reduce((latest, event) => Math.max(latest, event.seq), 0);

  return {
    latestSpeechSeq: latestSpeech?.seq ?? 0,
    latestSpeechSeatId: latestSpeech?.speaker?.seatId,
    latestSpeechLabel: latestSpeech?.speaker ? `${latestSpeech.speaker.seatId}号 ${latestSpeech.speaker.name}` : undefined,
    voteMarker,
    logMarker,
    recommendedTab: getMobileRecommendedInfoTab(game),
  };
}

export function getMobileRecommendedInfoTab(game: HumanGameView): MobileInfoTabKey {
  if (game.result || game.phase === "GAME_OVER") return "log";
  if (game.phase === "DAY_VOTE" || game.phase === "SHERIFF_VOTE" || game.phase === "SHERIFF_PK_VOTE") return "vote";
  if (game.phase === "DAY_SPEECH" || game.phase === "LAST_WORDS" || game.phase === "SHERIFF_SPEECH" || game.phase === "SHERIFF_PK_SPEECH") {
    return "speech";
  }
  return "identity";
}

export function getMobilePhaseSignalTone(phase: HumanGameView["phase"]): MobilePhaseSignalTone {
  if (phase === "GAME_OVER") return "end";
  if (phase === "DAY_VOTE" || phase === "SHERIFF_VOTE" || phase === "SHERIFF_PK_VOTE" || phase === "EXILE_RESOLUTION") return "vote";
  if (phase === "LAST_WORDS" || phase === "HUNTER_REVEAL" || phase === "HUNTER_SHOT" || phase === "WOLF_KING_SHOT") return "danger";
  if (phase.startsWith("NIGHT")) return "night";
  return "day";
}

function countVoteSnapshotItems(snapshot: HumanGameView["tableSummary"]["voteSnapshot"] | undefined): number {
  if (!snapshot) return 0;
  return (snapshot.votes?.length ?? 0) + (snapshot.tally?.length ?? 0) + (snapshot.leaders?.length ?? 0);
}

export function getMobileAudioButtonStates({
  hostAudioEnabled,
  aiSpeechAudioEnabled,
  aiSpeechAudioUnavailable,
}: {
  hostAudioEnabled: boolean;
  aiSpeechAudioEnabled: boolean;
  aiSpeechAudioUnavailable: boolean;
}): { hostActive: boolean; hostPressed: boolean; aiSpeechActive: boolean; aiSpeechPressed: boolean } {
  return {
    hostActive: hostAudioEnabled,
    hostPressed: hostAudioEnabled,
    aiSpeechActive: aiSpeechAudioEnabled && !aiSpeechAudioUnavailable,
    aiSpeechPressed: aiSpeechAudioEnabled,
  };
}

export type MobileSeatCardVisual = {
  image: string;
  kind: "customAvatar" | "modelCard" | "roleCard" | "hiddenCard";
  label: string;
};

export function getMobileSeatCardVisual(seat: HumanGameView["seats"][number]): MobileSeatCardVisual {
  const image = getSeatCardImage(seat);
  if (seat.avatarDataUrl) {
    return { image, kind: "customAvatar", label: `${seat.name} AI头像` };
  }

  const modelName = seat.personaName ?? seat.name;
  if (seat.isAi && MODEL_CARD_IMAGES[modelName]) {
    return { image, kind: "modelCard", label: `${modelName}模型牌` };
  }

  if (seat.role && seat.roleLabel) {
    return { image, kind: "roleCard", label: `${seat.roleLabel}身份牌` };
  }

  return { image: ROLE_CARD_IMAGES.HIDDEN, kind: "hiddenCard", label: "未揭晓身份牌" };
}

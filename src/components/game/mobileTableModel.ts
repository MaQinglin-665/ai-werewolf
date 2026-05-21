import type { AvailableHumanAction, HumanGameView } from "@/game/types";

export type MobileInfoTabKey = "identity" | "speech" | "vote" | "log";

export const MOBILE_INFO_TABS: Array<{ key: MobileInfoTabKey; label: string }> = [
  { key: "identity", label: "身份" },
  { key: "speech", label: "发言" },
  { key: "vote", label: "票型" },
  { key: "log", label: "记录" },
];

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

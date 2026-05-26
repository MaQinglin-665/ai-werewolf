import { resolveAiFriendsForGame } from "@/game/aiFriends";
import type { AiFriendConfig } from "@/game/types";
import type { AiLineupPreviewItem, HumanSeatMode } from "./clientTypes";

export function buildLandingLineupPreview({
  seatCount,
  humanSeatMode,
  selectedHumanSeatId,
  selectedAiFriends,
}: {
  seatCount: number;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
  selectedAiFriends: AiFriendConfig[];
}): AiLineupPreviewItem[] {
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
}

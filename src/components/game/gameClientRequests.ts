import type { AiFriendConfig, AiFriendRuntimeLlmConfig, AiRuntimeMode, HumanGameView } from "@/game/types";
import { speechStreamKey } from "./autoAdvance";
import type { CommandPayload, HumanSeatMode } from "./clientTypes";

type Fetcher = typeof fetch;

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export async function loadGameView(gameId: string, fetcher: Fetcher = fetch): Promise<HumanGameView> {
  const response = await fetcher(`/api/games/${gameId}`);
  if (!response.ok) throw new Error("对局不存在或已被清理。");
  return (await response.json()) as HumanGameView;
}

export async function createGameView(options: {
  boardId?: string;
  selectedBoardId: string | null;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
  selectedAiFriends: AiFriendConfig[];
  boardIdOverride?: string;
  humanSeatModeOverride?: HumanSeatMode;
  aiFriendsOverride?: AiFriendConfig[];
  fetcher?: Fetcher;
}): Promise<HumanGameView> {
  const response = await (options.fetcher ?? fetch)("/api/games", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      boardId: options.boardIdOverride ?? options.boardId ?? options.selectedBoardId ?? undefined,
      humanSeatId:
        (options.humanSeatModeOverride ?? options.humanSeatMode) === "none"
          ? null
          : options.selectedHumanSeatId ?? undefined,
      aiFriends: options.aiFriendsOverride ?? options.selectedAiFriends,
    }),
  });
  if (!response.ok) throw new Error("创建对局失败。");
  return (await response.json()) as HumanGameView;
}

export async function submitGameCommand(options: {
  gameId: string;
  payload: Exclude<CommandPayload, { type: "continue" }>;
  aiRuntimeMode: AiRuntimeMode;
  aiLlmConfigs: Record<string, AiFriendRuntimeLlmConfig> | undefined;
  fetcher?: Fetcher;
}): Promise<HumanGameView> {
  const response = await (options.fetcher ?? fetch)(`/api/games/${options.gameId}/commands`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...options.payload, aiRuntimeMode: options.aiRuntimeMode, aiLlmConfigs: options.aiLlmConfigs }),
  });
  const data = (await response.json().catch(() => ({}))) as HumanGameView | { error?: string };
  if (!response.ok) {
    throw new Error("error" in data && data.error ? data.error : "动作执行失败。");
  }
  return data as HumanGameView;
}

export function buildStreamingContinueContext(game: HumanGameView, aiSpeechAudioEnabled: boolean) {
  const previousSpeechKeys = new Set(game.tableSummary.recentSpeeches.map((speech) => speechStreamKey(game.id, speech)));
  const streamingSpeaker = game.currentSpeakerSeatId ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId) : undefined;
  const streamingSpeechKeyPrefix =
    aiSpeechAudioEnabled && streamingSpeaker && streamingSpeaker.seatId !== game.humanSeatId
      ? `${game.id}:${game.day}:live-tts:${streamingSpeaker.seatId}`
      : undefined;

  return { previousSpeechKeys, streamingSpeaker, streamingSpeechKeyPrefix };
}

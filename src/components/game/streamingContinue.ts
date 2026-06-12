import { stripSpeechStageDirections } from "@/game/speechText";
import type { AiFriendRuntimeLlmConfig, AiRuntimeMode, HumanGameView } from "@/game/types";
import type { Dispatch, SetStateAction } from "react";
import type { CommandPayload, LiveAiSpeech } from "./clientTypes";

export async function submitStreamingContinue(
  game: HumanGameView,
  payload: Extract<CommandPayload, { type: "continue" }>,
  runtimeAiLlmConfigs: Record<string, AiFriendRuntimeLlmConfig> | undefined,
  aiRuntimeMode: AiRuntimeMode,
  setLiveAiSpeech: Dispatch<SetStateAction<LiveAiSpeech | null>>,
  onSpeechTextSnapshot?: (text: string) => void,
): Promise<HumanGameView> {
  const speaker = game.currentSpeakerSeatId
    ? game.tableSummary.tableMemory.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;
  let finalView: HumanGameView | undefined;
  if (speaker) {
    setLiveAiSpeech({
      gameId: game.id,
      speaker,
      text: "",
    });
  }

  const requestBody = JSON.stringify({ ...payload, aiRuntimeMode, aiLlmConfigs: runtimeAiLlmConfigs });
  const response = await fetch(`/api/games/${game.id}/stream-command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });
  if (!response.ok || !response.body) {
    return submitFallbackContinue(game, requestBody);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handleEvent = (rawEvent: string) => {
    const event = rawEvent.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
    const dataText = rawEvent.match(/^data:\s*([\s\S]*)$/m)?.[1]?.trim();
    if (!dataText) return;
    const data = JSON.parse(dataText) as { text?: string; view?: HumanGameView; error?: string };
    if (event === "speech" && data.text && speaker) {
      const visibleText = stripSpeechStageDirections(data.text);
      setLiveAiSpeech({
        gameId: game.id,
        speaker,
        text: visibleText,
      });
      if (visibleText) {
        onSpeechTextSnapshot?.(visibleText);
      }
    }
    if (event === "done" && data.view) {
      finalView = data.view;
    }
    if (event === "error") {
      throw new Error(data.error ?? "流式推进失败。");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";
    for (const event of events) handleEvent(event);
  }
  if (buffer.trim()) handleEvent(buffer);
  if (!finalView) throw new Error("流式推进没有返回最终牌桌。");
  return finalView;
}

async function submitFallbackContinue(game: HumanGameView, requestBody: string): Promise<HumanGameView> {
  const response = await fetch(`/api/games/${game.id}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });
  const data = (await response.json().catch(() => ({}))) as HumanGameView | { error?: string };
  if (!response.ok) {
    throw new Error("error" in data && data.error ? data.error : "继续流程失败。");
  }
  return data as HumanGameView;
}

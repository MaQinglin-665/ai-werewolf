"use client";

import { stripSpeechStageDirections } from "@/game/speechText";
import type { HumanGameView } from "@/game/types";
import { getActionMeta } from "./ActionPanel";
import type { AiSpeechAudioStatus, CommandPayload, HostAudioStatus, LiveAiSpeech } from "./clientTypes";
import { seatNumber } from "./viewHelpers";

export function FlowStatusBar({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  onPauseAiSpeechAudio,
  onResumeAiSpeechAudio,
  onSkipAiSpeechAudio,
  onToggleAiSpeechAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  onPauseAiSpeechAudio: () => void;
  onResumeAiSpeechAudio: () => void;
  onSkipAiSpeechAudio: () => void;
  onToggleAiSpeechAudio: () => void;
}) {
  const status = getFlowStatus(
    game,
    loading,
    pendingCommandType,
    liveAiSpeech,
    hostAudioStatus,
    aiSpeechAudioStatus,
    aiSpeechAudioUnavailable,
  );
  const isPaused = aiSpeechAudioStatus?.state === "paused";
  const isLoadingSpeechAudio = aiSpeechAudioStatus?.state === "loading";
  const speechTextPreview = aiSpeechAudioStatus?.text ? stripSpeechStageDirections(aiSpeechAudioStatus.text).trim() : "";

  return (
    <section className={`${flowStatusToneClass(status.tone)} flow-status-bar rounded-[22px] border px-4 py-3 shadow-xl shadow-black/25 backdrop-blur-md`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flow-status-pulse h-2.5 w-2.5 rounded-full" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/48">System Status</span>
            {status.seatLabel && (
              <span className="rounded-full border border-white/12 bg-black/18 px-2 py-0.5 text-xs text-white/68">
                {status.seatLabel}
              </span>
            )}
          </div>
          <div className="text-base font-semibold text-white sm:text-lg">{status.title}</div>
          <div className="mt-1 text-sm leading-6 text-white/64">{status.detail}</div>
        </div>

        {aiSpeechAudioStatus && (
          <div className="grid shrink-0 gap-2 lg:min-w-[310px]">
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              <button
                type="button"
                disabled={isLoadingSpeechAudio}
                onClick={isPaused ? onResumeAiSpeechAudio : onPauseAiSpeechAudio}
                className="rounded-full border border-[#77d898]/28 bg-[#14311f]/58 px-3 py-2 text-xs font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isLoadingSpeechAudio ? "准备中" : isPaused ? "继续语音" : "暂停语音"}
              </button>
              <button
                type="button"
                onClick={onSkipAiSpeechAudio}
                className="rounded-full border border-[#f1c76e]/25 bg-black/18 px-3 py-2 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
              >
                跳过当前
              </button>
              <button
                type="button"
                onClick={onToggleAiSpeechAudio}
                className="rounded-full border border-white/12 bg-black/18 px-3 py-2 text-xs font-semibold text-white/68 transition hover:bg-white/8"
              >
                关闭语音
              </button>
            </div>
            {speechTextPreview && (
              <div className="line-clamp-2 rounded-2xl border border-white/10 bg-black/18 px-3 py-2 text-xs leading-5 text-white/58 lg:text-right">
                {seatNumber(aiSpeechAudioStatus.speaker)}：{speechTextPreview}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function getFlowStatus(
  game: HumanGameView,
  loading: boolean,
  pendingCommandType: CommandPayload["type"] | null,
  liveAiSpeech: LiveAiSpeech | null,
  hostAudioStatus: HostAudioStatus | null,
  aiSpeechAudioStatus: AiSpeechAudioStatus | null,
  aiSpeechAudioUnavailable: boolean,
): { title: string; detail: string; tone: "green" | "gold" | "blue" | "red"; seatLabel?: string } {
  if (liveAiSpeech) {
    return {
      title: "AI 正在生成发言",
      detail: aiSpeechAudioUnavailable
        ? "语音已自动降级为文字，流程会按发言长度留出阅读时间。"
        : liveAiSpeech.text
          ? "文字正在流式出现，语音会跟随生成并按顺序播放。"
          : "模型正在整理公开信息和自己的私有视角。",
      tone: "green",
      seatLabel: seatNumber(liveAiSpeech.speaker),
    };
  }

  if (aiSpeechAudioStatus) {
    const stateText =
      aiSpeechAudioStatus.state === "loading"
        ? "正在生成这一段 TTS"
        : aiSpeechAudioStatus.state === "paused"
          ? "AI 语音已暂停"
          : "正在播放 AI 发言";
    return {
      title: stateText,
      detail: aiSpeechAudioStatus.state === "paused" ? "继续后才会进入下一步。" : "这段说完后，系统再进入下一段强交互。",
      tone: "green",
      seatLabel: seatNumber(aiSpeechAudioStatus.speaker),
    };
  }

  if (hostAudioStatus) {
    return {
      title: "主持人正在播报",
      detail: "系统节点音频播放完成后，流程会继续推进。",
      tone: game.phase.startsWith("NIGHT") ? "blue" : game.phase === "DAY_VOTE" || game.phase === "EXILE_RESOLUTION" ? "red" : "gold",
    };
  }

  if (aiSpeechAudioUnavailable && game.phase === "DAY_SPEECH") {
    return {
      title: "AI 语音已转文字",
      detail: "TTS 暂不可用，本局不会反复请求语音；系统仍会等文字读完再推进。",
      tone: "gold",
    };
  }

  if (loading && pendingCommandType === "vote") {
    return {
      title: "你已锁票",
      detail: "正在等待其他玩家完成投票；开票前不会显示任何人的投票对象。",
      tone: "red",
    };
  }

  if (loading) {
    return {
      title: pendingCommandType === "continue" ? "正在推进流程" : "正在结算你的操作",
      detail: pendingCommandType === "continue" ? "系统正在处理下一位玩家或主持节点。" : "规则引擎正在写入结果并刷新牌桌。",
      tone: game.phase.startsWith("NIGHT") ? "blue" : "gold",
    };
  }

  const action = game.availableActions[0];
  if (action?.type === "continue") {
    return {
      title: "系统会自动播放下一步",
      detail: action.description,
      tone: game.phase.startsWith("NIGHT") ? "blue" : game.phase === "DAY_VOTE" || game.phase === "EXILE_RESOLUTION" ? "red" : "gold",
    };
  }

  if (action) {
    const meta = getActionMeta(action);
    return {
      title: meta.title,
      detail: meta.description,
      tone: action.type === "vote" ? "red" : game.phase.startsWith("NIGHT") ? "blue" : "gold",
    };
  }

  return {
    title: game.phase === "DAY_VOTE" ? "等待投票完成" : "等待流程推进",
    detail: game.phase === "DAY_VOTE" ? "票箱封存中，统一开票前只显示锁票状态。" : "当前没有需要你点击的操作。",
    tone: game.phase === "DAY_VOTE" ? "red" : "gold",
  };
}

function flowStatusToneClass(tone: "green" | "gold" | "blue" | "red"): string {
  const tones = {
    green: "border-[#77d898]/24 bg-[#0f2118]/80",
    gold: "border-[#f1c76e]/24 bg-[#1c150e]/80",
    blue: "border-[#7da8e3]/24 bg-[#0d1623]/82",
    red: "border-[#e46d55]/26 bg-[#2b1110]/82",
  };
  return tones[tone];
}

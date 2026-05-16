"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type {
  ActionTargetView,
  BrowserSpeechRecognition,
  CommandPayload,
  HumanSpeechActionType,
  KnightDuelAction,
  SeerCheckAction,
  SheriffVoteAction,
  VoteAction,
  VoiceInputState,
  WolfBeautyCharmAction,
  WitchAction,
} from "./clientTypes";
import {
  HUMAN_SPEECH_MAX_LENGTH,
  formatSpeechRecognitionError,
  getSpeechRecognitionConstructor,
} from "./viewHelpers";

export function ActionPanel({
  game,
  loading,
  onSubmit,
  onNewGame,
  voiceInputEnabled = true,
}: {
  game: HumanGameView;
  loading: boolean;
  onNewGame: () => Promise<void>;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  voiceInputEnabled?: boolean;
}) {
  if (game.result) {
    return (
      <section className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
        <h2 className="text-lg font-semibold text-[#f7ead5]">终局</h2>
        <p className="mt-2 text-sm text-[#dcc9a7]">
          {game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：{game.result.reason}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="#review"
            className="rounded-full bg-[#2f8157] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#379566]"
          >
            查看复盘
          </a>
          <button
            onClick={onNewGame}
            disabled={loading}
            className="rounded-full border border-[#f1c76e]/30 px-5 py-2.5 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            新开一局
          </button>
        </div>
      </section>
    );
  }

  if (game.availableActions.length === 0) {
    return (
      <section className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 text-sm text-[#dcc9a7] shadow-2xl shadow-black/35 backdrop-blur-md">
        {loading ? "结算中" : "等待 AI 行动"}
      </section>
    );
  }

  const meta = getActionMeta(game.availableActions[0]);
  const isContinueOnly = game.availableActions.every((action) => action.type === "continue");

  if (isContinueOnly && game.availableActions[0]?.type === "continue") {
    const action = game.availableActions[0];
    return (
      <section className="rounded-[24px] border border-[#f1c76e]/24 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
        <div className="grid gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-full bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">{game.phaseLabel}</div>
            <h2 className="text-lg font-semibold text-[#f7ead5]">{meta.title}</h2>
            <p className="mt-1 text-sm text-[#dcc9a7]">{meta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#77d898]/25 bg-[#14311f]/55 px-3 py-2 text-xs text-[#a8f0b6]">
              <span className="h-2 w-2 rounded-full bg-[#77d898]" />
              自动播放中
            </span>
            <button
              disabled={loading}
              onClick={() => onSubmit({ type: "continue" })}
              className="rounded-full border border-[#f1c76e]/25 px-4 py-2 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
            >
              {loading ? "播放中" : `立即跳过：${action.label}`}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-[#f1c76e]/30 bg-[#130d0b]/92 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">{game.phaseLabel}</div>
          <h2 className="text-xl font-semibold text-[#f7ead5]">{meta.title}</h2>
          <p className="mt-1 text-sm text-[#dcc9a7]">
            {isContinueOnly ? `${meta.description} 系统会自动播放下一步。` : meta.description}
          </p>
        </div>
        <span className="rounded-full border border-[#f1c76e]/25 px-3 py-1 text-xs text-[#ad9c7d]">
          {isContinueOnly ? "观看流程" : "轮到你行动"}
        </span>
      </div>
      <div className="grid gap-3">
        {game.availableActions.map((action) => (
          <ActionControl
            key={action.type}
            game={game}
            action={action}
            loading={loading}
            onSubmit={onSubmit}
            voiceInputEnabled={voiceInputEnabled}
          />
        ))}
      </div>
    </section>
  );
}

function getActionTargetSeat(game: HumanGameView, target: ActionTargetView) {
  return game.seats.find((seat) => seat.seatId === target.seatId);
}

function ActionControl({
  game,
  action,
  loading,
  onSubmit,
  voiceInputEnabled,
}: {
  game: HumanGameView;
  action: AvailableHumanAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  voiceInputEnabled: boolean;
}) {
  const [message, setMessage] = useState("");
  const [voiceInputAvailable, setVoiceInputAvailable] = useState(false);
  const [voiceInputState, setVoiceInputState] = useState<VoiceInputState>("idle");
  const [voiceInputMessage, setVoiceInputMessage] = useState<string | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognizedTranscriptRef = useRef("");
  const recognitionErrorRef = useRef(false);
  const voiceInputMode: HumanSpeechActionType | undefined =
    action.type === "speak" || action.type === "lastWords" ? action.type : undefined;

  useEffect(() => {
    if (!voiceInputEnabled) return;
    const timer = window.setTimeout(() => {
      setVoiceInputAvailable(Boolean(getSpeechRecognitionConstructor()));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      const recognition = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      recognition?.abort();
    };
  }, [voiceInputEnabled]);

  const rewriteVoiceTranscript = useCallback(
    async (transcript: string) => {
      const cleanTranscript = transcript.replace(/\s+/g, " ").trim();
      if (!voiceInputMode || !cleanTranscript) {
        setVoiceInputState("idle");
        return;
      }

      setVoiceInputState("processing");
      setVoiceInputMessage("正在整理语义...");
      try {
        const response = await fetch(`/api/games/${game.id}/voice-input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: voiceInputMode, transcript: cleanTranscript }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (!response.ok || !data.message) {
          throw new Error(data.error ?? "语义整理失败。");
        }

        setMessage(data.message);
        setVoiceInputMessage("已整理为草稿。");
      } catch (error) {
        setMessage(cleanTranscript.slice(0, HUMAN_SPEECH_MAX_LENGTH));
        setVoiceInputMessage(
          `${error instanceof Error ? error.message : "语义整理失败。"} 已保留原始转写。`,
        );
      } finally {
        setVoiceInputState("idle");
      }
    },
    [game.id, voiceInputMode],
  );

  const startVoiceInput = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition || !voiceInputMode) {
      setVoiceInputMessage("当前浏览器不支持语音输入。");
      return;
    }

    const currentRecognition = speechRecognitionRef.current;
    if (currentRecognition) {
      currentRecognition.abort();
      speechRecognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    speechRecognitionRef.current = recognition;
    recognizedTranscriptRef.current = "";
    recognitionErrorRef.current = false;
    setVoiceInputMessage(null);
    setVoiceInputState("listening");

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      const startIndex = event.resultIndex ?? 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        recognizedTranscriptRef.current = `${recognizedTranscriptRef.current} ${finalTranscript}`.trim();
      }

      const preview = `${recognizedTranscriptRef.current} ${interimTranscript}`.trim();
      if (preview) {
        setMessage(preview.slice(0, HUMAN_SPEECH_MAX_LENGTH));
      }
    };

    recognition.onerror = (event) => {
      recognitionErrorRef.current = true;
      speechRecognitionRef.current = null;
      setVoiceInputState("idle");
      setVoiceInputMessage(formatSpeechRecognitionError(event));
    };

    recognition.onend = () => {
      if (speechRecognitionRef.current !== recognition) return;
      speechRecognitionRef.current = null;
      if (recognitionErrorRef.current) return;

      const transcript = recognizedTranscriptRef.current.trim();
      if (!transcript) {
        setVoiceInputState("idle");
        setVoiceInputMessage("没有识别到发言内容。");
        return;
      }

      void rewriteVoiceTranscript(transcript);
    };

    try {
      recognition.start();
    } catch (error) {
      speechRecognitionRef.current = null;
      setVoiceInputState("idle");
      setVoiceInputMessage(error instanceof Error ? error.message : "语音输入启动失败。");
    }
  }, [rewriteVoiceTranscript, voiceInputMode]);

  const stopVoiceInput = useCallback(() => {
    if (!speechRecognitionRef.current) return;
    setVoiceInputState("processing");
    setVoiceInputMessage("正在结束识别...");
    speechRecognitionRef.current.stop();
  }, []);

  if (action.type === "speak" || action.type === "lastWords" || action.type === "sheriffSpeech") {
    const isLastWords = action.type === "lastWords";
    const isSheriffSpeech = action.type === "sheriffSpeech";
    const voiceButtonText =
      voiceInputState === "listening"
        ? "停止录音"
        : voiceInputState === "processing"
          ? "处理中"
          : voiceInputAvailable
            ? "语音输入"
            : "语音不可用";
    return (
      <div className="grid gap-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={HUMAN_SPEECH_MAX_LENGTH}
          className="min-h-28 resize-none rounded-2xl border border-[#f1c76e]/25 bg-black/30 px-4 py-3 text-sm text-[#f7ead5] outline-none transition placeholder:text-[#8f8065] focus:border-[#f1d796]"
          placeholder={isLastWords ? "输入遗言" : isSheriffSpeech ? "输入警长竞选发言" : "输入本轮发言"}
        />
        {voiceInputEnabled && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || voiceInputState === "processing" || !voiceInputAvailable}
              aria-pressed={voiceInputState === "listening"}
              onClick={voiceInputState === "listening" ? stopVoiceInput : startVoiceInput}
              className={[
                "rounded-full border px-4 py-2 text-xs font-semibold transition disabled:opacity-60",
                voiceInputState === "listening"
                  ? "border-[#e46d55]/45 bg-[#572017]/60 text-[#ffb1a4] hover:bg-[#6f271b]/72"
                  : "border-[#f1c76e]/25 bg-black/18 text-[#f1d796] hover:bg-[#f1c76e]/10",
              ].join(" ")}
            >
              {voiceButtonText}
            </button>
            {voiceInputMessage && (
              <span aria-live="polite" className="text-xs leading-5 text-[#ad9c7d]">
                {voiceInputMessage}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          disabled={loading || voiceInputState !== "idle" || message.trim().length === 0}
          onClick={() =>
            onSubmit(isLastWords ? { type: "lastWords", message } : isSheriffSpeech ? { type: "sheriffSpeech", message } : { type: "speak", message })
          }
          className="rounded-full bg-[#2f8157] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#379566] disabled:opacity-60"
        >
          {isLastWords ? "确认遗言" : isSheriffSpeech ? "确认竞选发言" : "确认发言"}
        </button>
      </div>
    );
  }

  if (action.type === "continue") {
    return (
      <button
        disabled={loading}
        onClick={() => onSubmit({ type: "continue" })}
        className="rounded-full bg-[#b74332] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#cf513d] disabled:opacity-60"
      >
        {loading ? "播放中" : `立即播放：${action.label}`}
      </button>
    );
  }

  if (action.type === "seerCheck") {
    return <SeerCheckPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "witchAction") {
    return <WitchActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "wolfBeautyCharm") {
    return <WolfBeautyCharmPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "guardAction") {
    return <GuardActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "sheriffNominate") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={loading} tone="gold" onClick={() => onSubmit({ type: "sheriffNominate", run: true })}>
          上警
        </ActionButton>
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffNominate", run: false })}>
          留在警下
        </ActionButton>
      </div>
    );
  }

  if (action.type === "sheriffWithdraw") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={loading} tone="gold" onClick={() => onSubmit({ type: "sheriffWithdraw", withdraw: false })}>
          留在警上
        </ActionButton>
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffWithdraw", withdraw: true })}>
          退水
        </ActionButton>
      </div>
    );
  }

  if (action.type === "sheriffVote") {
    return <SheriffVoteActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "sheriffHandoff") {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {action.targets.map((target) => (
            <ActionButton
              key={target.seatId}
              disabled={loading}
              tone="gold"
              onClick={() => onSubmit({ type: "sheriffHandoff", targetSeatId: target.seatId })}
            >
              移交给 {target.seatId}号
            </ActionButton>
          ))}
          {action.canTear && (
            <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffHandoff" })}>
              撕警徽
            </ActionButton>
          )}
        </div>
      </div>
    );
  }

  if (action.type === "vote") {
    return <VoteActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "knightDuel") {
    return <KnightDuelActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} />;
  }

  if (action.type === "hunterShoot") {
    return (
      <div className="flex flex-wrap gap-2">
        {action.targets.map((target) => (
          <ActionButton
            key={target.seatId}
            disabled={loading}
            tone="red"
            onClick={() => onSubmit({ type: "hunterShoot", targetSeatId: target.seatId })}
          >
            带走 {target.seatId}号
          </ActionButton>
        ))}
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "hunterShoot" })}>
          不开枪
        </ActionButton>
      </div>
    );
  }

  if (action.type === "wolfKingShoot") {
    return (
      <div className="flex flex-wrap gap-2">
        {action.targets.map((target) => (
          <ActionButton
            key={target.seatId}
            disabled={loading}
            tone="red"
            onClick={() => onSubmit({ type: "wolfKingShoot", targetSeatId: target.seatId })}
          >
            带走 {target.seatId}号
          </ActionButton>
        ))}
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "wolfKingShoot" })}>
          不开枪
        </ActionButton>
      </div>
    );
  }

  if (action.type === "whiteWolfKingExplode") {
    return (
      <div className="rounded-2xl border border-[#b74332]/28 bg-[#2a1110]/45 p-3">
        <div className="mb-3 text-sm leading-6 text-[#ffcabd]">
          白狼王可以在自己的白天发言窗口自爆，并带走一名存活玩家；发动后今日直接结算并进入夜晚。
        </div>
        <div className="flex flex-wrap gap-2">
          {action.targets.map((target) => (
            <ActionButton
              key={target.seatId}
              disabled={loading}
              tone="red"
              onClick={() => onSubmit({ type: "whiteWolfKingExplode", targetSeatId: target.seatId })}
            >
              自爆带走 {target.seatId}号
            </ActionButton>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {action.targets.map((target) => (
        <ActionButton
          key={target.seatId}
          disabled={loading}
          tone="red"
          onClick={() => onSubmit({ type: action.type, targetSeatId: target.seatId } as CommandPayload)}
        >
          击杀 {target.seatId}号
        </ActionButton>
      ))}
    </div>
  );
}

function SeerCheckPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: SeerCheckAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  return (
    <div className="night-action-shell grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9dbbe6]">Private Check</div>
          <div className="mt-1 text-sm leading-6 text-[#d8e6f7]">选择一名玩家查验阵营，结果只进入你的私密信息。</div>
        </div>
        <span className="rounded-full border border-[#7da8e3]/25 bg-[#132942]/65 px-3 py-1 text-xs text-[#cfe4ff]">
          不公开
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="seer"
            actionLabel="查验"
            onClick={() => onSubmit({ type: "seerCheck", targetSeatId: target.seatId })}
          />
        ))}
      </div>
    </div>
  );
}

function WitchActionPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: WitchAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  const medicineHint = action.saveTarget
    ? "确认当前刀口，再决定是否交药。"
    : "当前没有可见刀口；解药已用或本夜没有可救目标。";
  const antidoteLabel = action.canSave ? "解药可用" : action.saveTarget ? "不能救此刀口" : "解药不可用";

  return (
    <div className="night-action-shell grid gap-4">
      <div className="grid gap-2 rounded-2xl border border-[#7da8e3]/20 bg-[#0d1623]/62 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9dbbe6]">Medicine Case</div>
            <div className="mt-1 text-sm text-[#d8e6f7]">{medicineHint}</div>
          </div>
          <div className="flex shrink-0 gap-1 text-[11px]">
            <span className={action.canSave ? "rounded-full bg-[#2f8157]/45 px-2 py-1 text-[#a8f0b6]" : "rounded-full bg-white/8 px-2 py-1 text-white/45"}>
              {antidoteLabel}
            </span>
            <span className={action.canPoison ? "rounded-full bg-[#b74332]/45 px-2 py-1 text-[#ffb1a4]" : "rounded-full bg-white/8 px-2 py-1 text-white/45"}>
              毒药{action.canPoison ? "可用" : "已用"}
            </span>
          </div>
        </div>

        {action.canSave && action.saveTarget ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "witchAction", mode: "save" })}
            className="witch-medicine-card rounded-2xl border border-[#77d898]/32 bg-[#14311f]/72 p-3 text-left transition hover:border-[#a8f0b6]/55 hover:bg-[#1d4e33]/82 disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#dff4df]">使用解药</span>
              <span className="rounded-full bg-[#77d898]/14 px-2 py-1 text-xs text-[#a8f0b6]">
                救 {action.saveTarget.seatId}号
              </span>
            </div>
            <div className="mt-1 text-xs leading-5 text-[#a8f0b6]/78">
              今夜刀口：{action.saveTarget.seatId}号 · {action.saveTarget.name}
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/18 p-3 text-sm leading-5 text-white/45">
            <div>{action.saveBlockedReason ?? "今晚没有可救目标，或解药已经用完；解药用完后不再显示后续刀口。"}</div>
            {action.saveTarget ? (
              <div className="mt-1 text-xs text-white/38">
                今夜刀口：{action.saveTarget.seatId}号 · {action.saveTarget.name}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs text-[#d8e6f7]/64">
          <span>毒药目标</span>
          <span>{action.canPoison ? "选择后立即结算本夜用药" : "毒药不可用"}</span>
        </div>
        {action.canPoison ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {action.poisonTargets.map((target, index) => (
              <NightTargetButton
                key={target.seatId}
                game={game}
                target={target}
                disabled={loading}
                index={index}
                tone="poison"
                actionLabel="毒"
                onClick={() => onSubmit({ type: "witchAction", mode: "poison", targetSeatId: target.seatId })}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 px-3 py-4 text-center text-sm text-white/45">
            毒药已用，本夜只能跳过。
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => onSubmit({ type: "witchAction", mode: "skip" })}
        className="rounded-2xl border border-[#f1c76e]/25 bg-black/18 px-4 py-3 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
      >
        本夜不用药
      </button>
    </div>
  );
}

function WolfBeautyCharmPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: WolfBeautyCharmAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  return (
    <div className="night-action-shell grid gap-3">
      <div className="rounded-2xl border border-[#d885c7]/24 bg-[#2b1128]/58 p-3 text-sm leading-6 text-[#ffd6f7]">
        选择今晚魅惑的玩家。狼美人白天出局时，当前魅惑目标会殉情出局；夜间死亡不触发。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="charm"
            actionLabel="魅惑"
            onClick={() => onSubmit({ type: "wolfBeautyCharm", targetSeatId: target.seatId })}
          />
        ))}
        {action.canSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "wolfBeautyCharm" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">不魅惑</span>
              <span className="text-[11px] opacity-64">跳过</span>
            </div>
            <div className="mt-3 text-sm font-semibold">本夜不选择目标</div>
            <div className="mt-1 text-[11px] opacity-72">保留白天发言空间</div>
          </button>
        )}
      </div>
    </div>
  );
}

function VoteActionPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: VoteAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  return (
    <div className="vote-action-panel grid gap-3">
      <div className="rounded-2xl border border-[#e46d55]/24 bg-[#351210]/48 px-3 py-2 text-sm leading-6 text-[#ffd8cf]">
        选择你的放逐票。锁票后，所有玩家票型会在开票阶段一次性公布。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="vote"
            actionLabel="投票"
            onClick={() => onSubmit({ type: "vote", targetSeatId: target.seatId })}
          />
        ))}
        {action.canAbstain && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "vote" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">弃票</span>
              <span className="text-[11px] opacity-64">放弃放逐票</span>
            </div>
            <div className="mt-3 text-sm font-semibold">本轮不投任何人</div>
            <div className="mt-1 text-[11px] opacity-72">仍会锁定你的投票状态</div>
          </button>
        )}
      </div>
    </div>
  );
}

function KnightDuelActionPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: KnightDuelAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  return (
    <div className="vote-action-panel grid gap-3">
      <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-2 text-sm leading-6 text-[#f1d796]">
        骑士可以发动一次决斗。目标是狼人阵营则目标出局并结束白天；目标是好人阵营则骑士出局，随后继续投票。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="knight"
            actionLabel="决斗"
            onClick={() => onSubmit({ type: "knightDuel", targetSeatId: target.seatId })}
          />
        ))}
        {action.canSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "knightDuel" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">保留</span>
              <span className="text-[11px] opacity-64">不决斗</span>
            </div>
            <div className="mt-3 text-sm font-semibold">进入正常投票</div>
            <div className="mt-1 text-[11px] opacity-72">技能仍可留到后续白天</div>
          </button>
        )}
      </div>
    </div>
  );
}

function GuardActionPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: Extract<AvailableHumanAction, { type: "guardAction" }>;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  return (
    <div className="night-action-shell grid gap-3">
      <div className="rounded-2xl border border-[#7da8e3]/20 bg-[#0d1623]/62 p-3 text-sm leading-6 text-[#d8e6f7]">
        选择今晚守护的玩家。守卫可以守自己，也可以空守，但不能连续两晚守护同一名玩家。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="guard"
            actionLabel="守护"
            onClick={() => onSubmit({ type: "guardAction", targetSeatId: target.seatId })}
          />
        ))}
        {action.canSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "guardAction" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">空守</span>
              <span className="text-[11px] opacity-64">跳过</span>
            </div>
            <div className="mt-3 text-sm font-semibold">今晚不守护</div>
            <div className="mt-1 text-[11px] opacity-72">
              {action.lastGuardedSeatId ? `上次守护 ${action.lastGuardedSeatId}号` : "保留守护节奏"}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

function SheriffVoteActionPanel({
  game,
  action,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  action: SheriffVoteAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  return (
    <div className="vote-action-panel grid gap-3">
      <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-2 text-sm leading-6 text-[#f1d796]">
        {action.isPk ? "警长 PK 复投，只能在 PK 候选人中选择。" : "警下投票选择本局警长，候选人不能投票。"}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="sheriff"
            actionLabel="警长票"
            onClick={() => onSubmit({ type: "sheriffVote", targetSeatId: target.seatId })}
          />
        ))}
        {action.canAbstain && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "sheriffVote" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">弃票</span>
              <span className="text-[11px] opacity-64">警长票</span>
            </div>
            <div className="mt-3 text-sm font-semibold">不投任何候选人</div>
            <div className="mt-1 text-[11px] opacity-72">仍会锁定你的警长投票状态</div>
          </button>
        )}
      </div>
    </div>
  );
}

function NightTargetButton({
  game,
  target,
  disabled,
  index,
  tone,
  actionLabel,
  onClick,
}: {
  game: HumanGameView;
  target: ActionTargetView;
  disabled: boolean;
  index: number;
  tone: "seer" | "poison" | "vote" | "guard" | "sheriff" | "charm" | "knight";
  actionLabel: string;
  onClick: () => void;
}) {
  const seat = getActionTargetSeat(game, target);
  const toneClass = {
    seer: "border-[#7da8e3]/24 bg-[#10243a]/64 text-[#d8e6f7] hover:border-[#9dbbe6]/58 hover:bg-[#153253]/76",
    poison: "border-[#e46d55]/24 bg-[#2b1110]/66 text-[#ffd8cf] hover:border-[#ff9a6b]/58 hover:bg-[#3a1713]/82",
    vote: "border-[#e46d55]/24 bg-[#2b1110]/62 text-[#ffd8cf] hover:border-[#ff9a6b]/58 hover:bg-[#3a1713]/78",
    guard: "border-[#77d898]/24 bg-[#14311f]/62 text-[#dff4df] hover:border-[#a8f0b6]/58 hover:bg-[#1d4e33]/78",
    sheriff: "border-[#f1c76e]/24 bg-[#3a2412]/62 text-[#f1d796] hover:border-[#f1d796]/58 hover:bg-[#4a2d12]/78",
    charm: "border-[#d885c7]/24 bg-[#2b1128]/66 text-[#ffd6f7] hover:border-[#f5a9e8]/58 hover:bg-[#3d1838]/82",
    knight: "border-[#f1c76e]/30 bg-[#2b2110]/66 text-[#fff0bf] hover:border-[#fff0bf]/62 hover:bg-[#3b2d13]/82",
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ animationDelay: `${index * 42}ms` }}
      className={`${toneClass} night-target-card min-h-[92px] rounded-2xl border p-3 text-left shadow-lg shadow-black/18 transition disabled:opacity-60`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">{target.seatId}号</span>
        <span className="text-[11px] opacity-64">{actionLabel}</span>
      </div>
      <div className="mt-3 truncate text-sm font-semibold">{target.name}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px] opacity-72">
        <span>{seat?.alive ? "存活" : "出局"}</span>
        {seat?.isHuman && <span>你</span>}
        {seat?.roleLabel && <span>{seat.roleLabel}</span>}
      </div>
    </button>
  );
}

function ActionButton({
  children,
  disabled,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  tone: "green" | "red" | "gold" | "neutral";
  onClick: () => void;
}) {
  const className =
    tone === "red"
      ? "bg-[#b74332] text-white hover:bg-[#cf513d]"
      : tone === "green"
        ? "bg-[#2f8157] text-white hover:bg-[#379566]"
        : tone === "gold"
          ? "bg-[#9f6b24] text-white hover:bg-[#b77c2a]"
        : "border border-[#f1c76e]/30 text-[#f1d796] hover:bg-[#f1c76e]/10";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`${className} min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

export function getActionMeta(action: AvailableHumanAction) {
  switch (action.type) {
    case "wolfKill":
      return { title: "狼人夜刀", description: "选择一名存活玩家作为今晚刀口。" };
    case "guardAction":
      return { title: "守卫守护", description: "选择今晚守护目标，或空守。" };
    case "seerCheck":
      return { title: "预言家查验", description: "选择一名存活玩家，系统会私下告诉你阵营结果。" };
    case "witchAction":
      return { title: "女巫用药", description: "选择救人、毒人，或保留药品跳过本夜。" };
    case "wolfBeautyCharm":
      return { title: "狼美人魅惑", description: "选择今晚魅惑目标，或跳过本夜魅惑。" };
    case "speak":
      return { title: "轮到你发言", description: "公开发言会进入所有 AI 的公开信息流。" };
    case "sheriffSpeech":
      return { title: "警长竞选发言", description: "用公开视角争取警徽。" };
    case "sheriffNominate":
      return { title: "是否上警", description: "选择参与警长竞选，或留在警下投票。" };
    case "sheriffWithdraw":
      return { title: "是否退水", description: "选择留在警上，或退出警长竞选。" };
    case "sheriffVote":
      return { title: "警长投票", description: "在候选人中投出警长票。" };
    case "sheriffHandoff":
      return { title: "警徽移交", description: "选择移交警徽，或撕掉警徽。" };
    case "lastWords":
      return { title: "发表遗言", description: "出局前留下最后公开视角，遗言结束后继续结算。" };
    case "vote":
      return { title: "投票放逐", description: "选择一名存活玩家投票，所有人投完后进入结算。" };
    case "knightDuel":
      return { title: "骑士决斗", description: "选择是否发动决斗；证据不足时可以保留技能进入投票。" };
    case "hunterShoot":
      return { title: "猎人开枪", description: "你可以带走一名存活玩家，也可以选择不开枪。" };
    case "wolfKingShoot":
      return { title: "狼王开枪", description: "你可以发动狼王枪带走一名存活玩家，也可以选择不开枪。" };
    case "whiteWolfKingExplode":
      return { title: "白狼王自爆", description: "你可以立即自爆并带走一名存活玩家，或继续正常发言。" };
    case "continue":
      return { title: action.label, description: action.description };
  }
}

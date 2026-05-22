"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type {
  BrowserSpeechRecognition,
  CommandPayload,
  HumanSpeechActionType,
  VoiceInputState,
} from "./clientTypes";
import {
  HUMAN_SPEECH_MAX_LENGTH,
  formatSpeechRecognitionError,
  getSpeechRecognitionConstructor,
} from "./viewHelpers";

type SpeechAction = Extract<AvailableHumanAction, { type: "speak" | "lastWords" | "sheriffSpeech" }>;

export function SpeechActionControl({
  game,
  action,
  loading,
  onSubmit,
  voiceInputEnabled,
  mobileCompact,
  onOpenSpeechPanel,
}: {
  game: HumanGameView;
  action: SpeechAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  voiceInputEnabled: boolean;
  mobileCompact: boolean;
  onOpenSpeechPanel?: () => void;
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
    if (mobileCompact && onOpenSpeechPanel) {
      return (
        <button
          type="button"
          disabled={loading}
          onClick={onOpenSpeechPanel}
          className="rounded-full bg-[#2f8157] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#379566] disabled:opacity-60"
        >
          {isLastWords ? "打开遗言" : isSheriffSpeech ? "打开竞选发言" : "打开发言"}
        </button>
      );
    }

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

  return null;
}

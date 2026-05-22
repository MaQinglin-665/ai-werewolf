"use client";

import { useEffect, useRef } from "react";
import type { HumanGameView } from "@/game/types";
import type { LiveAiSpeech, SpeechItem } from "./clientTypes";
import { seatNumber } from "./viewHelpers";

export function SpeechFeed({
  game,
  liveAiSpeech,
  variant = "sidebar",
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  variant?: "sidebar" | "table";
}) {
  const speeches = game.tableSummary.recentSpeeches;
  const activeLiveAiSpeech =
    liveAiSpeech &&
    !speeches.some(
      (speech) =>
        speech.speaker?.seatId === liveAiSpeech.speaker.seatId &&
        liveAiSpeech.text &&
        speech.message.startsWith(liveAiSpeech.text),
    )
      ? liveAiSpeech
      : null;
  const currentSpeaker = game.currentSpeakerSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;
  const isTableVariant = variant === "table";
  const hasVisibleSpeechContent = speeches.length > 0 || Boolean(activeLiveAiSpeech);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [activeLiveAiSpeech?.text, speeches.length]);

  return (
    <section
      className={[
        "overflow-hidden rounded-[24px] border border-[#77d898]/25 bg-[#0f2118]/82 shadow-2xl shadow-black/35 backdrop-blur-md",
        isTableVariant ? "table-speech-feed" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-[#77d898]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#dff4df]">发言席</h2>
        <span className="text-xs text-[#9ecfac]">
          {currentSpeaker ? `当前：${seatNumber(currentSpeaker)}` : game.phase === "DAY_SPEECH" ? "等待发言" : "非发言阶段"}
        </span>
      </div>
      <div
        ref={scrollRef}
        className={[
          "grid gap-3 overflow-y-auto p-4",
          isTableVariant
            ? hasVisibleSpeechContent
              ? "max-h-[56vh] overscroll-contain [scrollbar-gutter:stable] lg:max-h-[58vh] xl:max-h-[60vh]"
              : "max-h-[220px] lg:max-h-[200px]"
            : "max-h-[300px]",
        ].join(" ")}
      >
        {speeches.length === 0 && !activeLiveAiSpeech ? (
          <div className="rounded-2xl border border-dashed border-[#77d898]/20 px-3 py-6 text-center text-sm text-[#9ecfac]">
            暂无公开发言
          </div>
        ) : (
          <>
            {speeches.map((speech, index) => {
              const isHuman = speech.speaker?.seatId === game.humanSeatId;
              const startsNewDay = speeches[index - 1]?.day !== speech.day;
              return (
                <SpeechFeedItem
                  key={`speech-day-block-${speech.seq}`}
                  day={speech.day}
                  isHuman={isHuman}
                  isStreaming={false}
                  message={speech.message}
                  speaker={speech.speaker}
                  startsNewDay={startsNewDay && index > 0}
                />
              );
            })}
            {activeLiveAiSpeech && <LiveSpeechFeedItem liveAiSpeech={activeLiveAiSpeech} />}
          </>
        )}
      </div>
    </section>
  );
}

function SpeechFeedItem({
  day,
  isHuman,
  isStreaming,
  message,
  speaker,
  startsNewDay,
}: {
  day: number;
  isHuman: boolean;
  isStreaming: boolean;
  message: string;
  speaker: SpeechItem["speaker"];
  startsNewDay: boolean;
}) {
  return (
    <div className={["grid gap-2", startsNewDay ? "pt-3" : ""].filter(Boolean).join(" ")}>
      {startsNewDay && (
        <div className="flex items-center gap-3" aria-label={`第${day}天发言`}>
          <div className="h-px flex-1 bg-[#77d898]/16" />
          <span className="rounded-full border border-[#77d898]/22 bg-[#14311f]/72 px-3 py-1 text-[11px] font-semibold text-[#a8f0b6] shadow-sm shadow-black/20">
            第 {day} 天发言
          </span>
          <div className="h-px flex-1 bg-[#77d898]/16" />
        </div>
      )}
      <div
        className={[
          "rounded-2xl border px-3 py-2 text-sm leading-6",
          startsNewDay ? "border-t-[#77d898]/45" : "",
          isHuman ? "border-[#f1c76e]/30 bg-[#2b2110]/75 text-[#f7ead5]" : "border-[#77d898]/18 bg-black/22 text-[#dff4df]",
        ].join(" ")}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
          <span className="min-w-0">{speaker ? `${speaker.seatId}号 · ${speaker.name}` : "未知发言人"}</span>
          <span>D{day}</span>
        </div>
        <span>{message}</span>
        {isStreaming && <span className="speech-stream-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

function LiveSpeechFeedItem({ liveAiSpeech }: { liveAiSpeech: LiveAiSpeech }) {
  return (
    <div className="rounded-2xl border border-[#77d898]/35 bg-[#0a2a1a]/72 px-3 py-2 text-sm leading-6 text-[#dff4df] shadow-lg shadow-black/20">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
        <span className="min-w-0">
          {liveAiSpeech.speaker.seatId}号 · {liveAiSpeech.speaker.name}
        </span>
        <span>生成中</span>
      </div>
      <span>{liveAiSpeech.text || "正在组织发言..."}</span>
      <span className="speech-stream-cursor" aria-hidden="true" />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { HumanGameView } from "@/game/types";
import type { LiveAiSpeech, SpeechItem } from "./clientTypes";

export function MobileSpeechStream({ game, liveAiSpeech }: { game: HumanGameView; liveAiSpeech: LiveAiSpeech | null }) {
  const speeches = game.tableSummary.recentSpeeches;
  const speechListRef = useRef<HTMLDivElement | null>(null);
  const userSpeechScrollIntentRef = useRef(false);
  const [isPinnedToLatest, setIsPinnedToLatest] = useState(true);
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
  const latestSpeechKey = activeLiveAiSpeech
    ? `live-${activeLiveAiSpeech.speaker.seatId}-${activeLiveAiSpeech.text}`
    : `speech-${speeches[speeches.length - 1]?.seq ?? 0}`;

  useEffect(() => {
    if (!isPinnedToLatest) return;
    const speechList = speechListRef.current;
    if (!speechList) return;
    const scrollToLatest = () => {
      userSpeechScrollIntentRef.current = false;
      speechList.scrollTop = speechList.scrollHeight;
    };
    scrollToLatest();
    const frameId = window.requestAnimationFrame(scrollToLatest);
    const timer = window.setTimeout(scrollToLatest, 80);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timer);
    };
  }, [isPinnedToLatest, latestSpeechKey]);

  const markUserSpeechScrollIntent = () => {
    userSpeechScrollIntentRef.current = true;
  };

  const updateSpeechPinnedState = (speechList: HTMLDivElement) => {
    const distanceToBottom = speechList.scrollHeight - speechList.scrollTop - speechList.clientHeight;
    const nextPinnedState = distanceToBottom < 36;
    if (nextPinnedState) {
      userSpeechScrollIntentRef.current = false;
    }
    setIsPinnedToLatest((current) => (current === nextPinnedState ? current : nextPinnedState));
  };

  const handleSpeechScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!userSpeechScrollIntentRef.current && document.activeElement !== event.currentTarget) return;
    updateSpeechPinnedState(event.currentTarget);
  };

  const handleSpeechKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const speechList = event.currentTarget;
    const largeStep = Math.max(speechList.clientHeight * 0.82, 120);
    const smallStep = 44;
    const keyScrollBy: Record<string, number> = {
      ArrowUp: -smallStep,
      ArrowDown: smallStep,
      PageUp: -largeStep,
      PageDown: largeStep,
      " ": largeStep,
    };

    if (event.key === "Home") {
      event.preventDefault();
      markUserSpeechScrollIntent();
      speechList.scrollTop = 0;
      updateSpeechPinnedState(speechList);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      markUserSpeechScrollIntent();
      speechList.scrollTop = speechList.scrollHeight;
      updateSpeechPinnedState(speechList);
      return;
    }

    const scrollBy = keyScrollBy[event.key];
    if (scrollBy === undefined) return;
    event.preventDefault();
    markUserSpeechScrollIntent();
    speechList.scrollTop += scrollBy;
    updateSpeechPinnedState(speechList);
  };

  const jumpToLatestSpeech = () => {
    const speechList = speechListRef.current;
    if (speechList) {
      speechList.scrollTop = speechList.scrollHeight;
    }
    userSpeechScrollIntentRef.current = false;
    setIsPinnedToLatest(true);
  };

  return (
    <div className="mobile-speech-stream" aria-label="发言席">
      {speeches.length === 0 && !activeLiveAiSpeech ? (
        <div className="mobile-empty-speech">暂无公开发言</div>
      ) : (
        <>
          <div
            ref={speechListRef}
            className="mobile-speech-list"
            data-auto-stick={isPinnedToLatest ? "bottom" : "paused"}
            tabIndex={0}
            aria-label="公开发言列表"
            onWheel={markUserSpeechScrollIntent}
            onTouchStart={markUserSpeechScrollIntent}
            onKeyDown={handleSpeechKeyDown}
            onScroll={handleSpeechScroll}
          >
            {speeches.map((speech, index) => (
              <MobileSpeechBubble
                key={`speech-${speech.seq}`}
                speech={speech}
                isHuman={speech.speaker?.seatId === game.humanSeatId}
                tone={index === speeches.length - 1 && !activeLiveAiSpeech ? "latest" : "history"}
              />
            ))}
            {activeLiveAiSpeech && <MobileLiveSpeechBubble liveAiSpeech={activeLiveAiSpeech} />}
            <div className="mobile-speech-latest-anchor" aria-hidden="true" />
          </div>
          <button type="button" className="mobile-speech-jump-latest" hidden={isPinnedToLatest} onClick={jumpToLatestSpeech}>
            回到最新
          </button>
        </>
      )}
    </div>
  );
}

function MobileSpeechBubble({ speech, isHuman, tone }: { speech: SpeechItem; isHuman: boolean; tone: "latest" | "history" }) {
  return (
    <div className={["mobile-speech-bubble", `mobile-speech-bubble-${tone}`, isHuman ? "mobile-speech-bubble-self" : ""].join(" ")}>
      <div className="mobile-speech-speaker">
        {speech.speaker && <span className="mobile-speech-seat">{speech.speaker.seatId}</span>}
        <span>{speech.speaker ? speech.speaker.name : "未知发言人"}</span>
      </div>
      <div className="mobile-speech-text">{speech.message}</div>
    </div>
  );
}

function MobileLiveSpeechBubble({ liveAiSpeech }: { liveAiSpeech: LiveAiSpeech }) {
  return (
    <div className="mobile-speech-bubble mobile-speech-bubble-primary mobile-speech-bubble-live">
      <div className="mobile-speech-speaker">
        <span className="mobile-speech-seat">{liveAiSpeech.speaker.seatId}</span>
        <span>{liveAiSpeech.speaker.name} · 生成中</span>
      </div>
      <div className="mobile-speech-text">{liveAiSpeech.text || "正在组织发言..."}</div>
    </div>
  );
}

export function MobileSpeechInputBar({
  prompt,
  onOpen,
}: {
  prompt: { label: string; ariaLabel: string };
  onOpen: () => void;
}) {
  return (
    <button type="button" className="mobile-speech-input-bar" aria-label={prompt.ariaLabel} onClick={onOpen}>
      <span className="mobile-speech-input-dot" aria-hidden="true" />
      <span className="mobile-speech-input-placeholder">{prompt.label}</span>
      <span className="mobile-speech-input-menu" aria-hidden="true">•••</span>
    </button>
  );
}

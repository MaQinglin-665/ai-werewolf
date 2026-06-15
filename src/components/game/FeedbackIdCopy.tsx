"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "manual";

export function FeedbackIdCopy({
  className = "",
  compact = false,
  gameId,
}: {
  className?: string;
  compact?: boolean;
  gameId: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const shortId = gameId.slice(0, 8);

  async function copyFeedbackId() {
    try {
      await window.navigator.clipboard.writeText(gameId);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }

  return (
    <div
      className={[
        "border-y border-[#7da8e3]/18 py-3 text-xs text-[#cfe4ff]",
        compact ? "mobile-feedback-id-copy" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[#e4efff]">反馈编号</div>
          <code className="mt-1 block break-all text-[11px] text-[#b8d6ff]" title={gameId}>
            {compact ? shortId : gameId}
          </code>
        </div>
        <button
          type="button"
          onClick={() => void copyFeedbackId()}
          className="rounded-full border border-[#7da8e3]/30 bg-black/18 px-3 py-1.5 text-xs font-semibold text-[#cfe4ff] transition hover:bg-[#7da8e3]/10"
        >
          复制
        </button>
      </div>
      <p className="mt-2 leading-5 text-[#9fbfe8]">反馈 AI 发言或流程问题时附上这个编号。</p>
      {copyState !== "idle" && (
        <p className={["mt-2 rounded-xl border px-2 py-1.5", copyState === "copied" ? "border-[#77d898]/24 bg-[#14311f]/55 text-[#a8f0b6]" : "border-[#f1c76e]/25 bg-[#3a2412]/50 text-[#f1d796]"].join(" ")}>
          {copyState === "copied" ? "编号已复制。" : "复制被浏览器拦截，请手动选中编号。"}
        </p>
      )}
    </div>
  );
}

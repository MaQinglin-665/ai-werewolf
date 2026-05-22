"use client";

import Link from "next/link";
import type { HumanGameView } from "@/game/types";
import { StatusPill } from "./PanelPrimitives";

export function RoomHeader({
  game,
  loading,
  aiSpeechAudioEnabled,
  aiSpeechAudioUnavailable,
  hostAudioEnabled,
  onNewGame,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView | null;
  loading: boolean;
  aiSpeechAudioEnabled: boolean;
  aiSpeechAudioUnavailable: boolean;
  hostAudioEnabled: boolean;
  onNewGame: () => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  const gameMeta = game
    ? game.humanSeatId === null
      ? `${game.board.name} · 观战模式 · AI ${game.setup?.aiFriends.length ?? game.seats.filter((seat) => seat.isAi).length}位`
      : `${game.board.name} · ${game.humanSeatId}号位 · 你是${game.myRoleLabel ?? "未知身份"} · AI ${game.setup?.aiFriends.length ?? game.seats.filter((seat) => seat.isAi).length}位`
    : "选择板子后可指定真人座位或观战 AI 对局";

  return (
    <header className="mobile-home-header flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f1c76e]/25 bg-[#130d0b]/75 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="mobile-home-logo grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#f1c76e]/45 bg-[#2a1712] text-lg font-semibold text-[#f1c76e] shadow-inner">
          狼
        </div>
        <div className="mobile-home-brand min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">单人 AI 狼人杀</h1>
          <p className="mt-1 text-xs text-[#cab995] sm:text-sm">
            {gameMeta}
          </p>
        </div>
      </div>

      <div className="mobile-home-header-actions flex flex-wrap items-center gap-2">
        {game && (
          <>
            <StatusPill tone="gold">第 {game.day} 天</StatusPill>
            <StatusPill tone={game.phase.startsWith("NIGHT") ? "blue" : "green"}>{game.phaseLabel}</StatusPill>
          </>
        )}
        <Link
          href="/rooms"
          className="mobile-home-quick-action rounded-full border border-[#77d898]/35 bg-[#12301f]/70 px-4 py-2 text-sm font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75"
        >
          <MobileHomeToolContent icon="房" label="联机" />
        </Link>
        <button
          type="button"
          onClick={onOpenIdentityBook}
          className="mobile-home-quick-action rounded-full border border-[#f1c76e]/25 bg-black/15 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
        >
          <MobileHomeToolContent icon="书" label="身份" />
        </button>
        <button
          type="button"
          onClick={onOpenGlossary}
          className="mobile-home-quick-action rounded-full border border-[#7da8e3]/25 bg-black/15 px-4 py-2 text-sm font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/10"
        >
          <MobileHomeToolContent icon="?" label="术语" />
        </button>
        <button
          type="button"
          onClick={onToggleHostAudio}
          aria-pressed={hostAudioEnabled}
          className={[
            "mobile-home-quick-action mobile-home-audio-toggle rounded-full border px-4 py-2 text-sm font-semibold transition",
            hostAudioEnabled
              ? "border-[#77d898]/35 bg-[#14311f]/70 text-[#a8f0b6] hover:bg-[#1d4e33]/75"
              : "border-[#f1c76e]/25 bg-black/15 text-[#f1d796] hover:bg-[#f1c76e]/10",
          ].join(" ")}
        >
          <MobileHomeToolContent icon="音" label={hostAudioEnabled ? "主持开" : "主持关"} />
        </button>
        <button
          type="button"
          onClick={onToggleAiSpeechAudio}
          aria-pressed={aiSpeechAudioEnabled}
          className={[
            "mobile-home-quick-action mobile-home-audio-toggle rounded-full border px-4 py-2 text-sm font-semibold transition",
            aiSpeechAudioEnabled && !aiSpeechAudioUnavailable
              ? "border-[#77d898]/35 bg-[#14311f]/70 text-[#a8f0b6] hover:bg-[#1d4e33]/75"
              : aiSpeechAudioUnavailable
                ? "border-[#f1c76e]/30 bg-[#261510]/70 text-[#f1d796] hover:bg-[#322014]/80"
              : "border-[#f1c76e]/25 bg-black/15 text-[#f1d796] hover:bg-[#f1c76e]/10",
          ].join(" ")}
        >
          <MobileHomeToolContent icon="播" label={aiSpeechAudioUnavailable ? "转写" : aiSpeechAudioEnabled ? "AI开" : "AI关"} />
        </button>
        {game && (
          <button
            onClick={onNewGame}
            disabled={loading}
            className="mobile-home-quick-action mobile-home-header-start rounded-full bg-[#b74332] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#220806]/35 transition hover:bg-[#cf513d] disabled:opacity-60"
          >
            <MobileHomeToolContent icon="新" label="新局" />
          </button>
        )}
      </div>
    </header>
  );
}

function MobileHomeToolContent({ icon, label }: { icon: string; label: string }) {
  return (
    <>
      <span className="mobile-home-tool-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mobile-home-tool-label">{label}</span>
    </>
  );
}

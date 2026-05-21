"use client";

import { useState } from "react";
import type * as React from "react";
import type { HumanGameView } from "@/game/types";
import { ActionPanel } from "./ActionPanel";
import type { AiSpeechAudioStatus, CommandPayload, HostAudioStatus, LiveAiSpeech } from "./clientTypes";
import {
  MOBILE_INFO_TABS,
  getMobileActionMode,
  getMobileFocusSeat,
  getMobileSeatCounts,
  type MobileInfoTabKey,
} from "./mobileTableModel";
import { StatusPill } from "./PanelPrimitives";
import { InfoPanel, PublicLog, SpeechFeed, TableNotesPanel, VoteTable } from "./TablePanels";
import { seatNumber } from "./viewHelpers";

export function MobileGameTable({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  events,
  onNewGame,
  onSubmit,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  events: HumanGameView["publicEvents"];
  onNewGame: () => Promise<void>;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  const [activeTab, setActiveTab] = useState<MobileInfoTabKey>("identity");
  const actionMode = getMobileActionMode(game, loading);
  const actionStatus = getMobileActionStatus(
    game,
    actionMode.label,
    liveAiSpeech,
    hostAudioStatus,
    aiSpeechAudioStatus,
    aiSpeechAudioUnavailable,
  );

  return (
    <section className="mobile-game-table sm:hidden" aria-label="手机版狼人杀牌桌">
      <div className="grid gap-3">
        <MobileTopStrip
          game={game}
          loading={loading}
          hostAudioStatus={hostAudioStatus}
          aiSpeechAudioStatus={aiSpeechAudioStatus}
          aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
          actionStatus={actionStatus}
          onNewGame={onNewGame}
          onOpenIdentityBook={onOpenIdentityBook}
          onOpenGlossary={onOpenGlossary}
          onToggleAiSpeechAudio={onToggleAiSpeechAudio}
          onToggleHostAudio={onToggleHostAudio}
        />
        <MobileSeatTable game={game} liveAiSpeech={liveAiSpeech} aiSpeechAudioStatus={aiSpeechAudioStatus} />
        <MobileInfoTabs activeTab={activeTab} onSelectTab={setActiveTab} />
        <MobileInfoSheet
          activeTab={activeTab}
          game={game}
          loading={loading}
          pendingCommandType={pendingCommandType}
          liveAiSpeech={liveAiSpeech}
          events={events}
        />
      </div>

      <div className="mobile-action-sheet mx-3 rounded-2xl border border-[#f1c76e]/18 bg-[#100a08]/96 p-3 shadow-2xl shadow-black/45 backdrop-blur-md">
        <div className="mobile-action-grip" aria-hidden="true" />
        <ActionPanel game={game} loading={loading} onNewGame={onNewGame} onSubmit={onSubmit} />
      </div>
    </section>
  );
}

function MobileTopStrip({
  game,
  loading,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  actionStatus,
  onNewGame,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  actionStatus: string;
  onNewGame: () => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  const { aliveCount, deadCount } = getMobileSeatCounts(game);
  const focusSeat = getMobileFocusSeat(game);

  return (
    <div className="mobile-table-top-strip sticky top-0 z-30 rounded-b-2xl border-b border-[#f1c76e]/18 bg-[#100a08]/96 px-3 py-3 shadow-xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="gold">第 {game.day} 天</StatusPill>
            <StatusPill tone={game.phase.startsWith("NIGHT") ? "blue" : "green"}>{game.phaseLabel}</StatusPill>
          </div>
          <div className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#f7ead5]">{actionStatus}</div>
          <div className="mt-1 text-xs leading-5 text-[#ad9c7d]">
            {focusSeat.seat ? `${focusSeat.label}：${seatNumber(focusSeat.seat)} · ${focusSeat.seat.name}` : focusSeat.label}
          </div>
        </div>

        <div className="shrink-0 text-right text-xs leading-5 text-[#dcc9a7]">
          <div>存活 {aliveCount}</div>
          <div>出局 {deadCount}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        <MobileQuickButton onClick={onOpenIdentityBook}>身份</MobileQuickButton>
        <MobileQuickButton onClick={onOpenGlossary}>术语</MobileQuickButton>
        <MobileQuickButton active={Boolean(hostAudioStatus)} onClick={onToggleHostAudio}>
          主持
        </MobileQuickButton>
        <MobileQuickButton active={Boolean(aiSpeechAudioStatus) || aiSpeechAudioUnavailable} onClick={onToggleAiSpeechAudio}>
          语音
        </MobileQuickButton>
        <MobileQuickButton disabled={loading} onClick={() => void onNewGame()}>
          新局
        </MobileQuickButton>
      </div>
    </div>
  );
}

function MobileQuickButton({
  active,
  disabled = false,
  children,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "min-h-10 rounded-lg border px-1.5 text-xs font-semibold transition disabled:opacity-55",
        active
          ? "border-[#77d898]/38 bg-[#14311f]/72 text-[#a8f0b6]"
          : "border-[#f1c76e]/18 bg-black/20 text-[#f1d796] hover:bg-[#f1c76e]/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MobileSeatTable({
  game,
  liveAiSpeech,
  aiSpeechAudioStatus,
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
}) {
  return (
    <div
      className="mobile-seat-table relative mx-3 min-h-[360px] overflow-hidden rounded-2xl border border-[#f1c76e]/22 bg-[#120b09]/78 bg-cover bg-center shadow-2xl shadow-black/40"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(8,6,5,0.18), rgba(8,6,5,0.82)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="pointer-events-none absolute inset-[22%] grid place-items-center rounded-full border border-[#f1c76e]/18 bg-black/22 text-center shadow-inner shadow-black/45">
        <div>
          <div className="text-xs text-[#ad9c7d]">Room Phase</div>
          <div className="mt-1 text-xl font-semibold text-[#f1d796]">D{game.day}</div>
          <div className="mt-1 max-w-[140px] text-xs leading-5 text-[#f7ead5]">{game.phaseLabel}</div>
        </div>
      </div>

      {game.seats.map((seat, index) => {
        const isHuman = seat.isHuman || seat.seatId === game.humanSeatId;
        const isActor = game.currentActorSeatId === seat.seatId;
        const isSpeaker = game.currentSpeakerSeatId === seat.seatId;
        const isLiveAiSpeaker = liveAiSpeech?.speaker.seatId === seat.seatId;
        const audioState = aiSpeechAudioStatus?.speaker.seatId === seat.seatId ? aiSpeechAudioStatus.state : undefined;
        const isFocused = isActor || isSpeaker || isLiveAiSpeaker || Boolean(audioState);
        const style = getMobileSeatStyle(index, game.seats.length);
        const focusLabel = audioState
          ? audioState === "paused"
            ? "已暂停"
            : "播放中"
          : isLiveAiSpeaker
            ? "生成中"
            : isSpeaker
              ? "发言中"
              : isActor
                ? "行动中"
                : undefined;

        return (
          <div
            key={seat.seatId}
            style={style}
            className={[
              "mobile-seat-chip absolute w-[68px] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-1.5 shadow-lg shadow-black/35 backdrop-blur-md",
              seat.alive ? "mobile-seat-alive border-[#f1c76e]/28 bg-[#180f0c]/88" : "mobile-seat-dead border-[#8b4a3d]/55 bg-[#1a0d0b]/78 opacity-75",
              isHuman ? "mobile-seat-self bg-[#25130f]/94" : "",
              isFocused ? "mobile-seat-focus ring-2 ring-[#77d898]" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="mobile-seat-number rounded-full bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-[#f1d796]">
                {seat.seatId}号
              </span>
              {isHuman && <span className="rounded-full bg-[#b74332] px-1.5 py-0.5 text-[10px] font-semibold text-white">我</span>}
            </div>
            <div className="mobile-seat-name mt-1 truncate text-[11px] font-semibold text-[#f7ead5]">{seat.name}</div>
            <div className="mobile-seat-state mt-0.5 flex flex-wrap gap-1 text-[10px] leading-4">
              <span className={seat.alive ? "text-[#9fe0a4]" : "text-[#ffb1a4]"}>{seat.alive ? "存活" : "出局"}</span>
              {seat.roleLabel && <span className="text-[#f1d796]">{seat.roleLabel}</span>}
              {focusLabel && <span className="text-[#a8f0b6]">{focusLabel}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MobileInfoTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: MobileInfoTabKey;
  onSelectTab: (tab: MobileInfoTabKey) => void;
}) {
  return (
    <div className="mobile-info-tabs mx-3 grid grid-cols-4 gap-1 rounded-xl border border-[#f1c76e]/14 bg-black/24 p-1">
      {MOBILE_INFO_TABS.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectTab(tab.key)}
            className={[
              "min-h-10 rounded-lg px-2 text-xs font-semibold transition",
              selected ? "mobile-info-tab-active bg-[#f1c76e]/16 text-[#f1d796]" : "text-[#ad9c7d] hover:bg-white/6 hover:text-[#f7ead5]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function MobileInfoSheet({
  activeTab,
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  events,
}: {
  activeTab: MobileInfoTabKey;
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  events: HumanGameView["publicEvents"];
}) {
  return (
    <div className="mobile-info-sheet mx-3 rounded-2xl border border-[#f1c76e]/16 bg-[#100a08]/78 p-3 shadow-xl shadow-black/30 backdrop-blur-md">
      {activeTab === "identity" && <InfoPanel game={game} embedded />}
      {activeTab === "speech" && <SpeechFeed game={game} liveAiSpeech={liveAiSpeech} variant="sidebar" />}
      {activeTab === "vote" && <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />}
      {activeTab === "log" && (
        <div className="grid gap-4">
          <TableNotesPanel game={game} embedded />
          <PublicLog game={game} events={events} embedded />
        </div>
      )}
    </div>
  );
}

function getMobileActionStatus(
  game: HumanGameView,
  actionModeLabel: string,
  liveAiSpeech: LiveAiSpeech | null,
  hostAudioStatus: HostAudioStatus | null,
  aiSpeechAudioStatus: AiSpeechAudioStatus | null,
  aiSpeechAudioUnavailable: boolean,
): string {
  if (liveAiSpeech) {
    return `AI 发言生成中：${seatNumber(liveAiSpeech.speaker)}`;
  }

  if (aiSpeechAudioStatus) {
    return `${seatNumber(aiSpeechAudioStatus.speaker)}语音${aiSpeechAudioStatus.state === "paused" ? "已暂停" : "播放中"}`;
  }

  if (hostAudioStatus) {
    return "主持人播报中";
  }

  if (aiSpeechAudioUnavailable && game.phase === "DAY_SPEECH") {
    return "AI 语音已转文字";
  }

  return actionModeLabel;
}

type MobileSeatStyle = React.CSSProperties & Record<"--seat-index", number>;

function getMobileSeatStyle(index: number, seatCount: number): MobileSeatStyle {
  const angle = -90 + (index / Math.max(seatCount, 1)) * 360;
  const radians = (angle * Math.PI) / 180;
  const left = 50 + Math.cos(radians) * 37;
  const top = 50 + Math.sin(radians) * 36;

  return {
    "--seat-index": index,
    left: `${left}%`,
    top: `${top}%`,
  };
}

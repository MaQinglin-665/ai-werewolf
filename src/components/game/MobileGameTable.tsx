"use client";

import { useEffect, useMemo, useState } from "react";
import type { HumanGameView } from "@/game/types";
import type { AiSpeechAudioStatus, CommandPayload, HostAudioStatus, LiveAiSpeech } from "./clientTypes";
import {
  getMobileActionPanelLayout,
  getMobileActionMode,
  getMobileDrawerSnapshot,
  getMobilePhaseSignalTone,
  getMobileSpeechInputPrompt,
  shouldShowMobileStageAction,
  type MobileDrawerSeenState,
  type MobileInfoTabKey,
} from "./mobileTableModel";
import { ReviewPanel } from "./ReviewPanel";
import { buildMobileDrawerTabs, markMobileTabSeen, MobileDrawerDock, MobileInfoDrawer } from "./MobileInfoDrawer";
import { MobilePhaseSignal, MobileSeatFeedbackStrip, MobileSeatStage, MobileTopStrip, type MobileSeatFeedback } from "./MobileSeatStage";
import { MobileSpeechInputBar, MobileSpeechStream } from "./MobileSpeechStream";
import { seatNumber } from "./viewHelpers";

export function MobileGameTable({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioEnabled,
  aiSpeechAudioEnabled,
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
  hostAudioEnabled: boolean;
  aiSpeechAudioEnabled: boolean;
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
  const [activeTab, setActiveTab] = useState<MobileInfoTabKey | null>(null);
  const [selectedSpeechSeatId, setSelectedSpeechSeatId] = useState<number | null>(null);
  const [seatFeedback, setSeatFeedback] = useState<MobileSeatFeedback | null>(null);
  const actionMode = getMobileActionMode(game, loading);
  const actionPanelLayout = getMobileActionPanelLayout(game, loading);
  const showStageAction = shouldShowMobileStageAction(game);
  const speechInputPrompt = getMobileSpeechInputPrompt(game);
  const drawerSnapshot = useMemo(() => getMobileDrawerSnapshot(game, events), [game, events]);
  const phaseSignalTone = getMobilePhaseSignalTone(game.phase);
  const [seenDrawerState, setSeenDrawerState] = useState<MobileDrawerSeenState>({
    latestSpeechSeq: 0,
    voteMarker: 0,
    logMarker: 0,
  });
  const selectedSpeechSeat = selectedSpeechSeatId ? game.seats.find((seat) => seat.seatId === selectedSpeechSeatId) : undefined;
  const visibleSeatFeedback = seatFeedback?.gameId === game.id ? seatFeedback : null;
  const drawerTabs = useMemo(
    () => buildMobileDrawerTabs(drawerSnapshot, activeTab ? markMobileTabSeen(seenDrawerState, drawerSnapshot, activeTab) : seenDrawerState, game, events),
    [activeTab, drawerSnapshot, seenDrawerState, game, events],
  );
  const actionStatus = getMobileActionStatus(
    game,
    actionMode.label,
    liveAiSpeech,
    hostAudioStatus,
    aiSpeechAudioStatus,
    aiSpeechAudioUnavailable,
  );

  useEffect(() => {
    if (!visibleSeatFeedback) return;
    if (loading || pendingCommandType === visibleSeatFeedback.commandType) return;
    const timer = window.setTimeout(() => {
      setSeatFeedback((current) => (current === visibleSeatFeedback ? null : current));
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [loading, pendingCommandType, visibleSeatFeedback]);

  const selectMobileTab = (tab: MobileInfoTabKey | null) => {
    setActiveTab(tab);
    if (tab) {
      setSeenDrawerState((current) => markMobileTabSeen(current, drawerSnapshot, tab));
    }
  };

  const closeMobileDrawer = () => {
    if (activeTab) {
      setSeenDrawerState((current) => markMobileTabSeen(current, drawerSnapshot, activeTab));
    }
    setActiveTab(null);
  };

  return (
    <section className={["mobile-game-table sm:hidden", game.review ? "mobile-game-table-review" : ""].join(" ")} aria-label="手机版狼人杀牌桌">
      <div className="mobile-game-screen">
        <MobileTopStrip
          game={game}
          loading={loading}
          hostAudioEnabled={hostAudioEnabled}
          aiSpeechAudioEnabled={aiSpeechAudioEnabled}
          aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
          actionStatus={actionStatus}
          onNewGame={onNewGame}
          onOpenIdentityBook={onOpenIdentityBook}
          onOpenGlossary={onOpenGlossary}
          onToggleAiSpeechAudio={onToggleAiSpeechAudio}
          onToggleHostAudio={onToggleHostAudio}
        />
        <MobilePhaseSignal key={`${game.id}-${game.phase}-${game.phaseLabel}`} label={game.phaseLabel} tone={phaseSignalTone} />
        {visibleSeatFeedback && (
          <MobileSeatFeedbackStrip feedback={visibleSeatFeedback} active={loading || pendingCommandType === visibleSeatFeedback.commandType} />
        )}
        <MobileSeatStage
          game={game}
          liveAiSpeech={liveAiSpeech}
          aiSpeechAudioStatus={aiSpeechAudioStatus}
          loading={loading}
          selectedFeedbackSeatId={visibleSeatFeedback?.seatId}
          actionLayerClassName={actionPanelLayout.actionLayerClassName}
          showStageAction={showStageAction}
          onNewGame={onNewGame}
          onSubmit={onSubmit}
          onOpenSpeechPanel={() => selectMobileTab("speech")}
          onOpenSeatSpeech={(seatId) => {
            setSelectedSpeechSeatId(seatId);
            selectMobileTab("speech");
          }}
          onSeatActionFeedback={setSeatFeedback}
        />
        <MobileSpeechStream game={game} liveAiSpeech={liveAiSpeech} />
        <div className={actionPanelLayout.dockClassName}>
          {speechInputPrompt && <MobileSpeechInputBar prompt={speechInputPrompt} onOpen={() => selectMobileTab("speech")} />}
          <MobileDrawerDock activeTab={activeTab} tabs={drawerTabs} onSelectTab={selectMobileTab} />
        </div>
      </div>

      {activeTab && (
        <MobileInfoDrawer
          activeTab={activeTab}
          onClose={closeMobileDrawer}
          game={game}
          loading={loading}
          pendingCommandType={pendingCommandType}
          liveAiSpeech={liveAiSpeech}
          events={events}
          selectedSpeechSeat={selectedSpeechSeat}
          onClearSpeechSeatFilter={() => setSelectedSpeechSeatId(null)}
          onNewGame={onNewGame}
          onSubmit={onSubmit}
        />
      )}

      {game.review && (
        <div className="mobile-review-shell mx-3 pb-4">
          <ReviewPanel game={game} reviewId="mobile-review" reviewEventsId="mobile-review-events" />
        </div>
      )}
    </section>
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

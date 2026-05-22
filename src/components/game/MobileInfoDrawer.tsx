"use client";

import type { HumanGameView } from "@/game/types";
import { ActionPanel } from "./ActionPanel";
import type { CommandPayload, LiveAiSpeech } from "./clientTypes";
import {
  MOBILE_INFO_TABS,
  getMobileDrawerSnapshot,
  getMobileFilteredSpeeches,
  hasMobileSpeechDrawerAction,
  type MobileDrawerSeenState,
  type MobileInfoTabKey,
} from "./mobileTableModel";
import { InfoPanel, PublicLog, SpeechFeed, TableNotesPanel, VoteTable } from "./TablePanels";
import { seatNumber } from "./viewHelpers";

type MobileDrawerTabView = {
  key: MobileInfoTabKey;
  label: string;
  meta?: string;
  hasDot: boolean;
  recommended: boolean;
};

export function buildMobileDrawerTabs(
  snapshot: ReturnType<typeof getMobileDrawerSnapshot>,
  seen: MobileDrawerSeenState,
  game: HumanGameView,
  events: HumanGameView["publicEvents"],
): MobileDrawerTabView[] {
  return MOBILE_INFO_TABS.map((tab) => {
    const meta =
      tab.key === "identity"
        ? game.myRoleLabel ?? (game.humanSeatId === null ? "观战" : undefined)
        : tab.key === "speech"
          ? snapshot.latestSpeechLabel
          : tab.key === "vote" && snapshot.voteMarker > 0
            ? `${snapshot.voteMarker}`
            : tab.key === "log" && events.length > 0
              ? `${events.length}`
              : undefined;
    const hasDot =
      (tab.key === "speech" && snapshot.latestSpeechSeq > seen.latestSpeechSeq) ||
      (tab.key === "vote" && snapshot.voteMarker > seen.voteMarker) ||
      (tab.key === "log" && snapshot.logMarker > seen.logMarker);

    return {
      ...tab,
      meta,
      hasDot,
      recommended: snapshot.recommendedTab === tab.key,
    };
  });
}

export function markMobileTabSeen(
  seen: MobileDrawerSeenState,
  snapshot: ReturnType<typeof getMobileDrawerSnapshot>,
  tab: MobileInfoTabKey,
): MobileDrawerSeenState {
  if (tab === "speech") return { ...seen, latestSpeechSeq: snapshot.latestSpeechSeq };
  if (tab === "vote") return { ...seen, voteMarker: snapshot.voteMarker };
  if (tab === "log") return { ...seen, logMarker: snapshot.logMarker };
  return seen;
}

export function MobileDrawerDock({
  activeTab,
  tabs,
  onSelectTab,
}: {
  activeTab: MobileInfoTabKey | null;
  tabs: MobileDrawerTabView[];
  onSelectTab: (tab: MobileInfoTabKey | null) => void;
}) {
  return (
    <div className="mobile-drawer-dock" aria-label="资料抽屉">
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectTab(selected ? null : tab.key)}
            className={[
              "mobile-drawer-tab",
              selected ? "mobile-drawer-tab-active" : "",
              tab.recommended ? "mobile-drawer-tab-recommended" : "",
            ].join(" ")}
          >
            <span className="mobile-drawer-tab-label">{tab.label}</span>
            {tab.meta && <span className="mobile-drawer-tab-meta">{tab.meta}</span>}
            {tab.hasDot && <span className="mobile-drawer-tab-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function MobileInfoDrawer({
  activeTab,
  onClose,
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  events,
  selectedSpeechSeat,
  onClearSpeechSeatFilter,
  onNewGame,
  onSubmit,
}: {
  activeTab: MobileInfoTabKey;
  onClose: () => void;
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  events: HumanGameView["publicEvents"];
  selectedSpeechSeat?: HumanGameView["seats"][number];
  onClearSpeechSeatFilter: () => void;
  onNewGame: () => Promise<void>;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  const showSpeechComposer = activeTab === "speech" && hasMobileSpeechDrawerAction(game);
  const filteredSpeeches = getMobileFilteredSpeeches(game.tableSummary.recentSpeeches, selectedSpeechSeat?.seatId ?? null);
  const speechFeedGame = selectedSpeechSeat
    ? {
        ...game,
        tableSummary: {
          ...game.tableSummary,
          recentSpeeches: filteredSpeeches,
        },
      }
    : game;
  const filteredLiveAiSpeech = selectedSpeechSeat && liveAiSpeech?.speaker.seatId !== selectedSpeechSeat.seatId ? null : liveAiSpeech;

  return (
    <div className="mobile-info-backdrop" role="dialog" aria-modal="true" aria-label="局内资料">
      <button type="button" className="mobile-info-backdrop-hit" aria-label="关闭资料" onClick={onClose} />
      <div className="mobile-info-drawer">
        <div className="mobile-action-grip" aria-hidden="true" />
        <div className="mobile-info-drawer-head">
          <strong>{MOBILE_INFO_TABS.find((tab) => tab.key === activeTab)?.label}</strong>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="mobile-info-drawer-body">
          {activeTab === "identity" && <InfoPanel game={game} embedded />}
          {activeTab === "speech" && (
            <div className="grid gap-3">
              {selectedSpeechSeat && (
                <div className="mobile-speech-filter-chip">
                  <span>
                    {seatNumber(selectedSpeechSeat)} {selectedSpeechSeat.name}
                  </span>
                  <button type="button" className="mobile-speech-filter-clear" onClick={onClearSpeechSeatFilter}>
                    全部
                  </button>
                </div>
              )}
              {showSpeechComposer && (
                <div className="mobile-drawer-speech-composer">
                  <ActionPanel game={game} loading={loading} onNewGame={onNewGame} onSubmit={onSubmit} reviewHref="#mobile-review" />
                </div>
              )}
              {selectedSpeechSeat && filteredSpeeches.length === 0 && !filteredLiveAiSpeech ? (
                <div className="mobile-empty-speech-filter">该玩家暂无最近发言</div>
              ) : (
                <SpeechFeed game={speechFeedGame} liveAiSpeech={filteredLiveAiSpeech} variant="sidebar" />
              )}
            </div>
          )}
          {activeTab === "vote" && <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />}
          {activeTab === "log" && (
            <div className="grid gap-4">
              <TableNotesPanel game={game} embedded />
              <PublicLog game={game} events={events} embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

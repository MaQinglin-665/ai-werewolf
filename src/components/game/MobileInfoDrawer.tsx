"use client";

import type { HumanGameView } from "@/game/types";
import { ActionPanel } from "./ActionPanel";
import type { CommandPayload, LiveAiSpeech } from "./clientTypes";
import {
  MOBILE_INFO_TABS,
  getMobileDrawerActivityMeta,
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
  activityKind: "none" | "role" | "speaker" | "count";
  unreadCount: number;
  hasDot: boolean;
  recommended: boolean;
  ariaLabel: string;
};

export function buildMobileDrawerTabs(
  snapshot: ReturnType<typeof getMobileDrawerSnapshot>,
  seen: MobileDrawerSeenState,
  game: HumanGameView,
): MobileDrawerTabView[] {
  return MOBILE_INFO_TABS.map((tab) => {
    const roleLabel = game.myRoleLabel ?? (game.humanSeatId === null ? "观战" : undefined);
    const activity = getMobileDrawerActivityMeta(tab.key, snapshot, seen, roleLabel);
    const hasDot =
      (tab.key === "speech" && snapshot.latestSpeechSeq > seen.latestSpeechSeq) ||
      (tab.key === "vote" && snapshot.voteMarker > seen.voteMarker) ||
      (tab.key === "log" && snapshot.logMarker > seen.logMarker);
    const recommended = snapshot.recommendedTab === tab.key;

    return {
      ...tab,
      meta: activity.label,
      activityKind: activity.kind,
      unreadCount: activity.unreadCount,
      hasDot,
      recommended,
      ariaLabel: buildMobileDrawerTabAriaLabel(tab.label, hasDot, recommended),
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
            aria-label={tab.ariaLabel}
            onClick={() => onSelectTab(selected ? null : tab.key)}
            className={[
              "mobile-drawer-tab",
              selected ? "mobile-drawer-tab-active" : "",
              tab.activityKind !== "none" ? "mobile-drawer-tab-has-activity" : "",
              tab.hasDot ? "mobile-drawer-tab-unread" : "",
              tab.recommended ? "mobile-drawer-tab-recommended" : "",
              `mobile-drawer-tab-activity-${tab.activityKind}`,
            ].join(" ")}
          >
            <span className="mobile-drawer-tab-label">{tab.label}</span>
            {tab.meta && <span className="mobile-drawer-tab-meta">{tab.meta}</span>}
            {tab.recommended && <span className="mobile-drawer-tab-recommendation">推荐</span>}
            {tab.hasDot && <span className="mobile-drawer-tab-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function buildMobileDrawerTabAriaLabel(label: string, hasDot: boolean, recommended: boolean): string {
  const parts = [`打开${label}`];
  if (hasDot) parts.push("有新内容");
  if (recommended) parts.push("当前阶段推荐");
  return parts.join("，");
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
                <div className="mobile-speech-filter-chip mobile-speech-filter-chip-active">
                  <span className="mobile-speech-filter-seat">
                    {seatNumber(selectedSpeechSeat)} {selectedSpeechSeat.name}
                  </span>
                  <button type="button" className="mobile-speech-filter-clear" onClick={onClearSpeechSeatFilter}>
                    全部发言
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

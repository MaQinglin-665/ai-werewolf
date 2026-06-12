"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AiRuntimeMode, HumanGameView } from "@/game/types";
import type { ClassTrialIntroConfig } from "./classTrialIntro";
import { ClassTrialOpeningIntro } from "./ClassTrialOpeningIntro";
import { ClassTrialGameTable } from "./ClassTrialGameTable";
import type { ClassTrialPackManifest } from "./classTrialTheme";
import type {
  AiSpeechAudioStatus,
  ClassTrialManualAudioPlayback,
  CommandPayload,
  HostAudioStatus,
  LiveAiSpeech,
} from "./clientTypes";
import { MobileGameTable } from "./MobileGameTable";
import { ActionPanel } from "./ActionPanel";
import { FlowStatusBar } from "./FlowStatusBar";
import { HostStage } from "./HostStagePanel";
import { PhaseRhythm } from "./PhaseRhythm";
import { ReviewPanel } from "./ReviewPanel";
import { SeatBoard } from "./SeatBoard";
import { AuxiliaryInfoPanel, VoteTable } from "./TablePanels";
import { buildTableEventFeed, type TableEventFeedItem } from "./tableEventFeed";

const ORDINARY_DESKTOP_SURFACE_QUERY = "(min-width: 640px)";

export type OrdinarySurfaceMode = "both" | "mobile" | "desktop";

export type GameClientLoadedSurfaceProps = {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioEnabled: boolean;
  aiSpeechAudioEnabled: boolean;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  bufferedClassTrialContinueKey: string | null;
  classTrialThemeActive: boolean;
  classTrialIntroPending: boolean;
  classTrialIntroReady: boolean;
  classTrialIntroConfig?: ClassTrialIntroConfig;
  classTrialIntroMessage: string;
  classTrialPackManifest?: ClassTrialPackManifest;
  manualAiSpeechPlayback: ClassTrialManualAudioPlayback | null;
  effectiveAiRuntimeMode: AiRuntimeMode;
  onNewGame: () => Promise<void>;
  onReturnHome: () => Promise<void> | void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
  onPauseAiSpeechAudio: () => void;
  onResumeAiSpeechAudio: () => void;
  onSkipAiSpeechAudio: () => void;
  onCompleteClassTrialIntro: () => void;
  onSkipClassTrialIntro: () => void;
};

export function shouldRenderOrdinaryMobileSurface(mode: OrdinarySurfaceMode): boolean {
  return mode !== "desktop";
}

export function shouldRenderOrdinaryDesktopSurface(mode: OrdinarySurfaceMode): boolean {
  return mode !== "mobile";
}

export function buildOrdinarySurfaceEventFeed(game: HumanGameView, classTrialThemeActive: boolean): TableEventFeedItem[] {
  return classTrialThemeActive ? [] : buildTableEventFeed(game);
}

export function GameClientLoadedSurface({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioEnabled,
  aiSpeechAudioEnabled,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  bufferedClassTrialContinueKey,
  classTrialThemeActive,
  classTrialIntroPending,
  classTrialIntroReady,
  classTrialIntroConfig,
  classTrialIntroMessage,
  classTrialPackManifest,
  manualAiSpeechPlayback,
  effectiveAiRuntimeMode,
  onNewGame,
  onReturnHome,
  onSubmit,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
  onPauseAiSpeechAudio,
  onResumeAiSpeechAudio,
  onSkipAiSpeechAudio,
  onCompleteClassTrialIntro,
  onSkipClassTrialIntro,
}: GameClientLoadedSurfaceProps) {
  const ordinarySurfaceMode = useOrdinarySurfaceMode(classTrialThemeActive);
  const renderMobileOrdinarySurface = shouldRenderOrdinaryMobileSurface(ordinarySurfaceMode);
  const renderDesktopOrdinarySurface = shouldRenderOrdinaryDesktopSurface(ordinarySurfaceMode);
  const ordinaryEvents = useMemo(
    () => buildOrdinarySurfaceEventFeed(game, classTrialThemeActive),
    [classTrialThemeActive, game],
  );

  return (
    <div className="grid flex-1 gap-4">
      {classTrialThemeActive && classTrialIntroPending && classTrialIntroReady && classTrialIntroConfig ? (
        <ClassTrialOpeningIntro
          config={classTrialIntroConfig}
          onComplete={onCompleteClassTrialIntro}
          onSkip={onSkipClassTrialIntro}
        />
      ) : classTrialThemeActive && classTrialIntroPending ? (
        <section className="class-trial-opening-wait class-trial-court-stage">
          <div className="class-trial-table-background" aria-hidden="true" />
          <div className="class-trial-opening-wait-panel">
            <h2>正在准备开场片头</h2>
            <p>{classTrialIntroMessage}</p>
            <button type="button" onClick={onSkipClassTrialIntro}>
              跳过片头，进入裁判席
            </button>
          </div>
        </section>
      ) : classTrialThemeActive ? (
        <ClassTrialGameTable
          game={game}
          loading={loading || Boolean(aiSpeechAudioStatus) || Boolean(bufferedClassTrialContinueKey)}
          manifest={classTrialPackManifest}
          audioTypewriter={aiSpeechAudioStatus ?? undefined}
          manualAudioPlayback={manualAiSpeechPlayback}
          liveAiSpeech={liveAiSpeech}
          aiRuntimeMode={effectiveAiRuntimeMode}
          hostAudioEnabled={hostAudioEnabled}
          hostAudioStatus={hostAudioStatus}
          onToggleHostAudio={onToggleHostAudio}
          onReturnHome={() => void onReturnHome()}
          onSubmit={onSubmit}
        />
      ) : renderMobileOrdinarySurface ? (
        <MobileGameTable
          game={game}
          loading={loading}
          pendingCommandType={pendingCommandType}
          liveAiSpeech={liveAiSpeech}
          hostAudioEnabled={hostAudioEnabled}
          aiSpeechAudioEnabled={aiSpeechAudioEnabled}
          hostAudioStatus={hostAudioStatus}
          aiSpeechAudioStatus={aiSpeechAudioStatus}
          aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
          events={ordinaryEvents}
          onNewGame={onNewGame}
          onReturnHome={onReturnHome}
          onSubmit={onSubmit}
          onOpenIdentityBook={onOpenIdentityBook}
          onOpenGlossary={onOpenGlossary}
          onToggleAiSpeechAudio={onToggleAiSpeechAudio}
          onToggleHostAudio={onToggleHostAudio}
        />
      ) : null}

      {!classTrialThemeActive && renderDesktopOrdinarySurface && (
        <div className="hidden gap-4 sm:grid">
          <PhaseRhythm game={game} />
          <HostStage game={game} />
          <FlowStatusBar
            game={game}
            loading={loading}
            pendingCommandType={pendingCommandType}
            liveAiSpeech={liveAiSpeech}
            hostAudioStatus={hostAudioStatus}
            aiSpeechAudioStatus={aiSpeechAudioStatus}
            aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
            onPauseAiSpeechAudio={onPauseAiSpeechAudio}
            onResumeAiSpeechAudio={onResumeAiSpeechAudio}
            onSkipAiSpeechAudio={onSkipAiSpeechAudio}
            onToggleAiSpeechAudio={onToggleAiSpeechAudio}
          />
          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,420px)]">
            <div className="grid content-start gap-4">
              <SeatBoard game={game} liveAiSpeech={liveAiSpeech} aiSpeechAudioStatus={aiSpeechAudioStatus} />
              {game.review && <ReviewPanel game={game} />}
            </div>

            <aside className="grid content-start gap-4">
              <ActionPanel
                game={game}
                loading={loading}
                onNewGame={onNewGame}
                onReturnHome={onReturnHome}
                onSubmit={onSubmit}
              />
              <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />
              <AuxiliaryInfoPanel game={game} events={ordinaryEvents} />
            </aside>
          </section>
        </div>
      )}
    </div>
  );
}

function useOrdinarySurfaceMode(classTrialThemeActive: boolean): OrdinarySurfaceMode {
  const viewportMode = useSyncExternalStore(
    subscribeOrdinarySurfaceMode,
    getOrdinarySurfaceModeSnapshot,
    getOrdinarySurfaceModeServerSnapshot,
  );
  return classTrialThemeActive ? "both" : viewportMode;
}

function subscribeOrdinarySurfaceMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mediaQuery = window.matchMedia(ORDINARY_DESKTOP_SURFACE_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getOrdinarySurfaceModeSnapshot(): OrdinarySurfaceMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "both";
  return window.matchMedia(ORDINARY_DESKTOP_SURFACE_QUERY).matches ? "desktop" : "mobile";
}

function getOrdinarySurfaceModeServerSnapshot(): OrdinarySurfaceMode {
  return "both";
}

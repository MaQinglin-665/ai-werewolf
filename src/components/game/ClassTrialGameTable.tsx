"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AiRuntimeMode, HumanGameView } from "@/game/types";
import {
  buildClassTrialDialogueTimeline,
  getClassTrialDialogueFrame,
  getClassTrialDialogueFrameByProgress,
} from "./classTrialDialogue";
import { ClassTrialVerdictReview } from "./ClassTrialVerdictReview";
import { ClassTrialVoteStage } from "./ClassTrialVoteStage";
import {
  buildClassTrialTableModel,
  getAudioWaitingText,
  isMatchingAudioTypewriter,
  type ClassTrialSpeakingFocusView,
} from "./classTrialTableModel";
import {
  getClassTrialCourtBackgroundUrl,
  type ClassTrialPackCharacter,
  type ClassTrialPackManifest,
} from "./classTrialTheme";
import type {
  ClassTrialAudioTypewriterState,
  ClassTrialManualAudioPlayback,
  CommandPayload,
  HostAudioStatus,
  LiveAiSpeech,
} from "./clientTypes";

type PortraitCssVariables = CSSProperties & {
  "--class-trial-portrait-scale": number;
  "--class-trial-portrait-x": string;
  "--class-trial-portrait-y": string;
};

type CourtStageCssVariables = CSSProperties & {
  "--class-trial-court-background"?: string;
};

type MotionPreference = "pending" | "enabled" | "reduced";

function getPortraitCssVariables(
  character: ClassTrialPackCharacter | undefined,
  portraitState: "thinking" | "speaking",
): PortraitCssVariables {
  const layout =
    portraitState === "thinking"
      ? character?.thinkingPortraitLayout ?? character?.portraitLayout ?? { scale: 1, x: 0, y: 0 }
      : character?.portraitLayout ?? { scale: 1, x: 0, y: 0 };
  return {
    "--class-trial-portrait-scale": layout.scale,
    "--class-trial-portrait-x": `${layout.x}%`,
    "--class-trial-portrait-y": `${layout.y}%`,
  };
}

function getRingFocusStyle(hasSpeakingFocus: boolean): CSSProperties {
  return hasSpeakingFocus ? { filter: "blur(2.4px)", opacity: 0.28 } : { filter: "none", opacity: 0.82 };
}

function getCourtStageStyle(manifest: ClassTrialPackManifest | undefined): CourtStageCssVariables | undefined {
  const courtBackgroundUrl = getClassTrialCourtBackgroundUrl(manifest);
  return courtBackgroundUrl ? { "--class-trial-court-background": `url(${courtBackgroundUrl})` } : undefined;
}

function getSeatStyle(index: number, total: number): CSSProperties {
  const angle = (Math.PI * 2 * index) / Math.max(1, total) - Math.PI / 2;
  const x = 50 + Math.cos(angle) * 36;
  const y = 48 + Math.sin(angle) * 28;
  return { left: `${x}%`, top: `${y}%` };
}

export function ClassTrialGameTable({
  game,
  loading,
  manifest,
  audioTypewriter,
  manualAudioPlayback,
  liveAiSpeech,
  aiRuntimeMode = "mock",
  hostAudioEnabled = false,
  hostAudioStatus = null,
  onToggleHostAudio,
  onReturnHome,
  onSubmit,
}: {
  game: HumanGameView;
  loading: boolean;
  manifest?: ClassTrialPackManifest;
  audioTypewriter?: ClassTrialAudioTypewriterState;
  manualAudioPlayback?: ClassTrialManualAudioPlayback | null;
  liveAiSpeech?: LiveAiSpeech | null;
  aiRuntimeMode?: AiRuntimeMode;
  hostAudioEnabled?: boolean;
  hostAudioStatus?: HostAudioStatus | null;
  onToggleHostAudio?: () => void;
  onReturnHome: () => void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  const courtStageStyle = getCourtStageStyle(manifest);
  const tableModel = buildClassTrialTableModel({
    game,
    manifest,
    audioTypewriter,
    liveAiSpeech,
    aiRuntimeMode,
    hostAudioEnabled,
    hostAudioStatus,
  });
  const {
    seatCharacters,
    activeAudioTypewriter,
    speakerSeatId,
    activeSeatId,
    speakerName,
    centerStatus,
    currentSpeakingFocusKey,
    currentSpeakingFocus,
    themeFlow,
    aiRuntimeLabel,
    classTrialVoteState,
    nightPhase,
    hostAudioLabel,
    voteLockedSeatIds,
    votePendingSeatIds,
    voteFocusSeatId,
  } = tableModel;
  const previousSpeakingFocusRef = useRef<ClassTrialSpeakingFocusView | undefined>(currentSpeakingFocus);
  const [exitingFocus, setExitingFocus] = useState<ClassTrialSpeakingFocusView | undefined>();
  const visibleFocus = currentSpeakingFocus ?? exitingFocus;
  const focusSpeakerName = visibleFocus?.speakerName ?? speakerName;
  const focusCharacter = visibleFocus?.character;
  const hasSpeakingFocus = Boolean(visibleFocus);
  const matchingAudioTypewriter = isMatchingAudioTypewriter(activeAudioTypewriter, speakerSeatId)
    ? activeAudioTypewriter
    : undefined;
  const waitingForSpeechAudioStart = loading && hasSpeakingFocus && !matchingAudioTypewriter;
  const audioFocusMessage =
    matchingAudioTypewriter?.state === "playing" && matchingAudioTypewriter.text.trim()
      ? matchingAudioTypewriter.text.trim()
      : undefined;
  const focusMessage = audioFocusMessage ?? visibleFocus?.message ?? "";
  const [motionPreference, setMotionPreference] = useState<MotionPreference>("pending");
  const animationEnabled = motionPreference === "enabled";
  const shouldUseAudioSyncedTimeline =
    matchingAudioTypewriter?.state === "playing" &&
    matchingAudioTypewriter.syncedTypewriter &&
    motionPreference !== "reduced";
  const dialogueKey = `${visibleFocus?.key ?? "no-focus"}\n${animationEnabled ? "animated" : "static"}`;
  const [dialogueProgress, setDialogueProgress] = useState({ frameIndex: 0, key: dialogueKey });
  const timeline = buildClassTrialDialogueTimeline(focusMessage, {
    reducedMotion: !animationEnabled && !shouldUseAudioSyncedTimeline,
  });
  const dialogueMode = timeline.mode;
  const dialogueFrameCount = timeline.frames.length;
  const dialogueFrameIndex =
    dialogueProgress.key === dialogueKey ? dialogueProgress.frameIndex : animationEnabled && dialogueMode !== "full" ? -1 : 0;
  const syncedDialogueFrame = shouldUseAudioSyncedTimeline
    ? getClassTrialDialogueFrameByProgress(timeline, matchingAudioTypewriter.playbackProgress ?? Number.NaN)
    : undefined;
  const displayedMessage =
    matchingAudioTypewriter?.state === "loading" || matchingAudioTypewriter?.state === "paused" || waitingForSpeechAudioStart
      ? getAudioWaitingText(matchingAudioTypewriter, timeline.thinkingText)
      : syncedDialogueFrame ?? getClassTrialDialogueFrame(timeline, dialogueFrameIndex);
  const isDialogueThinking =
    matchingAudioTypewriter?.state === "loading" ||
    matchingAudioTypewriter?.state === "paused" ||
    waitingForSpeechAudioStart ||
    dialogueFrameIndex < 0;
  const continueAction = game.availableActions.find((action) => action.type === "continue");
  const matchingManualAudioPlayback =
    manualAudioPlayback &&
    manualAudioPlayback.speechKey === matchingAudioTypewriter?.speechKey &&
    manualAudioPlayback.speakerSeatId === speakerSeatId
      ? manualAudioPlayback
      : undefined;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAnimationPreference = () => setMotionPreference(reducedMotionQuery.matches ? "reduced" : "enabled");
    updateAnimationPreference();
    reducedMotionQuery.addEventListener("change", updateAnimationPreference);
    return () => reducedMotionQuery.removeEventListener("change", updateAnimationPreference);
  }, []);

  useEffect(() => {
    if (!currentSpeakingFocus) return;
    previousSpeakingFocusRef.current = currentSpeakingFocus;
  }, [currentSpeakingFocus]);

  useEffect(() => {
    if (currentSpeakingFocusKey) return;

    const previousFocus = previousSpeakingFocusRef.current;
    if (!previousFocus) return;

    const showExitTimer = window.setTimeout(() => {
      setExitingFocus({ ...previousFocus, stage: "exit" });
    }, 0);
    const clearExitTimer = window.setTimeout(() => {
      setExitingFocus((focus) => (focus?.key === previousFocus.key ? undefined : focus));
      if (previousSpeakingFocusRef.current?.key === previousFocus.key) {
        previousSpeakingFocusRef.current = undefined;
      }
    }, 280);

    return () => {
      window.clearTimeout(showExitTimer);
      window.clearTimeout(clearExitTimer);
    };
  }, [currentSpeakingFocusKey]);

  useEffect(() => {
    if (!hasSpeakingFocus) return;
    if (waitingForSpeechAudioStart) return;
    if (matchingAudioTypewriter?.state === "loading") return;
    if (matchingAudioTypewriter?.state === "playing" && matchingAudioTypewriter.syncedTypewriter) return;
    if (!animationEnabled || dialogueMode === "full") return;
    if (dialogueFrameIndex >= dialogueFrameCount - 1) return;

    const delay = dialogueFrameIndex < 0 ? 520 : dialogueMode === "characters" ? 32 : 260;
    const timer = window.setTimeout(() => {
      setDialogueProgress({
        frameIndex: Math.min(dialogueFrameIndex + 1, dialogueFrameCount - 1),
        key: dialogueKey,
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    animationEnabled,
    dialogueFrameCount,
    dialogueFrameIndex,
    dialogueKey,
    dialogueMode,
    hasSpeakingFocus,
    matchingAudioTypewriter?.state,
    matchingAudioTypewriter?.syncedTypewriter,
    waitingForSpeechAudioStart,
  ]);

  if (game.result) {
    return (
      <section className="class-trial-table class-trial-court-stage class-trial-table-review" style={courtStageStyle}>
        <div className="class-trial-table-background" aria-hidden="true" />
        <ClassTrialVerdictReview game={game} onReturnHome={onReturnHome} />
      </section>
    );
  }

  return (
    <section
      className={[
        "class-trial-table",
        "class-trial-court-stage",
        nightPhase ? "class-trial-table-night" : "",
        hasSpeakingFocus ? "class-trial-table-speaking" : "",
        classTrialVoteState ? "class-trial-table-vote-active" : "",
        classTrialVoteState?.variant === "reveal" ? "class-trial-table-vote-reveal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={courtStageStyle}
    >
      <div className="class-trial-table-background" aria-hidden="true" />
      {nightPhase && <div className="class-trial-night-haze" aria-hidden="true" />}
      <header className="class-trial-table-topbar">
        <div>
          <span className="class-trial-table-kicker">Local Theme</span>
          <h2>学级裁判主题局</h2>
        </div>
        <div className="class-trial-table-actions">
          <span className="class-trial-table-runtime">{aiRuntimeLabel}</span>
          {onToggleHostAudio && (
            <button
              type="button"
              onClick={onToggleHostAudio}
              aria-pressed={hostAudioEnabled}
              aria-label={hostAudioStatus ? "系统播报中" : hostAudioEnabled ? "关闭主持播报" : "开启主持播报"}
              className={[
                "class-trial-host-audio-toggle",
                hostAudioEnabled ? "class-trial-host-audio-toggle-active" : "",
                hostAudioStatus ? "class-trial-host-audio-toggle-playing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="class-trial-host-audio-icon" aria-hidden="true">
                音
              </span>
              <span>{hostAudioLabel}</span>
            </button>
          )}
          <button type="button" onClick={onReturnHome} className="class-trial-table-secondary">
            返回首页
          </button>
        </div>
      </header>

      <div className="class-trial-ring" aria-label="9人环形裁判席" style={getRingFocusStyle(hasSpeakingFocus)}>
        {game.seats.map((seat, index) => {
          const character = seatCharacters.get(seat.seatId);
          if (!character) return null;

          return (
            <div
              key={seat.seatId}
              className={[
                "class-trial-seat",
                nightPhase ? "class-trial-seat-night-dim" : "",
                seat.alive ? "" : "class-trial-seat-dead",
                seat.seatId === activeSeatId ? "class-trial-seat-active" : "",
                voteLockedSeatIds.has(seat.seatId) ? "class-trial-seat-vote-locked" : "",
                votePendingSeatIds.has(seat.seatId) ? "class-trial-seat-vote-waiting" : "",
                voteFocusSeatId === seat.seatId ? "class-trial-seat-vote-focus" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={getSeatStyle(index, game.seats.length)}
            >
              <span className="class-trial-seat-number">{seat.seatId}号</span>
              {character.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={character.avatarUrl} alt="" className="class-trial-seat-avatar" aria-hidden="true" />
              )}
              <span className="class-trial-seat-name">{character.displayName}</span>
              {!seat.alive && <span className="class-trial-seat-status">已退场</span>}
              {seat.alive && voteLockedSeatIds.has(seat.seatId) && (
                <span className="class-trial-seat-vote-status">已锁票</span>
              )}
              {seat.alive && votePendingSeatIds.has(seat.seatId) && (
                <span className="class-trial-seat-vote-status class-trial-seat-vote-status-waiting">等待中</span>
              )}
            </div>
          );
        })}
      </div>

      <section className="class-trial-info-table" aria-label="当前阶段">
        <span className="class-trial-step-label">{themeFlow.label}</span>
        <strong>{centerStatus}</strong>
        <p>{themeFlow.detail}</p>
      </section>

      {classTrialVoteState && <ClassTrialVoteStage game={game} />}

      {focusCharacter && (
        <section
          className={["class-trial-focus", visibleFocus?.stage === "exit" ? "class-trial-focus-exit" : "class-trial-focus-enter"].join(" ")}
          aria-hidden={visibleFocus?.stage === "exit" ? true : undefined}
          aria-label="当前发言者"
        >
          <div className="class-trial-portrait-placeholder">
            {(() => {
              const portraitState = isDialogueThinking ? "thinking" : "speaking";
              const portraitUrl =
                portraitState === "thinking"
                  ? focusCharacter.thinkingPortraitUrl ?? focusCharacter.portraitUrl
                  : focusCharacter.portraitUrl;
              return portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portraitUrl}
                  alt={focusSpeakerName}
                  className="class-trial-portrait-image"
                  data-portrait-id={focusCharacter.id}
                  data-portrait-state={portraitState}
                  style={getPortraitCssVariables(focusCharacter, portraitState)}
                />
              ) : (
                <span>{focusSpeakerName}</span>
              );
            })()}
          </div>
          <div className="class-trial-dialogue" data-dialogue-mode={timeline.mode}>
            <h3>{focusSpeakerName}</h3>
            <p className="class-trial-dialogue-text" aria-live="polite" data-dialogue-state={isDialogueThinking ? "thinking" : "speaking"}>
              {displayedMessage}
            </p>
            {matchingManualAudioPlayback && (
              <div className="class-trial-dialogue-audio-action">
                <button type="button" onClick={matchingManualAudioPlayback.onPlay} disabled={matchingManualAudioPlayback.playing}>
                  {matchingManualAudioPlayback.playing ? "正在播放语音" : "点击播放语音"}
                </button>
                <span>{matchingManualAudioPlayback.errorMessage ?? "浏览器拦截了自动播放，需要手动点一下。"}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {continueAction && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void onSubmit({ type: "continue" })}
          className="class-trial-table-primary"
        >
          {loading ? "推进中" : continueAction.label}
        </button>
      )}
    </section>
  );
}

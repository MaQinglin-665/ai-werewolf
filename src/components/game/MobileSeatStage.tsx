"use client";

import type * as React from "react";
import type { HumanGameView } from "@/game/types";
import { ActionPanel } from "./ActionPanel";
import type { AiSpeechAudioStatus, CommandPayload, LiveAiSpeech } from "./clientTypes";
import {
  getMobileAudioButtonStates,
  getMobileFocusSeat,
  getMobileSeatCardVisual,
  getMobileSeatCounts,
  getMobileSeatStageLayout,
  type MobilePhaseSignalTone,
} from "./mobileTableModel";
import { seatNumber } from "./viewHelpers";

export type MobileSeatFeedback = {
  gameId: HumanGameView["id"];
  seatId: number;
  seatName: string;
  actionLabel: string;
  commandType: CommandPayload["type"];
};

export function MobilePhaseSignal({ label, tone }: { label: string; tone: MobilePhaseSignalTone }) {
  return (
    <div className={["mobile-phase-signal", `mobile-phase-signal-${tone}`].join(" ")} role="status" aria-live="polite">
      <span>{label}</span>
    </div>
  );
}

export function MobileSeatFeedbackStrip({ feedback, active }: { feedback: MobileSeatFeedback; active: boolean }) {
  return (
    <div className={["mobile-seat-feedback-strip", active ? "mobile-seat-feedback-strip-active" : ""].join(" ")} role="status" aria-live="polite">
      <span>已选择</span>
      <strong>
        {feedback.seatId}号 {feedback.seatName}
      </strong>
      <em>{active ? `${feedback.actionLabel}中` : feedback.actionLabel}</em>
    </div>
  );
}

export function MobileTopStrip({
  game,
  loading,
  hostAudioEnabled,
  aiSpeechAudioEnabled,
  aiSpeechAudioUnavailable,
  actionStatus,
  onNewGame,
  onReturnHome,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  hostAudioEnabled: boolean;
  aiSpeechAudioEnabled: boolean;
  aiSpeechAudioUnavailable: boolean;
  actionStatus: string;
  onNewGame: () => Promise<void>;
  onReturnHome?: () => Promise<void> | void;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  const { aliveCount, deadCount } = getMobileSeatCounts(game);
  const focusSeat = getMobileFocusSeat(game);
  const audioButtonStates = getMobileAudioButtonStates({
    hostAudioEnabled,
    aiSpeechAudioEnabled,
    aiSpeechAudioUnavailable,
  });

  return (
    <div className="mobile-table-top-strip">
      <div className="mobile-room-badge">
        <span className="mobile-room-day">D{game.day}</span>
        <span className="mobile-room-title">{game.board.name}</span>
      </div>

      <div className="mobile-phase-copy">
        <div className="mobile-phase-main">{game.phaseLabel}</div>
        <div className="mobile-phase-sub">
          {focusSeat.seat ? `${focusSeat.label} · ${seatNumber(focusSeat.seat)} ${focusSeat.seat.name}` : actionStatus}
        </div>
      </div>

      <div className="mobile-top-counts" aria-label={`存活${aliveCount}，出局${deadCount}`}>
        <span>存活 {aliveCount}</span>
        <span>出局 {deadCount}</span>
      </div>

      <div className="mobile-top-actions">
        <MobileQuickButton label="身份书" onClick={onOpenIdentityBook}>书</MobileQuickButton>
        <MobileQuickButton label="术语表" onClick={onOpenGlossary}>?</MobileQuickButton>
        <MobileQuickButton
          label={audioButtonStates.aiSpeechActive ? "AI 语音开" : "AI 语音关"}
          active={audioButtonStates.aiSpeechActive}
          pressed={audioButtonStates.aiSpeechPressed}
          onClick={onToggleAiSpeechAudio}
        >
          音
        </MobileQuickButton>
        <MobileQuickButton label={audioButtonStates.hostActive ? "主持开" : "主持关"} active={audioButtonStates.hostActive} onClick={onToggleHostAudio}>
          播
        </MobileQuickButton>
        {onReturnHome && (
          <MobileQuickButton label="返回主页面" disabled={loading} onClick={() => void onReturnHome()}>
            主
          </MobileQuickButton>
        )}
        <MobileQuickButton label="新开一局" disabled={loading} onClick={() => void onNewGame()}>
          新
        </MobileQuickButton>
      </div>
    </div>
  );
}

function MobileQuickButton({
  label,
  active,
  pressed = active,
  disabled = false,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={["mobile-icon-button", active ? "mobile-icon-button-active" : ""].join(" ")}
    >
      {children}
    </button>
  );
}

export function MobileSeatStage({
  game,
  liveAiSpeech,
  aiSpeechAudioStatus,
  loading,
  selectedFeedbackSeatId,
  actionLayerClassName,
  showStageAction,
  onNewGame,
  onReturnHome,
  onSubmit,
  onOpenSpeechPanel,
  onOpenSeatSpeech,
  onSeatActionFeedback,
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  loading: boolean;
  selectedFeedbackSeatId?: number;
  actionLayerClassName: string;
  showStageAction: boolean;
  onNewGame: () => Promise<void>;
  onReturnHome?: () => Promise<void> | void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  onOpenSpeechPanel: () => void;
  onOpenSeatSpeech: (seatId: number) => void;
  onSeatActionFeedback: (feedback: MobileSeatFeedback) => void;
}) {
  const seatTargetActions = getMobileSeatTargetActions(game);
  const showStageActionPanel = showStageAction && !hasOnlyAvatarTargetActions(game);

  return (
    <div
      className="mobile-seat-stage"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(255,241,204,0.16), rgba(9,8,8,0.34) 42%, rgba(28,22,18,0.68)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mobile-stage-title">
        <span>{game.phase.startsWith("NIGHT") ? "夜晚" : "白天"}</span>
        <strong>{game.phaseLabel}</strong>
      </div>

      {showStageActionPanel && (
        <div className={actionLayerClassName}>
          <ActionPanel
            game={game}
            loading={loading}
            onNewGame={onNewGame}
            onReturnHome={onReturnHome}
            onSubmit={onSubmit}
            reviewHref="#mobile-review"
            mobileCompact
            onOpenSpeechPanel={onOpenSpeechPanel}
          />
        </div>
      )}

      {game.seats.map((seat, index) => {
        const isHuman = seat.isHuman || seat.seatId === game.humanSeatId;
        const isActor = game.currentActorSeatId === seat.seatId;
        const isSpeaker = game.currentSpeakerSeatId === seat.seatId;
        const isLiveAiSpeaker = liveAiSpeech?.speaker.seatId === seat.seatId;
        const audioState = aiSpeechAudioStatus?.speaker.seatId === seat.seatId ? aiSpeechAudioStatus.state : undefined;
        const isFocused = isActor || isSpeaker || isLiveAiSpeaker || Boolean(audioState);
        const layout = getMobileSeatStageLayout(index, game.seats.length);
        const style = getMobileSeatStyle(layout);
        const cardVisual = getMobileSeatCardVisual(seat);
        const seatActions = seatTargetActions.get(seat.seatId) ?? [];
        const primarySeatAction = seatActions[0];
        const opensSpeech = seatActions.length === 0;
        const isSelectedFeedbackSeat = selectedFeedbackSeatId === seat.seatId;
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
            aria-label={`${seatNumber(seat)} ${seat.name}${focusLabel ? ` ${focusLabel}` : ""}`}
            role={opensSpeech ? "button" : undefined}
            tabIndex={opensSpeech ? 0 : undefined}
            style={style}
            onClick={opensSpeech ? () => onOpenSeatSpeech(seat.seatId) : undefined}
            onKeyDown={
              opensSpeech
                ? (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onOpenSeatSpeech(seat.seatId);
                  }
                : undefined
            }
            className={[
              "mobile-seat-token",
              layout.compact ? "mobile-seat-token-compact" : "",
              layout.side === "right" ? "mobile-seat-token-right" : "",
              seat.alive ? "mobile-seat-alive" : "mobile-seat-dead",
              isHuman ? "mobile-seat-self" : "",
              isFocused ? "mobile-seat-focus" : "",
              opensSpeech ? "mobile-seat-open-speech" : "",
              isSelectedFeedbackSeat ? "mobile-seat-token-selected" : "",
              primarySeatAction ? `mobile-seat-actionable mobile-seat-token-action-ready mobile-seat-action-${primarySeatAction.tone}` : "",
              seatActions.length > 1 ? "mobile-seat-action-multiple" : "",
            ].join(" ")}
          >
            <div
              className={[
                "mobile-seat-card-art relative shrink-0 overflow-hidden border bg-cover bg-center shadow-lg shadow-black/35",
                cardVisual.kind === "customAvatar" ? "mobile-seat-card-custom bg-[#0d2118]" : "",
                seat.alive ? "border-[#f1c76e]/42" : "border-[#8b4a3d]/70 grayscale",
              ].join(" ")}
              style={cardVisual.kind === "customAvatar" ? undefined : { backgroundImage: `url(${cardVisual.image})` }}
              aria-label={cardVisual.label}
            >
              {cardVisual.kind === "customAvatar" && <MobileCustomAvatarCardArt src={cardVisual.image} />}
              {cardVisual.kind === "hiddenCard" && <span className="absolute inset-0 bg-black/10" />}
              <span className="mobile-seat-number">
                {seat.seatId}
              </span>
              {isHuman && <span className="mobile-seat-self-mark">我</span>}
              {seatActions.length === 1 && primarySeatAction && (
                <button
                  type="button"
                  disabled={loading}
                  aria-label={primarySeatAction.ariaLabel}
                  className="mobile-seat-action-hit mobile-seat-action-feedback-source"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeatActionFeedback({
                      gameId: game.id,
                      seatId: seat.seatId,
                      seatName: seat.name,
                      actionLabel: primarySeatAction.label,
                      commandType: primarySeatAction.payload.type,
                    });
                    void onSubmit(primarySeatAction.payload);
                  }}
                >
                  <span className="mobile-seat-action-badge mobile-seat-action-label">{primarySeatAction.label}</span>
                </button>
              )}
              {seatActions.length > 1 && (
                <div className="mobile-seat-action-stack" role="group" aria-label={`${seatNumber(seat)}可选操作`}>
                  {seatActions.map((action) => (
                    <button
                      key={`${action.payload.type}-${action.label}`}
                      type="button"
                      disabled={loading}
                      aria-label={action.ariaLabel}
                      className={["mobile-seat-action-choice", "mobile-seat-action-feedback-source", `mobile-seat-action-choice-${action.tone}`].join(" ")}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSeatActionFeedback({
                          gameId: game.id,
                          seatId: seat.seatId,
                          seatName: seat.name,
                          actionLabel: action.label,
                          commandType: action.payload.type,
                        });
                        void onSubmit(action.payload);
                      }}
                    >
                      <span className="mobile-seat-action-badge mobile-seat-action-label">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mobile-seat-copy min-w-0">
              <div className="mobile-seat-name truncate font-semibold text-[#f7ead5]">{seat.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type MobileSeatTargetAction = {
  ariaLabel: string;
  label: string;
  payload: CommandPayload;
  tone: "danger" | "seer" | "guard" | "vote" | "sheriff" | "charm" | "knight";
};

function getMobileSeatTargetActions(game: HumanGameView): Map<number, MobileSeatTargetAction[]> {
  const actions = new Map<number, MobileSeatTargetAction[]>();
  const addTargets = (
    targets: Array<{ seatId: number; name: string }>,
    verb: string,
    label: string,
    tone: MobileSeatTargetAction["tone"],
    createPayload: (targetSeatId: number) => CommandPayload,
  ) => {
    for (const target of targets) {
      const seatActions = actions.get(target.seatId) ?? [];
      seatActions.push({
        ariaLabel: `${verb}${target.seatId}号 ${target.name}`,
        label,
        payload: createPayload(target.seatId),
        tone,
      });
      actions.set(target.seatId, seatActions);
    }
  };

  for (const action of game.availableActions) {
    if (action.type === "wolfKill") {
      addTargets(action.targets, "击杀", "击杀", "danger", (targetSeatId) => ({ type: "wolfKill", targetSeatId }));
    } else if (action.type === "seerCheck") {
      addTargets(action.targets, "查验", "查验", "seer", (targetSeatId) => ({ type: "seerCheck", targetSeatId }));
    } else if (action.type === "witchAction") {
      if (action.canPoison) {
        addTargets(action.poisonTargets, "毒", "毒", "danger", (targetSeatId) => ({ type: "witchAction", mode: "poison", targetSeatId }));
      }
    } else if (action.type === "wolfBeautyCharm") {
      addTargets(action.targets, "魅惑", "魅惑", "charm", (targetSeatId) => ({ type: "wolfBeautyCharm", targetSeatId }));
    } else if (action.type === "guardAction") {
      addTargets(action.targets, "守护", "守护", "guard", (targetSeatId) => ({ type: "guardAction", targetSeatId }));
    } else if (action.type === "vote") {
      addTargets(action.targets, "投票", "投票", "vote", (targetSeatId) => ({ type: "vote", targetSeatId }));
    } else if (action.type === "sheriffVote") {
      addTargets(action.targets, "警长票", "警长票", "sheriff", (targetSeatId) => ({ type: "sheriffVote", targetSeatId }));
    } else if (action.type === "sheriffHandoff") {
      addTargets(action.targets, "移交", "移交", "sheriff", (targetSeatId) => ({ type: "sheriffHandoff", targetSeatId }));
    } else if (action.type === "knightDuel") {
      addTargets(action.targets, "决斗", "决斗", "knight", (targetSeatId) => ({ type: "knightDuel", targetSeatId }));
    } else if (action.type === "hunterShoot") {
      addTargets(action.targets, "带走", "带走", "danger", (targetSeatId) => ({ type: "hunterShoot", targetSeatId }));
    } else if (action.type === "wolfKingShoot") {
      addTargets(action.targets, "开枪", "开枪", "danger", (targetSeatId) => ({ type: "wolfKingShoot", targetSeatId }));
    } else if (action.type === "whiteWolfKingExplode") {
      addTargets(action.targets, "自爆带走", "带走", "danger", (targetSeatId) => ({ type: "whiteWolfKingExplode", targetSeatId }));
    }
  }

  return actions;
}

function hasOnlyAvatarTargetActions(game: HumanGameView): boolean {
  if (game.availableActions.length === 0) return false;
  return game.availableActions.every((action) => {
    if (action.type === "wolfKill" || action.type === "seerCheck" || action.type === "whiteWolfKingExplode") {
      return action.targets.length > 0;
    }
    if (action.type === "wolfBeautyCharm" || action.type === "guardAction" || action.type === "knightDuel") {
      return action.targets.length > 0 && !action.canSkip;
    }
    if (action.type === "vote" || action.type === "sheriffVote") {
      return action.targets.length > 0 && !action.canAbstain;
    }
    if (action.type === "sheriffHandoff") {
      return action.targets.length > 0 && !action.canTear;
    }
    if (action.type === "hunterShoot" || action.type === "wolfKingShoot") {
      return action.targets.length > 0 && !action.canSkip;
    }
    return false;
  });
}

function MobileCustomAvatarCardArt({ src }: { src: string }) {
  return (
    <>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(119,216,152,0.2),transparent_58%),linear-gradient(145deg,#0b2d20,#16442f_52%,#070d0a)]" />
      <span className="absolute inset-[12%] rounded-md border border-[#77d898]/22" />
      <span
        className="absolute rounded-md border border-white/12 bg-cover bg-center shadow-inner shadow-black/40"
        style={{ inset: "19% 16%", backgroundImage: `url(${src})` }}
      />
    </>
  );
}

type MobileSeatStyle = React.CSSProperties & {
  "--seat-x": number;
  "--seat-y": number;
};

function getMobileSeatStyle(layout: ReturnType<typeof getMobileSeatStageLayout>): MobileSeatStyle {
  return {
    "--seat-x": layout.left,
    "--seat-y": layout.top,
    left: `${layout.left}%`,
    top: `${layout.top}%`,
  };
}

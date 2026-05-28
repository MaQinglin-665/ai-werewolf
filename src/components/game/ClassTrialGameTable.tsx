"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { HumanGameView } from "@/game/types";
import { buildClassTrialDialogueTimeline, getClassTrialDialogueFrame } from "./classTrialDialogue";
import { getClassTrialCharacterForSeat, type ClassTrialPackCharacter, type ClassTrialPackManifest } from "./classTrialTheme";
import type { CommandPayload } from "./clientTypes";

function buildSeatCharacters(game: HumanGameView, manifest: ClassTrialPackManifest | undefined): Map<number, ClassTrialPackCharacter> {
  return new Map(game.seats.map((seat, index) => [seat.seatId, getClassTrialCharacterForSeat(index, manifest)]));
}

function getDisplaySpeakerSeatId(game: HumanGameView): number | undefined {
  return (
    game.currentSpeakerSeatId ??
    game.currentActorSeatId ??
    [...game.tableSummary.recentSpeeches].reverse().find((item) => item.speaker?.seatId)?.speaker?.seatId
  );
}

function getSpeakerCharacter(
  speakerSeatId: number | undefined,
  seatCharacters: Map<number, ClassTrialPackCharacter>,
): ClassTrialPackCharacter | undefined {
  const seatId = speakerSeatId;
  return seatId ? seatCharacters.get(seatId) : undefined;
}

function getLatestSpeakerMessage(game: HumanGameView, speakerSeatId: number | undefined): string {
  const seatId = speakerSeatId;
  const speech = [...game.tableSummary.recentSpeeches].reverse().find((item) => !seatId || item.speaker?.seatId === seatId);
  return speech?.message ?? "正在思考/准备发言。";
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
  onReturnHome,
  onSubmit,
}: {
  game: HumanGameView;
  loading: boolean;
  manifest?: ClassTrialPackManifest;
  onReturnHome: () => void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  const seatCharacters = buildSeatCharacters(game, manifest);
  const displaySpeakerSeatId = getDisplaySpeakerSeatId(game);
  const speakerCharacter = getSpeakerCharacter(displaySpeakerSeatId, seatCharacters);
  const speakerName = speakerCharacter?.displayName ?? "等待发言";
  const message = getLatestSpeakerMessage(game, displaySpeakerSeatId);
  const [animationEnabled, setAnimationEnabled] = useState(false);
  const dialogueKey = `${speakerName}\n${message}\n${animationEnabled ? "animated" : "static"}`;
  const [dialogueProgress, setDialogueProgress] = useState({ frameIndex: 0, key: dialogueKey });
  const timeline = buildClassTrialDialogueTimeline(message, { reducedMotion: !animationEnabled });
  const dialogueMode = timeline.mode;
  const dialogueFrameCount = timeline.frames.length;
  const dialogueFrameIndex =
    dialogueProgress.key === dialogueKey ? dialogueProgress.frameIndex : animationEnabled && dialogueMode !== "full" ? -1 : 0;
  const displayedMessage = getClassTrialDialogueFrame(timeline, dialogueFrameIndex);
  const continueAction = game.availableActions.find((action) => action.type === "continue");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAnimationPreference = () => setAnimationEnabled(!reducedMotionQuery.matches);
    updateAnimationPreference();
    reducedMotionQuery.addEventListener("change", updateAnimationPreference);
    return () => reducedMotionQuery.removeEventListener("change", updateAnimationPreference);
  }, []);

  useEffect(() => {
    if (!animationEnabled || dialogueMode === "full") return;
    if (dialogueFrameIndex >= dialogueFrameCount - 1) return;

    const delay = dialogueFrameIndex < 0 ? 650 : dialogueMode === "characters" ? 32 : 680;
    const timer = window.setTimeout(() => {
      setDialogueProgress({
        frameIndex: Math.min(dialogueFrameIndex + 1, dialogueFrameCount - 1),
        key: dialogueKey,
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [animationEnabled, dialogueFrameCount, dialogueFrameIndex, dialogueKey, dialogueMode]);

  return (
    <section className="class-trial-table">
      <div className="class-trial-table-background" aria-hidden="true" />
      <header className="class-trial-table-topbar">
        <div>
          <span className="class-trial-table-kicker">Local Theme</span>
          <h2>学级裁判主题局</h2>
        </div>
        <button type="button" onClick={onReturnHome} className="class-trial-table-secondary">
          返回首页
        </button>
      </header>

      <div className="class-trial-ring" aria-label="9人环形裁判席">
        {game.seats.map((seat, index) => {
          const character = seatCharacters.get(seat.seatId) ?? getClassTrialCharacterForSeat(index, manifest);

          return (
            <div
              key={seat.seatId}
              className={["class-trial-seat", seat.seatId === displaySpeakerSeatId ? "class-trial-seat-active" : ""].join(" ")}
              style={getSeatStyle(index, game.seats.length)}
            >
              {character.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={character.avatarUrl} alt="" className="class-trial-seat-avatar" aria-hidden="true" />
              )}
              <span className="class-trial-seat-name">{character.displayName}</span>
            </div>
          );
        })}
      </div>

      <section className="class-trial-info-table" aria-label="当前阶段">
        <span>{game.phaseLabel}</span>
        <strong>{speakerName} 发言中</strong>
      </section>

      <section className="class-trial-focus" aria-label="当前发言者">
        <div className="class-trial-portrait-placeholder">
          {speakerCharacter?.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={speakerCharacter.portraitUrl} alt={speakerName} className="class-trial-portrait-image" />
          ) : (
            <span>{speakerName}</span>
          )}
        </div>
        <div className="class-trial-dialogue" data-dialogue-mode={timeline.mode}>
          <h3>{speakerName}</h3>
          <p className="class-trial-dialogue-text" aria-live="polite" data-dialogue-state={dialogueFrameIndex < 0 ? "thinking" : "speaking"}>
            {displayedMessage}
          </p>
        </div>
      </section>

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

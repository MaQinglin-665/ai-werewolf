"use client";

import type * as React from "react";
import { DEATH_LABELS } from "@/game/labels";
import type { HumanGameView } from "@/game/types";
import type { AiSpeechAudioStatus, LiveAiSpeech, SeatVoiceActivity, SeatVoiceState } from "./clientTypes";
import { SpeechFeed } from "./TablePanels";
import { CustomAvatarCardArt } from "./CustomAvatarCardArt";
import { MODEL_CARD_IMAGES, getSeatCardImage, getSeatOrbitStyle } from "./viewHelpers";
import type { SeatOrbitStyle } from "./viewHelpers";

export function SeatBoard({
  game,
  liveAiSpeech,
  aiSpeechAudioStatus,
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
}) {
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  const deadCount = game.seats.length - aliveCount;
  const compactSeats = game.seats.length >= 12;
  const currentSeatId = game.currentSpeakerSeatId ?? game.currentActorSeatId;
  const activeVoice: SeatVoiceActivity | undefined = aiSpeechAudioStatus
    ? { seatId: aiSpeechAudioStatus.speaker.seatId, state: aiSpeechAudioStatus.state }
    : liveAiSpeech
      ? { seatId: liveAiSpeech.speaker.seatId, state: "generating" }
      : undefined;

  return (
    <section
      className={[
        "table-stage relative overflow-hidden rounded-[30px] border border-[#f1c76e]/25 bg-[#120b09]/70 bg-cover bg-center p-4 shadow-2xl shadow-black/45",
        compactSeats ? "lg:min-h-[820px] xl:min-h-[840px]" : "lg:min-h-[780px] xl:min-h-[820px]",
      ].join(" ")}
      data-seat-count={game.seats.length}
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(8,6,5,0.20), rgba(8,6,5,0.78)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="table-stage-light pointer-events-none absolute inset-0" />

      <div className="relative mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/20 bg-black/35 p-3 text-sm text-[#dcc9a7] lg:hidden">
        <div className="flex items-center justify-between">
          <span>{game.phaseLabel}</span>
          <span>
            存活 {aliveCount} · 出局 {deadCount}
          </span>
        </div>
      </div>

      <div
        className={[
          "table-orbit relative z-10 grid grid-cols-3 gap-3 lg:block",
          compactSeats ? "lg:min-h-[590px] xl:min-h-[610px]" : "lg:min-h-[560px] xl:min-h-[580px]",
        ].join(" ")}
      >
        <div className={["table-phase-anchor hidden lg:absolute lg:grid lg:place-items-center", compactSeats ? "lg:inset-[29%]" : "lg:inset-[21%]"].join(" ")}>
          <div
            className={[
              "table-phase-core grid w-full place-items-center border border-[#f1c76e]/30 bg-[#130d0b]/70 text-center shadow-2xl shadow-black/45 backdrop-blur-sm",
              compactSeats ? "max-w-[220px] p-4" : "max-w-[280px] p-5",
            ].join(" ")}
          >
            <div className="table-phase-copy">
              <div className="table-phase-kicker">第 {game.day} 天</div>
              <div className="table-phase-title">{game.phaseLabel}</div>
              <div className="table-phase-meta">
                {currentSeatId && <span>当前 {currentSeatId}号</span>}
                <span>存活 {aliveCount}/{game.seats.length}</span>
                {deadCount > 0 && <span>出局 {deadCount}</span>}
              </div>
            </div>
          </div>
        </div>

        {game.seats.map((seat) => (
          <SeatToken
            key={seat.seatId}
            game={game}
            seat={seat}
            activeVoice={activeVoice}
            orbitStyle={getSeatOrbitStyle(seat.seatId, game.seats.length)}
            compact={compactSeats}
          />
        ))}
      </div>

      <div className="table-speech-slot relative z-20 mt-4 lg:mt-7 xl:mt-8">
        <SpeechFeed game={game} liveAiSpeech={liveAiSpeech} variant="table" />
      </div>
    </section>
  );
}

function SeatToken({
  game,
  seat,
  activeVoice,
  orbitStyle,
  compact,
}: {
  game: HumanGameView;
  seat: HumanGameView["seats"][number];
  activeVoice?: SeatVoiceActivity;
  orbitStyle: SeatOrbitStyle;
  compact: boolean;
}) {
  const isCurrent = game.currentActorSeatId === seat.seatId;
  const isSpeaking = game.currentSpeakerSeatId === seat.seatId;
  const voiceState = activeVoice?.seatId === seat.seatId ? activeVoice.state : undefined;
  const isVoiceActive = Boolean(voiceState);
  const currentLabel = voiceState ? voiceStateLabel(voiceState) : isSpeaking ? "发言中" : isCurrent ? "行动中" : undefined;
  const cardImage = getSeatCardImage(seat);
  const isKnown = Boolean(seat.role);
  const isSheriffBadgeHolder = game.sheriff?.badgeHolder?.seatId === seat.seatId;
  const hasAiAvatar = Boolean(seat.avatarDataUrl);
  const isModelCard = seat.isAi && !hasAiAvatar && Boolean(MODEL_CARD_IMAGES[seat.personaName ?? seat.name]);
  const seatStyle = { ...orbitStyle, "--seat-index": seat.seatId - 1 } as React.CSSProperties & Record<
    "--seat-x" | "--seat-y" | "--seat-index",
    string | number
  >;

  return (
    <div
      style={seatStyle}
      className={[
        "seat-token group min-w-0",
        compact
          ? "lg:absolute lg:left-[var(--seat-x)] lg:top-[var(--seat-y)] lg:w-[128px] lg:-translate-x-1/2 lg:-translate-y-1/2 xl:w-[136px]"
          : "lg:absolute lg:left-[var(--seat-x)] lg:top-[var(--seat-y)] lg:w-[148px] lg:-translate-x-1/2 lg:-translate-y-1/2",
      ].join(" ")}
    >
      <div
        className={[
          "seat-token-shell border bg-[#180f0c]/88 shadow-xl shadow-black/35 backdrop-blur-md",
          compact ? "rounded-xl" : "rounded-2xl",
          compact ? "p-1.5" : "p-2",
          seat.alive ? "border-[#f1c76e]/28" : "border-[#8b4a3d]/55 opacity-75",
          isVoiceActive
            ? `seat-token-voice seat-token-voice-${voiceState} ring-2 ring-[#77d898]`
            : isSpeaking
              ? "ring-2 ring-[#77d898]"
              : isCurrent
                ? "ring-2 ring-[#f1d796]"
                : "",
          isVoiceActive || isSpeaking || isCurrent ? "seat-token-active" : "",
          seat.isHuman ? "bg-[#25130f]/92" : "",
        ].join(" ")}
      >
        <div
          className={
            compact
              ? "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2"
              : "flex flex-col items-center gap-2"
          }
        >
        <div
          className={[
            "relative shrink-0 overflow-hidden border bg-cover bg-center shadow-lg",
            compact ? "h-[42px] w-[31px] rounded-md" : "h-[70px] w-[48px] rounded-lg",
            seat.alive ? "border-[#f1c76e]/45" : "border-[#8b4a3d]/70 grayscale",
            hasAiAvatar ? "bg-[#0d2118]" : "",
          ].join(" ")}
          style={hasAiAvatar ? undefined : { backgroundImage: `url(${cardImage})` }}
          aria-label={
            hasAiAvatar
              ? `${seat.name}AI牌`
              : isModelCard
                ? `${seat.personaName ?? seat.name}模型牌`
                : isKnown
                  ? `${seat.roleLabel}身份牌`
                  : "未揭晓身份牌"
          }
        >
          {hasAiAvatar && <CustomAvatarCardArt src={cardImage} />}
          {!isKnown && !isModelCard && !hasAiAvatar && <div className="absolute inset-0 bg-black/10" />}
        </div>
        <div className={["min-w-0 flex-1", compact ? "text-left" : "text-center lg:w-full"].join(" ")}>
          <div className={["flex items-center", compact ? "justify-start gap-1" : "justify-center gap-2"].join(" ")}>
            <span className={["seat-number-chip rounded-full bg-black/35 py-0.5 text-[#f1d796]", compact ? "px-1.5 text-[10px]" : "px-2 text-[11px]"].join(" ")}>{seat.seatId}号</span>
            {seat.isHuman && (
              <span className={["seat-human-chip rounded-full bg-[#b74332] py-0.5 text-white", compact ? "px-1.5 text-[10px]" : "px-2 text-[11px]"].join(" ")}>我</span>
            )}
            {isSheriffBadgeHolder && (
              <span className={["rounded-full bg-[#f1c76e] py-0.5 text-[#2b1608]", compact ? "px-1.5 text-[10px]" : "px-2 text-[11px]"].join(" ")}>
                警长
              </span>
            )}
          </div>
          <div className={["flex flex-wrap items-center gap-1", compact ? "mt-1 justify-start" : "mt-2 justify-center"].join(" ")}>
            <span className={["seat-name min-w-0 truncate font-semibold text-[#f7ead5]", compact ? "max-w-[86px] text-[11px]" : "max-w-[132px] text-sm"].join(" ")}>
              {seat.name}
            </span>
            {seat.personaModelLabel && (
              <span
                className={[
                  "seat-model-label max-w-full truncate rounded-full border border-[#7da8e3]/18 bg-[#0d1623]/58 text-[#b8d6ff]",
                  compact ? "px-1 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]",
                ].join(" ")}
                title={seat.personaModelLabel}
              >
                {seat.personaModelLabel}
              </span>
            )}
          </div>
          <div className={["seat-state-row flex flex-wrap gap-1 leading-4", compact ? "mt-0.5 justify-start text-[9px]" : "mt-1 justify-center text-[11px]"].join(" ")}>
            <span className={seat.alive ? "text-[#9fe0a4]" : "text-[#ffb1a4]"}>{seat.alive ? "存活" : "出局"}</span>
            {seat.roleLabel && <span className="text-[#f1d796]">{seat.roleLabel}</span>}
            {seat.deathReason && <span className="text-[#c8b99a]">{DEATH_LABELS[seat.deathReason]}</span>}
            {currentLabel && <span className="text-[#f1d796]">{currentLabel}</span>}
          </div>
          {isVoiceActive && (
            <div className={`voice-wave voice-wave-${voiceState} mt-2 flex h-4 items-end justify-center gap-1`} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function voiceStateLabel(state: SeatVoiceState): string {
  if (state === "loading" || state === "generating") return "生成中";
  if (state === "paused") return "已暂停";
  return "播放中";
}

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { DEATH_LABELS, ROLE_LABELS } from "@/game/labels";
import { stripSpeechStageDirections } from "@/game/speechText";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type {
  AiSpeechAudioStatus,
  BoardOption,
  CommandPayload,
  HostAudioStatus,
  LiveAiSpeech,
  SeatVoiceActivity,
  SeatVoiceState,
  SpeechItem,
} from "./clientTypes";
import {
  MODEL_CARD_IMAGES,
  ROLE_CARD_IMAGES,
  formatSystemMessage,
  getSeatCardImage,
  getSeatOrbitStyle,
  seatNumber,
} from "./viewHelpers";
import type { SeatOrbitStyle } from "./viewHelpers";
import { getActionMeta } from "./ActionPanel";
import { InfoRow, SectionTitle, StatusPill } from "./PanelPrimitives";
export { ActionPanel } from "./ActionPanel";

export function RoomHeader({
  game,
  loading,
  aiSpeechAudioEnabled,
  aiSpeechAudioUnavailable,
  hostAudioEnabled,
  onNewGame,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView | null;
  loading: boolean;
  aiSpeechAudioEnabled: boolean;
  aiSpeechAudioUnavailable: boolean;
  hostAudioEnabled: boolean;
  onNewGame: () => Promise<void>;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f1c76e]/25 bg-[#130d0b]/75 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#f1c76e]/45 bg-[#2a1712] text-lg font-semibold text-[#f1c76e] shadow-inner">
          狼
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">单人 AI 狼人杀</h1>
          <p className="mt-1 text-xs text-[#cab995] sm:text-sm">
            {game ? `${game.board.name} · ${game.humanSeatId}号位 · 你是${game.myRoleLabel}` : "选择板子后随机真人座位"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {game && (
          <>
            <StatusPill tone="gold">第 {game.day} 天</StatusPill>
            <StatusPill tone={game.phase.startsWith("NIGHT") ? "blue" : "green"}>{game.phaseLabel}</StatusPill>
          </>
        )}
        <button
          type="button"
          onClick={onToggleHostAudio}
          aria-pressed={hostAudioEnabled}
          className={[
            "rounded-full border px-4 py-2 text-sm font-semibold transition",
            hostAudioEnabled
              ? "border-[#77d898]/35 bg-[#14311f]/70 text-[#a8f0b6] hover:bg-[#1d4e33]/75"
              : "border-[#f1c76e]/25 bg-black/15 text-[#f1d796] hover:bg-[#f1c76e]/10",
          ].join(" ")}
        >
          {hostAudioEnabled ? "主持音频开" : "主持音频关"}
        </button>
        <button
          type="button"
          onClick={onToggleAiSpeechAudio}
          aria-pressed={aiSpeechAudioEnabled}
          className={[
            "rounded-full border px-4 py-2 text-sm font-semibold transition",
            aiSpeechAudioEnabled && !aiSpeechAudioUnavailable
              ? "border-[#77d898]/35 bg-[#14311f]/70 text-[#a8f0b6] hover:bg-[#1d4e33]/75"
              : aiSpeechAudioUnavailable
                ? "border-[#f1c76e]/30 bg-[#261510]/70 text-[#f1d796] hover:bg-[#322014]/80"
              : "border-[#f1c76e]/25 bg-black/15 text-[#f1d796] hover:bg-[#f1c76e]/10",
          ].join(" ")}
        >
          {aiSpeechAudioUnavailable ? "AI 语音转文字" : aiSpeechAudioEnabled ? "AI 语音开" : "AI 语音关"}
        </button>
        <button
          onClick={onNewGame}
          disabled={loading}
          className="rounded-full bg-[#b74332] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#220806]/35 transition hover:bg-[#cf513d] disabled:opacity-60"
        >
          {game ? "新开一局" : "开始对局"}
        </button>
      </div>
    </header>
  );
}

export function LandingPanel({
  loading,
  boards,
  selectedBoardId,
  onSelectBoard,
  recentGameIds,
  onLoadGame,
  onStartGame,
}: {
  loading: boolean;
  boards: BoardOption[];
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  recentGameIds: string[];
  onLoadGame: (gameId: string) => Promise<void>;
  onStartGame: () => Promise<void>;
}) {
  return (
    <section className="grid flex-1 place-items-center py-8">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-h-[420px] rounded-[28px] border border-[#f1c76e]/25 bg-[#160f0d]/55 bg-cover bg-center p-5 shadow-2xl shadow-black/45 backdrop-blur-sm">
          <div className="flex h-full flex-col justify-between rounded-[22px] border border-[#f1c76e]/20 bg-gradient-to-br from-black/55 via-[#2c160f]/35 to-black/60 p-6">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-[#f1c76e]/35 bg-black/35 px-3 py-1 text-xs text-[#f1d796]">
                本地 Alpha · 规则引擎驱动
              </div>
              <h2 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">进入牌桌，和 AI 玩完一整局</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#dcc9a7]">
                先选择本局板子。9 人局保留原来的快节奏体验，12 人局加入守卫、警长竞选和警徽移交。
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {boards.map((board) => {
                  const selected = selectedBoardId === board.id;
                  return (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => onSelectBoard(board.id)}
                      className={[
                        "rounded-2xl border p-4 text-left transition",
                        selected
                          ? "border-[#f1c76e]/65 bg-[#3a2412]/80 shadow-lg shadow-black/25"
                          : "border-[#f1c76e]/20 bg-black/24 hover:border-[#f1c76e]/45 hover:bg-[#241510]/70",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold text-[#f7ead5]">{board.name}</div>
                        <span className="rounded-full border border-[#f1c76e]/25 px-2 py-0.5 text-xs text-[#f1d796]">
                          {board.seatCount} 人
                        </span>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-[#dcc9a7]">{board.roleSummary}</div>
                      <div className="mt-2 text-xs leading-5 text-[#ad9c7d]">{board.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={onStartGame}
              disabled={loading || !selectedBoardId}
              className="mt-8 w-full rounded-2xl bg-[#b74332] px-6 py-4 text-base font-semibold text-white shadow-xl shadow-black/35 transition hover:bg-[#cf513d] disabled:opacity-60 sm:w-fit"
            >
              {loading ? "创建中" : selectedBoardId ? "进入牌桌" : "先选择板子"}
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <RulesMiniCard />

          <div className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/80 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#f7ead5]">最近对局</h2>
              <span className="text-xs text-[#ad9c7d]">最多 5 局</span>
            </div>
            {recentGameIds.length === 0 ? (
              <div className="grid min-h-[170px] place-items-center rounded-2xl border border-dashed border-[#f1c76e]/25 text-center text-sm leading-6 text-[#ad9c7d]">
                暂无本地记录
              </div>
            ) : (
              <div className="grid gap-2">
                {recentGameIds.map((gameId, index) => (
                  <button
                    key={gameId}
                    onClick={() => onLoadGame(gameId)}
                    disabled={loading}
                    className="rounded-2xl border border-[#f1c76e]/20 bg-[#211410]/80 px-4 py-3 text-left transition hover:border-[#f1c76e]/45 hover:bg-[#2d1a13] disabled:opacity-60"
                  >
                    <div className="text-sm font-semibold text-[#f7ead5]">
                      {index === 0 ? "继续上一局" : "查看最近终局"}
                    </div>
                    <div className="mt-1 text-xs text-[#ad9c7d]">{gameId.slice(0, 8)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RulesMiniCard() {
  const rules = [
    "9人局保留原基础流程。",
    "12人局加入守卫、警长竞选和警徽。",
    "白天顺序发言，放逐投票可弃票。",
    "只有终局复盘显示真实身份。",
  ];

  return (
    <section className="rounded-[24px] border border-[#77d898]/22 bg-[#0f2118]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#dff4df]">板子规则</h2>
        <span className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2 py-1 text-xs text-[#a8f0b6]">
          可选择
        </span>
      </div>
      <div className="grid gap-2">
        {rules.map((rule) => (
          <div key={rule} className="rounded-2xl border border-[#77d898]/14 bg-black/18 px-3 py-2 text-xs leading-5 text-[#cdebd2]">
            {rule}
          </div>
        ))}
      </div>
    </section>
  );
}

type RoleIntro = {
  title: string;
  camp: string;
  goal: string;
  ability: string;
  tip: string;
};

export type PhaseCurtainCue = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
  durationMs: number;
  presentation?: "curtain" | "ribbon";
};

const ROLE_INTROS: Record<HumanGameView["myRole"], RoleIntro> = {
  WEREWOLF: {
    title: "狼人",
    camp: "狼人阵营",
    goal: "让所有平民出局，或让所有神职出局。",
    ability: "每晚参与选择一名玩家作为刀口。白天需要隐藏身份、制造好人焦点。",
    tip: "不要过早暴露狼队视角，发言时尽量用公开信息包装你的怀疑。",
  },
  VILLAGER: {
    title: "平民",
    camp: "好人阵营",
    goal: "找出并放逐所有狼人。",
    ability: "没有夜晚技能，只能依靠发言、投票和死亡信息推理。",
    tip: "你是闭眼视角，重点观察谁在回避逻辑、谁在强行带节奏。",
  },
  SEER: {
    title: "预言家",
    camp: "好人阵营",
    goal: "通过查验帮助好人找出狼人。",
    ability: "每晚可以查验一名玩家，得知其阵营为狼人或好人。",
    tip: "查验结果是你的核心信息。什么时候报、怎么归票，会直接影响局势。",
  },
  WITCH: {
    title: "女巫",
    camp: "好人阵营",
    goal: "利用药品保护关键好人，并找机会毒杀狼人。",
    ability: "拥有一瓶解药和一瓶毒药。每晚最多使用一瓶药。",
    tip: "药品很珍贵。先听发言，再决定是否公开自己的判断。",
  },
  HUNTER: {
    title: "猎人",
    camp: "好人阵营",
    goal: "用发言和最后一枪帮助好人扩大优势。",
    ability: "被狼人击杀或白天放逐时，可以开枪带走一名玩家；被毒死不能开枪。",
    tip: "你有威慑力，但不必一开始亮身份。把枪口留给最值得怀疑的人。",
  },
  GUARD: {
    title: "守卫",
    camp: "好人阵营",
    goal: "保护关键好人，并协助放逐所有狼人。",
    ability: "每晚可以守护一名玩家，也可以空守；不能连续两晚守护同一名玩家。",
    tip: "守护节奏很重要。不要轻易暴露守护目标，尤其注意同守同救的风险。",
  },
};

export function RoleIntroOverlay({ game, onEnter }: { game: HumanGameView; onEnter: () => void }) {
  const intro = ROLE_INTROS[game.myRole];
  const teammates = game.wolfTeammates.map((seat) => seat.name).join("、");

  return (
    <div className="role-intro-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/86 px-4 py-6 backdrop-blur-md">
      <section className="mx-auto grid w-full max-w-5xl gap-6 rounded-[30px] border border-[#f1c76e]/30 bg-[#120c0a]/95 p-4 shadow-2xl shadow-black/70 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex min-h-[500px] flex-col items-center justify-start rounded-[24px] border border-[#f1c76e]/18 bg-black/28 p-5 sm:p-6">
          <div className="role-card-scene mt-1">
            <Image
              fill
              sizes="240px"
              className="role-card-shadow-card rounded-[18px] border border-[#f1c76e]/22 object-cover"
              src={ROLE_CARD_IMAGES.HIDDEN}
              alt=""
              aria-hidden="true"
            />
            <Image
              fill
              priority
              sizes="240px"
              className="role-card-reveal rounded-[18px] border border-[#f1c76e]/60 object-contain shadow-2xl"
              src={ROLE_CARD_IMAGES[game.myRole]}
              alt={`${intro.title}身份牌`}
            />
          </div>
          <div className="mt-6 text-center">
            <div className="text-xs uppercase tracking-[0.28em] text-[#ad9c7d]">Your Role</div>
            <div className="mt-2 text-3xl font-semibold text-[#f1d796]">{intro.title}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-[#f1c76e]/25 bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">
              身份已发放
            </div>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#f7ead5] sm:text-4xl">
              你是 {intro.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dcc9a7]">
              记住你的身份和胜利目标。确认后进入牌桌，系统会以主持人节奏自动推进到你需要行动的时刻。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <RoleIntroItem label="阵营" value={intro.camp} />
            <RoleIntroItem label="胜利目标" value={intro.goal} />
            <RoleIntroItem label="能力" value={intro.ability} />
            <RoleIntroItem label="发言建议" value={intro.tip} />
            {teammates && <RoleIntroItem label="狼队友" value={teammates} />}
          </div>

          <button
            onClick={onEnter}
            className="min-h-12 rounded-full bg-[#b74332] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-black/35 transition hover:bg-[#cf513d]"
          >
            确认身份，进入游戏
          </button>
        </div>
      </section>
    </div>
  );
}

function RoleIntroItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#f1c76e]/16 bg-black/24 px-4 py-3">
      <div className="mb-1 text-xs text-[#ad9c7d]">{label}</div>
      <div className="text-sm leading-6 text-[#f7ead5]">{value}</div>
    </div>
  );
}

export function PhaseCurtain({ cue }: { cue: PhaseCurtainCue }) {
  if (cue.presentation === "ribbon") {
    return (
      <div
        className={`${phaseCurtainToneClass(cue.tone)} phase-signal pointer-events-none fixed left-3 right-3 top-[72px] z-40 sm:left-6 sm:right-auto sm:top-[78px] lg:left-8`}
        style={{ "--curtain-duration": `${cue.durationMs}ms` } as React.CSSProperties}
      >
        <div className="phase-signal-card flex w-full max-w-[320px] items-center gap-3 rounded-xl border px-3 py-2.5 shadow-xl shadow-black/35 sm:w-[320px]">
          <div className="phase-signal-mark grid h-9 w-9 shrink-0 place-items-center rounded-full border" aria-hidden="true">
            <span className="phase-signal-mark-core h-2.5 w-2.5 rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="phase-signal-eyebrow text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">
              {cue.eyebrow}
            </div>
            <div className="phase-signal-title mt-0.5 text-sm font-semibold leading-tight text-white sm:text-base">
              {cue.title}
            </div>
            <div className="phase-signal-subtitle mt-0.5 text-xs leading-5 text-white/60">{cue.subtitle}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${phaseCurtainToneClass(cue.tone)} phase-curtain pointer-events-none fixed inset-0 z-40 overflow-hidden`}
      style={{ "--curtain-duration": `${cue.durationMs}ms` } as React.CSSProperties}
    >
      <div className="phase-curtain-bg" aria-hidden="true" />
      <div className="phase-curtain-vignette" aria-hidden="true" />
      <div className="phase-curtain-table-ring" aria-hidden="true" />
      <div className="phase-curtain-panel phase-curtain-panel-top" aria-hidden="true" />
      <div className="phase-curtain-panel phase-curtain-panel-bottom" aria-hidden="true" />
      <div className="phase-curtain-sweep" aria-hidden="true" />

      <div className="phase-curtain-stage mx-auto flex h-full w-full max-w-[1500px] items-end px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-20">
        <div className="phase-curtain-copy max-w-3xl">
          <div className="phase-curtain-eyebrow text-sm font-semibold text-white/62">{cue.eyebrow}</div>
          <div className="phase-curtain-title mt-3 text-5xl font-semibold leading-none text-white sm:text-7xl">
            {cue.title}
          </div>
          <div className="phase-curtain-subtitle mt-5 max-w-xl text-base leading-7 text-white/74 sm:text-lg">
            {cue.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

export function getPhaseCurtainCue(game: HumanGameView): PhaseCurtainCue {
  switch (game.phase) {
    case "NIGHT_WOLVES":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "天黑请闭眼",
        subtitle: "狼人请睁眼，选择今晚的刀口。",
        tone: "night",
        durationMs: 1650,
      };
    case "NIGHT_SEER":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "预言家请睁眼",
        subtitle: "选择一名玩家查验身份。",
        tone: "night",
        durationMs: 900,
        presentation: "ribbon",
      };
    case "NIGHT_WITCH":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "女巫请睁眼",
        subtitle: "确认刀口，决定是否使用药品。",
        tone: "night",
        durationMs: 900,
        presentation: "ribbon",
      };
    case "DAY_ANNOUNCEMENT":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "天亮了",
        subtitle: "主持人公布昨夜情况。",
        tone: "day",
        durationMs: 1650,
      };
    case "DAY_SPEECH":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "开始发言",
        subtitle: "存活玩家按座位顺序依次发言。",
        tone: "day",
        durationMs: 1450,
      };
    case "DAY_VOTE":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "开始投票",
        subtitle: "投票过程保密，结束后统一开票。",
        tone: "vote",
        durationMs: 1450,
      };
    case "EXILE_RESOLUTION":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "公布票数",
        subtitle: "结算今日放逐结果。",
        tone: "vote",
        durationMs: 1550,
      };
    case "LAST_WORDS":
      return {
        eyebrow: `第 ${game.day} 天`,
        title: "请发表遗言",
        subtitle: "出局玩家留下最后一段公开信息。",
        tone: "danger",
        durationMs: 1200,
        presentation: "ribbon",
      };
    case "HUNTER_SHOT":
      return {
        eyebrow: "猎人阶段",
        title: "猎人请行动",
        subtitle: "选择是否发动最后一枪。",
        tone: "danger",
        durationMs: 1450,
      };
    case "GAME_OVER":
      return {
        eyebrow: "终局",
        title: "游戏结束",
        subtitle: game.result?.reason ?? "查看复盘了解关键节点。",
        tone: "end",
        durationMs: 1800,
      };
    default:
      return {
        eyebrow: "准备",
        title: "准备开局",
        subtitle: "正在生成本局身份。",
        tone: "day",
        durationMs: 1200,
      };
  }
}

function phaseCurtainToneClass(tone: PhaseCurtainCue["tone"]): string {
  const tones = {
    night: "phase-curtain-night",
    day: "phase-curtain-day",
    vote: "phase-curtain-vote",
    danger: "phase-curtain-danger",
    end: "phase-curtain-end",
  };
  return tones[tone];
}

export function PhaseRhythm({ game }: { game: HumanGameView }) {
  const steps = game.tableSummary.phaseSteps;
  const currentIndex = Math.max(
    steps.findIndex((step) => step.status === "current"),
    0,
  );
  const progressWidth = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <section
      key={`${game.id}-${game.day}-${game.phase}-rhythm`}
      className="phase-rhythm-panel rounded-[22px] border border-[#f1c76e]/20 bg-[#130d0b]/72 px-3 py-3 shadow-xl shadow-black/25 backdrop-blur-md"
    >
      <div className="phase-rhythm-track" aria-hidden="true">
        <div className="phase-rhythm-progress" style={{ width: `${progressWidth}%` }} />
      </div>
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className={`phase-step phase-step-${step.status} min-w-0`} style={{ animationDelay: `${index * 55}ms` }}>
            <div className="flex items-center gap-2">
              <div
                className={[
                  "phase-step-dot grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  step.status === "done"
                    ? "border-[#77d898]/35 bg-[#1d4e33]/70 text-[#a8f0b6]"
                    : step.status === "current"
                      ? "border-[#f1c76e]/65 bg-[#4a2d12] text-[#f1d796] shadow-lg shadow-[#f1c76e]/10"
                      : "border-[#f1c76e]/18 bg-black/25 text-[#8f8065]",
                ].join(" ")}
              >
                {index + 1}
              </div>
              {index < game.tableSummary.phaseSteps.length - 1 && (
                <div
                  className={[
                    "phase-step-connector hidden h-px flex-1 sm:block",
                    step.status === "done" ? "bg-[#77d898]/35" : "bg-[#f1c76e]/15",
                  ].join(" ")}
                />
              )}
            </div>
            <div
              className={[
                "mt-2 truncate text-xs",
                step.status === "current" ? "font-semibold text-[#f1d796]" : step.status === "done" ? "text-[#a8f0b6]" : "text-[#8f8065]",
              ].join(" ")}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type HostCue = {
  badge: string;
  title: string;
  line: string;
  detail: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
};

export function HostStage({ game }: { game: HumanGameView }) {
  const cue = getHostCue(game);
  const action = game.availableActions[0];
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;

  return (
    <section
      key={`${game.id}-${game.day}-${game.phase}-${game.currentActorSeatId ?? "host"}`}
      className={`${hostToneClass(cue.tone)} flow-panel overflow-hidden rounded-[26px] border p-4 shadow-2xl shadow-black/35 backdrop-blur-md`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-black/24 px-3 py-1 text-xs font-semibold text-white/82">
              主持人
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/70">
              {cue.badge}
            </span>
            {currentActor && (
              <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-xs text-white/72">
                当前：{currentActor.seatId}号
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{cue.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/78">{cue.line}</p>
          <p className="mt-1 text-xs leading-5 text-white/56">{cue.detail}</p>
        </div>

        <div className="flow-detail-card rounded-2xl border border-white/12 bg-black/20 p-3">
          <HostStageDetail game={game} action={action} />
        </div>
      </div>
    </section>
  );
}

function HostStageDetail({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
  if (game.phase.startsWith("NIGHT")) {
    return <NightRoleTrack phase={game.phase} />;
  }

  if (game.phase === "DAY_SPEECH") {
    return <SpeechOrderStrip game={game} />;
  }

  if (game.phase === "DAY_VOTE") {
    return <VotePrivacyStrip game={game} action={action} />;
  }

  if (game.phase.startsWith("SHERIFF")) {
    return <SheriffStatusStrip game={game} />;
  }

  if (game.phase === "EXILE_RESOLUTION") {
    return <VoteRevealStrip game={game} />;
  }

  if (game.phase === "LAST_WORDS") {
    const speaker = game.currentActorSeatId ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId) : undefined;
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Last Words</div>
        <div>{speaker ? `${speaker.seatId}号${speaker.isHuman ? "（你）" : ""}发表遗言。` : "等待出局玩家发表遗言。"}</div>
      </div>
    );
  }

  if (game.phase === "DAY_ANNOUNCEMENT") {
    const latestAnnouncement = [...game.publicEvents]
      .reverse()
      .find((event) => event.day === game.day && event.phase === "DAY_ANNOUNCEMENT");
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Dawn Report</div>
        <div>{formatSystemMessage(game, latestAnnouncement?.message ?? "等待公布昨夜死亡情况。")}</div>
      </div>
    );
  }

  if (game.phase === "HUNTER_SHOT") {
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Hunter Window</div>
        <div>猎人进入最后行动窗口，结算完成后继续进入白天或终局。</div>
      </div>
    );
  }

  if (game.phase === "SHERIFF_HANDOFF") {
    const holder = game.sheriff?.badgeHolder;
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Sheriff Badge</div>
        <div>{holder ? `${holder.seatId}号警长出局，等待移交或撕毁警徽。` : "等待警徽结算。"}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm leading-6 text-white/75">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Result</div>
      <div>{game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：${game.result.reason}` : "流程继续推进。"}</div>
    </div>
  );
}

function NightRoleTrack({ phase }: { phase: HumanGameView["phase"] }) {
  const steps = [
    { phase: "NIGHT_WOLVES", label: "狼人睁眼", detail: "选择今晚刀口" },
    { phase: "NIGHT_GUARD", label: "守卫睁眼", detail: "选择守护目标" },
    { phase: "NIGHT_SEER", label: "预言家睁眼", detail: "查验一名玩家" },
    { phase: "NIGHT_WITCH", label: "女巫睁眼", detail: "决定是否用药" },
  ] as const;
  const currentIndex = steps.findIndex((step) => step.phase === phase);

  return (
    <div className="grid gap-3">
      {steps.map((step, index) => {
        const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <div
            key={step.phase}
            style={{ animationDelay: `${index * 65}ms` }}
            className={[
              "flow-track-item flex items-center justify-between gap-3 rounded-2xl border px-3 py-2",
              status === "done"
                ? "border-[#77d898]/25 bg-[#153421]/50 text-[#c9f6d0]"
                : status === "current"
                  ? "flow-track-current border-[#7da8e3]/40 bg-[#132942]/70 text-[#d8e6f7]"
                  : "border-white/10 bg-black/18 text-white/45",
            ].join(" ")}
          >
            <div>
              <div className="text-sm font-semibold">{step.label}</div>
              <div className="mt-0.5 text-xs opacity-70">{step.detail}</div>
            </div>
            <span className="text-xs">{status === "done" ? "已完成" : status === "current" ? "进行中" : "等待"}</span>
          </div>
        );
      })}
    </div>
  );
}

function SpeechOrderStrip({ game }: { game: HumanGameView }) {
  const spokenSeatIds = new Set(
    game.publicEvents
      .filter((event) => event.day === game.day && event.phase === "DAY_SPEECH" && typeof event.actorSeatId === "number")
      .map((event) => event.actorSeatId),
  );
  const aliveSeats = game.seats.filter((seat) => seat.alive);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-white/58">
        <span>本轮发言顺序</span>
        <span>
          已发言 {spokenSeatIds.size}/{aliveSeats.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {aliveSeats.map((seat) => {
          const isCurrent = game.currentSpeakerSeatId === seat.seatId;
          const hasSpoken = spokenSeatIds.has(seat.seatId);
          return (
            <span
              key={seat.seatId}
              style={{ animationDelay: `${seat.seatId * 22}ms` }}
              className={[
                "rounded-full border px-3 py-1 text-xs transition-all duration-500 ease-out",
                isCurrent
                  ? "flow-current-pill border-[#f1c76e]/55 bg-[#4a2d12]/80 text-[#f1d796]"
                  : hasSpoken
                    ? "flow-done-pill border-[#77d898]/25 bg-[#153421]/55 text-[#a8f0b6]"
                    : "border-white/10 bg-black/20 text-white/50",
              ].join(" ")}
            >
              {seat.seatId}号{seat.isHuman ? " 你" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function VotePrivacyStrip({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
  const isHumanVote = action?.type === "vote";
  const aliveSeats = game.seats.filter((seat) => seat.alive);

  return (
    <div className="grid gap-3 text-sm leading-6 text-white/75">
      <div className="vote-sealed-card rounded-2xl border border-[#e46d55]/25 bg-[#351210]/45 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[#ffd8cf]">投票箱封存中</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-xs text-white/62">
            {isHumanVote ? "等待你锁票" : `${aliveSeats.length} 人同时锁票`}
          </span>
        </div>
        <div className="mt-1 text-xs text-[#ffd8cf]/68">票型和投票对象全部保密，结束后统一开票。</div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {aliveSeats.map((seat, index) => (
          <span
            key={seat.seatId}
            style={{ animationDelay: `${index * 70}ms` }}
            className="vote-sealed-chip rounded-full border border-white/10 bg-black/20 px-2 py-1 text-center text-xs text-white/62"
          >
            {seat.seatId}号
          </span>
        ))}
      </div>
    </div>
  );
}

function VoteRevealStrip({ game }: { game: HumanGameView }) {
  const snapshot = game.tableSummary.voteSnapshot;
  const tally = snapshot.tally;
  const maxVotes = tally[0]?.count ?? 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Final Tally</div>
        <span className="rounded-full border border-[#e46d55]/25 bg-[#351210]/45 px-2 py-0.5 text-xs text-[#ffd8cf]/70">
          统一开票
        </span>
      </div>
      {snapshot.revealed && <VoteResultBanner snapshot={snapshot} compact />}
      {tally.length === 0 ? (
        <div className="text-sm text-white/65">等待公开投票结果。</div>
      ) : (
        tally.map((item, index) => (
          <div
            key={item.target.seatId}
            className={[
              "flow-vote-row vote-reveal-card rounded-2xl border px-3 py-2 text-sm text-[#ffd8cf]",
              index === 0 ? "border-[#ff9a6b]/34 bg-[#351210]/64" : "border-[#e46d55]/20 bg-black/20",
            ].join(" ")}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{item.target.seatId}号</span>
              <strong>{item.count} 票</strong>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
              <div
                className="vote-reveal-bar h-full rounded-full bg-[#e46d55]"
                style={{ width: `${maxVotes > 0 ? Math.max(12, (item.count / maxVotes) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))
      )}
      {snapshot.revealed && <VoteRevealLedger snapshot={snapshot} compact />}
    </div>
  );
}

function SheriffStatusStrip({ game }: { game: HumanGameView }) {
  const sheriff = game.sheriff;
  const candidates = sheriff?.pkCandidates ?? sheriff?.candidates ?? [];
  return (
    <div className="grid gap-3 text-sm leading-6 text-white/75">
      <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[#f1d796]">警长流程</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-xs text-white/62">
            {sheriff?.badgeHolder ? `${sheriff.badgeHolder.seatId}号警长` : "竞选中"}
          </span>
        </div>
        <div className="mt-1 text-xs text-[#f1d796]/72">{game.phaseLabel}</div>
      </div>
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <span key={candidate.seatId} className="rounded-full border border-[#f1c76e]/20 bg-black/20 px-3 py-1 text-xs text-[#f1d796]">
              {candidate.seatId}号候选
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getHostCue(game: HumanGameView): HostCue {
  switch (game.phase) {
    case "NIGHT_WOLVES":
      return {
        badge: `第 ${game.day} 夜`,
        title: "天黑请闭眼",
        line: "狼人请睁眼，选择今晚的击杀目标。其他身份暂时闭眼等待。",
        detail: "如果轮到 AI，点击继续会播放下一步；如果你是狼人，则直接选择刀口。",
        tone: "night",
      };
    case "NIGHT_GUARD":
      return {
        badge: `第 ${game.day} 夜`,
        title: "守卫请睁眼",
        line: "守卫选择今晚的守护目标，也可以空守。",
        detail: "守卫不能连续两晚守同一名玩家；同守同救同一刀口会导致目标死亡。",
        tone: "night",
      };
    case "NIGHT_SEER":
      return {
        badge: `第 ${game.day} 夜`,
        title: "预言家请睁眼",
        line: "预言家选择一名玩家查验身份，查验结果只进入预言家的私密信息。",
        detail: "这一阶段不会公开查验对象和结果。",
        tone: "night",
      };
    case "NIGHT_WITCH":
      return {
        badge: `第 ${game.day} 夜`,
        title: "女巫请睁眼",
        line: "女巫确认昨夜刀口，并决定是否使用解药或毒药。",
        detail: "每晚最多使用一瓶药，药品用完后不会再次出现对应操作。",
        tone: "night",
      };
    case "DAY_ANNOUNCEMENT":
      return {
        badge: `第 ${game.day} 天`,
        title: "天亮了",
        line: "主持人公布昨夜死亡情况，随后进入白天发言。",
        detail: "死亡信息公开，身份仍然只在终局复盘揭晓。",
        tone: "day",
      };
    case "SHERIFF_NOMINATION":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长竞选开始",
        line: "所有存活玩家依次选择是否上警。",
        detail: "上警玩家稍后发表竞选发言，警下玩家参与警长投票。",
        tone: "day",
      };
    case "SHERIFF_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "警上发言",
        line: "警上候选人依次发表竞选发言。",
        detail: "发言结束后候选人可以选择退水或留在警上。",
        tone: "day",
      };
    case "SHERIFF_WITHDRAWAL":
      return {
        badge: `第 ${game.day} 天`,
        title: "退水选择",
        line: "警上候选人依次选择是否退水。",
        detail: "剩余候选人进入警长投票；如果只剩一人则直接当选。",
        tone: "day",
      };
    case "SHERIFF_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "警下投票",
        line: "警下玩家投票选出警长。",
        detail: "平票会进入一次 PK 发言和复投，复平则本局无警长。",
        tone: "vote",
      };
    case "SHERIFF_PK_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长 PK 发言",
        line: "平票候选人进行 PK 发言。",
        detail: "发言结束后进入警长 PK 复投。",
        tone: "day",
      };
    case "SHERIFF_PK_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长 PK 投票",
        line: "非 PK 玩家在平票候选人中复投。",
        detail: "复投仍平票则本局无警长。",
        tone: "vote",
      };
    case "DAY_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "按座位顺序发言",
        line: "所有存活玩家依次发言。发言结束后才进入投票。",
        detail: "AI 只读取公开信息和自己的私密信息，不能看到完整身份表。",
        tone: "day",
      };
    case "DAY_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "开始投票",
        line: "所有存活玩家投票放逐一名玩家。投票结束前，票型和投票对象全部保密。",
        detail: "结束后只公布每名候选人的得票数，再结算放逐或平票。",
        tone: "vote",
      };
    case "EXILE_RESOLUTION":
      return {
        badge: `第 ${game.day} 天`,
        title: "公布投票结果",
        line: "主持人公开最终票数，并结算今日放逐结果。",
        detail: "这里不会展示个人投票理由，避免复盘之外的信息影响过程体验。",
        tone: "vote",
      };
    case "LAST_WORDS":
      return {
        badge: `第 ${game.day} 天`,
        title: "遗言时间",
        line: "出局玩家发表最后一段公开发言，随后继续结算猎人或夜晚流程。",
        detail: "遗言会进入公开发言席，也会影响后续玩家的桌面判断。",
        tone: "danger",
      };
    case "HUNTER_SHOT":
      return {
        badge: `第 ${game.day} 天`,
        title: "猎人行动窗口",
        line: "猎人出局后可以选择是否开枪带走一名玩家。",
        detail: "如果猎人被女巫毒死，则不会触发开枪。",
        tone: "danger",
      };
    case "SHERIFF_HANDOFF":
      return {
        badge: `第 ${game.day} 天`,
        title: "警徽移交",
        line: "警长出局后选择移交警徽或撕掉警徽。",
        detail: "警徽持有者白天放逐投票计 1.5 票。",
        tone: "danger",
      };
    case "GAME_OVER":
      return {
        badge: "终局",
        title: "游戏结束",
        line: game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜。` : "对局已经结束。",
        detail: game.result?.reason ?? "可以查看复盘了解关键节点。",
        tone: "end",
      };
    default:
      return {
        badge: "准备",
        title: "准备开局",
        line: "正在创建本局座位和身份。",
        detail: "规则引擎会先生成事件，再投影出当前玩家视角。",
        tone: "day",
      };
  }
}

function hostToneClass(tone: HostCue["tone"]): string {
  const tones = {
    night: "border-[#6d93d4]/28 bg-[#0c1424]/82",
    day: "border-[#f1c76e]/26 bg-[#1c150e]/82",
    vote: "border-[#e46d55]/28 bg-[#2a1110]/84",
    danger: "border-[#ff9a6b]/30 bg-[#30140d]/86",
    end: "border-[#77d898]/28 bg-[#0f2118]/84",
  };
  return tones[tone];
}

export function FlowStatusBar({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  onPauseAiSpeechAudio,
  onResumeAiSpeechAudio,
  onSkipAiSpeechAudio,
  onToggleAiSpeechAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  onPauseAiSpeechAudio: () => void;
  onResumeAiSpeechAudio: () => void;
  onSkipAiSpeechAudio: () => void;
  onToggleAiSpeechAudio: () => void;
}) {
  const status = getFlowStatus(
    game,
    loading,
    pendingCommandType,
    liveAiSpeech,
    hostAudioStatus,
    aiSpeechAudioStatus,
    aiSpeechAudioUnavailable,
  );
  const isPaused = aiSpeechAudioStatus?.state === "paused";
  const isLoadingSpeechAudio = aiSpeechAudioStatus?.state === "loading";
  const speechTextPreview = aiSpeechAudioStatus?.text ? stripSpeechStageDirections(aiSpeechAudioStatus.text).trim() : "";

  return (
    <section className={`${flowStatusToneClass(status.tone)} flow-status-bar rounded-[22px] border px-4 py-3 shadow-xl shadow-black/25 backdrop-blur-md`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flow-status-pulse h-2.5 w-2.5 rounded-full" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/48">System Status</span>
            {status.seatLabel && (
              <span className="rounded-full border border-white/12 bg-black/18 px-2 py-0.5 text-xs text-white/68">
                {status.seatLabel}
              </span>
            )}
          </div>
          <div className="text-base font-semibold text-white sm:text-lg">{status.title}</div>
          <div className="mt-1 text-sm leading-6 text-white/64">{status.detail}</div>
        </div>

        {aiSpeechAudioStatus && (
          <div className="grid shrink-0 gap-2 lg:min-w-[310px]">
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              <button
                type="button"
                disabled={isLoadingSpeechAudio}
                onClick={isPaused ? onResumeAiSpeechAudio : onPauseAiSpeechAudio}
                className="rounded-full border border-[#77d898]/28 bg-[#14311f]/58 px-3 py-2 text-xs font-semibold text-[#a8f0b6] transition hover:bg-[#1d4e33]/75 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isLoadingSpeechAudio ? "准备中" : isPaused ? "继续语音" : "暂停语音"}
              </button>
              <button
                type="button"
                onClick={onSkipAiSpeechAudio}
                className="rounded-full border border-[#f1c76e]/25 bg-black/18 px-3 py-2 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
              >
                跳过当前
              </button>
              <button
                type="button"
                onClick={onToggleAiSpeechAudio}
                className="rounded-full border border-white/12 bg-black/18 px-3 py-2 text-xs font-semibold text-white/68 transition hover:bg-white/8"
              >
                关闭语音
              </button>
            </div>
            {speechTextPreview && (
              <div className="line-clamp-2 rounded-2xl border border-white/10 bg-black/18 px-3 py-2 text-xs leading-5 text-white/58 lg:text-right">
                {seatNumber(aiSpeechAudioStatus.speaker)}：{speechTextPreview}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function getFlowStatus(
  game: HumanGameView,
  loading: boolean,
  pendingCommandType: CommandPayload["type"] | null,
  liveAiSpeech: LiveAiSpeech | null,
  hostAudioStatus: HostAudioStatus | null,
  aiSpeechAudioStatus: AiSpeechAudioStatus | null,
  aiSpeechAudioUnavailable: boolean,
): { title: string; detail: string; tone: "green" | "gold" | "blue" | "red"; seatLabel?: string } {
  if (liveAiSpeech) {
    return {
      title: "AI 正在生成发言",
      detail: aiSpeechAudioUnavailable
        ? "语音已自动降级为文字，流程会按发言长度留出阅读时间。"
        : liveAiSpeech.text
          ? "文字正在流式出现，语音会跟随生成并按顺序播放。"
          : "模型正在整理公开信息和自己的私有视角。",
      tone: "green",
      seatLabel: seatNumber(liveAiSpeech.speaker),
    };
  }

  if (aiSpeechAudioStatus) {
    const stateText =
      aiSpeechAudioStatus.state === "loading"
        ? "正在生成这一段 TTS"
        : aiSpeechAudioStatus.state === "paused"
          ? "AI 语音已暂停"
          : "正在播放 AI 发言";
    return {
      title: stateText,
      detail: aiSpeechAudioStatus.state === "paused" ? "继续后才会进入下一步。" : "这段说完后，系统再进入下一段强交互。",
      tone: "green",
      seatLabel: seatNumber(aiSpeechAudioStatus.speaker),
    };
  }

  if (hostAudioStatus) {
    return {
      title: "主持人正在播报",
      detail: "系统节点音频播放完成后，流程会继续推进。",
      tone: game.phase.startsWith("NIGHT") ? "blue" : game.phase === "DAY_VOTE" || game.phase === "EXILE_RESOLUTION" ? "red" : "gold",
    };
  }

  if (aiSpeechAudioUnavailable && game.phase === "DAY_SPEECH") {
    return {
      title: "AI 语音已转文字",
      detail: "TTS 暂不可用，本局不会反复请求语音；系统仍会等文字读完再推进。",
      tone: "gold",
    };
  }

  if (loading && pendingCommandType === "vote") {
    return {
      title: "你已锁票",
      detail: "正在等待其他玩家完成投票；开票前不会显示任何人的投票对象。",
      tone: "red",
    };
  }

  if (loading) {
    return {
      title: pendingCommandType === "continue" ? "正在推进流程" : "正在结算你的操作",
      detail: pendingCommandType === "continue" ? "系统正在处理下一位玩家或主持节点。" : "规则引擎正在写入结果并刷新牌桌。",
      tone: game.phase.startsWith("NIGHT") ? "blue" : "gold",
    };
  }

  const action = game.availableActions[0];
  if (action?.type === "continue") {
    return {
      title: "系统会自动播放下一步",
      detail: action.description,
      tone: game.phase.startsWith("NIGHT") ? "blue" : game.phase === "DAY_VOTE" || game.phase === "EXILE_RESOLUTION" ? "red" : "gold",
    };
  }

  if (action) {
    const meta = getActionMeta(action);
    return {
      title: meta.title,
      detail: meta.description,
      tone: action.type === "vote" ? "red" : game.phase.startsWith("NIGHT") ? "blue" : "gold",
    };
  }

  return {
    title: game.phase === "DAY_VOTE" ? "等待投票完成" : "等待流程推进",
    detail: game.phase === "DAY_VOTE" ? "票箱封存中，统一开票前只显示锁票状态。" : "当前没有需要你点击的操作。",
    tone: game.phase === "DAY_VOTE" ? "red" : "gold",
  };
}

function flowStatusToneClass(tone: "green" | "gold" | "blue" | "red"): string {
  const tones = {
    green: "border-[#77d898]/24 bg-[#0f2118]/80",
    gold: "border-[#f1c76e]/24 bg-[#1c150e]/80",
    blue: "border-[#7da8e3]/24 bg-[#0d1623]/82",
    red: "border-[#e46d55]/26 bg-[#2b1110]/82",
  };
  return tones[tone];
}

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
  const activeVoice: SeatVoiceActivity | undefined = aiSpeechAudioStatus
    ? { seatId: aiSpeechAudioStatus.speaker.seatId, state: aiSpeechAudioStatus.state }
    : liveAiSpeech
      ? { seatId: liveAiSpeech.speaker.seatId, state: "generating" }
      : undefined;

  return (
    <section
      className="relative overflow-hidden rounded-[30px] border border-[#f1c76e]/25 bg-[#120b09]/70 bg-cover bg-center p-4 shadow-2xl shadow-black/45 lg:min-h-[860px] xl:min-h-[900px]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(8,6,5,0.20), rgba(8,6,5,0.78)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(243,192,104,0.18),transparent_42%),linear-gradient(180deg,transparent,rgba(0,0,0,0.35))]" />

      <div className="relative mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/20 bg-black/35 p-3 text-sm text-[#dcc9a7] lg:hidden">
        <div className="flex items-center justify-between">
          <span>{game.phaseLabel}</span>
          <span>
            存活 {aliveCount} · 出局 {deadCount}
          </span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-3 lg:block lg:min-h-[560px] xl:min-h-[580px]">
        <div className="hidden lg:absolute lg:inset-[21%] lg:grid lg:place-items-center">
          <div className="grid aspect-square w-full max-w-[360px] place-items-center rounded-full border border-[#f1c76e]/30 bg-[#130d0b]/70 p-8 text-center shadow-2xl shadow-black/45 backdrop-blur-sm">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-[#ad9c7d]">Room Phase</div>
              <div className="mt-3 text-4xl font-semibold text-[#f1d796]">第 {game.day} 天</div>
              <div className="mt-3 text-lg text-[#f7ead5]">{game.phaseLabel}</div>
              <div className="mt-5 flex justify-center gap-2 text-xs">
                <StatusPill tone="green">存活 {aliveCount}</StatusPill>
                <StatusPill tone="red">出局 {deadCount}</StatusPill>
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
          />
        ))}
      </div>

      <div className="relative z-20 mt-4 lg:mt-7 xl:mt-8">
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
}: {
  game: HumanGameView;
  seat: HumanGameView["seats"][number];
  activeVoice?: SeatVoiceActivity;
  orbitStyle: SeatOrbitStyle;
}) {
  const isCurrent = game.currentActorSeatId === seat.seatId;
  const isSpeaking = game.currentSpeakerSeatId === seat.seatId;
  const voiceState = activeVoice?.seatId === seat.seatId ? activeVoice.state : undefined;
  const isVoiceActive = Boolean(voiceState);
  const currentLabel = voiceState ? voiceStateLabel(voiceState) : isSpeaking ? "发言中" : isCurrent ? "行动中" : undefined;
  const cardImage = getSeatCardImage(seat);
  const isKnown = Boolean(seat.role);
  const isModelCard = seat.isAi && Boolean(MODEL_CARD_IMAGES[seat.name]);
  const seatClaims = game.tableSummary.claimBoard.filter((claim) => claim.claimant.seatId === seat.seatId);

  return (
    <div
      style={orbitStyle}
      className={[
        "seat-token group min-w-0 rounded-2xl border bg-[#180f0c]/88 p-2 shadow-xl shadow-black/35 backdrop-blur-md transition-all duration-500 ease-out",
        "lg:absolute lg:left-[var(--seat-x)] lg:top-[var(--seat-y)] lg:w-[148px] lg:-translate-x-1/2 lg:-translate-y-1/2",
        seat.alive ? "border-[#f1c76e]/28" : "border-[#8b4a3d]/55 opacity-75",
        isVoiceActive ? `seat-token-voice seat-token-voice-${voiceState} ring-2 ring-[#77d898]` : isSpeaking ? "ring-2 ring-[#77d898]" : isCurrent ? "ring-2 ring-[#f1d796]" : "",
        isVoiceActive || isSpeaking || isCurrent ? "seat-token-active" : "",
        seat.isHuman ? "bg-[#25130f]/92" : "",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "relative h-[70px] w-[48px] shrink-0 overflow-hidden rounded-lg border bg-cover bg-center shadow-lg",
            seat.alive ? "border-[#f1c76e]/45" : "border-[#8b4a3d]/70 grayscale",
          ].join(" ")}
          style={{ backgroundImage: `url(${cardImage})` }}
          aria-label={isModelCard ? `${seat.name}模型牌` : isKnown ? `${seat.roleLabel}身份牌` : "未揭晓身份牌"}
        >
          {!isKnown && !isModelCard && <div className="absolute inset-0 bg-black/10" />}
        </div>
        <div className="min-w-0 flex-1 text-center lg:w-full">
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-[#f1d796]">{seat.seatId}号</span>
            {seat.isHuman && <span className="rounded-full bg-[#b74332] px-2 py-0.5 text-[11px] text-white">我</span>}
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-[#f7ead5]">{seat.name}</div>
          <div className="mt-1 flex flex-wrap justify-center gap-1 text-[11px]">
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
          {seatClaims.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {seatClaims.slice(0, 2).map((claim) => (
                <span key={claim.claimId} className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/75 px-2 py-0.5 text-[10px] text-[#a8f0b6]">
                  声称{claim.claimedRoleLabel}
                </span>
              ))}
            </div>
          )}
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

export function ReviewPanel({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <section id="review" className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1c76e]/15 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#f7ead5]">终局复盘</h2>
          <p className="mt-1 text-sm text-[#dcc9a7]">
            {review.result?.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜 · {review.result?.reason}
          </p>
        </div>
        <a
          href="#review-events"
          className="rounded-full border border-[#f1c76e]/30 px-4 py-2 text-sm text-[#f1d796] transition hover:bg-[#f1c76e]/10"
        >
          查看关键事件
        </a>
      </div>

      {review.turningPoints.length > 0 && (
        <div className="mt-4">
          <SectionTitle>关键转折</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {review.turningPoints.map((point, index) => (
              <div key={`${point.day}-${point.title}-${index}`} className="rounded-2xl border border-[#f1c76e]/18 bg-[#261510]/75 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#f1c76e]/12 px-2 py-1 text-xs text-[#f1d796]">D{point.day}</span>
                  <span className="text-xs text-[#ad9c7d]">#{index + 1}</span>
                </div>
                <div className="text-sm font-semibold text-[#f7ead5]">{point.title}</div>
                <p className="mt-2 text-xs leading-5 text-[#dcc9a7]">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {review.playerFeedback.length > 0 && <PlayerFeedbackPanel game={game} />}

      {review.voteImpacts.length > 0 && <ReviewVoteImpactPanel game={game} />}

      {(review.aiInsights.length > 0 || game.reviewDebug) && <ReviewAnalysisDrawer game={game} />}

      {review.claims.length > 0 && (
        <div className="mt-4">
          <SectionTitle>声明复盘</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.claims.map((claim) => (
              <div key={`${claim.claimant.seatId}-${claim.claimedRole}`} className="rounded-2xl border border-[#f1c76e]/18 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#f7ead5]">
                    {claim.claimant.seatId}号 · {claim.claimant.name}
                  </span>
                  <span className={claim.truthful ? "text-[#9fe0a4]" : "text-[#ff8c78]"}>
                    声称{claim.claimedRoleLabel} · 真实{claim.trueRoleLabel}
                  </span>
                </div>
                {claim.isCounterclaim && <div className="mt-2 text-xs text-[#ffd8cf]">处在对跳关系中</div>}
                {claim.checks.length > 0 && (
                  <div className="mt-2 grid gap-1 text-xs leading-5 text-[#dcc9a7]">
                    {claim.checks.map((check) => (
                      <div key={`${claim.claimant.seatId}-${check.target.seatId}-${check.claimedResult}`}>
                        报{check.target.seatId}号{check.claimedResult === "WEREWOLF" ? "查杀" : "金水"} · 终局
                        {check.accurate ? "准确" : `实际为${check.actualResult === "WEREWOLF" ? "狼人" : "好人"}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.stanceShifts.length > 0 && (
        <div className="mt-4">
          <SectionTitle>站边变化</SectionTitle>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {review.stanceShifts.map((shift) => (
              <div key={`${shift.actor.seatId}-${shift.target.seatId}-${shift.fromDay}-${shift.toDay}`} className="rounded-2xl border border-[#e46d55]/18 bg-[#2b1110]/40 p-3 text-sm text-[#ffd8cf]">
                D{shift.fromDay}→D{shift.toDay} · {shift.actor.name} 对 {shift.target.name}：
                {shift.fromKindLabel} 改为 {shift.toKindLabel}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.strategyNotes.length > 0 && (
        <div className="mt-4">
          <SectionTitle>阵营策略</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.strategyNotes.map((note, index) => (
              <div
                key={`${note.day}-${note.title}-${index}`}
                className={[
                  "rounded-2xl border p-3 text-sm",
                  note.camp === "WEREWOLVES"
                    ? "border-[#e46d55]/22 bg-[#2b1110]/42 text-[#ffd8cf]"
                    : "border-[#8fd29a]/22 bg-[#0f2118]/45 text-[#dff4df]",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#f7ead5]">{note.title}</span>
                  <span className="text-xs opacity-75">D{note.day}</span>
                </div>
                <p className="text-xs leading-5 opacity-90">{note.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <SectionTitle>身份揭晓</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {review.roleReveal.map((seat) => (
              <div key={seat.seatId} className="flex gap-3 rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm">
                <div
                  className="h-16 w-11 shrink-0 rounded-md border border-[#f1c76e]/30 bg-cover bg-center"
                  style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[seat.role]})` }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#f7ead5]">
                    {seat.seatId}号 · {seat.name}
                  </div>
                  <div className={seat.role === "WEREWOLF" ? "mt-1 text-[#ff8c78]" : "mt-1 text-[#9fe0a4]"}>
                    {seat.roleLabel}
                  </div>
                  <div className="mt-1 text-xs text-[#ad9c7d]">
                    {seat.alive ? "存活到终局" : seat.deathReason ? DEATH_LABELS[seat.deathReason] : "已出局"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>死亡时间线</SectionTitle>
          <div className="mt-3 grid gap-2">
            {review.deathTimeline.length === 0 ? (
              <p className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm text-[#ad9c7d]">没有玩家死亡。</p>
            ) : (
              review.deathTimeline.map((death, index) => (
                <div key={`${death.day}-${death.seat.seatId}-${index}`} className="rounded-2xl bg-[#261510]/85 p-3 text-sm text-[#dcc9a7]">
                  D{death.day} · {death.seat.name} · {death.reasonLabel}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReviewNightRounds game={game} />
        <ReviewDayRounds game={game} />
      </div>

      <div id="review-events" className="mt-5">
        <SectionTitle>关键事件</SectionTitle>
        <div className="mt-3 grid gap-2">
          {review.keyEvents.map((event) => (
            <div key={event.seq} className="border-l-2 border-[#f1c76e] bg-black/15 py-2 pl-3 text-sm leading-6 text-[#dcc9a7]">
              <span className="text-xs text-[#ad9c7d]">D{event.day} · {event.phase}</span>
              <br />
              {formatSystemMessage(game, event.message)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayerFeedbackPanel({ game }: { game: HumanGameView }) {
  const feedback = game.review?.playerFeedback ?? [];
  if (feedback.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionTitle>你的本局反馈</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {feedback.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className={[
              "rounded-2xl border p-3 text-sm",
              item.tone === "positive"
                ? "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]"
                : item.tone === "warning"
                  ? "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]"
                  : "border-[#f1c76e]/18 bg-black/20 text-[#dcc9a7]",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-[#f7ead5]">{item.title}</span>
              {item.day && <span className="text-xs opacity-75">D{item.day}</span>}
            </div>
            <p className="text-xs leading-5 opacity-90">{item.description}</p>
            {item.relatedSeats.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {item.relatedSeats.slice(0, 4).map((seat) => (
                  <span key={`${item.title}-${seat.seatId}`} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] opacity-85">
                    {seat.seatId}号
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewVoteImpactPanel({ game }: { game: HumanGameView }) {
  const impacts = game.review?.voteImpacts ?? [];
  if (impacts.length === 0) return null;

  return (
    <div className="mt-4">
      <SectionTitle>票型影响</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {impacts.map((impact) => {
          const targetIsWolf = impact.targetRole === "WEREWOLF";
          return (
            <div
              key={`${impact.day}-${impact.title}`}
              className={[
                "rounded-2xl border p-3 text-sm",
                impact.outcome === "tie"
                  ? "border-[#f1c76e]/22 bg-[#261510]/50 text-[#f1d796]"
                  : targetIsWolf
                    ? "border-[#8fd29a]/22 bg-[#0f2118]/48 text-[#dff4df]"
                    : "border-[#e46d55]/24 bg-[#2b1110]/45 text-[#ffd8cf]",
              ].join(" ")}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-black/22 px-2 py-1 text-xs opacity-80">D{impact.day}</span>
                  <div className="mt-2 font-semibold text-[#f7ead5]">{impact.title}</div>
                </div>
                {impact.target && impact.targetRoleLabel && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs">
                    {impact.target.seatId}号 · {impact.targetRoleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs leading-5 opacity-90">{impact.description}</p>

              {impact.leaders.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {impact.leaders.map((leader) => (
                    <span key={`${impact.day}-${leader.target.seatId}`} className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[11px] opacity-85">
                      {leader.target.seatId}号 {leader.count}票 · {leader.roleLabel}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] leading-5">
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  总票<br />
                  {impact.totalVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  好人票<br />
                  {impact.goodVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  狼票<br />
                  {impact.wolfVotes}
                </div>
                <div className="rounded-xl bg-black/18 px-2 py-1">
                  弃票<br />
                  {impact.abstainCount}
                </div>
              </div>

              {impact.decisiveVoters.length > 0 && (
                <div className="mt-3 text-xs leading-5 opacity-80">
                  关键票：{impact.decisiveVoters.map((seat) => `${seat.seatId}号`).join("、")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewAnalysisDrawer({ game }: { game: HumanGameView }) {
  const insightCount = game.review?.aiInsights.length ?? 0;
  const callCount = game.reviewDebug?.aiCalls.length ?? 0;
  const fallbackCount = game.reviewDebug?.fallbackCount ?? 0;
  const publicFactBasisCount = game.reviewDebug?.publicFactBasisCount ?? 0;

  return (
    <details className="review-debug-details mt-4 rounded-2xl border border-[#77d898]/20 bg-black/18 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#dff4df]">AI 行为解释与调试回放</div>
          <div className="mt-1 text-xs leading-5 text-[#9ecfac]">
            默认隐藏 · {insightCount} 个 AI 复盘 · {callCount} 次模型调用 · fallback {fallbackCount} · 公开依据 {publicFactBasisCount}
          </div>
        </div>
        <span className="review-debug-chevron shrink-0 rounded-full border border-[#77d898]/20 bg-[#0f2118]/70 px-3 py-1 text-xs text-[#a8f0b6]">
          展开
        </span>
      </summary>

      <div className="mt-4 grid gap-4">
        {insightCount > 0 && <AiInsightsPanel game={game} embedded />}
        {game.reviewDebug && <ReviewDebugPanel debug={game.reviewDebug} />}
      </div>
    </details>
  );
}

function AiInsightsPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
  const insights = game.review?.aiInsights ?? [];
  if (insights.length === 0) return null;

  return (
    <div className={embedded ? "" : "mt-4"}>
      <SectionTitle>AI 行为解释</SectionTitle>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.seat.seatId} className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 p-3 text-sm text-[#dff4df]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-[#f7ead5]">
                  {insight.seat.seatId}号 · {insight.seat.name}
                </div>
                <div className="mt-1 text-xs text-[#9ecfac]">
                  {insight.roleLabel}
                  {insight.personaLabel ? ` · ${insight.personaLabel}` : ""}
                </div>
              </div>
              {insight.finalFocus && (
                <span className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2 py-1 text-xs text-[#a8f0b6]">
                  焦点 {insight.finalFocus.seatId}号
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-5 text-[#ccefd3]">{insight.impact}</p>

            <div className="mt-3 grid gap-2 text-xs leading-5 text-[#b8d9bf]">
              {insight.lastVoteTarget && (
                <div>
                  最后投票：{insight.lastVoteTarget.seatId}号
                  {insight.lastVoteReason ? `，${insight.lastVoteReason}` : ""}
                </div>
              )}
              {insight.lastSpeechTarget && <div>发言施压：{insight.lastSpeechTarget.seatId}号</div>}
              {insight.suspected && <div>持续怀疑：{insight.suspected.seatId}号</div>}
              {insight.trusted && <div>相对信任：{insight.trusted.seatId}号</div>}
            </div>

            {insight.beliefSummary.length > 0 && (
              <div className="mt-3 grid gap-1">
                {insight.beliefSummary.map((line) => (
                  <div key={line} className="rounded-xl bg-black/22 px-3 py-2 text-xs leading-5 text-[#dff4df]">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDebugPanel({ debug }: { debug: NonNullable<HumanGameView["reviewDebug"]> }) {
  return (
    <div>
      <SectionTitle>模型调用回放</SectionTitle>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-[#ccefd3] sm:grid-cols-3">
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          调用 {debug.aiCalls.length} 次
        </div>
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          fallback {debug.fallbackCount} 次
        </div>
        <div className="rounded-2xl border border-[#77d898]/18 bg-[#0f2118]/38 px-3 py-2">
          公开依据 {debug.publicFactBasisCount} 条
        </div>
      </div>

      <div className="mt-2 rounded-2xl border border-[#77d898]/16 bg-black/16 px-3 py-2 text-xs leading-5 text-[#9ecfac]">
        Provider：{debug.providers.length > 0 ? debug.providers.join("、") : "unknown"}
      </div>

      <div className="review-debug-log mt-3 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
        {debug.aiCalls.map((call, index) => (
          <div key={call.id} className="rounded-2xl border border-[#77d898]/14 bg-[#07140d]/62 p-3 text-xs leading-5 text-[#dff4df]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-[#f7ead5]">
                #{index + 1} · D{call.day} · {call.seat.seatId}号 · {call.provider}
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[#ccefd3]">
                  {call.phase}
                </span>
                {call.actionType && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[#ccefd3]">
                    {formatCommandType(call.actionType)}
                  </span>
                )}
                {call.isFallback && (
                  <span className="rounded-full border border-[#e46d55]/30 bg-[#2b1110]/68 px-2 py-0.5 text-[#ffb1a4]">
                    fallback
                  </span>
                )}
              </div>
            </div>

            {call.publicFactBasis.length > 0 && (
              <div className="mt-3 grid gap-1">
                {call.publicFactBasis.slice(0, 5).map((fact) => (
                  <div key={`${call.id}-${fact}`} className="rounded-xl bg-black/24 px-3 py-2 text-[#ccefd3]">
                    {fact}
                  </div>
                ))}
                {call.publicFactBasis.length > 5 && (
                  <div className="px-3 text-[#9ecfac]">还有 {call.publicFactBasis.length - 5} 条公开依据</div>
                )}
              </div>
            )}

            {(call.error || call.validationErrors.length > 0 || call.rawOutput !== undefined) && (
              <details className="mt-3 rounded-xl border border-white/10 bg-black/18 px-3 py-2">
                <summary className="cursor-pointer text-[#9ecfac]">原始输出 / 错误</summary>
                {call.error && <div className="mt-2 text-[#ffb1a4]">{call.error}</div>}
                {call.validationErrors.length > 0 && (
                  <div className="mt-2 text-[#ffd8cf]">{call.validationErrors.join("；")}</div>
                )}
                {call.rawOutput !== undefined && <pre className="review-debug-pre mt-2">{formatDebugJson(call.rawOutput)}</pre>}
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCommandType(type: string): string {
  const labels: Record<string, string> = {
    wolfKill: "刀人",
    guardAction: "守护",
    seerCheck: "查验",
    witchAction: "用药",
    speak: "发言",
    lastWords: "遗言",
    vote: "投票",
    hunterShoot: "开枪",
    sheriffNominate: "上警",
    sheriffSpeech: "警长发言",
    sheriffWithdraw: "退水",
    sheriffVote: "警长票",
    sheriffHandoff: "警徽",
  };
  return labels[type] ?? type;
}

function formatDebugJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

function ReviewNightRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>夜晚记录</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.nightRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#5e87b9]/25 bg-[#0d1623]/55 p-3 text-sm leading-6 text-[#d8e6f7]">
            <strong>第 {round.day} 夜</strong>
            <div>狼人刀口：{round.wolfTarget?.name ?? "无"}</div>
            <div>
              查验：
              {round.seerCheck
                ? `${round.seerCheck.seer.name} 查验 ${round.seerCheck.target.name} 为 ${
                    round.seerCheck.result === "WEREWOLF" ? "狼人" : "好人"
                  }`
                : "无"}
            </div>
            <div>
              女巫：
              {round.witchAction
                ? round.witchAction.mode === "save"
                  ? `救了 ${round.witchAction.target?.name ?? "刀口"}`
                  : round.witchAction.mode === "poison"
                    ? `毒了 ${round.witchAction.target?.name ?? "未知目标"}`
                    : "未用药"
                : "无行动"}
            </div>
            <div>死亡：{round.deaths.length > 0 ? round.deaths.map((seat) => seat.name).join("、") : "平安夜"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDayRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>白天投票</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.dayRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#8fd29a]/25 bg-[#0f2118]/60 p-3 text-sm leading-6 text-[#dff4df]">
            <strong>第 {round.day} 天</strong>
            <div>发言数：{round.speechCount}</div>
            <div>
              票数：
              {round.voteTally.length > 0
                ? round.voteTally.map((item) => `${item.target.name} ${item.count}票`).join("，")
                : "无"}
            </div>
            {round.votes.length > 0 && (
              <div>
                投票解释：
                {round.votes
                  .slice(0, 4)
                  .map((vote) => `${vote.voter.name}投${vote.target?.name ?? "弃票"}${vote.reason ? `（${vote.reason}）` : ""}`)
                  .join("；")}
              </div>
            )}
            <div>
              结果：
              {round.exiled
                ? `${round.exiled.name} 被放逐`
                : round.tiedSeatIds.length > 0
                  ? `平票：${round.tiedSeatIds.join("、")}号`
                  : "无放逐"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type AuxiliaryInfoTab = "private" | "notes" | "log";

export function AuxiliaryInfoPanel({ game, events }: { game: HumanGameView; events: HumanGameView["publicEvents"] }) {
  const [activeTab, setActiveTab] = useState<AuxiliaryInfoTab>("private");
  const memory = game.tableSummary.tableMemory;
  const claimCount = memory.claimBoard.length;
  const eventCount = events.length;
  const tabs: Array<{ key: AuxiliaryInfoTab; label: string; meta: string }> = [
    { key: "private", label: "私密", meta: game.myRoleLabel },
    { key: "notes", label: "局势", meta: claimCount > 0 ? `${claimCount} 声明` : "公开线" },
    { key: "log", label: "记录", meta: eventCount > 0 ? `${eventCount} 条` : "暂无" },
  ];

  return (
    <section className="aux-info-panel overflow-hidden rounded-[24px] border border-[#f1c76e]/22 bg-[#130d0b]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="border-b border-[#f1c76e]/15 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#f7ead5]">辅助信息</h2>
          <span className="text-xs text-[#ad9c7d]">局内辅助层</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-[#f1c76e]/14 bg-black/20 p-1">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "min-w-0 rounded-full px-2 py-2 text-center text-xs transition",
                  selected
                    ? "bg-[#f1c76e]/16 text-[#f1d796] shadow-sm shadow-black/20"
                    : "text-[#ad9c7d] hover:bg-white/6 hover:text-[#f7ead5]",
                ].join(" ")}
              >
                <span className="block font-semibold">{tab.label}</span>
                <span className="mt-0.5 block truncate text-[10px] opacity-70">{tab.meta}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {activeTab === "private" && <InfoPanel game={game} embedded />}
        {activeTab === "notes" && <TableNotesPanel game={game} embedded />}
        {activeTab === "log" && <PublicLog game={game} events={events} embedded />}
      </div>
    </section>
  );
}

function TableNotesPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
  const memory = game.tableSummary.tableMemory;
  const latestVote = memory.voteHistory.at(-1);

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-[#8fd29a]/15 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#dff4df]">局势笔记</h2>
          <a href="#private-info" className="text-xs text-[#a8f0b6] underline-offset-4 hover:underline">
            我的私密信息
          </a>
        </div>
      )}
      {embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#dff4df]">局势笔记</h3>
          <span className="text-xs text-[#9ecfac]">公开辅助线</span>
        </div>
      )}
      <div className={`${embedded ? "grid gap-4 text-sm text-[#dff4df]" : "grid gap-4 p-4 text-sm text-[#dff4df]"}`}>
        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">身份声明</div>
          {memory.claimBoard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无玩家公开声称身份
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.claimBoard.slice(0, 5).map((claim) => (
                <div key={claim.claimId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#f7ead5]">
                      {claim.claimant.seatId}号 · {claim.claimant.name}
                    </span>
                    <span className="rounded-full bg-[#8fd29a]/12 px-2 py-0.5 text-xs text-[#a8f0b6]">
                      {claim.strength === "hard" ? "明确声称" : "软声明"}{claim.claimedRoleLabel}
                    </span>
                  </div>
                  {claim.checks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {claim.checks.map((check) => (
                        <span key={`${claim.claimId}-${check.day}-${check.target.seatId}-${check.result}`} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-xs text-[#dff4df]">
                          D{check.day} 报{check.target.seatId}号{check.result === "WEREWOLF" ? "查杀" : "金水"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {memory.counterclaims.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-[#9ecfac]">对跳关系</div>
            <div className="grid gap-2">
              {memory.counterclaims.map((group) => (
                <div key={group.claimedRole} className="rounded-2xl border border-[#e46d55]/20 bg-[#2b1110]/42 px-3 py-2 text-[#ffd8cf]">
                  {group.claimedRoleLabel}：{group.claimants.map((seat) => `${seat.seatId}号`).join("、")}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">站边时间线</div>
          {memory.stanceBoard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无明确站边
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.stanceBoard.slice(-5).map((stance) => (
                <div key={stance.stanceId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2 text-xs leading-5">
                  D{stance.day} · {stance.actor.seatId}号{stance.kindLabel}
                  {stance.target.seatId}号{stance.targetRoleLabel ? `的${stance.targetRoleLabel}` : ""}
                </div>
              ))}
            </div>
          )}
          {memory.stanceShifts.length > 0 && (
            <div className="mt-2 grid gap-2">
              {memory.stanceShifts.slice(-2).map((shift) => (
                <div key={`${shift.actor.seatId}-${shift.target.seatId}-${shift.toDay}`} className="rounded-2xl border border-[#e46d55]/20 bg-[#2b1110]/42 px-3 py-2 text-xs leading-5 text-[#ffd8cf]">
                  {shift.actor.seatId}号改口：{shift.fromKindLabel} → {shift.toKindLabel} {shift.target.seatId}号
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">当前焦点</div>
          {memory.focus.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无明显公开焦点
            </div>
          ) : (
            <div className="grid gap-2">
              {memory.focus.slice(0, 3).map((item) => (
                <div key={item.seat.seatId} className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.seat.seatId}号 · {item.seat.name}</span>
                    <span className="text-xs text-[#9ecfac]">{item.score}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#9ecfac]">{item.reasons.join("、")}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs text-[#9ecfac]">公开票数历史</div>
          {!latestVote || latestVote.tally.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#8fd29a]/20 px-3 py-4 text-center text-xs text-[#9ecfac]">
              暂无已公开票数
            </div>
          ) : (
            <div className="rounded-2xl border border-[#8fd29a]/18 bg-black/22 px-3 py-2 text-xs leading-5 text-[#dff4df]">
              D{latestVote.day} · {latestVote.tally.map((item) => `${item.target.seatId}号${item.count}票`).join("，")}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#8fd29a]/25 bg-[#0f2118]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      {content}
    </section>
  );
}

function InfoPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
  const content = (
    <>
      <div className={embedded ? "flex items-start gap-3" : "flex items-start gap-4"}>
        <div
          className={[
            embedded ? "h-28 w-20" : "h-36 w-24",
            "shrink-0 rounded-xl border border-[#f1c76e]/35 bg-cover bg-center shadow-xl",
          ].join(" ")}
          style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[game.myRole]})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#f7ead5]">我的身份</h2>
            {game.result && (
              <span className="rounded-full bg-[#b74332] px-2 py-1 text-xs font-medium text-white">
                {game.result.winner === "GOOD" ? "好人胜利" : "狼人胜利"}
              </span>
            )}
          </div>
          <div className="mt-2 text-3xl font-semibold text-[#f1d796]">{ROLE_LABELS[game.myRole]}</div>
          <div className="mt-3 text-xs leading-5 text-[#ad9c7d]">
            你的私密信息只在这里展示，其他 AI 身份会在终局复盘中揭晓。
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-[#dcc9a7]">
        {game.wolfTeammates.length > 0 && (
          <InfoRow label="狼队友">{game.wolfTeammates.map((seat) => seat.name).join("、")}</InfoRow>
        )}
        {game.seerChecks.length > 0 && (
          <InfoRow label="查验">
            {game.seerChecks.map((check) => (
              <div key={`${check.day}-${check.targetSeatId}`}>
                D{check.day} · {check.targetSeatId}号 · {check.result === "WEREWOLF" ? "狼人" : "好人"}
              </div>
            ))}
          </InfoRow>
        )}
        {game.myRole === "WITCH" && (
          <InfoRow label="药品">
            解药 {game.witch.antidoteAvailable ? "可用" : "已用"} · 毒药 {game.witch.poisonAvailable ? "可用" : "已用"}
          </InfoRow>
        )}
        {game.myRole === "GUARD" && (
          <InfoRow label="守卫">
            {game.guard?.lastGuardedSeatId ? `上一晚守护 ${game.guard.lastGuardedSeatId}号` : "尚未守护任何玩家"}
          </InfoRow>
        )}
        {game.sheriff?.badgeHolder && (
          <InfoRow label="警徽">{game.sheriff.badgeHolder.seatId}号持有警徽，白天放逐投票计 1.5 票</InfoRow>
        )}
        {game.privateEvents.slice(-4).map((event) => (
          <div key={event.seq} className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 px-3 py-2 text-[#dcc9a7]">
            {formatSystemMessage(game, event.message)}
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return <div id="private-info">{content}</div>;

  return (
    <section id="private-info" className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      {content}
    </section>
  );
}

function SpeechFeed({
  game,
  liveAiSpeech,
  variant = "sidebar",
}: {
  game: HumanGameView;
  liveAiSpeech: LiveAiSpeech | null;
  variant?: "sidebar" | "table";
}) {
  const speeches = game.tableSummary.recentSpeeches;
  const activeLiveAiSpeech =
    liveAiSpeech &&
    !speeches.some(
      (speech) =>
        speech.speaker?.seatId === liveAiSpeech.speaker.seatId &&
        liveAiSpeech.text &&
        speech.message.startsWith(liveAiSpeech.text),
    )
      ? liveAiSpeech
      : null;
  const currentSpeaker = game.currentSpeakerSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;
  const isTableVariant = variant === "table";
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [activeLiveAiSpeech?.text, speeches.length]);

  return (
    <section
      className={[
        "overflow-hidden rounded-[24px] border border-[#77d898]/25 bg-[#0f2118]/82 shadow-2xl shadow-black/35 backdrop-blur-md",
        isTableVariant ? "table-speech-feed" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-[#77d898]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#dff4df]">发言席</h2>
        <span className="text-xs text-[#9ecfac]">
          {currentSpeaker ? `当前：${seatNumber(currentSpeaker)}` : game.phase === "DAY_SPEECH" ? "等待发言" : "非发言阶段"}
        </span>
      </div>
      <div
        ref={scrollRef}
        className={[
          "grid gap-3 overflow-y-auto p-4",
          isTableVariant ? "max-h-[280px] lg:max-h-[260px]" : "max-h-[300px]",
        ].join(" ")}
      >
        {speeches.length === 0 && !activeLiveAiSpeech ? (
          <div className="rounded-2xl border border-dashed border-[#77d898]/20 px-3 py-6 text-center text-sm text-[#9ecfac]">
            暂无公开发言
          </div>
        ) : (
          <>
            {speeches.map((speech, index) => {
              const isHuman = speech.speaker?.seatId === game.humanSeatId;
              const startsNewDay = speeches[index - 1]?.day !== speech.day;
              const claims = speech.speaker
                ? game.tableSummary.claimBoard.filter(
                    (claim) => claim.claimant.seatId === speech.speaker?.seatId && claim.sourceSpeechSeq === speech.seq,
                  )
                : [];

              return (
                <SpeechFeedItem
                  key={`speech-day-block-${speech.seq}`}
                  claims={claims}
                  day={speech.day}
                  isHuman={isHuman}
                  isStreaming={false}
                  message={speech.message}
                  speaker={speech.speaker}
                  startsNewDay={startsNewDay && index > 0}
                />
              );
            })}
            {activeLiveAiSpeech && <LiveSpeechFeedItem liveAiSpeech={activeLiveAiSpeech} />}
          </>
        )}
      </div>
    </section>
  );
}

function SpeechFeedItem({
  claims,
  day,
  isHuman,
  isStreaming,
  message,
  speaker,
  startsNewDay,
}: {
  claims: HumanGameView["tableSummary"]["claimBoard"];
  day: number;
  isHuman: boolean;
  isStreaming: boolean;
  message: string;
  speaker: SpeechItem["speaker"];
  startsNewDay: boolean;
}) {
  return (
    <div className={["grid gap-2", startsNewDay ? "pt-3" : ""].filter(Boolean).join(" ")}>
      {startsNewDay && (
        <div className="flex items-center gap-3" aria-label={`第${day}天发言`}>
          <div className="h-px flex-1 bg-[#77d898]/16" />
          <span className="rounded-full border border-[#77d898]/22 bg-[#14311f]/72 px-3 py-1 text-[11px] font-semibold text-[#a8f0b6] shadow-sm shadow-black/20">
            第 {day} 天发言
          </span>
          <div className="h-px flex-1 bg-[#77d898]/16" />
        </div>
      )}
      <div
        className={[
          "rounded-2xl border px-3 py-2 text-sm leading-6",
          startsNewDay ? "border-t-[#77d898]/45" : "",
          isHuman ? "border-[#f1c76e]/30 bg-[#2b2110]/75 text-[#f7ead5]" : "border-[#77d898]/18 bg-black/22 text-[#dff4df]",
        ].join(" ")}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
          <span className="min-w-0">{speaker ? `${speaker.seatId}号 · ${speaker.name}` : "未知发言人"}</span>
          <span>D{day}</span>
        </div>
        {claims.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {claims.map((claim) => (
              <span key={claim.claimId} className="rounded-full border border-[#77d898]/20 bg-[#77d898]/10 px-2 py-0.5 text-[11px] text-[#a8f0b6]">
                玩家声称{claim.claimedRoleLabel}
              </span>
            ))}
          </div>
        )}
        <span>{message}</span>
        {isStreaming && <span className="speech-stream-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

function LiveSpeechFeedItem({ liveAiSpeech }: { liveAiSpeech: LiveAiSpeech }) {
  return (
    <div className="rounded-2xl border border-[#77d898]/35 bg-[#0a2a1a]/72 px-3 py-2 text-sm leading-6 text-[#dff4df] shadow-lg shadow-black/20">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
        <span className="min-w-0">
          {liveAiSpeech.speaker.seatId}号 · {liveAiSpeech.speaker.name}
        </span>
        <span>生成中</span>
      </div>
      <span>{liveAiSpeech.text || "正在组织发言..."}</span>
      <span className="speech-stream-cursor" aria-hidden="true" />
    </div>
  );
}

export function VoteTable({
  game,
  loading,
  pendingCommandType,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
}) {
  const snapshot = game.tableSummary.voteSnapshot;
  const isVoteInProgress = game.phase === "DAY_VOTE";
  const aliveSeats = game.seats.filter((seat) => seat.alive);
  const maxVotes = snapshot.tally[0]?.count ?? 0;
  const statusLabel = isVoteInProgress
    ? "票箱封存"
    : snapshot.leaders.length > 1
      ? `平票：${snapshot.leaders.map((seat) => `${seat.seatId}号`).join("、")}`
      : snapshot.leaders.length === 1
        ? `焦点：${snapshot.leaders[0].seatId}号`
        : "暂无票型";

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e46d55]/25 bg-[#2b1110]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#e46d55]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#ffd8cf]">投票台</h2>
        <span className="text-xs text-[#d9a099]">{statusLabel}</span>
      </div>

      <div className="grid gap-3 p-4">
        <div>
          <div className="mb-2 text-xs text-[#d9a099]">{snapshot.revealed ? "开票结果" : "投票状态"}</div>
          {loading && pendingCommandType === "vote" ? (
            <div className="vote-sealed-card rounded-2xl border border-[#77d898]/24 bg-[#14311f]/55 px-3 py-4">
              <div className="text-center text-sm font-semibold text-[#a8f0b6]">你已锁票</div>
              <div className="mt-1 text-center text-xs text-[#9ecfac]">等待其他玩家完成投票，开票前不显示任何人的投票对象。</div>
            </div>
          ) : isVoteInProgress ? (
            <div className="vote-sealed-card rounded-2xl border border-dashed border-[#e46d55]/22 bg-black/18 px-3 py-4">
              <div className="text-center text-sm font-semibold text-[#ffd8cf]">等待所有玩家锁票</div>
              <div className="mt-1 text-center text-xs text-[#d9a099]">票型不会实时公开，进入结算后一次性揭晓。</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {aliveSeats.map((seat, index) => (
                  <span
                    key={seat.seatId}
                    style={{ animationDelay: `${index * 64}ms` }}
                    className="vote-sealed-chip rounded-full border border-[#e46d55]/14 bg-[#351210]/42 px-2 py-1 text-center text-xs text-[#ffd8cf]/72"
                  >
                    {seat.seatId}号
                  </span>
                ))}
              </div>
            </div>
          ) : snapshot.tally.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e46d55]/20 px-3 py-5 text-center text-sm text-[#d9a099]">
              {snapshot.revealed ? "无人获得放逐票" : "还没有公开票数"}
              {snapshot.abstainCount ? `，弃票 ${snapshot.abstainCount} 票` : ""}
            </div>
          ) : (
            <div className="grid gap-2">
              <VoteResultBanner snapshot={snapshot} />
              {snapshot.tally.map((item) => (
                <div
                  key={item.target.seatId}
                  className={[
                    "vote-reveal-card rounded-2xl border px-3 py-2",
                    snapshot.leaders.some((seat) => seat.seatId === item.target.seatId)
                      ? "border-[#ff9a6b]/34 bg-[#351210]/58"
                      : "border-[#e46d55]/18 bg-black/22",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3 text-sm text-[#ffd8cf]">
                    <span>
                      {item.target.seatId}号
                    </span>
                    <strong>{item.count} 票</strong>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                    <div
                      className="vote-reveal-bar h-full rounded-full bg-[#e46d55]"
                      style={{ width: `${maxVotes > 0 ? Math.max(12, (item.count / maxVotes) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {snapshot.abstainCount ? (
                <div className="rounded-2xl border border-[#f1c76e]/18 bg-black/18 px-3 py-2 text-sm text-[#f1d796]">
                  弃票 {snapshot.abstainCount} 票
                </div>
              ) : null}
            </div>
          )}
        </div>

        {snapshot.votes.length > 0 && <VoteRevealLedger snapshot={snapshot} />}

        {game.result && game.tableSummary.aiReasonHighlights.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-[#d9a099]">局势提示</div>
            <div className="grid gap-2">
              {game.tableSummary.aiReasonHighlights.map((reason) => (
                <div key={reason} className="rounded-2xl bg-black/22 px-3 py-2 text-xs leading-5 text-[#ffd8cf]">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type VoteSnapshotView = HumanGameView["tableSummary"]["voteSnapshot"];

function VoteResultBanner({ snapshot, compact = false }: { snapshot: VoteSnapshotView; compact?: boolean }) {
  if (!snapshot.revealed) return null;

  const topVoteCount = snapshot.tally[0]?.count ?? 0;
  const bannerClass = compact
    ? "vote-result-banner rounded-xl border px-3 py-2 text-xs leading-5"
    : "vote-result-banner rounded-2xl border px-3 py-3 text-sm leading-6";

  if (topVoteCount === 0 || snapshot.leaders.length === 0) {
    return (
      <div className={`${bannerClass} border-[#f1c76e]/22 bg-black/18 text-[#f1d796]`}>
        没有有效放逐票，今日无人出局。
      </div>
    );
  }

  if (snapshot.leaders.length > 1) {
    return (
      <div className={`${bannerClass} border-[#f1c76e]/22 bg-black/18 text-[#f1d796]`}>
        最高票平票：{snapshot.leaders.map((seat) => `${seat.seatId}号`).join("、")}，本轮无人放逐。
      </div>
    );
  }

  const leader = snapshot.leaders[0];
  return (
    <div className={`${bannerClass} border-[#ff9a6b]/28 bg-[#351210]/54 text-[#ffd8cf]`}>
      最高票：{leader.seatId}号，获得 {topVoteCount} 票。
    </div>
  );
}

function VoteRevealLedger({ snapshot, compact = false }: { snapshot: VoteSnapshotView; compact?: boolean }) {
  if (!snapshot.votes.length) return null;

  return (
    <div className={compact ? "mt-1 grid gap-1.5" : "grid gap-2"}>
      <div className="flex items-center justify-between gap-3 text-xs text-[#d9a099]">
        <span>{compact ? "投向明细" : "逐票揭示"}</span>
        <span>{snapshot.votes.length} 票</span>
      </div>
      <div className={compact ? "grid gap-1.5" : "grid gap-2"}>
        {snapshot.votes.map((vote, index) => (
          <div
            key={vote.seq}
            style={{ animationDelay: `${index * 92}ms` }}
            className={[
              "vote-ledger-item flex min-h-10 items-center gap-2 rounded-2xl border border-[#e46d55]/18 bg-black/18 px-3 py-2 text-xs leading-5 text-[#ffd8cf]",
              compact ? "rounded-xl px-2.5 py-1.5" : "",
            ].join(" ")}
          >
            <span className="vote-ledger-index shrink-0 rounded-full border border-[#e46d55]/20 bg-[#351210]/62 px-2 py-0.5 text-[11px] text-[#d9a099]">
              第{index + 1}票
            </span>
            <span className="shrink-0 font-semibold">{vote.voter.seatId}号</span>
            <span className="text-[#d9a099]">→</span>
            <span className="min-w-0 font-semibold">{vote.target ? `${vote.target.seatId}号` : "弃票"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublicLog({
  game,
  events,
  embedded = false,
}: {
  game: HumanGameView;
  events: HumanGameView["publicEvents"];
  embedded?: boolean;
}) {
  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-[#f1c76e]/15 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#f7ead5]">公开记录</h2>
          <span className="text-xs text-[#ad9c7d]">夜晚 / 白天 / 投票 / 系统</span>
        </div>
      )}
      {embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#f7ead5]">公开记录</h3>
          <span className="text-xs text-[#ad9c7d]">夜晚 / 白天 / 投票</span>
        </div>
      )}
      <div className={`${embedded ? "flex max-h-[420px] flex-col gap-3 overflow-y-auto" : "flex max-h-[620px] flex-col gap-3 overflow-y-auto p-4"}`}>
        {events.map((event) => (
          <div key={event.seq} className={`${eventClassName(event.phase)} rounded-2xl border px-3 py-2 text-sm leading-6`}>
            <div className="mb-1 text-xs opacity-75">
              D{event.day} · {phaseCategory(event.phase)}
            </div>
            {formatSystemMessage(game, event.message)}
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <section className="min-h-[360px] overflow-hidden rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 shadow-2xl shadow-black/35 backdrop-blur-md">
      {content}
    </section>
  );
}

function eventClassName(phase: HumanGameView["phase"]): string {
  if (phase.startsWith("NIGHT")) return "border-[#6797d5]/25 bg-[#0d1623]/65 text-[#d8e6f7]";
  if (phase === "DAY_VOTE" || phase === "EXILE_RESOLUTION" || phase === "LAST_WORDS" || phase === "SHERIFF_HANDOFF") return "border-[#e46d55]/30 bg-[#2b1110]/70 text-[#ffd8cf]";
  if (phase.startsWith("SHERIFF")) return "border-[#f1c76e]/25 bg-[#3a2412]/65 text-[#f1d796]";
  if (phase === "DAY_SPEECH") return "border-[#77d898]/25 bg-[#0f2118]/70 text-[#dff4df]";
  return "border-[#f1c76e]/25 bg-[#261510]/65 text-[#dcc9a7]";
}

function phaseCategory(phase: HumanGameView["phase"]): string {
  if (phase.startsWith("NIGHT")) return "夜晚";
  if (phase === "DAY_SPEECH") return "白天";
  if (phase === "DAY_VOTE" || phase === "EXILE_RESOLUTION" || phase === "LAST_WORDS") return "投票";
  if (phase.startsWith("SHERIFF")) return "警长";
  return "系统";
}

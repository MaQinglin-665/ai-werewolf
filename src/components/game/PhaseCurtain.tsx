"use client";

import type * as React from "react";
import type { HumanGameView } from "@/game/types";

export type PhaseCurtainCue = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
  durationMs: number;
  presentation?: "curtain" | "ribbon" | "class-trial";
  resultLines?: string[];
};

export function PhaseCurtain({ cue }: { cue: PhaseCurtainCue }) {
  if (cue.presentation === "class-trial") {
    const resultLines = cue.resultLines?.filter(Boolean) ?? [];

    return (
      <div
        className={`${phaseCurtainToneClass(cue.tone)} class-trial-phase-scene pointer-events-none fixed inset-0 z-40 overflow-hidden`}
        style={{ "--curtain-duration": `${cue.durationMs}ms` } as React.CSSProperties}
      >
        <div className="class-trial-phase-backdrop" aria-hidden="true" />
        <div className="class-trial-phase-grid" aria-hidden="true" />
        <div className="class-trial-phase-orbit" aria-hidden="true" />
        <div className="class-trial-phase-spotlight" aria-hidden="true" />
        <div className="class-trial-phase-slasher" aria-hidden="true" />

        <div className="class-trial-phase-stage">
          <div className="class-trial-phase-copy">
            <div className="class-trial-phase-eyebrow">{cue.eyebrow}</div>
            <h2 className="class-trial-phase-title">{cue.title}</h2>
            <p className="class-trial-phase-subtitle">{cue.subtitle}</p>
            {resultLines.length > 0 && (
              <div className="class-trial-phase-verdict" aria-label="阶段结果">
                {resultLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
    case "NIGHT_WOLF_BEAUTY":
      return {
        eyebrow: `第 ${game.day} 夜`,
        title: "狼美人请睁眼",
        subtitle: "选择今晚魅惑的玩家。",
        tone: "night",
        durationMs: 950,
        presentation: "ribbon",
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
    case "KNIGHT_DUEL":
      return {
        eyebrow: "骑士阶段",
        title: "骑士决斗窗口",
        subtitle: "骑士可以选择是否发动一次决斗。",
        tone: "danger",
        durationMs: 1300,
        presentation: "ribbon",
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
    case "HUNTER_REVEAL":
      return {
        eyebrow: "出局结算",
        title: "等待结算",
        subtitle: "出局玩家正在完成后续流程。",
        tone: "danger",
        durationMs: 1300,
      };
    case "HUNTER_SHOT":
      return {
        eyebrow: "猎人阶段",
        title: "猎人请行动",
        subtitle: "猎人已翻牌，必须带走一名玩家。",
        tone: "danger",
        durationMs: 1450,
      };
    case "WOLF_KING_SHOT":
      return {
        eyebrow: "狼王阶段",
        title: "狼王请行动",
        subtitle: "选择是否发动出局枪。",
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

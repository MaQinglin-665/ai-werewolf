import type { GameResult, Phase } from "@/game/types";

export type ClassTrialThemeStep =
  | "opening"
  | "hidden-night"
  | "court"
  | "testimony"
  | "sealed-vote"
  | "vote-reveal"
  | "verdict"
  | "review";

export type ClassTrialThemeFlow = {
  step: ClassTrialThemeStep;
  label: string;
  detail: string;
  showAsTrialSurface: boolean;
  minimizeOrdinaryPhase: boolean;
};

export function shouldMinimizeClassTrialPhase(phase: Phase): boolean {
  return (
    phase === "NIGHT_WOLVES" ||
    phase === "NIGHT_WOLF_BEAUTY" ||
    phase === "NIGHT_GUARD" ||
    phase === "NIGHT_SEER" ||
    phase === "NIGHT_WITCH"
  );
}

export function getClassTrialThemeFlow(input: {
  phase: Phase;
  day: number;
  result?: GameResult;
}): ClassTrialThemeFlow {
  if (input.result || input.phase === "GAME_OVER") {
    return {
      step: "review",
      label: "审判复盘",
      detail: "本轮审判已经结束，公开复盘身份、票型和关键转折。",
      showAsTrialSurface: true,
      minimizeOrdinaryPhase: false,
    };
  }

  if (shouldMinimizeClassTrialPhase(input.phase)) {
    return {
      step: "hidden-night",
      label: "闭庭整理",
      detail: "幕后线索正在整理，裁判台等待下一轮公开证言。",
      showAsTrialSurface: false,
      minimizeOrdinaryPhase: true,
    };
  }

  switch (input.phase) {
    case "DAY_ANNOUNCEMENT":
      return {
        step: "court",
        label: `第${input.day}日 开庭`,
        detail: "公开结果进入裁判场，所有人准备开始证言。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "DAY_SPEECH":
      return {
        step: "testimony",
        label: "证言审理",
        detail: "依次发言，允许角色反应、保留不确定或指出公开矛盾。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "DAY_VOTE":
      return {
        step: "sealed-vote",
        label: "封票",
        detail: "票意锁定中，目标在开票前保持隐藏。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "EXILE_RESOLUTION":
      return {
        step: "vote-reveal",
        label: "开票揭示",
        detail: "公开票箱，确认处刑或无人处刑。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "LAST_WORDS":
    case "HUNTER_REVEAL":
    case "HUNTER_SHOT":
    case "WOLF_KING_SHOT":
    case "SHERIFF_HANDOFF":
      return {
        step: "verdict",
        label: "判决余波",
        detail: "处刑后的遗言、枪牌或警徽流转继续公开结算。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    default:
      return {
        step: "opening",
        label: "学级裁判",
        detail: "裁判场正在切换到下一段公开流程。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
  }
}

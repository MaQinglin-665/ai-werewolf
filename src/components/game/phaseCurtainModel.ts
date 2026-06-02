import type { HumanGameView } from "@/game/types";
import { getClassTrialPhaseCurtainCue } from "./classTrialPhaseScenes";
import { getPhaseCurtainCue, type PhaseCurtainCue } from "./PhaseCurtain";

const CLASS_TRIAL_OPENING_NIGHT_CURTAIN_MS = 3000;

export function getThemedPhaseCurtainCue(
  game: HumanGameView,
  options: { classTrialThemeActive: boolean },
): PhaseCurtainCue | null {
  return options.classTrialThemeActive ? getClassTrialPhaseCurtainCue(game) : getPhaseCurtainCue(game);
}

export function getClassTrialOpeningNightCurtainCue(game: Pick<HumanGameView, "day">): PhaseCurtainCue {
  return {
    eyebrow: `第 ${game.day} 夜`,
    title: "夜晚降临",
    subtitle: "天黑请闭眼，狼人行动开始。",
    tone: "night",
    presentation: "class-trial",
    durationMs: CLASS_TRIAL_OPENING_NIGHT_CURTAIN_MS,
    resultLines: ["隐藏行动只显示阶段，不公开刀口。"],
  };
}

export function shouldRenderClassTrialOpeningNightCurtain(
  game: Pick<HumanGameView, "id" | "day" | "phase">,
  options: {
    classTrialThemeActive: boolean;
    classTrialIntroPending: boolean;
    completedClassTrialIntroGameId: string | null;
    completedClassTrialOpeningNightCurtainGameId: string | null;
    roleIntroGameId: string | null;
  },
): boolean {
  if (!options.classTrialThemeActive) return false;
  if (options.classTrialIntroPending) return false;
  if (options.roleIntroGameId === game.id) return false;
  if (options.completedClassTrialIntroGameId !== game.id) return false;
  if (options.completedClassTrialOpeningNightCurtainGameId === game.id) return false;
  if (game.day !== 1) return false;
  return game.phase.startsWith("NIGHT");
}

export function shouldRenderThemedPhaseCurtain(
  game: Pick<HumanGameView, "id">,
  options: { classTrialIntroPending: boolean; roleIntroGameId: string | null },
): boolean {
  if (options.classTrialIntroPending) return false;
  if (options.roleIntroGameId === game.id) return false;
  return true;
}

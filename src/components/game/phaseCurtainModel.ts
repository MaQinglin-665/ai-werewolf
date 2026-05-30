import type { HumanGameView } from "@/game/types";
import { getClassTrialPhaseCurtainCue } from "./classTrialPhaseScenes";
import { getPhaseCurtainCue, type PhaseCurtainCue } from "./PhaseCurtain";

export function getThemedPhaseCurtainCue(
  game: HumanGameView,
  options: { classTrialThemeActive: boolean },
): PhaseCurtainCue | null {
  return options.classTrialThemeActive ? getClassTrialPhaseCurtainCue(game) : getPhaseCurtainCue(game);
}

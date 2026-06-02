import type { HumanGameView } from "@/game/types";
import { getClassTrialThemeFlow } from "./classTrialThemeFlow";
import { shouldRenderClassTrialOpeningNightCurtain, shouldRenderThemedPhaseCurtain } from "./phaseCurtainModel";

type ClassTrialFlowGame = Pick<HumanGameView, "id" | "day" | "phase">;

export type ClassTrialFlowModel = {
  roleIntroPending: boolean;
  introPending: boolean;
  openingNightCurtainPending: boolean;
  pauseAutoAdvance: boolean;
  pauseHostAudio: boolean;
  pauseAiAudio: boolean;
  pauseVoicePrewarm: boolean;
  allowThemedPhaseCurtain: boolean;
};

export function getClassTrialFlowModel(options: {
  game: ClassTrialFlowGame | null;
  classTrialThemeActive: boolean;
  classTrialIntroGameId: string | null;
  completedClassTrialIntroGameId: string | null;
  completedClassTrialOpeningNightCurtainGameId: string | null;
  roleIntroGameId: string | null;
}): ClassTrialFlowModel {
  const game = options.game;
  if (!game) {
    return {
      roleIntroPending: false,
      introPending: false,
      openingNightCurtainPending: false,
      pauseAutoAdvance: false,
      pauseHostAudio: false,
      pauseAiAudio: false,
      pauseVoicePrewarm: false,
      allowThemedPhaseCurtain: false,
    };
  }

  const themeFlow = options.classTrialThemeActive
    ? getClassTrialThemeFlow({ phase: game.phase, day: game.day })
    : undefined;
  const roleIntroPending = options.roleIntroGameId === game.id;
  const introPending = Boolean(
    options.classTrialThemeActive &&
      options.classTrialIntroGameId === game.id &&
      options.completedClassTrialIntroGameId !== game.id,
  );
  const openingNightCurtainPending = shouldRenderClassTrialOpeningNightCurtain(game, {
    classTrialThemeActive: options.classTrialThemeActive,
    classTrialIntroPending: introPending,
    completedClassTrialIntroGameId: options.completedClassTrialIntroGameId,
    completedClassTrialOpeningNightCurtainGameId: options.completedClassTrialOpeningNightCurtainGameId,
    roleIntroGameId: options.roleIntroGameId,
  });
  const pauseAutomation = roleIntroPending || introPending || openingNightCurtainPending;

  return {
    roleIntroPending,
    introPending,
    openingNightCurtainPending,
    pauseAutoAdvance: pauseAutomation,
    pauseHostAudio: pauseAutomation,
    pauseAiAudio: pauseAutomation,
    pauseVoicePrewarm: pauseAutomation,
    allowThemedPhaseCurtain:
      openingNightCurtainPending ||
      (!themeFlow?.minimizeOrdinaryPhase &&
        shouldRenderThemedPhaseCurtain(game, {
          classTrialIntroPending: introPending,
          roleIntroGameId: options.roleIntroGameId,
        })),
  };
}

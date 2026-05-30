import type { AgentView, AiCharacterRoleCard } from "@/game/types";

export const DRAMATIC_CLASS_TRIAL_HARD_BOUNDARIES = [
  "hidden-role-leak",
  "future-speech",
  "private-night-info",
  "illegal-skill-fact",
] as const;

export function isDramaticClassTrialRoleCard(
  roleCard: Pick<AiCharacterRoleCard, "theme"> | undefined,
): boolean {
  return roleCard?.theme === "class-trial";
}

export function isDramaticClassTrialView(view: Pick<AgentView, "roleCard"> | undefined): boolean {
  return isDramaticClassTrialRoleCard(view?.roleCard);
}

export function shouldUseClassTrialExpressionLeniency(view: Pick<AgentView, "roleCard"> | undefined): boolean {
  return isDramaticClassTrialView(view);
}

export function shouldRetryMainGameSmokeAttempt({ phase, submittedHumanNightAction, humanActionType }) {
  return Boolean(humanActionType) && !submittedHumanNightAction && !phase.startsWith("NIGHT");
}

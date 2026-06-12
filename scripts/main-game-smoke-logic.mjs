export function buildMainGameStreamCommandPath(gameId) {
  return `/api/games/${encodeURIComponent(gameId)}/stream-command`;
}

export function shouldRetryMainGameSmokeAttempt({ phase, submittedHumanNightAction, humanActionType }) {
  return Boolean(humanActionType) && !submittedHumanNightAction && !phase.startsWith("NIGHT");
}

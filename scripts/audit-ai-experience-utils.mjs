export function isClassifiedWolfTeamVote(log) {
  const tactic = log?.votePlan?.wolfVoteTactic;
  return tactic === "planned_distance" || tactic === "emergency_cut";
}

export function shouldWarnWolfTeamVote(log) {
  return !isClassifiedWolfTeamVote(log);
}

export function isClassifiedWolfTeamVote(log) {
  const tactic = log?.votePlan?.wolfVoteTactic;
  return tactic === "planned_distance" || tactic === "emergency_cut";
}

export function shouldWarnWolfTeamVote(log) {
  return !isClassifiedWolfTeamVote(log);
}

export function buildSeerGoldTargets(state, seerSeatId) {
  if (!seerSeatId) return [];
  return state.roleClaims
    .filter((claim) => claim.claimantSeatId === seerSeatId && claim.claimedRole === "SEER")
    .flatMap((claim) =>
      claim.checks
        .filter((check) => check.result === "GOOD")
        .map((check) => ({
          targetSeatId: check.targetSeatId,
          claimDay: check.day ?? claim.day,
        })),
    );
}

export function isProtectedSeerGoldVoteTarget(seerGoldTargets, targetSeatId, seerDeathDay, day) {
  if (!seerDeathDay || day < seerDeathDay || !targetSeatId) return false;
  return seerGoldTargets.some((item) => item.targetSeatId === targetSeatId && day >= item.claimDay);
}

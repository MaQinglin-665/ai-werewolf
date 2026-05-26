import type { AiTableRead, SeatRead, TableMemory } from "@/game/types";

export function deadSeerGoldSeatIds(tableMemory: TableMemory): Set<number> {
  const seatIds = new Set<number>();
  for (const legacy of tableMemory.seerLegacies) {
    for (const check of legacy.checks) {
      if (check.result === "GOOD") seatIds.add(check.target.seatId);
    }
  }
  return seatIds;
}

export function findDeadSeerGoldLegacyForSeat(
  tableMemory: TableMemory,
  targetSeatId: number,
): TableMemory["seerLegacies"][number] | undefined {
  return tableMemory.seerLegacies.find((legacy) =>
    legacy.checks.some((check) => check.target.seatId === targetSeatId && check.result === "GOOD"),
  );
}

export function findDeadSeerBlackLegacyForSeat(
  tableMemory: TableMemory,
  targetSeatId: number,
): TableMemory["seerLegacies"][number] | undefined {
  return tableMemory.seerLegacies.find((legacy) =>
    legacy.checks.some((check) => check.target.seatId === targetSeatId && check.result === "WEREWOLF"),
  );
}

export function isProtectedDeadSeerGoldSeat(tableRead: AiTableRead, target: SeatRead): boolean {
  if (!findDeadSeerGoldLegacyForSeat(tableRead.tableMemory, target.seatId)) return false;
  return !hasHardOverrideAgainstDeadSeerGold(tableRead, target);
}

export function hasHardOverrideAgainstDeadSeerGold(tableRead: AiTableRead, target: SeatRead): boolean {
  if (findDeadSeerBlackLegacyForSeat(tableRead.tableMemory, target.seatId)) return true;

  const blackChecks = target.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;
  const pressureActors = new Set(
    target.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  ).size;
  const pressureGap = target.suspicion - target.trust;
  const inCounterclaim = tableRead.tableMemory.counterclaims.some(
    (group) => group.claimedRole === "SEER" && group.claimants.some((claimant) => claimant.seatId === target.seatId),
  );
  const hardCue = tableRead.tableMemory.reasoningCues.some(
    (cue) =>
      cue.target?.seatId === target.seatId &&
      cue.weight === "strong" &&
      (cue.kind === "counterclaim" || cue.kind === "seer_legacy" || cue.kind === "vote"),
  );
  const voteFocus =
    tableRead.voteSnapshot.leaders.some((leader) => leader.seatId === target.seatId) ||
    Boolean(tableRead.tableMemory.voteHistory.at(-1)?.tally.some((item) => item.target.seatId === target.seatId && item.count >= 2)) ||
    target.votesReceived >= 2;

  if (blackChecks >= 2 && pressureActors >= 2 && pressureGap >= 30) return true;
  if (blackChecks >= 1 && inCounterclaim && pressureActors >= 2 && (hardCue || pressureGap >= 42)) return true;
  if (hardCue && voteFocus && pressureActors >= 2) return true;

  return false;
}

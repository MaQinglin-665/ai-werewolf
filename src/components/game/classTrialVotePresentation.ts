import { isVoteRevealCarryoverPhase } from "@/game/phaseSemantics";
import type { ActionTarget, HumanGameView } from "@/game/types";

export type ClassTrialVotePresentationState =
  | {
      variant: "sealing";
      eligibleSeatIds: number[];
      lockedSeatIds: number[];
      pendingSeatIds: number[];
    }
  | {
      variant: "reveal";
      verdict: "exile" | "no-exile";
      votes: HumanGameView["tableSummary"]["voteSnapshot"]["votes"];
      tally: HumanGameView["tableSummary"]["voteSnapshot"]["tally"];
      abstainCount: number;
      leaders: ActionTarget[];
      focusSeatId?: number;
      focusTarget?: ActionTarget;
    };

export function getClassTrialVotePresentation(game: HumanGameView): ClassTrialVotePresentationState | null {
  const snapshot = game.tableSummary.voteSnapshot;

  if (game.phase === "DAY_VOTE" && !snapshot.revealed) {
    return {
      variant: "sealing",
      eligibleSeatIds: snapshot.eligibleSeatIds ?? [],
      lockedSeatIds: snapshot.lockedSeatIds ?? [],
      pendingSeatIds: snapshot.pendingSeatIds ?? [],
    };
  }

  if (
    isVoteRevealCarryoverPhase(game.phase) &&
    snapshot.revealed &&
    hasCurrentDayVoteSnapshot(game) &&
    (snapshot.votes.length > 0 || snapshot.tally.length > 0 || snapshot.abstainCount)
  ) {
    const onlyLeader = snapshot.leaders.length === 1 ? snapshot.leaders[0] : undefined;
    const hasWinningTarget = Boolean(
      onlyLeader && snapshot.tally.some((item) => item.target.seatId === onlyLeader.seatId && item.count > 0),
    );
    const focusTarget = hasWinningTarget ? onlyLeader : undefined;

    return {
      variant: "reveal",
      verdict: focusTarget ? "exile" : "no-exile",
      votes: snapshot.votes,
      tally: snapshot.tally,
      abstainCount: snapshot.abstainCount ?? 0,
      leaders: snapshot.leaders,
      focusSeatId: focusTarget?.seatId,
      focusTarget,
    };
  }

  return null;
}

function hasCurrentDayVoteSnapshot(game: HumanGameView): boolean {
  const votes = game.tableSummary.voteSnapshot.votes;
  return votes.length === 0 || votes.some((vote) => vote.day === game.day);
}

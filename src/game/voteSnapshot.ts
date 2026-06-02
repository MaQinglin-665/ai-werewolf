import { canSeatVote, getSeat } from "./engine";
import type { ActionTarget, GameEvent, GameState, PublicVoteItem, PublicVoteSnapshot } from "./types";

export function buildRecentPublicVotes(state: GameState): PublicVoteItem[] {
  const revealedDays = new Set(state.events.filter((event) => event.type === "VOTE_REVEALED").map((event) => event.day));
  if (state.phase === "DAY_VOTE" || revealedDays.size === 0) return [];

  return state.events
    .filter((event) => event.type === "VOTE_CAST" && revealedDays.has(event.day))
    .slice(-12)
    .map((event) => toPublicVoteItem(state, event))
    .filter((vote): vote is PublicVoteItem => Boolean(vote));
}

export function buildPublicVoteSnapshot(state: GameState): PublicVoteSnapshot {
  if (state.phase === "DAY_VOTE") {
    return {
      votes: [],
      tally: [],
      leaders: [],
      revealed: false,
      ...buildHiddenVoteProgress(state),
    };
  }

  const revealEvent = [...state.events].reverse().find((event) => event.type === "VOTE_REVEALED");
  const tally = buildTallyFromRevealEvent(state, revealEvent);
  const topCount = tally[0]?.count ?? 0;

  return {
    votes: buildRecentPublicVotes(state).filter((vote) => vote.day === revealEvent?.day),
    tally,
    abstainCount:
      typeof revealEvent?.payload.abstainCount === "number" ? revealEvent.payload.abstainCount : undefined,
    leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
    revealed: Boolean(revealEvent),
  };
}

export function buildPublicSheriffVoteSnapshot(state: GameState): PublicVoteSnapshot | undefined {
  if (!state.rules.hasSheriff) return undefined;
  if (state.phase === "SHERIFF_VOTE" || state.phase === "SHERIFF_PK_VOTE") {
    return {
      votes: [],
      tally: [],
      leaders: [],
      revealed: false,
    };
  }

  const revealEvent = [...state.events].reverse().find((event) => event.type === "SHERIFF_VOTE_REVEALED");
  if (!revealEvent) return undefined;

  const tally = buildTallyFromRevealEvent(state, revealEvent);
  const topCount = tally[0]?.count ?? 0;

  return {
    votes: buildRecentPublicSheriffVotes(state, revealEvent),
    tally,
    abstainCount:
      typeof revealEvent.payload.abstainCount === "number" ? revealEvent.payload.abstainCount : undefined,
    leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
    revealed: true,
  };
}

function buildHiddenVoteProgress(
  state: GameState,
): Pick<PublicVoteSnapshot, "eligibleSeatIds" | "lockedSeatIds" | "pendingSeatIds"> {
  const eligibleSeatIds = state.seats
    .filter((seat) => canSeatVote(state, seat.seatId))
    .map((seat) => seat.seatId)
    .sort((a, b) => a - b);
  const lockedSeatIds = eligibleSeatIds
    .filter((seatId) => hasVoted(state, seatId))
    .sort((a, b) => a - b);
  const lockedSeatIdSet = new Set(lockedSeatIds);

  return {
    eligibleSeatIds,
    lockedSeatIds,
    pendingSeatIds: eligibleSeatIds.filter((seatId) => !lockedSeatIdSet.has(seatId)),
  };
}

function buildRecentPublicSheriffVotes(state: GameState, revealEvent: GameEvent | undefined): PublicVoteItem[] {
  if (!revealEvent) return [];

  const previousBoundarySeq =
    [...state.events]
      .reverse()
      .find(
        (event) =>
          event.seq < revealEvent.seq && (event.type === "SHERIFF_VOTE_REVEALED" || event.type === "SHERIFF_PK_STARTED"),
      )?.seq ?? 0;

  return state.events
    .filter(
      (event) =>
        event.type === "SHERIFF_VOTE_CAST" &&
        event.day === revealEvent.day &&
        event.seq > previousBoundarySeq &&
        event.seq < revealEvent.seq,
    )
    .map((event) => toPublicVoteItem(state, event))
    .filter((vote): vote is PublicVoteItem => Boolean(vote));
}

function buildTallyFromRevealEvent(
  state: GameState,
  revealEvent: GameEvent | undefined,
): Array<{ target: ActionTarget; count: number }> {
  const rawTally = Array.isArray(revealEvent?.payload.tally) ? revealEvent.payload.tally : [];
  return rawTally
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const targetSeatId = "targetSeatId" in item && typeof item.targetSeatId === "number" ? item.targetSeatId : undefined;
      const count = "votes" in item && typeof item.votes === "number" ? item.votes : undefined;
      if (!targetSeatId || count === undefined) return undefined;
      return {
        target: toTarget(getSeat(state, targetSeatId)),
        count,
      };
    })
    .filter((item): item is { target: ActionTarget; count: number } => Boolean(item))
    .sort((a, b) => b.count - a.count || a.target.seatId - b.target.seatId);
}

function toPublicVoteItem(state: GameState, event: GameEvent): PublicVoteItem | undefined {
  const voterSeatId = readNumber(event.payload, "voterSeatId") ?? event.actorSeatId;
  const targetSeatId = readNumber(event.payload, "targetSeatId");
  if (!voterSeatId) return undefined;
  return {
    seq: event.seq,
    day: event.day,
    voter: toTarget(getSeat(state, voterSeatId)),
    ...(targetSeatId ? { target: toTarget(getSeat(state, targetSeatId)) } : { abstained: true }),
    reason: typeof event.payload.reason === "string" ? event.payload.reason : undefined,
  };
}

function hasVoted(state: GameState, seatId: number): boolean {
  return Object.prototype.hasOwnProperty.call(state.votes, String(seatId));
}

function toTarget(seat: { seatId: number; name: string }): ActionTarget {
  return {
    seatId: seat.seatId,
    name: seat.name,
  };
}

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

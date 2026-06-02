import type { Phase } from "./types";

export function isNightPhase(phase: Phase): boolean {
  return phase.startsWith("NIGHT");
}

export function isVoteRevealCarryoverPhase(phase: Phase): boolean {
  return (
    phase === "EXILE_RESOLUTION" ||
    phase === "LAST_WORDS" ||
    phase === "HUNTER_REVEAL" ||
    phase === "HUNTER_SHOT" ||
    phase === "WOLF_KING_SHOT" ||
    phase === "SHERIFF_HANDOFF"
  );
}

export function isPublicActorPhase(phase: Phase): boolean {
  return (
    phase === "DAY_SPEECH" ||
    phase === "KNIGHT_DUEL" ||
    phase === "DAY_VOTE" ||
    phase === "LAST_WORDS" ||
    phase === "WOLF_KING_SHOT" ||
    phase === "SHERIFF_NOMINATION" ||
    phase === "SHERIFF_SPEECH" ||
    phase === "SHERIFF_WITHDRAWAL" ||
    phase === "SHERIFF_VOTE" ||
    phase === "SHERIFF_PK_SPEECH" ||
    phase === "SHERIFF_PK_VOTE" ||
    phase === "SHERIFF_HANDOFF"
  );
}

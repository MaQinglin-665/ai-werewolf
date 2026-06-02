import { describe, expect, it } from "vitest";
import { isNightPhase, isPublicActorPhase, isVoteRevealCarryoverPhase } from "./phaseSemantics";

describe("phase semantics", () => {
  it("classifies all hidden night phases as night phases", () => {
    expect(isNightPhase("NIGHT_WOLVES")).toBe(true);
    expect(isNightPhase("NIGHT_WOLF_BEAUTY")).toBe(true);
    expect(isNightPhase("NIGHT_GUARD")).toBe(true);
    expect(isNightPhase("NIGHT_SEER")).toBe(true);
    expect(isNightPhase("NIGHT_WITCH")).toBe(true);
    expect(isNightPhase("DAY_SPEECH")).toBe(false);
  });

  it("keeps actor visibility public only for public-facing actor phases", () => {
    expect(isPublicActorPhase("DAY_SPEECH")).toBe(true);
    expect(isPublicActorPhase("DAY_VOTE")).toBe(true);
    expect(isPublicActorPhase("LAST_WORDS")).toBe(true);
    expect(isPublicActorPhase("SHERIFF_VOTE")).toBe(true);
    expect(isPublicActorPhase("NIGHT_SEER")).toBe(false);
    expect(isPublicActorPhase("NIGHT_WITCH")).toBe(false);
  });

  it("marks vote reveal carry-over phases as part of the public verdict window", () => {
    expect(isVoteRevealCarryoverPhase("EXILE_RESOLUTION")).toBe(true);
    expect(isVoteRevealCarryoverPhase("LAST_WORDS")).toBe(true);
    expect(isVoteRevealCarryoverPhase("HUNTER_REVEAL")).toBe(true);
    expect(isVoteRevealCarryoverPhase("HUNTER_SHOT")).toBe(true);
    expect(isVoteRevealCarryoverPhase("WOLF_KING_SHOT")).toBe(true);
    expect(isVoteRevealCarryoverPhase("SHERIFF_HANDOFF")).toBe(true);
    expect(isVoteRevealCarryoverPhase("DAY_VOTE")).toBe(false);
  });
});

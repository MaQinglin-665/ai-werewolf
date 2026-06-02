import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { getClassTrialVotePresentation } from "./classTrialVotePresentation";

function makeGame(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 2,
    phase: "DAY_SPEECH",
    phaseLabel: "白天发言",
    board: {
      id: "9p-seer-witch-hunter",
      name: "9人预女猎",
      description: "test",
      seatCount: 9,
      roleSummary: "3狼 3民 预言家 女巫 猎人",
      hasGuard: false,
      hasSheriff: false,
      winCondition: "side-slaughter",
    },
    humanSeatId: null,
    seats: Array.from({ length: 9 }, (_, index) => ({
      seatId: index + 1,
      name: `角色${index + 1}`,
      isAi: true,
      isHuman: false,
      alive: true,
      personaName: `角色${index + 1}`,
    })),
    publicEvents: [],
    privateEvents: [],
    availableActions: [],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      claimBoard: [],
      aiReasonHighlights: [],
      phaseSteps: [],
      tableMemory: {
        day: 2,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    ...overrides,
  };
}

describe("class trial vote presentation", () => {
  it("derives sealed vote progress without exposing vote targets", () => {
    const state = getClassTrialVotePresentation(
      makeGame({
        phase: "DAY_VOTE",
        tableSummary: {
          ...makeGame().tableSummary,
          voteSnapshot: {
            votes: [{ seq: 1, day: 2, voter: { seatId: 1, name: "角色1" }, target: { seatId: 2, name: "角色2" } }],
            tally: [{ target: { seatId: 2, name: "角色2" }, count: 1 }],
            leaders: [{ seatId: 2, name: "角色2" }],
            revealed: false,
            eligibleSeatIds: [1, 2, 3],
            lockedSeatIds: [1],
            pendingSeatIds: [2, 3],
          },
        },
      }),
    );

    expect(state).toEqual({
      variant: "sealing",
      eligibleSeatIds: [1, 2, 3],
      lockedSeatIds: [1],
      pendingSeatIds: [2, 3],
    });
  });

  it("derives revealed exile state with one focus target", () => {
    const state = getClassTrialVotePresentation(
      makeGame({
        phase: "EXILE_RESOLUTION",
        tableSummary: {
          ...makeGame().tableSummary,
          voteSnapshot: {
            votes: [{ seq: 1, day: 2, voter: { seatId: 1, name: "角色1" }, target: { seatId: 6, name: "角色6" } }],
            tally: [{ target: { seatId: 6, name: "角色6" }, count: 2 }],
            abstainCount: 1,
            leaders: [{ seatId: 6, name: "角色6" }],
            revealed: true,
          },
        },
      }),
    );

    expect(state).toMatchObject({
      variant: "reveal",
      verdict: "exile",
      abstainCount: 1,
      focusSeatId: 6,
      focusTarget: { seatId: 6, name: "角色6" },
    });
  });

  it("derives no-exile reveal state for tied leaders", () => {
    const state = getClassTrialVotePresentation(
      makeGame({
        phase: "LAST_WORDS",
        tableSummary: {
          ...makeGame().tableSummary,
          voteSnapshot: {
            votes: [{ seq: 1, day: 2, voter: { seatId: 1, name: "角色1" }, target: { seatId: 6, name: "角色6" } }],
            tally: [
              { target: { seatId: 6, name: "角色6" }, count: 1 },
              { target: { seatId: 7, name: "角色7" }, count: 1 },
            ],
            leaders: [
              { seatId: 6, name: "角色6" },
              { seatId: 7, name: "角色7" },
            ],
            revealed: true,
          },
        },
      }),
    );

    expect(state).toMatchObject({ variant: "reveal", verdict: "no-exile", focusSeatId: undefined });
  });

  it("ignores non-vote phases and stale prior-day vote snapshots", () => {
    expect(getClassTrialVotePresentation(makeGame())).toBeNull();
    expect(
      getClassTrialVotePresentation(
        makeGame({
          day: 3,
          phase: "DAY_SPEECH",
          tableSummary: {
            ...makeGame().tableSummary,
            voteSnapshot: {
              votes: [{ seq: 1, day: 2, voter: { seatId: 1, name: "角色1" }, target: { seatId: 6, name: "角色6" } }],
              tally: [{ target: { seatId: 6, name: "角色6" }, count: 1 }],
              leaders: [{ seatId: 6, name: "角色6" }],
              revealed: true,
            },
          },
        }),
      ),
    ).toBeNull();
  });
});

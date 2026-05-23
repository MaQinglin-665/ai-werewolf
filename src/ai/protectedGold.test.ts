import { describe, expect, it } from "vitest";
import { deadSeerGoldSeatIds, hasHardOverrideAgainstDeadSeerGold, isProtectedDeadSeerGoldSeat } from "./protectedGold";
import type { ActionTarget, AiTableRead, SeatRead, TableMemory } from "@/game/types";

describe("dead seer gold protection", () => {
  it("protects a dead-seer gold target from weak single pressure", () => {
    const deadSeer = target(2, "Dead Seer");
    const gold = target(4, "Legacy Gold");
    const tableRead = readWithGold(deadSeer, gold, [
      seatRead(gold, {
        suspicion: 82,
        trust: 20,
        pressure: ["short speech"],
        publicStancedBy: [pressure(target(5, "Questioner"), gold, "QUESTION")],
      }),
      seatRead(target(6, "Outside Focus"), { suspicion: 58, trust: 42 }),
    ]);

    const goldRead = tableRead.seats.find((seat) => seat.seatId === gold.seatId)!;

    expect(hasHardOverrideAgainstDeadSeerGold(tableRead, goldRead)).toBe(false);
    expect(isProtectedDeadSeerGoldSeat(tableRead, goldRead)).toBe(true);
  });

  it("allows hard public override from repeated black-check pressure", () => {
    const deadSeer = target(2, "Dead Seer");
    const gold = target(4, "Legacy Gold");
    const checkerA = target(6, "Live Seer A");
    const checkerB = target(7, "Live Seer B");
    const tableRead = readWithGold(
      deadSeer,
      gold,
      [
        seatRead(gold, {
          suspicion: 92,
          trust: 18,
          publicChecksAgainst: [
            { claimant: checkerA, result: "WEREWOLF", day: 3 },
            { claimant: checkerB, result: "WEREWOLF", day: 3 },
          ],
          publicStancedBy: [pressure(checkerA, gold, "PRESSURE"), pressure(checkerB, gold, "QUESTION")],
        }),
      ],
      {
        reasoningCues: [
          {
            cueId: "gold-override",
            day: 3,
            kind: "counterclaim",
            weight: "strong",
            target: gold,
            summary: "multiple public checks challenge the gold",
            evidence: ["two public black checks"],
          },
        ],
      },
    );

    const goldRead = tableRead.seats.find((seat) => seat.seatId === gold.seatId)!;

    expect(hasHardOverrideAgainstDeadSeerGold(tableRead, goldRead)).toBe(true);
    expect(isProtectedDeadSeerGoldSeat(tableRead, goldRead)).toBe(false);
  });

  it("extracts dead-seer gold seat ids from public table memory", () => {
    const gold = target(4, "Legacy Gold");
    const tableMemory = memory({
      seerLegacies: [
        {
          claimant: target(2, "Dead Seer"),
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead seer left a public gold.",
        },
      ],
    });

    expect([...deadSeerGoldSeatIds(tableMemory)]).toEqual([gold.seatId]);
  });
});

function readWithGold(
  deadSeer: ActionTarget,
  gold: ActionTarget,
  seats: SeatRead[],
  overrides: Partial<TableMemory> = {},
): AiTableRead {
  return {
    mySeatId: 1,
    myRole: "VILLAGER",
    day: 3,
    seats: [seatRead(target(1, "Voter"), { isSelf: true, suspicion: 0, trust: 100 }), ...seats],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [],
    focus: seats[0],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory: memory({
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead seer left a public gold.",
        },
      ],
      ...overrides,
    }),
    tableMood: "test",
  };
}

function target(seatId: number, name: string): ActionTarget {
  return { seatId, name };
}

function seatRead(targetSeat: ActionTarget, overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    ...targetSeat,
    suspicion: 50,
    trust: 50,
    pressure: [],
    isSelf: false,
    isKnownWolf: false,
    isKnownGood: false,
    isWolfTeammate: false,
    speechCount: 1,
    votesReceived: 0,
    publicClaims: [],
    publicChecksAgainst: [],
    publicStancesGiven: [],
    publicStancedBy: [],
    ...overrides,
  };
}

function pressure(actor: ActionTarget, pressedTarget: ActionTarget, kind: "QUESTION" | "PRESSURE") {
  return {
    stanceId: `stance-${actor.seatId}-${pressedTarget.seatId}-${kind}`,
    day: 3,
    actor,
    target: pressedTarget,
    kind,
    kindLabel: kind,
    summary: `${actor.name} presses ${pressedTarget.name}`,
  };
}

function memory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 3,
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
    ...overrides,
  };
}

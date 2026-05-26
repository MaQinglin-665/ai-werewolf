import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { buildTableEventFeed } from "./tableEventFeed";

describe("buildTableEventFeed", () => {
  it("filters day speech events and returns newest non-speech events first", () => {
    const game = gameView({
      publicEvents: [
        event(1, "NIGHT_WOLVES"),
        event(2, "DAY_SPEECH"),
        event(3, "DAY_ANNOUNCEMENT"),
        event(4, "DAY_VOTE"),
      ],
    });

    expect(buildTableEventFeed(game).map((item) => item.seq)).toEqual([4, 3, 1]);
  });

  it("keeps only the newest 18 non-speech events", () => {
    const publicEvents = Array.from({ length: 24 }, (_, index) =>
      event(index + 1, index % 5 === 0 ? "DAY_SPEECH" : "DAY_ANNOUNCEMENT"),
    );

    const feed = buildTableEventFeed(gameView({ publicEvents }));

    expect(feed).toHaveLength(18);
    expect(feed.map((item) => item.seq)).toEqual([24, 23, 22, 20, 19, 18, 17, 15, 14, 13, 12, 10, 9, 8, 7, 5, 4, 3]);
  });

  it("returns an empty feed when there is no game", () => {
    expect(buildTableEventFeed(null)).toEqual([]);
  });
});

function gameView(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 1,
    phase: "DAY_SPEECH",
    phaseLabel: "白天发言",
    board: { id: "6p", name: "6人局", seatCount: 6, roles: [] },
    humanSeatId: 1,
    seats: [],
    publicEvents: [],
    privateEvents: [],
    availableActions: [{ type: "continue" }],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [] },
      claimBoard: [],
      tableMemory: {},
      aiReasonHighlights: [],
      phaseSteps: [],
    },
    ...overrides,
  } as HumanGameView;
}

function event(seq: number, phase: HumanGameView["phase"]): HumanGameView["publicEvents"][number] {
  return {
    seq,
    type: "DAY_STARTED",
    day: 1,
    phase,
    actorSeatId: undefined,
    message: `event-${seq}`,
    payload: {},
  } as HumanGameView["publicEvents"][number];
}

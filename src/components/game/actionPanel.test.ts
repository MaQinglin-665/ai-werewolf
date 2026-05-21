import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { ActionPanel } from "./ActionPanel";

function buildResultGame(): HumanGameView {
  return {
    id: "game-result",
    day: 2,
    phase: "GAME_OVER",
    phaseLabel: "Game over",
    board: { id: "test-board", name: "Test board", seatCount: 3, roleSummary: "test" } as HumanGameView["board"],
    humanSeatId: null,
    seats: [],
    publicEvents: [],
    privateEvents: [],
    availableActions: [],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { entries: [], pendingSeatIds: [] },
      claimBoard: [],
      tableMemory: {} as HumanGameView["tableSummary"]["tableMemory"],
      aiReasonHighlights: [],
      phaseSteps: [],
    },
    result: { winner: "GOOD", reason: "test result" },
  } as unknown as HumanGameView;
}

describe("ActionPanel", () => {
  it("uses the supplied review anchor when the game is over", () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        game: buildResultGame(),
        loading: false,
        onNewGame: async () => undefined,
        onSubmit: async () => undefined,
        reviewHref: "#mobile-review",
      }),
    );

    expect(html).toContain('href="#mobile-review"');
  });
});

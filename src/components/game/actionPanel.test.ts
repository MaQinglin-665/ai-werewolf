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

function buildActionGame(availableActions: HumanGameView["availableActions"]): HumanGameView {
  return {
    id: "game-action",
    day: 1,
    phase: "NIGHT_SEER",
    phaseLabel: "预言家查验",
    board: { id: "test-board", name: "Test board", seatCount: 3, roleSummary: "test" } as HumanGameView["board"],
    humanSeatId: 1,
    seats: [
      { seatId: 1, name: "You", isAi: false, isHuman: true, alive: true },
      { seatId: 2, name: "DeepSeek", isAi: true, isHuman: false, alive: true },
      { seatId: 3, name: "Claude", isAi: true, isHuman: false, alive: true },
    ],
    publicEvents: [],
    privateEvents: [],
    availableActions,
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

  it("keeps mobile compact target actions out of the old card grids", () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        game: buildActionGame([
          {
            type: "seerCheck",
            targets: [
              { seatId: 2, name: "DeepSeek" },
              { seatId: 3, name: "Claude" },
            ],
          },
        ]),
        loading: false,
        onNewGame: async () => undefined,
        onSubmit: async () => undefined,
        mobileCompact: true,
      }),
    );

    expect(html).toContain("mobile-action-panel-compact");
    expect(html).not.toContain("mobile-night-target-grid");
    expect(html).not.toContain("night-target-card");
  });

  it("does not render redundant mobile target prompts", () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        game: buildActionGame([
          {
            type: "wolfKill",
            targets: [
              { seatId: 1, name: "You" },
              { seatId: 2, name: "DeepSeek" },
            ],
          },
        ]),
        loading: false,
        onNewGame: async () => undefined,
        onSubmit: async () => undefined,
        mobileCompact: true,
      }),
    );

    expect(html).not.toContain("mobile-avatar-action-prompt");
    expect(html).not.toContain("点头像选择目标");
    expect(html).not.toContain("mobile-target-action-grid");
    expect(html).not.toContain("mobile-target-chip");
  });
});

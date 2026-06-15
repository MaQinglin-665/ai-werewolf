import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { ReviewPanel } from "./ReviewPanel";

function buildReviewedGame(): HumanGameView {
  return {
    id: "game-review",
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
    review: {
      result: { winner: "GOOD", reason: "test result" },
      roleReveal: [],
      claims: [],
      stanceShifts: [],
      strategyNotes: [],
      voteImpacts: [],
      aiInsights: [],
      playerFeedback: [],
      nightRounds: [],
      dayRounds: [],
      deathTimeline: [],
      keyEvents: [],
      turningPoints: [],
    },
  } as unknown as HumanGameView;
}

describe("ReviewPanel", () => {
  it("allows a mobile review panel to use distinct anchors", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPanel, {
        game: buildReviewedGame(),
        reviewId: "mobile-review",
        reviewEventsId: "mobile-review-events",
      }),
    );

    expect(html).toContain('id="mobile-review"');
    expect(html).toContain('href="#mobile-review-events"');
    expect(html).toContain('id="mobile-review-events"');
    expect(html).not.toContain('id="review"');
    expect(html).not.toContain('id="review-events"');
  });

  it("shows the feedback id in the endgame review", () => {
    const html = renderToStaticMarkup(createElement(ReviewPanel, { game: buildReviewedGame() }));

    expect(html).toContain("反馈编号");
    expect(html).toContain("game-review");
  });
});

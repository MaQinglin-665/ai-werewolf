import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { ClassTrialGameTable } from "./ClassTrialGameTable";

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
    availableActions: [{ type: "continue", label: "继续", description: "继续推进" }],
    currentSpeakerSeatId: 3,
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [{ seq: 10, day: 2, speaker: { seatId: 3, name: "角色3" }, message: "先不要急着归票。" }],
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

describe("ClassTrialGameTable", () => {
  it("renders the central phase and speaker without identity labels", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-table");
    expect(html).toContain("白天发言");
    expect(html).toContain("角色3 发言中");
    expect(html).toContain("先不要急着归票。");
    expect(html).not.toContain("预言家");
    expect(html).not.toContain("狼人");
  });

  it("keeps a visible way back to the default table flow", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("返回首页");
    expect(html).toContain("继续");
  });
});

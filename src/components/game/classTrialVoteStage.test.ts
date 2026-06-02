import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { ClassTrialVoteStage, getClassTrialVoteState } from "./ClassTrialVoteStage";

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
    currentSpeakerSeatId: undefined,
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

function normalizeHtml(html: string): string {
  return html.replaceAll("&gt;", ">");
}

describe("ClassTrialVoteStage", () => {
  it("shows lock progress during class trial voting without exposing targets", () => {
    const game = makeGame({
      phase: "DAY_VOTE",
      phaseLabel: "投票",
      tableSummary: {
        ...makeGame().tableSummary,
        voteSnapshot: {
          votes: [
            {
              seq: 10,
              day: 2,
              voter: { seatId: 1, name: "角色1" },
              target: { seatId: 2, name: "角色2" },
              reason: "测试理由",
            },
          ],
          tally: [{ target: { seatId: 2, name: "角色2" }, count: 1 }],
          leaders: [{ seatId: 2, name: "角色2" }],
          revealed: false,
          eligibleSeatIds: [1, 2, 3],
          lockedSeatIds: [1],
          pendingSeatIds: [2, 3],
        },
      },
    });
    const html = normalizeHtml(renderToStaticMarkup(createElement(ClassTrialVoteStage, { game })));

    expect(html).toContain("封票中");
    expect(html).toContain("1 / 3");
    expect(html).toContain("等待 2 人");
    expect(html).toContain("已锁票");
    expect(html).toContain("等待中");
    expect(html).toContain("class-trial-vote-burst-sealing");
    expect(html).toContain("class-trial-vote-burst-copy");
    expect(html).toContain("class-trial-vote-burst-slice");
    expect(html).toContain("TRIAL VOTE");
    expect(html).toContain("封票开始");
    expect(html).not.toContain("->");
    expect(html).not.toContain("测试理由");
    expect(html).not.toContain("角色2");
  });

  it("renders revealed vote tally and ledger", () => {
    const game = makeGame({
      phase: "EXILE_RESOLUTION",
      phaseLabel: "放逐结算",
      tableSummary: {
        ...makeGame().tableSummary,
        voteSnapshot: {
          votes: [
            {
              seq: 10,
              day: 2,
              voter: { seatId: 1, name: "角色1" },
              target: { seatId: 6, name: "角色6" },
              reason: "公开理由",
            },
            {
              seq: 11,
              day: 2,
              voter: { seatId: 2, name: "角色2" },
              target: { seatId: 6, name: "角色6" },
            },
            {
              seq: 12,
              day: 2,
              voter: { seatId: 3, name: "角色3" },
              abstained: true,
            },
          ],
          tally: [{ target: { seatId: 6, name: "角色6" }, count: 2 }],
          abstainCount: 1,
          leaders: [{ seatId: 6, name: "角色6" }],
          revealed: true,
        },
      },
    });
    const html = normalizeHtml(renderToStaticMarkup(createElement(ClassTrialVoteStage, { game })));

    expect(html).toContain("开票揭示");
    expect(html).toContain("6号");
    expect(html).toContain("2票");
    expect(html).toContain("class-trial-vote-burst-exile");
    expect(html).toContain("class-trial-vote-burst-target");
    expect(html).toContain("处刑目标");
    expect(html).toContain("6号 角色6");
    expect(html).toContain("1号 -> 6号");
    expect(html).toContain("3号 -> 弃票");
    expect(html).toContain("弃票");
  });

  it("labels revealed tied votes as no exile without focusing a target", () => {
    const game = makeGame({
      phase: "EXILE_RESOLUTION",
      phaseLabel: "放逐结算",
      tableSummary: {
        ...makeGame().tableSummary,
        voteSnapshot: {
          votes: [
            {
              seq: 10,
              day: 2,
              voter: { seatId: 1, name: "角色1" },
              target: { seatId: 6, name: "角色6" },
            },
            {
              seq: 11,
              day: 2,
              voter: { seatId: 2, name: "角色2" },
              target: { seatId: 7, name: "角色7" },
            },
            {
              seq: 12,
              day: 2,
              voter: { seatId: 3, name: "角色3" },
              abstained: true,
            },
          ],
          tally: [
            { target: { seatId: 6, name: "角色6" }, count: 1 },
            { target: { seatId: 7, name: "角色7" }, count: 1 },
          ],
          abstainCount: 1,
          leaders: [
            { seatId: 6, name: "角色6" },
            { seatId: 7, name: "角色7" },
          ],
          revealed: true,
        },
      },
    });
    const state = getClassTrialVoteState(game);
    const html = normalizeHtml(renderToStaticMarkup(createElement(ClassTrialVoteStage, { game })));

    expect(state).toMatchObject({ variant: "reveal", verdict: "no-exile", focusSeatId: undefined });
    expect(html).toContain("平票无处刑");
    expect(html).toContain("最高票并列，夜晚继续");
    expect(html).toContain("class-trial-vote-burst-no-exile");
    expect(html).not.toContain("class-trial-vote-burst-exile");
    expect(html).toContain("1号 -> 6号");
    expect(html).toContain("2号 -> 7号");
    expect(html).toContain("3号 -> 弃票");
  });

  it("does not render a stage outside vote phases", () => {
    const game = makeGame();

    expect(getClassTrialVoteState(game)).toBeNull();
    expect(renderToStaticMarkup(createElement(ClassTrialVoteStage, { game }))).toBe("");
  });

  it("does not keep a previous day's revealed vote stage over the next day speech", () => {
    const game = makeGame({
      day: 2,
      phase: "DAY_SPEECH",
      phaseLabel: "白天发言",
      currentSpeakerSeatId: 3,
      tableSummary: {
        ...makeGame().tableSummary,
        voteSnapshot: {
          votes: [
            {
              seq: 10,
              day: 1,
              voter: { seatId: 1, name: "角色1" },
              target: { seatId: 3, name: "角色3" },
            },
          ],
          tally: [{ target: { seatId: 3, name: "角色3" }, count: 1 }],
          leaders: [{ seatId: 3, name: "角色3" }],
          revealed: true,
        },
      },
    });

    expect(getClassTrialVoteState(game)).toBeNull();
    expect(renderToStaticMarkup(createElement(ClassTrialVoteStage, { game }))).toBe("");
  });
});

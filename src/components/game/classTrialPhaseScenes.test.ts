import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { getClassTrialPhaseCurtainCue } from "./classTrialPhaseScenes";

function makeGame(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 2,
    phase: "NIGHT_WOLVES",
    phaseLabel: "狼人行动",
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
    })),
    publicEvents: [],
    privateEvents: [],
    availableActions: [{ type: "continue", label: "继续", description: "继续推进" }],
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

function expectPhaseCue(cue: ReturnType<typeof getClassTrialPhaseCurtainCue>) {
  expect(cue).not.toBeNull();
  if (!cue) throw new Error("Expected a class-trial phase cue.");
  return cue;
}

describe("getClassTrialPhaseCurtainCue", () => {
  it("shows full-screen scenes for hidden night role actions without exposing targets", () => {
    const wolves = expectPhaseCue(getClassTrialPhaseCurtainCue(makeGame({ phase: "NIGHT_WOLVES", phaseLabel: "狼人行动" })));
    const seer = expectPhaseCue(getClassTrialPhaseCurtainCue(makeGame({ phase: "NIGHT_SEER", phaseLabel: "预言家查验" })));
    const witch = expectPhaseCue(getClassTrialPhaseCurtainCue(makeGame({ phase: "NIGHT_WITCH", phaseLabel: "女巫行动" })));

    expect(wolves).toMatchObject({
      presentation: "class-trial",
      tone: "night",
      eyebrow: "第 2 夜",
      title: "夜晚降临",
      subtitle: "天黑请闭眼，狼人行动开始。",
      resultLines: ["隐藏行动只显示阶段，不公开刀口。"],
    });
    expect(seer.title).toBe("预言家查验");
    expect(seer.resultLines).toEqual(["隐藏行动只显示阶段，不公开查验。"]);
    expect(witch.title).toBe("女巫睁眼");
    expect(witch.resultLines).toEqual(["隐藏行动只显示阶段，不公开用药。"]);
  });

  it("summarizes dawn deaths from the latest day-start event", () => {
    const cue = expectPhaseCue(getClassTrialPhaseCurtainCue(
      makeGame({
        phase: "DAY_ANNOUNCEMENT",
        phaseLabel: "天亮公布",
        publicEvents: [
          {
            seq: 12,
            type: "DAY_STARTED",
            day: 2,
            phase: "DAY_ANNOUNCEMENT",
            message: "第2天清晨，3号、8号死亡。",
            payload: { deadSeatIds: [3, 8] },
          },
        ],
      }),
    ));

    expect(cue).toMatchObject({
      presentation: "class-trial",
      tone: "day",
      durationMs: 3000,
      title: "天亮，结果公开",
    });
    expect(cue.subtitle).toBe("第2天清晨，3号、8号死亡。");
    expect(cue.resultLines).toContain("昨夜结果：3号、8号死亡。");
  });

  it("summarizes an exile verdict and the vote reveal", () => {
    const cue = expectPhaseCue(getClassTrialPhaseCurtainCue(
      makeGame({
        phase: "LAST_WORDS",
        phaseLabel: "遗言",
        publicEvents: [
          {
            seq: 30,
            type: "VOTE_REVEALED",
            day: 2,
            phase: "EXILE_RESOLUTION",
            message: "投票结束：6号 4票，2号 3票。",
            payload: {},
          },
          {
            seq: 31,
            type: "PLAYER_EXILED",
            day: 2,
            phase: "EXILE_RESOLUTION",
            message: "6号 被放逐出局。",
            payload: { seatId: 6 },
          },
        ],
      }),
    ));

    expect(cue).toMatchObject({
      presentation: "class-trial",
      tone: "danger",
      durationMs: 3000,
      title: "放逐判决",
      subtitle: "6号 被放逐出局。",
    });
    expect(cue.resultLines).toEqual(["投票结束：6号 4票，2号 3票。"]);
  });

  it("frames day vote as sealed progress without exposing targets", () => {
    const cue = expectPhaseCue(getClassTrialPhaseCurtainCue(
      makeGame({
        phase: "DAY_VOTE",
        phaseLabel: "投票",
      }),
    ));

    expect(cue).toMatchObject({
      presentation: "class-trial",
      tone: "vote",
      durationMs: 3000,
      title: "封票审判开始",
      subtitle: "所有人的投票已经进入票箱，目标将在开票时一次性公开。",
    });
    expect(cue.resultLines).toEqual(["投票阶段：当前只公开封票进度，不公开投票目标。"]);
  });

  it("shows the revealed vote ledger during vote resolution", () => {
    const cue = expectPhaseCue(getClassTrialPhaseCurtainCue(
      makeGame({
        phase: "EXILE_RESOLUTION",
        phaseLabel: "放逐结算",
        tableSummary: {
          ...makeGame().tableSummary,
          voteSnapshot: {
            revealed: true,
            votes: [
              {
                seq: 21,
                day: 2,
                voter: { seatId: 1, name: "苗木诚" },
                target: { seatId: 6, name: "塞蕾丝缇雅" },
              },
              {
                seq: 22,
                day: 2,
                voter: { seatId: 2, name: "雾切响子" },
                target: { seatId: 6, name: "塞蕾丝缇雅" },
              },
              {
                seq: 23,
                day: 2,
                voter: { seatId: 3, name: "腐川冬子" },
                abstained: true,
              },
            ],
            tally: [{ target: { seatId: 6, name: "塞蕾丝缇雅" }, count: 2 }],
            abstainCount: 1,
            leaders: [{ seatId: 6, name: "塞蕾丝缇雅" }],
          },
        },
        publicEvents: [
          {
            seq: 24,
            type: "VOTE_REVEALED",
            day: 2,
            phase: "EXILE_RESOLUTION",
            message: "投票结束：6号 2票，弃票 1票。",
            payload: { tally: [{ targetSeatId: 6, targetName: "塞蕾丝缇雅", votes: 2 }], abstainCount: 1 },
          },
        ],
      }),
    ));

    expect(cue).toMatchObject({
      title: "开票揭示",
      subtitle: "投票结束：6号 2票，弃票 1票。",
    });
    expect(cue.resultLines).toEqual([
      "票型汇总：6号塞蕾丝缇雅 2票，弃票 1票。",
      "逐票：1号苗木诚 → 6号塞蕾丝缇雅；2号雾切响子 → 6号塞蕾丝缇雅；3号腐川冬子 → 弃票。",
    ]);
  });

  it("turns final result into a decisive victory scene", () => {
    const cue = expectPhaseCue(getClassTrialPhaseCurtainCue(
      makeGame({
        phase: "GAME_OVER",
        phaseLabel: "游戏结束",
        result: { winner: "GOOD", reason: "所有狼人出局" },
        publicEvents: [
          {
            seq: 40,
            type: "GAME_ENDED",
            day: 3,
            phase: "GAME_OVER",
            message: "好人阵营获胜：所有狼人出局。",
            payload: { winner: "GOOD", reason: "所有狼人出局" },
          },
        ],
      }),
    ));

    expect(cue).toMatchObject({
      presentation: "class-trial",
      tone: "end",
      durationMs: 3000,
      title: "好人阵营胜利",
      subtitle: "所有狼人出局",
    });
    expect(cue.resultLines).toContain("好人阵营获胜：所有狼人出局。");
  });
});

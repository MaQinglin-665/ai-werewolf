import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import type { ClassTrialAudioTypewriterState } from "./clientTypes";
import { buildClassTrialTableModel } from "./classTrialTableModel";

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

describe("buildClassTrialTableModel", () => {
  it("builds the visible speaker focus from the active seat and recent speech", () => {
    const model = buildClassTrialTableModel({ game: makeGame(), aiRuntimeMode: "llm" });

    expect(model.speakerSeatId).toBe(3);
    expect(model.activeSeatId).toBe(3);
    expect(model.speakerName).toBe("腐川冬子");
    expect(model.centerStatus).toBe("腐川冬子 发言中");
    expect(model.message).toBe("先不要急着归票。");
    expect(model.currentSpeakingFocus?.speakerName).toBe("腐川冬子");
    expect(model.aiRuntimeLabel).toContain("真实 LLM");
    expect(model.hostAudioLabel).toBe("主持关");
  });

  it("keeps a playing audio speaker focused even after the game advances", () => {
    const audioTypewriter: ClassTrialAudioTypewriterState = {
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      state: "playing",
      text: "同步",
    };
    const baseGame = makeGame();
    const model = buildClassTrialTableModel({
      game: makeGame({
        currentSpeakerSeatId: 4,
        tableSummary: {
          ...baseGame.tableSummary,
          recentSpeeches: [
            { seq: 10, day: 2, speaker: { seatId: 3, name: "角色3" }, message: "上一位还在播放。" },
            { seq: 11, day: 2, speaker: { seatId: 4, name: "角色4" }, message: "下一位已经准备好了。" },
          ],
        },
      }),
      audioTypewriter,
    });

    expect(model.speakerSeatId).toBe(3);
    expect(model.activeSeatId).toBe(3);
    expect(model.speakerName).toBe("腐川冬子");
    expect(model.message).toBe("上一位还在播放。");
  });

  it("separates a night action actor from speaker portrait focus", () => {
    const baseGame = makeGame();
    const model = buildClassTrialTableModel({
      game: makeGame({
        phase: "NIGHT_WOLVES",
        phaseLabel: "狼人行动",
        currentSpeakerSeatId: undefined,
        currentActorSeatId: 8,
        tableSummary: { ...baseGame.tableSummary, recentSpeeches: [] },
      }),
    });

    expect(model.nightPhase).toBe(true);
    expect(model.activeSeatId).toBe(8);
    expect(model.speakerCharacter).toBeUndefined();
    expect(model.currentSpeakingFocus).toBeUndefined();
    expect(model.centerStatus).toBe("高松灯 行动中");
  });

  it("derives sealed vote ring state and reveal focus from the public vote snapshot", () => {
    const baseGame = makeGame();
    const sealingModel = buildClassTrialTableModel({
      game: makeGame({
        phase: "DAY_VOTE",
        phaseLabel: "投票",
        currentSpeakerSeatId: undefined,
        tableSummary: {
          ...baseGame.tableSummary,
          voteSnapshot: {
            votes: [],
            tally: [],
            leaders: [],
            revealed: false,
            eligibleSeatIds: [1, 2, 3],
            lockedSeatIds: [1],
            pendingSeatIds: [2, 3],
          },
        },
      }),
    });

    expect(sealingModel.classTrialVoteState?.variant).toBe("sealing");
    expect(sealingModel.voteLockedSeatIds.has(1)).toBe(true);
    expect(sealingModel.votePendingSeatIds.has(2)).toBe(true);

    const revealModel = buildClassTrialTableModel({
      game: makeGame({
        phase: "EXILE_RESOLUTION",
        phaseLabel: "放逐结算",
        currentSpeakerSeatId: undefined,
        tableSummary: {
          ...baseGame.tableSummary,
          voteSnapshot: {
            votes: [{ seq: 10, day: 2, voter: { seatId: 1, name: "角色1" }, target: { seatId: 6, name: "角色6" } }],
            tally: [{ target: { seatId: 6, name: "角色6" }, count: 1 }],
            leaders: [{ seatId: 6, name: "角色6" }],
            abstainCount: 0,
            revealed: true,
          },
        },
      }),
    });

    expect(revealModel.classTrialVoteState?.variant).toBe("reveal");
    expect(revealModel.voteFocusSeatId).toBe(6);
  });
});

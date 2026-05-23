import { describe, expect, it } from "vitest";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import {
  getMobileActionPanelLayout,
  getMobileActionMode,
  getMobileAudioButtonStates,
  getMobileDrawerSnapshot,
  getMobileDrawerActivityMeta,
  getMobileFilteredSpeeches,
  getMobileFocusSeat,
  getMobilePhaseSignalTone,
  getMobileSpeechInputPrompt,
  getMobileSpeechHighlights,
  hasMobileSpeechDrawerAction,
  shouldShowMobileStageAction,
  getMobileSeatStageLayout,
  getMobileSeatCardVisual,
  getMobileSeatCounts,
  MOBILE_INFO_TABS,
} from "./mobileTableModel";

const baseSeats: HumanGameView["seats"] = [
  { seatId: 1, name: "You", isAi: false, isHuman: true, alive: true },
  { seatId: 2, name: "Claude", isAi: true, isHuman: false, alive: true },
  { seatId: 3, name: "Kimi", isAi: true, isHuman: false, alive: false },
];

const speechOne = {
  seq: 1,
  day: 1,
  speaker: { seatId: 2, name: "DeepSeek" },
  message: "我先报一下站边和票型理由。",
};

const speechTwo = {
  seq: 2,
  day: 1,
  speaker: { seatId: 4, name: "GPT" },
  message: "我给一个折中判断，先留活口再听后置位。",
};

const speechThree = {
  seq: 3,
  day: 1,
  speaker: { seatId: 5, name: "豆包" },
  message: "我不同意这个归票，理由是前置位信息太少。",
};

function buildGame(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 1,
    phase: "DAY_SPEECH",
    phaseLabel: "第 1 天发言",
    board: { seatCount: 3, roleSummary: "1狼 2民" } as HumanGameView["board"],
    humanSeatId: 1,
    seats: baseSeats,
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
    ...overrides,
  } as HumanGameView;
}

describe("getMobileSeatCounts", () => {
  it("counts alive and dead seats", () => {
    expect(getMobileSeatCounts(buildGame())).toEqual({ aliveCount: 2, deadCount: 1 });
  });
});

describe("getMobileFocusSeat", () => {
  it("prioritizes the current actor over the current speaker", () => {
    expect(getMobileFocusSeat(buildGame({ currentActorSeatId: 2, currentSpeakerSeatId: 1 }))).toEqual({
      kind: "actor",
      label: "行动中",
      seat: baseSeats[1],
    });
  });

  it("falls back to the current speaker", () => {
    expect(getMobileFocusSeat(buildGame({ currentSpeakerSeatId: 1 }))).toEqual({
      kind: "speaker",
      label: "发言中",
      seat: baseSeats[0],
    });
  });

  it("labels night flow when no focus seat exists during night phases", () => {
    expect(getMobileFocusSeat(buildGame({ phase: "NIGHT_SEER" }))).toEqual({
      kind: "none",
      label: "夜晚流程",
      seat: undefined,
    });
  });
});

describe("getMobileActionMode", () => {
  it("classifies non-continue available actions as player actions", () => {
    const action: AvailableHumanAction = { type: "speak" };

    expect(getMobileActionMode(buildGame({ availableActions: [action] }))).toEqual({
      kind: "player",
      label: "轮到你行动",
      action,
    });
  });

  it("keeps the first action when later actions require the player", () => {
    const continueAction: AvailableHumanAction = { type: "continue", label: "继续", description: "播放下一步" };
    const speakAction: AvailableHumanAction = { type: "speak" };

    expect(getMobileActionMode(buildGame({ availableActions: [continueAction, speakAction] }))).toEqual({
      kind: "player",
      label: "轮到你行动",
      action: continueAction,
    });
  });

  it("classifies only continue actions as automatic playback", () => {
    const action: AvailableHumanAction = { type: "continue", label: "继续", description: "播放下一步" };

    expect(getMobileActionMode(buildGame({ availableActions: [action] }))).toEqual({
      kind: "auto",
      label: "自动播放",
      action,
    });
  });

  it("classifies loading before available actions", () => {
    const action: AvailableHumanAction = { type: "continue", label: "继续", description: "播放下一步" };

    expect(getMobileActionMode(buildGame({ availableActions: [action] }), true)).toEqual({
      kind: "loading",
      label: "结算中",
      action,
    });
  });

  it("classifies game result before loading or actions", () => {
    const action: AvailableHumanAction = { type: "speak" };

    expect(
      getMobileActionMode(
        buildGame({ availableActions: [action], result: { winner: "GOOD", reason: "villagers win" } }),
        true,
      ),
    ).toEqual({ kind: "gameOver", label: "终局" });
  });

  it("classifies empty idle state as waiting for AI", () => {
    expect(getMobileActionMode(buildGame())).toEqual({
      kind: "waiting",
      label: "等待 AI 行动",
    });
  });
});

describe("getMobileActionPanelLayout", () => {
  it("places the primary mobile action panel in the stage center layer", () => {
    const action: AvailableHumanAction = { type: "speak" };

    expect(getMobileActionPanelLayout(buildGame({ availableActions: [action] }), false)).toEqual({
      actionLayerClassName: "mobile-centered-action mobile-centered-action-stage mobile-centered-action-player",
      dockClassName: "mobile-action-dock mobile-action-dock-drawers-only",
    });
  });

  it("keeps automatic playback in the stage center layer", () => {
    const action: AvailableHumanAction = { type: "continue", label: "Continue", description: "Advance flow" };

    expect(getMobileActionPanelLayout(buildGame({ availableActions: [action] }), false)).toEqual({
      actionLayerClassName: "mobile-centered-action mobile-centered-action-stage mobile-centered-action-auto",
      dockClassName: "mobile-action-dock mobile-action-dock-drawers-only",
    });
  });
});

describe("hasMobileSpeechDrawerAction", () => {
  it("routes speech-style actions to the mobile speech drawer", () => {
    expect(hasMobileSpeechDrawerAction(buildGame({ availableActions: [{ type: "speak" }] }))).toBe(true);
    expect(hasMobileSpeechDrawerAction(buildGame({ availableActions: [{ type: "lastWords" }] }))).toBe(true);
    expect(hasMobileSpeechDrawerAction(buildGame({ availableActions: [{ type: "sheriffSpeech" }] }))).toBe(true);
  });

  it("does not route non-speech actions to the speech drawer", () => {
    expect(hasMobileSpeechDrawerAction(buildGame({ availableActions: [{ type: "continue", label: "Continue", description: "Advance flow" }] }))).toBe(false);
    expect(hasMobileSpeechDrawerAction(buildGame({ availableActions: [{ type: "seerCheck", targets: [] }] }))).toBe(false);
  });
});

describe("getMobileSpeechInputPrompt", () => {
  it("moves speech-style actions into the mobile bottom input bar", () => {
    expect(getMobileSpeechInputPrompt(buildGame({ availableActions: [{ type: "speak" }] }))).toEqual({
      label: "打开发言",
      ariaLabel: "打开本轮发言输入",
    });
    expect(shouldShowMobileStageAction(buildGame({ availableActions: [{ type: "speak" }] }))).toBe(false);
  });

  it("keeps non-speech actions on the table stage", () => {
    expect(getMobileSpeechInputPrompt(buildGame({ availableActions: [{ type: "seerCheck", targets: [] }] }))).toBeUndefined();
    expect(shouldShowMobileStageAction(buildGame({ availableActions: [{ type: "seerCheck", targets: [] }] }))).toBe(true);
  });
});

describe("getMobileSpeechHighlights", () => {
  it("uses the latest speech as the primary mobile subtitle", () => {
    expect(getMobileSpeechHighlights([speechOne, speechTwo, speechThree])).toEqual({
      primary: speechThree,
      previous: speechTwo,
    });
  });

  it("keeps a single speech as the primary subtitle", () => {
    expect(getMobileSpeechHighlights([speechOne])).toEqual({
      primary: speechOne,
      previous: undefined,
    });
  });
});

describe("getMobileFilteredSpeeches", () => {
  it("keeps only speeches from the selected seat", () => {
    expect(getMobileFilteredSpeeches([speechOne, speechTwo, speechThree], 5)).toEqual([speechThree]);
  });

  it("returns every speech when no seat is selected", () => {
    expect(getMobileFilteredSpeeches([speechOne, speechTwo], null)).toEqual([speechOne, speechTwo]);
  });
});

describe("getMobileDrawerSnapshot", () => {
  it("summarizes speech, vote, and log activity for the mobile dock", () => {
    const game = buildGame({
      phase: "DAY_VOTE",
      tableSummary: {
        ...buildGame().tableSummary,
        recentSpeeches: [speechOne, speechTwo],
        voteSnapshot: {
          votes: [
            {
              seq: 7,
              day: 1,
              voter: { seatId: 1, name: "You" },
              target: { seatId: 2, name: "DeepSeek" },
            },
          ],
          tally: [],
          leaders: [],
          revealed: true,
        },
      },
      publicEvents: [
        {
          seq: 9,
          type: "VOTE_CAST",
          day: 1,
          phase: "DAY_VOTE",
          message: "Vote locked",
          payload: {},
        },
      ],
    } as Partial<HumanGameView>);

    expect(getMobileDrawerSnapshot(game, game.publicEvents)).toEqual({
      latestSpeechSeq: 2,
      latestSpeechSeatId: 4,
      latestSpeechLabel: "4号 GPT",
      voteMarker: 1,
      logMarker: 9,
      logCount: 1,
      recommendedTab: "vote",
    });
  });

  it("recommends the speech drawer during speech-like phases", () => {
    expect(getMobileDrawerSnapshot(buildGame({ phase: "DAY_SPEECH" }), []).recommendedTab).toBe("speech");
    expect(getMobileDrawerSnapshot(buildGame({ phase: "LAST_WORDS" }), []).recommendedTab).toBe("speech");
  });

  it("recommends the identity drawer during night phases", () => {
    expect(getMobileDrawerSnapshot(buildGame({ phase: "NIGHT_SEER" }), []).recommendedTab).toBe("identity");
  });
});

describe("getMobileDrawerActivityMeta", () => {
  it("labels the latest speech speaker and unread speech activity", () => {
    const snapshot = getMobileDrawerSnapshot(
      buildGame({
        tableSummary: {
          ...buildGame().tableSummary,
          recentSpeeches: [speechOne, speechTwo],
        },
      }),
      [],
    );

    expect(getMobileDrawerActivityMeta("speech", snapshot, { latestSpeechSeq: 1, voteMarker: 0, logMarker: 0 })).toEqual({
      kind: "speaker",
      label: "4号 GPT",
      unreadCount: 1,
    });
  });

  it("counts unseen vote and log activity for drawer badges", () => {
    const snapshot = getMobileDrawerSnapshot(
      buildGame({
        tableSummary: {
          ...buildGame().tableSummary,
          voteSnapshot: {
            votes: [
              {
                seq: 7,
                day: 1,
                voter: { seatId: 1, name: "You" },
                target: { seatId: 2, name: "DeepSeek" },
              },
            ],
            tally: [{ target: { seatId: 2, name: "DeepSeek" }, count: 1 }],
            leaders: [{ seatId: 2, name: "DeepSeek" }],
            revealed: true,
          },
        },
        publicEvents: [{ seq: 11, type: "VOTE_CAST", day: 1, phase: "DAY_VOTE", message: "Vote locked", payload: {} }],
      } as Partial<HumanGameView>),
      [{ seq: 11, type: "VOTE_CAST", day: 1, phase: "DAY_VOTE", message: "Vote locked", payload: {} }],
    );
    const seen = { latestSpeechSeq: 0, voteMarker: 1, logMarker: 8 };

    expect(getMobileDrawerActivityMeta("vote", snapshot, seen)).toEqual({
      kind: "count",
      label: "3",
      unreadCount: 2,
    });
    expect(getMobileDrawerActivityMeta("log", snapshot, seen)).toEqual({
      kind: "count",
      label: "1",
      unreadCount: 1,
    });
  });

  it("uses the role label for identity without unread activity", () => {
    const snapshot = getMobileDrawerSnapshot(buildGame(), []);

    expect(getMobileDrawerActivityMeta("identity", snapshot, { latestSpeechSeq: 0, voteMarker: 0, logMarker: 0 }, "预言家")).toEqual({
      kind: "role",
      label: "预言家",
      unreadCount: 0,
    });
  });
});

describe("getMobilePhaseSignalTone", () => {
  it("maps phase families to mobile signal tones", () => {
    expect(getMobilePhaseSignalTone("NIGHT_SEER" as HumanGameView["phase"])).toBe("night");
    expect(getMobilePhaseSignalTone("DAY_SPEECH" as HumanGameView["phase"])).toBe("day");
    expect(getMobilePhaseSignalTone("DAY_VOTE" as HumanGameView["phase"])).toBe("vote");
    expect(getMobilePhaseSignalTone("LAST_WORDS" as HumanGameView["phase"])).toBe("danger");
    expect(getMobilePhaseSignalTone("GAME_OVER" as HumanGameView["phase"])).toBe("end");
  });
});

describe("MOBILE_INFO_TABS", () => {
  it("keeps the mobile info tabs in shell order", () => {
    expect(MOBILE_INFO_TABS.map((tab) => tab.key)).toEqual(["identity", "speech", "vote", "log"]);
    expect(MOBILE_INFO_TABS.map((tab) => tab.label)).toEqual(["身份", "发言", "票型", "记录"]);
  });
});

describe("getMobileSeatStageLayout", () => {
  it("places six-player seats in two side columns for the phone stage", () => {
    expect(getMobileSeatStageLayout(0, 6)).toEqual({ compact: false, left: 12, top: 27, side: "left" });
    expect(getMobileSeatStageLayout(2, 6)).toEqual({ compact: false, left: 12, top: 75, side: "left" });
    expect(getMobileSeatStageLayout(3, 6)).toEqual({ compact: false, left: 88, top: 27, side: "right" });
    expect(getMobileSeatStageLayout(5, 6)).toEqual({ compact: false, left: 88, top: 75, side: "right" });
  });

  it("uses a compact ring for larger boards", () => {
    expect(getMobileSeatStageLayout(0, 12)).toEqual({ compact: true, left: 50, top: 16, side: "ring" });
    expect(getMobileSeatStageLayout(6, 12)).toEqual({ compact: true, left: 50, top: 82, side: "ring" });
  });
});

describe("getMobileAudioButtonStates", () => {
  it("marks mobile audio buttons from enabled preferences, not transient playback status", () => {
    expect(
      getMobileAudioButtonStates({
        hostAudioEnabled: true,
        aiSpeechAudioEnabled: true,
        aiSpeechAudioUnavailable: false,
      }),
    ).toEqual({ hostActive: true, hostPressed: true, aiSpeechActive: true, aiSpeechPressed: true });
  });

  it("keeps AI speech logically pressed while styling the unavailable fallback as inactive", () => {
    expect(
      getMobileAudioButtonStates({
        hostAudioEnabled: false,
        aiSpeechAudioEnabled: true,
        aiSpeechAudioUnavailable: true,
      }),
    ).toEqual({ hostActive: false, hostPressed: false, aiSpeechActive: false, aiSpeechPressed: true });
  });
});

describe("getMobileSeatCardVisual", () => {
  it("uses a custom AI avatar when one is present", () => {
    const seat = {
      ...baseSeats[1],
      avatarDataUrl: "data:image/png;base64,avatar",
      personaName: "Claude",
    };

    expect(getMobileSeatCardVisual(seat)).toEqual({
      image: "data:image/png;base64,avatar",
      kind: "customAvatar",
      label: "Claude AI头像",
    });
  });

  it("falls back to the AI model card before hidden role art", () => {
    const seat = {
      ...baseSeats[1],
      name: "Claude",
      personaName: "Claude",
    };

    expect(getMobileSeatCardVisual(seat)).toEqual({
      image: "/images/model-claude.svg",
      kind: "modelCard",
      label: "Claude模型牌",
    });
  });

  it("uses visible role art when a role is known", () => {
    const seat = {
      ...baseSeats[0],
      role: "SEER" as const,
      roleLabel: "预言家",
    };

    expect(getMobileSeatCardVisual(seat)).toEqual({
      image: "/images/role-seer.jpg",
      kind: "roleCard",
      label: "预言家身份牌",
    });
  });
});

import { describe, expect, it } from "vitest";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import {
  getMobileActionMode,
  getMobileAudioButtonStates,
  getMobileFocusSeat,
  getMobileSeatCounts,
  MOBILE_INFO_TABS,
} from "./mobileTableModel";

const baseSeats: HumanGameView["seats"] = [
  { seatId: 1, name: "You", isAi: false, isHuman: true, alive: true },
  { seatId: 2, name: "Claude", isAi: true, isHuman: false, alive: true },
  { seatId: 3, name: "Kimi", isAi: true, isHuman: false, alive: false },
];

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

describe("MOBILE_INFO_TABS", () => {
  it("keeps the mobile info tabs in shell order", () => {
    expect(MOBILE_INFO_TABS.map((tab) => tab.key)).toEqual(["identity", "speech", "vote", "log"]);
    expect(MOBILE_INFO_TABS.map((tab) => tab.label)).toEqual(["身份", "发言", "票型", "记录"]);
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

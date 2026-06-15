import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import {
  buildOrdinarySurfaceEventFeed,
  GameClientLoadedSurface,
  shouldRenderOrdinaryDesktopSurface,
  shouldRenderOrdinaryMobileSurface,
  type GameClientLoadedSurfaceProps,
} from "./GameClientLoadedSurface";

function buildTableMemory(day = 1): HumanGameView["tableSummary"]["tableMemory"] {
  return {
    day,
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
  };
}

function buildGame(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-surface",
    day: 1,
    phase: "DAY_SPEECH",
    phaseLabel: "白天发言",
    board: { id: "9p-seer-witch-hunter", name: "9 人标准局", seatCount: 3, roleSummary: "test" } as HumanGameView["board"],
    humanSeatId: 1,
    seats: [
      { seatId: 1, name: "You", isAi: false, isHuman: true, alive: true },
      { seatId: 2, name: "DeepSeek", isAi: true, isHuman: false, alive: true },
      { seatId: 3, name: "Claude", isAi: true, isHuman: false, alive: true },
    ],
    publicEvents: [],
    privateEvents: [],
    availableActions: [{ type: "continue", label: "继续", description: "继续流程" }],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], pendingSeatIds: [], revealed: false, abstainCount: 0 },
      claimBoard: [],
      tableMemory: buildTableMemory(),
      aiReasonHighlights: [],
      phaseSteps: [],
    },
    ...overrides,
  } as unknown as HumanGameView;
}

function buildProps(overrides: Partial<GameClientLoadedSurfaceProps> = {}): GameClientLoadedSurfaceProps {
  const game = overrides.game ?? buildGame();
  return {
    game,
    loading: false,
    pendingCommandType: null,
    liveAiSpeech: null,
    hostAudioEnabled: false,
    aiSpeechAudioEnabled: false,
    hostAudioStatus: null,
    aiSpeechAudioStatus: null,
    aiSpeechAudioUnavailable: false,
    bufferedClassTrialContinueKey: null,
    classTrialThemeActive: false,
    classTrialIntroPending: false,
    classTrialIntroReady: false,
    classTrialIntroConfig: undefined,
    classTrialIntroMessage: "片头准备中",
    classTrialPackManifest: undefined,
    manualAiSpeechPlayback: null,
    effectiveAiRuntimeMode: "mock",
    onNewGame: async () => undefined,
    onReturnHome: async () => undefined,
    onSubmit: async () => undefined,
    onOpenIdentityBook: () => undefined,
    onOpenGlossary: () => undefined,
    onToggleAiSpeechAudio: () => undefined,
    onToggleHostAudio: () => undefined,
    onPauseAiSpeechAudio: () => undefined,
    onResumeAiSpeechAudio: async () => undefined,
    onSkipAiSpeechAudio: () => undefined,
    onCompleteClassTrialIntro: () => undefined,
    onSkipClassTrialIntro: () => undefined,
    ...overrides,
  };
}

describe("GameClientLoadedSurface", () => {
  it("keeps ordinary games split into mobile and desktop surfaces", () => {
    const html = renderToStaticMarkup(createElement(GameClientLoadedSurface, buildProps()));

    expect(html).toContain("mobile-game-table");
    expect(html).toContain("ordinary-desktop-match hidden sm:grid");
    expect(html).toContain("mobile-action-panel");
  });

  it("can drop the hidden ordinary surface after the viewport is known", () => {
    expect(shouldRenderOrdinaryMobileSurface("both")).toBe(true);
    expect(shouldRenderOrdinaryDesktopSurface("both")).toBe(true);
    expect(shouldRenderOrdinaryMobileSurface("mobile")).toBe(true);
    expect(shouldRenderOrdinaryDesktopSurface("mobile")).toBe(false);
    expect(shouldRenderOrdinaryMobileSurface("desktop")).toBe(false);
    expect(shouldRenderOrdinaryDesktopSurface("desktop")).toBe(true);
  });

  it("skips ordinary event-feed work for class-trial surfaces", () => {
    const game = buildGame({
      publicEvents: [
        { seq: 1, day: 1, phase: "NIGHT_WOLVES", type: "NIGHT_STARTED", message: "夜晚事件", payload: {} },
      ] as HumanGameView["publicEvents"],
    });

    expect(buildOrdinarySurfaceEventFeed(game, true)).toEqual([]);
    expect(buildOrdinarySurfaceEventFeed(game, false)).toHaveLength(1);
  });

  it("shows a compact history entry for public speech and vote records", () => {
    const base = buildGame();
    const game = buildGame({
      publicEvents: [
        {
          seq: 11,
          day: 1,
          phase: "DAY_SPEECH",
          actorSeatId: 2,
          type: "SPEECH_CREATED",
          message: "2号发言",
          payload: { seatId: 2, message: "我认为1号的发言偏好。" },
        },
      ] as HumanGameView["publicEvents"],
      tableSummary: {
        ...base.tableSummary,
        recentSpeeches: [{ seq: 11, day: 1, speaker: { seatId: 2, name: "DeepSeek" }, message: "我认为1号的发言偏好。" }],
        tableMemory: {
          ...buildTableMemory(),
          voteHistory: [
            {
              day: 1,
              tally: [{ target: { seatId: 3, name: "Claude" }, count: 2 }],
              leaders: [{ seatId: 3, name: "Claude" }],
              exiled: { seatId: 3, name: "Claude" },
              tiedSeatIds: [],
            },
          ],
        },
      },
    });

    const html = renderToStaticMarkup(createElement(GameClientLoadedSurface, buildProps({ game })));

    expect(html).toContain("历史记录");
    expect(html).toContain("快速回看");
    expect(html).toContain("发言 1 · 投票 1");
  });

  it("shows the class-trial intro wait surface before the themed table", () => {
    const html = renderToStaticMarkup(
      createElement(
        GameClientLoadedSurface,
        buildProps({
          classTrialThemeActive: true,
          classTrialIntroPending: true,
          classTrialIntroReady: false,
          classTrialIntroMessage: "素材还在准备",
        }),
      ),
    );

    expect(html).toContain("正在准备开场片头");
    expect(html).toContain("素材还在准备");
    expect(html).not.toContain("mobile-game-table");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { GameClientLoadedSurface, type GameClientLoadedSurfaceProps } from "./GameClientLoadedSurface";

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
      tableMemory: {} as HumanGameView["tableSummary"]["tableMemory"],
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
    expect(html).toContain("hidden gap-4 sm:grid");
    expect(html).toContain("mobile-action-panel");
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

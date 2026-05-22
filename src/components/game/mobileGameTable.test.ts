import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import { MobileGameTable } from "./MobileGameTable";

function buildMobileActionGame(availableActions: AvailableHumanAction[]): HumanGameView {
  return {
    id: "mobile-action",
    day: 1,
    phase: "NIGHT_WOLVES",
    phaseLabel: "狼人行动",
    board: { id: "6p-beginner", name: "6 人新手局", seatCount: 3, roleSummary: "test" } as HumanGameView["board"],
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

describe("MobileGameTable", () => {
  it("renders all recent speeches as a scrollable mobile speech list", () => {
    const html = renderMobileTable({
      ...buildMobileActionGame([]),
      tableSummary: {
        ...buildMobileActionGame([]).tableSummary,
        recentSpeeches: [
          { seq: 1, day: 1, speaker: { seatId: 1, name: "You" }, message: "一号发言内容" },
          { seq: 2, day: 1, speaker: { seatId: 2, name: "DeepSeek" }, message: "二号发言内容" },
          { seq: 3, day: 1, speaker: { seatId: 3, name: "Claude" }, message: "三号发言内容" },
          { seq: 4, day: 1, speaker: { seatId: 4, name: "GPT" }, message: "四号发言内容" },
        ],
      },
    } as HumanGameView);

    expect(html).toContain("mobile-speech-list");
    expect(html).toContain("mobile-speech-bubble-latest");
    expect(html).toContain("mobile-drawer-tab-recommended");
    expect(html).toContain("mobile-drawer-tab-meta");
    expect(html).toContain("mobile-drawer-tab-dot");
    expect(html).toContain("一号发言内容");
    expect(html).toContain("二号发言内容");
    expect(html).toContain("三号发言内容");
    expect(html).toContain("四号发言内容");
    expect(html.match(/class="mobile-speech-bubble/g) ?? []).toHaveLength(4);
  });

  it("marks targetable seats so mobile players can act by tapping avatars", () => {
    const game = buildMobileActionGame([
      {
        type: "wolfKill",
        targets: [
          { seatId: 2, name: "DeepSeek" },
          { seatId: 3, name: "Claude" },
        ],
      },
    ]);
    const html = renderToStaticMarkup(
      createElement(MobileGameTable, {
        game,
        loading: false,
        pendingCommandType: null,
        liveAiSpeech: null,
        hostAudioEnabled: false,
        aiSpeechAudioEnabled: false,
        hostAudioStatus: null,
        aiSpeechAudioStatus: null,
        aiSpeechAudioUnavailable: false,
        events: [],
        onNewGame: async () => undefined,
        onSubmit: async () => undefined,
        onOpenIdentityBook: () => undefined,
        onOpenGlossary: () => undefined,
        onToggleAiSpeechAudio: () => undefined,
        onToggleHostAudio: () => undefined,
      }),
    );

    expect(html).toContain("mobile-seat-actionable");
    expect(html).toContain("mobile-seat-action-hit");
    expect(html).toContain("mobile-seat-action-feedback-source");
    expect(html).toContain('aria-label="击杀2号 DeepSeek"');
    expect(html).not.toContain("mobile-centered-action");
    expect(html).not.toContain("点头像选择目标");
    expect(html).not.toContain("mobile-target-chip");
    expect(html).not.toContain("night-target-card");
  });

  it("marks non-action seats as speech-filter shortcuts on mobile", () => {
    const html = renderMobileTable({
      ...buildMobileActionGame([]),
      tableSummary: {
        ...buildMobileActionGame([]).tableSummary,
        recentSpeeches: [{ seq: 1, day: 1, speaker: { seatId: 2, name: "DeepSeek" }, message: "Seat two speech" }],
      },
    } as HumanGameView);

    expect(html).toContain("mobile-seat-open-speech");
  });

  it("renders a lightweight mobile phase signal", () => {
    const html = renderMobileTable(buildMobileActionGame([]));

    expect(html).toContain("mobile-phase-signal");
    expect(html).toContain("mobile-phase-signal-night");
  });

  it("marks vote and log drawer tabs when mobile activity exists", () => {
    const html = renderMobileTable({
      ...buildMobileActionGame([]),
      phase: "DAY_VOTE",
      tableSummary: {
        ...buildMobileActionGame([]).tableSummary,
        voteSnapshot: {
          votes: [
            {
              seq: 2,
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
      publicEvents: [{ seq: 5, type: "VOTE_CAST", day: 1, phase: "DAY_VOTE", message: "Vote locked", payload: {} }],
    } as HumanGameView);

    expect(html).toContain("mobile-drawer-tab-recommended");
    expect(html.match(/mobile-drawer-tab-dot/g) ?? []).toHaveLength(2);
  });

  it("uses avatar taps for seer checks without a middle action panel", () => {
    const html = renderMobileTable(
      buildMobileActionGame([
        {
          type: "seerCheck",
          targets: [
            { seatId: 2, name: "DeepSeek" },
            { seatId: 3, name: "Claude" },
          ],
        },
      ]),
    );

    expect(html).toContain('aria-label="查验2号 DeepSeek"');
    expect(html).toContain("mobile-seat-action-seer");
    expect(html).not.toContain("mobile-centered-action");
    expect(html).not.toContain("night-target-card");
  });

  it("keeps skip-style controls small while hunter targets stay on avatars", () => {
    const html = renderMobileTable(
      buildMobileActionGame([
        {
          type: "hunterShoot",
          canSkip: true,
          targets: [
            { seatId: 2, name: "DeepSeek" },
            { seatId: 3, name: "Claude" },
          ],
        },
      ]),
    );

    expect(html).toContain('aria-label="带走2号 DeepSeek"');
    expect(html).toContain("mobile-centered-action");
    expect(html).toContain("不开枪");
    expect(html).not.toContain("mobile-target-chip");
    expect(html).not.toContain("night-target-card");
  });

  it("keeps witch save beside skip while poison stays on avatars", () => {
    const html = renderMobileTable(
      buildMobileActionGame([
        {
          type: "witchAction",
          canSave: true,
          saveTarget: { seatId: 2, name: "DeepSeek" },
          canPoison: true,
          poisonTargets: [
            { seatId: 2, name: "DeepSeek" },
            { seatId: 3, name: "Claude" },
          ],
        },
      ]),
    );

    expect(html).toContain("mobile-witch-quick-actions");
    expect(html).toContain("救 2号");
    expect(html).not.toContain('aria-label="救2号 DeepSeek"');
    expect(html).toContain('aria-label="毒3号 Claude"');
    expect(html).toContain("不用药");
    expect(html).not.toContain("night-target-card");
  });
});

function renderMobileTable(game: HumanGameView): string {
  return renderToStaticMarkup(
    createElement(MobileGameTable, {
      game,
      loading: false,
      pendingCommandType: null,
      liveAiSpeech: null,
      hostAudioEnabled: false,
      aiSpeechAudioEnabled: false,
      hostAudioStatus: null,
      aiSpeechAudioStatus: null,
      aiSpeechAudioUnavailable: false,
      events: game.publicEvents,
      onNewGame: async () => undefined,
      onSubmit: async () => undefined,
      onOpenIdentityBook: () => undefined,
      onOpenGlossary: () => undefined,
      onToggleAiSpeechAudio: () => undefined,
      onToggleHostAudio: () => undefined,
    }),
  );
}

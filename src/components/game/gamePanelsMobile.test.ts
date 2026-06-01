import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { GlossaryOverlay, IdentityBookOverlay, LandingPanel, RoleIntroOverlay, RoomHeader } from "./GamePanels";
import { getDefaultBoardOptions } from "./boardSelectionModel";
import { MobileTopStrip } from "./MobileSeatStage";

function buildGame(): HumanGameView {
  return {
    id: "mobile-game",
    day: 1,
    phase: "NIGHT_WOLVES",
    phaseLabel: "狼人行动",
    board: { id: "6p-beginner", name: "6 人新手局", seatCount: 6, roleSummary: "2狼 2民 预言家 猎人" } as HumanGameView["board"],
    humanSeatId: 1,
    myRole: "WEREWOLF",
    seats: [
      { seatId: 1, name: "You", isAi: false, isHuman: true, alive: true, role: "WEREWOLF", roleLabel: "狼人" },
      { seatId: 2, name: "DeepSeek", isAi: true, isHuman: false, alive: true },
    ],
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
  } as unknown as HumanGameView;
}

function countMobileLobbySeats(html: string): number {
  return html.match(/class="mobile-lobby-seat(?:\s|")/g)?.length ?? 0;
}

function getMobileLobbySeatSizes(html: string): number[] {
  return [...html.matchAll(/--lobby-seat-size:\s*(\d+)px/g)].map((match) => Number(match[1]));
}

describe("mobile game panels", () => {
  it("marks the role intro overlay for one-screen mobile sizing", () => {
    const html = renderToStaticMarkup(createElement(RoleIntroOverlay, { game: buildGame(), onEnter: () => undefined }));

    expect(html).toContain("role-intro-shell");
    expect(html).toContain("role-intro-hero");
    expect(html).toContain("role-intro-detail-grid");
    expect(html).toContain("role-intro-confirm");
  });

  it("lets players return home from the role intro overlay", () => {
    const html = renderToStaticMarkup(createElement(RoleIntroOverlay, { game: buildGame(), onEnter: () => undefined, onReturnHome: () => undefined }));

    expect(html).toContain("返回主页面");
  });

  it("marks identity book and glossary overlays as compact mobile knowledge panels", () => {
    const identityHtml = renderToStaticMarkup(
      createElement(IdentityBookOverlay, { game: buildGame(), activeBoardId: "6p-beginner", onClose: () => undefined }),
    );
    const glossaryHtml = renderToStaticMarkup(createElement(GlossaryOverlay, { onClose: () => undefined }));

    expect(identityHtml).toContain("mobile-knowledge-overlay");
    expect(identityHtml).toContain("mobile-knowledge-scroll");
    expect(identityHtml).toContain("mobile-knowledge-card");
    expect(identityHtml).toContain("mobile-knowledge-role-summary");
    expect(identityHtml).toContain("mobile-knowledge-role-lines");
    expect(glossaryHtml).toContain("mobile-knowledge-overlay");
    expect(glossaryHtml).toContain("mobile-knowledge-scroll");
    expect(glossaryHtml).toContain("mobile-knowledge-card");
  });

  it("marks the landing page for a compact one-screen mobile start flow", () => {
    const boards = getDefaultBoardOptions().slice(0, 3);
    const html = renderToStaticMarkup(
      createElement(LandingPanel, {
        loading: false,
        boards,
        selectedBoardId: boards[0]?.id ?? null,
        onSelectBoard: () => undefined,
        humanSeatMode: "fixed",
        selectedHumanSeatId: 1,
        onSelectRandomHumanSeat: () => undefined,
        onSelectFixedHumanSeat: () => undefined,
        onSelectNoHumanSeat: () => undefined,
        selectedAiFriendCount: 8,
        customAiFriendCount: 0,
        aiLineupPreview: [],
        recentGameIds: [],
        onLoadGame: async () => undefined,
        onStartGame: async () => undefined,
      }),
    );

    expect(html).toContain("mobile-home-shell");
    expect(html).toContain("mobile-home-status-bar");
    expect(html).not.toContain("mobile-home-ai-pool-action");
    expect(html).toContain("mobile-dock-ai-pool-action");
    expect(html).toContain("AI阵容");
    expect(html).not.toContain("mobile-home-config-strip");
    expect(html).toContain("mobile-board-strip");
    expect(html).toContain("mobile-board-chip");
    expect(html).toContain("mobile-home-primary-action");
    expect(html).toContain("mobile-lobby-stage");
    expect(html).toContain("mobile-lobby-seat-ring");
    expect(html).not.toContain("mobile-lobby-room-plaque");
    expect(html).toContain("mobile-home-dock");
    expect(html).toContain("mobile-lobby-table-glow");
    expect(html).toContain("mobile-dock-board-console");
    expect(html).toContain("mobile-seat-console");
    expect(html).toContain("真人模式");
    expect(html).not.toContain("随机座位");
    expect(html).toContain("mobile-cta-console");
  });

  it("renders every selected board seat in the mobile lobby stage", () => {
    const boards = getDefaultBoardOptions();
    const selectedBoards = ["9p-seer-witch-hunter", "12p-sheriff-seer-witch-hunter-guard"].map((boardId) => {
      const board = boards.find((item) => item.id === boardId);
      expect(board).toBeDefined();
      return board!;
    });

    for (const board of selectedBoards) {
      const html = renderToStaticMarkup(
        createElement(LandingPanel, {
          loading: false,
          boards,
          selectedBoardId: board.id,
          onSelectBoard: () => undefined,
          humanSeatMode: "fixed",
          selectedHumanSeatId: board.seatCount,
          onSelectRandomHumanSeat: () => undefined,
          onSelectFixedHumanSeat: () => undefined,
          onSelectNoHumanSeat: () => undefined,
          selectedAiFriendCount: 8,
          customAiFriendCount: 0,
          aiLineupPreview: [],
          recentGameIds: [],
          onLoadGame: async () => undefined,
          onStartGame: async () => undefined,
        }),
      );

      expect(countMobileLobbySeats(html)).toBe(board.seatCount);
      expect(html).toContain(`<span class="mobile-lobby-seat-number">${board.seatCount}</span><em>你</em>`);
    }
  });

  it("keeps mobile lobby avatars readable for 6, 9, and 12 player boards", () => {
    const boards = getDefaultBoardOptions();
    const cases = [
      { seatCount: 6, minSize: 48 },
      { seatCount: 9, minSize: 42 },
      { seatCount: 12, minSize: 38 },
    ];

    for (const item of cases) {
      const board = boards.find((option) => option.seatCount === item.seatCount);
      expect(board).toBeDefined();
      const html = renderToStaticMarkup(
        createElement(LandingPanel, {
          loading: false,
          boards,
          selectedBoardId: board!.id,
          onSelectBoard: () => undefined,
          humanSeatMode: "fixed",
          selectedHumanSeatId: item.seatCount,
          onSelectRandomHumanSeat: () => undefined,
          onSelectFixedHumanSeat: () => undefined,
          onSelectNoHumanSeat: () => undefined,
          selectedAiFriendCount: 8,
          customAiFriendCount: 0,
          aiLineupPreview: [],
          recentGameIds: [],
          onLoadGame: async () => undefined,
          onStartGame: async () => undefined,
        }),
      );

      const sizes = getMobileLobbySeatSizes(html);
      expect(sizes).toHaveLength(item.seatCount);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(item.minSize);
    }
  });

  it("marks high-player lobby seats with compact visual density", () => {
    const boards = getDefaultBoardOptions();
    const board = boards.find((item) => item.id === "12p-sheriff-seer-witch-hunter-guard");
    expect(board).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(LandingPanel, {
        loading: false,
        boards,
        selectedBoardId: board!.id,
        onSelectBoard: () => undefined,
        humanSeatMode: "fixed",
        selectedHumanSeatId: 12,
        onSelectRandomHumanSeat: () => undefined,
        onSelectFixedHumanSeat: () => undefined,
        onSelectNoHumanSeat: () => undefined,
        selectedAiFriendCount: 8,
        customAiFriendCount: 0,
        aiLineupPreview: [],
        recentGameIds: [],
        onLoadGame: async () => undefined,
        onStartGame: async () => undefined,
      }),
    );

    expect(html.match(/mobile-lobby-seat-dense/g) ?? []).toHaveLength(12);
    expect(html).toContain("12 位入座");
  });

  it("uses AI lineup avatars in the mobile lobby seats", () => {
    const boards = getDefaultBoardOptions();
    const board = boards.find((item) => item.id === "9p-seer-witch-hunter");
    expect(board).toBeDefined();
    const aiAvatar = "data:image/png;base64,ai-seat-avatar";

    const html = renderToStaticMarkup(
      createElement(LandingPanel, {
        loading: false,
        boards,
        selectedBoardId: board!.id,
        onSelectBoard: () => undefined,
        humanSeatMode: "fixed",
        selectedHumanSeatId: 3,
        onSelectRandomHumanSeat: () => undefined,
        onSelectFixedHumanSeat: () => undefined,
        onSelectNoHumanSeat: () => undefined,
        selectedAiFriendCount: 8,
        customAiFriendCount: 0,
        aiLineupPreview: [
          { seatId: 1, nickname: "DeepSeek", avatarDataUrl: aiAvatar, isHuman: false, autoFilled: false },
          { seatId: 3, nickname: "你", isHuman: true, autoFilled: false },
        ],
        recentGameIds: [],
        onLoadGame: async () => undefined,
        onStartGame: async () => undefined,
      }),
    );

    expect(html).toContain("mobile-lobby-seat-with-avatar");
    expect(html).toContain("mobile-lobby-seat-avatar");
    expect(html).toContain(aiAvatar);
    expect(html).toContain("mobile-lobby-seat-number");
  });

  it("shows the local-only class trial theme entry without replacing rooms", () => {
    const boards = getDefaultBoardOptions();
    const html = renderToStaticMarkup(
      createElement(LandingPanel, {
        loading: false,
        boards,
        selectedBoardId: boards[0]?.id ?? null,
        onSelectBoard: () => undefined,
        humanSeatMode: "none",
        selectedHumanSeatId: null,
        onSelectRandomHumanSeat: () => undefined,
        onSelectFixedHumanSeat: () => undefined,
        onSelectNoHumanSeat: () => undefined,
        selectedAiFriendCount: 9,
        customAiFriendCount: 0,
        aiLineupPreview: [],
        recentGameIds: [],
        onLoadGame: async () => undefined,
        onStartGame: async () => undefined,
        classTrialThemeMode: "class-trial",
        classTrialAiRuntimeMode: "llm",
        classTrialPackAvailable: false,
        classTrialPackMessage:
          "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。 未找到本地角色卡。视觉主题可继续，AI 将使用普通行为。",
        classTrialIntroMessage: "开场片头音频准备中：7 / 9",
        onSelectClassTrialThemeMode: () => undefined,
      }),
    );

    expect(html).toContain("学级裁判主题局");
    expect(html).toContain("本地限定");
    expect(html).toContain("真实 LLM");
    expect(html).toContain("DeepSeek-v4");
    expect(html).toContain("未找到本地主题素材包");
    expect(html).toContain("未找到本地角色卡");
    expect(html).toContain("开场片头音频准备中：7 / 9");
    expect(html).toContain("/rooms");
  });

  it("keeps the duplicate top start action off the home header", () => {
    const html = renderToStaticMarkup(
      createElement(RoomHeader, {
        game: null,
        loading: false,
        aiSpeechAudioEnabled: false,
        aiSpeechAudioUnavailable: false,
        hostAudioEnabled: false,
        onNewGame: async () => undefined,
        onOpenIdentityBook: () => undefined,
        onOpenGlossary: () => undefined,
        onToggleAiSpeechAudio: () => undefined,
        onToggleHostAudio: () => undefined,
      }),
    );

    expect(html).not.toContain("mobile-home-header-start");
    expect(html).toContain("mobile-home-tool-icon");
    expect(html).toContain("mobile-home-tool-label");
  });

  it("shows a desktop return-home action while a game is in progress", () => {
    const html = renderToStaticMarkup(
      createElement(RoomHeader, {
        game: buildGame(),
        loading: false,
        aiSpeechAudioEnabled: false,
        aiSpeechAudioUnavailable: false,
        hostAudioEnabled: false,
        onNewGame: async () => undefined,
        onReturnHome: () => undefined,
        onOpenIdentityBook: () => undefined,
        onOpenGlossary: () => undefined,
        onToggleAiSpeechAudio: () => undefined,
        onToggleHostAudio: () => undefined,
      }),
    );

    expect(html).toContain("返回主页面");
  });

  it("shows a mobile return-home action while a game is in progress", () => {
    const html = renderToStaticMarkup(
      createElement(MobileTopStrip, {
        game: buildGame(),
        loading: false,
        hostAudioEnabled: false,
        aiSpeechAudioEnabled: false,
        aiSpeechAudioUnavailable: false,
        actionStatus: "等待 AI 行动",
        onNewGame: async () => undefined,
        onReturnHome: () => undefined,
        onOpenIdentityBook: () => undefined,
        onOpenGlossary: () => undefined,
        onToggleAiSpeechAudio: () => undefined,
        onToggleHostAudio: () => undefined,
      }),
    );

    expect(html).toContain("返回主页面");
  });
});

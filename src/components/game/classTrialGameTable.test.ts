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
    expect(html).toContain("class-trial-table-speaking");
    expect(html).toContain("class-trial-focus-enter");
    expect(html).toContain("filter:blur(2.4px)");
    expect(html).toContain("opacity:0.28");
    expect(html).toContain("白天发言");
    expect(html).toContain("腐川冬子 发言中");
    expect(html).toContain("先不要急着归票。");
    expect(html).not.toContain("预言家");
    expect(html).not.toContain("狼人");
  });

  it("shows real LLM runtime status in the themed table chrome", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        aiRuntimeMode: "llm",
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("真实 LLM");
    expect(html).toContain("DeepSeek-v4");
  });

  it("uses local pack avatars and portraits when a manifest is present", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [
            { id: "naegi", displayName: "苗木诚", avatarUrl: "/class-trial-pack/avatars/苗木诚.png", portraitUrl: "/class-trial-pack/portraits/苗木诚.png" },
            { id: "kirigiri", displayName: "雾切响子", avatarUrl: "/class-trial-pack/avatars/雾切响子.png", portraitUrl: "/class-trial-pack/portraits/雾切响子.png" },
            { id: "fukawa", displayName: "腐川冬子", avatarUrl: "/class-trial-pack/avatars/腐川冬子.png", portraitUrl: "/class-trial-pack/portraits/腐川冬子.png" },
          ],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain('class="class-trial-seat-avatar"');
    expect(html).toContain('src="/class-trial-pack/avatars/苗木诚.png"');
    expect(html).toContain('alt="腐川冬子"');
    expect(html).toContain('src="/class-trial-pack/portraits/腐川冬子.png"');
  });

  it("shows visible seat numbers on every class-trial podium", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-seat-number");
    expect(html).toContain(">1号<");
    expect(html).toContain(">9号<");
  });

  it("uses a dedicated thinking portrait while the speaker voice is preparing", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "loading",
          preparationStage: "generating",
          text: "先不要急着归票。",
        },
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [
            {
              id: "fukawa",
              displayName: "腐川冬子",
              portraitUrl: "/class-trial-pack/portraits/腐川冬子.png",
              thinkingPortraitUrl: "/class-trial-pack/thinking-portraits/腐川冬子.png",
            },
          ],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain('src="/class-trial-pack/thinking-portraits/腐川冬子.png"');
    expect(html).toContain('data-portrait-state="thinking"');
    expect(html).not.toContain('src="/class-trial-pack/portraits/腐川冬子.png"');
  });

  it("renders portrait calibration CSS variables on the speaking portrait", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          currentSpeakerSeatId: 9,
          tableSummary: {
            ...makeGame().tableSummary,
            recentSpeeches: [{ seq: 13, day: 2, speaker: { seatId: 9, name: "千早爱音" }, message: "我来当大小基准。" }],
          },
        }),
        loading: false,
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [{ id: "anon", displayName: "千早爱音", portraitUrl: "/class-trial-pack/portraits/千早爱音.png" }],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain('data-portrait-id="anon"');
    expect(html).toContain("--class-trial-portrait-scale:1.28");
    expect(html).toContain("--class-trial-portrait-x:0%");
    expect(html).toContain("--class-trial-portrait-y:-4%");
  });

  it("uses Chihaya Anon's safer thinking portrait layout while her voice is preparing", () => {
    const baseGame = makeGame();
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          currentSpeakerSeatId: 9,
          tableSummary: {
            ...baseGame.tableSummary,
            recentSpeeches: [{ seq: 13, day: 2, speaker: { seatId: 9, name: "千早爱音" }, message: "我还在想怎么接。" }],
          },
        }),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:13:9",
          speaker: { seatId: 9, name: "千早爱音" },
          state: "loading",
          preparationStage: "generating",
          text: "我还在想怎么接。",
        },
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [
            {
              id: "anon",
              displayName: "千早爱音",
              portraitUrl: "/class-trial-pack/portraits/千早爱音.png",
              thinkingPortraitUrl: "/class-trial-pack/thinking-portraits/千早爱音.png",
            },
          ],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain('src="/class-trial-pack/thinking-portraits/千早爱音.png"');
    expect(html).toContain('data-portrait-state="thinking"');
    expect(html).toContain("--class-trial-portrait-scale:1");
    expect(html).toContain("--class-trial-portrait-x:0%");
    expect(html).toContain("--class-trial-portrait-y:3%");
    expect(html).not.toContain("--class-trial-portrait-scale:1.28");
    expect(html).not.toContain("--class-trial-portrait-y:-4%");
  });

  it("renders Tomori at seat eight without identity labels", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          currentSpeakerSeatId: 8,
          tableSummary: {
            ...makeGame().tableSummary,
            recentSpeeches: [{ seq: 11, day: 2, speaker: { seatId: 8, name: "高松灯" }, message: "我、我想再确认一下。" }],
          },
        }),
        loading: false,
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [
            {
              id: "tomori",
              displayName: "高松灯",
              avatarUrl: "/class-trial-pack/avatars/高松灯.png",
              portraitUrl: "/class-trial-pack/portraits/高松灯.png",
            },
          ],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("高松灯 发言中");
    expect(html).toContain('src="/class-trial-pack/portraits/高松灯.png"');
    expect(html).toContain("我、我想再确认一下。");
    expect(html).not.toContain("预言家");
    expect(html).not.toContain("狼人");
  });

  it("marks the dialogue box as typewriter-ready with a plain-text fallback", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-dialogue-text");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("先不要急着归票。");
  });

  it("keeps class-trial dialogue in thinking state while matching audio is loading", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "loading",
          text: "先不要急着归票。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("正在思考/准备发言。");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("uses stage-specific class-trial copy while speech audio is generating", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "loading",
          preparationStage: "generating",
          text: "先不要急着归票。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("正在生成语音。");
    expect(html).not.toContain("正在思考/准备发言。");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("shows ready-to-play copy after speech audio has been prepared", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "loading",
          preparationStage: "ready",
          text: "先不要急着归票。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("准备播放。");
    expect(html).not.toContain("正在思考/准备发言。");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("shows a manual play button when browser audio playback needs a click", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "paused",
          preparationStage: "ready",
          text: "先不要急着归票。",
        },
        manualAudioPlayback: {
          speechKey: "game-1:10:3",
          speakerSeatId: 3,
          onPlay: () => undefined,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("点击播放语音");
    expect(html).toContain("请点击播放语音。");
    expect(html).toContain("浏览器拦截了自动播放");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("keeps class-trial dialogue in thinking state while waiting for speech audio to start", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: true,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("正在思考/准备发言。");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("uses matching audio progress to reveal partial class-trial dialogue", () => {
    const baseGame = makeGame();
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          tableSummary: {
            ...baseGame.tableSummary,
            recentSpeeches: [{ seq: 10, day: 2, speaker: { seatId: 3, name: "角色3" }, message: "同步" }],
          },
        }),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "playing",
          text: "同步",
          playbackProgress: 0,
          syncedTypewriter: true,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("同");
    expect(html).not.toContain("同步");
  });

  it("uses matching live AI speech before the speech is committed", () => {
    const baseGame = makeGame();
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          tableSummary: {
            ...baseGame.tableSummary,
            recentSpeeches: [],
          },
        }),
        loading: false,
        liveAiSpeech: {
          gameId: "game-1",
          speaker: { seatId: 3, name: "角色3" },
          text: "我正在整理新的发言。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("我正在整理新的发言。");
    expect(html).not.toContain("正在思考/准备发言。");
  });

  it("uses the current audio chunk while the matching live speech is still streaming", () => {
    const baseGame = makeGame();
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          tableSummary: {
            ...baseGame.tableSummary,
            recentSpeeches: [],
          },
        }),
        loading: false,
        liveAiSpeech: {
          gameId: "game-1",
          speaker: { seatId: 3, name: "角色3" },
          text: "同步以后还会继续补充。",
        },
        audioTypewriter: {
          speechKey: "game-1:10:3:chunk:0",
          speaker: { seatId: 3, name: "角色3" },
          state: "playing",
          text: "同步",
          playbackProgress: 0,
          syncedTypewriter: true,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("同");
    expect(html).not.toContain("同步");
    expect(html).not.toContain("正在思考/准备发言。");
  });

  it("keeps the active audio speaker visible after the game advances to the next speaker", () => {
    const baseGame = makeGame();
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          currentSpeakerSeatId: 4,
          tableSummary: {
            ...baseGame.tableSummary,
            recentSpeeches: [{ seq: 11, day: 2, speaker: { seatId: 4, name: "角色4" }, message: "下一位已经准备好了。" }],
          },
        }),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3:chunk:0",
          speaker: { seatId: 3, name: "角色3" },
          state: "playing",
          text: "同步",
          playbackProgress: 0,
          syncedTypewriter: true,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("腐川冬子 发言中");
    expect(html).toContain("同");
    expect(html).not.toContain("黑白熊 发言中");
    expect(html).not.toContain("下一位已经准备好了。");
  });

  it("shows full dialogue when matching audio progress is complete", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "playing",
          text: "先不要急着归票。",
          playbackProgress: 1,
          syncedTypewriter: true,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("先不要急着归票。");
  });

  it("keeps a loading audio speaker in thinking state after the game advances to another speaker", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({ currentSpeakerSeatId: 4 }),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "loading",
          text: "先不要急着归票。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("腐川冬子 发言中");
    expect(html).toContain("正在思考/准备发言。");
    expect(html).not.toContain("黑白熊 发言中");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("hides the portrait and dialogue when no character is actively speaking", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          currentSpeakerSeatId: undefined,
          currentActorSeatId: undefined,
          tableSummary: {
            ...makeGame().tableSummary,
            recentSpeeches: [{ seq: 12, day: 2, speaker: { seatId: 8, name: "高松灯" }, message: "我会把这句话说清楚。" }],
          },
        }),
        loading: false,
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [{ id: "tomori", displayName: "高松灯", portraitUrl: "/class-trial-pack/portraits/高松灯.png" }],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("等待发言");
    expect(html).toContain("filter:none");
    expect(html).toContain("opacity:0.82");
    expect(html).not.toContain("class-trial-table-speaking");
    expect(html).not.toContain("class-trial-focus");
    expect(html).not.toContain('src="/class-trial-pack/portraits/高松灯.png"');
    expect(html).not.toContain("我会把这句话说清楚。");
    expect(html).not.toContain("等待发言 发言中");
  });

  it("can highlight an action actor without showing a speaker portrait", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          phaseLabel: "狼人行动",
          currentSpeakerSeatId: undefined,
          currentActorSeatId: 8,
          tableSummary: {
            ...makeGame().tableSummary,
            recentSpeeches: [],
          },
        }),
        loading: false,
        manifest: {
          id: "class-trial-pack",
          version: "local",
          characters: [{ id: "tomori", displayName: "高松灯", portraitUrl: "/class-trial-pack/portraits/高松灯.png" }],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("高松灯 行动中");
    expect(html).toContain("class-trial-seat class-trial-seat-active");
    expect(html).toContain("filter:none");
    expect(html).toContain("opacity:0.82");
    expect(html).not.toContain("class-trial-table-speaking");
    expect(html).not.toContain("class-trial-focus");
    expect(html).not.toContain('src="/class-trial-pack/portraits/高松灯.png"');
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

  it("uses a class-trial stage background on the themed table", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-table");
    expect(html).toContain("class-trial-court-stage");
  });

  it("uses the local court background URL when the manifest provides one", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        manifest: {
          id: "class-trial-pack",
          version: "local",
          backgrounds: { courtMain: "/class-trial-pack/backgrounds/court-main.png" },
          characters: [],
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("--class-trial-court-background:url(/class-trial-pack/backgrounds/court-main.png)");
  });

  it("marks dead seats as departed without revealing identity or death reason", () => {
    const deadSeats = makeGame().seats.map((seat) =>
      seat.seatId === 4
        ? { ...seat, alive: false, role: "WITCH" as const, roleLabel: "女巫", deathReason: "WITCH_POISON" as const }
        : seat,
    );
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({ currentSpeakerSeatId: undefined, seats: deadSeats }),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-seat-dead");
    expect(html).toContain("已退场");
    expect(html).not.toContain("女巫");
    expect(html).not.toContain("WITCH_POISON");
    expect(html).not.toContain("被毒");
  });

  it("automatically renders the class-trial verdict review at game over", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          phase: "GAME_OVER",
          phaseLabel: "游戏结束",
          result: { winner: "GOOD", reason: "所有狼人出局" },
          review: {
            result: { winner: "GOOD", reason: "所有狼人出局" },
            roleReveal: [{ seatId: 4, name: "黑白熊", role: "WEREWOLF", roleLabel: "狼人", camp: "WEREWOLVES", alive: false }],
            claims: [],
            stanceShifts: [],
            strategyNotes: [],
            voteImpacts: [],
            aiInsights: [],
            playerFeedback: [],
            nightRounds: [],
            dayRounds: [],
            deathTimeline: [],
            keyEvents: [],
            turningPoints: [{ day: 2, title: "关键投票", description: "黑白熊被放逐。" }],
          },
        }),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-verdict-review");
    expect(html).toContain("最终裁决");
    expect(html).toContain("关键投票");
  });
});

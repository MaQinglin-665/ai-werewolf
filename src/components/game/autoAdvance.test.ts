import { describe, expect, it } from "vitest";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type { SpeechItem } from "./clientTypes";
import {
  getAutoAdvanceDelay,
  getLatestStreamableAiSpeech,
  getNextPlayableAiSpeech,
  speechStreamKey,
} from "./autoAdvance";

describe("autoAdvance helpers", () => {
  it("does not delay non-continue actions", () => {
    const game = gameView({ phase: "DAY_VOTE" });
    const action = { type: "vote", targets: [], canAbstain: true } as Extract<AvailableHumanAction, { type: "vote" }>;

    expect(getAutoAdvanceDelay(game, action)).toBe(0);
  });

  it("uses a bounded reading delay when AI speech should be read before continuing", () => {
    const game = gameView({ phase: "DAY_SPEECH" });
    const action = { type: "continue" } as Extract<AvailableHumanAction, { type: "continue" }>;

    expect(getAutoAdvanceDelay(game, action, speechItem({ message: "站边理由很短。" }))).toBe(2600);
    expect(getAutoAdvanceDelay(game, action, speechItem({ message: "长".repeat(600) }))).toBe(22000);
  });

  it("returns the latest streamable AI speech and skips the human seat", () => {
    const game = gameView({
      humanSeatId: 1,
      recentSpeeches: [
        speechItem({ seq: 1, speakerSeatId: 2, message: "我先发言。" }),
        speechItem({ seq: 2, speakerSeatId: 1, message: "我是真人。" }),
      ],
    });

    expect(getLatestStreamableAiSpeech(game)).toBeUndefined();

    const nextGame = gameView({
      humanSeatId: 1,
      recentSpeeches: [
        speechItem({ seq: 1, speakerSeatId: 1, message: "我是真人。" }),
        speechItem({ seq: 2, speakerSeatId: 3, message: "我补充一条。" }),
      ],
    });

    expect(getLatestStreamableAiSpeech(nextGame)?.seq).toBe(2);
  });

  it("finds the first unplayed AI speech by stream key", () => {
    const first = speechItem({ seq: 1, speakerSeatId: 2, message: "第一段。" });
    const second = speechItem({ seq: 2, speakerSeatId: 3, message: "第二段。" });
    const game = gameView({ recentSpeeches: [first, second] });
    const completed = new Set([speechStreamKey(game.id, first)]);

    expect(getNextPlayableAiSpeech(game, completed)).toBe(second);
    expect(speechStreamKey(game.id, second)).toBe("game-1:2:4");
  });
});

function gameView(overrides: Partial<HumanGameView> & { recentSpeeches?: SpeechItem[] } = {}): HumanGameView {
  const recentSpeeches = overrides.recentSpeeches ?? [];
  return {
    id: "game-1",
    day: 1,
    phase: "DAY_SPEECH",
    phaseLabel: "白天发言",
    board: { id: "6p", name: "6人局", seatCount: 6, roles: [] },
    humanSeatId: 1,
    seats: [],
    publicEvents: [],
    privateEvents: [],
    availableActions: [{ type: "continue" }],
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches,
      voteSnapshot: { votes: [], tally: [] },
      claimBoard: [],
      tableMemory: {},
      aiReasonHighlights: [],
      phaseSteps: [],
    },
    ...overrides,
  } as HumanGameView;
}

function speechItem({
  seq = 1,
  speakerSeatId = 2,
  message,
}: {
  seq?: number;
  speakerSeatId?: number;
  message: string;
}): SpeechItem {
  return {
    seq,
    speaker: { seatId: speakerSeatId, name: `${speakerSeatId}号` },
    message,
  } as SpeechItem;
}

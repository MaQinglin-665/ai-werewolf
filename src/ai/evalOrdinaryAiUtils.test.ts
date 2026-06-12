import { describe, expect, it } from "vitest";
import { buildEvalCaseFromAiLog, formatOrdinaryEvalMarkdown } from "../../scripts/eval-ordinary-ai-utils.mjs";

describe("ordinary AI eval report formatting", () => {
  it("prints sample-level metrics in the markdown report", () => {
    const markdown = formatOrdinaryEvalMarkdown({
      generatedAt: "2026-06-11T00:00:00.000Z",
      options: {
        source: "mock",
        boardId: "9p-seer-witch-hunter",
        games: 1,
        seedStart: 91,
        maxSteps: 160,
        inputPath: undefined,
      },
      summary: {
        totalCases: 1,
        averageScore: 100,
        issueCount: 0,
        highRiskCaseIds: [],
        byIssueCode: {},
        sampleMetrics: [
          {
            code: "action_distribution_skew",
            severity: "warn",
            detail: "Most seats picked up the same prior-seat move.",
            value: 0.86,
            evidence: ["quoteOrCarry 6", "waterOrHold 1"],
          },
        ],
      },
      results: [
        {
          id: "case-1",
          phase: "DAY_SPEECH",
          task: "speech",
          score: 100,
          issueCodes: [],
          issues: [],
          outputTextSnippet: "我先过，听一圈。",
          case: { playerRole: "VILLAGER" },
        },
      ],
    });

    expect(markdown).toContain("## Sample Metrics");
    expect(markdown).toContain("[warn] action_distribution_skew");
    expect(markdown).toContain("quoteOrCarry 6");
  });

  it("counts referenced public cues from recent speeches when building eval cases", () => {
    const evalCase = buildEvalCaseFromAiLog(
      {
        gameId: "game-1",
        day: 1,
        phase: "DAY_SPEECH",
        seatNumber: 3,
        prompt: {
          myRole: "VILLAGER",
          publicSummary: {
            recentSpeeches: [
              {
                speaker: { seatId: 1, name: "DeepSeek" },
                message: "我是1号DeepSeek。底牌不虚，但今天先不急着拍身份。",
              },
            ],
          },
          aliveSeats: [{ seatId: 1 }, { seatId: 2 }, { seatId: 3 }],
        },
        output: {
          type: "speak",
          message: "我回看1号DeepSeek那句底牌不虚，先不照着他的话压票。",
        },
      },
      0,
      { seed: 91 },
    );

    expect(evalCase.availablePublicCueCount).toBeGreaterThan(0);
    expect(evalCase.referencedPublicCueCount).toBeGreaterThan(0);
  });

  it("uses the rendered prior own speech for vote-continuity eval cases", () => {
    const evalCase = buildEvalCaseFromAiLog(
      {
        gameId: "game-1",
        day: 2,
        phase: "DAY_VOTE",
        seatNumber: 1,
        prompt: {
          mySeatId: 1,
          myRole: "HUNTER",
          privateKnowledge: {
            aiMemory: {
              lastSpeechTargetSeatId: 4,
              lastSpeechStance: "4号计划目标，但实际没说出口",
            },
          },
          publicSummary: {
            recentSpeeches: [
              {
                speaker: { seatId: 1, name: "DeepSeek" },
                message: "5号倒牌，狼刀成功，女巫没救。我先看今天票型怎么走。",
              },
            ],
          },
          aliveSeats: [{ seatId: 1 }, { seatId: 2 }, { seatId: 4 }],
        },
        output: {
          type: "vote",
          targetSeatId: 4,
          reason: "我上一轮发言已经点过4号豆包，这一轮投票先保持一致。",
        },
      },
      0,
      { seed: 91 },
    );

    expect(evalCase.previousSpeechText).toContain("5号倒牌");
    expect(evalCase.previousSpeechText).not.toContain("计划目标");
  });

  it("copies public claim board summaries into eval metadata", () => {
    const evalCase = buildEvalCaseFromAiLog(
      {
        gameId: "game-1",
        day: 2,
        phase: "DAY_SPEECH",
        seatNumber: 7,
        prompt: {
          myRole: "SEER",
          publicSummary: {
            claimBoard: [
              {
                claimant: { seatId: 2, name: "Claude" },
                claimedRole: "WITCH",
                checks: [],
              },
              {
                claimant: { seatId: 3, name: "GPT" },
                claimedRole: "SEER",
                checks: [{ target: { seatId: 5, name: "Mimo" }, result: "WEREWOLF" }],
              },
            ],
            recentSpeeches: [],
          },
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 3, name: "GPT" },
            { seatId: 5, name: "Mimo" },
            { seatId: 7, name: "GLM" },
          ],
        },
        output: {
          type: "speak",
          message: "3号GPT报了5号Mimo查杀，我先接这个公开查验。",
        },
      },
      0,
      { seed: 91 },
    );

    expect(evalCase.metadata?.publicClaimBoard).toEqual([
      { claimantSeatId: 2, claimantName: "Claude", claimedRole: "WITCH", checks: [] },
      {
        claimantSeatId: 3,
        claimantName: "GPT",
        claimedRole: "SEER",
        checks: [{ targetSeatId: 5, targetName: "Mimo", result: "WEREWOLF" }],
      },
    ]);
    expect(evalCase.metadata?.aliveSeats).toEqual([
      { seatId: 2, name: "Claude" },
      { seatId: 3, name: "GPT" },
      { seatId: 5, name: "Mimo" },
      { seatId: 7, name: "GLM" },
    ]);
  });

  it("reads compact string outputs from saved live reports", () => {
    const speechCase = buildEvalCaseFromAiLog(
      {
        gameId: "game-1",
        day: 1,
        phase: "DAY_SPEECH",
        seatNumber: 1,
        prompt: {
          myRole: "HUNTER",
          publicSummary: {
            recentSpeeches: [],
          },
          aliveSeats: [{ seatId: 1 }, { seatId: 2 }, { seatId: 4 }],
        },
        output: "speak: 平安夜，女巫用了救药。我先听一圈。",
      },
      0,
      { seed: 91 },
    );
    const voteCase = buildEvalCaseFromAiLog(
      {
        gameId: "game-1",
        day: 1,
        phase: "DAY_VOTE",
        seatNumber: 1,
        prompt: {
          myRole: "HUNTER",
          publicSummary: {
            recentSpeeches: [],
          },
          aliveSeats: [{ seatId: 1 }, { seatId: 2 }, { seatId: 4 }],
        },
        output: "vote 4号 我按4号这轮没说清先走票。",
      },
      1,
      { seed: 91 },
    );

    expect(speechCase.task).toBe("speech");
    expect(speechCase.outputText).toBe("平安夜，女巫用了救药。我先听一圈。");
    expect(voteCase.task).toBe("action");
    expect(voteCase.selectedTargetSeatId).toBe(4);
  });
});

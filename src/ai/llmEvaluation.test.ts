import { describe, expect, it } from "vitest";
import { getDefaultAiFriends } from "@/game/aiFriends";
import {
  analyzeLlmCallQuality,
  buildLlmOptimizationRecommendations,
  buildLlmEvaluationFriends,
  classifyLlmRetryIssueCodes,
  summarizeLlmAttemptDiagnostics,
  summarizeLlmQuality,
  summarizeLlmRetryIssues,
} from "./llmEvaluation";

describe("llm evaluation helpers", () => {
  it("builds a cyclic custom DeepSeek model lineup without storing API keys", () => {
    const friends = buildLlmEvaluationFriends({
      baseUrl: "https://api.deepseek.com",
      count: 5,
      defaults: getDefaultAiFriends("test"),
      models: ["deepseek-chat", "deepseek-reasoner"],
    });

    expect(friends).toHaveLength(5);
    expect(friends.map((friend) => friend.llmConfig?.model)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-chat",
    ]);
    expect(friends[0]?.llmConfig).toMatchObject({
      provider: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      mergeSystemIntoUser: true,
    });
    expect(JSON.stringify(friends)).not.toContain("apiKey");
  });

  it("allows high-probability witch medicine and near-ignored no-kill wording but flags impossible no-kill claims", () => {
    const allowed = analyzeLlmCallQuality({
      outputText: "平安夜大概率是女巫处理了狼刀，狼人空刀概率极小，实战上可以近似忽略；女巫没有开毒，毒药还在也可以按夜晚情况推。",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });
    const rejected = analyzeLlmCallQuality({
      outputText: "狼人不能空刀，规则不允许空刀，所以刀口就是3号，女巫一定救了3号。",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(allowed.map((issue) => issue.code)).not.toContain("absolute_no_kill_claim");
    expect(allowed.map((issue) => issue.code)).not.toContain("death_cause_overclaim");
    expect(rejected.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["absolute_no_kill_claim", "death_cause_overclaim"]),
    );
  });

  it("allows the real witch to reveal her actual saved target in quality analysis", () => {
    const trueWitch = analyzeLlmCallQuality({
      outputText: "我拍女巫，昨晚我救的是3号，今天先按这个信息压票。",
      phase: "DAY_SPEECH",
      task: "speech",
      myRole: "WITCH",
      witchKnownTargets: { savedTargetSeatId: 3 },
    });
    const falseTarget = analyzeLlmCallQuality({
      outputText: "我拍女巫，昨晚我救的是4号，今天先按这个信息压票。",
      phase: "DAY_SPEECH",
      task: "speech",
      myRole: "WITCH",
      witchKnownTargets: { savedTargetSeatId: 3 },
    });
    const nonWitch = analyzeLlmCallQuality({
      outputText: "女巫救的是3号，3号先放。",
      phase: "DAY_SPEECH",
      task: "speech",
      myRole: "VILLAGER",
    });

    expect(trueWitch.map((issue) => issue.code)).not.toContain("death_cause_overclaim");
    expect(falseTarget.map((issue) => issue.code)).toContain("death_cause_overclaim");
    expect(nonWitch.map((issue) => issue.code)).toContain("death_cause_overclaim");
  });

  it("flags day-vote pivots that do not explain why the new public evidence is harder", () => {
    const discontinuous = analyzeLlmCallQuality({
      outputText: "公开证据更清晰，先出5号。",
      phase: "DAY_VOTE",
      task: "action",
      voteTargetSeatId: 5,
      lastSpeechTargetSeatId: 3,
      reasoningCueCount: 3,
      referencedReasoningCueCount: 1,
    });
    const explained = analyzeLlmCallQuality({
      outputText: "我从上一轮点过的3号转票到5号，因为今天新增票型和对跳证据更硬。",
      phase: "DAY_VOTE",
      task: "action",
      voteTargetSeatId: 5,
      lastSpeechTargetSeatId: 3,
      reasoningCueCount: 3,
      referencedReasoningCueCount: 1,
    });

    expect(discontinuous.map((issue) => issue.code)).toContain("speech_vote_discontinuity");
    expect(explained.map((issue) => issue.code)).not.toContain("speech_vote_discontinuity");
  });

  it("summarizes overcertain wolf claims that do not reference available public cues", () => {
    const calls = [
      {
        qualityIssues: analyzeLlmCallQuality({
          outputText: "7号铁狼，百分百是狼，今天必须出。",
          phase: "DAY_SPEECH",
          task: "speech",
          reasoningCueCount: 3,
          referencedReasoningCueCount: 0,
        }),
      },
      {
        qualityIssues: analyzeLlmCallQuality({
          outputText: "7号更像狼，但目前只是软信息，先压发言。",
          phase: "DAY_SPEECH",
          task: "speech",
          reasoningCueCount: 3,
          referencedReasoningCueCount: 0,
        }),
      },
    ];

    expect(calls[0]?.qualityIssues.map((issue) => issue.code)).toContain("overcertain_without_evidence");
    expect(calls[1]?.qualityIssues.map((issue) => issue.code)).not.toContain("overcertain_without_evidence");
    expect(summarizeLlmQuality(calls)).toMatchObject({
      totalQualityIssues: 1,
      byQualityIssue: { overcertain_without_evidence: 1 },
    });
  });

  it("flags output text that still contains malformed JSON fragments", () => {
    const issues = analyzeLlmCallQuality({
      outputText: 'vote 6号 ":"延续上一轮发言压力，',
      phase: "DAY_VOTE",
      task: "action",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 0,
    });

    expect(issues.map((issue) => issue.code)).toContain("malformed_output_fragment");
  });

  it("flags English sentence fragments without rejecting model names", () => {
    const fragmented = analyzeLlmCallQuality({
      outputText: "vote 3号 GPT-DS-chat-3 is the main public focus due to；延续上一轮发言压力。",
      phase: "DAY_VOTE",
      task: "action",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 0,
    });
    const modelNamesOnly = analyzeLlmCallQuality({
      outputText: "vote 3号 GPT-DS-chat-3 和 Gemini-DS-reason 都在焦点里，但我先压3号补站边。",
      phase: "DAY_VOTE",
      task: "action",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 0,
    });

    expect(fragmented.map((issue) => issue.code)).toContain("english_output_fragment");
    expect(modelNamesOnly.map((issue) => issue.code)).not.toContain("english_output_fragment");
  });

  it("summarizes failed LLM attempts without leaking full output or secrets", () => {
    const attempts = summarizeLlmAttemptDiagnostics([
      {
        attempt: 1,
        provider: "custom-action:deepseek-reasoner",
        issue: "LLM action output is not valid JSON for the schema.",
        rawOutput: '{"candidateId":"vote:6","reason":"bad sk-secret-value trailing json',
      },
      {
        attempt: 2,
        provider: "custom-action:deepseek-reasoner",
        validationErrors: ["reason misses required speech-vote continuity"],
        rawOutput: '{"candidateId":"vote:6","reason":"公开疑点较多，先投这里。"}',
      },
      {
        attempt: 3,
        provider: "custom-action:deepseek-reasoner",
        rawOutput: '{"candidateId":"vote:6","reason":"延续上一轮发言压力。"}',
      },
    ]);

    expect(attempts).toEqual([
      expect.objectContaining({
        attempt: 1,
        provider: "custom-action:deepseek-reasoner",
        issue: "LLM action output is not valid JSON for the schema.",
        validationErrors: [],
      }),
      {
        attempt: 2,
        provider: "custom-action:deepseek-reasoner",
        issue: "reason misses required speech-vote continuity",
        validationErrors: ["reason misses required speech-vote continuity"],
        rawOutputSnippet: '{"candidateId":"vote:6","reason":"公开疑点较多，先投这里。"}',
      },
    ]);
    expect(attempts[0]?.rawOutputSnippet).toContain("sk-***");
    expect(attempts[0]?.rawOutputSnippet).not.toContain("sk-secret-value");
  });

  it("classifies retry attempts into actionable issue buckets", () => {
    const retryIssueCodes = classifyLlmRetryIssueCodes([
      {
        attempt: 1,
        provider: "custom-action:deepseek-reasoner",
        issue: "LLM action output is not valid JSON for the schema.",
        validationErrors: [],
      },
      {
        attempt: 2,
        provider: "custom-action:deepseek-chat",
        issue: "LLM action did not pass constraints: reason misses required speech-vote continuity",
        validationErrors: ["reason misses required speech-vote continuity"],
      },
      {
        attempt: 3,
        provider: "custom-action:deepseek-chat",
        issue: "LLM selected a missing candidate.",
        validationErrors: ["missing candidate"],
      },
      {
        attempt: 4,
        provider: "custom-speech:deepseek-reasoner",
        issue: "LLM 发言未通过约束：用了铁狼、百分百这类过度确定措辞",
        validationErrors: ["用了铁狼、百分百这类过度确定措辞"],
      },
      {
        attempt: 5,
        provider: "custom-action:deepseek-chat",
        issue: "LLM deepseek-chat request failed: terminated",
        validationErrors: [],
      },
    ]);

    expect(retryIssueCodes).toEqual([
      "json_format",
      "speech_vote_continuity",
      "candidate_selection",
      "overcertainty",
      "provider_request",
    ]);
    expect(
      summarizeLlmRetryIssues([
        { retryIssueCodes },
        { retryIssueCodes: ["speech_vote_continuity"] },
        { retryIssueCodes: [] },
      ]),
    ).toEqual({
      retryIssueCallCount: 2,
      byRetryIssue: {
        json_format: 1,
        speech_vote_continuity: 2,
        candidate_selection: 1,
        overcertainty: 1,
        provider_request: 1,
      },
    });
  });

  it("turns evaluation summaries into next optimization recommendations", () => {
    const noisy = buildLlmOptimizationRecommendations({
      totalCalls: 8,
      fallbackCount: 0,
      errorCount: 0,
      validationFailureCount: 0,
      retryIssueCallCount: 3,
      totalQualityIssues: 2,
      byRetryIssue: {
        json_format: 2,
        speech_vote_continuity: 1,
      },
      byQualityIssue: {
        death_cause_overclaim: 1,
        speech_vote_discontinuity: 1,
      },
    });
    const clean = buildLlmOptimizationRecommendations({
      totalCalls: 4,
      fallbackCount: 0,
      errorCount: 0,
      validationFailureCount: 0,
      retryIssueCallCount: 0,
      totalQualityIssues: 0,
      byRetryIssue: {},
      byQualityIssue: {},
    });

    expect(noisy.map((item) => item.area)).toEqual([
      "safety_boundary",
      "prompt_contract",
      "decision_continuity",
    ]);
    expect(noisy[0]).toMatchObject({
      priority: "high",
      title: expect.stringContaining("死亡"),
    });
    expect(noisy[1]?.evidence).toContain("json_format 2");
    expect(noisy[2]?.nextStep).toContain("speechVoteContinuity");
    expect(clean).toEqual([
      expect.objectContaining({
        priority: "low",
        area: "sample_size",
      }),
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { getDefaultAiFriends } from "@/game/aiFriends";
import {
  analyzeOrdinaryAiEvalCase,
  analyzeLlmCallQuality,
  buildLlmOptimizationRecommendations,
  buildLlmEvaluationFriends,
  classifyLlmRetryIssueCodes,
  summarizeOrdinaryAiEvalCases,
  summarizeLlmAttemptDiagnostics,
  summarizeLlmQuality,
  summarizeLlmRetryIssues,
  type OrdinaryAiEvalCase,
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
    expect(friends.map((friend) => friend.nickname)).toEqual(
      getDefaultAiFriends("test")
        .slice(0, 5)
        .map((friend) => friend.nickname),
    );
    expect(friends.map((friend) => friend.nickname).join(" ")).not.toMatch(/DS-|deepseek-chat|deepseek-reasoner|reasoner|mimo-v/i);
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

  it("does not treat a public witch save report as a non-witch death-cause overclaim", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "3号GPT发言。2号Claude这个女巫身份我先认下来，毕竟目前没对跳。他救了4号豆包，这个信息今天先记着。",
        playerRole: "VILLAGER",
        previousSpeechTexts: ["2号Claude发言。我是女巫，昨晚救的4号豆包，4号是银水。"],
        availablePublicCueCount: 3,
        referencedPublicCueCount: 1,
      }),
    );

    expect(result.issueCodes).not.toContain("logic_boundary_error");
  });

  it("flags non-witches accepting a misattributed self witch identity", () => {
    const misread = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "2号Claude，你点到我，我先接一下。你说我是女巫，这个身份我认。但你说把票口收到3号这里，我没听明白。",
        playerRole: "VILLAGER",
        previousSpeechTexts: ["2号Claude发言。我是女巫，今天按公开证据走。上一轮你认了我的身份。"],
      }),
    );
    const publicRecognition = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "2号Claude这个女巫身份我先认，但你说要把票口收到3号这里，我需要你把理由讲清楚。",
        playerRole: "VILLAGER",
        previousSpeechTexts: ["2号Claude发言。我是女巫，今天按公开证据走。"],
      }),
    );

    expect(misread.issueCodes).toContain("logic_boundary_error");
    expect(publicRecognition.issueCodes).not.toContain("logic_boundary_error");
  });

  it("flags fabricated attribution of another player's public check result", () => {
    const fabricated = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "7号GLM发言。2号Claude报了女巫，还给了5号Mimo查杀，这条线我先压着看。",
        metadata: {
          publicClaimBoard: [
            {
              claimant: { seatId: 2, name: "Claude" },
              claimedRole: "WITCH",
              checks: [],
            },
          ],
        },
      }),
    );
    const fabricatedAction = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        task: "action",
        phase: "DAY_VOTE",
        outputText: "vote 3号 8号Kimi报了GPT查杀，这个疑点到现在还没有解除，我先把票压在3号身上。",
        metadata: {
          aliveSeats: [
            { seatId: 3, name: "GPT" },
            { seatId: 8, name: "Kimi" },
          ],
          publicClaimBoard: [],
        },
      }),
    );
    const grounded = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "7号GLM发言。3号GPT报了5号Mimo查杀，这个公开查验我先接住。",
        metadata: {
          publicClaimBoard: [
            {
              claimant: { seatId: 3, name: "GPT" },
              claimedRole: "SEER",
              checks: [{ target: { seatId: 5, name: "Mimo" }, result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );

    expect(fabricated.issueCodes).toContain("logic_boundary_error");
    expect(fabricatedAction.issueCodes).toContain("logic_boundary_error");
    expect(grounded.issueCodes).not.toContain("logic_boundary_error");
  });

  it("allows non-seers to quote checks that belong to public seer claims", () => {
    const hunterQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "HUNTER",
        outputText:
          "我是5号Mimo，猎人。先把身份拍清楚，免得票口散了。我听下来，2号Claude和4号豆包都跳预言家，都报9号查杀。今天先压9号DeepSeek2出人，听他怎么回应这两张查杀。",
        metadata: {
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 4, name: "豆包" },
            { seatId: 5, name: "Mimo" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
            {
              claimantSeatId: 4,
              claimantName: "豆包",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
            {
              claimantSeatId: 5,
              claimantName: "Mimo",
              claimedRole: "HUNTER",
              checks: [],
            },
          ],
        },
      }),
    );
    const villagerQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "VILLAGER",
        outputText:
          "我是7号GLM。9号现在压力确实大，但两张预言家同时报9号查杀，这个同步感反而让我想慢一步。我不急着打死9号。",
        metadata: {
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 4, name: "豆包" },
            { seatId: 7, name: "GLM" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
            {
              claimantSeatId: 4,
              claimantName: "豆包",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const priorSpeakerGenericQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "VILLAGER",
        outputText:
          "我是7号GLM。9号现在压力确实大，但6号Gemini那句话点到我了——两张预言家同时报9号查杀，这个同步感反而让我想慢一步。我不急着打死9号。",
        metadata: {
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 4, name: "豆包" },
            { seatId: 6, name: "Gemini" },
            { seatId: 7, name: "GLM" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
            {
              claimantSeatId: 4,
              claimantName: "豆包",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const seerFollowupQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "VILLAGER",
        outputText:
          "我是11号GPT2。10号Claude2那段我先接一下——他说不站8号，理由是验人心路没听懂。这个点我认同，但我想换一个方向看。2号Claude这轮直接报了8号Kimi查杀，昨天他报过9号DeepSeek2查杀。",
        metadata: {
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 8, name: "Kimi" },
            { seatId: 10, name: "Claude2" },
            { seatId: 11, name: "GPT2" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [
                { targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" },
                { targetSeatId: 8, targetName: "Kimi", result: "WEREWOLF" },
              ],
            },
            {
              claimantSeatId: 8,
              claimantName: "Kimi",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 2, targetName: "Claude", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const legalPublicCheckWithPreCheckQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "legal-public-check-with-pre-check-quote",
        playerRole: "VILLAGER",
        outputText:
          "我先接2号Claude的查验线，他报9号查杀，我暂时认这个身份，今天票口准备跟着走。不过我听9号查杀前那句“警徽要给能听完对跳、还能把票口说清的人”，放在查验之后，确实像在定标准回避焦点，1号也点到了这个缺口，我觉得观察是对的。",
        metadata: {
          seatNumber: 3,
          aliveSeats: [
            { seatId: 1, name: "DeepSeek" },
            { seatId: 2, name: "Claude" },
            { seatId: 3, name: "GPT" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const legalD3PublicSeerQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "legal-d3-public-seer-quote",
        playerRole: "VILLAGER",
        outputText:
          "我先接一下2号Claude。他刚才报了12号豆包2金水，说警徽流看12号昨天投票压了4号豆包，所以去验。这个心路我能听懂，但有一个点我没听明白。上一轮2号吃到4号豆包的查杀，他自己第一天报的也是9号DeepSeek2查杀。",
        metadata: {
          seatNumber: 3,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 3, name: "GPT" },
            { seatId: 4, name: "豆包" },
            { seatId: 9, name: "DeepSeek2" },
            { seatId: 10, name: "Claude2" },
            { seatId: 12, name: "豆包2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [
                { targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" },
                { targetSeatId: 12, targetName: "豆包2", result: "GOOD" },
              ],
            },
            {
              claimantSeatId: 4,
              claimantName: "豆包",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 2, targetName: "Claude", result: "WEREWOLF" }],
            },
            {
              claimantSeatId: 10,
              claimantName: "Claude2",
              claimedRole: "WITCH",
              checks: [],
            },
          ],
        },
      }),
    );
    const legalDirectSaidCheckQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "legal-direct-said-check-quote",
        playerRole: "VILLAGER",
        outputText:
          "2号Claude刚才说验了11号GPT2查杀，票口直接压11号。这个查验我先接着，但我想先对上一下他昨天的票型。",
        metadata: {
          seatNumber: 3,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 3, name: "GPT" },
            { seatId: 11, name: "GPT2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 11, targetName: "GPT2", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const legalSecondPersonCheckQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "legal-second-person-check-quote",
        playerRole: "HUNTER",
        outputText:
          "3号GPT刚才问2号Claude为什么投9号不是4号，这个问题我也想接一句。我是5号Mimo，猎人，昨天拍过身份。2号Claude你既然今天报11号查杀，那你的警徽流和昨天为什么没跟着豆包走，这两件事得对上。",
        metadata: {
          seatNumber: 5,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 3, name: "GPT" },
            { seatId: 5, name: "Mimo" },
            { seatId: 11, name: "GPT2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 11, targetName: "GPT2", result: "WEREWOLF" }],
            },
            {
              claimantSeatId: 5,
              claimantName: "Mimo",
              claimedRole: "HUNTER",
              checks: [],
            },
          ],
        },
      }),
    );
    const legalSaidOwnCheckQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "legal-said-own-check-quote",
        playerRole: "HUNTER",
        outputText:
          "3号GPT说先把7号按公开声明处理，票口边界放9号，这个方向我暂时能跟。我是猎人，昨天拍过，今天不重复拍，身份摆在这。但我得说一句——2号Claude今天报7号金水，说自己验了7号，可昨天2号投的是9号，票型跟他的查杀一致，这个动作本身是顺的。",
        metadata: {
          seatNumber: 5,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 5, name: "Mimo" },
            { seatId: 7, name: "GLM" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [
                { targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" },
                { targetSeatId: 7, targetName: "GLM", result: "GOOD" },
              ],
            },
            {
              claimantSeatId: 5,
              claimantName: "Mimo",
              claimedRole: "HUNTER",
              checks: [],
            },
          ],
        },
      }),
    );
    const legalPressureChainQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "legal-pressure-chain-quote",
        playerRole: "VILLAGER",
        outputText:
          "1号DeepSeek和3号GPT这段我先放下，我这轮主要看2号Claude。2号压力链已经成形了——豆包遗言留查杀、今天报7号金水、锁9号票口，三条线叠在一起，他一条都没说圆。",
        metadata: {
          seatNumber: 12,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 4, name: "豆包" },
            { seatId: 7, name: "GLM" },
            { seatId: 9, name: "DeepSeek2" },
            { seatId: 12, name: "豆包2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [
                { targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" },
                { targetSeatId: 7, targetName: "GLM", result: "GOOD" },
              ],
            },
            {
              claimantSeatId: 4,
              claimantName: "豆包",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 2, targetName: "Claude", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const fabricatedPressureChainQuote = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "fabricated-pressure-chain-quote",
        playerRole: "VILLAGER",
        outputText:
          "1号DeepSeek和3号GPT这段我先放下，我这轮主要看2号Claude。2号压力链已经成形了——豆包遗言留查杀、今天报7号金水、锁9号票口，三条线叠在一起，他一条都没说圆。",
        metadata: {
          seatNumber: 12,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 7, name: "GLM" },
            { seatId: 9, name: "DeepSeek2" },
            { seatId: 12, name: "豆包2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 9, targetName: "DeepSeek2", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const fabricatedMatchingPublicCheckWording = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "fabricated-matching-public-check-wording",
        playerRole: "VILLAGER",
        outputText: "我先接2号Claude的查验线，他报9号查杀，我暂时认这个身份，今天票口准备跟着走。",
        metadata: {
          seatNumber: 3,
          aliveSeats: [
            { seatId: 2, name: "Claude" },
            { seatId: 3, name: "GPT" },
            { seatId: 8, name: "Kimi" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 2,
              claimantName: "Claude",
              claimedRole: "SEER",
              checks: [{ targetSeatId: 8, targetName: "Kimi", result: "WEREWOLF" }],
            },
          ],
        },
      }),
    );
    const hunterSelfCheck = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "HUNTER",
        outputText: "我是5号Mimo，猎人。我验了9号DeepSeek2，9号是查杀，今天先出9号。",
        metadata: {
          seatNumber: 5,
          aliveSeats: [
            { seatId: 5, name: "Mimo" },
            { seatId: 9, name: "DeepSeek2" },
          ],
          publicClaimBoard: [
            {
              claimantSeatId: 5,
              claimantName: "Mimo",
              claimedRole: "HUNTER",
              checks: [],
            },
          ],
        },
      }),
    );

    expect(hunterQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(villagerQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(priorSpeakerGenericQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(seerFollowupQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(legalPublicCheckWithPreCheckQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(legalD3PublicSeerQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(legalDirectSaidCheckQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(legalSecondPersonCheckQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(legalSaidOwnCheckQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(legalPressureChainQuote.issueCodes).not.toContain("logic_boundary_error");
    expect(fabricatedPressureChainQuote.issueCodes).toContain("logic_boundary_error");
    expect(fabricatedMatchingPublicCheckWording.issueCodes).toContain("logic_boundary_error");
    expect(hunterSelfCheck.issueCodes).toContain("logic_boundary_error");
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

  it("flags vote continuity claims that are not supported by the rendered previous speech", () => {
    const callIssues = analyzeLlmCallQuality({
      outputText: "vote 4号 我上一轮发言已经点过4号豆包，这一轮投票先保持一致。",
      phase: "DAY_VOTE",
      task: "action",
      voteTargetSeatId: 4,
      lastSpeechTargetSeatId: 4,
      previousSpeechText: "5号倒牌，狼刀成功，女巫没救。我先看今天票型怎么走。",
      reasoningCueCount: 3,
      referencedReasoningCueCount: 1,
    });
    const evalCase = analyzeOrdinaryAiEvalCase({
      id: "unsupported-vote-continuity",
      task: "action",
      phase: "DAY_VOTE",
      playerRole: "HUNTER",
      outputText: "vote 4号 我上一轮发言已经点过豆包，这一轮投票先保持一致。",
      previousSpeechText: "5号倒牌，狼刀成功，女巫没救。我先看今天票型怎么走。",
      selectedTargetSeatId: 4,
      lastSpeechTargetSeatId: 4,
      availablePublicCueCount: 3,
      referencedPublicCueCount: 1,
    });
    const supported = analyzeOrdinaryAiEvalCase({
      id: "supported-vote-continuity",
      task: "action",
      phase: "DAY_VOTE",
      playerRole: "HUNTER",
      outputText: "vote 4号 我上一轮发言已经点过4号豆包，这一轮投票先保持一致。",
      previousSpeechText: "4号豆包这里票口没说清，我先压4号。",
      selectedTargetSeatId: 4,
      lastSpeechTargetSeatId: 4,
      availablePublicCueCount: 3,
      referencedPublicCueCount: 1,
    });

    expect(callIssues.map((issue) => issue.code)).toContain("speech_vote_discontinuity");
    expect(evalCase.issueCodes).toContain("speech_vote_discontinuity");
    expect(supported.issueCodes).not.toContain("speech_vote_discontinuity");
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

    const truncatedSpeech = analyzeLlmCallQuality({
      outputText: "我先把2号Claude的女巫身份先认着，没对跳我今天不会去动这个身份。但我想说一个点，Claude你报了救4号豆包，这个信息我听进去了，可你后面又说",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(truncatedSpeech.map((issue) => issue.code)).toContain("malformed_output_fragment");

    const v38TruncatedSpeech = analyzeLlmCallQuality({
      outputText: "我先报身份，我是女巫。昨晚平安夜，我救的是4号豆包，4号是银水。听完1号DeepSeek的发言，你说",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(v38TruncatedSpeech.map((issue) => issue.code)).toContain("malformed_output_fragment");

    const quoteTailSpeech = analyzeLlmCallQuality({
      outputText: "我是7号GLM。刚才Gemini说3号GPT那句",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(quoteTailSpeech.map((issue) => issue.code)).toContain("malformed_output_fragment");

    const completeVoteReason = analyzeLlmCallQuality({
      outputText:
        "vote 2号 上一轮我发言点过2号Claude，你那句“想从警上选个能打开局面的”然后就报我查杀，这个转折我到现在没听明白。",
      phase: "DAY_VOTE",
      task: "action",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(completeVoteReason.map((issue) => issue.code)).not.toContain("malformed_output_fragment");

    const unfinishedDiscomfort = analyzeLlmCallQuality({
      outputText:
        "我是6号Gemini。5号Mimo刚才那段我听到了，他回看1号DeepSeek的点，这个方向我自己也有在想。但我想先换个位置看。3号GPT刚才那句话我有点没听明白。",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(unfinishedDiscomfort.map((issue) => issue.code)).toContain("malformed_output_fragment");

    const unfinishedFocusMarker = analyzeLlmCallQuality({
      outputText:
        "说实话，1号DeepSeek，你今天这条查验我先挂着。你报2号Claude查杀，但刚才那段发言的重点全在",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(unfinishedFocusMarker.map((issue) => issue.code)).toContain("malformed_output_fragment");

    const unfinishedCheckLineContrast = analyzeLlmCallQuality({
      outputText:
        "12号，最后一位，我有警徽，我直接说今天的票口。我上一轮从支持Claude改成施压Claude，当时是因为Kimi跳预言家报Claude查杀、豆包遗言也是Claude查杀，两条线压同一个人，我觉得比Claude单方面报查杀硬。但现在Claude夜死留了两条查杀",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });

    expect(unfinishedCheckLineContrast.map((issue) => issue.code)).toContain("malformed_output_fragment");
  });

  it("flags forward commitment speech endings as malformed fragments", () => {
    const callIssues = analyzeLlmCallQuality({
      outputText: "我是2号Claude，女巫。昨晚救的是4号豆包，4号是银水。我先说一下为什么现在跳。",
      phase: "DAY_SPEECH",
      task: "speech",
      reasoningCueCount: 1,
      referencedReasoningCueCount: 1,
    });
    const evalCase = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "前面都在追1号，我现在想换个方向看。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 1,
      }),
    );
    const landed = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "前面都在追1号，我现在想换个方向看，先看6号为什么复读没有新理由。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 1,
      }),
    );
    const restatementOnly = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "我现在不舒服的是另一件事。1号DeepSeek刚才说信息少，先听一圈。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 1,
      }),
    );
    const trailingDiscomfortPromise = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "我先接前面的票口，2号女巫我暂时不打死。还有个更让我别扭的地方。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 1,
      }),
    );
    const landedDiscomfortPromise = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "我先接前面的票口，2号女巫我暂时不打死。还有个更让我别扭的地方：3号认女巫身份，却没有解释为什么不接2号票口。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 1,
      }),
    );

    expect(callIssues.map((issue) => issue.code)).toContain("malformed_output_fragment");
    expect(evalCase.issueCodes).toContain("malformed_output_fragment");
    expect(landed.issueCodes).not.toContain("malformed_output_fragment");
    expect(restatementOnly.issueCodes).toContain("malformed_output_fragment");
    expect(trailingDiscomfortPromise.issueCodes).toContain("malformed_output_fragment");
    expect(landedDiscomfortPromise.issueCodes).not.toContain("malformed_output_fragment");
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

  it("flags ordinary speech that reads like a template and does not progress the table", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "作为普通村民，我认为大家都要理性分析，不要盲目跟票。请大家发言。",
        previousSpeechText: "作为普通村民，我认为大家都要理性分析，不要盲目跟票。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 0,
      }),
    );

    expect(result.issueCodes).toEqual(
      expect.arrayContaining(["template_tone", "ordinary_jargon_stack", "no_concrete_progression"]),
    );
    expect(result.score).toBeLessThan(70);
    expect(result.issues[0]?.evidence).toBeTruthy();
  });

  it("flags ordinary speech that exposes player-jargon meta language", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "1号你这句话其实已经在给后面的人划线了，谁顺着平安夜往下盘，算不算触你这条线？",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 1,
      }),
    );

    expect(result.issueCodes).toContain("ordinary_jargon_stack");

    const lineDrawing = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "1号你这是想提前给后面的人划一条线，看谁急着借这个带票。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 1,
      }),
    );

    expect(lineDrawing.issueCodes).toContain("ordinary_jargon_stack");

    const latestMimoSurfaces = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "4号这轮当前先审你的发言缺口，5号我先把你放观察位，6号这话本身和观察条件都没落下来。",
        availablePublicCueCount: 4,
        referencedPublicCueCount: 2,
      }),
    );

    expect(latestMimoSurfaces.issueCodes).toContain("ordinary_jargon_stack");

    const reviewRegisterSurfaces = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我先认这个身份空间，但6号你认了身份空间之后没说怎么用这个信息。昨天票型要拆谁是起票的、谁是补票的、谁是最后跟票的。",
        availablePublicCueCount: 4,
        referencedPublicCueCount: 2,
      }),
    );

    expect(reviewRegisterSurfaces.issueCodes).toContain("ordinary_jargon_stack");
  });

  it("flags first-seat future audit hooks but protects bounded low-info water", () => {
    const auditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "昨夜平安夜，女巫用了救药。我是1号DeepSeek。第一天信息很少，我底牌不虚但不急着拍身份，先给个观察点：我会留意后面谁急着借平安夜带节奏。这个点后面能验，谁做了我再打。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const lowInfoWater = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "昨夜平安夜，女巫用药了。我这位置没东西，先不定人；这轮先听一圈。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v28AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "平安夜女巫用药，这句先过了。 我第一个发言，信息确实少。但我想先说一个点，我听发言习惯抓前后说法的一致性，后面谁要是借平安夜这个点急着收票或者安排别人表态，我会先记一笔。 暂时没有具体怀疑目标，先听一圈。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v30AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我是1号DeepSeek。昨夜平安夜，女巫用药。第一天信息少，我先听一圈，不急着给结论。 不过我留意一个点：后置位如果有人借平安夜的背景，突然开始硬压某个人表态，或者要求别人先交投票方向，我会觉得这个反应不太对。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v31AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "昨夜平安夜，女巫用了救药。我信息少，先听一圈再说。底牌不虚，但身份先不交。今天主要看后置位谁先开口逼人表态，谁收着听。我暂时不压票，等一两个发言落点再动。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v35AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "平安夜女巫用药了，我先听一圈。我一号位信息确实少，前置没有发言可接，后置也还没人说话。我现在没什么硬想法，先说一个我可能会跟的点：后面谁主动强推闭眼位，或者拿平安夜做文章去压人表态，我会多留一个疑问。今天第一轮先不压票，等发言出来再说。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v37AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "平安夜，女巫用药了。我是首置位，前面没人发言，我先听一圈。底牌我不虚，但暂时不拍身份。我会从后面的人发言里找前后矛盾的点，看谁强推闭眼位，或者哪句话没说清楚。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v38AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "平安夜，女巫用药。我是首置位，信息确实少，先听一圈。我不会现在硬压谁，但后面会重点看谁反应最不自然。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v39AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我是1号DeepSeek。昨夜平安夜，女巫用了救药，这个点先过。 我现在信息确实少，前面没有发言可以接，所以我的处理是先听一圈。等后面几位说完，我会特别留意有没有哪句话前后对不上的地方——哪位的表态我听不太明白，或者某个说法和后面人接不上，我会从那里开始追问。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const v40AuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "1号发言。昨夜平安夜，女巫用了救药。 我是前置位，现在信息确实少，我先不急着给谁压力。等后面一圈发言出来，再看有没有前后说法对不上的地方。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const deathAuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "4号倒了，狼刀成功，女巫没救。 我闭眼视角，首置位没有前置发言可以接，但有一个点我先记下来：后置位谁急着借这个死讯带票，我今天会重点关注。 我暂时不站死谁，先看发言顺序和表态理由。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );
    const peaceNightAuditHook = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "平安夜，女巫用药了。我先把这点记下，后面再看谁急着借这个带票。我第一个发言，信息确实少。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );

    expect(auditHook.issueCodes).toContain("future_audit_hook");
    expect(deathAuditHook.issueCodes).toContain("future_audit_hook");
    expect(peaceNightAuditHook.issueCodes).toContain("future_audit_hook");
    expect(v28AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v30AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v31AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v35AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v37AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v38AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v39AuditHook.issueCodes).toContain("future_audit_hook");
    expect(v40AuditHook.issueCodes).toContain("future_audit_hook");
    expect(lowInfoWater.issueCodes).not.toContain("future_audit_hook");
    expect(lowInfoWater.issueCodes).not.toContain("no_concrete_progression");
    expect(lowInfoWater.positiveSignals).toContain("weakButHumanPasses");
  });

  it("flags courtroom register in strong-role speech while preserving grounded emotion", () => {
    const courtroom = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "WITCH",
        outputText:
          "我是女巫，昨晚救的是4号，4号是银水。1号你那个观察点是空的，等于把举证责任全甩给后面的人；你这个打法是打算验谁。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 2,
      }),
    );
    const groundedEmotion = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "你这句我真不舒服，但我先不把你打死；我只问你今天票想怎么落。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 1,
      }),
    );

    expect(courtroom.issueCodes).toContain("courtroom_register");
    expect(groundedEmotion.issueCodes).not.toContain("courtroom_register");
    expect(groundedEmotion.issueCodes).not.toContain("no_concrete_progression");
    expect(groundedEmotion.positiveSignals).toContain("emotionalButGroundedPasses");
  });

  it("adds v0.4 positive signals for defensive and public role-action speech", () => {
    const defensive = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "你打我这个点我先解释：我刚才说平安夜只是公共背景，不是在报女巫。今天我先不把票压死，你要打我就把依据说具体。",
        previousSpeechText: "2号你这句像替女巫说话，你解释一下凭什么知道女巫用药。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 2,
      }),
    );
    const witchAction = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "WITCH",
        outputText:
          "我是女巫，昨晚救的是4号，4号是银水。今天先别从4号开，1号那句我先暂放。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 2,
      }),
    );
    const seerAction = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "SEER",
        outputText:
          "我跳预言家，昨晚验了3号，3号是查杀。今天我的票先压3号，谁要保他就公开对撞。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 2,
      }),
    );

    expect(defensive.positiveSignals).toContain("defensiveSelfMotivePasses");
    expect(witchAction.positiveSignals).toContain("rolePublicActionPasses");
    expect(seerAction.positiveSignals).toContain("rolePublicActionPasses");
    expect(witchAction.issueCodes).not.toContain("logic_boundary_error");
    expect(seerAction.issueCodes).not.toContain("no_concrete_progression");
  });

  it("flags repeated same-axis pile-on while protecting weak wolf table water", () => {
    const pileOn = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我还是回到1号那句，1号只有观察点没有结论，这个发言缺口目前没有来源，我继续先审1号。",
        previousSpeechTexts: [
          "2号说1号只有观察点没有结论，这个压力源没来源。",
          "3号也说1号观察点没有来源，先审1号这个发言缺口。",
          "4号继续压1号这句，问他观察条件怎么落。",
        ],
        availablePublicCueCount: 4,
        referencedPublicCueCount: 2,
      }),
    );
    const weakWolfWater = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "WEREWOLF",
        outputText:
          "我也只能按好人视角听。我现在没听出太多，先不把票打死，后面谁硬带票我再跟。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 1,
      }),
    );

    expect(pileOn.issueCodes).toContain("repeated_axis_pile_on");
    expect(weakWolfWater.issueCodes).not.toContain("logic_boundary_error");
    expect(weakWolfWater.issueCodes).not.toContain("no_concrete_progression");
    expect(weakWolfWater.positiveSignals).toContain("weakButHumanPasses");
  });

  it("accepts weak but landed ordinary vote and pressure handling", () => {
    const lowInfoFirstSeat = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "HUNTER",
        outputText:
          "我把能听到的点摆一下，枪牌不用抢着拍，先听谁的站边讲不圆。昨夜平安夜，我当背景。前面样本少，先说我暂时怎么听。所以这轮我先不压票，听一圈再看谁急着带节奏。",
        availablePublicCueCount: 1,
        referencedPublicCueCount: 0,
      }),
    );
    const targetPressure = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我不想慢慢磨，1号DeepSeek这边我只取一个公开问题，不把全场都绕进去。1号DeepSeek这轮得把话讲实。上一位GPT先记下，但我这轮要转回1号哪里没说清。",
        focusSeatId: 1,
        availablePublicCueCount: 4,
        referencedPublicCueCount: 0,
      }),
    );
    const voteBoundary = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "HUNTER",
        outputText:
          "按现在桌面看，我拍猎人，今天别拿我这枪分票。我的票先往8号靠，后面要改就给更硬理由。我认这个点，是因为8号Kimi上一段发言里我先暂放，等投票时看他怎么落。除非后面有人把这条线打断，不然8号Kimi可以进今天主票口。",
        focusSeatId: 8,
        askTargetSeatId: 8,
        availablePublicCueCount: 11,
        referencedPublicCueCount: 0,
      }),
    );

    expect(lowInfoFirstSeat.issueCodes).not.toContain("no_concrete_progression");
    expect(targetPressure.issueCodes).not.toContain("no_concrete_progression");
    expect(voteBoundary.issueCodes).not.toContain("no_concrete_progression");
  });

  it("flags half-accept speeches that do not land their current handling", () => {
    const unfinished = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我是3号GPT。2号Claude跳了女巫，说银水是4号豆包。目前没人对跳，我先把2号身份放一放，不急着打他。但有个点我想接一下，2号刚才说1号DeepSeek给的观察点是空的，这话我认同一半。",
        previousSpeechText: "2号说1号给的观察点是空的。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 2,
      }),
    );
    const landed = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "2号说1号没给票口，这话我认同一半：我认同1号没给具体对象，不认同现在直接打死他；今天我先不跟票1号，只把这个疑问暂放。",
        previousSpeechText: "2号说1号没给票口。",
        availablePublicCueCount: 3,
        referencedPublicCueCount: 2,
      }),
    );
    const challenge = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我接一下3号GPT，你刚才说认同一半2号Claude的观点，但你说了认同一半之后呢？你认同一半是哪一半？另一半不认同的又是什么？你没说完。",
        previousSpeechText: "3号说这话我认同一半。",
        availablePublicCueCount: 4,
        referencedPublicCueCount: 2,
      }),
    );

    expect(unfinished.issueCodes).toContain("half_accept_without_landing");
    expect(landed.issueCodes).not.toContain("half_accept_without_landing");
    expect(challenge.issueCodes).not.toContain("half_accept_without_landing");
  });

  it("flags ordinary speech that lectures rules instead of speaking from public table information", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "狼人杀的规则是预言家晚上验人，女巫有解药和毒药，猎人死亡可以开枪。我们要根据身份配置来分析局势。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 0,
      }),
    );

    expect(result.issueCodes).toContain("rule_lecture");
    expect(result.issueCodes).toContain("no_concrete_progression");
  });

  it("flags ordinary action reasons that ignore the current speech target", () => {
    const result = analyzeOrdinaryAiEvalCase({
      id: "vote-discontinuity",
      task: "action",
      phase: "DAY_VOTE",
      playerRole: "VILLAGER",
      outputText: "我投5号，感觉这里问题比较大。",
      selectedTargetSeatId: 5,
      lastSpeechTargetSeatId: 3,
      availablePublicCueCount: 3,
      referencedPublicCueCount: 1,
    });

    expect(result.issueCodes).toContain("speech_vote_discontinuity");
    expect(result.issueCodes).not.toContain("no_concrete_progression");
    expect(result.score).toBeLessThan(80);
  });

  it("flags ordinary follow-up questions aimed at impossible or weak targets", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText: "请0号解释一下为什么昨晚会平安夜。",
        aliveSeatIds: [1, 2, 3, 4, 5, 6],
        askTargetSeatId: 0,
        availablePublicCueCount: 2,
        referencedPublicCueCount: 0,
      }),
    );

    expect(result.issueCodes).toContain("bad_followup_target");
  });

  it("flags peaceful-night witch-use common sense misread as hidden information", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        outputText:
          "我是女巫，昨夜救的4号豆包，4号是银水。1号DeepSeek，你说“女巫用了救药”，这句话我听着有点怪——你不是女巫，但说得像替女巫发言。我需要你解释一下：你凭什么确定女巫用了救药。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 0,
      }),
    );

    expect(result.issueCodes).toContain("logic_boundary_error");
  });

  it("does not flag a true witch self-reveal as hidden night information", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "WITCH",
        outputText:
          "我是女巫，昨晚救的是4号豆包，4号是银水。我拍身份是因为今天票不能散，今天先别从4号开。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 1,
      }),
    );

    expect(result.issueCodes).not.toContain("logic_boundary_error");
  });

  it("does not flag numbered true witch self-reveal with silver water as hidden night information", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "WITCH",
        outputText:
          "我是2号，女巫。昨晚我救了9号，9号是银水。1号刚才说平安夜女巫用药，这个判断本身没问题。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 1,
      }),
    );

    expect(result.issueCodes).not.toContain("logic_boundary_error");
  });

  it("does not flag true witch bottom-card wording with silver water as hidden night information", () => {
    const result = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        playerRole: "WITCH",
        outputText:
          "我底牌是女巫，昨晚救的是9号，9号是银水。1号这句话我先接住，但今天不急着出银水。",
        availablePublicCueCount: 2,
        referencedPublicCueCount: 1,
      }),
    );

    expect(result.issueCodes).not.toContain("logic_boundary_error");
  });

  it("summarizes ordinary AI evaluation cases into issue counts and average score", () => {
    const summary = summarizeOrdinaryAiEvalCases([
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: "clean",
          outputText: "我先延续3号这条线，刚才他只回应了身份压力，没有解释票型变化，今天先让3号补清楚。",
          focusSeatId: 3,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 2,
        }),
      ),
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: "template",
          outputText: "作为普通村民，我觉得大家都要理性分析，请大家发言。",
          availablePublicCueCount: 2,
          referencedPublicCueCount: 0,
        }),
      ),
    ]);

    expect(summary.totalCases).toBe(2);
    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.byIssueCode.template_tone).toBe(1);
    expect(summary.highRiskCaseIds).toContain("template");
  });

  it("reports sample-level repeated table phrases without changing per-case scores", () => {
    const results = [1, 2, 3, 4, 5, 6].map((seatId) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `repeat-${seatId}`,
          outputText: `我先接一下前面，刚才给了一个方向，我会拿后面的票和回应对照。${seatId}号这里我先不打死，票口暂时压住。`,
          focusSeatId: seatId,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    expect(summary.sampleMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repeated_surface_phrase",
          severity: "warn",
        }),
      ]),
    );
    expect(summary.averageScore).toBe(
      Math.round((results.reduce((total, result) => total + result.score, 0) / results.length) * 10) / 10,
    );
    expect(summary.highRiskCaseIds).toHaveLength(0);
  });

  it("reports sample-level action distribution skew when most seats use the same speech move", () => {
    const results = [1, 2, 3, 4, 5, 6, 7].map((seatId) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `pickup-${seatId}`,
          outputText: `我听到上一位的意思了，刚才这个点我先接住。${seatId}号这里我先不急着站死，等票型出来再压。`,
          focusSeatId: seatId,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    expect(summary.sampleMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "action_distribution_skew",
          severity: "warn",
        }),
      ]),
    );
  });

  it("reports repeated clause and target-axis concentration across the whole sample", () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map((seatId) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `same-axis-${seatId}`,
          outputText:
            seatId % 2 === 0
              ? `上一位${seatId}号先记下，但我这轮要转回1号哪里没说清。1号这轮得把话讲实，票口暂时压住。`
              : `我先听完前面，但我这轮要转回1号哪里没说清。1号这边不是直接打死，只是今天主轴还在他身上。`,
          focusSeatId: 1,
          askTargetSeatId: 1,
          availablePublicCueCount: 4,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    expect(summary.sampleMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repeated_clause_rate",
          severity: "warn",
        }),
        expect.objectContaining({
          code: "axis_concentration",
          severity: "warn",
        }),
      ]),
    );
  });

  it("reports repeated bridge clauses after normalizing seat numbers and player names", () => {
    const rows = [
      "我先说听感，打回1号DeepSeek不是情绪牌，我只看他说过的话和怎么落票。豆包那段我先放一下，先回到1号没讲顺的地方。",
      "我按前后发言往回看，打回1号DeepSeek不是情绪牌，我只看他说过的话和怎么落票。这边先别只听结论。",
      "我从结构上看，我接一下上一位Gemini，他这段发言还缺把结论推出来的过程。6号Gemini这轮我只当一份材料。",
      "我从结构上看，我接一下上一位豆包，他这段发言还缺把结论推出来的过程。4号豆包的判断我先记成样本。",
      "我主要听回应，回看他已发言的表态和票口：哪句话能撑住这条线，哪句话会把它拆掉。",
      "我先核被Claude施压、回避站边，另外他前面有回避站边的记录，回看他已发言的表态和票口：哪句话能撑住这条线，哪句话会把它拆掉。",
    ];
    const results = rows.map((outputText, index) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `fable-repeat-${index + 1}`,
          outputText,
          focusSeatId: 1,
          availablePublicCueCount: 4,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    expect(summary.sampleMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repeated_clause_rate",
          severity: "warn",
        }),
      ]),
    );
  });

  it("reports short repeated clauses only when they appear three times", () => {
    const rows = [
      "我先说听感，票口还是按我自己的理由走，后面有人保再说。",
      "我不急着锁死，票口还是按我自己的理由走，今天先看回应。",
      "这段我先听着，票口还是按我自己的理由走，投票前再回头。",
      "我这里先不压票，只看他等会儿怎么解释。",
      "这轮我先挂一个疑问，不拿一句话直接定人。",
      "前面信息不多，我先把平安夜当背景。",
    ];
    const results = rows.map((outputText, index) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `short-repeat-${index + 1}`,
          outputText,
          focusSeatId: 1,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    expect(summary.sampleMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repeated_clause_rate",
          severity: "warn",
          detail: expect.stringContaining("票口还是按我自己的理由走"),
          value: "3/6",
        }),
      ]),
    );
  });

  it("does not report short repeated clauses after only two rows", () => {
    const rows = [
      "我先说听感，票口还是按我自己的理由走，后面有人保再说。",
      "我不急着锁死，票口还是按我自己的理由走，今天先看回应。",
      "这段我先听着，今天不把话说死，投票前再回头。",
      "我这里先不压票，只看他等会儿怎么解释。",
      "这轮我先挂一个疑问，不拿一句话直接定人。",
      "前面信息不多，我先把平安夜当背景。",
    ];
    const results = rows.map((outputText, index) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `short-repeat-no-warn-${index + 1}`,
          outputText,
          focusSeatId: 1,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    expect(summary.sampleMetrics.some((metric) => metric.code === "repeated_clause_rate")).toBe(false);
  });

  it("does not treat seat-memory history as previous-speaker pickup skew", () => {
    const results = [1, 2, 3, 4, 5, 6, 7].map((seatId) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `history-${seatId}`,
          outputText: `${seatId}号前面有回避站边的记录，我这轮只按这个公开记录压一下。票先不打死，等他把今天的站边和票型讲顺。`,
          focusSeatId: seatId,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    const actionSkew = summary.sampleMetrics.find((metric) => metric.code === "action_distribution_skew");
    expect(actionSkew?.evidence?.join(" ")).not.toContain("quoteOrCarry");
  });

  it("does not report repeated public-event names as surface phrase repetition", () => {
    const results = [1, 2, 3, 4].map((seatId) =>
      analyzeOrdinaryAiEvalCase(
        ordinarySpeechCase({
          id: `public-event-${seatId}`,
          outputText: `${seatId}号DeepSeek这边我先核Claude对DeepSeek的压力被1名后续发言者接住，另外DeepSeek前面有回避站边的记录。我的处理不是照搬这句话，而是看今天票怎么落。`,
          focusSeatId: seatId,
          availablePublicCueCount: 3,
          referencedPublicCueCount: 1,
        }),
      ),
    );

    const summary = summarizeOrdinaryAiEvalCases(results);

    const repeatedSurface = summary.sampleMetrics.find((metric) => metric.code === "repeated_surface_phrase");
    expect(repeatedSurface?.detail).not.toContain("Claude");
    expect(repeatedSurface?.detail).not.toContain("DeepSeek");
    expect(repeatedSurface?.detail).not.toMatch(/[A-Za-z]/);
    expect(repeatedSurface?.detail).not.toMatch(/\d/);
    expect(repeatedSurface?.detail).not.toContain("后续发言者");
    expect(repeatedSurface?.detail).not.toContain("续发言者");
    expect(repeatedSurface?.detail).not.toContain("言者接住");
    expect(repeatedSurface?.detail).not.toContain("者接住");
    expect(repeatedSurface?.detail).not.toContain("发言者接住");
    expect(repeatedSurface?.detail).not.toContain("我没听明");
    expect(repeatedSurface?.detail).not.toContain("我没听");
    expect(repeatedSurface?.detail).not.toContain("没听明");
  });
});

function ordinarySpeechCase(overrides: Partial<OrdinaryAiEvalCase>): OrdinaryAiEvalCase {
  return {
    id: "ordinary-speech",
    task: "speech",
    phase: "DAY_SPEECH",
    playerRole: "VILLAGER",
    outputText: "我先听后置位发言。",
    aliveSeatIds: [1, 2, 3, 4, 5, 6],
    availablePublicCueCount: 0,
    referencedPublicCueCount: 0,
    ...overrides,
  };
}

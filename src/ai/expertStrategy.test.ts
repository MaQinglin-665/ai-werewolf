import { describe, expect, it } from "vitest";
import { createMockCommand } from "./mockAgent";
import { buildConstrainedActionInput } from "./actionProviders";
import { buildExpertStrategyNotes } from "./expertStrategy";
import { buildConstrainedSpeechInput, mockSpeechProvider } from "./speechProviders";
import { buildAiTableRead, createSpeechPlan, createVotePlan } from "./tableRead";
import { createGame } from "@/game/engine";
import { BOARD_PRESETS } from "@/game/boards";
import { buildAgentView } from "@/game/projection";
import type { RoleClaim } from "@/game/types";

describe("expert werewolf strategy notes", () => {
  it("injects expert strategy into speech and action inputs for every official board", () => {
    for (const boardId of Object.keys(BOARD_PRESETS)) {
      const state = createGame({ boardId, seed: 1201, humanSeatId: null });
      const voter = state.seats.find((seat) => seat.role === "VILLAGER") ?? state.seats.find((seat) => seat.isAi)!;
      state.phase = "DAY_VOTE";
      const view = buildAgentView(state, voter.seatId);
      const tableRead = buildAiTableRead(view);
      const votePlan = createVotePlan(view, tableRead);
      const fallbackCommand = createMockCommand(view, tableRead, votePlan);

      const speechInput = buildConstrainedSpeechInput(view, createSpeechPlan(view, tableRead));
      const actionInput = buildConstrainedActionInput(view, { tableRead, votePlan, fallbackCommand });

      expect(speechInput.expertStrategy.length, boardId).toBeGreaterThan(0);
      expect(actionInput.expertStrategy, boardId).toEqual(speechInput.expertStrategy);
      expect(speechInput.expertStrategy.join("\n"), boardId).toContain("公开信息链");
      expect(speechInput.expertStrategy.join("\n"), boardId).toContain("证据先分硬软");
      expect(speechInput.advancedReasoning.length, boardId).toBeGreaterThan(0);
      expect(actionInput.advancedReasoning, boardId).toEqual(speechInput.advancedReasoning);
      expect(actionInput.reasoningFrame, boardId).toEqual(speechInput.reasoningFrame);
      expect(actionInput.rolePlaybook, boardId).toEqual(speechInput.rolePlaybook);
      expect(actionInput.claimAudit, boardId).toEqual(speechInput.claimAudit);
      expect(speechInput.rolePlaybook.role, boardId).toBe(view.myRole);
      expect(speechInput.rolePlaybook.tacticalVariants.length, boardId).toBeGreaterThan(0);
      expect(speechInput.debateAgenda.crossExamination.length, boardId).toBeGreaterThan(0);
      expect(actionInput.debateAgenda.crossExamination.length, boardId).toBeGreaterThan(0);
      expect(speechInput.reasoningFrame.hardEvidence.length, boardId).toBeGreaterThan(0);
      expect(speechInput.reasoningFrame.validationQuestions.length, boardId).toBeGreaterThan(0);
      expect(speechInput.advancedReasoning.join("\n"), boardId).toContain("身份坑审计");
      expect(speechInput.advancedReasoning.join("\n"), boardId).toContain("证据硬度");
    }
  });

  it("adds sheriff and seer-counterclaim heuristics to LLM speech and action inputs", () => {
    const state = createStrategyState();
    const voter = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const speechInput = buildConstrainedSpeechInput(view, createSpeechPlan(view, tableRead));
    const actionInput = buildConstrainedActionInput(view, { tableRead, votePlan, fallbackCommand });
    const notes = speechInput.expertStrategy.join("\n");
    const audit = speechInput.advancedReasoning.join("\n");

    expect(notes).toContain("警徽");
    expect(notes).toContain("真假预言家");
    expect(notes).toContain("验人结构");
    expect(notes).toContain("观点-依据-反面可能-验证");
    expect(notes).toContain("起票、谁补票、谁最后跟票");
    expect(notes).toContain("验人力度");
    expect(notes).toContain("不要套公式");
    expect(audit).toContain("身份坑审计");
    expect(audit).toContain("预言家线审计");
    expect(audit).toContain("轮次意识");
    expect(audit).toContain("正反逻辑");
    expect(audit).toContain("说服意图");
    expect(actionInput.constraints.join("\n")).toContain("evidence hardness");
    expect(actionInput.constraints.join("\n")).toContain("reasoningFrame");
    expect(actionInput.constraints.join("\n")).toContain("rolePlaybook");
    expect(actionInput.constraints.join("\n")).toContain("claimAudit");
    expect(actionInput.constraints.join("\n")).toContain("debateAgenda");
    expect(speechInput.reasoningFrame.hardEvidence.join("\n")).toContain("预言家对跳");
    expect(speechInput.reasoningFrame.counterHypotheses.join("\n")).toContain("身份对跳");
    expect(speechInput.reasoningFrame.validationQuestions.join("\n")).toContain("查验心路");
    expect(speechInput.rolePlaybook.roleLabel).toBe("平民");
    expect(speechInput.rolePlaybook.reasoningPriorities.join("\n")).toContain("保护未对跳神职");
    expect(speechInput.claimAudit.contestedClaims.join("\n")).toContain("预言家对跳");
    expect(speechInput.claimAudit.checkChains.join("\n")).toContain("查杀");
    expect(speechInput.claimAudit.followupTests.join("\n")).toContain("为什么验这个人");
    expect(speechInput.debateAgenda.crossExamination.join("\n")).toContain("查验心路");
    expect(speechInput.debateAgenda.voteCommitments.join("\n")).toContain("预言家对跳局不要散票");
    expect(speechInput.tableBriefing.text).toContain("推理框架-硬证据");
    expect(speechInput.tableBriefing.text).toContain("推理框架-验证问题");
    expect(speechInput.tableBriefing.text).toContain("角色玩法-变体");
    expect(speechInput.tableBriefing.text).toContain("角色玩法-行动分歧");
    expect(speechInput.tableBriefing.text).toContain("身份审计-对跳");
    expect(speechInput.tableBriefing.text).toContain("身份审计-查验链");
    expect(speechInput.tableBriefing.text).toContain("盘问议程-追问");
    expect(speechInput.tableBriefing.text).toContain("盘问议程-票口");
    expect(speechInput.tableBriefing.text).toContain("当前推理清单");
    expect(actionInput.expertStrategy).toEqual(speechInput.expertStrategy);
    expect(actionInput.advancedReasoning).toEqual(speechInput.advancedReasoning);
    expect(actionInput.reasoningFrame).toEqual(speechInput.reasoningFrame);
    expect(actionInput.rolePlaybook).toEqual(speechInput.rolePlaybook);
    expect(actionInput.claimAudit).toEqual(speechInput.claimAudit);
    expect(actionInput.debateAgenda.crossExamination.join("\n")).toContain("查验心路");
  });

  it("provides distinct role playbooks for every supported role in official boards", () => {
    const seenRoles = new Set<string>();

    for (const boardId of Object.keys(BOARD_PRESETS)) {
      const state = createGame({ boardId, seed: 1204, humanSeatId: null });
      state.phase = "DAY_SPEECH";

      for (const seat of state.seats) {
        if (seenRoles.has(seat.role)) continue;
        state.speechQueue = [seat.seatId];
        state.speechIndex = 0;
        const view = buildAgentView(state, seat.seatId);
        const speechInput = buildConstrainedSpeechInput(view, createSpeechPlan(view));
        seenRoles.add(seat.role);

        expect(speechInput.rolePlaybook.role).toBe(seat.role);
        expect(speechInput.rolePlaybook.tacticalVariants.length, seat.role).toBeGreaterThanOrEqual(3);
        expect(speechInput.rolePlaybook.reasoningPriorities.length, seat.role).toBeGreaterThanOrEqual(2);
        expect(speechInput.rolePlaybook.actionForks.length, seat.role).toBeGreaterThanOrEqual(2);
        expect(speechInput.tableBriefing.text, seat.role).toContain(`角色玩法：${speechInput.rolePlaybook.roleLabel}`);
      }
    }

    expect([...seenRoles].sort()).toEqual([
      "GUARD",
      "HUNTER",
      "IDIOT",
      "KNIGHT",
      "SEER",
      "VILLAGER",
      "WEREWOLF",
      "WHITE_WOLF_KING",
      "WITCH",
      "WOLF_BEAUTY",
      "WOLF_KING",
    ]);
  });

  it("feeds advanced table audits into mock fallback speech", async () => {
    const state = createStrategyState();
    state.phase = "DAY_SPEECH";
    const speaker = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const view = buildAgentView(state, speaker.seatId);

    const result = await mockSpeechProvider.generateSpeech(view, createSpeechPlan(view));

    expect(result.speech).toContain("身份坑先看");
    expect(result.speech).toContain("预言家对跳");
    expect(result.speech).toContain("查验链");
    expect(result.speech).toMatch(/回应|过程补出来|查验心路/);
  });

  it("keeps sheriff table briefings available on sheriff boards", () => {
    const state = createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1203, humanSeatId: null });
    const speaker = state.seats.find((seat) => seat.isAi)!;
    state.phase = "DAY_SPEECH";
    state.speechQueue = [speaker.seatId];
    state.speechIndex = 0;

    const input = buildConstrainedSpeechInput(buildAgentView(state, speaker.seatId));

    expect(input.publicContext.rules.sheriffEnabled).toBe(true);
    expect(input.tableBriefing.text).toContain("本局有警上、警下、警徽和警长投票");
    expect(input.tableBriefing.text).not.toContain("没有警上、警下、警徽、警长流程，不要使用这些概念");
    expect(input.advancedReasoning.join("\n")).toContain("警长审计");
  });

  it("does not mention sheriff flow on no-sheriff boards", async () => {
    const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 1205, humanSeatId: null });
    const seer = state.seats.find((seat) => seat.role === "SEER")!;
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const goldTarget = state.seats.find((seat) => seat.role === "VILLAGER")!;
    state.phase = "DAY_SPEECH";
    state.roleClaims = [
      seerClaim({
        claimantSeatId: seer.seatId,
        targetSeatId: goldTarget.seatId,
        result: "GOOD",
        sourceSpeechSeq: 10,
      }),
      seerClaim({
        claimantSeatId: wolf.seatId,
        targetSeatId: seer.seatId,
        result: "WEREWOLF",
        sourceSpeechSeq: 20,
      }),
    ];

    const view = buildAgentView(state, seer.seatId);
    const plan = createSpeechPlan(view);
    const input = buildConstrainedSpeechInput(view, plan);
    const result = await mockSpeechProvider.generateSpeech(view, plan);
    const serialized = JSON.stringify({
      tableBriefing: input.tableBriefing.text,
      expertStrategy: input.expertStrategy,
      rolePlaybook: input.rolePlaybook,
      reasoningFrame: input.reasoningFrame,
      debateAgenda: input.debateAgenda,
      mockSpeech: result.speech,
    });

    expect(input.tableBriefing.text).toContain("没有警上、警下、警徽、警长流程");
    expect(serialized).toContain("后续验人");
    expect(serialized).not.toContain("警徽流");
  });

  it("keeps wolf strategy guidance public-safe", () => {
    const state = createStrategyState();
    const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
    const view = buildAgentView(state, wolf.seatId);

    const notes = buildExpertStrategyNotes(view).join("\n");

    expect(notes).toContain("悍跳");
    expect(notes).toContain("倒钩");
    expect(notes).toContain("不暴露狼队信息");
    expect(notes).toContain("说服");
  });

  it("adds board-specific notes for no-sheriff, guard, wolf-king, and white-wolf-king boards", () => {
    const noSheriff = buildExpertStrategyNotes(
      buildAgentView(createGame({ boardId: "9p-seer-witch-hunter", seed: 1202, humanSeatId: null }), 1),
    ).join("\n");
    const guard = buildExpertStrategyNotes(
      buildAgentView(createGame({ boardId: "12p-sheriff-seer-witch-hunter-guard", seed: 1202, humanSeatId: null }), 1),
    ).join("\n");
    const wolfKing = buildExpertStrategyNotes(
      buildAgentView(createGame({ boardId: "12p-sheriff-wolf-king-seer-witch-hunter-guard", seed: 1202, humanSeatId: null }), 1),
    ).join("\n");
    const whiteWolfKing = buildExpertStrategyNotes(
      buildAgentView(
        createGame({ boardId: "12p-sheriff-white-wolf-king-seer-witch-hunter-guard", seed: 1202, humanSeatId: null }),
        1,
      ),
    ).join("\n");

    expect(noSheriff).toContain("无警长局");
    expect(guard).toContain("守卫局");
    expect(wolfKing).toContain("狼王局");
    expect(whiteWolfKing).toContain("白狼王局");
  });
});

function createStrategyState(): ReturnType<typeof createGame> {
  const state = createGame({ boardId: "12p-sheriff-wolf-king-seer-witch-hunter-guard", seed: 1200, humanSeatId: null });
  const seer = state.seats.find((seat) => seat.role === "SEER")!;
  const wolf = state.seats.find((seat) => seat.role === "WEREWOLF")!;
  const goldTarget = state.seats.find((seat) => seat.role === "VILLAGER")!;

  state.phase = "DAY_VOTE";
  state.roleClaims = [
    seerClaim({
      claimantSeatId: seer.seatId,
      targetSeatId: goldTarget.seatId,
      result: "GOOD",
      sourceSpeechSeq: 10,
    }),
    seerClaim({
      claimantSeatId: wolf.seatId,
      targetSeatId: seer.seatId,
      result: "WEREWOLF",
      sourceSpeechSeq: 20,
    }),
  ];
  return state;
}

function seerClaim({
  claimantSeatId,
  targetSeatId,
  result,
  sourceSpeechSeq,
}: {
  claimantSeatId: number;
  targetSeatId: number;
  result: "GOOD" | "WEREWOLF";
  sourceSpeechSeq: number;
}): RoleClaim {
  return {
    id: `${claimantSeatId}:SEER`,
    day: 1,
    claimantSeatId,
    claimedRole: "SEER",
    strength: "hard",
    checks: [{ day: 1, claimantSeatId, targetSeatId, result, sourceSpeechSeq }],
    message: `${claimantSeatId}号跳预言家。`,
    sourceSpeechSeq,
    updatedAtSeq: sourceSpeechSeq,
  };
}

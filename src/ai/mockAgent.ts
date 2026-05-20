import { applyCommand, applySystemStep, getTurnRequirement } from "@/game/engine";
import { clampProbability, stableRoll, stableSignedJitter } from "@/game/decisionNoise";
import type { RuntimeAiProviderMode } from "@/game/llmConfig";
import { buildAgentView } from "@/game/projection";
import { isWolfRole } from "@/game/roleUtils";
import type {
  ActionTarget,
  AgentView,
  AiFriendRuntimeLlmConfig,
  AiTableRead,
  Command,
  GameState,
  Phase,
  SeatRead,
  VotePlan,
} from "@/game/types";
import { createConfiguredActionProvider } from "./actionProviders";
import { refreshAiSeatMemory, rememberAiDecision, storeAiSeatMemory } from "./seatMemory";
import { createConfiguredSpeechProvider, mockSpeechProvider } from "./speechProviders";
import { buildAiTableRead, createSpeechPlan, createVotePlan } from "./tableRead";
import type { AiActionProvider, AiDecisionLog, AiSpeechProvider, AiSpeechProviderContext } from "./types";

const POWER_CLAIM_ROLES = new Set(["SEER", "WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD"]);
const BATCH_AI_PHASES = new Set<Phase>([
  "DAY_VOTE",
  "SHERIFF_NOMINATION",
  "SHERIFF_WITHDRAWAL",
  "SHERIFF_VOTE",
  "SHERIFF_PK_VOTE",
]);

function isSpeechPhase(phase: Phase): boolean {
  return phase === "DAY_SPEECH" || phase === "SHERIFF_SPEECH" || phase === "SHERIFF_PK_SPEECH";
}

export const mockActionProvider: AiActionProvider = {
  providerId: "mock-action",
  async generateCommand(_view, context) {
    return {
      command: context.fallbackCommand,
      provider: "mock-action",
      isFallback: false,
    };
  },
};

type AiAdvanceOptions = {
  speechProvider?: AiSpeechProvider;
  actionProvider?: AiActionProvider;
  speechContext?: AiSpeechProviderContext;
  runtimeAiLlmConfigs?: Record<string, AiFriendRuntimeLlmConfig>;
};

type AiTurnRequirement = Extract<ReturnType<typeof getTurnRequirement>, { type: "ai" }>;

export async function advanceWithMockAi(
  initialState: GameState,
  options: { ignoreHuman?: boolean; maxSteps?: number } & AiAdvanceOptions = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  let state = initialState;
  const aiLogs: AiDecisionLog[] = [];
  const maxSteps = options.maxSteps ?? 400;
  const speechProvider = options.speechProvider ?? mockSpeechProvider;
  const actionProvider = options.actionProvider ?? mockActionProvider;

  for (let step = 0; step < maxSteps; step += 1) {
    const requirement = getTurnRequirement(state);
    if (requirement.type === "none") {
      return { state, aiLogs };
    }

    if (requirement.type === "system") {
      state = applySystemStep(state);
      continue;
    }

    if (requirement.type === "human" && !options.ignoreHuman) {
      return { state, aiLogs };
    }

    const actorSeatId = requirement.actorSeatId;
    let prompt = buildAgentView(state, actorSeatId, options.runtimeAiLlmConfigs);
    let tableRead = buildAiTableRead(prompt);
    const refreshedMemory = refreshAiSeatMemory(prompt, tableRead);
    prompt = { ...prompt, privateKnowledge: { ...prompt.privateKnowledge, aiMemory: refreshedMemory } };
    tableRead = buildAiTableRead(prompt);
    const speechPlan = isSpeechPhase(state.phase) ? createSpeechPlan(prompt, tableRead) : undefined;
    const votePlan = state.phase === "DAY_VOTE" ? createVotePlan(prompt, tableRead) : undefined;
    const shouldChooseSpeechAction = Boolean(speechPlan && getWhiteWolfKingExplodeAction(prompt));
    const actionResult =
      shouldChooseSpeechAction || !speechPlan
        ? await actionProvider.generateCommand(prompt, {
            tableRead,
            votePlan,
            fallbackCommand: createMockCommand(prompt, tableRead, votePlan),
          })
        : undefined;
    const shouldGenerateSpeech = Boolean(speechPlan && actionResult?.command.type !== "whiteWolfKingExplode");
    const speechResult = shouldGenerateSpeech
      ? await speechProvider.generateSpeech(prompt, speechPlan!, options.speechContext)
      : undefined;
    const output: Command = speechPlan
      ? actionResult?.command.type === "whiteWolfKingExplode"
        ? actionResult.command
        : state.phase === "SHERIFF_SPEECH" || state.phase === "SHERIFF_PK_SPEECH"
        ? { type: "sheriffSpeech", actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
        : { type: "speak", actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
      : actionResult!.command;
    const memoryAfterDecision = rememberAiDecision(refreshedMemory, output, speechPlan, votePlan);

    state = applyCommand(state, output);
    state = storeAiSeatMemory(state, memoryAfterDecision);
    aiLogs.push({
      gameId: state.id,
      day: prompt.day,
      seatNumber: actorSeatId,
      phase: requirement.phase,
      provider: speechResult?.provider ?? actionResult?.provider ?? mockActionProvider.providerId,
      prompt: sanitizeAgentViewForLog(prompt),
      output,
      votePlan,
      speechPlan,
      publicFactBasis: buildPublicDecisionFactBasis(prompt),
      rawOutput: speechResult?.rawOutput ?? actionResult?.rawOutput,
      isFallback: speechResult?.isFallback ?? actionResult?.isFallback ?? false,
      error: speechResult?.error ?? actionResult?.error,
      validationErrors: speechResult?.validationErrors ?? actionResult?.validationErrors,
    });
  }

  throw new Error("自动推进超过步数上限，可能存在状态机死循环。");
}

export async function advanceOneAiStep(
  initialState: GameState,
  options: AiAdvanceOptions = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  const requirement = getTurnRequirement(initialState);
  const speechProvider = options.speechProvider ?? mockSpeechProvider;
  const actionProvider = options.actionProvider ?? mockActionProvider;

  if (requirement.type === "none" || requirement.type === "human") {
    return { state: initialState, aiLogs: [] };
  }

  if (requirement.type === "system") {
    return { state: applySystemStep(initialState), aiLogs: [] };
  }

  if (BATCH_AI_PHASES.has(initialState.phase)) {
    return advancePendingAiTurns(initialState, BATCH_AI_PHASES, options);
  }

  const advanced = await advanceAiTurn(
    initialState,
    requirement,
    speechProvider,
    actionProvider,
    options.speechContext,
    options.runtimeAiLlmConfigs,
  );
  return { state: advanced.state, aiLogs: [advanced.aiLog] };
}

export async function advancePendingAiVotes(
  initialState: GameState,
  options: AiAdvanceOptions = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  return advancePendingAiTurns(initialState, new Set<Phase>(["DAY_VOTE"]), options);
}

export async function advancePendingAiTurns(
  initialState: GameState,
  phases: ReadonlySet<Phase>,
  options: AiAdvanceOptions = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  let state = initialState;
  const aiLogs: AiDecisionLog[] = [];
  const speechProvider = options.speechProvider ?? mockSpeechProvider;
  const actionProvider = options.actionProvider ?? mockActionProvider;

  while (phases.has(state.phase)) {
    const requirement = getTurnRequirement(state);
    if (requirement.type !== "ai") break;

    const advanced = await advanceAiTurn(
      state,
      requirement,
      speechProvider,
      actionProvider,
      options.speechContext,
      options.runtimeAiLlmConfigs,
    );
    state = advanced.state;
    aiLogs.push(advanced.aiLog);
  }

  return { state, aiLogs };
}

async function advanceAiTurn(
  initialState: GameState,
  requirement: AiTurnRequirement,
  speechProvider: AiSpeechProvider,
  actionProvider: AiActionProvider,
  speechContext?: AiSpeechProviderContext,
  runtimeAiLlmConfigs?: Record<string, AiFriendRuntimeLlmConfig>,
): Promise<{ state: GameState; aiLog: AiDecisionLog }> {
  let prompt = buildAgentView(initialState, requirement.actorSeatId, runtimeAiLlmConfigs);
  let tableRead = buildAiTableRead(prompt);
  const refreshedMemory = refreshAiSeatMemory(prompt, tableRead);
  prompt = { ...prompt, privateKnowledge: { ...prompt.privateKnowledge, aiMemory: refreshedMemory } };
  tableRead = buildAiTableRead(prompt);
  const speechPlan = isSpeechPhase(initialState.phase) ? createSpeechPlan(prompt, tableRead) : undefined;
  const votePlan = initialState.phase === "DAY_VOTE" ? createVotePlan(prompt, tableRead) : undefined;
  const shouldChooseSpeechAction = Boolean(speechPlan && getWhiteWolfKingExplodeAction(prompt));
  const actionResult =
    shouldChooseSpeechAction || !speechPlan
      ? await actionProvider.generateCommand(prompt, {
          tableRead,
          votePlan,
          fallbackCommand: createMockCommand(prompt, tableRead, votePlan),
        })
      : undefined;
  const shouldGenerateSpeech = Boolean(speechPlan && actionResult?.command.type !== "whiteWolfKingExplode");
  const speechResult = shouldGenerateSpeech ? await speechProvider.generateSpeech(prompt, speechPlan!, speechContext) : undefined;
  const output: Command = speechPlan
    ? actionResult?.command.type === "whiteWolfKingExplode"
      ? actionResult.command
      : initialState.phase === "SHERIFF_SPEECH" || initialState.phase === "SHERIFF_PK_SPEECH"
      ? {
          type: "sheriffSpeech",
          actorSeatId: requirement.actorSeatId,
          message: speechResult?.speech ?? "",
          reason: speechPlan.stance,
        }
      : { type: "speak", actorSeatId: requirement.actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
    : actionResult!.command;
  const memoryAfterDecision = rememberAiDecision(refreshedMemory, output, speechPlan, votePlan);
  const state = storeAiSeatMemory(applyCommand(initialState, output), memoryAfterDecision);

  return {
    state,
    aiLog: {
      gameId: state.id,
      day: prompt.day,
      seatNumber: requirement.actorSeatId,
      phase: requirement.phase,
      provider: speechResult?.provider ?? actionResult?.provider ?? mockActionProvider.providerId,
      prompt: sanitizeAgentViewForLog(prompt),
      output,
      votePlan,
      speechPlan,
      publicFactBasis: buildPublicDecisionFactBasis(prompt),
      rawOutput: speechResult?.rawOutput ?? actionResult?.rawOutput,
      isFallback: speechResult?.isFallback ?? actionResult?.isFallback ?? false,
      error: speechResult?.error ?? actionResult?.error,
      validationErrors: speechResult?.validationErrors ?? actionResult?.validationErrors,
    },
  };
}

export function createConfiguredAiOptions(optionsOrMode: { forceMock?: boolean } | RuntimeAiProviderMode = {}): AiAdvanceOptions {
  const forceMock = typeof optionsOrMode === "string" ? optionsOrMode === "mock" : optionsOrMode.forceMock === true;
  if (forceMock) {
    return {
      speechProvider: mockSpeechProvider,
      actionProvider: mockActionProvider,
    };
  }

  return {
    speechProvider: createConfiguredSpeechProvider(),
    actionProvider: createConfiguredActionProvider(mockActionProvider),
  };
}

export function createMockCommand(
  view: AgentView,
  tableRead = buildAiTableRead(view),
  votePlan?: VotePlan,
): Command {
  const actorSeatId = view.mySeatId;

  switch (view.phase) {
    case "NIGHT_WOLVES": {
      const target = chooseWolfKillTarget(view, tableRead);
      return {
        type: "wolfKill",
        actorSeatId,
        targetSeatId: target.seatId,
        reason: buildWolfKillReason(view, target),
      };
    }
    case "NIGHT_GUARD": {
      const target = chooseGuardTarget(view, tableRead);
      return {
        type: "guardAction",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? `${target.name} 是当前最需要保护的位置。` : "空守一晚，避免连续守人限制。",
      };
    }
    case "NIGHT_SEER": {
      const target = chooseSeerTarget(view, tableRead);
      return {
        type: "seerCheck",
        actorSeatId,
        targetSeatId: target.seatId,
        reason: buildSeerCheckReason(tableRead, target),
      };
    }
    case "NIGHT_WITCH":
      return chooseWitchAction(view, tableRead);
    case "NIGHT_WOLF_BEAUTY": {
      const target = chooseWolfBeautyCharmTarget(view, tableRead);
      return {
        type: "wolfBeautyCharm",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? `${target.name} 是白天可利用的高价值牵制位。` : "今晚不魅惑，避免把技能价值交在低信息位置。",
      };
    }
    case "DAY_SPEECH": {
      const explodeAction = getWhiteWolfKingExplodeAction(view);
      const explodeTarget = explodeAction ? chooseWhiteWolfKingExplodeTarget(view, tableRead, explodeAction.targets) : undefined;
      if (explodeTarget && shouldWhiteWolfKingExplode(view, tableRead, explodeTarget)) {
        return {
          type: "whiteWolfKingExplode",
          actorSeatId,
          targetSeatId: explodeTarget.seatId,
          reason: `${explodeTarget.name} 的公开价值最高，自爆带走能打断好人组织。`,
        };
      }
      const speechPlan = createSpeechPlan(view, tableRead);
      return {
        type: "speak",
        actorSeatId,
        message: messageFromSpeechPlan(speechPlan),
        reason: speechPlan.stance,
      };
    }
    case "SHERIFF_SPEECH":
    case "SHERIFF_PK_SPEECH": {
      const speechPlan = createSpeechPlan(view, tableRead);
      return {
        type: "sheriffSpeech",
        actorSeatId,
        message: messageFromSpeechPlan(speechPlan),
        reason: "警长竞选发言。",
      };
    }
    case "SHERIFF_NOMINATION":
      return {
        type: "sheriffNominate",
        actorSeatId,
        run: shouldRunForSheriff(view),
        reason: "根据身份和性格决定是否上警。",
      };
    case "SHERIFF_WITHDRAWAL":
      return {
        type: "sheriffWithdraw",
        actorSeatId,
        withdraw: shouldWithdrawFromSheriff(view, tableRead),
        reason: "根据警上压力决定是否退水。",
      };
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE": {
      const target = chooseSheriffVoteTarget(view, tableRead);
      return {
        type: "sheriffVote",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? `${target.name} 的警徽流收益最高。` : "候选人可信度不足，选择弃票。",
      };
    }
    case "LAST_WORDS":
      return {
        type: "lastWords",
        actorSeatId,
        message: buildMockLastWords(view, tableRead),
        reason: "出局遗言补充公开视角。",
      };
    case "DAY_VOTE": {
      const plan = votePlan ?? createVotePlan(view, tableRead);
      if (plan.abstain) {
        return {
          type: "vote",
          actorSeatId,
          reason: plan.reason,
        };
      }
      return {
        type: "vote",
        actorSeatId,
        targetSeatId: plan.target.seatId,
        reason: plan.reason,
      };
    }
    case "KNIGHT_DUEL": {
      const target = chooseKnightDuelTarget(view, tableRead);
      return {
        type: "knightDuel",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? buildKnightDuelReason(tableRead, target) : "证据还不足，骑士先保留决斗窗口。",
      };
    }
    case "HUNTER_SHOT": {
      const target = chooseShotTarget(view, tableRead, "hunterShoot");
      return {
        type: "hunterShoot",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? buildShotReason(tableRead, target, "hunterShoot") : "没有足够确定的带人目标。",
      };
    }
    case "WOLF_KING_SHOT": {
      const target = chooseShotTarget(view, tableRead, "wolfKingShoot");
      return {
        type: "wolfKingShoot",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? buildShotReason(tableRead, target, "wolfKingShoot") : "没有足够确定的带人目标。",
      };
    }
    case "SHERIFF_HANDOFF": {
      const target = chooseSheriffHandoffTarget(view, tableRead);
      return {
        type: "sheriffHandoff",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? `${target.name} 的公开可信度更适合接警徽。` : "不移交警徽。",
      };
    }
    default:
      throw new Error(`当前阶段不需要 mock 动作。`);
  }
}

function buildPublicDecisionFactBasis(view: AgentView): string[] {
  const spokenSeatIds = new Set(
    view.publicSummary.recentSpeeches
      .filter((speech) => speech.day === view.day && speech.speaker)
      .map((speech) => speech.speaker!.seatId),
  );
  const alreadySpoken = view.aliveSeats.filter((seat) => spokenSeatIds.has(seat.seatId));
  const unspoken = view.aliveSeats.filter((seat) => seat.seatId !== view.mySeatId && !spokenSeatIds.has(seat.seatId));
  const deaths = [
    ...new Set([
      ...view.publicSummary.recentDeaths,
      ...view.publicSummary.tableMemory.deathAnnouncements,
    ]),
  ].slice(-3);
  const recentSpeeches = view.publicSummary.recentSpeeches
    .filter((speech) => speech.speaker)
    .slice(-4)
    .map((speech) => `${seatText(speech.speaker!)}发言：${clipFact(speech.message, 72)}`);
  const claims = view.publicSummary.claimBoard.slice(-5).map((claim) => {
    const checks =
      claim.checks.length > 0
        ? `，报${claim.checks
            .map((check) => `${seatText(check.target)}${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
            .join("、")}`
        : "";
    return `${seatText(claim.claimant)}声称${claim.claimedRoleLabel}${checks}`;
  });
  const latestVote = view.publicSummary.tableMemory.voteHistory.at(-1);
  const voteLine =
    latestVote && latestVote.tally.length > 0
      ? `最近公开票型：${latestVote.tally.map((item) => `${seatText(item.target)}${item.count}票`).join("，")}。`
      : undefined;
  const reasoningCueLines = view.publicSummary.tableMemory.reasoningCues
    .slice(0, 5)
    .map((cue) => `公开推理线索：${cue.summary}${cue.evidence.length > 0 ? `；依据：${cue.evidence.slice(0, 2).join("、")}` : ""}`);
  const speechInfluenceLines = view.publicSummary.tableMemory.speechInfluence
    .slice(0, 3)
    .map((item) => `发言影响：${item.summary}`);

  return [
    `第${view.day}天，${view.mySeatId}号在${view.phase}阶段准备行动。`,
    `本日已发言：${formatTargets(alreadySpoken)}。`,
    `本日未发言：${formatTargets(unspoken)}。`,
    deaths.length > 0 ? `公开死讯：${deaths.join("；")}。` : "公开死讯：暂无。",
    claims.length > 0 ? `公开身份声明：${claims.join("；")}。` : "公开身份声明：暂无。",
    ...recentSpeeches,
    voteLine,
    ...reasoningCueLines,
    ...speechInfluenceLines,
    ...view.publicSummary.tableMemory.publicSignals.slice(-4).map((signal) => `公开局势信号：${signal}`),
  ].filter((fact): fact is string => Boolean(fact));
}

function formatTargets(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map(seatText).join("、") : "无";
}

function seatText(seat: ActionTarget): string {
  return `${seat.seatId}号`;
}

function clipFact(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function guardProtectScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  const publicSeer = seat.publicClaims.some((claim) => claim.claimedRole === "SEER");
  const guardConflictPenalty = view.rules.guardSaveConflictKills && view.day <= 1 && publicSeer ? 8 : 0;
  const supportActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "SUPPORT" || stance.kind === "FOLLOW")
      .map((stance) => stance.actor.seatId),
  );

  return (
    seat.trust -
    seat.suspicion * 0.12 +
    publicRoleValueScore(seat) * 0.8 +
    publicCueAttentionScore(tableRead, seat) * 0.35 +
    supportActors.size * 3 -
    guardConflictPenalty +
    stableSignedJitter(["guard-protect", view.day, view.mySeatId, view.persona?.id, seat.seatId], 4)
  );
}

function chooseGuardTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "guardAction");
  const targets = action.targets;
  if (targets.length === 0) return undefined;
  const bySeatId = new Map(tableRead.seats.map((seat) => [seat.seatId, seat]));
  const self = targets.find((target) => target.seatId === view.mySeatId);
  const publicSeer = targets.find((target) => bySeatId.get(target.seatId)?.publicClaims.some((claim) => claim.claimedRole === "SEER"));
  const publicSeerRead = publicSeer ? bySeatId.get(publicSeer.seatId) : undefined;
  const seerProtectedByWitchRisk = Boolean(
    publicSeerRead &&
      view.rules.guardSaveConflictKills &&
      view.day <= 1 &&
      publicSeerRead.trust >= publicSeerRead.suspicion,
  );
  if (publicSeer && !seerProtectedByWitchRisk && stableRoll(["guard-seer", view.day, view.mySeatId, publicSeer.seatId]) < 0.72) {
    return publicSeer;
  }
  if (self && stableRoll(["guard-self", view.day, view.mySeatId]) < 0.18) return self;
  return [...targets].sort((a, b) => {
    const readA = bySeatId.get(a.seatId);
    const readB = bySeatId.get(b.seatId);
    return (
      (readB ? guardProtectScore(view, tableRead, readB) : 0) -
      (readA ? guardProtectScore(view, tableRead, readA) : 0)
    );
  })[0];
}

function shouldRunForSheriff(view: AgentView): boolean {
  if (view.myRole === "SEER" || isWolfRole(view.myRole, view.rules.wolfRoles)) return true;
  if (view.myRole === "WITCH" || view.myRole === "HUNTER" || view.myRole === "GUARD") {
    return stableRoll(["sheriff-run-god", view.day, view.mySeatId, view.persona?.id]) < 0.58;
  }
  return stableRoll(["sheriff-run-villager", view.day, view.mySeatId, view.persona?.id]) < 0.22;
}

function shouldWithdrawFromSheriff(view: AgentView, tableRead: AiTableRead): boolean {
  if (view.myRole === "SEER") return false;
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    const alreadyManyCandidates = (view.privateKnowledge.sheriff?.candidates.length ?? 0) >= 4;
    return alreadyManyCandidates && stableRoll(["sheriff-wolf-withdraw", view.day, view.mySeatId, view.persona?.id]) < 0.32;
  }
  const selfRead = tableRead.seats.find((seat) => seat.isSelf);
  return (selfRead?.suspicion ?? 0) > 55 && stableRoll(["sheriff-withdraw-pressure", view.day, view.mySeatId]) < 0.65;
}

function chooseSheriffVoteTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "sheriffVote");
  if (action.targets.length === 0) return undefined;
  const bySeatId = new Map(tableRead.seats.map((seat) => [seat.seatId, seat]));
  return [...action.targets].sort((a, b) => {
    const readA = bySeatId.get(a.seatId);
    const readB = bySeatId.get(b.seatId);
    return (readB ? readB.trust - readB.suspicion * 0.25 : 0) - (readA ? readA.trust - readA.suspicion * 0.25 : 0);
  })[0];
}

function chooseSheriffHandoffTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "sheriffHandoff");
  if (action.targets.length === 0) return undefined;
  const bySeatId = new Map(tableRead.seats.map((seat) => [seat.seatId, seat]));
  return [...action.targets].sort((a, b) => {
    const readA = bySeatId.get(a.seatId);
    const readB = bySeatId.get(b.seatId);
    return (readB ? readB.trust - readB.suspicion * 0.2 : 0) - (readA ? readA.trust - readA.suspicion * 0.2 : 0);
  })[0];
}

function chooseWolfKillTarget(view: AgentView, tableRead: AiTableRead): ActionTarget {
  const action = getAction(view, "wolfKill");
  const legalTargetIds = new Set(action.targets.map((target) => target.seatId));
  const baitTarget = chooseWolfPotionBaitTarget(view, tableRead, legalTargetIds);
  if (baitTarget) {
    return toTarget(baitTarget);
  }

  const threat = view.privateKnowledge.wolfTeamPlan?.threat;
  if (
    threat &&
    legalTargetIds.has(threat.seatId) &&
    !isPrivateWolfSeat(view, threat.seatId) &&
    shouldTakeDirectNightShot(view, "team-threat", threat.seatId)
  ) {
    return threat;
  }

  const publicSeerThreat = tableRead.seats.find(
    (seat) =>
      legalTargetIds.has(seat.seatId) &&
      seat.publicClaims.some((claim) => claim.claimedRole === "SEER") &&
      !seat.isWolfTeammate,
  );
  if (publicSeerThreat && shouldTakeDirectNightShot(view, "public-seer", publicSeerThreat.seatId)) {
    return toTarget(publicSeerThreat);
  }

  const candidates = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId) && !isPrivateWolfSeat(view, seat.seatId))
    .sort((a, b) => nightKillScore(view, tableRead, b) - nightKillScore(view, tableRead, a) || a.seatId - b.seatId);
  return toTarget(candidates[0] ?? action.targets[0]);
}

function chooseWolfBeautyCharmTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "wolfBeautyCharm");
  const legalTargetIds = new Set(action.targets.map((target) => target.seatId));
  const candidates = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId) && !isPrivateWolfSeat(view, seat.seatId))
    .sort((a, b) => wolfBeautyCharmScore(view, tableRead, b) - wolfBeautyCharmScore(view, tableRead, a) || a.seatId - b.seatId);
  return candidates[0] ? toTarget(candidates[0]) : action.canSkip ? undefined : action.targets[0];
}

function wolfBeautyCharmScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  const powerClaimValue = seat.publicClaims.reduce((score, claim) => {
    if (claim.claimedRole === "SEER") return Math.max(score, 24);
    if (claim.claimedRole === "WITCH" || claim.claimedRole === "HUNTER" || claim.claimedRole === "KNIGHT") return Math.max(score, 18);
    if (claim.claimedRole === "GUARD" || claim.claimedRole === "IDIOT") return Math.max(score, 12);
    return score;
  }, 0);
  const roundValue = view.day >= 2 ? 6 : 0;
  return (
    seat.trust -
    seat.suspicion * 0.18 +
    powerClaimValue +
    publicRoleValueScore(seat) * 0.35 +
    publicCueAttentionScore(tableRead, seat) * 0.4 +
    roundValue
  );
}

function chooseWolfPotionBaitTarget(
  view: AgentView,
  tableRead: AiTableRead,
  legalTargetIds: Set<number>,
): SeatRead | undefined {
  if (view.day > 2) return undefined;

  const wolfTargets = tableRead.seats.filter((seat) => legalTargetIds.has(seat.seatId) && isPrivateWolfSeat(view, seat.seatId));
  if (wolfTargets.length === 0) return undefined;

  const bluffing = view.persona?.bluffing ?? 0.45;
  const risk = view.persona?.riskTolerance ?? 0.45;
  const threshold = clampProbability(0.04 + bluffing * 0.14 + risk * 0.08 - Math.max(0, view.day - 1) * 0.04);
  const roll = stableRoll(["wolf-potion-bait", view.day, view.mySeatId, view.persona?.id, wolfTargets.length]);
  if (roll >= threshold) return undefined;

  return [...wolfTargets].sort((a, b) => wolfBaitScore(b) - wolfBaitScore(a) || a.seatId - b.seatId)[0];
}

function wolfBaitScore(seat: SeatRead): number {
  return seat.trust - seat.suspicion * 0.2 + (seat.publicClaims.some((claim) => claim.claimedRole === "SEER") ? 18 : 0);
}

function chooseSeerTarget(view: AgentView, tableRead: AiTableRead): ActionTarget {
  const action = getAction(view, "seerCheck");
  const checked = new Set(view.privateKnowledge.seerChecks?.map((check) => check.targetSeatId) ?? []);
  const legalTargetIds = new Set(action.targets.filter((target) => !checked.has(target.seatId)).map((target) => target.seatId));
  const counterclaimTarget = view.publicSummary.tableMemory.counterclaims
    .find((group) => group.claimedRole === "SEER")
    ?.claimants.find((claimant) => claimant.seatId !== view.mySeatId && legalTargetIds.has(claimant.seatId));
  if (counterclaimTarget && stableRoll(["seer-counterclaim-check", view.day, view.mySeatId, counterclaimTarget.seatId]) < 0.82) {
    return counterclaimTarget;
  }

  const shiftedTarget = view.publicSummary.tableMemory.stanceShifts
    .map((shift) => tableRead.seats.find((seat) => seat.seatId === shift.actor.seatId && legalTargetIds.has(seat.seatId)))
    .find((seat): seat is SeatRead => Boolean(seat));
  if (shiftedTarget) return toTarget(shiftedTarget);

  const candidates = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId))
    .sort((a, b) => seerCheckScore(view, tableRead, b) - seerCheckScore(view, tableRead, a) || a.seatId - b.seatId);
  return toTarget(candidates[0] ?? action.targets.find((target) => !checked.has(target.seatId)) ?? action.targets[0]);
}

function chooseWitchAction(view: AgentView, tableRead: AiTableRead): Command {
  const action = getAction(view, "witchAction");
  const victim = action.saveTarget;

  if (action.canSave && victim && shouldSaveVictim(view, tableRead, victim)) {
    return {
      type: "witchAction",
      actorSeatId: view.mySeatId,
      mode: "save",
      reason: `${victim.name} 当前不像焦点狼，优先保夜间信息。`,
    };
  }

  if (action.canPoison && view.day >= 2) {
    const legalTargetIds = new Set(action.poisonTargets.map((target) => target.seatId));
    const target = tableRead.seats
      .filter((seat) => legalTargetIds.has(seat.seatId))
      .filter((seat) => hasStrongWitchPoisonEvidence(tableRead, seat))
      .sort((a, b) => witchPoisonScore(tableRead, b) - witchPoisonScore(tableRead, a) || a.seatId - b.seatId)[0];
    const publicWolfCheck = target?.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ?? false;

    const poisonThreshold =
      (publicWolfCheck ? 66 : 86) -
      (view.persona?.riskTolerance ?? 0.45) * (publicWolfCheck ? 12 : 10) +
      stableSignedJitter(
      ["witch-poison-threshold", view.day, view.mySeatId, view.persona?.id],
      4,
    );

    if (target && target.suspicion >= poisonThreshold) {
      return {
        type: "witchAction",
        actorSeatId: view.mySeatId,
        mode: "poison",
        targetSeatId: target.seatId,
        reason: buildWitchPoisonReason(tableRead, target),
      };
    }
  }

  return {
    type: "witchAction",
    actorSeatId: view.mySeatId,
    mode: "skip",
    reason: "信息不足，女巫先保留药品。",
  };
}

function chooseShotTarget(
  view: AgentView,
  tableRead: AiTableRead,
  actionType: "hunterShoot" | "wolfKingShoot",
): ActionTarget | undefined {
  const action = getAction(view, actionType);
  const legalTargetIds = new Set(action.targets.map((target) => target.seatId));
  const candidates = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId))
    .sort((a, b) => hunterShotScore(tableRead, b) - hunterShotScore(tableRead, a) || a.seatId - b.seatId);
  const target = candidates.find((seat) => {
    const publicWolfCheck = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
    const threshold = (publicWolfCheck ? 62 : 72) - (view.persona?.riskTolerance ?? 0.45) * 8;
    return hasStrongHunterShotEvidence(tableRead, seat) && seat.suspicion >= threshold;
  });

  return target ? toTarget(target) : undefined;
}

function chooseKnightDuelTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "knightDuel");
  const legalTargetIds = new Set(action.targets.map((target) => target.seatId));
  const target = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId))
    .sort((a, b) => knightDuelScore(tableRead, b) - knightDuelScore(tableRead, a) || a.seatId - b.seatId)[0];

  const publicWolfCheck = target?.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ?? false;
  const threshold = (publicWolfCheck ? 64 : 84) - (view.persona?.riskTolerance ?? 0.45) * 8;
  if (!target || !hasStrongKnightDuelEvidence(tableRead, target) || target.suspicion < threshold) return undefined;
  return toTarget(target);
}

function knightDuelScore(tableRead: AiTableRead, seat: SeatRead): number {
  const publicWolfCheckBonus = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ? 16 : 0;
  const counterclaimBonus = seat.publicClaims.some((claim) => claim.claimedRole === "SEER") ? 5 : 0;
  return seat.suspicion - seat.trust * 0.12 + publicWolfCheckBonus + counterclaimBonus + publicCueAttentionScore(tableRead, seat) * 0.6;
}

function hasStrongKnightDuelEvidence(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (seat.pressure.some((item) => item.includes("未对跳") || item.includes("被后置预言家查杀"))) {
    return false;
  }
  if (seat.pressure.some((item) => item.includes("夜死后遗留查杀") || item.includes("后置查杀已跳预言家"))) {
    return true;
  }
  const negativeActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );
  const hasPublicBlackCheck = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
  if (hasStrongPublicActionCue(tableRead, seat) && seat.suspicion >= 88) return true;
  return hasPublicBlackCheck && seat.suspicion >= 92 && negativeActors.size >= 3;
}

function chooseWhiteWolfKingExplodeTarget(
  _view: AgentView,
  tableRead: AiTableRead,
  targets: ActionTarget[],
): ActionTarget | undefined {
  const legalTargetIds = new Set(targets.map((target) => target.seatId));
  const target = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId) && !seat.isWolfTeammate)
    .sort((a, b) => whiteWolfKingExplodeScore(tableRead, b) - whiteWolfKingExplodeScore(tableRead, a) || a.seatId - b.seatId)[0];
  return target ? toTarget(target) : undefined;
}

function shouldWhiteWolfKingExplode(view: AgentView, tableRead: AiTableRead, target: ActionTarget): boolean {
  const selfRead = tableRead.seats.find((seat) => seat.seatId === view.mySeatId);
  const targetRead = tableRead.seats.find((seat) => seat.seatId === target.seatId);
  if (!selfRead || !targetRead) return false;
  if (targetRead.isWolfTeammate) return false;

  const selfPressure = selfRead.suspicion - selfRead.trust;
  const targetValue = whiteWolfKingExplodeScore(tableRead, targetRead);
  const underHardPressure =
    selfPressure >= 30 ||
    selfRead.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ||
    selfRead.publicStancedBy.filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE").length >= 3;
  const concreteTargetValue =
    targetRead.publicClaims.some((claim) => claim.claimedRole === "SEER" || POWER_CLAIM_ROLES.has(claim.claimedRole)) ||
    targetRead.publicChecksAgainst.some((check) => check.result === "GOOD");
  const highValueTarget = targetValue >= 76 && concreteTargetValue;
  const blackChecked = selfRead.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
  const targetClaimedSeer = targetRead.publicClaims.some((claim) => claim.claimedRole === "SEER");

  if (!underHardPressure || !highValueTarget) return false;
  if (view.day === 1 && !(blackChecked && targetClaimedSeer)) return false;
  const base = view.day >= 3 ? 0.28 : 0.18;
  const valueBoost = Math.max(0, Math.min(0.2, (targetValue - 70) / 120));
  const threshold = clampProbability(base + valueBoost + (view.persona?.riskTolerance ?? 0.45) * 0.08);
  return stableRoll(["white-wolf-king-explode", view.day, view.mySeatId, target.seatId, view.persona?.id]) < threshold;
}

function whiteWolfKingExplodeScore(tableRead: AiTableRead, seat: SeatRead): number {
  const claimValue = seat.publicClaims.reduce((score, claim) => {
    if (claim.claimedRole === "SEER") return Math.max(score, 40);
    if (claim.claimedRole === "WITCH" || claim.claimedRole === "HUNTER" || claim.claimedRole === "GUARD") return Math.max(score, 28);
    if (claim.claimedRole === "KNIGHT") return Math.max(score, 24);
    if (claim.claimedRole === "IDIOT") return Math.max(score, 10);
    if (claim.claimedRole === "VILLAGER") return Math.max(score, 8);
    return score;
  }, 0);
  const checkedGoodValue = seat.publicChecksAgainst.some((check) => check.result === "GOOD") ? 14 : 0;
  return seat.trust * 0.85 - seat.suspicion * 0.12 + claimValue + checkedGoodValue + publicCueAttentionScore(tableRead, seat) * 0.5;
}

function getWhiteWolfKingExplodeAction(view: AgentView) {
  return view.allowedActions.find(
    (action): action is Extract<AgentView["allowedActions"][number], { type: "whiteWolfKingExplode" }> =>
      action.type === "whiteWolfKingExplode",
  );
}

function sanitizeAgentViewForLog(view: AgentView): AgentView {
  if (!view.llmConfig?.apiKey) return view;
  const llmConfig = { ...view.llmConfig };
  delete llmConfig.apiKey;
  return { ...view, llmConfig };
}

function shouldSaveVictim(view: AgentView, tableRead: AiTableRead, victim: ActionTarget): boolean {
  const victimRead = tableRead.seats.find((seat) => seat.seatId === victim.seatId);
  if (shouldDeferPublicSeerSaveToGuard(view, victimRead)) return false;
  if (victimRead?.publicClaims.some((claim) => claim.claimedRole === "SEER")) return true;
  if (victimRead && publicRoleValueScore(victimRead) >= 18 && victimRead.trust >= victimRead.suspicion - 8) {
    return true;
  }
  if (view.day === 1) {
    const trustDelta = victimRead ? (victimRead.trust - victimRead.suspicion) / 160 : 0;
    const threshold = clampProbability(0.58 + trustDelta - (view.persona?.riskTolerance ?? 0.45) * 0.16);
    return stableRoll(["witch-save", view.day, view.mySeatId, view.persona?.id, victim.seatId]) < threshold;
  }
  if (victimRead && victimRead.publicStancedBy.some((stance) => stance.kind === "SUPPORT")) return true;
  if (!victimRead) return false;

  const threshold = clampProbability(0.34 + (victimRead.trust - victimRead.suspicion) / 120 - (view.persona?.riskTolerance ?? 0.45) * 0.12);
  return stableRoll(["witch-save", view.day, view.mySeatId, view.persona?.id, victim.seatId]) < threshold;
}

function shouldDeferPublicSeerSaveToGuard(view: AgentView, victimRead: SeatRead | undefined): boolean {
  return Boolean(
    view.rules?.hasGuard &&
      view.rules.guardSaveConflictKills &&
      victimRead?.publicClaims.some((claim) => claim.claimedRole === "SEER"),
  );
}

function witchPoisonScore(tableRead: AiTableRead, seat: SeatRead): number {
  const publicWolfCheckBonus = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ? 14 : 0;
  const claimPenalty = seat.publicClaims.some((claim) => claim.claimedRole === "SEER" || claim.claimedRole === "WITCH") ? 8 : 0;
  const counterclaimBonus = isSeerCounterclaimant(tableRead, seat.seatId) ? 12 : 0;
  const reactiveClaimantBonus = isReactiveSeerClaimant(tableRead.tableMemory, seat.seatId) ? 18 : 0;
  const deadSeerLegacyBonus = hasDeadSeerLegacyBlackCheck(tableRead, seat.seatId) ? 22 : 0;
  const protectedTargetPenalty = isProtectedPowerClaim(tableRead, seat) || isTargetOfReactiveSeerBlackCheck(tableRead, seat.seatId) ? 32 : 0;
  return (
    seat.suspicion -
    seat.trust * 0.08 +
    publicWolfCheckBonus +
    counterclaimBonus +
    reactiveClaimantBonus +
    deadSeerLegacyBonus -
    claimPenalty -
    protectedTargetPenalty
  );
}

function hasStrongWitchPoisonEvidence(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (isProtectedPowerClaim(tableRead, seat) || isTargetOfReactiveSeerBlackCheck(tableRead, seat.seatId)) {
    return false;
  }

  if (seat.isKnownWolf) return true;

  if (hasDeadSeerLegacyBlackCheck(tableRead, seat.seatId) && seat.suspicion >= 78) {
    return true;
  }

  if (isReactiveSeerClaimant(tableRead.tableMemory, seat.seatId) && seat.suspicion >= 78) {
    return true;
  }

  const challengePressure = seat.suspicion - seat.trust;
  const pressureActors = publicActionPressureActors(seat);
  if (isSeerCounterclaimant(tableRead, seat.seatId) && seat.suspicion >= 90 && challengePressure >= 38 && pressureActors.length >= 2) {
    return true;
  }

  if (hasStrongPublicPoisonCue(tableRead, seat) && seat.suspicion >= 90) {
    return true;
  }

  return hasTrustedPublicWolfCheck(tableRead, seat) && seat.suspicion >= 86;
}

function isProtectedPowerClaim(tableRead: AiTableRead, seat: SeatRead): boolean {
  const hasPowerClaim = seat.publicClaims.some((claim) => POWER_CLAIM_ROLES.has(claim.claimedRole));
  if (!hasPowerClaim) return false;
  const hasPublicBlackCheck = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
  return !hasPublicBlackCheck && !isCounterclaimant(tableRead, seat.seatId);
}

function hasTrustedPublicWolfCheck(tableRead: AiTableRead, seat: SeatRead): boolean {
  return seat.publicChecksAgainst.some((check) => {
    if (check.result !== "WEREWOLF") return false;
    const claimant = tableRead.seats.find((candidate) => candidate.seatId === check.claimant.seatId);
    return Boolean(claimant && isTrustedPublicSeerForPoison(tableRead, claimant, seat));
  });
}

function isTrustedPublicSeerForPoison(tableRead: AiTableRead, claimant: SeatRead, target: SeatRead): boolean {
  const credibilityDelta = claimant.trust - claimant.suspicion;

  if (isReactiveSeerBlackCheck(tableRead.tableMemory, claimant.seatId, target.seatId)) {
    return credibilityDelta >= 34;
  }

  if (!isSeerCounterclaimant(tableRead, claimant.seatId)) {
    return claimant.trust >= claimant.suspicion + 8;
  }

  return credibilityDelta >= 24 || (target.suspicion >= 88 && claimant.trust >= claimant.suspicion + 12);
}

function hasDeadSeerLegacyBlackCheck(tableRead: AiTableRead, targetSeatId: number): boolean {
  return tableRead.tableMemory.seerLegacies.some((legacy) =>
    legacy.checks.some((check) => check.target.seatId === targetSeatId && check.result === "WEREWOLF"),
  );
}

function isSeerCounterclaimant(tableRead: AiTableRead, seatId: number): boolean {
  return isCounterclaimant(tableRead, seatId, "SEER");
}

function isCounterclaimant(tableRead: AiTableRead, seatId: number, role?: string): boolean {
  return tableRead.tableMemory.counterclaims.some(
    (group) =>
      (!role || group.claimedRole === role) && group.claimants.some((claimant) => claimant.seatId === seatId),
  );
}

function isReactiveSeerClaimant(tableMemory: AiTableRead["tableMemory"], claimantSeatId: number): boolean {
  const claim = tableMemory.claimBoard.find(
    (item) => item.claimedRole === "SEER" && item.claimant.seatId === claimantSeatId,
  );
  return Boolean(
    claim?.checks.some(
      (check) =>
        check.result === "WEREWOLF" && isReactiveSeerBlackCheck(tableMemory, claimantSeatId, check.target.seatId),
    ),
  );
}

function isTargetOfReactiveSeerBlackCheck(tableRead: AiTableRead, targetSeatId: number): boolean {
  return tableRead.tableMemory.claimBoard.some(
    (claim) =>
      claim.claimedRole === "SEER" &&
      claim.checks.some(
        (check) =>
          check.result === "WEREWOLF" &&
          check.target.seatId === targetSeatId &&
          isReactiveSeerBlackCheck(tableRead.tableMemory, claim.claimant.seatId, targetSeatId),
      ),
  );
}

function isReactiveSeerBlackCheck(
  tableMemory: AiTableRead["tableMemory"],
  claimantSeatId: number,
  targetSeatId: number,
): boolean {
  const claim = tableMemory.claimBoard.find(
    (item) => item.claimedRole === "SEER" && item.claimant.seatId === claimantSeatId,
  );
  const targetClaim = tableMemory.claimBoard.find(
    (item) => item.claimedRole === "SEER" && item.claimant.seatId === targetSeatId,
  );
  if (!claim?.sourceSpeechSeq || !targetClaim?.sourceSpeechSeq) return false;
  return claim.sourceSpeechSeq > targetClaim.sourceSpeechSeq;
}

function publicRoleValueScore(seat: SeatRead): number {
  const claimValue = seat.publicClaims.reduce((score, claim) => {
    switch (claim.claimedRole) {
      case "SEER":
        return Math.max(score, 30);
      case "WITCH":
        return Math.max(score, 24);
      case "HUNTER":
      case "KNIGHT":
      case "GUARD":
        return Math.max(score, 18);
      case "IDIOT":
        return Math.max(score, 10);
      case "VILLAGER":
        return Math.max(score, 4);
      default:
        return score;
    }
  }, 0);
  const checkedGoodValue = seat.publicChecksAgainst.some((check) => check.result === "GOOD") ? 8 : 0;
  return claimValue + checkedGoodValue;
}

function publicCueAttentionScore(tableRead: AiTableRead, seat: SeatRead): number {
  return tableRead.tableMemory.reasoningCues.reduce((total, cue) => {
    const touchesSeat = cue.target?.seatId === seat.seatId || cue.actor?.seatId === seat.seatId;
    if (!touchesSeat) return total;
    if (cue.weight === "strong") return total + 10;
    if (cue.weight === "medium") return total + 6;
    return total + 3;
  }, 0);
}

function buildSeerCheckReason(tableRead: AiTableRead, target: ActionTarget): string {
  const seat = findSeatRead(tableRead, target);
  const evidence = seat ? describePublicActionEvidence(tableRead, seat) : undefined;
  return evidence
    ? `${target.name}这条线有验人收益：${evidence}，今晚先查清。`
    : `${target.name}是当前焦点，查验收益最高。`;
}

function buildWitchPoisonReason(tableRead: AiTableRead, target: SeatRead): string {
  const evidence = describePublicActionEvidence(tableRead, target);
  return evidence
    ? `${target.name}的狼面不是单点听感：${evidence}，毒药用来提前排掉这条硬坑。`
    : `${target.name}的公开疑点较高，毒药用于加速排坑。`;
}

function buildShotReason(tableRead: AiTableRead, target: ActionTarget, actionType: "hunterShoot" | "wolfKingShoot"): string {
  const seat = findSeatRead(tableRead, target);
  const evidence = seat ? describePublicActionEvidence(tableRead, seat) : undefined;
  const toolText = actionType === "hunterShoot" ? "猎人枪" : "狼王枪";
  return evidence
    ? `${target.name}的公开证据能闭合：${evidence}，${toolText}先处理这里。`
    : `${target.name}的公开疑点最高，${toolText}优先处理。`;
}

function buildKnightDuelReason(tableRead: AiTableRead, target: ActionTarget): string {
  const seat = findSeatRead(tableRead, target);
  const evidence = seat ? describePublicActionEvidence(tableRead, seat) : undefined;
  return evidence
    ? `${target.name}的狼面有公开依据：${evidence}，骑士决斗可以直接验证。`
    : `${target.name}的公开狼面足够高，骑士决斗可以直接验证。`;
}

function describePublicActionEvidence(tableRead: AiTableRead, seat: SeatRead): string | undefined {
  const legacy = tableRead.tableMemory.seerLegacies.find((item) =>
    item.checks.some((check) => check.target.seatId === seat.seatId && check.result === "WEREWOLF"),
  );
  if (legacy) return `${legacy.claimant.name}夜死后留下查杀线`;

  const trustedCheck = seat.publicChecksAgainst.find((check) => check.result === "WEREWOLF");
  if (trustedCheck) return `${trustedCheck.claimant.name}公开报过查杀`;

  const cue = strongestReasoningCue(tableRead, seat);
  if (cue) {
    const evidence = cue.evidence[0] ? `，依据是${clipActionReason(cue.evidence[0], 36)}` : "";
    return `公开线索指向这里：${clipActionReason(cue.summary, 44)}${evidence}`;
  }

  const pressureActors = publicActionPressureActors(seat);
  if (pressureActors.length >= 2) {
    return `${pressureActors.slice(0, 3).map((actor) => actor.name).join("、")}都给过公开压力`;
  }

  const structuralPressure = seat.pressure.find((item) => /查验|对跳|身份|站边|票型|死亡|夜死|归票|施压/.test(item));
  if (structuralPressure) return clipActionReason(structuralPressure, 50);

  return undefined;
}

function hasStrongPublicActionCue(tableRead: AiTableRead, seat: SeatRead): boolean {
  const cue = strongestReasoningCue(tableRead, seat);
  if (!cue || cue.weight !== "strong") return false;

  const pressureGap = seat.suspicion - seat.trust;
  const cueText = `${cue.summary} ${cue.evidence.join(" ")}`;
  const hasStructuralCue = /查验|对跳|身份|站边|票型|起票|补票|死亡|夜死|归票|闭环|反复/.test(cueText);
  return pressureGap >= 28 && (hasStructuralCue || publicActionPressureActors(seat).length >= 1);
}

function hasStrongPublicPoisonCue(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (!hasStrongPublicActionCue(tableRead, seat)) return false;
  if (hasDeadSeerLegacyBlackCheck(tableRead, seat.seatId)) return true;
  if (hasTrustedPublicWolfCheck(tableRead, seat)) return true;
  if (hasUntrustedPublicWolfCheck(tableRead, seat)) return false;
  return publicActionPressureActors(seat).length >= 2;
}

function hasUntrustedPublicWolfCheck(tableRead: AiTableRead, seat: SeatRead): boolean {
  const hasPublicWolfCheck = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
  return hasPublicWolfCheck && !hasTrustedPublicWolfCheck(tableRead, seat) && !hasDeadSeerLegacyBlackCheck(tableRead, seat.seatId);
}

function strongestReasoningCue(
  tableRead: AiTableRead,
  seat: SeatRead,
): AiTableRead["tableMemory"]["reasoningCues"][number] | undefined {
  return tableRead.tableMemory.reasoningCues
    .filter((cue) => cue.target?.seatId === seat.seatId)
    .sort((a, b) => reasoningCueActionRank(b.weight) - reasoningCueActionRank(a.weight))[0];
}

function reasoningCueActionRank(weight: AiTableRead["tableMemory"]["reasoningCues"][number]["weight"]): number {
  if (weight === "strong") return 3;
  if (weight === "medium") return 2;
  return 1;
}

function publicActionPressureActors(seat: SeatRead): ActionTarget[] {
  const actors = new Map<number, ActionTarget>();
  for (const stance of seat.publicStancedBy) {
    if (stance.kind === "QUESTION" || stance.kind === "PRESSURE") {
      actors.set(stance.actor.seatId, stance.actor);
    }
  }
  return [...actors.values()];
}

function findSeatRead(tableRead: AiTableRead, target: ActionTarget): SeatRead | undefined {
  return tableRead.seats.find((seat) => seat.seatId === target.seatId);
}

function clipActionReason(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function hunterShotScore(tableRead: AiTableRead, seat: SeatRead): number {
  const publicWolfCheckBonus = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ? 12 : 0;
  const trustedClaimPenalty = seat.publicClaims.some((claim) => claim.claimedRole === "SEER" || claim.claimedRole === "WITCH")
    ? 24
    : seat.publicClaims.some((claim) => POWER_CLAIM_ROLES.has(claim.claimedRole))
      ? 14
      : 0;
  return seat.suspicion - seat.trust * 0.1 + publicWolfCheckBonus - trustedClaimPenalty + publicCueAttentionScore(tableRead, seat) * 0.45;
}

function hasStrongHunterShotEvidence(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (seat.pressure.some((item) => item.includes("被后置预言家查杀") || item.includes("未对跳"))) {
    return false;
  }

  if (seat.pressure.some((item) => item.includes("夜死后遗留查杀"))) {
    return true;
  }

  if (isOnlyContestedSeerBlackCheckPressure(tableRead, seat)) {
    return false;
  }

  if (isProtectedHunterShotTarget(tableRead, seat)) {
    return false;
  }

  const negativeActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );

  if (seat.pressure.some((item) => item.includes("后置查杀已跳预言家"))) {
    return seat.suspicion >= 88 && negativeActors.size >= 2;
  }

  if (
    seat.publicClaims.some((claim) => claim.claimedRole === "SEER") &&
    seat.pressure.some((item) => item.includes("处在预言家对跳关系"))
  ) {
    return seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF") && seat.suspicion >= 92 && negativeActors.size >= 3;
  }

  const pressureActors = new Set(
    seat.publicStancedBy.filter((stance) => stance.kind === "PRESSURE").map((stance) => stance.actor.seatId),
  );
  const hasBlackCheckPressure = seat.pressure.some((item) => /查杀/.test(item)) || seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
  if (
    pressureActors.size >= 1 &&
    seat.suspicion >= 88 &&
    seat.pressure.some((item) => /施压|查杀|对跳|归票|公开/.test(item)) &&
    (!hasBlackCheckPressure || hasTrustedPublicWolfCheck(tableRead, seat))
  ) {
    return true;
  }
  if (hasStrongPublicActionCue(tableRead, seat) && seat.suspicion >= 88) return true;
  if (negativeActors.size >= 3 && seat.suspicion >= 88) return true;

  return hasTrustedPublicWolfCheck(tableRead, seat) && seat.suspicion >= 90 && negativeActors.size >= 2;
}

function isOnlyContestedSeerBlackCheckPressure(tableRead: AiTableRead, seat: SeatRead): boolean {
  const wolfChecks = seat.publicChecksAgainst.filter((check) => check.result === "WEREWOLF");
  if (wolfChecks.length === 0) return false;
  if (hasDeadSeerLegacyBlackCheck(tableRead, seat.seatId)) return false;
  if (isSeerCounterclaimant(tableRead, seat.seatId) || isReactiveSeerClaimant(tableRead.tableMemory, seat.seatId)) return false;

  return wolfChecks.every((check) => isSeerCounterclaimant(tableRead, check.claimant.seatId));
}

function isProtectedHunterShotTarget(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (seat.isKnownWolf || hasDeadSeerLegacyBlackCheck(tableRead, seat.seatId)) return false;

  const powerClaim = seat.publicClaims.find((claim) => POWER_CLAIM_ROLES.has(claim.claimedRole));
  if (!powerClaim) return false;

  if (powerClaim.claimedRole === "SEER") {
    return !isSeerCounterclaimant(tableRead, seat.seatId) && !isReactiveSeerClaimant(tableRead.tableMemory, seat.seatId);
  }

  const sameRoleCounterclaim = isCounterclaimant(tableRead, seat.seatId, powerClaim.claimedRole);
  if (sameRoleCounterclaim) return false;

  const negativeActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );
  const challengePressure = seat.suspicion - seat.trust;
  const overwhelmingPublicCase =
    hasTrustedPublicWolfCheck(tableRead, seat) && seat.suspicion >= 96 && challengePressure >= 54 && negativeActors.size >= 4;

  return !overwhelmingPublicCase;
}

function shouldTakeDirectNightShot(view: AgentView, reason: string, targetSeatId: number): boolean {
  const bluffing = view.persona?.bluffing ?? 0.45;
  const risk = view.persona?.riskTolerance ?? 0.45;
  const basePressure = reason === "public-seer" ? 0.56 : reason === "team-threat" ? 0.64 : 0.76;
  const threshold = clampProbability(basePressure - bluffing * 0.18 - risk * 0.08 + Math.min(0.12, view.day * 0.03));
  return stableRoll(["night-shot", reason, view.day, view.mySeatId, view.persona?.id, targetSeatId]) < threshold;
}

function nightKillScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  return (
    seat.trust -
    seat.suspicion * 0.28 +
    publicRoleValueScore(seat) * 0.7 +
    publicCueAttentionScore(tableRead, seat) * 0.35 +
    stableSignedJitter(["night-kill", view.day, view.mySeatId, view.persona?.id, seat.seatId], 7)
  );
}

function seerCheckScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  const counterclaimBonus = isSeerCounterclaimant(tableRead, seat.seatId) ? 18 : 0;
  const focusBonus = tableRead.focus?.seatId === seat.seatId ? 10 : tableRead.backupFocus?.seatId === seat.seatId ? 5 : 0;
  const stanceShiftBonus = tableRead.tableMemory.stanceShifts.some((shift) => shift.actor.seatId === seat.seatId) ? 8 : 0;
  const claimPenalty = seat.publicClaims.some((claim) => claim.claimedRole !== "SEER") ? 8 : 0;
  return (
    seat.suspicion -
    seat.trust * 0.1 +
    counterclaimBonus +
    focusBonus +
    stanceShiftBonus +
    publicCueAttentionScore(tableRead, seat) * 0.5 -
    claimPenalty +
    stableSignedJitter(["seer-check", view.day, view.mySeatId, view.persona?.id, seat.seatId], 6)
  );
}

function buildWolfKillReason(view: AgentView, target: ActionTarget): string {
  if (isPrivateWolfSeat(view, target.seatId)) {
    return `${target.name} 适合做反向刀口，夜里赌一手药线和白天身份空间。`;
  }
  if (view.privateKnowledge.wolfTeamPlan?.threat?.seatId === target.seatId) {
    return `${target.name} 公开占到关键身份线，夜里优先拆掉。`;
  }
  if (view.privateKnowledge.wolfTeamPlan?.primaryTarget?.seatId === target.seatId) {
    return `${target.name} 是当前公开焦点，夜里顺势处理。`;
  }
  return `${target.name} 当前可信度较高，夜里先拆稳定发言位。`;
}

function buildMockLastWords(view: AgentView, tableRead: AiTableRead): string {
  const focus = tableRead.focus;
  const backup = tableRead.backupFocus;
  const focusText = focus ? `${focus.seatId}号${focus.name}` : "当前焦点位";
  const backupText = backup ? `${backup.seatId}号${backup.name}` : "外置位";
  const latestSpeech = tableRead.recentSpeeches.find((speech) => speech.speaker?.seatId !== view.mySeatId);
  const latestText = latestSpeech?.speaker ? `${latestSpeech.speaker.seatId}号${latestSpeech.speaker.name}` : undefined;
  const voteLead = tableRead.voteSnapshot.leaders[0];
  const voteText = voteLead ? `${voteLead.seatId}号${voteLead.name}` : undefined;

  if (view.myRole === "SEER" && view.privateKnowledge.seerChecks?.length) {
    const check = view.privateKnowledge.seerChecks.at(-1)!;
    return compactLastWords(
      `我最后把预言家视角留清：${check.targetSeatId}号${check.result === "WEREWOLF" ? "查杀" : "金水"}。我走以后先按这条验人线回看站边和票型，别让对跳位轻松带走节奏。`,
    );
  }

  if (view.myRole === "WITCH") {
    return compactLastWords(
      `我遗言留女巫视角：今天先回看谁借死讯强行带节奏，${focusText}和${backupText}的发言要连着票型一起校验。`,
    );
  }

  if (view.myRole === "HUNTER") {
    return compactLastWords(`我遗言留枪牌视角：谁推动我出局、谁只跟票不补理由，明天先按这个顺序查，${focusText}别被轻放。`);
  }

  if (latestText) {
    return compactLastWords(`我出局前留一条线：${latestText}刚才的发言要和后面投票对照，谁顺着单点带节奏，明天优先回看。`);
  }

  if (voteText) {
    return compactLastWords(`我最后看票型：如果今天票集中到${voteText}，明天一定复盘谁起票、谁补票、谁最后跟票。`);
  }

  return compactLastWords(`我留下最后视角：${focusText}别只听结论，要回看发言和票型是不是连得上；${backupText}的态度也别放掉。`);
}

function compactLastWords(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length <= 800 ? clean : `${clean.slice(0, 799)}。`;
}

function isPrivateWolfSeat(view: AgentView, seatId: number): boolean {
  return (
    isWolfRole(view.myRole, view.rules.wolfRoles) &&
    (seatId === view.mySeatId || (view.privateKnowledge.wolfTeammates ?? []).some((teammate) => teammate.seatId === seatId))
  );
}

function messageFromSpeechPlan(plan: ReturnType<typeof createSpeechPlan>): string {
  if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check) {
    const resultText = plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水";
    return `我跳预言家，${plan.claimIntent.check.targetSeatId}号是${resultText}。${plan.talkingPoints.join("。")}`;
  }
  if (plan.claimIntent?.claimedRole === "WITCH") {
    return `女巫牌先不急着跳。${plan.talkingPoints.join("。")}`;
  }
  if (plan.claimIntent?.claimedRole === "HUNTER") {
    return `底牌不虚但不乱拍身份。${plan.talkingPoints.join("。")}`;
  }
  if (plan.claimIntent?.claimedRole === "KNIGHT") {
    return `底牌不虚，骑士技能不替代推理。${plan.talkingPoints.join("。")}`;
  }
  return plan.talkingPoints.join("。");
}

function getAction<T extends AgentView["allowedActions"][number]["type"]>(
  view: AgentView,
  type: T,
): Extract<AgentView["allowedActions"][number], { type: T }> {
  const action = view.allowedActions.find((item) => item.type === type);
  if (!action) {
    throw new Error(`缺少 ${type} 可执行动作。`);
  }
  return action as Extract<AgentView["allowedActions"][number], { type: T }>;
}

function toTarget(seat: SeatRead | ActionTarget): ActionTarget {
  return {
    seatId: seat.seatId,
    name: seat.name,
  };
}

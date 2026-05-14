import { applyCommand, applySystemStep, getTurnRequirement } from "@/game/engine";
import { clampProbability, stableRoll, stableSignedJitter } from "@/game/decisionNoise";
import { buildAgentView } from "@/game/projection";
import type { ActionTarget, AgentView, AiTableRead, Command, GameState, SeatRead, VotePlan } from "@/game/types";
import { createConfiguredActionProvider } from "./actionProviders";
import { refreshAiSeatMemory, rememberAiDecision, storeAiSeatMemory } from "./seatMemory";
import { createConfiguredSpeechProvider, mockSpeechProvider } from "./speechProviders";
import { buildAiTableRead, createSpeechPlan, createVotePlan } from "./tableRead";
import type { AiActionProvider, AiDecisionLog, AiSpeechProvider, AiSpeechProviderContext } from "./types";

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
    let prompt = buildAgentView(state, actorSeatId);
    let tableRead = buildAiTableRead(prompt);
    const refreshedMemory = refreshAiSeatMemory(prompt, tableRead);
    prompt = { ...prompt, privateKnowledge: { ...prompt.privateKnowledge, aiMemory: refreshedMemory } };
    tableRead = buildAiTableRead(prompt);
    const speechPlan = state.phase === "DAY_SPEECH" ? createSpeechPlan(prompt, tableRead) : undefined;
    const votePlan = state.phase === "DAY_VOTE" ? createVotePlan(prompt, tableRead) : undefined;
    const speechResult = speechPlan ? await speechProvider.generateSpeech(prompt, speechPlan, options.speechContext) : undefined;
    const actionResult = speechPlan
      ? undefined
      : await actionProvider.generateCommand(prompt, {
          tableRead,
          votePlan,
          fallbackCommand: createMockCommand(prompt, tableRead, votePlan),
        });
    const output: Command = speechPlan
      ? { type: "speak", actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
      : actionResult!.command;
    const memoryAfterDecision = rememberAiDecision(refreshedMemory, output, speechPlan, votePlan);

    state = applyCommand(state, output);
    state = storeAiSeatMemory(state, memoryAfterDecision);
    aiLogs.push({
      gameId: state.id,
      seatNumber: actorSeatId,
      phase: requirement.phase,
      provider: speechResult?.provider ?? actionResult?.provider ?? mockActionProvider.providerId,
      prompt,
      output,
      votePlan,
      speechPlan,
      publicFactBasis: speechPlan ? buildPublicSpeechFactBasis(prompt) : undefined,
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

  if (initialState.phase === "DAY_VOTE") {
    return advancePendingAiVotes(initialState, options);
  }

  const advanced = await advanceAiTurn(initialState, requirement, speechProvider, actionProvider, options.speechContext);
  return { state: advanced.state, aiLogs: [advanced.aiLog] };
}

export async function advancePendingAiVotes(
  initialState: GameState,
  options: AiAdvanceOptions = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  let state = initialState;
  const aiLogs: AiDecisionLog[] = [];
  const speechProvider = options.speechProvider ?? mockSpeechProvider;
  const actionProvider = options.actionProvider ?? mockActionProvider;

  while (state.phase === "DAY_VOTE") {
    const requirement = getTurnRequirement(state);
    if (requirement.type !== "ai") break;

    const advanced = await advanceAiTurn(state, requirement, speechProvider, actionProvider, options.speechContext);
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
): Promise<{ state: GameState; aiLog: AiDecisionLog }> {
  let prompt = buildAgentView(initialState, requirement.actorSeatId);
  let tableRead = buildAiTableRead(prompt);
  const refreshedMemory = refreshAiSeatMemory(prompt, tableRead);
  prompt = { ...prompt, privateKnowledge: { ...prompt.privateKnowledge, aiMemory: refreshedMemory } };
  tableRead = buildAiTableRead(prompt);
  const speechPlan = initialState.phase === "DAY_SPEECH" ? createSpeechPlan(prompt, tableRead) : undefined;
  const votePlan = initialState.phase === "DAY_VOTE" ? createVotePlan(prompt, tableRead) : undefined;
  const speechResult = speechPlan ? await speechProvider.generateSpeech(prompt, speechPlan, speechContext) : undefined;
  const actionResult = speechPlan
    ? undefined
    : await actionProvider.generateCommand(prompt, {
        tableRead,
        votePlan,
        fallbackCommand: createMockCommand(prompt, tableRead, votePlan),
      });
  const output: Command = speechPlan
    ? { type: "speak", actorSeatId: requirement.actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
    : actionResult!.command;
  const memoryAfterDecision = rememberAiDecision(refreshedMemory, output, speechPlan, votePlan);
  const state = storeAiSeatMemory(applyCommand(initialState, output), memoryAfterDecision);

  return {
    state,
    aiLog: {
      gameId: state.id,
      seatNumber: requirement.actorSeatId,
      phase: requirement.phase,
      provider: speechResult?.provider ?? actionResult?.provider ?? mockActionProvider.providerId,
      prompt,
      output,
      votePlan,
      speechPlan,
      publicFactBasis: speechPlan ? buildPublicSpeechFactBasis(prompt) : undefined,
      rawOutput: speechResult?.rawOutput ?? actionResult?.rawOutput,
      isFallback: speechResult?.isFallback ?? actionResult?.isFallback ?? false,
      error: speechResult?.error ?? actionResult?.error,
      validationErrors: speechResult?.validationErrors ?? actionResult?.validationErrors,
    },
  };
}

export function createConfiguredAiOptions(): AiAdvanceOptions {
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
        reason: `${target.name} 是当前焦点，查验收益最高。`,
      };
    }
    case "NIGHT_WITCH":
      return chooseWitchAction(view, tableRead);
    case "DAY_SPEECH": {
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
      return {
        type: "vote",
        actorSeatId,
        targetSeatId: plan.target.seatId,
        reason: plan.reason,
      };
    }
    case "HUNTER_SHOT": {
      const target = chooseHunterTarget(view, tableRead);
      return {
        type: "hunterShoot",
        actorSeatId,
        targetSeatId: target?.seatId,
        reason: target ? `${target.name} 的公开疑点最高，猎人枪优先处理。` : "没有足够确定的带人目标。",
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

function buildPublicSpeechFactBasis(view: AgentView): string[] {
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

  return [
    `第${view.day}天，${view.mySeatId}号轮到白天公开发言。`,
    `本日已发言：${formatTargets(alreadySpoken)}。`,
    `本日未发言：${formatTargets(unspoken)}。`,
    deaths.length > 0 ? `公开死讯：${deaths.join("；")}。` : "公开死讯：暂无。",
    claims.length > 0 ? `公开身份声明：${claims.join("；")}。` : "公开身份声明：暂无。",
    ...recentSpeeches,
    voteLine,
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

function chooseGuardTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "guardAction");
  const targets = action.targets;
  if (targets.length === 0) return undefined;
  const bySeatId = new Map(tableRead.seats.map((seat) => [seat.seatId, seat]));
  const self = targets.find((target) => target.seatId === view.mySeatId);
  const publicSeer = targets.find((target) => bySeatId.get(target.seatId)?.publicClaims.some((claim) => claim.claimedRole === "SEER"));
  if (publicSeer && stableRoll(["guard-seer", view.day, view.mySeatId, publicSeer.seatId]) < 0.72) return publicSeer;
  if (self && stableRoll(["guard-self", view.day, view.mySeatId]) < 0.24) return self;
  return [...targets].sort((a, b) => {
    const readA = bySeatId.get(a.seatId);
    const readB = bySeatId.get(b.seatId);
    return (readB ? readB.trust - readB.suspicion * 0.15 : 0) - (readA ? readA.trust - readA.suspicion * 0.15 : 0);
  })[0];
}

function shouldRunForSheriff(view: AgentView): boolean {
  if (view.myRole === "SEER" || view.myRole === "WEREWOLF") return true;
  if (view.myRole === "WITCH" || view.myRole === "HUNTER" || view.myRole === "GUARD") {
    return stableRoll(["sheriff-run-god", view.day, view.mySeatId, view.persona?.id]) < 0.58;
  }
  return stableRoll(["sheriff-run-villager", view.day, view.mySeatId, view.persona?.id]) < 0.22;
}

function shouldWithdrawFromSheriff(view: AgentView, tableRead: AiTableRead): boolean {
  if (view.myRole === "SEER") return false;
  if (view.myRole === "WEREWOLF") {
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
    .sort((a, b) => nightKillScore(view, b) - nightKillScore(view, a) || a.seatId - b.seatId);
  return toTarget(candidates[0] ?? action.targets[0]);
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
    .sort((a, b) => seerCheckScore(view, b) - seerCheckScore(view, a) || a.seatId - b.seatId);
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
      .sort((a, b) => witchPoisonScore(b) - witchPoisonScore(a) || a.seatId - b.seatId)[0];
    const publicWolfCheck = target?.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ?? false;

    const poisonThreshold =
      (publicWolfCheck ? 64 : 82) -
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
        reason: `${target.name} 的公开疑点较高，毒药用于加速排坑。`,
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

function chooseHunterTarget(view: AgentView, tableRead: AiTableRead): ActionTarget | undefined {
  const action = getAction(view, "hunterShoot");
  const legalTargetIds = new Set(action.targets.map((target) => target.seatId));
  const target = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId))
    .sort((a, b) => hunterShotScore(b) - hunterShotScore(a) || a.seatId - b.seatId)[0];

  const publicWolfCheck = target?.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ?? false;
  const threshold = (publicWolfCheck ? 60 : 70) - (view.persona?.riskTolerance ?? 0.45) * 10;
  if (!target || target.suspicion < threshold) return undefined;
  return toTarget(target);
}

function shouldSaveVictim(view: AgentView, tableRead: AiTableRead, victim: ActionTarget): boolean {
  const victimRead = tableRead.seats.find((seat) => seat.seatId === victim.seatId);
  if (victimRead?.publicClaims.some((claim) => claim.claimedRole === "SEER")) return true;
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

function witchPoisonScore(seat: SeatRead): number {
  const publicWolfCheckBonus = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ? 14 : 0;
  const claimPenalty = seat.publicClaims.some((claim) => claim.claimedRole === "SEER" || claim.claimedRole === "WITCH") ? 8 : 0;
  return seat.suspicion - seat.trust * 0.08 + publicWolfCheckBonus - claimPenalty;
}

function hunterShotScore(seat: SeatRead): number {
  const publicWolfCheckBonus = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ? 12 : 0;
  const trustedClaimPenalty = seat.publicClaims.some((claim) => claim.claimedRole === "SEER" || claim.claimedRole === "WITCH") ? 8 : 0;
  return seat.suspicion - seat.trust * 0.1 + publicWolfCheckBonus - trustedClaimPenalty;
}

function shouldTakeDirectNightShot(view: AgentView, reason: string, targetSeatId: number): boolean {
  const bluffing = view.persona?.bluffing ?? 0.45;
  const risk = view.persona?.riskTolerance ?? 0.45;
  const basePressure = reason === "public-seer" ? 0.56 : reason === "team-threat" ? 0.64 : 0.76;
  const threshold = clampProbability(basePressure - bluffing * 0.18 - risk * 0.08 + Math.min(0.12, view.day * 0.03));
  return stableRoll(["night-shot", reason, view.day, view.mySeatId, view.persona?.id, targetSeatId]) < threshold;
}

function nightKillScore(view: AgentView, seat: SeatRead): number {
  return (
    seat.trust -
    seat.suspicion * 0.28 +
    (seat.publicClaims.some((claim) => claim.claimedRole === "SEER") ? 14 : 0) +
    stableSignedJitter(["night-kill", view.day, view.mySeatId, view.persona?.id, seat.seatId], 7)
  );
}

function seerCheckScore(view: AgentView, seat: SeatRead): number {
  return seat.suspicion - seat.trust * 0.1 + stableSignedJitter(["seer-check", view.day, view.mySeatId, view.persona?.id, seat.seatId], 6);
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
    view.myRole === "WEREWOLF" &&
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

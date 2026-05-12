import { applyCommand, applySystemStep, getTurnRequirement } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import type { ActionTarget, AgentView, AiTableRead, Command, GameState, SeatRead, VotePlan } from "@/game/types";
import { createConfiguredSpeechProvider, mockSpeechProvider } from "./speechProviders";
import { buildAiTableRead, createSpeechPlan, createVotePlan } from "./tableRead";
import type { AiActionProvider, AiDecisionLog, AiSpeechProvider } from "./types";

export const mockActionProvider: AiActionProvider = {
  providerId: "mock-action",
  createCommand: createMockCommand,
};

export async function advanceWithMockAi(
  initialState: GameState,
  options: { ignoreHuman?: boolean; maxSteps?: number; speechProvider?: AiSpeechProvider } = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  let state = initialState;
  const aiLogs: AiDecisionLog[] = [];
  const maxSteps = options.maxSteps ?? 400;
  const speechProvider = options.speechProvider ?? mockSpeechProvider;

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
    const prompt = buildAgentView(state, actorSeatId);
    const tableRead = buildAiTableRead(prompt);
    const speechPlan = state.phase === "DAY_SPEECH" ? createSpeechPlan(prompt, tableRead) : undefined;
    const votePlan = state.phase === "DAY_VOTE" ? createVotePlan(prompt, tableRead) : undefined;
    const speechResult = speechPlan ? await speechProvider.generateSpeech(prompt, speechPlan) : undefined;
    const output: Command = speechPlan
      ? { type: "speak", actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
      : createMockCommand(prompt, tableRead, votePlan);

    state = applyCommand(state, output);
    aiLogs.push({
      gameId: state.id,
      seatNumber: actorSeatId,
      phase: requirement.phase,
      provider: speechResult?.provider ?? mockActionProvider.providerId,
      prompt,
      output,
      votePlan,
      speechPlan,
      rawOutput: speechResult?.rawOutput,
      isFallback: speechResult?.isFallback ?? false,
      error: speechResult?.error,
    });
  }

  throw new Error("自动推进超过步数上限，可能存在状态机死循环。");
}

export async function advanceOneAiStep(
  initialState: GameState,
  options: { speechProvider?: AiSpeechProvider } = {},
): Promise<{ state: GameState; aiLogs: AiDecisionLog[] }> {
  const requirement = getTurnRequirement(initialState);
  const speechProvider = options.speechProvider ?? mockSpeechProvider;

  if (requirement.type === "none" || requirement.type === "human") {
    return { state: initialState, aiLogs: [] };
  }

  if (requirement.type === "system") {
    return { state: applySystemStep(initialState), aiLogs: [] };
  }

  const prompt = buildAgentView(initialState, requirement.actorSeatId);
  const tableRead = buildAiTableRead(prompt);
  const speechPlan = initialState.phase === "DAY_SPEECH" ? createSpeechPlan(prompt, tableRead) : undefined;
  const votePlan = initialState.phase === "DAY_VOTE" ? createVotePlan(prompt, tableRead) : undefined;
  const speechResult = speechPlan ? await speechProvider.generateSpeech(prompt, speechPlan) : undefined;
  const output: Command = speechPlan
    ? { type: "speak", actorSeatId: requirement.actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
    : createMockCommand(prompt, tableRead, votePlan);
  const state = applyCommand(initialState, output);

  return {
    state,
    aiLogs: [
      {
        gameId: state.id,
        seatNumber: requirement.actorSeatId,
        phase: requirement.phase,
        provider: speechResult?.provider ?? mockActionProvider.providerId,
        prompt,
        output,
        votePlan,
        speechPlan,
        rawOutput: speechResult?.rawOutput,
        isFallback: speechResult?.isFallback ?? false,
        error: speechResult?.error,
      },
    ],
  };
}

export function createConfiguredAiOptions(): { speechProvider: AiSpeechProvider } {
  return {
    speechProvider: createConfiguredSpeechProvider(),
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
        reason: `${target.name} 当前可信度较高，夜里先拆稳定发言位。`,
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
        message: speechPlan.talkingPoints.join("。"),
        reason: speechPlan.stance,
      };
    }
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
    default:
      throw new Error(`当前阶段不需要 mock 动作。`);
  }
}

function chooseWolfKillTarget(view: AgentView, tableRead: AiTableRead): ActionTarget {
  const action = getAction(view, "wolfKill");
  const legalTargetIds = new Set(action.targets.map((target) => target.seatId));
  const candidates = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId))
    .sort((a, b) => b.trust - a.trust || a.suspicion - b.suspicion || a.seatId - b.seatId);
  return toTarget(candidates[0] ?? action.targets[0]);
}

function chooseSeerTarget(view: AgentView, tableRead: AiTableRead): ActionTarget {
  const action = getAction(view, "seerCheck");
  const checked = new Set(view.privateKnowledge.seerChecks?.map((check) => check.targetSeatId) ?? []);
  const legalTargetIds = new Set(action.targets.filter((target) => !checked.has(target.seatId)).map((target) => target.seatId));
  const candidates = tableRead.seats
    .filter((seat) => legalTargetIds.has(seat.seatId))
    .sort((a, b) => b.suspicion - a.suspicion || a.trust - b.trust || a.seatId - b.seatId);
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
      .sort((a, b) => b.suspicion - a.suspicion || a.seatId - b.seatId)[0];

    if (target && target.suspicion >= 68) {
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
    .sort((a, b) => b.suspicion - a.suspicion || a.seatId - b.seatId)[0];

  if (!target || target.suspicion < 56) return undefined;
  return toTarget(target);
}

function shouldSaveVictim(view: AgentView, tableRead: AiTableRead, victim: ActionTarget): boolean {
  if (view.day === 1) return true;
  const victimRead = tableRead.seats.find((seat) => seat.seatId === victim.seatId);
  return Boolean(victimRead && victimRead.trust >= victimRead.suspicion);
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

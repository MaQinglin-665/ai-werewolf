import { applyCommand, applySystemStep, getAliveSeats, getSeat, getTurnRequirement } from "@/game/engine";
import { buildAgentView } from "@/game/projection";
import type { AgentView, Command, GameState, Phase } from "@/game/types";

export type AiDecisionLog = {
  gameId: string;
  seatNumber: number;
  phase: Phase;
  prompt: AgentView;
  output: Command;
  isFallback: boolean;
};

export function advanceWithMockAi(
  initialState: GameState,
  options: { ignoreHuman?: boolean; maxSteps?: number } = {},
): { state: GameState; aiLogs: AiDecisionLog[] } {
  let state = initialState;
  const aiLogs: AiDecisionLog[] = [];
  const maxSteps = options.maxSteps ?? 400;

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
    const output = createMockCommand(state, actorSeatId);
    state = applyCommand(state, output);
    aiLogs.push({
      gameId: state.id,
      seatNumber: actorSeatId,
      phase: requirement.phase,
      prompt,
      output,
      isFallback: false,
    });
  }

  throw new Error("自动推进超过步数上限，可能存在状态机死循环。");
}

export function createMockCommand(state: GameState, actorSeatId: number): Command {
  const actor = getSeat(state, actorSeatId);

  switch (state.phase) {
    case "NIGHT_WOLVES":
      return {
        type: "wolfKill",
        actorSeatId,
        targetSeatId: chooseWolfKillTarget(state),
      };
    case "NIGHT_SEER":
      return {
        type: "seerCheck",
        actorSeatId,
        targetSeatId: chooseSeerTarget(state, actorSeatId),
      };
    case "NIGHT_WITCH":
      return chooseWitchAction(state, actorSeatId);
    case "DAY_SPEECH":
      return {
        type: "speak",
        actorSeatId,
        message: createSpeech(state, actorSeatId),
      };
    case "DAY_VOTE":
      return {
        type: "vote",
        actorSeatId,
        targetSeatId: chooseVoteTarget(state, actorSeatId),
      };
    case "HUNTER_SHOT":
      return {
        type: "hunterShoot",
        actorSeatId,
        targetSeatId: chooseHunterTarget(state, actorSeatId),
      };
    default:
      throw new Error(`${actor.name} 当前阶段不需要 mock 动作。`);
  }
}

function chooseWolfKillTarget(state: GameState): number {
  const aliveGood = getAliveSeats(state).filter((seat) => seat.role !== "WEREWOLF");
  const priority = ["SEER", "WITCH", "HUNTER", "VILLAGER"];
  aliveGood.sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role) || a.seatId - b.seatId);
  return aliveGood[0].seatId;
}

function chooseSeerTarget(state: GameState, actorSeatId: number): number {
  const checked = new Set(
    state.seerChecks
      .filter((check) => check.seerSeatId === actorSeatId)
      .map((check) => check.targetSeatId),
  );
  const targets = getAliveSeats(state).filter((seat) => seat.seatId !== actorSeatId && !checked.has(seat.seatId));
  return (targets[0] ?? getAliveSeats(state).find((seat) => seat.seatId !== actorSeatId))!.seatId;
}

function chooseWitchAction(state: GameState, actorSeatId: number): Command {
  const victim = state.night.wolfTargetSeatId ? getSeat(state, state.night.wolfTargetSeatId) : undefined;
  if (state.witch.antidoteAvailable && victim && (state.day === 1 || victim.role === "WITCH")) {
    return { type: "witchAction", actorSeatId, mode: "save" };
  }

  if (state.witch.poisonAvailable && state.day >= 2) {
    const target = getAliveSeats(state).find((seat) => seat.seatId !== actorSeatId);
    if (target) {
      return { type: "witchAction", actorSeatId, mode: "poison", targetSeatId: target.seatId };
    }
  }

  return { type: "witchAction", actorSeatId, mode: "skip" };
}

function chooseVoteTarget(state: GameState, actorSeatId: number): number {
  const actor = getSeat(state, actorSeatId);
  const knownWolf = state.seerChecks
    .filter((check) => check.seerSeatId === actorSeatId && check.result === "WEREWOLF")
    .find((check) => getSeat(state, check.targetSeatId).alive);
  if (knownWolf) {
    return knownWolf.targetSeatId;
  }

  const targets = getAliveSeats(state).filter((seat) => seat.seatId !== actorSeatId);
  if (actor.role === "WEREWOLF") {
    return targets.find((seat) => seat.role !== "WEREWOLF")?.seatId ?? targets[0].seatId;
  }

  return targets[0].seatId;
}

function chooseHunterTarget(state: GameState, actorSeatId: number): number | undefined {
  const actor = getSeat(state, actorSeatId);
  if (actor.role !== "HUNTER") {
    return undefined;
  }

  const targets = getAliveSeats(state).filter((seat) => seat.seatId !== actorSeatId);
  return targets[0]?.seatId;
}

function createSpeech(state: GameState, actorSeatId: number): string {
  const actor = getSeat(state, actorSeatId);
  const firstTarget = getAliveSeats(state).find((seat) => seat.seatId !== actorSeatId);
  const targetName = firstTarget?.name ?? "场上玩家";

  if (actor.role === "SEER") {
    const latestCheck = [...state.seerChecks]
      .reverse()
      .find((check) => check.seerSeatId === actorSeatId);
    if (latestCheck) {
      const checked = getSeat(state, latestCheck.targetSeatId);
      return `我跳预言家，昨晚查验 ${checked.name} 是${latestCheck.result === "WEREWOLF" ? "狼人" : "好人"}。今天先围绕这个信息盘。`;
    }
    return "我偏向先听完所有人发言，暂时不急着归票。";
  }

  if (actor.role === "WEREWOLF") {
    return `我这里先不认同太快站边，${targetName} 的发言需要重点听一下，别让节奏被单点带跑。`;
  }

  if (actor.role === "WITCH") {
    return "我会重点看投票一致性，今天不希望大家只用身份压力做判断。";
  }

  if (actor.role === "HUNTER") {
    return `我有自己的底牌，不怕被抗推。现在更想听 ${targetName} 怎么解释前面的站边。`;
  }

  return `我是闭眼好人视角，先看 ${targetName} 的逻辑是否连贯，投票前我会再对比发言。`;
}

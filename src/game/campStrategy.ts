import { buildTableMemory } from "./tableMemory";
import { clampProbability, stableRoll } from "./decisionNoise";
import type { ActionTarget, GameState, Seat, WolfTeamAssignment, WolfTeamPlan, WolfTeamTask } from "./types";

const TASK_LABELS: Record<WolfTeamTask, string> = {
  COUNTERCLAIM_SEER: "悍跳预言家",
  PUSH_MISLYNCH: "冲锋归票",
  DISTANCE: "切割倒钩",
  HIDE: "隐藏视角",
};

export function buildWolfTeamPlan(state: GameState): WolfTeamPlan {
  const wolves = state.seats
    .filter((seat) => seat.role === "WEREWOLF" && seat.alive)
    .sort((a, b) => b.seatId - a.seatId);
  const memory = buildTableMemory(state);
  const wolfSeatIds = new Set(wolves.map((seat) => seat.seatId));
  const externalSeerClaim = memory.claimBoard.find(
    (claim) => claim.claimedRole === "SEER" && !wolfSeatIds.has(claim.claimant.seatId),
  );
  const wolfSeerClaim = memory.claimBoard.find(
    (claim) => claim.claimedRole === "SEER" && wolfSeatIds.has(claim.claimant.seatId),
  );
  const counterclaimSeat =
    wolfSeerClaim?.claimant ??
    (shouldAssignCounterclaim(state, wolves, Boolean(externalSeerClaim), Boolean(wolfSeerClaim)) ? pickCounterclaimWolf(wolves) : undefined);
  const primaryTarget =
    externalSeerClaim?.claimant ??
    wolfSeerClaim?.checks.find((check) => !wolfSeatIds.has(check.target.seatId))?.target ??
    memory.focus.find((focus) => !wolfSeatIds.has(focus.seat.seatId))?.seat;
  const strategy = counterclaimSeat && (externalSeerClaim || wolfSeerClaim) ? "COUNTERCLAIM" : state.day <= 2 ? "SHADOW" : "SURVIVE";

  return {
    day: state.day,
    strategy,
    summary: summarizePlan(strategy, primaryTarget, counterclaimSeat),
    primaryTarget,
    threat: externalSeerClaim?.claimant,
    counterclaimSeat,
    assignments: buildAssignments(wolves, counterclaimSeat, primaryTarget, externalSeerClaim?.claimant),
  };
}

function shouldAssignCounterclaim(
  state: GameState,
  wolves: Seat[],
  hasExternalSeerClaim: boolean,
  hasWolfSeerClaim: boolean,
): boolean {
  if (hasWolfSeerClaim) return true;
  if (wolves.length === 0) return false;

  const averageRisk = average(wolves.map((wolf) => wolf.persona?.riskTolerance ?? 0.45));
  const averageBluffing = average(wolves.map((wolf) => wolf.persona?.bluffing ?? 0.45));
  const tableHeat = state.roleClaims.length * 0.03 + state.stances.length * 0.005;
  const base = hasExternalSeerClaim ? 0.38 : 0.05;
  const threshold = clampProbability(base + averageRisk * 0.18 + averageBluffing * 0.24 + tableHeat);
  const roll = stableRoll([
    "wolf-counterclaim",
    state.day,
    state.speeches.length,
    state.roleClaims.length,
    wolves.map((wolf) => `${wolf.seatId}:${wolf.persona?.id ?? "none"}`).join(","),
  ]);

  return roll < threshold;
}

function buildAssignments(
  wolves: Seat[],
  counterclaimSeat: ActionTarget | undefined,
  primaryTarget: ActionTarget | undefined,
  threat: ActionTarget | undefined,
): WolfTeamAssignment[] {
  return wolves.map((wolf, index) => {
    const seat = toTarget(wolf);
    const task = pickTask(seat, index, counterclaimSeat, threat);
    const assignment: WolfTeamAssignment = {
      seat,
      task,
      taskLabel: TASK_LABELS[task],
      reason: taskReason(task, primaryTarget, counterclaimSeat, threat),
    };
    if (primaryTarget) assignment.target = primaryTarget;
    if (counterclaimSeat && counterclaimSeat.seatId !== seat.seatId) assignment.supportSeat = counterclaimSeat;
    return assignment;
  });
}

function pickTask(
  seat: ActionTarget,
  index: number,
  counterclaimSeat: ActionTarget | undefined,
  threat: ActionTarget | undefined,
): WolfTeamTask {
  if (counterclaimSeat?.seatId === seat.seatId) return "COUNTERCLAIM_SEER";
  if (threat && index === 1) return "PUSH_MISLYNCH";
  if (index === 2) return "DISTANCE";
  return "HIDE";
}

function pickCounterclaimWolf(wolves: Seat[]): ActionTarget | undefined {
  const sorted = [...wolves].sort(
    (a, b) =>
      (b.persona?.bluffing ?? 0.4) - (a.persona?.bluffing ?? 0.4) ||
      (b.persona?.riskTolerance ?? 0.4) - (a.persona?.riskTolerance ?? 0.4) ||
      a.seatId - b.seatId,
  );
  return sorted[0] ? toTarget(sorted[0]) : undefined;
}

function summarizePlan(
  strategy: WolfTeamPlan["strategy"],
  primaryTarget: ActionTarget | undefined,
  counterclaimSeat: ActionTarget | undefined,
): string {
  if (strategy === "COUNTERCLAIM") {
    return `${counterclaimSeat?.name ?? "一名狼人"}负责身份线，白天集中处理${primaryTarget?.name ?? "外置焦点位"}`;
  }
  if (strategy === "SHADOW") {
    return `先隐藏狼队视角，围绕${primaryTarget?.name ?? "公开焦点位"}制造分歧`;
  }
  return `优先生存，夜晚拆高可信公开身份位`;
}

function taskReason(
  task: WolfTeamTask,
  primaryTarget: ActionTarget | undefined,
  counterclaimSeat: ActionTarget | undefined,
  threat: ActionTarget | undefined,
): string {
  switch (task) {
    case "COUNTERCLAIM_SEER":
      return threat ? `对抗${threat.name}的预言家线` : "提前占住预言家身份线";
    case "PUSH_MISLYNCH":
      return `白天把票压向${primaryTarget?.name ?? "公开焦点位"}`;
    case "DISTANCE":
      return `必要时切割${counterclaimSeat?.name ?? "身份焦点位"}，避免狼队同边过重`;
    case "HIDE":
      return "保持闭眼好人口吻，减少狼队视角暴露";
  }
}

function toTarget(seat: { seatId: number; name: string }): ActionTarget {
  return {
    seatId: seat.seatId,
    name: seat.name,
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

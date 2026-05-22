import { buildTableMemory } from "./tableMemory";
import { clampProbability, stableRoll } from "./decisionNoise";
import { isWolfRole } from "./roleUtils";
import type { ActionTarget, GameState, Seat, WolfTeamAssignment, WolfNightStrategy, WolfTeamPlan, WolfTeamTask } from "./types";

const TASK_LABELS: Record<WolfTeamTask, string> = {
  COUNTERCLAIM_SEER: "悍跳预言家",
  PUSH_MISLYNCH: "冲锋归票",
  DISTANCE: "切割倒钩",
  HIDE: "隐藏视角",
};

export function buildWolfTeamPlan(state: GameState): WolfTeamPlan {
  const wolves = state.seats
    .filter((seat) => isWolfRole(seat.role, state.rules.wolfRoles) && seat.alive)
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
  const nightTarget = pickNightTarget(state, wolfSeatIds, externalSeerClaim?.claimant, memory.focus.map((focus) => focus.seat));
  const dayPressureTarget = pickDayPressureTarget(
    state,
    wolfSeatIds,
    primaryTarget,
    nightTarget,
    memory.focus.map((focus) => focus.seat),
  );
  const assignments = buildAssignments(wolves, counterclaimSeat, primaryTarget, externalSeerClaim?.claimant);
  const nightStrategyAssignments = buildAssignments(wolves, counterclaimSeat, dayPressureTarget, externalSeerClaim?.claimant);

  return {
    day: state.day,
    strategy,
    summary: summarizePlan(strategy, primaryTarget, counterclaimSeat),
    nightStrategy: buildNightStrategy(strategy, wolves, nightTarget, dayPressureTarget, nightStrategyAssignments),
    primaryTarget,
    threat: externalSeerClaim?.claimant,
    counterclaimSeat,
    assignments,
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

function pickNightTarget(
  state: GameState,
  wolfSeatIds: ReadonlySet<number>,
  publicThreat: ActionTarget | undefined,
  publicFocus: ActionTarget[],
): ActionTarget | undefined {
  const legalTargets = state.seats
    .filter((seat) => seat.alive && !wolfSeatIds.has(seat.seatId))
    .map(toTarget);
  const isLegal = (target: ActionTarget | undefined) =>
    Boolean(target && legalTargets.some((candidate) => candidate.seatId === target.seatId));

  if (state.night.wolfTargetSeatId) {
    const existingTarget = legalTargets.find((target) => target.seatId === state.night.wolfTargetSeatId);
    if (existingTarget) return existingTarget;
  }

  if (isLegal(publicThreat)) return publicThreat;

  const focusedTarget = publicFocus.find((target) => isLegal(target));
  if (focusedTarget) return focusedTarget;

  return [...legalTargets].sort((a, b) => {
    const aRoll = stableRoll(["wolf-night-target", state.id, state.day, a.seatId]);
    const bRoll = stableRoll(["wolf-night-target", state.id, state.day, b.seatId]);
    return bRoll - aRoll || a.seatId - b.seatId;
  })[0];
}

function pickDayPressureTarget(
  state: GameState,
  wolfSeatIds: ReadonlySet<number>,
  primaryTarget: ActionTarget | undefined,
  nightTarget: ActionTarget | undefined,
  publicFocus: ActionTarget[],
): ActionTarget | undefined {
  const legalTargets = state.seats
    .filter((seat) => seat.alive && !wolfSeatIds.has(seat.seatId) && seat.seatId !== nightTarget?.seatId)
    .map(toTarget);
  const isLegal = (target: ActionTarget | undefined) =>
    Boolean(target && legalTargets.some((candidate) => candidate.seatId === target.seatId));

  if (isLegal(primaryTarget)) return primaryTarget;

  const focusedTarget = publicFocus.find((target) => isLegal(target));
  if (focusedTarget) return focusedTarget;

  return [...legalTargets].sort((a, b) => {
    const aRoll = stableRoll(["wolf-day-pressure", state.id, state.day, a.seatId]);
    const bRoll = stableRoll(["wolf-day-pressure", state.id, state.day, b.seatId]);
    return bRoll - aRoll || a.seatId - b.seatId;
  })[0];
}

function buildNightStrategy(
  strategy: WolfTeamPlan["strategy"],
  wolves: Seat[],
  nightTarget: ActionTarget | undefined,
  dayPressureTarget: ActionTarget | undefined,
  assignments: WolfTeamAssignment[],
): WolfNightStrategy {
  const teamLabel = wolves.length > 1 ? "狼队首夜" : "首夜单狼";
  const nightText = nightTarget ? `今晚优先刀${nightTarget.name}` : "今晚先保留刀口判断";
  const dayText = dayPressureTarget ? `明天白天先把视线放到${dayPressureTarget.name}` : "明天白天先观察公开发言再定焦点";
  const strategyText =
    strategy === "COUNTERCLAIM" ? "身份线要接得住" : strategy === "SHADOW" ? "先压低狼队视角" : "优先生存和拆高可信位置";
  const assignmentLines = assignments.map((assignment) => {
    const targetText = assignment.target ? `，关注${assignment.target.name}` : "";
    return `${assignment.seat.name}：${assignment.taskLabel}${targetText}`;
  });

  return {
    nightTarget,
    dayPressureTarget,
    summary: `${teamLabel}：${nightText}；${dayText}，${strategyText}。`,
    discussion: [
      `${nightText}，理由只说公开可信度和发言位置。`,
      `${dayText}，不要在公开发言里提队友或夜间计划。`,
      ...assignmentLines,
    ],
  };
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

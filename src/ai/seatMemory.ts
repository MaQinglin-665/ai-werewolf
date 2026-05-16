import type {
  AiSeatBelief,
  AiSeatMemory,
  AiTableRead,
  AgentView,
  Command,
  GameState,
  SeatRead,
  SpeechPlan,
  VotePlan,
} from "@/game/types";

export function refreshAiSeatMemory(view: AgentView, tableRead: AiTableRead): AiSeatMemory {
  const previous = view.privateKnowledge.aiMemory;
  const previousBeliefs = new Map(previous?.beliefs.map((belief) => [belief.seatId, belief]) ?? []);
  const visibleSeats = tableRead.seats.filter((seat) => !seat.isSelf && !seat.isWolfTeammate);
  const beliefs = visibleSeats
    .map((seat) => buildBelief(view, previousBeliefs.get(seat.seatId), seat))
    .sort((a, b) => b.suspicion - a.suspicion || a.trust - b.trust || a.seatId - b.seatId)
    .slice(0, 8);
  const sortedBySuspicion = [...visibleSeats].sort((a, b) => b.suspicion - a.suspicion || a.seatId - b.seatId);
  const sortedByTrust = [...visibleSeats].sort((a, b) => b.trust - a.trust || a.suspicion - b.suspicion || a.seatId - b.seatId);
  const suspected = sortedBySuspicion[0];
  const trusted = sortedByTrust[0];

  return {
    seatId: view.mySeatId,
    day: view.day,
    suspectedSeatId: suspected?.seatId ?? previous?.suspectedSeatId,
    trustedSeatId: trusted?.seatId ?? previous?.trustedSeatId,
    focusSeatId: suspected?.seatId ?? previous?.focusSeatId,
    lastSpeechTargetSeatId: previous?.lastSpeechTargetSeatId,
    lastSpeechStance: previous?.lastSpeechStance,
    lastVoteTargetSeatId: previous?.lastVoteTargetSeatId,
    lastVoteReason: previous?.lastVoteReason,
    beliefs,
  };
}

export function rememberAiDecision(
  memory: AiSeatMemory,
  command: Command,
  speechPlan?: SpeechPlan,
  votePlan?: VotePlan,
): AiSeatMemory {
  const next: AiSeatMemory = {
    ...memory,
    beliefs: memory.beliefs.map((belief) => ({ ...belief, reasons: [...belief.reasons] })),
  };

  if (command.type === "speak") {
    const targetSeatId = speechPlan?.target?.seatId;
    if (targetSeatId) {
      next.lastSpeechTargetSeatId = targetSeatId;
      next.focusSeatId = targetSeatId;
      next.suspectedSeatId = targetSeatId;
    }
    next.lastSpeechStance = speechPlan?.stance;
  }

  if (command.type === "vote") {
    next.lastVoteReason = command.reason ?? votePlan?.reason;
    if (command.targetSeatId) {
      next.lastVoteTargetSeatId = command.targetSeatId;
      next.focusSeatId = command.targetSeatId;
      next.suspectedSeatId = command.targetSeatId;
    }
  }

  if (
    command.type === "seerCheck" ||
    command.type === "wolfKill" ||
    command.type === "hunterShoot" ||
    command.type === "wolfKingShoot" ||
    command.type === "whiteWolfKingExplode"
  ) {
    if (command.targetSeatId) {
      next.focusSeatId = command.targetSeatId;
    }
  }

  if (command.type === "witchAction" && command.targetSeatId) {
    next.focusSeatId = command.targetSeatId;
  }

  return next;
}

export function storeAiSeatMemory(state: GameState, memory: AiSeatMemory): GameState {
  state.aiMemories ??= {};
  state.aiMemories[String(memory.seatId)] = memory;
  return state;
}

function buildBelief(view: AgentView, previous: AiSeatBelief | undefined, seat: SeatRead): AiSeatBelief {
  const previousWeight = previous ? Math.max(0.18, 0.46 - Math.max(0, view.day - previous.updatedDay) * 0.08) : 0;
  const currentWeight = 1 - previousWeight;
  const suspicion = Math.round((previous?.suspicion ?? seat.suspicion) * previousWeight + seat.suspicion * currentWeight);
  const trust = Math.round((previous?.trust ?? seat.trust) * previousWeight + seat.trust * currentWeight);

  return {
    seatId: seat.seatId,
    suspicion: clampScore(suspicion),
    trust: clampScore(trust),
    reasons: uniqueReasons([...(seat.pressure ?? []), ...(previous?.reasons ?? [])]).slice(0, 4),
    updatedDay: view.day,
  };
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

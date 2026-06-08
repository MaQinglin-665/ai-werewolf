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
    liveIntent: previous?.liveIntent,
    liveIntentTargetSeatId: previous?.liveIntentTargetSeatId,
    liveIntentPublicReason: previous?.liveIntentPublicReason,
    liveIntentCommitment: previous?.liveIntentCommitment,
    voteContinuity: previous?.voteContinuity,
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
    const previousTargetSeatId = next.lastSpeechTargetSeatId ?? next.lastVoteTargetSeatId;
    if (targetSeatId) {
      next.lastSpeechTargetSeatId = targetSeatId;
      next.focusSeatId = targetSeatId;
      next.suspectedSeatId = targetSeatId;
    }
    next.lastSpeechStance = speechPlan?.stance;
    next.liveIntent = targetSeatId
      ? previousTargetSeatId && previousTargetSeatId !== targetSeatId
        ? "explain_pivot"
        : "push_vote"
      : "observe";
    next.liveIntentTargetSeatId = targetSeatId;
    next.liveIntentPublicReason = cleanPublicMemoryLine(speechPlan?.stance ?? firstSpeechTalkingPoint(speechPlan) ?? "保留一个公开观察点");
    next.liveIntentCommitment = targetSeatId
      ? `${targetSeatId}号这条公开发言线后续要能接到投票；改票必须解释新增公开证据。`
      : "没有固定目标时，后续投票要接公开发言、身份线或票型变化。";
    next.voteContinuity = targetSeatId
      ? `发言和投票围绕${targetSeatId}号保持同一条公开证据链。`
      : "投票要接住本轮公开观察点。";
  }

  if (command.type === "vote") {
    const previousSpeechTargetSeatId = next.lastSpeechTargetSeatId;
    next.lastVoteReason = command.reason ?? votePlan?.reason;
    if (command.targetSeatId) {
      next.lastVoteTargetSeatId = command.targetSeatId;
      next.focusSeatId = command.targetSeatId;
      next.suspectedSeatId = command.targetSeatId;
      next.liveIntent =
        previousSpeechTargetSeatId && previousSpeechTargetSeatId !== command.targetSeatId
          ? "explain_pivot"
          : "follow_vote_shape";
      next.liveIntentTargetSeatId = command.targetSeatId;
      next.liveIntentPublicReason = cleanPublicMemoryLine(command.reason ?? votePlan?.reason ?? "按公开票型和发言压力投票");
      next.liveIntentCommitment =
        previousSpeechTargetSeatId && previousSpeechTargetSeatId !== command.targetSeatId
          ? `从${previousSpeechTargetSeatId}号转到${command.targetSeatId}号，必须解释公开证据为什么升级。`
          : `继续压${command.targetSeatId}号时，要说明上一轮发言疑点没有解除。`;
      next.voteContinuity =
        previousSpeechTargetSeatId && previousSpeechTargetSeatId !== command.targetSeatId
          ? `上一轮发言点过${previousSpeechTargetSeatId}号，本轮转到${command.targetSeatId}号要给出更硬公开依据。`
          : `投票延续${command.targetSeatId}号这条公开证据链。`;
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
      next.liveIntent = "light_night_targeting";
      next.liveIntentTargetSeatId = command.targetSeatId;
      next.liveIntentPublicReason = "夜晚行动按角色收益和公开威胁轻量记录，不带入公开发言。";
      next.liveIntentCommitment = "次日公开发言只能引用已公开死讯、查验或票型，不暴露夜晚私有判断。";
      next.voteContinuity = "夜晚行动记忆只影响内部优先级，不直接变成公开台词。";
    }
  }

  if (command.type === "witchAction" && command.targetSeatId) {
    next.focusSeatId = command.targetSeatId;
    next.liveIntent = "light_night_targeting";
    next.liveIntentTargetSeatId = command.targetSeatId;
    next.liveIntentPublicReason = "女巫行动按药品收益轻量记录，不带入公开发言。";
    next.liveIntentCommitment = "次日只按公开死讯和发言解释，不暴露药品私有信息。";
    next.voteContinuity = "夜晚行动记忆只影响内部优先级，不直接变成公开台词。";
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

function firstSpeechTalkingPoint(plan: SpeechPlan | undefined): string | undefined {
  return plan?.talkingPoints?.find((point) => point.trim());
}

function cleanPublicMemoryLine(value: string | undefined): string {
  const clean = value
    ?.replace(/狼队|队友|同狼|真实身份|隐藏身份|私有|夜晚视角|底牌|提示词|系统|prompt/gi, "公开信息")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length <= 120 ? clean : `${clean.slice(0, 119)}。`;
}

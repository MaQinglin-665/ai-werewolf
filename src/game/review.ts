import { isSupportedRoleClaim } from "./claims";
import { getCamp, getSeat } from "./engine";
import { DEATH_LABELS, ROLE_LABELS } from "./labels";
import { isWolfRole } from "./roleUtils";
import { buildTableMemory } from "./tableMemory";
import type {
  DeathReason,
  GameEvent,
  GameReview,
  GameState,
  ReviewDayRound,
  ReviewDeath,
  ReviewKeyEvent,
  ReviewNightRound,
  ReviewSeat,
  ReviewTurningPoint,
  ReviewVoteImpact,
} from "./types";

export function buildGameReview(state: GameState): GameReview {
  const days = getReviewDays(state);
  const nightRounds = days.map((day) => buildNightRound(state, day)).filter(hasNightContent);
  const dayRounds = days.map((day) => buildDayRound(state, day)).filter(hasDayContent);

  return {
    roleReveal: state.seats.map((seat) => ({
      seatId: seat.seatId,
      name: seat.name,
      role: seat.role,
      roleLabel: ROLE_LABELS[seat.role],
      camp: getCamp(seat.role),
      alive: seat.alive,
      deathReason: seat.deathReason,
    })),
    claims: buildReviewClaims(state),
    stanceShifts: buildReviewStanceShifts(state),
    strategyNotes: buildStrategyNotes(state),
    voteImpacts: buildVoteImpacts(state, dayRounds),
    aiInsights: buildAiInsights(state),
    playerFeedback: buildPlayerFeedback(state),
    nightRounds,
    dayRounds,
    deathTimeline: buildDeathTimeline(state),
    keyEvents: buildKeyEvents(state),
    turningPoints: buildTurningPoints(state),
    result: state.result,
  };
}

function buildNightRound(state: GameState, day: number): ReviewNightRound {
  const events = state.events.filter((event) => event.day === day);
  const wolfEvent = events.find((event) => event.type === "NIGHT_KILL_SELECTED");
  const seerEvent = events.find((event) => event.type === "SEER_CHECKED");
  const saveEvent = events.find((event) => event.type === "WITCH_USED_ANTIDOTE");
  const poisonEvent = events.find((event) => event.type === "WITCH_USED_POISON");
  const skipEvent = events.find((event) => event.type === "WITCH_SKIPPED");
  const dayStartEvent = events.find((event) => event.type === "DAY_STARTED");

  return {
    day,
    wolfTarget: seatFromPayload(state, wolfEvent, "targetSeatId"),
    seerCheck:
      seerEvent?.actorSeatId && typeof seerEvent.payload.targetSeatId === "number"
        ? {
            seer: toReviewSeat(getSeat(state, seerEvent.actorSeatId)),
            target: toReviewSeat(getSeat(state, seerEvent.payload.targetSeatId)),
            result: seerEvent.payload.result === "WEREWOLF" ? "WEREWOLF" : "GOOD",
          }
        : undefined,
    witchAction: saveEvent
      ? { mode: "save", target: seatFromPayload(state, saveEvent, "targetSeatId") }
      : poisonEvent
        ? { mode: "poison", target: seatFromPayload(state, poisonEvent, "targetSeatId") }
        : skipEvent
          ? { mode: "skip" }
          : undefined,
    deaths: Array.isArray(dayStartEvent?.payload.deadSeatIds)
      ? dayStartEvent.payload.deadSeatIds
          .filter((seatId): seatId is number => typeof seatId === "number")
          .map((seatId) => toReviewSeat(getSeat(state, seatId)))
      : [],
  };
}

function buildDayRound(state: GameState, day: number): ReviewDayRound {
  const events = state.events.filter((event) => event.day === day);
  const tiedEvent = events.find((event) => event.type === "VOTE_TIED");

  return {
    day,
    speechCount: events.filter((event) => event.type === "SPEECH_CREATED").length,
    votes: buildReviewVotes(state, events),
    voteTally: buildReviewVoteTally(state, events.find((event) => event.type === "VOTE_REVEALED")),
    exiled: seatFromPayload(state, events.find((event) => event.type === "PLAYER_EXILED"), "seatId"),
    tiedSeatIds: Array.isArray(tiedEvent?.payload.tiedSeatIds)
      ? tiedEvent.payload.tiedSeatIds.filter((seatId): seatId is number => typeof seatId === "number")
      : [],
  };
}

function buildReviewVotes(state: GameState, events: GameEvent[]): ReviewDayRound["votes"] {
  return events
    .filter((event) => event.type === "VOTE_CAST")
    .map((event) => {
      const voterSeatId = readNumber(event, "voterSeatId") ?? event.actorSeatId;
      const targetSeatId = readNumber(event, "targetSeatId");
      if (!voterSeatId) return undefined;
      const vote: ReviewDayRound["votes"][number] = {
        voter: toReviewSeat(getSeat(state, voterSeatId)),
        ...(targetSeatId ? { target: toReviewSeat(getSeat(state, targetSeatId)) } : { abstained: true }),
      };
      return typeof event.payload.reason === "string" ? { ...vote, reason: event.payload.reason } : vote;
    })
    .filter((vote): vote is ReviewDayRound["votes"][number] => Boolean(vote));
}

function buildReviewClaims(state: GameState): GameReview["claims"] {
  const roleClaims = getSupportedRoleClaims(state);
  const counterclaimKeys = new Set(
    Object.entries(
      roleClaims.reduce<Record<string, number>>((acc, claim) => {
        acc[claim.claimedRole] = (acc[claim.claimedRole] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .filter(([, count]) => count > 1)
      .map(([role]) => role),
  );

  return roleClaims.map((claim) => {
    const claimant = getSeat(state, claim.claimantSeatId);
    const checks = claim.checks.map((check) => {
      const target = getSeat(state, check.targetSeatId);
      const actualResult: "WEREWOLF" | "GOOD" = isWolfRole(target.role, state.rules.wolfRoles) ? "WEREWOLF" : "GOOD";
      return {
        target: toReviewSeat(target),
        claimedResult: check.result,
        actualResult,
        accurate: check.result === actualResult,
      };
    });
    return {
      claimant: toReviewSeat(claimant),
      claimedRole: claim.claimedRole,
      claimedRoleLabel: ROLE_LABELS[claim.claimedRole],
      trueRole: claimant.role,
      trueRoleLabel: ROLE_LABELS[claimant.role],
      truthful: claimant.role === claim.claimedRole && checks.every((check) => check.accurate),
      isCounterclaim: counterclaimKeys.has(claim.claimedRole),
      checks,
    };
  });
}

function getSupportedRoleClaims(state: GameState): GameState["roleClaims"] {
  return (state.roleClaims ?? []).filter(isSupportedRoleClaim);
}

function buildReviewVoteTally(
  state: GameState,
  event: GameEvent | undefined,
): ReviewDayRound["voteTally"] {
  const rawTally = Array.isArray(event?.payload.tally) ? event.payload.tally : [];
  return rawTally
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const targetSeatId = "targetSeatId" in item && typeof item.targetSeatId === "number" ? item.targetSeatId : undefined;
      const count = "votes" in item && typeof item.votes === "number" ? item.votes : undefined;
      if (!targetSeatId || count === undefined) return undefined;
      return {
        target: toReviewSeat(getSeat(state, targetSeatId)),
        count,
      };
    })
    .filter((item): item is ReviewDayRound["voteTally"][number] => Boolean(item));
}

function buildTurningPoints(state: GameState): ReviewTurningPoint[] {
  const points = [
    buildFirstNightKillPoint(state),
    buildStanceShiftPoint(state),
    buildStrategyPoint(state),
    buildKeySeerCheckPoint(state),
    buildKeyVotePoint(state),
    buildGameEndPoint(state),
  ].filter((point): point is ReviewTurningPoint => Boolean(point));

  return points.slice(0, 5);
}

function buildReviewStanceShifts(state: GameState): GameReview["stanceShifts"] {
  return buildTableMemory(state).stanceShifts.map((shift) => ({
    actor: toReviewSeat(getSeat(state, shift.actor.seatId)),
    target: toReviewSeat(getSeat(state, shift.target.seatId)),
    fromKind: shift.fromKind,
    fromKindLabel: shift.fromKindLabel,
    toKind: shift.toKind,
    toKindLabel: shift.toKindLabel,
    fromDay: shift.fromDay,
    toDay: shift.toDay,
  }));
}

function buildStrategyNotes(state: GameState): GameReview["strategyNotes"] {
  return [
    ...buildWolfStrategyNotes(state),
    ...buildVoteStrategyNotes(state),
  ].slice(0, 8);
}

function buildAiInsights(state: GameState): GameReview["aiInsights"] {
  const insights: GameReview["aiInsights"] = [];

  for (const seat of state.seats.filter((item) => item.isAi)) {
    const memory = state.aiMemories?.[String(seat.seatId)];
    const beliefSummary =
      memory?.beliefs
        .slice()
        .sort((a, b) => b.suspicion - a.suspicion || a.seatId - b.seatId)
        .slice(0, 3)
        .map((belief) => {
          const target = getSeat(state, belief.seatId);
          const reason = belief.reasons[0] ? `：${belief.reasons[0]}` : "";
          return `${target.name} 疑点${belief.suspicion} / 信任${belief.trust}${reason}`;
        }) ?? [];

    if (!memory && beliefSummary.length === 0) continue;

    insights.push({
      seat: toReviewSeat(seat),
      role: seat.role,
      roleLabel: ROLE_LABELS[seat.role],
      personaLabel: seat.persona?.label,
      finalFocus: seatFromId(state, memory?.focusSeatId),
      suspected: seatFromId(state, memory?.suspectedSeatId),
      trusted: seatFromId(state, memory?.trustedSeatId),
      lastSpeechTarget: seatFromId(state, memory?.lastSpeechTargetSeatId),
      lastVoteTarget: seatFromId(state, memory?.lastVoteTargetSeatId),
      lastVoteReason: memory?.lastVoteReason,
      beliefSummary,
      impact: describeAiImpact(state, seat.seatId, memory?.lastVoteTargetSeatId, memory?.lastSpeechTargetSeatId),
    });
  }

  return insights.sort((a, b) => a.seat.seatId - b.seat.seatId).slice(0, 8);
}

function buildPlayerFeedback(state: GameState): GameReview["playerFeedback"] {
  if (state.spectatorMode) {
    return state.result
      ? [
          {
            title: "AI 观战局结束",
            tone: "neutral",
            description: `本局没有真人座位，所有行动由 AI 完成。${state.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜，原因是${state.result.reason}。`,
            relatedSeats: [],
          },
        ]
      : [];
  }
  const human = getSeat(state, state.humanSeatId);
  const humanCamp = getCamp(human.role);
  const feedback: GameReview["playerFeedback"] = [];
  const resultWon = state.result?.winner === humanCamp;
  const humanSpeeches = state.speeches.filter((speech) => speech.seatId === human.seatId);
  const humanVotes = state.events
    .filter((event) => event.type === "VOTE_CAST" && (event.actorSeatId === human.seatId || readNumber(event, "voterSeatId") === human.seatId))
    .map((event) => {
      const targetSeatId = readNumber(event, "targetSeatId");
      return targetSeatId ? { day: event.day, target: getSeat(state, targetSeatId), reason: event.payload.reason } : undefined;
    })
    .filter((vote): vote is { day: number; target: ReturnType<typeof getSeat>; reason: unknown } => Boolean(vote));
  const death = state.events.find((event) => event.type === "PLAYER_DIED" && readNumber(event, "seatId") === human.seatId);

  if (state.result) {
    feedback.push({
      title: resultWon ? "你的阵营获胜" : "你的阵营落败",
      tone: resultWon ? "positive" : "warning",
      description: `${human.name} 的真实身份是${ROLE_LABELS[human.role]}。本局${state.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜，原因是${state.result.reason}。`,
      relatedSeats: [toReviewSeat(human)],
    });
  }

  if (humanSpeeches.length > 0) {
    feedback.push({
      title: "发言影响",
      tone: "neutral",
      description: `你本局公开发言 ${humanSpeeches.length} 次。这些发言会影响 AI 的公开记忆和后续站边。`,
      relatedSeats: [toReviewSeat(human)],
      day: humanSpeeches.at(-1)?.day,
    });
  }

  const lastVote = humanVotes.at(-1);
  if (lastVote) {
    const targetCamp = getCamp(lastVote.target.role);
    const voteHelped =
      isWolfRole(human.role, state.rules.wolfRoles)
        ? targetCamp === "GOOD"
        : isWolfRole(lastVote.target.role, state.rules.wolfRoles);
    feedback.push({
      title: voteHelped ? "最后投票有效" : "最后投票偏离",
      tone: voteHelped ? "positive" : "warning",
      description: `你最后一票投向 ${lastVote.target.name}，终局身份是${ROLE_LABELS[lastVote.target.role]}。${
        voteHelped ? "这票方向符合你的阵营目标。" : "这票方向给了对方阵营空间。"
      }`,
      day: lastVote.day,
      relatedSeats: [toReviewSeat(human), toReviewSeat(lastVote.target)],
    });
  } else {
    feedback.push({
      title: "投票参与",
      tone: "neutral",
      description: "你没有留下公开投票记录，终局复盘中主要从发言和身份线观察你的影响。",
      relatedSeats: [toReviewSeat(human)],
    });
  }

  if (human.role === "SEER" && state.seerChecks.some((check) => check.seerSeatId === human.seatId)) {
    const checks = state.seerChecks.filter((check) => check.seerSeatId === human.seatId);
    const wolfChecks = checks.filter((check) => check.result === "WEREWOLF").length;
    feedback.push({
      title: "查验收益",
      tone: wolfChecks > 0 ? "positive" : "neutral",
      description: `你完成 ${checks.length} 次查验，其中 ${wolfChecks} 次查到狼人。查验结果是好人阵营最稳定的信息源。`,
      relatedSeats: checks.map((check) => toReviewSeat(getSeat(state, check.targetSeatId))),
      day: checks.at(-1)?.day,
    });
  }

  if (death) {
    const reason = readDeathReason(death.payload.deathReason);
    feedback.push({
      title: "出局节点",
      tone: "warning",
      description: `你在 D${death.day} 出局${reason ? `，原因是${DEATH_LABELS[reason]}` : ""}。这个节点之后，你的公开信息只能通过此前发言和投票继续影响局势。`,
      day: death.day,
      relatedSeats: [toReviewSeat(human)],
    });
  } else if (state.result) {
    feedback.push({
      title: "存活到终局",
      tone: "positive",
      description: "你活到了终局，说明你的身份暴露、发言压力或夜晚威胁没有成为对方优先处理目标。",
      relatedSeats: [toReviewSeat(human)],
    });
  }

  return feedback.slice(0, 5);
}

function buildWolfStrategyNotes(state: GameState): GameReview["strategyNotes"] {
  const notes: GameReview["strategyNotes"] = [];
  const wolfIds = new Set(
    state.seats.filter((seat) => isWolfRole(seat.role, state.rules.wolfRoles)).map((seat) => seat.seatId),
  );

  const wolfSupport = (state.stances ?? []).find((stance) => {
    const actor = getSeat(state, stance.actorSeatId);
    return isWolfRole(actor.role, state.rules.wolfRoles) && stance.kind === "SUPPORT" && wolfIds.has(stance.targetSeatId);
  });
  if (wolfSupport) {
    const actor = getSeat(state, wolfSupport.actorSeatId);
    const target = getSeat(state, wolfSupport.targetSeatId);
    notes.push({
      day: wolfSupport.day,
      camp: "WEREWOLVES",
      title: "狼队冲锋",
      description: `${actor.name}公开支持${target.name}，帮助狼队身份线集中火力。`,
      seats: [toReviewSeat(actor), toReviewSeat(target)],
    });
  }

  const wolfDistance = (state.stances ?? []).find((stance) => {
    const actor = getSeat(state, stance.actorSeatId);
    return (
      isWolfRole(actor.role, state.rules.wolfRoles) &&
      (stance.kind === "QUESTION" || stance.kind === "PRESSURE") &&
      wolfIds.has(stance.targetSeatId)
    );
  });
  if (wolfDistance) {
    const actor = getSeat(state, wolfDistance.actorSeatId);
    const target = getSeat(state, wolfDistance.targetSeatId);
    notes.push({
      day: wolfDistance.day,
      camp: "WEREWOLVES",
      title: "狼队切割",
      description: `${actor.name}公开压到${target.name}，降低同阵营站边过重的风险。`,
      seats: [toReviewSeat(actor), toReviewSeat(target)],
    });
  }

  return notes;
}

function buildVoteStrategyNotes(state: GameState): GameReview["strategyNotes"] {
  return buildGameReviewVoteGroups(state).flatMap((group) => {
    if (group.count < 2) return [];
    const target = getSeat(state, group.targetSeatId);
    const voters = group.voterSeatIds.map((seatId) => getSeat(state, seatId));
    const goodVoters = voters.filter((seat) => getCamp(seat.role) === "GOOD");
    const wolfVoters = voters.filter((seat) => isWolfRole(seat.role, state.rules.wolfRoles));
    const notes: GameReview["strategyNotes"] = [];

    if (goodVoters.length >= 2) {
      notes.push({
        day: group.day,
        camp: "GOOD",
        title: "好人归票",
        description: `${goodVoters.map((seat) => seat.name).join("、")}把票集中到${target.name}，形成好人主线。`,
        seats: [toReviewSeat(target), ...goodVoters.map(toReviewSeat)],
      });
    }

    if (wolfVoters.length >= 2) {
      notes.push({
        day: group.day,
        camp: "WEREWOLVES",
        title: "狼队冲票",
        description: `${wolfVoters.map((seat) => seat.name).join("、")}集中投向${target.name}，尝试推动白天出局。`,
        seats: [toReviewSeat(target), ...wolfVoters.map(toReviewSeat)],
      });
    }

    return notes;
  });
}

function buildVoteImpacts(state: GameState, dayRounds: ReviewDayRound[]): ReviewVoteImpact[] {
  return dayRounds
    .filter((round) => round.votes.length > 0 || round.voteTally.length > 0 || round.exiled || round.tiedSeatIds.length > 0)
    .map((round) => {
      const exiledSeat = round.exiled ? getSeat(state, round.exiled.seatId) : undefined;
      const topCount = round.voteTally.reduce((max, item) => Math.max(max, item.count), 0);
      const leaders = round.voteTally
        .filter((item) => item.count === topCount && item.count > 0)
        .map((item) => {
          const target = getSeat(state, item.target.seatId);
          return {
            target: toReviewSeat(target),
            count: item.count,
            role: target.role,
            roleLabel: ROLE_LABELS[target.role],
            camp: getCamp(target.role),
          };
        });
      const decisiveTargetIds = new Set(
        exiledSeat
          ? [exiledSeat.seatId]
          : round.tiedSeatIds.length > 0
            ? round.tiedSeatIds
            : leaders.map((leader) => leader.target.seatId),
      );
      const decisiveVotes = round.votes.filter((vote) => vote.target && decisiveTargetIds.has(vote.target.seatId));
      const decisiveSeats = decisiveVotes.map((vote) => getSeat(state, vote.voter.seatId));
      const goodVotes = decisiveSeats.filter((seat) => getCamp(seat.role) === "GOOD").length;
      const wolfVotes = decisiveSeats.filter((seat) => isWolfRole(seat.role, state.rules.wolfRoles)).length;
      const abstainCount = round.votes.filter((vote) => vote.abstained).length;
      const outcome = exiledSeat ? "exile" : round.tiedSeatIds.length > 0 ? "tie" : "no_exile";

      return {
        day: round.day,
        title: buildVoteImpactTitle(exiledSeat, outcome),
        description: buildVoteImpactDescription(round, exiledSeat, leaders, goodVotes, wolfVotes, abstainCount),
        outcome,
        ...(exiledSeat
          ? {
              target: toReviewSeat(exiledSeat),
              targetRole: exiledSeat.role,
              targetRoleLabel: ROLE_LABELS[exiledSeat.role],
              targetCamp: getCamp(exiledSeat.role),
            }
          : {}),
        leaders,
        decisiveVoters: decisiveSeats.map(toReviewSeat),
        goodVotes,
        wolfVotes,
        abstainCount,
        totalVotes: round.votes.length,
      };
    });
}

function buildVoteImpactTitle(seat: ReturnType<typeof getSeat> | undefined, outcome: ReviewVoteImpact["outcome"]): string {
  if (outcome === "tie") return "平票延后节奏";
  if (!seat) return "票型未形成放逐";
  return isWolfRole(seat.role) ? "票型放逐狼人" : "票型推出好人";
}

function buildVoteImpactDescription(
  round: ReviewDayRound,
  exiledSeat: ReturnType<typeof getSeat> | undefined,
  leaders: ReviewVoteImpact["leaders"],
  goodVotes: number,
  wolfVotes: number,
  abstainCount: number,
): string {
  if (exiledSeat) {
    const campLine =
      isWolfRole(exiledSeat.role)
        ? "这轮票型给好人阵营带来直接收益。"
        : "这轮票型给狼人阵营留下了推进空间。";
    const leader = leaders.find((item) => item.target.seatId === exiledSeat.seatId);
    const countLine = leader ? `${exiledSeat.name}以${leader.count}票出局` : `${exiledSeat.name}被放逐`;
    return `${countLine}，终局身份是${ROLE_LABELS[exiledSeat.role]}。关键票中好人${goodVotes}票、狼人${wolfVotes}票${
      abstainCount > 0 ? `，另有${abstainCount}票弃票` : ""
    }。${campLine}`;
  }

  if (round.tiedSeatIds.length > 0) {
    const tiedNames = round.tiedSeatIds.map((seatId) => `${seatId}号`).join("、");
    return `本轮${tiedNames}平票，无人出局。票型没有立刻改写人数结构，但会把压力带到下一轮发言和夜晚选择。`;
  }

  return `本轮没有形成有效放逐。${leaders.length > 0 ? `最高票集中在${leaders.map((leader) => leader.target.name).join("、")}。` : ""}`;
}

function buildFirstNightKillPoint(state: GameState): ReviewTurningPoint | undefined {
  const event = state.events.find((item) => item.type === "NIGHT_KILL_SELECTED" && item.day === 1);
  const target = seatFromPayload(state, event, "targetSeatId");
  if (!event || !target) return undefined;

  return {
    day: event.day,
    title: "首夜刀口",
    description: `狼人首夜选择 ${target.name}，这决定了第一天公开信息的起点。`,
    eventSeq: event.seq,
  };
}

function buildStanceShiftPoint(state: GameState): ReviewTurningPoint | undefined {
  const shift = buildTableMemory(state).stanceShifts.at(-1);
  if (!shift) return undefined;

  return {
    day: shift.toDay,
    title: "站边变化",
    description: `${shift.actor.name}从${shift.fromKindLabel}${shift.target.name}改成${shift.toKindLabel}${shift.target.name}，这个改口会影响后续票型判断。`,
  };
}

function buildStrategyPoint(state: GameState): ReviewTurningPoint | undefined {
  const note = buildStrategyNotes(state)[0];
  if (!note) return undefined;

  return {
    day: note.day,
    title: note.title,
    description: note.description,
  };
}

function buildKeySeerCheckPoint(state: GameState): ReviewTurningPoint | undefined {
  const event =
    state.events.find((item) => item.type === "SEER_CHECKED" && item.payload.result === "WEREWOLF") ??
    state.events.find((item) => item.type === "SEER_CHECKED");
  const target = seatFromPayload(state, event, "targetSeatId");
  if (!event || !target) return undefined;

  const result = event.payload.result === "WEREWOLF" ? "狼人" : "好人";
  return {
    day: event.day,
    title: "关键查验",
    description: `预言家查验 ${target.name} 为${result}，后续发言和投票都会受这个信息影响。`,
    eventSeq: event.seq,
  };
}

function buildKeyVotePoint(state: GameState): ReviewTurningPoint | undefined {
  const exileEvent = [...state.events].reverse().find((event) => event.type === "PLAYER_EXILED");
  const tiedEvent = [...state.events].reverse().find((event) => event.type === "VOTE_TIED");
  const event = exileEvent ?? tiedEvent;
  if (!event) return undefined;

  if (event.type === "PLAYER_EXILED") {
    const exiled = seatFromPayload(state, event, "seatId");
    if (!exiled) return undefined;
    return {
      day: event.day,
      title: "关键投票",
      description: `${exiled.name} 被放逐，这是白天票型最直接的转折点。`,
      eventSeq: event.seq,
    };
  }

  const tiedSeatIds = Array.isArray(event.payload.tiedSeatIds)
    ? event.payload.tiedSeatIds.filter((seatId): seatId is number => typeof seatId === "number")
    : [];
  return {
    day: event.day,
    title: "关键平票",
    description: `本轮 ${tiedSeatIds.join("、")}号平票，无人出局，节奏被迫延后。`,
    eventSeq: event.seq,
  };
}

function buildGameEndPoint(state: GameState): ReviewTurningPoint | undefined {
  const event = [...state.events].reverse().find((item) => item.type === "GAME_ENDED");
  if (!event || !state.result) return undefined;

  return {
    day: event.day,
    title: "胜负原因",
    description: `${state.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：${state.result.reason}`,
    eventSeq: event.seq,
  };
}

function buildDeathTimeline(state: GameState): ReviewDeath[] {
  return state.events
    .filter((event) => event.type === "PLAYER_DIED")
    .map((event) => {
      const seatId = readNumber(event, "seatId");
      const reason = readDeathReason(event.payload.deathReason);
      if (!seatId || !reason) return undefined;
      return {
        day: event.day,
        seat: toReviewSeat(getSeat(state, seatId)),
        reason,
        reasonLabel: DEATH_LABELS[reason],
      };
    })
    .filter((death): death is ReviewDeath => Boolean(death));
}

function buildKeyEvents(state: GameState): ReviewKeyEvent[] {
  const keyTypes = new Set([
    "STANCE_DECLARED",
    "DAY_STARTED",
    "VOTE_REVEALED",
    "PLAYER_EXILED",
    "IDIOT_REVEALED",
    "VOTE_TIED",
    "HUNTER_REVEALED",
    "HUNTER_SHOT",
    "HUNTER_SKIPPED",
    "WOLF_KING_SHOT",
    "WOLF_KING_SKIPPED",
    "WHITE_WOLF_KING_EXPLODED",
    "WOLF_BEAUTY_CHARM_TRIGGERED",
    "KNIGHT_DUEL_SUCCESS",
    "KNIGHT_DUEL_FAILED",
    "KNIGHT_DUEL_SKIPPED",
    "GAME_ENDED",
  ]);
  return state.events
    .filter((event) => event.visibility === "public" && keyTypes.has(event.type))
    .map((event) => ({
      seq: event.seq,
      day: event.day,
      phase: event.phase,
      message: event.message,
    }));
}

function buildGameReviewVoteGroups(state: GameState): Array<{ day: number; targetSeatId: number; voterSeatIds: number[]; count: number }> {
  const groups = new Map<string, { day: number; targetSeatId: number; voterSeatIds: number[]; count: number }>();

  for (const event of state.events.filter((item) => item.type === "VOTE_CAST")) {
    const voterSeatId = readNumber(event, "voterSeatId") ?? event.actorSeatId;
    const targetSeatId = readNumber(event, "targetSeatId");
    if (!voterSeatId || !targetSeatId) continue;
    const key = `${event.day}:${targetSeatId}`;
    const group = groups.get(key) ?? { day: event.day, targetSeatId, voterSeatIds: [], count: 0 };
    group.voterSeatIds.push(voterSeatId);
    group.count += 1;
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.count - a.count || a.day - b.day);
}

function getReviewDays(state: GameState): number[] {
  return Array.from(new Set(state.events.map((event) => event.day))).sort((a, b) => a - b);
}

function hasNightContent(round: ReviewNightRound): boolean {
  return Boolean(round.wolfTarget || round.seerCheck || round.witchAction || round.deaths.length > 0);
}

function hasDayContent(round: ReviewDayRound): boolean {
  return (
    round.speechCount > 0 ||
    round.votes.length > 0 ||
    round.voteTally.length > 0 ||
    Boolean(round.exiled) ||
    round.tiedSeatIds.length > 0
  );
}

function describeAiImpact(
  state: GameState,
  seatId: number,
  lastVoteTargetSeatId: number | undefined,
  lastSpeechTargetSeatId: number | undefined,
): string {
  const seat = getSeat(state, seatId);
  const voteTarget = lastVoteTargetSeatId ? getSeat(state, lastVoteTargetSeatId) : undefined;
  const speechTarget = lastSpeechTargetSeatId ? getSeat(state, lastSpeechTargetSeatId) : undefined;

  if (voteTarget) {
    if (isWolfRole(seat.role, state.rules.wolfRoles) && !isWolfRole(voteTarget.role, state.rules.wolfRoles)) {
      return `最后投向${voteTarget.name}，尝试把白天压力推向好人位。`;
    }
    if (isWolfRole(seat.role, state.rules.wolfRoles) && isWolfRole(voteTarget.role, state.rules.wolfRoles)) {
      return `最后投向狼同伴${voteTarget.name}，属于切割或倒钩方向。`;
    }
    if (!isWolfRole(seat.role, state.rules.wolfRoles) && isWolfRole(voteTarget.role, state.rules.wolfRoles)) {
      return `最后投向${voteTarget.name}并命中狼人，判断方向有效。`;
    }
    return `最后投向${voteTarget.name}，但终局看该目标并不是狼人。`;
  }

  if (speechTarget) {
    return `发言持续围绕${speechTarget.name}展开，影响了桌面对该位置的关注。`;
  }

  return "没有留下明确的最终投票焦点，主要通过发言和站边参与局势。";
}

function seatFromId(state: GameState, seatId: number | undefined): ReviewSeat | undefined {
  return seatId ? toReviewSeat(getSeat(state, seatId)) : undefined;
}

function seatFromPayload(state: GameState, event: GameEvent | undefined, key: string): ReviewSeat | undefined {
  const seatId = event ? readNumber(event, key) : undefined;
  return seatId ? toReviewSeat(getSeat(state, seatId)) : undefined;
}

function readNumber(event: GameEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function readDeathReason(value: unknown): DeathReason | undefined {
  return value === "WOLF_KILL" ||
    value === "WITCH_POISON" ||
    value === "EXILED" ||
    value === "HUNTER_SHOT" ||
    value === "WOLF_KING_SHOT" ||
    value === "WHITE_WOLF_KING_EXPLODE" ||
    value === "WHITE_WOLF_KING_SHOT" ||
    value === "WOLF_BEAUTY_CHARM" ||
    value === "KNIGHT_DUEL" ||
    value === "KNIGHT_DUEL_FAILED"
    ? value
    : undefined;
}

function toReviewSeat(seat: { seatId: number; name: string }): ReviewSeat {
  return {
    seatId: seat.seatId,
    name: seat.name,
  };
}

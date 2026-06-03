import { ROLE_LABELS } from "./labels";
import { isSupportedRoleClaim } from "./claims";
import { stanceKindLabel } from "./stances";
import type {
  ActionTarget,
  ClaimBoardItem,
  GameEvent,
  GameState,
  PublicStance,
  Role,
  SeatMemory,
  StanceBoardItem,
  StanceShiftItem,
  TableMemory,
} from "./types";

export function buildTableMemory(state: GameState): TableMemory {
  const claimBoard = buildClaimBoard(state);
  const stanceBoard = buildStanceBoard(state);
  const stanceShifts = buildStanceShifts(stanceBoard);
  const counterclaims = buildCounterclaims(claimBoard);
  const voteHistory = buildVoteHistory(state);
  const seerLegacies = buildSeerLegacies(state, claimBoard, stanceBoard, voteHistory);
  const speechInfluence = buildSpeechInfluence(stanceBoard);
  const deathShapeCues = buildDeathShapeCues(state);
  const deathAnnouncements = state.events
    .filter(
      (event) =>
        event.type === "DAY_STARTED" ||
        event.type === "PLAYER_EXILED" ||
        event.type === "IDIOT_REVEALED" ||
        event.type === "HUNTER_REVEALED" ||
        event.type === "HUNTER_SHOT" ||
        event.type === "WOLF_KING_SHOT" ||
        event.type === "WHITE_WOLF_KING_EXPLODED" ||
        event.type === "WOLF_BEAUTY_CHARM_TRIGGERED" ||
        event.type === "KNIGHT_DUEL_SUCCESS" ||
        event.type === "KNIGHT_DUEL_FAILED",
    )
    .slice(-8)
    .map((event) => event.message);
  const seats = buildSeatMemories(state, claimBoard, stanceBoard);
  const focus = buildFocus(seats, counterclaims, stanceShifts, voteHistory.at(-1));
  const reasoningCues = buildReasoningCues(
    counterclaims,
    stanceShifts,
    seerLegacies,
    voteHistory.at(-1),
    speechInfluence,
    deathShapeCues,
  );

  return {
    day: state.day,
    claimBoard,
    stanceBoard,
    stanceShifts,
    seerLegacies,
    speechInfluence,
    reasoningCues,
    counterclaims,
    focus,
    seats,
    voteHistory,
    deathAnnouncements,
    publicSignals: buildPublicSignals(
      counterclaims,
      stanceShifts,
      seerLegacies,
      speechInfluence,
      voteHistory.at(-1),
      deathAnnouncements.at(-1),
      deathShapeCues,
    ),
  };
}

export function buildClaimBoard(state: GameState): ClaimBoardItem[] {
  const items: ClaimBoardItem[] = [];

  for (const claim of (state.roleClaims ?? []).filter(isStrongIdentityClaim)) {
    const claimant = getTarget(state, claim.claimantSeatId);
    if (!claimant) continue;
    const checks = claim.checks
      .map((check) => {
        const target = getTarget(state, check.targetSeatId);
        return target
          ? {
              day: check.day,
              target,
              result: check.result,
            }
          : undefined;
      })
      .filter((check): check is ClaimBoardItem["checks"][number] => Boolean(check));
    const item: ClaimBoardItem = {
      claimId: claim.id,
      claimant,
      claimedRole: claim.claimedRole,
      claimedRoleLabel: ROLE_LABELS[claim.claimedRole],
      strength: claim.strength,
      checks,
      summary: summarizeClaim(claim.claimedRole, checks),
      lastUpdatedDay: claim.checks.at(-1)?.day ?? claim.day,
    };
    if (claim.sourceSpeechSeq !== undefined) {
      item.sourceSpeechSeq = claim.sourceSpeechSeq;
    }
    items.push(item);
  }

  return items.sort((a, b) => a.claimant.seatId - b.claimant.seatId || roleSort(a.claimedRole) - roleSort(b.claimedRole));
}

function isStrongIdentityClaim(claim: GameState["roleClaims"][number]): boolean {
  return claim.strength === "hard" && isSupportedRoleClaim(claim);
}

function buildCounterclaims(claimBoard: ClaimBoardItem[]): TableMemory["counterclaims"] {
  const byRole = new Map<Role, ClaimBoardItem[]>();
  for (const claim of claimBoard) {
    byRole.set(claim.claimedRole, [...(byRole.get(claim.claimedRole) ?? []), claim]);
  }

  return [...byRole.entries()]
    .filter(([, claims]) => claims.length > 1)
    .map(([claimedRole, claims]) => ({
      claimedRole,
      claimedRoleLabel: ROLE_LABELS[claimedRole],
      claimants: claims.map((claim) => claim.claimant),
    }));
}

function buildStanceBoard(state: GameState): StanceBoardItem[] {
  const items: StanceBoardItem[] = [];

  for (const stance of state.stances ?? []) {
    const actor = getTarget(state, stance.actorSeatId);
    const target = getTarget(state, stance.targetSeatId);
    if (!actor || !target) continue;
    const item: StanceBoardItem = {
      stanceId: stance.id,
      day: stance.day,
      actor,
      target,
      kind: stance.kind,
      kindLabel: stanceKindLabel(stance.kind),
      summary: summarizeStance(stance, target),
    };
    if (stance.targetRole) {
      item.targetRole = stance.targetRole;
      item.targetRoleLabel = ROLE_LABELS[stance.targetRole];
    }
    if (stance.sourceSpeechSeq !== undefined) {
      item.sourceSpeechSeq = stance.sourceSpeechSeq;
    }
    items.push(item);
  }

  return items.sort((a, b) => a.day - b.day || (a.sourceSpeechSeq ?? 0) - (b.sourceSpeechSeq ?? 0));
}

function buildStanceShifts(stanceBoard: StanceBoardItem[]): StanceShiftItem[] {
  const byActorTarget = new Map<string, StanceBoardItem[]>();
  for (const stance of stanceBoard) {
    const key = `${stance.actor.seatId}:${stance.target.seatId}:${stance.targetRole ?? "ANY"}`;
    byActorTarget.set(key, [...(byActorTarget.get(key) ?? []), stance]);
  }

  const shifts: StanceShiftItem[] = [];
  const shiftKeys = new Set<string>();
  const pushShift = (previous: StanceBoardItem, current: StanceBoardItem) => {
    const key = [
      previous.actor.seatId,
      previous.target.seatId,
      current.target.seatId,
      previous.kind,
      current.kind,
      previous.day,
      current.day,
      previous.sourceSpeechSeq ?? "NA",
      current.sourceSpeechSeq ?? "NA",
    ].join(":");
    if (shiftKeys.has(key)) return;
    shiftKeys.add(key);
    shifts.push({
      actor: previous.actor,
      target: current.target,
      fromTarget: previous.target,
      toTarget: current.target,
      fromKind: previous.kind,
      fromKindLabel: previous.kindLabel,
      toKind: current.kind,
      toKindLabel: current.kindLabel,
      fromDay: previous.day,
      toDay: current.day,
      summary:
        previous.target.seatId === current.target.seatId
          ? `${previous.actor.name}从${previous.kindLabel}${previous.target.name}改为${current.kindLabel}${current.target.name}`
          : `${previous.actor.name}从${previous.kindLabel}${previous.target.name}转向${current.kindLabel}${current.target.name}`,
    });
  };

  for (const stances of byActorTarget.values()) {
    const sorted = [...stances].sort((a, b) => a.day - b.day || (a.sourceSpeechSeq ?? 0) - (b.sourceSpeechSeq ?? 0));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (!previous || !current || previous.kind === current.kind) continue;
      if (!isLaterStance(previous, current)) continue;
      if (isMeaningfulShift(previous.kind, current.kind)) {
        pushShift(previous, current);
      }
    }
  }

  const byActorRole = new Map<string, StanceBoardItem[]>();
  for (const stance of stanceBoard) {
    if (!stance.targetRole) continue;
    const key = `${stance.actor.seatId}:${stance.targetRole}`;
    byActorRole.set(key, [...(byActorRole.get(key) ?? []), stance]);
  }

  for (const stances of byActorRole.values()) {
    const sorted = [...stances].sort((a, b) => a.day - b.day || (a.sourceSpeechSeq ?? 0) - (b.sourceSpeechSeq ?? 0));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (!previous || !current) continue;
      if (isRoleSideShift(previous, current)) {
        pushShift(previous, current);
      }
    }
  }

  return shifts
    .sort((a, b) => a.toDay - b.toDay || (a.toTarget?.seatId ?? a.target.seatId) - (b.toTarget?.seatId ?? b.target.seatId))
    .slice(-8);
}

function buildSeatMemories(state: GameState, claimBoard: ClaimBoardItem[], stanceBoard: StanceBoardItem[]): SeatMemory[] {
  return state.seats.map((seat) => {
    const speeches = state.speeches.filter((speech) => speech.seatId === seat.seatId);
    const lastSpeech = speeches.at(-1);
    const lastSpeechEvent = [...state.events]
      .reverse()
      .find(
        (event) =>
          (event.type === "SPEECH_CREATED" || event.type === "LAST_WORDS_CREATED") &&
          (readNumber(event, "seatId") ?? event.actorSeatId) === seat.seatId,
      );
    const claims = claimBoard.filter((claim) => claim.claimant.seatId === seat.seatId);
    const stancesGiven = stanceBoard.filter((stance) => stance.actor.seatId === seat.seatId);
    const stancedBy = stanceBoard.filter((stance) => stance.target.seatId === seat.seatId);
    const claimedByChecks = claimBoard.flatMap((claim) =>
      claim.checks
        .filter((check) => check.target.seatId === seat.seatId)
        .map((check) => ({
          claimant: claim.claimant,
          result: check.result,
          day: check.day,
        })),
    );
    const shortSpeechCount = speeches.filter((speech) => speech.message.length < 42).length;
    const evasiveSpeechCount = speeches.filter((speech) => /不急|先听|过一轮|不站死|不好说|看后面/.test(speech.message))
      .length;
    const publicReasons = [
      ...claims.map((claim) => `声称${claim.claimedRoleLabel}`),
      ...stancesGiven.slice(-2).map((stance) => `${stance.kindLabel}${stance.target.name}`),
      ...stancedBy.slice(-2).map((stance) => `被${stance.actor.name}${stance.kindLabel}`),
      ...claimedByChecks.map((check) => `被${check.claimant.name}报${check.result === "WEREWOLF" ? "查杀" : "金水"}`),
      ...(shortSpeechCount > 0 ? ["发言偏短"] : []),
      ...(evasiveSpeechCount > 0 ? ["回避站边"] : []),
    ];

    return {
      seatId: seat.seatId,
      name: seat.name,
      alive: seat.alive,
      speechCount: speeches.length,
      shortSpeechCount,
      evasiveSpeechCount,
      lastSpeech: lastSpeech?.message,
      lastSpeechDay: lastSpeech?.day,
      lastSpeechSeq: lastSpeechEvent?.seq,
      claims,
      stancesGiven,
      stancedBy,
      claimedByChecks,
      publicReasons,
    };
  });
}

function buildVoteHistory(state: GameState): TableMemory["voteHistory"] {
  return state.events
    .filter((event) => event.type === "VOTE_REVEALED")
    .map((event) => {
      const tally = readTallyItems(state, event);
      const topCount = tally[0]?.count ?? 0;
      const exiled = state.events.find((item) => item.day === event.day && item.type === "PLAYER_EXILED");
      const tied = state.events.find((item) => item.day === event.day && item.type === "VOTE_TIED");
      return {
        day: event.day,
        tally,
        leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
        exiled: getTarget(state, readNumber(exiled, "seatId")),
        tiedSeatIds: Array.isArray(tied?.payload.tiedSeatIds)
          ? tied.payload.tiedSeatIds.filter((seatId): seatId is number => typeof seatId === "number")
          : [],
      };
    });
}

function buildSeerLegacies(
  state: GameState,
  claimBoard: ClaimBoardItem[],
  stanceBoard: StanceBoardItem[],
  voteHistory: TableMemory["voteHistory"],
): TableMemory["seerLegacies"] {
  const seerClaims = claimBoard.filter((claim) => claim.claimedRole === "SEER");

  return seerClaims
    .map<TableMemory["seerLegacies"][number] | undefined>((claim) => {
      const death = findPublicSeerDeath(state, claim.claimant.seatId);
      if (!death || death.day < claim.lastUpdatedDay) return undefined;

      const stancesGiven = stanceBoard.filter((stance) => stance.actor.seatId === claim.claimant.seatId).slice(-5);
      const lastVote = findLastRevealedVoteBySeat(state, voteHistory, claim.claimant.seatId);
      const deathText = death.kind === "exile" ? "出局" : "夜死";
      const details = [
        claim.checks.length > 0
          ? claim.checks
              .map((check) => `${check.target.name}${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
              .join("、")
          : undefined,
        stancesGiven.at(-1)?.summary,
        lastVote?.target ? `最后投${lastVote.target.name}` : lastVote?.abstained ? "最后弃票" : undefined,
      ].filter((detail): detail is string => Boolean(detail));

      return {
        claimant: claim.claimant,
        deathDay: death.day,
        deathKind: death.kind,
        checks: claim.checks,
        stancesGiven,
        ...(lastVote ? { lastVote } : {}),
        summary: `第${death.day}天${deathText}预言家声明遗留：${claim.claimant.name}${details.length > 0 ? `留下${details.join("；")}` : "没有明确查验或投票遗留"}`,
      };
    })
    .filter((legacy): legacy is TableMemory["seerLegacies"][number] => Boolean(legacy))
    .sort((a, b) => b.deathDay - a.deathDay || a.claimant.seatId - b.claimant.seatId)
    .slice(0, 4);
}

function buildSpeechInfluence(stanceBoard: StanceBoardItem[]): TableMemory["speechInfluence"] {
  const bySourceTarget = new Map<string, StanceBoardItem>();
  for (const stance of stanceBoard) {
    const direction = stanceInfluenceDirection(stance.kind);
    if (!stance.sourceSpeechSeq || !direction) continue;
    const key = `${stance.sourceSpeechSeq}:${stance.target.seatId}:${direction}`;
    if (!bySourceTarget.has(key)) {
      bySourceTarget.set(key, stance);
    }
  }

  return [...bySourceTarget.values()]
    .map((stance) => {
      const direction = stanceInfluenceDirection(stance.kind);
      if (!stance.sourceSpeechSeq || !direction) return undefined;
      const followupActors = uniqueTargets(
        stanceBoard
          .filter(
            (item) =>
              item.day === stance.day &&
              item.sourceSpeechSeq !== undefined &&
              item.sourceSpeechSeq > stance.sourceSpeechSeq! &&
              item.actor.seatId !== stance.actor.seatId &&
              item.target.seatId === stance.target.seatId &&
              stanceInfluenceDirection(item.kind) === direction,
          )
          .map((item) => item.actor),
      );
      if (followupActors.length === 0) return undefined;

      const actionText = direction === "pressure" ? "压力" : "支持";
      return {
        sourceSpeechSeq: stance.sourceSpeechSeq,
        day: stance.day,
        speaker: stance.actor,
        target: stance.target,
        direction,
        summary: `${stance.actor.name}对${stance.target.name}的${actionText}被${followupActors.length}名后续发言者接住`,
        followupActors,
        followupCount: followupActors.length,
      };
    })
    .filter((item): item is TableMemory["speechInfluence"][number] => Boolean(item))
    .sort((a, b) => b.followupCount - a.followupCount || b.sourceSpeechSeq - a.sourceSpeechSeq)
    .slice(0, 6);
}

function buildReasoningCues(
  counterclaims: TableMemory["counterclaims"],
  stanceShifts: StanceShiftItem[],
  seerLegacies: TableMemory["seerLegacies"],
  latestVote: TableMemory["voteHistory"][number] | undefined,
  speechInfluence: TableMemory["speechInfluence"],
  deathShapeCues: TableMemory["reasoningCues"],
): TableMemory["reasoningCues"] {
  const cues: TableMemory["reasoningCues"] = [
    ...deathShapeCues,
    ...counterclaims.map((group) => ({
      cueId: `counterclaim:${group.claimedRole}:${group.claimants.map((seat) => seat.seatId).join("-")}`,
      day: 0,
      kind: "counterclaim" as const,
      weight: "strong" as const,
      summary: `${group.claimedRoleLabel}对跳：${group.claimants.map((seat) => seat.name).join("、")}`,
      evidence: group.claimants.map((seat) => `${seat.name}公开声称${group.claimedRoleLabel}`),
    })),
    ...seerLegacies.map((legacy) => ({
      cueId: `seer-legacy:${legacy.claimant.seatId}:${legacy.deathDay}`,
      day: legacy.deathDay,
      kind: "seer_legacy" as const,
      weight: "strong" as const,
      summary: legacy.summary,
      actor: legacy.claimant,
      evidence: [
        ...legacy.checks.map((check) => `${legacy.claimant.name}曾报${check.target.name}${check.result === "WEREWOLF" ? "查杀" : "金水"}`),
        ...legacy.stancesGiven.slice(-2).map((stance) => stance.summary),
        legacy.lastVote?.target ? `${legacy.claimant.name}最后投给${legacy.lastVote.target.name}` : undefined,
      ].filter((item): item is string => Boolean(item)),
    })),
    ...speechInfluence.map((item) => ({
      cueId: `speech-influence:${item.sourceSpeechSeq}:${item.target.seatId}:${item.direction}`,
      day: item.day,
      kind: "speech_influence" as const,
      weight: item.followupCount >= 2 ? ("strong" as const) : ("medium" as const),
      summary: item.summary,
      actor: item.speaker,
      target: item.target,
      evidence: item.followupActors.map((actor) => `${actor.name}后续继续${item.direction === "pressure" ? "施压" : "支持"}${item.target.name}`),
    })),
    ...stanceShifts.slice(-4).map((shift) => ({
      cueId: `stance-shift:${shift.actor.seatId}:${shift.fromTarget?.seatId ?? shift.target.seatId}:${shift.toTarget?.seatId ?? shift.target.seatId}:${shift.fromDay}:${shift.toDay}`,
      day: shift.toDay,
      kind: "stance_shift" as const,
      weight: "medium" as const,
      summary: shift.summary,
      actor: shift.actor,
      target: shift.toTarget ?? shift.target,
      evidence: [
        `D${shift.fromDay}${shift.fromKindLabel}${shift.fromTarget?.name ?? shift.target.name}`,
        `D${shift.toDay}改为${shift.toKindLabel}${shift.toTarget?.name ?? shift.target.name}`,
      ],
    })),
    ...(latestVote
      ? [
          {
            cueId: `vote:${latestVote.day}`,
            day: latestVote.day,
            kind: "vote" as const,
            weight: latestVote.tiedSeatIds.length > 0 || latestVote.exiled ? ("strong" as const) : ("medium" as const),
            summary:
              latestVote.tiedSeatIds.length > 0
                ? `D${latestVote.day}最高票平票：${latestVote.tiedSeatIds.map((seatId) => `${seatId}号`).join("、")}`
                : latestVote.exiled
                  ? `D${latestVote.day}${latestVote.exiled.name}被放逐`
                  : `D${latestVote.day}公开票型焦点：${latestVote.leaders.map((seat) => seat.name).join("、")}`,
            target: latestVote.exiled ?? latestVote.leaders[0],
            evidence: latestVote.tally.map((item) => `${item.target.name}${item.count}票`),
          },
        ]
      : []),
  ];

  return cues.sort((a, b) => cueWeightScore(b.weight) - cueWeightScore(a.weight) || b.day - a.day).slice(0, 8);
}

function buildDeathShapeCues(state: GameState): TableMemory["reasoningCues"] {
  if (state.rules.hasGuard || !state.rules.godRoles.includes("WITCH")) return [];

  const cues: TableMemory["reasoningCues"] = [];
  for (const event of state.events.filter((item) => item.type === "DAY_STARTED")) {
    const deadSeatIds = readDeadSeatIds(event);
    if (event.day === 1 && deadSeatIds.length === 0) {
      cues.push({
        cueId: `death-shape:${event.day}:peaceful`,
        day: event.day,
        kind: "death_shape",
        weight: "medium",
        summary: "首夜平安夜：无守卫女巫局发言里可简称女巫用药了；空刀不作为发言主线，不需要让后置位重复解释平安夜本身，且不能确认女巫身份、具体救人目标或刀口。",
        evidence: [event.message, "本局无守卫且有女巫，死亡形态本身是公开信息。"],
      });
      continue;
    }

    if (event.day === 1 && deadSeatIds.length === 1) {
      const deadTarget = getTarget(state, deadSeatIds[0]);
      cues.push({
        cueId: `death-shape:${event.day}:single:${deadSeatIds[0]}`,
        day: event.day,
        kind: "death_shape",
        weight: "medium",
        summary: `首夜单死${deadTarget ? `（${deadTarget.name}）` : ""}：无守卫女巫局里，狼必刀且女巫夜里救、毒、跳过三选一，“女巫没救/没用解药/没用药”可以作为公开规则推理；若讨论毒药重合刀口，要说明这是反面解释，不能伪装成私密女巫视角。`,
        ...(deadTarget ? { target: deadTarget } : {}),
        evidence: [event.message, "本局无守卫且有女巫，死亡形态本身是公开信息。"],
      });
      continue;
    }

    if (event.day === 1 && deadSeatIds.length >= 2) {
      cues.push({
        cueId: `death-shape:${event.day}:multi:${deadSeatIds.join("-")}`,
        day: event.day,
        kind: "death_shape",
        weight: "light",
        summary: `首夜多死：${deadSeatIds.map((seatId) => `${seatId}号`).join("、")}倒牌是公开死亡形态，只能作为药线假设，不能逐一确认死因。`,
        evidence: [event.message, "公开播报只给死亡名单，不给狼刀、毒药或其他死因。"],
      });
    }
  }

  return cues.slice(-3);
}

function buildFocus(
  seats: SeatMemory[],
  counterclaims: TableMemory["counterclaims"],
  stanceShifts: StanceShiftItem[],
  latestVote: TableMemory["voteHistory"][number] | undefined,
): TableMemory["focus"] {
  const counterclaimSeatIds = new Set(counterclaims.flatMap((group) => group.claimants.map((claimant) => claimant.seatId)));
  const voteCounts = new Map(latestVote?.tally.map((item) => [item.target.seatId, item.count]) ?? []);
  const shiftedActors = new Set(stanceShifts.map((shift) => shift.actor.seatId));

  return seats
    .filter((seat) => seat.alive)
    .map((seat) => {
      let score = 0;
      const reasons: string[] = [];
      for (const check of seat.claimedByChecks) {
        if (check.result === "WEREWOLF") {
          score += 24;
          reasons.push(`${check.claimant.name}公开报查杀`);
        } else {
          score -= 8;
          reasons.push(`${check.claimant.name}公开报金水`);
        }
      }
      if (counterclaimSeatIds.has(seat.seatId)) {
        score += 18;
        reasons.push("处在身份对跳关系");
      }
      for (const stance of seat.stancedBy.slice(-5)) {
        if (stance.kind === "QUESTION") {
          score += 7;
          reasons.push(`被${stance.actor.name}质疑`);
        }
        if (stance.kind === "PRESSURE") {
          score += 9;
          reasons.push(`被${stance.actor.name}施压`);
        }
        if (stance.kind === "SUPPORT") {
          score -= 4;
          reasons.push(`被${stance.actor.name}支持`);
        }
      }
      if (shiftedActors.has(seat.seatId)) {
        score += 12;
        reasons.push("站边前后变化");
      }
      if (seat.shortSpeechCount > 0) {
        score += Math.min(12, seat.shortSpeechCount * 4);
        reasons.push("发言偏短");
      }
      if (seat.evasiveSpeechCount > 0) {
        score += Math.min(10, seat.evasiveSpeechCount * 5);
        reasons.push("回避站边");
      }
      const votes = voteCounts.get(seat.seatId) ?? 0;
      if (votes > 0) {
        score += votes * 7;
        reasons.push(`上一轮公开吃到${votes}票`);
      }
      return {
        seat: { seatId: seat.seatId, name: seat.name },
        reasons: [...new Set(reasons)].slice(0, 3),
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.seat.seatId - b.seat.seatId)
    .slice(0, 4);
}

function buildPublicSignals(
  counterclaims: TableMemory["counterclaims"],
  stanceShifts: StanceShiftItem[],
  seerLegacies: TableMemory["seerLegacies"],
  speechInfluence: TableMemory["speechInfluence"],
  latestVote: TableMemory["voteHistory"][number] | undefined,
  latestDeath?: string,
  deathShapeCues: TableMemory["reasoningCues"] = [],
): string[] {
  const signals = [
    ...counterclaims.map((group) => `${group.claimedRoleLabel}对跳：${group.claimants.map((seat) => seat.name).join("、")}`),
    ...stanceShifts.slice(-2).map((shift) => `站边变化：${shift.summary}`),
    ...seerLegacies.slice(0, 2).map((legacy) => legacy.summary),
    ...speechInfluence.slice(0, 2).map((item) => item.summary),
    ...deathShapeCues.slice(0, 2).map((cue) => cue.summary),
    latestVote?.leaders.length ? `公开票型焦点：${latestVote.leaders.map((seat) => seat.name).join("、")}` : undefined,
    latestDeath,
  ];
  return signals.filter((signal): signal is string => Boolean(signal)).slice(0, 5);
}

function stanceInfluenceDirection(kind: StanceBoardItem["kind"]): TableMemory["speechInfluence"][number]["direction"] | undefined {
  if (kind === "QUESTION" || kind === "PRESSURE") return "pressure";
  if (kind === "SUPPORT" || kind === "FOLLOW") return "support";
  return undefined;
}

function uniqueTargets(targets: ActionTarget[]): ActionTarget[] {
  const seen = new Set<number>();
  const unique: ActionTarget[] = [];
  for (const target of targets) {
    if (seen.has(target.seatId)) continue;
    seen.add(target.seatId);
    unique.push(target);
  }
  return unique;
}

function cueWeightScore(weight: TableMemory["reasoningCues"][number]["weight"]): number {
  if (weight === "strong") return 3;
  if (weight === "medium") return 2;
  return 1;
}

function summarizeStance(stance: PublicStance, target: ActionTarget): string {
  const targetRole = stance.targetRole ? ROLE_LABELS[stance.targetRole] : "";
  const roleText = targetRole ? `的${targetRole}` : "";
  return `${stanceKindLabel(stance.kind)}${target.name}${roleText}`;
}

function isMeaningfulShift(fromKind: StanceBoardItem["kind"], toKind: StanceBoardItem["kind"]): boolean {
  const positive = new Set(["SUPPORT", "FOLLOW"]);
  const negative = new Set(["QUESTION", "PRESSURE"]);
  return (positive.has(fromKind) && negative.has(toKind)) || (negative.has(fromKind) && positive.has(toKind));
}

function isRoleSideShift(previous: StanceBoardItem, current: StanceBoardItem): boolean {
  if (!previous.targetRole || previous.targetRole !== current.targetRole) return false;
  if (previous.target.seatId === current.target.seatId) return false;
  if (!isLaterStance(previous, current)) return false;

  const positive = new Set(["SUPPORT", "FOLLOW"]);
  const negative = new Set(["QUESTION", "PRESSURE"]);
  if (positive.has(previous.kind) && positive.has(current.kind)) return true;
  return isMeaningfulShift(previous.kind, current.kind) && (positive.has(previous.kind) || positive.has(current.kind) || negative.has(current.kind));
}

function isLaterStance(previous: StanceBoardItem, current: StanceBoardItem): boolean {
  if (current.day > previous.day) return true;
  if (current.day < previous.day) return false;
  if (previous.sourceSpeechSeq === undefined || current.sourceSpeechSeq === undefined) return true;
  return current.sourceSpeechSeq > previous.sourceSpeechSeq;
}

function readTallyItems(state: GameState, event: GameEvent): TableMemory["voteHistory"][number]["tally"] {
  const rawTally = Array.isArray(event.payload.tally) ? event.payload.tally : [];
  return rawTally
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const targetSeatId = "targetSeatId" in item && typeof item.targetSeatId === "number" ? item.targetSeatId : undefined;
      const count = "votes" in item && typeof item.votes === "number" ? item.votes : undefined;
      const target = getTarget(state, targetSeatId);
      return target && count !== undefined ? { target, count } : undefined;
    })
    .filter((item): item is TableMemory["voteHistory"][number]["tally"][number] => Boolean(item))
    .sort((a, b) => b.count - a.count || a.target.seatId - b.target.seatId);
}

function findPublicSeerDeath(state: GameState, seatId: number): { day: number; kind: "night" | "exile" } | undefined {
  const deathEvent = state.events.find((event) => {
    if (event.type === "DAY_STARTED") {
      const deadSeatIds = readDeadSeatIds(event);
      return deadSeatIds.includes(seatId);
    }
    if (event.type === "PLAYER_EXILED") {
      return (readNumber(event, "seatId") ?? event.actorSeatId) === seatId;
    }
    return false;
  });
  if (!deathEvent) return undefined;
  return { day: deathEvent.day, kind: deathEvent.type === "PLAYER_EXILED" ? "exile" : "night" };
}

function readDeadSeatIds(event: GameEvent): number[] {
  return Array.isArray(event.payload.deadSeatIds)
    ? event.payload.deadSeatIds.filter((id): id is number => typeof id === "number")
    : [];
}

function findLastRevealedVoteBySeat(
  state: GameState,
  voteHistory: TableMemory["voteHistory"],
  seatId: number,
): NonNullable<TableMemory["seerLegacies"][number]["lastVote"]> | undefined {
  const revealedDays = new Set(voteHistory.map((vote) => vote.day));
  const voteEvent = [...state.events]
    .reverse()
    .find(
      (event) =>
        event.type === "VOTE_CAST" &&
        revealedDays.has(event.day) &&
        (readNumber(event, "voterSeatId") ?? event.actorSeatId) === seatId,
    );
  if (!voteEvent) return undefined;

  const targetSeatId = readNumber(voteEvent, "targetSeatId");
  const target = getTarget(state, targetSeatId);
  const abstained = voteEvent.payload.abstained === true || !target;
  const reason = readString(voteEvent, "reason");
  return {
    day: voteEvent.day,
    ...(target ? { target } : { abstained }),
    ...(reason ? { reason } : {}),
  };
}

function summarizeClaim(role: Role, checks: ClaimBoardItem["checks"]): string {
  if (checks.length === 0) return `声称${ROLE_LABELS[role]}`;
  return `声称${ROLE_LABELS[role]}，${checks
    .map((check) => `D${check.day}报${check.target.name}${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
    .join("、")}`;
}

function roleSort(role: Role): number {
  const order: Role[] = ["SEER", "WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD", "VILLAGER", "WHITE_WOLF_KING", "WOLF_BEAUTY", "WOLF_KING", "WEREWOLF"];
  return order.indexOf(role);
}

function getTarget(state: GameState, seatId: number | undefined): ActionTarget | undefined {
  const seat = state.seats.find((item) => item.seatId === seatId);
  return seat ? { seatId: seat.seatId, name: seat.name } : undefined;
}

function readNumber(event: GameEvent | undefined, key: string): number | undefined {
  const value = event?.payload[key];
  return typeof value === "number" ? value : undefined;
}

function readString(event: GameEvent | undefined, key: string): string | undefined {
  const value = event?.payload[key];
  return typeof value === "string" ? value : undefined;
}

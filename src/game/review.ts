import { getCamp, getSeat } from "./engine";
import { DEATH_LABELS, ROLE_LABELS } from "./labels";
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
} from "./types";

export function buildGameReview(state: GameState): GameReview {
  const days = getReviewDays(state);

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
    nightRounds: days.map((day) => buildNightRound(state, day)).filter(hasNightContent),
    dayRounds: days.map((day) => buildDayRound(state, day)).filter(hasDayContent),
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
    votes: events
      .filter((event) => event.type === "VOTE_CAST")
      .map((event) => {
        const voterSeatId = readNumber(event, "voterSeatId") ?? event.actorSeatId;
        const targetSeatId = readNumber(event, "targetSeatId");
        if (!voterSeatId || !targetSeatId) return undefined;
        const reason = readString(event, "reason");
        return {
          voter: toReviewSeat(getSeat(state, voterSeatId)),
          target: toReviewSeat(getSeat(state, targetSeatId)),
          ...(reason ? { reason } : {}),
        };
      })
      .filter((vote): vote is NonNullable<typeof vote> => Boolean(vote)),
    exiled: seatFromPayload(state, events.find((event) => event.type === "PLAYER_EXILED"), "seatId"),
    tiedSeatIds: Array.isArray(tiedEvent?.payload.tiedSeatIds)
      ? tiedEvent.payload.tiedSeatIds.filter((seatId): seatId is number => typeof seatId === "number")
      : [],
  };
}

function buildTurningPoints(state: GameState): ReviewTurningPoint[] {
  const points = [
    buildFirstNightKillPoint(state),
    buildKeySeerCheckPoint(state),
    buildKeyVotePoint(state),
    buildGameEndPoint(state),
  ].filter((point): point is ReviewTurningPoint => Boolean(point));

  return points.slice(0, 4);
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
      description: `${exiled.name} 被放逐，是白天票型最直接的转折点。`,
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
    "DAY_STARTED",
    "PLAYER_EXILED",
    "VOTE_TIED",
    "HUNTER_SHOT",
    "HUNTER_SKIPPED",
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

function getReviewDays(state: GameState): number[] {
  return Array.from(new Set(state.events.map((event) => event.day))).sort((a, b) => a - b);
}

function hasNightContent(round: ReviewNightRound): boolean {
  return Boolean(round.wolfTarget || round.seerCheck || round.witchAction || round.deaths.length > 0);
}

function hasDayContent(round: ReviewDayRound): boolean {
  return round.speechCount > 0 || round.votes.length > 0 || Boolean(round.exiled) || round.tiedSeatIds.length > 0;
}

function seatFromPayload(state: GameState, event: GameEvent | undefined, key: string): ReviewSeat | undefined {
  const seatId = event ? readNumber(event, key) : undefined;
  return seatId ? toReviewSeat(getSeat(state, seatId)) : undefined;
}

function readNumber(event: GameEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function readString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function readDeathReason(value: unknown): DeathReason | undefined {
  return value === "WOLF_KILL" || value === "WITCH_POISON" || value === "EXILED" || value === "HUNTER_SHOT"
    ? value
    : undefined;
}

function toReviewSeat(seat: { seatId: number; name: string }): ReviewSeat {
  return {
    seatId: seat.seatId,
    name: seat.name,
  };
}

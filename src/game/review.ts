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
        return {
          voter: toReviewSeat(getSeat(state, voterSeatId)),
          target: toReviewSeat(getSeat(state, targetSeatId)),
        };
      })
      .filter((vote): vote is NonNullable<typeof vote> => Boolean(vote)),
    exiled: seatFromPayload(state, events.find((event) => event.type === "PLAYER_EXILED"), "seatId"),
    tiedSeatIds: Array.isArray(tiedEvent?.payload.tiedSeatIds)
      ? tiedEvent.payload.tiedSeatIds.filter((seatId): seatId is number => typeof seatId === "number")
      : [],
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

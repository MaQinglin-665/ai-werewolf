import { getAliveSeats, getCurrentSpeakerSeatId, getSeat, getTurnRequirement } from "./engine";
import { PHASE_LABELS, ROLE_LABELS } from "./labels";
import { buildGameReview } from "./review";
import type {
  ActionTarget,
  AgentView,
  AvailableHumanAction,
  GameEvent,
  GameState,
  HumanGameView,
} from "./types";

export function buildHumanView(state: GameState): HumanGameView {
  const human = getSeat(state, state.humanSeatId);
  const requirement = getTurnRequirement(state);
  const gameOver = Boolean(state.result);

  return {
    id: state.id,
    day: state.day,
    phase: state.phase,
    phaseLabel: PHASE_LABELS[state.phase],
    humanSeatId: state.humanSeatId,
    myRole: human.role,
    myRoleLabel: ROLE_LABELS[human.role],
    seats: state.seats.map((seat) => {
      const canSeeRole =
        gameOver ||
        seat.seatId === human.seatId ||
        (human.role === "WEREWOLF" && seat.role === "WEREWOLF");
      return {
        seatId: seat.seatId,
        name: seat.name,
        isAi: seat.isAi,
        isHuman: seat.seatId === human.seatId,
        alive: seat.alive,
        role: canSeeRole ? seat.role : undefined,
        roleLabel: canSeeRole ? ROLE_LABELS[seat.role] : undefined,
        deathReason: gameOver ? seat.deathReason : undefined,
      };
    }),
    publicEvents: state.events.filter(isPublicEvent).map(toEventView),
    privateEvents: state.events
      .filter((event) => event.visibility === "private" && event.actorSeatId === human.seatId)
      .map(toEventView),
    availableActions:
      requirement.type === "human" && requirement.actorSeatId === human.seatId
        ? getAvailableActionsForSeat(state, human.seatId)
        : [],
    currentActorSeatId: requirement.type === "human" || requirement.type === "ai" ? requirement.actorSeatId : undefined,
    currentSpeakerSeatId: getCurrentSpeakerSeatId(state),
    wolfTeammates:
      human.role === "WEREWOLF"
        ? state.seats
            .filter((seat) => seat.role === "WEREWOLF" && seat.seatId !== human.seatId)
            .map(toTarget)
        : [],
    seerChecks: state.seerChecks.filter((check) => check.seerSeatId === human.seatId),
    witch: state.witch,
    votes: state.votes,
    result: state.result,
    review: gameOver ? buildGameReview(state) : undefined,
  };
}

export function buildAgentView(state: GameState, seatId: number): AgentView {
  const seat = getSeat(state, seatId);
  return {
    gameId: state.id,
    day: state.day,
    phase: state.phase,
    mySeatId: seatId,
    myRole: seat.role,
    persona: seat.persona,
    aliveSeats: getAliveSeats(state).map(toTarget),
    publicEvents: state.events.filter(isPublicEvent).map(toEventView),
    publicSummary: buildPublicSummary(state),
    privateKnowledge: {
      wolfTeammates:
        seat.role === "WEREWOLF"
          ? state.seats
              .filter((item) => item.role === "WEREWOLF" && item.seatId !== seatId)
              .map(toTarget)
          : undefined,
      seerChecks:
        seat.role === "SEER" ? state.seerChecks.filter((check) => check.seerSeatId === seatId) : undefined,
      witch:
        seat.role === "WITCH"
          ? {
              ...state.witch,
              currentVictim: state.night.wolfTargetSeatId
                ? toTarget(getSeat(state, state.night.wolfTargetSeatId))
                : undefined,
            }
          : undefined,
      pendingHunterShot: state.pendingHunterShot?.shooterSeatId === seatId ? state.pendingHunterShot : undefined,
    },
    allowedActions: getAvailableActionsForSeat(state, seatId),
  };
}

function buildPublicSummary(state: GameState): AgentView["publicSummary"] {
  return {
    recentSpeeches: state.events
      .filter((event) => event.type === "SPEECH_CREATED")
      .slice(-6)
      .map((event) => event.message),
    recentVotes: state.events
      .filter((event) => event.type === "VOTE_CAST")
      .slice(-8)
      .map((event) => event.message),
    recentDeaths: state.events
      .filter((event) => event.type === "DAY_STARTED" || event.type === "PLAYER_EXILED" || event.type === "HUNTER_SHOT")
      .slice(-6)
      .map((event) => event.message),
  };
}

export function getAvailableActionsForSeat(state: GameState, seatId: number): AvailableHumanAction[] {
  const seat = getSeat(state, seatId);
  if (!seat.alive && state.phase !== "HUNTER_SHOT") {
    return [];
  }

  switch (state.phase) {
    case "NIGHT_WOLVES":
      if (seat.role !== "WEREWOLF") return [];
      return [
        {
          type: "wolfKill",
          targets: getAliveSeats(state)
            .filter((target) => target.role !== "WEREWOLF")
            .map(toTarget),
        },
      ];
    case "NIGHT_SEER":
      if (seat.role !== "SEER") return [];
      return [
        {
          type: "seerCheck",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
        },
      ];
    case "NIGHT_WITCH":
      if (seat.role !== "WITCH") return [];
      return [
        {
          type: "witchAction",
          canSave: state.witch.antidoteAvailable && Boolean(state.night.wolfTargetSeatId),
          saveTarget: state.night.wolfTargetSeatId
            ? toTarget(getSeat(state, state.night.wolfTargetSeatId))
            : undefined,
          canPoison: state.witch.poisonAvailable,
          poisonTargets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
        },
      ];
    case "DAY_SPEECH":
      return getCurrentSpeakerSeatId(state) === seatId ? [{ type: "speak" }] : [];
    case "DAY_VOTE":
      if (state.votes[String(seatId)]) return [];
      return [
        {
          type: "vote",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
        },
      ];
    case "HUNTER_SHOT":
      if (state.pendingHunterShot?.shooterSeatId !== seatId) return [];
      return [
        {
          type: "hunterShoot",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
          canSkip: true,
        },
      ];
    default:
      return [];
  }
}

function isPublicEvent(event: GameEvent): boolean {
  return event.visibility === "public";
}

function toEventView(event: GameEvent): Pick<GameEvent, "seq" | "day" | "phase" | "actorSeatId" | "message"> {
  return {
    seq: event.seq,
    day: event.day,
    phase: event.phase,
    actorSeatId: event.actorSeatId,
    message: event.message,
  };
}

function toTarget(seat: { seatId: number; name: string }): ActionTarget {
  return {
    seatId: seat.seatId,
    name: seat.name,
  };
}

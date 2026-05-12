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
  Phase,
  PublicSpeechItem,
  PublicVoteItem,
  PublicVoteSnapshot,
} from "./types";

export function buildHumanView(state: GameState): HumanGameView {
  const human = getSeat(state, state.humanSeatId);
  const requirement = getTurnRequirement(state);
  const gameOver = Boolean(state.result);

  const publicSummary = buildPublicSummary(state);

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
    tableSummary: {
      recentSpeeches: publicSummary.recentSpeeches,
      voteSnapshot: publicSummary.voteSnapshot,
      aiReasonHighlights: publicSummary.recentVotes
        .filter((vote) => Boolean(vote.reason))
        .slice(-5)
        .map((vote) => `${vote.voter.name}：${vote.reason}`),
      phaseSteps: buildPhaseSteps(state.phase),
    },
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
  const recentSpeeches = buildRecentSpeeches(state);
  const recentVotes = buildRecentVotes(state);
  const recentDeaths = state.events
    .filter((event) => event.type === "DAY_STARTED" || event.type === "PLAYER_EXILED" || event.type === "HUNTER_SHOT")
    .slice(-6)
    .map((event) => event.message);

  return {
    recentSpeeches,
    recentVotes,
    voteSnapshot: buildVoteSnapshot(state, recentVotes),
    recentDeaths,
    deathSummary: recentDeaths,
  };
}

function buildRecentSpeeches(state: GameState): PublicSpeechItem[] {
  return state.events
    .filter((event) => event.type === "SPEECH_CREATED")
    .slice(-6)
    .map((event) => {
      const speakerSeatId = readNumber(event.payload, "seatId") ?? event.actorSeatId;
      const speaker = speakerSeatId ? toTarget(getSeat(state, speakerSeatId)) : undefined;
      return {
        seq: event.seq,
        day: event.day,
        speaker,
        message: readString(event.payload, "message") ?? event.message,
      };
    });
}

function buildRecentVotes(state: GameState): PublicVoteItem[] {
  return state.events
    .filter((event) => event.type === "VOTE_CAST")
    .slice(-12)
    .map((event): PublicVoteItem | undefined => {
      const voterSeatId = readNumber(event.payload, "voterSeatId") ?? event.actorSeatId;
      const targetSeatId = readNumber(event.payload, "targetSeatId");
      if (!voterSeatId || !targetSeatId) return undefined;
      const reason = readString(event.payload, "reason");
      return {
        seq: event.seq,
        day: event.day,
        voter: toTarget(getSeat(state, voterSeatId)),
        target: toTarget(getSeat(state, targetSeatId)),
        ...(reason ? { reason } : {}),
      };
    })
    .filter((vote): vote is PublicVoteItem => Boolean(vote));
}

function buildVoteSnapshot(state: GameState, recentVotes: PublicVoteItem[]): PublicVoteSnapshot {
  const currentVotes: PublicVoteItem[] = Object.entries(state.votes).map(([voterSeatId, targetSeatId]) => {
    const matchingEvent = [...state.events].reverse().find((event) => {
      return (
        event.type === "VOTE_CAST" &&
        event.day === state.day &&
        readNumber(event.payload, "voterSeatId") === Number(voterSeatId) &&
        readNumber(event.payload, "targetSeatId") === targetSeatId
      );
    });
    const reason = matchingEvent ? readString(matchingEvent.payload, "reason") : undefined;
    return {
      seq: matchingEvent?.seq ?? 0,
      day: state.day,
      voter: toTarget(getSeat(state, Number(voterSeatId))),
      target: toTarget(getSeat(state, targetSeatId)),
      ...(reason ? { reason } : {}),
    };
  });

  const votes = currentVotes.length > 0 ? currentVotes : latestVoteRound(recentVotes);
  const counts = new Map<number, { target: ActionTarget; count: number }>();
  for (const vote of votes) {
    const current = counts.get(vote.target.seatId) ?? { target: vote.target, count: 0 };
    current.count += 1;
    counts.set(vote.target.seatId, current);
  }

  const tally = [...counts.values()].sort((a, b) => b.count - a.count || a.target.seatId - b.target.seatId);
  const topCount = tally[0]?.count ?? 0;

  return {
    votes,
    tally,
    leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
  };
}

function latestVoteRound(votes: PublicVoteItem[]): PublicVoteItem[] {
  const latestDay = votes.at(-1)?.day;
  return latestDay ? votes.filter((vote) => vote.day === latestDay) : [];
}

function buildPhaseSteps(phase: Phase): HumanGameView["tableSummary"]["phaseSteps"] {
  const steps: Array<{ key: Phase; label: string; phases: Phase[] }> = [
    { key: "NIGHT_WOLVES", label: "夜晚", phases: ["NIGHT_WOLVES", "NIGHT_SEER", "NIGHT_WITCH"] },
    { key: "DAY_SPEECH", label: "发言", phases: ["DAY_ANNOUNCEMENT", "DAY_SPEECH"] },
    { key: "DAY_VOTE", label: "投票", phases: ["DAY_VOTE"] },
    { key: "EXILE_RESOLUTION", label: "放逐", phases: ["EXILE_RESOLUTION", "HUNTER_SHOT"] },
    { key: "GAME_OVER", label: "复盘", phases: ["GAME_OVER"] },
  ];
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.phases.includes(phase)),
  );

  return steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    status: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
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

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

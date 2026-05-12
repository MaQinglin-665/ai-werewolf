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
    availableActions: getAvailableActionsForHuman(state),
    currentActorSeatId: visibleCurrentActorSeatId(state, requirement),
    currentSpeakerSeatId: getCurrentSpeakerSeatId(state),
    wolfTeammates:
      human.role === "WEREWOLF"
        ? state.seats
            .filter((seat) => seat.role === "WEREWOLF" && seat.seatId !== human.seatId)
            .map(toTarget)
        : [],
    seerChecks: state.seerChecks.filter((check) => check.seerSeatId === human.seatId),
    witch: state.witch,
    votes: state.phase === "DAY_VOTE" ? {} : state.votes,
    tableSummary: {
      recentSpeeches: publicSummary.recentSpeeches,
      voteSnapshot: publicSummary.voteSnapshot,
      aiReasonHighlights: [],
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
  const recentVotes = buildRecentVotes();
  const recentDeaths = state.events
    .filter((event) => event.type === "DAY_STARTED" || event.type === "PLAYER_EXILED" || event.type === "HUNTER_SHOT")
    .slice(-6)
    .map((event) => event.message);

  return {
    recentSpeeches,
    recentVotes,
    voteSnapshot: buildVoteSnapshot(state),
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

function buildRecentVotes(): PublicVoteItem[] {
  return [];
}

function buildVoteSnapshot(state: GameState): PublicVoteSnapshot {
  if (state.phase === "DAY_VOTE") {
    return {
      votes: [],
      tally: [],
      leaders: [],
      revealed: false,
    };
  }

  const revealEvent = [...state.events].reverse().find((event) => event.type === "VOTE_REVEALED");
  const rawTally = Array.isArray(revealEvent?.payload.tally) ? revealEvent.payload.tally : [];
  const tally = rawTally
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const targetSeatId = "targetSeatId" in item && typeof item.targetSeatId === "number" ? item.targetSeatId : undefined;
      const count = "votes" in item && typeof item.votes === "number" ? item.votes : undefined;
      if (!targetSeatId || count === undefined) return undefined;
      return {
        target: toTarget(getSeat(state, targetSeatId)),
        count,
      };
    })
    .filter((item): item is { target: ActionTarget; count: number } => Boolean(item))
    .sort((a, b) => b.count - a.count || a.target.seatId - b.target.seatId);
  const topCount = tally[0]?.count ?? 0;

  return {
    votes: [],
    tally,
    leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
    revealed: Boolean(revealEvent),
  };
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

function getAvailableActionsForHuman(state: GameState): AvailableHumanAction[] {
  if (state.result) {
    return [];
  }

  const requirement = getTurnRequirement(state);
  if (requirement.type === "human" && requirement.actorSeatId === state.humanSeatId) {
    return getAvailableActionsForSeat(state, state.humanSeatId);
  }

  return [buildContinueAction(state)];
}

function buildContinueAction(state: GameState): AvailableHumanAction {
  const requirement = getTurnRequirement(state);
  if (requirement.type === "ai") {
    const actor = getSeat(state, requirement.actorSeatId);
    if (state.phase === "DAY_SPEECH") {
      return {
        type: "continue",
        label: `听 ${actor.name} 发言`,
        description: "按真实房间节奏播放下一位玩家发言。",
      };
    }
    if (state.phase === "DAY_VOTE") {
      return {
        type: "continue",
        label: "等待其他玩家投票",
        description: "投票过程保密，结束后只公布被投票数。",
      };
    }
    return {
      type: "continue",
      label: hiddenRoleActionLabel(state.phase),
      description: phaseNarration(state.phase),
    };
  }

  return {
    type: "continue",
    label: continueLabel(state.phase),
    description: phaseNarration(state.phase),
  };
}

function visibleCurrentActorSeatId(state: GameState, requirement: ReturnType<typeof getTurnRequirement>): number | undefined {
  if (requirement.type === "human") {
    return requirement.actorSeatId;
  }

  if (requirement.type === "ai" && state.phase === "DAY_SPEECH") {
    return requirement.actorSeatId;
  }

  return undefined;
}

function hiddenRoleActionLabel(phase: Phase): string {
  switch (phase) {
    case "NIGHT_WOLVES":
      return "狼人行动中";
    case "NIGHT_SEER":
      return "预言家行动中";
    case "NIGHT_WITCH":
      return "女巫行动中";
    case "HUNTER_SHOT":
      return "猎人行动中";
    default:
      return "流程推进中";
  }
}

function continueLabel(phase: Phase): string {
  switch (phase) {
    case "DAY_ANNOUNCEMENT":
      return "天亮了";
    case "EXILE_RESOLUTION":
      return "公布投票结果";
    case "HUNTER_SHOT":
      return "结算猎人阶段";
    default:
      return "继续流程";
  }
}

function phaseNarration(phase: Phase): string {
  switch (phase) {
    case "NIGHT_WOLVES":
      return "天黑请闭眼，狼人请睁眼并选择击杀目标。";
    case "NIGHT_SEER":
      return "预言家请睁眼，选择一名玩家查验身份。";
    case "NIGHT_WITCH":
      return "女巫请睁眼，选择是否使用解药或毒药。";
    case "DAY_ANNOUNCEMENT":
      return "天亮了，公布昨夜死亡情况。";
    case "DAY_SPEECH":
      return "白天发言阶段，玩家按座位依次发言。";
    case "DAY_VOTE":
      return "投票阶段正在进行，所有投票在结束前保密。";
    case "EXILE_RESOLUTION":
      return "所有人投票结束，公开被投票数并结算放逐。";
    case "HUNTER_SHOT":
      return "猎人出局后进入开枪窗口。";
    default:
      return "继续推进当前流程。";
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

import {
  canSeatVote,
  canWitchSaveCurrentVictim,
  canWitchSeeCurrentVictim,
  getAliveSeats,
  getCurrentSpeakerSeatId,
  getSeat,
  getTurnRequirement,
  isIdiotRevealed,
  isWitchSelfSaveBlocked,
} from "./engine";
import { buildWolfTeamPlan } from "./campStrategy";
import { isSupportedRoleClaim } from "./claims";
import { PHASE_LABELS, ROLE_LABELS } from "./labels";
import { buildGameReview } from "./review";
import { isWolfRole } from "./roleUtils";
import { buildTableMemory } from "./tableMemory";
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
  AiFriendRuntimeLlmConfig,
} from "./types";

type HumanViewOptions = {
  allowFlowControls?: boolean;
};

export function buildHumanView(state: GameState): HumanGameView {
  return buildPlayerView(state, state.spectatorMode ? null : state.humanSeatId, {
    allowFlowControls: true,
  });
}

export function buildPlayerView(
  state: GameState,
  viewerSeatId: number | null,
  options: HumanViewOptions = {},
): HumanGameView {
  const human = viewerSeatId == null ? undefined : getSeat(state, viewerSeatId);
  const requirement = getTurnRequirement(state);
  const gameOver = Boolean(state.result);

  const publicSummary = buildPublicSummary(state);

  return {
    id: state.id,
    day: state.day,
    phase: state.phase,
    phaseLabel: PHASE_LABELS[state.phase],
    board: state.board,
    humanSeatId: human?.seatId ?? null,
    myRole: human?.role,
    myRoleLabel: human ? ROLE_LABELS[human.role] : undefined,
    setup: state.setup,
    seats: state.seats.map((seat) => {
      const canSeeRole =
        gameOver ||
        (human && seat.seatId === human.seatId) ||
        (isWolfRole(human?.role, state.rules.wolfRoles) && isWolfRole(seat.role, state.rules.wolfRoles)) ||
        isIdiotRevealed(state, seat.seatId);
      return {
        seatId: seat.seatId,
        name: seat.name,
        isAi: seat.isAi,
        isHuman: Boolean(human && seat.seatId === human.seatId),
        alive: seat.alive,
        role: canSeeRole ? seat.role : undefined,
        roleLabel: canSeeRole ? ROLE_LABELS[seat.role] : undefined,
        deathReason: gameOver ? seat.deathReason : undefined,
        voteDisabled: isIdiotRevealed(state, seat.seatId),
        personaLabel: seat.isAi ? seat.persona?.label : undefined,
        personaStyle: seat.isAi ? seat.persona?.style : undefined,
        personaName: seat.isAi ? seat.persona?.name : undefined,
        personaModelLabel: seat.isAi ? seat.persona?.modelLabel : undefined,
        aiFriendId: seat.isAi ? seat.aiFriendId : undefined,
        avatarDataUrl: seat.isAi ? seat.avatarDataUrl : undefined,
        ttsVoice: seat.isAi ? seat.ttsVoice : undefined,
        ttsConfig: seat.isAi ? seat.ttsConfig : undefined,
      };
    }),
    publicEvents: state.events.filter((event) => isVisiblePublicEvent(state, event)).map(toEventView),
    privateEvents: human
      ? state.events
          .filter((event) => event.visibility === "private" && event.actorSeatId === human.seatId)
          .map(toEventView)
      : [],
    availableActions: getAvailableActionsForViewer(state, human?.seatId ?? null, options),
    currentActorSeatId: visibleCurrentActorSeatId(state, requirement, human?.seatId ?? null),
    currentSpeakerSeatId: getVisibleCurrentSpeakerSeatId(state),
    wolfTeammates:
      human && isWolfRole(human.role, state.rules.wolfRoles)
        ? state.seats
            .filter((seat) => isWolfRole(seat.role, state.rules.wolfRoles) && seat.seatId !== human.seatId)
            .map(toTarget)
        : [],
    seerChecks: human ? state.seerChecks.filter((check) => check.seerSeatId === human.seatId) : [],
    guard:
      human?.role === "GUARD"
        ? {
            ...state.guard,
            guardedTarget: state.night.guardTargetSeatId ? toTarget(getSeat(state, state.night.guardTargetSeatId)) : undefined,
          }
        : undefined,
    witch: human?.role === "WITCH" ? state.witch : undefined,
    sheriff: buildSheriffView(state),
    votes: state.phase === "DAY_VOTE" ? {} : state.votes,
    tableSummary: {
      recentSpeeches: publicSummary.recentSpeeches,
      voteSnapshot: publicSummary.voteSnapshot,
      sheriffVoteSnapshot: publicSummary.sheriffVoteSnapshot,
      claimBoard: publicSummary.claimBoard,
      tableMemory: publicSummary.tableMemory,
      aiReasonHighlights: publicSummary.tableMemory.publicSignals,
      phaseSteps: buildPhaseSteps(state),
    },
    result: state.result,
    review: gameOver ? buildGameReview(state) : undefined,
  };
}

export function buildAgentView(
  state: GameState,
  seatId: number,
  runtimeAiLlmConfigs?: Record<string, AiFriendRuntimeLlmConfig>,
): AgentView {
  const seat = getSeat(state, seatId);
  const visibleWolfTargetSeatId = canWitchSeeCurrentVictim(state) ? state.night.wolfTargetSeatId : undefined;
  return {
    gameId: state.id,
    day: state.day,
    phase: state.phase,
    rules: {
      hasGuard: state.rules.hasGuard,
      guardSaveConflictKills: state.rules.guardSaveConflictKills,
      wolfRoles: state.rules.wolfRoles,
      hasWolfBeauty: state.rules.hasWolfBeauty,
      hasKnight: state.rules.hasKnight,
      hasIdiot: state.rules.hasIdiot,
    },
    mySeatId: seatId,
    myRole: seat.role,
    persona: seat.persona,
    llmConfig: resolveSeatRuntimeLlmConfig(seat, runtimeAiLlmConfigs),
    aliveSeats: getAliveSeats(state).map(toTarget),
    publicEvents: state.events.filter((event) => isVisiblePublicEvent(state, event)).map(toEventView),
    publicSummary: buildPublicSummary(state),
    privateKnowledge: {
      wolfTeammates:
        isWolfRole(seat.role, state.rules.wolfRoles)
          ? state.seats
              .filter((item) => isWolfRole(item.role, state.rules.wolfRoles) && item.seatId !== seatId)
              .map(toTarget)
          : undefined,
      wolfTeamPlan: isWolfRole(seat.role, state.rules.wolfRoles) ? buildWolfTeamPlan(state) : undefined,
      seerChecks:
        seat.role === "SEER" ? state.seerChecks.filter((check) => check.seerSeatId === seatId) : undefined,
      witch:
        seat.role === "WITCH"
          ? {
              ...state.witch,
              currentVictim: visibleWolfTargetSeatId ? toTarget(getSeat(state, visibleWolfTargetSeatId)) : undefined,
              savedTarget: state.night.witchSavedSeatId ? toTarget(getSeat(state, state.night.witchSavedSeatId)) : undefined,
              poisonedTarget: state.night.witchPoisonTargetSeatId
                ? toTarget(getSeat(state, state.night.witchPoisonTargetSeatId))
                : undefined,
              antidoteUsedTonight: Boolean(state.night.witchSavedSeatId),
              poisonUsedTonight: Boolean(state.night.witchPoisonTargetSeatId),
            }
          : undefined,
      pendingHunterShot: state.pendingHunterShot?.shooterSeatId === seatId ? state.pendingHunterShot : undefined,
      pendingWolfKingShot:
        state.pendingWolfKingShot?.shooterSeatId === seatId ? state.pendingWolfKingShot : undefined,
      guard:
        seat.role === "GUARD"
          ? {
              ...state.guard,
              guardedTarget: state.night.guardTargetSeatId ? toTarget(getSeat(state, state.night.guardTargetSeatId)) : undefined,
            }
          : undefined,
      sheriff: buildSheriffView(state),
      aiMemory: state.aiMemories?.[String(seatId)],
    },
    allowedActions: getAvailableActionsForSeat(state, seatId),
  };
}

function resolveSeatRuntimeLlmConfig(
  seat: Pick<ReturnType<typeof getSeat>, "aiFriendId" | "llmConfig">,
  runtimeAiLlmConfigs: Record<string, AiFriendRuntimeLlmConfig> | undefined,
): AiFriendRuntimeLlmConfig | undefined {
  if (!seat.aiFriendId) return seat.llmConfig;
  return runtimeAiLlmConfigs?.[seat.aiFriendId] ?? seat.llmConfig;
}

function buildPublicSummary(state: GameState): AgentView["publicSummary"] {
  const tableMemory = buildTableMemory(state);
  const recentSpeeches = buildRecentSpeeches(state);
  const recentVotes = buildRecentVotes(state);
  const recentDeaths = state.events
    .filter(
      (event) =>
        event.type === "DAY_STARTED" ||
        event.type === "PLAYER_EXILED" ||
        event.type === "IDIOT_REVEALED" ||
        event.type === "HUNTER_SHOT" ||
        event.type === "WOLF_KING_SHOT" ||
        event.type === "WHITE_WOLF_KING_EXPLODED" ||
        event.type === "WOLF_BEAUTY_CHARM_TRIGGERED" ||
        event.type === "KNIGHT_DUEL_SUCCESS" ||
        event.type === "KNIGHT_DUEL_FAILED"
    )
    .slice(-6)
    .map((event) => event.message);

  return {
    recentSpeeches,
    recentVotes,
    voteSnapshot: buildVoteSnapshot(state),
    sheriffVoteSnapshot: buildSheriffVoteSnapshot(state),
    recentDeaths,
    deathSummary: recentDeaths,
    claimBoard: tableMemory.claimBoard,
    tableMemory,
  };
}

function buildRecentSpeeches(state: GameState): PublicSpeechItem[] {
  return state.events
    .filter((event) => event.type === "SPEECH_CREATED" || event.type === "LAST_WORDS_CREATED")
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
  const revealedDays = new Set(state.events.filter((event) => event.type === "VOTE_REVEALED").map((event) => event.day));
  if (state.phase === "DAY_VOTE" || revealedDays.size === 0) return [];

  return state.events
    .filter((event) => event.type === "VOTE_CAST" && revealedDays.has(event.day))
    .slice(-12)
    .map((event) => {
      const voterSeatId = readNumber(event.payload, "voterSeatId") ?? event.actorSeatId;
      const targetSeatId = readNumber(event.payload, "targetSeatId");
      if (!voterSeatId) return undefined;
      const item: PublicVoteItem = {
        seq: event.seq,
        day: event.day,
        voter: toTarget(getSeat(state, voterSeatId)),
        ...(targetSeatId ? { target: toTarget(getSeat(state, targetSeatId)) } : { abstained: true }),
        reason: typeof event.payload.reason === "string" ? event.payload.reason : undefined,
      };
      return item;
    })
    .filter((vote): vote is PublicVoteItem => Boolean(vote));
}

function buildRecentSheriffVotes(state: GameState, revealEvent: GameEvent | undefined): PublicVoteItem[] {
  if (!revealEvent) return [];

  const previousBoundarySeq =
    [...state.events]
      .reverse()
      .find(
        (event) =>
          event.seq < revealEvent.seq && (event.type === "SHERIFF_VOTE_REVEALED" || event.type === "SHERIFF_PK_STARTED"),
      )?.seq ?? 0;

  return state.events
    .filter(
      (event) =>
        event.type === "SHERIFF_VOTE_CAST" &&
        event.day === revealEvent.day &&
        event.seq > previousBoundarySeq &&
        event.seq < revealEvent.seq,
    )
    .map((event) => {
      const voterSeatId = readNumber(event.payload, "voterSeatId") ?? event.actorSeatId;
      const targetSeatId = readNumber(event.payload, "targetSeatId");
      if (!voterSeatId) return undefined;
      const item: PublicVoteItem = {
        seq: event.seq,
        day: event.day,
        voter: toTarget(getSeat(state, voterSeatId)),
        ...(targetSeatId ? { target: toTarget(getSeat(state, targetSeatId)) } : { abstained: true }),
        reason: typeof event.payload.reason === "string" ? event.payload.reason : undefined,
      };
      return item;
    })
    .filter((vote): vote is PublicVoteItem => Boolean(vote));
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
    votes: buildRecentVotes(state).filter((vote) => vote.day === revealEvent?.day),
    tally,
    abstainCount:
      typeof revealEvent?.payload.abstainCount === "number" ? revealEvent.payload.abstainCount : undefined,
    leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
    revealed: Boolean(revealEvent),
  };
}

function buildSheriffVoteSnapshot(state: GameState): PublicVoteSnapshot | undefined {
  if (!state.rules.hasSheriff) return undefined;
  if (state.phase === "SHERIFF_VOTE" || state.phase === "SHERIFF_PK_VOTE") {
    return {
      votes: [],
      tally: [],
      leaders: [],
      revealed: false,
    };
  }

  const revealEvent = [...state.events].reverse().find((event) => event.type === "SHERIFF_VOTE_REVEALED");
  if (!revealEvent) return undefined;

  const rawTally = Array.isArray(revealEvent.payload.tally) ? revealEvent.payload.tally : [];
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
    votes: buildRecentSheriffVotes(state, revealEvent),
    tally,
    abstainCount:
      typeof revealEvent.payload.abstainCount === "number" ? revealEvent.payload.abstainCount : undefined,
    leaders: tally.filter((item) => item.count === topCount && topCount > 0).map((item) => item.target),
    revealed: true,
  };
}

function buildPhaseSteps(state: GameState): HumanGameView["tableSummary"]["phaseSteps"] {
  const phase = state.phase;
  const steps: Array<{ key: Phase; label: string; phases: Phase[] }> = [
    {
      key: "NIGHT_WOLVES",
      label: "夜晚",
      phases: ["NIGHT_WOLVES", "NIGHT_WOLF_BEAUTY", "NIGHT_GUARD", "NIGHT_SEER", "NIGHT_WITCH"],
    },
    ...(state.rules.hasSheriff
      ? [
          {
            key: "SHERIFF_NOMINATION" as Phase,
            label: "警长",
            phases: [
              "SHERIFF_NOMINATION",
              "SHERIFF_SPEECH",
              "SHERIFF_WITHDRAWAL",
              "SHERIFF_VOTE",
              "SHERIFF_PK_SPEECH",
              "SHERIFF_PK_VOTE",
            ] as Phase[],
          },
        ]
      : []),
    { key: "DAY_SPEECH", label: "发言", phases: ["DAY_ANNOUNCEMENT", "DAY_SPEECH"] },
    { key: "DAY_VOTE", label: "投票", phases: ["KNIGHT_DUEL", "DAY_VOTE"] },
    {
      key: "EXILE_RESOLUTION",
      label: "放逐",
      phases: ["EXILE_RESOLUTION", "LAST_WORDS", "HUNTER_SHOT", "WOLF_KING_SHOT", "SHERIFF_HANDOFF"],
    },
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
  if (
    !seat.alive &&
    state.phase !== "LAST_WORDS" &&
    state.phase !== "HUNTER_SHOT" &&
    state.phase !== "WOLF_KING_SHOT" &&
    state.phase !== "SHERIFF_HANDOFF"
  ) {
    return [];
  }

  switch (state.phase) {
    case "NIGHT_WOLVES":
      if (!isWolfRole(seat.role, state.rules.wolfRoles)) return [];
      return [
        {
          type: "wolfKill",
          targets: getAliveSeats(state).map(toTarget),
        },
      ];
    case "NIGHT_WOLF_BEAUTY":
      if (seat.role !== "WOLF_BEAUTY") return [];
      return [
        {
          type: "wolfBeautyCharm",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
          canSkip: true,
        },
      ];
    case "NIGHT_GUARD":
      if (seat.role !== "GUARD") return [];
      return [
        {
          type: "guardAction",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== state.guard?.lastGuardedSeatId)
            .map(toTarget),
          canSkip: true,
          lastGuardedSeatId: state.guard?.lastGuardedSeatId,
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
      const visibleWolfTargetSeatId = canWitchSeeCurrentVictim(state) ? state.night.wolfTargetSeatId : undefined;
      const saveTarget =
        visibleWolfTargetSeatId ? toTarget(getSeat(state, visibleWolfTargetSeatId)) : undefined;
      const selfSaveBlocked = isWitchSelfSaveBlocked(state, seatId, state.night.wolfTargetSeatId);
      return [
        {
          type: "witchAction",
          canSave: canWitchSaveCurrentVictim(state, seatId),
          saveTarget,
          saveBlockedReason: selfSaveBlocked ? "女巫第二夜起不能自救。" : undefined,
          canPoison: state.witch.poisonAvailable,
          poisonTargets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
        },
      ];
    case "DAY_SPEECH":
      if (getCurrentSpeakerSeatId(state) !== seatId) return [];
      return [
        { type: "speak" },
        ...(seat.role === "WHITE_WOLF_KING"
          ? [
              {
                type: "whiteWolfKingExplode" as const,
                targets: getAliveSeats(state)
                  .filter((target) => target.seatId !== seatId)
                  .map(toTarget),
              },
            ]
          : []),
      ];
    case "LAST_WORDS":
      return state.lastWordsSeatId === seatId ? [{ type: "lastWords" }] : [];
    case "DAY_VOTE":
      if (!canSeatVote(state, seatId)) return [];
      if (hasVoted(state, seatId)) return [];
      return [
        {
          type: "vote",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId && !isIdiotRevealed(state, target.seatId))
            .map(toTarget),
          canAbstain: true,
        },
      ];
    case "KNIGHT_DUEL":
      if (seat.role !== "KNIGHT" || state.knight?.used) return [];
      return [
        {
          type: "knightDuel",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
          canSkip: true,
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
    case "WOLF_KING_SHOT":
      if (state.pendingWolfKingShot?.shooterSeatId !== seatId) return [];
      return [
        {
          type: "wolfKingShoot",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
          canSkip: true,
        },
      ];
    case "SHERIFF_NOMINATION":
      if (!seat.alive || !state.sheriff || state.sheriff.nominationDecisions[String(seatId)] !== undefined) return [];
      return [{ type: "sheriffNominate", canRun: true }];
    case "SHERIFF_SPEECH":
    case "SHERIFF_PK_SPEECH":
      return getCurrentSheriffSpeakerSeatId(state) === seatId ? [{ type: "sheriffSpeech" }] : [];
    case "SHERIFF_WITHDRAWAL":
      if (!state.sheriff || !activeSheriffCandidates(state).includes(seatId)) return [];
      if (state.sheriff.withdrawalDecisions[String(seatId)] !== undefined) return [];
      return [{ type: "sheriffWithdraw", canWithdraw: true }];
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE": {
      if (!state.sheriff || state.sheriff.votes[String(seatId)] !== undefined) return [];
      const candidates =
        state.phase === "SHERIFF_PK_VOTE" ? state.sheriff.pkCandidates ?? [] : activeSheriffCandidates(state);
      if (candidates.includes(seatId)) return [];
      return [
        {
          type: "sheriffVote",
          targets: candidates.map((candidateSeatId) => toTarget(getSeat(state, candidateSeatId))),
          canAbstain: true,
          isPk: state.phase === "SHERIFF_PK_VOTE",
        },
      ];
    }
    case "SHERIFF_HANDOFF":
      if (state.pendingSheriffHandoff?.fromSeatId !== seatId) return [];
      return [
        {
          type: "sheriffHandoff",
          targets: getAliveSeats(state)
            .filter((target) => target.seatId !== seatId)
            .map(toTarget),
          canTear: true,
        },
      ];
    default:
      return [];
  }
}

function getAvailableActionsForViewer(
  state: GameState,
  viewerSeatId: number | null,
  options: HumanViewOptions = {},
): AvailableHumanAction[] {
  if (state.result) {
    return [];
  }

  const requirement = getTurnRequirement(state);
  if (viewerSeatId != null && requirement.type === "human" && requirement.actorSeatId === viewerSeatId) {
    return getAvailableActionsForSeat(state, viewerSeatId);
  }

  return options.allowFlowControls ? [buildContinueAction(state)] : [];
}

function buildContinueAction(state: GameState): AvailableHumanAction {
  const requirement = getTurnRequirement(state);
  if (requirement.type === "ai") {
    const actor = getSeat(state, requirement.actorSeatId);
    if (state.phase === "DAY_SPEECH") {
      return {
        type: "continue",
        label: `听 ${actor.seatId}号发言`,
        description: "按真实房间节奏播放下一位玩家发言。",
      };
    }
    if (state.phase === "DAY_VOTE") {
      return {
        type: "continue",
        label: "等待统一开票",
        description: "其他玩家正在同时投票，票齐后统一公布被投票数。",
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

function visibleCurrentActorSeatId(
  state: GameState,
  requirement: ReturnType<typeof getTurnRequirement>,
  viewerSeatId: number | null,
): number | undefined {
  if (requirement.type === "human") {
    if (requirement.actorSeatId === viewerSeatId || isPublicActorPhase(state.phase)) {
      return requirement.actorSeatId;
    }
    return undefined;
  }

  if (requirement.type === "ai" && isPublicActorPhase(state.phase)) {
    return requirement.actorSeatId;
  }

  return undefined;
}

function isPublicActorPhase(phase: Phase): boolean {
  return (
    phase === "DAY_SPEECH" ||
    phase === "KNIGHT_DUEL" ||
    phase === "DAY_VOTE" ||
    phase === "LAST_WORDS" ||
    phase === "WOLF_KING_SHOT" ||
    phase === "SHERIFF_NOMINATION" ||
    phase === "SHERIFF_SPEECH" ||
    phase === "SHERIFF_WITHDRAWAL" ||
    phase === "SHERIFF_VOTE" ||
    phase === "SHERIFF_PK_SPEECH" ||
    phase === "SHERIFF_PK_VOTE" ||
    phase === "SHERIFF_HANDOFF"
  );
}

function getVisibleCurrentSpeakerSeatId(state: GameState): number | undefined {
  if (state.phase === "SHERIFF_SPEECH" || state.phase === "SHERIFF_PK_SPEECH") {
    return getCurrentSheriffSpeakerSeatId(state);
  }
  return getCurrentSpeakerSeatId(state);
}

function hiddenRoleActionLabel(phase: Phase): string {
  switch (phase) {
    case "NIGHT_WOLVES":
      return "狼人行动中";
    case "NIGHT_WOLF_BEAUTY":
      return "狼美人行动中";
    case "NIGHT_GUARD":
      return "守卫行动中";
    case "NIGHT_SEER":
      return "预言家行动中";
    case "NIGHT_WITCH":
      return "女巫行动中";
    case "HUNTER_SHOT":
      return "猎人行动中";
    case "WOLF_KING_SHOT":
      return "狼王行动中";
    case "KNIGHT_DUEL":
      return "骑士行动中";
    case "SHERIFF_NOMINATION":
      return "上警选择中";
    case "SHERIFF_SPEECH":
    case "SHERIFF_PK_SPEECH":
      return "警上发言中";
    case "SHERIFF_WITHDRAWAL":
      return "退水选择中";
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE":
      return "警长投票中";
    case "SHERIFF_HANDOFF":
      return "警徽移交中";
    case "LAST_WORDS":
      return "遗言发表中";
    default:
      return "流程推进中";
  }
}

function continueLabel(phase: Phase): string {
  switch (phase) {
    case "DAY_ANNOUNCEMENT":
      return "天亮了";
    case "SHERIFF_NOMINATION":
      return "开始上警";
    case "SHERIFF_SPEECH":
    case "SHERIFF_PK_SPEECH":
      return "继续警上发言";
    case "SHERIFF_WITHDRAWAL":
      return "继续退水";
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE":
      return "继续警长投票";
    case "EXILE_RESOLUTION":
      return "公布投票结果";
    case "KNIGHT_DUEL":
      return "骑士决斗";
    case "LAST_WORDS":
      return "发表遗言";
    case "HUNTER_SHOT":
      return "结算猎人阶段";
    case "WOLF_KING_SHOT":
      return "结算狼王阶段";
    case "SHERIFF_HANDOFF":
      return "移交警徽";
    default:
      return "继续流程";
  }
}

function phaseNarration(phase: Phase): string {
  switch (phase) {
    case "NIGHT_WOLVES":
      return "天黑请闭眼，狼人请睁眼并选择击杀目标。";
    case "NIGHT_WOLF_BEAUTY":
      return "狼美人请睁眼，选择今晚魅惑的玩家，也可以不魅惑。";
    case "NIGHT_GUARD":
      return "守卫请睁眼，选择一名玩家守护，也可以空守。";
    case "NIGHT_SEER":
      return "预言家请睁眼，选择一名玩家查验身份。";
    case "NIGHT_WITCH":
      return "女巫请睁眼，选择是否使用解药或毒药。";
    case "DAY_ANNOUNCEMENT":
      return "天亮了，公布昨夜死亡情况。";
    case "SHERIFF_NOMINATION":
      return "所有存活玩家依次选择是否上警。";
    case "SHERIFF_SPEECH":
      return "警上候选人依次发表竞选发言。";
    case "SHERIFF_WITHDRAWAL":
      return "警上候选人依次选择是否退水。";
    case "SHERIFF_VOTE":
      return "警下玩家投票选出警长。";
    case "SHERIFF_PK_SPEECH":
      return "警长投票平票，PK 候选人依次发言。";
    case "SHERIFF_PK_VOTE":
      return "非 PK 玩家进行警长 PK 复投。";
    case "DAY_SPEECH":
      return "白天发言阶段，玩家按座位依次发言。";
    case "KNIGHT_DUEL":
      return "骑士可以选择是否发动决斗，成功带走狼人，失败自己出局并继续投票。";
    case "DAY_VOTE":
      return "投票阶段同时进行，所有投票在统一开票前保密。";
    case "EXILE_RESOLUTION":
      return "所有人投票结束，公开被投票数并结算放逐。";
    case "LAST_WORDS":
      return "出局玩家发表遗言，遗言结束后继续结算后续流程。";
    case "HUNTER_SHOT":
      return "猎人出局后进入开枪窗口。";
    case "WOLF_KING_SHOT":
      return "狼王出局后进入开枪窗口。";
    case "SHERIFF_HANDOFF":
      return "警长出局后选择移交警徽或撕掉警徽。";
    default:
      return "继续推进当前流程。";
  }
}

function isPublicEvent(event: GameEvent): boolean {
  return event.visibility === "public";
}

function isVisiblePublicEvent(state: GameState, event: GameEvent): boolean {
  if (!isPublicEvent(event)) return false;
  if (event.type === "SPEECH_CREATED" && event.payload.sheriffSpeech === true) return false;
  if (event.type !== "ROLE_CLAIMED") return true;

  const claimId = typeof event.payload.claimId === "string" ? event.payload.claimId : undefined;
  return Boolean((state.roleClaims ?? []).find((claim) => claim.id === claimId && isSupportedRoleClaim(claim)));
}

function toEventView(event: GameEvent): Pick<GameEvent, "seq" | "type" | "day" | "phase" | "actorSeatId" | "message" | "payload"> {
  return {
    seq: event.seq,
    type: event.type,
    day: event.day,
    phase: event.phase,
    actorSeatId: event.actorSeatId,
    message: event.message,
    payload: event.payload,
  };
}

function buildSheriffView(state: GameState): HumanGameView["sheriff"] {
  if (!state.sheriff) return undefined;
  return {
    ...state.sheriff,
    badgeHolder: state.sheriff.badgeHolderSeatId ? toTarget(getSeat(state, state.sheriff.badgeHolderSeatId)) : undefined,
    candidates: state.sheriff.candidates.map((seatId) => toTarget(getSeat(state, seatId))),
    pkCandidates: state.sheriff.pkCandidates?.map((seatId) => toTarget(getSeat(state, seatId))),
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

function hasVoted(state: GameState, seatId: number): boolean {
  return Object.prototype.hasOwnProperty.call(state.votes, String(seatId));
}

function getCurrentSheriffSpeakerSeatId(state: GameState): number | undefined {
  if (!state.sheriff || (state.phase !== "SHERIFF_SPEECH" && state.phase !== "SHERIFF_PK_SPEECH")) return undefined;
  let index = state.sheriff.speechIndex;
  while (index < state.sheriff.speechQueue.length) {
    const seatId = state.sheriff.speechQueue[index];
    if (getSeat(state, seatId).alive) return seatId;
    index += 1;
  }
  return undefined;
}

function activeSheriffCandidates(state: GameState): number[] {
  if (!state.sheriff) return [];
  const withdrawn = new Set(state.sheriff.withdrawnSeatIds);
  return state.sheriff.candidates.filter((seatId) => !withdrawn.has(seatId) && getSeat(state, seatId).alive);
}

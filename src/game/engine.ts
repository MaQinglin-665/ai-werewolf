import { randomUUID } from "node:crypto";
import { DEFAULT_AI_FRIEND_ID_PREFIX, resolveAiFriendsForGame } from "./aiFriends";
import { buildRules, DEFAULT_BOARD_ID, getBoardPreset, toBoardSnapshot } from "./boards";
import { describeRoleClaim, extractRoleClaimFromSpeech, upsertRoleClaim } from "./claims";
import { ROLE_LABELS } from "./labels";
import { getAiPersonaForAiIndex } from "./personas";
import { isWolfRole } from "./roleUtils";
import { describeStance, extractStancesFromSpeech } from "./stances";
import type {
  Camp,
  Command,
  DeathReason,
  GameEventType,
  GameResult,
  GameState,
  GameSetupSnapshot,
  Phase,
  Role,
  Seat,
  TurnRequirement,
  Visibility,
  AiFriendConfig,
} from "./types";

type CreateGameOptions = {
  id?: string;
  humanSeatId?: number | null;
  seed?: number | string;
  boardId?: string;
  aiFriends?: AiFriendConfig[];
};

export function createGame(options: CreateGameOptions = {}): GameState {
  const id = options.id ?? randomUUID();
  const board = getBoardPreset(options.boardId);
  const spectatorMode = options.humanSeatId === null;
  const humanSeatId = spectatorMode ? 1 : options.humanSeatId ?? 1;
  if (humanSeatId < 1 || humanSeatId > board.seatCount) {
    throw new Error(`真人座位必须在 1 到 ${board.seatCount} 之间。`);
  }
  const now = new Date().toISOString();
  const roles = shuffle(board.roles, options.seed);
  const resolvedAiFriends = resolveAiFriendsForGame(options.aiFriends, spectatorMode ? board.seatCount : board.seatCount - 1);
  const aiFriendSetup: GameSetupSnapshot["aiFriends"] = [];
  let aiIndex = 0;
  const seats: Seat[] = roles.map((role, index) => {
    const seatId = index + 1;
    const isAi = spectatorMode || seatId !== humanSeatId;
    const resolvedFriend = isAi ? resolvedAiFriends[aiIndex] : undefined;
    const persona = resolvedFriend?.persona ?? (isAi ? getAiPersonaForAiIndex(aiIndex) : undefined);
    if (isAi && resolvedFriend) {
      aiFriendSetup.push({
        seatId,
        ...resolvedFriend.setup,
        nickname: resolvedFriend.displayName,
      });
    }
    if (isAi) aiIndex += 1;
    return {
      seatId,
      name: resolvedFriend?.displayName ?? persona?.name ?? "你",
      isAi,
      role,
      alive: true,
      persona,
      aiFriendId: resolvedFriend?.config.id,
      avatarDataUrl: resolvedFriend?.config.avatarDataUrl,
      llmConfig: resolvedFriend?.config.llmConfig,
      ttsVoice: resolvedFriend?.config.ttsVoice,
      ttsConfig: resolvedFriend?.config.ttsConfig,
      roleCard: resolvedFriend?.config.roleCard,
    };
  });

  let state: GameState = {
    id,
    day: 1,
    phase: "NIGHT_WOLVES",
    humanSeatId,
    spectatorMode,
    board: toBoardSnapshot(board),
    rules: buildRules(board),
    setup: {
      boardId: board.id,
      aiFriends: aiFriendSetup,
    },
    seats,
    events: [],
    night: {},
    guard: board.hasGuard ? {} : undefined,
    knight: board.roles.includes("KNIGHT") ? { used: false } : undefined,
    idiot: board.roles.includes("IDIOT") ? { revealedSeatIds: [] } : undefined,
    witch: {
      antidoteAvailable: true,
      poisonAvailable: true,
    },
    sheriff: board.hasSheriff ? createInitialSheriffState() : undefined,
    seerChecks: [],
    roleClaims: [],
    stances: [],
    speeches: [],
    speechQueue: [],
    speechIndex: 0,
    votes: {},
    aiMemories: {},
    createdAt: now,
    updatedAt: now,
  };

  state = appendEvent(state, "GAME_CREATED", "system", `${board.name} 对局已创建。`, {
    humanSeatId: spectatorMode ? null : humanSeatId,
    boardId: board.id,
    spectatorMode,
  });

  for (const seat of seats) {
    state = appendEvent(
      state,
      "ROLE_ASSIGNED",
      "private",
      `${seatLabel(seat)} 的身份是 ${ROLE_LABELS[seat.role]}。`,
      { seatId: seat.seatId, role: seat.role },
      seat.seatId,
    );
  }

  state = appendEvent(state, "NIGHT_STARTED", "public", "天黑请闭眼。第1夜开始，狼人请行动。", {
    day: 1,
  });

  return state;
}

export function hydrateGameState(state: GameState): GameState {
  const board = getBoardPreset(state.board?.id ?? DEFAULT_BOARD_ID);
  state.board ??= toBoardSnapshot(board);
  state.rules ??= buildRules(board);
  state.rules.hasWolfBeauty ??= board.roles.includes("WOLF_BEAUTY");
  state.rules.hasKnight ??= board.roles.includes("KNIGHT");
  state.rules.hasIdiot ??= board.roles.includes("IDIOT");
  state.setup ??= buildLegacySetupSnapshot(state);
  state.spectatorMode ??= false;
  state.night ??= {};
  state.guard = state.rules.hasGuard ? (state.guard ?? {}) : undefined;
  state.knight = state.rules.hasKnight ? (state.knight ?? { used: false }) : undefined;
  state.idiot = state.rules.hasIdiot ? { revealedSeatIds: [], ...state.idiot } : undefined;
  state.sheriff = state.rules.hasSheriff ? normalizeSheriffState(state.sheriff) : undefined;
  state.witch ??= { antidoteAvailable: true, poisonAvailable: true };
  state.seerChecks ??= [];
  state.roleClaims ??= [];
  state.stances ??= [];
  state.speeches ??= [];
  state.speechQueue ??= [];
  state.speechIndex ??= 0;
  state.votes ??= {};
  state.aiMemories ??= {};
  return state;
}

function buildLegacySetupSnapshot(state: GameState): GameSetupSnapshot {
  return {
    boardId: state.board?.id ?? DEFAULT_BOARD_ID,
    aiFriends: (state.seats ?? [])
      .filter((seat) => seat.isAi)
      .map((seat) => {
        const basePersonaId = seat.persona?.id ?? "unknown";
        return {
          seatId: seat.seatId,
          friendId: seat.aiFriendId ?? `${DEFAULT_AI_FRIEND_ID_PREFIX}${basePersonaId}`,
          nickname: seat.name,
          basePersonaId,
          personaName: seat.persona?.name ?? seat.name,
          modelLabel: seat.persona?.modelLabel,
          avatarDataUrl: seat.avatarDataUrl,
          ttsVoice: seat.ttsVoice,
          ttsConfig: seat.ttsConfig,
          roleCard: seat.roleCard,
          isDefault: !seat.aiFriendId || seat.aiFriendId.startsWith(DEFAULT_AI_FRIEND_ID_PREFIX),
        };
      }),
  };
}

export function applyCommand(state: GameState, command: Command): GameState {
  const next = cloneState(state);
  if (next.result) {
    throw new Error("游戏已经结束。");
  }

  switch (command.type) {
    case "wolfKill":
      return applyWolfKill(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "guardAction":
      return applyGuardAction(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "seerCheck":
      return applySeerCheck(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "witchAction":
      return applyWitchAction(next, command.actorSeatId, command.mode, command.targetSeatId, command.reason);
    case "wolfBeautyCharm":
      return applyWolfBeautyCharm(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "speak":
      return applySpeech(next, command.actorSeatId, command.message);
    case "lastWords":
      return applyLastWords(next, command.actorSeatId, command.message);
    case "vote":
      return applyVote(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "hunterReveal":
      return applyHunterReveal(next, command.actorSeatId, command.reveal, command.reason);
    case "hunterShoot":
      return applyHunterShot(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "wolfKingShoot":
      return applyWolfKingShot(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "whiteWolfKingExplode":
      return applyWhiteWolfKingExplode(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "knightDuel":
      return applyKnightDuel(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "sheriffNominate":
      return applySheriffNomination(next, command.actorSeatId, command.run, command.reason);
    case "sheriffSpeech":
      return applySheriffSpeech(next, command.actorSeatId, command.message);
    case "sheriffWithdraw":
      return applySheriffWithdraw(next, command.actorSeatId, command.withdraw, command.reason);
    case "sheriffVote":
      return applySheriffVote(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "sheriffHandoff":
      return applySheriffHandoff(next, command.actorSeatId, command.targetSeatId, command.reason);
  }
}

export function applySystemStep(state: GameState): GameState {
  const next = cloneState(state);
  if (next.result) {
    return next;
  }

  switch (next.phase) {
    case "NIGHT_WOLVES":
      return settleWinOrContinue(next);
    case "NIGHT_WOLF_BEAUTY":
      next.phase = nextNightPhaseAfterWolfBeauty(next);
      appendEvent(next, "ROLE_PHASE_SKIPPED", "system", "狼美人已出局，魅惑阶段跳过。", {
        role: "WOLF_BEAUTY",
      });
      return continueAfterNightAction(next);
    case "NIGHT_GUARD":
      next.phase = nextNightPhaseAfterGuard(next);
      appendEvent(next, "ROLE_PHASE_SKIPPED", "system", "守卫已出局，守护阶段跳过。", {
        role: "GUARD",
      });
      return continueAfterNightAction(next);
    case "NIGHT_SEER":
      next.phase = nextNightPhaseAfterSeer(next);
      appendEvent(next, "ROLE_PHASE_SKIPPED", "system", "预言家已出局，查验阶段跳过。", {
        role: "SEER",
      });
      return continueAfterNightAction(next);
    case "NIGHT_WITCH":
      next.phase = "DAY_ANNOUNCEMENT";
      appendEvent(next, "ROLE_PHASE_SKIPPED", "system", "女巫无法行动，女巫阶段跳过。", {
          role: "WITCH",
      });
      return enterDayAnnouncement(next);
    case "DAY_ANNOUNCEMENT":
      return continueFromDayAnnouncement(next);
    case "SHERIFF_NOMINATION":
      return finishSheriffElection(next, "no candidates");
    case "SHERIFF_SPEECH":
      next.phase = "SHERIFF_WITHDRAWAL";
      next.sheriff!.withdrawalDecisions = {};
      return touch(next);
    case "SHERIFF_WITHDRAWAL":
      return continueAfterSheriffWithdrawal(next);
    case "SHERIFF_VOTE":
      return resolveSheriffVote(next, false);
    case "SHERIFF_PK_SPEECH":
      next.phase = "SHERIFF_PK_VOTE";
      next.sheriff!.votes = {};
      return touch(next);
    case "SHERIFF_PK_VOTE":
      return resolveSheriffVote(next, true);
    case "DAY_SPEECH":
      return enterKnightDuelOrDayVote(next);
    case "KNIGHT_DUEL":
      return enterDayVote(next);
    case "DAY_VOTE":
      next.phase = "EXILE_RESOLUTION";
      return touch(next);
    case "EXILE_RESOLUTION":
      return resolveVote(next);
    case "LAST_WORDS":
      return finishAfterLastWords(next);
    case "HUNTER_REVEAL":
    case "HUNTER_SHOT":
      return next.pendingHunterShot
        ? next
        : next.lastWordsNextStep === "NIGHT_DEATHS"
          ? finishAfterNightDeaths(next)
          : finishAfterDayDeaths(next);
    case "WOLF_KING_SHOT":
      return next.pendingWolfKingShot
        ? applyWolfKingShot(next, next.pendingWolfKingShot.shooterSeatId)
        : finishAfterDayDeaths(next);
    case "SHERIFF_HANDOFF":
      return applySheriffHandoff(next, next.pendingSheriffHandoff!.fromSeatId, undefined);
    default:
      return next;
  }
}

export function getTurnRequirement(state: GameState): TurnRequirement {
  if (state.result || state.phase === "GAME_OVER") {
    return { type: "none", phase: state.phase };
  }

  const actorSeatId = getActorSeatId(state);
  if (!actorSeatId) {
    return { type: "system", phase: state.phase };
  }

  const actor = getSeat(state, actorSeatId);
  return {
    type: actor.isAi ? "ai" : "human",
    actorSeatId,
    phase: state.phase,
  };
}

export function evaluateWinCondition(state: GameState): GameResult | undefined {
  const alive = state.seats.filter((seat) => seat.alive);
  const wolfRoles = new Set(state.rules?.wolfRoles ?? ["WEREWOLF"]);
  const godRoles = new Set(state.rules?.godRoles ?? ["SEER", "WITCH", "HUNTER"]);
  const wolves = alive.filter((seat) => wolfRoles.has(seat.role)).length;
  const villagers = alive.filter((seat) => seat.role === "VILLAGER").length;
  const gods = alive.filter((seat) => godRoles.has(seat.role)).length;

  if (wolves === 0) {
    return { winner: "GOOD", reason: "所有狼人出局" };
  }

  if (villagers === 0) {
    return { winner: "WEREWOLVES", reason: "所有平民出局" };
  }

  if (gods === 0) {
    return { winner: "WEREWOLVES", reason: "所有神职出局" };
  }

  return undefined;
}

export function getCurrentSpeakerSeatId(state: GameState): number | undefined {
  if (state.phase !== "DAY_SPEECH") {
    return undefined;
  }

  let index = state.speechIndex;
  while (index < state.speechQueue.length) {
    const seatId = state.speechQueue[index];
    if (getSeat(state, seatId).alive) {
      return seatId;
    }
    index += 1;
  }

  return undefined;
}

export function getAliveSeats(state: GameState): Seat[] {
  return state.seats.filter((seat) => seat.alive);
}

export function isIdiotRevealed(state: GameState, seatId: number): boolean {
  return Boolean(state.idiot?.revealedSeatIds.includes(seatId));
}

export function canSeatVote(state: GameState, seatId: number): boolean {
  return getSeat(state, seatId).alive && !isIdiotRevealed(state, seatId);
}

export function getSeat(state: GameState, seatId: number): Seat {
  const seat = state.seats.find((item) => item.seatId === seatId);
  if (!seat) {
    throw new Error(`座位 ${seatId} 不存在。`);
  }
  return seat;
}

export function getCamp(role: Role): Camp {
  return isWolfRole(role) ? "WEREWOLVES" : "GOOD";
}

export function canWitchSaveCurrentVictim(state: GameState, witchSeatId: number): boolean {
  return Boolean(
    state.witch.antidoteAvailable &&
      state.night.wolfTargetSeatId &&
      !isWitchSelfSaveBlocked(state, witchSeatId, state.night.wolfTargetSeatId),
  );
}

export function canWitchSeeCurrentVictim(state: GameState): boolean {
  return Boolean(state.witch.antidoteAvailable && state.night.wolfTargetSeatId);
}

export function isWitchSelfSaveBlocked(state: GameState, witchSeatId: number, targetSeatId?: number): boolean {
  return state.day > 1 && targetSeatId === witchSeatId;
}

function seatLabel(seat: Pick<Seat, "seatId">): string {
  return `${seat.seatId}号`;
}

function applyWolfKill(state: GameState, actorSeatId: number, targetSeatId: number, reason?: string): GameState {
  assertPhase(state, "NIGHT_WOLVES");
  const actor = assertAliveWolfRole(state, actorSeatId);
  const target = assertAlive(state, targetSeatId);
  state.night.wolfTargetSeatId = target.seatId;
  state.phase = nextNightPhaseAfterWolves(state);
  appendEvent(
    state,
    "NIGHT_KILL_SELECTED",
    "private",
    `${seatLabel(actor)} 选择夜间击杀 ${seatLabel(target)}。`,
    { targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  return continueAfterNightAction(state);
}

function applyGuardAction(state: GameState, actorSeatId: number, targetSeatId?: number, reason?: string): GameState {
  assertPhase(state, "NIGHT_GUARD");
  const actor = assertAliveRole(state, actorSeatId, "GUARD");
  state.guard ??= {};

  if (!targetSeatId) {
    state.night.guardTargetSeatId = undefined;
    state.guard.lastGuardedSeatId = undefined;
    state.phase = nextNightPhaseAfterGuard(state);
    appendEvent(state, "GUARD_SKIPPED", "private", `${seatLabel(actor)} 没有守护。`, reasonPayload(reason), actor.seatId);
    return continueAfterNightAction(state);
  }

  const target = assertAlive(state, targetSeatId);
  if (state.guard.lastGuardedSeatId === target.seatId) {
    throw new Error("守卫不能连续两晚守护同一名玩家。");
  }

  state.night.guardTargetSeatId = target.seatId;
  state.guard.lastGuardedSeatId = target.seatId;
  state.phase = nextNightPhaseAfterGuard(state);
  appendEvent(
    state,
    "GUARD_PROTECTED",
    "private",
    `${seatLabel(actor)} 守护了 ${seatLabel(target)}。`,
    { targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  return continueAfterNightAction(state);
}

function applySeerCheck(state: GameState, actorSeatId: number, targetSeatId: number, reason?: string): GameState {
  assertPhase(state, "NIGHT_SEER");
  const actor = assertAliveRole(state, actorSeatId, "SEER");
  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("预言家不能查验自己。");
  }

  const result = isWolfRole(target.role, state.rules.wolfRoles) ? "WEREWOLF" : "GOOD";
  state.seerChecks.push({
    day: state.day,
    seerSeatId: actor.seatId,
    targetSeatId: target.seatId,
    result,
  });
  state.phase = nextNightPhaseAfterSeer(state);

  appendEvent(
    state,
    "SEER_CHECKED",
    "private",
    `你查验了 ${seatLabel(target)}，结果是 ${result === "WEREWOLF" ? "狼人" : "好人"}。`,
    { targetSeatId: target.seatId, result, ...reasonPayload(reason) },
    actor.seatId,
  );
  return continueAfterNightAction(state);
}

function applyWitchAction(
  state: GameState,
  actorSeatId: number,
  mode: "save" | "poison" | "skip",
  targetSeatId?: number,
  reason?: string,
): GameState {
  assertPhase(state, "NIGHT_WITCH");
  const actor = assertAliveRole(state, actorSeatId, "WITCH");

  if (mode === "save") {
    if (!state.witch.antidoteAvailable) {
      throw new Error("解药已经用完。");
    }
    if (!state.night.wolfTargetSeatId) {
      throw new Error("今晚没有可救目标。");
    }
    if (isWitchSelfSaveBlocked(state, actor.seatId, state.night.wolfTargetSeatId)) {
      throw new Error("女巫第二夜起不能自救。");
    }
    state.witch.antidoteAvailable = false;
    state.night.witchSavedSeatId = state.night.wolfTargetSeatId;
    state.phase = "DAY_ANNOUNCEMENT";
    appendEvent(
      state,
      "WITCH_USED_ANTIDOTE",
      "private",
      `${seatLabel(actor)} 使用了解药。`,
      { targetSeatId: state.night.witchSavedSeatId, ...reasonPayload(reason) },
      actor.seatId,
    );
    return enterDayAnnouncement(state);
  }

  if (mode === "poison") {
    if (!state.witch.poisonAvailable) {
      throw new Error("毒药已经用完。");
    }
    if (!targetSeatId) {
      throw new Error("毒药需要选择目标。");
    }
    const target = assertAlive(state, targetSeatId);
    if (target.seatId === actor.seatId) {
      throw new Error("女巫不能毒自己。");
    }
    state.witch.poisonAvailable = false;
    state.night.witchPoisonTargetSeatId = target.seatId;
    state.phase = "DAY_ANNOUNCEMENT";
    appendEvent(
      state,
      "WITCH_USED_POISON",
      "private",
      `${seatLabel(actor)} 对 ${seatLabel(target)} 使用了毒药。`,
      { targetSeatId: target.seatId, ...reasonPayload(reason) },
      actor.seatId,
    );
    return enterDayAnnouncement(state);
  }

  state.phase = "DAY_ANNOUNCEMENT";
  appendEvent(state, "WITCH_SKIPPED", "private", `${seatLabel(actor)} 没有使用药。`, reasonPayload(reason), actor.seatId);
  return enterDayAnnouncement(state);
}

function applyWolfBeautyCharm(
  state: GameState,
  actorSeatId: number,
  targetSeatId?: number,
  reason?: string,
): GameState {
  assertPhase(state, "NIGHT_WOLF_BEAUTY");
  const actor = assertAliveRole(state, actorSeatId, "WOLF_BEAUTY");

  if (!targetSeatId) {
    state.night.wolfBeautyTargetSeatId = undefined;
    state.phase = nextNightPhaseAfterWolfBeauty(state);
    appendEvent(
      state,
      "WOLF_BEAUTY_CHARMED",
      "private",
      `${seatLabel(actor)} 今夜没有魅惑目标。`,
      reasonPayload(reason),
      actor.seatId,
    );
    return continueAfterNightAction(state);
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("狼美人不能魅惑自己。");
  }

  state.night.wolfBeautyTargetSeatId = target.seatId;
  state.phase = nextNightPhaseAfterWolfBeauty(state);
  appendEvent(
    state,
    "WOLF_BEAUTY_CHARMED",
    "private",
    `${seatLabel(actor)} 魅惑了 ${seatLabel(target)}。`,
    { targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  return continueAfterNightAction(state);
}

function applySpeech(state: GameState, actorSeatId: number, message: string): GameState {
  assertPhase(state, "DAY_SPEECH");
  const actor = assertAlive(state, actorSeatId);
  const speakerSeatId = getCurrentSpeakerSeatId(state);
  if (speakerSeatId !== actor.seatId) {
    throw new Error("还没有轮到该座位发言。");
  }
  const cleanMessage = message.trim().slice(0, 800);
  if (!cleanMessage) {
    throw new Error("发言不能为空。");
  }

  state.speeches.push({ day: state.day, seatId: actor.seatId, message: cleanMessage });
  state.speechIndex += 1;
  state = appendEvent(
    state,
    "SPEECH_CREATED",
    "public",
    `${seatLabel(actor)}：${cleanMessage}`,
    { seatId: actor.seatId, message: cleanMessage },
    actor.seatId,
  );
  const speechEventSeq = state.events.at(-1)?.seq;
  state = recordPublicSpeechMemory(state, actor, cleanMessage, speechEventSeq);

  return touch(state);
}

function applyWhiteWolfKingExplode(
  state: GameState,
  actorSeatId: number,
  targetSeatId: number,
  reason?: string,
): GameState {
  assertPhase(state, "DAY_SPEECH");
  const actor = assertAliveRole(state, actorSeatId, "WHITE_WOLF_KING");
  const speakerSeatId = getCurrentSpeakerSeatId(state);
  if (speakerSeatId !== actor.seatId) {
    throw new Error("还没有轮到该白狼王行动。");
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("白狼王不能带走自己。");
  }

  killSeat(state, actor.seatId, "WHITE_WOLF_KING_EXPLODE");
  killSeat(state, target.seatId, "WHITE_WOLF_KING_SHOT");
  state.speechQueue = [];
  state.speechIndex = 0;
  state = appendEvent(
    state,
    "WHITE_WOLF_KING_EXPLODED",
    "public",
    `${seatLabel(actor)} 白狼王自爆，带走了 ${seatLabel(target)}。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
    { shooterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  triggerWolfBeautyCharmIfNeeded(state, target);
  return finishAfterDayDeaths(state);
}

function applyKnightDuel(
  state: GameState,
  actorSeatId: number,
  targetSeatId?: number,
  reason?: string,
): GameState {
  assertPhase(state, "KNIGHT_DUEL");
  const actor = assertAliveRole(state, actorSeatId, "KNIGHT");
  state.knight ??= { used: false };

  if (!targetSeatId) {
    state = appendEvent(
      state,
      "KNIGHT_DUEL_SKIPPED",
      "public",
      `${seatLabel(actor)} 没有发动骑士决斗。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
      reasonPayload(reason),
      actor.seatId,
    );
    return enterDayVote(state);
  }

  if (state.knight.used) {
    throw new Error("骑士已经发动过决斗。");
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("骑士不能决斗自己。");
  }

  state.knight.used = true;
  if (isWolfRole(target.role, state.rules.wolfRoles)) {
    killSeat(state, target.seatId, "KNIGHT_DUEL");
    state.speechQueue = [];
    state.speechIndex = 0;
    state.votes = {};
    state = appendEvent(
      state,
      "KNIGHT_DUEL_SUCCESS",
      "public",
      `${seatLabel(actor)} 发动骑士决斗，${seatLabel(target)} 是狼人阵营，${seatLabel(target)} 出局。${
        cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""
      }`,
      { knightSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
      actor.seatId,
    );
    triggerWolfBeautyCharmIfNeeded(state, target);
    return finishAfterDayDeaths(state);
  }

  killSeat(state, actor.seatId, "KNIGHT_DUEL_FAILED");
  state.speechQueue = [];
  state.speechIndex = 0;
  state.votes = {};
  state = appendEvent(
    state,
    "KNIGHT_DUEL_FAILED",
    "public",
    `${seatLabel(actor)} 发动骑士决斗，${seatLabel(target)} 不是狼人阵营，${seatLabel(actor)} 出局。${
      cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""
    }`,
    { knightSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  if (state.pendingSheriffHandoff?.fromSeatId === actor.seatId) {
    state.pendingSheriffHandoff.nextStep = "DAY_VOTE";
    return startSheriffHandoff(state);
  }
  const settled = settleWinOrContinue(state);
  if (settled.result) return settled;
  return enterDayVote(settled);
}

function applyLastWords(state: GameState, actorSeatId: number, message: string): GameState {
  assertPhase(state, "LAST_WORDS");
  if (state.lastWordsSeatId !== actorSeatId) {
    throw new Error("当前没有轮到该玩家发表遗言。");
  }

  const actor = getSeat(state, actorSeatId);
  const cleanMessage = message.trim().slice(0, 800);
  if (!cleanMessage) {
    throw new Error("遗言不能为空。");
  }

  state.speeches.push({ day: state.day, seatId: actor.seatId, message: cleanMessage });
  state = appendEvent(
    state,
    "LAST_WORDS_CREATED",
    "public",
    `${seatLabel(actor)} 遗言：${cleanMessage}`,
    { seatId: actor.seatId, message: cleanMessage },
    actor.seatId,
  );
  state.lastWordsSeatId = undefined;

  return finishAfterLastWords(state);
}

function recordPublicSpeechMemory(
  state: GameState,
  actor: Seat,
  cleanMessage: string,
  speechEventSeq: number | undefined,
): GameState {
  const validSeatIds = new Set(state.seats.map((seat) => seat.seatId));
  const claimDraft = extractRoleClaimFromSpeech({
    day: state.day,
    claimantSeatId: actor.seatId,
    message: cleanMessage,
    validSeatIds,
    sourceSpeechSeq: speechEventSeq,
    roleCard: actor.roleCard,
  });

  if (claimDraft) {
    state.roleClaims ??= [];
    const claim = upsertRoleClaim(state.roleClaims, claimDraft);
    state = appendEvent(
      state,
      "ROLE_CLAIMED",
      "public",
      describeRoleClaim(claim, seatLabel(actor)),
      {
        claimId: claim.id,
        claimantSeatId: claim.claimantSeatId,
        claimedRole: claim.claimedRole,
        strength: claim.strength,
        checks: claim.checks,
        sourceSpeechSeq: speechEventSeq,
      },
      actor.seatId,
    );
  }

  const stances = extractStancesFromSpeech({
    day: state.day,
    actorSeatId: actor.seatId,
    message: cleanMessage,
    validSeatIds,
    sourceSpeechSeq: speechEventSeq,
  });

  if (stances.length > 0) {
    state.stances ??= [];
    for (const stance of stances) {
      const target = getSeat(state, stance.targetSeatId);
      state.stances.push(stance);
      state = appendEvent(
        state,
        "STANCE_DECLARED",
        "public",
        describeStance(stance, seatLabel(actor), seatLabel(target)),
        {
          stanceId: stance.id,
          actorSeatId: stance.actorSeatId,
          targetSeatId: stance.targetSeatId,
          kind: stance.kind,
          targetRole: stance.targetRole,
          reason: stance.reason,
          sourceSpeechSeq: speechEventSeq,
        },
        actor.seatId,
      );
    }
  }

  return state;
}

function applyVote(state: GameState, actorSeatId: number, targetSeatId?: number, reason?: string): GameState {
  assertPhase(state, "DAY_VOTE");
  const actor = assertAlive(state, actorSeatId);
  if (!canSeatVote(state, actor.seatId)) {
    throw new Error("白痴翻牌后不能投票。");
  }
  if (hasVoted(state, actor.seatId)) {
    throw new Error("该玩家已经投过票。");
  }

  if (!targetSeatId) {
    state.votes[String(actor.seatId)] = null;
    state = appendEvent(
      state,
      "VOTE_CAST",
      "private",
      `${seatLabel(actor)} 已选择弃票。`,
      { voterSeatId: actor.seatId, abstained: true, ...reasonPayload(reason) },
      actor.seatId,
    );
  } else {
    const target = assertAlive(state, targetSeatId);
    if (actor.seatId === target.seatId) {
      throw new Error("不能投票给自己。");
    }
    if (isIdiotRevealed(state, target.seatId)) {
      throw new Error("白痴翻牌后不能作为放逐投票目标。");
    }
    state.votes[String(actor.seatId)] = target.seatId;
    state = appendEvent(
      state,
      "VOTE_CAST",
      "private",
      `${seatLabel(actor)} 已完成投票。`,
      { voterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
      actor.seatId,
    );
  }

  if (Object.keys(state.votes).length >= getDayVoters(state).length) {
    state.phase = "EXILE_RESOLUTION";
  }

  return touch(state);
}

function applySheriffNomination(state: GameState, actorSeatId: number, run: boolean, reason?: string): GameState {
  assertPhase(state, "SHERIFF_NOMINATION");
  const actor = assertAlive(state, actorSeatId);
  const sheriff = assertSheriffState(state);
  if (sheriff.nominationDecisions[String(actor.seatId)] !== undefined) {
    throw new Error("该玩家已经完成上警选择。");
  }

  sheriff.nominationDecisions[String(actor.seatId)] = run;
  if (run && !sheriff.candidates.includes(actor.seatId)) {
    sheriff.candidates.push(actor.seatId);
  }
  state = appendEvent(
    state,
    "SHERIFF_NOMINATED",
    "private",
    run ? `${seatLabel(actor)} 选择上警。` : `${seatLabel(actor)} 选择留在警下。`,
    { seatId: actor.seatId, run, ...reasonPayload(reason) },
    actor.seatId,
  );

  return getSheriffNominationActorId(state) ? touch(state) : continueAfterSheriffNomination(state);
}

function applySheriffSpeech(state: GameState, actorSeatId: number, message: string): GameState {
  if (state.phase !== "SHERIFF_SPEECH" && state.phase !== "SHERIFF_PK_SPEECH") {
    throw new Error(`当前阶段是 ${state.phase}，不能发表警长竞选发言。`);
  }
  const actor = assertAlive(state, actorSeatId);
  const speakerSeatId = getCurrentSheriffSpeakerSeatId(state);
  if (speakerSeatId !== actor.seatId) {
    throw new Error("还没有轮到该玩家发表警长竞选发言。");
  }

  const cleanMessage = message.trim().slice(0, 800);
  if (!cleanMessage) {
    throw new Error("发言不能为空。");
  }

  state.speeches.push({ day: state.day, seatId: actor.seatId, message: cleanMessage });
  state.sheriff!.speechIndex += 1;
  state = appendEvent(
    state,
    "SPEECH_CREATED",
    "public",
    `${seatLabel(actor)} 警长竞选发言：${cleanMessage}`,
    { seatId: actor.seatId, message: cleanMessage, sheriffSpeech: true },
    actor.seatId,
  );
  const speechEventSeq = state.events.at(-1)?.seq;
  state = recordPublicSpeechMemory(state, actor, cleanMessage, speechEventSeq);

  return touch(state);
}

function applySheriffWithdraw(state: GameState, actorSeatId: number, withdraw: boolean, reason?: string): GameState {
  assertPhase(state, "SHERIFF_WITHDRAWAL");
  const actor = assertAlive(state, actorSeatId);
  const sheriff = assertSheriffState(state);
  if (!sheriff.candidates.includes(actor.seatId)) {
    throw new Error("只有警上候选人可以退水。");
  }
  if (sheriff.withdrawalDecisions[String(actor.seatId)] !== undefined) {
    throw new Error("该玩家已经完成退水选择。");
  }

  sheriff.withdrawalDecisions[String(actor.seatId)] = withdraw;
  if (withdraw && !sheriff.withdrawnSeatIds.includes(actor.seatId)) {
    sheriff.withdrawnSeatIds.push(actor.seatId);
  }
  state = appendEvent(
    state,
    "SHERIFF_WITHDREW",
    withdraw ? "public" : "private",
    withdraw ? `${seatLabel(actor)} 选择退水。` : `${seatLabel(actor)} 留在警上。`,
    { seatId: actor.seatId, withdraw, ...reasonPayload(reason) },
    actor.seatId,
  );

  return getSheriffWithdrawalActorId(state) ? touch(state) : continueAfterSheriffWithdrawal(state);
}

function applySheriffVote(state: GameState, actorSeatId: number, targetSeatId?: number, reason?: string): GameState {
  if (state.phase !== "SHERIFF_VOTE" && state.phase !== "SHERIFF_PK_VOTE") {
    throw new Error(`当前阶段是 ${state.phase}，不能进行警长投票。`);
  }
  const actor = assertAlive(state, actorSeatId);
  const sheriff = assertSheriffState(state);
  if (Object.prototype.hasOwnProperty.call(sheriff.votes, String(actor.seatId))) {
    throw new Error("该玩家已经完成警长投票。");
  }

  const candidates = state.phase === "SHERIFF_PK_VOTE" ? sheriff.pkCandidates ?? [] : activeSheriffCandidates(state);
  const candidateSet = new Set(candidates);
  if (candidateSet.has(actor.seatId)) {
    throw new Error("候选人不能给自己所在的警长轮次投票。");
  }

  if (!targetSeatId) {
    sheriff.votes[String(actor.seatId)] = null;
    state = appendEvent(
      state,
      "SHERIFF_VOTE_CAST",
      "private",
      `${seatLabel(actor)} 警长投票选择弃票。`,
      { voterSeatId: actor.seatId, abstained: true, ...reasonPayload(reason) },
      actor.seatId,
    );
  } else {
    const target = assertAlive(state, targetSeatId);
    if (!candidateSet.has(target.seatId)) {
      throw new Error("警长投票只能投给当前候选人。");
    }
    sheriff.votes[String(actor.seatId)] = target.seatId;
    state = appendEvent(
      state,
      "SHERIFF_VOTE_CAST",
      "private",
      `${seatLabel(actor)} 完成警长投票。`,
      { voterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
      actor.seatId,
    );
  }

  return getSheriffVoteActorId(state) ? touch(state) : resolveSheriffVote(state, state.phase === "SHERIFF_PK_VOTE");
}

function applySheriffHandoff(state: GameState, actorSeatId: number, targetSeatId?: number, reason?: string): GameState {
  assertPhase(state, "SHERIFF_HANDOFF");
  const pending = state.pendingSheriffHandoff;
  if (!pending || pending.fromSeatId !== actorSeatId) {
    throw new Error("当前没有该玩家的警徽移交窗口。");
  }
  const actor = getSeat(state, actorSeatId);
  const sheriff = assertSheriffState(state);
  const nextStep = pending.nextStep;

  if (!targetSeatId) {
    sheriff.badgeHolderSeatId = undefined;
    state.pendingSheriffHandoff = undefined;
    state = appendEvent(
      state,
      "SHERIFF_BADGE_TORN",
      "public",
      `${seatLabel(actor)} 撕掉警徽。`,
      reasonPayload(reason),
      actor.seatId,
    );
    return continueAfterSheriffHandoff(state, nextStep);
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("不能把警徽移交给自己。");
  }
  sheriff.badgeHolderSeatId = target.seatId;
  state.pendingSheriffHandoff = undefined;
  state = appendEvent(
    state,
    "SHERIFF_BADGE_PASSED",
    "public",
    `${seatLabel(actor)} 将警徽移交给 ${seatLabel(target)}。`,
    { fromSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  return continueAfterSheriffHandoff(state, nextStep);
}

function applyHunterReveal(state: GameState, actorSeatId: number, reveal: boolean, reason?: string): GameState {
  assertPhase(state, "HUNTER_REVEAL");
  const pending = state.pendingHunterShot;
  if (!pending || pending.shooterSeatId !== actorSeatId) {
    throw new Error("当前没有该猎人的翻牌窗口。");
  }
  const actor = getSeat(state, actorSeatId);
  const cause = pending.cause;

  if (!reveal) {
    state.pendingHunterShot = undefined;
    state = appendEvent(
      state,
      "HUNTER_SKIPPED",
      "private",
      `${seatLabel(actor)} 选择不翻牌发动猎人技能。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
      { seatId: actor.seatId, reveal: false, ...reasonPayload(reason) },
      actor.seatId,
    );
    return continueLastWordsOrFinish(state, cause === "EXILED" ? "DAY_DEATHS" : "NIGHT_DEATHS");
  }

  state.phase = "HUNTER_SHOT";
  return touch(
    appendEvent(
      state,
      "HUNTER_REVEALED",
      "public",
      `${seatLabel(actor)} 翻牌为猎人，发动技能。`,
      { seatId: actor.seatId, cause, ...reasonPayload(reason) },
      actor.seatId,
    ),
  );
}

function applyHunterShot(state: GameState, actorSeatId: number, targetSeatId?: number, reason?: string): GameState {
  assertPhase(state, "HUNTER_SHOT");
  const pending = state.pendingHunterShot;
  if (!pending || pending.shooterSeatId !== actorSeatId) {
    throw new Error("当前没有该猎人的开枪窗口。");
  }
  const actor = getSeat(state, actorSeatId);
  const cause = pending.cause;

  if (!targetSeatId) {
    throw new Error("猎人翻牌后必须带走一名玩家。");
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("猎人不能带走自己。");
  }
  const targetKilled = killSeat(state, target.seatId, "HUNTER_SHOT");
  state.pendingHunterShot = undefined;
  state = appendEvent(
    state,
    "HUNTER_SHOT",
    "public",
    `${seatLabel(actor)} 开枪带走了 ${seatLabel(target)}。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
    { shooterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  if (cause === "EXILED") {
    triggerWolfBeautyCharmIfNeeded(state, target);
  }
  if (targetKilled) {
    queueLastWords(state, [target.seatId]);
    if (state.pendingWolfKingShot?.shooterSeatId === target.seatId) {
      state.lastWordsNextStep = cause === "EXILED" ? "DAY_DEATHS" : "NIGHT_DEATHS";
      state.phase = "WOLF_KING_SHOT";
      return touch(state);
    }
    return continueLastWordsOrFinish(state, cause === "EXILED" ? "DAY_DEATHS" : "NIGHT_DEATHS");
  }
  return cause === "EXILED" ? finishAfterDayDeaths(state) : finishAfterNightDeaths(state);
}

function applyWolfKingShot(state: GameState, actorSeatId: number, targetSeatId?: number, reason?: string): GameState {
  assertPhase(state, "WOLF_KING_SHOT");
  const pending = state.pendingWolfKingShot;
  if (!pending || pending.shooterSeatId !== actorSeatId) {
    throw new Error("当前没有该狼王的开枪窗口。");
  }
  const actor = getSeat(state, actorSeatId);
  if (actor.role !== "WOLF_KING") {
    throw new Error(`${seatLabel(actor)} 不是狼王。`);
  }
  const nextStep = pending.nextStep;

  if (!targetSeatId) {
    state.pendingWolfKingShot = undefined;
    state = appendEvent(
      state,
      "WOLF_KING_SKIPPED",
      "public",
      `${seatLabel(actor)} 没有发动狼王枪。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
      reasonPayload(reason),
      actor.seatId,
    );
    return continueLastWordsOrFinish(state, nextStep);
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("狼王不能带走自己。");
  }
  const targetKilled = killSeat(state, target.seatId, "WOLF_KING_SHOT");
  state.pendingWolfKingShot = undefined;
  state = appendEvent(
    state,
    "WOLF_KING_SHOT",
    "public",
    `${seatLabel(actor)} 发动狼王枪带走了 ${seatLabel(target)}。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
    { shooterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  if (nextStep === "DAY_DEATHS") {
    triggerWolfBeautyCharmIfNeeded(state, target);
  }
  if (targetKilled) {
    queueLastWords(state, [target.seatId]);
  }
  return continueLastWordsOrFinish(state, nextStep);
}

function enterDayAnnouncement(state: GameState): GameState {
  state.phase = "DAY_ANNOUNCEMENT";
  return hasDayStartedEvent(state) ? touch(state) : resolveNightToAnnouncement(state);
}

function continueFromDayAnnouncement(state: GameState): GameState {
  const announced = hasDayStartedEvent(state) ? state : resolveNightToAnnouncement(state);
  if (announced.pendingHunterShot) {
    announced.phase = "HUNTER_REVEAL";
    return touch(announced);
  }
  if (announced.pendingWolfKingShot) {
    announced.phase = "WOLF_KING_SHOT";
    return touch(announced);
  }
  return finishAfterNightDeaths(announced);
}

function startSheriffElectionOrDaySpeeches(state: GameState): GameState {
  if (!state.rules.hasSheriff || state.day !== 1 || state.sheriff?.resolved) {
    return startDaySpeeches(state);
  }

  state.sheriff ??= createInitialSheriffState();
  state.phase = "SHERIFF_NOMINATION";
  return touch(
    appendEvent(state, "SHERIFF_PHASE_STARTED", "public", "警长竞选开始，所有存活玩家选择是否上警。", {
      day: state.day,
    }),
  );
}

function continueAfterSheriffNomination(state: GameState): GameState {
  const sheriff = assertSheriffState(state);
  sheriff.candidates = activeSheriffCandidates(state);
  state = revealSheriffNominationResult(state);
  if (sheriff.candidates.length === 0) {
    return finishSheriffElection(state, "no candidates");
  }
  if (sheriff.candidates.length === 1) {
    return finishSheriffElection(state, "single candidate", sheriff.candidates[0]);
  }

  sheriff.speechQueue = [...sheriff.candidates];
  sheriff.speechIndex = 0;
  state.phase = "SHERIFF_SPEECH";
  return touch(
    appendEvent(state, "SHERIFF_PHASE_STARTED", "public", "警上发言开始。", {
      candidates: sheriff.candidates,
    }),
  );
}

function revealSheriffNominationResult(state: GameState): GameState {
  if (state.events.some((event) => event.type === "SHERIFF_NOMINATION_REVEALED" && event.day === state.day)) {
    return state;
  }

  const sheriff = assertSheriffState(state);
  const candidateSeatIds = [...sheriff.candidates].sort((a, b) => a - b);
  const offPoliceSeatIds = getAliveSeats(state)
    .map((seat) => seat.seatId)
    .filter((seatId) => sheriff.nominationDecisions[String(seatId)] === false)
    .sort((a, b) => a - b);
  const candidateText =
    candidateSeatIds.length > 0 ? `${candidateSeatIds.map((seatId) => `${seatId}号`).join("、")} 选择上警。` : "无人选择上警。";
  const offPoliceText =
    offPoliceSeatIds.length > 0 ? `警下玩家：${offPoliceSeatIds.map((seatId) => `${seatId}号`).join("、")}。` : "";

  return appendEvent(
    state,
    "SHERIFF_NOMINATION_REVEALED",
    "public",
    [candidateText, offPoliceText].filter(Boolean).join(" "),
    { candidateSeatIds, offPoliceSeatIds },
  );
}

function continueAfterSheriffWithdrawal(state: GameState): GameState {
  const sheriff = assertSheriffState(state);
  const remaining = activeSheriffCandidates(state);
  if (remaining.length === 0) {
    return finishSheriffElection(state, "all withdrawn");
  }
  if (remaining.length === 1) {
    return finishSheriffElection(state, "single candidate after withdrawal", remaining[0]);
  }

  sheriff.votes = {};
  state.phase = "SHERIFF_VOTE";
  return touch(
    appendEvent(state, "SHERIFF_PHASE_STARTED", "public", "警下投票开始。", {
      candidates: remaining,
    }),
  );
}

function resolveSheriffVote(state: GameState, isPk: boolean): GameState {
  const sheriff = assertSheriffState(state);
  const totals = new Map<number, number>();
  for (const targetSeatId of Object.values(sheriff.votes)) {
    if (typeof targetSeatId !== "number") continue;
    totals.set(targetSeatId, (totals.get(targetSeatId) ?? 0) + 1);
  }

  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  state = revealSheriffVoteTally(state, ranked, isPk);
  if (ranked.length === 0) {
    return finishSheriffElection(state, "no sheriff votes");
  }

  const [topSeatId, topVotes] = ranked[0];
  const tied = ranked.filter(([, votes]) => votes === topVotes).map(([seatId]) => seatId);
  if (tied.length === 1) {
    return finishSheriffElection(state, "vote winner", topSeatId);
  }

  if (isPk) {
    return finishSheriffElection(state, "pk tied");
  }

  sheriff.pkCandidates = tied;
  sheriff.speechQueue = [...tied];
  sheriff.speechIndex = 0;
  sheriff.votes = {};
  state.phase = "SHERIFF_PK_SPEECH";
  return touch(
    appendEvent(state, "SHERIFF_PK_STARTED", "public", "警长投票平票，进入 PK 发言。", {
      tiedSeatIds: tied,
      votes: topVotes,
    }),
  );
}

function finishSheriffElection(state: GameState, reason: string, winnerSeatId?: number): GameState {
  const sheriff = assertSheriffState(state);
  sheriff.resolved = true;
  sheriff.badgeHolderSeatId = winnerSeatId;
  sheriff.votes = {};
  sheriff.speechQueue = [];
  sheriff.speechIndex = 0;

  if (winnerSeatId) {
    const winner = getSeat(state, winnerSeatId);
    state = appendEvent(
      state,
      "SHERIFF_ELECTED",
      "public",
      `${seatLabel(winner)} 当选警长。`,
      { seatId: winnerSeatId, reason },
    );
  } else {
    state = appendEvent(state, "SHERIFF_SKIPPED", "public", "本局没有产生警长。", { reason });
  }

  return startDaySpeeches(state);
}

function revealSheriffVoteTally(state: GameState, ranked: Array<[number, number]>, isPk: boolean): GameState {
  const tally = ranked.map(([seatId, votes]) => ({
    targetSeatId: seatId,
    targetName: `${seatId}号`,
    votes,
  }));
  const sheriff = assertSheriffState(state);
  const abstainCount = Object.values(sheriff.votes).filter((targetSeatId) => targetSeatId == null).length;
  const tallyText =
    tally.length > 0 ? tally.map((item) => `${item.targetName} ${formatVoteCount(item.votes)}票`).join("，") : "无有效票";
  const abstainText = abstainCount > 0 ? `，弃票 ${abstainCount}票` : "";
  return appendEvent(
    state,
    "SHERIFF_VOTE_REVEALED",
    "public",
    `${isPk ? "警长 PK 投票" : "警长投票"}结束：${tallyText}${abstainText}。`,
    { tally, abstainCount, isPk },
  );
}

function hasDayStartedEvent(state: GameState): boolean {
  return state.events.some((event) => event.type === "DAY_STARTED" && event.day === state.day);
}

function resolveNightToAnnouncement(state: GameState): GameState {
  const deaths: number[] = [];
  const wolfTarget = state.night.wolfTargetSeatId;
  const guardedWolfTarget = wolfTarget !== undefined && state.night.guardTargetSeatId === wolfTarget;
  const savedWolfTarget = wolfTarget !== undefined && state.night.witchSavedSeatId === wolfTarget;
  const guardWitchConflict =
    Boolean(wolfTarget) && guardedWolfTarget && savedWolfTarget && state.rules.guardSaveConflictKills;
  if (wolfTarget && ((!guardedWolfTarget && !savedWolfTarget) || guardWitchConflict)) {
    if (killSeat(state, wolfTarget, "WOLF_KILL")) {
      deaths.push(wolfTarget);
    }
  }

  const poisonTarget = state.night.witchPoisonTargetSeatId;
  if (poisonTarget && getSeat(state, poisonTarget).alive) {
    if (killSeat(state, poisonTarget, "WITCH_POISON")) {
      deaths.push(poisonTarget);
    }
  }

  const message =
    deaths.length === 0
      ? `第${state.day}天清晨，昨夜平安夜。`
      : `第${state.day}天清晨，${deaths.map((seatId) => `${seatId}号`).join("、")} 死亡。`;

  state.phase = "DAY_ANNOUNCEMENT";
  state = appendEvent(state, "DAY_STARTED", "public", message, { deadSeatIds: deaths });
  return touch(state);
}

function resolveVote(state: GameState): GameState {
  const totals = new Map<number, number>();
  for (const [voterSeatId, targetSeatId] of Object.entries(state.votes)) {
    if (typeof targetSeatId !== "number") continue;
    totals.set(targetSeatId, (totals.get(targetSeatId) ?? 0) + getVoteWeight(state, Number(voterSeatId)));
  }

  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  state = revealVoteTally(state, ranked);
  if (ranked.length === 0) {
    state = appendEvent(
      state,
      "VOTE_TIED",
      "public",
      "投票没有有效放逐票，今日无人放逐。",
      { tiedSeatIds: [], votes: 0 },
    );
    return startNextNight(state);
  }

  const [topSeatId, topVotes] = ranked[0];
  const tied = ranked.filter(([, votes]) => votes === topVotes);
  if (tied.length > 1) {
    state = appendEvent(
      state,
      "VOTE_TIED",
      "public",
      "投票平票，今日无人放逐。",
      { tiedSeatIds: tied.map(([seatId]) => seatId), votes: topVotes },
    );
    return startNextNight(state);
  }

  const exiled = getSeat(state, topSeatId);
  if (exiled.role === "IDIOT" && !isIdiotRevealed(state, exiled.seatId)) {
    state.idiot ??= { revealedSeatIds: [] };
    state.idiot.revealedSeatIds = [...new Set([...state.idiot.revealedSeatIds, exiled.seatId])];
    state = appendEvent(
      state,
      "IDIOT_REVEALED",
      "public",
      `${seatLabel(exiled)} 是白痴，翻牌免死，之后失去投票权。`,
      { seatId: exiled.seatId },
      exiled.seatId,
    );
    return startNextNight(state);
  }

  killSeat(state, topSeatId, "EXILED");
  state = appendEvent(
    state,
    "PLAYER_EXILED",
    "public",
    `${seatLabel(exiled)} 被放逐出局。`,
    { seatId: topSeatId },
  );
  triggerWolfBeautyCharmIfNeeded(state, exiled);

  if (state.pendingHunterShot?.cause === "EXILED" && state.pendingHunterShot.shooterSeatId === topSeatId) {
    queueLastWords(state, [topSeatId]);
    state.lastWordsNextStep = "DAY_DEATHS";
    state.phase = "HUNTER_REVEAL";
    return touch(state);
  }

  if (state.pendingWolfKingShot?.cause === "EXILED" && state.pendingWolfKingShot.shooterSeatId === topSeatId) {
    queueLastWords(state, [topSeatId]);
    state.lastWordsNextStep = "DAY_DEATHS";
    state.phase = "WOLF_KING_SHOT";
    return touch(state);
  }

  return startLastWords(state, [topSeatId], "DAY_DEATHS");
}

function finishAfterNightDeaths(state: GameState): GameState {
  const settled = settleWinOrContinue(state);
  if (settled.result) return settled;
  if (settled.pendingSheriffHandoff) return startSheriffHandoff(settled);
  return startSheriffElectionOrDaySpeeches(settled);
}

function finishAfterDayDeaths(state: GameState): GameState {
  const settled = settleWinOrContinue(state);
  if (settled.result) return settled;
  if (settled.pendingSheriffHandoff) return startSheriffHandoff(settled);
  return startNextNight(settled);
}

function finishAfterLastWords(state: GameState): GameState {
  const nextStep = state.lastWordsNextStep ?? "DAY_DEATHS";
  state.lastWordsSeatId = undefined;
  return continueLastWordsOrFinish(state, nextStep);
}

function startLastWords(state: GameState, seatIds: number[], nextStep: "DAY_DEATHS" | "NIGHT_DEATHS"): GameState {
  queueLastWords(state, seatIds);
  return continueLastWordsOrFinish(state, nextStep);
}

function startSheriffHandoff(state: GameState): GameState {
  state.phase = "SHERIFF_HANDOFF";
  return touch(state);
}

function continueAfterSheriffHandoff(
  state: GameState,
  nextStep: "DAY_DEATHS" | "NIGHT_DEATHS" | "DAY_VOTE",
): GameState {
  if (nextStep === "DAY_VOTE") {
    return enterDayVote(state);
  }
  return nextStep === "DAY_DEATHS" ? finishAfterDayDeaths(state) : finishAfterNightDeaths(state);
}

function enterKnightDuelOrDayVote(state: GameState): GameState {
  if (shouldOfferKnightDuel(state)) {
    state.phase = "KNIGHT_DUEL";
    state.votes = {};
    return touch(state);
  }
  return enterDayVote(state);
}

function enterDayVote(state: GameState): GameState {
  if (state.result) return state;
  state.phase = "DAY_VOTE";
  state.votes = {};
  return touch(state);
}

function shouldOfferKnightDuel(state: GameState): boolean {
  return Boolean(state.rules.hasKnight && !state.knight?.used && hasAliveRole(state, "KNIGHT"));
}

function nextNightPhaseAfterWolves(state: GameState): Phase {
  return state.rules.hasWolfBeauty && hasAliveRole(state, "WOLF_BEAUTY") ? "NIGHT_WOLF_BEAUTY" : nextNightPhaseAfterWolfBeauty(state);
}

function nextNightPhaseAfterWolfBeauty(state: GameState): Phase {
  return hasRoleInGame(state, "GUARD") ? "NIGHT_GUARD" : nextNightPhaseAfterGuard(state);
}

function nextNightPhaseAfterGuard(state: GameState): Phase {
  return hasRoleInGame(state, "SEER") ? "NIGHT_SEER" : nextNightPhaseAfterSeer(state);
}

function nextNightPhaseAfterSeer(state: GameState): Phase {
  return hasRoleInGame(state, "WITCH") ? "NIGHT_WITCH" : "DAY_ANNOUNCEMENT";
}

function continueAfterNightAction(state: GameState): GameState {
  return state.phase === "DAY_ANNOUNCEMENT" ? enterDayAnnouncement(state) : touch(state);
}

function hasRoleInGame(state: GameState, role: Role): boolean {
  return state.seats.some((seat) => seat.role === role);
}

function hasAliveRole(state: GameState, role: Role): boolean {
  return getAliveSeats(state).some((seat) => seat.role === role);
}

function triggerWolfBeautyCharmIfNeeded(state: GameState, deadSeat: Seat): boolean {
  if (deadSeat.role !== "WOLF_BEAUTY") return false;
  const targetSeatId = state.night.wolfBeautyTargetSeatId;
  if (!targetSeatId || targetSeatId === deadSeat.seatId) return false;
  const target = getSeat(state, targetSeatId);
  if (!target.alive) return false;

  const killed = killSeat(state, target.seatId, "WOLF_BEAUTY_CHARM");
  if (!killed) return false;
  appendEvent(
    state,
    "WOLF_BEAUTY_CHARM_TRIGGERED",
    "public",
    `${seatLabel(deadSeat)} 狼美人出局，魅惑目标 ${seatLabel(target)} 殉情出局。`,
    { wolfBeautySeatId: deadSeat.seatId, targetSeatId: target.seatId },
    deadSeat.seatId,
  );
  return true;
}

function queueLastWords(state: GameState, seatIds: number[]): void {
  const queued = state.lastWordsQueue ? [...state.lastWordsQueue] : [];
  const seen = new Set<number>([
    ...(state.lastWordsSeatId ? [state.lastWordsSeatId] : []),
    ...queued,
  ]);
  for (const seatId of seatIds) {
    if (seen.has(seatId)) continue;
    queued.push(seatId);
    seen.add(seatId);
  }
  state.lastWordsQueue = queued.length > 0 ? queued : undefined;
}

function continueLastWordsOrFinish(state: GameState, nextStep: "DAY_DEATHS" | "NIGHT_DEATHS"): GameState {
  state.lastWordsNextStep = nextStep;
  const [nextSeatId, ...remaining] = state.lastWordsQueue ?? [];
  if (nextSeatId) {
    state.lastWordsSeatId = nextSeatId;
    state.lastWordsQueue = remaining.length > 0 ? remaining : undefined;
    state.phase = "LAST_WORDS";
    return touch(state);
  }

  state.lastWordsSeatId = undefined;
  state.lastWordsQueue = undefined;
  state.lastWordsNextStep = undefined;
  if (nextStep === "NIGHT_DEATHS") {
    return finishAfterNightDeaths(state);
  }
  return finishAfterDayDeaths(state);
}

function startDaySpeeches(state: GameState): GameState {
  state.phase = "DAY_SPEECH";
  state.speechQueue = getAliveSeats(state).map((seat) => seat.seatId);
  state.speechIndex = 0;
  return touch(state);
}

function startNextNight(state: GameState): GameState {
  const settled = settleWinOrContinue(state);
  if (settled.result) {
    return settled;
  }
  settled.day += 1;
  settled.phase = "NIGHT_WOLVES";
  settled.night = {};
  settled.votes = {};
  settled.lastWordsSeatId = undefined;
  settled.lastWordsQueue = undefined;
  settled.lastWordsNextStep = undefined;
  settled.speechQueue = [];
  settled.speechIndex = 0;
  return touch(
    appendEvent(settled, "NIGHT_STARTED", "public", `天黑请闭眼。第${settled.day}夜开始，狼人请行动。`, {
      day: settled.day,
    }),
  );
}

function revealVoteTally(state: GameState, ranked: Array<[number, number]>): GameState {
  const tally = ranked.map(([seatId, votes]) => ({
    targetSeatId: seatId,
    targetName: `${seatId}号`,
    votes,
  }));
  const abstainCount = Object.values(state.votes).filter((targetSeatId) => targetSeatId == null).length;
  const tallyText =
    tally.length > 0 ? tally.map((item) => `${item.targetName} ${formatVoteCount(item.votes)}票`).join("，") : "无有效放逐票";
  const abstainText = abstainCount > 0 ? `，弃票 ${formatVoteCount(abstainCount)}票` : "";
  return appendEvent(
    state,
    "VOTE_REVEALED",
    "public",
    `投票结束：${tallyText}${abstainText}。`,
    { tally, abstainCount },
  );
}

function settleWinOrContinue(state: GameState): GameState {
  const result = evaluateWinCondition(state);
  if (!result) {
    return touch(state);
  }
  state.result = result;
  state.phase = "GAME_OVER";
  return touch(
    appendEvent(
      state,
      "GAME_ENDED",
      "public",
      `${result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：${result.reason}。`,
      result,
    ),
  );
}

function getActorSeatId(state: GameState): number | undefined {
  switch (state.phase) {
    case "NIGHT_WOLVES": {
      const wolves = getAliveSeats(state).filter((seat) => isWolfRole(seat.role, state.rules.wolfRoles));
      return wolves.find((seat) => !seat.isAi)?.seatId ?? wolves[0]?.seatId;
    }
    case "NIGHT_WOLF_BEAUTY":
      return getAliveSeats(state).find((seat) => seat.role === "WOLF_BEAUTY")?.seatId;
    case "NIGHT_GUARD":
      return getAliveSeats(state).find((seat) => seat.role === "GUARD")?.seatId;
    case "NIGHT_SEER":
      return getAliveSeats(state).find((seat) => seat.role === "SEER")?.seatId;
    case "NIGHT_WITCH": {
      const witch = getAliveSeats(state).find((seat) => seat.role === "WITCH");
      if (!witch || (!state.witch.antidoteAvailable && !state.witch.poisonAvailable)) {
        return undefined;
      }
      return witch.seatId;
    }
    case "DAY_SPEECH":
      return getCurrentSpeakerSeatId(state);
    case "KNIGHT_DUEL":
      return getAliveSeats(state).find((seat) => seat.role === "KNIGHT")?.seatId;
    case "DAY_VOTE": {
      const voters = getDayVoters(state).filter((seat) => !hasVoted(state, seat.seatId));
      return preferHumanSeat(voters)?.seatId;
    }
    case "LAST_WORDS":
      return state.lastWordsSeatId;
    case "HUNTER_REVEAL":
    case "HUNTER_SHOT":
      return state.pendingHunterShot?.shooterSeatId;
    case "WOLF_KING_SHOT":
      return state.pendingWolfKingShot?.shooterSeatId;
    case "SHERIFF_NOMINATION":
      return getSheriffNominationActorId(state);
    case "SHERIFF_SPEECH":
    case "SHERIFF_PK_SPEECH":
      return getCurrentSheriffSpeakerSeatId(state);
    case "SHERIFF_WITHDRAWAL":
      return getSheriffWithdrawalActorId(state);
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE":
      return getSheriffVoteActorId(state);
    case "SHERIFF_HANDOFF":
      return state.pendingSheriffHandoff?.fromSeatId;
    default:
      return undefined;
  }
}

function getCurrentSheriffSpeakerSeatId(state: GameState): number | undefined {
  const sheriff = state.sheriff;
  if (!sheriff || (state.phase !== "SHERIFF_SPEECH" && state.phase !== "SHERIFF_PK_SPEECH")) {
    return undefined;
  }

  let index = sheriff.speechIndex;
  while (index < sheriff.speechQueue.length) {
    const seatId = sheriff.speechQueue[index];
    if (getSeat(state, seatId).alive) {
      return seatId;
    }
    index += 1;
  }

  return undefined;
}

function getSheriffNominationActorId(state: GameState): number | undefined {
  if (state.phase !== "SHERIFF_NOMINATION") return undefined;
  const sheriff = assertSheriffState(state);
  const pending = getAliveSeats(state).filter((seat) => sheriff.nominationDecisions[String(seat.seatId)] === undefined);
  return preferHumanSeat(pending)?.seatId;
}

function getSheriffWithdrawalActorId(state: GameState): number | undefined {
  if (state.phase !== "SHERIFF_WITHDRAWAL") return undefined;
  const sheriff = assertSheriffState(state);
  const pending = activeSheriffCandidates(state)
    .filter((seatId) => sheriff.withdrawalDecisions[String(seatId)] === undefined)
    .map((seatId) => getSeat(state, seatId));
  return preferHumanSeat(pending)?.seatId;
}

function getSheriffVoteActorId(state: GameState): number | undefined {
  if (state.phase !== "SHERIFF_VOTE" && state.phase !== "SHERIFF_PK_VOTE") return undefined;
  const sheriff = assertSheriffState(state);
  const candidates = state.phase === "SHERIFF_PK_VOTE" ? sheriff.pkCandidates ?? [] : activeSheriffCandidates(state);
  const candidateSet = new Set(candidates);
  const voters = getAliveSeats(state).filter(
    (seat) => !candidateSet.has(seat.seatId) && !Object.prototype.hasOwnProperty.call(sheriff.votes, String(seat.seatId)),
  );
  return voters.find((seat) => !seat.isAi)?.seatId ?? voters[0]?.seatId;
}

function activeSheriffCandidates(state: GameState): number[] {
  const sheriff = assertSheriffState(state);
  const withdrawn = new Set(sheriff.withdrawnSeatIds);
  return sheriff.candidates.filter((seatId) => !withdrawn.has(seatId) && getSeat(state, seatId).alive);
}

function preferHumanSeat(seats: Seat[]): Seat | undefined {
  return seats.find((seat) => !seat.isAi) ?? seats[0];
}

function assertSheriffState(state: GameState): NonNullable<GameState["sheriff"]> {
  if (!state.sheriff) {
    throw new Error("本局没有警长流程。");
  }
  return state.sheriff;
}

function createInitialSheriffState(): NonNullable<GameState["sheriff"]> {
  return {
    candidates: [],
    nominationDecisions: {},
    withdrawnSeatIds: [],
    withdrawalDecisions: {},
    votes: {},
    speechQueue: [],
    speechIndex: 0,
    resolved: false,
  };
}

function normalizeSheriffState(state: GameState["sheriff"]): NonNullable<GameState["sheriff"]> {
  return {
    ...createInitialSheriffState(),
    ...state,
    candidates: state?.candidates ?? [],
    nominationDecisions: state?.nominationDecisions ?? {},
    withdrawnSeatIds: state?.withdrawnSeatIds ?? [],
    withdrawalDecisions: state?.withdrawalDecisions ?? {},
    votes: state?.votes ?? {},
    speechQueue: state?.speechQueue ?? [],
    speechIndex: state?.speechIndex ?? 0,
    resolved: state?.resolved ?? false,
  };
}

function hasVoted(state: GameState, seatId: number): boolean {
  return Object.prototype.hasOwnProperty.call(state.votes, String(seatId));
}

function getDayVoters(state: GameState): Seat[] {
  return getAliveSeats(state).filter((seat) => canSeatVote(state, seat.seatId));
}

function getVoteWeight(state: GameState, voterSeatId: number): number {
  return state.sheriff?.badgeHolderSeatId === voterSeatId && getSeat(state, voterSeatId).alive
    ? state.rules.sheriffVoteWeight
    : 1;
}

function formatVoteCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function killSeat(state: GameState, seatId: number, reason: DeathReason): boolean {
  const seat = getSeat(state, seatId);
  if (!seat.alive) {
    return false;
  }
  seat.alive = false;
  seat.deathReason = reason;

  if (seat.role === "HUNTER" && (reason === "WOLF_KILL" || reason === "EXILED")) {
    state.pendingHunterShot = {
      shooterSeatId: seat.seatId,
      cause: reason,
    };
  }

  if (seat.role === "WOLF_KING" && (reason === "EXILED" || reason === "HUNTER_SHOT")) {
    state.pendingWolfKingShot = {
      shooterSeatId: seat.seatId,
      cause: reason,
      nextStep: reason === "HUNTER_SHOT" && state.pendingHunterShot?.cause === "WOLF_KILL" ? "NIGHT_DEATHS" : "DAY_DEATHS",
    };
  }

  if (state.sheriff?.badgeHolderSeatId === seat.seatId) {
    state.pendingSheriffHandoff = {
      fromSeatId: seat.seatId,
      nextStep:
        reason === "WOLF_KILL" || reason === "WITCH_POISON"
          ? "NIGHT_DEATHS"
          : reason === "KNIGHT_DUEL_FAILED"
            ? "DAY_VOTE"
            : "DAY_DEATHS",
    };
  }

  appendEvent(state, "PLAYER_DIED", "public", `${seatLabel(seat)} 出局。`, {
    seatId,
    deathReason: reason,
    publicReason: reason === "EXILED" ? "exiled" : "dead",
  });
  return true;
}

function assertPhase(state: GameState, phase: Phase): void {
  if (state.phase !== phase) {
    throw new Error(`当前阶段是 ${state.phase}，不能执行该动作。`);
  }
}

function assertAlive(state: GameState, seatId: number): Seat {
  const seat = getSeat(state, seatId);
  if (!seat.alive) {
    throw new Error(`${seatLabel(seat)} 已经出局。`);
  }
  return seat;
}

function assertAliveWolfRole(state: GameState, seatId: number): Seat {
  const seat = assertAlive(state, seatId);
  if (!isWolfRole(seat.role, state.rules.wolfRoles)) {
    throw new Error(`${seatLabel(seat)} 不是狼人阵营角色。`);
  }
  return seat;
}

function assertAliveRole(state: GameState, seatId: number, role: Role): Seat {
  const seat = assertAlive(state, seatId);
  if (seat.role !== role) {
    throw new Error(`${seatLabel(seat)} 不是 ${ROLE_LABELS[role]}。`);
  }
  return seat;
}

function appendEvent(
  state: GameState,
  type: GameEventType,
  visibility: Visibility,
  message: string,
  payload: Record<string, unknown>,
  actorSeatId?: number,
): GameState {
  state.events.push({
    seq: state.events.length + 1,
    type,
    visibility,
    day: state.day,
    phase: state.phase,
    actorSeatId,
    message,
    payload,
  });
  return state;
}

function touch(state: GameState): GameState {
  state.updatedAt = new Date().toISOString();
  return state;
}

function reasonPayload(reason: string | undefined): Record<string, string> {
  const reasonText = cleanReason(reason);
  return reasonText ? { reason: reasonText } : {};
}

function cleanReason(reason: string | undefined): string | undefined {
  const clean = reason?.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, 90) : undefined;
}

function cloneState(state: GameState): GameState {
  return hydrateGameState(JSON.parse(JSON.stringify(state)) as GameState);
}

function shuffle<T>(items: T[], seed?: number | string): T[] {
  const copy = [...items];
  const random = seed === undefined ? Math.random : seededRandom(seed);

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function seededRandom(seed: number | string): () => number {
  let value = typeof seed === "number" ? seed : hashSeed(seed);
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

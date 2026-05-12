import { randomUUID } from "node:crypto";
import { ROLE_LABELS } from "./labels";
import { getAiPersonaForSeat } from "./personas";
import type {
  Camp,
  Command,
  DeathReason,
  GameEventType,
  GameResult,
  GameState,
  Phase,
  Role,
  Seat,
  TurnRequirement,
  Visibility,
} from "./types";

const ROLE_DECK: Role[] = [
  "WEREWOLF",
  "WEREWOLF",
  "WEREWOLF",
  "VILLAGER",
  "VILLAGER",
  "VILLAGER",
  "SEER",
  "WITCH",
  "HUNTER",
];

type CreateGameOptions = {
  id?: string;
  humanSeatId?: number;
  seed?: number | string;
};

export function createGame(options: CreateGameOptions = {}): GameState {
  const id = options.id ?? randomUUID();
  const humanSeatId = options.humanSeatId ?? 1;
  const now = new Date().toISOString();
  const roles = shuffle(ROLE_DECK, options.seed);
  const seats: Seat[] = roles.map((role, index) => {
    const seatId = index + 1;
    return {
      seatId,
      name: seatId === humanSeatId ? "你" : `${seatId}号 AI`,
      isAi: seatId !== humanSeatId,
      role,
      alive: true,
      persona: seatId === humanSeatId ? undefined : getAiPersonaForSeat(seatId),
    };
  });

  let state: GameState = {
    id,
    day: 1,
    phase: "NIGHT_WOLVES",
    humanSeatId,
    seats,
    events: [],
    night: {},
    witch: {
      antidoteAvailable: true,
      poisonAvailable: true,
    },
    seerChecks: [],
    speeches: [],
    speechQueue: [],
    speechIndex: 0,
    votes: {},
    createdAt: now,
    updatedAt: now,
  };

  state = appendEvent(state, "GAME_CREATED", "system", "9人预女猎对局已创建。", {
    humanSeatId,
  });

  for (const seat of seats) {
    state = appendEvent(
      state,
      "ROLE_ASSIGNED",
      "private",
      `${seat.name} 的身份是 ${ROLE_LABELS[seat.role]}。`,
      { seatId: seat.seatId, role: seat.role },
      seat.seatId,
    );
  }

  state = appendEvent(state, "NIGHT_STARTED", "public", "第1夜开始。", {
    day: 1,
  });

  return state;
}

export function applyCommand(state: GameState, command: Command): GameState {
  const next = cloneState(state);
  if (next.result) {
    throw new Error("游戏已经结束。");
  }

  switch (command.type) {
    case "wolfKill":
      return applyWolfKill(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "seerCheck":
      return applySeerCheck(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "witchAction":
      return applyWitchAction(next, command.actorSeatId, command.mode, command.targetSeatId, command.reason);
    case "speak":
      return applySpeech(next, command.actorSeatId, command.message);
    case "vote":
      return applyVote(next, command.actorSeatId, command.targetSeatId, command.reason);
    case "hunterShoot":
      return applyHunterShot(next, command.actorSeatId, command.targetSeatId, command.reason);
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
    case "NIGHT_SEER":
      next.phase = "NIGHT_WITCH";
      return touch(
        appendEvent(next, "ROLE_PHASE_SKIPPED", "system", "预言家已出局，查验阶段跳过。", {
          role: "SEER",
        }),
      );
    case "NIGHT_WITCH":
      next.phase = "DAY_ANNOUNCEMENT";
      return touch(
        appendEvent(next, "ROLE_PHASE_SKIPPED", "system", "女巫无法行动，女巫阶段跳过。", {
          role: "WITCH",
        }),
      );
    case "DAY_ANNOUNCEMENT":
      return resolveNight(next);
    case "DAY_SPEECH":
      next.phase = "DAY_VOTE";
      next.votes = {};
      return touch(next);
    case "DAY_VOTE":
      next.phase = "EXILE_RESOLUTION";
      return touch(next);
    case "EXILE_RESOLUTION":
      return resolveVote(next);
    case "HUNTER_SHOT":
      return next.pendingHunterShot?.cause === "EXILED" ? finishAfterDayDeaths(next) : finishAfterNightDeaths(next);
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
  const wolves = alive.filter((seat) => seat.role === "WEREWOLF").length;
  const villagers = alive.filter((seat) => seat.role === "VILLAGER").length;
  const gods = alive.filter(
    (seat) => seat.role === "SEER" || seat.role === "WITCH" || seat.role === "HUNTER",
  ).length;

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

export function getSeat(state: GameState, seatId: number): Seat {
  const seat = state.seats.find((item) => item.seatId === seatId);
  if (!seat) {
    throw new Error(`座位 ${seatId} 不存在。`);
  }
  return seat;
}

export function getCamp(role: Role): Camp {
  return role === "WEREWOLF" ? "WEREWOLVES" : "GOOD";
}

function applyWolfKill(state: GameState, actorSeatId: number, targetSeatId: number, reason?: string): GameState {
  assertPhase(state, "NIGHT_WOLVES");
  const actor = assertAliveRole(state, actorSeatId, "WEREWOLF");
  const target = assertAlive(state, targetSeatId);
  if (target.role === "WEREWOLF") {
    throw new Error("狼人不能选择狼队友作为刀口。");
  }
  state.night.wolfTargetSeatId = target.seatId;
  state.phase = "NIGHT_SEER";
  return touch(
    appendEvent(
      state,
      "NIGHT_KILL_SELECTED",
      "private",
      `${actor.name} 选择夜间击杀 ${target.name}。`,
      { targetSeatId: target.seatId, ...reasonPayload(reason) },
      actor.seatId,
    ),
  );
}

function applySeerCheck(state: GameState, actorSeatId: number, targetSeatId: number, reason?: string): GameState {
  assertPhase(state, "NIGHT_SEER");
  const actor = assertAliveRole(state, actorSeatId, "SEER");
  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("预言家不能查验自己。");
  }

  const result = target.role === "WEREWOLF" ? "WEREWOLF" : "GOOD";
  state.seerChecks.push({
    day: state.day,
    seerSeatId: actor.seatId,
    targetSeatId: target.seatId,
    result,
  });
  state.phase = "NIGHT_WITCH";

  return touch(
    appendEvent(
      state,
      "SEER_CHECKED",
      "private",
      `你查验了 ${target.name}，结果是 ${result === "WEREWOLF" ? "狼人" : "好人"}。`,
      { targetSeatId: target.seatId, result, ...reasonPayload(reason) },
      actor.seatId,
    ),
  );
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
    state.witch.antidoteAvailable = false;
    state.night.witchSavedSeatId = state.night.wolfTargetSeatId;
    state.phase = "DAY_ANNOUNCEMENT";
    return touch(
      appendEvent(
        state,
        "WITCH_USED_ANTIDOTE",
        "private",
        `${actor.name} 使用了解药。`,
        { targetSeatId: state.night.witchSavedSeatId, ...reasonPayload(reason) },
        actor.seatId,
      ),
    );
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
    return touch(
      appendEvent(
        state,
        "WITCH_USED_POISON",
        "private",
        `${actor.name} 对 ${target.name} 使用了毒药。`,
        { targetSeatId: target.seatId, ...reasonPayload(reason) },
        actor.seatId,
      ),
    );
  }

  state.phase = "DAY_ANNOUNCEMENT";
  return touch(
    appendEvent(state, "WITCH_SKIPPED", "private", `${actor.name} 没有使用药。`, reasonPayload(reason), actor.seatId),
  );
}

function applySpeech(state: GameState, actorSeatId: number, message: string): GameState {
  assertPhase(state, "DAY_SPEECH");
  const actor = assertAlive(state, actorSeatId);
  const speakerSeatId = getCurrentSpeakerSeatId(state);
  if (speakerSeatId !== actor.seatId) {
    throw new Error("还没有轮到该座位发言。");
  }
  const cleanMessage = message.trim().slice(0, 240);
  if (!cleanMessage) {
    throw new Error("发言不能为空。");
  }

  state.speeches.push({ day: state.day, seatId: actor.seatId, message: cleanMessage });
  state.speechIndex += 1;
  state = appendEvent(
    state,
    "SPEECH_CREATED",
    "public",
    `${actor.name}：${cleanMessage}`,
    { seatId: actor.seatId, message: cleanMessage },
    actor.seatId,
  );

  if (!getCurrentSpeakerSeatId(state)) {
    state.phase = "DAY_VOTE";
    state.votes = {};
  }

  return touch(state);
}

function applyVote(state: GameState, actorSeatId: number, targetSeatId: number, reason?: string): GameState {
  assertPhase(state, "DAY_VOTE");
  const actor = assertAlive(state, actorSeatId);
  const target = assertAlive(state, targetSeatId);
  if (actor.seatId === target.seatId) {
    throw new Error("不能投票给自己。");
  }
  if (state.votes[String(actor.seatId)]) {
    throw new Error("该玩家已经投过票。");
  }

  state.votes[String(actor.seatId)] = target.seatId;
  state = appendEvent(
    state,
    "VOTE_CAST",
    "public",
    `${actor.name} 投票给 ${target.name}。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
    { voterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );

  if (Object.keys(state.votes).length >= getAliveSeats(state).length) {
    state.phase = "EXILE_RESOLUTION";
  }

  return touch(state);
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
    state.pendingHunterShot = undefined;
    state = appendEvent(
      state,
      "HUNTER_SKIPPED",
      "public",
      `${actor.name} 没有开枪。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
      reasonPayload(reason),
      actor.seatId,
    );
    return cause === "EXILED" ? finishAfterDayDeaths(state) : finishAfterNightDeaths(state);
  }

  const target = assertAlive(state, targetSeatId);
  if (target.seatId === actor.seatId) {
    throw new Error("猎人不能带走自己。");
  }
  killSeat(state, target.seatId, "HUNTER_SHOT");
  state.pendingHunterShot = undefined;
  state = appendEvent(
    state,
    "HUNTER_SHOT",
    "public",
    `${actor.name} 开枪带走了 ${target.name}。${cleanReason(reason) ? `理由：${cleanReason(reason)}` : ""}`,
    { shooterSeatId: actor.seatId, targetSeatId: target.seatId, ...reasonPayload(reason) },
    actor.seatId,
  );
  return cause === "EXILED" ? finishAfterDayDeaths(state) : finishAfterNightDeaths(state);
}

function resolveNight(state: GameState): GameState {
  const deaths: number[] = [];
  const wolfTarget = state.night.wolfTargetSeatId;
  if (wolfTarget && state.night.witchSavedSeatId !== wolfTarget) {
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
      : `第${state.day}天清晨，${deaths.map((seatId) => getSeat(state, seatId).name).join("、")} 死亡。`;

  state = appendEvent(state, "DAY_STARTED", "public", message, { deadSeatIds: deaths });

  if (state.pendingHunterShot) {
    state.phase = "HUNTER_SHOT";
    return touch(state);
  }

  return finishAfterNightDeaths(state);
}

function resolveVote(state: GameState): GameState {
  const totals = new Map<number, number>();
  for (const targetSeatId of Object.values(state.votes)) {
    totals.set(targetSeatId, (totals.get(targetSeatId) ?? 0) + 1);
  }

  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
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

  killSeat(state, topSeatId, "EXILED");
  const exiled = getSeat(state, topSeatId);
  state = appendEvent(
    state,
    "PLAYER_EXILED",
    "public",
    `${exiled.name} 被放逐出局。`,
    { seatId: topSeatId },
  );

  if (state.pendingHunterShot) {
    state.phase = "HUNTER_SHOT";
    return touch(state);
  }

  return finishAfterDayDeaths(state);
}

function finishAfterNightDeaths(state: GameState): GameState {
  const settled = settleWinOrContinue(state);
  return settled.result ? settled : startDaySpeeches(settled);
}

function finishAfterDayDeaths(state: GameState): GameState {
  const settled = settleWinOrContinue(state);
  return settled.result ? settled : startNextNight(settled);
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
  settled.speechQueue = [];
  settled.speechIndex = 0;
  return touch(
    appendEvent(settled, "NIGHT_STARTED", "public", `第${settled.day}夜开始。`, {
      day: settled.day,
    }),
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
      const wolves = getAliveSeats(state).filter((seat) => seat.role === "WEREWOLF");
      return wolves.find((seat) => !seat.isAi)?.seatId ?? wolves[0]?.seatId;
    }
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
    case "DAY_VOTE":
      return getAliveSeats(state).find((seat) => !state.votes[String(seat.seatId)])?.seatId;
    case "HUNTER_SHOT":
      return state.pendingHunterShot?.shooterSeatId;
    default:
      return undefined;
  }
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

  appendEvent(state, "PLAYER_DIED", "public", `${seat.name} 出局。`, {
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
    throw new Error(`${seat.name} 已经出局。`);
  }
  return seat;
}

function assertAliveRole(state: GameState, seatId: number, role: Role): Seat {
  const seat = assertAlive(state, seatId);
  if (seat.role !== role) {
    throw new Error(`${seat.name} 不是 ${ROLE_LABELS[role]}。`);
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
  return JSON.parse(JSON.stringify(state)) as GameState;
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

import { advanceOneAiStep, advancePendingAiTurns, advancePendingAiVotes, createConfiguredAiOptions } from "@/ai/mockAgent";
import type { AiSpeechProviderContext } from "@/ai/types";
import type { AiDecisionLog } from "@/ai/types";
import { getBoardPreset, listBoardPresets } from "@/game/boards";
import { applyCommand, applySystemStep, createGame, hydrateGameState } from "@/game/engine";
import { buildHumanView } from "@/game/projection";
import { PHASES } from "@/game/types";
import type {
  AiFriendConfig,
  AiFriendRuntimeLlmConfig,
  AiRuntimeMode,
  BoardSnapshot,
  Command,
  GameState,
  HumanGameView,
  Phase,
  ReviewAiDebugEntry,
  ReviewDebugInfo,
  ReviewSeat,
} from "@/game/types";
import { prisma } from "@/lib/prisma";

type RuntimeAiOptions = {
  runtimeAiLlmConfigs?: Record<string, AiFriendRuntimeLlmConfig>;
  aiRuntimeMode?: AiRuntimeMode;
};

function createRuntimeAiAdvanceOptions(options: RuntimeAiOptions) {
  const forceMock = options.aiRuntimeMode === "mock";
  return {
    ...createConfiguredAiOptions({ forceMock }),
    runtimeAiLlmConfigs: forceMock ? undefined : options.runtimeAiLlmConfigs,
  };
}

const BATCH_AI_AFTER_HUMAN_PHASES = new Set<Phase>([
  "DAY_VOTE",
  "SHERIFF_NOMINATION",
  "SHERIFF_WITHDRAWAL",
  "SHERIFF_VOTE",
  "SHERIFF_PK_VOTE",
]);

export function listGameBoards(): BoardSnapshot[] {
  return listBoardPresets();
}

export async function createGameRecord(options: { boardId?: string; humanSeatId?: number | null; aiFriends?: AiFriendConfig[] } = {}): Promise<HumanGameView> {
  const board = getBoardPreset(options.boardId);
  const state = createGame({
    boardId: board.id,
    humanSeatId: options.humanSeatId === null ? null : options.humanSeatId ?? randomHumanSeatId(board.seatCount),
    aiFriends: options.aiFriends,
  });
  await saveGameState(state);
  return buildHumanView(state);
}

function randomHumanSeatId(seatCount: number): number {
  return 1 + Math.floor(Math.random() * seatCount);
}

export async function getGameState(gameId: string): Promise<GameState | null> {
  return loadGameState(gameId);
}

export async function getGameView(gameId: string): Promise<HumanGameView | null> {
  const state = await loadGameState(gameId);
  return state ? buildServerHumanView(state) : null;
}

export async function submitHumanCommand(
  gameId: string,
  command: Command,
  options: RuntimeAiOptions = {},
): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  let nextState = applyCommand(state, command);
  let aiLogs: AiDecisionLog[] = [];
  if (command.type === "vote" || command.type === "sheriffNominate" || command.type === "sheriffWithdraw" || command.type === "sheriffVote") {
    const advanced = await advancePendingAiTurns(nextState, BATCH_AI_AFTER_HUMAN_PHASES, {
      ...createRuntimeAiAdvanceOptions(options),
    });
    nextState = revealCompletedVote(advanced.state);
    aiLogs = advanced.aiLogs;
  }

  await saveGameState(nextState, aiLogs);
  return buildServerHumanView(nextState);
}

export async function continueGame(gameId: string, options: RuntimeAiOptions = {}): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  const advanced =
    state.phase === "DAY_VOTE"
      ? await advancePendingAiVotes(state, {
          ...createRuntimeAiAdvanceOptions(options),
        })
      : await advanceOneAiStep(state, {
          ...createRuntimeAiAdvanceOptions(options),
        });
  const nextState = state.phase === "DAY_VOTE" ? revealCompletedVote(advanced.state) : advanced.state;
  await saveGameState(nextState, advanced.aiLogs);
  return buildServerHumanView(nextState);
}

export async function continueGameWithSpeechStream(
  gameId: string,
  speechContext: AiSpeechProviderContext,
  options: RuntimeAiOptions = {},
): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  const advanced =
    state.phase === "DAY_VOTE"
      ? await advancePendingAiVotes(state, {
          ...createRuntimeAiAdvanceOptions(options),
        })
      : await advanceOneAiStep(state, {
          ...createRuntimeAiAdvanceOptions(options),
          speechContext,
        });
  const nextState = state.phase === "DAY_VOTE" ? revealCompletedVote(advanced.state) : advanced.state;
  await saveGameState(nextState, advanced.aiLogs);
  return buildServerHumanView(nextState);
}

function revealCompletedVote(state: GameState): GameState {
  return state.phase === "EXILE_RESOLUTION" ? applySystemStep(state) : state;
}

async function buildServerHumanView(state: GameState): Promise<HumanGameView> {
  const view = buildHumanView(state);
  if (!state.result) return view;

  const reviewDebug = await buildReviewDebugInfo(state);
  return reviewDebug ? { ...view, reviewDebug } : view;
}

async function buildReviewDebugInfo(state: GameState): Promise<ReviewDebugInfo | undefined> {
  const logs = await prisma.aiCallLog.findMany({
    where: { gameId: state.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const aiCalls = logs.map((log): ReviewAiDebugEntry => {
    const prompt = parseJsonRecord(log.promptJson);
    const output = parseJsonRecord(log.outputJson);
    const promptView = isRecord(prompt.view) ? prompt.view : undefined;
    const outputCommand = isRecord(output.output) ? output.output : undefined;
    const seat = state.seats.find((item) => item.seatId === log.seatNumber);
    const publicFactBasis = readStringArray(output.publicFactBasis);
    const actionType = coerceCommandType(readString(outputCommand, "type"));
    const decisionReason = readString(outputCommand, "reason");
    const target = readCommandTarget(state, outputCommand);

    return {
      id: log.id,
      day: readNumber(promptView, "day") ?? state.day,
      seat: {
        seatId: log.seatNumber,
        name: seat?.name ?? `${log.seatNumber}号`,
      },
      phase: coercePhase(log.phase),
      provider: readString(prompt, "provider") ?? "unknown",
      actionType,
      outputSummary: buildCommandSummary(state, outputCommand),
      decisionReason,
      target,
      isFallback: readBoolean(output, "isFallback") ?? log.isFallback,
      publicFactBasis,
      matchedPublicLogic: buildMatchedPublicLogic(publicFactBasis, outputCommand, decisionReason, target),
      rawOutput: output.rawOutput,
      error: readString(output, "error"),
      validationErrors: readStringArray(output.validationErrors),
    };
  });

  if (aiCalls.length === 0) return undefined;

  return {
    aiCalls,
    fallbackCount: aiCalls.filter((call) => call.isFallback).length,
    providers: Array.from(new Set(aiCalls.map((call) => call.provider))).sort(),
    publicFactBasisCount: aiCalls.reduce((total, call) => total + call.publicFactBasis.length, 0),
    matchedPublicLogicCount: aiCalls.reduce((total, call) => total + call.matchedPublicLogic.length, 0),
  };
}

const PUBLIC_LOGIC_TERMS = [
  "对跳",
  "悍跳",
  "预言家",
  "查杀",
  "金水",
  "银水",
  "查验",
  "票型",
  "归票",
  "投票",
  "票",
  "焦点",
  "压力",
  "站边",
  "攻击",
  "怀疑",
  "信任",
  "身份",
  "发言",
  "警徽",
  "警长",
  "刀口",
  "死亡",
  "遗言",
  "守护",
  "用药",
  "毒",
  "救",
  "自爆",
  "带走",
] as const;

const STRONG_PUBLIC_LOGIC_TERMS = [
  "对跳",
  "悍跳",
  "查杀",
  "金水",
  "银水",
  "查验",
  "票型",
  "归票",
  "投票",
  "焦点",
  "压力",
  "站边",
  "攻击",
  "怀疑",
  "信任",
  "警徽",
  "刀口",
  "死亡",
  "遗言",
  "自爆",
  "带走",
] as const;

function buildCommandSummary(state: GameState, command: Record<string, unknown> | undefined): string | undefined {
  const type = readString(command, "type");
  if (!type) return undefined;

  const target = readCommandTarget(state, command);
  const targetLabel = target ? formatReviewSeat(target) : undefined;

  switch (type) {
    case "wolfKill":
      return targetLabel ? `刀 ${targetLabel}` : "选择刀口";
    case "guardAction":
      return targetLabel ? `守护 ${targetLabel}` : "空守";
    case "seerCheck":
      return targetLabel ? `查验 ${targetLabel}` : "选择查验目标";
    case "witchAction": {
      const mode = readString(command, "mode");
      if (mode === "save") return targetLabel ? `救 ${targetLabel}` : "使用解药";
      if (mode === "poison") return targetLabel ? `毒 ${targetLabel}` : "使用毒药";
      return "女巫跳过用药";
    }
    case "wolfBeautyCharm":
      return targetLabel ? `魅惑 ${targetLabel}` : "狼美人不魅惑";
    case "speak":
      return "生成发言";
    case "lastWords":
      return "生成遗言";
    case "vote":
      return targetLabel ? `投票给 ${targetLabel}` : "弃票";
    case "hunterShoot":
      return targetLabel ? `开枪带走 ${targetLabel}` : "不开枪";
    case "wolfKingShoot":
      return targetLabel ? `狼王带走 ${targetLabel}` : "狼王不开枪";
    case "whiteWolfKingExplode":
      return targetLabel ? `白狼王自爆带走 ${targetLabel}` : "白狼王自爆";
    case "knightDuel":
      return targetLabel ? `骑士决斗 ${targetLabel}` : "骑士不决斗";
    case "sheriffNominate":
      return readBoolean(command, "run") ? "选择上警" : "不上警";
    case "sheriffSpeech":
      return "生成警上发言";
    case "sheriffWithdraw":
      return readBoolean(command, "withdraw") ? "退水" : "继续竞选警长";
    case "sheriffVote":
      return targetLabel ? `警长票投给 ${targetLabel}` : "警长票弃票";
    case "sheriffHandoff":
      return targetLabel ? `警徽交给 ${targetLabel}` : "撕警徽";
    default:
      return undefined;
  }
}

function readCommandTarget(state: GameState, command: Record<string, unknown> | undefined): ReviewSeat | undefined {
  const targetSeatId = readSeatId(command, "targetSeatId");
  if (!targetSeatId) return undefined;

  const seat = state.seats.find((item) => item.seatId === targetSeatId);
  return {
    seatId: targetSeatId,
    name: seat?.name ?? `${targetSeatId}号`,
  };
}

function readSeatId(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function buildMatchedPublicLogic(
  publicFactBasis: string[],
  command: Record<string, unknown> | undefined,
  decisionReason: string | undefined,
  target: ReviewSeat | undefined,
): string[] {
  if (publicFactBasis.length === 0) return [];

  const type = readString(command, "type");
  const commandKeyword = type ? formatCommandKeyword(type) : "";
  const reasonTerms = PUBLIC_LOGIC_TERMS.filter((term) => decisionReason?.includes(term));
  const targetTokens = target
    ? [`${target.seatId}号`, `#${target.seatId}`, target.name].filter((token) => token.length > 0)
    : [];

  const ranked = publicFactBasis
    .map((fact, index) => {
      let score = 0;
      if (targetTokens.some((token) => fact.includes(token))) score += 4;
      score += reasonTerms.filter((term) => fact.includes(term)).length * 2;
      if (commandKeyword && fact.includes(commandKeyword)) score += 1;
      if (STRONG_PUBLIC_LOGIC_TERMS.some((term) => fact.includes(term))) score += 1;
      return { fact, index, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return Array.from(new Set(ranked.map((item) => item.fact))).slice(0, 3);
}

function formatCommandKeyword(type: string): string {
  switch (type) {
    case "wolfKill":
      return "刀";
    case "guardAction":
      return "守护";
    case "seerCheck":
      return "查验";
    case "witchAction":
      return "用药";
    case "wolfBeautyCharm":
      return "魅惑";
    case "vote":
    case "sheriffVote":
      return "票";
    case "hunterShoot":
    case "wolfKingShoot":
      return "枪";
    case "whiteWolfKingExplode":
      return "自爆";
    case "knightDuel":
      return "决斗";
    case "sheriffNominate":
    case "sheriffSpeech":
    case "sheriffWithdraw":
    case "sheriffHandoff":
      return "警";
    default:
      return "";
  }
}

function formatReviewSeat(seat: ReviewSeat): string {
  return `${seat.seatId}号${seat.name ? ` · ${seat.name}` : ""}`;
}

async function loadGameState(gameId: string): Promise<GameState | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });
  return game ? hydrateGameState(JSON.parse(game.stateJson) as GameState) : null;
}

function parseJsonRecord(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = record?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function coercePhase(value: string): Phase {
  return PHASES.includes(value as Phase) ? (value as Phase) : "GAME_OVER";
}

function coerceCommandType(value: string | undefined): Command["type"] | undefined {
  switch (value) {
    case "wolfKill":
    case "guardAction":
    case "seerCheck":
    case "witchAction":
    case "wolfBeautyCharm":
    case "speak":
    case "lastWords":
    case "vote":
    case "hunterShoot":
    case "wolfKingShoot":
    case "whiteWolfKingExplode":
    case "knightDuel":
    case "sheriffNominate":
    case "sheriffSpeech":
    case "sheriffWithdraw":
    case "sheriffVote":
    case "sheriffHandoff":
      return value;
    default:
      return undefined;
  }
}

async function saveGameState(state: GameState, aiLogs: AiDecisionLog[] = []): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.game.upsert({
      where: { id: state.id },
      create: {
        id: state.id,
        humanSeatId: state.humanSeatId,
        status: state.result ? "GAME_OVER" : "ACTIVE",
        phase: state.phase,
        day: state.day,
        stateJson: JSON.stringify(state),
      },
      update: {
        status: state.result ? "GAME_OVER" : "ACTIVE",
        phase: state.phase,
        day: state.day,
        stateJson: JSON.stringify(state),
      },
    });

    await tx.seat.deleteMany({ where: { gameId: state.id } });
    await tx.seat.createMany({
      data: state.seats.map((seat) => ({
        gameId: state.id,
        seatNumber: seat.seatId,
        name: seat.name,
        isAi: seat.isAi,
        role: seat.role,
        isAlive: seat.alive,
      })),
    });

    await tx.gameEvent.deleteMany({ where: { gameId: state.id } });
    await tx.gameEvent.createMany({
      data: state.events.map((event) => ({
        gameId: state.id,
        seq: event.seq,
        type: event.type,
        visibility: event.visibility,
        actorSeatId: event.actorSeatId,
        payloadJson: JSON.stringify({
          day: event.day,
          phase: event.phase,
          message: event.message,
          payload: event.payload,
        }),
      })),
    });

    if (aiLogs.length > 0) {
      await tx.aiCallLog.createMany({
        data: aiLogs.map((log) => ({
          gameId: state.id,
          seatNumber: log.seatNumber,
          phase: log.phase,
          promptJson: JSON.stringify({ provider: log.provider, view: log.prompt }),
          outputJson: JSON.stringify({
            output: log.output,
            publicFactBasis: log.publicFactBasis,
            rawOutput: log.rawOutput,
            error: log.error,
            validationErrors: log.validationErrors,
            isFallback: log.isFallback,
          }),
          isFallback: log.isFallback,
        })),
      });
    }
  });
}

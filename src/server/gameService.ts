import { advanceOneAiStep, advancePendingAiVotes, createConfiguredAiOptions } from "@/ai/mockAgent";
import type { AiSpeechProviderContext } from "@/ai/types";
import type { AiDecisionLog } from "@/ai/types";
import { getBoardPreset, listBoardPresets } from "@/game/boards";
import { applyCommand, applySystemStep, createGame, hydrateGameState } from "@/game/engine";
import { buildHumanView } from "@/game/projection";
import { PHASES } from "@/game/types";
import type { BoardSnapshot, Command, GameState, HumanGameView, Phase, ReviewAiDebugEntry, ReviewDebugInfo } from "@/game/types";
import { prisma } from "@/lib/prisma";

export function listGameBoards(): BoardSnapshot[] {
  return listBoardPresets();
}

export async function createGameRecord(options: { boardId?: string } = {}): Promise<HumanGameView> {
  const board = getBoardPreset(options.boardId);
  const state = createGame({ boardId: board.id, humanSeatId: randomHumanSeatId(board.seatCount) });
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

export async function submitHumanCommand(gameId: string, command: Command): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  let nextState = applyCommand(state, command);
  let aiLogs: AiDecisionLog[] = [];
  if (command.type === "vote") {
    const advanced = await advancePendingAiVotes(nextState, createConfiguredAiOptions());
    nextState = revealCompletedVote(advanced.state);
    aiLogs = advanced.aiLogs;
  }

  await saveGameState(nextState, aiLogs);
  return buildServerHumanView(nextState);
}

export async function continueGame(gameId: string): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  const advanced =
    state.phase === "DAY_VOTE"
      ? await advancePendingAiVotes(state, createConfiguredAiOptions())
      : await advanceOneAiStep(state, createConfiguredAiOptions());
  const nextState = state.phase === "DAY_VOTE" ? revealCompletedVote(advanced.state) : advanced.state;
  await saveGameState(nextState, advanced.aiLogs);
  return buildServerHumanView(nextState);
}

export async function continueGameWithSpeechStream(
  gameId: string,
  speechContext: AiSpeechProviderContext,
): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  const advanced =
    state.phase === "DAY_VOTE"
      ? await advancePendingAiVotes(state, createConfiguredAiOptions())
      : await advanceOneAiStep(state, { ...createConfiguredAiOptions(), speechContext });
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

    return {
      id: log.id,
      day: readNumber(promptView, "day") ?? state.day,
      seat: {
        seatId: log.seatNumber,
        name: seat?.name ?? `${log.seatNumber}号`,
      },
      phase: coercePhase(log.phase),
      provider: readString(prompt, "provider") ?? "unknown",
      actionType: coerceCommandType(readString(outputCommand, "type")),
      isFallback: readBoolean(output, "isFallback") ?? log.isFallback,
      publicFactBasis,
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
  };
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
    case "speak":
    case "lastWords":
    case "vote":
    case "hunterShoot":
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

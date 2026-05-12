import { advanceWithMockAi, type AiDecisionLog } from "@/ai/mockAgent";
import { applyCommand, createGame } from "@/game/engine";
import { buildHumanView } from "@/game/projection";
import type { Command, GameState, HumanGameView } from "@/game/types";
import { prisma } from "@/lib/prisma";

export async function createGameRecord(): Promise<HumanGameView> {
  const state = createGame();
  const advanced = advanceWithMockAi(state);
  await saveGameState(advanced.state, advanced.aiLogs);
  return buildHumanView(advanced.state);
}

export async function getGameState(gameId: string): Promise<GameState | null> {
  return loadGameState(gameId);
}

export async function getGameView(gameId: string): Promise<HumanGameView | null> {
  const state = await loadGameState(gameId);
  return state ? buildHumanView(state) : null;
}

export async function submitHumanCommand(gameId: string, command: Command): Promise<HumanGameView> {
  const state = await loadGameState(gameId);
  if (!state) {
    throw new Error("对局不存在。");
  }

  const afterHuman = applyCommand(state, command);
  const advanced = advanceWithMockAi(afterHuman);
  await saveGameState(advanced.state, advanced.aiLogs);
  return buildHumanView(advanced.state);
}

async function loadGameState(gameId: string): Promise<GameState | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });
  return game ? (JSON.parse(game.stateJson) as GameState) : null;
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
          promptJson: JSON.stringify(log.prompt),
          outputJson: JSON.stringify(log.output),
          isFallback: log.isFallback,
        })),
      });
    }
  });
}

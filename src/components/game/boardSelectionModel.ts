import { listBoardPresets } from "@/game/boards";

import type { BoardOption, HumanSeatMode } from "./clientTypes";

export function getDefaultBoardOptions(): BoardOption[] {
  return listBoardPresets();
}

export function getInitialBoardSelection(boards: BoardOption[]): {
  selectedBoardId: string | null;
  seatCount: number | null;
  selectedHumanSeatId: number | null;
} {
  const firstBoard = boards[0];
  return {
    selectedBoardId: firstBoard?.id ?? null,
    seatCount: firstBoard?.seatCount ?? null,
    selectedHumanSeatId: firstBoard?.seatCount ? 1 : null,
  };
}

export function resolveBoardSelectionToggle({
  boards,
  boardId,
  selectedBoardId,
  humanSeatMode,
  selectedHumanSeatId,
  pickRandomSeat,
}: {
  boards: Array<Pick<BoardOption, "id" | "seatCount">>;
  boardId: string;
  selectedBoardId: string | null;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
  pickRandomSeat: (seatCount: number) => number;
}): {
  selectedBoardId: string | null;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
} {
  if (selectedBoardId === boardId) {
    return {
      selectedBoardId: null,
      humanSeatMode: "random",
      selectedHumanSeatId: null,
    };
  }

  const board = boards.find((item) => item.id === boardId);
  if (!board) {
    return {
      selectedBoardId: boardId,
      humanSeatMode,
      selectedHumanSeatId,
    };
  }

  if (humanSeatMode === "none") {
    return {
      selectedBoardId: boardId,
      humanSeatMode,
      selectedHumanSeatId: null,
    };
  }

  if (humanSeatMode === "fixed" && selectedHumanSeatId && selectedHumanSeatId >= 1 && selectedHumanSeatId <= board.seatCount) {
    return {
      selectedBoardId: boardId,
      humanSeatMode,
      selectedHumanSeatId,
    };
  }

  return {
    selectedBoardId: boardId,
    humanSeatMode: "random",
    selectedHumanSeatId: pickRandomSeat(board.seatCount),
  };
}

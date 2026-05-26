import { listBoardPresets } from "@/game/boards";

import type { BoardOption } from "./clientTypes";

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

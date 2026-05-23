import { describe, expect, it } from "vitest";

import { getDefaultBoardOptions, getInitialBoardSelection } from "./boardSelectionModel";

describe("board selection defaults", () => {
  it("provides official board options before the async board API responds", () => {
    const boards = getDefaultBoardOptions();

    expect(boards.length).toBeGreaterThan(0);
    expect(boards[0]?.id).toBe("6p-beginner-seer");
    expect(boards.some((board) => board.id === "9p-seer-witch-hunter")).toBe(true);
  });

  it("selects a valid board from the synchronous defaults", () => {
    const boards = getDefaultBoardOptions();

    expect(getInitialBoardSelection(boards)).toEqual({
      selectedBoardId: boards[0]?.id ?? null,
      seatCount: boards[0]?.seatCount ?? null,
      selectedHumanSeatId: 1,
    });
  });

  it("keeps the initial human seat deterministic for hydration", () => {
    expect(getInitialBoardSelection([])).toEqual({
      selectedBoardId: null,
      seatCount: null,
      selectedHumanSeatId: null,
    });
  });
});

import { describe, expect, it } from "vitest";

import { getDefaultBoardOptions, getInitialBoardSelection, resolveBoardSelectionToggle } from "./boardSelectionModel";

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

  it("clears board and human-seat selection when toggling the selected board", () => {
    expect(
      resolveBoardSelectionToggle({
        boards: boardOptions(),
        boardId: "6p",
        selectedBoardId: "6p",
        humanSeatMode: "fixed",
        selectedHumanSeatId: 2,
        pickRandomSeat: () => 4,
      }),
    ).toEqual({
      selectedBoardId: null,
      humanSeatMode: "random",
      selectedHumanSeatId: null,
    });
  });

  it("keeps spectator mode without assigning a human seat", () => {
    expect(
      resolveBoardSelectionToggle({
        boards: boardOptions(),
        boardId: "9p",
        selectedBoardId: "6p",
        humanSeatMode: "none",
        selectedHumanSeatId: null,
        pickRandomSeat: () => 4,
      }),
    ).toEqual({
      selectedBoardId: "9p",
      humanSeatMode: "none",
      selectedHumanSeatId: null,
    });
  });

  it("preserves a valid fixed human seat on the newly selected board", () => {
    expect(
      resolveBoardSelectionToggle({
        boards: boardOptions(),
        boardId: "9p",
        selectedBoardId: "6p",
        humanSeatMode: "fixed",
        selectedHumanSeatId: 6,
        pickRandomSeat: () => 4,
      }),
    ).toEqual({
      selectedBoardId: "9p",
      humanSeatMode: "fixed",
      selectedHumanSeatId: 6,
    });
  });

  it("switches invalid fixed human seats back to random using the provided random picker", () => {
    expect(
      resolveBoardSelectionToggle({
        boards: boardOptions(),
        boardId: "6p",
        selectedBoardId: "9p",
        humanSeatMode: "fixed",
        selectedHumanSeatId: 9,
        pickRandomSeat: (seatCount) => seatCount,
      }),
    ).toEqual({
      selectedBoardId: "6p",
      humanSeatMode: "random",
      selectedHumanSeatId: 6,
    });
  });
});

function boardOptions() {
  return [
    { id: "6p", name: "6人局", seatCount: 6, roles: [] },
    { id: "9p", name: "9人局", seatCount: 9, roles: [] },
  ];
}

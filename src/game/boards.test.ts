import { describe, expect, it } from "vitest";
import {
  BOARD_PRESETS,
  createBoardRegistry,
  DEFAULT_BOARD_ID,
  getBoardPreset,
  listBoardPresets,
  validateBoardPreset,
} from "./boards";
import { createGame } from "./engine";
import type { Role } from "./types";

describe("board registry", () => {
  it("validates all official boards", () => {
    for (const board of Object.values(BOARD_PRESETS)) {
      expect(validateBoardPreset(board)).toEqual([]);
    }
  });

  it("keeps the current official board list stable", () => {
    expect(listBoardPresets().map((board) => board.id)).toEqual([
      "6p-beginner-seer",
      "9p-seer-witch-hunter",
      "12p-sheriff-seer-witch-hunter-guard",
      "12p-sheriff-seer-witch-hunter-idiot",
      "12p-sheriff-wolf-king-seer-witch-hunter-guard",
      "12p-sheriff-white-wolf-king-seer-witch-hunter-guard",
      "12p-sheriff-white-wolf-king-knight",
      "12p-sheriff-wolf-beauty-knight",
    ]);
  });

  it("defines supported popular board variants with expected role counts and flags", () => {
    expect(boardSummary("6p-beginner-seer")).toEqual({
      seatCount: 6,
      roles: { WEREWOLF: 2, VILLAGER: 2, SEER: 1, HUNTER: 1 },
      hasGuard: false,
      hasSheriff: false,
    });
    expect(boardSummary("12p-sheriff-seer-witch-hunter-guard")).toEqual({
      seatCount: 12,
      roles: { WEREWOLF: 4, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
      hasGuard: true,
      hasSheriff: true,
    });
    expect(boardSummary("12p-sheriff-seer-witch-hunter-idiot")).toEqual({
      seatCount: 12,
      roles: { WEREWOLF: 4, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, IDIOT: 1 },
      hasGuard: false,
      hasSheriff: true,
    });
    expect(boardSummary("12p-sheriff-wolf-king-seer-witch-hunter-guard")).toEqual({
      seatCount: 12,
      roles: { WOLF_KING: 1, WEREWOLF: 3, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
      hasGuard: true,
      hasSheriff: true,
    });
    expect(boardSummary("12p-sheriff-white-wolf-king-seer-witch-hunter-guard")).toEqual({
      seatCount: 12,
      roles: { WHITE_WOLF_KING: 1, WEREWOLF: 3, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
      hasGuard: true,
      hasSheriff: true,
    });
    expect(boardSummary("12p-sheriff-white-wolf-king-knight")).toEqual({
      seatCount: 12,
      roles: { WHITE_WOLF_KING: 1, WEREWOLF: 3, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, KNIGHT: 1 },
      hasGuard: false,
      hasSheriff: true,
    });
    expect(boardSummary("12p-sheriff-wolf-beauty-knight")).toEqual({
      seatCount: 12,
      roles: { WOLF_BEAUTY: 1, WEREWOLF: 3, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, KNIGHT: 1 },
      hasGuard: false,
      hasSheriff: true,
    });
  });

  it("creates games with each official board seat count and rule flags", () => {
    for (const board of Object.values(BOARD_PRESETS)) {
      const state = createGame({ boardId: board.id, seed: 1 });

      expect(state.board.id).toBe(board.id);
      expect(state.seats).toHaveLength(board.seatCount);
      expect(state.rules.hasGuard).toBe(board.hasGuard);
      expect(Boolean(state.sheriff)).toBe(board.hasSheriff);
      expect(countRoles(state.seats.map((seat) => seat.role))).toEqual(countRoles(board.roles));
    }
  });

  it("falls back to the default board for unknown ids", () => {
    expect(getBoardPreset("missing-board").id).toBe(DEFAULT_BOARD_ID);
  });

  it("rejects duplicate board ids", () => {
    const board = BOARD_PRESETS[DEFAULT_BOARD_ID];
    expect(() => createBoardRegistry([board, board], DEFAULT_BOARD_ID)).toThrow(/duplicate board id/);
  });

  it("rejects mismatched guard config", () => {
    expect(
      validateBoardPreset({
        ...BOARD_PRESETS[DEFAULT_BOARD_ID],
        hasGuard: true,
      }),
    ).toContain("hasGuard must match GUARD in roles and godRoles");
  });
});

function boardSummary(boardId: string): {
  seatCount: number;
  roles: Partial<Record<Role, number>>;
  hasGuard: boolean;
  hasSheriff: boolean;
} {
  const board = BOARD_PRESETS[boardId];
  return {
    seatCount: board.seatCount,
    roles: countRoles(board.roles),
    hasGuard: board.hasGuard,
    hasSheriff: board.hasSheriff,
  };
}

function countRoles(roles: Role[]): Partial<Record<Role, number>> {
  return roles.reduce<Partial<Record<Role, number>>>((counts, role) => {
    counts[role] = (counts[role] ?? 0) + 1;
    return counts;
  }, {});
}

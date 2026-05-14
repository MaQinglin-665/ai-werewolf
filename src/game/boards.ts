import type { BoardId, BoardSnapshot, GameRules, Role } from "./types";

export type BoardPreset = BoardSnapshot & {
  roles: Role[];
  godRoles: Role[];
  wolfRoles: Role[];
};

export const DEFAULT_BOARD_ID: BoardId = "9p-seer-witch-hunter";

export const BOARD_PRESETS: Record<BoardId, BoardPreset> = {
  "9p-seer-witch-hunter": {
    id: "9p-seer-witch-hunter",
    name: "9 人预女猎",
    description: "3 狼、3 民、预言家、女巫、猎人。沿用当前无警长基础流程。",
    seatCount: 9,
    roleSummary: "3狼 3民 预言家 女巫 猎人",
    roles: [
      "WEREWOLF",
      "WEREWOLF",
      "WEREWOLF",
      "VILLAGER",
      "VILLAGER",
      "VILLAGER",
      "SEER",
      "WITCH",
      "HUNTER",
    ],
    godRoles: ["SEER", "WITCH", "HUNTER"],
    wolfRoles: ["WEREWOLF"],
    hasGuard: false,
    hasSheriff: false,
    winCondition: "side-slaughter",
  },
  "12p-sheriff-seer-witch-hunter-guard": {
    id: "12p-sheriff-seer-witch-hunter-guard",
    name: "12 人标准警长局",
    description: "4 狼、4 民、预言家、女巫、猎人、守卫，含基础警长竞选和警徽移交。",
    seatCount: 12,
    roleSummary: "4狼 4民 预言家 女巫 猎人 守卫",
    roles: [
      "WEREWOLF",
      "WEREWOLF",
      "WEREWOLF",
      "WEREWOLF",
      "VILLAGER",
      "VILLAGER",
      "VILLAGER",
      "VILLAGER",
      "SEER",
      "WITCH",
      "HUNTER",
      "GUARD",
    ],
    godRoles: ["SEER", "WITCH", "HUNTER", "GUARD"],
    wolfRoles: ["WEREWOLF"],
    hasGuard: true,
    hasSheriff: true,
    winCondition: "side-slaughter",
  },
};

export function getBoardPreset(boardId: string | undefined): BoardPreset {
  return BOARD_PRESETS[(boardId as BoardId) || DEFAULT_BOARD_ID] ?? BOARD_PRESETS[DEFAULT_BOARD_ID];
}

export function listBoardPresets(): BoardSnapshot[] {
  return Object.values(BOARD_PRESETS).map(toBoardSnapshot);
}

export function toBoardSnapshot(board: BoardPreset): BoardSnapshot {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    seatCount: board.seatCount,
    roleSummary: board.roleSummary,
    hasGuard: board.hasGuard,
    hasSheriff: board.hasSheriff,
    winCondition: board.winCondition,
  };
}

export function buildRules(board: BoardPreset): GameRules {
  return {
    godRoles: [...board.godRoles],
    wolfRoles: [...board.wolfRoles],
    hasGuard: board.hasGuard,
    hasSheriff: board.hasSheriff,
    winCondition: board.winCondition,
    sheriffVoteWeight: 1.5,
    guardSaveConflictKills: true,
  };
}

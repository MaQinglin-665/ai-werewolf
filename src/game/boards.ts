import type { BoardId, BoardSnapshot, GameRules, Role } from "./types";

export type BoardPreset = BoardSnapshot & {
  roles: Role[];
  godRoles: Role[];
  wolfRoles: Role[];
};

export type BoardRegistry = {
  defaultBoardId: BoardId;
  boards: Record<string, BoardPreset>;
};

export const DEFAULT_BOARD_ID: BoardId = "9p-seer-witch-hunter";

const OFFICIAL_BOARD_PRESETS: BoardPreset[] = [
  {
    id: "6p-beginner-seer",
    name: "6 人新手局",
    description: "2 狼、2 民、预言家、猎人。流程短、身份少，适合新手熟悉夜晚刀人、查验、猎人开枪和白天投票。",
    seatCount: 6,
    roleSummary: "2狼 2民 预言家 猎人",
    roles: [
      "WEREWOLF",
      "WEREWOLF",
      "VILLAGER",
      "VILLAGER",
      "SEER",
      "HUNTER",
    ],
    godRoles: ["SEER", "HUNTER"],
    wolfRoles: ["WEREWOLF"],
    hasGuard: false,
    hasSheriff: false,
    winCondition: "side-slaughter",
  },
  {
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
  {
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
  {
    id: "12p-sheriff-seer-witch-hunter-idiot",
    name: "12 人预女猎白",
    description: "4 狼、4 民、预言家、女巫、猎人、白痴，含警长竞选和白痴放逐翻牌免死。",
    seatCount: 12,
    roleSummary: "4狼 4民 预言家 女巫 猎人 白痴",
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
      "IDIOT",
    ],
    godRoles: ["SEER", "WITCH", "HUNTER", "IDIOT"],
    wolfRoles: ["WEREWOLF"],
    hasGuard: false,
    hasSheriff: true,
    winCondition: "side-slaughter",
  },
  {
    id: "12p-sheriff-wolf-king-seer-witch-hunter-guard",
    name: "12 人狼王守卫局",
    description: "狼王、3 狼、4 民、预言家、女巫、猎人、守卫，含警长竞选和狼王出局开枪。",
    seatCount: 12,
    roleSummary: "狼王 3狼 4民 预言家 女巫 猎人 守卫",
    roles: [
      "WOLF_KING",
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
    wolfRoles: ["WEREWOLF", "WOLF_KING"],
    hasGuard: true,
    hasSheriff: true,
    winCondition: "side-slaughter",
  },
  {
    id: "12p-sheriff-white-wolf-king-seer-witch-hunter-guard",
    name: "12 人白狼王守卫局",
    description: "白狼王、3 狼、4 民、预言家、女巫、猎人、守卫，含警长竞选和白狼王白天自爆带人。",
    seatCount: 12,
    roleSummary: "白狼王 3狼 4民 预言家 女巫 猎人 守卫",
    roles: [
      "WHITE_WOLF_KING",
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
    wolfRoles: ["WEREWOLF", "WHITE_WOLF_KING"],
    hasGuard: true,
    hasSheriff: true,
    winCondition: "side-slaughter",
  },
  {
    id: "12p-sheriff-white-wolf-king-knight",
    name: "12 人白狼王骑士局",
    description: "白狼王、3 狼、4 民、预言家、女巫、猎人、骑士，含警长竞选、白狼王白天自爆带人和骑士决斗。",
    seatCount: 12,
    roleSummary: "白狼王 3狼 4民 预言家 女巫 猎人 骑士",
    roles: [
      "WHITE_WOLF_KING",
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
      "KNIGHT",
    ],
    godRoles: ["SEER", "WITCH", "HUNTER", "KNIGHT"],
    wolfRoles: ["WEREWOLF", "WHITE_WOLF_KING"],
    hasGuard: false,
    hasSheriff: true,
    winCondition: "side-slaughter",
  },
  {
    id: "12p-sheriff-wolf-beauty-knight",
    name: "12 人狼美人骑士局",
    description: "狼美人、3 狼、4 民、预言家、女巫、猎人、骑士，含警长竞选、夜间魅惑和白天骑士决斗。",
    seatCount: 12,
    roleSummary: "狼美人 3狼 4民 预言家 女巫 猎人 骑士",
    roles: [
      "WOLF_BEAUTY",
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
      "KNIGHT",
    ],
    godRoles: ["SEER", "WITCH", "HUNTER", "KNIGHT"],
    wolfRoles: ["WEREWOLF", "WOLF_BEAUTY"],
    hasGuard: false,
    hasSheriff: true,
    winCondition: "side-slaughter",
  },
];

export const BOARD_REGISTRY = createBoardRegistry(OFFICIAL_BOARD_PRESETS, DEFAULT_BOARD_ID);
export const BOARD_PRESETS = BOARD_REGISTRY.boards;

export function validateBoardPreset(board: BoardPreset): string[] {
  const issues: string[] = [];
  const roleSet = new Set(board.roles);
  const wolfRoles = new Set(board.wolfRoles);

  if (!board.id.trim()) issues.push("board id is required");
  if (board.seatCount !== board.roles.length) {
    issues.push(`seatCount ${board.seatCount} must match roles length ${board.roles.length}`);
  }
  if (!board.roles.some((role) => wolfRoles.has(role))) {
    issues.push("board must include at least one wolf role");
  }
  if (!board.roles.includes("VILLAGER")) {
    issues.push("board must include at least one villager");
  }

  for (const role of [...board.godRoles, ...board.wolfRoles]) {
    if (!roleSet.has(role)) {
      issues.push(`${role} is listed in rules but not present in roles`);
    }
  }

  const hasGuardRole = board.roles.includes("GUARD");
  const guardIsGod = board.godRoles.includes("GUARD");
  if (board.hasGuard !== hasGuardRole || board.hasGuard !== guardIsGod) {
    issues.push("hasGuard must match GUARD in roles and godRoles");
  }

  return issues;
}

export function createBoardRegistry(boards: BoardPreset[], defaultBoardId: BoardId): BoardRegistry {
  const registry: Record<string, BoardPreset> = {};
  const issues: string[] = [];

  for (const board of boards) {
    if (registry[board.id]) {
      issues.push(`duplicate board id: ${board.id}`);
      continue;
    }
    const boardIssues = validateBoardPreset(board);
    if (boardIssues.length > 0) {
      issues.push(...boardIssues.map((issue) => `${board.id}: ${issue}`));
    }
    registry[board.id] = board;
  }

  if (!registry[defaultBoardId]) {
    issues.push(`default board id not found: ${defaultBoardId}`);
  }
  if (issues.length > 0) {
    throw new Error(`Invalid board registry: ${issues.join("; ")}`);
  }

  return {
    defaultBoardId,
    boards: registry,
  };
}

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
    hasWolfBeauty: board.roles.includes("WOLF_BEAUTY"),
    hasKnight: board.roles.includes("KNIGHT"),
    hasIdiot: board.roles.includes("IDIOT"),
    winCondition: board.winCondition,
    sheriffVoteWeight: 1.5,
    guardSaveConflictKills: true,
  };
}

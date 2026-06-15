import type { BoardOption } from "./clientTypes";

export const RECOMMENDED_HOME_BOARD_IDS = [
  "6p-beginner-seer",
  "9p-seer-witch-hunter",
  "12p-sheriff-seer-witch-hunter-guard",
  "12p-sheriff-white-wolf-king-knight",
] as const;

type RecommendedHomeBoardId = (typeof RECOMMENDED_HOME_BOARD_IDS)[number];

type BoardArt = {
  src: string;
  alt: string;
};

export type HomepageBoardCard = {
  board: BoardOption;
  badge: string;
  displayTitle: string;
  displaySubtitle: string;
  tone: "beginner" | "classic" | "standard" | "advanced";
  art: BoardArt;
};

export const HOME_BOARD_ART_BY_ID: Record<RecommendedHomeBoardId, BoardArt> = {
  "6p-beginner-seer": {
    src: "/images/home-board-6p-beginner-seer.webp",
    alt: "月夜村庄新手狼人杀牌板场景",
  },
  "9p-seer-witch-hunter": {
    src: "/images/home-board-9p-seer-witch-hunter.webp",
    alt: "阴森庄园九人预女猎牌板场景",
  },
  "12p-sheriff-seer-witch-hunter-guard": {
    src: "/images/home-board-12p-standard-sheriff.webp",
    alt: "警长圆桌十二人标准局牌板场景",
  },
  "12p-sheriff-white-wolf-king-knight": {
    src: "/images/home-board-12p-white-wolf-king-knight.webp",
    alt: "白狼王骑士高压进阶牌板场景",
  },
};

const HOME_BOARD_BADGES: Record<RecommendedHomeBoardId, Pick<HomepageBoardCard, "badge" | "displayTitle" | "displaySubtitle" | "tone">> = {
  "6p-beginner-seer": { badge: "新手友好", displayTitle: "快速场", displaySubtitle: "6人局", tone: "beginner" },
  "9p-seer-witch-hunter": { badge: "进阶标准", displayTitle: "进阶场", displaySubtitle: "9人局", tone: "classic" },
  "12p-sheriff-seer-witch-hunter-guard": { badge: "平衡推荐", displayTitle: "经典场", displaySubtitle: "12人局", tone: "standard" },
  "12p-sheriff-white-wolf-king-knight": { badge: "高压进阶", displayTitle: "高压场", displaySubtitle: "12人局", tone: "advanced" },
};

export function buildHomepageBoardCards(boards: BoardOption[]): HomepageBoardCard[] {
  return RECOMMENDED_HOME_BOARD_IDS.flatMap((boardId) => {
    const board = boards.find((item) => item.id === boardId);
    if (!board) return [];
    return [
      {
        board,
        ...HOME_BOARD_BADGES[boardId],
        art: HOME_BOARD_ART_BY_ID[boardId],
      },
    ];
  });
}

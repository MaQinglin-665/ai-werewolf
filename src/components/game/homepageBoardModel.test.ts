import { describe, expect, it } from "vitest";
import { getDefaultBoardOptions } from "./boardSelectionModel";
import {
  HOME_BOARD_ART_BY_ID,
  RECOMMENDED_HOME_BOARD_IDS,
  buildHomepageBoardCards,
} from "./homepageBoardModel";

describe("homepage board model", () => {
  it("keeps the four approved recommended boards in order", () => {
    expect(RECOMMENDED_HOME_BOARD_IDS).toEqual([
      "6p-beginner-seer",
      "9p-seer-witch-hunter",
      "12p-sheriff-seer-witch-hunter-guard",
      "12p-sheriff-white-wolf-king-knight",
    ]);
  });

  it("maps recommended boards to image assets and lobby labels", () => {
    const cards = buildHomepageBoardCards(getDefaultBoardOptions());

    expect(cards.map((card) => card.board.name)).toEqual([
      "6 人新手局",
      "9 人预女猎",
      "12 人标准警长局",
      "12 人白狼王骑士局",
    ]);
    expect(cards.map((card) => card.art.src)).toEqual([
      "/images/home-board-6p-beginner-seer.webp",
      "/images/home-board-9p-seer-witch-hunter.webp",
      "/images/home-board-12p-standard-sheriff.webp",
      "/images/home-board-12p-white-wolf-king-knight.webp",
    ]);
    expect(cards.map((card) => card.badge)).toEqual(["新手友好", "进阶标准", "平衡推荐", "高压进阶"]);
  });

  it("uses compact display titles for image board cards", () => {
    const cards = buildHomepageBoardCards(getDefaultBoardOptions());

    expect(cards.map((card) => card.displayTitle)).toEqual(["快速场", "进阶场", "经典场", "高压场"]);
    expect(cards.map((card) => card.displaySubtitle)).toEqual(["6人局", "9人局", "12人局", "12人局"]);
  });

  it("does not fail if an approved board is absent from a filtered board list", () => {
    const boards = getDefaultBoardOptions().filter((board) => board.id !== "9p-seer-witch-hunter");

    expect(buildHomepageBoardCards(boards).map((card) => card.board.id)).toEqual([
      "6p-beginner-seer",
      "12p-sheriff-seer-witch-hunter-guard",
      "12p-sheriff-white-wolf-king-knight",
    ]);
  });

  it("has art metadata for every approved recommended board", () => {
    for (const boardId of RECOMMENDED_HOME_BOARD_IDS) {
      expect(HOME_BOARD_ART_BY_ID[boardId]).toBeDefined();
    }
  });
});

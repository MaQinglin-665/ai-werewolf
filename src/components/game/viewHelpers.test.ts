import { describe, expect, it } from "vitest";
import { BOARD_PRESETS } from "@/game/boards";
import type { HumanGameView } from "@/game/types";
import { formatSystemMessage, getNightRoleTrackSteps } from "./viewHelpers";

describe("formatSystemMessage", () => {
  it("does not rewrite numeric seat names inside existing seat labels", () => {
    const game = {
      seats: [
        { seatId: 9, name: "9" },
        { seatId: 10, name: "10号" },
        { seatId: 11, name: "" },
      ],
    } as HumanGameView;

    expect(formatSystemMessage(game, "9号 选择上警，10号 留在警下。")).toBe("9号 选择上警，10号 留在警下。");
  });

  it("still rewrites real player names to seat labels", () => {
    const game = {
      seats: [
        { seatId: 2, name: "DeepSeek" },
        { seatId: 3, name: "你" },
      ],
    } as HumanGameView;

    expect(formatSystemMessage(game, "DeepSeek 选择退水。")).toBe("2号 选择退水。");
  });
});

describe("getNightRoleTrackSteps", () => {
  it("omits absent night roles from the 6-player beginner board", () => {
    const board = { roleSummary: "2狼 2民 预言家 猎人" } as HumanGameView["board"];

    const labels = getNightRoleTrackSteps(board).map((step) => step.label);

    expect(labels).toEqual(["狼人睁眼", "预言家睁眼"]);
    expect(labels).not.toContain("女巫睁眼");
  });

  it("keeps witch and guard steps for boards that include those roles", () => {
    const board = { roleSummary: "4狼 4民 预言家 女巫 猎人 守卫" } as HumanGameView["board"];

    expect(getNightRoleTrackSteps(board).map((step) => step.label)).toEqual([
      "狼人睁眼",
      "守卫睁眼",
      "预言家睁眼",
      "女巫睁眼",
    ]);
  });

  it("matches the night roles present in every official board", () => {
    const roleByLabel = {
      狼美人睁眼: "WOLF_BEAUTY",
      守卫睁眼: "GUARD",
      预言家睁眼: "SEER",
      女巫睁眼: "WITCH",
    } as const;

    for (const board of Object.values(BOARD_PRESETS)) {
      const labels = getNightRoleTrackSteps(board).map((step) => step.label);
      const boardRoles = new Set(board.roles);
      const mismatches = Object.entries(roleByLabel)
        .filter(([label, role]) => labels.includes(label) !== boardRoles.has(role))
        .map(([label, role]) => `${board.id}:${label}:${role}`);

      expect(labels[0]).toBe("狼人睁眼");
      expect(mismatches).toEqual([]);
    }
  });
});

import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import { formatSystemMessage } from "./viewHelpers";

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

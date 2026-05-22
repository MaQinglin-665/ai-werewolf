import { describe, expect, it } from "vitest";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import { buildActionGuidance } from "./actionGuidance";

const baseGame = {
  phaseLabel: "第 1 夜",
  myRoleLabel: "预言家",
} as HumanGameView;

describe("buildActionGuidance", () => {
  it("explains that seer checks are private and produce hidden information", () => {
    const guidance = buildActionGuidance({ type: "seerCheck", targets: [{ seatId: 2, name: "Claude" }] }, baseGame);

    expect(guidance.title).toContain("查验");
    expect(guidance.visibility).toContain("私密");
    expect(guidance.outcome).toContain("查验结果");
  });

  it("makes exile votes feel committed and publicly resolved", () => {
    const guidance = buildActionGuidance(
      { type: "vote", targets: [{ seatId: 3, name: "Kimi" }], canAbstain: true },
      { ...baseGame, phaseLabel: "第 1 天投票" } as HumanGameView,
    );

    expect(guidance.title).toContain("锁票");
    expect(guidance.visibility).toContain("公开");
    expect(guidance.outcome).toContain("开票");
  });

  it("shows continue actions as automatic table playback", () => {
    const action: AvailableHumanAction = { type: "continue", label: "播放 AI 行动", description: "系统继续结算" };

    expect(buildActionGuidance(action, baseGame)).toMatchObject({
      title: "自动推进",
      visibility: "观看流程",
    });
  });
});

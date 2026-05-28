import { describe, expect, it } from "vitest";

import { buildClassTrialDialogueTimeline, getClassTrialDialogueFrame } from "./classTrialDialogue";

describe("class trial dialogue helper", () => {
  it("uses character steps for short lines", () => {
    const timeline = buildClassTrialDialogueTimeline("我还想再听一下。");

    expect(timeline.mode).toBe("characters");
    expect(timeline.frames.slice(0, 4)).toEqual(["我", "我还", "我还想", "我还想再"]);
    expect(timeline.frames.at(-1)).toBe("我还想再听一下。");
  });

  it("uses sentence steps for long speeches", () => {
    const text = "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。这个缺口需要高松灯继续追问。";
    const timeline = buildClassTrialDialogueTimeline(text);

    expect(timeline.mode).toBe("segments");
    expect(timeline.frames).toEqual([
      "我先回到上一轮的票型。",
      "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。",
      "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。这个缺口需要高松灯继续追问。",
    ]);
  });

  it("falls back to full text for reduced motion", () => {
    const timeline = buildClassTrialDialogueTimeline("短句也直接显示。", { reducedMotion: true });

    expect(timeline.mode).toBe("full");
    expect(timeline.frames).toEqual(["短句也直接显示。"]);
  });

  it("returns thinking text before the first display frame", () => {
    const timeline = buildClassTrialDialogueTimeline("我会再想一下。");

    expect(getClassTrialDialogueFrame(timeline, -1)).toBe("正在思考/准备发言。");
    expect(getClassTrialDialogueFrame(timeline, 999)).toBe("我会再想一下。");
  });
});

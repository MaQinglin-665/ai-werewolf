import { describe, expect, it } from "vitest";

import {
  buildClassTrialDialogueTimeline,
  getClassTrialDialogueFrame,
  getClassTrialDialogueFrameByProgress,
} from "./classTrialDialogue";

describe("class trial dialogue helper", () => {
  it("uses character steps for short lines", () => {
    const timeline = buildClassTrialDialogueTimeline("我还想再听一下。");

    expect(timeline.mode).toBe("characters");
    expect(timeline.frames.slice(0, 4)).toEqual(["我", "我还", "我还想", "我还想再"]);
    expect(timeline.frames.at(-1)).toBe("我还想再听一下。");
  });

  it("uses compact segment steps for long speeches", () => {
    const text = "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。这个缺口需要高松灯继续追问。";
    const timeline = buildClassTrialDialogueTimeline(text);

    expect(timeline.mode).toBe("segments");
    expect(timeline.frames.length).toBeGreaterThan(3);
    expect(Array.from(timeline.frames[0] ?? "").length).toBeLessThanOrEqual(18);
    expect(timeline.frames[0]).not.toBe(text);
    expect(timeline.frames.at(-1)).toBe(text);
  });

  it("does not dump a long punctuation-light line in the first frame", () => {
    const text = "苗木诚刚才没有把三号的前后变化和投票压力连起来说明白所以这里不能直接放过还需要回到发言顺序";
    const timeline = buildClassTrialDialogueTimeline(text);

    expect(timeline.mode).toBe("segments");
    expect(Array.from(timeline.frames[0] ?? "").length).toBeLessThanOrEqual(18);
    expect(timeline.frames.at(-1)).toBe(text);
  });

  it("keeps long-speech reveal frames close to typewriter-sized chunks", () => {
    const text = "噗，苗木诚这段证词漂亮得像刚擦过的黑板，但他没有给出下一把尺子。".repeat(2);
    const timeline = buildClassTrialDialogueTimeline(text);

    expect(timeline.mode).toBe("segments");
    expect(Array.from(timeline.frames[0] ?? "").length).toBeLessThanOrEqual(10);
  });

  it("uses finer frames for long speeches so audio sync does not dump phrase-sized chunks", () => {
    const text = "苗木诚正在把公开证据和后置位压力重新连起来说明。".repeat(3);
    const timeline = buildClassTrialDialogueTimeline(text);

    expect(timeline.mode).toBe("segments");
    expect(Array.from(timeline.frames[0] ?? "").length).toBeLessThanOrEqual(4);
    expect(Array.from(timeline.frames[1] ?? "").length).toBeLessThanOrEqual(8);
    expect(timeline.frames.at(-1)).toBe(text);
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

  it("maps audio progress to dialogue frames", () => {
    const timeline = buildClassTrialDialogueTimeline("同步", { shortTextMaxLength: 10 });

    expect(getClassTrialDialogueFrameByProgress(timeline, 0)).toBe("同");
    expect(getClassTrialDialogueFrameByProgress(timeline, 0.49)).toBe("同");
    expect(getClassTrialDialogueFrameByProgress(timeline, 0.5)).toBe("同步");
    expect(getClassTrialDialogueFrameByProgress(timeline, 1)).toBe("同步");
  });

  it("returns undefined for invalid audio progress so callers can use the timer fallback", () => {
    const timeline = buildClassTrialDialogueTimeline("同步");

    expect(getClassTrialDialogueFrameByProgress(timeline, Number.NaN)).toBeUndefined();
    expect(getClassTrialDialogueFrameByProgress(timeline, Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(getClassTrialDialogueFrameByProgress(timeline, -0.1)).toBeUndefined();
    expect(getClassTrialDialogueFrameByProgress(timeline, 1.1)).toBeUndefined();
  });

  it("keeps reduced-motion timelines fully visible even when audio progress is partial", () => {
    const timeline = buildClassTrialDialogueTimeline("短句也直接显示。", { reducedMotion: true });

    expect(getClassTrialDialogueFrameByProgress(timeline, 0)).toBe("短句也直接显示。");
    expect(getClassTrialDialogueFrameByProgress(timeline, 0.3)).toBe("短句也直接显示。");
  });
});

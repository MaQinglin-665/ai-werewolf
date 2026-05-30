import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhaseCurtain, type PhaseCurtainCue } from "./PhaseCurtain";

describe("PhaseCurtain", () => {
  it("renders class-trial cues as a dedicated full-screen scene with result lines", () => {
    const cue: PhaseCurtainCue = {
      eyebrow: "第 2 天",
      title: "放逐判决",
      subtitle: "6号 被放逐出局。",
      tone: "danger",
      durationMs: 3000,
      presentation: "class-trial",
      resultLines: ["投票结束：6号 4票，2号 3票。"],
    };

    const html = renderToStaticMarkup(createElement(PhaseCurtain, { cue }));

    expect(html).toContain("class-trial-phase-scene");
    expect(html).toContain("class-trial-phase-verdict");
    expect(html).toContain("--curtain-duration:3000ms");
    expect(html).toContain("放逐判决");
    expect(html).toContain("6号 被放逐出局。");
    expect(html).toContain("投票结束：6号 4票，2号 3票。");
  });
});

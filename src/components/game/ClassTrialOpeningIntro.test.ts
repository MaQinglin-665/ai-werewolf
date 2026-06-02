import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassTrialOpeningIntro, getNextClassTrialIntroIndex } from "./ClassTrialOpeningIntro";
import type { ClassTrialIntroConfig } from "./classTrialIntro";

const introConfig: ClassTrialIntroConfig = {
  id: "test-opening",
  version: "test",
  characters: [
    {
      id: "anon",
      displayNameJa: "千早愛音",
      titleJa: "超高校級のギタリスト",
      subtitleJa: "言葉のテンポで裁判を揺らす。",
      portraitUrl: "/class-trial-pack/intro/anon.png",
      audioUrl: "/class-trial-pack/intro/anon.wav",
      themeColor: "#f6c94a",
      accentColor: "#101014",
      pattern: "shards",
      durationMs: 4200,
      audioMode: "external",
    },
    {
      id: "tomori",
      displayNameJa: "高松燈",
      titleJa: "超高校級のボーカリスト",
      subtitleJa: "小さな違和感を証言に変える。",
      portraitUrl: "/class-trial-pack/intro/tomori.png",
      audioUrl: "/class-trial-pack/intro/tomori.wav",
      themeColor: "#7dd3fc",
      accentColor: "#111827",
      pattern: "rings",
      durationMs: 4300,
      audioMode: "external",
    },
  ],
};

describe("ClassTrialOpeningIntro", () => {
  it("renders the first active title card as static markup", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialOpeningIntro, {
        config: introConfig,
        onComplete: () => undefined,
        onSkip: () => undefined,
      }),
    );

    expect(html).toContain("class-trial-opening-intro");
    expect(html).toContain("class-trial-opening-intro-shards");
    expect(html).toContain("--class-trial-intro-theme:#f6c94a");
    expect(html).toContain("--class-trial-intro-accent:#101014");
    expect(html).toContain('src="/class-trial-pack/intro/anon.png"');
    expect(html).toContain('alt="千早愛音"');
    expect(html).toContain("超高校級のギタリスト");
    expect(html).toContain("千早愛音");
    expect(html).toContain("言葉のテンポで裁判を揺らす。");
    expect(html).toContain("class-trial-opening-intro-progress");
    expect(html).toContain("跳过");
    expect(html).not.toContain("1号");
  });

  it("returns the next index until the sequence is complete", () => {
    expect(getNextClassTrialIntroIndex(0, 2)).toEqual({ index: 1, complete: false });
    expect(getNextClassTrialIntroIndex(1, 2)).toEqual({ index: 1, complete: true });
  });

  it("treats empty or negative totals as complete", () => {
    expect(getNextClassTrialIntroIndex(0, 0)).toEqual({ index: 0, complete: true });
    expect(getNextClassTrialIntroIndex(0, -1)).toEqual({ index: 0, complete: true });
  });
});

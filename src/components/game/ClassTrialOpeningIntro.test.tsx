import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ClassTrialOpeningIntro, getNextClassTrialIntroIndex } from "./ClassTrialOpeningIntro";
import type { ClassTrialIntroConfig } from "./classTrialIntro";

const introConfig = {
  id: "test-opening",
  version: "test",
  characters: [
    {
      id: "anon",
      displayNameJa: "千早 愛音",
      titleJa: "超高校級のギタリスト",
      subtitleJa: "あはは...",
      portraitUrl: "/class-trial-pack/intro/portraits/anon.png",
      audioUrl: "/class-trial-pack/intro/audio/anon.wav",
      themeColor: "#f6c94a",
      accentColor: "#101014",
      pattern: "shards",
      durationMs: 4200,
      audioMode: "external",
    },
    {
      id: "tomori",
      displayNameJa: "高松 燈",
      titleJa: "超高校級の詩人",
      subtitleJa: "ペンギン、ぐーぐーがーがー。",
      portraitUrl: "/class-trial-pack/intro/portraits/tomori.png",
      audioUrl: "/class-trial-pack/intro/audio/tomori.wav",
      themeColor: "#56b7e8",
      accentColor: "#151923",
      pattern: "rings",
      durationMs: 4200,
      audioMode: "external",
    },
  ],
} as ClassTrialIntroConfig;

describe("ClassTrialOpeningIntro", () => {
  test("renders the first character with the approved opening intro markup", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialOpeningIntro, {
        config: introConfig,
        onComplete: () => undefined,
        onSkip: () => undefined,
      }),
    );

    expect(html).toContain("class-trial-opening-intro");
    expect(html).toContain("class-trial-opening-intro-shards");
    expect(html).toContain("class-trial-opening-intro-bg");
    expect(html).toContain("class-trial-opening-intro-slice");
    expect(html).toContain("class-trial-opening-intro-character");
    expect(html).toContain("class-trial-opening-intro-portrait");
    expect(html).toContain("class-trial-opening-intro-title-band");
    expect(html).toContain("class-trial-opening-intro-subtitle");
    expect(html).toContain("class-trial-opening-intro-progress");
    expect(html).toContain("class-trial-opening-intro-progress-active");
    expect(html).toContain("class-trial-opening-intro-skip");
    expect(html).toContain("超高校級のギタリスト");
    expect(html).toContain("千早 愛音");
    expect(html).toContain("あはは...");
    expect(html).toContain('src="/class-trial-pack/intro/portraits/anon.png"');
    expect(html).toContain('alt="千早 愛音"');
    expect(html).toContain("跳过");
    expect(html).not.toContain("1号");
  });

  test("returns the next index until the intro is complete", () => {
    expect(getNextClassTrialIntroIndex(0, 2)).toEqual({ index: 1, complete: false });
    expect(getNextClassTrialIntroIndex(1, 2)).toEqual({ index: 1, complete: true });
    expect(getNextClassTrialIntroIndex(0, 0)).toEqual({ index: 0, complete: true });
  });
});

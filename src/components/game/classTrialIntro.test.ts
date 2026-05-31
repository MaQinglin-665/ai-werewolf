import { describe, expect, it } from "vitest";
import {
  CLASS_TRIAL_OPENING_INTRO_ORDER,
  type ClassTrialIntroCharacter,
  type ClassTrialIntroConfig,
  buildClassTrialIntroSourcePath,
  getClassTrialIntroStatus,
  sanitizeClassTrialIntroConfig,
} from "./classTrialIntro";

describe("classTrialIntro", () => {
  it("uses the confirmed reverse character order", () => {
    expect(CLASS_TRIAL_OPENING_INTRO_ORDER).toEqual([
      "anon",
      "tomori",
      "togami",
      "celestia",
      "enoshima",
      "monokuma",
      "fukawa",
      "kirigiri",
      "naegi",
    ]);
  });

  it("rejects non-record input and records without a characters array", () => {
    expect(sanitizeClassTrialIntroConfig(undefined)).toBeUndefined();
    expect(sanitizeClassTrialIntroConfig(null)).toBeUndefined();
    expect(sanitizeClassTrialIntroConfig("intro")).toBeUndefined();
    expect(sanitizeClassTrialIntroConfig([])).toBeUndefined();
    expect(sanitizeClassTrialIntroConfig({})).toBeUndefined();
    expect(sanitizeClassTrialIntroConfig({ characters: "anon" })).toBeUndefined();
  });

  it("sanitizes a complete intro config", () => {
    const config = sanitizeClassTrialIntroConfig({
      id: "custom-id",
      version: "local-test",
      characters: makeIntroCharacters((character, index) => ({
        ...character,
        themeColor: index === 0 ? "#ef4c6a" : character.themeColor,
        accentColor: index === 0 ? "#202024" : character.accentColor,
        externalSourceUrl:
          character.id === "anon" ? " https://www.bilibili.com/video/BV1WGS3YMEZz/ " : undefined,
        externalSourceRange: character.id === "anon" ? " 0:00-0:03 " : undefined,
      })),
    });

    expect(config?.id).toBe("custom-id");
    expect(config?.version).toBe("local-test");
    expect(config?.characters.map((item) => item.id)).toEqual(CLASS_TRIAL_OPENING_INTRO_ORDER);
    expect(config?.characters[0]?.displayNameJa).toBe("anon-ja");
    expect(config?.characters[0]?.externalSourceUrl).toBe("https://www.bilibili.com/video/BV1WGS3YMEZz/");
    expect(config?.characters[0]?.externalSourceRange).toBe("0:00-0:03");
  });

  it("defaults missing or invalid config id and version", () => {
    const missingValues = sanitizeClassTrialIntroConfig({
      characters: makeIntroCharacters(),
    });
    const invalidValues = sanitizeClassTrialIntroConfig({
      id: "   ",
      version: 42,
      characters: makeIntroCharacters(),
    });

    expect(missingValues?.id).toBe("class-trial-opening-intro");
    expect(missingValues?.version).toBe("local");
    expect(invalidValues?.id).toBe("class-trial-opening-intro");
    expect(invalidValues?.version).toBe("local");
  });

  it("defaults invalid colors and clamps or defaults durations", () => {
    const config = sanitizeClassTrialIntroConfig({
      characters: makeIntroCharacters((character, index) => ({
        ...character,
        themeColor: index === 0 ? "gold" : character.themeColor,
        accentColor: index === 0 ? "#123" : character.accentColor,
        durationMs: index === 0 ? Number.NaN : index === 1 ? 1200 : index === 2 ? Number.POSITIVE_INFINITY : 7200,
      })),
    });

    expect(config?.characters[0]?.themeColor).toBe("#f6c94a");
    expect(config?.characters[0]?.accentColor).toBe("#101014");
    expect(config?.characters[0]?.durationMs).toBe(5200);
    expect(config?.characters[1]?.durationMs).toBe(4000);
    expect(config?.characters[2]?.durationMs).toBe(5200);
    expect(config?.characters[3]?.durationMs).toBe(6400);
  });

  it("preserves optional external source metadata as bounded strings", () => {
    const config = sanitizeClassTrialIntroConfig({
      characters: makeIntroCharacters((character, index) => ({
        ...character,
        externalSourceUrl:
          index === 0 ? ` https://example.com/${"x".repeat(300)} ` : character.externalSourceUrl,
        externalSourceRange: index === 0 ? ` ${"0:00-0:03 ".repeat(10)} ` : character.externalSourceRange,
      })),
    });

    expect(config?.characters[0]?.externalSourceUrl).toHaveLength(260);
    expect(config?.characters[0]?.externalSourceUrl?.startsWith("https://example.com/")).toBe(true);
    expect(config?.characters[0]?.externalSourceRange).toHaveLength(40);
    expect(config?.characters[0]?.externalSourceRange?.startsWith("0:00-0:03")).toBe(true);
  });

  it("rejects configs that are missing confirmed characters or reverse order", () => {
    const missingConfig = sanitizeClassTrialIntroConfig({
      characters: [
        {
          id: "naegi",
          displayNameJa: "苗木 誠",
          titleJa: "超高校級の幸運",
          subtitleJa: "それは違うよ!",
          portraitUrl: "/class-trial-pack/intro/portraits/naegi.png",
          audioUrl: "/class-trial-pack/intro/audio/naegi.wav",
          themeColor: "#f6c94a",
          accentColor: "#111111",
          pattern: "rings",
          durationMs: 5200,
          audioMode: "generated",
        },
      ],
    });
    const wrongOrderConfig = sanitizeClassTrialIntroConfig({
      characters: CLASS_TRIAL_OPENING_INTRO_ORDER.toReversed().map((id) => ({
        id,
        displayNameJa: `${id}-ja`,
        titleJa: "超高校級",
        subtitleJa: "line",
        portraitUrl: `/class-trial-pack/intro/portraits/${id}.png`,
        audioUrl: `/class-trial-pack/intro/audio/${id}.wav`,
        themeColor: "#f6c94a",
        accentColor: "#111111",
        pattern: "rings",
        durationMs: 5200,
        audioMode: "generated",
      })),
    });

    expect(missingConfig).toBeUndefined();
    expect(wrongOrderConfig).toBeUndefined();
  });

  it("rejects configs with invalid required character fields", () => {
    const cases: Array<[string, Partial<ClassTrialIntroCharacter>]> = [
      ["non-local portraitUrl", { portraitUrl: "/images/naegi.png" }],
      ["non-local audioUrl", { audioUrl: "https://example.com/naegi.wav" }],
      ["invalid pattern", { pattern: "waves" as ClassTrialIntroCharacter["pattern"] }],
      ["invalid audioMode", { audioMode: "cached" as ClassTrialIntroCharacter["audioMode"] }],
      ["missing displayNameJa", { displayNameJa: undefined as unknown as string }],
      ["empty displayNameJa", { displayNameJa: "   " }],
      ["missing titleJa", { titleJa: undefined as unknown as string }],
      ["empty titleJa", { titleJa: "   " }],
      ["missing subtitleJa", { subtitleJa: undefined as unknown as string }],
      ["empty subtitleJa", { subtitleJa: "   " }],
    ];

    for (const [name, override] of cases) {
      expect(
        sanitizeClassTrialIntroConfig({
          characters: makeIntroCharacters((character, index) => (index === 0 ? { ...character, ...override } : character)),
        }),
        name,
      ).toBeUndefined();
    }
  });

  it("accepts safe local intro asset urls with Japanese or ASCII filenames", () => {
    const config = sanitizeClassTrialIntroConfig({
      characters: makeIntroCharacters((character, index) =>
        index === 0
          ? {
              ...character,
              portraitUrl: "/class-trial-pack/intro/portraits/苗木誠.png",
              audioUrl: "/class-trial-pack/intro/audio/naegi.wav",
            }
          : character,
      ),
    });

    expect(config?.characters[0]?.portraitUrl).toBe("/class-trial-pack/intro/portraits/苗木誠.png");
    expect(config?.characters[0]?.audioUrl).toBe("/class-trial-pack/intro/audio/naegi.wav");
  });

  it("rejects local intro asset urls with traversal or encoded unsafe segments", () => {
    const cases: Array<[string, Partial<ClassTrialIntroCharacter>]> = [
      ["plain portrait traversal", { portraitUrl: "/class-trial-pack/intro/../audio/foo.wav" }],
      ["plain audio traversal", { audioUrl: "/class-trial-pack/intro/audio/../foo.wav" }],
      ["encoded portrait traversal", { portraitUrl: "/class-trial-pack/intro/%2e%2e/audio/foo.wav" }],
      ["encoded audio traversal", { audioUrl: "/class-trial-pack/intro/audio/%2E%2E/foo.wav" }],
      ["encoded portrait slash", { portraitUrl: "/class-trial-pack/intro/portraits%2fnaegi.png" }],
      ["encoded audio backslash", { audioUrl: "/class-trial-pack/intro/audio%5cnaegi.wav" }],
    ];

    for (const [name, override] of cases) {
      expect(
        sanitizeClassTrialIntroConfig({
          characters: makeIntroCharacters((character, index) => (index === 0 ? { ...character, ...override } : character)),
        }),
        name,
      ).toBeUndefined();
    }
  });

  it("reports missing local intro config status", () => {
    const status = getClassTrialIntroStatus(undefined);

    expect(status.available).toBe(false);
    expect(status.message).toContain("未找到本地开场片头配置");
    expect(status.readyCharacterIds).toEqual([]);
    expect(status.missingCharacterIds).toEqual(CLASS_TRIAL_OPENING_INTRO_ORDER);
  });

  it("reports characters without portrait or audio as missing from readiness", () => {
    const completeConfig = sanitizeClassTrialIntroConfig({
      characters: makeIntroCharacters(),
    });
    expect(completeConfig).toBeDefined();

    const configWithMissingAsset = {
      ...completeConfig,
      characters: completeConfig!.characters.map((character, index) =>
        index === 0
          ? ({
              ...character,
              portraitUrl: "",
              audioUrl: "",
            } as unknown as ClassTrialIntroCharacter)
          : character,
      ),
    } as ClassTrialIntroConfig;

    const status = getClassTrialIntroStatus(configWithMissingAsset);

    expect(status.available).toBe(false);
    expect(status.missingCharacterIds).toContain("anon");
    expect(status.readyCharacterIds).toContain("tomori");
    expect(status.message).toMatch(/缺少 1 个角色|缺少.*素材/);
  });

  it("builds local pack source paths without path traversal", () => {
    expect(buildClassTrialIntroSourcePath(["intro", "audio", "naegi.wav"])).toBe(
      "/class-trial-pack/intro/audio/naegi.wav",
    );
    expect(buildClassTrialIntroSourcePath(["intro", "..", ".env"])).toBeUndefined();
    expect(buildClassTrialIntroSourcePath(["intro/audio", "naegi.wav"])).toBeUndefined();
    expect(buildClassTrialIntroSourcePath(["intro", "audio\\naegi.wav"])).toBeUndefined();
    expect(buildClassTrialIntroSourcePath([])).toBeUndefined();
  });
});

function makeIntroCharacters(
  mapCharacter: (character: ClassTrialIntroCharacter, index: number) => ClassTrialIntroCharacter = (character) => character,
): ClassTrialIntroCharacter[] {
  return CLASS_TRIAL_OPENING_INTRO_ORDER.map((id, index) =>
    mapCharacter(
      {
        id,
        displayNameJa: `${id}-ja`,
        titleJa: `超高校級の${index}`,
        subtitleJa: `line-${index}`,
        portraitUrl: `/class-trial-pack/intro/portraits/${id}.png`,
        audioUrl: `/class-trial-pack/intro/audio/${id}.wav`,
        themeColor: "#f6c94a",
        accentColor: "#101014",
        pattern: index % 2 === 0 ? "shards" : "rings",
        durationMs: 5200,
        audioMode: id === "anon" || id === "tomori" ? "external" : "generated",
      },
      index,
    ),
  );
}

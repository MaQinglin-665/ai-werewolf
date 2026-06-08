import { describe, expect, it } from "vitest";
import { getDefaultAiFriends } from "./aiFriends";
import {
  ORDINARY_PLAYER_TYPE_PRESETS,
  ORDINARY_PLAYER_TYPE_OPTIONS,
  applyOrdinaryPlayerTypePreset,
  defaultOrdinaryPlayerProfile,
  inferOrdinaryPlayerTypeId,
  isOrdinaryPlayerTypeId,
  ordinaryPlayerProfileSummary,
  sanitizeOrdinaryPlayerProfile,
} from "./ordinaryPlayerProfiles";

describe("ordinary player profiles", () => {
  it("keeps the preset order and readable labels", () => {
    expect(Object.keys(ORDINARY_PLAYER_TYPE_PRESETS)).toEqual([
      "impatient-pusher",
      "cautious-backpacker",
      "one-line-catcher",
      "soft-follower",
      "role-sensitive",
      "quiet-watcher",
      "emotional-reactor",
      "pivot-admitter",
    ]);
    expect(ORDINARY_PLAYER_TYPE_OPTIONS.map((preset) => preset.label)).toEqual([
      "急性子冲票型",
      "谨慎怕背锅型",
      "爱抓一句话",
      "容易跟风型",
      "身份信息敏感型",
      "低调观察型",
      "情绪反应型",
      "临场改口型",
    ]);
    expect(ORDINARY_PLAYER_TYPE_PRESETS["one-line-catcher"].label).toBe("爱抓一句话");
    expect(ORDINARY_PLAYER_TYPE_PRESETS["one-line-catcher"].speechCue).toContain("具体话");
    expect(ORDINARY_PLAYER_TYPE_PRESETS["role-sensitive"].actionCue).toContain("身份");
    expect(ORDINARY_PLAYER_TYPE_PRESETS["cautious-backpacker"].sliders.caution).toBeGreaterThan(0.7);
    expect(isOrdinaryPlayerTypeId("quiet-watcher")).toBe(true);
    expect(isOrdinaryPlayerTypeId("table-jargon")).toBe(false);
  });

  it("sanitizes profile type and clamps sliders", () => {
    const profile = sanitizeOrdinaryPlayerProfile(
      {
        playerTypeId: "bad-type",
        sliders: {
          directness: 2,
          emotion: -1,
          speechLength: "0.25",
          questionBias: Number.NaN,
          factBias: 0.4,
          identityBias: null,
          voteBias: "",
          memoryBias: false,
          nightAggression: true,
        },
      },
      "cautious-backpacker",
    );

    expect(profile.playerTypeId).toBe("cautious-backpacker");
    expect(profile.sliders.directness).toBe(1);
    expect(profile.sliders.emotion).toBe(0);
    expect(profile.sliders.speechLength).toBe(0.25);
    expect(profile.sliders.questionBias).toBe(defaultOrdinaryPlayerProfile("cautious-backpacker").sliders.questionBias);
    expect(profile.sliders.identityBias).toBe(defaultOrdinaryPlayerProfile("cautious-backpacker").sliders.identityBias);
    expect(profile.sliders.voteBias).toBe(defaultOrdinaryPlayerProfile("cautious-backpacker").sliders.voteBias);
    expect(profile.sliders.memoryBias).toBe(defaultOrdinaryPlayerProfile("cautious-backpacker").sliders.memoryBias);
    expect(profile.sliders.nightAggression).toBe(defaultOrdinaryPlayerProfile("cautious-backpacker").sliders.nightAggression);
    expect(Object.values(profile.sliders).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("infers quiet watcher from the legacy Gemini tuning", () => {
    const gemini = getDefaultAiFriends("test").find((friend) => friend.basePersonaId === "gemini-quiet-observer")!;

    expect(inferOrdinaryPlayerTypeId(gemini)).toBe("quiet-watcher");
  });

  it("applies a preset without replacing friend identity or model config", () => {
    const friend = {
      ...getDefaultAiFriends("test")[0]!,
      id: "friend-stable",
      basePersonaId: "deepseek-calm-analyst",
      llmConfig: {
        provider: "openai-compatible" as const,
        label: "私有模型",
        baseUrl: "https://llm.example.com/v1",
        model: "custom",
      },
    };

    const result = applyOrdinaryPlayerTypePreset(friend, "one-line-catcher");

    expect(result.id).toBe("friend-stable");
    expect(result.basePersonaId).toBe("deepseek-calm-analyst");
    expect(result.llmConfig).toEqual(friend.llmConfig);
    expect(result.ordinaryPlayerProfile?.playerTypeId).toBe("one-line-catcher");
    expect(result.preferences.memory).toBeGreaterThan(0.65);
    expect(result.preferences.leadership).toBeLessThan(0.6);
    expect(ordinaryPlayerProfileSummary(result.ordinaryPlayerProfile)).toContain("爱抓一句话");
  });
});

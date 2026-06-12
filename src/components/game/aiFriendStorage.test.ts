import { describe, expect, it } from "vitest";
import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import { buildAiFriendOptions, resolveEffectiveAiRuntimeMode, resolveSelectedAiFriends } from "./aiFriendStorage";

describe("resolveEffectiveAiRuntimeMode", () => {
  it("forces class-trial themed games onto real LLM mode", () => {
    expect(resolveEffectiveAiRuntimeMode("mock", "class-trial")).toBe("llm");
  });

  it("preserves the selected runtime mode outside the class-trial theme", () => {
    expect(resolveEffectiveAiRuntimeMode("mock", "default")).toBe("mock");
    expect(resolveEffectiveAiRuntimeMode("llm", "default")).toBe("llm");
  });
});

describe("resolveSelectedAiFriends", () => {
  it("returns pure AI friend configs without UI-only option fields", () => {
    const custom = copyAiFriend(getDefaultAiFriends("test")[0]!, {
      id: "friend-storage-config",
      now: "2026-06-08T00:00:00.000Z",
    });
    const selected = resolveSelectedAiFriends(buildAiFriendOptions([custom]), [custom.id]);

    expect(selected[0]).toMatchObject({
      id: custom.id,
      ordinaryPlayerProfile: custom.ordinaryPlayerProfile,
    });
    expect(selected[0]).not.toHaveProperty("isDefault");
    expect(selected[0]).not.toHaveProperty("basePersonaName");
    expect(selected[0]).not.toHaveProperty("strategySummary");
    expect(selected[0]).not.toHaveProperty("ordinaryPlayerTypeLabel");
    expect(selected[0]).not.toHaveProperty("ordinaryPlayerTypeSummary");
  });
});

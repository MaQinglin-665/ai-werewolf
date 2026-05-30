import { describe, expect, it } from "vitest";
import { resolveEffectiveAiRuntimeMode } from "./aiFriendStorage";

describe("resolveEffectiveAiRuntimeMode", () => {
  it("forces class-trial themed games onto real LLM mode", () => {
    expect(resolveEffectiveAiRuntimeMode("mock", "class-trial")).toBe("llm");
  });

  it("preserves the selected runtime mode outside the class-trial theme", () => {
    expect(resolveEffectiveAiRuntimeMode("mock", "default")).toBe("mock");
    expect(resolveEffectiveAiRuntimeMode("llm", "default")).toBe("llm");
  });
});

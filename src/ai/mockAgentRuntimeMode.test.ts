import { describe, expect, it } from "vitest";
import { sanitizeRuntimeAiProviderMode } from "@/game/llmConfig";
import { createConfiguredAiOptions } from "./mockAgent";

describe("AI runtime provider mode", () => {
  it("sanitizes supported runtime modes", () => {
    expect(sanitizeRuntimeAiProviderMode("mock")).toBe("mock");
    expect(sanitizeRuntimeAiProviderMode("models")).toBe("models");
    expect(sanitizeRuntimeAiProviderMode("MOCK")).toBe("mock");
    expect(sanitizeRuntimeAiProviderMode("openai")).toBeUndefined();
  });

  it("forces mock providers when requested", () => {
    const options = createConfiguredAiOptions("mock");

    expect(options.speechProvider?.providerId).toBe("mock-speech");
    expect(options.actionProvider?.providerId).toBe("mock-action");
  });
});

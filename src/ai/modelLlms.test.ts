import { afterEach, describe, expect, it, vi } from "vitest";

import { callRoutedModelJson } from "./modelLlms";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("model LLM routing", () => {
  it("tries gpt-5.5 when the primary GPT model request fails", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_MODEL_GPT = "gpt-5.4";
    delete process.env.GPT_FALLBACK_MODELS;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { model: string };
      if (requestBody.model === "gpt-5.4") {
        throw new TypeError("fetch failed");
      }

      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "GPT",
      task: "action",
      system: "Return JSON.",
      input: { seat: 1 },
      maxTokens: 100,
    });

    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { model: string };
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(secondRequest.model).toBe("gpt-5.5");
    expect(result).toEqual({ text: "{\"ok\":true}", providerId: "gpt-action:gpt-5.5" });
  });
});

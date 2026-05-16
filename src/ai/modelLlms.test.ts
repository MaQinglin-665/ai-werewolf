import { afterEach, describe, expect, it, vi } from "vitest";

import { callRoutedModelJson, callRoutedModelJsonWithFallbacks } from "./modelLlms";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("model LLM routing", () => {
  it("uses gpt-5.5 as the default GPT model", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    delete process.env.AI_MODEL_GPT;

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "GPT",
      task: "action",
      system: "Return JSON.",
      input: { seat: 1 },
      maxTokens: 100,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const request = JSON.parse(String(calls[0]![1]?.body)) as { model: string };
    expect(request.model).toBe("gpt-5.5");
    expect(result.providerId).toBe("gpt-action:gpt-5.5");
  });

  it("extracts text from non-streamed SSE responses", async () => {
    process.env.AI_LLM_API_KEY = "test-key";

    const fetchMock = vi.fn(async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}',
          'data: {"choices":[{"delta":{"content":"true}"}}]}',
          "data: [DONE]",
        ].join("\n\n"),
        {
          status: 200,
          headers: { "content-type": "text/plain" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "GPT",
      task: "speech",
      system: "Return JSON.",
      input: { seat: 1 },
      maxTokens: 100,
    });

    expect(result.text).toBe("{\"ok\":true}");
  });

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

  it("uses a runtime custom OpenAI-compatible model when provided", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "GPT",
      task: "action",
      system: "Return JSON.",
      input: { seat: 1 },
      maxTokens: 100,
      customLlm: {
        provider: "openai-compatible",
        label: "自定义",
        baseUrl: "https://llm.example.com/v1",
        model: "custom-model",
        apiKey: "custom-secret",
      },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const [url, init] = calls[0]!;
    const request = JSON.parse(String(init?.body)) as { model: string };
    const headers = init?.headers as Record<string, string>;
    expect(String(url)).toBe("https://llm.example.com/v1/chat/completions");
    expect(request.model).toBe("custom-model");
    expect(headers.Authorization).toBe("Bearer custom-secret");
    expect(result).toEqual({ text: "{\"ok\":true}", providerId: "custom-action:custom-model" });
  });

  it("can route action requests to another persona when the primary provider fails", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.4";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { model: string };
      if (requestBody.model === "deepseek-v4-flash") {
        return new Response(JSON.stringify({ error: { message: "upstream 502" } }), { status: 502 });
      }

      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"candidateId\":\"vote:2\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJsonWithFallbacks({
      personaName: "DeepSeek",
      fallbackPersonaNames: ["GPT"],
      task: "action",
      system: "Return JSON.",
      input: { candidates: [{ id: "vote:2" }] },
      maxTokens: 100,
    });

    const models = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as { model: string });
    expect(models.map((body) => body.model)).toEqual(["deepseek-v4-flash", "gpt-5.4"]);
    expect(result).toEqual({ text: "{\"candidateId\":\"vote:2\"}", providerId: "gpt-action:gpt-5.4" });
  });
});

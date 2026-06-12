import { afterEach, describe, expect, it, vi } from "vitest";

import { callRoutedModelJson, callRoutedModelJsonWithFallbacks, readLlmOutputMaxAttempts } from "./modelLlms";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("model LLM routing", () => {
  it("keeps the default LLM output retry count unchanged", () => {
    delete process.env.AI_LLM_MAX_RETRIES;
    delete process.env.AI_LLM_MAX_RETRIES_CAP;

    expect(readLlmOutputMaxAttempts()).toBe(2);
  });

  it("allows explicit long-run retry counts above the old three-retry ceiling", () => {
    process.env.AI_LLM_MAX_RETRIES = "6";
    delete process.env.AI_LLM_MAX_RETRIES_CAP;

    expect(readLlmOutputMaxAttempts()).toBe(7);
  });

  it("can cap explicit long-run retry counts", () => {
    process.env.AI_LLM_MAX_RETRIES = "9";
    process.env.AI_LLM_MAX_RETRIES_CAP = "4";

    expect(readLlmOutputMaxAttempts()).toBe(5);
  });

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

  it("allows non-GLM speech requests to use a 60s default timeout cap", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_TIMEOUT_MS = "60000";
    delete process.env.AI_LLM_SPEECH_TIMEOUT_MS;
    delete process.env.AI_LLM_SPEECH_TIMEOUT_MS_CAP;
    delete process.env.GPT_TIMEOUT_MS;
    delete process.env.GPT_SPEECH_TIMEOUT_MS;

    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callRoutedModelJson({
      personaName: "GPT",
      task: "speech",
      system: "Return JSON.",
      input: { seat: 1 },
      maxTokens: 100,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
  });

  it("gives Mimo speech requests a longer default timeout", async () => {
    process.env.MIMO_LLM_API_KEY = "test-key";
    delete process.env.AI_LLM_TIMEOUT_MS;
    delete process.env.AI_LLM_SPEECH_TIMEOUT_MS;
    delete process.env.AI_LLM_SPEECH_TIMEOUT_MS_CAP;
    delete process.env.MIMO_LLM_TIMEOUT_MS;
    delete process.env.MIMO_LLM_SPEECH_TIMEOUT_MS;

    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callRoutedModelJson({
      personaName: "Mimo",
      task: "speech",
      system: "Return JSON.",
      input: { seat: 1 },
      maxTokens: 100,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 180000);
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

  it("routes custom DeepSeek reasoner action requests to deepseek-chat for JSON stability", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"candidateId\":\"vote:2\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "Claude",
      task: "action",
      system: "Return JSON.",
      input: { candidates: [{ id: "vote:2" }] },
      maxTokens: 100,
      customLlm: {
        provider: "openai-compatible",
        label: "deepseek-reasoner",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-reasoner",
        apiKey: "custom-secret",
        mergeSystemIntoUser: true,
      },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const request = JSON.parse(String(calls[0]![1]?.body)) as { model: string };
    expect(request.model).toBe("deepseek-chat");
    expect(result).toEqual({ text: "{\"candidateId\":\"vote:2\"}", providerId: "custom-action:deepseek-chat" });
  });

  it("can disable custom action model overrides for A/B checks", async () => {
    process.env.AI_LLM_CUSTOM_ACTION_MODEL_OVERRIDES = "off";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"candidateId\":\"vote:2\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "Claude",
      task: "action",
      system: "Return JSON.",
      input: { candidates: [{ id: "vote:2" }] },
      maxTokens: 100,
      customLlm: {
        provider: "openai-compatible",
        label: "deepseek-reasoner",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-reasoner",
        apiKey: "custom-secret",
        mergeSystemIntoUser: true,
      },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const request = JSON.parse(String(calls[0]![1]?.body)) as { model: string };
    expect(request.model).toBe("deepseek-reasoner");
    expect(result).toEqual({ text: "{\"candidateId\":\"vote:2\"}", providerId: "custom-action:deepseek-reasoner" });
  });

  it("keeps custom DeepSeek reasoner speech requests on deepseek-reasoner", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"speech\":\"我继续盘公开信息。\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "Claude",
      task: "speech",
      system: "Return JSON.",
      input: { seat: 2 },
      maxTokens: 100,
      customLlm: {
        provider: "openai-compatible",
        label: "deepseek-reasoner",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-reasoner",
        apiKey: "custom-secret",
        mergeSystemIntoUser: true,
      },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const request = JSON.parse(String(calls[0]![1]?.body)) as { model: string };
    expect(request.model).toBe("deepseek-reasoner");
    expect(result).toEqual({ text: "{\"speech\":\"我继续盘公开信息。\"}", providerId: "custom-speech:deepseek-reasoner" });
  });

  it("applies Mimo speech safeguards to runtime custom Mimo configs", async () => {
    process.env.AI_LLM_API_KEY = "tp-test";
    process.env.AI_LLM_SPEECH_MAX_TOKENS_CAP = "3200";
    delete process.env.AI_LLM_TIMEOUT_MS;
    delete process.env.AI_LLM_SPEECH_TIMEOUT_MS;
    delete process.env.AI_LLM_SPEECH_TIMEOUT_MS_CAP;

    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"speech\":\"我继续盘公开信息。\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRoutedModelJson({
      personaName: "Claude",
      task: "speech",
      system: "Return JSON.",
      input: { seat: 2 },
      maxTokens: 900,
      customLlm: {
        provider: "openai-compatible",
        label: "mimo-v2.5-pro",
        baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
        model: "mimo-v2.5-pro",
        mergeSystemIntoUser: true,
      },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const [url, init] = calls[0]!;
    const request = JSON.parse(String(init?.body)) as { max_tokens: number; thinking?: { type?: string } };
    const headers = init?.headers as Record<string, string>;
    expect(String(url)).toBe("https://token-plan-cn.xiaomimimo.com/v1/chat/completions");
    expect(headers.Authorization).toBe("Bearer tp-test");
    expect(request.max_tokens).toBeGreaterThanOrEqual(2400);
    expect(request.thinking).toEqual({ type: "disabled" });
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 180000);
    expect(result).toEqual({ text: "{\"speech\":\"我继续盘公开信息。\"}", providerId: "custom-speech:mimo-v2.5-pro" });
  });

  it("disables DeepSeek action thinking to avoid reasoning-token empty JSON attempts", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    delete process.env.DEEPSEEK_ACTION_MAX_TOKENS;
    delete process.env.DEEPSEEK_MAX_TOKENS;
    delete process.env.AI_LLM_ACTION_MAX_TOKENS;

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"candidateId\":\"vote:2\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callRoutedModelJson({
      personaName: "DeepSeek",
      task: "action",
      system: "Return JSON.",
      input: { candidates: [{ id: "vote:2" }] },
      maxTokens: 220,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const request = JSON.parse(String(calls[0]![1]?.body)) as { max_tokens: number; thinking?: { type?: string } };
    expect(request.max_tokens).toBeGreaterThanOrEqual(900);
    expect(request.thinking).toEqual({ type: "disabled" });
  });

  it("disables DeepSeek speech thinking so speech can use the normal response budget", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    delete process.env.DEEPSEEK_SPEECH_MAX_TOKENS;
    delete process.env.DEEPSEEK_MAX_TOKENS;
    delete process.env.AI_LLM_SPEECH_MAX_TOKENS;

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"speech\":\"我继续盘公开信息。\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callRoutedModelJson({
      personaName: "DeepSeek",
      task: "speech",
      system: "Return JSON.",
      input: { seat: 2 },
      maxTokens: 900,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
    const request = JSON.parse(String(calls[0]![1]?.body)) as { max_tokens: number; thinking?: { type?: string } };
    expect(request.max_tokens).toBeGreaterThanOrEqual(900);
    expect(request.thinking).toEqual({ type: "disabled" });
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

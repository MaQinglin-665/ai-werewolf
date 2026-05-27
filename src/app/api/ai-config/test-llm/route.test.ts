import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/ai-config/test-llm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tests connectivity and project speech format without exposing the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: "我是3号，先听发言。" } }] }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/ai-config/test-llm", {
        method: "POST",
        body: JSON.stringify({
          name: "DeepSeek",
          baseUrl: "https://llm.example.com/v1",
          model: "deepseek-chat",
          apiKey: "secret-api-key",
          mergeSystemIntoUser: true,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connectivity.ok).toBe(true);
    expect(body.projectFormat.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-api-key");
  });

  it("redacts the API key from upstream error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "invalid key secret-api-key",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/ai-config/test-llm", {
        method: "POST",
        body: JSON.stringify({
          name: "Broken",
          baseUrl: "https://llm.example.com/v1",
          model: "broken-model",
          apiKey: "secret-api-key",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connectivity.ok).toBe(false);
    expect(body.projectFormat.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("secret-api-key");
    expect(body.connectivity.error).toContain("***");
  });

  it("rejects malformed payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai-config/test-llm", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: "not a url",
          model: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});

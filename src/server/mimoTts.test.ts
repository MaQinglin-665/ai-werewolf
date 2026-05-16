import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMimoChatCompletionsUrl, generateMimoTtsAudio } from "./mimoTts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Mimo TTS runtime config", () => {
  it("accepts either a base URL or a full chat completions endpoint", () => {
    expect(buildMimoChatCompletionsUrl("https://tts.example.com")).toBe("https://tts.example.com/v1/chat/completions");
    expect(buildMimoChatCompletionsUrl("https://tts.example.com/v1")).toBe("https://tts.example.com/v1/chat/completions");
    expect(buildMimoChatCompletionsUrl("https://tts.example.com/v1/chat/completions")).toBe(
      "https://tts.example.com/v1/chat/completions",
    );
  });

  it("uses user supplied TTS model, voice, format, and auth header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ audio: `data:audio/mp3;base64,${Buffer.from("ok").toString("base64")}` }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const audio = await generateMimoTtsAudio({
      text: "hello",
      voice: "voice_user",
      instructions: "speak naturally",
      config: {
        apiKey: "tts-secret",
        authHeader: "api-key",
        baseUrl: "https://tts.example.com",
        endpoint: buildMimoChatCompletionsUrl("https://tts.example.com/v1/chat/completions"),
        format: "mp3",
        model: "custom-tts",
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body)) as {
      model: string;
      audio: { format: string; voice: string };
      messages: Array<{ role: string; content: string }>;
    };

    expect(String(url)).toBe("https://tts.example.com/v1/chat/completions");
    expect(headers["api-key"]).toBe("tts-secret");
    expect(headers.Authorization).toBeUndefined();
    expect(body.model).toBe("custom-tts");
    expect(body.audio).toEqual({ format: "mp3", voice: "voice_user" });
    expect(body.messages).toEqual([
      { role: "user", content: "speak naturally" },
      { role: "assistant", content: "hello" },
    ]);
    expect(audio.toString()).toBe("ok");
  });
});

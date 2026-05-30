import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGptSoVitsEndpoint,
  clearGptSoVitsSynthesisQueueForTests,
  clearGptSoVitsWeightSwitchCache,
  generateGptSoVitsTtsAudio,
  runGptSoVitsSynthesisExclusive,
  sanitizeGptSoVitsError,
  switchGptSoVitsWeights,
} from "./gptSoVitsTts";

describe("GPT-SoVITS TTS helper", () => {
  afterEach(() => {
    clearGptSoVitsSynthesisQueueForTests();
    clearGptSoVitsWeightSwitchCache();
  });

  it("builds endpoints from either a base URL or endpoint URL", () => {
    expect(buildGptSoVitsEndpoint("http://127.0.0.1:9880", "/tts")).toBe("http://127.0.0.1:9880/tts");
    expect(buildGptSoVitsEndpoint("http://127.0.0.1:9880/", "set_gpt_weights")).toBe(
      "http://127.0.0.1:9880/set_gpt_weights",
    );
  });

  it("switches both GPT and SoVITS weights with encoded local paths", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await switchGptSoVitsWeights({
      baseUrl: "http://127.0.0.1:9880",
      gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
      sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
      fetcher,
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/set_gpt_weights?weights_path=");
    expect(decodeURIComponent(String(fetcher.mock.calls[0]?.[0]))).toContain("gao_song_deng-e30.ckpt");
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("/set_sovits_weights?weights_path=");
    expect(decodeURIComponent(String(fetcher.mock.calls[1]?.[0]))).toContain("gao_song_deng_e16_s2096.pth");
  });

  it("reports control endpoint timing and skips repeated active weights", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ endpoint: String(input) }), { status: 200 }));
    const nowValues = [10, 26, 30, 65];
    const now = vi.fn(() => nowValues.shift() ?? 65);
    const weights = {
      baseUrl: "http://127.0.0.1:9880",
      gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
      sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
      fetcher,
      now,
    };

    await expect(switchGptSoVitsWeights(weights)).resolves.toEqual({
      gpt: { durationMs: 16, skipped: false },
      sovits: { durationMs: 35, skipped: false },
    });
    await expect(switchGptSoVitsWeights(weights)).resolves.toEqual({
      gpt: { durationMs: 0, skipped: true },
      sovits: { durationMs: 0, skipped: true },
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("serializes synthesis work that depends on global active GPT-SoVITS weights", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = runGptSoVitsSynthesisExclusive(async () => {
      events.push("first-start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first-end");
      return "first";
    });
    const second = runGptSoVitsSynthesisExclusive(async () => {
      events.push("second-start");
      return "second";
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["first-start"]);

    releaseFirst?.();
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(events).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("posts api_v2 TTS JSON and returns audio bytes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(Buffer.from("RIFF-ok"), { status: 200, headers: { "content-type": "audio/wav" } }),
    );

    const audio = await generateGptSoVitsTtsAudio({
      baseUrl: "http://127.0.0.1:9880",
      text: "本当に、そう思う。",
      textLang: "ja",
      refAudioPath: "D:\\AI\\GPT-SoVITS\\logs\\gao_song_deng\\5-wav32k\\ref.wav",
      promptLang: "ja",
      promptText: "本当に…やめちゃうの…でも…",
      mediaType: "wav",
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      text: "本当に、そう思う。",
      text_lang: "ja",
      ref_audio_path: "D:\\AI\\GPT-SoVITS\\logs\\gao_song_deng\\5-wav32k\\ref.wav",
      prompt_lang: "ja",
      prompt_text: "本当に…やめちゃうの…でも…",
      media_type: "wav",
      streaming_mode: false,
    });
    expect(audio.toString()).toBe("RIFF-ok");
  });

  it("sanitizes local secrets in provider errors", () => {
    expect(sanitizeGptSoVitsError("failed with sk-secret and tp-secret")).toBe("failed with sk-*** and tp-***");
  });
});

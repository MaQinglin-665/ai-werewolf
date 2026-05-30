import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  generateGptSoVitsTtsAudio: vi.fn(),
  switchGptSoVitsWeights: vi.fn(),
  resolveClassTrialGptSoVitsVoiceProfile: vi.fn(),
  rewriteClassTrialSpeechForJapaneseTts: vi.fn(),
  rewriteClassTrialSpeechForJapaneseTtsWithMeta: vi.fn(),
  generateMimoTtsAudio: vi.fn(),
  getMimoTtsConfig: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

vi.mock("@/server/gptSoVitsTts", () => ({
  generateGptSoVitsTtsAudio: mocks.generateGptSoVitsTtsAudio,
  runGptSoVitsSynthesisExclusive: async <T>(work: () => Promise<T>) => work(),
  switchGptSoVitsWeights: mocks.switchGptSoVitsWeights,
  buildGptSoVitsEndpoint: (baseUrl: string, path: string) =>
    `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`,
  sanitizeGptSoVitsError: (message: string) => message,
}));

vi.mock("@/ai/classTrialVoiceProfiles", () => ({
  resolveClassTrialGptSoVitsVoiceProfile: mocks.resolveClassTrialGptSoVitsVoiceProfile,
}));

vi.mock("@/ai/classTrialSpeechRewrite", () => ({
  rewriteClassTrialSpeechForJapaneseTts: mocks.rewriteClassTrialSpeechForJapaneseTts,
  rewriteClassTrialSpeechForJapaneseTtsWithMeta: mocks.rewriteClassTrialSpeechForJapaneseTtsWithMeta,
}));

vi.mock("@/server/mimoTts", async () => {
  const actual = await vi.importActual<typeof import("@/server/mimoTts")>("@/server/mimoTts");
  return {
    ...actual,
    generateMimoTtsAudio: mocks.generateMimoTtsAudio,
    getMimoTtsConfig: mocks.getMimoTtsConfig,
  };
});

beforeEach(() => {
  mocks.existsSync.mockReturnValue(false);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.writeFile.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/ai-speech-audio class-trial GPT-SoVITS routing", () => {
  it("uses GPT-SoVITS for class-trial ja-JP role cards", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.resolveClassTrialGptSoVitsVoiceProfile.mockReturnValue({
      available: true,
      profile: voiceProfile(),
    });
    mocks.rewriteClassTrialSpeechForJapaneseTts.mockResolvedValue("3番の発言を聞きたい。");
    mocks.rewriteClassTrialSpeechForJapaneseTtsWithMeta.mockResolvedValue({
      textJa: "3番の発言を聞きたい。",
      mode: "fast",
    });
    mocks.switchGptSoVitsWeights.mockResolvedValue({
      gpt: { durationMs: 12, skipped: false },
      sovits: { durationMs: 0, skipped: true },
    });
    mocks.generateGptSoVitsTtsAudio.mockResolvedValue(Buffer.from("voice"));
    const { POST } = await import("./route");

    const response = await POST(requestBody());
    const data = (await response.json()) as { url?: string; voiceProfile?: { provider?: string } };

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^\/audio\/ai-speech\//);
    expect(data.voiceProfile?.provider).toBe("gpt-sovits");
    expect(mocks.rewriteClassTrialSpeechForJapaneseTtsWithMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceZh: "女巫在这里，药线我不再藏；今天谁想借混乱散票，就把理由摊到裁判席上。",
        roleCard: expect.objectContaining({ id: "tomori", theme: "class-trial" }),
      }),
    );
    expect(mocks.switchGptSoVitsWeights).toHaveBeenCalledWith(
      expect.objectContaining({
        gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
        sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
      }),
    );
    expect(mocks.generateGptSoVitsTtsAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "3番の発言を聞きたい。",
        promptText: "本当に…やめちゃうの…でも…",
      }),
    );
    expect(info).toHaveBeenCalledWith(expect.stringContaining("[class-trial-gpt-sovits]"));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"rewriteMode":"fast"'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"switchGptSkipped":false'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"switchSovitsSkipped":true'));
    expect(mocks.generateMimoTtsAudio).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("falls back to Mimo Chinese TTS when GPT-SoVITS fails", async () => {
    mocks.resolveClassTrialGptSoVitsVoiceProfile.mockReturnValue({ available: true, profile: voiceProfile() });
    mocks.rewriteClassTrialSpeechForJapaneseTts.mockRejectedValue(new Error("rewrite failed"));
    mocks.rewriteClassTrialSpeechForJapaneseTtsWithMeta.mockRejectedValue(new Error("rewrite failed"));
    mocks.getMimoTtsConfig.mockReturnValue({
      apiKey: "mimo",
      authHeader: "Authorization",
      baseUrl: "https://tts.example.com",
      endpoint: "https://tts.example.com/v1/chat/completions",
      format: "mp3",
      model: "mimo-v2.5-tts",
    });
    mocks.generateMimoTtsAudio.mockResolvedValue(Buffer.from("mimo"));
    const { POST } = await import("./route");

    const response = await POST(requestBody());
    const data = (await response.json()) as { url?: string; voiceProfile?: { provider?: string } };

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^\/audio\/ai-speech\//);
    expect(data.voiceProfile?.provider).not.toBe("gpt-sovits");
    expect(mocks.generateMimoTtsAudio).toHaveBeenCalled();
  });
});

function requestBody(): Request {
  return new Request("http://localhost/api/ai-speech-audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "game-1",
      speechKey: "game-1:1:8",
      speakerSeatId: 8,
      speakerName: "高松灯",
      text: "女巫在这里，药线我不再藏；今天谁想借混乱散票，就把理由摊到裁判席上。",
      roleCard: {
        id: "tomori",
        displayName: "高松灯",
        theme: "class-trial",
        voiceLocale: "ja-JP",
        speechStyleZh: "短句偏多。",
        voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
        styleTags: ["sensitive"],
        catchphrasePolicy: "语气词最多一次。",
      },
    }),
  });
}

function voiceProfile() {
  return {
    characterId: "tomori",
    displayName: "高松灯",
    weightKey: "gao_song_deng",
    logKey: "gao_song_deng",
    gptWeightFile: "gao_song_deng-e30.ckpt",
    sovitsWeightFile: "gao_song_deng_e16_s2096.pth",
    gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
    sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
    refAudioPath: "D:\\AI\\GPT-SoVITS\\logs\\gao_song_deng\\5-wav32k\\ref.wav",
    promptText: "本当に…やめちゃうの…でも…",
    promptLang: "ja",
    textLang: "ja",
    mediaType: "wav",
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  resolveClassTrialGptSoVitsVoiceProfile: vi.fn(),
  generateGptSoVitsTtsAudio: vi.fn(),
  runGptSoVitsSynthesisExclusive: vi.fn(),
  switchGptSoVitsWeights: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

vi.mock("@/ai/classTrialVoiceProfiles", () => ({
  resolveClassTrialGptSoVitsVoiceProfile: mocks.resolveClassTrialGptSoVitsVoiceProfile,
}));

vi.mock("@/server/gptSoVitsTts", () => ({
  generateGptSoVitsTtsAudio: mocks.generateGptSoVitsTtsAudio,
  runGptSoVitsSynthesisExclusive: mocks.runGptSoVitsSynthesisExclusive,
  switchGptSoVitsWeights: mocks.switchGptSoVitsWeights,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.existsSync.mockReturnValue(false);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.resolveClassTrialGptSoVitsVoiceProfile.mockReturnValue({
    available: true,
    profile: voiceProfile(),
  });
  mocks.generateGptSoVitsTtsAudio.mockResolvedValue(Buffer.from("voice"));
  mocks.runGptSoVitsSynthesisExclusive.mockImplementation(async (work: () => Promise<unknown>) => work());
  mocks.switchGptSoVitsWeights.mockResolvedValue({
    gpt: { durationMs: 1, skipped: false },
    sovits: { durationMs: 1, skipped: false },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/class-trial-intro/audio", () => {
  it("resolves safe known intro audio paths and rejects unsafe ids", async () => {
    const { resolveClassTrialIntroAudioPath } = await import("./route");

    const filePath = resolveClassTrialIntroAudioPath("naegi");

    expect(filePath).toEqual(expect.stringContaining("local-assets"));
    expect(filePath).toEqual(expect.stringContaining("intro"));
    expect(filePath).toEqual(expect.stringContaining("audio"));
    expect(filePath).toEqual(expect.stringContaining("naegi.wav"));
    expect(resolveClassTrialIntroAudioPath("../secret")).toBeUndefined();
  });

  it("rejects external Bilibili clip characters without synthesizing", async () => {
    const { POST } = await import("./route");

    const response = await POST(introRequest("anon"));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(data.error).toContain("本地截取音频");
    expect(mocks.resolveClassTrialGptSoVitsVoiceProfile).not.toHaveBeenCalled();
    expect(mocks.switchGptSoVitsWeights).not.toHaveBeenCalled();
    expect(mocks.generateGptSoVitsTtsAudio).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("returns cached generated intro audio without synthesizing", async () => {
    mocks.existsSync.mockReturnValue(true);
    const { POST } = await import("./route");

    const response = await POST(introRequest("naegi"));
    const data = (await response.json()) as { url?: string; cached?: boolean };

    expect(response.status).toBe(200);
    expect(data).toEqual({
      url: "/class-trial-pack/intro/audio/naegi.wav",
      cached: true,
    });
    expect(mocks.switchGptSoVitsWeights).not.toHaveBeenCalled();
    expect(mocks.generateGptSoVitsTtsAudio).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("generates missing intro audio and writes it to the fixed cache path", async () => {
    const { POST } = await import("./route");

    const response = await POST(introRequest("naegi"));
    const data = (await response.json()) as { url?: string; cached?: boolean };

    expect(response.status).toBe(200);
    expect(data).toEqual({
      url: "/class-trial-pack/intro/audio/naegi.wav",
      cached: false,
    });
    expect(mocks.switchGptSoVitsWeights).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:9880",
      gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\miao_mu-e30.ckpt",
      sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\miao_mu_e16_s2112.pth",
    });
    expect(mocks.generateGptSoVitsTtsAudio).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:9880",
      text: "それは違うよ!",
      textLang: "ja",
      refAudioPath: "D:\\AI\\GPT-SoVITS\\logs\\miao_mu\\5-wav32k\\ref.wav",
      promptLang: "ja",
      promptText: "それは違うよ!",
      mediaType: "wav",
    });
    expect(mocks.mkdir).toHaveBeenCalledWith(expect.stringContaining("audio"), { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining("naegi.wav"), Buffer.from("voice"));
  });

  it("returns 503 when the generated character voice profile is unavailable", async () => {
    mocks.resolveClassTrialGptSoVitsVoiceProfile.mockReturnValue({
      available: false,
      reason: "缺少本地语音文件",
    });
    const { POST } = await import("./route");

    const response = await POST(introRequest("naegi"));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("缺少本地语音文件");
    expect(mocks.generateGptSoVitsTtsAudio).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid request bodies", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/class-trial-intro/audio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId: "secret" }),
      }),
    );
    const data = (await response.json()) as { error?: string; details?: unknown };

    expect(response.status).toBe(400);
    expect(data.error).toBe("开场片头音频参数不合法。");
    expect(data.details).toBeDefined();
  });
});

function introRequest(characterId: string): Request {
  return new Request("http://localhost/api/class-trial-intro/audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ characterId }),
  });
}

function voiceProfile() {
  return {
    characterId: "naegi",
    displayName: "苗木诚",
    weightKey: "miao_mu",
    logKey: "miao_mu",
    gptWeightFile: "miao_mu-e30.ckpt",
    sovitsWeightFile: "miao_mu_e16_s2112.pth",
    gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\miao_mu-e30.ckpt",
    sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\miao_mu_e16_s2112.pth",
    refAudioPath: "D:\\AI\\GPT-SoVITS\\logs\\miao_mu\\5-wav32k\\ref.wav",
    promptText: "それは違うよ!",
    promptLang: "ja",
    textLang: "ja",
    mediaType: "wav",
  };
}

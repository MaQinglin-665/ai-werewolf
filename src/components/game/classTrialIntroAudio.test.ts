import { describe, expect, it, vi } from "vitest";
import type { ClassTrialIntroCharacter, ClassTrialIntroConfig } from "./classTrialIntro";
import { prepareClassTrialIntroAudio } from "./classTrialIntroAudio";

describe("classTrialIntroAudio", () => {
  it("returns not-ready status when intro config is missing", async () => {
    const preparation = await prepareClassTrialIntroAudio(undefined);

    expect(preparation).toEqual({
      ready: false,
      message: "未找到开场片头配置。",
      readyCharacterIds: [],
      failedCharacterIds: [],
    });
  });

  it("returns ready status and ready ids when every audio url is reachable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(true));

    const preparation = await prepareClassTrialIntroAudio(makeConfig(), { fetcher });

    expect(preparation).toEqual({
      ready: true,
      message: "开场片头音频已就绪。",
      readyCharacterIds: ["anon", "naegi"],
      failedCharacterIds: [],
    });
    expect(fetcher).toHaveBeenNthCalledWith(1, "/class-trial-pack/intro/audio/anon.wav", {
      method: "GET",
      cache: "no-store",
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/class-trial-pack/intro/audio/naegi.wav", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("generates and re-checks a missing generated clip before reporting ready", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(true));

    const preparation = await prepareClassTrialIntroAudio(makeConfig(), { fetcher });

    expect(preparation.ready).toBe(true);
    expect(preparation.readyCharacterIds).toEqual(["anon", "naegi"]);
    expect(preparation.failedCharacterIds).toEqual([]);
    expect(fetcher).toHaveBeenNthCalledWith(3, "/api/class-trial-intro/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: "naegi" }),
    });
    expect(fetcher).toHaveBeenNthCalledWith(4, "/class-trial-pack/intro/audio/naegi.wav", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("does not generate a missing external clip and reports the failed id", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true));

    const preparation = await prepareClassTrialIntroAudio(makeConfig(), { fetcher });

    expect(preparation).toEqual({
      ready: false,
      message: "开场片头音频缺少 1 个角色。",
      readyCharacterIds: ["naegi"],
      failedCharacterIds: ["anon"],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).not.toHaveBeenCalledWith("/api/class-trial-intro/audio", expect.anything());
  });

  it("reports a generated id as failed when generation or re-check fails", async () => {
    const postFailureFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(false));
    const recheckFailureFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(false));

    const postFailure = await prepareClassTrialIntroAudio(makeConfig(), { fetcher: postFailureFetcher });
    const recheckFailure = await prepareClassTrialIntroAudio(makeConfig(), { fetcher: recheckFailureFetcher });

    expect(postFailure).toEqual({
      ready: false,
      message: "开场片头音频缺少 1 个角色。",
      readyCharacterIds: ["anon"],
      failedCharacterIds: ["naegi"],
    });
    expect(recheckFailure.failedCharacterIds).toEqual(["naegi"]);
  });

  it("handles fetch rejection as an ordinary missing audio failure", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(response(true));

    await expect(prepareClassTrialIntroAudio(makeConfig(), { fetcher })).resolves.toEqual({
      ready: false,
      message: "开场片头音频缺少 1 个角色。",
      readyCharacterIds: ["naegi"],
      failedCharacterIds: ["anon"],
    });
  });
});

function response(ok: boolean): Response {
  return { ok } as Response;
}

function makeConfig(): ClassTrialIntroConfig {
  return {
    id: "test-intro",
    version: "test",
    characters: [makeCharacter("anon", "external"), makeCharacter("naegi", "generated")],
  };
}

function makeCharacter(
  id: ClassTrialIntroCharacter["id"],
  audioMode: ClassTrialIntroCharacter["audioMode"],
): ClassTrialIntroCharacter {
  return {
    id,
    displayNameJa: `${id}-ja`,
    titleJa: `${id}-title`,
    subtitleJa: `${id}-subtitle`,
    portraitUrl: `/class-trial-pack/intro/portraits/${id}.png`,
    audioUrl: `/class-trial-pack/intro/audio/${id}.wav`,
    themeColor: "#f6c94a",
    accentColor: "#101014",
    pattern: "rings",
    durationMs: 5200,
    audioMode,
  };
}

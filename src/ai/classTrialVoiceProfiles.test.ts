import { describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import {
  CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES,
  resolveClassTrialGptSoVitsVoiceProfile,
} from "./classTrialVoiceProfiles";

describe("class-trial GPT-SoVITS voice profiles", () => {
  it("declares all 9 class-trial character profiles", () => {
    expect(CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES.map((profile) => profile.characterId)).toEqual([
      "naegi",
      "kirigiri",
      "fukawa",
      "monokuma",
      "enoshima",
      "celestia",
      "togami",
      "tomori",
      "anon",
    ]);
  });

  it("uses the clean denoised black-white bear weights", () => {
    const profile = CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES.find((item) => item.characterId === "monokuma");

    expect(profile?.weightKey).toBe("hei_bai_xiong_clean_denoised");
    expect(profile?.gptWeightFile).toBe("hei_bai_xiong_clean_denoised-e30.ckpt");
    expect(profile?.sovitsWeightFile).toBe("hei_bai_xiong_clean_denoised_e16_s2240.pth");
  });

  it("resolves weights and first prompt line from local logs", () => {
    const files = new Map<string, string>();
    const root = "D:\\AI\\GPT-SoVITS";
    files.set(
      `${root}\\logs\\AI_voice_1\\2-name2text.txt`,
      "anon_ref.wav\tphones\tNone\t千葉屋アノンです。よろしくお願いします。",
    );
    const exists = new Set([
      `${root}\\GPT_weights_v2Pro\\qian_dao_ai_yin-e30.ckpt`,
      `${root}\\SoVITS_weights_v2Pro\\qian_dao_ai_yin_e16_s8064.pth`,
      `${root}\\logs\\AI_voice_1\\2-name2text.txt`,
      `${root}\\logs\\AI_voice_1\\5-wav32k\\anon_ref.wav`,
    ]);

    const resolved = resolveClassTrialGptSoVitsVoiceProfile(roleCard("anon", "千早爱音"), {
      root,
      existsSync: (filePath) => exists.has(filePath),
      readTextFile: (filePath) => files.get(filePath) ?? "",
    });

    expect(resolved.available).toBe(true);
    if (!resolved.available) throw new Error(resolved.reason);
    expect(resolved.profile.characterId).toBe("anon");
    expect(resolved.profile.logKey).toBe("AI_voice_1");
    expect(resolved.profile.promptText).toBe("千葉屋アノンです。よろしくお願いします。");
    expect(resolved.profile.refAudioPath).toContain("logs\\AI_voice_1\\5-wav32k\\anon_ref.wav");
  });

  it("returns unavailable when a local file is missing", () => {
    const resolved = resolveClassTrialGptSoVitsVoiceProfile(roleCard("tomori", "高松灯"), {
      root: "D:\\AI\\GPT-SoVITS",
      existsSync: () => false,
      readTextFile: () => "",
    });

    expect(resolved.available).toBe(false);
    if (resolved.available) throw new Error("Expected the profile to be unavailable.");
    expect(resolved.reason).toContain("缺少");
  });
});

function roleCard(id: string, displayName: string): AiCharacterRoleCard {
  return {
    id,
    displayName,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "",
    reasoningBias: "",
    voteBias: "",
    nightActionBias: "",
    asVillager: "",
    asWerewolf: "",
    pressureResponse: "",
    relationshipHints: [],
    catchphrasePolicy: "",
    forbidden: [],
    voiceProfileId: `${id}-ja-local`,
    voiceLocale: "ja-JP",
    voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
  };
}

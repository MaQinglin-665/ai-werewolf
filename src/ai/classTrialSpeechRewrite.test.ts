import { beforeEach, describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import {
  clearClassTrialSpeechRewriteCache,
  rewriteClassTrialSpeechForJapaneseTts,
  rewriteClassTrialSpeechForJapaneseTtsWithMeta,
} from "./classTrialSpeechRewrite";

describe("class-trial Japanese TTS rewrite", () => {
  beforeEach(() => {
    clearClassTrialSpeechRewriteCache();
  });

  it("returns textJa from renderer JSON without changing the Chinese source", async () => {
    const text = await rewriteClassTrialSpeechForJapaneseTts(
      {
        sourceZh: "这个点不对。",
        roleCard: roleCard("tomori", "高松灯"),
      },
      async () => '{"textJa":"その点は違うと思う。"}',
    );

    expect(text).toBe("その点は違うと思う。");
  });

  it("uses a fast local rewrite for simple explanation requests", async () => {
    let calls = 0;
    const result = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      {
        sourceZh: "我想听3号解释。",
        roleCard: roleCard("tomori", "高松灯"),
      },
      async () => {
        calls += 1;
        return '{"textJa":"renderer should not be called"}';
      },
    );

    expect(result).toEqual({
      textJa: "3番の説明を聞きたい。",
      mode: "fast",
    });
    expect(calls).toBe(0);
  });

  it("uses a deterministic local rewrite for complex long lines instead of waiting on the renderer", async () => {
    let calls = 0;
    const result = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      {
        sourceZh:
          "平安夜，女巫用药了，至少轮次没亏。我首置位没太多信息，先看一圈谁发言里前后逻辑能闭环、谁给的理由和票型对不上。",
        roleCard: roleCard("naegi", "苗木诚"),
      },
      async () => {
        calls += 1;
        return '{"textJa":"renderer should not be called"}';
      },
    );

    expect(result.mode).toBe("local");
    expect(result.textJa).toContain("平和な夜");
    expect(result.textJa).toContain("魔女");
    expect(result.textJa).toContain("発言");
    expect(calls).toBe(0);
  });

  it("keeps late-gameplay clauses in deterministic local rewrites so TTS does not sound truncated", async () => {
    const result = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      {
        sourceZh:
          "平安夜女巫用药了，首置位我信息不多，所以先看发言前后逻辑。3号的听感有压力，但我更想听3号解释。5号现在有点可疑，别急着跟票；预言家的查验和票型要一起看，最后把矛盾逐条摊开。",
        roleCard: roleCard("kirigiri", "雾切响子"),
      },
      async () => '{"textJa":"renderer should not be called"}',
    );

    expect(result.mode).toBe("local");
    expect(result.textJa).toContain("3番");
    expect(result.textJa).toContain("5番");
    expect(result.textJa).toContain("投票筋");
    expect(result.textJa).toContain("占い結果");
    expect(result.textJa).toContain("矛盾");
  });

  it("keeps seat numbers in deterministic local rewrites", async () => {
    const result = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      {
        sourceZh: "我觉得3号的理由和票型对不上，今天先听3号解释。",
        roleCard: roleCard("kirigiri", "雾切响子"),
      },
      async () => '{"textJa":"renderer should not be called"}',
    );

    expect(result.mode).toBe("local");
    expect(result.textJa).toContain("3番");
  });

  it("caches fast rewrites by role and source text", async () => {
    const role = roleCard("kirigiri", "雾切响子");
    const first = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      { sourceZh: "我觉得5号可疑。", roleCard: role },
      async () => '{"textJa":"renderer should not be called"}',
    );
    const second = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      { sourceZh: "我觉得5号可疑。", roleCard: role },
      async () => {
        throw new Error("cache should prevent renderer calls");
      },
    );

    expect(first).toEqual({ textJa: "5番が怪しいと思う。", mode: "fast" });
    expect(second).toEqual({ textJa: "5番が怪しいと思う。", mode: "cache" });
  });

  it("caches deterministic local rewrites for complex lines", async () => {
    let calls = 0;
    const role = roleCard("naegi", "苗木诚");
    const sourceZh = "我觉得3号前后变化有点大，今天先听他解释。";
    const first = await rewriteClassTrialSpeechForJapaneseTtsWithMeta({ sourceZh, roleCard: role }, async () => {
      calls += 1;
      return '{"textJa":"3番の発言は前後で少し変わっていると思う。今日はまず説明を聞きたい。"}';
    });
    const second = await rewriteClassTrialSpeechForJapaneseTtsWithMeta({ sourceZh, roleCard: role }, async () => {
      throw new Error("cache should prevent renderer calls");
    });

    expect(first.mode).toBe("local");
    expect(first.textJa).toContain("3番");
    expect(second).toEqual({ textJa: first.textJa, mode: "cache" });
    expect(calls).toBe(0);
  });

  it("tells the renderer to keep Chihaya Anon filler words rare and well placed", async () => {
    let system = "";
    const text = await rewriteClassTrialSpeechForJapaneseTts(
      {
        sourceZh: "9号这里绕。",
        roleCard: roleCard("anon", "千早爱音"),
      },
      async (input) => {
        system = input.system;
        return '{"textJa":"9番の言い方は少し回りくどいと思う。まだ急いで票を合わせないで。"}';
      },
    );

    expect(text).toContain("9番");
    expect(system).toContain("千早爱音");
    expect(system).toContain("语气词最多一次");
    expect(system).toContain("数字座位、查验、投票目标中间");
  });

  it("preserves Monokuma's signature short laugh in Japanese TTS rewrites", async () => {
    const result = await rewriteClassTrialSpeechForJapaneseTtsWithMeta(
      {
        sourceZh: "噗噗，3号这段证词太好笑了，理由和票型根本接不上。",
        roleCard: roleCard("monokuma", "黑白熊"),
      },
      async () => '{"textJa":"renderer should not be called"}',
    );

    expect(result.mode).toBe("local");
    expect(result.textJa).toContain("うぷぷ");
    expect(result.textJa).toContain("3番");
  });

  it("rejects repeated Chihaya Anon filler words from the Japanese rewrite", async () => {
    await expect(
      rewriteClassTrialSpeechForJapaneseTts(
        {
          sourceZh: "9号这里绕。",
          roleCard: roleCard("anon", "千早爱音"),
        },
        async () => '{"textJa":"えっと、9番の言い方は、あの、少し回りくどくて、うん、まだ急いで票を合わせないで。"}',
      ),
    ).rejects.toThrow("语气词");
  });

  it("rejects empty or explanatory rewrite output", async () => {
    await expect(
      rewriteClassTrialSpeechForJapaneseTts(
        { sourceZh: "我先压5号。", roleCard: roleCard("naegi", "苗木诚") },
        async () => '{"textJa":"以下是日语翻译：5番を押します。"}',
      ),
    ).rejects.toThrow("日语改写不可用");
  });

  it("keeps seat numbers from the Chinese source", async () => {
    await expect(
      rewriteClassTrialSpeechForJapaneseTts(
        { sourceZh: "我今晚如果还活着，会继续盯7号的发言。", roleCard: roleCard("kirigiri", "雾切响子") },
        async () => '{"textJa":"私は投票します。"}',
      ),
    ).rejects.toThrow("座位号");
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

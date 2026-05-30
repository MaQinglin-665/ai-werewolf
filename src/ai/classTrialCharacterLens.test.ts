import { describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import {
  buildClassTrialLensFallbackSpeech,
  containsClassTrialLensSignal,
  formatClassTrialLensForAction,
  formatClassTrialLensForSpeech,
  getClassTrialCharacterLens,
  validateClassTrialLensSpeech,
  type ClassTrialCharacterLens,
} from "./classTrialCharacterLens";

const CLASS_TRIAL_IDS = ["naegi", "kirigiri", "fukawa", "monokuma", "enoshima", "celestia", "togami", "tomori", "anon"] as const;

describe("classTrialCharacterLens", () => {
  it("builds a lens for every fixed class-trial character", () => {
    for (const id of CLASS_TRIAL_IDS) {
      const lens = getClassTrialCharacterLens(roleCard(id));

      expect(lens?.roleId).toBe(id);
      expect(lens?.displayName).toBe(roleCard(id).displayName);
      expect(lens?.attentionBias.length).toBeGreaterThan(0);
      expect(lens?.pressureMove.length).toBeGreaterThan(0);
      expect(lens?.voteRationaleStyle.length).toBeGreaterThan(0);
      expect(lens?.werewolfStrategy.readPriority.length).toBeGreaterThan(0);
      expect(lens?.werewolfStrategy.pressureMethod.length).toBeGreaterThan(0);
      expect(lens?.werewolfStrategy.voteLogic.length).toBeGreaterThan(0);
      expect(lens?.werewolfStrategy.asVillager.length).toBeGreaterThan(0);
      expect(lens?.werewolfStrategy.asWerewolf.length).toBeGreaterThan(0);
      expect(lens?.werewolfStrategy.nightBias.length).toBeGreaterThan(0);
      expect(lens?.fallbackMoves.length).toBeGreaterThan(1);
      expect(lens?.forbiddenTemplates.join("\n")).toContain("我换一个角度");
      expect(formatClassTrialLensForSpeech(lens!)).toContain("角色行为透镜");
      expect(formatClassTrialLensForSpeech(lens!)).toContain("狼人杀打法卡");
      expect(formatClassTrialLensForAction(lens!)).toContain("投票理由");
    }
  });

  it("gives key characters different werewolf decision priorities instead of only voice style", () => {
    const kirigiri = getClassTrialCharacterLens(roleCard("kirigiri"))!;
    const enoshima = getClassTrialCharacterLens(roleCard("enoshima"))!;
    const monokuma = getClassTrialCharacterLens(roleCard("monokuma"))!;
    const togami = getClassTrialCharacterLens(roleCard("togami"))!;

    expect(kirigiri.werewolfStrategy.readPriority.join("\n")).toContain("证据闭环");
    expect(enoshima.werewolfStrategy.pressureMethod.join("\n")).toContain("反应差");
    expect(monokuma.werewolfStrategy.pressureMethod.join("\n")).toContain("二选一");
    expect(togami.werewolfStrategy.voteLogic.join("\n")).toContain("标准");
    expect(new Set([kirigiri, enoshima, monokuma, togami].map((lens) => lens.werewolfStrategy.readPriority.join("|"))).size).toBe(4);
  });

  it("returns undefined for non-class-trial role cards", () => {
    expect(getClassTrialCharacterLens({ ...roleCard("naegi"), theme: "space-opera" })).toBeUndefined();
    expect(getClassTrialCharacterLens(undefined)).toBeUndefined();
  });

  it("detects class-trial lens signals without requiring exact fixed scripts", () => {
    const kirigiri = getClassTrialCharacterLens(roleCard("kirigiri"))!;
    const enoshima = getClassTrialCharacterLens(roleCard("enoshima"))!;

    expect(containsClassTrialLensSignal(kirigiri, "3号这里的证据链断点还没闭合。")).toBe(true);
    expect(containsClassTrialLensSignal(enoshima, "这个公开矛盾被你说得太安静了，我偏要把它放大。")).toBe(true);
  });

  it("formats role-specific debate moves as soft LLM direction instead of required scripts", () => {
    const naegi = getClassTrialCharacterLens(roleCard("naegi"))!;
    const monokuma = getClassTrialCharacterLens(roleCard("monokuma"))!;
    const togami = getClassTrialCharacterLens(roleCard("togami"))!;

    expect(formatClassTrialLensForSpeech(naegi)).toContain("软导演提示");
    expect(formatClassTrialLensForSpeech(naegi)).toContain("读牌优先级");
    expect(formatClassTrialLensForSpeech(naegi)).toContain("阵营打法");
    expect(formatClassTrialLensForSpeech(naegi)).toContain("LLM 自由发挥");
    expect(formatClassTrialLensForSpeech(naegi)).toContain("本轮先选一个角色打法动作");
    expect(formatClassTrialLensForSpeech(naegi)).toContain("没站边/没票口/证据链缺口");
    expect(formatClassTrialLensForSpeech(naegi)).toContain("共同验证");
    expect(formatClassTrialLensForSpeech(monokuma)).toContain("二选一");
    expect(formatClassTrialLensForSpeech(togami)).toContain("不达标");
    expect(formatClassTrialLensForSpeech(naegi)).not.toContain("本轮至少体现");
  });

  it("includes role-specific transformation examples without becoming fixed scripts", () => {
    const kirigiri = getClassTrialCharacterLens(roleCard("kirigiri"))!;
    const anon = getClassTrialCharacterLens(roleCard("anon"))!;

    expect(formatClassTrialLensForSpeech(kirigiri)).toContain("同一材料改写示例");
    expect(formatClassTrialLensForSpeech(kirigiri)).toContain("缺失前提");
    expect(formatClassTrialLensForSpeech(anon)).toContain("先接住气氛");
    expect(formatClassTrialLensForSpeech(kirigiri)).toContain("只学推进动作，不照抄台词");
    expect(formatClassTrialLensForSpeech(kirigiri)).not.toContain("必须照抄");
  });

  it("keeps lens validation advisory so DeepSeek can freeplay without keyword matching", () => {
    const lens = getClassTrialCharacterLens(roleCard("naegi"))!;

    expect(validateClassTrialLensSpeech(lens, "我先按公开信息盘，票口先放这里，这个疑点未解除。")).toEqual([]);
    expect(validateClassTrialLensSpeech(lens, "3号这里不太自然，我想先听其他人的反应。")).toEqual([]);
    expect(validateClassTrialLensSpeech(lens, "我还不能把3号说死，但卡住我的是大家都能一起查验的那个断点。")).toEqual([]);
  });

  it("does not hard-reject abstract debate phrasing from the lens layer", () => {
    const lens = getClassTrialCharacterLens(roleCard("kirigiri"))!;

    expect(validateClassTrialLensSpeech(lens, "这条证据链的缺口还没收住，我先给一个可验证的观察点。")).toEqual([]);
    expect(validateClassTrialLensSpeech(lens, "3号前后矛盾的断点在投票理由，先让他补上动机。")).toEqual([]);
  });

  it("builds role-specific fallback lines from the same lens", () => {
    const lens = getClassTrialCharacterLens(roleCard("tomori"))!;
    const line = buildClassTrialLensFallbackSpeech(lens, { focusText: "6号塞蕾丝缇雅", gap: "理由没有接上前面的票型", seed: 3 });

    expect(line).toContain("高松灯");
    expect(line).toContain("6号塞蕾丝缇雅");
    expect(line).toContain("理由没有接上前面的票型");
    expect(line).not.toMatch(/^我是/);
    expect(line).not.toContain("按现在桌面看");
    expect(line).not.toContain("我换一个角度");
  });

  it("normalizes fallback gaps so role lines do not read like stitched templates", () => {
    const lens = getClassTrialCharacterLens(roleCard("anon"))!;
    const line = buildClassTrialLensFallbackSpeech(lens, { focusText: "2号雾切响子", gap: "结论和依据还需要再对照" });

    expect(line).toContain("结论和依据之间的连接");
    expect(line).not.toContain("还需要再对照还没接上");
  });

  it("uses multiple role action fallback moves instead of one stitched fallback pattern", () => {
    const monokuma = getClassTrialCharacterLens(roleCard("monokuma"))!;
    const first = buildClassTrialLensFallbackSpeech(monokuma, {
      focusText: "1号苗木诚",
      gap: "身份线说得像谜语",
      seed: 1,
    });
    const second = buildClassTrialLensFallbackSpeech(monokuma, {
      focusText: "1号苗木诚",
      gap: "身份线说得像谜语",
      seed: 2,
    });

    expect(first).toContain("黑白熊");
    expect(second).toContain("黑白熊");
    expect(new Set([first, second]).size).toBe(2);
    expect(first + second).toContain("二选一");
    expect(first + second).not.toContain("这个疑点未解除");
    expect(first + second).not.toContain("按现在桌面看");
  });

  it("keeps legacy fallbackPattern compatibility when fallbackMoves is absent", () => {
    const legacyLens = {
      roleId: "legacy",
      displayName: "旧角色",
      fallbackPattern: "{focus}旧兜底仍然看{gap}。",
    } as ClassTrialCharacterLens;

    expect(() =>
      buildClassTrialLensFallbackSpeech(legacyLens, {
        focusText: "3号腐川冬子",
        gap: "公开证据还没有真正闭合",
      }),
    ).not.toThrow();
    expect(
      buildClassTrialLensFallbackSpeech(legacyLens, {
        focusText: "3号腐川冬子",
        gap: "公开证据还没有真正闭合",
      }),
    ).toBe("旧角色。3号腐川冬子旧兜底仍然看公开证据的闭合方式。");
  });
});

function roleCard(id: string): AiCharacterRoleCard {
  const displayNames: Record<string, string> = {
    naegi: "苗木诚",
    kirigiri: "雾切响子",
    fukawa: "腐川冬子",
    monokuma: "黑白熊",
    enoshima: "江之岛盾子",
    celestia: "塞蕾丝缇雅",
    togami: "十神白夜",
    tomori: "高松灯",
    anon: "千早爱音",
  };
  return {
    id,
    displayName: displayNames[id] ?? id,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "本地学级裁判角色语气。",
    reasoningBias: "按公开信息推理。",
    voteBias: "认真服务阵营胜利。",
    nightActionBias: "夜晚行动不在本轮透镜范围内。",
    asVillager: "作为好人时按公开证据找狼。",
    asWerewolf: "作为狼人时只用公开理由伪装。",
    pressureResponse: "被怀疑时回应公开逻辑。",
    relationshipHints: [],
    catchphrasePolicy: "允许极短口癖，不复刻长台词。",
    forbidden: [],
  };
}

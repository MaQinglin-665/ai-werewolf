import { describe, expect, it } from "vitest";
import { composeAiSpeechTtsInstruction, composeAiSpeechTtsText, getAiVoiceProfileByName } from "./voiceProfiles";

describe("AI voice profiles", () => {
  it("keeps TTS text to spoken table speech only", () => {
    const profile = getAiVoiceProfileByName("DeepSeek");

    const text = composeAiSpeechTtsText("我先压5号，让他解释上一轮票型。", profile);

    expect(text).toBe("我先压5号，让他解释上一轮票型。");
    expect(text).not.toMatch(/style|冷静|低沉|沉稳|停顿/);
  });

  it("strips leaked style tags or stage directions before synthesis", () => {
    const profile = getAiVoiceProfileByName("Mimo");

    const text = composeAiSpeechTtsText("<style>低沉 悬疑</style>（压低声音）我先听4号解释。", profile);

    expect(text).toBe("我先听4号解释。");
  });

  it("keeps voice direction in instructions instead of the synthesized text", () => {
    const profile = getAiVoiceProfileByName("Kimi");

    expect(composeAiSpeechTtsInstruction(profile)).toContain("风格要求");
    expect(composeAiSpeechTtsInstruction(profile)).toContain("打法声线");
    expect(composeAiSpeechTtsInstruction(profile)).toContain("长线记忆型玩家");
    expect(composeAiSpeechTtsInstruction(profile)).toContain("断句要求");
    expect(composeAiSpeechTtsInstruction(profile)).toContain("快约 12%");
    expect(composeAiSpeechTtsInstruction(profile)).toContain("情绪起伏");
    expect(composeAiSpeechTtsInstruction(profile)).not.toContain("变慢");
    expect(composeAiSpeechTtsText("我对3号保留怀疑。", profile)).not.toContain("风格要求");
  });

  it("adds light prosody punctuation without changing spoken content", () => {
    const profile = getAiVoiceProfileByName("GPT");

    const text = composeAiSpeechTtsText("我先认2号预言家但是9号的回应要听完所以今天别散票", profile);

    expect(text).toBe("我先认2号预言家，但是9号的回应要听完，所以今天别散票。");
  });

  it("adds clearer breaks for numbered table reads", () => {
    const profile = getAiVoiceProfileByName("DeepSeek");

    const text = composeAiSpeechTtsText(
      "我先说三点第一2号起跳预言家时机正常第二5号一直绕开票型第三9号在关键位置没有给结论所以今天我会压9号",
      profile,
    );

    expect(text).toBe(
      "我先说三点，第一，2号起跳预言家时机正常，第二，5号一直绕开票型，第三，9号在关键位置没有给结论，所以今天我会压9号。",
    );
  });

  it("gives key models distinct tactical voice instructions", () => {
    expect(composeAiSpeechTtsInstruction(getAiVoiceProfileByName("DeepSeek"))).toContain("逻辑链型玩家");
    expect(composeAiSpeechTtsInstruction(getAiVoiceProfileByName("Claude"))).toContain("边界审查型玩家");
    expect(composeAiSpeechTtsInstruction(getAiVoiceProfileByName("豆包"))).toContain("强压推进型玩家");
    expect(composeAiSpeechTtsInstruction(getAiVoiceProfileByName("Kimi"))).toContain("长线记忆型玩家");
  });
});

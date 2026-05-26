import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const voicePackPath = path.join(process.cwd(), "public", "tools", "deepseek-mimo-voice-pack.json");
const installerPath = path.join(process.cwd(), "public", "tools", "install-deepseek-mimo-voices.html");

describe("DeepSeek Mimo voice pack", () => {
  test("ships eight importable friends without embedded secrets", () => {
    const raw = fs.readFileSync(voicePackPath, "utf8");
    const pack = JSON.parse(raw) as {
      version: number;
      friends: Array<{
        id: string;
        nickname: string;
        basePersonaId: string;
        llmConfig?: Record<string, unknown>;
        ttsVoice?: string;
        ttsConfig?: Record<string, unknown>;
      }>;
    };

    expect(pack.version).toBe(1);
    expect(pack.friends).toHaveLength(8);
    expect(new Set(pack.friends.map((friend) => friend.id)).size).toBe(8);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toMatch(/(?:sk|tp)-[A-Za-z0-9]{16,}/);

    for (const friend of pack.friends) {
      expect(friend.id).toMatch(/^friend-deepseek-mimo-/);
      expect(friend.nickname.length).toBeLessThanOrEqual(16);
      expect(friend.llmConfig).toMatchObject({
        provider: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        mergeSystemIntoUser: true,
      });
      expect(["deepseek-chat", "deepseek-reasoner"]).toContain(friend.llmConfig?.model);
      expect(friend.ttsConfig).toMatchObject({
        provider: "mimo-compatible",
        baseUrl: "https://api.xiaomimimo.com",
        model: "mimo-v2.5-tts",
        format: "mp3",
      });
      expect(friend.ttsConfig?.voice).toBe(friend.ttsVoice);
    }
  });

  test("installer writes the current browser localStorage keys without hardcoded tokens", () => {
    const html = fs.readFileSync(installerPath, "utf8");

    expect(html).toContain("deepseek-mimo-voice-pack.json");
    expect(html).toContain("ai-werewolf-ai-friends-v1");
    expect(html).toContain("ai-werewolf-selected-ai-friends-v1");
    expect(html).toContain("ai-werewolf-ai-friend-llm-secrets-v1");
    expect(html).toContain("ai-werewolf-ai-runtime-mode-v1");
    expect(html).toContain("ai-werewolf-ai-speech-audio-enabled");
    expect(html).toContain("开启真实 DeepSeek 模式需要填写 DeepSeek API Key");
    expect(html).toContain("token-plan-cn.xiaomimimo.com");
    expect(html).toContain("resolveMimoBaseUrl");
    expect(html).toContain('type="password"');
    expect(html).not.toMatch(/(?:sk|tp)-[A-Za-z0-9]{16,}/);
  });
});

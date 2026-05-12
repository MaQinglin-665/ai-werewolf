import { z } from "zod";
import type { AgentView } from "@/game/types";
import type { AiSpeechProvider, AiSpeechResult } from "./types";

const SpeechSchema = z.object({
  speech: z.string().min(1).max(240),
});

export const mockSpeechProvider: AiSpeechProvider = {
  providerId: "mock-speech",
  async generateSpeech(view) {
    return {
      speech: createMockSpeech(view),
      provider: "mock-speech",
      isFallback: false,
    };
  },
};

export function createConfiguredSpeechProvider(): AiSpeechProvider {
  if (process.env.AI_SPEECH_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    return openAiSpeechProvider;
  }

  return mockSpeechProvider;
}

export const openAiSpeechProvider: AiSpeechProvider = {
  providerId: "openai-speech",
  async generateSpeech(view) {
    try {
      const rawOutput = await callOpenAiSpeech(view);
      const parsed = SpeechSchema.safeParse(JSON.parse(rawOutput));
      if (!parsed.success) {
        return fallbackSpeech(view, "LLM 输出格式不合法。", rawOutput);
      }

      return {
        speech: normalizeSpeech(parsed.data.speech),
        provider: "openai-speech",
        rawOutput,
        isFallback: false,
      };
    } catch (error) {
      return fallbackSpeech(view, error instanceof Error ? error.message : "LLM 发言失败。");
    }
  },
};

function createMockSpeech(view: AgentView): string {
  const persona = view.persona?.label ?? "稳健型";
  const lastDeath = view.publicSummary.recentDeaths.at(-1);
  const lastVote = view.publicSummary.recentVotes.at(-1);
  const pressureTarget = view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId);
  const targetName = pressureTarget?.name ?? "场上玩家";

  if (view.myRole === "SEER") {
    const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      return `我是预言家，昨晚查验 ${latestCheck.targetSeatId}号 是${latestCheck.result === "WEREWOLF" ? "狼人" : "好人"}。我会结合票型继续盘，不建议今天散票。`;
    }
    return `我是${persona}视角，先听完发言再归票。我会重点看谁在回避昨晚信息。`;
  }

  if (view.myRole === "WEREWOLF") {
    const teammateText = view.privateKnowledge.wolfTeammates?.map((seat) => seat.name).join("、");
    return `我这里先不急着认死身份。${lastVote ? `上一轮票型里 ${lastVote} 这个动作值得复盘。` : ""} ${targetName} 的逻辑需要再压一轮。${teammateText ? "" : ""}`.trim();
  }

  if (view.myRole === "WITCH") {
    return `我会看发言和票型的一致性。${lastDeath ? `刚才的关键信息是：${lastDeath}` : "目前信息还不够，先别被单点节奏带走。"}`;
  }

  if (view.myRole === "HUNTER") {
    return `我底牌不虚，但不会乱拍身份。${targetName} 如果继续只给结论不给过程，我会把票压过去。`;
  }

  return `我是闭眼好人，${persona}打法。${lastVote ? `我会重点复盘 ${lastVote}。` : `我先看 ${targetName} 的发言是否前后一致。`}`;
}

async function callOpenAiSpeech(view: AgentView): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "你是狼人杀 AI 玩家。只能根据给定视角发言，不能声称知道隐藏信息，不能输出动作。返回严格 JSON。",
          },
          {
            role: "user",
            content: JSON.stringify({
              role: view.myRole,
              persona: view.persona,
              aliveSeats: view.aliveSeats,
              publicEvents: view.publicEvents.slice(-18),
              publicSummary: view.publicSummary,
              privateKnowledge: view.privateKnowledge,
              instruction: "生成一段不超过120字的白天公开发言。",
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "werewolf_speech",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                speech: { type: "string" },
              },
              required: ["speech"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI 请求失败：${response.status}`);
    }

    return extractResponseText(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function extractResponseText(data: unknown): string {
  if (typeof data === "object" && data && "output_text" in data && typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = typeof data === "object" && data && "output" in data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI 响应中没有文本。");
}

function fallbackSpeech(view: AgentView, error: string, rawOutput?: unknown): AiSpeechResult {
  return {
    speech: createMockSpeech(view),
    provider: "openai-speech",
    rawOutput,
    isFallback: true,
    error,
  };
}

function normalizeSpeech(speech: string): string {
  const clean = speech.trim().replace(/\s+/g, " ");
  return clean.length > 240 ? clean.slice(0, 240) : clean;
}

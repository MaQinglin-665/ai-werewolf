import { z } from "zod";
import type { AgentView } from "@/game/types";
import { createSpeechPlan } from "./tableRead";
import type { AiSpeechProvider, AiSpeechResult } from "./types";

const SpeechSchema = z.object({
  speech: z.string().min(1).max(240),
});

export const mockSpeechProvider: AiSpeechProvider = {
  providerId: "mock-speech",
  async generateSpeech(view, plan = createSpeechPlan(view)) {
    return {
      speech: createMockSpeech(view, plan),
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
  async generateSpeech(view, plan = createSpeechPlan(view)) {
    try {
      const rawOutput = await callOpenAiSpeech(view, plan);
      const parsed = SpeechSchema.safeParse(JSON.parse(rawOutput));
      if (!parsed.success) {
        return fallbackSpeech(view, plan, "LLM 输出格式不合法。", rawOutput);
      }

      return {
        speech: normalizeSpeech(parsed.data.speech),
        provider: "openai-speech",
        rawOutput,
        isFallback: false,
      };
    } catch (error) {
      return fallbackSpeech(view, plan, error instanceof Error ? error.message : "LLM 发言失败。");
    }
  },
};

function createMockSpeech(view: AgentView, plan = createSpeechPlan(view)): string {
  const persona = view.persona?.label ?? "稳健型";
  const lastDeath = view.publicSummary.recentDeaths.at(-1);
  const targetName = plan.target?.name ?? view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId)?.name ?? "场上玩家";
  const previousSpeech = view.publicSummary.recentSpeeches.at(-1);
  const previousSpeaker = previousSpeech?.speaker?.seatId === view.mySeatId ? undefined : previousSpeech?.speaker;
  const tallyText = publicTallyText(view);
  const opener = personaOpener(persona, view.mySeatId + view.day);
  const focusReason = plan.talkingPoints[0] ?? "目前还缺少能落地的发言细节";
  const secondReason = plan.talkingPoints[1] ?? "我会看后置位有没有补充过程";

  if (view.myRole === "SEER") {
    const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const pushText =
        latestCheck.result === "WEREWOLF"
          ? `今天先让 ${targetName} 正面解释，外置位不要急着分票。`
          : `${targetName} 先放一轮，警惕有人硬踩金水位。`;
      return compactSpeech(`${opener}，我报验人：${targetName} 是${resultText}。${pushText}${secondReason}。`);
    }
    return compactSpeech(`${opener}，我先不急着给死结论。${previousSpeaker ? `上一位 ${previousSpeaker.name} 的发言我会对照后面站边。` : ""}重点看谁回避昨夜信息和今天的焦点。`);
  }

  if (view.myRole === "WEREWOLF") {
    const misdirect = pickBySeat(
      view.mySeatId + view.day,
      [
        `${targetName} 的发言缺少从信息到结论的过程，先压这里听反应。`,
        `我不认单点带队，但 ${targetName} 这个位置需要把视角讲完整。`,
        `${focusReason}，所以我今天更想听 ${targetName} 怎么补逻辑。`,
      ],
    );
    return compactSpeech(`${opener}，我先按公开信息盘。${previousSpeaker ? `上一位 ${previousSpeaker.name} 没有把怀疑链讲透。` : ""}${misdirect}${tallyText}`);
  }

  if (view.myRole === "WITCH") {
    const potionTone = view.privateKnowledge.witch?.poisonAvailable ? "我会留意谁在强行带毒点" : "毒药信息已经没那么灵活";
    return compactSpeech(`${opener}，夜里信息先不扩散。${lastDeath ? `死亡播报是：${lastDeath}` : "现在还没有足够死讯。"}${potionTone}，${targetName} 先给清楚站边原因。`);
  }

  if (view.myRole === "HUNTER") {
    return compactSpeech(`${opener}，我底牌不虚但不乱拍身份。${targetName} 如果只给结论不给过程，我会把票压过去。${previousSpeaker ? `也要回看 ${previousSpeaker.name} 有没有跟风。` : ""}`);
  }

  return compactSpeech(`${opener}，我是闭眼好人，只能按公开发言和死讯盘。${previousSpeaker ? `${previousSpeaker.name} 的发言先记一笔，` : ""}${targetName} 需要解释${focusReason}。${tallyText || secondReason}`);
}

function personaOpener(persona: string, seed: number): string {
  if (persona.includes("强势") || persona.includes("悍跳")) {
    return pickBySeat(seed, ["我直接说结论", "我先把压力给出来", "这轮我不想打太散"]);
  }
  if (persona.includes("谨慎") || persona.includes("低调")) {
    return pickBySeat(seed, ["我先保守一点", "我这里不站死边", "先把疑点拆开说"]);
  }
  if (persona.includes("细节")) {
    return pickBySeat(seed, ["我抓两个细节", "我按发言前后对照", "我先校验逻辑链"]);
  }
  if (persona.includes("身份盘")) {
    return pickBySeat(seed, ["我从身份格局盘", "我先看身份收益", "这轮要看谁的身份叙事最顺"]);
  }
  if (persona.includes("情绪")) {
    return pickBySeat(seed, ["我对刚才的语气有反应", "我先说听感", "这个节奏我有点不舒服"]);
  }
  return pickBySeat(seed, ["我先给一个中性视角", "我按公开信息说", "我先把逻辑摆出来"]);
}

function publicTallyText(view: AgentView): string {
  const tally = view.publicSummary.voteSnapshot.tally;
  if (!view.publicSummary.voteSnapshot.revealed || tally.length === 0) return "";
  return `上一轮公开票数是 ${tally.map((item) => `${item.target.name}${item.count}票`).join("、")}，这个结果要进今天的判断。`;
}

function pickBySeat(seed: number, options: string[]): string {
  return options[Math.abs(seed) % options.length] ?? options[0] ?? "";
}

function compactSpeech(speech: string): string {
  const clean = speech.replace(/\s+/g, " ").replace(/。。+/g, "。").trim();
  return clean.length > 180 ? `${clean.slice(0, 178)}…` : clean;
}

async function callOpenAiSpeech(view: AgentView, plan = createSpeechPlan(view)): Promise<string> {
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
              speechPlan: plan,
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

function fallbackSpeech(view: AgentView, plan: ReturnType<typeof createSpeechPlan>, error: string, rawOutput?: unknown): AiSpeechResult {
  return {
    speech: createMockSpeech(view, plan),
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

import { callRoutedModelJson } from "@/ai/modelLlms";
import { sanitizeAiFriendRuntimeLlmConfig } from "@/game/llmConfig";
import type { AiFriendRuntimeLlmConfig } from "@/game/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LlmPresetTestResult = {
  ok: boolean;
  providerId?: string;
  textPreview?: string;
  error?: string;
};

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "请求体不是有效 JSON。" }, { status: 400 });
  }

  const config = sanitizeAiFriendRuntimeLlmConfig({
    provider: "openai-compatible",
    ...(isRecord(raw) && typeof raw.name === "string" ? { label: raw.name } : {}),
    ...(isRecord(raw) ? raw : {}),
  });

  if (!config) {
    return Response.json({ error: "需要有效的 Base URL 和模型名。" }, { status: 400 });
  }

  const connectivity = await runLlmProbe({
    apiKey: config.apiKey,
    customLlm: config,
    input: { prompt: "Reply with one short Chinese sentence." },
    system: "你是一个连通性测试助手。只返回一句简短中文。",
  });

  const projectFormat = connectivity.ok
    ? await runLlmProbe({
        apiKey: config.apiKey,
        customLlm: config,
        input: {
          seat: 3,
          phase: "DAY_SPEECH",
          publicFacts: ["1号昨晚死亡", "2号发言偏谨慎"],
          instruction: "用狼人杀玩家口吻发一句短发言，不要输出 JSON。",
        },
        system: "你是 AI 狼人杀发言测试助手。返回一句可直接展示给玩家的中文发言，不要解释。",
      })
    : {
        ok: false,
        error: "连通性测试未通过，未继续测试项目发言格式。",
      };

  return Response.json({ connectivity, projectFormat });
}

async function runLlmProbe(input: {
  apiKey?: string;
  customLlm: AiFriendRuntimeLlmConfig;
  system: string;
  input: unknown;
}): Promise<LlmPresetTestResult> {
  try {
    const result = await callRoutedModelJson({
      personaName: input.customLlm.label ?? "自定义大模型",
      task: "speech",
      system: input.system,
      input: input.input,
      maxTokens: 160,
      customLlm: input.customLlm,
    });
    const text = result.text.trim();
    return {
      ok: text.length > 0,
      providerId: result.providerId,
      textPreview: text.slice(0, 80),
      ...(text ? {} : { error: "模型响应为空。" }),
    };
  } catch (error) {
    return {
      ok: false,
      error: redactSecret(error instanceof Error ? error.message : String(error), input.apiKey),
    };
  }
}

function redactSecret(message: string, secret: string | undefined): string {
  let clean = message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
  if (secret && secret.length >= 4) {
    clean = clean.split(secret).join("***");
  }
  return clean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

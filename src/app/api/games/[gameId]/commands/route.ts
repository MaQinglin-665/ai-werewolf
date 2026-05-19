import { HumanCommandInputSchema, toHumanCommand } from "@/game/commandSchemas";
import { sanitizeAiRuntimeMode, sanitizeRuntimeAiLlmConfigMap, sanitizeRuntimeAiProviderMode } from "@/game/llmConfig";
import { continueGame, getGameView, submitHumanCommand } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const body = await request.json();
  const parsed = HumanCommandInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "动作格式不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const runtimeAiLlmConfigs = sanitizeRuntimeAiLlmConfigMap(isRecord(body) ? body.aiLlmConfigs : undefined);
    const aiRuntimeMode = sanitizeAiRuntimeMode(isRecord(body) ? body.aiRuntimeMode : undefined);
    const aiProviderMode = sanitizeRuntimeAiProviderMode(isRecord(body) ? body.aiProviderMode : undefined);
    if (parsed.data.type === "continue") {
      const nextView = await continueGame(gameId, { aiRuntimeMode, aiProviderMode, runtimeAiLlmConfigs });
      return Response.json(nextView);
    }

    const view = await getGameView(gameId);
    if (!view) {
      return Response.json({ error: missingMainGameMessage() }, { status: 404 });
    }
    if (view.humanSeatId === null) {
      return Response.json({ error: "观战模式不能提交真人动作。" }, { status: 400 });
    }
    const command = toHumanCommand(parsed.data, view.humanSeatId);
    const nextView = await submitHumanCommand(gameId, command, { aiRuntimeMode, aiProviderMode, runtimeAiLlmConfigs });
    return Response.json(nextView);
  } catch (error) {
    const message = error instanceof Error ? error.message : "动作执行失败。";
    if (message.includes("对局不存在")) {
      return Response.json({ error: missingMainGameMessage() }, { status: 404 });
    }

    return Response.json(
      { error: message },
      { status: 400 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function missingMainGameMessage(): string {
  return "当前服务端没有找到这局单机对局，可能是线上实例刚从休眠中恢复或服务重启导致旧临时存档失效。请新开一局；新版线上会把单机对局保存到 PostgreSQL，减少这种情况。";
}

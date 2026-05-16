import { HumanCommandInputSchema, toHumanCommand } from "@/game/commandSchemas";
import { sanitizeRuntimeAiLlmConfigMap } from "@/game/llmConfig";
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
    if (parsed.data.type === "continue") {
      const nextView = await continueGame(gameId, { runtimeAiLlmConfigs });
      return Response.json(nextView);
    }

    const view = await getGameView(gameId);
    if (!view) {
      return Response.json({ error: "对局不存在。" }, { status: 404 });
    }
    if (view.humanSeatId === null) {
      return Response.json({ error: "观战模式不能提交真人动作。" }, { status: 400 });
    }
    const command = toHumanCommand(parsed.data, view.humanSeatId);
    const nextView = await submitHumanCommand(gameId, command, { runtimeAiLlmConfigs });
    return Response.json(nextView);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "动作执行失败。" },
      { status: 400 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

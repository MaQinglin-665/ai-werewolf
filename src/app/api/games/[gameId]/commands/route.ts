import { HumanCommandInputSchema, toHumanCommand } from "@/game/commandSchemas";
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
    if (parsed.data.type === "continue") {
      const nextView = await continueGame(gameId);
      return Response.json(nextView);
    }

    const view = await getGameView(gameId);
    if (!view) {
      return Response.json({ error: "对局不存在。" }, { status: 404 });
    }
    const command = toHumanCommand(parsed.data, view.humanSeatId);
    const nextView = await submitHumanCommand(gameId, command);
    return Response.json(nextView);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "动作执行失败。" },
      { status: 400 },
    );
  }
}

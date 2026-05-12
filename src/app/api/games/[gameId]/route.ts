import { getGameView } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const view = await getGameView(gameId);
  if (!view) {
    return Response.json({ error: "对局不存在。" }, { status: 404 });
  }

  return Response.json(view);
}

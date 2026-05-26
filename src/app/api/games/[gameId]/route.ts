import { getGameView } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const view = await getGameView(gameId);
  if (!view) {
    return Response.json({ error: missingMainGameMessage() }, { status: 404 });
  }

  return Response.json(view);
}

function missingMainGameMessage(): string {
  return "当前服务端没有找到这局单机对局，可能是线上实例刚从休眠中恢复或服务重启导致旧临时存档失效。请新开一局；新版线上会把单机对局保存到 PostgreSQL，减少这种情况。";
}

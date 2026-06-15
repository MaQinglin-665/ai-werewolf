import { checkRoomMetricsAccess, readRoomMetricsRequestToken } from "@/server/roomMetricsAccess";
import { getMainGameSample } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const access = checkRoomMetricsAccess(readRoomMetricsRequestToken(request));
  if (!access.allowed) {
    return new Response("Not Found", {
      headers: { "Cache-Control": "no-store" },
      status: 404,
    });
  }

  const { gameId } = await params;
  const sample = await getMainGameSample(gameId);
  if (!sample) {
    return Response.json({ error: missingMainGameMessage() }, { status: 404 });
  }

  return Response.json(sample, {
    headers: { "Cache-Control": "no-store" },
  });
}

function missingMainGameMessage(): string {
  return "当前服务端没有找到这局单机对局，可能是线上实例刚从休眠中恢复或服务重启导致旧临时存档失效。请新开一局；新版线上会把单机对局保存到 PostgreSQL，减少这种情况。";
}

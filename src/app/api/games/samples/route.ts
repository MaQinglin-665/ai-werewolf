import { checkRoomMetricsAccess, readRoomMetricsRequestToken } from "@/server/roomMetricsAccess";
import { listRecentMainGameSamples } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = checkRoomMetricsAccess(readRoomMetricsRequestToken(request));
  if (!access.allowed) {
    return new Response("Not Found", {
      headers: { "Cache-Control": "no-store" },
      status: 404,
    });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  return Response.json(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      samples: await listRecentMainGameSamples(limit),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function parseLimit(raw: string | null): number {
  const parsed = raw ? Number(raw) : 20;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, Math.trunc(parsed))) : 20;
}

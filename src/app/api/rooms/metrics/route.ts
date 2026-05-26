import { checkRoomMetricsAccess, readRoomMetricsRequestToken } from "@/server/roomMetricsAccess";
import { getRoomMetricsSnapshot } from "@/server/roomService";

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

  return Response.json(await getRoomMetricsSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}

import { joinRoomSession } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const joinRoomSchema = z
  .object({
    playerName: z.string().min(1).max(16).optional(),
    seatId: z.number().int().min(1).max(20).optional(),
  })
  .optional();

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "join", roomId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => undefined);
  const parsed = joinRoomSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "加入房间参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(await joinRoomSession(roomId, parsed.data));
  } catch (error) {
    return roomErrorResponse(error);
  }
}

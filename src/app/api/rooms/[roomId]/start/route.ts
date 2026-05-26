import { startRoomSession } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startRoomSchema = z.object({
  playerId: z.string().min(1).max(120),
  playerToken: z.string().min(16).max(160).optional(),
  expectedRevision: z.number().int().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "write", roomId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => undefined);
  const parsed = startRoomSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "开局参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(
      await startRoomSession(roomId, { playerId: parsed.data.playerId, playerToken: parsed.data.playerToken }, {
        expectedRevision: parsed.data.expectedRevision,
      }),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}

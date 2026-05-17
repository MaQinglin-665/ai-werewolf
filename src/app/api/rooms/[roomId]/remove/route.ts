import { removeRoomPlayerSession } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const removeRoomPlayerSchema = z.object({
  requesterPlayerId: z.string().min(1).max(120),
  requesterPlayerToken: z.string().min(16).max(160).optional(),
  expectedRevision: z.number().int().min(1).optional(),
  targetPlayerId: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "write", roomId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => undefined);
  const parsed = removeRoomPlayerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "移除玩家参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(
      await removeRoomPlayerSession(
        roomId,
        { playerId: parsed.data.requesterPlayerId, playerToken: parsed.data.requesterPlayerToken },
        parsed.data.targetPlayerId,
        { expectedRevision: parsed.data.expectedRevision },
      ),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}

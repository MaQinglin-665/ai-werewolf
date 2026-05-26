import { setRoomPlayerSeat } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const setSeatSchema = z.object({
  playerId: z.string().min(1).max(120),
  playerToken: z.string().min(16).max(160).optional(),
  expectedRevision: z.number().int().min(1).optional(),
  seatId: z.number().int().min(1).max(20).nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "write", roomId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => undefined);
  const parsed = setSeatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "选座参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(
      await setRoomPlayerSeat(
        roomId,
        { playerId: parsed.data.playerId, playerToken: parsed.data.playerToken },
        parsed.data.seatId,
        { expectedRevision: parsed.data.expectedRevision },
      ),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}

import { HumanCommandInputSchema } from "@/game/commandSchemas";
import type { HumanCommandInput } from "@/game/commandSchemas";
import { submitRoomPlayerCommand } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roomCommandSchema = HumanCommandInputSchema.and(
  z.object({
    playerId: z.string().min(1).max(120),
    playerToken: z.string().min(16).max(160).optional(),
    expectedRevision: z.number().int().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).max(120).optional(),
  }),
);

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "write", roomId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => undefined);
  const parsed = roomCommandSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "房间动作参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  const { expectedRevision, idempotencyKey, playerId, playerToken, ...commandInput } = parsed.data;
  try {
    return Response.json(
      await submitRoomPlayerCommand(roomId, { playerId, playerToken }, commandInput as HumanCommandInput, {
        expectedRevision,
        idempotencyKey,
      }),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}

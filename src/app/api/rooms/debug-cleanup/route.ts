import { cleanupInactiveRoomSessionsForDev } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const debugCleanupSchema = z
  .object({
    excludeRoomId: z.string().min(1).max(120).optional(),
  })
  .optional();

export async function POST(request: Request) {
  const rateLimited = await roomRateLimitResponse(request, "debug");
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => undefined);
  const parsed = debugCleanupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "清理参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(await cleanupInactiveRoomSessionsForDev({ excludeRoomIdOrCode: parsed.data?.excludeRoomId }));
  } catch (error) {
    return roomErrorResponse(error);
  }
}

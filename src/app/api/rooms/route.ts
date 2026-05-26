import { createRoomSession } from "@/server/roomService";
import { z } from "zod";
import { roomErrorResponse, roomRateLimitResponse } from "./routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createRoomSchema = z
  .object({
    boardId: z.string().min(1).max(80).optional(),
    hostName: z.string().min(1).max(16).optional(),
    hostSeatId: z.number().int().min(1).max(20).optional(),
  })
  .optional();

export async function POST(request?: Request) {
  const rateLimited = await roomRateLimitResponse(request, "create");
  if (rateLimited) return rateLimited;

  const body = request ? await request.json().catch(() => undefined) : undefined;
  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "创建房间参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(await createRoomSession(parsed.data));
  } catch (error) {
    return roomErrorResponse(error);
  }
}

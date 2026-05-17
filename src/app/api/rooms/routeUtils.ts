import { RoomSessionError, type RoomPlayerCredential } from "@/server/roomService";
import { applyRoomRateLimit, type RoomRateLimitBucket } from "@/server/roomRateLimit";
import { z } from "zod";

export const roomPlayerCredentialFieldsSchema = z.object({
  playerId: z.string().min(1).max(120).optional(),
  playerToken: z.string().min(16).max(160).optional(),
});

export const roomPlayerCredentialSchema = roomPlayerCredentialFieldsSchema.refine(
  (value) => Boolean(value.playerToken || value.playerId),
  {
    message: "缺少玩家凭据。",
    path: ["playerToken"],
  },
);

export function readRoomPlayerCredential(url: URL): RoomPlayerCredential | undefined {
  const playerToken = url.searchParams.get("playerToken") ?? url.searchParams.get("token") ?? undefined;
  const playerId = url.searchParams.get("playerId") ?? url.searchParams.get("player") ?? undefined;
  if (!playerToken && !playerId) return undefined;
  return { playerId, playerToken };
}

export function roomErrorResponse(error: unknown): Response {
  if (error instanceof RoomSessionError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: error instanceof Error ? error.message : "房间操作失败。" }, { status: 400 });
}

export async function roomRateLimitResponse(
  request: Request | undefined,
  bucket: RoomRateLimitBucket,
  scope?: string,
): Promise<Response | undefined> {
  try {
    return await applyRoomRateLimit(request, bucket, scope);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "房间限流检查失败。" },
      { status: 500 },
    );
  }
}

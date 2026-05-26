import { getRoomSessionView } from "@/server/roomService";
import { readRoomPlayerCredential, roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "read", roomId);
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const credential = readRoomPlayerCredential(url);

  try {
    return Response.json(await getRoomSessionView(roomId, credential));
  } catch (error) {
    return roomErrorResponse(error);
  }
}

import { getRoomSessionView, ROOM_SSE_HEARTBEAT_MS, subscribeRoomSessionUpdates } from "@/server/roomService";
import { readRoomPlayerCredential, roomErrorResponse, roomRateLimitResponse } from "../../routeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rateLimited = await roomRateLimitResponse(request, "stream", roomId);
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const credential = readRoomPlayerCredential(url);

  if (!credential) {
    return Response.json({ error: "缺少玩家凭据。" }, { status: 400 });
  }

  try {
    await getRoomSessionView(roomId, credential);
  } catch (error) {
    return roomErrorResponse(error);
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let clearHeartbeat = () => {};

      const onAbort = () => close();
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearHeartbeat();
        request.signal.removeEventListener("abort", onAbort);
      };

      const send = (event: string, data: unknown, id?: number) => {
        if (closed) return;
        try {
          const idLine = id === undefined ? "" : `id: ${id}\n`;
          controller.enqueue(encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          close();
        }
      };

      const sendRoomView = async (id?: number) => {
        try {
          send("room", await getRoomSessionView(roomId, credential), id);
        } catch (error) {
          send("error", { error: error instanceof Error ? error.message : "房间同步失败。" });
          close();
        }
      };

      unsubscribe = await subscribeRoomSessionUpdates(roomId, credential, (event) => {
        void sendRoomView(event.version);
      });

      cleanup = close;
      request.signal.addEventListener("abort", onAbort, { once: true });
      const heartbeatTimer = setInterval(() => {
        send("heartbeat", { at: new Date().toISOString() });
      }, ROOM_SSE_HEARTBEAT_MS);
      clearHeartbeat = () => clearInterval(heartbeatTimer);

      controller.enqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));
      await sendRoomView(0);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

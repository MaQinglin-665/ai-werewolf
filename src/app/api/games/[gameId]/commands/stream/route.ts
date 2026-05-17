import { HumanCommandInputSchema } from "@/game/commandSchemas";
import { sanitizeAiRuntimeMode, sanitizeRuntimeAiLlmConfigMap, sanitizeRuntimeAiProviderMode } from "@/game/llmConfig";
import { continueGameWithSpeechStream } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const body = await request.json().catch(() => undefined);
  const parsed = HumanCommandInputSchema.safeParse(body);

  if (!parsed.success || parsed.data.type !== "continue") {
    return Response.json({ error: "流式接口只支持继续流程。" }, { status: 400 });
  }

  const runtimeAiLlmConfigs = sanitizeRuntimeAiLlmConfigMap(isRecord(body) ? body.aiLlmConfigs : undefined);
  const aiRuntimeMode = sanitizeAiRuntimeMode(isRecord(body) ? body.aiRuntimeMode : undefined);
  const aiProviderMode = sanitizeRuntimeAiProviderMode(isRecord(body) ? body.aiProviderMode : undefined);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The mobile browser or tunnel may have already closed the stream.
        }
      };

      void continueGameWithSpeechStream(
        gameId,
        {
          onTextSnapshot: (text) => send("speech", { text }),
        },
        { aiRuntimeMode, aiProviderMode, runtimeAiLlmConfigs },
      )
        .then((view) => {
          send("done", { view });
          close();
        })
        .catch((error) => {
          send("error", { error: error instanceof Error ? error.message : "流式推进失败。" });
          close();
        });
    },
    cancel() {
      // The game advance continues server-side; the client can refresh the latest view.
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

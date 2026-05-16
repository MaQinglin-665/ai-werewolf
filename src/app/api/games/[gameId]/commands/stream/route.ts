import { HumanCommandInputSchema } from "@/game/commandSchemas";
import { sanitizeAiRuntimeMode, sanitizeRuntimeAiLlmConfigMap } from "@/game/llmConfig";
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
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      void continueGameWithSpeechStream(
        gameId,
        {
          onTextSnapshot: (text) => send("speech", { text }),
        },
        { aiRuntimeMode, runtimeAiLlmConfigs },
      )
        .then((view) => {
          send("done", { view });
          controller.close();
        })
        .catch((error) => {
          send("error", { error: error instanceof Error ? error.message : "流式推进失败。" });
          controller.close();
        });
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

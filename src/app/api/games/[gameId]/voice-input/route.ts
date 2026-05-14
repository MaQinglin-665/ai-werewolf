import { z } from "zod";
import { buildHumanView } from "@/game/projection";
import { getGameState } from "@/server/gameService";
import { processVoiceInputTranscript, VoiceInputError } from "@/server/voiceInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VoiceInputBodySchema = z.object({
  mode: z.enum(["speak", "lastWords"]),
  transcript: z.string().min(1).max(1200),
});

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const body = await request.json().catch(() => undefined);
  const parsed = VoiceInputBodySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "语音输入参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  const state = await getGameState(gameId);
  if (!state) {
    return Response.json({ error: "对局不存在。" }, { status: 404 });
  }

  const view = buildHumanView(state);
  const canUseVoiceInput = view.availableActions.some((action) => action.type === parsed.data.mode);
  if (!canUseVoiceInput) {
    return Response.json({ error: "当前阶段不能使用语音发言。" }, { status: 409 });
  }

  try {
    const result = await processVoiceInputTranscript({
      transcript: parsed.data.transcript,
      mode: parsed.data.mode,
      game: state,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof VoiceInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "语音输入处理失败。" }, { status: 502 });
  }
}

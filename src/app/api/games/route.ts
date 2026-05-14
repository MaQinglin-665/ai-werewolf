import { createGameRecord } from "@/server/gameService";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createGameSchema = z
  .object({
    boardId: z.string().min(1).max(80).optional(),
  })
  .optional();

export async function POST(request?: Request) {
  const body = request ? await request.json().catch(() => undefined) : undefined;
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "创建对局参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }
  const view = await createGameRecord({ boardId: parsed.data?.boardId });
  return Response.json(view);
}

import { randomUUID } from "node:crypto";
import { recordRoomAnalyticsEvent } from "@/server/roomAnalytics";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analyticsEventSchema = z
  .object({
    eventType: z.enum(["home_view", "room_page_view", "room_recovery_restored"]),
    path: z.enum(["/", "/rooms"]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = analyticsEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "统计事件不合法。" }, { status: 400 });
  }

  await recordRoomAnalyticsEvent({
    eventType: parsed.data.eventType,
    subjectId: randomUUID(),
    payload: parsed.data.path ? { path: parsed.data.path } : undefined,
  });

  return Response.json({ ok: true });
}

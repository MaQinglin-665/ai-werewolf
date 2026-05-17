import { randomUUID } from "node:crypto";
import { recordRoomAnalyticsEvent } from "@/server/roomAnalytics";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteAnalyticsEventSchema = z.object({
  eventType: z.literal("home_view"),
  path: z.string().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = siteAnalyticsEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "统计事件不合法。" }, { status: 400 });
  }

  await recordRoomAnalyticsEvent({
    eventType: "home_view",
    subjectId: randomUUID(),
    payload: {
      path: parsed.data.path ?? "/",
    },
  });

  return Response.json({ ok: true });
}

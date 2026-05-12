import { createGameRecord } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const view = await createGameRecord();
  return Response.json(view);
}

import { listGameBoards } from "@/server/gameService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ boards: listGameBoards() });
}

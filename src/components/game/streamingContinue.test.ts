import { describe, expect, it, vi } from "vitest";
import { submitStreamingContinue } from "./streamingContinue";
import type { HumanGameView } from "@/game/types";
import { POST as createGame } from "@/app/api/games/route";

describe("submitStreamingContinue", () => {
  it("falls back to non-streaming continue when the stream endpoint is unavailable", async () => {
    const game = await createGameView();
    const nextView = { ...game, phase: "DAY_SPEECH" as const, phaseLabel: "白天发言" };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }))
      .mockResolvedValueOnce(Response.json(nextView));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitStreamingContinue(game, { type: "continue" }, undefined, "mock", () => undefined);

    expect(result).toEqual(nextView);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/game-1/commands/stream");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/games/game-1/commands");
  });
});

async function createGameView(): Promise<HumanGameView> {
  const response = await createGame(
    new Request("http://localhost/api/games", {
      method: "POST",
      body: JSON.stringify({ boardId: "6p-beginner-seer" }),
    }),
  );
  const view = (await response.json()) as HumanGameView;
  return { ...view, id: "game-1", availableActions: [{ type: "continue", label: "继续", description: "继续流程" }] };
}

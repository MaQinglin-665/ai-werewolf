import { describe, expect, it } from "vitest";
import { POST as submitCommand } from "./[gameId]/commands/route";
import { GET as getGame } from "./[gameId]/route";
import { POST as createGame } from "./route";
import type { HumanGameView } from "@/game/types";

describe("game api routes", () => {
  it("creates a game and returns a redacted human view", async () => {
    const response = await createGame();
    expect(response.status).toBe(200);

    const view = (await response.json()) as HumanGameView;
    expect(view.id).toBeTruthy();
    expect(view.seats).toHaveLength(9);
    expect(view.seats.filter((seat) => seat.role).length).toBeLessThan(9);

    const getResponse = await getGame(new Request(`http://localhost/api/games/${view.id}`), {
      params: Promise.resolve({ gameId: view.id }),
    });
    expect(getResponse.status).toBe(200);
  });

  it("rejects invalid command payloads", async () => {
    const createResponse = await createGame();
    const view = (await createResponse.json()) as HumanGameView;
    const response = await submitCommand(
      new Request(`http://localhost/api/games/${view.id}/commands`, {
        method: "POST",
        body: JSON.stringify({ type: "vote", targetSeatId: 99 }),
      }),
      { params: Promise.resolve({ gameId: view.id }) },
    );

    expect(response.status).toBe(400);
  });
});

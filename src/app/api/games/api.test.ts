import { describe, expect, it } from "vitest";
import { POST as submitCommand } from "./[gameId]/commands/route";
import { GET as getGame } from "./[gameId]/route";
import { POST as createGame } from "./route";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";

describe("game api routes", () => {
  it("creates a game and returns a redacted human view", async () => {
    const response = await createGame();
    expect(response.status).toBe(200);

    const view = (await response.json()) as HumanGameView;
    expect(view.id).toBeTruthy();
    expect(view.seats).toHaveLength(9);
    expect(view.seats.filter((seat) => seat.role).length).toBeLessThan(9);
    expect(view.tableSummary.recentSpeeches).toBeDefined();
    expect(JSON.stringify(view.tableSummary)).not.toMatch(/"role"|"roleLabel"/);

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

  it("advances one visible AI or system step with continue", async () => {
    const createResponse = await createGame();
    const initialView = (await createResponse.json()) as HumanGameView;
    const continueAction = initialView.availableActions.find((action) => action.type === "continue");

    if (!continueAction) {
      expect(initialView.availableActions.length).toBeGreaterThan(0);
      return;
    }

    const response = await submitCommand(
      new Request(`http://localhost/api/games/${initialView.id}/commands`, {
        method: "POST",
        body: JSON.stringify({ type: "continue" }),
      }),
      { params: Promise.resolve({ gameId: initialView.id }) },
    );
    const nextView = (await response.json()) as HumanGameView;

    expect(response.status).toBe(200);
    expect(nextView.id).toBe(initialView.id);
    expect(nextView.publicEvents.length).toBeGreaterThanOrEqual(initialView.publicEvents.length);
  });

  it("returns endgame review turning points through the API", async () => {
    const createResponse = await createGame();
    let view = (await createResponse.json()) as HumanGameView;

    for (let step = 0; step < 200 && !view.result; step += 1) {
      const action = view.availableActions[0];
      expect(action).toBeDefined();
      const response = await submitCommand(
        new Request(`http://localhost/api/games/${view.id}/commands`, {
          method: "POST",
          body: JSON.stringify(commandFromAction(action)),
        }),
        { params: Promise.resolve({ gameId: view.id }) },
      );
      expect(response.status).toBe(200);
      view = (await response.json()) as HumanGameView;
    }

    expect(view.result).toBeDefined();
    expect(view.review?.turningPoints.length).toBeGreaterThanOrEqual(3);
  });
});

function commandFromAction(action: AvailableHumanAction): Record<string, unknown> {
  switch (action.type) {
    case "wolfKill":
    case "seerCheck":
    case "vote":
      return { type: action.type, targetSeatId: action.targets[0].seatId };
    case "witchAction":
      if (action.canSave) return { type: "witchAction", mode: "save" };
      if (action.canPoison && action.poisonTargets[0]) {
        return { type: "witchAction", mode: "poison", targetSeatId: action.poisonTargets[0].seatId };
      }
      return { type: "witchAction", mode: "skip" };
    case "speak":
      return { type: "speak", message: "我先按公开发言和票型判断，重点看谁在回避信息。" };
    case "hunterShoot":
      return action.targets[0]
        ? { type: "hunterShoot", targetSeatId: action.targets[0].seatId }
        : { type: "hunterShoot" };
    case "continue":
      return { type: "continue" };
  }
}

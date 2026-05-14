import { describe, expect, it } from "vitest";
import { POST as submitCommand } from "./[gameId]/commands/route";
import { GET as getGame } from "./[gameId]/route";
import { POST as submitVoiceInput } from "./[gameId]/voice-input/route";
import { GET as getBoards } from "./boards/route";
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
    expect(view.reviewDebug).toBeUndefined();

    const getResponse = await getGame(new Request(`http://localhost/api/games/${view.id}`), {
      params: Promise.resolve({ gameId: view.id }),
    });
    expect(getResponse.status).toBe(200);
  });

  it("lists boards and creates a 12-player board when requested", async () => {
    const boardsResponse = await getBoards();
    expect(boardsResponse.status).toBe(200);
    const boardsPayload = (await boardsResponse.json()) as { boards: Array<{ id: string }> };
    expect(boardsPayload.boards.map((board) => board.id)).toEqual(
      expect.arrayContaining(["9p-seer-witch-hunter", "12p-sheriff-seer-witch-hunter-guard"]),
    );

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "12p-sheriff-seer-witch-hunter-guard" }),
      }),
    );
    expect(response.status).toBe(200);
    const view = (await response.json()) as HumanGameView;
    expect(view.board.id).toBe("12p-sheriff-seer-witch-hunter-guard");
    expect(view.seats).toHaveLength(12);
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

  it("rewrites voice transcript drafts without advancing the game", async () => {
    const previousProvider = process.env.VOICE_INPUT_REWRITE_PROVIDER;
    process.env.VOICE_INPUT_REWRITE_PROVIDER = "mock";

    try {
      const view = await createGameAtHumanAction("speak");
      const speechCountBefore = view.tableSummary.recentSpeeches.length;
      const response = await submitVoiceInput(
        new Request(`http://localhost/api/games/${view.id}/voice-input`, {
          method: "POST",
          body: JSON.stringify({ mode: "speak", transcript: "二号像狼先出" }),
        }),
        { params: Promise.resolve({ gameId: view.id }) },
      );
      const result = (await response.json()) as { transcript: string; message: string; confidenceNote?: string };

      expect(response.status).toBe(200);
      expect(result.transcript).toBe("二号像狼先出");
      expect(result.message).toContain("2号");
      expect(result.confidenceNote).toBe("mock");

      const getResponse = await getGame(new Request(`http://localhost/api/games/${view.id}`), {
        params: Promise.resolve({ gameId: view.id }),
      });
      const nextView = (await getResponse.json()) as HumanGameView;
      expect(nextView.tableSummary.recentSpeeches).toHaveLength(speechCountBefore);
      expect(nextView.availableActions.some((action) => action.type === "speak")).toBe(true);
    } finally {
      if (previousProvider === undefined) {
        delete process.env.VOICE_INPUT_REWRITE_PROVIDER;
      } else {
        process.env.VOICE_INPUT_REWRITE_PROVIDER = previousProvider;
      }
    }
  });

  it("rejects voice input outside speech actions", async () => {
    const createResponse = await createGame();
    const view = (await createResponse.json()) as HumanGameView;
    const response = await submitVoiceInput(
      new Request(`http://localhost/api/games/${view.id}/voice-input`, {
        method: "POST",
        body: JSON.stringify({ mode: "speak", transcript: "我先说两句" }),
      }),
      { params: Promise.resolve({ gameId: view.id }) },
    );

    expect(response.status).toBe(409);
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
    expect(view.review?.voteImpacts.length).toBeGreaterThan(0);
    expect(view.review?.voteImpacts.some((impact) => impact.description.includes("终局身份") || impact.outcome === "tie")).toBe(true);
    expect(view.reviewDebug?.aiCalls.length).toBeGreaterThan(0);
    expect(view.reviewDebug?.aiCalls.some((call) => call.publicFactBasis.length > 0)).toBe(true);
    expect(JSON.stringify(view.reviewDebug?.aiCalls.flatMap((call) => call.publicFactBasis))).not.toMatch(
      /真实身份|狼队友|privateKnowledge|ROLE_ASSIGNED/,
    );
  });
});

async function createGameAtHumanAction(targetType: AvailableHumanAction["type"]): Promise<HumanGameView> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const createResponse = await createGame();
    let view = (await createResponse.json()) as HumanGameView;

    for (let step = 0; step < 200 && !view.result; step += 1) {
      if (view.availableActions.some((action) => action.type === targetType)) {
        return view;
      }

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
  }

  throw new Error(`Could not reach human ${targetType} action.`);
}

function commandFromAction(action: AvailableHumanAction): Record<string, unknown> {
  switch (action.type) {
    case "wolfKill":
    case "seerCheck":
    case "vote":
      return { type: action.type, targetSeatId: action.targets[0].seatId };
    case "guardAction":
      return action.targets[0] ? { type: "guardAction", targetSeatId: action.targets[0].seatId } : { type: "guardAction" };
    case "witchAction":
      if (action.canSave) return { type: "witchAction", mode: "save" };
      if (action.canPoison && action.poisonTargets[0]) {
        return { type: "witchAction", mode: "poison", targetSeatId: action.poisonTargets[0].seatId };
      }
      return { type: "witchAction", mode: "skip" };
    case "speak":
      return { type: "speak", message: "我先按公开发言和票型判断，重点看谁在回避信息。" };
    case "sheriffSpeech":
      return { type: "sheriffSpeech", message: "我竞选警长先按公开发言和票型组织桌面。" };
    case "sheriffNominate":
      return { type: "sheriffNominate", run: true };
    case "sheriffWithdraw":
      return { type: "sheriffWithdraw", withdraw: false };
    case "sheriffVote":
      return action.targets[0] ? { type: "sheriffVote", targetSeatId: action.targets[0].seatId } : { type: "sheriffVote" };
    case "sheriffHandoff":
      return action.targets[0] ? { type: "sheriffHandoff", targetSeatId: action.targets[0].seatId } : { type: "sheriffHandoff" };
    case "lastWords":
      return { type: "lastWords", message: "我留下最后视角，重点看今天票型和谁在跟风。" };
    case "hunterShoot":
      return action.targets[0]
        ? { type: "hunterShoot", targetSeatId: action.targets[0].seatId }
        : { type: "hunterShoot" };
    case "continue":
      return { type: "continue" };
  }
}

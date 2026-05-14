import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockCommand } from "./mockAgent";
import { routedModelActionProvider } from "./actionProviders";
import { buildAiTableRead, createVotePlan } from "./tableRead";
import { buildAgentView } from "@/game/projection";
import { createGame } from "@/game/engine";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("routed action provider", () => {
  it("tries an action fallback persona after invalid primary JSON", async () => {
    process.env.AI_LLM_API_KEY = "test-key";
    process.env.AI_LLM_MAX_RETRIES = "1";
    process.env.AI_LLM_ACTION_FALLBACK_PERSONAS = "GPT";
    process.env.AI_MODEL_DEEPSEEK = "deepseek-v4-flash";
    process.env.AI_MODEL_GPT = "gpt-5.4";

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      if (requestBody.model === "deepseek-v4-flash") {
        return new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      const input = JSON.parse(requestBody.messages.at(-1)?.content ?? "{}") as {
        candidates: Array<{ id: string; command: { type: string } }>;
      };
      const candidate = input.candidates.find((item) => item.command.type === "vote") ?? input.candidates[0];
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ candidateId: candidate?.id, reason: "public evidence is clearer here" }) } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = createGame({ seed: 91 });
    const voter = state.seats.find((seat) => seat.isAi && seat.name === "DeepSeek")!;
    state.phase = "DAY_VOTE";
    const view = buildAgentView(state, voter.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const fallbackCommand = createMockCommand(view, tableRead, votePlan);

    const result = await routedModelActionProvider.generateCommand(view, { tableRead, votePlan, fallbackCommand });

    const requestedModels = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String(call[1]?.body)) as { model: string };
      return body.model;
    });
    expect(requestedModels).toEqual(["deepseek-v4-flash", "gpt-5.4"]);
    expect(result.isFallback).toBe(false);
    expect(result.provider).toBe("gpt-action:gpt-5.4");
    expect(result.command).toMatchObject({ type: "vote", actorSeatId: voter.seatId });
  });
});

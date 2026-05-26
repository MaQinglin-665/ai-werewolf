# GameClient Lifecycle Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract GameClient request construction, response parsing, and stream-continue speech context into a focused tested helper module.

**Architecture:** Keep `GameClient.tsx` as the React orchestration layer. Add `src/components/game/gameClientRequests.ts` for fetch-facing request helpers and pure stream context preparation, while preserving `submitStreamingContinue` for the existing SSE implementation.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing `HumanGameView`, `AiRuntimeMode`, and `CommandPayload` types.

---

## File Structure

- Create `src/components/game/gameClientRequests.ts`: exports lifecycle request helpers and stream context model.
- Create `src/components/game/gameClientRequests.test.ts`: focused tests for request bodies, errors, and stream context.
- Modify `src/components/GameClient.tsx`: imports and uses helpers, while keeping React state, refs, audio, and UI transitions local.
- Update `docs/tasks/2026-05-gameclient-lifecycle-requests.md`, `feature_list.json`, `progress.md`, and `session-handoff.md`: record status and verification.

### Task 1: Define Request Helper Tests

**Files:**

- Create: `src/components/game/gameClientRequests.test.ts`
- Create later: `src/components/game/gameClientRequests.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import type { HumanGameView } from "@/game/types";
import {
  buildStreamingContinueContext,
  createGameView,
  loadGameView,
  submitGameCommand,
} from "./gameClientRequests";

describe("gameClientRequests", () => {
  it("loads a game by id and rejects missing games with the existing message", async () => {
    const view = { id: "game-1" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));

    await expect(loadGameView("game-1", fetchMock)).resolves.toBe(view);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/game-1");

    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404 }));
    await expect(loadGameView("missing", fetchMock)).rejects.toThrow("对局不存在或已被清理。");
  });

  it("creates a game with selected board, nullable spectator seat, and selected AI friends", async () => {
    const view = { id: "game-2" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));

    await expect(
      createGameView({
        boardId: undefined,
        selectedBoardId: "6p-beginner-seer",
        humanSeatMode: "none",
        selectedHumanSeatId: 2,
        selectedAiFriends: [{ id: "friend-1", nickname: "阿一" }],
        fetcher: fetchMock,
      }),
    ).resolves.toBe(view);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/games");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      boardId: "6p-beginner-seer",
      humanSeatId: null,
      aiFriends: [{ id: "friend-1", nickname: "阿一" }],
    });
  });

  it("submits normal commands with runtime mode and LLM configs", async () => {
    const view = { id: "game-3" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));

    await expect(
      submitGameCommand({
        gameId: "game-3",
        payload: { type: "vote", targetSeatId: 4 },
        aiRuntimeMode: "llm",
        aiLlmConfigs: { friend: { model: "demo" } },
        fetcher: fetchMock,
      }),
    ).resolves.toBe(view);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/game-3/commands");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      type: "vote",
      targetSeatId: 4,
      aiRuntimeMode: "llm",
      aiLlmConfigs: { friend: { model: "demo" } },
    });
  });

  it("builds stream context only for enabled AI speakers and preserves previous speech keys", () => {
    const game = {
      id: "game-4",
      day: 2,
      humanSeatId: 1,
      currentSpeakerSeatId: 3,
      seats: [{ seatId: 1 }, { seatId: 3, personaName: "deepseek", ttsVoice: "voice-3" }],
      tableSummary: { recentSpeeches: [{ day: 2, turn: 1, speakerSeatId: 3, message: "发言" }] },
    } as unknown as HumanGameView;

    const context = buildStreamingContinueContext(game, true);

    expect(context.streamingSpeaker?.seatId).toBe(3);
    expect(context.streamingSpeechKeyPrefix).toBe("game-4:2:live-tts:3");
    expect([...context.previousSpeechKeys]).toEqual(["game-4:2:1:3"]);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test -- src/components/game/gameClientRequests.test.ts`

Expected: FAIL because `./gameClientRequests` does not exist.

### Task 2: Implement The Helper Module

**Files:**

- Create: `src/components/game/gameClientRequests.ts`

- [ ] **Step 1: Add minimal implementation**

```ts
import type { AiFriendRuntimeLlmConfig, AiRuntimeMode, HumanGameView } from "@/game/types";
import { speechStreamKey } from "./autoAdvance";
import type { AiFriendOption, CommandPayload, HumanSeatMode } from "./clientTypes";

type Fetcher = typeof fetch;

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export async function loadGameView(gameId: string, fetcher: Fetcher = fetch): Promise<HumanGameView> {
  const response = await fetcher(`/api/games/${gameId}`);
  if (!response.ok) throw new Error("对局不存在或已被清理。");
  return (await response.json()) as HumanGameView;
}

export async function createGameView(options: {
  boardId?: string;
  selectedBoardId: string | null;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
  selectedAiFriends: AiFriendOption[];
  fetcher?: Fetcher;
}): Promise<HumanGameView> {
  const response = await (options.fetcher ?? fetch)("/api/games", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      boardId: options.boardId ?? options.selectedBoardId ?? undefined,
      humanSeatId: options.humanSeatMode === "none" ? null : options.selectedHumanSeatId ?? undefined,
      aiFriends: options.selectedAiFriends,
    }),
  });
  if (!response.ok) throw new Error("创建对局失败。");
  return (await response.json()) as HumanGameView;
}

export async function submitGameCommand(options: {
  gameId: string;
  payload: Exclude<CommandPayload, { type: "continue" }>;
  aiRuntimeMode: AiRuntimeMode;
  aiLlmConfigs: Record<string, AiFriendRuntimeLlmConfig> | undefined;
  fetcher?: Fetcher;
}): Promise<HumanGameView> {
  const response = await (options.fetcher ?? fetch)(`/api/games/${options.gameId}/commands`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...options.payload, aiRuntimeMode: options.aiRuntimeMode, aiLlmConfigs: options.aiLlmConfigs }),
  });
  const data = (await response.json().catch(() => ({}))) as HumanGameView | { error?: string };
  if (!response.ok) throw new Error("error" in data && data.error ? data.error : "动作执行失败。");
  return data as HumanGameView;
}

export function buildStreamingContinueContext(game: HumanGameView, aiSpeechAudioEnabled: boolean) {
  const previousSpeechKeys = new Set(game.tableSummary.recentSpeeches.map((speech) => speechStreamKey(game.id, speech)));
  const streamingSpeaker = game.currentSpeakerSeatId ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId) : undefined;
  const streamingSpeechKeyPrefix =
    aiSpeechAudioEnabled && streamingSpeaker && streamingSpeaker.seatId !== game.humanSeatId
      ? `${game.id}:${game.day}:live-tts:${streamingSpeaker.seatId}`
      : undefined;
  return { previousSpeechKeys, streamingSpeaker, streamingSpeechKeyPrefix };
}
```

- [ ] **Step 2: Run focused tests to verify GREEN**

Run: `npm run test -- src/components/game/gameClientRequests.test.ts`

Expected: PASS.

### Task 3: Wire GameClient

**Files:**

- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Replace inline request logic**

Import `buildStreamingContinueContext`, `createGameView`, `loadGameView`, and `submitGameCommand`. Use them inside `loadGameById`, `startGame`, and the non-continue branch of `submitCommand`.

- [ ] **Step 2: Keep orchestration local**

Do not move `setLoading`, `setError`, audio refs, `createStreamingAiSpeechTtsQueue`, or role-intro logic. Only replace fetch/request construction and pure stream context preparation.

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- src/components/game/gameClientRequests.test.ts`

Expected: PASS.

### Task 4: Verify And Handoff

**Files:**

- Modify: `docs/tasks/2026-05-gameclient-lifecycle-requests.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run verification**

Run:

```powershell
npm run test -- src/components/game/gameClientRequests.test.ts
npm run lint
npx tsc --noEmit
npm run harness:task-card -- docs/tasks/2026-05-gameclient-lifecycle-requests.md
npm run harness:check
npm run audit:structure
npm run smoke:main-game -- --base-url=http://127.0.0.1:3000
git diff --check
```

- [ ] **Step 2: Update state and handoff**

Record changed files, exact commands, skipped production check, and the next recommended boundary.

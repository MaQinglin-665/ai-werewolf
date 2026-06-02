# Room Vote And Class Trial Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ordinary public-room voting smoke complete reliably, then separate class-trial flow and speech direction from ordinary Werewolf so the theme feels like a trial without breaking local/public ordinary rules.

**Architecture:** Ordinary Werewolf remains the shared engine path for local single-player and public rooms. Room flow gets a bounded host-advance helper and better smoke diagnostics; class-trial gets explicit theme flow/director models that UI and AI code consume through small routing changes.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Node smoke scripts, existing `src/game`, `src/server`, `src/ai`, and `src/components/game` modules.

---

## File Structure

- Create `src/server/roomAdvance.ts`: pure bounded room-advance helper for host-controlled AI/system steps plus trace output.
- Create `src/server/roomAdvance.test.ts`: focused tests for advance stop conditions and trace behavior.
- Modify `src/server/roomService.ts`: route host `continue` through `advanceRoomToNextStop`, preserve command/idempotency behavior, and keep ordinary rules intact.
- Modify `src/app/api/rooms/api.test.ts`: add an API-level regression proving host continue can cross ordinary AI/system night flow to the next human/public stop.
- Modify `scripts/room-action-smoke.mjs`: add CLI `--base-url`, per-request timeout, compact phase trace, and clearer failure output.
- Create `src/components/game/classTrialThemeFlow.ts`: pure class-trial phase visibility and trial-step model.
- Create `src/components/game/classTrialThemeFlow.test.ts`: focused tests for hidden night phases, trial labels, vote reveal, and review steps.
- Modify `src/components/game/classTrialFlowModel.ts`: consume `classTrialThemeFlow` instead of duplicating phase-gating decisions.
- Modify `src/components/game/classTrialTableModel.ts`: expose a theme trial step label for the table.
- Modify `src/components/game/ClassTrialGameTable.tsx`: display the trial step label and avoid ordinary night labels as the main theme status.
- Create `src/ai/classTrialPersonaDirector.ts`: class-trial role-first speech guidance that allows low-information character beats.
- Create `src/ai/classTrialPersonaDirector.test.ts`: tests for role texture, low-information permission, and privacy guards.
- Modify `src/ai/classTrialSpeechDirector.ts`: route class-trial speech through the new persona director.
- Modify `src/ai/speechProviders.test.ts`: add integration-style checks that the prompt/director no longer forces every low-information class-trial speaker into a hard pressure task.
- Create `docs/tasks/2026-06-room-vote-class-trial-rules.md`: task card and final acceptance evidence.
- Modify `feature_list.json`, `progress.md`, and `session-handoff.md`: record completion and verification evidence after implementation.

---

### Task 1: Room Advance Model

**Files:**
- Create: `src/server/roomAdvance.ts`
- Create: `src/server/roomAdvance.test.ts`
- Modify: `src/server/roomService.ts`

- [ ] **Step 1: Write failing tests for bounded host advance**

Create `src/server/roomAdvance.test.ts` with these tests:

```ts
import { describe, expect, it } from "vitest";
import { createGame } from "@/game/engine";
import { advanceRoomToNextStop, type RoomAdvanceStopReason } from "./roomAdvance";

describe("advanceRoomToNextStop", () => {
  it("advances ordinary AI and system night flow until the next human or public stop", async () => {
    const initial = createGame({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: 1,
      seed: "room-advance-night",
    });

    const result = await advanceRoomToNextStop(initial, {
      maxSteps: 32,
      forceMockAi: true,
    });

    expect(result.state.phase).not.toBe("NIGHT_SEER");
    expect(["DAY_ANNOUNCEMENT", "DAY_SPEECH", "GAME_OVER"]).toContain(result.state.phase);
    expect(result.trace.length).toBeGreaterThan(1);
    expect(result.trace.map((entry) => entry.phase)).toContain("NIGHT_WOLVES");
    expect(result.stopReason satisfies RoomAdvanceStopReason).toBeTruthy();
  });

  it("stops immediately when a human action is pending", async () => {
    const initial = createGame({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: 1,
      seed: "room-advance-human-wolf",
    });

    const result = await advanceRoomToNextStop(initial, {
      maxSteps: 32,
      forceMockAi: true,
    });

    if (result.trace[0]?.requirementType === "human") {
      expect(result.state).toBe(initial);
      expect(result.stopReason).toBe("human-action");
    }
  });

  it("reports step-limit traces instead of looping forever", async () => {
    const initial = createGame({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: 1,
      seed: "room-advance-limit",
    });

    const result = await advanceRoomToNextStop(initial, {
      maxSteps: 0,
      forceMockAi: true,
    });

    expect(result.stopReason).toBe("step-limit");
    expect(result.trace).toHaveLength(1);
    expect(result.state).toBe(initial);
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run:

```powershell
npm run test -- src/server/roomAdvance.test.ts
```

Expected: FAIL because `src/server/roomAdvance.ts` does not exist.

- [ ] **Step 3: Implement the room advance helper**

Create `src/server/roomAdvance.ts`:

```ts
import { advanceOneAiStep, createConfiguredAiOptions } from "@/ai/mockAgent";
import { getTurnRequirement } from "@/game/engine";
import { isPublicActorPhase } from "@/game/phaseSemantics";
import type { GameState, Phase, TurnRequirement } from "@/game/types";

export type RoomAdvanceStopReason =
  | "human-action"
  | "public-observation"
  | "finished"
  | "none"
  | "step-limit";

export type RoomAdvanceTraceEntry = {
  step: number;
  phase: Phase;
  day: number;
  requirementType: TurnRequirement["type"];
  actorSeatId?: number;
};

export type RoomAdvanceResult = {
  state: GameState;
  stopReason: RoomAdvanceStopReason;
  trace: RoomAdvanceTraceEntry[];
};

export async function advanceRoomToNextStop(
  initialState: GameState,
  options: {
    maxSteps?: number;
    forceMockAi?: boolean;
  } = {},
): Promise<RoomAdvanceResult> {
  let state = initialState;
  const trace: RoomAdvanceTraceEntry[] = [];
  const maxSteps = options.maxSteps ?? 48;
  const aiOptions = createConfiguredAiOptions({ forceMock: options.forceMockAi === true });

  for (let step = 0; step <= maxSteps; step += 1) {
    const requirement = getTurnRequirement(state);
    trace.push({
      step,
      phase: state.phase,
      day: state.day,
      requirementType: requirement.type,
      actorSeatId: "actorSeatId" in requirement ? requirement.actorSeatId : undefined,
    });

    if (state.result || state.phase === "GAME_OVER") {
      return { state, stopReason: "finished", trace };
    }

    if (requirement.type === "human") {
      return { state, stopReason: "human-action", trace };
    }

    if (requirement.type === "none") {
      return { state, stopReason: "none", trace };
    }

    if (step >= maxSteps) {
      return { state, stopReason: "step-limit", trace };
    }

    const advanced = await advanceOneAiStep(state, aiOptions);
    state = advanced.state;

    const nextRequirement = getTurnRequirement(state);
    if (
      nextRequirement.type !== "ai" &&
      isPublicActorPhase(state.phase) &&
      trace.length > 0 &&
      trace[trace.length - 1]?.phase !== state.phase
    ) {
      return { state, stopReason: "public-observation", trace };
    }
  }

  return { state, stopReason: "step-limit", trace };
}
```

- [ ] **Step 4: Run room advance tests until green**

Run:

```powershell
npm run test -- src/server/roomAdvance.test.ts
```

Expected: PASS for `src/server/roomAdvance.test.ts`.

- [ ] **Step 5: Wire host continue through the helper**

In `src/server/roomService.ts`, add the import:

```ts
import { advanceRoomToNextStop } from "@/server/roomAdvance";
```

In `continueRoom`, replace the current one-step branch:

```ts
  const advanced =
    state.phase === "DAY_VOTE"
      ? await advancePendingAiVotes(state, createConfiguredAiOptions())
      : await advanceOneAiStep(state, createConfiguredAiOptions());
  room.gameState = state.phase === "DAY_VOTE" ? revealCompletedVote(advanced.state) : advanced.state;
```

with:

```ts
  if (state.phase === "DAY_VOTE") {
    const advanced = await advancePendingAiVotes(state, createConfiguredAiOptions());
    room.gameState = revealCompletedVote(advanced.state);
  } else {
    const advanced = await advanceRoomToNextStop(state, {
      maxSteps: 48,
      forceMockAi: process.env.AI_ACTION_PROVIDER === "mock" && process.env.AI_SPEECH_PROVIDER === "mock",
    });
    room.gameState = advanced.state;
  }
```

Keep the rest of `continueRoom` unchanged so idempotency, `touchRoom`, and analytics still run through the existing path.

- [ ] **Step 6: Run focused server tests**

Run:

```powershell
npm run test -- src/server/roomAdvance.test.ts src/app/api/rooms/api.test.ts
```

Expected: PASS for room advance and existing room API tests.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add src/server/roomAdvance.ts src/server/roomAdvance.test.ts src/server/roomService.ts src/app/api/rooms/api.test.ts
git commit -m "Improve room host advance flow"
```

Expected: commit succeeds.

---

### Task 2: Room Vote Smoke Diagnostics

**Files:**
- Modify: `scripts/room-action-smoke.mjs`
- Modify: `src/app/api/rooms/api.test.ts`

- [ ] **Step 1: Write a room API vote regression**

Add this test inside `describe("room api routes", () => { ... })` in `src/app/api/rooms/api.test.ts`:

```ts
  it("reaches speech and resolves a vote through host room continue", async () => {
    const { roomId, hostPlayerId, guestPlayerId } = await createStartedTwoPlayerRoom();
    const covered = new Set<string>();
    let finalPhase: string | undefined;

    for (let step = 0; step < 80; step += 1) {
      const current = await findNextHumanAction(roomId, hostPlayerId, guestPlayerId);
      const response = await submitRoomCommand(
        new Request(`http://localhost/api/rooms/${roomId}/commands`, {
          method: "POST",
          body: JSON.stringify({ playerId: current.playerId, ...commandFromAction(current.action) }),
        }),
        { params: Promise.resolve({ roomId }) },
      );
      expect(response.status).toBe(200);
      const view = (await response.json()) as RoomView;
      covered.add(current.action.type);
      finalPhase = view.game?.phase;
      if (covered.has("speak") && covered.has("vote") && finalPhase !== "DAY_VOTE") {
        expect(view.game?.tableSummary.voteSnapshot.revealed).toBe(true);
        return;
      }
    }

    throw new Error(`Room did not resolve vote. Covered=${[...covered].join(",")} finalPhase=${finalPhase}`);
  });
```

- [ ] **Step 2: Run the room API vote regression**

Run:

```powershell
npm run test -- src/app/api/rooms/api.test.ts -t "reaches speech and resolves a vote"
```

Expected before Task 1 wiring: FAIL or timeout-like long loop. Expected after Task 1 wiring: PASS.

- [ ] **Step 3: Add `--base-url` and timeout parsing to the smoke script**

In `scripts/room-action-smoke.mjs`, replace the first line:

```js
const baseUrl = (process.env.ROOM_SMOKE_BASE_URL ?? "http://127.0.0.1:3003").replace(/\/$/, "");
```

with:

```js
const baseUrl = readOption("base-url", process.env.ROOM_SMOKE_BASE_URL ?? "http://127.0.0.1:3003").replace(/\/$/, "");
const requestTimeoutMs = Number(readOption("request-timeout-ms", process.env.ROOM_ACTION_SMOKE_REQUEST_TIMEOUT_MS ?? "12000"));
```

- [ ] **Step 4: Add request timing and trace helpers**

Add these helpers above `postJson`:

```js
async function withTimedRequest(label, request) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const result = await request(controller.signal);
    return result;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    throw new Error(`${label} failed after ${elapsedMs}ms at ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeRecentSteps(steps) {
  return steps
    .slice(-12)
    .map((step) => `${step.step}:${step.phase ?? "unknown"}->${step.nextPhase ?? step.turnType ?? step.waitingFor ?? "pending"}`)
    .join(" | ");
}
```

- [ ] **Step 5: Use timed fetches in `postJsonResponse` and `getJson`**

Replace `postJsonResponse` with:

```js
async function postJsonResponse(path, body) {
  return withTimedRequest(`POST ${path}`, async (signal) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await response.json().catch(() => null);
    return { data, ok: response.ok, status: response.status };
  });
}
```

Replace `getJson` with:

```js
async function getJson(path) {
  return withTimedRequest(`GET ${path}`, async (signal) => {
    const response = await fetch(`${baseUrl}${path}`, { signal });
    const data = await response.json().catch(() => null);
    assert(response.ok, `${path} failed: ${response.status} ${JSON.stringify(data)}`);
    return data;
  });
}
```

- [ ] **Step 6: Include recent trace in the final smoke error**

Replace the final `throw new Error(...)` in `runRoomActionSmoke` with:

```js
  throw new Error(
    `Could not complete ${coverage} coverage within ${maxSteps} steps at ${baseUrl}. ` +
      `Human actions: ${JSON.stringify(humanActions)} ` +
      `Recent steps: ${summarizeRecentSteps(steps)} ` +
      `All steps: ${JSON.stringify(steps)}`,
  );
```

- [ ] **Step 7: Run smoke script syntax check**

Run:

```powershell
node scripts/room-action-smoke.mjs --coverage=first --base-url=http://127.0.0.1:9 --request-timeout-ms=10
```

Expected: FAIL quickly with a timed request message that includes `http://127.0.0.1:9`. This validates CLI parsing and diagnostics without needing a dev server.

- [ ] **Step 8: Commit Task 2**

Run:

```powershell
git add scripts/room-action-smoke.mjs src/app/api/rooms/api.test.ts
git commit -m "Harden room vote smoke diagnostics"
```

Expected: commit succeeds.

---

### Task 3: Class-Trial Theme Flow Model

**Files:**
- Create: `src/components/game/classTrialThemeFlow.ts`
- Create: `src/components/game/classTrialThemeFlow.test.ts`
- Modify: `src/components/game/classTrialFlowModel.ts`
- Modify: `src/components/game/classTrialTableModel.ts`
- Modify: `src/components/game/ClassTrialGameTable.tsx`

- [ ] **Step 1: Write tests for the theme flow model**

Create `src/components/game/classTrialThemeFlow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getClassTrialThemeFlow, shouldMinimizeClassTrialPhase } from "./classTrialThemeFlow";

describe("classTrialThemeFlow", () => {
  it("minimizes ordinary night action labels for class-trial mode", () => {
    expect(shouldMinimizeClassTrialPhase("NIGHT_WOLVES")).toBe(true);
    expect(shouldMinimizeClassTrialPhase("NIGHT_SEER")).toBe(true);
    expect(shouldMinimizeClassTrialPhase("NIGHT_WITCH")).toBe(true);
    expect(shouldMinimizeClassTrialPhase("DAY_SPEECH")).toBe(false);
  });

  it("maps day speech to testimony instead of ordinary Werewolf speech", () => {
    const flow = getClassTrialThemeFlow({ phase: "DAY_SPEECH", day: 1, result: undefined });

    expect(flow.step).toBe("testimony");
    expect(flow.label).toBe("证言审理");
    expect(flow.showAsTrialSurface).toBe(true);
  });

  it("maps sealed and reveal vote states to trial steps", () => {
    expect(getClassTrialThemeFlow({ phase: "DAY_VOTE", day: 1, result: undefined }).step).toBe("sealed-vote");
    expect(getClassTrialThemeFlow({ phase: "EXILE_RESOLUTION", day: 1, result: undefined }).step).toBe("vote-reveal");
  });

  it("maps game over to verdict review", () => {
    const flow = getClassTrialThemeFlow({
      phase: "GAME_OVER",
      day: 2,
      result: { winner: "GOOD", reason: "所有狼人出局" },
    });

    expect(flow.step).toBe("review");
    expect(flow.label).toBe("审判复盘");
  });
});
```

- [ ] **Step 2: Run the model tests and confirm they fail**

Run:

```powershell
npm run test -- src/components/game/classTrialThemeFlow.test.ts
```

Expected: FAIL because `classTrialThemeFlow.ts` does not exist.

- [ ] **Step 3: Implement the theme flow model**

Create `src/components/game/classTrialThemeFlow.ts`:

```ts
import type { GameResult, Phase } from "@/game/types";

export type ClassTrialThemeStep =
  | "opening"
  | "hidden-night"
  | "court"
  | "testimony"
  | "sealed-vote"
  | "vote-reveal"
  | "verdict"
  | "review";

export type ClassTrialThemeFlow = {
  step: ClassTrialThemeStep;
  label: string;
  detail: string;
  showAsTrialSurface: boolean;
  minimizeOrdinaryPhase: boolean;
};

export function shouldMinimizeClassTrialPhase(phase: Phase): boolean {
  return phase === "NIGHT_WOLVES" || phase === "NIGHT_WOLF_BEAUTY" || phase === "NIGHT_GUARD" || phase === "NIGHT_SEER" || phase === "NIGHT_WITCH";
}

export function getClassTrialThemeFlow(input: {
  phase: Phase;
  day: number;
  result?: GameResult;
}): ClassTrialThemeFlow {
  if (input.result || input.phase === "GAME_OVER") {
    return {
      step: "review",
      label: "审判复盘",
      detail: "本轮审判已经结束，公开复盘身份、票型和关键转折。",
      showAsTrialSurface: true,
      minimizeOrdinaryPhase: false,
    };
  }

  if (shouldMinimizeClassTrialPhase(input.phase)) {
    return {
      step: "hidden-night",
      label: "闭庭整理",
      detail: "幕后线索正在整理，裁判台等待下一轮公开证言。",
      showAsTrialSurface: false,
      minimizeOrdinaryPhase: true,
    };
  }

  switch (input.phase) {
    case "DAY_ANNOUNCEMENT":
      return {
        step: "court",
        label: `第${input.day}日 开庭`,
        detail: "公开结果进入裁判场，所有人准备开始证言。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "DAY_SPEECH":
      return {
        step: "testimony",
        label: "证言审理",
        detail: "依次发言，允许角色反应、保留不确定或指出公开矛盾。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "DAY_VOTE":
      return {
        step: "sealed-vote",
        label: "封票",
        detail: "票意锁定中，目标在开票前保持隐藏。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "EXILE_RESOLUTION":
      return {
        step: "vote-reveal",
        label: "开票揭示",
        detail: "公开票箱，确认处刑或无人处刑。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    case "LAST_WORDS":
    case "HUNTER_REVEAL":
    case "HUNTER_SHOT":
    case "WOLF_KING_SHOT":
    case "SHERIFF_HANDOFF":
      return {
        step: "verdict",
        label: "判决余波",
        detail: "处刑后的遗言、枪牌或警徽流转继续公开结算。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
    default:
      return {
        step: "opening",
        label: "学级裁判",
        detail: "裁判场正在切换到下一段公开流程。",
        showAsTrialSurface: true,
        minimizeOrdinaryPhase: false,
      };
  }
}
```

- [ ] **Step 4: Run the theme flow tests**

Run:

```powershell
npm run test -- src/components/game/classTrialThemeFlow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire flow model and table model**

In `src/components/game/classTrialFlowModel.ts`, import and use the theme flow:

```ts
import { getClassTrialThemeFlow } from "./classTrialThemeFlow";
```

Inside `getClassTrialFlowModel`, after `const game = options.game;`, derive:

```ts
  const themeFlow = game && options.classTrialThemeActive
    ? getClassTrialThemeFlow({ phase: game.phase, day: game.day })
    : undefined;
```

Keep existing return fields, and adjust `allowThemedPhaseCurtain` to avoid hidden-night ordinary labels:

```ts
    allowThemedPhaseCurtain:
      !themeFlow?.minimizeOrdinaryPhase &&
      shouldRenderThemedPhaseCurtain(game, {
        classTrialIntroPending: introPending,
        roleIntroGameId: options.roleIntroGameId,
      }),
```

In `src/components/game/classTrialTableModel.ts`, add:

```ts
import { getClassTrialThemeFlow, type ClassTrialThemeFlow } from "./classTrialThemeFlow";
```

Add `themeFlow: ClassTrialThemeFlow;` to `ClassTrialTableModel`.

Inside `buildClassTrialTableModel`, derive:

```ts
  const themeFlow = getClassTrialThemeFlow({
    phase: game.phase,
    day: game.day,
    result: game.result,
  });
```

Add `themeFlow` to the returned object.

- [ ] **Step 6: Render the trial step in `ClassTrialGameTable.tsx`**

In `src/components/game/ClassTrialGameTable.tsx`, find the table status area that uses `model.centerStatus` or phase text. Add a small label next to the current status:

```tsx
<span className="class-trial-step-label">{model.themeFlow.label}</span>
```

If the existing markup has a status line, keep it in the same container so the label does not create a new layout region.

Add CSS in `src/app/globals.css` only if no existing class can style it:

```css
.class-trial-step-label {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(243, 197, 107, 0.42);
  background: rgba(20, 10, 12, 0.72);
  color: #f5d189;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
```

- [ ] **Step 7: Run focused class-trial UI/model tests**

Run:

```powershell
npm run test -- src/components/game/classTrialThemeFlow.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts
```

Expected: PASS. Update snapshots/assertions only when the visible trial step label is intentional.

- [ ] **Step 8: Commit Task 3**

Run:

```powershell
git add src/components/game/classTrialThemeFlow.ts src/components/game/classTrialThemeFlow.test.ts src/components/game/classTrialFlowModel.ts src/components/game/classTrialTableModel.ts src/components/game/ClassTrialGameTable.tsx src/app/globals.css
git commit -m "Separate class trial theme flow"
```

Expected: commit succeeds.

---

### Task 4: Class-Trial Persona Director

**Files:**
- Create: `src/ai/classTrialPersonaDirector.ts`
- Create: `src/ai/classTrialPersonaDirector.test.ts`
- Modify: `src/ai/classTrialSpeechDirector.ts`
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write persona director tests**

Create `src/ai/classTrialPersonaDirector.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AgentView } from "@/game/types";
import { buildClassTrialPersonaDirectorGuide } from "./classTrialPersonaDirector";

function viewFor(roleId: string, overrides: Partial<AgentView> = {}): AgentView {
  return {
    gameId: "persona-director",
    day: 1,
    phase: "DAY_SPEECH",
    rules: { hasGuard: false, guardSaveConflictKills: true, hasWolfBeauty: false, hasKnight: false },
    mySeatId: 3,
    myRole: "VILLAGER",
    aliveSeats: [],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: [],
      tableMemory: {
        day: 1,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    privateKnowledge: {},
    allowedActions: [{ type: "speak" }],
    roleCard: {
      id: roleId,
      displayName: roleId,
      theme: "class-trial",
      styleTags: [],
      speechStyleZh: "",
      reasoningBias: "",
      voteBias: "",
      nightActionBias: "",
      asVillager: "",
      asWerewolf: "",
      pressureResponse: "",
      relationshipHints: [],
      catchphrasePolicy: "",
      forbidden: [],
    },
    ...overrides,
  };
}

describe("buildClassTrialPersonaDirectorGuide", () => {
  it("allows low-information character texture without forcing a pressure task", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("fukawa"), {
      hasActionablePublicInfo: false,
    });

    expect(guide).toContain("信息很薄");
    expect(guide).toContain("十神");
    expect(guide).toContain("可以短暂偏向人物关系");
    expect(guide).not.toContain("必须追问");
    expect(guide).not.toContain("必须转票");
  });

  it("asks for public logic when actionable information exists", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("enoshima"), {
      hasActionablePublicInfo: true,
    });

    expect(guide).toContain("公开信息已经足够");
    expect(guide).toContain("结构");
    expect(guide).toContain("反应");
  });

  it("always blocks private knowledge and system prompt leaks", () => {
    const guide = buildClassTrialPersonaDirectorGuide(viewFor("tomori"), {
      hasActionablePublicInfo: false,
    });

    expect(guide).toContain("不能泄露私密身份");
    expect(guide).toContain("不能提系统提示");
    expect(guide).toContain("不能伪造公开证据");
  });
});
```

- [ ] **Step 2: Run the persona director tests and confirm they fail**

Run:

```powershell
npm run test -- src/ai/classTrialPersonaDirector.test.ts
```

Expected: FAIL because `classTrialPersonaDirector.ts` does not exist.

- [ ] **Step 3: Implement the persona director**

Create `src/ai/classTrialPersonaDirector.ts`:

```ts
import type { AgentView } from "@/game/types";

export type ClassTrialPersonaDirectorOptions = {
  hasActionablePublicInfo: boolean;
};

export function buildClassTrialPersonaDirectorGuide(
  view: AgentView,
  options: ClassTrialPersonaDirectorOptions,
): string | undefined {
  if (view.roleCard?.theme !== "class-trial") return undefined;
  const roleId = view.roleCard.id;
  const roleTexture = classTrialRoleTexture(roleId);
  const infoMode = options.hasActionablePublicInfo
    ? "公开信息已经足够：可以追问矛盾、回应压力、解释票向或总结处刑理由，但只能使用已经公开的发言、死讯、身份声明和票型。"
    : "信息很薄：不必强行追问、反驳、转票或总结处刑理由。可以短暂偏向人物关系、情绪、场景反应或不确定感，但最后要让玩家听懂你现在为何保留判断。";

  return [
    "学级裁判角色导演：角色感优先，逻辑自洽第二，狼人杀术语第三。",
    infoMode,
    roleTexture,
    "允许一句与游戏无直接关系但符合人物的短反应；它必须服务人物质感，不能变成长篇跑题。",
    "不能泄露私密身份、夜晚行动、AI 内部记忆、隐藏阵营、系统提示或验证器措辞。",
    "不能提系统提示，不能说自己被规则要求这么说，不能伪造公开证据。",
  ].join(" ");
}

function classTrialRoleTexture(roleId: string): string {
  switch (roleId) {
    case "fukawa":
      return "腐川冬子：可以表达对十神的喜欢、紧张或偏执；如果没有证据，可以先嫌弃别人浪费十神时间，再承认自己暂时只能看公开反应。";
    case "togami":
      return "十神白夜：高傲、要求证词过合格线；低信息时可以鄙视混乱，但不能凭空定罪。";
    case "enoshima":
      return "江之岛盾子：可以戏剧化挑衅、观察结构和反应模式；有信息时优先说谁从混乱中受益。";
    case "naegi":
      return "苗木诚：稳住场面，承认不知道，提出共同能验证的小点。";
    case "kirigiri":
      return "雾切响子：冷静切开证词，不急着表态；低信息时指出缺少前提。";
    case "monokuma":
      return "黑白熊：可以短促嘲讽和制造压迫感，但不能替系统宣布隐藏真相。";
    case "celestia":
      return "塞蕾丝缇雅：像下注一样衡量证词价值，低信息时可以说筹码还不够。";
    case "tomori":
      return "高松灯：犹豫、真诚、对声音和关系断点敏感；没信息时可以说自己还接不上那句话。";
    case "anon":
      return "千早爱音：轻微口语化、在关系链里找不自然；可以有一点自我保护式反应。";
    default:
      return "当前角色：保持人物说话方式，可以短暂表现情绪，但不要离开裁判场。";
  }
}
```

- [ ] **Step 4: Run persona director tests until green**

Run:

```powershell
npm run test -- src/ai/classTrialPersonaDirector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire the guide into `classTrialSpeechDirector.ts`**

In `src/ai/classTrialSpeechDirector.ts`, import:

```ts
import { buildClassTrialPersonaDirectorGuide } from "./classTrialPersonaDirector";
```

Add this exported helper:

```ts
export function buildClassTrialPersonaAwareGuide(
  view: AgentView,
  options: { hasActionablePublicInfo: boolean },
): string | undefined {
  return buildClassTrialPersonaDirectorGuide(view, options);
}
```

Then route existing guide assembly through this helper wherever class-trial prompt sections are gathered. If `speechProviders.ts` currently collects the individual class-trial guide functions directly, add the persona guide to the same list.

- [ ] **Step 6: Add an integration test in `speechProviders.test.ts`**

Add a test near existing class-trial speech director tests:

```ts
it("allows low-information class-trial speech to use character texture without forced pressure", async () => {
  const state = createGame({ boardId: "9p-seer-witch-hunter", seed: 98, humanSeatId: null });
  state.day = 1;
  state.phase = "DAY_SPEECH";
  const fukawa = state.seats.find((seat) => seat.seatId === 3)!;
  fukawa.name = "腐川冬子";
  fukawa.roleCard = roleCardFixture("fukawa", "腐川冬子");
  state.speechQueue = [fukawa.seatId, 1, 2, 4, 5, 6, 7, 8, 9];
  state.speechIndex = 0;

  const view = buildAgentView(state, fukawa.seatId);
  const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
  const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

  expect(guideText).toContain("信息很薄");
  expect(guideText).toContain("十神");
  expect(guideText).toContain("不必强行追问");
  expect(guideText).toContain("不能泄露私密身份");
  expect(guideText).not.toContain("必须追问");
  expect(guideText).not.toContain("必须转票");
});
```

- [ ] **Step 7: Run focused AI tests**

Run:

```powershell
npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Run:

```powershell
git add src/ai/classTrialPersonaDirector.ts src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts
git commit -m "Add class trial persona director"
```

Expected: commit succeeds.

---

### Task 5: Task Card And Project State

**Files:**
- Create: `docs/tasks/2026-06-room-vote-class-trial-rules.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Create the task card**

Create `docs/tasks/2026-06-room-vote-class-trial-rules.md`:

```md
# Room Vote And Class Trial Rules

Short name: room-vote-class-trial-rules
Task type: Room / multiplayer flow + rules engine + AI speech + frontend UI + architecture
Status: in-progress

## Goal

Make ordinary public-room vote smoke complete reliably, then separate class-trial theme flow and role-first speech direction from ordinary Werewolf rules.

## Scope

- Ordinary Werewolf local and public-room rules remain shared.
- Public-room host continue can advance AI/system flow to the next meaningful stop.
- `smoke:room-action:vote` reaches speech, vote, and vote resolution under mock AI.
- Class-trial mode gets explicit theme flow labels and minimized ordinary night labels.
- Class-trial AI director allows low-information character texture without private leaks.

## Out Of Scope

- Tencent Cloud deployment.
- Render deployment.
- Editing `.env`, database files, generated audio caches, `.next`, `node_modules`, or private local assets.

## Verification

- `npm run test -- src/server/roomAdvance.test.ts src/app/api/rooms/api.test.ts`
- `npm run test -- src/components/game/classTrialThemeFlow.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts`
- `npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts`
- `ROOM_SMOKE_BASE_URL=http://127.0.0.1:<port> npm run smoke:room-action:vote`
- `ROOM_SMOKE_BASE_URL=http://127.0.0.1:<port> npm run smoke:room-sse`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Acceptance Notes

- Initial state: acceptance evidence is pending implementation.
- Required final evidence: focused room/API tests, class-trial flow/UI tests, class-trial AI director tests, `smoke:room-action:vote`, `smoke:room-sse`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
```

- [ ] **Step 2: Add feature registry entry**

In `feature_list.json`, add a new feature object after `class-trial-system-architecture`:

```json
{
  "id": "room-vote-class-trial-rules",
  "name": "Room Vote And Class Trial Rules",
  "description": "Stabilize ordinary public-room vote smoke and separate class-trial theme flow/persona speech direction from ordinary Werewolf rules.",
  "dependencies": [
    "class-trial-system-architecture"
  ],
  "status": "in-progress",
  "evidence": "docs/superpowers/specs/2026-06-02-room-vote-and-class-trial-rules-design.md; docs/superpowers/plans/2026-06-02-room-vote-and-class-trial-rules.md; docs/tasks/2026-06-room-vote-class-trial-rules.md"
}
```

Keep JSON valid. Preserve existing feature order.

- [ ] **Step 3: Update progress handoff state**

At the top of `progress.md`, set:

```md
**Last Updated:** 2026-06-02 Asia/Shanghai
**Session ID:** room-vote-class-trial-rules
**Active Feature:** room-vote-class-trial-rules - Room Vote And Class Trial Rules (in-progress)
```

Add bullets under "What's Done" as implementation completes. Do not delete prior evidence.

- [ ] **Step 4: Update `session-handoff.md` objective**

At the top of `session-handoff.md`, replace the current objective bullets with:

```md
- Goal: Stabilize ordinary public-room vote smoke, then separate class-trial theme flow and role-first speech direction from ordinary Werewolf rules.
- Current status: In progress.
- Local note: This work should push to GitHub only; no Tencent Cloud or Render deployment is in scope.
```

Keep older completed history below the current objective.

- [ ] **Step 5: Commit Task 5**

Run:

```powershell
git add docs/tasks/2026-06-room-vote-class-trial-rules.md feature_list.json progress.md session-handoff.md
git commit -m "Track room vote class trial rules task"
```

Expected: commit succeeds.

---

### Task 6: End-To-End Verification And GitHub Push

**Files:**
- Modify: `docs/tasks/2026-06-room-vote-class-trial-rules.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run focused test groups**

Run:

```powershell
npm run test -- src/server/roomAdvance.test.ts src/app/api/rooms/api.test.ts
npm run test -- src/components/game/classTrialThemeFlow.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts
npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/speechProviders.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run type, lint, and build**

Run:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all commands exit 0. Existing Turbopack NFT trace warning may remain during build; record it if present.

- [ ] **Step 3: Start a local app server**

If no local server is already running on a known port, run:

```powershell
npm run dev
```

Use the printed localhost port. If port 3000 is occupied, use the port selected by Next.js and substitute it into the smoke commands below.

- [ ] **Step 4: Run room vote and SSE smokes**

Run with the actual local URL:

```powershell
$env:ROOM_SMOKE_BASE_URL="http://127.0.0.1:3000"; npm run smoke:room-action:vote
$env:ROOM_SMOKE_BASE_URL="http://127.0.0.1:3000"; npm run smoke:room-sse
```

Expected:

- `smoke:room-action:vote` prints JSON with `ok: true`, `coverage: "vote"`, `coveredActionTypes` containing `speak` and `vote`, and `voteResolved: true`.
- `smoke:room-sse` exits 0.

- [ ] **Step 5: Run browser or HTTP class-trial visual verification**

If Browser/Playwright is available, open the local app, start a class-trial theme game, and confirm:

- The table shows a trial step label such as `证言审理`, `封票`, or `开票揭示`.
- Hidden ordinary night labels are not the main theme status.
- Vote remains sealed before reveal.
- AI low-information prompt path allows role texture.

If Browser/Playwright is unavailable, run component tests and an HTTP game creation smoke, then record the browser skip reason in the task card.

- [ ] **Step 6: Mark the task done in project files**

Update `docs/tasks/2026-06-room-vote-class-trial-rules.md`:

```md
Status: done
```

Fill `Acceptance Notes` with exact commands and outcomes.

Update the `room-vote-class-trial-rules` entry in `feature_list.json`:

```json
"status": "done",
"evidence": "docs/superpowers/specs/2026-06-02-room-vote-and-class-trial-rules-design.md; docs/superpowers/plans/2026-06-02-room-vote-and-class-trial-rules.md; docs/tasks/2026-06-room-vote-class-trial-rules.md; focused room/API, class-trial UI/model, and AI director tests passed; smoke:room-action:vote and smoke:room-sse passed locally; npx tsc --noEmit, npm run lint, and npm run build passed."
```

Update `progress.md` and `session-handoff.md` with final changed files, verification, skipped checks, and remaining risks.

- [ ] **Step 7: Commit final state updates**

Run:

```powershell
git add docs/tasks/2026-06-room-vote-class-trial-rules.md feature_list.json progress.md session-handoff.md
git commit -m "Record room vote class trial verification"
```

Expected: commit succeeds.

- [ ] **Step 8: Push to GitHub**

Run:

```powershell
git status -sb
git push
```

Expected: working tree is clean before push, then current branch pushes to `origin/codex/class-trial-ui-polish-tomori`.

---

## Self-Review

- Spec coverage: Tasks 1-2 cover room vote smoke and ordinary room stability; Task 3 covers class-trial theme flow/UI phase clarity; Task 4 covers role-first AI director with low-information character texture; Task 5 covers task/state docs; Task 6 covers verification and GitHub push.
- Placeholder scan: This plan avoids deferred-detail wording. Each code-touching step includes concrete code or exact edit text.
- Type consistency: New room helper uses `GameState`, `Phase`, and `TurnRequirement` from existing `src/game/types.ts`; new class-trial flow uses existing `Phase` and `GameResult`; new persona director uses existing `AgentView`.

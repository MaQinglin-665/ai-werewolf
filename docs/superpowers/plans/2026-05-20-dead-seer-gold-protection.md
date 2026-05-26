# Dead Seer Gold Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI speech and voting consistently protect night-dead seer gold-water targets unless hard public counter-evidence exists.

**Architecture:** Add a small shared `src/ai/protectedGold.ts` helper so vote planning, action candidate ordering, speech cleanup, and tests use the same dead-seer gold protection rules. Keep hidden truth out of the model inputs: this helper only reads public `TableMemory`, `AiTableRead`, and `SeatRead` data.

**Tech Stack:** TypeScript, Vitest, Next/Vite module aliases, existing `AgentView`/`AiTableRead`/`TableMemory` types, Node audit script.

---

## File Structure

- Create `src/ai/protectedGold.ts`: shared public-evidence helper for dead-seer gold protection and hard override checks.
- Create `src/ai/protectedGold.test.ts`: unit coverage for weak pressure, hard override evidence, and protected seat id extraction.
- Modify `src/ai/tableRead.ts`: replace local dead-seer gold protection helpers with the shared helper and make speech/vote target filtering stricter.
- Modify `src/ai/tableRead.test.ts`: add hard override and speech target regression coverage.
- Modify `src/ai/actionProviders.ts`: demote protected dead-seer gold vote candidates and give protective reason hints.
- Modify `src/ai/actionProviders.test.ts`: assert protected dead-seer gold is not the first ordinary vote candidate.
- Modify `src/ai/speechProviders.ts`: include dead-seer gold in mock speech protection and add an LLM speech constraint.
- Modify `src/ai/speechProviders.test.ts`: assert fallback speech does not pressure dead-seer gold.

## Task 1: Shared Dead-Seer Gold Helper

**Files:**
- Create: `src/ai/protectedGold.ts`
- Create: `src/ai/protectedGold.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/ai/protectedGold.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  deadSeerGoldSeatIds,
  hasHardOverrideAgainstDeadSeerGold,
  isProtectedDeadSeerGoldSeat,
} from "./protectedGold";
import type { ActionTarget, AiTableRead, SeatRead, TableMemory } from "@/game/types";

describe("dead seer gold protection", () => {
  it("protects a dead-seer gold target from weak single pressure", () => {
    const deadSeer = target(2, "Dead Seer");
    const gold = target(4, "Legacy Gold");
    const tableRead = readWithGold(deadSeer, gold, [
      seatRead(gold, {
        suspicion: 82,
        trust: 20,
        pressure: ["short speech"],
        publicStancedBy: [pressure(target(5, "Questioner"), gold, "QUESTION")],
      }),
      seatRead(target(6, "Outside Focus"), { suspicion: 58, trust: 42 }),
    ]);

    const goldRead = tableRead.seats.find((seat) => seat.seatId === gold.seatId)!;

    expect(hasHardOverrideAgainstDeadSeerGold(tableRead, goldRead)).toBe(false);
    expect(isProtectedDeadSeerGoldSeat(tableRead, goldRead)).toBe(true);
  });

  it("allows hard public override from repeated black-check pressure", () => {
    const deadSeer = target(2, "Dead Seer");
    const gold = target(4, "Legacy Gold");
    const checkerA = target(6, "Live Seer A");
    const checkerB = target(7, "Live Seer B");
    const tableRead = readWithGold(
      deadSeer,
      gold,
      [
        seatRead(gold, {
          suspicion: 92,
          trust: 18,
          publicChecksAgainst: [
            { claimant: checkerA, result: "WEREWOLF", day: 3 },
            { claimant: checkerB, result: "WEREWOLF", day: 3 },
          ],
          publicStancedBy: [
            pressure(checkerA, gold, "PRESSURE"),
            pressure(checkerB, gold, "QUESTION"),
          ],
        }),
      ],
      {
        reasoningCues: [
          {
            cueId: "gold-override",
            day: 3,
            kind: "counterclaim",
            weight: "strong",
            target: gold,
            summary: "multiple public checks challenge the gold",
            evidence: ["two public black checks"],
          },
        ],
      },
    );

    const goldRead = tableRead.seats.find((seat) => seat.seatId === gold.seatId)!;

    expect(hasHardOverrideAgainstDeadSeerGold(tableRead, goldRead)).toBe(true);
    expect(isProtectedDeadSeerGoldSeat(tableRead, goldRead)).toBe(false);
  });

  it("extracts dead-seer gold seat ids from public table memory", () => {
    const gold = target(4, "Legacy Gold");
    const tableMemory = memory({
      seerLegacies: [
        {
          claimant: target(2, "Dead Seer"),
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead seer left a public gold.",
        },
      ],
    });

    expect([...deadSeerGoldSeatIds(tableMemory)]).toEqual([gold.seatId]);
  });
});

function readWithGold(
  deadSeer: ActionTarget,
  gold: ActionTarget,
  seats: SeatRead[],
  overrides: Partial<TableMemory> = {},
): AiTableRead {
  return {
    mySeatId: 1,
    myRole: "VILLAGER",
    day: 3,
    seats: [
      seatRead(target(1, "Voter"), { isSelf: true, suspicion: 0, trust: 100 }),
      ...seats,
    ],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [],
    focus: seats[0],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory: memory({
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead seer left a public gold.",
        },
      ],
      ...overrides,
    }),
    tableMood: "test",
  };
}

function target(seatId: number, name: string): ActionTarget {
  return { seatId, name };
}

function seatRead(targetSeat: ActionTarget, overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    ...targetSeat,
    suspicion: 50,
    trust: 50,
    pressure: [],
    isSelf: false,
    isKnownWolf: false,
    isKnownGood: false,
    isWolfTeammate: false,
    speechCount: 1,
    votesReceived: 0,
    publicClaims: [],
    publicChecksAgainst: [],
    publicStancesGiven: [],
    publicStancedBy: [],
    ...overrides,
  };
}

function pressure(actor: ActionTarget, pressedTarget: ActionTarget, kind: "QUESTION" | "PRESSURE") {
  return {
    stanceId: `stance-${actor.seatId}-${pressedTarget.seatId}-${kind}`,
    day: 3,
    actor,
    target: pressedTarget,
    kind,
    kindLabel: kind,
    summary: `${actor.name} presses ${pressedTarget.name}`,
  };
}

function memory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 3,
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
    ...overrides,
  };
}
```

- [ ] **Step 2: Run the helper tests red**

Run:

```powershell
npm run test -- src/ai/protectedGold.test.ts
```

Expected: FAIL because `src/ai/protectedGold.ts` does not exist.

- [ ] **Step 3: Add the shared helper**

Create `src/ai/protectedGold.ts`:

```ts
import type { AiTableRead, SeatRead, TableMemory } from "@/game/types";

export function deadSeerGoldSeatIds(tableMemory: TableMemory): Set<number> {
  const seatIds = new Set<number>();
  for (const legacy of tableMemory.seerLegacies) {
    for (const check of legacy.checks) {
      if (check.result === "GOOD") seatIds.add(check.target.seatId);
    }
  }
  return seatIds;
}

export function findDeadSeerGoldLegacyForSeat(
  tableMemory: TableMemory,
  targetSeatId: number,
): TableMemory["seerLegacies"][number] | undefined {
  return tableMemory.seerLegacies.find((legacy) =>
    legacy.checks.some((check) => check.target.seatId === targetSeatId && check.result === "GOOD"),
  );
}

export function findDeadSeerBlackLegacyForSeat(
  tableMemory: TableMemory,
  targetSeatId: number,
): TableMemory["seerLegacies"][number] | undefined {
  return tableMemory.seerLegacies.find((legacy) =>
    legacy.checks.some((check) => check.target.seatId === targetSeatId && check.result === "WEREWOLF"),
  );
}

export function isProtectedDeadSeerGoldSeat(tableRead: AiTableRead, target: SeatRead): boolean {
  if (!findDeadSeerGoldLegacyForSeat(tableRead.tableMemory, target.seatId)) return false;
  return !hasHardOverrideAgainstDeadSeerGold(tableRead, target);
}

export function hasHardOverrideAgainstDeadSeerGold(tableRead: AiTableRead, target: SeatRead): boolean {
  if (findDeadSeerBlackLegacyForSeat(tableRead.tableMemory, target.seatId)) return true;

  const blackChecks = target.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;
  const pressureActors = new Set(
    target.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  ).size;
  const pressureGap = target.suspicion - target.trust;
  const inCounterclaim = tableRead.tableMemory.counterclaims.some(
    (group) => group.claimedRole === "SEER" && group.claimants.some((claimant) => claimant.seatId === target.seatId),
  );
  const hardCue = tableRead.tableMemory.reasoningCues.some(
    (cue) =>
      cue.target?.seatId === target.seatId &&
      cue.weight === "strong" &&
      (cue.kind === "counterclaim" || cue.kind === "seer_legacy" || cue.kind === "vote"),
  );
  const voteFocus =
    tableRead.voteSnapshot.leaders.some((leader) => leader.seatId === target.seatId) ||
    tableRead.tableMemory.voteHistory.at(-1)?.tally.some((item) => item.target.seatId === target.seatId && item.count >= 2) ||
    target.votesReceived >= 2;

  if (blackChecks >= 2 && pressureActors >= 2 && pressureGap >= 30) return true;
  if (blackChecks >= 1 && inCounterclaim && pressureActors >= 2 && (hardCue || pressureGap >= 42)) return true;
  if (hardCue && voteFocus && pressureActors >= 2) return true;

  return false;
}
```

- [ ] **Step 4: Run helper tests green**

Run:

```powershell
npm run test -- src/ai/protectedGold.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

Run:

```powershell
git add src/ai/protectedGold.ts src/ai/protectedGold.test.ts
git commit -m "feat: add dead seer gold protection helper"
```

Expected: commit succeeds.

## Task 2: Apply Helper To Vote And Speech Planning

**Files:**
- Modify: `src/ai/tableRead.ts`
- Modify: `src/ai/tableRead.test.ts`

- [ ] **Step 1: Add red vote/speech regression tests**

In `src/ai/tableRead.test.ts`, add tests under the existing `createVotePlan` and `createSpeechPlan` sections:

```ts
  it("allows a dead-seer gold-water target only after hard public override evidence", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Legacy Gold");
    const checkerA = target(5, "Live Seer A");
    const checkerB = target(6, "Live Seer B");
    const tableMemory = createTableMemory({
      day: 3,
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead Seer died with a gold-water check.",
        },
      ],
      reasoningCues: [
        {
          cueId: "override-gold",
          day: 3,
          kind: "counterclaim",
          weight: "strong",
          target: gold,
          summary: "two public checks challenge the dead-seer gold",
          evidence: ["two black checks and repeated pressure"],
        },
      ],
      counterclaims: [
        {
          claimedRole: "SEER",
          claimedRoleLabel: "预言家",
          claimants: [deadSeer, checkerA],
        },
      ],
    });
    const tableRead = createTableRead([
      createSeat({
        ...gold,
        suspicion: 94,
        trust: 12,
        publicChecksAgainst: [
          { claimant: checkerA, result: "WEREWOLF", day: 3 },
          { claimant: checkerB, result: "WEREWOLF", day: 3 },
        ],
        publicStancedBy: [
          publicPressure(checkerA, gold),
          publicPressure(checkerB, gold),
        ],
      }),
      createSeat({ seatId: 3, name: "Outside Focus", suspicion: 48, trust: 45 }),
    ], tableMemory);

    const plan = createVotePlan(createView(tableMemory), tableRead);

    expect(plan.target.seatId).toBe(gold.seatId);
    expect(plan.reason).toMatch(/查杀|对跳|公开|遗留|证据/);
  });

  it("does not choose dead-seer gold-water as a speech pressure target when another focus exists", () => {
    const deadSeer = target(4, "Dead Seer");
    const gold = target(2, "Legacy Gold");
    const outside = target(3, "Outside Focus");
    const tableMemory = createTableMemory({
      day: 3,
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead Seer died with a gold-water check.",
        },
      ],
      focus: [
        { seat: gold, reasons: ["public focus"], score: 95 },
        { seat: outside, reasons: ["outside focus"], score: 72 },
      ],
    });
    const tableRead = createTableRead([
      createSeat({ ...gold, suspicion: 82, trust: 20, pressure: ["short speech"] }),
      createSeat({ ...outside, suspicion: 62, trust: 40, pressure: ["outside focus"] }),
    ], tableMemory);

    const plan = createSpeechPlan(createView(tableMemory), tableRead);

    expect(plan.target?.seatId).toBe(outside.seatId);
    expect(plan.stance).not.toContain(gold.name);
    expect(plan.talkingPoints.join("\n")).not.toContain(gold.name);
  });
```

If `publicPressure` does not exist in `src/ai/tableRead.test.ts`, add this helper near the existing test helpers:

```ts
function publicPressure(actor: ActionTarget, targetSeat: ActionTarget) {
  return {
    stanceId: `stance-${actor.seatId}-${targetSeat.seatId}`,
    day: 3,
    actor,
    target: targetSeat,
    kind: "PRESSURE" as const,
    kindLabel: "施压",
    summary: `${actor.name} pressures ${targetSeat.name}`,
  };
}
```

- [ ] **Step 2: Run table-read tests red**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts
```

Expected: FAIL if the hard override is still blocked or the speech plan still targets protected gold.

- [ ] **Step 3: Import the helper in `src/ai/tableRead.ts`**

Add:

```ts
import {
  findDeadSeerBlackLegacyForSeat,
  findDeadSeerGoldLegacyForSeat,
  hasHardOverrideAgainstDeadSeerGold,
  isProtectedDeadSeerGoldSeat,
} from "./protectedGold";
```

- [ ] **Step 4: Replace local dead-seer gold helper usage**

In `src/ai/tableRead.ts`, replace the body of `findDeadSeerLegacyBlackCheckAgainst`:

```ts
  return tableRead.tableMemory.seerLegacies.find((legacy) =>
    legacy.checks.some((check) => check.target.seatId === target.seatId && check.result === "WEREWOLF"),
  );
```

with:

```ts
  return findDeadSeerBlackLegacyForSeat(tableRead.tableMemory, target.seatId);
```

Replace the body of `findDeadSeerLegacyGoldCheckFor`:

```ts
  return tableRead.tableMemory.seerLegacies.find((legacy) =>
    legacy.checks.some((check) => check.target.seatId === target.seatId && check.result === "GOOD"),
  );
```

with:

```ts
  return findDeadSeerGoldLegacyForSeat(tableRead.tableMemory, target.seatId);
```

Replace `isProtectedDeadSeerLegacyGoldTarget` with:

```ts
function isProtectedDeadSeerLegacyGoldTarget(tableRead: AiTableRead, target: SeatRead): boolean {
  return isProtectedDeadSeerGoldSeat(tableRead, target);
}
```

Remove the old local `hasOverridingEvidenceAgainstDeadSeerGold` function from `src/ai/tableRead.ts`; the shared helper replaces it.

- [ ] **Step 5: Make good-side candidate filtering stricter**

Update `withoutProtectedGoodVoteTargets`:

```ts
function withoutProtectedGoodVoteTargets(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead[] {
  const filtered = candidates.filter((seat) => !isProtectedGoodVoteTarget(view, tableRead, seat));
  return filtered.length > 0 ? filtered : [];
}
```

This preserves the later no-safe-vote path instead of silently falling back to a protected gold target as a normal suspect.

- [ ] **Step 6: Ensure hard override can target protected gold with a public reason**

In `buildVoteReason`, add this block before `const trustedSeerCheck = findTrustedSeerCheckAgainst(tableRead, target);`:

```ts
  const deadSeerGold = findDeadSeerLegacyGoldCheckFor(tableRead, target);
  if (deadSeerGold && hasHardOverrideAgainstDeadSeerGold(tableRead, target)) {
    return `${target.name}原本是${deadSeerGold.claimant.name}夜死后留下的金水，但现在公开对跳和查杀压力形成硬反证，这轮先按公开矛盾验证。`;
  }
```

- [ ] **Step 7: Run table-read tests green**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit table-read changes**

Run:

```powershell
git add src/ai/tableRead.ts src/ai/tableRead.test.ts
git commit -m "feat: protect dead seer gold in table reads"
```

Expected: commit succeeds.

## Task 3: Demote Protected Gold In LLM Action Candidates

**Files:**
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Add red action candidate test**

In `src/ai/actionProviders.test.ts`, add a test under `describe("routed action provider", () => { ... })`:

```ts
  it("does not rank protected dead-seer gold as the first ordinary vote candidate", () => {
    const deadSeer = target(2, "Dead Seer");
    const gold = target(4, "Legacy Gold");
    const outside = target(5, "Outside Focus");
    const tableMemory = emptyTableMemory({
      day: 3,
      seerLegacies: [
        {
          claimant: deadSeer,
          deathDay: 2,
          checks: [{ day: 1, target: gold, result: "GOOD" }],
          stancesGiven: [],
          summary: "Dead Seer died with a gold-water check.",
        },
      ],
      focus: [{ seat: gold, reasons: ["public focus"], score: 95 }],
    });
    const view = voteActionView([gold, outside], tableMemory);
    const tableRead = actionTableRead(
      [
        seatRead(gold, { suspicion: 95, trust: 10, pressure: ["public focus"] }),
        seatRead(outside, { suspicion: 58, trust: 40, pressure: ["outside focus"] }),
      ],
      tableMemory,
    );
    const votePlan = createVotePlan(view, tableRead);

    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });
    const voteCandidates = input.candidates.filter((candidate) => candidate.command.type === "vote");

    expect(voteCandidates[0]?.target?.seatId).toBe(outside.seatId);
    expect(JSON.stringify(voteCandidates.find((candidate) => candidate.target?.seatId === gold.seatId))).toMatch(/gold|金水|protected|保护/i);
  });
```

Add this helper near the existing action test helpers if no vote helper exists:

```ts
function voteActionView(targets: ActionTarget[], tableMemory: TableMemory): AgentView {
  return {
    gameId: "vote-action-test",
    mySeatId: 1,
    myRole: "VILLAGER",
    phase: "DAY_VOTE",
    day: 3,
    rules: {
      hasGuard: false,
      guardSaveConflictKills: false,
      hasWolfBeauty: false,
      hasKnight: false,
      wolfRoles: ["WEREWOLF"],
    },
    persona: {
      id: "vote-action-test",
      name: "Vote Tester",
      label: "Vote Tester",
      modelLabel: "Vote Tester",
      style: "logic",
      goal: "test",
      riskTolerance: 0.4,
      bluffing: 0.3,
    },
    aliveSeats: [target(1, "Voter"), ...targets],
    publicEvents: [],
    publicSummary: {
      recentSpeeches: [],
      recentVotes: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      recentDeaths: [],
      deathSummary: [],
      claimBoard: tableMemory.claimBoard,
      tableMemory,
    },
    privateKnowledge: {},
    allowedActions: [{ type: "vote", targets, canAbstain: false }],
  } as AgentView;
}
```

- [ ] **Step 2: Run action provider tests red**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts
```

Expected: FAIL if protected gold still appears as the first ordinary vote candidate or has a normal suspicion hint.

- [ ] **Step 3: Import the helper in action providers**

In `src/ai/actionProviders.ts`, add:

```ts
import { isProtectedDeadSeerGoldSeat } from "./protectedGold";
```

- [ ] **Step 4: Demote protected vote targets in `orderVoteTargets`**

Replace:

```ts
  push(votePlan?.target);
  for (const alternative of votePlan?.alternatives ?? []) push(alternative);
  for (const target of sortTargets(legalTargets, tableRead, (seat) => seat.suspicion - seat.trust * 0.18)) push(target);
```

with:

```ts
  push(votePlan?.target);
  for (const alternative of votePlan?.alternatives ?? []) push(alternative);

  const protectedGoldSeatIds = new Set(
    tableRead.seats.filter((seat) => isProtectedDeadSeerGoldSeat(tableRead, seat)).map((seat) => seat.seatId),
  );
  const ordinaryTargets = legalTargets.filter((target) => !protectedGoldSeatIds.has(target.seatId));
  const protectedTargets = legalTargets.filter((target) => protectedGoldSeatIds.has(target.seatId));

  for (const target of sortTargets(ordinaryTargets, tableRead, (seat) => seat.suspicion - seat.trust * 0.18)) push(target);
  for (const target of sortTargets(protectedTargets, tableRead, (seat) => seat.suspicion - seat.trust * 0.18 - 120)) push(target);
```

- [ ] **Step 5: Give protected gold candidates a protective hint**

In the `DAY_VOTE` candidate creation, replace:

```ts
            : publicSafeTargetReasonHint(view, tableRead, target, "public suspicion"),
```

with:

```ts
            : protectedDeadSeerGoldReasonHint(tableRead, target) ?? publicSafeTargetReasonHint(view, tableRead, target, "public suspicion"),
```

Add this helper near `publicSafeTargetReasonHint`:

```ts
function protectedDeadSeerGoldReasonHint(tableRead: AiTableRead, target: ActionTarget): string | undefined {
  const seat = tableRead.seats.find((item) => item.seatId === target.seatId);
  if (!seat || !isProtectedDeadSeerGoldSeat(tableRead, seat)) return undefined;
  return "protected dead-seer gold-water; avoid voting unless a hard public contradiction appears";
}
```

- [ ] **Step 6: Run action provider tests green**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit action candidate changes**

Run:

```powershell
git add src/ai/actionProviders.ts src/ai/actionProviders.test.ts
git commit -m "feat: demote protected gold vote candidates"
```

Expected: commit succeeds.

## Task 4: Protect Dead-Seer Gold In Speech Generation

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Add red fallback speech test**

In `src/ai/speechProviders.test.ts`, add:

```ts
  it("does not pressure a dead-seer gold target in fallback mock speech", async () => {
    let state = createGame({ seed: 71, humanSeatId: null });
    const deadSeer = state.seats.find((seat) => seat.role === "SEER")!;
    const gold = state.seats.find((seat) => seat.role === "VILLAGER")!;
    const speaker = state.seats.find((seat) => seat.role === "VILLAGER" && seat.seatId !== gold.seatId)!;

    state.phase = "DAY_SPEECH";
    state.speechQueue = [deadSeer.seatId];
    state.speechIndex = 0;
    state = applyCommand(state, {
      type: "speak",
      actorSeatId: deadSeer.seatId,
      message: `我跳预言家，${gold.seatId}号是金水。`,
    });
    state = {
      ...state,
      seats: state.seats.map((seat) => (seat.seatId === deadSeer.seatId ? { ...seat, alive: false, deathReason: "WOLF_KILL" as const } : seat)),
      day: 2,
      phase: "DAY_SPEECH",
      speechQueue: [speaker.seatId],
      speechIndex: 0,
    };

    const view = buildAgentView(state, speaker.seatId);
    const result = await mockSpeechProvider.generateSpeech(view);

    expect(result.speech).not.toMatch(new RegExp(`${gold.seatId}号[^。！？；，、]{0,28}(讲实|票口|补清楚|放进观察|挂疑问|收票|压)`));
    expect(result.speech).toMatch(/金水|放一轮|保护|先不/);
  });
```

If `applyCommand`, `buildAgentView`, or `createGame` are not already imported in `src/ai/speechProviders.test.ts`, add the same imports used by nearby speech-provider tests.

- [ ] **Step 2: Run speech provider tests red**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts
```

Expected: FAIL if fallback speech still pressures dead-seer gold or never emits protective language.

- [ ] **Step 3: Import dead-seer gold ids**

In `src/ai/speechProviders.ts`, add:

```ts
import { deadSeerGoldSeatIds } from "./protectedGold";
```

- [ ] **Step 4: Include dead-seer gold in mock speech protection**

In `publicUnchallengedGoldSeatIds`, before `return seatIds;`, add:

```ts
  for (const seatId of deadSeerGoldSeatIds(view.publicSummary.tableMemory)) {
    seatIds.add(seatId);
  }
```

- [ ] **Step 5: Add LLM speech constraint for dead-seer gold**

In `buildSpeechConstraints`, inside the strict branch after the claim-intent constraints and before wolf-specific constraints, add:

```ts
    if (view.publicSummary.tableMemory.seerLegacies.some((legacy) => legacy.checks.some((check) => check.result === "GOOD"))) {
      strictConstraints.push(
        "夜死预言家留下的公开金水默认先保护：没有硬公开反证时，不要把该金水写成今日出人焦点、压票对象或怀疑焦点。",
      );
    }
```

- [ ] **Step 6: Run speech provider tests green**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit speech changes**

Run:

```powershell
git add src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "feat: protect dead seer gold in speeches"
```

Expected: commit succeeds.

## Task 5: Verification, Audit, And Push

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test -- src/ai/protectedGold.test.ts src/ai/tableRead.test.ts src/game/seerCheckStructureVoting.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run engine regression tests**

Run:

```powershell
npm run test -- src/game/engine.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript**

Run:

```powershell
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Run AI audit**

Run:

```powershell
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/dead-seer-gold-protection-audit.json
```

Expected:
- `failedGames` is 0.
- `fallbackCount` is 0.
- `dead_seer_gold_pressure` drops from the prior 42 baseline.
- `seer_gold_vote_target` drops from the prior 24 baseline.
- Any remaining sampled warnings are either hard counter-evidence, ambiguous protective language, or real gaps for a later pass.

- [ ] **Step 5: Run lint and full test suite**

Run:

```powershell
npm run lint
npm run test
```

Expected: PASS for both commands.

- [ ] **Step 6: Inspect git state**

Run:

```powershell
git status --short --untracked-files=all
git diff --stat
git diff --check
```

Expected:
- Only intended tracked files are changed.
- Existing unrelated untracked paths may remain under `.superpowers/`, `promo-ai-werewolf/`, and `tmp/`.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 7: Commit any remaining tracked changes**

If any verification-only fixes remain uncommitted, run:

```powershell
git add src/ai/protectedGold.ts src/ai/protectedGold.test.ts src/ai/tableRead.ts src/ai/tableRead.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "feat: improve dead seer gold protection"
```

Expected: commit succeeds if there are staged changes. If there are no staged changes, skip this step.

- [ ] **Step 8: Push the branch**

Run:

```powershell
git push
```

Expected: push succeeds to `origin/codex/render-main-game-env-fix`.

## Self-Review

- Spec coverage: shared helper, vote planning, action candidate ordering, speech protection, audit validation, and error handling all map to tasks above.
- Open-item scan: no unfilled implementation notes remain.
- Type consistency: `deadSeerGoldSeatIds`, `findDeadSeerGoldLegacyForSeat`, `findDeadSeerBlackLegacyForSeat`, `hasHardOverrideAgainstDeadSeerGold`, and `isProtectedDeadSeerGoldSeat` are defined in Task 1 and reused by later tasks.

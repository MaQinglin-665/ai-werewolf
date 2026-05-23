# Wolf Day Vote Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wolf daytime votes follow the wolf-team plan when it is public-safe, avoid weak teammate votes, and let the audit distinguish planned distancing from accidental wolf-on-wolf voting.

**Architecture:** Keep `createVotePlan(view, tableRead)` as the single vote-planning entry point. Add private `VotePlan.wolfVoteTactic` metadata, centralize wolf vote selection inside `src/ai/tableRead.ts`, and let `scripts/audit-ai-experience.mjs` skip warning-count inflation for planned distance or emergency cut votes while preserving warnings for unclassified teammate votes.

**Tech Stack:** TypeScript, Vitest, existing `AgentView`/`AiTableRead` models, Node audit script, npm validation commands.

---

## File Structure

- Modify `src/game/types.ts`: add `WolfVoteTactic` and optional `VotePlan.wolfVoteTactic`.
- Modify `src/ai/wolfVoting.test.ts`: add focused red tests for `PUSH_MISLYNCH`, `HIDE`, and `DISTANCE` wolf vote discipline.
- Modify `src/ai/tableRead.ts`: add wolf vote selection helpers, public evidence gating, and tactic assignment.
- Modify `src/ai/actionProviders.test.ts`: lock that good-side constrained action input does not leak wolf tactic metadata.
- Modify `scripts/audit-ai-experience.mjs`: classify planned wolf teammate votes separately from suspicious `wolf_team_vote` warnings and include tactic metadata in audit transcripts.

## Task 1: Add Wolf Vote Tactic Type And Red Tests

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/ai/wolfVoting.test.ts`

- [ ] **Step 1: Extend the `VotePlan` type**

In `src/game/types.ts`, replace the current `VotePlan` block:

```ts
export type VotePlan = {
  target: ActionTarget;
  abstain?: boolean;
  reason: string;
  confidence: number;
  alternatives: ActionTarget[];
};
```

with:

```ts
export type WolfVoteTactic = "team_target" | "planned_distance" | "emergency_cut" | "avoid_teammate";

export type VotePlan = {
  target: ActionTarget;
  abstain?: boolean;
  reason: string;
  confidence: number;
  alternatives: ActionTarget[];
  wolfVoteTactic?: WolfVoteTactic;
};
```

- [ ] **Step 2: Replace `src/ai/wolfVoting.test.ts` with focused red coverage**

Use this full file content:

```ts
import { describe, expect, it } from "vitest";
import { createVotePlan } from "./tableRead";
import type {
  ActionTarget,
  AgentView,
  AiTableRead,
  PublicStanceItem,
  SeatRead,
  TableMemory,
  WolfTeamAssignment,
} from "@/game/types";

describe("wolf voting discipline", () => {
  it("follows the assigned non-teammate day target for PUSH_MISLYNCH", () => {
    const wolf = { seatId: 1, name: "Wolf Voter" };
    const teammate = { seatId: 2, name: "Quiet Teammate" };
    const assigned = { seatId: 3, name: "Assigned Outsider" };
    const noisy = { seatId: 4, name: "Noisy Outsider" };
    const memory = tableMemory({
      focus: [
        { seat: noisy, reasons: ["public noise"], score: 90 },
        { seat: assigned, reasons: ["team target"], score: 55 },
      ],
    });

    const plan = createVotePlan(
      wolfVoteView({
        wolf,
        wolfTeammates: [teammate],
        targets: [teammate, assigned, noisy],
        tableMemory: memory,
        assignment: assignmentFor(wolf, "PUSH_MISLYNCH", assigned),
      }),
      tableRead(
        [
          seatRead({ ...teammate, isWolfTeammate: true, suspicion: 92, trust: 18 }),
          seatRead({ ...assigned, suspicion: 54, trust: 46, pressure: ["open table focus"] }),
          seatRead({ ...noisy, suspicion: 88, trust: 24, pressure: ["loud but not the wolf plan"] }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(assigned.seatId);
    expect(plan.wolfVoteTactic).toBe("team_target");
    expect(plan.reason).not.toMatch(/teammate|wolf team|WEREWOLF|private/i);
  });

  it("uses a non-teammate target for HIDE when teammate pressure is weak", () => {
    const wolf = { seatId: 1, name: "Wolf Voter" };
    const teammate = { seatId: 2, name: "Weak Pressure Teammate" };
    const outsider = { seatId: 3, name: "Open Focus" };
    const memory = tableMemory({
      focus: [{ seat: outsider, reasons: ["public focus"], score: 55 }],
    });

    const plan = createVotePlan(
      wolfVoteView({
        wolf,
        wolfTeammates: [teammate],
        targets: [teammate, outsider],
        tableMemory: memory,
        assignment: assignmentFor(wolf, "HIDE"),
      }),
      tableRead(
        [
          seatRead({
            ...teammate,
            isWolfTeammate: true,
            suspicion: 88,
            trust: 32,
            pressure: ["single weak question"],
            publicStancedBy: [stance({ actor: outsider, target: teammate, kind: "QUESTION" })],
          }),
          seatRead({
            ...outsider,
            suspicion: 58,
            trust: 45,
            pressure: ["public focus"],
          }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(outsider.seatId);
    expect(plan.wolfVoteTactic).toBe("avoid_teammate");
    expect(plan.reason).not.toMatch(/teammate|wolf team|WEREWOLF|private/i);
  });

  it("allows assigned DISTANCE teammate vote only under hard public pressure", () => {
    const wolf = { seatId: 1, name: "Wolf Voter" };
    const teammate = { seatId: 2, name: "Compromised Teammate" };
    const outsider = { seatId: 3, name: "Open Outsider" };
    const publicActorA = { seatId: 4, name: "Question A" };
    const publicActorB = { seatId: 5, name: "Question B" };
    const memory = tableMemory({
      counterclaims: [
        {
          claimedRole: "SEER",
          claimants: [teammate, publicActorA],
          summary: "public seer counterclaim",
        },
      ],
      reasoningCues: [
        {
          kind: "counterclaim",
          weight: "strong",
          target: teammate,
          summary: "counterclaim pressure",
          evidence: ["two public players are pressing the claim"],
        },
      ],
    });

    const plan = createVotePlan(
      wolfVoteView({
        wolf,
        wolfTeammates: [teammate],
        targets: [teammate, outsider],
        tableMemory: memory,
        assignment: assignmentFor(wolf, "DISTANCE", undefined, teammate),
      }),
      tableRead(
        [
          seatRead({
            ...teammate,
            isWolfTeammate: true,
            suspicion: 88,
            trust: 18,
            publicClaims: [{ role: "SEER", roleLabel: "seer", day: 2 }],
            publicChecksAgainst: [
              { claimant: publicActorA, target: teammate, result: "WEREWOLF", day: 2 },
            ],
            publicStancedBy: [
              stance({ actor: publicActorA, target: teammate, kind: "PRESSURE" }),
              stance({ actor: publicActorB, target: teammate, kind: "QUESTION" }),
            ],
          }),
          seatRead({ ...outsider, suspicion: 48, trust: 50, pressure: ["ordinary focus"] }),
        ],
        memory,
      ),
    );

    expect(plan.target.seatId).toBe(teammate.seatId);
    expect(plan.wolfVoteTactic).toBe("planned_distance");
    expect(plan.reason).not.toMatch(/teammate|wolf team|WEREWOLF|private/i);
  });
});

function assignmentFor(
  wolf: ActionTarget,
  task: WolfTeamAssignment["task"],
  target?: ActionTarget,
  supportSeat?: ActionTarget,
): WolfTeamAssignment {
  return {
    seat: wolf,
    task,
    taskLabel: task,
    target,
    supportSeat,
    reason: `${task} test assignment`,
  };
}

function wolfVoteView({
  wolf,
  wolfTeammates,
  targets,
  tableMemory,
  assignment,
}: {
  wolf: ActionTarget;
  wolfTeammates: ActionTarget[];
  targets: ActionTarget[];
  tableMemory: TableMemory;
  assignment: WolfTeamAssignment;
}): AgentView {
  return {
    gameId: "test",
    mySeatId: wolf.seatId,
    myRole: "WEREWOLF",
    phase: "DAY_VOTE",
    day: 2,
    rules: {
      hasGuard: false,
      guardSaveConflictKills: false,
      hasWolfBeauty: false,
      hasKnight: false,
      wolfRoles: ["WEREWOLF"],
    },
    persona: {
      id: "high-risk-wolf",
      name: "High Risk",
      label: "High Risk",
      modelLabel: "High Risk",
      style: "aggressive",
      goal: "survive",
      riskTolerance: 0.98,
      bluffing: 0.98,
    },
    aliveSeats: [wolf, ...targets],
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
    privateKnowledge: {
      wolfTeammates,
      wolfTeamPlan: {
        day: 2,
        strategy: "SHADOW",
        summary: "test",
        assignments: [assignment],
      },
    },
    allowedActions: [
      {
        type: "vote",
        targets,
        canAbstain: false,
      },
    ],
  } as AgentView;
}

function tableRead(seats: SeatRead[], tableMemory: TableMemory): AiTableRead {
  return {
    mySeatId: 1,
    myRole: "WEREWOLF",
    day: 2,
    seats: [
      seatRead({
        seatId: 1,
        name: "Wolf Voter",
        suspicion: 0,
        trust: 100,
        isSelf: true,
      }),
      ...seats,
    ],
    knownWolfSeatIds: [],
    knownGoodSeatIds: [],
    wolfTeammateSeatIds: [2],
    focus: seats[0],
    voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
    recentSpeeches: [],
    recentDeaths: [],
    tableMemory,
    tableMood: "test",
  } as AiTableRead;
}

function seatRead(overrides: Partial<SeatRead> = {}): SeatRead {
  return {
    seatId: 2,
    name: "Seat",
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

function tableMemory(overrides: Partial<TableMemory> = {}): TableMemory {
  return {
    day: 2,
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

function stance({
  actor,
  target,
  kind,
}: {
  actor: ActionTarget;
  target: ActionTarget;
  kind: PublicStanceItem["kind"];
}): PublicStanceItem {
  return {
    day: 2,
    actor,
    target,
    kind,
    kindLabel: kind,
    confidence: 0.75,
    source: "speech",
    reason: `${actor.name} ${kind} ${target.name}`,
  };
}
```

- [ ] **Step 3: Run the wolf voting tests and confirm they are red**

Run:

```powershell
npm run test -- src/ai/wolfVoting.test.ts
```

Expected: FAIL. The important failure is that `plan.wolfVoteTactic` is `undefined` or `PUSH_MISLYNCH` still follows the ranked noisy target instead of the assigned team target.

## Task 2: Implement Wolf Vote Discipline In `createVotePlan`

**Files:**
- Modify: `src/ai/tableRead.ts`

- [ ] **Step 1: Import the new tactic type**

In the type import at the top of `src/ai/tableRead.ts`, change:

```ts
  VotePlan,
  WolfTeamAssignment,
} from "@/game/types";
```

to:

```ts
  VotePlan,
  WolfTeamAssignment,
  WolfVoteTactic,
} from "@/game/types";
```

- [ ] **Step 2: Add the private wolf vote choice type**

Add this near `type PersonaPreferences = typeof DEFAULT_PERSONA_PREFERENCES;`:

```ts
type WolfVoteChoice = {
  target: SeatRead;
  tactic: WolfVoteTactic;
};
```

- [ ] **Step 3: Replace the wolf-specific choice block in `createVotePlan`**

Inside `createVotePlan`, replace:

```ts
  const wolfDistanceTarget = chooseWolfDistanceVoteTarget(view, candidates);
  const wolfTeamTarget = chooseWolfTeamVoteTarget(view, candidatePool);
  const claimTarget = chooseClaimAwareVoteTarget(view, tableRead, candidatePool);
  const picked =
    isWolfRole(view.myRole, view.rules.wolfRoles)
      ? wolfDistanceTarget ?? wolfTeamTarget ?? sorted[0]
      : knownWolf ?? claimTarget ?? sorted[0];
```

with:

```ts
  const wolfVoteChoice = chooseWolfVoteChoice(view, tableRead, candidatePool, sorted);
  const claimTarget = chooseClaimAwareVoteTarget(view, tableRead, candidatePool);
  const picked = isWolfRole(view.myRole, view.rules.wolfRoles)
    ? wolfVoteChoice?.target ?? sorted[0]
    : knownWolf ?? claimTarget ?? sorted[0];
```

Then replace the return object at the end of `createVotePlan`:

```ts
  return {
    target: { seatId: picked.seatId, name: picked.name },
    reason: buildVoteReason(view, tableRead, picked),
    confidence: picked.isKnownWolf ? 0.95 : Math.max(0.35, Math.min(0.86, picked.suspicion / 100)),
    alternatives: sorted
      .filter((seat) => seat.seatId !== picked.seatId)
      .slice(0, 2)
      .map((seat) => ({ seatId: seat.seatId, name: seat.name })),
  };
```

with:

```ts
  return {
    target: { seatId: picked.seatId, name: picked.name },
    reason: buildVoteReason(view, tableRead, picked),
    confidence: picked.isKnownWolf ? 0.95 : Math.max(0.35, Math.min(0.86, picked.suspicion / 100)),
    alternatives: sorted
      .filter((seat) => seat.seatId !== picked.seatId)
      .slice(0, 2)
      .map((seat) => ({ seatId: seat.seatId, name: seat.name })),
    wolfVoteTactic: isWolfRole(view.myRole, view.rules.wolfRoles) ? wolfVoteChoice?.tactic : undefined,
  };
```

- [ ] **Step 4: Replace the old wolf target helpers with tactic-aware helpers**

Replace the current `chooseWolfTeamVoteTarget`, `chooseWolfDistanceVoteTarget`, and `hasStrongWolfDistanceEvidence` functions with this block:

```ts
function chooseWolfVoteChoice(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
  sorted: SeatRead[],
): WolfVoteChoice | undefined {
  if (!isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
  const nonTeammates = candidates.filter((seat) => !seat.isWolfTeammate);
  const teammateCandidates = candidates.filter((seat) => seat.isWolfTeammate);
  const assignedTarget = assignment?.target
    ? candidates.find((seat) => seat.seatId === assignment.target?.seatId)
    : undefined;

  if (assignment?.task === "PUSH_MISLYNCH" && assignedTarget && !assignedTarget.isWolfTeammate) {
    return { target: assignedTarget, tactic: "team_target" };
  }

  const claimTarget = chooseClaimAwareVoteTarget(view, tableRead, nonTeammates);
  if (assignment?.task === "COUNTERCLAIM_SEER" && claimTarget) {
    return { target: claimTarget, tactic: "team_target" };
  }

  const distanceTarget = chooseWolfDistanceVoteTarget(view, teammateCandidates);
  if (distanceTarget) {
    return {
      target: distanceTarget,
      tactic: assignment?.task === "DISTANCE" ? "planned_distance" : "emergency_cut",
    };
  }

  const rankedNonTeammate = sorted.find((seat) => !seat.isWolfTeammate);
  if (rankedNonTeammate) {
    return {
      target: rankedNonTeammate,
      tactic: teammateCandidates.length > 0 && sorted[0]?.isWolfTeammate ? "avoid_teammate" : "team_target",
    };
  }

  const emergencyCut = teammateCandidates.find((seat) => hasHardPublicTeammateVoteEvidence(view, seat));
  if (emergencyCut) {
    return { target: emergencyCut, tactic: "emergency_cut" };
  }

  return undefined;
}

function chooseWolfDistanceVoteTarget(view: AgentView, teammateCandidates: SeatRead[]): SeatRead | undefined {
  if (!isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;
  if (teammateCandidates.length === 0) return undefined;

  const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
  const supportSeatId = assignment?.supportSeat?.seatId;
  const supportSeat = supportSeatId
    ? teammateCandidates.find((seat) => seat.seatId === supportSeatId)
    : undefined;
  const publicIdentitySeat = teammateCandidates.find((seat) => seat.publicClaims.length > 0);
  const target = supportSeat ?? publicIdentitySeat ?? teammateCandidates[0];
  if (!target) return undefined;
  if (!hasHardPublicTeammateVoteEvidence(view, target)) return undefined;
  if (assignment?.task !== "DISTANCE" || !supportSeat || supportSeat.seatId !== target.seatId) return undefined;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const bluffing = view.persona?.bluffing ?? 0.45;
  const negativeActors = publicVotePressureActors(target).length;
  const publicBlackChecks = target.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;

  if (personaRisk >= 0.9 && bluffing >= 0.85) {
    return target;
  }

  const threshold = clampProbability(
    0.12 +
      personaRisk * 0.12 +
      bluffing * 0.12 +
      Math.min(0.12, negativeActors * 0.04 + publicBlackChecks * 0.05) +
      (view.day >= 2 ? 0.06 : 0),
  );
  const roll = stableRoll([
    "wolf-distance-vote",
    view.day,
    view.mySeatId,
    view.persona?.id,
    target.seatId,
    view.publicSummary.recentSpeeches.at(-1)?.seq,
  ]);

  return roll < threshold ? target : undefined;
}

function hasHardPublicTeammateVoteEvidence(view: AgentView, target: SeatRead): boolean {
  const negativeActors = publicVotePressureActors(target).length;
  const publicBlackChecks = target.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;
  const pressureGap = target.suspicion - target.trust;
  const inCounterclaim = view.publicSummary.tableMemory.counterclaims.some((group) =>
    group.claimants.some((claimant) => claimant.seatId === target.seatId),
  );
  const hasDeadSeerBlack = hasDeadSeerLegacyBlackCheckAgainst(view.publicSummary.tableMemory, target.seatId);
  const hardCue = view.publicSummary.tableMemory.reasoningCues.some(
    (cue) =>
      cue.target?.seatId === target.seatId &&
      (cue.weight === "strong" || (cue.weight === "medium" && (cue.kind === "counterclaim" || cue.kind === "seer_legacy"))),
  );
  const latestTie = findLatestTieVote({ publicSummary: view.publicSummary } as AgentView | AiTableRead);
  const isVoteLeader = latestTie?.tiedSeatIds.includes(target.seatId) || target.votesReceived >= 2;

  if (hasDeadSeerBlack || publicBlackChecks >= 2) return true;
  if (publicBlackChecks >= 1 && inCounterclaim) return true;
  if (publicBlackChecks >= 1 && (negativeActors >= 2 || pressureGap >= 48 || hardCue)) return true;
  if (inCounterclaim && negativeActors >= 2 && (pressureGap >= 30 || hardCue)) return true;
  if (view.day >= 2 && negativeActors >= 3 && pressureGap >= 28) return true;
  if (isVoteLeader && (negativeActors >= 2 || publicBlackChecks >= 1 || inCounterclaim)) return true;

  return false;
}
```

During implementation, if `findLatestTieVote` only accepts `AiTableRead`, adjust the `isVoteLeader` line to use `view.publicSummary.voteSnapshot.leaders` directly:

```ts
  const isVoteLeader =
    view.publicSummary.voteSnapshot.leaders.some((leader) => leader.seatId === target.seatId) || target.votesReceived >= 2;
```

- [ ] **Step 5: Run the focused wolf tests**

Run:

```powershell
npm run test -- src/ai/wolfVoting.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the voting planner change**

Run:

```powershell
git add src/game/types.ts src/ai/wolfVoting.test.ts src/ai/tableRead.ts
git commit -m "feat: discipline wolf day votes"
```

Expected: commit succeeds.

## Task 3: Protect LLM Input From Good-Side Tactic Leakage

**Files:**
- Modify: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Add a good-side leak regression test**

In `src/ai/actionProviders.test.ts`, inside the existing `describe("buildConstrainedActionInput", () => { ... })` block, add this test after the current good/wolf private context tests:

```ts
  it("does not include wolf tactic metadata in good-side action input", () => {
    const goodView = createView({
      myRole: "VILLAGER",
      privateKnowledge: {},
    });
    const tableRead = buildAiTableRead(goodView);
    const votePlan = createVotePlan(goodView, tableRead);
    const fallbackCommand = createMockCommand(goodView, tableRead, votePlan);

    const input = buildConstrainedActionInput(goodView, { tableRead, votePlan, fallbackCommand });

    expect(JSON.stringify(input)).not.toContain("wolfVoteTactic");
  });
```

- [ ] **Step 2: Run the action provider tests**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts
```

Expected: PASS. If this fails because the serialized good-side `votePlan` includes `wolfVoteTactic`, update `buildConstrainedActionInput` so it omits undefined fields or strips the field when `view.myRole` is not a wolf role.

- [ ] **Step 3: Commit the leak regression test**

Run:

```powershell
git add src/ai/actionProviders.test.ts
git commit -m "test: guard wolf vote tactic privacy"
```

Expected: commit succeeds.

## Task 4: Refine Audit Classification

**Files:**
- Modify: `scripts/audit-ai-experience.mjs`

- [ ] **Step 1: Add a tactic classification helper**

Near the other small predicate helpers in `scripts/audit-ai-experience.mjs`, add:

```js
function isClassifiedWolfTeamVote(log) {
  const tactic = log.votePlan?.wolfVoteTactic;
  return tactic === "planned_distance" || tactic === "emergency_cut";
}
```

- [ ] **Step 2: Keep warning only for unclassified wolf teammate votes**

Replace the current wolf teammate vote issue block:

```js
      if (seat && isWolfTarget(seat.role, state.rules.wolfRoles) && log.output.targetSeatId) {
        const target = state.seats.find((item) => item.seatId === log.output.targetSeatId);
        if (target && isWolfTarget(target.role, state.rules.wolfRoles)) {
          issues.push({
            ...context,
            code: "wolf_team_vote",
            severity: "warning",
            title: "wolf team vote",
            detail: "狼人投给了队友，需要确认是否属于有意做距离。",
          });
        }
      }
```

with:

```js
      if (seat && isWolfTarget(seat.role, state.rules.wolfRoles) && log.output.targetSeatId) {
        const target = state.seats.find((item) => item.seatId === log.output.targetSeatId);
        if (target && isWolfTarget(target.role, state.rules.wolfRoles) && !isClassifiedWolfTeamVote(log)) {
          issues.push({
            ...context,
            code: "wolf_team_vote",
            severity: "warning",
            title: "wolf team vote",
            detail: "狼人投给了队友，且没有被标记为计划切割或公开压力下的牺牲票。",
          });
        }
      }
```

- [ ] **Step 3: Include tactic metadata in audit transcripts**

In `buildTranscript`, replace the `votePlan` object:

```js
          ? {
              target: formatTarget(log.votePlan.target),
              abstain: log.votePlan.abstain ?? false,
              reason: log.votePlan.reason,
              confidence: log.votePlan.confidence,
              alternatives: log.votePlan.alternatives.map(formatTarget),
            }
```

with:

```js
          ? {
              target: formatTarget(log.votePlan.target),
              abstain: log.votePlan.abstain ?? false,
              reason: log.votePlan.reason,
              confidence: log.votePlan.confidence,
              alternatives: log.votePlan.alternatives.map(formatTarget),
              wolfVoteTactic: log.votePlan.wolfVoteTactic,
            }
```

- [ ] **Step 4: Run the audit script as the behavioral check**

Run:

```powershell
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/wolf-day-vote-discipline-audit.json
```

Expected:
- Command exits 0.
- `fallbackCount` is 0.
- `tmp/wolf-day-vote-discipline-audit.json` exists.
- Any remaining `wolf_team_vote` examples are unclassified by `wolfVoteTactic`.

- [ ] **Step 5: Commit the audit classification change**

Run:

```powershell
git add scripts/audit-ai-experience.mjs tmp/wolf-day-vote-discipline-audit.json
git commit -m "chore: classify planned wolf teammate votes"
```

Expected: commit succeeds. If `tmp/` is intentionally untracked and ignored, do not force-add the audit artifact; commit only `scripts/audit-ai-experience.mjs` and report the artifact path in the final verification summary.

## Task 5: Full Verification And Push

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused vote planner tests**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts src/ai/wolfVoting.test.ts src/game/engine.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run action provider tests**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript**

Run:

```powershell
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Run the AI audit**

Run:

```powershell
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/wolf-day-vote-discipline-audit.json
```

Expected:
- `fallbackCount` remains 0.
- `wolf_team_vote` warnings are lower or more clearly limited to unclassified teammate votes.
- The JSON transcript includes `votePlan.wolfVoteTactic` for planned wolf distance decisions.

- [ ] **Step 5: Run lint and full tests**

Run:

```powershell
npm run lint
npm run test
```

Expected: PASS for both commands.

- [ ] **Step 6: Inspect git diff**

Run:

```powershell
git status --short --untracked-files=all
git diff --stat
git diff --check
```

Expected:
- Only intended tracked files are modified.
- Existing unrelated untracked directories may remain: `.superpowers/`, `promo-ai-werewolf/`, `tmp/`.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 7: Commit any remaining tracked changes**

If previous task commits were not made because the implementation was batched, run:

```powershell
git add src/game/types.ts src/ai/wolfVoting.test.ts src/ai/tableRead.ts src/ai/actionProviders.test.ts scripts/audit-ai-experience.mjs
git commit -m "feat: improve wolf day vote discipline"
```

Expected: commit succeeds.

- [ ] **Step 8: Push the branch**

Run:

```powershell
git push
```

Expected: push succeeds to `origin/codex/render-main-game-env-fix`.

## Self-Review

- Spec coverage: `PUSH_MISLYNCH`, `HIDE`, `DISTANCE`, privacy, audit classification, and validation commands all map to tasks above.
- Placeholder scan: no empty implementation steps remain; every code-changing step includes exact code blocks or exact replacement instructions.
- Type consistency: `WolfVoteTactic` is defined in `src/game/types.ts`, imported in `src/ai/tableRead.ts`, stored as `VotePlan.wolfVoteTactic`, and read by the audit script as `log.votePlan?.wolfVoteTactic`.

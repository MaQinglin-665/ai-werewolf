# Class Trial System Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize class-trial and global Werewolf phase/vote/speech architecture so AI speech is less templated, phase presentation is clearer, vote presentation is stronger, and public-room impact is testable.

**Architecture:** Extract pure semantic models first, then move UI and AI orchestration onto those models. Keep the rules engine authoritative; presentation and speech layers consume rule/projection state instead of guessing from scattered phase checks.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Prisma/SQLite, project smoke scripts.

---

## File Structure

- Create `src/game/phaseSemantics.ts`: shared phase predicates for night phases, public actor phases, vote reveal carry-over phases, and phase labels needed by projection/server/UI.
- Create `src/game/voteSnapshot.ts`: public vote snapshot construction extracted from `projection.ts`.
- Modify `src/game/projection.ts`: use `phaseSemantics.ts` and `voteSnapshot.ts`; keep output shape stable.
- Create `src/components/game/classTrialFlowModel.ts`: pure class-trial gating model for intro, opening night curtain, phase curtain, host audio, AI audio, prewarm, and auto-advance pauses.
- Modify `src/components/GameClient.tsx`: use `classTrialFlowModel.ts` instead of inline class-trial gating checks.
- Create `src/components/game/classTrialVotePresentation.ts`: shared class-trial vote UI state.
- Modify `src/components/game/ClassTrialVoteStage.tsx` and `src/components/game/ClassTrialGameTable.tsx`: consume `classTrialVotePresentation.ts`.
- Create `src/components/game/classTrialTableModel.ts`: pure table chrome/state labels for night dim, vote activity, host audio label, and active seat styling.
- Create `src/ai/classTrialSpeechDirector.ts`: class-trial prompt/director guide helpers.
- Create `src/ai/classTrialSpeechValidation.ts`: class-trial validation helpers.
- Create `src/ai/classTrialSpeechFallback.ts`: class-trial fallback speech helpers.
- Modify `src/ai/speechProviders.ts`: call the new class-trial speech modules.
- Modify focused tests next to each extracted model.
- Update `feature_list.json`, `progress.md`, `session-handoff.md`, and this task card with verification evidence.

## Task 1: Shared Phase Semantics

**Files:**
- Create: `src/game/phaseSemantics.ts`
- Modify: `src/game/projection.ts`
- Modify: `src/server/roomService.ts`
- Test: `src/game/projection.test.ts`

- [ ] **Step 1: Write failing phase semantics tests**

Add tests in `src/game/projection.test.ts` that prove hidden night phases do not expose current actor to unrelated human views and that public actor phases remain public for speech/vote/last words.

Run: `npm run test -- src/game/projection.test.ts`
Expected: tests fail until `phaseSemantics.ts` exists and projection imports it.

- [ ] **Step 2: Add phase semantics module**

Create `src/game/phaseSemantics.ts` with these exports:

```ts
import type { Phase } from "./types";

export function isNightPhase(phase: Phase): boolean {
  return phase.startsWith("NIGHT");
}

export function isVoteRevealCarryoverPhase(phase: Phase): boolean {
  return (
    phase === "EXILE_RESOLUTION" ||
    phase === "LAST_WORDS" ||
    phase === "HUNTER_REVEAL" ||
    phase === "HUNTER_SHOT" ||
    phase === "WOLF_KING_SHOT" ||
    phase === "SHERIFF_HANDOFF"
  );
}

export function isPublicActorPhase(phase: Phase): boolean {
  return (
    phase === "DAY_SPEECH" ||
    phase === "KNIGHT_DUEL" ||
    phase === "DAY_VOTE" ||
    phase === "LAST_WORDS" ||
    phase === "WOLF_KING_SHOT" ||
    phase === "SHERIFF_NOMINATION" ||
    phase === "SHERIFF_SPEECH" ||
    phase === "SHERIFF_WITHDRAWAL" ||
    phase === "SHERIFF_VOTE" ||
    phase === "SHERIFF_PK_SPEECH" ||
    phase === "SHERIFF_PK_VOTE" ||
    phase === "SHERIFF_HANDOFF"
  );
}
```

- [ ] **Step 3: Replace local duplicated predicates**

Import `isPublicActorPhase` in `src/game/projection.ts`. Import the same function in `src/server/roomService.ts` and remove the duplicated `isPublicRoomActorPhase` body by delegating to the shared function.

- [ ] **Step 4: Verify**

Run: `npm run test -- src/game/projection.test.ts`
Expected: PASS.

## Task 2: Vote Snapshot Model

**Files:**
- Create: `src/game/voteSnapshot.ts`
- Modify: `src/game/projection.ts`
- Modify: `src/game/engine.test.ts`
- Test: `src/game/engine.test.ts`, `src/game/projection.test.ts`

- [ ] **Step 1: Add tests for hidden vote progress and revealed vote payload**

Keep the existing hidden-vote regression and add a projection test that confirms `DAY_VOTE` exposes `eligibleSeatIds`, `lockedSeatIds`, and `pendingSeatIds`, while hiding `votes`, `tally`, `leaders`, target names, and vote reasons.

- [ ] **Step 2: Extract vote snapshot builder**

Move `buildVoteSnapshot` and its helper logic from `src/game/projection.ts` into `src/game/voteSnapshot.ts`. Export:

```ts
export function buildPublicVoteSnapshot(state: GameState): PublicVoteSnapshot;
export function buildPublicSheriffVoteSnapshot(state: GameState): PublicVoteSnapshot | undefined;
```

Use the existing `canSeatVote`, `hasVoted`, `buildVoteTally`, and sheriff helpers by moving only the minimal helper functions needed.

- [ ] **Step 3: Update projection imports**

In `src/game/projection.ts`, replace the local vote snapshot functions with imports from `voteSnapshot.ts`.

- [ ] **Step 4: Verify**

Run: `npm run test -- src/game/engine.test.ts src/game/projection.test.ts`
Expected: PASS.

## Task 3: Class-Trial Vote Presentation

**Files:**
- Create: `src/components/game/classTrialVotePresentation.ts`
- Create or modify: `src/components/game/classTrialVotePresentation.test.ts`
- Modify: `src/components/game/ClassTrialVoteStage.tsx`
- Modify: `src/components/game/ClassTrialGameTable.tsx`

- [ ] **Step 1: Move `getClassTrialVoteState` into a pure presentation file**

Create `classTrialVotePresentation.ts` and move the state derivation from `ClassTrialVoteStage.tsx` into it. Export `ClassTrialVotePresentationState` and `getClassTrialVotePresentation(game)`.

- [ ] **Step 2: Add tests**

Cover:

- `DAY_VOTE` sealed progress with locked/pending seats and no targets.
- `EXILE_RESOLUTION` reveal with focus seat.
- tied/no-exile reveal with no focus seat.
- non-vote phase returns `null`.

Run: `npm run test -- src/components/game/classTrialVotePresentation.test.ts`
Expected: PASS after implementation.

- [ ] **Step 3: Update UI consumers**

Use `getClassTrialVotePresentation(game)` from both `ClassTrialVoteStage.tsx` and `ClassTrialGameTable.tsx`.

- [ ] **Step 4: Verify**

Run: `npm run test -- src/components/game/classTrialVotePresentation.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts`
Expected: PASS.

## Task 4: Class-Trial Flow Model For GameClient

**Files:**
- Create: `src/components/game/classTrialFlowModel.ts`
- Create: `src/components/game/classTrialFlowModel.test.ts`
- Modify: `src/components/GameClient.tsx`
- Modify: `src/components/game/phaseCurtainModel.ts`

- [ ] **Step 1: Add flow model tests**

Cover these pure cases:

- intro pending pauses phase curtain, host audio, AI audio, prewarm, and auto-advance.
- completed intro plus first night phase requires the opening night curtain.
- completed opening night curtain allows normal phase curtain.
- non-class-trial games do not pause ordinary flow.

- [ ] **Step 2: Implement flow model**

Create a function:

```ts
export function getClassTrialFlowModel(args: {
  game: Pick<HumanGameView, "id" | "day" | "phase"> | null;
  classTrialThemeActive: boolean;
  classTrialIntroGameId: string | null;
  completedClassTrialIntroGameId: string | null;
  completedClassTrialOpeningNightCurtainGameId: string | null;
  roleIntroGameId: string | null;
}): {
  introPending: boolean;
  openingNightCurtainPending: boolean;
  pauseAutoAdvance: boolean;
  pauseHostAudio: boolean;
  pauseAiAudio: boolean;
  pauseVoicePrewarm: boolean;
  allowThemedPhaseCurtain: boolean;
};
```

- [ ] **Step 3: Replace repeated inline booleans in GameClient**

Compute the model once and use it where the file currently checks `classTrialIntroPending` and `classTrialOpeningNightCurtainPending`.

- [ ] **Step 4: Verify**

Run: `npm run test -- src/components/game/classTrialFlowModel.test.ts src/components/game/phaseCurtainModel.test.ts`
Expected: PASS.

## Task 5: Class-Trial Table Model

**Files:**
- Create: `src/components/game/classTrialTableModel.ts`
- Create: `src/components/game/classTrialTableModel.test.ts`
- Modify: `src/components/game/ClassTrialGameTable.tsx`

- [ ] **Step 1: Extract table chrome derivation**

Create a pure model that returns:

```ts
export type ClassTrialTableChrome = {
  classNames: string[];
  nightPhase: boolean;
  hostAudioLabel: string;
  voteLockedSeatIds: Set<number>;
  votePendingSeatIds: Set<number>;
  voteFocusSeatId?: number;
};
```

- [ ] **Step 2: Test night, vote sealing, vote reveal, and host audio labels**

Run: `npm run test -- src/components/game/classTrialTableModel.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `ClassTrialGameTable.tsx`**

Use `getClassTrialTableChrome(...)` to remove local phase/vote/host-audio label inference.

- [ ] **Step 4: Verify**

Run: `npm run test -- src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts`
Expected: PASS.

## Task 6: Class-Trial Speech Modules

**Files:**
- Create: `src/ai/classTrialSpeechDirector.ts`
- Create: `src/ai/classTrialSpeechValidation.ts`
- Create: `src/ai/classTrialSpeechFallback.ts`
- Create tests next to these files.
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Extract director guide helpers**

Move class-trial-only guide construction out of `speechProviders.ts`. Keep public signatures small:

```ts
export function buildClassTrialSpeechDirectorInput(view: AgentView): string[];
```

- [ ] **Step 2: Extract class-trial validators**

Move validators that only apply to `view.roleCard?.theme === "class-trial"` into `classTrialSpeechValidation.ts`. Export:

```ts
export function validateClassTrialSpeech(view: AgentView, speech: string): string[];
```

- [ ] **Step 3: Extract fallback speech**

Move class-trial fallback construction into `classTrialSpeechFallback.ts`. Export:

```ts
export function createClassTrialFallbackSpeech(view: AgentView, plan: SpeechPlan): string;
```

- [ ] **Step 4: Keep generic speech provider as orchestrator**

`speechProviders.ts` should call the new modules and retain generic/ordinary Werewolf validation in place.

- [ ] **Step 5: Verify**

Run: `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts`
Expected: PASS.

## Task 7: Verification, Browser, Room, And Handoff

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-06-class-trial-system-architecture.md`

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test -- src/game/engine.test.ts src/game/projection.test.ts
npm run test -- src/components/game/classTrialVotePresentation.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialFlowModel.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/phaseCurtainModel.test.ts
npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run confidence checks**

Run:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all pass. Existing Turbopack NFT trace warning may remain if build exits 0.

- [ ] **Step 3: Run local smokes**

Start a local server on a free port. Run:

```powershell
npm run smoke:main-game -- --base-url=http://127.0.0.1:<port>
npm run smoke:room-action:vote -- --base-url=http://127.0.0.1:<port>
```

Expected: both pass if the local server and database are ready.

- [ ] **Step 4: Browser verify class-trial**

Use the in-app browser or Playwright against the local URL:

- homepage
- select `学级裁判主题局`
- start 9-player spectator game
- confirm intro/first night curtain do not let speech/audio skip
- confirm Day 1 speech is not dominated by empty process templates in visible transcript
- confirm vote sealing hides targets and reveal shows tally/ledger/focus

- [ ] **Step 5: Update state docs**

Update `feature_list.json`, `progress.md`, `session-handoff.md`, and task card with exact command evidence and remaining risks.

- [ ] **Step 6: Commit and push**

Run:

```powershell
git status -sb
git add docs/superpowers/specs/2026-06-02-class-trial-system-architecture-design.md docs/superpowers/plans/2026-06-02-class-trial-system-architecture.md docs/tasks/2026-06-class-trial-system-architecture.md feature_list.json progress.md session-handoff.md src
git commit -m "refactor: organize class trial architecture"
git push -u origin HEAD
```

Expected: commit succeeds and branch pushes to GitHub.

## Self-Review Notes

- The plan covers the user-reported issues through AI speech modules, phase semantics/flow model, and vote snapshot/presentation model.
- Global rule/room impact is covered through projection tests and room vote smoke.
- The plan deliberately avoids unrelated deployment, secret, cache, or asset changes.

# AI Speech Layer Structure Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a safe first migration path for the AI speech layer by extracting shared type/model boundaries before moving runtime speech behavior.

**Architecture:** The current 12p Mimo speech mechanics work has already deepened the ordinary speech director inside `src/ai/speechProviders.ts`. This plan preserves that behavior, treats the active WIP as a prerequisite, and starts with a non-behavioral `src/ai/speech/types.ts` seam before any prompt, provider, validation, repair, fallback, or mock-speech movement.

**Tech Stack:** TypeScript, Vitest, Next.js path aliases, existing `npm run harness:*`, `npm run test`, `npx tsc --noEmit`, and `npm run audit:structure`.

**Execution Status:** Task 3 has been executed in the current branch as a
type-only extraction. A follow-up behavior-preserving text-helper extraction
also moved `seatText`, `clipBriefingText`, and the private
`stripEvaluationModelSuffix` helper into `src/ai/speech/text.ts`. A second
follow-up moved read-only speech-context helpers such as
`currentDaySpeechItems`, `toTargetFromSeatId`, and current-day death-shape
readers into `src/ai/speech/context.ts`. A third follow-up moved death-shape
prompt/boundary/briefing/fallback text helpers into
`src/ai/speech/deathShape.ts`. A fourth follow-up moved public briefing line
helpers into `src/ai/speech/briefing.ts`. A fifth follow-up moved private
briefing and private boundary helpers into `src/ai/speech/privateBriefing.ts`.
A sixth follow-up moved claim-attribution boundary/contract helpers and D1
class-trial black-check agenda lines into `src/ai/speech/claimAttribution.ts`.
A seventh follow-up moved LLM speech output parsing into
`src/ai/speech/outputParsing.ts`.
An eighth follow-up moved public table state readers for low-info D1 state and
public seer check/black-check context into `src/ai/speech/publicState.ts`.
A ninth follow-up moved speech length constants into `src/ai/speech/limits.ts`
and speech contract construction, move resolution, speech limit resolution, and
hard-info/low-info contract gates into `src/ai/speech/speechContract.ts`.
A tenth follow-up moved public rules context construction into
`src/ai/speech/rulesContext.ts`, and speech-order context, current-day order
projection, and seat-order deduplication into `src/ai/speech/speechOrder.ts`.
An eleventh follow-up moved retry stability hint construction and LLM speech
repair instructions into `src/ai/speech/stability.ts`.
A twelfth follow-up moved player speech guide helper text for universal
de-template guidance, ordinary player mouth guidance, addressing, model-style
guidance, self-introduction boundaries, and public check result guidance into
`src/ai/speech/playerGuide.ts`.
A thirteenth follow-up moved full-width digit normalization into
`src/ai/speech/text.ts` and ordinary low-info opening / repeated-pressure
predicate helpers into `src/ai/speech/playerGuide.ts`.
A fourteenth follow-up moved ordinary surface/copy/card/handling predicates
into `src/ai/speech/ordinarySurface.ts`.
A fifteenth follow-up moved ordinary final-landing, truncated-ending, and
forward-commitment predicates into `src/ai/speech/ordinarySurface.ts`.
A sixteenth follow-up moved ordinary naturalization, duplicated-word repair,
and forward-commitment trimming helpers into `src/ai/speech/ordinaryRepair.ts`.
A seventeenth follow-up moved class-trial black-check surface predicates into
`src/ai/speech/blackCheckSurface.ts`.
An eighteenth follow-up moved class-trial generated-speech repair text
normalization into `src/ai/speech/classTrialRepair.ts`.
A nineteenth follow-up moved seer-attribution misread detection into
`src/ai/speech/blackCheckSurface.ts`.
A twentieth follow-up moved plain speech format and incomplete-question
fragment validation into `src/ai/speech/formatValidation.ts`.
A twenty-first follow-up moved terminal punctuation stripping into
`src/ai/speech/text.ts`.
A twenty-second follow-up moved regex escaping into `src/ai/speech/text.ts`.
A twenty-third follow-up moved generic speech surface helpers into
`src/ai/speech/surface.ts`.
A twenty-fourth follow-up moved generic sentence-like unit counting into
`src/ai/speech/formatValidation.ts`.
A twenty-fifth follow-up moved current-day spoken-seat and plan target
speech-status helpers into `src/ai/speech/speechOrder.ts`.
A twenty-sixth follow-up moved speech validation error hard/soft
classification into `src/ai/speech/validationErrors.ts`.
A twenty-seventh follow-up moved seat-number text parsing into
`src/ai/speech/text.ts`.
A twenty-eighth follow-up moved ordinary director support helpers for
repeated quotes, pressure labels, move labels, and de-duplication into
`src/ai/speech/ordinaryDirectorHelpers.ts`.
A twenty-ninth follow-up moved speech constraint construction into
`src/ai/speech/speechConstraints.ts`.
Runtime provider, validation, repair, ordinary director, post-speech timeline
fact helpers, and mock speech logic remain in `src/ai/speechProviders.ts`.

---

## File Structure

- `docs/tasks/2026-06-ai-speech-layer-structure-migration.md`: migration task gate, current inventory, first migration boundary.
- `docs/superpowers/specs/2026-06-12-ai-speech-layer-structure-design.md`: source design for the seven-layer speech boundary.
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`: prerequisite WIP task; read it before moving code.
- `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`: prerequisite implementation details; read it before moving code.
- `src/ai/speech/types.ts`: future first code artifact; owns shared speech layer types only.
- `src/ai/speech/text.ts`: extracted pure display/text helpers for speech
  formatting, digit normalization, seat-number parsing, terminal punctuation
  stripping, and regex escaping.
- `src/ai/speech/context.ts`: extracted read-only AgentView speech-context
  helpers for current-day speeches, seat lookup, and current-day death shape.
- `src/ai/speech/deathShape.ts`: extracted death-shape prompt, briefing,
  boundary, and fallback text helpers.
- `src/ai/speech/briefing.ts`: extracted public claim, sheriff, seer-legacy,
  and speech-order briefing line helpers.
- `src/ai/speech/privateBriefing.ts`: extracted role-private briefing and
  private boundary line helpers.
- `src/ai/speech/claimAttribution.ts`: extracted claim-attribution
  boundary/contract helpers and D1 class-trial black-check agenda lines.
- `src/ai/speech/outputParsing.ts`: extracted LLM speech output parsing and
  loose-text coercion.
- `src/ai/speech/publicState.ts`: extracted shared public table state readers
  for low-info D1 state and public seer check/black-check context.
- `src/ai/speech/limits.ts`: extracted shared speech length constants.
- `src/ai/speech/speechContract.ts`: extracted speech contract construction,
  move resolution, speech limit resolution, and hard-info/low-info contract
  gates.
- `src/ai/speech/speechConstraints.ts`: extracted speech constraint
  construction for prompt contract, death-shape, interaction, strictness,
  wolf-privacy, and protected gold constraints.
- `src/ai/speech/rulesContext.ts`: extracted public rules context
  construction.
- `src/ai/speech/speechOrder.ts`: extracted speech-order context,
  current-day order projection, seat-order deduplication, current-day
  spoken-seat lookup, and plan target speech-status lookup.
- `src/ai/speech/stability.ts`: extracted retry stability hint construction
  and LLM speech repair instructions.
- `src/ai/speech/playerGuide.ts`: extracted player speech guide helper text
  that is shared by prompt guide construction and some validation helpers,
  plus ordinary low-info opening and repeated-pressure predicate helpers.
- `src/ai/speech/ordinaryDirectorHelpers.ts`: extracted ordinary director
  support helpers for repeated quote collection, pressure labels, move labels,
  and de-duplication without moving the director flow.
- `src/ai/speech/ordinarySurface.ts`: extracted ordinary surface/copy/card
  handling-action, final-landing, truncated-ending, and forward-commitment
  predicates shared by ordinary validation helpers.
- `src/ai/speech/ordinaryRepair.ts`: extracted ordinary speech
  naturalization, duplicated-word repair, and forward-commitment trimming
  helpers.
- `src/ai/speech/blackCheckSurface.ts`: extracted class-trial seer
  black-check surface predicates for explicit target mentions, vote
  boundaries, reversal offers, observer-condition dilution, and
  first-check-motive detection, plus seer-attribution misread detection.
- `src/ai/speech/classTrialRepair.ts`: extracted class-trial generated-speech
  repair text normalization.
- `src/ai/speech/formatValidation.ts`: extracted plain speech Markdown-format
  validation, incomplete-question-fragment validation, and generic
  sentence-like unit counting.
- `src/ai/speech/surface.ts`: extracted generic speech surface helpers for
  out-of-game text, planned check cue coverage, and public seat/target mention
  detection.
- `src/ai/speech/validationErrors.ts`: extracted speech validation error
  hard/soft classification for ordinary soft-accepted repair flow.
- `src/ai/speechProviders.ts`: future caller/importer of the extracted types; runtime behavior stays here in the first batch.
- `src/ai/speechProviders.test.ts`: existing focused tests for the first type-only migration.

## Task 1: Confirm The Parallel WIP Is Stable

**Files:**
- Read: `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- Read: `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`
- Read: `src/ai/speechProviders.ts`
- Read: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Inspect worktree ownership**

Run:

```powershell
git status --short --branch
git diff --name-only
```

Expected: the active 12p speech mechanics files are either committed, or still visibly modified in `src/ai/speechProviders.ts`, `src/ai/speechProviders.test.ts`, `progress.md`, `session-handoff.md`, and `long_running_tasks.json`. If those files remain modified, do not edit the state files and do not move runtime functions.

- [ ] **Step 2: Validate the prerequisite task card**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md
```

Expected: PASS. If it fails, fix the 12p task card in that task's owning context before running this migration.

- [ ] **Step 3: Run the prerequisite focused speech tests when code is still dirty**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets|ritualized previous speaker opening"
```

Expected: PASS. If it fails, stop this migration; the speech mechanics WIP is not stable enough for structure movement.

## Task 2: Refresh The Source Inventory

**Files:**
- Modify: `docs/tasks/2026-06-ai-speech-layer-structure-migration.md`

- [ ] **Step 1: Re-scan the speech provider function map**

Run:

```powershell
rg -n "^export type |^type |^export function|^function |buildOrdinary|validateOrdinary|createLooseFallbackSpeech|fallbackSpeech|repairOrdinary|repairGeneratedClassTrialSpeech" src/ai/speechProviders.ts
```

Expected: output includes the ordinary director block, validation block, repair block, fallback block, and mock speech block.

- [ ] **Step 2: Update the task card inventory if names changed**

Edit `docs/tasks/2026-06-ai-speech-layer-structure-migration.md` only if the actual function/type names differ from the inventory already recorded. Keep this section factual and do not add proposed implementation text there.

- [ ] **Step 3: Verify the docs-only task card still passes**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md
```

Expected: PASS.

## Task 3: Extract Shared Speech Types Only

**Files:**
- Create: `src/ai/speech/types.ts`
- Modify: `src/ai/speechProviders.ts`
- Test: `src/ai/speechProviders.test.ts`

Execution note: the actual extraction also moved `SpeechStrictness` and
`LlmSpeechContract` because they are part of the public speech-provider type
surface, and `LlmSpeechInput` required additional referenced type imports from
the current 12p speech mechanics WIP. Keep future edits aligned with the
checked-in `src/ai/speech/types.ts` rather than the illustrative snippet below.

- [ ] **Step 1: Write the new type file**

Create `src/ai/speech/types.ts` with this content, adjusted only if the current `LlmSpeechInput` shape has changed during the prerequisite WIP:

```typescript
import type { ClassTrialCharacterLens } from "../classTrialCharacterLens";
import type { ClassTrialLiveState } from "../classTrialLiveState";
import type { AdaptedPersonaStrategyCard, AiOrdinaryLiveIntentState } from "../personaStrategyCards";
import type { ActionTarget, AgentView, ClaimCheck, Role, TableMemory } from "@/game/types";

export type OrdinarySpeechPressure =
  | "noInformation"
  | "respondToPrevious"
  | "underQuestion"
  | "publicRoleClaim"
  | "deathShape"
  | "voteBoundary";

export type OrdinarySpeechMove =
  | "waterPass"
  | "quoteOneLine"
  | "halfAccept"
  | "discomfort"
  | "followPressure"
  | "hold"
  | "defendSelf"
  | "clarifyMotive"
  | "counterQuestion"
  | "changeRead"
  | "roleHandle"
  | "voteBoundary";

export type OrdinaryPlayerVoiceCard = {
  label: string;
  traits: string[];
  mouthHabit: string;
  emotionTell: string;
  riskHabit: string;
  promptLines: string[];
};

export type OrdinarySelfHistory = {
  lastPublicSpeech?: string;
  lastSpeechTarget?: ActionTarget;
  lastSpeechStance?: string;
  lastVoteTarget?: ActionTarget;
  lastVoteReason?: string;
  incomingPressure?: Array<{ speaker: ActionTarget; message: string }>;
  promptLines: string[];
};

export type OrdinarySpeechDirector = {
  currentPressure: OrdinarySpeechPressure;
  tableObjects: string[];
  allowedSpeechMoves: OrdinarySpeechMove[];
  recentSurfaceMoves: string[];
  playerVoiceCard: OrdinaryPlayerVoiceCard;
  selfHistory?: OrdinarySelfHistory;
  promptLines: string[];
};

export type LlmSpeechInput = {
  day: number;
  mySeatId: number;
  myRole: Role;
  persona?: AgentView["persona"];
  characterRole?: NonNullable<AgentView["roleCard"]>;
  characterLens?: ClassTrialCharacterLens;
  classTrialLiveState?: ClassTrialLiveState;
  personaStrategyCard?: AdaptedPersonaStrategyCard;
  ordinaryLiveIntent?: AiOrdinaryLiveIntentState;
  ordinarySpeechDirector?: OrdinarySpeechDirector;
  aliveSeats: ActionTarget[];
  tableBriefing: {
    text: string;
    speechProgress: {
      currentSpeaker: ActionTarget;
      spokenSeatIds: number[];
      unspokenSeatIds: number[];
      spokenCount: number;
      aliveCount: number;
    };
    publicBoundary: string[];
    privateBoundary: string[];
    publicFacts: string[];
    privateFacts: string[];
    unknowns: string[];
    legalSpeechFocus: string[];
    publicReasoningCues: string[];
  };
  publicContext: {
    rules: {
      sheriffEnabled: boolean;
      note: string;
      deathInfoNote: string;
      speechTimelineNote: string;
      unavailableTerms: string[];
    };
    recentSpeeches: AgentView["publicSummary"]["recentSpeeches"];
    voteSnapshot: AgentView["publicSummary"]["voteSnapshot"];
    recentDeaths: string[];
    claimBoard: AgentView["publicSummary"]["claimBoard"];
    speechOrder: {
      currentSpeaker: ActionTarget;
      todaySpeechOrder: ActionTarget[];
      currentSpeakerOrderIndex: number;
      speakersAlreadyFinished: ActionTarget[];
      currentDaySpokenSeats: ActionTarget[];
      currentDayUnspokenSeats: ActionTarget[];
    };
    tableMemory: Pick<
      TableMemory,
      | "day"
      | "claimBoard"
      | "stanceBoard"
      | "stanceShifts"
      | "seerLegacies"
      | "speechInfluence"
      | "reasoningCues"
      | "counterclaims"
      | "focus"
      | "voteHistory"
      | "deathAnnouncements"
      | "publicSignals"
    >;
  };
  privateContext: {
    role: Role;
    aiMemory?: AgentView["privateKnowledge"]["aiMemory"];
    seerChecks?: Array<{
      day: number;
      target: ActionTarget;
      result: ClaimCheck["result"];
    }>;
    witch?: {
      antidoteAvailable: boolean;
      poisonAvailable: boolean;
      currentVictim?: ActionTarget;
      savedTarget?: ActionTarget;
      poisonedTarget?: ActionTarget;
      antidoteUsedTonight?: boolean;
      poisonUsedTonight?: boolean;
    };
  };
  playerSpeechGuide: {
    style: string;
    modelStyle: string;
    constraints: string[];
    repairInstructions: string[];
  };
};
```

- [ ] **Step 2: Replace local type declarations with imports**

In `src/ai/speechProviders.ts`, remove the local exported type declarations for `OrdinarySpeechPressure`, `OrdinarySpeechMove`, `OrdinarySpeechDirector`, `OrdinaryPlayerVoiceCard`, `OrdinarySelfHistory`, and `LlmSpeechInput`. Keep `OrdinaryRepeatedPressureAxis` local because it is an internal implementation detail.

Add this import near the other local type imports:

```typescript
import type {
  LlmSpeechInput,
  OrdinaryPlayerVoiceCard,
  OrdinarySelfHistory,
  OrdinarySpeechDirector,
  OrdinarySpeechMove,
  OrdinarySpeechPressure,
} from "./speech/types";
```

- [ ] **Step 3: Run the focused speech tests**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets|ritualized previous speaker opening"
```

Expected: PASS. If TypeScript cannot find the new type module, fix import paths before changing runtime code.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 5: Commit only the type extraction if committing is requested**

Run only after confirming no unrelated files are staged:

```powershell
git add src/ai/speech/types.ts src/ai/speechProviders.ts
git diff --cached --check
git commit -m "refactor: extract AI speech provider types"
```

Expected: commit contains only the new type file and import/type removal from `speechProviders.ts`.

## Task 4: Decide The Next Extractable Runtime Boundary

**Files:**
- Modify: `docs/tasks/2026-06-ai-speech-layer-structure-migration.md`

- [ ] **Step 1: Inspect dependencies around ordinary director helpers**

Run:

```powershell
rg -n "function buildOrdinarySpeechDirector|function resolveOrdinarySpeechPressure|function buildOrdinaryDirectorTableObjects|function buildOrdinaryPlayerVoiceCard|function buildOrdinarySelfHistory|function formatOrdinarySpeechDirectorPromptLines|function seatText|function clipBriefingText|function currentDaySpeechItems|getCurrentDayDeathShape" src/ai/speechProviders.ts
```

Expected: output shows whether ordinary director helpers still depend heavily on local helpers such as `seatText`, `clipBriefingText`, `currentDaySpeechItems`, and death-shape helpers.

- [ ] **Step 2: Record the decision in the task card**

Add one of these decisions to `docs/tasks/2026-06-ai-speech-layer-structure-migration.md` under a new `## Next Runtime Boundary Decision` heading:

```markdown
## Next Runtime Boundary Decision

Decision: extract `src/ai/speech/ordinaryDirector.ts` next.

Reason: after type extraction, ordinary director helpers depend only on exported or easily movable pure helpers. The next task should move the ordinary director as a behavior-preserving extraction with focused speech-provider tests and `npx tsc --noEmit`.
```

or:

```markdown
## Next Runtime Boundary Decision

Decision: do not extract `ordinaryDirector.ts` yet.

Reason: ordinary director helpers still depend on local speech-provider helpers for seat formatting, clipping, current-day speech slices, death-shape interpretation, and plan-specific constraints. The next task should first extract shared helper utilities or keep runtime code in place.
```

- [ ] **Step 3: Re-run task-card validation**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md
```

Expected: PASS.

## Task 5: Final Verification And Handoff

**Files:**
- Read: `docs/tasks/2026-06-ai-speech-layer-structure-migration.md`
- Read: `docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md`

- [ ] **Step 1: Run docs checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md
git diff --check -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md src/ai/speechProviders.ts src/ai/speech/text.ts src/ai/speech/outputParsing.ts src/ai/speech/publicState.ts src/ai/speech/limits.ts src/ai/speech/speechContract.ts src/ai/speech/speechConstraints.ts src/ai/speech/rulesContext.ts src/ai/speech/speechOrder.ts src/ai/speech/stability.ts src/ai/speech/playerGuide.ts src/ai/speech/ordinaryDirectorHelpers.ts src/ai/speech/ordinarySurface.ts src/ai/speech/ordinaryRepair.ts src/ai/speech/blackCheckSurface.ts src/ai/speech/classTrialRepair.ts src/ai/speech/formatValidation.ts src/ai/speech/surface.ts src/ai/speech/validationErrors.ts
```

Expected: PASS, except repository-standard LF/CRLF warnings are acceptable if there are no whitespace error lines.

- [ ] **Step 2: Run structure audit if source files moved**

Run only after Task 3 or later source movement:

```powershell
npm run audit:structure
```

Expected: PASS. Record the line-count delta for `src/ai/speechProviders.ts` and the new `src/ai/speech/types.ts`.

- [ ] **Step 3: Handoff with exact ownership**

Use this handoff format:

```text
Completed:
- Created AI speech layer migration task/plan.
- If executed, extracted shared speech types into src/ai/speech/types.ts.
- If executed, extracted the follow-up helper seams listed in the Execution
  Status section, including black-check surface predicates.

Changed files:
- docs/tasks/2026-06-ai-speech-layer-structure-migration.md
- docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md
- src/ai/speech/*.ts helper modules, only if Task 3 or follow-up extractions
  were executed
- src/ai/speechProviders.ts, only if Task 3 or follow-up extractions were
  executed

Verification:
- npm run harness:task-card -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md
- git diff --check -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md src/ai/speechProviders.ts src/ai/speech/text.ts src/ai/speech/outputParsing.ts src/ai/speech/publicState.ts src/ai/speech/limits.ts src/ai/speech/speechContract.ts src/ai/speech/speechConstraints.ts src/ai/speech/rulesContext.ts src/ai/speech/speechOrder.ts src/ai/speech/stability.ts src/ai/speech/playerGuide.ts src/ai/speech/ordinaryDirectorHelpers.ts src/ai/speech/ordinarySurface.ts src/ai/speech/ordinaryRepair.ts src/ai/speech/blackCheckSurface.ts src/ai/speech/classTrialRepair.ts src/ai/speech/formatValidation.ts src/ai/speech/surface.ts src/ai/speech/validationErrors.ts
- focused/full speech tests and npx tsc --noEmit, only if Task 3 or follow-up
  source movement was executed

Remaining risks:
- Current 12p mechanics WIP must be settled before runtime movement.
- The first type extraction is behavior-preserving but does not reduce runtime complexity by itself.
- Moving ordinary director helpers should wait until their local helper dependencies are small enough to move cleanly.
```

## Self-Review

- Spec coverage: the plan implements the v0.1 design's Phase 0 and Phase 1 only, leaving prompt/render, validation, repair, fallback, and evaluation movement for separate tasks after the type seam exists.
- Red-flag scan: no empty or deferred tasks are present; every step has concrete commands or exact file content.
- Type consistency: `SpeechStrictness`, `LlmSpeechContract`,
  `OrdinarySpeechPressure`, `OrdinarySpeechMove`, `OrdinarySpeechDirector`,
  `OrdinaryPlayerVoiceCard`, `OrdinarySelfHistory`, and `LlmSpeechInput` match
  the current uncommitted speech-provider type names.

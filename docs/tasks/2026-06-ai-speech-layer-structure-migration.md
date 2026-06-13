# AI Speech Layer Structure Migration

## Task

Short name: ai-speech-layer-structure-migration

Goal: Turn `docs/superpowers/specs/2026-06-12-ai-speech-layer-structure-design.md`
into a safe migration path for the AI speech layer and execute the first
behavior-preserving type/model, text-helper, speech-context, and death-shape
public/private-briefing, claim-attribution, output-parsing, public-state,
limits, speech-contract, rules-context, speech-order, retry-stability, and
player-guide predicate/text-normalization, and ordinary-surface boundary
extractions, including ordinary ending and repair-string predicates, plus
class-trial black-check surface predicates and class-trial generated-speech
repair text normalization, plus plain speech format validation and generic
speech-surface helpers, generic sentence-like unit counting, and current-day
speech-status helpers, speech validation error classification, and seat-number
text parsing, plus ordinary director support helpers.
Speech constraint construction is also extracted as a pure prompt-contract
helper seam.

Why it matters: `src/ai/speechProviders.ts` now carries ordinary prompt
construction, class-trial prompt construction, provider orchestration,
validation, repair, fallback, mock speech, and evaluation-facing metadata in
one large file. The next maintainability gain should come from stable module
boundaries, not another broad prompt or regex pass.

## Task Gate

Task type: AI speech / structure planning / docs-first refactor preparation

Risk level: medium

Required verification tier:

- [x] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If yes, flow or URL: not applicable
- If skipped, reason: this task changes type boundaries only; it does not
  change UI behavior or require a browser/manual flow.

State updates required:

- [ ] `feature_list.json`
- [ ] `progress.md`
- [ ] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [x] Not needed because: the active 12p Mimo speech mechanics window already
  owns `progress.md`, `session-handoff.md`, and `long_running_tasks.json` in
  the current worktree. This task must not overwrite those files.

Skipped checks must record:

- Check skipped: full lint, full build, browser smoke, production checks
- Reason: the first implementation batches are behavior-preserving type,
  pure text-helper, read-only speech-context, and death-shape prompt/fallback
  text extractions plus public/private briefing, claim-attribution helper, and
  output-parsing, public-state, limits, speech-contract, rules-context,
  speech-order, retry-stability, player-guide predicate/text-normalization, and
  ordinary-surface/ending, ordinary-repair string, and black-check surface
  predicate plus class-trial repair text extractions covered by focused
  speech-provider tests, the full speech-provider test file, task-card
  validation, structure audit, and `npx tsc --noEmit --pretty false`, with
  plain speech format validation, generic speech-surface helpers, and
  sentence-like unit counting plus current-day speech-status helpers extracted
  as the next pure seams, with validation error classification extracted as a
  small follow-up seam, seat-number parsing moved to the text helper seam, and
  ordinary director support helpers extracted without moving the director flow.
  Speech constraint construction is extracted as a pure prompt-contract seam.
- Residual risk: the first code migration must re-read the final settled
  `speechProviders.ts` because the current worktree still has parallel WIP
  changes.

## Context To Read First

- `AGENTS.md`
- `README.md`
- `docs/harness-orientation.md`
- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/feature-registry.md`
- `docs/verification-matrix.md`
- `docs/superpowers/specs/2026-06-12-ai-speech-layer-structure-design.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`

## Allowed Scope

Files or directories the agent may edit in this task:

- `docs/tasks/2026-06-ai-speech-layer-structure-migration.md`
- `docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md`
- `docs/superpowers/specs/2026-06-12-ai-speech-layer-structure-design.md`
  if a contradiction is found during review
- `src/ai/speech/types.ts`
- `src/ai/speech/text.ts`
- `src/ai/speech/context.ts`
- `src/ai/speech/deathShape.ts`
- `src/ai/speech/briefing.ts`
- `src/ai/speech/privateBriefing.ts`
- `src/ai/speech/claimAttribution.ts`
- `src/ai/speech/outputParsing.ts`
- `src/ai/speech/publicState.ts`
- `src/ai/speech/limits.ts`
- `src/ai/speech/speechContract.ts`
- `src/ai/speech/speechConstraints.ts`
- `src/ai/speech/rulesContext.ts`
- `src/ai/speech/speechOrder.ts`
- `src/ai/speech/stability.ts`
- `src/ai/speech/playerGuide.ts`
- `src/ai/speech/ordinaryDirectorHelpers.ts`
- `src/ai/speech/ordinarySurface.ts`
- `src/ai/speech/ordinaryRepair.ts`
- `src/ai/speech/blackCheckSurface.ts`
- `src/ai/speech/classTrialRepair.ts`
- `src/ai/speech/formatValidation.ts`
- `src/ai/speech/surface.ts`
- `src/ai/speech/validationErrors.ts`
- `src/ai/speechProviders.ts`, limited to importing/re-exporting extracted
  speech types, importing extracted text/context/death-shape/briefing/private
  briefing/claim-attribution/output-parsing/public-state/limits/speech-contract
  /speech-constraints/rules-context/speech-order/retry-stability/player-guide
  /ordinary-surface/ordinary-director-helper/ordinary-repair/black-check
  surface/class-trial repair/format-validation/generic-surface
  /validation-error helpers, and removing the local duplicate declarations

Files or directories the agent should not edit in this task:

- `src/ai/speechProviders.test.ts`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`
- `.env`
- `.env.local`
- generated caches
- `tmp`
- unrelated modules

## Current Source Inventory

As of the current uncommitted 12p speech mechanics work, the ordinary speech
director has already introduced useful seams inside `src/ai/speechProviders.ts`:

- Types near the top of the file:
  - `OrdinarySpeechPressure`
  - `OrdinarySpeechMove`
  - `OrdinarySpeechDirector`
  - `OrdinaryRepeatedPressureAxis`
  - `OrdinaryPlayerVoiceCard`
  - `OrdinarySelfHistory`
  - `LlmSpeechInput`
- Input assembly:
  - `buildConstrainedSpeechInput`
  - `buildPlayerSpeechGuide`
  - `buildTableBriefing`
  - `buildSpeechOrderContext`
- Ordinary soft director:
  - `buildOrdinarySpeechDirector`
  - `resolveOrdinarySpeechPressure`
  - `buildOrdinaryDirectorTableObjects`
  - `detectOrdinaryRepeatedPressureAxis`
  - `buildOrdinaryAllowedSpeechMoves`
  - `buildOrdinaryPlayerVoiceCard`
  - `buildOrdinarySelfHistory`
  - `formatOrdinarySpeechDirectorPromptLines`
  - `collectOrdinaryRecentSurfaceMoves`
- Shared ordinary/class-trial prompt constraints:
  - `buildUniversalDeTemplateGuide`
  - `buildSpeechConstraints`
  - `buildSpeechInteractionConstraints`
- Runtime validation and repair:
  - `validateRenderedSpeech`
  - many `validateOrdinary*` and `validateClassTrial*` helpers
  - `repairClaimAttributionSpeech`
  - `repairGeneratedClassTrialSpeech`
  - `naturalizeOrdinarySpeechText`
  - `repairOrdinarySoftAcceptedSpeech`
- Fallback and mock speech:
  - `createLooseFallbackSpeech`
  - `buildOrdinaryUnderQuestionFallback`
  - `createClassTrialFallbackSpeech`
  - `createStructuredMockSpeech`
  - `createMockSpeech`

This confirms the first code migration should not begin with provider flow or
fallback movement. The lowest-risk first move is to extract shared type/model
boundaries and then re-run tests.

## First Migration Boundary

The first implementation batch should create a non-behavioral type/model seam:

- New target: `src/ai/speech/types.ts`
- Move only exported type aliases and simple type shapes from
  `src/ai/speechProviders.ts`.
- Keep runtime functions in `speechProviders.ts`.
- Do not move provider calls, validation chains, repair, fallback, or mock
  speech in the same batch.

After that passes, the next task can decide whether the ordinary director pure
helpers are ready for `src/ai/speech/ordinaryDirector.ts`.

## Next Runtime Boundary Decision

Decision: do not extract `ordinaryDirector.ts` yet.

Reason: after the first type extraction, the ordinary director helpers still
depend on local speech-provider helpers for current-day speech slices, death
shape interpretation, seat formatting, text clipping, seat lookup, and several
plan-specific constraints. The next runtime task should first isolate those
shared helper utilities or keep ordinary director runtime code in place. Moving
the director now would either drag too many helpers into the new module or
create a cross-module import tangle.

## Definition Of Done

This task is complete when:

- A migration task card exists with clear scope, non-goals, and verification.
- A plan exists under `docs/superpowers/plans/`.
- The plan treats current 12p mechanics WIP as a prerequisite rather than
  overwriting it.
- The first code migration target is small, testable, and behavior-preserving.
- Shared speech type aliases and input shapes are extracted to
  `src/ai/speech/types.ts`.
- `src/ai/speechProviders.ts` imports/re-exports those types while keeping
  runtime behavior local.
- Pure speech text helpers are extracted to `src/ai/speech/text.ts`.
- Read-only speech context helpers are extracted to `src/ai/speech/context.ts`.
- Death-shape prompt, briefing, boundary, and fallback text helpers are
  extracted to `src/ai/speech/deathShape.ts`.
- Public briefing line helpers are extracted to `src/ai/speech/briefing.ts`.
- Private briefing and private boundary helpers are extracted to
  `src/ai/speech/privateBriefing.ts`.
- Claim-attribution boundary/contract helpers and D1 class-trial black-check
  agenda lines are extracted to `src/ai/speech/claimAttribution.ts`.
- LLM speech output parsing is extracted to
  `src/ai/speech/outputParsing.ts`.
- Shared public table state readers for low-info D1 state and public seer
  check/black-check context are extracted to `src/ai/speech/publicState.ts`.
- Shared speech length constants are extracted to `src/ai/speech/limits.ts`.
- Speech contract construction, move resolution, speech limit resolution, and
  hard-info/low-info contract gates are extracted to
  `src/ai/speech/speechContract.ts`.
- Speech constraint construction is extracted to
  `src/ai/speech/speechConstraints.ts`.
- Public rules context construction is extracted to
  `src/ai/speech/rulesContext.ts`.
- Speech-order context, current-day order projection, and seat-order
  deduplication, current-day spoken-seat lookup, and plan target speech-status
  lookup are extracted to `src/ai/speech/speechOrder.ts`.
- Retry stability hint construction and LLM speech repair instructions are
  extracted to `src/ai/speech/stability.ts`.
- Player speech guide helper text for universal de-template guidance, ordinary
  player mouth guidance, model-style guidance, addressing, self-introduction
  boundaries, and public check result guidance is extracted to
  `src/ai/speech/playerGuide.ts`.
- Ordinary director support helpers for repeated quote collection, pressure
  labels, move labels, and ordinary director de-duplication are extracted to
  `src/ai/speech/ordinaryDirectorHelpers.ts`.
- Full-width digit normalization is extracted to `src/ai/speech/text.ts`, and
  ordinary low-info opening / repeated-pressure predicate helpers are extracted
  to `src/ai/speech/playerGuide.ts`.
- Terminal punctuation stripping is extracted to `src/ai/speech/text.ts`.
- Regex escaping is extracted to `src/ai/speech/text.ts`.
- Seat-number text parsing is extracted to `src/ai/speech/text.ts`.
- Ordinary surface/copy/card/handling predicates are extracted to
  `src/ai/speech/ordinarySurface.ts`.
- Ordinary final-landing, truncated-ending, and forward-commitment predicates
  are extracted to `src/ai/speech/ordinarySurface.ts`.
- Ordinary naturalization, duplicated-word repair, and forward-commitment
  trimming helpers are extracted to `src/ai/speech/ordinaryRepair.ts`.
- Class-trial seer black-check surface predicates for explicit target
  mentions, vote boundaries, reversal offers, observer-condition dilution, and
  first-check-motive detection, plus seer-attribution misread detection, are extracted to
  `src/ai/speech/blackCheckSurface.ts`.
- Class-trial generated-speech repair text normalization is extracted to
  `src/ai/speech/classTrialRepair.ts`.
- Plain speech Markdown-format and incomplete-question-fragment validation is
  extracted to `src/ai/speech/formatValidation.ts`.
- Generic sentence-like unit counting is extracted to
  `src/ai/speech/formatValidation.ts`.
- Generic speech surface helpers for out-of-game text, planned check cue
  coverage, and public seat/target mention detection are extracted to
  `src/ai/speech/surface.ts`.
- Speech validation error hard/soft classification is extracted to
  `src/ai/speech/validationErrors.ts`.
- The next runtime boundary decision is recorded.

## Verification

Required checks:

- Read back this task card.
- Read back `docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md`.
- `npm run harness:task-card -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md`
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets|ritualized previous speaker opening"`
- `npm run test -- src/ai/speechProviders.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run audit:structure`
- `git diff --check -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md src/ai/speechProviders.ts src/ai/speech/text.ts src/ai/speech/outputParsing.ts src/ai/speech/publicState.ts src/ai/speech/limits.ts src/ai/speech/speechContract.ts src/ai/speech/speechConstraints.ts src/ai/speech/rulesContext.ts src/ai/speech/speechOrder.ts src/ai/speech/stability.ts src/ai/speech/playerGuide.ts src/ai/speech/ordinaryDirectorHelpers.ts src/ai/speech/ordinarySurface.ts src/ai/speech/ordinaryRepair.ts src/ai/speech/blackCheckSurface.ts src/ai/speech/classTrialRepair.ts src/ai/speech/formatValidation.ts src/ai/speech/surface.ts src/ai/speech/validationErrors.ts`
- Direct trailing-whitespace scan for
  `docs/tasks/2026-06-ai-speech-layer-structure-migration.md`,
  `docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md`,
  `src/ai/speechProviders.ts`, `src/ai/speech/types.ts`,
  `src/ai/speech/text.ts`, `src/ai/speech/context.ts`, and
  `src/ai/speech/deathShape.ts`, `src/ai/speech/briefing.ts`, and
  `src/ai/speech/privateBriefing.ts`, and
  `src/ai/speech/claimAttribution.ts`, and
  `src/ai/speech/outputParsing.ts`, and
  `src/ai/speech/publicState.ts`, and `src/ai/speech/limits.ts`, and
  `src/ai/speech/speechContract.ts`,
  `src/ai/speech/speechConstraints.ts`, and `src/ai/speech/rulesContext.ts`,
  and `src/ai/speech/speechOrder.ts`, `src/ai/speech/stability.ts`,
  `src/ai/speech/playerGuide.ts`,
  `src/ai/speech/ordinaryDirectorHelpers.ts`,
  `src/ai/speech/ordinarySurface.ts`, and
  `src/ai/speech/ordinaryRepair.ts`, and
  `src/ai/speech/blackCheckSurface.ts`, and
  `src/ai/speech/classTrialRepair.ts`, and
  `src/ai/speech/formatValidation.ts`, and
  `src/ai/speech/surface.ts`, and
  `src/ai/speech/validationErrors.ts`

Optional deeper checks:

- `npm run audit:structure`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Created AI speech layer migration task/plan.
- Extracted shared speech provider types into src/ai/speech/types.ts.
- Extracted pure speech text helpers into src/ai/speech/text.ts.
- Extracted read-only speech context helpers into src/ai/speech/context.ts.
- Extracted death-shape prompt, briefing, boundary, and fallback text helpers
  into src/ai/speech/deathShape.ts.
- Extracted public briefing line helpers into src/ai/speech/briefing.ts.
- Extracted private briefing and private boundary helpers into
  src/ai/speech/privateBriefing.ts.
- Extracted claim-attribution boundary/contract helpers and D1 class-trial
  black-check agenda lines into src/ai/speech/claimAttribution.ts.
- Extracted LLM speech output parsing into src/ai/speech/outputParsing.ts.
- Extracted public table state readers into src/ai/speech/publicState.ts.
- Extracted speech length constants into src/ai/speech/limits.ts.
- Extracted speech contract construction, contract move resolution, speech
  limit resolution, and hard-info/low-info contract gates into
  src/ai/speech/speechContract.ts.
- Extracted speech constraint construction into
  src/ai/speech/speechConstraints.ts.
- Extracted public rules context construction into
  src/ai/speech/rulesContext.ts.
- Extracted speech-order context, current-day order projection, and seat-order
  deduplication into src/ai/speech/speechOrder.ts.
- Extracted current-day spoken-seat and plan target speech-status helpers into
  src/ai/speech/speechOrder.ts.
- Extracted retry stability hint construction and LLM speech repair
  instructions into src/ai/speech/stability.ts.
- Extracted player speech guide helper text into
  src/ai/speech/playerGuide.ts.
- Extracted ordinary director support helpers into
  src/ai/speech/ordinaryDirectorHelpers.ts.
- Extracted full-width digit normalization into src/ai/speech/text.ts, and
  ordinary low-info opening / repeated-pressure predicate helpers into
  src/ai/speech/playerGuide.ts.
- Extracted terminal punctuation stripping into src/ai/speech/text.ts.
- Extracted regex escaping into src/ai/speech/text.ts.
- Extracted seat-number text parsing into src/ai/speech/text.ts.
- Extracted ordinary surface/copy/card/handling predicates into
  src/ai/speech/ordinarySurface.ts.
- Extracted ordinary final-landing, truncated-ending, and forward-commitment
  predicates into src/ai/speech/ordinarySurface.ts.
- Extracted ordinary naturalization, duplicated-word repair, and
  forward-commitment trimming helpers into src/ai/speech/ordinaryRepair.ts.
- Extracted class-trial black-check surface predicates into
  src/ai/speech/blackCheckSurface.ts.
- Extended src/ai/speech/blackCheckSurface.ts with seer-attribution misread
  detection.
- Extracted class-trial generated-speech repair text normalization into
  src/ai/speech/classTrialRepair.ts.
- Extracted plain speech format validation into
  src/ai/speech/formatValidation.ts.
- Extracted generic speech surface helpers into src/ai/speech/surface.ts.
- Extracted generic sentence-like unit counting into
  src/ai/speech/formatValidation.ts.
- Extracted speech validation error hard/soft classification into
  src/ai/speech/validationErrors.ts.
- Updated src/ai/speechProviders.ts to import and re-export extracted types
  and import extracted text/context/death-shape/briefing/private-briefing
  claim-attribution, output-parsing, public-state, limits, speech-contract,
  speech-constraints, rules-context, speech-order, retry-stability, and
  player-guide helper/predicate functions plus ordinary-director support
  helpers, speech-order current-day status helpers, ordinary-surface/ending
  and ordinary-repair helpers plus black-check surface predicates and
  class-trial repair helpers plus format-validation, generic-surface,
  sentence-counting, validation-error, and seat-number text helpers while
  keeping runtime logic in place.
- Left post-speech challenge and black-check timeline fact helpers in
  src/ai/speechProviders.ts because they still share local validator
  dependencies.
- Recorded that ordinaryDirector.ts should not be extracted yet because helper
  dependencies are still too local to speechProviders.ts.

Changed files:
- docs/tasks/2026-06-ai-speech-layer-structure-migration.md
- docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md
- docs/superpowers/specs/2026-06-12-ai-speech-layer-structure-design.md
- src/ai/speech/types.ts
- src/ai/speech/text.ts
- src/ai/speech/context.ts
- src/ai/speech/deathShape.ts
- src/ai/speech/briefing.ts
- src/ai/speech/privateBriefing.ts
- src/ai/speech/claimAttribution.ts
- src/ai/speech/outputParsing.ts
- src/ai/speech/publicState.ts
- src/ai/speech/limits.ts
- src/ai/speech/speechContract.ts
- src/ai/speech/speechConstraints.ts
- src/ai/speech/rulesContext.ts
- src/ai/speech/speechOrder.ts
- src/ai/speech/stability.ts
- src/ai/speech/playerGuide.ts
- src/ai/speech/ordinaryDirectorHelpers.ts
- src/ai/speech/ordinarySurface.ts
- src/ai/speech/ordinaryRepair.ts
- src/ai/speech/blackCheckSurface.ts
- src/ai/speech/classTrialRepair.ts
- src/ai/speech/formatValidation.ts
- src/ai/speech/surface.ts
- src/ai/speech/validationErrors.ts
- src/ai/speechProviders.ts

Verification:
- PASS: `npm run harness:task-card -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md`
- PASS: `npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets|ritualized previous speaker opening"`; 5 passed, 307 skipped after the speech-constraints extraction batch
- PASS: `npm run test -- src/ai/speechProviders.test.ts`; 312 passed after the speech-constraints extraction batch
- PASS: `npx tsc --noEmit --pretty false` after the speech-constraints extraction batch
- PASS: `npm run audit:structure`; `src/ai/speechProviders.ts` is now 6854 lines and 296 functions, and the new `src/ai/speech/types.ts`, `src/ai/speech/text.ts`, `src/ai/speech/context.ts`, `src/ai/speech/deathShape.ts`, `src/ai/speech/briefing.ts`, `src/ai/speech/privateBriefing.ts`, `src/ai/speech/claimAttribution.ts`, `src/ai/speech/outputParsing.ts`, `src/ai/speech/publicState.ts`, `src/ai/speech/limits.ts`, `src/ai/speech/speechContract.ts`, `src/ai/speech/speechConstraints.ts`, `src/ai/speech/rulesContext.ts`, `src/ai/speech/speechOrder.ts`, `src/ai/speech/stability.ts`, `src/ai/speech/playerGuide.ts`, `src/ai/speech/ordinaryDirectorHelpers.ts`, `src/ai/speech/ordinarySurface.ts`, `src/ai/speech/ordinaryRepair.ts`, `src/ai/speech/blackCheckSurface.ts`, `src/ai/speech/classTrialRepair.ts`, `src/ai/speech/formatValidation.ts`, `src/ai/speech/surface.ts`, and `src/ai/speech/validationErrors.ts` seams are included in the scanned tree
- PASS: `git diff --check -- docs/tasks/2026-06-ai-speech-layer-structure-migration.md docs/superpowers/plans/2026-06-12-ai-speech-layer-structure-migration.md src/ai/speechProviders.ts src/ai/speech/text.ts src/ai/speech/outputParsing.ts src/ai/speech/publicState.ts src/ai/speech/limits.ts src/ai/speech/speechContract.ts src/ai/speech/speechConstraints.ts src/ai/speech/rulesContext.ts src/ai/speech/speechOrder.ts src/ai/speech/stability.ts src/ai/speech/playerGuide.ts src/ai/speech/ordinaryDirectorHelpers.ts src/ai/speech/ordinarySurface.ts src/ai/speech/ordinaryRepair.ts src/ai/speech/blackCheckSurface.ts src/ai/speech/classTrialRepair.ts src/ai/speech/formatValidation.ts src/ai/speech/surface.ts src/ai/speech/validationErrors.ts`; only LF/CRLF warning for `src/ai/speechProviders.ts`
- PASS: direct trailing-whitespace scan for touched docs/source files

Remaining risks:
- Current 12p mechanics WIP still owns progress.md, session-handoff.md,
  long_running_tasks.json, and speechProviders.test.ts in this worktree.
- These first extractions clarify ownership and remove local helper clutter,
  but ordinary director, validation, repair, fallback, and mock speech runtime
  code still remain in speechProviders.ts.
- Runtime movement beyond these helper/text seams should wait until shared
  utility dependencies are isolated or proven small enough to move cleanly.
```

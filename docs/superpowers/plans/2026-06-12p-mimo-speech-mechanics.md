# 12p Mimo Speech Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen ordinary Werewolf speech mechanics so 12-player Mimo games inherit player identity, private motivation, shared-pressure budget, and non-ritual opening variety before paid validation.

**Architecture:** Keep the work inside the existing ordinary speech director in `src/ai/speechProviders.ts`. The director already emits `playerVoiceCard`, `selfHistory`, `recentSurfaceMoves`, and allowed moves; this plan deepens those fields and prompt lines rather than adding a new subsystem.

**Tech Stack:** TypeScript, Vitest, existing `npm run llm:evaluate` and `npm run eval:ordinary-ai` CLI tooling.

---

## File Structure

- `src/ai/speechProviders.ts`: ordinary speech director, voice card, self-history, shared pressure, and prompt lines.
- `src/ai/speechProviders.test.ts`: focused red-green coverage for each mechanism.
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`: task gate and final handoff.
- `progress.md`, `session-handoff.md`, `long_running_tasks.json`: state updates after implementation and validation.

### Task 1: Player Identity Dispersion

**Files:**
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/speechProviders.ts`

- [x] **Step 1: Write the failing test**

Add a focused test proving `ordinarySpeechDirector.playerVoiceCard.promptLines` exposes explicit length lane, question tendency, filler/mouth habit, emotion amplitude, and risk posture.

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card"
```

Expected: FAIL because the director does not yet expose the full identity dispersion lines.

- [x] **Step 3: Implement minimal code**

Update `buildOrdinaryPlayerVoiceCard` to emit stable prompt lines such as:

```typescript
`发言长度档位：${lengthLane}。`
`提问倾向：${questionLane}。`
`口头填充：${fillerLane}。`
`情绪幅度：${emotionLane}。`
`默认风险姿态：${riskLane}。`
```

- [x] **Step 4: Run test to verify it passes**

Run the same focused command and confirm PASS.

### Task 2: Private Motivation And Self-History

**Files:**
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/speechProviders.ts`

- [x] **Step 1: Write the failing test**

Add a test proving D2+ prompt lines include prior stance/vote plus who recently questioned the current seat when those public speeches exist.

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ordinary self-history"
```

Expected: FAIL because `selfHistory` does not yet summarize incoming pressure as private motivation.

- [x] **Step 3: Implement minimal code**

Update `buildOrdinarySelfHistory` to scan recent public speeches for current-seat questioning and add one prompt line:

```typescript
`这轮我被${seatText(speaker)}点过：${clipBriefingText(message, 72)}`
```

Keep it optional and bounded to one or two lines.

- [x] **Step 4: Run test to verify it passes**

Run the same focused command and confirm PASS.

### Task 3: Shared Pressure Budget

**Files:**
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/speechProviders.ts`

- [x] **Step 1: Write the failing test**

Add a test proving two prior speakers on the same target produce a stronger `recentSurfaceMoves`/prompt line and remove `followPressure`, `quoteOneLine`, and `halfAccept` from allowed moves for later speakers.

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "over-cited shared pressure targets"
```

Expected: FAIL if the prompt still treats the third speaker as a normal response.

- [x] **Step 3: Implement minimal code**

Keep the threshold at two speakers and make the prompt explicit:

```typescript
"共享压力预算已用完：后续座位不要继续追同一个人同一个点。"
```

Ensure allowed moves shift to `hold`, `waterPass`, `voteBoundary`, or `changeRead`.

- [x] **Step 4: Run test to verify it passes**

Run the same focused command and confirm PASS.

### Task 4: Non-Ritual Opening Variety

**Files:**
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/speechProviders.ts`

- [x] **Step 1: Write the failing test**

Add a test proving repeated previous-speaker pickup surfaces add prompt guidance that allows direct rebuttal, ignoring the previous speaker, short water-pass, defense, or target shift.

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ritualized previous speaker opening"
```

Expected: FAIL because the prompt does not yet name the allowed non-ritual openings.

- [x] **Step 3: Implement minimal code**

Update `formatOrdinarySpeechDirectorPromptLines` so repeated pickup surfaces add:

```typescript
"承接不是礼仪：可以直接反驳、可以不点上一位、可以短水、可以护人、可以换目标。"
```

- [x] **Step 4: Run test to verify it passes**

Run the same focused command and confirm PASS.

### Task 5: Validation And 12p Mimo Sample

**Files:**
- Modify: `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `long_running_tasks.json`

- [x] **Step 1: Run focused and broad local checks**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts
npm run test -- src/ai/llmEvaluation.test.ts
npx tsc --noEmit --pretty false
npm run lint
```

- [x] **Step 2: Run harness checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md
npm run harness:long-tasks
```

- [ ] **Step 3: Run paid 12p Mimo validation if a temporary key is available**

Skipped in this session: current process/user/machine env did not contain usable Mimo or generic LLM provider variables. Do not persist keys; rerun with temporary process env.

Run:

```powershell
npm run llm:evaluate -- --models=mimo-v2.5-pro --base-url=$env:MIMO_LLM_BASE_URL --lineup-count=12 --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=260 --max-llm-calls=90 --real-phases=SHERIFF_NOMINATION,SHERIFF_SPEECH,SHERIFF_VOTE,SHERIFF_PK_SPEECH,SHERIFF_PK_VOTE,DAY_SPEECH,DAY_VOTE --json --out=tmp/12p-mimo-speech-mechanics-report.json --eval-cases-out=tmp/12p-mimo-speech-mechanics-cases.json
```

Then run:

```powershell
npm run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-speech-mechanics-cases.json --json --out=tmp/12p-mimo-speech-mechanics-eval.json
```

- [x] **Step 4: Record evidence and risks**

Update task/handoff files with whether paid validation ran, fallback/error counts, sample metrics, and the remaining human-read risks.

### Task 6: Fable5 Follow-up Narrow Fixes

**Files:**
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`
- Modify: `src/ai/actionProviders.ts`
- Modify: `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- Modify: `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `long_running_tasks.json`

- [x] **Step 1: Write failing tests for the review findings**

Add focused tests proving public role-claim handling has multiple ordinary
player moves, stale self-history targets are downgraded, public-check fallback
bridge text is not reused whole-game, and sheriff speech candidates no longer
use the fixed campaign line.

- [x] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "public-role claim handling|stale ordinary self-history|public-claim fallback bridge"
npm run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates"
```

Expected: FAIL before implementation for the four uncovered paths.

- [x] **Step 3: Implement minimal code**

Update the ordinary speech director and fallback path so public role claims can
choose among role handling, vote boundary, hold, water-pass, changed read, or
discomfort. Update sheriff action candidate generation to use ordinary-player
persona texture, and downgrade dead remembered targets into old context.

- [x] **Step 4: Run focused and provider checks**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "public-role claim handling|stale ordinary self-history|public-claim fallback bridge"
npm run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates"
npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
npx tsc --noEmit --pretty false
npm run lint
```

- [x] **Step 5: Rerun bounded 12p sample**

Ran two bounded 72-call live Mimo samples with the temporary provider key
supplied only through the safe PowerShell prompt.

- First post-Fable rerun: `tmp/12p-mimo-speech-mechanics-post-fable-live-report.json`
  / `-cases.json` / `-eval.json`; 72 calls, fallback 12, error 12,
  validation failures 9.
- Name-suffix action-validation fix: exact player names such as `DeepSeek2`
  now resolve before numeric extraction when validating public-check
  attribution.
- Second post-Fable rerun: `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-report.json`
  / `-cases.json` / `-eval.json`; 72 calls, fallback 6, error 6,
  validation failures 2.
- Added a speech-provider regression for adjacent duplicate sheriff claim
  sentences. It passes on the current normalization path.

Do not spend more paid calls immediately. The next step is local narrowing of
remaining speech fallback/provider stability and sheriff-standard quote
propagation, then one final bounded rerun if needed.

### Task 7: Remaining 12p Acceptance Narrowing

**Files:**
- Modify as needed: `src/ai/speechProviders.ts`
- Modify as needed: `src/ai/speechProviders.test.ts`
- Modify as needed: `src/ai/actionProviders.ts`
- Modify as needed: `src/ai/actionProviders.test.ts`
- Modify: docs/state files listed above

- [x] **Step 1: Reduce remaining speech fallback/provider instability locally**

Inspect the 4 speech fallback rows from the second post-Fable rerun and decide
whether the cause is provider request failure, validation rejection, or prompt
contract mismatch before changing code.

Result: no new paid calls were used. Remaining speech fallbacks split between
provider fetch failures and validator overreach. The current local fixes exact
match full player names before digit extraction in speech public-check
validation, and allow generic `没人对跳/看有没有对跳` counterclaim-status wording
after a public Seer check.

- [x] **Step 2: Reduce sheriff-standard quote propagation**

The second rerun repeats `警徽要给能听完对跳还能把票口说清的人` in 4/34
speech-like rows. Prefer a prompt/context or sample-metric repair that tells
later seats to paraphrase or react after a full sheriff-standard quote has
already been cited, not a banned phrase.

Result: repeated full quotes are detected from recent speeches and surfaced as
`整句引用重复`; the ordinary director then removes `quoteOneLine` and prompts
later seats to paraphrase, react, or choose another handling action instead of
copying the same sentence.

- [x] **Step 3: Final bounded 12p acceptance rerun**

Only after local fixes pass, run one final bounded 12p Mimo sample with the same
seed and intended envelope. Acceptance remains: sheriff speech variety, at
least three post-check response actions, and fallback rate near 1-2/30 or lower.

Result: ran `tmp/12p-mimo-speech-mechanics-post-localfix-live-report.json` /
`-cases.json` / `-eval.json`. The sample improved to 72 calls, fallback 4,
error 4, validation failures 1, and local eval averageScore 97.5. This is the
best 12p read so far, but it exposed a hard action-boundary defect: public
action reasons could leak the actor's own hidden role or night action.

### Task 8: Public Action Private-Leak Guard

**Files:**
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`
- Modify: docs/state files listed above

- [x] **Step 1: Add focused regression coverage**

Cover public action reasons that say `我作为女巫...` or `我首夜救了...`, while
still allowing references to another seat's public Witch claim.

- [x] **Step 2: Add prompt and validation guard**

Public action phases now tell the model to use only public table evidence, and
`validateActionDecision` rejects own private role/night-action leaks. The repair
path can replace a private self-leaking reason with a public candidate hint.

- [x] **Step 3: Post-guard paid rerun**

Ran `tmp/12p-mimo-speech-mechanics-post-private-guard-live-report.json` /
`-cases.json` / `-eval.json` as a 50-call bounded same-seed sample. The
original hard Witch/night-action leak did not recur, and there were no
`公开行动理由泄露私有身份或夜晚信息` hits. The sample was still not clean because
fallback remained 7/50, clustered in D1 `DAY_SPEECH`, mainly from repeated
`D1首验理由不是主要攻击点` retry failures.

### Task 9: Post-Private-Guard Retry And Final Gate

**Files:**
- Modify: `src/ai/speech/stability.ts`
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`
- Modify: docs/state files listed above

- [x] **Step 1: Add ordinary retry guidance for D1 first-check motive failures**

Added a focused red-green test and ordinary retry instructions that rewrite
`D1首验理由不是主要攻击点` failures toward checked-seat response, counterclaim
status, rescue/follow pressure, or vote treatment instead of first-check motive.

- [x] **Step 2: Rerun final bounded same-seed 12p sample**

Ran `tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json` /
`-cases.json` / `-eval.json` as a 50-call bounded sample. The JSON outputs are
complete; the runner status file says `failed` only because the final status
write raced with local polling.

Result:

- Total calls: 50
- Fallback count: 1
- Error count: 1
- Validation failure count: 0
- Local eval averageScore: 98.2
- High-risk cases: 0

- [x] **Step 3: Close the last local action-label boundary**

The final sample had one public action reason using `我作为闭眼位`. Added local
coverage and validation for `闭眼位/闭眼好人` alongside `闭眼平民/平民/民牌/村民`.
No further paid rerun is planned by default.

## Self-Review

- Spec coverage: the plan covers player identity, private motivation, shared pressure, non-ritual openings, and 12p validation.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: all planned changes use existing ordinary speech/action provider concepts and existing CLI flags.

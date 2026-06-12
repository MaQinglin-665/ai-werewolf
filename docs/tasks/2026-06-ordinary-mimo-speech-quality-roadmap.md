# Ordinary Mimo Speech Quality Roadmap

Status: running

## Task

Short name: ordinary-mimo-speech-quality-roadmap

Goal: Make ordinary Werewolf real-LLM speech good enough for user-reviewed play, starting with Mimo invocation reliability, then ordinary speech quality, and only later token-cost reduction.

Why it matters: Current ordinary AI speech has improved, but the main user-visible gap is still player feel: avoid audit-template phrasing, speak from the seat's own public perspective, and keep fallback from polluting later turns. Token reduction is important, but it should not be optimized before the baseline speech/action quality is accepted.

## Task Gate

Task type: AI speech / provider diagnostics / quality iteration

Risk level: medium

Required verification tier:

- [x] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no for provider diagnostics; yes if a later UI-visible flow changes.
- If yes, flow or URL: ordinary local game or generated transcript review.
- If skipped, reason: current work is CLI/provider/prompt quality first.

State updates required:

- [ ] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [x] `long_running_tasks.json`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: promptfoo live judge, production checks, and a second full-game Mimo rerun after the v14/v15 focused fixes.
- Reason: real provider calls cost money and depend on external account state; production is not in scope.
- Residual risk: local tests plus v14 full-game evidence and v15 bounded confirmation prove the fixed paths better than a short mock sample, but subjective real-Mimo speech quality still needs reviewed transcripts.

## Context To Read First

- `AGENTS.md`
- `README.md`
- `docs/harness-orientation.md`
- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/feature-registry.md`
- `docs/tasks/2026-06-ordinary-ai-evaluation.md`
- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

## Current Evidence

- Ordinary research report exists at `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- Ordinary evaluation tooling exists at `docs/tasks/2026-06-ordinary-ai-evaluation.md`.
- Latest code work narrowed ordinary prompt/fallback/validator template pollution in `src/ai/speechProviders.ts` and `src/ai/speechProviders.test.ts`.
- Latest Token Plan API and project-level probes showed the current temporary route works: direct provider request returned HTTP 200, and a 1-call `llm:evaluate` preflight returned `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`. The earlier HTTP 403 quota note is obsolete for the current key/base URL state.
- Token-cost estimate is roughly 220k-350k tokens per medium/long ordinary game, but token reduction is intentionally deferred until speech/action quality is accepted.

### 2026-06-11 Phase 2 Direction: Positive Context Supply v22

- User accepted the external review direction: the next ordinary-speech stage should stop expanding surface-word cleanup as the default response and shift effort into positive context supply.
- Stage principle:
  - Freeze new broad ordinary soft-word validators unless the issue is a hard rule, public-information, role-claim, death-state, private-info, truncation, or clear repeated-mechanical shape.
  - Prefer context/prompt/candidate-action changes for player-feel issues.
  - Treat local evaluator score as regression evidence, not as a final quality score; live/bounded transcript review plus user read remains the subjective gate.
- First implementation slice:
  - `ordinarySpeechDirector` now carries `playerVoiceCard`: a stable mini-biography derived from the existing ordinary player profile, including traits, mouth habit, emotion/defense tell, and risk habit. This gives LLMs positive per-seat material without forcing a script.
  - `ordinarySpeechDirector` now carries `selfHistory`: the speaker's prior public speech, last speech target/stance, last vote target/reason, and a prompt note that continuing or changing course must be first-person and publicly explainable.
  - Repeated surface moves now influence allowed action candidates. When recent ordinary speeches repeat pickup/quote surfaces such as `接上一位/我听到了`, the director removes `quoteOneLine`/`halfAccept` from the next ordinary candidate set and pushes moves such as discomfort, hold, or voteBoundary instead.
- Verification:
  - RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history"` failed first because the soft director had no player mini-bio/self-history fields, then passed after the context supply implementation.
  - RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "repeated previous-seat pickup rhythm"` failed first because `quoteOneLine` stayed in the candidate set, then passed after repeated surfaces changed candidate actions.
  - `npm run test -- src/ai/speechProviders.test.ts` passed 1 file / 290 tests.
  - `node scripts/evaluate-llm-game.mjs --provider=mock --allow-mock --board=9p-seer-witch-hunter --human=none --games=1 --max-llm-calls=14 --json` was run through an in-memory PowerShell summary: 14 calls, 9 speech, 5 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, `totalQualityIssues 0`.
- Next action: broaden locally with related AI tests and TypeScript, then use a bounded mock transcript or an explicitly approved small live Mimo sample to read whether seat voices feel more differentiated. Do not start token reduction.
- Readback note: the mock transcript is structurally clean but still repeats some local mock phrasing like `刚才给了一个方向，我会拿后面的票和回应对照`; treat that as future player-mouth polish, not as proof that live Mimo quality is accepted.

### 2026-06-11 Phase 2 Reporting: Sample-level Evaluation Metrics v23

- Added report-only sample metrics to the ordinary evaluator so it can see table-wide problems that per-case regex scoring misses.
- New `summary.sampleMetrics` signals:
  - `repeated_surface_phrase`: repeated player-mouth surfaces across multiple seats, including the known local mock phrase `刚才给了一个方向`.
  - `seat_voice_similarity`: high cross-seat sentence skeleton similarity in a 6+ speech sample.
  - `action_distribution_skew`: most seats selecting the same coarse speech move such as `quoteOrCarry`.
  - `positive_signal_coverage`: no weak-but-human, grounded emotion, defensive motive, or public role-action positive signals in a larger speech sample.
- Important boundary:
  - These metrics do not change `score`, `issueCount`, `highRiskCaseIds`, validator behavior, retry, or fallback.
  - Their purpose is to guide the next context/prompt/candidate-action pass and to keep future threads from treating a high local score as real subjective quality proof.
- Report output:
  - JSON reports include `summary.sampleMetrics`.
  - Markdown reports now include a `Sample Metrics` section between Summary and Cases.
- Local mock smoke after this change:
  - `node scripts/eval-ordinary-ai.mjs --source=mock --games=1 --seed-start=91 --max-cases=20 --json` reported 20 cases, averageScore 98, issueCount 2, and 2 sample metrics: `repeated_surface_phrase` value `4/9`, `action_distribution_skew` value `0.78`.
- Verification:
  - RED/GREEN: `npm run test -- src/ai/llmEvaluation.test.ts -t "sample-level"` failed first because `summary.sampleMetrics` was missing, then passed.
  - RED/GREEN: `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` failed first because Markdown did not print sample metrics, then passed.
  - `npm run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts` passed 2 files / 28 tests.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts` passed 6 files / 391 tests.
  - `npx tsc --noEmit --pretty false` passed.
- Next action: use `sampleMetrics` on the next bounded mock/live transcript to choose positive-context fixes. Do not expand soft validators unless the defect is a rule/public-info/private-info/role/death/truncation correctness issue.

### 2026-06-11 Local Action-text And Speech-rhythm Polish

- Continued after v14/v15 without another paid Mimo run.
- Fixed action hint/player labels: speech-vote continuity and target-bound action hints now use `N号Name` instead of `N#Name`.
- Fixed Seer night-action target mismatch locally:
  - `seerCheck` candidates now include the selected target in their reason hint.
  - direct validation rejects seer-check reasons that explicitly name a different checked target.
  - routed action output repairs that mismatch by replacing the bad model reason with the selected candidate hint, reducing avoidable fallback.
- Added soft speech-rhythm guidance: repeated recent surfaces like `我先接上一位 / 这个判断我听到了 / 我听进去了` are collected as `接上一位/我听到了`, so the next ordinary speaker is guided to change player action instead of only changing wording.
- Verification:
  - `npm run test -- src/ai/actionProviders.test.ts -t "seat labels|seer-check reasons|speech-vote continuity hint"` failed first, then passed.
  - `npm run test -- src/ai/actionProviders.test.ts -t "seat labels|seer-check reasons|repairs a seer-check reason|speech-vote continuity hint"` passed 4 focused tests.
  - `npm run test -- src/ai/speechProviders.test.ts -t "repeated previous-seat pickup rhythm"` failed first, then passed.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` passed 2 files / 328 tests.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 382 tests.
  - `npx tsc --noEmit --pretty false` passed.
- Remaining risk: no fresh paid Mimo transcript was run after this local polish. Speech rhythm remains a soft prompt/context issue and needs the next transcript review.

### 2026-06-11 Local Mock/Fallback Text Cleanup And v20 Dry Run

- Continued locally after the earlier v16-v19 dry-run checks without another paid Mimo call.
- Cleaned mock/fallback action surfaces:
  - first-night mock night actions now say `第一夜还没有白天信息...`.
  - later mock night reasons no longer use `当前可信度较高`, `稳定发言位`, `当前焦点，查验收益最高`, or `身份空间`.
- Cleaned ordinary first-seat mock/fallback speech:
  - no `tableTask` echo such as `首置位前面没人可接...不要展开药线...交投票方向`.
  - no invented pressure on unspoken later seats.
  - no `刚才那句最卡` when there is no front speech.
  - no generic `等后置位把过程补出来`; no-target fallback now uses `先不压票，听一圈再看谁急着带节奏`.
- Naturalized public claim audit wording from `身份空间 / 公开处理方向和边界` to `这个身份先认下来，但今天票准备往哪放要说清`.
- Local bounded confirmation:
  - `tmp/ordinary-mimo-v20-local-polish-dryrun-20260611-0827.json`
  - `tmp/ordinary-mimo-v20-local-polish-dryrun-20260611-0827-cases.json`
  - `tmp/ordinary-mimo-v20-local-polish-mock-eval-20260611-0827.json`
- v20 dry run: 25 mock calls, 10 speech / 15 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`; bad-pattern grep for the cleaned surfaces had 0 hits.
- v20 local eval: 42 cases, averageScore 92.0, issueCount 16, highRiskCaseIds empty; remaining issue mix is mostly `speech_vote_discontinuity`, so local vote-reason continuity is the next non-paid polish target if needed.
- Verification:
  - `npm run test -- src/ai/speechProviders.test.ts -t "ordinary first-seat mock speech|unspoken target"` passed 4 focused tests.
  - `npm run test -- src/ai/actionProviders.test.ts -t "mock first-night|first-night action reasons"` passed 2 focused tests.
  - `npm run test -- src/ai/tableRead.test.ts -t "day-one speech|single death"` passed 2 focused tests.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 384 tests.
  - `npx tsc --noEmit --pretty false` passed.
- Remaining risk: this is local mock/fallback evidence only; no fresh paid live Mimo transcript was run after this cleanup.

### 2026-06-11 Local Vote-continuity And Mock Speech Polish v21d

- Continued locally from v20 without another paid Mimo call.
- Fixed mock/fallback day-vote speech-to-vote continuity:
  - same target: vote reason now says the previous speech pressure is still unresolved;
  - changed target: vote reason now explains the turn from the previous speech target to the current harder public reason.
- Reused the continuity naturalizer in `createMockCommand`, so manually supplied or fallback `votePlan` paths cannot bypass the same natural wording.
- Softened remaining player-visible mock text:
  - wolf team vote reasons no longer use `公开焦点 / 按这条线归票`;
  - mock speech table-audit line no longer says `当前焦点是...`;
  - mock evidence merge no longer says `我接的公开点是` or `我接到的是...`.
- Local evidence:
  - `tmp/ordinary-mimo-v21d-local-vote-continuity-mock-eval-20260611-1025.json`: 42 cases, averageScore 98.3, issueCount 4, `speech_vote_discontinuity` 0, highRiskCaseIds empty.
  - `tmp/ordinary-mimo-v21d-local-vote-continuity-dryrun-20260611-1026.json`: 25 calls, 12 speech / 13 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, `totalQualityIssues 0`.
  - `tmp/ordinary-mimo-v21d-local-vote-continuity-dryrun-20260611-1026-cases.json`.
- Verification:
  - `npm run test -- src/ai/actionProviders.test.ts -t "mock vote reasons continuous|mock vote pivots|speech-vote continuity"` passed 6 focused tests.
  - `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed 2 files / 332 tests after final speech merge polish.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/seatMemory.test.ts` passed 5 files / 386 tests.
  - `npx tsc --noEmit --pretty false` passed.
- Remaining risk: v21d is local mock/fallback evidence, not fresh live Mimo proof. Remaining local eval markers are three `no_concrete_progression` warnings and one `ordinary_jargon_stack` warning; the first-seat low-information warning may be acceptable human water speech.

### 2026-06-11 v14 Full-game Simulation And Focused Fixes

- Ran a full 9-player all-AI ordinary Mimo game:
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235.json`
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235-cases.json`
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235-eval.json`
- v14 result: one completed game, wolves won on Day 4 by eliminating all gods. It made 55 LLM calls: 20 speech and 35 action. `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`. Local eval averageScore 97.5, issueCount 8, highRiskCaseIds empty.
- Manual review identified the useful fix targets:
  - Day 1 first seat prematurely pressured unspoken 3号 via `3号GPT，我先记你一笔`.
  - first-night action reasons invented public discussion/focus/pressure/speech-position information before any day speech existed.
  - vote/action continuity merge could splice dangling reason fragments or orphan target digits into the final reason.
- Implemented focused fixes:
  - unspoken-seat validation now catches target-bound `记你一笔 / 先盯` future-seat pressure.
  - first-night action prompts and validation now state that there is no day speech yet and reject invented public discussion, focus, pressure, vote shape, or speech-position cues.
  - action continuity merge now drops dangling bases and orphan digits, preferring the clean continuity hint when needed.
- Ran post-fix bounded live confirmation:
  - `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920.json`
  - `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920-cases.json`
  - `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920-eval.json`
- v15 bounded result: 15 calls, 9 speech / 6 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`. Local eval averageScore 98.7, issueCount 1, highRiskCaseIds empty.
- v15 confirmed the first-seat opener no longer pre-points 3号 and the first wolf-kill reason stays on first-night low-information rationale.
- Remaining risk: v15 exposed one first-night `seerCheck` mixed contradiction before the final validator tightening; local tests now cover it, but no second paid live rerun was made after that final tightening. Other known follow-ups are late-night seer-check reason mismatch, `#` seat labels in action continuity hints, and repeated `我先接上一位` rhythm.
- Verification:
  - `npm run test -- src/ai/speechProviders.test.ts -t "first-seat future audit hooks"` failed first, then passed.
  - `npm run test -- src/ai/actionProviders.test.ts -t "first-night action reasons|dangling vote reason|orphan target digits"` failed first, then passed.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` passed 324 tests.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 378 tests.
  - `npx tsc --noEmit --pretty false` passed.

### 2026-06-11 Valid-key Bounded Mimo Landing Pass

- User provided a fresh temporary Token Plan key. It was used only through process env and was not written to `.env`, source, docs, reports, or provider config.
- Bounded valid-key evidence:
  - v08 `tmp/ordinary-mimo-v08-validkey-small-20260610-2345.json` / `-cases.json`: 15 calls, 9 speech, 6 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`; local eval averageScore 97.9. Manual review still saw repeated/unfinished landing around 4/5 and 6/7/8.
  - v09 `tmp/ordinary-mimo-v09-validkey-landing-20260610-2353.json` / `-cases.json`: 15 calls, 0 fallback, 0 error; exposed `我想顺着往回多看一步`.
  - v10 `tmp/ordinary-mimo-v10-validkey-landing-20260611-0000.json` / `-cases.json`: 15 calls, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 1`; exposed first-seat fallback quoting an unspoken 2号.
  - v11 `tmp/ordinary-mimo-v11-validkey-landing-20260611-0006.json` / `-cases.json`: 15 calls, `fallbackCount 2`, `errorCount 2`, mostly provider/fetch failures; exposed accepted text ending at `能撑住的只有`.
  - v12 `tmp/ordinary-mimo-v12-validkey-short-20260611-0015.json` / `-cases.json`: 12 calls, 9 speech, 3 action, `fallbackCount 1`, `errorCount 1`; exposed `转一下视线`, `原话我再过一遍`, ordinary Day 1 first-check motive attack, and planned seer identity repair.
  - v13 `tmp/ordinary-mimo-v13-speech-only-20260611-0027.json` / `-cases.json`: 9 real speech calls, 0 real action calls, `fallbackCount 2`, `errorCount 2`; this was Day 2 because speech-only real phases let mock actions advance the game, so it is not a clean D1 acceptance sample.
- Code direction followed the user's constraint: prefer prompt/context/evaluator/soft retry for player-feel issues; keep hard fallback for rule/public-info/private-info problems.
- Implemented fixes:
  - ordinary carry-over guidance now says to quote at most one prior line and land the speaker's first-person handling action.
  - recap-without-landing / unfinished endings are soft retry targets, including `多看一步`, `转一下视线`, `原话我再过一遍`, `能撑住的只有`, `背后藏着一个前提`, and `我记到现在`.
  - first-seat ordinary fallback no longer quotes unspoken later seats as `刚才那句`.
  - ordinary planned seer claims now explicitly say `我是预言家` for gold/black-check contracts and repair.
  - Day 1 first-check motive attacks now apply to ordinary mode, and black-check target attribution repair strips leftover `首验心路太薄` residue.
- Verification:
  - `npm run test -- src/ai/speechProviders.test.ts -t "rejects ordinary speeches that end with a cut-off seat reference"` passed.
  - `npm run test -- src/ai/speechProviders.test.ts -t "repairs a black-check target being called seer|rejects ordinary speeches that end with a cut-off seat reference|first-check motive|first-seat ordinary witch fallback|planned seer"` passed.
  - `npm run test -- src/ai/speechProviders.test.ts` passed 286 tests.
  - `npx tsc --noEmit --pretty false` passed.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 375 tests.
  - `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` passed, with only LF/CRLF warnings from diff check.
- Remaining risk: latest fixes after v13 are locally verified but not followed by another paid live transcript; live Mimo still has transient provider `fetch failed` rows; next quality gate should be a full 9-player simulation only if the user accepts provider spend. Token reduction remains deferred.

### 2026-06-10 Full 9p Simulation And Post-fix Confirmation

- Ran a full 9-player all-AI ordinary Mimo game on `9p-seer-witch-hunter`:
  - `tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034.json`
  - `tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034-cases.json`
- Result: one completed game, wolves won on Day 4 by eliminating all gods. The run made 56 LLM calls: 21 speech calls and 35 action calls. `fallbackCount` was 5, and all 5 were action/provider-error vote-continuity fallbacks, not speech fallback.
- Fixes from the full-game review:
  - `scripts/evaluate-llm-game.mjs` now treats `--human=none|null|all-ai|all_ai` as a true all-AI lineup.
  - ordinary speech validation no longer rejects later public deaths because Day 1 was peaceful.
  - previous-day seer-claim references such as `8号Kimi跳预言家发查杀` no longer misattribute the checked target as the seer.
  - ordinary named-focus lines must land a judgment or handling action instead of ending at the named seat.
  - provider-error fallback wording avoids the repetitive `我先只接一层 / 票先不压太死 / 先不站死` family.
  - action reasons clip at complete sentences or clean clauses, preserve target-change continuity, and accept natural continuity wording.
  - local evaluator accepts true-Witch self-reveal formats such as `我是2号，女巫...` and `我底牌是女巫...` while preserving hidden-info failures for non-Witch speakers.
- Post-fix bounded live confirmation:
  - `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052.json`
  - `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052-cases.json`
  - `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052-eval-after-evaluator-fix.json`
- Result: 25 LLM calls through Day 1 speech/vote and into Day 2 night start; `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`. Local eval averageScore 97.4, issueCount 3, and no high-risk cases.
- Manual inspection of the v06 text still found one natural-but-unfinished quality issue: 5号 quoted 1号 and ended at `这句话我现在越想越不对。` without saying how it would handle 1号. This is now covered as a soft unfinished-speech repair trigger; the same shape passes if it lands a current handling action after `所以我这轮...`.
- Current next action: user subjective review of the full-game and bounded-confirmation text. If quality issues remain, keep tuning prompt/context/evaluator or narrow public-info rules; do not convert ordinary player-feel issues into hard fallback unless they are rule/public-info unsafe.

### 2026-06-10 User-approved Review-register Cleanup

- User reviewed the surfaced v05/v06 excerpts and agreed with the diagnosis that several lines still sounded like review/register writing instead of ordinary table speech:
  - `身份空间`
  - `发言缺口`
  - `怎么用这个信息`
  - formulaic `起票 / 补票 / 最后跟票`
- Implemented the fix without converting these into broad hard fallback rules:
  - prompt avoid-lines now explicitly steer the model toward player-mouth alternatives.
  - accepted ordinary LLM speech is safely naturalized before validation when it uses those terms.
  - local validation and local eval can still flag raw review-register wording as soft quality/jargon evidence.
- Natural target wording now prefers:
  - `我先当这个身份听 / 这个身份我先认下来`
  - `哪里没说清`
  - `票准备往哪放`
  - `谁先把票带起来 / 谁顺着跟上`
- Verification:
  - `npm run test -- src/ai/speechProviders.test.ts -t "visible player-jargon|review-register"` failed first, then passed.
  - `npm run test -- src/ai/llmEvaluation.test.ts -t "player-jargon"` failed first, then passed.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 343 tests.
  - `npx tsc --noEmit --pretty false` passed.
  - Re-eval v06: `tmp/ordinary-mimo-v06-d1vote-after-review-register-fix-20260610-eval.json`, averageScore 97.0, issueCount 4, no high-risk cases.
  - Re-eval v05: `tmp/ordinary-mimo-v05-fullgame-after-review-register-fix-20260610-eval.json`, averageScore 91.8, issueCount 34, mostly `ordinary_jargon_stack`, confirming the old full-game text was indeed polluted by these surfaces.
- Remaining risk: no valid fresh live Mimo transcript has been run after this cleanup. A v07 attempt was made but every provider call returned `401 Invalid API Key`, so the next useful step still requires a valid temporary key and should not start token reduction.

### 2026-06-10 Invalid-key v07 Attempt And Fallback Pollution Cleanup

- Attempted a fresh bounded ordinary Mimo run after the review-register cleanup:
  - `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310.json`
  - `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310-cases.json`
- Result: fallback-only, not a valid Mimo quality sample. Summary: `completedGames 0`, `totalCalls 25`, `speechCalls 9`, `actionCalls 16`, `fallbackCount 25`, `errorCount 25`, `validationFailureCount 0`, `provider_error 25`, and `provider_request 25`; all attempts reported `401 Invalid API Key`.
- Local eval was still run to inspect failure-path pollution:
  - `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310-eval.json`
  - totalCases 25, averageScore 88.5, issueCount 14, with `speech_vote_discontinuity` 8, `no_concrete_progression` 5, and `ordinary_jargon_stack` 1.
- The fallback-only transcript exposed cleanup targets that are independent of Mimo generation:
  - duplicate `这段我先记下`.
  - Kimi/Gemini fallback openers such as `身份线`, `观察位`, and `长线记忆`.
  - evaluation seat display names leaking model suffixes such as `Mimo-mimo-v25-pr` into transcript context.
- Fixed those failure-path issues without broad hard fallback rules:
  - ordinary provider-error fallback now varies previous-speech language and avoids review-register openers.
  - `buildLlmEvaluationFriends` keeps transcript nicknames as base persona names while preserving model details in `llmConfig`.
  - LLM-visible soft guidance, table-read points, last words, and seat memory fallback wording were cleaned away from review-register terms where they could influence ordinary speech.
- Verification:
  - `npm run test -- src/ai/speechProviders.test.ts -t "provider-error fallback"` failed first, then passed.
  - `npm run test -- src/ai/llmEvaluation.test.ts -t "cyclic custom DeepSeek"` failed first, then passed.
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 374 tests.
  - `npx tsc --noEmit --pretty false` passed.
- Next useful step remains: get a valid temporary Token Plan key through process env, then run a real bounded transcript. Do not judge Mimo quality from v07 and do not start token reduction.

### 2026-06-09 Phase 1/2 Update

- Local persisted Mimo credentials still fail a direct Mimo probe with `401 invalid_key`; do not treat the local `.env` state as usable evidence. A user-approved temporary Token Plan key, passed only through process env, returned `200` for direct tiny requests and project-shaped speech requests.
- `scripts/evaluate-llm-game.mjs --models=mimo-v2.5-pro` defaults the custom lineup base URL to DeepSeek unless `--base-url=https://token-plan-cn.xiaomimimo.com/v1` is supplied. Future Mimo lineup probes must pass the Token Plan base URL explicitly or use the persona route.
- The runtime custom Mimo route used by AI-friend configs now receives the same Mimo safeguards as the built-in route: `thinking` disabled, speech token floor, and 180s speech timeout. This is covered by `src/ai/modelLlms.test.ts`.
- Ordinary speech prompt/validator now covers the latest real-sample failures: peace-night wolf/witch rule lectures, pressure-source callbacks that legitimately pivot to an identity line, waiting for later external counterclaims after an already-spoken claimant, and truncated endings such as `你铺的那句`.
- Real bounded evidence after the route fix: `tmp/ordinary-mimo-phase2-day1-6calls-after-route.json` improved custom-route behavior, and `tmp/ordinary-mimo-phase2-day1-3calls-after-truncation.json` produced 3 custom Mimo speech calls with 2 non-fallback rows and 1 intended fallback for low-information skipped-seat tasking.
- Current interpretation: the active blocker is no longer "Mimo cannot be called" with the temporary Token Plan key. The next speech-quality issue is first-seat low-information behavior: reduce the model's tendency to skip the immediate next speaker and ask a later seat to answer vague homework.

### 2026-06-09 First-seat Low-info Follow-up

- Ordinary low-information first speaker guidance now says the first seat should default to no named future-seat homework. It should leave a self-owned condition such as who borrows peace night to push a vote, rather than asking `下一位` or a farther later seat to answer.
- Validation now rejects ordinary low-information first-seat speeches that name a future seat and assign homework such as `轮到你时我想听你怎么看`. Existing non-first-seat behavior still allows a concrete question to the immediate next speaker when it is based on already-spoken material.
- Provider-error first-seat fallback no longer says `下一位正常接麦`; it now stays on the speaker's own public condition.
- Provider-error fallback no longer misreads a prior peace-night action as `只说了平安夜，但没说自己怀疑谁` when the prior line already contained a concrete action such as `谁急着带票` or `先不把票压死`.
- Current persisted local Mimo environment still fails a 6-call bounded lineup sample with `401 invalid_key`; saved evidence is `tmp/ordinary-mimo-phase2-day1-6calls-first-seat-fix-fallback-check.json`. Treat it as fallback-pollution evidence only, not as real Mimo transcript quality.
- Next action remains: run a fresh 6-9 row Day 1 Mimo transcript with a valid temporary process env key, then review subjective player feel before doing any token-reduction work.

### 2026-06-09 Bounded Transcript Review Follow-up

- Ran a fresh bounded Day 1 ordinary Mimo transcript with a user-provided temporary process env key only; no key was written to `.env`, docs, or reports.
- Evidence files:
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-cases.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-eval.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336.md`
- Result: 6 Day 1 speech calls, all through `custom-speech:mimo-v2.5-pro`; 4 real non-fallback rows and 2 provider-error fallback rows. Local ordinary eval average score was 91.7, with 1 high-risk row.
- Subjective transcript review found three concrete bad shapes: one real output ending on a dangling `但`, provider-error fallback still using `身份线 / 先留一处疑问 / 这轮我只听谁把怀疑落到具体人身上`, and a real output saying `放进观察位` plus waiting for later speakers to `接这条线`.
- Narrow fixes now cover those shapes in `src/ai/speechProviders.ts` / `src/ai/speechProviders.test.ts`: ordinary truncated-ending validation catches the dangling `但`; provider-error fallback avoids the covered audit-template skeleton; ordinary validation rejects observation-slot plus later-chain-review wording.
- No fresh paid Mimo rerun was made after the local fixes. The next useful quality step is another small real transcript if the user wants live confirmation, not token reduction.

### 2026-06-09 Human Speech Research And User Review Follow-up

- After a later bounded sample (`tmp/ordinary-mimo-phase2-day1-after-user-review-20260609-205637.json`), user review found the direction still unsatisfactory:
  - 1号 used unclear meta phrasing `我先说我会卡什么`.
  - 1号 was first speaker but pre-attacked 3号 future speech before 3号 had spoken.
  - 2号 and 4号 attacked 1号 for saying `女巫用药了`, even though no-guard 9p peace night makes witch antidote a public death-shape background.
  - 3号 fallback was nearly empty, and later seats repeated `卡 / 这句话本身 / 这段我先...` audit wording.
- Added no-code research detail to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- New source-backed conclusion: use "speech validity conditions" instead of phrase bans. A line is valid only if the seat/order/public-info context supports it.
- New read-only source aggregation:
  - GitHub demo directory has 11 public JSON files under `data/demo/opensource`.
  - Precise `audio["Day 1 Daytime - [n] is speaking"].text` extraction found 98 Day 1 speech rows: Seer 11, Witch 10, Hunter 11, Villager 33, Werewolf 33.
  - 95/98 rows have first-person wording, 95/98 directly address seats or other players, 88/98 include uncertainty/buffering, 97/98 include colloquial/emotional fillers, and 90/98 include questions or rhetorical questions.
  - All 11 demo games had Day 1 `Death Message: []` and positive `Witch antidote`, reinforcing that peace-night witch-use is public background for this board shape, not a hidden-info attack axis.
- Next code step, when approved: write focused failing tests for:
  - `unspokenSpecificSeatFraming`
  - `peaceNightPublicCommonSenseMisattack`
  - `emptyMicroMove`
  - `templateSurfaceLoop`
- Do not start token reduction. Do not claim ordinary speech is fixed until the user reviews a fresh transcript after these fixes.

### 2026-06-09 Speech-act Mechanism Addendum

- Expanded the research doc with a second heuristic action aggregation over a stricter 89-row Day 1 audio subset. The dominant pattern was not "perfect reasoning"; it was self-state plus evidence/reason plus an action boundary, often with emotion, hedging, or a question.
- Added an implementation-facing but no-code mechanism draft:
  - Treat ordinary speech as choosing one player action card, not as producing a table-audit paragraph.
  - Candidate action cards include low-info table water, quote-one-line, half-accept, discomfort, follow pressure, hold, defend, change read, role handling, and vote boundary.
  - Prompt should pass a small candidate action set, the recent public table objects, and recent repeated surface motifs; the final speech should not print the action card name.
  - Validator should stay limited to hard public-information/order violations, broken output, and repeated surface loops.
  - Fallback should be short and narrow, with no new focus creation and no skipped future-seat homework.
- Next implementation pass should use this action-card mechanism before adding broad phrase bans.

### 2026-06-09 User-review Test Mapping Follow-up

- Expanded the research doc again with a direct mapping from the user-reviewed bad transcript shapes to implementation tests.
- The next quality pass should start with these concrete failures:
  - first-seat meta-audit opener like `我先说我会卡什么`
  - unspoken future-seat framing, especially first speaker attacking 3号 before 3号 has spoken
  - peace-night public-common-sense misattack, especially treating `女巫用药了` as hidden information on no-guard 9p peace night
  - empty micro-move fallback, where the line only says `留疑问 / 看后面 / 这句话本身`
  - repeated surface loop, where multiple seats reuse `卡 / 这句话本身 / 这段我先... / 接这条线`
  - speaker-order confusion such as a 6号 speaker saying it mainly waits for people after 3号 to接线
- This follow-up explicitly keeps the implementation direction away from broad phrase bans or large if/else tables. The preferred design remains: pass recent public table objects, a small action-card candidate set, and recent repeated surface motifs to the LLM; render in first person; keep validator/fallback narrow.
- No code or real provider call was made in this follow-up. The next code step is focused failing tests in `src/ai/speechProviders.test.ts` and, if evaluator coverage is touched, `src/ai/llmEvaluation.test.ts`.

### 2026-06-09 External Source Calibration Follow-up

- Added another no-code research section that cross-checks the mechanism direction against public datasets/papers and Chinese role-speech guidance:
  - `Werewolf Among Us` supports treating speech as persuasion/action strategy rather than a single logic-audit paragraph.
  - `ReneeYe/werewolf_game_reasoning` separates speech/action/vote data, reinforcing that ordinary eval should score player-mouth speech, action choice, and vote continuity separately.
  - `Playing the Werewolf game with artificial intelligence for language understanding` and `Werewolf Arena` reinforce that deception, defense, and speaking order are central; fixed-order ordinary speech should not pretend future or already-passed seats are still pending in a vague way.
  - Role guidance sources support the public-role boundary: closed-eye roles speak like villagers until they reveal; wolves publicly mimic good-side perspectives; revealed seer/witch/hunter speech centers on their public action.
- Implementation implication: prompt should pass `currentPressure`, `allowedSpeechMoves`, and `recentSurfaceMoves` as soft director inputs. The final text remains first-person and action-bounded, with no printed card name and no broad word bans.
- No code or provider calls were made in this follow-up.

### 2026-06-09 Ordinary Speech Contract Follow-up

- Added `普通局发言契约 v0.1` to the research doc as an implementation-before-code checklist.
- The contract defines four per-speech checks:
  - speaker order/position is valid
  - first-person motive is visible
  - table object is public and local
  - the line lands a handling boundary, even if it is low-information table water
- It also defines whole-sample checks for a 6-9 row Day1 transcript:
  - varied speech moves
  - no repeated audit surface
  - role differences stay public and natural
  - fallback remains short and non-polluting
- Added one positive test target, `lowInfoHumanWaterPasses`, so the implementation does not accidentally reject natural low-information player speech while fixing template loops.
- No code or provider call was made in this follow-up.

### 2026-06-09 Soft Director Spec Follow-up

- Added `普通局软导演规格 v0.1` to the research doc.
- The spec defines the implementation-facing fields without making them hard if/else branches:
  - `currentPressure`: why this seat is speaking now
  - `tableObjects`: only local public objects, not a full-table audit
  - `allowedSpeechMoves`: 3-5 candidate player moves, not one forced line
  - `recentSurfaceMoves`: repeated surface patterns to avoid by changing action, not by synonym replacement
- The spec also divides responsibilities:
  - LLM renders first-person public speech and must not print card names or director fields.
  - fallback chooses one short sentence family based on current pressure and does not create new focus.
  - evaluator reports issue codes such as `missingFirstPersonMotive`, `globalAuditTone`, `peaceNightCommonSenseMisattack`, `templateSurfaceLoop`, and positive passes such as `lowInfoHumanWaterPasses`.
- No code or provider call was made in this follow-up.

### 2026-06-09 User-feedback Validator And Fallback Pass

- Used the user-provided temporary Token Plan key only as process env for bounded real Mimo samples; no key was written to `.env`, docs, reports, or source.
- Added focused regressions and narrow fixes for the user-reviewed bad shapes:
  - first-seat meta-audit opener such as `我先说我会卡什么`
  - first-seat/future-seat homework such as `我比较想看3号这轮怎么发言`
  - empty micro-move such as `这段我先留一处疑问`
  - confused later-chain wording such as 6号 saying it mainly waits for 3号后面的人继续接线
  - peace-night public common sense attacked as hidden information or witch probing
  - repeated and single `卡` surface loops such as `有点卡` / `最卡`
  - ordinary semantic cut-off where a line raises `有个点没听明白` but ends at `这部分我理解`
  - peace-night rule lectures around `定义刀口 / 分析用药逻辑 / 找女巫`
- Ordinary prompt/fallback now avoids recommending `卡一句 / 卡我的是`; provider-error fallback was shortened and no longer uses `后面我看谁继续复读这个点` or `等他自己把立场落下来`.
- Latest real sample before the final local death-shape validator: `tmp/ordinary-mimo-phase2-day1-final-local-fix-real-20260609-233444.json`. It had 6 speech calls, 4 non-fallback rows, 2 provider-error fallback rows, and one local-eval quality issue `death_cause_overclaim` from a peace-night `定义刀口/找女巫` line.
- That final real-sample issue is now covered locally by `普通局平安夜不要展开刀口和女巫行动规则课`, but no additional paid Mimo rerun was made after the last local guard.
- Current interpretation: this pass removes several concrete transcript defects, but the ordinary speech direction is not yet accepted. Remaining risks are provider-error fallback instability, custom-lineup model suffixes leaking into speaker names, and real Mimo still circling too much around the same 1号 peace-night/fallback axis.

### 2026-06-09 Public Source Deep-dive Follow-up

- Continued the no-code human-speech research pass and expanded `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- Added source-backed calibration from public papers/datasets and role guidance:
  - `Werewolf Among Us` for persuasion-strategy framing and utterance-level social-deduction annotation.
  - `Playing the Werewolf game with artificial intelligence for language understanding` for free natural-language deception and role difficulty.
  - `ReneeYe/werewolf_game_reasoning` for separating speech/action/vote evaluation surfaces.
  - `Language Agents with Reinforcement Learning for Strategic Play in the Werewolf Game` for diverse action-candidate generation before final action choice.
  - Chinese role-speech guidance for public role boundaries: villager/hunter/witch often speak like limited-view villagers before public reveal; wolves publicly mimic good-side views.
- Added a three-layer real-player speech rhythm: seat pressure/state, one local public table object, and a temporary handling action.
- Added positive low-information water examples so the next implementation preserves lines like `我这位置没东西，我先过` when they have a self-owned handling boundary.
- Added an `underQuestion` priority rule: when a seat is challenged, it should first clarify or defend its own motive rather than continue global review.
- Added a public role-state matrix for villager, wolf, seer, witch, and hunter. This is meant as soft director guidance, not fixed scripts or broad if/else branches.
- No code, provider calls, or token-reduction work was done in this follow-up.

### 2026-06-10 Soft-director Implementation And Final Transcript Review

- Implemented the ordinary soft-director path from the research spec: ordinary speech input now carries current pressure, local table objects, allowed speech moves, recent surface moves, and prompt lines for first-person player-mouth rendering. When a seat is under question, the director prioritizes self-defense or motive clarification before broader table review.
- Added narrow transcript-driven guards and fallback fixes for the latest user feedback:
  - visible player-jargon and copied surface phrasing such as `布置作业 / 划线 / 触线 / 这句话本身`
  - duplicated-word slips such as `我先先`
  - peace-night public-common-sense misreads around `女巫用药了`
  - provider-error fallback suffix leakage and repeated audit fallback wording
  - true-witch planned fallback that can report the saved target when the public role plan requires it
  - silver-water recipient acknowledgements no longer count as a self witch claim
- Latest real Mimo evidence after these fixes:
  - `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114.json`
  - `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114-cases.json`
  - `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114-eval.json`
  - review summary: `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114.md`
- Result: 6 Day 1 speech calls, all through `custom-speech:mimo-v2.5-pro`, fallbackCount 0, errorCount 0, validationFailureCount 0, with 2 retry_ok calls and 4 ok calls. Local evaluator average was 91.7 with `logic_boundary_error` 1 and `no_concrete_progression` 1.
- Manual review: the sample no longer repeats the covered `卡 / 这句话本身 / 划线 / 触线 / 布置作业` surfaces, no longer attacks public peace-night witch use as hidden information, and 4号 gives a concrete human-like challenge to 3号's half-finished line.
- Remaining quality risks: 1号 still sounds prompt-shaped with `观察点 / 后面谁`, 2号 is too long and debate-like (`举证责任`, `打法是打算验谁`), 3号's `认同一半` remains half-finished, and the local evaluator likely false-positives 2号 true-witch reveal as hidden-information overclaim. This is an improvement sample, not final user acceptance.
- Verification after state updates passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/game/claims.test.ts`, `npx tsc --noEmit --pretty false`, `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` with LF/CRLF warnings only.
- No token-reduction work was done.

### 2026-06-10 Human Speech Source Refresh And v0.2 Mechanism

- After user review of the latest 6-row real Mimo sample, paused code/provider work and updated the research doc only; no `src/**`, `.env`, provider config, UI, rules, or token-reduction changes were made.
- Added `2026-06-10 最新样本缺口与公开素材再校准` to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- Latest subjective failure mapping:
  - 1号 still used prompt-shaped first-seat wording: `观察点 / 后面谁...`.
  - 2号 true-witch reveal sounded like a debate/courtroom argument with `举证责任` and `打法是打算验谁`.
  - 3号 said `认同一半` but did not land the accepted half, the reserved half, or the current handling action.
- Public-source refresh used papers/data cards/benchmarks/Chinese role-speech guidance including `Werewolf Among Us`, FanLang-9, `Werewolf Arena`, Foaster, Werewolf-XL, first-round/villager guidance, and common terminology references.
- Updated mechanism target to `普通局发言动作 v0.2`:
  - `entryBeat`: current speaker state such as low-info water, under-question defense, or public-role handling.
  - `publicObject`: one local public item, not a full-table audit.
  - `moveLanding`: one handling action such as pass, hold, question, follow, defend, change, role-handle, or vote boundary.
  - `voiceTexture`: optional grounded emotion/hesitation.
  - `antiTemplatePressure`: repeated surfaces should change the action, not just synonyms.
- Next implementation tests, if approved, should cover `futureAuditHook`, `courtroomRegister`, `halfAcceptWithoutLanding`, plus positive protections `boundedLowInfoWater` and `emotionalButGrounded`.
- Current interpretation: this is still phase 2 research/spec calibration, not acceptance of ordinary speech quality and not the start of phase 3 token work.

### 2026-06-10 v0.2 Validator/Evaluator And Bounded Transcript Pass

- Continued phase 2 only; no token-reduction work was done, no `.env` or provider configuration was changed, and the temporary Mimo credential was used only through process env.
- Added focused regressions and narrow local fixes for the latest user-reviewed and live-sample shapes:
  - first-seat future-audit hooks such as `观察点/后面谁`, `有一个点我先记下来`, and `这点记下，后面再看谁`
  - courtroom/debate register such as `举证责任` and `打法是打算验谁`
  - half-accept speeches that say `认同一半` without landing the accepted half, reserved half, and current handling
  - visible audit jargon and copied surfaces such as `划一条线/划条线`, fallback `我给一个边界/我只接一个点`, and truncated tails like `你留了`
- Positive protections were kept or added for bounded low-information water, direct witch reveal, landed half-accept, challenging another speaker's half-accept, and true-witch self reveal so the evaluator does not misread it as a logic-boundary error.
- Real bounded evidence:
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-111754.json` exposed one first-seat death-event future-audit line, one accepted truncated `你留了` tail, and one provider-error fallback audit phrase. Those shapes are now covered locally.
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-113300.json` is the latest bounded transcript: 6 calls, 4 non-fallback rows, 2 provider-error fallback rows, and 0 validation failures.
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-113300.md` is the human-readable review summary for the latest transcript.
- Local eval after the final local fix on the latest 6-row cases produced average score 89.7, issueCount 4, with issue codes `future_audit_hook` 1, `no_concrete_progression` 1, and `ordinary_jargon_stack` 2. High-risk row remained 1号.
- Current interpretation: the newest transcript is useful evidence, not an accepted quality bar. It still shows a bad 1号 first-seat hidden-state/future-audit hint, line-drawing language in 2号/4号, and thin fallback rows in 3号/5号. The next narrow target should be first-seat hidden-state hints and reducing provider-error fallback frequency before another bounded sample.

### 2026-06-10 Public Human-speech Research v0.3

- Continued docs-only research before the next code pass; no `src/**`, `.env`, provider config, real LLM run, or token-reduction work was done.
- Added `2026-06-10 公开真人语料再抽样与人味节奏 v0.3` to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- Re-ran a read-only public demo aggregation over GitHub `boluoweifenda/werewolf` `data/demo/opensource`: 11 public JSON files and 98 precise Day 1 `audio` speeches. The aggregation found 95/98 first-person or us-perspective rows, 95/98 direct-address rows, 86/98 hedge/temporary rows, 95/98 question/response rows, 71/98 low-information/opening-position rows, 40/98 defense/explanation rows, and 36/98 hold/pass/defer rows.
- Cross-checked with public sources including Werewolf Among Us, FanLang-9, Langrensha strategy pages, Foaster Werewolf benchmark, and Werewolf-XL. The shared conclusion is that real-player feel comes from a seat-local action sequence, not heavier terminology.
- Updated the mechanism target from v0.2 into `真人发言节奏 v0.3`: current self-state, one local public object, one handling action, and optional emotional texture. Low-information water is allowed when it has a personal state and temporary boundary.
- Next code pass should convert v0.3 into focused tests and soft prompt/director inputs:
  - first-seat low-information water positive cases
  - first-seat future-audit and hidden-state hint failures
  - under-question defense priority
  - role-public-action differences for villager, wolf, seer, witch, and hunter
  - repeated surface action diversification without broad word bans or large if/else tables

### 2026-06-10 v0.3 Prompt/Fallback Pass And Transcript Review

- Continued phase 2 only; no token-reduction work was done, no `.env` or persisted provider configuration was changed, and the temporary Mimo credential was used only through process env.
- Converted the v0.3 rhythm into focused local coverage and small prompt/fallback changes:
  - ordinary soft-director prompt lines now name the four beats: current self-state, one local public object, one handling action, and voice texture.
  - low-information first-seat guidance and table-read task wording now say state/handling boundary instead of `铺观察点 / 可验证观察点`.
  - true-witch soft hidden-state hints such as `我手里的信息先不摊开` are rejected unless the witch gives an explicit allowed target reveal.
  - structured mock hard-claim fallback no longer emits `我卡这里`.
- Latest real bounded transcript:
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-eval.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.md`
- Result: 6 Day 1 speech calls through `custom-speech:mimo-v2.5-pro`, with 5 real non-fallback rows and 1 provider-error fallback row. Accepted transcript validation failures were 0. Local ordinary eval average was 94.7, with issue codes `no_concrete_progression` 1 and `ordinary_jargon_stack` 1.
- Manual review: this is not accepted quality. The sample no longer shows the covered `卡我 / 这段我先留一处疑问 / unfinished tail` shapes, but it still exposes:
  - 1号 real Mimo twice tried a future-audit first-seat line and fell back.
  - 4号 says `当前先审你的发言缺口`, which is still audit/register wording.
  - 5号 says `观察位`, and 6号 says `这话本身` / `观察条件`.
  - Seats 2-6 over-focus on 1号's fallback sentence, producing a one-axis transcript.
- Next narrow code target should cover the newly accepted-output surfaces: `审发言缺口`, `观察位`, `这话本身`, and `观察条件`, plus first-seat live prompt work that prevents Mimo from burning retries into fallback. Do not start token reduction.

### 2026-06-10 Public Human-speech Deep Research v0.4

- Continued docs-only research per user direction; no `src/**`, `.env`, provider config, real LLM run, UI, rules, or token-reduction work was done.
- Added `2026-06-10 公开真人发言深研与机制 v0.4` to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- Re-read the current harness docs, AI speech thread, ordinary Mimo task/eval cards, latest 12:31 Mimo review summary, progress, handoff, and long-running registry before editing.
- Added or rechecked public sources:
  - GitHub `boluoweifenda/werewolf` demo data and the FanLang-9 paper.
  - `Werewolf Among Us`, `Werewolf Arena`, Foaster benchmark, Werewolf-XL, and MaKTO-Werewolf.
  - Chinese role/facing guidance for villager, seer, witch, hunter, first-round speech, and weak/new-player speech.
- Re-ran a no-write public demo aggregation over GitHub `data/demo/opensource`: 11 JSON files, 98 Day 1 `audio` speeches, average about 560 chars, min 10, max 1001; 95/98 first-person, 96/98 direct-address, 85/98 uncertainty/temporary handling, 90/98 questions, 71/98 low-information/opening-position, 53/98 defense/explanation, 40/98 hold/pass/defer, and 37/98 emotion/pressure hits.
- Updated the mechanism from v0.3 four beats into v0.4 five rhythm units:
  - `seatState`: why I am speaking from this seat now.
  - `localObject`: one local public object, not a full-table audit.
  - `playerMove`: one human player action from a small candidate set.
  - `socialTexture`: optional emotion or weak-player texture without private info.
  - `tableContinuation`: how I hand the turn back to the table.
- Added a stronger implementation direction: protect weak but human low-information speech, reduce accepted audit surfaces by changing the selected action instead of adding broad bans, and use positive evaluator signals such as `weakButHumanPasses`, `emotionalButGroundedPasses`, `defensiveSelfMotivePasses`, and `rolePublicActionPasses`.
- Next step should be user review/approval of v0.4 before code. If approved, start with focused tests for first-seat weak water, accepted audit surfaces, repeated-axis pile-on, under-question self-defense, weak wolf-as-villager, and public role-action cases.

### 2026-06-10 v0.4 Human-speech Mechanism Implementation

- User approved starting the next step after the docs-only v0.4 research pass.
- Converted the v0.4 design into focused tests before production changes:
  - `src/ai/llmEvaluation.test.ts`: latest audit surfaces, `weakButHumanPasses`, `emotionalButGroundedPasses`, `defensiveSelfMotivePasses`, `rolePublicActionPasses`, repeated same-axis pile-on, and weak wolf-as-villager.
  - `src/ai/speechProviders.test.ts`: v0.4 soft-director vocabulary, latest accepted audit surfaces, weak low-information water, and repeated same-axis pile-on around one fallback sentence.
- Implemented the narrow local changes:
  - `src/ai/speechProviders.ts` now names the v0.4 five units in ordinary soft-director guidance and rejects `审发言缺口 / 观察位 / 这话本身 / 观察条件`-style visible audit surfaces.
  - `src/ai/speechProviders.ts` now rejects repeated same-axis pile-on when multiple prior speakers keep auditing the same seat with the same surface instead of changing player action.
  - `src/ai/llmEvaluation.ts` now emits `repeated_axis_pile_on` and positive signals for weak-but-human water, grounded emotion, self-defense motive, and public role-action speech.
- Kept the change local: no `.env`, provider config, UI, rules, deployment, real Mimo call, or token-reduction work was done.
- Verification passed:
  - `npm run test -- src/ai/llmEvaluation.test.ts` passed 23 tests.
  - `npm run test -- src/ai/speechProviders.test.ts` passed 271 tests.
  - `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 294 tests.
  - `npx tsc --noEmit --pretty false` passed.
  - `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
  - `npm run harness:long-tasks` passed.
  - `npm run harness:check` passed.
- Next useful step: run or request one fresh bounded ordinary Mimo Day 1 transcript with a temporary process env key only, then have the user review subjective player feel. Do not start token reduction until speech quality is accepted.

### 2026-06-10 v0.4 Local Re-eval And Credential Blocker

- User asked to start the next step after the v0.4 implementation pass.
- Re-read the current harness/state/task context and confirmed the intended next step remains a fresh bounded ordinary Mimo Day 1 transcript with a temporary process env key only.
- Re-scored the latest 12:31 real Mimo cases through the v0.4 evaluator:
  - input: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json`
  - JSON output: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.json`
  - Markdown output: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.md`
  - result: average score 90.7, issueCount 4, `no_concrete_progression` 1, `ordinary_jargon_stack` 3.
- Tried one minimal fresh Mimo probe with `.env` loading disabled via `DOTENV_CONFIG_PATH=__codex_no_env_file__`, explicit Token Plan base URL, and `max-llm-calls=1`.
  - output: `tmp/ordinary-mimo-v04-no-temp-key-blocker.json`
  - cases output: `tmp/ordinary-mimo-v04-no-temp-key-blocker-cases.json`
  - result: provider returned `401 Invalid API Key`; the single speech row is fallback-only and must not be used as a quality sample.
- No `.env`, provider config, UI, game rules, deployment, source code, or token-reduction work was done.
- Next useful step is still a real bounded transcript, but it requires a valid temporary Token Plan key passed only through process env.

### 2026-06-10 v0.4 Fresh Mimo Transcript And Narrow Fallback Fix

- User provided a fresh temporary Token Plan key and asked to use it. The key was used only through process env; it was not written to `.env`, source, docs, reports, or provider config.
- First fresh bounded transcript:
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612-cases.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612-eval.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612-eval.md`
  - result: 6 speech calls, 4 real non-fallback rows, 2 fallback rows, local eval average 100.
- Manual review did not accept the first fresh transcript: fallback still misread a concrete `有点滑` read as no suspicion, repeated `我先说一个地方`, and one candidate row was rejected on a validator shape that needed narrowing.
- Added focused local coverage and a narrow fallback fix in `src/ai/speechProviders.ts` / `src/ai/speechProviders.test.ts`:
  - allow ordinary speech to describe a spoken seat's question to another seat without treating it as asking that already-spoken seat to speak again.
  - recognize `有点滑 / 听着滑 / 别扭 / 不舒服` as concrete suspicion or discomfort, so fallback does not summarize it as no suspicion.
  - vary fallback connector wording instead of repeatedly using `我先说一个地方`.
- Post-fallback-fix bounded transcript:
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-cases.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-eval.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-eval.md`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-review.md`
  - result: 6 speech calls, 4 real non-fallback rows, 2 fallback rows, local eval average 93.3 with `no_concrete_progression` 2.
- Manual review improved but still not accepted: 1号 is too weak/procedural, 2号 true-witch fallback action is too thin, and 5号 says it may change the read on 1号 but does not land the new read.
- Added a final local guard after the post-fix transcript: ordinary lines with `可能要改口 / 判断要变` must land a new read, and quoted prior speech is ignored when checking whether the new read exists.
- Verification passed:
  - `npm run test -- src/ai/speechProviders.test.ts -t "spoken seat's question|concrete slippery-read"` failed first on the fallback misread, then passed after the fix.
  - `npm run test -- src/ai/speechProviders.test.ts -t "changed read|spoken seat's question|concrete slippery-read"` passed after the final changed-read guard.
  - `npm run test -- src/ai/speechProviders.test.ts` passed 273 tests.
  - `npx tsc --noEmit --pretty false` passed.
- No fresh live transcript was run after the final `可能要改口` guard. Do not start token reduction; the next narrow pass should target first-seat low-progress water, too-thin witch fallback, and local evaluator under-catching subjective accepted-output issues.

### 2026-06-10 User Review: Unfinished 4/5 Lines

- User reviewed the post-fallback-fix transcript and said 4号 and 5号 felt unfinished; the other rows were mostly acceptable for this pass.
- 5号's unfinished shape is already covered locally by the final changed-read guard: `可能要改口 / 判断要变` must land a new read, and quoted prior speech does not count as the new read.
- Added a focused 4号 guard in `src/ai/speechProviders.ts` / `src/ai/speechProviders.test.ts`: ordinary speech that expresses discomfort such as `听着有点怪 / 别扭 / 不舒服` and then ends on a quoted prior line now fails as `普通局发言疑似被截断`.
- Positive protection: the same quote shape passes when followed by a current handling action, so short but landed human speech is not blocked.
- Verification passed:
  - `npm run test -- src/ai/speechProviders.test.ts -t "cut-off seat reference"` failed first on the missing truncation guard, then passed after the fix.
  - `npm run test -- src/ai/speechProviders.test.ts -t "changed read"` passed.
- `npm run test -- src/ai/speechProviders.test.ts` passed 273 tests.
- `npx tsc --noEmit --pretty false` passed.
- No fresh paid/live Mimo transcript has been run after this guard.

### 2026-06-10 Soft Quality Pass And Claim Parser Fix

- User clarified the implementation direction: minimize restrictions on LLM speech unless there is a rule/public-information problem; for speech-quality issues, prefer rule context, table context, and prompt repair over forced fallback.
- Implemented that boundary in `src/ai/speechProviders.ts`: ordinary player-feel validations are split into soft quality issues for provider fallback decisions, while hard public-info/rule violations still retry and can still fallback.
- Soft ordinary issues still feed retry repair context, but if only soft issues remain after retries the provider returns the latest LLM speech as non-fallback. This is intended to preserve first-person variety and weak-but-human water instead of overproducing template fallback.
- Kept hard failures hard for hidden potion/death information, fake deaths, wrong role/check claims, death-shape rule overclaim, and similar game-state correctness problems.
- Added a true-Witch boundary exception for publicly revealed real Witch speech, so a Witch can challenge how others handle a public peace-night Witch-use statement without being rejected as hidden-info misuse.
- Fixed natural Witch self-claim parsing in `src/game/claims.ts` for lines like `我是2号，女巫...`; this removed a false hard failure where later seats treated a public Witch claim as unannounced identity information.
- Final bounded evidence:
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935-cases.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935-eval.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935-eval.md`
- Result: 6 Day 1 speech calls, fallbackCount 0, errorCount 0, validationFailureCount 0. Run summary still reports one non-blocking quality hint `death_cause_overclaim`; standalone local eval averageScore 95, issueCount 1, `logic_boundary_error` 1. These look like review/evaluator calibration points, not reasons to hard-fallback the speech.
- Verification passed:
  - `npm run test -- src/ai/speechProviders.test.ts` passed 279 tests.
  - `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts` passed 305 tests.
  - `npx tsc --noEmit --pretty false` passed.
  - Final bounded Mimo transcript and local existing-case eval passed.
- Next action: show the final 6-row transcript to the user for subjective review. If issues remain, prefer prompt/context/evaluator tuning before adding new hard fallback rules.

## Allowed Scope

Files or directories the agent may edit during phase 1 Mimo diagnostics:

- `src/ai/modelLlms.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `scripts/check-llm-output.mjs`
- `scripts/evaluate-llm-game.mjs`
- `scripts/eval-ordinary-ai*.mjs`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Files or directories the agent may edit during phase 2 speech quality:

- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- ordinary AI eval scripts and task docs when the change is directly tied to transcript evaluation

Files or directories the agent should not edit:

- `.env`
- secret-bearing files or persisted provider credentials
- generated caches
- database files
- unrelated frontend/UI modules
- production deploy scripts
- token-reduction prompt compaction work before phase 3 is explicitly started

## Phased Plan

### Phase 1: Mimo Invocation Reliability

Target question: why can tiny direct Mimo API calls work while project-level ordinary samples hit provider errors or quota errors?

Work items:

- Reproduce the smallest project-level Mimo speech call with temporary process env only.
- Record model, base URL, request size, `max_tokens`, provider error class, and returned `usage` when available.
- Add or improve no-secret diagnostics only if current logs cannot explain the failure.
- Distinguish account/provider state from local request construction:
  - direct tiny request works
  - project speech request works
  - project speech request reaches provider but is rejected
  - project speech request never reaches provider because of local routing/config
- Do not paste or persist API keys. Do not edit `.env`.

Done for phase 1:

- A future agent can state whether the current blocker is local routing/request shape, Mimo account/quota/model permission, or unknown.
- The evidence is saved in a task/handoff note and, if generated, in ignored `tmp/*.json` or `tmp/*.md` reports without secrets.

### Phase 2: Ordinary Speech Quality

Target question: does ordinary AI sound like a real player in the seat, not an audit narrator?

Work items:

- Use the real-player research report as style evidence, not copied transcript text.
- Generate small ordinary Day 1 samples first, preferably 6-9 speech rows, before full-game spends.
- Score with local evaluator and manually review the transcript for:
  - first-person table-player perspective
  - no repeated `观察位 / 话说满 / 发言链 / 闭合 / 压力源` pollution
  - no rules-class explanation unless a public role claim makes it natural
  - no fake death, fake peace night, or hidden-information leak
  - no skipping the next relevant seat to assign vague future homework
  - fallback lines are short, public-state aligned, and not repeated across seats
- Implement narrow prompt, fallback, validator, or evaluator changes with focused tests.
- Avoid broad phrase bans that would block ordinary human wording.

Done for phase 2:

- User has reviewed at least one fresh ordinary real-Mimo transcript and considers the direction clearly satisfactory, or the remaining issues are explicitly listed for another narrow pass.
- Focused tests cover every newly fixed bad shape.
- Standard local verification for touched AI files passes.

### Phase 3: Token Cost Reduction

Start only after phase 2 is accepted.

Target question: how can we reduce cost without lowering speech/action quality?

Work items:

- Add usage accounting around provider calls when available from the API response.
- Measure one short full game or bounded Day 1 run before changing prompt size.
- Compare transcript quality before/after any prompt compaction.
- Prefer context pruning by public relevance over deleting role, safety, or fallback constraints.

Done for phase 3:

- Token usage is measured from real or API-reported usage, not only estimated.
- A cheaper prompt/action path preserves accepted transcript quality in side-by-side review.

## Definition Of Done

This roadmap is complete when:

- Phase 1 has a clear, evidence-backed diagnosis for the Mimo invocation problem, or a specific external provider/account blocker is recorded.
- Phase 2 has at least one fresh ordinary real-Mimo transcript or bounded sample that the user accepts as very close to the desired ordinary player feel.
- Focused tests cover the concrete bad speech/fallback shapes fixed during the quality passes.
- Phase 3 token reduction is either completed with measured usage and side-by-side quality evidence, or explicitly left as the next task after quality acceptance.
- `progress.md`, `session-handoff.md`, this task card, and `long_running_tasks.json` reflect the final status.

## Verification

Required checks for docs-only harness updates:

- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `npm run harness:long-tasks`
- `npm run harness:check`
- `git diff --check`

Required checks when AI code changes:

- `npm run test -- src/ai/speechProviders.test.ts`
- Include related focused tests when editing `modelLlms`, `tableRead`, `tableMemory`, `llmEvaluation`, `claims`, or evaluation scripts.
- `npx tsc --noEmit --pretty false`
- `git diff --check`

Optional deeper checks:

- Bounded real-Mimo Day 1 sample with temporary process env only.
- `npm run eval:ordinary-ai -- --source=existing --input=<cases.json> --json --out=<report.json>`
- Full-game real-Mimo run only after explicit user approval because it spends provider quota.

If a check cannot be run, record the reason in the handoff.

## 2026-06-11 v24 Stage Close And Fable5 Review Pack

Completed:

- Used the v23 sample-level metrics on the bounded seed 91 mock transcript and fixed the remaining local causes instead of adding more broad soft validator bans.
- Naturalized repeated mock previous-speaker bridges and public reasoning cue rendering:
  - removed repeated `刚才给了一个方向 / 拿后面的票和回应对照` bridges;
  - removed player-visible `公开线索是 / 后续发言者 / 我没听明白的是` mock evidence fragments;
  - varied repeated public-event renderings so multiple seats can cite the same event without one exact table-mouth template.
- Varied Witch/Hunter public role vote leads and table rally lines.
- Calibrated `no_concrete_progression` so weak but landed ordinary actions such as `先不压票听一圈`, `转回1号哪里没说清`, and `票先往8号靠` are accepted.
- Calibrated sample-level repeated phrase detection so it ignores fixed public-event scaffolding/model names while still reporting real repeated player-mouth fragments.
- Added Fable5 review pack: `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md`.

Latest local evidence:

- `tmp/ordinary-mimo-v24-stage-close-final-mock-eval.json`
- 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, sampleMetrics empty.
- This is local mock evidence only; it is not a fresh paid Mimo acceptance sample.

Next step:

- Give the review pack to Fable5 and ask it to judge residual human-feel issues, especially shared public-event references, repeated `公开` wording, long D1 3/5 rows, and GLM structural voice.
- Do not start phase 3 token-cost reduction until the user accepts phase 2 quality or explicitly redirects.

## 2026-06-11 v25 Post-Fable-Feedback Local Repair And Review Pack

Completed:

- Applied the v24 Fable5 critique direction without adding broad soft validators or hard fallback rules.
- Added report-only sample metrics for:
  - `repeated_clause_rate`: repeated long clauses across multiple seats;
  - `axis_concentration`: too much of a sample centered on one target seat.
- Added shared-pressure citation budgeting in the ordinary soft director:
  - detects 2+ prior speakers pressing the same seat;
  - adds a local table object noting the seat has already been continuously pressed;
  - shifts candidates away from `quoteOneLine`, `halfAccept`, and `followPressure` toward `hold`, `waterPass`, `voteBoundary`, and `changeRead`.
- Fixed mechanical bridge/splicing issues in mock speech:
  - varied pivot lines instead of repeating `上一位X先记下...`;
  - removed repeated `X的说法先只当背景，不靠一句话定人`;
  - repaired missing sentence breaks around `不靠一句话定人我...`, `有反证我会改1号...`, `不拿来替自己下结论我...`, and `不直接照搬1号...`.
- Reworded player-visible mock and agenda templates away from review-register phrases such as `公开动作`, `公开问题`, `公开过程`, `公开点`, `公开理由`, `发言动作`, `闭合`, `桌面压力落到`, and repeated `个参考，我还要看票和回应`.
- Added the v25 Fable5 review pack: `docs/evaluations/2026-06-11-ordinary-mimo-v25-fable5-review.md`.

Latest local evidence:

- `tmp/ordinary-mimo-v25-post-fable-feedback-mock-eval.json`
- 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, sampleMetrics empty.
- This is local mock evidence only; it is not fresh paid Mimo acceptance evidence.

Verification:

- `npm run test -- src/ai/speechProviders.test.ts -t "over-cited shared pressure targets"` passed after RED.
- `npm run test -- src/ai/speechProviders.test.ts -t "bounded mock transcripts"` passed after RED.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "repeated clause and target-axis concentration"` passed after RED.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --max-cases=30 --json --out=tmp/ordinary-mimo-v25-post-fable-feedback-mock-eval.json` passed with the result above.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts` passed 6 files / 397 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/ai/tableRead.ts src/ai/debateAgenda.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, JSON parse for `long_running_tasks.json`, and `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Next step:

- Stop here for Fable5 review. Ask Fable5 whether v25 actually solved the v24 mechanical defects and whether the remaining issue is still same-speaker analytical texture.
- Do not start phase 3 token-cost reduction.
- Do not run a paid full game unless the user explicitly asks.

## 2026-06-11 v26 Fable Minifix And Live Quota Blocker

Completed:

- Applied the v25 Fable5 critique as a deliberately small local repair, not another broad positive-supply iteration.
- Fixed the mock/fallback splicing regression where repeated full seat labels could degrade into `边界放清：不把直接打死`; repeated full labels now degrade to `N号`.
- Added used-once selection for recent mock bridge lines across previous-speaker, support, rally, agenda, public-role, counter-push, and focus-evidence text so the same line is not reused verbatim across seats when there is an alternative.
- Strengthened `repeated_clause_rate` as a report-only sample metric:
  - it now reads full `outputText`, not only snippets;
  - it normalizes seat numbers and player names;
  - it reports 15+ Chinese-character long clauses repeated across rows.
- Added the v26 minifix review pack and token-saving Fable prompt: `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md`.

Latest local evidence:

- `tmp/ordinary-mimo-v26-post-fable-minifix-mock-eval.json`
- 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- `sampleMetrics` now reports 2 warnings instead of staying silent:
  - `repeated_surface_phrase`: `处能撑住今天这票` at `2/15`;
  - `repeated_clause_rate`: `的是{seat}号{name}这会儿被推到台前主要卡在` at `2/15`.
- This means the local guard now catches the repeated-clause class that v25 missed. The remaining warnings are local mock/fallback signals, not live Mimo quality evidence.

Live Mimo attempt:

- `tmp/ordinary-mimo-v26-post-fable-live-report.json`
- `tmp/ordinary-mimo-v26-post-fable-live-eval-cases.json`
- Bounded Day 1 speech-only attempt with temporary process env key: 8 calls, 8 speech, `fallbackCount 8`, `errorCount 8`, `validationFailureCount 0`.
- Provider returned HTTP 403 `insufficient_user_quota`; the resulting transcript is fallback-only and must not be judged as real Mimo style.

Verification:

- `npm run test -- src/ai/speechProviders.test.ts -t "bounded mock transcripts"` passed after adding the minifix expectations.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "normalizing seat numbers"` passed after the repeated-clause metric change.
- `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts` passed 3 files / 352 tests during the minifix loop.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --max-cases=30 --json --out=tmp/ordinary-mimo-v26-post-fable-minifix-mock-eval.json` produced the local evidence above.
- Final broader verification passed:
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts`: 6 files / 398 tests passed.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx eslint src/ai/tableRead.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts` passed.
  - `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
  - `npm run harness:long-tasks` passed.
  - `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
  - `npm run harness:check` passed.
  - `git diff --check` passed with LF/CRLF warnings only.

Next step:

- Give `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md` to Fable5 if external review is desired now.
- Do not keep chasing mock templates locally unless Fable5 finds a mechanism-level gap.
- The next engineering step after quota is available is a bounded paid live Mimo Day 1 sample of 6-9 speeches, then manual read plus `sampleMetrics`.
- Do not start phase 3 token-cost reduction.

## 2026-06-11 v27 External Review Decision And Live Gate

External review decision:

- v26 is accepted as the end of local mock polishing.
- Remaining mock `sampleMetrics` warnings are gates, not fix targets.
- Do not continue expanding phrase bans or mock template rewrites unless a warning reproduces in live accepted-output text or causes fallback transcript pollution.

Small follow-up implemented before live:

- Mock bridge reuse avoidance now checks a wider visible game window: recent speeches, seat `lastSpeech`, and `tableMemory.speechInfluence`, not only the last few `recentSpeeches`.
- `repeated_clause_rate` keeps the 15+ Chinese-character / 2-row main threshold and adds a conservative short-clause tier: 10-14 Chinese characters must repeat in 3+ rows before warning.
- Confirmed v26 seed 91 axis behavior: D1 dominant target was 1号 in 5/9 rows, so lack of `axis_concentration` was expected for D1. The partial D2 sample had 6号 in 4/5 rows, but the metric intentionally requires at least 6 rows before reporting.

Latest local gate evidence:

- `tmp/ordinary-mimo-v27-post-fable-gate-mock-eval.json`
- 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- `sampleMetrics` still reports 2 warnings:
  - `repeated_surface_phrase`: `这票不是空压我听` at `2/15`;
  - `repeated_clause_rate`: a normalized pressure-record clause at `2/15`.
- These warnings are retained as report-only gates.

Live preflight and acceptance standard:

- Before any bounded paid live sample, run a 1-call Mimo probe with the same temporary process env key and same model route. If this returns provider error, quota error, or fallback-only output, stop without spending the rest of the sample budget.
- Bounded live D1 sample target: 6-9 ordinary Day 1 speech calls only.
- Acceptance gate:
  - hard rule/public-info/private-info/death/identity errors: 0;
  - fallback rows: at most 1, and fallback rows are excluded from subjective style judgment;
  - no unfinished/cut-off accepted speech;
  - no cross-seat repeated long clause above `sampleMetrics` gate without a clear public-event reason;
  - manual read uses the ordinary speech contract v0.1: first-person motive, public/local table object, landed handling boundary, and varied seat/player feel across the mini-table.

Next step:

- Run the 1-call provider preflight with the temporary key.
- If preflight passes, run bounded live Mimo D1 6-9 speeches and present only non-fallback accepted speech rows for human read.
- If preflight fails, record provider/account state and stop; do not judge speech quality from fallback rows.

Preflight result:

- `tmp/ordinary-mimo-v27-live-preflight-report.json`
- `tmp/ordinary-mimo-v27-live-preflight-cases.json`
- 1 Day 1 speech call, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`.
- Provider returned HTTP 403 `insufficient_user_quota` on both attempts.
- The preflight failed, so the bounded 6-9 speech live sample was intentionally not run.
- This note is historical. A later v41 live probe with the current temporary route succeeded, so this is no longer the active blocker.

## 2026-06-12 v41 Live Mimo Probe And Fable5 Review Gate

Completed:

- Rechecked the user's quota concern with the current temporary Token Plan route.
- Confirmed the route is usable now:
  - direct provider request to the OpenAI-compatible `/v1/chat/completions` route returned HTTP 200;
  - 1-call project preflight completed with `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`.
- Ran a bounded live Mimo Day 1 speech sample:
  - `tmp/ordinary-mimo-v41-live-d1-cn-base-report.json`
  - `tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json`
  - `tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json`
- v41 result:
  - 8 speech calls, 0 action calls;
  - `fallbackCount 0`;
  - `errorCount 0`;
  - `validationFailureCount 0`;
  - `totalQualityIssues 0`;
  - providers all `custom-speech:mimo-v2.5-pro`;
  - local existing-case eval averageScore 100, issueCount 0, highRiskCaseIds empty.
- Stopped local implementation at the subjective quality gate and updated the Fable5 review pack:
  - `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md`

Important correction:

- Earlier 403/quota diagnosis should not be treated as current truth. The current key/base URL path works.
- The remaining issue is not provider stability or fallback. It is transcript feel: v41's first seat says `底牌不虚`, then seats 3/5/6/7 repeatedly chase the same `底牌不虚 + 信息少暂时不压票` contrast.

Current sample-level gate:

- `sampleMetrics` correctly warns:
  - `repeated_surface_phrase`: `信息少暂时不压票`, `4/8`;
  - `repeated_clause_rate`: `信息少暂时不压票这个`, `4/8`.
- These remain report-only. They should guide Fable/user review, not force fallback.

Current local judgment:

- Do not continue broad local mock polishing.
- Do not add another soft word ban just for `底牌不虚`.
- Ask Fable5 to judge whether:
  - `底牌不虚` is a plausible D1 low-info human phrase or too identity-loaded;
  - the 3/5/6/7 same-axis pursuit is acceptable table behavior or too prompt-patterned;
  - 2号 Witch ending at `我先说一下为什么现在跳。` should be covered as an unfinished accepted speech.

Verification:

- Focused code tests for the v37-v41 live defects passed:
  - `npm run test -- src/ai/speechProviders.test.ts -t "ordinary soft-director action candidates|ordinary death shape|bounded low-info first-seat water|visible player-jargon|already-spoken seat|first-seat future audit|truncated ordinary speech ending|peaceful-night"`
  - `npm run test -- src/ai/llmEvaluation.test.ts -t "public witch save|future audit hooks|malformed JSON|short repeated clauses|repeated bridge clauses|summarizes ordinary"`
  - `npm run test -- src/game/tableMemory.test.ts`
- Final broader verification passed:
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts`: 7 files / 408 tests passed.
  - `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json --json --out=tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json`: averageScore 100, issueCount 0, sampleMetrics retained 2 report-only warnings.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx eslint src/ai/tableRead.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/game/tableMemory.ts src/game/tableMemory.test.ts` passed.
  - `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
  - `npm run harness:long-tasks` passed.
  - `npm run harness:check` passed.
  - `git diff --check` exited 0 with LF/CRLF warnings only.

## 2026-06-12 Fable5 v41 Narrow Fixes

Completed:

- Applied the three required Fable5 fixes as narrow code/test changes:
  - repeated-axis steering remains active when `currentPressure` is `publicRoleClaim`, while `roleHandle` remains available;
  - forward-commitment endings such as `我先说一下为什么现在跳。` and `我现在想换个方向看。` are treated as `普通局发言疑似被截断`, retried once, and then cut at the trailing promise if the retry still returns the same soft-only defect;
  - `buildEvalCaseFromAiLog` now counts public cue references from `recentSpeeches`, `speechInfluence`, and `voteLeaders`, not only `reasoningCues`.
- Added provider-level coverage for the double-render forward-commitment case: attempts=2, `isFallback=false`, final speech keeps the Witch claim and silver-water information but drops `我先说一下为什么现在跳。`.
- Added evaluator coverage for forward-commitment endings in both `analyzeLlmCallQuality` and `analyzeOrdinaryAiEvalCase`, plus a landed follow-up negative case.
- Added eval-utils coverage proving a `publicSummary.recentSpeeches` quote can produce `availablePublicCueCount > 0` and `referencedPublicCueCount > 0`.

Verification:

- `npm run test -- src/ai/speechProviders.test.ts -t "repeated-axis|forward commitment|cut-off seat reference|soft"` passed: 10 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "malformed|forward commitment"` passed: 2 tests.
- `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` passed: 2 tests.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 7 files / 413 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json --json --out=tmp/ordinary-mimo-v41-live-d1-cn-base-after-fable5-narrow-fix-eval.json` passed: 8 cases, averageScore 95.5, issueCount 2, both `malformed_output_fragment`, highRiskCaseIds empty, sampleMetrics retained the same two report-only same-axis warnings.
- Important eval note: the old `tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json` persists `referencedPublicCueCount: 0`, so existing-case eval cannot backfill those counts. Rebuilding from the v41 report `inputSummary` in memory with the current constructor counted referenced public cues in 4/8 rows.
- `npx eslint src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:check` passed.
- `git diff --check` exited 0 with LF/CRLF warnings only.

Next step:

- Run a bounded live Mimo sample with the same seed covering `DAY_VOTE` plus one D2 round.
- Before any paid live call, only check whether the required Mimo environment variables are already set; do not print, write, or persist the key.
- Keep the same boundaries: no broad word ban for `底牌不虚`, no hard fallback expansion for subjective style, and no token-reduction work until phase 2 speech quality is accepted.

## 2026-06-12 v43 DAY_VOTE + D2 Live Env Gate

Completed:

- Prepared the next bounded live route after the Fable5 narrow fixes: same seed 91, `DAY_SPEECH,DAY_VOTE`, max 28 LLM calls, intended to include D1 vote plus one D2 round.
- Confirmed process/user/machine env do not currently expose the required Mimo variables.
- Checked local `.env` and `.env.local` for variable names only and did not print values.
- Ran two 1-call live preflights with local env-file candidates loaded only into temporary process env:
  - `tmp/ordinary-mimo-v43-live-preflight-report.json`
  - `tmp/ordinary-mimo-v43-live-preflight-cases.json`
  - `tmp/ordinary-mimo-v43-live-preflight-local-mimo-report.json`
  - `tmp/ordinary-mimo-v43-live-preflight-local-mimo-cases.json`
- Both local candidates failed with HTTP 401 `invalid_key`. These rows are fallback-only and are not Mimo speech-quality evidence.
- Added a local prompt helper at `tmp/run-mimo-day-vote-d2-live.ps1`. It first uses an existing process `AI_LLM_API_KEY` or `MIMO_LLM_API_KEY` if present; otherwise it prompts for a temporary key, writes only a per-process temp env file under `tmp`, runs the bounded live sample and eval, and deletes the temp env file in `finally`.
- Rechecked after repeated continuations: the helper remained on hidden token input, no v43 DAY_VOTE + D2 live report/cases/eval files existed, and the waiting helper was stopped. Latest status file records `blocked_waiting_for_valid_key`.

Verification:

- First 1-call preflight completed with `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`, provider error 401 `invalid_key`.
- Second 1-call preflight using the `.env.local` Mimo candidate completed with the same 401 `invalid_key` result.
- Clipboard check did not find a `tp-...` token, so no secure automatic injection path was available.

Next step:

- Provide a valid temporary Mimo key through process env only, then rerun the bounded live command and local eval.
- After the DAY_VOTE + D2 live report exists, prepare the compact Fable5 review pack and stop for review.
- Do not use the fallback-only 401 preflight rows for subjective speech judgment.

## 2026-06-12 v43 Live Completion And Post-live Hard Fixes

Completed:

- The v43 helper later received a valid temporary key through its prompt flow and completed the bounded live Mimo sample:
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-report.json`
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-cases.json`
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-eval.json`
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-latest-status.json`
- v43 reached the intended same-seed envelope: 28 calls, 16 speech, 12 action, D1 `DAY_SPEECH`, D1 `DAY_VOTE`, D2 `DAY_SPEECH`, and D2 `DAY_VOTE`; `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`.
- Local eval on v43 cases after the hard fixes wrote `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-after-hard-fixes-eval.json`: 28 cases, averageScore 99.3, issueCount 1, highRiskCaseIds empty.
- Fixed v43 hard defect 1: 3号 GPT recognizing 2号 Claude's Witch claim no longer creates a false GPT Witch claim or false `女巫对跳：Claude、GPT` public cue.
- Fixed v43 hard defect 2: true Witch D2+ old-save claims cannot say `昨晚/昨夜/夜里救的是...` unless the current night save actually happened. Old save briefing/fallback now uses `首夜`.
- Added the current Fable5 review pack: `docs/evaluations/2026-06-12-ordinary-mimo-v43-day-vote-d2-fable5-review.md`.

Verification:

- `npm run test -- src/game/claims.test.ts -t "quoted witch-claim wording|recognizing another player's witch claim|concise ordinary witch save|seat-only comma|silver-water recipient"` passed: 5 tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "stale last-night wording|true witch to name"` passed: 2 tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "repeated-axis|forward commitment|cut-off seat reference|soft"` passed: 10 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "malformed|forward commitment"` passed: 2 tests.
- `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` passed: 2 tests.
- `npm run test -- src/game/claims.test.ts src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 8 files / 441 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json --json --out=tmp/ordinary-mimo-v41-live-d1-cn-base-after-v43-hard-fixes-eval.json` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-cases.json --json --out=tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-after-hard-fixes-eval.json` passed.

Next step:

- Stop for Fable5/user review of `docs/evaluations/2026-06-12-ordinary-mimo-v43-day-vote-d2-fable5-review.md`.
- If Fable5 requires fresh proof after the post-v43 hard fixes, run another bounded live Mimo sample with the same seed and `DAY_SPEECH,DAY_VOTE` envelope covering `DAY_VOTE` plus one D2 round.
- Keep the same boundaries: no broad word ban, no hard fallback expansion for subjective style, no token reduction before phase 2 quality is accepted, and no API key persistence.

## 2026-06-12 v44 Post-Fable Live And Self-Witch Guard

Completed:

- Ran the same-seed bounded live Mimo proof after the v43 Fable5 required fixes:
  - `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-report.json`
  - `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-cases.json`
  - `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-eval.json`
- v44 covered D1 `DAY_SPEECH`, D1 `DAY_VOTE`, D2 `DAY_SPEECH`, and D2 `DAY_VOTE`: 28 calls, 16 speech, 12 action, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`, and 24/28 exported cases with referenced public cues.
- Replayed v43 with the current eval construction: `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-post-fable5-review-eval.json` now reports 10 `speech_vote_discontinuity` issues, proving the former vote-continuity evaluator was silent and the new one is not.
- Found and fixed one new hard v44 defect locally: a non-Witch villager accepting a misattributed self-Witch identity (`你说我是女巫，这个身份我认`) now fails provider validation and is flagged by ordinary eval as `logic_boundary_error`.
- Re-evaluated v44 after the self-Witch guard:
  - `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-after-self-witch-fix-eval.json`
  - 28 cases, averageScore 98.2, issueCount 2, one high-risk `logic_boundary_error` on the historical v44 D2 3号 row.
- Added the current review pack:
  - `docs/evaluations/2026-06-12-ordinary-mimo-v44-post-fable5-live-review.md`

Verification:

- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity"` passed.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity|repeated-axis|forward commitment|cut-off seat reference|soft"` passed: 11 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity|malformed|forward commitment|vote continuity"` passed: 4 tests.
- `npm run test -- src/game/claims.test.ts src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 8 files / 449 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/seatMemory.ts src/ai/seatMemory.test.ts src/ai/tableRead.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.

Next step:

- Stop for Fable5/user review of `docs/evaluations/2026-06-12-ordinary-mimo-v44-post-fable5-live-review.md`.
- Ask Fable5 to decide whether the self-Witch guard requires one more same-seed paid bounded live rerun, whether the v44 single provider fallback requires a clean rerun, and whether the `先听一圈再看` same-axis pressure should be fixed now or left as a diversity follow-up.
- Do not run another paid live sample, expand phrase bans, widen hard fallback, or start token reduction unless Fable5/user explicitly asks.

## 2026-06-12 v46 Final Acceptance Gate

Completed:

- Applied the latest Fable5 hard-fact follow-up as a narrow fix:
  - Provider/action/eval now reject public-check attributions that are not grounded in the public claim board.
  - The check resolves both numeric targets and visible names, covering `8号Kimi报了GPT查杀` as well as `8号Kimi报3号GPT查杀`.
  - Forward-commitment truncation now catches tail variants such as `有个更让我别扭的地方。`.
  - Eval case construction persists `metadata.aliveSeats` names and summarized `metadata.publicClaimBoard`.
- Re-ran same-seed bounded live Mimo after the fix:
  - `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-report.json`
  - `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-cases.json`
  - `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-eval.json`
  - `tmp/ordinary-mimo-v46-post-action-check-live-latest-status.json`
- Added the final acceptance gate note:
  - `docs/evaluations/2026-06-12-ordinary-mimo-v46-final-acceptance-gate.md`

Verification:

- `npm run test -- src/ai/actionProviders.test.ts -t "fabricated.*public check|public check result"` passed: 1 test.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "fabricated attribution|forward commitment|vote continuity"` passed: 3 tests.
- `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` passed: 5 tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "repeated-axis|forward commitment|cut-off seat reference|soft|fabricated public check"` passed: 11 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "malformed|forward commitment|fabricated attribution|vote continuity"` passed: 4 tests.
- `npm run test -- src/ai/actionProviders.test.ts -t "fabricated.*public check|public check result|speech-vote continuity|public vote reason"` passed: 7 tests.
- `npm run test -- src/game/claims.test.ts src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 8 files / 453 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/seatMemory.ts src/ai/seatMemory.test.ts src/ai/tableRead.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v45-post-hard-fix-live-20260612-171950-cases.json --json --out=tmp/ordinary-mimo-v45-post-hard-fix-live-20260612-171950-after-action-check-fix-eval.json` passed.
- v46 local eval result: 28 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Acceptance scans on v46 found 0 `malformed_output_fragment`, 0 `logic_boundary_error`, 0 `speech_vote_discontinuity`, 0 ungrounded public-check attributions, and 0 forward-commitment tail hits.
- Secret scan for the provided Mimo key prefix returned no repository/tmp matches.

Next step:

- Send v46 to final user acceptance. Do not request another Fable5 review unless the user asks for a subjective style pass or a no-fallback sample.
- Residual risk: v46 still had `fallbackCount 3` / `errorCount 3`; one D2 Werewolf fake-Seer claim was fallback-generated. It is game-legal and passed hard gates, but it is not pure Mimo output.
- Keep the same boundaries: no broad phrase bans, no wider hard fallback expansion, no token-reduction work before user acceptance.

## Handoff

```text
Completed:
- ...

Changed files:
- ...

Verification:
- ...

Remaining risks:
- ...
```

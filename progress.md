# Session Progress Log

## Current State

**Last Updated:** 2026-06-15 15:00 Asia/Shanghai
**Session ID:** ai-pool-mobile-redesign
**Active Feature:** AI pool desktop/mobile UI redesign.

## Status

### Current Priority

- Current task card: `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`.
- Current branch: `codex/12p-mimo-speech-mechanics`.
- User direction: apply Fable5's mechanism-level advice first, then validate in the 12-player `12p-sheriff-seer-witch-hunter-guard` sample.
- Local implementation is in place for ordinary speech identity dispersion, incoming private pressure/self-history, stronger shared pressure budget language, and non-ritual previous-speaker openings.
- Fable5 review returned "continue": the directions are right, but 12p needs public role-claim move diversification, sheriff speech action-path texture, stale self-history target cleanup, and fallback claim-bridge de-dup.
- The Fable5 follow-up code is implemented and locally verified. The final post-retryfix bounded 12p rerun reached the mechanism gate: fallback 1/50, validation failures 0, local eval averageScore 98.2, highRiskCaseIds empty.
- Local verification passed for focused speech-provider tests, full `src/ai/speechProviders.test.ts`, `src/ai/llmEvaluation.test.ts`, TypeScript, lint, and task-card checks.
- 12-player paid Mimo validation was not run in this session because current process/user/machine env had no `AI_LLM_API_KEY`, `MIMO_LLM_API_KEY`, `MIMO_LLM_BASE_URL`, `AI_LLM_BASE_URL`, or related provider variables set.
- Later in this session, the user provided a temporary key/base URL through a visible PowerShell prompt. The 12p bounded sample and local eval completed without persisting secrets.
- The local full-game mock gate passed, but the later small paid 12p full-feel sample exposed go-blockers: sheriff speech action output leaked private wolf intent (`隐藏狼队视角`) and one accepted D2 speech ended as a fragment (`刚才9号DeepSeek2说的`).
- Opus 4.8 chose `bounded-rerun` for the post-livefix evidence. The first approved same-seed 60-call paid rerun failed on one accepted fragment; the provider hardgate fixed that class locally.
- The next user-approved bounded paid proof cleared private wolf-strategy leakage and the previous `刚才X说的` fragment class, but exposed one new accepted empty-rebuttal tail: D1 4号 ended at `别光说`.
- The empty-rebuttal tail class is now fixed locally and mock-regressed.
- Opus 4.8 then judged the next blocker as public check / role-claim boundary pollution: non-Seer claims could carry structured `checks` and make the table read "Hunter reported a black check".
- The public check / identity-claim boundary is now fixed and paid-verified: non-Seer claims no longer store/expose structured `checks`; Seer claims, including wolf counterclaims that claim Seer, still keep checks.
- A new paid full-game 12p Mimo sample completed through day 3 `GAME_OVER` with 85 real calls and a GOOD win. Old hard gates were clean: exact private-strategy leak 0, accepted fragment 0, non-Seer claimBoard checks 0.
- Opus review chose `continue` because the D3 contradictory claimed-Seer attribution is the same hard class as structured check ownership pollution.
- The cross-Seer attribution boundary is now fixed locally in `src/game/claims.ts`: quoted checks attributed to another seat/pronoun are not attached to the current speaker, and one claimed Seer cannot carry both results on the same target.
- A user-approved bounded paid proof after that fix completed a 1-call preflight and a 60-call proof. The proof reached day 2 `DAY_VOTE`, with fallback 2/60, validationFailure 0, and hard scans clean: claimed-Seer contradictions 0, non-Seer checks 0, private leak 0, accepted fragment 0.
- Opus review judged that evidence as `partial-pass`: the fix direction is sound, but the proof did not reach D3 and therefore did not resample the original dead-Seer old-check quote trigger.
- B-class evaluator false positive is now calibrated offline. Re-evaluating the 60 proof cases improved averageScore from 98.1 to 98.6, removed `logic_boundary_error`, and cleared highRiskCaseIds.
- The longer same-seed D3 paid proof ran to 90 calls and reached D4 `DAY_SPEECH`, but it failed the A gate on non-conflicting 8号 Kimi cross-Seer check pollution and failed the accepted-fragment gate on 7号 GLM ending at `重点全在`.
- The 8号 Kimi attribution pollution and `重点全在` focus-marker fragment are fixed locally and covered by red/green regressions in `src/game/claims.test.ts`, `src/ai/speechProviders.test.ts`, and `src/ai/llmEvaluation.test.ts`.
- A fresh user-approved D3 paid proof then reached D4 `DAY_SPEECH`, with private leak 0, accepted fragment 0, non-Seer checks 0, and claimed-Seer same-target contradictions 0, but still failed the claim attribution gate: 8号 Kimi self-reported `昨晚验的2号Claude，查杀` while the board stored 8->2 `GOOD` after misreading `2号Claude刚才报的金水`.
- The target-as-subject quoted-report bug is now fixed locally and covered by a red/green regression. Current local extraction returns 8->2 `WEREWOLF` for the fresh-proof Kimi text.
- External review chose `continue-local`: do not rerun paid proof until the extractor stops broad self-owned check extraction plus quote blacklisting. That structural follow-up is now implemented with bounded check/report verb classes and two-sided regressions.
- B-class public-check evaluator calibration was also refreshed offline. Re-eval of the existing fresh D3 cases now removes the 3号 GPT legal public-check quote from high-risk; the two remaining `logic_boundary_error` rows are stale-board derivatives from the already-failed Kimi metadata, and the third high-risk is an unrelated dead-target follow-up.
- The user switched the temporary live proof provider to DeepSeek. A DeepSeek-chat same-seed run completed day 3 `GAME_OVER` with old hard gates clean, but exposed a new self-owned check omission: 11号 GPT2 said `1号DeepSeek，我昨晚验的你，查杀` and the old exported board still stored 11号 as `SEER` with `checks: []`.
- That target-before-pronoun self-check shape is fixed locally and covered by regression. A fresh post-pronounfix DeepSeek proof then reached day 4 `DAY_SPEECH` with old hard gates clean, but exposed a same-sentence mixed attribution bug: `2号Claude跳预言家报9号查杀...因为我是预言家，昨晚验的2号Claude，查杀` left 4号 豆包 as claimed Seer with `checks: []`.
- The same-sentence quote-plus-self-check shape is now fixed locally by scoping quote attribution to the local clause around the candidate check.
- To control cost, the paid rerun loop is now paused. The known live attribution shapes were converted into a deterministic local invariant matrix, and current extraction was replayed over existing paid/live cases.
- The local rescan wrote `tmp/12p-claim-attribution-local-rescan.json`: 550 cases, 246 speech rows, 30 extracted Seer claims, `potentialMissingSelfCheckCount` 0, `staleBoardMismatchCount` 4 old metadata mismatches from pre-fix generated samples.
- The latest live proof is stale after the local clause fix, so this is not a live `go`; however, another paid proof should only be one final explicit-approval acceptance proof, not continued exploratory probing.
- Commit/review prep is now done locally: stale broad-test assertions were updated, full `npm.cmd run test` passed 100 files / 1218 tests, `tsc`, `lint`, and `build` passed. Build still reports the existing Turbopack NFT trace warning.
- Do not write or persist API keys. Do not edit `.env`. The latest paid proof authorization has been spent; another live acceptance proof requires explicit user approval/provider input.
- The owner-token protected single-player sample export endpoint is now deployed on Tencent Cloud: `GET /api/games/:gameId/sample?token=...`. It uses `gameId` because single-player games do not have room codes, exports public view events/table summaries/speeches plus public-phase AI call summaries, and omits raw prompts/private events/night private knowledge.
- The player-facing `gameId` problem is now addressed and deployed on Tencent Cloud: active/finished single-player UI shows a copyable "反馈编号", `/alpha-report` auto-fills the latest local single-player feedback id, and `GET /api/games/samples?token=...` lists recent owner-protected single-player sample indexes so the owner can recover samples even when testers do not send an id.

### 2026-06-13 Cross-Seer Check Attribution Guard

Completed:
- Applied the Opus `continue` decision for the full-game paid sample.
- Added exact regressions for the D3 11号 GPT2 text that quoted 2号 Claude's old 1号金水 while claiming a new 1号查杀.
- Fixed `extractClaimChecks()` so `他之前报过...` / other-seat reported checks are not attributed to the current claimed Seer.
- Changed claim check dedupe to claimant+target, preventing a single claimed Seer from storing both `GOOD` and `WEREWOLF` for one target.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red tests first failed for the referenced old check and same-target contradiction.
- `npm.cmd run test -- src/game/claims.test.ts -t "referenced old check|contradictory checks"` passed.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 30 tests.
- `npm.cmd run test -- src/game/tableMemory.test.ts` passed: 7 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 368 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/ai/llmEvaluation.test.ts` passed: 45 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Decision:
- Still not `go` from paid evidence because this source fix landed after the paid full-game sample.
- Next run should be a bounded paid proof focused on D2/D3 claimed-Seer reference attribution and late-game public-check validator false-positive observation.

### 2026-06-14 Cross-Seer Bounded Paid Proof

Completed:
- Ran the user-approved cross-Seer attribution paid proof through a temporary
  visible PowerShell runner. The first 120-call runner was stopped after it
  produced no report/cases; the second runner completed a 1-call preflight and
  a 60-call proof.
- Held the Mimo base URL and key only in the runner process environment; no
  key was written to `.env`, docs, source, status JSON, logs, or command
  arguments.
- Ran local ordinary eval on the exported 60 proof cases.
- Scanned the proof for claimed-Seer same-target contradictions, non-Seer
  claimBoard checks, private leak terms, accepted fragment hard-shapes, and
  generated-file secret patterns.

Evidence:
- `tmp/12p-mimo-cross-seer-attribution-preflight-report.json`: 1 real Mimo
  action call, fallback 0, error 0, validationFailure 0.
- `tmp/12p-mimo-cross-seer-attribution-small-report.json`: 60 calls, reached
  day 2 `DAY_VOTE`, stopped at `max_llm_calls`, fallback 2, error 2,
  validationFailure 0, totalQualityIssues 0.
- `tmp/12p-mimo-cross-seer-attribution-small-eval.json`: 60 cases,
  averageScore 98.1, issueCount 6, highRiskCaseIds 1.
- Hard-gate scan: claimed-Seer same-target contradictions 0, non-Seer
  claimBoard checks 0, private leak exact hits 0, accepted fragment hard-shape
  hits 0.

Decision:
- Treat the cross-Seer attribution fix as live-clean in the bounded D2 envelope.
- Do not call full `go`: the proof did not reach D3 and therefore did not
  cover the original 11号 GPT2 / 2号 Claude old-check quote trigger.
- The remaining high-risk eval row looks like a legal public claimed-Seer check
  reference, not a new hard leak. Keep B observational unless review asks for
  evaluator calibration.
- Next concrete choice: send the partial proof to external/human review, or
  approve one longer paid proof with enough budget to reach D3.

### 2026-06-14 B-Class Evaluator Calibration After Cross-Seer Proof

Completed:
- Applied the Opus `partial-pass / longer-bounded-rerun` review result.
- Calibrated the B-class false positive before the longer paid proof, so the
  next rerun's local eval high-risk count is readable.
- Added a positive regression for the real 3号 GPT public-check quote:
  `我先接2号Claude的查验线，他报9号查杀...不过我听9号查杀前那句...`.
- Added a negative regression where the same `他报9号查杀` wording still fails
  if `publicClaimBoard` lacks 2号 Claude's 9号查杀.
- Tightened evaluator report verbs so `查验线` / `查杀前那句` are no longer
  misread as check-report syntax.

Changed files:
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red regression first failed for the real 3号 GPT high-risk row.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "public seer claims"` passed.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-small-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-small-after-b-calibration-eval.json` passed: 60 cases, averageScore 98.6, issueCount 5, `logic_boundary_error` 0, highRiskCaseIds empty.

Decision:
- B is calibrated offline and should not consume paid calls.
- Next proof should be one longer same-seed 91 paid run, roughly 90-100 calls,
  to reach D3 and manually verify fake-Seer / dead-Seer old-check attribution.

### 2026-06-14 Longer D3 Paid Proof Local Follow-up

Completed:
- Ran the user-approved longer same-seed D3 proof with temporary process env
  provider credentials only. It reached D4 `DAY_SPEECH` after D3
  `DAY_SPEECH`/`DAY_VOTE` and stopped at `max_llm_calls`.
- Manually reviewed the exported `publicClaimBoard` metadata for the
  non-conflicting attribution path Opus highlighted.
- Added local regressions and fixes for the two new hard failures:
  8号 Kimi's quoted 1号->2号 check was attached to 8号's own Seer claim, and
  7号 GLM's accepted speech ended at the unfinished focus marker `重点全在`.
- Replayed the old D3-90 eval cases through the updated local evaluator so the
  accepted fragment is now counted as `malformed_output_fragment`.

Evidence:
- `tmp/12p-mimo-cross-seer-attribution-d3-90-report.json`: 90 calls, 33 speech,
  57 action, reached D4 `DAY_SPEECH`, fallback/error 9/90,
  validationFailure 6, report quality issue only `speech_vote_discontinuity`.
- `tmp/12p-mimo-cross-seer-attribution-d3-90-eval.json`: 80 cases,
  averageScore 99.1, issueCount 4, highRiskCaseIds 1.
- Hard scan/manual board review: claimed-Seer same-target contradictions 0 and
  non-Seer checks 0, but 8号 Kimi carried an invalid extra 8->2 `WEREWOLF`
  check after quoting 1号's 2号查杀.
- `tmp/12p-mimo-cross-seer-attribution-d3-90-after-localfix-eval.json`:
  80 cases, averageScore 98.9, issueCount 5, `malformed_output_fragment` 1.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/ai/speech/ordinarySurface.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red tests first failed for the 8号 Kimi cross-Seer attribution pollution and
  the `重点全在` accepted fragment.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 31 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 369 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/claims.test.ts src/game/tableMemory.test.ts` passed: 83 tests.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-d3-90-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-d3-90-after-localfix-eval.json` passed: 80 cases, averageScore 98.9, issueCount 5, `malformed_output_fragment` 1.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Decision:
- Not `go`: the longer D3 proof reached the target envelope but failed two
  hard gates.
- The local fixes are now narrow and test-backed; do not continue local
  regex-only work without a fresh live failure.
- Next step is one fresh bounded same-seed D3 paid proof after explicit user
  approval/provider input. Acceptance must include no Kimi-style non-conflicting
  quoted-check pollution, no accepted fragment, old hard gates at 0, and no
  B-class high-risk evaluator false positive.

### 2026-06-14 Fresh D3 Paid Proof And Target-Subject Fix

Completed:
- Ran the user-approved fresh same-seed bounded D3 proof with temporary process
  env provider credentials only.
- Ran local ordinary eval on the exported cases.
- Scanned hard gates and manually reviewed the 8号 Kimi claimBoard mismatch.
- Added a red regression for target-as-subject quote pollution:
  `2号Claude刚才报的金水` must not suppress Kimi's own
  `昨晚验的2号Claude，查杀`.
- Fixed `sentenceReferencesOtherClaimCheck()` so target-as-subject quoted
  report cues are skipped while legal self-owned checks still parse.

Evidence:
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-status.json`: proof command
  completed successfully, exitCode 0.
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-report.json`: 90 calls,
  33 speech, 57 action, reached D4 `DAY_SPEECH`, fallback/error 11/90,
  validationFailure 4, totalQualityIssues 0.
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-eval.json`: 80 cases,
  averageScore 97.6, issueCount 8, highRiskCaseIds 4.
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-hardscan.json`: private leak 0,
  accepted fragments 0, non-Seer checks 0, claimed-Seer same-target
  contradictions 0.
- Hard failure: 8号 Kimi's D2 speech said `我是预言家，昨晚验的2号Claude，查杀`,
  but `publicClaimBoard` stored 8->2 `GOOD` after misreading
  `我现在更在意的是2号Claude刚才报的金水`.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red regression first failed with 8->2 `GOOD`.
- `npm.cmd run test -- src/game/claims.test.ts -t "quoted target's report|seat-name seer reports|counterclaim speech|referenced old check"` passed.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 32 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts` passed: 52 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 369 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Decision:
- Not `go`: the fresh D3 proof reached the needed envelope but failed the
  claim attribution hard gate.
- The new target-as-subject failure is locally fixed and test-backed.
- Do not spend another paid proof automatically. Next live acceptance proof
  requires explicit user approval/provider input.

### 2026-06-14 Fresh D3 External Review Prompt

Completed:
- Created a focused external review package at
  `docs/evaluations/2026-06-14-12p-mimo-fresh-d3-target-subject-review-prompt.md`.
- The prompt asks the reviewer to choose `rerun-now`, `continue-local`, or
  `review-only`, with specific questions about fresh proof high-risk rows,
  target-as-subject attribution, and the minimal next paid proof scope.
- The package explicitly marks vote-reason sameness, repeated phrases, and
  rolePublicAction skew as report-only unless the reviewer finds a mechanism
  failure.

Changed files:
- `docs/evaluations/2026-06-14-12p-mimo-fresh-d3-target-subject-review-prompt.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm.cmd run harness:long-tasks` passed.
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over the review package and state docs found 0 matches.

### 2026-06-14 Continue-Local Structural Attribution Fix

Completed:
- Applied the external `continue-local` review result.
- Reframed `src/game/claims.ts` away from broad self-owned extraction plus
  quote blacklist: owned checks now require an owned check verb (`验/查/摸`
  style) with speaker or omitted subject, while report/quote verbs
  (`报/说/称/给/留`) and other-seat/pronoun subjects do not create speaker
  `checks`.
- Added a two-sided regression for the exact structural risk:
  `2号Claude给的金水` and `4号豆包留的2号查杀` are ignored as Kimi checks, but
  `昨晚验的2号Claude，查杀` still becomes Kimi's self-owned fake-Seer check.
- Added evaluator calibration for the fresh D3 legal public-check quote:
  `我先接一下2号Claude。他刚才报了12号豆包2金水...他自己第一天报的也是9号DeepSeek2查杀`.
- Re-evaluated the existing fresh D3 cases offline without another paid call.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`
- `docs/evaluations/2026-06-14-12p-mimo-fresh-d3-target-subject-review-prompt.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Evidence:
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`:
  80 cases, averageScore 98, issueCount 7, `logic_boundary_error` 2,
  highRiskCaseIds 3.
- The previous 3号 GPT legal public-check quote is no longer high-risk.
- Remaining `logic_boundary_error` rows reference the stale fresh-proof Kimi
  board with 8->2 `GOOD`; they cannot validate the new extraction because the
  metadata was produced before the structural fix.

Verification:
- `npm.cmd run test -- src/game/claims.test.ts -t "classifies quoted report verbs"` failed first, then passed after the structural fix.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 33 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "allows non-seers to quote checks"` failed first, then passed after evaluator calibration.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts` passed: 73 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 381 tests.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Decision:
- Continue-local is complete for the known bug class.
- Do not spend another paid proof automatically.
- Next proof, if approved, should be same seed 91, single game, about 90-100
  calls, covering SHERIFF and D1/D2/D3 `DAY_SPEECH`/`DAY_VOTE`, and only
  counts if it actually produces a wolf/fake-Seer quote of another claimed or
  dead Seer's old check.

### 2026-06-14 DeepSeek D3 Proof And Pronoun Self-Check Fix

Completed:
- Switched the temporary live proof provider to DeepSeek at the user's request.
- Ran a 1-call preflight and one same-seed DeepSeek-chat bounded D3 proof with
  temporary process env only.
- Ran local ordinary eval and hardscan on the exported cases.
- Manually inspected the D3 11号 GPT2 fake-Seer line and the later
  `publicClaimBoard`.
- Added a regression and parser fix for target-before-pronoun self-owned Seer
  checks such as `1号DeepSeek，我昨晚验的你，查杀`.

Evidence:
- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-structural-proof.md`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-preflight-report.json`:
  1 action call, fallback 0, error 0, validationFailure 0.
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-report.json`:
  completed 1/1 game, 85 calls, 30 speech, 55 action, day 3 `GAME_OVER`,
  fallback 3, error 3, validationFailure 0.
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-eval.json`:
  80 cases, averageScore 98.6, issueCount 6, highRiskCaseIds empty.
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-hardscan.json`:
  private leak 0, accepted fragment 0, malformed fragment 0, non-Seer checks
  0, claimed-Seer same-target contradictions 0.

Hard local finding:
- The run did not reproduce the original dead-Seer old-check quote trigger.
- It did expose the reverse side of the attribution fix: 11号 GPT2 claimed Seer
  and said `1号DeepSeek，我昨晚验的你，查杀`, but the exported board recorded
  11号 GPT2 as `SEER` with `checks: []`.
- This should be a self-owned fake-Seer check, 11->1 `WEREWOLF`.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/ai/speech/ordinarySurface.ts`
- `src/ai/speech/ordinarySurface.test.ts`
- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-structural-proof.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red regression first failed with `checks: []`.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 34 tests.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts src/ai/speech/ordinarySurface.test.ts`
  passed: 75 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm.cmd run harness:long-tasks` passed.
- JSON parse for `long_running_tasks.json` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over touched source/docs/state found 0 matches.

Decision:
- Not `go`: the DeepSeek-chat proof is stale for live acceptance because the
  target-before-pronoun parser fix landed after the report/cases were
  generated.
- The current Codex process has no visible temporary DeepSeek/Mimo provider env.
- Next proof requires fresh provider input and should check both sides of the
  boundary: quoted checks stay out of speaker checks, and self-owned fake-Seer
  checks are retained.

### 2026-06-14 DeepSeek D3 Proof After Pronoun Fix

Completed:
- Read the user's screenshot and confirmed the fresh `after-pronounfix` full
  run was still executing in the external PowerShell terminal.
- Waited for the external `llm:evaluate` process to finish and then ran local
  ordinary eval on the exported cases.
- Generated `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-hardscan.json`.
- Manually reviewed the three high-risk rows and traced them to a missing 4号
  self-owned fake-Seer check.
- Added a red regression for the same-sentence mixed attribution shape and fixed
  the extractor by scoping quote ownership to the local clause around each
  candidate check.

Evidence:
- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-pronounfix-proof.md`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-report.json`:
  100 calls, 33 speech, 67 action, reached day 4 `DAY_SPEECH`, stopped at
  `max_llm_calls`, fallback/error 1/100, validationFailureCount 1.
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-eval.json`:
  80 cases, averageScore 97.7, issueCount 8, highRiskCaseIds 3.
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-hardscan.json`:
  private leak 0, accepted fragment 0, malformed fragment 0, non-Seer checks
  0, claimed-Seer same-target contradictions 0.

Hard local finding:
- 4号 豆包 said
  `2号Claude跳预言家报9号查杀，我先不听这个，因为我是预言家，昨晚验的2号Claude，查杀。`
- The exported board recorded 4号 豆包 as `SEER` with `checks: []`.
- Later legal references to 4号's 2号查杀 were then flagged as
  `logic_boundary_error`; those high-risk rows are downstream stale-board
  symptoms, not pure evaluator false positives.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-pronounfix-proof.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm.cmd run test -- src/game/claims.test.ts -t "same-sentence self-owned check"` failed first with `checks: []`, then passed.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 35 tests.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts src/ai/speech/ordinarySurface.test.ts`
  passed: 76 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm.cmd run harness:long-tasks` passed.
- JSON parse for `long_running_tasks.json` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over touched source/docs/state found 0 matches.

Decision:
- Not `go`: the fresh post-pronounfix proof reached the target envelope but
  failed the self-owned structured-check side.
- The local clause-scoped fix is now test-backed, but live proof is stale again.
- Do not spend another paid proof automatically.

### 2026-06-14 Local Attribution Invariant Suite And Rescan

Completed:
- Paused paid model reruns for the claim-attribution line after repeated paid
  proofs kept finding new phrasing variants in the same bug class.
- Added a six-case live-shape invariant matrix in `src/game/claims.test.ts`.
  It covers dead-Seer old-check quote, target-before-pronoun self-check,
  target-as-subject quote before self-check, report verbs, same-sentence quote
  plus self-check, and current-Seer quote after own counterclaim.
- Replayed current extraction over existing paid/live case files without any
  provider calls and wrote `tmp/12p-claim-attribution-local-rescan.json`.

Evidence:
- Local rescan covered 6 case files, 550 cases, 246 speech rows, and 30
  extracted Seer claims.
- `potentialMissingSelfCheckCount`: 0.
- `staleBoardMismatchCount`: 4, all from old exported board metadata produced
  before the latest extractor fixes.

Changed files:
- `src/game/claims.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-pronounfix-proof.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm.cmd run test -- src/game/claims.test.ts -t "live seer-check attribution invariant"` passed: 6 tests.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 41 tests.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts src/ai/speech/ordinarySurface.test.ts`
  passed: 82 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm.cmd run harness:long-tasks` passed.
- JSON parse for `long_running_tasks.json` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over touched source/docs/state found 0 matches.

Decision:
- Treat continued exploratory paid reruns as too expensive for this stage.
- Current local evidence says the extractor has no known missed self-owned
  Seer check across the existing case corpus.
- Remaining live risk is bounded to one final acceptance proof, only after the
  user explicitly approves provider use.

### 2026-06-14 Commit / Review Prep

Completed:
- Ran the full local test suite for branch readiness after stopping paid
  exploration.
- Fixed stale test expectations in `src/ai/expertStrategy.test.ts`,
  `src/ai/tableRead.test.ts`, and `src/game/engine.test.ts`; these were
  assertion drift around current prompt/audit labels, mock-speech wording, and
  the guided speech contract.
- Raised the 1000 mock-game engine test timeout from 90s to 150s after the test
  completed in about 99s locally.

Verification:
- `npm.cmd run test -- src/ai/expertStrategy.test.ts src/ai/tableRead.test.ts src/game/engine.test.ts`
  passed: 156 tests.
- `npm.cmd run test` passed: 100 files, 1218 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the existing Turbopack NFT trace warning.

### 2026-06-13 12p Paid Full-Game Mimo After Hardgate

Completed:
- Used a visible temporary PowerShell runner to collect Mimo base URL and key into process env only.
- Ran the requested paid Mimo full-feel sample and local ordinary eval.
- Wrote the review pack at `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`.

Evidence:
- `tmp/12p-mimo-fullfeel-paid-after-hardgate-report.json`: 1/1 game completed, day 3 `GAME_OVER`, winner GOOD, 85 real calls, 30 speech, 55 action, fallback 5, error 5, validationFailure 3.
- `tmp/12p-mimo-fullfeel-paid-after-hardgate-eval.json`: 80 cases, averageScore 99.2, issueCount 3, highRiskCaseIds 1.
- Hard-gate scan: exact private-strategy leak hits 0, accepted fragment hits 0, non-Seer claimBoard entries with checks 0.
- New structural finding: one unique contradictory Seer claim attribution shape appeared across 9 case rows. 11号 GPT2 claimed Seer with 1号 DeepSeek both `WEREWOLF` and `GOOD`, apparently because the sentence quoted 2号 Claude's old 1号金水 while 11号 claimed a new 1号查杀.
- Fallback diagnostics still show repeated `凭空引用未公开查验结果` in D1/D2/D3 vote or speech rows.

Decision:
- Do not call this full-game paid sample `go` yet without Opus/human review.
- The likely next narrow cut, if review agrees, is claim attribution when a claimed Seer references another claimed/dead Seer's prior check in the same sentence.
- Do not start broad phrase bans, another local mock/evaluator loop, or a large rewrite.

### 2026-06-13 Paid Claim-Boundary Proof

Completed:
- Ran the user-approved post-claim-boundary paid proof with temporary process env only.
- Ran local ordinary eval on the exported cases.
- Scanned the proof for non-Seer claimBoard check ownership, non-Seer own-check statements, private leaks, and accepted fragment shapes.

Evidence:
- `tmp/12p-mimo-claim-boundary-paid-preflight-report.json`: 1 real Mimo action call, fallback 0, error 0, validationFailure 0.
- `tmp/12p-mimo-claim-boundary-paid-proof-report.json`: 60 calls, reached day 2 `DAY_VOTE`, fallback 2, error 2, validationFailure 1.
- `tmp/12p-mimo-claim-boundary-paid-proof-eval.json`: 60 cases, averageScore 97.8, issueCount 6, highRiskCaseIds 2.
- Hard-gate scan: non-Seer claimBoard entries with checks 0, non-Seer own-check statements 0, private leak hits 0, accepted fragment hard-shape hits 0.

Decision:
- The public check / identity-claim boundary hard gate passed live.
- The two high-risk local eval rows are legal public-check references by non-Seer speakers, not new private information or non-Seer-owned checks.
- The remaining `malformed_output_fragment` is a complete vote reason and should be treated as report-only unless human review disagrees.

### 2026-06-13 Public Claim Check Boundary Guard

Completed:
- Followed Opus 4.8's recommendation to fix one more mechanism class before spending another paid proof.
- Fixed claim extraction/upsert so structured `checks` are only retained when `claimedRole === "SEER"`.
- Added claim-board defense for old or manually constructed dirty state, so non-Seer claims export `checks: []` and summaries do not say "查杀/金水".
- Kept Seer checks intact; this preserves legitimate wolf counterclaims that publicly claim Seer.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red tests first failed for non-Seer public check wording and non-Seer claimBoard checks, then passed after the fix.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 28 tests.
- `npm.cmd run test -- src/game/tableMemory.test.ts` passed: 7 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 368 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/ai/llmEvaluation.test.ts` passed: 44 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Structure scan of `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-cases.json`: 146 cases, non-Seer claims with checks 0, Seer claims with checks 267.

Notes:
- A broad `src/game/engine.test.ts` run still has 6 pre-existing text-expectation failures in mock speech/guidance wording. They do not point at the claim-boundary fix and were not changed in this narrow pass.

Decision:
- Do not run paid proof until the user explicitly approves it.
- The next paid proof, if approved, should be the same small SHERIFF/D1-D2 bounded envelope and should check that non-Seer public claims never speak as if they own checks.

### 2026-06-13 Final Bounded Rerun + Empty-Rebuttal Tail Guard

Completed:
- Ran the user-approved final bounded paid rerun with temporary process env only.
- Ran local ordinary eval on the exported cases.
- Scanned for private wolf-strategy leakage and accepted fragment tails.
- Added the empty-rebuttal-tail guard and regression.
- Re-ran local full-game 12p mock after the guard.

Evidence:
- `tmp/12p-mimo-fullfeel-final-rerun-report.json`: 60 calls, reached day 2 `DAY_SPEECH`, fallback 4, error 4, validationFailure 1.
- `tmp/12p-mimo-fullfeel-final-rerun-eval.json`: 60 cases, averageScore 97.8, issueCount 6, highRiskCaseIds 2.
- Final rerun private-leak scan: 0 hits.
- Final rerun previous-fragment scan: 0 hits for `刚才X说的`.
- Final rerun new fragment scan: 1 hit, D1 4号 ending at `别光说`.

Changed files:
- `src/ai/speech/ordinarySurface.ts`
- `src/ai/speechProviders.test.ts`
- `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red test first failed for `empty rebuttal cue`, then passed after the surface guard.
- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "empty rebuttal cue|does not soft-accept ordinary speech|soft accepts forward commitment endings after retry by cutting the trailing promise|accepts ordinary speech when only soft quality guards remain after retries"` passed.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 368 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Scan of the new mock report found 0 private wolf-strategy hits and 0 accepted fragment-tail hits.

Decision:
- Still not `go` from paid evidence, because the latest paid sample found a new accepted fragment shape.
- The new shape is locally fixed and verified.
- Ask before spending another paid rerun.

### 2026-06-13 Opus Bounded Rerun + Fragment Hardgate

Completed:
- Ran the Opus-requested same-seed bounded paid rerun using temporary process env only.
- Ran local ordinary eval on the rerun cases.
- Scanned the rerun for private wolf-strategy leaks and accepted fragment tails.
- Added the provider-level fragment hardgate and a regression test.
- Re-ran the local full-game 12p mock gate after the hardgate.

Evidence:
- `tmp/12p-mimo-fullfeel-bounded-rerun-report.json`: 60 calls, reached day 2 `DAY_SPEECH`, fallback 3, error 3, validationFailure 1.
- `tmp/12p-mimo-fullfeel-bounded-rerun-eval.json`: 60 cases, averageScore 97.1, issueCount 8, highRiskCaseIds 3.
- Rerun private-leak scan: 0 hits for wolf-team private strategy wording.
- Rerun fragment scan: 1 accepted fragment, D1 10号 `我先说9号DeepSeek2刚才那段。他抓6号Gemini那句`.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red test first failed for `does not soft-accept ordinary speech that still ends as a fragment after retries`.
- Focused fragment/soft-quality slice passed after the provider hardgate.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 367 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Scan of the new mock report found 0 private wolf-strategy hits and 0 accepted fragment-tail hits.

Decision:
- Continue locally was correct for the fragment class; that fix is now in.
- The latest paid rerun itself is not a `go` proof because it failed the accepted-fragment gate.
- A fresh 50-60 call paid rerun is the next live proof if approved.

### 2026-06-13 12p Small Paid Full-Feel Live Review

Completed:
- Ran the approved small paid real Mimo sample for `12p-sheriff-seer-witch-hunter-guard`, seed 91, capped at 60 calls, using only temporary process env.
- Ran local ordinary eval on the exported cases.
- Added the human review pack at `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`.

Evidence:
- `tmp/12p-mimo-fullfeel-small-live-report.json`: 60 calls, reached day 2 `DAY_SPEECH`, stopped at `max_llm_calls`.
- `tmp/12p-mimo-fullfeel-small-live-eval.json`: 60 cases, averageScore 99.5, issueCount 2, highRiskCaseIds empty.
- Public speech-like rows: 32 total, with 9 sheriff speech action rows and 23 ordinary day-speech rows.
- Ordinary day-speech fallback/error: 7/23.

Decision:
- Continue, not go.
- Hard blocker 1: sheriff speech action row for 8号 Kimi publicly leaked `隐藏狼队视角`.
- Hard blocker 2: D2 10号 accepted a fragment, `我是10号Claude2。刚才9号DeepSeek2说的`.
- Main fallback root to fix next: immediately public Seer check reports are still often rejected as `凭空引用未公开查验结果` in later same-day speeches.

Next:
- Ask Opus 4.8 to judge the post-fix evidence, or run one bounded 50-60 call paid rerun only if live proof is required.
- Do not chase remaining mock/report-only 2/26 surface warnings with hard rules by default.

### 2026-06-13 12p Small Live Go-Blocker Local Fixes

Completed:
- Added `sheriffSpeech` action validation for public messages that expose private wolf/team strategy.
- Treated sheriff speech phases as public-output action phases for constraints/reason boundaries.
- Replaced raw wolf night-strategy text in private speech context with a public-safe instruction.
- Naturalized wolf speech-plan strategy text away from internal phrases such as `先隐藏狼队视角` and `制造分歧`.
- Filtered wolf internal motive points from mock/direct public speech assembly.
- Added ordinary speech validation for short previous-speaker pickup fragments such as `刚才9号DeepSeek2说的`.
- Added a same-day public-check fallback so a newly public Seer check can be referenced from the claimant's recent public speech even when formal claim-board extraction lags.
- Appended post-fix evidence and an Opus 4.8 review prompt to `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`.

Changed files:
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/speech/ordinarySurface.ts`
- `src/ai/mockAgent.ts`
- `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Focused red tests first failed, then passed after implementation.
- `npm.cmd run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates|public action reasons|private wolf strategy"` passed: 4 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "previous-speaker pickup|immediately public Seer check|target name ends with a digit in speech|generic counterclaim status|ordinary D1 first-check motive|repeated full-quote propagation"` passed: 6 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 366 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-livefix-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-livefix-cases.json` passed: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-livefix-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-livefix-eval.json` passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- `rg "狼队视角|隐藏狼队|制造分歧|狼队首夜|队友" tmp/12p-fullgame-lowcost-mock-after-livefix-*.json` found no matches.

Remaining risks:
- The live-sample defects are fixed locally, but there is no fresh paid Mimo rerun after the fix.
- Opus 4.8 should judge whether the local evidence is enough or whether one bounded paid rerun is still needed.

### 2026-06-12 12p Mimo Speech Mechanics

Completed:
- Added a new task card and implementation plan for the 12-player ordinary Mimo speech mechanics pass.
- Expanded the ordinary player voice card with explicit length lane, question tendency, filler/mouth habit, emotion amplitude, and default risk posture.
- Expanded ordinary self-history so the speaker can see bounded incoming pressure such as who questioned the current seat this round.
- Strengthened the shared pressure budget prompt once a target has already been hit by two speakers, steering later seats away from repeating the same target/point.
- Added prompt guidance that previous-speaker pickup is optional, allowing direct rebuttal, no named pickup, short water-pass, defense, or target shift.
- Checked Mimo/provider environment variable presence without printing values; no usable process/user/machine provider env was present, so paid validation was skipped.
- After user approval, launched a visible temporary PowerShell runner, accepted provider input through process env only, and collected the bounded 12p Mimo sample plus local eval.
- Added a compact Fable5 review pack at `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`.
- Recorded Fable5's review result in that pack and implemented the requested narrow follow-up:
  - `rolePublicAction`/public-claim pressure now offers six ordinary player moves instead of one cautious bridge.
  - sheriff campaign speech candidates now inherit ordinary-player texture in `src/ai/actionProviders.ts`.
  - stale self-history targets that are no longer alive are downgraded to "旧线 / 不是当前可处理目标".
  - public-check fallback bridge text now uses whole-game used-line avoidance.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets"` passed: 4 focused tests.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 299 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 39 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm run harness:long-tasks` passed: 4 tasks checked.
- `npm run build` passed with the existing Turbopack NFT trace warning through `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- `npm run harness:check` passed.
- 12p paid Mimo validation completed:
  - `tmp/12p-mimo-speech-mechanics-report.json`
  - `tmp/12p-mimo-speech-mechanics-cases.json`
  - `tmp/12p-mimo-speech-mechanics-eval.json`
- 12p sample summary: 90 calls, 33 speech calls, 57 action calls, fallbackCount 10, errorCount 10, validationFailureCount 5, stopped at `max_llm_calls`.
- Local eval summary: 80 evaluated cases, averageScore 99.4, issueCount 2, highRiskCaseIds 1, sample warnings for repeated claim-line bridges and action distribution skew.
- Fable5 follow-up focused checks:
  - `npm run test -- src/ai/speechProviders.test.ts -t "public-role claim handling|stale ordinary self-history|public-claim fallback bridge"` passed: 3 tests.
  - `npm run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates"` passed: 1 test.
  - `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 350 tests.
  - `npm run test -- src/ai/llmEvaluation.test.ts` passed: 39 tests.
  - `npx tsc --noEmit --pretty false` passed.
  - `npm run lint` passed with no warnings.
  - `npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
  - `npm run harness:long-tasks` passed: 4 tasks checked.
  - JSON parse for `long_running_tasks.json` passed.
  - `npm run build` passed with the existing Turbopack NFT trace warning through `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.

Remaining risks:
- The existing 12-player paid Mimo transcript is no longer the final read after the Fable5 follow-up; it had 10 fallback/error rows and repeated claim-line bridges.
- A clean bounded 12p rerun is still needed with temporary process env only. Fable5 requested same seed, sheriff nomination through sheriff vote, D1 full, and D2 speech.
- The next acceptance read should check sheriff speech variety, at least three different post-check response actions, and fallback rate near 1-2/30 or lower.
- Public Alpha consolidation remains the broader product priority after this 12-player speech validation checkpoint.

### 2026-06-12 Frontend/API Triage Patch

Completed:
- Moved the single-player streaming continue endpoint from `/api/games/[gameId]/commands/stream` to `/api/games/[gameId]/stream-command` after Next dev repeatedly returned 404 for the nested route shape.
- Updated the main-game smoke path helper, client streaming helper, API tests, and smoke tests to use the new endpoint.
- Optimized the loaded game surface so ordinary games hydrate from the SSR-safe dual surface to a viewport-specific mounted surface: desktop keeps `SeatBoard`; mobile keeps `MobileGameTable`.
- Avoided ordinary table event-feed construction for class-trial surfaces.

Changed files:
- `scripts/main-game-smoke-logic.mjs`
- `scripts/main-game-smoke.mjs`
- `src/app/api/games/[gameId]/commands/stream/route.ts`
- `src/app/api/games/[gameId]/stream-command/route.ts`
- `src/app/api/games/api.test.ts`
- `src/components/game/GameClientLoadedSurface.tsx`
- `src/components/game/GameClientLoadedSurface.test.ts`
- `src/components/game/streamingContinue.ts`
- `src/components/game/streamingContinue.test.ts`
- `src/game/mainGameSmokeLogic.test.ts`

Verification:
- Focused route/client/surface/smoke tests passed: 7 files / 65 tests.
- `npx next typegen`, `npx tsc --noEmit --pretty false`, `npm run lint`, and `npm run build` passed.
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:3011` passed and reached `DAY_SPEECH`.
- Browser CDP verification on `http://127.0.0.1:3012` passed for desktop `1280x900` and mobile `390x844`: both entered a 6-player game, dismissed role intro, reported no console/runtime errors, and mounted only the expected game surface for each viewport.
- `git diff --check` exited 0 with LF/CRLF warnings only.

Remaining risks:
- The browser check covered entering a local single-player game and surface mounting, not a full night-to-vote manual playthrough.
- `npm run build` still reports the existing Turbopack NFT trace warning through `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`; this is unrelated to the current patch.

### 2026-06-12 Project Progress And Harness Roadmap Update

Completed:
- Summarized the project's current post-Mimo checkpoint in repository state files.
- Updated `docs/roadmap.md` around Public Alpha consolidation:
  - Tencent Cloud is the primary playable environment;
  - ordinary Mimo is accepted enough to ship;
  - Render may lag until a separate deployment task updates it;
  - local dirty frontend/API changes must be triaged before the next release.
- Added a new task card for the next planning anchor: `docs/tasks/2026-06-public-alpha-consolidation-roadmap.md`.
- Updated harness state so future agents do not continue the old v41-v46 Fable5 loop by default.

Changed files:
- `docs/tasks/2026-06-public-alpha-consolidation-roadmap.md`
- `docs/roadmap.md`
- `docs/harness-state.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`
- `feature_list.json`

Verification:
- `npm run harness:task-card -- docs/tasks/2026-06-public-alpha-consolidation-roadmap.md` passed.
- `npm run harness:long-tasks` passed: 3 tasks checked.
- JSON parse for `feature_list.json` and `long_running_tasks.json` passed.
- `npm run harness:check` passed.
- `git diff --check -- docs/tasks/2026-06-public-alpha-consolidation-roadmap.md docs/roadmap.md docs/harness-state.md progress.md session-handoff.md long_running_tasks.json feature_list.json` passed with LF/CRLF warnings only.

Remaining risks:
- Public Alpha is smoke-tested but not yet open-beta stable.
- Render mirror was not updated in the Tencent deployment turn.
- The local worktree still has unrelated frontend/API modifications that need a separate triage task.
- Ordinary Mimo quality is acceptable for now, but not final-polish quality.

### 2026-06-12 v46 Final Acceptance Gate

Completed:
- Implemented the latest narrow hard-fact guard: fabricated public check attributions now fail provider/action validation and ordinary eval unless grounded by a Seer claim in the public claim board.
- Extended the forward-commitment truncation guard for tail variants such as `有个更让我别扭的地方。`.
- Persisted `metadata.aliveSeats` names and public claim-board summaries in ordinary eval cases.
- Ran v46 bounded live Mimo using the temporary key only as process env; no key was written to `.env`, docs, reports, source, or tmp files.
- Added `docs/evaluations/2026-06-12-ordinary-mimo-v46-final-acceptance-gate.md`.

Changed files:
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/ai/evalOrdinaryAiUtils.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `docs/evaluations/2026-06-12-ordinary-mimo-v46-final-acceptance-gate.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Focused action/eval/eval-utils tests passed.
- Related 8-file AI/claim aggregate passed: 453 tests.
- `npx tsc --noEmit --pretty false` passed.
- Targeted eslint passed.
- v46 local eval passed with 28 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Secret scan for the provided Mimo key prefix returned no matches.

Remaining risks:
- v46 had `fallbackCount 3` / `errorCount 3`; D2 8号's game-legal Werewolf fake-Seer claim came from fallback, so the sample is a hard-gate pass but not a pure no-fallback Mimo transcript.
- Report-only sample metrics still warn repeated `信息少先听一圈` pressure and repeated D2 Witch/silver-water setup clauses. Treat these as user-style acceptance observations, not Fable5 blockers.

### 2026-06-12 v43 DAY_VOTE + D2 Live And Post-live Hard Fixes

Completed:
- Ran the bounded live Mimo sample with the same seed and intended D1 vote + D2 envelope after the v41 narrow fixes:
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-report.json`
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-cases.json`
  - `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-eval.json`
- v43 live summary: 28 calls, 16 speech, 12 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, local eval averageScore 99.3, issueCount 1, highRiskCaseIds empty.
- Fixed the false Witch counterclaim pollution from 3号 GPT recognizing 2号 Claude's Witch claim. The claim parser now suppresses "recognizing another Witch claim" before quoted `我是女巫` wording can be read as a self claim, while preserving real concise Witch claims.
- Fixed stale D2 Witch save timing. True Witch D2+ old-save self claims now reject `昨晚/昨夜/夜里救的是...` unless `antidoteUsedTonight` is true; private briefing/fallback use `首夜` for old saves.
- Added the current Fable5 review pack at `docs/evaluations/2026-06-12-ordinary-mimo-v43-day-vote-d2-fable5-review.md`.

Changed files:
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/evaluations/2026-06-12-ordinary-mimo-v43-day-vote-d2-fable5-review.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

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

Remaining risks:
- v43 live was collected before the two post-live hard fixes, so the transcript itself still contains historical false-counterclaim and D2 stale-save wording. Local tests prove the fixed paths; a fresh paid live rerun should wait for Fable5/user judgment.
- Remaining subjective questions are table feel and variety: repeated `信息确实少，先听一圈` pressure, repeated `你说完就停了/没给立场`, and D2 vote naturalness.
- Do not start token reduction or broad phrase-ban expansion before Fable5/user acceptance.

### 2026-06-12 v43 Live Env Gate

Completed:
- Rechecked current process, user-level, and machine-level env without printing values. None had `AI_LLM_PROVIDER`, `AI_LLM_API_KEY`, `MIMO_LLM_API_KEY`, `MIMO_LLM_BASE_URL`, `AI_MODEL_MIMO`, `AI_LLM_BASE_URL`, or `OPENAI_BASE_URL` set.
- Checked local `.env` and `.env.local` for variable names only. Both contain candidate key variables, but no secret values were printed.
- Ran two bounded 1-call preflights by loading local env-file candidates into temporary process env and clearing those env vars after each command:
  - `tmp/ordinary-mimo-v43-live-preflight-report.json`
  - `tmp/ordinary-mimo-v43-live-preflight-cases.json`
  - `tmp/ordinary-mimo-v43-live-preflight-local-mimo-report.json`
  - `tmp/ordinary-mimo-v43-live-preflight-local-mimo-cases.json`
- Both local env-file candidates failed with provider HTTP 401 `invalid_key`; these are credential-state failures, not speech-quality evidence.
- Added a local helper at `tmp/run-mimo-day-vote-d2-live.ps1` that first uses an existing process `AI_LLM_API_KEY` or `MIMO_LLM_API_KEY` if present; otherwise it prompts for a temporary key, writes only a per-process temp env file under `tmp`, runs the bounded DAY_VOTE + D2 live sample and eval, then deletes the temp env file in `finally`.
- Rechecked after repeated continuation turns: the helper was still waiting for hidden token input and no v43 DAY_VOTE + D2 report/cases/eval files existed.
- Stopped the waiting helper and marked `tmp/ordinary-mimo-v43-day-vote-d2-live-latest-status.json` as `blocked_waiting_for_valid_key`.

Verification:
- `npm run llm:evaluate -- --models=mimo-v2.5-pro --base-url=https://token-plan-cn.xiaomimimo.com/v1 --lineup-count=9 --board=9p-seer-witch-hunter --human=none --seed-start=91 --games=1 --max-steps=20 --max-llm-calls=1 --real-phases=DAY_SPEECH --json --out=tmp/ordinary-mimo-v43-live-preflight-report.json --eval-cases-out=tmp/ordinary-mimo-v43-live-preflight-cases.json` completed with `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`, provider error 401 `invalid_key`.
- The same preflight using the local `.env.local` Mimo candidate wrote `tmp/ordinary-mimo-v43-live-preflight-local-mimo-report.json` and also completed with `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`, provider error 401 `invalid_key`.
- Clipboard check did not find a `tp-...` token, so no automatic secure injection was possible.

Remaining risks:
- The next live DAY_VOTE + D2 sample is still not collected because no valid key reached the command process.
- Existing persisted env-file credentials appear stale or invalid for the current Token Plan route. Do not judge Mimo speech quality from the fallback preflight rows.
- Resume by running `powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-mimo-day-vote-d2-live.ps1` and entering a valid temporary key in the visible prompt, or launch that helper from a process where `AI_LLM_API_KEY` or `MIMO_LLM_API_KEY` is already set.

### 2026-06-12 v42 DAY_VOTE + D2 Dry-run Shape Check

Completed:
- Checked current process environment without printing values: `AI_LLM_PROVIDER`, `AI_LLM_API_KEY`, `MIMO_LLM_API_KEY`, `MIMO_LLM_BASE_URL`, `AI_MODEL_MIMO`, `AI_LLM_BASE_URL`, and `OPENAI_BASE_URL` were all missing in the current shell.
- Did not run paid live because the required process env was not set.
- Ran a mock-only bounded shape check for the intended next live command:
  - `tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-report.json`
  - `tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-cases.json`
  - `tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-eval.json`
- Dry-run reached the intended phase envelope with same seed 91:
  - stopReason `max_llm_calls`;
  - final state D2 `DAY_VOTE`;
  - total calls 28: 16 speech / 12 action;
  - phase coverage: D1 speech 9, D1 vote 9, D2 speech 7, D2 vote 3;
  - fallback 0, error 0, validationFailure 0.

Verification:
- `npm run llm:evaluate -- --provider=mock --allow-mock --board=9p-seer-witch-hunter --human=none --seed-start=91 --games=1 --max-steps=180 --max-llm-calls=28 --real-phases=DAY_SPEECH,DAY_VOTE --json --out=tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-report.json --eval-cases-out=tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-cases.json` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-cases.json --json --out=tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-eval.json` passed: 28 cases, averageScore 99.4, issueCount 1 (`future_audit_hook`), highRiskCaseIds empty, sampleMetrics warned repeated mock surfaces.

Remaining risks:
- This is mock-only command-shape evidence, not live Mimo quality evidence.
- The current shell lacks Mimo env variables, so paid live remains blocked until the user/session provides temporary process env.
- When env is set, rerun the same bounded shape against real Mimo and stop for Fable5 review after collecting the DAY_VOTE + D2 sample.

### 2026-06-12 Fable5 Narrow Fixes For v41 Live Sample

Completed:
- Applied the three required Fable5 fixes without broadening phrase bans or hard fallback:
  - kept repeated-axis steering active after a public role claim while preserving `roleHandle`;
  - treated forward-commitment endings such as `我先说一下为什么现在跳。` and `我现在想换个方向看。` as ordinary truncated speech, with one soft retry and final tail trimming instead of fallback;
  - expanded ordinary eval case construction so recent speeches, speech influence, and vote leaders can count as referenced public cues, not only reasoning cues.
- Added provider-level regression coverage where both render attempts return `我是女巫...我先说一下为什么现在跳。`; result is attempts=2, non-fallback, with the trailing promise cut.
- Added evaluator regressions for forward-commitment endings in `analyzeLlmCallQuality` and `analyzeOrdinaryAiEvalCase`, including a landed follow-up negative case.
- Added eval-utils regression proving `buildEvalCaseFromAiLog` can count an output reference to `publicSummary.recentSpeeches`.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `src/ai/evalOrdinaryAiUtils.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "repeated-axis|forward commitment|cut-off seat reference|soft"` passed: 10 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "malformed|forward commitment"` passed: 2 tests.
- `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` passed: 2 tests.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 7 files / 413 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json --json --out=tmp/ordinary-mimo-v41-live-d1-cn-base-after-fable5-narrow-fix-eval.json` passed: 8 cases, averageScore 95.5, issueCount 2, both `malformed_output_fragment`; sampleMetrics retained the same two report-only warnings.
- Rebuilt v41 report input summaries in memory with the current `buildEvalCaseFromAiLog`: referenced public cue rows were 4/8, proving the new construction path is not silent; the old exported cases remain historical 0s.
- `npx eslint src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:check` passed.
- `git diff --check` exited 0 with LF/CRLF warnings only.

Remaining risks:
- No new paid live sample was run after these fixes.
- The existing v41 transcript remains D1-only and still shows same-axis pursuit around 1号 `底牌不虚 / 信息少暂时不压票`.
- Next live check should use the same seed and include `DAY_VOTE` plus one D2 round before asking Fable5 for the next subjective pass.

### 2026-06-12 v41 Live Mimo Probe And Fable5 Review Gate

Completed:
- Corrected the earlier quota diagnosis. The current temporary Token Plan key/base URL path works; the previous v26/v27 HTTP 403 notes are historical, not the active blocker.
- Confirmed direct provider and project-level access without persisting the key:
  - direct provider probe returned HTTP 200;
  - 1-call `llm:evaluate` preflight returned `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`.
- Ran bounded live Mimo Day 1 speech sample:
  - `tmp/ordinary-mimo-v41-live-d1-cn-base-report.json`
  - `tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json`
  - `tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json`
- v41 result: 8 speech calls, providers all `custom-speech:mimo-v2.5-pro`, fallback 0, error 0, validation failure 0, total quality issues 0.
- Updated `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md` into the current v41 live review pack with a compact Fable5 prompt.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary soft-director action candidates|ordinary death shape|bounded low-info first-seat water|visible player-jargon|already-spoken seat|first-seat future audit|truncated ordinary speech ending|peaceful-night"` passed.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "public witch save|future audit hooks|malformed JSON|short repeated clauses|repeated bridge clauses|summarizes ordinary"` passed.
- `npm run test -- src/game/tableMemory.test.ts` passed.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 7 files / 408 tests.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json --json --out=tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json` passed: averageScore 100, issueCount 0, and the two report-only sampleMetrics warnings remained.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/ai/tableRead.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/game/tableMemory.ts src/game/tableMemory.test.ts` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` exited 0 with LF/CRLF warnings only.

Remaining risks:
- v41 is a bounded D1 sample, not a full-game acceptance proof.
- Main remaining subjective issue is same-axis pursuit: seats 3/5/6/7 all chase 1号's `底牌不虚 + 信息少暂时不压票` contrast; sampleMetrics correctly warns about this.
- 2号 Witch ends at `我先说一下为什么现在跳。`; Fable5 should judge whether that is an unfinished accepted speech needing local coverage.

### 2026-06-11 Post-Fable-Feedback Local Repair And Review Pack v25

Completed:
- Applied the v24 Fable5 critique without expanding broad ordinary soft validators or hard fallback rules.
- Added report-only sample-level metrics for repeated long clauses and dominant target-axis concentration.
- Added shared-pressure citation budgeting in the ordinary soft director: when 2+ prior speakers press the same seat, later ordinary speech candidates shift away from quote/carry/follow-pressure moves toward hold, water-pass, vote-boundary, or change-read moves.
- Fixed local mock bridge reuse and splicing artifacts around prior-speaker carry, pivot lines, `不靠一句话定人我...`, `不拿来替自己下结论我...`, and `不直接照搬1号...`.
- Reworded mock/agenda templates away from old review-register surfaces including `公开动作`, `公开问题`, `公开过程`, `公开点`, `公开理由`, `发言动作`, `闭合`, `桌面压力落到`, and repeated `个参考，我还要看票和回应`.
- Created `docs/evaluations/2026-06-11-ordinary-mimo-v25-fable5-review.md` with the minimal read list, final sample excerpt, review questions, and boundaries for Fable5.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/debateAgenda.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/evaluations/2026-06-11-ordinary-mimo-v25-fable5-review.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "over-cited shared pressure targets"` passed after RED.
- `npm run test -- src/ai/speechProviders.test.ts -t "bounded mock transcripts"` passed after RED.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "repeated clause and target-axis concentration"` passed after RED.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --max-cases=30 --json --out=tmp/ordinary-mimo-v25-post-fable-feedback-mock-eval.json` passed: 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, sampleMetrics empty.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts` passed 6 files / 397 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/ai/tableRead.ts src/ai/debateAgenda.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"`, and `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- v25 is local mock evidence, not a fresh paid Mimo acceptance sample.
- Local score 100 is still only regression evidence.
- Fable5/user review should decide whether remaining table feel is still one analytical speaker with varied wording or is now good enough for the next small live Mimo check.

### 2026-06-11 Stage Close And Fable5 Review Pack v24

Completed:
- Used the v23 sample metrics on bounded mock seed 91 and fixed the remaining local causes without expanding broad ordinary soft word bans.
- Naturalized repeated mock speech bridges and public reasoning cue rendering:
  - removed repeated `刚才给了一个方向 / 拿后面的票和回应对照` bridges;
  - removed player-visible `公开线索是 / 后续发言者 / 我没听明白的是` mock evidence fragments;
  - varied repeated public-event renderings so the same public event does not become one exact table-mouth phrase across seats.
- Varied public Witch/Hunter vote leads and table rally lines.
- Calibrated `no_concrete_progression` to accept weak but landed ordinary actions such as low-info `先不压票听一圈`, `转回1号哪里没说清`, and `票先往8号靠`.
- Calibrated repeated phrase sample metrics so fixed public-event scaffolding and model names do not create false table-sameness warnings.
- Created the Fable5 review pack with a minimal read list, current sample excerpt, known residual concerns, and review questions.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "bounded mock transcripts"` passed after RED.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "weak but landed ordinary|public-event names|seat-memory history|action distribution skew|sample-level|ordinary speech that lectures rules"` passed after RED.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --max-cases=30 --json --out=tmp/ordinary-mimo-v24-stage-close-final-mock-eval.json` passed: 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, sampleMetrics empty.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts` passed 6 files / 395 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/ai/tableRead.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- This is local mock evidence, not a fresh paid Mimo acceptance sample.
- Fable5 should judge whether shared public-event references still feel too mechanical even when surface wording varies.
- Do not treat the 100 local score as a final quality score; it is regression evidence only.

### 2026-06-11 Sample-level Evaluation Metrics v23

Completed:
- Added report-only ordinary evaluator sample metrics so future reviews can see table-wide sameness, not only per-case regex issues.
- `summarizeOrdinaryAiEvalCases` now returns `summary.sampleMetrics` with:
  - `repeated_surface_phrase` for repeated cross-seat table-mouth surfaces such as `刚才给了一个方向`.
  - `seat_voice_similarity` for high sentence-skeleton overlap across 6+ speech samples.
  - `action_distribution_skew` for samples where most seats use the same coarse move such as `quoteOrCarry`.
  - `positive_signal_coverage` when a larger speech sample has no weak-human, grounded-emotion, defensive-motive, or public-role-action positive signal.
- Markdown ordinary eval reports now print a `Sample Metrics` section after Summary.
- Kept the change strictly in reporting/evaluation. It does not affect single-case `score`, `issueCount`, `highRiskCaseIds`, speech validation, retry, or fallback.
- Ran a mock ordinary eval smoke: 20 cases, averageScore 98, issueCount 2, `sampleMetrics=2` with `repeated_surface_phrase 4/9` and `action_distribution_skew 0.78`.

Changed files:
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/ai/evalOrdinaryAiUtils.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/llmEvaluation.test.ts -t "sample-level"` failed first because `summary.sampleMetrics` was missing, then passed.
- RED/GREEN: `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` failed first because Markdown did not print sample metrics, then passed.
- `npm run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts` passed 2 files / 28 tests.
- `node scripts/eval-ordinary-ai.mjs --source=mock --games=1 --seed-start=91 --max-cases=20 --json` passed and reported `sampleMetrics=2`.
- `node scripts/eval-ordinary-ai.mjs --source=mock --games=1 --seed-start=91 --max-cases=20` passed and printed the `Sample Metrics` section.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts` passed 6 files / 391 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining risks:
- These metrics are diagnostic signals, not a human-quality score. A clean or high-scoring local report still needs transcript reading.
- The mock sample still exposes repeated local mock phrasing; the next fix should target context/candidate-action supply rather than expanding soft validator word lists.

### 2026-06-11 Positive Context Supply v22

Completed:
- Accepted the external-review/user direction that ordinary speech quality should not keep expanding the surface-word cleanup list by default.
- Added stable positive context to ordinary speech generation:
  - `ordinarySpeechDirector.playerVoiceCard` now summarizes the current seat's ordinary player type as stable traits, mouth habit, emotion/defense tell, and risk habit.
  - `ordinarySpeechDirector.selfHistory` now surfaces the speaker's previous public speech, last speech target/stance, and last vote target/reason, with guidance that continuity or pivoting must be first-person and publicly explainable.
- Made repeated ordinary surface moves affect candidate actions, not only prompt warnings. When recent speeches repeat pickup/quote surfaces such as `接上一位/我听到了`, the next ordinary candidate set removes `quoteOneLine`/`halfAccept` and shifts toward discomfort, hold, or voteBoundary.
- Kept the change in context/prompt/candidate layers; no new broad validator word list was added and no `.env` or provider config was touched.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history"` failed first, then passed.
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "repeated previous-seat pickup rhythm"` failed first, then passed.
- `npm run test -- src/ai/speechProviders.test.ts` passed 1 file / 290 tests.
- `node scripts/evaluate-llm-game.mjs --provider=mock --allow-mock --board=9p-seer-witch-hunter --human=none --games=1 --max-llm-calls=14 --json` was summarized in-memory: 14 calls, 9 speech / 5 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, `totalQualityIssues 0`.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/seatMemory.test.ts` passed 5 files / 388 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, and `npm run harness:check` passed.
- `long_running_tasks.json` parsed successfully.

Remaining risks:
- This is a local context/prompt implementation pass, not fresh live Mimo evidence.
- The v22 mock transcript still repeats some local mock phrasing like `刚才给了一个方向，我会拿后面的票和回应对照`; treat that as future player-mouth polish, not as accepted live Mimo quality.
- Seat differentiation still needs transcript review; the local evaluator score should stay a regression signal rather than the final quality gate.
- Sample-level evaluator metrics were added in v23; use them as transcript review signals, not validator/fallback gates.

### 2026-06-11 Local Vote-continuity And Mock Speech Polish v21d

Completed:
- Continued locally from v20 without another paid Mimo call.
- Fixed mock/fallback day-vote action reasons so they carry speech-to-vote continuity:
  - if the vote target matches the last speech target, the reason now says the previous speech pressure is still unresolved;
  - if the vote target changes, the reason now says it is a turn from the previous speech target to a harder current public reason.
- Reused the same continuity naturalizer in `createMockCommand`, so externally supplied `votePlan` fallback commands cannot bypass the continuity wording.
- Softened remaining mock text surfaces:
  - wolf team vote reason no longer says `公开焦点 / 按这条线归票`;
  - mock speech audit line no longer says `当前焦点是...`;
  - mock evidence merge no longer says `我接的公开点是` / `我接到的是...`.
- Ran v21d local confirmation:
  - `tmp/ordinary-mimo-v21d-local-vote-continuity-mock-eval-20260611-1025.json`
  - `tmp/ordinary-mimo-v21d-local-vote-continuity-dryrun-20260611-1026.json`
  - `tmp/ordinary-mimo-v21d-local-vote-continuity-dryrun-20260611-1026-cases.json`
- v21d local eval: 42 cases, averageScore 98.3, issueCount 4, `speech_vote_discontinuity` 0, highRiskCaseIds empty.
- v21d bounded dry run: 25 mock calls, 12 speech / 13 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, `totalQualityIssues 0`.
- Bad-pattern grep on the final v21d eval for the recently cleaned player-visible surfaces had 0 hits.

Changed files:
- `src/ai/tableRead.ts`
- `src/ai/mockAgent.ts`
- `src/ai/speechProviders.ts`
- `src/ai/actionProviders.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/actionProviders.test.ts -t "mock vote reasons continuous|mock vote pivots|speech-vote continuity"` passed 6 focused tests.
- `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed 2 files / 332 tests after the final speech merge polish.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/seatMemory.test.ts` passed 5 files / 386 tests.
- `npx tsc --noEmit --pretty false` passed.
- v21d local eval and bounded dry run passed with the metrics above.

Remaining risks:
- This was local-only; no fresh paid Mimo transcript was run after v21d.
- Remaining local eval markers are three `no_concrete_progression` warnings and one `ordinary_jargon_stack` warning. The first-seat low-information warning may be intentionally human-like water speech rather than a defect.
- Subjective live Mimo quality still needs user review or a bounded live sample before declaring phase 2 accepted.

### 2026-06-11 Local Mock/Fallback Text Cleanup And v20 Dry Run

Completed:
- Continued locally after the v16/v17/v18/v19 dry-run evidence without another paid Mimo call.
- Cleaned mock/fallback action text so first-night and later mock night reasons no longer use `当前可信度较高`, `稳定发言位`, `当前焦点，查验收益最高`, or `身份空间`.
- Cleaned ordinary first-seat mock/fallback speech:
  - 首置位 no longer copies `tableTask` text such as `首置位前面没人可接...不要展开药线...交投票方向`.
  - no-front-speech mock output no longer invents pressure on an unspoken later seat or says `刚才那句最卡`.
  - no-target fallback condition now says `先不压票，听一圈再看谁急着带节奏` instead of waiting for generic 后置位 homework.
- Naturalized protected public-claim audit wording from `身份空间 / 公开处理方向和边界` to `这个身份先认下来，但今天票准备往哪放要说清`.
- Ran local bounded confirmation:
  - `tmp/ordinary-mimo-v20-local-polish-dryrun-20260611-0827.json`
  - `tmp/ordinary-mimo-v20-local-polish-dryrun-20260611-0827-cases.json`
  - `tmp/ordinary-mimo-v20-local-polish-mock-eval-20260611-0827.json`
- v20 local dry run: 25 mock LLM calls, 10 speech / 15 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`; bad-pattern grep for the cleaned surfaces had 0 hits.
- v20 local eval: 42 cases, averageScore 92.0, issueCount 16, highRiskCaseIds empty; remaining issues are mainly `speech_vote_discontinuity`, so the next local target is vote-reason continuity if we keep working locally.

Changed files:
- `src/ai/mockAgent.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/claimAudit.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary first-seat mock speech|unspoken target"` passed 4 focused tests.
- `npm run test -- src/ai/actionProviders.test.ts -t "mock first-night|first-night action reasons"` passed 2 focused tests.
- `npm run test -- src/ai/tableRead.test.ts -t "day-one speech|single death"` passed 2 focused tests.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 384 tests.
- `npx tsc --noEmit --pretty false` passed.
- v20 local bounded transcript/eval commands passed.

Remaining risks:
- This was local-only; no fresh paid Mimo transcript was run after the mock/fallback cleanup.
- v20 is a mock/fallback evidence pass, not proof that live Mimo subjective speech quality is solved.
- Remaining local eval debt is mostly speech-to-vote continuity.

### 2026-06-11 Local Action-text And Speech-rhythm Polish

Completed:
- Continued from the v14/v15 handoff without running another paid Mimo sample.
- Fixed action hint seat labels so action continuity no longer leaks `1#DeepSeek` / `2#Claude` style model-ish labels; hints now use player-readable `1号DeepSeek` style labels.
- Tightened Seer night-action reasons:
  - `seerCheck` candidate hints now include the selected target, e.g. `先验6号Gemini...`.
  - direct validation rejects a `seerCheck:6` decision whose reason says it is checking or resolving `5号` instead.
  - routed action output repairs this mismatch by replacing the bad reason with the selected candidate's target-bound reason hint, reducing avoidable fallback.
- Added a soft ordinary speech-director signal for repeated previous-seat pickup rhythm. When recent speeches repeat `我先接上一位 / 这个判断我听到了 / 我听进去了`, the prompt marks `接上一位/我听到了` as repeated and tells the next speaker to change player action instead of only swapping synonyms.

Changed files:
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/actionProviders.test.ts -t "seat labels|seer-check reasons|speech-vote continuity hint"` failed first on `#` labels and missing seer target binding, then passed after the action fixes.
- `npm run test -- src/ai/actionProviders.test.ts -t "seat labels|seer-check reasons|repairs a seer-check reason|speech-vote continuity hint"` passed 4 focused tests.
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "repeated previous-seat pickup rhythm"` failed first, then passed after adding the repeated rhythm surface.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` passed 2 files / 328 tests.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 382 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining risks:
- This was local-only; no fresh paid Mimo transcript was run after these polish changes.
- Speech rhythm is handled as soft prompt/context guidance, not a hard validator or fallback rule. The next real transcript still needs user judgment.
- Broader subjective variety may still need another review pass after a bounded live sample.

### 2026-06-11 v14 Full-game Simulation And v15 Focused Fix Confirmation

Completed:
- Ran a full 9-player all-AI ordinary Mimo game with the user-provided temporary Token Plan key used only through process env:
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235.json`
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235-cases.json`
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235.run.log`
- v14 result: one completed game, wolves won on Day 4 by eliminating all gods. It made 55 LLM calls: 20 speech calls and 35 action calls. `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`; the fallback was not a broad speech-quality fallback.
- Ran local eval on v14:
  - `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235-eval.json`
  - totalCases 55, averageScore 97.5, issueCount 8 (`no_concrete_progression` 5, `ordinary_jargon_stack` 3), highRiskCaseIds empty.
- Manual v14 review found three concrete fix targets:
  - Day 1 first seat prematurely named and pressured an unspoken 3号 with `3号GPT，我先记你一笔`.
  - first-night action reasons invented public discussion, focus, pressure, or speech-position information before any day speech existed.
  - vote/action continuity merge could splice dangling fragments such as `没；从上一轮...` or orphan target digits such as `。5；延续...`.
- Fixed those targets:
  - `src/ai/speechProviders.ts` now treats target-bound `记你一笔 / 先盯` shapes on unspoken seats as premature future-seat framing.
  - `src/ai/actionProviders.ts` now gives first-night action candidates explicit no-day-info hints and rejects first-night reasons that invent public discussion, focus, speech position, vote shape, or day pressure.
  - action continuity merge now drops dangling reason bases, strips orphan target digits, and falls back to the clean continuity hint when the previous fragment is unsafe.
- Ran a post-fix bounded live confirmation:
  - `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920.json`
  - `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920-cases.json`
  - `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920-eval.json`
- v15 bounded result: 15 calls, 9 speech / 6 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`. Local eval averageScore 98.7, issueCount 1 (`no_concrete_progression`), highRiskCaseIds empty.
- v15 confirmed the first-seat speech no longer pre-points 3号, and the first wolf-kill reason now stays on low-information first-night rationale.
- v15 still exposed one first-night `seerCheck` reason with a mixed contradiction before the final validator tightening; this is now covered by local action-provider tests, but was not followed by another live paid rerun.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "first-seat future audit hooks"` failed first on the v14 `3号GPT，我先记你一笔` shape, then passed after the unspoken-seat guard update.
- RED/GREEN: `npm run test -- src/ai/actionProviders.test.ts -t "first-night action reasons|dangling vote reason|orphan target digits"` failed first on first-night invented-public-discussion and dangling continuity cases, then passed after the action-provider fixes.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` passed 324 tests.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 378 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining risks:
- No second full-game live rerun was made after the final first-night action validator tightening; v15 was bounded at 15 calls.
- Late-game seer-check reasons can still mismatch the action target in rare contexts; v14 showed one late seer-check reason still talking about a prior 5号查杀.
- Some action continuity hints still use model-label seat strings such as `1#DeepSeek`; this is a display/text polish issue, not a rules failure.
- Repeated `我先接上一位...这个判断我听到了...` rhythm is still subjective speech-quality debt and should be tuned through prompt/context variety rather than a hard fallback rule.

### 2026-06-11 Valid-key v08-v13 Landing And Fallback Guard Pass

Completed:
- Used the user-provided temporary Token Plan key only through process env; no key was written to `.env`, source, docs, reports, or provider config.
- Ran bounded ordinary Mimo checks after the invalid-key v07 pass:
  - v08 `tmp/ordinary-mimo-v08-validkey-small-20260610-2345.json` / `-cases.json`: 15 calls, 9 speech, 6 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`; local eval averageScore 97.9 with 2 low-risk issues. Manual review still found repeated/unfinished landing around 4/5 and 6/7/8.
  - v09 `tmp/ordinary-mimo-v09-validkey-landing-20260610-2353.json` / `-cases.json`: 15 calls, 9 speech, 6 action, `fallbackCount 0`, `errorCount 0`; exposed the soft unfinished ending `我想顺着往回多看一步`.
  - v10 `tmp/ordinary-mimo-v10-validkey-landing-20260611-0000.json` / `-cases.json`: 15 calls, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 1`; exposed first-seat fallback quoting an unspoken 2号 as if he had already spoken.
  - v11 `tmp/ordinary-mimo-v11-validkey-landing-20260611-0006.json` / `-cases.json`: 15 calls, `fallbackCount 2`, `errorCount 2`, mostly provider/fetch failures; exposed accepted text ending at `能撑住的只有`.
  - v12 `tmp/ordinary-mimo-v12-validkey-short-20260611-0015.json` / `-cases.json`: 12 calls, 9 speech, 3 action, `fallbackCount 1`, `errorCount 1`; exposed `转一下视线`, `原话我再过一遍`, ordinary Day 1 first-check motive attacks, and planned seer identity repair.
  - v13 `tmp/ordinary-mimo-v13-speech-only-20260611-0027.json` / `-cases.json`: 9 real speech calls, 0 real action calls, `fallbackCount 2`, `errorCount 2`; because mock actions advanced the game this was a Day 2 sample, not a clean D1 acceptance sample. It exposed endings like `背后藏着一个前提` and `你那句话我记到现在`.
- Added prompt/context guidance that ordinary carry-over should quote at most one prior line and then land the speaker's own handling action (`暂放`, `不跟`, `改看`, `压`, `过`, etc.).
- Added soft retry validation for ordinary recap-without-landing and unfinished pivot shapes, including `多看一步`, `转一下视线`, `原话我再过一遍`, `能撑住的只有`, `背后藏着一个前提`, and `我记到现在`.
- Fixed fallback so first-seat ordinary Witch/Seer fallback does not quote an unspoken later seat as `刚才那句`.
- Tightened ordinary planned seer claim contract and repair so `claim_gold_check` / `claim_black_check` says `我是预言家` instead of vague `先报身份`.
- Extended Day 1 first-check motive attack validation to ordinary mode, and cleaned claim-attribution repair so it removes leftover `首验心路太薄` residue after repairing a black-check target misread.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "rejects ordinary speeches that end with a cut-off seat reference"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "repairs a black-check target being called seer|rejects ordinary speeches that end with a cut-off seat reference|first-check motive|first-seat ordinary witch fallback|planned seer"` passed.
- `npm run test -- src/ai/speechProviders.test.ts` passed 286 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 5 files / 375 tests.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- Live Mimo still has transient provider `fetch failed` / provider-error fallback rows; those should not be treated as speech-quality failures from the accepted LLM text.
- v13 was not a clean Day 1 acceptance sample because speech-only real phases let mock actions advance the game to Day 2.
- The latest post-v13 unfinished-ending fixes are covered by focused local tests but were not followed by another paid live transcript to avoid endless sampling.
- Full 9-player simulation is the next useful quality gate only if the user accepts provider spend; token reduction remains deferred.

### 2026-06-10 Invalid-key v07 Attempt And Fallback Pollution Cleanup

Completed:
- Tried the requested bounded ordinary Mimo run after the review-register cleanup:
  - `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310.json`
  - `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310-cases.json`
- Result: this was not a valid Mimo quality sample. Summary was `completedGames 0`, `totalCalls 25`, `speechCalls 9`, `actionCalls 16`, `fallbackCount 25`, `errorCount 25`, `validationFailureCount 0`, `byFailureType.provider_error 25`, and `byRetryIssue.provider_request 25`. Attempt diagnostics repeatedly reported `401 Invalid API Key`.
- Ran local eval on the fallback-only v07 cases:
  - `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310-eval.json`
  - Result: totalCases 25, averageScore 88.5, issueCount 14, with `speech_vote_discontinuity` 8, `no_concrete_progression` 5, and `ordinary_jargon_stack` 1.
- Treated v07 text only as provider-error fallback pollution evidence. It exposed remaining failure-path issues: repeated `这段我先记下`, Kimi fallback opener `身份线/长线记忆`, and evaluation seat names such as `Mimo-mimo-v25-pr` leaking model suffixes into transcript context.
- Added focused regressions and fixed those failure-path issues:
  - ordinary provider-error fallback no longer repeats `这段我先记下，这段我先记下`.
  - ordinary Kimi/Gemini fallback openers now use player language instead of `身份线`, `观察位`, or `长线记忆`.
  - `buildLlmEvaluationFriends` keeps seat nicknames as base persona names; model labels stay in `llmConfig`, so generated eval transcripts no longer put model suffixes in player display names.
  - upstream prompt/action/memory fallback wording was cleaned away from review-register terms where it could enter player-visible text or LLM-visible soft guidance.
- No `.env`, provider config, UI, game rules, deployment, or token-reduction work was done.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/actionProviders.ts`
- `src/ai/seatMemory.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "provider-error fallback"` failed first on duplicate `这段我先记下` and Kimi `身份线`, then passed after fallback wording changes.
- RED/GREEN: `npm run test -- src/ai/llmEvaluation.test.ts -t "cyclic custom DeepSeek"` failed first because eval nicknames included model suffixes, then passed after nickname cleanup.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 374 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining risks:
- Still no fresh post-cleanup live Mimo transcript, because the available key returned `401 Invalid API Key`.
- v07 fallback text should not be used to judge Mimo's speech quality. It is only evidence that provider failure paths are now cleaner.
- A real bounded transcript still requires a valid temporary Token Plan key passed only through process env.

### 2026-06-10 Review-register Speech Cleanup

Completed:
- User reviewed the surfaced v05/v06 transcript excerpts and agreed that the main remaining speech-quality issues were review/register wording, especially `身份空间`, `发言缺口`, `怎么用这个信息`, and formulaic `起票/补票/最后跟票`.
- Added focused regressions so these surfaces are detected as ordinary visible player-jargon, while natural player wording such as `我先当真女巫听`, `票准备往哪放`, and `谁先把票带起来、谁顺着跟上` remains accepted.
- Extended ordinary speech naturalization so accepted LLM output is rewritten away from review-register wording before validation when safe:
  - `身份空间` -> `这个身份 / 这个身份我先认下来`
  - `发言缺口` -> `没说清的地方`
  - `怎么用这个信息` -> `票准备往哪放`
  - `起票/补票/最后跟票` -> `谁先把票带起来 / 谁顺着跟上`
- Updated ordinary prompt avoid-lines and repair guidance to tell the model not to say those review-register terms, without adding a broad hard fallback rule.
- Changed one internal table-task description from `发言缺口` to `没说清的地方`, and changed mock vote-review wording away from `起票和补票位置`.
- Extended the local ordinary evaluator so old samples using these terms now receive `ordinary_jargon_stack`.
- Re-scored existing v06 and v05 cases with the updated evaluator:
  - `tmp/ordinary-mimo-v06-d1vote-after-review-register-fix-20260610-eval.json`: totalCases 25, averageScore 97.0, issueCount 4, `ordinary_jargon_stack` 1, highRiskCaseIds empty.
  - `tmp/ordinary-mimo-v05-fullgame-after-review-register-fix-20260610-eval.json`: totalCases 56, averageScore 91.8, issueCount 34, `ordinary_jargon_stack` 29, `speech_vote_discontinuity` 5, highRiskCaseIds empty.
- Interpretation: the updated evaluator now catches the old transcript's review-register problem more honestly; this was a local re-eval of existing text, not a fresh paid Mimo sample.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "visible player-jargon|review-register"` initially failed on the newly added surfaces, then passed after prompt/naturalization/validator fixes.
- RED/GREEN: `npm run test -- src/ai/llmEvaluation.test.ts -t "player-jargon"` initially failed on the review-register evaluator case, then passed after evaluator expansion.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 343 tests.
- `npx tsc --noEmit --pretty false` passed.
- Existing-case re-evals for v05/v06 passed and wrote the new reports listed above.

Remaining risks:
- No fresh live Mimo sample was run after this cleanup, so the actual model-generation improvement still needs a bounded transcript.
- Some terms such as `身份线` still appear in old samples and may need a separate pass if the user judges them unnatural.
- The local evaluator now correctly lowers old v05 more harshly; that is expected and does not mean the new code regressed.

### 2026-06-10 Full 9p Simulation And Action/Evaluator Fixes

Completed:
- Ran a full 9-player all-AI ordinary Mimo simulation on `9p-seer-witch-hunter` after the fallback-softening pass. Evidence:
  - `tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034.json`
  - `tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034-cases.json`
- Result: one completed game, wolves won on Day 4 because all gods were eliminated. The run made 56 LLM calls: 21 speech calls and 35 action calls. `fallbackCount` was 5, and all 5 were action/provider-error fallbacks from vote-continuity validation, not speech fallback.
- Fixed `scripts/evaluate-llm-game.mjs` so `--human=none|null|all-ai|all_ai` really runs all AI seats instead of leaving seat 9 as a default human/model-routed seat.
- Fixed ordinary speech false positives found during the full-game review:
  - later public deaths are no longer rejected just because Day 1 had a peaceful record.
  - a previous-day line like `8号Kimi跳预言家发查杀` no longer misattributes the checked target as the seer.
  - named-focus lines such as `我主要想说1号...` must add a judgment or handling action before they are accepted as complete.
  - provider-error fallback wording avoids the repeated `我先只接一层 / 票先不压太死 / 先不站死` family.
- After inspecting the v06 bounded transcript text, added one more soft unfinished-speech guard for the live 5号 shape: quoting or re-listening to a prior line and ending at `越想越不对 / 越想越怪 / 不舒服` must land a judgment or handling action. The same shape passes when followed by a concrete `所以我这轮...` action.
- Fixed action fallback causes from the full-game run:
  - action reasons are clipped at a complete sentence or clean clause instead of leaving dangling fragments such as `让他把这条`.
  - vote-continuity wording now accepts natural human phrasing like `我上一轮点过1号，但现在6号这条发言缺口更值得先验`.
  - clipping prefers continuity sentences when they explain a target change.
- Fixed local evaluator false positives for true Witch self-reveal formats such as `我是2号，女巫...` and `我底牌是女巫...`; non-Witch hidden-info cases remain blocked.
- Ran a post-fix bounded live confirmation:
  - `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052.json`
  - `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052-cases.json`
  - `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052-eval-after-evaluator-fix.json`
- Result: 25 LLM calls through Day 1 speech/vote into Day 2 night start, with `fallbackCount 0`, `errorCount 0`, and `validationFailureCount 0`. Local eval averageScore was 97.4, issueCount 3, highRiskCaseIds empty.

Changed files:
- `scripts/evaluate-llm-game.mjs`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "cut-off seat reference"` passed after the v06 5号 soft guard.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 342 tests.
- `npx tsc --noEmit --pretty false` passed.
- Full 9p all-AI Mimo run completed and wrote v05 evidence.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034-cases.json --max-cases=120 --json --out=tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034-eval-after-evaluator-fix.json` passed after evaluator calibration.
- Bounded v06 live confirmation passed with 0 fallback, 0 error, 0 validation failure.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052-cases.json --max-cases=80 --json --out=tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052-eval-after-evaluator-fix.json` passed.

Remaining risks:
- The v06 confirmation is bounded, not a second post-action-fix full-game run. It directly covers the D1 speech/vote path that caused the v05 fallbacks, but later-game consistency still benefits from another full-game run if the user wants to spend the provider calls.
- The local evaluator still reports low-risk quality hints (`no_concrete_progression` and `speech_vote_discontinuity`) that should be judged against transcript text rather than converted into hard fallback rules.
- Subjective speech quality still depends on user review; do not claim ordinary AI speech is final.

### 2026-06-10 Soft Quality Pass And Claim Parser Fix

Completed:
- Followed the user instruction to avoid over-restricting LLM speech: ordinary player-feel issues are now treated as soft quality failures for provider fallback decisions, while public-information, role-claim, death-shape, and private-info violations remain hard failures.
- `createConstrainedLlmSpeechProvider` now retries soft ordinary quality issues when possible, but if only soft quality guards remain after retries it returns the latest LLM speech as non-fallback instead of forcing template fallback.
- Added a true-Witch boundary exception so a publicly revealed real Witch can challenge another seat's handling of a peace-night Witch-use statement without being rejected as hidden-information misuse.
- Fixed public Witch claim parsing for natural comma self-introductions such as `我是2号，女巫...`, so later speakers no longer treat that public claim as unannounced identity information.
- Ran a fresh bounded ordinary Mimo transcript with the temporary Token Plan key only through process env:
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935-cases.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935-eval.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935-eval.md`
- Result: 6 speech calls, fallbackCount 0, errorCount 0, validationFailureCount 0. Run summary still reports one non-blocking quality hint `death_cause_overclaim`; standalone local eval averageScore is 95 with one `logic_boundary_error`, likely an evaluator false positive around 3号 referencing 2号's already public Witch claim and save target.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts` passed 279 tests.
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts` passed 305 tests.
- `npx tsc --noEmit --pretty false` passed.
- Focused claim parser tests passed for `seat-only comma witch`, Witch claim recognition, and public Witch-speech boundaries.
- Final bounded Mimo command passed with 6 real speech calls and 0 fallback rows.
- `npm run eval:ordinary-ai` passed on the final case export.

Remaining risks:
- The final transcript still needs user subjective review; 6号 is intentionally short and may still feel thin, but it is no longer forced into fallback.
- The remaining quality/eval hints are non-blocking and appear at least partly over-strict around public Witch information; they should be reviewed before becoming new hard fallback rules.
- No token-reduction work was done.

### 2026-06-10 User Review: 4/5 Unfinished Feeling Guard

Completed:
- User reviewed the latest post-fallback-fix transcript and said 4号 and 5号 had a "not finished" feeling; the other rows were acceptable enough for this pass.
- Interpreted this narrowly as two accepted-output quality gaps:
  - 4号: says a prior speech "听着有点怪", quotes two prior clauses, then stops without landing a current handling action.
  - 5号: says `可能要改口` but does not land the new read; this was already covered by the previous local changed-read guard.
- Added focused coverage for the 4号 shape: ordinary speech that expresses discomfort and then ends on a quoted prior line now fails as `普通局发言疑似被截断`, while the same quote followed by a handling action passes.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "cut-off seat reference"` failed first with no truncation error, then passed after the guard.
- `npm run test -- src/ai/speechProviders.test.ts -t "changed read"` passed.
- `npm run test -- src/ai/speechProviders.test.ts` passed 273 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining risks:
- No fresh live transcript has been run after this 4号 unfinished-quote guard.
- The latest real sample is still not accepted as final ordinary speech quality.

### 2026-06-10 v0.4 Fresh Mimo Transcript And Narrow Fallback Fix

Completed:
- Used the user-provided temporary Token Plan key only through process env. No key was written to `.env`, source, docs, or reports.
- Ran a fresh bounded Day 1 ordinary Mimo transcript:
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612-cases.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612-eval.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612-eval.md`
- Result: 6 speech calls, 4 non-fallback real rows, 2 fallback rows, provider `custom-speech:mimo-v2.5-pro`, local eval average 100. Manual review did not accept it because fallback still misread a prior concrete `有点滑` read as no suspicion and repeated the fixed phrase `我先说一个地方`.
- Added focused tests and a narrow fallback fix:
  - allow ordinary speech to describe a spoken seat's prior question to another seat without treating it as asking that spoken seat to speak again.
  - do not let fallback misread `有点滑 / 别扭 / 不舒服` as no suspicion.
  - vary fallback's previous-speech connector instead of repeating `我先说一个地方`.
- Ran a post-fallback-fix bounded transcript:
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-cases.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-eval.json`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-eval.md`
  - `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-review.md`
- Result: 6 speech calls, 4 non-fallback real rows, 2 fallback rows, local eval average 93.3 with `no_concrete_progression` 2.
- Manual review: improved but still not accepted. 1号 is still too weak/procedural, 2号 fallback action is too thin, and 5号 real output says it may change its read on 1号 but does not land the new read.
- Added a final local guard after the post-fix transcript: `可能要改口 / 判断要变` now must land a new read, and quoted prior speech is ignored when checking whether the new read exists.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "spoken seat's question|concrete slippery-read"` failed first on fallback misread, then passed after the fix.
- RED/GREEN: `npm run test -- src/ai/speechProviders.test.ts -t "changed read"` failed first on the accepted `可能要改口` shape, then passed after the validator fix.
- `npm run test -- src/ai/speechProviders.test.ts` passed 273 tests.
- `npx tsc --noEmit --pretty false` passed.
- First fresh Mimo command passed with 6 calls.
- Post-fallback-fix Mimo command passed with 6 calls.
- `npm run eval:ordinary-ai` passed for both new case exports.
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Token-prefix scan found only existing masked/fake token fixtures in tests/docs, not this session's temporary key.

Remaining risks:
- No fresh live transcript was run after the final `可能要改口` local guard.
- The sample is not accepted quality; local evaluator still under-catches some subjective issues.
- No token-reduction work was done.

### 2026-06-10 v0.4 Local Re-eval And Credential Blocker

Completed:
- User asked to start the next step after the v0.4 implementation pass.
- Re-read current harness/state/task context and confirmed the intended next step is a fresh bounded ordinary Mimo Day 1 transcript with a temporary process env key only.
- Re-scored the latest real Mimo cases from `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json` with the v0.4 evaluator.
- v0.4 local re-eval output:
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.json`
  - `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.md`
- Result: average score 90.7, issueCount 4, issue codes `no_concrete_progression` 1 and `ordinary_jargon_stack` 3. This is stricter than the previous 94.7 because the v0.4 evaluator now catches more of the user-reviewed audit/register surfaces.
- Tried a one-call bounded Mimo probe with `.env` loading disabled via `DOTENV_CONFIG_PATH=__codex_no_env_file__` and explicit Token Plan base URL. The available process-env candidate key still returned `401 Invalid API Key`, producing only fallback evidence:
  - `tmp/ordinary-mimo-v04-no-temp-key-blocker.json`
  - `tmp/ordinary-mimo-v04-no-temp-key-blocker-cases.json`
- No `.env`, provider config, UI, game rules, deployment, or token-reduction work was done.

Changed files:
- `progress.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json --max-cases=6 --json --out=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.json` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json --max-cases=6 --out=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.md` passed.
- `npm run llm:evaluate -- --models=mimo-v2.5-pro --base-url=https://token-plan-cn.xiaomimimo.com/v1 --lineup-count=9 --board=9p-seer-witch-hunter --human=9 --auto-human=mock --real-phases=DAY_SPEECH --max-llm-calls=1 --max-steps=20 --seed=91 --json --out=tmp/ordinary-mimo-v04-no-temp-key-blocker.json --eval-cases-out=tmp/ordinary-mimo-v04-no-temp-key-blocker-cases.json` completed with provider `401 invalid_key`; this is a credential blocker, not a valid quality sample.

Remaining risks:
- No fresh non-fallback real Mimo transcript exists after the v0.4 implementation.
- The current available local/process candidate key cannot produce a valid Token Plan transcript; a fresh temporary key is needed for the intended live review.
- The old 12:31 transcript remains unaccepted and is now only useful as re-evaluation evidence.

### 2026-06-10 v0.4 Human-speech Mechanism Implementation

Completed:
- User approved moving from docs-only v0.4 research into implementation.
- Added focused TDD coverage for the new v0.4 expectations: low-information weak water positive signal, latest accepted audit surfaces (`审发言缺口`, `观察位`, `这话本身`, `观察条件`), repeated same-axis pile-on, under-question self-defense, weak wolf-as-villager, and public role-action speech.
- Updated ordinary soft-director guidance from v0.3 four beats to v0.4 five units: `seatState`, `localObject`, `playerMove`, `socialTexture`, and `tableContinuation`.
- Tightened ordinary validator/evaluator coverage for the latest real Mimo surfaces without broad phrase bans: visible audit surfaces now fail, repeated same-axis pile-on now fails, weak but human speech receives positive evaluator signals, and grounded emotion / defensive motive / public role actions are protected.
- No `.env`, provider config, UI, game rules, deployment, real Mimo call, or token-reduction work was done.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- RED: new tests first failed on missing `positiveSignals`, missing `repeated_axis_pile_on`, missing v0.4 soft-director wording, latest audit-surface gaps, and repeated-axis pile-on.
- GREEN: `npm run test -- src/ai/llmEvaluation.test.ts` passed 23 tests.
- GREEN: `npm run test -- src/ai/speechProviders.test.ts` passed 271 tests.
- `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 294 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.

Remaining risks:
- No fresh paid/live Mimo transcript was run after this local implementation pass.
- The working tree still contains many pre-existing ordinary AI changes from earlier phases; this pass did not isolate or stage them.
- Subjective ordinary speech quality is still not accepted until the user reviews a fresh bounded transcript.

### 2026-06-10 Public Human-speech Deep Research v0.4

Completed:
- Continued docs-only research per user direction; no `src/**`, provider config, `.env`, real LLM call, UI, rules, or token-reduction work was done.
- Re-read project harness docs, AI speech thread, current ordinary Mimo task/eval cards, latest 12:31 Mimo review summary, progress, handoff, and long-running registry.
- Added `2026-06-10 公开真人发言深研与机制 v0.4` to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- Added/rechecked public sources: GitHub `boluoweifenda/werewolf`, FanLang-9 paper, `Werewolf Among Us`, `Werewolf Arena`, Foaster benchmark, Werewolf-XL, MaKTO-Werewolf, Chinese villager/seer/witch/hunter/first-round/new-player guidance.
- Re-ran a no-write public demo aggregation over GitHub `data/demo/opensource`: 11 JSON files, 98 Day 1 `audio` speeches, average about 560 chars, min 10, max 1001; 95/98 first-person, 96/98 direct-address, 85/98 uncertainty/temporary handling, 90/98 questions, 71/98 low-information/opening-position, 53/98 defense/explanation, 40/98 hold/pass/defer, and 37/98 emotion/pressure hits.
- Updated mechanism to five rhythm units: `seatState`, `localObject`, `playerMove`, `socialTexture`, and `tableContinuation`.
- Added positive protections for weak but human speech: `weakButHumanPasses`, `emotionalButGroundedPasses`, `defensiveSelfMotivePasses`, and `rolePublicActionPasses`.

Changed files:
- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- This pass is research/spec only; no prompt, fallback, validator, evaluator, or real provider behavior changed.
- v0.4 still needs user approval before code work because it changes the intended mechanism direction from bad-surface patching to action-space steering.
- No token-reduction work was done.

### 2026-06-10 v0.3 Prompt/Fallback Pass And Real Transcript

Completed:
- Converted the v0.3 human-speech rhythm into focused local coverage and small prompt/fallback changes: soft-director prompt now names current self-state, local public object, handling action, and voice texture; first-seat/table-read guidance now says state and handling boundary instead of `铺观察点 / 可验证观察点`; true-witch soft hidden-state hints are rejected; structured mock hard-claim fallback no longer emits `我卡这里`.
- Ran a fresh bounded Day 1 ordinary Mimo transcript with the user-provided temporary process env key only. No key was written to `.env`, docs, reports, or source.
- Latest evidence: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.json`, `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json`, `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-eval.json`, and `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.md`.
- Result: 6 Day 1 speech calls, all through `custom-speech:mimo-v2.5-pro`; 5 non-fallback real rows, 1 provider-error fallback row, accepted transcript validation failures 0. Local ordinary eval average 94.7 with `no_concrete_progression` 1 and `ordinary_jargon_stack` 1.
- Manual review: the sample is not accepted quality. It still has first-seat future-audit retries causing fallback, `当前先审你的发言缺口`, `观察位`, `这话本身`, `观察条件`, and too much one-axis focus on 1号's fallback sentence.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Focused RED/GREEN: soft-director/fallback tests and the new hard-claim fallback `卡` surface test failed first, then passed.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 269 tests.
- `npm run test -- src/ai/tableRead.test.ts` passed: 1 file / 28 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run llm:evaluate -- --models=mimo-v2.5-pro --base-url=https://token-plan-cn.xiaomimimo.com/v1 --lineup-count=9 --board=9p-seer-witch-hunter --human=9 --auto-human=mock --real-phases=DAY_SPEECH --max-llm-calls=6 --max-steps=90 --seed=91 --json --out=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.json --eval-cases-out=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json --max-cases=6 --json --out=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-eval.json` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with CRLF warnings only.
- Temporary-key prefix scan returned no persisted key matches.

Remaining risks:
- The latest real transcript should be shown to the user as evidence, not as a solved state.
- Validator already blocks first-seat future-audit wording, but Mimo still tries it and falls back. The next fix should reduce the live prompt tendency, not only add more fallback.
- No token-reduction work was done.

### 2026-06-10 Public Human-speech Research v0.3

Completed:
- Continued research/spec work only; no `src/**`, provider config, `.env`, real LLM call, or token-reduction work was done.
- Re-read the current ordinary Mimo task card, evaluation task card, latest 6-row Mimo review summary, progress, handoff, long-running registry, and AI speech thread docs.
- Re-ran a read-only public demo aggregation over GitHub `boluoweifenda/werewolf` `data/demo/opensource`: 11 public JSON files and 98 precise Day 1 `audio` speeches.
- New aggregation found: 95/98 first-person or us-perspective rows, 95/98 direct-address rows, 86/98 hedge/temporary rows, 95/98 question/response rows, 71/98 low-information/opening-position rows, 40/98 defense/explanation rows, and 36/98 hold/pass/defer rows.
- Cross-checked public sources: Werewolf Among Us, FanLang-9, Langrensha first-round and villager strategy pages, Foaster Werewolf benchmark, and Werewolf-XL.
- Updated `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` with `公开真人语料再抽样与人味节奏 v0.3`: current self-state, one local public object, one handling action, optional emotional texture.

Changed files:
- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- A temporary-key prefix scan returned no persisted key matches.

Remaining risks:
- This is still research/spec work only; no prompt, validator, fallback, or evaluator code changed in this pass.
- The latest real Mimo sample remains unaccepted; v0.3 needs a code pass and another bounded transcript before claiming speech quality improved.
- No token-reduction work was done.

### 2026-06-10 v0.2 Validator/Evaluator And Bounded Transcript Pass

Completed:
- Converted the latest user-reviewed shapes into focused speech-provider and evaluator coverage: first-seat future-audit hooks, courtroom/debate register, half-accept without landing, visible audit jargon such as `划一条线/划条线`, fallback audit surfaces, and truncated `你留了` tails.
- Preserved positive paths for bounded low-information water, direct witch reveal, landed half-accept, challenging another speaker's half-accept, and true-witch self reveal.
- Ran bounded real Mimo samples with temporary process env only; no key was written to `.env`, docs, reports, or source.
- Latest bounded transcript: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-113300.json`; 6 Day 1 calls, 4 non-fallback rows, 2 provider-error fallback rows, and validationFailureCount 0.
- Saved review summary: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-113300.md`.
- Latest local eval after the final local fix: averageScore 89.7, issueCount 4, issue codes `future_audit_hook` 1, `no_concrete_progression` 1, and `ordinary_jargon_stack` 2; high-risk row remained 1号.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Focused red-green tests were run for the newly covered bad shapes.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 268 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 1 file / 21 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- A temporary-key prefix scan returned no persisted key matches.

Remaining risks:
- The newest transcript is not accepted quality. 1号 still contains a bad first-seat hidden-state/future-audit hint, 2号/4号 still carry line-drawing jargon, and 3号/5号 fallback rows are thin.
- The latest provider run still had 2 provider-error fallback rows in 6 calls.
- No token-reduction work was done.

### 2026-06-10 Human Speech Source Refresh And v0.2 Mechanism

Completed:
- Paused code/provider work per the current direction and did a docs-only public-source calibration pass; no `src/**`, `.env`, provider config, UI, rules, real LLM call, or token-reduction work was done.
- Updated `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` with `2026-06-10 最新样本缺口与公开素材再校准`.
- Reframed the latest sample failures into three checkable speech-action gaps:
  - first-seat prompt-shaped `观察点 / 后面谁` wording should become low-information self-state plus a current handling boundary
  - true-witch speech should say why it reveals and how to handle silver water/today's vote, not use courtroom/debate phrasing such as `举证责任`
  - `认同一半` must land the accepted half, the reserved half, and the current handling action
- Added source-backed `普通局发言动作 v0.2`: `entryBeat`, `publicObject`, `moveLanding`, `voiceTexture`, and `antiTemplatePressure`.
- Added next-test targets: `futureAuditHook`, `courtroomRegister`, `halfAcceptWithoutLanding`, plus positive protections `boundedLowInfoWater` and `emotionalButGrounded`.

Changed files:
- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- This pass is research/spec only; no prompt, validator, fallback, or evaluator code was changed.
- The latest real Mimo sample remains unaccepted: 1号 prompt shape, 2号 debate register, and 3号 half-finished line still need a code pass and another bounded transcript after fixes.
- No token-reduction work was done.

### 2026-06-10 Ordinary Soft-director Post-fix Transcript Review

Completed:
- Implemented the ordinary soft-director path from the research spec: ordinary LLM input now carries current pressure, local public table objects, allowed player moves, recent surface moves, and prompt lines for first-person table-player rendering.
- Added focused regressions and narrow fixes for the latest user-reviewed shapes: visible player-jargon (`布置作业 / 划线 / 触线 / 这句话本身`), copied prior surface phrasing, duplicated-word slips, peace-night public-common-sense misreads, provider-error fallback suffix/template leakage, planned true-witch fallback, and silver-water recipient acknowledgement parsing.
- Ran a fresh bounded real Mimo Day 1 sample with the user-provided temporary process env key only; no key was written to `.env`, docs, reports, or source.
- Saved latest evidence: `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114.json`, `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114-cases.json`, `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114-eval.json`, and `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114.md`.
- Result: 6 Day 1 speech calls, all `custom-speech:mimo-v2.5-pro`, fallbackCount 0, errorCount 0, validationFailureCount 0; local eval average 91.7 with `logic_boundary_error` 1 and `no_concrete_progression` 1.
- Manual review: covered surfaces are gone and 4号 now gives a concrete challenge to 3号, but 1号 still has `观察点 / 后面谁` prompt shape, 2号 is too formal/debate-like, and 3号 remains half-finished. Do not call ordinary speech accepted.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/game/claims.test.ts` passed: 3 files / 307 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- The latest sample is better but still not user-accepted: first-seat prompt feel, over-formal 2号, and half-finished 3号 are still visible.
- Local evaluator likely false-positives true-witch saved-target reveal as `logic_boundary_error`; evaluator coverage needs refinement before relying on the score alone.
- No token-reduction work was done.

### 2026-06-09 Ordinary Public-source Speech Deep-dive

Completed:
- Continued the no-code public-source research pass for ordinary Werewolf speech; no `src/**` code was changed.
- Expanded `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` with source-backed calibration from `Werewolf Among Us`, `Playing the Werewolf game with artificial intelligence for language understanding`, `ReneeYe/werewolf_game_reasoning`, `Language Agents with Reinforcement Learning for Strategic Play in the Werewolf Game`, and Chinese role-speech guidance.
- Added a three-layer human speech rhythm for implementation: seat pressure/state, one local public table object, and a temporary handling action.
- Added positive low-information water examples, an `underQuestion` priority rule, and a public role-state matrix for villager, wolf, seer, witch, and hunter.
- Reconfirmed the implementation direction: soft director fields and candidate player moves first; validator/fallback remain narrow; no broad phrase bans, no large if/else rules table, no token-reduction work.

Changed files:
- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- This is still research/spec work only. The soft-director mechanism and evaluator improvements are documented but not implemented.
- The next implementation pass should start with focused failing tests for soft director inputs, low-info water positive cases, and under-question defense priority before spending another real Mimo sample.

### 2026-06-09 Ordinary User-feedback Validator And Fallback Pass

Completed:
- Used the user-provided temporary Token Plan key only through process env for bounded Day 1 Mimo samples; no key was written to `.env`, docs, reports, or source.
- Converted the user's latest transcript feedback into focused speech-provider regressions: meta-audit opener, future-seat homework, peace-night common-sense misattack, empty micro-move, repeated/single `卡` surface, confused later-chain wording, unresolved `没听明白...这部分我理解` endings, and peace-night `定义刀口/找女巫` rule lectures.
- Tightened ordinary prompt/fallback wording so it no longer recommends `卡一句 / 卡我的是`; provider-error fallback was shortened and stopped using `后面我看谁继续复读这个点` / `等他自己把立场落下来`.
- Ran multiple bounded real samples. The latest recorded sample before the final local death-shape guard is `tmp/ordinary-mimo-phase2-day1-final-local-fix-real-20260609-233444.json`; it had 6 speech calls, 4 non-fallback rows, 2 provider-error fallback rows, and one `death_cause_overclaim` quality issue that is now covered locally.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red-green focused tests were run for the newly covered bad shapes.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 258 tests.

Remaining risks:
- No paid Mimo rerun was made after the final `定义刀口/找女巫` local guard.
- Latest real transcript still is not something to call accepted: provider fallback occurred, custom lineup names still leak `-mimo-v25` suffixes, and several seats still circle the same 1号 peace-night axis.

### 2026-06-09 Ordinary Mimo Invocation And Speech Quality Follow-up

Completed:
- Diagnosed the current Mimo calling path without persisting secrets. Local saved credentials still return `401 invalid_key`, while a user-approved temporary Token Plan key succeeds for direct and project-shaped requests when passed only as process env.
- Found a routing trap in `scripts/evaluate-llm-game.mjs`: `--models=mimo-v2.5-pro` uses the custom lineup path and needs an explicit Token Plan `--base-url`; otherwise the default base URL is DeepSeek.
- Fixed runtime custom Mimo routing so AI-friend Mimo configs inherit Mimo speech safeguards: disabled thinking, higher speech token floor, and 180s speech timeout.
- Tightened ordinary speech prompt/validator around real-sample failures: peace-night wolf/witch rule lectures, legitimate identity-line pivots after pressure-source callbacks, later external counterclaims, and cut-off sentence tails.
- Latest bounded real sample `tmp/ordinary-mimo-phase2-day1-3calls-after-truncation.json` used custom Mimo for all 3 calls, with 2 non-fallback speeches and 1 fallback caused by the intended low-information skipped-seat validator.

Changed files:
- `src/ai/modelLlms.ts`
- `src/ai/modelLlms.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/modelLlms.test.ts` passed: 1 file / 16 tests.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 245 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- The latest real sample is bounded and not a full subjective transcript pass. It shows Mimo can be reached with the temporary key and route fixes, but ordinary speech quality is not final.
- The next narrow quality pass should reduce first-speaker low-information skipped-seat behavior and make provider-error fallback less generic before spending a 6-9 row Mimo review.

### 2026-06-09 Ordinary First-seat Low-info Follow-up

Completed:
- Tightened ordinary low-information first-seat prompt guidance: first seat should default to no named future-seat homework and leave a self-owned condition instead.
- Added validation for ordinary low-information first-seat speeches that name a future seat and assign homework such as `轮到你时我想听你怎么看`.
- Kept the non-first-seat positive path: after someone has spoken, a concrete question to the immediate next speaker can still pass when it is tied to already-spoken material.
- Reworked ordinary provider-error first-seat fallback so it no longer says `下一位正常接麦`.
- Reworked fallback gap wording so a prior peace-night line with a concrete action is not misread as `只说了平安夜，但没说自己怀疑谁`.
- Attempted a bounded 6-call Day 1 Mimo lineup sample with current local environment and explicit Token Plan base URL; it still failed with `401 invalid_key`, so the output is fallback-pollution evidence only: `tmp/ordinary-mimo-phase2-day1-6calls-first-seat-fix-fallback-check.json`.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red-focused tests first failed for first-seat named future homework, player-mouth guidance, provider-error first-seat fallback, and peace-night action fallback wording.
- `npm run test -- src/ai/speechProviders.test.ts -t "first-seat low-info|player-mouth guidance|provider-error first-seat fallback"` passed: 7 focused tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "peace-night action"` passed: 1 focused test.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 248 tests.
- `npm run test -- src/ai/modelLlms.test.ts` passed: 1 file / 16 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- No fresh real-Mimo transcript was produced because the current persisted local Mimo key is invalid. The next transcript review needs a valid temporary process env key.
- Provider-error fallback is less harmful but still not a substitute for real Mimo quality review.

### 2026-06-09 Ordinary Mimo Bounded Transcript Review

Completed:
- Ran a bounded 6-call Day 1 ordinary Mimo transcript with a user-provided temporary process env key only; no key was written to `.env`, docs, or reports.
- Saved evidence: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336.json`, `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-cases.json`, `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-eval.json`, and review summary `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336.md`.
- Result: 6 Day 1 speech calls, all through `custom-speech:mimo-v2.5-pro`; 4 non-fallback real rows, 2 provider-error fallback rows, final-row validation failures 0, local ordinary eval average 91.7.
- Subjective review found concrete remaining bad shapes: a real Mimo row ending on dangling `但`, fallback rows still using audit-like `身份线 / 先留一处疑问 / 这轮我只听谁把怀疑落到具体人身上`, and a real Mimo row saying `放进观察位` plus waiting for later speakers to `接这条线`.
- Added focused regressions and narrow fixes: ordinary truncation validation catches dangling `但`; ordinary provider-error fallback avoids the covered audit-template skeleton; ordinary validation rejects observation-slot plus later-chain-review wording.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Real bounded Mimo transcript command passed and wrote the evidence files above.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-cases.json --json --out=tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-eval.json` passed.
- Focused red-green `npm run test -- src/ai/speechProviders.test.ts -t "cut-off seat reference|provider-error fallback away from repeated audit templates|observation-slot transcript templates"` first failed on the new cases, then passed.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 249 tests.

Remaining risks:
- No fresh paid Mimo rerun was made after the local fixes; the exact bad shapes are covered by tests, but live confirmation needs another bounded real transcript.
- The sample still had 2 provider-error fallback rows, so provider stability and model compliance remain part of the quality risk.

### What's Done

- [x] Ordinary player-type speech/decision consistency follow-up: single-player and room creation now carry AI Pool `ordinaryPlayerProfile` through the same `aiFriends` payload, built-in AI friends have stable ordinary player-type presets, and ordinary persona strategy cards are inferred from those player types instead of model-name stereotypes. Ordinary speech/action prompts now label this as `普通局玩家类型策略`, keep necessary terms like 平安夜/女巫/银水/查杀/金水, and push output toward first-person table-player language.
- [x] Ordinary Day1 Mimo intent repair follow-up: tightened ordinary no-guard witch D1 wording after user review. Prompt/table-read/table-memory now use one unambiguous phrase for death shape (`狼刀成功，女巫没救`; `女巫用了救药`) instead of `没救/没用解药` or `救药/解药`. Validator now rejects D1 ordinary speeches that turn first-night death into wolf-kill-intent homework (`狼队为什么刀/刀法意图/后置位答上来`), rejects low-info speakers skipping the next unspoken seat to assign arbitrary future tasks, and rejects invented night deaths when the public table has no death announcement or has been framed as peace night. Real Mimo sample `tmp/ordinary-mimo-d1-intent-repair-1780935075255.md` improved to 4 speeches / fallback 2 / old bad-pattern hits 0, but still exposed a non-fallback invented `7号走的` line; local regressions now cover that exact failure.
- [x] Ordinary Day1 Mimo post-validator sample follow-up: new real Mimo seed 12 sample `tmp/ordinary-mimo-d1-post-fallback-fix-1780982116448.md` produced 6 speeches, fallback 3, old death wording 0, kill-intent 0, rule-lecture 0, false-peace 0, generic future-task 0. The run exposed that provider-error fallback previously invented `平安夜` on a death board and assigned `轮到6号时说清` homework; fallback now aligns with public death announcements and uses table-level follow-up instead of generic future-seat tasks. A non-fallback 4号 variant that skipped 5号 and directly questioned 6号 is now covered by a single-future-seat skip validator.
- [x] Ordinary no-guard witch death-shape follow-up: D1 single death is now treated as settled common sense (`狼刀成功，女巫没救/没用解药`) and peace night as `女巫用了救药/解药`, both only one sentence before a concrete game action. Speech validation/repair now rejects rule-lecture wording such as `狼首夜必刀/女巫手里有解药/毒口重合刀口/药瓶状态` and rejects ordinary speeches that only describe death shape without a suspicion, hold, question, or voting condition. Verification passed targeted/broader AI Vitest, `npx tsc --noEmit --pretty false`, Mimo direct health check, and a real Mimo seed 12 single-death sample with non-fallback `mimo-speech:mimo-v2.5-pro`, no validation errors, no covered rule-lecture/jargon hits, and a concrete ask to 1号.
- [x] Ordinary Day1 Mimo quality check follow-up: after a real seed 12 Day1 sample still exposed cut-off text (`我先把1`, `我倒想知道`), repeated fallback audit templates (`我只抓一个点`, `中间过程没说透`, `接一下这条发言链`), and a bad read that attacked settled death common sense as `带节奏`, ordinary speech validation now rejects those patterns. Ordinary provider-error fallback wording no longer uses the covered repeated audit templates, and Mimo fallback opener no longer starts with `我抓一个细节`. Latest real sample after most fixes improved to fallback 1/8, bad-template hits 0, but still had one now-covered cut-off line; final local tests cover that line.
- [x] AI Pool cleanup follow-up: removed the legacy `打法类型速览` and right-side `参数说明/调参参考` cards because they duplicated and conflicted with the new `普通局玩家类型` panel. The page now keeps one play-style surface: per-AI ordinary player type plus sliders; model cards remain model-routing only.
- [x] Ordinary speech quality follow-up: added hard validation and retry repair for global-table review wording and stacked internal jargon such as `收益来源/发言链/闭合/收口/压力源`; fallback speech and successful ordinary LLM speech now run through ordinary-player wording cleanup for report-like terms such as `死亡形态/反面可能性/按规则推`. Latest real Mimo sample is `tmp/ordinary-mimo-player-mouth-seed91-retry.md` / `.json`: 3 Day1 speeches, all `mimo-speech:mimo-v2.5-pro`, fallback 0, validation failures 0, covered jargon hits 0.
- [x] Latest ordinary player-type verification passed: `npm run test -- src/ai/speechProviders.test.ts src/components/AiPoolClient.mobile.test.ts` (2 files / 231 tests), `npx tsc --noEmit --pretty false`, and `npm run lint`. Earlier broader ordinary-player propagation suite also passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.test.ts src/components/game/aiFriendStorage.test.ts src/app/api/games/aiFriends.test.ts src/app/api/rooms/api.test.ts` (9 files / 313 tests).
- [x] Migrated the class-trial-style decision layer into ordinary Werewolf AI without replacing model personas. Added inferred persona strategy cards for DeepSeek/Claude/GPT/Kimi/Mimo and custom AI friends, camp-aware adaptation for good/wolf/power roles, ordinary live intent, public reason, anti-template move, and speech-vote continuity state. Wired it into speech LLM input, action LLM input, mock/fallback speech, and private `AiSeatMemory`; added AI pool strategy-summary display plus a manual refresh entry for custom cards.
- [x] Fixed `AI_LLM_SPEECH_FALLBACK_PERSONAS=off` so real speech checks can disable persona fallback routing instead of silently falling back to GPT/Claude/GLM. Real Mimo-only smoke now requests only Mimo, but current local Mimo credentials fail with 401 Invalid API Key.
- [x] Verification for ordinary AI migration: `npm run test -- src/ai/personaStrategyCards.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/components/AiPoolClient.mobile.test.ts` passed 5 files / 252 tests; targeted ESLint for changed AI/UI files passed; `npm run simulate:ai -- --games=10 --seed-start=91` passed 10/10 default 9p games with 0 fallback decisions; `npm run simulate:ai -- --board=12p-sheriff-seer-witch-hunter-guard --games=10 --seed-start=91` passed 10/10 12p games with 0 fallback decisions. Later cleanup removed stale `.next` output and fixed class-trial harness test typing, so `npx tsc --noEmit`, full `npm run lint`, and `npm run build` now pass; build still reports the existing Turbopack NFT trace warning.
- [x] Follow-up ordinary AI speech-template pass: removed live-intent scaffolding from ordinary LLM prompt material and mock/fallback speech, changed public reason/commitment wording away from prompt-like `liveIntent/publicReason/commitment` fields, varied gold-water protection and mock evidence phrasing, and added regressions so ordinary mock speech cannot say the old strategy-template phrases. Verification: related AI/UI Vitest group passed 5 files / 253 tests; targeted ESLint passed; single-game `npm run audit:ai -- --board=9p-seer-witch-hunter --games=1 --seed-start=91 --sample=1 --json` completed with 0 fallback and 0 audit issues. Repeated-fragment count for the checked seed dropped from 16 to 8, but mock speech still has residual generator-like phrasing and should not be treated as final subjective quality.
- [x] Ordinary real-Mimo speech follow-up after user reported ordinary AI still templated: increased ordinary LLM speech budget to 4 sentences / 520 chars while keeping class-trial compact repair at 3 sentences / 360 chars; added hard guards and repair guidance for non-opening seats calling themselves `首置位`, low-info opening copy-paste, repeated `压力源/只有观察点没结论` axes, self witch save reports, seat-name seer reports, and several already-spoken / witch-attribution false positives. Latest real Mimo sample with temporary process env only: `tmp/ordinary-mimo-real-speech-seed91-day1-after-repeat-fix.md` / `.json`, 9 speeches, 7 real non-fallback Mimo rows, fallback 2, `repeatedPressureSourceCount: 0`, repeated fragments none. Subjective result: no 1/2号 opening copy-paste and 2号女巫 hard claim is recognized by later seats; remaining fallback causes are model repeats of the 1号 pressure axis and asking an already-spoken 4号 to supply logic.
- [x] Renamed fixed host/system audio files under `public/audio/host` from English logic keys to Chinese content filenames, for example `night-wolves.mp3` -> `天黑请闭眼-狼人请睁眼-请选择今晚的击杀目标.mp3` and `seat-1.mp3` -> `1号.mp3`. Added `src/components/game/hostAudioFiles.ts` so game code keeps stable logic keys while resolving runtime URLs to Chinese filenames, wired both local `GameClient` host cues and room host cues, and updated `scripts/generate-host-audio.mjs` plus `public/audio/host/README.md` to emit/document the new names. Verification: focused host audio test, dry-run generation check, old-path scan, and directory scan.
- [x] Local cleanup follow-up removed disposable build/cache output (`.next`, stale tmp artifacts, old AI speech cache, and clean unused worktrees), freed about 5.07 GB, and kept the local DB plus current host audio rename assets. Verification after cleanup: `npm run lint`, `npx tsc --noEmit`, `npm run build`, 8-file focused Vitest group / 312 tests, targeted ESLint, and `git diff --check` passed; build still reports the existing Turbopack NFT trace warning and diff check only reported CRLF warnings. `.next` was removed again after build verification to avoid leaving a large local cache.
- [x] Fixed the latest D1 gold-water misread after user review: a self-owned check-result/gold-water statement now counts as a hard seer claim, D1 observers are explicitly told not to demand first-check motive, and "reporting 3号金水 then not outing around that gold water" is treated as normal gold-water handling rather than "提前保护金水票型". Added regressions for the exact 雾切/苗木/3号金水 failure shape and kept seer counterclaim black-check speech from being falsely rejected. Verification: `npm run test -- src/ai/speechProviders.test.ts`, `npm run test -- src/game/claims.test.ts`, targeted ESLint, and `git diff --check`; `npx tsc --noEmit` is currently blocked by existing malformed `.next/dev/types/routes.d.ts`.
- [x] Full-game Mimo viability check reached repeated completed games with all actions on real Mimo and no action fallback. Latest real run: `tmp/class-trial-mimo-full-game-1780746535599.md` / `.json`; `GAME_OVER` on D2, good side won by `所有狼人出局`, 40 AI logs, 18 speeches, 22 actions, `actionFallback: 0`, `speechFallback: 1`, all providers `mimo-action:mimo-v2.5-pro` / `mimo-speech:mimo-v2.5-pro`.
- [x] Practical judgment captured: the flow is completable/playable for a full game, but not yet a clean 0-fallback speech run. The remaining fallback is a D1 黑白熊 counterclaim speech; local fallback text is legal and role-shaped, but it is still fallback and should not be counted as real non-fallback LLM quality.
- [x] Stopping point: do not keep spending real full-game Mimo runs just to chase 0 fallback. Future work should use targeted replay/unit tests around the D1 黑白熊 counterclaim path, or manually review the latest transcript for subjective quality before any further full-game spend.
- [x] Targeted low-cost follow-up fixed the local provider-path cause behind the latest D1 黑白熊 fallback: long class-trial hard-info speeches no longer normalize by keeping only the first 6 sentences if that would drop the planned identity/check/vote-boundary sentence. The regression uses the exact latest raw shape (`我是预言家，昨晚查验结果是1号苗木诚查杀...`) and verifies the normalized provider result stays non-fallback locally.
- [x] Full-game Mimo fallback follow-up fixed two local causes before the next real run: quoted third-party seer claims no longer make an observer satisfy the speaker's own black-check finality contract, and post-speech challenge timeline validation now evaluates missing-response wording within the same sentence so a 5号 pressure line cannot be stitched to a 3号 reference across sentences.
- [x] Explicit long-run retry settings now work above the old 3-retry ceiling: `AI_LLM_MAX_RETRIES=6` yields 7 total output attempts, while the default remains 2 total attempts and `AI_LLM_MAX_RETRIES_CAP` can still bound unusually high values.
- [x] Latest focused verification passed after the targeted normalization fix: `npm run test -- src/ai/speechProviders.test.ts -t "Monokuma"` (3 focused tests), `npm run test -- src/ai/modelLlms.test.ts src/ai/speechProviders.test.ts src/game/seerGoldHide.test.ts src/ai/tableRead.test.ts` (4 files / 253 tests), and `npx tsc --noEmit`.
- [ ] Fresh real full-game Mimo rerun is intentionally skipped for cost control. Do not use or persist chat-provided keys; only rerun with a temporary process env if the user explicitly re-approves another real full-game spend.
- [x] Mimo D2 follow-up reached a fresh real D2 sample with `d2SpeechFallback: 0`: `tmp/class-trial-mimo-d2-speeches-1780737098833.md` / `.json`; 8 D2 speeches, all `mimo-speech:mimo-v2.5-pro`, no D2 speech fallback, while D1 in the same run still had 3 fallback rows.
- [x] Fixed D2 Mimo fallback causes found during real samples: Mimo speech timeout now defaults to 180s for speech quality runs, quoted `为什么/怎么` fragments no longer false-trigger unfinished-question validation, inline stage directions such as `（转向桌面）` are stripped, and repairable internal audit terms such as `校验没闭合` are rewritten before validation instead of forcing fallback.
- [x] Latest D2-focused verification passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/modelLlms.test.ts` (2 files / 210 tests), `npx tsc --noEmit`, real Mimo D2 harness `npx vitest run src/ai/classTrialMimoD2Harness.test.ts --testTimeout 900000`, and `git diff --check` with CRLF warnings only.
- [x] Locked the class-trial lineup to the user-approved mapping: wolves are 黑白熊、江之岛盾子、塞蕾丝缇雅; good side is 苗木诚、雾切响子、腐川冬子、十神白夜、高松灯、千早爱音, with roles `SEER/WITCH/VILLAGER/WEREWOLF/WEREWOLF/WEREWOLF/HUNTER/VILLAGER/VILLAGER`.
- [x] Wired fixed seat-role overrides through the class-trial browser create-game path, `/api/games`, `gameService`, and `createGame()`, and added validation that override counts match the selected board role multiset.
- [x] Fixed `/api/games` role-card sanitization so browser-created class-trial games preserve `classTrialVoiceProfile` instead of stripping structured voice guidance.
- [x] Updated the D1 all-speech scoring script to use the fixed class-trial role mapping and the accepted sample scenario: 苗木诚 true seer checks 6号塞蕾丝缇雅 as wolf.
- [x] Added hard validation for planned SEER checks even when the real role is wolf and `AI_SPEECH_STRICTNESS=loose`; planned counterclaims must say the speaker is claiming seer and must cover the target/result.
- [x] Added public black-check fallback context with three response states: target unspoken, target already spoke before a later counter-check, and target responded after the check. This prevents asking already-spoken seats to answer again and keeps late speakers on the current public relation.
- [x] Improved class-trial fallback exits for key hard-info roles: Naegi/Monokuma/Enoshima/Celestia black-check claims, Celestia checked-seat response, Togami hunter identity claim, Fukawa no-trigger public-check response, Tomori and Anon late relation pivots.
- [x] Added local attempt diagnostics to the D1 all-speech scoring script output so fallback reports show provider attempt issues, validation errors, and raw-output previews instead of only `fallback: true`.
- [x] Reran the fixed D1 scoring sample with diagnostics: `tmp/class-trial-d1-all-speeches-score-1780652739209.md` / `.json`; 9 speeches, 9 fallback, and all 18 LLM attempts failed before validation with DeepSeek `402 Insufficient Balance`. Current fallback rate is therefore an external provider/balance issue, not evidence that the main LLM output is being rejected by speech validators.
- [x] Tested the user-provided Mimo route as a temporary process env override without writing secrets to `.env`: `tmp/class-trial-d1-all-speeches-score-1780653397137.md` / `.json` produced 9 speeches, 4 fallback, average 86, `viewerQuality pass=4 warn=1` across 5 non-fallback rows. The subjective read was better character voice than the current DeepSeek route, with remaining validator issues around first-check motive, peaceful-night reuse, and planned counterclaim contract.
- [x] User decision captured: for class-trial theme only, fix the game brain to Mimo and prioritize decision/speech quality over latency; reasoning and speech may both use Mimo. Ordinary Werewolf and custom AI pool behavior remain outside this change.
- [x] Switched current class-trial fixed friends from `deepseek-calm-analyst` to `mimo-logic-checker`, updated visible class-trial runtime labels to `真实 LLM · Mimo-v2.5-pro`, and changed class-trial action repair routing so it uses the actual seat persona instead of a hard-coded `DeepSeek`.
- [x] Added/updated focused regressions proving class-trial action repair retries `mimo-v2.5-pro -> mimo-v2.5-pro` without GPT fallback, class-trial speech repair retries `mimo-v2.5-pro -> mimo-v2.5-pro` without GPT fallback, fixed class-trial friends all use `mimo-logic-checker`, and home/table UI labels show Mimo.
- [x] Post-code Mimo D1 fixed-scenario sample: `tmp/class-trial-d1-all-speeches-score-1780654895988.md` / `.json`; 9 speeches, 4 fallback, average 83, `viewerQuality pass=4 warn=1` across 5 non-fallback rows, all non-fallback providers on `mimo-speech:mimo-v2.5-pro`. It proves the fixed route is Mimo, while still showing repeated black-check/thought-axis issues and validator fallback on some seats.
- [x] Added a full-game Mimo harness at `tmp/class-trial-mimo-full-game.mjs` and ran it with temporary process env secrets only. `tmp/class-trial-mimo-full-game-1780655742482.md` / `.json` completed a full game to `GAME_OVER` on Day 4, wolves won by `所有平民出局`, with 41 Mimo actions, 24 Mimo speeches, 0 action fallback, and 6 speech fallback.
- [x] Added hard validation for class-trial speeches that end mid-thought without a sentence close, after the full-game Mimo run exposed a non-fallback Anon line ending at `塞蕾丝缇雅，你那句`.
- [x] Latest Mimo-routing/truncation verification passed: `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` (6 files / 265 tests).
- [x] Latest final verification passed: `npx tsc --noEmit`, `npm run lint`, `node --check tmp/class-trial-mimo-full-game.mjs`, `npm run build`, `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md`, `npm run harness:check`, and `git diff --check`. Build still reports the existing Turbopack NFT trace warning; diff check reports CRLF warnings only.
- [x] Follow-up Mimo fallback-rate pass found one validator false negative: natural seer black-check treatment such as `今天她必须正面接这个结果，全桌怎么处理她，就从她自己的回应开始` was rejected as missing today's treatment. Added a regression and widened only `hasSeerBlackCheckVoteBoundary()` for this natural treatment wording while keeping target/result and no-self-proof-reversal guards.
- [x] Post-fix Mimo D1 fixed-scenario sample: `tmp/class-trial-d1-all-speeches-score-1780662175071.md` / `.json`; 9 speeches, 6 fallback, average 85, quality sample 3, `viewerQuality pass=3`. 苗木诚 is now non-fallback Mimo output with score 93, proving the seer-treatment false negative was fixed. Remaining fallback causes are mostly prompt/behavior failures around first-check motive, peaceful-night misuse, overlong report style, and already-spoken/final-seat constraints.
- [x] Post-truncation-validator full-game Mimo rerun: `tmp/class-trial-mimo-full-game-1780662562076.md` / `.json`; completed to `GAME_OVER` on Day 2, wolves won by `所有神职出局`, with 24 Mimo actions, 14 Mimo speeches, 0 action fallback, and 1 speech fallback. A scan found no dangling/truncated speech endings.
- [x] Latest real sample evidence: `tmp/class-trial-d1-all-speeches-score-1780651610416.md`; 9 speeches, 9 fallback, average 83, no anti-template findings. Because all rows were fallback under the current `.env` loose/model-routing state, this proves fallback legality/shape only; it is not subjective proof that non-fallback LLM speech is ideal.
- [x] Latest verification passed: targeted aggregate 8 files / 375 tests, `npx tsc --noEmit`, `npm run lint`, `npm run build`, task-card gate, harness check, and `git diff --check` with CRLF warnings only.
- [x] Latest class-trial D1 speech-quality pass reached the current target on real non-fallback rows: `tmp/class-trial-d1-all-speeches-score-1780643618268.md` produced 9 speeches, 5 fallback, average 83, quality sample 4 non-fallback speeches, `viewerQuality pass=4`, and no non-fallback anti-template findings. Fallback remains deliberately out of scope for this pass.
- [x] Added live-state guidance, hard validation, and retry repair for same-follower dogpiles after a public black check: later speakers should not keep chasing the same follower on the same `standard / two-sided / fake-focus` point.
- [x] Added checked-seat peaceful-night protection: a seat under a public black check is steered and validated away from reusing `平安夜/女巫用药/药线` while answering the check.
- [x] Added late black-check inventory protection: late speakers are steered and validated away from recap-style `平安夜 -> 苗木 -> 雾切 -> 腐川 -> 黑白熊` summaries and toward one concrete target/action.
- [x] Updated report-only quality scoring so valid follower pivots, including direct-address plus pronoun continuation, are not incorrectly flagged as `black_check_axis_repeat`.
- [x] Latest verification passed: 8-file class-trial aggregate / 253 tests, persona JSON parse, `npx tsc --noEmit`, `npm run lint`, and `npm run build` with the existing Turbopack NFT trace warning.
- [x] Latest follow-up fixed the repeated black-check conversation shape: after the checked seat has spoken and multiple followers repeat the same `首跳查杀/查杀位自证` axis, live-state guidance and hard validation now push later speakers toward follower pressure, rescue behavior, focus-locking, or character-specific reaction.
- [x] Added a hard Kirigiri relation guard for D1 class-trial: before the checked seat answers an unopposed first black check, Kirigiri should not pressure the claimant with `票压/锁票/站不站得住/我不跟` language, because that reads like shielding 3号 rather than detective neutrality.
- [x] Added hard validation for late speakers who replay the same black-check axis or keep asking the same checked-seat self-proof question after multiple followers already asked it; repair instructions now redirect those failures to new targets instead of making the same line slightly prettier.
- [x] Updated the report-only anti-template analyzer so a speaker who explicitly calls out the table for repeating the same black-check axis is not itself counted as `black_check_axis_repeat`.
- [x] Latest verification passed: `src/ai/classTrialLiveState.test.ts` 9 tests, `src/ai/speechProviders.test.ts` 154 tests, `src/ai/classTrialSpeechQuality.test.ts` 9 tests, the 8-file class-trial aggregate / 223 tests, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [x] Latest sample evidence: `tmp/class-trial-d1-all-speeches-score-1780620247379.md`; 9 speeches, 5 fallback, average 77, quality sample 4 non-fallback speeches, `viewerQuality pass=3 warn=1`, and no non-fallback `unearned_claimant_pressure`. Fallback remains out of scope per user direction.
- [x] Corrected the latest class-trial black-check relation frame after user review: an unopposed first seer black-check should not make Kirigiri pressure the claimant or complain about `首验理由` / `票压太满`. Good observers now hold the claimant provisional, force the checked seat to answer, and watch for counterclaims, rescue, or public rewrites.
- [x] Updated wolf-teammate black-check live-state guidance so wolves do not all borrow the same claimant-pressure axis; they redirect to the checked teammate's response and who rescues too quickly.
- [x] Added report-only quality findings for `unearned_claimant_pressure` and `black_check_axis_repeat`, plus repeated black-check-axis avoidance in `ClassTrialLiveState`.
- [x] Fixed black-check target-response validation so natural claimant references like `苗木同学，你查杀我？我不认` pass as answering the public black check.
- [x] Latest focused verification passed: `src/ai/classTrialLiveState.test.ts`, `src/ai/classTrialSpeechQuality.test.ts`, Fukawa-focused `src/ai/speechProviders.test.ts`, the 8-file class-trial aggregate / 218 tests, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [x] Latest sample evidence: a direct 1-3 raw probe produced non-fallback Kirigiri and Fukawa lines in the corrected direction; full report `tmp/class-trial-d1-all-speeches-score-1780588824661.md` still had 5 fallback rows and should not be treated as final subjective proof.
- [x] Follow-up role speech test found a real wiring bug: `local-assets/class-trial-pack/personas.json` had the first-batch `classTrialVoiceProfile` data, but `src/game/aiFriends.ts` stripped it during `resolveAiFriendsForGame()`, so `createGame/buildAgentView` originally fell back to legacy role lens text.
- [x] Fixed `sanitizeAiCharacterRoleCard()` in `src/game/aiFriends.ts` to preserve and sanitize `classTrialVoiceProfile`, including scenario reactions, alignment reactions, acceptable/unacceptable forms, overuse bans, and dramatic boundaries.
- [x] Added a regression in `src/game/aiFriends.test.ts` proving class-trial role voice profiles survive friend resolution and setup snapshots.
- [x] Reran the fixed D1 role-speech sample: `tmp/class-trial-d1-all-speeches-score-1780586047863.md`; Kirigiri, Fukawa, and Enoshima were all non-fallback, all `viewerQuality: pass`, all `characterPresence: strong`, and the aggregate improved to 9 speeches / 4 fallback / average 81 / quality sample 5.
- [x] Follow-up subjective read corrected the prior interpretation: Kirigiri pressuring Naegi's over-tight vote framing after an unopposed first black-check is not detective-like enough, because it can read as protecting 3号. The corrected target is the checked seat's response and the table's later reactions.
- [x] Latest follow-up verification passed: related focused tests 8 files / 211 tests; `npx tsc --noEmit`; `npm run lint`; `git diff --check` with CRLF warnings only.
- [x] Added the first-batch structured class-trial role voice profiles for `kirigiri`, `fukawa`, and `enoshima` in local persona data, while intentionally leaving Tomori unmigrated for this pass.
- [x] Extended class-trial role-card loading/sanitization so `classTrialVoiceProfile` reaches AI role cards, and added a formatter that turns personality core, value bias, reaction tendency, overuse bans, scenario reactions, and alignment reactions into LLM-facing guidance.
- [x] Replaced the migrated roles' fixed “role action” prompts with profile-aware, softer live behavior guidance. Kirigiri, Fukawa, and Enoshima are now steered by current pressure and character impulse instead of one repeated tag such as `冷静切证词`, `先防御/刺一句`, or `结构/收益`.
- [x] Added `ClassTrialLiveState` so class-trial speech guidance carries a current intent such as self-preservation, pressure, withholding, emotional misread, or theatrical escalation while still preserving turn order and Werewolf playability.
- [x] Added a loose report-only `analyzeClassTrialSpeechQuality()` anti-template evaluator that separates hard validity from viewer quality and reports evidence plus revision direction for boring-but-correct, repeated-axis, repeated-role-label, weak-character, and weak-dialogue failures.
- [x] Updated `tmp/class-trial-d1-all-speeches-score.mjs` so fixed D1 reports include `viewerQuality`, `characterPresence`, `liveIntentPresent`, repeated axes, and anti-template findings; fallback rows are explicitly ignored for quality aggregation per the user's direction.
- [x] Latest fixed D1 sample for this pass: `tmp/class-trial-d1-all-speeches-score-1780580906170.md`; 9 speeches, 7 fallback, average 78, quality sample 2 non-fallback rows, `viewerQuality pass=2`, and no anti-template findings in non-fallback rows. Fallback remains out of scope for this pass.
- [x] Latest verification passed: focused class-trial tests 7 files / 201 tests; `npx tsc --noEmit`; `npm run lint`; `npm run build`; task-card gate; harness check; `git diff --check` with CRLF warnings only.
- [x] Tried the user-approved class-trial experiment of stripping decision/audit scripts from the initial LLM-visible speech input: class-trial `speechContract.mustSay/mustNotAsk`, `speechPlan`, `constraints`, expert strategy, reasoning frames, claim audit, debate agenda, and table task scripts are no longer shown to the initial LLM call; backend validation and retry repair remain active.
- [x] Root-caused the renewed D1 `首验理由/选人依据` attacks to the LLM's own Werewolf prior after the script strip, not an explicit table-task instruction. Raw DeepSeek outputs independently generated lines like `选3号查验的依据是什么`, `凭什么查杀我`, and `为什么首验摸到3号`.
- [x] Fixed the LLM-facing correction path without restoring the old decision/audit layer: retry repair now maps `D1首验理由不是主要攻击点` to concrete alternatives (`查杀位如何回应`, `有没有预言家对跳`, `这条查杀今天怎么处理`, `谁公开和结果对撞`), and the visible system line no longer says `D1不需要解释首验理由` where the model could copy it into dialogue.
- [x] Relaxed class-trial black-check recognition so natural seer wording such as `昨晚查验了3号腐川冬子，结果是狼人。所以腐川是我的查杀` counts as an explicit black check instead of being misread as missing `3号查杀`.
- [x] Latest real D1 all-seat sample after the LLM-only correction: `tmp/class-trial-d1-all-speeches-score-1780567243006.md`; 9 speeches, 2 fallback, average 78. For the user's current LLM-only question, the important result is that 苗木诚 was non-fallback real DeepSeek output and the non-fallback speeches no longer made `首验理由/为什么验3号` the attack axis. Remaining weakness is role-action depth for 雾切、高松、爱音 and occasional fallback, which the user asked not to optimize here.
- [x] Latest verification passed: related focused AI/claims tests (`src/game/claims.test.ts`, `src/ai/tableRead.test.ts`, `src/ai/speechProviders.test.ts`, `src/ai/classTrialPersonaDirector.test.ts`, `src/ai/classTrialSpeechDirector.test.ts`, `src/ai/classTrialCharacterLens.test.ts`) 6 files / 221 tests; `npx tsc --noEmit`; `git diff --check` with CRLF warnings only.
- [x] Root-caused the latest weird 苗木诚 seer line to output-facing plan leakage: D1 true-seer black-check `talkingPoints` and `tableTask.line` still contained internal negative constraints such as `可商量观察`, `他发言只影响别人怎么接`, `不改变我这条结果`, and fallback/contract wording still encouraged `降温/轻放`.
- [x] Replaced the seer black-check material with first-person role actions: `我跳预言家`, `昨晚查验结果是查杀`, `今天我的票先压查杀位`, and `谁要保查杀位，就公开和我的结果对撞`; the D1 first-check rule now stays in constraints as `不要要求预言家解释首验理由` instead of leaking as table dialogue.
- [x] Added/updated regressions so class-trial seer black-check plans and speech contracts reject `可商量观察/降温/观望/他发言只影响别人怎么接/不改变我这条结果/不要只报结论/轻放` as output-facing material.
- [x] Latest real D1 all-seat sample after this root-cause fix: `tmp/class-trial-d1-all-speeches-score-1780556324868.md`; 9 speeches, 3 fallback, average 85. 苗木诚 was real DeepSeek speech, fallback false, score 86, and no longer reproduced the screenshot's neutral-observer `可观望疑点/不改变我这条结果` wording.
- [x] Latest verification passed: targeted seer black-check tests, related focused AI/claims tests (`src/game/claims.test.ts`, `src/ai/tableRead.test.ts`, `src/ai/speechProviders.test.ts`, `src/ai/classTrialPersonaDirector.test.ts`, `src/ai/classTrialSpeechDirector.test.ts`, `src/ai/classTrialCharacterLens.test.ts`) 6 files / 220 tests; `npx tsc --noEmit`; `git diff --check` with CRLF warnings only.
- [x] Latest first-person POV repair pass: true seer black-check planning now treats the check as the seer's own fixed result and vote, not a neutral table observation; checked-seat fallback answers the black check directly instead of drifting into unrelated character flavor.
- [x] Added regressions that reject D1 seer speeches diluted by `外置更硬信息/先别急着放过去`, repeated global `如果查杀位是好人谁收益`, post-black-check `验人心路/验人顺序`, report-only peaceful-night speeches, and second-person homework to already-spoken seats such as `需要你后续补上`.
- [x] Tightened class-trial claim extraction so `3号就是查杀位` and generic `这张牌拍在桌上` are treated as public references, not new self seer/witch claims.
- [x] Naturalized fallback gap wording by removing `平安夜药线/身份声明边界` phrases; fallbacks now say `平安夜只能当背景` or concrete public-action gaps.
- [x] Latest real D1 all-seat sample after this pass: `tmp/class-trial-d1-all-speeches-score-1780553043282.md`; 9 speeches, 2 fallback, average 79. It no longer shows the original global seer POV, first-check-reason attack, peaceful-night report-only as a complete speech, or no-trigger Fukawa/Togami drift. Remaining weakness is role texture/action depth for 雾切、塞蕾丝、高松 and fallback rate.
- [x] Latest verification passed: related focused tests (`src/game/claims.test.ts`, `src/ai/tableRead.test.ts`, `src/ai/speechProviders.test.ts`, `src/ai/classTrialPersonaDirector.test.ts`, `src/ai/classTrialSpeechDirector.test.ts`, `src/ai/classTrialCharacterLens.test.ts`) 6 files / 220 tests; `npx tsc --noEmit`; `git diff --check` with CRLF warnings only.
- [x] Latest class-trial D1 de-template/reasoning pass removed remaining visible audit-player wording from upstream LLM materials in `advancedReasoning`, `claimAudit`, `tableRead`, and `speechProviders`; prompt labels now use public table/action language instead of `审计/身份线/票口/闭合`-style internal terms.
- [x] Added stronger D1 black-check guards for non-seer/checked-seat `今晚验谁`, `闭合/闭环`, peaceful-night/witch-use as a main attack, and first-check motive variants such as `验人选择逻辑`, `怎么摸到`, and `补验人依据`.
- [x] Latest real D1 all-seat sample after this pass: `tmp/class-trial-d1-all-speeches-score-1780547769642.md`; 9 speeches, 1 fallback, average 85. The 8 real LLM speeches no longer used the old first-check-reason attack in the final sample; residual weakness is mainly role texture/action depth for 十神、高松、爱音.
- [x] Latest verification passed: focused related AI tests (`src/game/claims.test.ts`, `src/ai/tableRead.test.ts`, `src/ai/speechProviders.test.ts`, `src/ai/classTrialPersonaDirector.test.ts`, `src/ai/classTrialSpeechDirector.test.ts`, `src/ai/classTrialCharacterLens.test.ts`) 6 files / 215 tests; `npx tsc --noEmit`; `git diff --check` with CRLF warnings only.
- [x] Added `docs/tasks/2026-06-class-trial-freeform-speech-quality.md` for the class-trial freeform speech quality follow-up.
- [x] Reframed the class-trial speech target from "characters speak like skilled Werewolf players" to "characters stay themselves while participating in a Werewolf incident"; current priority is role authenticity, public table participation, de-templating, basic logic, then inference strength.
- [x] Updated class-trial director and speech-provider guidance so repeated pressure pivots into role actions such as hope checks, testimony cuts, trial taunts, despair/guise reads, wagers, qualification lines, voice breaks, and relationship chains instead of generic `收益/票型/结构` audits.
- [x] Added/updated regressions in `src/ai/classTrialPersonaDirector.test.ts`, `src/ai/classTrialCharacterLens.test.ts`, and `src/ai/speechProviders.test.ts` for the role-first class-trial contract and grammatical fallback wording.
- [x] Latest real D1 all-seat sample: `tmp/class-trial-d1-all-speeches-score-1780490992573.md` generated 9/9 speeches with 0 fallback and average 75 under the revised, stricter role-first scoring lens.
- [x] Root-caused the bad `首验理由/女巫用药` attack direction to public-state rules leaking into speech: natural wording like `查了3号腐川冬子——她是狼人` was not parsed into `claimBoard.checks`, which created `预言家声明缺少验人`; meanwhile `女巫用药` death-shape guidance could be treated as an attack target.
- [x] Updated `src/game/claims.ts` and `src/ai/speechProviders.ts` so characterful seer black-check wording is extracted as a public check, and D1 no-guard peaceful-night `女巫用药` is legal background reasoning but rejected as a main attack point.
- [x] Removed D1 `首验理由/选人理由/公开依据/连心路都省了` as a main attack axis and stopped prompting true seer black-check speeches to actively explain why they picked the first target.
- [x] Replaced class-trial seer hard-info requirements with explicit identity, checked target/result, today vote boundary, and external hard-role counterevidence boundary.
- [x] Updated hard-info fallback validation so fallback results are revalidated instead of carrying stale failed-output errors.
- [x] Updated class-trial lens fallback wording from `身份那句话少了前提` to less stitched identity-boundary wording and removed `没说清` fallback patterns that were misread as asking already-spoken seats to speak again.
- [x] Final real D1 all-seat sample for this pass: `tmp/class-trial-d1-all-speeches-score-1780498805293.md`; it no longer uses the old `首验理由/女巫用药` main-axis failure or `身份那句话少了前提`, but stricter rejection increased fallback to 4/9 and average fell to 78, so the next pass should focus on repair-generation quality.
- [x] Root-caused the reviewed D1 failures to hard-information speeches being treated like low-information openings: 苗木's seer black check could be clipped after the result, 腐川's checked-seat response could drift into 十神 flavor, and stale stock phrases such as `平安夜药线` could survive after an actual death.
- [x] Updated `src/ai/tableRead.ts` so true seer black-check plans require identity, explicit target/result, and a vote-boundary explanation without making first-check motive mandatory; checked seats now get a direct response plan before character flavor.
- [x] Updated `src/ai/speechProviders.ts` with dynamic class-trial hard-information speech limits, stricter black-check validation, checked-seat reply validation, prompt/meta leak rejection, non-peaceful death phrase rejection, and conservative Fukawa/Togami public-trigger gating.
- [x] Updated class-trial hard-information fallback lines so provider failures produce a direct useful black-check or checked-seat response instead of a generic low-information opener.
- [x] Added regressions in `src/ai/tableRead.test.ts` and `src/ai/speechProviders.test.ts` for seer black-check plans, checked-seat responses, dynamic hard-info limits, explicit `查杀` wording, prompt leak rejection, non-peaceful death wording, and Fukawa/Togami trigger boundaries.
- [x] Verification passed: focused AI speech/table-read tests, `npx tsc --noEmit`, `npm run lint`, task-card gate, harness check, and whitespace check.
- [x] Real LLM spot-check produced one nonfallback seer black-check speech with motive and vote boundary before explicit `查杀` validation was tightened; a later external provider call failed with `fetch failed`, and the new fallback produced an explicit useful black-check speech.
- [x] Follow-up de-template material pass removed class-trial internal audit wording from hard-info plans, repair instructions, fallback gap wording, table briefing labels, and post-speech challenge themes.
- [x] Latest real D1 all-seat sample after this pass: `tmp/class-trial-d1-all-speeches-score-1780505837274.md`; 9/9 real LLM speeches, 0 fallback, average 91, with no sample hits for `票口边界` / `外置硬身份反证` / `起跳收益` / `身份动作` / `公开边界` / `首验理由` / `验人理由`.
- [x] Reworked class-trial death-shape speech guidance so AI may infer witch potion state, knife targets, and poison targets from public death announcements plus board rules instead of being blocked by conclusion-level bans.
- [x] Removed the validation ban that rejected public-death lines like `女巫没救/没用药` or public knife/poison-mouth reasoning, while still blocking invented witch identity and non-public rescue-target leaks.
- [x] Updated table memory, table-read tasks, inference layers, role playbooks, advanced reasoning, and debate agenda prompts to require public evidence/reasoning source instead of templated prohibition wording.
- [x] Added red-green regressions proving day-one single-death potion/knife/poison-mouth public reasoning passes validation and prompt guidance no longer says `不能确认女巫用药` / `不能说成确定事实`.
- [x] Verification passed: targeted affected tests, `npx tsc --noEmit`, `npm run lint`, full `npm run test` (89 files / 851 tests), and `npm run build` with the existing Turbopack NFT trace warning.
- [x] Added `docs/superpowers/specs/2026-06-02-room-vote-and-class-trial-rules-design.md` and `docs/superpowers/plans/2026-06-02-room-vote-and-class-trial-rules.md`.
- [x] Added `src/server/roomAdvance.ts` and rewired public-room host continue so ordinary AI/system flow advances to the next human or public stop instead of one brittle step.
- [x] Hardened `scripts/room-action-smoke.mjs` with CLI `--base-url`, per-request timeout, and compact trace diagnostics.
- [x] Added `src/components/game/classTrialThemeFlow.ts` and rewired the class-trial table to show trial-step labels such as `证言审理`, `封票`, and `开票揭示` instead of ordinary phase labels as the main theme status.
- [x] Added `src/ai/classTrialPersonaDirector.ts` so low-information class-trial speakers can use role texture without forced追问、反驳、转票 or private/system leaks.
- [x] Focused verification passed: room advance/API tests 2 files / 23 tests; class-trial UI/model tests 4 files / 48 tests; class-trial AI director tests 3 files / 140 tests.
- [x] Type/lint/build verification passed: `npx tsc --noEmit`, `npm run lint`, and `npm run build` all exited 0; build still reports the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- [x] Local room vote smoke passed on `http://127.0.0.1:3000`: `coveredActionTypes` included `seerCheck`, `witchAction`, `speak`, and `vote`; `voteResolved` was `true`; final phase was `HUNTER_REVEAL`.
- [x] Local room SSE smoke passed on `http://127.0.0.1:3000` with lobby, join, and start events.
- [x] In-app browser verification confirmed class-trial main stage shows `闭庭整理` after hidden-night intro skip and `证言审理` during day speech; screenshot saved to `tmp/class-trial-room-vote-rules-visual.png`.
- [x] Final GitHub push is pending.
- [x] Completed the unified class-trial / global Werewolf architecture cleanup requested for AI template feel, phase confusion, vote presentation, and room projection impact.
- [x] Added shared `src/game/phaseSemantics.ts` and reused it from `src/game/projection.ts` and `src/server/roomService.ts`, removing duplicated public actor phase logic.
- [x] Added `src/game/voteSnapshot.ts` so public vote progress/reveal semantics are a reusable rule/projection model instead of inline projection helpers.
- [x] Added `src/components/game/classTrialVotePresentation.ts` and rewired `ClassTrialVoteStage` / `ClassTrialGameTable` to consume a single sealed/reveal presentation model.
- [x] Added `src/components/game/classTrialFlowModel.ts` and rewired `GameClient` intro, opening-night curtain, auto-advance, host audio, AI audio, and voice prewarm gating through it.
- [x] Added `src/components/game/classTrialTableModel.ts` so class-trial table focus, night state, host label, vote ring state, and active audio speaker ownership are computed outside JSX.
- [x] Added `src/ai/classTrialSpeechDirector.ts` and moved class-trial self-introduction, dialogue rewrite, low-info opening, final-speaker, and repeated-focus director guidance out of `speechProviders.ts`.
- [x] Added focused red-green tests for every extracted model and kept existing class-trial vote/table/speech tests passing.
- [x] Verification passed: targeted aggregate Vitest 12 files / 324 tests; room API test 1 file / 19 tests; `npx tsc --noEmit`; `npm run lint`; `npm run build`.
- [x] Local HTTP/API smoke passed on `http://127.0.0.1:3000`: `/` returned 200, `/api/games/boards` returned 200, and a 9p class-trial game was created with `phaseSteps` and `tableSummary.voteSnapshot`.
- [x] Room SSE smoke passed with `ROOM_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:room-sse`.
- [x] `npm run smoke:room-action:vote` was investigated but not completed: default port mismatch caused the first fetch failure; after pointing to 3000 and also trying a mock 3003 production server, it timed out in the existing room AI night-advance path after `NIGHT_WOLVES -> NIGHT_SEER`.
- [x] Core harness files remain present and validated by `npm run harness:check`.
- [x] `学级裁判主题局` remains local-only and is not exposed from `/rooms` or Public Alpha.
- [x] Added class-trial vote burst overlay for sealed vote start and revealed vote result states.
- [x] Added no-exile vote verdict handling so tied/no-target reveals show `未达成处刑` without focusing a seat.
- [x] Added CSS-only red/black slash burst, scanline/pulse pressure, and locked-seat stamp effects with reduced-motion fallback.
- [x] Browser verification on `http://127.0.0.1:51631` confirmed sealed progress stays readable and does not expose vote targets, unique reveal focuses seat 6, and no-exile reveal keeps focus count 0.
- [x] Added `docs/tasks/2026-05-class-trial-vote-visualization.md` and `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md` for the local-only vote visualization slice.
- [x] `DAY_VOTE` public projection now exposes only eligible, locked, and pending seat ids; it still hides vote targets, tally, leaders, and vote reasons until resolution.
- [x] Added `ClassTrialVoteStage` for sealed vote progress (`封票中`, locked/pending seat rail, meter) and one-shot reveal (`开票揭示`, tally rows, voter ledger, focus seat).
- [x] Wired the class-trial table to show per-seat `已锁票` / `等待中` chips during vote and focus the leading seat during reveal, without touching ordinary non-theme vote UI.
- [x] Updated class-trial phase copy so vote phase says targets stay sealed and exile resolution reads as one-shot opening.
- [x] Browser verification on `http://127.0.0.1:51631` confirmed sealed progress with `3 / 9`, per-seat `已锁票/等待中`, no arrows/targets, and the one-shot `开票揭示` tally/ledger reveal.
- [x] Added `docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md` for the private-memory-to-public-speech boundary task.
- [x] Root-caused the reported `我暂时更信5号` line to `buildMemorySpeechPoint()` converting `memory.trustedSeatId` directly into a public talking point.
- [x] Added a red-green regression where a class-trial speaker privately trusts an unevidenced unspoken back seat; the test first failed on `我暂时更信5号` and now passes.
- [x] Added `buildPublicTrustSpeechPoint()` so private trust is only spoken when it can be translated into public evidence such as a public check, claim, support stance, prior speech, public mention, or vote record.
- [x] Added a positive regression proving a trusted seat with visible public speech can still be referenced as public evidence rather than suppressed or rendered as raw private trust.
- [x] Focused verification passed: `npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts` and `npm run test -- src/game/engine.test.ts -t "memory"`.
- [x] Type/build confidence passed: `npx tsc --noEmit`, targeted `npx eslint src/ai/tableRead.ts src/ai/tableRead.test.ts`, and `npm run build`.
- [x] Fixed full lint by adding `tmp/**` to `eslint.config.mjs` global ignores; `npm run lint` now passes instead of scanning existing `tmp/chrome-class-trial-smoke` Chrome extension cache files.
- [x] Added `docs/tasks/2026-05-speech-de-template-persona-layer.md` for the follow-up speech-personality slice.
- [x] Added a universal de-template guide to ordinary and class-trial speech input, steering speakers away from repeated `我先按公开信息盘 / 这个疑点未解除 / 票口先放这里` chains and toward identity-benefit, vote-motive, reaction-gap, death-shape, follow-pressure, or verifiable-condition moves.
- [x] Added ordinary Werewolf validation for obvious empty-template chains while preserving concrete pressure, bluffing, and later-seat verification conditions.
- [x] Red-green regression for `通用去模板` guidance and ordinary template-chain rejection first failed, then passed after the shared guidance/validation layer.
- [x] Focused speech/table-read verification passed after narrowing the ordinary validator to avoid false positives around legitimate `等后置位发言看有没有人接线` wording.
- [x] Added `docs/tasks/2026-05-class-trial-role-pressure-addressing.md` for the follow-up role-pressure and public-addressing slice.
- [x] Added name-aware public reference guidance so class-trial and ordinary speakers prefer seat plus name or short name, while keeping seat numbers for checks, votes, and target clarity.
- [x] Expanded the class-trial repeated-focus director to catch abstract loops around `缺口 / 没往下推 / 没给倾向 / 没给结论`, then ask the current role to change pressure method instead of repeating the same accusation.
- [x] Strengthened 江之岛盾子 as `超高校级的分析师`: structural table analysis and reaction-pattern reading first, theatrical pressure second.
- [x] Strengthened 腐川冬子 around 十神白夜: she reacts strongly to who touches, protects, ignores, or pressures 十神, while still translating that obsession into public table reasons.
- [x] Focused role-pressure tests passed: `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` passed 2 files / 106 tests.
- [x] Real Day 1 text sample `tmp/class-trial-day1-real-role-pressure-addressing-1780156628228.md` generated 9/9 DeepSeek speeches with fallback 0/9, templateHits 0, repeated pressure terms 3, and nameRefs 10.
- [x] Follow-up sample review found the first three low-information class-trial speeches were still too template-like: 苗木 only greeted/restated平安夜, 雾切 waited for all later seats, 腐川 lacked 十神 emotion, and 江之岛 lacked analyst structure.
- [x] Added a per-role `低信息开局动作` to all 9 class-trial character lenses so low-information openings have a character action instead of a generic Werewolf audit frame.
- [x] Added class-trial opening director guidance for low-information Day 1: 苗木 must leave a共同验证点, 腐川 must show 十神大人 as a public emotion coordinate, and 江之岛 must lead with analysis/structure/benefit/reaction-pattern before spectacle.
- [x] Added validation against generic class-trial opening frames such as `发言顺序、站边、票型一起校验`, greeting-only平安夜 restatement, waiting for all later seats to finish, final speakers waiting for后置位, 腐川 missing 十神, and 江之岛 missing analyst structure.
- [x] Follow-up red-green verification passed: `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` passed 2 files / 114 tests.
- [x] Fresh real Day 1 sample after the follow-up now runs: `tmp/class-trial-day1-verification-1780195573037.md` generated 9/9 DeepSeek speeches, fallback 3/9 through role-specific class-trial fallback, templateHits 0, repeatedPressureTerms 4, nameRefs 11, Enoshima analyst signals 1, and Fukawa Togami refs 1.
- [x] Root-caused the remaining 腐川/江之岛 low-info drift to day-one hard-info detection treating generic future wording like `投票时形成闭环` as hard information because it matched bare `投`.
- [x] Narrowed day-one hard-info detection in `tableRead` and `speechProviders` so future voting review language stays low-info, while concrete `票口/归票/出人/投X号` still closes the low-info layer.
- [x] Added role-specific class-trial low-info fallback so rejected DeepSeek openings no longer pressure unspoken seats and still preserve 苗木共同验证点、雾切冷静切片、腐川十神坐标、江之岛结构/收益/伪装 signal.
- [x] Browser/game QA on `http://127.0.0.1:3005` completed a full Day 1 class-trial run: 9/9 speeches reached `DAY_VOTE`, transcript saved to `tmp/class-trial-browser-qa-1780197058323.md`, screenshot saved to `tmp/class-trial-browser-qa-3005-current.png`.
- [x] Browser QA finding: role/persona feel is better, but the live run still over-circled `1号没给倾向/缺口`; GPT-SoVITS was unavailable at `127.0.0.1:9880`, so this pass verified text/UI timing but not audible quality.
- [x] Follow-up fix after browser QA: 苗木 low-info fallback now carries a stronger `希望/共同验证` character beat, and repeated empty-stance/empty-gap director guidance now explicitly says the speaker cannot keep the same `没给倾向/缺口` line as the main axis.
- [x] Follow-up focused tests passed: `npm run test -- src/ai/speechProviders.test.ts -t "hardens the class-trial director note|class-trial low-info first-speaker fallback"` and `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts` passed 3 files / 142 tests.
- [x] Follow-up dialogue-persona pass added class-trial台词化转译 guidance so `站边/票口/闭环/缺口` stay as internal structure and spoken lines become role-flavored裁判场台词.
- [x] Added class-trial terminology-overload validation, low-info room-greeting rejection, and a guard against treating the system speech order as a wolf-team puzzle.
- [x] Added a broad Fukawa role-texture guard and updated Fukawa fallback moves so validation fallback still references 十神 and normalizes audit wording like `提到身份相关词` into natural speech.
- [x] Fresh real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780198915715.md` generated 9/9 speeches with fallback 2/9, templateHits 0, repeatedPressureTerms 0, nameRefs 8, Enoshima analyst signals 2, and Fukawa Togami refs 1.
- [x] Latest focused AI tests passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts` passed 3 files / 150 tests.
- [x] Follow-up verification pass generated multiple real Day 1 samples and tightened residual class-trial template variants: non-Celestia `筹码` spread, `后置位整体/发言顺序校验`, `下一位/后面几位/等第一轮走完` workflow talk, `等后置位谁先动再回头看`, and negative `没有票口` incorrectly closing the low-info layer.
- [x] Narrowed day-one hard-info detection again so negative no-ticket/no-stance wording such as `还没有任何人给出站边或票口` does not disable low-info role guards.
- [x] Added repeated-motif guidance for `框架滑移/话滑空转` and `平安夜催票复读`, and changed 苗木 low-info fallback away from the easily copied `借平安夜催票` phrase.
- [x] Tightened 江之岛 low-info validation so `裂口/谁最受益` alone is not enough; she must show analysis, structure, reaction-pattern, benefit-path, or disguise signal.
- [x] Fresh real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780200902521.md` generated 9/9 speeches with fallback 1/9, templateHits 0, repeatedPressureTerms 1, nameRefs 7, Enoshima analyst signals 2, and Fukawa Togami refs 1; the final residual `等第一轮走完后` variant is now covered by a targeted regression after that sample.
- [x] Latest focused AI tests passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts` passed 3 files / 161 tests.
- [x] Latest verification follow-up added targeted regressions for lingering class-trial workflow/omniscience leaks: `下一位先听你的`, `等所有人发完言后`, `后置位的各位等你们发言时`, `等后面有人拍身份再调整`, unpublicized `验人线`, and false role-claim attribution like `4号和5号自称猎人`.
- [x] Latest focused AI tests passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts` passed 3 files / 171 tests.
- [x] Latest real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780213850241.md` generated 9/9 speeches with fallback 0/9, templateHits 0, repeatedPressureTerms 4, nameRefs 9, Enoshima analyst signals 1, and Fukawa Togami refs 1; the final observed `后置位的各位，等你们发言时` variant is now covered by a targeted regression.
- [x] Seat 8 in the fixed class-trial roster is now `tomori` / `高松灯`; the active 9-seat order is 苗木诚、雾切响子、腐川冬子、黑白熊、江之岛盾子、塞蕾丝缇雅、十神白夜、高松灯、千早爱音.
- [x] Ignored local `local-assets/class-trial-pack/manifest.json` and `personas.json` use 高松灯 instead of 叶隐康比吕.
- [x] Ignored local 高松灯 avatar and portrait PNG files exist and remain untracked.
- [x] `ClassTrialGameTable` renders left portrait plus right large dialogue box, weakens the background ring, and keeps the active speaker seat identifiable.
- [x] Dialogue uses a hybrid typewriter helper with SSR/reduced-motion plain-text fallback.
- [x] Browser smoke confirmed local pack readiness, Tomori seat 8, left portrait/right dialogue layout, synced speaker labels, no hidden role label in the dialogue text, and no class-trial theme entry on `/rooms`.
- [x] Screenshot saved as ignored local evidence: `tmp/class-trial-ui-polish-tomori-smoke.png`.
- [x] Added per-character portrait layout metadata; 千早爱音 was later tuned larger/higher after its transparent portrait replacement.
- [x] The speaking portrait image now receives CSS variables for scale and x/y offset.
- [x] The portrait frame now uses stable responsive dimensions and bottom-centered containment so mixed source canvases do not resize the dialogue layout.
- [x] Browser smoke at `http://localhost:51625` sampled 雾切响子、江之岛盾子、苗木诚 and 高松灯 in the fixed portrait frame.
- [x] Follow-up headroom pass adjusted non-baseline portrait scale/y values and frame height; browser smoke confirmed 腐川冬子 and 塞蕾丝缇雅 no longer touch the top border.
- [x] Follow-up 高松灯 pass replaced the unsuitable square/card-style portrait with a local ignored full-body standing portrait from `Mygo_anime_tomori.png`, cropped excess transparent side padding, and browser-confirmed the accepted final look.
- [x] Follow-up recording-cleanliness pass split action-seat highlighting from speaking focus; portrait/dialogue now appear only when `currentSpeakerSeatId` is active.
- [x] Follow-up background clarity pass keeps the ring clear in non-speaking phases and only blurs/weakens it while a speaking focus is visible.
- [x] Follow-up speech staging pass adds active-seat callout, portrait/dialogue enter animation, short exit fade, and reduced-motion fallbacks.
- [x] Follow-up 千早爱音 pass replaced the unsuitable scene/card portrait with a transparent standing portrait and tuned its layout larger/higher to match 高松灯 more closely.
- [x] Follow-up class-trial background pass switches active themed games away from the default werewolf table background to a dark red/black class-trial court stage with gold guide lines.
- [x] Cleared stale `.next` generated cache after a dev-server write corrupted `.next/dev/types/routes.d.ts`; fresh `tsc` and build passed after regeneration.
- [x] Added local-only class-trial phase scene mapping for dawn announcement, voting, exile/last-word resolution, and final settlement.
- [x] Added a `class-trial` `PhaseCurtain` presentation with a 3000ms full-screen scene, verdict/result lines, and reduced-motion fallbacks.
- [x] Wired class-trial games through `getThemedPhaseCurtainCue` while ordinary games keep the existing default curtain model.
- [x] API mock/local full-game smoke reached `GAME_OVER` with the fixed 9-character roster and mock AI, without LLM or TTS.
- [x] Browser smoke showed the class-trial full-screen phase scene on the local theme flow.
- [x] Follow-up flow pass removed full-screen scenes from hidden night actions: 狼人行动、预言家查验、女巫行动 stay on the table view.
- [x] Follow-up vote pass shows both `票型汇总` and `逐票` lines during vote resolution / exile verdict scenes.
- [x] Generated a local-only red/black court background with image generation and saved it as ignored private data at `local-assets/class-trial-pack/backgrounds/court-main.png`.
- [x] Added optional `backgrounds.courtMain` support to the local class-trial manifest model while keeping older manifests valid.
- [x] Wired `ClassTrialGameTable` to use the local court background when present and keep CSS fallback behavior when absent.
- [x] Dead class-trial seats now show a persistent `已退场` marker without revealing identity, camp, or death reason during the live game.
- [x] Added `ClassTrialVerdictReview` for automatic terminal theme review using existing `GameReview` data.
- [x] `GAME_OVER` class-trial games now switch directly into the verdict review surface.
- [x] Class-trial AI speech requests now carry `roleCard` from browser cue to `/api/ai-speech-audio`.
- [x] Added GPT-SoVITS transport helper for `/set_gpt_weights`, `/set_sovits_weights`, and `POST /tts`.
- [x] Added 9-role local GPT-SoVITS profile resolver, including black-white bear `hei_bai_xiong_clean_denoised` and Anon `logs/AI_voice_1`.
- [x] Added Chinese-visible / Japanese-TTS rewrite helper using routed LLM JSON output.
- [x] `/api/ai-speech-audio` now tries class-trial GPT-SoVITS first and falls back to the existing Mimo/no-audio path.
- [x] Direct route smoke returned `provider: gpt-sovits` with a `.wav` URL for 高松灯; browser smoke played two class-trial AI speakers and advanced normally.
- [x] Added `getClassTrialDialogueFrameByProgress` so class-trial dialogue can map valid audio progress to character/segment frames while invalid progress falls back to the existing timer.
- [x] Added AI speech playback sync helpers for `currentTime / duration`, active-run status patching, and loading-state status construction.
- [x] Extended `AiSpeechAudioStatus` and added `ClassTrialAudioTypewriterState` for table-facing audio typewriter state.
- [x] `ClassTrialGameTable` now consumes live AI speech, locks the dialogue on full `正在思考/准备发言。` while GPT-SoVITS audio is generating, and lets active audio speaker state temporarily own the speaking focus after the game advances to the next speaker.
- [x] `GameClient` now publishes real playback progress from `HTMLAudioElement` events / `requestAnimationFrame`, passes audio typewriter state into the class-trial table, and publishes streaming TTS loading state as soon as a chunk is queued.
- [x] Added class-trial audio preparation stages: `正在调取证言。`, `正在生成语音。`, and `准备播放。`.
- [x] Added a small `speechKey -> HTMLAudioElement promise` preparation cache so a cue that starts loading before playback reuses the same audio promise.
- [x] `GameClient` now starts preparing the next class-trial AI speech audio before the delayed playback handoff and reuses that prepared promise when playback begins.
- [x] `GameClient` now starts one background class-trial `continue` after current speech audio playback begins; if that only reaches the next waiting speaker, it continues once more in the background to generate the next speech before prewarming audio.
- [x] Added a non-streaming `submitContinueCommand` helper for background lookahead without changing the existing streamed visible continue path.
- [x] `switchGptSoVitsWeights` now tracks active GPT and SoVITS weight paths by normalized GPT-SoVITS base URL and skips repeated active weights.
- [x] Class-trial GPT-SoVITS route now logs sanitized timing JSON for rewrite, weight switch, TTS, file write, cache hit, skipped switch flags, and total request time.
- [x] Class-trial Japanese TTS rewrite now has metadata modes: `fast`, `cache`, and `llm`.
- [x] Safe high-frequency short lines can use local rewrite templates for explanation requests, vote declarations, suspicion statements, and contradiction statements.
- [x] Class-trial GPT-SoVITS timing logs now include `rewriteMode`, so latency attribution can distinguish fast path, cache, and LLM rewrite.
- [x] Class-trial themed games now resolve to real `llm` runtime even when the stored global AI runtime mode is `mock`.
- [x] Selecting the class-trial theme also stores `llm` as the local AI runtime mode for consistency with `/ai-pool`.
- [x] The class-trial home card and themed table now show `真实 LLM · DeepSeek-v4` status.
- [x] Visible class-trial continue requests and background audio-lookahead continue requests now use the effective runtime mode.
- [x] Fixed class-trial characters now keep their role cards and display names while using DeepSeek as the single base game brain.
- [x] Class-trial action repair attempts retry DeepSeek instead of switching to GPT/Claude/GLM fallback personas.
- [x] Class-trial speech repair attempts retry DeepSeek instead of switching to GPT/Claude/GLM fallback personas.
- [x] Browser/live smoke confirmed the class-trial home card shows `真实 LLM · DeepSeek-v4 主脑`; observed `AiCallLog` action repair providers stayed on `deepseek-action:deepseek-v4-flash` only and observed speech repair providers stayed on `deepseek-speech:deepseek-v4-flash` only.
- [x] Root-caused DeepSeek empty outputs to completion-token exhaustion: small budgets returned `finish_reason: "length"` with all completion tokens spent as `reasoning_tokens` and empty `message.content`.
- [x] A/B probe found `thinking: disabled` is faster and more reliable for real class-trial DeepSeek action/speech prompts than raising token floors.
- [x] DeepSeek action and speech now default to `thinking: disabled` with a normal 900 token floor while leaving non-DeepSeek routes unchanged.
- [x] Real routed DeepSeek probe returned non-empty JSON text for both action and speech using the old lower caller budgets.
- [x] GPT-SoVITS switch-and-synthesize work is now serialized so overlapping class-trial chunk requests cannot race the service's global active weights.
- [x] Class-trial streaming TTS can defer chunk audio loading until playback reaches each chunk, with one next chunk warmed after the current chunk is ready.
- [x] Root-caused 苗木诚 mid-speech waits to per-chunk Japanese voice rewrite latency after GPT-SoVITS weight prewarm had already removed repeated switch time.
- [x] Class-trial visible continues now keep live text streaming but wait for the final speech before generating one whole-speech GPT-SoVITS audio chunk, removing per-chunk mid-speech gaps.
- [x] Non-class-trial streaming TTS keeps the existing stable chunk behavior.
- [x] Class-trial role-card speech guidance now explicitly prioritizes character-like裁判场辩论 over generic Werewolf templates while preserving public-information boundaries.
- [x] Class-trial unplayed TTS failures now fall back to a timed visible text playback instead of marking the speech complete immediately.
- [x] Class-trial transient TTS 503/unavailable errors no longer flip the global AI speech unavailable switch.
- [x] Long class-trial dialogue now splits into compact cumulative segments, including punctuation-light lines, so the typewriter does not dump a large block at once.
- [x] Class-trial speech contracts now use a tuned 3-sentence / 260-char bound, add named character performance cues, and reject repeated generic table templates like `我换一个角度`.
- [x] Class-trial Japanese rewrite now receives richer role-card fields from `/api/ai-speech-audio`; 千早爱音 rewrite explicitly limits filler words to rare, well-placed beats.
- [x] `GameClient` now starts an invisible class-trial voice prewarm request for the current AI speaker while the table is waiting on `continue`.
- [x] Direct route smoke with Tomori and Kirigiri role cards returned `provider: gpt-sovits` wav URLs; timing logs completed at about 2.5s and 5.1s total in serialized order.
- [x] Live regression traced the remaining first-speaker wait to whole-speech Japanese rewrite, not GPT-SoVITS weight switching: 苗木诚 initially took about 76.3s with `rewriteMode:"llm"` and `rewriteMs:63779`.
- [x] Added deterministic `rewriteMode:"local"` for complex class-trial public-logic speeches before slower LLM rewrite; the same 苗木诚 text then took about 6.3s with `rewriteMs:0`.
- [x] Relaxed over-strict class-trial validation after good DeepSeek persona lines were rejected into fallback; later live speakers 十神白夜、高松灯、千早爱音 generated non-fallback character-directed speech.
- [x] Class-trial loose fallback is now role-specific, so a rejected 江之岛盾子 or 塞蕾丝缇雅 speech no longer falls back to old generic Werewolf phrases.
- [x] Added a reusable class-trial character lens layer for the fixed 9-character roster.
- [x] White-day class-trial speech input now carries attention, pressure, cadence, vote-rationale, and forbidden-template signals.
- [x] Day-vote action input now carries vote-rationale lens guidance while private night actions remain unaffected.
- [x] Class-trial character lens is now soft LLM director guidance, not a required-keyword validator.
- [x] Obvious class-trial generic templates remain covered by the baseline style guard, while DeepSeek can freeplay without lens keyword matching.
- [x] Class-trial fallback speech uses the same role lens only when bottom-line validation still fails.
- [x] Class-trial speech repair now preserves LLM freeplay and only fixes the validation issue, instead of converting good character speech into fallback-style template lines.
- [x] Class-trial speech guidance now includes a soft anti-repeat cue: if earlier seats are circling the same abstract criticism, the next speaker should enter from a concrete fact, identity line, reaction gap, vote incentive, or death shape.
- [x] Class-trial character lens now includes role-specific "same material, different推进动作" examples, so DeepSeek sees how different roles should transform the same table material without copying fixed scripts.
- [x] Class-trial speech input now adds a dynamic director note when recent seats repeatedly circle `没给结论/验证方向`, `镜像攻击`, or `平安夜复读`; the note asks the next role to switch lenses instead of swapping seat numbers on the same criticism.
- [x] Follow-up live text sample on production preview game `64183909-65b9-44f2-9c35-4a3b89692904` showed better role separation and fewer fallbacks than the previous full sample, but exposed repeated `没给站边/票口` pressure.
- [x] Follow-up production-preview sample game `309698cb-5ffc-40d6-af6d-c349b849fbd2` showed 9 Day 1 text speeches in about 64s, with characters shifting more naturally from 1号 to 3号/2号 pressure; it exposed another repeated `干净模板/后置责任` motif.
- [x] Dynamic director detection now covers `没给站边/票口`, `干净模板/后置责任`, `没给结论/验证方向`, `镜像攻击`, and `平安夜复读`.
- [x] Full Day 1 live/API sample game `60f17301-15c4-41a9-a134-7c2adba47c92` generated all 9 class-trial Day 1 speeches as non-fallback DeepSeek outputs.
- [x] Short anti-repeat smoke game `ca0d5a71-261c-4d47-87b1-877c7336a77a` confirmed the new prompt path; 2 later fallbacks were caused by transient DeepSeek `fetch failed` provider errors, not character-lens validation.
- [x] Follow-up audio/typewriter pass tightened long-speech reveal frames to 4 display chars, capped audio progress by readable wall-clock progress, kept the typewriter ticking during ended-audio tail time, and added a brief full-text hold before speaker handoff.
- [x] Follow-up browser QA on `http://127.0.0.1:51629` with AI speech enabled confirmed game `bb78bcca-e25b-4ea5-a1a5-363bb2f3846b` displayed the complete normalized 69-char 苗木诚 first speech before switching to 雾切响子.
- [x] Root-caused the no-sound report to generated `/audio/ai-speech/*.wav` URLs returning 404 under `next start`, even though files existed under `public/audio/ai-speech`.
- [x] Added a dynamic `audio/ai-speech/[fileName]` route to stream generated mp3/wav cache files with browser-playable content types.
- [x] Restarted `next start -p 51629`; the latest generated wav URL now returns 200 with `Content-Type: audio/wav`.
- [x] Added per-character `thinkingPortraitUrl` and `hasThinkingPortrait` support to the local class-trial manifest model; complete pack validation now requires avatar, speaking portrait, and thinking portrait.
- [x] Generated 9 local ignored transparent thinking-pose PNG assets under `local-assets/class-trial-pack/thinking-portraits`.
- [x] Updated ignored `local-assets/class-trial-pack/manifest.json` to reference all 9 thinking portraits.
- [x] `ClassTrialGameTable` now shows a dedicated thinking portrait while class-trial voice/text preparation is loading or waiting, then returns to the normal speaking portrait for spoken playback.
- [x] Every class-trial podium now displays a visible `1号` through `9号` seat number badge.
- [x] Class-trial host/system cue keys are namespaced as `class-trial:*` while reusing the existing Werewolf broadcast clips.
- [x] Monokuma Japanese TTS rewrite now preserves the short laugh texture (`噗/噗噗` -> `うぷぷ`) instead of dropping it.
- [x] Class-trial Day 2+ speech guidance and validation now reject repeat self-introductions like `我是雾切响子`.
- [x] Class-trial lens fallback no longer starts with `我是...`, reducing repeated self-introduction in later-day fallback paths.
- [x] Follow-up self-introduction pass now limits class-trial character-name introductions to first-day morning only; Day 2+ guidance says the first-day introduction window has ended, and the old generic “可以按座位名报自己是谁” prompt was removed.
- [x] Follow-up template pass rejects generic Werewolf openings like `我先说身份 / 我是闭眼好人 / 信息不多先听后置`, and asks each role to change the推进动作 instead of swapping seat numbers into the same sentence structure.
- [x] Follow-up last-words pass removes `我是角色名` fixed openings from class-trial last-word candidates while preserving 江之岛愤怒/绝望 and 雾切无奈/理性分析.
- [x] Ignored local 黑白熊 persona wording no longer says “仍像狼人杀玩家发言”; it now anchors him to public evidence and vote pressure.
- [x] Class-trial last words now prefer role-specific emotional/public-safe statements; 江之岛盾子 is angry/dramatic, 雾切响子 is resigned but rational.
- [x] Follow-up contract pass now places Day 2+ no-self-introduction and anti-`身份-信息-站边-票口` / `我是闭眼好人` bans directly in `speechContract.mustNotAsk`.
- [x] Follow-up lens audit confirmed all 9 fixed class-trial roles receive distinct behavior-lens cadence and推进动作 guidance instead of one shared Werewolf template.
- [x] Follow-up fallback pass stops Day 2+ class-trial fallback speech from opening with a display-name beat like `雾切响子。`, while preserving role-specific emotion/logic.
- [x] Chrome headless browser smoke on `http://localhost:51625` confirmed ready local pack/personas, 9 seat numbers, 9 local avatars, and a live Day 1 speech-preparation DOM state using `/class-trial-pack/thinking-portraits/%E8%8B%97%E6%9C%A8%E8%AF%9A.png` with `data-portrait-state="thinking"`.
- [x] Follow-up DeepSeek persona pass added per-character `狼人杀打法卡` strategy to the class-trial lens, so speech/action inputs now carry read priority, pressure method, vote/action logic, camp-specific play, night action tendency, and last-words mode.
- [x] Class-trial action inputs now receive the strategy lens for all class-trial phases, including private night actions, instead of only Day Vote.
- [x] Class-trial speech validation now makes generic no-stance/no-ticket/evidence-gap or low-info report lines retry on DeepSeek when they lack the current character's lens signal; abnormal repeated question-mark placeholders are also rejected.

### What's In Progress

- [ ] None for this slice.

### What's Next

1. Subjectively review the vote screen in a longer live class-trial run and decide whether the sealed-progress panel needs stronger motion or sound cues.
2. If mobile class-trial voting becomes important, add a dedicated mobile layout check; this slice focused desktop/local table verification.
3. The previous voice/persona listening pass remains a separate quality follow-up and is not part of this vote-visualization slice.

## Blockers / Risks

- [ ] `local-assets/class-trial-pack` is intentionally ignored local data and must not be staged or committed.
- [ ] Existing local portraits/avatars are copyright/reference assets for private testing only; do not publish them in Public Alpha.
- [ ] GPT-SoVITS routing is local-only and depends on private paths under `D:\AI\GPT-SoVITS`.
- [ ] Browser screenshot capture timed out during this slice; DOM/manual smoke and generated wav cache evidence passed.
- [ ] Mimo fallback is covered by automated route tests; the live local environment currently lacks a Mimo key, so a live GPT-failure fallback would degrade to existing no-audio behavior.
- [ ] Browser automation confirmed complete visible first-speech text and generated audio URL availability after the readable-sync/no-sound follow-ups, but it still cannot judge audio quality by ear; automated tests cover progress mapping, readable wall-clock cap, active-run guard, audio-speaker focus handoff, invalid-duration fallback, and generated audio cache route safety.
- [ ] Browser smoke confirmed the new preparation text and generated fresh wav files, but screenshot capture timed out and the automated poll still did not reliably catch a clean partial audio-progress reveal frame.
- [ ] Audio lookahead hides wait only when the current playback window is long enough for the next continue step and next GPT-SoVITS generation.
- [ ] Background continue intentionally mutates server state before the UI advances; duplicate prevention is handled by class-trial control disabling, a buffered-key guard, and active audio-run matching.
- [ ] GPT-SoVITS active-weight cache resets on server restart and can be stale if another external client changes weights outside this app.
- [ ] Live route smoke generated GPT-SoVITS wavs, but dev-server terminal logs were not available in this Codex thread; automated tests cover the timing payload and skipped-switch flags.
- [ ] Real timing samples show rewrite is now the dominant latency source, so further weight-switch work alone will not fix the visible wait.
- [ ] Rewrite fast path intentionally covers only narrow public-speech patterns; complex lines still use slower LLM rewrite.
- [ ] Rewrite cache is process-local and resets on server restart.
- [ ] User pasted provider keys during this slice; do not commit or document the key values. Use local private configuration only if provider config must be refreshed.
- [ ] Class-trial LLM mode can make every non-human continue slower than mock mode; this is intentional for quality but should be obvious in UI.
- [ ] DeepSeek-only class-trial routing removes GPT/Claude/GLM recovery for malformed JSON. Bad DeepSeek outputs now surface as same-model retries or eventual local fallback action/speech.
- [ ] Disabling DeepSeek thinking may reduce some deep deliberation, but current class-trial action/speech prompts benefit more from fast structured JSON and fewer empty attempts.
- [ ] The latest narrow real loop still had 1 retry, caused by speech-contract validation, not empty provider output.
- [ ] Voice prewarm shifts cold-start cost earlier; it cannot remove GPT-SoVITS synthesis cost entirely.
- [ ] Deferred chunk loading protects the local TTS backend from request bursts, but very long speeches can still pause between chunks if synthesis is slower than playback.
- [ ] Browser automation was not available in this thread after the prewarm edit; direct route smoke and focused tests passed, but a longer subjective browser listening pass remains useful.
- [ ] Browser automation was not exposed in this turn and local Playwright was not installed; API/log regression and local app health checks were captured for the latest no-skip/typewriter/persona slice.
- [ ] This vote visualization slice is local-only class-trial UI/projection work; it intentionally did not touch `/rooms`, Public Alpha, or non-theme vote rendering.
- [ ] The dev server used for browser verification is running on `http://127.0.0.1:51631` because port 3000 was occupied by another local app.
- [ ] Deterministic local Japanese rewrite removes a major wait but may sound less semantically rich than LLM translation; keep a human listening pass before treating voice quality as final.
- [ ] One live speaker still hit fallback before the role-specific fallback patch; automated tests protect the new fallback, but a fresh full live run would confirm it subjectively.
- [ ] Subjective character feel still needs a longer Day 1 listening pass; tests prove the lens reaches prompts and validation, not that every live line will feel perfect.
- [ ] The latest soft anti-repeat and dynamic director prompts reduce prompt-side repetition risk, but real DeepSeek speeches can still converge on similar themes without a longer browser/listening pass.
- [ ] Production-preview text sample `309698cb-5ffc-40d6-af6d-c349b849fbd2` still had 1 fallback at 高松灯 after a validation retry; visible role-specific fallback was acceptable, but a full audio pass should judge whether this feels abrupt.
- [ ] Short anti-repeat smoke hit transient DeepSeek `fetch failed` provider errors for later speakers; those fallbacks were provider/network failures, not lens validation failures.
- [ ] The new scenes are visual/UI flow polish only; no game rules or AI decision logic changed.
- [ ] `npm run build` passes but still reports the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [ ] Exact portrait layout values may need subjective tuning after a full recording review, but 高松灯 and 千早爱音's current replacement portraits are accepted enough for this slice.
- [ ] The generated court background is private local material and must not be published with Public Alpha.

## Decisions Made

- Keep Class Trial as a local-only theme mode and do not expose it in rooms or Public Alpha.
- Keep existing狼人杀 rules unchanged; role cards remain soft behavior/style guidance only.
- Use `tomori` as the stable local id for 高松灯 so future voice profiles and role-card routing do not inherit old Hagakure semantics.
- SSR and reduced-motion environments render full plain text; the browser enables thinking/typewriter animation only when motion is available.
- Use the existing `PhaseCurtain` entry point for class-trial phase scenes so non-theme games keep their original phase transitions.
- Use one generated main court background plus code overlays instead of separate per-phase background images.
- Death markers on live seats show only `已退场`; identity and death reason stay hidden until terminal review.
- Terminal class-trial review uses existing `GameReview` rather than adding new rule-engine data.

## Files Modified This Session

- `src/components/game/ClassTrialVoteStage.tsx` - adds reveal verdict metadata and the class-trial vote burst overlay.
- `src/components/game/classTrialVoteStage.test.ts` - protects sealed privacy, overlay hooks, exile reveal, and no-exile reveal.
- `src/components/game/classTrialGameTable.test.ts` - protects no-exile reveal from focusing a seat.
- `src/app/globals.css` - adds scanline/pulse pressure, red-black burst overlays, locked stamp, keyframes, and reduced-motion fallback.
- `docs/superpowers/plans/2026-05-31-class-trial-vote-burst-animation.md` - implementation plan for this slice.
- `docs/tasks/2026-05-class-trial-vote-burst-animation.md` - task card and verification record for this slice.
- `src/game/types.ts` - adds hidden vote progress fields to `PublicVoteSnapshot`.
- `src/game/projection.ts` - exposes sealed eligible/locked/pending vote progress during `DAY_VOTE` without vote targets.
- `src/game/engine.test.ts` - protects hidden vote projection before resolution.
- `src/components/game/ClassTrialVoteStage.tsx` - new class-trial sealed-progress and one-shot reveal presenter.
- `src/components/game/classTrialVoteStage.test.ts` - presenter coverage for sealed and revealed states.
- `src/components/game/ClassTrialGameTable.tsx` - wires vote stage, seat locked/waiting chips, reveal focus, and table classes.
- `src/components/game/classTrialGameTable.test.ts` - protects sealed vote table markup, reveal markup, and non-vote absence.
- `src/components/game/classTrialPhaseScenes.ts` - updates vote/reveal copy for sealed targets and one-shot opening.
- `src/components/game/classTrialPhaseScenes.test.ts` - protects the updated vote/reveal phase copy.
- `src/app/globals.css` - adds class-trial vote HUD, rail, ledger, tally, and seat-state styling.
- `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md` - implementation plan used for execution.
- `docs/tasks/2026-05-class-trial-vote-visualization.md` - task card and verification record for this slice.
- `feature_list.json`, `progress.md`, `session-handoff.md` - current feature status and handoff evidence for this slice.
- `src/components/game/classTrialTheme.ts` - replaces seat 8 fixed roster id/display name and adds class-trial portrait layout metadata.
- `src/components/game/classTrialTheme.test.ts` - protects Tomori roster, AI friend order, and portrait calibration baseline.
- `src/components/game/classTrialDialogue.ts` - hybrid dialogue timeline helper with compact long-segment splitting.
- `src/components/game/classTrialDialogue.test.ts` - helper tests for short text, compact long segments, punctuation-light long lines, and reduced-motion fallback.
- `src/components/game/ClassTrialGameTable.tsx` - left/right speaking UI wiring, typewriter state, latest-speaker fallback, and portrait CSS variable rendering.
- `src/components/game/classTrialGameTable.test.ts` - Tomori, dialogue markup, plain-text fallback, latest-speaker regression, and portrait CSS variable tests.
- `src/app/globals.css` - class-trial layout polish, Tailwind layer retention, and fixed portrait frame dimensions.
- `src/components/GameClient.tsx` - switches active class-trial games to the dedicated class-trial app shell background and skips nullable themed curtains.
- `src/components/game/PhaseCurtain.tsx` - adds the class-trial full-screen phase scene presentation.
- `src/components/game/PhaseCurtain.test.ts` - protects class-trial scene rendering and result lines.
- `src/components/game/classTrialPhaseScenes.ts` - maps game phases/events to class-trial scene cues, including hidden-night skips and vote ledger lines.
- `src/components/game/classTrialPhaseScenes.test.ts` - protects hidden-night skips, dawn/vote/exile/final scene behavior, and revealed vote ledger formatting.
- `src/components/game/phaseCurtainModel.ts` - selects class-trial or default curtain cues by theme.
- `src/components/game/phaseCurtainModel.test.ts` - protects theme-specific curtain routing.
- `src/components/game/ClassTrialVerdictReview.tsx` - class-trial terminal verdict review surface.
- `src/components/game/classTrialVerdictReview.test.ts` - verdict review rendering and sparse-review fallback tests.
- `src/server/gptSoVitsTts.ts` - GPT-SoVITS weight switch and TTS transport helper.
- `src/server/gptSoVitsTts.test.ts` - GPT-SoVITS endpoint, payload, and sanitization tests.
- `src/ai/classTrialVoiceProfiles.ts` - 9-role local GPT-SoVITS voice profile resolver.
- `src/ai/classTrialVoiceProfiles.test.ts` - profile mapping and missing-file tests.
- `src/ai/classTrialSpeechRewrite.ts` - Chinese-to-Japanese TTS-only rewrite helper with 千早爱音 filler-word timing guards.
- `src/ai/classTrialSpeechRewrite.test.ts` - rewrite JSON, prefix rejection, seat-number, and 千早爱音 filler-limit tests.
- `src/app/api/ai-speech-audio/route.ts` - class-trial GPT-SoVITS-first route branch with Mimo fallback and richer role-card preservation.
- `src/app/api/ai-speech-audio/route.test.ts` - route provider selection, fallback, and role-card preservation tests.
- `src/components/game/clientTypes.ts` - carries optional role card on AI speech TTS cues.
- `src/components/game/aiSpeechAudio.ts` - includes speaker role card in speech audio cues/chunks and class-trial no-skip text fallback helpers.
- `src/components/game/aiSpeechAudio.test.ts` - protects role-card propagation.
- `src/components/game/classTrialDialogue.ts` - adds audio progress to dialogue frame mapping.
- `src/components/game/classTrialDialogue.test.ts` - protects progress mapping, invalid progress fallback, and reduced-motion full text.
- `src/components/game/ClassTrialGameTable.tsx` - consumes live speech and active audio typewriter state for class-trial dialogue focus.
- `src/components/game/classTrialGameTable.test.ts` - protects loading-state thinking text, audio progress reveal, live speech, and audio speaker focus handoff.
- `src/components/GameClient.tsx` - publishes streaming TTS loading/progress state to the class-trial table and uses timed visible text fallback for unplayed class-trial TTS failures.
- `src/components/game/clientTypes.ts` - extends audio status with playback progress fields and table-facing sync state.
- `src/components/game/aiSpeechAudio.ts` - adds preparation-stage loading status and prepared-audio promise reuse helper.
- `src/components/game/aiSpeechAudio.test.ts` - protects preparation-stage status and prepared promise reuse / rejection cleanup.
- `src/components/game/clientTypes.ts` - carries optional audio preparation stage into class-trial typewriter state.
- `src/components/game/ClassTrialGameTable.tsx` - maps preparation stages to class-trial waiting copy.
- `src/components/game/classTrialGameTable.test.ts` - protects generating and ready-to-play waiting copy.
- `src/components/GameClient.tsx` - starts class-trial speech audio preparation before playback and reuses the prepared promise.
- `src/components/game/classTrialAudioLookahead.ts` - guards background lookahead start, next-cue completed-key construction, and active-run matching.
- `src/components/game/classTrialAudioLookahead.test.ts` - protects the lookahead guard model.
- `src/components/game/gameClientRequests.ts` - adds `submitContinueCommand` for non-streaming background continue.
- `src/components/game/gameClientRequests.test.ts` - protects the background continue request payload.
- `src/components/GameClient.tsx` - buffers one class-trial continue result during active speech playback and prepares the next speech audio silently.
- `src/server/gptSoVitsTts.ts` - adds active-weight tracking, skipped switch reporting, and per-control-endpoint timing.
- `src/server/gptSoVitsTts.test.ts` - protects repeated active-weight skips, timing reports, endpoint encoding, and TTS payload behavior.
- `src/server/gptSoVitsTts.ts` - serializes GPT-SoVITS switch-and-synthesize work against the global active weight state.
- `src/server/gptSoVitsTts.test.ts` - protects the exclusive synthesis queue.
- `src/app/api/ai-speech-audio/route.ts` - logs sanitized class-trial GPT-SoVITS timing payloads around rewrite/switch/TTS/write stages.
- `src/app/api/ai-speech-audio/route.test.ts` - protects GPT-SoVITS provider selection, fallback behavior, and timing log payload.
- `src/app/api/ai-speech-audio/route.ts` - runs class-trial GPT-SoVITS switch and TTS inside the exclusive synthesis queue.
- `src/ai/classTrialSpeechRewrite.ts` - adds rewrite modes, process cache, safe fast templates, and deterministic local rewrite for complex class-trial public-logic lines.
- `src/ai/classTrialSpeechRewrite.test.ts` - protects fast rewrite, deterministic local rewrite, cache reuse, LLM fallback, and validation behavior.
- `src/components/game/aiFriendStorage.ts` - adds effective runtime resolution that forces class-trial games to LLM.
- `src/components/game/aiFriendStorage.test.ts` - protects class-trial LLM override and default-mode preservation.
- `src/components/game/LandingPanel.tsx` - shows class-trial AI runtime status on the local theme card.
- `src/components/game/ClassTrialGameTable.tsx` - shows class-trial AI runtime status in the themed table chrome.
- `src/components/GameClient.tsx` - uses effective AI runtime mode for class-trial visible continue and background lookahead requests.
- `src/components/game/aiSpeechAudio.ts` - adds class-trial current-speaker voice prewarm cues and deferred streaming chunk loading.
- `src/components/game/aiSpeechAudio.test.ts` - protects prewarm cue construction and deferred chunk-loading behavior.
- `src/components/GameClient.tsx` - fires invisible class-trial voice prewarm requests while waiting on `continue`.
- `docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md` - task card and acceptance evidence for this slice.
- `src/ai/actionProviders.ts` - keeps class-trial action repair attempts on DeepSeek rather than cross-persona fallback routes.
- `src/ai/actionProviders.test.ts` - protects class-trial DeepSeek-only action repair, day-vote character lens routing, and private-night lens exclusion.
- `src/ai/speechProviders.ts` - keeps class-trial speech repair attempts on DeepSeek, tightens class-trial speech contract, adds soft character lens guidance, preserves LLM freeplay during repair, and adds soft/static plus broader dynamic anti-repeat director cues.
- `src/ai/speechProviders.test.ts` - protects class-trial DeepSeek-only speech repair, anti-template/persona guidance, tuned class-trial speech contract, role-specific fallback, soft character lens speech input, repair freeplay, and dynamic anti-repeat guidance for multiple repeated motifs.
- `src/ai/classTrialCharacterLens.ts` - reusable behavior lens for class-trial attention bias, pressure style, role-specific director examples, vote-rationale style, template checks, and fallback lines.
- `src/ai/classTrialCharacterLens.test.ts` - protects all fixed 9-character lenses, soft LLM director formatting, role transformation examples, advisory validation, and lens fallback lines.
- `src/ai/modelLlms.ts` - sets DeepSeek action/speech thinking defaults and normal token floors for faster non-empty JSON.
- `src/ai/modelLlms.test.ts` - protects DeepSeek action/speech thinking defaults with red-green tests.
- `docs/tasks/2026-05-class-trial-deepseek-token-budget.md` - task card for this slice.
- `docs/tasks/2026-05-class-trial-audio-latency.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-audio-lookahead.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-rewrite-fast-path.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-llm-runtime.md` - task card for this slice.
- `docs/superpowers/plans/2026-05-29-class-trial-deepseek-brain.md` - implementation plan for this slice.
- `docs/tasks/2026-05-class-trial-deepseek-brain.md` - task card for this slice.
- `docs/superpowers/plans/2026-05-28-class-trial-audio-latency.md` - implementation plan.
- `docs/superpowers/plans/2026-05-28-class-trial-audio-lookahead.md` - implementation plan.
- `docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-latency.md` - implementation plan.
- `docs/superpowers/specs/2026-05-28-class-trial-rewrite-fast-path-design.md` - approved design.
- `docs/superpowers/plans/2026-05-28-class-trial-rewrite-fast-path.md` - implementation plan.
- `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-portrait-calibration.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-flow-scenes.md` - task card and completion evidence.
- `docs/tasks/2026-05-class-trial-verdict-review.md` - task card for this slice.
- `docs/tasks/2026-05-class-trial-gpt-sovits-voice.md` - task card and completion evidence for GPT-SoVITS voice.
- `docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-voice.md` - implementation plan.
- `docs/superpowers/specs/2026-05-28-class-trial-gpt-sovits-voice-design.md` - approved design.
- `docs/superpowers/specs/2026-05-28-class-trial-verdict-review-design.md` - approved design.
- `docs/superpowers/plans/2026-05-28-class-trial-verdict-review.md` - implementation plan.
- `feature_list.json` - marks `class-trial-portrait-calibration`, `class-trial-flow-scenes`, and `class-trial-verdict-review` done with evidence.
- `progress.md` - current state and restart notes.
- `session-handoff.md` - compact restart handoff.
- `docs/tasks/2026-05-class-trial-ui-polish-tomori.md` - completion evidence.
- Ignored local files under `local-assets/class-trial-pack` and `tmp/class-trial-ui-polish-tomori-smoke.png`, including 高松灯 source/candidate backups in `portraits-halfbody-backup`.
- Ignored local files under `local-assets/class-trial-pack/backgrounds/court-main.png` and the local manifest `backgrounds.courtMain` update.
- Ignored generated audio cache under `public/audio/ai-speech`, including GPT-SoVITS smoke wav files.

## Evidence of Completion

- [x] Focused tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` passed, 4 files / 36 tests.
- [x] Red-green focused tests: `npm run test -- src/components/game/classTrialPhaseScenes.test.ts src/components/game/phaseCurtainModel.test.ts` first failed on hidden-night skips and vote ledger, then passed, 2 files / 8 tests.
- [x] Focused class-trial theme flow tests: `npm run test -- src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/phaseCurtainModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/gamePanelsMobile.test.ts` passed, 7 files / 45 tests.
- [x] Red-green verdict review tests: `npm run test -- src/components/game/classTrialTheme.test.ts`, `npm run test -- src/components/game/classTrialVerdictReview.test.ts`, and `npm run test -- src/components/game/classTrialGameTable.test.ts` each failed first for the missing feature and then passed after implementation.
- [x] Focused verdict review tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialVerdictReview.test.ts src/components/game/gamePanelsMobile.test.ts` passed, 4 files / 40 tests.
- [x] Lint: `npm run lint` passed.
- [x] TypeScript: `npx tsc --noEmit` passed.
- [x] Build: `npm run build` passed with existing Turbopack NFT trace warning.
- [x] API smoke: local dev server `http://127.0.0.1:51625` created a `9p-seer-witch-hunter` spectator game with the fixed 9-character class-trial roster and mock AI, then reached `GAME_OVER` in 43 continue steps with `DAY_STARTED`, `VOTE_REVEALED`, `PLAYER_EXILED`, and `GAME_ENDED`.
- [x] Task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-portrait-calibration.md` passed.
- [x] Task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md` passed.
- [x] Task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-flow-scenes.md` passed.
- [x] Harness: `npm run harness:check` passed.
- [x] Whitespace: `git diff --check` passed with line-ending warnings only.
- [x] Browser: `http://localhost:51625` homepage -> 学级裁判主题局 -> 无真人观战 -> sampled 雾切响子、江之岛盾子、苗木诚、高松灯、腐川冬子 and 塞蕾丝缇雅 in the fixed portrait frame; final 高松灯 full-body replacement accepted by user.
- [x] Browser: `http://localhost:51625` confirmed 狼人行动 hides portrait/dialogue while 白天发言 shows the active speaker focus.
- [x] Browser: `http://localhost:51625` confirmed 狼人行动 ring computed `filter: none; opacity: 0.82`, while 白天发言 computed `blur(2.4px); opacity: 0.28`.
- [x] Browser: `http://localhost:51625` confirmed 白天发言 renders `class-trial-focus-enter` with speaker portrait and weakened background.
- [x] Browser: after restarting the local dev server on `http://127.0.0.1:51625`, confirmed active class-trial games render `class-trial-app-shell`, `class-trial-court-stage`, and the new court background gradients instead of the default werewolf table image; screenshot saved at `tmp/class-trial-background-smoke.png`.
- [x] Browser: `http://127.0.0.1:51625` homepage -> 学级裁判主题局 -> 无真人观战 confirmed 狼人行动 starts with no full-screen scene.
- [x] Browser: polling confirmed 狼人行动、预言家查验、女巫行动 all report `forbidden=false` for old full-screen night copy.
- [x] Browser: vote resolution confirmed `票型汇总：2号雾切响子 7票，4号黑白熊 1票，5号江之岛盾子 1票。` and a `逐票：...` ledger line.
- [x] Browser: after restarting stale local dev server on `http://127.0.0.1:51625`, confirmed the generated `backgrounds.courtMain` court image frames the live 9-seat class-trial ring.
- [x] Browser: live class-trial table confirmed a dead seat shows only `已退场` (`黑白熊已退场`) with no role, camp, or death-reason leak.
- [x] Browser: 9p spectator class-trial flow advanced to `GAME_OVER` and automatically rendered the visible themed verdict review with final verdict, key evidence, vote fog, departure list, and role reveal.
- [x] Browser: `/rooms` did not include the local-only `学级裁判主题局` entry.
- [x] Browser screenshots saved as ignored local evidence: `tmp/class-trial-dead-marker-smoke.png` and `tmp/class-trial-verdict-review-smoke.png`.
- [x] GPT-SoVITS focused tests: `npm run test -- src/server/gptSoVitsTts.test.ts src/ai/classTrialVoiceProfiles.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/voiceProfiles.test.ts` passed, 6 files / 24 tests.
- [x] GPT-SoVITS service health: `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` returned `StatusCode 200`.
- [x] Direct route smoke: `POST http://127.0.0.1:51625/api/ai-speech-audio` with 高松灯 role card returned `/audio/ai-speech/tomori-0de13fdbea63e9dc125365fd.wav` and `provider: gpt-sovits`.
- [x] Browser: `http://127.0.0.1:51625` homepage -> 学级裁判主题局 -> AI speech on -> 9 人预女猎 -> 无真人观战 -> played `听 2号发言` and `听 3号发言`, then advanced to later speakers with no browser console errors.
- [x] Generated wav cache evidence: `tomori`, `naegi`, `kirigiri`, and `fukawa` GPT-SoVITS `.wav` files appeared under ignored `public/audio/ai-speech`.
- [x] Audio-sync focused tests: `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` passed, 3 files / 37 tests.
- [x] Audio-sync lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Audio-sync TypeScript: `npx tsc --noEmit` passed.
- [x] Audio-sync build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Browser: restarted local dev server on `http://127.0.0.1:51625`, opened a clean tab, entered `学级裁判主题局` 9p AI-only with AI speech enabled, clicked a speech button, and confirmed the class-trial dialogue stayed on full `正在思考/准备发言。` through GPT-SoVITS generation instead of typewriting the thinking text.
- [x] Generated wav cache evidence after audio-sync smoke: new GPT-SoVITS `.wav` files continued appearing under ignored `public/audio/ai-speech`.
- [x] Red-green latency tests: `npm run test -- src/components/game/aiSpeechAudio.test.ts` and `npm run test -- src/components/game/classTrialGameTable.test.ts` first failed for missing preparation stages / prepared promise helper, then passed after implementation.
- [x] Audio latency focused tests: `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` passed, 3 files / 41 tests.
- [x] Audio latency lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Audio latency TypeScript: `npx tsc --noEmit` passed.
- [x] Audio latency build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Audio latency task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-latency.md` passed.
- [x] Audio latency harness: `npm run harness:check` passed.
- [x] Audio latency whitespace: `git diff --check` passed with CRLF warnings only.
- [x] GPT-SoVITS service health during latency smoke: `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` returned `StatusCode 200`.
- [x] Browser: `http://127.0.0.1:51625` class-trial 9p AI-only with AI speech enabled immediately showed `正在生成语音。` on 苗木诚, later showed `正在调取证言。` / `正在生成语音。` on following speakers, and generated fresh `naegi` / `kirigiri` wav cache files.
- [x] Red-green audio lookahead tests: `npm run test -- src/components/game/classTrialAudioLookahead.test.ts` first failed for missing/stubbed lookahead behavior, then passed after implementation.
- [x] Red-green background continue request test: `npm run test -- src/components/game/gameClientRequests.test.ts` first failed because `submitContinueCommand` did not exist, then passed after implementation.
- [x] Audio lookahead focused tests: `npm run test -- src/components/game/classTrialAudioLookahead.test.ts src/components/game/gameClientRequests.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` passed, 5 files / 51 tests.
- [x] Audio lookahead TypeScript: `npx tsc --noEmit` passed.
- [x] Audio lookahead lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Audio lookahead build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Audio lookahead task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-lookahead.md` passed.
- [x] Audio lookahead harness: `npm run harness:check` passed.
- [x] Audio lookahead whitespace: `git diff --check` passed with CRLF warnings only.
- [x] GPT-SoVITS service health during lookahead smoke: `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` returned `StatusCode 200`.
- [x] Browser: `http://127.0.0.1:51625` class-trial 9p AI-only with AI speech enabled confirmed controls stay disabled during audio/buffered playback; a very short first speech still left visible generation on the second speaker, while the longer second speech gave the third speaker enough lookahead time to enter directly with full dialogue.
- [x] Browser screenshot saved as ignored local evidence: `tmp/class-trial-audio-lookahead-smoke.png`.
- [x] Red-green GPT-SoVITS latency tests: `npm run test -- src/server/gptSoVitsTts.test.ts` first failed for the missing cache/timing API, then passed after implementation.
- [x] Red-green route timing tests: `npm run test -- src/app/api/ai-speech-audio/route.test.ts` first failed because no timing log was emitted, then passed after implementation.
- [x] GPT-SoVITS latency focused tests: `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts` passed, 2 files / 7 tests.
- [x] GPT-SoVITS latency lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] GPT-SoVITS latency TypeScript: `npx tsc --noEmit` passed.
- [x] GPT-SoVITS latency build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] GPT-SoVITS latency task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-latency.md` passed.
- [x] GPT-SoVITS latency harness: `npm run harness:check` passed.
- [x] GPT-SoVITS latency whitespace: `git diff --check` passed with CRLF warnings only.
- [x] GPT-SoVITS latency service health: `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` returned `StatusCode 200`.
- [x] Direct route smoke: two same-role 高松灯/Tomori requests to `http://127.0.0.1:51625/api/ai-speech-audio` returned `provider: gpt-sovits` with `.wav` URLs: `latency-smoke:20260528225927:1` -> `/audio/ai-speech/tomori-1fbc2cd4c7e2aaf14abcaf51.wav` in 10046ms; `latency-smoke:20260528225927:2` -> `/audio/ai-speech/tomori-6cf79401120b7e52341978a0.wav` in 4981ms. Dev-server terminal logs could not be inspected because no app terminal session was attached.
- [x] Follow-up timing diagnosis: `tmp/dev-51625-restart.log` contained five real GPT-SoVITS route samples. Average total was 7032ms: rewrite 5101ms / 72.5%, switch 263ms / 3.7%, TTS 1664ms / 23.7%, write 2ms. Same-weight samples skipped both switch endpoints; the one new-role Kirigiri sample spent 1313ms on weight switching.
- [x] Red-green rewrite fast-path tests: `npm run test -- src/ai/classTrialSpeechRewrite.test.ts` failed first because `clearClassTrialSpeechRewriteCache` / `rewriteClassTrialSpeechForJapaneseTtsWithMeta` did not exist, then passed after implementation.
- [x] Red-green rewriteMode route test: `npm run test -- src/app/api/ai-speech-audio/route.test.ts` failed first because timing logs omitted `rewriteMode`, then passed after implementation.
- [x] Rewrite fast-path focused tests: `npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` passed, 2 files / 8 tests.
- [x] Rewrite fast-path lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Rewrite fast-path TypeScript: `npx tsc --noEmit` passed.
- [x] Rewrite fast-path build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Rewrite fast-path service health: GPT-SoVITS `http://127.0.0.1:9880/openapi.json` and app `http://127.0.0.1:51625` both returned StatusCode 200.
- [x] Direct route smoke: `rewrite-fast-smoke:20260528235235:tomori` returned `provider: gpt-sovits` with `/audio/ai-speech/tomori-b6dddce2800c00ad58bead8d.wav` in 3014ms; log showed `rewriteMode:"fast"`, `rewriteMs:0`, `switchMs:1484`, `ttsMs:1319`, `totalMs:2806`.
- [x] Direct route smoke: `rewrite-fast-smoke:20260528235311:tomori-cache` returned `provider: gpt-sovits` with `/audio/ai-speech/tomori-b969b8577d8f8ed70712f562.wav` in 1053ms; log showed `rewriteMode:"cache"`, `rewriteMs:1`, `switchMs:0`, both weight switches skipped, `ttsMs:965`, `totalMs:968`.
- [x] Red-green LLM runtime tests: `npm run test -- src/components/game/aiFriendStorage.test.ts src/components/game/gamePanelsMobile.test.ts src/components/game/classTrialGameTable.test.ts` first failed for the missing effective-runtime helper and missing status copy, then passed after implementation, 3 files / 37 tests.
- [x] LLM runtime lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] LLM runtime TypeScript: `npx tsc --noEmit` passed.
- [x] LLM runtime build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Browser: `http://127.0.0.1:51625` confirmed the class-trial home card shows `真实 LLM · DeepSeek-v4 主脑` after selecting `学级裁判主题局`, and the themed table topbar shows `真实 LLM · DeepSeek-v4`.
- [x] Live model-routing smoke: new game `8943cd42-566f-411f-8c78-6795cc4cefdd` logged `deepseek-action:deepseek-v4-flash` in `AiCallLog` output attempts, proving class-trial startup is no longer mock-only.
- [x] LLM runtime task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-llm-runtime.md` passed.
- [x] LLM runtime harness: `npm run harness:check` passed.
- [x] LLM runtime whitespace: `git diff --check` passed with CRLF warnings only.
- [x] Red-green DeepSeek brain tests: `npm run test -- src/components/game/classTrialTheme.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` first failed because fixed roles used mixed base personas and repair attempts switched to GPT, then passed after implementation, 3 files / 104 tests.
- [x] DeepSeek brain lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] DeepSeek brain TypeScript: `npx tsc --noEmit` passed.
- [x] DeepSeek brain build: `npm run build` passed with the existing Turbopack NFT trace warning.
- [x] DeepSeek brain task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-brain.md` passed.
- [x] DeepSeek brain harness: `npm run harness:check` passed.
- [x] DeepSeek brain whitespace: `git diff --check` passed with CRLF warnings only.
- [x] Browser/live model-routing smoke: `http://127.0.0.1:51625` showed `真实 LLM · DeepSeek-v4 主脑`; live game `6010e73b-e191-4d53-a3ca-9efc2f939c95` logged observed action repair attempts as `deepseek-action:deepseek-v4-flash` only and an observed speech repair attempt as `deepseek-speech:deepseek-v4-flash` only, with no GPT/Claude/GLM providers in the checked attempts.
- [x] DeepSeek token-budget root-cause probe: direct provider calls showed action `max_tokens` 220/500 and speech `max_tokens` 900/1200 can end with `finish_reason:"length"`, all completion tokens counted as `reasoning_tokens`, and empty `message.content`.
- [x] DeepSeek thinking A/B: action `thinking: disabled` returned non-empty JSON in about 3s; real class-trial speech with `thinking: disabled` plus 900 tokens returned non-empty speech in about 4.5s.
- [x] Red-green DeepSeek thinking-budget tests: `npm run test -- src/ai/modelLlms.test.ts` first failed because DeepSeek action/speech did not both send `thinking: disabled`, then passed after implementation.
- [x] Focused DeepSeek token-budget tests: `npm run test -- src/ai/modelLlms.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` passed, 3 files / 102 tests.
- [x] Real routed DeepSeek probe: Vite `ssrLoadModule('/src/ai/modelLlms.ts')` with action `maxTokens: 220` returned non-empty `deepseek-action:deepseek-v4-flash` text; speech `maxTokens: 900` returned non-empty `deepseek-speech:deepseek-v4-flash` text.
- [x] Narrow class-trial real loop: 8 engine-level LLM calls reached Day 1 `DAY_SPEECH` with DeepSeek-only providers, fallback count 0, empty first-attempt count 3, and recovered outputs for night action and day speech paths.
- [x] Follow-up narrow class-trial real loop after disabling DeepSeek thinking: 5 engine-level LLM calls reached Day 1 `DAY_SPEECH` in about 29s with DeepSeek-only providers, fallback count 0, empty attempt count 0, and 1 speech validation retry.
- [x] DeepSeek token-budget lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] DeepSeek token-budget TypeScript: `npx tsc --noEmit` passed.
- [x] DeepSeek token-budget build: `npm run build` passed with the existing Turbopack NFT trace warning.
- [x] DeepSeek token-budget task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-token-budget.md` passed.
- [x] DeepSeek token-budget harness: `npm run harness:check` passed.
- [x] DeepSeek token-budget whitespace: `git diff --check` passed with CRLF warnings only.
- [x] Red-green GPT-SoVITS prewarm tests: `npm run test -- src/server/gptSoVitsTts.test.ts` first failed because `runGptSoVitsSynthesisExclusive` did not exist, then passed after implementation.
- [x] Red-green class-trial voice prewarm/deferred chunk tests: `npm run test -- src/components/game/aiSpeechAudio.test.ts` first failed because `buildClassTrialVoicePrewarmCue` and deferred chunk loading did not exist, then passed after implementation.
- [x] GPT-SoVITS prewarm focused tests: `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts` passed, 3 files / 22 tests.
- [x] GPT-SoVITS prewarm TypeScript: `npx tsc --noEmit` passed.
- [x] GPT-SoVITS prewarm lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] GPT-SoVITS prewarm build: `npm run build` passed with the existing Turbopack NFT trace warning.
- [x] GPT-SoVITS prewarm task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md` passed.
- [x] GPT-SoVITS prewarm harness: `npm run harness:check` passed.
- [x] GPT-SoVITS prewarm whitespace: `git diff --check` passed with CRLF warnings only.
- [x] GPT-SoVITS prewarm health: `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` returned `StatusCode 200`.
- [x] Direct route smoke: concurrent Tomori and Kirigiri class-trial role-card requests returned `provider: gpt-sovits` wav URLs; timing logs completed Tomori at about 2531ms and Kirigiri at about 5101ms in serialized order.
- [x] Red-green no-skip/typewriter/persona tests: combined focused Vitest first failed for missing compact frames, missing class-trial fallback helpers, missing anti-template/persona contract, missing Anon filler guard, and dropped role-card route fields; latest focused run passed, 5 files / 105 tests.
- [x] Follow-up live/API regression: game `68d9b996-e4f3-4518-b0e0-e146ac7c6328` reached Day 1 speech with fixed 9-character class-trial roster; 苗木诚 TTS initially took about 76.3s with `rewriteMode:"llm"` / `rewriteMs:63779`, then the same text took about 6.3s with `rewriteMode:"local"` / `rewriteMs:0`.
- [x] Follow-up live/API regression: 江之岛盾子 generated GPT-SoVITS audio successfully in about 5.1s, later speaker route samples stayed around 3.8-5.4s, and later non-fallback DeepSeek speeches were more role-directed after relaxing to 3 sentences / 260 chars.
- [x] No-skip/typewriter/persona TypeScript: `npx tsc --noEmit` passed.
- [x] No-skip/typewriter/persona lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] No-skip/typewriter/persona build: `npm run build` passed with the existing Turbopack NFT trace warning.
- [x] Local app health: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:51625/` and `/alpha-health` both returned 200.
- [x] Red-green class-trial director tests: new tests first failed for missing role-specific transformation examples and missing dynamic repeated-focus guidance, then passed after implementation.
- [x] Class-trial text sample on production preview: game `64183909-65b9-44f2-9c35-4a3b89692904` generated 9 Day 1 speeches in about 75s; no dynamic guide fired because the repeated motif was outside the covered set.
- [x] Class-trial text sample on production preview: game `309698cb-5ffc-40d6-af6d-c349b849fbd2` generated 9 Day 1 speeches in about 64s; role pressure moved more naturally, but repeated `干净模板/后置责任` led to the final motif extension.
- [x] Class-trial character lens focused tests: `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed, 3 files / 110 tests.
- [x] Class-trial character lens TypeScript: `npx tsc --noEmit` passed.
- [x] Class-trial character lens lint: `npm run lint` passed with 0 errors and 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Class-trial character lens build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Class-trial LLM freeplay smoke: game `e38aeb06-a684-40f3-88ba-a41035a32d0a` generated 5 Day 1 class-trial speeches; 4 of 5 were non-fallback DeepSeek speech outputs, and the only fallback came from the existing already-spoken-player guard rather than character-lens validation.
- [x] Class-trial full Day 1 LLM sample: game `60f17301-15c4-41a9-a134-7c2adba47c92` generated 9 of 9 Day 1 class-trial speeches as non-fallback DeepSeek speech outputs; later seats still repeated some abstract pressure themes, which led to the soft anti-repeat prompt.
- [x] Class-trial anti-repeat smoke: game `ca0d5a71-261c-4d47-87b1-877c7336a77a` exercised the new prompt path for the first four Day 1 speakers; the final 2 sampled fallbacks came from transient DeepSeek `fetch failed` provider errors, not lens validation.
- [x] Class-trial character lens health: app `/`, app `/alpha-health`, and GPT-SoVITS `/openapi.json` all returned StatusCode 200.
- [x] Class-trial character lens task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md` passed.
- [x] Class-trial character lens harness: `npm run harness:check` passed.
- [x] Class-trial character lens whitespace: `git diff --check` passed with CRLF warnings only.
- [x] Browser audio/typewriter QA on production preview `http://127.0.0.1:51627` reproduced the visible skip/jump risk: no DOM audio node exists for `new Audio(...)`, and a class-trial speaker could move on before the text had a readable window.
- [x] Class-trial text playback now blocks auto-advance while audio/text typewriter state is active, including audio-disabled text fallback.
- [x] Class-trial visible continues without a streaming TTS queue now start timed text playback for the generated speech instead of letting the dialogue jump straight to the next speaker.
- [x] Long class-trial dialogue frames are smaller and faster (`8` display chars per segment, `260ms` segment cadence), reducing the large-block typewriter effect.
- [x] Implausibly short class-trial audio no longer drives synced typewriter progress for long text; playback holds a readable tail window before marking the speaker complete.
- [x] Follow-up class-trial speech-order guard rejects premature trust, suspicion, focus, or vote labels on unspoken seats unless there is public hard info.
- [x] Follow-up class-trial opener guard requires low-info first speakers to leave a verifiable hook instead of only saying they have no information or no reference point.
- [x] Follow-up class-trial prior-speaker guard rejects direct process demands to seats that already spoke, including cross-sentence wording like “你这一轮给过程”.
- [x] New production-preview text sample `89c345c8-b272-457f-b4f1-244a53c8c597` on `http://127.0.0.1:51629` generated the first 4 Day 1 speeches in about 39s; 苗木诚 left a “共同验证的断点”, 雾切响子 reviewed 1号原话 instead of asking him to补过程, and 腐川冬子 did not prematurely信任9号.
- [x] Browser QA after rebuild on `51627` with AI speech enabled showed 苗木诚 wait -> text reveal -> 雾切响子 handoff without silent skip; a follow-up AI-speech-off path showed death seats still marked `已退场` and 苗木诚 text fallback appearing instead of immediate skip.
- [x] Audio/typewriter focused tests: `npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/autoAdvance.test.ts` passed, 4 files / 54 tests.
- [x] Audio/typewriter TypeScript: `npx tsc --noEmit` passed.
- [x] Audio/typewriter lint: `npm run lint` passed with 0 errors and 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Audio/typewriter build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Speech-order/persona guard red-green: `npm run test -- src/ai/speechProviders.test.ts` first failed for missing unspoken-seat trust guard, missing opener hook validation, and missing already-spoken direct-demand validation; latest run passed 1 file / 76 tests.
- [x] Speech-order/persona focused tests: `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed, 3 files / 112 tests.
- [x] Speech-order/persona TypeScript: `npx tsc --noEmit` passed.
- [x] Speech-order/persona lint: `npm run lint` passed with 0 errors and 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Speech-order/persona build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Speech-order/persona local health: `http://127.0.0.1:51629/`, `http://127.0.0.1:51629/alpha-health`, and GPT-SoVITS `http://127.0.0.1:9880/openapi.json` returned 200.
- [x] Speech-order/persona live/API sample: game `89c345c8-b272-457f-b4f1-244a53c8c597` on `http://127.0.0.1:51629` generated first four Day 1 speeches in about 39s and no longer reproduced the earlier `更信9号` / `1号补过程` / no-hook opener problems.
- [x] Audio/typewriter follow-up tests: `npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts` passed, 4 files / 58 tests.
- [x] Audio/typewriter follow-up lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] Audio/typewriter follow-up TypeScript: `npx tsc --noEmit` passed.
- [x] Audio/typewriter follow-up build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Audio/typewriter follow-up task card: `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md` passed.
- [x] Audio/typewriter follow-up harness: `npm run harness:check` passed.
- [x] Audio/typewriter follow-up whitespace: `git diff --check` passed with CRLF warnings only.
- [x] Audio/typewriter follow-up health: `http://127.0.0.1:51629/alpha-health` and GPT-SoVITS `http://127.0.0.1:9880/openapi.json` returned 200.
- [x] Audio/typewriter follow-up browser QA: `http://127.0.0.1:51629` with AI speech enabled showed staged waiting text, 4-char cumulative reveal, complete normalized 69-char 苗木诚 first speech, then handoff to 雾切响子 in game `bb78bcca-e25b-4ea5-a1a5-363bb2f3846b`.
- [x] No-sound root cause: before the dynamic route, latest generated `/audio/ai-speech/*.wav` URLs on `http://127.0.0.1:51629` returned 404 while build-time public assets returned 200.
- [x] No-sound route tests: `npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts` failed first because the route did not exist, then passed after implementation.
- [x] No-sound focused tests: `npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts` passed, 5 files / 61 tests.
- [x] No-sound TypeScript: `npx tsc --noEmit` passed.
- [x] No-sound lint: `npm run lint` passed with 3 existing warnings in `src/server/gptSoVitsTts.test.ts`.
- [x] No-sound build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] No-sound local route smoke: after restarting `next start -p 51629`, app `/alpha-health` returned 200 and a latest generated wav URL returned 200 with `Content-Type: audio/wav`, `Content-Length: 825644`, and `Accept-Ranges: bytes`.
- [x] Follow-up class-trial speech guard rejects prompt/meta phrasing like `通用观察`, `发言对比点`, `对话链`, `缺口先记下`, and template-material demands to unspoken later seats.
- [x] Follow-up class-trial last-words guard rejects LLM custom遗言 self-introductions such as `噗噗，我是黑白熊`, while preserving Monokuma's short `噗噗` character beat.
- [x] Latest local `next start -p 51625` was rebuilt/restarted after the guard changes; `Invoke-WebRequest -UseBasicParsing http://localhost:51625/` returned 200.
- [x] Class-trial prompt-leak/self-intro focused tests: `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts` passed, 3 files / 125 tests.
- [x] Class-trial prompt-leak/self-intro targeted lint: `npx eslint src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts` passed with no output.
- [x] Class-trial prompt-leak/self-intro TypeScript: `npx tsc --noEmit` passed.
- [x] Class-trial prompt-leak/self-intro build: `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- [x] Mimo D1 0-fallback follow-up: class-trial default/runtime label now uses `mimo-v2.5`, matching the best fixed-scenario sample instead of the earlier `mimo-v2.5-pro` route.
- [x] Mimo D1 0-fallback follow-up: fixed validation false positives around true-seer black-check target response, natural class-trial self-intro seer claims, Celestia chip/后置 wording, D1 first-check motive negation, supportive Kirigiri pressure, and natural black-check treatment boundaries.
- [x] Mimo D1 0-fallback sample: `tmp/class-trial-d1-all-speeches-score-1780667013149.md` / `.json`; 9 speeches, 0 fallback, average 85, providers all `mimo-speech:mimo-v2.5`, `viewerQuality pass=8 warn=1`, with remaining anti-template findings `thought_axis_repeat=1` and `black_check_axis_repeat=1`.
- [x] Mimo D1 0-fallback focused tests: `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` passed, 7 files / 287 tests.
- [x] Mimo D1 0-fallback TypeScript: `npx tsc --noEmit` passed.
- [x] Mimo D1 0-fallback follow-up: fixed copied-question-shape validation/repair, preserved hard seer contracts in LLM input, retained only D1 black-check safety bans for non-hard freeform speech, accepted `我才是预言家`, and made hard class-trial hunter claims say `我拍猎人，枪在这里。`.
- [x] Latest Mimo D1 fixed-scenario sample: `tmp/class-trial-d1-all-speeches-score-1780673627203.md` / `.json`; 9 speeches, 0 fallback, average 79, providers all `mimo-speech:mimo-v2.5`, `viewerQuality pass=8 warn=1`, anti-template finding `weak_character_presence=1`. Remaining weak spots are 2号雾切过短、4号黑白熊偏合同化、9号爱音角色纹理偏弱.
- [x] Latest Mimo D1 verification passed: 10-file class-trial aggregate / 419 tests, focused speech/live-state/claims tests / 211 tests, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and task-card gate. Build still reports the existing Turbopack NFT trace warning.
- [ ] GPT-SoVITS was unavailable during the latest browser QA (`127.0.0.1:9880/openapi.json` connection failed), so a real listening pass still needs the local voice service running.
- [ ] The latest browser trace preserved the full Day 1 transcript, but the next subjective pass should start GPT-SoVITS and listen through at least the first 4 voiced speakers.

## 2026-06-09 Ordinary AI Evaluation Tooling

Completed:
- Added a local ordinary Werewolf AI evaluation command for speech/action scoring, JSON/Markdown reports, mock samples, existing-case input, and optional promptfoo judge preparation.
- Added deterministic scoring helpers for template tone, ordinary jargon, rule lectures, no concrete progression, bad follow-up targets, repeated empty pressure, logic boundary errors, and speech-vote discontinuity.
- Added `llm:evaluate --eval-cases-out` so future real or dry LLM samples can be exported into the same eval-case shape.
- Added optional promptfoo prompt/config/provider; live judge calls remain cost-gated by `PROMPTFOO_JUDGE_API_KEY`.

Changed files:
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `scripts/eval-ordinary-ai.mjs`
- `scripts/evaluate-llm-game.mjs`
- `scripts/promptfoo-ordinary-judge-provider.mjs`
- `prompts/evals/ordinary-ai-judge.md`
- `promptfoo.config.yaml`
- `package.json`
- `docs/tasks/2026-06-ordinary-ai-evaluation.md`
- `docs/superpowers/specs/2026-06-08-ordinary-ai-evaluation-design.md`
- `docs/superpowers/plans/2026-06-08-ordinary-ai-evaluation.md`

Verification:
- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 1 file / 15 tests.
- Script syntax checks passed for `scripts/eval-ordinary-ai-utils.mjs`, `scripts/eval-ordinary-ai.mjs`, `scripts/evaluate-llm-game.mjs`, and `scripts/promptfoo-ordinary-judge-provider.mjs`.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json` generated 54 cases, average score 93.5.
- `npm run llm:evaluate -- --provider=mock --allow-mock --games=1 --max-llm-calls=2 --json --out=tmp/llm-eval-smoke.json --eval-cases-out=tmp/ordinary-ai-eval-cases.json` generated 2 dry eval cases.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json --json --out=tmp/ordinary-ai-eval-existing.json` read those 2 cases successfully.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --judge=promptfoo --json --out=tmp/ordinary-ai-eval-promptfoo-prep.json` generated 54 promptfoo cases without live judge calls.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.

Remaining risks:
- Local scoring thresholds are provisional and should be calibrated with several manually reviewed ordinary transcripts.
- Real LLM generation and promptfoo live judging were skipped for cost control.

## 2026-06-09 Ordinary Human Speech Research Follow-up

Completed:
- Paused code changes per user direction and performed source-backed ordinary human-speech research instead.
- Re-read the current ordinary Mimo task docs and latest user-reviewed transcript evidence.
- Added a deeper research section to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` focused on speech validity conditions rather than phrase bans.
- Re-aggregated public GitHub demo data from `boluoweifenda/werewolf` with a no-write script: 11 public demo JSON files, 98 precise Day 1 `audio` speech rows, and all 11 demo games showing Day 1 peace night with `Witch antidote` present.
- Added a stricter 89-row Day 1 speech-act aggregation and an action-card mechanism draft. The key mechanism is: choose one player action first, then render it in first person; do not generate a table-audit paragraph and try to clean it later.
- Recorded why the latest sample failed subjectively: 1号 pre-attacked an unspoken 3号, 2/4号 misattacked public peace-night witch-use as hidden info, 3号 fallback was nearly empty, and later seats repeated `卡 / 这句话本身 / 这段我先...` audit wording.
- Added a direct user-review-to-test mapping in the research doc. The next pass should cover first-seat meta-audit openers, unspoken future-seat framing, peace-night common-sense misattacks, empty micro-moves, repeated audit-surface loops, and speaker-order confused later-chain wording.
- Reconfirmed the implementation constraint: do not solve this with broad phrase bans or a large if/else rules table. Use a soft action-card candidate set plus first-person rendering; keep validator and fallback narrow.
- Added a further public-source calibration section covering `Werewolf Among Us`, `ReneeYe/werewolf_game_reasoning`, `Playing the Werewolf game with artificial intelligence for language understanding`, `Werewolf Arena`, and Chinese role-speech guidance. The new implementation framing is to pass `currentPressure`, `allowedSpeechMoves`, and `recentSurfaceMoves` as soft director inputs, then render first-person speech.
- Added `普通局发言契约 v0.1` as the implementation-before-code checklist: each line must have valid speaker order, first-person motive, public/local table object, and a handling boundary; each 6-9 row sample must show varied moves, no repeated audit surface, natural public role differences, and short non-polluting fallback. The contract also adds a positive `lowInfoHumanWaterPasses` target so natural low-info speech is not over-rejected.
- Added `普通局软导演规格 v0.1`, defining `currentPressure`, `tableObjects`, `allowedSpeechMoves`, and `recentSurfaceMoves` as soft prompt inputs; it also separates LLM rendering, short fallback behavior, and evaluator issue-code responsibilities.

Changed files:
- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
- `npm run harness:long-tasks` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- The same docs-only checks were rerun after the action-card addendum and still passed.
- The same docs-only checks were rerun after the user-review-to-test mapping follow-up and still passed; `long_running_tasks.json` was also parsed successfully.
- The same docs-only checks were rerun after the external-source calibration follow-up and still passed; `git diff --check` still only reported LF/CRLF warnings.
- The same docs-only checks were rerun after the ordinary speech contract follow-up and still passed; `git diff --check` still only reported LF/CRLF warnings.
- The same docs-only checks were rerun after the soft-director spec follow-up and still passed; `git diff --check` still only reported LF/CRLF warnings.

Remaining risks:
- No code fix has been made in this pass by design.
- Current local ordinary evaluator can still score the flawed sample as 100, so the next implementation pass must add tests for the missing subjective-but-checkable failure modes before another paid Mimo sample.
- The action-card mechanism is documented but not implemented yet.

## Notes for Next Session

Use `AGENTS.md` first. For the current ordinary-speech thread, read `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` and `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`. The next implementation pass should start with focused failing tests for the latest user-reviewed ordinary failures, not token reduction and not another paid Mimo sample. Keep the class-trial note available only if the user switches back to that thread: latest class-trial full-game evidence remains `tmp/class-trial-mimo-full-game-1780746535599.md` / `.json`, and another full-game Mimo spend requires explicit approval with temporary process env only.

## 2026-06-11 Ordinary Mimo v26 Fable Minifix

Completed:
- Applied the latest Fable5 v25 critique as a small local minifix: fixed the `不把直接打死` mock splicing regression, added used-once mock bridge selection, and made `repeated_clause_rate` report normalized 15+ Chinese-character repeated clauses from full output text.
- Added the compact review pack and token-saving Fable prompt at `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md`.
- Local mock gate now catches repeated-clause reuse instead of staying silent: `tmp/ordinary-mimo-v26-post-fable-minifix-mock-eval.json` has 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, and 2 report-only `sampleMetrics` warnings.
- Attempted a bounded live Mimo Day 1 speech sample, but the provider returned HTTP 403 `insufficient_user_quota` for all 8 calls. `tmp/ordinary-mimo-v26-post-fable-live-report.json` is fallback-only and must not be judged as real Mimo style.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/tableRead.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Minifix loop passed focused speech/evaluator tests, 3-file AI aggregate, and local mock eval.
- Final verification passed:
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts`: 6 files / 398 tests passed.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx eslint src/ai/tableRead.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts` passed.
  - `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, JSON parse for `long_running_tasks.json`, and `npm run harness:check` passed.
  - `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- No usable fresh live Mimo sample exists after v26 because quota blocked all real calls.
- The remaining local warnings are mock/fallback gate signals; do not keep chasing them locally unless Fable5 finds a mechanism-level gap.
- Next engineering step is a bounded paid live Mimo Day 1 sample of 6-9 speeches after quota/key state is fixed. Do not start token reduction.

## 2026-06-11 Ordinary Mimo v27 Live Gate Decision

Completed:
- Applied external review follow-up without reopening mock polish: widened mock bridge reuse avoidance to the visible whole-game window and added a conservative short repeated-clause report-only tier.
- Wrote the live preflight and acceptance standard into `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`.
- Confirmed the previous axis concern: v26 seed 91 D1 was 1号 in 5/9 dominant rows, so no D1 `axis_concentration` warning was expected.
- Ran a new local mock gate: `tmp/ordinary-mimo-v27-post-fable-gate-mock-eval.json`, 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, with 2 report-only warnings retained as gates.
- Used the newly provided temporary key only through process env for a 1-call live preflight, then cleared the env var.

Live preflight:
- `tmp/ordinary-mimo-v27-live-preflight-report.json`
- `tmp/ordinary-mimo-v27-live-preflight-cases.json`
- 1 speech call, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`.
- Provider returned HTTP 403 `insufficient_user_quota` on both attempts, so the 6-9 call bounded live sample was not run.

Remaining risks:
- The product-quality gate cannot be closed without a usable live Mimo sample.
- Do not judge style from the preflight fallback row.
- Next step is account/key quota resolution, then rerun the 1-call preflight before any bounded live sample.

## 2026-06-12 Ordinary Mimo v44 Post-Fable Live Review Gate

Completed:
- Ran the same-seed bounded live Mimo v44 after the v43 Fable5 fixes: `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-report.json`, `-cases.json`, and `-eval.json`.
- v44 covered D1 speech/vote plus D2 speech/vote: 28 calls, 16 speech, 12 action, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`, and 24/28 exported cases with referenced public cues.
- Replayed v43 with the current eval construction; `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-post-fable5-review-eval.json` now reports 10 `speech_vote_discontinuity` issues instead of staying silent.
- Found and fixed one new hard v44 defect locally: a non-Witch accepting a misattributed self-Witch identity now fails provider validation and ordinary eval flags it as `logic_boundary_error`.
- Re-evaluated v44 after the self-Witch guard: `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-after-self-witch-fix-eval.json`, 28 cases, averageScore 98.2, issueCount 2, one high-risk historical v44 case.
- Added the current Fable5 review pack: `docs/evaluations/2026-06-12-ordinary-mimo-v44-post-fable5-live-review.md`.

Changed files:
- `src/ai/seatMemory.ts`
- `src/ai/seatMemory.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/ai/evalOrdinaryAiUtils.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `docs/evaluations/2026-06-12-ordinary-mimo-v44-post-fable5-live-review.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity"` passed.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity|repeated-axis|forward commitment|cut-off seat reference|soft"` passed: 11 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity|malformed|forward commitment|vote continuity"` passed: 4 tests.
- `npm run test -- src/game/claims.test.ts src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 8 files / 449 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/seatMemory.ts src/ai/seatMemory.test.ts src/ai/tableRead.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.

Remaining risks:
- No fresh paid live sample was run after the self-Witch validator; v44 is the historical sample that exposed the defect.
- v44 still has 1 provider fallback/error row, so subjective quality judgment should exclude that row or Fable5 should request one clean rerun.
- D1/D2 still show repeated `先听一圈再看` / `你说完就停了` pressure texture; Fable5 should decide whether this is a required mechanism fix now or a diversity follow-up.
- No API key was persisted; future paid live runs must use temporary process env only.

## 2026-06-13 12p Mimo Post-Fable Bounded Reruns

Completed:
- Continued the 12-player ordinary Mimo speech-mechanics task after Fable5's
  review. The accepted mechanism fixes remain in place: public role-claim move
  diversification, sheriff speech texture, stale self-history target downgrade,
  and public-check fallback bridge de-dup.
- Ran a mock shape calibration before spending live calls and selected a
  bounded 72-call run to cover sheriff nomination/speech/vote, D1, and D2
  speech without intentionally chasing a D4/full-game transcript.
- Ran the first post-Fable 72-call live Mimo rerun with the temporary key only
  through the safe PowerShell prompt:
  `tmp/12p-mimo-speech-mechanics-post-fable-live-report.json`, `-cases.json`,
  and `-eval.json`.
- First rerun summary: 72 calls, 26 speech, 46 action, `fallbackCount 12`,
  `errorCount 12`, `validationFailureCount 9`; action fallback was 8 and
  speech fallback was 4.
- Found the main action-fallback root cause: action public-check attribution
  resolved names like `DeepSeek2` by digit extraction before exact name match,
  so grounded checks against seat-name suffixes could be misread as fabricated.
- Fixed that path in `src/ai/actionProviders.ts` and added regression coverage
  in `src/ai/actionProviders.test.ts`.
- Ran the second 72-call bounded live rerun after the name-suffix fix:
  `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-report.json`,
  `-cases.json`, and `-eval.json`.
- Second rerun summary: 72 calls, 25 speech, 47 action, `fallbackCount 6`,
  `errorCount 6`, `validationFailureCount 2`; action fallback improved from
  8 to 2 while speech fallback remained 4.
- Added a focused speech-provider regression proving adjacent duplicate sheriff
  claim sentences are collapsed by the current normalization path.
- Reviewed the remaining second-rerun speech fallback rows without spending
  another live sample. Two suspicious patterns were already covered by
  passing checks: negated Witch-boundary criticism and Witch silver water plus
  a separate Seer black check.
- Fixed the remaining local speech-side validator/prompt gaps: public-check
  target names now exact-match before digit extraction, generic
  `没人对跳/看有没有对跳` status reads are allowed after a public Seer check,
  and repeated full sheriff-standard quote propagation steers later seats away
  from quoting the same sentence whole again.
- Ran the final post-localfix 72-call bounded 12p Mimo rerun after the local
  no-paid fixes:
  `tmp/12p-mimo-speech-mechanics-post-localfix-live-report.json`,
  `-cases.json`, and `-eval.json`.
- Final post-localfix rerun summary: 72 calls, 25 speech, 47 action,
  `fallbackCount 4`, `errorCount 4`, `validationFailureCount 1`; local eval
  averageScore 97.5, issueCount 10, highRiskCaseIds 2.
- The old repeated sheriff-standard full quote warning no longer appears, but
  the sample still warns about `我先按这个背景听` 3/32, a repeated
  `我先接10号Claude2一句...` bridge 2/32, and rolePublicAction skew 25/32.
- Found and fixed a new hard action-boundary defect from the final sample:
  public action reasons could leak the actor's own hidden role or night action
  (`作为女巫，我首夜救了2号...`). Public action phases now prompt against this,
  validation rejects it, and the repair path can fall back to public candidate
  reason hints. References to another seat's public Witch claim remain allowed.
- Ran the post-private-guard 50-call bounded rerun:
  `tmp/12p-mimo-speech-mechanics-post-private-guard-live-report.json`,
  `-cases.json`, and `-eval.json`. The original Witch/night-action leak did
  not recur, but fallback remained 7/50 because ordinary retry lacked specific
  `D1首验理由不是主要攻击点` repair guidance.
- Added ordinary retry guidance for D1 first-check motive failures and verified
  it with focused red-green coverage.
- Ran the final post-retryfix 50-call bounded rerun:
  `tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json`,
  `-cases.json`, and `-eval.json`. Result: 50 calls, fallback 1, error 1,
  validation failures 0, local eval averageScore 98.2, highRiskCaseIds empty.
- Added a final local guard after that sample for softer own hidden-card action
  labels such as `我作为闭眼位`, `闭眼好人`, and `闭眼平民`.
- Updated `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`
  and `docs/tasks/2026-06-12p-mimo-speech-mechanics.md` with both reruns,
  the name-suffix root cause, the local no-paid follow-up fixes, the final
  post-localfix rerun, the action private-leak guard, and the remaining
  acceptance gap.

Changed files:
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/speech/stability.ts` (currently in the untracked `src/ai/speech/` migration directory imported by `speechProviders.ts`)
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm run test -- src/ai/actionProviders.test.ts -t "target name ends with a digit|fabricate another player's public check result"` passed.
- `npm run test -- src/ai/actionProviders.test.ts -t "public action reasons"` passed: 2 tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary D1 first-check motive"` passed.
- `npm run test -- src/ai/actionProviders.test.ts` passed: 51 tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "dedupes adjacent repeated sheriff claim sentences"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "repeated full-quote propagation|negated witch-boundary|target name ends with a digit in speech|witch silver water|generic counterclaim status"` passed: 5 tests.
- `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 360 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 39 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed.
- `npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm run harness:long-tasks` passed.
- `node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')"` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with LF/CRLF conversion warnings only.
- Strict secret scan found no real long token, literal Bearer credential, or long literal env key in the touched 12p scope.

Remaining risks:
- The final post-retryfix sample is bounded and does not complete the full game.
- The `闭眼位/闭眼好人` action-reason guard was added locally after the final paid
  sample; do not spend another live rerun for this by default unless explicitly
  requested.
- Local eval still warns about smaller report-only surface variety issues:
  repeated `我听到了，但你...` and one repeated public-identity handling clause.
- No key was written to `.env`, docs, source, or reports.

## 2026-06-13 12p Full-Game Low-Cost Follow-Up

Completed:
- Ran a complete local mock game for `12p-sheriff-seer-witch-hunter-guard` after the bounded paid 12p mechanism gate.
- Fixed local full-game surface defects exposed by the mock path:
  - numbered `speech_influence` cue text leaking into speech-like wording,
  - direct mock command Seer claims duplicating `我跳预言家，X号是查杀`,
  - hard role direct mock speeches carrying internal motive text such as `拍身份是为了...`,
  - repeated pressure-chain evidence choosing the same wording across seats.
- Added direct mock command regressions for 12p Seer and Hunter sheriff speeches.
- Added `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md`.

Changed files:
- `src/ai/mockAgent.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/reasoningFrame.ts`
- `src/ai/debateAgenda.ts`
- `src/ai/tableRead.ts`
- `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm.cmd run test -- src/ai/speechProviders.test.ts` passed: 312 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 363 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm.cmd run harness:long-tasks` passed.
- `npm.cmd run harness:check` passed.
- `git diff --check` passed with LF/CRLF conversion warnings only.
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-final-pass-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-final-pass-cases.json` passed: 1/1 game completed, day 5 `GAME_OVER`, 146 calls, 40 speech, 106 action, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-final-pass-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-final-pass-eval.json` passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.

Remaining risks:
- This is local mock proof, not a paid Mimo full-game player-feel proof.
- Final local eval still has two report-only 2/26 warnings: `最卡的反应往回听` and `从{seat}号这条压力转看{seat}号...`.
- Do not chase those warnings with hard rules by default; the next useful step is a small paid live sample only if real-model full-game feel needs proof.

## 2026-06-13 12p Evaluator Calibration After Paid Claim-Boundary Proof

Completed:
- Calibrated the local ordinary AI evaluator after Opus 4.8 judged the latest
  paid proof as `evaluator-calibration`, not another mechanism fix.
- Added regressions for legal non-Seer references to public claimed-Seer checks:
  - `6号Gemini那句话点到我了——两张预言家同时报9号查杀`;
  - `2号Claude这轮直接报了8号Kimi查杀，昨天他报过9号DeepSeek2查杀`.
- Preserved the hard negative case: non-Seer self-owned wording like
  `我验了9号DeepSeek2，9号是查杀` still triggers `logic_boundary_error`.
- Kept the fragment calibration: `这个转折我到现在没听明白。` is no longer
  a `malformed_output_fragment`.
- Re-evaluated the same paid proof cases offline without spending another live
  Mimo run.

Changed files:
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red regression first failed for the real false-positive public-check quote.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "public seer claims"` passed.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-claim-boundary-paid-proof-cases.json --json --out=tmp/12p-mimo-claim-boundary-paid-proof-after-evaluator-calibration-eval.json` passed: 60 cases, averageScore 99.1, issueCount 3, `logic_boundary_error` 0, `malformed_output_fragment` 0, highRiskCaseIds empty.

Remaining risks:
- Remaining sample warnings are report-only surface issues:
  repeated sheriff-standard wording and `rolePublicAction` skew.
- No paid rerun was performed for this evaluator-only change by design.
- The 12p paid proof is bounded and stops at day 2, not a complete paid
  full-game proof.

## 2026-06-13 12p Full-Game Mock Recheck After Evaluator Calibration

Completed:
- Reran the complete low-cost local mock game after evaluator calibration.
- Confirmed the 12p full-game local hard gate still completes cleanly through
  day 5 `GAME_OVER`.
- Reran local ordinary evaluator on the new full-game cases.
- Recorded the result in
  `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md`.

Changed files:
- `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-cases.json` passed: 1/1 game completed, day 5 `GAME_OVER`, 146 calls, 40 speech, 106 action, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-eval.json` passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.

Remaining risks:
- This remains local mock evidence, not paid Mimo player-feel proof.
- Two report-only warnings remain at 2/26 each: `最卡的反应往回听` and
  `从{seat}号这条压力转看{seat}号...`.
- Do not hard-fix those warnings locally by default. The next useful step is a
  small paid Mimo full-feel sample if the user wants to continue toward
  complete 12p read-feel acceptance.

## 2026-06-13 Tencent Deploy: 12p Hard-Gate Passed Worktree

Completed:
- Deployed the current `codex/12p-mimo-speech-mechanics` hard-gate/evaluator
  calibration worktree to the Tencent Cloud primary Alpha server.
- Used a clean source archive from the dirty local working tree, excluding
  `.git`, `.next`, `.local`, `node_modules`, `tmp`, `.env*`, generated DB files,
  logs, and generated audio caches.
- Uploaded archive:
  `/tmp/ai-werewolf-hardgate-20260613-192918.tar.gz`.
- Built and switched `/opt/ai-werewolf/app` on the server.
- Kept rollback source tree:
  `/opt/ai-werewolf/app-backup-20260613-192918`.
- Confirmed `ai-werewolf-app` is healthy with image
  `sha256:22849e5c5a3cb9ddc5add801cb80dd718241b0fcb125fad233de193404158095`.

Changed files:
- `docs/current-release.md`
- `progress.md`
- `session-handoff.md`

Verification:
- Server Docker build completed; Next production build passed with the existing
  Turbopack NFT trace warning.
- `npm.cmd run preflight:production -- --base-url=https://175.178.199.245`
  passed: `ok=true`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-sse`
  passed: room `6JTSJC`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-action:vote`
  passed: room `T95XIB`, covered `wolfKill`, `witchAction`, `speak`, and
  `vote`, final phase `LAST_WORDS`.

Remaining risks:
- This deploy was originally cut from a dirty local source archive, then the
  deployed content was committed and pushed as
  `a214e67 Stabilize 12p Mimo hard gate` on
  `origin/codex/12p-mimo-speech-mechanics`.
- Render was not updated; Tencent Cloud remains the primary public Alpha path.
- The deployed 12p hard-gate work still needs a separate paid full-game feel
  sample if the goal is subjective complete-game read-feel acceptance.

## 2026-06-14 12p DeepSeek Final Acceptance Proof

Completed:
- Ran the final same-seed bounded live proof with `deepseek-chat` using only the
  user-level temporary process environment; no key was written to `.env`.
- Reached day 3 `DAY_VOTE` at 100 calls and exercised the important D3 shape:
  8号 Kimi claimed Seer, kept its self-owned 1号金水, and quoted Claude/GLM's
  old 9号查杀 lines without absorbing them into 8号's structured `checks`.
- Hard scan stayed clean: non-Seer checks 0, same-target contradictions 0,
  private leak 0, accepted fragment hard-shape 0.
- Calibrated the local evaluator for two legal public-check quote false
  positives on the same DeepSeek cases.
- Recorded evidence in
  `docs/evaluations/2026-06-14-12p-deepseek-final-acceptance-proof.md`.

Changed files:
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/evaluations/2026-06-14-12p-deepseek-final-acceptance-proof.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- DeepSeek preflight passed: 1 real action call, fallback 0, error 0,
  validationFailure 0.
- `tmp/12p-deepseek-chat-final-acceptance-report.json`: 100 calls, day 3
  `DAY_VOTE`, fallback 9, error 9, validationFailure 4.
- `tmp/12p-deepseek-chat-final-acceptance-hardscan.json`: non-Seer checks 0,
  contradictions 0, private leaks 0, accepted fragments 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-deepseek-chat-final-acceptance-cases.json --json --out=tmp/12p-deepseek-chat-final-acceptance-after-eval-calibration-eval.json`
  passed after evaluator calibration: 80 cases, averageScore 99.8,
  issueCount 1, highRiskCaseIds empty.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts` passed: 40 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over generated DeepSeek final proof outputs found 0 real
  key or Bearer token matches.

Remaining risks:
- DeepSeek provider stability was noisy: fallback/error 9/100 and
  validationFailure 4/100. This is not a hard attribution failure, but the run
  should not be described as a no-noise provider proof.
- This is a DeepSeek mechanics proof, not a Mimo-specific full-game subjective
  read-feel proof.
- The local branch is ahead of `origin/codex/12p-mimo-speech-mechanics` by an
  unrelated homepage-lobby commit, and untracked/modified homepage files are
  present. Do not mix them into a 12p attribution review unless intentionally
  requested.

## 2026-06-14 Tencent Deploy: 12p Hard-Gate Go Worktree

Completed:
- Deployed the 12p Seer-attribution hard-gate go worktree to Tencent Cloud
  primary Alpha at `https://175.178.199.245`.
- Built the server package from a clean temporary worktree rooted at
  `origin/codex/12p-mimo-speech-mechanics@3c6658a`, then copied only the local
  12p final acceptance/evaluator closeout files into that worktree.
- Excluded the unrelated local homepage-lobby commit and dirty homepage files
  from the deployment archive.
- Uploaded archive:
  `/tmp/ai-werewolf-12p-hardgate-20260614-170123.tar.gz`.
- Switched `/opt/ai-werewolf/app` and kept rollback source tree:
  `/opt/ai-werewolf/app-backup-20260614-170123`.
- Confirmed live image:
  `sha256:fefce9ca22c0e90a4a259ab2752aadd1f7163a8e46bf8e1e89e6920b32d8807e`.

Changed files:
- `docs/current-release.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Server Docker build completed; Next production build passed with the existing
  Turbopack NFT trace warning.
- `ai-werewolf-app` reached Docker health `healthy`.
- `npm.cmd run preflight:production -- --base-url=https://175.178.199.245`
  passed: `ok=true`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-sse`
  passed: room `GT2PT4`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-action:vote`
  passed: room `EFQ9LR`, covered `seerCheck`, `speak`, and `vote`, final phase
  `LAST_WORDS`.

Remaining risks:
- Render mirror was not updated.
- The clean deployment source is reproducible from `3c6658a` plus the local
  12p final acceptance/evaluator patch, but these latest local docs/evaluator
  changes have not been committed from this dirty checkout.
- Current local checkout still contains unrelated homepage-lobby work and
  should be split before any GitHub push.

## 2026-06-14 Single-Player LLM Sample Export

Completed:
- Added an owner-token protected single-player sample export endpoint:
  `GET /api/games/:gameId/sample?token=...`.
- Used `gameId` as the collection key for local/single-player games, because
  these games do not have multiplayer room codes.
- Reused the existing `AI_WEREWOLF_METRICS_TOKEN` access check pattern from
  owner metrics routes. Unauthorized sample requests return 404.
- Exported only review-safe sample fields: game metadata, non-role seat labels,
  already-redacted public events, public speeches, public table summaries, and
  public-phase AI output summaries.
- Kept raw `promptJson`, private events, hidden roles, wolf teammates,
  Seer private checks, and night-phase AI calls out of the sample payload.
- Documented the endpoint in `README.md`.

Changed files:
- `README.md`
- `src/server/gameService.ts`
- `src/app/api/games/[gameId]/sample/route.ts`
- `src/app/api/games/api.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm.cmd run test -- src/app/api/games/api.test.ts` passed: 11 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run harness:check` passed.
- `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- This endpoint is local-only in the current checkout; it has not been deployed
  to Tencent Cloud or Render.
- The worktree still contains unrelated homepage-lobby edits and untracked
  assets. Stage/deploy this sample endpoint as an explicit file group only.
- The endpoint is intentionally owner/admin-facing. It is not a player-visible
  feedback UI.

## 2026-06-14 Tencent Deploy: Single-Player Sample Export

Completed:
- Deployed the single-player LLM sample export endpoint to Tencent Cloud
  primary Alpha at `https://175.178.199.245`.
- Built a clean temporary worktree from
  `origin/codex/12p-mimo-speech-mechanics@3c6658a`, then copied only the
  intended 12p closeout/evaluator files and sample endpoint files into it.
- Confirmed the clean deploy worktree did not include homepage-lobby files such
  as `HomepageDesktopLobby.tsx` or homepage preview images.
- Uploaded archive:
  `/tmp/ai-werewolf-sample-endpoint-20260614-173244.tar.gz`.
- Built the candidate Docker image before switching the live app source.
- Switched `/opt/ai-werewolf/app` and kept rollback source tree:
  `/opt/ai-werewolf/app-backup-20260614-173244`.
- Confirmed live image:
  `sha256:683bb08e694d6f808f713fd6d4f46340ca5786b5acb8c4a49327969d40a93a4e`.

Changed files:
- `docs/current-release.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Candidate Docker build passed and showed `/api/games/[gameId]/sample` in the
  Next route table.
- `ai-werewolf-app` reached Docker health `healthy`.
- `npm.cmd run preflight:production -- --base-url=https://175.178.199.245`
  passed: `ok=true`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-sse`
  passed: room `29AYAN`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-action:vote`
  passed: room `FIS4FU`, covered `wolfKill`, `speak`, and `vote`, final phase
  `LAST_WORDS`.
- `npm.cmd run smoke:main-game -- --base-url=https://175.178.199.245`
  passed: game `617c1185-e977-4fb8-9ebe-466d54fd68de`, final phase
  `DAY_SPEECH`.
- Remote container-internal sample probe passed using
  `AI_WEREWOLF_METRICS_TOKEN` without printing the token: game
  `f82cd7c8-773a-43f3-a3b1-64f44f466e30`, unauthorized sample request 404,
  total AI calls 3, public AI calls 1, public speeches 1, exported night AI
  calls 0.

Remaining risks:
- Render mirror was not updated.
- The current local checkout is still dirty and contains unrelated
  homepage-lobby work. Do not stage/deploy with `git add .`.
- The sample export is admin/owner-facing; public players still need to share
  their `gameId` or let the owner retrieve samples server-side.

## 2026-06-14 Single-Player Feedback ID And Sample Index

Completed:
- Added a reusable `FeedbackIdCopy` UI strip and showed it in active game
  action panels and endgame review panels. Players now see a copyable
  "反馈编号" instead of needing to understand `gameId`.
- Added `readCurrentGameId()` to the recent-game localStorage helper and used
  it in `/alpha-report`, so the feedback template auto-fills the latest
  single-player feedback id while still keeping room codes for multiplayer
  feedback.
- Added owner-token protected `GET /api/games/samples?token=...`, which lists
  recent single-player sample indexes from persisted `AiCallLog` records. The
  list returns sample metadata and sample paths only; single-game details still
  go through `GET /api/games/:gameId/sample?token=...`.
- Optimized the sample index to start from recent AI call logs instead of a
  Prisma relation filter over all games, avoiding slow scans in a history-heavy
  local database.
- Updated README and Alpha feedback docs with the feedback-number and owner
  recovery flow.

Changed files:
- `README.md`
- `docs/alpha-feedback-ops.md`
- `docs/alpha-playtest.md`
- `src/app/alpha-report/FeedbackTemplateClient.tsx`
- `src/app/alpha-report/FeedbackTemplateClient.test.ts`
- `src/app/api/games/samples/route.ts`
- `src/app/api/games/api.test.ts`
- `src/components/game/ActionPanel.tsx`
- `src/components/game/FeedbackIdCopy.tsx`
- `src/components/game/ReviewPanel.tsx`
- `src/components/game/actionPanel.test.ts`
- `src/components/game/recentGamesStore.ts`
- `src/components/game/recentGamesStore.test.ts`
- `src/components/game/reviewPanel.test.ts`
- `src/server/gameService.ts`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- `npm.cmd run test -- src/components/game/recentGamesStore.test.ts src/components/game/actionPanel.test.ts src/components/game/reviewPanel.test.ts src/app/alpha-report/FeedbackTemplateClient.test.ts` passed: 4 files / 11 tests.
- `npm.cmd run test -- src/app/api/games/api.test.ts` passed: 12 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Remaining risks:
- Browser visual verification was not run; current coverage is static render
  tests plus API tests and a live `/alpha-report` HTML marker check.
- The working tree still contains unrelated homepage-lobby changes. Keep this
  sample-collection file group separate from homepage work when staging or
  deploying.

## 2026-06-14 Tencent Deploy: Feedback ID And Sample Index

Completed:
- Deployed the feedback-id UI, `/alpha-report` autofill, and
  `/api/games/samples` sample-index route to Tencent Cloud primary Alpha at
  `https://175.178.199.245`.
- Built from a clean temporary worktree rooted at
  `origin/codex/12p-mimo-speech-mechanics@3c6658a`, then overlaid only the
  intended 12p closeout/evaluator files plus sample/feedback files.
- Confirmed the deploy archive excluded homepage-lobby files.
- Uploaded archive:
  `/tmp/ai-werewolf-feedback-samples-20260614-180534.tar.gz`.
- Switched `/opt/ai-werewolf/app` and kept rollback source tree:
  `/opt/ai-werewolf/app-backup-20260614-180534`.
- Confirmed live image:
  `sha256:3209280a5d33b8724201f804ce8359f28da52b234f965813bbcc6170eef27661`.

Changed files:
- `docs/current-release.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Server Docker build passed and showed `/api/games/samples` in the Next route
  table.
- `ai-werewolf-app` reached Docker health `healthy`.
- `npm.cmd run preflight:production -- --base-url=https://175.178.199.245`
  passed: `ok=true`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-sse`
  passed: room `PFU13J`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-action:vote`
  passed: room `1KZACA`, final phase `LAST_WORDS`.
- `npm.cmd run smoke:main-game -- --base-url=https://175.178.199.245`
  passed: game `07e0a14a-a23b-4126-9e2f-89764b72ff71`, final phase
  `DAY_SPEECH`.
- Live `/alpha-report` HTML contains `反馈编号`.
- Remote container-internal sample index probe passed using
  `AI_WEREWOLF_METRICS_TOKEN` without printing the token: unauthorized request
  404, authorized `sampleCount` 5, first sample path
  `/api/games/07e0a14a-a23b-4126-9e2f-89764b72ff71/sample`, private field scan
  false.

Remaining risks:
- Render mirror was not updated.
- Browser click-level visual verification was not run; live UI marker and
  static render tests cover the feedback-number surface.
- Current local checkout is still dirty and contains unrelated homepage-lobby
  work. Do not stage/deploy with `git add .`.

## 2026-06-15 AI Pool Mobile Redesign

Completed:
- Added a mobile-specific AI pool information architecture with `角色总览`,
  `当前阵容`, and `配置` modes while keeping the existing desktop editor flow.
- Added a compact mobile role overview with search, category filters, an
  always-visible lineup rail, and a bottom inspector for the focused AI.
- Added mobile inspector tabs for overview, role readout, LLM, TTS, and batch
  configuration; LLM/TTS shortcuts open the existing full edit dialog directly
  on the matching tab.
- Kept ordinary player type tuning values read-only in the mobile inspector and
  preserved the full editable role/type panel inside the existing editor.
- Fixed the follow-up mobile interaction bugs: tapping a role card now only
  focuses the role instead of opening a clipped editor; `当前阵容` and `配置`
  render distinct mode panels; selecting another role while on `配置` keeps the
  user on the config page.
- Confirmed the mobile standalone editor's `批量配置` page uses the real LLM/TTS
  preset cards and exposes copy/fill/overwrite actions for the selected AI
  lineup.
- Added editable role name and avatar controls to `角色信息`. Saving an internal
  default AI creates/updates a local editable config and keeps the mobile editor
  on the saved AI instead of bouncing back to the lineup.

Changed files:
- `src/components/AiPoolClient.tsx`
- `src/app/globals.css`
- `src/components/AiPoolClient.mobile.test.ts`
- `progress.md`

Verification:
- `npm run test -- src/components/AiPoolClient.mobile.test.ts` passed: 13
  tests.
- `npx tsc --noEmit` passed.
- `npm run lint` passed with the existing 6 `<img>` warnings in
  `HomepageDesktopLobby.tsx` and `RoomHeader.tsx`.
- `npm run build` passed with the existing Turbopack NFT trace warning through
  `next.config.ts -> src/server/roomService.ts -> rooms/debug-cleanup`.
- Chrome mobile viewport check at 390x844 on `http://127.0.0.1:3010/ai-pool`
  passed: page overflow 0, role grid in two columns, side panel hidden on
  phone, mode card 52px, role grid 227px, inspector 206px, and 8 role cards
  intersecting the viewport.
- Mobile interaction check passed: tapping `当前阵容` switches the mobile view
  to `lineup`; tapping the bottom inspector `LLM` shortcut opens the full edit
  dialog with active section `llm`.
- Follow-up Chrome mobile verification passed: tapping a role card leaves
  native details closed; `当前阵容` displays the lineup board with 8 visible rows;
  `配置` displays the config role list; selecting roles from config or the
  lineup rail keeps `data-mobile-ai-view="config"`; the `LLM` shortcut opens the
  standalone mobile editor with the LLM tab active.
- Latest in-app browser mobile verification passed: `角色总览` / `当前阵容` /
  `配置` switch `data-mobile-ai-view` correctly; `角色信息` shows `角色名称`,
  `保存名称`, `上传头像`, type cards, and read-only meters; `批量配置` shows LLM
  and TTS preset cards plus copy/fill/overwrite actions and expandable preset
  panels.

Remaining risks:
- The mobile custom-AI quick-add side panel is hidden on phone to keep the AI
  pool overview usable without page scrolling; custom creation still needs a
  dedicated mobile design if it must be first-class on small screens.
- Desktop layout was kept on the existing editor/card system; this pass focused
  on mobile AI pool information density and configuration access.

## 2026-06-15 Ordinary Desktop Game History Drawer

Completed:
- Added a compact desktop history entry in the ordinary in-game `局势摘要`
  panel for quick access to public speech and vote records.
- Added a portal-backed `发言与投票历史` overlay with tabs for speech history
  and vote history, keeping the default desktop board layout uncluttered.
- Aggregated speech history from public events and recent speeches; aggregated
  vote history from table memory plus the current public vote snapshots.

Changed files:
- `src/components/game/GameClientLoadedSurface.tsx`
- `src/app/globals.css`
- `src/components/game/GameClientLoadedSurface.test.ts`
- `progress.md`

Verification:
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run test -- src/components/game/GameClientLoadedSurface.test.ts`
  passed: 5 tests.
- `npm.cmd run lint` passed with the existing 6 `<img>` warnings in
  `HomepageDesktopLobby.tsx` and `RoomHeader.tsx`.
- Chrome desktop verification at 1366x768 on `http://127.0.0.1:3010` passed:
  history entry displayed `发言 6 · 投票 1`, overlay stayed inside viewport,
  and page overflow was 0 x 0.

Remaining risks:
- Older completed vote rounds currently show tally/resolution from table memory;
  per-voter historical details are available when the public snapshot exposes
  them. Full per-voter history for every old round would require projection
  support beyond this UI pass.

## 2026-06-15 Tencent Deploy: Game UI And Alpha Feedback Flow

Completed:
- Committed and pushed `7b188b5` (`Polish game UI and alpha feedback flow`) to
  `origin/codex/12p-mimo-speech-mechanics`.
- Deployed that exact source tree to Tencent Cloud from clean archive
  `ai-werewolf-ui-alpha-20260615-161651-7b188b5.tar.gz`.
- Switched live source to `/opt/ai-werewolf/app`; rollback source tree is
  `/opt/ai-werewolf/app-backup-20260615-161651`.
- Confirmed desktop and mobile ordinary game UI locally and on the live Tencent
  URL with page-level overflow `0 x 0`; desktop keeps the table, action rail,
  speech area, and history entry in one viewport, and mobile keeps speech,
  action, identity/recommendation/vote/record tabs in one viewport.

Verification:
- Local `npx.cmd tsc --noEmit --pretty false` passed.
- Local `npm.cmd run test` passed: 103 files / 1239 tests.
- Local `npm.cmd run lint` passed with the existing 6 `<img>` warnings in
  `HomepageDesktopLobby.tsx` and `RoomHeader.tsx`.
- Local `npm.cmd run build` passed with the existing Turbopack NFT trace warning
  through `next.config.ts -> src/server/roomService.ts -> rooms/debug-cleanup`.
- Local Playwright desktop/mobile game UI screenshots passed at 1366x768 and
  390x844; history/record drawers opened without horizontal overflow.
- Server Docker build passed and `ai-werewolf-app` reached Docker health
  `healthy`, image
  `sha256:affe9d7da4b436875ad5a1fc4bd423d645e3c26285dbded2e474e40d609c9263`.
- `npm.cmd run preflight:production -- --base-url=https://175.178.199.245`
  passed: `ok=true`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-sse`
  passed: room `4PE9J3`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-action:vote`
  passed: room `3YRW3M`, covered `wolfKill`, `speak`, and `vote`, final phase
  `NIGHT_WOLVES`.
- `npm.cmd run smoke:main-game -- --base-url=https://175.178.199.245` passed:
  game `50b90a21-7a4a-46ab-b2d1-e87be9c7b9e4`, final phase `DAY_SPEECH`.
- Live Playwright desktop/mobile UI smoke against `https://175.178.199.245`
  passed: both viewports had page overflow `0 x 0`; speech/action/history
  entry points were visible.

Remaining risks:
- Render mirror was not updated in this pass.
- Browser visual proof used a 6-player beginner game at `DAY_SPEECH`; wider
  9p/12p and late-game states should still be spot-checked before a larger
  public playtest.

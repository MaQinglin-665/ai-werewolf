# Session Handoff

## Current Objective

- Current objective: the 12p hard-gate mechanics are paid-verified, the paid full-game Mimo sample completed through day 3 `GAME_OVER`, and repeated D3 proofs exposed one bug class: quoted public Seer checks could be attached to the quoting speaker's structured `checks`. The concrete D3-90/fresh failures are fixed locally, the external `continue-local` review has been applied by changing `claims.ts` to bounded check/report verb ownership, and the follow-up DeepSeek proofs exposed the reverse side: self-owned fake-Seer checks could be dropped when phrased as target-before-pronoun or when a same sentence first quoted another Seer check. Both self-check shapes are fixed locally. The latest live proof is stale because it was generated before the same-sentence clause fix, so the next live proof requires explicit user approval/provider input; do not automatically spend another paid run.
- Current task card: `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`.
- Long-running task id: `lrt-12p-mimo-speech-mechanics` in `long_running_tasks.json`.
- Current branch: `codex/12p-mimo-speech-mechanics`.
- Current project checkpoint:
  - New full-game paid evidence exists at `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`.
  - New sample files:
    - `tmp/12p-mimo-fullfeel-paid-after-hardgate-report.json`
    - `tmp/12p-mimo-fullfeel-paid-after-hardgate-cases.json`
    - `tmp/12p-mimo-fullfeel-paid-after-hardgate-eval.json`
    - `tmp/12p-mimo-fullfeel-paid-after-hardgate-transcript.txt`
    - `tmp/12p-mimo-fullfeel-paid-after-hardgate-fallbacks.json`
  - Full-game sample summary: 85 real Mimo calls, 30 speech, 55 action, day 3 `GAME_OVER`, GOOD win, fallback 5, error 5, validationFailure 3, local eval averageScore 99.2, issueCount 3, highRiskCaseIds 1.
  - Old hard gates were clean in this sample: exact private-strategy leak 0, accepted fragment 0, non-Seer claimBoard checks 0.
  - New structural issue found in the paid sample: 11号 GPT2 claimed Seer with 1号 DeepSeek both `WEREWOLF` and `GOOD` in `publicClaimBoard`, apparently because the parser attached 2号 Claude's old 1号金水 quote to 11号's new 1号查杀 claim.
  - Opus review chose `continue`: this is a hard structured-check attribution blocker, not a subjective style issue.
  - Local fix is now in `src/game/claims.ts` / `src/game/claims.test.ts`: quoted checks attributed to another seat/pronoun such as `他之前报过1号金水` are skipped for the current speaker, and one claimed Seer cannot store both results for the same target.
  - Verification passed for the exact red/green regressions, full `claims.test.ts`, `tableMemory.test.ts`, speech/action provider tests, ordinary eval tests, TypeScript, and lint.
  - Bounded paid proof after the local fix:
    - `tmp/12p-mimo-cross-seer-attribution-preflight-report.json`: 1 real Mimo action call, fallback 0, error 0, validationFailure 0.
    - `tmp/12p-mimo-cross-seer-attribution-small-report.json`: 60 calls, reached day 2 `DAY_VOTE`, stopped at `max_llm_calls`, fallback 2, error 2, validationFailure 0, totalQualityIssues 0.
    - `tmp/12p-mimo-cross-seer-attribution-small-eval.json`: 60 cases, averageScore 98.1, issueCount 6, highRiskCaseIds 1.
    - Hard scan over the proof cases: claimed-Seer same-target contradictions 0, non-Seer claimBoard checks 0, private leak exact hits 0, accepted fragment hard-shape hits 0.
    - Limitation: the proof did not reach D3, so it did not resample the original 11号 GPT2 quoting 2号 Claude's old 1号金水 while claiming a new 1号查杀.
  - Opus review of that D2 proof chose `partial-pass / longer-bounded-rerun`.
  - B-class evaluator calibration is now done locally:
    - `src/ai/llmEvaluation.ts` no longer treats bare nouny `查` / `验` in `查验线` or `查杀前那句` as a check-report verb.
    - `src/ai/llmEvaluation.test.ts` covers the real 3号 GPT legal public-check quote and a negative case where the same wording is fabricated if the board lacks 2号 Claude's 9号查杀.
    - Offline re-eval output: `tmp/12p-mimo-cross-seer-attribution-small-after-b-calibration-eval.json`, 60 cases, averageScore 98.6, issueCount 5, `logic_boundary_error` 0, highRiskCaseIds empty.
  - Longer D3 paid proof after B calibration:
    - Evidence: `tmp/12p-mimo-cross-seer-attribution-d3-90-report.json`, `tmp/12p-mimo-cross-seer-attribution-d3-90-cases.json`, `tmp/12p-mimo-cross-seer-attribution-d3-90-eval.json`, and `tmp/12p-mimo-cross-seer-attribution-d3-90-after-localfix-eval.json`.
    - Summary: 90 calls, 33 speech, 57 action, reached D4 `DAY_SPEECH` after D3 `DAY_SPEECH`/`DAY_VOTE`, stopped at `max_llm_calls`, fallback/error 9/90, validationFailure 6.
    - Hard result: claimed-Seer same-target contradictions 0 and non-Seer checks 0, but 8号 Kimi's claimed-Seer board incorrectly carried both valid 8->1 `WEREWOLF` and invalid quoted 8->2 `WEREWOLF` after Kimi quoted 1号's public 2号查杀.
    - Accepted-fragment result: D3 7号 GLM was accepted with `说实话，1号DeepSeek，你今天这条查验我先挂着。你报2号Claude查杀，但刚才那段发言的重点全在`.
    - Local fix: `src/game/claims.ts` now detects same-sentence explicit other-seat/pronoun subjects before attaching a check to the current speaker, and `src/ai/speech/ordinarySurface.ts` exports `hasUnfinishedOrdinaryFocusMarker()` for provider/evaluator reuse.
    - Verification after the local fixes: `npm.cmd run test -- src/game/claims.test.ts` passed 31 tests; `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed 369 tests; `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/claims.test.ts src/game/tableMemory.test.ts` passed 83 tests; D3-90 re-eval after localfix passed with 80 cases, averageScore 98.9, issueCount 5, `malformed_output_fragment` 1; `npx.cmd tsc --noEmit --pretty false` and `npm.cmd run lint` passed.
  - Fresh D3 paid proof after the D3-90 local fixes:
    - Evidence: `tmp/12p-mimo-cross-seer-attribution-d3-fresh-report.json`, `tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json`, `tmp/12p-mimo-cross-seer-attribution-d3-fresh-eval.json`, `tmp/12p-mimo-cross-seer-attribution-d3-fresh-hardscan.json`, and `tmp/12p-mimo-cross-seer-attribution-d3-fresh-status.json`.
    - Summary: 90 calls, 33 speech, 57 action, reached D4 `DAY_SPEECH`, stopped at `max_llm_calls`, fallback/error 11/90, validationFailure 4, totalQualityIssues 0.
    - Hard scan: private leak 0, accepted fragment 0, non-Seer checks 0, claimed-Seer same-target contradictions 0.
    - Hard failure: 8号 Kimi's D2 speech said `我是预言家，昨晚验的2号Claude，查杀`, but `publicClaimBoard` stored 8->2 `GOOD` after misreading `我现在更在意的是2号Claude刚才报的金水`.
    - Local fix: `src/game/claims.ts` now recognizes target-as-subject quoted reports such as `2号Claude刚才报的金水` and skips them before attaching checks to the current speaker. The rule is limited to explicit report/quote cues so `昨晚验的2号Claude，查杀` still parses.
    - Verification after the local fix: red regression first failed with 8->2 `GOOD`; focused claims subset passed; full `src/game/claims.test.ts` passed 32 tests; eval/tableMemory tests passed 52 tests; speech/action provider tests passed 369 tests; `npx.cmd tsc --noEmit --pretty false` and `npm.cmd run lint` passed.
  - External review package/result:
    - `docs/evaluations/2026-06-14-12p-mimo-fresh-d3-target-subject-review-prompt.md`.
    - The reviewer chose `continue-local`: the extractor needed a structural ownership rule, not another quoted-phrase patch followed by paid rerun.
    - Applied follow-up: `src/game/claims.ts` now uses bounded governing verb classes. Owned check verbs with speaker/omitted subject can create speaker `checks`; report/quote verbs (`报/说/称/给/留`) or other-seat/pronoun subjects cannot.
    - Added regression: `2号Claude给的金水` and `4号豆包留的2号查杀` do not become Kimi checks, while `昨晚验的2号Claude，查杀` remains Kimi's self-owned fake-Seer check.
    - B evaluator calibration refreshed for the fresh D3 legal public-check quote. Offline re-eval output: `tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`, 80 cases, averageScore 98, issueCount 7, highRiskCaseIds 3. The previous 3号 GPT legal public-check quote is no longer high-risk; remaining logic errors are stale-board derivatives from old metadata, plus one unrelated dead-target follow-up.
    - Latest verification: `npm.cmd run test -- src/game/claims.test.ts` passed 33 tests; `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts` passed 73 tests; `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed 381 tests; offline re-eval passed; `npx.cmd tsc --noEmit --pretty false` and `npm.cmd run lint` passed.
  - DeepSeek follow-up proof after structural attribution:
    - User switched the temporary provider to DeepSeek. Current proof evidence is recorded in `docs/evaluations/2026-06-14-12p-deepseek-d3-after-structural-proof.md`.
    - DeepSeek-chat preflight: 1 action call, fallback 0, error 0, validationFailure 0.
    - DeepSeek-chat full run: `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-report.json`, completed 85 calls through day 3 `GAME_OVER`, fallback 3, error 3, validationFailure 0.
    - Local eval: `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-eval.json`, 80 cases, averageScore 98.6, issueCount 6, highRiskCaseIds empty.
    - Hardscan: private leak 0, accepted fragment 0, malformed fragment 0, non-Seer checks 0, claimed-Seer same-target contradictions 0.
    - Trigger limitation: it did not reproduce the original dead-Seer old-check quote trigger.
    - New hard local finding: 11号 GPT2 said `我这边拍个身份，我是预言家。1号DeepSeek，我昨晚验的你，查杀。`, but the exported board recorded 11号 GPT2 as claimed Seer with `checks: []`.
    - Local fix: `src/game/claims.ts` now parses target-before-pronoun self-owned check syntax, covered by `src/game/claims.test.ts` regression `parses self-owned seer checks when the addressed target appears before a pronoun result`.
    - Latest verification after the pronoun fix: `npm.cmd run test -- src/game/claims.test.ts` passed 34 tests; `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts src/ai/speech/ordinarySurface.test.ts` passed 75 tests; `npx.cmd tsc --noEmit --pretty false`, `npm.cmd run lint`, `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md`, `npm.cmd run harness:long-tasks`, and JSON parse for `long_running_tasks.json` passed; `git diff --check` passed with LF/CRLF warnings only; secret-pattern scan over touched source/docs/state found 0 matches.
    - Decision: not `go`; the DeepSeek proof is now stale for live acceptance because the pronoun fix landed after report generation.
  - DeepSeek follow-up proof after pronoun fix:
    - Evidence recorded in `docs/evaluations/2026-06-14-12p-deepseek-d3-after-pronounfix-proof.md`.
    - The external PowerShell full run completed: `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-report.json`, 100 calls, 33 speech, 67 action, reached day 4 `DAY_SPEECH`, stopped at `max_llm_calls`, fallback/error 1/100, validationFailureCount 1.
    - Eval output: `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-eval.json`, 80 cases, averageScore 97.7, issueCount 8, highRiskCaseIds 3.
    - Hardscan output: `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-hardscan.json`, private leak 0, accepted fragment 0, malformed fragment 0, non-Seer checks 0, claimed-Seer same-target contradictions 0.
    - New hard finding: 4号 豆包 said `2号Claude跳预言家报9号查杀，我先不听这个，因为我是预言家，昨晚验的2号Claude，查杀。`, but exported board recorded 4号 豆包 as claimed Seer with `checks: []`.
    - Root cause: `isReferencedOtherClaimantCheck()` used whole-sentence quote attribution, so the first quoted-check clause suppressed the later self-owned check clause.
    - Local fix: quote/report ownership is now scoped to the local attribution clause around the current candidate check; regression `keeps a same-sentence self-owned check after quoting another seer check` first failed with `checks: []` and then passed.
    - Latest verification after the clause fix: `npm.cmd run test -- src/game/claims.test.ts` passed 35 tests; `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts src/ai/speech/ordinarySurface.test.ts` passed 76 tests; `npx.cmd tsc --noEmit --pretty false`, `npm.cmd run lint`, `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md`, `npm.cmd run harness:long-tasks`, and JSON parse for `long_running_tasks.json` passed; `git diff --check` passed with LF/CRLF warnings only; secret-pattern scan over touched source/docs/state found 0 matches.
    - Decision: not `go`; the latest live proof is stale because this clause fix landed after report generation.
  - 9-player ordinary Mimo speech was accepted as basically passable.
  - User chose to first apply Fable5's underlying mechanism advice, then validate it in `12p-sheriff-seer-witch-hunter-guard`.
  - Local code now gives ordinary seats stronger voice-card identity, bounded incoming pressure/self-history, stronger shared pressure budget language, and non-ritual opening options.
  - 12-player paid Mimo validation later ran after the user supplied temporary provider input through a visible PowerShell prompt.
  - 12p sample files are `tmp/12p-mimo-speech-mechanics-report.json`, `tmp/12p-mimo-speech-mechanics-cases.json`, and `tmp/12p-mimo-speech-mechanics-eval.json`.
  - Fable5 review pack is `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`.
  - Fable5 reviewed the sample and said to continue: the mechanism directions are right, but the next narrow fixes are rolePublicAction diversification, sheriff speech action-path texture, stale self-history target downgrade, and fallback claim-bridge de-dup.
  - Those follow-up fixes are now implemented and locally verified.
  - Two 72-call post-Fable bounded 12p live reruns have now been run with the temporary provider key supplied only through the safe PowerShell prompt.
  - First post-Fable rerun evidence: `tmp/12p-mimo-speech-mechanics-post-fable-live-report.json`, `-cases.json`, and `-eval.json`; 72 calls, fallback 12, error 12, validation failures 9.
  - The first rerun exposed an action-validation bug: names with numeric suffixes such as `DeepSeek2` were parsed by digit extraction before exact name match, so grounded public checks could be misread as fabricated.
  - The name-suffix attribution fix is implemented and verified in `src/ai/actionProviders.ts` / `src/ai/actionProviders.test.ts`.
  - Second post-Fable rerun evidence: `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-report.json`, `-cases.json`, and `-eval.json`; 72 calls, fallback 6, error 6, validation failures 2. Action fallback improved from 8 to 2, but speech fallback remained 4.
  - Added a focused speech-provider regression covering adjacent duplicate sheriff claim sentences; current normalization collapses exact adjacent duplicates.
  - Local no-paid follow-up after the second rerun is implemented: speech public-check validation exact-matches full player names before digit extraction, generic `没人对跳/看有没有对跳` status reads are allowed after a public Seer check, and repeated full sheriff-standard quotes steer later seats away from quoting the same sentence whole again.
  - Final post-localfix rerun evidence: `tmp/12p-mimo-speech-mechanics-post-localfix-live-report.json`, `-cases.json`, and `-eval.json`; 72 calls, fallback 4, error 4, validation failures 1, local eval averageScore 97.5.
  - The final rerun exposed a hard action-boundary defect: public action reasons could leak the actor's own hidden role or night action, for example `作为女巫，我首夜救了2号...`.
  - That action-boundary defect is now locally fixed in `src/ai/actionProviders.ts` / `src/ai/actionProviders.test.ts`: public action reasons reject own private role/night-action leaks and can repair to public candidate reason hints; references to another seat's public Witch claim remain allowed.
  - Post-private-guard rerun evidence: `tmp/12p-mimo-speech-mechanics-post-private-guard-live-report.json`, `-cases.json`, and `-eval.json`; 50 calls, fallback 7, error 7, validation failures 2. The original Witch/night-action leak did not recur, but D1 first-check motive retry failures polluted the sample.
  - Post-retryfix final rerun evidence: `tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json`, `-cases.json`, and `-eval.json`; 50 calls, fallback 1, error 1, validation failures 0, local eval averageScore 98.2, highRiskCaseIds empty.
  - After the final sample, a softer public-action self-label `我作为闭眼位` was covered locally by extending the same private-leak guard to `闭眼位/闭眼好人/闭眼平民/平民/民牌/村民`.
  - Note: `src/ai/speech/stability.ts` is currently under the untracked `src/ai/speech/` migration directory, but `src/ai/speechProviders.ts` already imports it in this worktree. The ordinary D1 first-check retry repair is in that file and must be kept with the migration files.
  - The later local full-game mock gate passed, but the approved small paid 12p full-feel live sample found go-blockers. Evidence: `tmp/12p-mimo-fullfeel-small-live-report.json`, `tmp/12p-mimo-fullfeel-small-live-cases.json`, `tmp/12p-mimo-fullfeel-small-live-eval.json`, and `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`.
  - Small live summary: 60 calls, reached day 2 `DAY_SPEECH`, 32 public speech-like rows, ordinary day-speech fallback/error 7/23, local eval averageScore 99.5, highRiskCaseIds empty.
  - Small live hard blockers: 8号 Kimi sheriff speech publicly leaked `隐藏狼队视角`; D2 10号 accepted the fragment `我是10号Claude2。刚才9号DeepSeek2说的`; later same-day speeches often rejected newly public Seer checks as `凭空引用未公开查验结果`.
  - These two blocker families are now fixed locally:
    - `sheriffSpeech` action validation rejects public messages that leak private wolf/team strategy.
    - Sheriff speech action phases are treated as public-output phases.
    - Wolf private speech context no longer passes raw night-strategy summaries into public speech generation.
    - Wolf speech-plan strategy text is naturalized away from `先隐藏狼队视角` and `制造分歧`.
    - Mock/direct public speech filters wolf internal motive points.
    - Ordinary speech rejects short pickup fragments such as `刚才9号DeepSeek2说的`.
    - Ordinary public-check validation can accept newly public Seer checks from the claimant's recent public speech when formal claim-board extraction lags.
  - Post-fix evidence:
    - `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 366 tests.
    - `npx.cmd tsc --noEmit --pretty false` passed.
    - `npm.cmd run lint` passed.
    - `tmp/12p-fullgame-lowcost-mock-after-livefix-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0.
    - `tmp/12p-fullgame-lowcost-mock-after-livefix-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
    - scan of the post-fix mock report/cases/eval found no `狼队视角`, `隐藏狼队`, `制造分歧`, `狼队首夜`, or `队友`.
  - Opus 4.8 review prompt was used; Opus chose `bounded-rerun`.
  - Opus-requested bounded rerun evidence: `tmp/12p-mimo-fullfeel-bounded-rerun-report.json`, `tmp/12p-mimo-fullfeel-bounded-rerun-cases.json`, and `tmp/12p-mimo-fullfeel-bounded-rerun-eval.json`.
  - Bounded rerun summary: 60 calls, reached day 2 `DAY_SPEECH`, fallback 3, error 3, validationFailure 1, local eval averageScore 97.1, issueCount 8, highRiskCaseIds 3.
  - Rerun private wolf-strategy scan was clean, but accepted-fragment gate failed: D1 10号 output was `我先说9号DeepSeek2刚才那段。他抓6号Gemini那句`.
  - The accepted-fragment path is now fixed locally at provider level: ordinary truncation remains retry/repair-capable, but a final unrepaired `普通局发言疑似被截断` can no longer be soft-accepted and instead falls back.
  - Post-fragment-hardgate evidence:
    - `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 367 tests.
    - `npx.cmd tsc --noEmit --pretty false` passed.
    - `npm.cmd run lint` passed.
    - `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0.
    - `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
  - The user then approved the next bounded paid proof:
    - `tmp/12p-mimo-fullfeel-final-rerun-report.json`, `tmp/12p-mimo-fullfeel-final-rerun-cases.json`, and `tmp/12p-mimo-fullfeel-final-rerun-eval.json`.
    - 60 calls, reached day 2 `DAY_SPEECH`, fallback 4, error 4, validationFailure 1, local eval averageScore 97.8, issueCount 6, highRiskCaseIds 2.
    - Private wolf-strategy scan was clean and the prior `刚才X说的` accepted-fragment class stayed at 0.
    - New hard gate failure: D1 4号 ended at `别光说`.
  - Empty-rebuttal tail is now fixed locally in `src/ai/speech/ordinarySurface.ts` and covered by `rejects ordinary speech that ends at an empty rebuttal cue`.
  - Post-empty-tail evidence:
    - `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 368 tests.
    - `npx.cmd tsc --noEmit --pretty false` passed.
    - `npm.cmd run lint` passed.
    - `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0.
    - `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
  - Opus then chose one more local mechanism fix before another paid proof: public check / identity-claim boundary pollution.
  - That boundary is now fixed locally:
    - `extractRoleClaimFromSpeech()`, `upsertRoleClaim()`, and `describeRoleClaim()` retain structured `checks` only when `claimedRole === "SEER"`.
    - `buildClaimBoard()` filters non-Seer checks for old or manually constructed dirty state.
    - Seer claims, including wolf counterclaims that publicly claim Seer, still keep checks.
  - Post-claim-boundary evidence:
    - `npm.cmd run test -- src/game/claims.test.ts` passed: 28 tests.
    - `npm.cmd run test -- src/game/tableMemory.test.ts` passed: 7 tests.
    - `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 368 tests.
    - `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/ai/llmEvaluation.test.ts` passed: 44 tests.
    - `npx.cmd tsc --noEmit --pretty false` passed.
    - `npm.cmd run lint` passed.
    - `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-report.json`: 1/1 full local game, 146 calls, fallback 0, error 0, validationFailure 0.
    - `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-eval.json`: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
    - Structure scan of `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-cases.json`: non-Seer claims with checks 0; Seer claims with checks 267.
  - Post-claim-boundary paid proof evidence:
    - `tmp/12p-mimo-claim-boundary-paid-preflight-report.json`: 1 real Mimo action call, fallback 0, error 0, validationFailure 0.
    - `tmp/12p-mimo-claim-boundary-paid-proof-report.json`: 60 calls, reached day 2 `DAY_VOTE`, fallback 2, error 2, validationFailure 1.
    - `tmp/12p-mimo-claim-boundary-paid-proof-eval.json`: 60 cases, averageScore 97.8, issueCount 6, highRiskCaseIds 2.
    - Hard-gate scan: non-Seer claimBoard entries with checks 0, non-Seer own-check public statements 0, private leak hits 0, accepted fragment hard-shape hits 0.
    - The two high-risk local eval rows are legal public-check references: Mimo/HUNTER and GLM/VILLAGER both said claimed Seers reported 9号查杀; neither row owns a check or leaks private info.
- Historical Mimo evidence: latest v46 same-seed bounded live sample remains at `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-report.json`, `-cases.json`, and `-eval.json`. v46 local eval was averageScore 100 with issueCount 0, but had residual provider fallback/error rows, so do not call it a pure no-fallback transcript.
- Local note: Do not write or persist API keys. Do not edit `.env`. Any real Mimo/DeepSeek check must use temporary process env only. The latest approved fresh proof has already been spent; paid reruns are now paused for cost control unless the user explicitly asks for one final acceptance proof.
- Latest local cost-control pass: added a six-case live attribution invariant matrix in `src/game/claims.test.ts` and replayed current extraction over existing paid/live cases. `tmp/12p-claim-attribution-local-rescan.json` scanned 550 cases / 246 speech rows / 30 extracted Seer claims, with `potentialMissingSelfCheckCount` 0 and 4 stale board metadata mismatches from pre-fix samples. Commit/review prep then updated stale broad-test assertions and passed full verification: `npm.cmd run test` 100 files / 1218 tests, `npx.cmd tsc --noEmit --pretty false`, `npm.cmd run lint`, and `npm.cmd run build`; build still has the existing Turbopack NFT trace warning.
- Next-session startup: read `AGENTS.md`, `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`, `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`, `progress.md`, and `long_running_tasks.json`.
- Next concrete action: do not run another paid proof by default. If the user explicitly wants final live acceptance, run one fresh same-seed bounded D3 proof with temporary provider input, about 90-100 calls, covering SHERIFF plus D1/D2/D3 `DAY_SPEECH`/`DAY_VOTE`; count it only if it exercises quoted/reported checks plus self-owned fake-Seer checks. Otherwise pause this line and move to the next product/read-feel decision.

## Completed This Session

- [x] Created branch `codex/12p-mimo-speech-mechanics`.
- [x] Added `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`.
- [x] Added `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`.
- [x] Expanded ordinary player voice-card prompt lines with length lane, question tendency, filler/mouth habit, emotion amplitude, and default risk posture.
- [x] Expanded ordinary self-history with bounded incoming pressure when another seat has questioned the current seat.
- [x] Strengthened shared pressure budget prompt text once a target has already absorbed repeated same-axis pressure.
- [x] Added non-ritual previous-speaker guidance: direct rebuttal, no named pickup, short water-pass, defense, or target shift.
- [x] Verified locally with focused red/green tests, full speech-provider tests, `src/ai/llmEvaluation.test.ts`, TypeScript, lint, build, task-card, long-task registry, and harness checks.
- [x] Checked current process/user/machine env without printing values. No Mimo or generic LLM provider env was present, so the paid 12-player sample was skipped.
- [x] After user approval, launched a visible temporary PowerShell runner, accepted Mimo key/base URL as process env only, and ran the bounded 12p validation.
- [x] 12p sample completed to files: `tmp/12p-mimo-speech-mechanics-report.json`, `tmp/12p-mimo-speech-mechanics-cases.json`, and `tmp/12p-mimo-speech-mechanics-eval.json`.
- [x] 12p report summary: 90 calls, 33 speech, 57 action, fallbackCount 10, errorCount 10, validationFailureCount 5, stopped at `max_llm_calls`.
- [x] 12p local eval summary: 80 evaluated cases, averageScore 99.4, issueCount 2, one high-risk stale follow-up target, and sample warnings for repeated claim-line bridges/action distribution skew.
- [x] Added `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md` for Fable5 review.
- [x] Recorded Fable5's review result: continue, but fix rolePublicAction collapse, fallback claim bridge reuse, sheriff speech fixed template, and stale self-history target eligibility.
- [x] Diversified public role-claim handling in `src/ai/speechProviders.ts` into six ordinary player moves: role handling, vote boundary, hold, water-pass, changed read, and discomfort.
- [x] Changed sheriff speech action candidates in `src/ai/actionProviders.ts` so they use ordinary-player persona/risk texture instead of the fixed campaign line.
- [x] Downgraded self-history last speech/vote targets that are no longer alive into "旧线 / 不是当前可处理目标" context.
- [x] Added whole-game used-line avoidance for public-check fallback bridge text.
- [x] Fable5 follow-up verification passed: focused speech tests, focused sheriff action test, combined speech/action provider tests (350 tests), `src/ai/llmEvaluation.test.ts` (39 tests), `npx tsc --noEmit --pretty false`, `npm run lint`, task-card gate, long-task gate, JSON parse, and `npm run build` with the existing Turbopack NFT trace warning.
- [x] Ran the first post-Fable bounded 12p live rerun: `tmp/12p-mimo-speech-mechanics-post-fable-live-report.json`, `-cases.json`, and `-eval.json`; 72 calls, 26 speech, 46 action, `fallbackCount 12`, `errorCount 12`, `validationFailureCount 9`.
- [x] Diagnosed and fixed the main action fallback pollution: public-check target names with digit suffixes such as `DeepSeek2` now exact-match player names before numeric extraction.
- [x] Verified the name-suffix attribution fix with focused and full action-provider tests, combined speech/action provider tests, TypeScript, and lint.
- [x] Ran the second post-Fable bounded 12p live rerun after the name-suffix fix: `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-report.json`, `-cases.json`, and `-eval.json`; 72 calls, 25 speech, 47 action, `fallbackCount 6`, `errorCount 6`, `validationFailureCount 2`.
- [x] Added a focused speech-provider regression for adjacent duplicate sheriff claim sentences; it passes and proves the current normalization path collapses exact adjacent duplicates.
- [x] Narrowed the remaining second-rerun speech fallbacks locally without another paid call: speech public-check target names now exact-match before digit extraction, generic counterclaim-status wording after a public Seer check is accepted, and repeated full sheriff-standard quote propagation removes `quoteOneLine` and asks later seats to paraphrase/react/change action.
- [x] Ran the final post-localfix bounded 12p live rerun: `tmp/12p-mimo-speech-mechanics-post-localfix-live-report.json`, `-cases.json`, and `-eval.json`; 72 calls, 25 speech, 47 action, `fallbackCount 4`, `errorCount 4`, `validationFailureCount 1`, local eval averageScore 97.5.
- [x] Diagnosed the new hard defect from that rerun: public action reasons could leak own private role/night-action information, especially Witch save information in sheriff/vote reasons.
- [x] Added public action private-leak guard and repair: action prompts now forbid own hidden role/night-action in public reasons, validation rejects it, and repair can replace a private self-leaking reason with a public candidate hint while preserving public references to another seat's claim.
- [x] Ran the post-private-guard 50-call bounded rerun. The original Witch/night-action private leak did not recur, but fallback was still 7/50 because ordinary retry lacked a specific repair path for `D1首验理由不是主要攻击点`.
- [x] Added ordinary retry guidance for D1 first-check motive failures.
- [x] Ran the final post-retryfix 50-call bounded rerun: fallback 1/50, error 1/50, validation failures 0, local eval averageScore 98.2, highRiskCaseIds empty.
- [x] Added the final local public-action guard for softer own hidden-card labels such as `闭眼位/闭眼好人/闭眼平民/平民/民牌/村民`.
- [x] Ran the Opus-requested 12p full-feel bounded rerun: 60 calls, fallback 3, error 3, validationFailure 1, no private wolf-strategy leak hits, but one accepted fragment on D1 10号.
- [x] Added provider-level fragment hardgate so unrepaired ordinary truncation errors cannot be soft-accepted after retries.
- [x] Verified the fragment hardgate with focused red/green coverage, combined speech/action provider tests (367 tests), TypeScript, lint, and a clean 12p full-game mock regression.
- [x] Ran the next user-approved bounded paid proof after the fragment hardgate: 60 calls, fallback 4, error 4, validationFailure 1, private leak 0, prior fragment class 0, but one new empty-rebuttal fragment ending at `别光说`.
- [x] Added ordinary surface detection for empty rebuttal tails such as `别光说`, `不能光说`, and `别只说`.
- [x] Verified the empty-tail guard with focused red/green coverage, combined speech/action provider tests (368 tests), TypeScript, lint, and a clean 12p full-game mock regression.
- [x] Latest 12p mechanism verification passed: action provider tests (51 tests), speech/action provider tests (360 tests), `src/ai/llmEvaluation.test.ts` (39 tests), TypeScript, lint, build, task-card gate, long-task gate, JSON parse, harness check, `git diff --check` with LF/CRLF warnings only, and strict secret scan with no real long token / literal Bearer credential / long literal env key in touched 12p scope.
- [x] Ran the post-claim-boundary paid bounded proof: 60 calls, fallback 2, error 2, validationFailure 1; hard-gate scan found 0 non-Seer checks, 0 non-Seer own-check public statements, 0 private leaks, and 0 accepted fragment hard-shapes.
- [x] Committed the ordinary Mimo speech-quality bundle: `56c2785 Improve ordinary Mimo speech evaluation and guards`.
- [x] Fixed the production build blocker in `src/components/AiPoolClient.tsx`: `a0c100c Fix AI pool editable friend build blocker`.
- [x] Pushed `origin/codex/class-trial-ui-polish-tomori`.
- [x] Deployed Tencent Cloud primary Alpha from `a0c100c`.
- [x] Verified Tencent production preflight `ok=true`.
- [x] Verified Tencent room SSE smoke `ok=true`, room `APJBIW`.
- [x] Verified Tencent room vote action smoke `ok=true`, room `VGZV7X`.
- [x] Updated release record: `6b79b8f docs: record Tencent deployment`.
- [x] Updated project roadmap/harness state for the next Public Alpha consolidation phase.
- [x] Added `docs/tasks/2026-06-public-alpha-consolidation-roadmap.md` as the next task-card anchor.
- [x] Implemented the final narrow hard-fact guard: fabricated public check attributions now fail provider/action validation and ordinary eval unless grounded by a Seer claim in the public claim board.
- [x] Extended forward-commitment truncation coverage for tail variants such as `有个更让我别扭的地方。`.
- [x] Preserved `metadata.aliveSeats` names and public claim-board summaries in ordinary eval cases.
- [x] Ran v46 same-seed bounded live Mimo: `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-report.json`, `-cases.json`, and `-eval.json`.
- [x] v46 reached the target D1 speech/vote plus D2 speech/vote envelope with 28 calls, local eval averageScore 100, issueCount 0, and highRiskCaseIds empty.
- [x] v46 acceptance scans found no malformed fragments, no logic-boundary errors, no vote discontinuities, no ungrounded public-check attributions, and no forward-commitment tails.
- [x] Added `docs/evaluations/2026-06-12-ordinary-mimo-v46-final-acceptance-gate.md`.
- [x] Latest verification passed: focused action/eval/eval-utils/speech tests, 8-file related AI/claim aggregate (453 tests), `npx tsc --noEmit --pretty false`, targeted eslint, existing v45 eval replay, and v46 live/eval gate scans.
- [x] Ran v44 same-seed bounded live after the v43 Fable5 fixes: `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-report.json`, `-cases.json`, and `-eval.json`.
- [x] v44 reached the target envelope with D1 speech/vote plus D2 speech/vote: 28 calls, 16 speech, 12 action, `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`.
- [x] Replayed v43 through the current eval constructor; `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-post-fable5-review-eval.json` now reports 10 `speech_vote_discontinuity` issues, proving the old silent mismatch is covered.
- [x] Fixed the new v44 hard defect locally: non-Witch speakers accepting a misattributed self-Witch identity now fail provider validation and ordinary eval flags the shape as `logic_boundary_error`.
- [x] Added `docs/evaluations/2026-06-12-ordinary-mimo-v44-post-fable5-live-review.md` as the current compact Fable5 review pack and stop point.
- [x] Latest v44/self-Witch verification passed: focused speech/evaluator tests, 8-file related AI/claim aggregate (449 tests), `npx tsc --noEmit --pretty false`, and targeted eslint.
- [x] v43 bounded live Mimo completed after the temporary key was entered through the helper: `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-report.json`, `-cases.json`, and `-eval.json`; status file records `complete`.
- [x] v43 reached the target envelope: 28 calls, 16 speech, 12 action, D1 speech/vote plus D2 speech/vote, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`.
- [x] Fixed the v43 false Witch counterclaim pollution: quoted/recognized 3号 GPT wording no longer creates `女巫对跳：Claude、GPT`.
- [x] Fixed the v43 D2 stale Witch save timing: old-save self-claims on D2+ reject `昨晚/昨夜/夜里救的是...` unless the current night save actually happened.
- [x] Added `docs/evaluations/2026-06-12-ordinary-mimo-v43-day-vote-d2-fable5-review.md` as the current compact Fable5 review pack.
- [x] Latest post-v43 verification passed: focused claim and Witch timing tests, Fable5 narrow-fix focused tests, eval-utils test, 8-file related AI/claim aggregate (441 tests), `npx tsc --noEmit --pretty false`, targeted eslint, and existing-case evals for v41 and v43.
- [x] Checked process/user/machine env and local env-file variable presence without printing values. Process/user/machine env had no relevant Mimo variables; `.env`/`.env.local` contained candidate key names but were not printed.
- [x] Ran two 1-call v43 live preflights with local env-file candidates loaded only into temporary process env, then cleared from the process. Both wrote report/cases files and failed with HTTP 401 `invalid_key`, with `fallbackCount 1`, `errorCount 1`, `validationFailureCount 0`; do not treat those fallback rows as Mimo speech-quality evidence.
- [x] Added/kept `tmp/run-mimo-day-vote-d2-live.ps1` as the safe temp-env helper: it uses existing process `AI_LLM_API_KEY` / `MIMO_LLM_API_KEY` if present; otherwise it prompts for a temporary key, writes a per-process temp env file under `tmp`, runs the bounded DAY_VOTE + D2 sample plus eval, then deletes the temp env file in `finally`.
- [x] Earlier v43 gate check: the helper was waiting for hidden token input, no v43 DAY_VOTE + D2 report/cases/eval files existed, and the helper was stopped at that time. This is now historical; the later valid-key helper run completed v43 live and overwrote the latest status to `complete`.
- [x] Checked current process env without printing values. `AI_LLM_PROVIDER`, `AI_LLM_API_KEY`, `MIMO_LLM_API_KEY`, `MIMO_LLM_BASE_URL`, `AI_MODEL_MIMO`, `AI_LLM_BASE_URL`, and `OPENAI_BASE_URL` were all missing, so paid live was not run.
- [x] Ran mock-only v42 command-shape dry-run for the intended next live envelope: `tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-report.json` and `tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-cases.json`. Same seed 91, max 28 calls, final state D2 `DAY_VOTE`, phase coverage D1 speech 9 / D1 vote 9 / D2 speech 7 / D2 vote 3, fallback 0, error 0, validationFailure 0.
- [x] Ran local eval on the dry-run cases: `tmp/ordinary-mimo-v42-day-vote-d2-shape-dryrun-eval.json`, 28 cases, averageScore 99.4, issueCount 1 (`future_audit_hook`), highRiskCaseIds empty. This is mock evidence only.
- [x] Applied Fable5's three required v41 narrow fixes without broad phrase bans or hard fallback expansion:
  - public-role-claim repeated-axis steering now still steers away from same-axis quote/follow pressure while preserving `roleHandle`;
  - forward-commitment endings such as `我先说一下为什么现在跳。` and `我现在想换个方向看。` are treated as `普通局发言疑似被截断`;
  - ordinary eval case construction can count `recentSpeeches`, `speechInfluence`, and `voteLeaders` as referenced public cues.
- [x] Added provider-level regression coverage where both render attempts return `我是女巫...我先说一下为什么现在跳。`; the result is 2 attempts, non-fallback, and final speech with the trailing promise cut.
- [x] Added evaluator regressions for forward-commitment endings in both `analyzeLlmCallQuality` and `analyzeOrdinaryAiEvalCase`, with landed follow-up text not flagged.
- [x] Added eval-utils regression for `buildEvalCaseFromAiLog` counting a reference to `publicSummary.recentSpeeches`.
- [x] Re-ran v41 existing-case eval to `tmp/ordinary-mimo-v41-live-d1-cn-base-after-fable5-narrow-fix-eval.json`: 8 cases, averageScore 95.5, issueCount 2, both `malformed_output_fragment`, highRiskCaseIds empty; sampleMetrics still warns repeated same-axis phrasing at 4/8.
- [x] Verified the current constructor is not silent on public cue references by rebuilding v41 report input summaries in memory: 4/8 rows had `referencedPublicCueCount > 0`. The old exported cases remain historical 0s because existing-case eval reads persisted case counts.
- [x] Latest verification passed: focused speech-provider, evaluator, and eval-utils tests; 7-file AI/table-memory aggregate (413 tests); `npx tsc --noEmit --pretty false`; targeted eslint; task-card gate; long-task check; JSON parse; harness check; `git diff --check` with LF/CRLF warnings only.
- [x] Corrected the current quota/provider diagnosis: the temporary Token Plan route now works; old v26/v27 HTTP 403 notes are no longer the active blocker.
- [x] Ran direct provider and 1-call project preflight without persisting the key. The project preflight returned `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`.
- [x] Ran v41 bounded live Mimo Day 1 speech sample: `tmp/ordinary-mimo-v41-live-d1-cn-base-report.json`, `tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json`, and `tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json`.
- [x] v41 result: 8 speech calls, providers all `custom-speech:mimo-v2.5-pro`, fallback 0, error 0, validation failure 0, total quality issues 0, case-level local eval averageScore 100.
- [x] v41 remaining subjective issue: seats 3/5/6/7 repeatedly chase 1号's `底牌不虚 + 信息少暂时不压票`; report-only sampleMetrics correctly warns `repeated_surface_phrase 4/8` and `repeated_clause_rate 4/8`.
- [x] Updated `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md` as the current compact Fable5 review pack.
- [x] Final v41 verification passed: 7-file AI/table-memory test aggregate (408 tests), v41 existing-case eval, TypeScript, targeted eslint, task-card gate, long-task check, harness check, and `git diff --check` with LF/CRLF warnings only.
- [x] Local-only follow-up after v14/v15: fixed action continuity hints so they no longer emit `N#Name` seat labels; they now use `N号Name`.
- [x] Fixed Seer night-action target/reason mismatch locally. `seerCheck` candidate hints now include the selected target; direct validation rejects a seer-check reason naming a different checked target; routed action output repairs that mismatch by using the selected candidate hint instead of falling back.
- [x] Added soft ordinary speech-rhythm guidance for repeated `我先接上一位 / 这个判断我听到了 / 我听进去了` surfaces. This is prompt/context guidance, not a hard fallback rule.
- [x] Latest local verification passed: focused action red-green tests, focused speech-rhythm red-green test, `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` (328 tests), 5-file AI aggregate test (382 tests), and `npx tsc --noEmit --pretty false`.
- [x] Local-only v20 mock/fallback cleanup after v16-v19 dry runs: removed old action text surfaces (`当前可信度较高`, `稳定发言位`, `当前焦点，查验收益最高`, `身份空间`) from mock night reasons.
- [x] Cleaned ordinary first-seat mock/fallback speech so it no longer copies `tableTask` text, invents pressure on unspoken later seats, says `刚才那句最卡` with no front speech, or waits for generic 后置位 homework.
- [x] Naturalized public-claim audit wording from `身份空间 / 公开处理方向和边界` to `这个身份先认下来，但今天票准备往哪放要说清`.
- [x] Ran v20 local bounded transcript/eval: `tmp/ordinary-mimo-v20-local-polish-dryrun-20260611-0827.json`, `-cases.json`, and `tmp/ordinary-mimo-v20-local-polish-mock-eval-20260611-0827.json`. Result: 25 mock calls, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, bad-pattern grep 0 hits; local eval averageScore 92.0, highRiskCaseIds empty.
- [x] Latest v20 verification passed: focused speech/action/table-read tests, 5-file AI aggregate test (384 tests), `npx tsc --noEmit --pretty false`, and local bounded transcript/eval commands.
- [x] Local v21d vote-continuity follow-up: mock/fallback day-vote reasons now explain either continuing the previous speech target or pivoting from it to a harder current public reason; `createMockCommand` applies the same continuity naturalizer to supplied fallback `votePlan`s.
- [x] Local v21d text polish: player-visible mock vote/speech text no longer uses `公开焦点 / 按这条线归票`, `当前焦点是...`, `我接的公开点是`, or `我接到的是...`.
- [x] v21d local eval: `tmp/ordinary-mimo-v21d-local-vote-continuity-mock-eval-20260611-1025.json`, 42 cases, averageScore 98.3, issueCount 4, `speech_vote_discontinuity` 0, highRiskCaseIds empty.
- [x] v21d bounded dry run: `tmp/ordinary-mimo-v21d-local-vote-continuity-dryrun-20260611-1026.json` and `-cases.json`, 25 mock calls, 12 speech / 13 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, `totalQualityIssues 0`.
- [x] Latest v21d verification passed: focused vote-continuity tests, `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` (332 tests), 5-file AI aggregate test (386 tests), and `npx tsc --noEmit --pretty false`.
- [x] v22 direction update: accepted the positive-context-supply direction for ordinary speech. Broad soft word-list expansion should no longer be the default response; prefer per-seat player mini-bio, self-history, candidate-action diversity, and sample-level transcript review.
- [x] v22 implementation start: `ordinarySpeechDirector.playerVoiceCard` now derives a stable mini-biography from the existing ordinary player profile; `ordinarySpeechDirector.selfHistory` surfaces the speaker's prior public speech, last speech target/stance, and last vote target/reason.
- [x] v22 candidate diversity: repeated pickup/quote surfaces such as `接上一位/我听到了` now remove `quoteOneLine`/`halfAccept` from the next ordinary candidate set and push moves like discomfort, hold, or voteBoundary.
- [x] Latest v22 verification passed: RED/GREEN focused tests for player voice card, self-history, and repeated pickup candidate shifting; full `npm run test -- src/ai/speechProviders.test.ts` passed 290 tests; 5-file AI aggregate passed 388 tests; `npx tsc --noEmit --pretty false` passed; task-card, long-task, harness, and JSON parse checks passed.
- [x] v22 bounded local mock readback: in-memory `node scripts/evaluate-llm-game.mjs --provider=mock --allow-mock --board=9p-seer-witch-hunter --human=none --games=1 --max-llm-calls=14 --json` summary had 14 calls, 9 speech / 5 action, fallback/error/validation/quality all 0. The text still repeated some mock-local surfaces like `刚才给了一个方向，我会拿后面的票和回应对照`, so do not treat this as subjective quality acceptance.
- [x] v23 sample-level evaluator reporting: `summarizeOrdinaryAiEvalCases` now returns `summary.sampleMetrics` for repeated surface phrases, seat voice similarity, action distribution skew, and positive-signal coverage. These are report-only and do not change per-case score, issue count, high-risk cases, validation, retry, or fallback.
- [x] v23 Markdown reporting: `scripts/eval-ordinary-ai-utils.mjs` now prints a `Sample Metrics` section between Summary and Cases; JSON output carries the same `summary.sampleMetrics`.
- [x] v23 mock eval smoke: `node scripts/eval-ordinary-ai.mjs --source=mock --games=1 --seed-start=91 --max-cases=20 --json` reported 20 cases, averageScore 98, issueCount 2, and 2 sample metrics: `repeated_surface_phrase 4/9` and `action_distribution_skew 0.78`.
- [x] Latest v23 verification passed: RED/GREEN sample metric tests, RED/GREEN Markdown report test, 2-file eval tests (28 tests), 6-file AI aggregate (391 tests), and `npx tsc --noEmit --pretty false`.
- [x] v24 stage close: used `summary.sampleMetrics` on bounded mock seed 91, fixed repeated previous-speaker bridges, naturalized player-visible mock public reasoning cues, varied public role vote/rally wording, and calibrated `no_concrete_progression` for weak but landed ordinary actions.
- [x] v24 final local eval: `tmp/ordinary-mimo-v24-stage-close-final-mock-eval.json`, 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, sampleMetrics empty.
- [x] v24 Fable5 review package: `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md`, with minimal read list, sample excerpt, known residual concerns, and review questions.
- [x] v24 final verification passed: 6-file AI aggregate test (395 tests), `npx tsc --noEmit --pretty false`, targeted eslint for touched AI files, task-card gate, long-task registry check, JSON parse check, harness check, and `git diff --check` with LF/CRLF warnings only.
- [x] v25 post-Fable-feedback repair: fixed repeated bridge/pivot wording, reduced repeated full seat labels inside mock speech, added shared-pressure citation budget in the ordinary speech director/candidate layer, and reworded old public-review register in mock/agenda text.
- [x] v25 evaluator visibility: added report-only sample metrics for repeated long clauses and dominant target-axis concentration. These remain quality review signals only; they do not trigger fallback or change case scoring.
- [x] v25 final local eval: `tmp/ordinary-mimo-v25-post-fable-feedback-mock-eval.json`, 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, sampleMetrics empty.
- [x] v25 Fable5 review package: `docs/evaluations/2026-06-11-ordinary-mimo-v25-fable5-review.md`, with minimal read list, changed-surface summary, sample excerpt, review questions, and explicit "do not recommend" boundaries.
- [x] v25 final verification passed: 6-file AI aggregate test (397 tests), `npx tsc --noEmit --pretty false`, targeted eslint for touched AI files, task-card gate, long-task registry check, JSON parse check, harness check, and `git diff --check` with LF/CRLF warnings only.
- [x] Ran full 9-player ordinary Mimo v14 with the temporary Token Plan key only through process env. Evidence: `tmp/ordinary-mimo-v14-fullgame-9p-validkey-20260611-004235.json`, `-cases.json`, `-eval.json`, and `.run.log`.
- [x] v14 completed one game: wolves won on Day 4 by eliminating all gods. It made 55 LLM calls, with 20 speech calls, 35 action calls, `fallbackCount 1`, `errorCount 1`, and `validationFailureCount 0`. Local eval averageScore was 97.5 with 8 low-risk issues and no high-risk cases.
- [x] Manual v14 review found three focused defects: Day 1 first-seat premature pressure on unspoken 3号 (`3号GPT，我先记你一笔`), first-night action reasons inventing public discussion/focus/pressure, and dangling action-continuity merge fragments such as `没；从上一轮...` or orphan target digits.
- [x] Added regression coverage and fixes for those defects in `src/ai/speechProviders.ts`, `src/ai/speechProviders.test.ts`, `src/ai/actionProviders.ts`, and `src/ai/actionProviders.test.ts`.
- [x] Ran post-fix bounded v15: `tmp/ordinary-mimo-v15-post-fullgame-fixes-bounded-20260611-005920.json`, `-cases.json`, and `-eval.json`. Result: 15 calls, 9 speech / 6 action, `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`, local eval averageScore 98.7, one low-risk issue.
- [x] v15 confirmed the first-seat opener no longer pre-points 3号 and first wolf-kill reason stays on first-night low-information rationale. It also exposed one first-night `seerCheck` mixed contradiction before the final validator tightening; this is locally covered but not rerun live.
- [x] Latest verification passed: focused red-green speech/action tests, `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts`, the 5-file AI aggregate test, and `npx tsc --noEmit --pretty false`.
- [x] Used the user-provided temporary Token Plan key only through process env; no key was written to `.env`, source, docs, reports, or provider config.
- [x] Ran valid-key bounded ordinary Mimo samples v08-v13. v08 and v09 had 0 fallback / 0 error and showed the route was usable again; v10-v13 exposed remaining landing/fallback/provider edge cases rather than the earlier invalid-key failure.
- [x] Recorded v08/v09/v10/v11/v12/v13 evidence in `tmp/ordinary-mimo-v08-validkey-small-20260610-2345*`, `tmp/ordinary-mimo-v09-validkey-landing-20260610-2353*`, `tmp/ordinary-mimo-v10-validkey-landing-20260611-0000*`, `tmp/ordinary-mimo-v11-validkey-landing-20260611-0006*`, `tmp/ordinary-mimo-v12-validkey-short-20260611-0015*`, and `tmp/ordinary-mimo-v13-speech-only-20260611-0027*`.
- [x] Added ordinary carry-over prompt guidance: quote at most one prior line, then land a first-person handling action instead of stopping at someone else's words.
- [x] Added soft retry coverage for recap-without-landing / unfinished endings such as `多看一步`, `转一下视线`, `原话我再过一遍`, `能撑住的只有`, `背后藏着一个前提`, and `我记到现在`.
- [x] Fixed first-seat fallback so ordinary Witch/Seer fallback does not quote an unspoken later seat as `刚才那句`.
- [x] Tightened planned seer claim contracts and repair so `claim_gold_check` / `claim_black_check` starts from `我是预言家` instead of vague `先报身份`.
- [x] Extended Day 1 first-check motive attack validation to ordinary mode, and cleaned black-check target repair so leftover `首验心路太薄` residue is removed after attribution repair.
- [x] Latest local verification passed: focused speech-provider tests for unfinished endings, first-check motive, first-seat fallback, and planned seer claims; full `src/ai/speechProviders.test.ts`; `npx tsc --noEmit --pretty false`; AI aggregate tests across action/speech/eval/table-read/seat-memory; task-card, long-task, harness, and diff checks.
- [x] User reviewed the surfaced v05/v06 transcript excerpts and agreed with the diagnosis: the remaining speech-feel problem is review/register wording such as `身份空间`, `发言缺口`, `怎么用这个信息`, and formulaic `起票/补票/最后跟票`.
- [x] Added focused regressions for those exact surfaces in `src/ai/speechProviders.test.ts`, with positive coverage for natural alternatives like `我先当真女巫听`, `票准备往哪放`, and `谁先把票带起来、谁顺着跟上`.
- [x] Extended ordinary speech naturalization and prompt avoid-lines in `src/ai/speechProviders.ts` so accepted LLM output is steered away from those terms without forcing fallback.
- [x] Changed one internal table-task label from `发言缺口` to `没说清的地方`, and changed mock vote-review wording away from `起票和补票位置`.
- [x] Extended `src/ai/llmEvaluation.ts` / `.test.ts` so local eval now flags the review-register surfaces as `ordinary_jargon_stack`.
- [x] Re-scored existing v06/v05 case exports with the new evaluator. v06: `tmp/ordinary-mimo-v06-d1vote-after-review-register-fix-20260610-eval.json`, averageScore 97.0, issueCount 4, highRiskCaseIds empty. v05: `tmp/ordinary-mimo-v05-fullgame-after-review-register-fix-20260610-eval.json`, averageScore 91.8, issueCount 34, mostly `ordinary_jargon_stack`.
- [x] Verification for this review-register pass: focused speech/evaluator tests failed first then passed; `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 343 tests; `npx tsc --noEmit --pretty false` passed; existing-case re-evals passed.
- [x] Attempted post-cleanup v07 bounded Mimo run: `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310.json` plus `-cases.json`. It is not a valid quality sample because all 25 calls returned provider errors: `fallbackCount 25`, `errorCount 25`, `byRetryIssue.provider_request 25`, repeated `401 Invalid API Key`.
- [x] Ran local eval on the fallback-only v07 cases: `tmp/ordinary-mimo-v07-d1vote-after-review-register-cleanup-20260610-2310-eval.json`, averageScore 88.5, issueCount 14. Treat this only as fallback-pollution evidence, not Mimo speech quality evidence.
- [x] Fixed provider-error fallback pollution found in v07: duplicate `这段我先记下`, Kimi/Gemini `身份线/观察位/长线记忆` fallback openers, and eval transcript player names that included model suffixes such as `Mimo-mimo-v25-pr`.
- [x] Cleaned upstream prompt/action/memory fallback wording away from review-register terms where those strings could enter player-visible text or LLM-visible soft guidance.
- [x] Verification for the fallback-pollution pass: focused speech fallback and eval nickname tests failed first then passed; `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/tableRead.test.ts src/ai/seatMemory.test.ts` passed 374 tests; `npx tsc --noEmit --pretty false` passed.
- [x] Ran a full 9-player all-AI ordinary Mimo game on `9p-seer-witch-hunter`: `tmp/ordinary-mimo-v05-fullgame-9p-all-ai-after-claim-action-fixes-20260610-2034.json` and `-cases.json`. It completed one game with 56 LLM calls; wolves won on Day 4. The 5 fallbacks were action/provider-error vote-continuity fallbacks, not speech fallbacks.
- [x] Fixed `scripts/evaluate-llm-game.mjs` so `--human=none|null|all-ai|all_ai` runs all AI seats instead of leaving seat 9 as a default human/model-routed seat.
- [x] Fixed full-game review issues in ordinary speech validation: later public death after an earlier peaceful day, previous-day seer-claim attribution across another seat number, named-focus speech ending unfinished, and repetitive provider-error fallback wording.
- [x] After inspecting v06 text, added a soft unfinished-speech guard for the live 5号 shape: quote/re-listen to a prior line and end at `越想越不对 / 越想越怪 / 不舒服` without a handling action. Positive coverage keeps the same wording valid when it lands a `所以我这轮...` action.
- [x] Fixed action-provider fallback causes from the full-game run: reason clipping now prefers complete sentences/clean clauses, preserves target-change continuity sentences, and accepts natural human target-change wording.
- [x] Fixed local evaluator false positives for true Witch self-reveal formats such as `我是2号，女巫...` and `我底牌是女巫...` while preserving non-Witch hidden-information failures.
- [x] Ran post-fix bounded live confirmation: `tmp/ordinary-mimo-v06-d1vote-after-action-continuity-fix-20260610-2052.json`, `-cases.json`, and `-eval-after-evaluator-fix.json`. It covered Day 1 speech/vote into Day 2 night start with 25 LLM calls, fallbackCount 0, errorCount 0, validationFailureCount 0, local eval averageScore 97.4, and no high-risk cases.
- [x] Verification for the latest fix set: `npm run test -- src/ai/speechProviders.test.ts -t "cut-off seat reference"` passed after the v06 5号 guard; `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` passed 342 tests; `npx tsc --noEmit --pretty false` passed; full-game v05 completed; v05/v06 existing-case evals passed; bounded v06 live confirmation passed.
- [x] Followed the user's latest constraint: avoid forcing LLM fallback for ordinary speech-quality issues unless there is a rule, public-information, role-claim, death-state, or private-info problem.
- [x] Split speech validation handling so ordinary soft quality issues still trigger retry repair, but if only soft issues remain after retries the provider returns the latest LLM speech as non-fallback.
- [x] Added focused coverage for the soft-quality behavior: a repeated ordinary quality issue such as `普通局不要用卡句式口癖` remains reported by validation, but no longer forces fallback after retry exhaustion.
- [x] Kept hard correctness failures hard; this pass did not soften fake deaths, hidden potion/death info, wrong role/check claims, death-shape rule overclaim, or invalid public-info claims.
- [x] Added a true-Witch boundary exception for publicly revealed real Witch speech, preserving public role-action talk while still rejecting false hidden-info Witch-use attacks.
- [x] Fixed natural public Witch-claim parsing for `我是2号，女巫...` shapes in `src/game/claims.ts`, with regression coverage in `src/game/claims.test.ts`.
- [x] Ran the latest bounded ordinary Mimo transcript with the temporary Token Plan key only through process env. Evidence: `tmp/ordinary-mimo-v04-day1-6calls-retry2-soft-quality-claimfix-20260610-1935.json`, `-cases.json`, `-eval.json`, and `-eval.md`. Result: 6 calls, fallbackCount 0, errorCount 0, validationFailureCount 0.
- [x] Local eval on the latest case export passed with averageScore 95 and one likely-overstrict `logic_boundary_error` around 3号 acknowledging 2号's public Witch claim/save target; the run summary also has one non-blocking `death_cause_overclaim` quality hint.
- [x] Latest verification: `npm run test -- src/ai/speechProviders.test.ts` passed 279 tests; `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts` passed 305 tests; `npx tsc --noEmit --pretty false` passed.
- [x] User reviewed the latest post-fallback-fix transcript and said 4号/5号 felt unfinished while the other rows were acceptable enough for this pass.
- [x] Added focused TDD coverage for the 4号 shape: a line that says a prior speech is `听着有点怪` and ends on quoted prior speech now fails as `普通局发言疑似被截断`; the same quote followed by a handling action still passes.
- [x] Confirmed the 5号 shape remains covered by the changed-read guard: `可能要改口 / 判断要变` must land a new read.
- [x] Verification for this user-review follow-up: `npm run test -- src/ai/speechProviders.test.ts -t "cut-off seat reference"` failed first then passed, `npm run test -- src/ai/speechProviders.test.ts -t "changed read"` passed, full `npm run test -- src/ai/speechProviders.test.ts` passed 273 tests, and `npx tsc --noEmit --pretty false` passed.
- [x] Used the user-provided temporary Token Plan key only through process env; no key was written to `.env`, source, docs, reports, or provider config.
- [x] Ran the first fresh v0.4 bounded ordinary Mimo transcript: `tmp/ordinary-mimo-v04-day1-6calls-20260610-180612.json` plus cases/eval files. It produced 6 speech calls, 4 real non-fallback rows, 2 fallback rows, and local eval average 100, but manual review rejected it because fallback misread a concrete `有点滑` read as no suspicion and repeated `我先说一个地方`.
- [x] Added focused speech-provider tests and a narrow fallback fix so prior `有点滑 / 别扭 / 不舒服` reads are treated as concrete discomfort/suspicion, and fallback connector wording varies instead of repeating the same phrase.
- [x] Ran the post-fallback-fix bounded transcript: `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729.json`, cases/eval files, and review `tmp/ordinary-mimo-v04-day1-6calls-post-fallback-fix-20260610-181729-review.md`. It produced 6 speech calls, 4 real non-fallback rows, 2 fallback rows, and local eval average 93.3.
- [x] Manual review of the post-fix transcript says it is still not accepted quality: 1号 is weak/procedural, 2号 true-witch fallback action is too thin, and 5号 says `可能要改口` without landing a new read.
- [x] Added a final local changed-read guard: `可能要改口 / 判断要变` now requires a new landed read, while quoted prior speech is ignored when checking for that read. No fresh live transcript has been run after this final guard.
- [x] Verification for the latest pass: targeted red-green tests for spoken-seat question, concrete slippery-read fallback, and changed-read guard; full `npm run test -- src/ai/speechProviders.test.ts` passed 273 tests; `npx tsc --noEmit --pretty false` passed.
- [x] Public human-speech deep research v0.4: continued docs-only research after the latest 12:31 Mimo transcript; no `src/**`, `.env`, provider config, real LLM call, UI, rules, or token-reduction work was done.
- [x] v0.4 local implementation pass: after user approval, added focused failing tests and minimal speech provider/evaluator changes for latest accepted audit surfaces, v0.4 soft-director units, repeated same-axis pile-on, weak but human low-information speech, grounded emotion, self-defense motive, weak wolf-as-villager, and public role-action speech.
- [x] v0.4 implementation verification passed: `npm run test -- src/ai/llmEvaluation.test.ts` (23 tests), `npm run test -- src/ai/speechProviders.test.ts` (271 tests), combined `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts` (294 tests), `npx tsc --noEmit --pretty false`, task-card gate, long-task registry check, and harness check. No real Mimo call was made in this pass.
- [x] v0.4 post-implementation local re-eval: the latest valid 12:31 Mimo cases were re-scored with the new evaluator, writing `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-v04-eval.json` and `.md`; result average 90.7, issueCount 4, `ordinary_jargon_stack` 3.
- [x] v0.4 fresh-live attempt was blocked by credentials: a one-call Token Plan probe with `.env` loading disabled via `DOTENV_CONFIG_PATH=__codex_no_env_file__` returned `401 Invalid API Key` and wrote fallback-only blocker evidence to `tmp/ordinary-mimo-v04-no-temp-key-blocker.json` / `-cases.json`. This is not a valid quality transcript.
- [x] Re-read project harness docs, AI speech thread, ordinary Mimo task/eval cards, latest transcript review, progress, handoff, and long-running registry before editing.
- [x] Added `2026-06-10 公开真人发言深研与机制 v0.4` to `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`.
- [x] Added/rechecked public sources: GitHub `boluoweifenda/werewolf`, FanLang-9, `Werewolf Among Us`, `Werewolf Arena`, Foaster benchmark, Werewolf-XL, MaKTO-Werewolf, and Chinese role/first-round/new-player guidance.
- [x] Re-ran a no-write public demo aggregation: 11 JSON files, 98 Day 1 `audio` speeches, average about 560 chars, min 10, max 1001; 95/98 first-person, 96/98 direct-address, 85/98 temporary/uncertain handling, 90/98 questions, 71/98 low-information/opening-position, 53/98 defense/explanation, 40/98 hold/pass/defer, 37/98 emotion/pressure hits.
- [x] Mechanism updated to v0.4: `seatState`, `localObject`, `playerMove`, `socialTexture`, `tableContinuation`. The next implementation should use soft action-space steering and positive protection for weak but human lines, not broad bans or large if/else tables.
- [x] Next code gate: user approval. If approved, start with focused tests for `firstSeatWeakWaterPasses`, `firstSeatAuditTaskFails`, accepted audit surfaces, `repeatedAxisPileOnFails`, `underQuestionDefendsSelfFirst`, `weakWolfCanPassAsVillager`, and `trueRolePublicActionPasses`.
- [x] Docs-only v0.4 verification passed: `long_running_tasks.json` parsed, task-card gate passed, long-task registry check passed, harness check passed, and `git diff --check` passed with LF/CRLF warnings only.
- [x] v0.3 prompt/fallback pass: ordinary soft-director prompt lines now name current self-state, local public object, handling action, and voice texture; low-information first-seat/table-read wording now says state and handling boundary instead of `铺观察点 / 可验证观察点`; true-witch soft hidden-state hints such as `我手里的信息先不摊开` are rejected; structured mock hard-claim fallback no longer emits `我卡这里`.
- [x] Focused TDD coverage was used: the new/updated speech and table-read tests failed first for missing v0.3 prompt beats, soft witch hidden-state leak, stale `可验证观察点 / 观察动作`, and structured mock `我卡这里`; after the minimal fixes they passed.
- [x] Latest real Mimo sample used the user-provided temporary process env key only; no key was written to `.env`, docs, reports, or source. Evidence files are `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.json`, `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-cases.json`, `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140-eval.json`, and `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-123140.md`.
- [x] Latest result: 6 Day 1 speech calls, all `custom-speech:mimo-v2.5-pro`, fallbackCount 1, errorCount 1, accepted validation failures 0, local eval average 94.7 with `no_concrete_progression` 1 and `ordinary_jargon_stack` 1.
- [x] Manual review says the latest sample is not accepted quality: 1号 real Mimo still tried future-audit first-seat wording and fell back; 4号 says `当前先审你的发言缺口`; 5号 says `观察位`; 6号 says `这话本身` / `观察条件`; and seats 2-6 over-focus on 1号's fallback line.
- [x] Verification: `npm run test -- src/ai/speechProviders.test.ts` passed with 269 tests, `npm run test -- src/ai/tableRead.test.ts` passed with 28 tests, `npx tsc --noEmit --pretty false` passed, real bounded Mimo command passed, local existing-case eval passed, task-card gate passed, long-task registry check passed, harness check passed, `git diff --check` passed with CRLF warnings only, and a temporary-key prefix scan returned no persisted key matches.
- [x] Public human-speech research v0.3: continued docs/spec work only, with no `src/**`, provider config, `.env`, real LLM call, or token-reduction work.
- [x] Re-ran a read-only public demo aggregation over GitHub `boluoweifenda/werewolf` `data/demo/opensource`: 11 JSON files and 98 precise Day 1 `audio` speeches. The aggregation found 95/98 first-person or us-perspective rows, 95/98 direct-address rows, 86/98 hedge/temporary rows, 95/98 question/response rows, 71/98 low-information/opening-position rows, 40/98 defense/explanation rows, and 36/98 hold/pass/defer rows.
- [x] Cross-checked with public sources: Werewolf Among Us, FanLang-9, Langrensha first-round/villager strategy pages, Foaster Werewolf benchmark, and Werewolf-XL.
- [x] Updated `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` with `公开真人语料再抽样与人味节奏 v0.3`: current self-state, one local public object, one handling action, optional emotional texture. Low-information water remains allowed when it has a personal state and temporary boundary.
- [x] Next code pass should make v0.3 concrete through focused tests and soft prompt/director inputs, not broad word bans or a large if/else table.
- [x] Docs-only verification for v0.3 passed: task-card gate, long-task registry check, harness check, `git diff --check` with LF/CRLF warnings only, and a temporary-key prefix scan with no persisted key matches.
- [x] v0.2 validator/evaluator pass: added or tightened focused coverage for first-seat future-audit hooks (`观察点/后面谁`, `有一个点我先记下来`, `这点记下，后面再看谁`), courtroom/debate register (`举证责任`, `打法是打算验谁`), half-accept without landing, visible audit jargon (`划一条线/划条线`), fallback audit surfaces, and truncated `你留了` tails.
- [x] Preserved positive speech paths while tightening guards: bounded low-information water, direct witch reveal, landed half-accept, challenge-to-half-accept, and true-witch self reveal should still pass.
- [x] Ran bounded real Mimo samples with the temporary process env route only; no key was written to `.env`, docs, reports, or source. The first sample `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-111754.json` exposed first-seat future-audit, `你留了`, and fallback audit surfaces that are now covered locally.
- [x] Latest real Mimo sample: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260610-113300.json` plus cases/eval/review files. It produced 6 Day 1 calls, 4 non-fallback rows, 2 provider-error fallback rows, validationFailureCount 0, and local post-fix eval average 89.7 with 4 issues.
- [x] Manual review of the latest sample: it is useful evidence but not accepted quality. 1号 still says `这点记下，后面再看谁...` and hints at hidden state; 2号/4号 still use line-drawing language; 3号/5号 fallback rows are short and thin.
- [x] Latest verification: `npm run test -- src/ai/speechProviders.test.ts` passed with 268 tests, `npm run test -- src/ai/llmEvaluation.test.ts` passed with 21 tests, `npx tsc --noEmit --pretty false` passed, task-card gate passed, long-task registry check passed, harness check passed, `git diff --check` passed with LF/CRLF warnings only, and a temporary-key prefix scan returned no persisted key matches.
- [x] Docs-only human speech source refresh: updated `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` with `2026-06-10 最新样本缺口与公开素材再校准`. This pass did not edit `src/**`, did not run Mimo, did not touch provider config or `.env`, and did not do token reduction.
- [x] Latest sample failure mapping is now explicit: 1号 first-seat `观察点 / 后面谁` is a future-audit hook, 2号 true-witch `举证责任` style is courtroom/debate register, and 3号 `认同一半` is invalid when it does not land accepted part, reserved part, and current handling.
- [x] Added `普通局发言动作 v0.2`: `entryBeat`, `publicObject`, `moveLanding`, `voiceTexture`, and `antiTemplatePressure`. Next code work should start with focused failing tests for `futureAuditHook`, `courtroomRegister`, `halfAcceptWithoutLanding`, plus positive protections `boundedLowInfoWater` and `emotionalButGrounded`.
- [x] Docs-only verification for the source refresh passed: task-card gate, long-task registry check, harness check, and `git diff --check` with LF/CRLF warnings only.
- [x] Ordinary soft-director implementation: ordinary speech input now carries current pressure, local public table objects, allowed player moves, recent surface moves, and prompt lines for first-person player rendering. Under-question seats are steered toward defending or clarifying their own motive before broader table review.
- [x] Latest user-feedback guard pass: added or tightened focused coverage for visible player-jargon (`布置作业 / 划线 / 触线 / 这句话本身`), copied prior surface phrasing, duplicated-word slips, peace-night public-common-sense misreads, provider-error fallback suffix/template leakage, planned true-witch fallback, and silver-water recipient acknowledgement parsing.
- [x] Latest real Mimo transcript after the fixes: `tmp/ordinary-mimo-phase2-day1-final-transcript-real-20260610-013114.json` with cases/eval/review summary beside it. It produced 6 Day 1 speech calls, all `custom-speech:mimo-v2.5-pro`, fallbackCount 0, errorCount 0, validationFailureCount 0, local eval average 91.7.
- [x] Manual review of the latest sample: covered `卡 / 这句话本身 / 划线 / 触线 / 布置作业` surfaces are gone and 4号's challenge to 3号 is more concrete; remaining risks are 1号 prompt-shaped opener, 2号 debate-like wording, 3号 half-finished `认同一半`, and a likely evaluator false positive against true-witch saved-target reveal. Do not report ordinary speech as fully fixed or accepted.
- [x] Latest verification passed after state updates: `npm run test -- src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/game/claims.test.ts` (3 files / 307 tests), `npx tsc --noEmit --pretty false`, task-card gate, long-task registry check, harness check, and `git diff --check` with LF/CRLF warnings only.
- [x] Ordinary Mimo invocation follow-up: confirmed the temporary Token Plan route can answer direct tiny requests and project-shaped requests without writing secrets; local saved credentials remain invalid with `401 invalid_key`.
- [x] Fixed runtime custom Mimo route safeguards in `src/ai/modelLlms.ts`: Mimo-like custom routes now use disabled thinking, the Mimo speech token floor, and 180s speech timeout. Regression coverage is in `src/ai/modelLlms.test.ts`.
- [x] Tightened ordinary speech quality around the newest real-sample failures: peace-night wolf/witch rule lectures, identity-line pivots after pressure-source callbacks, external counterclaim waiting, and truncated endings such as `你铺的那句`.
- [x] Latest bounded real sample: `tmp/ordinary-mimo-phase2-day1-3calls-after-truncation.json`; 3 custom-Mimo calls, 2 non-fallback rows, 1 intended fallback for low-information skipped-seat tasking. This is evidence for the next narrow prompt/fallback pass, not proof that ordinary speech quality is finished.
- [x] Verification for this follow-up: `npm run test -- src/ai/modelLlms.test.ts`, `npm run test -- src/ai/speechProviders.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check` passed; diff check reported CRLF warnings only.
- [x] Ordinary first-seat low-info follow-up: prompt guidance now says first seat should default to no named future-seat homework; validator rejects first-seat named future homework; provider-error first-seat fallback no longer says `下一位正常接麦`.
- [x] Ordinary fallback gap wording now recognizes peace-night lines that already contain a concrete action such as `谁急着带票` or `先不把票压死`, instead of misreading them as no suspicion.
- [x] Current persisted local Mimo environment still fails with `401 invalid_key`; the latest bounded sample `tmp/ordinary-mimo-phase2-day1-6calls-first-seat-fix-fallback-check.json` is fallback-pollution evidence only, not a real Mimo quality transcript.
- [x] Verification for the first-seat follow-up: `npm run test -- src/ai/speechProviders.test.ts -t "first-seat low-info|player-mouth guidance|provider-error first-seat fallback"`, `npm run test -- src/ai/speechProviders.test.ts -t "peace-night action"`, full `npm run test -- src/ai/speechProviders.test.ts`, `npm run test -- src/ai/modelLlms.test.ts`, `npx tsc --noEmit --pretty false`, and `git diff --check` passed.
- [x] Ordinary bounded Mimo transcript review: `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336.json` generated 6 Day 1 speech calls through `custom-speech:mimo-v2.5-pro`, with 4 real non-fallback rows and 2 provider-error fallback rows. Review summary is `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336.md`; local eval output is `tmp/ordinary-mimo-phase2-day1-6to9calls-transcript-review-20260609-192336-eval.json`.
- [x] The bounded transcript exposed three narrow bad shapes: one real row ending on dangling `但`, provider-error fallback still using `身份线 / 先留一处疑问 / 这轮我只听谁把怀疑落到具体人身上`, and one real row using `放进观察位` plus `接这条线`.
- [x] Added focused regressions and narrow fixes in `src/ai/speechProviders.ts` / `src/ai/speechProviders.test.ts`: ordinary truncation validation catches dangling `但`; provider-error fallback avoids the covered audit-template skeleton; ordinary validation rejects observation-slot plus later-chain-review wording.
- [x] Verification so far for this transcript pass: real bounded Mimo command passed, local eval on exported cases passed, focused red-green speech tests passed, and full `npm run test -- src/ai/speechProviders.test.ts` passed with 249 tests.
- [x] Ordinary human-speech research follow-up: after user review of `tmp/ordinary-mimo-phase2-day1-after-user-review-20260609-205637.json`, paused code changes and expanded `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` around speech validity conditions.
- [x] User-reviewed failures now recorded: 1号 used meta wording `我先说我会卡什么`, first speaker pre-attacked unspoken 3号, 2/4号 treated public peace-night `女巫用药了` as a hidden-info wolf point, 3号 fallback was nearly empty, and later seats repeated `卡 / 这句话本身 / 这段我先...` audit wording.
- [x] New source-backed research note: a no-write aggregation of 11 public GitHub demo JSON files found 98 precise Day 1 audio speech rows and all 11 demo games had Day 1 peace night with `Witch antidote` present. This supports treating no-guard 9p peace-night witch use as public background, not an attack axis.
- [x] Added a stricter 89-row Day 1 speech-act aggregation and action-card mechanism draft. The next prompt/fallback design should select one player action card first, then render it in first person, instead of generating a table-audit paragraph and cleaning it with broad phrase bans.
- [x] Next implementation tests should cover `unspokenSpecificSeatFraming`, `peaceNightPublicCommonSenseMisattack`, `emptyMicroMove`, and `templateSurfaceLoop`. Do not claim ordinary speech is fixed until a fresh post-fix transcript is user-reviewed.
- [x] Docs-only verification for the research/action-card handoff passed: `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` passed; diff check reported LF/CRLF warnings only.
- [x] Follow-up no-code research mapping added explicit test entries for the user's latest comments: first-seat meta-audit opener, 1号 pre-attacking unspoken 3号, 2/4号 misreading peace-night witch use, empty 3号 fallback, repeated `卡 / 这句话本身 / 这段我先...`, and 6号 speaker-order confused later-chain wording.
- [x] Follow-up also records the non-goal: do not solve ordinary speech by adding a broad black-talk glossary, blanket word bans, or a large if/else table. The implementation should stay with soft action-card candidates, first-person rendering, and narrow validation.
- [x] Latest docs-only verification after the mapping follow-up passed: `node -e "JSON.parse(...long_running_tasks.json...)"`, `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` with LF/CRLF warnings only.
- [x] Follow-up public-source calibration added `Werewolf Among Us`, `ReneeYe/werewolf_game_reasoning`, `Playing the Werewolf game with artificial intelligence for language understanding`, `Werewolf Arena`, and role-speech guidance as source anchors. The next prompt design should use soft fields like `currentPressure`, `allowedSpeechMoves`, and `recentSurfaceMoves`, then render first-person speech without printing card names.
- [x] Latest docs-only verification after the public-source calibration passed: `node -e "JSON.parse(...long_running_tasks.json...)"`, `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` with LF/CRLF warnings only.
- [x] Follow-up ordinary speech contract added a pre-code checklist: speaker order, first-person motive, public/local table object, handling boundary, whole-sample move variety, no repeated audit surface, public role differences, and short non-polluting fallback. It also adds `lowInfoHumanWaterPasses` as a positive target so natural low-info speech remains allowed.
- [x] Latest docs-only verification after the speech-contract follow-up passed: `node -e "JSON.parse(...long_running_tasks.json...)"`, `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` with LF/CRLF warnings only.
- [x] Follow-up soft director spec added implementation-facing fields `currentPressure`, `tableObjects`, `allowedSpeechMoves`, and `recentSurfaceMoves`, plus LLM/fallback/evaluator responsibility boundaries. This keeps the next implementation away from broad phrase bans and large if/else tables.
- [x] Latest docs-only verification after the soft-director spec follow-up passed: `node -e "JSON.parse(...long_running_tasks.json...)"`, `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` with LF/CRLF warnings only.
- [x] Ordinary user-feedback validator/fallback pass: converted the user's latest transcript complaints into focused regressions and narrow fixes for meta-audit openers, first-seat future homework, peace-night public-common-sense attacks, empty micro-moves, confused later-chain wording, repeated/single `卡` surfaces, unresolved `没听明白...这部分我理解` endings, and peace-night `定义刀口/找女巫` rule lectures.
- [x] Ordinary fallback/prompt cleanup: ordinary prompt no longer recommends `卡一句 / 卡我的是`; provider-error fallback was shortened and removed `后面我看谁继续复读这个点` and `等他自己把立场落下来`.
- [x] Latest bounded real sample before the final local death-shape guard: `tmp/ordinary-mimo-phase2-day1-final-local-fix-real-20260609-233444.json`; 6 speech calls, 4 non-fallback, 2 provider-error fallback, 1 `death_cause_overclaim` quality issue. That issue is now covered locally, but no further paid rerun was made after the final guard.
- [x] Latest local verification for this pass: `npm run test -- src/ai/speechProviders.test.ts` passed, 1 file / 258 tests.
- [x] Ordinary public-source deep-dive follow-up: expanded `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md` with additional public-source calibration from Werewolf papers/datasets and Chinese role-speech guidance, then distilled a three-layer real-player rhythm: seat pressure/state, one local public table object, and a temporary handling action.
- [x] Added no-code implementation guidance for the next pass: preserve positive low-information water, prioritize self-defense/clarification when a seat is under question, and use a public role-state matrix for villager/wolf/seer/witch/hunter rather than fixed scripts or broad if/else branches.
- [x] Latest docs-only verification for the public-source deep-dive passed: `node -e "JSON.parse(...long_running_tasks.json...)"`, `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`, `npm run harness:long-tasks`, `npm run harness:check`, and `git diff --check` with LF/CRLF warnings only.
- [x] Added `src/ai/personaStrategyCards.ts` and tests for built-in model cards, custom AI inference, camp-layer adaptation, public live intent, anti-template move, and hidden-info redaction.
- [x] Wired ordinary persona strategy/live intent into `src/ai/speechProviders.ts` and `src/ai/actionProviders.ts`, including LLM inputs, prompt constraints, mock/fallback speech lead lines, and day-vote continuity requirements.
- [x] Extended `AiSeatMemory` plus `src/ai/seatMemory.ts` so speech, vote, and light night actions store internal live intent, target, public reason, commitment, and vote-continuity notes.
- [x] Added AI pool strategy summaries and a `刷新策略卡` entry for custom AI cards through `AiFriendOption`, `aiFriendStorage`, and `AiPoolClient`.
- [x] Fixed `AI_LLM_SPEECH_FALLBACK_PERSONAS=off` to truly disable persona fallback routing for real speech checks.
- [x] Verification: related Vitest files passed 5 files / 252 tests; targeted ESLint passed; default 9p ordinary simulation passed 10/10 games with 0 fallback decisions; `12p-sheriff-seer-witch-hunter-guard` simulation passed 10/10 games with 0 fallback decisions. Real Mimo-only LLM smoke was attempted with fallback disabled, but failed on external credentials: Mimo `401 Invalid API Key`.
- [x] Broader verification caveat follow-up: stale `.next` output was removed and the class-trial Mimo harness test `any` usages were replaced with explicit report/log types. `npx tsc --noEmit`, full `npm run lint`, and `npm run build` now pass; build still reports the existing Turbopack NFT trace warning. `.next` was removed again after build verification to avoid leaving a large local cache.
- [x] Ordinary AI speech-template follow-up: removed internal live-intent/template phrases from LLM prompt surfaces and mock/fallback speech, varied gold-water protection and evidence phrasing, and added regressions for the repeated ordinary scaffolding. Latest checked command: `npm run audit:ai -- --board=9p-seer-witch-hunter --games=1 --seed-start=91 --sample=1 --json --out=tmp/ordinary-ai-speech-audit-seed91-after-intent-surface-v4.json`; result completed with 0 fallback and 0 audit issues. Repeated mock fragments dropped from 16 to 8 on this seed, but mock prose still has residual generator phrases, so do not call subjective speech quality final. Real DeepSeek speech smoke with fallback disabled still failed externally with `402 Insufficient Balance`.
- [x] Ordinary real-Mimo speech follow-up: carried the class-trial anti-template mechanisms further into ordinary speech validation without replacing model personas. Added ordinary hard guards for low-info opening copy-paste, non-opening seats saying `我首置位`, repeated `压力源/只有观察点没结论` axes, stronger ordinary repair instructions, and claim parsing fixes for `我女巫` / concise witch save reports / `8号Kimi，预言家` style reports. Latest real Mimo report is `tmp/ordinary-mimo-real-speech-seed91-day1-after-repeat-fix.md` / `.json`: 9 speeches, 7 real non-fallback rows, fallback 2, `repeatedPressureSourceCount: 0`, repeated fragments none. No key was written to files; Mimo was used through temporary process env only.
- [x] Renamed fixed host/system audio assets in `public/audio/host` to Chinese content filenames and removed the English audio files after stopping the locking `JianyingPro.exe` process with user approval. Added `src/components/game/hostAudioFiles.ts` to map stable logic keys like `night-wolves` and `seat-1` to Chinese file paths, wired local and room host-audio cue construction through that mapping, and updated the host-audio generator/README so future generated clips use the same Chinese filename convention.
- [x] Local cleanup follow-up removed disposable build/cache output, old generated AI speech cache, and clean unused worktrees, freeing about 5.07 GB. Current retained large local state is intentional: `prisma/dev.db`, smaller `tmp`, current `public/audio/ai-speech`, and `local-assets`.
- [x] Verification for the audio rename: host audio cue regression passed, `npm run audio:host -- --dry-run --only=night-wolves,seat-1,speak` prints Chinese output names, `rg` found no old `/audio/host/<english>.mp3` references, and `public/audio/host` contains no English-named audio files other than `README.md`.
- [x] Fixed the latest D1 1号苗木诚 reports 3号金水 / 2号雾切响子 responds failure. Root cause: the LLM and validators still allowed a D1 gold-water check to be attacked as "why check 3号 / result is incomplete /提前保护金水票型". The speech pipeline now treats self-owned check-result/gold-water wording as a hard seer claim, tells observers not to demand D1 first-check motive, and rejects "reporting gold water then leaving the gold water out of today's outing focus is over-protection" framing. Regression coverage includes the exact screenshot wording and preserves valid planned seer counterclaim black-check speech.
- [x] Verification for this follow-up: `npm run test -- src/ai/speechProviders.test.ts -t "keeps planned Monokuma counterclaim"`, `npm run test -- src/ai/speechProviders.test.ts -t "check-result gold-water"`, `npm run test -- src/ai/speechProviders.test.ts`, `npm run test -- src/game/claims.test.ts`, `npm run test -- src/components/game/aiSpeechAudio.test.ts`, targeted `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts`, and `git diff --check` passed. `npx tsc --noEmit` is blocked by existing malformed `.next/dev/types/routes.d.ts`, not by these source edits.
- [x] Ran repeated real full-game Mimo harness checks with temporary process env only. No key was written to files.
- [x] Latest full-game evidence: `tmp/class-trial-mimo-full-game-1780746535599.md` / `.json`; `GAME_OVER` on D2, good side won, `fallback: 1`, `speechFallback: 1`, `actionFallback: 0`, providers all Mimo.
- [x] Practical stop decision: the game is currently completable/playable end-to-end, but chasing the last D1 黑白熊 speech fallback via repeated real full-game runs is too expensive. Continue later with targeted replay/unit tests or transcript review, not broad Mimo full-game reruns.
- [x] Targeted local follow-up: reproduced the latest D1 黑白熊 raw shape through `createConstrainedLlmSpeechProvider` and fixed the normalization path. For class-trial hard-info speeches, sentence limiting now preserves planned identity/check/vote-boundary sentences instead of blindly keeping the first 6 sentences and dropping `我是预言家，昨晚查验结果是1号苗木诚查杀...`.
- [x] Full-game Mimo follow-up: quoted third-party seer claims no longer make an observer satisfy the speaker's own seer black-check finality contract. This targets the D1 高松灯 raw output that was usable but got rejected after quoting 黑白熊's `我是预言家...查杀`.
- [x] Full-game Mimo follow-up: post-speech challenge timeline validation now checks missing-response wording sentence-by-sentence, preventing a sentence about 5号江之岛盾子 `没接这个点` from being stitched to a separate 3号腐川冬子 reference.
- [x] Full-game Mimo follow-up: explicit long-run retries can exceed the old 3-retry ceiling. `AI_LLM_MAX_RETRIES=6` now gives 7 total attempts; default remains 2 attempts, and `AI_LLM_MAX_RETRIES_CAP` can bound high settings.
- [x] Verification for this follow-up: `npm run test -- src/ai/speechProviders.test.ts -t "Monokuma"` passed, 3 focused tests; `npm run test -- src/ai/modelLlms.test.ts src/ai/speechProviders.test.ts src/game/seerGoldHide.test.ts src/ai/tableRead.test.ts` passed, 4 files / 253 tests; `npx tsc --noEmit` passed.
- [ ] Fresh real full-game Mimo rerun remains intentionally skipped for cost control. Do not copy chat-provided keys and do not write keys to `.env`; rerun only if the user explicitly approves another real full-game spend, with temporary process env only.
- [x] Locked class-trial fixed roles to the user-approved mapping: 苗木诚=SEER, 雾切响子=WITCH, 腐川冬子=VILLAGER, 黑白熊/江之岛盾子/塞蕾丝缇雅=WEREWOLF, 十神白夜=HUNTER, 高松灯/千早爱音=VILLAGER.
- [x] Wired fixed seat-role overrides through `GameClient`, `gameClientRequests`, `/api/games`, `gameService`, and `createGame()`, with role-multiset validation in the engine.
- [x] Preserved `classTrialVoiceProfile` through `/api/games` role-card input so browser-created games do not lose structured character guidance.
- [x] Updated `tmp/class-trial-d1-all-speeches-score.mjs` to use the fixed lineup and accepted D1 scenario where 苗木诚 checks 6号塞蕾丝缇雅 as wolf.
- [x] Added hard validation for planned SEER checks regardless of true role or loose strictness, fixing the black-white bear counterclaim case where the plan said `1号查杀` but the generated text omitted the claim.
- [x] Added public black-check relation fallback states so later speakers do not ask already-spoken checked seats to answer again and do not incorrectly return to an older checked-seat axis.
- [x] Added role-specific hard-info fallback exits for Monokuma/Naegi seer claims, Celestia checked response, Togami hunter claim, Fukawa/Kirigiri early black-check relation, and Tomori/Anon late relation pivots.
- [x] Added local attempt diagnostics to the D1 all-speech scoring script output so fallback-heavy reports show per-attempt provider issue, validation errors, and raw-output previews.
- [x] Reran the fixed D1 diagnostic sample: `tmp/class-trial-d1-all-speeches-score-1780652739209.md` / `.json`; 9 speeches, 9 fallback, average 83, quality sample 0. All 18 LLM attempts failed with DeepSeek `402 Insufficient Balance`, before any parse or validation stage.
- [x] Tested Mimo with a temporary process env route, not persisted to `.env`: `tmp/class-trial-d1-all-speeches-score-1780653397137.md` / `.json`; 9 speeches, 4 fallback, average 86, `viewerQuality pass=4 warn=1` across 5 non-fallback rows. Non-fallback Mimo speech showed stronger character voice, while remaining failures were validator/contract issues to address later.
- [x] Switched class-trial fixed friends to `mimo-logic-checker` and changed the current class-trial visible runtime label to `真实 LLM · Mimo-v2.5-pro`.
- [x] Fixed class-trial action routing so repair attempts use the actual seat persona instead of hard-coding `DeepSeek`; class-trial action and speech repair now stay on Mimo when the fixed theme uses Mimo.
- [x] Post-code Mimo D1 fixed-scenario sample: `tmp/class-trial-d1-all-speeches-score-1780654895988.md` / `.json`; 9 speeches, 4 fallback, average 83, `viewerQuality pass=4 warn=1` across 5 non-fallback rows, all non-fallback providers on `mimo-speech:mimo-v2.5-pro`.
- [x] Added `tmp/class-trial-mimo-full-game.mjs` and ran a full game with temporary process env secrets only: `tmp/class-trial-mimo-full-game-1780655742482.md` / `.json` completed to `GAME_OVER` on Day 4, wolves won by `所有平民出局`, with 41 Mimo actions, 24 Mimo speeches, 0 action fallback, and 6 speech fallback.
- [x] Added hard validation for class-trial speeches that end mid-thought without a sentence close, after the full-game sample exposed a non-fallback Anon line ending at `塞蕾丝缇雅，你那句`.
- [x] Mimo routing/UI/truncation focused verification passed: `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` (6 files / 265 tests).
- [x] Final verification passed: `npx tsc --noEmit`, `npm run lint`, `node --check tmp/class-trial-mimo-full-game.mjs`, `npm run build`, `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md`, `npm run harness:check`, and `git diff --check`. Build still reports the existing Turbopack NFT trace warning; diff check reports CRLF warnings only.
- [x] Fixed a validator false negative for natural true-seer black-check treatment: Mimo wording such as `今天她必须正面接这个结果，全桌怎么处理她，就从她自己的回应开始` now counts as today's treatment instead of being rejected as `预言家查杀缺少今天如何处理查杀位`.
- [x] Post-fix Mimo D1 sample `tmp/class-trial-d1-all-speeches-score-1780662175071.md` / `.json`: 9 speeches, 6 fallback, average 85, quality sample 3, `viewerQuality pass=3`. 苗木诚 is non-fallback Mimo output with score 93; remaining fallbacks are mainly model behavior failures against existing hard constraints.
- [x] Post-truncation-validator full-game Mimo rerun `tmp/class-trial-mimo-full-game-1780662562076.md` / `.json`: completed to `GAME_OVER` on Day 2, wolves won by `所有神职出局`, 24 Mimo actions, 14 Mimo speeches, 0 action fallback, 1 speech fallback, and no dangling/truncated speech endings found by scan.
- [x] Latest fallback-heavy sample: `tmp/class-trial-d1-all-speeches-score-1780651610416.md`; 9 speeches, 9 fallback, average 83, no anti-template findings. Treat as regression evidence for fallback shape only.
- [x] Latest verification passed: targeted aggregate 8 files / 375 tests, `npx tsc --noEmit`, `npm run lint`, `npm run build`, task-card gate, harness check, and `git diff --check` with CRLF warnings only.
- [x] Latest class-trial D1 speech-quality pass reached the current non-fallback target: `tmp/class-trial-d1-all-speeches-score-1780643618268.md`; 9 speeches, 5 fallback, average 83, quality sample 4 non-fallback speeches, `viewerQuality pass=4`, and no non-fallback anti-template findings.
- [x] Added same-follower dogpile prevention after public black checks: after multiple speakers already attack the same follower on the same `standard / two-sided / fake-focus` point, later speakers are steered and validated to change target or attack the person repeating.
- [x] Added checked-seat peaceful-night protection: a public black-check target is steered and validated away from reusing `平安夜/女巫用药/药线` while answering the check.
- [x] Added late black-check inventory-recap protection: later speakers are steered and validated away from recap-style `平安夜 -> 苗木 -> 雾切 -> 腐川 -> 黑白熊` summaries and toward one concrete target/action.
- [x] Updated report-only quality scoring so valid follower pivots, including direct-address plus pronoun continuation, are not incorrectly flagged as `black_check_axis_repeat`.
- [x] Latest verification passed: 8-file class-trial aggregate / 253 tests, persona JSON parse, `npx tsc --noEmit`, `npm run lint`, and `npm run build` with the existing Turbopack NFT trace warning.
- [x] Latest follow-up fixed the repeated public black-check conversation shape: after the checked seat has answered and multiple followers repeat the same `首跳查杀/查杀位自证` axis, later speakers are now steered and validated toward follower pressure, rescue behavior, focus-locking, or character-specific reaction instead of asking the same checked-seat question again.
- [x] Added a hard Kirigiri relation guard for D1 class-trial: before the checked seat answers an unopposed first black check, Kirigiri should not pressure the claimant with `票压/锁票/站不站得住/我不跟` language. That line reads like protecting 3号; the detective-consistent move is to hold the claim provisional and cut to the checked seat / later table reactions.
- [x] Added hard validation and retry repair instructions for two anti-template failures: late speakers replaying the same black-check axis, and late speakers continuing the same checked-seat self-proof question after several followers already asked it.
- [x] Updated `analyzeClassTrialSpeechQuality()` so a speaker who calls out the table for repeating the same black-check axis is not itself marked as `black_check_axis_repeat`.
- [x] Latest real D1 report after these guards: `tmp/class-trial-d1-all-speeches-score-1780620247379.md`; 9 speeches, 5 fallback, average 77, quality sample 4 non-fallback speeches, `viewerQuality pass=3 warn=1`, and no non-fallback `unearned_claimant_pressure`. Fallback remains out of scope per user direction.
- [x] Latest verification passed: `src/ai/classTrialLiveState.test.ts` 9 tests, `src/ai/speechProviders.test.ts` 154 tests, `src/ai/classTrialSpeechQuality.test.ts` 9 tests, the 8-file class-trial aggregate / 223 tests, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [x] Corrected the black-check hard-information relation frame after user review: when an unopposed first seer black-check is public, Kirigiri / good observers should not pressure the claimant or criticize `首验理由` / `票压太满`; they should hold the claimant provisional, force the checked seat to answer, and watch counterclaims, rescue, or public rewrites.
- [x] Updated wolf-teammate black-check live-state guidance so wolves do not all borrow the same claimant-pressure axis; the move now turns to the checked teammate's response and who rescues too quickly.
- [x] Added `unearned_claimant_pressure` and `black_check_axis_repeat` report-only quality findings, plus live-state repetition avoidance for repeated `首跳查杀/票压太死/顺序太干净` framing.
- [x] Fixed black-check target-response validation so natural claimant references such as `苗木同学，你查杀我？我不认` count as answering the public black check.
- [x] Updated local Kirigiri and Enoshima profile reactions so Kirigiri does not look like she is shielding the checked seat by attacking the first seer, and Enoshima does not keep using the same black-check line as her stage prop.
- [x] Latest focused verification passed: class-trial live-state tests, speech-quality tests, Fukawa-focused speech-provider tests, the 8-file class-trial aggregate / 218 tests, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [x] Latest evidence: a direct 1-3 raw probe produced non-fallback Kirigiri and Fukawa lines in the corrected direction; full report `tmp/class-trial-d1-all-speeches-score-1780588824661.md` had 5 fallback rows, so it is useful as a regression signal but not final subjective proof.
- [x] Follow-up testing found and fixed a wiring bug: the local persona JSON contained first-batch `classTrialVoiceProfile` data, but `src/game/aiFriends.ts` stripped that field during friend resolution, so earlier prompts still used legacy role lens text.
- [x] Updated `sanitizeAiCharacterRoleCard()` and added `src/game/aiFriends.test.ts` coverage so class-trial role voice profiles survive `resolveAiFriendsForGame()`, `createGame()`, and `buildAgentView()`.
- [x] Reran the fixed D1 sample after the sanitizer fix: `tmp/class-trial-d1-all-speeches-score-1780586047863.md`; Kirigiri, Fukawa, and Enoshima were all non-fallback with `viewerQuality: pass`, `characterPresence: strong`, and live intent present.
- [x] Follow-up subjective read corrected the prior sample interpretation: Kirigiri pressuring Naegi's over-tight vote framing after an unopposed first black-check is not detective-like enough, because it can read as protecting 3号. The corrected target is the checked seat's response and the table's later reactions.
- [x] Follow-up verification passed: 8 focused files / 211 tests, `npx tsc --noEmit`, `npm run lint`, and `git diff --check` with CRLF warnings only.
- [x] Added structured `classTrialVoiceProfile` data for `kirigiri`, `fukawa`, and `enoshima` only; Tomori and the rest of the theme pack remain untouched for this first migration batch.
- [x] Extended role-card types and class-trial persona sanitization so first-batch personality core, value bias, reaction tendency, overuse bans, scenario reactions, alignment reactions, and dramatic boundaries reach the AI speech pipeline.
- [x] Added `formatClassTrialRoleVoiceProfile()` and rewired the class-trial persona director/freeform speech guide to prefer structured role profiles over legacy fixed role-texture scripts.
- [x] Updated migrated role lens text so Kirigiri, Fukawa, and Enoshima are not pushed back into a single repeated action label such as `冷静切证词`, `先防御/刺一句`, or `结构/收益`.
- [x] Added `ClassTrialLiveState` with live intent, pressure, target, public move, character impulse, risk, and repetition avoidance; the LLM now sees a current in-table action instead of only a generic style contract.
- [x] Added report-only `analyzeClassTrialSpeechQuality()` so the sample report can say a line is hard-valid but viewer-quality failed, with concrete evidence and revision direction.
- [x] Updated `tmp/class-trial-d1-all-speeches-score.mjs` to surface viewer-quality and anti-template findings while excluding fallback rows from quality aggregation.
- [x] Latest fixed D1 report: `tmp/class-trial-d1-all-speeches-score-1780580906170.md`; 9 speeches, 7 fallback, average 78, quality sample 2 non-fallback speeches, `viewerQuality pass=2`, no non-fallback anti-template findings. Fallback remains deliberately ignored for this pass.
- [x] Verification passed: focused class-trial tests 7 files / 201 tests, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md`, `npm run harness:check`, and `git diff --check` with CRLF warnings only.
- [x] Tried the approved LLM-only class-trial speech experiment: the initial class-trial LLM input no longer exposes decision/audit scripts (`speechPlan`, `constraints`, contract must-say/must-not-ask text, table tasks, expert strategy, reasoning frames, claim audit, debate agenda). Backend validation, retry repair, and fallback remain available but are not used as the target quality metric for this pass.
- [x] Answered the root-cause question for renewed `首验理由` attacks: they were primarily generated by the LLM's own Werewolf priors after script stripping, not by an explicit table-task instruction. Raw DeepSeek output independently produced `选3号查验的依据是什么`, `凭什么查杀我`, and `为什么首验摸到3号`.
- [x] Fixed the LLM correction route without restoring the old template layer: retry repair now tells the LLM to move away from night-selection-process attacks and onto `查杀位如何回应`, `有没有预言家对跳`, `这条查杀今天怎么处理`, or `谁公开和结果对撞`.
- [x] Removed the copyable system phrase `D1不需要解释首验理由`; the system guidance now says D1 seer speech only needs identity, check result, and today's treatment, reducing prompt-to-dialogue leakage.
- [x] Relaxed explicit black-check validation so natural wording like `昨晚查验了3号腐川冬子，结果是狼人。所以腐川是我的查杀` is accepted as a valid black check.
- [x] Latest real D1 sample for this LLM-only pass: `tmp/class-trial-d1-all-speeches-score-1780567243006.md`; 苗木诚 is non-fallback real DeepSeek output and the non-fallback speeches no longer use `首验理由/为什么验3号` as their attack axis. Remaining LLM weakness is short/weak role action for 雾切、高松、爱音.
- [x] Verification passed: related focused AI/claims tests 6 files / 221 tests, `npx tsc --noEmit`, and `git diff --check` with CRLF warnings only.
- [x] Root-caused the screenshot-level 苗木诚 problem to layer leakage, not wrong seer knowledge: `tableRead` generated output-facing `talkingPoints` / `tableTask.line` like `我的查杀不是可商量观察` and `他发言只影响别人怎么接，不改变我这条结果`, and `speechProviders` fallback/contract still carried `降温/轻放` wording, so the LLM paraphrased those internal constraints into unnatural seer dialogue.
- [x] Replaced the true-seer black-check contract and fallback with first-person role actions: jump seer, state the checked wolf, place today's vote on the checked seat, and ask defenders to publicly collide with the result. D1 first-check handling now stays as a prohibition against asking for first-check reasons instead of becoming dialogue material.
- [x] Added regressions in `src/ai/tableRead.test.ts` and `src/ai/speechProviders.test.ts` so `可商量观察/降温/观望/他发言只影响别人怎么接/不改变我这条结果/不要只报结论/轻放` cannot return as seer black-check output material.
- [x] Latest real D1 all-seat sample: `tmp/class-trial-d1-all-speeches-score-1780556324868.md`; 9 speeches, 3 fallback, average 85. 苗木诚 was non-fallback DeepSeek output, score 86, and no longer says the screenshot's neutral-observer line.
- [x] Latest verification passed: targeted seer black-check tests, related focused AI/claims tests 6 files / 220 tests, `npx tsc --noEmit`, and `git diff --check` with CRLF warnings only.
- [x] Latest first-person POV repair pass made true seer black checks speak from the seer's own certain result and vote instead of neutral table-observer wording; checked-seat fallback now answers the black check directly.
- [x] Added regressions rejecting `外置更硬信息/先别急着放过去`, repeated global `如果查杀位是好人谁收益`, D1 `验人心路/验人顺序` attacks, report-only peaceful-night speeches, and second-person homework to already-spoken seats such as `需要你后续补上`.
- [x] Tightened class-trial claim extraction so references like `3号就是查杀位` and `这张牌拍在桌上` do not become new self seer/witch claims.
- [x] Naturalized fallback gap wording by removing `平安夜药线/身份声明边界` phrasing from class-trial fallback output.
- [x] Latest real D1 all-seat sample after this pass: `tmp/class-trial-d1-all-speeches-score-1780553043282.md`; 9 speeches, 2 fallback, average 79. The original global POV, first-check motive attack, peaceful-night report-only, and no-trigger Fukawa/Togami drift are gone; remaining follow-up is role texture/action depth for 雾切、塞蕾丝、高松 and reducing fallback rate.
- [x] Latest verification passed: related focused tests 6 files / 220 tests, `npx tsc --noEmit`, and `git diff --check` with CRLF warnings only.
- [x] Latest pass removed remaining visible class-trial audit-player wording from upstream LLM materials in `advancedReasoning`, `claimAudit`, `tableRead`, and `speechProviders`; labels now steer toward public actions/reasons rather than `审计/身份线/票口/闭合` wording.
- [x] Added D1 black-check regressions for non-seer/checked-seat `今晚验谁`, `闭合/闭环`, peaceful-night/witch-use becoming a main attack, and first-check motive variants such as `验人选择逻辑`, `怎么摸到`, and `补验人依据`.
- [x] Latest real D1 all-seat sample after this pass: `tmp/class-trial-d1-all-speeches-score-1780547769642.md`; 9 speeches, 1 fallback, average 85. Real LLM speeches no longer used the old first-check-reason attack in the final sample; 十神、高松、爱音 remain the main role-texture follow-up candidates.
- [x] Latest verification passed: related focused AI tests 6 files / 215 tests, `npx tsc --noEmit`, and `git diff --check` with CRLF warnings only.
- [x] Added `docs/tasks/2026-06-class-trial-freeform-speech-quality.md` as the executable task card for the user-reviewed transcript quality issues.
- [x] Reframed the class-trial speech target from "characters speak like skilled Werewolf players" to "characters stay themselves while participating in a Werewolf incident"; current priority is role authenticity, public table participation, de-templating, basic logic, then inference strength.
- [x] Updated `src/ai/classTrialPersonaDirector.ts`, `src/ai/classTrialSpeechDirector.ts`, `src/ai/classTrialCharacterLens.ts`, and `src/ai/speechProviders.ts` so repeated class-trial pressure pivots into character actions such as hope checks, testimony cuts, trial taunts, despair/guise reads, wagers, qualification lines, voice breaks, or relationship chains instead of one shared logic-auditor voice.
- [x] Updated fallback gap wording so class-trial repair lines avoid stitched phrases like `身份这句话还没说清没有闭合`.
- [x] Generated the latest real D1 all-seat sample `tmp/class-trial-d1-all-speeches-score-1780490992573.md`: 9/9 speeches, 0 fallback, average 75 under the revised role-first scoring lens.
- [x] Root-caused the bad `首验理由/女巫用药` attack direction to public-state rules leaking into speech: natural wording like `查了3号腐川冬子——她是狼人` was not parsed into `claimBoard.checks`, creating `预言家声明缺少验人`; peaceful-night `女巫用药` guidance could also be promoted from background reasoning into an attack axis.
- [x] Updated `src/game/claims.ts` so characterful named-target/pronoun-result seer checks are extracted as public checks.
- [x] Updated `src/ai/speechProviders.ts` so D1 no-guard peaceful-night `女巫用药` can be mentioned as public death-shape reasoning but is rejected when used as the main attack point.
- [x] Removed D1 `首验理由/选人理由/公开依据/连心路都省了` as a main attack axis and stopped prompting true seer black-check speeches to actively explain why they picked the first target.
- [x] Root-caused the D1 issues to hard-information turns being treated like low-information class-trial openings: 苗木 could stop at the black-check result, 腐川 could avoid the check and drift to 十神 flavor, and stale stock wording could survive across death shapes.
- [x] Updated `src/ai/tableRead.ts` so class-trial true seer black-check plans require explicit target/result and vote-boundary reasoning without making first-check motive mandatory.
- [x] Updated `src/ai/tableRead.ts` so a seat publicly under black check gets a direct response plan before any unrelated character flavor.
- [x] Updated `src/ai/speechProviders.ts` with dynamic hard-information limits, stronger `claim_black_check` must-say items, explicit `查杀` validation, checked-seat reply validation, D1 first-check motive rejection, prompt/meta leak rejection, non-peaceful death stale phrase rejection, and conservative Fukawa/Togami public-trigger gating.
- [x] Updated hard-information fallbacks so provider failure produces a direct seer black-check or checked-seat response instead of low-information opening text.
- [x] Updated class-trial lens fallback wording from `身份那句话少了前提` to less stitched identity-boundary wording and removed `没说清` fallback patterns that were misread as asking already-spoken seats to speak again.
- [x] Added regressions in `src/ai/tableRead.test.ts` and `src/ai/speechProviders.test.ts` for seer black-check plans, checked-seat responses, dynamic hard-info limits, explicit check wording, prompt leak rejection, non-peaceful death wording, and Fukawa/Togami trigger boundaries.
- [x] Verification passed: related AI/game tests, `npx tsc --noEmit`, `npm run lint`, task-card gate, harness check, and `git diff --check`.
- [x] Final real D1 sample for this pass: `tmp/class-trial-d1-all-speeches-score-1780498805293.md`; it no longer uses the old `首验理由/女巫用药` main-axis failure or `身份那句话少了前提`, but stricter rejection increased fallback to 4/9 and average fell to 78.
- [x] Follow-up de-template material pass removed class-trial internal audit wording from hard-info plans, repair instructions, fallback gap wording, table briefing labels, and post-speech challenge themes.
- [x] Latest real D1 sample after the de-template pass: `tmp/class-trial-d1-all-speeches-score-1780505837274.md`; 9/9 real LLM speeches, 0 fallback, average 91, with no sample hits for `票口边界` / `外置硬身份反证` / `起跳收益` / `身份动作` / `公开边界` / `首验理由` / `验人理由`.
- [x] Reworked class-trial death-shape speech guidance so AI can infer potion state, knife targets, and poison targets from public death announcements plus board rules without pretending to have private night knowledge.
- [x] Removed the public-death `有夜死时不能确认女巫用药` validation branch and relaxed knife/poison-mouth validation for targets already present in the public death list.
- [x] Kept private boundaries for invented witch identity, invented rescue target, and fake self-witch status leaks.
- [x] Updated table memory, table-read tasks, inference layers, role playbooks, advanced reasoning, and debate agenda prompts from “do not say this conclusion” to “say the public evidence source.”
- [x] Added regressions proving day-one single-death public reasoning about `女巫没救/没用药`, knife target, and poison-mouth overlap passes validation.
- [x] Verification passed: affected Vitest files, `npx tsc --noEmit`, `npm run lint`, full `npm run test` (89 files / 851 tests), and `npm run build` with the existing Turbopack NFT trace warning.
- [x] Added `docs/superpowers/specs/2026-06-02-room-vote-and-class-trial-rules-design.md`, `docs/superpowers/plans/2026-06-02-room-vote-and-class-trial-rules.md`, and `docs/tasks/2026-06-room-vote-class-trial-rules.md`.
- [x] Added `src/server/roomAdvance.ts` with bounded host advancement and trace output; `src/server/roomService.ts` now uses it outside `DAY_VOTE`.
- [x] Added room API coverage proving host continue can reach speech and resolve a vote, and improved `scripts/room-action-smoke.mjs` diagnostics for base URL, timeout, and recent steps.
- [x] Added class-trial theme flow labels/details and wired the table/flow model so hidden night labels are minimized and trial steps become the main status.
- [x] Added class-trial persona director guidance that allows low-information character texture while preserving private-knowledge and system-prompt leak guards.
- [x] Focused verification passed: room advance/API tests 2 files / 23 tests; class-trial UI/model tests 4 files / 48 tests; class-trial AI director tests 3 files / 140 tests.
- [x] `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed; build kept the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- [x] Local room vote smoke passed on `http://127.0.0.1:3000`: `coveredActionTypes` included `seerCheck`, `witchAction`, `speak`, and `vote`; `voteResolved` was `true`.
- [x] Local room SSE smoke passed on `http://127.0.0.1:3000` with lobby, join, and start events.
- [x] In-app browser verification confirmed the class-trial main status uses `闭庭整理` during hidden night and `证言审理` during day speech; screenshot saved to `tmp/class-trial-room-vote-rules-visual.png`.
- [x] Added `docs/superpowers/specs/2026-06-02-class-trial-system-architecture-design.md`, `docs/superpowers/plans/2026-06-02-class-trial-system-architecture.md`, and `docs/tasks/2026-06-class-trial-system-architecture.md`.
- [x] Added `src/game/phaseSemantics.ts` and reused it from `src/game/projection.ts` and `src/server/roomService.ts`.
- [x] Added `src/game/voteSnapshot.ts` and moved public recent vote, day-vote sealed progress, day-vote reveal, and sheriff vote snapshot helpers out of projection.
- [x] Added `src/components/game/classTrialVotePresentation.ts`; `ClassTrialVoteStage` and `ClassTrialGameTable` now share the same sealed/reveal vote presentation model.
- [x] Added `src/components/game/classTrialFlowModel.ts`; `GameClient` now gates class-trial intro, opening-night curtain, auto-advance, host audio, AI audio, and voice prewarm through one model.
- [x] Added `src/components/game/classTrialTableModel.ts`; class-trial table focus, night state, host label, active audio speaker, and vote ring state are computed outside JSX.
- [x] Added `src/ai/classTrialSpeechDirector.ts`; class-trial self-introduction, dialogue rewrite, low-info opening, final-speaker, and repeated-focus director guidance moved out of `speechProviders.ts`.
- [x] Verification passed: targeted aggregate Vitest 12 files / 324 tests; room API test 1 file / 19 tests; `npx tsc --noEmit`; `npm run lint`; `npm run build`.
- [x] Local HTTP/API smoke passed on `http://127.0.0.1:3000`; room SSE smoke passed with `ROOM_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:room-sse`.
- [x] `npm run smoke:room-action:vote` was investigated but did not complete. Root cause for first failure was default port 3003 versus running server on 3000; after correcting and trying a mock 3003 production server, manual tracing showed timeout after `NIGHT_WOLVES -> NIGHT_SEER` in the existing room AI night-advance path.
- [x] Added `docs/tasks/2026-05-class-trial-vote-burst-animation.md` for the vote burst animation slice.
- [x] Added reveal verdict metadata so class-trial reveal distinguishes `exile` from `no-exile`.
- [x] Added `ClassTrialVoteBurstOverlay` for sealed `TRIAL VOTE` / `封票开始`, public target `开票揭示`, and tied `未达成处刑` burst states.
- [x] Added table-level no-exile coverage so tied reveals do not focus any seat.
- [x] Added CSS-only red/black slash burst, scanline/pulse pressure, locked-seat stamp, and reduced-motion fallback.
- [x] Added `docs/tasks/2026-05-class-trial-vote-visualization.md` and `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md` for the vote visualization slice.
- [x] Added sealed vote progress fields (`eligibleSeatIds`, `lockedSeatIds`, `pendingSeatIds`) to the public vote snapshot and kept `votes`, `tally`, `leaders`, targets, and reasons hidden until reveal.
- [x] Added `ClassTrialVoteStage` for the sealed-progress HUD and one-shot reveal surface.
- [x] Wired `ClassTrialGameTable` to show per-seat `已锁票` / `等待中` chips during voting and a focused leading seat during reveal.
- [x] Updated class-trial vote/reveal copy to say targets stay sealed until the票箱 opens.
- [x] Browser verified `http://127.0.0.1:51631`: sealed vote showed `3 / 9`, `已锁票/等待中`, no arrows/targets; reveal showed `开票揭示`, tally rows, ledger rows, and focus seat.
- [x] Updated `feature_list.json`, `progress.md`, this handoff, and the task card with current evidence for `class-trial-vote-visualization`.
- [x] Added `docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md` as the executable task card for the public-speech evidence boundary.
- [x] Root-caused the user-reported `我暂时更信5号` symptom to `buildMemorySpeechPoint()` converting private `memory.trustedSeatId` directly into public talking points.
- [x] Added a red-green table-read regression where seat 5 is privately trusted but has not spoken and has no public evidence; the test first failed on `我暂时更信5号` and now passes.
- [x] Added `buildPublicTrustSpeechPoint()` to translate private trust into public evidence wording only when the trusted seat has visible public speech/check/claim/stance/mention/vote context.
- [x] Added a positive regression proving a publicly spoken trusted seat can still be referenced as public evidence, without turning the line into raw private trust.
- [x] Verified with focused table-read/speech-provider tests, memory-tagged engine tests, TypeScript, targeted ESLint, build, task-card gate, harness check, and whitespace check.
- [x] Fixed full lint by adding `tmp/**` to `eslint.config.mjs` global ignores; `npm run lint` now passes instead of scanning unrelated existing `tmp/chrome-class-trial-smoke` Chrome extension cache files.
- [x] Updated `feature_list.json`, `progress.md`, this handoff, and the task card with current evidence.
- [x] Added `docs/tasks/2026-05-speech-de-template-persona-layer.md` as the executable follow-up task card for reducing template feel in ordinary and class-trial AI speech.
- [x] Added `buildUniversalDeTemplateGuide()` so every speaker sees a shared prompt layer that names repeated empty phrases and suggests alternate public moves: identity benefit, vote motive, reaction gap, death shape, follow-pressure benefit, and verifiable condition.
- [x] Added ordinary Werewolf template-chain validation for obvious canned phrase combinations without hard-banning bluffing, pressure, `没站边/没票口`, or legitimate later-seat verification conditions.
- [x] Red-green tests first failed because ordinary speech input lacked `通用去模板` guidance and ordinary empty-template chains returned no validation error; they now pass.
- [x] Added `docs/tasks/2026-05-class-trial-role-pressure-addressing.md` as the executable follow-up task card for role-specific repeated pressure and public name/addressing.
- [x] Added `buildNameAwareAddressingGuide()` so ordinary and class-trial speech prompts prefer `2号雾切` / `5号江之岛` / `9号爱音` style references instead of only seat numbers.
- [x] Expanded repeated abstract-pressure detection around `缺口 / 没往下推 / 没给倾向 / 没给结论` and route the next prompt through the current class-trial role's pressure method.
- [x] Strengthened 江之岛盾子's lens as 超高校级的分析师: whole-table structure, reaction pattern, and benefit analysis before theatrical chaos.
- [x] Strengthened 腐川冬子's lens around 十神白夜: she reacts to who touches, ignores, protects, or pressures 十神 while still using public reasons.
- [x] Real Day 1 text sample `tmp/class-trial-day1-real-role-pressure-addressing-1780156628228.md` generated 9/9 DeepSeek speeches with fallback 0/9, templateHits 0, repeated pressure terms 3, and nameRefs 10.
- [x] Follow-up user review of `tmp/class-trial-day1-verification-1780157549436.md` found first-three speeches still felt empty/template-like rather than characterful.
- [x] Added `openingMove` to the class-trial character lens, with role-specific low-info openings for 苗木、雾切、腐川、黑白熊、江之岛、塞蕾丝、十神、高松、爱音.
- [x] Added low-info class-trial opening director guidance so early speakers make character actions instead of reporting `发言顺序 / 站边 / 票型`.
- [x] Added validators for greeting-only平安夜 openers, generic audit-frame openers, all-later-seat waiting, final-speaker future waiting, 腐川 missing 十神, and 江之岛 missing analyst structure.
- [x] Follow-up tests passed: `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` passed 2 files / 114 tests.
- [x] Fresh real DeepSeek text sample after the opening-persona follow-up now runs: `tmp/class-trial-day1-verification-1780195573037.md` generated 9/9 speeches, fallback 3/9 via role-specific fallback, templateHits 0, repeatedPressureTerms 4, nameRefs 11, Enoshima analyst signals 1, and Fukawa Togami refs 1.
- [x] Root-caused a sample-level low-info drift: `投票时形成闭环` was incorrectly treated as hard information because day-one hard-info detection matched bare `投`, which turned off the 腐川/江之岛 low-info guards too early.
- [x] Narrowed day-one hard-info detection in `src/ai/tableRead.ts` and `src/ai/speechProviders.ts` so future voting-review wording stays low-info, while concrete identity/check/票口/归票/出人/投X号 still counts as hard progress.
- [x] Added role-specific class-trial low-info fallback lines so validation fallback no longer pressures unspoken seats and still preserves 苗木共同验证点、雾切冷静切片、腐川十神情绪坐标、江之岛结构/收益/伪装 signal.
- [x] Browser/game QA on `http://127.0.0.1:3005` completed a full Day 1 class-trial run and saved `tmp/class-trial-browser-qa-1780197058323.md` plus screenshot `tmp/class-trial-browser-qa-3005-current.png`.
- [x] Browser QA found the role layer is noticeably better but the live table still repeated `1号没给倾向/缺口` too often; GPT-SoVITS was unavailable at `127.0.0.1:9880`, so this pass could not judge audible voice quality.
- [x] Follow-up hardened repeated empty-stance/empty-gap guidance so a repeated `没给倾向/缺口` line cannot stay the main axis; it must turn into收益、身份成本、票型成本或反应差.
- [x] Follow-up made 苗木 low-info fallback more characterful by adding a `希望/共同验证` beat instead of only leaving a bare verification hook.
- [x] Follow-up dialogue-persona pass added class-trial台词化转译 guidance: Werewolf terms like `站边/票口/闭环/缺口` are internal scaffolding and should be spoken as character lines.
- [x] Added class-trial validation for terminology overload, room-greeting low-info openings, and speech-order-as-system-puzzle openings.
- [x] Added broad 腐川 role-texture validation plus fallback moves that keep 十神 present even after validation fallback; fallback gap normalization now turns identity-audit wording into `身份这句话还没说清`.
- [x] Fresh real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780198915715.md`: 9 speeches, fallback 2, templateHits 0, repeatedPressureTerms 0, nameRefs 8, Enoshima analyst signals 2, Fukawa Togami refs 1.
- [x] Follow-up verification pass tightened residual sample regressions: non-Celestia `筹码` spread, process-checklist lines around `后置位整体/发言顺序校验`, first-seat homework and full-round waiting, negative no-ticket wording closing low-info too early, and `等后置位谁先动再回头看`.
- [x] Added repeated-motif director guidance for `框架滑移/话滑空转` and `平安夜催票复读`; 苗木 low-info fallback now uses `谁把不确定说成确定` instead of the copied `借平安夜催票` phrase.
- [x] Tightened 江之岛 low-info validation so bare `裂口/谁最受益` no longer counts as analyst structure; she now needs analysis, structure, reaction pattern, benefit path, or disguise signal.
- [x] Fresh real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780200902521.md`: 9 speeches, fallback 1, templateHits 0, repeatedPressureTerms 1, nameRefs 7, Enoshima analyst signals 2, Fukawa Togami refs 1. The final observed `等第一轮走完后` variant is covered by a post-sample regression.
- [x] Latest follow-up added regressions for first-seat workflow hosting (`下一位先听你的`, `等所有人发完言后`, `后置位的各位等你们发言时`), future-identity deferral (`等后面有人拍身份再调整`), class-trial jargon bundles, unpublicized `验人线`, and role-claim attribution hallucinations like `4号和5号也先后自称猎人`.
- [x] Latest focused AI tests passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts` passed 3 files / 171 tests.
- [x] Latest real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780213850241.md`: 9 speeches, fallback 0, templateHits 0, repeatedPressureTerms 4, nameRefs 9, Enoshima analyst signals 1, Fukawa Togami refs 1. The final observed `后置位的各位，等你们发言时` variant is covered by a post-sample regression.
- [x] Added `thinkingPortraitUrl` / `hasThinkingPortrait` to the local class-trial pack manifest model and complete-pack validation.
- [x] Generated 9 local ignored transparent thinking-pose PNGs under `local-assets/class-trial-pack/thinking-portraits` and updated ignored `manifest.json` to reference them.
- [x] Updated `ClassTrialGameTable` to show the speaker's thinking portrait while class-trial voice/text preparation is loading/waiting, then use the normal portrait for spoken playback.
- [x] Added visible `1号` through `9号` badges to all class-trial podiums.
- [x] Added class-trial-themed host/system cue keys while reusing existing Werewolf broadcast clips.
- [x] Preserved Monokuma's distinctive short laugh in Japanese TTS rewrite (`噗/噗噗` -> `うぷぷ`), instead of treating it as removable filler.
- [x] Added Day 2+ class-trial guidance and validation to block repeat self-introductions, and removed `我是...` from the class-trial lens fallback prefix.
- [x] Follow-up tightened self-introduction policy from “Day 2+ no intro” to “only first-day morning can naturally introduce”; later class-trial speech explicitly says the first-day introduction window has ended.
- [x] Follow-up removed the generic “可以按座位名报自己是谁” speech prompt and added anti-template guidance for `身份-信息-站边-票口` flow, `我是闭眼好人`, and `信息不多先听后置`.
- [x] Follow-up class-trial validation rejects generic Werewolf speech openings as `学级裁判发言过于模板化`.
- [x] Follow-up speech contract now carries Day 2+ no-self-introduction plus anti-`身份-信息-站边-票口` / `我是闭眼好人` bans in `speechContract.mustNotAsk`, the highest-priority LLM constraint.
- [x] Follow-up lens audit proves all 9 fixed class-trial characters receive distinct behavior-lens cadence and推进动作 guidance rather than one shared Werewolf template.
- [x] Follow-up fallback speech no longer opens Day 2+ class-trial fallback lines with a display-name beat like `雾切响子。`, while keeping role-specific emotion/logic.
- [x] Follow-up class-trial last words no longer start from `我是角色名`, while keeping 江之岛 anger/绝望 and 雾切无奈/理性.
- [x] Follow-up local 黑白熊 persona wording no longer says “仍像狼人杀玩家发言”; it now anchors him to public evidence and vote pressure.
- [x] Added class-trial last-words candidates with role emotion: 江之岛盾子 angry/dramatic, 雾切响子 resigned but rational, and no old generic `我出局前留核心视角` fallback.
- [x] Chrome headless smoke on `http://localhost:51625` confirmed ready local assets/personas, 9 visible seat numbers, 9 local avatars, and a real Day 1 speech-preparation DOM state using a thinking portrait URL with `data-portrait-state="thinking"`.
- [x] Added `getClassTrialDialogueFrameByProgress` for mapping audio progress to class-trial dialogue frames.
- [x] Added AI speech playback helpers for loading state, real `currentTime / duration` progress, and active-run guarded status patching.
- [x] Extended `AiSpeechAudioStatus` with optional playback progress fields and added table-facing `ClassTrialAudioTypewriterState`.
- [x] Updated `ClassTrialGameTable` to consume live AI speech and active audio typewriter state.
- [x] Kept the dialogue on full `正在思考/准备发言。` while GPT-SoVITS audio is generating.
- [x] Let active audio speaker state temporarily own the class-trial speaking focus after the game advances to the next speaker.
- [x] Updated `GameClient` to publish streaming TTS loading state and real audio playback progress into the class-trial table.
- [x] Added audio preparation stages for class-trial loading: `正在调取证言。`, `正在生成语音。`, and `准备播放。`.
- [x] Added a tiny prepared-audio promise cache keyed by speech key, with rejection cleanup.
- [x] Updated `GameClient` to start class-trial speech audio preparation before the delayed playback handoff and reuse the same promise when playback starts.
- [x] Added class-trial audio lookahead guards for single-`continue` start conditions, completed-key selection, and active-run consumption.
- [x] Added `submitContinueCommand` for non-streaming background continue requests.
- [x] Updated `GameClient` to start background class-trial lookahead after current speech audio playback begins; if the first background continue only reaches the next waiting speaker, it continues once more to generate that speaker's speech before prewarming audio.
- [x] Added active GPT-SoVITS weight tracking keyed by normalized base URL.
- [x] Skips repeated `/set_gpt_weights` and `/set_sovits_weights` calls when the same GPT/SoVITS paths are already active.
- [x] Returns per-control-endpoint `durationMs` and `skipped` flags from `switchGptSoVitsWeights`.
- [x] Logs sanitized `[class-trial-gpt-sovits]` timing JSON from `/api/ai-speech-audio` for rewrite, switch, TTS, write, cache-hit, skipped flags, and total request time.
- [x] Added class-trial rewrite metadata modes: `fast`, `cache`, and `llm`.
- [x] Added safe local rewrite templates for short explanation, vote, suspicion, and contradiction lines.
- [x] Added a process-local rewrite cache keyed by role id plus normalized Chinese source text.
- [x] Added `rewriteMode` to class-trial GPT-SoVITS timing logs.
- [x] Added effective AI runtime resolution that forces `class-trial` theme mode onto `llm` even when stored global runtime is `mock`.
- [x] Selecting `学级裁判主题局` now stores `llm` as the local AI runtime mode.
- [x] The home theme card and class-trial table chrome now display `真实 LLM · DeepSeek-v4`.
- [x] Class-trial visible continue and background audio-lookahead continue calls now send the effective runtime mode.
- [x] Class-trial fixed characters now keep character role cards and display names while using DeepSeek as the single base game brain.
- [x] Class-trial action repair attempts stay on DeepSeek instead of rotating to GPT/Claude/GLM persona fallbacks.
- [x] Class-trial speech repair attempts stay on DeepSeek instead of rotating to GPT/Claude/GLM persona fallbacks.
- [x] Root-caused empty DeepSeek outputs to `max_tokens` exhaustion: the provider returned `finish_reason: "length"`, all completion tokens as `reasoning_tokens`, and empty `message.content`.
- [x] A/B probe showed DeepSeek `thinking: disabled` is better for class-trial action/speech than continuing to raise token floors.
- [x] Set DeepSeek action/speech defaults to `thinking: disabled` with a normal 900 token floor.
- [x] Added regression tests proving DeepSeek action/speech send `thinking: disabled` while preserving the normal budget.
- [x] Ran a real routed DeepSeek probe that returned non-empty action and speech JSON text without printing secrets.
- [x] Added an exclusive GPT-SoVITS synthesis queue around weight switching and TTS generation.
- [x] Added a class-trial current-speaker voice prewarm cue using a short safe fast-rewrite line.
- [x] Updated `GameClient` to fire invisible prewarm requests while class-trial is waiting for the current AI speaker's `continue`.
- [x] Added deferred class-trial streaming chunk loading so local TTS chunks are not all generated at once.
- [x] Direct route smoke with Tomori and Kirigiri class-trial role cards returned `provider: gpt-sovits` wav URLs and serialized timing logs.
- [x] Root-caused 苗木诚 mid-speech gaps to per-chunk LLM Japanese voice rewrite latency rather than repeated GPT-SoVITS weight switching.
- [x] Added a whole-speech TTS chunk mode and enabled it for class-trial visible continues, so the dialogue can stream as text while audio is generated once from the final speech.
- [x] Kept ordinary/non-theme streaming TTS on the existing stable chunk behavior.
- [x] Strengthened class-trial role-card speech guidance so characters avoid generic Werewolf templates and use their role-card performance style within the same public-information boundary.
- [x] Added class-trial timed visible text fallback when an unplayed TTS request fails, so speakers like 江之岛盾子 are not marked complete and skipped silently.
- [x] Prevented class-trial transient TTS 503/unavailable errors from flipping the global AI speech unavailable switch.
- [x] Split long class-trial dialogue into compact cumulative frames, including punctuation-light lines, to avoid sudden large text dumps.
- [x] Tuned class-trial speech contracts to 3 sentences / 260 chars and added named performance cues for key characters.
- [x] Preserved richer role-card fields through `/api/ai-speech-audio` into Japanese rewrite.
- [x] Added 千早爱音 Japanese rewrite guidance and validation so filler words are rare and placed outside seat/check/vote target fragments.
- [x] Added deterministic `rewriteMode:"local"` for complex class-trial public-logic speeches before slower LLM rewrite.
- [x] Root-caused a 76s 苗木诚 first-line wait to LLM Japanese rewrite and reduced the same text to about 6.3s through local rewrite.
- [x] Added role-specific class-trial fallback speech so rejected character speeches no longer degrade into generic Werewolf table templates.
- [x] Added a reusable class-trial character lens module for the fixed 9-character roster.
- [x] White-day class-trial speech input now carries character attention bias, pressure move, vote-rationale style, cadence, and forbidden-template signals.
- [x] Class-trial character lens is now soft LLM director guidance rather than keyword-based speech validation.
- [x] Obvious class-trial generic templates remain blocked by the baseline style guard, while DeepSeek can freeplay without lens keyword matching.
- [x] Class-trial fallback speech still uses the same role lens when bottom-line validation fails.
- [x] Day-vote action input now carries vote-rationale lens guidance while private night action input remains unaffected.
- [x] Follow-up persona pass expands the class-trial lens into a per-role `狼人杀打法卡` for all 9 fixed characters: read priority, pressure method, vote/action logic, villager/wolf/power-role play, night bias, and last-words mode.
- [x] Class-trial action input now carries that strategy lens in all class-trial phases, including private night actions, instead of only Day Vote.
- [x] Same-DeepSeek speech repair now rejects generic no-stance/no-ticket/evidence-gap or low-info report lines when they lack the current character's lens signal, plus abnormal repeated question-mark placeholders.
- [x] Class-trial speech repair now preserves LLM freeplay and only fixes the validation issue, instead of converting characterful output into template fallback wording.
- [x] Class-trial speech guidance now includes a soft anti-repeat cue so later speakers avoid repeating the same abstract criticism with a different seat number.
- [x] Class-trial character lens now includes role-specific transformation examples that show how the same table material should become different角色推进动作 without fixed scripts.
- [x] Class-trial speech input now adds dynamic director guidance when recent seats repeatedly circle `没给结论/验证方向`, `镜像攻击`, or `平安夜复读`.
- [x] Dynamic director guidance now also catches repeated `没给站边/票口` and `干净模板/后置责任` motifs found in production-preview text samples.
- [x] Production-preview text sample `64183909-65b9-44f2-9c35-4a3b89692904` generated 9 Day 1 speeches in about 75s and exposed the `没给站边/票口` repetition gap.
- [x] Production-preview text sample `309698cb-5ffc-40d6-af6d-c349b849fbd2` generated 9 Day 1 speeches in about 64s, with better role pressure shifts and one 高松灯 fallback.
- [x] Browser audio/typewriter QA on production preview reproduced the visible skip/jump risk around audio/text playback and verified the follow-up fix on `http://127.0.0.1:51627`.
- [x] Class-trial auto-advance now pauses while audio/text typewriter state is active, so fallback text has time to display before the table moves to the next speaker.
- [x] Audio-disabled class-trial continues now start timed text playback for the generated speech instead of silently jumping to the next current speaker.
- [x] Long class-trial dialogue reveal frames were tightened to smaller/faster cumulative chunks, and implausibly short audio no longer drives a long line's synced text reveal.
- [x] Added class-trial speech-order guidance and validation so unspoken seats cannot be prematurely labeled as more trusted, suspicious, wolfy, focused, or vote targets unless there is public hard info.
- [x] Added a class-trial low-info opener guard so first speakers cannot stop at “no information/no reference point” without leaving a concrete verifiable hook.
- [x] Added already-spoken seat validation for direct process demands across sentence boundaries, covering live wording like “1号……；你这一轮给过程”.
- [x] Ran a new production-preview text sample on `http://127.0.0.1:51629`: game `89c345c8-b272-457f-b4f1-244a53c8c597` generated the first four Day 1 speeches in about 39s; 苗木诚 left a共同验证断点, 雾切响子 only reviewed 1号原话, and 腐川冬子 did not prematurely信任9号.
- [x] Tightened class-trial long-speech frames to 4 display chars and capped audio-synced reveal by readable wall-clock progress.
- [x] Kept class-trial typewriter state alive after audio `ended` until readable tail time catches up, then held the completed line briefly before handoff.
- [x] Browser QA on `http://127.0.0.1:51629` confirmed game `bb78bcca-e25b-4ea5-a1a5-363bb2f3846b` displayed the complete normalized 69-char 苗木诚 first speech before switching to 雾切响子.
- [x] Root-caused no-sound in the production preview to generated `/audio/ai-speech/*.wav` files returning 404 under `next start`.
- [x] Added a dynamic AI speech audio cache route at `/audio/ai-speech/[fileName]` for runtime-generated mp3/wav files.
- [x] Restarted `next start -p 51629`; latest generated wav URLs now return 200 with `Content-Type: audio/wav`.
- [x] Added class-trial speech validation for prompt/meta leakage such as `通用观察`, `发言对比点`, `对话链`, `缺口先记下`, and template-material demands to unspoken later seats.
- [x] Added class-trial last-words validation so LLM custom遗言 cannot reintroduce the speaker with `我是角色名`; this covers the observed `噗噗，我是黑白熊` regression while preserving `噗噗`.
- [x] Rebuilt and restarted local `next start -p 51625`; app `/` returned 200 after restart.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Vote projection red-green | `npm run test -- src/game/engine.test.ts -t "keeps votes private until resolution reveals tally and public vote reasons"` | failed first, then passed | Red failure showed no locked/pending progress existed; green pass keeps targets/reasons/tally hidden and exposes only sealed progress. |
| Vote presenter/table/phase tests | `npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts` | passed | Covers sealed HUD, one-shot reveal, table seat chips/focus, and updated phase copy. |
| Vote focused regression pack | `npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts` | passed | 6 files / 170 tests. |
| Vote lint/type/build | `npm run lint`; `npx tsc --noEmit`; `npm run build` | passed | Build passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Vote harness and whitespace | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-visualization.md`; `npm run harness:check`; `git diff --check` | passed | `git diff --check` reported CRLF warnings only. |
| Vote browser QA | `http://127.0.0.1:51631` | passed | Sealed `DAY_VOTE` fixture showed `封票中`, `3 / 9`, per-seat locked/waiting labels, and no target ledger; reveal path showed `开票揭示`, tally rows, voter ledger, and focus seat. Port 3000 was occupied by another local app. |
| Vote burst focused tests | `npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts` | passed | Covers no-exile verdict, burst overlay hooks, sealed privacy assertions, and table-level no-focus guard. |
| Vote burst browser QA | `http://127.0.0.1:51631` | passed | Confirmed sealed `TRIAL VOTE` / `封票开始`, readable sealed status with no target leak, public exile spotlight with focus seat 6, and no-exile `未达成处刑` with focus count 0. |
| Speech de-template red-green | `npm run test -- src/ai/speechProviders.test.ts -t "universal de-template\|ordinary empty-template"` | failed first, then passed | Red failure showed ordinary speech input lacked `通用去模板` and ordinary empty-template chains returned `[]`; green pass followed shared guidance and validation. |
| Speech de-template focused tests | `npm run test -- src/ai/speechProviders.test.ts src/ai/tableRead.test.ts` | passed | 2 files / 113 tests; one false positive around legitimate `等后置位发言看有没有人接线` wording was found and fixed by narrowing ordinary validation. |
| Speech de-template lint/type/build | `npm run lint`; `npx tsc --noEmit`; `npm run build` | passed | Build passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Speech de-template harness | `npm run harness:task-card -- docs/tasks/2026-05-speech-de-template-persona-layer.md`; `npm run harness:check`; `git diff --check` | passed | `git diff --check` reported CRLF warnings only. |
| Role pressure/addressing red-green | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts -t "Ultimate Analyst\|Fukawa strongly\|role-specific repeated abstract pressure\|name-aware\|public references"` | failed first, then passed | Red failures covered missing Enoshima analyst framing, missing Fukawa/Togami bias, missing role-specific abstract-pressure guide, and missing name-aware public references. |
| Role pressure/addressing focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` | passed | 2 files / 106 tests after preserving existing Enoshima `反应差` / `矛盾` / `放大` expectations. |
| Role pressure/addressing text sample | `tmp/class-trial-day1-real-role-pressure-addressing-1780156628228.md` | passed with subjective caveat | Real DeepSeek sample generated 9/9 speeches, fallback 0/9, templateHits 0, repeated pressure terms 3, nameRefs 10. Final Enoshima analyst-first nudge was added after this sample and covered by tests, not a second real sample. |
| Opening persona follow-up red-green | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts -t "low-info opening\|generic audit frames\|final class-trial speakers"` and `npm run test -- src/ai/speechProviders.test.ts -t "greet and restate peace night\|Fukawa low-info\|Enoshima low-info\|all later seats"` | failed first, then passed | Red failures reproduced missing low-info opening moves, missing opening director, generic audit frames, final-speaker future wait, greeting-only平安夜, missing Fukawa/Togami emotion, missing Enoshima analyst structure, and waiting for all later seats. |
| Opening persona focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` | passed | 2 files / 114 tests before the fresh-sample fallback/hard-info follow-up. |
| Opening persona fallback/hard-info red-green | `npm run test -- src/ai/speechProviders.test.ts -t "class-trial low-info.*fallback"`; `npm run test -- src/ai/speechProviders.test.ts -t "future voting review"`; `npm run test -- src/ai/tableRead.test.ts -t "future voting-review"` | failed first, then passed | Red failures covered class-trial low-info fallback pressuring unspoken 2号雾切, 腐川 fallback missing 十神, and `投票时形成闭环` closing the low-info layer too early. |
| Opening persona fresh focused tests | `npm run test -- src/ai/tableRead.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` | passed | 3 files / 141 tests. |
| Opening persona real DeepSeek sample | `node tmp/verify-class-trial-role-pressure.mjs` | passed with fallback caveat | `tmp/class-trial-day1-verification-1780195573037.md`: 9/9 DeepSeek speeches, fallback 3/9 via role-specific fallback, templateHits 0, repeatedPressureTerms 4, nameRefs 11, Enoshima analyst signals 1, Fukawa Togami refs 1. |
| Class-trial prompt-leak red-green | `npm run test -- src/ai/speechProviders.test.ts -t "prompt terms leaking\|audit-template chains"` and `npm run test -- src/ai/actionProviders.test.ts -t "reintroduce the speaker"` | passed | Speech guard tests first failed on prompt/meta leakage and later passed; last-words self-intro test first failed with empty errors, then passed after validation. |
| Class-trial prompt-leak focused tests | `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts` | passed | 3 files / 125 tests; covers the new speech leak guards plus the Monokuma last-words self-intro guard. |
| Class-trial prompt-leak TypeScript/lint | `npx tsc --noEmit`; `npx eslint src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts` | passed | No output from either command. |
| Class-trial prompt-leak build/restart health | `npm run build`; restart `next start -p 51625`; `Invoke-WebRequest -UseBasicParsing http://localhost:51625/` | passed | Build passed with the existing Turbopack NFT trace warning; restarted listener PID 43152 returned StatusCode 200. |
| Follow-up speech contract tests | `npm run test -- src/ai/speechProviders.test.ts -t "speech contract"` and `npm run test -- src/ai/speechProviders.test.ts -t "class-trial role"` | passed | Red-green covered class-trial no-self-introduction/template bans inside `speechContract.mustNotAsk` and distinct behavior lenses for all 9 fixed roles. |
| Follow-up Day 2 fallback test | `npm run test -- src/ai/speechProviders.test.ts -t "fallback speeches reopen"` | passed | Failed first on `雾切响子。...`; passed after Day 2+ class-trial fallback stopped opening with display names. |
| Follow-up self-intro/template tests | `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/ai/classTrialCharacterLens.test.ts` | passed | 3 files / 120 tests; covers first-day-only self-intro guidance, speech-contract template bans, generic Werewolf opening rejection, role lens protection, Day 2+ no-name fallback, and last words without `我是角色名` fixed openings. |
| Follow-up audio/table tests | `npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialGameTable.test.ts` | passed | 2 files / 48 tests; covers 1000ms final text hold and class-trial table rendering. |
| Follow-up personas JSON smoke | `node -e "JSON.parse(require('fs').readFileSync('local-assets/class-trial-pack/personas.json','utf8')); console.log('personas ok')"` | passed | Confirms ignored local personas JSON remains parseable after the Monokuma wording update. |
| Follow-up TypeScript | `npx tsc --noEmit` | passed | No output. |
| Follow-up targeted lint | `npx eslint src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/classTrialCharacterLens.ts src/ai/classTrialCharacterLens.test.ts` | passed | No output. |
| Thinking/persona focused tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/hostAudioCues.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialSpeechRewrite.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 7 files / 172 tests; covers thinking portrait model/rendering, seat numbers, class-trial host cue keys, Monokuma rewrite, Day 2+ no self-intro, and class-trial last words. |
| Thinking portrait asset smoke | `node -e "...manifest asset check..."` and alpha/contact-sheet validation | passed | Manifest resolved all 9 avatar/portrait/thinking files; alpha validation passed 9 transparent thinking portraits. |
| Thinking/persona TypeScript | `npx tsc --noEmit` | passed | Fixed test setup to use `lastWordsSeatId` instead of view-only `currentActorSeatId`. |
| Thinking/persona lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Thinking/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Thinking/persona task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-thinking-persona-polish.md` | passed | Task gate passed. |
| Thinking/persona harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Thinking/persona whitespace | `git diff --check` | passed | CRLF warnings only. |
| Thinking/persona browser smoke | Chrome headless CDP on `http://localhost:51625` | passed | Selected `学级裁判主题局`, entered 9p AI-only spectator, confirmed 9 podium numbers and 9 local avatars; after advancing to Day 1 speech, DOM showed `/class-trial-pack/thinking-portraits/%E8%8B%97%E6%9C%A8%E8%AF%9A.png` with `data-portrait-state="thinking"`. |
| Focused audio-sync tests | `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | 3 files, 37 tests. |
| Focused audio-lookahead tests | `npm run test -- src/components/game/classTrialAudioLookahead.test.ts src/components/game/gameClientRequests.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | 5 files, 51 tests. |
| Lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| TypeScript | `npx tsc --noEmit` | passed | No output. |
| Build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-latency.md` | passed | New latency task card passes the harness gate. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| GPT-SoVITS health | `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` | passed | StatusCode 200. |
| Browser flow | `http://127.0.0.1:51625` | partial pass | Class-trial 9p AI-only, AI speech enabled; dialogue immediately showed `正在生成语音。`, later showed `正在调取证言。` / `正在生成语音。`, and fresh `naegi` / `kirigiri` wav files appeared. Partial audio-progress reveal was not captured reliably by automation. Screenshot capture timed out. |
| Browser audio-lookahead flow | `http://127.0.0.1:51625` | passed with timing caveat | Controls stayed disabled during audio/buffered playback. A very short first speech still left visible generation on the second speaker; the longer second speech gave the third speaker enough lookahead time to enter directly with full dialogue. Screenshot saved at `tmp/class-trial-audio-lookahead-smoke.png`. |
| GPT-SoVITS latency tests | `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | 2 files, 7 tests. Red-green failures were observed before implementation for the missing cache/timing API and missing timing log. |
| GPT-SoVITS latency task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-latency.md` | passed | New backend latency task card passes the harness gate. |
| Direct latency route smoke | `POST http://127.0.0.1:51625/api/ai-speech-audio` | passed | Two same-role 高松灯/Tomori requests returned `provider: gpt-sovits`: `latency-smoke:20260528225927:1` -> `/audio/ai-speech/tomori-1fbc2cd4c7e2aaf14abcaf51.wav` in 10046ms; `latency-smoke:20260528225927:2` -> `/audio/ai-speech/tomori-6cf79401120b7e52341978a0.wav` in 4981ms. |
| Timing log diagnosis | `tmp/dev-51625-restart.log` | passed | Five real GPT-SoVITS route samples averaged 7032ms total: rewrite 5101ms / 72.5%, switch 263ms / 3.7%, TTS 1664ms / 23.7%, write 2ms. Same-weight samples skipped both switch endpoints; the one new-role Kirigiri sample spent 1313ms on weight switching. |
| Rewrite fast-path tests | `npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | 2 files, 8 tests. Red-green failures were observed before implementation for the missing metadata API/cache helper and missing `rewriteMode` log field. |
| Rewrite fast-path lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Rewrite fast-path TypeScript | `npx tsc --noEmit` | passed | No output. |
| Rewrite fast-path build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Direct rewrite fast route smoke | `POST http://127.0.0.1:51625/api/ai-speech-audio` | passed | `rewrite-fast-smoke:20260528235235:tomori` returned `provider: gpt-sovits` in 3014ms; log showed `rewriteMode:"fast"`, `rewriteMs:0`, `switchMs:1484`, `ttsMs:1319`, `totalMs:2806`. Second same-text request returned in 1053ms; log showed `rewriteMode:"cache"`, `rewriteMs:1`, `switchMs:0`, `ttsMs:965`, `totalMs:968`. |
| LLM runtime focused tests | `npm run test -- src/components/game/aiFriendStorage.test.ts src/components/game/gamePanelsMobile.test.ts src/components/game/classTrialGameTable.test.ts` | passed | 3 files, 37 tests. Red failures were observed first for the missing helper and missing status copy. |
| LLM runtime lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| LLM runtime TypeScript | `npx tsc --noEmit` | passed | No output. |
| LLM runtime build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| LLM runtime browser smoke | `http://127.0.0.1:51625` | passed | Home card showed `真实 LLM · DeepSeek-v4 主脑`; themed table showed `真实 LLM · DeepSeek-v4`. |
| LLM runtime model smoke | Prisma `AiCallLog` for `8943cd42-566f-411f-8c78-6795cc4cefdd` | passed | Logged real model attempt `deepseek-action:deepseek-v4-flash`, so class-trial start is no longer mock-only. |
| LLM runtime task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-llm-runtime.md` | passed | Task gate passed. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| DeepSeek brain focused tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` | passed | 3 files, 104 tests. Red failures were observed first for mixed base personas and GPT fallback repair attempts. |
| DeepSeek brain lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| DeepSeek brain TypeScript | `npx tsc --noEmit` | passed | No output. |
| DeepSeek brain build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| DeepSeek brain task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-brain.md` | passed | Task gate passed. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| DeepSeek browser/live model smoke | `http://127.0.0.1:51625` plus Prisma `AiCallLog` for `6010e73b-e191-4d53-a3ca-9efc2f939c95` | passed with quality caveat | UI showed `真实 LLM · DeepSeek-v4 主脑`; observed action repair attempts used `deepseek-action:deepseek-v4-flash` only and an observed speech repair attempt used `deepseek-speech:deepseek-v4-flash` only. Several DeepSeek attempts had empty extracted content, so local fallback still occurred after same-model retries. |
| DeepSeek thinking-budget red-green tests | `npm run test -- src/ai/modelLlms.test.ts` | passed | Failed first because DeepSeek action/speech did not both send `thinking: disabled`; passed after implementation. |
| Focused DeepSeek token-budget tests | `npm run test -- src/ai/modelLlms.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` | passed | 3 files, 102 tests. |
| Real routed DeepSeek token-budget probe | Vite `ssrLoadModule('/src/ai/modelLlms.ts')` | passed | Action with `maxTokens: 220` returned non-empty `deepseek-action:deepseek-v4-flash` text; speech with `maxTokens: 900` returned non-empty `deepseek-speech:deepseek-v4-flash` text. |
| Narrow class-trial real loop | engine-level Vite script with fixed class-trial AI friends | passed with latency caveat | 8 LLM calls, DeepSeek-only providers, fallback count 0, empty first-attempt count 3, recovered on second DeepSeek attempt; reached Day 1 `DAY_SPEECH` in about 248s. |
| DeepSeek thinking A/B | direct provider and routed speech probes | passed | Action `thinking: disabled` returned non-empty JSON in about 3s. Real class-trial speech with `thinking: disabled` plus 900 tokens returned non-empty speech in about 4.5s. |
| Follow-up narrow class-trial real loop | engine-level Vite script with fixed class-trial AI friends | passed | 5 LLM calls, DeepSeek-only providers, fallback count 0, empty attempt count 0, retry count 1 for speech validation, duration about 29s. |
| DeepSeek token-budget lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| DeepSeek token-budget TypeScript | `npx tsc --noEmit` | passed | No output. |
| DeepSeek token-budget build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| DeepSeek token-budget task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-token-budget.md` | passed | Task gate passed. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| GPT-SoVITS prewarm red-green tests | `npm run test -- src/server/gptSoVitsTts.test.ts` and `npm run test -- src/components/game/aiSpeechAudio.test.ts` | passed | Failed first for missing exclusive synthesis queue, prewarm cue, and deferred chunk loading; passed after implementation. |
| GPT-SoVITS prewarm focused tests | `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | 3 files, 22 tests. |
| GPT-SoVITS prewarm TypeScript | `npx tsc --noEmit` | passed | No output. |
| GPT-SoVITS prewarm lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| GPT-SoVITS prewarm build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| GPT-SoVITS prewarm task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md` | passed | Task gate passed. |
| GPT-SoVITS prewarm harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from class-trial slices. |
| GPT-SoVITS prewarm whitespace | `git diff --check` | passed | CRLF warnings only. |
| GPT-SoVITS health | `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` | passed | StatusCode 200. |
| Direct prewarm route smoke | `POST http://127.0.0.1:51625/api/ai-speech-audio` | passed | Concurrent Tomori and Kirigiri class-trial role-card requests returned `provider: gpt-sovits`; logs completed at about 2531ms and 5101ms total in serialized order. |
| Whole-speech TTS focused test | `npm run test -- src/components/game/aiSpeechAudio.test.ts` | passed | Red failure first showed whole-speech mode still loaded two chunks during `push`; passed after adding `chunkMode: "whole-speech"`. |
| Persona speech focused test | `npm run test -- src/ai/speechProviders.test.ts` | passed | Red failure first showed class-trial role-card guide lacked anti-template/persona-performance lines; passed after strengthening the guide. |
| Whole-speech/persona TypeScript | `npx tsc --noEmit` | passed | No output. |
| Whole-speech/persona lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Whole-speech/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| Local app health | `Invoke-WebRequest http://127.0.0.1:51625/` and `/alpha-health` | passed | Both returned 200 OK. Browser automation tool was not exposed in this turn, so no new screenshot/listening smoke was captured. |
| Whole-speech/persona task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md` | passed | First run failed for a missing `## Context To Read First`; passed after adding the section. |
| Whole-speech/persona harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whole-speech/persona whitespace | `git diff --check` | passed | CRLF warnings only. |
| No-skip/typewriter/persona red-green tests | `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | First failed for missing compact frames, class-trial text fallback helpers, anti-template contract, Anon filler guard, and dropped route role-card fields; latest focused run passed, 5 files / 105 tests. |
| Follow-up local rewrite tests | `npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | Added deterministic local rewrite coverage for complex class-trial public-logic lines and preserved route timing metadata. |
| Follow-up persona/fallback tests | `npm run test -- src/ai/speechProviders.test.ts` | passed | Covered the tuned 3-sentence / 260-char class-trial contract and role-specific class-trial fallback speech. |
| Live API/log regression | game `68d9b996-e4f3-4518-b0e0-e146ac7c6328` plus `POST /api/ai-speech-audio` | passed with listening caveat | 苗木诚 first sample took about 76.3s with `rewriteMode:"llm"` / `rewriteMs:63779`; same text after local rewrite took about 6.3s with `rewriteMode:"local"` / `rewriteMs:0`. 江之岛盾子 generated GPT-SoVITS audio in about 5.1s instead of being skipped in this path. |
| No-skip/typewriter/persona TypeScript | `npx tsc --noEmit` | passed | No output. |
| No-skip/typewriter/persona lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| No-skip/typewriter/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| Latest local app health | `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:51625/` and `/alpha-health` | passed | Both returned 200. Browser automation was not exposed and local Playwright was missing, so no new screenshot/listening smoke was captured. |
| Red-green class-trial director tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts` and `npm run test -- src/ai/speechProviders.test.ts -t "dynamic class-trial director guidance"` | passed | First failed for missing role-specific transformation examples and missing dynamic repeated-focus guidance, then passed after implementation. |
| Class-trial production-preview text sample | game `64183909-65b9-44f2-9c35-4a3b89692904` on `http://127.0.0.1:51627` | passed with quality caveat | 9 Day 1 speeches in about 75s. Better role separation than the previous full sample, but repeated `没给站边/票口` pressure did not trigger the first dynamic motif set. |
| Class-trial production-preview text sample | game `309698cb-5ffc-40d6-af6d-c349b849fbd2` on `http://127.0.0.1:51627` | passed with one fallback caveat | 9 Day 1 speeches in about 64s. Pressure shifted more naturally from 1号 to 3号/2号; one 高松灯 speech fell back after validation retry. |
| Class-trial character lens focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 3 files, 110 tests. |
| Class-trial strategy-card follow-up | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 3 files / 122 tests; covers per-role `狼人杀打法卡`, all-phase class-trial action strategy input, generic template repair guards, and abnormal question-mark rejection. |
| Class-trial strategy-card TypeScript/lint | `npx tsc --noEmit`; `npx eslint src/ai/classTrialCharacterLens.ts src/ai/speechProviders.ts src/ai/actionProviders.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | No output. |
| Class-trial strategy-card live provider sample | Vite SSR routed DeepSeek sample | partial pass | Returned `deepseek-speech:deepseek-chat`, `isFallback:false`, and prompt contained `狼人杀打法卡` plus the role-action rule. PowerShell inline-script Chinese context produced placeholder artifacts, so this is provider/prompt evidence, not final dialogue-quality evidence. |
| Class-trial character lens TypeScript | `npx tsc --noEmit` | passed | No output. |
| Class-trial character lens lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Class-trial character lens build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Class-trial LLM freeplay smoke | game `e38aeb06-a684-40f3-88ba-a41035a32d0a` via `POST /api/games` and repeated `continue` with `aiRuntimeMode: "llm"` | passed with one fallback caveat | Generated 5 Day 1 speeches; 4 of 5 speech logs were non-fallback DeepSeek outputs. The only fallback came from the existing already-spoken-player guard, not character-lens validation. |
| Class-trial full Day 1 LLM sample | game `60f17301-15c4-41a9-a134-7c2adba47c92` via `POST /api/games` and repeated `continue` with `aiRuntimeMode: "llm"` | passed with quality caveat | Generated 9 of 9 Day 1 class-trial speeches as non-fallback DeepSeek speech outputs. Later seats still repeated some abstract pressure themes, which led to the soft anti-repeat prompt. |
| Class-trial anti-repeat smoke | game `ca0d5a71-261c-4d47-87b1-877c7336a77a` via `POST /api/games` and repeated `continue` with `aiRuntimeMode: "llm"` | partial pass | Exercised the new anti-repeat prompt path for the first four Day 1 speakers. Two later sampled fallbacks came from transient DeepSeek `fetch failed` provider errors, not character-lens validation. |
| Class-trial character lens health | `Invoke-WebRequest` against app `/`, app `/alpha-health`, and GPT-SoVITS `/openapi.json` | passed | All three returned StatusCode 200. |
| Class-trial character lens task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md` | passed | Task gate passed. |
| Class-trial character lens harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Class-trial character lens whitespace | `git diff --check` | passed | CRLF warnings only. |
| Audio/typewriter focused tests | `npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/autoAdvance.test.ts` | passed | 4 files / 54 tests. |
| Audio/typewriter TypeScript | `npx tsc --noEmit` | passed | No output. |
| Audio/typewriter lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Audio/typewriter build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Browser audio/typewriter QA | `http://127.0.0.1:51627` | partial pass | AI speech enabled: 苗木诚 wait -> text reveal -> 雾切响子 handoff without silent skip. AI speech off: death seats still showed `已退场`, and 苗木诚 timed text fallback appeared instead of immediate skip. Long trace timed out before preserving a full black-white-bear transcript. |
| Speech-order/persona guard red-green | `npm run test -- src/ai/speechProviders.test.ts` | passed | First failed for missing unspoken-seat trust guard, missing opener hook validation, and missing already-spoken direct-demand validation; latest run passed 1 file / 76 tests. |
| Speech-order/persona focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 3 files / 112 tests. |
| Speech-order/persona TypeScript | `npx tsc --noEmit` | passed | No output. |
| Speech-order/persona lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Speech-order/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Speech-order/persona local health | `Invoke-WebRequest` against `http://127.0.0.1:51629/`, `/alpha-health`, and GPT-SoVITS `/openapi.json` | passed | All returned StatusCode 200. |
| Speech-order/persona live text sample | game `89c345c8-b272-457f-b4f1-244a53c8c597` on `http://127.0.0.1:51629` | passed with subjective caveat | First four Day 1 speeches generated in about 39s; the earlier no-hook opener, already-spoken direct demand, and `更信9号` issues did not recur. |
| Audio/typewriter follow-up tests | `npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts` | passed | 4 files / 58 tests. Covered readable wall-clock caps, ended-audio tail progress, final text hold, active-theme sync without role-card metadata, and 4-char long-speech frames. |
| Audio/typewriter follow-up lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Audio/typewriter follow-up TypeScript | `npx tsc --noEmit` | passed | No output. |
| Audio/typewriter follow-up build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Audio/typewriter follow-up task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md` | passed | Task gate passed. |
| Audio/typewriter follow-up harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Audio/typewriter follow-up whitespace | `git diff --check` | passed | CRLF warnings only. |
| Audio/typewriter follow-up health | `Invoke-WebRequest` against `http://127.0.0.1:51629/alpha-health` and GPT-SoVITS `/openapi.json` | passed | Both returned StatusCode 200. |
| Audio/typewriter follow-up browser QA | `http://127.0.0.1:51629` | passed with listening caveat | AI speech enabled; staged wait text and 4-char cumulative reveal were visible, and game `bb78bcca-e25b-4ea5-a1a5-363bb2f3846b` displayed the complete normalized 69-char 苗木诚 first speech before handoff to 雾切响子. |
| No-sound route red test | `npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts` | failed first, then passed | Red failure was missing `./route`; green pass covered mp3/wav cache path resolution, traversal blocking, and content types. |
| No-sound focused tests | `npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts` | passed | 5 files / 61 tests. |
| No-sound TypeScript | `npx tsc --noEmit` | passed | No output. |
| No-sound lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| No-sound build | `npm run build` | passed | Dynamic `/audio/ai-speech/[fileName]` route is included; existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| No-sound local route smoke | `Invoke-WebRequest` against `http://127.0.0.1:51629/audio/ai-speech/<latest>.wav` after restart | passed | Returned 200, `Content-Type: audio/wav`, `Content-Length: 825644`, `Accept-Ranges: bytes`. |

## Files Changed

- `src/game/types.ts`
- `src/game/projection.ts`
- `src/game/engine.test.ts`
- `src/components/game/ClassTrialVoteStage.tsx`
- `src/components/game/classTrialVoteStage.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialPhaseScenes.ts`
- `src/components/game/classTrialPhaseScenes.test.ts`
- `src/app/globals.css`
- `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md`
- `docs/tasks/2026-05-class-trial-vote-visualization.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/hostAudioCues.ts`
- `src/components/game/hostAudioCues.test.ts`
- `src/components/GameClient.tsx`
- `src/app/globals.css`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-05-speech-de-template-persona-layer.md`
- `docs/tasks/2026-05-class-trial-role-pressure-addressing.md`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `docs/tasks/2026-05-class-trial-thinking-persona-polish.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `local-assets/class-trial-pack/personas.json` (ignored local data)
- `src/components/game/classTrialDialogue.ts`
- `src/components/game/classTrialDialogue.test.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/game/clientTypes.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialAudioLookahead.ts`
- `src/components/game/classTrialAudioLookahead.test.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `src/components/GameClient.tsx`
- `src/components/game/aiFriendStorage.ts`
- `src/components/game/aiFriendStorage.test.ts`
- `src/components/game/LandingPanel.tsx`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/modelLlms.ts`
- `src/ai/modelLlms.test.ts`
- `src/server/gptSoVitsTts.ts`
- `src/server/gptSoVitsTts.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `src/app/audio/ai-speech/[fileName]/route.ts`
- `src/app/audio/ai-speech/[fileName]/route.test.ts`
- `docs/tasks/2026-05-class-trial-audio-latency.md`
- `docs/tasks/2026-05-class-trial-audio-lookahead.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- `docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
- `docs/tasks/2026-05-class-trial-llm-runtime.md`
- `docs/superpowers/plans/2026-05-29-class-trial-deepseek-brain.md`
- `docs/tasks/2026-05-class-trial-deepseek-brain.md`
- `docs/tasks/2026-05-class-trial-deepseek-token-budget.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md`
- `docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `docs/superpowers/specs/2026-05-29-class-trial-character-lens-design.md`
- `docs/superpowers/plans/2026-05-29-class-trial-character-lens.md`
- `docs/superpowers/plans/2026-05-28-class-trial-audio-latency.md`
- `docs/superpowers/plans/2026-05-28-class-trial-audio-lookahead.md`
- `docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-latency.md`
- `docs/superpowers/specs/2026-05-28-class-trial-rewrite-fast-path-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-rewrite-fast-path.md`
- `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Ignored/generated local-only files observed:

- `local-assets/class-trial-pack/manifest.json`
- `local-assets/class-trial-pack/thinking-portraits/*.png`
- `tmp/class-trial-thinking-keyed/*.png`
- `tmp/class-trial-thinking-contact-sheet.png`
- `public/audio/ai-speech/*.wav`
- `tmp/dev-51625-restart.log`
- `tmp/dev-51626.log`

## Decisions Made

- Keep audio sync class-trial-only.
- Keep thinking text visible until audio generation/playback state is available.
- Use active audio status as the temporary speaking focus, because the game can advance to the next speaker before the previous speaker's GPT-SoVITS audio finishes.
- Use real `HTMLAudioElement.currentTime / duration` for synced reveal when duration is valid; use existing fixed timer fallback when duration is invalid.
- Start background class-trial lookahead only after current audio playback begins, so failed autoplay does not advance the server behind a silent UI.
- Keep only one buffered class-trial continue at a time and consume it only when the source speech key, game id, and active audio run still match.
- If lookahead reaches a next speaker who has not spoken yet, run one additional background continue to generate that speaker's speech before prewarming audio.
- Use in-memory active GPT/SoVITS path tracking per normalized base URL as the conservative first backend optimization.
- Keep GPT-SoVITS timing logs safe: no local weight paths, prompt text, generated text, or secrets.
- Keep rewrite fast path conservative. If a line is not a known simple public-speech pattern, it falls back to the existing LLM rewrite and validation.
- Log only `rewriteMode`, not rewritten Japanese text or original Chinese text.
- Serialize GPT-SoVITS switch + TTS because the local api_v2 service has global active weights.
- Prewarm only the current class-trial AI speaker and do it invisibly; do not play the warmup audio or mutate game state.
- Defer class-trial streaming chunk generation to the playback drain so long speeches do not burst all GPT-SoVITS requests at once.
- For class-trial visible speech, generate GPT-SoVITS audio as one whole-speech chunk after the final LLM text arrives. This removes mid-speech gaps caused by per-chunk rewrite calls, while preserving live text streaming.
- Make class-trial role cards stronger than the shared DeepSeek base persona for speech style, but keep them bounded by public information, role rules, and camp goals.
- If class-trial TTS fails before any audio plays, keep the speaker visible with timed text fallback instead of treating the speech as completed instantly.
- Treat class-trial TTS unavailability as local/transient for that speech; do not disable the whole AI speech path from a GPT-SoVITS/Mimo fallback miss.
- Let 千早爱音 keep a little filler-word texture, but cap it tightly and forbid filler inside number/check/vote target fragments.
- Prefer deterministic local Japanese rewrite for common complex class-trial public-logic lines before asking the LLM, because the live 苗木诚 sample showed rewrite latency can dominate the whole TTS wait.
- Keep class-trial speech at 3 sentences / 260 chars instead of 2 / 220 so good characterful DeepSeek lines are not rejected into fallback purely for being slightly longer.
- Make class-trial fallback speech role-specific and pressure-oriented; fallback should still sound like the character, not like a generic Werewolf template.
- Keep the character lens as a reusable soft director input layer, not a fixed dialogue library and not a keyword-matching validator.
- Apply class-trial character lens behavior to white-day speech and public day-vote reasons only; private night actions stay on existing strategic logic.
- Repairs should preserve the LLM's class-trial freeplay and only remove the specific invalid part; do not make repair prompts collapse into local fallback templates.
- Use soft anti-repeat direction in the prompt before adding hard validators; if repetition persists, prefer few-shot/director examples or an evaluator layer over keyword rules.
- Use role-specific transformation examples and dynamic repeated-focus guidance as soft prompt material; they should teach the LLM how to change lens, not become mandatory wording.
- Treat class-trial audio-sync as a readable text staging problem as well as an audio problem: if audio is off, fails, or is too short for the amount of text, keep a timed text playback status alive and block auto-advance until it clears.
- Do not let real audio `ended` alone complete a class-trial line if the readable wall-clock reveal has not caught up; keep ticking the text tail and hold the completed line briefly before advancing.
- Runtime-generated AI speech files need a dynamic route in production preview; do not rely on `next start` serving newly-created `public/audio/ai-speech` files as static build assets.
- Keep the new unspoken-seat guard hard, not just prompt-only: role自由发挥 is allowed, but public speech order still forbids assigning trust/suspicion/vote labels before a seat has spoken unless a public check or identity claim already exists.
- Treat low-info first-position speech as a character-feel problem: first speaker may stay uncertain, but must leave a verifiable hook for later seats.
- Treat self-introduction as a first-day-morning affordance, not a recurring class-trial turn template; later speech and last words should enter from current evidence, vote shape, death shape, or role-specific pressure.
- Treat generic Werewolf openings like `我是闭眼好人 / 信息不多先听后置` as hard class-trial style failures, because they erase role identity even when the public logic is legal.
- Treat generic no-stance/no-ticket/evidence-gap reports as repairable LLM failures when they do not include the current character's lens signal; this keeps the final path on DeepSeek instead of changing local fallback prose.
- Browser QA can validate visible text, timing, and transcript persistence, but actual voiced quality depends on GPT-SoVITS being reachable.
- Repeated `没给倾向/缺口` loops should be pushed through a stronger director note first; keep this as prompt guidance rather than a broad hard validator unless another live sample still repeats the same axis.

## Blockers / Risks

- Fallback rate increased in some stricter samples. The user explicitly said fallback is out of scope for this pass, but high fallback reduces the number of subjective non-fallback lines available per report.
- The latest non-fallback lines remove the worst Kirigiri relation error, but Kirigiri / Tomori / Anon still need stronger per-role action texture in a future pass.
- The vote visualization change is local-only class-trial work and intentionally skips `/rooms` / Public Alpha / ordinary vote UI.
- `src/app/globals.css` and `src/components/game/classTrialGameTable.test.ts` already had unrelated dirty class-trial edits before this slice; preserve them when staging.
- The browser verification server is still running on `http://127.0.0.1:51631`; port 3000 was another local app during this pass.
- Latest browser QA completed a full Day 1 transcript, but GPT-SoVITS was not reachable at `127.0.0.1:9880`, so actual voiced output was not tested.
- Browser automation confirmed complete visible first-speech text before handoff after the readable-sync follow-up, but it cannot hear GPT-SoVITS output; a human listening pass is still useful.
- The no-sound fix proves generated audio URLs are reachable again, but only the user can confirm actual audible output from the in-app browser/system audio device.
- Browser automation cannot hear GPT-SoVITS output; the latest pass verified visible state/timing only, so human listening is still needed for actual audio gaps and pacing.
- The latest long browser trace timed out before preserving the full black-white-bear segment, so manually listening through the first 4 speakers is still the best next check.
- GPT-SoVITS generation can still take many seconds per local request, so this slice reduces perceived waiting and duplicate prep, but does not deeply optimize the local synthesis backend.
- GPT-SoVITS active-weight cache resets on server restart and can be stale if another external client changes weights outside this app.
- Real timing samples show rewrite is currently the dominant latency source, so more weight-switch work will have limited benefit.
- Rewrite fast path only helps lines that match its narrow templates. Real AI speeches may still hit `rewriteMode:"llm"` often until more safe patterns are added.
- Rewrite cache is process-local and resets on server restart.
- Whole-speech class-trial TTS can increase the initial wait before audio starts, especially for long speeches, but avoids the more jarring pause inside one speaker's line.
- Timed text fallback preserves the visible speech when TTS fails, but it is still silent; a longer listening pass should confirm it feels acceptable versus retrying longer.
- The 3-sentence / 260-char class-trial speech contract reduces false rejections, but speech validation can still trigger repair attempts or fallback on unusually report-like output.
- Deterministic local Japanese rewrite is much faster than LLM rewrite but may be less semantically rich; a human listening pass should judge whether the audio wording still feels natural.
- The latest text samples improved role pressure shifts, but a full browser/audio listening pass should decide whether one-off role-specific fallbacks feel acceptable and whether an evaluator layer is needed.
- A short anti-repeat smoke hit transient DeepSeek `fetch failed` provider errors for later speakers; those fallbacks were provider/network failures, not character-lens validation failures.
- The stronger persona prompt and new guards improve the first four text samples, but the next subjective browser/audio run is still needed to judge whether 苗木诚 and the other characters feel distinct enough while voiced.
- Subjective character feel still needs a longer Day 1 listening pass; tests prove the lens reaches prompts and validation, not that every live line will feel perfect.
- The latest browser QA transcript `tmp/class-trial-browser-qa-1780197058323.md` proves full Day 1 can be captured in the browser path, but it was collected before the new stronger repeated-gap director wording and while GPT-SoVITS was down.
- The latest fresh role-pressure sample `tmp/class-trial-day1-verification-1780195573037.md` proves the opening-persona follow-up now has real DeepSeek evidence, but 3/9 visible lines used role-specific fallback after validation failures, so another subjective sample may still be useful.
- The Vite SSR live provider sample confirmed official DeepSeek routing and prompt contents, but the PowerShell inline-script context had Chinese encoding placeholders; use a browser/game sample for final dialogue-quality judgment.
- Character lens is intentionally light and may need per-role wording tuning after real DeepSeek samples.
- User pasted provider key values in chat during the LLM runtime slice. Do not copy them into tracked files or handoff notes; refresh only private local config if needed.
- Class-trial LLM mode intentionally trades mock speed for real model quality; the UI now calls this out, but live latency still depends on DeepSeek/Mimo and GPT-SoVITS.
- DeepSeek-only class-trial routing removes GPT/Claude/GLM recovery for malformed JSON. Bad DeepSeek outputs now surface as same-model retries or eventual local fallback action/speech.
- Disabling DeepSeek thinking may reduce some deep deliberation, but it fits the current game need better: fast structured JSON and fewer empty attempts.
- The latest narrow real loop still had 1 retry, caused by speech-contract validation, not empty provider output.
- Audio lookahead hides wait only if the current playback duration is long enough for the next continue step and next GPT-SoVITS generation to finish.
- Background continue mutates server state before the UI advances; duplicate prevention now relies on disabled class-trial controls plus active-run guarded consumption.
- Browser screenshot capture timed out during the latency smoke; DOM state and generated wav cache evidence were collected.
- Voice prewarm shifts cold-start work earlier; it cannot eliminate GPT-SoVITS synthesis cost.
- Deferred chunk loading protects the local backend from request bursts, but very long speeches can still pause between chunks if synthesis is slower than playback.
- Browser automation was not available in the post-prewarm thread; focused tests and direct route smoke passed, but a longer listening pass is still useful.
- The worktree still contains unrelated/pre-existing class-trial and GPT-SoVITS dirty files from earlier slices; do not blindly stage everything.

## Recommended Next Step

For this class-trial speech-quality slice, stop broad real Mimo full-game reruns for now. Current practical judgment: full-game Mimo is completable/playable, but the latest real proof is still `speechFallback: 1`, not a clean 0-fallback run. If work resumes, either review `tmp/class-trial-mimo-full-game-1780746535599.md` subjectively or run one explicitly approved full-game verification after the 20:22 normalization fix; otherwise focus on local replay/unit tests.

## 2026-06-05 Mimo D1 0-fallback follow-up

Completed:
- Fixed additional class-trial speech validators that were rejecting usable Mimo lines: true-seer black-check requests to the unspoken checked target, natural self-intro seer claims, Celestia chip/后置 phrasing, D1 first-check motive negation, supportive Kirigiri wording, and natural black-check treatment boundaries.
- Switched the class-trial default/runtime label from `mimo-v2.5-pro` to `mimo-v2.5`, matching the 0-fallback evidence route while keeping `AI_MODEL_MIMO` override support.
- Generated `tmp/class-trial-d1-all-speeches-score-1780667013149.md` / `.json`: 9 speeches, 0 fallback, average 85, all providers `mimo-speech:mimo-v2.5`, `viewerQuality pass=8 warn=1`.

Verification:
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` passed: 7 files / 287 tests.
- `npx tsc --noEmit` passed.

Remaining risks:
- This proves fallback can reach 0 on the fixed D1 sample, not that subjective quality is ideal.
- The 0-fallback sample still has near-duplicate 江之岛/十神 phrasing, weak Togami/Hunter identity texture, and a lower-scoring Kirigiri line. Next pass should fix repeated role axes and per-character action texture rather than adding broad validators.

## 2026-06-05 Mimo D1 0-fallback repair follow-up

Completed:
- Kept class-trial on `mimo-v2.5` and continued reducing real Mimo fallback causes in the fixed D1 sample.
- Added copied-question-shape detection and live-state avoidance so late speakers do not reuse a prior speaker's black-check question skeleton.
- Preserved hard SEER/identity speech contracts in the class-trial LLM input, while keeping ordinary decision/audit scripts stripped; this prevents wolf counterclaims from losing required identity/check/result wording.
- Retained only D1 public-black-check safety bans for non-hard freeform speech, so Mimo sees "do not attack first-check reason / do not make peaceful night the whole speech" without restoring generic table scripts.
- Accepted natural hard counterclaim wording such as `我才是预言家`.
- Made class-trial hard hunter claims expose the concrete line `我拍猎人，枪在这里。`.
- Latest fixed D1 sample: `tmp/class-trial-d1-all-speeches-score-1780673627203.md` / `.json`; 9 speeches, 0 fallback, average 79, all providers `mimo-speech:mimo-v2.5`, `viewerQuality pass=8 warn=1`.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/classTrialLiveState.ts`
- `src/ai/classTrialLiveState.test.ts`
- `src/ai/modelLlms.ts`
- `src/game/personas.ts`
- `src/components/game/classTrialTheme.ts`
- related Mimo label/runtime tests
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-06-class-trial-freeform-speech-quality.md`

Verification:
- `node tmp/class-trial-d1-all-speeches-score.mjs` with temporary Mimo process env produced `tmp/class-trial-d1-all-speeches-score-1780673627203.md`: 9 speeches, 0 fallback.
- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/game/engine.test.ts src/app/api/games/aiFriends.test.ts src/app/api/games/api.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/game/claims.test.ts` passed: 10 files / 419 tests.
- `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialLiveState.test.ts src/game/claims.test.ts` passed: 3 files / 211 tests.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md` passed.

Remaining risks:
- 0 fallback is now achieved for the fixed D1 text sample, but subjective role quality is not ideal.
- 2号雾切 is legal but too short and low-texture; 4号黑白熊 still sounds contract-shaped; 9号千早爱音 needs stronger Anon relationship texture.
- This pass did not run a fresh full-game Mimo harness after the D1 fallback repairs. Earlier full-game Mimo evidence exists, but the newest proof is the D1 fixed sample.
- A real browser/audio listening pass remains separate; this was text planning and validation work.

## 2026-06-06 Mimo D2 0-fallback follow-up

Completed:
- Continued the user-requested D2 pass after D1 was considered good enough for now.
- Fixed real Mimo D2 fallback causes rather than polishing fallback prose: quoted why-question fragments in natural focus-shift wording no longer trigger unfinished-question validation, inline class-trial stage directions such as `（转向桌面）` are stripped, Mimo speech requests now default to a longer 180s timeout, and repairable internal audit terms such as `校验没闭合` are rewritten before validation.
- Latest real D2 sample: `tmp/class-trial-mimo-d2-speeches-1780737098833.md` / `.json`; 8 D2 speeches, `d2SpeechFallback: 0`, all D2 providers `mimo-speech:mimo-v2.5-pro`.

Changed files:
- `src/ai/modelLlms.ts`
- `src/ai/modelLlms.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/game/speechText.ts`
- `progress.md`
- `session-handoff.md`
- `docs/tasks/2026-06-class-trial-freeform-speech-quality.md`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts src/ai/modelLlms.test.ts` passed: 2 files / 210 tests.
- `npx tsc --noEmit` passed.
- `npx vitest run src/ai/classTrialMimoD2Harness.test.ts --testTimeout 900000` passed and produced `tmp/class-trial-mimo-d2-speeches-1780737098833.md`.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- This proves D2 fallback is 0 for the latest generated D2 sample, not that the full game or subjective character quality is ideal.
- D1 in the same run still had 3 fallback rows; that was not the target of this D2 pass.
- The latest D2 text is usable but still has some table jargon such as `票口`; future work should improve character texture and complete-game consistency, not claim the line quality is final.

## 2026-06-08 Ordinary Real-Mimo Speech Follow-up

Completed:
- Continued the ordinary Werewolf AI migration by bringing over the class-trial-style anti-template guardrails while preserving model personas.
- Ordinary speech now keeps up to 4 sentences / 520 chars, while class-trial compact repair stays at 3 sentences / 360 chars so old class-trial repair behavior is not loosened.
- Added hard validation and repair guidance for low-info opening copy-paste, non-opening seats saying `我首置位`, repeated `压力源/只有观察点没结论` axes, and ordinary false positives around already-spoken seats and witch attribution.
- Fixed claim parsing for concise or colloquial hard claims: `我女巫`, public witch save reports, ordinary hunter self reports, and `8号Kimi，预言家。昨晚验2号查杀。`.
- Latest real Mimo sample: `tmp/ordinary-mimo-real-speech-seed91-day1-after-repeat-fix.md` / `.json`; 9 speeches, 7 real non-fallback Mimo rows, fallback 2, `repeatedPressureSourceCount: 0`, repeated fragments none.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts` passed: 6 files / 304 tests.
- Real Mimo temporary-env harness passed and generated `tmp/ordinary-mimo-real-speech-seed91-day1-after-repeat-fix.md`.

Remaining risks:
- The final sample is much less copy-paste-like than the earlier ordinary run, but not final subjective quality: 5号 still fell back after repeating the 1号 pressure axis, and 7号 fell back after requiring an already-spoken 4号 to supply logic.
- Several non-fallback rows still share ordinary-player phrasing such as `先认这个身份` / `这个点先记`, so the next quality pass should add more model-persona-specific expression without weakening rules correctness.
- The temporary real-Mimo test file was removed after generating the report; rerun by recreating a temporary harness or using a dedicated checked-in smoke script that does not contain secrets.

## 2026-06-08 Ordinary Player-Type Consistency And Player-Mouth Follow-up

Completed:
- Added stable ordinary player-type profiles for the AI Pool and default AI seats, with sliders/tuning feeding the existing risk, bluffing, and preference fields.
- Carried `ordinaryPlayerProfile` through `/api/games`, `/api/rooms`, room creation, local AI Pool storage, and selected AI friend payloads so ordinary single-player and room AI use the same AI configuration surface.
- Replaced model-name strategy stereotypes in ordinary mode with ordinary player-type strategy cards, while class-trial role cards still keep their own role-card strategy path.
- Updated ordinary speech/action prompts toward first-person player language and ordinary player-type strategy wording.
- Added ordinary speech validation/retry for global table review and stacked internal jargon such as `收益来源/发言链/闭合/收口/压力源`.
- Naturalized ordinary fallback speech so provider-error output stays in ordinary player language and avoids report-like death/audit wording in the covered paths.
- Removed the AI Pool legacy `打法类型速览` block, duplicate `普通局玩家类型速览` block, and right-side `参数说明/调参参考` card because they conflicted with the new ordinary player-type panel.
- Added ordinary successful-LLM speech naturalization for lighter report/rules-class wording such as `死亡形态/反面可能性/按规则推`, while stacked black jargon still triggers validation/retry before naturalization.

Changed files:
- `src/game/types.ts`
- `src/game/ordinaryPlayerProfiles.ts`
- `src/game/ordinaryPlayerProfiles.test.ts`
- `src/game/aiFriends.ts`
- `src/game/aiFriends.test.ts`
- `src/components/game/aiFriendStorage.ts`
- `src/components/game/aiFriendStorage.test.ts`
- `src/components/game/aiFriendLlmPresets.ts`
- `src/components/game/aiFriendLlmPresets.test.ts`
- `src/components/AiPoolClient.tsx`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/app/globals.css`
- `src/components/RoomClient.tsx`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/app/api/rooms/route.ts`
- `src/app/api/rooms/api.test.ts`
- `src/ai/personaStrategyCards.ts`
- `src/ai/personaStrategyCards.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/seatMemory.ts`
- `src/ai/seatMemory.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.test.ts src/components/game/aiFriendStorage.test.ts src/app/api/games/aiFriends.test.ts src/app/api/rooms/api.test.ts` passed: 9 files / 313 tests.
- `npm run test -- src/ai/speechProviders.test.ts src/components/AiPoolClient.mobile.test.ts` passed: 2 files / 231 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed.
- Real Mimo short sample using `.env.local` to override stale `.env` credentials wrote `tmp/ordinary-mimo-player-mouth-seed91-retry.md` / `.json`: seed 91, 3 Day1 speeches, providers `mimo-speech:mimo-v2.5-pro`, fallback 0, errors 0, validation failures 0, covered jargon/rules-class hits 0.
- The AI Pool page was opened at `http://127.0.0.1:51625/ai-pool`; latest report file `D:\ai-werewolf\tmp\ordinary-mimo-player-mouth-seed91-retry.md` was opened for manual review.

Remaining risks:
- The real Mimo sample is only 3 Day1 speeches for cost/time control, not a full 9-speech or full-game subjective pass.
- The latest Mimo rows are more first-person and no longer use the covered black jargon, but D1 still leans into death/witch-rule discussion (`毒口/药瓶`) more than a casual human player might. A later quality pass can push that further toward "我听谁哪里不对" instead of rules explanation.
- This pass did not run a browser room smoke; room consistency is covered by API/client unit tests and source wiring.

## 2026-06-08 Ordinary Death-Shape Rule-Lecture Follow-up

Completed:
- Tightened ordinary no-guard witch death-shape handling in table memory, table-read speech tasks, LLM prompt guidance, validator, retry repair, and fallback/naturalize paths.
- D1 single death is now framed as one-line common sense: `狼刀成功，女巫没救/没用解药`; peace night is framed as one-line common sense: `女巫用了救药/解药`.
- Ordinary speeches that expand into rule lessons such as `狼首夜必刀`, `女巫手里有解药`, `毒口重合刀口`, or `药瓶状态` now fail validation unless the actual witch is publicly claiming true potion information.
- Ordinary speeches that mention the death shape but do not push a concrete game action now fail validation; accepted actions include suspicion, temporary hold, direct question, pressure, identity boundary, or voting condition.
- Real Mimo seed 12 single-death sample: 4号 died, 5号 Mimo produced non-fallback `mimo-speech:mimo-v2.5-pro`, validation errors 0, covered rule-lecture/jargon hit false, and the line moved into asking 1号 to give concrete initial reads.

Changed files:
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm run test -- src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/game/tableMemory.test.ts` passed: 3 files / 260 tests.
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 7 files / 322 tests.
- `npx tsc --noEmit --pretty false` passed.
- `node scripts/check-llm-output.mjs --task=speech --persona=mimo --retries=1` passed with temporary process env loaded from `.env` then `.env.local`: 1 Mimo speech, OK, provider `mimo-speech:mimo-v2.5-pro`.
- One-off real Mimo ordinary single-death sample passed with temporary process env loaded from `.env` then `.env.local`: seed 12, deaths `[4]`, seat 5 Mimo, non-fallback, no validation errors, no covered rule-lecture/jargon hits, and concrete game action detected.

Remaining risks:
- The real Mimo sample is one targeted single-death line, not a full 9-speech or full-game subjective pass.
- Earlier lineup-based `evaluate-llm-game.mjs` attempt still routed through other persona fallbacks and hit external balance errors, so use direct Mimo/persona-specific harnesses for future Mimo checks unless the evaluation script is fixed.
- This pass targets death-shape rule lectures and no-action descriptions; broader personality/emotion variety can still be improved in a later subjective pass.

## 2026-06-08 Ordinary Day1 Mimo Quality Repair Follow-up

Completed:
- Ran a full ordinary Day1 Mimo seed 12 speech-quality check after the death-shape fix. The check used the ordinary `9p-seer-witch-hunter` board, all AI seats configured through runtime custom Mimo LLM config, mock night/actions, and real Mimo for Day1 speeches only.
- Fixed ordinary validator gaps for cut-off non-fallback speech endings such as `我先把1`, `有个点我卡住了：1号`, and `我倒想知道`.
- Fixed ordinary fallback wording that repeated audit-like templates: `我只抓一个点`, `结论给出来了`, `中间过程没完全说透`, `刚才那句话我先记下来`, and `接一下这条发言链`.
- Replaced the ordinary Mimo fallback opener `我抓一个细节` with less repetitive player-mouth wording.
- Added ordinary validator coverage for two quality failures found in real samples: attacking settled no-guard witch single-death common sense as `带节奏`, and saying `我改口了` without giving the new read.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- Red tests first failed for ordinary cut-off speech and repeated fallback templates.
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary speeches that end with a cut-off"` passed after the final cut-off fix.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 1 file / 230 tests.
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 7 files / 326 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed with CRLF warnings only.
- Latest real Mimo seed 12 Day1 sample after most fixes: 8 speeches, all `custom-speech:mimo-v2.5-pro`, fallback 1, covered bad-template hits 0, but one non-fallback line ended with `我倒想知道`; this exact shape is now covered by the final local cut-off validator test.

Remaining risks:
- The final validator fix for `我倒想知道` was not followed by another real Mimo run to avoid another expensive provider cycle; it is covered by focused and full local tests.
- Subjective quality is improved but not perfect: the latest real sample still circles around the death/intention topic more than a strong human table would.
- Future work should reduce malformed-output fallback rate and add a reusable ordinary Day1 Mimo harness script, rather than continuing to paste one-off inline scripts.

## 2026-06-08 Ordinary Day1 Mimo Intent Repair Follow-up

Completed:
- Fixed the latest user-reviewed ordinary D1 bad speech shape: prompt/table-read/table-memory now use single ordinary-player wording for no-guard witch death shape: `狼刀成功，女巫没救` and `女巫用了救药`. The old combined wording `没救/没用解药` and `救药/解药` is no longer emitted by source guidance.
- Added ordinary validation for first-night wolf-kill-intent homework. D1 no-guard ordinary speeches that ask `狼队为什么刀`, discuss `刀法意图`, or say `后置位有人答上来我倒想知道` now fail with `普通局首夜不要追问狼刀意图`.
- Added a specific ordinary low-info repair reason for arbitrary future-seat tasking when a speaker skips the next unspoken seat and directly assigns a later seat a generic explanation task.
- After a real Mimo sample hallucinated `7号走的，狼刀成功女巫没救` in a peace-night/no-public-death context, added validators and regressions for invented night deaths: `平安夜不能凭空报夜死` and `没有公开死讯不能报夜死`.
- Restored the dirty `llmEvaluation` helper implementation so the existing ordinary AI evaluation tests compile and run.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- Red tests first failed for old `没救/没用解药` prompt wording, first-night wolf-kill-intent questions, and arbitrary skipped future-seat tasks.
- `npm run test -- src/ai/speechProviders.test.ts -t "death-shape wording|first-night wolf kill intent|skip the next unspoken seat|peace-night wording"` passed: 4 focused tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "invent night deaths|hallucinate a dead seat"` passed after adding the invented-death validators.
- Real Mimo sample using temporary process env loaded from `.env` then `.env.local`: `tmp/ordinary-mimo-d1-intent-repair-1780935075255.md` / `.json`, 4 speeches, fallback 2, old bad-pattern hits 0, providers all `custom-speech:mimo-v2.5-pro`; it still exposed a non-fallback invented `7号走的` line, which is now covered locally.
- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 1 file / 15 tests.
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts src/ai/llmEvaluation.test.ts` passed: 8 files / 346 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- No third real Mimo sample was run after the invented-death validator. The latest real sample is useful evidence and the exact failure is covered locally, but do not claim the spoken transcript is solved until a fresh Mimo sample shows it.
- The broader ordinary Day1 personality/emotion issue is improved by guardrails, not fully solved; future work should continue reviewing real transcripts rather than only adding phrase bans.

## 2026-06-09 Ordinary Day1 Mimo Post-validator Follow-up

Completed:
- Ran the next approved real Mimo sample after the invented-death validator: `tmp/ordinary-mimo-d1-post-validator-1780981545992.md` / `.json`, 6 D1 speeches, fallback 5, old death wording 0, kill-intent 0, rule-lecture 0. It showed two remaining issues: fallback invented `平安夜` despite a death board, and fallback still assigned generic future-seat homework.
- Fixed provider-error fallback so public death announcements produce death-aligned fallback wording (`狼刀成功，女巫没救`) instead of fake `平安夜`, and removed generic lines like `轮到X号时，说清你最想暂放或怀疑谁`.
- Reran real Mimo after the fallback fix: `tmp/ordinary-mimo-d1-post-fallback-fix-1780982116448.md` / `.json`, 6 D1 speeches, fallback 3, old death wording 0, kill-intent 0, rule-lecture 0, false-peace 0, generic future-task 0.
- The rerun still showed a subjective issue in non-fallback 4号: it skipped 5号 and directly asked 6号 despite 6号 not having spoken. Added a validator regression for single skipped future-seat questions, so this shape now fails with `普通局低信息不要跳过下一位直接布置后置任务`.

Changed files:
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `progress.md`
- `session-handoff.md`

Verification:
- Red tests first failed for death-board fallback saying `平安夜`, fallback assigning generic future-seat homework, and a single named skipped future-seat question.
- `npm run test -- src/ai/speechProviders.test.ts -t "provider-error fallback aligned|provider-error fallback from assigning generic"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "only one future seat is named"` passed.
- `npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts src/ai/llmEvaluation.test.ts` passed: 8 files / 349 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed with CRLF warnings only.
- Real Mimo temporary-env sample after fallback fix: `tmp/ordinary-mimo-d1-post-fallback-fix-1780982116448.md`, 6 speeches, fallback 3, covered bad-pattern hits 0.

Remaining risks:
- No fresh real Mimo sample was run after the single-future-seat skip validator; the exact bad 4号 shape is covered locally, but another sample is needed before claiming this transcript issue is gone live.
- Fallback rate is still high at 3/6 in the latest sample, with provider `fetch failed` and malformed-output errors. The next useful work is reducing fallback causes and making fallback less repetitive, not adding broad phrase bans.

## 2026-06-09 Ordinary AI Evaluation Tooling

Completed:
- Built the first local ordinary Werewolf AI evaluation command for speech/action scoring and report output.
- Added reusable local scoring helpers in `src/ai/llmEvaluation.ts` and focused tests.
- Added `scripts/eval-ordinary-ai.mjs` with `source=mock`, `source=existing`, JSON/Markdown output, and promptfoo case export.
- Added `scripts/evaluate-llm-game.mjs --eval-cases-out` so future LLM samples can feed the same evaluator.
- Added optional promptfoo judge prompt/config/provider without running a live judge call.

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
- `progress.md`
- `session-handoff.md`

Verification:
- `npm run test -- src/ai/llmEvaluation.test.ts` passed: 1 file / 15 tests.
- `node --check` passed for the new/modified `.mjs` scripts.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json` passed and wrote 54 local cases.
- `npm run llm:evaluate -- --provider=mock --allow-mock --games=1 --max-llm-calls=2 --json --out=tmp/llm-eval-smoke.json --eval-cases-out=tmp/ordinary-ai-eval-cases.json` passed and wrote 2 dry eval cases.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json --json --out=tmp/ordinary-ai-eval-existing.json` passed.
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --judge=promptfoo --json --out=tmp/ordinary-ai-eval-promptfoo-prep.json` passed and wrote 54 promptfoo cases.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.

Remaining risks:
- Scoring thresholds are a first pass and need calibration against manually reviewed ordinary transcripts.
- Real LLM generation and promptfoo live judging were skipped for cost control.

## 2026-06-11 Ordinary Mimo v26 Fable Minifix Handoff

Completed:
- Applied the latest Fable5 v25 critique as a minimal local repair, not a new broad prompt/validator iteration.
- Fixed the mock/fallback splicing regression where repeated full labels could produce `边界放清：不把直接打死`; repeated full labels now degrade to `N号`.
- Added used-once selection for mock bridge text across previous-speaker, support, rally, agenda, public-role, counter-push, and focus-evidence paths.
- Strengthened `repeated_clause_rate` so it reads full output text and reports normalized repeated long clauses after replacing seat numbers and player names.
- Added the review pack for external review: `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md`.

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

Evidence:
- `tmp/ordinary-mimo-v26-post-fable-minifix-mock-eval.json`: 30 cases, averageScore 100, issueCount 0, highRiskCaseIds empty, and 2 report-only `sampleMetrics` warnings. This proves the repeated-clause gate is no longer silent.
- `tmp/ordinary-mimo-v26-post-fable-live-report.json` / `tmp/ordinary-mimo-v26-post-fable-live-eval-cases.json`: bounded live Mimo attempt reached the provider but all 8 speech calls failed with HTTP 403 `insufficient_user_quota`; the transcript is fallback-only.

Verification:
- Minifix loop passed focused speech/evaluator tests, 3-file AI aggregate, and local mock eval.
- Final verification passed:
  - `npm run test -- src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts`: 6 files / 398 tests passed.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx eslint src/ai/tableRead.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts` passed.
  - `npm run harness:task-card -- docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md` passed.
  - `npm run harness:long-tasks` passed.
  - JSON parse for `long_running_tasks.json` passed.
  - `npm run harness:check` passed.
  - `git diff --check` passed with LF/CRLF warnings only.

Remaining risks:
- No real live Mimo style sample is available after v26 because quota blocked all calls.
- The remaining mock warnings should be treated as guardrail evidence, not as a reason for another broad local positive-supply pass.
- Next engineering action after quota/key state is fixed: run a bounded paid live Mimo Day 1 sample of 6-9 speeches, then review manually plus `sampleMetrics`.

## 2026-06-13 12p Full-Game Low-Cost Follow-Up

Completed:
- Ran a complete local mock game for `12p-sheriff-seer-witch-hunter-guard` after the bounded paid 12p mechanism gate.
- Fixed local full-game surface defects in:
  - direct mock command hard Seer claim dedupe,
  - direct mock command hard role motive-text filtering,
  - numbered `speech_influence` cue naturalization,
  - pressure-chain evidence wording variety.
- Added focused 12p direct mock command regressions for Seer and Hunter sheriff speeches.
- Added `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md` and updated `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`.

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
- Do not spend another paid sample by default; run one only if the user wants real-model full-game feel proof.

Older v26 recommended next step:
- Give `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md` to Fable5 now if external review is needed before another paid run.
- Otherwise, top up/switch the temporary provider key and run the bounded live Mimo sample. Do not start phase 3 token reduction yet.

Current recommended next step:
- Treat the 12p local full-game hard gate as passed.
- Do not spend another paid sample by default.
- If the user wants real-model full-game proof, run one small paid 12p live sample and judge player feel manually plus local `sampleMetrics`.

## 2026-06-13 12p Evaluator Calibration After Paid Claim-Boundary Proof

Completed:
- Calibrated `logic_boundary_error` so legal references to public claimed-Seer
  checks by non-Seer speakers are no longer treated as fabricated private
  knowledge.
- Added regressions for the two paid-proof false-positive shapes:
  `6号Gemini那句话点到我了——两张预言家同时报9号查杀` and
  `2号Claude这轮直接报了8号Kimi查杀，昨天他报过9号DeepSeek2查杀`.
- Preserved the true hard error where a non-Seer speaker attributes a check to
  themself (`我验了9号...9号是查杀`).
- Kept complete vote-reason endings such as `这个转折我到现在没听明白。` out of
  `malformed_output_fragment`.
- Re-ran the exact paid proof cases offline:
  `tmp/12p-mimo-claim-boundary-paid-proof-after-evaluator-calibration-eval.json`.

Changed files:
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`

Verification:
- Red regression first failed for the real public-check quote false positive.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "public seer claims"` passed.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-claim-boundary-paid-proof-cases.json --json --out=tmp/12p-mimo-claim-boundary-paid-proof-after-evaluator-calibration-eval.json` passed: 60 cases, averageScore 99.1, issueCount 3, `logic_boundary_error` 0, `malformed_output_fragment` 0, highRiskCaseIds empty.

Remaining risks:
- Remaining sample signals are report-only: repeated sheriff-standard wording
  and `rolePublicAction` skew.
- No paid rerun was performed for this evaluator-only change by design.
- The paid proof is bounded and stops at day 2; it is not a complete paid
  full-game proof.

Current recommended next step:
- Treat the 12p hard-gate mechanism as `go` unless the user wants a separate
  subjective full-game feel run.
- Do not spend another paid bounded proof for the evaluator calibration.
- Next engineering work should move to the next 12p feel category or Public
  Alpha consolidation, not another hard-gate rerun.

## 2026-06-13 12p Full-Game Mock Recheck After Evaluator Calibration

Completed:
- Reran a complete low-cost local mock game for
  `12p-sheriff-seer-witch-hunter-guard` after evaluator calibration.
- Confirmed local full-game hard gates remain clean through day 5 `GAME_OVER`.
- Reran local ordinary evaluator on the new full-game cases.
- Updated
  `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md`.

Changed files:
- `docs/evaluations/2026-06-13-12p-fullgame-lowcost-diagnostic.md`
- `progress.md`
- `session-handoff.md`

Verification:
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-cases.json` passed: 1/1 game completed, day 5 `GAME_OVER`, 146 calls, 40 speech, 106 action, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-eval.json` passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.

Remaining risks:
- This is still local mock proof, not paid Mimo full-game player-feel proof.
- The evaluator still reports two low-frequency surface warnings:
  `最卡的反应往回听` 2/26 and
  `从{seat}号这条压力转看{seat}号...` 2/26.
- These are report-only and should not trigger local hard-rule work.

Current recommended next step:
- If continuing 12p full-game read-feel acceptance, run one small paid Mimo
  full-feel sample focused on cross-day continuity, late-game public information
  handling, and seat-specific player identity.
- If cost control is more important, stop here: local complete-game hard gates
  are clean and there is no free local blocker left.

## 2026-06-13 Tencent Deploy: 12p Hard-Gate Passed Worktree

Completed:
- Uploaded and deployed the current `codex/12p-mimo-speech-mechanics`
  hard-gate/evaluator-calibration worktree to the Tencent Cloud primary Alpha.
- Created a clean source archive from the local dirty tree, excluding `.env*`,
  `.git`, `.next`, `.local`, `node_modules`, `tmp`, generated DB files, logs,
  and generated audio caches.
- Uploaded archive:
  `/tmp/ai-werewolf-hardgate-20260613-192918.tar.gz`.
- Replaced `/opt/ai-werewolf/app` with the unpacked archive and rebuilt only the
  app service.
- Rollback tree on server:
  `/opt/ai-werewolf/app-backup-20260613-192918`.
- Live container image:
  `sha256:22849e5c5a3cb9ddc5add801cb80dd718241b0fcb125fad233de193404158095`.

Changed files:
- `docs/current-release.md`
- `progress.md`
- `session-handoff.md`

Verification:
- Server Docker build completed; Next production build passed with the existing
  Turbopack NFT trace warning.
- `ai-werewolf-app` reached Docker health `healthy`.
- `npm.cmd run preflight:production -- --base-url=https://175.178.199.245`
  passed: `ok=true`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-sse`
  passed: room `6JTSJC`.
- `$env:ROOM_SMOKE_BASE_URL='https://175.178.199.245'; npm.cmd run smoke:room-action:vote`
  passed: room `T95XIB`, covered `wolfKill`, `witchAction`, `speak`, and
  `vote`, final phase `LAST_WORDS`.

Remaining risks:
- Deployed from a local archive first, then the deployed content was committed
  and pushed as `a214e67 Stabilize 12p Mimo hard gate` on
  `origin/codex/12p-mimo-speech-mechanics`.
- Render mirror was not updated.
- This makes the hard-gate-passed work visible on Tencent Cloud, but does not
  replace a future paid Mimo complete-game feel sample.

Current recommended next step:
- For continued 12p read-feel work, run one small paid Mimo full-feel sample
  against the current code path and review cross-day continuity.
- For release hygiene, commit/push the deployed worktree or split it into
  intentional commits before further public-facing changes.

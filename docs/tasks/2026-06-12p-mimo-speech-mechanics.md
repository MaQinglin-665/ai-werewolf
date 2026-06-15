# 12p Mimo Speech Mechanics

Status: paid hard gates passed and local evaluator calibrated; external review chose continue-local after the fresh D3 proof because quoted-check extraction was still blacklist-shaped; the extractor now uses bounded verb-class ownership rules, DeepSeek later exposed and local tests fixed target-before-pronoun plus same-sentence quote-then-self-check fake-Seer omissions; a local live-shape invariant suite and 550-case rescan now show no known missed self-owned Seer check, so paid reruns are paused unless the user explicitly asks for one final acceptance proof

## Task

Short name: 12p-mimo-speech-mechanics

Goal: Apply the accepted Fable5 mechanism direction to ordinary Werewolf speech
before spending a 12-player Mimo validation run.

Why it matters: The 9-player Mimo line reached a basic acceptance bar for
single-sentence correctness, but the next gap is table-level player identity:
different seats should carry different habits, private motivation, pressure
budgets, and opening shapes across the whole game.

## 2026-06-13 Paid Full-Game Follow-up

Evidence:

- `tmp/12p-mimo-fullfeel-paid-after-hardgate-report.json`
- `tmp/12p-mimo-fullfeel-paid-after-hardgate-cases.json`
- `tmp/12p-mimo-fullfeel-paid-after-hardgate-eval.json`
- `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`

Result:

- The paid Mimo run completed a full 12p game: 85 calls, day 3 `GAME_OVER`,
  GOOD win, fallback 5, error 5, validationFailure 3.
- Local eval: 80 cases, averageScore 99.2, issueCount 3, highRiskCaseIds 1.
- Exact hard-gate scans stayed clean for hidden wolf-strategy leak, accepted
  fragments, and non-Seer claimBoard checks.
- New review blocker: `publicClaimBoard` attached both `WEREWOLF` and `GOOD`
  checks on 1号 DeepSeek to 11号 GPT2's claimed-Seer entry after 11号 quoted
  2号 Claude's old 1号金水 while claiming a new 1号查杀.

Decision:

- Opus review chose `continue`: the full-game read-feel is basically passable,
  but the contradictory claimed-Seer attribution is a hard structural check
  ownership blocker.
- Keep the next cut narrow: claimed-Seer attribution when a speaker references
  another claimed/dead Seer's prior check in the same sentence. Treat late-game
  public-check validator false positives as a follow-up observation, not a
  parallel patch.
- Do not start broad phrase bans, action quotas, or another local mock/eval
  loop.

Local follow-up:

- Added a regression for the D3 11号 GPT2 text:
  `昨晚验了1号DeepSeek，查杀...2号昨晚倒牌，他之前报过1号金水...`.
- `extractClaimChecks()` now skips check-like text when the immediate sentence
  prefix attributes it to another seat or pronoun, such as `他之前报过`.
- `dedupeChecks()` now keys by claimant and target, so the same claimed Seer
  cannot carry both `GOOD` and `WEREWOLF` for the same target.
- Existing Seer self-owned fake checks still parse normally; non-Seer check
  boundary remains unchanged.

Verification:

- Red regressions first failed for the referenced old check and contradictory
  same-target checks, then passed after the fix.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 30 tests.
- `npm.cmd run test -- src/game/tableMemory.test.ts` passed: 7 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 368 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/ai/llmEvaluation.test.ts`
  passed: 45 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Current decision:

- Do not call `go` yet; this was fixed locally after the full-game paid sample.
- Next proof should be one bounded paid run covering the D2/D3 claimed-Seer
  reference shape. Acceptance: zero claimed-Seer same-target contradictions,
  quoted old checks are not attached to the quoting speaker, old hard gates
  remain 0, and B-class false positives are checked before deciding whether
  they need a separate local fix.

## 2026-06-14 Cross-Seer Bounded Paid Proof

The user approved a bounded paid proof after the cross-Seer attribution fix.
The first 120-call runner was stopped after producing no report/cases; the
second runner used a 1-call preflight and a 60-call proof, with the temporary
Mimo base URL and key held only in the runner process environment.

Evidence:

- `tmp/12p-mimo-cross-seer-attribution-preflight-report.json`
- `tmp/12p-mimo-cross-seer-attribution-preflight-cases.json`
- `tmp/12p-mimo-cross-seer-attribution-small-report.json`
- `tmp/12p-mimo-cross-seer-attribution-small-cases.json`
- `tmp/12p-mimo-cross-seer-attribution-small-eval.json`

Result:

- The preflight completed 1 real Mimo action call with fallback 0, error 0,
  validationFailure 0.
- The 60-call proof reached day 2 `DAY_VOTE` and stopped at `max_llm_calls`;
  it did not reach the original day 3 dead-Seer old-check trigger.
- Proof summary: 60 calls, 22 speech, 38 action, fallback 2, error 2,
  validationFailure 0, totalQualityIssues 0.
- Local eval: 60 cases, averageScore 98.1, issueCount 6, highRiskCaseIds 1.

Hard-gate scan:

- Claimed-Seer same-target contradictory checks: 0.
- Non-Seer claimBoard checks: 0.
- Private leak exact hits: 0.
- Accepted fragment hard-shape hits: 0.
- Secret scan over the generated cross-Seer proof files found 0 long API-key
  or bearer-token patterns.

Readback:

- The live D2 envelope stayed structurally clean after the local attribution
  fix. Seer claims retained their own checks; no claimed Seer carried both
  `GOOD` and `WEREWOLF` for the same target.
- The one `logic_boundary_error` high-risk row appears to be a local evaluator
  false positive for a legal public claimed-Seer check reference: 3号 GPT
  discussed 2号 Claude's public 9号查杀, and the row's `publicClaimBoard`
  already contained 2号 Claude as claimed Seer with that check.
- The proof is not a full `go` proof for the original bug because it stopped
  at D2 and never sampled the D3 pattern where a fake Seer quotes a dead
  Seer's prior gold check.

Current decision:

- Treat A as locally fixed and live-clean in the D2 bounded envelope.
- Opus review judged this `partial-pass` and recommended a
  `longer-bounded-rerun`, because the D2 proof did not exercise the original
  D3 dead-Seer old-check quote trigger.
- B has now been calibrated offline so the next rerun's high-risk count is not
  polluted by legal public-check references.
- Next useful step is one longer same-seed paid run with enough budget to reach
  D3. Do not resume local regex/evaluator-only work unless that rerun exposes a
  new concrete mechanism defect.

## 2026-06-14 B-Class Evaluator Calibration After Cross-Seer Proof

Opus review classified the D2 proof's single high-risk row as an evaluator
false positive, not a mechanism leak. The row was 3号 GPT legally discussing
2号 Claude's public 9号查杀 while also quoting "9号查杀前那句...".

Root cause:

- The evaluator's public-check attribution scanner treated bare `查` / `验`
  as report verbs.
- That allowed noun phrases such as `查验线` and `查杀前那句` to be interpreted
  as check-report syntax, producing a false `logic_boundary_error`.

Local follow-up:

- Added a regression for the exact 3号 GPT public-check quote shape.
- Added a negative regression where the same wording remains an error if
  `publicClaimBoard` does not contain 2号 Claude's 9号查杀.
- Tightened evaluator report verbs to `报/给/甩/打/留/查了/验了/查验了`, avoiding
  nouny `查验线` / `查杀前` matches without broadly allowing fabricated checks.

Verification:

- Red regression first failed for the real high-risk row.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "public seer claims"`
  passed after the calibration.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-small-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-small-after-b-calibration-eval.json`
  passed: 60 cases, averageScore 98.6, issueCount 5,
  `logic_boundary_error` 0, highRiskCaseIds empty.

Current decision:

- B is evaluator-calibrated offline; do not spend paid calls on B itself.
- The next paid run should target A's missing D3 live trigger only: same seed
  91, one game, enough budget to reach D3, and manual/publicClaimBoard review
  of any fake-Seer quote of another claimed/dead Seer's old check.

## 2026-06-14 Longer D3 Paid Proof And Local Follow-up

The user approved the longer same-seed paid proof after B calibration. It did
reach the D3/D4 envelope, but it exposed the exact non-contradictory attribution
pollution that the D2 proof could not disprove.

Evidence:

- `tmp/12p-mimo-cross-seer-attribution-d3-90-report.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-90-cases.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-90-eval.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-90-after-localfix-eval.json`

Run result:

- 90 calls, 33 speech, 57 action.
- Stop reason: `max_llm_calls`; the run reached D4 `DAY_SPEECH` after D3
  `DAY_SPEECH` and `DAY_VOTE`.
- fallback/error: 9/90.
- validationFailureCount: 6.
- Report quality issues: one `speech_vote_discontinuity` only.
- Local eval before the new local fixes: 80 cases, averageScore 99.1,
  issueCount 4, highRiskCaseIds 1. The high-risk row was the same
  sheriff-nomination wording shape and not a mechanism leak.

Hard result:

- Claimed-Seer same-target contradictions: 0.
- Non-Seer claimBoard checks: 0.
- The D3 manual/publicClaimBoard review found a hard A failure anyway:
  8号 Kimi claimed Seer, self-reported 1号 DeepSeek as `WEREWOLF`, and quoted
  1号 DeepSeek's public claim that 2号 Claude was `WEREWOLF`. The extracted
  board incorrectly attached both 8->1 `WEREWOLF` and 8->2 `WEREWOLF` to
  8号 Kimi.
- This is non-conflicting check pollution, so the same-target contradiction
  guard could not catch it. It directly confirms Opus's warning that attribution
  itself, not just contradiction, had to be proven live.
- The accepted-fragment hard gate also failed on D3 7号 GLM:
  `说实话，1号DeepSeek，你今天这条查验我先挂着。你报2号Claude查杀，但刚才那段发言的重点全在`.

Local follow-up:

- Added a red regression for the exact 8号 Kimi counterclaim sentence shape.
- Expanded `extractClaimChecks()` so another explicit seat or pronoun subject
  reporting a target in the same sentence is treated as a quoted check, not the
  current speaker's own structured check.
- Added shared ordinary-surface detection for unfinished focus-marker tails
  such as `重点全在`.
- Reused that detector in provider validation and local ordinary eval so this
  fragment class does not drift between acceptance and scoring.

Verification:

- Red tests first failed for the 8号 Kimi attribution pollution and the
  `重点全在` fragment, then passed after the local fixes.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 31 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 369 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/claims.test.ts src/game/tableMemory.test.ts`
  passed: 83 tests.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-d3-90-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-d3-90-after-localfix-eval.json`
  passed: 80 cases, averageScore 98.9, issueCount 5, and
  `malformed_output_fragment` 1 for the old accepted fragment.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Current decision:

- Do not call this `go`. The longer paid proof failed the attribution hard
  gate and accepted-fragment hard gate, even though it gave a precise local
  fix target.
- Do not keep doing local regex-only work after these two concrete fixes.
- Next proof, after explicit user approval/provider input, should be one fresh
  bounded same-seed D3 paid proof. Old D3-90 cases still contain stale
  extraction metadata, so only a fresh run can prove the claimBoard is now clean
  in live generation.

## 2026-06-14 Fresh D3 Paid Proof And Target-Subject Fix

The user approved one fresh same-seed bounded D3 proof after the D3-90 local
fixes. The run reached the target envelope, but it still failed the structured
claim attribution gate through a new target-as-subject phrasing.

Evidence:

- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-report.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-eval.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-hardscan.json`
- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-status.json`

Run result:

- 90 calls, 33 speech, 57 action.
- Stop reason: `max_llm_calls`; reached D4 `DAY_SPEECH`.
- fallback/error: 11/90.
- validationFailureCount: 4.
- totalQualityIssues: 0.
- Local eval: 80 cases, averageScore 97.6, issueCount 8,
  highRiskCaseIds 4.

Hard scan:

- Private leak hits: 0.
- Accepted fragment hard-shape hits: 0.
- Non-Seer claimBoard checks: 0.
- Claimed-Seer same-target contradictions: 0.
- The sample still failed the claim attribution gate: 8号 Kimi's D2 speech said
  `我是预言家，昨晚验的2号Claude，查杀`, but the exported board stored 8->2
  `GOOD`.

Root cause:

- The same Kimi speech also said `我现在更在意的是2号Claude刚才报的金水`.
- The generic `2号...金水` parser treated this as Kimi's own 8->2 `GOOD`
  check, even though 2号 was the subject who had reported a gold check.
- Claim dedupe by claimant+target then kept the bad `GOOD` entry and suppressed
  the later self-owned 8->2 `WEREWOLF` result.

Local follow-up:

- Added a red regression for the exact fresh-proof Kimi text.
- `sentenceReferencesOtherClaimCheck()` now skips target-as-subject quoted
  reports such as `2号Claude刚才报的金水`.
- The filter is intentionally limited to explicit report/quote cues
  (`刚才/之前/今天...报/给/留/说/称`) so legal self-owned forms such as
  `昨晚验的2号Claude，查杀` still parse.

Verification:

- Red regression first failed with 8->2 `GOOD`, then passed with 8->2
  `WEREWOLF`.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 32 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts`
  passed: 52 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 369 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Current decision:

- Do not call this `go`. The fresh paid proof reached D3/D4 but failed the
  claim attribution hard gate.
- The new target-as-subject failure is locally fixed and test-backed.
- Another paid proof is required for live acceptance, but it should only run
  after explicit user approval/provider input. Do not spend more paid calls
  automatically from this proof's authorization.

## 2026-06-14 Continue-Local Structural Attribution Fix

External review chose `continue-local`, not `rerun-now`: the prior local fixes
closed individual quote phrasings, but the extractor still had the wrong shape:
it broadly treated `验/查 + target + 查杀/金水` as self-owned, then subtracted
quoted-check patterns with blacklist rules. The requested local cut was to flip
ownership toward bounded verb classes.

Local follow-up:

- `extractClaimChecks()` now only treats check results as the speaker's own
  structured checks when the governing verb is an owned check verb such as
  `验/查/摸` with speaker or omitted subject.
- Quoted/report verbs such as `报/说/称/给/留`, or check verbs whose subject is
  another seat/pronoun, do not create a check for the current speaker.
- Added a two-sided regression covering the fresh-proof class:
  `2号Claude给的金水` and `4号豆包留的2号查杀` are ignored as speaker checks,
  while `昨晚验的2号Claude，查杀` remains a valid self-owned fake-Seer check.
- Kept the same claimant+target dedupe guard as a visible contradiction
  backstop, but it is not treated as the main proof.
- Calibrated the local evaluator for the fresh D3 legal quote
  `我先接一下2号Claude。他刚才报了12号豆包2金水...他自己第一天报的也是9号DeepSeek2查杀`.
  The evaluator now uses the public claim board claimant where the quote is
  a legal reference to a claimed Seer's public check.

Offline re-eval:

- `tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`
  was generated from existing cases only; no paid call was made.
- Summary: 80 cases, averageScore 98, issueCount 7,
  `logic_boundary_error` 2, highRiskCaseIds 3.
- The previous 3号 GPT legal public-check quote is no longer high-risk.
- The two remaining `logic_boundary_error` rows are derived from the stale
  fresh-proof board that stored Kimi as 8->2 `GOOD`; they cannot prove the
  source fix because the metadata was generated before this local change.
- The remaining `bad_followup_target` row is D3 9号 targeting dead 2号 and is
  separate from the structured check attribution gate.

Verification:

- Red regression first failed for the verb-class quote shape, then passed.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 33 tests.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts`
  passed: 73 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 381 tests.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`
  passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Current decision:

- Do not rerun paid proof yet from the earlier authorization; it has already
  been spent.
- Next useful step is exactly one fresh bounded same-seed D3 paid proof after
  explicit user approval/provider input.
- Acceptance must require the D3 fake-Seer/quoted-Seer trigger to actually
  appear, with no quoted-check pollution into the speaker's `checks`, no
  claimed-Seer same-target contradictions, old hard gates at 0, and no renewed
  B-class false-positive high-risk rows.

## 2026-06-14 DeepSeek D3 Proof And Pronoun Self-Check Fix

The user switched the temporary provider to DeepSeek for the next bounded D3
proof. The key/base URL were used through process environment only and were not
written to `.env`, docs, source, or command-line arguments.

Evidence:

- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-structural-proof.md`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-preflight-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-cases.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-eval.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-hardscan.json`

Run result:

- Preflight: 1 action call, fallback 0, error 0, validationFailure 0.
- Full DeepSeek-chat run: 85 calls, 30 speech, 55 action, completed day 3
  `GAME_OVER`, stopReason `game_finished`.
- Provider/fallback: fallback 3, error 3, validationFailure 0.
- Local eval: 80 cases, averageScore 98.6, issueCount 6, highRiskCaseIds empty.
- Hard scan stayed clean for private leak, accepted fragments, non-Seer
  claimBoard checks, and claimed-Seer same-target contradictions.

Hard local blocker found:

- The proof did not reproduce the original dead-Seer old-check quote trigger.
- It did expose the reverse side of the attribution rule: 11号 GPT2, an actual
  Werewolf, publicly claimed Seer and said
  `1号DeepSeek，我昨晚验的你，查杀`, but the exported board recorded
  11号 GPT2 as `SEER` with `checks: []`.
- This should parse as a self-owned fake-Seer check: 11->1 `WEREWOLF`.

Local follow-up:

- Added a regression for target-before-pronoun self-owned Seer checks.
- `extractClaimChecks()` now parses forms such as
  `1号DeepSeek，我昨晚验的你，查杀` as the speaker's own check.
- The earlier bounded verb-class ownership guard still keeps quoted/report
  checks from another seat out of the current speaker's `checks`.

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

Current decision:

- Still not `go`: the latest DeepSeek-chat proof is stale for live acceptance
  because the pronoun self-check parser fix landed after the report/cases were
  generated.
- The current process has no visible temporary DeepSeek/Mimo provider env, so
  a fresh proof requires user-supplied provider input again.
- Next proof should verify both sides: quoted checks do not pollute speaker
  checks, and self-owned fake-Seer checks including target-before-pronoun forms
  are retained.

## 2026-06-14 DeepSeek D3 Proof After Pronoun Fix

After the local target-before-pronoun fix, the user ran one fresh DeepSeek-chat
same-seed bounded D3/D4 proof through a temporary PowerShell runner.

Evidence:

- `docs/evaluations/2026-06-14-12p-deepseek-d3-after-pronounfix-proof.md`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-preflight-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-cases.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-eval.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-hardscan.json`

Run result:

- Preflight: 1 action call, fallback 0, error 0, validationFailure 0.
- Full run: 100 calls, 33 speech, 67 action, reached day 4 `DAY_SPEECH`, stopped
  at `max_llm_calls`.
- fallback/error: 1/100.
- Report validationFailureCount: 1.
- Local eval: 80 cases, averageScore 97.7, issueCount 8, highRiskCaseIds 3.
- Hard scan stayed clean for private leak, accepted fragments, non-Seer checks,
  and claimed-Seer same-target contradictions.

Hard local blocker found:

- The 11号 target-before-pronoun trigger did not recur.
- A same-sentence mixed attribution variant did recur:
  `2号Claude跳预言家报9号查杀，我先不听这个，因为我是预言家，昨晚验的2号Claude，查杀。`
- The first clause is a legal quote of 2号's public check. The later clause is
  4号 豆包's own fake-Seer check against 2号.
- The exported board recorded 4号 豆包 as claimed Seer with `checks: []`, so
  downstream legal references to 4号's 2号查杀 became high-risk evaluator rows.

Root cause:

- `isReferencedOtherClaimantCheck()` judged quoted-check ownership at whole
  sentence scope. The first quoted-check clause suppressed the later self-owned
  clause in the same sentence.

Local follow-up:

- Added a regression:
  `keeps a same-sentence self-owned check after quoting another seer check`.
- `isReferencedOtherClaimantCheck()` now scopes quoted-check ownership to the
  local attribution clause around the candidate check, not the whole sentence.

Verification:

- Red regression first failed with `checks: []`.
- `npm.cmd run test -- src/game/claims.test.ts -t "same-sentence self-owned check"` passed.
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

Current decision:

- Not `go`: the fresh post-pronounfix proof reached the target envelope but
  failed the self-owned structured-check side.
- Do not classify the three high-risk rows as pure evaluator false positives:
  they are downstream of stale board metadata caused by the missing 4->2 check.
- The local fix is narrow and test-backed; another live acceptance proof would
  require fresh user-approved provider input.

## 2026-06-14 Local Attribution Invariant Suite And Rescan

After the user raised cost concerns, paid reruns were paused. Instead, the
known live attribution shapes were converted into a deterministic invariant
matrix, then current extraction was replayed over existing paid/live case files.
No model calls were made in this pass.

Evidence:

- `src/game/claims.test.ts`
- `tmp/12p-claim-attribution-local-rescan.json`

Invariant coverage:

- Dead-Seer old check quote: speaker's new self-owned check is kept; quoted old
  check is not attached to the speaker.
- Target-before-pronoun self-check: `1号DeepSeek，我昨晚验的你，查杀`
  becomes the speaker's own `WEREWOLF` check.
- Target-as-subject quote before self-check: `2号Claude刚才报的金水` does not
  suppress `昨晚验的2号Claude，查杀`.
- Report verbs such as `给/留/报/说/称` do not create speaker-owned checks.
- Same-sentence quote then self-check keeps the later self-owned check.
- A current claimed-Seer quote after the speaker's own check does not add a
  second quoted check to the speaker.

Rescan result:

- Existing case files scanned: 6.
- Cases scanned: 550.
- Speech rows scanned: 246.
- Extracted Seer claims: 30.
- `potentialMissingSelfCheckCount`: 0.
- `staleBoardMismatchCount`: 4. These are old exported board metadata
  mismatches from samples generated before the current extractor fixes, not new
  current-extractor misses.

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

Current decision:

- Cost-control stance: stop repeated paid probing for this bug class.
- The current extractor has deterministic coverage for every live attribution
  shape found so far and did not miss any self-owned Seer check when replayed
  over the existing case corpus.
- Not full `go` from live evidence yet: the local clause fix itself has not
  been proven by a fresh paid run. The only remaining paid work should be one
  final bounded acceptance proof if the user explicitly approves provider use.

## 2026-06-14 Commit / Review Prep

After the user chose to stop here for commit/review, the branch was checked
against the full local suite. The full suite initially exposed stale assertions
that still expected older prompt/audit labels and mock-speech templates, plus a
long mock-game test timeout that was too tight on the current local runtime.

Local follow-up:

- Updated `src/ai/expertStrategy.test.ts` to assert current stable table audit
  labels such as `身份说法`, `预言家说法`, `警长信息`, and `身份材料`.
- Updated `src/ai/tableRead.test.ts` to assert the current repeated-pressure
  audit wording: do not repeat the same opener gap; look for new reasons.
- Updated `src/game/engine.test.ts` to avoid brittle exact mock-speech wording,
  use a guided LLM sample that respects the current speech contract, and raise
  the 1000-game mock simulation timeout from 90s to 150s.
- No paid model calls were made.

Verification:

- `npm.cmd run test -- src/ai/expertStrategy.test.ts src/ai/tableRead.test.ts src/game/engine.test.ts`
  passed: 156 tests.
- `npm.cmd run test` passed: 100 files, 1218 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the existing Turbopack NFT trace warning in
  `next.config.ts` / `src/server/roomService.ts` / room debug cleanup route.

## Task Gate

Task type: AI speech / ordinary player-feel mechanics / paid-model validation

Risk level: medium

Required verification tier:

- [x] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no for mechanism code; transcript review replaces browser flow.
- If yes, flow or URL: not applicable.
- If skipped, reason: this task changes prompt/context/evaluation mechanics and
  validates with CLI transcript samples, not browser UI.

State updates required:

- [ ] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [x] `long_running_tasks.json`

Skipped checks must record:

- Check skipped: production deployment and browser smoke
- Reason: this is not a public release or UI change
- Residual risk: final player-feel acceptance still depends on a paid Mimo
  transcript and human readback

## Context To Read First

- `AGENTS.md`
- `README.md`
- `docs/harness-orientation.md`
- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/feature-registry.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `docs/evaluations/2026-06-12-ordinary-mimo-v46-final-acceptance-gate.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/speech/stability.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `scripts/eval-ordinary-ai.mjs`
- `scripts/evaluate-llm-game.mjs`
- `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md`
- `docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md`
- `progress.md`
- `session-handoff.md`
- `long_running_tasks.json`
- `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`

Files or directories the agent should not edit:

- `.env`
- `.env.local`
- generated caches
- `tmp` sample files except for newly generated reports
- `src/game/engine.ts`
- `src/components/**`
- production deploy scripts

## Definition Of Done

This task is complete when:

- Ordinary speech prompt input has stronger player identity dispersion:
  length lane, question tendency, filler/mouth habit, emotion amplitude, and
  risk posture are explicitly available to the model.
- Ordinary speech prompt input carries private in-game motivation beyond the
  last target: prior stance, last vote, who questioned the seat, and current
  embarrassment/defense pressure when available.
- Shared pressure budget triggers after two speakers on the same axis and
  steers later speakers toward different player moves.
- Opening/previous-speaker guidance explicitly allows ignoring, rebutting, or
  directly shifting away from ritualized "I first connect to the previous
  speaker" openings.
- Focused tests prove the new prompt/director behavior before implementation.
- A 12-player standard sheriff guard Mimo validation command is run if a valid
  temporary key is available through process env or a safe prompt helper.
- The 12-player sample is summarized for Fable5/human review.
- After Fable5 review, public role-claim handling is diversified into several
  ordinary player moves instead of one cautious bridge.
- Sheriff speech action candidates inherit ordinary-player mouth feel instead
  of using a fixed campaign line.
- Stale self-history targets that are no longer alive are downgraded to old
  context and not kept as current targets.
- Public-check fallback bridge text avoids reusing the same whole bridge line
  across the game.
- Public-check action validation resolves exact player names such as
  `DeepSeek2` before extracting digits, so grounded public checks against
  numbered model-name seats are not misread as fabricated.
- Adjacent exact duplicate sheriff claim sentences are covered by a speech
  provider regression test.
- Speech-side public-check validation uses the same exact-name-before-digit
  resolution, so numbered model-name targets are not misread in ordinary
  speeches.
- Generic counterclaim-status wording after a public Seer check is accepted as
  status reading instead of rejected as a fabricated Seer claim.
- Repeated full sheriff-standard quote propagation steers later ordinary seats
  toward paraphrase/reaction/other handling actions and removes `quoteOneLine`
  from that context.
- Public action reasons reject the actor leaking their own private role or
  night action, and repair fixable private-leak reasons to public candidate
  hints instead of forcing fallback.
- Public action reasons also reject softer own hidden-card labels such as
  `闭眼平民`, `闭眼位`, `闭眼好人`, `平民`, `民牌`, or `村民`.
- A final bounded 12p post-retryfix sample has fallback/error at 1/50,
  validation failures at 0, no high-risk eval cases, and no own night-action
  private leak in exported outputs.

## Verification

Required checks:

- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets|ritualized previous speaker opening"`
- `npm run test -- src/ai/speechProviders.test.ts -t "public-role claim handling|stale ordinary self-history|public-claim fallback bridge"`
- `npm run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates"`
- `npm run test -- src/ai/actionProviders.test.ts -t "target name ends with a digit|fabricate another player's public check result"`
- `npm run test -- src/ai/actionProviders.test.ts -t "public action reasons"`
- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary D1 first-check motive"`
- `npm run test -- src/ai/speechProviders.test.ts -t "dedupes adjacent repeated sheriff claim sentences"`
- `npm run test -- src/ai/speechProviders.test.ts -t "repeated full-quote propagation|negated witch-boundary|target name ends with a digit in speech|witch silver water|generic counterclaim status"`
- `npm run test -- src/ai/speechProviders.test.ts`
- `npm run test -- src/ai/actionProviders.test.ts`
- `npm run test -- src/ai/llmEvaluation.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- `npm run harness:long-tasks`

Optional deeper checks:

- `npm run build`
- `npm run llm:evaluate -- --models=mimo-v2.5-pro --base-url=<temporary-base-url> --lineup-count=12 --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=260 --max-llm-calls=90 --real-phases=SHERIFF_NOMINATION,SHERIFF_SPEECH,SHERIFF_VOTE,SHERIFF_PK_SPEECH,SHERIFF_PK_VOTE,DAY_SPEECH,DAY_VOTE --json --out=tmp/12p-mimo-speech-mechanics-report.json --eval-cases-out=tmp/12p-mimo-speech-mechanics-cases.json`
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-speech-mechanics-cases.json --json --out=tmp/12p-mimo-speech-mechanics-eval.json`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added player-identity dispersion lines to the ordinary speech director voice card.
- Added incoming-pressure/self-history prompt lines when another seat has questioned the current seat.
- Strengthened shared pressure budget wording after repeated same-axis pressure.
- Added non-ritual previous-speaker opening guidance.
- Collected the first bounded 12p Mimo sample through temporary process env only.
- Sent the review pack to Fable5; Fable5 judged the mechanism directions correct but identified rolePublicAction collapse, fallback noise, fixed sheriff speech, and stale targets as the next narrow fixes.
- Diversified public role-claim handling into six ordinary player moves.
- Routed sheriff speech action candidates through ordinary-player texture instead of a fixed campaign line.
- Downgraded stale self-history targets that are no longer alive.
- Added used-line avoidance to public-check fallback bridge text.
- Ran a 72-call post-Fable bounded 12p Mimo rerun. It was diagnostically useful
  but not clean: fallback 12/72, error 12/72, validation failures 9/72.
- Found and fixed the main action-validation pollution: exact target names with
  digit suffixes such as DeepSeek2 are now resolved before numeric extraction.
- Ran a second 72-call bounded 12p rerun after the name-suffix fix. Fallback
  improved to 6/72, error 6/72, validation failures 2/72, and action fallback
  improved from 8 to 2.
- Added a regression test for adjacent duplicate sheriff claim sentences.
- Locally narrowed the remaining second-rerun speech issues without spending
  another sample: speech public-check attribution now exact-matches full player
  names before digit extraction, generic `没人对跳/看有没有对跳` status reads are
  allowed after a public Seer check, and repeated full sheriff-standard quotes
  steer later seats away from `quoteOneLine`.
- Ran the final post-localfix 72-call bounded 12p Mimo rerun. It improved to
  fallback 4/72, error 4/72, validation failures 1/72, with local eval
  averageScore 97.5.
- Found a new hard action-boundary defect in that final sample: public action
  reasons could leak the actor's own hidden role or night action, such as
  `作为女巫，我首夜救了2号...`.
- Added an action-provider hard guard so public action reasons reject own
  private role/night-action leaks, while still allowing references to another
  seat's public Witch claim.
- Ran a 50-call post-private-guard bounded rerun. It did not repeat the hard
  Witch/night-action leak, but fallback was still 7/50 because ordinary retry
  lacked specific repair guidance for `D1首验理由不是主要攻击点`.
- Added ordinary retry guidance for D1 first-check motive failures.
- Ran a final 50-call post-retryfix bounded rerun:
  `tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json`,
  `-cases.json`, and `-eval.json`. It reached fallback 1/50, error 1/50,
  validation failures 0, local eval averageScore 98.2, and no high-risk cases.
- Added a local follow-up guard for softer own hidden-card action labels after
  the final sample exposed `我作为闭眼位先不上警`.

Changed files:
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/speech/stability.ts
- src/ai/actionProviders.ts
- src/ai/actionProviders.test.ts
- docs/tasks/2026-06-12p-mimo-speech-mechanics.md
- docs/superpowers/plans/2026-06-12p-mimo-speech-mechanics.md
- docs/evaluations/2026-06-12-12p-mimo-speech-mechanics-fable5-review.md
- progress.md
- session-handoff.md
- long_running_tasks.json

Verification:
- npm run test -- src/ai/speechProviders.test.ts -t "ordinary player voice card|ordinary self-history|repeated previous-seat pickup rhythm|over-cited shared pressure targets" passed.
- npm run test -- src/ai/speechProviders.test.ts -t "public-role claim handling|stale ordinary self-history|public-claim fallback bridge" passed.
- npm run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates" passed.
- npm run test -- src/ai/actionProviders.test.ts -t "target name ends with a digit|fabricate another player's public check result" passed.
- npm run test -- src/ai/actionProviders.test.ts -t "public action reasons" passed: 2 tests.
- npm run test -- src/ai/speechProviders.test.ts -t "ordinary D1 first-check motive" passed.
- npm run test -- src/ai/actionProviders.test.ts passed: 51 tests.
- npm run test -- src/ai/speechProviders.test.ts -t "dedupes adjacent repeated sheriff claim sentences" passed.
- npm run test -- src/ai/speechProviders.test.ts -t "repeated full-quote propagation|negated witch-boundary|target name ends with a digit in speech|witch silver water|generic counterclaim status" passed: 5 tests.
- npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts passed: 360 tests.
- npm run test -- src/ai/llmEvaluation.test.ts passed.
- npx tsc --noEmit --pretty false passed.
- npm run lint passed.
- npm run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md passed.
- npm run harness:long-tasks passed.
- node -e "JSON.parse(require('fs').readFileSync('long_running_tasks.json','utf8')); console.log('long_running_tasks.json ok')" passed.
- npm run build passed with the existing Turbopack NFT trace warning through next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts.
- npm run harness:check passed.
- git diff --check passed with LF/CRLF conversion warnings only.
- Strict secret scan found no real long token, literal Bearer credential, or long literal env key in the touched 12p scope.
- 12p paid Mimo validation passed to output generation:
  - tmp/12p-mimo-speech-mechanics-report.json
  - tmp/12p-mimo-speech-mechanics-cases.json
  - tmp/12p-mimo-speech-mechanics-eval.json
- Post-Fable bounded rerun evidence:
  - tmp/12p-mimo-speech-mechanics-post-fable-live-report.json
  - tmp/12p-mimo-speech-mechanics-post-fable-live-cases.json
  - tmp/12p-mimo-speech-mechanics-post-fable-live-eval.json
  - tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-report.json
  - tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-cases.json
  - tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-eval.json
  - tmp/12p-mimo-speech-mechanics-post-localfix-live-report.json
  - tmp/12p-mimo-speech-mechanics-post-localfix-live-cases.json
  - tmp/12p-mimo-speech-mechanics-post-localfix-live-eval.json
  - tmp/12p-mimo-speech-mechanics-post-private-guard-live-report.json
  - tmp/12p-mimo-speech-mechanics-post-private-guard-live-cases.json
  - tmp/12p-mimo-speech-mechanics-post-private-guard-live-eval.json
  - tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json
  - tmp/12p-mimo-speech-mechanics-post-retryfix-live-cases.json
  - tmp/12p-mimo-speech-mechanics-post-retryfix-live-eval.json

Remaining risks:
- The existing 12p sample stopped at max_llm_calls and did not complete the game.
- The first post-Fable rerun had 12 fallback/error rows and was polluted by the
  DeepSeek2 name-suffix action validation bug.
- The second post-Fable rerun improved to 6 fallback/error rows but still misses
  the acceptance target of roughly 1-2 fallback rows per 30 calls.
- The final post-retryfix bounded sample passed the mechanism gate, but it was
  still bounded and did not complete the full game.
- The `闭眼位/闭眼好人` public action reason guard was added locally after the
  final paid sample; do not spend another live rerun for this by default unless
  the user specifically asks for live proof of that last boundary.
- Remaining sample warnings are report-only surface variety issues:
  `我听到了，但你...` and one repeated public-identity handling clause.
```

## 2026-06-13 Low-Cost Full-Game Follow-Up

Purpose: check the cheaper full-game path after the paid bounded 12p mechanism
gate passed. This is not a paid player-feel proof; it verifies that the 12p
state machine, mock/direct speech paths, validators, and local evaluator no
longer expose hard defects through a completed game.

Changes:

- Naturalized numbered `speech_influence` cues before briefing, reasoning frame,
  debate agenda, and mock speech rendering.
- Split repeated pressure-chain evidence wording and made mock evidence lines
  avoid already-used recent text.
- Fixed direct mock command speech assembly so hard Seer claims do not emit
  `我跳预言家，X号是查杀` twice.
- Filtered internal motive text such as `拍身份是为了...` from direct mock hard
  role speeches.
- Added focused direct mock command regressions for 12p Seer and Hunter sheriff
  speeches.

Final evidence:

- `npm.cmd run test -- src/ai/speechProviders.test.ts` passed: 312 tests.
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-final-pass-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-final-pass-cases.json`
  passed: 1/1 game completed, day 5 `GAME_OVER`, 146 calls, 40 speech,
  106 action, fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-final-pass-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-final-pass-eval.json`
  passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.

Remaining local warnings:

- `repeated_surface_phrase` `最卡的反应往回听`: 2/26.
- `repeated_clause_rate` `从{seat}号这条压力转看{seat}号...`: 2/26.

Decision:

- Local full-game hard gate is passed.
- Do not add more local hard rules only to zero report-only 2/26 warnings.
- Next useful proof, if requested, is a small paid live sample for real-model
  full-game feel.

## 2026-06-13 Small Paid Full-Feel Live Review

Purpose: use one bounded real Mimo sample to decide whether the 12p improvements
are ready for a human "go" read after the local full-game mock gate.

Evidence:

- `tmp/12p-mimo-fullfeel-small-live-report.json`
- `tmp/12p-mimo-fullfeel-small-live-cases.json`
- `tmp/12p-mimo-fullfeel-small-live-eval.json`
- `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`

Summary:

- 60 calls, stopped at `max_llm_calls`, reached day 2 `DAY_SPEECH`.
- 32 public speech-like rows: 9 sheriff speech action rows and 23 ordinary
  day-speech rows.
- Overall fallback/error was 7/60; ordinary day-speech fallback/error was 7/23.
- Local eval averageScore was 99.5, issueCount 2, highRiskCaseIds empty.
- Report-only repeated sheriff-standard quote warning remained at 4/32.

Decision:

- Continue, not go.
- Do not spend another paid sample before two local fixes:
  - sheriff speech action public output must reject/repair private or internal
    intent leakage such as `隐藏狼队视角`;
  - ordinary speech validation must accept immediately public Seer check reports
    from prior same-day speeches, and catch short trailing fragments such as
    `刚才9号DeepSeek2说的`.

Post-fix local result:

- Added regressions for sheriff speech private wolf-strategy leakage,
  previous-speaker pickup fragments, and immediately public Seer checks.
- Sanitized wolf speech-plan/private-context strategy wording so raw wolf-team
  night strategy is not handed to public speech generation.
- Filtered wolf internal motive points from mock/direct public speech assembly.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 366 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- Local full-game mock after the live-fix completed 1/1 game with 146 calls,
  fallback 0, error 0, validationFailure 0, totalQualityIssues 0:
  `tmp/12p-fullgame-lowcost-mock-after-livefix-report.json`.
- Local eval for that mock sample stayed clean: 80 cases, averageScore 100,
  issueCount 0, highRiskCaseIds empty:
  `tmp/12p-fullgame-lowcost-mock-after-livefix-eval.json`.
- A scan of the new mock report/cases/eval found no `狼队视角`, `隐藏狼队`,
  `制造分歧`, `狼队首夜`, or `队友`.
- Opus 4.8 review prompt is appended to
  `docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md`.

### 2026-06-13 Opus Bounded Rerun + Fragment Hardgate

Opus 4.8 judged the post-livefix local evidence as `bounded-rerun`, not `go`,
because private leaks and accepted fragments are hard gates and the original
defects came from paid live.

Bounded rerun evidence:

- `tmp/12p-mimo-fullfeel-bounded-rerun-report.json`
- `tmp/12p-mimo-fullfeel-bounded-rerun-cases.json`
- `tmp/12p-mimo-fullfeel-bounded-rerun-eval.json`

Rerun result:

- 60 calls, reached day 2 `DAY_SPEECH`, stopped at `max_llm_calls`.
- 32 public speech-like rows.
- fallback 3, error 3, validationFailure 1.
- Local eval: 60 cases, averageScore 97.1, issueCount 8,
  highRiskCaseIds 3.
- Private wolf-strategy scan found 0 hits.
- Accepted-fragment gate failed: D1 10号 was accepted as
  `我先说9号DeepSeek2刚才那段。他抓6号Gemini那句`.

Local follow-up:

- Kept ordinary truncation as a soft validation error for retry/repair.
- Added provider-level hardgate behavior: if the final candidate still has
  `普通局发言疑似被截断` and cannot be repaired, it is no longer soft-accepted;
  it falls back instead.
- Added regression:
  `does not soft-accept ordinary speech that still ends as a fragment after retries`.

Verification:

- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "does not soft-accept ordinary speech|soft accepts forward commitment endings after retry by cutting the trailing promise|accepts ordinary speech when only soft quality guards remain after retries|rejects ordinary speech that ends after a previous-speaker pickup"` passed.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 367 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-cases.json`
  passed: 1/1 full local game, 146 calls, fallback 0, error 0,
  validationFailure 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-eval.json`
  passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.

Current decision:

- Not go yet from live evidence: the latest paid rerun failed the accepted
  fragment hard gate.
- The fragment class is now locally fixed and mock-regressed.
- A fresh 50-60 call paid rerun is the next live proof if the user approves
  another paid confirmation.

### 2026-06-13 Final Bounded Rerun + Empty-Rebuttal Tail Guard

The user approved the next bounded paid proof after the provider-level fragment
hardgate.

Final rerun evidence:

- `tmp/12p-mimo-fullfeel-final-rerun-report.json`
- `tmp/12p-mimo-fullfeel-final-rerun-cases.json`
- `tmp/12p-mimo-fullfeel-final-rerun-eval.json`

Result:

- 60 calls, reached day 2 `DAY_SPEECH`, stopped at `max_llm_calls`.
- 32 public speech-like rows.
- fallback 4, error 4, validationFailure 1.
- Speech-like fallback was 3/32, about 2.8 per 30.
- Local eval: 60 cases, averageScore 97.8, issueCount 6,
  highRiskCaseIds 2.
- Private wolf-strategy scan: 0 hits.
- Previous `刚才X说的` accepted-fragment shape: 0 hits.
- New accepted-fragment tail found: D1 4号 ended at `别光说`.

Local follow-up:

- Added ordinary surface detection for empty rebuttal tails such as `别光说`,
  `不能光说`, and `别只说`.
- Added regression:
  `rejects ordinary speech that ends at an empty rebuttal cue`.

Verification:

- Red test first failed for `empty rebuttal cue`, then passed after the surface
  guard.
- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "empty rebuttal cue|does not soft-accept ordinary speech|soft accepts forward commitment endings after retry by cutting the trailing promise|accepts ordinary speech when only soft quality guards remain after retries"` passed.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 368 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-cases.json`
  passed: 1/1 full local game, 146 calls, fallback 0, error 0,
  validationFailure 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-eval.json`
  passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.

Current decision:

- Still not `go` from paid evidence because the latest paid sample found a new
  accepted fragment shape.
- The new fragment shape is locally fixed and mock-regressed.
- Ask before spending another paid rerun. The next paid proof, if approved,
  should use the same 50-60 call envelope and only check the hard gates.

### 2026-06-13 Public Check / Identity-Claim Boundary Guard

Opus 4.8 reviewed the post-empty-tail state and recommended one more local
mechanism fix before another paid proof: non-Seer claims could carry structured
`checks` in `publicClaimBoard`, making the model or evaluator read a Hunter as
if it had reported a Seer check.

Root cause:

- `extractRoleClaimFromSpeech()` could identify a non-Seer hard role claim
  such as Hunter or Witch, while still extracting nearby `查杀/金水` wording
  into the claim's structured `checks`.
- `buildClaimBoard()` then exposed those checks to prompt/eval metadata.

Local follow-up:

- `src/game/claims.ts` now keeps structured `checks` only when
  `claimedRole === "SEER"`.
- `upsertRoleClaim()` and `describeRoleClaim()` use the same role boundary, so
  new public role-claim events do not describe non-Seer checks.
- `src/game/tableMemory.ts` also filters `buildClaimBoard()` output for old or
  manually constructed dirty state.
- Legitimate Seer claims, including wolf counterclaims that publicly claim
  Seer, still retain checks because the boundary is based on claimed role, not
  true role.

Verification:

- Red tests first failed for non-Seer public check wording and non-Seer
  claimBoard checks, then passed after the fix.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 28 tests.
- `npm.cmd run test -- src/game/tableMemory.test.ts` passed: 7 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 368 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/ai/llmEvaluation.test.ts`
  passed: 44 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-claim-boundary-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-claim-boundary-cases.json`
  passed: 1/1 full local game, 146 calls, fallback 0, error 0,
  validationFailure 0.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-claim-boundary-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-claim-boundary-eval.json`
  passed: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Structure scan of the new cases: 146 cases, non-Seer claims with checks 0,
  Seer claims with checks 267.

Current decision:

- Not `go` yet from paid evidence; this boundary was fixed locally after the
  latest paid sample.
- The next useful step is a 50-60 call paid bounded proof only after user
  approval, checking zero non-Seer public check ownership, private leak 0, and
  fragment 0.

### 2026-06-13 Paid Claim-Boundary Proof

The user approved the post-claim-boundary paid proof. It used the same seed and
bounded SHERIFF/D1-D2 envelope with temporary process env only.

Evidence:

- `tmp/12p-mimo-claim-boundary-paid-preflight-report.json`: 1 real Mimo action
  call, fallback 0, error 0, validationFailure 0.
- `tmp/12p-mimo-claim-boundary-paid-proof-report.json`: 60 calls, reached day 2
  `DAY_VOTE`, fallback 2, error 2, validationFailure 1.
- `tmp/12p-mimo-claim-boundary-paid-proof-eval.json`: 60 cases, averageScore
  97.8, issueCount 6, highRiskCaseIds 2.

Hard-gate scan:

- Non-Seer claimBoard entries carrying checks: 0.
- Non-Seer own-check public statements: 0.
- Private leak hits: 0.
- Accepted fragment hard-shape hits: 0.
- Fallback/error stayed at 2/60, inside the expected bounded proof noise range.

Readback:

- The claim-boundary fix held in real Mimo: Mimo/HUNTER exported `checks: []`,
  while Seer claims, including counterclaims, kept their public checks.
- The two local eval high-risk rows are explainable false positives for legal
  public-check references:
  - 5号 Mimo/HUNTER said both claimed Seers reported 9号查杀.
  - 7号 GLM said two claimed Seers simultaneously reported 9号查杀.
- The one `malformed_output_fragment` warning is a complete vote reason:
  `这个转折我到现在没听明白。`; it is report-only, not the prior accepted
  half-sentence class.

Current decision:

- The public check / identity-claim boundary hard gate is passed live.
- Do not add more local hard rules for the explainable eval false positives.
- Next useful step is an external/human go judgment on this proof, or a narrow
  evaluator calibration only if we want local eval to stop flagging legal
  public-check references as `logic_boundary_error`.

### 2026-06-13 Evaluator Calibration

Opus 4.8 judged the paid claim-boundary proof as `evaluator-calibration`:
mechanism hard gates were already live-clean, but the local evaluator was
misclassifying legal public-check references by non-Seer speakers as
`logic_boundary_error`.

Local follow-up:

- `logic_boundary_error` attribution now distinguishes self-owned checks from
  public references to claimed Seer checks.
- Generic wording such as `两张预言家同时报9号查杀` no longer inherits the
  previous ordinary speaker as the check owner.
- Same-sentence pronoun follow-ups such as `2号Claude这轮直接报了8号Kimi查杀，
  昨天他报过9号DeepSeek2查杀` inherit the earlier claimed Seer as owner.
- Complete vote-reason endings such as `这个转折我到现在没听明白。` no longer
  trigger `malformed_output_fragment`.
- Non-Seer self-owned check wording such as `我验了9号...9号是查杀` remains a
  `logic_boundary_error`.

Verification:

- Red regression first failed for the real false-positive shape
  `6号Gemini那句话点到我了——两张预言家同时报9号查杀`.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "public seer claims"`
  passed after the calibration.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-claim-boundary-paid-proof-cases.json --json --out=tmp/12p-mimo-claim-boundary-paid-proof-after-evaluator-calibration-eval.json`
  passed: 60 cases, averageScore 99.1, issueCount 3,
  `logic_boundary_error` 0, `malformed_output_fragment` 0, highRiskCaseIds
  empty.

Current decision:

- The paid hard gates are clean and the evaluator now agrees with the live
  mechanism evidence.
- Remaining sample findings are report-only surface warnings:
  repeated sheriff-standard wording and `rolePublicAction` skew.
- Do not spend another paid bounded proof by default.

### 2026-06-14 DeepSeek Final Acceptance Proof

After the local Seer-check attribution invariant suite and extractor fixes, one
same-seed bounded live proof was run with `deepseek-chat` as the requested
provider. The proof reached day 3 `DAY_VOTE` at 100 calls and exercised the
important D3 shape: 8号 Kimi claimed Seer, reported a self-owned 1号金水, and
referenced Claude/GLM's old 9号查杀 lines without absorbing those lines into
8号's own structured checks.

Evidence:

- `docs/evaluations/2026-06-14-12p-deepseek-final-acceptance-proof.md`
- `tmp/12p-deepseek-chat-final-acceptance-report.json`
- `tmp/12p-deepseek-chat-final-acceptance-hardscan.json`
- `tmp/12p-deepseek-chat-final-acceptance-after-eval-calibration-eval.json`

Hard scan:

- non-Seer claimBoard checks: 0
- claimed-Seer same-target contradictions: 0
- private leak hits: 0
- accepted fragment hard-shape hits: 0
- D3 speech rows scanned: 9
- trigger text rows scanned: 64

Offline evaluator calibration removed two legal-public-check false positives on
the same cases. Final eval: 80 cases, averageScore 99.8, issueCount 1,
highRiskCaseIds empty.

Verification:

- `npm.cmd run test -- src/ai/llmEvaluation.test.ts` passed: 40 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over generated DeepSeek final proof outputs found 0 real
  key or Bearer token matches.

Decision:

- `go-hardgate` for structured Seer-check attribution on the DeepSeek final
  proof.
- Do not run another paid attribution proof by default.
- Caveat: the live provider path was noisy, with fallback/error 9/100 and
  validationFailure 4/100. This is provider stability noise, not a hard-gate
  attribution failure.
- Caveat: this is DeepSeek proof, not a Mimo-specific full-game subjective
  read-feel proof.

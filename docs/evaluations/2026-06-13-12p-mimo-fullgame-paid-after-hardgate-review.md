# 12p Mimo Full-Game Paid After Hardgate Review

Date: 2026-06-13

## Purpose

Run a real Mimo 12-player full-feel sample after the hard-gate mechanics and
local mock full-game gate passed. This is the first paid run in this line that
finished a full 12p game instead of stopping at a bounded D1/D2 envelope.

Secret handling:

- Mimo base URL and key were entered through a temporary visible PowerShell
  prompt.
- The key was only held in that PowerShell process environment.
- No key was written to `.env`, docs, source, status JSON, logs, or command
  arguments.

## Source Evidence

- Report:
  `tmp/12p-mimo-fullfeel-paid-after-hardgate-report.json`
- Eval cases:
  `tmp/12p-mimo-fullfeel-paid-after-hardgate-cases.json`
- Local eval:
  `tmp/12p-mimo-fullfeel-paid-after-hardgate-eval.json`
- Transcript extract:
  `tmp/12p-mimo-fullfeel-paid-after-hardgate-transcript.txt`
- D2+ review extract:
  `tmp/12p-mimo-fullfeel-paid-after-hardgate-d2plus-sample.json`
- Fallback diagnostics:
  `tmp/12p-mimo-fullfeel-paid-after-hardgate-fallbacks.json`

## Machine Summary

- Board: `12p-sheriff-seer-witch-hunter-guard`
- Seed: `91`
- Model: `mimo-v2.5-pro`
- Real phases:
  `SHERIFF_NOMINATION,SHERIFF_SPEECH,SHERIFF_VOTE,SHERIFF_PK_SPEECH,SHERIFF_PK_VOTE,DAY_SPEECH,DAY_VOTE`
- Max budget: 120 calls; actual calls: 85.
- Stop reason: `game_finished`.
- Final state: day 3 `GAME_OVER`.
- Winner: `GOOD`, reason `所有狼人出局`.
- Calls: 85 total, 30 speech, 55 action.
- Provider outputs: `custom-speech:mimo-v2.5-pro` 30,
  `custom-action:mimo-v2.5-pro` 55.
- fallback/error: 5/85.
- validationFailureCount: 3.
- Retry rows: 16 `retry_ok`, 5 `provider_error`.
- Local eval: 80 cases, averageScore 99.2, issueCount 3,
  highRiskCaseIds 1.

## Hard-Gate Scan

Passed:

- Private strategy leak scan for `狼队视角`, `隐藏狼队`, `制造分歧`, `狼队首夜`,
  `我们狼`, and `队友`: 0 hits.
- Accepted fragment scan: 0 hits.
- Non-Seer claimBoard entries carrying checks: 0.

New hard/near-hard finding:

- Contradictory Seer claim attribution appeared in `publicClaimBoard`.
- Unique polluted shape: 11号 GPT2 claimed Seer and carried two structured
  checks on 1号 DeepSeek: `WEREWOLF` and `GOOD`.
- The source text was 11号's D3 fake-Seer speech:
  `昨晚验了1号DeepSeek，查杀...2号昨晚倒牌，他之前报过1号金水...`
- Interpretation: the claim extraction/eval metadata likely attached the
  referenced dead Seer's 1号金水 to 11号's own Seer claim. This is not the old
  non-Seer check pollution; it is cross-claim attribution pollution inside a
  Seer-claim sentence.

## Fallback And Validation Noise

Fallback/error rows:

- D1 10号 Witch speech: failed `D1首验理由不是主要攻击点`, fell back.
- D1 8号 vote: failed `凭空引用未公开查验结果`, fell back.
- D2 2号 vote: failed `凭空引用未公开查验结果`, fell back.
- D3 10号 Witch speech: failed `凭空引用未公开查验结果`, fell back.
- D3 3号 vote: failed `凭空引用未公开查验结果`, fell back.

This is playable but still pollutes a full-feel read. The repeated
`凭空引用未公开查验结果` failures suggest the public-check/action validator still
does not fully align with late-game claimed-Seer references and dead-Seer
legacy references.

## Manual Read

Positive signals:

- The game completed through D3 instead of stopping at a cap.
- D2 table had a plausible counterclaim arc: 2号 real Seer reported 1号金水,
  8号 wolf counterclaimed and reported 2号查杀, then later seats compared
  "first-day Seer line" versus "late counterclaim with one check".
- Several seats carried prior positions forward:
  - 3号 explicitly explained why continuing the old 9号 pressure was less useful.
  - 5号 Hunter carried his revealed identity and vote-dispersion concern.
  - 12号 challenged the late 11号 Seer claim by comparing the claimed check
    against prior vote behavior.

Read-feel problems:

- D2 vote reasons collapsed into very similar wording around "上轮点过2号 /
  8号这条公开证据更硬 / 豆包2施压过这里".
- D3 opener repeated the D2 "9号出局前留7号线" bridge and still leaned on
  "现在4号死了" after a new D3 death, which reads stale even if not strictly
  false.
- D3 10号 Witch fallback was mechanically safe but low quality:
  `我是女巫，药线我先明着报。6号Gemini这个开场我先听着，今天票别散。`
- The D3 11号 fake-Seer claim plus D3 12号 response created the only high-risk
  eval row and exposed the contradictory check attribution above.

## Current Judgment

Do not call this `go` yet.

The old hard gates are much better: no hidden wolf strategy leak, no accepted
fragment, and no non-Seer structured checks. But the completed paid game found
a new full-game mechanism issue: cross-claim Seer-check attribution can merge a
dead Seer's prior good check into another claimed Seer's current black check.

Recommended decision path:

1. Ask Opus/human review to judge whether the contradictory Seer-claim
   attribution is a required local fix before another paid run.
2. If yes, fix only that attribution boundary and possibly the late-game
   public-check validator false positives.
3. Do not start broad phrase bans or another mock/evaluator-only loop.

## Opus Review Result And Local Fix

Opus review result: `continue`.

Rationale:

- The full-game read-feel is basically passable, but the contradictory
  claimed-Seer attribution is a hard structured-check ownership blocker.
- This is the same class as the earlier public check boundary fix: the role is
  now Seer, but the check owner is wrong.
- Another paid rerun before fixing the source would only resample the same
  live extraction path.

Implemented local fix:

- Added the exact D3 11号 GPT2 regression:
  `昨晚验了1号DeepSeek，查杀...2号昨晚倒牌，他之前报过1号金水...`.
- `extractClaimChecks()` skips check-like text when the immediate sentence
  prefix attributes it to another seat or pronoun, for example `他之前报过`.
- `dedupeChecks()` now keys by claimant and target, so one claimed Seer cannot
  carry both `GOOD` and `WEREWOLF` on the same target.
- A self-owned fake Seer check still parses normally, preserving legal wolf
  counterclaims.

Local verification:

- Red regressions first failed for both referenced old checks and same-target
  contradictory checks.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 30 tests.
- `npm.cmd run test -- src/game/tableMemory.test.ts` passed: 7 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 368 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/ai/llmEvaluation.test.ts`
  passed: 45 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Next proof:

- Run one bounded paid proof after user approval/provider availability.
- Acceptance: no claimed-Seer same-target contradictory checks; quoted old
  checks are not attached to the quoting speaker; old hard gates remain 0;
  late-game `凭空引用未公开查验结果` false positives are checked before deciding
  whether B needs a separate local fix.

## Bounded Paid Proof After Local Fix

Date: 2026-06-14 Asia/Shanghai

Evidence:

- Preflight:
  `tmp/12p-mimo-cross-seer-attribution-preflight-report.json`
- Proof report:
  `tmp/12p-mimo-cross-seer-attribution-small-report.json`
- Proof eval cases:
  `tmp/12p-mimo-cross-seer-attribution-small-cases.json`
- Local eval:
  `tmp/12p-mimo-cross-seer-attribution-small-eval.json`

Run notes:

- The first 120-call proof runner was stopped after it produced no report or
  case file.
- The second runner completed a 1-call preflight, then a 60-call proof.
- Mimo base URL and key were entered through the temporary PowerShell runner
  and held only in that runner process environment.

Machine summary:

- 60 calls, 22 speech, 38 action.
- Stop reason: `max_llm_calls`.
- Reached day 2 `DAY_VOTE`; did not reach D3.
- fallback/error: 2/60.
- validationFailureCount: 0.
- totalQualityIssues: 0.
- Local eval: 60 cases, averageScore 98.1, issueCount 6,
  highRiskCaseIds 1.

Hard-gate scan:

- Claimed-Seer same-target contradictory checks: 0.
- Non-Seer claimBoard checks: 0.
- Exact private-leak hits for wolf strategy terms: 0.
- Accepted fragment hard-shape hits: 0.
- Secret scan over the generated cross-Seer proof files found no long key or
  bearer-token pattern.

Interpretation:

- The local attribution fix held in this live bounded envelope: no claimed
  Seer exported contradictory `GOOD` and `WEREWOLF` checks on one target.
- The sample did not cover the original D3 trigger, where 11号 GPT2 quoted
  2号 Claude's old 1号金水 while claiming a new 1号查杀. That means this is a
  clean partial proof, not a final full-game go proof.
- The remaining high-risk local eval row looks like a legal public-check
  reference rather than a mechanism leak: 3号 GPT discussed 2号 Claude's
  public 9号查杀, and the row's `publicClaimBoard` already carried 2号 Claude
  as the claimed Seer with that check.

Current judgment:

- A is fixed locally and live-clean through D2.
- B should stay observational unless external/human review says the evaluator
  false positive must be calibrated now.
- The next decision is review versus a longer paid proof that reaches D3; do
  not chase vote-reason sameness or repeated surface phrasing in this cut.

## Opus Review Of Bounded Proof And B Calibration

Review result: `partial-pass`.

Overall recommendation: `longer-bounded-rerun`.

Rationale:

- The local A fix is technically sound and the exact D3 text regression is the
  main deterministic evidence.
- The 60-call paid proof is useful regression evidence, but it stopped at D2
  and did not exercise the original D3 pattern: a wolf fake-Seer quoting a
  dead Seer's old check while claiming a new check.
- The claimant+target contradiction guard is not a complete proof by itself,
  because a non-contradictory referenced old check could still pollute the
  wrong claimed-Seer entry if attribution were wrong.
- The single high-risk row in the D2 proof is B-class evaluator false positive,
  not mechanism pollution, but it should be calibrated before the longer paid
  rerun so the next high-risk count is readable.

B calibration:

- Added a regression for the real 3号 GPT row:
  `我先接2号Claude的查验线，他报9号查杀...不过我听9号查杀前那句...`.
- Added a negative regression where that same `他报9号查杀` wording still fails
  if `publicClaimBoard` does not contain 2号 Claude's 9号查杀.
- Tightened evaluator check-report verbs so bare nouny `查` / `验` no longer
  turn `查验线` or `查杀前那句` into fabricated check attributions.

Offline re-eval:

- Re-evaluated:
  `tmp/12p-mimo-cross-seer-attribution-small-cases.json`
- Output:
  `tmp/12p-mimo-cross-seer-attribution-small-after-b-calibration-eval.json`
- Result: 60 cases, averageScore 98.6, issueCount 5,
  `logic_boundary_error` 0, highRiskCaseIds empty.

Next proof:

- Same seed 91, one paid game.
- Budget should be roughly 90-100 calls, because the prior full game reached
  D3 `GAME_OVER` at 85 calls while the 60-call proof stopped at D2.
- Required live coverage: SHERIFF phases plus D1/D2/D3 `DAY_SPEECH` and
  `DAY_VOTE`, with actual occurrence of a fake-Seer or claimed-Seer quote of
  another claimed/dead Seer's old check.
- Acceptance: no claimed-Seer same-target contradictions; quoted old checks do
  not enter the quoting speaker's structured checks, including non-conflicting
  old checks; private leak, accepted fragment, and non-Seer checks stay at 0;
  post-calibration local eval has no B-class high-risk false positive.

## Longer D3 Proof Result And Local Follow-up

Date: 2026-06-14 Asia/Shanghai

Evidence:

- Proof report:
  `tmp/12p-mimo-cross-seer-attribution-d3-90-report.json`
- Proof eval cases:
  `tmp/12p-mimo-cross-seer-attribution-d3-90-cases.json`
- Local eval before follow-up:
  `tmp/12p-mimo-cross-seer-attribution-d3-90-eval.json`
- Local eval after follow-up:
  `tmp/12p-mimo-cross-seer-attribution-d3-90-after-localfix-eval.json`

Run summary:

- 90 calls, 33 speech, 57 action.
- Stop reason: `max_llm_calls`.
- Reached D4 `DAY_SPEECH`, so the proof covered D3 `DAY_SPEECH` and
  `DAY_VOTE`.
- fallback/error: 9/90.
- validationFailureCount: 6.
- Report quality issues: one `speech_vote_discontinuity`.
- Local eval before the new local fixes: 80 cases, averageScore 99.1,
  issueCount 4, highRiskCaseIds 1.

Hard result:

- Claimed-Seer same-target contradictions: 0.
- Non-Seer claimBoard checks: 0.
- The proof still failed A through a non-conflicting pollution path. D3
  8号 Kimi said:
  `我是8号Kimi，预言家。昨晚验的1号DeepSeek，查杀。...他今天跳预言家报2号查杀...`
  The self-owned 8->1 `WEREWOLF` check is valid, but the quoted 1号->2号
  `WEREWOLF` claim was incorrectly attached to 8号 Kimi as 8->2
  `WEREWOLF`.
- This is exactly the case the same-target contradiction guard cannot catch:
  the polluted quoted check did not conflict with 8号 Kimi's own target.
- The accepted-fragment gate also failed on D3 7号 GLM:
  `说实话，1号DeepSeek，你今天这条查验我先挂着。你报2号Claude查杀，但刚才那段发言的重点全在`.

Local fixes:

- Added the 8号 Kimi quote regression to `src/game/claims.test.ts`.
- Expanded `extractClaimChecks()` so same-sentence explicit other-seat and
  pronoun subjects are recognized before attaching a check to the current
  speaker.
- Added `hasUnfinishedOrdinaryFocusMarker()` in
  `src/ai/speech/ordinarySurface.ts`.
- Used that same detector in both provider validation and ordinary eval, so the
  `重点全在` fragment is rejected and scored as `malformed_output_fragment`.

Verification:

- Red tests first failed for the 8号 Kimi claimBoard pollution and the
  `重点全在` fragment.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 31 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 369 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/claims.test.ts src/game/tableMemory.test.ts`
  passed: 83 tests.
- Re-evaluating the old D3-90 cases after the local eval fix passed with
  80 cases, averageScore 98.9, issueCount 5, and
  `malformed_output_fragment` 1.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Current judgment:

- Not `go`: the longer D3 proof reached the needed envelope but failed the
  non-conflicting cross-Seer attribution hard gate and accepted a fragment.
- The failures were concrete and locally regressed; do not continue broad
  regex/evaluator-only work.
- The next proof, if approved, should be a fresh same-seed bounded D3 paid run.
  The old D3-90 cases cannot prove the claimBoard fix because their metadata
  was generated before the new extraction rule.

## Fresh D3 Proof Result And Target-Subject Follow-up

Date: 2026-06-14 Asia/Shanghai

Evidence:

- Proof report:
  `tmp/12p-mimo-cross-seer-attribution-d3-fresh-report.json`
- Proof eval cases:
  `tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json`
- Local eval:
  `tmp/12p-mimo-cross-seer-attribution-d3-fresh-eval.json`
- Hard scan:
  `tmp/12p-mimo-cross-seer-attribution-d3-fresh-hardscan.json`

Run summary:

- 90 calls, 33 speech, 57 action.
- Stop reason: `max_llm_calls`; reached D4 `DAY_SPEECH`.
- fallback/error: 11/90.
- validationFailureCount: 4.
- totalQualityIssues: 0.
- Local eval: 80 cases, averageScore 97.6, issueCount 8,
  highRiskCaseIds 4.

Hard result:

- Private leak hits: 0.
- Accepted fragment hard-shape hits: 0.
- Non-Seer claimBoard checks: 0.
- Claimed-Seer same-target contradictions: 0.
- Still not `go`: 8号 Kimi's D2 speech self-reported
  `昨晚验的2号Claude，查杀`, but the exported claimBoard stored Kimi's 8->2
  result as `GOOD`.

Root cause:

- The same speech contained the legal quote
  `我现在更在意的是2号Claude刚才报的金水`.
- The generic target/result extractor interpreted `2号...金水` as Kimi's own
  check result instead of a sentence where 2号 was the subject who reported a
  gold check.
- Claim dedupe then kept the bad 8->2 `GOOD` entry and suppressed the later
  self-owned 8->2 `WEREWOLF`.

Local fix:

- Added a red regression for the exact fresh-proof 8号 Kimi text.
- `sentenceReferencesOtherClaimCheck()` now recognizes target-as-subject quoted
  reports such as `2号Claude刚才报的金水`.
- The new filter is limited to explicit quote/report cues so legitimate
  self-owned checks like `昨晚验的2号Claude，查杀` still parse.

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

Current judgment:

- The fresh proof failed the structured claim attribution gate, but it produced
  a precise local fix.
- Do not continue with local-only work unless a reviewer asks for it. The next
  acceptance step is another fresh bounded same-seed D3 proof after explicit
  user approval/provider input.

## Continue-Local Structural Attribution Follow-up

Date: 2026-06-14 Asia/Shanghai

External review chose `continue-local` after the fresh D3 target-subject fix.
The reason was architectural: the extractor still broadly treated check-like
target/result text as speaker-owned and then subtracted quoted-check phrasing
with blacklist rules. Three paid/local rounds had already found new quote
variants, so the next cut had to close the class before another paid proof.

Local fixes:

- `src/game/claims.ts` now classifies check ownership by governing verb class.
- Owned check verbs such as `验/查/摸` with speaker or omitted subject can
  create speaker `checks`.
- Report/quote verbs such as `报/说/称/给/留`, or check verbs whose subject is
  another seat/pronoun, do not create speaker `checks`.
- Added a two-sided regression where Kimi quotes `2号Claude给的金水` and
  `4号豆包留的2号查杀` but still self-reports `昨晚验的2号Claude，查杀`.
- Refreshed evaluator public-check attribution for the fresh D3 legal quote:
  `我先接一下2号Claude。他刚才报了12号豆包2金水...他自己第一天报的也是9号DeepSeek2查杀`.

Offline evaluator result:

- Output:
  `tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`
- 80 cases, averageScore 98, issueCount 7.
- `logic_boundary_error` dropped from 3 to 2.
- High-risk count dropped from 4 to 3.
- The removed high-risk row was the legal 3号 GPT public-check quote.
- The remaining two `logic_boundary_error` rows are stale-board derivatives
  where the old fresh proof still has Kimi stored as 8->2 `GOOD`; they cannot
  prove the new source fix because the metadata predates it.
- The remaining `bad_followup_target` is separate from the claim attribution
  hard gate.

Verification:

- `npm.cmd run test -- src/game/claims.test.ts -t "classifies quoted report verbs"`
  failed first, then passed after the structural fix.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 33 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts -t "allows non-seers to quote checks"`
  failed first, then passed after evaluator calibration.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts`
  passed: 73 tests.
- `npm.cmd run test -- src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 381 tests.
- `npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json --json --out=tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`
  passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.

Current judgment:

- The local `continue-local` work is complete for the known bug class.
- The next useful action is one fresh bounded same-seed D3 paid proof only
  after explicit user approval/provider input.
- The proof must actually hit a fake-Seer/quoted-Seer old-check scene; if it
  does not, it is not a proof of this fix.

## Opus 4.8 Review Prompt

```text
模型确认：请你先说一句你当前是什么模型。

你是外部机制审查员。本轮不要重读仓库，只基于我给你的审查包和摘录判断。

背景：
- 项目是 12 人狼人杀 AI 发言机制，目标是从 hard gate 过线推进到“完整局 real Mimo 读感也及格”。
- 之前已修完并 live 验证：private leak、accepted fragment、非 Seer 结构化查验、evaluator false positive。
- 本轮是新的 12p paid full-feel 样本，seed 91，mimo-v2.5-pro，真实阶段覆盖警长、白天发言、投票。它没有在 120 call cap 前停止，而是 day 3 GAME_OVER，好人胜。

请重点阅读：
1. docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md
2. tmp/12p-mimo-fullfeel-paid-after-hardgate-report.json 的 summary、games[0].calls 中 D2/D3 DAY_SPEECH 和 DAY_VOTE
3. tmp/12p-mimo-fullfeel-paid-after-hardgate-eval.json 的 summary、highRiskCaseIds、sampleMetrics
4. tmp/12p-mimo-fullfeel-paid-after-hardgate-fallbacks.json
5. tmp/12p-mimo-fullfeel-paid-after-hardgate-transcript.txt

本轮机器摘要：
- 85 real Mimo calls: 30 speech / 55 action.
- stopReason game_finished, day 3 GAME_OVER, GOOD win.
- fallback/error 5/85, validationFailureCount 3.
- local eval: 80 cases, averageScore 99.2, issueCount 3, highRiskCaseIds 1.
- private strategy leak exact scan 0.
- accepted fragment scan 0.
- non-Seer claimBoard checks 0.

关键新问题：
- publicClaimBoard 出现同一 claimed Seer 的同一目标矛盾查验：
  11号 GPT2 claimedRole=SEER，对 1号 DeepSeek 同时有 WEREWOLF 和 GOOD。
- 触发文本是 11号 D3 悍跳：
  “昨晚验了1号DeepSeek，查杀...2号昨晚倒牌，他之前报过1号金水...”
- 这看起来像 extraction/eval metadata 把 2号 dead Seer 的旧金水引用吸进了 11号自己的 claim。

你要回答：
Q1. 这次完整 paid game 能否视为“12p real Mimo 读感基本及格”？
选项只能是：
- go：可以接受，不需要再修或再跑 paid；
- bounded-rerun：只需要一次小 paid rerun 确认；
- continue：需要先本地修一个机制问题，不能直接花 live。

Q2. 如果不是 go，最多列两个下一刀。请判断优先级：
- A. 修 claimed Seer 句子里“引用他人旧查验”被归到自己 claim 的 attribution boundary；
- B. 修 late-game `凭空引用未公开查验结果` 的 vote/speech validator false positive；
- C. 修 D2/D3 vote reason 同质化；
- D. 其他，但必须是机制问题，不是审美泛化。

Q3. 如果修完后需要 rerun，请给最小 rerun 范围和验收指标。

判断标准：
- private leak、accepted fragment、结构化查验归属是硬门槛。
- fallback 率污染读感，但不要为了低频表面 warning 开大修。
- 不要建议完整重写、扩禁词、动作硬配额、或完整多局 paid run，除非你认为有机制必要。
- 重点看底层机制，不要纠结单句审美。

请用中文回答，结构：
结论：go / bounded-rerun / continue
理由：
下一步：
不要做：
```

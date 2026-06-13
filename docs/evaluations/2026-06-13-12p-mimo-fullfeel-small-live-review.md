# 12p Mimo Full-Feel Small Live Review

Date: 2026-06-13

## Purpose

Run one small paid 12-player live sample after the local full-game mock gate, so
the next decision can be based on real Mimo table feel instead of local mock
surface.

This run is intentionally bounded. It is not a full-game proof.

## Scope

- Board: `12p-sheriff-seer-witch-hunter-guard`
- Seed: `91`
- Model: `mimo-v2.5-pro`
- Human: none
- Budget: `max-llm-calls=60`
- Real phases: sheriff nomination, sheriff speech, sheriff vote, sheriff PK
  hooks, day speech, day vote
- Secret handling: temporary process env only; no key written to `.env`, source,
  docs, or reports.

Output files:

- `tmp/12p-mimo-fullfeel-small-live-report.json`
- `tmp/12p-mimo-fullfeel-small-live-cases.json`
- `tmp/12p-mimo-fullfeel-small-live-eval.json`
- `tmp/12p-mimo-fullfeel-small-live-console.log`
- `tmp/12p-mimo-fullfeel-small-live-eval-console.log`

## Machine Summary

- Game stopped at `max_llm_calls`.
- Final reached state: day 2 `DAY_SPEECH`.
- Total calls: 60.
- Public speech-like rows: 32.
  - Sheriff speech action rows: 9.
  - Ordinary day speech rows: 23.
- Overall fallback/error: 7/60.
- Ordinary day-speech fallback/error: 7/23.
- Public speech-like fallback/error: 7/32.
- Validation failure count in report summary: 1.
- Local ordinary eval: 60 cases, averageScore 99.5, issueCount 2,
  highRiskCaseIds empty.
- Report-only sample warnings:
  - repeated `警徽要给能听完对跳、还能把票口说清的人`: 4/32.

## Decision

Continue, not go.

The real-model table feel is much closer than the earlier 12p samples, but this
sample exposes two hard blockers that should be fixed before asking for another
go/no-go read:

1. Sheriff speech action output can leak private/internal intent into public
   speech.
2. Ordinary speech validation still rejects newly public check information often
   enough to push 7/23 day speeches into fallback.

Do not spend another live sample until these two paths are fixed locally.

## Hard Blockers

### 1. Sheriff Speech Leaked Private Wolf Intent

The public sheriff speech path is still an action path. In this sample, seat 8
was a Werewolf and publicly output:

> Mimo那段我先放一下，先回到2号没讲顺的地方。我会先把公开身份说法和查杀回应摆出来。先隐藏狼队视角，围绕Claude制造分歧。不要过早认死身份

This is an immediate hard fail. The phrase `隐藏狼队视角` is not just unnatural;
it exposes hidden-team perspective and internal strategy in a public speech.

Root read: sheriff speech action output is not receiving the same public-output
privacy validation and repair coverage as ordinary speech/action reasons.

### 2. Accepted Speech Can Still End As A Fragment

D2 seat 10, a Witch, returned as `retry_ok` but the accepted public speech was:

> 我是10号Claude2。刚才9号DeepSeek2说的

This should have failed completion validation. The current cut-off detector does
not catch this short trailing pickup shape.

### 3. Day-Speech Fallback Rate Is Still Too High

All seven live fallbacks are ordinary `DAY_SPEECH` rows. Attempt diagnostics
show repeated local validation rejection rather than a pure network/provider
failure. Frequent reasons included:

- `凭空引用未公开查验结果`
- `D1首验理由不是主要攻击点`
- `普通局发言必须推进一个游戏动作`
- `报查验结果等同预言家声明，不能追问是否跳预言家`

The most important pattern is D2 public-check lag: after 2号 publicly reported
11号查杀, later speakers who referenced that report were still rejected as
fabricating an unpublished check. That suggests the public claim/check board or
validator evidence window is not incorporating the immediately preceding Seer
speech quickly enough.

## Positive Signals

The mechanism direction is still supported by the clean rows.

Examples:

- Seat 8 avoided repeating the same pressure axis:

  > 刚才GLM那段话，9号那句“警徽要给能听完对跳、还能把票口说清的人”，他拿到查杀前说的，现在看确实有点意思。不过这个点已经被前面四个人说过了，我就不跟着再压一遍。我换一个方向看。

- Seat 12 did not keep squeezing the 9号 line:

  > 9号这条线我前面也压过，但现在听了一圈，我不打算继续往同一个方向挤了。

- Seat 9 carried self-defense history:

  > 这个点，我上一轮就已经不认2号预言家了——我接他的查杀，他一句话把我按死，我到现在没听出他凭什么按死我。

- Seat 12 used pressure-chain reasoning rather than only repeating a target:

  > 2号这条压力链我看了一圈，1号先开口，后面GPT、Kimi、9号、11号全跟上来了，这个结构确实已经成形。但我想问的是——这个链子是谁在顺势推？

These are exactly the behaviors the earlier Fable5 mechanism review wanted:
seat-local history, pressure-budget steering, and non-ritual target shifting.

## Recommended Next Cut

Only do these two before any more paid live:

1. Add public-output privacy/completion validation to sheriff speech action
   outputs.
   - Reject or repair internal intent phrases such as `隐藏狼队视角`, `制造分歧`,
     and similar "private strategy note became public text" shapes.
   - Reuse the own-role/night-action private-leak guard where applicable.
   - Add regression coverage where a Werewolf sheriff speech candidate leaks
     `隐藏狼队视角`.

2. Fix immediate public-check evidence for ordinary speech validation.
   - After a public Seer speech reports a new check, later speakers in the same
     day must be allowed to reference that check.
   - Add a regression where 2号 reports `11号查杀`, then 3号 references it
     without triggering `凭空引用未公开查验结果`.
   - Add a cut-off regression for `刚才9号DeepSeek2说的`.

After that, rerun local tests and only then consider one 50-call paid sample
with the same seed/budget. The acceptance target should be:

- 0 public private-intent leaks.
- 0 accepted sentence fragments.
- Day-speech fallback no worse than 1-2/23.
- No high-risk local eval cases.

## User Review Checklist

When judging manually, prioritize these four questions:

1. Does any public speech reveal a hidden role, night action, or team strategy?
2. Does any accepted public speech look unfinished?
3. Are players reacting from their own previous position, or just restating the
   table state?
4. After a check/claim, do later seats split into different actions instead of
   all saying the same cautious line?

For this sample, question 1 and question 2 fail.

## Post-Fix Local Follow-Up

Date: 2026-06-13

Implemented local fixes:

- `sheriffSpeech` action decisions now reject public messages that expose
  private role/team strategy, including `狼队视角` and related hidden-team
  strategy wording.
- Public action constraints now treat sheriff speech phases as public-output
  phases.
- Wolf private speech context no longer passes the raw night-strategy summary
  into speech generation. It gives a public-safe instruction instead.
- Wolf speech-plan strategy text is naturalized away from internal phrases such
  as `先隐藏狼队视角` and `制造分歧`.
- Mock/direct speech assembly filters wolf internal motive points before
  joining public speech.
- Ordinary speech validation now rejects short previous-speaker pickup fragments
  such as `刚才9号DeepSeek2说的`.
- Ordinary public-check validation now accepts a newly public Seer check when
  the cited claimant's recent public speech itself contains the same target and
  result, even if the formal claim board has not caught up yet.

New regression tests:

- `src/ai/actionProviders.test.ts`: `rejects sheriff speech messages that expose private wolf strategy`
- `src/ai/speechProviders.test.ts`: `rejects ordinary speech that ends after a previous-speaker pickup`
- `src/ai/speechProviders.test.ts`: `allows ordinary speakers to reference an immediately public Seer check`

Verification:

- `npm.cmd run test -- src/ai/actionProviders.test.ts -t "rejects sheriff speech messages that expose private wolf strategy"` passed.
- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "previous-speaker pickup|immediately public Seer check"` passed.
- `npm.cmd run test -- src/ai/actionProviders.test.ts -t "sheriff speech candidates|public action reasons|private wolf strategy"` passed: 4 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "previous-speaker pickup|immediately public Seer check|target name ends with a digit in speech|generic counterclaim status|ordinary D1 first-check motive|repeated full-quote propagation"` passed: 6 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 366 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- Local full-game mock after the fix:
  - `tmp/12p-fullgame-lowcost-mock-after-livefix-report.json`
  - `tmp/12p-fullgame-lowcost-mock-after-livefix-cases.json`
  - `tmp/12p-fullgame-lowcost-mock-after-livefix-eval.json`
  - 1/1 game completed, day 4/5 flow reached `GAME_OVER`, 146 calls,
    fallback 0, error 0, validationFailure 0, totalQualityIssues 0.
  - Local eval: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds
    empty.
  - Scan found no `狼队视角`, `隐藏狼队`, `制造分歧`, `狼队首夜`, or `队友` in the
    new mock report/cases/eval outputs.

Current status:

- The two live-sample go-blockers now have local regression coverage and pass.
- This is not a new paid Mimo proof. Do not mark real 12p as go until either
  Opus 4.8 accepts the local evidence as sufficient or one small paid rerun
  confirms the same behavior live.

## Opus 4.8 Review Prompt

Use this prompt after providing the files listed below. Keep the package narrow;
do not ask Opus to re-audit the whole repo.

```text
模型确认：请你先说一句你当前是什么模型。

你是外部机制审查员。本轮不要重读仓库，只基于我给你的审查包和摘录判断。

背景：
- 项目是 12 人狼人杀 AI 发言机制，目标是让 12p 警长局发言达到“基本及格”。
- 之前 9p 发言已经基本过线；12p 的主问题转向警长局公开身份/查验路径、玩家私有动机、压力预算和防止公开泄露私密信息。
- 本轮小 paid live 样本不是完整局，只是 60 call bounded read，用来判断 real-model player feel。

请重点阅读：
1. docs/evaluations/2026-06-13-12p-mimo-fullfeel-small-live-review.md
2. tmp/12p-mimo-fullfeel-small-live-report.json 的 summary、SHERIFF_SPEECH rows、DAY_SPEECH fallback diagnostics
3. tmp/12p-fullgame-lowcost-mock-after-livefix-report.json 的 summary
4. tmp/12p-fullgame-lowcost-mock-after-livefix-eval.json 的 summary
5. 本轮新增/修改的相关测试名称和结果：
   - action rejects sheriff speech private wolf strategy
   - speech rejects previous-speaker pickup fragment
   - speech allows immediately public Seer check
   - provider aggregate 366 tests passed
   - tsc/lint passed

你要回答：
Q1. 这两个 hard blocker 的修复方向是否正确？
   - sheriffSpeech 公开消息拦截/净化私密狼队策略
   - ordinary speech 允许刚公开的预言家查验，同时拦短尾半句

Q2. 基于 post-fix local evidence，是否需要再跑 paid live？
   选项只能是：
   - go：可以认为 12p 发言基本及格，不必再跑 paid live
   - bounded-rerun：只需要一次 50-60 call paid live 确认
   - continue：还需要本地再修，不该花 live

Q3. 如果选择 bounded-rerun，请给出最小 rerun 范围和验收指标。

Q4. 如果选择 continue，请只列最多两个下一刀，不要给泛泛风格建议。

判断标准：
- private leak 和 accepted fragment 是硬门槛。
- fallback 率是读数污染，但不要为了 mock/report-only surface warning 继续硬修。
- 不要建议扩禁词、动作硬配额或完整局 paid run，除非你认为有机制必要。
- 重点看底层机制，不要纠结单句审美。

请用中文回答，结构：
结论：go / bounded-rerun / continue
理由：
下一步：
不要做：
```

## Opus 4.8 Bounded Rerun Result

Date: 2026-06-13

Opus 4.8 reviewed the post-fix local evidence and chose `bounded-rerun`, not
`go`: private leaks and accepted fragments are hard gates, and both original
blockers came from paid live rather than mock.

The approved bounded rerun was then run with the same seed and temporary
process env only:

- `tmp/12p-mimo-fullfeel-bounded-rerun-report.json`
- `tmp/12p-mimo-fullfeel-bounded-rerun-cases.json`
- `tmp/12p-mimo-fullfeel-bounded-rerun-eval.json`

Bounded rerun summary:

- 60 calls, stopped at `max_llm_calls`, reached day 2 `DAY_SPEECH`.
- 32 public speech-like rows.
- fallback 3, error 3, validationFailure 1; speech-like fallback rate was
  about 2.8 per 30 rows.
- Local eval: 60 cases, averageScore 97.1, issueCount 8,
  highRiskCaseIds 3.
- Private wolf-strategy scan found 0 hits for `狼队视角`, `隐藏狼队`,
  `制造分歧`, `狼队首夜`, `队友`, or similar wolf-team wording.

Gate result:

- Private leak gate: pass in this sample.
- Accepted-fragment gate: fail. D1 10号 Claude2 was accepted as:
  `我先说9号DeepSeek2刚才那段。他抓6号Gemini那句`
- Public-check gate: still noisy in attempts and eval. Some same-day public
  Seer-check references were accepted after retry, but the run still produced
  `凭空引用未公开查验结果` retries/fallback rows and evaluator
  `logic_boundary_error` false-positive-looking rows around public `2号报10号金水`.

Decision:

- Continue narrowly, not go.
- Do not spend another paid sample before the accepted-fragment path is fixed
  locally.
- Treat public-check/eval noise as a secondary diagnostic unless a final
  accepted output contains a truly fabricated check.

## Post-Rerun Fragment Hardgate Follow-Up

Implemented a narrow provider-level fix:

- Ordinary `普通局发言疑似被截断` remains a soft validation error for retry and
  repair, so reparable forward-commitment tails can still be trimmed and kept.
- If the final accepted candidate still has that truncation error and cannot be
  repaired, the provider no longer soft-accepts it; it now falls through to
  fallback instead of letting a half sentence pollute later speakers.

New regression:

- `src/ai/speechProviders.test.ts`: `does not soft-accept ordinary speech that still ends as a fragment after retries`

Verification after the hardgate:

- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "does not soft-accept ordinary speech|soft accepts forward commitment endings after retry by cutting the trailing promise|accepts ordinary speech when only soft quality guards remain after retries|rejects ordinary speech that ends after a previous-speaker pickup"` passed.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 367 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- Local full-game mock after the fragment hardgate:
  - `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-report.json`
  - `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-cases.json`
  - `tmp/12p-fullgame-lowcost-mock-after-fragment-hardgate-eval.json`
  - 1/1 game completed, day 5 `GAME_OVER`, 146 calls, fallback 0, error 0,
    validationFailure 0, totalQualityIssues 0.
  - Local eval: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds
    empty.
  - Scan found 0 private wolf-strategy hits and 0 accepted fragment-tail hits
    in the new mock report.

Current status:

- The latest paid rerun did not pass because it accepted one unrepaired
  fragment.
- The fragment class is now fixed locally and regression-tested.
- A fresh paid rerun would be the next live proof if the user wants a final
  `go` decision; do not run it automatically without explicit approval.

## Final Bounded Rerun After Fragment Hardgate

Date: 2026-06-13

The user approved the next bounded paid proof after the provider-level fragment
hardgate.

Evidence:

- `tmp/12p-mimo-fullfeel-final-rerun-report.json`
- `tmp/12p-mimo-fullfeel-final-rerun-cases.json`
- `tmp/12p-mimo-fullfeel-final-rerun-eval.json`

Rerun summary:

- 60 calls, stopped at `max_llm_calls`, reached day 2 `DAY_SPEECH`.
- 32 public speech-like rows.
- fallback 4, error 4, validationFailure 1.
- Speech-like fallback was 3/32, about 2.8 per 30.
- Local eval: 60 cases, averageScore 97.8, issueCount 6,
  highRiskCaseIds 2.
- Private wolf-strategy scan found 0 hits.
- The previous `刚才X说的` accepted-fragment class stayed at 0.

Gate result:

- Private leak gate: pass.
- Original accepted-fragment gate: pass.
- New accepted-fragment tail: fail. D1 4号 ended at
  `...外置位要反驳就拿硬身份来对撞，别光说`.

Local follow-up:

- Added an ordinary surface guard for empty rebuttal tails such as `别光说`,
  `不能光说`, and `别只说`.
- Added regression:
  `rejects ordinary speech that ends at an empty rebuttal cue`.

Verification after this local follow-up:

- `npm.cmd run test -- src/ai/speechProviders.test.ts -t "empty rebuttal cue|does not soft-accept ordinary speech|soft accepts forward commitment endings after retry by cutting the trailing promise|accepts ordinary speech when only soft quality guards remain after retries"` passed.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` passed: 368 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- Local full-game mock after the empty-rebuttal-tail guard:
  - `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-report.json`
  - `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-cases.json`
  - `tmp/12p-fullgame-lowcost-mock-after-empty-rebuttal-tail-eval.json`
  - 1/1 game completed, day 5 `GAME_OVER`, 146 calls, fallback 0, error 0,
    validationFailure 0, totalQualityIssues 0.
  - Local eval: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds
    empty.
  - Scan found 0 private wolf-strategy hits and 0 accepted fragment-tail hits
    in the new mock report.

Current status:

- This latest paid rerun still is not a `go` proof because it found one new
  accepted fragment shape.
- The new fragment shape is now fixed locally and mock-regressed.
- Do not spend another paid sample automatically; ask the user whether they
  want one more bounded proof or want to stop at local proof for now.

## Public Check / Identity-Claim Boundary Follow-up

Date: 2026-06-13

Opus 4.8 reviewed the post-empty-tail state and chose `A`: fix public
check / identity-claim boundary pollution locally before another paid proof.

Why this was treated as a blocker:

- The final paid rerun's high-risk cases and bad fallback rows pointed at the
  same structural issue: `publicClaimBoard` could show a non-Seer claim, such
  as Mimo/HUNTER, carrying structured `checks`.
- That can make both the model input and evaluator metadata read "Hunter
  reported a black check", which is a public fact fabrication path rather than
  a style issue.

Local fix:

- `extractRoleClaimFromSpeech()` now keeps structured checks only when the
  claimed role is `SEER`.
- `upsertRoleClaim()` and `describeRoleClaim()` use the same boundary, so new
  role-claim events do not describe non-Seer checks.
- `buildClaimBoard()` also filters checks by claimed role to protect old or
  manually constructed dirty state.
- The rule is based on claimed role, not true role, so wolf counterclaims that
  publicly claim Seer still retain their fake checks.

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
- Local full-game mock after the claim-boundary guard:
  - `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-report.json`
  - `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-cases.json`
  - `tmp/12p-fullgame-lowcost-mock-after-claim-boundary-eval.json`
  - 1/1 game completed, day 5 `GAME_OVER`, 146 calls, fallback 0, error 0,
    validationFailure 0, totalQualityIssues 0.
  - Local eval: 80 cases, averageScore 100, issueCount 0, highRiskCaseIds
    empty.
  - Structure scan: 146 cases, non-Seer claims with checks 0, Seer claims with
    checks 267.

Current status:

- This boundary is now locally fixed and mock-regressed.
- A fresh paid bounded proof is still needed before calling the latest paid
  evidence `go`, because the fix landed after the final paid rerun.

## Paid Claim-Boundary Proof

Date: 2026-06-13

The user approved one more bounded paid proof after the public check /
identity-claim boundary guard.

Evidence:

- `tmp/12p-mimo-claim-boundary-paid-preflight-report.json`
- `tmp/12p-mimo-claim-boundary-paid-preflight-cases.json`
- `tmp/12p-mimo-claim-boundary-paid-proof-report.json`
- `tmp/12p-mimo-claim-boundary-paid-proof-cases.json`
- `tmp/12p-mimo-claim-boundary-paid-proof-eval.json`

Run summary:

- Preflight: 1 real Mimo action call, fallback 0, error 0, validationFailure 0.
- Proof: 60 calls, stopped at `max_llm_calls`, reached day 2 `DAY_VOTE`.
- Speech/action: 22/38.
- fallback 2, error 2, validationFailure 1.
- Local ordinary eval: 60 cases, averageScore 97.8, issueCount 6,
  highRiskCaseIds 2.

Hard-gate scan:

- Non-Seer claimBoard entries carrying structured checks: 0.
- Non-Seer own-check public statements: 0.
- Private leak hits: 0.
- Accepted fragment hard-shape hits: 0.

Interpretation:

- The public check / identity-claim boundary held in live Mimo. Mimo/HUNTER
  appears in `publicClaimBoard` with `checks: []`; Seer claims keep their
  public checks.
- The two local eval high-risk rows look like evaluator false positives, not
  mechanism failures. Both are legal public references to claimed Seer checks:
  5号 Mimo/HUNTER and 7号 GLM/VILLAGER both say that two claimed Seers reported
  9号查杀. They do not claim to own checks themselves.
- The one `malformed_output_fragment` warning is a complete vote reason ending
  with `这个转折我到现在没听明白。`; it is not the previous accepted half-sentence
  class.

Current status:

- The claim-boundary hard gate is passed live.
- The remaining decision is go/no-go by human or Opus review, not another paid
  proof by default.
- A narrow evaluator calibration may be useful later so legal public-check
  references by non-Seer speakers do not become `logic_boundary_error`.

## Evaluator Calibration

Date: 2026-06-13

Opus 4.8 judged the paid proof as `evaluator-calibration`: production-side hard
gates were live-clean, but local eval still produced false high-risk rows for
legal public references to claimed Seer checks.

Calibration:

- `logic_boundary_error` now checks attribution ownership instead of only seeing
  `查杀/金水` in a non-Seer speaker's text.
- If the result is attributed to a public claimed Seer in `publicClaimBoard`,
  any speaker may reference it.
- If the result is attributed to the current speaker and that speaker does not
  claim Seer, it remains an error.
- Generic shorthand like `两张预言家同时报9号查杀` is treated as public table
  state when no explicit non-Seer owner is present.
- Same-sentence pronoun carryover like `昨天他报过9号DeepSeek2查杀` inherits
  the prior explicit claimed Seer owner.
- The complete vote-reason ending `这个转折我到现在没听明白。` no longer
  triggers `malformed_output_fragment`.

Offline re-eval:

- Input: `tmp/12p-mimo-claim-boundary-paid-proof-cases.json`
- Output:
  `tmp/12p-mimo-claim-boundary-paid-proof-after-evaluator-calibration-eval.json`
- Result: 60 cases, averageScore 99.1, issueCount 3.
- `logic_boundary_error`: 0.
- `malformed_output_fragment`: 0.
- highRiskCaseIds: empty.

Decision:

- Mechanism hard gates and local evaluator now align.
- The 12p Mimo speech-mechanics proof can be treated as `go` from the hard-gate
  perspective.
- Remaining warnings are report-only surface variety signals:
  repeated sheriff-standard wording and `rolePublicAction` skew.
- Do not run another paid bounded proof by default.

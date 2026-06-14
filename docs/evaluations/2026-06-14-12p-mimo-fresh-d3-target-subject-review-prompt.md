# 12p Mimo Fresh D3 Target-Subject Review Prompt

Date: 2026-06-14

## Purpose

Ask an external mechanism reviewer whether the latest local fixes are enough to
justify one more bounded paid D3 proof, or whether another local attribution
fix is still required first.

This is not a request to judge broad writing style. The hard question is
whether structured public claim extraction is now closed well enough for the
next paid proof.

## Review Result And Superseding Status

Reviewer result: `continue-local`.

Reason:

- The prior target-subject fix closed one phrasing, but the extractor still had
  the wrong architecture: broad self-owned extraction followed by quoted-check
  blacklist subtraction.
- Because three consecutive paid/local loops had surfaced new quoted-check
  phrasings, another paid proof before a structural local fix would likely only
  find another variant.

Follow-up already applied:

- `src/game/claims.ts` now classifies check ownership by governing verb class.
  Owned check verbs with speaker/omitted subject can produce speaker `checks`;
  report/quote verbs or other-seat/pronoun subjects cannot.
- `src/game/claims.test.ts` has a two-sided regression for
  `2号Claude给的金水`, `4号豆包留的2号查杀`, and self-owned
  `昨晚验的2号Claude，查杀`.
- `src/ai/llmEvaluation.ts` and `src/ai/llmEvaluation.test.ts` were calibrated
  for the fresh D3 legal public-check quote.
- Offline re-eval output:
  `tmp/12p-mimo-cross-seer-attribution-d3-fresh-after-structural-calibration-eval.json`.

Current next step:

- One fresh bounded same-seed D3 paid proof, only after explicit user approval
  and temporary provider input.
- The proof only counts if the fake-Seer/quoted-Seer old-check trigger
  actually appears.

## Evidence Package

Read these files first:

1. `docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md`
2. `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
3. `tmp/12p-mimo-cross-seer-attribution-d3-fresh-report.json`
4. `tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json`
5. `tmp/12p-mimo-cross-seer-attribution-d3-fresh-eval.json`
6. `tmp/12p-mimo-cross-seer-attribution-d3-fresh-hardscan.json`
7. `tmp/12p-mimo-cross-seer-attribution-d3-fresh-kimi-review.txt`

Relevant code and tests:

1. `src/game/claims.ts`
2. `src/game/claims.test.ts`
3. `src/ai/speech/ordinarySurface.ts`
4. `src/ai/speechProviders.test.ts`
5. `src/ai/llmEvaluation.ts`
6. `src/ai/llmEvaluation.test.ts`

## Compact Context

Project goal:

- 12-player ordinary Werewolf AI speech with real Mimo should move from
  "hard gates pass" to "full-game read-feel is acceptable".
- Hard gates are stricter than style: private leak, accepted fragment, non-Seer
  structured checks, and wrong Seer check ownership are blockers.
- Do not treat repeated phrases, vote-reason sameness, or action distribution
  skew as blockers unless they create a mechanism-level failure.

Earlier hard-gate status:

- Private leak guard passed in prior paid proofs.
- Accepted fragment guard passed after local fixes, except when a new shape is
  discovered and fixed.
- Non-Seer structured checks were fixed and paid-verified.
- B-class evaluator false positive around legal public-check references was
  calibrated offline.

## Latest Fresh D3 Paid Proof

Run:

- Seed: 91.
- Board: `12p-sheriff-seer-witch-hunter-guard`.
- Model: `mimo-v2.5-pro`.
- Real phases: sheriff phases, `DAY_SPEECH`, `DAY_VOTE`.
- Max LLM calls: 90.
- Secret handling: provider base URL and key were entered through a temporary
  visible PowerShell runner; no key was written to `.env`, docs, source, logs,
  status JSON, or command arguments.

Machine summary:

- 90 calls: 33 speech, 57 action.
- Reached D4 `DAY_SPEECH`.
- stopReason: `max_llm_calls`.
- fallback/error: 11/90.
- validationFailureCount: 4.
- totalQualityIssues: 0.
- Local eval: 80 cases, averageScore 97.6, issueCount 8,
  highRiskCaseIds 4.

Hard scan:

- private leak hits: 0.
- accepted fragment hard-shape hits: 0.
- non-Seer claimBoard checks: 0.
- claimed-Seer same-target contradictions: 0.

Important: despite those zeros, this proof is still **not go**.

## Fresh Proof Failure

The key failure is a structured check ownership error.

8号 Kimi's D2 speech said:

```text
GLM那段我先放一下，他那句“压2号的人够多了”我听着有点怪，先不评价对不对。我现在更在意的是2号Claude刚才报的金水。 我是预言家，昨晚验的2号Claude，查杀。他刚才那套验12号豆包2的说辞，我现在完全不敢信。
```

Expected structured claim:

```text
8号 Kimi claimedRole=SEER
checks: 8 -> 2 WEREWOLF
```

Actual exported `publicClaimBoard` in the paid proof:

```text
8号 Kimi claimedRole=SEER
checks: 8 -> 2 GOOD
```

Root cause:

- The phrase `2号Claude刚才报的金水` was a legal quote about 2号 as the subject
  who had reported a gold check.
- The generic `2号...金水` extractor treated it as Kimi's own 8->2 `GOOD`.
- Dedupe by claimant+target then kept the bad `GOOD` and suppressed Kimi's
  later self-owned 8->2 `WEREWOLF`.

Why this is a blocker:

- It pollutes `publicClaimBoard`.
- It gives later model prompts a false public fact.
- It also pollutes local eval rows that depend on the board.
- It is the same class as previous Seer attribution bugs, but a different
  phrasing: target-as-subject quote, not other-Seer quote.

## Local Fix After Fresh Proof

Implemented locally after the proof:

- Added a regression for the exact 8号 Kimi text.
- `sentenceReferencesOtherClaimCheck()` now skips target-as-subject quoted
  reports such as `2号Claude刚才报的金水`.
- The filter is intentionally bounded to explicit report/quote cues:
  `刚才/之前/今天/... + 报/给/留/说/称`.
- Legal self-owned checks such as `昨晚验的2号Claude，查杀` still parse.

Verification:

- Red regression first failed with 8->2 `GOOD`.
- After the fix, the exact Kimi text extracts 8->2 `WEREWOLF`.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 32 tests.
- `npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts`
  passed: 52 tests.
- `npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
  passed: 369 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- task-card, long-task registry, JSON parse, `git diff --check`, and a
  secret-pattern scan outside known test fixtures passed.

## Reviewer Prompt

```text
模型确认：请你先说一句你当前是什么模型。

你是外部机制审查员。本轮可以只基于我给你的审查包、摘录和代码片段判断；不需要重新跑 paid。请重点判断“本地机制修复是否足够进入下一次 bounded paid proof”，不是判断最终 go。

背景：
- 项目是 12 人狼人杀 AI 发言机制，目标是从 hard gate 过线推进到“完整局 real Mimo 读感也及格”。
- private leak、accepted fragment、非 Seer structured checks、Seer 查验归属错误都是 hard gate。
- vote reason 同质化、repeated phrase、rolePublicAction 占比偏高目前是 report-only，除非你认为它们造成机制污染。

最近三轮核心事实：

1. full-game paid 样本读感基本及格，但 publicClaimBoard 把 2号 dead Seer 的旧 1号金水吸进 11号 GPT2 的悍跳 Seer claim，造成 11号对 1号同时有 WEREWOLF 和 GOOD。已本地修：引用他座/代词主语旧查验不进当前 speaker checks；同 claimant+target dedupe 防同目标矛盾。

2. longer D3 paid proof 达到 D3/D4，但发现非冲突污染：8号 Kimi 自报 1号查杀，同时引用 1号今天跳预言家报 2号查杀，board 错把 8->2 WEREWOLF 也挂到 Kimi。还发现 7号 GLM accepted fragment `重点全在`。两者已本地修：同句 explicit other-seat/pronoun 主语识别；provider/eval 共用 focus-marker fragment detector。

3. fresh D3 paid proof 再次达到 D3/D4，老硬扫描为 private leak 0、accepted fragment 0、non-Seer checks 0、claimed-Seer same-target contradictions 0，但仍失败：8号 Kimi 原文是 `我现在更在意的是2号Claude刚才报的金水。 我是预言家，昨晚验的2号Claude，查杀。`，board 却存成 8->2 GOOD。根因是 target-as-subject quote `2号Claude刚才报的金水` 被当成 Kimi 自己的金水，并因 claimant+target dedupe 吞掉后面的真实查杀。已本地修：target-as-subject quoted report cues 被跳过；自报 `昨晚验的2号Claude，查杀` 保持可解析。红测先失败后通过。

关键证据：
- Fresh proof report: tmp/12p-mimo-cross-seer-attribution-d3-fresh-report.json
- Fresh proof cases: tmp/12p-mimo-cross-seer-attribution-d3-fresh-cases.json
- Fresh proof eval: tmp/12p-mimo-cross-seer-attribution-d3-fresh-eval.json
- Fresh proof hard scan: tmp/12p-mimo-cross-seer-attribution-d3-fresh-hardscan.json
- Kimi review extract: tmp/12p-mimo-cross-seer-attribution-d3-fresh-kimi-review.txt
- Current local task card: docs/tasks/2026-06-12p-mimo-speech-mechanics.md
- Current review log: docs/evaluations/2026-06-13-12p-mimo-fullgame-paid-after-hardgate-review.md
- Current local fix/tests: src/game/claims.ts, src/game/claims.test.ts

最新本地验证：
- npm.cmd run test -- src/game/claims.test.ts passed: 32 tests.
- npm.cmd run test -- src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/game/tableMemory.test.ts passed: 52 tests.
- npm.cmd run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts passed: 369 tests.
- npx.cmd tsc --noEmit --pretty false passed.
- npm.cmd run lint passed.

请回答以下问题：

Q1. 当前状态应该判为哪一个？
- rerun-now：本地修复已经足够，下一步应该只跑一次 fresh bounded paid D3 proof。
- continue-local：还需要先本地修一个具体机制点，不能继续花 paid。
- review-only：不应再跑 paid，先需要人工/外部审查更多证据。

Q2. 如果你选 continue-local，最多列两个必须先修的机制问题。不要列审美项。

Q3. 如果你选 rerun-now，请给最小 paid rerun 范围和验收指标。默认应是同 seed 91、单局、90-100 call、覆盖 SHERIFF + D1/D2/D3 DAY_SPEECH/DAY_VOTE。

Q4. Fresh proof 里的 highRiskCaseIds 4 个是否应视为 blocker？请区分：
- stale board metadata 导致的 eval 污染；
- 真实 public-check attribution bug；
- 纯 evaluator false positive；
- 与本轮 hard gate 无关的读感 warning。

Q5. 是否需要继续扩 claim extraction 的本地规则？如果需要，请说明一个最小规则；如果不需要，请明确说不要继续 local regex 空转。

不要建议：
- 完整多局 paid run；
- 扩禁词或动作硬配额；
- 为 vote reason 同质化、repeated phrase、rolePublicAction skew 开新刀；
- prompt builder 和 evaluator 各写一套归属过滤。

请用中文回答，结构：
结论：rerun-now / continue-local / review-only
理由：
Q4 high-risk 判断：
下一步：
不要做：
```

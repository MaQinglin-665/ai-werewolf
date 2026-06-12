# Ordinary Mimo Speech Quality v26 Fable5 Minifix Review

This pack is intentionally small. It covers only the v25-to-v26 minifix after the latest Fable5 critique.

Do not re-review the whole repository. The question is whether the local mock/fallback guard is now good enough to stop local template chasing and move to a small paid live Mimo sample once quota is available.

## Minimal Read List For Fable5

Read only these unless a claim needs source verification:

- `docs/evaluations/2026-06-11-ordinary-mimo-v26-fable5-minifix-review.md`
- `src/ai/speechProviders.ts`
- `src/ai/tableRead.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.test.ts`
- Optional prior context: `docs/evaluations/2026-06-11-ordinary-mimo-v25-fable5-review.md`

Skip UI, deployment, room APIs, class-trial theme code, token-cost reduction, and unrelated provider routing.

## What v26 Changed

Fable5 v25 critique said the remaining defects were not prompt-direction failures. They were small local mechanics:

1. mock/fallback splicing could produce `不把直接打死`;
2. bridge templates were still being reused after only changing their wording;
3. sample-level repeated-clause metrics missed obvious cross-seat long-clause reuse.

v26 applied only those small fixes:

- Fixed repeated full seat labels so a repeated full name degrades to `N号`, preventing `不把直接打死`.
- Added used-once selection for mock bridge lines across recent table speech:
  - previous-speaker bridge lines;
  - support/pressure/rally interaction lines;
  - public-role vote leads;
  - agenda ask wrappers;
  - counter-push / focus-evidence lines.
- Added seed variation across days and evidence text for mock evidence rendering.
- Changed `repeated_clause_rate` to inspect full output text, normalize seat numbers and player names, and report normalized long shared clauses from 15+ Chinese chars across rows.
- Kept this report-only. It does not affect validation, retry, score, or fallback.

No new broad phrase ban was added.

## Local Evidence

Command:

```text
npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --max-cases=30 --json --out=tmp/ordinary-mimo-v26-post-fable-minifix-mock-eval.json
```

Summary:

```json
{
  "totalCases": 30,
  "averageScore": 100,
  "issueCount": 0,
  "byIssueCode": {},
  "highRiskCaseIds": [],
  "sampleMetrics": [
    {
      "code": "repeated_surface_phrase",
      "severity": "warn",
      "value": "2/15",
      "detail": "multi-seat repeated surface phrase: 处能撑住今天这票"
    },
    {
      "code": "repeated_clause_rate",
      "severity": "warn",
      "value": "2/15",
      "detail": "normalized repeated long clause: 的是{seat}号{name}这会儿被推到台前主要卡在"
    }
  ]
}
```

Interpretation: this is an improvement over v25 because the metrics are no longer silent. The remaining warnings are local mock/fallback template reuse, not live Mimo style evidence.

## Mock Sample Excerpt

Source: `tmp/ordinary-mimo-v26-post-fable-minifix-mock-eval.json`.

```text
D1 1 DeepSeek: 我把能听到的点摆一下，枪牌不用抢着拍，先听谁的站边讲不圆。昨夜平安夜，我当背景。前面样本少，先说我暂时怎么听。所以这轮我先不压票，听一圈再看谁急着带节奏。
D1 2 Claude: 我先说听感，我拍女巫，我这张牌先把票口压实。我把票口收到1号这里，等他自己回。这不是空踩，我卡的是1号DeepSeek这会儿被推到台前，主要卡在回避站边；1号前面有回避站边的记录。
D1 3 GPT: 我说一个不舒服的点，我不铺全场，先问1号DeepSeek刚才那段怎么接到票上。Claude这段我先当参考，但1号还得自己把话接上，再看1号现在吃压，主要因为被Claude质疑、回避站边，另外他前面有回避站边的记录。2号Claude的判断我先记成样本，但不直接照搬。这轮别空过，只看他哪句话能真正落到投票上。
D1 5 Mimo: 我先说听感，1号DeepSeek这里先挂着，等他自己补清楚为什么这么投。豆包那段我先放一下，先回到1号没讲顺的地方，再看前面对1号的压力先留桌上，我换成听票口怎么落，另外他前面有回避站边的记录。4号豆包那段我先记着，票口还是按我自己的理由走。看他前面的话有没有一处能撑住今天这票。
D1 6 Gemini: 我不急着锁死，打回4号豆包不是情绪牌，我只看他说过的话和怎么落票。边界放清：不把4号直接打死。我不把4号投死，只回看他已经说出口的逻辑。这轮别空过，听他把前后表态和今天票口接起来。
D1 8 Kimi: 我按前后发言往回看，压力先留在1号DeepSeek，看他说法和票型有没有接上。1号这边先别只听结论，要看站边怎么落票。他这个压力不用再复述，我只看他回应能不能接住，另外他前面有回避站边的记录。他发言前我先不定死，等他给完视角再决定票怎么落。
```

## Live Mimo Attempt

Command shape:

```text
MIMO_LLM_API_KEY=<temporary process env only> npm run llm:evaluate -- --models=mimo-v2.5-pro --lineup-count=9 --board=9p-seer-witch-hunter --human=9 --auto-human=mock --real-phases=DAY_SPEECH --max-llm-calls=8 --max-steps=90 --seed=91 --json --out=tmp/ordinary-mimo-v26-post-fable-live-report.json --eval-cases-out=tmp/ordinary-mimo-v26-post-fable-live-eval-cases.json
```

Result:

```json
{
  "totalCalls": 8,
  "speechCalls": 8,
  "actionCalls": 0,
  "fallbackCount": 8,
  "errorCount": 8,
  "validationFailureCount": 0,
  "byFailureType": {
    "provider_error": 8
  },
  "byRetryIssue": {
    "provider_request": 8
  }
}
```

Provider error was HTTP 403 `insufficient_user_quota`. The fallback transcript from this run must not be judged as live Mimo style.

## Token-saving Prompt To Give Fable5

```text
请只审这份 v26 摘要，不要重新读全仓库。背景：普通 9 人狼人杀 AI 发言质量阶段，方向已定为“正向供给 + 候选动作 + 窄硬校验”，不再靠扩禁词治理玩家语感。

v25 后你指出 3 个小问题：1) mock 拼接有“边界放清：不把直接打死”；2) 桥接模板换词后仍跨座位复用；3) repeated long clauses 指标沉默。

v26 只做三件小修：
- 重复全称退化为 N号，修掉“不把直接打死”。
- mock bridge/agenda/support/rally/public-role/counter-push/focus-evidence 候选加“本局近期已用即避让”，并加跨天 seed 扰动。
- repeated_clause_rate 改为读完整 outputText，归一座位/人名后，15+ 中文长子句跨行重合即 report-only warn；不影响 retry/fallback/score。

验证：
- targeted AI tests passed。
- mock eval seed91 30 cases：avg100、issue0、highRisk0，但 sampleMetrics 现在报 2 个 warn：
  1. repeated_surface_phrase = “处能撑住今天这票” 2/15；
  2. repeated_clause_rate = “的是{seat}号{name}这会儿被推到台前主要卡在” 2/15。
- bounded live Mimo 8 calls 全部 403 insufficient_user_quota，fallbackCount8/errorCount8，所以不能评价真实 Mimo 风格。

样本重点：
D1 2: 我先说听感，我拍女巫...这不是空踩，我卡的是1号DeepSeek这会儿被推到台前，主要卡在回避站边...
D1 5: ...前面对1号的压力先留桌上，我换成听票口怎么落...看他前面的话有没有一处能撑住今天这票。
D1 6: ...边界放清：不把4号直接打死。我不把4号投死，只回看他已经说出口的逻辑。
D1 8: ...他这个压力不用再复述，我只看他回应能不能接住...

请判断：
A. v26 是否已达到“停止本地 mock 打磨，补额度后跑小 paid live Mimo”的门槛？
B. 剩余 2 个 mock warnings 是该继续修，还是保留为 gate，等 live 样本判断？
C. repeated_clause_rate 的 15 字归一阈值是否太松/太紧？
D. 还有没有机制层漏项？不要建议扩禁词，除非是规则、私密信息、死亡/身份硬错误。
```

## Current Recommendation Before Fable

Stop local mock chasing here.

The v26 local gate now catches the exact class of repeated long-clause problem that v25 missed. The remaining local warnings are useful guardrail signals, but they are not worth another broad positive-supply pass before a real live sample. The next engineering step should be: top up or switch the temporary provider key, then run a bounded paid live Mimo Day 1 sample of 6-9 speeches and review human feel manually plus `sampleMetrics`.

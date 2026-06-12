# Ordinary Mimo Speech Quality v41 Live Review Pack

Updated: 2026-06-12 08:17 Asia/Shanghai

## Purpose

Ask Fable5 to review the current ordinary-game AI speech quality after the latest bounded live Mimo sample. Do not ask it to scan the whole repository.

The earlier `403 insufficient_user_quota` diagnosis is now obsolete for the current temporary Token Plan route. A direct provider probe and a 1-call project preflight both succeeded with the same base URL/model route. The latest bounded Day 1 live sample reached Mimo and produced accepted non-fallback speech.

This stage intentionally moved away from adding broad soft word bans. The current direction is:

- positive context supply before generation: per-seat player voice, self-history, public table objects, current pressure, and candidate move diversity;
- candidate-action steering for repeated table rhythms, not validator-first censorship;
- narrow hard validation for rules/public-info/role-claim/death-state/private-info/truncation mistakes;
- report-only sample metrics for table-wide sameness, not as a quality score replacement;
- live transcript reading remains the final quality gate.

## Minimal Files For Fable5

Read these only if source inspection is needed:

- `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`
- `docs/tasks/2026-06-ordinary-mimo-speech-quality-roadmap.md`
- `src/ai/speechProviders.ts`
- `src/ai/llmEvaluation.ts`
- `src/game/tableMemory.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.test.ts`

Primary evidence files:

- `tmp/ordinary-mimo-v41-live-d1-cn-base-report.json`
- `tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json`
- `tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json`

Avoid reading:

- `.env` or secrets;
- `.next`, `node_modules`, database files, generated caches;
- unrelated UI, deployment, audio, or room-networking files;
- old `tmp/*` files except the primary evidence above.

## Latest Live Evidence

Provider route:

- model: `mimo-v2.5-pro`
- base URL: Token Plan OpenAI-compatible `/v1`
- key handling: temporary process env only, not persisted

Preflight:

- direct provider request returned HTTP 200;
- 1-call project `llm:evaluate` preflight returned `fallbackCount 0`, `errorCount 0`, `validationFailureCount 0`.

Bounded Day 1 sample:

- report: `tmp/ordinary-mimo-v41-live-d1-cn-base-report.json`
- cases: `tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json`
- eval: `tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json`
- `totalCalls`: 8
- `speechCalls`: 8
- `actionCalls`: 0
- `fallbackCount`: 0
- `errorCount`: 0
- `validationFailureCount`: 0
- `totalQualityIssues`: 0
- providers: `custom-speech:mimo-v2.5-pro`
- local existing-case eval: `averageScore 100`, `issueCount 0`, `highRiskCaseIds []`

Report-only sample metrics did warn:

- `repeated_surface_phrase`: `信息少暂时不压票`, `4/8`
- `repeated_clause_rate`: `信息少暂时不压票这个`, `4/8`

Interpretation: the transport/fallback problem is no longer blocking. The remaining question is human feel: did the first seat's `底牌不虚` become a believable table hook, or did it create an overly single-axis table where too many seats chase the same phrase?

## v41 Live Transcript Excerpt

Board: `9p-seer-witch-hunter`, seed 91, Day 1 speech-only bounded live Mimo sample.

1. D1 1号 Hunter / DeepSeek:
   平安夜女巫用药了，我先听一圈。底牌不虚，但这轮信息太少，我暂时不压票。

2. D1 2号 Witch / Claude:
   二号Claude发言。 平安夜大家都知道，不多说。我是女巫，昨晚救的是四号豆包，四号是银水，今天不盘四号。 我先说一下为什么现在跳。

3. D1 3号 Villager / GPT:
   二号Claude这个女巫身份我先认，四号豆包今天不动。 但一号DeepSeek刚才那句我有点没跟上，你说了“底牌不虚”，但又只说信息少暂时不压票，这个表态我听不出方向。二号给了明确信息，你这边现在有没有倾向怀疑谁，或者你准备等后置位说完再给？

4. D1 4号 Villager / 豆包:
   GPT刚才说的那句我认，他点的点就是我没听明白的点。你说了“底牌不虚”，又说信息少不压票，这前后我听着矛盾。底牌不虚是你自己有身份视角，还是只是泛泛一句撑腰话？二号女巫已经给了明信息，四号银水今天不动，你这边却还在说听一圈，我直接问你，你现在手里有没有一个能打出去的怀疑位，哪怕只是暂时的？

5. D1 5号 Werewolf / Mimo:
   豆包刚才那句我先放一下，他点1号点得确实对，但我想先听1号把话说完。 1号DeepSeek，你那句“底牌不虚”我卡了一下。你前面说平安夜信息少、暂时不压票，这个态度我能听，但“底牌不虚”这四个字像是你自己有什么视角撑着，和后面“信息少”连不上。你要是闭眼玩家，这时候更该说的是“我不确定”，而不是“底牌不虚”。

6. D1 6号 Werewolf / Gemini:
   1号DeepSeek，你那句“底牌不虚”我确实卡了一下。前面说信息少、暂时不压票，这个我能听懂。但“底牌不虚”这四个字，听起来像是你自己有点什么视角，和后面那句连不太上。我这轮先不跟票，但1号这个点我记下了。

7. D1 7号 Seer / GLM:
   我先把2号Claude这个女巫身份认下来，四号豆包今天不动。平安夜不多说。上一位6号Gemini说的那句我有同感，1号DeepSeek你那句“底牌不虚”确实让人卡住。你前面说信息少、暂时不压票，这个态度我能听懂，但“底牌不虚”这四个字，后面连的不是方向，是空的。

8. D1 8号 Werewolf / Kimi:
   我是8号Kimi。 二号Claude这个女巫身份我先认下来，四号豆包作为银水今天确实不动。但有个点我想说一下，前面好几个人都在追一号DeepSeek那句"底牌不虚"，这个疑点确实卡人。不过上一位七号GLM也重复了同样的追问，我现在想换个方向看。

## Current Local Judgment

What is clearly fixed:

- live provider route works with the current temporary key/base URL;
- no fallback rows in this bounded sample;
- no accepted truncation such as dangling `你说` or `有反证我会改...`;
- no future-audit hook from first seat such as `后面重点看谁反应最不自然`;
- low-information first seat is short and allowed to water-pass;
- sample-level repeated-clause metrics are no longer silent.

What remains worth external judgment:

- 1号's `底牌不虚` may be a plausible human soft identity phrase, or it may be too axis-generating for a low-information opener.
- 3/5/6/7 all chase the same `底牌不虚 + 信息少暂时不压票` contrast; 8号 notices the repetition and pivots, which is good, but the previous repetition may still feel too mechanical.
- 2号 Witch ends with `我先说一下为什么现在跳。` and then stops. This may be an unfinished accepted speech even though the hard validator did not flag it.
- 5/6/7 have similar critique skeletons. This is now a sample-level style issue, not a fallback/transport issue.

## Token-saving Prompt For Fable5

```text
只审下面这份 v41 live Mimo 普通局 D1 8行样本和机制摘要，不扫全仓库。目标：判断普通狼人杀 AI 发言是否已可进入下一阶段，还是还要修“底牌不虚”同轴追问。请按严重度列 3-5 个最不像真人的问题，区分：必须代码/上下文修、应该交给模型多样性、可接受真人波动。不要建议新增大词表/硬 fallback，除非是规则、私密、截断、身份事实错误。重点判断：低信息首置位短水、女巫公开跳、后置多人追同一句、sampleMetrics warning 是否足够守门。

证据：tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json 和 tmp/ordinary-mimo-v41-live-d1-cn-base-eval.json。摘要：8 calls，fallback 0，error 0，validationFailure 0，qualityIssues 0；sampleMetrics 警告 repeated_surface_phrase 4/8 和 repeated_clause_rate 4/8，集中在“底牌不虚 / 信息少暂时不压票”。

[粘贴本文 v41 Live Transcript Excerpt 的 8 行]
```

## Questions For Fable5

Please answer only from the excerpt and evidence summary unless a specific source file is necessary.

1. Is the current stage ready to stop local implementation and move to user/Fable acceptance, or is there one more must-fix before acceptance?
2. Is `底牌不虚` a tolerable live-player phrase for D1 1号 low-info water, or should the prompt/context discourage this soft identity phrase in no-info openers?
3. Is the 3/5/6/7 same-axis pursuit acceptable table behavior, or too much like one prompt pattern spreading across seats?
4. Should 2号 Witch's `我先说一下为什么现在跳。` ending be treated as an unfinished accepted speech and covered locally?
5. Are the two report-only `sampleMetrics` warnings enough as a gate for this class of issue, or should another sample-level signal be added before more live runs?

# 普通局 AI 发言与行动评测设计

## 背景

普通狼人杀 AI 已经进入“质量优化”阶段。当前问题不只是某一句 prompt 不好，而是需要稳定判断一次改动是否真的让普通局 AI 更像真人玩家、更少模板、更能把发言和行动连起来。

现有仓库已经有几条相关能力：

- `scripts/audit-ai-experience.mjs` 可以跑 mock/模拟审计，抓规则和体验问题。
- `scripts/evaluate-llm-game.mjs` 可以跑真实 LLM 小样本，并输出 Markdown/JSON。
- `src/ai/llmEvaluation.ts` 已经有一批质量 issue、retry issue 和优化建议汇总。
- `src/ai/speechProviders.ts`、`src/ai/actionProviders.ts`、`src/ai/seatMemory.ts` 已经开始记录发言、行动、fallback、validation 和连续性信息。

第一版评测不替换这些脚本，而是在它们之上建立一个普通局评测入口，并引入 promptfoo 作为可选的评测编排和 LLM-as-judge 工具。

## 用户确认的目标

- 第一版评测优先覆盖普通狼人杀，不覆盖学级裁判主题。
- 同时评估发言文本、行动选择、投票目标，以及发言到投票的一致性。
- 评测要抓三类问题：发言太模板/不像真人，逻辑或规则理解错误，没有推进目标或投票立场不连贯。
- 允许使用评审模型打分，但第一版应先有本地规则脚本打底，再少量使用 LLM 评审。
- 第一版做成本地命令行和 Markdown/JSON 报告，不做网页评测页面。
- 先使用已有样本或本地生成样本打通框架，再少量调用真实 Mimo/DeepSeek 验证。

## 非目标

- 不改游戏规则、胜负结算或合法动作生成。
- 不把 promptfoo 接入线上请求链路。
- 不让普通玩家在游戏时看到评测页面。
- 不把云 TTS、LiteLLM 或 Langfuse 作为本任务的一部分。
- 不要求第一版评测结论完全等同人工主观判断。
- 不在配置文件或报告里保存真实 API Key。

## 总体方案

采用“采样脚本 + 本地规则评分 + promptfoo 可选评审 + 报告”的混合评测。

```text
普通局 9p 样本
  -> 采样脚本生成 eval case JSON
  -> 本地规则评分抓硬问题
  -> promptfoo 可选调用评审模型做主观评分
  -> 输出 Markdown/JSON 报告
```

第一版评测入口建议命名为：

```powershell
npm run eval:ordinary-ai
```

可选参数：

```powershell
npm run eval:ordinary-ai -- --source=existing --json --out=docs/evaluations/ordinary-ai-eval-2026-06-08.json
npm run eval:ordinary-ai -- --source=mock --games=10 --seed-start=91
npm run eval:ordinary-ai -- --source=real --max-llm-calls=9 --judge=off
npm run eval:ordinary-ai -- --source=real --max-llm-calls=9 --judge=promptfoo
```

`source=existing` 优先读取已有 `tmp/ordinary-*.json` 或后续固定样本目录。`source=mock` 用本地 mock 跑结构和规则评分。`source=real` 少量调用真实 provider，只在用户明确接受成本时使用。

## 数据格式

评测脚本输出的基础单位是一个 `OrdinaryAiEvalCase`。它应尽量独立于 promptfoo，方便本地脚本和 promptfoo 共用。

```ts
type OrdinaryAiEvalCase = {
  id: string;
  boardId: string;
  seed: number;
  gameId?: string;
  day: number;
  phase: string;
  seatId: number;
  seatName: string;
  role?: string;
  task: "speech" | "action" | "vote";
  publicContext: {
    aliveSeats: Array<{ seatId: number; name: string }>;
    deaths: Array<{ seatId: number; name: string; day: number }>;
    priorSpeeches: Array<{ seatId: number; name: string; text: string }>;
    priorVotes?: Array<{ voterSeatId: number; targetSeatId?: number }>;
    publicClaims?: string[];
  };
  output: {
    text: string;
    commandType?: string;
    targetSeatId?: number;
    provider?: string;
    isFallback?: boolean;
    validationErrors?: string[];
    retryIssueCodes?: string[];
  };
  continuity?: {
    previousSpeechTargetSeatId?: number;
    voteTargetSeatId?: number;
    expectedFocusSeatIds?: number[];
  };
};
```

注意：`role` 只用于评测脚本内部分析，报告对玩家可见文本不应泄露私密角色信息。真实样本报告也不能包含 API Key、完整 raw provider error 或密钥来源。

## 本地规则评分

本地规则评分负责抓稳定、可解释、低成本的问题。第一版 issue code 建议：

- `template_tone`: 明显模板、审计报告腔、像复盘工具。
- `jargon_stack`: 堆叠“收益来源、发言链、闭合、收口、压力源、缺口”等内部黑话。
- `rule_lecture`: 把平安夜、女巫、死亡形态讲成规则课，缺少牌桌动作。
- `no_game_action`: 只复述局势，没有怀疑、暂保、追问、投票边界或行动承诺。
- `logic_boundary_error`: 把公开推断说成确定事实，或误读女巫/预言家/猎人等公开信息。
- `bad_followup_target`: 要求未发言或已经发言的人做不合理回应。
- `repeated_empty_pressure`: 后置位重复前面已经空转的问题。
- `speech_vote_discontinuity`: 发言压 A，投票/行动选 B，且没有公开理由解释转向。
- `fallback_or_error`: provider error、fallback、validation failure 或 retry 失败。

严重程度分两层：

- `blocking`: 影响规则可信度、隐藏信息边界、行动合法性或造成 fallback。
- `warning`: 影响主观质量，但不一定破坏对局。

本地规则评分应优先复用或扩展 `src/ai/llmEvaluation.ts`，避免在脚本里散落重复正则。

## promptfoo 评审

promptfoo 第一版只承担两件事：

1. 管理评审 case、provider、prompt 和输出报告。
2. 对主观质量使用 LLM-as-judge，补足规则脚本很难判断的“像不像真人”。

建议 promptfoo 评审维度：

- `human_table_voice`: 像不像普通狼人杀玩家说出来的话。
- `concrete_progress`: 是否推动了一个具体怀疑、追问、暂保、投票或行动目标。
- `context_fit`: 是否准确承接前面公开发言和当前死讯。
- `vote_continuity`: 投票或行动是否能从公开发言中看出理由。
- `over_template_risk`: 是否有模板、报告腔或内部字段感。

评分建议使用 1-5 分：

- 5: 很自然，能直接放进对局。
- 4: 可用，有小瑕疵。
- 3: 勉强可用，需要优化。
- 2: 明显模板或逻辑弱。
- 1: 不像玩家、误读严重或应阻断。

评审模型不应直接决定 pass/fail。最终 pass/fail 由本地 blocking issue 和聚合阈值决定。这样可以避免评审模型偶然偏见导致改动方向摇摆。

## 报告格式

Markdown 报告应 answer-first，方便人工快速判断。

建议结构：

```text
# 普通局 AI 评测报告

## 结论
- 是否通过第一版阈值
- 最大问题
- 推荐下一步

## 汇总
- 样本数、发言数、行动数、投票数
- fallback/error/validation failure
- blocking/warning issue 分布
- LLM judge 平均分和最低分

## Top Issues
- issue code
- 次数
- 代表样本
- 建议修复方向

## 发言-投票连续性
- 发言目标和投票目标一致率
- 明显转向但无解释样本

## 样本摘录
- 每个问题最多 3 条代表样本
- 截断到可读长度
```

JSON 报告应保留可机器处理字段，便于后续 CI 或趋势对比。

## 第一版阈值

第一版先使用保守阈值，不追求一次把主观质量评到满分。

建议通过条件：

- `blocking` issue 数为 0，或仅允许已知 provider 外部错误。
- fallback/error 比例不高于 10%。
- `jargon_stack` 和 `template_tone` warning 合计不超过发言数的 20%。
- `speech_vote_discontinuity` 不超过投票/行动样本的 15%。
- LLM judge 平均分不低于 3.5，最低分不低于 2。

这些阈值不是产品承诺。第一批跑完后应按实际样本校准。

## 与现有脚本的关系

`audit-ai-experience.mjs` 继续负责大批量 mock 模拟和规则体验审计。

`evaluate-llm-game.mjs` 继续负责真实 LLM 小样本生成。第一版普通评测可以复用它的输出结构，或新增 `--eval-cases-out` 之类的参数，避免重复推进对局逻辑。

新增 `eval-ordinary-ai.mjs` 只做三件事：

1. 收集或生成普通局 eval cases。
2. 调用本地评分和可选 promptfoo。
3. 汇总 Markdown/JSON 报告。

这样可以让评测层薄一些，不把游戏推进逻辑再复制一份。

## 实现边界

可能新增：

- `scripts/eval-ordinary-ai.mjs`
- `scripts/eval-ordinary-ai-utils.mjs`
- `promptfoo.config.yaml`
- `prompts/evals/ordinary-ai-judge.md`
- `docs/evaluations/ordinary-ai-eval-*.md`
- `docs/tasks/2026-06-ordinary-ai-evaluation.md`

可能修改：

- `package.json`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `scripts/evaluate-llm-game.mjs`

默认不修改：

- `src/game/engine.ts`
- `src/components/**`
- `src/app/api/**`
- `.env`
- 生成音频缓存
- 公网部署脚本

## 验证策略

第一版实现应先加本地评分单元测试：

```powershell
npm run test -- src/ai/llmEvaluation.test.ts
```

脚本级验证：

```powershell
npm run eval:ordinary-ai -- --source=mock --games=2 --seed-start=91 --judge=off --json --out=tmp/ordinary-ai-eval-smoke.json
```

如果接入 promptfoo：

```powershell
npx promptfoo eval -c promptfoo.config.yaml
```

真实 LLM 小样本只在明确接受成本时跑：

```powershell
npm run eval:ordinary-ai -- --source=real --max-llm-calls=9 --judge=promptfoo
```

实现完成后至少运行：

- `npm run test -- src/ai/llmEvaluation.test.ts`
- `npm run eval:ordinary-ai -- --source=mock --games=2 --seed-start=91 --judge=off --json --out=tmp/ordinary-ai-eval-smoke.json`
- `npm run lint`
- `npx tsc --noEmit`

## 风险

- promptfoo 的评审模型会有偏见，不能把 LLM judge 当唯一真相。
- 真实 LLM 评测会产生 API 成本，应默认关闭或限制样本数。
- 过多正则 issue 可能把自然发言误判成模板，需要保留代表样本人工复核。
- 如果复制对局推进逻辑，评测脚本会很快和主流程分叉；应复用现有 `evaluate-llm-game.mjs` 能力。
- 当前工作树已有普通局 AI 相关未提交改动，实施前必须重新检查 dirty files，避免覆盖并行修改。

## 成功标准

- 可以用一个本地命令生成普通局 AI 评测报告。
- 报告同时覆盖发言文本、行动/投票目标和发言-投票连续性。
- 本地规则评分能抓出模板、黑话、规则课、无推进、逻辑边界和 fallback。
- 可选 promptfoo 评审能给出主观质量分，但不取代本地硬规则。
- 第一版不增加线上成本，不改变普通玩家体验。

## 推荐实施顺序

1. 抽出普通局 eval case 数据结构和本地评分函数。
2. 新增 `eval-ordinary-ai.mjs`，先支持 `source=mock` 和 `judge=off`。
3. 复用真实 LLM 评估输出，支持少量 `source=real`。
4. 增加 promptfoo config 和 LLM judge prompt。
5. 固定一份代表性报告样本，作为后续普通局 AI 优化的对比基线。

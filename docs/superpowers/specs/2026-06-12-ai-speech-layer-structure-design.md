# AI 发言层结构设计 v0.1

## 目标

这份设计只处理 AI 发言层的工程结构。目标不是继续打磨某一句
prompt，也不是立刻重写 `speechProviders.ts`。目标是先定义稳定边界，
让后续普通局和学级裁判主题的发言质量改动能落在清楚的位置，减少
继续把上下文构造、发言策略、校验、修复、fallback 和评估逻辑堆进
同一个大文件。

第一版范围：

- 普通狼人杀发言为主线。
- 学级裁判主题作为扩展层纳入边界设计，但不在本设计中重写主题实现。
- 只做结构设计，不迁移源码。
- 不抢并行窗口正在推进的人设、座位私有临场动机、同轴压力预算、
  仪式化承接散化等实现；只定义这些能力应该接入的模块位置。

## 当前事实基线

当前结构审计显示，AI 发言层已经成为主要维护压力点：

- `src/ai/speechProviders.test.ts`: 12724 行。
- `src/ai/speechProviders.ts`: 8942 行。
- `src/ai/tableRead.ts`: 3483 行。
- `src/ai/actionProviders.ts`: 2180 行。
- `src/ai/llmEvaluation.ts`: 1744 行。

这些行数不是自动拆分顺序，但它们说明一个事实：最近的发言质量迭代
已经让“发言生成”同时承担了太多职责。继续按问题追加正则、prompt
片段、fallback 分支和样本指标，会让后续维护成本继续上升。

## 设计判断

发言质量和工程结构不能分开设计。

如果只做文件拆分，容易把同一套混杂职责搬到多个文件里；如果只做
质量优化，又会继续扩大 `speechProviders.ts`。因此第一阶段应该用
质量目标反推模块边界：

- “像不像玩家”属于 speaker profile 和 speaker state 输入层。
- “这一轮为什么说这句话”属于 speech move selection 层。
- “怎么把动作说成人话”属于 prompt/render 层。
- “有没有越界、模板化或读不懂”属于 validation/repair 层。
- “失败后怎么兜底”属于 fallback 层。
- “样本读起来是不是同桌同声”属于 evaluation/report 层。

## 非目标

- 不修改 `src/game/engine.ts`、胜负结算、合法动作生成或规则裁判。
- 不修改 `.env`、密钥、数据库文件、生成音频缓存或生产部署脚本。
- 不把学级裁判主题的戏剧化角色表达强行迁移到普通局。
- 不为风格问题扩大硬 fallback。
- 不继续靠扩禁词解决所有主观质量问题。
- 不要求 v0.1 直接列出要搬的具体函数和行号；这一步应等并行实现
  稳定后再做。

## 目标分层

建议把 AI 发言层拆成七个逻辑层。第一版可以先以文件/模块边界表达，
不要求一次迁移到目录化架构。

```text
AI speech layer
  1. Speech context input
  2. Speaker profile and private speech state
  3. Speech move selection and shared pressure budget
  4. Prompt and render guidance
  5. Provider call and response normalization
  6. Validation, repair, and fallback
  7. Evaluation and sample reporting
```

### 1. Speech Context Input

职责：

- 从 `AgentView`、公开桌面、座位记忆、公开发言、投票和阶段信息中提取
  发言输入。
- 严格区分公开事实、座位可见私密信息、推断、历史承诺和评估用元数据。
- 给普通局和主题局提供同一类基础输入结构。

不应该承担：

- 不决定最终发言动作。
- 不写 prompt 文案。
- 不做 fallback 文案。
- 不把评估字段混入玩家可见发言。

目标接口可以是概念上的：

```ts
type SpeechContextInput = {
  gameMode: "ordinary" | "class-trial";
  seat: SpeechSeatIdentity;
  phase: SpeechPhaseContext;
  publicTable: PublicSpeechTableContext;
  privateAllowedFacts: PrivateAllowedSpeechFacts;
  priorSpeech: PriorSpeechContext;
  voteContext: VoteSpeechContext;
};
```

### 2. Speaker Profile And Private Speech State

职责：

- 表达“这个座位是谁”：玩家类型、说话长度、情绪幅度、追问倾向、
  口头习惯、保守/激进倾向。
- 表达“这个座位记得什么”：上一轮压过谁、承诺过什么、被谁打过、
  自己是否需要防御、是否正在改口。
- 保持普通局玩家感，不把普通局变成主题角色表演。
- 允许主题局在同一边界上扩展角色风格和舞台表达。

并行窗口正在推进的人设层和座位私有临场动机，应落在这一层。
本设计不规定它们的具体字段名，但要求后续字段满足：

- 可以被普通局和主题局分别解释。
- 不泄露规则上不该知道的信息。
- 能在 prompt 和 fallback 中以玩家口吻使用。
- 能被测试构造，不依赖真实 LLM 才能验证。

目标接口可以是：

```ts
type SpeakerStateInput = {
  profile: SpeakerProfile;
  selfHistory: SpeakerSelfHistory;
  currentMotive: SpeakerCurrentMotive;
  styleConstraints: SpeakerStyleConstraints;
};
```

### 3. Speech Move Selection And Shared Pressure Budget

职责：

- 决定当前座位这轮发言应采用什么“发言动作”：
  暂保、怀疑、追问、反驳、改口、防御、跟进票型、回应身份、低信息过水等。
- 管理全桌层面的重复压力预算，避免多个后置位继续追同一个空问题。
- 把“可以不承接上一位”“可以直接换目标”“可以替被打者说话”等动作
  作为候选，而不是只靠 prompt 叫模型自然发散。

并行窗口的“同轴压力预算提前触发”和“仪式化承接开场散化”，应落在
这一层和下一层之间：

- 预算触发属于 move selection。
- 开场表达属于 prompt/render guidance。

这一层不应该直接写完整发言文本。它输出的是发言意图和约束。

目标接口可以是：

```ts
type SpeechMovePlan = {
  move: SpeechMoveKind;
  focusSeatIds: number[];
  avoidAxes: string[];
  requiredLanding?: "question" | "vote-boundary" | "hold" | "defense" | "pass";
  openingMode: "direct" | "soft-bridge" | "challenge" | "ignore-previous";
};
```

### 4. Prompt And Render Guidance

职责：

- 把 `SpeechContextInput`、`SpeakerStateInput` 和 `SpeechMovePlan` 渲染成
  provider 输入。
- 普通局渲染成真实狼人杀玩家的说话约束。
- 学级裁判主题渲染成主题角色/庭审风格约束。
- 管理开场方式、长度、口语度、疑问句、语气词、术语保留和禁用内部黑话。

这一层应该有普通局和主题局的分流：

```text
prompt/render
  ordinarySpeechPrompt.ts
  classTrialSpeechPrompt.ts
  sharedSpeechPromptParts.ts
```

普通局 renderer 的核心目标：

- 第一人称。
- 只说当前座位能知道、能推断、能公开表达的内容。
- 不把每段发言都写成分析报告。
- 不把“承接上一位”固定成礼仪开头。
- 允许短发言、迟疑、反问、情绪、保留判断。

主题局 renderer 的核心目标：

- 复用公共事实边界和发言动作计划。
- 额外加入角色语言、舞台表达和主题术语。
- 不污染普通局 prompt。

### 5. Provider Call And Response Normalization

职责：

- 负责调用具体 LLM provider。
- 标准化响应文本、provider 名称、retry 次数、错误类型、fallback 标记。
- 不理解狼人杀策略，不做复杂质量判断。

这一层应该保持薄。它只回答：

- 调用了哪个 provider。
- 拿到了什么文本。
- 是成功、retry 成功、provider error，还是进入 fallback。

### 6. Validation, Repair, And Fallback

职责：

- 校验硬边界：隐藏信息泄露、错误身份归因、公开事实错误、非法角色声明、
  明显截断、读不懂。
- 对软质量问题给 repair 指导：模板化、同轴复读、开场礼仪化、口语不足、
  长度过度一致。
- 只有硬边界或修复失败时进入 fallback。
- fallback 也读取 speaker profile、speaker state 和 speech move plan，
  不能退化成同一段安全模板。

建议分层：

```text
validation
  hardSpeechBoundary.ts
  ordinarySpeechQuality.ts
  classTrialSpeechQuality.ts
repair
  speechRepairPrompt.ts
fallback
  ordinarySpeechFallback.ts
  classTrialSpeechFallback.ts
```

原则：

- 硬规则保护准确性。
- 软质量优先 repair 和报告，不默认硬 fallback。
- fallback 必须短、自然、座位化。
- 不用继续无限扩禁词表作为主修复手段。

### 7. Evaluation And Sample Reporting

职责：

- 衡量样本层问题，而不把所有主观问题塞进 runtime validator。
- 继续保留本地可解释指标：fallback、provider error、硬边界错误、重复压力、
  发言-投票连续性。
- 增加 report-only 的抽样式 LLM 评审接口，用于发现“意思重复但措辞不同”
  和“全桌同声”这类正则难抓的问题。

评估层不应该直接决定线上发言是否 fallback。它服务于迭代判断和报告。

建议后续评估报告区分：

- runtime blocking issue。
- runtime repair issue。
- sample-level warning。
- LLM judge report-only note。

## 普通局与主题局的关系

普通局是主线，主题局是扩展层。二者共享：

- context input 的事实边界。
- speaker state 的基础结构。
- speech move plan 的动作意图。
- provider call 的响应记录。
- evaluation 的通用元数据。

二者分开：

- prompt/render 文案。
- 主题术语与角色表达。
- 软质量校验。
- fallback 文案。
- 样本报告里的主观评价维度。

这样做的目的不是减少主题局能力，而是避免普通局和主题局继续在
`speechProviders.ts` 中互相污染。

## 建议目录边界

第一版可以先使用 `src/ai/speech/` 作为新边界，逐步迁移：

```text
src/ai/speech/
  context.ts
  speakerState.ts
  speechMoves.ts
  providerResult.ts
  ordinaryPrompt.ts
  classTrialPrompt.ts
  validation.ts
  repair.ts
  fallback.ts
  evaluationAdapters.ts
```

如果一次新增目录风险过高，也可以先在 `src/ai/` 下按文件拆出：

```text
ordinarySpeechPrompt.ts
classTrialSpeechPrompt.ts
speechMovePlanner.ts
speechValidation.ts
speechFallbacks.ts
speechProviderTypes.ts
```

关键不是目录名，而是依赖方向：

```text
context/state -> move plan -> prompt/render -> provider -> validation/repair/fallback -> eval record
```

不要让低层反向依赖 UI、API route、数据库、真实 provider key 或测试报告。

## 迁移策略

### Phase 0: 等并行实现稳定

当前另一个窗口正在改发言层核心文件。v0.1 设计阶段不做源码迁移。
等并行改动完成后，先读实际 diff，再刷新“现状拆解”和第一批迁移任务。

### Phase 1: 类型和纯模型边界

优先抽出不调用 provider、不读写状态、可单测的类型和纯函数：

- speech context 输入类型。
- speaker state 输入类型。
- speech move plan 类型。
- provider result 类型。

验收重点是 TypeScript 和既有测试不变。

### Phase 2: Prompt/Render 分流

把普通局 prompt 和学级裁判 prompt 的渲染入口拆开。先保持输出语义一致，
不要在同一批里改质量策略。

验收重点：

- 普通局和主题局既有 focused tests。
- `npx tsc --noEmit`。
- 不增加 fallback。

### Phase 3: Validation/Repair/Fallback 分层

把硬边界、软质量、repair、fallback 分成不同模块。先移动现有逻辑，再
决定哪些软质量问题只进 report。

验收重点：

- speech provider focused tests。
- ordinary eval existing-case replay。
- no secret write。

### Phase 4: Evaluation 补盲

把 sample-level report 和 runtime validator 分开。增加抽样式 LLM judge
作为 report-only，不接入线上 fallback。

验收重点：

- 本地 eval command 输出稳定。
- 报告清楚标注 report-only。
- 真实 provider 调用必须显式、限量、临时 env。

## 第一批任务建议

等并行窗口完成后，再开一个任务卡做“AI 发言层现状拆解”。该任务卡只读
或最多 docs-only，输出：

- `speechProviders.ts` 中每段职责归属。
- 哪些代码适合 Phase 1 直接抽类型/纯模型。
- 哪些代码必须等测试补齐。
- 哪些代码属于普通局，哪些属于学级裁判主题。
- 哪些代码是 runtime validator，哪些只是评估逻辑。

不要直接从最大文件中搬 provider 调用或 fallback 主路径作为第一批实现。

## 验证策略

本设计本身是 docs-only，验证重点是可读性和边界一致性。

后续源码迁移按阶段选择：

- 结构审计：`npm run audit:structure`
- 类型/纯模型迁移：`npx tsc --noEmit`
- 发言层迁移：`npm run test -- src/ai/speechProviders.test.ts`
- 普通局质量回放：`npm run eval:ordinary-ai -- --source=existing ...`
- 主题局相关迁移：运行 class-trial speech/director focused tests
- 发布前：`npm run lint`、`npm run build`，必要时本地 smoke

如果涉及真实 LLM：

- 必须使用临时 process env。
- 不写 `.env`。
- 不把 key、完整 raw error 或本地缓存音频提交。
- 样本数必须有上限。

## 成功标准

- 新的发言质量改动能明确归属到 context、state、move、prompt、provider、
  validation、fallback 或 evaluation 中的一层。
- 普通局和学级裁判主题不再通过同一组 prompt/fallback 分支互相污染。
- A-D 这类质量能力有明确接入点，但不要求本设计实现它们。
- 后续拆分任务可以做到小批量、可测试、可回滚。
- 评估盲区不再通过扩大 runtime 正则和硬 fallback 解决，而是进入
  sample-level report 或 LLM judge report-only。

## 待后续刷新

并行窗口完成后，需要补一份现状拆解或更新本设计：

- 读取最新 `speechProviders.ts`、`speechProviders.test.ts` 和相关任务卡。
- 标记 A-D 已经实际落在哪些函数/模块。
- 对照本设计调整模块命名。
- 产出第一批迁移任务卡，而不是直接做大拆分。

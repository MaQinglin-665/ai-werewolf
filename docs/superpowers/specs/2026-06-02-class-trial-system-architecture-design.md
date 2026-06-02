# 学级裁判系统架构整理设计

## 背景

当前分支已经累积了一条很长的学级裁判工作线：本地主题资产、开场片头、夜幕阶段、AI 发言导演、DeepSeek 主脑、GPT-SoVITS、投票封票展示和终局复盘都已经接入。用户现在指出的核心问题是：

- AI 逻辑像模板。
- 规则阶段混乱。
- 投票不好看。

这三个问题不是单个 UI 小改能稳定解决的。根因是多层语义混在一起：

- `src/components/GameClient.tsx` 同时承担本地主题资产、开场状态、阶段幕布、主持音频、AI 语音、后台推进和普通对局编排。
- `src/ai/speechProviders.ts` 同时承担通用狼人杀发言、学级裁判角色导演、验证规则、修复提示和 fallback。
- `src/game/projection.ts` 给前端暴露规则视图，但投票和阶段展示语义还不够集中，房间端和单机端容易各自推断。
- `src/components/game/ClassTrialGameTable.tsx` 和投票组件已经有表现力，但 UI 仍在从规则 phase 和 vote snapshot 里现场推断展示状态。

## 目标

用一个统一架构目标完成本轮整理：

1. 降低 `GameClient` 的学级裁判编排复杂度。
2. 把学级裁判 AI 发言的导演、验证、fallback 从通用 `speechProviders` 主文件中拆出来。
3. 把全局规则阶段语义和投票公开语义做成可复用模型，供单机和房间共享。
4. 改善学级裁判投票体验：封票阶段只公开进度，揭示阶段一次性公开票型和逐票账本，UI 不再靠散落 phase 判断。
5. 允许修正能被测试证明的全局规则/阶段/投票问题，但不做无测试的大幅玩法重写。
6. 最终完成验证、提交并推送 GitHub；本轮不要求腾讯云或 Render 部署。

## 非目标

- 不提交 `.env`、密钥、数据库、`.next`、`node_modules`、`tmp`、本地生成音频或私有素材包。
- 不重写整个狼人杀规则引擎。
- 不把学级裁判本地主题暴露到 `/rooms` 入口。
- 不把角色台词写成固定剧本库；仍由公开信息、规则状态和角色 lens 驱动。

## 推荐架构

### 1. 规则语义层

新增或整理规则侧纯模型：

- `src/game/phaseSemantics.ts`
  - 统一判断夜晚阶段、公开行动阶段、投票揭示延续阶段。
  - 供 `projection.ts`、`roomService.ts`、前端展示模型复用。
- `src/game/voteSnapshot.ts`
  - 从 `projection.ts` 提取公开投票快照构建。
  - 在 `DAY_VOTE` 隐藏目标和理由，只给 `eligibleSeatIds`、`lockedSeatIds`、`pendingSeatIds`。
  - 在揭示后给 `votes`、`tally`、`leaders`、`abstainCount`。

### 2. 前端阶段/投票呈现层

新增前端纯模型：

- `src/components/game/classTrialFlowModel.ts`
  - 计算片头、开场夜幕、普通阶段幕布、音频/自动推进是否应该暂停。
  - `GameClient` 只使用返回的布尔状态和 cue，不再散落判断。
- `src/components/game/classTrialVotePresentation.ts`
  - 从 `HumanGameView` 生成学级裁判投票 UI state。
  - `ClassTrialVoteStage` 和 `ClassTrialGameTable` 共享同一模型，不重复推断 locked/pending/focus。
- `src/components/game/classTrialTableModel.ts`
  - 聚合桌面状态：夜晚 dim、投票 active、发言焦点、主持音频标签等。
  - `ClassTrialGameTable` 保持展示组件职责。

### 3. AI 发言导演层

新增或拆分 AI 发言模块：

- `src/ai/classTrialSpeechDirector.ts`
  - 负责学级裁判角色 lens 的 prompt 片段、低信息开局导演、重复焦点导演、终位发言约束。
- `src/ai/classTrialSpeechValidation.ts`
  - 负责学级裁判模板化、术语过载、prompt 泄漏、角色质感、身份归因边界等验证。
- `src/ai/classTrialSpeechFallback.ts`
  - 负责角色化 fallback，保证 DeepSeek 输出失败时不会退化为普通狼人杀模板。

`speechProviders.ts` 保持通用发言编排入口，只调用这些模块。

### 4. 房间影响面

公网房间仍使用同一规则引擎和 projection。全局规则语义变更必须由以下证据保护：

- focused rule/projection tests。
- room action smoke，至少覆盖 vote path。
- 若只改单机学级裁判 UI，不声明为房间验证证据。

## 体验原则

- AI 发言应该从“公开信息 + 当前角色推进动作”生成，不再依赖空泛流程词。
- 阶段展示应该说明“规则现在是什么”和“玩家为什么暂时不能操作”，尤其夜晚隐藏行动、开场夜幕和投票揭示。
- 投票过程应有两个清晰状态：
  - 封票中：只显示谁已锁票，隐藏目标。
  - 开票揭示：一次性公开 tally、逐票、焦点席位或无人放逐。

## 验证要求

最小有效验证需要覆盖：

- `npm run test -- src/game/engine.test.ts src/game/projection.test.ts`
- `npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/phaseCurtainModel.test.ts`
- `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- 本地浏览器学级裁判路径 smoke。
- `npm run smoke:main-game`。
- `npm run smoke:room-action:vote`，如果规则/projection 变化影响房间。

## 完成标准

- 新模型有 focused tests。
- `GameClient.tsx`、`ClassTrialGameTable.tsx`、`speechProviders.ts` 的学级裁判分支明显减少现场推断。
- 投票公开边界由规则/projection 测试保护。
- 学级裁判 AI 发言模板感相关验证和 fallback 仍通过。
- 相关文档、`feature_list.json`、`progress.md`、`session-handoff.md` 更新。
- 提交并推送到 GitHub 分支。

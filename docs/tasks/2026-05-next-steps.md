# 2026-05 下一步任务

## 背景

项目已经进入复杂 MVP 阶段。当前最主要的问题不是缺功能，而是复杂度集中在少数大文件里，后续继续开发会越来越慢。

## 目标

近期目标是先降低维护成本，再继续扩展玩法和 AI 质量。

## 任务 1：拆分前端 GameClient

负责线程：`frontend`

目标：

- 从 `src/components/GameClient.tsx` 中抽出纯展示组件。
- 优先抽座位、操作面板、发言/事件列表、音频控制。
- 不改变现有交互行为。

验收：

- `npm run lint`
- `npm run test`
- 手动跑一局。

## 任务 2：补规则回归测试

负责线程：`rules-engine`

目标：

- 给夜晚结算、投票、猎人、警长、女巫补关键测试。
- 优先覆盖容易被 AI 自动推进触发的阶段。

验收：

- `npm run test -- src/game/engine.test.ts`
- `npm run test`

## 任务 3：检查 AI 决策质量

负责线程：`ai-behavior`

目标：

- 运行模拟脚本，记录异常决策、fallback、胜率异常。
- 优化桌面读法和座位记忆。
- 不改规则引擎。

验收：

- `npm run simulate:ai`
- `npm run llm:check`
- `npm run test`

## 任务 4：文档和编码清理

负责线程：`docs`

目标：

- 检查 README 和源码中文是否为编码显示问题。
- 若文件实际损坏，逐步修复。
- 确认 `.env.example` 与代码读取的环境变量一致。

验收：

- README 在编辑器和终端中都能正常阅读。
- 不泄露 `.env` 中的真实密钥。

## 完成记录：2026-05-14

- 前端：`GameClient` 已拆出 `src/components/game/clientTypes.ts`、`src/components/game/viewHelpers.ts`、`src/components/game/GamePanels.tsx`，主文件保留对局状态、音频编排和主布局。
- 规则：补充旧状态 hydration 默认值、同夜狼刀+女巫毒药清晨结算回归测试。
- AI：`simulate:ai` 1000 局可稳定终局且 0 fallback；胜率仍偏狼人侧，当前记录为好人 19.1%、狼人 80.9%。已降低狼队投票计划的机械同步性，后续仍需继续调平衡。
- LLM：`llm:check -- --retries=0` 完整运行，16 项中 9 OK、7 FAIL；失败集中在部分 speech fetch failed、Gemini 上游 JWT 502、Mimo/Kimi 输出格式不合规。
- 文档：README 已更新到 9/12 人板子现状；`.env.example` 已补齐代码读取的可选变量；README/docs/src UTF-8 扫描未发现乱码特征。

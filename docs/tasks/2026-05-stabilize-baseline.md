# 2026-05 稳定基线与下一批任务

## 背景

第一批协作线程已经完成前端拆分、规则测试补充、AI 模拟检查和文档清理。现在需要先冻结一个清晰基线，再继续开新线程。

## 当前确认结果

- `npm run lint` 通过。
- `npm run test` 通过，4 个测试文件，99 条测试。
- `npm run build` 通过，仍有一个 Turbopack NFT trace warning，非失败。
- `npm run simulate:ai` 通过，1000/1000 终局，0 fallback。
- `npm run llm:check -- --retries=0` 完整运行，16 项中 9 OK、7 FAIL。
- `npx tsc --noEmit` 通过。
- `npm run test -- src/game/engine.test.ts` 通过，84 个规则测试。
- Gemini 单项 LLM 检查已能通过 fallback 到可用模型。
- 12 人警长局已在浏览器手测首夜、上警、警长投票、Gemini 发言、真人发言和放逐锁票路径。

## 已知风险

- AI 胜率明显偏狼人侧：好人 19.1%，狼人 80.9%。
- LLM 检查仍有 7 项失败，集中在上游请求失败和部分模型输出格式不合规。
- `src/components/game/GamePanels.tsx` 仍然较大，前端拆分已经有效，但还不是终点。
- 工作区历史改动很多，提交前需要仔细分组，避免把日志、缓存或无关产物一起提交。
- 真实 LLM 出票链路仍可能很慢，浏览器手测没有完整等到所有 AI 真实 LLM 出票结束。

## 下一步 1：冻结基线

负责线程：`main`

目标：

- 复查 `git status`。
- 确认日志文件、缓存音频和本地数据库不会被提交。
- 按主题分组准备提交。

建议分组：

- 协作文档。
- 前端拆分。
- 规则和测试。
- AI/LLM 行为。
- 音频和资源。
- README 与环境变量。

验收：

- `git status --short` 中没有意外日志文件。
- 每组提交说明能讲清楚用户可感知变化。

## 下一步 2：前端第二轮拆分

负责线程：`frontend`

目标：

- 继续拆 `src/components/game/GamePanels.tsx`。
- 优先拆成桌面、操作面板、复盘、音频状态和入口面板。
- 不改变现有交互。

验收：

- `npm run lint`
- `npm run test`
- 手动跑 9 人和 12 人各一局冒烟。

## 下一步 3：AI 平衡调参

负责线程：`ai-behavior`

目标：

- 降低狼人胜率偏高问题。
- 记录每次调整前后的 1000 局模拟结果。
- 优先检查狼队投票同步、好人推理权重、预言家信息利用和女巫/猎人策略。

验收：

- `npm run simulate:ai`
- 记录好人/狼人胜率、fallback、异常终局。

## 下一步 4：LLM 输出契约修复

负责线程：`ai-speech`

目标：

- 梳理 `llm:check` 失败项。
- 将上游网络失败和本地格式不合规分开记录。
- 优先修复 Mimo action JSON、Kimi speech 格式不合规这类本地可控问题。

验收：

- `npm run llm:check -- --retries=0`
- 本地可控失败项减少。

## 最后一批线程完成记录：2026-05-14

- 前端：`GameClient.tsx` 继续保持主控容器定位，UI 面板拆到 `src/components/game/GamePanels.tsx`，共享类型和工具拆到 `clientTypes.ts`、`viewHelpers.ts`。
- 规则：补充 12 人守卫/警长路径相关回归测试。
- AI：调整 mock AI 的女巫毒药、猎人开枪策略，减少乱毒和乱枪。
- LLM：`modelLlms.ts` 增加 Gemini fallback，默认从 `gemini-3-flash` 失败时尝试 `gemini-3.1-pro`、`gemini-3.1-pro-preview`。
- 环境：`.env.example` 补充 LLM、Gemini fallback、Kimi temperature、语音/STT/TTS 和模拟相关配置。
- 遗留：`simulate:ai` 胜率仍偏狼人侧，需要后续作为 AI 平衡专项继续跟进。

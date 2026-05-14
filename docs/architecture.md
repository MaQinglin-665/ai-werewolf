# 架构说明

## 当前项目形态

`ai-werewolf` 是一个本地可玩的 AI 狼人杀应用，主要技术栈是：

- Next.js App Router
- React
- Prisma + SQLite
- Vitest
- 本地 mock AI 与可选 LLM provider
- 本地主持音频与按需 AI 语音

## 核心分层

### `src/game`

规则引擎层。它应该是游戏合法性的唯一裁判。

职责：

- 创建和恢复游戏状态
- 阶段流转
- 合法动作校验
- 夜晚、白天、投票、猎人、警长、胜负结算
- 生成可复盘事件

原则：

- AI 输出不能直接改变规则。
- UI 不能绕过规则引擎修改状态。
- 所有关键规则都应该有测试覆盖。

### `src/ai`

AI 决策与表达层。

职责：

- 构造 AI 可见信息
- 生成发言
- 选择行动
- 维护座位记忆、桌面读法和阵营策略
- 处理 LLM 输出修复和 fallback

原则：

- AI 只能在规则引擎提供的候选动作中选择。
- AI 可以有风格和策略，但不能成为规则裁判。
- LLM 输出必须经过 schema 校验和 fallback。

### `src/server`

服务层。

职责：

- 连接 API、Prisma 和规则/AI 模块
- 保存游戏快照、座位、事件和 AI 调用记录
- 聚合服务端视图

原则：

- 不在 API route 中堆业务逻辑。
- 持久化格式变化需要考虑旧状态 hydrate。

### `src/app/api`

HTTP API 层。

职责：

- 创建游戏
- 查询游戏视图
- 提交真人动作
- 继续 AI 流程
- 语音输入整理
- AI 语音流式推进

原则：

- API route 尽量薄。
- 输入输出必须清晰、可测试。

### `src/components`

前端体验层。

职责：

- 游戏桌面
- 座位信息
- 操作面板
- 发言、复盘、音频、语音输入
- 本地最近对局

当前风险：

- `GameClient.tsx` 已经很大，应该逐步拆成 hooks 和子组件。

## 推荐拆分方向

### 前端

```text
src/components/game/
  GameClient.tsx
  GameTable.tsx
  SeatToken.tsx
  ActionPanel.tsx
  SpeechPanel.tsx
  ReviewPanel.tsx
  AudioControls.tsx
  RecentGames.tsx
  hooks/
    useGameSession.ts
    useHostAudio.ts
    useAiSpeechAudio.ts
    useVoiceInput.ts
```

### 规则引擎

```text
src/game/engine/
  index.ts
  createGame.ts
  command.ts
  night.ts
  day.ts
  sheriff.ts
  hunter.ts
  win.ts
  events.ts
```

拆分时保持外部 import 稳定，优先让测试通过，再移动内部实现。

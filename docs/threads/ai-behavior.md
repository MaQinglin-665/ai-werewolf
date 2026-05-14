# AI Behavior 线程

## 责任范围

可以修改：

- `src/ai/actionProviders.ts`
- `src/ai/mockAgent.ts`
- `src/ai/tableRead.ts`
- `src/ai/seatMemory.ts`
- `src/ai/types.ts`
- `src/game/tableMemory.ts`
- `src/game/stances.ts`
- `src/game/claims.ts`
- AI 行为相关测试和模拟脚本

默认不要修改：

- `src/components/**`
- `src/game/engine.ts`
- `src/server/**`
- `src/app/api/**`

## 当前重点

- 提升 AI 的发言连贯性和行动合理性。
- 让 AI 更好利用公开信息、发言立场和历史行为。
- 控制无效输出和 fallback。
- 避免 AI 获得不该知道的信息。

## 原则

- AI 只能选择合法候选动作。
- 私密信息只给应该知道的座位。
- 狼人可以撒谎，好人不能被提示词诱导泄露隐藏信息。
- 任何策略优化都不应修改规则裁判。

## 验收

- `npm run llm:check`
- `npm run simulate:ai`
- `npm run test`
- 汇报模拟结果中的明显变化。

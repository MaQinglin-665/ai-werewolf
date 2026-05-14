# Rules Engine 线程

## 责任范围

可以修改：

- `src/game/**`
- `src/game/*.test.ts`

必要时只读：

- `src/ai/**`
- `src/server/gameService.ts`
- `src/app/api/games/**`

默认不要修改：

- `src/components/**`
- `src/ai/**`
- `prisma/**`

## 当前重点

- 让规则引擎保持唯一裁判地位。
- 增加关键阶段回归测试。
- 逐步拆分 `engine.ts`。
- 保持 `hydrateGameState` 对旧状态兼容。

## 高风险区域

- 夜晚死亡结算
- 女巫救药/毒药
- 猎人开枪
- 警长竞选与移交
- 投票平票和放逐
- 屠边胜负判断

## 验收

- `npm run test -- src/game/engine.test.ts`
- `npm run test`
- 若修改规则流转，需要补充至少一个失败前会暴露问题的测试。

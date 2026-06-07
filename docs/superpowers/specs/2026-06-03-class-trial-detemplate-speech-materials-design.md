# 学级裁判发言去模板材料设计

## 背景

最新 D1 样本 `tmp/class-trial-d1-all-speeches-score-1780498805293.md` 里，发言的主要问题不是缺少狼人杀规则，而是内部审计材料被直接说出口：

- `身份动作和公开边界的连接`、`没有闭合`、`裂口`、`缺口`
- `起跳收益`、`票口边界`、`外置硬身份反证`
- 后置位把前面所有人总结一遍，而不是做自己的角色动作
- fallback 比真实 LLM 更像规则说明，尤其是苗木、雾切、腐川、爱音

本轮目标是只处理学级裁判主题局，让角色像自己在玩狼人杀。允许逻辑短一点，但出口必须更像角色临场发言，不能像系统把规则提示读出来。

## 范围

修改范围限定在 AI speech / AI behavior 文本材料链路：

- `src/ai/tableRead.ts`
- `src/ai/speechProviders.ts`
- `src/ai/classTrialSpeechDirector.ts`
- `src/ai/classTrialCharacterLens.ts`
- 对应测试
- 当前任务卡、`progress.md`、`session-handoff.md`

不修改普通狼人杀局，不修改 UI、规则裁判、房间、音频、模型配置或 `.env`。

## 设计原则

1. 先改输入材料，不先堆硬校验。
2. LLM 可以继续扮演角色，但不能收到一堆只能当内部提示的术语后再被期待说人话。
3. fallback 是最终用户会看到的发言，必须按角色给最小可用对白，不能是规则兜底句。
4. repair 只修掉越界点，保留原目标，并把抽象审计词改成具体角色压力。
5. 校验只挡已确认的刺眼模板词，避免让 fallback 继续上升。

## 生成链路调整

### Table-read 材料

把给 LLM 的 `talkingPoints` 和 `tableTask.line` 从审计语改成可说出口的动作语。

示例映射：

- `票口边界` -> `今天先别把查杀位轻放过去`
- `外置硬身份反证` -> `除非有人拿出更硬的身份信息`
- `身份动作和公开边界没有闭合` -> `这条查杀要怎么被桌面验证`
- `起跳收益` -> `跳出来把某人按死后，谁最轻松`
- `过程不足/缺口没合上` -> `这句话还没把自己从票下拉出来`

这些映射不是固定台词库，而是把内部材料换成角色能自然改写的语义。

### Speech contract

学级裁判 contract 继续保留身份、查杀、回应查杀、投票方向等硬要求，但避免把 `边界`、`收益`、`闭合` 这类词放进 `mustSay`。

强信息例子：

- 苗木真预言家查杀：必须说自己是预言家、3号腐川是查杀、今天不能轻放查杀位。
- 不再要求苗木解释第一晚为什么验腐川。
- 腐川被查杀回应：必须回应查杀本身，可以不认、反打、转压苗木，但不要用 `起跳收益/票口边界` 这类审计词。

### Fallback

fallback 改为角色最小对白：

- 苗木：`我知道这句话会把腐川推到台上，但我不能把查杀藏起来。今天先从她这里开始，除非有人拿出更硬的身份信息。`
- 雾切：`苗木已经把身份和查杀放出来了。我先不问首夜理由，只看这条查杀接下来怎么被桌面验证。`
- 腐川：`我不认。苗木一句话就想把我按死，别让他这么轻松；他跳出来以后，今天最省力的人是谁。`
- 爱音：`等一下，大家跑太快了。现在不是把话说得漂亮就行，我先看谁在顺手把腐川往台下推。`

具体实现可以按现有 fallback helper 保持短句，但禁止再输出内部审计词。

### Repair

repair prompt 从“补闭合/补边界”改成：

- 保留原目标和阵营动作。
- 删除内部审计词。
- 换成当前角色能说出口的一句具体压力、保留或验证条件。
- 不要把修复结果改成通用 fallback。

### 轻校验

仅在学级裁判主题局拦截最终发言中的高风险模板片段：

- `身份动作和公开边界`
- `公开边界的连接`
- `没有闭合`
- `起跳收益`
- `票口边界`
- `外置硬身份反证`

校验错误应指向“学级裁判内部术语泄漏”，便于 repair 走角色化改写，而不是直接让 fallback 接管。

## 验收

重新跑最新 D1 样本脚本：

```powershell
node tmp/class-trial-d1-all-speeches-score.mjs
```

通过标准：

- 最终发言不再出现上述内部审计词。
- fallback 数量不高于最新样本的 4/9，目标是下降。
- 苗木、雾切、腐川、爱音的 fallback 不再像规则说明。
- 江之岛不再攻击首验理由。
- 普通狼人杀局相关测试不应因为学级裁判去模板变化改变。

自动验证：

```powershell
npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/classTrialCharacterLens.test.ts
npx tsc --noEmit
npm run lint
npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md
npm run harness:check
git diff --check
```

## 风险

- 如果只加禁止词，fallback 会继续增加；所以实现顺序必须先改材料和 fallback，再加轻校验。
- 如果把角色化 fallback 写得太像固定台词库，会从规则模板变成角色模板；fallback 只能作为失败兜底，真实 LLM 仍应自由发挥。
- 去掉术语后，部分发言会显得不那么像高玩狼人杀，但这符合本轮目标：角色感和自然发言优先。

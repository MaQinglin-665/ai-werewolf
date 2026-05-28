# 学级裁判主题局 UI 打磨与高松灯替换设计

## 背景

`学级裁判主题局` 已经具备本地主题入口、9 人环形席位、固定角色卡、AI 观战开局和本地 ignored 素材包。下一步先不接 GPT-SoVITS，因为语音模型还在训练；本轮目标是把录视频时最直观看到的发言体验打磨出来，并把第 8 座从叶隐康比吕替换为高松灯。

本功能仍然只服务本地主题局，不进入 `/rooms`，不进入 Public Alpha，不改变狼人杀规则和 AI 合法行动边界。

## 目标

- 第 8 座固定角色从 `叶隐康比吕` 替换为 `高松灯`，座位顺序保持不变：`十神白夜 -> 高松灯 -> 千早爱音`。
- 本地角色 id 从 `hagakure` 迁移为 `tomori`，避免后续头像、立绘、语音 profile 和角色卡继续沿用旧角色语义。
- 使用确认过的高松灯透明 PNG 作为本地 ignored 素材，半身立绘和头像均从该图派生。
- 发言区改为左侧半身立绘、右侧大对白框，弱化/虚化背景环形席位。
- 对白框不显示身份，只显示角色名和发言内容。
- 新发言开始前显示短暂“正在思考/准备发言”的状态。
- 文本显示使用混合打字机：短句逐字，长发言按句或分段显示。
- 动画不可用或用户偏好减少动画时，自动退回纯文字发言。

## 非目标

- 不实现 GPT-SoVITS 多角色语音路由。
- 不实现中文对白到日语语音稿的 rewrite。
- 不实现语音时长驱动的逐字同步。
- 不改 `/rooms`、公网 Alpha、房间同步、规则引擎胜负逻辑或夜晚行动流程。
- 不提交任何版权素材、头像、立绘或本地生成派生图。

## 角色与素材设计

`CLASS_TRIAL_CHARACTER_IDS` 和 `CLASS_TRIAL_CHARACTER_ROSTER` 中第 8 位改为：

- id: `tomori`
- displayName: `高松灯`
- seatId: `8`

`local-assets/class-trial-pack/personas.json` 中对应角色卡也改为 `tomori`。角色卡方向：

- 性格：内向、敏感、认真、像把语言当作证据一样谨慎。
- 发言风格：短句多，先犹豫再给出清晰观察；不强行热血，不靠设定替代狼人杀证据。
- 推理偏好：关注发言中的情绪停顿、前后不一致、被孤立的人和突然转移焦点的人。
- 被怀疑反应：先紧张停顿，再回到公开信息解释。
- 阵营边界：无论好人还是狼人，都只能基于公开桌面发言、票型和行动结果表达。

素材只放入 `local-assets/class-trial-pack`：

- `avatars/高松灯.png`
- `portraits/高松灯.png`
- 可选备份目录中的原始透明图或裁切源图

这些文件必须保持 ignored，不出现在 Git 提交中。

## 发言 UI 设计

采用用户确认的 A 方案：

- 左侧为当前发言者半身立绘。
- 右侧为大对白框。
- 背景保留环形裁判席，但降低对比度、增加弱虚化或暗化遮罩。
- 当前发言者席位继续高亮，帮助观众知道位置关系。
- 对白框固定显示角色名、当前文本和等待状态，不显示狼人杀身份。
- 布局需要适配桌面和移动端。移动端可以上下堆叠：上方立绘，下方对白框。

为了保持现有结构，优先在 `ClassTrialGameTable.tsx` 内扩展发言焦点组件和 CSS class，不拆大规模新组件。若打字机逻辑需要测试，则抽到小 helper，例如 `classTrialDialogue.ts`。

## 混合打字机设计

输入是一段 AI 发言文本，输出是可逐步展示的片段。

规则：

- 如果文本较短，按字符增量显示。
- 如果文本较长，先按中文句号、问号、感叹号、分号、换行切成句段，再按句段显示。
- 进入新发言时先进入 `thinking` 状态，显示“正在思考/准备发言”。
- thinking 持续时间短且固定，避免拖慢对局。
- 当发言者或消息文本变化时，重置打字机。
- 当 `prefers-reduced-motion` 为 true，或文本为空，直接显示完整纯文字。
- 如果后续接入语音，本轮设计只保留接口空间，不绑定音频时长。

建议默认参数：

- thinking delay: 500-800ms。
- 短文本阈值：约 36 个中文字符以内逐字。
- 长文本句段间隔：约 500-900ms。
- 逐字速度：约 24-36ms/字。

这些数值作为 UI 常量，不进入用户配置。

## 数据流

1. `GameClient` 继续读取本地 `manifest.json` 和 `personas.json`。
2. `classTrialTheme.ts` 负责固定名单、素材状态、角色卡状态和 AI friend 构建。
3. `ClassTrialGameTable` 从 `HumanGameView` 获取当前 speaker/actor 和最新发言。
4. `ClassTrialGameTable` 根据座位映射找到当前角色素材。
5. 发言文本进入混合打字机 helper 或 hook。
6. UI 渲染 thinking 状态、打字机中的文本或完整 fallback 文本。

## 错误与降级

- 缺少高松灯素材时，主题仍可进入，头像/立绘区域显示文字占位。
- 缺少或 malformed `personas.json` 时，视觉主题继续，AI 使用普通行为。
- 图片加载失败时，保留角色名和发言，不阻塞对局推进。
- 用户偏好减少动画时，不显示打字机和过渡动画。
- 本地素材不出现在 Git 状态的 staged/tracked 文件中。

## 验证

自动化验证：

- `src/components/game/classTrialTheme.test.ts`：覆盖 `hagakure` 替换为 `tomori`、第 8 座显示高松灯、角色卡完整状态。
- 新增或扩展 focused test：覆盖混合打字机分段逻辑、短句逐字/长句按句、reduced motion fallback。
- 现有 request/API/role-card tests 不应因为 id 替换而退化。

手动或浏览器验证：

- 本地首页选择 `学级裁判主题局`。
- 确认 readiness 文案正常。
- 进入牌桌后第 8 座显示高松灯。
- 当前发言区为左立绘 + 右对白框。
- 背景环形席位弱化，当前发言者仍可辨认。
- 发言开始前出现短暂停顿，随后混合打字机展示文本。
- `/rooms` 不出现主题入口。

基础检查：

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `npm run harness:check`

## 开放问题

- 高松灯 PNG 的最终裁切比例需要在实现时根据现有千早爱音大小校准。
- 如果当前素材实际尺寸和透明留白导致视觉不齐，优先用 CSS `object-fit: contain` 和固定容器解决；必要时再生成本地裁切派生 PNG。
- GPT-SoVITS voice profile id 暂留为后续语音 slice 处理，不在本轮绑定端口或服务。

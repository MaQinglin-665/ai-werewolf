# 学级裁判主题局投票可视化设计

## 背景

`学级裁判主题局` 已经具备本地入口、固定 9 人角色、环形审判席、发言立绘、主题过场、GPT-SoVITS 语音和结案复盘。当前投票阶段仍然偏普通狼人杀流程：玩家能完成投票和查看最终票型，但“投票正在发生”的状态不够直观，开票结果也缺少学级裁判式的仪式感。

本设计只处理本地 `学级裁判主题局` 的常见白天放逐投票。目标是把投票阶段做成更清楚、更适合观看和录制的一版：投票进行中能看到谁已锁票、谁仍等待；开票时用短暂戏剧化转场后一次性揭示完整票型和最终焦点席。

设计参考图：

- 原始 imagegen 概念：`C:\Users\MQL\.codex\generated_images\019e7475-ca4e-77a0-b521-b32077197124\ig_05b01a4ffe51cd39016a1beb19caec81908fef8e1d09d857dd.png`
- 本地预览副本：`tmp/class-trial-vote-concept.png`

该概念图是设计参考，不作为直接上线素材。实际 UI 应用 HTML/CSS/React 复刻布局、层级、色彩和状态，不把投票文字烘焙进图片。

## 用户确认的方向

- 范围：只做学级裁判主题局里最常见的白天放逐投票画面。
- 其他投票：警长投票、警长 PK 投票等先沿用旧 UI。
- 投票进行中：保留当前裁判桌面，在席位和中心区域叠加投票 HUD。
- 开票揭示：切到更戏剧化的揭示界面。
- 揭示节奏：不做逐票翻开动画；短过场后一次性显示完整票型。
- 席位状态：可以显示 `已锁票` / `等待中`，但投票进行中不能显示任何人的投向。
- 推荐实现：混合投票演出，也就是“进行中保留桌面 + 开票时一次性揭示”。

## 目标

- 让学级裁判主题局的 `DAY_VOTE` 阶段清楚显示封票进度。
- 让每个有投票权的存活席位显示 `已锁票` 或 `等待中`。
- 投票进行中只显示锁票状态，不提前公开投向、目标票数或谁投了谁。
- 在所有可投票玩家锁票后，进入一次性开票揭示场景。
- 开票揭示显示完整投票明细、弃票、目标票数排行、最终放逐焦点席。
- 保持普通狼人杀桌面、普通 `VotePanels`、房间 `/rooms` 和 Public Alpha 不变。
- 不改变规则引擎、投票合法性、AI 行动、胜负条件或复盘数据结构。

## 非目标

- 不实现逐票翻牌动画。
- 不做完整投票专用整屏界面替代整个主题局桌面。
- 不改警长投票、警长 PK 投票、骑士决斗或其他特殊投票流程。
- 不新增投票倒计时、手动结束投票、改票机制或投票确认二次弹窗。
- 不在投票进行中公开目标票数、票型走势、投向明细或隐藏身份信息。
- 不把 imagegen 概念图作为实际 UI 背景或素材提交。
- 不触碰 `src/game/**`、`src/ai/**`、`src/server/**` 或 `/rooms` 逻辑。

## 投票进行中设计

当主题局处于 `DAY_VOTE` 且 `tableSummary.voteSnapshot.revealed` 为 false 时，`ClassTrialGameTable` 进入投票进行中视觉状态。

桌面结构保持现有环形审判席，只增加三层可视化：

1. 中心封票 HUD
   - 标题：`封票中` 或 `VOTE`。
   - 主数字：`已锁票人数 / 可投票人数`。
   - 进度条：使用红金主色，表示已锁票比例。
   - 次级信息：`等待 X 人`。
   - 如果没有待投玩家，显示 `票箱已封存`。

2. 席位状态标签
   - 已投票席位：绿色或暗金微光，标签 `已锁票`。
   - 未投票席位：红色或暗灰边框，标签 `等待中`。
   - 无投票权或已退场席位：维持现有 `已退场` / 禁用视觉，不参与封票分母。
   - 当前真人可操作席位可以保留现有行动高亮，但不能掩盖锁票状态。

3. 侧边或底部轻量提示
   - 显示“投向将在开票时统一公开”这类短提示。
   - 不显示候选列表之外的新推理建议。
   - 不抢占发言对白区域。

信息边界：

- 已投票状态可以公开。
- 投票目标不能公开。
- 目标票数不能公开。
- 其他玩家是否弃票不能公开。
- 当前真人自己已提交的选择是否显示，沿用现有行动反馈即可；不要在公共桌面变成“我投给 X”。

## 开票揭示设计

当主题局进入 `EXILE_RESOLUTION`，或 `voteSnapshot.revealed` 为 true 且存在放逐投票快照时，显示一次性开票揭示。

开票揭示不是逐票动画，而是短暂过场后直接展示完整结果：

1. 戏剧化进入
   - 使用现有 `PhaseCurtain` / `classTrialPhaseScenes` 思路。
   - 标题类似 `开票` / `判决揭示`。
   - 时长保持短，避免打断节奏。
   - reduced-motion 下直接显示结果。

2. 完整票型面板
   - 逐项列出每个投票人和投向。
   - 弃票显示为 `弃票`。
   - 可使用现有 `VoteRevealLedger` 的数据表达，但视觉主题化。
   - 排序优先沿用 `snapshot.votes` 的公开顺序，避免制造新的“投票先后”含义。

3. 目标票数排行
   - 使用 `snapshot.tally`。
   - 最高票目标高亮。
   - 平票时显示多个并列目标，不强行制造单一焦点。
   - 无有效票时显示 `无人出局`。

4. 放逐焦点席
   - 如果有最终放逐目标，环形席位对应座位红色聚光。
   - 中心结果显示 `X 号进入判决席` 或等价主题文案。
   - 如果无人出局，中心显示 `本轮无放逐`。

开票结果可以由 `PhaseCurtain` 呈现，也可以由 `ClassTrialGameTable` 在揭示状态下呈现。优先选择对现有结构侵入最小的实现，但结果画面必须比当前单纯文本过场更像一张投票揭示屏。

## 数据与状态

优先复用现有投票投影：

- `game.phase`
- `game.phaseLabel`
- `game.availableActions`
- `game.tableSummary.voteSnapshot`
- `game.tableSummary.sheriffVoteSnapshot`
- `game.seats`

本切片只读取放逐投票快照：

- 进行中：`game.phase === "DAY_VOTE"` 且 `voteSnapshot.revealed === false`。
- 开票后：`voteSnapshot.revealed === true` 或 `game.phase === "EXILE_RESOLUTION"`。

封票进度计算：

- 分母优先使用 `voteSnapshot.pendingSeatIds.length + voteSnapshot.votes.length`。
- 如果投影字段缺失或旧数据不完整，降级为存活且有投票权席位数量。
- 已锁票数量使用 `voteSnapshot.votes.length`。
- 等待数量使用 `pendingSeatIds.length`。

席位状态：

- `voteSnapshot.votes` 中出现的 voter seat 为 `locked`。
- `voteSnapshot.pendingSeatIds` 中出现的 seat 为 `waiting`。
- 不在两者里的席位保持普通或禁用状态，避免误标。

## 组件边界

建议保持局部改动：

- `src/components/game/ClassTrialGameTable.tsx`
  - 增加投票阶段 HUD。
  - 给席位添加 vote locked / waiting 主题状态。
  - 在开票揭示状态下显示主题化结果布局或承接揭示组件。

- `src/components/game/VotePanels.tsx`
  - 优先不改普通导出行为。
  - 如需复用数据展示，可抽出纯展示 helper，但不能改变普通游戏视觉。

- `src/components/game/classTrialPhaseScenes.ts`
  - 调整或新增开票揭示 cue。
  - 保持警长投票等非目标阶段不走新主题揭示。

- `src/components/game/PhaseCurtain.tsx`
  - 如复用过场，补充一次性开票揭示所需的主题结果区域。
  - 不影响 default presentation。

- `src/app/globals.css`
  - 增加 class-trial vote HUD、seat vote state、reveal panel、focus seat 样式。
  - 保持现有移动端样式稳定。

- 测试文件
  - `classTrialGameTable.test.ts`
  - `classTrialPhaseScenes.test.ts`
  - `PhaseCurtain.test.ts`
  - 必要时扩展 `gamePanelsMobile.test.ts` 防止普通入口回退。

如果实现中发现现有文件过大或职责不清，可以新增小型纯展示组件，例如：

- `ClassTrialVoteStage.tsx`
- `classTrialVoteStage.test.ts`

但第一版不应拆成过多层，避免扩大风险。

## 移动端与录制尺寸

第一优先级是桌面录制视角。移动端不能崩坏，但不要求达到同等戏剧化。

桌面：

- 中心 HUD 不能遮住当前发言对白框。
- 环形席位状态文字必须可读。
- 开票结果面板能同时看到票数排行和投向明细。

移动端：

- 投票进行中可以显示简化中心进度和列表式 `已锁票 / 等待中`。
- 开票揭示可以使用单列结果面板。
- 文本不得溢出按钮、席位或面板。

## 错误与降级

- 没有 vote snapshot：不显示新 HUD，沿用旧桌面。
- `pendingSeatIds` 缺失：只显示已锁票数量，不显示等待席位标签。
- `votes` 为空：显示 `等待锁票`，不渲染空明细。
- `tally` 为空但 revealed 为 true：显示 `无人获得有效票`。
- 平票：显示并列高亮，不编造放逐目标。
- reduced-motion：禁用扫光、入场和聚光动画，只保留静态状态。

## 验证

自动化验证：

- `ClassTrialGameTable` 在 `DAY_VOTE` 中显示中心封票 HUD。
- `ClassTrialGameTable` 正确显示 `已锁票` 和 `等待中`。
- 投票进行中不渲染投向、目标票数或逐票明细。
- `EXILE_RESOLUTION` 或 revealed snapshot 下显示完整票型。
- 开票揭示能显示弃票、目标票数排行和最终焦点席。
- 普通非主题游戏不显示 class-trial vote HUD。
- 警长投票不进入本切片的新放逐投票视觉。

建议命令：

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts
npm run lint
npx tsc --noEmit
npm run build
npm run harness:check
git diff --check
```

浏览器验证：

1. 本地启动应用。
2. 进入 `学级裁判主题局`。
3. 使用 9 人无真人观战或可控 mock 流程推进到 `DAY_VOTE`。
4. 确认投票进行中显示封票进度、`已锁票` / `等待中`，且不显示投向。
5. 推进到开票/放逐结算。
6. 确认短过场后一次性显示完整票型、弃票、排行和最终焦点席。
7. 打开普通游戏或 `/rooms`，确认没有出现主题投票 HUD。

## 开放风险

- 真实 LLM 和语音可能让抵达投票阶段较慢，浏览器验证可以先用 mock 或 API 辅助推进。
- 现有 `voteSnapshot` 的字段完整性需要实现时再次确认，避免根据不存在字段设计 UI。
- 开票揭示如果塞入 `PhaseCurtain`，可能受 3 秒自动隐藏限制影响；如果内容较多，可能需要把结果留在桌面层而不是只在过场层显示。
- 桌面录制效果和移动端可读性可能有冲突，第一版优先保证桌面录制，移动端做稳定降级。
- 当前仓库有其他未提交改动，实施时必须避免顺手修改无关 AI、规则或任务文件。

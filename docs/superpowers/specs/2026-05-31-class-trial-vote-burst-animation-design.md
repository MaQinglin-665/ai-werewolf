# 学级裁判投票爆发演出设计

## Goal

继续打磨本地限定 `学级裁判主题局` 的投票阶段，让它更接近弹丸式高速演出，但不牺牲读票清晰度，也不改变现有投票信息布局。

本设计只覆盖本地 class-trial 单机/观战桌面体验。普通狼人杀投票、`/rooms`、Public Alpha、音效和规则逻辑不在范围内。

## User Decisions

- 风格选择：弹丸式夸张演出。
- 动效重点：高速切屏。
- 动效强度：只在投票开始和开票瞬间爆发。
- 封票常态：默认低频脉冲/扫描线，不持续高频抖动。
- 闪切内容：只在开票揭示时闪切被放逐/领先座位特写。
- 平票或无人放逐：用同等冲击强度显示 `未达成处刑`。
- 音效：本轮只做视觉，不加音效接口。
- 布局：保持现有投票信息布局，只叠加演出层。

## Experience Design

### 1. 投票开始爆发

当 `DAY_VOTE` 的 sealed vote stage 首次出现时，叠加一个短促全局演出层：

- 红黑斜切高速切屏。
- `TRIAL VOTE` 主标题和 `封票开始` 副标题冲入。
- 扫描线和锁票印章质感。
- 持续时间短，结束后回到当前 `封票中` 面板。

这层只表达“投票开始”，不能出现投票目标、票型趋势、箭头或谁投了谁。

### 2. 封票中常态

现有 `封票中` 面板和座位状态保持布局稳定：

- `x / 9` 进度继续作为主信息。
- 每个座位仍只显示 `已锁票` / `等待中`。
- 面板背景使用低频脉冲、扫描线、轻微红黑噪点。
- 锁票状态可有短促亮起/盖章感，但不持续抖动。

常态动画的目标是压迫感，不是抢读。用户必须能轻松看清锁票进度。

### 3. 开票处刑特写

当 vote snapshot 进入 revealed 状态时，先短暂叠加开票演出：

- 如果存在唯一领先座位，闪切该座位的号码、姓名和可用头像/席位信息。
- 然后砸出 `开票揭示` 大字。
- 演出结束后仍落回现有 tally + ledger 信息面板。

“特写”只使用已经公开的 revealed 结果。不能在 `DAY_VOTE` sealed 阶段提前展示目标。

### 4. 未达成处刑

如果 revealed vote 没有唯一领先座位、平票、或没有有效放逐对象：

- 不显示某个被放逐座位特写。
- 用同等强度砸出 `未达成处刑`。
- 之后仍展开完整票型和逐票 ledger，便于复盘。

这样保留冲击感，同时避免误导玩家以为某个座位被处刑。

## Component Boundaries

### Vote Stage State

沿用当前 `getClassTrialVoteState(game)` 的分层：

- `sealing`：封票阶段，只允许使用 eligible/locked/pending seat ids。
- `reveal`：开票阶段，可使用 revealed tally/votes/abstain 和 focus seat。

新增演出状态应从 UI 层派生，不写入 game state，不改变 server projection。

### Presentation Layer

在 `ClassTrialVoteStage` 内部或邻近小组件中加入纯展示层：

- `ClassTrialVoteBurstOverlay`：负责投票开始和开票瞬间的叠加动画。
- CSS class 控制视觉节奏，避免新增运行时依赖。
- 通过现有 `variant` 和 `focusSeatId` 决定显示 `TRIAL VOTE`、`开票揭示`、或 `未达成处刑`。

保持信息区 DOM 仍在页面中，演出层只覆盖短时间视觉，不成为唯一信息来源。

## Privacy And Safety

- `DAY_VOTE` sealed 阶段不得读取或渲染 `votes` target、tally、leaders、ledger、投票理由。
- 封票动画不能通过颜色、顺序、位置或闪切暗示谁投给谁。
- 开票特写只在 revealed snapshot 后出现。
- 不添加音效接口，避免和现有 host audio / GPT-SoVITS 任务交叉。
- 不改普通投票页、警长投票、房间投票或 Public Alpha 路径。

## Accessibility And Motion

- `prefers-reduced-motion: reduce` 下关闭高速切屏、震动、扫描移动，只保留静态强调态。
- 关键结果必须以文本存在：`封票中`、`开票揭示`、`未达成处刑`、tally、ledger。
- 演出层不应阻断按钮或让“继续流程”不可达。

## Testing Plan

- Component tests protect sealed stage still不泄露 target/ledger。
- Component/table tests protect reveal state contains `开票揭示` or `未达成处刑` text.
- Add at least one reduced-motion/static class expectation if implementation exposes a stable hook.
- Existing focused pack remains relevant:
  - `npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts`
- UI verification must use local browser on a non-conflicting port and confirm:
  - 投票开始出现短促爆发层。
  - 封票常态信息可读且不泄露目标。
  - 开票时出现座位特写 + `开票揭示`。
  - 平票/无人放逐 fixture 出现 `未达成处刑`。

## Non-Goals

- 不做逐票动画。
- 不重排当前投票信息架构。
- 不加入音效或音频事件。
- 不接入 image2 新图生成。
- 不改 AI 发言、投票策略、规则引擎结算。
- 不发布到公网房间或 Public Alpha。

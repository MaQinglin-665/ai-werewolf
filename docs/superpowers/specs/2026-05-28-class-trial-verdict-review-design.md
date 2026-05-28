# 学级裁判主题局审判场背景与终局复盘设计

## 背景

`学级裁判主题局` 已经具备本地入口、固定 9 人角色、环形席位、发言立绘、阶段过场和隐藏夜晚行动保护。当前画面仍然更像带有审判元素的狼人杀桌面，缺少足够明确的红黑审判场压迫感；终局后也还没有进入主题化复盘体验；死亡玩家在环形席位上缺少持续可见的退场状态。

本切片目标是把主题局推进到更适合录制和观赏的一版：一进入局内就能感到红黑环形法庭氛围，玩家死亡后在席位上持续显示“已退场”，游戏结束后自动进入“结案审判”式复盘。

本功能仍然只服务本地 `学级裁判主题局`，不进入 `/rooms`、Public Alpha 或生产发布路径，不改变狼人杀规则、AI 合法行动、胜负条件或隐藏信息边界。

## 用户确认的方向

- 背景风格：红黑审判场 / 环形法庭压迫感。
- 背景资产：可以用 image 生成，作为本地私有主题素材。
- 背景数量：先做一张高质量主审判场背景，后续用代码叠加阶段效果。
- 复盘风格：主题化审判复盘，不是普通流水日志。
- 死亡显示：环形席位上持续标记死亡。
- 信息边界：死亡席位只显示退场状态，不公开身份。
- 终局行为：游戏结束后自动进入复盘面板。

## 目标

- 生成并接入一张本地私有红黑审判场背景图，使主题局桌面不再依赖当前抽象 CSS 背景。
- 在 `ClassTrialGameTable` 的 9 人环形席位中持续显示死亡/退场状态。
- 死亡状态仅表达“已退场”，不泄露角色身份、阵营或死亡原因，除非这些信息已经在终局复盘阶段公开。
- 游戏进入 `GAME_OVER` 且 `game.review` 存在时，主题局自动展示结案审判复盘，而不是停留在普通桌面等待玩家找入口。
- 复盘重点改为审判叙事：最终判决、关键证据、票型迷雾、退场名单、胜因归纳。
- 复用现有 `GameReview` 数据，不新增规则引擎字段，不改变 `buildGameReview` 的核心语义。
- 继续保证默认狼人杀桌面、移动端普通流程和 `/rooms` 不受主题局改动影响。

## 非目标

- 不把学级裁判主题发布到公网房间或 Public Alpha。
- 不提交版权/参考角色素材到 Git。
- 不新增角色、板子、夜晚行动、胜负规则或身份公开规则。
- 不实现 GPT-SoVITS、日语语音 rewrite、音频同步打字机或录制模式开关。
- 不重写现有普通 `ReviewPanel`。
- 不把赛后复盘做成可编辑报告或导出文件。
- 不在存活阶段公开死亡玩家身份。

## 视觉背景设计

本切片使用一张本地私有主背景图，建议文件名：

- `local-assets/class-trial-pack/backgrounds/court-main.png`

该目录继续保持 ignored。背景图通过 `/class-trial-pack/...` 本地路由读取，只在本地主题局使用。

背景图要求：

- 横向 16:9 或接近桌面宽屏比例，适合 1500px 宽桌面容器。
- 红黑环形审判场，中心留出安全区给环形席位和阶段信息。
- 有法庭/裁判席/审判舞台的空间感，但不要出现具体可识别版权角色或文字。
- 不把 UI 文案、按钮、角色名画进图片里，所有文字继续由代码渲染。
- 颜色以深红、黑、暗金为主，避免过亮、过花或抢走头像/对白框。
- 边缘可以更暗，中心要有足够对比让席位可读。

实现上扩展 `ClassTrialPackManifest`，允许 manifest 提供：

```ts
backgrounds?: {
  courtMain?: string;
}
```

如果背景缺失，主题局继续使用当前 CSS-built court background 作为降级，不阻塞开局。

## 阶段叠加效果

主背景不为每个阶段生成多张图。阶段差异通过代码叠加：

- 普通等待/行动：背景最清晰，环形席位可读。
- 发言中：沿用现有 speaking focus，弱化环形席位，突出立绘和对白框。
- 投票审判：增加红色扫光、票箱/判决感的轻量叠层，不遮挡席位。
- 终局复盘：背景更暗，中心或下方复盘面板成为主视觉。

这些效果用 CSS class 和现有阶段状态控制，不改变规则流。

## 死亡席位设计

每个席位已经能从 `HumanGameView.seats` 读取 `alive` 和 `deathReason`。主题局只使用 `alive` 来决定席位状态。

死亡席位表现：

- 头像降饱和、变暗。
- 席位边框从暗金转为冷灰/暗红。
- 角色名仍然可读。
- 增加小标签：`已退场`。
- 可以加斜向遮罩或细线，但不能遮住角色名。
- 当前行动/发言高亮仍优先于退场状态；正常规则下死亡者不会成为当前行动者，但 UI 要稳健处理。

死亡席位不显示：

- 狼人杀身份。
- 阵营。
- 具体死亡原因。
- “被刀/被毒/被放逐”等细节。

终局复盘阶段可以展示死亡时间线和身份揭晓，因为现有 `GameReview` 已经在终局后公开完整复盘。

## 结案审判复盘设计

新增主题局专用复盘组件，建议命名：

- `ClassTrialVerdictReview`

它只在 `classTrialThemeActive && game.result && game.review` 时渲染。普通桌面仍使用现有 `ReviewPanel`。

复盘信息结构：

1. `最终判决`
   - 胜利阵营。
   - 胜负原因。
   - 一句审判式结论，例如“本庭确认：好人阵营完成最终指认。”

2. `关键证据`
   - 优先使用 `review.turningPoints`。
   - 每条显示 D 日、标题、描述。
   - 数量控制在 3-5 条，避免复盘屏过长。

3. `票型迷雾`
   - 使用 `review.voteImpacts`。
   - 突出关键放逐、平票、误推出好人或推出狼人。
   - 可显示关键票中好人票 / 狼人票的终局归因，但只在终局复盘里出现。

4. `退场名单`
   - 使用 `review.deathTimeline` 和 `review.roleReveal`。
   - 展示死亡日、姓名、退场原因标签。
   - 若无人死亡，显示“无人退场，审判直接进入终局。”

5. `身份揭晓`
   - 终局后展示全部座位身份。
   - 使用更紧凑的角色卡列表，不必复用普通牌面图片。
   - 仍以主题化文案呈现，不做复杂新图。

6. `审判记录`
   - 使用 `review.keyEvents` 或昼夜轮次作为次级折叠内容。
   - 默认不抢第一屏，避免复盘像日志面板。

复盘面板视觉：

- 半透明深色裁判文书面板，暗金边框。
- 标题更像“最终裁决 / 证据编号 / 判决记录”。
- 卡片角半径保持克制，不使用大圆角。
- 避免解释性教学文案，只呈现对局结果和证据。

## 终局自动进入复盘

主题局终局后不要求玩家点击“进入审判复盘”。当 `game.result` 和 `game.review` 出现时：

- `ClassTrialGameTable` 可以直接切到 `ClassTrialVerdictReview`。
- 或 `GameClient` 在主题局分支中选择渲染复盘组件。
- 仍保留 `返回首页`。
- 可以保留一个轻量“重新开局”入口，但不是本切片必须项。

如果 `game.result` 存在但 `game.review` 暂时缺失：

- 继续显示最终阶段信息。
- 显示“审判记录整理中”之类的降级状态。
- 不抛错、不空屏。

## 数据流

1. `GameClient` 继续读取 `manifest.json`。
2. `classTrialTheme.ts` 解析可选背景字段和既有角色素材字段。
3. 主题局 active 时，`ClassTrialGameTable` 接收 manifest 并取得 `courtMain` 背景 URL。
4. `ClassTrialGameTable` 根据 `game.seats[].alive` 添加死亡席位 class 和标签。
5. 当 `game.result && game.review` 成立时，主题局自动渲染 `ClassTrialVerdictReview`。
6. `ClassTrialVerdictReview` 只读取 `HumanGameView.review` 和 `HumanGameView.result`，不请求新 API。

## 组件边界

优先保持局部改动：

- `classTrialTheme.ts`
  - 扩展 manifest 类型。
  - 提供背景 URL 读取和降级 helper。

- `ClassTrialGameTable.tsx`
  - 接入背景 URL。
  - 增加死亡席位 class 和 `已退场` 标签。
  - 在终局时切换到复盘组件或留出复盘插槽。

- `ClassTrialVerdictReview.tsx`
  - 新增主题化复盘展示。
  - 不影响普通 `ReviewPanel`。

- `globals.css`
  - 增加审判场背景图层、死亡席位样式和复盘面板样式。

- 测试文件
  - 扩展 `classTrialTheme.test.ts`。
  - 扩展 `classTrialGameTable.test.ts`。
  - 新增 `classTrialVerdictReview.test.ts`。
  - 必要时扩展 `gamePanelsMobile.test.ts`，保护 `/rooms` 或 landing 行为不变。

## 错误与降级

- 背景图缺失：使用当前 CSS court background。
- manifest 没有 `backgrounds` 字段：视为旧版本素材包，仍可进入主题局。
- 背景图片加载失败：浏览器自然降级到 CSS 背景色和已有伪元素。
- `game.review` 缺失：显示终局状态和整理中提示。
- `review.turningPoints` 或 `voteImpacts` 为空：对应区块不渲染，复盘仍展示最终判决和身份揭晓。
- `deathTimeline` 为空：显示无人退场文案。
- reduced-motion：禁用复盘入场动画和背景扫光。

## 验证

自动化验证：

- `src/components/game/classTrialTheme.test.ts`
  - manifest 可读取 `backgrounds.courtMain`。
  - 旧 manifest 无背景字段时降级稳定。

- `src/components/game/classTrialGameTable.test.ts`
  - 存活席位正常显示。
  - 死亡席位显示 `已退场`。
  - 死亡席位不显示身份、阵营或死亡原因。
  - manifest 背景 URL 能进入渲染样式或数据属性。
  - 终局时渲染主题复盘入口/组件。

- `src/components/game/classTrialVerdictReview.test.ts`
  - 渲染最终判决。
  - 渲染关键证据。
  - 渲染票型迷雾。
  - 渲染退场名单和身份揭晓。
  - 空 review 子数组时不崩溃。

基础检查：

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialVerdictReview.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-verdict-review.md`
- `npm run harness:check`
- `git diff --check`

浏览器验证：

- 本地启动后进入首页。
- 选择 `学级裁判主题局`。
- 使用无真人观战进入 `9p-seer-witch-hunter`。
- 确认桌面背景为红黑环形审判场，不再像当前抽象背景。
- 推进到出现死亡后，确认对应环形席位显示 `已退场`，且不显示身份。
- 推进到 `GAME_OVER` 后，确认自动进入结案审判复盘。
- 确认复盘包含最终判决、关键证据、票型迷雾、退场名单和身份揭晓。
- 打开 `/rooms`，确认仍不出现学级裁判主题入口。

## 开放风险

- 背景图是本地私有 generated asset，需要人工视觉验收；如果构图挤压中心席位，需要重新生成或裁切。
- 终局复盘依赖现有 `GameReview`，如果某局缺少足够站边/票型数据，复盘会更短，但不能虚构证据。
- 死亡席位持续标记会增加画面信息密度，需要浏览器检查移动端和录制尺寸下文字是否溢出。
- 当前 worktree 已有上一切片未提交改动，实施时必须只改本切片允许文件，并避免误提交 `local-assets`。

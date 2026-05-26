# 本地改动收口清单

## 状态

- 工作线：`codex/render-main-game-env-fix`
- 状态：`in_progress`
- 主线程负责人：Codex
- 收口日期：2026-05-26

## 背景

当前本地工作区混合了多条线：AI 发言/行动质量、真实模型评估、AI 池与 DeepSeek/Mimo 语音包、房间/移动端体验、Public Alpha 产品叙事、推广截图和评估 JSON。它们都服务试玩闭环，但不适合作为一个大提交直接进入 Alpha。

本收口清单的目标是把本地改动拆成可审查、可回滚、可验证的提交批次。

## 当前验证

已完成：

- `npm run test`：通过，46 个测试文件、485 个测试。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `git diff --check -- README.md docs\roadmap.md docs\current-release.md docs\alpha-playtest.md docs\alpha-feedback-ops.md eslint.config.mjs src\ai\actionProviders.test.ts src\game\engine.test.ts`：通过。
- 本地浏览器试玩验证：通过。`http://127.0.0.1:3000/rooms` 在 390x844 视口可见“多人房间 / 创建房间 / Alpha 预检”，无横向溢出；`/ai-pool` 在 390x844 视口可见“AI池 / 对局 AI 模式 / 快速新增AI”，无横向溢出；展开首个 AI 配置面板后仍无横向溢出；`/ai-pool` 在 1280x720 视口无横向溢出；浏览器 error 日志为空。

已知构建提示：

- `npm run build` 仍有 Turbopack NFT trace warning，路径为 `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/[roomId]/view/route.ts`。这不是本次收口新增的阻塞。

本次浏览器验证中发现并修复：

- `/ai-pool` 桌面右栏曾被内容最小宽度撑出视口，已给 AI 池布局右栏和卡片补 `min-width: 0` / `max-width: 100%` 边界。
- `/ai-pool` 移动端关闭状态下的 AI 配置面板曾被 `position: fixed` 样式暴露为小型幽灵面板，已在 `details:not([open])` 时隐藏面板。

## 建议提交批次

### 批次 1：Public Alpha 叙事与本地验证范围

目的：先让外部说明和本地工具边界一致。

文件：

- `README.md`
- `docs/roadmap.md`
- `docs/current-release.md`
- `docs/alpha-playtest.md`
- `docs/alpha-feedback-ops.md`
- `eslint.config.mjs`

说明：

- README 从“本地 Alpha”调整为“本地试玩 + Public Alpha 小范围房间试玩”。
- Alpha 文档统一腾讯云为主链路，Render 为备用镜像。
- roadmap 明确近期顺序：收口当前大改动、统一产品叙事、让技术债服务试玩闭环。
- ESLint 忽略 `.worktrees/**`，避免本地 Codex worktree 的 `.next` 生成产物污染 lint。

建议验证：

- `git diff --check -- README.md docs\roadmap.md docs\current-release.md docs\alpha-playtest.md docs\alpha-feedback-ops.md eslint.config.mjs`
- `npm run lint`

### 批次 2：AI 发言/行动质量主线

目的：把 AI 从“能输出”推进到“更像桌上玩家”，并加强真实 LLM 评估。

文件：

- `package.json`
- `scripts/audit-ai-experience.mjs`
- `scripts/evaluate-llm-game.mjs`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/advancedReasoning.ts`
- `src/ai/debateAgenda.ts`
- `src/ai/debateAgenda.test.ts`
- `src/ai/expertStrategy.ts`
- `src/ai/inferenceLayers.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `src/ai/modelLlms.ts`
- `src/ai/modelLlms.test.ts`
- `src/ai/reasoningFrame.ts`
- `src/ai/rolePlaybook.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/game/engine.test.ts`
- `src/game/projection.ts`
- `src/game/tableMemory.ts`
- `src/game/tableMemory.test.ts`
- `src/game/types.ts`

说明：

- 新增公开推理层 `inferenceLayers`，把公开事实、高概率推断、低概率边界、私密未知分开。
- 强化发言计划、发言目标状态、发言-投票连续性、低信息首日发言边界和查杀/金水归因。
- 动作候选加入 reason hint、分歧票线、英文残片修复和 speech-vote continuity 校验。
- 真实 LLM 评估脚本支持 DeepSeek lineup、质量问题归类、retry 归因和优化建议。

建议验证：

- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/ai/debateAgenda.test.ts src/ai/llmEvaluation.test.ts src/game/claims.test.ts src/game/engine.test.ts`
- `npx tsc --noEmit --pretty false`

暂缓判断：

- `docs/evaluations/2026-05-24-*.json` 是多轮评估原始产物。建议只挑最终代表性报告入库，或另写摘要；不要把所有中间 rerun JSON 与主逻辑同批提交。

### 批次 3：DeepSeek/Mimo 语音包和 AI 池导入体验

目的：让小范围真实模型/语音试玩有可复用配置入口，但不嵌入密钥。

文件：

- `public/tools/deepseek-mimo-voice-pack.json`
- `public/tools/install-deepseek-mimo-voices.html`
- `src/game/aiFriends.ts`
- `src/game/deepseekMimoVoicePack.test.ts`
- `src/server/mimoTts.ts`
- `src/server/mimoTts.test.ts`
- `src/components/AiPoolClient.tsx`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/app/globals.css`

说明：

- 新增 DeepSeek + Mimo 预设 AI friend pack 和浏览器 localStorage 安装工具。
- Mimo API key 清洗避免用户误把完整 header 或 token 文本粘进配置。
- AI 池移动端配置面板、快速添加和调参说明有明显改动，应单独验 UI。
- 本次已补 AI 池右栏收缩和移动端详情面板隐藏边界，防止真实试玩时出现横向溢出或未展开面板遮挡。

建议验证：

- `npm run test -- src/game/deepseekMimoVoicePack.test.ts src/server/mimoTts.test.ts src/components/AiPoolClient.mobile.test.ts`
- `npm run lint`
- 浏览器打开 `/ai-pool`，手机宽度检查快速添加、配置折叠、密钥输入和真实模式切换。

暂缓判断：

- 这个批次适合进入 Alpha 工具链，但不要默认公开承诺真实 LLM/TTS 稳定性。Public Alpha 朋友试玩仍默认 mock AI。

### 批次 4：房间/移动端试玩体验

目的：改善真实玩家进入房间后的手机可读性和房间页操作反馈。

文件：

- `src/components/RoomClient.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/layout.test.ts`
- `next.config.ts`

说明：

- 房间页进入 room view 后更接近全屏体验，减少页面滚动和拥挤。
- `layout.tsx` 增加根节点 hydration warning 抑制，兼容浏览器翻译扩展增加属性。
- `next.config.ts` 增加 `192.168.100.200` dev origin，属于局域网手机调试便利项。

建议验证：

- `npm run test -- src/app/layout.test.ts`
- `npm run build`
- 本地启动后用 390px 手机视口打开 `/rooms`，覆盖创建、入座、开局前房间页和开局后 room view。

暂缓判断：

- `next.config.ts` 的局域网 origin 如果只服务个人手机调试，可单独提交为 dev-chore；如果不希望进入共享分支，应从本批次拆出。

### 批次 5：推广截图素材

目的：支撑朋友圈/社交平台第一波试玩邀请。

文件：

- `docs/promotion/captures/README.md`
- `docs/promotion/captures/*.png`

说明：

- 截图素材来自 Public Alpha 真实页面，适合和 `docs/promotion/social-playtest-kit.md` 配套。
- 这是产品推广资产，不影响运行时代码。

建议验证：

- 打开图片检查是否无敏感信息、无真实密钥、无不该公开的房间/玩家隐私。
- 保留 README 中截图来源、采集日期和推荐发图顺序。

## 不建议直接同批提交的内容

- 所有 `docs/evaluations/2026-05-24-*.json` 中间评估原始文件。
- `next.config.ts` 的局域网 dev origin，除非确认团队也需要。
- 任何真实 API Key、`.env`、本地数据库、`.next`、`.worktrees`、运行日志。

## 下一步

1. 先提交批次 1，得到一个干净的叙事/工具边界基线。
2. 批次 2 单独审查 AI 行为主线，因为这是最大风险区，也是当前 Alpha 局感核心。
3. 批次 3 和批次 4 已完成首轮手机视口验证；进入提交前仍应按各自文件边界做代码审查，避免把 AI 池、房间页和局域网 dev origin 混成一个不可回滚提交。
4. 批次 5 可以作为纯素材提交，或者等第一波朋友圈素材定稿后再提交。

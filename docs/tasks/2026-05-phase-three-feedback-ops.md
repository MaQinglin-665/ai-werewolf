# 阶段三：反馈与观测闭环

## 状态

- 工作线：`docs` / `verification` / lightweight frontend
- 状态：`done`
- 建议分支：`codex/phase-three-feedback-ops`
- 主线程负责人：Codex

## 背景

阶段二已经发布 `/alpha-playtest`，但真实双端长时间试玩需要等待时间窗口。为了不阻塞后续推进，阶段三先补齐朋友反馈入口、维护者排障顺序和线上检查口径。这样后续每一次小范围试玩都能留下可处理的问题信息。

## 目标

- 新增公开 `/alpha-report` 页面，让玩家生成可复制的反馈文本。
- 明确反馈不上传服务器、不写数据库、不收集浏览器指纹。
- 在 `/alpha-playtest` 增加反馈模板入口。
- 新增维护者反馈与观测 runbook。
- 不改变房间业务逻辑和 API。

## 上下文包

请先读取：

- `docs/working-agreements.md`
- `docs/threads/docs.md`
- `docs/threads/verification.md`
- `docs/alpha-playtest.md`
- `docs/alpha-feedback-ops.md`
- `docs/tasks/2026-05-phase-three-feedback-ops.md`

## 允许修改

- `docs/**`
- `src/app/alpha-playtest/page.tsx`
- `src/app/alpha-report/**`

## 不允许修改

- `.env`、真实密钥、数据库文件和生成缓存。
- `src/game/**`
- `src/ai/**`
- `src/server/**`
- `src/components/GameClient.tsx`
- `src/components/RoomClient.tsx`
- 现有房间 API 行为。

## 影响面

- 状态结构：无。
- API 响应：无。
- 环境变量：无。
- 持久化数据：无。
- 用户可感知变化：新增 `/alpha-report` 反馈模板生成页，`/alpha-playtest` 增加反馈入口。

## 验收

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- 本地生产服务验证 `/alpha-report` 可访问。
- 移动宽度渲染检查 `/alpha-report`。
- 公网部署后验证 `/alpha-report` 可访问。

## 完成记录

### 完成内容

- 新增 `/alpha-report` 反馈模板生成页，支持填写房间码、座位、阶段、严重程度、设备、浏览器、实际情况、期望结果、刷新恢复和复现步骤。
- 页面只在浏览器本地生成反馈文本，提供复制按钮，不向服务器提交数据。
- `/alpha-playtest` 增加反馈模板入口。
- 新增 `docs/alpha-feedback-ops.md`，固定反馈分级、试玩前检查、维护者排障顺序和修复验收口径。
- `docs/alpha-playtest.md` 和 `docs/README.md` 增加反馈入口说明。

### 修改文件

- `docs/README.md`
- `docs/alpha-feedback-ops.md`
- `docs/alpha-playtest.md`
- `docs/render-deploy.md`
- `docs/tasks/2026-05-phase-three-feedback-ops.md`
- `src/app/alpha-playtest/page.tsx`
- `src/app/alpha-report/FeedbackTemplateClient.tsx`
- `src/app/alpha-report/page.tsx`

### 验证结果

- `npm run lint`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run build`：通过；`/alpha-report` 被标记为静态页面。仍有既有 Turbopack NFT trace 警告，路径为 `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/[roomId]/view/route.ts`。
- 本地生产服务 `http://127.0.0.1:3015/alpha-report`：HTTP 200，HTML 包含 `反馈模板`、`房间码`、`复制反馈文本` 和 `不会上传到服务器`。
- 本地生产服务 `http://127.0.0.1:3015/alpha-playtest`：HTTP 200，HTML 包含 `/alpha-report` 和 `试玩说明`。
- Chrome headless 390px 宽度渲染检查：页面首屏可见标题、联机房间/试玩说明/健康面板按钮、说明卡片和反馈表单起始字段。
- PR #15 已合并到 `codex/room-render-production-minimum`，merge commit `7a4938b`。
- Render free 环境部署后，`GET https://ai-werewolf-free.onrender.com/alpha-report`：HTTP 200，页面包含 `反馈模板`、`复制反馈文本` 和 `不会上传到服务器`。
- `GET https://ai-werewolf-free.onrender.com/alpha-playtest`：HTTP 200，页面包含 `/alpha-report` 和 `试玩说明`。
- `GET https://ai-werewolf-free.onrender.com/api/rooms/health`：`ok=true`、`deployment.productionMinimumReady=true`、`realtime=postgres-notify`。
- `$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run preflight:production`：通过，26 项检查全部 passed。

### 未解决风险

- `/alpha-report` 不是在线表单，不会自动汇总反馈。
- 仍未替代真实手机和电脑的完整人工试玩。

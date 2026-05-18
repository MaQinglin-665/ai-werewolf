# 阶段二：真实试玩闭环

## 状态

- 工作线：`multiplayer` / `docs` / `verification`
- 状态：`done`
- 建议分支：`codex/phase-two-playtest`
- 主线程负责人：Codex

## 背景

阶段一已经完成 Render 公网部署、`/alpha-health` 健康面板、生产 preflight、房间 SSE smoke 和带投票的 Alpha smoke。阶段二不继续堆玩法功能，而是把“可以发给朋友试玩”的最小交付闭环补齐。

## 目标

- 提供一个公开浏览器页面，让朋友知道从哪里进入、如何加入、如何验证一局是否跑通。
- 提供维护者文档，记录小范围试玩的链接、步骤、验收清单、已知限制和反馈模板。
- 保持房间业务逻辑不变，只补低风险入口和文档。
- 用公开 Render URL 继续跑生产 preflight 和房间 smoke。

## 上下文包

请先读取：

- `docs/working-agreements.md`
- `docs/threads/docs.md`
- `docs/threads/frontend.md`
- `docs/tasks/2026-05-room-render-production-minimum.md`
- `docs/production-minimum.md`
- `docs/render-deploy.md`
- `docs/alpha-playtest.md`

## 允许修改

- `docs/**`
- `src/app/alpha-playtest/**`
- `src/app/alpha-health/page.tsx`

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
- 用户可感知变化：新增 `/alpha-playtest` 公开试玩说明页，`/alpha-health` 增加试玩说明入口。

## 验收

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- 浏览器或 HTTP 验证 `/alpha-playtest` 可访问。
- 公网运行：
  - `$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run preflight:production`
  - `$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run smoke:room-sse`
  - `$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run smoke:alpha:vote`

## 完成记录

### 完成内容

- 新增 `/alpha-playtest` 公开试玩说明页，包含朋友入口、发送前确认、房主步骤、朋友步骤、验收清单、已知限制和反馈模板。
- 新增 `docs/alpha-playtest.md`，把小范围朋友试玩流程和维护者 smoke 命令固定下来。
- 在 `/alpha-health` 顶部增加“试玩说明”入口，让部署健康检查和朋友试玩说明相互可达。
- 更新部署/生产文档，把阶段一后的下一步从 smoke 过渡到阶段二真实试玩闭环。

### 修改文件

- `docs/alpha-playtest.md`
- `docs/production-minimum.md`
- `docs/render-deploy.md`
- `docs/README.md`
- `docs/tasks/2026-05-phase-two-playtest.md`
- `src/app/alpha-health/page.tsx`
- `src/app/alpha-playtest/page.tsx`

### 验证结果

- `npm run lint`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run build`：通过；`/alpha-playtest` 被标记为动态服务端页面。仍有既有 Turbopack NFT trace 警告，路径为 `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/[roomId]/view/route.ts`。
- 本地生产服务 `http://127.0.0.1:3014/alpha-playtest`：HTTP 200，HTML 包含 `试玩说明`、`/rooms`、`验收清单` 和 `smoke:alpha:vote`。
- 本地生产服务 `http://127.0.0.1:3014/alpha-health`：HTTP 200，HTML 包含 `/alpha-playtest` 和 `Alpha 健康面板`。
- Chrome headless 390px 宽度渲染检查：页面首屏可见标题、联机房间按钮、健康面板按钮、朋友链接、发送前确认和房主步骤。
- 公网部署后验证待回填。

### 未解决风险

- 自动 smoke 可以覆盖多席位流程，但仍不能完全替代真实手机和电脑的人工体验。
- 免费 Render 冷启动仍会影响首次访问体感。

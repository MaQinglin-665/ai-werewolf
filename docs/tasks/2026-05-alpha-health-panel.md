# Alpha 健康面板

## 状态

- 工作线：`multiplayer` / `verification`
- 状态：`done`
- 建议分支：`codex/alpha-health-panel`
- 主线程负责人：Codex

## 背景

Render 冷启动或线上部署异常时，直接访问业务页面容易误判为“数据面板坏了”或“房间数据丢了”。项目已有 `/api/rooms/health`、生产 preflight 和 smoke 命令，但缺一个独立浏览器入口，把线上 Alpha 的运行状态、部署约束和下一条验证命令集中展示出来。

## 目标

- 新增只读 `/alpha-health` 页面。
- 复用现有 `getRoomRuntimeStatus()`，不新增房间状态写入。
- 显示部署模式、生产最小闭环状态、存储、实时通道、presence、限流、房间数量和清理结果。
- 根据当前 public origin / 访问 origin 给出下一条 smoke 命令。
- 给页面辅助逻辑补 focused tests。

## 上下文包

请先读取：

- `docs/optimization-workflow.md`
- `docs/working-agreements.md`
- `docs/threads/parallel-workstreams.md`
- `docs/threads/multiplayer.md`
- `docs/threads/verification.md`
- `docs/tasks/2026-05-alpha-health-panel.md`
- `src/server/roomService.ts`
- `src/app/api/rooms/health/route.ts`

## 允许修改

- `docs/tasks/2026-05-alpha-health-panel.md`
- `docs/render-deploy.md`
- `docs/production-minimum.md`
- `docs/README.md`
- `src/app/alpha-health/**`

## 不允许修改

- `.env`、真实密钥、数据库文件和生成缓存。
- `src/game/**`
- `src/ai/**`
- `src/components/GameClient.tsx`
- `src/components/RoomClient.tsx`
- `src/server/roomService.ts`
- 现有房间 API 行为。

## 影响面

- 状态结构：无。
- API 响应：无。
- 环境变量：无。
- 持久化数据：无。
- 用户可感知变化：新增 `/alpha-health` 只读运维入口，便于判断 Render/公网 Alpha 是否真正可用。

## 建议步骤

1. 先确认现有 `/api/rooms/health` 返回结构和生产 preflight 命令。
2. 新增页面和纯函数 helper。
3. 补 helper tests。
4. 跑 focused test、TypeScript 和 lint。

## 验收

- `npm run test -- src/app/alpha-health/healthPanel.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- 浏览器或 HTTP 验证 `/alpha-health` 可访问。

不能运行的命令必须说明原因和替代验证。

## 完成记录

### 完成内容

- 新增 `/alpha-health` 只读页面，直接复用 `getRoomRuntimeStatus()` 展示当前 Alpha/生产化健康状态。
- 页面展示部署模式、生产最小闭环、房间数、存储/同步、presence、限流、清理状态、部署要求和告警。
- 根据 `deployment.publicOrigin` 或当前请求来源生成下一条 smoke 命令。
- 抽出 `healthPanel.ts` 纯函数，覆盖 readiness 文案、smoke 命令、部署要求计数和时长格式化。
- 修复窄屏长 smoke 命令导致的横向溢出。
- 部署文档改为优先打开 `/alpha-health`，再按页面或文档执行生产 preflight / room SSE smoke。

### 修改文件

- `docs/tasks/2026-05-alpha-health-panel.md`
- `docs/render-deploy.md`
- `docs/production-minimum.md`
- `docs/README.md`
- `src/app/alpha-health/healthPanel.ts`
- `src/app/alpha-health/healthPanel.test.ts`
- `src/app/alpha-health/page.tsx`

### 验证结果

- `npm run test -- src/app/alpha-health/healthPanel.test.ts`：通过，1 个测试文件、4 个测试通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。
- `npm run build`：通过；`/alpha-health` 被标记为动态服务端页面。仍有既有 Turbopack NFT trace 警告，路径为 `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/health/route.ts`。
- `Invoke-WebRequest http://127.0.0.1:3003/alpha-health`：HTTP 200，HTML 包含 `Alpha 健康面板` 和 `下一条验证命令`。
- Browser 桌面视口打开 `http://127.0.0.1:3003/alpha-health`：标题、验证命令和 `HEALTH OK` 可见；无横向溢出；无 console warning/error；截图 `tmp/alpha-health-desktop.png`。
- Browser 390px 移动视口：标题和验证命令可见；`scrollWidth=clientWidth=375`，无横向溢出；无 console warning/error；截图 `tmp/alpha-health-mobile-390.png`。
- 临时 production server `http://127.0.0.1:3012/alpha-health`：HTTP 200，HTML 包含 `Alpha 健康面板` 和 `下一条验证命令`；`/api/rooms/health` 返回 `ok=true`、`deployment=single-node`、`storage=local-json`、`productionMinimumReady=false`。
- Browser production 页面验证：标题、验证命令和 `HEALTH OK` 可见；无横向溢出；无 console warning/error；截图 `tmp/alpha-health-production-3012.png`。

### 未解决风险

- 尚未对真实 Render 公网 URL 运行 `preflight:production`、`smoke:room-sse` 或 `smoke:alpha`。
- 面板只显示健康状态和推荐命令，不替代真实双设备多人房间 smoke。

### 下一步建议

- 部署到 Render 后先打开 `/alpha-health` 确认生产最小闭环状态，再执行页面给出的 smoke 命令。

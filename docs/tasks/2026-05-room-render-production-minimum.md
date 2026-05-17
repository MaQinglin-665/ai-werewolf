# 房间 Render 生产最小闭环

## 状态

- 工作线：`multiplayer`
- 状态：`done`
- 建议分支：`codex/room-render-production-minimum`
- 主线程负责人：Codex

## 背景

多人房间已经可以本地创建、加入、开局和通过 SSE 同步。为了让朋友通过公网链接试玩，需要从本地单机/局域网推进到一个可部署的生产最小闭环：固定 HTTPS origin、PostgreSQL 房间状态、共享 presence、共享限流、跨进程房间事件通知，以及长驻 Node 运行时。

本任务选择 Render Blueprint 作为首个可执行托管路径，同时保留 Docker/VPS 可用性。

## 目标

- 让房间运行时支持 PostgreSQL-backed room state。
- 让房间更新通过 PostgreSQL `LISTEN/NOTIFY` 做跨进程 fanout。
- 让在线 presence 和房间 API rate limit 使用 PostgreSQL 共享状态。
- 提供生产环境变量模板、静态检查脚本和部署后 preflight。
- 提供 Dockerfile、`start:production` 和 Render Blueprint。
- 保持浏览器端 room SSE 协议不变。

## 上下文包

请先读取：

- `docs/working-agreements.md`
- `docs/threads/multiplayer.md`
- `docs/tasks/2026-05-room-render-production-minimum.md`
- `docs/production-minimum.md`
- `docs/render-deploy.md`
- `.env.production.example`
- `scripts/room-production-preflight.mjs`
- `render.yaml`

## 允许修改

- `.env.example`
- `.env.production.example`
- `.gitignore`
- `.dockerignore`
- `Dockerfile`
- `render.yaml`
- `package.json`
- `package-lock.json`
- `docs/production-minimum.md`
- `docs/render-deploy.md`
- `docs/tasks/2026-05-room-render-production-minimum.md`
- `scripts/room-production-env-check.mjs`
- `scripts/room-production-preflight.mjs`
- `scripts/room-postgres-production-smoke.ps1`
- `scripts/start-production.mjs`
- `src/server/roomRateLimit.ts`
- `src/server/roomService.ts`

## 不允许修改

- `.env`、真实密钥、真实数据库 URL。
- `src/ai/**`、`src/game/**`、房间 UI。
- 宣传素材、视频产物和其他并行 workstream 文件。

## 影响面

- 状态结构：房间 session、presence、rate limit 新增 PostgreSQL 表，由运行时按需创建。
- API 响应：`/api/rooms/health` 暴露 PostgreSQL adapter、生产 readiness 和 Render public origin 状态。
- 环境变量：新增 PostgreSQL room runtime、Render/Docker 生产启动相关变量。
- 持久化数据：房间状态从本地 JSON/in-memory 可切换到 PostgreSQL；现有 Prisma datasource 仍为 SQLite。
- 用户可感知变化：部署到公网后，玩家可以通过固定 HTTPS 链接进入 `/rooms` 联机房间。

## 验收

- `npm run check:production-env`
- `npm run smoke:production:postgres -- -DatabaseUrl "<postgres-url>" -SkipInstall -SkipBuild -SkipPrismaGenerate`
- `docker build -t ai-werewolf-prod-smoke .`
- 容器启动后访问 `/api/rooms/health`，确认 `storage/realtime/presence/rateLimit` 均为 PostgreSQL 模式。
- `npm run test -- src/app/api/rooms/api.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run lint`

部署后：

- `$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run preflight:production`
- `$env:ROOM_SMOKE_BASE_URL="https://your-service.onrender.com"; npm run smoke:room-sse`

## 完成记录

### 完成内容

- 新增 PostgreSQL room store、PostgreSQL realtime fanout、PostgreSQL presence 和 PostgreSQL rate limit 路径。
- 新增 `preflight:production`、`check:production-env`、`smoke:production:postgres` 和 `start:production`。
- 新增 `.env.production.example`，明确生产房间 PostgreSQL URL 不应填入当前 SQLite Prisma 的 `DATABASE_URL`。
- 新增 `Dockerfile` 和 `.dockerignore`，镜像内安装 OpenSSL/CA 证书并通过 `npm run start:production` 启动。
- 新增 `render.yaml`，Render Blueprint 创建 Docker Web Service 和 Render PostgreSQL。
- 支持 Render `RENDER_EXTERNAL_URL` 作为首次部署默认公网 origin；自定义域名后可显式设置 `AI_WEREWOLF_PUBLIC_ORIGIN`。
- 新增 `docs/production-minimum.md` 和 `docs/render-deploy.md`。

### 修改文件

- `.env.example`
- `.env.production.example`
- `.gitignore`
- `.dockerignore`
- `Dockerfile`
- `render.yaml`
- `package.json`
- `package-lock.json`
- `docs/production-minimum.md`
- `docs/render-deploy.md`
- `docs/tasks/2026-05-room-render-production-minimum.md`
- `scripts/room-production-env-check.mjs`
- `scripts/room-production-preflight.mjs`
- `scripts/room-postgres-production-smoke.ps1`
- `scripts/start-production.mjs`
- `src/server/roomRateLimit.ts`
- `src/server/roomService.ts`

### 验证结果

- `npm run smoke:production:postgres -- -DatabaseUrl "postgresql://ai_werewolf:ai_werewolf_dev_password@127.0.0.1:55432/ai_werewolf?sslmode=disable" -Port 3011 -SkipInstall -SkipBuild -SkipPrismaGenerate`：通过。
- `npm run check:production-env`：在模拟生产变量和 `RENDER_EXTERNAL_URL` 模式下通过。
- `docker build -t ai-werewolf-prod-smoke .`：通过。
- Docker 容器使用 `host.docker.internal:55432` 连接本机 PostgreSQL，`GET /api/rooms/health` 返回 `storage=postgres-room-store`、`realtime=postgres-notify`、`presence=postgres`、`rateLimit=postgres`。
- `npm run test -- src/app/api/rooms/api.test.ts`：通过，`18 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run lint`：通过。

### 未解决风险

- Render 真实部署尚未执行，仍需连接 GitHub 仓库后跑公网 `preflight:production` 和 `smoke:room-sse`。
- 当前 Prisma datasource 仍为 SQLite；房间运行时已用 PostgreSQL，但单人游戏历史/AI call logs 仍不是托管 PostgreSQL。
- SSE 连接仍由 Node 进程持有；首轮公网测试建议保持一个 Web Service 实例。
- 默认 mock AI 适合基础设施 smoke；切真实模型后还需要额外验证延迟、失败率和成本。

### 下一步建议

- 只提交本任务列出的生产化文件，避免混入 AI/UI/宣传素材 workstream。
- 推到 GitHub 后在 Render 使用 `New Blueprint` 部署。
- 首次部署成功后，用 Render 默认 `*.onrender.com` 跑 preflight 和 room SSE smoke。
- 绑定自定义域名后，设置 `AI_WEREWOLF_PUBLIC_ORIGIN`，重新跑同一组 smoke。

# 任务卡：修复单机游戏流式推进端点

## 背景

Harness 前端只读 smoke 在单机 6 人局中验证到：

- 首页可打开。
- 可进入牌桌。
- 可确认身份。
- 狼人夜刀可提交。
- 自动推进到预言家查验阶段后失败。

页面提示 `流式推进失败。`，本地 dev server 记录：

```text
POST /api/games/{gameId}/commands 200
POST /api/games/{gameId}/commands/stream 404
```

源码中存在 `src/app/api/games/[gameId]/commands/stream/route.ts`，但实际浏览器路径返回 404。

## 目标

让单机游戏的自动推进主路径可以调用 `/api/games/[gameId]/commands/stream`，并通过测试保护该端点不会再次从 API 覆盖中消失。

## 范围

- 检查并修复 stream command route 的可访问性或客户端回退策略。
- 给 `src/app/api/games/api.test.ts` 添加最小回归测试。
- 复跑 harness check、相关 API 测试、必要的浏览器 smoke。

## 不做

- 不重构整套单机游戏推进逻辑。
- 不改 AI 策略、角色规则或 UI 视觉。
- 不处理线上部署。

## 验收

- `POST /api/games/{gameId}/commands/stream` 对合法 `continue` 请求返回 `text/event-stream`。
- 浏览器从首页进入 6 人新手局后，狼人夜刀后自动推进不再卡在 404。
- `npm run harness:check` 通过。
- `npm run test -- src/app/api/games/api.test.ts` 通过。

## 执行记录

结论：`commands/stream` 的 route handler 本身可用；重启 dev server 后直接 POST 返回 `200 text/event-stream`。原失败更像 Next dev/Turbopack 路由发现或缓存导致的临时 404。为避免玩家主流程被这类环境问题卡死，客户端现在会在 stream endpoint 非 2xx 或无 body 时回退到普通 `/commands` continue。

改动：

- 新增 `src/components/game/streamingContinue.ts`，从 `GameClient` 抽出 stream continue 请求逻辑。
- 新增客户端回退测试 `src/components/game/streamingContinue.test.ts`。
- 在 `src/app/api/games/api.test.ts` 增加 stream route SSE 回归覆盖。

验证：

- `npm run test -- src/components/game/streamingContinue.test.ts`
- `npm run test -- src/app/api/games/api.test.ts`
- `npm run test -- src/components/game/streamingContinue.test.ts src/app/api/games/api.test.ts`
- `npm run harness:check`
- `npx tsc --noEmit`
- `npm run lint`
- 浏览器 smoke：进入 6 人新手局，确认身份，提交预言家查验后成功进入 `第 1 天 / 白天发言`。

# Alpha 反馈与观测闭环

阶段三用于在真实长时间双端试玩之前，先把问题收集、线上状态检查和修复优先级固定下来。目标不是扩大公测，而是保证后续每一次朋友试玩都能留下可处理的信息。

## 公开入口

- 主试玩说明：https://175.178.199.245/alpha-playtest
- 主反馈模板：https://175.178.199.245/alpha-report
- 主健康面板：https://175.178.199.245/alpha-health
- 主联机房间：https://175.178.199.245/rooms
- 备用镜像：https://ai-werewolf-free.onrender.com

`/alpha-report` 只在浏览器本地生成可复制文本，不提交数据、不保存浏览器指纹、不写入数据库。玩家把复制出来的文本发给维护者即可。

## 反馈分级

- P0 阻塞：打不开、进不了房、开不了局、行动提交失败、刷新后完全丢身份。
- P1 严重：可以绕过，但明显影响试玩，例如邀请链接不明确、手机按钮难点、错误提示无法指导下一步。
- P2 体验：不阻塞流程，但影响理解或观感，例如文案不够清楚、布局拥挤、阶段提示不够明显。

阶段三只承诺修 P0/P1。P2 先记录，合并到后续体验打磨阶段。

## 每次试玩前检查

```powershell
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run preflight:production
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-sse
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:alpha:vote
```

同时打开主链路 `/alpha-health`，确认：

- `productionMinimumReady=true`
- `storage=postgres-room-store`
- `realtime=postgres-notify`
- `presence=postgres shared=true`
- `rateLimit=postgres shared=true`

## 维护者排障顺序

1. 先确认 `/alpha-health` 是否健康，排除 Render 冷启动或部署异常。
2. 如果玩家说“链接打不开”，先看是否是首次冷启动、浏览器拦截或网络问题。
3. 如果玩家说“进不了房”，记录房间码、玩家座位、加入方式和页面提示。
4. 如果玩家说“按钮没反应”，记录阶段、当前行动面板、是否是自己的回合。
5. 如果玩家说“刷新后丢了”，记录是否使用自己的恢复链接，以及是否跨浏览器/无痕模式。
6. 对 P0/P1 建一个小修复任务；每次只修一个明确问题并跑 smoke。

## 修复验收

每个 P0/P1 修复至少需要：

- 本地或公网复现路径说明。
- 修复说明。
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- 相关 focused test 或 smoke。
- 公网问题必须补 `$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:alpha:vote`

## 当前仍未替代的事项

- `/alpha-report` 不是在线表单，不会自动汇总反馈。
- 仍需要真实手机和电脑完成一次人工流程，才能判断页面体感。
- 免费 Render 冷启动仍会造成首次访问慢。

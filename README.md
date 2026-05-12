# 单人 AI 狼人杀

一个本地可玩的 `9 人预女猎` MVP：1 个真人玩家和 8 个 mock AI 玩家进行完整狼人杀对局。

## 当前能力

- 固定板子：3 狼人、3 平民、预言家、女巫、猎人。
- 真人身份随机，首版只做单真人局。
- 规则引擎负责状态机、合法动作、女巫药品、猎人开枪和屠边胜负。
- mock AI 可自动推进非真人阶段，支持 1000 局模拟测试。
- Prisma + SQLite 持久化当前快照、座位、事件日志和 AI 调用记录。
- Next.js 页面提供本地牌桌 UI。

## 本地运行

```bash
npm install
npm run prisma:generate
npm run db:push
npm run dev
```

打开 http://localhost:3000 进入牌桌。

## 常用命令

```bash
npm run test
npm run lint
npm run build
```

## API

- `POST /api/games` 创建新局。
- `GET /api/games/:gameId` 获取真人玩家的脱敏视角。
- `POST /api/games/:gameId/commands` 提交真人玩家当前动作。

## 下一步

真实 LLM 暂未接入。下一步应在 `src/ai` 内新增 OpenAI-compatible adapter，并继续让规则引擎校验所有动作。

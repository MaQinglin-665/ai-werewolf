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

## 本地试玩流程

1. 点击“进入牌桌”创建一局 9 人预女猎。
2. 按当前阶段完成你的动作：夜刀、查验、用药、发言、投票或猎人开枪。
3. 其他 8 个 AI 会自动行动，对局会推进到下一次需要你操作的位置。
4. 终局后查看复盘，确认身份、夜晚行动、投票和胜负原因。
5. 点击“新开一局”继续测试不同身份视角。

## 当前规则边界

- 只支持单真人局，不支持多真人、匹配、账号和语音。
- 固定 9 人预女猎板子，暂不支持警长、上警、守卫、白痴或复杂板子。
- 胜负采用屠边：狼人全出局则好人胜，平民或神职全出局则狼人胜。
- 女巫采用简化规则：可自救，每晚最多用一瓶药，毒死猎人不可开枪。
- AI 动作仍由本地策略控制；可选真实 LLM 只用于白天发言。

## AI 发言模式

默认使用本地 mock 发言，不需要 API key。若要试用 LLM 发言：

```bash
AI_SPEECH_PROVIDER="openai"
OPENAI_API_KEY="你的 API Key"
OPENAI_MODEL="gpt-4.1-mini"
```

LLM 只会收到当前 AI 玩家允许知道的信息，并且只能返回公开发言文本。

## 常用命令

```bash
npm run test
npm run lint
npm run build
```

## Alpha 验收清单

- 功能分支：`codex/alpha-playable-loop`。
- 本地入口：启动后打开 http://localhost:3000。
- 当前已覆盖：终局复盘、AI persona、mock/openai 发言 provider、最近对局入口、阶段化操作区。
- 推荐验收：至少试玩狼人、预言家、女巫、猎人、平民各一局，确认未终局时不会暴露其他玩家身份。

## API

- `POST /api/games` 创建新局。
- `GET /api/games/:gameId` 获取真人玩家的脱敏视角。
- `POST /api/games/:gameId/commands` 提交真人玩家当前动作。

## 下一步

继续打磨 AI 票型、怀疑值和复盘解释。规则引擎仍是唯一裁判，AI 输出永远需要校验。

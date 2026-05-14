# 单人 AI 狼人杀

一个本地可玩的单人 AI 狼人杀 MVP：1 个真人玩家和 8/11 个 AI 玩家进行完整狼人杀对局。

## 当前能力

- 可选板子：9 人预女猎，或 12 人预女猎守卫警长局。
- 真人身份随机，首版只做单真人局。
- 规则引擎负责状态机、合法动作、女巫药品、猎人开枪、警徽流转和屠边胜负。
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

1. 选择板子，点击“进入牌桌”创建一局。
2. 按当前阶段完成你的动作：夜刀、查验、用药、发言、投票或猎人开枪。
3. 其他 8 个 AI 会自动行动，对局会推进到下一次需要你操作的位置。
4. 终局后查看复盘，确认身份、夜晚行动、投票和胜负原因。
5. 点击“新开一局”继续测试不同身份视角。

## 当前规则边界

- 只支持单真人局，不支持多真人、匹配和账号；语音输入仅覆盖真人发言/遗言草稿。
- 支持 9 人预女猎和 12 人预女猎守卫警长局，暂不支持白痴、骑士或更多复杂板子。
- 胜负采用屠边：狼人全出局则好人胜，平民或神职全出局则狼人胜。
- 女巫采用简化规则：可自救，每晚最多用一瓶药，毒死猎人不可开枪；12 人局守卫同守同救会死亡。
- AI 默认使用本地策略；也可开启真实 LLM 发言和行动决策，规则引擎负责合法性校验。

## AI 发言模式

默认使用本地 mock 发言，不需要 API key。若要试用 LLM 发言：

```bash
AI_SPEECH_PROVIDER="openai"
AI_ACTION_PROVIDER="openai"
OPENAI_API_KEY="你的 API Key"
OPENAI_MODEL="gpt-4.1-mini"
```

`AI_ACTION_PROVIDER="openai"` 会让 LLM 在合法候选动作中决定夜刀、查验、用药、投票和猎人开枪；规则引擎仍然负责校验和兜底。
LLM 只会收到当前 AI 玩家允许知道的信息，并且只能返回受约束的发言或动作选择。

发言约束可用 `AI_SPEECH_STRICTNESS` 调整：

- `guided`：默认模式。`speechPlan` 只是桌面读法，LLM 可以临场换焦点、起跳、藏身份或反打；引擎只拦截隐藏信息泄露、真实预言家改报查验、狼人把队友报查杀等硬边界。
- `strict`：旧模式。LLM 必须严格照 `speechPlan` 发言，适合做稳定回归测试。
- `loose`：更强调自然博弈感，提示词会鼓励更大胆的语气和临场转向，但硬边界仍然保留。

若要让 8 个 AI 分别使用同名模型，把 `.env` 设为：

```bash
AI_LLM_PROVIDER="models"
AI_LLM_BASE_URL="你的 OpenAI-compatible 网关"
AI_LLM_API_KEY="你的通用网关 Key"
MIMO_LLM_API_KEY="你的 tp- Mimo Key"
ARK_API_KEY="你的火山方舟 Key"
KIMI_API_KEY="你的 Moonshot Key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
```

默认映射为 DeepSeek、Claude、GPT、豆包、Mimo、Gemini、GLM、Kimi，可用 `AI_MODEL_*` 或对应的 `*_MODEL` 环境变量覆盖具体模型名。Mimo 如果使用 `tp-` key 且未设置 `MIMO_LLM_BASE_URL`，会自动走 Token Plan 的 Mimo 域名；豆包和 GLM 如果设置了 `ARK_API_KEY`，会优先走火山方舟 Ark；Kimi 如果设置了 `KIMI_API_KEY`，会优先走 Moonshot 官方 OpenAI-compatible 接口。

为保证真实模型输出稳定，LLM 结果会先做 JSON 提取和轻量修复；仍不合格时会带上失败原因重试，最后才回退到本地策略。可用 `AI_LLM_MAX_RETRIES` 控制失败后的重试次数，默认 `1` 次；行动默认温度更低，可用 `AI_LLM_ACTION_TEMPERATURE` 和 `AI_LLM_SPEECH_TEMPERATURE` 分别调节。
行动决策会先尝试当前 persona 的模型与备用模型；如果上游失败，还会按 `AI_LLM_ACTION_FALLBACK_PERSONAS` 尝试其他 persona 的行动模型，默认 `GPT,Claude,GLM`，再回退到本地策略。GPT 默认备用模型包含 `gpt-5.5`。

## 语音输入

真人发言和遗言输入区支持浏览器语音输入。点击“语音输入”后允许麦克风权限，说完点击“停止录音”；识别结果会先填入草稿，再由服务端结合当前桌面语境整理成可发送发言。系统不会自动提交，确认前仍可手动编辑。

语音转文字使用浏览器 Web Speech API，优先在 Chrome / Edge 验收。语义整理复用 `AI_LLM_*` 路由；没有可用 LLM key 或整理失败时，页面会保留浏览器原始转写草稿。可用 `VOICE_INPUT_MAX_TRANSCRIPT_CHARS`、`VOICE_INPUT_REWRITE_PERSONA` 和 `VOICE_INPUT_REWRITE_TEMPERATURE` 调整整理限制和模型风格。

## 主持音频

流程播报使用固定本地音频，不使用浏览器 TTS。把授权后的 `mp3` 文件放到 `public/audio/host/`，文件名见该目录的 README。页面顶部的“主持音频”开关会按流程播放对应片段；缺失的片段会被静默跳过，不影响游戏。

也可以用 OpenAI TTS 离线生成一次：

```bash
npm run audio:host
```

或使用 Mimo TTS：

```bash
npm run audio:host -- --provider=mimo
```

脚本会读取 `.env` 中的 `OPENAI_API_KEY`、`OPENAI_TTS_MODEL`、`OPENAI_TTS_VOICE`，或 Mimo 的 `MIMO_API_KEY`、`MIMO_TTS_BASE_URL`、`MIMO_TTS_MODEL`、`MIMO_TTS_VOICE`、`MIMO_TTS_FORMAT`、`MIMO_TTS_STYLE`。`tp-` 开头的 Mimo key 会自动使用 Token Plan 域名。生成后运行时只播放本地 mp3/wav。

Mimo 默认使用 `mimo-v2.5-tts`。试音时可以临时覆盖：

```bash
npm run audio:host -- --provider=mimo --only=night-wolves --force --voice=mimo_default --style="低沉 悬疑 变慢"
```

AI 发言音频在游戏里按需生成并缓存到 `public/audio/ai-speech/`，缓存文件已加入 git 忽略。打开页面右上角 `AI 语音` 后，每条 AI 发言会走 Mimo TTS，并等音频播放完再推进流程。每个 AI 的声音档案在 `src/ai/voiceProfiles.ts`，可用 `.env` 里的 `MIMO_AI_VOICE_*` 覆盖对应 Mimo voice；节奏、情绪和断句由每个档案的 `style` 与提示词固定控制。

## 常用命令

```bash
npm run test
npm run lint
npm run build
npm run audio:host -- --dry-run
npm run simulate:ai
```

## Alpha 验收清单

- 功能分支：`codex/alpha-playable-loop`。
- 本地入口：启动后打开 http://localhost:3000。
- 当前已覆盖：终局复盘、AI persona、多模型发言/行动 provider、最近对局入口、阶段化操作区、主持/AI 发言音频、真人发言语音草稿。
- 推荐验收：至少试玩狼人、预言家、女巫、猎人、平民各一局；12 人局补跑守卫和警长流程，确认未终局时不会暴露其他玩家身份。

## API

- `POST /api/games` 创建新局。
- `GET /api/games/:gameId` 获取真人玩家的脱敏视角。
- `POST /api/games/:gameId/commands` 提交真人玩家当前动作。
- `POST /api/games/:gameId/voice-input` 将真人语音转写整理为发言/遗言草稿，不推进游戏状态。

## 下一步

继续打磨 AI 票型、怀疑值和复盘解释。规则引擎仍是唯一裁判，AI 输出永远需要校验。

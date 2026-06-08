# 主持音频包

这里放固定的狼人杀主持音频。运行时文件名使用中文朗读内容，例如 `天黑请闭眼-狼人请睁眼-请选择今晚的击杀目标.mp3`。

代码里仍使用稳定逻辑 key，例如 `night-wolves`、`seat-1`，再通过 `src/components/game/hostAudioFiles.ts` 映射到中文文件名。这样业务逻辑不用直接依赖中文长文件名。

前端会优先尝试 `mp3`，缺失时尝试同名 `wav`。

## 重新生成

可以用 OpenAI TTS 离线生成一次：

```bash
npm run audio:host
```

也可以用 Mimo TTS：

```bash
npm run audio:host -- --provider=mimo
```

Mimo 当前推荐先试 `mimo-v2.5-tts`。可以临时覆盖模型、音色和风格：

```bash
npm run audio:host -- --provider=mimo --model=mimo-v2.5-tts --voice=mimo_default --style="低沉 悬疑 变慢"
```

只预览文件清单：

```bash
npm run audio:host -- --dry-run
npm run audio:host -- --provider=mimo --dry-run
```

重新覆盖已有音频：

```bash
npm run audio:host -- --force
```

只生成指定片段时仍使用逻辑 key：

```bash
npm run audio:host -- --only=night-wolves,seat-1,speak
```

脚本读取 `.env` 里的 `OPENAI_API_KEY`、`OPENAI_TTS_MODEL`、`OPENAI_TTS_VOICE`，或 Mimo 的 `MIMO_API_KEY`、`MIMO_TTS_BASE_URL`、`MIMO_TTS_MODEL`、`MIMO_TTS_VOICE`、`MIMO_TTS_FORMAT`、`MIMO_TTS_STYLE`。`tp-` 开头的 Mimo key 会自动使用 Token Plan 域名。生成完之后，游戏运行时只播放本地文件，不会实时调用 TTS。

默认不会把 `MIMO_TTS_STYLE` 写进待朗读文本，避免模型把风格要求念出来。只有明确设置 `MIMO_TTS_USE_STYLE_TAG=true` 或传入 `--style-tag` 时，才会使用 `<style>...</style>` 形式。

## 当前文件名

- `天黑请闭眼-狼人请睁眼-请选择今晚的击杀目标.mp3`
- `狼美人请睁眼-请选择今晚魅惑的玩家-也可以选择不魅惑.mp3`
- `守卫请睁眼-请选择一名玩家守护-也可以选择空守.mp3`
- `预言家请睁眼-请选择一名玩家查验身份.mp3`
- `女巫请睁眼-请确认昨夜刀口-选择是否使用药品.mp3`
- `天亮了-公布昨夜情况.mp3`
- `昨夜平安夜.mp3`
- `昨夜死亡的是.mp3`
- `死亡.mp3`
- `开始白天发言.mp3`
- `请.mp3`
- `发言.mp3`
- `请发言.mp3` / `请发言.wav`
- `警长竞选开始-所有存活玩家选择是否上警.mp3`
- `轮到你选择是否上警.mp3`
- `请选择是否上警.mp3`
- `选择上警.mp3`
- `无人选择上警-本局没有产生警长.mp3`
- `警上发言开始.mp3`
- `轮到你发表警长竞选发言.mp3`
- `请发表警长竞选发言.mp3`
- `进入退水阶段-警上候选人依次选择是否退水.mp3`
- `选择退水.mp3`
- `进入警长投票阶段-警下玩家开始投票.mp3`
- `警长投票平票-进入PK发言.mp3`
- `轮到你发表警长PK发言.mp3`
- `请发表警长PK发言.mp3`
- `进入警长PK复投.mp3`
- `警徽移交窗口开启.mp3`
- `轮到你选择移交警徽或撕掉警徽.mp3`
- `请选择移交警徽或撕掉警徽.mp3`
- `投票.mp3`
- `进入投票阶段.mp3`
- `公布票数.mp3`
- `平票-今日无人放逐.mp3`
- `被放逐出局.mp3`
- `白痴翻牌免死-失去投票权.mp3`
- `被猎人带走.mp3` / `被猎人带走.wav`
- `被狼王带走.mp3`
- `白狼王自爆.mp3`
- `被白狼王带走.mp3`
- `狼美人出局-触发魅惑.mp3`
- `殉情出局.mp3`
- `请发表遗言.mp3` / `请发表遗言.wav`
- `猎人进入开枪窗口.mp3`
- `猎人出局-轮到你选择是否开枪.mp3`
- `狼王进入开枪窗口.mp3`
- `狼王出局-轮到你选择是否开枪.mp3`
- `骑士进入决斗窗口.mp3`
- `轮到你选择是否发动骑士决斗.mp3`
- `骑士决斗成功.mp3`
- `骑士决斗失败-骑士出局.mp3`
- `被骑士决斗带走.mp3`
- `轮到你发言.mp3`
- `轮到你投票.mp3`
- `好人阵营获胜.mp3`
- `狼人阵营获胜.mp3`
- `流程继续推进.mp3`
- `1号.mp3` 到 `12号.mp3`

请只放入自己录制、购买授权、或明确允许在项目中使用的音频。

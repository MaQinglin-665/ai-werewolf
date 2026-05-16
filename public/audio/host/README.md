# 主持音频包

这里放固定的狼人杀主持音频。文件使用 `mp3` 或 `wav`。前端会优先尝试 `mp3`，缺失时尝试同名 `wav`。

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

只生成指定片段：

```bash
npm run audio:host -- --only=night-wolves,seat-1,speak
```

脚本读取 `.env` 里的 `OPENAI_API_KEY`、`OPENAI_TTS_MODEL`、`OPENAI_TTS_VOICE`，或 Mimo 的 `MIMO_API_KEY`、`MIMO_TTS_BASE_URL`、`MIMO_TTS_MODEL`、`MIMO_TTS_VOICE`、`MIMO_TTS_FORMAT`、`MIMO_TTS_STYLE`。`tp-` 开头的 Mimo key 会自动使用 Token Plan 域名。生成完之后，游戏运行时只播放本地文件，不会实时调用 TTS。

默认不会把 `MIMO_TTS_STYLE` 写进待朗读文本，避免模型把风格要求念出来。只有明确设置 `MIMO_TTS_USE_STYLE_TAG=true` 或传入 `--style-tag` 时，才会使用 `<style>...</style>` 形式。

需要的基础片段：

- `night-wolves.mp3` / `night-wolves.wav`：天黑请闭眼，狼人请睁眼，选择今晚击杀目标
- `night-wolf-beauty.mp3` / `night-wolf-beauty.wav`：狼美人请睁眼，选择魅惑目标或跳过
- `night-guard.mp3` / `night-guard.wav`：守卫请睁眼，选择守护目标或空守
- `night-seer.mp3` / `night-seer.wav`：预言家请睁眼，选择查验目标
- `night-witch.mp3` / `night-witch.wav`：女巫请睁眼，确认刀口并选择是否用药
- `dawn-report.mp3` / `dawn-report.wav`：天亮了，公布昨夜情况
- `dawn-peaceful.mp3` / `dawn-peaceful.wav`：昨夜平安夜
- `dawn-deaths.mp3` / `dawn-deaths.wav`：昨夜死亡的是
- `dead.mp3` / `dead.wav`：死亡
- `day-speech-start.mp3` / `day-speech-start.wav`：开始白天发言
- `please.mp3` / `please.wav`：请
- `speak.mp3` / `speak.wav`：发言
- `please-speak.mp3` / `please-speak.wav`：请发言
- `sheriff-nomination-start.mp3` / `sheriff-nomination-start.wav`：警长竞选开始
- `sheriff-nomination-human.mp3` / `sheriff-nomination-human.wav`：轮到你选择是否上警
- `sheriff-nomination-prompt.mp3` / `sheriff-nomination-prompt.wav`：请选择是否上警
- `sheriff-nominated.mp3` / `sheriff-nominated.wav`：选择上警
- `sheriff-nomination-none.mp3` / `sheriff-nomination-none.wav`：无人选择上警
- `sheriff-speech-start.mp3` / `sheriff-speech-start.wav`：警上发言开始
- `sheriff-speech-human.mp3` / `sheriff-speech-human.wav`：轮到你发表警长竞选发言
- `sheriff-speech-prompt.mp3` / `sheriff-speech-prompt.wav`：请发表警长竞选发言
- `sheriff-withdrawal-start.mp3` / `sheriff-withdrawal-start.wav`：进入退水阶段
- `sheriff-withdrew.mp3` / `sheriff-withdrew.wav`：选择退水
- `sheriff-vote-start.mp3` / `sheriff-vote-start.wav`：进入警长投票阶段
- `sheriff-pk-speech-start.mp3` / `sheriff-pk-speech-start.wav`：警长投票平票，进入 PK 发言
- `sheriff-pk-speech-human.mp3` / `sheriff-pk-speech-human.wav`：轮到你发表警长 PK 发言
- `sheriff-pk-speech-prompt.mp3` / `sheriff-pk-speech-prompt.wav`：请发表警长 PK 发言
- `sheriff-pk-vote-start.mp3` / `sheriff-pk-vote-start.wav`：进入警长 PK 复投
- `sheriff-handoff-start.mp3` / `sheriff-handoff-start.wav`：警徽移交窗口开启
- `sheriff-handoff-human.mp3` / `sheriff-handoff-human.wav`：轮到你选择移交警徽或撕掉警徽
- `sheriff-handoff-prompt.mp3` / `sheriff-handoff-prompt.wav`：请选择移交警徽或撕掉警徽
- `vote.mp3` / `vote.wav`：投票
- `day-vote-start.mp3` / `day-vote-start.wav`：进入投票阶段
- `vote-revealed.mp3` / `vote-revealed.wav`：公布票数
- `vote-tie.mp3` / `vote-tie.wav`：平票，今日无人放逐
- `exiled.mp3` / `exiled.wav`：被放逐出局
- `idiot-revealed.mp3` / `idiot-revealed.wav`：白痴翻牌免死，失去投票权
- `hunter-taken.mp3` / `hunter-taken.wav`：被猎人带走
- `wolf-king-taken.mp3` / `wolf-king-taken.wav`：被狼王带走
- `white-wolf-king-exploded.mp3` / `white-wolf-king-exploded.wav`：白狼王自爆
- `white-wolf-king-taken.mp3` / `white-wolf-king-taken.wav`：被白狼王带走
- `wolf-beauty-charmed.mp3` / `wolf-beauty-charmed.wav`：狼美人出局，触发魅惑
- `wolf-beauty-taken.mp3` / `wolf-beauty-taken.wav`：殉情出局
- `hunter-shot.mp3` / `hunter-shot.wav`：猎人进入开枪窗口
- `hunter-shot-human.mp3` / `hunter-shot-human.wav`：猎人出局，轮到你选择是否开枪
- `wolf-king-shot.mp3` / `wolf-king-shot.wav`：狼王进入开枪窗口
- `wolf-king-shot-human.mp3` / `wolf-king-shot-human.wav`：狼王出局，轮到你选择是否开枪
- `knight-duel.mp3` / `knight-duel.wav`：骑士进入决斗窗口
- `knight-duel-human.mp3` / `knight-duel-human.wav`：轮到你选择是否发动骑士决斗
- `knight-duel-success.mp3` / `knight-duel-success.wav`：骑士决斗成功
- `knight-duel-failed.mp3` / `knight-duel-failed.wav`：骑士决斗失败，骑士出局
- `knight-duel-taken.mp3` / `knight-duel-taken.wav`：被骑士决斗带走
- `your-turn-speak.mp3` / `your-turn-speak.wav`：轮到你发言
- `your-turn-vote.mp3` / `your-turn-vote.wav`：轮到你投票
- `game-over-good.mp3` / `game-over-good.wav`：好人阵营获胜
- `game-over-wolves.mp3` / `game-over-wolves.wav`：狼人阵营获胜
- `flow-next.mp3` / `flow-next.wav`：流程继续推进

座位号片段：

- `seat-1.mp3` 到 `seat-12.mp3`，或 `seat-1.wav` 到 `seat-12.wav`

请只放入自己录制、购买授权、或明确允许在项目中使用的音频。

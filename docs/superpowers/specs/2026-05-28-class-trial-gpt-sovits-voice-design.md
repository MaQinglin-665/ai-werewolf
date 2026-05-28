# 学级裁判主题局 GPT-SoVITS 日语语音设计

## 背景

`学级裁判主题局` 已经具备本地入口、固定 9 人角色、主题桌面、发言立绘、阶段演出和终局复盘。下一步目标是让主题局真正出声：屏幕继续显示中文狼人杀台词，但播放端使用本地 GPT-SoVITS 生成角色日语语音，让录制观感更接近学级裁判式演出。

本切片仍然是本地私有功能。权重、参考音频、生成音频缓存和角色素材都不进入 Git，也不进入 `/rooms`、Public Alpha 或生产部署路径。

## 已确认方向

- 使用真实 GPT-SoVITS 服务出声。
- 服务是 FastAPI `api_v2.py`，Base URL 为 `http://127.0.0.1:9880`。
- TTS 端点为 `POST /tts`。
- 接口还提供 `GET /set_gpt_weights` 和 `GET /set_sovits_weights`。
- 9 个角色都有权重，命名使用拼音。
- 日语朗读稿采用“中文显示不变，TTS 前临时 LLM 改写”的方式生成。
- 日语改写或 GPT-SoVITS 失败时，fallback 到现有中文 TTS。
- 允许每次换角色时切 GPT/SoVITS 权重，即为了真实角色声线接受首句等待。

## 目标

- 为本地 `学级裁判主题局` 接入 GPT-SoVITS 实时语音。
- 保持 `GameState.speeches`、事件记录、屏幕对白和复盘文本为中文。
- 在请求音频时临时生成日语朗读稿，只用于 TTS，不回写游戏状态。
- 按 class-trial 角色解析 GPT 权重、SoVITS 权重、参考音频和 prompt 文本。
- 调用 GPT-SoVITS 前自动切换对应角色权重。
- 生成音频落入现有 AI speech cache，避免同一句重复合成。
- GPT-SoVITS、权重切换或日语改写失败时，继续走现有中文 Mimo TTS。
- 缺少 GPT-SoVITS 服务时，现有普通 AI 语音能力不回退。

## 非目标

- 不做 AI Pool 通用 GPT-SoVITS provider。
- 不新增公开配置 UI。
- 不提交权重、参考音频、生成音频或本地角色素材。
- 不改变 AI 发言生成逻辑、规则引擎、胜负判断或复盘数据。
- 不要求公网部署可用。
- 不做字幕级音频同步、口型同步或逐字对齐。
- 不把日语稿暴露到玩家复盘或公开事件里。

## 本地 GPT-SoVITS 配置

默认本地根目录：

```text
D:\AI\GPT-SoVITS
```

实现应允许用环境变量覆盖根目录和服务地址：

```text
CLASS_TRIAL_GPT_SOVITS_BASE_URL=http://127.0.0.1:9880
CLASS_TRIAL_GPT_SOVITS_ROOT=D:\AI\GPT-SoVITS
```

如果根目录或服务不可用，class-trial 语音适配层返回 unavailable，并触发现有中文 TTS fallback。

### 角色权重

GPT 权重目录：

```text
D:\AI\GPT-SoVITS\GPT_weights_v2Pro
```

SoVITS 权重目录：

```text
D:\AI\GPT-SoVITS\SoVITS_weights_v2Pro
```

角色默认映射：

| 角色 | key | GPT 权重 | SoVITS 权重 |
|---|---|---|---|
| 苗木诚 | `miao_mu` | `miao_mu-e30.ckpt` | `miao_mu_e16_s2112.pth` |
| 雾切响子 | `wu_qie` | `wu_qie-e30.ckpt` | `wu_qie_e16_s8896.pth` |
| 腐川冬子 | `fu_chuan_dong_zi` | `fu_chuan_dong_zi-e30.ckpt` | `fu_chuan_dong_zi_e16_s1968.pth` |
| 黑白熊 | `hei_bai_xiong_clean_denoised` | `hei_bai_xiong_clean_denoised-e30.ckpt` | `hei_bai_xiong_clean_denoised_e16_s2240.pth` |
| 江之岛盾子 | `jiang_zhi_dao` | `jiang_zhi_dao-e30.ckpt` | `jiang_zhi_dao_e16_s5744.pth` |
| 塞蕾丝缇雅 | `sai_lei_si_ti_ya` | `sai_lei_si_ti_ya-e30.ckpt` | `sai_lei_si_ti_ya_e16_s2656.pth` |
| 十神白夜 | `shi_shen_bai_ye` | `shi_shen_bai_ye-e30.ckpt` | `shi_shen_bai_ye_e16_s6992.pth` |
| 高松灯 | `gao_song_deng` | `gao_song_deng-e30.ckpt` | `gao_song_deng_e16_s2096.pth` |
| 千早爱音 | `AI_voice_1` | `qian_dao_ai_yin-e30.ckpt` | `qian_dao_ai_yin_e16_s8064.pth` |

千早爱音的训练日志使用 `logs/AI_voice_1`，但最终权重仍使用 `qian_dao_ai_yin` 命名。

### 参考音频和 prompt

默认从训练日志读取：

```text
logs/<logKey>/2-name2text.txt
logs/<logKey>/5-wav32k/<first-audio-file>
```

读取规则：

- 每个角色使用 `2-name2text.txt` 第一行。
- 第一列是参考音频文件名。
- 最后一列是日文 prompt 文本。
- 参考音频路径为同一日志目录下 `5-wav32k/<第一列文件名>`。
- `prompt_lang` 使用 `ja`。
- `text_lang` 使用 `ja`。

角色日志 key：

| 角色 | log key |
|---|---|
| 苗木诚 | `miao_mu` |
| 雾切响子 | `wu_qie` |
| 腐川冬子 | `fu_chuan_dong_zi` |
| 黑白熊 | `hei_bai_xiong_clean_denoised` |
| 江之岛盾子 | `jiang_zhi_dao` |
| 塞蕾丝缇雅 | `sai_lei_si_ti_ya` |
| 十神白夜 | `shi_shen_bai_ye` |
| 高松灯 | `gao_song_deng` |
| 千早爱音 | `AI_voice_1` |

## 架构

新增窄范围本地适配层，不把 GPT-SoVITS 逻辑混入 Mimo helper：

- `src/server/gptSoVitsTts.ts`
  - 构建 `api_v2.py` URL。
  - 调用 `/set_gpt_weights`。
  - 调用 `/set_sovits_weights`。
  - 调用 `POST /tts`。
  - 解析音频响应。
  - 返回 Buffer 或明确错误。

- `src/ai/classTrialVoiceProfiles.ts`
  - 定义 9 个角色的 voice profile。
  - 根据本地 root 解析权重路径、参考音频路径和 prompt。
  - 只返回可用 profile，不泄露本地文件到前端。

- `src/ai/classTrialSpeechRewrite.ts`
  - 输入中文公开发言和角色信息。
  - 输出日语朗读稿。
  - 使用现有模型路由能力或 OpenAI-compatible 能力。
  - 失败时抛出可识别错误，让调用方 fallback。

- `src/app/api/ai-speech-audio/route.ts`
  - 保留现有 Mimo 中文 TTS 路径。
  - 当 speaker 对应 class-trial `roleCard.theme === "class-trial"` 且 `voiceLocale === "ja-JP"` 时，优先尝试 GPT-SoVITS。
  - GPT-SoVITS 失败后调用现有 Mimo 中文 TTS。

前端不需要新增按钮。现有 AI 语音开关仍是唯一开关。

## 请求流程

1. AI 正常生成中文台词。
2. 中文台词写入 `GameState.speeches`，并显示在学级裁判对白框。
3. 前端发现新 AI 发言，调用 `/api/ai-speech-audio`。
4. 后端根据 speaker 和 seat roleCard 判断是否 class-trial 日语语音。
5. class-trial 日语语音可用时：
   - 解析角色 voice profile。
   - 调用日语 rewrite helper，得到日语 TTS 文本。
   - 调用 `/set_gpt_weights` 切 GPT 权重。
   - 调用 `/set_sovits_weights` 切 SoVITS 权重。
   - 调用 `POST /tts` 合成音频。
   - 写入 cache。
   - 返回音频 URL。
6. 任一步失败时：
   - 记录 sanitized 错误。
   - 调用现有 Mimo 中文 TTS。
   - 如果中文 TTS 也不可用，则保持现有无音频降级。

## GPT-SoVITS 请求参数

`POST /tts` 使用 JSON body。基础参数：

```json
{
  "text": "日语朗读稿",
  "text_lang": "ja",
  "ref_audio_path": "D:\\AI\\GPT-SoVITS\\logs\\...\\5-wav32k\\xxx.wav",
  "prompt_lang": "ja",
  "prompt_text": "训练日志第一行的日文 prompt",
  "text_split_method": "cut5",
  "batch_size": 1,
  "speed_factor": 1,
  "fragment_interval": 0.3,
  "media_type": "wav",
  "streaming_mode": false,
  "parallel_infer": true,
  "repetition_penalty": 1.35
}
```

第一版使用非 streaming，优先稳定落盘缓存。后续如果延迟太高，再单独设计 streaming 播放。

## 日语改写规则

改写 helper 必须遵守：

- 不改变狼人杀信息。
- 不新增查验、死因、身份、投票目标等事实。
- 保留座位号。
- 保留发言的推理方向和压力对象。
- 只输出自然日语台词，不输出解释、标签或括号动作。
- 长度控制为适合 TTS 的短句，避免生成过长独白。
- 改写文本只用于 TTS，不写入事件、不进入复盘。

如果改写输出为空、明显不是日语、包含解释性前缀，视为失败并 fallback。

## 缓存策略

继续使用：

```text
public/audio/ai-speech
```

cache key 必须包含：

- game id
- speech key
- speaker seat id
- role voice profile id
- GPT 权重路径或 hash
- SoVITS 权重路径或 hash
- reference audio path
- prompt text
- 日语 TTS 文本
- TTS 参数

这样可以防止黑白熊 clean 权重和旧权重串音，也能避免同一句重复合成。

## 错误与降级

应优雅降级的场景：

- `http://127.0.0.1:9880` 不可连接。
- `/openapi.json` 可用但 `/tts` 失败。
- 缺少角色权重。
- 缺少参考音频或 prompt。
- 权重切换失败。
- 日语 rewrite 失败。
- GPT-SoVITS 返回非音频或空内容。

降级顺序：

1. GPT-SoVITS 日语语音。
2. 现有 Mimo 中文 TTS。
3. 现有无音频文字模式。

错误信息不得包含 API key。文件路径可以进入本地日志和测试输出，但不应显示给普通玩家 UI。

## 验证设计

自动化测试：

- `src/server/gptSoVitsTts.test.ts`
  - 构建正确的 `/set_gpt_weights` URL。
  - 构建正确的 `/set_sovits_weights` URL。
  - `POST /tts` 发送 `text_lang: "ja"`、`prompt_lang: "ja"` 和 `ref_audio_path`。
  - 能处理 Buffer、base64 或直接二进制音频。
  - 错误信息会 sanitize。

- `src/ai/classTrialVoiceProfiles.test.ts`
  - 9 个角色都能解析 profile。
  - 黑白熊使用 `hei_bai_xiong_clean_denoised`。
  - 千早爱音使用 `logs/AI_voice_1` 作为 prompt/ref audio 来源。
  - 缺文件时 profile 标记为 unavailable，不抛未处理异常。

- `src/ai/classTrialSpeechRewrite.test.ts`
  - 中文输入生成日语 TTS 文本。
  - 改写失败返回可识别错误。
  - 不改变座位号和关键狼人杀术语语义。

- `src/app/api/ai-speech-audio/route.test.ts`
  - class-trial ja-JP speaker 优先调用 GPT-SoVITS。
  - GPT-SoVITS 失败后 fallback 到现有中文 TTS。
  - 普通 AI 语音仍走原路径。

基础检查：

- `npm run test -- src/server/gptSoVitsTts.test.ts src/ai/classTrialVoiceProfiles.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts src/ai/voiceProfiles.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-voice.md`
- `npm run harness:check`
- `git diff --check`

手动验证：

1. 启动 GPT-SoVITS `api_v2.py`，确认 `http://127.0.0.1:9880/openapi.json` 可访问。
2. 启动 ai-werewolf 本地 dev server。
3. 首页选择 `学级裁判主题局`。
4. 开启 AI 语音。
5. 无真人观战进入 9 人预女猎。
6. 推进到至少两个不同角色发言。
7. 确认服务日志出现对应 `/set_gpt_weights`、`/set_sovits_weights` 和 `/tts`。
8. 确认浏览器播放日语角色语音，屏幕仍显示中文台词。
9. 临时停掉 GPT-SoVITS 或制造一个缺文件角色，确认 fallback 到中文 TTS 或文字模式，不阻塞流程。

## 开放风险

- GPT-SoVITS 切权重可能带来明显延迟。第一版接受等待，并依赖缓存减少重复合成。
- 日语 rewrite 会消耗 LLM 调用；如果模型路由不可用，会触发中文 TTS fallback。
- 参考音频默认取第一条训练切片，可能不是每个角色的最佳声线。后续可以改成本地配置文件精挑 prompt/ref audio。
- 千早爱音日志 key 与权重 key 不一致，需要测试保护。
- 这条链路读取 `D:\AI\GPT-SoVITS`，跨机器会不可用，但必须优雅 fallback。
- 生成音频缓存可能增长，需要后续单独做清理策略。

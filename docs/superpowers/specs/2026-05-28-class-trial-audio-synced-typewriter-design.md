# 学级裁判主题局音频同步打字机设计

## 背景

`学级裁判主题局` 已经接入本地 GPT-SoVITS：画面保留中文发言，后端临时改写成日语并生成角色音频。当前视觉打字机仍由 `ClassTrialGameTable` 自己按固定 timer 推进，可能出现文字先播完、音频才开始，或音频播放时文字节奏不贴合的问题。

本切片只处理学级裁判主题局的前端同步演出，不改狼人杀规则、不改 GPT-SoVITS 生成逻辑、不影响默认狼人杀桌面板。

## 目标

- 只在 `classTrialThemeActive` 的桌面学级裁判表格中启用音频同步打字机。
- 音频还在生成、加载、等待浏览器播放许可时，发言区继续显示 `正在思考/准备发言。`
- 音频真正开始播放后，文字显示进度由真实音频播放进度驱动：`audio.currentTime / audio.duration`。
- 一句话作为整体同步单位，不做分句、逐词或语音识别时间戳。
- 如果音频 `duration` 不可用或不可用值异常，降级为现有固定速度打字机。
- 保留 reduced-motion 行为：偏好减少动画时直接显示完整中文发言。

## 非目标

- 不增加后端 timestamps、ASR、逐词对齐或 GPT-SoVITS 参数调优。
- 不把同步打字机推广到默认狼人杀 UI、移动端普通表格或 `/rooms`。
- 不改变 TTS 缓存、语音 fallback、Mimo 路径或 AI 发言生成。
- 不要求截图自动化作为完成条件；浏览器 DOM/manual smoke 足够。

## 推荐方案

采用 `GameClient` 统一管理音频同步状态，`ClassTrialGameTable` 只消费状态并渲染文字。

原因：

- `GameClient` 已经持有 `HTMLAudioElement`、`speechKey`、播放状态、错误处理和队列逻辑，是获取 `currentTime` 和 `duration` 的唯一可靠位置。
- `ClassTrialGameTable` 不需要知道音频元素细节，只需要接收当前发言对应的同步进度。
- 这样可以把同步逻辑限制在 class-trial 渲染路径，不污染默认 UI。

## 数据模型

在前端类型中扩展现有 `AiSpeechAudioStatus`，新增可选同步字段：

```ts
export type AiSpeechAudioStatus = {
  speechKey: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  state: "loading" | "playing" | "paused";
  text: string;
  playbackProgress?: number;
  playbackDurationSec?: number;
  syncedTypewriter?: boolean;
};
```

语义：

- `state: "loading"`：音频未开始播放，学级裁判打字机显示 thinking text。
- `state: "playing"` 且 `syncedTypewriter: true` 且 `playbackProgress` 是 `0..1`：按音频进度显示文字。
- `state: "playing"` 但没有可用同步字段：回到当前固定速度打字机。
- 状态清空后，表格按现有退出动画处理。

## 音频播放状态流

`GameClient.playAiSpeechAudioText` 仍先设置 loading：

```ts
setAiSpeechAudioStatus({
  speechKey: cue.speechKey,
  speaker: cue.speaker,
  state: "loading",
  text: cue.text,
});
```

`GameClient.playAiSpeechAudioElement` 在 `audio.play()` 成功后启动同步：

1. 写入初始 playing 状态，`playbackProgress: 0`。
2. 如果 `Number.isFinite(audio.duration) && audio.duration > 0`，开启同步。
3. 在 `timeupdate`、`loadedmetadata`、`durationchange`、`ended` 中更新进度。
4. 同时用 `requestAnimationFrame` 或短 interval 补足浏览器 `timeupdate` 较稀疏的问题。
5. `ended` 时把进度置为 `1`，再按现有 finally 清状态。

同步更新必须校验 `runId` 和 `speechKey`，避免旧音频结束后覆盖新发言状态。

## 文本渲染

`ClassTrialGameTable` 新增一个只读 prop，例如：

```ts
audioTypewriter?: {
  speechKey: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  state: "loading" | "playing" | "paused";
  text: string;
  progress?: number;
};
```

`GameClient` 只在 `classTrialThemeActive` 时把 `aiSpeechAudioStatus` 传给 `ClassTrialGameTable` 用于同步；默认表格不消费这个状态。

`ClassTrialGameTable` 通过 `audioTypewriter.speaker.seatId === game.currentSpeakerSeatId` 且 `audioTypewriter.text === focusMessage` 判断同步状态是否属于当前可见发言。`speechKey` 仍保留给 `GameClient` 做旧音频 guard，不要求表格反推出 `speechKey`。

渲染规则：

- 当前发言有匹配状态且状态是 `loading`：frameIndex 固定为 `-1`，显示 `thinkingText`。
- 当前发言有匹配状态且状态是 `playing`，并且 progress 有效：按 progress 选择 frame。
- 当前发言没有有效 progress：沿用当前 timer 打字机。
- progress 为 `1`：显示完整中文文本。

为了让整句同步足够平滑，`buildClassTrialDialogueTimeline` 可以继续复用现有 frames：

- 短文本仍按字符 frames。
- 长文本仍按 segment frames。
- 同步时通过 `Math.floor(progress * frameCount)` 映射到 frame。

这保留了现有“长文本不要逐字太慢”的设计，也符合“整句同步”的要求。

## 降级与错误处理

- 音频下载、GPT-SoVITS、Mimo 或播放失败：沿用现有错误路径，清空状态或进入 no-audio degradation。
- `duration` 为 `NaN`、`Infinity`、`0` 或缺失：`syncedTypewriter` 不置为 true，表格使用当前固定速度打字机。
- 浏览器禁止自动播放：状态留在 loading 直到播放失败或用户触发；不提前展示正文。
- reduced-motion：忽略同步进度，直接显示全文。
- 流式 TTS chunk：每个 chunk 继续使用自身 `speechKey`，同步状态只影响当前正在播放的 chunk。先不做跨 chunk 的全文连续进度。

## 测试计划

新增或更新 focused tests：

- `classTrialDialogue`：新增根据 progress 取 frame 的纯函数测试，覆盖 0、半程、1、非法 progress。
- `ClassTrialGameTable`：匹配 loading 状态时显示 `正在思考/准备发言。`，匹配 playing progress 时显示部分中文文本，progress 1 显示全文。
- `aiSpeechAudio` 或 `GameClient` helper：抽出音频同步进度计算/订阅 helper，测试有效 duration、无效 duration、ended 进度为 1、runId guard。
- `GameClient` 现有测试若有请求/状态相关覆盖，补充只在 class-trial 表格传同步状态。

验证命令：

- `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 浏览器手动：`http://127.0.0.1:51625` -> 学级裁判主题局 -> AI speech on -> 9 人预女猎 -> 无真人观战 -> 播放至少一个 AI 发言，确认音频开始前显示 thinking，音频播放时文字随播放进度展开。

## 风险

- GPT-SoVITS 首句生成可能慢；本设计会把等待阶段保留为 thinking，避免文字先跑完。
- 浏览器 `timeupdate` 事件频率可能偏低；用 `requestAnimationFrame` 或短 interval 补足视觉平滑。
- 当前工作区已有多个 class-trial 本地改动；实施时需要只提交本切片相关文件，避免混入前序 UI 工作。

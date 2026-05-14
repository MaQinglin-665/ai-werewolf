# AI Speech 线程

## 责任范围

可以修改：

- `src/ai/speechProviders.ts`
- `src/ai/modelLlms.ts`
- `src/ai/voiceProfiles.ts`
- `src/server/mimoTts.ts`
- `src/server/voiceInput.ts`
- `src/app/api/ai-speech-audio/**`
- `src/app/api/games/[gameId]/voice-input/**`
- `scripts/generate-host-audio.mjs`
- `scripts/check-llm-output.mjs`

默认不要修改：

- `src/game/engine.ts`
- `src/components/**`，除非任务明确是音频 UI
- `prisma/**`

## 当前重点

- 稳定 LLM 输出解析、修复和 fallback。
- 控制每个模型的风格差异。
- 优化 AI 发言音频生成和缓存策略。
- 语音输入只整理文本，不自动提交玩家动作。

## 原则

- 缺 key 时必须优雅 fallback。
- LLM 输出必须可观测，失败原因要能复盘。
- 不要把 API key、真实密钥或本地缓存音频提交进代码。

## 验收

- `npm run llm:check`
- `npm run test`
- 有条件时跑一次带真实 provider 的手动验证。

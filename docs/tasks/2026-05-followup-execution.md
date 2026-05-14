# 2026-05 后续执行记录

## 范围

这轮按顺序处理四件事：

1. 推送当前协作分支，并尝试打开 PR。
2. AI 胜率平衡：优先增强好人的推理性和表达信号，不压制 LLM 的创造性和活泼感。
3. LLM 输出契约修复：提升 action JSON/候选人字段的容错。
4. `GamePanels.tsx` 第二轮拆分。

## 结果

- 分支 `codex/stabilize-baseline` 已推送到远端；本地缺少 `gh`，无法直接从 CLI 创建 PR，GitHub 已返回创建页：`https://github.com/MaQinglin-665/ai-werewolf/pull/new/codex/stabilize-baseline`。
- AI 侧增加好人立场 cue、降低好人投票抖动、让预言家首日金水更倾向保留生存空间，并减少村民首日乱跳神。狼人侧只轻微降低机械同步投票概率，避免把风格压成模板。
- LLM action 解析增加对截断 `candidateId` 字段的兜底，Gemini action 复测已通过。
- 前端将行动面板拆到 `src/components/game/ActionPanel.tsx`，共享 UI 小组件拆到 `src/components/game/PanelPrimitives.tsx`，`GamePanels.tsx` 保持对外导出兼容。

## 验证

- `npx tsc --noEmit` 通过。
- `npm run lint` 通过。
- `npm run test` 通过，4 个测试文件，99 条测试。
- `npm run build` 通过；仍有既有 Turbopack NFT trace warning，非失败。
- `node scripts/simulate-ai.mjs --json`：1000/1000 终局，0 fallback；好人 18.9%，狼人 81.1%；好人投票准确率约 45.0%。这是轻微改善，整体仍明显偏狼。
- `npm run llm:check -- --retries=0 --json`：16 项中 15 OK、1 FAIL；剩余失败是 GPT speech `fetch failed`，属于上游请求失败，不是本轮契约解析问题。

## 后续建议

- 下一轮平衡继续沿着“增强好人推理链”推进：让好人更稳定地引用验人、票型、发言矛盾和身份压力，而不是减少 LLM 自由表达。
- 单独记录模拟中的首日误放逐样本，优先找出好人被带偏的具体桌面模式。
- 如果要正式开 PR，安装 `gh` 或在 GitHub 创建页上完成标题和描述即可。

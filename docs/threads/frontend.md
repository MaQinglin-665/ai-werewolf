# Frontend 线程

## 责任范围

可以修改：

- `src/components/**`
- `src/app/globals.css`
- 前端相关的类型使用
- 必要时新增 `src/components/game/**`

默认不要修改：

- `src/game/**`
- `src/ai/**`
- `src/server/**`
- `src/app/api/**`
- `prisma/**`

## 当前重点

- 拆分 `GameClient.tsx`。
- 提取可复用 UI 组件。
- 提取前端 hooks。
- 保持现有交互不回退。
- 音频、语音输入、自动推进逻辑要拆得谨慎。

## 推荐拆分顺序

1. 先抽纯展示组件：座位、角色牌、事件/发言列表。
2. 再抽操作面板：不同阶段的行动表单。
3. 再抽 hooks：游戏请求、本地存储、主持音频、AI 语音、语音输入。
4. 最后整理 `GameClient.tsx` 成组合层。

## 验收

- `npm run lint`
- `npm run test`
- 浏览器手动跑一局，至少经过夜晚、白天发言、投票、复盘。

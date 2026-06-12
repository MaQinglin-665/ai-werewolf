# 路线图

Last updated: 2026-06-12 18:45 Asia/Shanghai

## 当前项目状态

项目已经从“能跑的复杂 MVP”进入“可小范围真实试玩、但还不能开放公测”的 Public Alpha 收束期。

当前可用状态：

- 腾讯云主试玩环境已部署并 smoke 通过：`https://175.178.199.245`。
- 最新腾讯云运行源码：`a0c100c Fix AI pool editable friend build blocker`。
- 普通局 Mimo 发言质量阶段已提交：`56c2785 Improve ordinary Mimo speech evaluation and guards`。
- 发布记录已更新：`6b79b8f docs: record Tencent deployment`。
- 普通局 Mimo 发言不能算最终优秀，但按用户判断已达到“及格、可提交”的阶段，不再默认进入无限 Fable5 审查循环。

当前限制：

- Render 镜像可能落后于腾讯云，除非单独执行 Render 部署任务。
- 本地工作树仍有未提交的前端/API 改动，下一次发布前必须先分组审查，不能直接打包整个工作区。
- Public Alpha 仍缺真实玩家规模验证，不应对外承诺稳定运营、账号体系或开放公测。

## 当前阶段目标

下一阶段目标不是继续堆功能，而是把已经上线的 Public Alpha 变成可反复试玩、可收集反馈、可快速修 P0/P1 的产品闭环。

判断标准：

1. 朋友能打开主链接、进房、开局、行动、发言/投票、刷新恢复。
2. 手机端核心按钮和信息层级可读，不需要开发者在旁边解释。
3. 普通局 AI 发言不再出现硬事实错、身份事实错、明显截断或严重模板污染。
4. 每次发布都有明确源码 commit、腾讯云部署记录、preflight 和房间 smoke 证据。
5. 后续 agent 能从 harness 文件接手，不需要读旧聊天。

## P0：发布与试玩闭环

- 清理当前本地脏工作树：把前端/API 改动分成“要保留、要提交、要废弃、要延后”的小组。
- 保持腾讯云为主试玩环境：每次公开可见改动都更新 `docs/current-release.md` 并跑 production preflight + room smoke。
- 组织 5-10 人小范围试玩：重点收集打不开、进不了房、开不了局、行动失败、刷新丢身份、手机按钮难点和错误提示不清楚。
- 把反馈分级：P0 阻断试玩，P1 明显影响体验，P2 体验打磨，P3 扩展想法。

## P1：AI 对局质量

- 普通局 Mimo 发言阶段暂停大修，只保留硬错误修复通道：身份/查验事实错、凭空公开信息、截断、投票承接事实不符。
- 不默认扩大禁词表，不默认扩大硬 fallback；优先改 context、候选动作、公开 claim board、eval 可见性。
- 如果用户要求继续质量提升，先做小样本人工读感目标，再决定是否跑 paid live。
- Token 降本排在发言质量接受之后；任何降本都必须保留 speech/action 质量回归证据。

## P1：体验与前端稳定

- 优先保护试玩主路径：主页进入、AI 池、房间大厅、房间内行动、投票、刷新恢复。
- 前端技术债只处理会影响试玩修复速度或手机可读性的部分。
- `GameClient.tsx`、`RoomClient.tsx`、`AiPoolClient.tsx` 等大文件继续按任务卡拆分，不做顺手大重构。
- UI 改动必须配套浏览器或 smoke 验证；只改文档则不需要。

## P1：工程 harness

- 以后较大任务必须有 task card，并写清 allowed scope、verification、state updates。
- 长任务必须登记到 `long_running_tasks.json`，结束时把状态改成 `done` 或明确 blocker。
- `progress.md` 和 `session-handoff.md` 应记录“下一步要做什么”，不是复述整段历史。
- 发布任务优先读 `docs/tencent-cloud-deploy.md`、`docs/current-release.md` 和 `docs/verification-matrix.md`。

## P2：产品叙事和增长准备

- README、`docs/alpha-playtest.md`、`docs/current-release.md`、推广素材统一表达：Public Alpha 小范围试玩，不是开放公测。
- 根据第一轮玩家反馈调整试玩说明和反馈模板。
- Render 镜像只作为备份；如果要对外传播备用链接，先单独验证 Render。
- Release ZIP 继续保留本地试玩路径，但短期主体验以腾讯云房间为准。

## P3：后续扩展

- 多真人体验、账号体系、对局存档、统计面板、更多板子和商业化包装都属于后续阶段。
- 新角色或新警长流程必须先写规则任务卡和测试计划。
- 真实语音/TTS 属于体验增强，不应阻塞 Public Alpha 基础试玩闭环。

## 近期建议顺序

1. 本地脏改动分组审查：先看未提交的前端/API 文件，决定哪些属于同一个可验证任务。
2. Public Alpha 玩家试玩：用腾讯云主链接跑 5-10 人小范围测试，记录 P0/P1。
3. P0/P1 修复循环：每个问题一个窄 task card，修完跑对应 smoke。
4. 文档叙事统一：根据真实试玩结果更新 README、试玩说明、推广材料。
5. 再决定是否继续 AI 发言质量、Render 镜像同步、或进入 token 成本优化。

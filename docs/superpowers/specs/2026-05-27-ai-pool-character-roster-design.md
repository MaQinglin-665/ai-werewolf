# AI 池角色名册设计

## 背景

当前 `/ai-pool` 已支持 AI 好友、头像上传、打法模板、真实 LLM、TTS、本局 AI 队列和批量 LLM 预设。用户已经可以把一个 AI 配成不同模型或声音，但页面整体仍更像配置面板，而不是一组可识别、可分享、可上场的角色。

本设计把第一版目标收敛为“名册 MVP”：每个 AI 好友就是一张角色卡，用户在本机浏览器里配置自己喜欢的人物头像和人设，让真实 LLM 对局中的发言与决策更像该人物。

## 目标

- 把 `/ai-pool` 升级成工具型“AI 角色名册”。
- 每个 AI 好友保留现有模型、TTS、头像和打法能力，同时增加角色卡。
- 用户可以配置角色名、头像、人物来源、说话方式、推理习惯、不要做什么和打法模板。
- 牌桌上只显示角色名和头像，不额外显示人物来源或“扮演谁”。
- 真实 LLM 模式下，角色卡影响所有 LLM 发言与决策，包括夜晚技能、白天发言、投票、遗言和复盘理由。
- Mock 模式只展示角色名和头像，不承诺角色扮演效果。
- 支持整套 AI 池角色信息导入和导出，方便迁移或分享阵容。
- 全程遵守 harness：设计文档、任务卡、实现计划、聚焦验证和 handoff。

## 非目标

- 第一版不做独立角色库和座位分配系统。
- 第一版不把角色卡保存到服务端、数据库或公网房间。
- 第一版不把房主配置同步给公网房间内其他玩家。
- 第一版不导出 LLM、TTS、API Key、Base URL、模型名或 voice id。
- 第一版不让 Mock 模式完整模拟角色说话和推理。
- 第一版不做 AI 生成角色卡；用户通过结构化表单直接编辑。
- 第一版不重写规则引擎、候选动作生成或胜负结算。

## 产品范围

第一版采用“一张 AI 好友卡就是一张角色卡”的结构。用户可以在本地浏览器里编辑这些字段：

- 角色名：沿用或替换现有 AI 昵称。
- 头像：沿用现有本地上传头像能力。
- 人物来源：用户自由填写，例如现实人物、影视人物、动漫人物或原创人物。
- 说话方式：结构化补充说明，描述该人物如何说话。
- 推理习惯：结构化补充说明，描述该人物如何分析狼人杀局势。
- 不要做什么：结构化补充说明，约束过度复刻、违和行为或用户不想看到的表现。
- 打法模板：沿用现有 8 个模板和对应风险、诈身份、偏好权重。

现有 8 个打法模板继续作为狼人杀策略基础：

- 逻辑链推演型
- 边界审查型
- 平衡组织型
- 快节奏压迫型
- 细节校验型
- 多线观察型
- 结构站边型
- 长线记忆型

角色卡叠加在模型人格和打法模板之上。模型名仍代表接口和基础配置，打法模板仍代表狼人杀权重，角色卡代表外显人物感和合法动作空间里的取舍倾向。

## 用户流程

1. 用户进入 `/ai-pool`。
2. 页面左侧看到“角色名册”，每行显示头像、角色名、人物来源和 LLM 状态。
3. 用户选择一个角色。
4. 页面右侧显示该角色的详情编辑区。
5. 用户上传头像、填写角色名、人物来源、说话方式、推理习惯和不要做什么。
6. 用户选择或调整现有打法模板。
7. 用户配置真实 LLM 或沿用已有 LLM 配置。
8. 若当前是 Mock 模式，页面在开局相关入口附近提示：角色名和头像会显示，人设和打法扮演只在真实 LLM 生效。
9. 用户回到首页开局。
10. 牌桌显示角色名和头像。
11. 真实 LLM 发言和决策读取角色卡。

## UI 结构

`/ai-pool` 第一屏采用通讯录式布局，优先保证配置效率。

左侧“角色名册”：

- 显示头像、角色名、人物来源和 LLM 状态。
- 支持选择当前编辑对象。
- 保留新增角色、导入、导出和本局队列相关入口。
- 不在列表里显示打法细节，避免拥挤。

右侧“角色详情”：

- 顶部显示头像、角色名、人物来源和当前 LLM 状态。
- 中部显示角色卡字段：人物来源、说话方式、推理习惯、不要做什么。
- 打法模板继续复用现有“打法类型速览”。
- 底部保留高级配置：真实 LLM、TTS、密钥和本局队列顺序。

移动端：

- 使用同一套信息结构。
- 名册在上，详情在下，或以可切换面板呈现。
- 避免把角色卡继续塞进过深的单个 AI 展开层级。

## 数据模型

在现有 `AiFriendConfig` 上增加可选角色卡结构。头像、昵称、打法模板继续复用现有字段。

建议类型：

```ts
type AiFriendRoleCard = {
  source: string;
  speakingStyle: string;
  reasoningStyle: string;
  avoid: string;
};
```

`AiFriendConfig` 增加：

```ts
type AiFriendConfig = {
  // existing fields
  roleCard?: AiFriendRoleCard;
};
```

字段限制建议：

- `source`：最多 80 字。
- `speakingStyle`：最多 240 字。
- `reasoningStyle`：最多 240 字。
- `avoid`：最多 240 字。

导入导出使用独立 schema，避免把非角色配置意外带出。

```ts
type AiFriendRoleRosterExport = {
  version: 1;
  exportedAt: string;
  roles: Array<{
    nickname: string;
    avatarDataUrl?: string;
    basePersonaId: string;
    roleCard: AiFriendRoleCard;
  }>;
};
```

导出不包含：

- LLM Base URL
- LLM 模型名
- LLM API Key
- TTS Base URL
- TTS 模型名
- TTS voice
- TTS API Key

## 导入导出

导出：

- 导出当前本地 AI 池中的角色信息。
- 只导出角色名、头像、人物来源、三格补充说明和打法模板。
- 不导出任何 LLM、TTS 或密钥配置。

导入：

- 先校验 JSON 版本、字段类型、长度和头像 data URL。
- 校验通过后让用户选择“追加”或“覆盖”。
- 追加：保留现有角色，把导入角色作为新的自定义角色加入。
- 覆盖：用导入角色信息替换当前本地 AI 池角色信息。
- 导入后立即写入本地浏览器存储，并更新名册显示。

## AI 行为设计

真实 LLM 模式下，角色卡进入发言链路和行动链路。

发言链路：

- 明确告诉模型正在扮演角色名和人物来源。
- 使用说话方式、推理习惯和不要做什么控制角色表现。
- 要求输出仍然是牌桌玩家实际说出口的话。
- 禁止旁白、括号动作、系统自述、模型自述和内部分析标签。
- 角色表现优先于最优解，但不能违背公开事实、身份私密边界和当前阶段规则。

行动链路：

- 角色卡进入真实 LLM 决策 prompt。
- 只在合法候选动作里影响取舍。
- 可以改变投票倾向、查验偏好、带队强度、诈身份意愿、保护信息链倾向和风险偏好。
- 不允许角色卡让 AI 选择非法目标、泄露狼队私密信息或伪造系统没有给出的事实。
- 现有 `persona.preferences`、`riskTolerance` 和 `bluffing` 仍是决策权重基础。

Mock 模式：

- 不承诺角色扮演效果。
- 继续作为稳定试玩模式。
- 可以显示角色名和头像。
- 已有打法模板权重可以继续生效，但不新增 Mock 角色模拟。

## 提示词边界

用户可以自由填写人物来源。系统第一版不主动限制已有 IP、名人或虚构人物名。

真实 LLM prompt 应表达：

- 你正在扮演该人物参与狼人杀。
- 使用该人物的说话方式和推理气质。
- 仍然必须遵守狼人杀局势、公开事实、私密信息边界和合法候选动作。
- 不要逐字复刻固定台词，不要声称自己是系统、模型或真实本人。
- 输出必须服务于当前狼人杀局势。

## 实现边界

可能涉及：

- `src/components/AiPoolClient.tsx`
- `src/components/AiPoolClient.mobile.test.ts`
- `src/components/game/aiFriendStorage.ts`
- 新增角色名册/导入导出 helper 和测试
- `src/game/aiFriends.ts`
- `src/game/types.ts`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/app/globals.css`

不应触碰：

- `.env`
- 数据库和 Prisma schema
- 生成音频缓存
- 房间/多人同步
- 规则引擎胜负结算
- 生产部署配置

## 验证策略

设计与 harness：

- 设计文档写入 `docs/superpowers/specs/2026-05-27-ai-pool-character-roster-design.md`。
- 创建任务卡 `docs/tasks/2026-05-ai-pool-character-roster.md`。
- 后续实现计划写入 `docs/superpowers/plans/`。
- 更新 `feature_list.json`、`progress.md` 和 `session-handoff.md` 记录状态与验证。

Focused tests：

- 角色卡本地存储、导入、导出、追加和覆盖。
- 导出不包含 LLM、TTS、API Key、Base URL、模型名和 voice id。
- `/api/games` 接收并透传角色卡。
- `AgentView.persona` 包含角色卡信息。
- speech prompt 包含角色名、人物来源、三格补充说明和事实边界。
- action prompt 包含角色卡信息、合法候选动作约束和私密信息边界。
- AI 池组件测试覆盖名册布局、Mock 提醒和导入导出入口。

验证命令建议：

- `npm run harness:task-card -- docs/tasks/2026-05-ai-pool-character-roster.md`
- `npm run test -- src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/AiPoolClient.mobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- 浏览器验证 `/ai-pool` 桌面和手机视口。

真实 provider 调用默认不作为第一版完成条件，因为它需要密钥并可能产生费用。除非用户提供一次性测试条件，否则只验证 prompt 构造、配置透传和 UI 行为。

## 成功标准

- `/ai-pool` 明显像角色名册，而不是单纯模型配置面板。
- 用户能顺手配置头像、人物来源、三格角色说明和打法模板。
- 真实 LLM 的发言和决策 prompt 明确收到角色卡影响。
- 牌桌显示角色名和头像，不额外暴露人物来源。
- 能导出和导入一套角色信息。
- 导出包不泄露 LLM、TTS、API Key 或环境绑定配置。
- Handoff 写清楚完成项、改动文件、验证和剩余风险。

## 风险

- 角色表现优先可能降低局部狼人杀最优决策，需要通过合法候选动作和事实边界控制底线。
- 用户自由填写人物来源可能带来风格复刻边界问题，prompt 需要避免逐字复刻和真实本人声明。
- `AiPoolClient.tsx` 已经较大，实现时应拆出 helper 或子组件，避免继续堆叠。
- 导入覆盖可能让用户误删本地角色，应在 UI 上明确确认。
- 真实 LLM 效果受模型能力、密钥配置、上游延迟和随机种子影响，第一版应以 prompt 透传和可见差异为验证核心。

## 下一步

本设计通过后，进入实现计划阶段。计划应拆成：

1. 角色卡类型、存储和导入导出 helper。
2. `/api/games` 和 `AgentView.persona` 透传。
3. speech/action prompt 接入角色卡。
4. AI 池通讯录式 UI。
5. focused tests、浏览器验证和 harness handoff。

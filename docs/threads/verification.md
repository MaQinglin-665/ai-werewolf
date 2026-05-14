# Verification 线程

## 责任范围

可以修改：

- `src/**/*.test.ts`
- `scripts/**`
- `docs/tasks/**` 中的验收记录

默认不要修改：

- 业务源码，除非任务明确要求修复一个测试暴露的问题。

## 当前重点

- 建立稳定回归测试。
- 用模拟脚本发现 AI 和规则边界问题。
- 记录手动验收路径。

## 推荐检查项

- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run simulate:ai`
- `npm run llm:check`

## 回归场景

- 真人是狼人
- 真人是预言家
- 真人是女巫
- 真人是猎人
- 真人是平民
- 警长竞选
- 平票
- 猎人死亡开枪
- 女巫救药/毒药
- 终局复盘

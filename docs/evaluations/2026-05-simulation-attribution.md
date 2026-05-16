# AI 胜率归因报告

生成时间：2026-05-14T17:11:42.437Z

## 配置

- board: default
- games: 1000
- seeds: 0-999
- maxSteps: 500

## 总览

- completed: 1000/1000
- GOOD: 345 (34.5%)
- WEREWOLVES: 655 (65.5%)
- fallback: 0 decisions in 0 games

## 胜负对照

| 指标 | 好人胜局 | 狼人胜局 | 全部 |
| --- | ---: | ---: | ---: |
| 好人投狼率 | 71.0% | 46.7% | 55.9% |
| 误放逐率 | 33.4% | 64.7% | 53.0% |
| 首放逐狼人率 | 78.0% | 46.9% | 57.6% |
| 首放逐神职率 | 18.8% | 43.5% | 35.0% |
| 预言家平均存活天数 | 2.27 | 2.03 | 2.11 |
| 女巫毒中狼率 | 75.7% | 30.9% | 50.5% |
| 猎人枪中狼率 | 94.8% | 42.7% | 52.6% |
| 平票局占比 | 18.8% | 19.1% | 19.0% |

## 狼人胜局标签

| 归因标签 | 局数 | 占狼人胜局 | 示例 seed |
| --- | ---: | ---: | --- |
| 预言家 2 天内死亡 | 569 | 86.9% | 2, 6, 8, 10, 12, 13, 15, 17, 20, 21, 23, 24 |
| 至少两次误放逐 | 366 | 55.9% | 2, 8, 10, 12, 13, 20, 23, 30, 31, 37, 41, 45 |
| 首放逐好人 | 348 | 53.1% | 2, 8, 9, 12, 15, 20, 21, 25, 30, 31, 34, 37 |
| 女巫毒/猎人枪误伤好人 | 331 | 50.5% | 13, 17, 20, 21, 23, 25, 28, 32, 34, 39, 40, 47 |
| 好人投狼率低于 49% | 321 | 49.0% | 2, 8, 12, 13, 20, 21, 25, 31, 32, 34, 37, 39 |
| 首放逐好人神职 | 285 | 43.5% | 2, 8, 9, 12, 15, 20, 21, 25, 31, 34, 37, 39 |
| 全局没有放逐狼人 | 206 | 31.5% | 2, 8, 12, 15, 20, 30, 31, 34, 37, 39, 41, 64 |
| 出现平票进入夜晚 | 125 | 19.1% | 20, 21, 34, 40, 63, 66, 73, 76, 92, 101, 102, 116 |
| 真预言家未公开起跳 | 55 | 8.4% | 8, 37, 63, 104, 112, 115, 119, 120, 127, 143, 156, 194 |

## 首放逐影响

| 首放逐 | 局数 | 好人胜率 | 狼人胜率 |
| --- | ---: | ---: | ---: |
| WEREWOLVES/WEREWOLF | 576 | 46.7% | 53.3% |
| GOOD/WITCH | 229 | 20.5% | 79.5% |
| GOOD/HUNTER | 106 | 17.0% | 83.0% |
| GOOD/VILLAGER | 74 | 14.9% | 85.1% |
| GOOD/SEER | 15 | 0.0% | 100.0% |

## 平票影响

- 平票局：190 局，狼人胜率 65.8%。
- 无平票局：810 局，狼人胜率 65.4%。

## 高风险样本

| Seed | 标签 | 好人投狼率 | 首放逐 | 预言家存活 |
| ---: | --- | ---: | --- | ---: |
| 20 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 17.6% | GOOD/WITCH | 2 |
| 206 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 16.7% | GOOD/HUNTER | 2 |
| 337 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 22.2% | GOOD/HUNTER | 1 |
| 482 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 41.7% | GOOD/WITCH | 2 |
| 485 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 16.7% | GOOD/SEER | 1 |
| 923 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 45.5% | GOOD/HUNTER | 2 |
| 947 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire, tied vote | 25.0% | GOOD/SEER | 2 |
| 34 | first good power exile, first good exile, no wolf exile, low good vote accuracy, seer early death, power misfire, tied vote | 22.2% | GOOD/HUNTER | 2 |
| 76 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, tied vote | 28.6% | GOOD/WITCH | 2 |
| 84 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire | 0.0% | GOOD/WITCH | 2 |
| 152 | first good power exile, first good exile, no wolf exile, multi mislynch, low good vote accuracy, seer early death, power misfire | 0.0% | GOOD/WITCH | 2 |
| 170 | first good power exile, first good exile, no wolf exile, multi mislynch, seer early death, power misfire, tied vote | 50.0% | GOOD/WITCH | 2 |

## 优先观察

- 强动作误伤: 狼人胜局中 50.5% 出现女巫毒或猎人枪误伤好人。
- 首放逐神职风险: 狼人胜局首放逐神职率 43.5%，好人胜局 18.8%。
- 投票准确率差异: 好人胜局投狼率 71.0%，狼人胜局 46.7%。
- 预言家生存差异: 好人胜局预言家平均存活 2.27 天，狼人胜局 2.03 天。
- 平票影响: 平票局狼人胜率 65.8%，总体狼人胜率 65.5%。

## 下一步实验建议

- 优先验证好人首日是否过早集中到神职或低证据目标；这应通过公开证据门槛改善，而不是削弱狼人。
- 如果败局的好人投狼准确率明显低于胜局，下一步加强好人 action prompt 对发言链、站边变化、票型压力的引用。
- 如果败局神职误伤高，女巫毒和猎人枪只做强证据门槛的单独 A/B，保持 LLM 发言自由度。
- 如果平票局狼人胜率更高，单独观察平票后夜晚刀人与次日归票，而不是改平票规则。


# LLM 真实对局小样本评估

生成时间：2026-05-14T16:23:57.947Z

## 配置

- seedStart: 91
- games: 1
- board: default
- humanSeatId: 9
- autoHuman: mock
- maxLlmCalls: 12
- maxSteps: 180

## 汇总

- totalCalls: 12
- speech/action: 8/4
- fallback: 0
- validation failures: 0
- referenced reasoning cues: 2
- average duration: 19810ms
- providers: mimo-action:mimo-v2.5-pro 1, glm-action:glm-4-7-251222 1, claude-action:claude-opus-4-6 1, deepseek-speech:deepseek-v4-flash 1, claude-speech:claude-opus-4-6 1, gpt-speech:gpt-5.4 1, doubao-speech:doubao-seed-2-0-pro-260215 1, mimo-speech:mimo-v2.5-pro 1, gemini-speech:gemini-3-flash 1, glm-speech:glm-4-7-251222 1, kimi-speech:kimi-k2.6 1, gpt-action:gpt-5.4 1
- failure types: ok 11, retry_ok 1

## 调用明细

| Game | Day | Phase | Seat | Persona | Task | Provider | Time | Cues | Status | Output |
| --- | ---: | --- | ---: | --- | --- | --- | ---: | ---: | --- | --- |
| 91 | 1 | NIGHT_WOLVES | 5 | Mimo | action | mimo-action:mimo-v2.5-pro | 5630 | 0/0 | ok | wolfKill -> 4 |
| 91 | 1 | NIGHT_SEER | 7 | GLM | action | glm-action:glm-4-7-251222 | 21076 | 0/0 | ok | seerCheck -> 9 |
| 91 | 1 | NIGHT_WITCH | 2 | Claude | action | claude-action:claude-opus-4-6 | 7852 | 0/0 | ok | witchAction:save |
| 91 | 1 | DAY_SPEECH | 1 | DeepSeek | speech | deepseek-speech:deepseek-v4-flash | 10206 | 0/0 | ok | speak: 1号发言。昨夜平安夜，没有人倒牌，是个好消息。我先不急着站任何边，毕竟没有任何前置发言和身份信息可以对比。但我有个习惯，第一轮我会先看发言顺序和每个人给出的逻辑链条能不能闭环。今… |
| 91 | 1 | DAY_SPEECH | 2 | Claude | speech | claude-speech:claude-opus-4-6 | 26260 | 0/0 | ok | speak: 2号发言。 先说1号DeepSeek，他开了一个框架：要求所有人给逻辑切入点，说会校验发言和票型的对应。方向没问题，但我注意到他自己其实也没给出任何实质判断，等于把所有压力推给了… |
| 91 | 1 | DAY_SPEECH | 3 | GPT | speech | gpt-speech:gpt-5.4 | 21943 | 0/0 | ok | speak: 3号发言。 我先给个当前态度，1、2都还不能放，但硬要排的话，2号我会比1号多看一眼。 为什么这么说。1号的问题是明显偏框架，他先把标准立起来了，要求大家给切入点、后面还要验票型… |
| 91 | 1 | DAY_SPEECH | 4 | 豆包 | speech | doubao-speech:doubao-seed-2-0-pro-260215 | 42074 | 0/0 | ok | speak: 4号发言，我这轮票口直接挂1号DeepSeek，没什么好磨叽的。 你1号第一个起来，叭叭给所有人定规矩，要求后置位每个人都得给逻辑切入点给判断，不能说模糊话，结果你自己半个怀疑对… |
| 91 | 1 | DAY_SPEECH | 5 | Mimo | speech | mimo-speech:mimo-v2.5-pro | 22202 | 0/0 | ok | speak: 5号发言。我先把前面四位的发言逻辑链理一遍，有几处矛盾需要补。 1号DeepSeek的问题，豆包点得对，但还没点到根上。你第一个起来，要求所有人给逻辑切入点，结果你自己的切入点是… |
| 91 | 1 | DAY_SPEECH | 6 | Gemini | speech | gemini-speech:gemini-3-flash | 10927 | 0/1 | ok | speak: 6号发言。 前面的发言听下来，我还没法像4号和5号那样直接把票口挂死。1号和2号目前给我的感觉很像，都在抢占一个“裁判位”或者“规则制定者”的高地。1号立了逻辑框架，2号补了发言… |
| 91 | 1 | DAY_SPEECH | 7 | GLM | speech | glm-speech:glm-4-7-251222 | 42261 | 1/1 | ok | speak: 7号发言。我是预言家，首夜验9号，金水。 前置这六个人的发言结构很有问题。1号DeepSeek和2号Claude，你们俩都在抢那个“裁判位”。1号立逻辑框架，2号补规则边界，结果… |
| 91 | 1 | DAY_SPEECH | 8 | Kimi | speech | kimi-speech:kimi-k2.6 | 12114 | 1/1 | ok | speak: 8号发言。 我先说7号GLM的预言家身份线。首夜验9号金水，这个信息我暂时接，但9号还没发言，金水身份能不能坐实，得看9号自己怎么聊。7号你点1、2抢裁判位，这个观察我认，但有个… |
| 91 | 1 | DAY_VOTE | 1 | DeepSeek | action | gpt-action:gpt-5.4 | 15179 | 0/2 | retry_ok | vote -> 2 |

## 公开推理线索样例

### Seed 91 · Mimo · NIGHT_WOLVES
- 暂无 reasoningCues。
- 输出：wolfKill 4号 豆包 当前可信度较高，夜里先拆稳定发言位。

### Seed 91 · GLM · NIGHT_SEER
- 暂无 reasoningCues。
- 输出：seerCheck 9号 Checking the current focus of suspicion to resolve the structural uncertainty of the board

### Seed 91 · Claude · NIGHT_WITCH
- 暂无 reasoningCues。
- 输出：witchAction 第一夜信息不足，没有确凿证据指向任何人是狼，保下豆包能多留一个发言位，白天再通过言论边界审查来锁定可疑位。解药优先保信息量。

### Seed 91 · DeepSeek · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：1号发言。昨夜平安夜，没有人倒牌，是个好消息。我先不急着站任何边，毕竟没有任何前置发言和身份信息可以对比。但我有个习惯，第一轮我会先看发言顺序和每个人给出的逻辑链条能不能闭环。今天我是第一个开口，只能先铺自己的观察立场。 我要求后置位2号到9号，所有人都要给出一个明确的逻辑切入点，不能只说“听发言再站”这种模糊话。具体来说：你打算从哪条线索开始判断今天出人方向？你认为平安夜这个结果对哪类身份最有利？我不会现在定义谁一定是狼，但谁在模糊其词、谁在直接划水，我会记下来。票型出来之后，发言和票型能不能对应，是我今天最重要的校验标准。先说到这里，听后面。

### Seed 91 · Claude · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：2号发言。 先说1号DeepSeek，他开了一个框架：要求所有人给逻辑切入点，说会校验发言和票型的对应。方向没问题，但我注意到他自己其实也没给出任何实质判断，等于把所有压力推给了后置位。这个我先记着，不定性，但如果后面他归票的时候还是这种"我看你们表现"的姿态，我会往他身上加疑问。 再说平安夜这个结果。我想把一个边界划清楚：平安夜只代表今早没人倒牌，具体原因桌面上没有公开信息能确认。谁要是在发言里把平安夜的原因说死了，我建议大家留意一下，因为那大概率是在越界表达。 我这轮的态度是先不急着出人，第一天信息确实少，但我不接受所有人都打太极。后置位我有几个要求：第一，4号豆包和9号，你们稍后发言的…

### Seed 91 · GPT · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：3号发言。 我先给个当前态度，1、2都还不能放，但硬要排的话，2号我会比1号多看一眼。 为什么这么说。1号的问题是明显偏框架，他先把标准立起来了，要求大家给切入点、后面还要验票型，这种发言本身没错，但确实没落到具体判断上，所以1号目前在我这儿是“能听，但还没给价值”。如果他后面还是只负责定规则、不负责落点，我会继续加怀疑。 2号比1号多走了一步，他开始点1号这个问题，也把平安夜不能说死这个边界提出来了，这点我认同，算是有桌面约束力。但2号的问题也在这儿：他看到了1号空，可他自己还是没给出“那你现在更像要从谁下手”的结论，还是停在提醒和要求后置位表态。这个位置就有点像，话说得都对，但票想往哪儿…

## 观察记录

- 发言是否承接前置位：待人工标注。
- 投票是否参考公开票型/对跳/站边变化：先看 Cues 命中列，再抽样读输出。
- 是否越界泄露私密信息：结合 validation failures、fallback 和输出抽样检查。


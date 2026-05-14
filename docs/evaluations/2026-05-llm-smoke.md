# LLM 真实对局小样本评估

生成时间：2026-05-14T16:02:48.866Z

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
- fallback: 1
- validation failures: 0
- referenced reasoning cues: 3
- average duration: 20964ms
- providers: mimo-action:mimo-v2.5-pro 1, glm-action:glm-4-7-251222 1, claude-action:claude-opus-4-6 1, deepseek-speech:deepseek-v4-flash 1, claude-speech:claude-opus-4-6 1, gpt-speech:gpt-5.4 1, doubao-speech:doubao-seed-2-0-pro-260215 1, mimo-speech:mimo-v2.5-pro 1, gemini-speech:gemini-3-flash 1, glm-speech:glm-4-7-251222 1, kimi-speech:kimi-k2.6 1, deepseek-action:deepseek-v4-flash 1
- failure types: ok 11, provider_error 1

## 调用明细

| Game | Day | Phase | Seat | Persona | Task | Provider | Time | Cues | Status | Output |
| --- | ---: | --- | ---: | --- | --- | --- | ---: | ---: | --- | --- |
| 91 | 1 | NIGHT_WOLVES | 5 | Mimo | action | mimo-action:mimo-v2.5-pro | 6298 | 0/0 | ok | wolfKill -> 4 |
| 91 | 1 | NIGHT_SEER | 7 | GLM | action | glm-action:glm-4-7-251222 | 16336 | 0/0 | ok | seerCheck -> 9 |
| 91 | 1 | NIGHT_WITCH | 2 | Claude | action | claude-action:claude-opus-4-6 | 7471 | 0/0 | ok | witchAction:save |
| 91 | 1 | DAY_SPEECH | 1 | DeepSeek | speech | deepseek-speech:deepseek-v4-flash | 17331 | 0/0 | ok | speak: 1号发言。昨天平安夜，这轮是第一天白天，后置位还有八个还没说话。我先不急着拍身份，先把情况理一下。 平安夜，在9人局里无非三种可能：女巫救人了、狼人空刀了、或者刀到不该刀的人身上… |
| 91 | 1 | DAY_SPEECH | 2 | Claude | speech | claude-speech:claude-opus-4-6 | 25732 | 0/0 | ok | speak: 2号发言。 1号说了三种可能解释平安夜，框架没问题，但我注意到他整段话下来其实没有给任何一个方向的倾向。列完可能性之后直接说"我等后置位补视角"，这个姿态本身我先记一笔——前置位… |
| 91 | 1 | DAY_SPEECH | 3 | GPT | speech | gpt-speech:gpt-5.4 | 26153 | 0/0 | ok | speak: 3号发言。 我先给态度，1、2都还不能放，但硬要排的话，我现在对2号的关注度比1号高一点。 理由有两个。第一，1号的问题是偏空，像在搭框架，确实没怎么落判断，这个我认。但1号至少… |
| 91 | 1 | DAY_SPEECH | 4 | 豆包 | speech | doubao-speech:doubao-seed-2-0-pro-260215 | 29816 | 0/0 | ok | speak: 来，我4号发言，直接给结论，这轮我重点打1号。 理由很简单，你1号第一个发言，叭叭列了一堆平安夜的可能性，又给全场定了四个规则，说要盯这个盯那个，结果你自己半毛钱实际判断都没有？… |
| 91 | 1 | DAY_SPEECH | 5 | Mimo | speech | mimo-speech:mimo-v2.5-pro | 12628 | 2/2 | ok | speak: 5号Mimo发言。 我听完前置位四个人，先给一个细节：1号说自己"不急着拍身份"，然后列了四个规则，其中第四条是建议女巫给信息。但1号整段话没有提自己对女巫身份的看法，也没有说"… |
| 91 | 1 | DAY_SPEECH | 6 | Gemini | speech | gemini-speech:gemini-3-flash | 10048 | 0/3 | ok | speak: 6号发言。5号既然直接拍出女巫身份给1号发金水，那1号在我的视角里逻辑优先级就变了。之前1、2、3、4号在那儿缠斗，焦点都在1号发言空不空，但现在1号身上挂了5号的身份背书，我就得 |
| 91 | 1 | DAY_SPEECH | 7 | GLM | speech | glm-speech:glm-4-7-251222 | 67633 | 0/3 | ok | speak: 7号发言。我是预言家，昨晚验9号，金水。 我看了一下前面的发言结构，发现5号这个动作非常不自然。前置位2、3、4号都在质疑1号发言空、没判断，压力全在1号身上。结果5号突然跳女巫… |
| 91 | 1 | DAY_SPEECH | 8 | Kimi | speech | kimi-speech:kimi-k2.6 | 17134 | 4/4 | ok | speak: 8号发言。 我先说身份线。7号GLM跳预言家，验9号金水，这个查验我暂时先记。但7号你盘5号不自然，理由是"1号要被冲出去了，5号不得不跳身份捞人"——这个逻辑我听得懂，但有个问… |
| 91 | 1 | DAY_VOTE | 1 | DeepSeek | action | deepseek-action:deepseek-v4-flash | 14983 | 1/7 | provider_error | vote -> 8 |

## 公开推理线索样例

### Seed 91 · Mimo · NIGHT_WOLVES
- 暂无 reasoningCues。
- 输出：wolfKill 4号 豆包 当前可信度较高，夜里先拆稳定发言位。

### Seed 91 · GLM · NIGHT_SEER
- 暂无 reasoningCues。
- 输出：seerCheck 9号 Checking the current focus to verify the table's suspicion and establish a clear stance.

### Seed 91 · Claude · NIGHT_WITCH
- 暂无 reasoningCues。
- 输出：witchAction 第一夜信息不足，豆包未表现出明显狼态，保人留住更多发言位有利于白天通过逻辑边界审查定位狼人，同时保留毒药等待更确定的目标。

### Seed 91 · DeepSeek · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：1号发言。昨天平安夜，这轮是第一天白天，后置位还有八个还没说话。我先不急着拍身份，先把情况理一下。 平安夜，在9人局里无非三种可能：女巫救人了、狼人空刀了、或者刀到不该刀的人身上了。这个信息本身不能直接锁定什么，但它留下了一个比较重要的公共面——如果今天没人跳出查杀或者跟平安夜有关的身份声明，那大家就只能靠发言基础面来找狼。 我是前置位，只能先把我的视角和盘逻辑的前置放下。后置位的各位，尤其是2号、3号、4号，你们在听完全场之后的站边逻辑、第一轮的分组判断，以及对前置位的反应，都会成为今天白天最重要的逻辑锚点。我会重点记你们对平安夜的处理方式——是直接忽略，还是拿来做铺垫，还是试图扭曲信息。…

### Seed 91 · Claude · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：2号发言。 1号说了三种可能解释平安夜，框架没问题，但我注意到他整段话下来其实没有给任何一个方向的倾向。列完可能性之后直接说"我等后置位补视角"，这个姿态本身我先记一笔——前置位如果只搭框架不给判断，后面容易变成谁都不得罪的位置。 我对平安夜的态度是：第一天信息确实少，平安夜的成因现在谁都不能说死，我不打算在这个点上过度解读。但正因为没有死讯给我们方向，今天的发言质量就是唯一的判断素材。 我现在不急着跳身份，也不急着锁票。但我有一个要求：后置位发言的时候，请给清楚的态度——你觉得今天该怎么处理这个平安夜，你对前置位的判断是什么。不要学1号那样只列可能性不站边，那样全场听完还是一团浆糊。 票口…

### Seed 91 · GPT · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：3号发言。 我先给态度，1、2都还不能放，但硬要排的话，我现在对2号的关注度比1号高一点。 理由有两个。第一，1号的问题是偏空，像在搭框架，确实没怎么落判断，这个我认。但1号至少把自己的发言目标说清楚了，就是先看后置位怎么接、后面再收票，这种前置位保守我能理解，像不像狼得再听。 第二，2号在点1号“回避站边”这个动作本身没问题，可他自己其实也没比1号多给出什么实质判断。他说不要学1号只列可能性，但他自己也只是把“发言质量最重要”“后置位给态度”又重复了一遍，等于站在一个比较安全的位置去打1号，我会觉得这个点有点像先占高地。 再说平安夜，我这里不想往成因上发散，今天谁把这个信息硬往某一个方向带…

## 观察记录

- 发言是否承接前置位：待人工标注。
- 投票是否参考公开票型/对跳/站边变化：先看 Cues 命中列，再抽样读输出。
- 是否越界泄露私密信息：结合 validation failures、fallback 和输出抽样检查。


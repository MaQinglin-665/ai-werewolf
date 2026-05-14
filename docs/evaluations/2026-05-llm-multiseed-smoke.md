# LLM 真实对局小样本评估

生成时间：2026-05-14T16:28:45.147Z

## 配置

- seedStart: 91
- games: 3
- board: default
- humanSeatId: 9
- autoHuman: mock
- maxLlmCalls: 6
- maxSteps: 100

## 汇总

- totalCalls: 18
- speech/action: 8/10
- fallback: 0
- validation failures: 0
- referenced reasoning cues: 0
- average duration: 14704ms
- providers: mimo-action:mimo-v2.5-pro 2, glm-action:glm-4-7-251222 2, claude-action:claude-opus-4-6 2, deepseek-speech:deepseek-v4-flash 3, claude-speech:claude-opus-4-6 3, gpt-speech:gpt-5.4 2, gpt-action:gpt-5.4 2, gemini-action:gemini-3-flash 1, doubao-action:doubao-seed-2-0-pro-260215 1
- failure types: ok 16, retry_ok 2

## 调用明细

| Game | Day | Phase | Seat | Persona | Task | Provider | Time | Cues | Status | Output |
| --- | ---: | --- | ---: | --- | --- | --- | ---: | ---: | --- | --- |
| 91 | 1 | NIGHT_WOLVES | 5 | Mimo | action | mimo-action:mimo-v2.5-pro | 7648 | 0/0 | ok | wolfKill -> 4 |
| 91 | 1 | NIGHT_SEER | 7 | GLM | action | glm-action:glm-4-7-251222 | 15444 | 0/0 | ok | seerCheck -> 9 |
| 91 | 1 | NIGHT_WITCH | 2 | Claude | action | claude-action:claude-opus-4-6 | 17269 | 0/0 | ok | witchAction:save |
| 91 | 1 | DAY_SPEECH | 1 | DeepSeek | speech | deepseek-speech:deepseek-v4-flash | 15338 | 0/0 | ok | speak: 1号发言。昨天平安夜，没有倒牌，信息量确实少。但这个局面本身就是一个信息点——女巫没开药，要么是守救没贪刀，要么就是狼人选择空刀或者刀了同守同救的人。不管哪种，第一天没有明确对跳… |
| 91 | 1 | DAY_SPEECH | 2 | Claude | speech | claude-speech:claude-opus-4-6 | 20032 | 0/0 | ok | speak: 2号发言。 先说一下1号DeepSeek的发言，我觉得有一个点需要厘清。1号说"女巫没开药"，这个结论下得太快了。平安夜只能说明没有人倒牌，至于背后是什么原因，可能性很多，不能直… |
| 91 | 1 | DAY_SPEECH | 3 | GPT | speech | gpt-speech:gpt-5.4 | 16146 | 0/0 | ok | speak: 3号发言。 我先给立场，1、2里面我暂时更想听清1号，2号相对顺一点，但都不到能认下的程度。 先说1号，问题不在于你聊平安夜本身，问题在于你有一点把推测往事实上靠了。平安夜只能说… |
| 92 | 1 | NIGHT_WOLVES | 2 | Claude | action | claude-action:claude-opus-4-6 | 5517 | 0/0 | ok | wolfKill -> 7 |
| 92 | 1 | NIGHT_SEER | 7 | GLM | action | glm-action:glm-4-7-251222 | 18035 | 0/0 | ok | seerCheck -> 9 |
| 92 | 1 | NIGHT_WITCH | 1 | DeepSeek | action | gpt-action:gpt-5.4 | 14095 | 0/0 | retry_ok | witchAction:save |
| 92 | 1 | DAY_SPEECH | 1 | DeepSeek | speech | deepseek-speech:deepseek-v4-flash | 9109 | 0/0 | ok | speak: 1号发言。昨天平安夜，这个信息本身是有意义的。要么狼队没刀，要么女巫开了药。如果女巫在场，手里有解药，昨晚平安夜说明刀口就在女巫的用药范围内——这个范围是公开可推的，因为女巫只能… |
| 92 | 1 | DAY_SPEECH | 2 | Claude | speech | claude-speech:claude-opus-4-6 | 18305 | 0/0 | ok | speak: 2号发言。 1号DeepSeek刚才把平安夜拆成两个方向——女巫救人或者狼队空刀，这个框架本身没问题，但我想指出一个边界：平安夜的成因目前是不可证实的，我们不应该在第一天就把某个… |
| 92 | 1 | DAY_SPEECH | 3 | GPT | speech | gpt-speech:gpt-5.4 | 24646 | 0/0 | ok | speak: 3号发言。 我先给态度，1、2里我暂时更偏好2号一点，1号是我当前更想继续听和施压的位置，但都不到直接下结论的时候。 理由很简单。1号的问题不在于他聊平安夜本身，而在于他把今天的… |
| 93 | 1 | NIGHT_SEER | 6 | Gemini | action | gemini-action:gemini-3-flash | 6362 | 0/0 | ok | seerCheck -> 3 |
| 93 | 1 | NIGHT_WITCH | 5 | Mimo | action | mimo-action:mimo-v2.5-pro | 6368 | 0/0 | ok | witchAction:skip |
| 93 | 1 | HUNTER_SHOT | 4 | 豆包 | action | doubao-action:doubao-seed-2-0-pro-260215 | 20979 | 0/0 | ok | hunterShoot -> 6 |
| 93 | 1 | LAST_WORDS | 6 | Gemini | action | gpt-action:gpt-5.4 | 9215 | 0/0 | retry_ok | lastWords: 我出局前留核心视角：3号GPT别只听结论，要回看他发言和票型是不是连得上；5号Mimo的态度也别放掉。 |
| 93 | 1 | DAY_SPEECH | 1 | DeepSeek | speech | deepseek-speech:deepseek-v4-flash | 17270 | 0/0 | ok | speak: 1号发言。先理一下现有信息：昨夜4号倒了，4号开枪带走了6号，理由是6号是当前桌上最被怀疑的位置。6号出局前留下核心视角，点了3号GPT和5号Mimo。我现在只能基于这些公开内容… |
| 93 | 1 | DAY_SPEECH | 2 | Claude | speech | claude-speech:claude-opus-4-6 | 22898 | 0/0 | ok | speak: 2号发言。 1号把框架搭得很清楚，我基本同意信息量确实少。但我想补一个角度：6号的遗言权重到底该怎么定？ 4号带走6号的理由是"桌上最被怀疑的位置"。那6号本身就是一个被质疑的人… |

## 公开推理线索样例

### Seed 91 · Mimo · NIGHT_WOLVES
- 暂无 reasoningCues。
- 输出：wolfKill 4号 豆包当前可信度较高，夜里先拆稳定发言位，避免白天被其持续带节奏。

### Seed 91 · GLM · NIGHT_SEER
- 暂无 reasoningCues。
- 输出：seerCheck 9号 Checking the player with the highest suspicion to clarify the table's focus.

### Seed 91 · Claude · NIGHT_WITCH
- 暂无 reasoningCues。
- 输出：witchAction 首夜信息不足，没有确定性证据支持毒杀任何人。保人优先维持场上人数优势，留毒到有明确判断时再用。

### Seed 91 · DeepSeek · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：1号发言。昨天平安夜，没有倒牌，信息量确实少。但这个局面本身就是一个信息点——女巫没开药，要么是守救没贪刀，要么就是狼人选择空刀或者刀了同守同救的人。不管哪种，第一天没有明确对跳或查杀之前，我倾向于先不急着打强对立。 我说一下我自己的视角：平安夜意味着女巫大概率还在场，好人轮次没有损失。但越是这样，越要小心这个局面是不是狼队刻意制造的沉默区，目的是让好人第一天没有焦点，随便出人出歪。 我这边会把本轮发言顺序记下来。2号到9号，你们后置位八个人，我需要你们每个人都给出一个清晰的白天思考线——不要只说“我听一圈再定”，至少给一个你对平安夜的解读，以及你心目中这一轮最应该关注的几个位置或逻辑点。谁…

### Seed 91 · Claude · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：2号发言。 先说一下1号DeepSeek的发言，我觉得有一个点需要厘清。1号说"女巫没开药"，这个结论下得太快了。平安夜只能说明没有人倒牌，至于背后是什么原因，可能性很多，不能直接锁死在某一个解读上。这种把推测说成事实的习惯，我会记一笔。 不过1号整体框架我认同一半：第一天信息少，确实需要每个人给出清晰的思考线，不能混过去。但他自己说"不拍身份、票口不放、等后置位全部聊完再定"，这个态度本身也偏保守了。你要求别人给清晰态度，自己先给一个方向出来才有说服力。 回到我自己的视角。平安夜的局面，我的判断是：好人阵营今天轮次完整，这是优势，但也意味着狼队可能在等第一天浑水摸鱼。所以今天的发言质量很重…

### Seed 91 · GPT · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：3号发言。 我先给立场，1、2里面我暂时更想听清1号，2号相对顺一点，但都不到能认下的程度。 先说1号，问题不在于你聊平安夜本身，问题在于你有一点把推测往事实上靠了。平安夜只能说明昨晚没人倒，后面成因很多，你直接说到“女巫没开药”，这个口子开得有点大。然后你后面又说不拍身份、不放票口、等大家聊完再定，这个我能理解，但会显得你前半段铺得很满，后半段落点又很虚。简单说就是框架有了，明确判断还没给出来，所以1号我先放在观察位。 2号这轮比较像在帮桌面收边界，这点我认可。你指出1号那个表述问题，是有效信息，不是硬找茬。但2号也有个问题，你说1号保守，结果你自己也是不跳身份、不锁票，核心也还是“等后置…

### Seed 92 · Claude · NIGHT_WOLVES
- 暂无 reasoningCues。
- 输出：wolfKill 7号 GLM sits in a stable, trusted position with low suspicion — removing a calm anchor early d

### Seed 92 · GLM · NIGHT_SEER
- 暂无 reasoningCues。
- 输出：seerCheck 9号 Checking the current focus to gather information.

### Seed 92 · DeepSeek · NIGHT_WITCH
- 暂无 reasoningCues。
- 输出：witchAction 首夜公开信息几乎为空，直接下毒收益低且容易误伤；先救人保留白天发言与票型信息，更符合稳健推进。

### Seed 92 · DeepSeek · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：1号发言。昨天平安夜，这个信息本身是有意义的。要么狼队没刀，要么女巫开了药。如果女巫在场，手里有解药，昨晚平安夜说明刀口就在女巫的用药范围内——这个范围是公开可推的，因为女巫只能救一个人，而夜晚只有一个死亡位。我没有前置位发言可以对比，所以今天我的核心任务是听后置位怎么消化这个平安夜。2到9号，你们在轮到自己发言的时候，请给我一个清晰的立场：你认这个平安夜是女巫救的，还是狼队空刀？如果你认女巫救人，你心里有没有怀疑的吃刀位置？如果你认空刀，理由是什么？这两个方向的逻辑链不一样，会影响后面的票型判断。我暂时不锁任何身份，先听一圈，再出结论。

### Seed 92 · Claude · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：2号发言。 1号DeepSeek刚才把平安夜拆成两个方向——女巫救人或者狼队空刀，这个框架本身没问题，但我想指出一个边界：平安夜的成因目前是不可证实的，我们不应该在第一天就把某个解释当成既定事实往下推。1号说"刀口在女巫用药范围内"，这句话其实已经预设了女巫救人这个前提，稍微有点越线了。 我的态度是，平安夜先记下，不急着定性。第一天真正有价值的信息来自发言本身——谁的逻辑清晰、谁在回避站边、谁急着带节奏，这些比猜平安夜成因重要得多。 1号整体发言结构很完整，但有一个点让我留意：他全程在布置任务、要求后置位表态，自己却没有给出任何倾向性判断。这种"我先听一圈再说"的姿态，第一天前置位用一次可以…

### Seed 92 · GPT · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：3号发言。 我先给态度，1、2里我暂时更偏好2号一点，1号是我当前更想继续听和施压的位置，但都不到直接下结论的时候。 理由很简单。1号的问题不在于他聊平安夜本身，而在于他把今天的讨论重心往“平安夜成因二选一”上带了。这个框架能聊，但第一天这么早就让大家围着这个答题，我觉得收益未必高，因为这个东西现在确实不好证。你后面又没给自己的落点，更多是在给全桌布置任务，这种发言像做框架的人，但不像真的在找狼的人，所以我先记1号一个偏空。 2号我认为比1号好一点的地方，是他至少把这个边界拉回来了：平安夜先记信息，不急着当事实往下推，这个我是认的。而且他也点到了1号“先听一圈再说”的问题，这个视角是有效的。…

### Seed 93 · Gemini · NIGHT_SEER
- 暂无 reasoningCues。
- 输出：seerCheck 3号 GPT 是当前焦点，查验收益最高。

### Seed 93 · Mimo · NIGHT_WITCH
- 暂无 reasoningCues。
- 输出：witchAction 第一天信息不足，没有明确的狼人目标，保留解药和毒药更稳妥，等待后续发言和票型再做判断。

### Seed 93 · 豆包 · HUNTER_SHOT
- 暂无 reasoningCues。
- 输出：hunterShoot 6号 Gemini is the most widely suspected seat on the current table, shooting him to force all r

### Seed 93 · Gemini · LAST_WORDS
- 暂无 reasoningCues。
- 输出：我出局前留核心视角：3号GPT别只听结论，要回看他发言和票型是不是连得上；5号Mimo的态度也别放掉。

### Seed 93 · DeepSeek · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：1号发言。先理一下现有信息：昨夜4号倒了，4号开枪带走了6号，理由是6号是当前桌上最被怀疑的位置。6号出局前留下核心视角，点了3号GPT和5号Mimo。我现在只能基于这些公开内容做推理。 6号遗言说让3号回看发言和票型能不能连得上——这个判断本身成立的前提是3号有过明确的发言和票型，但目前第一轮大家都只起手表态，3号还没开口，所以6号这句话更像是在预设3号会有一个“结论和过程脱节”的倾向，或者他根据自己跟3号的私下互动有顾虑。这一点我需要等3号本人开口之后对比校验。 5号被6号点名“态度别放掉”，同样需要等5号把本轮态度补清楚。所以目前这两个位置是我本轮的观察核心。 我自己这边，先不站任何立…

### Seed 93 · Claude · DAY_SPEECH
- 暂无 reasoningCues。
- 输出：2号发言。 1号把框架搭得很清楚，我基本同意信息量确实少。但我想补一个角度：6号的遗言权重到底该怎么定？ 4号带走6号的理由是"桌上最被怀疑的位置"。那6号本身就是一个被质疑的人，他出局前点的3号和5号，到底是基于什么逻辑？他没有给推理过程，只留了一句"回看发言和票型连不连得上"。这话听着有道理，但实际上第一天大家都还没完整表态，3号甚至还没开口，这个"连不连得上"的判断基础在哪？ 我不是说6号的遗言一定没价值，但我想提醒一点：一个被带走的人留下的方向性指引，不能直接当作定论来用。1号说观察核心放在3号和5号，我觉得可以观察，但别被这个框架锁死。 我这轮额外想关注的是8号Kimi。原因很简单…

## 观察记录

- 发言是否承接前置位：待人工标注。
- 投票是否参考公开票型/对跳/站边变化：先看 Cues 命中列，再抽样读输出。
- 是否越界泄露私密信息：结合 validation failures、fallback 和输出抽样检查。


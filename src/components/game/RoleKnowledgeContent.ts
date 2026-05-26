import type { Role } from "@/game/types";

export type RoleCamp = "好人阵营" | "狼人阵营";

export type RoleIntro = {
  title: string;
  camp: RoleCamp;
  goal: string;
  timing: string;
  ability: string;
  limits: string;
  tip: string;
};

export type IdentityBookFilter = "all" | "good" | "werewolves";

export type RolePhaseHint = {
  title: string;
  detail: string;
  tone: "gold" | "green" | "blue" | "red";
};

export type RoleLinkTip = {
  title: string;
  detail: string;
  relatedRoles?: Role[];
  keywords?: string[];
};

export type GlossaryEntry = {
  term: string;
  alias?: string;
  meaning: string;
  tableUse: string;
  example: string;
  tone: "gold" | "green" | "blue" | "red";
};

export type GlossarySection = {
  title: string;
  description: string;
  entries: GlossaryEntry[];
};

export const IDENTITY_BOOK_ROLE_ORDER: Role[] = [
  "VILLAGER",
  "SEER",
  "WITCH",
  "HUNTER",
  "IDIOT",
  "GUARD",
  "KNIGHT",
  "WEREWOLF",
  "WOLF_KING",
  "WHITE_WOLF_KING",
  "WOLF_BEAUTY",
];

export const IDENTITY_BOOK_FILTERS: { id: IdentityBookFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "good", label: "好人" },
  { id: "werewolves", label: "狼人" },
];

export const GLOSSARY_SECTIONS: GlossarySection[] = [
  {
    title: "身份和信息",
    description: "围绕身份声明、查验和夜间信息的常见说法。",
    entries: [
      {
        term: "跳身份",
        alias: "拍身份",
        meaning: "公开声称自己是某个角色，例如预言家、女巫、猎人或守卫。",
        tableUse: "跳身份可以争取信任，也会暴露给狼人；AI 说“拍身份”通常是在要求某人明确身份。",
        example: "“你如果是猎人就拍清楚，不要只给模糊站边。”",
        tone: "gold",
      },
      {
        term: "悍跳",
        meaning: "狼人或假身份玩家强行跳重要神牌，最常见是悍跳预言家。",
        tableUse: "听到“悍跳狼”时，意思是发言者认为这个人不是他声称的身份，而是在抢身份线。",
        example: "“2号像悍跳，警徽流和查验理由都太硬凑。”",
        tone: "red",
      },
      {
        term: "对跳",
        meaning: "两个或更多玩家声称同一个身份，形成身份冲突。",
        tableUse: "对跳不等于必有狼人，但通常会成为当天讨论和投票焦点。",
        example: "“3号和7号对跳预言家，今天先听两边查验逻辑。”",
        tone: "blue",
      },
      {
        term: "金水",
        meaning: "预言家查验结果为好人的玩家。",
        tableUse: "真预言家的金水可信度高；假预言家也可能发假金水拉票。",
        example: "“5号是我昨晚验出的金水，先不要进狼坑。”",
        tone: "green",
      },
      {
        term: "查杀",
        meaning: "预言家查验结果为狼人的玩家。",
        tableUse: "查杀会强烈推动放逐，但要先判断报查杀的人是否可信。",
        example: "“我查杀8号，今天优先出8。”",
        tone: "red",
      },
      {
        term: "银水",
        meaning: "女巫使用解药救过的人，通常来自夜间刀口信息。",
        tableUse: "银水不等于铁好人；狼人也可能自刀制造身份。",
        example: "“4号是首夜银水，但不能因为银水就完全放下。”",
        tone: "green",
      },
      {
        term: "刀口",
        meaning: "狼人夜里选择击杀的目标。",
        tableUse: "刀口常被用来推断狼人怕谁、想污谁，或者女巫的救人信息。",
        example: "“昨晚刀口落在预言家边上，狼队可能在控轮次。”",
        tone: "red",
      },
      {
        term: "同守同救",
        meaning: "守卫守护和女巫解药同时落在同一名玩家身上。",
        tableUse: "本项目规则里同守同救会产生风险，所以守卫和女巫需要隐藏节奏、避免撞保护。",
        example: "“女巫如果救过，守卫今晚别盲守同一个位置。”",
        tone: "blue",
      },
      {
        term: "铁好人",
        alias: "铁好",
        meaning: "可信度极高、暂时几乎不进狼坑的好人位置。",
        tableUse: "铁好人通常来自强查验、强技能信息或极高质量发言，但仍可能被狼人伪造身份。",
        example: "“7号这轮可以先当铁好人用，归票权给他没问题。”",
        tone: "green",
      },
      {
        term: "明神",
        meaning: "身份已经公开或基本坐实的神职玩家。",
        tableUse: "明神会成为狼人夜间优先处理的目标，也常承担白天归票责任。",
        example: "“女巫已经明神了，今晚守卫要考虑保护节奏。”",
        tone: "green",
      },
      {
        term: "穿衣服",
        meaning: "不是某个身份，却用发言表现得像那个身份。",
        tableUse: "好人可能穿神衣挡刀，狼人也可能穿神衣抢身份；关键看动机和信息来源。",
        example: "“4号一直穿猎人衣服，但没交出猎人应有的视角。”",
        tone: "gold",
      },
      {
        term: "脱衣服",
        meaning: "撤回自己暗示过的身份，说明自己并不是那个角色。",
        tableUse: "脱衣服可能是好人解除误会，也可能是狼人压力下改口。",
        example: "“你上一轮像穿女巫衣服，这轮又脱衣服，解释一下动机。”",
        tone: "gold",
      },
      {
        term: "盲毒",
        meaning: "女巫在信息不足时使用毒药。",
        tableUse: "盲毒收益高但风险大；毒错好人会明显压缩好人轮次。",
        example: "“现在没有强查杀，女巫别盲毒焦点外的人。”",
        tone: "red",
      },
      {
        term: "空守",
        meaning: "守卫夜里选择不守护任何玩家。",
        tableUse: "空守可以避免同守同救或连续守护限制，但会放弃一晚保护机会。",
        example: "“昨晚女巫可能会救，守卫空守一晚也能接受。”",
        tone: "blue",
      },
    ],
  },
  {
    title: "发言和站边",
    description: "用来描述发言质量、逻辑选择和身份判断的桌面黑话。",
    entries: [
      {
        term: "站边",
        meaning: "选择相信某一条身份线或某个玩家的逻辑。",
        tableUse: "AI 说“站边谁”，是在问你当前更信哪一边，不是要求永久锁死。",
        example: "“我暂时站边7号预言家，但要看明天警徽流。”",
        tone: "blue",
      },
      {
        term: "狼坑",
        meaning: "当前最像狼的一组嫌疑位置。",
        tableUse: "狼坑是推理集合，会随着发言、投票、死亡信息变化。",
        example: "“我的狼坑先放2、6、9，里面至少开两狼。”",
        tone: "red",
      },
      {
        term: "抿身份",
        meaning: "通过语气、视角、发言习惯推测别人可能是什么身份。",
        tableUse: "抿身份不是硬证据，更多是辅助判断。",
        example: "“1号一直躲女巫视角，我感觉他在抿神位。”",
        tone: "gold",
      },
      {
        term: "爆点",
        meaning: "发言或行为里明显不自然、前后矛盾的地方。",
        tableUse: "AI 说“爆点”时，通常是在抓某句话为什么不像好人视角。",
        example: "“你先说不信3号，后面又跟3号归票，这里是爆点。”",
        tone: "red",
      },
      {
        term: "视角",
        meaning: "一个玩家根据自己身份和已知信息自然应该看到的局面。",
        tableUse: "视角不对常被认为有狼面，因为狼人知道更多隐藏信息。",
        example: "“你不是女巫，却一直默认昨晚救人成功，这个视角很奇怪。”",
        tone: "blue",
      },
      {
        term: "划水",
        meaning: "发言很空、不给判断、不承担投票责任。",
        tableUse: "划水玩家不一定是狼，但容易被抗推或成为狼队藏身位。",
        example: "“6号两轮都在划水，今天必须交站边。”",
        tone: "gold",
      },
      {
        term: "抗推",
        meaning: "好人因为信息少、发言弱或被污，被推上放逐位。",
        tableUse: "听到“抗推位”时，意思是这个人可能只是容易被推出去，不一定真狼。",
        example: "“别急着出9号，他像抗推好人，不像核心狼。”",
        tone: "green",
      },
      {
        term: "做好",
        meaning: "某人的行为或信息让他更像好人。",
        tableUse: "做好是相对判断，不等于身份完全坐实。",
        example: "“4号敢先点狼坑，这轮发言我给他做好。”",
        tone: "green",
      },
      {
        term: "聊爆",
        meaning: "发言中出现严重视角错误或逻辑漏洞，暴露出狼人可能性。",
        tableUse: "聊爆通常比普通爆点更重，可能直接推动当天放逐。",
        example: "“你说知道女巫没救人，这不是闭眼好人视角，已经聊爆了。”",
        tone: "red",
      },
      {
        term: "身份面",
        meaning: "从身份关系和技能信息看，一个玩家像好人还是狼人。",
        tableUse: "身份面通常和发言面、票型面一起判断。",
        example: "“5号发言一般，但身份面被2号查验做高了。”",
        tone: "gold",
      },
    ],
  },
  {
    title: "投票和轮次",
    description: "白天放逐、警长局和团队投票里常出现的说法。",
    entries: [
      {
        term: "归票",
        meaning: "明确号召大家把票集中投给某个目标。",
        tableUse: "归票能避免分票，但坏人也会用归票带节奏。",
        example: "“今天我归票8号，理由是查杀和发言爆点重合。”",
        tone: "gold",
      },
      {
        term: "冲票",
        meaning: "一组玩家快速或集中投向同一目标，像是有组织地出人。",
        tableUse: "冲票可能暴露狼队协同，也可能只是好人统一判断。",
        example: "“最后三票同时冲到5号，票型要重点复盘。”",
        tone: "red",
      },
      {
        term: "分票",
        meaning: "票散在多个目标上，导致真正想出的人未必能出局。",
        tableUse: "好人分票容易被狼队利用，所以关键轮次需要明确归票。",
        example: "“别分票，2号和8号只能先出一个。”",
        tone: "blue",
      },
      {
        term: "轮次",
        meaning: "双方还剩几次白天放逐或夜晚击杀机会的节奏。",
        tableUse: "轮次紧张时，投错一个好人可能直接让狼人获胜。",
        example: "“现在轮次不够，不能再出疑似平民抗推位。”",
        tone: "red",
      },
      {
        term: "绑票",
        meaning: "狼人票数接近或达到控制白天投票结果的状态。",
        tableUse: "接近绑票时，好人需要更重视统一票型和神牌信息。",
        example: "“如果场上三狼还在，今天分票就可能被绑票。”",
        tone: "red",
      },
      {
        term: "警上",
        meaning: "参与警长竞选的玩家。",
        tableUse: "12 人警长局里，警上发言会影响警徽归属和预言家可信度。",
        example: "“警上只有两个预言家对跳，警下票很关键。”",
        tone: "blue",
      },
      {
        term: "警徽流",
        meaning: "预言家提前说明接下来想查验谁，常用于死后留下信息。",
        tableUse: "警徽流清晰能提高可信度；乱给警徽流会被认为编造视角。",
        example: "“我的警徽流先验6再验10，如果我倒牌按这个看。”",
        tone: "gold",
      },
      {
        term: "退水",
        meaning: "警长竞选中撤回参选。",
        tableUse: "退水可能是好人让票，也可能是假跳玩家规避压力。",
        example: "“3号悍跳后退水，不能直接放下。”",
        tone: "gold",
      },
      {
        term: "票型",
        meaning: "一轮投票中每个人投给谁形成的结构。",
        tableUse: "票型是复盘狼队位置的重要证据，尤其看谁跟票、改票、分票、救人或制造平票。",
        example: "“昨天票型里，6号最后一票救了8号，关系很重。”",
        tone: "blue",
      },
      {
        term: "PK 台",
        meaning: "平票或警长竞选后进入再次发言、再次投票的候选席。",
        tableUse: "PK 台上的发言压力更大，也更容易暴露视角问题。",
        example: "“现在2号和8号上 PK 台，警下玩家必须说明票给谁。”",
        tone: "blue",
      },
      {
        term: "出人",
        meaning: "白天通过投票放逐某个玩家。",
        tableUse: "说“今天出谁”就是讨论本轮放逐目标。",
        example: "“今天不能散，必须在3和7里面出一个。”",
        tone: "red",
      },
    ],
  },
  {
    title: "狼人策略",
    description: "判断狼人行为和团队配合时常用的词。",
    entries: [
      {
        term: "倒钩",
        meaning: "狼人故意站边真预言家或攻击狼队友，以换取好人信任。",
        tableUse: "倒钩狼看起来可能很像好人；主动打狼队友也可能是在打倒钩，需要结合票型和关键轮次判断。",
        example: "“1号一直踩狼队友，可能是深水倒钩。”",
        tone: "red",
      },
      {
        term: "垫飞",
        meaning: "狼人用很差的支持方式去帮某条身份线，反而让那条线显得更假。",
        tableUse: "有人说“被垫飞”，意思是这个人可能被坏人故意拉低可信度。",
        example: "“6号发言太像垫飞7号，不能只因为6站7就打死7。”",
        tone: "red",
      },
      {
        term: "深水狼",
        meaning: "隐藏很深、长期不在焦点里的狼人。",
        tableUse: "局面后期如果焦点位都不像狼，就要回头找深水位置。",
        example: "“前排打得太热，真正的深水狼可能在10号。”",
        tone: "red",
      },
      {
        term: "自刀",
        meaning: "狼人夜里选择击杀狼队友，制造身份或骗取女巫解药。",
        tableUse: "自刀不是每局都会发生，但银水和刀口异常时会被讨论。",
        example: "“首夜银水也可能是自刀，别把他当铁好人。”",
        tone: "red",
      },
      {
        term: "卖队友",
        meaning: "狼人主动攻击或投出狼队友，换取自己的长期生存空间。",
        tableUse: "卖队友和真好人找狼很像，要看他是否在关键轮次真的承担票。",
        example: "“4号踩8号很早，但最后没投8，卖队友力度不够。”",
        tone: "red",
      },
      {
        term: "冲锋狼",
        meaning: "发言和投票都很主动地帮助狼队推进目标的狼人。",
        tableUse: "冲锋狼通常站队明显、攻击性强，但也可能伪装成强势好人。",
        example: "“6号一直帮悍跳位冲票，像冲锋狼。”",
        tone: "red",
      },
      {
        term: "狼队视角",
        meaning: "发言里不自然地知道狼人阵营才该知道的信息。",
        tableUse: "狼队视角是高危爆点，因为好人通常只能从公开信息推理。",
        example: "“你默认昨晚刀口是狼队控出来的，这像狼队视角。”",
        tone: "red",
      },
      {
        term: "做身份",
        meaning: "通过投票、攻击队友或制造行为来让自己显得像好人。",
        tableUse: "做身份不一定说明行为为真，要结合收益判断是不是狼人的表演。",
        example: "“他早踩狼队友可能是在做身份，别直接放成铁好。”",
        tone: "red",
      },
    ],
  },
];

export const ROLE_INTROS: Record<Role, RoleIntro> = {
  WEREWOLF: {
    title: "狼人",
    camp: "狼人阵营",
    goal: "让所有平民出局，或让所有神职出局。",
    timing: "夜间狼队行动时刀人；白天发言和投票时伪装好人。",
    ability: "每晚与狼队选择一名玩家作为刀口，白天通过发言、站边和投票制造好人焦点。",
    limits: "狼人知道队友，但白天只能用公开信息包装判断；被查杀、对跳或票型暴露后会进入高危位。",
    tip: "不要过早暴露狼队视角，发言时尽量用公开信息包装你的怀疑。",
  },
  WOLF_KING: {
    title: "狼王",
    camp: "狼人阵营",
    goal: "与狼队一起屠边获胜，同时利用出局枪扩大狼队收益。",
    timing: "夜间参与狼队刀人；白天被放逐或被猎人枪带走后进入开枪窗口。",
    ability: "出局枪可以带走一名玩家，常用于处理明神、强归票位或关键好人。",
    limits: "被夜间击杀或女巫毒死不能开枪；枪口不能只靠狼队私密视角决定。",
    tip: "白天不要轻易暴露狼王身份。出局枪要结合公开票型和发言压力，避免暴露狼队私密视角。",
  },
  WHITE_WOLF_KING: {
    title: "白狼王",
    camp: "狼人阵营",
    goal: "与狼队一起屠边获胜，在关键白天用自爆带人改变轮次。",
    timing: "夜间参与狼队刀人；自己的白天发言窗口可以主动自爆。",
    ability: "自爆后带走一名玩家，清空当天后续发言与投票，并直接结算进入夜晚。",
    limits: "只能在自己白天发言窗口发动，不能带走自己；过早自爆会减少狼队白天操作空间。",
    tip: "不要过早交出技能。自爆目标要优先瞄准公开高价值身份或能改变票型的关键好人。",
  },
  WOLF_BEAUTY: {
    title: "狼美人",
    camp: "狼人阵营",
    goal: "与狼队一起屠边获胜，用夜间魅惑制造白天出局连锁收益。",
    timing: "夜间狼队刀人后选择是否魅惑；自己白天出局时触发殉情。",
    ability: "每晚可以魅惑一名玩家。若狼美人因放逐、决斗或白天枪出局，当前魅惑目标会一同出局。",
    limits: "不能魅惑自己；夜间被杀或被毒不会触发白天殉情收益。",
    tip: "魅惑优先找公开高价值好人或能扰乱归票的位置，发言仍要只使用公开逻辑包装狼队视角。",
  },
  VILLAGER: {
    title: "平民",
    camp: "好人阵营",
    goal: "找出并放逐所有狼人。",
    timing: "白天发言、投票和复盘票型时发挥作用。",
    ability: "没有夜晚技能，主要依靠发言质量、投票责任和死亡信息帮助好人统一狼坑。",
    limits: "没有私有信息，不能把猜测包装成确定信息；发言过空容易成为抗推位。",
    tip: "你是闭眼视角，重点观察谁在回避逻辑、谁在强行带节奏。",
  },
  SEER: {
    title: "预言家",
    camp: "好人阵营",
    goal: "通过查验帮助好人找出狼人。",
    timing: "每晚查验一名玩家；白天选择是否公开查验和警徽流。",
    ability: "查验可得知目标属于狼人阵营或好人阵营，是好人推进狼坑的核心信息。",
    limits: "每天只能产生一条查验信息；报结果时要承担站边、警徽流和归票压力。",
    tip: "查验结果是你的核心信息。什么时候报、怎么归票，会直接影响局势。",
  },
  WITCH: {
    title: "女巫",
    camp: "好人阵营",
    goal: "利用药品保护关键好人，并找机会毒杀狼人。",
    timing: "解药未用时夜间得知刀口并选择用药；白天根据银水、毒口和发言决定是否公开信息。",
    ability: "拥有一瓶解药和一瓶毒药，解药可救刀口，毒药可毒死一名玩家。",
    limits: "首夜可以自救，第二夜起不能自救；解药用完后不再获知后续刀口，盲毒错误会明显压缩好人轮次。",
    tip: "药品很珍贵。先听发言，再决定是否公开自己的判断。",
  },
  HUNTER: {
    title: "猎人",
    camp: "好人阵营",
    goal: "用发言和最后一枪帮助好人扩大优势。",
    timing: "被狼人击杀或白天放逐后进入开枪窗口。",
    ability: "出局时可以选择开枪带走一名玩家，也可以不开枪保留信息压力。",
    limits: "被女巫毒死不能开枪；枪口需要基于公开狼面，误枪好人会损失轮次。",
    tip: "你有威慑力，但不必一开始亮身份。把枪口留给最值得怀疑的人。",
  },
  IDIOT: {
    title: "白痴",
    camp: "好人阵营",
    goal: "帮助好人找出狼人，并在关键抗推位用翻牌保住轮次。",
    timing: "白天发言和投票阶段发挥作用；被白天放逐时触发翻牌。",
    ability: "被放逐时不会出局，而是公开翻牌免死；翻牌后仍可继续发言。",
    limits: "翻牌后失去投票权，不能再作为放逐投票目标；夜间死亡、女巫毒杀和枪杀仍正常出局。",
    tip: "不要只靠技能吃抗推。翻牌前要把公开逻辑讲清楚，翻牌后更要帮有票权的好人收束狼坑。",
  },
  KNIGHT: {
    title: "骑士",
    camp: "好人阵营",
    goal: "用发言和一次决斗帮助好人验证关键狼坑。",
    timing: "白天发言结束后、投票前，系统会给骑士一次决斗窗口。",
    ability: "决斗命中狼人阵营时目标出局并结束白天；决斗命中好人阵营时骑士自己出局并继续投票。",
    limits: "整局只能发动一次，不能决斗自己；错误决斗会让好人少一神并留下投票压力。",
    tip: "决斗不是替代推理。先用公开发言、身份线和票型坐实目标狼面，再决定是否发动。",
  },
  GUARD: {
    title: "守卫",
    camp: "好人阵营",
    goal: "保护关键好人，并协助放逐所有狼人。",
    timing: "每晚选择守护目标或空守，白天复盘刀口和可能的保护节奏。",
    ability: "守护可以阻止目标当晚被狼人击杀，也可以空守来调整节奏。",
    limits: "不能连续两晚守护同一名玩家；同守同救存在风险，要避免和女巫节奏撞车。",
    tip: "守护节奏很重要。不要轻易暴露守护目标，尤其注意同守同救的风险。",
  },
};

export const ROLE_LINK_TIPS: Record<Role, RoleLinkTip[]> = {
  WEREWOLF: [
    {
      title: "特殊狼要分工隐藏",
      detail: "狼王、白狼王、狼美人都能改变白天轮次，普通狼人发言时不要过早把特殊狼位置聊出来。",
      relatedRoles: ["WOLF_KING", "WHITE_WOLF_KING", "WOLF_BEAUTY"],
      keywords: ["狼队", "特殊狼", "分工"],
    },
  ],
  WOLF_KING: [
    {
      title: "被猎人枪带走仍可开枪",
      detail: "狼王被白天放逐或被猎人带走会进入狼王枪窗口；被夜间击杀或女巫毒死不会开枪。",
      relatedRoles: ["HUNTER", "WITCH"],
      keywords: ["狼王枪", "猎人枪", "毒"],
    },
  ],
  WHITE_WOLF_KING: [
    {
      title: "自爆会跳过后续白天流程",
      detail: "白狼王只能在自己的白天发言窗口自爆。自爆带人后，当天后续发言和投票会被清空并直接结算。",
      keywords: ["自爆", "带人", "跳过投票"],
    },
  ],
  WOLF_BEAUTY: [
    {
      title: "白天出局才触发殉情",
      detail: "狼美人被放逐、骑士决斗命中、猎人枪或狼王枪带走时会触发当前魅惑目标殉情；夜间死亡或被毒不会触发。",
      relatedRoles: ["KNIGHT", "HUNTER", "WOLF_KING", "WITCH"],
      keywords: ["殉情", "魅惑", "决斗", "枪"],
    },
  ],
  VILLAGER: [
    {
      title: "平民负责把技能信息翻译成票型",
      detail: "平民没有夜间信息，价值在于把查验、银水、枪口、决斗结果转成清晰狼坑和投票方向。",
      relatedRoles: ["SEER", "WITCH", "HUNTER", "KNIGHT"],
      keywords: ["票型", "狼坑", "闭眼"],
    },
  ],
  SEER: [
    {
      title: "查验能给骑士决斗垫证据",
      detail: "查杀或稳定身份关系能帮助骑士判断是否发动决斗，但骑士仍需要结合发言和票型避免误决斗。",
      relatedRoles: ["KNIGHT"],
      keywords: ["查杀", "金水", "决斗"],
    },
  ],
  WITCH: [
    {
      title: "毒中猎人会阻断猎人枪",
      detail: "猎人被女巫毒死不能开枪。用毒前要确认收益，避免毒掉能帮好人翻轮次的猎人。",
      relatedRoles: ["HUNTER"],
      keywords: ["毒", "猎人枪", "开枪"],
    },
    {
      title: "注意同守同救",
      detail: "守卫和女巫同时保护同一目标会产生风险。女巫救人后，白天不要过早暴露具体银水节奏。",
      relatedRoles: ["GUARD"],
      keywords: ["同守同救", "解药", "银水", "守护"],
    },
  ],
  HUNTER: [
    {
      title: "被毒不能开枪",
      detail: "猎人被狼人击杀或白天放逐可以开枪，被女巫毒死不能开枪。发言时要保护枪口可信度。",
      relatedRoles: ["WITCH"],
      keywords: ["毒", "猎人枪", "枪口"],
    },
    {
      title: "枪中特殊狼会继续结算",
      detail: "猎人枪带走狼王会触发狼王枪，带走狼美人会触发殉情。枪口收益要把连锁死亡也算进去。",
      relatedRoles: ["WOLF_KING", "WOLF_BEAUTY"],
      keywords: ["狼王枪", "殉情", "连锁"],
    },
  ],
  IDIOT: [
    {
      title: "翻牌后失去投票权",
      detail: "白痴被放逐会翻牌免死，但之后不能投票；仍然可以发言、施压和留下公开逻辑。",
      relatedRoles: ["SEER", "WITCH", "HUNTER"],
      keywords: ["白痴", "翻牌", "免死", "投票权"],
    },
    {
      title: "夜间和枪杀仍正常出局",
      detail: "白痴技能只处理白天放逐。狼人夜刀、女巫毒药、猎人枪等死亡结算不会触发免死。",
      relatedRoles: ["WEREWOLF", "WITCH", "HUNTER"],
      keywords: ["夜刀", "毒", "枪", "出局"],
    },
  ],
  KNIGHT: [
    {
      title: "决斗狼美人会触发殉情",
      detail: "骑士决斗命中狼美人时，狼美人出局并触发当前魅惑目标殉情。发动前要评估连锁收益和风险。",
      relatedRoles: ["WOLF_BEAUTY"],
      keywords: ["决斗", "狼美人", "殉情"],
    },
    {
      title: "决斗最好承接查验和票型",
      detail: "骑士不是替代推理的按钮。查杀、对跳矛盾、连续冲票这些公开证据越集中，决斗越有价值。",
      relatedRoles: ["SEER"],
      keywords: ["查杀", "票型", "对跳"],
    },
  ],
  GUARD: [
    {
      title: "注意同守同救",
      detail: "守卫保护和女巫解药撞到同一人会产生风险。守卫要用空守和错位守护调节节奏。",
      relatedRoles: ["WITCH"],
      keywords: ["同守同救", "守护", "解药", "空守"],
    },
  ],
};

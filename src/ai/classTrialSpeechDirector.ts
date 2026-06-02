import type { AgentView } from "@/game/types";
import { getClassTrialCharacterLens, type ClassTrialCharacterLens } from "./classTrialCharacterLens";
import { buildClassTrialPersonaDirectorGuide } from "./classTrialPersonaDirector";

type PublicSpeechItem = AgentView["publicSummary"]["recentSpeeches"][number];

export function buildClassTrialPersonaAwareGuide(
  view: AgentView,
  options: { hasActionablePublicInfo: boolean },
): string | undefined {
  return buildClassTrialPersonaDirectorGuide(view, options);
}

export function buildClassTrialDayContinuationGuide(view: AgentView): string | undefined {
  if (view.roleCard?.theme !== "class-trial" || view.day < 2) return undefined;
  return "第二天以后是连续审判，不是重新登场；第一天早上的自我介绍已经结束，不要再自我介绍，不要用“我是角色名”开头，直接接昨夜死讯、上一轮票型或上一轮发言裂口。";
}

export function buildClassTrialDialogueRewriteGuide(
  view: AgentView,
  lens: ClassTrialCharacterLens | undefined,
): string | undefined {
  if (view.roleCard?.theme !== "class-trial") return undefined;
  const roleLine = lens ? classTrialRoleDialogueLine(lens.roleId) : "先把桌面判断换成角色自己的话，再保留必要的座位号。";
  return [
    "台词化转译：站边/票口/闭环/缺口这类狼人杀术语只能做内部骨架，出口前要换成角色自己的话。",
    "例：不要说“没给票口/站边”，改说“证词还没合上”“你把话滑过去了”“这条结构谁最受益”“这句话还没过合格线”。",
    "尤其不要把“站边和票口”“二选一站边”“检验线”“证据链不闭合”整包说出口；要拆成角色听见的证词、声音、伪装和选择。",
    "必要的查验、身份声明、投票目标可以明说；其余推进尽量像裁判场台词，而不是狼人杀复盘术语。",
    "开场不要用“大家早上好/首日信息不多/我先说一个观察点”这种房间模板；第一句先让角色站上裁判台。",
    "不要把开场评价成“低保开局”，那是系统味的质量标签；改成角色会说的证据太薄、声音太轻、结构没露出来。",
    "称呼别人优先用名字或外号，必要时才带座位号；少说“后置位的某人”，直接对“十神白夜”“雾切响子”说话。",
    "不要把所有角色都说成筹码；筹码口吻留给塞蕾丝，其他角色用自己的证据、声音、合格线、关系链或结构词。不要把每个人都写成结构分析；结构分析优先留给江之岛。",
    roleLine,
  ].join(" ");
}

export function buildClassTrialOpeningDirectorGuide(
  view: AgentView,
  lens: ClassTrialCharacterLens | undefined,
  options: {
    isLowInfoDayOneNoHardInfo: boolean;
    isFinalSpeakerToday: boolean;
    isOpeningSpeaker: boolean;
  },
): string | undefined {
  if (view.roleCard?.theme !== "class-trial" || !options.isLowInfoDayOneNoHardInfo) return undefined;
  const roleMove = lens?.openingMove ?? "用当前角色自己的方式做一个公开小动作，不念狼人杀流程模板。";
  const finalLine = options.isFinalSpeakerToday
    ? "你是今天最后一个发言位：不能说等后置位、下一位或后面核对；必须把已经出现的发言链收束成当前判断。"
    : options.isOpeningSpeaker
      ? "你是首置位：不要点名下一位做作业，不说“下一位你来接”；把共同验证条件留给全桌。"
      : "可以给后置位留下一个具体可接的问题，但必须接已发言链，不要铺一圈通用作业。";
  const fukawaLine =
    lens?.roleId === "fukawa"
      ? "腐川低信息开局必须让玩家听出十神大人的情绪坐标：可以不用等十神发言就表现公开情绪，别人空话太多就是在浪费他的时间；但落点仍是公开空话、闪躲或含糊。"
      : undefined;
  const enoshimaLine =
    lens?.roleId === "enoshima"
      ? "江之岛低信息开局必须先有分析师结构信号：说出结构、收益路径、反应模式或伪装裂口之一，再允许戏剧化。"
      : undefined;
  const naegiLine =
    lens?.roleId === "naegi"
      ? "苗木首置位必须留下共同验证点；不能只问候、复述平安夜或自我介绍。"
      : undefined;
  return [
    `首日低信息开庭导演：${roleMove}`,
    "低信息不等于无营养：不要写成“发言顺序、站边、票型一起校验”，不要写成“后置位谁跳身份、谁跟风我会记下来”。",
    "不要说“低保开局”，也不要把后置位谁会主动给怀疑对象、出人方向当成首置位任务；这会像系统流程，不像角色在裁判场发言。",
    "首置位也不要把主要内容写成“后面如果有人报身份/查验再对照”“等后面身份声明出来再对照”“等后面有人拍身份再调整”或“第一轮态度和用词后续校验”；要给当下能听懂的角色化压力点。",
    "不要把系统发言顺序说成狼队能故意安排的谜题；只能审已经说出口的接话方式、压力转向和公开身份动作。",
    "首置位不要把“发言顺序/下一位反应”当主轴，也不要说“从发言顺序上留共同验证点”或“发言顺序和前后逻辑串起来看”；如果没有前置发言，就给全桌一个能回头验证的角色动作。低信息位也不要写“等后置位谁先定人或推票，我再回头看”，不要说“后置位整体先听一轮”，不要说“后置位的各位等你们发言时”，不要说“下一位先听你的”或“下一位轮到你替我盯住”，也不要说“等所有人发完言后”“等到所有人发言结束之后”“后面的人发言时”“等听完后面几位再对照”或“等第一轮发言走完再验证”。",
    "优先给一个角色化开庭动作：希望、冷静切片、爱慕偏心、嘲讽二选一、结构分析、下注、合格线、小小不连贯或关系链。",
    finalLine,
    fukawaLine,
    enoshimaLine,
    naegiLine,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");
}

export function buildClassTrialFinalSpeakerGuide(view: AgentView, isFinalSpeakerToday: boolean): string | undefined {
  if (view.roleCard?.theme !== "class-trial" || !isFinalSpeakerToday) return undefined;
  return "今天最后一个发言位：本轮已经没有后置位，不能说“等后置位/下一位/后面核对”；把前面已经公开的发言链、身份声明或票口压力收束成当前可复盘判断。";
}

export function buildClassTrialRepeatedFocusGuide(
  view: AgentView,
  options: { currentDaySpeeches: PublicSpeechItem[] },
): string | undefined {
  if (view.roleCard?.theme !== "class-trial") return undefined;
  const speeches = options.currentDaySpeeches
    .filter((speech) => speech.speaker?.seatId !== view.mySeatId)
    .slice(-6);
  if (speeches.length < 2) return undefined;

  const motif = [
    {
      label: "框架滑移/话滑空转",
      pattern: /框架|发言顺序|验证责任|没放立场|没有放立场|没落地|没有落地|话滑|滑过去|只给.*基准/,
      shift: "不要继续说框架空或谁滑了；改看谁借这个框架拖延立场，谁抢到裁判权却不用它给出可验证事实。",
    },
    {
      label: "抽象压力空转",
      pattern: /缺口|没往下推|没有往下推|没给倾向|没有给倾向|没给方向|没有给方向|没给结论|没有给结论|只停在|空转链|空档/,
      shift: "不要继续复读“你也没往下推”。改看谁从这条空转链获益、谁借跟压洗白、谁制造第一个具体票口、谁在躲身份线，或谁把空框架变成收票工具。",
    },
    {
      label: "没给结论/验证方向",
      pattern: /没给结论|没挂出.*结论|没挂.*结论|验证方向|观察点太泛|过于泛|逻辑闭环|闭环|空转结论/,
      shift: "不要再评价“没给结论”本身；改看谁从空转获益、谁改变压力对象、谁把问题落到了具体事实。",
    },
    {
      label: "没给站边/票口",
      pattern: /没给出?站边|没给出?票口|没有给出?站边|没有给出?票口|没给.*票口|站边倾向|票口方向|观察框架太空|空壳观察|观察点.*空壳|可验证观察点/,
      shift: "不要继续评价站边或票口空缺本身；改看谁借这个空壳观察框架收票，谁把保留态度转成了具体压力。",
    },
    {
      label: "镜像攻击",
      pattern: /镜像|你也没|反过来|把球踢回|互相指责/,
      shift: "不要继续镜像反打；改看哪一环最先改变了压力方向，或谁借镜像避开了身份线。",
    },
    {
      label: "干净模板/后置责任",
      pattern: /太干净|结构干净|干净得像|像模板|模板|责任.*后置|推给后置|甩给后置|压力.*后置|无压力状态|连.*试探.*没有/,
      shift: "不要继续评价“太干净像模板”本身；改看谁利用这份干净制造票口，谁把后置责任转成了自己的收益。",
    },
    {
      label: "平安夜催票复读",
      pattern: /借平安夜催票|平安夜催票|催票.*动机|动机缺口|催票观察/,
      shift: "不要再复述谁借平安夜催票；改看谁利用这个母题收取解释权，谁把共同验证点变成自己免于表态的挡板。",
    },
    {
      label: "平安夜复读",
      pattern: /平安夜|女巫用药|空刀|刀口|救人/,
      shift: "不要继续复读平安夜；改看谁利用死亡形态制造过度确定或回避当前发言链。",
    },
  ]
    .map((item) => ({
      ...item,
      count: speeches.filter((speech) => item.pattern.test(speech.message)).length,
    }))
    .sort((a, b) => b.count - a.count)[0];

  if (!motif || motif.count < 2) return undefined;
  const lens = getClassTrialCharacterLens(view.roleCard);
  const rolePressure = lens
    ? `角色性格化压力：本轮必须用${lens.displayName}的施压方式切入，优先参考「${lens.pressureMove.join("；")}」和「${lens.attentionBias.join("；")}」。`
    : "角色性格化压力：本轮用当前角色的语气和取舍切入，不只换逻辑标签。";
  return `动态导演提示：前置位已经多次围绕「${motif.label}」打转；本轮不要只复读这类话。如果反复被抓的是同一个人的没给倾向、没给票口或缺口，不能把这句作为主轴，必须转成收益、身份成本、票型成本或反应差。${motif.shift} ${rolePressure} 换一个镜头：具体事实、身份线、反应差、票型收益或死亡形态；如果没有新事实，宁可短句保留。`;
}

export function buildClassTrialSelfIntroductionGuide(view: AgentView): string | undefined {
  if (view.roleCard?.theme !== "class-trial") return undefined;
  if (view.day === 1) {
    return "学级裁判主题局：只有第一天早上可以自然报一次角色名或座位；这不是每轮开场模板，不要每轮重复“我是……”，没有必要就直接进入判断。";
  }
  return "学级裁判主题局：第一天早上的自我介绍已经结束；不要再自我介绍，不要用“我是角色名/座位名”开头，直接接昨夜死讯、上一轮票型或上一轮发言裂口。";
}

function classTrialRoleDialogueLine(roleId: string): string {
  switch (roleId) {
    case "naegi":
      return "苗木：把怀疑说成“我们能一起确认的一点”，不要像报检查清单。";
    case "kirigiri":
      return "雾切：把闭环/缺口/检验线转成“证据还没合上”“这里少了前提”；不要说等后置位谁先动再回头看。";
    case "fukawa":
      return "腐川：把压力说成“别把话滑过去”“别把十神大人也拖进空话里”。";
    case "monokuma":
      return "黑白熊：把站边要求改成“二选一，别装没看见”，不要说“二选一站边”。";
    case "enoshima":
      return "江之岛：把票口/站边转成“这条结构谁最受益”“哪种反应最像伪装”。";
    case "celestia":
      return "塞蕾丝：把票口说成“这枚筹码先压在哪里”。";
    case "togami":
      return "十神：把低信息和站边改成“证据少也要过合格线”。";
    case "tomori":
      return "高松灯：把缺口改成“那个声音没有接上”。";
    case "anon":
      return "爱音：把站边关系改成“谁和谁的关系链突然断了”。";
    default:
      return "先把桌面判断换成角色自己的话，再保留必要的座位号。";
  }
}

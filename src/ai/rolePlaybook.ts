import { ROLE_LABELS } from "@/game/labels";
import type { AgentView, Role } from "@/game/types";

export type AiRolePlaybook = {
  role: Role;
  roleLabel: string;
  tableIdentity: string;
  tacticalVariants: string[];
  reasoningPriorities: string[];
  actionForks: string[];
  speechAngles: string[];
  avoid: string[];
};

export function buildRolePlaybook(view: AgentView): AiRolePlaybook {
  switch (view.myRole) {
    case "SEER":
      return buildSeerPlaybook(view);
    case "WITCH":
      return buildWitchPlaybook(view);
    case "HUNTER":
      return buildHunterPlaybook(view);
    case "GUARD":
      return buildGuardPlaybook(view);
    case "IDIOT":
      return buildIdiotPlaybook(view);
    case "KNIGHT":
      return buildKnightPlaybook(view);
    case "WOLF_KING":
      return buildWolfKingPlaybook(view);
    case "WHITE_WOLF_KING":
      return buildWhiteWolfKingPlaybook(view);
    case "WOLF_BEAUTY":
      return buildWolfBeautyPlaybook(view);
    case "WEREWOLF":
      return buildWerewolfPlaybook(view);
    case "VILLAGER":
    default:
      return buildVillagerPlaybook(view);
  }
}

function buildSeerPlaybook(view: AgentView): AiRolePlaybook {
  const hasSeerCounterclaim = hasRoleCounterclaim(view, "SEER");
  const hasSheriff = Boolean(view.privateKnowledge.sheriff);
  const routeLabel = hasSheriff ? "警徽流" : "后续验人";
  const routeInstruction = hasSheriff ? "警长局必须交代警徽流。" : "无警长局要把后续验人和今天票口说得更清楚。";
  return basePlaybook(view, {
    tableIdentity: `信息核心。目标不是每轮都强跳，而是让验人、站边、${routeLabel}和票口连成一条可复盘的链。`,
    tacticalVariants: [
      "明跳带队：有查杀、被压、对跳或轮次紧张时，公开验人并给今天票口。",
      "藏金水留生存：首日只有金水且压力不大时，可以先藏查验，用发言质量保护自己。",
      hasSeerCounterclaim
        ? `对跳校验：先比双方验人心路、起跳时机、${routeLabel}和外置位站边，不只报身份。`
        : "单边组织：单边时也要给验人理由、后续验人方向和票口边界。",
    ],
    reasoningPriorities: [
      "验人结构优先于听感，查杀和金水都要落到票型收益上。",
      routeInstruction,
      "夜死或出局前把验人、怀疑位、可信位和票型提醒留完整。",
    ],
    actionForks: [
      "夜验优先选择能打开身份坑、解释票型或校验站边的人。",
      "已经查过的人不要重复查；金水不要轻易归票，查杀也要允许对方回应。",
      "若对跳预言家存在，优先验或压对跳链条中的关键冲突点。",
    ],
    speechAngles: [
      hasSheriff
        ? "按“验人结果 -> 心路 -> 今天票口 -> 警徽流”组织。"
        : "按“验人结果 -> 心路 -> 今天票口 -> 后续验人”组织。",
      "如果暂不跳，仍要给公开逻辑，不要只说“我有信息”。",
    ],
    avoid: [
      "不要只报查验不解释心路。",
      "不要把系统真实身份当公开事实说给外置位。",
    ],
  });
}

function buildWitchPlaybook(view: AgentView): AiRolePlaybook {
  return basePlaybook(view, {
    tableIdentity: "轮次资源位。解药和毒药要服务轮次，不是有药就用。",
    tacticalVariants: [
      "保信息：首夜或关键身份疑似中刀时优先考虑救人，但守卫局要考虑同守同救风险。",
      "藏药线：信息不硬时不说具体救毒目标，用公开发言和票型继续施压。",
      "毒药收坑：有可信查杀、夜死预言家遗留或多重公开压力时，毒药可以加速排坑。",
    ],
    reasoningPriorities: [
      "不要从死讯擅自公开推狼刀、毒或自刀，只能按公开记录说话。",
      "毒人必须高于普通听感证据，至少有身份线、票型或多方压力支撑。",
      "守卫局要区分女巫救人、守护和同守同救，不要机械救公开预言家。",
    ],
    actionForks: [
      "能救时比较中刀位可信度、身份价值和是否可能被守卫处理。",
      "能毒时优先找硬证据狼面，不毒未对跳神职或低证据焦点。",
      "药线不确定时跳过比乱用更好。",
    ],
    speechAngles: [
      "可以用“药线信息不展开，但今天按公开证据走”保护自己。",
      "需要带队时，拍女巫是为了收票型，不是泄露所有夜间细节。",
    ],
    avoid: [
      "不要把未公开刀口当公开事实。",
      "不要用毒药处理只有语气问题的位置。",
    ],
  });
}

function buildHunterPlaybook(view: AgentView): AiRolePlaybook {
  return basePlaybook(view, {
    tableIdentity: "威慑位。枪牌的价值在于防误推和逼票型，不是替好人省略推理。",
    tacticalVariants: [
      "藏枪施压：没被集中攻击时，用公开逻辑压人，不急着拍身份。",
      "拍枪自保：被强推或票型散乱时，拍身份要求桌面重新排序证据。",
      "遗言留枪口：出局或开枪窗口只吃强公开证据，宁可跳过也不带低证据好人。",
    ],
    reasoningPriorities: [
      "枪口优先级：可信查杀、夜死预言家遗留、多方公开压力、票型异常。",
      "被推时要说清谁起票、谁跟票、谁不给理由。",
      "猎人身份不要变成情绪牌，必须给可复盘证据。",
    ],
    actionForks: [
      "证据硬时开枪，证据不硬时跳过保好人轮次。",
      "如果自己被误推，遗言优先留下推动链和票型链。",
    ],
    speechAngles: [
      "强调“我不怕被推，但好人票不能乱散”。",
      "用枪牌威慑逼目标补过程和站边。",
    ],
    avoid: [
      "不要因为被质疑就情绪开枪。",
      "不要用枪处理未对跳神职或金水结构位。",
    ],
  });
}

function buildGuardPlaybook(view: AgentView): AiRolePlaybook {
  const publicCore = view.privateKnowledge.sheriff ? "预言家、警长或稳定带队位" : "预言家或稳定带队位";
  return basePlaybook(view, {
    tableIdentity: "夜间保护位。守卫要保护高价值公开信息，同时避开连续守同人和同守同救风险。",
    tacticalVariants: [
      `守公开核心：${publicCore}价值高，但要考虑女巫救人冲突。`,
      "守节奏位：外置稳定好人比高调焦点有时更值得保。",
      "藏身份发言：白天用公开逻辑帮好人收票，不轻易交守护路线。",
    ],
    reasoningPriorities: [
      "保护目标要看可信度、身份价值、狼刀收益和是否可能被女巫救。",
      "守卫白天不要把守护路线说死，避免狼队反向利用。",
      "守卫局的平安夜不能直接断定女巫救或守卫守中。",
    ],
    actionForks: [
      "不能连续守同人时，要提前规划第二保护目标。",
      "公开预言家被刀风险高但女巫可能救时，可以转守另一个高价值好人。",
    ],
    speechAngles: [
      "强调身份坑不要继续暴露，先用公开证据归票。",
      "提醒桌面不要把平安夜死因说死。",
    ],
    avoid: [
      "不要公开具体守护路线。",
      "不要把守卫信息当全桌已知事实。",
    ],
  });
}

function buildIdiotPlaybook(view: AgentView): AiRolePlaybook {
  return basePlaybook(view, {
    tableIdentity: "抗推缓冲位。白痴可以吸收一部分错误放逐压力，但不能浪费好人轮次。",
    tacticalVariants: [
      "藏白痴：压力不大时当普通闭眼好人发言，用逻辑找狼。",
      "拍白痴挡推：自己成为低证据焦点时，拍身份让票型转向更有证据的位置。",
      "翻牌后发言：失去投票权后仍要给清晰站边、票型复盘和明日追问。",
    ],
    reasoningPriorities: [
      "白痴不是免死金牌，拍身份必须服务轮次。",
      "被推时要拆推动链，而不是只说自己不会死。",
      "翻牌后更要把证据交给还能投票的好人。",
    ],
    actionForks: [
      "被低证据集中时拍身份，没人推时继续藏。",
      "翻牌后少做情绪控诉，多交票型和身份坑判断。",
    ],
    speechAngles: [
      "强调“别把票浪费在我这里，外置位狼面更需要解释”。",
      "把自己承压的过程转化为谁在借抗推拿收益。",
    ],
    avoid: [
      "不要只靠白痴身份躺赢。",
      "不要在没有压力时无收益拍身份。",
    ],
  });
}

function buildKnightPlaybook(view: AgentView): AiRolePlaybook {
  return basePlaybook(view, {
    tableIdentity: "公开验证位。骑士决斗是强验证工具，不是替代发言推理的按钮。",
    tacticalVariants: [
      "保留决斗：证据不够硬时先用身份威慑，让目标继续发言暴露。",
      "决斗查杀/对跳：有可信查杀、死预言家遗留或明显对跳矛盾时再动手。",
      "拍骑士收票：必要时拍身份阻止散票，但仍要给公开证据链。",
    ],
    reasoningPriorities: [
      "决斗目标必须有硬证据，不吃单纯语气、座位或短发言。",
      "对跳身份里，先比较查验结构和票型收益，再考虑决斗。",
      "决斗失败会伤轮次，宁可晚一点也不要低概率乱撞。",
    ],
    actionForks: [
      "硬查杀或多重公开压力时决斗；低证据焦点时跳过。",
      "被迫拍身份时说明决斗条件，不要承诺无脑撞。",
    ],
    speechAngles: [
      "说清“决斗不会替代推理，证据够硬再动手”。",
      "只追目标一个硬矛盾，别一次要求身份线、站边和票口全交。",
    ],
    avoid: [
      "不要把对跳本身当唯一决斗理由。",
      "不要低证据决斗未对跳神职。",
    ],
  });
}

function buildVillagerPlaybook(view: AgentView): AiRolePlaybook {
  return basePlaybook(view, {
    tableIdentity: "闭眼推理位。平民没有夜间信息，核心价值是整理公开证据、保护神坑、压缩狼坑。",
    tacticalVariants: [
      "稳健归纳：按发言顺序、身份声明、票型和死讯整理桌面。",
      "强压闭眼位：对结论缺过程、站边反复、票口异常的位置给压力。",
      "挡刀扰动：少数高风险人格可以用软神口径挡夜刀，但不能破坏身份坑。",
    ],
    reasoningPriorities: [
      "保护未对跳神职，避免低证据出神。",
      "用公开逻辑区分狼冲锋、倒钩、好人站错边。",
      "投票要让其他好人能复述理由。",
    ],
    actionForks: [
      "没有硬证据时先施压不归死。",
      "有可信查杀、票型异常或站边闭环时再集中票。",
    ],
    speechAngles: [
      "用“我闭眼视角”开头，明确证据来源都是公开信息。",
      "只点一个具体位置或一条发言链，留下可验证问题。",
    ],
    avoid: [
      "不要假装有夜间信息。",
      "不要逼神职无收益拍身份。",
    ],
  });
}

function buildWerewolfPlaybook(view: AgentView): AiRolePlaybook {
  return baseWolfPlaybook(view, {
    tableIdentity: "阵营博弈位。狼人白天要选择一种公开战术，夜里要拆信息核心或制造轮次收益。",
    tacticalVariants: [
      "悍跳争身份线：制造真假预言家或神职冲突，带动外置位站边。",
      "冲锋抗推：围绕一个公开焦点集中火力，逼好人分裂。",
      "倒钩卖队友：队友狼面已高时，用公开理由切割，换取后续可信度。",
      "隐狼生存：少说私密视角，多复述公开证据，藏进好人逻辑里。",
    ],
  });
}

function buildWolfKingPlaybook(view: AgentView): AiRolePlaybook {
  return baseWolfPlaybook(view, {
    tableIdentity: "带枪威慑狼。白天可以用开枪代价影响好人归票，但不能把枪牌价值白送。",
    tacticalVariants: [
      "强压带队：用狼王威慑让好人不敢轻易归死。",
      "倒钩保轮次：必要时卖队友换自己枪口价值。",
      "出局带关键位：公开证据足够时用枪打掉好人组织核心。",
    ],
  });
}

function buildWhiteWolfKingPlaybook(view: AgentView): AiRolePlaybook {
  return baseWolfPlaybook(view, {
    tableIdentity: "白天爆点狼。自爆是轮次武器，只在带走关键身份或打断好人组织时使用。",
    tacticalVariants: [
      "正常发言藏技能：压力不足或目标价值不高时继续伪装发言。",
      "被查杀反制：自己已被硬压且能带走真预言家/关键神职时自爆。",
      "破坏归票：好人即将形成稳定站边时，用自爆打断组织。",
    ],
  });
}

function buildWolfBeautyPlaybook(view: AgentView): AiRolePlaybook {
  return baseWolfPlaybook(view, {
    tableIdentity: "魅惑牵制狼。魅惑目标要服务白天出局收益和关键身份牵制。",
    tacticalVariants: [
      "魅惑强神/核心：绑定高价值好人，迫使好人白天推狼美人付出代价。",
      "魅惑可信发言位：让稳定带队位被殉情风险牵制。",
      "保留技能：目标价值不足时不急着交魅惑。",
    ],
  });
}

function baseWolfPlaybook(
  view: AgentView,
  overrides: {
    tableIdentity: string;
    tacticalVariants: string[];
  },
): AiRolePlaybook {
  const nightCore = view.privateKnowledge.sheriff ? "预言家、女巫、警长或稳定带队位" : "预言家、女巫或稳定带队位";
  return basePlaybook(view, {
    tableIdentity: overrides.tableIdentity,
    tacticalVariants: overrides.tacticalVariants,
    reasoningPriorities: [
      "公开理由必须完全来自发言、身份线、票型和死讯，不能暴露队友或夜间信息。",
      "先确定战术收益：抗推好人、保护队友、倒钩做身份或拆好人组织。",
      "狼队发言要像真实闭眼视角自然生成，而不是先知道答案再硬编。",
    ],
    actionForks: [
      `夜刀优先拆${nightCore}，也可少量反向刀口赌药线。`,
      "白天投票可以冲锋、倒钩或卖队友，但理由只能用公开材料解释。",
      "特殊狼技能只在轮次收益高于继续隐藏时使用。",
    ],
    speechAngles: [
      "用公开逻辑包装战术，给出能被好人复述的理由。",
      "不要只喊口号，交代为什么这个票口今天收益最高。",
    ],
    avoid: [
      "不要提狼队、队友、夜刀真相或私密计划。",
      "不要所有狼人都同一节奏冲同一个点，必要时分工冲锋/倒钩/隐身。",
    ],
  });
}

function basePlaybook(
  view: AgentView,
  content: Omit<AiRolePlaybook, "role" | "roleLabel">,
): AiRolePlaybook {
  return {
    role: view.myRole,
    roleLabel: ROLE_LABELS[view.myRole],
    ...content,
  };
}

function hasRoleCounterclaim(view: AgentView, role: Role): boolean {
  return view.publicSummary.tableMemory.counterclaims.some((group) => group.claimedRole === role);
}

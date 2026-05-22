import type { AvailableHumanAction, HumanGameView, Role } from "@/game/types";
import {
  IDENTITY_BOOK_ROLE_ORDER,
  ROLE_INTROS,
  ROLE_LINK_TIPS,
  type IdentityBookFilter,
  type RoleCamp,
  type RoleLinkTip,
  type RolePhaseHint,
} from "./RoleKnowledgeContent";

export function getRoleCounts(roles: readonly Role[] | undefined): { role: Role; count: number }[] {
  const counts = new Map<Role, number>();
  for (const role of roles ?? []) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  return IDENTITY_BOOK_ROLE_ORDER.map((role) => ({ role, count: counts.get(role) ?? 0 })).filter((item) => item.count > 0);
}

export function getRoleLinkTips(role: Role, activeRoleSet?: ReadonlySet<Role>): RoleLinkTip[] {
  const tips = ROLE_LINK_TIPS[role] ?? [];
  if (!activeRoleSet || activeRoleSet.size === 0) return tips;
  return tips.filter((tip) => !tip.relatedRoles || tip.relatedRoles.some((relatedRole) => activeRoleSet.has(relatedRole)));
}

function hasHumanAction(game: HumanGameView, type: AvailableHumanAction["type"]): boolean {
  return game.availableActions.some((action) => action.type === type);
}

function getActiveHumanActionHint(role: Role, game: HumanGameView): RolePhaseHint | undefined {
  if (hasHumanAction(game, "whiteWolfKingExplode")) {
    return {
      title: "现在可以自爆",
      detail: "这是白狼王的发言窗口。自爆会带走一名玩家，并跳过今天剩余发言和投票。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "wolfKill")) {
    return {
      title: "现在可以刀人",
      detail: "狼队夜间行动中，选择刀口时仍要考虑白天如何解释局势和票型。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "wolfBeautyCharm")) {
    return {
      title: "现在可以魅惑",
      detail: "魅惑目标会在狼美人白天出局时殉情。优先考虑明神、强归票位或会改变轮次的位置。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "guardAction")) {
    return {
      title: "现在可以守护",
      detail: "选择保护目标或空守。注意不能连续守同一人，也要避开可能的同守同救。",
      tone: "blue",
    };
  }
  if (hasHumanAction(game, "seerCheck")) {
    return {
      title: "现在可以查验",
      detail: "查验结果会成为白天最重要的信息。提前想好明天是否报结果和警徽流。",
      tone: "blue",
    };
  }
  const witchAction = game.availableActions.find((action) => action.type === "witchAction");
  if (witchAction?.type === "witchAction") {
    const medicine = [witchAction.canSave ? "解药" : "", witchAction.canPoison ? "毒药" : ""].filter(Boolean).join("或") || "药品";
    return {
      title: `现在可以使用${medicine}`,
      detail: "每晚最多使用一瓶药。救人、毒人或留药都会影响后续轮次和白天发言压力。",
      tone: "blue",
    };
  }
  if (hasHumanAction(game, "knightDuel")) {
    return {
      title: "现在可以决斗",
      detail: "决斗命中狼人会直接放逐目标；决斗好人则骑士出局。先确认目标狼面足够集中。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "hunterReveal")) {
    return {
      title: "现在确认是否翻牌",
      detail: "翻牌后会公开猎人身份并必须带走一名玩家；不翻牌则不会公开猎人发动技能。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "hunterShoot")) {
    return {
      title: "现在可以开枪",
      detail: "你已经翻牌发动猎人技能，必须选择一名存活玩家带走。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "wolfKingShoot")) {
    return {
      title: "现在可以开狼王枪",
      detail: "狼王枪要优先破坏好人归票或处理明神，但理由要能从公开信息解释。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "lastWords")) {
    return {
      title: "现在轮到你留遗言",
      detail: "遗言要明确身份信息、怀疑对象和投票建议，避免只做情绪表达。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "vote") || hasHumanAction(game, "sheriffVote")) {
    return {
      title: "现在需要投票",
      detail: "投票是公开信息。给出能被复盘的理由，比单纯跟票更有价值。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "speak") || hasHumanAction(game, "sheriffSpeech")) {
    return {
      title: "现在轮到你发言",
      detail: ROLE_INTROS[role].camp === "狼人阵营" ? "尽量用公开信息包装判断，避免暴露狼队视角。" : "说明你的信息来源、狼坑和投票倾向，帮助好人统一判断。",
      tone: "green",
    };
  }
  if (hasHumanAction(game, "sheriffNominate") || hasHumanAction(game, "sheriffWithdraw") || hasHumanAction(game, "sheriffHandoff")) {
    return {
      title: "现在是警长相关操作",
      detail: "警徽会影响归票权和票重。选择时要考虑谁的信息最稳定、谁能带队复盘。",
      tone: "gold",
    };
  }

  return undefined;
}

export function getRolePhaseHint(role: Role, game: HumanGameView, isCurrentRole: boolean): RolePhaseHint {
  const activeHint = isCurrentRole ? getActiveHumanActionHint(role, game) : undefined;
  if (activeHint) return activeHint;

  const intro = ROLE_INTROS[role];
  const isWolf = intro.camp === "狼人阵营";

  if (game.result) {
    return {
      title: "对局已结束",
      detail: "现在适合回看发言、票型和技能触发点，把身份说明和复盘信息对照起来。",
      tone: "green",
    };
  }

  switch (game.phase) {
    case "NIGHT_WOLVES":
      return isWolf
        ? { title: "夜间狼队行动", detail: `${intro.title}此时参与狼队刀人，下一天要能解释刀口带来的局势。`, tone: "red" }
        : { title: "夜间等待信息", detail: `${intro.title}此时通常不行动，重点准备根据天亮信息更新狼坑。`, tone: "blue" };
    case "NIGHT_WOLF_BEAUTY":
      return role === "WOLF_BEAUTY"
        ? { title: "狼美人行动段", detail: "此时选择魅惑目标或跳过，白天自己出局时才会触发殉情。", tone: "red" }
        : { title: "夜间等待结算", detail: "狼美人行动不会公开，白天需要结合死亡和发言判断是否存在连锁风险。", tone: "blue" };
    case "NIGHT_GUARD":
      return role === "GUARD"
        ? { title: "守卫行动段", detail: "此时选择守护目标或空守，注意连续守护和同守同救限制。", tone: "blue" }
        : { title: "夜间等待守护", detail: "当前是守卫行动段，白天只会看到结算结果，不会公开守护目标。", tone: "blue" };
    case "NIGHT_SEER":
      return role === "SEER"
        ? { title: "预言家行动段", detail: "此时查验一名玩家，明天要决定查验结果如何进入发言和归票。", tone: "blue" }
        : { title: "夜间等待查验", detail: "当前是预言家行动段，白天要通过报验、对跳和票型判断真假信息。", tone: "blue" };
    case "NIGHT_WITCH":
      return role === "WITCH"
        ? { title: "女巫行动段", detail: "解药未用时可见刀口；解药用完后只能盲毒或留药。每晚最多使用一瓶药。", tone: "blue" }
        : { title: "夜间等待药品结算", detail: "当前是女巫行动段，天亮后的死亡信息可能受救人或毒人影响。", tone: "blue" };
    case "DAY_SPEECH":
      if (role === "WHITE_WOLF_KING") {
        return { title: "发言期可自爆", detail: "白狼王只有在自己的发言窗口才能自爆带人，未轮到时先听信息和找目标。", tone: "red" };
      }
      return {
        title: "白天发言期",
        detail: isWolf ? "此时重点是伪装视角、推动好人焦点，并避免狼队信息外泄。" : "此时重点是交清信息、站边理由、狼坑和投票倾向。",
        tone: isWolf ? "red" : "gold",
      };
    case "KNIGHT_DUEL":
      return role === "KNIGHT"
        ? { title: "骑士决斗窗口", detail: "现在是骑士决斗阶段。命中狼人收益很高，错决斗会让好人少一神。", tone: "gold" }
        : { title: "等待骑士选择", detail: "骑士是否发动会直接改变白天是否进入投票。", tone: "gold" };
    case "DAY_VOTE":
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE":
      return { title: "投票阶段", detail: "所有阵营都要通过投票留下公开立场。票型会成为后续复盘证据。", tone: "gold" };
    case "HUNTER_REVEAL":
      return role === "HUNTER"
        ? { title: "猎人翻牌确认", detail: "你已死亡出局，先选择是否翻牌发动技能；不翻牌不会公开猎人播报。", tone: "gold" }
        : { title: "等待出局结算", detail: "出局玩家正在完成结算，随后继续遗言或后续流程。", tone: "gold" };
    case "HUNTER_SHOT":
      return role === "HUNTER"
        ? { title: "猎人开枪窗口", detail: "猎人已经翻牌，必须选择一名存活玩家带走。", tone: "gold" }
        : { title: "等待猎人枪", detail: "猎人已翻牌发动技能，枪口会改变死亡名单和后续遗言顺序。", tone: "gold" };
    case "WOLF_KING_SHOT":
      return role === "WOLF_KING"
        ? { title: "狼王开枪窗口", detail: "狼王出局后可以开枪带人，优先破坏好人核心信息位。", tone: "red" }
        : { title: "等待狼王枪", detail: "狼王枪会改变死亡名单和好人轮次。", tone: "red" };
    case "LAST_WORDS":
      return { title: "遗言阶段", detail: "出局玩家留下的信息会影响后续站边和票型。注意区分事实、判断和情绪。", tone: "gold" };
    case "SHERIFF_NOMINATION":
    case "SHERIFF_SPEECH":
    case "SHERIFF_WITHDRAWAL":
    case "SHERIFF_PK_SPEECH":
    case "SHERIFF_HANDOFF":
      return { title: "警长流程", detail: "警徽影响归票权和票重。身份发言要围绕谁更适合带队展开。", tone: "gold" };
    case "EXILE_RESOLUTION":
    case "DAY_ANNOUNCEMENT":
      return { title: "结算阶段", detail: "此时重点看死亡、放逐和技能公开结果，再更新身份关系。", tone: "gold" };
    default:
      return {
        title: "等待流程推进",
        detail: `${intro.title}当前没有专属操作，先根据公开信息准备下一轮发言或投票。`,
        tone: isWolf ? "red" : "blue",
      };
  }
}

export function normalizeIdentityBookSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function identityBookRoleMatchesSearch(role: Role, query: string, activeRoleSet?: ReadonlySet<Role>): boolean {
  if (!query) return true;
  const intro = ROLE_INTROS[role];
  const linkTips = getRoleLinkTips(role, activeRoleSet);
  return [
    intro.title,
    intro.camp,
    intro.goal,
    intro.timing,
    intro.ability,
    intro.limits,
    intro.tip,
    ...linkTips.flatMap((tip) => [tip.title, tip.detail, ...(tip.keywords ?? [])]),
  ].some((value) => normalizeIdentityBookSearch(value).includes(query));
}

export function identityBookRoleMatchesFilter(role: Role, filter: IdentityBookFilter): boolean {
  if (filter === "all") return true;
  const camp = ROLE_INTROS[role].camp;
  return filter === "werewolves" ? camp === "狼人阵营" : camp === "好人阵营";
}

export function roleCampTone(camp: RoleCamp): { card: string; pill: string; mutedCard: string } {
  if (camp === "狼人阵营") {
    return {
      card: "border-[#e46d55]/24 bg-[#27110f]/78",
      pill: "border-[#e46d55]/25 bg-[#572017]/38 text-[#ffb1a4]",
      mutedCard: "border-[#6f5148]/20 bg-[#18110f]/62",
    };
  }

  return {
    card: "border-[#77d898]/18 bg-[#0f2118]/62",
    pill: "border-[#77d898]/25 bg-[#1d4e33]/34 text-[#a8f0b6]",
    mutedCard: "border-[#52665c]/20 bg-[#101713]/58",
  };
}

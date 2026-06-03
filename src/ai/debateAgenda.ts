import { isWolfRole } from "@/game/roleUtils";
import type { ActionTarget, AgentView, AiTableRead, SpeechPlan, TableMemory } from "@/game/types";

export type AiDebateAgenda = {
  crossExamination: string[];
  voteCommitments: string[];
  roleCoordination: string[];
  pressureLines: string[];
  avoidTraps: string[];
};

export function buildDebateAgenda(
  view: AgentView,
  options: {
    tableRead?: AiTableRead;
    target?: ActionTarget;
    plan?: SpeechPlan;
  } = {},
): AiDebateAgenda {
  const memory = view.publicSummary.tableMemory;
  const rawTarget = options.target ?? options.plan?.target ?? options.tableRead?.focus ?? memory.focus[0]?.seat;
  const target = isProtectedGoldTarget(view, options.plan, rawTarget)
    ? fallbackFocus(memory, rawTarget?.seatId)
    : rawTarget;
  const seerCounterclaim = memory.counterclaims.find((group) => group.claimedRole === "SEER");
  const latestVote = memory.voteHistory.at(-1);
  const latestShift = memory.stanceShifts.at(-1);
  const topCue = memory.reasoningCues.find((cue) => cue.kind !== "death_shape");

  const crossExamination = uniqueLines([
    seerCounterclaim
      ? `要求${formatSeatList(seerCounterclaim.claimants)}补查验心路、${
          view.privateKnowledge.sheriff ? "后续警徽流" : "下一验人"
        }和今天明确票口。`
      : undefined,
    target ? buildTargetCrossExamination(view, target, options.plan) : undefined,
    latestShift
      ? `追问${seatText(latestShift.actor)}：从${seatText(latestShift.fromTarget ?? latestShift.target)}转向${seatText(
          latestShift.toTarget ?? latestShift.target,
        )}的触发点是什么，不能只说听感变了。`
      : undefined,
    topCue?.target ? buildCueResponseLine(view, topCue.target, topCue.summary) : undefined,
    "后置位未发言时不要给全场作业；只选一个最相关位置或一条当前发言链，留下一个具体问题。",
  ]).slice(0, 5);

  const voteCommitments = uniqueLines([
    latestVote?.tally.length
      ? `上一轮票型要拆起票、补票、末票：${latestVote.tally.map((item) => `${seatText(item.target)}${item.count}票`).join("、")}。`
      : undefined,
    target ? buildTargetVoteCommitment(view, target, options.plan) : undefined,
    seerCounterclaim
      ? `预言家对跳局不要散票：先比较验人结构、发言顺序和票型收益，再决定今天跟哪条线。`
      : undefined,
    latestVote?.leaders.length
      ? `票口焦点${latestVote.leaders.map(seatText).join("、")}要区分被归票、被冲票和自己发言崩盘。`
      : undefined,
  ]).slice(0, 4);

  const roleCoordination = uniqueLines([
    ...roleSpecificAgenda(view, target, options.plan),
    view.rules.hasGuard && view.rules.guardSaveConflictKills
      ? "有守卫且同守同救会出事：公开发言只讲保护边界，不把女巫药线或守人路线说死。"
      : undefined,
    view.privateKnowledge.sheriff
      ? "有警徽局要把发言目标和警徽流/归票权连起来，别只报单点怀疑。"
      : undefined,
  ]).slice(0, 5);

  const pressureLines = uniqueLines([
    options.plan?.interaction?.line,
    options.plan?.personaCue?.line,
    target ? buildTargetPressureLine(view, target, options.plan) : undefined,
    topCue ? `把${topCue.summary}从听感升级成可验证问题：谁收益、谁跟票、谁回避回应。` : undefined,
    isWolfRole(view.myRole, view.rules.wolfRoles)
      ? "狼人公开压人要像闭眼视角：用票型、对跳和发言顺序包装，不说队友和夜间真实信息。"
      : "好人压人要给同伴可跟的理由：证据硬度、反面解释和今天票口边界都要落桌。",
  ]).slice(0, 5);

  const avoidTraps = uniqueLines([
    "不要把短发言、语气、位置感直接当铁证；必须和身份线、票型或公开矛盾组合。",
    "不要提前评价本轮未发言的后置位已经没逻辑、没回应或划水；若要追问，只留一个具体问题。",
    "若把公开死讯解释成狼刀、女巫毒、自刀或守卫信息，要说明公开规则、票型或已发言依据，不要伪装成夜间直知。",
    isWolfRole(view.myRole, view.rules.wolfRoles) ? "狼人发言不能暴露狼队分工、真实刀口和队友身份。" : undefined,
    view.myRole === "SEER" ? "真预言家不要只报结果，要交代公开可听懂的验人顺序和今天票口；报查杀后不能让查杀位靠自证推走票口。" : undefined,
  ]).slice(0, 5);

  return {
    crossExamination,
    voteCommitments,
    roleCoordination,
    pressureLines,
    avoidTraps,
  };
}

function buildTargetCrossExamination(view: AgentView, target: ActionTarget, plan: SpeechPlan | undefined): string {
  const targetText = seatText(target);
  if (isFinalBlackCheckTarget(plan, target)) {
    return `查杀${targetText}后先给今天票口，后置位只评价查杀可信度和硬身份反证。`;
  }
  if (getPlanTargetStatus(view, plan, target) === "spoken") {
    if (isLowInfoDayOneNoHardInfo(view)) {
      return `回看${targetText}只评价观察点质量和是否跟压，不要求无硬信息前先交站边或票口。`;
    }
    if (isLowInfoDayOneOpeningTarget(view, target)) {
      return `回看${targetText}只评价开口观察点是否过泛，不要要求首置位先交站边或票口。`;
    }
    return `回看${targetText}已发言的站边和票口：哪些公开点能支撑或推翻这条线。`;
  }
  return `等${targetText}发言时只留一个具体问题：他和当前身份线或票型哪一点能闭合。`;
}

function buildTargetVoteCommitment(view: AgentView, target: ActionTarget, plan: SpeechPlan | undefined): string {
  const targetText = seatText(target);
  if (isFinalBlackCheckTarget(plan, target)) {
    return `本轮围绕查杀${targetText}收票：真预言家线先压这里，外置位只给硬身份反证。`;
  }
  if (getPlanTargetStatus(view, plan, target) === "spoken") {
    if (isLowInfoDayOneNoHardInfo(view)) {
      return `${targetText}在无硬信息阶段只作轻观察，不把“没站边/没票口”当今天票口。`;
    }
    if (isLowInfoDayOneOpeningTarget(view, target)) {
      return `${targetText}作为首置位先记录观察点质量，不把“没站边/没票口”当今天票口。`;
    }
    return `本轮围绕${targetText}回看已发表站边、票口和前后是否闭合。`;
  }
  return `本轮只给${targetText}一个可验证问题，不要求他一次交站边、票口和身份线三件套。`;
}

function buildTargetPressureLine(view: AgentView, target: ActionTarget, plan: SpeechPlan | undefined): string {
  const targetText = seatText(target);
  if (isFinalBlackCheckTarget(plan, target)) {
    return `${targetText}是查杀位，压力来自验人，不靠自证推走票口。`;
  }
  if (getPlanTargetStatus(view, plan, target) === "spoken") {
    if (isLowInfoDayOneNoHardInfo(view)) {
      return `${targetText}只能按原话轻记，别用未站边或未给票口去硬打。`;
    }
    if (isLowInfoDayOneOpeningTarget(view, target)) {
      return `${targetText}首置位只能按原话轻记，不用未站边去硬打。`;
    }
    return `${targetText}已经发过言，只能回看他刚才的身份线、票口和一致性。`;
  }
  return `${targetText}如果想脱焦点，轮到他时先回应当前这一条公开矛盾。`;
}

function buildCueResponseLine(view: AgentView, target: ActionTarget, summary: string): string {
  if (hasCurrentDaySpeech(view, target.seatId)) {
    return `回看${seatText(target)}已发言内容对照这条公开线索：${summary}；只评原话能不能闭合。`;
  }
  return `等${seatText(target)}发言时回应这条公开线索：${summary}；要求给出可复述的因果链。`;
}

function isLowInfoDayOneOpeningTarget(view: AgentView, target: ActionTarget): boolean {
  if (view.day !== 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  const currentDaySpeeches = view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker);
  const targetSpeech = currentDaySpeeches.find((speech) => speech.speaker?.seatId === target.seatId);
  if (!targetSpeech || currentDaySpeeches[0]?.speaker?.seatId !== target.seatId) return false;
  return !hasHardDayOneOpeningInfo(targetSpeech.message);
}

function isLowInfoDayOneNoHardInfo(view: AgentView): boolean {
  if (view.day !== 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  const currentDaySpeeches = view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker);
  return currentDaySpeeches.length > 0 && !currentDaySpeeches.some((speech) => hasHardDayOneOpeningInfo(speech.message));
}

function hasHardDayOneOpeningInfo(message: string): boolean {
  const withoutDeathShape = message.replace(/(?:平安夜[^。！？；]{0,20})?女巫用药(?:了|处理)?|按女巫用药处理/g, "");
  return /查杀|金水|预言家|我是女巫|我女巫|猎人|骑士|守卫|警徽|归票|出人|投/.test(withoutDeathShape);
}

function isFinalBlackCheckTarget(plan: SpeechPlan | undefined, target: ActionTarget): boolean {
  if (plan?.target?.seatId === target.seatId && plan.allowedInteraction === "finalize_black_check") return true;
  return (
    plan?.claimIntent?.claimedRole === "SEER" &&
    plan.claimIntent.check?.targetSeatId === target.seatId &&
    plan.claimIntent.check.result === "WEREWOLF"
  );
}

function getPlanTargetStatus(view: AgentView, plan: SpeechPlan | undefined, target: ActionTarget): SpeechPlan["targetSpeechStatus"] {
  if (plan?.target?.seatId === target.seatId && plan.targetSpeechStatus) return plan.targetSpeechStatus;
  return hasCurrentDaySpeech(view, target.seatId) ? "spoken" : "unspoken";
}

function hasCurrentDaySpeech(view: AgentView, seatId: number): boolean {
  return view.publicSummary.recentSpeeches.some((speech) => speech.day === view.day && speech.speaker?.seatId === seatId);
}

function isProtectedGoldTarget(view: AgentView, plan: SpeechPlan | undefined, target: ActionTarget | undefined): boolean {
  if (!target) return false;
  const realGold =
    view.myRole === "SEER" &&
    view.privateKnowledge.seerChecks?.some((check) => check.targetSeatId === target.seatId && check.result === "GOOD");
  const claimedGold =
    plan?.claimIntent?.claimedRole === "SEER" &&
    plan.claimIntent.check?.targetSeatId === target.seatId &&
    plan.claimIntent.check.result === "GOOD";
  return Boolean(realGold || claimedGold);
}

function fallbackFocus(memory: TableMemory, protectedSeatId: number | undefined): ActionTarget | undefined {
  return memory.focus.find((item) => item.seat.seatId !== protectedSeatId)?.seat;
}

function roleSpecificAgenda(view: AgentView, target: ActionTarget | undefined, plan: SpeechPlan | undefined): string[] {
  const targetText = target ? seatText(target) : "当前焦点位";
  switch (view.myRole) {
    case "SEER": {
      const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
      if (!latestCheck) {
        return ["预言家暂未形成可公开验人时，先准备验人心路和明天查验优先级。"];
      }
      if (plan?.kind !== "claim-check" || plan.claimIntent?.claimedRole !== "SEER" || !plan.claimIntent.check) {
        return [
          "预言家当前计划是保留查验，不把私密验人说成公开事实。",
          "发言先用公开身份线、前置发言和票型布置验证点，等压力或轮次需要时再公开验人。",
        ];
      }
      const checkTarget = toKnownTarget(view, latestCheck.targetSeatId);
      const checkTargetSpoken = getPlanTargetStatus(view, plan, checkTarget) === "spoken";
      return [
        `预言家发言先报${seatText(checkTarget)}${latestCheck.result === "WEREWOLF" ? "查杀" : "金水"}，再解释为什么验这个位置。`,
        latestCheck.result === "GOOD"
          ? `${seatText(checkTarget)}先不进今天出人池，重点看谁无理由硬踩金水。`
          : checkTargetSpoken
            ? `查杀发出后今天票口先落${seatText(checkTarget)}；目标已发言就不要要求他本轮再补，后置位只评查杀线和硬反证。`
            : `查杀发出后今天票口先落${seatText(checkTarget)}；等他发言时只看硬身份反证，不靠自证推走票口。`,
      ];
    }
    case "WITCH":
      return [
        "女巫不要急着公开完整药线，先看谁借死亡播报带节奏。",
        "毒药只服务强公开证据：对跳、票型闭环、夜死遗产或多人公开施压同时成立才考虑。",
      ];
    case "GUARD":
      return [
        "守卫不要公开守人路线，重点提醒好人别把保护信息说死。",
        "守卫发言可以保护未对跳神职，但要给女巫留操作空间，避免同守同救。",
      ];
    case "HUNTER":
      return [`猎人先给开枪条件：${targetText}若继续解释不清才进枪口，不用身份替代推理。`];
    case "KNIGHT":
      return [`骑士先给决斗条件：${targetText}必须有硬身份矛盾或票型闭环，不能靠听感开技能。`];
    case "IDIOT":
      return ["白痴牌可以吃压但不能乱跳，重点用投票和发言留清楚好人视角。"];
    case "WOLF_KING":
      return ["狼王公开发言要制造被出后的收益交换，但不能露出狼王枪或狼队分工。"];
    case "WHITE_WOLF_KING":
      return ["白狼王只有在自身压力和目标公开价值都足够高时才考虑自爆，平时先用发言压票。"];
    case "WOLF_BEAUTY":
      return ["狼美人白天要塑造可信身份，夜间优先牵制预言家、女巫、骑士等高价值公开位置。"];
    case "WEREWOLF":
      return ["狼人白天选择悍跳、倒钩或冲锋时，都要给闭眼玩家能听懂的公开理由。"];
    case "VILLAGER":
      return ["平民的价值是收束票型和保护未对跳神职，别用无身份优势乱拍结论。"];
  }
}

function toKnownTarget(view: AgentView, seatId: number): ActionTarget {
  return view.aliveSeats.find((seat) => seat.seatId === seatId) ?? { seatId, name: `玩家${seatId}` };
}

function seatText(seat: ActionTarget): string {
  return `${seat.seatId}号${seat.name}`;
}

function formatSeatList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map(seatText).join("、") : "无人";
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return [...new Set(lines.map((line) => line?.trim()).filter((line): line is string => Boolean(line)))];
}

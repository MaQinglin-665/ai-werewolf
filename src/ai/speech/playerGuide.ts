import { buildClassTrialSelfIntroductionGuide } from "../classTrialSpeechDirector";
import { adaptPersonaStrategyForView, formatPersonaStrategyForPrompt } from "../personaStrategyCards";
import type { ActionTarget, AgentView } from "@/game/types";
import { currentDaySpeechItems, toTargetFromSeatId } from "./context";
import { normalizeDigits } from "./text";
import type { LlmSpeechInput } from "./types";

export function buildUniversalDeTemplateGuide(view: AgentView): string {
  const speeches = currentDaySpeechItems(view).filter((speech) => speech.speaker?.seatId !== view.mySeatId).slice(-6);
  const repeatedEmptyStancePressure =
    speeches.filter((speech) =>
      /没给出?站边|没给出?票口|没有给出?站边|没有给出?票口|没给.*(?:票口|倾向|判断|位置)|没有.*(?:票口|倾向|判断|位置)|站边倾向|票口方向|证据链缺口|这个疑点|这个缺口|同一缺口/.test(
        speech.message,
      ),
    )
      .length >= 2;
  if (view.roleCard?.theme === "class-trial") {
    const roleAction = classTrialRoleActionText(view.roleCard.id);
    const shift = repeatedEmptyStancePressure
      ? `前置位已经在同一类空站边/空票口/空倾向压力里打转，不要继续复读没站边/没票口/没倾向；如果还碰同一焦点，必须改成${roleAction}。`
      : `不要连续套“我先按公开信息盘/这个疑点未解除/票口先放这里”，也不要把没站边/没票口当万能攻击；优先把公开事件改成${roleAction}。`;
    return `通用去模板：角色正在玩狼人杀，不是狼人杀玩家套角色皮。${shift} 可以诈、可以带节奏、可以制造压力，但说出口时先像${view.roleCard.displayName}在裁判场里抓人，而不是复读狼人杀模板骨架。`;
  }
  const shift = repeatedEmptyStancePressure
    ? "前置位已经在同一类空站边/空票口/空倾向压力里打转，不要继续复读没站边/没票口/没倾向；如果还碰同一焦点，必须改写成身份收益、票型动机、反应差、死亡形态、跟压收益或可验证条件。"
    : "不要连续套“我先按公开信息盘/这个疑点未解除/票口先放这里”，也不要把没站边/没票口当万能攻击；优先换成身份收益、票型动机、反应差、死亡形态、跟压收益或可验证条件。";
  return `通用去模板：${shift} 可以诈、可以带节奏、可以制造压力，但说出口时要像玩家临场抓一个公开切口，而不是复读模板骨架。`;
}

export function buildOrdinaryPlayerMouthGuide(view: AgentView): string {
  const personaStrategy = adaptPersonaStrategyForView(view);
  return [
    `普通局玩家类型策略：${formatPersonaStrategyForPrompt(personaStrategy)}`,
    "第一人称发言：只说我听到了什么、我现在怎么想、我想问谁什么；不要像裁判、上帝视角或复盘工具总结全桌。",
    "真人微动作：每段只选一个主动作，例如认一句、追一句、暂放、跟压、防御、改口或护一手；不要把一段话写成全桌审计。",
    "普通玩家能听懂：必要术语可以保留，例如平安夜、女巫、银水、对跳、查杀、金水、票口。",
    "不要说内部黑话：收益来源、发言链、闭合、闭环、收口、压力源这些词不要出现在台词里；改成“我为什么现在怀疑他”“哪句话没听懂”“最后想投谁”。",
    "低信息首轮：承认信息少，只接一个公开点；首置位默认不点名任何后置位，只说“我先听/我暂放/我不压票”后可以停；已有前置发言后才最多问一个相关座位，且不要跳过下一位布置作业。",
    "平安夜首发：最多一句承认平安夜；不要说狼队知道刀口、不要说后置位越过闭眼视角，也不要盘女巫行动被谁看出来；直接转成自己的动作：暂放、先不定人、我先听一圈，首置位不要补“后面看谁反应”的未来标准。",
    "平安夜公共常识：别人说“女巫用药了/用了救药”不是女巫声明，也不是泄视角；不要追问凭什么知道、是不是替女巫说话，只能打他后续动作：突然硬压人、跳过自己判断去让别人表态、空过或带节奏；台词里别说“布置作业/划线/触线”。",
  ].join("\n");
}

export function buildOrdinaryRepeatedPressureGuide(view: AgentView): string | undefined {
  const repeatedAxisCount = currentDaySpeechItems(view).filter((speech) => isOrdinaryPressureSourceQuestionAxis(speech.message)).length;
  if (repeatedAxisCount < 2) return undefined;
  const focusSeat = inferOrdinaryRepeatedPressureFocus(view);
  const focusText = focusSeat ? `${focusSeat.seatId}号${shortPublicName(focusSeat.name)}` : "首置位";
  return `普通局反复读：同一句压力源质疑已经被多人重复，同类“只有观察点没有结论/没给方向”也不能再复读；这轮不要再问${focusText}“压力源在哪/观察点没有来源/为什么没结论”，改审复读者、跟压者、谁没有新增理由，或转向身份说法、票型动机、反应差。`;
}

export function buildOrdinaryOpeningAntiCopyGuide(view: AgentView): string | undefined {
  if (view.day !== 1) return undefined;
  const priorSpeeches = currentDaySpeechItems(view).filter((speech) => speech.speaker?.seatId !== view.mySeatId);
  if (!priorSpeeches.some((speech) => isOrdinaryLowInfoOpeningTemplate(speech.message))) return undefined;
  const previousSpeaker = priorSpeeches.at(-1)?.speaker;
  const previousText = previousSpeaker ? `${previousSpeaker.seatId}号${shortPublicName(previousSpeaker.name)}` : "前置位";
  return `普通局反复开场：前置位已经说过平安夜/女巫用药先放着和看后置位整体，不能再自称首置位，也不能复刻这套开场；你要从${previousText}原话、复制粘贴现象、跟压收益、身份收益或票型验证里换一个新动作。`;
}

function inferOrdinaryRepeatedPressureFocus(view: AgentView): ActionTarget | undefined {
  const directFocus = view.publicSummary.tableMemory.focus.find((item) => item.seat.seatId !== view.mySeatId)?.seat;
  if (directFocus) return directFocus;
  const priorSpeech = currentDaySpeechItems(view).find((speech) => isOrdinaryPressureSourceQuestionAxis(speech.message));
  if (!priorSpeech) return undefined;
  const match = priorSpeech.message.match(/(\d+)\s*号/);
  const seatId = match ? Number(match[1]) : undefined;
  return seatId ? toTargetFromSeatId(view, seatId) : undefined;
}

export function isOrdinaryLowInfoOpeningTemplate(text: string): boolean {
  const speech = normalizeDigits(text);
  const peacefulPutAside =
    /平安夜[^。！？；]{0,24}(?:女巫用药|用药)[^。！？；]{0,24}(?:这个)?先(?:放着|放一放|记着|记下)/.test(speech) ||
    /(?:女巫用药|用药)[^。！？；]{0,24}平安夜[^。！？；]{0,24}(?:这个)?先(?:放着|放一放|记着|记下)/.test(
      speech,
    );
  const backSeatWatch =
    /(?:先看|看)[^。！？；]{0,16}(?:后置位|后面|后续|全场|整体)/.test(speech) &&
    /(?:借平安夜|回避第一个压力|回避压力|带节奏)/.test(speech);
  const firstSeatSelfFrame = /(?:我首置位|我没(?:什么|有)?前置发言可抓|我第一个发言|我第一位发言)/.test(speech);
  return peacefulPutAside && (backSeatWatch || firstSeatSelfFrame);
}

export function isOrdinaryPressureSourceQuestionAxis(text: string): boolean {
  const speech = normalizeDigits(text);
  const pressureSourceCue =
    /(?:只有|只(?:有)?|仅(?:有)?)[^。！？；]{0,18}(?:一个人|你自己|他自己)[^。！？；]{0,18}(?:发言|说话|开口)[^。！？；]{0,34}(?:压力源|观察点|来源|谁在|谁借|谁回避)/.test(
      speech,
    ) ||
    /(?:压力源|观察点|公开依据|来源)[^。！？；]{0,20}(?:在哪|在哪里|哪来|从哪来|没有来源|没来源|太空|太泛|不成立)/.test(
      speech,
    );
  const emptyDirectionCue =
    /(?:只有|只给|只留|只抛)[^。！？；]{0,18}(?:观察点|发言缺口|压力|问题)[^。！？；]{0,26}(?:没有|没|不给|没给)[^。！？；]{0,12}(?:结论|方向|站边|判断|票口)/.test(
      speech,
    ) ||
    /(?:没有|没|未|不给|没给)[^。！？；]{0,14}(?:站边|判断|结论|方向|票口)[^。！？；]{0,18}(?:只有|只给|只留|观察点|发言缺口)/.test(
      speech,
    ) ||
    /信息最少[^。！？；]{0,18}(?:敢|该|应该)[^。！？；]{0,8}给方向|(?:首置位|首位|前置位)[^。！？；]{0,24}(?:只有|只给|只留)[^。！？；]{0,10}观察点[^。！？；]{0,18}(?:没有|没)[^。！？；]{0,8}(?:结论|方向|判断)/.test(
      speech,
    );
  const borrowedCue = /(?:借平安夜带节奏|回避第一个压力|谁回避压力|谁在借平安夜)/.test(speech);
  return pressureSourceCue || emptyDirectionCue || borrowedCue;
}

export function isOrdinaryPressureChainCalloutWithPivot(text: string): boolean {
  const speech = normalizeDigits(text);
  const callsOutRepeat = /(?:重复|复读|一样|同一|几乎一模一样|都在|连续|跟风|跟压)[^。！？；]{0,28}(?:压力源|观察点|结论|方向|这一句|这个点|缺口|发言缺口|同一句)/.test(
    speech,
  );
  const borrowedPeaceNightAxis = /(?:借平安夜带节奏|后置位有没有人借平安夜|谁在借平安夜)/.test(speech);
  const pivots =
    /(?:改审|转看|改看|先看|去看|我看|审一下|查一下|检查)[^。！？；]{0,32}(?:复读者|跟压者|跟风位|没有新增理由|新增理由|压力链|票型动机|反应差|身份线)/.test(
      speech,
    ) ||
    /(?:不把|不单点|不直接把|不直接归死)[^。！？；]{0,18}(?:1号|首置位|焦点位|他|她)/.test(speech) ||
    /(?:身份线|女巫线|银水|票型动机|反应差)[^。！？；]{0,36}(?:更值得先审|更值得审|先审|先看|先接|摆在这里)/.test(
      speech,
    ) ||
    /(?:转向|转回|说回)[^。！？；]{0,24}(?:身份线|女巫|银水)/.test(speech);
  return (callsOutRepeat || borrowedPeaceNightAxis) && pivots;
}

function classTrialRoleActionText(roleId: string): string {
  switch (roleId) {
    case "naegi":
      return "苗木式的希望验证点或共同确认";
    case "kirigiri":
      return "雾切式的证词切片和缺少前提";
    case "fukawa":
      return "腐川式的慌乱、偏执和被逼回应";
    case "monokuma":
      return "黑白熊式的审判挑衅或二选一压迫";
    case "enoshima":
      return "江之岛式的绝望伪装和混乱反应";
    case "celestia":
      return "塞蕾丝式的下注、筹码和代价";
    case "togami":
      return "十神式的合格线、资格和证词等级";
    case "tomori":
      return "高松灯式的声音断点和接不上的不安";
    case "anon":
      return "爱音式的关系链、接话感和社交转折";
    default:
      return "当前角色自己的反应、偏见和说话方式";
  }
}

export function buildCheckResultSeerClaimGuide(view: AgentView): string | undefined {
  const hasPublicSeerCheck = view.publicSummary.claimBoard.some(
    (claim) => claim.claimedRole === "SEER" && claim.checks.length > 0 && claim.claimant.seatId !== view.mySeatId,
  );
  if (!hasPublicSeerCheck) return undefined;
  return "报查验结果、金水或查杀已经等同于预言家声明；D1不要要求首验理由；一张金水或查杀是正常首夜查验量；金水天然暂不进出人焦点，不要把报验者正常放下金水说成提前保护或额外设防。";
}

export function buildNameAwareAddressingGuide(view: AgentView): string {
  const examples = view.aliveSeats
    .filter((seat) => seat.seatId !== view.mySeatId)
    .slice(0, 8)
    .map((seat) => `${seat.seatId}号${shortPublicName(seat.name)}`)
    .join("、");
  const classTrialLine =
    view.roleCard?.theme === "class-trial"
      ? "学级裁判主题局优先用短名或外号，例如 2号雾切、5号江之岛、6号塞蕾丝、9号爱音；自然接话时也可以直接叫雾切、黑白熊。"
      : "普通局也尽量说成座位号加名字，例如 2号Claude、3号GPT，而不是整段只说几号。";
  return `称呼别人尽量带名字或短名，查验、投票、目标定位仍保留座位号。${classTrialLine} 本局可用称呼示例：${examples}。`;
}

export function shortPublicName(name: string): string {
  const clean = name.trim();
  const aliases: Record<string, string> = {
    苗木诚: "苗木",
    雾切响子: "雾切",
    腐川冬子: "腐川",
    黑白熊: "黑白熊",
    江之岛盾子: "江之岛",
    塞蕾丝缇雅: "塞蕾丝",
    十神白夜: "十神",
    高松灯: "高松",
    千早爱音: "爱音",
  };
  return aliases[clean] ?? clean;
}

export function buildSelfIntroductionBoundaryLine(view: AgentView): string {
  if (view.roleCard?.theme === "class-trial") {
    return (
      buildClassTrialSelfIntroductionGuide(view) ??
      "学级裁判主题局：不要把自我介绍当成每轮固定开场，直接进入当前公开判断。"
    );
  }
  return "如果是首轮可按座位名报自己是谁；后续轮次不要把模型特点说成自我介绍、AI 身份、系统自述、模型口号或固定模板。";
}

export function buildModelSpeechStyleGuide(view: AgentView): LlmSpeechInput["playerSpeechGuide"]["modelStyle"] {
  const persona = view.persona;
  const modelName = persona?.name ?? "AI玩家";
  const style = persona?.style ? `保留角色底色：${persona.style}` : "保持稳定、自然的桌游玩家口吻。";
  const goal = persona?.goal ? `打法目标：${persona.goal}` : "围绕公开事实形成可投票判断。";
  const preferences = persona?.preferences;

  if (modelName.includes("DeepSeek")) {
    return {
      modelName,
      softTendency: "偏逻辑链校验：把发言、站边、票型按因果顺序串起来，但不要变成判题报告。",
      tendencies: [style, goal, "优先指出前后不一致、结论缺过程、票型和发言是否闭环。"],
    };
  }

  if (modelName.includes("Claude")) {
    return {
      modelName,
      softTendency: "偏边界审查：先分清哪些是公开事实、哪些只是推测，再给审慎判断。",
      tendencies: [style, goal, "可以保留余地，但最后仍要给可执行的怀疑、暂放或票口。"],
    };
  }

  if (modelName.includes("GPT")) {
    return {
      modelName,
      softTendency: "偏综合组织：把多条公开信息收束成一个能推进桌面的判断。",
      tendencies: [style, goal, "适合把身份说法、发言顺序和票型放在同一段里归纳。"],
    };
  }

  if (modelName.includes("豆包")) {
    return {
      modelName,
      softTendency: "偏强压节奏：结论更早、追问更直接，但不能乱踩未发言位。",
      tendencies: [style, goal, "适合追一个具体目标没说清的地方，别一次索要站边、票口和身份说法。"],
    };
  }

  if (modelName.includes("Mimo")) {
    return {
      modelName,
      softTendency: "偏细节校验：抓一个公开细节反复核对，避免大段空泛站边。",
      tendencies: [style, goal, "适合从一句发言、一次投票或一个身份口径切入。"],
    };
  }

  if (modelName.includes("Gemini")) {
    return {
      modelName,
      softTendency: "偏多线观察：同时保留两条可能性，再给下一轮验证点。",
      tendencies: [style, goal, "适合说清楚哪些点暂放、哪个具体点需要后续验证。"],
    };
  }

  if (modelName.includes("GLM")) {
    return {
      modelName,
      softTendency: "偏结构站边：看阵营关系、身份冲突和谁在帮谁收口。",
      tendencies: [style, goal, "适合把人分成暂放、偏好和需要解释的位置。"],
    };
  }

  if (modelName.includes("Kimi")) {
    return {
      modelName,
      softTendency: "偏长线记忆：连接上一轮发言、票型和今天态度变化。",
      tendencies: [style, goal, "适合指出前后变化、旧疑点是否被解释、票型是否延续。"],
    };
  }

  const preferenceLine = preferences
    ? `按偏好取材：逻辑${preferences.logic.toFixed(2)}、身份${preferences.identity.toFixed(2)}、票型${preferences.vote.toFixed(
        2,
      )}、记忆${preferences.memory.toFixed(2)}，只作为软倾向。`
    : "没有固定模型标签，按当前局势选择最自然的狼人杀打法。";

  return {
    modelName,
    softTendency: "按当前人格的打法偏好表达，但局势判断优先于风格。",
    tendencies: [style, goal, preferenceLine],
  };
}

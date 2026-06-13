import { ROLE_LABELS } from "@/game/labels";
import type { AgentView, SpeechPlan } from "@/game/types";

import { currentDaySpeechItems, getCurrentDayDeathShape } from "./context";
import {
  AI_SPEECH_MAX_CHARS,
  AI_SPEECH_MAX_SENTENCES,
  CLASS_TRIAL_HARD_INFO_SPEECH_MAX_CHARS,
  CLASS_TRIAL_HARD_INFO_SPEECH_MAX_SENTENCES,
} from "./limits";
import {
  findPublicBlackCheckAgainstSelf,
  hasPublicSeerCheck,
  isLowInfoDayOneNoHardInfo,
  isLowInfoDayOneOpening,
} from "./publicState";
import { formatSeatNumberList, seatText } from "./text";
import type { LlmSpeechContract, LlmSpeechInput } from "./types";

export function buildSpeechContract(
  plan: SpeechPlan,
  speechOrder?: LlmSpeechInput["publicContext"]["speechOrder"],
  view?: AgentView,
): LlmSpeechContract {
  const move = resolveContractMove(plan);
  const isClassTrialSpeech = view?.roleCard?.theme === "class-trial";
  const limits = resolveSpeechLimits(view, plan);
  const isHardInfoSpeech = isClassTrialHardInfoSpeech(view, plan, move);
  const isOrdinaryLowInfoFirstSeat = isOrdinaryLowInfoFirstSeatWaterPass(view, plan, move);
  const targetSpeechStatus = plan.targetSpeechStatus ?? "none";
  const allowedInteraction = plan.allowedInteraction ?? "none";
  const targetLabel = plan.target ? seatText(plan.target) : "目标位";
  const talkingPoints = contractTalkingPoints(plan);
  const mustSay: string[] = [];
  const mayAsk: string[] = [];
  const mustNotAsk: string[] = [
    "不能列第一、第二、第三，也不要说“盘问议程”“票口条件”“可改票条件”。",
  ];
  const lowInfoNoHardInfoContractLine =
    "首日无硬信息阶段不要把任何已发言位“没站边、没给票口、没给怀疑对象”当攻击点；只能审计观察点是否有收益、谁在跟压或谁过早定身份。";
  let voteBoundary: string | undefined;

  if (isClassTrialSpeech) {
    mustNotAsk.push(
      view.day >= 2
        ? "第一天早上的自我介绍已经结束；不要再自我介绍，不要用“我是角色名/座位名”开头。"
        : "学级裁判自我介绍只允许第一天早上自然一次；不要每轮重复“我是角色名/座位名”。",
      "学级裁判发言不要套“身份-信息-站边-票口”四件套；禁止“我是闭眼好人”“信息不多先听后置”等普通狼人杀模板开场。",
    );
    if (view.day === 1 && !isHardInfoSpeech && hasPublicSeerCheck(view)) {
      mustNotAsk.push(
        "D1已有预言家报验后，不要追问或攻击首验理由；一张金水或查杀是正常首夜查验量。",
        "报金水后，金水天然暂不进出人焦点；不要把报验者正常放下金水说成提前保护或额外设防。",
        "平安夜和女巫用药只可短句带过，不能当主要攻击点或完整发言。",
      );
    }
  }

  if (targetSpeechStatus === "spoken" && plan.target) {
    mustNotAsk.push(`不能要求${targetLabel}后续补充、轮到时回应、后面解释、当场回答、再跳身份或再报查验。`);
  }
  if (targetSpeechStatus === "unspoken" && plan.target) {
    mustNotAsk.push(`不能评价${targetLabel}已经回应差、信息少、没站边或只给结论。`);
  }
  if (speechOrder?.speakersAlreadyFinished.length) {
    mustNotAsk.push(
      `已经发言的前置位包括${formatSeatNumberList(
        speechOrder.speakersAlreadyFinished,
      )}，这些位置本轮不会再轮到；只能回看原话，不能要求他们后续补充、轮到时回应、后面解释、当场回答、再跳身份或再报查验。`,
    );
  }
  if (speechOrder?.currentDayUnspokenSeats.length) {
    const nextUnspoken = speechOrder.currentDayUnspokenSeats[0];
    mustNotAsk.push(
      `未发言后置位按今日顺序是${formatSeatNumberList(
        speechOrder.currentDayUnspokenSeats,
      )}；如果只是留观察，默认不点具体后置位；如果确实要问人，优先只问“下一位${seatText(
        nextUnspoken,
      )}”一个具体问题；连续点多个后置位时按今日顺序连续，不要无理由跳过中间座位；不要把已发言位置写成“等他轮到”或“后面再补”；除非已有公开查验/身份声明，不能提前说更信、更疑、放好、狼坑、票口、焦点、先压或收票。`,
    );
  }
  if (view && !isHardInfoSpeech && isLowInfoDayOneOpening(view)) {
    const openingSpeaker = currentDaySpeechItems(view)[0]?.speaker;
    if (openingSpeaker) {
      mustNotAsk.push(`不要把${seatText(openingSpeaker)}没站边、没给票口或没给怀疑对象当攻击点；只能评价观察点是否过泛，或审计后续谁借这个点做收益。`);
      mustNotAsk.push(lowInfoNoHardInfoContractLine);
    } else {
      mustNotAsk.push("你是低信息首置位：只给自己的当前处理，默认不点名任何后置位，不要求下一位或远后置位立刻站边、给票口、报怀疑对象，也不要补“等后面看谁”的未来标准。");
    }
  }
  if (
    view &&
    !isHardInfoSpeech &&
    isLowInfoDayOneNoHardInfo(view) &&
    currentDaySpeechItems(view).length > 0 &&
    !mustNotAsk.includes(lowInfoNoHardInfoContractLine)
  ) {
    mustNotAsk.push(lowInfoNoHardInfoContractLine);
  }
  if (plan.claimIntent?.strength === "soft" && !plan.playMotive?.allowIdentityClaim) {
    const roleLabel = ROLE_LABELS[plan.claimIntent.claimedRole];
    mustNotAsk.push(`不要把软身份边界说成明确${roleLabel}身份。`);
    mayAsk.push(plan.playMotive?.line ?? "可以保留底牌威慑，但不要明拍身份。");
  }

  if (isOrdinaryLowInfoFirstSeat) {
    mustSay.length = 0;
    mayAsk.length = 0;
    mustSay.push("只说自己当前处理：信息少，先听一圈、暂放或不压票。");
    return {
      move,
      target: plan.target,
      targetSpeechStatus,
      allowedInteraction,
      mustSay: uniqueContractLines(mustSay).slice(0, 3),
      mayAsk: [],
      mustNotAsk: uniqueContractLines(mustNotAsk).slice(0, 6),
      voteBoundary,
      maxSentences: limits.maxSentences,
      maxChars: limits.maxChars,
    };
  }

  switch (move) {
    case "review_spoken_target":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints : [`回看${targetLabel}已经发表的公开内容。`]));
      mayAsk.push(`只能回看${targetLabel}已发表的内容是否闭合。`);
      break;
    case "ask_unspoken_target":
      mustSay.push(...talkingPoints.slice(0, 1));
      mayAsk.push(`可以要求${targetLabel}轮到时只回应一个具体公开点。`);
      break;
    case "claim_black_check":
      if (isClassTrialSpeech) {
        mustSay.push(
          `我是预言家，昨晚查验结果是${targetLabel}查杀。`,
          `今天我的票先压${targetLabel}。`,
          `谁要保${targetLabel}，就公开和我的结果对撞。`,
        );
      } else {
        mustSay.push("我是预言家。", `${targetLabel}是查杀。`, `今天票口先压${targetLabel}。`);
      }
      mayAsk.push(isClassTrialSpeech ? "谁要保查杀位，就公开和我的结果对撞。" : "外置位只给硬身份反证。");
      if (isClassTrialSpeech && view?.day === 1) {
        mustNotAsk.unshift("D1不要要求预言家解释首验理由；身份、查杀结果和今天如何处理查杀位足够。");
        mustNotAsk.unshift("平安夜只作公开背景，不能用它解释为什么要压查杀位。");
      }
      mustNotAsk.push(
        `不能说${targetLabel}解释闭环就改票。`,
        `不能把${targetLabel}自证当改票条件。`,
      );
      voteBoundary = isClassTrialSpeech
        ? `今天我的票先压住${targetLabel}这条查杀；谁要保查杀位，就公开和我的结果对撞。`
        : `今天先压${targetLabel}；只有外置更硬身份信息能改变结构。`;
      break;
    case "claim_gold_check":
      mustSay.push("我是预言家。", `${targetLabel}是金水。`);
      mayAsk.push(`看谁反打或硬踩${targetLabel}。`);
      mustNotAsk.push(`不能把${targetLabel}作为今天出人焦点、怀疑焦点或压票对象。`);
      break;
    case "identity_claim":
      if (isClassTrialSpeech && plan.claimIntent?.claimedRole === "HUNTER" && plan.claimIntent.strength === "hard") {
        mustSay.push("我拍猎人，枪在这里。");
      } else if (isClassTrialSpeech && plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
        mustSay.push("我拍女巫，药线由我来收。");
      } else {
        mustSay.push(plan.claimIntent ? `身份声明要与${ROLE_LABELS[plan.claimIntent.claimedRole]}一致。` : "身份声明必须和当前计划一致。");
      }
      if (plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
        const savedTarget = view?.myRole === "WITCH" ? view.privateKnowledge.witch?.savedTarget : undefined;
        if (savedTarget) mustSay.push(`平安夜我救了${savedTarget.seatId}号，${savedTarget.seatId}号是银水。`);
      }
      if (plan.playMotive?.line) mustSay.push(plan.playMotive.line);
      mayAsk.push(...(plan.target ? [`围绕${targetLabel}留下一个公开验证点。`] : ["围绕公开身份说法留下一个验证点。"]));
      break;
    case "lock_vote":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints : [`今天票口先围绕${targetLabel}。`]));
      voteBoundary = plan.target ? `票口优先压${targetLabel}，理由必须来自公开信息。` : undefined;
      break;
    case "explain_vote":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints : ["解释自己的站边或票口变化。"]));
      mayAsk.push("只留一个后续验证点。");
      break;
    case "soft_pressure":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints.slice(0, 2) : [`回看${targetLabel}已经说出口的内容。`]));
      mayAsk.push(plan.target ? `围绕${targetLabel}留一个公开验证点。` : "围绕公开发言留一个验证点。");
      break;
    default:
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints.slice(0, 2) : ["只按公开信息给一条判断。"]));
      mayAsk.push("不强行制造目标，只留下公开验证点。");
      break;
  }

  return {
    move,
    target: plan.target,
    targetSpeechStatus,
    allowedInteraction,
    mustSay: uniqueContractLines(mustSay).slice(0, 3),
    mayAsk: uniqueContractLines(mayAsk).slice(0, 2),
    mustNotAsk: uniqueContractLines(mustNotAsk).slice(0, 6),
    voteBoundary,
    maxSentences: limits.maxSentences,
    maxChars: limits.maxChars,
  };
}

export function resolveSpeechLimits(
  view: AgentView | undefined,
  plan?: SpeechPlan,
): Pick<LlmSpeechContract, "maxSentences" | "maxChars"> {
  if (view?.roleCard?.theme !== "class-trial") {
    if (isOrdinaryLowInfoFirstSeatWaterPass(view, plan)) {
      return { maxSentences: 2, maxChars: 90 };
    }
    return { maxSentences: AI_SPEECH_MAX_SENTENCES, maxChars: AI_SPEECH_MAX_CHARS };
  }
  return {
    maxSentences: CLASS_TRIAL_HARD_INFO_SPEECH_MAX_SENTENCES,
    maxChars: CLASS_TRIAL_HARD_INFO_SPEECH_MAX_CHARS,
  };
}

export function isOrdinaryLowInfoFirstSeatWaterPass(
  view: AgentView | undefined,
  plan?: SpeechPlan,
  move: LlmSpeechContract["move"] | undefined = plan ? resolveContractMove(plan) : undefined,
): boolean {
  if (!view) return false;
  if (view.roleCard?.theme === "class-trial") return false;
  if (view.day !== 1) return false;
  if (!isLowInfoDayOneNoHardInfo(view)) return false;
  if (currentDaySpeechItems(view).length > 0) return false;
  if (getCurrentDayDeathShape(view) === "death") return false;
  if (move && move !== "none") return false;
  if (plan?.claimIntent?.strength === "hard" || plan?.playMotive?.allowIdentityClaim) return false;
  if (plan?.speechMove === "identity_claim") return false;
  return true;
}

export function isClassTrialHardInfoSpeech(
  view: AgentView | undefined,
  plan: SpeechPlan,
  move: LlmSpeechContract["move"] = resolveContractMove(plan),
): boolean {
  if (view?.roleCard?.theme !== "class-trial") return false;
  if (move === "claim_black_check" || move === "claim_gold_check" || move === "identity_claim") return true;
  if (plan.claimIntent?.strength === "hard") return true;
  return Boolean(findPublicBlackCheckAgainstSelf(view));
}

export function resolveContractMove(plan: SpeechPlan): LlmSpeechContract["move"] {
  if (plan.speechMove) return plan.speechMove;
  if (plan.allowedInteraction === "finalize_black_check") return "claim_black_check";
  if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check?.result === "GOOD") return "claim_gold_check";
  if (plan.claimIntent && (plan.claimIntent.strength === "hard" || plan.playMotive?.allowIdentityClaim)) return "identity_claim";
  if (plan.kind === "rally") return "lock_vote";
  if (plan.allowedInteraction === "review_spoken") return "review_spoken_target";
  if (plan.allowedInteraction === "ask_future") return "ask_unspoken_target";
  if (plan.kind === "defend" || plan.kind === "explain-vote") return "explain_vote";
  if (plan.target) return "soft_pressure";
  return "none";
}

function contractTalkingPoints(plan: SpeechPlan): string[] {
  return plan.talkingPoints
    .filter((point) => point !== plan.interaction?.line && point !== plan.personaCue?.line)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 2);
}

export function uniqueContractLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

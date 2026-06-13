import { isWolfRole } from "@/game/roleUtils";
import type { AgentView, SpeechPlan } from "@/game/types";

import { deadSeerGoldSeatIds } from "../protectedGold";
import { hasCurrentDayDeathShapeMention } from "./context";
import type { LlmSpeechContract, SpeechStrictness } from "./types";

export function buildSpeechConstraints(
  view: AgentView,
  plan: SpeechPlan,
  strictness: SpeechStrictness,
  speechContract: LlmSpeechContract,
): string[] {
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);
  const deathShapeConstraints = deathShapeAlreadyDiscussed
    ? [
        "狼人杀允许低信息推测：可以说“我猜/我倾向/大概率/按规则推”，并用这种推测推动追问、站边和票口。",
        "死亡形态已作为背景处理；本轮不要主动复读药线、刀口、毒口或空刀，只在直接相关时一句带过，然后接怀疑、暂放、追问或投票条件。",
        "普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态。",
      ]
    : [
        "狼人杀允许低信息推测：可以说“我猜/我倾向/大概率/按规则推”，并用这种推测推动追问、站边和票口。",
        "首夜单死只一句带过：狼刀成功，女巫没救。平安夜只一句带过：女巫用了救药。首夜狼刀通常没有公开意图信息，不追问别人为什么刀这个人。说完必须接自己的判断动作。",
        "普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态。",
        "正常发言不要展开空刀或药线；不要把死亡形态当成发言主线，也不要把它交给后置位重复解释。",
      ];
  const interactionConstraints = buildSpeechInteractionConstraints(plan, speechContract);
  const sharedConstraints = [...deathShapeConstraints, ...interactionConstraints];
  if (strictness === "strict") {
    const strictConstraints = [
      ...sharedConstraints,
      "只输出白天公开发言，不输出投票、夜晚动作或解释 JSON 之外的内容。",
      "必须遵守 speechPlan 的 kind、target、talkingPoints、interaction、personaCue 和 claimIntent，不新增身份声明或查验。",
      "每段发言必须锚定至少一个局内对象或公开事件：座位、上一段发言、死讯、票型、身份声明或查验；不要输出寒暄、规则解释或模型自述。",
      "currentDayUnspokenSeats 里的后置位只能被点一个具体问题，不得说他们已经发言少、信息量少、没站边、没回应死讯或只给结论；speakersAlreadyFinished 只能回看，不能要求后续补充。",
      "如果要打已经发过言的位置，直接落成“我按这个缺口压票/挂观察/不直接归死”；不要写“你再解释、你补、你复述、轮到你回应”。",
      "发言只像桌上玩家一样引用公开发言、死讯、票型和身份声明；不要解释信息来自哪里。",
      "可以质疑或站边公开声明，但必须写成公开判断，不写成确定真相。",
      "不要套固定模板；每句话都要服务于当前局面里的一个判断、保留、追问或公开动作。",
      "参考 expertStrategy 的博弈原则组织逻辑，但不要逐字复述成攻略。",
    ];

    if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check) {
      strictConstraints.push(
        `必须报出 ${plan.claimIntent.check.targetSeatId}号${
          plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水"
        }，不得改目标或结果。`,
      );
      if (plan.claimIntent.check.result === "GOOD") {
        strictConstraints.push("报金水后不得同段把该金水当出人焦点、怀疑焦点或压票对象；重点应转向谁反打或硬踩金水。");
      } else {
        strictConstraints.push("真预言家报查杀后不能让查杀位靠自证把今天焦点推走；先用自己的视角压住查杀，反对者必须公开和你的结果对撞。");
      }
    }

    if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
      strictConstraints.push("狼人视角只用于表达策略，不得在发言里暴露狼队或把狼队友报成查杀。");
    }

    const protectedDeadSeerGoldIds = [...deadSeerGoldSeatIds(view.publicSummary.tableMemory)];
    if (protectedDeadSeerGoldIds.length > 0) {
      strictConstraints.push(
        `Public dead seer gold protection: dead seer gold seat ${protectedDeadSeerGoldIds.join(
          ", ",
        )} should be treated as protected public gold water; do not pressure, exile, or make it today's vote focus unless you cite hard public counter-evidence.`,
      );
    }

    return strictConstraints;
  }

  return sharedConstraints;
}

function buildSpeechInteractionConstraints(plan: SpeechPlan, speechContract: LlmSpeechContract): string[] {
  const target = plan.target ? `${plan.target.seatId}号` : "无目标";
  const contract = `SpeechPlan interaction contract: speechContract.move=${speechContract.move}; target=${target}; targetSpeechStatus=${
    plan.targetSpeechStatus ?? "none"
  }; allowedInteraction=${plan.allowedInteraction ?? "none"}。`;
  switch (plan.allowedInteraction) {
    case "review_spoken":
      return [contract, "allowedInteraction=review_spoken：只能回看目标已发表内容，不能要求目标后续补充、轮到时回应或后面解释。"];
    case "ask_future":
      return [contract, "allowedInteraction=ask_future：目标尚未发言，只能留一个与当前发言链相关的具体问题；不能提前评价他已经回应差、信息少或只给结论。"];
    case "finalize_black_check":
      return [contract, "allowedInteraction=finalize_black_check：真预言家查杀先压住查杀位，不给查杀位靠自证推走今天焦点；反对者必须公开和你的结果对撞。"];
    default:
      return [contract];
  }
}

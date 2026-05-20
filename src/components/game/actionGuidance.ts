import type { AvailableHumanAction, HumanGameView } from "@/game/types";

export type ActionGuidance = {
  title: string;
  visibility: string;
  outcome: string;
  detail: string;
};

export function buildActionGuidance(action: AvailableHumanAction, game: Pick<HumanGameView, "phaseLabel" | "myRoleLabel">): ActionGuidance {
  const rolePrefix = game.myRoleLabel ? `${game.myRoleLabel} · ` : "";

  switch (action.type) {
    case "seerCheck":
      return {
        title: "选择查验目标",
        visibility: "私密行动",
        outcome: "提交后获得查验结果，只进入你的私密视角。",
        detail: `${rolePrefix}${game.phaseLabel}的信息不会直接公开，白天需要你自己决定是否报验人。`,
      };
    case "witchAction":
      return {
        title: "确认今晚用药",
        visibility: "私密行动",
        outcome: "用药后本夜直接结算；解药和毒药状态会被消耗。",
        detail: action.canSave && action.saveTarget ? `当前刀口是 ${action.saveTarget.seatId}号，先判断是否值得救。` : "没有必须发动的药，跳过也是合法选择。",
      };
    case "guardAction":
      return {
        title: "选择守护",
        visibility: "私密行动",
        outcome: "守护会在夜间结算，不能连续两晚守同一名玩家。",
        detail: action.lastGuardedSeatId ? `上次守护过 ${action.lastGuardedSeatId}号，本夜需要换目标或空守。` : "可以守自己、守外置位，或空守保留节奏。",
      };
    case "wolfKill":
      return {
        title: "决定今晚刀口",
        visibility: "狼队私密",
        outcome: "目标会在夜间死亡结算中公布，除非被技能影响。",
        detail: "选择高价值目标时，也要考虑女巫、守卫和白天票型收益。",
      };
    case "wolfBeautyCharm":
      return {
        title: "选择魅惑目标",
        visibility: "狼队私密",
        outcome: "如果你白天被放逐，当前魅惑目标会殉情出局。",
        detail: action.canSkip ? "不魅惑可以保留后续弹性；魅惑后目标会覆盖上一晚选择。" : "本夜必须在合法目标中选择一名玩家。",
      };
    case "speak":
    case "sheriffSpeech":
    case "lastWords":
      return {
        title: action.type === "lastWords" ? "留下最后视角" : "组织公开发言",
        visibility: "公开信息",
        outcome: "发言会进入全桌公开记忆，AI 后续会按这段话更新站边。",
        detail: "优先说清楚身份线、票型理由和你希望下一位玩家回答的问题。",
      };
    case "vote":
      return {
        title: "锁票前确认归票",
        visibility: "公开影响",
        outcome: "所有人投完后统一开票，票型会进入复盘。",
        detail: action.canAbstain ? "可以弃票，但有效投票更容易推动桌面形成结论。" : "本轮必须在候选目标中投出一票。",
      };
    case "knightDuel":
      return {
        title: "判断是否发动决斗",
        visibility: "公开强动作",
        outcome: "命中狼人会直接放逐目标；戳错好人则骑士出局。",
        detail: action.canSkip ? "证据不足时保留技能，先进入投票通常更稳。" : "本轮需要在合法目标中选择决斗对象。",
      };
    case "hunterShoot":
    case "wolfKingShoot":
      return {
        title: "确认开枪目标",
        visibility: "公开强动作",
        outcome: "开枪后目标会立刻进入死亡结算。",
        detail: action.canSkip ? "没有明确证据时可以不开枪，避免把局势打散。" : "本轮需要选择一名目标带走。",
      };
    case "whiteWolfKingExplode":
      return {
        title: "确认自爆收益",
        visibility: "公开强动作",
        outcome: "自爆会终止当前白天并带走一名目标。",
        detail: "只在带走关键身份或打断好人归票时发动，收益要高于继续发言。",
      };
    case "sheriffNominate":
      return {
        title: "选择警徽参与方式",
        visibility: "公开流程",
        outcome: "上警后需要公开竞选发言；留在警下则参与投票。",
        detail: action.canRun ? "想组织桌面就上警；想先听发言就留在警下。" : "当前不能上警，只能留在警下参与后续流程。",
      };
    case "sheriffWithdraw":
      return {
        title: "确认是否退水",
        visibility: "公开流程",
        outcome: "退水后退出警长竞选，留在警上则继续接受警下投票。",
        detail: action.canWithdraw ? "如果发言压力过高或身份收益不够，可以退水保留空间。" : "当前不能退水，需要继续竞选流程。",
      };
    case "sheriffVote":
      return {
        title: "锁定警长票",
        visibility: "公开流程",
        outcome: "警长票会决定警徽归属，PK 轮只在候选人之间选择。",
        detail: action.isPk ? "这是 PK 复投，优先看两名候选人的身份线和归票能力。" : "优先投给能组织票型、能解释身份线的人。",
      };
    case "sheriffHandoff":
      return {
        title: "处理警徽",
        visibility: "公开流程",
        outcome: "移交会让目标获得警徽；撕警徽则本局不再有警长。",
        detail: action.canTear ? "没有可信接徽人时可以撕警徽。" : "当前只能移交给合法目标。",
      };
    case "continue":
      return {
        title: "自动推进",
        visibility: "观看流程",
        outcome: "继续播放 AI 行动或系统结算，直到再次轮到你操作。",
        detail: action.description,
      };
  }
}

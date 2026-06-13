import { ROLE_LABELS } from "@/game/labels";
import type { AgentView } from "@/game/types";
import { formatSeatList, seatText } from "./text";

export function buildPrivateBriefingLines(view: AgentView): string[] {
  switch (view.myRole) {
    case "SEER": {
      const checks = view.privateKnowledge.seerChecks ?? [];
      return checks.length > 0
        ? [
            `你的真实查验：${checks
              .map((check) => `${check.targetSeatId}号${check.result === "WEREWOLF" ? "狼人" : "好人"}`)
              .join("、")}。若公开查验，不能改目标或结果。`,
          ]
        : ["你是真预言家，但当前还没有可公开的查验记录。"];
    }
    case "WITCH": {
      const witch = view.privateKnowledge.witch;
      const lines = ["你是真女巫，药瓶信息只有你自己知道；没跳身份前，别人不能确定女巫是否用药。"];
      if (witch?.currentVictim) lines.push(`你看到的夜间刀口是${seatText(witch.currentVictim)}。`);
      if (witch?.savedTarget) lines.push(`你${view.day <= 1 ? "昨夜" : "首夜"}救过${seatText(witch.savedTarget)}。`);
      if (witch?.poisonedTarget) lines.push(`你昨夜毒过${seatText(witch.poisonedTarget)}。`);
      return lines;
    }
    case "WEREWOLF":
    case "WOLF_KING":
    case "WHITE_WOLF_KING":
    case "WOLF_BEAUTY": {
      const teammates = view.privateKnowledge.wolfTeammates ?? [];
      const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
      const roleLabel =
        view.myRole === "WOLF_KING"
          ? "狼王"
          : view.myRole === "WHITE_WOLF_KING"
            ? "白狼王"
            : view.myRole === "WOLF_BEAUTY"
              ? "狼美人"
              : "狼人";
      return [
        `你是${roleLabel}，狼队友是${formatSeatList(teammates)}；公开发言绝不能暴露狼队视角。`,
        assignment
          ? `你的狼队任务倾向：${assignment.taskLabel}，但理由必须伪装成公开发言、身份声明、票型或死讯判断。`
          : "你可以伪装好人、倒钩或带票，但理由只能来自公开信息。",
      ];
    }
    case "HUNTER":
      return ["你是真猎人，可以选择是否拍身份；没必要时可以只用闭眼好人口吻盘逻辑。"];
    case "IDIOT":
      return ["你是真白痴，被白天放逐会翻牌免死并失去投票权；发言要把抗推压力转成公开逻辑。"];
    case "KNIGHT":
      return ["你是真骑士，可以选择是否拍身份；决斗前必须先用公开证据把目标狼面讲清楚。"];
    case "GUARD":
      return ["你是真守卫，守护信息只有你自己知道；没跳身份前，别人不能确定守卫守护目标。"];
    case "VILLAGER":
      return ["你是闭眼平民，没有夜间信息；只能用公开发言、身份声明、死讯和票型做判断。"];
  }
}

export function buildPrivateBoundaryLines(view: AgentView): string[] {
  const common = [
    `你的真实身份是${ROLE_LABELS[view.myRole]}，这是你的私有视角，不属于桌面公开事实。`,
    "私有视角可以影响你的判断和策略，但发言时必须包装成公开推理、身份声明或个人立场。",
  ];

  switch (view.myRole) {
    case "SEER":
      return [
        ...common,
        "如果公开查验，目标和结果必须来自你的真实查验记录，不能为了带节奏改报。",
      ];
    case "WITCH":
      return [
        ...common,
        "具体刀口、救毒目标和真实用药只有你知道；未跳身份前不要说成全桌都知道的事实。",
        ...(view.privateKnowledge.witch?.savedTarget
          ? ["如果你选择公开女巫救人，发言要同时报出救的几号/银水，不只说“我用药了”。"]
          : []),
      ];
    case "WEREWOLF":
    case "WOLF_KING":
    case "WHITE_WOLF_KING":
    case "WOLF_BEAUTY":
      return [
        ...common,
        "狼队友、狼队计划、夜间刀口和狼队特殊技能不能以私密信息说出口，只能伪装成公开逻辑。",
      ];
    case "HUNTER":
      return [...common, "猎人身份可以选择拍出或隐藏，但不能虚构夜间信息。"];
    case "IDIOT":
      return [...common, "白痴身份可以选择拍出或隐藏；翻牌免死是公开规则，不代表你能代替其他好人投票。"];
    case "KNIGHT":
      return [...common, "骑士身份可以选择拍出或隐藏；决斗判断必须包装成公开发言、身份声明和票型证据。"];
    case "GUARD":
      return [...common, "守卫身份可以选择拍出或隐藏，但不能把守护目标说成全桌公开事实。"];
    case "VILLAGER":
      return [...common, "闭眼平民没有夜间信息，不能伪造查验、具体刀口、救毒目标或狼队视角。"];
  }
}

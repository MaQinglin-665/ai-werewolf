import type { AgentView } from "@/game/types";

export type PublicInferenceLayers = {
  facts: string[];
  highProbability: string[];
  lowProbability: string[];
  privateUnknowns: string[];
};

export function buildPublicInferenceLayers(view: AgentView): PublicInferenceLayers {
  const memory = view.publicSummary.tableMemory;
  const deathText = [...view.publicSummary.recentDeaths, ...memory.deathAnnouncements].join("；");
  const hasPeaceNight = /平安夜/.test(deathText);
  const hasNoGuardWitchShape = !view.rules.hasGuard && (hasPeaceNight || memory.reasoningCues.some((cue) => cue.kind === "death_shape"));
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);

  const facts = [
    "公开事实：只能使用公开发言、死亡播报、身份声明、公开查验声明和已公开票型。",
    view.publicSummary.recentDeaths.at(-1) ? `公开事实：最新死讯是${view.publicSummary.recentDeaths.at(-1)}。` : undefined,
    view.publicSummary.claimBoard.length > 0
      ? `公开事实：已有身份声明 ${view.publicSummary.claimBoard.slice(-4).map((claim) => claim.summary).join("；")}。`
      : undefined,
  ];

  const highProbability = [
    !view.rules.hasGuard
      ? hasNoGuardWitchShape
        ? deathShapeAlreadyDiscussed
          ? "高概率推断：平安夜已作为公开死亡形态背景处理，本轮不必复读药线或空刀。"
          : "高概率推断：无守卫平安夜发言里短句说“女巫用药了”即可。"
        : "高概率推断：无守卫局若出现平安夜，发言里短句说“女巫用药了”即可，不需要让后置位重复解释。"
      : undefined,
    ...memory.reasoningCues
      .filter((cue) => cue.weight === "strong")
      .slice(0, 3)
      .map((cue) => `高概率推断：${cue.summary}`),
    ...memory.focus
      .slice(0, 2)
      .map((focus) => `高概率推断：${focus.seat.name}是当前公开焦点，原因是${focus.reasons.slice(0, 2).join("；")}。`),
  ];

  const lowProbability = [
    "低概率边界：空刀只作为边界存在，本轮不主动展开。",
    ...memory.reasoningCues
      .filter((cue) => cue.weight === "light")
      .slice(0, 2)
      .map((cue) => `低概率或软信号：${cue.summary}`),
  ];

  const privateUnknowns = [
    "私密未知：不能确定其他玩家真实身份，除非这是自己的身份、狼队视角或真实预言家查验。",
    "私密未知：非女巫不能确定女巫是谁、具体救了几号、具体刀口或毒口；真女巫可以公开真实救毒信息；药瓶状态只能按公开死亡形态推理，不能伪装成私密直知。",
    "私密未知：公开死讯只能产生推测和压力，不能把死因细节说成确定事实。",
  ];

  return {
    facts: compactLayer(facts),
    highProbability: compactLayer(highProbability),
    lowProbability: compactLayer(lowProbability),
    privateUnknowns: compactLayer(privateUnknowns),
  };
}

function hasCurrentDayDeathShapeMention(view: AgentView): boolean {
  return view.publicSummary.recentSpeeches
    .filter((speech) => speech.day === view.day && speech.speaker)
    .some((speech) => /平安夜|女巫用药|药线|空刀/.test(speech.message));
}

function compactLayer(lines: Array<string | undefined>): string[] {
  return [...new Set(lines.map((line) => line?.trim()).filter((line): line is string => Boolean(line)))].slice(0, 6);
}

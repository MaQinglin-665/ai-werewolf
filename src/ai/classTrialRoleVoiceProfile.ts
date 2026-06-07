import type { AiCharacterRoleCard } from "@/game/types";

export function formatClassTrialRoleVoiceProfile(
  roleCard: AiCharacterRoleCard | undefined,
): string | undefined {
  const profile = roleCard?.classTrialVoiceProfile;
  if (!profile) return undefined;

  const scenarioLines = Object.entries(profile.scenarioReactions).map(([key, reaction]) =>
    `场景反应 ${key}：刺激=${reaction.innerDrive}；动作=${reaction.speechMove}；避开=${reaction.mustAvoid}`,
  );
  const alignmentLines = Object.entries(profile.alignmentReactions).map(([key, reaction]) =>
    `阵营反应 ${key}：驱动=${reaction.speechDrive}；风险=${reaction.failureMode}`,
  );

  return [
    listLine("人格底色", profile.personalityCore),
    listLine("价值偏向", profile.valueBiases),
    listLine("受压反应", profile.reactionTendencies),
    listLine("少量口癖点缀", profile.lightCatchphrases),
    listLine("禁止复读", profile.overuseBans),
    ...scenarioLines,
    ...alignmentLines,
    listLine("可接受形态", profile.acceptableForms),
    listLine("不可接受形态", profile.unacceptableForms),
    "角色感优先于推理最优；允许符合人物的误判、偏见、自保或伪装，但必须仍在狼人杀公开信息内完成发言。",
    "口癖只能轻量点缀，不能把角色变成固定台词或固定动作。",
  ]
    .filter(Boolean)
    .join("\n");
}

function listLine(label: string, values: string[]): string | undefined {
  return values.length > 0 ? `${label}：${values.join("；")}` : undefined;
}

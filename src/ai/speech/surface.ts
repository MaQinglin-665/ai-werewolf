import type { ActionTarget, ClaimCheck } from "@/game/types";

export function containsOutOfGameSpeech(speech: string): boolean {
  return /作为(?:一个)?AI|语言模型|大模型|模型无法|我无法参与|无法直接参与|系统|提示词|prompt|JSON|assistant|user|developer|后台|根据提供的信息|这局游戏的规则|我会根据.*进行分析|以下是|总结如下/i.test(
    speech,
  );
}

export function containsCheckCue(speech: string, check: ClaimCheck): boolean {
  const targetText = `${check.targetSeatId}号`;
  if (!speech.includes(targetText)) return false;
  return check.result === "WEREWOLF" ? /查杀|狼人/.test(speech) : /金水|好人/.test(speech);
}

export function containsTargetReference(speech: string, target: ActionTarget): boolean {
  return speech.includes(`${target.seatId}号`) || speech.includes(target.name);
}

export function containsPublicSeatReference(speech: string, target: ActionTarget): boolean {
  return speech.includes(`${target.seatId}号`) || (target.name !== "你" && speech.includes(target.name));
}

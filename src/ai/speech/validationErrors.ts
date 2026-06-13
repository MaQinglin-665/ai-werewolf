import type { AgentView } from "@/game/types";

export function splitSpeechValidationErrors(
  view: AgentView,
  errors: string[],
): { hard: string[]; soft: string[] } {
  if (view.roleCard?.theme === "class-trial") return { hard: errors, soft: [] };
  const soft = errors.filter(isOrdinarySoftSpeechValidationError);
  return {
    hard: errors.filter((error) => !isOrdinarySoftSpeechValidationError(error)),
    soft,
  };
}

function isOrdinarySoftSpeechValidationError(error: string): boolean {
  return (
    /^(?:普通局(?:发言不要像全桌复盘|发言黑话堆叠|发言不要套兜底模板链|不要把内部审稿词说出口|后置位不要复读同一发言缺口|不要连续围绕同一句做同质审计|不要用卡句式口癖|不要连续复读卡句式|强身份不要用审判腔|不要复刻前置位低信息开场|首置位不要用审稿元话术开场|首置位不要设置未来观察点|低信息首置位不要点名后置位布置任务|低信息不要跳过下一位直接布置后置任务|低信息首置位划水不应成为主要攻击点|短发言必须有自己的处理动作|不要复制前置位整段表述|认同一半必须说清落点|改口必须说清新判断|发言疑似被截断|不要用后置链路审计当前已过发言|发言不要出现重复口误|当前位不要把已过的后置反应说成还要看|不要用观察位模板继续等后面接线|不要重复追问已经给过的依据)|要求已发言的\d+号后续补充发言|speechContract要求只回看\d+号已发表内容|speechContract要求只能等待\d+号后续发言|把本轮未发言的\d+号当成已发言评价|提前评价未发言的\d+号站边或可信度)$/.test(
      error,
    )
  );
}

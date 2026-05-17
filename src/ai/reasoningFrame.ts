import { isWolfRole } from "@/game/roleUtils";
import type { AgentView, TableMemory } from "@/game/types";

export type AiReasoningFrame = {
  hardEvidence: string[];
  softSignals: string[];
  counterHypotheses: string[];
  validationQuestions: string[];
  persuasionGoals: string[];
};

export function buildReasoningFrame(view: AgentView): AiReasoningFrame {
  const memory = view.publicSummary.tableMemory;
  const strongCues = memory.reasoningCues.filter((cue) => cue.weight === "strong");
  const softerCues = memory.reasoningCues.filter((cue) => cue.weight !== "strong");
  const latestVote = memory.voteHistory.at(-1);
  const topFocus = memory.focus[0];
  const latestShift = memory.stanceShifts.at(-1);

  const hardEvidence = uniqueLines([
    ...strongCues.map(formatCue),
    ...memory.counterclaims.map(
      (group) => `${group.claimedRoleLabel}对跳是硬身份材料：${group.claimants.map(seatText).join(" vs ")}`,
    ),
    ...memory.seerLegacies.slice(0, 2).map((legacy) => `夜死预言家遗留只按公开遗产处理：${legacy.summary}`),
    latestVote?.exiled ? `上一轮放逐结果：${seatText(latestVote.exiled)}出局，票型需要回看。` : undefined,
    latestVote?.tiedSeatIds.length
      ? `上一轮平票焦点：${latestVote.tiedSeatIds.map((seatId) => `${seatId}号`).join("、")}。`
      : undefined,
  ]).slice(0, 6);

  const softSignals = uniqueLines([
    ...memory.focus.map((item) => `焦点${seatText(item.seat)}：${item.reasons.join("、")}，分数${item.score}`),
    ...softerCues.map(formatCue),
    ...memory.speechInfluence.map((item) => item.summary),
    ...memory.publicSignals.slice(-4),
  ]).slice(0, 6);

  const counterHypotheses = uniqueLines([
    memory.counterclaims.length > 0
      ? "身份对跳至少保留两种解释：真身份被悍跳冲击，或狼人借对跳制造站边分歧。"
      : undefined,
    latestShift
      ? `站边变化不要直接定狼：${latestShift.summary}，可能是好人回头、狼倒钩、冲锋转向或被票型压力逼出来。`
      : undefined,
    topFocus
      ? `${seatText(topFocus.seat)}是焦点时，要反问：如果他是好人，谁在借这个焦点拿票型收益。`
      : undefined,
    latestVote?.leaders.length
      ? `票型焦点${latestVote.leaders.map(seatText).join("、")}不等于天然狼位，要区分被归票、被冲票和自爆发言造成的票。`
      : undefined,
    "边角位、语气、短发言、划水只能作为软状态，必须和身份线、票型或站边变化组合后才有出人价值。",
  ]).slice(0, 5);

  const validationQuestions = uniqueLines([
    topFocus
      ? `追问${seatText(topFocus.seat)}：你的站边、票口和前面发言能否闭环，是否有可复述的公开理由。`
      : undefined,
    memory.counterclaims[0]
      ? `让${memory.counterclaims[0].claimants.map(seatText).join("、")}分别补查验心路、警徽流/后续验人和今天票口。`
      : undefined,
    latestVote
      ? `复盘上一轮票型：谁先起票，谁补票，谁最后跟票，理由是否和发言一致。`
      : undefined,
    latestShift ? `要求${seatText(latestShift.actor)}解释站边变化触发点，不能只说“听感变了”。` : undefined,
    view.publicSummary.claimBoard.length > 0
      ? "校验公开身份声明：未对跳神职先保护，对跳身份优先比较验人、心路、票型收益。"
      : "当前身份声明少，先让每个焦点位给出明确站边和可验证票口。",
  ]).slice(0, 5);

  const persuasionGoals = isWolfRole(view.myRole, view.rules.wolfRoles)
    ? [
        "狼人公开目标：用公开证据包装战术，制造站边分歧、保护队友或抗推好人，但不暴露狼队信息。",
        "说服方式可以选逻辑说服、可信度塑造或情绪施压，但理由必须像闭眼玩家能听懂的公开视角。",
      ]
    : [
        "好人公开目标：让其他好人知道为什么跟票、何时改票、哪些位置暂时不能动。",
        "发言不要只报怀疑名单，要把证据硬度、反面解释和下一轮验证点说清楚。",
      ];

  return {
    hardEvidence: withFallback(hardEvidence, "当前没有强公开证据，先保护未对跳强身份，低证据目标只施压观察。"),
    softSignals: withFallback(softSignals, "当前软状态也不集中，先收集站边、发言顺序和票口。"),
    counterHypotheses,
    validationQuestions,
    persuasionGoals,
  };
}

function formatCue(cue: TableMemory["reasoningCues"][number]): string {
  const evidence = cue.evidence.length > 0 ? `；依据：${cue.evidence.slice(0, 2).join("、")}` : "";
  return `${cue.summary}${evidence}`;
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return [...new Set(lines.map((line) => line?.trim()).filter((line): line is string => Boolean(line)))];
}

function withFallback(lines: string[], fallback: string): string[] {
  return lines.length > 0 ? lines : [fallback];
}

function seatText(seat: { seatId: number; name: string }): string {
  return `${seat.seatId}号${seat.name}`;
}

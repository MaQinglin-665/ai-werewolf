import type { AgentView } from "@/game/types";
import type { LlmSpeechInput } from "./types";
import { formatSeatList, seatText } from "./text";

export function buildClaimBriefingLine(view: AgentView): string {
  const claims = view.publicSummary.claimBoard.slice(-5).map((claim) => {
    const checks =
      claim.checks.length > 0
        ? `，报${claim.checks
            .map((check) => `${seatText(check.target)}${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
            .join("、")}`
        : "";
    return `${seatText(claim.claimant)}声称${claim.claimedRoleLabel}${checks}`;
  });
  return claims.length > 0 ? `公开身份声明：${claims.join("；")}。` : "公开身份声明：无。";
}

export function buildSeerLegacyBriefingLine(view: AgentView): string {
  const legacies = view.publicSummary.tableMemory.seerLegacies.slice(0, 3).map((legacy) => legacy.summary);
  return legacies.length > 0
    ? `夜死预言家声明遗留：${legacies.join("；")}。这只是公开遗留视角，不等于系统确认真预言家。`
    : "夜死预言家声明遗留：无。";
}

export function buildSheriffBriefingLine(view: AgentView): string {
  const sheriff = view.privateKnowledge.sheriff;
  if (!sheriff) return "警长流程：本局没有警上、警下、警徽、警长流程。";

  const activeCandidates = sheriff.candidates.filter((candidate) => !sheriff.withdrawnSeatIds.includes(candidate.seatId));
  const holderText = sheriff.badgeHolder
    ? `当前警徽持有人是${seatText(sheriff.badgeHolder)}`
    : sheriff.resolved
      ? "当前没有警徽持有人"
      : "警长竞选尚未结束";
  const candidateText = activeCandidates.length > 0 ? `候选人：${formatSeatList(activeCandidates)}` : undefined;
  const pkText = sheriff.pkCandidates?.length ? `PK席：${formatSeatList(sheriff.pkCandidates)}` : undefined;

  return ["警长流程：本局有警上、警下、警徽和警长投票。", holderText, candidateText, pkText].filter(Boolean).join(" ");
}

export function buildSheriffVoteBriefingLine(view: AgentView): string {
  const snapshot = view.publicSummary.sheriffVoteSnapshot;
  if (!snapshot) return "警长票型：无。";
  if (!snapshot.revealed) return "警长票型：尚未公开。";

  const tally = snapshot.tally.map((item) => `${seatText(item.target)}${item.count}票`).join("、");
  const leaders = snapshot.leaders.length > 0 ? `领先：${formatSeatList(snapshot.leaders)}` : undefined;
  const abstain = snapshot.abstainCount ? `弃票${snapshot.abstainCount}票` : undefined;
  const details = [tally, leaders, abstain].filter(Boolean).join("；");
  return details ? `警长票型：${details}。` : "警长票型：无公开票。";
}

export function buildTodaySpeechOrderBriefingLine(speechOrder: LlmSpeechInput["publicContext"]["speechOrder"]): string {
  return `今日完整发言顺序：${formatSeatList(speechOrder.todaySpeechOrder)}。`;
}

export function buildCurrentSpeechOrderPositionLine(
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
): string {
  const position = speechOrder.currentSpeakerOrderIndex >= 0 ? speechOrder.currentSpeakerOrderIndex + 1 : undefined;
  const previous = position ? speechOrder.todaySpeechOrder[position - 2] : undefined;
  const next = position ? speechOrder.todaySpeechOrder[position] : undefined;
  const previousText = previous ? `上一位是${seatText(previous)}` : "前面没有同日发言位";
  const nextText = next ? `下一位是${seatText(next)}` : "后面没有同日发言位";
  return position
    ? `当前是今日第${position}位发言，${previousText}，${nextText}。`
    : `当前发言席不在今日发言队列中；只按公开已发言记录和后续未发言名单判断。`;
}

export function buildFirstSpeakerBriefingLine(
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
): string | undefined {
  const first = speechOrder.todaySpeechOrder[0];
  if (!first) return undefined;
  return `今日首置位：${seatText(first)}；只有这个座位可称首置位，其他已发言座位请称前置位、上一位或具体座位。`;
}

export function buildFutureSeatMentionOrderLine(
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
): string | undefined {
  const nextUnspoken = speechOrder.currentDayUnspokenSeats[0];
  if (!nextUnspoken) return undefined;
  return `后置位点名顺序：如果只是保留观察，默认不点具体后置位；如果确实要问人，优先只问“下一位${seatText(
    nextUnspoken,
  )}”一个具体问题；若连续点多个后置位，按今日顺序连续点名，不要无理由跳过中间后置位。`;
}

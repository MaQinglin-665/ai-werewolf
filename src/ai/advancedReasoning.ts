import { isWolfRole } from "@/game/roleUtils";
import type { ActionTarget, AgentView, Role } from "@/game/types";

const POWER_ROLES: Role[] = ["SEER", "WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD"];

export function buildAdvancedReasoningNotes(view: AgentView): string[] {
  const notes = [
    buildRoundFrameNote(view),
    buildEvidenceHardnessNote(view),
    buildCounterLogicNote(view),
    buildIdentityPitNote(view),
    buildSheriffAuditNote(view),
    buildVoteAuditNote(view),
    buildSeerClaimAuditNote(view),
    buildDeathLegacyNote(view),
    buildPersuasionIntentNote(view),
    buildRoleTaskNote(view),
  ].filter((note): note is string => Boolean(note));

  return [...new Set(notes)].slice(0, 11);
}

function buildRoundFrameNote(view: AgentView): string {
  if (view.day <= 1) {
    return "轮次意识：首日先分清身份声明质量、表态理由和发言顺序；低证据听感只能施压，不要直接当铁狼定案。";
  }

  return `轮次意识：第${view.day}天要把上一轮投票、夜间倒牌、表态变化和今天发言接起来复盘，解释不了变化的位置优先放进嫌疑位。`;
}

function buildEvidenceHardnessNote(view: AgentView): string {
  const hasCounterclaims = view.publicSummary.tableMemory.counterclaims.length > 0;
  const hasVoteHistory = view.publicSummary.tableMemory.voteHistory.length > 0;

  if (hasCounterclaims && hasVoteHistory) {
    return "证据硬度：先看对跳身份说法、公开查验和上一轮投票有没有接上，再用听感补充；不要把单句状态、边角位或沉默直接当铁证。";
  }

  if (hasCounterclaims) {
    return "证据硬度：对跳身份说法是当前硬材料；听感和发言长短只能辅助，关键看查验、声明时机、表态和处理方向能否互相证明。";
  }

  if (hasVoteHistory) {
    return "证据硬度：上一轮票型是硬材料；重点看发言承诺和实际投票是否一致，单独的语气、座位和短发言都只是软材料。";
  }

  return "证据硬度：当前硬材料不足，先区分铁逻辑、软状态和伪逻辑；没有公开证据时只施压观察，不要提前归死。";
}

function buildCounterLogicNote(view: AgentView): string {
  const latestShift = view.publicSummary.tableMemory.stanceShifts.at(-1);
  if (latestShift) {
    return `正反逻辑：最新表态变化是${latestShift.summary}；先问这是好人回头、狼人倒钩、冲锋转向还是被投票压力逼出来，再定验证点。`;
  }

  const focus = view.publicSummary.tableMemory.focus[0];
  if (focus) {
    if (view.roleCard?.theme === "class-trial") {
      return `正反逻辑：${seatText(focus.seat)}已经成为焦点时，先说我此刻愿意承担的判断；反面解释只能短留一句，不替全桌做收益旁白。`;
    }
    return `正反逻辑：${seatText(focus.seat)}是当前焦点时，不只问他像不像狼，还要问如果他是好人，谁在借这个焦点做收益。`;
  }

  return "正反逻辑：同一行为至少给出一个反面解释和一个后续验证点；狼人杀看的是公开因果能不能接上，不是单点结论是否顺耳。";
}

function buildIdentityPitNote(view: AgentView): string {
  const counterclaims = view.publicSummary.tableMemory.counterclaims;
  if (counterclaims.length > 0) {
    const claimText = counterclaims
      .map((group) => `${group.claimedRoleLabel}对跳：${formatSeatList(group.claimants)}`)
      .join("；");
    return `身份说法：${claimText}。先比身份声明内部逻辑，再看外置位谁在帮忙煽动、分票或回避表态。`;
  }

  const powerClaims = view.publicSummary.claimBoard.filter((claim) => POWER_ROLES.includes(claim.claimedRole));
  if (powerClaims.length > 0) {
    const claimText = powerClaims
      .slice(-4)
      .map((claim) => `${seatText(claim.claimant)}声称${claim.claimedRoleLabel}`)
      .join("、");
    return `身份说法：公开神职声明有${claimText}；未对跳神职先保护，但要继续校验发言、表态和投票是否一致。`;
  }

  return "身份说法：当前没有公开神职对跳，闭眼位先用发言过程和投票压力压缩嫌疑位，不要逼神职过早拍身份。";
}

function buildSheriffAuditNote(view: AgentView): string | undefined {
  const sheriff = view.privateKnowledge.sheriff;
  if (!sheriff) return undefined;

  const sheriffVote = view.publicSummary.sheriffVoteSnapshot;
  if (sheriffVote?.revealed && sheriffVote.tally.length > 0) {
    return `警长信息：警徽投票为${formatTally(sheriffVote.tally)}；高阶局不能只按团队大小定真假，要看投票理由、表态一致性和是否破坏真预言家的警徽安排。`;
  }

  const activeCandidates = sheriff.candidates.filter((candidate) => !sheriff.withdrawnSeatIds.includes(candidate.seatId));
  if (activeCandidates.length > 0) {
    return `警长信息：当前警上候选为${formatSeatList(activeCandidates)}；发言要检查报查验、警徽安排、心路历程和警下投票预期是否连成一条线。`;
  }

  if (sheriff.badgeHolder) {
    return `警长信息：当前警徽在${seatText(sheriff.badgeHolder)}；后续归票要看警长是否把发言、身份说法和投票组织到同一方向。`;
  }

  return "警长信息：本局有警长流程但还没有形成公开警徽投票，先保留警上发言质量和警下投票任务。";
}

function buildVoteAuditNote(view: AgentView): string {
  const latestVote = view.publicSummary.tableMemory.voteHistory.at(-1);
  if (latestVote?.tally.length) {
    return `投票复盘：上一轮公开投票为${formatTally(latestVote.tally)}；重点追问谁起票、谁补票、谁最后跟票，以及理由是否和发言接上。`;
  }

  if (view.phase === "DAY_VOTE") {
    return "投票复盘：当前还没有可复盘的公开放逐投票，投票理由必须来自查验、身份说法、表态变化或已发言内容。";
  }

  return "投票复盘：还没有公开放逐投票时，先记录每个人的表态和出人意愿，等投票后校验是否前后一致。";
}

function buildSeerClaimAuditNote(view: AgentView): string | undefined {
  const seerClaims = view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === "SEER");
  if (seerClaims.length > 1) {
    const claimText = seerClaims
      .map((claim) => `${seatText(claim.claimant)}${claim.checks.length ? `报${claim.checks.map(formatCheck).join("、")}` : "未报验人"}`)
      .join("；");
    return `预言家说法：${claimText}。先比较查验力度、声明时机、金水/查杀回应和双方投票，再决定表态。`;
  }

  if (seerClaims.length === 1) {
    const claim = seerClaims[0]!;
    const checkText = claim.checks.length ? `，${claim.checks.map(formatCheck).join("、")}` : "";
    return `预言家说法：${seatText(claim.claimant)}单边声称预言家${checkText}；单边身份也要落到查验、发言质量和投票收益上。`;
  }

  return undefined;
}

function buildDeathLegacyNote(view: AgentView): string | undefined {
  const legacy = view.publicSummary.tableMemory.seerLegacies[0];
  if (legacy) {
    return `遗言和倒牌：${legacy.summary}；夜死预言家声明只按公开遗留处理，不等于系统确认真预言家。`;
  }

  const latestDeath = view.publicSummary.recentDeaths.at(-1);
  return latestDeath
    ? `遗言和倒牌：最新公开死讯是${latestDeath}；复盘谁借死讯带节奏，若判断狼刀、毒或自刀，要给公开规则、投票或发言依据。`
    : undefined;
}

function buildPersuasionIntentNote(view: AgentView): string {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    return "说服意图：狼人公开发言要选择一种桌面收益，抗推、倒钩、保护队友或分裂表态都可以，但理由必须完全像公开视角生成。";
  }

  return "说服意图：好人发言不只是找狼，还要让其他好人能跟票；把怀疑对象、证据硬度和处理边界讲清楚，比单纯报怀疑名单更有效。";
}

function buildRoleTaskNote(view: AgentView): string | undefined {
  if (view.myRole === "SEER") {
    return view.privateKnowledge.sheriff
      ? "本身份任务：预言家公开发言要同时交查验、警徽安排和心路历程；警徽安排优先验能打开嫌疑位或校验表态的人。"
      : "本身份任务：无警徽时预言家更要把查验、表态和今天处理方向说清，避免只报身份不组织桌面。";
  }

  if (view.myRole === "VILLAGER") {
    return "本身份任务：平民没有夜间信息，重点是压缩身份说法、保护未对跳神职、用公开发言和投票找狼。";
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    return "本身份任务：狼人先选悍跳、冲票、倒钩或卖队友的战术，再用公开发言、身份说法和投票包装理由。";
  }

  if (POWER_ROLES.includes(view.myRole)) {
    return "本身份任务：神职拍身份要服务轮次和投票；不需要拍时先用公开逻辑发言，避免无收益交身份给夜刀。";
  }

  return undefined;
}

function formatCheck(check: { target: ActionTarget; result: "WEREWOLF" | "GOOD" }): string {
  return `${seatText(check.target)}${check.result === "WEREWOLF" ? "查杀" : "金水"}`;
}

function formatTally(tally: Array<{ target: ActionTarget; count: number }>): string {
  return tally.map((item) => `${seatText(item.target)}${item.count}票`).join("、");
}

function formatSeatList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map(seatText).join("、") : "无";
}

function seatText(seat: ActionTarget): string {
  return `${seat.seatId}号${seat.name}`;
}

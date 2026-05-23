import { isWolfRole } from "@/game/roleUtils";
import type { ActionTarget, AgentView, ClaimBoardItem, Role } from "@/game/types";

export type AiClaimAudit = {
  contestedClaims: string[];
  protectedClaims: string[];
  checkChains: string[];
  contradictions: string[];
  followupTests: string[];
  actionGuidance: string[];
};

const POWER_ROLES = new Set<Role>(["SEER", "WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD"]);

export function buildClaimAudit(view: AgentView): AiClaimAudit {
  const memory = view.publicSummary.tableMemory;
  const counterclaimedSeatIds = new Set(memory.counterclaims.flatMap((group) => group.claimants.map((claimant) => claimant.seatId)));
  const counterclaimedRoles = new Set(memory.counterclaims.map((group) => group.claimedRole));
  const liveClaims = view.publicSummary.claimBoard.filter((claim) =>
    view.aliveSeats.some((seat) => seat.seatId === claim.claimant.seatId),
  );
  const seerClaims = liveClaims.filter((claim) => claim.claimedRole === "SEER");

  const contestedClaims = uniqueLines(
    memory.counterclaims.map(
      (group) =>
        `${group.claimedRoleLabel}对跳：${formatSeatList(group.claimants)}；先比声明时机、信息量、站边收益和今天票口。`,
    ),
  ).slice(0, 4);

  const protectedClaims = uniqueLines(
    liveClaims
      .filter((claim) => POWER_ROLES.has(claim.claimedRole) && !counterclaimedSeatIds.has(claim.claimant.seatId))
      .map((claim) => `${seatText(claim.claimant)}未对跳${claim.claimedRoleLabel}，先保护其身份空间，但要求给公开票口和边界。`),
  ).slice(0, 5);

  const checkChains = uniqueLines([
    ...seerClaims.map(formatSeerClaimChain),
    ...memory.seerLegacies.slice(0, 2).map((legacy) => `夜死预言家遗产：${legacy.summary}；只按公开遗言和票型复盘。`),
  ]).slice(0, 5);

  const contradictions = uniqueLines([
    ...memory.counterclaims.map(
      (group) => `${group.claimedRoleLabel}出现多张声明，至少有一方身份叙事不完整；不能只按声音大小站边。`,
    ),
    ...seerClaims.flatMap((claim) => buildSeerClaimContradictions(claim, seerClaims)),
    ...liveClaims
      .filter((claim) => claim.claimedRole === "VILLAGER" && counterclaimedRoles.has("VILLAGER"))
      .map((claim) => `${seatText(claim.claimant)}平民声明被挤压时，要看是否在帮神职挡刀还是在逃避身份坑。`),
  ]).slice(0, 5);

  const followupTests = uniqueLines([
    seerClaims.length > 0
      ? `预言家线统一追问：为什么验这个人、明天验谁、今天票谁、验人和票型是否互相服务。`
      : undefined,
    protectedClaims.length > 0
      ? "未对跳神职只问公开边界和票口，不逼其交完整夜间路线或私密技能信息。"
      : undefined,
    memory.counterclaims.length > 0
      ? "对跳位必须给出可被后置位复述的逻辑链；只喊身份不交验人/技能心路的先降可信。"
      : undefined,
    "凡是有人反打金水、强推未对跳神职或回避对跳身份线，都要要求他说清收益来源。",
  ]).slice(0, 5);

  const actionGuidance = isWolfRole(view.myRole, view.rules.wolfRoles)
    ? [
        "狼人行动公开口径：利用身份坑制造站边分歧，但理由必须来自公开声明、查验链和票型。",
        "狼队不要在行动理由里暴露真实队友、夜间刀口或私密身份，只做闭眼视角能成立的身份审计。",
      ]
    : [
        "好人行动优先级：先处理对跳、反打金水、强推未对跳神职、票型收益闭环的位置。",
        "未对跳强神和公开金水不能因为听感短板被低证据硬推；需要先用追问和票型验证。",
      ];

  return {
    contestedClaims,
    protectedClaims,
    checkChains,
    contradictions,
    followupTests,
    actionGuidance,
  };
}

function formatSeerClaimChain(claim: ClaimBoardItem): string {
  if (claim.checks.length === 0) {
    return `${seatText(claim.claimant)}预言家线暂无公开查验，重点听其验人心路和后续票口。`;
  }

  const checks = claim.checks
    .map((check) => `第${check.day}天${seatText(check.target)}${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
    .join("、");
  return `${seatText(claim.claimant)}预言家线：${checks}；核验这些验人有没有带出自然站边和票型。`;
}

function buildSeerClaimContradictions(claim: ClaimBoardItem, allSeerClaims: ClaimBoardItem[]): string[] {
  const lines: string[] = [];
  const blackCheckedSeer = claim.checks.find(
    (check) => check.result === "WEREWOLF" && allSeerClaims.some((candidate) => candidate.claimant.seatId === check.target.seatId),
  );
  if (blackCheckedSeer) {
    lines.push(
      `${seatText(claim.claimant)}查杀了对跳预言家${seatText(blackCheckedSeer.target)}，要看这是正面验人还是后置反打。`,
    );
  }

  const goldCheckedSeer = claim.checks.find(
    (check) => check.result === "GOOD" && allSeerClaims.some((candidate) => candidate.claimant.seatId === check.target.seatId),
  );
  if (goldCheckedSeer) {
    lines.push(`${seatText(claim.claimant)}给对跳身份${seatText(goldCheckedSeer.target)}金水，必须解释身份叙事如何自洽。`);
  }
  return lines;
}

function seatText(seat: ActionTarget): string {
  return `${seat.seatId}号${seat.name}`;
}

function formatSeatList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map(seatText).join("、") : "无人";
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return [...new Set(lines.map((line) => line?.trim()).filter((line): line is string => Boolean(line)))];
}

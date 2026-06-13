import type { AgentView } from "@/game/types";
import { seatText } from "./text";

export function buildClaimAttributionBoundaryLines(view: AgentView): string[] {
  return buildClaimAttributionBoundaryLinesFromClaimBoard(view.publicSummary.claimBoard);
}

export function buildClaimAttributionContractLines(view: AgentView): string[] {
  return buildClaimAttributionBoundaryLines(view).map((line) => `身份归属硬约束：${line}`);
}

export function buildClassTrialBlackCheckAgendaContractLines(view: AgentView): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const hasPublicBlackCheck = view.publicSummary.claimBoard.some(
    (claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "WEREWOLF"),
  );
  if (!hasPublicBlackCheck) return [];
  return [
    "D1已有公开查杀时，后续查验安排不是本轮主线；先看有没有对跳、查杀位如何正面回应、谁公开对撞这条查杀。",
    "不能把查杀位的个人解释讲顺当成改判条件；反对这条查杀的人要公开承担反对理由，真预言家不会把自己的查杀说成别人再决定是否成立的材料。",
    "平安夜只作公开背景，不把它当成攻击预言家或查杀位的主要理由。",
  ];
}

export function buildClaimAttributionBoundaryLinesFromClaimBoard(
  claimBoard: AgentView["publicSummary"]["claimBoard"],
): string[] {
  const seerClaimantIds = new Set(
    claimBoard.filter((claim) => claim.claimedRole === "SEER").map((claim) => claim.claimant.seatId),
  );
  return claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) =>
      claim.checks
        .filter((check) => check.result === "WEREWOLF" && !seerClaimantIds.has(check.target.seatId))
        .map(
          (check) =>
            `${seatText(claim.claimant)}才是预言家声明者；${seatText(check.target)}只是被报查杀对象，除非${check.target.seatId}号也公开跳预言家，否则不能说认${check.target.seatId}号预言家；如果你不信${claim.claimant.seatId}号，只能说“不认${claim.claimant.seatId}号预言家”或“保${check.target.seatId}号查杀位”。`,
        ),
    );
}

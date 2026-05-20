import type { HumanGameView } from "./types";

export type ReviewCredibilityHighlight = {
  title: string;
  detail: string;
  tone: "good" | "warning" | "neutral" | "danger";
};

export function buildReviewCredibilityHighlights(game: Pick<HumanGameView, "review">): ReviewCredibilityHighlight[] {
  const review = game.review;
  if (!review) return [];

  const highlights: ReviewCredibilityHighlight[] = [];
  if (review.result) {
    highlights.push({
      title: "胜负原因",
      detail: `${review.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：${review.result.reason}`,
      tone: review.result.winner === "GOOD" ? "good" : "danger",
    });
  }

  if (review.claims.length > 0) {
    const falseClaims = review.claims.filter((claim) => !claim.truthful);
    const counterclaims = review.claims.filter((claim) => claim.isCounterclaim);
    highlights.push({
      title: "身份线",
      detail:
        falseClaims.length > 0
          ? `${falseClaims.length} 条身份声明被证伪，${counterclaims.length} 条处在对跳关系中。`
          : `${review.claims.length} 条身份声明均已对照真实身份回看。`,
      tone: falseClaims.length > 0 ? "warning" : "good",
    });
  }

  const decisiveVote = [...review.voteImpacts].reverse().find((impact) => impact.outcome === "exile") ?? review.voteImpacts.at(-1);
  if (decisiveVote) {
    const targetText = decisiveVote.target
      ? `${decisiveVote.target.seatId}号${decisiveVote.targetRoleLabel ? `（${decisiveVote.targetRoleLabel}）` : ""}`
      : "无人出局";
    highlights.push({
      title: "票型",
      detail: `D${decisiveVote.day} ${decisiveVote.title}：${targetText}。好人票 ${decisiveVote.goodVotes}，狼票 ${decisiveVote.wolfVotes}，弃票 ${decisiveVote.abstainCount}。`,
      tone: decisiveVote.outcome === "exile" ? "neutral" : "warning",
    });
  }

  const turningPoint = review.turningPoints[0];
  if (turningPoint) {
    highlights.push({
      title: "关键转折",
      detail: `D${turningPoint.day} ${turningPoint.title}：${turningPoint.description}`,
      tone: "neutral",
    });
  } else if (review.deathTimeline.length > 0) {
    const latestDeath = review.deathTimeline.at(-1);
    if (latestDeath) {
      highlights.push({
        title: "死亡线",
        detail: `最后死亡记录：D${latestDeath.day} ${latestDeath.seat.seatId}号${latestDeath.seat.name}，${latestDeath.reasonLabel}。`,
        tone: "neutral",
      });
    }
  }

  return highlights.slice(0, 4);
}

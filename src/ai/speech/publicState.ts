import type { ActionTarget, AgentView } from "@/game/types";

import { currentDaySpeechItems } from "./context";

export type PublicBlackCheckContext = {
  claimant: ActionTarget;
  checked: ActionTarget;
  day: number;
  sourceSpeechSeq?: number;
};

export function findPublicBlackCheckAgainstSelf(view: AgentView | undefined): { claimant: ActionTarget; day: number } | undefined {
  if (!view) return undefined;
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimedRole !== "SEER") continue;
    const check = claim.checks.find((item) => item.target.seatId === view.mySeatId && item.result === "WEREWOLF");
    if (check) return { claimant: claim.claimant, day: check.day };
  }
  const selfMemory = view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === view.mySeatId);
  const directCheck = selfMemory?.claimedByChecks.find((check) => check.result === "WEREWOLF");
  return directCheck ? { claimant: directCheck.claimant, day: directCheck.day } : undefined;
}

export function findLatestPublicBlackCheck(view: AgentView | undefined): PublicBlackCheckContext | undefined {
  if (!view) return undefined;
  let latest: PublicBlackCheckContext | undefined;
  const consider = (item: PublicBlackCheckContext) => {
    const itemRank = item.day * 100000 + (item.sourceSpeechSeq ?? 0);
    const latestRank = latest ? latest.day * 100000 + (latest.sourceSpeechSeq ?? 0) : -1;
    if (!latest || itemRank >= latestRank) latest = item;
  };

  for (const claim of [...view.publicSummary.claimBoard, ...view.publicSummary.tableMemory.claimBoard]) {
    if (claim.claimedRole !== "SEER") continue;
    for (const check of claim.checks) {
      if (check.result !== "WEREWOLF") continue;
      consider({
        claimant: claim.claimant,
        checked: check.target,
        day: check.day,
        sourceSpeechSeq: claim.sourceSpeechSeq,
      });
    }
  }

  for (const seat of view.publicSummary.tableMemory.seats) {
    for (const check of seat.claimedByChecks) {
      if (check.result !== "WEREWOLF") continue;
      consider({
        claimant: check.claimant,
        checked: { seatId: seat.seatId, name: seat.name },
        day: check.day,
      });
    }
  }

  return latest;
}

export function isLowInfoDayOneOpening(view: AgentView): boolean {
  if (view.day !== 1) return false;
  const currentDaySpeeches = currentDaySpeechItems(view);
  if (currentDaySpeeches.length > 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  return !currentDaySpeeches.some((speech) => hasHardDayOneOpeningInfo(speech.message));
}

export function isLowInfoDayOneNoHardInfo(view: AgentView): boolean {
  if (view.day !== 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  return !currentDaySpeechItems(view).some((speech) => hasHardDayOneOpeningInfo(speech.message));
}

function hasHardDayOneOpeningInfo(message: string): boolean {
  const withoutDeathShape = message.replace(/(?:平安夜[^。！？；]{0,20})?女巫用药(?:了|处理)?|按女巫用药处理/g, "");
  return /查杀|金水|预言家|我是女巫|我女巫|猎人|骑士|守卫|警徽/.test(withoutDeathShape) || hasConcreteDayOneVotePressure(withoutDeathShape);
}

function hasConcreteDayOneVotePressure(message: string): boolean {
  const withoutNegativeTicket = message.replace(/(?:没|没有|还没有|尚未|未|并未|不是|不急(?:着)?)[^。！？；]{0,18}(?:站边|票口|推票|催票)/g, "");
  return /归票|出人|票口[^。！？；]{0,10}(?:先|直接)?(?:压|落|锁|给到|放在)|(?:先|直接)?(?:压|投(?:给|出|向|到)?|票投|出)\s*(?:\d+|[一二三四五六七八九十两]+)\s*号/.test(
    withoutNegativeTicket,
  );
}

export function hasActionableClassTrialPublicInfo(view: AgentView, currentDaySpeeches: ReturnType<typeof currentDaySpeechItems>): boolean {
  const summary = view.publicSummary;
  const memory = summary.tableMemory;
  return (
    currentDaySpeeches.some((speech) => speech.speaker?.seatId !== view.mySeatId) ||
    summary.claimBoard.length > 0 ||
    summary.recentVotes.length > 0 ||
    summary.voteSnapshot.votes.length > 0 ||
    summary.voteSnapshot.tally.length > 0 ||
    summary.voteSnapshot.revealed ||
    summary.recentDeaths.length > 0 ||
    summary.deathSummary.length > 0 ||
    memory.claimBoard.length > 0 ||
    memory.reasoningCues.length > 0 ||
    memory.counterclaims.length > 0 ||
    memory.focus.length > 0 ||
    memory.voteHistory.length > 0 ||
    memory.deathAnnouncements.length > 0 ||
    memory.publicSignals.length > 0
  );
}

export function hasPublicSeerCheck(view: AgentView): boolean {
  if (view.publicSummary.claimBoard.some((claim) => claim.claimedRole === "SEER" && claim.checks.length > 0)) {
    return true;
  }

  return currentDaySpeechItems(view).some((item) => {
    if (item.speaker?.seatId === view.mySeatId) return false;
    const message = item.message;
    return (
      /(?:预言家|我(?:昨晚)?(?:查验|验了|查了|报验)|查杀|金水)/.test(message) &&
      /(?:查杀|金水|验出[^。！？；]{0,12}(?:狼|好人)|结果是(?:狼|好人)|是狼人|是狼|是好人)/.test(message)
    );
  });
}

export function hasPublicSeerBlackCheck(view: AgentView): boolean {
  if (
    view.publicSummary.claimBoard.some(
      (claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "WEREWOLF"),
    )
  ) {
    return true;
  }

  return currentDaySpeechItems(view).some((item) => {
    if (item.speaker?.seatId === view.mySeatId) return false;
    const message = item.message;
    return (
      /(?:预言家|我(?:昨晚)?(?:查验|验了|查了|报验)|查杀)/.test(message) &&
      /(?:查杀|验出[^。！？；]{0,12}狼|结果是狼|是狼人|是狼)/.test(message)
    );
  });
}

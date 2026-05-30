import type {
  ActionTarget,
  AgentView,
  AiTableRead,
  ClaimBoardItem,
  ClaimCheck,
  PublicVoteItem,
  Role,
  SeatRead,
  SpeechPlan,
  VotePlan,
  WolfTeamAssignment,
  WolfVoteTactic,
} from "@/game/types";
import { clampProbability, stableRoll, stableSignedJitter } from "@/game/decisionNoise";
import { ROLE_LABELS } from "@/game/labels";
import { isWolfRole } from "@/game/roleUtils";
import {
  findDeadSeerBlackLegacyForSeat,
  findDeadSeerGoldLegacyForSeat,
  hasHardOverrideAgainstDeadSeerGold,
  isProtectedDeadSeerGoldSeat,
} from "./protectedGold";
import { isDramaticClassTrialView } from "./classTrialDramaticMode";

const GOD_ROLES: Role[] = ["SEER", "WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD"];
const NON_SEER_POWER_ROLES = new Set<Role>(["WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD"]);
const DEFAULT_PERSONA_PREFERENCES = {
  logic: 0.55,
  identity: 0.55,
  vote: 0.55,
  emotion: 0.45,
  memory: 0.5,
  leadership: 0.45,
  deception: 0.4,
  caution: 0.55,
};
type PersonaPreferences = typeof DEFAULT_PERSONA_PREFERENCES;
type WolfVoteChoice = {
  target: SeatRead;
  tactic: WolfVoteTactic;
};

export function buildAiTableRead(view: AgentView): AiTableRead {
  const preferences = personaPreferences(view);
  const wolfTeammateSeatIds = new Set(view.privateKnowledge.wolfTeammates?.map((seat) => seat.seatId) ?? []);
  const seerChecks = view.privateKnowledge.seerChecks ?? [];
  const knownWolfSeatIds = new Set(
    seerChecks.filter((check) => check.result === "WEREWOLF").map((check) => check.targetSeatId),
  );
  const knownGoodSeatIds = new Set(
    seerChecks.filter((check) => check.result === "GOOD").map((check) => check.targetSeatId),
  );
  const votesByTarget = new Map<number, PublicVoteItem[]>();
  const votesByVoter = new Map<number, PublicVoteItem>();

  for (const vote of view.publicSummary.voteSnapshot.votes) {
    votesByVoter.set(vote.voter.seatId, vote);
    if (!vote.target) continue;
    votesByTarget.set(vote.target.seatId, [...(votesByTarget.get(vote.target.seatId) ?? []), vote]);
  }

  const seats = view.aliveSeats.map((seat) => {
    const isSelf = seat.seatId === view.mySeatId;
    const isKnownWolf = knownWolfSeatIds.has(seat.seatId);
    const isKnownGood = knownGoodSeatIds.has(seat.seatId);
    const isWolfTeammate = wolfTeammateSeatIds.has(seat.seatId);
    const seatMemory = view.publicSummary.tableMemory.seats.find((memory) => memory.seatId === seat.seatId);
    const lastSpeech = [...view.publicSummary.recentSpeeches]
      .reverse()
      .find((speech) => speech.speaker?.seatId === seat.seatId);
    const lastSpeechMessage = lastSpeech?.message ?? seatMemory?.lastSpeech;
    const votedFor = votesByVoter.get(seat.seatId)?.target;
    const votesReceived = votesByTarget.get(seat.seatId)?.length ?? 0;
    const pressure: string[] = [];
    const publicVariance = ((seat.seatId * 7 + view.mySeatId * 3 + view.day * 5) % 15) - 4;
    const personaSuspicionDrift = stableSignedJitter(
      ["read", view.day, view.phase, view.mySeatId, view.persona?.id, seat.seatId],
      5,
    );
    const riskBias = ((view.persona?.riskTolerance ?? 0.45) - 0.45) * 8;
    let suspicion = 45 + publicVariance + personaSuspicionDrift + riskBias;
    let trust = 48 - Math.floor(publicVariance / 2) - personaSuspicionDrift / 2;

    if (isSelf) {
      suspicion = 0;
      trust = 100;
      pressure.push("自己视角");
    }

    if (isWolfTeammate) {
      suspicion = 6;
      trust = 86;
      pressure.push("已知队友");
    }

    if (isKnownWolf) {
      suspicion = 96;
      trust = 4;
      pressure.push("私密查验指向狼人");
    }

    if (isKnownGood) {
      suspicion = Math.min(suspicion, 14);
      trust = Math.max(trust, 82);
      pressure.push("私密查验偏好");
    }

    if (!lastSpeechMessage && view.day > 1 && !isSelf) {
      suspicion += 6;
      pressure.push("发言信息偏少");
    }

    for (const claim of seatMemory?.claims ?? []) {
      if (claim.claimedRole === "SEER") {
        pressure.push(`${claim.strength === "hard" ? "明确" : "软"}声称预言家`);
        trust += weighted(claim.strength === "hard" ? 4 : 2, preferences.identity);
        if (view.publicSummary.tableMemory.counterclaims.some((group) => group.claimedRole === "SEER")) {
          suspicion += weighted(9, preferences.identity);
          pressure.push("处在预言家对跳关系");
        }
        if (view.myRole === "SEER" && !isSelf) {
          suspicion += weighted(24, preferences.identity);
          pressure.push("与我的预言家视角对跳");
        }
      } else {
        pressure.push(`公开声称${claim.claimedRoleLabel}`);
      }
    }

    if (!isWolfRole(view.myRole, view.rules.wolfRoles) && !isSelf && !isWolfTeammate) {
      const protectedClaim = chooseUnchallengedPowerClaim(view, seatMemory?.claims ?? [], seatMemory?.claimedByChecks ?? []);
      if (protectedClaim) {
        const protectionWeight = Math.max(preferences.identity, preferences.caution);
        const isHardSeer = protectedClaim.claimedRole === "SEER" && protectedClaim.strength === "hard";
        const dayOneCaution = view.day === 1 ? 1.3 : 1;
        trust += weighted((isHardSeer ? 14 : 10) * dayOneCaution, protectionWeight);
        suspicion -= weighted((isHardSeer ? 18 : 14) * dayOneCaution, protectionWeight);
        pressure.push(`${protectedClaim.claimedRoleLabel}未对跳，先不弱推`);
        if (view.day === 1) {
          pressure.push(`${protectedClaim.claimedRoleLabel}未对跳，首日先留身份坑`);
        }
      }
    }

    for (const check of seatMemory?.claimedByChecks ?? []) {
      if (check.result === "WEREWOLF") {
        const noDayOneResponse = isUnansweredDayOneSeerBlackCheck(view, seatMemory, check.claimant.seatId);
        suspicion += weighted(noDayOneResponse ? 8 : 16, preferences.identity);
        pressure.push(noDayOneResponse ? `被${check.claimant.name}后置查杀但尚未回应` : `被${check.claimant.name}公开报查杀`);
      } else {
        const goldWeight = Math.max(preferences.identity, preferences.logic);
        trust += weighted(12, goldWeight);
        suspicion -= weighted(7, goldWeight);
        pressure.push(`被${check.claimant.name}公开报金水`);
      }
    }

    if (!isWolfRole(view.myRole, view.rules.wolfRoles) && isTargetOfReactiveSeerBlackCheck(view.publicSummary.tableMemory, seat.seatId)) {
      const cautionWeight = Math.max(preferences.logic, preferences.caution);
      trust += weighted(8, cautionWeight);
      suspicion -= weighted(14, cautionWeight);
      pressure.push("被后置预言家查杀，先按反打降权");
    }

    for (const legacy of view.publicSummary.tableMemory.seerLegacies) {
      const legacyCheck = legacy.checks.find((check) => check.target.seatId === seat.seatId);
      if (legacyCheck?.result === "WEREWOLF") {
        suspicion += weighted(16, Math.max(preferences.logic, preferences.memory));
        pressure.push(`${legacy.claimant.name}夜死后遗留查杀`);
      }
      if (legacyCheck?.result === "GOOD") {
        const goldWeight = Math.max(preferences.logic, preferences.memory);
        trust += weighted(16, goldWeight);
        suspicion -= weighted(12, goldWeight);
        pressure.push(`${legacy.claimant.name}夜死后遗留金水，先按公开好人保护`);
      }

      const legacyStance = legacy.stancesGiven
        .slice()
        .reverse()
        .find((stance) => stance.target.seatId === seat.seatId);
      if (legacyStance?.kind === "QUESTION" || legacyStance?.kind === "PRESSURE") {
        suspicion += weighted(6, Math.max(preferences.logic, preferences.memory));
        pressure.push(`${legacy.claimant.name}夜死前${legacyStance.kindLabel}这里`);
      }
      if (legacyStance?.kind === "SUPPORT" || legacyStance?.kind === "FOLLOW") {
        trust += weighted(4, Math.max(preferences.logic, preferences.memory));
        pressure.push(`${legacy.claimant.name}夜死前${legacyStance.kindLabel}这里`);
      }

      if (legacy.lastVote?.target?.seatId === seat.seatId) {
        suspicion += weighted(5, Math.max(preferences.vote, preferences.memory));
        pressure.push(`${legacy.claimant.name}夜死前投过这里`);
      }
    }

    for (const stance of seatMemory?.stancedBy.slice(-6) ?? []) {
      if (stance.kind === "SUPPORT" || stance.kind === "FOLLOW") {
        trust += weighted(stance.kind === "SUPPORT" ? 6 : 3, preferences.emotion);
        pressure.push(`${stance.actor.name}${stance.kindLabel}这里`);
      }
      if (stance.kind === "QUESTION" || stance.kind === "PRESSURE") {
        suspicion += weighted(stance.kind === "PRESSURE" ? 8 : 6, Math.max(preferences.emotion, preferences.leadership));
        pressure.push(`${stance.actor.name}${stance.kindLabel}这里`);
      }
    }

    if (view.publicSummary.tableMemory.stanceShifts.some((shift) => shift.actor.seatId === seat.seatId)) {
      suspicion += weighted(10, Math.max(preferences.logic, preferences.memory));
      pressure.push("站边前后变化");
    }

    if (seatMemory && !isSelf) {
      if (seatMemory.shortSpeechCount > 0) {
        suspicion += weighted(Math.min(10, seatMemory.shortSpeechCount * 4), preferences.logic);
        pressure.push("公开记忆：发言偏短");
      }
      if (seatMemory.evasiveSpeechCount > 0) {
        suspicion += weighted(Math.min(10, seatMemory.evasiveSpeechCount * 5), Math.max(preferences.logic, preferences.caution));
        pressure.push("公开记忆：回避站边");
      }
    }

    if (lastSpeechMessage && !isSelf) {
      if (lastSpeechMessage.length < 42) {
        suspicion += weighted(5, preferences.logic);
        pressure.push("发言偏短，过程不足");
      }
      if (/不急|先听|过一轮|不站死/.test(lastSpeechMessage) && !isLowInfoDayOneSeatSpeech(view, seat.seatId, lastSpeechMessage)) {
        suspicion += weighted(3, preferences.leadership);
        pressure.push("站边偏保守，需要补判断");
      }
      if (!isWolfRole(view.myRole, view.rules.wolfRoles) && hasDayOneSoftPowerHintText(view.day, lastSpeechMessage)) {
        trust += weighted(8, Math.max(preferences.identity, preferences.caution));
        suspicion -= weighted(10, Math.max(preferences.identity, preferences.caution));
        pressure.push("首日给过底牌边界，先别当低证据抗推位");
      }
      if (/查杀|金水|预言家|女巫|猎人|骑士|守卫/.test(lastSpeechMessage)) {
        trust += weighted(3, preferences.identity);
        pressure.push("发言里给过身份相关信息");
      }
    }

    if (votedFor?.seatId === view.mySeatId) {
      suspicion += weighted(9, preferences.emotion);
      pressure.push("投过我");
    }

    if (votesReceived > 0 && !isSelf) {
      suspicion += weighted(votesReceived * 5, preferences.vote);
      pressure.push(`当前吃到 ${votesReceived} 票`);
    }

    for (const vote of view.publicSummary.recentVotes.slice(-6)) {
      if (!vote.target) continue;
      if (knownWolfSeatIds.has(vote.target.seatId) && vote.voter.seatId === seat.seatId) {
        trust += weighted(8, preferences.vote);
        pressure.push("曾压到查验狼");
      }
      if (knownWolfSeatIds.has(vote.voter.seatId) && vote.target.seatId === seat.seatId) {
        trust += weighted(5, preferences.vote);
        pressure.push("被可疑玩家攻击过");
      }
    }

    const aiBelief = view.privateKnowledge.aiMemory?.beliefs.find((belief) => belief.seatId === seat.seatId);
    if (aiBelief && !isSelf && !isWolfTeammate && !isKnownWolf && !isKnownGood) {
      suspicion += (aiBelief.suspicion - 50) * weighted(0.18, preferences.memory);
      trust += (aiBelief.trust - 50) * weighted(0.14, preferences.memory);
      pressure.push(
        ...aiBelief.reasons
          .slice(0, 2)
          .map((reason) => `延续个人记忆：${reason.replace(/^延续个人记忆：/, "")}`),
      );
    }

    if (view.privateKnowledge.aiMemory?.lastSpeechTargetSeatId === seat.seatId && !isSelf && !isWolfTeammate) {
      suspicion += weighted(8, preferences.memory);
      pressure.push("延续上一轮发言焦点");
    }

    if (view.privateKnowledge.aiMemory?.lastVoteTargetSeatId === seat.seatId && !isSelf && !isWolfTeammate) {
      suspicion += weighted(7, preferences.memory);
      pressure.push("延续上一轮投票焦点");
    }

    if (view.privateKnowledge.aiMemory?.trustedSeatId === seat.seatId && !isSelf && !isWolfTeammate) {
      trust += weighted(6, preferences.memory);
      pressure.push("延续上一轮信任位");
    }

    return {
      ...seat,
      suspicion: clampScore(suspicion),
      trust: clampScore(trust),
      pressure,
      isSelf,
      isKnownWolf,
      isKnownGood,
      isWolfTeammate,
      speechCount: seatMemory?.speechCount ?? 0,
      lastSpeech: lastSpeechMessage,
      lastSpeechDay: seatMemory?.lastSpeechDay,
      lastSpeechSeq: seatMemory?.lastSpeechSeq,
      votedFor,
      votesReceived,
      publicClaims: seatMemory?.claims ?? [],
      publicChecksAgainst: seatMemory?.claimedByChecks ?? [],
      publicStancesGiven: seatMemory?.stancesGiven ?? [],
      publicStancedBy: seatMemory?.stancedBy ?? [],
    };
  });

  applyPublicClaimCredibility(view, seats);

  const targetCandidates = seats.filter((seat) => !seat.isSelf && !seat.isWolfTeammate);
  const currentDaySpokenTargets = targetCandidates.filter((seat) => seat.lastSpeechDay === view.day);
  const sortedTargets = (currentDaySpokenTargets.length > 0 ? currentDaySpokenTargets : targetCandidates).sort(
    (a, b) => b.suspicion - a.suspicion || a.trust - b.trust || a.seatId - b.seatId,
  );
  const focus = sortedTargets[0];
  const backupFocus = sortedTargets[1];

  return {
    mySeatId: view.mySeatId,
    myRole: view.myRole,
    day: view.day,
    personaLabel: view.persona?.label,
    seats,
    knownWolfSeatIds: [...knownWolfSeatIds],
    knownGoodSeatIds: [...knownGoodSeatIds],
    wolfTeammateSeatIds: [...wolfTeammateSeatIds],
    focus,
    backupFocus,
    voteSnapshot: view.publicSummary.voteSnapshot,
    recentSpeeches: view.publicSummary.recentSpeeches,
    recentDeaths: view.publicSummary.recentDeaths,
    tableMemory: view.publicSummary.tableMemory,
    tableMood: describeMood(view, focus),
  };
}

export function createSpeechPlan(view: AgentView, tableRead = buildAiTableRead(view)): SpeechPlan {
  const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
  const focus = chooseContinuityFocus(view, tableRead);
  const memoryPoint = buildMemorySpeechPoint(view, tableRead, focus);
  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const attachDynamics = (plan: SpeechPlan): SpeechPlan => withSpeechDynamics(view, tableRead, focus, plan);

  if (view.myRole === "SEER" && latestCheck) {
    const target = toTargetFromRead(tableRead, latestCheck.targetSeatId);
    const shouldRevealCheck = shouldRevealSeerCheck(view, tableRead, latestCheck);
    if (!shouldRevealCheck) {
      const hiddenTarget = isDramaticClassTrialView(view) ? undefined : target;
      return attachDynamics({
        kind: "defend",
        target: hiddenTarget,
        stance: "首日金水先藏验人，保留预言家生存空间",
        talkingPoints: [
          buildHiddenSeerCheckPoint(view, hiddenTarget),
          memoryPoint ?? (focus ? `${focus.name} 的发言和票型先继续验` : "先让外置位充分发言"),
        ],
        risk: 0.42,
      });
    }

    return attachDynamics({
      kind: "claim-check",
      target,
      stance:
        latestCheck.result === "WEREWOLF"
          ? `${target?.name ?? `${latestCheck.targetSeatId}号`} 是我的查验狼`
          : `${target?.name ?? `${latestCheck.targetSeatId}号`} 是我的金水`,
      talkingPoints: [
        latestCheck.result === "WEREWOLF" ? "今天先围绕查验狼归票" : "金水位先放一轮",
        memoryPoint ?? (focus ? `${focus.name} 的票型和发言还要继续验` : "不要散票"),
      ],
      risk: 0.7,
      claimIntent: {
        claimedRole: "SEER",
        strength: "hard",
        check: {
          day: latestCheck.day,
          claimantSeatId: view.mySeatId,
          targetSeatId: latestCheck.targetSeatId,
          result: latestCheck.result,
        },
      },
    });
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    const fakeCheck = chooseWolfFakeCheck(view, tableRead);
    const wolfAssignment = view.privateKnowledge.wolfTeamPlan?.assignments.find(
      (assignment) => assignment.seat.seatId === view.mySeatId,
    );
    const opposingSeerClaim = view.publicSummary.claimBoard.find(
      (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId !== view.mySeatId,
    );
    const hasSeerClaim = view.publicSummary.claimBoard.some(
      (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId !== view.mySeatId,
    );
    const alreadyClaimedSeer = view.publicSummary.claimBoard.some(
      (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId === view.mySeatId,
    );
    const bluffing = view.persona?.bluffing ?? 0.45;
    const hasTeamAssignment = Boolean(wolfAssignment);
    const shouldCounterclaim = Boolean(
      fakeCheck &&
        (alreadyClaimedSeer ||
          shouldFollowWolfCounterclaimPlan(view, wolfAssignment, hasSeerClaim) ||
          (!hasTeamAssignment && shouldFreelanceWolfClaim(view, hasSeerClaim, personaRisk, bluffing))),
    );

    if (shouldCounterclaim && fakeCheck) {
      const target = toTargetFromRead(tableRead, fakeCheck.targetSeatId);
      return attachDynamics({
        kind: hasSeerClaim ? "counterclaim" : "claim-check",
        target,
        stance:
          fakeCheck.result === "WEREWOLF"
            ? `我跳预言家，${target?.name ?? `${fakeCheck.targetSeatId}号`} 是查杀`
            : `我跳预言家，${target?.name ?? `${fakeCheck.targetSeatId}号`} 是金水`,
        talkingPoints: [
          fakeCheck.result === "WEREWOLF" ? "今天先从我的查杀位归票" : "我的金水位先别乱出",
          memoryPoint ??
            (opposingSeerClaim
            ? `我不认${opposingSeerClaim.claimant.seatId}号预言家`
            : "不要让身份信息散在外置位"),
        ],
        risk: Math.max(0.72, personaRisk),
        claimIntent: {
          claimedRole: "SEER",
          strength: "hard",
          check: fakeCheck,
          isCounterclaim: hasSeerClaim,
        },
      });
    }

    if (wolfAssignment?.task === "PUSH_MISLYNCH" && wolfAssignment.target) {
      const target = toTargetFromRead(tableRead, wolfAssignment.target.seatId) ?? wolfAssignment.target;
      return attachDynamics({
        kind: "rally",
        target,
        stance: `狼队冲锋位把票压向 ${target.name}`,
        talkingPoints: [
          wolfAssignment.supportSeat ? `我暂时认${wolfAssignment.supportSeat.seatId}号预言家` : "我先跟公开身份线走",
          `今天先压${target.seatId}号，票不要散`,
        ],
        risk: Math.max(0.62, personaRisk),
      });
    }

    if (wolfAssignment?.task === "DISTANCE" && wolfAssignment.supportSeat && personaRisk > 0.45) {
      return attachDynamics({
        kind: "pressure",
        target: wolfAssignment.supportSeat,
        stance: `狼队倒钩位对 ${wolfAssignment.supportSeat.name} 保持距离`,
        talkingPoints: [
          `我不完全认${wolfAssignment.supportSeat.seatId}号预言家`,
          memoryPoint ?? (focus ? `${focus.seatId}号也要补站边理由` : "身份线不能只听单边"),
        ],
        risk: Math.max(0.48, personaRisk),
      });
    }

    return attachDynamics({
      kind: personaRisk > 0.65 ? "confuse" : "pressure",
      target: focus,
      stance: focus ? `先把焦点压到 ${focus.name}` : "先制造发言对比",
      talkingPoints: [
        memoryPoint ?? view.privateKnowledge.wolfTeamPlan?.summary ?? focus?.pressure[0] ?? "场上信息还不够集中",
        tableRead.voteSnapshot.leaders[0] ? `票型焦点在 ${tableRead.voteSnapshot.leaders[0].name}` : "不要过早认死身份",
      ],
      risk: Math.max(0.35, personaRisk),
    });
  }

  if (view.myRole === "WITCH") {
    const stancePoint = buildPublicStancePoint(view, tableRead);
    const identityPressure = buildIdentityPressure(view);
    if (identityPressure.shouldHideGod) {
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: "神坑已经暴露太多，女巫视角先藏住",
        talkingPoints: [
          "神坑已经够亮，剩下的身份不要继续送夜刀收益",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 需要从公开发言解释` : "先让外置位补站边"),
        ],
        risk: 0.22,
      });
    }
    if (shouldGodLead(view, tableRead, identityPressure, "WITCH")) {
      const savedTarget = view.privateKnowledge.witch?.savedTarget;
      return attachDynamics({
        kind: "rally",
        target: focus,
        stance: "女巫拍身份带队收票型",
        talkingPoints: [
          buildDramaticWitchLeadPoint(view, savedTarget),
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 先正面解释` : "先按公开身份线归票"),
        ],
        risk: Math.max(0.64, personaRisk),
        claimIntent: {
          claimedRole: "WITCH",
          strength: "hard",
        },
      });
    }
    return attachDynamics({
      kind: "defend",
      target: focus,
      stance: "先保药品和票型信息",
      talkingPoints: [
        tableRead.recentDeaths.at(-1) ?? "死亡信息还不够完整",
        memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 需要解释` : "先听完整轮发言"),
      ],
      risk: 0.35,
      claimIntent: {
        claimedRole: "WITCH",
        strength: "soft",
      },
    });
  }

  if (view.myRole === "HUNTER") {
    const stancePoint = buildPublicStancePoint(view, tableRead);
    const identityPressure = buildIdentityPressure(view);
    if (identityPressure.shouldHideGod) {
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: "神坑已经暴露太多，猎人身份先藏住",
        talkingPoints: [
          "神坑已经够亮，我不继续把身份送出去",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 给过程，不要只给结论` : "先看谁强推身份坑"),
        ],
        risk: 0.26,
      });
    }
    if (shouldGodLead(view, tableRead, identityPressure, "HUNTER")) {
      return attachDynamics({
        kind: "rally",
        target: focus,
        stance: "猎人拍身份压住归票",
        talkingPoints: [
          buildDramaticHunterLeadPoint(view),
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 如果只给结论我会压票` : "先按公开疑点归票"),
        ],
        risk: Math.max(0.66, personaRisk),
        claimIntent: {
          claimedRole: "HUNTER",
          strength: "hard",
        },
      });
    }
    return attachDynamics({
      kind: "pressure",
      target: focus,
      stance: "底牌不虚但不急着拍身份",
      talkingPoints: [
        memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 给过程，不要只给结论` : "我会看谁强推闭眼位"),
        "投票前看归票是否自然",
      ],
      risk: 0.5,
      claimIntent: {
        claimedRole: "HUNTER",
        strength: "soft",
      },
    });
  }

  if (view.myRole === "IDIOT") {
    const stancePoint = buildPublicStancePoint(view, tableRead);
    const identityPressure = buildIdentityPressure(view);
    if (identityPressure.shouldHideGod) {
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: "神坑已经暴露太多，白痴身份先藏住",
        talkingPoints: [
          "神坑已经够亮，我不继续把身份送出去",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 要把发言矛盾解释清楚` : "先看谁借身份坑带节奏"),
        ],
        risk: 0.24,
      });
    }
    if (shouldGodLead(view, tableRead, identityPressure, "IDIOT")) {
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: "白痴拍身份挡抗推压力",
        talkingPoints: [
          "我拍白痴，今天别把票浪费在我这里",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 的公开狼面更需要解释` : "票要压到真正有狼面的发言位"),
        ],
        risk: Math.max(0.58, personaRisk),
        claimIntent: {
          claimedRole: "IDIOT",
          strength: "hard",
        },
      });
    }
    return attachDynamics({
      kind: "defend",
      target: focus,
      stance: "白痴牌先用公开逻辑防误推",
      talkingPoints: [
        memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 先解释站边和票型` : "先把发言顺序听完整"),
        "我不怕吃抗推，但好人票不能乱散",
      ],
      risk: 0.42,
      claimIntent: {
        claimedRole: "IDIOT",
        strength: "soft",
      },
    });
  }

  if (view.myRole === "KNIGHT") {
    const stancePoint = buildPublicStancePoint(view, tableRead);
    const identityPressure = buildIdentityPressure(view);
    if (identityPressure.shouldHideGod) {
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: "神坑已经暴露太多，骑士身份先藏住",
        talkingPoints: [
          "神坑已经够亮，我不继续把身份送出去",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 的狼面要从公开证据说清楚` : "先看谁急着逼身份"),
        ],
        risk: 0.24,
      });
    }
    if (shouldGodLead(view, tableRead, identityPressure, "KNIGHT")) {
      return attachDynamics({
        kind: "rally",
        target: focus,
        stance: "骑士拍身份压住归票",
        talkingPoints: [
          "我拍骑士，今天不要散票，也不要把决斗当替代推理",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 如果是狼人要拿公开逻辑坐实` : "先按身份线和票型归票"),
        ],
        risk: Math.max(0.64, personaRisk),
        claimIntent: {
          claimedRole: "KNIGHT",
          strength: "hard",
        },
      });
    }
    return attachDynamics({
      kind: "pressure",
      target: focus,
      stance: "骑士牌先用公开逻辑给压力",
      talkingPoints: [
        memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 先解释发言和票型` : "先听完整轮发言"),
        "决斗窗口不替代发言推理，证据够硬再动手",
      ],
      risk: 0.44,
      claimIntent: {
        claimedRole: "KNIGHT",
        strength: "soft",
      },
    });
  }

  if (view.myRole === "GUARD") {
    const stancePoint = buildPublicStancePoint(view, tableRead);
    const identityPressure = buildIdentityPressure(view);
    if (identityPressure.shouldHideGod) {
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: "神坑已经暴露太多，守卫身份先藏住",
        talkingPoints: [
          "神坑已经够亮，我不继续把身份送出去",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 需要补过程` : "先看谁借身份坑带节奏"),
        ],
        risk: 0.24,
      });
    }
    return attachDynamics({
      kind: "defend",
      target: focus,
      stance: "守卫牌先用公开逻辑压住票型",
      talkingPoints: [
        memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 先解释发言和票型` : "先听完整轮发言"),
        "不要把神职信息一次性打空",
      ],
      risk: 0.38,
      claimIntent: {
        claimedRole: "GUARD",
        strength: "soft",
      },
    });
  }

  if (view.myRole === "VILLAGER") {
    const stancePoint = buildPublicStancePoint(view, tableRead);
    const identityPressure = buildIdentityPressure(view);
    const fakeGodRole = chooseVillagerFakeGodRole(view, identityPressure);
    if (fakeGodRole) {
      const roleText = fakeGodRole === "WITCH" ? "女巫" : "猎人";
      return attachDynamics({
        kind: "defend",
        target: focus,
        stance: `用${roleText}口径扛夜刀压力`,
        talkingPoints: [
          fakeGodRole === "WITCH" ? "我这里像女巫视角，狼夜里可以来试" : "我底牌不虚，狼夜里可以来试",
          memoryPoint ?? stancePoint ?? (focus ? `${focus.name} 先补发言逻辑` : "今天别继续逼身份坑"),
        ],
        risk: Math.max(0.62, personaRisk),
        claimIntent: {
          claimedRole: fakeGodRole,
          strength: view.persona?.bluffing && view.persona.bluffing >= 0.88 ? "hard" : "soft",
        },
      });
    }

    if (identityPressure.shouldHideVillager) {
      return attachDynamics({
        kind: "explain-vote",
        target: focus,
        stance: "民坑已经暴露太多，平民身份先藏住",
        talkingPoints: [
          "民坑已经够亮，我不继续报身份",
          memoryPoint ?? stancePoint ?? focus?.pressure[0] ?? "先看发言是否前后一致",
        ],
        risk: 0.28,
      });
    }
  }

  return attachDynamics({
    kind: "explain-vote",
    target: focus,
    stance: "闭眼好人按公开信息投票",
    talkingPoints: [
      memoryPoint ?? buildPublicStancePoint(view, tableRead) ?? focus?.pressure[0] ?? "先看发言是否前后一致",
      tableRead.voteSnapshot.leaders[0] ? `票型领先位是 ${tableRead.voteSnapshot.leaders[0].name}` : "投票不要太分散",
    ],
    risk: 0.4,
  });
}

function shouldRevealSeerCheck(
  view: AgentView,
  tableRead: AiTableRead,
  latestCheck: NonNullable<AgentView["privateKnowledge"]["seerChecks"]>[number],
): boolean {
  if (latestCheck.result === "WEREWOLF") return true;

  const alreadyClaimed = view.publicSummary.tableMemory.claimBoard.some(
    (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId === view.mySeatId,
  );
  if (alreadyClaimed) return true;

  const selfRead = tableRead.seats.find((seat) => seat.seatId === view.mySeatId);
  const underBlackCheck = selfRead?.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ?? false;
  const underHardPressure = selfRead ? selfRead.suspicion - selfRead.trust >= 28 || selfRead.votesReceived >= 2 : false;
  if (underBlackCheck || underHardPressure) return true;

  const hasPublicSeerCounterclaim = view.publicSummary.claimBoard.some(
    (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId !== view.mySeatId,
  );
  const revealDay = getGoodSeerCheckRevealDay(view, hasPublicSeerCounterclaim);

  return view.day >= revealDay;
}

function getGoodSeerCheckRevealDay(view: AgentView, hasPublicSeerCounterclaim: boolean): number {
  const wolfRoles = new Set(view.rules.wolfRoles);
  const baseDay = wolfRoles.has("WOLF_KING") || wolfRoles.has("WHITE_WOLF_KING") ? 1 : 3;
  if (hasPublicSeerCounterclaim && baseDay > 1) return 2;
  return baseDay;
}

type IdentityPressure = {
  exposedGodRoles: Set<Role>;
  exposedVillagerClaimants: number;
  selfAlreadyClaimed: boolean;
  shouldHideGod: boolean;
  shouldHideVillager: boolean;
};

function buildIdentityPressure(view: AgentView): IdentityPressure {
  const aliveSeatIds = new Set(view.aliveSeats.map((seat) => seat.seatId));
  const liveClaims = view.publicSummary.claimBoard.filter((claim) => aliveSeatIds.has(claim.claimant.seatId));
  const selfClaims = liveClaims.filter((claim) => claim.claimant.seatId === view.mySeatId);
  const selfAlreadyClaimed = selfClaims.length > 0;
  const exposedGodRoles = new Set(
    liveClaims
      .filter((claim) => claim.claimant.seatId !== view.mySeatId && GOD_ROLES.includes(claim.claimedRole))
      .map((claim) => claim.claimedRole),
  );
  const exposedVillagerClaimants = new Set(
    liveClaims
      .filter((claim) => claim.claimant.seatId !== view.mySeatId && claim.claimedRole === "VILLAGER")
      .map((claim) => claim.claimant.seatId),
  ).size;

  return {
    exposedGodRoles,
    exposedVillagerClaimants,
    selfAlreadyClaimed,
    shouldHideGod: GOD_ROLES.includes(view.myRole) && !selfAlreadyClaimed && exposedGodRoles.size >= 2,
    shouldHideVillager: view.myRole === "VILLAGER" && !selfAlreadyClaimed && exposedVillagerClaimants >= 2,
  };
}

function shouldGodLead(
  view: AgentView,
  tableRead: AiTableRead,
  identityPressure: IdentityPressure,
  role: "WITCH" | "HUNTER" | "IDIOT" | "KNIGHT",
): boolean {
  if (view.myRole !== role) return false;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const hasSeerCounterclaim = view.publicSummary.tableMemory.counterclaims.some((group) => group.claimedRole === "SEER");
  const selfRead = tableRead.seats.find((seat) => seat.seatId === view.mySeatId);
  const selfPressure = selfRead ? selfRead.suspicion - selfRead.trust : 0;
  const focusPressure = tableRead.focus ? tableRead.focus.suspicion - tableRead.focus.trust : 0;
  const publicLeader = tableRead.voteSnapshot.leaders[0];
  const selfIsVoteLeader = publicLeader?.seatId === view.mySeatId;
  const pressureActors =
    selfRead?.publicStancedBy.filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE").length ?? 0;
  const selfIsPublicFocus = tableRead.focus?.seatId === view.mySeatId;
  const pressureMentions = countCurrentDayPressureMentions(view, view.mySeatId);
  const needsSelfDefense =
    selfPressure >= 8 ||
    selfIsVoteLeader ||
    (selfRead?.votesReceived ?? 0) >= 2 ||
    pressureActors >= 2 ||
    (view.day === 1 && pressureMentions >= 1) ||
    (selfIsPublicFocus && focusPressure >= 6);
  const earlyReactiveDefense =
    (role === "HUNTER" || role === "IDIOT" || role === "KNIGHT") &&
    view.day === 1 &&
    hasSeerCounterclaim &&
    (selfPressure >= 5 || (selfRead?.votesReceived ?? 0) >= 1 || pressureActors >= 1 || pressureMentions >= 1 || selfIsPublicFocus);

  if (identityPressure.shouldHideGod && !needsSelfDefense) return false;
  if (identityPressure.selfAlreadyClaimed || needsSelfDefense || earlyReactiveDefense) return true;

  if ((role === "HUNTER" || role === "IDIOT" || role === "KNIGHT") && view.day === 1 && hasSeerCounterclaim) {
    return stableRoll(["god-counterclaim-boundary", role, view.day, view.mySeatId, view.persona?.id]) < 0.72;
  }

  const leaderPressure = publicLeader
    ? tableRead.seats.find((seat) => seat.seatId === publicLeader.seatId)?.suspicion ?? 0
    : 0;

  if (personaRisk >= 0.8 && (view.day >= 2 || hasSeerCounterclaim || focusPressure >= 14)) {
    return true;
  }

  const threshold = clampProbability(
    0.06 +
      personaRisk * 0.28 +
      (view.day >= 2 ? 0.16 : 0) +
      (hasSeerCounterclaim ? (role === "HUNTER" || role === "IDIOT" || role === "KNIGHT" ? 0.3 : 0.2) : 0) +
      (focusPressure >= 14 ? 0.1 : 0) +
      (leaderPressure >= 62 ? 0.08 : 0) -
      identityPressure.exposedGodRoles.size * 0.08,
  );

  return stableRoll(["god-lead", role, view.day, view.mySeatId, view.persona?.id, identityPressure.exposedGodRoles.size]) < threshold;
}

function countCurrentDayPressureMentions(view: AgentView, seatId: number): number {
  const seatPattern = new RegExp(`(^|[^0-9])${seatId}号`);
  const pressurePattern = /压|投|票|焦点|观察位|质疑|解释|结论|过程|抗推|归票|打死/;
  return view.publicSummary.recentSpeeches.filter(
    (speech) =>
      speech.day === view.day &&
      speech.speaker?.seatId !== seatId &&
      seatPattern.test(speech.message) &&
      pressurePattern.test(speech.message),
  ).length;
}

function chooseVillagerFakeGodRole(view: AgentView, identityPressure: IdentityPressure): "WITCH" | "HUNTER" | undefined {
  if (view.myRole !== "VILLAGER" || identityPressure.shouldHideVillager || identityPressure.selfAlreadyClaimed) return undefined;
  if (identityPressure.exposedGodRoles.size >= 2) return undefined;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const bluffing = view.persona?.bluffing ?? 0.45;
  if (view.day <= 1) return undefined;

  const hasIdentityPressure =
    view.publicSummary.tableMemory.counterclaims.length > 0 ||
    view.publicSummary.claimBoard.some((claim) => claim.claimedRole === "SEER");
  if (!hasIdentityPressure && (bluffing < 0.9 || personaRisk < 0.78)) return undefined;

  const availableRoles = (["WITCH", "HUNTER"] as const).filter((role) => !identityPressure.exposedGodRoles.has(role));
  if (availableRoles.length === 0) return undefined;

  if (view.day >= 2 && personaRisk >= 0.72 && bluffing >= 0.88) {
    return availableRoles[stableRoll(["villager-fake-god-role", view.day, view.mySeatId, view.persona?.id]) < 0.5 ? 0 : availableRoles.length - 1];
  }

  const threshold = clampProbability(
    0.02 + bluffing * 0.14 + personaRisk * 0.08 + (hasIdentityPressure ? 0.06 : 0),
  );
  const roll = stableRoll(["villager-fake-god", view.day, view.mySeatId, view.persona?.id, identityPressure.exposedGodRoles.size]);
  if (roll >= threshold) return undefined;

  return availableRoles[stableRoll(["villager-fake-god-role", view.day, view.mySeatId, view.persona?.id]) < 0.5 ? 0 : availableRoles.length - 1];
}

function withSpeechDynamics(
  view: AgentView,
  tableRead: AiTableRead,
  focus: SeatRead | undefined,
  plan: SpeechPlan,
): SpeechPlan {
  const interaction = buildSpeechInteraction(view, tableRead, focus, plan);
  const personaCue = buildPersonaCue(view, plan, focus);
  const tableTask = buildSpeechTableTask(view, tableRead, focus, plan);
  const stanceCue = buildGoodStanceCue(view, plan.target ?? toTargetFromSeatRead(focus), tableRead);
  const target = plan.target ?? interaction?.target ?? toTargetFromSeatRead(focus);
  const targetSpeechStatus = resolveSpeechTargetStatus(view, target);
  const allowedInteraction = resolveAllowedSpeechInteraction(plan, target, targetSpeechStatus);
  const speechMove = resolveSpeechMove(plan, targetSpeechStatus, allowedInteraction);
  const playMotive = buildSpeechPlayMotive(view, plan);
  const identityPoint = buildHardIdentityPoint(plan);
  const talkingPoints = uniqueSpeechPoints([
    identityPoint,
    playMotive?.line,
    tableTask?.line,
    interaction?.line,
    personaCue?.line,
    stanceCue,
    ...plan.talkingPoints,
  ]).slice(0, 4);

  return {
    ...plan,
    target,
    targetSpeechStatus,
    allowedInteraction,
    speechMove,
    interaction,
    personaCue,
    tableTask,
    playMotive,
    talkingPoints,
  };
}

function buildSpeechPlayMotive(view: AgentView, plan: SpeechPlan): SpeechPlan["playMotive"] {
  if (!plan.claimIntent) {
    if (isWolfRole(view.myRole, view.rules.wolfRoles) && plan.kind === "confuse") {
      return {
        kind: "wolf_misdirect",
        line: "用公开视角制造错位和压力，不暴露狼队信息。",
        allowIdentityClaim: false,
      };
    }
    return undefined;
  }

  if (plan.claimIntent.strength === "soft") {
    return {
      kind: "bait_kill",
      line:
        view.myRole === "VILLAGER"
          ? "可以用底牌不虚、能吃刀的口径挡刀，但不要明拍具体神职身份。"
          : "保留底牌威慑和挡刀空间，不把软身份边界说成明确拍身份。",
      allowIdentityClaim: false,
    };
  }

  if (view.myRole === "VILLAGER" && GOD_ROLES.includes(plan.claimIntent.claimedRole)) {
    return {
      kind: "protect_power_role",
      line: "给真神留身份坑，狼夜里可以来试，但发言还要落在公开逻辑上。",
      allowIdentityClaim: true,
    };
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles) && plan.claimIntent.claimedRole === "SEER") {
    return {
      kind: "wolf_misdirect",
      line: "用悍跳身份制造站边压力，理由必须听起来像闭眼公开视角。",
      allowIdentityClaim: true,
    };
  }

  if (plan.kind === "rally") {
    return {
      kind: "self_defense",
      line: "拍身份是为了挡当前票口或收住散票，不是用身份替代推理。",
      allowIdentityClaim: true,
    };
  }

  return {
    kind: "tempo_grab",
    line: "拍身份是为了抢节奏或钓反应，必须同时给公开逻辑。",
    allowIdentityClaim: true,
  };
}

function buildHiddenSeerCheckPoint(view: AgentView, target: ActionTarget | undefined): string {
  if (isDramaticClassTrialView(view)) {
    const targetText = target ? `${target.seatId}号这条验人线` : "我手里的验人线";
    return `${targetText}我暂时不白白交给夜刀；这是我压在裁判席上的可追问边界`;
  }
  return "我手里有一张偏好信息，今天先不把身份线打满";
}

function buildDramaticWitchLeadPoint(view: AgentView, savedTarget: ActionTarget | undefined): string {
  if (!isDramaticClassTrialView(view)) {
    return savedTarget ? `我女巫，平安夜救了${savedTarget.seatId}号，${savedTarget.seatId}号是银水` : "我拍女巫，今天票型不能再散";
  }
  return savedTarget
    ? `女巫在这里，昨晚我把${savedTarget.seatId}号从刀口边上拽回来了；这枚银水筹码现在摊在裁判席上`
    : "女巫在这里，药线我不再藏；今天谁想借混乱散票，就把理由摊到裁判席上";
}

function buildDramaticHunterLeadPoint(view: AgentView): string {
  return isDramaticClassTrialView(view) ? "猎人的枪就在这里；谁要把票乱推到我身上，就先把公开理由说完整" : "我拍猎人，今天不要再分票";
}

function buildHardIdentityPoint(plan: SpeechPlan): string | undefined {
  if (plan.claimIntent?.strength !== "hard") return undefined;
  const roleLabel = ROLE_LABELS[plan.claimIntent.claimedRole];
  if (plan.claimIntent.claimedRole === "SEER" && plan.claimIntent.check) {
    const resultLabel = plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水";
    return `我跳预言家，${plan.claimIntent.check.targetSeatId}号是${resultLabel}`;
  }
  return `我拍${roleLabel}`;
}

function resolveSpeechTargetStatus(view: AgentView, target: ActionTarget | undefined): SpeechPlan["targetSpeechStatus"] {
  if (!target || target.seatId === view.mySeatId) return "none";
  return hasSpokenThisDay(view, target.seatId) ? "spoken" : "unspoken";
}

function resolveAllowedSpeechInteraction(
  plan: SpeechPlan,
  target: ActionTarget | undefined,
  targetSpeechStatus: SpeechPlan["targetSpeechStatus"],
): SpeechPlan["allowedInteraction"] {
  if (
    target &&
    plan.claimIntent?.claimedRole === "SEER" &&
    plan.claimIntent.check?.targetSeatId === target.seatId &&
    plan.claimIntent.check.result === "WEREWOLF"
  ) {
    return "finalize_black_check";
  }
  if (targetSpeechStatus === "spoken") return "review_spoken";
  if (targetSpeechStatus === "unspoken") return "ask_future";
  return "none";
}

function resolveSpeechMove(
  plan: SpeechPlan,
  targetSpeechStatus: SpeechPlan["targetSpeechStatus"],
  allowedInteraction: SpeechPlan["allowedInteraction"],
): SpeechPlan["speechMove"] {
  if (allowedInteraction === "finalize_black_check") return "claim_black_check";
  if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check?.result === "GOOD") return "claim_gold_check";
  if (plan.claimIntent?.strength === "hard") return "identity_claim";
  if (plan.kind === "rally") return "lock_vote";
  if (allowedInteraction === "review_spoken") return "review_spoken_target";
  if (allowedInteraction === "ask_future") return "ask_unspoken_target";
  if (plan.kind === "defend" || plan.kind === "explain-vote") return "explain_vote";
  if (targetSpeechStatus !== "none") return "soft_pressure";
  return "none";
}

function buildSpeechTableTask(
  view: AgentView,
  tableRead: AiTableRead,
  focus: SeatRead | undefined,
  plan: SpeechPlan,
): SpeechPlan["tableTask"] {
  const spokenThisDay = view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker);
  const pressureInfluence = tableRead.tableMemory.speechInfluence.find(
    (item) => item.day === view.day && item.direction === "pressure" && item.followupCount >= 1,
  );
  const mentionedFocus = inferCurrentDayMentionFocus(view, tableRead, spokenThisDay);
  const rawFocusTarget =
    focus ??
    (plan.target ? tableRead.seats.find((seat) => seat.seatId === plan.target?.seatId) : undefined) ??
    (pressureInfluence ? tableRead.seats.find((seat) => seat.seatId === pressureInfluence.target.seatId) : undefined) ??
    mentionedFocus;
  const focusTarget =
    rawFocusTarget && isHiddenDramaticClassTrialGoodCheckTarget(view, tableRead, rawFocusTarget.seatId)
      ? undefined
      : rawFocusTarget;
  const repeatedPressure = focusTarget
    ? tableRead.tableMemory.speechInfluence.find(
        (item) =>
          item.day === view.day &&
          item.direction === "pressure" &&
          item.target.seatId === focusTarget.seatId &&
          item.followupCount >= 1,
      ) ?? pressureInfluence
    : pressureInfluence;

  if (spokenThisDay.length === 0) {
    return {
      mode: "set-standard",
      line: "首置位先给一个可验证观察点；平安夜只说女巫用药了即可，不主动展开药线或空刀，也不要求下一位立刻站边或交票口。",
      directives: ["给观察点", "平安夜只作背景", "不要求站边票口"],
    };
  }

  if (repeatedPressure && focusTarget) {
    const alternatives = tableRead.seats.filter(
      (seat) =>
        !seat.isSelf &&
        !seat.isWolfTeammate &&
        seat.seatId !== focusTarget.seatId &&
        !isProtectedGoodSpeechTarget(view, tableRead, seat),
    );
    const alternative = alternatives.sort((a, b) => b.suspicion - b.trust - (a.suspicion - a.trust) || a.seatId - b.seatId)[0];
    const variant = (view.mySeatId + spokenThisDay.length) % 3;
    if (variant === 0) {
      return {
        mode: "audit-pressure-chain",
        target: toTargetFromSeatRead(focusTarget),
        line: `桌面已经多人接住${focusTarget.seatId}号压力，这轮必须换角度，不要复读同一缺口；先审计谁在借这个焦点做收益。`,
        directives: ["审计压力链", "找收益位", "不要复读"],
      };
    }
    if (variant === 1) {
      return {
        mode: "hold-countercase",
        target: toTargetFromSeatRead(focusTarget),
        line: `保留${focusTarget.seatId}号好人面，说明他还有哪种正面解释，再给一个可验证标准。`,
        directives: ["给反面解释", "保留余地", "落验证点"],
      };
    }
    return {
      mode: "pivot-alternative",
      target: toTargetFromSeatRead(alternative ?? focusTarget),
      line: alternative
        ? `从${focusTarget.seatId}号压力链转看${alternative.seatId}号，检查有没有人在跟压但没有新增理由。`
        : `不要复读${focusTarget.seatId}号同一缺口，改成检查压力链是否过度集中。`,
      directives: ["转向替代观察位", "检查跟压", "保留主焦点"],
    };
  }

  if (isLowInfoDayOneNoHardInfo(view, spokenThisDay)) {
    return {
      mode: "set-standard",
      line: "低信息首轮只审计观察点和跟压收益，不要因为任何前置位没站边或没给票口去硬打；先记录等待身份/查验信息。",
      directives: ["审计观察点", "不硬打站边票口", "等待身份信息"],
    };
  }

  if (tableRead.voteSnapshot.leaders.length > 0) {
    return {
      mode: "summarize-vote",
      target: tableRead.voteSnapshot.leaders[0],
      line: `当前票型已经有焦点，先说清这票是硬证据归票还是软压力票，别把软票说成铁证。`,
      directives: ["区分硬软证据", "说明票型风险", "落票口边界"],
    };
  }

  return undefined;
}

function isHiddenDramaticClassTrialGoodCheckTarget(view: AgentView, tableRead: AiTableRead, seatId: number): boolean {
  if (!isDramaticClassTrialView(view) || view.myRole !== "SEER") return false;
  const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
  if (!latestCheck || latestCheck.result !== "GOOD" || latestCheck.targetSeatId !== seatId) return false;
  return !shouldRevealSeerCheck(view, tableRead, latestCheck);
}

function inferCurrentDayMentionFocus(
  view: AgentView,
  tableRead: AiTableRead,
  spokenThisDay: AgentView["publicSummary"]["recentSpeeches"],
): SeatRead | undefined {
  if (spokenThisDay.length < 2) return undefined;
  const scores = new Map<number, number>();
  for (const speech of spokenThisDay) {
    const message = speech.message;
    for (const seat of tableRead.seats) {
      if (seat.isSelf || seat.isWolfTeammate) continue;
      const mentions = countSeatMentions(message, seat.seatId);
      if (mentions === 0) continue;
      const pressureBonus = /压|怀疑|焦点|票|站边|标准|解释|补|问题|狼面|抗推/.test(message) ? 1 : 0;
      scores.set(seat.seatId, (scores.get(seat.seatId) ?? 0) + mentions + pressureBonus);
    }
  }
  const [seatId, score] = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [];
  if (!seatId || score < 2) return undefined;
  return tableRead.seats.find((seat) => seat.seatId === seatId && !isProtectedGoodSpeechTarget(view, tableRead, seat));
}

function isLowInfoDayOneNoHardInfo(view: AgentView, spokenThisDay: AgentView["publicSummary"]["recentSpeeches"]): boolean {
  if (view.day !== 1 || spokenThisDay.length === 0) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  return !spokenThisDay.some((speech) => hasHardDayOneOpeningInfo(speech.message));
}

function isLowInfoDayOneSeatSpeech(view: AgentView, seatId: number, message: string): boolean {
  if (view.day !== 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  const currentDaySpeeches = view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker);
  const firstSpeaker = currentDaySpeeches[0]?.speaker?.seatId;
  if (firstSpeaker !== seatId || currentDaySpeeches.length > 2) return false;
  return !hasHardDayOneOpeningInfo(message);
}

function isLowInfoDayOneTarget(view: AgentView, seatId: number): boolean {
  const speech = view.publicSummary.recentSpeeches.find((item) => item.day === view.day && item.speaker?.seatId === seatId);
  return Boolean(speech && isLowInfoDayOneSeatSpeech(view, seatId, speech.message));
}

function hasHardDayOneOpeningInfo(message: string): boolean {
  const withoutDeathShape = message.replace(/(?:平安夜[^。！？；]{0,20})?女巫用药(?:了|处理)?|按女巫用药处理/g, "");
  return /查杀|金水|预言家|我是女巫|我女巫|猎人|骑士|守卫|警徽|归票|出人|投/.test(withoutDeathShape);
}

function countSeatMentions(message: string, seatId: number): number {
  return [...message.matchAll(new RegExp(`(^|[^0-9])${seatId}\\s*(号|號|seat|座|位)?`, "gi"))].length;
}

function hasSpokenThisDay(view: AgentView, seatId: number): boolean {
  return view.publicSummary.recentSpeeches.some((speech) => speech.day === view.day && speech.speaker?.seatId === seatId);
}

function buildGoodStanceCue(
  view: AgentView,
  target: ActionTarget | undefined,
  tableRead: AiTableRead,
): string | undefined {
  if (!target || isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;
  const read = tableRead.seats.find((seat) => seat.seatId === target.seatId);
  if (!read || read.isSelf || read.isWolfTeammate) return undefined;
  if (isProtectedGoodSpeechTarget(view, tableRead, read)) return undefined;

  const pressureDelta = read.suspicion - read.trust;
  if (pressureDelta >= 10) {
    return `我怀疑${read.seatId}号，${read.pressure[0] ?? "这轮发言和票型需要继续解释"}`;
  }

  if (read.trust - read.suspicion >= 18) {
    return `我认${read.seatId}号，先把他的视角和票型放进好人参考`;
  }

  return undefined;
}

function buildSpeechInteraction(
  view: AgentView,
  tableRead: AiTableRead,
  focus: SeatRead | undefined,
  plan: SpeechPlan,
): SpeechPlan["interaction"] {
  const previousSpeech = [...view.publicSummary.recentSpeeches]
    .reverse()
    .find((speech) => speech.speaker && speech.speaker.seatId !== view.mySeatId);
  const previousRead = previousSpeech?.speaker
    ? tableRead.seats.find(
        (seat) =>
          seat.seatId === previousSpeech.speaker?.seatId &&
          !seat.isWolfTeammate &&
          !isProtectedGoodSpeechTarget(view, tableRead, seat),
      )
    : undefined;
  const planTarget = plan.target
    ? tableRead.seats.find(
        (seat) =>
          seat.seatId === plan.target?.seatId &&
          !seat.isSelf &&
          !seat.isWolfTeammate &&
          !isProtectedGoodSpeechTarget(view, tableRead, seat),
      )
    : undefined;
  const target = planTarget ?? focus;
  const sourceSpeaker = previousSpeech?.speaker;

  if (plan.kind === "rally" && target) {
    return {
      kind: "rally",
      target: toTargetFromSeatRead(target),
      line: `这轮我会把票型往${target.seatId}号集中，不想让票散掉`,
      goal: "推动归票集中",
    };
  }

  if (sourceSpeaker && previousRead) {
    const pressureDelta = previousRead.suspicion - previousRead.trust;
    const previousTarget = toTargetFromSeatRead(previousRead);

    if (target && previousRead.seatId === target.seatId && pressureDelta >= 8) {
      return {
        kind: "challenge",
        sourceSpeaker,
        target: previousTarget,
        line: `我接一下上一位${sourceSpeaker.name}，他这段发言还缺把结论推出来的过程`,
        goal: "追问上一位的逻辑链",
      };
    }

    if (previousRead.trust - previousRead.suspicion >= 16 && target && previousRead.seatId !== target.seatId) {
      return {
        kind: "support",
        sourceSpeaker,
        target: previousTarget,
        line: `上一位${sourceSpeaker.name}的视角我先认可一部分，再对照${target.seatId}号的解释`,
        goal: "借可信发言建立对照",
      };
    }

    if (target && previousRead.seatId !== target.seatId) {
      return {
        kind: "pivot",
        sourceSpeaker,
        target: toTargetFromSeatRead(target),
        line: `上一位${sourceSpeaker.name}先记下，但我这轮要转回${target.seatId}号的发言缺口`,
        goal: "从上一位转回主焦点",
      };
    }

    if (pressureDelta >= 0) {
      const lowInfoOpening = isLowInfoDayOneSeatSpeech(view, previousRead.seatId, previousRead.lastSpeech ?? "");
      return {
        kind: "probe",
        sourceSpeaker,
        target: previousTarget,
        line: lowInfoOpening
          ? `上一位${sourceSpeaker.name}我先轻记，只看他的开口观察点是不是过泛`
          : `上一位${sourceSpeaker.name}我先留疑问，回看他刚才的站边理由能不能和票型对上`,
        goal: "保留追问窗口",
      };
    }
  }

  if (!target) return undefined;

  if ((view.persona?.riskTolerance ?? 0.45) >= 0.65) {
    return {
      kind: "challenge",
      target: toTargetFromSeatRead(target),
      line: hasSpokenThisDay(view, target.seatId)
        ? `我会直接压${target.seatId}号，回看他刚才发言和票型哪里没讲完整`
        : `我会直接压${target.seatId}号，轮到他时只听发言和票型能不能讲完整`,
      goal: "主动制造压力",
    };
  }

  return {
    kind: "probe",
    target: toTargetFromSeatRead(target),
    line: hasSpokenThisDay(view, target.seatId)
      ? `我先把${target.seatId}号放进观察位，只回看他已经说出口的逻辑`
      : `我先把${target.seatId}号放进观察位，等他发言时讲清自己的逻辑`,
    goal: "保持可变判断",
  };
}

function buildPersonaCue(
  view: AgentView,
  plan: SpeechPlan,
  focus: SeatRead | undefined,
): SpeechPlan["personaCue"] {
  const personaId = view.persona?.id ?? "steady";
  const preferences = personaPreferences(view);
  const targetText = plan.target?.seatId ?? focus?.seatId;
  const targetHasSpoken = targetText ? hasSpokenThisDay(view, targetText) : false;
  const lowInfoOpeningTarget = targetText ? isLowInfoDayOneTarget(view, targetText) : false;

  if (personaId === "strong-leader" || personaId === "pressure-bluffer") {
    return {
      mode: "press",
      line: targetText
        ? lowInfoOpeningTarget
          ? `我这轮只轻记${targetText}号的开口观察点，不急着归票`
          : targetHasSpoken
          ? `我这轮会结论先行，回看${targetText}号刚才发言`
          : `我这轮会结论先行，要求${targetText}号正面回应`
        : "我这轮会先把结论给出来",
      directives: lowInfoOpeningTarget ? ["轻记观察点", "不急归票", "等待硬信息"] : ["结论先行", "主动归票", targetHasSpoken ? "回看目标原话" : "要求目标补过程"],
    };
  }

  if (personaId === "logic-checker" || personaId === "calm-analyst") {
    return {
      mode: "verify",
      line: "我会把前后发言、站边和票型放在一起校验",
      directives: ["引用公开细节", "对照前后变化", "避免空结论"],
    };
  }

  if (personaId === "careful-follower" || personaId === "quiet-observer") {
    return {
      mode: "hedge",
      line: targetText ? `我先不把${targetText}号打死，但要把疑问留在桌面上` : "我先保留判断，只给当前疑问",
      directives: ["保留余地", "少给死结论", "保留后置位视角"],
    };
  }

  if (personaId === "identity-focused") {
    return {
      mode: "identity",
      line: "我会优先看身份线有没有互相打架",
      directives: ["围绕身份结构", "检查预言家线", "避免身份信息散乱"],
    };
  }

  if (personaId === "emotional-voter") {
    return {
      mode: "emotion",
      line: "我会把语气和态度变化也放进判断里",
      directives: ["回应语气", "指出态度变化", "用直觉补足信息"],
    };
  }

  if (preferences.identity >= 0.88) {
    return {
      mode: "identity",
      line: "我会先把预言家线、神坑和民坑的结构关系摆出来",
      directives: ["围绕身份结构", "对照金水查杀", "记住前后身份口径"],
    };
  }

  if (preferences.logic >= 0.86) {
    return {
      mode: "verify",
      line: "我会把发言顺序、票型和前后逻辑一起校验",
      directives: ["引用公开细节", "对照前后变化", "少用情绪结论"],
    };
  }

  if (preferences.emotion >= 0.82) {
    return {
      mode: "emotion",
      line: targetText
        ? lowInfoOpeningTarget
          ? `我会先看谁借${targetText}号这个轻焦点带节奏`
          : `我会直接给${targetText}号压力，先听他的即时反应`
        : "我会先把桌面情绪和反应压出来",
      directives: lowInfoOpeningTarget ? ["审计跟压", "不硬归票", "看节奏收益"] : ["节奏更快", "回应语气", "制造互动压力"],
    };
  }

  if (preferences.leadership >= 0.82) {
    return {
      mode: "press",
      line: targetText
        ? lowInfoOpeningTarget
          ? `我这轮只把${targetText}号当轻观察点，先收谁在借题发挥`
          : `我这轮会把${targetText}号放进归票讨论`
        : "我这轮会先收束票型",
      directives: lowInfoOpeningTarget ? ["轻观察", "审计借题发挥", "不要求首置位站边"] : ["给出清晰边界", "组织票型", "要求明确站边"],
    };
  }

  if (preferences.caution >= 0.82) {
    return {
      mode: "hedge",
      line: targetText ? `我先不把${targetText}号打死，但会保留这个观察点` : "我先保留判断，少给死结论",
      directives: ["保留余地", "低暴露", "等待更多信息"],
    };
  }

  if (preferences.identity >= 0.72) {
    return {
      mode: "identity",
      line: "我会看身份线和态度结构有没有互相打架",
      directives: ["结构化站边", "检查身份收益", "观察临场反应"],
    };
  }

  if (preferences.memory >= 0.82) {
    return {
      mode: "verify",
      line: "我会把上一轮记下的发言和今天的票型放在一起看",
      directives: ["延续个人记忆", "追踪前后变化", "避免临场失忆"],
    };
  }

  return {
    mode: "steady",
    line: "我会先给稳定视角，不把票型带得太散",
    directives: ["稳定表达", "公开理由", "控制风险"],
  };
}

function uniqueSpeechPoints(points: Array<string | undefined>): string[] {
  return [...new Set(points.map((point) => point?.trim()).filter((point): point is string => Boolean(point)))];
}

function toTargetFromSeatRead(seat: SeatRead | undefined): ActionTarget | undefined {
  return seat ? { seatId: seat.seatId, name: seat.name } : undefined;
}

function chooseContinuityFocus(view: AgentView, tableRead: AiTableRead): SeatRead | undefined {
  const hasCurrentDaySpeech = view.publicSummary.recentSpeeches.some((speech) => speech.day === view.day);
  const hasPublicIdentityOrVoteFocus =
    view.publicSummary.claimBoard.length > 0 ||
    view.publicSummary.voteSnapshot.leaders.length > 0 ||
    view.publicSummary.tableMemory.counterclaims.length > 0;
  if (!hasCurrentDaySpeech && !hasPublicIdentityOrVoteFocus) return undefined;

  const memory = view.privateKnowledge.aiMemory;
  const rememberedSeatId = memory?.suspectedSeatId ?? memory?.lastSpeechTargetSeatId ?? memory?.lastVoteTargetSeatId;
  const publicFocus = [tableRead.focus, tableRead.backupFocus].find(
    (seat): seat is SeatRead => Boolean(seat && isSupportedSpeechFocus(view, tableRead, seat, "public")),
  );
  const rememberedFocus = rememberedSeatId
    ? tableRead.seats.find(
        (seat) =>
          seat.seatId === rememberedSeatId &&
          !seat.isSelf &&
          !seat.isWolfTeammate &&
          isSupportedSpeechFocus(view, tableRead, seat, "memory"),
      )
    : undefined;

  if (!rememberedFocus) return publicFocus;
  if (!publicFocus) return rememberedFocus;

  return rememberedFocus.suspicion >= publicFocus.suspicion - 12 ? rememberedFocus : publicFocus;
}

function isSupportedSpeechFocus(
  view: AgentView,
  tableRead: AiTableRead,
  seat: SeatRead,
  source: "public" | "memory",
): boolean {
  if (seat.isSelf || seat.isWolfTeammate || isProtectedGoodSpeechTarget(view, tableRead, seat)) return false;
  if (hasSpokenThisDay(view, seat.seatId)) return true;
  if (hasCurrentDaySeatMention(view, seat.seatId)) return true;
  if (view.publicSummary.voteSnapshot.leaders.some((leader) => leader.seatId === seat.seatId)) return true;
  if (view.publicSummary.recentVotes.some((vote) => vote.day === view.day && vote.target?.seatId === seat.seatId)) return true;
  if (seat.votesReceived > 0 || seat.publicClaims.length > 0 || seat.publicChecksAgainst.length > 0) return true;
  if (
    tableRead.tableMemory.speechInfluence.some(
      (item) => item.day === view.day && item.target.seatId === seat.seatId && item.direction === "pressure",
    )
  ) {
    return true;
  }

  const cue = tableRead.tableMemory.reasoningCues.find((item) => item.target?.seatId === seat.seatId);
  if (cue && (cue.weight !== "light" || view.day >= 2)) return true;

  const focusItem = tableRead.tableMemory.focus.find((item) => item.seat.seatId === seat.seatId);
  if (view.day >= 2 && focusItem && focusItem.score >= 24) return true;

  return source === "memory" && view.day >= 2;
}

function hasCurrentDaySeatMention(view: AgentView, seatId: number): boolean {
  return view.publicSummary.recentSpeeches.some(
    (speech) => speech.day === view.day && speech.speaker?.seatId !== seatId && countSeatMentions(speech.message, seatId) > 0,
  );
}

function buildMemorySpeechPoint(
  view: AgentView,
  tableRead: AiTableRead,
  focus: SeatRead | undefined,
): string | undefined {
  const memory = view.privateKnowledge.aiMemory;
  if (!memory || !focus || focus.isSelf || focus.isWolfTeammate) return undefined;
  if (isProtectedGoodSpeechTarget(view, tableRead, focus)) return undefined;

  if (memory.lastVoteTargetSeatId === focus.seatId) {
    return `我上一轮票过${focus.seatId}号，这轮先看他有没有把逻辑补上`;
  }

  if (memory.lastSpeechTargetSeatId === focus.seatId) {
    return `我上一轮已经点过${focus.seatId}号，当前仍要继续听解释`;
  }

  if (memory.suspectedSeatId === focus.seatId && view.day >= 2) {
    return `我前面持续怀疑${focus.seatId}号，理由要和今天发言对照`;
  }

  const trustedSeat = memory.trustedSeatId
    ? tableRead.seats.find((seat) => seat.seatId === memory.trustedSeatId && !seat.isWolfTeammate)
    : undefined;
  if (trustedSeat && trustedSeat.seatId !== focus.seatId) {
    return `我暂时更信${trustedSeat.seatId}号，所以焦点先放在${focus.seatId}号`;
  }

  return undefined;
}

function applyPublicClaimCredibility(view: AgentView, seats: SeatRead[]): void {
  const seerClaims = view.publicSummary.tableMemory.claimBoard.filter((claim) => claim.claimedRole === "SEER");
  if (seerClaims.length === 0) return;

  const counterclaimSeatIds = new Set(
    view.publicSummary.tableMemory.counterclaims
      .filter((group) => group.claimedRole === "SEER")
      .flatMap((group) => group.claimants.map((claimant) => claimant.seatId)),
  );

  for (const claim of seerClaims) {
    const claimant = seats.find((seat) => seat.seatId === claim.claimant.seatId);
    if (!claimant || claimant.isSelf || claimant.isWolfTeammate || claimant.isKnownWolf || claimant.isKnownGood) continue;

    const credibility = scorePublicSeerClaim(view, seats, claim, counterclaimSeatIds.has(claim.claimant.seatId));
    claimant.trust = clampScore(claimant.trust + credibility.trust);
    claimant.suspicion = clampScore(claimant.suspicion + credibility.suspicion);
    claimant.pressure.push(...credibility.reasons);
  }
}

function chooseUnchallengedPowerClaim(
  view: AgentView,
  claims: ClaimBoardItem[],
  checksAgainst: SeatRead["publicChecksAgainst"],
): ClaimBoardItem | undefined {
  return claims.find((claim) => {
    if (!GOD_ROLES.includes(claim.claimedRole)) return false;
    const isCounterclaimed = view.publicSummary.tableMemory.counterclaims.some(
      (group) => group.claimedRole === claim.claimedRole && group.claimants.some((claimant) => claimant.seatId === claim.claimant.seatId),
    );
    const hasPublicBlackCheck = checksAgainst.some((check) => check.result === "WEREWOLF");
    return !isCounterclaimed && !hasPublicBlackCheck;
  });
}

function isUnansweredDayOneSeerBlackCheck(
  view: AgentView,
  targetMemory: { seatId: number; lastSpeechSeq?: number } | undefined,
  checkerSeatId: number,
): boolean {
  if (view.day !== 1 || !targetMemory?.lastSpeechSeq) return false;
  const checkerClaim = view.publicSummary.tableMemory.claimBoard.find(
    (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId === checkerSeatId,
  );
  const claimSeq = checkerClaim?.sourceSpeechSeq;
  return claimSeq !== undefined && targetMemory.lastSpeechSeq < claimSeq;
}

function scorePublicSeerClaim(
  view: AgentView,
  seats: SeatRead[],
  claim: ClaimBoardItem,
  isCounterclaim: boolean,
): { trust: number; suspicion: number; reasons: string[] } {
  let trust = claim.strength === "hard" ? 2 : 0;
  let suspicion = isCounterclaim ? 4 : 0;
  const reasons: string[] = [];

  if (claim.checks.length === 0) {
    return {
      trust,
      suspicion: suspicion + (claim.strength === "hard" ? 5 : 2),
      reasons: ["预言家声明缺少验人"],
    };
  }

  for (const check of claim.checks.slice(-2)) {
    const target = seats.find((seat) => seat.seatId === check.target.seatId);
    if (!target) continue;

    const targetPressure = target.suspicion - target.trust;
    if (check.result === "WEREWOLF") {
      const unchallengedPowerClaim = findUnchallengedNonSeerPowerClaim(view.publicSummary.tableMemory, target);
      if (
        unchallengedPowerClaim &&
        isCounterclaim &&
        !hasDeadSeerLegacyBlackCheckAgainst(view.publicSummary.tableMemory, target.seatId)
      ) {
        suspicion += view.day <= 2 ? 18 : 10;
        trust -= view.day <= 2 ? 4 : 2;
        reasons.push(`查杀打到未对跳${unchallengedPowerClaim.claimedRoleLabel}`);
        continue;
      }

      if (targetPressure >= 18) {
        trust += 8;
        reasons.push("查杀落在公开高疑点位");
      } else if (targetPressure <= -10) {
        suspicion += 10;
        reasons.push("查杀打到公开高可信位");
      } else {
        trust += 2;
        if (isCounterclaim) suspicion += 2;
      }
      if (target.publicClaims.some((item) => item.claimedRole === "SEER")) {
        if (isReactiveSeerBlackCheck(view.publicSummary.tableMemory, claim.claimant.seatId, target.seatId)) {
          suspicion += 16;
          trust -= 4;
          reasons.push("后置查杀已跳预言家");
        } else if (targetPressure >= 18) {
          trust += 3;
        } else {
          suspicion += isCounterclaim ? 10 : 4;
        }
        reasons.push("查杀卷入预言家对跳");
      }
    } else {
      if (targetPressure >= 18) {
        suspicion += 7;
        reasons.push("金水保到公开焦点位");
      } else if (target.trust - target.suspicion >= 12) {
        trust += 5;
        reasons.push("金水和公开好感一致");
      } else {
        trust += 1;
      }
    }
  }

  const recentVote = view.publicSummary.recentVotes.find((vote) => vote.voter.seatId === claim.claimant.seatId);
  const recentVoteTarget = recentVote?.target;
  const blackChecks = claim.checks.filter((check) => check.result === "WEREWOLF");
  if (recentVoteTarget && blackChecks.length > 0) {
    if (blackChecks.some((check) => check.target.seatId === recentVoteTarget.seatId)) {
      trust += 4;
      reasons.push("票型跟自己的查杀一致");
    } else {
      suspicion += 4;
      reasons.push("票型没有跟自己的查杀走");
    }
  }

  return {
    trust,
    suspicion,
    reasons: [...new Set(reasons)].slice(0, 3),
  };
}

export function createVotePlan(view: AgentView, tableRead = buildAiTableRead(view)): VotePlan {
  const voteAction = view.allowedActions.find((action) => action.type === "vote");
  const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
  const legalTargetIds = new Set(legalTargets.map((target) => target.seatId));
  const candidates = tableRead.seats.filter((seat) => legalTargetIds.has(seat.seatId));
  const candidatePool = !isWolfRole(view.myRole, view.rules.wolfRoles)
    ? withoutProtectedGoodVoteTargets(view, tableRead, candidates)
    : withoutWeakProtectedGoldTargetsForWolf(view, tableRead, candidates);
  const hasVoteTarget = candidatePool.length > 0;
  const safeReferenceTarget =
    candidates.find((seat) => isProtectedGoodVoteTarget(view, tableRead, seat)) ?? candidates[0];
  const knownWolf = candidates.find((seat) => seat.isKnownWolf);
  const sorted = rankVoteCandidates(view, tableRead, candidatePool);
  const wolfVoteChoice = chooseWolfVoteChoice(view, tableRead, candidatePool, sorted);
  const claimTarget = chooseClaimAwareVoteTarget(view, tableRead, candidatePool);
  const publicPicked = knownWolf ?? claimTarget ?? chooseSoftDivergentVoteTarget(view, tableRead, sorted);
  const picked = isWolfRole(view.myRole, view.rules.wolfRoles) ? wolfVoteChoice?.target ?? sorted[0] : publicPicked;

  if (!picked) {
    if (!safeReferenceTarget) {
      throw new Error("没有可投票目标。");
    }

    if (!hasVoteTarget && voteAction?.canAbstain) {
      return {
        target: { seatId: safeReferenceTarget.seatId, name: safeReferenceTarget.name },
        abstain: true,
        reason: buildNoSafeVoteReason(view, tableRead, safeReferenceTarget),
        confidence: 0.2,
        alternatives: [],
      };
    }
    return {
      target: { seatId: safeReferenceTarget.seatId, name: safeReferenceTarget.name },
      reason: buildNoSafeVoteReason(view, tableRead, safeReferenceTarget),
      confidence: Math.max(0.3, Math.min(0.75, safeReferenceTarget.suspicion / 100)),
      alternatives: candidates
        .filter((seat) => seat.seatId !== safeReferenceTarget.seatId)
        .slice(0, 2)
        .map((seat) => ({ seatId: seat.seatId, name: seat.name })),
    };
  }

  const topPublicTarget = sorted[0];
  const divergentSoftTarget = Boolean(
    picked &&
      topPublicTarget &&
      !knownWolf &&
      !claimTarget &&
      isSoftSplitVote(view, tableRead, picked, sorted),
  );

  return {
    target: { seatId: picked.seatId, name: picked.name },
    reason: divergentSoftTarget ? buildSoftDivergentVoteReason(view, tableRead, picked, topPublicTarget) : buildVoteReason(view, tableRead, picked),
    confidence: picked.isKnownWolf
      ? 0.95
      : Math.max(0.32, Math.min(divergentSoftTarget ? 0.66 : 0.86, picked.suspicion / 100 - (divergentSoftTarget ? 0.08 : 0))),
    alternatives: sorted
      .filter((seat) => seat.seatId !== picked.seatId)
      .slice(0, 2)
      .map((seat) => ({ seatId: seat.seatId, name: seat.name })),
    wolfVoteTactic: isWolfRole(view.myRole, view.rules.wolfRoles) ? wolfVoteChoice?.tactic : undefined,
  };
}

function withoutProtectedGoodVoteTargets(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead[] {
  return candidates.filter((seat) => !isProtectedGoodVoteTarget(view, tableRead, seat));
}

function chooseSoftDivergentVoteTarget(view: AgentView, tableRead: AiTableRead, sorted: SeatRead[]): SeatRead | undefined {
  const top = sorted[0];
  const alternative = sorted[1];
  if (!top || !alternative) return top;
  if (hasHardPublicVoteAnchor(tableRead, top) || top.isKnownWolf) return top;

  const topScore = voteScore(view, tableRead, top);
  const alternativeScore = voteScore(view, tableRead, alternative);
  const closeEnough = topScore - alternativeScore <= 14 || top.suspicion - alternative.suspicion <= 10;
  if (!closeEnough) return top;

  const preferences = personaPreferences(view);
  const shouldSplit = view.mySeatId % 2 === 0 || preferences.caution >= 0.68 || preferences.memory >= 0.78;
  if (!shouldSplit) return top;

  const closeCandidates = sorted
    .filter((seat) => top.suspicion - seat.suspicion <= 10 && Math.abs(voteScore(view, tableRead, top) - voteScore(view, tableRead, seat)) <= 18)
    .slice(0, 3)
    .sort((a, b) => a.seatId - b.seatId);
  if (closeCandidates.length < 2) return alternative;
  return closeCandidates[(view.mySeatId - 1) % closeCandidates.length] ?? alternative;
}

function isSoftSplitVote(view: AgentView, tableRead: AiTableRead, picked: SeatRead, sorted: SeatRead[]): boolean {
  const top = sorted[0];
  if (!top || hasHardPublicVoteAnchor(tableRead, top) || top.isKnownWolf) return false;
  const preferences = personaPreferences(view);
  const splitSeat = view.mySeatId % 2 === 0 || preferences.caution >= 0.68 || preferences.memory >= 0.78;
  if (!splitSeat) return false;
  return sorted
    .slice(0, 3)
    .some((seat) => seat.seatId === picked.seatId && top.suspicion - seat.suspicion <= 10 && Math.abs(voteScore(view, tableRead, top) - voteScore(view, tableRead, seat)) <= 18);
}

function buildSoftDivergentVoteReason(
  view: AgentView,
  tableRead: AiTableRead,
  target: SeatRead,
  mainTarget: SeatRead,
): string {
  const pressure = target.pressure.find((item) => !/私密|真实身份|WEREWOLF/i.test(item));
  const mainText = `${mainTarget.name}是主焦点`;
  const targetText = pressure ? `${target.name}${pressure}` : `${target.name}也有公开发言缺口`;
  const personaLine =
    (view.persona?.preferences?.caution ?? 0) >= 0.68
      ? "我这票按谨慎分歧处理"
      : "我这票按弱证据替代线处理";
  return `${mainText}，但证据还没硬到全桌同票；${targetText}，${personaLine}。`;
}

function withoutWeakProtectedGoldTargetsForWolf(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead[] {
  const filtered = candidates.filter(
    (seat) => !isProtectedPublicGoldVoteTarget(tableRead, seat) || hasHardWolfCounterEvidenceAgainstProtectedGold(view, tableRead, seat),
  );
  return filtered.length > 0 ? filtered : candidates;
}

function buildNoSafeVoteReason(view: AgentView, tableRead: AiTableRead, target: SeatRead): string {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    return "公开票型没有合适切口，先按狼队节奏留票。";
  }

  const deadSeerGold = findDeadSeerLegacyGoldCheckFor(tableRead, target);
  if (deadSeerGold) {
    return `${target.name} 是${deadSeerGold.claimant.name}夜死后留下的公开金水，今天先不把票压过去。`;
  }

  if (isProtectedGoodVoteTarget(view, tableRead, target)) {
    return `${target.name} 是被保护的公开金水/身份位，今天先不把票压过去。`;
  }

  return "今天没有足够安全的归票点，先保留票型。";
}

function buildVoteReason(view: AgentView, tableRead: AiTableRead, target: SeatRead): string {
  if (target.isKnownWolf && view.myRole === "SEER") {
    return "我的查验指向这里，今天优先归票。";
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
    if (target.isWolfTeammate) {
      const publicClaim = target.publicClaims[0];
      if (publicClaim) {
        return `${target.name}的${publicClaim.claimedRoleLabel}线我不完全认，先用一票压出解释。`;
      }
      const publicPressure = target.pressure.find((item) => !/队友|狼队|私密|真实身份|WEREWOLF/i.test(item));
      return publicPressure
        ? `${publicPressure}，这票按公开疑点压一下。`
        : `${target.name}这轮发言留白较多，先压一票看反应。`;
    }
    if (assignment?.target?.seatId === target.seatId) {
      return `${target.name}是今天适合集中处理的公开焦点，按这条线归票。`;
    }
    return target.pressure[0] ? `${target.pressure[0]}，这个位置适合先压一票。` : "这个位置发言留白较多，先压票看反应。";
  }

  const memory = view.privateKnowledge.aiMemory;
  if (memory?.lastVoteTargetSeatId === target.seatId) {
    return `上一轮我票过${target.name}，疑点还没有解除，这一轮继续压这里。`;
  }

  if (memory?.lastSpeechTargetSeatId === target.seatId) {
    return `我上一轮发言已经点过${target.name}，这一轮投票先保持一致。`;
  }

  const deadSeerCounterclaim = findDeadSeerCounterclaimAgainst(tableRead, target);
  if (deadSeerCounterclaim) {
    return `${deadSeerCounterclaim.claimant.name}夜死后，${target.name}还在对跳预言家位，这轮先验这个悍跳风险。`;
  }

  const deadSeerBlackCheck = findDeadSeerLegacyBlackCheckAgainst(tableRead, target);
  if (deadSeerBlackCheck) {
    return `${deadSeerBlackCheck.claimant.name}夜死后遗留这里查杀，今天先按死预验人线归票。`;
  }

  const deadSeerGoldCheck = findDeadSeerLegacyGoldCheckFor(tableRead, target);
  if (deadSeerGoldCheck && hasHardOverrideAgainstDeadSeerGold(tableRead, target)) {
    return `${deadSeerGoldCheck.claimant.name}的夜死金水已经被多重公开反证打穿，今天可以按硬证据归票${target.name}。`;
  }

  const trustedSeerCheck = findTrustedSeerCheckAgainst(tableRead, target);
  if (trustedSeerCheck) {
    return `${trustedSeerCheck.claimant.name}报过这里查杀，今天先按可信预言家线归票。`;
  }

  const latestTie = findLatestTieVote(tableRead);
  if (latestTie?.tiedSeatIds.includes(target.seatId)) {
    return `上一轮平票里${target.name}已经是最高票焦点，这轮先收束票型继续检验。`;
  }

  const reasoningCue = targetReasoningCues(tableRead, target)[0];
  if (reasoningCue) {
    const cueEvidence = reasoningCue.evidence[0] ? `，依据是${clipVoteReason(reasoningCue.evidence[0], 34)}` : "";
    return `公开推理线索指向${target.name}：${clipVoteReason(reasoningCue.summary, 42)}${cueEvidence}，这票先检验这条证据链。`;
  }

  const latestNegativeStance = [...target.publicStancedBy]
    .reverse()
    .find((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE");
  if (latestNegativeStance) {
    return `${latestNegativeStance.actor.name}${latestNegativeStance.kindLabel}过这里，投票先检验这条站边。`;
  }

  const stanceShift = view.publicSummary.tableMemory.stanceShifts.find((shift) => shift.actor.seatId === target.seatId);
  if (stanceShift) {
    return `${target.name}有站边变化：${stanceShift.fromKindLabel}到${stanceShift.toKindLabel}，先按前后变化投票。`;
  }

  if (target.pressure.length > 0) {
    return `${target.pressure[0]}，投票先按公开疑点走。`;
  }

  return "发言和票型都不够扎实，先投这里观察归票。";
}

function chooseWolfVoteChoice(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
  sorted: SeatRead[],
): WolfVoteChoice | undefined {
  if (!isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
  const nonTeammates = candidates.filter((seat) => !seat.isWolfTeammate);
  const teammateCandidates = candidates.filter((seat) => seat.isWolfTeammate);
  const assignedTarget = assignment?.target ? candidates.find((seat) => seat.seatId === assignment.target?.seatId) : undefined;

  const distanceTarget = chooseWolfDistanceVoteTarget(view, teammateCandidates);
  if (distanceTarget) {
    return { target: distanceTarget, tactic: "planned_distance" };
  }

  const emergencyCut = sorted.find((seat) => seat.isWolfTeammate && hasHardPublicTeammateVoteEvidence(view, seat));
  if (emergencyCut && sorted[0]?.seatId === emergencyCut.seatId) {
    return { target: emergencyCut, tactic: "emergency_cut" };
  }

  if (assignment?.task === "PUSH_MISLYNCH" && assignedTarget && !assignedTarget.isWolfTeammate) {
    return { target: assignedTarget, tactic: "team_target" };
  }

  const claimTarget = chooseClaimAwareVoteTarget(view, tableRead, nonTeammates);
  if (assignment?.task === "COUNTERCLAIM_SEER" && claimTarget) {
    return { target: claimTarget, tactic: "team_target" };
  }

  const rankedNonTeammate = sorted.find((seat) => !seat.isWolfTeammate);
  if (rankedNonTeammate) {
    const avoidedTeammate = teammateCandidates.length > 0 && (assignment?.task === "HIDE" || sorted[0]?.isWolfTeammate);
    return {
      target: rankedNonTeammate,
      tactic: avoidedTeammate ? "avoid_teammate" : "team_target",
    };
  }

  const fallbackEmergencyCut = teammateCandidates.find((seat) => hasHardPublicTeammateVoteEvidence(view, seat));
  if (fallbackEmergencyCut) {
    return { target: fallbackEmergencyCut, tactic: "emergency_cut" };
  }

  return undefined;
}

function chooseWolfDistanceVoteTarget(view: AgentView, teammateCandidates: SeatRead[]): SeatRead | undefined {
  if (!isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;
  if (teammateCandidates.length === 0) return undefined;

  const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
  const supportSeatId = assignment?.supportSeat?.seatId;
  const supportSeat = supportSeatId
    ? teammateCandidates.find((seat) => seat.seatId === supportSeatId)
    : undefined;
  const publicIdentitySeat = teammateCandidates.find((seat) => seat.publicClaims.length > 0);
  const target = supportSeat ?? publicIdentitySeat ?? teammateCandidates[0];
  if (!target) return undefined;
  if (assignment?.task !== "DISTANCE" || !supportSeat || supportSeat.seatId !== target.seatId) return undefined;
  if (!hasHardPublicTeammateVoteEvidence(view, target)) return undefined;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const bluffing = view.persona?.bluffing ?? 0.45;
  const negativeActors = publicVotePressureActors(target).length;
  const publicBlackChecks = target.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;

  if (personaRisk >= 0.9 && bluffing >= 0.85) {
    return target;
  }

  const threshold = clampProbability(
    0.12 +
      personaRisk * 0.12 +
      bluffing * 0.12 +
      Math.min(0.12, negativeActors * 0.04 + publicBlackChecks * 0.05) +
      (view.day >= 2 ? 0.06 : 0),
  );
  const roll = stableRoll([
    "wolf-distance-vote",
    view.day,
    view.mySeatId,
    view.persona?.id,
    target.seatId,
    view.publicSummary.recentSpeeches.at(-1)?.seq,
  ]);

  return roll < threshold ? target : undefined;
}

function hasHardPublicTeammateVoteEvidence(view: AgentView, target: SeatRead): boolean {
  const negativeActors = publicVotePressureActors(target).length;
  const publicBlackChecks = target.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;
  const pressureGap = target.suspicion - target.trust;
  const inCounterclaim = view.publicSummary.tableMemory.counterclaims.some((group) =>
    group.claimants.some((claimant) => claimant.seatId === target.seatId),
  );
  const hasDeadSeerBlack = hasDeadSeerLegacyBlackCheckAgainst(view.publicSummary.tableMemory, target.seatId);
  const hardCue = view.publicSummary.tableMemory.reasoningCues.some(
    (cue) =>
      cue.target?.seatId === target.seatId &&
      (cue.weight === "strong" || (cue.weight === "medium" && (cue.kind === "counterclaim" || cue.kind === "seer_legacy"))),
  );
  const isVoteLeader =
    view.publicSummary.voteSnapshot.leaders.some((leader) => leader.seatId === target.seatId) || target.votesReceived >= 2;

  if (hasDeadSeerBlack || publicBlackChecks >= 2) return true;
  if (publicBlackChecks >= 1 && inCounterclaim) return true;
  if (publicBlackChecks >= 1 && (negativeActors >= 2 || pressureGap >= 48 || hardCue)) return true;
  if (inCounterclaim && negativeActors >= 2 && (pressureGap >= 30 || hardCue)) return true;
  if (view.day >= 2 && negativeActors >= 3 && pressureGap >= 28) return true;
  if (isVoteLeader && (negativeActors >= 2 || publicBlackChecks >= 1 || inCounterclaim)) return true;

  return false;
}

function chooseClaimAwareVoteTarget(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead | undefined {
  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const seerCounterclaim = view.publicSummary.tableMemory.counterclaims.find((group) => group.claimedRole === "SEER");

  if (view.myRole === "SEER" && seerCounterclaim) {
    const counterclaim = seerCounterclaim.claimants.find((claimant) => claimant.seatId !== view.mySeatId && candidateIds.has(claimant.seatId));
    if (counterclaim) return candidates.find((seat) => seat.seatId === counterclaim.seatId);
  }

  const deadSeerCounterclaimTarget = chooseDeadSeerCounterclaimTarget(view, tableRead, candidates);
  if (deadSeerCounterclaimTarget) return deadSeerCounterclaimTarget;

  const deadSeerLegacyTarget = chooseDeadSeerLegacyBlackCheckTarget(view, tableRead, candidates);
  if (deadSeerLegacyTarget) return deadSeerLegacyTarget;

  const challengedClaimant = chooseCounterclaimPressureTarget(view, tableRead, candidates);
  if (challengedClaimant) return challengedClaimant;

  const trustedCheckTarget = findTrustedSeerCheckTarget(tableRead, candidates);
  if (trustedCheckTarget) return trustedCheckTarget;

  const trustedGoldFollowTarget = chooseTrustedGoldWaterFollowTarget(view, tableRead, candidates);
  if (trustedGoldFollowTarget) return trustedGoldFollowTarget;

  const tiedTarget = chooseTieConsolidationTarget(view, tableRead, candidates);
  if (tiedTarget) return tiedTarget;

  const evidenceLoopTarget = choosePublicEvidenceLoopVoteTarget(view, tableRead, candidates);
  if (evidenceLoopTarget) return evidenceLoopTarget;

  const shifted = view.publicSummary.tableMemory.stanceShifts
    .map((shift) => candidates.find((seat) => seat.seatId === shift.actor.seatId))
    .find((seat): seat is SeatRead => Boolean(seat));
  if (shifted && shifted.suspicion >= 56) return shifted;

  return choosePublicFocusVoteTarget(view, tableRead, candidates);
}

function findTrustedSeerCheckTarget(tableRead: AiTableRead, candidates: SeatRead[]): SeatRead | undefined {
  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const seerClaims = tableRead.seats
    .filter((seat) => seat.publicClaims.some((claim) => claim.claimedRole === "SEER"))
    .sort((a, b) => b.trust - b.suspicion - (a.trust - a.suspicion));

  for (const seer of seerClaims) {
    const claim = seer.publicClaims.find((item) => item.claimedRole === "SEER");
    const wolfCheck = claim?.checks.find((check) => check.result === "WEREWOLF" && candidateIds.has(check.target.seatId));
    if (wolfCheck && shouldTrustPublicSeerCheck(tableRead, seer, wolfCheck.target.seatId, true)) {
      return candidates.find((seat) => seat.seatId === wolfCheck.target.seatId);
    }
  }

  return undefined;
}

function chooseTrustedGoldWaterFollowTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const trustedGold = findTrustedGoldSeerForSeat(tableRead, view.mySeatId);
  if (!trustedGold) return undefined;

  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const blackCheck = trustedGold.claim.checks.find(
    (check) =>
      check.result === "WEREWOLF" &&
      candidateIds.has(check.target.seatId) &&
      shouldTrustPublicSeerCheck(tableRead, trustedGold.seer, check.target.seatId, true),
  );
  if (blackCheck) return candidates.find((seat) => seat.seatId === blackCheck.target.seatId);

  const latestSeerPressure = [...trustedGold.seer.publicStancesGiven]
    .reverse()
    .find((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE");
  const pressureTarget = latestSeerPressure
    ? candidates.find((seat) => seat.seatId === latestSeerPressure.target.seatId)
    : undefined;
  if (pressureTarget && !isProtectedGoodVoteTarget(view, tableRead, pressureTarget) && pressureTarget.suspicion >= 48) {
    return pressureTarget;
  }

  const focusTarget = choosePublicFocusVoteTarget(view, tableRead, candidates);
  return focusTarget && focusTarget.suspicion >= (view.day >= 3 ? 48 : 54) ? focusTarget : undefined;
}

function choosePublicEvidenceLoopVoteTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const ranked = candidates
    .filter((seat) => !isProtectedGoodVoteTarget(view, tableRead, seat))
    .map((seat) => ({
      seat,
      score: publicEvidenceLoopVoteScore(view, tableRead, seat),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        voteScore(view, tableRead, b.seat) - voteScore(view, tableRead, a.seat) ||
        a.seat.seatId - b.seat.seatId,
    );
  const top = ranked[0];
  if (!top) return undefined;

  const runnerScore = ranked[1]?.score ?? Number.NEGATIVE_INFINITY;
  const pressureGap = top.seat.suspicion - top.seat.trust;
  const threshold = view.day <= 1 ? 38 : 32;
  const hasHardAnchor = hasHardPublicVoteAnchor(tableRead, top.seat);
  const clearLead = top.score >= runnerScore + 8;

  return top.score >= threshold && (clearLead || hasHardAnchor || pressureGap >= 22) ? top.seat : undefined;
}

function choosePublicFocusVoteTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const focusItems = view.publicSummary.tableMemory.focus
    .map((focus, index) => ({
      index,
      score: focus.score,
      seat: candidates.find((seat) => seat.seatId === focus.seat.seatId),
    }))
    .filter((item): item is { index: number; score: number; seat: SeatRead } => Boolean(item.seat))
    .filter((item) => !isProtectedGoodVoteTarget(view, tableRead, item.seat));
  const topFocus = focusItems[0];
  if (!topFocus) return undefined;

  const negativeActors = new Set(
    topFocus.seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );
  const strongCue = tableRead.tableMemory.reasoningCues.some(
    (cue) => cue.target?.seatId === topFocus.seat.seatId && cue.weight === "strong",
  );

  if (topFocus.seat.suspicion >= 52 || topFocus.score >= 24 || negativeActors.size >= 2 || strongCue) {
    return topFocus.seat;
  }

  return undefined;
}

function chooseTieConsolidationTarget(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const latestTie = findLatestTieVote(tableRead);
  if (!latestTie) return undefined;

  const tiedSeatIds = new Set(latestTie.tiedSeatIds);
  const tiedCandidates = candidates.filter(
    (seat) => tiedSeatIds.has(seat.seatId) && !isProtectedGoodVoteTarget(view, tableRead, seat),
  );
  if (tiedCandidates.length === 0) return undefined;

  return rankVoteCandidates(view, tableRead, tiedCandidates).find((seat) =>
    hasEnoughTieConsolidationEvidence(view, tableRead, seat, latestTie),
  );
}

function hasEnoughTieConsolidationEvidence(
  view: AgentView,
  tableRead: AiTableRead,
  seat: SeatRead,
  latestTie: AiTableRead["tableMemory"]["voteHistory"][number],
): boolean {
  if (findTrustedSeerCheckAgainst(tableRead, seat)) return true;

  const pressureGap = seat.suspicion - seat.trust;
  const negativeActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );
  const tiedVoteCount = latestTie.tally.find((item) => item.target.seatId === seat.seatId)?.count ?? 0;
  const isLeader = latestTie.leaders.some((leader) => leader.seatId === seat.seatId);
  const hasStrongCue = tableRead.tableMemory.reasoningCues.some(
    (cue) => cue.target?.seatId === seat.seatId && cue.weight === "strong",
  );
  const hasCounterclaimPressure = seat.publicClaims.some((claim) => claim.claimedRole === "SEER")
    ? view.publicSummary.tableMemory.counterclaims.some(
        (group) => group.claimedRole === "SEER" && group.claimants.some((claimant) => claimant.seatId === seat.seatId),
      )
    : false;
  const evidenceScore =
    goodPublicVoteEvidenceScore(view, tableRead, seat) +
    (isLeader ? 8 : 0) +
    Math.min(8, tiedVoteCount * 2) +
    Math.max(0, Math.min(12, pressureGap / 2)) +
    Math.min(10, negativeActors.size * 4) +
    (hasStrongCue ? 8 : 0) +
    (hasCounterclaimPressure ? 6 : 0);

  return evidenceScore >= (view.day <= 2 ? 26 : 22);
}

function rankVoteCandidates(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead[] {
  return [...candidates].sort((a, b) => voteScore(view, tableRead, b) - voteScore(view, tableRead, a) || a.seatId - b.seatId);
}

function voteScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  if (seat.isKnownWolf) return 200;
  if (seat.isKnownGood || seat.isSelf || seat.isWolfTeammate) return -200;

  const preferences = personaPreferences(view);
  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const trustPenalty = isWolfRole(view.myRole, view.rules.wolfRoles) ? 0.1 : 0.14 + preferences.caution * 0.16;
  const pressureBonus = weighted(Math.min(10, seat.pressure.length * 2), Math.max(preferences.leadership, preferences.emotion));
  const voteJitter = stableSignedJitter(
    ["vote", view.day, view.phase, view.mySeatId, view.persona?.id, seat.seatId, view.publicSummary.recentSpeeches.at(-1)?.seq],
    isWolfRole(view.myRole, view.rules.wolfRoles) ? 6 + personaRisk * 6 : 3 + personaRisk * 3,
  );
  const memory = view.privateKnowledge.aiMemory;
  const memoryBonus =
    (memory?.lastSpeechTargetSeatId === seat.seatId ? 9 : 0) +
    (memory?.lastVoteTargetSeatId === seat.seatId ? 7 : 0) +
    (memory?.suspectedSeatId === seat.seatId ? 5 : 0) -
    (memory?.trustedSeatId === seat.seatId ? 8 : 0);
  const publicEvidenceBonus = isWolfRole(view.myRole, view.rules.wolfRoles) ? 0 : goodPublicVoteEvidenceScore(view, tableRead, seat);

  return (
    seat.suspicion -
    seat.trust * trustPenalty +
    pressureBonus +
    publicEvidenceBonus +
    weighted(memoryBonus, preferences.memory) +
    voteJitter
  );
}

function goodPublicVoteEvidenceScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  let score = 0;

  if (findTrustedSeerCheckAgainst(tableRead, seat)) {
    score += 28;
  }

  if (findTrustedSeerGoldCheckAgainst(tableRead, seat)) {
    score -= 75;
  }

  if (isProtectedDeadSeerLegacyGoldTarget(tableRead, seat)) {
    score -= 90;
  }

  for (const legacy of view.publicSummary.tableMemory.seerLegacies) {
    const legacyCheck = legacy.checks.find((check) => check.target.seatId === seat.seatId);
    if (legacyCheck?.result === "WEREWOLF") score += 30;
    if (legacyCheck?.result === "GOOD") score -= isProtectedDeadSeerGoldSeat(tableRead, seat) ? 32 : 6;
  }

  const protectedClaim = chooseUnchallengedPowerClaim(view, seat.publicClaims, seat.publicChecksAgainst);
  if (protectedClaim && !hasDeadSeerLegacyBlackCheckAgainst(view.publicSummary.tableMemory, seat.seatId)) {
    const whiteWolfKingCaution = view.rules.wolfRoles?.includes("WHITE_WOLF_KING") ? 1.4 : 1;
    const dayOneClaimCaution = view.day === 1 ? (protectedClaim.claimedRole === "SEER" ? 1.55 : 1.35) : 1;
    score -= (protectedClaim.claimedRole === "SEER" ? 34 : 26) * whiteWolfKingCaution * dayOneClaimCaution;
  }

  if (isUnchallengedPowerBlackCheckedOnlyByCounterclaim(tableRead, seat)) {
    score -= view.day <= 2 ? 34 : 22;
  }

  if (isDayOneSoftPowerHintProtectedTarget(tableRead, seat)) {
    score -= 30;
  }

  if (isUnansweredDayOneBlackCheckCandidate(tableRead, seat)) {
    score -= 22;
  }

  if (isTargetOfReactiveSeerBlackCheck(view.publicSummary.tableMemory, seat.seatId)) {
    score -= 28;
  }

  if (isReactiveSeerClaimant(view.publicSummary.tableMemory, seat.seatId)) {
    score += 18;
  }

  const negativeActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );
  score += Math.min(18, negativeActors.size * 5);
  score += publicReasoningCueVoteScore(tableRead, seat);
  score += publicFocusVoteEvidenceScore(tableRead, seat);

  if (view.publicSummary.tableMemory.stanceShifts.some((shift) => shift.actor.seatId === seat.seatId)) {
    score += 12;
  }

  if (seat.publicClaims.some((claim) => claim.claimedRole === "SEER")) {
    const inCounterclaim = view.publicSummary.tableMemory.counterclaims.some(
      (group) => group.claimedRole === "SEER" && group.claimants.some((claimant) => claimant.seatId === seat.seatId),
    );
    if (inCounterclaim) score += seerCounterclaimPressureScore(tableRead, seat);
  }

  return score;
}

function publicEvidenceLoopVoteScore(view: AgentView, tableRead: AiTableRead, seat: SeatRead): number {
  const focus = tableRead.tableMemory.focus.find((item) => item.seat.seatId === seat.seatId);
  const latestVote = tableRead.tableMemory.voteHistory.at(-1);
  const latestVoteCount = latestVote?.tally.find((item) => item.target.seatId === seat.seatId)?.count ?? 0;
  const pressureLoopScore = seat.pressure.reduce((score, item) => {
    if (/查验|对跳|身份|站边|票型|起票|补票|归票|死亡|夜死|悍跳|闭环|施压/.test(item)) return score + 5;
    if (/发言|过程|理由|解释/.test(item)) return score + 2;
    return score;
  }, 0);

  return (
    Math.max(0, goodPublicVoteEvidenceScore(view, tableRead, seat)) +
    Math.min(16, publicVotePressureActors(seat).length * 6) +
    (focus ? Math.min(14, focus.score / 5) : 0) +
    Math.min(8, latestVoteCount * 2) +
    pressureLoopScore +
    (tableRead.tableMemory.stanceShifts.some((shift) => shift.actor.seatId === seat.seatId) ? 10 : 0) -
    softOnlyVoteNoisePenalty(tableRead, seat)
  );
}

function publicReasoningCueVoteScore(tableRead: AiTableRead, seat: SeatRead): number {
  return Math.min(
    34,
    targetReasoningCues(tableRead, seat).reduce((score, cue) => score + reasoningCueWeightScore(cue.weight), 0),
  );
}

function targetReasoningCues(
  tableRead: AiTableRead,
  seat: SeatRead,
): Array<AiTableRead["tableMemory"]["reasoningCues"][number]> {
  return tableRead.tableMemory.reasoningCues
    .filter((cue) => cue.target?.seatId === seat.seatId)
    .sort((a, b) => reasoningCueWeightScore(b.weight) - reasoningCueWeightScore(a.weight));
}

function reasoningCueWeightScore(weight: AiTableRead["tableMemory"]["reasoningCues"][number]["weight"]): number {
  if (weight === "strong") return 24;
  if (weight === "medium") return 14;
  return 6;
}

function clipVoteReason(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function publicVotePressureActors(seat: SeatRead): ActionTarget[] {
  const actors = new Map<number, ActionTarget>();
  for (const stance of seat.publicStancedBy) {
    if (stance.kind === "QUESTION" || stance.kind === "PRESSURE") {
      actors.set(stance.actor.seatId, stance.actor);
    }
  }
  return [...actors.values()];
}

function hasHardPublicVoteAnchor(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (publicReasoningCueVoteScore(tableRead, seat) >= 20) return true;
  if (seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF")) return true;
  if (tableRead.tableMemory.seerLegacies.some((legacy) => legacy.checks.some((check) => check.target.seatId === seat.seatId))) {
    return true;
  }
  if (tableRead.tableMemory.stanceShifts.some((shift) => shift.actor.seatId === seat.seatId)) return true;
  return publicVotePressureActors(seat).length >= 2;
}

function softOnlyVoteNoisePenalty(tableRead: AiTableRead, seat: SeatRead): number {
  const cues = targetReasoningCues(tableRead, seat);
  if (cues.length > 0 || seat.publicClaims.length > 0 || seat.publicChecksAgainst.length > 0) return 0;
  if (publicVotePressureActors(seat).length >= 2) return 0;

  const pressureText = seat.pressure.join(" ");
  const hasSoftNoise = /发言偏短|短发言|信息量少|留白|边角|语气|听感|划水/.test(pressureText);
  const hasLoop = /查验|对跳|身份|站边|票型|起票|补票|死亡|夜死|悍跳|闭环|施压/.test(pressureText);
  return hasSoftNoise && !hasLoop ? 18 : 0;
}

function publicFocusVoteEvidenceScore(tableRead: AiTableRead, seat: SeatRead): number {
  const focusIndex = tableRead.tableMemory.focus.findIndex((focus) => focus.seat.seatId === seat.seatId);
  if (focusIndex < 0) return 0;

  const focusScore = tableRead.tableMemory.focus[focusIndex]?.score ?? 0;
  const rankBonus = focusIndex === 0 ? 12 : focusIndex === 1 ? 7 : 3;
  const scoreBonus = Math.min(10, Math.max(0, focusScore - 18) / 4);
  const cueBonus = tableRead.tableMemory.reasoningCues.reduce((total, cue) => {
    if (cue.target?.seatId !== seat.seatId) return total;
    if (cue.weight === "strong") return total + 7;
    if (cue.weight === "medium") return total + 4;
    return total + 2;
  }, 0);

  return Math.min(24, rankBonus + scoreBonus + cueBonus);
}

function seerCounterclaimPressureScore(tableRead: AiTableRead, seat: SeatRead): number {
  let score = 0;
  if (findDeadSeerCounterclaimAgainst(tableRead, seat)) {
    score += 34;
  }
  return score + Math.max(0, seerCounterclaimCheckStructureScore(tableRead, seat));
}

function seerCounterclaimCheckStructureScore(tableRead: AiTableRead, seat: SeatRead): number {
  const claim = seat.publicClaims.find((item) => item.claimedRole === "SEER");
  if (!claim || claim.checks.length === 0) return 6;

  const powerBlackChecks = claim.checks.filter((check) => {
    if (check.result !== "WEREWOLF") return false;
    const target = tableRead.seats.find((candidate) => candidate.seatId === check.target.seatId);
    return Boolean(target && findUnchallengedNonSeerPowerClaim(tableRead.tableMemory, target));
  }).length;
  if (powerBlackChecks > 0) return 20 + powerBlackChecks * 6;

  if (claim.checks.some((check) => check.result === "GOOD")) return -10;
  if (claim.checks.every((check) => check.result === "WEREWOLF")) return 10;
  return 6;
}

function isUnansweredDayOneBlackCheckCandidate(tableRead: AiTableRead, seat: SeatRead): boolean {
  return seat.publicChecksAgainst.some(
    (check) => check.result === "WEREWOLF" && isUnansweredDayOneSeerBlackCheckFromRead(tableRead, seat.seatId, check.claimant.seatId),
  );
}

function findLatestTieVote(tableRead: AiTableRead): AiTableRead["tableMemory"]["voteHistory"][number] | undefined {
  return [...tableRead.tableMemory.voteHistory].reverse().find((vote) => vote.tiedSeatIds.length > 0);
}

function chooseDeadSeerCounterclaimTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const rivals = tableRead.tableMemory.seerLegacies.flatMap((legacy) => {
    const group = tableRead.tableMemory.counterclaims.find(
      (item) =>
        item.claimedRole === "SEER" && item.claimants.some((claimant) => claimant.seatId === legacy.claimant.seatId),
    );
    return (
      group?.claimants
        .filter((claimant) => claimant.seatId !== legacy.claimant.seatId && candidateIds.has(claimant.seatId))
        .map((claimant) => tableRead.seats.find((seat) => seat.seatId === claimant.seatId))
        .filter((seat): seat is SeatRead => Boolean(seat)) ?? []
    );
  });

  if (rivals.length === 0) return undefined;

  return [...new Map(rivals.map((seat) => [seat.seatId, seat])).values()].sort(
    (a, b) =>
      seerCounterclaimPressureScore(tableRead, b) - seerCounterclaimPressureScore(tableRead, a) ||
      voteScore(view, tableRead, b) - voteScore(view, tableRead, a) ||
      a.seatId - b.seatId,
  )[0];
}

function chooseDeadSeerLegacyBlackCheckTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return undefined;

  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  for (const legacy of tableRead.tableMemory.seerLegacies) {
    const check = legacy.checks.find((item) => item.result === "WEREWOLF" && candidateIds.has(item.target.seatId));
    const target = check ? candidates.find((seat) => seat.seatId === check.target.seatId) : undefined;
    if (target && !target.isKnownGood) return target;
  }

  return undefined;
}

function chooseCounterclaimPressureTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (isWolfRole(view.myRole, view.rules.wolfRoles) || view.myRole === "SEER") return undefined;

  const seerCounterclaim = view.publicSummary.tableMemory.counterclaims.find((group) => group.claimedRole === "SEER");
  if (!seerCounterclaim) return undefined;

  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const claimants = seerCounterclaim.claimants
    .map((claimant) => tableRead.seats.find((seat) => seat.seatId === claimant.seatId && candidateIds.has(claimant.seatId)))
    .filter((seat): seat is SeatRead => Boolean(seat));
  const suspect = [...claimants].sort(
    (a, b) =>
      seerCounterclaimPressureScore(tableRead, b) - seerCounterclaimPressureScore(tableRead, a) ||
      voteScore(view, tableRead, b) - voteScore(view, tableRead, a) ||
      a.seatId - b.seatId,
  )[0];
  if (!suspect) return undefined;

  if (
    tableRead.day === 1 &&
    isTargetOfReactiveSeerBlackCheck(view.publicSummary.tableMemory, suspect.seatId) &&
    suspect.publicClaims.some((claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "GOOD"))
  ) {
    return undefined;
  }

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const challengePressure = suspect.suspicion - suspect.trust;
  const structuralPressure = seerCounterclaimPressureScore(tableRead, suspect);
  const threshold = 0.24 + personaRisk * 0.26 + Math.max(0, challengePressure) / 140;
  const roll = stableRoll(["counterclaim-vote", view.day, view.mySeatId, view.persona?.id, suspect.seatId]);

  return structuralPressure >= 20 || challengePressure >= 8 || roll < clampProbability(threshold) ? suspect : undefined;
}

function shouldTrustPublicSeerCheck(
  tableRead: AiTableRead,
  seer: SeatRead,
  targetSeatId: number,
  forVote = false,
): boolean {
  const inCounterclaim = tableRead.tableMemory.counterclaims.some(
    (group) => group.claimedRole === "SEER" && group.claimants.some((claimant) => claimant.seatId === seer.seatId),
  );
  const target = tableRead.seats.find((seat) => seat.seatId === targetSeatId);

  if (forVote && tableRead.day === 1 && isDayOneSeerGoldClaimProtectedFromBlackCheck(tableRead, seer, targetSeatId)) {
    return false;
  }

  if (forVote && target && isDayOneSoftPowerHintBlackCheckProtectedTarget(tableRead, target)) {
    return false;
  }

  if (forVote && tableRead.day === 1 && isUnansweredDayOneSeerBlackCheckFromRead(tableRead, targetSeatId, seer.seatId)) {
    const targetPressure = target ? target.suspicion - target.trust : 0;
    const negativeActors =
      target?.publicStancedBy.filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE").length ?? 0;
    return seer.trust - seer.suspicion >= 28 || targetPressure >= 34 || negativeActors >= 3;
  }

  if (isReactiveSeerBlackCheck(tableRead.tableMemory, seer.seatId, targetSeatId)) {
    if (
      forVote &&
      tableRead.day === 1 &&
      target?.publicClaims.some((claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "GOOD"))
    ) {
      return false;
    }
    return seer.trust - seer.suspicion >= (forVote ? 30 : 24);
  }

  if (!inCounterclaim) {
    return seer.trust >= seer.suspicion - (forVote ? 0 : 4);
  }

  return (
    seer.trust - seer.suspicion >= (forVote ? 18 : 14) ||
    Boolean(target && target.suspicion >= 76 && seer.trust >= seer.suspicion + (forVote ? 8 : 4))
  );
}

function isUnansweredDayOneSeerBlackCheckFromRead(
  tableRead: AiTableRead,
  targetSeatId: number,
  checkerSeatId: number,
): boolean {
  if (tableRead.day !== 1) return false;
  const target = tableRead.seats.find((seat) => seat.seatId === targetSeatId);
  const checkerClaim = tableRead.tableMemory.claimBoard.find(
    (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId === checkerSeatId,
  );
  const claimSeq = checkerClaim?.sourceSpeechSeq;
  return target?.lastSpeechSeq !== undefined && claimSeq !== undefined && target.lastSpeechSeq < claimSeq;
}

function isReactiveSeerBlackCheck(
  tableMemory: AiTableRead["tableMemory"],
  claimantSeatId: number,
  targetSeatId: number,
): boolean {
  const claim = tableMemory.claimBoard.find(
    (item) => item.claimedRole === "SEER" && item.claimant.seatId === claimantSeatId,
  );
  const targetClaim = tableMemory.claimBoard.find(
    (item) => item.claimedRole === "SEER" && item.claimant.seatId === targetSeatId,
  );
  if (!claim?.sourceSpeechSeq || !targetClaim?.sourceSpeechSeq) return false;
  return claim.sourceSpeechSeq > targetClaim.sourceSpeechSeq;
}

function isReactiveSeerClaimant(tableMemory: AiTableRead["tableMemory"], claimantSeatId: number): boolean {
  const claim = tableMemory.claimBoard.find(
    (item) => item.claimedRole === "SEER" && item.claimant.seatId === claimantSeatId,
  );
  return Boolean(
    claim?.checks.some(
      (check) =>
        check.result === "WEREWOLF" && isReactiveSeerBlackCheck(tableMemory, claimantSeatId, check.target.seatId),
    ),
  );
}

function isTargetOfReactiveSeerBlackCheck(tableMemory: AiTableRead["tableMemory"], targetSeatId: number): boolean {
  return tableMemory.claimBoard.some(
    (claim) =>
      claim.claimedRole === "SEER" &&
      claim.checks.some(
        (check) =>
          check.result === "WEREWOLF" &&
          check.target.seatId === targetSeatId &&
          isReactiveSeerBlackCheck(tableMemory, claim.claimant.seatId, targetSeatId),
      ),
  );
}

function findDeadSeerCounterclaimAgainst(
  tableRead: AiTableRead,
  target: SeatRead,
): AiTableRead["tableMemory"]["seerLegacies"][number] | undefined {
  if (!target.publicClaims.some((claim) => claim.claimedRole === "SEER")) return undefined;

  return tableRead.tableMemory.seerLegacies.find((legacy) =>
    tableRead.tableMemory.counterclaims.some(
      (group) =>
        group.claimedRole === "SEER" &&
        group.claimants.some((claimant) => claimant.seatId === legacy.claimant.seatId) &&
        group.claimants.some((claimant) => claimant.seatId === target.seatId),
    ),
  );
}

function findDeadSeerLegacyBlackCheckAgainst(
  tableRead: AiTableRead,
  target: SeatRead,
): AiTableRead["tableMemory"]["seerLegacies"][number] | undefined {
  return findDeadSeerBlackLegacyForSeat(tableRead.tableMemory, target.seatId);
}

function findDeadSeerLegacyGoldCheckFor(
  tableRead: AiTableRead,
  target: SeatRead,
): AiTableRead["tableMemory"]["seerLegacies"][number] | undefined {
  return findDeadSeerGoldLegacyForSeat(tableRead.tableMemory, target.seatId);
}

function isProtectedDeadSeerLegacyGoldTarget(tableRead: AiTableRead, target: SeatRead): boolean {
  return isProtectedDeadSeerGoldSeat(tableRead, target);
}

function hasDeadSeerLegacyBlackCheckAgainst(
  tableMemory: AiTableRead["tableMemory"],
  targetSeatId: number,
): boolean {
  return tableMemory.seerLegacies.some((legacy) =>
    legacy.checks.some((check) => check.target.seatId === targetSeatId && check.result === "WEREWOLF"),
  );
}

function findUnchallengedNonSeerPowerClaim(
  tableMemory: AiTableRead["tableMemory"],
  seat: SeatRead,
): ClaimBoardItem | undefined {
  return seat.publicClaims.find(
    (claim) =>
      NON_SEER_POWER_ROLES.has(claim.claimedRole) &&
      !isRoleCounterclaimed(tableMemory, claim.claimant.seatId, claim.claimedRole),
  );
}

function isUnchallengedPowerBlackCheckedOnlyByCounterclaim(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (!findUnchallengedNonSeerPowerClaim(tableRead.tableMemory, seat)) return false;
  if (hasDeadSeerLegacyBlackCheckAgainst(tableRead.tableMemory, seat.seatId)) return false;

  const wolfChecks = seat.publicChecksAgainst.filter((check) => check.result === "WEREWOLF");
  if (wolfChecks.length === 0) return false;

  return wolfChecks.every((check) => isRoleCounterclaimed(tableRead.tableMemory, check.claimant.seatId, "SEER"));
}

function isRoleCounterclaimed(tableMemory: AiTableRead["tableMemory"], seatId: number, role: Role): boolean {
  return tableMemory.counterclaims.some(
    (group) => group.claimedRole === role && group.claimants.some((claimant) => claimant.seatId === seatId),
  );
}

function findTrustedSeerCheckAgainst(tableRead: AiTableRead, target: SeatRead): { claimant: ActionTarget } | undefined {
  const seerClaims = tableRead.tableMemory.claimBoard.filter((claim) => claim.claimedRole === "SEER");
  const claim = seerClaims.find((item) =>
    item.checks.some((check) => {
      const claimantRead = tableRead.seats.find((seat) => seat.seatId === item.claimant.seatId);
      return (
        claimantRead &&
        check.target.seatId === target.seatId &&
        check.result === "WEREWOLF" &&
        shouldTrustPublicSeerCheck(tableRead, claimantRead, target.seatId, true)
      );
    }),
  );
  return claim ? { claimant: claim.claimant } : undefined;
}

function findTrustedSeerGoldCheckAgainst(tableRead: AiTableRead, target: SeatRead): { claimant: ActionTarget } | undefined {
  const trustedGold = findTrustedGoldSeerForSeat(tableRead, target.seatId);
  return trustedGold ? { claimant: trustedGold.claim.claimant } : undefined;
}

function findTrustedGoldSeerForSeat(
  tableRead: AiTableRead,
  targetSeatId: number,
): { seer: SeatRead; claim: ClaimBoardItem } | undefined {
  for (const claim of tableRead.tableMemory.claimBoard) {
    if (claim.claimedRole !== "SEER") continue;
    if (!claim.checks.some((check) => check.target.seatId === targetSeatId && check.result === "GOOD")) continue;

    const seer = tableRead.seats.find((seat) => seat.seatId === claim.claimant.seatId);
    if (seer && shouldTrustPublicSeerGoldCheck(tableRead, seer, targetSeatId)) {
      return { seer, claim };
    }
  }

  return undefined;
}

function shouldTrustPublicSeerGoldCheck(tableRead: AiTableRead, seer: SeatRead, targetSeatId: number): boolean {
  const inCounterclaim = tableRead.tableMemory.counterclaims.some(
    (group) => group.claimedRole === "SEER" && group.claimants.some((claimant) => claimant.seatId === seer.seatId),
  );
  const target = tableRead.seats.find((seat) => seat.seatId === targetSeatId);

  if (!inCounterclaim) {
    const targetHasBlackCheck = target?.publicChecksAgainst.some((check) => check.result === "WEREWOLF") ?? false;
    return !targetHasBlackCheck || seer.trust >= seer.suspicion + 8 || Boolean(target && target.trust >= target.suspicion + 10);
  }

  return seer.trust - seer.suspicion >= 20 && Boolean(target && target.trust >= target.suspicion);
}

export function isProtectedSeerGoldTarget(tableRead: AiTableRead, seat: SeatRead): boolean {
  return Boolean(findTrustedSeerGoldCheckAgainst(tableRead, seat) || isProtectedDeadSeerLegacyGoldTarget(tableRead, seat));
}

function isProtectedPublicGoldVoteTarget(tableRead: AiTableRead, seat: SeatRead): boolean {
  return isProtectedSeerGoldTarget(tableRead, seat);
}

function hasHardWolfCounterEvidenceAgainstProtectedGold(view: AgentView, tableRead: AiTableRead, seat: SeatRead): boolean {
  if (hasHardOverrideAgainstDeadSeerGold(tableRead, seat)) return true;
  if (findDeadSeerLegacyBlackCheckAgainst(tableRead, seat)) return true;

  const publicBlackChecks = seat.publicChecksAgainst.filter((check) => check.result === "WEREWOLF").length;
  const pressureGap = seat.suspicion - seat.trust;
  const pressureActors = new Set(
    seat.publicStancedBy
      .filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE")
      .map((stance) => stance.actor.seatId),
  );
  const strongStructuralCue = view.publicSummary.tableMemory.reasoningCues.some(
    (cue) =>
      cue.target?.seatId === seat.seatId &&
      cue.weight === "strong" &&
      (cue.kind === "counterclaim" || cue.kind === "seer_legacy" || cue.kind === "vote"),
  );

  if (publicBlackChecks >= 2 && pressureActors.size >= 2 && pressureGap >= 36) return true;
  if (publicBlackChecks >= 1 && pressureActors.size >= 3 && pressureGap >= 48 && strongStructuralCue) return true;

  return false;
}

function isProtectedGoodVoteTarget(view: AgentView, tableRead: AiTableRead, seat: SeatRead): boolean {
  return Boolean(
    seat.isKnownGood ||
      findTrustedSeerGoldCheckAgainst(tableRead, seat) ||
      isProtectedDeadSeerLegacyGoldTarget(tableRead, seat) ||
      chooseUnchallengedPowerClaim(view, seat.publicClaims, seat.publicChecksAgainst) ||
      isUnchallengedPowerBlackCheckedOnlyByCounterclaim(tableRead, seat) ||
      isDayOneSoftPowerHintProtectedTarget(tableRead, seat) ||
      isDayOneSoftPowerHintBlackCheckProtectedTarget(tableRead, seat) ||
      isDayOneSeerGoldClaimProtectedFromAnyBlackCheck(tableRead, seat.seatId) ||
      isTargetOfReactiveSeerBlackCheck(view.publicSummary.tableMemory, seat.seatId),
  );
}

function isProtectedGoodSpeechTarget(view: AgentView, tableRead: AiTableRead, seat: SeatRead): boolean {
  if (isWolfRole(view.myRole, view.rules.wolfRoles)) return false;
  return Boolean(
    seat.isKnownGood ||
      findTrustedSeerGoldCheckAgainst(tableRead, seat) ||
      isProtectedDeadSeerLegacyGoldTarget(tableRead, seat) ||
      isDayOneSoftPowerHintBlackCheckProtectedTarget(tableRead, seat) ||
      isDayOneSeerGoldClaimProtectedFromAnyBlackCheck(tableRead, seat.seatId),
  );
}

export function isDayOneSoftPowerHintBlackCheckProtectedTarget(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (tableRead.day < 1 || tableRead.day > 2 || !seat.lastSpeech) return false;
  if (seat.publicClaims.length > 0) return false;
  if (!hasDayOneSoftPowerHintText(1, seat.lastSpeech)) return false;
  if (hasDeadSeerLegacyBlackCheckAgainst(tableRead.tableMemory, seat.seatId)) return false;

  const wolfChecks = seat.publicChecksAgainst.filter((check) => check.result === "WEREWOLF");
  if (wolfChecks.length !== 1 || wolfChecks[0]?.day !== 1) return false;

  const checkerSeatId = wolfChecks[0]?.claimant.seatId;
  const checker = tableRead.seats.find((item) => item.seatId === checkerSeatId);
  const independentNegativeActors = publicVotePressureActors(seat).filter((actor) => actor.seatId !== checkerSeatId).length;
  const pressureGap = seat.suspicion - seat.trust;
  const checkerCredibility = checker ? checker.trust - checker.suspicion : 0;
  const hardCue = targetReasoningCues(tableRead, seat).some(
    (cue) => cue.weight === "strong" && (cue.kind === "counterclaim" || cue.kind === "seer_legacy" || cue.kind === "vote"),
  );

  if (checkerCredibility >= 30 && pressureGap >= 50 && independentNegativeActors >= 3 && hardCue) {
    return false;
  }

  return true;
}

function isDayOneSoftPowerHintProtectedTarget(tableRead: AiTableRead, seat: SeatRead): boolean {
  if (tableRead.day !== 1 || !seat.lastSpeech) return false;
  if (seat.publicClaims.length > 0) return false;
  if (findTrustedSeerCheckAgainst(tableRead, seat)) return false;
  if (seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF")) return false;
  return hasDayOneSoftPowerHintText(tableRead.day, seat.lastSpeech);
}

function hasDayOneSoftPowerHintText(day: number, message?: string): boolean {
  if (day !== 1 || !message) return false;
  return /底牌不虚|枪牌不用抢着拍|不用抢着拍|不急着拍身份|不乱拍身份|身份先藏|别逼身份|不怕吃抗推|能吃刀|狼夜里可以来试/.test(message);
}

function isDayOneSeerGoldClaimProtectedFromAnyBlackCheck(tableRead: AiTableRead, targetSeatId: number): boolean {
  return tableRead.tableMemory.claimBoard.some(
    (claim) =>
      claim.claimedRole === "SEER" &&
      claim.checks.some((check) => check.result === "WEREWOLF" && check.target.seatId === targetSeatId) &&
      Boolean(
        tableRead.seats.find((seat) => seat.seatId === claim.claimant.seatId) &&
          isDayOneSeerGoldClaimProtectedFromBlackCheck(
            tableRead,
            tableRead.seats.find((seat) => seat.seatId === claim.claimant.seatId)!,
            targetSeatId,
          ),
      ),
  );
}

function isDayOneSeerGoldClaimProtectedFromBlackCheck(
  tableRead: AiTableRead,
  checker: SeatRead,
  targetSeatId: number,
): boolean {
  if (tableRead.day !== 1) return false;
  const checkerSeatId = checker.seatId;
  const targetClaim = tableRead.tableMemory.claimBoard.find(
    (claim) =>
      claim.claimedRole === "SEER" &&
      claim.claimant.seatId === targetSeatId &&
      claim.checks.some((check) => check.result === "GOOD"),
  );
  if (!targetClaim) return false;

  const checkerClaim = tableRead.tableMemory.claimBoard.find(
    (claim) =>
      claim.claimedRole === "SEER" &&
      claim.claimant.seatId === checkerSeatId &&
      claim.checks.some((check) => check.result === "WEREWOLF" && check.target.seatId === targetSeatId),
  );
  if (!checkerClaim) return false;

  const target = tableRead.seats.find((seat) => seat.seatId === targetSeatId);
  const targetPressure = target ? target.suspicion - target.trust : 0;
  const checkerCredibility = checker.trust - checker.suspicion;
  const negativeActors =
    target?.publicStancedBy.filter((stance) => stance.kind === "QUESTION" || stance.kind === "PRESSURE").length ?? 0;

  if (checkerCredibility >= 30 && targetPressure >= 42 && negativeActors >= 3) {
    return false;
  }

  return true;
}

function buildPublicStancePoint(view: AgentView, tableRead: AiTableRead): string | undefined {
  const liveDeadSeerRival = tableRead.seats.find(
    (seat) => !seat.isSelf && !seat.isWolfTeammate && Boolean(findDeadSeerCounterclaimAgainst(tableRead, seat)),
  );
  const latestDeadSeerCheck = tableRead.tableMemory.seerLegacies
    .flatMap((legacy) =>
      legacy.checks
        .filter((check) => check.result === "WEREWOLF")
        .map((check) => ({ legacy, target: tableRead.seats.find((seat) => seat.seatId === check.target.seatId) })),
    )
    .find((item) => item.target && !item.target.isSelf && !item.target.isWolfTeammate);
  if (liveDeadSeerRival) {
    const legacy = findDeadSeerCounterclaimAgainst(tableRead, liveDeadSeerRival);
    return `我先按夜死预言家${legacy?.claimant.seatId ?? ""}号的视角，回看${liveDeadSeerRival.seatId}号对跳线`;
  }
  if (latestDeadSeerCheck?.target) {
    return `夜死预言家${latestDeadSeerCheck.legacy.claimant.seatId}号留过${latestDeadSeerCheck.target.seatId}号查杀，票型先围绕这条线复盘`;
  }

  const seerCounterclaim = view.publicSummary.tableMemory.counterclaims.find((group) => group.claimedRole === "SEER");
  if (seerCounterclaim) {
    const reads = seerCounterclaim.claimants
      .map((claimant) => tableRead.seats.find((seat) => seat.seatId === claimant.seatId))
      .filter((seat): seat is SeatRead => seat !== undefined)
      .filter((seat) => !seat.isSelf && !seat.isWolfTeammate)
      .sort((a, b) => b.suspicion - a.suspicion || a.trust - b.trust || a.seatId - b.seatId);
    const suspect = reads[0];
    if (suspect) return `我不认${suspect.seatId}号预言家，${suspect.pressure[0] ?? "这条身份线要补过程"}`;
  }

  const focus = tableRead.focus;
  const seerClaim = focus?.publicClaims.find((claim) => claim.claimedRole === "SEER");
  if (focus && seerClaim && focus.suspicion >= focus.trust) {
    return `我不认${focus.seatId}号预言家，${focus.pressure[0] ?? "发言和站边不够一致"}`;
  }

  const trustedSeer = tableRead.seats
    .filter((seat) => !seat.isSelf && seat.publicClaims.some((claim) => claim.claimedRole === "SEER"))
    .sort((a, b) => b.trust - a.trust || a.suspicion - b.suspicion)[0];
  if (trustedSeer && trustedSeer.trust - trustedSeer.suspicion >= 18) {
    return `我暂时认${trustedSeer.seatId}号预言家，先看他的验人和票型`;
  }

  if (view.publicSummary.tableMemory.stanceShifts.length > 0) {
    const shift = view.publicSummary.tableMemory.stanceShifts.at(-1);
    if (shift) return `${shift.actor.name}站边有变化，需要解释为什么从${shift.fromKindLabel}改成${shift.toKindLabel}`;
  }

  return undefined;
}

function shouldFollowWolfCounterclaimPlan(
  view: AgentView,
  assignment: WolfTeamAssignment | undefined,
  hasSeerClaim: boolean,
): boolean {
  if (assignment?.task !== "COUNTERCLAIM_SEER") return false;

  const risk = view.persona?.riskTolerance ?? 0.45;
  const bluffing = view.persona?.bluffing ?? 0.45;
  const pressure = hasSeerClaim ? 0.38 : 0.12;
  const threshold = clampProbability(pressure + risk * 0.24 + bluffing * 0.28 + Math.min(0.12, view.day * 0.04));
  const roll = stableRoll([
    "follow-counterclaim",
    view.day,
    view.mySeatId,
    view.persona?.id,
    view.publicSummary.claimBoard.length,
    view.publicSummary.recentSpeeches.at(-1)?.seq,
  ]);

  return roll < threshold;
}

function shouldFreelanceWolfClaim(
  view: AgentView,
  hasSeerClaim: boolean,
  personaRisk: number,
  bluffing: number,
): boolean {
  const threshold = clampProbability((hasSeerClaim ? 0.2 : 0.04) + personaRisk * 0.16 + bluffing * 0.2);
  const roll = stableRoll(["freelance-wolf-claim", view.day, view.mySeatId, view.persona?.id, view.publicSummary.claimBoard.length]);
  return roll < threshold;
}

function chooseWolfFakeCheck(view: AgentView, tableRead: AiTableRead): ClaimCheck | undefined {
  const teammateIds = new Set(view.privateKnowledge.wolfTeammates?.map((seat) => seat.seatId) ?? []);
  const selfSeerClaim = view.publicSummary.claimBoard.find(
    (claim) => claim.claimedRole === "SEER" && claim.claimant.seatId === view.mySeatId,
  );
  const existingToday = selfSeerClaim?.checks.find((check) => check.day === view.day);
  if (existingToday) {
    return {
      day: existingToday.day,
      claimantSeatId: view.mySeatId,
      targetSeatId: existingToday.target.seatId,
      result: existingToday.result,
    };
  }

  const usedTargets = new Set(selfSeerClaim?.checks.map((check) => check.target.seatId) ?? []);
  const opposingSeerClaim = view.publicSummary.claimBoard.find(
    (claim) =>
      claim.claimedRole === "SEER" &&
      claim.claimant.seatId !== view.mySeatId &&
      !teammateIds.has(claim.claimant.seatId) &&
      !usedTargets.has(claim.claimant.seatId),
  );
  const opposingSeer = opposingSeerClaim
    ? tableRead.seats.find((seat) => seat.seatId === opposingSeerClaim.claimant.seatId && !seat.isSelf && !seat.isWolfTeammate)
    : undefined;
  const claimableSeats = tableRead.seats.filter((seat) => !seat.isSelf && !usedTargets.has(seat.seatId));
  const publicCandidates = claimableSeats.filter((seat) => !seat.isWolfTeammate);
  const safeBlackCandidates = publicCandidates.filter(
    (seat) => !findUnchallengedNonSeerPowerClaim(tableRead.tableMemory, seat),
  );
  const fakeGoldTarget = chooseWolfFakeGoldTarget(view, tableRead, claimableSeats);
  const target =
    opposingSeer ??
    safeBlackCandidates.find((seat) => seat.seatId === tableRead.focus?.seatId) ??
    safeBlackCandidates.find((seat) => seat.suspicion >= 55) ??
    fakeGoldTarget ??
    safeBlackCandidates[0] ??
    publicCandidates[0];

  if (!target) return undefined;

  const result = chooseWolfFakeCheckResult(view, tableRead, target, Boolean(opposingSeer?.seatId === target.seatId));

  return {
    day: view.day,
    claimantSeatId: view.mySeatId,
    targetSeatId: target.seatId,
    result,
  };
}

function chooseWolfFakeGoldTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  const bluffing = view.persona?.bluffing ?? 0.45;
  const risk = view.persona?.riskTolerance ?? 0.45;
  const roll = stableRoll(["wolf-fake-gold", view.day, view.mySeatId, view.persona?.id, candidates.length]);
  const threshold = clampProbability(0.28 + bluffing * 0.22 + risk * 0.08 - Math.min(0.12, view.day * 0.03));
  if (roll >= threshold) return undefined;

  return [...candidates]
    .filter((seat) => seat.isWolfTeammate || seat.trust >= seat.suspicion - 4)
    .sort((a, b) => wolfFakeGoldScore(tableRead, b) - wolfFakeGoldScore(tableRead, a) || a.seatId - b.seatId)[0];
}

function wolfFakeGoldScore(tableRead: AiTableRead, seat: SeatRead): number {
  const teammateValue = seat.isWolfTeammate ? 22 : 0;
  const powerClaimValue = findUnchallengedNonSeerPowerClaim(tableRead.tableMemory, seat) ? 8 : 0;
  return seat.trust - seat.suspicion * 0.18 + teammateValue + powerClaimValue;
}

function chooseWolfFakeCheckResult(
  view: AgentView,
  tableRead: AiTableRead,
  target: SeatRead,
  isOpposingSeer: boolean,
): "WEREWOLF" | "GOOD" {
  if (target.isWolfTeammate) return "GOOD";
  if (isOpposingSeer) return "WEREWOLF";
  if (findUnchallengedNonSeerPowerClaim(tableRead.tableMemory, target)) return "GOOD";

  const risk = view.persona?.riskTolerance ?? 0.45;
  const strongPublicCase = target.suspicion >= 60 || (view.day >= 2 && target.suspicion - target.trust >= 16);
  if (strongPublicCase) return "WEREWOLF";

  return stableRoll(["wolf-fake-check-result", view.day, view.mySeatId, view.persona?.id, target.seatId]) < 0.16 + risk * 0.18
    ? "WEREWOLF"
    : "GOOD";
}

function toTargetFromRead(tableRead: AiTableRead, seatId: number): ActionTarget | undefined {
  const seat = tableRead.seats.find((item) => item.seatId === seatId);
  return seat ? { seatId: seat.seatId, name: seat.name } : undefined;
}

function describeMood(view: AgentView, focus?: SeatRead): string {
  const leader = view.publicSummary.voteSnapshot.leaders[0];
  if (leader) return `票型正在向 ${leader.name} 集中`;
  if (focus) return `${focus.name} 是当前最容易被讨论的位置`;
  if (view.phase.startsWith("NIGHT")) return "夜晚信息未公开";
  return "场上还没有明确焦点";
}

function personaPreferences(view: AgentView): PersonaPreferences {
  return {
    ...DEFAULT_PERSONA_PREFERENCES,
    ...(view.persona?.preferences ?? {}),
  };
}

function weighted(value: number, preference: number): number {
  return value * (0.72 + preference * 0.56);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

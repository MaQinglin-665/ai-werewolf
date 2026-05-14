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
} from "@/game/types";
import { clampProbability, stableRoll, stableSignedJitter } from "@/game/decisionNoise";

const GOD_ROLES: Role[] = ["SEER", "WITCH", "HUNTER", "GUARD"];
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

    if (!lastSpeech && view.day > 1 && !isSelf) {
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

    for (const check of seatMemory?.claimedByChecks ?? []) {
      if (check.result === "WEREWOLF") {
        suspicion += weighted(16, preferences.identity);
        pressure.push(`被${check.claimant.name}公开报查杀`);
      } else {
        trust += weighted(8, preferences.identity);
        pressure.push(`被${check.claimant.name}公开报金水`);
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

    if (lastSpeech && !isSelf) {
      if (lastSpeech.message.length < 42) {
        suspicion += weighted(5, preferences.logic);
        pressure.push("发言偏短，过程不足");
      }
      if (/不急|先听|过一轮|不站死/.test(lastSpeech.message)) {
        suspicion += weighted(3, preferences.leadership);
        pressure.push("站边偏保守，需要补判断");
      }
      if (/查杀|金水|预言家|女巫|猎人/.test(lastSpeech.message)) {
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
      pressure.push(...aiBelief.reasons.slice(0, 2).map((reason) => `延续个人记忆：${reason}`));
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
      lastSpeech: lastSpeech?.message,
      lastSpeechDay: seatMemory?.lastSpeechDay,
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

  if (view.myRole === "WEREWOLF") {
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
      return attachDynamics({
        kind: "rally",
        target: focus,
        stance: "女巫拍身份带队收票型",
        talkingPoints: [
          "我拍女巫，今天票型不能再散",
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
          "我拍猎人，今天不要再分票",
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
  role: "WITCH" | "HUNTER",
): boolean {
  if (view.myRole !== role || identityPressure.shouldHideGod) return false;
  if (identityPressure.selfAlreadyClaimed) return true;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const hasSeerCounterclaim = view.publicSummary.tableMemory.counterclaims.some((group) => group.claimedRole === "SEER");
  const focusPressure = tableRead.focus ? tableRead.focus.suspicion - tableRead.focus.trust : 0;
  const publicLeader = tableRead.voteSnapshot.leaders[0];
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
      (hasSeerCounterclaim ? 0.2 : 0) +
      (focusPressure >= 14 ? 0.1 : 0) +
      (leaderPressure >= 62 ? 0.08 : 0) -
      identityPressure.exposedGodRoles.size * 0.08,
  );

  return stableRoll(["god-lead", role, view.day, view.mySeatId, view.persona?.id, identityPressure.exposedGodRoles.size]) < threshold;
}

function chooseVillagerFakeGodRole(view: AgentView, identityPressure: IdentityPressure): "WITCH" | "HUNTER" | undefined {
  if (view.myRole !== "VILLAGER" || identityPressure.shouldHideVillager || identityPressure.selfAlreadyClaimed) return undefined;
  if (identityPressure.exposedGodRoles.size >= 2) return undefined;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const bluffing = view.persona?.bluffing ?? 0.45;
  const hasIdentityPressure =
    view.day >= 2 ||
    view.publicSummary.tableMemory.counterclaims.length > 0 ||
    view.publicSummary.claimBoard.some((claim) => claim.claimedRole === "SEER");
  if (!hasIdentityPressure && bluffing < 0.86) return undefined;

  const availableRoles = (["WITCH", "HUNTER"] as const).filter((role) => !identityPressure.exposedGodRoles.has(role));
  if (availableRoles.length === 0) return undefined;

  if (view.day >= 2 && personaRisk >= 0.72 && bluffing >= 0.88) {
    return availableRoles[stableRoll(["villager-fake-god-role", view.day, view.mySeatId, view.persona?.id]) < 0.5 ? 0 : availableRoles.length - 1];
  }

  const threshold = clampProbability(
    0.04 + bluffing * 0.22 + personaRisk * 0.12 + (view.day >= 2 ? 0.1 : 0) + (hasIdentityPressure ? 0.08 : 0),
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
  const talkingPoints = uniqueSpeechPoints([
    interaction?.line,
    personaCue?.line,
    ...plan.talkingPoints,
  ]).slice(0, 4);

  return {
    ...plan,
    target: plan.target ?? interaction?.target ?? toTargetFromSeatRead(focus),
    interaction,
    personaCue,
    talkingPoints,
  };
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
    ? tableRead.seats.find((seat) => seat.seatId === previousSpeech.speaker?.seatId && !seat.isWolfTeammate)
    : undefined;
  const planTarget = plan.target
    ? tableRead.seats.find((seat) => seat.seatId === plan.target?.seatId && !seat.isSelf && !seat.isWolfTeammate)
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
      return {
        kind: "probe",
        sourceSpeaker,
        target: previousTarget,
        line: `上一位${sourceSpeaker.name}我先留疑问，后面要看他怎么补站边理由`,
        goal: "保留追问窗口",
      };
    }
  }

  if (!target) return undefined;

  if ((view.persona?.riskTolerance ?? 0.45) >= 0.65) {
    return {
      kind: "challenge",
      target: toTargetFromSeatRead(target),
      line: `我会直接压${target.seatId}号，让他把发言和票型讲完整`,
      goal: "主动制造压力",
    };
  }

  return {
    kind: "probe",
    target: toTargetFromSeatRead(target),
    line: `我先把${target.seatId}号放进观察位，等他补清楚自己的逻辑`,
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

  if (personaId === "strong-leader" || personaId === "pressure-bluffer") {
    return {
      mode: "press",
      line: targetText ? `我这轮会结论先行，要求${targetText}号正面回应` : "我这轮会先把结论给出来",
      directives: ["结论先行", "主动归票", "要求目标补过程"],
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
      directives: ["保留余地", "少给死结论", "等待后置位补充"],
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
      line: targetText ? `我会直接给${targetText}号压力，先听他的即时反应` : "我会先把桌面情绪和反应压出来",
      directives: ["节奏更快", "回应语气", "制造互动压力"],
    };
  }

  if (preferences.leadership >= 0.82) {
    return {
      mode: "press",
      line: targetText ? `我这轮会把${targetText}号放进归票讨论` : "我这轮会先收束票型",
      directives: ["给出清晰边界", "组织票型", "要求明确站边"],
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
  const publicFocus = tableRead.focus;
  const rememberedFocus = rememberedSeatId
    ? tableRead.seats.find((seat) => seat.seatId === rememberedSeatId && !seat.isSelf && !seat.isWolfTeammate)
    : undefined;

  if (!rememberedFocus) return publicFocus;
  if (!publicFocus) return rememberedFocus;

  return rememberedFocus.suspicion >= publicFocus.suspicion - 12 ? rememberedFocus : publicFocus;
}

function buildMemorySpeechPoint(
  view: AgentView,
  tableRead: AiTableRead,
  focus: SeatRead | undefined,
): string | undefined {
  const memory = view.privateKnowledge.aiMemory;
  if (!memory || !focus || focus.isSelf || focus.isWolfTeammate) return undefined;

  if (memory.lastVoteTargetSeatId === focus.seatId) {
    return `我上一轮票过${focus.seatId}号，这轮先看他有没有把逻辑补上`;
  }

  if (memory.lastSpeechTargetSeatId === focus.seatId) {
    return `我上一轮已经点过${focus.seatId}号，当前仍要继续听解释`;
  }

  if (memory.suspectedSeatId === focus.seatId) {
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
        if (targetPressure >= 18) {
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
  const knownWolf = candidates.find((seat) => seat.isKnownWolf);
  const sorted = rankVoteCandidates(view, candidates);
  const wolfDistanceTarget = chooseWolfDistanceVoteTarget(view, candidates);
  const wolfTeamTarget = chooseWolfTeamVoteTarget(view, candidates);
  const claimTarget = chooseClaimAwareVoteTarget(view, tableRead, candidates);
  const picked = view.myRole === "WEREWOLF" ? wolfDistanceTarget ?? wolfTeamTarget ?? sorted[0] : knownWolf ?? claimTarget ?? sorted[0] ?? candidates[0];

  if (!picked) {
    throw new Error("没有可投票目标。");
  }

  return {
    target: { seatId: picked.seatId, name: picked.name },
    reason: buildVoteReason(view, tableRead, picked),
    confidence: picked.isKnownWolf ? 0.95 : Math.max(0.35, Math.min(0.86, picked.suspicion / 100)),
    alternatives: sorted
      .filter((seat) => seat.seatId !== picked.seatId)
      .slice(0, 2)
      .map((seat) => ({ seatId: seat.seatId, name: seat.name })),
  };
}

function buildVoteReason(view: AgentView, tableRead: AiTableRead, target: SeatRead): string {
  if (target.isKnownWolf && view.myRole === "SEER") {
    return "我的查验指向这里，今天优先归票。";
  }

  const memory = view.privateKnowledge.aiMemory;
  if (memory?.lastVoteTargetSeatId === target.seatId) {
    return `上一轮我票过${target.name}，疑点还没有解除，这一轮继续压这里。`;
  }

  if (memory?.lastSpeechTargetSeatId === target.seatId) {
    return `我上一轮发言已经点过${target.name}，这一轮投票先保持一致。`;
  }

  if (view.myRole === "WEREWOLF") {
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

  const trustedSeerCheck = findTrustedSeerCheckAgainst(tableRead, target);
  if (trustedSeerCheck) {
    return `${trustedSeerCheck.claimant.name}报过这里查杀，今天先按可信预言家线归票。`;
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

function chooseWolfTeamVoteTarget(view: AgentView, candidates: SeatRead[]): SeatRead | undefined {
  const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
  if (!assignment?.target) return undefined;
  const risk = view.persona?.riskTolerance ?? 0.45;
  const threshold = clampProbability(
    (assignment.task === "PUSH_MISLYNCH" ? 0.46 : assignment.task === "HIDE" ? 0.2 : 0.3) + risk * 0.12,
  );
  const roll = stableRoll([
    "wolf-team-vote-follow",
    view.day,
    view.mySeatId,
    view.persona?.id,
    assignment.task,
    assignment.target.seatId,
  ]);
  if (roll >= threshold) return undefined;
  return candidates.find((seat) => seat.seatId === assignment.target?.seatId);
}

function chooseWolfDistanceVoteTarget(view: AgentView, candidates: SeatRead[]): SeatRead | undefined {
  if (view.myRole !== "WEREWOLF") return undefined;

  const teammateCandidates = candidates.filter((seat) => seat.isWolfTeammate);
  if (teammateCandidates.length === 0) return undefined;

  const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
  const supportSeatId = assignment?.supportSeat?.seatId;
  const supportSeat = supportSeatId
    ? teammateCandidates.find((seat) => seat.seatId === supportSeatId)
    : undefined;
  const publicIdentitySeat = teammateCandidates.find((seat) => seat.publicClaims.length > 0);
  const target = supportSeat ?? publicIdentitySeat ?? teammateCandidates[0];
  if (!target) return undefined;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const bluffing = view.persona?.bluffing ?? 0.45;
  const hasPublicReason =
    target.publicClaims.length > 0 ||
    target.publicStancesGiven.length > 0 ||
    view.publicSummary.tableMemory.counterclaims.some((group) =>
      group.claimants.some((claimant) => claimant.seatId === target.seatId),
    );

  if (personaRisk >= 0.9 && bluffing >= 0.85 && hasPublicReason) {
    return target;
  }

  const threshold = clampProbability(
    0.03 +
      personaRisk * 0.12 +
      bluffing * 0.12 +
      (assignment?.task === "DISTANCE" && supportSeat ? 0.18 : 0) +
      (hasPublicReason ? 0.12 : 0) +
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

function chooseClaimAwareVoteTarget(view: AgentView, tableRead: AiTableRead, candidates: SeatRead[]): SeatRead | undefined {
  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const seerCounterclaim = view.publicSummary.tableMemory.counterclaims.find((group) => group.claimedRole === "SEER");

  if (view.myRole === "SEER" && seerCounterclaim) {
    const counterclaim = seerCounterclaim.claimants.find((claimant) => claimant.seatId !== view.mySeatId && candidateIds.has(claimant.seatId));
    if (counterclaim) return candidates.find((seat) => seat.seatId === counterclaim.seatId);
  }

  const challengedClaimant = chooseCounterclaimPressureTarget(view, tableRead, candidates);
  if (challengedClaimant) return challengedClaimant;

  const trustedCheckTarget = findTrustedSeerCheckTarget(tableRead, candidates);
  if (trustedCheckTarget) return trustedCheckTarget;

  const shifted = view.publicSummary.tableMemory.stanceShifts
    .map((shift) => candidates.find((seat) => seat.seatId === shift.actor.seatId))
    .find((seat): seat is SeatRead => Boolean(seat));
  if (shifted && shifted.suspicion >= 56) return shifted;

  const publicFocus = view.publicSummary.tableMemory.focus
    .map((focus) => candidates.find((seat) => seat.seatId === focus.seat.seatId))
    .find((seat): seat is SeatRead => Boolean(seat));
  return publicFocus && publicFocus.suspicion >= 58 ? publicFocus : undefined;
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

function rankVoteCandidates(view: AgentView, candidates: SeatRead[]): SeatRead[] {
  return [...candidates].sort((a, b) => voteScore(view, b) - voteScore(view, a) || a.seatId - b.seatId);
}

function voteScore(view: AgentView, seat: SeatRead): number {
  if (seat.isKnownWolf) return 200;
  if (seat.isKnownGood || seat.isSelf || seat.isWolfTeammate) return -200;

  const preferences = personaPreferences(view);
  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const trustPenalty = view.myRole === "WEREWOLF" ? 0.1 : 0.14 + preferences.caution * 0.16;
  const pressureBonus = weighted(Math.min(10, seat.pressure.length * 2), Math.max(preferences.leadership, preferences.emotion));
  const voteJitter = stableSignedJitter(
    ["vote", view.day, view.phase, view.mySeatId, view.persona?.id, seat.seatId, view.publicSummary.recentSpeeches.at(-1)?.seq],
    6 + personaRisk * 6,
  );
  const memory = view.privateKnowledge.aiMemory;
  const memoryBonus =
    (memory?.lastSpeechTargetSeatId === seat.seatId ? 9 : 0) +
    (memory?.lastVoteTargetSeatId === seat.seatId ? 7 : 0) +
    (memory?.suspectedSeatId === seat.seatId ? 5 : 0) -
    (memory?.trustedSeatId === seat.seatId ? 8 : 0);

  return seat.suspicion - seat.trust * trustPenalty + pressureBonus + weighted(memoryBonus, preferences.memory) + voteJitter;
}

function chooseCounterclaimPressureTarget(
  view: AgentView,
  tableRead: AiTableRead,
  candidates: SeatRead[],
): SeatRead | undefined {
  if (view.myRole === "WEREWOLF" || view.myRole === "SEER") return undefined;

  const seerCounterclaim = view.publicSummary.tableMemory.counterclaims.find((group) => group.claimedRole === "SEER");
  if (!seerCounterclaim) return undefined;

  const candidateIds = new Set(candidates.map((seat) => seat.seatId));
  const claimants = seerCounterclaim.claimants
    .map((claimant) => tableRead.seats.find((seat) => seat.seatId === claimant.seatId && candidateIds.has(claimant.seatId)))
    .filter((seat): seat is SeatRead => Boolean(seat));
  const suspect = rankVoteCandidates(view, claimants)[0];
  if (!suspect) return undefined;

  const personaRisk = view.persona?.riskTolerance ?? 0.45;
  const challengePressure = suspect.suspicion - suspect.trust;
  const threshold = 0.24 + personaRisk * 0.26 + Math.max(0, challengePressure) / 140;
  const roll = stableRoll(["counterclaim-vote", view.day, view.mySeatId, view.persona?.id, suspect.seatId]);

  return challengePressure >= 8 || roll < clampProbability(threshold) ? suspect : undefined;
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

  if (!inCounterclaim) {
    return seer.trust >= seer.suspicion - (forVote ? 0 : 4);
  }

  return (
    seer.trust - seer.suspicion >= (forVote ? 18 : 14) ||
    Boolean(target && target.suspicion >= 76 && seer.trust >= seer.suspicion + (forVote ? 8 : 4))
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

function buildPublicStancePoint(view: AgentView, tableRead: AiTableRead): string | undefined {
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
  const candidates = tableRead.seats.filter(
    (seat) => !seat.isSelf && !seat.isWolfTeammate && !usedTargets.has(seat.seatId),
  );
  const target =
    opposingSeer ??
    candidates.find((seat) => seat.seatId === tableRead.focus?.seatId) ??
    candidates.find((seat) => seat.suspicion >= 55) ??
    candidates[0];

  if (!target) return undefined;

  const result = opposingSeer || target.suspicion >= 55 || view.day >= 2 ? "WEREWOLF" : "GOOD";

  return {
    day: view.day,
    claimantSeatId: view.mySeatId,
    targetSeatId: target.seatId,
    result,
  };
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

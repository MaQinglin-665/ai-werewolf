import type {
  ActionTarget,
  AgentView,
  AiTableRead,
  PublicVoteItem,
  SeatRead,
  SpeechPlan,
  VotePlan,
} from "@/game/types";

export function buildAiTableRead(view: AgentView): AiTableRead {
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
    votesByTarget.set(vote.target.seatId, [...(votesByTarget.get(vote.target.seatId) ?? []), vote]);
  }

  const seats = view.aliveSeats.map((seat) => {
    const isSelf = seat.seatId === view.mySeatId;
    const isKnownWolf = knownWolfSeatIds.has(seat.seatId);
    const isKnownGood = knownGoodSeatIds.has(seat.seatId);
    const isWolfTeammate = wolfTeammateSeatIds.has(seat.seatId);
    const lastSpeech = [...view.publicSummary.recentSpeeches]
      .reverse()
      .find((speech) => speech.speaker?.seatId === seat.seatId);
    const votedFor = votesByVoter.get(seat.seatId)?.target;
    const votesReceived = votesByTarget.get(seat.seatId)?.length ?? 0;
    const pressure: string[] = [];
    const publicVariance = ((seat.seatId * 7 + view.mySeatId * 3 + view.day * 5) % 15) - 4;
    let suspicion = 45 + publicVariance;
    let trust = 48 - Math.floor(publicVariance / 2);

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

    if (lastSpeech && !isSelf) {
      if (lastSpeech.message.length < 42) {
        suspicion += 5;
        pressure.push("发言偏短，过程不足");
      }
      if (/不急|先听|过一轮|不站死/.test(lastSpeech.message)) {
        suspicion += 3;
        pressure.push("站边偏保守，需要补判断");
      }
      if (/查杀|金水|预言家|女巫|猎人/.test(lastSpeech.message)) {
        trust += 3;
        pressure.push("发言里给过身份相关信息");
      }
    }

    if (votedFor?.seatId === view.mySeatId) {
      suspicion += 9;
      pressure.push("投过我");
    }

    if (votesReceived > 0 && !isSelf) {
      suspicion += votesReceived * 5;
      pressure.push(`当前吃到 ${votesReceived} 票`);
    }

    for (const vote of view.publicSummary.recentVotes.slice(-6)) {
      if (knownWolfSeatIds.has(vote.target.seatId) && vote.voter.seatId === seat.seatId) {
        trust += 8;
        pressure.push("曾压到查验狼");
      }
      if (knownWolfSeatIds.has(vote.voter.seatId) && vote.target.seatId === seat.seatId) {
        trust += 5;
        pressure.push("被可疑玩家攻击过");
      }
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
      lastSpeech: lastSpeech?.message,
      votedFor,
      votesReceived,
    };
  });

  const sortedTargets = seats
    .filter((seat) => !seat.isSelf && !seat.isWolfTeammate)
    .sort((a, b) => b.suspicion - a.suspicion || a.trust - b.trust || a.seatId - b.seatId);
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
    tableMood: describeMood(view, focus),
  };
}

export function createSpeechPlan(view: AgentView, tableRead = buildAiTableRead(view)): SpeechPlan {
  const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
  const focus = tableRead.focus;
  const personaRisk = view.persona?.riskTolerance ?? 0.45;

  if (view.myRole === "SEER" && latestCheck) {
    const target = toTargetFromRead(tableRead, latestCheck.targetSeatId);
    return {
      kind: "claim-check",
      target,
      stance:
        latestCheck.result === "WEREWOLF"
          ? `${target?.name ?? `${latestCheck.targetSeatId}号`} 是我的查验狼`
          : `${target?.name ?? `${latestCheck.targetSeatId}号`} 是我的金水`,
      talkingPoints: [
        latestCheck.result === "WEREWOLF" ? "今天先围绕查验狼归票" : "金水位先放一轮",
        focus ? `${focus.name} 的票型和发言还要继续验` : "不要散票",
      ],
      risk: 0.7,
    };
  }

  if (view.myRole === "WEREWOLF") {
    return {
      kind: personaRisk > 0.65 ? "confuse" : "pressure",
      target: focus,
      stance: focus ? `先把焦点压到 ${focus.name}` : "先制造发言对比",
      talkingPoints: [
        focus?.pressure[0] ?? "场上信息还不够集中",
        tableRead.voteSnapshot.leaders[0] ? `票型焦点在 ${tableRead.voteSnapshot.leaders[0].name}` : "不要过早认死身份",
      ],
      risk: Math.max(0.35, personaRisk),
    };
  }

  if (view.myRole === "WITCH") {
    return {
      kind: "defend",
      target: focus,
      stance: "先保药品和票型信息",
      talkingPoints: [
        tableRead.recentDeaths.at(-1) ?? "死亡信息还不够完整",
        focus ? `${focus.name} 需要解释` : "先听完整轮发言",
      ],
      risk: 0.35,
    };
  }

  if (view.myRole === "HUNTER") {
    return {
      kind: "pressure",
      target: focus,
      stance: "底牌不虚但不急着拍身份",
      talkingPoints: [focus ? `${focus.name} 给过程，不要只给结论` : "我会看谁强推闭眼位", "投票前看归票是否自然"],
      risk: 0.5,
    };
  }

  return {
    kind: "explain-vote",
    target: focus,
    stance: "闭眼好人按公开信息投票",
    talkingPoints: [
      focus?.pressure[0] ?? "先看发言是否前后一致",
      tableRead.voteSnapshot.leaders[0] ? `票型领先位是 ${tableRead.voteSnapshot.leaders[0].name}` : "投票不要太分散",
    ],
    risk: 0.4,
  };
}

export function createVotePlan(view: AgentView, tableRead = buildAiTableRead(view)): VotePlan {
  const voteAction = view.allowedActions.find((action) => action.type === "vote");
  const legalTargets = voteAction?.type === "vote" ? voteAction.targets : [];
  const legalTargetIds = new Set(legalTargets.map((target) => target.seatId));
  const candidates = tableRead.seats.filter((seat) => legalTargetIds.has(seat.seatId));
  const knownWolf = candidates.find((seat) => seat.isKnownWolf);
  const nonTeammateCandidates = candidates.filter((seat) => !seat.isWolfTeammate);
  const sorted = [...(view.myRole === "WEREWOLF" ? nonTeammateCandidates : candidates)].sort(
    (a, b) => b.suspicion - a.suspicion || a.trust - b.trust || a.seatId - b.seatId,
  );
  const picked = view.myRole === "WEREWOLF" ? sorted[0] : knownWolf ?? sorted[0] ?? candidates[0];

  if (!picked) {
    throw new Error("没有可投票目标。");
  }

  return {
    target: { seatId: picked.seatId, name: picked.name },
    reason: buildVoteReason(view, picked),
    confidence: picked.isKnownWolf ? 0.95 : Math.max(0.35, Math.min(0.86, picked.suspicion / 100)),
    alternatives: sorted
      .filter((seat) => seat.seatId !== picked.seatId)
      .slice(0, 2)
      .map((seat) => ({ seatId: seat.seatId, name: seat.name })),
  };
}

function buildVoteReason(view: AgentView, target: SeatRead): string {
  if (target.isKnownWolf && view.myRole === "SEER") {
    return "我的查验指向这里，今天优先归票。";
  }

  if (view.myRole === "WEREWOLF") {
    return target.pressure[0] ? `${target.pressure[0]}，这个位置适合先压一票。` : "这个位置发言留白较多，先压票看反应。";
  }

  if (target.pressure.length > 0) {
    return `${target.pressure[0]}，投票先按公开疑点走。`;
  }

  return "发言和票型都不够扎实，先投这里观察归票。";
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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

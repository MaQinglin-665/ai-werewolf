import type { ActionTarget, AgentView, ClaimBoardItem, SpeechPlan } from "@/game/types";

export type ClassTrialLiveIntent =
  | "self_preserve"
  | "test_reaction"
  | "seize_control"
  | "misdirect"
  | "soft_support"
  | "distance_teammate"
  | "stall"
  | "pressure_target"
  | "withhold"
  | "fake_being_convinced"
  | "emotional_misread"
  | "theatrical_escalation";

export type ClassTrialLiveState = {
  intent: ClassTrialLiveIntent;
  emotionalPressure: "low" | "medium" | "high";
  target?: ActionTarget;
  publicMove: string;
  characterImpulse: string;
  risk: "safe" | "social_risk" | "vote_risk";
  mustAvoidRepeating: string[];
};

type PublicBlackCheckFrame = {
  claim: ClaimBoardItem;
  checked: ActionTarget;
};

export function buildClassTrialLiveState(view: AgentView, plan: SpeechPlan): ClassTrialLiveState | undefined {
  if (view.roleCard?.theme !== "class-trial") return undefined;

  const publicSelfBlackCheck = findPublicBlackCheckAgainstSeat(view.publicSummary.claimBoard, view.mySeatId);
  if (publicSelfBlackCheck) {
    return {
      intent: "self_preserve",
      emotionalPressure: "high",
      target: publicSelfBlackCheck.claimant,
      publicMove: "不认这条查杀，先拆报查杀者为什么现在要把票塞过来。",
      characterImpulse: selectCharacterImpulse(view, "whenBlackChecked"),
      risk: "vote_risk",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  if (plan.speechMove === "claim_black_check") {
    return {
      intent: "seize_control",
      emotionalPressure: "medium",
      target: plan.target,
      publicMove: "把验人结果钉成今天必须处理的桌面压力。",
      characterImpulse: selectCharacterImpulse(view, "claimBlackCheck"),
      risk: "social_risk",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  const publicTeammateBlackCheck = findPublicWolfTeammateBlackCheck(view);
  if (publicTeammateBlackCheck) {
    const followupPivot = findBlackCheckFollowupPivot(view, publicTeammateBlackCheck);
    if (followupPivot) {
      return {
        intent: "misdirect",
        emotionalPressure: "medium",
        target: followupPivot,
        publicMove: roleSpecificBlackCheckPivotMove(
          view.roleCard.id,
          "查杀位已经接过话，不要再复述“不认/没说身份”；借刚才跟压者开新靶，检查谁只复述查杀、谁急着把焦点钉死。",
        ),
        characterImpulse: selectCharacterImpulse(view, "whenOthersBlackChecked"),
        risk: "social_risk",
        mustAvoidRepeating: buildMustAvoidRepeating(view),
      };
    }

    return {
      intent: "distance_teammate",
      emotionalPressure: "medium",
      target: publicTeammateBlackCheck.checked,
      publicMove: "不复读查杀发言太满；把舞台转到被查杀者怎么接、有没有对跳、谁救得太快。",
      characterImpulse: selectCharacterImpulse(view, "whenOthersBlackChecked"),
      risk: "social_risk",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  const publicOtherBlackCheck = findPublicOtherBlackCheck(view);
  if (publicOtherBlackCheck) {
    const followupPivot = findBlackCheckFollowupPivot(view, publicOtherBlackCheck);
    if (followupPivot) {
      return {
        intent: "test_reaction",
        emotionalPressure: "medium",
        target: followupPivot,
        publicMove: roleSpecificBlackCheckPivotMove(
          view.roleCard.id,
          "被查杀位已经正面接过话，不要再问被查杀位是什么或怎么接；改查刚才跟压的人有没有新增理由，谁把查杀当成免思考按钮。",
        ),
        characterImpulse: selectCharacterImpulse(view, "whenOthersBlackChecked"),
        risk: "safe",
        mustAvoidRepeating: buildMustAvoidRepeating(view),
      };
    }

    return {
      intent: "test_reaction",
      emotionalPressure: "medium",
      target: publicOtherBlackCheck.checked,
      publicMove:
        "不替查杀位松绑，也不反压首跳查杀；不要追问首验理由，不要评价首跳者票压太满，先逼被查杀位正面接，再观察有没有对跳和后置谁救得太快。",
      characterImpulse: selectCharacterImpulse(view, "whenOthersBlackChecked"),
      risk: "safe",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  const latestPressureSpeaker = findLatestSpeakerTargetingSelf(view);
  if (latestPressureSpeaker) {
    return {
      intent: view.roleCard.classTrialVoiceProfile?.dramaticBoundaries.allowIrrationalMisread ? "emotional_misread" : "pressure_target",
      emotionalPressure: "medium",
      target: latestPressureSpeaker,
      publicMove: "把上一位点名自己的急迫感转成可被桌面继续追问的问题。",
      characterImpulse: selectCharacterImpulse(view, "whenPreviousSpeakerTargetsHer"),
      risk: "social_risk",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  if (view.roleCard.id === "enoshima" && (view.publicSummary.claimBoard.length > 0 || view.publicSummary.recentSpeeches.length > 0)) {
    return {
      intent: "theatrical_escalation",
      emotionalPressure: "medium",
      target: plan.target,
      publicMove: "把一个小反应推上舞台，逼对方继续暴露。",
      characterImpulse: selectCharacterImpulse(view, "whenOthersBlackChecked"),
      risk: "social_risk",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  if (!plan.target && view.publicSummary.claimBoard.length === 0) {
    return {
      intent: "withhold",
      emotionalPressure: "low",
      publicMove: "先不贡献完整结论，观察谁过早定义局面。",
      characterImpulse: selectCharacterImpulse(view, "lowInfoOpening"),
      risk: "safe",
      mustAvoidRepeating: buildMustAvoidRepeating(view),
    };
  }

  return {
    intent: plan.target ? "pressure_target" : "test_reaction",
    emotionalPressure: "medium",
    target: plan.target,
    publicMove: "只做一个当前动作，把压力落到一个人或一句话上。",
    characterImpulse: selectCharacterImpulse(view, "lowInfoOpening"),
    risk: plan.target ? "social_risk" : "safe",
    mustAvoidRepeating: buildMustAvoidRepeating(view),
  };
}

export function formatClassTrialLiveStateForPrompt(state: ClassTrialLiveState): string {
  return [
    `intent=${state.intent}`,
    `pressure=${state.emotionalPressure}`,
    state.target ? `target=${state.target.seatId}号${state.target.name}` : undefined,
    `move=${state.publicMove}`,
    `impulse=${state.characterImpulse}`,
    `risk=${state.risk}`,
    state.mustAvoidRepeating.length > 0 ? `avoid=${state.mustAvoidRepeating.join("；")}` : undefined,
  ]
    .filter(Boolean)
    .join(" | ");
}

function findPublicBlackCheckAgainstSeat(claimBoard: ClaimBoardItem[], seatId: number): ClaimBoardItem | undefined {
  return claimBoard.find((claim) => claim.checks.some((check) => check.target.seatId === seatId && check.result === "WEREWOLF"));
}

function findPublicOtherBlackCheck(view: AgentView): PublicBlackCheckFrame | undefined {
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimant.seatId === view.mySeatId) continue;
    const checked = claim.checks.find((check) => check.target.seatId !== view.mySeatId && check.result === "WEREWOLF")?.target;
    if (checked) return { claim, checked };
  }

  return undefined;
}

function findPublicWolfTeammateBlackCheck(view: AgentView): PublicBlackCheckFrame | undefined {
  if (view.myRole !== "WEREWOLF") return undefined;
  const teammateSeatIds = new Set(view.privateKnowledge.wolfTeammates?.map((teammate) => teammate.seatId) ?? []);
  for (const claim of view.publicSummary.claimBoard) {
    const checked = claim.checks.find((check) => teammateSeatIds.has(check.target.seatId) && check.result === "WEREWOLF")?.target;
    if (checked) return { claim, checked };
  }

  return undefined;
}

function findBlackCheckFollowupPivot(view: AgentView, frame: PublicBlackCheckFrame): ActionTarget | undefined {
  const currentDaySpeeches = view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker);
  const checkedHasResponded = currentDaySpeeches.some((speech) => speech.speaker?.seatId === frame.checked.seatId);
  if (!checkedHasResponded) return undefined;

  const blackCheckRelatedSpeeches = currentDaySpeeches.filter((speech) => isBlackCheckFollowupSpeech(speech.message));
  if (blackCheckRelatedSpeeches.length < 3) return undefined;

  return [...blackCheckRelatedSpeeches].reverse().find((speech) => {
    const speakerSeatId = speech.speaker?.seatId;
    return (
      speech.speaker &&
      speakerSeatId !== view.mySeatId &&
      speakerSeatId !== frame.claim.claimant.seatId &&
      speakerSeatId !== frame.checked.seatId
    );
  })?.speaker;
}

function isBlackCheckFollowupSpeech(message: string): boolean {
  return /查杀|预言家|不认|对跳|被钉|身份|跟压|施压|链条|焦点|票台|票架|后置位|救人|保人|说圆|结论|模糊|落脚|缓冲|帮.+(?:说|铺|圆)|替.+(?:压|问|挡)/.test(
    message,
  );
}

function roleSpecificBlackCheckPivotMove(roleId: string, fallback: string): string {
  switch (roleId) {
    case "tomori":
      return "查杀位已经接过话，不要再问她怎么自证；用高松灯的听感去查刚才跟压者的声音哪里没接上，谁把不认查杀复述成安全话。";
    case "anon":
      return "气氛已经被同一条查杀压力带着跑，不要再拉回1号；用爱音的社交感去接关系链，检查谁接话太顺、谁把大家带着跑同一条压力。";
    case "kirigiri":
      return "查杀位已经接过话，不再替任何一边补结论；切到刚才跟压者为什么需要这个焦点继续成立。";
    case "enoshima":
      return "查杀位已经接过话，别借同一句查杀表演；把刚才跟压者推上舞台，整段只审这个跟压者，尾句不要回到查杀位自证。";
    case "celestia":
      return "查杀位已经接过话，停止向她重复下注；改把筹码压到刚才跟注者身上，看谁解释成本突然变低。";
    case "togami":
      return "查杀位已经接过话，别再审她同一道题；用十神的资格审查看刚才跟压者的标准是否达标，谁没有资格继续带队。";
    case "monokuma":
      return "查杀位已经接过话，别再让她原地挨打；把刚才跟压者拖上裁判席，二选一问他是在审判还是在糊弄。";
    case "fukawa":
      return "查杀位已经接过话，别跟着别人把她按死；从刚才跟压者的轻慢和急迫里找刺，先反咬那个看笑话的人。";
    case "naegi":
      return "查杀位已经接过话，不再重复查杀本身；把问题改成大家能共同验证的跟压断点，谁只是在跟着推。";
    default:
      return fallback;
  }
}

function findLatestSpeakerTargetingSelf(view: AgentView): ActionTarget | undefined {
  const selfName = view.roleCard?.displayName ?? view.aliveSeats.find((seat) => seat.seatId === view.mySeatId)?.name;
  const selfSeatText = `${view.mySeatId}号`;
  const latest = [...view.publicSummary.recentSpeeches]
    .reverse()
    .find((speech) => speech.speaker && (speech.message.includes(selfSeatText) || (selfName ? speech.message.includes(selfName) : false)));
  return latest?.speaker;
}

function selectCharacterImpulse(view: AgentView, scenarioKey: string): string {
  const profile = view.roleCard?.classTrialVoiceProfile;
  const scenario = profile?.scenarioReactions[scenarioKey] ?? profile?.scenarioReactions.lowInfoOpening;
  return scenario ? `${scenario.innerDrive} ${scenario.speechMove}` : "按当前局势给出一个角色化反应，不复述固定标签。";
}

function buildMustAvoidRepeating(view: AgentView): string[] {
  const bans = view.roleCard?.classTrialVoiceProfile?.overuseBans ?? [];
  const recentText = view.publicSummary.recentSpeeches
    .slice(-3)
    .map((speech) => speech.message)
    .join("\n");
  const repeatedAxes = ["证据链", "结构", "收益", "验证", "声音没接上"].filter((axis) => recentText.includes(axis));
  const blackCheckMentions = view.publicSummary.recentSpeeches.slice(-3).filter((speech) => /查杀|预言家|验人/.test(speech.message)).length;
  const hardInfoAvoid =
    blackCheckMentions >= 2 ? ["不要复读首跳查杀、票压太死、顺序太干净这条轴；改看被查杀位接法、对跳、救人动作或后置站边"] : [];
  const selfBlackCheckPeaceAvoid =
    hasPublicBlackCheckAgainstSelf(view) && hasPeacefulNightMention(view)
      ? ["被查杀位回应不要再借平安夜/女巫用药；只拆查杀、首跳者和自己怎么活"]
      : [];
  const lateBlackCheckInventoryAvoid = isLateBlackCheckSpeaker(view)
    ? ["不要按顺序复盘苗木/雾切/腐川/黑白熊；开头直接点一个人下注、定标准或拆一处反应"]
    : [];
  const repeatedFollowerTarget = findRepeatedBlackCheckFollowerTarget(view);
  const repeatedFollowerAvoid = repeatedFollowerTarget
    ? [
        `不要连续追${formatTarget(repeatedFollowerTarget)}同一处标准/看戏/两头站问题；改审上一位为什么还在复读，或换另一个救人/跟注/改焦点的人`,
      ]
    : [];
  const copiedQuestionAvoid = buildCopiedQuestionShapeAvoid(view);
  return Array.from(
    new Set([
      ...bans,
      ...repeatedAxes,
      ...hardInfoAvoid,
      ...selfBlackCheckPeaceAvoid,
      ...lateBlackCheckInventoryAvoid,
      ...repeatedFollowerAvoid,
      ...copiedQuestionAvoid,
    ]),
  );
}

function hasPublicBlackCheckAgainstSelf(view: AgentView): boolean {
  return view.publicSummary.claimBoard.some(
    (claim) =>
      claim.claimedRole === "SEER" && claim.checks.some((check) => check.target.seatId === view.mySeatId && check.result === "WEREWOLF"),
  );
}

function hasPeacefulNightMention(view: AgentView): boolean {
  const publicText = [
    ...view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day).map((speech) => speech.message),
    ...view.publicEvents.map((event) => event.message),
  ].join("\n");
  return /平安夜|女巫用药|药瓶|无人倒牌|没人倒牌/.test(publicText);
}

function isLateBlackCheckSpeaker(view: AgentView): boolean {
  const frames = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, checked: check.target })));
  if (frames.length === 0) return false;
  if (frames.some(({ claim, checked }) => claim.claimant.seatId === view.mySeatId || checked.seatId === view.mySeatId)) return false;
  return view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker).length >= 4;
}

function findRepeatedBlackCheckFollowerTarget(view: AgentView): ActionTarget | undefined {
  const frames = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, checked: check.target })));
  if (frames.length === 0) return undefined;
  const currentDaySpeeches = view.publicSummary.recentSpeeches.filter((speech) => speech.day === view.day && speech.speaker);
  if (!frames.some(({ checked }) => currentDaySpeeches.some((speech) => speech.speaker?.seatId === checked.seatId))) return undefined;

  const excludedSeatIds = new Set<number>([view.mySeatId]);
  for (const { claim, checked } of frames) {
    excludedSeatIds.add(claim.claimant.seatId);
    excludedSeatIds.add(checked.seatId);
  }

  return view.aliveSeats
    .filter((seat) => !excludedSeatIds.has(seat.seatId))
    .find((seat) => {
      const priorCount = currentDaySpeeches.filter(
        (speech) =>
          speech.speaker &&
          speech.speaker.seatId !== seat.seatId &&
          criticizesBlackCheckFollowerTarget(speech.message, seat),
      ).length;
      return priorCount >= 2;
    });
}

function buildCopiedQuestionShapeAvoid(view: AgentView): string[] {
  if (view.day !== 1 || !hasPublicBlackCheckMention(view)) return [];
  const source = view.publicSummary.recentSpeeches
    .filter((speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId)
    .slice(-3)
    .find((speech) => isCopyableBlackCheckQuestionShape(speech.message));
  if (!source?.speaker) return [];

  const roleMove = (() => {
    switch (view.roleCard?.id) {
      case "togami":
        return "改用十神的合格线：谁的标准不达标、谁没有资格带队";
      case "kirigiri":
        return "改用雾切的证词切片：只切一处时机或动机前提";
      case "enoshima":
        return "改用江之岛的舞台反应：把一个新反应推上台";
      case "celestia":
        return "改用塞蕾丝的下注：押一个解释成本最高的筹码";
      case "tomori":
        return "改用高松灯的听感断点：只确认一个声音没接上的地方";
      case "anon":
        return "改用爱音的关系链：看谁接话太顺、谁带跑气氛";
      default:
        return "改成本角色自己的动作和一个新公开压力点";
    }
  })();
  return [`不要复制${formatTarget(source.speaker)}的问法、三连问或句子骨架；${roleMove}`];
}

function hasPublicBlackCheckMention(view: AgentView): boolean {
  if (
    view.publicSummary.claimBoard.some(
      (claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "WEREWOLF"),
    )
  ) {
    return true;
  }
  return view.publicSummary.recentSpeeches.some((speech) => /查杀|预言家|验出.{0,8}狼|结果是狼|是狼人/.test(speech.message));
}

function isCopyableBlackCheckQuestionShape(message: string): boolean {
  if (!/(?:查杀|预言家|验|跳|反手|站哪边|标准|跟)/.test(message)) return false;
  const questionShapeHits = [
    /报查杀的时机/,
    /刚跳完.{0,12}立刻反手/,
    /昨晚.{0,8}预言/,
    /刚好验到/,
    /等着.{0,8}跳完/,
    /站哪边/,
    /继续藏着/,
    /到底.{0,12}标准/,
    /两头都站/,
  ].filter((pattern) => pattern.test(message)).length;
  return questionShapeHits >= 2 || (questionShapeHits >= 1 && /[?？]|还是|到底|为什么/.test(message));
}

function criticizesBlackCheckFollowerTarget(message: string, seat: ActionTarget): boolean {
  if (!mentionsSeatReference(message, seat) || !isBlackCheckFollowerTargetCriticism(message)) return false;
  const seatRefs = [`${seat.seatId}\\s*号`];
  if (seat.name && seat.name !== "你") seatRefs.push(escapeRegExp(seat.name));
  const seatPattern = `(?:${seatRefs.join("|")})`;
  const directSeatRefs = [`${seat.seatId}\\s*号`];
  if (seat.name && seat.name !== "你") {
    directSeatRefs.unshift(`${seat.seatId}\\s*号\\s*${escapeRegExp(seat.name)}`);
    directSeatRefs.push(escapeRegExp(seat.name));
  }
  const directSeatPattern = `(?:${directSeatRefs.join("|")})`;
  const issuePattern =
    "(?:标准|没有标准|两头都站|倾向|站哪边|站哪一边|可信|写死|太快|制造假焦点|看戏|舒服|跟压|救人|台阶|接上|声音|押|下注|筹码|跟注)";
  return message.split(/[。！？；]/).some((sentence) => {
    if (!new RegExp(seatPattern).test(sentence) || !new RegExp(issuePattern).test(sentence)) return false;
    const directlyAddressesTarget = new RegExp(
      `${directSeatPattern}\\s*(?:，|,|、|：|:)?\\s*(?:你|你的|你这|你一边|你刚才)`,
    ).test(sentence);
    if (!directlyAddressesTarget && /^[\s…。·]*(?:\d+\s*号)?[^，,、。！？；]{1,12}(?:，|,|、)?\s*你/.test(sentence)) {
      return false;
    }
    return (
      directlyAddressesTarget ||
      new RegExp(`(?:看|觉得|认为|盯|压|审|问|挂|投|打|咬|怀疑)[^。！？；]{0,16}${seatPattern}[^。！？；]{0,28}${issuePattern}`).test(
        sentence,
      ) ||
      new RegExp(`${seatPattern}[^。！？；]{0,24}(?:这句|这话|这个位置|这里|发言|问题|标准)[^。！？；]{0,28}${issuePattern}`).test(
        sentence,
      )
    );
  });
}

function isBlackCheckFollowerTargetCriticism(message: string): boolean {
  const hasFollowerIssue =
    /(?:标准|没有标准|两头都站|倾向|站哪边|站哪一边|可信|写死|太快|制造假焦点|看戏|舒服|跟压|救人|台阶|接上|声音|押|下注|筹码|跟注)/.test(
      message,
    );
  if (!hasFollowerIssue) return false;
  return /(?:查杀|预言家|苗木|腐川|结果|焦点|站边|裁判席|平安夜|标准|两头都站|站哪边|站哪一边)/.test(message);
}

function mentionsSeatReference(message: string, seat: ActionTarget): boolean {
  if (message.includes(`${seat.seatId}号`)) return true;
  if (!seat.name || seat.name === "你" || !message.includes(seat.name)) return false;

  let index = message.indexOf(seat.name);
  while (index >= 0) {
    const prefix = message.slice(Math.max(0, index - 8), index);
    if (!/(?:\d+|[一二三四五六七八九十]+)\s*号\s*$/.test(prefix)) return true;
    index = message.indexOf(seat.name, index + seat.name.length);
  }
  return false;
}

function formatTarget(target: ActionTarget): string {
  return `${target.seatId}号${target.name}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

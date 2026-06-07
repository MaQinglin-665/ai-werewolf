export type ClassTrialAntiTemplateFindingKind =
  | "sentence_shape_repeat"
  | "thought_axis_repeat"
  | "role_label_repeat"
  | "weak_character_presence"
  | "weak_dialogue_relation"
  | "boring_but_correct"
  | "unearned_claimant_pressure"
  | "black_check_axis_repeat";

export type ClassTrialAntiTemplateFinding = {
  kind: ClassTrialAntiTemplateFindingKind;
  severity: "low" | "medium" | "high";
  message: string;
  evidence: string[];
  revisionDirection: string;
  repeatedWithSeatIds?: number[];
};

export type ClassTrialSpeechQualityInput = {
  seatId: number;
  name: string;
  roleId?: string;
  isFallback: boolean;
  speech: string;
  previousSpeeches: Array<{
    seatId: number;
    name: string;
    roleId?: string;
    speech: string;
    isFallback?: boolean;
  }>;
  roleOveruseBans?: string[];
};

export type ClassTrialSpeechQualityResult = {
  hardInfoUseful: boolean;
  viewerQuality: "pass" | "warn" | "fail";
  antiTemplateFindings: ClassTrialAntiTemplateFinding[];
  liveIntentPresent: boolean;
  characterPresence: "weak" | "clear" | "strong";
  interactionChanged: boolean;
  repeatedAxes: string[];
};

const AXIS_PATTERNS: Array<{ axis: string; pattern: RegExp }> = [
  { axis: "peace-night", pattern: /平安夜|没人死|无死/ },
  { axis: "black-check", pattern: /查杀|验人|金水|预言家/ },
  { axis: "validation", pattern: /验证|票型|后续看|先听/ },
  { axis: "structure", pattern: /结构|框架|链条|证据链/ },
  { axis: "benefit", pattern: /收益|获利|好处/ },
  { axis: "voice-gap", pattern: /声音|接上|断|空拍/ },
];

const LIVE_INTENT_PATTERN =
  /不认|压|保|躲|切|装|拉回|把票|反打|试探|先不跟|不跟着|先不接住|正面接|核对|别让|为什么|急着|点头|反咬|塞给我|结果必须说出来|不要绕开|需要看到|只接受|先确认|一步步|把关系接回来|关系接回来|落在哪里|找狼|顺序太顺|直接跑票|接杀|谁救|改目标|轮到你|不要铺垫|听完你|站边顺序|说清|信不信|判断责任|立场|不站边|绕开|真正值得看|前置位的质量|反应有没有达标|达标|资格|我会按|标准|没有标准|两头都站|制造假焦点|过关|筹码|跟注|下注|押在哪|押在|解释成本/;
const CHARACTER_PRESENCE_PATTERN =
  /别|急|怕|慌|笑|有趣|无聊|眼神|赢了|舞台|舒服|反应|点头|逼|装|保留|接住|核对|正面接|声音|接上|停了一下|气氛|关系链|共同|希望|这句话很重|结果必须说出来|一步步|把关系接回来|关系接回来|落在哪里|找狼|顺序太顺|语气太顺|接杀|谁救|改目标|轮到你|不要铺垫|听完你|站边顺序|说清|信不信|判断责任|立场|不站边|绕开|真正值得看|前置位的质量|反应有没有达标|达标|资格|我会按|标准|没有标准|两头都站|制造假焦点|过关|筹码|跟注|下注|押在哪|押在|解释成本/;
const HARD_INFO_PATTERN = /查杀|金水|预言家|女巫|票型|站边|投|验|发言|解释|怀疑|压/;
const BORING_CORRECT_PATTERN = /我认为.*需要验证|后续看票型|先发言|先听.*发言|后续再看/;

const REVISION_DIRECTIONS: Record<ClassTrialAntiTemplateFindingKind, string> = {
  sentence_shape_repeat: "换成一个角色当下的反应动作，不要再用上一位的句式推进。",
  thought_axis_repeat: "换一条人物欲望或压力来源来处理同一公开事实。",
  role_label_repeat: "保留人格底色，但避开这个角色刚用过或最容易复读的标志词。",
  weak_character_presence: "让这句话露出角色的价值偏见、恐惧、自尊、操控欲或自保。",
  weak_dialogue_relation: "点名回应一个人：压他、躲他、误读他、诱导他或暂时保他。",
  boring_but_correct: "保留狼人杀信息，但让它从角色情绪和当下压力里说出来。",
  unearned_claimant_pressure: "首跳查杀未被对跳前，先让被查杀位正面接，再观察有没有对跳和谁急着救或改写局面。",
  black_check_axis_repeat: "不要继续复读报查杀者那句话，换到被查杀位接法、后置站边、救人动作或新的反应测试。",
};

export function analyzeClassTrialSpeechQuality(input: ClassTrialSpeechQualityInput): ClassTrialSpeechQualityResult {
  if (input.isFallback) {
    return {
      hardInfoUseful: false,
      viewerQuality: "pass",
      antiTemplateFindings: [],
      liveIntentPresent: false,
      characterPresence: "weak",
      interactionChanged: false,
      repeatedAxes: [],
    };
  }

  const recent = input.previousSpeeches.filter((speech) => !speech.isFallback).slice(-3);
  const currentAxes = detectAxes(input.speech);
  const repeatedAxes = currentAxes.filter((axis) => recent.some((speech) => detectAxes(speech.speech).includes(axis)));
  const liveIntentPresent = LIVE_INTENT_PATTERN.test(input.speech);
  const hardInfoUseful = HARD_INFO_PATTERN.test(input.speech);
  const interactionChanged = hasSeatReference(input.speech) || /你|他|她|对方|上一位/.test(input.speech);
  const characterPresence = detectCharacterPresence(input.speech, liveIntentPresent);
  const findings: ClassTrialAntiTemplateFinding[] = [];

  if (hasRepeatedSentenceShape(input.speech, recent)) {
    findings.push(finding("sentence_shape_repeat", "medium", "近期发言句式骨架重复。", [input.speech], recent.map((speech) => speech.seatId)));
  }

  if (repeatedAxes.length >= 2 && !(liveIntentPresent && hasConcreteTargetedMove(input, input.previousSpeeches))) {
    findings.push(finding("thought_axis_repeat", "medium", "当前发言复用了前置位的抽象思路轴。", repeatedAxes));
  }

  const repeatedOveruseBans = detectOveruseBans(input.speech, input.roleOveruseBans ?? []);
  if (repeatedOveruseBans.length > 0 || repeatedAxes.includes("structure") || repeatedAxes.includes("benefit")) {
    findings.push(finding("role_label_repeat", "high", "角色标签或高频抽象词被复读。", [...repeatedOveruseBans, ...repeatedAxes]));
  }

  if (characterPresence === "weak") {
    findings.push(finding("weak_character_presence", "medium", "发言有桌面信息，但角色反应太弱。", [input.speech]));
  }

  if (!interactionChanged && !liveIntentPresent) {
    findings.push(finding("weak_dialogue_relation", "medium", "发言没有明显回应、压迫、躲闪或诱导任何人。", [input.speech]));
  }

  if (hardInfoUseful && BORING_CORRECT_PATTERN.test(input.speech) && characterPresence === "weak") {
    findings.push(finding("boring_but_correct", "high", "信息有效，但观感像通用狼人杀复盘。", [input.speech]));
  }

  const blackCheckClaim = findRecentBlackCheckClaim(input.previousSpeeches);
  if (blackCheckClaim && isUnearnedClaimantPressure(input, blackCheckClaim)) {
    findings.push(
      finding("unearned_claimant_pressure", "high", "未等被查杀位回应或对跳出现，就把压力转回首跳查杀者。", [
        blackCheckClaim.speech,
        input.speech,
      ]),
    );
  }

  if (isRepeatedBlackCheckAxis(input, recent, currentAxes)) {
    findings.push(
      finding("black_check_axis_repeat", "medium", "后置发言继续复用同一条查杀话术作为主要压力轴。", [
        ...recent.map((speech) => speech.speech),
        input.speech,
      ]),
    );
  }

  return {
    hardInfoUseful,
    viewerQuality: resolveViewerQuality(findings),
    antiTemplateFindings: findings,
    liveIntentPresent,
    characterPresence,
    interactionChanged,
    repeatedAxes,
  };
}

function findRecentBlackCheckClaim(previousSpeeches: ClassTrialSpeechQualityInput["previousSpeeches"]):
  | (ClassTrialSpeechQualityInput["previousSpeeches"][number] & { checkedSeatId?: number })
  | undefined {
  const claim = previousSpeeches.find((speech) => /预言家/.test(speech.speech) && /查杀|狼人/.test(speech.speech));
  if (!claim) return undefined;
  return { ...claim, checkedSeatId: extractCheckedSeatId(claim.speech) };
}

function extractCheckedSeatId(speech: string): number | undefined {
  const match =
    speech.match(/(?:查验|验|查了|报|给)?\s*(\d+)\s*号[^。；！？]*?(?:查杀|狼人)/) ??
    speech.match(/(?:查杀|狼人)[^。；！？]*?(\d+)\s*号/);
  const seatId = match?.[1] ? Number(match[1]) : undefined;
  return Number.isFinite(seatId) ? seatId : undefined;
}

function isUnearnedClaimantPressure(
  input: ClassTrialSpeechQualityInput,
  claim: ClassTrialSpeechQualityInput["previousSpeeches"][number] & { checkedSeatId?: number },
): boolean {
  if (input.roleId !== "kirigiri") return false;
  if (claim.checkedSeatId && input.previousSpeeches.some((speech) => speech.seatId === claim.checkedSeatId)) return false;
  if (!input.speech.includes(claim.name)) return false;
  return /票压|压得|封住|预设|太死|太满|急着(?:让|把|逼|压|定)|观察窗口|留余地|没留|压法|压满|顺序[^。！？；]{0,8}干净|三个动作[^。！？；]{0,12}(?:做完|压)/.test(
    input.speech,
  );
}

function isRepeatedBlackCheckAxis(
  input: ClassTrialSpeechQualityInput,
  recent: ClassTrialSpeechQualityInput["previousSpeeches"],
  currentAxes: string[],
): boolean {
  if (input.roleId === "fukawa") return false;
  if (!currentAxes.includes("black-check")) return false;
  if (callsOutRepeatedBlackCheckAxis(input.speech)) return false;
  const claim = findRecentBlackCheckClaim(input.previousSpeeches);
  if (claim?.checkedSeatId && !input.previousSpeeches.some((speech) => speech.seatId === claim.checkedSeatId)) return false;
  const recentBlackCheckCount = recent.filter((speech) => detectAxes(speech.speech).includes("black-check")).length;
  if (recentBlackCheckCount < 2) return false;
  if (isFirstDirectCheckedSeatFollowup(input)) return false;
  if (replaysCheckedSeatSelfProofAfterFollowup(input)) return true;
  if (pivotsBlackCheckAxisToSpecificNewTarget(input, recent)) return false;
  return /首置位|首跳|跳预言家|报.*查杀|票压|压得|查杀.*太|顺着这条查杀|站得舒服/.test(input.speech);
}

function callsOutRepeatedBlackCheckAxis(speech: string): boolean {
  return (
    /(?:同一个|同一|一样|轮番|反复|一直|都在|所有人|大家|你们|拿到了同一个方向|同一个方向|同一个问题|顺序)/.test(speech) &&
    /(?:查杀|方向|问题|压|焦点|站边|伸手|不自然)/.test(speech)
  );
}

function hasConcreteTargetedMove(
  input: ClassTrialSpeechQualityInput,
  recent: ClassTrialSpeechQualityInput["previousSpeeches"],
): boolean {
  if (recent.length === 0) return false;
  const concreteMovePattern =
    /(?:票口|标准|台阶|藏身|接话|接完|倒是接|给个方向|什么身份|有没有身份|混过去|太顺|太干净|舒服|观望位|安全|没回答|结论|观察|帮|铺|推开|焦点|带着跑|停一下|落在哪里|找狼|语气|封死|姿势|站边|评|缺口|不跟着|直接跑票|信不信|判断责任|立场|不站边|绕开|回应哪里不对|前置位的质量|质量|达标|资格|没有资格|我会按|真正值得看|两头都站|制造假焦点|过关|筹码|跟注|下注|押在哪|押在|解释成本)/;
  if (concreteMovePattern.test(input.speech) && recent.some((target) => isDirectTargetAddress(input.speech, target))) {
    return true;
  }
  return input.speech
    .split(/[。！？；]/)
    .filter(Boolean)
    .some(
      (sentence) =>
        concreteMovePattern.test(sentence) && recent.some((target) => isDirectTargetAddress(sentence, target)),
    );
}

function isFirstDirectCheckedSeatFollowup(input: ClassTrialSpeechQualityInput): boolean {
  const claim = findRecentBlackCheckClaim(input.previousSpeeches);
  if (!claim?.checkedSeatId) return false;
  const checkedSpeechIndex = input.previousSpeeches.findIndex((speech) => speech.seatId === claim.checkedSeatId);
  if (checkedSpeechIndex < 0) return false;
  const checkedSpeech = input.previousSpeeches[checkedSpeechIndex];
  if (!checkedSpeech || !isDirectTargetAddress(input.speech, checkedSpeech)) return false;
  const followupsAfterChecked = input.previousSpeeches
    .slice(checkedSpeechIndex + 1)
    .filter((speech) => !speech.isFallback)
    .filter((speech) => speech.seatId !== claim.seatId && speech.seatId !== claim.checkedSeatId)
    .filter((speech) => detectAxes(speech.speech).includes("black-check") || isCheckedSeatSelfProofFollowup(speech.speech));
  if (followupsAfterChecked.length > 0) return false;
  return /(?:接法|第一反应|正面|身份|自证|不认|怎么活|台阶|装晕|硬扛|反打|质疑)/.test(input.speech);
}

function replaysCheckedSeatSelfProofAfterFollowup(input: ClassTrialSpeechQualityInput): boolean {
  const claim = findRecentBlackCheckClaim(input.previousSpeeches);
  if (!claim?.checkedSeatId) return false;
  const checkedSpeechIndex = input.previousSpeeches.findIndex((speech) => speech.seatId === claim.checkedSeatId);
  if (checkedSpeechIndex < 0) return false;
  const checkedSpeech = input.previousSpeeches[checkedSpeechIndex];
  if (!checkedSpeech || !isDirectTargetAddress(input.speech, checkedSpeech)) return false;
  const hasPriorFollower = input.previousSpeeches
    .slice(checkedSpeechIndex + 1)
    .filter((speech) => !speech.isFallback)
    .some(
      (speech) =>
        speech.seatId !== claim.seatId &&
        speech.seatId !== claim.checkedSeatId &&
        (detectAxes(speech.speech).includes("black-check") || isCheckedSeatSelfProofFollowup(speech.speech)),
    );
  if (!hasPriorFollower) return false;
  return /(?:没|没有|未)[^。！？；]{0,12}(?:接|说|报|给)[^。！？；]{0,20}(?:我不是狼|身份|自证|底牌)|身份[^。！？；]{0,8}(?:没|没有|未)[^。！？；]{0,12}(?:接|说|报|给)|怎么自证/.test(
    input.speech,
  );
}

function isCheckedSeatSelfProofFollowup(speech: string): boolean {
  return /(?:不认|没说|没报|没给|没有说|没有报|身份|自证|接法|怎么接|你倒是接|只说)/.test(speech);
}

function isDirectTargetAddress(sentence: string, target: ClassTrialSpeechQualityInput["previousSpeeches"][number]): boolean {
  const targetPattern = characterTargetLabels(target).map(escapeRegExp).join("|");
  return new RegExp(`(?:${targetPattern})[^。！？；]{0,10}(?:[，,:：。！？—-]|你|刚才|同学)`).test(sentence);
}

function pivotsBlackCheckAxisToSpecificNewTarget(
  input: ClassTrialSpeechQualityInput,
  recent: ClassTrialSpeechQualityInput["previousSpeeches"],
): boolean {
  if (
    !/(?:但|可是|不过|真正|让我停|停一下|更想|我先看|还有|等一下|不是|不在|转向|接完)/.test(input.speech)
  ) {
    return false;
  }

  const claim = findRecentBlackCheckClaim(recent);
  const excludedSeatIds = new Set([input.seatId, claim?.seatId, claim?.checkedSeatId].filter(isNumber));
  const possibleTargets = recent.filter((speech) => !excludedSeatIds.has(speech.seatId));
  if (possibleTargets.length === 0) return false;

  if (
    possibleTargets.some((target) => isDirectTargetAddress(input.speech, target)) &&
    /(?:替|帮)[^。！？；]{0,12}(?:盘|补|铺|圆|定调|降低|解释|合理性|作案动机|场子|台阶)|(?:盘|补完|补足)[^。！？；]{0,18}(?:合理性|动机|理由|缺口|标准)/.test(
      input.speech,
    )
  ) {
    return true;
  }

  return input.speech
    .split(/[。！？；]/)
    .filter(Boolean)
    .some(
      (sentence) =>
        /(?:票口|标准|台阶|藏身|接话|接完|太顺|舒服|没回答|结论|观察|帮|铺|推开|焦点|带着跑|停一下)/.test(
          sentence,
        ) && possibleTargets.some((target) => isSpecificPivotTarget(sentence, target)),
    );
}

function isSpecificPivotTarget(sentence: string, target: ClassTrialSpeechQualityInput["previousSpeeches"][number]): boolean {
  const targetLabels = characterTargetLabels(target).map(escapeRegExp);
  const targetPattern = targetLabels.join("|");
  return (
    new RegExp(`(?:${targetPattern})[^。！？；]{0,8}[，,:：]`).test(sentence) ||
    new RegExp(`不是[^。！？；]{0,16}是[^。！？；]{0,16}(?:${targetPattern})`).test(sentence) ||
    new RegExp(`(?:真正)?让我停[^。！？；]{0,24}(?:${targetPattern})`).test(sentence)
  );
}

function characterTargetLabels(target: ClassTrialSpeechQualityInput["previousSpeeches"][number]): string[] {
  const labels = [`${target.seatId}号`, target.name];
  const shortName = target.name.match(/^(江之岛|塞蕾丝|雾切|腐川|苗木|十神|高松|千早|黑白熊)/)?.[1];
  if (shortName) labels.push(shortName);
  return Array.from(new Set(labels.filter(Boolean)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function detectAxes(speech: string): string[] {
  return AXIS_PATTERNS.filter((item) => item.pattern.test(speech)).map((item) => item.axis);
}

function detectCharacterPresence(speech: string, liveIntentPresent: boolean): ClassTrialSpeechQualityResult["characterPresence"] {
  if (liveIntentPresent && CHARACTER_PRESENCE_PATTERN.test(speech)) return "strong";
  if (liveIntentPresent || CHARACTER_PRESENCE_PATTERN.test(speech)) return "clear";
  return "weak";
}

function hasSeatReference(speech: string): boolean {
  return /\d+\s*号|[一二三四五六七八九]号/.test(speech);
}

function hasRepeatedSentenceShape(speech: string, recent: ClassTrialSpeechQualityInput["previousSpeeches"]): boolean {
  const shape = sentenceShape(speech);
  return recent.some((item) => sentenceShape(item.speech) === shape);
}

function sentenceShape(speech: string): string {
  return speech
    .replace(/\d+\s*号/g, "N号")
    .replace(/[一二三四五六七八九]号/g, "N号")
    .replace(/[，。！？；：、,.!?;:]/g, "|")
    .split("|")
    .map((part) => {
      if (/我先|先/.test(part)) return "先";
      if (/查杀|验证|票型|结构|收益/.test(part)) return "抽象";
      if (/为什么|别|不认|反咬|压/.test(part)) return "动作";
      return part.trim().length > 0 ? "句" : "";
    })
    .filter(Boolean)
    .join("-");
}

function detectOveruseBans(speech: string, bans: string[]): string[] {
  return bans.filter((ban) =>
    ban
      .replace(/^不要反复说/, "")
      .replace(/^不要每次都/, "")
      .split(/[、，,]/)
      .some((token) => token.trim() && speech.includes(token.trim())),
  );
}

function finding(
  kind: ClassTrialAntiTemplateFindingKind,
  severity: ClassTrialAntiTemplateFinding["severity"],
  message: string,
  evidence: string[],
  repeatedWithSeatIds?: number[],
): ClassTrialAntiTemplateFinding {
  return {
    kind,
    severity,
    message,
    evidence,
    revisionDirection: REVISION_DIRECTIONS[kind],
    ...(repeatedWithSeatIds && repeatedWithSeatIds.length > 0 ? { repeatedWithSeatIds } : {}),
  };
}

function resolveViewerQuality(findings: ClassTrialAntiTemplateFinding[]): ClassTrialSpeechQualityResult["viewerQuality"] {
  if (findings.some((findingItem) => findingItem.severity === "high")) return "fail";
  if (findings.length > 0) return "warn";
  return "pass";
}

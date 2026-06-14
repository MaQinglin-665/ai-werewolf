import {
  extractClassTrialRoleClaimSignal,
  hasClassTrialHunterHardClaimSignal,
  hasClassTrialWitchSelfClaimDenial,
} from "./classTrialClaims";
import { ROLE_LABELS } from "./labels";
import type { ClaimCheck, ClaimStrength, Role, RoleClaim } from "./types";

type SpeechClaimDraft = {
  day: number;
  claimantSeatId: number;
  claimedRole: Role;
  strength: ClaimStrength;
  checks: ClaimCheck[];
  message: string;
  sourceSpeechSeq?: number;
};

const ROLE_CLAIM_GAP = "[^，,。！？!?；;：:\\n]{0,8}";
const SELF_INTRO_ROLE_CLAIM_GAP =
  "(?:(?:\\d{1,2}\\s*号)?[A-Za-z0-9_\\-\\u4e00-\\u9fa5]{1,24}[，,：:\\s]{1,4})?[^，,。！？!?；;：:\\n]{0,8}";
const SEAT_NAME_SELF_ROLE_PREFIX = "(?:^|[，,。！？!?；;：:\\s])(?:\\d{1,2}\\s*号)?[A-Za-z0-9_\\-\\u4e00-\\u9fa5]{1,24}[，,：:\\s]{1,4}";
const CLAIM_TARGET_LABEL = "(?:玩家|位|AI|[A-Za-z0-9_\\-\\u4e00-\\u9fa5]{0,24}?)?";
const CHECK_RESULT_TEXT = "(查杀(?!位|牌|线|结果)|金水(?!位|牌|线|结果)|狼人|好人|狼)";
const SELF_CHECK_RESULT_PREFIX = "[，,：:\\s]*(?:是|为|出)?\\s*(?:我(?:昨晚|昨夜|夜里|今晚)?(?:查验|验|查|摸)(?:出来)?的?|我的)?\\s*";
const OWN_CHECK_VERB_TEXT = "(?:查验|查验的是|查了|验了|验的是|摸了|我验|我查|报验)";
const REPORT_CHECK_VERB_TEXT =
  "(?:报过|报了|报出|报的是|报的|报|给过|给了|给出|给的是|给的|留过|留了|留下|留的是|留的|说过|说的是|说的|说|称)";
const OTHER_SUBJECT_CHECK_VERB_TEXT = `(?:${REPORT_CHECK_VERB_TEXT}|验过|查过|验了|查了|验|查)`;
const WITCH_DIRECT_ROLE_PATTERN = new RegExp(
  `(?:我是|我拍|(?<!在)我这里是|我底牌是|明牌|我这张|我作为)${ROLE_CLAIM_GAP}(?:女巫|女巫牌)`,
);
const WITCH_SELF_INTRO_ROLE_PATTERN = new RegExp(
  `(?:我是|我拍)${SELF_INTRO_ROLE_CLAIM_GAP}(?:女巫|女巫牌)(?:[，,。！？!?；;：:\\s]|$)`,
);
const WITCH_COLLOQUIAL_SELF_ROLE_PATTERN =
  /(?:^|[，,。！？!?；;：:\s])我(?:是)?\s*(?:女巫|女巫牌)(?:[，,。！？!?；;：:\s]|$)/;
const WITCH_CONCISE_SAVE_REPORT_PATTERN =
  /(?:^|[。！？；\n\s])(?:女巫|女巫牌)[，,：:\s]{0,8}(?:(?:昨晚|昨夜|夜里|首夜|第一晚)[^。！？；\n]{0,18})?(?:救了|救的是|救过|毒了|毒的是|银水|解药|毒药|药还在)/;

const WITCH_PUBLIC_MEDICINE_CONTEXT_PATTERNS = [
  /(?:\d{1,2}\s*号|[A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})[^。！？；\n]{0,24}(?:女巫声明|跳女巫|拍女巫|女巫身份|女巫牌)[^。！？；\n]{0,28}(?:我先认|先认|暂认|先不打|没人对跳|没有对跳|没对跳|目前没人对跳)/,
  /(?:不替|不能替|没法替|无法替|不帮|不能帮)[^。！？；\n]{0,18}(?:女巫)?[^。！？；\n]{0,18}(?:确认|报|认|定)[^。！？；\n]{0,12}(?:解药|毒药|药|银水)/,
  /(?:只按|按|当作|视作|看成|盘成)[^。！？；\n]{0,18}(?:平安夜|死亡形态|公开信息|公开形态|药线)[^。！？；\n]{0,18}(?:盘|推理|处理)?/,
  /(?:平安夜|死亡形态|公开药线|药线|女巫用药)[^。！？；\n]{0,24}(?:不等于|不是|并非|不能算|不能当成)[^。！？；\n]{0,18}(?:女巫声明|身份声明|我(?:明牌|拍)?女巫|自称女巫)/,
  /(?:我不|我没|我没有)[^。！？；\n]{0,10}(?:确认|报|认|定|知道)[^。！？；\n]{0,18}(?:解药|毒药|药线|银水|女巫)/,
];

const ROLE_PATTERNS: Array<{ role: Role; pattern: RegExp }> = [
  {
    role: "SEER",
    pattern: new RegExp(
      `我是${SELF_INTRO_ROLE_CLAIM_GAP}预言家|(?:我跳|我起跳|我拍|我这里是|我底牌是|明牌)${ROLE_CLAIM_GAP}预言家|${SEAT_NAME_SELF_ROLE_PREFIX}预言家|预言家${ROLE_CLAIM_GAP}(?:我来报验|我报验|我跳|我拍)|我报验人`,
    ),
  },
  {
    role: "WITCH",
    pattern: new RegExp(
      `${WITCH_DIRECT_ROLE_PATTERN.source}|${WITCH_SELF_INTRO_ROLE_PATTERN.source}|${WITCH_COLLOQUIAL_SELF_ROLE_PATTERN.source}|${WITCH_CONCISE_SAVE_REPORT_PATTERN.source}|我[^。！？!?\\n]{0,18}(?:药还在|解药|毒药|救过|救了|救的是|报(?:了)?银水|给(?:出)?银水|银水是)|(?:^|[，,。；;：:\\s])(?:药还在|解药还在|毒药还在)`,
    ),
  },
  {
    role: "HUNTER",
    pattern: new RegExp(`(?:我是|我拍|我这里是|我底牌是|明牌|我这张|我作为)${ROLE_CLAIM_GAP}(?:猎人|猎人牌)`),
  },
  {
    role: "IDIOT",
    pattern: new RegExp(`(?:我是|我拍|我这里是|我底牌是|明牌|我这张|我作为)${ROLE_CLAIM_GAP}(?:白痴|白痴牌)`),
  },
  {
    role: "KNIGHT",
    pattern: new RegExp(`(?:我是|我拍|我这里是|我底牌是|明牌|我这张|我作为)${ROLE_CLAIM_GAP}(?:骑士|骑士牌)`),
  },
  {
    role: "GUARD",
    pattern: new RegExp(`(?:我是|我拍|我这里是|我底牌是|明牌|我这张|我作为)${ROLE_CLAIM_GAP}(?:守卫|守卫牌)`),
  },
  {
    role: "VILLAGER",
    pattern: new RegExp(
      `(?:我是|我作为|作为(?:一张|一个)?|我这里是|我底牌是|明牌|我这张)${ROLE_CLAIM_GAP}(?:平民|平民牌|民牌)`,
    ),
  },
  {
    role: "WHITE_WOLF_KING",
    pattern: new RegExp(`(?:我是|我这里是|我底牌是|明牌|我这张)${ROLE_CLAIM_GAP}(?:白狼王|白狼王牌)`),
  },
  {
    role: "WOLF_BEAUTY",
    pattern: new RegExp(`(?:我是|我这里是|我底牌是|明牌|我这张)${ROLE_CLAIM_GAP}(?:狼美人|狼美人牌)`),
  },
  {
    role: "WOLF_KING",
    pattern: new RegExp(`(?:我是|我这里是|我底牌是|明牌|我这张)${ROLE_CLAIM_GAP}(?:狼王|狼王牌)`),
  },
  {
    role: "WEREWOLF",
    pattern: new RegExp(`(?:我是|我这里是|我底牌是)${ROLE_CLAIM_GAP}狼人`),
  },
];

export function extractRoleClaimFromSpeech(params: {
  day: number;
  claimantSeatId: number;
  message: string;
  validSeatIds: Set<number>;
  sourceSpeechSeq?: number;
  roleCard?: { theme?: string };
}): SpeechClaimDraft | undefined {
  const message = params.message.trim();
  const normalized = normalizeDigits(message);
  const isClassTrial = params.roleCard?.theme === "class-trial";
  const classTrialSignal = isClassTrial ? extractClassTrialRoleClaimSignal(normalized) : undefined;
  const explicitRole = ROLE_PATTERNS.find((item) => item.pattern.test(normalized))?.role;
  const supportedExplicitRole =
    explicitRole === "WITCH" && shouldSuppressWitchExplicitRoleClaim(normalized, classTrialSignal) ? undefined : explicitRole;
  const checks = extractClaimChecks({
    day: params.day,
    claimantSeatId: params.claimantSeatId,
    message: normalized,
    validSeatIds: params.validSeatIds,
    sourceSpeechSeq: params.sourceSpeechSeq,
  });
  const claimedRole =
    supportedExplicitRole ?? classTrialSignal?.claimedRole ?? (checks.length > 0 && hasSelfCheckCue(normalized) ? "SEER" : undefined);
  if (!claimedRole) return undefined;
  const classTrialStrength = classTrialSignal?.claimedRole === claimedRole ? classTrialSignal.strength : undefined;

  return {
    day: params.day,
    claimantSeatId: params.claimantSeatId,
    claimedRole,
    strength: classTrialStrength ?? inferClaimStrength(normalized, claimedRole),
    checks: checksForClaimedRole(claimedRole, checks),
    message,
    sourceSpeechSeq: params.sourceSpeechSeq,
  };
}

export function isSupportedRoleClaim(claim: Pick<RoleClaim, "claimedRole" | "message">): boolean {
  if (claim.claimedRole !== "HUNTER") return true;
  const normalized = normalizeDigits(claim.message);
  return /猎人/.test(normalized) || hasClassTrialHunterHardClaimSignal(normalized);
}

function shouldSuppressWitchExplicitRoleClaim(
  message: string,
  classTrialSignal: ReturnType<typeof extractClassTrialRoleClaimSignal>,
): boolean {
  if (classTrialSignal?.claimedRole === "WITCH") return false;
  if (hasClassTrialWitchSelfClaimDenial(message)) return true;
  if (isRecognizingAnotherWitchClaim(message)) return true;
  if (WITCH_DIRECT_ROLE_PATTERN.test(message)) return false;
  return WITCH_PUBLIC_MEDICINE_CONTEXT_PATTERNS.some((pattern) => pattern.test(message));
}

function isRecognizingAnotherWitchClaim(message: string): boolean {
  return /(?:\d{1,2}\s*号|[A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})[^。！？；\n]{0,36}(?:女巫声明|跳女巫|拍女巫|女巫身份|女巫牌)[^。！？；\n]{0,64}(?:我先认|先认|暂认|暂时先认|先当真女巫听|没人对跳|没有对跳|没对跳|目前没人对跳|具体银水目标|报(?:了)?银水|给(?:出)?银水)/.test(
    message,
  );
}

export function upsertRoleClaim(existingClaims: RoleClaim[], draft: SpeechClaimDraft): RoleClaim {
  const claimId = `${draft.claimantSeatId}:${draft.claimedRole}`;
  const existing = existingClaims.find((claim) => claim.id === claimId);
  if (!existing) {
    const claim: RoleClaim = {
      id: claimId,
      day: draft.day,
      claimantSeatId: draft.claimantSeatId,
      claimedRole: draft.claimedRole,
      strength: draft.strength,
      checks: checksForClaimedRole(draft.claimedRole, draft.checks),
      message: draft.message,
      sourceSpeechSeq: draft.sourceSpeechSeq,
      updatedAtSeq: draft.sourceSpeechSeq,
    };
    existingClaims.push(claim);
    return claim;
  }

  existing.strength = existing.strength === "hard" || draft.strength === "hard" ? "hard" : "soft";
  existing.checks = checksForClaimedRole(existing.claimedRole, [...existing.checks, ...draft.checks]);
  existing.message = draft.message;
  existing.sourceSpeechSeq = draft.sourceSpeechSeq ?? existing.sourceSpeechSeq;
  existing.updatedAtSeq = draft.sourceSpeechSeq ?? existing.updatedAtSeq;
  return existing;
}

export function describeRoleClaim(claim: RoleClaim, claimantName: string): string {
  const roleText = ROLE_LABELS[claim.claimedRole];
  const strengthText = claim.strength === "hard" ? "明确声称" : "软声明";
  const checks = checksForClaimedRole(claim.claimedRole, claim.checks);
  const checkText =
    checks.length > 0
      ? `，并报出${checks
          .map((check) => `${check.targetSeatId}号${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
          .join("、")}`
      : "";
  return `${claimantName} ${strengthText}自己是${roleText}${checkText}。`;
}

function extractClaimChecks(params: {
  day: number;
  claimantSeatId: number;
  message: string;
  validSeatIds: Set<number>;
  sourceSpeechSeq?: number;
}): ClaimCheck[] {
  const checks: ClaimCheck[] = [];
  const patterns = [
    new RegExp(
      `${OWN_CHECK_VERB_TEXT}.{0,12}?(\\d{1,2})\\s*号${CLAIM_TARGET_LABEL}${SELF_CHECK_RESULT_PREFIX}${CHECK_RESULT_TEXT}`,
      "g",
    ),
    new RegExp(
      `${OWN_CHECK_VERB_TEXT}.{0,18}?(\\d{1,2})\\s*号${CLAIM_TARGET_LABEL}[\\s,，:：\\-—－]{1,8}(?:${CLAIM_TARGET_LABEL}[\\s,，:：\\-—－]{1,8})?(?:他|她|TA|ta|这个位置|这张牌|结果)?\\s*(?:是|为)?\\s*${CHECK_RESULT_TEXT}`,
      "g",
    ),
    new RegExp(`(\\d{1,2})\\s*号${CLAIM_TARGET_LABEL}${SELF_CHECK_RESULT_PREFIX}${CHECK_RESULT_TEXT}`, "g"),
    new RegExp(
      `(\\d{1,2})\\s*号${CLAIM_TARGET_LABEL}[\\s,，:：\\-—－]{1,8}(?:我(?:昨晚|昨夜|夜里|今晚)?(?:查验|验|查|摸)(?:出来)?(?:的是|的)?(?:你|他|她|TA|ta)|(?:昨晚|昨夜|夜里|今晚)?(?:查验|验|查|摸)(?:的是|的)?(?:你|他|她|TA|ta))[\\s,，:：\\-—－]{1,8}${CHECK_RESULT_TEXT}`,
      "g",
    ),
  ];

  for (const pattern of patterns) {
    for (const match of params.message.matchAll(pattern)) {
      const targetSeatId = Number(match[1]);
      const resultText = match[2];
      const targetTokenOffset = match[0].indexOf(match[1]);
      if (
        isReferencedOtherClaimantCheck({
          message: params.message,
          matchIndex: match.index ?? 0,
          matchedPrefixBeforeTarget: targetTokenOffset >= 0 ? match[0].slice(0, targetTokenOffset) : "",
          targetSeatId,
          claimantSeatId: params.claimantSeatId,
        })
      ) {
        continue;
      }
      if (!params.validSeatIds.has(targetSeatId)) continue;
      if (targetSeatId === params.claimantSeatId) continue;
      checks.push({
        day: params.day,
        claimantSeatId: params.claimantSeatId,
        targetSeatId,
        result: resultText === "查杀" || resultText === "狼人" || resultText === "狼" ? "WEREWOLF" : "GOOD",
        sourceSpeechSeq: params.sourceSpeechSeq,
      });
    }
  }

  return dedupeChecks(checks);
}

function isReferencedOtherClaimantCheck(params: {
  message: string;
  matchIndex: number;
  matchedPrefixBeforeTarget: string;
  targetSeatId: number;
  claimantSeatId: number;
}): boolean {
  const sentenceStart = findLastSentenceBoundary(params.message, params.matchIndex);
  const sentenceEnd = findNextSentenceBoundary(params.message, params.matchIndex);
  const clauseStart = Math.max(sentenceStart, findLastClaimAttributionClauseBoundary(params.message, params.matchIndex));
  const sentence = params.message.slice(clauseStart, sentenceEnd);
  if (
    sentenceReferencesOtherClaimCheck({
      sentence,
      targetSeatId: params.targetSeatId,
      claimantSeatId: params.claimantSeatId,
    })
  ) {
    return true;
  }

  const prefix = `${params.message.slice(clauseStart, params.matchIndex)}${params.matchedPrefixBeforeTarget}`;
  const otherSubjectVerbTail = new RegExp(`${OTHER_SUBJECT_CHECK_VERB_TEXT}\\s*$`);
  if (!otherSubjectVerbTail.test(prefix)) return false;
  if (new RegExp(`(?:我|自己|本人)[^。！？!?；;\\n]{0,18}${OWN_CHECK_VERB_TEXT}\\s*$`).test(prefix)) {
    return false;
  }

  const explicitSeatIds = [...prefix.matchAll(/(\d{1,2})\s*号/g)].map((match) => Number(match[1]));
  const lastExplicitSeatId = explicitSeatIds.at(-1);
  if (lastExplicitSeatId === params.claimantSeatId && !/[他她]|TA|ta/.test(prefix)) return false;

  return new RegExp(`(?:\\d{1,2}\\s*号|他|她|TA|ta)[^。！？!?；;\\n]{0,32}${OTHER_SUBJECT_CHECK_VERB_TEXT}\\s*$`).test(prefix);
}

function findLastClaimAttributionClauseBoundary(message: string, beforeIndex: number): number {
  const prefix = message.slice(0, beforeIndex);
  const boundaries = ["，", ",", "、", "：", ":", "—", "－", "-"];
  return Math.max(...boundaries.map((boundary) => prefix.lastIndexOf(boundary))) + 1;
}

function findLastSentenceBoundary(message: string, beforeIndex: number): number {
  const prefix = message.slice(0, beforeIndex);
  const boundaries = ["。", "！", "!", "？", "?", "；", ";", "\n"];
  return Math.max(...boundaries.map((boundary) => prefix.lastIndexOf(boundary))) + 1;
}

function findNextSentenceBoundary(message: string, fromIndex: number): number {
  const suffix = message.slice(fromIndex);
  const boundaries = ["。", "！", "!", "？", "?", "；", ";", "\n"]
    .map((boundary) => suffix.indexOf(boundary))
    .filter((index) => index >= 0);
  if (boundaries.length === 0) return message.length;
  return fromIndex + Math.min(...boundaries);
}

function sentenceReferencesOtherClaimCheck(params: {
  sentence: string;
  targetSeatId: number;
  claimantSeatId: number;
}): boolean {
  const roleCue = "(?:(?:跳|起跳|拍|悍跳|对跳)[^。！？!?；;\\n]{0,10})?(?:预言家[^。！？!?；;\\n]{0,12})?";
  const targetCue = `${params.targetSeatId}\\s*号`;
  if (params.targetSeatId !== params.claimantSeatId) {
    const targetAsSubjectPattern = new RegExp(
      `${targetCue}[^。！？!?；;\\n]{0,32}${REPORT_CHECK_VERB_TEXT}[^。！？!?；;\\n]{0,10}${CHECK_RESULT_TEXT}`,
    );
    if (targetAsSubjectPattern.test(params.sentence)) return true;
  }

  const explicitSubjectPattern = new RegExp(
    `(\\d{1,2})\\s*号[^。！？!?；;\\n]{0,48}${roleCue}${OTHER_SUBJECT_CHECK_VERB_TEXT}[^。！？!?；;\\n]{0,8}${targetCue}`,
    "g",
  );
  for (const match of params.sentence.matchAll(explicitSubjectPattern)) {
    if (Number(match[1]) !== params.claimantSeatId) return true;
  }

  return new RegExp(
    `(?:他|她|TA|ta)[^。！？!?；;\\n]{0,48}${roleCue}${OTHER_SUBJECT_CHECK_VERB_TEXT}[^。！？!?；;\\n]{0,8}${targetCue}`,
  ).test(params.sentence);
}

function inferClaimStrength(message: string, role: Role): ClaimStrength {
  if (role === "SEER" && hasExplicitHardSeerClaim(message)) return "hard";
  if (role === "WITCH" && hasExplicitHardWitchClaim(message)) return "hard";
  if (hasExplicitHardNonSeerRoleClaim(message, role)) return "hard";
  if (/软|不跳|不拍|不明说|不急着跳|底牌不虚|偏神|神职/.test(message)) return "soft";
  if (role === "SEER" || /我是|我跳|我起跳|我拍|我这里是|我这张|明牌|我底牌是/.test(message)) return "hard";
  return "soft";
}

function hasExplicitHardWitchClaim(message: string): boolean {
  return (
    WITCH_DIRECT_ROLE_PATTERN.test(message) ||
    WITCH_COLLOQUIAL_SELF_ROLE_PATTERN.test(message) ||
    WITCH_CONCISE_SAVE_REPORT_PATTERN.test(message)
  );
}

function hasExplicitHardNonSeerRoleClaim(message: string, role: Role): boolean {
  const roleWords: Partial<Record<Role, string>> = {
    HUNTER: "(?:猎人|猎人牌)",
    IDIOT: "(?:白痴|白痴牌)",
    KNIGHT: "(?:骑士|骑士牌)",
    GUARD: "(?:守卫|守卫牌)",
    VILLAGER: "(?:平民|平民牌|民牌)",
    WHITE_WOLF_KING: "(?:白狼王|白狼王牌)",
    WOLF_BEAUTY: "(?:狼美人|狼美人牌)",
    WOLF_KING: "(?:狼王|狼王牌)",
    WEREWOLF: "狼人",
  };
  const rolePattern = roleWords[role];
  if (!rolePattern) return false;
  return new RegExp(
    `(?:我是|我跳|我起跳|我拍|我这里是|我底牌是|明牌|我这张|我作为)${SELF_INTRO_ROLE_CLAIM_GAP}${rolePattern}`,
  ).test(message);
}

function hasExplicitHardSeerClaim(message: string): boolean {
  return new RegExp(
    `我是${SELF_INTRO_ROLE_CLAIM_GAP}预言家|(?:我跳|我起跳|我拍|我这里是|我底牌是|明牌)${ROLE_CLAIM_GAP}预言家|${SEAT_NAME_SELF_ROLE_PREFIX}预言家|预言家${ROLE_CLAIM_GAP}(?:我来报验|我报验|我跳|我拍)|我报验人`,
  ).test(message);
}

function hasSelfCheckCue(message: string): boolean {
  return (
    /我(?:来)?(?:报验|报|验了|验|查验|查了|查|摸了|给).{0,18}(\d{1,2})\s*号/.test(message) ||
    /我的(?:查验结果|验人结果|查验信息|验人信息)/.test(message) ||
    /这就是我的(?:查验结果|验人结果|查验信息|验人信息)/.test(message) ||
    /我的(?:查杀|金水).{0,10}(\d{1,2})\s*号/.test(message) ||
    /(\d{1,2})\s*号(?:玩家|位|AI)?.{0,6}是我的(?:查杀|金水)/.test(message)
  );
}

function dedupeChecks(checks: ClaimCheck[]): ClaimCheck[] {
  const seen = new Set<string>();
  return checks.filter((check) => {
    const key = `${check.claimantSeatId}:${check.targetSeatId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checksForClaimedRole(role: Role, checks: ClaimCheck[]): ClaimCheck[] {
  return role === "SEER" ? dedupeChecks(checks) : [];
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

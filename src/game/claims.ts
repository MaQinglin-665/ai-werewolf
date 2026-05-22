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

const ROLE_PATTERNS: Array<{ role: Role; pattern: RegExp }> = [
  {
    role: "SEER",
    pattern: new RegExp(
      `(?:我是|我跳|我起跳|我拍|我认|我这里是|我底牌是|明牌)${ROLE_CLAIM_GAP}预言家|预言家${ROLE_CLAIM_GAP}(?:我来报验|我报验|我跳|我拍)|我报验人`,
    ),
  },
  {
    role: "WITCH",
    pattern: new RegExp(
      `(?:我是|我拍|我这里是|我底牌是|明牌|我这张|我作为)${ROLE_CLAIM_GAP}(?:女巫|女巫牌)|我[^。！？!?\\n]{0,18}(?:药还在|解药|毒药|救过|银水)|(?:^|[，,。；;：:\\s])(?:药还在|解药还在|毒药还在)`,
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
}): SpeechClaimDraft | undefined {
  const message = params.message.trim();
  const normalized = normalizeDigits(message);
  const explicitRole = ROLE_PATTERNS.find((item) => item.pattern.test(normalized))?.role;
  const checks = extractClaimChecks({
    day: params.day,
    claimantSeatId: params.claimantSeatId,
    message: normalized,
    validSeatIds: params.validSeatIds,
    sourceSpeechSeq: params.sourceSpeechSeq,
  });
  const claimedRole = explicitRole ?? (checks.length > 0 && hasSelfCheckCue(normalized) ? "SEER" : undefined);
  if (!claimedRole) return undefined;

  return {
    day: params.day,
    claimantSeatId: params.claimantSeatId,
    claimedRole,
    strength: inferClaimStrength(normalized, claimedRole),
    checks,
    message,
    sourceSpeechSeq: params.sourceSpeechSeq,
  };
}

export function isSupportedRoleClaim(claim: Pick<RoleClaim, "claimedRole" | "message">): boolean {
  if (claim.claimedRole !== "HUNTER") return true;
  return /猎人/.test(normalizeDigits(claim.message));
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
      checks: dedupeChecks(draft.checks),
      message: draft.message,
      sourceSpeechSeq: draft.sourceSpeechSeq,
      updatedAtSeq: draft.sourceSpeechSeq,
    };
    existingClaims.push(claim);
    return claim;
  }

  existing.strength = existing.strength === "hard" || draft.strength === "hard" ? "hard" : "soft";
  existing.checks = dedupeChecks([...existing.checks, ...draft.checks]);
  existing.message = draft.message;
  existing.sourceSpeechSeq = draft.sourceSpeechSeq ?? existing.sourceSpeechSeq;
  existing.updatedAtSeq = draft.sourceSpeechSeq ?? existing.updatedAtSeq;
  return existing;
}

export function describeRoleClaim(claim: RoleClaim, claimantName: string): string {
  const roleText = ROLE_LABELS[claim.claimedRole];
  const strengthText = claim.strength === "hard" ? "明确声称" : "软声明";
  const checkText =
    claim.checks.length > 0
      ? `，并报出${claim.checks
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
    /(?:查验|查验的是|查了|验了|验的是|摸了|我验|我查|报验).{0,12}?(\d{1,2})\s*号(?:玩家|位|AI|[A-Za-z0-9\u4e00-\u9fa5]{0,12})?[，,：:\s]*(?:是|为|出)?\s*(查杀|金水|狼人|好人)/g,
    /(\d{1,2})\s*号(?:玩家|位|AI|[A-Za-z0-9\u4e00-\u9fa5]{0,12})?[，,：:\s]*(?:是|为|出)?\s*(查杀|金水|狼人|好人)/g,
  ];

  for (const pattern of patterns) {
    for (const match of params.message.matchAll(pattern)) {
      const targetSeatId = Number(match[1]);
      const resultText = match[2];
      if (!params.validSeatIds.has(targetSeatId)) continue;
      if (targetSeatId === params.claimantSeatId) continue;
      checks.push({
        day: params.day,
        claimantSeatId: params.claimantSeatId,
        targetSeatId,
        result: resultText === "查杀" || resultText === "狼人" ? "WEREWOLF" : "GOOD",
        sourceSpeechSeq: params.sourceSpeechSeq,
      });
    }
  }

  return dedupeChecks(checks);
}

function inferClaimStrength(message: string, role: Role): ClaimStrength {
  if (/软|不跳|不拍|不明说|不急着跳|底牌不虚|偏神|神职/.test(message)) return "soft";
  if (role === "SEER" || /我是|我跳|我起跳|我拍|我这里是|我这张|明牌|我底牌是/.test(message)) return "hard";
  return "soft";
}

function hasSelfCheckCue(message: string): boolean {
  return (
    /我(?:来)?(?:报验|报|验了|验|查验|查了|查|摸了|给).{0,18}(\d{1,2})\s*号/.test(message) ||
    /我的(?:查杀|金水).{0,10}(\d{1,2})\s*号/.test(message) ||
    /(\d{1,2})\s*号(?:玩家|位|AI)?.{0,6}是我的(?:查杀|金水)/.test(message)
  );
}

function dedupeChecks(checks: ClaimCheck[]): ClaimCheck[] {
  const seen = new Set<string>();
  return checks.filter((check) => {
    const key = `${check.claimantSeatId}:${check.targetSeatId}:${check.result}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

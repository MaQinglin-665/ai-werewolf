import type { ClaimStrength, Role } from "./types";

export type ClassTrialRoleClaimSignal = {
  claimedRole: Role;
  strength: ClaimStrength;
  reason: string;
};

const WITCH_HARD_CLAIM_PATTERNS = [
  /(?:^|[。！？；，,\s])女巫在这里(?:[。！？；，,\s]|$)/,
  /(?:我|这边|这里)[^。！？；\n]{0,18}(?:明牌|拍|摊开|亮出)[^。！？；\n]{0,12}(?:女巫|女巫牌|这张牌)/,
  /(?:女巫|女巫牌|这张牌)[^。！？；\n]{0,18}(?:明牌|拍|摊开|亮出来|在这里)/,
  /(?:药|解药|毒药)[^。！？；\n]{0,14}(?:握在我手|在我手|还在我手|我手上|我这里还在)/,
  /(?:不是暗示|不是绕话|不是试探)[^。！？；\n]{0,16}(?:女巫|明牌)/,
];

const WITCH_REASONING_NEGATIONS = [
  /(?:不是|不等于|并非)[^。！？；\n]{0,16}(?:我明牌女巫|我拍女巫|女巫声明|自称女巫)/,
  /(?:更像|像是|按|当成|视作)[^。！？；\n]{0,18}(?:女巫用药|药线|死亡形态)/,
];

const WITCH_SELF_CLAIM_DENIALS = [
  /(?:不是|不等于|并非)我?(?:明牌女巫|拍女巫|女巫声明|自称女巫)/,
];

const SEER_HARD_CLAIM_PATTERNS = [
  /(?:我|这边|这里)[^。！？；\n]{0,18}(?:把|将)[^。！？；\n]{0,12}(?:预言家牌|查验牌)[^。！？；\n]{0,12}(?:摊开|亮出|拍出来)/,
  /(?:这不是暗示|我不藏了)[^。！？；\n]{0,18}(?:预言家|查验)/,
];

const HUNTER_HARD_CLAIM_PATTERNS = [
  /(?:猎人|枪)[^。！？；\n]{0,18}(?:在这里|明牌|摊开|拍出来)/,
  /(?:别|不要)[^。！？；\n]{0,12}逼我[^。！？；\n]{0,12}(?:开枪|带人)/,
];

export function extractClassTrialRoleClaimSignal(message: string): ClassTrialRoleClaimSignal | undefined {
  const normalized = normalizeDigits(message);
  const hasWitchHardClaim = WITCH_HARD_CLAIM_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasWitchHardClaim && !hasClassTrialWitchSelfClaimDenial(normalized)) {
    return { claimedRole: "WITCH", strength: "hard", reason: "class-trial-dramatic-witch" };
  }
  if (hasClassTrialWitchReasoningNegation(normalized)) return undefined;
  if (SEER_HARD_CLAIM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { claimedRole: "SEER", strength: "hard", reason: "class-trial-dramatic-seer" };
  }
  if (hasClassTrialHunterHardClaimSignal(normalized)) {
    return { claimedRole: "HUNTER", strength: "hard", reason: "class-trial-dramatic-hunter" };
  }
  return undefined;
}

export function hasClassTrialHunterHardClaimSignal(message: string): boolean {
  const normalized = normalizeDigits(message);
  return HUNTER_HARD_CLAIM_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function hasClassTrialWitchReasoningNegation(message: string): boolean {
  const normalized = normalizeDigits(message);
  return WITCH_REASONING_NEGATIONS.some((pattern) => pattern.test(normalized));
}

function hasClassTrialWitchSelfClaimDenial(message: string): boolean {
  const normalized = normalizeDigits(message);
  return WITCH_SELF_CLAIM_DENIALS.some((pattern) => pattern.test(normalized));
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

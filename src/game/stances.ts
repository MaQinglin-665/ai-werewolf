import { ROLE_LABELS } from "./labels";
import type { PublicStance, Role, StanceKind } from "./types";

type StanceDraft = Omit<PublicStance, "id">;

const STANCE_LABELS: Record<StanceKind, string> = {
  SUPPORT: "支持",
  QUESTION: "质疑",
  PRESSURE: "施压",
  FOLLOW: "跟票",
};

export function stanceKindLabel(kind: StanceKind): string {
  return STANCE_LABELS[kind];
}

export function extractStancesFromSpeech(params: {
  day: number;
  actorSeatId: number;
  message: string;
  validSeatIds: Set<number>;
  sourceSpeechSeq?: number;
}): PublicStance[] {
  const message = normalizeDigits(params.message.trim());
  const drafts = [
    ...extractSupportStances(params, message),
    ...extractQuestionStances(params, message),
    ...extractPressureStances(params, message),
    ...extractFollowStances(params, message),
  ];
  const seen = new Set<string>();

  return drafts.filter((draft) => {
    const key = `${draft.actorSeatId}:${draft.targetSeatId}:${draft.kind}:${draft.targetRole ?? "ANY"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((draft, index) => ({
    ...draft,
    id: `${draft.actorSeatId}:${draft.targetSeatId}:${draft.kind}:${draft.targetRole ?? "ANY"}:${draft.sourceSpeechSeq ?? draft.day}:${index}`,
  }));
}

export function describeStance(stance: PublicStance, actorName: string, targetName: string): string {
  const roleText = stance.targetRole ? `${ROLE_LABELS[stance.targetRole]}` : "";
  const targetText = roleText ? `${targetName}的${roleText}` : targetName;
  return `${actorName}${STANCE_LABELS[stance.kind]}${targetText}：${stance.reason}。`;
}

function extractSupportStances(
  params: { day: number; actorSeatId: number; validSeatIds: Set<number>; sourceSpeechSeq?: number },
  message: string,
): StanceDraft[] {
  const stances: StanceDraft[] = [];
  const patterns = [
    /(我认|认下|(?<!不)认|我站|站边|相信|保一下|先放)\s*(\d{1,2})\s*号(?:玩家|位|AI)?(?:的)?(预言家|真预言家|预|身份|视角|守卫|白痴)?/g,
    /(\d{1,2})\s*号(?:玩家|位|AI)?(?:的)?(预言家|真预言家|预|身份|视角|守卫|白痴).{0,8}(我认|可信|先放|别出)/g,
  ];

  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      const targetSeatId = firstSeatId(match);
      const roleText = [...match].find((item) => item && /预言家|真预言家|预|身份|视角|守卫|白痴/.test(item));
      const targetRole = readTargetRole(roleText);
      if (!targetSeatId || !isValidTarget(params, targetSeatId)) continue;
      stances.push(buildDraft(params, targetSeatId, "SUPPORT", targetRole, "公开表示认可这个位置"));
    }
  }

  return stances;
}

function extractQuestionStances(
  params: { day: number; actorSeatId: number; validSeatIds: Set<number>; sourceSpeechSeq?: number },
  message: string,
): StanceDraft[] {
  const stances: StanceDraft[] = [];
  const patterns = [
    /(不认|不信|质疑|怀疑|不太信)\s*(\d{1,2})\s*号(?:玩家|位|AI)?(?:的)?(预言家|真预言家|预|身份|视角|守卫|白痴)?/g,
    /(\d{1,2})\s*号(?:玩家|位|AI)?.{0,10}(不做好|可疑|像狼|逻辑不顺|回避|矛盾)/g,
  ];

  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      const targetSeatId = firstSeatId(match);
      const roleText = [...match].find((item) => item && /预言家|真预言家|预|身份|视角|守卫|白痴/.test(item));
      const targetRole = readTargetRole(roleText);
      if (!targetSeatId || !isValidTarget(params, targetSeatId)) continue;
      stances.push(buildDraft(params, targetSeatId, "QUESTION", targetRole, "公开质疑这个位置"));
    }
  }

  return stances;
}

function extractPressureStances(
  params: { day: number; actorSeatId: number; validSeatIds: Set<number>; sourceSpeechSeq?: number },
  message: string,
): StanceDraft[] {
  const stances: StanceDraft[] = [];
  const patterns = [
    /(压|打|投|出|归票|抗推)\s*(\d{1,2})\s*号(?:玩家|位|AI)?/g,
    /(\d{1,2})\s*号(?:玩家|位|AI)?.{0,8}(查杀|需要解释|给过程|补逻辑|先出|归票)/g,
  ];

  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      const targetSeatId = firstSeatId(match);
      if (!targetSeatId || !isValidTarget(params, targetSeatId)) continue;
      stances.push(buildDraft(params, targetSeatId, "PRESSURE", undefined, "公开把压力给到这个位置"));
    }
  }

  return stances;
}

function extractFollowStances(
  params: { day: number; actorSeatId: number; validSeatIds: Set<number>; sourceSpeechSeq?: number },
  message: string,
): StanceDraft[] {
  const stances: StanceDraft[] = [];
  const pattern = /(跟|跟票|票跟|归票跟|今天跟)\s*(\d{1,2})\s*号(?:玩家|位|AI)?/g;

  for (const match of message.matchAll(pattern)) {
    const targetSeatId = Number(match[2]);
    if (!isValidTarget(params, targetSeatId)) continue;
    stances.push(buildDraft(params, targetSeatId, "FOLLOW", undefined, "公开表示投票会跟随这个位置"));
  }

  return stances;
}

function buildDraft(
  params: { day: number; actorSeatId: number; sourceSpeechSeq?: number },
  targetSeatId: number,
  kind: StanceKind,
  targetRole: Role | undefined,
  reason: string,
): StanceDraft {
  return {
    day: params.day,
    actorSeatId: params.actorSeatId,
    targetSeatId,
    kind,
    targetRole,
    reason,
    message: reason,
    sourceSpeechSeq: params.sourceSpeechSeq,
    updatedAtSeq: params.sourceSpeechSeq,
  };
}

function readTargetRole(text: string | undefined): Role | undefined {
  if (!text) return undefined;
  if (/预言家|真预言家|预/.test(text)) return "SEER";
  if (/女巫/.test(text)) return "WITCH";
  if (/猎人/.test(text)) return "HUNTER";
  if (/白痴/.test(text)) return "IDIOT";
  if (/守卫/.test(text)) return "GUARD";
  if (/平民|民牌/.test(text)) return "VILLAGER";
  return undefined;
}

function firstSeatId(match: RegExpMatchArray): number | undefined {
  for (let index = 1; index < match.length; index += 1) {
    const value = Number(match[index]);
    if (Number.isInteger(value) && value >= 1 && value <= 20) return value;
  }
  return undefined;
}

function isValidTarget(
  params: { actorSeatId: number; validSeatIds: Set<number> },
  targetSeatId: number,
): boolean {
  return params.validSeatIds.has(targetSeatId) && targetSeatId !== params.actorSeatId;
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

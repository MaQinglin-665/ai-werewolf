import { getDefaultAiFriends } from "@/game/aiFriends";
import type { AiFriendConfig, Role } from "@/game/types";

export type LlmQualityIssueCode =
  | "absolute_no_kill_claim"
  | "death_cause_overclaim"
  | "speech_vote_discontinuity"
  | "overcertain_without_evidence"
  | "malformed_output_fragment"
  | "english_output_fragment";

export type LlmQualityIssue = {
  code: LlmQualityIssueCode;
  severity: "warn" | "error";
  detail: string;
};

export type LlmCallQualityInput = {
  outputText: string;
  phase: string;
  task: "speech" | "action";
  reasoningCueCount?: number;
  referencedReasoningCueCount?: number;
  voteTargetSeatId?: number;
  lastSpeechTargetSeatId?: number;
  myRole?: Role;
  witchKnownTargets?: {
    currentVictimSeatId?: number;
    savedTargetSeatId?: number;
    poisonedTargetSeatId?: number;
  };
};

export type LlmQualitySummary = {
  totalQualityIssues: number;
  byQualityIssue: Partial<Record<LlmQualityIssueCode, number>>;
};

export type LlmRetryIssueCode =
  | "json_format"
  | "speech_vote_continuity"
  | "candidate_selection"
  | "overcertainty"
  | "malformed_output"
  | "private_leak"
  | "provider_request"
  | "other_validation"
  | "unknown_retry";

export type LlmRetryIssueSummary = {
  retryIssueCallCount: number;
  byRetryIssue: Partial<Record<LlmRetryIssueCode, number>>;
};

export type LlmOptimizationRecommendation = {
  priority: "high" | "medium" | "low";
  area:
    | "safety_boundary"
    | "prompt_contract"
    | "decision_continuity"
    | "provider_stability"
    | "reasoning_tone"
    | "sample_size";
  title: string;
  detail: string;
  nextStep: string;
  evidence: string[];
};

export type LlmOptimizationRecommendationInput = Partial<LlmQualitySummary & LlmRetryIssueSummary> & {
  totalCalls?: number;
  fallbackCount?: number;
  errorCount?: number;
  validationFailureCount?: number;
};

export type LlmAttemptDiagnostic = {
  attempt: number;
  provider?: string;
  issue?: string;
  validationErrors?: string[];
  rawOutput?: unknown;
};

export type LlmAttemptDiagnosticSummary = {
  attempt: number;
  provider?: string;
  issue: string;
  validationErrors: string[];
  rawOutputSnippet?: string;
};

type LlmRetryIssueSource = {
  issue?: string;
  validationErrors?: string[];
  attempt?: number;
  provider?: string;
  rawOutputSnippet?: string;
};

export function buildLlmEvaluationFriends(options: {
  models: string[];
  baseUrl: string;
  count: number;
  defaults?: AiFriendConfig[];
}): AiFriendConfig[] {
  const models = options.models.map((model) => model.trim()).filter(Boolean);
  if (models.length === 0 || options.count <= 0) return [];

  const defaults = options.defaults && options.defaults.length > 0 ? options.defaults : getDefaultAiFriends("llm-eval");
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");

  return Array.from({ length: options.count }, (_, index) => {
    const base = defaults[index % defaults.length]!;
    const model = models[index % models.length]!;
    const now = "llm-eval";
    return {
      ...base,
      id: `llm-eval:${index + 1}:${sanitizeId(model)}`,
      nickname: buildEvaluationNickname(base.nickname, model, index),
      llmConfig: {
        provider: "openai-compatible",
        label: model,
        baseUrl,
        model,
        mergeSystemIntoUser: true,
      },
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function analyzeLlmCallQuality(input: LlmCallQualityInput): LlmQualityIssue[] {
  const text = normalizeSpaces(input.outputText);
  const issues: LlmQualityIssue[] = [];

  if (hasAbsoluteNoKillClaim(text)) {
    issues.push({
      code: "absolute_no_kill_claim",
      severity: "error",
      detail: "把狼人空刀说成规则不可能，而不是低概率近似忽略。",
    });
  }

  if (hasDeathCauseOverclaim(input, text)) {
    issues.push({
      code: "death_cause_overclaim",
      severity: "error",
      detail: "把公开死讯推断说成具体刀口、救人目标或药量事实。",
    });
  }

  if (hasSpeechVoteDiscontinuity(input, text)) {
    issues.push({
      code: "speech_vote_discontinuity",
      severity: "warn",
      detail: "投票没有承接上一轮发言目标，也没有解释为什么公开证据足以转票。",
    });
  }

  if (hasOvercertainClaimWithoutEvidence(input, text)) {
    issues.push({
      code: "overcertain_without_evidence",
      severity: "warn",
      detail: "在未引用公开线索时使用铁狼、必狼、百分百等过度确定措辞。",
    });
  }

  if (hasMalformedOutputFragment(text)) {
    issues.push({
      code: "malformed_output_fragment",
      severity: "warn",
      detail: "输出文本残留 JSON 标点或截断片段，读起来不像自然公开发言/理由。",
    });
  }

  if (hasEnglishOutputFragment(text)) {
    issues.push({
      code: "english_output_fragment",
      severity: "warn",
      detail: "输出文本残留英文半句或内部英文提示，不像自然中文牌桌理由。",
    });
  }

  return issues;
}

export function summarizeLlmQuality(calls: Array<{ qualityIssues?: LlmQualityIssue[] }>): LlmQualitySummary {
  const issues = calls.flatMap((call) => call.qualityIssues ?? []);
  return {
    totalQualityIssues: issues.length,
    byQualityIssue: issues.reduce<Partial<Record<LlmQualityIssueCode, number>>>((acc, issue) => {
      acc[issue.code] = (acc[issue.code] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function classifyLlmRetryIssueCodes(
  attempts: LlmRetryIssueSource[],
): LlmRetryIssueCode[] {
  const codes: LlmRetryIssueCode[] = [];
  for (const attempt of attempts) {
    const code = classifyLlmRetryIssue(attempt);
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

export function summarizeLlmRetryIssues(calls: Array<{ retryIssueCodes?: LlmRetryIssueCode[] }>): LlmRetryIssueSummary {
  const retryCalls = calls.filter((call) => (call.retryIssueCodes ?? []).length > 0);
  return {
    retryIssueCallCount: retryCalls.length,
    byRetryIssue: retryCalls.reduce<Partial<Record<LlmRetryIssueCode, number>>>((acc, call) => {
      for (const code of call.retryIssueCodes ?? []) {
        acc[code] = (acc[code] ?? 0) + 1;
      }
      return acc;
    }, {}),
  };
}

export function buildLlmOptimizationRecommendations(
  input: LlmOptimizationRecommendationInput,
): LlmOptimizationRecommendation[] {
  const recommendations: LlmOptimizationRecommendation[] = [];
  const retry = input.byRetryIssue ?? {};
  const quality = input.byQualityIssue ?? {};
  const push = (recommendation: LlmOptimizationRecommendation) => recommendations.push(recommendation);

  const boundaryEvidence = collectCounts(quality, ["death_cause_overclaim", "absolute_no_kill_claim"]);
  if (boundaryEvidence.length > 0) {
    push({
      priority: "high",
      area: "safety_boundary",
      title: "优先修死亡播报、女巫药线和空刀边界",
      detail: "这类问题会把允许的高概率推测说成私密确定事实，影响玩家对规则和信息边界的信任。",
      nextStep: "继续保留“无守卫平安夜按女巫用药处理”和基于夜晚形态的药瓶状态推理，但强化禁止说死刀口、具体救毒目标、女巫身份、“我救过人”和“狼人不能空刀”。",
      evidence: boundaryEvidence,
    });
  }

  const contractEvidence = collectCounts(retry, ["json_format", "candidate_selection", "malformed_output"]);
  if (contractEvidence.length > 0) {
    push({
      priority: hasAny(retry, ["candidate_selection"]) ? "high" : "medium",
      area: "prompt_contract",
      title: "收紧动作 JSON 和候选项选择契约",
      detail: "这通常是决策层格式稳定性问题，不代表发言质量差；优先调 action provider 或模型拆分。",
      nextStep: "检查 action JSON 示例、候选 candidateId 提示、重试提示和自定义模型 action 覆盖；DeepSeek reasoner 可继续负责发言，动作可走 chat。",
      evidence: contractEvidence,
    });
  }

  const continuityEvidence = [
    ...collectCounts(retry, ["speech_vote_continuity"]),
    ...collectCounts(quality, ["speech_vote_discontinuity"]),
  ];
  if (continuityEvidence.length > 0) {
    push({
      priority: "medium",
      area: "decision_continuity",
      title: "加强发言目标到投票理由的连续性",
      detail: "问题不是 AI 不能转票，而是转票时没有说明新增公开证据为什么更硬。",
      nextStep: "继续优化 publicContext.decisionSummary.speechVoteContinuity、候选 reasonHint 和投票重试提示，让“延续/转票”都自然说清。",
      evidence: continuityEvidence,
    });
  }

  const providerEvidence = collectCounts(retry, ["provider_request", "unknown_retry"]);
  if ((input.fallbackCount ?? 0) > 0) providerEvidence.push(`fallback ${input.fallbackCount}`);
  if ((input.errorCount ?? 0) > 0) providerEvidence.push(`error ${input.errorCount}`);
  if (providerEvidence.length > 0) {
    push({
      priority: "high",
      area: "provider_stability",
      title: "先排查模型接口稳定性和备用路由",
      detail: "请求失败、超时或 fallback 会污染发言/决策质量判断，需要先把链路稳定下来。",
      nextStep: "检查 baseUrl、超时、重试次数、fallback personas、JSON mode 兼容性和 provider 错误摘要。",
      evidence: providerEvidence,
    });
  }

  const toneEvidence = [
    ...collectCounts(retry, ["overcertainty"]),
    ...collectCounts(quality, ["overcertain_without_evidence", "malformed_output_fragment", "english_output_fragment"]),
  ];
  if (toneEvidence.length > 0) {
    push({
      priority: "medium",
      area: "reasoning_tone",
      title: "校准推测语气，不压死合理猜测",
      detail: "狼人杀需要猜测推进，但应把证据硬度说清，避免无公开依据的铁口结论。",
      nextStep: "保留“倾向、大概率、暂时、可改票”的表达，引导模型引用公开线索后再升级结论强度。",
      evidence: toneEvidence,
    });
  }

  if (recommendations.length === 0 && (input.totalCalls ?? 0) > 0) {
    push({
      priority: "low",
      area: "sample_size",
      title: "当前样本未暴露自动质量问题",
      detail: "小样本干净时不宜继续收紧约束，否则容易压掉模型的推理和发言活性。",
      nextStep: "扩大 seed、增加 DAY_SPEECH 与 DAY_VOTE 混合实测，再决定是否调整提示词或决策器。",
      evidence: [`totalCalls ${input.totalCalls}`],
    });
  }

  return recommendations.sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority));
}

export function summarizeLlmAttemptDiagnostics(attempts: LlmAttemptDiagnostic[]): LlmAttemptDiagnosticSummary[] {
  return attempts
    .filter((attempt) => Boolean(attempt.issue) || Boolean(attempt.validationErrors?.length))
    .map((attempt) => {
      const validationErrors = attempt.validationErrors ?? [];
      const issue = attempt.issue ?? (validationErrors.join("; ") || "attempt failed validation");
      const rawOutputSnippet = clipDiagnostic(sanitizeDiagnosticSecret(toDiagnosticText(attempt.rawOutput)), 120);
      return {
        attempt: attempt.attempt,
        ...(attempt.provider ? { provider: attempt.provider } : {}),
        issue,
        validationErrors,
        ...(rawOutputSnippet ? { rawOutputSnippet } : {}),
      };
    });
}

function classifyLlmRetryIssue(
  attempt: LlmRetryIssueSource,
): LlmRetryIssueCode | undefined {
  const text = normalizeSpaces([attempt.issue, ...(attempt.validationErrors ?? [])].filter(Boolean).join(" "));
  if (!text) return undefined;
  if (/speech-vote continuity|发言.{0,8}投票|投票.{0,8}发言|承接|转票|连续性/i.test(text)) return "speech_vote_continuity";
  if (/missing candidate|selected a missing candidate|candidateId is not in the allowed candidate list|candidate actor|候选/i.test(text)) {
    return "candidate_selection";
  }
  if (/not valid JSON|valid JSON|schema|parse|JSON 格式|不是.*JSON|json/i.test(text)) return "json_format";
  if (/reason is malformed|malformed output|malformed fragment|截断|残留|trailing|fragment/i.test(text)) return "malformed_output";
  if (/overcertain|过度确定|铁狼|必狼|百分百|一定是狼|肯定是狼|确定是狼|坐实狼/i.test(text)) return "overcertainty";
  if (/private|wolf-team|hidden role|true role|队友|同狼|狼队|隐藏身份|私密|系统|提示词|prompt/i.test(text)) return "private_leak";
  if (/request failed|terminated|timeout|timed out|abort|aborted|upstream|provider|rate|quota|429|5\d\d/i.test(text)) {
    return "provider_request";
  }
  if (/constraints|validation|not pass|未通过|约束/i.test(text)) return "other_validation";
  return "unknown_retry";
}

function collectCounts<T extends string>(counts: Partial<Record<T, number>>, keys: T[]): string[] {
  return keys.flatMap((key) => {
    const count = counts[key] ?? 0;
    return count > 0 ? [`${key} ${count}`] : [];
  });
}

function hasAny<T extends string>(counts: Partial<Record<T, number>>, keys: T[]): boolean {
  return keys.some((key) => (counts[key] ?? 0) > 0);
}

function priorityRank(priority: LlmOptimizationRecommendation["priority"]): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function hasAbsoluteNoKillClaim(text: string): boolean {
  return /狼人\s*(不能|不可能|无法|没法|不可以)\s*空刀/.test(text) || /规则.{0,8}(不允许|禁止).{0,8}空刀/.test(text);
}

function hasDeathCauseOverclaim(input: LlmCallQualityInput, text: string): boolean {
  const saveTargets = [
    ...collectSeatTargets(text, /女巫.{0,18}(?:救的是|救了|解了|开解药救了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectSeatTargets(text, /(?:我|昨晚|昨夜|夜里).{0,10}(?:救的是|救了|解了|开解药救了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectSeatTargets(text, /([0-9]+|[一二三四五六七八九十两]+)\s*号.{0,8}(?:被女巫救|吃了解药|被救了)/g),
  ];
  const poisonTargets = [
    ...collectSeatTargets(text, /女巫.{0,18}(?:毒的是|毒了|开毒毒了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectSeatTargets(text, /(?:我|昨晚|昨夜|夜里).{0,10}(?:毒的是|毒了|开毒毒了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectSeatTargets(text, /([0-9]+|[一二三四五六七八九十两]+)\s*号.{0,8}(?:被女巫毒|吃毒|被毒了)/g),
  ];
  const knifeTargets = collectSeatTargets(text, /刀口\s*(?:就是|是|在)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g);
  const poisonMouthTargets = collectSeatTargets(text, /毒口\s*(?:就是|是|在)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g);

  return (
    hasUnknownWitchTarget(input, saveTargets, [input.witchKnownTargets?.savedTargetSeatId]) ||
    hasUnknownWitchTarget(input, poisonTargets, [input.witchKnownTargets?.poisonedTargetSeatId]) ||
    hasUnknownWitchTarget(input, knifeTargets, [input.witchKnownTargets?.currentVictimSeatId, input.witchKnownTargets?.savedTargetSeatId]) ||
    hasUnknownWitchTarget(input, poisonMouthTargets, [input.witchKnownTargets?.poisonedTargetSeatId]) ||
    /女巫.{0,8}(?:身份|是谁)\s*(?:就是|是|确定)/.test(text)
  );
}

function hasUnknownWitchTarget(input: LlmCallQualityInput, targetIds: number[], allowedTargetIds: Array<number | undefined>): boolean {
  const ids = [...new Set(targetIds.filter((seatId) => Number.isFinite(seatId)))];
  if (ids.length === 0) return false;
  if (input.myRole !== "WITCH") return true;
  const allowed = new Set(allowedTargetIds.filter((seatId): seatId is number => typeof seatId === "number"));
  return ids.some((seatId) => !allowed.has(seatId));
}

function collectSeatTargets(text: string, pattern: RegExp): number[] {
  return [...text.matchAll(pattern)]
    .map((match) => parseSeatNumber(match[1] ?? ""))
    .filter((seatId): seatId is number => typeof seatId === "number");
}

function parseSeatNumber(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return 10;
  if (/^十[一二两三四五六七八九]$/.test(value)) return 10 + (digits[value[1]!] ?? 0);
  if (/^[一二两三四五六七八九]十$/.test(value)) return (digits[value[0]!] ?? 0) * 10;
  if (/^[一二两三四五六七八九]十[一二两三四五六七八九]$/.test(value)) {
    return (digits[value[0]!] ?? 0) * 10 + (digits[value[2]!] ?? 0);
  }
  return digits[value];
}

function hasSpeechVoteDiscontinuity(input: LlmCallQualityInput, text: string): boolean {
  if (input.phase !== "DAY_VOTE" || input.task !== "action") return false;
  if (!input.voteTargetSeatId || !input.lastSpeechTargetSeatId) return false;
  if (input.voteTargetSeatId === input.lastSpeechTargetSeatId) {
    return !/(上一轮|刚才|延续|继续|未解除|没解释|没补清楚|同一条线)/.test(text);
  }
  return !/(转票|改票|改投|从.{0,8}\d+\s*号.{0,8}到.{0,8}\d+\s*号|新增|更硬|票型|对跳)/.test(text);
}

function hasOvercertainClaimWithoutEvidence(input: LlmCallQualityInput, text: string): boolean {
  if ((input.reasoningCueCount ?? 0) <= 0 || (input.referencedReasoningCueCount ?? 0) > 0) return false;
  if (/(可能|大概率|倾向|更像|目前|暂时|先压|保留|软信息|不站死)/.test(text)) return false;
  return /(铁狼|必狼|百分百|一定是狼|肯定是狼|确定是狼|坐实狼)/.test(text);
}

function hasMalformedOutputFragment(text: string): boolean {
  return /(^|\s)["']?:["']?/.test(text) || /[，,;；:]$/.test(text);
}

function hasEnglishOutputFragment(text: string): boolean {
  const withoutModelIds = text.replace(/\b[A-Za-z]+(?:-[A-Za-z0-9]+)+\b/g, " ");
  const words = withoutModelIds.match(/[A-Za-z]{2,}/g) ?? [];
  const contentWords = words.filter((word) => !isAllowedModelWord(word));
  if (contentWords.length < 4) return false;
  return /\b(is|are|was|were|the|main|public|focus|due|because|current|reason|evidence|vote|target|candidate|pressure|claim|check|logic)\b/i.test(
    withoutModelIds,
  );
}

function isAllowedModelWord(word: string): boolean {
  return /^(gpt|ds|chat|reason|reasoner|deepseek|claude|gemini|kimi|glm|mimo|doubao)$/i.test(word);
}

function buildEvaluationNickname(baseNickname: string, model: string, index: number): string {
  const suffix = String(index + 1);
  const compactModel = model.replace(/^deepseek[-_]?/i, "DS-").replace(/[^A-Za-z0-9\u4e00-\u9fff-]/g, "");
  return `${baseNickname}-${compactModel}-${suffix}`.slice(0, 16);
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "model";
}

function normalizeSpaces(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toDiagnosticText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function sanitizeDiagnosticSecret(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***");
}

function clipDiagnostic(value: string, limit: number): string | undefined {
  const clean = normalizeSpaces(value);
  if (!clean) return undefined;
  return clean.length <= limit ? clean : clean.slice(0, limit);
}

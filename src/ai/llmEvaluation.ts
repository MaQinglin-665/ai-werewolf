import { getDefaultAiFriends } from "@/game/aiFriends";
import type { AiFriendConfig, Role } from "@/game/types";
import { hasUnfinishedOrdinaryFocusMarker, isOrdinaryTruncatedSpeechEnding } from "./speech/ordinarySurface";

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
  previousSpeechText?: string;
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

export type OrdinaryAiEvalTask = "speech" | "action";

export type OrdinaryAiEvalIssueCode =
  | "template_tone"
  | "ordinary_jargon_stack"
  | "future_audit_hook"
  | "courtroom_register"
  | "half_accept_without_landing"
  | "rule_lecture"
  | "logic_boundary_error"
  | "malformed_output_fragment"
  | "no_concrete_progression"
  | "bad_followup_target"
  | "repeated_empty_pressure"
  | "repeated_axis_pile_on"
  | "speech_vote_discontinuity";

export type OrdinaryAiEvalPositiveSignal =
  | "weakButHumanPasses"
  | "emotionalButGroundedPasses"
  | "defensiveSelfMotivePasses"
  | "rolePublicActionPasses";

export type OrdinaryAiSampleMetricCode =
  | "seat_voice_similarity"
  | "repeated_surface_phrase"
  | "repeated_clause_rate"
  | "axis_concentration"
  | "action_distribution_skew"
  | "positive_signal_coverage";

export type OrdinaryAiSampleMetric = {
  code: OrdinaryAiSampleMetricCode;
  severity: "info" | "warn";
  detail: string;
  value?: number | string;
  evidence?: string[];
};

export type OrdinaryAiEvalIssue = {
  code: OrdinaryAiEvalIssueCode;
  severity: "warn" | "error";
  detail: string;
  evidence?: string;
};

export type OrdinaryAiEvalCase = {
  id: string;
  task: OrdinaryAiEvalTask;
  phase: string;
  playerRole?: Role;
  outputText: string;
  previousSpeechText?: string;
  previousSpeechTexts?: string[];
  selectedTargetSeatId?: number;
  lastSpeechTargetSeatId?: number;
  focusSeatId?: number;
  askTargetSeatId?: number;
  aliveSeatIds?: number[];
  availablePublicCueCount?: number;
  referencedPublicCueCount?: number;
  metadata?: Record<string, unknown>;
};

export type OrdinaryAiEvalCaseResult = {
  id: string;
  task: OrdinaryAiEvalTask;
  phase: string;
  score: number;
  issueCodes: OrdinaryAiEvalIssueCode[];
  issues: OrdinaryAiEvalIssue[];
  positiveSignals: OrdinaryAiEvalPositiveSignal[];
  outputText: string;
  outputTextSnippet: string;
  metadata?: Record<string, unknown>;
};

export type OrdinaryAiEvalSummary = {
  totalCases: number;
  averageScore: number;
  issueCount: number;
  byIssueCode: Partial<Record<OrdinaryAiEvalIssueCode, number>>;
  highRiskCaseIds: string[];
  sampleMetrics: OrdinaryAiSampleMetric[];
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
      nickname: buildEvaluationNickname(base.nickname, index, defaults.length),
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

  if (hasMalformedOutputFragment(text, input.task)) {
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

export function analyzeOrdinaryAiEvalCase(input: OrdinaryAiEvalCase): OrdinaryAiEvalCaseResult {
  const text = normalizeSpaces(input.outputText);
  const issues: OrdinaryAiEvalIssue[] = [];
  const push = (issue: OrdinaryAiEvalIssue) => issues.push(issue);

  if (looksLikeTemplateTone(text)) {
    push({
      code: "template_tone",
      severity: "warn",
      detail: "发言像通用模板，没有进入当前牌桌的具体对象或线索。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsOrdinaryJargonStack(input, text)) {
    push({
      code: "ordinary_jargon_stack",
      severity: "warn",
      detail: "堆叠普通局黑话或把内部审稿词说成牌桌台词，没有承载有效推进。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsFutureAuditHook(text)) {
    push({
      code: "future_audit_hook",
      severity: "warn",
      detail: "低信息发言用观察点/后置验证包装成未来审计任务，而不是当前座位的处理边界。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsCourtroomRegister(text)) {
    push({
      code: "courtroom_register",
      severity: "warn",
      detail: "发言用了举证、审判、法庭式归责等口吻，不像普通狼人杀玩家当场说话。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsHalfAcceptWithoutLanding(text)) {
    push({
      code: "half_accept_without_landing",
      severity: "warn",
      detail: "说认同一半但没有落到接受部分、保留部分和当前处理动作。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsOrdinaryRuleLecture(text)) {
    push({
      code: "rule_lecture",
      severity: "warn",
      detail: "在普通发言中讲解狼人杀规则，而不是根据公开局势发言。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsOrdinaryLogicBoundaryError(input, text)) {
    push({
      code: "logic_boundary_error",
      severity: "error",
      detail: "把普通玩家不应确定知道的夜晚信息、空刀边界或死亡原因说成事实。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (hasMalformedOutputFragment(text, input.task)) {
    push({
      code: "malformed_output_fragment",
      severity: "warn",
      detail: "发言结尾像截断片段或只承诺后文，没有把当下判断说完。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (lacksConcreteGameAction(input, text)) {
    push({
      code: "no_concrete_progression",
      severity: "warn",
      detail: "没有给出可执行的压人、追问、放下、转票或延续对象。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (asksBadFollowupTarget(input)) {
    push({
      code: "bad_followup_target",
      severity: "error",
      detail: "追问对象不在当前存活席位中，玩家无法按这个问题继续游戏。",
      evidence: input.askTargetSeatId === undefined ? undefined : `${input.askTargetSeatId}号`,
    });
  }

  if (repeatsPriorEmptyPressure(input, text)) {
    push({
      code: "repeated_empty_pressure",
      severity: "warn",
      detail: "重复上一轮空泛压力，没有增加新的理由、目标或处理方式。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (repeatsSameAxisPileOn(input, text)) {
    push({
      code: "repeated_axis_pile_on",
      severity: "warn",
      detail: "连续多人围绕同一座位和同一审计表面加压，没有换成新的玩家动作。",
      evidence: clipEvalEvidence(text),
    });
  }

  if (hasOrdinarySpeechVoteDiscontinuity(input, text)) {
    push({
      code: "speech_vote_discontinuity",
      severity: "warn",
      detail: "投票理由没有承接发言目标，也没有解释为什么新增公开证据足以转票。",
      evidence: clipEvalEvidence(text),
    });
  }

  const score = Math.max(
    0,
    100 - issues.reduce((total, issue) => total + ordinaryEvalIssuePenalty(issue.code), 0),
  );

  return {
    id: input.id,
    task: input.task,
    phase: input.phase,
    score,
    issueCodes: issues.map((issue) => issue.code),
    issues,
    positiveSignals: collectOrdinaryPositiveSignals(input, text, issues),
    outputText: text,
    outputTextSnippet: clipEvalEvidence(text, 120),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function summarizeOrdinaryAiEvalCases(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiEvalSummary {
  const issueCount = results.reduce((total, result) => total + result.issues.length, 0);
  const averageScore =
    results.length === 0
      ? 0
      : Math.round((results.reduce((total, result) => total + result.score, 0) / results.length) * 10) / 10;
  return {
    totalCases: results.length,
    averageScore,
    issueCount,
    byIssueCode: results.reduce<Partial<Record<OrdinaryAiEvalIssueCode, number>>>((acc, result) => {
      for (const code of result.issueCodes) {
        acc[code] = (acc[code] ?? 0) + 1;
      }
      return acc;
    }, {}),
    highRiskCaseIds: results.filter((result) => result.score < 75 || result.issues.some((issue) => issue.severity === "error")).map((result) => result.id),
    sampleMetrics: analyzeOrdinaryAiSampleMetrics(results),
  };
}

function analyzeOrdinaryAiSampleMetrics(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiSampleMetric[] {
  const metrics: OrdinaryAiSampleMetric[] = [];
  const speechResults = results.filter((result) => result.task === "speech");
  if (speechResults.length < 4) return metrics;

  const repeatedSurface = findRepeatedOrdinarySurfacePhrase(speechResults);
  if (repeatedSurface) metrics.push(repeatedSurface);

  const repeatedClause = measureOrdinaryRepeatedClauseRate(speechResults);
  if (repeatedClause) metrics.push(repeatedClause);

  const axisConcentration = measureOrdinaryAxisConcentration(speechResults);
  if (axisConcentration) metrics.push(axisConcentration);

  const voiceSimilarity = measureOrdinarySeatVoiceSimilarity(speechResults);
  if (voiceSimilarity) metrics.push(voiceSimilarity);

  const actionSkew = measureOrdinaryActionDistribution(speechResults);
  if (actionSkew) metrics.push(actionSkew);

  const positiveSignalCount = speechResults.filter((result) => result.positiveSignals.length > 0).length;
  if (speechResults.length >= 6 && positiveSignalCount === 0) {
    metrics.push({
      code: "positive_signal_coverage",
      severity: "info",
      detail: "这个样本没有出现弱信息划水、带情绪但落地、防御动机或公开神职处理等正向真人感信号；适合人工读一遍确认是否只是干净但没个性。",
      value: "0/6+",
    });
  }

  return metrics;
}

function findRepeatedOrdinarySurfacePhrase(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiSampleMetric | undefined {
  const phraseCounts = new Map<string, OrdinaryAiEvalCaseResult[]>();
  const repeatedSurfacePatterns: Array<[string, RegExp]> = [
    ["刚才给了一个方向", /刚才给了一个方向/],
    ["拿后面的票和回应对照", /拿后面的票和回应对照/],
    ["我先接一下前面", /我先接一下前面/],
    ["我听到上一位", /我听到上一位/],
    ["我先接住", /我先接住/],
    ["先放观察", /先放观察/],
    ["看谁话说满", /看谁话说满/],
  ];

  for (const result of results) {
    const text = ordinaryEvalResultText(result);
    const matchedLabels = new Set<string>();
    for (const [label, pattern] of repeatedSurfacePatterns) {
      if (!pattern.test(text)) continue;
      matchedLabels.add(label);
    }
    for (const phrase of collectRepeatedCandidatePhrases(text)) {
      matchedLabels.add(phrase);
    }
    for (const label of matchedLabels) {
      const list = phraseCounts.get(label) ?? [];
      list.push(result);
      phraseCounts.set(label, list);
    }
  }

  const repeated = [...phraseCounts.entries()]
    .filter(([, matchedResults]) => matchedResults.length >= 2)
    .sort((left, right) => right[1].length - left[1].length || right[0].length - left[0].length)[0];
  if (!repeated) return undefined;

  const [phrase, matchedResults] = repeated;
  return {
    code: "repeated_surface_phrase",
    severity: "warn",
    detail: `多名玩家重复了同一类表面表达“${phrase}”，这通常意味着整桌节奏像同一个提示词在轮流说话。`,
    value: `${matchedResults.length}/${results.length}`,
    evidence: matchedResults.slice(0, 4).map((result) => `${result.id}: ${result.outputTextSnippet}`),
  };
}

function measureOrdinaryRepeatedClauseRate(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiSampleMetric | undefined {
  if (results.length < 6) return undefined;
  const clauseCounts = new Map<string, { minCount: number; results: OrdinaryAiEvalCaseResult[] }>();
  const normalizedTexts = results.map((result) => normalizeOrdinaryClauseText(ordinaryEvalResultText(result)));
  const addMatch = (clause: string, result: OrdinaryAiEvalCaseResult, minCount = 2) => {
    const entry = clauseCounts.get(clause) ?? { minCount, results: [] };
    entry.minCount = Math.min(entry.minCount, minCount);
    if (!entry.results.some((item) => item.id === result.id)) entry.results.push(result);
    clauseCounts.set(clause, entry);
  };
  for (const result of results) {
    const matchedClauses = new Set(collectRepeatedLongClauseCandidates(ordinaryEvalResultText(result)));
    for (const clause of matchedClauses) {
      addMatch(clause, result, 2);
    }
    const matchedShortClauses = new Set(collectRepeatedShortClauseCandidates(ordinaryEvalResultText(result)));
    for (const clause of matchedShortClauses) {
      addMatch(clause, result, 3);
    }
  }
  for (let left = 0; left < normalizedTexts.length; left += 1) {
    for (let right = left + 1; right < normalizedTexts.length; right += 1) {
      const clause = findOrdinarySharedLongClause(normalizedTexts[left] ?? "", normalizedTexts[right] ?? "");
      if (!clause) continue;
      addMatch(clause, results[left]!, 2);
      addMatch(clause, results[right]!, 2);
    }
  }

  const repeated = [...clauseCounts.entries()]
    .filter(([, entry]) => entry.results.length >= entry.minCount)
    .sort(
      (left, right) =>
        right[1].results.length - left[1].results.length ||
        right[0].length - left[0].length ||
        left[1].minCount - right[1].minCount,
    )[0];
  if (!repeated) return undefined;

  const [clause, entry] = repeated;
  return {
    code: "repeated_clause_rate",
    severity: "warn",
    detail: `多名玩家复用了同一段长子句“${clause}”；这类问题通常不是禁词问题，而是桥接或候选动作被整句复用。`,
    value: `${entry.results.length}/${results.length}`,
    evidence: entry.results.slice(0, 4).map((result) => `${result.id}: ${result.outputTextSnippet}`),
  };
}

function findOrdinarySharedLongClause(left: string, right: string): string | undefined {
  const maxLength = Math.min(50, left.length, right.length);
  for (let length = maxLength; length >= 15; length -= 1) {
    for (let index = 0; index + length <= left.length; index += 1) {
      const clause = left.slice(index, index + length);
      if (isUsefulOrdinaryRepeatedClause(clause) && right.includes(clause)) return clause;
    }
  }
  return undefined;
}

function measureOrdinaryAxisConcentration(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiSampleMetric | undefined {
  if (results.length < 6) return undefined;
  const targetRows = new Map<number, OrdinaryAiEvalCaseResult[]>();
  for (const result of results) {
    const target = inferDominantMentionedSeat(ordinaryEvalResultText(result));
    if (target === undefined) continue;
    const list = targetRows.get(target) ?? [];
    list.push(result);
    targetRows.set(target, list);
  }

  const dominant = [...targetRows.entries()].sort((left, right) => right[1].length - left[1].length)[0];
  if (!dominant) return undefined;
  const [seatId, matchedResults] = dominant;
  const share = matchedResults.length / results.length;
  if (share < 0.75) return undefined;

  return {
    code: "axis_concentration",
    severity: "warn",
    detail: `这个样本里 ${matchedResults.length}/${results.length} 条发言主轴都围绕${seatId}号；即使每句都合格，整桌可能像没有人换视角。`,
    value: Math.round(share * 100) / 100,
    evidence: matchedResults.slice(0, 5).map((result) => `${result.id}: ${result.outputTextSnippet}`),
  };
}

function measureOrdinarySeatVoiceSimilarity(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiSampleMetric | undefined {
  if (results.length < 6) return undefined;

  const texts = results.map((result) => normalizeOrdinarySampleText(ordinaryEvalResultText(result))).filter(Boolean);
  if (texts.length < 6) return undefined;

  const maxSimilarities = texts.map((text, index) => {
    const current = charGramSet(text, 2);
    const similarities = texts
      .filter((_, otherIndex) => otherIndex !== index)
      .map((otherText) => jaccardSimilarity(current, charGramSet(otherText, 2)));
    return Math.max(0, ...similarities);
  });
  const averageMaxSimilarity =
    Math.round((maxSimilarities.reduce((total, value) => total + value, 0) / maxSimilarities.length) * 100) / 100;

  if (averageMaxSimilarity < 0.62) return undefined;
  return {
    code: "seat_voice_similarity",
    severity: "warn",
    detail: "多名玩家的句式骨架高度相似；单句可能都合格，但整桌读感容易像一个人在换座位。",
    value: averageMaxSimilarity,
    evidence: results.slice(0, 4).map((result) => `${result.id}: ${result.outputTextSnippet}`),
  };
}

function measureOrdinaryActionDistribution(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiSampleMetric | undefined {
  if (results.length < 6) return undefined;
  const actionCounts = new Map<string, number>();
  for (const result of results) {
    const action = classifyOrdinarySampleSpeechAction(ordinaryEvalResultText(result));
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
  }
  const dominant = [...actionCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!dominant) return undefined;

  const [action, count] = dominant;
  const share = count / results.length;
  if (share < 0.7) return undefined;
  return {
    code: "action_distribution_skew",
    severity: "warn",
    detail: `这个样本里 ${count}/${results.length} 条普通发言都落在“${action}”动作上；建议检查导演候选动作是否给了足够的正面选择，而不是继续补表面禁词。`,
    value: Math.round(share * 100) / 100,
    evidence: [...actionCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([label, value]) => `${label} ${value}`),
  };
}

function ordinaryEvalResultText(result: OrdinaryAiEvalCaseResult): string {
  return normalizeSpaces(result.outputText || result.outputTextSnippet);
}

function collectRepeatedCandidatePhrases(text: string): string[] {
  const normalized = normalizeOrdinarySampleText(text);
  if (normalized.length < 12) return [];
  const phrases = new Set<string>();
  for (const length of [6, 7, 8]) {
    for (let index = 0; index + length <= normalized.length; index += 1) {
      const phrase = normalized.slice(index, index + length);
      if (isUsefulOrdinaryRepeatedPhrase(phrase)) phrases.add(phrase);
    }
  }
  return [...phrases];
}

function collectRepeatedLongClauseCandidates(text: string): string[] {
  const normalized = normalizeOrdinaryClauseText(text);
  if (normalized.length < 15) return [];
  const clauses = new Set<string>();
  for (const length of [34, 30, 26, 22, 18, 15]) {
    for (let index = 0; index + length <= normalized.length; index += 1) {
      const clause = normalized.slice(index, index + length);
      if (isUsefulOrdinaryRepeatedClause(clause)) clauses.add(clause);
    }
  }
  return [...clauses];
}

function collectRepeatedShortClauseCandidates(text: string): string[] {
  const normalized = normalizeOrdinaryClauseText(text);
  if (normalized.length < 10) return [];
  const clauses = new Set<string>();
  for (const length of [14, 13, 12, 11, 10]) {
    for (let index = 0; index + length <= normalized.length; index += 1) {
      const clause = normalized.slice(index, index + length);
      if (isUsefulOrdinaryRepeatedShortClause(clause)) clauses.add(clause);
    }
  }
  return [...clauses];
}

function normalizeOrdinaryClauseText(text: string): string {
  return normalizeSpaces(text)
    .replace(/[0-9一二三四五六七八九十两]+\s*号/g, "{seat}号")
    .replace(/(?:DeepSeek|Claude|Gemini|Kimi|Mimo|GPT|GLM|Human|豆包)\d*/gi, "{name}")
    .replace(/[，。！？、,.!?;；:\s]+/g, "")
    .replace(/^我先/, "我");
}

function isUsefulOrdinaryRepeatedClause(clause: string): boolean {
  if (clause.length < 15) return false;
  if (!/[\u4e00-\u9fa5]/.test(clause)) return false;
  const semanticText = clause.replace(/\{seat\}号|\{name\}/g, "");
  const semanticChars = semanticText.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  if (semanticChars < 12) return false;
  if (/^(?:昨夜)?平安夜(?:我)?(?:先)?(?:当背景)?$/.test(clause)) return false;
  if (/^(?:昨夜)?平安夜(?:女巫)?(?:用药)?(?:我)?(?:先)?(?:当背景)?$/.test(clause)) return false;
  return true;
}

function isUsefulOrdinaryRepeatedShortClause(clause: string): boolean {
  if (clause.length < 10 || clause.length > 14) return false;
  if (!/[\u4e00-\u9fa5]/.test(clause)) return false;
  if (/[{}]/.test(clause)) return false;
  if (/\d|[A-Za-z]/.test(clause)) return false;
  const semanticChars = clause.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  if (semanticChars < 10) return false;
  if (!/(?:票口|理由|回应|暂放|改口|压|投|听|回看|讲顺|补清楚)/.test(clause)) return false;
  if (/^(?:我先|这里|这个|刚才|前面|后面|今天|暂时)/.test(clause)) return false;
  return !/^[我你他她它的了是在有和也就都先这那一二三四五六七八九十]+$/.test(clause);
}

function inferDominantMentionedSeat(text: string): number | undefined {
  const counts = new Map<number, number>();
  for (const seatId of collectSeatTargets(text, /([0-9]+|[一二三四五六七八九十两]+)\s*号/g)) {
    counts.set(seatId, (counts.get(seatId) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!dominant || dominant[1] < 2) return undefined;
  return dominant[0];
}

function isUsefulOrdinaryRepeatedPhrase(phrase: string): boolean {
  if (phrase.length < 6) return false;
  if (/[{}]/.test(phrase)) return false;
  if (/\d/.test(phrase)) return false;
  if (/[A-Za-z]/.test(phrase)) return false;
  if (/(?:DeepSeek|Claude|Gemini|Kimi|Mimo|GPT|GLM|豆包)/i.test(phrase)) return false;
  if (/(?:后续发言者|续发言者|发言者接住|言者接住|者接住|公开线索|压力被|施压|回避站边|我没听|没听明)/.test(phrase)) return false;
  if (/^(我先|这里|这个|刚才|前面|后面|今天|暂时)$/.test(phrase)) return false;
  if (!/(?:接|听|票|回应|对照|观察|方向|不急|暂放|压|打死|解释|补清楚)/.test(phrase)) return false;
  return !/^[我你他她它的了是在有和也就都先这那一二三四五六七八九十]+$/.test(phrase);
}

function normalizeOrdinarySampleText(text: string): string {
  return normalizeSpaces(text)
    .replace(/[0-9一二三四五六七八九十两]+\s*号/g, "{seat}")
    .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function charGramSet(text: string, length: number): Set<string> {
  const grams = new Set<string>();
  for (let index = 0; index + length <= text.length; index += 1) {
    grams.add(text.slice(index, index + length));
  }
  return grams;
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function classifyOrdinarySampleSpeechAction(text: string): string {
  if (/(?:你打我|点到我|打我这个点|我先解释|我回应|我承认|我刚才那句)/.test(text)) return "defendSelf";
  if (/(?:我(?:跳|是|拍)?预言家|查杀|金水|我(?:拍|是)?女巫|银水|毒了|救了|我(?:拍|是)?猎人|枪在)/.test(text)) {
    return "rolePublicAction";
  }
  if (
    /(?:上一位|我先接|我接一下|我听到|听进来|这句话我接|这点我接|刚才那段|刚才(?:的)?(?:判断|方向|发言|表态)|前面(?:一句|发言|说法)|接住[^。！？；]{0,10}这一段)/.test(
      text,
    )
  ) {
    return "quoteOrCarry";
  }
  if (/(?:不舒服|别扭|听着怪|有点滑|烦|急|怕)/.test(text)) return "emotionalDiscomfort";
  if (/(?:票口|票型|投|压|出|归|带票|分票|改票|转票)/.test(text)) return "voteBoundary";
  if (/(?:我不知道|信息少|没东西|先过|我过|暂放|先不|不急)/.test(text)) return "waterOrHold";
  return "other";
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

function ordinaryEvalIssuePenalty(code: OrdinaryAiEvalIssueCode): number {
  switch (code) {
    case "logic_boundary_error":
      return 30;
    case "bad_followup_target":
      return 24;
    case "speech_vote_discontinuity":
      return 22;
    case "no_concrete_progression":
      return 20;
    case "malformed_output_fragment":
      return 18;
    case "future_audit_hook":
    case "half_accept_without_landing":
      return 18;
    case "rule_lecture":
    case "template_tone":
      return 16;
    case "ordinary_jargon_stack":
    case "courtroom_register":
    case "repeated_empty_pressure":
    case "repeated_axis_pile_on":
      return 12;
  }
}

function looksLikeTemplateTone(text: string): boolean {
  const genericPhrases = [
    /作为(?:一名)?普通村民/,
    /大家都?要理性分析/,
    /不要盲目跟票/,
    /不要被带节奏/,
    /我(?:觉得|认为)大家/,
    /先听(?:后置位)?发言/,
    /请大家发言/,
  ];
  return genericPhrases.filter((pattern) => pattern.test(text)).length >= 2;
}

function containsOrdinaryJargonStack(input: OrdinaryAiEvalCase, text: string): boolean {
  if (containsOrdinaryVisiblePlayerJargon(text)) return true;
  const jargon = [
    /普通村民/,
    /理性分析/,
    /盲目跟票/,
    /信息量/,
    /站边/,
    /身份/,
    /局势/,
    /发言/,
    /逻辑/,
    /带节奏/,
  ];
  const jargonCount = jargon.filter((pattern) => pattern.test(text)).length;
  return jargonCount >= 3 && (input.referencedPublicCueCount ?? 0) <= 0;
}

function containsOrdinaryVisiblePlayerJargon(text: string): boolean {
  return /(?:布置.{0,4}作业|划线|画线|划一条线|划条线|触线|这(?:句|段)?话(?:本身|其实)|观察点本身|观察条件|发言缺口|身份空间|怎么用这个信息|(?:起票|补票|最后跟票)(?:[^。！？；]{0,16}(?:起票|补票|最后跟票))?|(?:先|暂时)?(?:把|将)?.{0,18}(?:放进|放到|放在|放|留在)?观察位|同一个尺子|给后面的人[^。！？；]{0,16}(?:划线|画线|划一条线|划条线|立标准)|(?:标准|这条线)[^。！？；]{0,18}(?:先立|立出来|触))/.test(
    text,
  );
}

function containsFutureAuditHook(text: string): boolean {
  return text.split(/[。！？；]/).some((sentence) => {
    const directFutureAudit =
      /(?:后面|后置|后续|谁)[^。！？；]{0,54}(?:借.{0,10}(?:平安夜|死讯|这个点)|急着[^。！？；]{0,16}(?:收票|带票|带节奏|安排别人表态)|硬压[^。！？；]{0,12}表态|要求别人[^。！？；]{0,18}(?:投票|表态|交方向))[^。！？；]{0,56}(?:我(?:会|就|再)?(?:先)?(?:记|觉得|认为|看|压|疑)|先记|记一笔|回头再压|再回来听|反应不(?:太)?对)/.test(
        sentence,
      ) ||
      /(?:主要)?(?:看|听|留意)[^。！？；]{0,16}(?:后置位|后面|谁)[^。！？；]{0,44}(?:先开口|逼人表态|收着听|带票|带节奏)/.test(
        sentence,
      ) ||
      /(?:后置位|后置|后面|后续)[^。！？；]{0,36}(?:如果|要是|若)[^。！？；]{0,36}(?:强神|预言家|女巫|猎人|起跳|跳身份|跳出来)/.test(
        sentence,
      ) ||
      /(?:如果|要是|若)[^。！？；]{0,24}(?:都|没人|没有人)[^。！？；]{0,16}(?:跳|起跳|拍身份)[^。！？；]{0,36}(?:我(?:就|再)?(?:抓|看|盯|压|疑)|先抓|先看|先盯)/.test(
        sentence,
      ) ||
      /我(?:会|就|再)?[^。！？；]{0,22}(?:从|看|听|留意)[^。！？；]{0,24}(?:后面|后置|后续|后面的人)[^。！？；]{0,60}(?:前后矛盾|强推|闭眼位|没说清楚|解释不清)/.test(
        sentence,
      ) ||
      /(?:后面|后置|后续)[^。！？；]{0,24}(?:会|主要|重点)?(?:看|听|留意|观察)[^。！？；]{0,20}(?:谁|哪位|哪句话|反应)[^。！？；]{0,30}(?:反应(?:最)?不自然|不自然|没说清楚|解释不清|强推|闭眼位)/.test(
        sentence,
      ) ||
      /(?:等|待)[^。！？；]{0,20}(?:后面|后置|后续)[^。！？；]{0,20}(?:说完|发完言|聊完)[^。！？；]{0,40}我(?:会|再|就)?[^。！？；]{0,24}(?:留意|看|听|追问)[^。！？；]{0,48}(?:前后(?:对不上|矛盾)|听不(?:太)?明白|接不上|没说清楚|反应不自然)/.test(
        sentence,
      ) ||
      /(?:等|待)[^。！？；]{0,20}(?:后面|后置|后续)[^。！？；]{0,24}(?:一圈)?(?:发言)?(?:出来|说完|发完言|聊完)[^。！？；]{0,32}(?:再)?(?:看|听|留意|追问)[^。！？；]{0,36}(?:前后(?:说法)?(?:对不上|矛盾)|说法对不上|反应不自然|没说清楚)/.test(
        sentence,
      ) ||
      /(?:后面|后置|后续|谁)[^。！？；]{0,60}(?:强推|没说清楚|解释不清|前后矛盾|拿[^。！？；]{0,12}(?:平安夜|这个点)[^。！？；]{0,16}(?:做文章|压人表态|压人|带票|带节奏)|压人表态)[^。！？；]{0,60}(?:我(?:会|就|再)?(?:多留|留|记|看|压|疑|给明确态度)|多留(?:一个)?疑问|留疑问|再给明确态度)/.test(
        sentence,
      );
    if (directFutureAudit) return true;
    const hasHookLabel =
      /(?:给|留|放|设|设置|抛|提出)[^。！？；]{0,10}(?:观察点|观察位|可验证点|验证点)/.test(sentence) ||
      /(?:有一?个点|这个点|这点)[^。！？；]{0,18}(?:先记|记下|记下来|留着|先留|重点关注|后面能验|后续能验)/.test(sentence) ||
      /(?:重点关注|留意)[^。！？；]{0,18}(?:后面|后置|后续|谁)/.test(sentence);
    if (!hasHookLabel) {
      return false;
    }
    return /(?:后面|后置|后续|后面的人|谁)[^。！？；]{0,36}(?:急着|借|带票|带节奏|推焦点|闭眼位|接|验证|能验|看得出来|打)/.test(sentence) ||
      /(?:这个点|这点|观察点|验证点)[^。！？；]{0,24}(?:后面|后续|能验|验证|谁做了)/.test(sentence);
  });
}

function containsCourtroomRegister(text: string): boolean {
  return /(?:举证责任|举证|证据责任|审判|法庭|证词层级)/.test(text) || /打法[^。！？；]{0,16}(?:打算|准备|想要)?验谁/.test(text);
}

function containsHalfAcceptWithoutLanding(text: string): boolean {
  const halfAcceptMatch = text.match(/(?:认同一半|认一半|接一半|接受一半|认下?一半)/);
  if (!halfAcceptMatch || halfAcceptMatch.index === undefined) return false;
  if (isHalfAcceptChallengeToAnotherSpeaker(text, halfAcceptMatch.index)) return false;
  const localText = text.slice(halfAcceptMatch.index);
  const statesAcceptedPart = /(?:认同|认|接受|接)[^。！？；]{0,42}(?:但|不过|只是|，|,|：|:)/.test(localText);
  const statesReservedPart = /(?:不认同|另一半|不全认|不全跟|不能全跟|但|不过|只是|保留|暂放|不急着|不打死)/.test(localText);
  return !(statesAcceptedPart && statesReservedPart && hasOrdinaryEvalHandlingAction(localText));
}

function isHalfAcceptChallengeToAnotherSpeaker(text: string, halfAcceptIndex: number): boolean {
  const localWindow = text.slice(Math.max(0, halfAcceptIndex - 36), halfAcceptIndex + 100);
  return (
    /(?:你(?:刚才)?说|你前面说|他说|她说|\d+\s*号[^。！？；]{0,16}说)/.test(localWindow) &&
    /(?:之后呢|然后呢|哪一半|另一半|没说完|是什么|说清|讲清|回一下|回应一下)/.test(localWindow)
  );
}

function containsOrdinaryRuleLecture(text: string): boolean {
  const rulePhrases = [
    /狼人杀的规则/,
    /预言家.{0,8}验人/,
    /女巫.{0,8}(解药|毒药)/,
    /猎人.{0,8}(开枪|带人)/,
    /守卫.{0,8}守护/,
    /身份配置/,
  ];
  return rulePhrases.filter((pattern) => pattern.test(text)).length >= 2;
}

function containsOrdinaryLogicBoundaryError(input: OrdinaryAiEvalCase, text: string): boolean {
  if (input.task === "speech" && input.playerRole && input.playerRole !== "WITCH" && misattributesSelfWitchIdentity(text)) return true;
  if (fabricatesPublicCheckAttribution(input, text)) return true;
  if (input.task === "speech" && attacksPeaceNightCommonSenseAsHiddenInfo(text)) return true;
  if (input.task === "speech" && input.playerRole === "WITCH" && isSelfWitchPotionDisclosure(text)) {
    return analyzeLlmCallQuality({
      outputText: text,
      phase: input.phase,
      task: input.task,
      myRole: input.playerRole,
      reasoningCueCount: input.availablePublicCueCount,
      referencedReasoningCueCount: input.referencedPublicCueCount,
      voteTargetSeatId: input.selectedTargetSeatId,
      lastSpeechTargetSeatId: input.lastSpeechTargetSeatId,
      previousSpeechText: input.previousSpeechText,
    }).some((issue) => issue.code === "absolute_no_kill_claim");
  }
  const qualityIssues = analyzeLlmCallQuality({
    outputText: text,
    phase: input.phase,
    task: input.task,
    myRole: input.playerRole,
    reasoningCueCount: input.availablePublicCueCount,
    referencedReasoningCueCount: input.referencedPublicCueCount,
    voteTargetSeatId: input.selectedTargetSeatId,
    lastSpeechTargetSeatId: input.lastSpeechTargetSeatId,
    previousSpeechText: input.previousSpeechText,
  });
  return qualityIssues.some((issue) => {
    if (issue.code === "absolute_no_kill_claim") return true;
    if (issue.code !== "death_cause_overclaim") return false;
    return !isPublicWitchTargetReportAttribution(input, text);
  });
}

function misattributesSelfWitchIdentity(text: string): boolean {
  return (
    /(?:你|他|她|TA|ta|刚才|前面|\d{1,2}\s*号)[^。！？；\n]{0,24}(?:说|讲|点|称|认)[^。！？；\n]{0,10}我(?:是)?女巫/.test(text) &&
    /我(?:先)?(?:认|接|接受)|(?:这个|这张)?身份我(?:先)?(?:认|接)|认下/.test(text)
  );
}

type EvalPublicCheckAttribution = {
  claimantSeatId: number;
  targetSeatId: number;
  result: "WEREWOLF" | "GOOD";
};

type EvalPublicClaimSummary = {
  claimantSeatId: number;
  claimedRole?: string;
  checks: EvalPublicCheckAttribution[];
};

function fabricatesPublicCheckAttribution(input: OrdinaryAiEvalCase, text: string): boolean {
  const publicClaimBoard = readEvalPublicClaimBoard(input);
  if (!Array.isArray(input.metadata?.publicClaimBoard)) return false;
  const attributions = collectEvalPublicCheckAttributions(text, readEvalSeatRefs(input), readEvalSpeakerSeatId(input));
  return attributions.some(
    (attribution) =>
      !publicClaimBoard.some(
        (claim) =>
          claim.claimantSeatId === attribution.claimantSeatId &&
          claim.claimedRole === "SEER" &&
          claim.checks.some(
            (check) => check.targetSeatId === attribution.targetSeatId && check.result === attribution.result,
          ),
      ),
  );
}

function readEvalSeatRefs(input: OrdinaryAiEvalCase): Array<{ seatId: number; name?: string }> {
  const bySeatId = new Map<number, { seatId: number; name?: string }>();
  const add = (seatId: unknown, name: unknown) => {
    const parsed = Number(seatId);
    if (!Number.isFinite(parsed)) return;
    const current = bySeatId.get(parsed) ?? { seatId: parsed };
    if (typeof name === "string" && name.trim()) current.name = name;
    bySeatId.set(parsed, current);
  };
  if (Array.isArray(input.aliveSeatIds)) {
    for (const seatId of input.aliveSeatIds) add(seatId, undefined);
  }
  const aliveSeats = input.metadata?.aliveSeats;
  if (Array.isArray(aliveSeats)) {
    for (const seat of aliveSeats) {
      if (!seat || typeof seat !== "object") continue;
      const record = seat as Record<string, unknown>;
      add(record.seatId, record.name);
    }
  }
  const claims = input.metadata?.publicClaimBoard;
  if (Array.isArray(claims)) {
    for (const claim of claims) {
      if (!claim || typeof claim !== "object") continue;
      const claimRecord = claim as Record<string, unknown>;
      add(claimRecord.claimantSeatId, claimRecord.claimantName);
      const checks = claimRecord.checks;
      if (!Array.isArray(checks)) continue;
      for (const check of checks) {
        if (!check || typeof check !== "object") continue;
        const checkRecord = check as Record<string, unknown>;
        add(checkRecord.targetSeatId, checkRecord.targetName);
      }
    }
  }
  return [...bySeatId.values()];
}

function readEvalSpeakerSeatId(input: OrdinaryAiEvalCase): number | undefined {
  const parsed = Number(input.metadata?.seatNumber);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readEvalPublicClaimBoard(input: OrdinaryAiEvalCase): EvalPublicClaimSummary[] {
  const raw = input.metadata?.publicClaimBoard;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const record = item as Record<string, unknown>;
      const claimantRecord = record.claimant && typeof record.claimant === "object" ? (record.claimant as Record<string, unknown>) : undefined;
      const claimantSeatId = Number(record.claimantSeatId ?? claimantRecord?.seatId);
      if (!Number.isFinite(claimantSeatId)) return undefined;
      const checks = Array.isArray(record.checks)
        ? record.checks
            .map((check) => {
              if (!check || typeof check !== "object") return undefined;
              const checkRecord = check as Record<string, unknown>;
              const targetRecord = checkRecord.target && typeof checkRecord.target === "object" ? (checkRecord.target as Record<string, unknown>) : undefined;
              const targetSeatId = Number(checkRecord.targetSeatId ?? targetRecord?.seatId);
              const result = checkRecord.result === "WEREWOLF" || checkRecord.result === "GOOD" ? checkRecord.result : undefined;
              return Number.isFinite(targetSeatId) && result
                ? { claimantSeatId, targetSeatId, result }
                : undefined;
            })
            .filter((check): check is EvalPublicCheckAttribution => Boolean(check))
        : [];
      const summary: EvalPublicClaimSummary = { claimantSeatId, checks };
      if (typeof record.claimedRole === "string") summary.claimedRole = record.claimedRole;
      return summary;
    })
    .filter((claim): claim is EvalPublicClaimSummary => Boolean(claim));
}

function collectEvalPublicCheckAttributions(
  text: string,
  seats: Array<{ seatId: number; name?: string }>,
  speakerSeatId?: number,
): EvalPublicCheckAttribution[] {
  const attributions: EvalPublicCheckAttribution[] = [];
  let previousSentenceTopicClaimantSeatIds: number[] = [];
  for (const rawSentence of text.split(/[。！？；]/)) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (deniesEvalPublicCheckAttribution(sentence)) continue;
    const sentenceTopicClaimantSeatIds = inferEvalPublicCheckSentenceTopicClaimants(
      sentence,
      seats,
      previousSentenceTopicClaimantSeatIds,
    );
    const reportPatterns = [
      {
        pattern: /(?:报(?:了|出)?|给(?:了|出)?|甩(?:了)?|打(?:出)?|留(?:了)?|查(?:了|验了)|验了)[^。！？；，,、]{0,28}?(\d{1,2})\s*号[^。！？；]{0,12}(查杀|金水)/g,
        targetGroup: 1,
        resultGroup: 2,
      },
      {
        pattern: /(?:报(?:了|出)?|给(?:了|出)?|甩(?:了)?|打(?:出)?|留(?:了)?|查(?:了|验了)|验了)[^。！？；，,、]{0,18}?([A-Za-z][A-Za-z0-9_-]{1,24}|[\u4e00-\u9fa5]{1,12})[^。！？；]{0,4}(查杀|金水)/g,
        targetGroup: 1,
        resultGroup: 2,
      },
    ];
    const reportMatches: Array<{ match: RegExpMatchArray; targetGroup: number; resultGroup: number; index: number }> = [];
    for (const { pattern, targetGroup, resultGroup } of reportPatterns) {
      for (const match of sentence.matchAll(pattern)) {
        reportMatches.push({ match, targetGroup, resultGroup, index: match.index ?? 0 });
      }
    }
    const seenReportMatches = new Set<string>();
    let previousReportClaimantSeatIds: number[] = [];
    for (const { match, targetGroup, resultGroup, index } of reportMatches.sort((left, right) => left.index - right.index)) {
      const targetSeatId = resolveEvalPublicCheckSeatRef(match[targetGroup], seats);
      const result = match[resultGroup] === "查杀" ? "WEREWOLF" : "GOOD";
      if (targetSeatId === undefined) continue;
      const dedupeKey = `${index}:${targetSeatId}:${result}`;
      if (seenReportMatches.has(dedupeKey)) continue;
      seenReportMatches.add(dedupeKey);

      const prefix = sentence.slice(0, index);
      const shouldInheritClaimant = shouldInheritEvalPublicCheckClaimant(prefix);
      const claimantSeatIds =
        shouldInheritClaimant && previousReportClaimantSeatIds.length > 0
          ? previousReportClaimantSeatIds
          : inferEvalPublicCheckClaimants(prefix, seats, speakerSeatId, sentenceTopicClaimantSeatIds);
      if (claimantSeatIds.length > 0) {
        previousReportClaimantSeatIds = claimantSeatIds;
      }
        for (const claimantSeatId of claimantSeatIds) {
          if (claimantSeatId === targetSeatId) continue;
          attributions.push({ claimantSeatId, targetSeatId, result });
        }
    }

    const inversePatterns = [
      {
        pattern:
          /(\d{1,2})\s*号[^。！？；]{0,12}(?:是|作为|接了|吃了)?[^。！？；]{0,12}(\d{1,2})\s*号[^。！？；]{0,24}(?:报|给|甩|打|留)的[^。！？；]{0,8}(查杀|金水)/g,
        claimantGroup: 2,
        targetGroup: 1,
        resultGroup: 3,
      },
    ];
    for (const { pattern, claimantGroup, targetGroup, resultGroup } of inversePatterns) {
      for (const match of sentence.matchAll(pattern)) {
        const claimantSeatId = Number(match[claimantGroup]);
        const targetSeatId = resolveEvalPublicCheckSeatRef(match[targetGroup], seats);
        const result = match[resultGroup] === "查杀" ? "WEREWOLF" : "GOOD";
        if (!Number.isFinite(claimantSeatId) || targetSeatId === undefined) continue;
        if (claimantSeatId === targetSeatId) continue;
        attributions.push({ claimantSeatId, targetSeatId, result });
      }
    }
    if (previousReportClaimantSeatIds.length > 0) {
      previousSentenceTopicClaimantSeatIds = previousReportClaimantSeatIds;
    } else if (sentenceTopicClaimantSeatIds.length > 0) {
      previousSentenceTopicClaimantSeatIds = sentenceTopicClaimantSeatIds;
    }
  }
  return attributions;
}

function inferEvalPublicCheckClaimants(
  prefix: string,
  seats: Array<{ seatId: number; name?: string }>,
  speakerSeatId?: number,
  inheritedClaimantSeatIds: number[] = [],
): number[] {
  if (/(?:^|[，,、\s])我(?:是|这边|这里)?[^，,、]{0,12}$/.test(prefix) || /(?:我(?:报|给|甩|打|留|查|验)|我(?:昨晚|夜里)?(?:查|验))/.test(prefix)) {
    return speakerSeatId === undefined ? [] : [speakerSeatId];
  }
  const inherited = [...new Set(inheritedClaimantSeatIds.filter((seatId) => Number.isFinite(seatId)))];
  if (inherited.length > 0 && shouldUseInheritedEvalPublicCheckClaimant(prefix)) return inherited;

  const actedOnClaimants = inferEvalActedOnClaimants(prefix);
  if (actedOnClaimants.length > 0) return actedOnClaimants;

  const segments = prefix
    .split(/[，,；;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const segment = [...segments].reverse().find((item) => collectEvalSeatRefsFromText(item, seats).length > 0) ?? prefix;
  const mentioned = collectEvalSeatRefsFromText(segment, seats);
  if (mentioned.length === 0) return [];
  const explicitSeerClaimants = collectEvalExplicitSeerClaimantsFromSegment(segment, seats);
  if (explicitSeerClaimants !== undefined) return explicitSeerClaimants;
  if (mentioned.length > 1 && /(?:都|同时|一起)\s*$/.test(segment)) return [...new Set(mentioned)];
  return [mentioned[mentioned.length - 1]!];
}

function inferEvalPublicCheckSentenceTopicClaimants(
  sentence: string,
  seats: Array<{ seatId: number; name?: string }>,
  inheritedClaimantSeatIds: number[],
): number[] {
  const discussionCue = sentence.match(
    /(?:接一下|先接|接住|回到|聊一下|看一下|主要看|问一下|点到|提到|说一下)[^。！？；，,]{0,32}/,
  )?.[0];
  if (discussionCue) {
    const mentioned = collectEvalSeatRefsFromText(discussionCue, seats);
    if (mentioned.length > 0) return [mentioned[0]!];
  }

  const actedOnClaimants = inferEvalActedOnClaimants(sentence);
  if (actedOnClaimants.length > 0) return actedOnClaimants;
  return [...new Set(inheritedClaimantSeatIds.filter((seatId) => Number.isFinite(seatId)))];
}

function shouldUseInheritedEvalPublicCheckClaimant(prefix: string): boolean {
  const lastClause = prefix.split(/[，,、；;。！？!?—-]/).pop()?.replace(/\s+/g, "") ?? "";
  if (!lastClause) return false;
  if (/^(?:昨天|今天|这轮|上一轮|前面|刚才|刚刚|第一天|直接|又|也)$/.test(lastClause)) return true;
  if (/^(?:他|她|TA|ta|这张牌|那张牌|这位|那位|这个预言家|那个预言家)(?:自己|刚才|刚刚|之前|前面|这轮|今天|昨天|第一天|直接|又|也)?$/.test(lastClause)) {
    return true;
  }
  return /^(?:昨天|今天|这轮|上一轮|前面|刚才)(?:他|她|TA|ta|这张牌|那张牌|这位|那位|这个预言家|那个预言家)(?:自己)?$/.test(
    lastClause,
  );
}

function inferEvalActedOnClaimants(prefix: string): number[] {
  const clauses = prefix
    .split(/[，,；;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (clauses.length < 2) return [];
  const pronounClause = clauses.at(-1) ?? "";
  if (!/(?:他|她|TA|ta|自己|本人|这张牌|那张牌|这位|那位)/.test(pronounClause)) return [];

  const actedOnClause = [...clauses]
    .slice(0, -1)
    .reverse()
    .find((segment) => /(?:吃到|接了|被|挨了)[^，,；;]{0,28}(?:查杀|金水)/.test(segment));
  if (!actedOnClause) return [];

  const match = actedOnClause.match(/(\d{1,2})\s*号[^，,；;]{0,28}(?:吃到|接了|被|挨了)[^，,；;]{0,28}(?:查杀|金水)/);
  const claimantSeatId = match ? Number(match[1]) : undefined;
  return Number.isFinite(claimantSeatId) ? [claimantSeatId!] : [];
}

function shouldInheritEvalPublicCheckClaimant(prefix: string): boolean {
  const lastClause = prefix.split(/[，,；;。！？!?]/).pop()?.trim() ?? "";
  return /(?:他|她|这张牌|那张牌|这位|那位|这个预言家|那个预言家)\s*$/.test(lastClause);
}

function collectEvalExplicitSeerClaimantsFromSegment(
  segment: string,
  seats: Array<{ seatId: number; name?: string }>,
): number[] | undefined {
  const seerCueIndex = Math.max(segment.lastIndexOf("预言家"), segment.lastIndexOf("对跳"), segment.lastIndexOf("悍跳"), segment.lastIndexOf("双跳"));
  if (seerCueIndex < 0 && !/(?:两张|两位|两个)[^，,；;。！？!?]{0,6}(?:都|同时|一起)?$/.test(segment)) return undefined;

  const beforeCue = seerCueIndex >= 0 ? segment.slice(0, seerCueIndex) : segment;
  const localSubject = (beforeCue.split(/[，,；;。！？!?—-]/).pop() ?? beforeCue).split(/(?:说|提到|点到|聊到|认为|觉得)/).pop() ?? beforeCue;
  const claimants = collectEvalSeatRefsFromText(localSubject, seats);
  return claimants.length > 0 ? [...new Set(claimants)] : [];
}

function collectEvalSeatRefsFromText(text: string, seats: Array<{ seatId: number; name?: string }>): number[] {
  const refs: Array<{ seatId: number; index: number }> = [];
  for (const match of text.matchAll(/(\d{1,2})\s*号/g)) {
    const seatId = Number(match[1]);
    if (Number.isFinite(seatId)) refs.push({ seatId, index: match.index ?? 0 });
  }
  for (const seat of seats) {
    const name = seat.name?.trim();
    if (!name) continue;
    let index = text.indexOf(name);
    while (index >= 0) {
      refs.push({ seatId: seat.seatId, index });
      index = text.indexOf(name, index + name.length);
    }
  }
  return refs
    .sort((left, right) => left.index - right.index)
    .map((ref) => ref.seatId)
    .filter((seatId, index, values) => values.indexOf(seatId) === index);
}

function resolveEvalPublicCheckSeatRef(value: string | undefined, seats: Array<{ seatId: number; name?: string }>): number | undefined {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase();
  const match = seats.find((seat) => seat.name && seat.name.trim().toLowerCase() === clean);
  if (match) return match.seatId;
  const numeric = value.match(/(\d{1,2})/);
  if (numeric) {
    const parsed = Number(numeric[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function deniesEvalPublicCheckAttribution(sentence: string): boolean {
  return /(?:没|没有|并没|并没有|从未|未|不|不能|别把|不要把|别说成|别说|不是)[^。！？；]{0,32}(?:报|给|甩|打|留|查|验)[^。！？；]{0,32}(?:查杀|金水)/.test(
    sentence,
  );
}

function isSelfWitchPotionDisclosure(text: string): boolean {
  return (
    /(?:我(?:是)?(?:\d{1,2}\s*号[，,、\s]*)?女巫|我(?:的)?底牌(?:是)?女巫|底牌女巫|我拍女巫|女巫牌|明牌女巫|女巫在这里)/.test(text) &&
    /(?:救的是|救了|银水|用了解药|用了救药|毒的是|毒了|毒药)/.test(text)
  );
}

function isPublicWitchTargetReportAttribution(input: OrdinaryAiEvalCase, text: string): boolean {
  if (!/(?:女巫|银水|救了|救的是|救的)/.test(text)) return false;
  const targetIds = [
    ...collectSeatTargets(text, /(?:救的是|救了|救的|银水(?:是|在)?|是银水)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectSeatTargets(text, /([0-9]+|[一二三四五六七八九十两]+)\s*号[^。！？；]{0,10}(?:是银水|银水)/g),
  ];
  if (targetIds.length === 0) return false;
  const publicText = [
    input.previousSpeechText,
    ...(input.previousSpeechTexts ?? []),
    ...(Array.isArray(input.metadata?.publicFactBasis) ? input.metadata.publicFactBasis.map(String) : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
  if (!/(?:我(?:是|拍)?女巫|女巫身份|女巫牌)/.test(publicText)) return false;
  return targetIds.some((seatId) => {
    const seat = `${seatId}`;
    return new RegExp(`(?:救的是|救了|救的|银水(?:是|在)?|是银水)\\s*${seat}\\s*号?|${seat}\\s*号[^。！？；]{0,10}(?:是银水|银水)`).test(
      publicText,
    );
  });
}

function attacksPeaceNightCommonSenseAsHiddenInfo(text: string): boolean {
  if (!/(?:平安夜|女巫用药|女巫用了救药|用了救药|救药|解药)/.test(text)) return false;
  if (
    /(?:只是|仅是|只当|当作|作为|背景|公开(?:死亡形态|信息|推理|规则)|公共(?:死亡形态|信息|推理|规则)|不打这个点|不替女巫(?:确认|公开|报|说话|发言))/.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /(?:回头再看|再看|回看)/.test(text) &&
    /(?:女巫用药|女巫用了救药|用了救药|救药|解药)/.test(text) &&
    /(?:有点怪|奇怪|怪)/.test(text)
  ) {
    return true;
  }
  return (
    /(?:不是女巫|闭眼(?:平民|好人|视角)?|替女巫(?:发言|说话)|像替女巫(?:发言|说话))[^。！？；]{0,90}(?:凭什么|怎么确定|怎么知道|泄视角|有点怪|奇怪|怪)/.test(
      text,
    ) ||
    /(?:女巫用药|女巫用了救药|用了救药|救药|解药)[^。！？；]{0,60}(?:有点怪|奇怪|怪|不该|凭什么|怎么确定|怎么知道|泄视角|替女巫)/.test(
      text,
    ) ||
    /(?:凭什么|怎么确定|怎么知道)[^。！？；]{0,48}(?:女巫用药|女巫用了救药|用了救药|救药|解药)/.test(
      text,
    ) ||
    /(?:回头再看|再看|回看)[\s\S]{0,80}(?:女巫用药|女巫用了救药|用了救药|救药|解药)[\s\S]{0,40}(?:有点怪|奇怪|怪)/.test(
      text,
    )
  );
}

function lacksConcreteGameAction(input: OrdinaryAiEvalCase, text: string): boolean {
  if (input.task !== "speech") return false;
  const availablePublicCueCount = input.availablePublicCueCount ?? 0;
  const referencedPublicCueCount = input.referencedPublicCueCount ?? 0;
  const targets = collectSeatTargets(text, /([0-9]+|[一二三四五六七八九十两]+)\s*号/g);
  const hasTarget =
    targets.length > 0 ||
    input.focusSeatId !== undefined ||
    input.askTargetSeatId !== undefined ||
    input.selectedTargetSeatId !== undefined;
  const hasHandlingAction = hasOrdinaryEvalHandlingAction(text);
  const hasProgressionVerb =
    hasHandlingAction ||
    /(延续|继续|先压|先投|先出|改票|转票|追问|解释|回应|补清楚|放下|保留|归票|对跳|票型|票先往|主票口|讲实|说清|没说清|转回|平安夜|上一轮|刚才)/.test(
      text,
    );
  const isLowInfoHumanPass = availablePublicCueCount <= 1 && hasHandlingAction;

  if (!hasTarget && !isLowInfoHumanPass && availablePublicCueCount > 0 && referencedPublicCueCount <= 0) return true;
  if (!hasProgressionVerb && availablePublicCueCount > 0 && referencedPublicCueCount <= 0) return true;
  return false;
}

function hasOrdinaryEvalHandlingAction(text: string): boolean {
  return /(?:先不(?:投|压|跟|定|打死|站死|归死)|不急(?:着)?(?:投|压|跟|定|站死|归死)|暂放|暂时放|先放一下|先认|我认|追问|问\d+\s*号|票(?:口|投|压)|投|压|跟压|解释|回应|改口|先过|我过|过了|带票|带节奏|带方向|出人|归票|保留|放一轮|听进来|不跟)/.test(
    text,
  );
}

function asksBadFollowupTarget(input: OrdinaryAiEvalCase): boolean {
  if (input.askTargetSeatId === undefined || !input.aliveSeatIds?.length) return false;
  return !input.aliveSeatIds.includes(input.askTargetSeatId);
}

function repeatsPriorEmptyPressure(input: OrdinaryAiEvalCase, text: string): boolean {
  const previous = normalizeSpaces(input.previousSpeechText ?? "");
  if (!previous || previous.length < 12) return false;
  const currentCore = normalizeEvalComparisonText(text);
  const previousCore = normalizeEvalComparisonText(previous);
  if (!currentCore || currentCore !== previousCore) return false;
  return (input.referencedPublicCueCount ?? 0) <= 0;
}

function repeatsSameAxisPileOn(input: OrdinaryAiEvalCase, text: string): boolean {
  const currentAxis = extractOrdinaryAuditAxis(text);
  if (!currentAxis) return false;
  const previousTexts = [
    ...(input.previousSpeechTexts ?? []),
    ...(input.previousSpeechText ? [input.previousSpeechText] : []),
  ];
  const matchingPriorCount = previousTexts.filter((priorText) => {
    const priorAxis = extractOrdinaryAuditAxis(priorText);
    return priorAxis && priorAxis.targetSeatId === currentAxis.targetSeatId;
  }).length;
  return matchingPriorCount >= 2;
}

function extractOrdinaryAuditAxis(text: string): { targetSeatId: number } | undefined {
  if (
    !/(?:观察点|观察条件|观察位|发言缺口|压力源|这(?:句|段)?话(?:本身|其实)|没有(?:结论|来源|票口|方向)|没给(?:结论|票口|方向)|先审|继续审)/.test(
      text,
    )
  ) {
    return undefined;
  }
  const seatIds = collectSeatTargets(text, /([0-9]+|[一二三四五六七八九十两]+)\s*号/g);
  const targetSeatId = seatIds.at(-1);
  return targetSeatId ? { targetSeatId } : undefined;
}

function hasOrdinarySpeechVoteDiscontinuity(input: OrdinaryAiEvalCase, text: string): boolean {
  if (input.task !== "action" || input.phase !== "DAY_VOTE") return false;
  return hasSpeechVoteDiscontinuity(
    {
      outputText: text,
      phase: input.phase,
      task: "action",
      reasoningCueCount: input.availablePublicCueCount,
      referencedReasoningCueCount: input.referencedPublicCueCount,
      voteTargetSeatId: input.selectedTargetSeatId,
      lastSpeechTargetSeatId: input.lastSpeechTargetSeatId,
      previousSpeechText: input.previousSpeechText,
      myRole: input.playerRole,
    },
    text,
  );
}

function collectOrdinaryPositiveSignals(
  input: OrdinaryAiEvalCase,
  text: string,
  issues: OrdinaryAiEvalIssue[],
): OrdinaryAiEvalPositiveSignal[] {
  const signals: OrdinaryAiEvalPositiveSignal[] = [];
  const hasBlockingIssue = issues.some((issue) => issue.severity === "error");
  if (!hasBlockingIssue && isWeakButHumanSpeech(text)) signals.push("weakButHumanPasses");
  if (!hasBlockingIssue && isEmotionalButGroundedSpeech(text)) signals.push("emotionalButGroundedPasses");
  if (!hasBlockingIssue && isDefensiveSelfMotiveSpeech(text)) signals.push("defensiveSelfMotivePasses");
  if (!hasBlockingIssue && isRolePublicActionSpeech(input, text)) signals.push("rolePublicActionPasses");
  return [...new Set(signals)];
}

function isWeakButHumanSpeech(text: string): boolean {
  return (
    /(?:我不知道|我这位置没东西|没听出太多|没视角|信息少|只能按好人视角|聊不出太多)/.test(text) &&
    /(?:先不(?:投|压|跟|定|打死|站死|归死)|先听|再听|先过|我过|暂放|不把票打死|谁急着|后面谁)/.test(text)
  );
}

function isEmotionalButGroundedSpeech(text: string): boolean {
  return (
    /(?:不舒服|别扭|烦|急|怕|嘴硬|真不舒服|听着怪)/.test(text) &&
    /(?:你|他|\d+\s*号|刚才|这句|票|投|压|问|解释|回应)/.test(text) &&
    (hasOrdinaryEvalHandlingAction(text) || /(?:只问你|问你|今天票|票想怎么落|怎么落票)/.test(text))
  );
}

function isDefensiveSelfMotiveSpeech(text: string): boolean {
  return (
    /(?:你打我|点到我|打我这个点|我先解释|先解释这个点|我说的是|不是我泄视角|不是在报身份)/.test(text) &&
    /(?:因为|不是|我刚才|我说|今天|票|压|依据|解释)/.test(text)
  );
}

function isRolePublicActionSpeech(input: OrdinaryAiEvalCase, text: string): boolean {
  if (input.playerRole === "SEER") {
    return /(?:我(?:跳|是)?预言家|预言家).{0,36}(?:验了|查验|查杀|金水)/.test(text) && /(?:今天|票|压|别进|对撞)/.test(text);
  }
  if (input.playerRole === "WITCH") {
    return /(?:我(?:拍|是)?女巫|女巫).{0,48}(?:救的是|救了|银水|毒的是|毒了)/.test(text) && /(?:今天|票|先别|开|压|归)/.test(text);
  }
  if (input.playerRole === "HUNTER") {
    return /(?:我(?:拍|是)?猎人|枪在|我这枪)/.test(text) && /(?:今天|出我|带信息|别分票|票)/.test(text);
  }
  return false;
}

function normalizeEvalComparisonText(text: string): string {
  return normalizeSpaces(text)
    .replace(/[0-9一二三四五六七八九十两]+\s*号/g, "{seat}")
    .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function clipEvalEvidence(text: string, limit = 80): string {
  const clean = normalizeSpaces(text);
  return clean.length <= limit ? clean : clean.slice(0, limit);
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
  if (
    input.previousSpeechText !== undefined &&
    claimsPreviousSpeechTarget(text) &&
    !renderedEvalSpeechSupportsSeatTarget(input.previousSpeechText, input.lastSpeechTargetSeatId)
  ) {
    return true;
  }
  if (input.voteTargetSeatId === input.lastSpeechTargetSeatId) {
    return !/(上一轮|刚才|延续|继续|未解除|没解释|没补清楚|同一条线)/.test(text);
  }
  return !/(转票|改票|改投|从.{0,8}\d+\s*号.{0,8}到.{0,8}\d+\s*号|新增|更硬|票型|对跳)/.test(text);
}

function claimsPreviousSpeechTarget(text: string): boolean {
  return /(?:上一轮|上轮|刚才|前面|之前).{0,16}(?:我)?(?:发言)?(?:已经)?(?:点过|压过|打过|盯过|提过|说过)|(?:我)?(?:上一轮|上轮)(?:发言)?(?:已经)?(?:点过|压过|打过|盯过)/.test(
    text,
  );
}

function renderedEvalSpeechSupportsSeatTarget(speech: string | undefined, seatId: number | undefined): boolean {
  if (!speech || !Number.isInteger(seatId)) return false;
  const targetPattern = new RegExp(`${seatId}\\s*号`);
  const sentences = speech.match(/[^。！？；;]+[。！？；;]?/g) ?? [speech];
  return sentences.some((sentence) => {
    if (!targetPattern.test(sentence)) return false;
    return /(?:票|投|压|点|打|出|归|盯|看|问|追|怀疑|不认|认下|暂放|保|站|补|解释|说清|没说清|不舒服|别扭|矛盾|疑点|问题|狼|好|金水|银水|查杀|身份|女巫|预言家)/.test(
      sentence,
    );
  });
}

function hasOvercertainClaimWithoutEvidence(input: LlmCallQualityInput, text: string): boolean {
  if ((input.reasoningCueCount ?? 0) <= 0 || (input.referencedReasoningCueCount ?? 0) > 0) return false;
  if (/(可能|大概率|倾向|更像|目前|暂时|先压|保留|软信息|不站死)/.test(text)) return false;
  return /(铁狼|必狼|百分百|一定是狼|肯定是狼|确定是狼|坐实狼)/.test(text);
}

function hasMalformedOutputFragment(text: string, task: "speech" | "action"): boolean {
  return (
    /(^|\s)["']?:["']?/.test(text) ||
    /[，,;；:]$/.test(text) ||
    (task === "speech" && isOrdinaryTruncatedSpeechEnding(text)) ||
    hasForwardCommitmentEnding(text) ||
    hasForwardCommitmentOnlyRestatement(text) ||
    hasUnfinishedOrdinaryFocusMarker(text) ||
    /(?:说|提|讲)?(?:[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:那句|这句|那句话|这句话)$/.test(text.slice(-48)) ||
    /(?:^|[，,。！？!?；;\s])(?:你|他|她|它|[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:刚才|前面|后面)?(?:又)?说$/.test(
      text.slice(-48),
    ) ||
    hasUnfinishedQuoteComprehensionTail(text) ||
    /(?:但|但是|不过|可是|可)[^。！？；]{0,32}(?:你|他|她|它|[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:后面|前面|刚才)?又说$/.test(
      text.slice(-48),
    )
  );
}

function hasUnfinishedQuoteComprehensionTail(text: string): boolean {
  const tail = text.slice(-90);
  const matched =
    /(?:[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?[^。！？；]{0,24}(?:刚才|前面)?(?:那句|这句|那句话|这句话|那段|这段|发言|话)[^。！？；]{0,30}(?:我)?(?:有点|比较|确实)?(?:没听明白|不明白|听不懂)[。！？]?$/.test(
      tail,
    );
  if (!matched) return false;
  return !/(?:这个|这处|这段|这条)(?:转折|逻辑|理由|说法|动作|切换)[^。！？；]{0,18}(?:没听明白|不明白|听不懂)[。！？]?$/.test(
    tail,
  );
}

function hasForwardCommitmentEnding(text: string): boolean {
  const withoutClosingPunctuation = text.replace(/[。！？!?；;]+$/g, "").trim();
  if (!withoutClosingPunctuation) return false;
  const boundaryIndex = Math.max(
    withoutClosingPunctuation.lastIndexOf("。"),
    withoutClosingPunctuation.lastIndexOf("！"),
    withoutClosingPunctuation.lastIndexOf("？"),
    withoutClosingPunctuation.lastIndexOf("；"),
    withoutClosingPunctuation.lastIndexOf(";"),
    withoutClosingPunctuation.lastIndexOf("!"),
    withoutClosingPunctuation.lastIndexOf("?"),
    withoutClosingPunctuation.lastIndexOf("，"),
    withoutClosingPunctuation.lastIndexOf(","),
  );
  const sentence = withoutClosingPunctuation.slice(boundaryIndex >= 0 ? boundaryIndex + 1 : 0).replace(/\s+/g, "");
  return (
    /^(?:我)?(?:先)?(?:说|讲|解释|交代)(?:一下)?(?:我)?为什么(?:现在|这时候|这个时候)?(?:要)?(?:跳|拍|报)(?:身份|女巫|预言家|猎人)?$/.test(
      sentence,
    ) ||
    /^(?:我)?(?:接下来|后面|下面)(?:先)?(?:说|讲|解释|聊)(?:一下)?(?:为什么|这个点|我的理由|我的想法)?$/.test(sentence) ||
    /^(?:我)?(?:现在|这轮|今天)?(?:想|准备|打算)(?:换|转)(?:个|一个)?(?:方向|角度|视角)(?:看|聊|听)?$/.test(sentence) ||
    /^(?:我)?(?:还)?有(?:个|一个)?(?:更)?(?:让|令)?我(?:更)?(?:不舒服|别扭|卡住|没听明白)(?:的)?(?:地方|点|一件事|问题)?$/.test(
      sentence,
    )
  );
}

function hasForwardCommitmentOnlyRestatement(text: string): boolean {
  const sentences = (text.match(/[^。！？；;]+[。！？；;]?/g) ?? [])
    .map((sentence) => sentence.replace(/[。！？；;]+$/g, "").trim())
    .filter(Boolean);
  if (sentences.length < 2) return false;
  for (let index = 0; index < sentences.length - 1; index += 1) {
    if (!isForwardSetupSentence(sentences[index]!)) continue;
    const tail = sentences.slice(index + 1);
    if (tail.length === 0 || tail.length > 2) continue;
    if (tail.every(isPublicInfoRestatementWithoutOwnHandling)) return true;
  }
  return false;
}

function isForwardSetupSentence(sentence: string): boolean {
  const clean = sentence.replace(/\s+/g, "");
  return (
    /^(?:但|不过)?(?:我)?(?:现在|这轮|今天)?(?:不舒服|别扭|卡住|没听明白|想说|想聊|想看|想问|要说|要讲)(?:的是|的点是|的是另一件事|另一件事|一个点|这个点|一件事)?$/.test(
      clean,
    ) ||
    /^(?:但|不过)?(?:我)?(?:还)?有(?:个|一个)?(?:更)?(?:让|令)?我(?:更)?(?:不舒服|别扭|卡住|没听明白)(?:的)?(?:地方|点|一件事|问题)?$/.test(
      clean,
    )
  );
}

function isPublicInfoRestatementWithoutOwnHandling(sentence: string): boolean {
  if (!/(?:\d{1,2}\s*号|[A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/.test(sentence)) return false;
  if (!/(?:说|跳|拍|报|救|验|投|票|是|银水|金水|查杀|倒牌|出局|放逐|平安夜|狼刀|女巫|预言家)/.test(sentence)) {
    return false;
  }
  return !/(?:我(?:先|这轮|今天|现在)?[^。！？；]{0,24}(?:投|票|压|问|追|看|盯|认|不认|怀疑|暂放|放下|转|改|保留|需要)|(?:所以|因此|这轮|今天)[^。！？；]{0,24}(?:投|票|压|问|追|看|盯|认|不认|怀疑|暂放|放下|转|改|保留|需要)|(?:疑点|问题|没说清|哪里不对|哪里没落地))/.test(
    sentence,
  );
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

function buildEvaluationNickname(baseNickname: string, index: number, cycleSize: number): string {
  const clean = baseNickname.trim() || `AI${index + 1}`;
  const cycle = cycleSize > 0 ? Math.floor(index / cycleSize) : 0;
  return (cycle === 0 ? clean : `${clean}${cycle + 1}`).slice(0, 16);
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

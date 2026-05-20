import { z } from "zod";
import type {
  ActionTarget,
  AgentView,
  AiFriendRuntimeLlmConfig,
  AiTableRead,
  AvailableHumanAction,
  Command,
  Role,
  SeatRead,
  TableMemory,
  VotePlan,
} from "@/game/types";
import { isWolfRole } from "@/game/roleUtils";
import {
  callRoutedModelJsonWithFallbacks,
  isModelLlmRoutingAvailable,
  packLlmOutputAttempts,
  parseLlmJsonOutput,
  readLlmOutputMaxAttempts,
  readRenderedProviderId,
  readRenderedText,
  trimLlmOutputForRetry,
  type LlmOutputAttemptLog,
  type LlmOutputStabilityHint,
  type RoutedLlmResponse,
} from "./modelLlms";
import { buildAdvancedReasoningNotes } from "./advancedReasoning";
import { buildClaimAudit, type AiClaimAudit } from "./claimAudit";
import { buildDebateAgenda, type AiDebateAgenda } from "./debateAgenda";
import { buildExpertStrategyNotes } from "./expertStrategy";
import { buildReasoningFrame, type AiReasoningFrame } from "./reasoningFrame";
import { buildRolePlaybook, type AiRolePlaybook } from "./rolePlaybook";
import type { AiActionProvider, AiActionProviderContext, AiActionResult } from "./types";

const ActionDecisionSchema = z
  .object({
    candidateId: z.coerce.string().min(1).max(80),
    reason: z.coerce.string().optional().default(""),
    message: z.coerce.string().optional().default(""),
  });

type ActionDecision = z.infer<typeof ActionDecisionSchema>;
type LlmActionRenderer = (input: LlmActionInput) => Promise<string | RoutedLlmResponse>;

export type LlmActionCandidate = {
  id: string;
  label: string;
  command: Command;
  target?: ActionTarget;
  reasonHint?: string;
  recommended?: boolean;
};

export type LlmActionInput = {
  day: number;
  phase: AgentView["phase"];
  mySeatId: number;
  myRole: Role;
  persona?: AgentView["persona"];
  aliveSeats: ActionTarget[];
  publicContext: {
    recentSpeeches: AgentView["publicSummary"]["recentSpeeches"];
    recentVotes: AgentView["publicSummary"]["recentVotes"];
    voteSnapshot: AgentView["publicSummary"]["voteSnapshot"];
    recentDeaths: string[];
    claimBoard: AgentView["publicSummary"]["claimBoard"];
    decisionSummary: {
      focus: string[];
      candidatePublicEvidence: Array<{
        seat: ActionTarget;
        evidence: string[];
      }>;
      votePressure: string[];
      speechChain: string[];
      claimPressure: string[];
    };
    tableMemory: Pick<
      TableMemory,
      | "day"
      | "claimBoard"
      | "stanceBoard"
      | "stanceShifts"
      | "seerLegacies"
      | "speechInfluence"
      | "reasoningCues"
      | "counterclaims"
      | "focus"
      | "voteHistory"
      | "publicSignals"
    >;
  };
  selfContext: {
    role: Role;
    aiMemory?: AgentView["privateKnowledge"]["aiMemory"];
    knownWolfSeatIds: number[];
    knownGoodSeatIds: number[];
    wolfTeammateSeatIds: number[];
    witch?: AgentView["privateKnowledge"]["witch"];
    pendingHunterShot?: AgentView["privateKnowledge"]["pendingHunterShot"];
    pendingWolfKingShot?: AgentView["privateKnowledge"]["pendingWolfKingShot"];
    wolfPlan?: {
      strategy: NonNullable<AgentView["privateKnowledge"]["wolfTeamPlan"]>["strategy"];
      summary: string;
      nightStrategy?: {
        nightTarget?: ActionTarget;
        dayPressureTarget?: ActionTarget;
        summary: string;
        discussion: string[];
      };
      primaryTarget?: ActionTarget;
      threat?: ActionTarget;
      ownAssignment?: {
        taskLabel: string;
        target?: ActionTarget;
        supportSeat?: ActionTarget;
        privateReason: string;
      };
    };
  };
  tableRead: {
    tableMood: string;
    focus?: CompactSeatRead;
    backupFocus?: CompactSeatRead;
    seats: CompactSeatRead[];
  };
  expertStrategy: string[];
  advancedReasoning: string[];
  reasoningFrame: AiReasoningFrame;
  rolePlaybook: AiRolePlaybook;
  claimAudit: AiClaimAudit;
  debateAgenda: AiDebateAgenda;
  votePlan?: VotePlan;
  fallbackCandidateId?: string;
  candidates: LlmActionCandidate[];
  constraints: string[];
  llmConfig?: AiFriendRuntimeLlmConfig;
  stability?: LlmOutputStabilityHint;
};

type CompactSeatRead = ActionTarget & {
  suspicion: number;
  trust: number;
  pressure: string[];
  isSelf: boolean;
  isKnownWolf: boolean;
  isKnownGood: boolean;
  isWolfTeammate: boolean;
  votesReceived: number;
  publicClaims: SeatRead["publicClaims"];
  publicChecksAgainst: SeatRead["publicChecksAgainst"];
};

export function createConfiguredActionProvider(defaultProvider: AiActionProvider): AiActionProvider {
  if (process.env.AI_ACTION_PROVIDER === "mock" || process.env.AI_DECISION_PROVIDER === "mock") {
    return createCustomAwareActionProvider(defaultProvider);
  }

  if (isModelLlmRoutingAvailable()) {
    return routedModelActionProvider;
  }

  if ((process.env.AI_ACTION_PROVIDER === "openai" || process.env.AI_DECISION_PROVIDER === "openai") && process.env.OPENAI_API_KEY) {
    return createCustomAwareActionProvider(openAiActionProvider);
  }

  return createCustomAwareActionProvider(defaultProvider);
}

function createCustomAwareActionProvider(defaultProvider: AiActionProvider): AiActionProvider {
  return {
    providerId: "custom-aware-action",
    generateCommand(view, context) {
      return view.llmConfig
        ? routedModelActionProvider.generateCommand(view, context)
        : defaultProvider.generateCommand(view, context);
    },
  };
}

export function createConstrainedLlmActionProvider(options: {
  providerId: string;
  render: LlmActionRenderer;
  maxAttempts?: (input: LlmActionInput) => number;
}): AiActionProvider {
  return {
    providerId: options.providerId,
    async generateCommand(view, context) {
      const input = buildConstrainedActionInput(view, context);
      const attempts: LlmOutputAttemptLog[] = [];
      const maxAttempts = options.maxAttempts?.(input) ?? readLlmOutputMaxAttempts();
      let providerId = options.providerId;
      let lastIssue = "LLM action failed.";
      let lastValidationErrors: string[] | undefined;
      let lastRawOutput: string | undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const rendered = await options.render(withActionStabilityHint(input, attempt, lastIssue, lastRawOutput));
          const rawOutput = readRenderedText(rendered);
          providerId = readRenderedProviderId(rendered) ?? providerId;
          lastRawOutput = rawOutput;

          const parsed = parseActionDecision(rawOutput, input);
          if (!parsed.success) {
            lastIssue = parsed.issue;
            lastValidationErrors = undefined;
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue });
            continue;
          }

          const validationErrors = validateActionDecision(view, input, parsed.decision);
          if (validationErrors.length > 0) {
            lastIssue = `LLM action did not pass constraints: ${validationErrors.join("; ")}`;
            lastValidationErrors = validationErrors;
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue, validationErrors });
            continue;
          }

          const selected = input.candidates.find((candidate) => candidate.id === parsed.decision.candidateId);
          if (!selected) {
            lastIssue = "LLM selected a missing candidate.";
            lastValidationErrors = ["missing candidate"];
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue, validationErrors: lastValidationErrors });
            continue;
          }

          attempts.push({ attempt, provider: providerId, rawOutput });
          return {
            command: commandFromDecision(selected.command, parsed.decision, selected.reasonHint),
            provider: providerId,
            rawOutput: packLlmOutputAttempts(attempts),
            isFallback: false,
          };
        } catch (error) {
          lastIssue = error instanceof Error ? error.message : "LLM action failed.";
          attempts.push({ attempt, provider: providerId, rawOutput: lastRawOutput, issue: lastIssue });
        }
      }

      return fallbackAction(
        providerId,
        context,
        lastIssue,
        packLlmOutputAttempts(attempts),
        lastValidationErrors,
      );
    },
  };
}

export const openAiActionProvider: AiActionProvider = createConstrainedLlmActionProvider({
  providerId: "openai-action",
  render: callOpenAiAction,
});

export const routedModelActionProvider: AiActionProvider = createConstrainedLlmActionProvider({
  providerId: "model-routed-action",
  render: callRoutedModelAction,
  maxAttempts: readRoutedActionOutputMaxAttempts,
});

export function buildConstrainedActionInput(view: AgentView, context: AiActionProviderContext): LlmActionInput {
  const votePlan = sanitizeActionVotePlan(view, context.votePlan);
  const candidates = buildActionCandidates(view, context.tableRead, votePlan, context.fallbackCommand);
  const fallbackCandidateId = candidates.find((candidate) => sameCommand(candidate.command, context.fallbackCommand))?.id;
  const debateAgenda = buildDebateAgenda(view, { tableRead: context.tableRead, target: votePlan?.target });

  return {
    day: view.day,
    phase: view.phase,
    mySeatId: view.mySeatId,
    myRole: view.myRole,
    persona: view.persona,
    aliveSeats: view.aliveSeats,
    publicContext: {
      recentSpeeches: view.publicSummary.recentSpeeches.slice(-8),
      recentVotes: view.publicSummary.recentVotes.slice(-8),
      voteSnapshot: view.publicSummary.voteSnapshot,
      recentDeaths: view.publicSummary.recentDeaths.slice(-4),
      claimBoard: view.publicSummary.claimBoard,
      decisionSummary: buildPublicActionDecisionSummary(view, candidates),
      tableMemory: {
        day: view.publicSummary.tableMemory.day,
        claimBoard: view.publicSummary.tableMemory.claimBoard,
        stanceBoard: view.publicSummary.tableMemory.stanceBoard.slice(-12),
        stanceShifts: view.publicSummary.tableMemory.stanceShifts.slice(-8),
        seerLegacies: view.publicSummary.tableMemory.seerLegacies.slice(0, 4),
        speechInfluence: view.publicSummary.tableMemory.speechInfluence.slice(0, 6),
        reasoningCues: view.publicSummary.tableMemory.reasoningCues.slice(0, 8),
        counterclaims: view.publicSummary.tableMemory.counterclaims,
        focus: view.publicSummary.tableMemory.focus.slice(0, 4),
        voteHistory: view.publicSummary.tableMemory.voteHistory.slice(-3),
        publicSignals: view.publicSummary.tableMemory.publicSignals.slice(-8),
      },
    },
    selfContext: buildSelfActionContext(view, context.tableRead),
    tableRead: {
      tableMood: context.tableRead.tableMood,
      focus: context.tableRead.focus ? compactSeatRead(context.tableRead.focus) : undefined,
      backupFocus: context.tableRead.backupFocus ? compactSeatRead(context.tableRead.backupFocus) : undefined,
      seats: context.tableRead.seats.map(compactSeatRead),
    },
    expertStrategy: buildExpertStrategyNotes(view),
    advancedReasoning: buildAdvancedReasoningNotes(view),
    reasoningFrame: buildReasoningFrame(view),
    rolePlaybook: buildRolePlaybook(view),
    claimAudit: buildClaimAudit(view),
    debateAgenda,
    votePlan,
    fallbackCandidateId,
    candidates,
    constraints: buildActionConstraints(view),
    llmConfig: view.llmConfig,
  };
}

function sanitizeActionVotePlan(view: AgentView, votePlan: VotePlan | undefined): VotePlan | undefined {
  if (!votePlan || isWolfRole(view.myRole, view.rules.wolfRoles)) return votePlan;
  const publicVotePlan = { ...votePlan };
  delete publicVotePlan.wolfVoteTactic;
  return publicVotePlan;
}

function buildPublicActionDecisionSummary(
  view: AgentView,
  candidates: LlmActionCandidate[],
): LlmActionInput["publicContext"]["decisionSummary"] {
  const memory = view.publicSummary.tableMemory;
  const candidateTargets = uniqueActionTargets(
    candidates
      .map((candidate) => candidate.target ?? commandTarget(view, candidate.command))
      .filter((target): target is ActionTarget => Boolean(target)),
  ).slice(0, 6);

  return {
    focus: [
      ...memory.focus.map((item) => `Focus ${seatLabel(item.seat)}: ${item.reasons.join("; ")}`),
      ...memory.publicSignals.slice(-4),
    ].map(compactPublicLine).filter(Boolean).slice(0, 6),
    candidatePublicEvidence: candidateTargets.map((target) => ({
      seat: target,
      evidence: publicEvidenceForTarget(view, target).slice(0, 6),
    })),
    votePressure: buildVotePressureLines(view).slice(0, 5),
    speechChain: view.publicSummary.recentSpeeches
      .slice(-5)
      .map((speech) =>
        compactPublicLine(`${speech.speaker ? seatLabel(speech.speaker) : "unknown"}: ${speech.message}`),
      )
      .filter(Boolean),
    claimPressure: view.publicSummary.tableMemory.counterclaims
      .map((group) => `${group.claimedRoleLabel} counterclaim: ${group.claimants.map(seatLabel).join(" vs ")}`)
      .concat(view.publicSummary.claimBoard.slice(-5).map((claim) => claim.summary))
      .map(compactPublicLine)
      .filter(Boolean)
      .slice(0, 6),
  };
}

function publicEvidenceForTarget(view: AgentView, target: ActionTarget): string[] {
  const memory = view.publicSummary.tableMemory;
  const cueLines = memory.reasoningCues
    .filter((cue) => cue.actor?.seatId === target.seatId || cue.target?.seatId === target.seatId)
    .map((cue) => `${cue.weight} ${cue.kind}: ${cue.summary}`);
  const focusLines = memory.focus
    .filter((item) => item.seat.seatId === target.seatId)
    .flatMap((item) => item.reasons.map((reason) => `focus: ${reason}`));
  const claimLines = view.publicSummary.claimBoard
    .filter(
      (claim) =>
        claim.claimant.seatId === target.seatId ||
        claim.checks.some((check) => check.target.seatId === target.seatId),
    )
    .flatMap((claim) => [
      claim.claimant.seatId === target.seatId
        ? `${seatLabel(claim.claimant)} claimed ${claim.claimedRoleLabel}`
        : undefined,
      ...claim.checks
        .filter((check) => check.target.seatId === target.seatId)
        .map((check) => `${seatLabel(claim.claimant)} reported ${seatLabel(target)} as ${check.result === "WEREWOLF" ? "wolf-side" : "good-side"}`),
    ]);
  const voteLines = view.publicSummary.voteSnapshot.votes
    .filter((vote) => vote.target?.seatId === target.seatId || vote.voter.seatId === target.seatId)
    .slice(-4)
    .map((vote) =>
      vote.target
        ? `vote: ${seatLabel(vote.voter)} -> ${seatLabel(vote.target)}${vote.reason ? ` (${vote.reason})` : ""}`
        : `vote: ${seatLabel(vote.voter)} abstained${vote.reason ? ` (${vote.reason})` : ""}`,
    );
  const speechLines = view.publicSummary.recentSpeeches
    .filter((speech) => speechMentionsTarget(speech.message, target))
    .slice(-3)
    .map((speech) => `speech: ${speech.speaker ? seatLabel(speech.speaker) : "unknown"} mentioned ${seatLabel(target)}`);

  const evidence = [...cueLines, ...focusLines, ...claimLines, ...voteLines, ...speechLines]
    .map(compactPublicLine)
    .filter(Boolean);
  return evidence.length > 0 ? [...new Set(evidence)] : ["No strong public evidence yet; avoid overconfident action unless the candidate list leaves no better choice."];
}

function buildVotePressureLines(view: AgentView): string[] {
  const snapshot = view.publicSummary.voteSnapshot;
  const tallyLines = snapshot.tally.map((item) => `${seatLabel(item.target)} has ${item.count} public vote(s)`);
  const leaderLine = snapshot.leaders.length > 0 ? `Current vote leader(s): ${snapshot.leaders.map(seatLabel).join(", ")}` : undefined;
  const abstainLine = snapshot.abstainCount ? `${snapshot.abstainCount} abstention(s)` : undefined;
  const historyLines = view.publicSummary.tableMemory.voteHistory.slice(-2).map((vote) => {
    if (vote.tiedSeatIds.length > 0) return `D${vote.day} tied exile pressure: ${vote.tiedSeatIds.join(", ")}`;
    if (vote.exiled) return `D${vote.day} exiled ${seatLabel(vote.exiled)}`;
    return `D${vote.day} leaders: ${vote.leaders.map(seatLabel).join(", ")}`;
  });

  return [leaderLine, ...tallyLines, abstainLine, ...historyLines].map(compactPublicLine).filter(Boolean);
}

function uniqueActionTargets(targets: ActionTarget[]): ActionTarget[] {
  const seen = new Set<number>();
  const unique: ActionTarget[] = [];
  for (const target of targets) {
    if (seen.has(target.seatId)) continue;
    seen.add(target.seatId);
    unique.push(target);
  }
  return unique;
}

function speechMentionsTarget(message: string, target: ActionTarget): boolean {
  const seatPattern = new RegExp(`(^|\\D)${target.seatId}(\\D|$)`);
  return seatPattern.test(message) || Boolean(target.name && message.includes(target.name));
}

function seatLabel(seat: ActionTarget): string {
  return `${seat.seatId}#${seat.name}`;
}

function compactPublicLine(line: string | undefined): string {
  const clean = (line ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= 180 ? clean : `${clean.slice(0, 179)}...`;
}

function withActionStabilityHint(
  input: LlmActionInput,
  attempt: number,
  previousIssue: string,
  previousOutput: string | undefined,
): LlmActionInput {
  if (attempt <= 1) return input;
  return {
    ...input,
    stability: {
      attempt,
      previousIssue,
      previousOutput: trimLlmOutputForRetry(previousOutput),
      expectedFormat: "{\"candidateId\":\"候选项 id\",\"reason\":\"公开可见的简短理由\",\"message\":\"遗言阶段可填写自定义遗言\"}",
    },
  };
}

function parseActionDecision(
  rawOutput: string,
  input: LlmActionInput,
): { success: true; decision: ActionDecision } | { success: false; issue: string } {
  let candidate: unknown;
  try {
    candidate = parseLlmJsonOutput(rawOutput);
  } catch {
    candidate = rawOutput;
  }

  const coerced = coerceActionDecision(candidate, input);
  const parsed = ActionDecisionSchema.safeParse(coerced);
  if (parsed.success) {
    return { success: true, decision: parsed.data };
  }

  return { success: false, issue: "LLM action output is not valid JSON for the schema." };
}

function coerceActionDecision(value: unknown, input: LlmActionInput): Partial<ActionDecision> {
  const fields = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sourceText = typeof value === "string" ? value : JSON.stringify(value);
  const rawCandidateId = readFirstString(fields, ["candidateId", "candidate_id", "id", "choice", "selected", "action"]);
  const candidateId =
    resolveCandidateId(rawCandidateId, input) ??
    rawCandidateId ??
    resolveCandidateIdFromTarget(fields, input) ??
    resolveCandidateId(sourceText, input) ??
    resolveTruncatedCandidateId(sourceText, input);
  const reason = readFirstString(fields, ["reason", "rationale", "explanation", "why", "理由"]) ?? extractInlineReason(sourceText);
  const message = readFirstString(fields, ["message", "speech", "lastWords", "last_words", "text", "遗言", "发言"]);

  return {
    ...(candidateId ? { candidateId } : {}),
    ...(reason ? { reason } : {}),
    ...(message ? { message } : {}),
  };
}

function resolveTruncatedCandidateId(sourceText: string, input: LlmActionInput): string | undefined {
  if (!input.fallbackCandidateId) return undefined;
  return /["']?candidate_?id["']?\s*[:：]\s*["']?[^"'，,}\]\s]*$/i.test(sourceText.trim())
    ? input.fallbackCandidateId
    : undefined;
}

function readFirstString(fields: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function resolveCandidateId(rawCandidateId: string | undefined, input: LlmActionInput): string | undefined {
  if (!rawCandidateId) return undefined;
  const normalized = normalizeCandidateText(rawCandidateId);
  const exact = input.candidates.find(
    (candidate) => normalizeCandidateText(candidate.id) === normalized || normalizeCandidateText(candidate.label) === normalized,
  );
  if (exact) return exact.id;

  const targetSeatId = extractSeatId(rawCandidateId);
  if (targetSeatId) return resolveSingleTargetCandidate(targetSeatId, input);

  if (/fallback|recommended|本地|默认/.test(normalized) && input.fallbackCandidateId) return input.fallbackCandidateId;
  if (/skip|pass|hold|abstain|弃票|弃权|跳过|不用|不使用/.test(normalized)) {
    const skip = input.candidates.find((candidate) =>
      /skip|pass|hold|abstain|弃票|弃权|跳过|不用|不使用/.test(normalizeCandidateText(candidate.id + candidate.label)),
    );
    if (skip) return skip.id;
  }

  return undefined;
}

function resolveCandidateIdFromTarget(fields: Record<string, unknown>, input: LlmActionInput): string | undefined {
  const targetText = readFirstString(fields, ["targetSeatId", "target_seat_id", "target", "seatId", "seat", "目标"]);
  const targetSeatId = targetText ? extractSeatId(targetText) : undefined;
  if (targetSeatId) {
    const actionText = readFirstString(fields, ["type", "command", "mode", "action"]);
    const byAction = actionText ? resolveTargetCandidateByAction(targetSeatId, actionText, input) : undefined;
    return byAction ?? resolveSingleTargetCandidate(targetSeatId, input);
  }

  const actionText = readFirstString(fields, ["type", "command", "mode", "action"]);
  return actionText ? resolveCandidateId(actionText, input) : undefined;
}

function resolveTargetCandidateByAction(targetSeatId: number, actionText: string, input: LlmActionInput): string | undefined {
  const normalizedAction = normalizeCandidateText(actionText);
  const matches = input.candidates.filter((candidate) => {
    const target = "targetSeatId" in candidate.command ? candidate.command.targetSeatId : undefined;
    if (target !== targetSeatId) return false;
    const haystack = normalizeCandidateText(`${candidate.id} ${candidate.label} ${candidate.command.type}`);
    return haystack.includes(normalizedAction) || normalizedAction.includes(candidate.command.type.toLowerCase());
  });
  return matches.length === 1 ? matches[0]?.id : undefined;
}

function resolveSingleTargetCandidate(targetSeatId: number, input: LlmActionInput): string | undefined {
  const matches = input.candidates.filter(
    (candidate) => "targetSeatId" in candidate.command && candidate.command.targetSeatId === targetSeatId,
  );
  return matches.length === 1 ? matches[0]?.id : undefined;
}

function extractSeatId(value: string): number | undefined {
  const normalized = value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
  const match = normalized.match(/(?:seat|target|玩家|座位|目标)?\s*(\d+)\s*(?:号|seat)?/i);
  if (!match) return undefined;
  const seatId = Number(match[1]);
  return Number.isInteger(seatId) ? seatId : undefined;
}

function normalizeCandidateText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function extractInlineReason(value: string): string | undefined {
  const match = value.match(/(?:reason|because|理由|因为)[:：]?\s*([^。；;\n\r]+)/i);
  return match?.[1]?.trim();
}

export function validateActionDecision(view: AgentView, input: LlmActionInput, decision: ActionDecision): string[] {
  const errors: string[] = [];
  const candidate = input.candidates.find((item) => item.id === decision.candidateId);
  const message = cleanLastWordsMessage(decision.message);

  if (!candidate) {
    errors.push("candidateId is not in the allowed candidate list");
    return errors;
  }

  if (candidate.command.actorSeatId !== view.mySeatId) {
    errors.push("candidate actor does not match current AI seat");
  }

  if (candidate.command.type === "speak" && !getAction(view, "whiteWolfKingExplode")) {
    errors.push("action provider cannot select speech commands");
  }

  const reasonIssue = validateActionReasonQuality(decision.reason);
  if (reasonIssue) {
    errors.push(reasonIssue);
  }

  if (candidate.command.type === "lastWords" && message && containsActionPrivateLeak(message)) {
    errors.push("last words leak private or system context");
  }

  return errors;
}

function buildSelfActionContext(view: AgentView, tableRead: AiTableRead): LlmActionInput["selfContext"] {
  const wolfPlan = view.privateKnowledge.wolfTeamPlan;
  const ownAssignment = wolfPlan?.assignments.find((assignment) => assignment.seat.seatId === view.mySeatId);

  return {
    role: view.myRole,
    aiMemory: view.privateKnowledge.aiMemory,
    knownWolfSeatIds: tableRead.knownWolfSeatIds,
    knownGoodSeatIds: tableRead.knownGoodSeatIds,
    wolfTeammateSeatIds: tableRead.wolfTeammateSeatIds,
    witch: view.privateKnowledge.witch,
    pendingHunterShot: view.privateKnowledge.pendingHunterShot,
    pendingWolfKingShot: view.privateKnowledge.pendingWolfKingShot,
    wolfPlan: wolfPlan
      ? {
          strategy: wolfPlan.strategy,
          summary: wolfPlan.summary,
          nightStrategy: wolfPlan.nightStrategy
            ? {
                nightTarget: wolfPlan.nightStrategy.nightTarget,
                dayPressureTarget: wolfPlan.nightStrategy.dayPressureTarget,
                summary: wolfPlan.nightStrategy.summary,
                discussion: wolfPlan.nightStrategy.discussion,
              }
            : undefined,
          primaryTarget: wolfPlan.primaryTarget,
          threat: wolfPlan.threat,
          ownAssignment: ownAssignment
            ? {
                taskLabel: ownAssignment.taskLabel,
                target: ownAssignment.target,
                supportSeat: ownAssignment.supportSeat,
                privateReason: ownAssignment.reason,
              }
            : undefined,
        }
      : undefined,
  };
}

function buildActionCandidates(
  view: AgentView,
  tableRead: AiTableRead,
  votePlan: VotePlan | undefined,
  fallbackCommand: Command,
): LlmActionCandidate[] {
  const candidates: LlmActionCandidate[] = [];
  const add = (candidate: LlmActionCandidate) => {
    if (candidates.some((item) => sameCommand(item.command, candidate.command))) return;
    candidates.push(candidate);
  };

  switch (view.phase) {
    case "DAY_SPEECH": {
      add({
        id: "speech:continue",
        label: "Continue public speech",
        command: {
          type: "speak",
          actorSeatId: view.mySeatId,
          message: "我先继续发言，把当前公开信息和票型压力说清楚。",
        },
        reasonHint: "keep the white wolf king ability hidden and continue normal public speech",
      });
      const action = getAction(view, "whiteWolfKingExplode");
      const targets = action?.targets ?? [];
      const nonTeammateTargets = targets.filter(
        (target) => !(view.privateKnowledge.wolfTeammates ?? []).some((teammate) => teammate.seatId === target.seatId),
      );
      const targetPool = nonTeammateTargets.length > 0 ? nonTeammateTargets : targets;
      for (const target of sortTargets(targetPool, tableRead, whiteWolfKingExplodeTargetScore)) {
        add({
          id: `whiteWolfKing:explode:${target.seatId}`,
          label: `Explode and take ${target.name}`,
          command: { type: "whiteWolfKingExplode", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "best public-value target for white wolf king self-explosion"),
        });
      }
      break;
    }
    case "NIGHT_WOLVES": {
      const action = getAction(view, "wolfKill");
      const plannedTarget = action?.targets.find(
        (target) => target.seatId === view.privateKnowledge.wolfTeamPlan?.nightStrategy?.nightTarget?.seatId,
      );
      if (plannedTarget) {
        add({
          id: `wolfKill:planned:${plannedTarget.seatId}`,
          label: `Kill ${plannedTarget.name}`,
          command: { type: "wolfKill", actorSeatId: view.mySeatId, targetSeatId: plannedTarget.seatId },
          target: plannedTarget,
          recommended: true,
          reasonHint: targetReasonHint(tableRead, plannedTarget, "coordinated night target with public-safe credibility rationale"),
        });
      }
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => seat.trust - seat.suspicion * 0.25)) {
        const privateWolfTarget = isPrivateWolfTarget(view, target);
        add({
          id: `wolfKill:${target.seatId}`,
          label: `Kill ${target.name}`,
          command: { type: "wolfKill", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: privateWolfTarget ? "potion-bait night line" : targetReasonHint(tableRead, target, "high public trust or role pressure"),
        });
      }
      break;
    }
    case "NIGHT_WOLF_BEAUTY": {
      const action = getAction(view, "wolfBeautyCharm");
      const targets = (action?.targets ?? []).filter(
        (target) => !(view.privateKnowledge.wolfTeammates ?? []).some((teammate) => teammate.seatId === target.seatId),
      );
      for (const target of sortTargets(targets, tableRead, wolfBeautyCharmTargetScore)) {
        add({
          id: `wolfBeauty:charm:${target.seatId}`,
          label: `Charm ${target.name}`,
          command: { type: "wolfBeautyCharm", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "high-value charm target"),
        });
      }
      if (action?.canSkip) {
        add({
          id: "wolfBeauty:skip",
          label: "Skip charm",
          command: { type: "wolfBeautyCharm", actorSeatId: view.mySeatId },
          reasonHint: "hold charm value because no target is decisive",
        });
      }
      break;
    }
    case "NIGHT_GUARD": {
      const action = getAction(view, "guardAction");
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => seat.trust - seat.suspicion * 0.15)) {
        add({
          id: `guard:${target.seatId}`,
          label: `Guard ${target.name}`,
          command: { type: "guardAction", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "most valuable public protection target"),
        });
      }
      if (action?.canSkip) {
        add({
          id: "guard:skip",
          label: "Skip guard",
          command: { type: "guardAction", actorSeatId: view.mySeatId },
          reasonHint: "skip to avoid a weak or repeated protection",
        });
      }
      break;
    }
    case "NIGHT_SEER": {
      const action = getAction(view, "seerCheck");
      const checked = new Set(view.privateKnowledge.seerChecks?.map((check) => check.targetSeatId) ?? []);
      const legalTargets = action?.targets ?? [];
      const preferredTargets = legalTargets.some((target) => !checked.has(target.seatId))
        ? legalTargets.filter((target) => !checked.has(target.seatId))
        : legalTargets;
      for (const target of sortTargets(preferredTargets, tableRead, (seat) => seat.suspicion - seat.trust * 0.1)) {
        add({
          id: `seerCheck:${target.seatId}`,
          label: `Check ${target.name}`,
          command: { type: "seerCheck", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "highest information value"),
        });
      }
      break;
    }
    case "NIGHT_WITCH": {
      const action = getAction(view, "witchAction");
      if (action?.canSave && action.saveTarget) {
        add({
          id: "witch:save",
          label: `Save ${action.saveTarget.name}`,
          command: { type: "witchAction", actorSeatId: view.mySeatId, mode: "save" },
          target: action.saveTarget,
          reasonHint: "save keeps the night victim alive",
        });
      }
      if (action?.canPoison) {
        for (const target of sortTargets(action.poisonTargets, tableRead, (seat) => seat.suspicion - seat.trust * 0.2)) {
          add({
            id: `witch:poison:${target.seatId}`,
            label: `Poison ${target.name}`,
            command: { type: "witchAction", actorSeatId: view.mySeatId, mode: "poison", targetSeatId: target.seatId },
            target,
            reasonHint: targetReasonHint(tableRead, target, "poison target has the strongest public suspicion"),
          });
        }
      }
      add({
        id: "witch:skip",
        label: "Skip potion use",
        command: { type: "witchAction", actorSeatId: view.mySeatId, mode: "skip" },
        reasonHint: "hold potion because the current information is not decisive",
      });
      break;
    }
    case "SHERIFF_NOMINATION": {
      add({
        id: "sheriff:run",
        label: "Run for sheriff",
        command: { type: "sheriffNominate", actorSeatId: view.mySeatId, run: true },
        reasonHint: "take initiative in the sheriff race",
      });
      add({
        id: "sheriff:stay-down",
        label: "Stay police-down",
        command: { type: "sheriffNominate", actorSeatId: view.mySeatId, run: false },
        reasonHint: "stay off the sheriff stand and evaluate candidates",
      });
      break;
    }
    case "SHERIFF_SPEECH":
    case "SHERIFF_PK_SPEECH": {
      add({
        id: "sheriff:speech",
        label: "Give sheriff speech",
        command: {
          type: "sheriffSpeech",
          actorSeatId: view.mySeatId,
          message: "我竞选警长会按公开发言、身份声明和票型来归票，先把警徽给能组织桌面的人。",
        },
        reasonHint: "give a public-safe sheriff campaign speech",
      });
      break;
    }
    case "SHERIFF_WITHDRAWAL": {
      add({
        id: "sheriff:hold",
        label: "Stay in sheriff race",
        command: { type: "sheriffWithdraw", actorSeatId: view.mySeatId, withdraw: false },
        reasonHint: "remain available for sheriff vote",
      });
      add({
        id: "sheriff:withdraw",
        label: "Withdraw",
        command: { type: "sheriffWithdraw", actorSeatId: view.mySeatId, withdraw: true },
        reasonHint: "step down because the campaign is no longer useful",
      });
      break;
    }
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE": {
      const action = getAction(view, "sheriffVote");
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => seat.trust - seat.suspicion * 0.2)) {
        add({
          id: `sheriffVote:${target.seatId}`,
          label: `Vote sheriff ${target.name}`,
          command: { type: "sheriffVote", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "best sheriff candidate from public speech"),
        });
      }
      if (action?.canAbstain) {
        add({
          id: "sheriffVote:abstain",
          label: "Abstain sheriff vote",
          command: { type: "sheriffVote", actorSeatId: view.mySeatId },
          reasonHint: "no candidate is credible enough",
        });
      }
      break;
    }
    case "DAY_VOTE": {
      const action = getAction(view, "vote");
      if (votePlan?.abstain && action?.canAbstain) {
        add({
          id: "vote:abstain",
          label: "Abstain",
          command: { type: "vote", actorSeatId: view.mySeatId },
          reasonHint: votePlan.reason,
        });
        break;
      }
      const targetOrder = orderVoteTargets(tableRead, action?.targets ?? [], votePlan);
      for (const target of targetOrder) {
        add({
          id: `vote:${target.seatId}`,
          label: `Vote ${target.name}`,
          command: { type: "vote", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint:
            votePlan?.target.seatId === target.seatId
              ? votePlan.reason
            : publicSafeTargetReasonHint(view, tableRead, target, "public suspicion"),
        });
      }
      if (action?.canAbstain) {
        add({
          id: "vote:abstain",
          label: "Abstain",
          command: { type: "vote", actorSeatId: view.mySeatId },
          reasonHint: "no exile target is public-safe enough yet",
        });
      }
      break;
    }
    case "KNIGHT_DUEL": {
      const action = getAction(view, "knightDuel");
      if (action?.canSkip) {
        add({
          id: "knight:skip",
          label: "Skip knight duel",
          command: { type: "knightDuel", actorSeatId: view.mySeatId },
          reasonHint: "public evidence is not strong enough for a duel",
        });
      }
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => knightDuelTargetScore(tableRead, seat))) {
        add({
          id: `knight:duel:${target.seatId}`,
          label: `Duel ${target.name}`,
          command: { type: "knightDuel", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "strongest public wolf evidence"),
        });
      }
      break;
    }
    case "HUNTER_SHOT": {
      const action = getAction(view, "hunterShoot");
      if (action?.canSkip) {
        add({
          id: "hunter:skip",
          label: "Skip shot",
          command: { type: "hunterShoot", actorSeatId: view.mySeatId },
          reasonHint: "no target is certain enough",
        });
      }
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => seat.suspicion - seat.trust * 0.2)) {
        add({
          id: `hunter:shoot:${target.seatId}`,
          label: `Shoot ${target.name}`,
          command: { type: "hunterShoot", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "strongest public suspicion"),
        });
      }
      break;
    }
    case "WOLF_KING_SHOT": {
      const action = getAction(view, "wolfKingShoot");
      if (action?.canSkip) {
        add({
          id: "wolfKing:skip",
          label: "Skip wolf king shot",
          command: { type: "wolfKingShoot", actorSeatId: view.mySeatId },
          reasonHint: "no target is certain enough",
        });
      }
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => seat.suspicion - seat.trust * 0.2)) {
        add({
          id: `wolfKing:shoot:${target.seatId}`,
          label: `Wolf king shoots ${target.name}`,
          command: { type: "wolfKingShoot", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "best public shot value"),
        });
      }
      break;
    }
    case "SHERIFF_HANDOFF": {
      const action = getAction(view, "sheriffHandoff");
      for (const target of sortTargets(action?.targets ?? [], tableRead, (seat) => seat.trust - seat.suspicion * 0.2)) {
        add({
          id: `sheriffHandoff:${target.seatId}`,
          label: `Pass badge to ${target.name}`,
          command: { type: "sheriffHandoff", actorSeatId: view.mySeatId, targetSeatId: target.seatId },
          target,
          reasonHint: targetReasonHint(tableRead, target, "best public trust to receive sheriff badge"),
        });
      }
      if (action?.canTear) {
        add({
          id: "sheriffHandoff:tear",
          label: "Tear badge",
          command: { type: "sheriffHandoff", actorSeatId: view.mySeatId },
          reasonHint: "avoid passing badge to an unreliable seat",
        });
      }
      break;
    }
    case "LAST_WORDS": {
      const messages = buildLastWordsCandidates(view, tableRead);
      messages.forEach((message, index) => {
        add({
          id: index === 0 ? "lastWords:best" : `lastWords:angle:${index}`,
          label: index === 0 ? "Give strongest last words" : `Give alternate last words ${index}`,
          command: { type: "lastWords", actorSeatId: view.mySeatId, message },
          reasonHint: index === 0 ? "出局前留下最关键的公开判断" : "换一个角度补充遗言",
        });
      });
      add({
        id: "lastWords:custom",
        label: "Write custom last words",
        command: {
          type: "lastWords",
          actorSeatId: view.mySeatId,
          message: "我最后留一个自定义视角：别只看结果，回头对照今天发言和票型。",
        },
        reasonHint: "模型自拟遗言",
      });
      break;
    }
  }

  if (!candidates.some((candidate) => sameCommand(candidate.command, fallbackCommand))) {
    candidates.unshift({
      id: "fallback",
      label: "Recommended local fallback",
      command: fallbackCommand,
      target: commandTarget(view, fallbackCommand),
      reasonHint: fallbackCommand.reason,
    });
  }

  return candidates.map((candidate) =>
    sameCommand(candidate.command, fallbackCommand)
      ? { ...candidate, recommended: true, reasonHint: fallbackCommand.reason ?? candidate.reasonHint }
      : candidate,
  );
}

function orderVoteTargets(
  tableRead: AiTableRead,
  legalTargets: ActionTarget[],
  votePlan: VotePlan | undefined,
): ActionTarget[] {
  const ordered: ActionTarget[] = [];
  const push = (target: ActionTarget | undefined) => {
    if (!target) return;
    if (!legalTargets.some((item) => item.seatId === target.seatId)) return;
    if (!ordered.some((item) => item.seatId === target.seatId)) ordered.push(target);
  };

  push(votePlan?.target);
  for (const alternative of votePlan?.alternatives ?? []) push(alternative);
  for (const target of sortTargets(legalTargets, tableRead, (seat) => seat.suspicion - seat.trust * 0.18)) push(target);

  return ordered;
}

function buildLastWordsCandidates(view: AgentView, tableRead: AiTableRead): string[] {
  const focus = tableRead.focus;
  const backup = tableRead.backupFocus;
  const latestSpeech = tableRead.recentSpeeches.find((speech) => speech.speaker?.seatId !== view.mySeatId);
  const voteLead = tableRead.voteSnapshot.leaders[0];
  const focusText = focus ? `${focus.seatId}号${focus.name}` : "当前焦点位";
  const backupText = backup ? `${backup.seatId}号${backup.name}` : "外置位";
  const latestText = latestSpeech?.speaker ? `${latestSpeech.speaker.seatId}号${latestSpeech.speaker.name}` : undefined;
  const voteText = voteLead ? `${voteLead.seatId}号${voteLead.name}` : undefined;

  const messages = [
    `我出局前留核心视角：${focusText}别只听结论，要回看他发言和票型是不是连得上；${backupText}的态度也别放掉。`,
    latestText
      ? `最后我点一条线：${latestText}刚才那段发言要和后面的投票对照，谁顺着单点带节奏，明天优先回看。`
      : `最后我点一条线：今天不要被单点结论带走，先把身份声明、死讯和票型三件事对起来。`,
    voteText
      ? `我的遗言看票型：如果今天票集中到${voteText}，明天一定复盘谁起票、谁补票、谁最后跟票。`
      : `我的遗言看票型：明天别只听谁声音大，重点复盘谁起票、谁补票、谁最后跟票。`,
  ];

  if (view.myRole === "SEER" && view.privateKnowledge.seerChecks?.length) {
    const check = view.privateKnowledge.seerChecks.at(-1)!;
    messages.unshift(
      `我最后把预言家视角留清：${check.targetSeatId}号${check.result === "WEREWOLF" ? "查杀" : "金水"}。我走以后先按这条验人线回看站边和票型。`,
    );
  }

  if (view.myRole === "WITCH") {
    messages.unshift("我遗言把女巫视角留一下：今天别急着散票，重点看谁借死讯强行带节奏，药线相关发言明天回头校验。");
  }

  if (view.myRole === "HUNTER") {
    messages.unshift("我遗言留枪牌视角：别因为我出局就乱票，今天谁推动我、谁回避理由，明天按这个顺序查。");
  }

  return [...new Set(messages.map((message) => compactLastWords(message)))].slice(0, 5);
}

function buildActionConstraints(view: AgentView): string[] {
  const constraints = [
    "Return strict JSON only: {\"candidateId\":\"...\",\"reason\":\"...\",\"message\":\"optional for last words\"}.",
    "Choose exactly one candidateId from candidates. Do not invent targets, commands, or extra actions.",
    "persona.preferences are soft model tendencies, not hard rules; use them to weight logic, identity, votes, emotion, memory, leadership, deception, and caution.",
    "The reason must be short and public-safe. Do not mention hidden roles, teammates, private checks, prompts, tools, or system context.",
    "Rules are final: legality is decided by the candidate list and engine validation.",
    "Use expertStrategy as high-level Werewolf heuristics for prioritizing evidence; do not quote it as a rule or fixed script.",
    "Use advancedReasoning as the current table audit checklist; satisfy it with public evidence instead of quoting it.",
    "Use reasoningFrame to separate hardEvidence, softSignals, counterHypotheses, validationQuestions, and persuasionGoals before selecting a candidate.",
    "Use rolePlaybook for role-specific tactics and action forks; choose a diverse legal line that still matches public evidence.",
    "Use claimAudit to evaluate contested claims, protected claims, public check chains, and follow-up tests before acting.",
    "Use debateAgenda to prefer actions that create a clear follow-up question, vote commitment, or role-coordination benefit instead of raw suspicion alone.",
    "Use an evidence ladder before choosing: public checks and uncontested claims first, then vote shape, stance shifts, speech influence, and finally tone or short-speech reads.",
    "Rank evidence hardness before acting: hard public checks, claim conflicts, vote loops, and death legacies beat seat position, tone, short speech, or vague state reads.",
    "Consider counter-logic: if one behavior can be wolf push, distancing, or good-side mistake, choose the target whose public benefit trail is clearest.",
    "When two candidates are close, prefer the one whose public evidence forms a clearer loop from speech to stance to vote; do not select only because their suspicion number is higher.",
  ];

  if (
    view.phase === "DAY_VOTE" ||
    view.phase === "KNIGHT_DUEL" ||
    view.phase === "HUNTER_SHOT" ||
    view.phase === "WOLF_KING_SHOT" ||
    getAction(view, "whiteWolfKingExplode")
  ) {
    constraints.push("Vote and shot reasons may become visible later, so write them only from public table evidence.");
  }

  if (getAction(view, "whiteWolfKingExplode")) {
    constraints.push("White wolf king self-explosion is optional: use it only when the public table value beats keeping the role hidden and speaking normally.");
  }

  if (getAction(view, "knightDuel")) {
    constraints.push(
      "Knight duel is optional and public: counterclaim status alone is not enough; prefer concrete public black-check evidence, dead-seer legacy, or repeated independent pressure.",
    );
    constraints.push("For knight duel, single black-check pressure should rank below repeated public evidence or a death-legacy evidence loop.");
  }

  if (getAction(view, "wolfBeautyCharm")) {
    constraints.push("Wolf beauty charm is private night strategy: prefer high-value non-teammate targets, but do not mention wolf-team knowledge in reasons.");
  }

  if (view.publicSummary.tableMemory.reasoningCues.length > 0) {
    constraints.push("Prefer publicContext.tableMemory.reasoningCues when choosing between close targets; they summarize public speech, vote, claim, and stance evidence.");
  }

  constraints.push(
    "Use publicContext.decisionSummary as the first-pass table map: compare focus, candidatePublicEvidence, votePressure, speechChain, and claimPressure before choosing.",
  );
  constraints.push("Do not quote cue ids or internal field names in the reason; write a natural public table reason.");

  if (view.phase === "DAY_VOTE" && !isWolfRole(view.myRole, view.rules.wolfRoles) && view.publicSummary.tableMemory.seerLegacies.length > 0) {
    constraints.push(
      "For good-side day votes, review seerLegacies as public legacy from night-dead seer claimants; treat it as evidence to test, not hidden role truth.",
    );
  }

  if (view.phase === "LAST_WORDS") {
    constraints.push("For last words, prefer candidateId \"lastWords:custom\" and provide a natural message field with the actual final public speech.");
    constraints.push("Last words should leave one or two concrete table reads, vote-shape reads, claim reads, or warnings for tomorrow; do not use a fixed generic line.");
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    if (view.phase === "NIGHT_WOLVES") {
      constraints.push("Night kills may legally target any alive seat, including self or a wolf partner, for potion-bait strategy.");
      constraints.push("Even when choosing a wolf target at night, the reason must not expose wolf-team knowledge.");
    } else if (view.phase === "DAY_VOTE") {
      constraints.push("Day votes may legally target any alive non-self seat, including a wolf partner for distancing or sacrifice.");
      constraints.push("If voting a wolf partner, explain it only from public speech, claim, and vote-shape evidence.");
    } else {
      constraints.push("Use wolf knowledge for strategy, but never expose wolf-team knowledge in public actions.");
    }
  }

  return constraints;
}

function compactLastWords(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length <= 800 ? clean : `${clean.slice(0, 799)}。`;
}

function compactSeatRead(seat: SeatRead): CompactSeatRead {
  return {
    seatId: seat.seatId,
    name: seat.name,
    suspicion: seat.suspicion,
    trust: seat.trust,
    pressure: seat.pressure.slice(0, 5),
    isSelf: seat.isSelf,
    isKnownWolf: seat.isKnownWolf,
    isKnownGood: seat.isKnownGood,
    isWolfTeammate: seat.isWolfTeammate,
    votesReceived: seat.votesReceived,
    publicClaims: seat.publicClaims,
    publicChecksAgainst: seat.publicChecksAgainst,
  };
}

function sortTargets(
  targets: ActionTarget[],
  tableRead: AiTableRead,
  score: (seat: SeatRead) => number,
): ActionTarget[] {
  const bySeatId = new Map(tableRead.seats.map((seat) => [seat.seatId, seat]));
  return [...targets].sort((a, b) => {
    const seatA = bySeatId.get(a.seatId);
    const seatB = bySeatId.get(b.seatId);
    return (seatB ? score(seatB) : 0) - (seatA ? score(seatA) : 0) || a.seatId - b.seatId;
  });
}

function whiteWolfKingExplodeTargetScore(seat: SeatRead): number {
  const claimValue = seat.publicClaims.reduce((score, claim) => {
    if (claim.claimedRole === "SEER") return Math.max(score, 38);
    if (claim.claimedRole === "WITCH" || claim.claimedRole === "HUNTER" || claim.claimedRole === "IDIOT" || claim.claimedRole === "KNIGHT" || claim.claimedRole === "GUARD") return Math.max(score, 26);
    if (claim.claimedRole === "VILLAGER") return Math.max(score, 8);
    return score;
  }, 0);
  const checkedGoodValue = seat.publicChecksAgainst.some((check) => check.result === "GOOD") ? 14 : 0;
  return seat.trust * 0.85 - seat.suspicion * 0.15 + claimValue + checkedGoodValue;
}

function wolfBeautyCharmTargetScore(seat: SeatRead): number {
  const claimValue = seat.publicClaims.reduce((score, claim) => {
    if (claim.claimedRole === "SEER") return Math.max(score, 24);
    if (claim.claimedRole === "WITCH" || claim.claimedRole === "HUNTER" || claim.claimedRole === "IDIOT" || claim.claimedRole === "KNIGHT") return Math.max(score, 18);
    return score;
  }, 0);
  return seat.trust - seat.suspicion * 0.18 + claimValue;
}

function knightDuelTargetScore(tableRead: AiTableRead, seat: SeatRead): number {
  const hasDeadSeerLegacy = hasDeadSeerLegacyBlackCheck(tableRead, seat);
  const hasPublicWolfCheck = seat.publicChecksAgainst.some((check) => check.result === "WEREWOLF");
  const wolfCheckBonus = hasPublicWolfCheck ? 12 : 0;
  const deadSeerLegacyBonus = hasDeadSeerLegacy ? 34 : 0;
  const counterclaimBonus =
    seat.publicClaims.some((claim) => claim.claimedRole === "SEER") &&
    seat.pressure.some((item) => item.includes("后置查杀已跳预言家") || item.includes("夜死后遗留查杀"))
      ? 8
      : 0;
  const weakBlackCheckPenalty =
    hasPublicWolfCheck && !hasDeadSeerLegacy && !seat.pressure.some((item) => item.includes("后置查杀已跳预言家"))
      ? 30
      : 0;
  const protectedClaimPenalty = seat.pressure.some((item) => item.includes("未对跳") || item.includes("被后置预言家查杀")) ? 40 : 0;
  return seat.suspicion - seat.trust * 0.12 + wolfCheckBonus + deadSeerLegacyBonus + counterclaimBonus - weakBlackCheckPenalty - protectedClaimPenalty;
}

function hasDeadSeerLegacyBlackCheck(tableRead: AiTableRead, seat: SeatRead): boolean {
  return (
    seat.pressure.some((item) => item.includes("夜死后遗留查杀")) ||
    tableRead.tableMemory.seerLegacies.some((legacy) =>
      legacy.checks.some((check) => check.result === "WEREWOLF" && check.target.seatId === seat.seatId),
    )
  );
}

function targetReasonHint(tableRead: AiTableRead, target: ActionTarget, fallback: string): string {
  const read = tableRead.seats.find((seat) => seat.seatId === target.seatId);
  return read?.pressure[0] ?? fallback;
}

function publicSafeTargetReasonHint(
  view: AgentView,
  tableRead: AiTableRead,
  target: ActionTarget,
  fallback: string,
): string {
  const hint = targetReasonHint(tableRead, target, fallback);
  return isPrivateWolfTarget(view, target) && containsActionPrivateLeak(hint)
    ? "public claim or vote-shape pressure"
    : hint;
}

function getAction<T extends AvailableHumanAction["type"]>(
  view: AgentView,
  type: T,
): Extract<AvailableHumanAction, { type: T }> | undefined {
  return view.allowedActions.find((action): action is Extract<AvailableHumanAction, { type: T }> => action.type === type);
}

function commandTarget(view: AgentView, command: Command): ActionTarget | undefined {
  if (!("targetSeatId" in command) || !command.targetSeatId) return undefined;
  return view.aliveSeats.find((seat) => seat.seatId === command.targetSeatId) ?? {
    seatId: command.targetSeatId,
    name: `${command.targetSeatId}`,
  };
}

function sameCommand(left: Command, right: Command): boolean {
  if (left.type !== right.type || left.actorSeatId !== right.actorSeatId) return false;

  switch (left.type) {
    case "wolfKill":
    case "guardAction":
    case "seerCheck":
    case "wolfBeautyCharm":
    case "vote":
    case "knightDuel":
    case "sheriffVote":
    case "sheriffHandoff":
      return "targetSeatId" in right && left.targetSeatId === right.targetSeatId;
    case "witchAction":
      return right.type === "witchAction" && left.mode === right.mode && left.targetSeatId === right.targetSeatId;
    case "hunterShoot":
      return right.type === "hunterShoot" && left.targetSeatId === right.targetSeatId;
    case "wolfKingShoot":
      return right.type === "wolfKingShoot" && left.targetSeatId === right.targetSeatId;
    case "whiteWolfKingExplode":
      return right.type === "whiteWolfKingExplode" && left.targetSeatId === right.targetSeatId;
    case "sheriffNominate":
      return right.type === "sheriffNominate" && left.run === right.run;
    case "sheriffWithdraw":
      return right.type === "sheriffWithdraw" && left.withdraw === right.withdraw;
    case "speak":
      return right.type === "speak" && left.message === right.message;
    case "lastWords":
      return right.type === "lastWords" && left.message === right.message;
    case "sheriffSpeech":
      return right.type === "sheriffSpeech" && left.message === right.message;
  }

  return false;
}

function isPrivateWolfTarget(view: AgentView, target: ActionTarget): boolean {
  return (
    isWolfRole(view.myRole, view.rules.wolfRoles) &&
    (target.seatId === view.mySeatId ||
      (view.privateKnowledge.wolfTeammates ?? []).some((teammate) => teammate.seatId === target.seatId))
  );
}

function commandFromDecision(command: Command, decision: ActionDecision, fallbackReason: string | undefined): Command {
  const reason = publicSafeActionReason(decision.reason, fallbackReason);
  if (command.type === "lastWords") {
    const message = cleanLastWordsMessage(decision.message);
    return withReason(message ? { ...command, message } : command, reason);
  }
  return withReason(command, reason);
}

function withReason(command: Command, reason: string | undefined): Command {
  const clean = cleanActionReason(reason);
  return clean ? ({ ...command, reason: clean } as Command) : command;
}

function cleanLastWordsMessage(message: string | undefined): string | undefined {
  const clean = (message ?? "").trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, 800) : undefined;
}

function cleanActionReason(reason: string | undefined): string {
  return (reason ?? "").trim().replace(/\s+/g, " ").slice(0, 90);
}

function publicSafeActionReason(reason: string | undefined, fallbackReason: string | undefined): string | undefined {
  const clean = cleanActionReason(reason);
  if (clean && !containsActionPrivateLeak(clean)) return clean;

  const fallback = cleanActionReason(fallbackReason);
  return fallback && !containsActionPrivateLeak(fallback) ? fallback : undefined;
}

function validateActionReasonQuality(reason: string | undefined): string | undefined {
  const clean = cleanActionReason(reason);
  if (!clean) return "reason is empty";
  if (looksLikeMalformedActionReason(clean)) return "reason is malformed";
  return undefined;
}

function looksLikeMalformedActionReason(reason: string): boolean {
  const meaningful = reason.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "");
  if (meaningful.length < 4) return true;
  if (/^[\s"'`{}[\]:：,，.。;；!?！？-]+/.test(reason) && meaningful.length < 8) return true;
  if (/^(current|none|null|undefined|n\/a|ok)$/i.test(reason)) return true;
  if (/^[\s"'`{}[\]:：,，.。;；!?！？-]+$/.test(reason)) return true;
  return false;
}

function containsActionPrivateLeak(reason: string): boolean {
  if (!reason) return false;
  return /privateKnowledge|wolfTeamPlan|wolfPlan|system|prompt|hidden role|true role|WEREWOLF|WOLF_KING|WHITE_WOLF_KING|WOLF_BEAUTY|VILLAGER|SEER|WITCH|HUNTER|IDIOT|KNIGHT|GUARD|队友|狼队|同狼|真实身份|隐藏身份|私密|系统|提示词|上帝视角|我知道.*身份|wolf teammate|teammate/i.test(
    reason,
  );
}

function fallbackAction(
  provider: string,
  context: AiActionProviderContext,
  error: string,
  rawOutput?: unknown,
  validationErrors?: string[],
): AiActionResult {
  return {
    command: context.fallbackCommand,
    provider,
    rawOutput,
    isFallback: true,
    error,
    validationErrors,
  };
}

async function callOpenAiAction(input: LlmActionInput): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are the decision brain for an AI Werewolf player. Choose one legal candidate action using persona.preferences, expertStrategy, and advancedReasoning as soft strategy guidance. Return strict JSON only. The game engine enforces rules; you provide judgment within the allowed candidate list.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "werewolf_action",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                candidateId: { type: "string", minLength: 1, maxLength: 80 },
                reason: { type: "string", maxLength: 160 },
              },
              required: ["candidateId", "reason"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI action request failed: ${response.status}`);
    }

    return extractResponseText(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function callRoutedModelAction(input: LlmActionInput): Promise<RoutedLlmResponse> {
  const primaryPersonaName = readActionPrimaryPersonaName(input);
  const modelInput = stripActionRuntimeLlm(input);
  return callRoutedModelJsonWithFallbacks({
    personaName: primaryPersonaName,
    fallbackPersonaNames: readActionFallbackPersonaNames(primaryPersonaName),
    task: "action",
    system:
      "You are the decision brain for an AI Werewolf player. Choose exactly one legal candidate action from candidates using persona.preferences, expertStrategy, and advancedReasoning as soft strategy guidance. Return strict JSON only: {\"candidateId\":\"...\",\"reason\":\"...\"}. Do not reveal private/system context.",
    input: modelInput,
    maxTokens: 220,
    customLlm: input.llmConfig,
  });
}

function stripActionRuntimeLlm(input: LlmActionInput): Omit<LlmActionInput, "llmConfig"> {
  const modelInput = { ...input };
  delete modelInput.llmConfig;
  return modelInput;
}

function readActionPrimaryPersonaName(input: LlmActionInput): string | undefined {
  const primary = input.persona?.name;
  const previousIssue = input.stability?.previousIssue ?? "";
  if (!/not valid JSON|did not pass constraints|missing candidate|selected a missing candidate|candidateId/i.test(previousIssue)) {
    return primary;
  }

  const fallbackPersonaNames = readActionFallbackPersonaNames(primary);
  const fallbackIndex = Math.max(0, (input.stability?.attempt ?? 2) - 2);
  return fallbackPersonaNames[fallbackIndex] ?? fallbackPersonaNames.at(-1) ?? primary;
}

function readRoutedActionOutputMaxAttempts(input: LlmActionInput): number {
  const baseAttempts = readLlmOutputMaxAttempts();
  const fallbackPersonaCount = readActionFallbackPersonaNames(input.persona?.name).length;
  return Math.min(5, Math.max(baseAttempts, 1 + fallbackPersonaCount));
}

function readActionFallbackPersonaNames(primaryPersonaName: string | undefined): string[] {
  const configured = process.env.AI_LLM_ACTION_FALLBACK_PERSONAS?.trim();
  const values =
    configured && !/^(off|none|false|0)$/i.test(configured)
      ? configured.split(",")
      : ["GPT", "Claude", "GLM"];
  const primary = primaryPersonaName?.trim().toLowerCase();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .filter((value) => value.toLowerCase() !== primary);
}

function extractResponseText(data: unknown): string {
  if (typeof data === "object" && data && "output_text" in data && typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = typeof data === "object" && data && "output" in data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI action response did not contain text.");
}

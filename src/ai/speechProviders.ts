import { extractRoleClaimFromSpeech } from "@/game/claims";
import { ROLE_LABELS } from "@/game/labels";
import {
  ORDINARY_PLAYER_TYPE_PRESETS,
  inferOrdinaryPlayerTypeId,
  sanitizeOrdinaryPlayerProfile,
} from "@/game/ordinaryPlayerProfiles";
import { isWolfRole } from "@/game/roleUtils";
import { stripSpeechStageDirections } from "@/game/speechText";
import type {
  ActionTarget,
  AgentView,
  PublicReasoningCue,
  SpeechPlan,
  TableMemory,
} from "@/game/types";
import {
  callRoutedModelJsonWithFallbacks,
  isModelLlmRoutingAvailable,
  packLlmOutputAttempts,
  readLlmOutputMaxAttempts,
  readRenderedProviderId,
  readRenderedText,
  type LlmOutputAttemptLog,
  type RoutedLlmResponse,
} from "./modelLlms";
import { buildAdvancedReasoningNotes } from "./advancedReasoning";
import { buildClaimAudit, type AiClaimAudit } from "./claimAudit";
import { buildDebateAgenda, type AiDebateAgenda } from "./debateAgenda";
import { buildExpertStrategyNotes } from "./expertStrategy";
import { buildReasoningFrame, type AiReasoningFrame } from "./reasoningFrame";
import { buildRolePlaybook, type AiRolePlaybook } from "./rolePlaybook";
import { deadSeerGoldSeatIds } from "./protectedGold";
import { createSpeechPlan } from "./tableRead";
import { buildPublicInferenceLayers, type PublicInferenceLayers } from "./inferenceLayers";
import {
  buildClassTrialLensFallbackSpeech,
  formatClassTrialLensForSpeech,
  getClassTrialCharacterLens,
  validateClassTrialLensSpeech,
  type ClassTrialCharacterLens,
} from "./classTrialCharacterLens";
import { shouldUseClassTrialExpressionLeniency } from "./classTrialDramaticMode";
import {
  buildClassTrialLiveState,
  formatClassTrialLiveStateForPrompt,
  type ClassTrialLiveState,
} from "./classTrialLiveState";
import { formatClassTrialRoleVoiceProfile } from "./classTrialRoleVoiceProfile";
import {
  buildClassTrialDayContinuationGuide,
  buildClassTrialDialogueRewriteGuide,
  buildClassTrialFinalSpeakerGuide,
  buildClassTrialOpeningDirectorGuide,
  buildClassTrialPersonaAwareGuide,
  buildClassTrialRepeatedFocusGuide,
  buildClassTrialSelfIntroductionGuide,
} from "./classTrialSpeechDirector";
import {
  adaptPersonaStrategyForView,
  buildOrdinaryLiveIntent,
  formatOrdinaryLiveIntentForPrompt,
} from "./personaStrategyCards";
import {
  buildClaimBriefingLine,
  buildCurrentSpeechOrderPositionLine,
  buildFirstSpeakerBriefingLine,
  buildFutureSeatMentionOrderLine,
  buildSeerLegacyBriefingLine,
  buildSheriffBriefingLine,
  buildSheriffVoteBriefingLine,
  buildTodaySpeechOrderBriefingLine,
} from "./speech/briefing";
import {
  buildClaimAttributionBoundaryLines,
  buildClaimAttributionContractLines,
  buildClassTrialBlackCheckAgendaContractLines,
} from "./speech/claimAttribution";
import { repairGeneratedClassTrialSpeech } from "./speech/classTrialRepair";
import {
  activelyExplainsFirstCheckMotive,
  dilutesSeerBlackCheckWithObserverCondition,
  hasSeerBlackCheckVoteBoundary,
  misidentifiesSeatAsSeer,
  offersBlackCheckReversalToTarget,
  speechMentionsBlackCheck,
  speechMentionsExplicitBlackCheck,
} from "./speech/blackCheckSurface";
import {
  currentDaySpeechItems,
  getCurrentDayDeathShape,
  hasCurrentDayDeathShapeMention,
  toTargetFromSeatId,
  type CurrentDayDeathShape,
} from "./speech/context";
import {
  buildDeathBoundaryLine,
  buildDeathBriefingLine,
  formatOrdinaryDeathShapeFallback,
} from "./speech/deathShape";
import {
  AI_MOCK_SPEECH_MAX_CHARS,
  AI_SPEECH_MAX_CHARS,
  AI_SPEECH_MAX_SENTENCES,
  CLASS_TRIAL_COMPACT_REPAIR_MAX_CHARS,
  CLASS_TRIAL_COMPACT_REPAIR_MAX_SENTENCES,
  CLASS_TRIAL_FALLBACK_SPEECH_MAX_CHARS,
  CLASS_TRIAL_FALLBACK_SPEECH_MAX_SENTENCES,
} from "./speech/limits";
import {
  countSentenceLikeUnits,
  validateCompleteQuestionFragments,
  validatePlainSpeechFormatting,
} from "./speech/formatValidation";
import {
  hasOrdinaryCardSurface,
  hasOrdinaryFinalLandingAction,
  hasOrdinaryHandlingAction,
  hasSharedSurfaceSpan,
  isOrdinaryTruncatedSpeechEnding,
  normalizeOrdinarySurfaceForCopyCheck,
} from "./speech/ordinarySurface";
import { parseSpeechDecision } from "./speech/outputParsing";
import { buildPrivateBoundaryLines, buildPrivateBriefingLines } from "./speech/privateBriefing";
import {
  naturalizeOrdinarySpeechText,
  repairDuplicatedWordSlipText,
  trimOrdinaryForwardCommitmentEnding,
} from "./speech/ordinaryRepair";
import {
  collectRepeatedQuotedSpeechFragments,
  ordinarySpeechMoveLabel,
  ordinarySpeechPressureLabel,
  uniqueOrdinarySpeechMoves,
  uniqueStrings,
} from "./speech/ordinaryDirectorHelpers";
import {
  buildCheckResultSeerClaimGuide,
  buildModelSpeechStyleGuide,
  buildNameAwareAddressingGuide,
  buildOrdinaryOpeningAntiCopyGuide,
  buildOrdinaryPlayerMouthGuide,
  buildOrdinaryRepeatedPressureGuide,
  buildSelfIntroductionBoundaryLine,
  buildUniversalDeTemplateGuide,
  isOrdinaryLowInfoOpeningTemplate,
  isOrdinaryPressureChainCalloutWithPivot,
  isOrdinaryPressureSourceQuestionAxis,
  shortPublicName,
} from "./speech/playerGuide";
import {
  findLatestPublicBlackCheck,
  findPublicBlackCheckAgainstSelf,
  hasActionableClassTrialPublicInfo,
  hasPublicSeerBlackCheck,
  hasPublicSeerCheck,
  isLowInfoDayOneNoHardInfo,
  type PublicBlackCheckContext,
} from "./speech/publicState";
import {
  buildSpeechContract,
  isClassTrialHardInfoSpeech,
  resolveContractMove,
  resolveSpeechLimits,
  uniqueContractLines,
} from "./speech/speechContract";
import { buildSpeechConstraints } from "./speech/speechConstraints";
import {
  buildSpeechOrderContext,
  currentDaySpokenSeats,
  getPlanTargetSpeechStatus,
  hasCurrentDaySpeech,
  uniqueSeatOrder,
} from "./speech/speechOrder";
import { buildSpeechRulesContext } from "./speech/rulesContext";
import { withSpeechStabilityHint } from "./speech/stability";
import {
  containsCheckCue,
  containsOutOfGameSpeech,
  containsPublicSeatReference,
  containsTargetReference,
} from "./speech/surface";
import { splitSpeechValidationErrors } from "./speech/validationErrors";
import type {
  LlmSpeechInput,
  OrdinaryPlayerVoiceCard,
  OrdinarySelfHistory,
  OrdinarySpeechDirector,
  OrdinarySpeechMove,
  OrdinarySpeechPressure,
  SpeechStrictness,
} from "./speech/types";
import {
  clipBriefingText,
  escapeRegExp,
  formatSeatList,
  normalizeDigits,
  parseSeatNumber,
  seatText,
  stripTerminalPunctuation,
} from "./speech/text";
import type { AiSpeechProvider, AiSpeechProviderContext, AiSpeechResult } from "./types";

export type {
  LlmSpeechInput,
  OrdinaryPlayerVoiceCard,
  OrdinarySelfHistory,
  OrdinarySpeechDirector,
  OrdinarySpeechMove,
  OrdinarySpeechPressure,
  SpeechStrictness,
} from "./speech/types";

const SPEECH_SYSTEM_PROMPT = [
  "普通局你是狼人杀玩家本人；学级裁判主题局里，你是角色被放进狼人杀规则里，目标是让角色看起来正在玩狼人杀，而不是让角色像狼人杀玩家套角色皮。",
  "根据牌桌局势、身份信息和性格，自由发表这一轮公开发言。普通局可以参考 input.speechContract；学级裁判主题局优先参考角色卡、公开事实和私有身份事实，不把 contract 或 briefing 当台词脚本。",
  "再参考 input.inferenceLayers、input.expertStrategy、input.advancedReasoning、input.reasoningFrame、input.rolePlaybook、input.claimAudit、input.debateAgenda 和 input.playerSpeechGuide；如果这些材料为空，就直接按角色第一人称和当前公开事实发言，不要补写系统分析。",
  "普通局发言要像玩家临场盘逻辑；学级裁判主题局优先像角色临场反应：低信息时允许犹豫、挑衅、偏心、冷处理或短促反问，强信息局面要把身份和公开依据说到桌上，但出口先是角色对白。",
  "必要时可以落追问、投票目标或具体改判条件；不要把所有角色都写成查验、表态、投票和收益结构分析员，也不要把情绪、关系和声音感完全抹掉。",
  "普通局承接上一位时，最多复述一句关键原话；认同或反感之后必须用第一人称落到自己的处理：我先暂放、我先不跟、我改看谁、我先压谁，或者我这轮先过。",
  "模型特点只是软性的打法倾向：例如 DeepSeek 偏逻辑链，Claude 偏边界检查，豆包偏强压，Kimi 偏长线记忆；只有第一天早上需要时才按座位名报自己是谁，后续轮次不要反复自我介绍。",
  "不要说自己是 AI、语言模型或系统角色；不要把内部分析标签说出口，例如“拆因果”“第一点”“盘问议程”“票口条件”“可改票条件”；不要列第一、第二、第三；要把这些材料改写成自然牌桌发言。",
  "只输出玩家实际说出口的台词，不写括号内动作、神态、语气或旁白描写。只能评价本日已经发过言的人；已经发过言的人只能回看其已发表内容，不能说等他后面再补、轮到他再回应。",
  "对尚未发言的后置位如果必须追问，只点一个和当前发言链相关的位置，留一个具体问题，不能把问题铺成一圈通用作业，也不能说他们已经信息少或没回应。",
  "真预言家报查杀后，今天先用自己的视角钉住查杀位；这是预言家自己的结果和票，不要说成中立桌面观察，也不给查杀位靠自证把今天焦点推走的空间；D1发言只需要身份、查验结果和今天处理方式。",
  "天亮死讯只直接公开谁死亡。普通无守卫女巫局里，首夜单死只一句当成狼刀成功、女巫没救；平安夜只一句当成女巫用了救药。首夜狼刀通常没有公开意图信息，不要追问别人为什么刀这个人。说完马上转到怀疑、暂放、追问或投票条件。",
  "狼人杀大多数时间没有足够硬信息，允许按公开规则和发言状态进行推测、猜测和施压；要把猜测说成“我倾向、我猜、按规则推”，并留下验证条件。",
  "无守卫女巫局里，平安夜作为公开死亡形态处理；只能一句带过并接上自己的判断动作，不要把“女巫用药了”当成完整发言或交给后置位重复解释。若平安夜已被前置位讲过，就当作已结算背景，不主动复读药线或空刀。",
  "非女巫不能说自己私下知道女巫是谁或具体救了几号；普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法。真女巫可以公开自己的真实救毒信息，但不能编错目标。",
].join("");

type OrdinaryRepeatedPressureAxis = {
  target: ActionTarget;
  count: number;
  speakers: ActionTarget[];
};

type LlmSpeechRenderer = (
  input: LlmSpeechInput,
  context?: AiSpeechProviderContext,
) => Promise<string | RoutedLlmResponse>;

export const mockSpeechProvider: AiSpeechProvider = {
  providerId: "mock-speech",
  async generateSpeech(view, plan = createSpeechPlan(view)) {
    return {
      speech: protectPublicGoldReferences(view, createMockSpeech(view, plan)),
      provider: "mock-speech",
      isFallback: false,
    };
  },
};

export function createConfiguredSpeechProvider(): AiSpeechProvider {
  if (process.env.AI_SPEECH_PROVIDER === "mock") {
    return createCustomAwareSpeechProvider(mockSpeechProvider);
  }

  if (isModelLlmRoutingAvailable()) {
    return createCustomAwareSpeechProvider(routedModelSpeechProvider);
  }

  if (process.env.AI_SPEECH_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    return createCustomAwareSpeechProvider(openAiSpeechProvider);
  }

  return createCustomAwareSpeechProvider(mockSpeechProvider);
}

function createCustomAwareSpeechProvider(defaultProvider: AiSpeechProvider): AiSpeechProvider {
  return {
    providerId: "custom-aware-speech",
    generateSpeech(view, plan, context) {
      return view.llmConfig
        ? routedModelSpeechProvider.generateSpeech(view, plan, context)
        : defaultProvider.generateSpeech(view, plan, context);
    },
  };
}

export function readSpeechStrictness(): SpeechStrictness {
  const value = process.env.AI_SPEECH_STRICTNESS?.trim().toLowerCase();
  return value === "strict" || value === "loose" || value === "guided" ? value : "guided";
}

export function createConstrainedLlmSpeechProvider(options: {
  providerId: string;
  render: LlmSpeechRenderer;
  strictness?: SpeechStrictness;
}): AiSpeechProvider {
  return {
    providerId: options.providerId,
    async generateSpeech(view, plan = createSpeechPlan(view), context) {
      const strictness = options.strictness ?? readSpeechStrictness();
      const baseInput = buildConstrainedSpeechInput(view, plan, strictness);
      const attempts: LlmOutputAttemptLog[] = [];
      const maxAttempts = readLlmOutputMaxAttempts();
      let providerId = options.providerId;
      let lastIssue = "LLM 发言失败。";
      let lastRawOutput: string | undefined;
      let lastSoftAccepted:
        | {
            speech: string;
            rawOutput: string;
            providerId: string;
            softValidationErrors: string[];
          }
        | undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const rendered = await options.render(
            withSpeechStabilityHint(baseInput, attempt, lastIssue, lastRawOutput),
            attempt === 1 ? context : undefined,
          );
          const rawOutput = readRenderedText(rendered);
          providerId = readRenderedProviderId(rendered) ?? providerId;
          lastRawOutput = rawOutput;

          const parsed = parseSpeechDecision(rawOutput);
          if (!parsed.success) {
            lastIssue = parsed.issue;
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue });
            continue;
          }

          const normalizedSpeech = normalizeSpeech(parsed.speech, view, plan);
          const repairedSpeech = normalizeSpeech(repairGeneratedClassTrialSpeech(view, repairClaimAttributionSpeech(view, normalizedSpeech)), view, plan);
          const validationSpeech =
            view.roleCard?.theme === "class-trial"
              ? repairedSpeech
            : normalizeSpeech(naturalizeOrdinarySpeechText(repairedSpeech), view, plan);
          const allValidationErrors = validateRenderedSpeech(view, plan, validationSpeech, strictness);
          const { hard: validationErrors, soft: softValidationErrors } = splitSpeechValidationErrors(view, allValidationErrors);
          if (validationErrors.length > 0) {
            const compactedSpeech = compactOverlongOrdinaryClassTrialSpeech(view, plan, validationSpeech, validationErrors);
            if (compactedSpeech) {
              const compactedValidationErrors = validateRenderedSpeech(view, plan, compactedSpeech, strictness);
              if (splitSpeechValidationErrors(view, compactedValidationErrors).hard.length === 0) {
                attempts.push({ attempt, provider: providerId, rawOutput });
                return {
                  speech: compactedSpeech,
                  provider: providerId,
                  rawOutput: packLlmOutputAttempts(attempts),
                  isFallback: false,
                };
              }
            }
            lastIssue = `LLM 发言未通过约束：${validationErrors.join("；")}`;
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue, validationErrors });
            continue;
          }
          if (softValidationErrors.length > 0) {
            const repairedSoftSpeech =
              attempt >= maxAttempts
                ? repairOrdinarySoftAcceptedSpeech(view, plan, validationSpeech, softValidationErrors, strictness)
                : undefined;
            if (repairedSoftSpeech) {
              attempts.push({
                attempt,
                provider: providerId,
                rawOutput,
                issue: `LLM 发言质量可改进，已裁掉未落地的结尾：${softValidationErrors.join("；")}`,
                validationErrors: softValidationErrors,
              });
              return {
                speech: repairedSoftSpeech,
                provider: providerId,
                rawOutput: packLlmOutputAttempts(attempts),
                isFallback: false,
              };
            }
            if (mustRepairOrdinarySoftSpeech(view, softValidationErrors)) {
              lastIssue =
                attempt >= maxAttempts
                  ? `LLM 发言未通过约束：${softValidationErrors.join("；")}`
                  : `LLM 发言质量可改进：${softValidationErrors.join("；")}`;
              attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue, validationErrors: softValidationErrors });
              continue;
            }
            lastSoftAccepted = {
              speech: validationSpeech,
              rawOutput,
              providerId,
              softValidationErrors,
            };
            if (attempt < maxAttempts) {
              lastIssue = `LLM 发言质量可改进：${softValidationErrors.join("；")}`;
              attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue, validationErrors: softValidationErrors });
              continue;
            }
          }

          const speech = validationSpeech;
          attempts.push({ attempt, provider: providerId, rawOutput });
          return {
            speech,
            provider: providerId,
            rawOutput: packLlmOutputAttempts(attempts),
            isFallback: false,
          };
        } catch (error) {
          lastIssue = error instanceof Error ? error.message : "LLM 发言失败。";
          attempts.push({ attempt, provider: providerId, rawOutput: lastRawOutput, issue: lastIssue });
          if (/abort|aborted|timeout|timed out/i.test(lastIssue)) break;
        }
      }

      if (lastSoftAccepted) {
        const repairedSoftSpeech = repairOrdinarySoftAcceptedSpeech(
          view,
          plan,
          lastSoftAccepted.speech,
          lastSoftAccepted.softValidationErrors,
          strictness,
        );
        attempts.push({
          attempt: Math.min(attempts.length + 1, maxAttempts),
          provider: lastSoftAccepted.providerId,
          rawOutput: lastSoftAccepted.rawOutput,
          issue: `LLM 发言质量可改进但已放行：${lastSoftAccepted.softValidationErrors.join("；")}`,
          validationErrors: lastSoftAccepted.softValidationErrors,
        });
        return {
          speech: repairedSoftSpeech ?? lastSoftAccepted.speech,
          provider: lastSoftAccepted.providerId,
          rawOutput: packLlmOutputAttempts(attempts),
          isFallback: false,
        };
      }

      return fallbackSpeech(
        providerId,
        view,
        plan,
        lastIssue,
        packLlmOutputAttempts(attempts),
        strictness,
      );
    },
  };
}

export const openAiSpeechProvider: AiSpeechProvider = createConstrainedLlmSpeechProvider({
  providerId: "openai-speech",
  render: callOpenAiSpeech,
});

export const routedModelSpeechProvider: AiSpeechProvider = createConstrainedLlmSpeechProvider({
  providerId: "model-routed-speech",
  render: callRoutedModelSpeech,
});

export function buildConstrainedSpeechInput(
  view: AgentView,
  plan = createSpeechPlan(view),
  strictness = readSpeechStrictness(),
): LlmSpeechInput {
  const speechPlan = sanitizeSpeechPlanForLlm(view, plan);
  const speechOrder = buildSpeechOrderContext(view);
  const speechContract = buildSpeechContract(speechPlan, speechOrder, view);
  speechContract.mustNotAsk.push(...buildClaimAttributionContractLines(view));
  speechContract.mustNotAsk.push(...buildClassTrialBlackCheckAgendaContractLines(view));
  const constraints = buildSpeechConstraints(view, plan, strictness, speechContract);
  const advancedReasoning = buildAdvancedReasoningNotes(view);
  const reasoningFrame = buildReasoningFrame(view);
  const rolePlaybook = buildRolePlaybook(view);
  const claimAudit = buildClaimAudit(view);
  const debateAgenda = buildDebateAgenda(view, { plan, target: plan.target });
  const characterLens = getClassTrialCharacterLens(view.roleCard);
  const classTrialLiveState = buildClassTrialLiveState(view, plan);
  const personaStrategyCard = adaptPersonaStrategyForView(view);
  const ordinaryLiveIntent = view.roleCard?.theme === "class-trial" ? undefined : buildOrdinaryLiveIntent(view, speechPlan);
  const ordinarySpeechDirector =
    view.roleCard?.theme === "class-trial" ? undefined : buildOrdinarySpeechDirector(view, speechPlan, speechOrder);
  const input: LlmSpeechInput = {
    day: view.day,
    mySeatId: view.mySeatId,
    myRole: view.myRole,
    persona: view.persona,
    characterRole: view.roleCard,
    characterLens,
    classTrialLiveState,
    personaStrategyCard,
    ordinaryLiveIntent,
    ordinarySpeechDirector,
    aliveSeats: view.aliveSeats,
    tableBriefing: buildTableBriefing(view, plan, speechOrder, advancedReasoning, reasoningFrame, rolePlaybook, claimAudit, debateAgenda),
    publicContext: {
      rules: buildSpeechRulesContext(view),
      recentSpeeches: view.publicSummary.recentSpeeches.slice(-8),
      voteSnapshot: view.publicSummary.voteSnapshot,
      recentDeaths: view.publicSummary.recentDeaths.slice(-4),
      claimBoard: view.publicSummary.claimBoard,
      speechOrder,
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
        deathAnnouncements: view.publicSummary.tableMemory.deathAnnouncements.slice(-4),
        publicSignals: view.publicSummary.tableMemory.publicSignals.slice(-8),
      },
    },
    privateContext: buildPrivateSpeechContext(view),
    expertStrategy: buildExpertStrategyNotes(view),
    advancedReasoning,
    inferenceLayers: buildPublicInferenceLayers(view),
    reasoningFrame,
    rolePlaybook,
    claimAudit,
    debateAgenda,
    playerSpeechGuide: buildPlayerSpeechGuide(view, plan, speechOrder, ordinarySpeechDirector),
    speechContract,
    speechPlan,
    speechStrictness: strictness,
    llmConfig: view.llmConfig,
    ...(constraints.length > 0 ? { constraints } : {}),
  };
  return sanitizeClassTrialLlmGuidanceInput(view, input);
}

function sanitizeClassTrialLlmGuidanceInput(view: AgentView, input: LlmSpeechInput): LlmSpeechInput {
  if (view.roleCard?.theme !== "class-trial") return input;
  const sanitized = {
    ...input,
    tableBriefing: sanitizeClassTrialGuidancePayload(input.tableBriefing),
    privateContext: sanitizeClassTrialGuidancePayload(input.privateContext),
    expertStrategy: sanitizeClassTrialGuidancePayload(input.expertStrategy),
    advancedReasoning: sanitizeClassTrialGuidancePayload(input.advancedReasoning),
    inferenceLayers: sanitizeClassTrialGuidancePayload(input.inferenceLayers),
    reasoningFrame: sanitizeClassTrialGuidancePayload(input.reasoningFrame),
    rolePlaybook: sanitizeClassTrialGuidancePayload(input.rolePlaybook),
    claimAudit: sanitizeClassTrialGuidancePayload(input.claimAudit),
    debateAgenda: sanitizeClassTrialGuidancePayload(input.debateAgenda),
    playerSpeechGuide: sanitizeClassTrialGuidancePayload(input.playerSpeechGuide),
    speechContract: sanitizeClassTrialGuidancePayload(input.speechContract),
    speechPlan: sanitizeClassTrialGuidancePayload(input.speechPlan),
    constraints: input.constraints ? sanitizeClassTrialGuidancePayload(input.constraints) : undefined,
  };
  return stripClassTrialDecisionScriptsForLlm(view, sanitized);
}

function stripClassTrialDecisionScriptsForLlm(view: AgentView, input: LlmSpeechInput): LlmSpeechInput {
  const speechPlan = input.speechPlan;
  const keepHardSpeechContract =
    speechPlan?.claimIntent?.strength === "hard" ||
    speechPlan?.speechMove === "claim_black_check" ||
    speechPlan?.speechMove === "claim_gold_check" ||
    speechPlan?.speechMove === "identity_claim";
  return {
    ...input,
    characterLens: input.characterLens ? buildClassTrialFreeformCharacterLens(input.characterLens) : undefined,
    tableBriefing: buildClassTrialFreeformTableBriefing(input.tableBriefing),
    privateContext: buildClassTrialFreeformPrivateContext(view, input.privateContext, speechPlan),
    expertStrategy: [],
    advancedReasoning: [],
    inferenceLayers: emptyInferenceLayers(),
    reasoningFrame: emptyReasoningFrame(),
    rolePlaybook: emptyRolePlaybook(input.rolePlaybook),
    claimAudit: emptyClaimAudit(),
    debateAgenda: emptyDebateAgenda(),
    playerSpeechGuide: buildClassTrialFreeformPlayerGuide(input.playerSpeechGuide, input.characterLens, input.classTrialLiveState, input.characterRole),
    speechContract: keepHardSpeechContract
      ? input.speechContract
      : {
          ...input.speechContract,
          mustSay: [],
          mayAsk: [],
          mustNotAsk: retainClassTrialFreeformSafetyMustNotAsk(input.speechContract.mustNotAsk),
          voteBoundary: undefined,
        },
    speechPlan: undefined,
    constraints: undefined,
  };
}

function retainClassTrialFreeformSafetyMustNotAsk(lines: string[]): string[] {
  return lines.filter((line) =>
    /(?:D1已有预言家查杀后|D1已有预言家报验后|报金水后，金水天然暂不进出人焦点|平安夜和女巫用药只可短句带过)/.test(line),
  );
}

function buildClassTrialFreeformCharacterLens(lens: ClassTrialCharacterLens): ClassTrialCharacterLens {
  return {
    ...lens,
    voteRationaleStyle: [],
    forbiddenTemplates: [],
    signalKeywords: [],
    fallbackMoves: [],
    werewolfStrategy: {
      readPriority: [],
      pressureMethod: [],
      voteLogic: [],
      asVillager: [],
      asWerewolf: [],
      asPowerRole: [],
      nightBias: [],
      lastWordsMode: [],
    },
  };
}

function buildClassTrialFreeformTableBriefing(
  briefing: LlmSpeechInput["tableBriefing"],
): LlmSpeechInput["tableBriefing"] {
  const publicFacts = briefing.publicFacts.filter(
    (line) => !/(必须|禁止|不能|不要|只能|不得|规则限制|私有边界|可发言方向|推理框架|身份材料|本轮追问|投票承诺|施压方向)/.test(line),
  );
  const privateFacts = briefing.privateFacts.filter((line) => !/(必须|禁止|不能|不要|只能|不得)/.test(line));
  return {
    text: ["【当前公开事实】", ...publicFacts, ...privateFacts.map((line) => `你的私有事实：${line}`)].join("\n"),
    speechProgress: briefing.speechProgress,
    publicBoundary: [],
    privateBoundary: [],
    publicFacts,
    privateFacts,
    unknowns: [],
    legalSpeechFocus: [],
    publicReasoningCues: [],
  };
}

function buildClassTrialFreeformPrivateContext(
  view: AgentView,
  privateContext: LlmSpeechInput["privateContext"],
  speechPlan: SpeechPlan | undefined,
): LlmSpeechInput["privateContext"] {
  const revealSeerCheck =
    speechPlan?.claimIntent?.claimedRole === "SEER" &&
    speechPlan.claimIntent.check &&
    speechPlan.claimIntent.strength === "hard";
  const plannedCheck = speechPlan?.claimIntent?.check;
  const seerChecks =
    revealSeerCheck && plannedCheck
      ? privateContext.seerChecks?.filter(
          (check) => check.day === plannedCheck.day && check.target.seatId === plannedCheck.targetSeatId && check.result === plannedCheck.result,
        )
      : undefined;
  const revealWitch =
    speechPlan?.claimIntent?.claimedRole === "WITCH" &&
    speechPlan.claimIntent.strength === "hard" &&
    (speechPlan.playMotive?.allowIdentityClaim || view.myRole === "WITCH");
  return {
    role: privateContext.role,
    aiMemory: privateContext.aiMemory,
    seerChecks,
    witch: revealWitch ? privateContext.witch : undefined,
  };
}

function buildClassTrialFreeformPlayerGuide(
  guide: LlmSpeechInput["playerSpeechGuide"],
  lens: ClassTrialCharacterLens | undefined,
  liveState: ClassTrialLiveState | undefined,
  roleCard: LlmSpeechInput["characterRole"],
): LlmSpeechInput["playerSpeechGuide"] {
  const roleProfileGuide = formatClassTrialRoleVoiceProfile(roleCard);
  const checkResultSeerClaimGuide = guide.tablePlayerStyle.find((line) =>
    line.includes("报查验结果、金水或查杀已经等同于预言家声明"),
  );
  const hasPublicSeerCheckGuide = Boolean(checkResultSeerClaimGuide);
  const attentionLine = hasPublicSeerCheckGuide
    ? "角色会优先注意：报验者怎样处理金水或查杀、被验位置如何接、后置位是否无理由硬踩或对跳。"
    : lens?.attentionBias[0]
      ? `角色会优先注意：${lens.attentionBias.slice(0, 2).join("；")}`
      : undefined;
  const pressureLine = hasPublicSeerCheckGuide
    ? "角色施压方式：只压一个已经说出口的处理动作，例如金水被谁无理由硬踩、查杀回应、对跳时机或后置反应。"
    : lens?.pressureMove[0]
      ? `角色施压方式：${lens.pressureMove.slice(0, 2).join("；")}`
      : undefined;
  const tablePlayerStyle = [
    lens ? `本地主题角色：${lens.displayName}。` : undefined,
    roleProfileGuide ? `角色资料：\n${roleProfileGuide}` : undefined,
    liveState ? `本轮临场状态：${formatClassTrialLiveStateForPrompt(liveState)}` : undefined,
    "学级裁判主题局：角色正在玩狼人杀，不是狼人杀玩家套角色皮；先像角色本人反应，再自然落到公开事实。",
    "角色感优先。可以有偏见、自保、误判、挑衅或伪装，但只能使用公开桌面和自己合法知道的信息。",
    "不能打断别人回合；只能在自己的发言轮里完整回应上一位、点名施压、躲闪或改口。",
    checkResultSeerClaimGuide,
    !hasPublicSeerCheckGuide && lens?.openingMove ? `低信息开局动作：${lens.openingMove}` : undefined,
    attentionLine,
    pressureLine,
    lens?.sampleCadence ? `说话节奏：${lens.sampleCadence}` : undefined,
    guide.modelStyle.softTendency ? `模型软倾向：${guide.modelStyle.softTendency}` : undefined,
  ].filter((line): line is string => Boolean(line));
  return {
    tablePlayerStyle,
    modelStyle: guide.modelStyle,
    tableTask: undefined,
    softInteraction: [
      "按当前角色的第一人称反应自由发言；如果有真实身份信息，只按自己愿意公开的事实说出口。",
      "承接上一位时只接公开原话，不复述系统给你的任务或判断框架。",
      "这一轮只做一个当前动作：压人、退让、试探、装糊涂、切话题、保人、反打、拖延、逼问或戏剧化升级。",
    ],
    avoid: [
      "不要复述系统任务、合同词或分析标签。",
      "不要把发言写成总结报告；先像角色本人说话，再自然落到一个公开判断或动作。",
      "不要复读角色标签、固定口癖或上一轮已经用过的思路。",
    ],
  };
}

function emptyInferenceLayers(): PublicInferenceLayers {
  return {
    facts: [],
    highProbability: [],
    lowProbability: [],
    privateUnknowns: [],
  };
}

function emptyReasoningFrame(): AiReasoningFrame {
  return {
    hardEvidence: [],
    softSignals: [],
    counterHypotheses: [],
    validationQuestions: [],
    persuasionGoals: [],
  };
}

function emptyRolePlaybook(playbook: AiRolePlaybook): AiRolePlaybook {
  return {
    ...playbook,
    tableIdentity: "",
    tacticalVariants: [],
    reasoningPriorities: [],
    actionForks: [],
    speechAngles: [],
    avoid: [],
  };
}

function emptyClaimAudit(): AiClaimAudit {
  return {
    contestedClaims: [],
    protectedClaims: [],
    checkChains: [],
    contradictions: [],
    followupTests: [],
    actionGuidance: [],
  };
}

function emptyDebateAgenda(): AiDebateAgenda {
  return {
    crossExamination: [],
    voteCommitments: [],
    roleCoordination: [],
    pressureLines: [],
    avoidTraps: [],
  };
}

function sanitizeClassTrialGuidancePayload<T>(value: T): T {
  if (typeof value === "string") return sanitizeClassTrialGuidanceText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeClassTrialGuidancePayload(item)) as T;
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = sanitizeClassTrialGuidancePayload(nested);
  }
  return result as T;
}

function sanitizeClassTrialGuidanceText(text: string): string {
  return text
    .replace(/审计/g, "核验")
    .replace(/不主动展开第一晚为什么选验/g, "第一晚只需要把结果报清楚")
    .replace(/不展开第一晚为什么选(?:验|他|她)/g, "第一晚只需要把结果报清楚")
    .replace(/第一晚为什么选(?:验|他|她)|为什么选验|为什么选他|为什么选她/g, "首验理由")
    .replace(/发言顺序、票型和前后逻辑一起校验/g, "谁把不确定说成确定，我就从那句反应往回听")
    .replace(/我会把前后发言、站边和票型放在一起校验/g, "我会把前后两句话有没有接上放在一起听")
    .replace(/为什么验这个人、明天验谁、今天票谁、验人和票型是否互相服务/g, "今天先怎么处理这条查杀，谁敢公开和这条结果对撞")
    .replace(/验人和票型是否互相服务/g, "查杀和今天选择是否接得上")
    .replace(/验人和票型/g, "查杀和今天选择")
    .replace(/自然站边和票型/g, "后续表态")
    .replace(/站边和票口/g, "表态和今天要压哪里")
    .replace(/站边、票口和身份线/g, "表态和身份说法")
    .replace(/站边、票口/g, "表态")
    .replace(/站边和上一轮票型/g, "前后选择")
    .replace(/预言家线/g, "预言家说法")
    .replace(/身份坑/g, "身份说法")
    .replace(/神坑/g, "神职说法")
    .replace(/狼坑/g, "嫌疑位置")
    .replace(/身份线/g, "身份说法")
    .replace(/票型/g, "投票选择")
    .replace(/票口/g, "今天要压哪里")
    .replace(/站边/g, "表态")
    .replace(/闭环/g, "接上")
    .replace(/闭合/g, "接上")
    .replace(/能否接上/g, "能不能说圆")
    .replace(/是否接上/g, "有没有说圆")
    .replace(/公开缺口/g, "能让全桌看见的断点")
    .replace(/反证缺口/g, "能让全桌看见的反证")
    .replace(/缺口/g, "没接上的地方")
    .replace(/公开点/g, "能让全桌看见的一点")
    .replace(/一个字都没落桌/g, "没有说到桌上")
    .replace(/一个字没落桌/g, "没有说到桌上")
    .replace(/平安夜药线/g, "平安夜这句话")
    .replace(/查验心路/g, "查验安排")
    .replace(/验人心路/g, "查验安排")
    .replace(/为什么验这个位置/g, "这条结果今天怎么处理")
    .replace(/为什么验/g, "为什么现在要压")
    .replace(/验人落/g, "查杀落")
    .replace(/随便丢/g, "空口丢")
    .replace(/核验这些验人有没有带出后续表态/g, "核验这条查验能不能支撑今天处理")
    .replace(/今天今天要压哪里/g, "今天要压哪里");
}

function buildPlayerSpeechGuide(
  view: AgentView,
  plan: SpeechPlan,
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
  ordinarySpeechDirector?: OrdinarySpeechDirector,
): LlmSpeechInput["playerSpeechGuide"] {
  const currentDaySpeeches = currentDaySpeechItems(view);
  const previousSpeech = [...view.publicSummary.recentSpeeches]
    .reverse()
    .find((speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId);
  const targetLine = plan.target
    ? `本轮可以先看${seatText(plan.target)}已经说出口的内容；如果前置发言或身份说法更重要，也可以自然转向。`
    : "本轮没有必须锁死的目标，可以从前置发言、公开身份说法、票型或死亡播报里选最像玩家的切入点。";
  const stageLine =
    speechOrder.speakersAlreadyFinished.length > 0
      ? `你是已有人发言后的轮次，桌面材料来自${formatSeatList(speechOrder.speakersAlreadyFinished)}。`
      : "你是靠前发言位，先说自己的状态和临时处理，不要假装已经听完全场，也不要铺一圈通用作业。";
  const roleCard = view.roleCard;
  const classTrialLens = getClassTrialCharacterLens(roleCard);
  const suppressFukawaTogamiGuide = shouldSuppressFukawaTogamiGuide(view, plan);
  const classTrialLensForPrompt = suppressFukawaTogamiGuide ? undefined : classTrialLens;
  const isFinalSpeakerToday = speechOrder.currentDayUnspokenSeats.filter((seat) => seat.seatId !== view.mySeatId).length === 0;
  const lowInfoDayOneNoHardInfo = isLowInfoDayOneNoHardInfo(view) && !isClassTrialHardInfoSpeech(view, plan);
  const lowInfoOpeningLine = lowInfoDayOneNoHardInfo
    ? isFinalSpeakerToday
      ? "低信息首轮不用强行站边或落票口：你是今天最后一个发言位，不再等待后置位；接住已经出现的前后说法、身份声明或情绪转折，只留一个当前能回头看的判断。"
      : speechOrder.speakersAlreadyFinished.length === 0
        ? "低信息首轮不用强行站边或落票口：你是首置位，只说自己的状态和临时处理，说完可以停；默认不点名后置位，也不要补“后面看谁反应”的未来标准；可以先过、暂放或说我现在听不出来。"
        : "低信息首轮不用强行站边或落票口：只给观察点、保留态度或跟压理由，不把前置位没站边当唯一问题；如果点后置位，必须接住已经说出口的前后说法，只留一个具体问题，不能把后置位当流程作业表。"
    : undefined;
  const classTrialRepeatedFocusGuide = buildClassTrialRepeatedFocusGuide(view, { currentDaySpeeches });
  const classTrialSelfIntroductionLine = buildClassTrialSelfIntroductionGuide(view);
  const classTrialOpeningDirectorGuide = buildClassTrialOpeningDirectorGuide(view, classTrialLensForPrompt, {
    isLowInfoDayOneNoHardInfo: lowInfoDayOneNoHardInfo,
    isFinalSpeakerToday,
    isOpeningSpeaker: currentDaySpeeches.length === 0,
  });
  const classTrialFinalSpeakerGuide = buildClassTrialFinalSpeakerGuide(view, isFinalSpeakerToday);
  const classTrialDialogueRewriteGuide = buildClassTrialDialogueRewriteGuide(view, classTrialLensForPrompt);
  const classTrialPersonaGuide = buildClassTrialPersonaAwareGuide(view, {
    hasActionablePublicInfo: hasActionableClassTrialPublicInfo(view, currentDaySpeeches),
  });
  const universalDeTemplateGuide = buildUniversalDeTemplateGuide(view);
  const ordinaryPlayerMouthGuide =
    view.roleCard?.theme === "class-trial" ? undefined : buildOrdinaryPlayerMouthGuide(view);
  const ordinaryLiveIntent = view.roleCard?.theme === "class-trial" ? undefined : buildOrdinaryLiveIntent(view, plan);
  const ordinaryLiveIntentPrompt = formatOrdinaryLiveIntentForPrompt(ordinaryLiveIntent);
  const ordinaryRepeatedPressureGuide =
    view.roleCard?.theme === "class-trial" ? undefined : buildOrdinaryRepeatedPressureGuide(view);
  const ordinaryOpeningAntiCopyGuide =
    view.roleCard?.theme === "class-trial" ? undefined : buildOrdinaryOpeningAntiCopyGuide(view);
  const nameAwareAddressingGuide = buildNameAwareAddressingGuide(view);
  const classTrialDayContinuationLine = buildClassTrialDayContinuationGuide(view);
  const checkResultSeerClaimGuide = buildCheckResultSeerClaimGuide(view);
  const roleCardStyleLines = roleCard
    ? [
        `本地主题角色：${roleCard.displayName}。中文对白风格：${roleCard.speechStyleZh}`,
        ...(roleCard.theme === "class-trial"
          ? [
              "学级裁判主题局目标：角色正在玩狼人杀，不是狼人杀玩家套角色皮；先保留人物的反应、偏见和说话方式，再把一个公开狼人杀事件落到桌上。",
              "学级裁判主题局：不要照普通狼人杀模板复述局势；像角色站在裁判场里临场辩论，把同一条公开逻辑说成自己的语气。",
              "学级裁判主题局：低信息轮次可以短促、有情绪或带偏见；强信息轮次要让玩家听懂身份和公开依据，但不要把发言写成标准狼人杀教程。",
              "学级裁判主题局：如果前置位已经围绕同一个抽象质疑打转，不要只换人重复上一位的质疑；用本角色的新角度切入，例如希望、证词、嘲讽审判、绝望伪装、下注、合格线、声音断点或关系链。",
              classTrialSelfIntroductionLine,
              classTrialOpeningDirectorGuide,
              classTrialFinalSpeakerGuide,
              classTrialDialogueRewriteGuide,
              classTrialPersonaGuide,
              "学级裁判主题局：不要用“身份-信息-站边-票口”的四件套开场，也不要每轮换座位号套同一句式；每轮先选一个角色动作，再接一个公开狼人杀事件。",
              classTrialDayContinuationLine,
              classTrialRepeatedFocusGuide,
              suppressFukawaTogamiGuide
                ? "腐川本轮先回应公开查杀或身份硬信息；不要主动提十神，除非十神已经被公开发言、身份线、票型或点名卷入。"
                : undefined,
              classTrialLensForPrompt ? formatClassTrialLensForSpeech(classTrialLensForPrompt) : undefined,
              classTrialLensForPrompt ? `角色投票理由解释方式：可以参考「${classTrialLensForPrompt.voteRationaleStyle.join("；")}」，但出口仍要像${classTrialLensForPrompt.displayName}在作选择，不像狼人杀复盘。` : undefined,
              roleCard.styleTags.length > 0
                ? `角色节奏标签：${roleCard.styleTags.join("、")}。这些标签只影响表达节奏，不改变事实边界。`
                : undefined,
              `本局阵营演法：${isWolfRole(view.myRole) ? roleCard.asWerewolf : roleCard.asVillager}`,
              roleCard.relationshipHints.length > 0 && !suppressFukawaTogamiGuide
                ? `角色互动线索：${roleCard.relationshipHints.join("；")}`
                : undefined,
            ].filter((line): line is string => Boolean(line))
          : []),
        `角色推理偏好：${roleCard.reasoningBias}`,
        `被怀疑时反应：${roleCard.pressureResponse}`,
        `口癖边界：${roleCard.catchphrasePolicy}`,
      ]
    : [];

  return {
    tablePlayerStyle: [
      ...roleCardStyleLines,
      lowInfoOpeningLine,
      roleCard?.theme === "class-trial"
        ? "像站在学级裁判场里发言：可以先有角色反应，再接一个公开事件；查杀、拍身份、被查杀回应要让玩家听懂你在参与狼人杀，但不用每句都像高玩发言。"
        : lowInfoOpeningLine
          ? "像坐在桌边发言：2-3句短句，只抓一条主线；先说当前状态或暂放边界，再给1个公开理由，最后留下自己怎么处理。"
          : "像坐在桌边发言：2-3句短句，只抓一条主线；先给当前站边或保留态度，再给1个公开理由，最后留下追问或票口。",
      roleCard?.theme === "class-trial"
        ? "不用每句都形成标准因果链；先让角色有真实反应，再留一个能被其他玩家接住的公开点。不要把所有人都写成同一种逻辑审计员。"
        : "说清自己的顺序：我现在更不舒服的是谁，哪句话没听明白，后面看什么验证；不要把所有点都塞进同一段，不要列第一、第二、第三。",
      universalDeTemplateGuide,
      ordinaryOpeningAntiCopyGuide,
      ordinaryRepeatedPressureGuide,
      ordinaryPlayerMouthGuide,
      ordinaryLiveIntentPrompt ? `普通局临场意图：${ordinaryLiveIntentPrompt}` : undefined,
      ...(ordinarySpeechDirector?.promptLines ?? []),
      nameAwareAddressingGuide,
      checkResultSeerClaimGuide,
      roleCard?.theme === "class-trial"
        ? "允许角色化短句、犹豫、挑衅或社交转场；禁止套用“桌面已经很多人”“我不重复那个缺口”“我换一个角度”“这个疑点未解除”；每轮换一个推进动作，不要把同一套狼人杀发言模板贴到不同角色身上。"
        : "允许牌桌口吻，例如“我先不站死”“这个点先记”“这轮票口先放这里”，但不要连续多句都用“我先”开头。",
      targetLine,
      stageLine,
      classTrialDayContinuationLine,
    ].filter((line): line is string => Boolean(line)),
    modelStyle: buildModelSpeechStyleGuide(view),
    tableTask: plan.tableTask,
    softInteraction: [
      plan.tableTask
        ? `本座位的桌面任务：${plan.tableTask.line}。优先完成这个任务，避免和前面玩家重复同一句压力。`
        : "没有额外桌面任务，按当前局势自然推进。",
      previousSpeech
        ? `上一位是${seatText(previousSpeech.speaker!)}：${clipBriefingText(
            previousSpeech.message,
            72,
          )}。如果和你的判断有关，可以轻接一句；不相关就直接讲自己的逻辑。`
        : "当前没有必须承接的上一位发言，直接铺自己的视角即可。",
      plan.interaction
        ? `可选接话素材：${plan.interaction.line}。这是素材，不是必须照念。`
        : "没有必须接话的素材，保持自然发言节奏。",
      plan.personaCue
        ? `可选打法重心：${plan.personaCue.line}。把它变成玩家判断，不要写成分析报告。`
        : "打法重心以局势为准，模型特点只影响取舍和表达节奏。",
      ordinaryLiveIntentPrompt
        ? `普通局临场意图只供取舍：${ordinaryLiveIntentPrompt}。说出口时换成自然牌桌话，不要复述这些字段或策略语。`
        : undefined,
      ordinarySpeechDirector
        ? `普通局软导演只供取舍：${ordinarySpeechDirector.promptLines.join(" ")}`
        : undefined,
      ordinaryRepeatedPressureGuide
        ? `${ordinaryRepeatedPressureGuide} 这是当前轮次硬约束，不是可选素材。`
        : undefined,
    ].filter((line): line is string => Boolean(line)),
    avoid: [
      "不要为了接话强行回应上一位；只有相关时自然承接。",
      buildSelfIntroductionBoundaryLine(view),
      "不要机械复述事实简报、规则限制或桌面事实说明。",
      "少用报告腔词组，例如“理由是”“依据是”“这个结论来自”；把它们改成牌桌口吻，如“我没听明白的是”“我打他的点是”。",
      "不要把内部标签说成台词，例如“拆因果”“第一点”“盘问议程”“可改票条件”。",
      "普通局不要说“身份空间、发言缺口、怎么用这个信息、起票、补票、最后跟票”；改成“我先当这个身份听、哪里没说清、票准备往哪放、谁先把票带起来、谁顺着跟”。",
      "不要列第一、第二、第三，也不要让别人一次回答两三个问题。",
      "不要面面俱到；身份坑、票型、发言顺序、死亡播报里选一个最能推进本轮的问题。",
      "已经发过言的位置只能回看其已发表内容，不要让他后面再补、轮到他再回应。",
      "不要把边角位、语气、短发言、划水这类软状态直接当铁狼证据。",
      "不要泄露私有身份信息；狼队视角、真实查验和女巫药瓶只能按角色策略决定是否公开。",
      ...(roleCard
        ? [
            "角色卡只影响语气和轻度取舍，不能覆盖阵营胜利目标、公开事实边界或狼人杀规则。",
            roleCard.theme === "class-trial"
              ? "学级裁判主题局里避免通用狼人杀模板句，例如连续使用“我先按公开信息盘”“理由是”“票口先放这里”“我是闭眼好人”“信息不多先听后置”；保留角色的犹豫、挑衅、冷静、压迫感或社交感。不要把“嗯”“啊”“那个”塞在数字座位或投票目标中间。"
              : undefined,
            roleCard.theme === "class-trial"
              ? "学级裁判主题局里不要把“低信息、站边、票口、闭环、缺口、后置位”当成台词骨架；必须出现查验、投票、身份声明时可以说，但先用角色自己的话承接。"
              : undefined,
            classTrialDayContinuationLine,
            ...roleCard.forbidden,
          ].filter((line): line is string => Boolean(line))
        : []),
    ],
  };
}

function buildOrdinarySpeechDirector(
  view: AgentView,
  plan: SpeechPlan,
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
): OrdinarySpeechDirector {
  const currentDaySpeeches = currentDaySpeechItems(view).filter((speech) => speech.speaker?.seatId !== view.mySeatId);
  const latestSpeech = [...currentDaySpeeches].reverse()[0];
  const deathShape = getCurrentDayDeathShape(view);
  const questionedSpeech = [...currentDaySpeeches]
    .reverse()
    .find((speech) => isOrdinaryQuestioningCurrentSeat(speech.message, view.mySeatId));
  const blackCheckAgainstSelf = findPublicBlackCheckAgainstSelf(view);
  const hasPublicRoleClaim =
    plan.claimIntent?.strength === "hard" ||
    plan.speechMove === "claim_black_check" ||
    plan.speechMove === "claim_gold_check" ||
    plan.speechMove === "identity_claim" ||
    view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day || claim.checks.some((check) => check.day === view.day));
  const currentPressure = resolveOrdinarySpeechPressure({
    view,
    speechOrder,
    latestSpeech,
    questionedSpeech,
    blackCheckAgainstSelf: Boolean(blackCheckAgainstSelf),
    hasPublicRoleClaim,
    deathShape,
  });
  const repeatedPressureAxis = detectOrdinaryRepeatedPressureAxis(view, currentDaySpeeches);
  const tableObjects = buildOrdinaryDirectorTableObjects(view, plan, {
    latestSpeech,
    questionedSpeech,
    deathShape,
    blackCheckClaimant: blackCheckAgainstSelf?.claimant,
    repeatedPressureAxis,
  });
  const recentSurfaceMoves = collectOrdinaryRecentSurfaceMoves(
    currentDaySpeeches.map((speech) => speech.message),
    repeatedPressureAxis,
  );
  const allowedSpeechMoves = buildOrdinaryAllowedSpeechMoves(currentPressure, {
    latestSpeech: Boolean(latestSpeech),
    recentSurfaceMoves,
    repeatedPressureAxis,
  });
  const playerVoiceCard = buildOrdinaryPlayerVoiceCard(view);
  const selfHistory = buildOrdinarySelfHistory(view);
  const promptLines = formatOrdinarySpeechDirectorPromptLines({
    currentPressure,
    tableObjects,
    allowedSpeechMoves,
    recentSurfaceMoves,
    playerVoiceCard,
    selfHistory,
  });

  return {
    currentPressure,
    tableObjects,
    allowedSpeechMoves,
    recentSurfaceMoves,
    playerVoiceCard,
    selfHistory,
    promptLines,
  };
}

function resolveOrdinarySpeechPressure({
  view,
  speechOrder,
  latestSpeech,
  questionedSpeech,
  blackCheckAgainstSelf,
  hasPublicRoleClaim,
  deathShape,
}: {
  view: AgentView;
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"];
  latestSpeech?: AgentView["publicSummary"]["recentSpeeches"][number];
  questionedSpeech?: AgentView["publicSummary"]["recentSpeeches"][number];
  blackCheckAgainstSelf: boolean;
  hasPublicRoleClaim: boolean;
  deathShape: CurrentDayDeathShape;
}): OrdinarySpeechPressure {
  if (questionedSpeech || blackCheckAgainstSelf) return "underQuestion";
  if (hasPublicRoleClaim) return "publicRoleClaim";
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return "voteBoundary";
  if (isLowInfoDayOneNoHardInfo(view) && speechOrder.speakersAlreadyFinished.length === 0) return "noInformation";
  if (latestSpeech) return "respondToPrevious";
  if (deathShape !== "none") return "deathShape";
  return "noInformation";
}

function buildOrdinaryDirectorTableObjects(
  view: AgentView,
  plan: SpeechPlan,
  context: {
    latestSpeech?: AgentView["publicSummary"]["recentSpeeches"][number];
    questionedSpeech?: AgentView["publicSummary"]["recentSpeeches"][number];
    deathShape: CurrentDayDeathShape;
    blackCheckClaimant?: ActionTarget;
    repeatedPressureAxis?: OrdinaryRepeatedPressureAxis;
  },
): string[] {
  const items: string[] = [];
  if (context.questionedSpeech?.speaker) {
    items.push(`${seatText(context.questionedSpeech.speaker)}点到我：${clipBriefingText(context.questionedSpeech.message, 86)}`);
  } else if (context.blackCheckClaimant) {
    items.push(`${seatText(context.blackCheckClaimant)}给我查杀，我需要先回应这个压力。`);
  } else if (context.latestSpeech?.speaker) {
    items.push(`上一位${seatText(context.latestSpeech.speaker)}：${clipBriefingText(context.latestSpeech.message, 86)}`);
  }

  if (context.deathShape === "peaceful") {
    items.push("昨夜平安夜：无守卫女巫局里按女巫用药的公开背景处理。");
  } else if (context.deathShape === "death") {
    items.push("昨夜有倒牌：只当公开死讯背景，不展开刀口规则课。");
  }

  if (context.repeatedPressureAxis) {
    items.push(
      `共享压力预算已用完：${context.repeatedPressureAxis.target.seatId}号已被连续点到${context.repeatedPressureAxis.count}次；不要继续沿着同一压力轴复读，后续座位不要继续追同一个人同一个点，换成暂放、票口边界、回应结果或自己的新对象。`,
    );
  }

  const latestClaim = [...view.publicSummary.claimBoard].reverse()[0];
  if (latestClaim) {
    items.push(`${seatText(latestClaim.claimant)}公开声明${ROLE_LABELS[latestClaim.claimedRole] ?? latestClaim.claimedRole}。`);
  }

  if (plan.target && hasCurrentDaySpeech(view, plan.target.seatId)) {
    const targetSpeech = [...currentDaySpeechItems(view)]
      .reverse()
      .find((speech) => speech.speaker?.seatId === plan.target?.seatId);
    if (targetSpeech) {
      items.push(`${seatText(plan.target)}已发言：${clipBriefingText(targetSpeech.message, 72)}`);
    }
  }

  if (items.length === 0) {
    items.push("当前公开信息少，只能给自己的临时处理方式。");
  }
  return uniqueStrings(items).slice(0, 4);
}

function detectOrdinaryRepeatedPressureAxis(
  view: AgentView,
  speeches: AgentView["publicSummary"]["recentSpeeches"],
): OrdinaryRepeatedPressureAxis | undefined {
  const speakerHitsByTarget = new Map<number, Map<number, ActionTarget>>();
  for (const speech of speeches.slice(-6)) {
    if (!speech.speaker || !looksLikeOrdinaryPressureSpeech(speech.message)) continue;
    for (const seatId of collectOrdinaryMentionedSeatIds(speech.message)) {
      if (seatId === speech.speaker.seatId || seatId === view.mySeatId) continue;
      const target = toTargetFromSeatId(view, seatId);
      if (!target) continue;
      const speakerHits = speakerHitsByTarget.get(seatId) ?? new Map<number, ActionTarget>();
      speakerHits.set(speech.speaker.seatId, speech.speaker);
      speakerHitsByTarget.set(seatId, speakerHits);
    }
  }

  const dominant = [...speakerHitsByTarget.entries()]
    .map(([seatId, speakers]) => ({ target: toTargetFromSeatId(view, seatId), speakers: [...speakers.values()] }))
    .filter((axis): axis is { target: ActionTarget; speakers: ActionTarget[] } => Boolean(axis.target))
    .filter((axis) => axis.speakers.length >= 2)
    .sort((left, right) => right.speakers.length - left.speakers.length || left.target.seatId - right.target.seatId)[0];

  return dominant ? { target: dominant.target, count: dominant.speakers.length, speakers: dominant.speakers } : undefined;
}

function looksLikeOrdinaryPressureSpeech(message: string): boolean {
  return /(?:压|票|解释|回应|说清|讲清|没说清|哪里没|不舒服|打死|质疑|踩|聊|看他|看她)/.test(message);
}

function collectOrdinaryMentionedSeatIds(message: string): number[] {
  const seats = [...message.matchAll(/([0-9]+|[一二三四五六七八九十两]+)\s*号/g)]
    .map((match) => parseSeatNumber(match[1] ?? ""))
    .filter((seatId): seatId is number => typeof seatId === "number");
  return [...new Set(seats)];
}

function buildOrdinaryAllowedSpeechMoves(
  currentPressure: OrdinarySpeechPressure,
  options: {
    latestSpeech: boolean;
    recentSurfaceMoves: string[];
    repeatedPressureAxis?: OrdinaryRepeatedPressureAxis;
  },
): OrdinarySpeechMove[] {
  const byPressure: Record<OrdinarySpeechPressure, OrdinarySpeechMove[]> = {
    noInformation: ["waterPass"],
    respondToPrevious: ["quoteOneLine", "halfAccept", "discomfort", "followPressure", "hold"],
    underQuestion: ["defendSelf", "clarifyMotive", "counterQuestion", "hold"],
    publicRoleClaim: ["roleHandle", "voteBoundary", "hold", "waterPass", "changeRead", "discomfort"],
    deathShape: ["waterPass", "hold", "voteBoundary"],
    voteBoundary: ["voteBoundary", "quoteOneLine", "changeRead", "hold"],
  };
  const repeatedQuoteSurface = options.recentSurfaceMoves.some((move) =>
    /接上一位|我听到了|这句话本身|留疑问|卡\/卡一句|接线|整句引用重复/.test(move),
  );
  const moveLimit = currentPressure === "publicRoleClaim" ? 6 : 5;
  const moves = [...byPressure[currentPressure]];
  if (repeatedQuoteSurface && currentPressure !== "underQuestion" && currentPressure !== "publicRoleClaim") {
    const shiftedMoves = moves.filter((move) => move !== "quoteOneLine" && move !== "halfAccept");
    shiftedMoves.push("discomfort", "hold", "voteBoundary");
    return uniqueOrdinarySpeechMoves(shiftedMoves).slice(0, moveLimit);
  }
  if (options.repeatedPressureAxis && currentPressure !== "underQuestion") {
    const shiftedMoves = moves.filter(
      (move) => move !== "quoteOneLine" && move !== "halfAccept" && move !== "followPressure",
    );
    shiftedMoves.push("hold", "waterPass", "voteBoundary", "changeRead");
    return uniqueOrdinarySpeechMoves(shiftedMoves).slice(0, moveLimit);
  }
  if (options.latestSpeech && currentPressure !== "underQuestion") moves.push("quoteOneLine", "halfAccept");
  return uniqueOrdinarySpeechMoves(moves).slice(0, moveLimit);
}

function buildOrdinaryPlayerVoiceCard(view: AgentView): OrdinaryPlayerVoiceCard {
  const persona = view.persona;
  const fallbackTypeId = persona
    ? inferOrdinaryPlayerTypeId({
        riskTolerance: persona.riskTolerance,
        bluffing: persona.bluffing,
        preferences: persona.preferences,
      })
    : "soft-follower";
  const profile = sanitizeOrdinaryPlayerProfile(persona?.ordinaryPlayerProfile, fallbackTypeId);
  const preset = ORDINARY_PLAYER_TYPE_PRESETS[profile.playerTypeId];
  const traits = uniqueStrings([
    preset.shortLabel,
    profile.sliders.speechLength <= 0.36 ? "短句多，允许弱水" : "会多解释一点自己的想法",
    profile.sliders.questionBias >= 0.62 ? "喜欢追一句具体话" : "不一定主动追问",
    profile.sliders.caution >= 0.68 ? "怕背锅，结论慢" : "敢把临时判断说出口",
    profile.sliders.voteFollow >= 0.68 ? "容易受前置位影响" : "不太愿意无理由跟风",
  ]);
  const emotionTell =
    profile.sliders.emotion >= 0.68
      ? "情绪会上桌，先说不舒服、别扭或被影响，再落到一句公开话。"
      : "情绪比较克制，可以犹豫或停顿，但要让人听出当前态度。";
  const riskHabit =
    profile.sliders.voteBias >= 0.62 || profile.sliders.directness >= 0.62
      ? `${preset.actionCue} 说出口时可以先压一个人，但要像临场判断，不像归票模板。`
      : `${preset.actionCue} 说出口时可以先暂放、先过或保留票，不要假装强推理。`;
  const mouthHabit = preset.speechCue;
  const lengthLane =
    profile.sliders.speechLength <= 0.36
      ? "短档，10-70字也可以结束，不必补全桌分析。"
      : profile.sliders.speechLength >= 0.68
        ? "长档，可以说到120-220字，但必须围绕一个主动作。"
        : "中档，60-140字，先落自己的动作再补一句原因。";
  const questionLane =
    profile.sliders.questionBias >= 0.62
      ? "主动追问型，最多追一个具体座位的一句话。"
      : profile.sliders.questionBias <= 0.36
        ? "少追问型，可以只给态度、暂放或防御，不必每轮问人。"
        : "适度追问型，有明确对象才问，没有对象就说自己的处理。";
  const fillerLane =
    profile.sliders.emotion >= 0.62
      ? "允许少量口语填充，如“我有点不舒服”“说实话”“先别急”，但不要每句都同一种开头。"
      : "允许短暂停顿或口语边界，如“先这样”“我暂时放着”，不要写成报告句。";
  const emotionLane =
    profile.sliders.emotion >= 0.68
      ? "高情绪幅度，可以急、烦、委屈或反感，但情绪后必须落到公开发言。"
      : profile.sliders.emotion <= 0.36
        ? "低情绪幅度，克制、慢热、少夸张，可以用迟疑表达不确定。"
        : "中等情绪幅度，允许一点犹豫或不满，不要整段都冷静审计。";
  const riskLane =
    profile.sliders.voteBias >= 0.62 || profile.sliders.directness >= 0.62
      ? "偏主动，可以先压一个对象，但要承认这是临时判断。"
      : profile.sliders.caution >= 0.68
        ? "偏谨慎，怕背锅，可以先放、先听、先保留。"
        : "中等风险，能给临时票口，也能说明自己还没站死。";
  const promptLines = [
    `普通局玩家小传：${preset.label}，${preset.summary}`,
    `稳定特征：${traits.join("、")}。`,
    `口头习惯：${mouthHabit}`,
    `发言长度档位：${lengthLane}`,
    `提问倾向：${questionLane}`,
    `口头填充：${fillerLane}`,
    `情绪幅度：${emotionLane}`,
    `默认风险姿态：${riskLane}`,
    `情绪和防御：${emotionTell}`,
    `风险偏好：${riskHabit}`,
    "这不是台词模板；只影响你先选什么玩家动作、句子长短和犹豫/反感/跟压方式。",
  ];

  return {
    label: preset.label,
    traits,
    mouthHabit,
    emotionTell,
    riskHabit,
    promptLines,
  };
}

function buildOrdinarySelfHistory(view: AgentView): OrdinarySelfHistory | undefined {
  const memory = sanitizeAiMemoryForSpeech(view.privateKnowledge.aiMemory);
  const selfSeatMemory = view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === view.mySeatId);
  const lastPublicSpeech =
    selfSeatMemory?.lastSpeech && selfSeatMemory.lastSpeechDay !== view.day
      ? clipBriefingText(selfSeatMemory.lastSpeech, 110)
      : undefined;
  const lastSpeechTarget = memory?.lastSpeechTargetSeatId
    ? view.aliveSeats.find((seat) => seat.seatId === memory.lastSpeechTargetSeatId)
    : undefined;
  const staleLastSpeechTarget =
    memory?.lastSpeechTargetSeatId && !lastSpeechTarget
      ? toTargetFromSeatId(view, memory.lastSpeechTargetSeatId)
      : undefined;
  const lastVoteTarget = memory?.lastVoteTargetSeatId
    ? view.aliveSeats.find((seat) => seat.seatId === memory.lastVoteTargetSeatId)
    : undefined;
  const staleLastVoteTarget =
    memory?.lastVoteTargetSeatId && !lastVoteTarget
      ? toTargetFromSeatId(view, memory.lastVoteTargetSeatId)
      : undefined;
  const incomingPressure = view.publicSummary.recentSpeeches
    .filter((speech) => speech.speaker && speech.speaker.seatId !== view.mySeatId)
    .filter((speech) => isOrdinaryQuestioningCurrentSeat(speech.message, view.mySeatId))
    .slice(-2)
    .map((speech) => ({
      speaker: speech.speaker!,
      message: clipBriefingText(speech.message, 72),
    }));

  if (
    !lastPublicSpeech &&
    !lastSpeechTarget &&
    !staleLastSpeechTarget &&
    !memory?.lastSpeechStance &&
    !lastVoteTarget &&
    !staleLastVoteTarget &&
    !memory?.lastVoteReason &&
    incomingPressure.length === 0
  ) {
    return undefined;
  }

  const promptLines = [
    "普通局自我历史：你要记得自己上一轮公开怎么站过；可以延续，也可以改口，但要用第一人称说为什么。",
    lastPublicSpeech ? `上一轮我说过：${lastPublicSpeech}` : undefined,
    lastSpeechTarget
      ? `上一轮我发言主要点过${seatText(lastSpeechTarget)}${memory?.lastSpeechStance ? `：${clipBriefingText(memory.lastSpeechStance, 72)}` : "。"}`
      : staleLastSpeechTarget
        ? `上一轮我点过的${seatText(staleLastSpeechTarget)}已经是旧线，不是当前可处理目标；今天不能继续把焦点挂死在这里。`
      : memory?.lastSpeechStance
        ? `上一轮我的发言立场：${clipBriefingText(memory.lastSpeechStance, 72)}`
        : undefined,
    lastVoteTarget
      ? `上一轮我投过${seatText(lastVoteTarget)}${memory?.lastVoteReason ? `：${clipBriefingText(memory.lastVoteReason, 72)}` : "。"}`
      : staleLastVoteTarget
        ? `上一轮我投过的${seatText(staleLastVoteTarget)}现在只能当旧票型背景，不是当前可处理目标。`
      : memory?.lastVoteReason
        ? `上一轮我的投票理由：${clipBriefingText(memory.lastVoteReason, 72)}`
        : undefined,
    ...incomingPressure.map((item) => `这轮我被${seatText(item.speaker)}点过：${item.message}`),
    "这轮如果换目标，不要直接换轴；说清是听到了哪条新公开发言或身份信息。",
  ].filter((line): line is string => Boolean(line));

  return {
    lastPublicSpeech,
    lastSpeechTarget,
    lastSpeechStance: memory?.lastSpeechStance,
    lastVoteTarget,
    lastVoteReason: memory?.lastVoteReason,
    incomingPressure,
    promptLines,
  };
}

function formatOrdinarySpeechDirectorPromptLines({
  currentPressure,
  tableObjects,
  allowedSpeechMoves,
  recentSurfaceMoves,
  playerVoiceCard,
  selfHistory,
}: Pick<
  OrdinarySpeechDirector,
  "currentPressure" | "tableObjects" | "allowedSpeechMoves" | "recentSurfaceMoves" | "playerVoiceCard" | "selfHistory"
>): string[] {
  return [
    "普通局软导演：先选一个玩家动作，再把它说成第一人称牌桌话；不要输出动作名、currentPressure、allowedSpeechMoves、tableObjects 或任何字段名。",
    "v0.4五单元：seatState=当前自我状态，localObject=一个局部公开对象，playerMove=一个玩家动作，socialTexture=口吻纹理，tableContinuation=把话交回牌桌；可以弱、短、犹豫，但不能空。",
    ...playerVoiceCard.promptLines,
    ...(selfHistory?.promptLines ?? []),
    `当前压力：${ordinarySpeechPressureLabel(currentPressure)}。`,
    `局部桌面对象：${tableObjects.join("；")}`,
    `可选动作：${allowedSpeechMoves.map(ordinarySpeechMoveLabel).join("、")}。`,
    tableObjects.some((item) => /平安夜|女巫用药|用了救药/.test(item))
      ? "平安夜女巫用药是公开死亡形态背景；别人只说平安夜、信息少、先听或暂放时，这是可接受的低信息水发言，不要强行打成泄视角或定性。要回应这个人，只能接他真实说出口的后续动作；没有后续动作时，转回自己的临时处理、身份态度或已发言里的具体缺口。"
      : undefined,
    recentSurfaceMoves.length > 0
      ? `最近表面句式已重复：${recentSurfaceMoves.join("、")}；这轮要换玩家动作，不要只换同义词。`
      : "最近还没有明显重复表面句式；仍然只抓一个动作，不写全桌审计。",
    recentSurfaceMoves.some((move) => /接上一位|我听到了/.test(move))
      ? "承接不是礼仪：可以直接反驳，可以不点上一位，可以短水，可以护人，也可以换目标；按当前座位的人设选择一种，不要每段都先接一下。"
      : undefined,
    recentSurfaceMoves.some((move) => /整句引用重复/.test(move))
      ? "前置位已经多次整句引用同一句；这轮只能用自己的话概括、反应或换处理动作，不要再全文引用。"
      : undefined,
    currentPressure === "underQuestion"
      ? "被点名时先回应自己被打到的点，再决定要不要反问；如果对方把“平安夜女巫用药”当泄视角，先说明这是公开死亡形态背景。"
      : undefined,
    currentPressure === "publicRoleClaim"
      ? "公开身份声明不是单一处理器：可以直接站边、质疑跳者动机、护被查者、要求对跳、给票口或短水观望；按当前座位的人设风险选择一种，不要每个人都说“这条线先看怎么站边”。"
      : undefined,
  ].filter((line): line is string => Boolean(line));
}

function isOrdinaryQuestioningCurrentSeat(message: string, seatId: number): boolean {
  const compact = message.replace(/\s+/g, "");
  const seatPattern = new RegExp(`${seatId}\\s*号`);
  if (!seatPattern.test(compact)) return false;
  return /解释|说清|依据|为什么|怎么|泄视角|不成立|不认|质疑|回应|回答|打|踩|问|你/.test(compact);
}

function collectOrdinaryRecentSurfaceMoves(
  messages: string[],
  repeatedPressureAxis?: OrdinaryRepeatedPressureAxis,
): string[] {
  const patterns: Array<[RegExp, string]> = [
    [/卡(?:一句|我|的是|住|点|这|号)?|最卡|有点卡/, "卡/卡一句"],
    [/这句话本身|这句话其实|这段我先|先留一处疑问|留疑问/, "这句话本身/留疑问"],
    [/我先接(?:上一位|前面|一下)?|我接(?:上一位|前面|一下)|这个判断我(?:先)?听到|我(?:听到了|听进去了)/, "接上一位/我听到了"],
    [/观察位|放进观察|挂观察/, "观察位"],
    [/接这条线|后面的人怎么接|接线/, "接线"],
    [/身份线|压力源|发言链|闭合|闭环/, "内部审计词"],
    [/看后置|后置位|后面怎么|布置作业|划线|触线/, "后置作业/划线"],
  ];
  const found: string[] = [];
  for (const message of messages.slice(-6)) {
    for (const [pattern, label] of patterns) {
      if (pattern.test(message)) found.push(label);
    }
  }
  const repeatedQuote = collectRepeatedQuotedSpeechFragments(messages.slice(-6))[0];
  if (repeatedQuote) found.push(`整句引用重复: ${clipBriefingText(repeatedQuote, 18)}`);
  if (repeatedPressureAxis) found.push(`同轴压力重复: ${repeatedPressureAxis.target.seatId}号`);
  return uniqueStrings(found).slice(0, 5);
}

function buildTableBriefing(
  view: AgentView,
  plan: SpeechPlan,
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
  advancedReasoning: string[],
  reasoningFrame: AiReasoningFrame,
  rolePlaybook: AiRolePlaybook,
  claimAudit: AiClaimAudit,
  debateAgenda: AiDebateAgenda,
): LlmSpeechInput["tableBriefing"] {
  const self = toTargetFromSeatId(view, view.mySeatId);
  const speechProgress = {
    currentSpeaker: self,
    spokenSeatIds: speechOrder.speakersAlreadyFinished.map((seat) => seat.seatId),
    unspokenSeatIds: speechOrder.currentDayUnspokenSeats.map((seat) => seat.seatId),
    spokenCount: speechOrder.speakersAlreadyFinished.length,
    aliveCount: view.aliveSeats.length,
  };
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);
  const deathShape = getCurrentDayDeathShape(view);
  const publicBoundary = [
    "公开信息只包括：已经公开的发言、死亡播报、身份声明、公开查验声明和已公开票型。",
    "本轮已发言玩家可以被评价，但只能回看其已发表内容，不能说等他后面再补；本轮未发言玩家只能被要求稍后表态，不能提前放好、打狼坑、列票口或标成更信/更疑。",
    "真预言家报查杀后，查杀位的个人解释不能把今天焦点推走；反对这条查杀的人必须公开对撞预言家结果，不能把预言家的查杀说成中立观察。",
    deathShape === "peaceful"
      ? "平安夜里的“女巫用药了”只是公开规则推理，不等于发言者自称女巫；只有明确说“我是女巫”、公开救毒目标或拍女巫身份，才算女巫声明。"
      : deathShape === "death"
        ? "有夜死只把死亡名单当背景；普通玩家不要展开药线、刀口或毒口规则课。只有明确说“我是女巫”、公开救毒目标或拍女巫身份，才算女巫声明。"
        : "目前没有公开死讯；不要主动编造平安夜、女巫用药、刀口、毒口或自刀。只有明确说“我是女巫”、公开救毒目标或拍女巫身份，才算女巫声明。",
    ...buildClaimAttributionBoundaryLines(view),
    "空刀不作为平安夜发言主线；天亮死讯只直接公开倒牌结果。普通玩家不要把狼刀、毒、自刀讲成规则课；除非是真女巫公开真实救毒信息。",
    buildDeathBoundaryLine(deathShape, deathShapeAlreadyDiscussed),
  ];
  const privateBoundary = buildPrivateBoundaryLines(view);
  const recentCurrentDaySpeeches = view.publicSummary.recentSpeeches
    .filter((speech) => speech.day === view.day && speech.speaker)
    .slice(-5);
  const publicFacts = [
    `当前发言席：${seatText(self)}，现在是第${view.day}天白天发言。`,
    `发言进度：已发言 ${speechProgress.spokenCount}/${speechProgress.aliveCount}，未发言 ${speechProgress.unspokenSeatIds.length}。`,
    `你发言前已经发言的人：${formatSeatList(speechOrder.speakersAlreadyFinished)}。`,
    `你之后还没发言的人：${formatSeatList(speechOrder.currentDayUnspokenSeats)}。`,
    buildDeathBriefingLine(view, deathShapeAlreadyDiscussed),
    buildSheriffBriefingLine(view),
    buildSheriffVoteBriefingLine(view),
    buildClaimBriefingLine(view),
    buildTodaySpeechOrderBriefingLine(speechOrder),
    buildFirstSpeakerBriefingLine(speechOrder),
    buildCurrentSpeechOrderPositionLine(speechOrder),
    buildFutureSeatMentionOrderLine(speechOrder),
    ...buildBlackCheckTimingFactLines(view),
    ...buildPostSpeechChallengeFactLines(view),
    buildSeerLegacyBriefingLine(view),
    ...recentCurrentDaySpeeches.map(
      (speech) => `${seatText(speech.speaker!)}刚才说：${clipBriefingText(speech.message, 90)}`,
    ),
  ].filter((line): line is string => typeof line === "string" && Boolean(line) && !line.endsWith("：无。"));

  const privateFacts = buildPrivateBriefingLines(view);
  const unknowns = [
    "你不能知道其他玩家真实身份，除非这是你自己的身份、狼队视角或真实预言家查验。",
    deathShape === "peaceful"
      ? "不要把“平安夜女巫用药了”理解成某个发言者公开跳女巫；这只是死亡形态推理。"
      : deathShape === "death"
        ? "有夜死时只把死亡名单当背景；普通玩家不要把药线、刀口或毒口讲成规则课，也不要伪装成自己看见了夜间私密结果。"
        : "目前没有公开死讯；不要主动解释成平安夜、女巫用药、毒口或刀口。",
    "没有公开预言家声明或公开查验前，不能说某人手里有验人线、查验线或验人链；这属于未公开身份线。",
    "公开死讯可以产生推测和压力，但普通玩家只一句带过死亡形态后要转到自己的当下处理：暂放、不压票、轻疑或投票条件；首置位低信息时可以直接说先听、暂放或不压票。非女巫不能编造女巫身份或具体救人目标；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态。",
    "尚未发言的后置位还没有给本轮态度，不能评价他们已经信息少、没回应或没站边；若要点人，只留一个具体问题，不能提前说更信、更疑、放好、狼坑、票口、焦点、先压或收票。",
    "已经发过言的前置位本轮不会再次发言，不能要求他们稍后补充、后面回应或轮到时再解释。",
    ...(view.privateKnowledge.sheriff ? [] : ["没有警上、警下、警徽、警长流程，不要使用这些概念。"]),
    ...buildClaimAttributionBoundaryLines(view),
  ];
  const legalSpeechFocus = [
    speechOrder.speakersAlreadyFinished.length > 0
      ? `可以评价已发言的${formatSeatList(speechOrder.speakersAlreadyFinished)}，但只能回看已经说出口的内容。`
      : "你是本日靠前发言位，只能先说自己的临时处理：信息少、暂放、不压票、先听；先不要给后置位安排要回答的问题。",
    speechOrder.currentDayUnspokenSeats.length > 0
      ? `${buildFutureSeatMentionOrderLine(
          speechOrder,
        )} 如果必须点一个后置位，只选和当前发言链最相关的位置，只留一个具体问题；不要把站边、票口、身份说法做成一圈通用作业，也不要提前给后置位可信度、狼面或票口标签。`
      : "本日已经没有后置位，可以开始收束今天的站边和票型。",
    deathShapeAlreadyDiscussed
      ? deathShape === "death"
        ? "有夜死已作为公开死亡形态处理，不要主动复读药线、刀口或毒口；把发言重心转到前置发言、身份说法或票口。"
        : "平安夜已作为公开死亡形态处理，不要主动复读；把发言重心转到前置发言、身份说法或票口。"
      : deathShape === "death"
        ? "有夜死先短句报名单；无守卫女巫局首夜单死只按狼刀成功、女巫没救一句带过，立刻接自己的游戏动作。"
        : deathShape === "peaceful"
          ? "平安夜只作背景，按女巫用了救药一句带过后接自己的当下处理；首置位只说信息少、暂放、不压票或先听，说完可以停。"
          : "目前没有公开死讯，不要主动讲平安夜、药线、刀口或毒口；先说自己的临时处理。",
    isLowInfoDayOneNoHardInfo(view)
      ? "低信息首轮不要因为任何前置位没站边或没给票口去硬打；首置位允许直接划水式暂放，后置位再评价已出现发言；首置位只落自己的暂放或先听边界。"
      : undefined,
    plan.target
      ? `本轮可以围绕${seatText(plan.target)}展开判断，但不要把这个目标当成系统要求的固定模板。`
      : "本轮可以自由选择公开身份说法、死讯、前置发言或票型作为切入点。",
  ].filter((line): line is string => Boolean(line));

  const publicReasoningCues = view.publicSummary.tableMemory.reasoningCues
    .filter((cue) => !(deathShapeAlreadyDiscussed && cue.kind === "death_shape"))
    .slice(0, 6)
    .map(formatPublicReasoningCueForSpeechBriefing);

  return {
    text: [
      "【发言前牌桌事实简报】",
      ...publicBoundary.map((line) => `规则限制：${line}`),
      ...privateBoundary.map((line) => `私有边界：${line}`),
      ...publicFacts,
      ...publicReasoningCues.map((line) => `公开推理线索：${line}`),
      ...advancedReasoning.map((line) => `当前推理清单：${line}`),
      ...reasoningFrame.hardEvidence.map((line) => `推理框架-硬证据：${line}`),
      ...reasoningFrame.softSignals.map((line) => `推理框架-软信号：${line}`),
      ...reasoningFrame.counterHypotheses.map((line) => `推理框架-反面解释：${line}`),
      ...reasoningFrame.validationQuestions.map((line) => `推理框架-验证问题：${line}`),
      ...reasoningFrame.persuasionGoals.map((line) => `推理框架-说服目标：${line}`),
      `角色玩法：${rolePlaybook.roleLabel}，${rolePlaybook.tableIdentity}`,
      ...rolePlaybook.tacticalVariants.map((line) => `角色玩法-变体：${line}`),
      ...rolePlaybook.reasoningPriorities.map((line) => `角色玩法-推理重点：${line}`),
      ...rolePlaybook.actionForks.map((line) => `角色玩法-行动分歧：${line}`),
      ...rolePlaybook.speechAngles.map((line) => `角色玩法-发言角度：${line}`),
      ...rolePlaybook.avoid.map((line) => `角色玩法-避免：${line}`),
      ...claimAudit.contestedClaims.map((line) => `身份材料-对跳：${line}`),
      ...claimAudit.protectedClaims.map((line) => `身份材料-保护：${line}`),
      ...claimAudit.checkChains.map((line) => `身份材料-查验：${line}`),
      ...claimAudit.contradictions.map((line) => `身份材料-矛盾：${line}`),
      ...claimAudit.followupTests.map((line) => `身份材料-验证：${line}`),
      ...claimAudit.actionGuidance.map((line) => `身份材料-行动：${line}`),
      ...debateAgenda.crossExamination.map((line) => `本轮追问：${line}`),
      ...debateAgenda.voteCommitments.map((line) => `投票承诺：${line}`),
      ...debateAgenda.roleCoordination.map((line) => `角色配合：${line}`),
      ...debateAgenda.pressureLines.map((line) => `施压方向：${line}`),
      ...debateAgenda.avoidTraps.map((line) => `避免误区：${line}`),
      ...privateFacts.map((line) => `私有视角：${line}`),
      ...unknowns.map((line) => `不能越界：${line}`),
      ...legalSpeechFocus.map((line) => `可发言方向：${line}`),
      "发言要像真实玩家临场说话：给立场、理由、追问或票口；模型特点只是打法倾向，不要照抄本简报。",
    ].join("\n"),
    speechProgress,
    publicBoundary,
    privateBoundary,
    publicFacts,
    privateFacts,
    unknowns,
    legalSpeechFocus,
    publicReasoningCues,
  };
}

function formatPublicReasoningCueForSpeechBriefing(cue: PublicReasoningCue): string {
  if (cue.kind === "speech_influence" && cue.target) {
    const relation = /支持/.test(cue.summary) ? "支持链" : "压力链";
    const source = cue.actor ? `${seatText(cue.actor)}先开口` : "前置位先开口";
    const followups = cue.evidence.length > 0 ? `后面还有${cue.evidence.length}个公开跟进` : "后面有人跟进";
    return `${seatText(cue.target)}有${relation}：${source}，${followups}；只取方向，发言时换成自己的判断。`;
  }

  return `${cue.summary}${cue.evidence.length > 0 ? `；依据：${cue.evidence.slice(0, 2).join("、")}` : ""}`;
}

function buildBlackCheckTimingFactLines(view: AgentView): string[] {
  return getPriorSpeechBlackCheckTimelines(view).map(
    ({ claimant, target }) =>
      `查杀时序：${seatText(target)}的本日发言发生在${seatText(claimant)}报查杀之前；评价这段时正确表述是“${target.seatId}号查杀前的发言/原话”，${target.seatId}号原话不是对${claimant.seatId}号查杀声明的回应或质疑；若要讨论查杀后的表现，只能引用公开记录中查杀之后的新发言。`,
  );
}

function buildPostSpeechChallengeFactLines(view: AgentView): string[] {
  return getPostSpeechChallengeTimelines(view).map(({ target, challengers, theme }) => {
    const challengeLead = challengers.length >= 2 ? "后续多人" : `后续${formatSeatList(challengers)}`;
    return `追问时序：${challengeLead}追问${seatText(target)}的${theme}，但这些追问发生在${target.seatId}号本轮发言之后；${target.seatId}号本轮尚无再次发言机会。正确表述是“后置位持续追问/形成压力”，不是“${target.seatId}号没回/没回应”。`;
  });
}

export function validateRenderedSpeech(
  view: AgentView,
  plan: SpeechPlan,
  speech: string,
  strictness = readSpeechStrictness(),
): string[] {
  const errors: string[] = [];
  const normalized = normalizeDigits(speech);
  const validSeatIds = new Set(view.aliveSeats.map((seat) => seat.seatId));
  const publicClaim = extractRoleClaimFromSpeech({
    day: view.day,
    claimantSeatId: view.mySeatId,
    message: normalized,
    validSeatIds,
    roleCard: view.roleCard,
  });
  if (/[?？]{4,}/.test(normalized)) {
    errors.push("发言包含异常问号占位");
  }
  errors.push(...validatePlainSpeechFormatting(normalized));
  errors.push(...validateDeathCauseBoundaries(view, normalized));
  errors.push(...validateWitchClaimAttribution(view, normalized));
  errors.push(...validateWitchSaveClaimTiming(view, normalized));
  errors.push(...validateMisattributedSelfWitchIdentity(view, normalized));
  errors.push(...validateFabricatedPublicCheckAttribution(view, normalized));
  errors.push(...validateSpeechTimeline(view, plan, publicClaim, normalized));
  errors.push(...validateAlreadySpokenFutureAsk(view, normalized));
  errors.push(...validateOrdinaryFirstSeatFutureHomework(view, normalized));
  errors.push(...validateOrdinaryFirstSeatMetaAuditOpener(view, normalized));
  errors.push(...validateOrdinaryFirstSeatFutureAuditHook(view, normalized));
  errors.push(...validateFutureSeatMentionOrder(view, normalized));
  errors.push(...validateUnspokenSeatPrematureRead(view, plan, publicClaim, normalized));
  errors.push(...validateSeerBlackCheckFinality(view, plan, publicClaim, normalized));
  errors.push(...validateDayOneFirstCheckMotiveAttack(view, plan, publicClaim, normalized));
  errors.push(...validateDayOneUnearnedClaimantPressure(view, normalized));
  errors.push(...validateCheckResultSeerClaimMisread(view, normalized));
  errors.push(...validateGoldCheckProtectionMisread(view, normalized));
  errors.push(...validateDayOneBlackCheckAgendaShift(view, normalized));
  errors.push(...validateOrdinaryNonOpeningSelfPosition(view, normalized));
  errors.push(...validateOrdinaryCopiedLowInfoOpening(view, normalized));
  errors.push(...validateOrdinaryLowInfoFirstSeatWaterAttack(view, normalized));
  errors.push(...validateOrdinaryRepeatedPressureSourceQuestion(view, normalized));
  errors.push(...validateOrdinaryRepeatedSameAxisPileOn(view, normalized));
  errors.push(...validateOrdinaryObserverOrJargon(view, normalized));
  errors.push(...validateOrdinaryVisiblePlayerJargon(view, normalized));
  errors.push(...validateOrdinaryCourtroomRegister(view, normalized));
  errors.push(...validateOrdinaryCopiedPriorSurface(view, normalized));
  errors.push(...validateOrdinaryCardJargonSurface(view, normalized));
  errors.push(...validateOrdinaryRepeatedCardSurfaceLoop(view, normalized));
  errors.push(...validateOrdinaryEmptyMicroMove(view, normalized));
  errors.push(...validateOrdinaryHalfAcceptWithoutLanding(view, normalized));
  errors.push(...validateOrdinaryConfusedLaterChain(view, normalized));
  errors.push(...validateOrdinaryDuplicatedWordSlip(view, normalized));
  errors.push(...validateOrdinaryObservationSlotTemplate(view, normalized));
  errors.push(...validateOrdinaryRedundantBasisQuestion(view, normalized));
  errors.push(...validateOrdinaryFirstNightWolfKillIntent(view, normalized));
  errors.push(...validateOrdinaryDeathShapeRuleLecture(view, normalized));
  errors.push(...validateOrdinaryDeathCommonSenseMisframed(view, normalized));
  errors.push(...validateOrdinaryUnresolvedReadChange(view, normalized));
  errors.push(...validateClassTrialRepeatedBlackCheckAxis(view, normalized));
  errors.push(...validateClassTrialRepeatedCheckedSelfProofQuestion(view, normalized));
  errors.push(...validateClassTrialRepeatedBlackCheckFollowerTarget(view, normalized));
  errors.push(...validateClassTrialCopiedPriorQuestionShape(view, normalized));
  errors.push(...validateClassTrialDayTwoVoteQuestionChain(view, normalized));
  errors.push(...validateClassTrialMisreadHeldBackUnspokenPressure(view, normalized));
  errors.push(...validateDayOnePeacefulNightBlackCheckMainPoint(view, normalized));
  errors.push(...validateClassTrialPeacefulNightReportOnly(view, normalized));
  errors.push(...validateBlackCheckTargetPeacefulNightReuse(view, normalized));
  errors.push(...validateClassTrialLateBlackCheckInventoryRecap(view, normalized));
  errors.push(...validateRepeatedClassTrialCounterfactualBenefit(view, normalized));
  errors.push(...validateBlackCheckTargetResponse(view, normalized));
  errors.push(...validateBlackCheckReactionTimeline(view, normalized));
  errors.push(...validatePreClaimTargetInteractionTimeline(view, normalized));
  errors.push(...validatePostSpeechChallengeTimeline(view, normalized));
  errors.push(...validateClaimAttribution(view, normalized, publicClaim));
  errors.push(...validateUnevidencedCheckLine(view, publicClaim, normalized));
  errors.push(...validateOrdinaryRecapWithoutLanding(view, normalized));
  errors.push(...validateTruncatedSpeechEnding(view, normalized));
  errors.push(...validateCompleteQuestionFragments(normalized));
  if (
    publicClaim &&
    plan.claimIntent?.strength === "soft" &&
    !plan.playMotive?.allowIdentityClaim &&
    publicClaim.claimedRole === plan.claimIntent.claimedRole &&
    publicClaim.strength === "hard" &&
    !isAllowedTrueWitchTargetReveal(view, normalized)
  ) {
    errors.push("软身份边界不应硬拍身份");
  }
  if (strictness !== "loose") {
    errors.push(...validateSpeechContract(plan, normalized));
  }
  errors.push(...validateConciseTableSpeech(normalized, view, plan));
  if (strictness !== "strict") return errors;

  errors.push(...validatePublicSpeechRelevance(view, plan, normalized, strictness));

  if (publicClaim && strictness === "strict") {
    errors.push(...validatePublicClaimHardRules(view, publicClaim));
    for (const check of publicClaim.checks) {
      if (check.result === "GOOD" && pressuresReportedGoldWater(normalized, check.targetSeatId)) {
        errors.push("报金水后又把金水当成怀疑或压票对象");
      }
    }

    if (!plan.claimIntent) {
      errors.push("发言新增了计划外身份声明");
    } else if (publicClaim.claimedRole !== plan.claimIntent.claimedRole) {
      errors.push("身份声明和计划不一致");
    }

    if (publicClaim.checks.length > 0) {
      const plannedCheck = plan.claimIntent?.check;
      if (!plannedCheck) {
        errors.push("发言新增了计划外查验");
      } else if (
        publicClaim.checks.some(
          (check) => check.targetSeatId !== plannedCheck.targetSeatId || check.result !== plannedCheck.result,
        )
      ) {
        errors.push("查验目标或结果和计划不一致");
      }
    }
  }

  if (strictness === "strict" && plan.claimIntent?.claimedRole === "SEER") {
    if (!/预言家|报验|验人|查验/.test(normalized)) {
      errors.push("预言家声明没有说清身份线");
    }
    if (plan.claimIntent.check && !containsCheckCue(normalized, plan.claimIntent.check)) {
      errors.push("没有覆盖计划中的查验结果");
    }
  }

  if (strictness === "strict" && plan.claimIntent?.claimedRole === "WITCH" && !/女巫|药|毒|救/.test(normalized)) {
    errors.push("女巫软声明没有保留药品视角");
  }

  if (strictness === "strict" && plan.claimIntent?.claimedRole === "HUNTER" && !/猎人|枪|底牌不虚|拍身份/.test(normalized)) {
    errors.push("猎人软声明没有保留底牌视角");
  }

  if (strictness === "strict" && plan.claimIntent?.claimedRole === "KNIGHT" && !/骑士|决斗|底牌不虚|拍身份/.test(normalized)) {
    errors.push("骑士软声明没有保留底牌视角");
  }

  if (strictness === "strict" && isWolfRole(view.myRole, view.rules.wolfRoles) && mentionsWolfTeammateAsBlack(view, normalized)) {
    errors.push("狼人发言把狼队友伪造成查杀");
  }

  if (strictness === "strict" && plan.target && !containsTargetReference(normalized, plan.target) && !plan.claimIntent?.check) {
    errors.push("发言没有覆盖计划目标位");
  }

  if (strictness === "strict" && plan.kind === "rally" && !/票|归|压|出|集中/.test(normalized)) {
    errors.push("归票计划没有表达票型意图");
  }

  return errors;
}

function validateSpeechContract(plan: SpeechPlan, speech: string): string[] {
  const target = plan.target;
  const move = resolveContractMove(plan);
  if (!target) return [];

  switch (move) {
    case "review_spoken_target":
      return asksTargetForFutureResponse(speech, target.seatId)
        ? [`speechContract要求只回看${target.seatId}号已发表内容`]
        : [];
    case "ask_unspoken_target":
      return treatsTargetAsAlreadyAnswered(speech, target.seatId)
        ? [`speechContract要求只能等待${target.seatId}号后续发言`]
        : [];
    case "claim_black_check":
      return speechMentionsBlackCheck(speech, target.seatId)
        ? []
        : [`speechContract要求报出${target.seatId}号查杀`];
    case "claim_gold_check":
      return mentionsGoldCheck(speech, target.seatId)
        ? []
        : [`speechContract要求报出${target.seatId}号金水`];
    default:
      return [];
  }
}

function asksTargetForFutureResponse(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const futureCue = "(?:后置(?:位)?|后面|后续|稍后|等下|一会儿|接下来|轮到|等.{0,8}(?:发言|说|回应|补|报|跳|给))";
  const responseCue =
    "(?:补(?:结论|方向|过程|逻辑|站边|票口)?|回应|回(?:我|一个点|一下|应)|回答(?:我|一下|这个问题)?|答(?:我|一下)?|解释|说清|讲清|表态|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)|给(?:出)?(?:站边|票口|查验|验人|判断标准|信息)|发言|开口|报(?:完)?(?:查验链|验|查验|信息)|跳(?:身份|预言家))";
  return speech.split(/[。！？；]/).some((sentence) => {
    if (isMissingInfoReview(sentence, targetSeatId) && !hasExplicitFutureDemand(sentence, targetSeatId)) return false;
    if (isReviewingSpokenSeatFutureReference(sentence, targetSeatId)) return false;
    return (
      new RegExp(`${targetText}.{0,24}${futureCue}.{0,20}${responseCue}`).test(sentence) ||
      new RegExp(`${futureCue}.{0,24}${targetText}.{0,24}${responseCue}`).test(sentence)
    );
  });
}

function isMissingInfoReview(sentence: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  return (
    new RegExp(
      `${seatPattern}.{0,72}(?:没给具体哪一?点不闭环|没点明具体哪一条不闭环|没有独立判断依据|没给落脚点|没有落脚点)`,
    ).test(sentence) ||
    new RegExp(
      `${seatPattern}.{0,48}(?:没|没有|未|不).{0,8}(?:给(?:出)?|落|提|报|说|交代|点明).{0,16}(?:票口|站边|身份线|出人|方向|态度|信息|理由|落脚点|锚点|判断依据|独立判断|具体(?:哪一?点|哪一条).{0,4}闭环)`,
    ).test(sentence) ||
    new RegExp(`${seatPattern}.{0,24}(?:原话|刚才|这段|发言).{0,18}(?:没有|没|不).{0,8}(?:闭环|闭合|对上)`).test(sentence)
  );
}

function hasExplicitFutureDemand(sentence: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  const futureCue = "(?:后置(?:位)?|后面|后续|稍后|等下|一会儿|接下来|轮到|等.{0,8}(?:发言|说|回应|补|报|跳|给))";
  const demandCue =
    "(?:补(?:结论|方向|过程|逻辑|站边|票口)?|回(?:我|一个点|一下|应)|回应|回答(?:我|一下|这个问题)?|答(?:我|一下)?|解释|说清|讲清|表态|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)|开口|闭环|报(?:完)?(?:查验链|验|查验|信息)|跳(?:身份|预言家)|(?:再|要|得|必须|需要|该|先).{0,4}给(?:出)?(?:站边|票口|查验|验人|判断标准|信息))";
  return (
    new RegExp(`${seatPattern}.{0,30}${futureCue}.{0,30}${demandCue}`).test(sentence) ||
    new RegExp(`${futureCue}.{0,30}${seatPattern}.{0,30}${demandCue}`).test(sentence)
  );
}

function treatsTargetAsAlreadyAnswered(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}号`;
  return speech.split(/[。！？；]/).some((sentence) => {
    if (!sentence.includes(targetText)) return false;
    return (
      /(到现在|目前|现在|已经|一直|前面|刚刚).{0,16}(信息量|发言|站边|态度|死讯|回应|解释|判断)/.test(sentence) ||
      /(信息量|发言).{0,10}(太少|少|偏少|不足|太空|空|低)/.test(sentence) ||
      /(没有|没|未).{0,10}(明确站边|站边|态度|回应|解释|判断|对死讯|对昨夜|给信息)/.test(sentence) ||
      /只给结论|发言偏短|过程不够|回避站边/.test(sentence)
    );
  });
}

function mentionsGoldCheck(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}号`;
  return (
    new RegExp(`${targetText}.{0,10}(?:金水|好人)`).test(speech) ||
    new RegExp(`(?:查验|验了|验|摸了)\\s*${targetText}.{0,10}(?:金水|好人)`).test(speech)
  );
}

function pressuresReportedGoldWater(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}号`;
  return speech.split(/[。！？；]/).some((sentence) => {
    if (!sentence.includes(targetText)) return false;
    if (/(不作为|不进|不围绕|别|不要|先放|放一轮|硬踩金水|反打这张金水)/.test(sentence)) return false;
    return /(压过去|收票|归票|出人|投|打死|重点怀疑|怀疑焦点|信息量少|只给结论)/.test(sentence);
  });
}

function validatePublicClaimHardRules(
  view: AgentView,
  publicClaim: NonNullable<ReturnType<typeof extractRoleClaimFromSpeech>>,
): string[] {
  const errors: string[] = [];

  if (publicClaim.claimedRole === "WEREWOLF") {
    errors.push("公开发言不能自称狼人");
  }

  if (view.myRole === "SEER" && publicClaim.checks.length > 0) {
    for (const check of publicClaim.checks) {
      const actualCheck = view.privateKnowledge.seerChecks?.find((item) => item.targetSeatId === check.targetSeatId);
      if (!actualCheck) {
        errors.push("真实预言家不能编造未发生查验");
      } else if (actualCheck.result !== check.result) {
        errors.push("真实预言家不能改报已知查验结果");
      }
    }
  }

  return errors;
}

function validateUnevidencedCheckLine(
  view: AgentView,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
  speech: string,
): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  if (!/(?:验人线|查验线|验人链|查验链|手里[^。！？；]{0,12}(?:验人|查验))/.test(speech)) return [];
  const hasPublicSeerClaim = view.publicSummary.claimBoard.some((claim) => claim.claimedRole === "SEER");
  const currentSpeechClaimsSeer =
    publicClaim?.claimedRole === "SEER" || /(?:我(?:是|跳|拍|认)?预言家|我这里先把验人|我(?:查验|验了|报验))/.test(speech);
  return hasPublicSeerClaim || currentSpeechClaimsSeer ? [] : ["查验线缺少公开身份依据"];
}

function validateDeathCauseBoundaries(view: AgentView, speech: string): string[] {
  const errors: string[] = [];

  const impossibleNoKillClaim =
    /(?:狼人|狼队).{0,8}(?:不能|不允许|无法|没法).{0,8}(?:空刀|跳过击杀)|(?:规则|机制|系统).{0,8}(?:不能|不允许|无法|没法).{0,8}(?:空刀|跳过击杀)|(?:空刀|跳过击杀).{0,12}(?:规则不允许|机制不允许|系统不允许|绝对不可能)/.test(
      speech,
    );
  if (impossibleNoKillClaim) {
    errors.push("发言把狼人空刀说成规则不可能");
  }

  const overCertainNoKillClaim =
    /(?:确定|肯定|必然|一定|铁定|就是).{0,12}(?:狼人|狼队)?.{0,8}(?:空刀|跳过击杀)|(?:狼人|狼队).{0,8}(?:确定|肯定|必然|一定|铁定|就是).{0,8}(?:空刀|跳过击杀)/.test(
      speech,
    );
  if (overCertainNoKillClaim) {
    errors.push("发言把极低概率空刀说成确定事实");
  }

  if (hasForbiddenPotionTargetDetail(view, speech)) {
    errors.push("发言泄露或编造女巫用药细节");
  }

  if (hasForbiddenWitchStatusLeak(view, speech)) {
    errors.push("发言暗示私密女巫用药状态");
  }

  if (asksToRelitigatePeaceNight(speech)) {
    errors.push("平安夜不应被当成后置追问任务");
  }

  if (hallucinatesDeathOnPeacefulNight(view, speech)) {
    errors.push("平安夜不能凭空报夜死");
  }

  if (inventsDeathWithoutPublicDeath(view, speech)) {
    errors.push("没有公开死讯不能报夜死");
  }

  if (attacksPeacefulNightWitchUseAsMainPoint(view, speech)) {
    errors.push("平安夜女巫用药是公共死亡形态推理，不应作为主要攻击点");
  }

  if (view.roleCard?.theme === "class-trial" && /平安夜药线/.test(speech) && getPublicDeathShapeForSpeech(view) === "death") {
    errors.push("非平安夜不应复读平安夜药线");
  }

  return errors;
}

function hallucinatesDeathOnPeacefulNight(view: AgentView, speech: string): boolean {
  const publicDeathShape = getPublicDeathShapeForSpeech(view);
  const currentDayDeathShape = getCurrentDayDeathShape(view);
  if (publicDeathShape === "death" || currentDayDeathShape === "death") return false;
  if (publicDeathShape !== "peaceful" && currentDayDeathShape !== "peaceful") return false;
  const seatDeathClaim =
    /\d+\s*号[^。！？；]{0,10}(?:倒牌|死了|死亡|夜死|出局|吃刀|被刀|走了|走的|没了)/.test(speech) ||
    /(?:倒牌|死了|死亡|夜死|出局|吃刀|被刀|走了|走的|没了)[^。！？；]{0,10}\d+\s*号/.test(speech);
  const singleDeathCauseClaim = /(?:狼刀成功|女巫没救|单死|夜死)/.test(speech);
  const negatedNoDeath = /(?:没人|无人|没有人|没(?:有)?玩家)[^。！？；]{0,8}(?:倒牌|死亡|死了|出局)/.test(speech);
  return !negatedNoDeath && (seatDeathClaim || singleDeathCauseClaim);
}

function inventsDeathWithoutPublicDeath(view: AgentView, speech: string): boolean {
  if (getPublicDeathShapeForSpeech(view) === "death" || getCurrentDayDeathShape(view) === "death") return false;
  if (hallucinatesDeathOnPeacefulNight(view, speech)) return false;
  const seatDeathClaim =
    /\d+\s*号[^。！？；]{0,10}(?:倒牌|死了|死亡|夜死|出局|吃刀|被刀|走了|走的|没了)/.test(speech) ||
    /(?:倒牌|死了|死亡|夜死|出局|吃刀|被刀|走了|走的|没了)[^。！？；]{0,10}\d+\s*号/.test(speech);
  const singleDeathCauseClaim = /(?:狼刀成功|女巫没救|单死|夜死)/.test(speech);
  const negatedNoDeath = /(?:没人|无人|没有人|没(?:有)?玩家)[^。！？；]{0,8}(?:倒牌|死亡|死了|出局)/.test(speech);
  return !negatedNoDeath && (seatDeathClaim || singleDeathCauseClaim);
}

function getPublicDeathShapeForSpeech(view: AgentView): "death" | "peaceful" | "none" {
  const text = view.publicSummary.recentDeaths.join("\n");
  if (!text) return "none";
  if (/(?:倒牌|死亡|死了|夜死|被杀|出局)/.test(text)) return "death";
  if (/(?:平安夜|没人倒牌|无人死亡|没有人死亡)/.test(text)) return "peaceful";
  return "none";
}

function hasForbiddenWitchStatusLeak(view: AgentView, speech: string): boolean {
  const softHiddenStateLeak =
    view.myRole === "WITCH" &&
    (/(?:我|自己|这张牌|我这里)[^。！？；]{0,30}(?:手里|手上|藏着|攥着|留着)[^。！？；]{0,24}(?:信息|东西|牌|身份)[^。！？；]{0,36}(?:不(?:全|全部)?摊开|不展开|先不说|不说)/.test(
      speech,
    ) ||
      /(?:有些|有的|部分)[^。！？；]{0,12}(?:信息|东西|牌|身份)[^。！？；]{0,24}(?:留着|藏着)[^。！？；]{0,24}(?:对好人|有用)/.test(
        speech,
      ));
  const selfPotionLeak =
    /(?:我|本人|这张牌|我这里).{0,12}(?:救过人|救了人|有救人信息|有药线信息|用过解药|开过解药|用了解药|解药已经用|解药没了|手里没解药|毒过人|用过毒|开过毒)/.test(
      speech,
    ) ||
    /(?:救过人的信息|我救人的信息|我的救人信息|我的药线信息)/.test(speech) ||
    softHiddenStateLeak;
  if (!selfPotionLeak) return false;

  const hasExplicitTarget = /(?:救的是|救了|毒的是|毒了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/.test(speech);
  return !(view.myRole === "WITCH" && hasExplicitTarget);
}

function isAllowedTrueWitchTargetReveal(view: AgentView, speech: string): boolean {
  if (view.myRole !== "WITCH") return false;
  const hasExplicitTarget = /(?:救的是|救了|毒的是|毒了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/.test(
    speech,
  );
  return hasExplicitTarget && !hasForbiddenPotionTargetDetail(view, speech);
}

function isAllowedTrueWitchBoundaryChallenge(view: AgentView, speech: string): boolean {
  if (!isAllowedTrueWitchTargetReveal(view, speech)) return false;
  const keepsPeaceNightAsBackground =
    /(?:这句话[^。！？；]{0,8}(?:没问题|没有问题)|不是说(?:这|那)句话(?:有)?问题|平安夜[^。！？；]{0,16}(?:背景|公共)|我先不(?:因为|拿)[^。！？；]{0,24}(?:打死|定死|压死))/.test(
      speech,
    );
  if (!keepsPeaceNightAsBackground) return false;
  return /(?:替女巫(?:下结论|发言|说话)|凭什么替女巫|你自己[^。！？；]{0,16}(?:怎么处理|处理方式|没表态)|自己对平安夜[^。！？；]{0,16}(?:怎么处理|处理方式))/.test(
    speech,
  );
}

function asksToRelitigatePeaceNight(speech: string): boolean {
  if (!/(平安夜|空刀|药线)/.test(speech)) return false;
  if (/(?:别|不要|不用|不必|无需).{0,20}(?:后置|大家|别人|重复|再).{0,20}(?:聊|谈|解释|讨论|回应|盘)/.test(speech)) {
    return false;
  }
  return (
    /(?:后置|等.{0,8}(?:发言|说|补|回应)|轮到|你们|大家).{0,30}(?:平安夜|空刀|药线).{0,20}(?:怎么看|怎么理解|谈|聊|说|补|回应|解释)/.test(
      speech,
    ) ||
    /(?:平安夜|空刀|药线).{0,20}(?:怎么看|怎么理解|谈谈|聊聊|说说|补一下|回应一下)/.test(speech) ||
    /(?:女巫用药|空刀).{0,6}(?:还是|或者|或).{0,6}(?:女巫用药|空刀)/.test(speech)
  );
}

function attacksPeacefulNightWitchUseAsMainPoint(view: AgentView, speech: string): boolean {
  if (view.day !== 1 || view.rules.hasGuard) return false;
  const mentionsPeacefulNight =
    /(?:平安夜|女巫用药|女巫用了救药|用了救药|用药|救药|解药|药线)/.test(speech) ||
    attacksPriorPeaceNightCommonSenseFromContext(view, speech);
  if (!mentionsPeacefulNight) return false;
  const hasPeaceContext =
    getPublicDeathShapeForSpeech(view) === "peaceful" || getCurrentDayDeathShape(view) === "peaceful" || mentionsPeacefulNight;
  if (!hasPeaceContext) return false;
  if (isAllowedTrueWitchBoundaryChallenge(view, speech)) return false;
  if (
    /(?:只是|仅是|只当|当作|作为|算作|先放下|先放这里|背景|公共(?:规则|死亡形态|信息|推理)|不展开|不多展开|不替女巫(?:确认|公开|报|说话|发言))/.test(
      speech,
    )
  ) {
    return false;
  }
  const overCertainAttack =
    /(?:女巫用药|用药|解药|药线)[^。！？；]{0,30}(?:说(?:得)?太死|说成(?:定案|既定事实)|锁死|过度确定|太(?:笃定|绝对)|证据[^。！？；]{0,12}不在|不该[^。！？；]{0,10}确定)/.test(
      speech,
    ) ||
    /(?:说(?:得)?太死|说成(?:定案|既定事实)|锁死|过度确定|太(?:笃定|绝对)|证据[^。！？；]{0,12}不在|不该[^。！？；]{0,10}确定)[^。！？；]{0,30}(?:女巫用药|用药|解药|药线)/.test(
      speech,
    ) ||
    /(?:女巫用药|女巫用了救药|用了救药|用药|救药|解药)[^。！？；]{0,36}(?:说得太顺|说太顺|太顺|直接定性|直接断定|定成|当成事实)/.test(
      speech,
    ) ||
    /(?:说得太顺|说太顺|太顺|怎么敢[^。！？；]{0,12}(?:直接)?(?:定性|断定)|(?:直接)?(?:定性|断定|定成|当成事实))[^。！？；]{0,48}(?:平安夜|女巫用药|女巫用了救药|用了救药|用药|救药|解药)/.test(
      speech,
    );
  const pressureCue = /(?:疑点|压|打|切|卡|怀疑|可疑|定调|放不下|不能放过|先记|先挂)/.test(speech);
  const framesPublicWitchUseAsProbe =
    /(?:你|他|她|\d+\s*号)[^。！？；]{0,36}(?:先提|提了|说了|先说)[^。！？；]{0,24}(?:女巫用药|用药|解药|药线)[^。！？；]{0,40}(?:试探|钓|逼|引|等|看)[^。！？；]{0,18}女巫/.test(
      speech,
    ) ||
    /(?:女巫用药|用药|解药|药线)[^。！？；]{0,48}(?:这个说法本身|说法本身|往平安夜上靠|女巫会不会跳|试探一下女巫|试探女巫)/.test(
      speech,
    ) ||
    /(?:试探|钓|逼|引)[^。！？；]{0,18}女巫[^。！？；]{0,48}(?:平安夜|女巫用药|用药|解药|药线)/.test(
      speech,
    );
  const framesPublicWitchUseAsPrivateInfo =
    /(?:你|他|她|\d+\s*号)[^。！？；]{0,42}(?:说|提|讲)[^。！？；]{0,42}(?:平安夜|女巫用药|女巫用了救药|用了救药|救药|解药)[^。！？；]{0,80}(?:依据|信息来源|别的信息|别的视角|怎么知道|怎么确定|凭什么|纯推理|这句话[^。！？；]{0,16}不好用|观察点[^。！？；]{0,16}不好用)/.test(
      speech,
    ) ||
    /(?:平安夜|女巫用药|女巫用了救药|用了救药|救药|解药)[^。！？；]{0,60}(?:依据|信息来源|别的信息|别的视角|怎么知道|怎么确定|凭什么|纯推理)[^。！？；]{0,48}(?:不好用|不成立|没法用|不太好用)/.test(
      speech,
    ) ||
    /(?:平安夜|女巫用药|女巫用了救药|用了救药|救药|解药)[\s\S]{0,120}(?:这句话的?边界(?:在)?哪(?:里|儿)?|边界(?:在)?哪(?:里|儿)?|信息来源|别的信息来源|别的视角)/.test(
      speech,
    );
  const framesPublicWitchUseAsHiddenView =
    /(?:不是女巫|闭眼(?:平民|好人|视角)?|替女巫(?:发言|说话)|像替女巫(?:发言|说话))[^。！？；]{0,80}(?:凭什么|怎么确定|怎么知道|泄视角|有点怪|奇怪|怪)/.test(
      speech,
    ) ||
    /(?:女巫用药|女巫用了救药|用了救药|救药|解药)[^。！？；]{0,52}(?:有点怪|奇怪|怪|不该|凭什么|怎么确定|怎么知道|泄视角|替女巫)/.test(
      speech,
    ) ||
    /(?:凭什么|怎么确定|怎么知道)[^。！？；]{0,44}(?:女巫用药|女巫用了救药|用了救药|救药|解药)/.test(
      speech,
    ) ||
    /(?:回头再看|再看|回看)[\s\S]{0,80}(?:女巫用药|女巫用了救药|用了救药|救药|解药)[\s\S]{0,40}(?:有点怪|奇怪|怪)/.test(
      speech,
    );
  const marksRecheckedPublicWitchUseAsWeird =
    /(?:回头再看|再看|回看)/.test(speech) &&
    /(?:女巫用药|女巫用了救药|用了救药|救药|解药)/.test(speech) &&
    /(?:有点怪|奇怪|怪)/.test(speech);
  return (
    (overCertainAttack && pressureCue) ||
    framesPublicWitchUseAsProbe ||
    framesPublicWitchUseAsPrivateInfo ||
    framesPublicWitchUseAsHiddenView ||
    marksRecheckedPublicWitchUseAsWeird
  );
}

function attacksPriorPeaceNightCommonSenseFromContext(view: AgentView, speech: string): boolean {
  if (/(?:不替女巫(?:确认|公开|报|说话|发言)|只是|仅是|背景|公开(?:死亡形态|信息|推理)|公共(?:死亡形态|信息|推理))/.test(speech)) {
    return false;
  }
  if (!/(?:替女巫(?:说话|发言)|凭什么|怎么确定|怎么知道|不是女巫|闭眼(?:平民|好人|视角)?)/.test(speech)) {
    return false;
  }
  return currentDaySpeechItems(view).some((prior) => {
    if (!prior.speaker || prior.speaker.seatId === view.mySeatId) return false;
    if (!mentionsSeatReference(speech, prior.speaker)) return false;
    return /(?:平安夜|女巫用药|女巫用了救药|用了救药|用药|救药|解药)/.test(prior.message);
  });
}

function hasForbiddenPotionTargetDetail(view: AgentView, speech: string): boolean {
  const publiclyClaimed = collectPubliclyClaimedPotionTargets(view);
  const publicDeathTargets = collectCurrentDayPublicDeathSeatIds(view);
  const saveTargets = [
    ...collectPotionTargetIds(speech, /女巫.{0,24}(?:救的是|救的|救了|救过|救中的是)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectPotionTargetIds(
      speech,
      /(?:我|昨晚|昨夜|夜里|第一夜|首夜|第一晚|首晚).{0,10}(?:救的是|救的|救了|救过)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g,
    ),
    ...collectPotionTargetIds(speech, /([0-9]+|[一二三四五六七八九十两]+)\s*号.{0,8}(?:被女巫救|吃了解药|被救了)/g),
  ];
  const poisonTargets = [
    ...collectPotionTargetIds(speech, /女巫.{0,18}(?:毒的是|毒了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectPotionTargetIds(speech, /(?:我|昨晚|昨夜|夜里).{0,10}(?:毒的是|毒了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectPotionTargetIds(speech, /([0-9]+|[一二三四五六七八九十两]+)\s*号.{0,8}(?:被女巫毒|吃毒|被毒了)/g),
  ];
  const knifeTargets = collectPotionTargetIds(speech, /(?:刀口).{0,8}(?:在|是).{0,8}([0-9]+|[一二三四五六七八九十两]+)\s*号?/g);
  const poisonMouthTargets = collectPotionTargetIds(speech, /(?:毒口).{0,8}(?:在|是).{0,8}([0-9]+|[一二三四五六七八九十两]+)\s*号?/g);

  return (
    hasForbiddenKnownTarget(view, saveTargets, [view.privateKnowledge.witch?.savedTarget?.seatId, ...publiclyClaimed.saved]) ||
    hasForbiddenKnownTarget(view, poisonTargets, [
      view.privateKnowledge.witch?.poisonedTarget?.seatId,
      ...publiclyClaimed.poisoned,
      ...publicDeathTargets,
    ]) ||
    hasForbiddenKnownTarget(view, knifeTargets, [
      view.privateKnowledge.witch?.currentVictim?.seatId,
      view.privateKnowledge.witch?.savedTarget?.seatId,
      ...publicDeathTargets,
    ]) ||
    hasForbiddenKnownTarget(view, poisonMouthTargets, [view.privateKnowledge.witch?.poisonedTarget?.seatId, ...publicDeathTargets])
  );
}

function collectCurrentDayPublicDeathSeatIds(view: AgentView): number[] {
  const ids = new Set<number>();
  for (const event of view.publicEvents) {
    if (event.day !== view.day || event.type !== "DAY_STARTED") continue;
    const payloadSeatIds = event.payload.deadSeatIds;
    if (Array.isArray(payloadSeatIds)) {
      for (const seatId of payloadSeatIds) {
        if (typeof seatId === "number" && Number.isFinite(seatId)) ids.add(seatId);
      }
    }
    for (const match of String(event.message ?? "").matchAll(/(\d{1,2})\s*号/g)) {
      const seatId = Number(match[1]);
      if (Number.isFinite(seatId)) ids.add(seatId);
    }
  }
  return [...ids];
}

function hasForbiddenKnownTarget(view: AgentView, targetIds: number[], allowedTargetIds: Array<number | undefined>): boolean {
  const ids = [...new Set(targetIds.filter((seatId) => Number.isFinite(seatId)))];
  if (ids.length === 0) return false;
  const allowed = new Set(allowedTargetIds.filter((seatId): seatId is number => typeof seatId === "number"));
  if (ids.every((seatId) => allowed.has(seatId))) return false;
  if (view.myRole !== "WITCH") return true;
  return ids.some((seatId) => !allowed.has(seatId));
}

function validateWitchClaimAttribution(view: AgentView, speech: string): string[] {
  const claimedWitchSeatIds = new Set(
    view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === "WITCH").map((claim) => claim.claimant.seatId),
  );
  const aliveSeatIds = new Set(view.aliveSeats.map((seat) => seat.seatId));
  const selfClaimIndex = speech.indexOf("自称女巫");
  if (selfClaimIndex >= 0) {
    const priorSeatMentions = [...speech.slice(0, selfClaimIndex).matchAll(/(\d{1,2})\s*号/g)];
    const seatId = Number(priorSeatMentions.at(-1)?.[1]);
    if (Number.isFinite(seatId) && aliveSeatIds.has(seatId) && !claimedWitchSeatIds.has(seatId)) {
      return [`把${seatId}号的女巫用药表述错当女巫声明`];
    }
  }
  for (const sentence of speech.split(/[。！？；]/)) {
    if (deniesWitchClaimAttribution(sentence)) continue;
    for (const seatId of collectWitchClaimAttributedSeatIds(sentence)) {
      if (seatId === view.mySeatId) continue;
      if (!aliveSeatIds.has(seatId) || claimedWitchSeatIds.has(seatId)) continue;
      return [`把${seatId}号的女巫用药表述错当女巫声明`];
    }
  }
  return [];
}

function validateWitchSaveClaimTiming(view: AgentView, speech: string): string[] {
  if (view.myRole !== "WITCH" || view.day <= 1) return [];
  if (view.privateKnowledge.witch?.antidoteUsedTonight) return [];
  if (!/(?:我是|我拍|我这张|我作为)?[^。！？；\n]{0,8}女巫|我[^。！？；\n]{0,8}女巫/.test(speech)) return [];
  if (/(?:昨晚|昨夜|夜里)[^。！？；\n]{0,16}(?:救的是|救的|救了|救过)\s*(?:[0-9]+|[一二三四五六七八九十两]+)\s*号/.test(speech)) {
    return ["女巫旧救人信息不要说成昨晚救人"];
  }
  return [];
}

function validateMisattributedSelfWitchIdentity(view: AgentView, speech: string): string[] {
  if (view.myRole === "WITCH") return [];
  if (!/(?:你|他|她|TA|ta|刚才|前面|\d{1,2}\s*号)[^。！？；\n]{0,24}(?:说|讲|点|称|认)[^。！？；\n]{0,10}我(?:是)?女巫/.test(speech)) {
    return [];
  }
  if (!/我(?:先)?(?:认|接|接受)|(?:这个|这张)?身份我(?:先)?(?:认|接)|认下/.test(speech)) return [];
  return ["发言误认自己是女巫身份"];
}

type PublicCheckAttribution = {
  claimantSeatId: number;
  targetSeatId: number;
  result: "WEREWOLF" | "GOOD";
};

function validateFabricatedPublicCheckAttribution(view: AgentView, speech: string): string[] {
  const attributions = collectPublicCheckAttributions(speech, view.aliveSeats);
  if (attributions.length === 0) return [];
  const claimBoards = [...view.publicSummary.claimBoard, ...view.publicSummary.tableMemory.claimBoard];
  for (const attribution of attributions) {
    const hasPublicCheck = claimBoards.some(
      (claim) =>
        claim.claimant.seatId === attribution.claimantSeatId &&
        claim.claimedRole === "SEER" &&
        claim.checks.some(
          (check) => check.target.seatId === attribution.targetSeatId && check.result === attribution.result,
        ),
    );
    if (!hasPublicCheck && !hasRecentPublicCheckSpeech(view, attribution)) return ["凭空引用未公开查验结果"];
  }
  return [];
}

function hasRecentPublicCheckSpeech(view: AgentView, attribution: PublicCheckAttribution): boolean {
  return view.publicSummary.recentSpeeches.some((speech) => {
    if (speech.day !== view.day) return false;
    if (speech.speaker?.seatId !== attribution.claimantSeatId) return false;
    return speechTextContainsPublicCheck(speech.message, view.aliveSeats, attribution);
  });
}

function speechTextContainsPublicCheck(
  speech: string,
  seats: Array<{ seatId: number; name?: string }>,
  attribution: PublicCheckAttribution,
): boolean {
  const target = seats.find((seat) => seat.seatId === attribution.targetSeatId);
  const targetPattern = buildPublicCheckTargetPattern(attribution.targetSeatId, target?.name);
  const resultPattern = attribution.result === "WEREWOLF" ? "(?:查杀|狼人|狼)" : "(?:金水|好人)";
  return speech.split(/[。！？；]/).some((sentence) => {
    if (!/(?:预言家|验|查|报验|查验|查杀|金水)/.test(sentence)) return false;
    return (
      new RegExp(`(?:验|查|摸|报|给|甩|留)[^。！？；]{0,18}${targetPattern}[^。！？；]{0,24}${resultPattern}`).test(
        sentence,
      ) ||
      new RegExp(`${targetPattern}[^。！？；]{0,14}(?:是|为|结果是)?[^。！？；]{0,8}${resultPattern}`).test(sentence)
    );
  });
}

function buildPublicCheckTargetPattern(seatId: number, name: string | undefined): string {
  const parts = [`${seatId}\\s*号(?:[A-Za-z0-9_\\-\\u4e00-\\u9fa5]{0,24})?`];
  if (name?.trim()) {
    parts.push(escapeRegExp(name.trim()));
  }
  return `(?:${parts.join("|")})`;
}

function collectPublicCheckAttributions(speech: string, seats: Array<{ seatId: number; name?: string }>): PublicCheckAttribution[] {
  const attributions: PublicCheckAttribution[] = [];
  for (const sentence of speech.split(/[。！？；]/)) {
    if (deniesPublicCheckAttribution(sentence)) continue;
    const patterns = [
      {
        pattern:
          /(\d{1,2})\s*号[^。！？；]{0,48}(?:报(?:了|出)?|给(?:了|出)?|甩(?:了)?|打(?:出)?|留(?:了)?|查(?:了)?|验(?:了)?)[^。！？；]{0,28}(\d{1,2})\s*号[^。！？；]{0,12}(查杀|金水)/g,
        claimantGroup: 1,
        targetGroup: 2,
        resultGroup: 3,
      },
      {
        pattern:
          /(\d{1,2})\s*号[^。！？；]{0,48}(?:报(?:了|出)?|给(?:了|出)?|甩(?:了)?|打(?:出)?|留(?:了)?|查(?:了)?|验(?:了)?)[^。！？；]{0,18}?([A-Za-z][A-Za-z0-9_-]{1,24}|[\u4e00-\u9fa5]{1,12})[^。！？；]{0,4}(查杀|金水)/g,
        claimantGroup: 1,
        targetGroup: 2,
        resultGroup: 3,
      },
      {
        pattern:
          /(\d{1,2})\s*号[^。！？；]{0,12}(?:是|作为|接了|吃了)?[^。！？；]{0,12}(\d{1,2})\s*号[^。！？；]{0,24}(?:报|给|甩|打|留)(?:的)?[^。！？；]{0,8}(查杀|金水)/g,
        claimantGroup: 2,
        targetGroup: 1,
        resultGroup: 3,
      },
    ];
    for (const { pattern, claimantGroup, targetGroup, resultGroup } of patterns) {
      for (const match of sentence.matchAll(pattern)) {
        const claimantSeatId = Number(match[claimantGroup]);
        const targetSeatId = resolvePublicCheckSeatRef(match[targetGroup], seats);
        const result = match[resultGroup] === "查杀" ? "WEREWOLF" : "GOOD";
        if (!Number.isFinite(claimantSeatId) || targetSeatId === undefined) continue;
        if (claimantSeatId === targetSeatId) continue;
        attributions.push({ claimantSeatId, targetSeatId, result });
      }
    }
  }
  return attributions;
}

function resolvePublicCheckSeatRef(value: string | undefined, seats: Array<{ seatId: number; name?: string }>): number | undefined {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase();
  const exactNameMatch = seats.find((seat) => seat.name && seat.name.trim().toLowerCase() === clean);
  if (exactNameMatch) return exactNameMatch.seatId;
  const numeric = value.match(/(\d{1,2})/);
  if (numeric) {
    const parsed = Number(numeric[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function deniesPublicCheckAttribution(sentence: string): boolean {
  return /(?:没|没有|并没|并没有|从未|未|不|不能|别把|不要把|别说成|别说|不是)[^。！？；]{0,32}(?:报|给|甩|打|留|查|验)[^。！？；]{0,32}(?:查杀|金水)/.test(
    sentence,
  );
}

function deniesWitchClaimAttribution(sentence: string): boolean {
  return /(?:不等于|不是|并非|不能说).{0,24}(?:自称女巫|跳女巫|拍女巫|女巫声明|女巫身份|女巫牌)|(?:没有|没).{0,6}(?:自称女巫|跳女巫|拍女巫|女巫声明|女巫身份|女巫牌)|(?:自称女巫|跳女巫|拍女巫|女巫声明|女巫身份|女巫牌).{0,16}(?:不成立|没有这回事|没这回事|是假的)/.test(
    sentence,
  );
}

function collectWitchClaimAttributedSeatIds(sentence: string): number[] {
  const ids = new Set<number>();
  for (const match of sentence.matchAll(/(\d{1,2})\s*号/g)) {
    const seatId = Number(match[1]);
    const start = match.index ?? 0;
    const rawWindow = sentence.slice(start, start + 56);
    const nextSeat = /(\d{1,2})\s*号/g.exec(rawWindow.slice(match[0].length));
    const window = nextSeat ? rawWindow.slice(0, match[0].length + nextSeat.index) : rawWindow;
    if (isRecognizingWitchClaimWindow(window)) continue;
    if (
      window.includes("自称女巫") ||
      window.includes("自拍女巫") ||
      window.includes("跳女巫") ||
      window.includes("拍女巫") ||
      window.includes("女巫声明") ||
      window.includes("女巫身份") ||
      window.includes("女巫牌") ||
      window.includes("女巫自拍")
    ) {
      ids.add(seatId);
    }
  }
  return [...ids];
}

function isRecognizingWitchClaimWindow(text: string): boolean {
  return /(?:认|认可|先认|暂认|承认)[^。！？；]{0,12}(?:女巫身份|女巫声明|身份空间|身份边界)/.test(text);
}

function collectPubliclyClaimedPotionTargets(view: AgentView): { saved: number[]; poisoned: number[] } {
  const messages = view.publicEvents
    .filter((event) => event.type === "SPEECH_CREATED" || event.type === "LAST_WORDS_CREATED")
    .map((event) => String(event.payload?.message ?? event.message ?? ""));
  return {
    saved: [
      ...new Set(
        messages.flatMap((message) => [
          ...collectPotionTargetIds(
            message,
            /(?:女巫|我|昨晚|昨夜|夜里|第一夜|首夜|第一晚|首晚).{0,24}(?:救的是|救的|救了|救过|救中的是)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g,
          ),
          ...collectPotionTargetIds(message, /([0-9]+|[一二三四五六七八九十两]+)\s*号.{0,12}(?:被女巫救|吃了解药|被救了)/g),
        ]),
      ),
    ],
    poisoned: [
      ...new Set(
        messages.flatMap((message) => [
          ...collectPotionTargetIds(message, /(?:女巫|我|昨晚|昨夜|夜里).{0,24}(?:毒的是|毒了|毒过)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
          ...collectPotionTargetIds(message, /([0-9]+|[一二三四五六七八九十两]+)\s*号.{0,12}(?:被女巫毒|吃毒|被毒了)/g),
        ]),
      ),
    ],
  };
}

function collectPotionTargetIds(speech: string, pattern: RegExp): number[] {
  return [...speech.matchAll(pattern)]
    .map((match) => parseSeatNumber(match[1] ?? ""))
    .filter((seatId): seatId is number => typeof seatId === "number");
}

function buildPrivateSpeechContext(view: AgentView): LlmSpeechInput["privateContext"] {
  const context: LlmSpeechInput["privateContext"] = {
    role: view.myRole,
    aiMemory: sanitizeAiMemoryForSpeech(view.privateKnowledge.aiMemory),
  };

  if (view.myRole === "SEER" && view.privateKnowledge.seerChecks) {
    context.seerChecks = view.privateKnowledge.seerChecks.map((check) => ({
      day: check.day,
      target: toTargetFromSeatId(view, check.targetSeatId),
      result: check.result,
    }));
  }

  if (view.myRole === "WITCH" && view.privateKnowledge.witch) {
    context.witch = {
      antidoteAvailable: view.privateKnowledge.witch.antidoteAvailable,
      poisonAvailable: view.privateKnowledge.witch.poisonAvailable,
      currentVictim: view.privateKnowledge.witch.currentVictim,
      savedTarget: view.privateKnowledge.witch.savedTarget,
      poisonedTarget: view.privateKnowledge.witch.poisonedTarget,
      antidoteUsedTonight: view.privateKnowledge.witch.antidoteUsedTonight,
      poisonUsedTonight: view.privateKnowledge.witch.poisonUsedTonight,
    };
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
    if (assignment) {
      context.wolfSpeechAssignment = {
        taskLabel: assignment.taskLabel,
        target: assignment.target,
        supportSeat: assignment.supportSeat,
        publicInstruction: describeWolfAssignmentForSpeech(assignment.taskLabel),
        nightInstruction: "夜间计划不能直接说出口；公开发言只用桌面发言、身份声明和票型理由包装。",
      };
    }
  }

  return context;
}

function sanitizeAiMemoryForSpeech(memory: AgentView["privateKnowledge"]["aiMemory"]): AgentView["privateKnowledge"]["aiMemory"] {
  if (!memory) return undefined;
  const beliefs = memory.beliefs.filter((belief) => belief.reasons.length > 0);
  const hasReasonedSuspicion = beliefs.some((belief) => belief.seatId === memory.suspectedSeatId);
  const hasReasonedTrust = beliefs.some((belief) => belief.seatId === memory.trustedSeatId);
  const hasReasonedFocus = beliefs.some((belief) => belief.seatId === memory.focusSeatId);
  const lastSpeechStance = memory.lastSpeechStance;
  const lastVoteReason = memory.lastVoteReason;

  if (
    beliefs.length === 0 &&
    !memory.lastSpeechTargetSeatId &&
    !lastSpeechStance &&
    !memory.lastVoteTargetSeatId &&
    !lastVoteReason
  ) {
    return undefined;
  }

  return {
    ...memory,
    suspectedSeatId: hasReasonedSuspicion ? memory.suspectedSeatId : undefined,
    trustedSeatId: hasReasonedTrust ? memory.trustedSeatId : undefined,
    focusSeatId: hasReasonedFocus ? memory.focusSeatId : undefined,
    lastSpeechStance,
    lastVoteReason,
    beliefs,
  };
}

function describeWolfAssignmentForSpeech(taskLabel: string): string {
  switch (taskLabel) {
    case "悍跳预言家":
      return "围绕预言家身份线发言，和公开对跳关系保持一致。";
    case "冲锋归票":
      return "推动票型集中到目标位，理由必须来自公开发言。";
    case "切割倒钩":
      return "对身份焦点保留距离，制造公开视角上的怀疑。";
    default:
      return "保持闭眼好人口吻，只使用公开信息。";
  }
}

function sanitizeSpeechPlanForLlm(view: AgentView, plan: SpeechPlan): SpeechPlan {
  if (!isWolfRole(view.myRole, view.rules.wolfRoles)) return plan;
  return {
    ...plan,
    stance: sanitizePrivateStrategyText(plan.stance),
    interaction: plan.interaction
      ? {
          ...plan.interaction,
          line: sanitizePrivateStrategyText(plan.interaction.line),
          goal: sanitizePrivateStrategyText(plan.interaction.goal),
        }
      : undefined,
    personaCue: plan.personaCue
      ? {
          ...plan.personaCue,
          line: sanitizePrivateStrategyText(plan.personaCue.line),
          directives: plan.personaCue.directives.map(sanitizePrivateStrategyText),
        }
      : undefined,
    talkingPoints: plan.talkingPoints.map(sanitizePrivateStrategyText),
  };
}

function sanitizePrivateStrategyText(text: string): string {
  return text
    .replace(/先隐藏狼队视角，?围绕([^。！？；]+?)制造分歧/g, "围绕$1的公开发言找分歧")
    .replace(/先压低狼队视角/g, "公开口径先收住")
    .replace(/减少狼队视角暴露/g, "减少身份视角暴露")
    .replace(/制造分歧/g, "找公开分歧")
    .replace(/狼队冲锋位把票压向/g, "我想把票压向")
    .replace(/狼队倒钩位对/g, "我对")
    .replace(/狼队/g, "公开")
    .replace(/队友/g, "同边玩家")
    .replace(/WHITE_WOLF_KING|WOLF_BEAUTY|WEREWOLF|WOLF_KING|VILLAGER|SEER|WITCH|HUNTER|KNIGHT|GUARD/gi, "");
}

function validatePublicSpeechRelevance(
  view: AgentView,
  plan: SpeechPlan,
  speech: string,
  strictness: SpeechStrictness,
): string[] {
  const errors: string[] = [];
  if (containsOutOfGameSpeech(speech)) {
    errors.push("发言包含离局或模型说明");
  }

  if (strictness !== "strict") {
    return errors;
  }

  const mentionsAnySeat = view.aliveSeats.some((seat) => containsPublicSeatReference(speech, seat));
  const mentionsPlannedTarget = plan.target ? containsPublicSeatReference(speech, plan.target) : false;
  const hasPublicAnchor =
    mentionsAnySeat ||
    /上一位|前置|后置|发言|票型|投票|归票|死讯|刀口|查验|报验|金水|查杀|预言家|女巫|猎人|平民|闭眼|身份|站边|对跳|狼坑|好人|狼人|今天|昨夜|昨晚|这一轮/.test(
      speech,
    );
  const hasJudgment =
    /因为|理由|所以|如果|先|重点|压|放|不认|认下|站|怀疑|信|回避|解释|过程|对照|归票|看|听|验|盘|打|保留/.test(
      speech,
    );

  if (!hasPublicAnchor) {
    errors.push("发言缺少局内公开锚点");
  }

  if (!hasJudgment && speech.length < 48) {
    errors.push("发言缺少可执行判断");
  }

  if (plan.target && !mentionsPlannedTarget && !mentionsAnySeat && speech.length < 60) {
    errors.push("发言没有落到具体位置");
  }

  return errors;
}

function validateSpeechTimeline(
  view: AgentView,
  plan: SpeechPlan,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
  speech: string,
): string[] {
  const unspokenSeats = view.publicSummary.tableMemory.seats.filter(
    (seat) => seat.alive && seat.seatId !== view.mySeatId && seat.lastSpeechDay !== view.day,
  );
  for (const seat of unspokenSeats) {
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => mentionsSeatReference(sentence, seat));
    if (targetSentences.length === 0) continue;
    const hasPublicHardInfo = hasPublicHardInfoForSeat(view, plan, publicClaim, seat.seatId);

    const saysAlreadyLowInfo = targetSentences.some((sentence) => {
      if (isFutureListeningTask(sentence, seat.seatId)) return false;
      if (hasPublicHardInfo && isHardInfoResponseTaskForUnspokenSeat(sentence, seat.seatId)) return false;
      if (isExplicitHistoricalSpeechReview(sentence)) return false;
      return (
        /(到现在|目前|现在|本轮|今天|已经|一直|刚刚).{0,16}(信息量|发言|站边|态度|死讯|回应|解释|判断)/.test(sentence) ||
        /(到现在|目前|现在|本轮|今天|已经|一直|刚刚).{0,16}(?:一个字没说|没说|没有说|没开口|没有开口|没接|没有接)/.test(
          sentence,
        ) ||
        /(信息量|发言).{0,10}(太少|少|偏少|不足|太空|空|低)/.test(sentence) ||
        /(没有|没|未).{0,10}(明确站边|站边|态度|回应|解释|判断|对死讯|对昨夜|给信息)/.test(sentence) ||
        /(?:查杀|反打|攻击|踩|打|压|归票|带票).{0,18}(?:之后|以后|完|了)/.test(sentence) ||
        /拿.{0,10}(?:短发言|发言短|发言).{0,14}(?:做文章|攻击|打|踩)/.test(sentence) ||
        /只给结论|发言偏短|过程不够|回避站边/.test(sentence)
      );
    });

    const framesAsFuture = /(后置|后面|等.{0,6}发言|轮到|如果.{0,18}(发言|后面|后置)|稍后|一会儿|待会儿?)/.test(speech);
    if (saysAlreadyLowInfo && !framesAsFuture) {
      return [`把本轮未发言的${seat.seatId}号当成已发言评价`];
    }
  }

  return [];
}

function isHardInfoResponseTaskForUnspokenSeat(sentence: string, seatId: number): boolean {
  if (!sentence.includes(`${seatId}号`)) return false;
  const seatPattern = `${seatId}\\s*号`;
  const hardInfoCue = "(?:查杀|查验结果|查验|验出|结果)";
  const responseCue = "(?:怎么接|正面接|正面回应|回应|接这个信息|接这个结果|接这条|认不认|反驳|表态)";
  return (
    new RegExp(`${seatPattern}[^。！？；]{0,24}${hardInfoCue}[^。！？；]{0,24}${responseCue}`).test(sentence) ||
    new RegExp(`${hardInfoCue}[^。！？；]{0,24}${seatPattern}[^。！？；]{0,24}${responseCue}`).test(sentence) ||
    new RegExp(`${seatPattern}[^。！？；]{0,16}(?:必须|要|需要|得)[^。！？；]{0,12}${responseCue}`).test(sentence)
  );
}

function isFutureListeningTask(sentence: string, seatId: number): boolean {
  if (!sentence.includes(`${seatId}号`)) return false;
  const seatText = `${seatId}\\s*号`;
  if (new RegExp(`(?:重点听|主要听|先听|想听|要听).{0,8}${seatText}.{0,24}(?:位置|态度|站边|票口|看法|视角)`).test(sentence)) {
    return true;
  }
  if (new RegExp(`${seatText}.{0,24}(?:第一个|主要|重点).{0,16}(?:确认|听).{0,8}(?:态度|站边|票口|看法|视角)`).test(sentence)) {
    return true;
  }
  if (/(重点听|主要听|先听|想听|要听).{0,36}(位置|态度|站边|票口|看法|视角)/.test(sentence)) return true;
  return /(?:第一个|主要|重点).{0,16}(?:确认|听).{0,8}(?:态度|站边|票口|看法|视角)/.test(sentence);
}

function mentionsSeatReference(sentence: string, seat: { seatId: number; name: string }): boolean {
  if (sentence.includes(`${seat.seatId}号`)) return true;
  if (!seat.name || seat.name === "你" || !sentence.includes(seat.name)) return false;

  let index = sentence.indexOf(seat.name);
  while (index >= 0) {
    const prefix = sentence.slice(Math.max(0, index - 8), index);
    if (!/(?:\d+|[一二三四五六七八九十]+)\s*号\s*$/.test(prefix)) return true;
    index = sentence.indexOf(seat.name, index + seat.name.length);
  }
  return false;
}

function isExplicitHistoricalSpeechReview(sentence: string): boolean {
  return /(?:上一轮|上轮|上一天|前一天|昨天|昨轮|当时|D[0-9]+|第[一二三四五六七八九十0-9]+天|警上|上警|遗言|前面发言|之前发言|上一段发言|上一轮发言|历史发言)/i.test(
    sentence,
  );
}

function validateAlreadySpokenFutureAsk(view: AgentView, speech: string): string[] {
  const spokenSeats = currentDaySpokenSeats(view);
  for (const seat of spokenSeats) {
    if (seat.seatId === view.mySeatId) continue;
    const seatPattern = `(?:${seat.seatId}\\s*号|${escapeRegExp(seat.name)})`;
    const futureCue = "(?:后置(?:位)?|后面|后续|稍后|等下|一会儿|接下来|轮到|等.{0,8}(?:发言|说|回应|补|报|跳|给))";
    const responseCue =
      "(?:补(?:结论|方向|过程|逻辑|站边|票口)?|回(?:我|一个点|一下|应)|回应|回答(?:我|一下|这个问题)?|答(?:我|一下)?|解释|说清|讲清|表态|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)|给(?:出)?(?:站边|票口|方向|处理方向|公开处理方向|查验|验人|判断标准|信息)|发言|开口|闭环|报(?:完)?(?:查验链|验|查验|信息)|跳(?:身份|预言家))";
    const directCue =
      "(?:(?:要么|必须|需要|得|要|该|先|再|你)\\s*(?:补(?:结论|方向|过程|逻辑|站边|票口)|说清|讲清|解释|回应|回答(?:我|一下|这个问题)?|答(?:我|一下)?|回(?:我|一个点|一下|应)|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)|给(?:出)?(?:站边|票口|方向|处理方向|公开处理方向|查验|验人|判断标准|信息)|闭环)|(?:补(?:结论|方向|过程|逻辑|站边|票口)|说清|讲清|解释(?:一下|清楚)|回应一下|回答(?:我|一下|这个问题)|答(?:我|一下)|回(?:我|一个点|一下|应)|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)))";
    if (asksSpokenSeatForMoreAcrossSentences(speech, seat.seatId, seatPattern)) return [`要求已发言的${seat.seatId}号后续补充发言`];
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => new RegExp(seatPattern).test(sentence));
    const asksAgain = targetSentences.some((sentence) => {
      if (isWaitingOnOtherSpeakers(sentence)) return false;
      if (isQuotingSpokenSeatResponseDemand(sentence, seatPattern)) return false;
      if (isRejectingRepeatedDemandForSpokenSeat(sentence, seatPattern)) return false;
      if (isDescribingPostSpeechNoResponseChance(sentence, seatPattern)) return false;
      if (isDescribingAnotherSpeakerDemand(sentence, seatPattern, responseCue)) return false;
      return asksSpokenSeatForMore(sentence, seat.seatId, seatPattern, futureCue, responseCue, directCue);
    });
    if (asksAgain) {
      return [`要求已发言的${seat.seatId}号后续补充发言`];
    }
  }
  return [];
}

function validateFutureSeatMentionOrder(view: AgentView, speech: string): string[] {
  const speechOrder = buildSpeechOrderContext(view);
  const unspokenSeats = speechOrder.currentDayUnspokenSeats.filter((seat) => seat.seatId !== view.mySeatId);
  if (unspokenSeats.length < 3) return [];

  const indexBySeatId = new Map(unspokenSeats.map((seat, index) => [seat.seatId, index]));
  for (const sentence of speech.split(/[。！？；]/)) {
    if (!isFutureSeatGroupSentence(sentence)) continue;
    const mentioned = unspokenSeats
      .map((seat) => ({
        seat,
        orderIndex: indexBySeatId.get(seat.seatId) ?? -1,
        mentionIndex: firstSeatReferenceIndex(sentence, seat),
      }))
      .filter((item) => item.mentionIndex >= 0)
      .sort((a, b) => a.mentionIndex - b.mentionIndex);
    const uniqueOrder = [...new Map(mentioned.map((item) => [item.seat.seatId, item.orderIndex])).values()];
    if (uniqueOrder.length === 1 && uniqueOrder[0]! > 0 && isOrdinaryLowInfoDirectFutureSeatTask(view, sentence)) {
      return ["普通局低信息不要跳过下一位直接布置后置任务"];
    }
    if (uniqueOrder.length < 2) continue;

    const sortedOrder = [...uniqueOrder].sort((a, b) => a - b);
    const skipsMiddleSeat = sortedOrder.some((orderIndex, index) => index > 0 && orderIndex !== sortedOrder[index - 1]! + 1);
    const reversesSpeechOrder = uniqueOrder.some((orderIndex, index) => index > 0 && orderIndex < uniqueOrder[index - 1]!);
    if (skipsMiddleSeat || reversesSpeechOrder) {
      if (isOrdinaryLowInfoDirectFutureSeatTask(view, sentence)) {
        return ["普通局低信息不要跳过下一位直接布置后置任务"];
      }
      return ["无理由跨过中间后置位点名"];
    }
  }

  return [];
}

function validateOrdinaryFirstSeatFutureHomework(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (view.day !== 1) return [];
  if (!isLowInfoDayOneNoHardInfo(view)) return [];
  if (currentDaySpeechItems(view).length > 0) return [];
  if (hasAnyPublicClaimOrCheck(view)) return [];
  const speechOrder = buildSpeechOrderContext(view);
  const unspokenSeats = speechOrder.currentDayUnspokenSeats.filter((seat) => seat.seatId !== view.mySeatId);
  const namedFutureHomework = speech.split(/[。！？；]/).some((sentence) => {
    if (!/(?:轮到|到你|你还没说话|你还没发言|还没开口|想听|要听|先听|重点听|想看|比较想看|怎么发言|解释|回答|说说|接这个点|接一下|怎么看|怎么想|你觉得|你的回答|你的看法|第一反应|告诉我|盯住|替我)/.test(sentence)) {
      return false;
    }
    if (/(?:不|别|不要|不能|不用|没必要).{0,12}(?:点名|问|听|要求|布置)/.test(sentence)) return false;
    return unspokenSeats.some((seat) => mentionsSeatReference(sentence, seat));
  });
  return namedFutureHomework ? ["普通局低信息首置位不要点名后置位布置任务"] : [];
}

function validateOrdinaryFirstSeatMetaAuditOpener(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (view.day !== 1) return [];
  if (!isLowInfoDayOneNoHardInfo(view)) return [];
  if (currentDaySpeechItems(view).length > 0) return [];
  if (hasAnyPublicClaimOrCheck(view)) return [];
  const firstSentence = speech.split(/[。！？；]/)[0]?.trim() ?? "";
  const metaAuditOpener =
    /^(?:我)?(?:先|现在)?(?:说|讲|聊)(?:一下|下)?(?:我)?会(?:卡|看|抓|审|盯)什么/.test(firstSentence) ||
    /^我先说我会(?:卡|看|抓|审|盯)/.test(firstSentence);
  return metaAuditOpener ? ["普通局首置位不要用审稿元话术开场"] : [];
}

function validateOrdinaryFirstSeatFutureAuditHook(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (view.day !== 1) return [];
  if (!isLowInfoDayOneNoHardInfo(view)) return [];
  if (currentDaySpeechItems(view).length > 0) return [];
  if (hasAnyPublicClaimOrCheck(view)) return [];
  if (getCurrentDayDeathShape(view) === "death") return [];
  if (/(?:我(?:跳|拍|是)|自认|明牌)(?:预言家|女巫|猎人)/.test(speech)) return [];

  const futureAuditHook = speech.split(/[。！？；]/).some((sentence) => {
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
  return futureAuditHook ? ["普通局首置位不要设置未来观察点"] : [];
}

function isOrdinaryLowInfoDirectFutureSeatTask(view: AgentView, sentence: string): boolean {
  if (view.roleCard?.theme === "class-trial") return false;
  if (view.day !== 1) return false;
  if (!/(?:轮到|到你|你还没说话|你还没发言|还没开口|想听|要听|先听|重点听|解释|回答|说说|接这个点|接一下|你的回答)/.test(sentence)) return false;
  if (hasAnyPublicClaimOrCheck(view)) return false;
  const currentDayText = currentDaySpeechItems(view)
    .map((speech) => speech.message)
    .join("\n");
  return (
    getCurrentDayDeathShape(view) !== "none" ||
    /(?:倒牌|死了|死亡|夜死|狼刀|女巫没救|吃刀|被刀|走了|走的)/.test(sentence) ||
    /(?:倒牌|死了|死亡|夜死|狼刀|女巫没救|吃刀|被刀|走了|走的)/.test(currentDayText)
  );
}

function hasAnyPublicClaimOrCheck(view: AgentView): boolean {
  return view.publicSummary.claimBoard.some((claim) => claim.claimedRole || claim.checks.length > 0);
}

function validateUnspokenSeatPrematureRead(
  view: AgentView,
  plan: SpeechPlan,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
  speech: string,
): string[] {
  const speechOrder = buildSpeechOrderContext(view);
  const unspokenSeats = speechOrder.currentDayUnspokenSeats.filter((seat) => seat.seatId !== view.mySeatId);
  for (const seat of unspokenSeats) {
    if (hasPublicHardInfoForSeat(view, plan, publicClaim, seat.seatId)) continue;
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => mentionsSeatReference(sentence, seat));
    if (targetSentences.some((sentence) => framesUnspokenSeatAsSolved(sentence, seat.seatId))) {
      return [`提前评价未发言的${seat.seatId}号站边或可信度`];
    }
  }
  return [];
}

function hasPublicHardInfoForSeat(
  view: AgentView,
  plan: SpeechPlan,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
  seatId: number,
): boolean {
  if (plan.claimIntent?.check?.targetSeatId === seatId) return true;
  if (publicClaim?.claimantSeatId === seatId) return true;
  if (publicClaim?.checks.some((check) => check.targetSeatId === seatId)) return true;
  return view.publicSummary.claimBoard.some(
    (claim) => claim.claimant.seatId === seatId || claim.checks.some((check) => check.target.seatId === seatId),
  );
}

function framesUnspokenSeatAsSolved(sentence: string, seatId: number): boolean {
  if (isExplicitHistoricalSpeechReview(sentence)) return false;
  if (isFutureInstructionForSeat(sentence, seatId)) return false;
  const seatPattern = `${seatId}\\s*号(?:[^。！？；，、]{0,10})?`;
  const trustOrPressureCue =
    "(?:更信|比较信|暂时信|暂时更信|我信|我更信|偏信|认下|保下|放好|好人|金水|可信|更可信|更像好人|更疑|比较疑|暂时疑|怀疑|可疑|狼面|狼坑|像狼|铁狼|狼人|焦点|票口|票压|先压|压票|归票|收票|出票|出人|出局|放逐|抗推|硬踩|投给|投出|记(?:你|他|她|这个位置)?一笔|(?:先记|记下|记着)(?:你|他|她|这个位置)?一笔|先盯|盯住)";
  if (new RegExp(`(?:不|别|不要|不能).{0,18}(?:提前|现在|直接)?(?:评价|判断|放好|打|压|归票|收票|更信|更疑).{0,24}${seatPattern}`).test(sentence)) {
    return false;
  }
  return (
    new RegExp(`${trustOrPressureCue}[^。！？；]{0,16}${seatPattern}`).test(sentence) ||
    new RegExp(`${seatPattern}[^。！？；]{0,24}${trustOrPressureCue}`).test(sentence)
  );
}

function isFutureInstructionForSeat(sentence: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  const futureCue = "(?:后置位|后置|后面|后续|稍后|一会儿|接下来|轮到|到你|等.{0,8}(?:发言|说|回应|补|给)|重点听|主要听|先听|想听|要听)";
  const responseCue = "(?:发言|开口|说说|说一下|说|回答|回应|接(?:一下|一个点|这个点|这条|这段|发言链)|位置|态度|站边|票口|看法|视角|对象)";
  return (
    new RegExp(`${futureCue}[^。！？；]{0,24}${seatPattern}`).test(sentence) ||
    new RegExp(`${seatPattern}[^。！？；]{0,32}${futureCue}`).test(sentence) ||
    new RegExp(`${seatPattern}[^。！？；]{0,32}${responseCue}`).test(sentence)
  );
}

function isFutureSeatGroupSentence(sentence: string): boolean {
  return /(?:后置|后面|后续|接下来|轮到|到你|你还没说话|你还没发言|还没开口|你的回答|稍后|一会儿|等|过完|过去|这一圈|一圈|这一段)/.test(sentence);
}

function firstSeatReferenceIndex(sentence: string, seat: ActionTarget): number {
  const numberMatch = new RegExp(`${seat.seatId}\\s*号`).exec(sentence);
  if (numberMatch) return numberMatch.index;
  if (!seat.name || seat.name === "你") return -1;

  let index = sentence.indexOf(seat.name);
  while (index >= 0) {
    const prefix = sentence.slice(Math.max(0, index - 8), index);
    if (!/(?:\d+|[一二三四五六七八九十]+)\s*号\s*$/.test(prefix)) return index;
    index = sentence.indexOf(seat.name, index + seat.name.length);
  }
  return -1;
}

function asksSpokenSeatForMore(
  sentence: string,
  seatId: number,
  seatPattern: string,
  futureCue: string,
  responseCue: string,
  directCue: string,
): boolean {
  const targetMatch = new RegExp(seatPattern).exec(sentence);
  if (!targetMatch) return false;
  const afterTarget = sentence.slice(targetMatch.index + targetMatch[0].length);
  const directListenForCompletion = new RegExp(
    `(?:想听|先听|要听|听听)[^。！？；]{0,16}${seatPattern}[^。！？；]{0,64}(?:补完|补清楚|说清|讲清|解释清楚|把[^。！？；]{0,24}(?:补完|补清楚))`,
  ).test(sentence);
  if (directListenForCompletion && !/(?:不|不用|不要|别|没必要)[^。！？；]{0,18}(?:想听|先听|要听|听听)/.test(sentence)) {
    return true;
  }
  if (isDiscussingCheckedAddresseeResponse(afterTarget)) return false;
  const directProcessDemand = matchDirectProcessDemand(afterTarget);
  if (
    directProcessDemand &&
    !isInsideQuotedFragment(afterTarget, directProcessDemand.index) &&
    !mentionsOtherSeat(afterTarget.slice(0, directProcessDemand.index), seatId)
  ) {
    return true;
  }
  if (isMissingInfoReview(sentence, seatId) && !hasExplicitFutureDemand(sentence, seatId)) return false;
  if (isReviewingSpokenSeatFutureReference(sentence, seatId)) return false;
  if (isSelfFutureReviewAfterSeatReference(afterTarget)) return false;
  if (isWaitingForExternalCounterclaim(afterTarget)) return false;
  if (new RegExp(`${futureCue}.{0,36}${seatPattern}.{0,36}${responseCue}`).test(sentence)) return true;
  const secondPersonDemand = /你(?:自己)?[^。！？；]{0,18}(?:至少|现在|这轮|今天|也)?[^。！？；]{0,6}(?:得|要|需要|该|必须)[^。！？；]{0,10}(?:说清|讲清|交代|给(?:出)?|回答|回我|解释|表态)/.exec(afterTarget);
  if (secondPersonDemand && !mentionsOtherSeat(afterTarget.slice(0, secondPersonDemand.index), seatId)) return true;
  const futureSecondPersonDemand = /(?:轮到|等到)[^。！？；]{0,8}你[^。！？；]{0,12}(?:只)?(?:说|讲|回答|回应|解释|交代)/.exec(afterTarget);
  if (futureSecondPersonDemand && !mentionsOtherSeat(afterTarget.slice(0, futureSecondPersonDemand.index), seatId)) return true;
  const delayedSecondPersonDemand = /(?:需要|要|得|必须|该)[^。！？；]{0,8}你[^。！？；]{0,12}(?:后面|后续|稍后|之后)[^。！？；]{0,8}(?:补|说|讲|交代|给|解释|回应)|你[^。！？；]{0,12}(?:后面|后续|稍后|之后)[^。！？；]{0,8}(?:补|说|讲|交代|给|解释|回应)/.exec(afterTarget);
  if (delayedSecondPersonDemand) return true;
  const bareSecondPersonFollowup =
    /你(?:自己)?[^。！？；]{0,42}(?:之后呢|然后呢|票口准备往哪放|准备往哪放|倾向压谁|票想怎么落|往哪走|判断落在哪)/.exec(
      afterTarget,
    );
  if (bareSecondPersonFollowup && !mentionsOtherSeat(afterTarget.slice(0, bareSecondPersonFollowup.index), seatId)) {
    return true;
  }
  const directQuestion = /(?:我直接问|直接问|问你|我想问)[^。！？；]{0,24}你(?:自己)?[^。！？；]{0,48}(?:打算|准备|怎么|为什么|凭什么|拿什么|是否|是不是|有没有)/.exec(afterTarget);
  if (directQuestion && !mentionsOtherSeat(afterTarget.slice(0, directQuestion.index), seatId)) return true;
  const futureMatch = new RegExp(`${futureCue}.{0,30}${responseCue}`).exec(afterTarget);
  if (futureMatch && !mentionsOtherSeat(afterTarget.slice(0, futureMatch.index), seatId)) return true;
  const directMatch = new RegExp(directCue).exec(afterTarget);
  if (directMatch && isHistoricalReasonDescription(afterTarget, directMatch.index)) return false;
  return Boolean(directMatch && !mentionsOtherSeat(afterTarget.slice(0, directMatch.index), seatId));
}

function isSelfFutureReviewAfterSeatReference(afterTarget: string): boolean {
  return /我[^。！？；]{0,8}(?:后面|后续|稍后|之后)[^。！？；]{0,8}(?:会|再)?[^。！？；]{0,4}(?:看|观察|验证|回看|对照|复核)/.test(
    afterTarget,
  );
}

function isWaitingForExternalCounterclaim(text: string): boolean {
  return (
    /(?:后面|后续|稍后|之后|等下|一会儿)[^。！？；]{0,20}(?:有没有|有无|有没有人|有人|谁|别人|其他人|外置位)[^。！？；]{0,24}(?:对跳|反跳|跳出来|拍身份|跳身份|报身份)/.test(
      text,
    ) || /(?:对跳|反跳)[^。！？；]{0,12}(?:再说|再看|再聊|再定)/.test(text)
  );
}

function isDescribingAnotherSpeakerDemand(sentence: string, seatPattern: string, responseCue: string): boolean {
  const demandBeforeTarget = new RegExp(
    `(?:你|他|她|前置位|上一位|刚才[^，,。！？；]{0,12}).{0,16}(?:想让|让|要求|逼|催|追问|质疑)[^，,。！？；]{0,12}${seatPattern}.{0,18}${responseCue}`,
  );
  if (demandBeforeTarget.test(sentence)) return true;
  const targetBeforeDemand = new RegExp(
    `(?:你|他|她|前置位|上一位|刚才[^，,。！？；]{0,12}).{0,24}${seatPattern}.{0,12}(?:解释|回应|说清|讲清|补)[^，,。！？；]{0,18}(?:这件事|时机|理由|逻辑|问题)`,
  );
  return targetBeforeDemand.test(sentence);
}

function isDescribingPostSpeechNoResponseChance(sentence: string, seatPattern: string): boolean {
  return new RegExp(
    `${seatPattern}[^。！？；]{0,36}(?:后置位|后置|后面|持续被追问|被追问)[^。！？；]{0,36}(?:还没机会回应|没机会回应|没有机会回应|尚无机会回应)`,
  ).test(sentence);
}

function isRejectingRepeatedDemandForSpokenSeat(sentence: string, seatPattern: string): boolean {
  return (
    new RegExp(`${seatPattern}[^。！？；]{0,24}已经[^。！？；]{0,12}(?:回应|接过|接了|说过|讲过)`).test(sentence) ||
    new RegExp(`${seatPattern}[^。！？；]{0,24}(?:不能|没法|无法|不会|不该)[^。！？；]{0,12}(?:再|后续|稍后)?[^。！？；]{0,8}(?:补牌|补话|补充|回应)`).test(sentence) ||
    new RegExp(
      `(?:不必|不用|不要|别再|重复|继续)[^。！？；]{0,18}(?:问|追问|逼|催|要求|丢给)[^。！？；]{0,24}(?:他|她|${seatPattern})[^。！？；]{0,18}(?:认不认|回应|接|解释|补)`,
    ).test(sentence) ||
    new RegExp(
      `(?:问|追问|逼|催|要求|丢给)[^。！？；]{0,24}(?:他|她|${seatPattern})[^。！？；]{0,18}(?:认不认|回应|接|解释|补)[^。！？；]{0,12}(?:没有价值|没价值|无价值|不用|不必)`,
    ).test(sentence)
  );
}

function isDiscussingCheckedAddresseeResponse(afterTarget: string): boolean {
  if (
    /(?:查杀|查验|验了|验出|报验|报了|亮了预言家身份来查杀)[^。！？；]{0,10}你[^。！？；]{0,80}(?:你(?:打算)?怎么接|你的回应|你被查杀|你第一天|你只|你连|你抓|你自己|我为什么不是狼|谁在带队)/.test(
      afterTarget,
    )
  ) {
    return true;
  }
  return /(?:报了?查杀|甩出查杀|给出查杀)[^。！？；]{0,60}查杀位自己[^。！？；]{0,24}(?:没|没有|未)[^。！？；]{0,12}(?:给出|落|接上|解释)/.test(
    afterTarget,
  );
}

function isHistoricalReasonDescription(text: string, demandIndex: number): boolean {
  const beforeDemand = text.slice(Math.max(0, demandIndex - 42), demandIndex);
  return /(?:理由是|理由就是|原因是|上一轮|上轮|昨天|之前|当时|原话|说的是|说过)[^。！？；]{0,36}$/.test(beforeDemand);
}

function asksSpokenSeatForMoreAcrossSentences(speech: string, seatId: number, seatPattern: string): boolean {
  const seatRegex = new RegExp(seatPattern, "g");
  for (const match of speech.matchAll(seatRegex)) {
    const afterTarget = speech.slice(match.index + match[0].length, match.index + match[0].length + 180);
    const sameSentence = afterTarget.split(/[。！？；]/)[0] ?? afterTarget;
    if (isRejectingRepeatedDemandForSpokenSeat(`${match[0]}${sameSentence}`, seatPattern)) continue;
    if (isQuotedResponseDemandAfterSeatReference(afterTarget)) continue;
    if (isWaitingForExternalCounterclaim(afterTarget)) continue;
    const directProcessDemand = matchDirectProcessDemand(afterTarget);
    if (
      directProcessDemand &&
      !isInsideQuotedFragment(afterTarget, directProcessDemand.index) &&
      !mentionsOtherSeat(afterTarget.slice(0, directProcessDemand.index), seatId)
    ) {
      return true;
    }
    const delayedSecondPersonDemand =
      /(?:需要|要|得|必须|该)[^。！？；]{0,8}你[^。！？；]{0,12}(?:后面|后续|稍后|之后)[^。！？；]{0,8}(?:补|说|讲|交代|给|解释|回应)|你[^。！？；]{0,12}(?:后面|后续|稍后|之后)[^。！？；]{0,8}(?:补|说|讲|交代|给|解释|回应)/.exec(
        afterTarget,
      );
    if (delayedSecondPersonDemand) return true;
  }
  return false;
}

function isInsideQuotedFragment(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const openDouble = before.lastIndexOf("“");
  const closeDouble = before.lastIndexOf("”");
  if (openDouble > closeDouble) return true;
  const openSingle = before.lastIndexOf("‘");
  const closeSingle = before.lastIndexOf("’");
  if (openSingle > closeSingle) return true;
  const quoteCount = (before.match(/"/g) ?? []).length;
  if (quoteCount % 2 === 1) return true;
  const apostropheCount = (before.match(/'/g) ?? []).length;
  return apostropheCount % 2 === 1;
}

function isQuotingSpokenSeatResponseDemand(sentence: string, seatPattern: string): boolean {
  return new RegExp(
    `${seatPattern}[^。！？；]{0,36}(?:是说了|说的是|刚才说|说过|也说了|都在说|原话是)[^。！？；]{0,48}(?:等你接|怎么接|正面接|接这条|接查杀|回应查杀)`,
  ).test(sentence);
}

function isQuotedResponseDemandAfterSeatReference(afterTarget: string): boolean {
  return /^[^。！？；]{0,36}(?:是说了|说的是|刚才说|说过|也说了|都在说|原话是)[^。！？；]{0,48}(?:等你接|怎么接|正面接|接这条|接查杀|回应查杀)/.test(
    afterTarget,
  );
}

function matchDirectProcessDemand(text: string): RegExpExecArray | null {
  return /你(?:自己)?[^。！？；]{0,18}(?:这一轮|这轮|今天|现在|至少)[^。！？；]{0,8}(?:给(?:出)?(?!的)|补(?:完|上)?|说清|讲清|交代)[^。！？；]{0,12}(?:过程|逻辑|理由|依据|时机|身份方向|身份声明|站边|票口|判断标准|信息)/.exec(
    text,
  );
}

function isReviewingSpokenSeatFutureReference(sentence: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  const reviewCue = "(?:刚才|原话|这段|说|提到|复述|引用|观点)";
  const futureReference = "(?:后置(?:位)?|后面|谁跳|谁给|跳预言家|报查验|给查验)";
  const asksSameSeatLater = `(?:等|要|让|需要|该|必须).{0,6}(?:他|${seatPattern}).{0,24}(?:后面|后续|稍后|报(?:完)?(?:查验链|验|查验|信息)|跳(?:身份|预言家)|给(?:出)?(?:查验|验人|判断标准|信息))`;
  return new RegExp(`${seatPattern}.{0,28}${reviewCue}.{0,60}${futureReference}`).test(sentence) && !new RegExp(asksSameSeatLater).test(sentence);
}

function mentionsOtherSeat(text: string, seatId: number): boolean {
  for (const match of text.matchAll(/([0-9]+)\s*号/g)) {
    if (Number(match[1]) !== seatId) return true;
  }
  return false;
}

function isWaitingOnOtherSpeakers(sentence: string): boolean {
  return /(?:等|看|听).{0,8}后置(?:位)?.{0,12}(?:更多人|别人|其他人|外置位|发言|发言顺序|站边|反水)/.test(sentence);
}

function validateSeerBlackCheckFinality(
  view: AgentView,
  plan: SpeechPlan,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
  speech: string,
): string[] {
  const ownPublicClaim = extractOwnRoleClaimFromUnquotedSpeech(view, speech);
  const plannedCheck = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check : undefined;
  const hasPlannedSeerClaim = Boolean(plannedCheck);
  if (view.myRole !== "SEER" && !hasPlannedSeerClaim && ownPublicClaim?.claimedRole !== "SEER") return [];

  const errors: string[] = [];
  if (hasPlannedSeerClaim) {
    if (!hasOwnSeerClaimSpeech(speech, ownPublicClaim)) {
      errors.push("计划预言家声明没有说清身份线");
    }
    if (plannedCheck && !containsCheckCue(speech, plannedCheck)) {
      errors.push("没有覆盖计划中的查验结果");
    }
  }

  const blackCheckTargetIds = new Set<number>();
  if (plannedCheck?.result === "WEREWOLF") {
    blackCheckTargetIds.add(plannedCheck.targetSeatId);
  }
  if (view.myRole === "SEER") {
    for (const check of view.privateKnowledge.seerChecks ?? []) {
      if (check.result === "WEREWOLF" && speechMentionsBlackCheck(speech, check.targetSeatId)) {
        blackCheckTargetIds.add(check.targetSeatId);
      }
    }
  }
  if (ownPublicClaim?.claimedRole === "SEER") {
    for (const check of ownPublicClaim.checks) {
      if (check.result === "WEREWOLF") blackCheckTargetIds.add(check.targetSeatId);
    }
  }

  const ownerText = view.myRole === "SEER" ? "真预言家" : "预言家声明";
  for (const targetSeatId of blackCheckTargetIds) {
    if (view.roleCard?.theme === "class-trial" && !speechMentionsExplicitBlackCheck(speech, targetSeatId)) {
      errors.push(`speechContract要求报出${targetSeatId}号查杀`);
    }
    if (offersBlackCheckReversalToTarget(speech, targetSeatId)) {
      errors.push(`${ownerText}查杀不能让查杀位靠自证改票`);
    }
    if (view.roleCard?.theme === "class-trial" && !hasSeerBlackCheckVoteBoundary(speech, targetSeatId)) {
      errors.push("预言家查杀缺少今天如何处理查杀位");
    }
    if (view.roleCard?.theme === "class-trial" && dilutesSeerBlackCheckWithObserverCondition(speech, targetSeatId)) {
      errors.push(`${ownerText}查杀不能说成中立观察条件`);
    }
    if (view.roleCard?.theme === "class-trial" && view.day === 1 && activelyExplainsFirstCheckMotive(speech, targetSeatId)) {
      errors.push("D1预言家不应主动展开首验理由");
    }
  }
  return uniqueContractLines(errors);
}

function extractOwnRoleClaimFromUnquotedSpeech(
  view: AgentView,
  speech: string,
): ReturnType<typeof extractRoleClaimFromSpeech> {
  const unquotedSpeech = stripQuotedSpeechFragments(speech);
  return extractRoleClaimFromSpeech({
    day: view.day,
    claimantSeatId: view.mySeatId,
    message: unquotedSpeech,
    validSeatIds: new Set(view.aliveSeats.map((seat) => seat.seatId)),
    roleCard: view.roleCard,
  });
}

function stripQuotedSpeechFragments(speech: string): string {
  return speech
    .replace(/“[^”]{0,240}”/g, "")
    .replace(/‘[^’]{0,240}’/g, "")
    .replace(/"[^"]{0,240}"/g, "")
    .replace(/'[^']{0,240}'/g, "");
}

function hasOwnSeerClaimSpeech(speech: string, publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>): boolean {
  if (publicClaim?.claimedRole === "SEER") return true;
  return (
    /我(?:才?是|才?跳|拍|这里(?:先)?跳|这边(?:先)?跳)[^。！？；]{0,12}预言家/.test(speech) ||
    /我[^。！？；]{0,12}(?:报验|验人|查验|昨晚验的是|昨夜验的是|夜里验的是|验出|验的是)/.test(speech) ||
    /(?:\d{1,2}\s*号|[一二三四五六七八九十两]+\s*号)[^。！？；]{0,24}(?:是|他是|她是|这张牌是|这个位置是)?我的(?:金水|查杀)/.test(
      speech,
    ) ||
    /(?:我摊一张牌|我亮身份|我明牌)[^。！？；]{0,10}预言家/.test(speech)
  );
}

function validateDayOneFirstCheckMotiveAttack(
  view: AgentView,
  plan: SpeechPlan,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
  speech: string,
): string[] {
  if (view.day !== 1) return [];
  if (!hasPublicSeerCheck(view)) return [];
  if (plan.claimIntent?.claimedRole === "SEER" || publicClaim?.claimedRole === "SEER") return [];
  if (
    /(?:不是核心|不是主要|不是主攻|只是补充|只作补充|先作为最强证词|不是.{0,8}(?:验人|首验|查验).{0,8}(?:理由|问题|主线)|看有没有对跳|看(?:查杀位|被查杀位|腐川|对方|她|他)如何回应|先听回应|先听对跳|先看回应)/.test(
      speech,
    )
  ) {
    return [];
  }
  if (/(?:接查杀|被查杀)[^。！？；]{0,48}(?:不报身份|没报身份|反问|自证|站哪边|接法|压力)/.test(speech)) {
    return [];
  }
  if (
    /(?:查杀声明|两个预言家对跳|查杀不是擂台|只给(?:了)?一个查杀声明|谁要保|对撞|上来就(?:压票|喊票)|喊票|接话顺序|这条线怎么成立|预设了会有人保|已经预设)/.test(
      speech,
    ) &&
    !/(?:首验|验人理由|查验理由|选人理由|为什么.{0,12}(?:验|查|摸|选)|凭什么.{0,12}(?:验|查|摸|选)|为什么是\d{1,2}\s*号)/.test(
      speech,
    )
  ) {
    return [];
  }
  if (/(?:不是在回避[^。！？；]{0,24}而是在质疑[“"']?为什么验我|她那句话[^。！？；]{0,40}说明她没在躲)/.test(speech)) {
    return [];
  }
  const firstCheckAttack =
    /(?:首验|第一晚.{0,8}(?:验|查|选择|摸)|第一天夜里.{0,12}(?:验|查|摸|选)|首夜.{0,8}(?:验|查|摸|选)|验人(?:的)?理由|验人[^。！？；]{0,8}理由|验人(?:的)?心路|验人(?:逻辑链|逻辑|顺序|安排)|查验(?:逻辑链|逻辑|心路|依据|理由)|验人选择(?:逻辑|依据|理由)?|验人怎么选|验人判断.{0,10}(?:公开)?依据|补验人依据|公开依据|选人(?:逻辑|依据|理由|心路)?|后续验人结构|明天验谁|为什么.{0,12}(?:验|查|摸|选)|凭什么.{0,12}(?:验|查|摸|选)|怎么.{0,8}(?:摸到|验到|查到|选到)|如何.{0,8}(?:摸到|验到|查到|选到)|偏偏.{0,8}(?:验|查|摸|选|是我)|只给(?:了)?(?:查杀结果|一句边界|结论)|只报(?:了)?结果[^。！？；]{0,24}(?:没|没有)[^。！？；]{0,8}(?:逻辑|视角逻辑)|连心路都省|心路都省|(?:没给|没有|没交代|没有交代)[^。！？；]{0,18}(?:心路|视角逻辑|验人逻辑|查验逻辑|验人顺序|验人安排|为什么.{0,8}验我)|(?:选|选择|验|查|摸)[^。！？；]{0,24}(?:查验|查杀|验人|验|查|摸)?[^。！？；]{0,16}(?:依据|理由|心路)|(?:验|查|摸)我[^。！？；]{0,18}(?:为什么|凭什么|偏偏)|为什么[^。！？；]{0,12}偏偏[^。！？；]{0,8}我|验(?:他|她|你|我|这个位置|这里).{0,16}(?:理由|心路|依据))/.test(
      speech,
    ) &&
    /(?:疑点|压|打|切|卡|怀疑|可疑|缺口|不能放过|先记|先挂|不够|不给|没有|没给|没交代|交代|说清楚|只给|省了|太干净|猜位置|空口|空的|空白|悬着|没落地|绕过没提|不闭合|少了前提|没给.{0,10}依据|放桌上|盖住|补|完整|不完整|才完整|一起说)/.test(
      speech,
    );
  const firstCheckPositionAttack =
    /(?:选|查|验|摸)[^。！？；]{0,24}(?:刚好|旁边|前置位|前置|没发言|还没发言|发言前|位置|坐在)[^。！？；]{0,36}(?:省力|太巧|轻松|方便|链|路线|收益)/.test(
      speech,
    ) ||
    /(?:刚好|旁边|前置位|前置|没发言|还没发言|发言前|位置|坐在)[^。！？；]{0,24}(?:选|查|验|摸)[^。！？；]{0,36}(?:省力|太巧|轻松|方便|链|路线|收益)/.test(
      speech,
    );
  const firstCheckTargetChoiceAttack =
    /(?:选|选择)[^。！？；]{0,16}(?:作为)?(?:查验目标|验人目标|首验目标)[^。！？；]{0,40}(?:决定|临时|依据|理由|心路)/.test(
      speech,
    ) ||
    /(?:查验目标|验人目标|首验目标)[^。！？；]{0,36}(?:怎么|为什么|依据|理由|心路|决定|临时)/.test(speech) ||
    /凭什么觉得[^。！？；]{0,24}(?:最容易被[^。！？；]{0,12}(?:推|踩)|最好推|最方便推)|最容易被[^。！？；]{0,12}(?:推|踩)/.test(
      speech,
    );
  const firstCheckLandingAttack =
    /(?:公开证据|公开依据|证据)[^。！？；]{0,24}(?:说明|证明|解释)[^。！？；]{0,24}(?:验人|查验|查杀|验|查)[^。！？；]{0,24}(?:落在|落到|砸在)/.test(
      speech,
    ) ||
    /(?:验人|查验|查杀|验|查)[^。！？；]{0,24}(?:落在|落到|砸在)[^。！？；]{0,24}(?:头上|身上)[^。！？；]{0,36}(?:公开证据|公开依据|证据|随便丢|自然验|不像)/.test(
      speech,
    ) ||
    /(?:随便丢|空口丢)[^。！？；]{0,16}查杀|不像[^。！？；]{0,12}自然验出来/.test(speech);
  const firstCheckPresentationAttack =
    /(?:没有|没)(?:铺垫|心路)[^。！？；]{0,28}(?:上来|直接|一上来|先把)[^。！？；]{0,18}(?:查杀|结果)|(?:没有|没)铺垫[^。！？；]{0,12}(?:没有|没)心路[^。！？；]{0,36}(?:查杀|结果|逼全桌)/.test(
      speech,
    ) ||
    /(?:连犹豫都没犹豫|结果就这么稳|结果就这么完美|这个结果就这么稳|这个结果就这么完美)[^。！？；]{0,36}(?:查杀|预言家|苗木|结果)/.test(
      speech,
    ) ||
    /(?:首置位|首跳|首验|直接)[^。！？；]{0,24}(?:查杀|结果|预言家)[^。！？；]{0,36}(?:干净得不像|不像一个需要思考的预言家|太干净)/.test(
      speech,
    ) ||
    /(?:首置位|首跳|直接)[^。！？；]{0,24}(?:报我|给我|把我)[^。！？；]{0,12}查杀[^。！？；]{0,36}(?:连犹豫|早就准备)/.test(
      speech,
    );
  return firstCheckAttack ||
    firstCheckPositionAttack ||
    firstCheckTargetChoiceAttack ||
    firstCheckLandingAttack ||
    firstCheckPresentationAttack
    ? ["D1首验理由不是主要攻击点"]
    : [];
}

function validateGoldCheckProtectionMisread(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const goldChecks = view.publicSummary.claimBoard.flatMap((claim) =>
    claim.claimedRole === "SEER"
      ? claim.checks.filter((check) => check.result === "GOOD").map((check) => ({ claim, check }))
      : [],
  );
  if (goldChecks.length === 0) return [];

  const framesGoldAsOverProtected = speech.split(/[。！？；]/).some((sentence) => {
    if (!/(?:金水|好人)/.test(sentence)) return false;
    if (!/(?:保护|护住|护票型|设防|撑伞|拦住|防御框架|提前保|替.{0,8}保|替.{0,8}拦)/.test(sentence)) return false;
    return goldChecks.some(({ claim, check }) => mentionsSeatReferenceOrShortName(speech, claim.claimant) || mentionsSeatReferenceOrShortName(sentence, check.target));
  });

  return framesGoldAsOverProtected ? ["报金水后放下金水位是正常处理，不能攻击为提前保护"] : [];
}

function validateDayOneUnearnedClaimantPressure(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  if (view.roleCard.id !== "kirigiri") return [];

  const blackCheck = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER" && claim.claimant.seatId !== view.mySeatId)
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, check })))
    .at(0);
  if (!blackCheck) return [];

  const checkedHasSpoken = view.publicSummary.recentSpeeches.some(
    (item) => item.day === view.day && item.speaker?.seatId === blackCheck.check.target.seatId,
  );
  if (checkedHasSpoken) return [];
  if (!mentionsSeatReference(speech, blackCheck.claim.claimant)) return [];
  if (/(?:票压得准|查杀先作硬信息|这条查杀先作硬信息|桌面没有对跳|没有对跳)/.test(speech)) return [];

  const pressuresClaimantBeforeResponse =
    /(?:票(?:已经|也|直接)?(?:压|锁|钉)|票[^。！？；]{0,8}压得(?:很紧|太紧|死死的|太死)|票直接钉死|压死|锁死|钉死|不留(?:任何)?余地|没留(?:任何)?余地|留的观察窗口|观察窗口很小|压得太死|票压得太死|票压太满|压法太满|封住|预设|急着(?:把|让|压|定|锁)|查杀到底站不站得住|我不跟|我先不接住这个结论)/.test(
      speech,
    ) && /(?:首置位|首跳|跳预言家|报查杀|查杀|结论|票)/.test(speech);

  return pressuresClaimantBeforeResponse ? ["D1首跳查杀未对跳前不要反压预言家"] : [];
}

function validateCheckResultSeerClaimMisread(view: AgentView, speech: string): string[] {
  const publicSeerChecks = view.publicSummary.claimBoard.filter(
    (claim) => claim.claimedRole === "SEER" && claim.checks.length > 0 && claim.claimant.seatId !== view.mySeatId,
  );
  if (publicSeerChecks.length === 0) return [];

  for (const claim of publicSeerChecks) {
    if (!mentionsSeatReferenceOrShortName(speech, claim.claimant)) continue;
    const misreadSentence = speech
      .split(/[。！？；]/)
      .some((sentence) => misreadsReportedCheckAsMissingSeerClaim(sentence));
    if (misreadSentence) return ["报查验结果等同预言家声明，不能追问是否跳预言家"];
  }
  return [];
}

function mentionsSeatReferenceOrShortName(sentence: string, seat: { seatId: number; name: string }): boolean {
  if (mentionsSeatReference(sentence, seat)) return true;
  const shortName = shortPublicName(seat.name);
  return shortName !== seat.name && sentence.includes(shortName);
}

function misreadsReportedCheckAsMissingSeerClaim(sentence: string): boolean {
  if (/(?:没人|没有人|无人|还没人|还没有人|暂无|没有)[^。！？；]{0,8}对跳(?:预言家)?|(?:看|听|等|等下|今天看|先看)[^。！？；]{0,14}有没有对跳/.test(sentence)) {
    return false;
  }
  return (
    /(?:没(?:有)?|未|还没|并没)[^。！？；]{0,18}(?:说|讲|交代|声明|亮|拍|跳)[^。！？；]{0,18}(?:自己是)?预言家/.test(
      sentence,
    ) ||
    /(?:你|你自己|自己)[^。！？；]{0,12}(?:跳|拍|是)[^。！？；]{0,8}预言家了吗/.test(sentence) ||
    /还是只说(?:了)?(?:查验结果|验人结果|查验|验人|结果)/.test(sentence) ||
    /只说(?:了)?(?:查验结果|验人结果|查验|验人|结果)[^。！？；]{0,18}(?:没(?:有)?|未|还没|并没)[^。！？；]{0,8}(?:说|讲|交代|声明|亮|拍|跳)?[^。！？；]{0,8}预言家/.test(
      sentence,
    )
  );
}

function validateDayOneBlackCheckAgendaShift(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const blackCheckTargets = view.publicSummary.claimBoard.flatMap((claim) =>
    claim.claimedRole === "SEER"
      ? claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => check.target)
      : [],
  );
  if (blackCheckTargets.length === 0) return [];

  const nextCheckAgenda = speech.split(/[。！？；]/).some((sentence) => {
    if (/(?:不要|不能|不要求|不是要|别|无需)[^。！？；]{0,16}(?:今晚|明晚|明天|后续|下一晚)[^。！？；]{0,12}(?:验|查|摸)/.test(sentence)) {
      return false;
    }
    return /(?:没(?:提|说|交代)|没有(?:提|说|交代)|只说了结果[^。！？；]{0,20}(?:没|没有)[^。！？；]{0,10})[^。！？；]{0,20}(?:今晚|明晚|明天|后续|下一晚)[^。！？；]{0,12}(?:验|查|摸)[^。！？；]{0,6}谁/.test(
      sentence,
    );
  });

  const targetPattern = blackCheckTargets
    .map((target) => `${target.seatId}\\s*号|${escapeRegExp(target.name)}`)
    .join("|");
  const targetOrBlackCheck = targetPattern ? `(?:${targetPattern}|查杀位|被查杀位)` : "(?:查杀位|被查杀位)";
  const targetNextCheckAgenda = speech.split(/[。！？；]/).some((sentence) => {
    if (/(?:不要|不能|不要求|不是要|别|无需)[^。！？；]{0,16}(?:今晚|明晚|明天|后续|下一晚)[^。！？；]{0,12}(?:验|查|摸)/.test(sentence)) {
      return false;
    }
    return new RegExp(
      `${targetOrBlackCheck}[^。！？；]{0,36}(?:今晚|明晚|明天|后续|下一晚)[^。！？；]{0,12}(?:验|查|摸)[^。！？；]{0,8}谁|(?:今晚|明晚|明天|后续|下一晚)[^。！？；]{0,12}(?:验|查|摸)[^。！？；]{0,8}谁[^。！？；]{0,36}${targetOrBlackCheck}`,
    ).test(sentence);
  });
  const selfProofAgenda = speech.split(/[。！？；]/).some((sentence) => {
    if (/(?:不要|不能|不要求|不是要|别|无需)[^。！？；]{0,16}(?:拍身份|拍出身份|跳身份|自证|解释)[^。！？；]{0,24}(?:调整|怎么调|改票|改结构|改变结构|后移|撤压力)/.test(sentence)) {
      return false;
    }
    return new RegExp(
      `(?:如果|只要|要是)?[^。！？；]{0,16}${targetOrBlackCheck}[^。！？；]{0,24}(?:拍身份|拍出身份|跳身份|自证|解释)[^。！？；]{0,28}(?:调整|怎么调|改票|改结构|改变结构|后移|撤压力)`,
    ).test(sentence);
  });

  return nextCheckAgenda || targetNextCheckAgenda || selfProofAgenda ? ["D1查杀后不要把后续验人或查杀位自证当主要追问"] : [];
}

function validateOrdinaryNonOpeningSelfPosition(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const priorSpeeches = currentDaySpeechItems(view).filter((item) => item.speaker?.seatId !== view.mySeatId);
  if (priorSpeeches.length === 0) return [];
  const normalized = normalizeDigits(speech);
  const selfFirstSpeakerClaim =
    /(?:^|[，,。！？!?；;：:\s])我(?:是)?(?:首置位|首位|第一个发言|第一位发言|第一个开口|第一位开口)/.test(normalized) ||
    /(?:^|[，,。！？!?；;：:\s])我[^。！？；]{0,8}没(?:什么|有)?前置发言可抓/.test(normalized);
  return selfFirstSpeakerClaim ? ["普通局非首发位不要自称首置位"] : [];
}

function validateOrdinaryCopiedLowInfoOpening(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial" || view.day !== 1) return [];
  const priorSpeeches = currentDaySpeechItems(view).filter((item) => item.speaker?.seatId !== view.mySeatId);
  if (!isOrdinaryLowInfoOpeningTemplate(speech)) return [];
  return priorSpeeches.some((item) => isOrdinaryLowInfoOpeningTemplate(item.message))
    ? ["普通局不要复刻前置位低信息开场"]
    : [];
}

function validateOrdinaryLowInfoFirstSeatWaterAttack(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial" || view.day !== 1) return [];
  const firstSpeech = currentDaySpeechItems(view).find((item) => item.speaker?.seatId !== view.mySeatId);
  if (!firstSpeech?.speaker || !isBoundedLowInfoFirstSeatWater(firstSpeech.message)) return [];
  const seatPattern = `(?:${firstSpeech.speaker.seatId}\\s*号|${escapeRegExp(firstSpeech.speaker.name)})`;
  if (!new RegExp(seatPattern).test(speech)) return [];

  const normalized = normalizeDigits(speech);
  const explicitlyProtectsWater =
    new RegExp(`${seatPattern}[^。！？；]{0,64}(?:暂时|先)?(?:不压|不打|不投|放下|暂放|先放|能接受|暂时能接受)`).test(
      normalized,
    ) ||
    new RegExp(`(?:暂时|先)?(?:不压|不打|不投|放下|暂放|先放)[^。！？；]{0,64}${seatPattern}`).test(normalized);
  if (explicitlyProtectsWater && !/(?:但|不过|只是|可)[^。！？；]{0,90}(?:压|怀疑|疑点|没(?:有)?(?:票口|方向|判断|结论)|发言(?:太|偏)?短|过程不(?:太)?够)/.test(normalized)) {
    return [];
  }
  const waterAttack =
    new RegExp(
      `${seatPattern}[^。！？；]{0,80}(?:首置位|首置|第一位|一号位|那句|这句|发言|说法|只说|就一句|一句)[^。！？；]{0,90}(?:发言(?:太|偏)?短|过程不(?:太)?够|过程太薄|太空|太泛|没(?:有)?(?:给|落|说)(?:票口|方向|判断|结论|具体)|只是?先听|先听一圈|不急(?:着)?定人|到底听到了什么|听到了什么|把话接上|说清楚|后续逻辑)`,
    ).test(normalized) ||
    /(?:首置位|首置|第一位|一号位)[^。！？；]{0,40}(?:只说|就一句)[^。！？；]{0,30}(?:先听一圈|不急(?:着)?定人)[^。！？；]{0,80}(?:发言(?:太|偏)?短|过程不(?:太)?够|太空|没(?:有)?(?:票口|方向|判断|结论)|压|怀疑|疑点)/.test(
      normalized,
    );
  return waterAttack ? ["普通局低信息首置位划水不应成为主要攻击点"] : [];
}

function isBoundedLowInfoFirstSeatWater(text: string): boolean {
  const speech = normalizeDigits(text);
  if (/(?:观察点|后面谁|后置位|拿平安夜做文章|压人表态|强推|留疑问|带票|带节奏|问\d+\s*号|轮到你|想听你)/.test(speech)) {
    return false;
  }
  const lowInfoCue = /(?:首置位|一号位|第一(?:个|位)|信息(?:确实)?少|没(?:什么|有)?硬想法|没东西|没视角|前置没有发言可接)/.test(
    speech,
  );
  const handlingCue = /(?:先听一圈|先听|不急(?:着)?定人|先不(?:压票|投|定人)|暂放|先过|我过)/.test(speech);
  return lowInfoCue && handlingCue;
}

function validateOrdinaryRepeatedPressureSourceQuestion(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (!isOrdinaryPressureSourceQuestionAxis(speech)) return [];
  const priorAxisCount = currentDaySpeechItems(view).filter((item) => isOrdinaryPressureSourceQuestionAxis(item.message)).length;
  if (priorAxisCount < 2) return [];
  if (isOrdinaryPressureChainCalloutWithPivot(speech)) return [];
  return ["普通局后置位不要复读同一发言缺口"];
}

function validateOrdinaryObserverOrJargon(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const errors: string[] = [];
  if (/(?:全桌|上帝|整个桌面|桌面整体|全场)[^。！？；]{0,18}(?:视角|角度|复盘|审计|总结|看)|复盘工具/.test(speech)) {
    errors.push("普通局发言不要像全桌复盘");
  }
  const hasFallbackTemplateChain =
    /先放观察位/.test(speech) &&
    /(?:我不直接归死|不直接归死|话说满|这轮先看谁)/.test(speech);
  if (hasFallbackTemplateChain) {
    errors.push("普通局发言不要套兜底模板链");
  }
  const internalTerms = speech.match(/收益来源|发言链(?:条)?|闭合|闭环|收口|压力源/g) ?? [];
  if (internalTerms.length >= 2 || /收益来源|发言链(?:条)?|收口/.test(speech)) {
    errors.push("普通局发言黑话堆叠");
  }
  return errors;
}

function validateOrdinaryVisiblePlayerJargon(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const visibleJargon =
    /(?:布置.{0,4}作业|划线|画线|划一条线|划条线|触线|这(?:句|段)?话(?:本身|其实)|观察点本身|观察条件|发言缺口|身份空间|怎么用这个信息|(?:起票|补票|最后跟票)(?:[^。！？；]{0,16}(?:起票|补票|最后跟票))?|(?:先|暂时)?(?:把|将)?.{0,18}(?:放进|放到|放在|放|留在)?观察位|同一个尺子|给后面的人[^。！？；]{0,16}(?:划线|画线|划一条线|划条线|立标准)|(?:标准|这条线)[^。！？；]{0,18}(?:先立|立出来|触))/;
  return visibleJargon.test(speech) ? ["普通局不要把内部审稿词说出口"] : [];
}

function validateOrdinaryRepeatedSameAxisPileOn(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const currentAxis = extractOrdinaryAuditAxis(speech);
  if (!currentAxis) return [];
  const priorCount = currentDaySpeechItems(view).filter((item) => {
    if (item.speaker?.seatId === view.mySeatId) return false;
    const priorAxis = extractOrdinaryAuditAxis(item.message);
    return priorAxis?.targetSeatId === currentAxis.targetSeatId;
  }).length;
  return priorCount >= 2 ? ["普通局不要连续围绕同一句做同质审计"] : [];
}

function extractOrdinaryAuditAxis(text: string): { targetSeatId: number } | undefined {
  if (
    !/(?:观察点|观察条件|观察位|发言缺口|压力源|这(?:句|段)?话(?:本身|其实)|没有(?:结论|来源|票口|方向)|没给(?:结论|票口|方向)|先审|继续审)/.test(
      text,
    )
  ) {
    return undefined;
  }
  const target = extractOrdinaryAxisSeatIds(text).at(-1);
  return target ? { targetSeatId: target } : undefined;
}

function extractOrdinaryAxisSeatIds(text: string): number[] {
  return [...text.matchAll(/([0-9]+|[一二三四五六七八九十两]+)\s*号/g)]
    .map((match) => parseSeatNumber(match[1] ?? ""))
    .filter((seatId): seatId is number => typeof seatId === "number");
}

function validateOrdinaryCourtroomRegister(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const courtroomRegister =
    /(?:举证责任|举证|证据责任|审判|法庭|证词层级)/.test(speech) ||
    /打法[^。！？；]{0,16}(?:打算|准备|想要)?验谁/.test(speech);
  return courtroomRegister ? ["普通局强身份不要用审判腔"] : [];
}

function validateOrdinaryCopiedPriorSurface(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const currentSurface = normalizeOrdinarySurfaceForCopyCheck(speech);
  if (currentSurface.length < 48) return [];
  const recentPrior = currentDaySpeechItems(view)
    .filter((item) => item.speaker?.seatId !== view.mySeatId)
    .slice(-4);
  for (const prior of recentPrior) {
    const priorSurface = normalizeOrdinarySurfaceForCopyCheck(prior.message);
    if (priorSurface.length < 48) continue;
    if (hasSharedSurfaceSpan(currentSurface, priorSurface, 34)) {
      return ["普通局不要复制前置位整段表述"];
    }
  }
  return [];
}

function validateOrdinaryRepeatedCardSurfaceLoop(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (!hasOrdinaryCardSurface(speech)) return [];
  const priorCardCount = currentDaySpeechItems(view).filter((item) => item.speaker?.seatId !== view.mySeatId && hasOrdinaryCardSurface(item.message)).length;
  return priorCardCount >= 2 ? ["普通局不要连续复读卡句式"] : [];
}

function validateOrdinaryCardJargonSurface(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  return hasOrdinaryCardSurface(speech) ? ["普通局不要用卡句式口癖"] : [];
}

function validateOrdinaryEmptyMicroMove(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (view.day !== 1) return [];
  const compactSpeech = speech.replace(/\s+/g, "");
  if (compactSpeech.length > 48) return [];
  const emptySurface =
    /(?:这段|这句|这句话|这个点|这里)?我?先(?:留|记|挂)(?:一处|一个)?(?:疑问|问号|点)/.test(speech) ||
    /(?:后面|后置位|谁)[^。！？；]{0,12}(?:怎么)?接(?:这条线|这个点|这段|前面这段)?/.test(speech) ||
    /这句话本身/.test(speech);
  if (!emptySurface) return [];
  return hasOrdinaryHandlingAction(speech) ? [] : ["普通局短发言必须有自己的处理动作"];
}

function validateOrdinaryHalfAcceptWithoutLanding(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const halfAcceptMatch = speech.match(/(?:认同一半|认一半|接一半|接受一半|认下?一半)/);
  if (!halfAcceptMatch || halfAcceptMatch.index === undefined) return [];
  if (isHalfAcceptChallengeToAnotherSpeaker(speech, halfAcceptMatch.index)) return [];
  const localSpeech = speech.slice(halfAcceptMatch.index);
  const statesAcceptedPart = /(?:认同|认|接受|接)[^。！？；]{0,42}(?:但|不过|只是|，|,|：|:)/.test(localSpeech);
  const statesReservedPart = /(?:不认同|另一半|不全认|不全跟|不能全跟|但|不过|只是|保留|暂放|不急着|不打死)/.test(localSpeech);
  if (statesAcceptedPart && statesReservedPart && hasOrdinaryHandlingAction(localSpeech)) return [];
  return ["普通局认同一半必须说清落点"];
}

function isHalfAcceptChallengeToAnotherSpeaker(speech: string, halfAcceptIndex: number): boolean {
  const localWindow = speech.slice(Math.max(0, halfAcceptIndex - 36), halfAcceptIndex + 100);
  return (
    /(?:你(?:刚才)?说|你前面说|他说|她说|\d+\s*号[^。！？；]{0,16}说)/.test(localWindow) &&
    /(?:之后呢|然后呢|哪一半|另一半|没说完|是什么|说清|讲清|回一下|回应一下)/.test(localWindow)
  );
}

function validateOrdinaryConfusedLaterChain(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const spokenSeats = currentDaySpokenSeats(view);
  if (spokenSeats.length < 2) return [];
  const sentences = speech.split(/[。！？；]/);
  for (const sentence of sentences) {
    const targetMatch = sentence.match(/(\d+)\s*号[^。！？；]{0,12}后面的人[^。！？；]{0,20}(?:怎么)?接/);
    const targetSeatId = targetMatch ? Number.parseInt(targetMatch[1]!, 10) : NaN;
    if (!Number.isFinite(targetSeatId)) continue;
    const targetIndex = spokenSeats.findIndex((seat) => seat.seatId === targetSeatId);
    if (targetIndex >= 0 && targetIndex < spokenSeats.length - 1) {
      return ["普通局不要用后置链路审计当前已过发言"];
    }
  }
  return [];
}

function validateOrdinaryDuplicatedWordSlip(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  return /(?:先先|现在现在|然后然后|但是但是|就是就是|这个这个|那句那句)/.test(speech)
    ? ["普通局发言不要出现重复口误"]
    : [];
}

function validateOrdinaryObservationSlotTemplate(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const errors: string[] = [];
  if (
    currentDaySpeechItems(view).length >= 3 &&
    /(?:目前|现在)?我?(?:主要)?看[^。！？；]{0,16}(?:后面的人|后置位|后面)[^。！？；]{0,18}(?:怎么)?接(?:这条线|这个点|前面这段)/.test(
      speech,
    )
  ) {
    errors.push("普通局当前位不要把已过的后置反应说成还要看");
  }
  const parksSeat =
    /(?:先)?(?:把|将)?\s*(?:\d+\s*号|[A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})[^。！？；]{0,16}(?:放进|放到|放在|放|留在)?观察位/.test(
      speech,
    );
  if (!parksSeat) return errors;
  const waitsForLaterChain =
    /(?:后面的人|后置位|后面|后续|这条线|前后说法|前后理由|发言链)[^。！？；]{0,24}(?:接|说清|补|落|展开)|(?:接|说清|补|落|展开)[^。！？；]{0,24}(?:这条线|前后说法|前后理由|发言链)/.test(
      speech,
    );
  if (waitsForLaterChain) errors.push("普通局不要用观察位模板继续等后面接线");
  return errors;
}

function validateOrdinaryRedundantBasisQuestion(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const asksBasis =
    /(?:依据是什么|依据在哪|理由是什么|理由在哪|为什么这么说|为什么这样说|凭什么这么说|哪来的依据)/.test(speech) &&
    /(?:你说|你刚才|你那个|这句话|那个观察点|这个观察点)/.test(speech);
  if (!asksBasis) return [];
  const priorWithBasis = currentDaySpeechItems(view).some((item) => {
    if (!item.speaker) return false;
    if (!mentionsSeatReference(speech, item.speaker)) return false;
    const prior = item.message;
    const hasPositionBasis = /(?:位置|靠前|不是最前|能听完|听完前面|舒服|决定打什么方向|带节奏|悍跳)/.test(prior);
    const hasReasonMarker = /(?:因为|所以|理由|依据|我比较想看|我想看|我觉得|我认为)/.test(prior);
    return hasPositionBasis && hasReasonMarker;
  });
  return priorWithBasis ? ["普通局不要重复追问已经给过的依据"] : [];
}

function validateOrdinaryDeathShapeRuleLecture(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const deathShape = getCurrentDayDeathShape(view);
  if (deathShape === "none") return [];
  if (isOrdinaryWitchPublicPotionDisclosure(view, speech)) return [];

  const errors: string[] = [];
  const ruleLecture =
    /(?:狼首夜必刀|狼必刀|女巫手里有解药|手里有解药|药瓶状态|毒药重合刀口|毒口和刀口重合|刀口和毒口重合|毒口重合刀口|刀口重合|公开规则推理|女巫夜里救、毒、跳过三选一)/.test(
      speech,
    ) ||
    /(?:首夜单死|单死)[^。！？；]{0,40}(?:说明|推出|代表|意味着|大概率)[^。！？；]{0,60}(?:女巫没救|没用解药|没用药|刀口未被救)/.test(
      speech,
    ) ||
    /(?:平安夜|无人倒牌|没人倒牌)[^。！？；]{0,40}(?:说明|推出|代表|意味着|大概率)[^。！？；]{0,60}(?:女巫用药|用了救药|用了解药|空刀)/.test(
      speech,
    ) ||
    /(?:毒口|刀口|药线|药瓶)[^。！？；]{0,30}(?:反面解释|低概率|可能性|解释空间)/.test(speech) ||
    /毒(?:重|中|到|了)[^。！？；]{0,12}刀口|刀口[^。！？；]{0,12}毒(?:重|中|到|了)/.test(speech);
  if (ruleLecture) {
    errors.push("普通局死亡形态不要展开规则课");
  }

  const peaceNightRuleLecture =
    deathShape === "peaceful" &&
    /(?:平安夜|女巫用药|用了救药|用了?解药|没人倒牌|无人倒牌)/.test(speech) &&
    (/(?:狼队|狼人|狼)[^。！？；]{0,30}(?:知道|确认|清楚|掌握)[^。！？；]{0,20}(?:刀口|救没救|女巫救没救)/.test(
      speech,
    ) ||
      /(?:越过.{0,8}视角|超出公开信息|女巫行动|刀口在哪|救没救|定义刀口|分析用药逻辑|找女巫)/.test(speech));
  if (peaceNightRuleLecture) {
    errors.push("普通局平安夜不要展开刀口和女巫行动规则课");
  }

  if (mentionsOrdinaryDeathShape(speech, deathShape) && !hasOrdinaryGameActionAfterDeathShape(speech)) {
    errors.push("普通局发言必须推进一个游戏动作");
  }

  return errors;
}

function validateOrdinaryFirstNightWolfKillIntent(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (view.day !== 1 || view.rules.hasGuard) return [];
  const hasSingleDeathContext =
    getCurrentDayDeathShape(view) === "death" || /(?:倒牌|死了|死亡|夜死|狼刀成功|女巫没救|吃刀|被刀)/.test(speech);
  if (!hasSingleDeathContext) return [];

  const asksKillIntent =
    /(?:狼队|狼人|狼)[^。！？；]{0,24}(?:刀法|刀人|刀口|落刀|为什么刀|为啥刀|刀.*意图|意图|刀.*目的|目的|想法|思路)/.test(
      speech,
    ) ||
    /(?:为什么|为啥|怎么会|怎么就)[^。！？；]{0,16}(?:刀|杀|砍)[^。！？；]{0,16}\d+\s*号/.test(speech) ||
    /(?:后置|后面|后续|有人|谁)[^。！？；]{0,30}(?:答上来|解释|说清|聊聊|回答)[^。！？；]{0,30}(?:狼队|狼人|狼)[^。！？；]{0,20}(?:刀法|意图|为什么刀|为啥刀|刀.*目的)/.test(
      speech,
    ) ||
    /(?:刀法意图|狼刀意图|狼队意图|狼队刀法|狼队为什么刀|狼为什么刀|首夜刀人意图|我倒想知道)/.test(speech);
  if (!asksKillIntent) return [];

  const rejectsKillIntentGuess =
    /(?:不猜|猜不了|没法猜|不该猜|不用猜|没信息猜|别猜|不聊|不展开)[^。！？；]{0,24}(?:狼队|狼人|狼|刀法|意图|为什么刀)/.test(
      speech,
    ) ||
    /(?:狼队|狼人|狼|刀法|意图|为什么刀)[^。！？；]{0,24}(?:不猜|猜不了|没法猜|不该猜|不用猜|没信息猜|别猜|不聊|不展开)/.test(
      speech,
    );
  const stillDefersAnswer =
    /(?:后置|后面|后续|有人|谁)[^。！？；]{0,30}(?:答上来|解释|说清|聊聊|回答|接这个点)|我倒想知道/.test(
      speech,
    );
  if (rejectsKillIntentGuess && !stillDefersAnswer) return [];

  return ["普通局首夜不要追问狼刀意图"];
}

function isOrdinaryWitchPublicPotionDisclosure(view: AgentView, speech: string): boolean {
  if (view.myRole !== "WITCH") return false;
  return (
    /(?:我(?:是)?女巫|我拍女巫|女巫牌|明牌女巫|女巫在这里)/.test(speech) &&
    /(?:救了|救的是|银水|用了解药|用了救药|毒了|毒的是|毒药)/.test(speech)
  );
}

function mentionsOrdinaryDeathShape(speech: string, deathShape: CurrentDayDeathShape): boolean {
  if (deathShape === "death") {
    return /(?:死亡|倒牌|出局|死了|死讯|夜死|单死|狼刀|女巫没救|没用解药|没用药|刀口|毒口|药瓶|药线)/.test(speech);
  }
  return /(?:平安夜|无人死亡|没有人死亡|没人倒牌|无人倒牌|女巫用药|用了救药|用了解药|救药|解药|空刀|药瓶|药线)/.test(speech);
}

function hasOrdinaryGameActionAfterDeathShape(speech: string): boolean {
  if (/(?:我)?(?:现在|第一天|这位置|首置位|一号位)?[^。！？；]{0,12}(?:信息(?:确实|太|很)?少|没东西|没听出太多)[^。！？；]{0,42}(?:先听一圈|先听|暂时不压票|先不压票|不急着给结论|等一两个发言落点)/.test(speech)) {
    return true;
  }
  return /(?:我|今天|这轮|先|暂时|后面|后续|票口|投票|票|别再|不要再)[^。！？；]{0,56}(?:怀疑|暂放|放观察|观察位|追问|问|看谁|看一下|看后面|盯|压|投|票|站边|保留|不站死|不归死|验证|条件|解释|回应|回答|急着|带票|带节奏|带方向|说满|跟压|回避|重复聊|划范围|定调|查杀|金水|身份|声明|拍了女巫)|(?:怀疑|暂放|放观察|追问|盯|压|投|验证|票口|投票条件|查杀|金水|身份声明|女巫声明)[^。！？；]{0,56}(?:\d+\s*号|谁|哪|第一个|后面|后置|前置|这句|这个点|这个人|不等于|错当)|(?:不等于|不是|没把)[^。！？；]{0,18}(?:拍|跳|自称)[^。！？；]{0,18}(?:女巫)?身份|(?:验他的理由|验人理由|查验理由|划范围|给后置位划范围|给后面定调|在给后面定调|身份声明|错当女巫声明)/.test(
    speech,
  ) ||
    /(?:身份线|女巫线|银水|查杀|金水)[^。！？；]{0,46}(?:先审|更值得先审|更值得审|先看|先接|我先认|我先放着|不打|没接|一句都没接)/.test(
      speech,
    ) ||
    /(?:我这轮|这轮|我想|我先)[^。！？；]{0,28}(?:转回|说回|审|看|接)[^。！？；]{0,28}(?:\d+\s*号|身份线|女巫|银水|查杀|金水)/.test(
      speech,
    );
}

function validateOrdinaryDeathCommonSenseMisframed(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  if (getCurrentDayDeathShape(view) !== "death") return [];
  const sentences = speech.split(/[。！？；]/);
  const misframesCommonSense = sentences.some((sentence) => {
    if (!/(?:狼刀成功|女巫没救|女巫没用解药|女巫没开药|女巫没吃药)/.test(sentence)) return false;
    if (!/(?:你|他|她|\d+\s*号)/.test(sentence)) return false;
    return /(?:定性|带节奏|借死亡|借死讯|盘女巫|找刀口|这不是带节奏|算不算带节奏)/.test(sentence);
  });
  return misframesCommonSense ? ["普通局不要把死亡常识打成带节奏"] : [];
}

function validateOrdinaryUnresolvedReadChange(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const sentences = speech.split(/[。！？；]/).map((sentence) => sentence.trim()).filter(Boolean);
  const readChangeIndex = sentences.findIndex((sentence) =>
    /(?:我)?(?:改口了|改一下口|改口|可能要改口|判断(?:可能)?要(?:变|改)|改一下判断|重新看|收回前面)/.test(sentence),
  );
  if (readChangeIndex < 0) return [];
  const localText = sentences.slice(readChangeIndex, readChangeIndex + 3).join("。");
  const unquotedLocalText = localText.replace(/“[^”]{0,220}”/g, "").replace(/"[^"]{0,220}"/g, "");
  const givesNewRead = /(?:怀疑|暂放|先放|放观察|更像|不像|偏好|偏狼|好人|狼面|狼坑|票|投|盯|压|站边|不认|认下|改成|改到|先打|先保留|改看|转看|想推|想出)/.test(
    unquotedLocalText,
  );
  return givesNewRead ? [] : ["普通局改口必须说清新判断"];
}

function validateClassTrialRepeatedBlackCheckAxis(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const blackChecks = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, check })));
  if (blackChecks.length === 0) return [];
  if (blackChecks.some(({ check }) => check.target.seatId === view.mySeatId)) return [];

  const checkedHasSpoken = blackChecks.some(({ check }) =>
    view.publicSummary.recentSpeeches.some((item) => item.day === view.day && item.speaker?.seatId === check.target.seatId),
  );
  if (!checkedHasSpoken) return [];

  const recentBlackCheckTalk = view.publicSummary.recentSpeeches.filter(
    (item) => item.day === view.day && /查杀|预言家|不认|接查杀|对跳|跟压|施压|焦点/.test(item.message),
  ).length;
  if (recentBlackCheckTalk < 3) return [];

  const repeatsClaimantAxis = blackChecks.some(({ claim, check }) => {
    const claimantPattern = `${claim.claimant.seatId}\\s*号|${escapeRegExp(claim.claimant.name)}`;
    const targetPattern = `${check.target.seatId}\\s*号|${escapeRegExp(check.target.name)}|查杀位|被查杀位`;
    const claimantLead =
      new RegExp(
        `(?:${claimantPattern})[^。！？；]{0,44}(?:首置位|首跳|跳预言家|报[^。！？；]{0,10}查杀|查杀[^。！？；]{0,16}(?:干净|太快|很快|太硬|拍出来))`,
      ).test(speech) || /(?:首置位|首跳|跳预言家)[^。！？；]{0,36}(?:查杀|预言家|报验)/.test(speech);
    const targetReplayed = new RegExp(
      `(?:${targetPattern})[^。！？；]{0,56}(?:接查杀|接这个查杀|没(?:有)?(?:认|拍身份|说身份)|避了|反问|打动机|给反证|证明自己不是狼|怎么接)`,
    ).test(speech);
    const tableIsOnlyReplaying = /(?:绕着|围着)[^。！？；]{0,12}查杀[^。！？；]{0,18}(?:打转|转)|查杀当成[^。！？；]{0,12}(?:按钮|免思考)/.test(
      speech,
    );
    return (claimantLead && targetReplayed) || (claimantLead && tableIsOnlyReplaying);
  });

  return repeatsClaimantAxis ? ["学级裁判后置位不要复读首跳查杀轴"] : [];
}

function validateClassTrialRepeatedCheckedSelfProofQuestion(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const blackChecks = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, check })));
  if (blackChecks.length === 0) return [];
  if (blackChecks.some(({ check }) => check.target.seatId === view.mySeatId)) return [];

  const repeatsSelfProofQuestion = blackChecks.some(({ check }) => {
    const targetPattern = `${check.target.seatId}\\s*号|${escapeRegExp(check.target.name)}`;
    const recentBlackCheckTalk = view.publicSummary.recentSpeeches.filter(
      (item) => item.day === view.day && /查杀|预言家|不认|接查杀|自证|跳身份|被冤|跟压|施压|焦点/.test(item.message),
    ).length;
    return recentBlackCheckTalk >= 4 && asksCheckedSeatSelfProofQuestion(speech, targetPattern);
  });

  return repeatsSelfProofQuestion ? ["学级裁判后置位不要继续追同一个查杀位自证问题"] : [];
}

function validateClassTrialRepeatedBlackCheckFollowerTarget(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const blackChecks = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, check })));
  if (blackChecks.length === 0) return [];
  const excludedSeatIds = new Set<number>([view.mySeatId]);
  for (const { claim, check } of blackChecks) {
    excludedSeatIds.add(claim.claimant.seatId);
    excludedSeatIds.add(check.target.seatId);
  }
  const checkedHasSpoken = blackChecks.some(({ check }) =>
    view.publicSummary.recentSpeeches.some((item) => item.day === view.day && item.speaker?.seatId === check.target.seatId),
  );
  if (!checkedHasSpoken || !isBlackCheckFollowerTargetCriticism(speech)) return [];

  const repeatedTarget = view.aliveSeats
    .filter((seat) => !excludedSeatIds.has(seat.seatId))
    .find((seat) => {
      if (!criticizesBlackCheckFollowerTarget(speech, seat)) return false;
      const priorCount = currentDaySpeechItems(view).filter(
        (item) =>
          item.speaker &&
          item.speaker.seatId !== seat.seatId &&
          criticizesBlackCheckFollowerTarget(item.message, seat),
      ).length;
      return priorCount >= 2;
    });

  return repeatedTarget ? ["学级裁判后置位不要连续追同一个跟压者"] : [];
}

function validateClassTrialCopiedPriorQuestionShape(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  if (!hasPublicSeerBlackCheck(view)) return [];
  if (/几乎|一样|同一|相同|重复|复读|复制|句式|模板|套/.test(speech)) return [];
  if (!/(?:查杀|预言家|跳|验|站哪边|标准|时机|反手|跟|接|表态)/.test(speech)) return [];
  const currentSpeeches = currentDaySpeechItems(view).filter((item) => item.speaker && item.speaker.seatId !== view.mySeatId);
  if (currentSpeeches.length < 4) return [];

  const copiedPrior = currentSpeeches.slice(-3).some((item) => {
    if (!/(?:查杀|预言家|跳|验|站哪边|标准|时机|反手|跟|接|表态)/.test(item.message)) return false;
    return hasCopiedQuestionShape(speech, item.message);
  });
  return copiedPrior ? ["学级裁判后置位不要复制前置发言句式"] : [];
}

function validateClassTrialDayTwoVoteQuestionChain(view: AgentView, speech: string): string[] {
  if (view.day < 2 || view.roleCard?.theme !== "class-trial") return [];
  if (!repeatsVoteMouthQuestionCue(speech)) return [];
  const priorChainCount = currentDaySpeechItems(view).filter((item) => item.speaker && isVoteMouthQuestionAxis(item.message)).length;
  return priorChainCount >= 2 ? ["D2学级裁判不要复读同一票口问法链"] : [];
}

function isVoteMouthQuestionAxis(text: string): boolean {
  if (/(?:今天的?)?票口.{0,12}(?:押|压|投|往哪里|哪边)|筹码押在哪|押在哪一侧|押哪边|公开落点/.test(text)) {
    return true;
  }
  const axisHits = [
    /票口|投票|今天.{0,12}(?:押|压|投)|公开落点|落点/,
    /筹码|押在哪|押哪边|押在/,
    /问句|反问|结论藏|不给方向|判断.{0,8}变/,
  ].filter((pattern) => pattern.test(text)).length;
  return axisHits >= 2;
}

function repeatsVoteMouthQuestionCue(text: string): boolean {
  return /(?:今天的?)?票口.{0,16}(?:押|压|投|往哪里|哪边)|筹码押在哪|判断有没有变|公开落点|别用(?:反)?问句把结论藏起来|你自己呢/.test(
    text,
  );
}

function validateClassTrialMisreadHeldBackUnspokenPressure(view: AgentView, speech: string): string[] {
  if (view.day < 1 || view.roleCard?.theme !== "class-trial") return [];
  if (/没有提前压|没提前压|不提前压|不先压|先不压/.test(speech)) return [];

  const heldBack = currentDaySpeechItems(view)
    .filter((item) => item.speaker)
    .flatMap((item) => extractHeldBackUnspokenSeats(view, item.speaker!, item.message));
  const misread = heldBack.some((item) => misreadsHeldBackUnspokenSeat(view, speech, item.speaker, item.heldBackSeat));
  return misread ? ["误读前置位对未发言座位的保留态度"] : [];
}

function extractHeldBackUnspokenSeats(
  view: AgentView,
  speaker: ActionTarget,
  message: string,
): { speaker: ActionTarget; heldBackSeat: ActionTarget }[] {
  const results: { speaker: ActionTarget; heldBackSeat: ActionTarget }[] = [];
  for (const seat of view.aliveSeats) {
    const seatPattern = seatReferencePattern(seat);
    const unspokenBeforeHold = new RegExp(
      `(?:${seatPattern}).{0,18}(?:还没发言|还没说话|还没开口).{0,28}(?:我不提前压|不提前压|先不压|不先压|不提前点|不提前打|不提前归|不提前审|不提前评)`,
    );
    const holdBeforeSeat = new RegExp(
      `(?:我不提前压|不提前压|先不压|不先压|不提前点|不提前打|不提前归|不提前审|不提前评).{0,28}(?:${seatPattern})`,
    );
    if (unspokenBeforeHold.test(message) || holdBeforeSeat.test(message)) {
      results.push({ speaker, heldBackSeat: seat });
    }
  }
  return results;
}

function misreadsHeldBackUnspokenSeat(
  view: AgentView,
  speech: string,
  priorSpeaker: ActionTarget,
  heldBackSeat: ActionTarget,
): boolean {
  const priorSpeakerPattern = seatReferencePattern(priorSpeaker);
  const heldBackPattern = view.mySeatId === heldBackSeat.seatId ? `我|${seatReferencePattern(heldBackSeat)}` : seatReferencePattern(heldBackSeat);
  return new RegExp(
    `(?:${priorSpeakerPattern}).{0,28}(?:点|压|打|审|追|说|评).{0,24}(?:${heldBackPattern}).{0,24}(?:不够格|没资格|焦点|补链|解释|没发言|发言)`,
  ).test(speech);
}

function seatReferencePattern(seat: ActionTarget): string {
  const aliases = [`${seat.seatId}\\s*号`];
  const chineseSeatId = chineseSeatNumber(seat.seatId);
  if (chineseSeatId) aliases.push(`${chineseSeatId}\\s*号`);
  const name = seat.name.trim();
  if (name && name !== "你") {
    aliases.push(escapeRegExp(name));
    const shortName = name.replace(/(?:诚|响子|冬子|盾子|缇雅|白夜|灯|爱音)$/u, "");
    if (shortName && shortName !== name) aliases.push(escapeRegExp(shortName));
  }
  return `(?:${aliases.join("|")})`;
}

function chineseSeatNumber(seatId: number): string | undefined {
  return (
    {
      1: "一",
      2: "二",
      3: "三",
      4: "四",
      5: "五",
      6: "六",
      7: "七",
      8: "八",
      9: "九",
      10: "十",
      11: "十一",
      12: "十二",
    } as Record<number, string>
  )[seatId];
}

function hasCopiedQuestionShape(current: string, prior: string): boolean {
  const currentNormalized = normalizeClassTrialSimilarityText(current);
  const priorNormalized = normalizeClassTrialSimilarityText(prior);
  if (currentNormalized.length < 40 || priorNormalized.length < 40) return false;
  const longestCommon = longestCommonSubstringLength(currentNormalized, priorNormalized);
  if (longestCommon >= 34) return true;

  const currentQuestionShape = extractQuestionShapeTokens(current);
  const priorQuestionShape = extractQuestionShapeTokens(prior);
  if (currentQuestionShape.length < 3 || priorQuestionShape.length < 3) return false;
  const priorSet = new Set(priorQuestionShape);
  const overlap = currentQuestionShape.filter((token) => priorSet.has(token)).length;
  return overlap >= 3;
}

function normalizeClassTrialSimilarityText(text: string): string {
  return text
    .replace(/[“”"『』「」'‘’]/g, "")
    .replace(/[，,。！？；：:、\s——…·\-]/g, "")
    .replace(
      /(?:\d{1,2}\s*号)?(?:苗木诚|苗木|雾切响子|雾切|腐川冬子|腐川|黑白熊|江之岛盾子|江之岛|盾子|塞蕾丝缇雅|塞蕾丝|十神白夜|十神|高松灯|高松|千早爱音|爱音|你|他|她|他们|她们)/g,
      "#",
    )
    .trim();
}

function extractQuestionShapeTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const sentence of text.split(/[。！？；]/)) {
    if (!/[?？]|(?:还是|到底|为什么|打算|哪边|哪一边)/.test(sentence)) continue;
    for (const pattern of [
      /报查杀的时机/,
      /刚跳完.{0,12}立刻反手/,
      /昨晚.{0,8}预言/,
      /刚好验到/,
      /等着.{0,8}跳完/,
      /站哪边/,
      /继续藏着/,
      /到底.{0,12}标准/,
      /两头都站/,
    ]) {
      if (pattern.test(sentence)) tokens.push(pattern.source);
    }
  }
  return tokens;
}

function longestCommonSubstringLength(left: string, right: string): number {
  let best = 0;
  let previous = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] !== right[j - 1]) continue;
      current[j] = previous[j - 1] + 1;
      if (current[j] > best) best = current[j];
    }
    previous = current;
  }
  return best;
}

function isBlackCheckFollowerTargetCriticism(speech: string): boolean {
  const hasFollowerIssue =
    /(?:标准|没有标准|两头都站|倾向|站哪边|站哪一边|可信|写死|太快|制造假焦点|看戏|舒服|跟压|救人|台阶|接上|声音|押|下注|筹码|跟注)/.test(
      speech,
    );
  if (!hasFollowerIssue) return false;
  return /(?:查杀|预言家|苗木|腐川|结果|焦点|站边|裁判席|平安夜|标准|两头都站|站哪边|站哪一边)/.test(speech);
}

function criticizesBlackCheckFollowerTarget(speech: string, seat: { seatId: number; name: string }): boolean {
  if (!mentionsSeatReference(speech, seat) || !isBlackCheckFollowerTargetCriticism(speech)) return false;
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
  return speech.split(/[。！？；]/).some((sentence) => {
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

function asksCheckedSeatSelfProofQuestion(speech: string, targetPattern: string): boolean {
  if (!new RegExp(`(?:${targetPattern})`).test(speech)) return false;
  if (quotesFollowerWatchingCheckedSeat(speech, targetPattern) && !directlyAsksCheckedSeatSelfProof(speech, targetPattern)) return false;
  return /(?:怎么(?:让|证明|把话|接|洗)|打算|跳身份|拍身份|说身份|有(?:没有)?身份|手里有没有|自证|证明自己不是|相信你不是|被冤|脱身|怎么接(?:这个)?查杀|怎么把话说完|拿什么接|把话接下去|只说了不认|没说为什么|没(?:有)?给[^。！？；]{0,18}对立面|对立面[^。！？；]{0,18}没(?:有)?给|话也?没说完|停在那里|等别人(?:先)?帮你|等后置位帮你|路铺好)/.test(
    speech
      .split(/[。！？；]/)
      .filter((sentence) => !quotesFollowerWatchingCheckedSeat(sentence, targetPattern))
      .join("。"),
  );
}

function directlyAsksCheckedSeatSelfProof(speech: string, targetPattern: string): boolean {
  return speech.split(/[。！？；]/).some((sentence) =>
    new RegExp(`^\\s*(?:${targetPattern}|查杀位|被查杀位)[^。！？；]{0,28}(?:怎么接|接查杀|自证|跳身份|拍身份|说身份|回应)`).test(
      sentence.trim(),
    ),
  );
}

function quotesFollowerWatchingCheckedSeat(sentence: string, targetPattern: string): boolean {
  void targetPattern;
  return new RegExp(
    `(?:你|\\d{1,2}\\s*号|苗木|雾切|腐川|黑白熊|江之岛|塞蕾丝|十神|高松|爱音)[^。！？；]{0,30}(?:说|刚才说|想看|更想看|要看)[^。！？；]{0,30}(?:\\d{1,2}\\s*号|查杀位|被查杀位|他|她)[^。！？；]{0,24}(?:怎么接|接查杀|接这个查杀|回应)`,
  ).test(sentence);
}

function validateDayOnePeacefulNightBlackCheckMainPoint(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  if (getPublicDeathShapeForSpeech(view) === "death") return [];
  const hasPublicBlackCheck = hasPublicSeerBlackCheck(view);
  const selfBlackCheck =
    view.myRole === "SEER" && /(?:我是|跳|拍)?[^。！？；]{0,12}预言家/.test(speech) && /(?:查杀|验出.{0,8}狼|查验.{0,8}狼人)/.test(speech);
  if (!hasPublicBlackCheck && !selfBlackCheck) return [];

  const turnsPeacefulNightIntoCase = speech.split(/[。！？；]/).some((sentence) => {
    const mentionsPeacefulNight = /(?:平安夜|女巫用药|刀口|空刀|没(?:有)?死人|没人倒牌)/.test(sentence);
    if (!mentionsPeacefulNight) return false;
    if (/(?:只是|只当|先当|作为|当作)[^。！？；]{0,12}(?:背景|公共信息|死亡形态)|(?:背景|公共信息)[^。！？；]{0,12}(?:先放|带过)/.test(sentence)) {
      return false;
    }
    return (
      /(?:所以|因此|因果|直接把查杀|把查杀放|只能压|硬把.{0,12}连|接不上|没(?:有)?直接因果|没有因果|用药线.{0,12}(?:压|打|证明))/.test(
        sentence,
      ) && /(?:查杀|预言家|查验|验|苗木|腐川|3\s*号)/.test(sentence)
    ) || (
      /(?:首置位|起跳|最方便|没人(?:能)?拆|前置位没人|后置位|对跳|画好.{0,8}框|框走|往.{0,8}身上堆)/.test(sentence) &&
      /(?:查杀|预言家|苗木|腐川|3\s*号)/.test(sentence)
    ) || (
      /(?:切掉|切开|不是.{0,8}主线|主线|药瓶|刀口|反面解释|解释空间|公开规则推出来|不给.{0,12}解释|不留.{0,12}解释)/.test(sentence) &&
      /(?:查杀|预言家|你|苗木|腐川|3\s*号)/.test(sentence)
    );
  });

  return turnsPeacefulNightIntoCase ? ["D1平安夜只能作背景，不当主要疑点或查杀依据"] : [];
}

function validateClassTrialPeacefulNightReportOnly(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  if (getPublicDeathShapeForSpeech(view) !== "peaceful") return [];
  if (!/(?:平安夜|女巫用药|药瓶|无人倒牌|没人倒牌|首夜无人倒牌)/.test(speech)) return [];

  const hasOwnAction =
    /(?:我(?:想先|先|会|把|压|投|认|不认|怀疑|看|盯|咬|挂|站|倾向|今天)|谁(?:要|敢|愿意)[^。！？；]{0,16}(?:保|对撞|反对|站出来)|公开[^。！？；]{0,12}(?:对撞|承担)|查杀[^。！？；]{0,24}(?:压|票|对撞|回应|不认))/.test(
      speech,
    );
  const reportOnlyPhrase =
    /(?:我已经公开的结论只有这一个|结论只有这一个|药瓶用了|首夜无人倒牌|无人倒牌，?药瓶用了|平安夜，?女巫用药了)/.test(
      speech,
    );
  const onlyTurnsToReview =
    /(?:现在|接着|然后)?回看\d{1,2}\s*号|(?:现在|接着|然后)?回看(?:苗木|雾切|腐川|黑白熊|江之岛|塞蕾丝|十神|高松|千早)/.test(
      speech,
    ) && !/(?:我先看谁|我会看谁|谁(?:要|敢|愿意)[^。！？；]{0,16}(?:保|对撞|反对|站出来))/.test(speech);

  return reportOnlyPhrase && (!hasOwnAction || onlyTurnsToReview) ? ["平安夜女巫用药不能作为完整发言"] : [];
}

function validateBlackCheckTargetPeacefulNightReuse(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  if (!findPublicBlackCheckAgainstSelf(view)) return [];
  return /(?:平安夜|女巫用药|药瓶|无人倒牌|没人倒牌|首夜无人倒牌)/.test(speech) ? ["被查杀位回应不要复述平安夜"] : [];
}

function validateClassTrialLateBlackCheckInventoryRecap(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const frames = view.publicSummary.claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) => claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => ({ claim, checked: check.target })));
  if (frames.length === 0) return [];
  if (frames.some(({ claim, checked }) => claim.claimant.seatId === view.mySeatId || checked.seatId === view.mySeatId)) return [];
  const currentSpeeches = currentDaySpeechItems(view);
  if (currentSpeeches.length < 4) return [];
  if (!/(?:查杀|预言家|首置位|首跳)/.test(speech)) return [];

  const referencedPriorSpeakers = currentSpeeches.filter(
    (item) => item.speaker && item.speaker.seatId !== view.mySeatId && mentionsSeatReference(speech, item.speaker),
  ).length;
  const inventoryCue =
    /(?:平安夜|女巫用药|首置位|首跳|跳预言家|报.{0,8}查杀|不认|没接|没跳|等验证|缺口|点出来|只说|悍跳|瞎报|很好)/.test(speech);
  if (
    /(?:我先把关系接回来|我追一层|这个细节我想先接回来|我不会替|我也不会|我先挂|我不急着跑票)/.test(speech) &&
    /(?:我先|我不|我也不|我追|我看|我觉得|我不会)/.test(speech)
  ) {
    return [];
  }
  return referencedPriorSpeakers >= 4 && inventoryCue ? ["学级裁判后置位不要复盘整条查杀流水账"] : [];
}

function validateRepeatedClassTrialCounterfactualBenefit(view: AgentView, speech: string): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const blackCheckTargets = view.publicSummary.claimBoard.flatMap((claim) =>
    claim.claimedRole === "SEER"
      ? claim.checks.filter((check) => check.result === "WEREWOLF").map((check) => check.target)
      : [],
  );
  if (blackCheckTargets.length === 0) return [];
  if (blackCheckTargets.some((target) => target.seatId === view.mySeatId)) return [];
  if (!hasBlackCheckCounterfactualBenefit(speech, blackCheckTargets)) return [];
  const priorCount = currentDaySpeechItems(view).filter((item) => hasBlackCheckCounterfactualBenefit(item.message, blackCheckTargets)).length;
  return priorCount > 0 ? ["重复全局收益假设，缺少本角色第一人称动作"] : [];
}

function hasBlackCheckCounterfactualBenefit(speech: string, targets: ActionTarget[]): boolean {
  const targetNames = targets.map((target) => escapeRegExp(target.name)).join("|");
  const targetIds = targets.map((target) => `${target.seatId}\\s*号`).join("|");
  const targetPattern = [targetNames, targetIds, "查杀位", "被查杀位", "她", "他", "腐川"].filter(Boolean).join("|");
  const targetRef = `(?:${targetPattern})`;
  return speech.split(/[。！？；]/).some((sentence) => {
    const genericGlobalBenefit =
      /(?:谁|哪边|背后)[^。！？；]{0,16}(?:最)?(?:收益|受益|轻松|省力|获利)/.test(sentence) &&
      /(?:查杀|预言家|首置位|结构|苗木|腐川|\d\s*号)/.test(sentence);
    if (genericGlobalBenefit) return true;
    const counterfactual =
      new RegExp(`(?:如果|假设|要是|万一)[^。！？；]{0,12}${targetRef}[^。！？；]{0,12}(?:是|翻牌|翻出来|真是)[^。！？；]{0,8}好人`).test(sentence) ||
      new RegExp(`${targetRef}[^。！？；]{0,12}(?:是|翻牌|翻出来|真是)[^。！？；]{0,8}好人`).test(sentence);
    if (!counterfactual) return false;
    return /(?:谁|哪边|背后|后面)[^。！？；]{0,24}(?:收益|受益|轻松|省力|获利|借|吃)/.test(sentence);
  });
}

function validateBlackCheckTargetResponse(view: AgentView, speech: string): string[] {
  const blackCheck = findPublicBlackCheckAgainstSelf(view);
  if (!blackCheck) return [];
  if (isOwnHardSeerCheckSpeech(view, speech)) return [];
  const claimantText = buildClaimantReferencePattern(blackCheck.claimant);
  const respondsToCheck =
    /(?:查杀|被查|验到.{0,8}狼|验出.{0,8}狼|不认|认推|推我|票口|起跳|硬身份反证)/.test(speech) &&
    new RegExp(claimantText).test(speech);
  return respondsToCheck ? [] : ["被查杀发言必须回应查杀"];
}

function isOwnHardSeerCheckSpeech(view: AgentView, speech: string): boolean {
  if (view.myRole !== "SEER") return false;
  const publicClaim = extractOwnRoleClaimFromUnquotedSpeech(view, speech);
  if (publicClaim?.claimedRole !== "SEER" || publicClaim.checks.length === 0) return false;
  return publicClaim.checks.some((check) => check.claimantSeatId === view.mySeatId);
}

function buildClaimantReferencePattern(claimant: ActionTarget): string {
  const name = claimant.name.trim();
  const nameAliases = [
    name,
    name.replace(/(?:诚|响子|冬子|盾子|白夜|缇雅|灯|爱音)$/, ""),
    name.replace(/(?:诚|响子|冬子|盾子|白夜|缇雅|灯|爱音)$/, "同学"),
  ]
    .filter((alias) => alias.trim().length > 0)
    .map(escapeRegExp);
  return [`${claimant.seatId}\\s*号`, ...Array.from(new Set(nameAliases))].join("|");
}

function validateClaimAttribution(
  view: AgentView,
  speech: string,
  publicClaim: ReturnType<typeof extractRoleClaimFromSpeech>,
): string[] {
  const seerClaimantIds = new Set(
    view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === "SEER").map((claim) => claim.claimant.seatId),
  );
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimedRole !== "SEER") continue;
    for (const check of claim.checks) {
      if (check.result !== "WEREWOLF") continue;
      if (seerClaimantIds.has(check.target.seatId)) continue;
      if (misidentifiesSeatAsSeer(speech, check.target.seatId)) {
        return [`把被查杀的${check.target.seatId}号错认成预言家`];
      }
    }
  }

  const roleAttributionChecks = [
    { claimedRole: "SEER", label: "预言家" },
    { claimedRole: "WITCH", label: "女巫" },
    { claimedRole: "HUNTER", label: "猎人" },
    { claimedRole: "KNIGHT", label: "骑士" },
    { claimedRole: "IDIOT", label: "白痴" },
  ] as const;
  const sentences = speech.split(/[。！？；]/);
  for (const { claimedRole, label } of roleAttributionChecks) {
    const claimantSeatIds = new Set(
      view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === claimedRole).map((claim) => claim.claimant.seatId),
    );
    if (publicClaim?.claimedRole === claimedRole) claimantSeatIds.add(view.mySeatId);
    for (const sentence of sentences) {
      for (const seat of view.aliveSeats) {
        if (!mentionsSeatReference(sentence, seat)) continue;
        const seatRef = buildSeatReferencePattern(seat);
        if (isFutureRoleClaimReference(sentence, seatRef, label)) continue;
        if (isRecognizingRoleClaimReference(sentence, seatRef, label)) continue;
        const groupedSeatRef = `${seatRef}(?:[、和]\\s*(?:\\d+\\s*号|[\\u4e00-\\u9fa5A-Za-z0-9_\\-]{1,12}))*`;
        const roleClaimForSeat = new RegExp(
          `${groupedSeatRef}(?:[^。！？；，,]{0,10})?(?:自称|声称|跟跳|对跳|也跳|跳|拍|明牌|报(?:了)?|声明).{0,8}${label}|${seatRef}(?:[^。！？；，,]{0,10})?${label}.{0,8}(?:声明|身份|明牌|对跳|跟跳)`,
        );
        if (!roleClaimForSeat.test(sentence)) continue;
        if (!claimantSeatIds.has(seat.seatId)) return [`把未公开身份的${seat.seatId}号说成${label}声明者`];
      }
    }
  }
  return [];
}

function buildSeatReferencePattern(seat: { seatId: number; name: string }): string {
  const seatNumber = `${seat.seatId}\\s*号(?:[^。！？；，,]{0,8})?`;
  const name = seat.name && seat.name !== "你" ? escapeRegExp(seat.name) : "";
  return name ? `(?:${seatNumber}|${name})` : seatNumber;
}

function isFutureRoleClaimReference(sentence: string, seatRef: string, roleLabel: string): boolean {
  return new RegExp(
    `${seatRef}[^。！？；]{0,24}(?:说|提到|问|看|等|听)[^。！？；]{0,24}(?:谁|后置(?:位)?|后面|有人|外置位)[^。！？；]{0,12}(?:跳|拍|报|声明)[^。！？；]{0,8}${roleLabel}`,
  ).test(sentence);
}

function isRecognizingRoleClaimReference(sentence: string, seatRef: string, roleLabel: string): boolean {
  return new RegExp(
    `${seatRef}[^。！？；]{0,24}(?:说|表示|讲|提到|认为|刚才说)[^。！？；]{0,18}(?:认|认可|先认|暂认|承认)[^。！？；]{0,12}${roleLabel}(?:身份|声明)?(?:空间|边界)?`,
  ).test(sentence);
}

function validateBlackCheckReactionTimeline(view: AgentView, speech: string): string[] {
  for (const timeline of getPriorSpeechBlackCheckTimelines(view)) {
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => mentionsSeatReference(sentence, timeline.target));
    if (targetSentences.some((sentence) => framesPriorSpeechAsPostBlackCheckReaction(sentence, timeline))) {
      return [`把${timeline.target.seatId}号查杀公布前的发言说成查杀后反应`];
    }
  }
  return [];
}

function validatePreClaimTargetInteractionTimeline(view: AgentView, speech: string): string[] {
  for (const timeline of getPriorSpeechBlackCheckTimelines(view)) {
    if (framesPreClaimTargetAsChallengingClaim(speech, timeline)) {
      return [`把${timeline.target.seatId}号查杀公布前的发言说成已经质疑${timeline.claimant.seatId}号查杀线`];
    }
  }
  return [];
}

function validatePostSpeechChallengeTimeline(view: AgentView, speech: string): string[] {
  for (const timeline of getPostSpeechChallengeTimelines(view)) {
    if (framesLaterChallengeAsMissingResponse(speech, timeline)) {
      return [`把${timeline.target.seatId}号发言后的追问说成${timeline.target.seatId}号未回应`];
    }
  }
  return [];
}

function getPostSpeechChallengeTimelines(view: AgentView): Array<{
  target: ActionTarget;
  challengers: ActionTarget[];
  sourceSpeechSeq: number;
  targetLastSpeechSeq: number;
  theme: string;
}> {
  const timelines: Array<{
    target: ActionTarget;
    challengers: ActionTarget[];
    sourceSpeechSeq: number;
    targetLastSpeechSeq: number;
    theme: string;
  }> = [];
  const seen = new Set<string>();
  const pushTimeline = (params: {
    target: ActionTarget;
    challengers: ActionTarget[];
    sourceSpeechSeq: number;
    targetLastSpeechSeq: number;
    theme: string;
  }) => {
    const challengers = uniqueSeatOrder(params.challengers).filter((challenger) => challenger.seatId !== params.target.seatId);
    if (challengers.length === 0) return;
    const key = `${params.target.seatId}:${params.theme}:${challengers.map((challenger) => challenger.seatId).join("-")}`;
    if (seen.has(key)) return;
    seen.add(key);
    timelines.push({ ...params, challengers });
  };

  for (const item of view.publicSummary.tableMemory.speechInfluence) {
    if (item.day !== view.day || item.direction !== "pressure") continue;
    const targetMemory = view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === item.target.seatId);
    if (targetMemory?.lastSpeechDay !== view.day || targetMemory.lastSpeechSeq === undefined) continue;
    if (targetMemory.lastSpeechSeq >= item.sourceSpeechSeq) continue;

    pushTimeline({
      target: item.target,
      challengers: [item.speaker, ...item.followupActors],
      sourceSpeechSeq: item.sourceSpeechSeq,
      targetLastSpeechSeq: targetMemory.lastSpeechSeq,
      theme: describePostSpeechChallengeTheme(view, item.target),
    });
  }

  const currentSpeeches = currentDaySpeechItems(view);
  for (const targetMemory of view.publicSummary.tableMemory.seats) {
    if (targetMemory.lastSpeechDay !== view.day || targetMemory.lastSpeechSeq === undefined) continue;
    if (targetMemory.seatId === view.mySeatId) continue;
    const target = toTargetFromSeatId(view, targetMemory.seatId);
    const theme = describePostSpeechChallengeTheme(view, target);
    const laterChallengeSpeeches = currentSpeeches.filter(
      (speech) =>
        speech.seq > targetMemory.lastSpeechSeq! &&
        speech.speaker &&
        speech.speaker.seatId !== target.seatId &&
        isPostSpeechChallengeMessage(view, target, speech.message, theme),
    );
    if (laterChallengeSpeeches.length < 2) continue;
    pushTimeline({
      target,
      challengers: laterChallengeSpeeches.map((speech) => speech.speaker!),
      sourceSpeechSeq: laterChallengeSpeeches[0]!.seq,
      targetLastSpeechSeq: targetMemory.lastSpeechSeq,
      theme,
    });
  }

  return timelines;
}

function describePostSpeechChallengeTheme(view: AgentView, target: ActionTarget): string {
  const seerClaim = view.publicSummary.claimBoard.find(
    (claim) => claim.claimant.seatId === target.seatId && claim.claimedRole === "SEER" && claim.sourceSpeechSeq !== undefined,
  );
  if (seerClaim) return "身份和投票处理";
  return "没说清的地方";
}

function isPostSpeechChallengeMessage(view: AgentView, target: ActionTarget, message: string, theme: string): boolean {
  if (!mentionsSeatReference(message, target)) return false;
  const targetHasClaim = view.publicSummary.claimBoard.some((claim) => claim.claimant.seatId === target.seatId);
  const checkedByOtherClaim = view.publicSummary.claimBoard.find(
    (claim) =>
      claim.claimant.seatId !== target.seatId &&
      claim.checks.some((check) => check.target.seatId === target.seatId) &&
      mentionsSeatReference(message, claim.claimant),
  );
  if (!targetHasClaim && checkedByOtherClaim && new RegExp(`(?:验|查验|查杀).{0,8}${target.seatId}\\s*号`).test(message)) {
    return false;
  }
  if (theme === "身份和投票处理") {
    return /(?:身份|预言家|查杀|对跳|票口|边界|归票|外置位|硬身份反证|只给结论|没有解释|缺口)/.test(message);
  }
  if (targetHasClaim && /(?:身份|声明|对跳|查验|技能|票口|心路|边界)/.test(message)) return true;
  return /(?:追问|质疑|施压|压|卡|缺口|解释|理由|依据|闭环|回避)/.test(message);
}

function framesLaterChallengeAsMissingResponse(
  speech: string,
  timeline: { target: ActionTarget; challengers: ActionTarget[]; theme: string },
): boolean {
  if (!mentionsSeatReference(speech, timeline.target)) return false;
  const normalized = speech.replace(/[“”"']/g, "");
  if (/(?:不是|不能说|不要说|别说|不该说).{0,18}(?:没回|未回|没回应|未回应|一个字没回|没解释|没给回复)/.test(normalized)) {
    return false;
  }

  const targetText = `${timeline.target.seatId}\\s*号`;
  return normalized
    .split(/[。！？；]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .some((sentence) => {
      if (!mentionsSeatReference(sentence, timeline.target)) return false;
      const challengerMentionCount = timeline.challengers.filter((challenger) =>
        new RegExp(`${challenger.seatId}\\s*号`).test(sentence),
      ).length;
      const hasChallengeActorCue =
        challengerMentionCount > 0 ||
        /(?:后续|后置|多人|全|都|也).{0,32}(?:问|追问|施压|压|点过|指出|卡|质疑)/.test(sentence);
      if (!hasChallengeActorCue) return false;
      const hasChallengeContent = /(?:问|追问|施压|压|点过|指出|卡|质疑).{0,48}(?:验人|依据|思路|理由|缺口|解释)|(?:验人|依据|思路|理由|缺口|解释).{0,48}(?:问|追问|施压|压|点过|指出|卡|质疑)/.test(
        sentence,
      );
      if (!hasChallengeContent) return false;
      return new RegExp(
        `(?:你|他|该位置|这张牌|${targetText}).{0,24}(?:一个字没回|没(?:有)?回(?:应)?|未回(?:应)?|没接|没解释|没给(?:出)?(?:回复|回应|解释|验人理由|思路))`,
      ).test(sentence);
    });
}

function getPriorSpeechBlackCheckTimelines(view: AgentView): Array<{
  claimant: ActionTarget;
  target: ActionTarget;
  claimSeq: number;
  targetLastSpeechSeq: number;
}> {
  const timelines: Array<{
    claimant: ActionTarget;
    target: ActionTarget;
    claimSeq: number;
    targetLastSpeechSeq: number;
  }> = [];
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimedRole !== "SEER" || claim.sourceSpeechSeq === undefined) continue;
    for (const check of claim.checks) {
      if (check.result !== "WEREWOLF") continue;
      const targetMemory = view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === check.target.seatId);
      if (targetMemory?.lastSpeechDay !== view.day || targetMemory.lastSpeechSeq === undefined) continue;
      if (targetMemory.lastSpeechSeq >= claim.sourceSpeechSeq) continue;
      timelines.push({
        claimant: claim.claimant,
        target: check.target,
        claimSeq: claim.sourceSpeechSeq,
        targetLastSpeechSeq: targetMemory.lastSpeechSeq,
      });
    }
  }
  return timelines;
}

function framesPriorSpeechAsPostBlackCheckReaction(
  sentence: string,
  timeline: { claimant: ActionTarget; target: ActionTarget },
): boolean {
  const targetText = `${timeline.target.seatId}\\s*号`;
  const claimantText = `${timeline.claimant.seatId}\\s*号`;
  return (
    new RegExp(`${targetText}.{0,48}(?:被(?:${claimantText})?(?:直接)?(?:报)?查杀后|被查杀后|被查杀后的?(?:第一反应|反应|回应)|查杀后(?:的)?(?:第一反应|反应|回应))`).test(
      sentence,
    ) ||
    new RegExp(`${targetText}.{0,48}被${claimantText}.{0,10}(?:直接)?(?:报)?查杀.{0,24}(?:第一段话|第一反应|反应|回应)`).test(
      sentence,
    ) ||
    new RegExp(`${claimantText}.{0,16}查杀${targetText}后.{0,40}${targetText}.{0,18}(?:第一段话|第一反应|反应|回应)`).test(
      sentence,
    )
  );
}

function framesPreClaimTargetAsChallengingClaim(
  speech: string,
  timeline: { claimant: ActionTarget; target: ActionTarget },
): boolean {
  if (!mentionsSeatReference(speech, timeline.target) || !mentionsSeatReference(speech, timeline.claimant)) return false;
  const normalized = speech.replace(/[“”"']/g, "");
  if (/(?:不是|不能说|不要说|别说|不该说).{0,24}(?:点过|问过|抓过|质疑|卡过|提过|没接|没有接)/.test(normalized)) {
    return false;
  }
  const targetText = `${timeline.target.seatId}\\s*号`;
  const claimantText = `${timeline.claimant.seatId}\\s*号`;
  const claimTopic = `(?:查杀|查验|验人|首验|验${targetText}|验人理由|验人思路|依据|心路|查杀线|缺口)`;
  const saysTargetAlreadyChallenged =
    new RegExp(
      `${targetText}.{0,24}(?:发言|原话|前面|之前|刚才|这段).{0,48}(?:点过|问过|抓过|质疑|卡过|提过).{0,48}(?:${claimantText}|${claimTopic})`,
    ).test(normalized) ||
    new RegExp(
      `(?:缺口|理由|思路|依据).{0,24}在${targetText}.{0,12}(?:发言|原话|前面|之前|刚才|这段).{0,24}(?:已经)?(?:被他|被${targetText})?(?:点过|问过|抓过|质疑|卡过|提过)`,
    ).test(normalized);
  if (!saysTargetAlreadyChallenged) return false;
  return new RegExp(`${claimantText}.{0,24}(?:没(?:有)?接|未接|没有正面接|没(?:有)?回应|未回应|没解释)`).test(normalized);
}

function repairClaimAttributionSpeech(view: AgentView, speech: string): string {
  let repaired = speech;
  const seerClaimantIds = new Set(
    view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === "SEER").map((claim) => claim.claimant.seatId),
  );
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimedRole !== "SEER") continue;
    for (const check of claim.checks) {
      if (check.result !== "WEREWOLF") continue;
      if (seerClaimantIds.has(check.target.seatId)) continue;
      const targetPattern = `${check.target.seatId}\\s*号(?:[A-Za-z0-9_\\-\\u4e00-\\u9fa5]{0,24}?)?`;
      const replacement = `我不认${claim.claimant.seatId}号预言家，先保${check.target.seatId}号查杀位`;
      const beforeRepair = repaired;
      repaired = repaired
        .replace(
          new RegExp(`我?(?:暂时|先|更|比较|倾向)?(?:认|站|信|保|支持|认可)\\s*${targetPattern}\\s*(?:是|为)?\\s*(?:预言家|预言家牌)`, "g"),
          replacement,
        )
        .replace(
          new RegExp(`${targetPattern}\\s*(?:这张|这个|这位)?(?:预言家|预言家牌).{0,12}(?:可信|成立|像真|更真|我认|我站|先认|更信)`, "g"),
          replacement,
        );
      if (repaired !== beforeRepair && view.day === 1) {
        const withoutFirstCheckMotive = repaired
          .split(/(?<=[。！？；])/)
          .filter((sentence) => !/(?:首验|验人心路|查验心路|验人理由|查验理由|为什么首验|没交代为什么|心路太薄)/.test(sentence))
          .join("")
          .trim();
        if (withoutFirstCheckMotive && withoutFirstCheckMotive !== repaired) {
          repaired = compactSpeech(`${withoutFirstCheckMotive}今天先看有没有对跳，以及${check.target.seatId}号怎么接这个查杀。`);
        }
      }
    }
  }
  return repaired;
}

function mustRepairOrdinarySoftSpeech(view: AgentView, softValidationErrors: string[]): boolean {
  return view.roleCard?.theme !== "class-trial" && softValidationErrors.includes("普通局发言疑似被截断");
}

function validateTruncatedSpeechEnding(view: AgentView, speech: string): string[] {
  const clean = speech.trim();
  if (view.roleCard?.theme !== "class-trial") {
    return isOrdinaryTruncatedSpeechEnding(clean) ? ["普通局发言疑似被截断"] : [];
  }
  if (/(?:但|但是|不过|可是|然而)?(?:这里面|这中间|这里|问题|关键|真正的问题|有个问题)[^。！？；]{0,8}(?:有个问题|是个问题|问题|关键|在这里|在这儿|在于这里)[。！？]?$/.test(clean)) {
    return ["发言疑似被截断"];
  }
  if (!clean || /[。！？!?」』”"）)]$/.test(clean)) return [];
  const tail = clean.slice(-28);
  const danglingCue =
    /(?:你那句|这句|那句|刚才说|我想问|想问|我要问|我想听|想听|因为|但是|可是|不过|而且|如果|所以|比如|例如|[:：,，、；;—-])$/;
  return danglingCue.test(tail) ? ["发言疑似被截断"] : [];
}

function validateOrdinaryRecapWithoutLanding(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const clean = speech.trim();
  if (clean.length < 80) return [];
  if (hasOrdinaryFinalLandingAction(clean)) return [];

  const tail = clean.slice(-120);
  const hasRecapVoice =
    /(?:我听明白了|我听进去了|我能听|我先接|我接(?:上一位|你这句|一下)|我想把镜头转一下|我转回|这个观察我能听|值得记|我确实也记了)/.test(
      clean,
    );
  const hasQuotedPrior = /[“"「『][^”"」』]{8,}[”"」』]/.test(clean);
  const seatMentions = clean.match(/\d+\s*号/g)?.length ?? 0;
  const hasChainRecap =
    seatMentions >= 3 ||
    /(?:连续[二三四五六七八九十\d]+个人|后置位好几个位置|好几个位置都|都在打|都接上|压力链)/.test(clean);
  const endsAtQuestionToPrior =
    /(?:\d+\s*号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?你(?:自己)?(?:的)?(?:结论|判断|落点|方向)(?:呢|在哪|是什么)?[。！？!?]?$/.test(
      tail,
    );
  const endsAtRecap =
    /(?:都在打这个点|都接上了|具体的不舒服在哪|值得记|我确实也记了|我先放着|往回多看一步|再看一步|多看一步)[。！？!?]?$/.test(tail);

  return (hasRecapVoice && (hasQuotedPrior || hasChainRecap) && (endsAtQuestionToPrior || endsAtRecap))
    ? ["普通局发言疑似被截断"]
    : [];
}

function repairOrdinarySoftAcceptedSpeech(
  view: AgentView,
  plan: SpeechPlan,
  speech: string,
  softValidationErrors: string[],
  strictness: SpeechStrictness,
): string | undefined {
  if (view.roleCard?.theme === "class-trial") return undefined;
  if (!softValidationErrors.includes("普通局发言疑似被截断")) return undefined;
  const repaired = trimOrdinaryForwardCommitmentEnding(speech);
  if (!repaired || repaired === speech) return undefined;
  const validationErrors = validateRenderedSpeech(view, plan, repaired, strictness);
  const split = splitSpeechValidationErrors(view, validationErrors);
  if (split.hard.length > 0) return undefined;
  if (split.soft.includes("普通局发言疑似被截断")) return undefined;
  return repaired;
}

function isFinalBlackCheckInteraction(plan: SpeechPlan, target: ActionTarget | undefined): boolean {
  if (!target) return false;
  if (plan.target?.seatId === target.seatId && plan.allowedInteraction === "finalize_black_check") return true;
  return (
    plan.claimIntent?.claimedRole === "SEER" &&
    plan.claimIntent.check?.targetSeatId === target.seatId &&
    plan.claimIntent.check.result === "WEREWOLF"
  );
}

function validateConciseTableSpeech(speech: string, view?: AgentView, plan?: SpeechPlan): string[] {
  const isClassTrialSpeech = view?.roleCard?.theme === "class-trial";
  const reportStylePattern = isClassTrialSpeech
    ? /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚)/u
    : /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚)/u;
  const errors: string[] = [];
  const reportStyle = reportStylePattern.test(speech);
  const { maxSentences, maxChars } =
    view && plan
      ? resolveSpeechLimits(view, plan)
      : {
          maxSentences: isClassTrialSpeech ? CLASS_TRIAL_FALLBACK_SPEECH_MAX_SENTENCES : AI_SPEECH_MAX_SENTENCES,
          maxChars: isClassTrialSpeech ? CLASS_TRIAL_FALLBACK_SPEECH_MAX_CHARS : AI_SPEECH_MAX_CHARS,
        };
  const sentenceUnits = countSentenceLikeUnits(speech);
  const tooManySentences =
    sentenceUnits > maxSentences && !isClassTrialKirigiriSegmentedEvidenceCut(view, speech, sentenceUnits);
  const tooLong = speech.length > maxChars;
  if (reportStyle || tooManySentences || tooLong) errors.push("发言过于冗长或报告化");
  const lens = getClassTrialCharacterLens(view?.roleCard);
  if (lens) errors.push(...validateClassTrialLensSpeech(lens, speech));
  if (view) errors.push(...validateClassTrialOpeningHook(view, speech, plan));
  if (view) errors.push(...validateClassTrialRepeatSelfIntroduction(view, speech));
  if (view) errors.push(...validateGenericSpeechTemplate(view, speech));
  if (view) errors.push(...validateClassTrialTerminologyOverload(view, speech));
  if (view) errors.push(...validateClassTrialInternalAuditTerminology(view, speech));
  if (view) errors.push(...validateClassTrialRoleWordChoice(view, speech));
  if (view) errors.push(...validateClassTrialPromptLeak(view, speech));
  if (view) errors.push(...validateClassTrialLowInfoOpeningPersona(view, speech, plan));
  if (view) errors.push(...validateClassTrialRoleSpecificOpening(view, speech, plan));
  if (view) errors.push(...validateClassTrialRoleTexture(view, speech));
  if (view) errors.push(...validateClassTrialFinalSpeakerFutureWait(view, speech));
  return errors;
}

function isClassTrialKirigiriSegmentedEvidenceCut(view: AgentView | undefined, speech: string, sentenceUnits: number): boolean {
  if (view?.roleCard?.theme !== "class-trial" || view.roleCard.id !== "kirigiri") return false;
  if (view.day !== 1 || sentenceUnits > 7 || speech.length > 380) return false;
  if (!hasPublicSeerBlackCheck(view)) return false;
  if (/(?:第一|第二|第三|首先|其次|最后|几点问题|三件事|两个问题|盘问议程|推理框架)/.test(speech)) return false;
  return /(?:我先不接|这一步我先不接|先不反推|先不替|我不会替|我只问|等\d{1,2}\s*号|等.{0,8}开口|等.{0,8}回应|她还没说话|他还没说话)/.test(
    speech,
  );
}

function validateClassTrialOpeningHook(view: AgentView, speech: string, plan?: SpeechPlan): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  if (plan && isClassTrialHardInfoSpeech(view, plan)) return [];
  if (view.day !== 1 || currentDaySpeechItems(view).length > 0) return [];
  if (!isLowInfoDayOneNoHardInfo(view)) return [];
  return hasClassTrialOpeningHook(speech) ? [] : ["首置位发言缺少可验证钩子"];
}

function validateClassTrialRepeatSelfIntroduction(view: AgentView, speech: string): string[] {
  const displayName = view.roleCard?.displayName;
  if (view.roleCard?.theme !== "class-trial" || view.day < 2 || !displayName) return [];
  const firstSentence = speech.match(/^[^。！？；\n]{0,40}/)?.[0] ?? speech.slice(0, 40);
  const escapedName = escapeRegExp(displayName);
  const repeatIntro = new RegExp(
    `^(?:大家好[，,。\\s]*)?(?:(?:我是|我是\\s*)${escapedName}|${escapedName}(?:[，,。！？；;\\s]|$|发言|继续发言|来发言))`,
  ).test(firstSentence.trim());
  return repeatIntro ? ["第二天以后不要再自我介绍"] : [];
}

function validateGenericSpeechTemplate(view: AgentView, speech: string): string[] {
  const isClassTrial = view.roleCard?.theme === "class-trial";
  const templateError = isClassTrial ? "学级裁判发言过于模板化" : "发言过于模板化";
  const genericIdentityTemplate =
    /(?:我先(?:说(?:一下)?|表(?:一下)?|报(?:一下)?)身份|先(?:说|表|报)(?:一下)?身份|我是闭眼好人|按[^。！？；]{0,8}闭眼好人|闭眼好人口吻|闭眼视角|目前信息(?:不多|太少)|信息(?:不多|太少).{0,12}(?:先听|听).{0,8}后置|先听后置(?:位)?(?:发言)?|后置位(?:先)?发言|这轮先过一下|我先过一下)/;
  if (isClassTrial && genericIdentityTemplate.test(speech)) return [templateError];
  const classTrialAllLaterTemplate =
    /(?:等|听|看).{0,8}后置位(?:所有人|全都|全部|这一圈|都)?[^。！？；]{0,16}(?:过完|走完|发完|再回看|再判断)|后置位(?:所有人|全都|全部|这一圈)[^。！？；]{0,16}(?:过完|走完|发完|再回看|再判断)/;
  if (isClassTrial && classTrialAllLaterTemplate.test(speech)) return [templateError];
  const hostLikeClassTrialSummary =
    /(?:好的[，,、\s]*各位|各位[^。！？；]{0,8}前面|前面几位)[^。！？；]{0,36}(?:布局|这盘棋|摆得.{0,8}清楚)[\s\S]{0,140}(?:这确实是个好问题|确实是个好问题|好问题|敏锐地抓住)/;
  if (isClassTrial && hostLikeClassTrialSummary.test(speech)) return [templateError];

  const emptyTemplatePatterns = [
    /按现在桌面看/,
    /我先按公开信息盘/,
    /我换一个角度/,
    /这个疑点(?:至今)?未解除/,
    /票口先放这里/,
  ];
  const emptyTemplateHits = emptyTemplatePatterns.filter((pattern) => pattern.test(speech)).length;
  if (!isClassTrial) {
    return emptyTemplateHits >= 2 ? [templateError] : [];
  }

  if (!shouldUseClassTrialExpressionLeniency(view)) return [];

  const emptyAnyRoleTemplate = /(?:按现在桌面看|我先按公开信息盘|我先不站死|我换一个角度|这个疑点(?:至今)?未解除|票口先放这里)/;
  const hasConcreteClassTrialAnchor =
    /(?:\d{1,2}\s*号|苗木|雾切|腐川|黑白熊|江之岛|塞蕾丝|十神|高松|千早|预言家|女巫|猎人|查杀|金水|平安夜|倒牌|死亡|票型|明牌)/.test(
      speech,
    );
  const isOnlyEmptyTemplate = emptyTemplateHits >= 2 || (emptyAnyRoleTemplate.test(speech) && !hasConcreteClassTrialAnchor);
  return isOnlyEmptyTemplate ? [templateError] : [];
}

function validateClassTrialTerminologyOverload(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  const bundledJargon =
    /(?:站边.{0,6}票口|票口.{0,6}站边|二选一站边|检验线|证据链[^。！？；]{0,16}(?:闭合|闭环|不闭合|没闭合)|证词[^。！？；]{0,12}(?:闭合|闭环|不闭合|没闭合|还没闭合)|后置位[^。！？；]{0,20}(?:还没发言|还没开口))/;
  const celestiaTableMetaphor = view.roleCard.id === "celestia" && /筹码|赔率|下注|押/.test(speech);
  const celestiaAllowedTimingPhrase =
    celestiaTableMetaphor && /后置位[^。！？；]{0,20}(?:还没发言|还没开口)/.test(speech);
  if (bundledJargon.test(speech) && !celestiaAllowedTimingPhrase) return ["学级裁判术语过多"];
  const terms = [
    /公开信息盘/,
    /低信息/,
    /站边/,
    /票口/,
    /闭环/,
    /缺口/,
    /后置位/,
    /发言顺序/,
    /身份坑/,
    /票型/,
  ];
  const hits = terms.filter((pattern) => pattern.test(speech)).length;
  return hits >= 4 ? ["学级裁判术语过多"] : [];
}

function validateClassTrialInternalAuditTerminology(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  if (
    /身份动作和公开边界|公开边界的连接|外置硬身份反证|票口边界|起跳收益|闭合|闭环|结构[^。！？；]{0,12}(?:接上|接线)|(?:唯一)?能接的线/.test(
      speech,
    )
  ) {
    return ["学级裁判发言包含内部术语"];
  }
  return [];
}

function validateClassTrialRoleWordChoice(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  if (view.roleCard.id === "celestia") return [];
  if (!/筹码/.test(speech)) return [];
  if (/塞蕾丝|6号/.test(speech)) return [];
  return ["非塞蕾丝发言滥用筹码口吻"];
}

function validateClassTrialPromptLeak(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  const errors: string[] = [];
  if (
    /(?:---|(?:^|[。！？；]\s*)好的[，,]?.{0,20}我会按|我会按[^。！？；]{0,24}(?:身份|公开查验|角色)|通用观察|发言对比点|推进动作|角色打法|策略卡|读牌优先级|阵营打法|软导演|同一材料|公开证据的闭合方式|对话链|缺口先记下|后续站边|后续的站边|今天(?:的)?态度对上|票型出来看|模板兜底|提示词|prompt|LLM)/i.test(
      speech,
    )
  ) {
    errors.push("学级裁判发言包含提示词痕迹");
  }

  const speechOrder = buildSpeechOrderContext(view);
  const unspokenSeats = speechOrder.currentDayUnspokenSeats.filter((seat) => seat.seatId !== view.mySeatId);
  for (const seat of unspokenSeats) {
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => mentionsSeatReference(sentence, seat));
    if (
      targetSentences.some(
        (sentence) =>
          /(?:后置(?:位)?|轮到你|等你|我等你|你先|先给|给出|复述)/.test(sentence) &&
          /(?:通用观察|发言对比点|推进动作|角色打法|策略卡|模板材料|具体材料)/.test(sentence),
      )
    ) {
      errors.push(`要求未发言的${seat.seatId}号提供模板化材料`);
      break;
    }
  }
  return errors;
}

function validateClassTrialLowInfoOpeningPersona(view: AgentView, speech: string, plan?: SpeechPlan): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  if (plan && isClassTrialHardInfoSpeech(view, plan)) return [];
  if (!isLowInfoDayOneNoHardInfo(view)) return [];
  const genericAuditFrame =
    /(?:发言顺序.{0,12}站边.{0,12}票型|发言顺序.{0,8}票型.{0,16}(?:一起看|一起验证|一起校验|放在一起|合起来看)|站边.{0,12}票型.{0,12}(?:校验|放在一起|一起看)|(?:全桌的)?发言顺序.{0,64}(?:随机排|故意留|后排|后置位|跳身份|核对|一致性|基础|态度|共同验证点|留一个|压力点|主轴|前后逻辑|第一轮发言走完|拉一条线)|后置位.{0,24}发言顺序.{0,12}(?:校验|核对|检查)|后面如果有人[^。！？；]{0,40}(?:身份声明|明确的身份|查验结论|查验)|(?:^|[。！？；，,\s])等(?:后面|后续|之后)?[^。！？；，“”]{0,12}(?:身份声明|有人拍身份|有人跳身份|有人报身份)[^。！？；]{0,16}(?:再对照|对照|出来|再调整|调整)|第一轮发言[^。！？；]{0,32}(?:态度|用词)[^。！？；]{0,32}(?:记|校验|起点)|后置位.{0,24}谁.{0,8}跳身份|后置位谁跳身份|后置位[^。！？；]{0,40}(?:主动提出|明确的怀疑对象|出人方向|谁会)|后置位\d{1,2}号[^。！？；]{0,32}(?:上台|告诉我|接上)|后置位(?:的)?各位[^。！？；]{0,20}等你们发言时|后置位整体[^。！？；]{0,20}(?:先听|听一轮|先看|跟听)|后置位.{0,12}跟听|谁跳身份[、，,]谁跟风|等后置位.{0,42}(?:都说完|说完|定人|推票|再回头|回头看|动机链|上来)|等(?:到)?(?:所有人|全员|全桌|大家)[^。！？；]{0,16}(?:发完言|说完|过完|发言结束)|后面的人发言时|等听完[^。！？；]{0,24}(?:后面几位|后置位|想法).{0,16}(?:对照|判断|回头)|等第一轮(?:发言)?走完.{0,20}(?:验证|对照|判断|查)|下一位[，,、\s]*(?:\d{1,2}号)?[^。！？；]{0,56}(?:补上依据|继续留空|补材料|接这句话|听听|想听|先听你|先听你的|第一反应|你听好了|听好了|谁最受益|轮到你先|轮到你时|替我盯住|盯住|告诉我|接这个|接上这个)|每个人的站边和票型|低保开局|没什么硬信息.{0,80}(?:站边|票型|后置位)|信息(?:确实|很)?(?:不多|太少|少|很少).{0,80}(?:发言顺序|后置位|跳身份|下一位|等后置位))/;
  const genericRoomOpening =
    /^(?:大家|各位)[^。！？；]{0,12}(?:早|好)|(?:首日|第一天|第一轮)?信息(?:确实|很)?(?:不多|太少|少|很少)|我先说一个观察点/;
  return genericAuditFrame.test(speech) || genericRoomOpening.test(speech) ? ["学级裁判低信息开局过于模板化"] : [];
}

function validateClassTrialRoleSpecificOpening(view: AgentView, speech: string, plan?: SpeechPlan): string[] {
  const roleId = view.roleCard?.id;
  if (view.roleCard?.theme !== "class-trial" || !roleId) return [];
  if (plan && isClassTrialHardInfoSpeech(view, plan)) return [];
  if (!isLowInfoDayOneNoHardInfo(view)) return [];
  if (roleId === "fukawa" && !/十神/.test(speech)) {
    return ["腐川低信息开局缺少十神情绪坐标"];
  }
  if (roleId === "enoshima" && !/(?:分析|结构|反应模式|收益路径|收益|伪装)/.test(speech)) {
    return ["江之岛低信息开局缺少分析师结构"];
  }
  return [];
}

function validateClassTrialRoleTexture(view: AgentView, speech: string): string[] {
  const roleId = view.roleCard?.id;
  if (view.roleCard?.theme !== "class-trial" || !roleId) return [];
  if (roleId === "fukawa") {
    if (isLowInfoDayOneNoHardInfo(view)) return [];
    if (/十神/.test(speech) && !hasFukawaTogamiPublicTrigger(view)) {
      return ["腐川十神关系缺少公开触发"];
    }
  }
  return [];
}

function hasFukawaTogamiPublicTrigger(view: AgentView): boolean {
  const togamiSeats = view.aliveSeats.filter(
    (seat) => seat.name.includes("十神") || seat.name.includes("Togami") || seat.seatId === 7,
  );
  const togamiIds = new Set(togamiSeats.map((seat) => seat.seatId));
  const seatIsTogami = (seat: ActionTarget | undefined): boolean =>
    Boolean(seat && (togamiIds.has(seat.seatId) || seat.seatId === 7 || seat.name.includes("十神") || seat.name.includes("Togami")));

  if (
    view.publicSummary.recentSpeeches.some(
      (speech) =>
        seatIsTogami(speech.speaker) ||
        /十神/.test(speech.message),
    )
  ) {
    return true;
  }

  if (
    view.publicSummary.claimBoard.some(
      (claim) => seatIsTogami(claim.claimant) || claim.checks.some((check) => seatIsTogami(check.target)),
    )
  ) {
    return true;
  }

  if (
    view.publicSummary.voteSnapshot.leaders.some(seatIsTogami) ||
    view.publicSummary.voteSnapshot.votes.some((vote) => seatIsTogami(vote.target) || seatIsTogami(vote.voter))
  ) {
    return true;
  }

  return false;
}

function shouldSuppressFukawaTogamiGuide(view: AgentView, plan: SpeechPlan): boolean {
  if (view.roleCard?.theme !== "class-trial" || view.roleCard.id !== "fukawa") return false;
  if (isLowInfoDayOneNoHardInfo(view)) return false;
  if (hasFukawaTogamiPublicTrigger(view)) return false;
  return Boolean(findPublicBlackCheckAgainstSelf(view)) || isClassTrialHardInfoSpeech(view, plan);
}

function validateClassTrialFinalSpeakerFutureWait(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  const speechOrder = buildSpeechOrderContext(view);
  const remaining = speechOrder.currentDayUnspokenSeats.filter((seat) => seat.seatId !== view.mySeatId);
  if (remaining.length > 0) return [];
  const sentences = speech.split(/[。！？；]/).map((sentence) => sentence.trim()).filter(Boolean);
  const waitsForFuture = sentences.some((sentence) => {
    if (/(?:不|不用|不再|不能|别|没有|没必要).{0,4}(?:等|听|看).{0,6}后置|(?:没有|没了|不存在).{0,4}后置|今天(?:已经)?没有后置/.test(sentence)) {
      return false;
    }
    return /(?:等|听|看).{0,8}后置|后置位.{0,12}(?:核对|补|发言|回应|接)|下一位|后面.{0,8}(?:核对|补|回应|发言)/.test(sentence);
  });
  return waitsForFuture ? ["最后位不能等待后置位"] : [];
}

function hasClassTrialOpeningHook(speech: string): boolean {
  return /(?:谁|后置|观察|验证|查验|矛盾|断点|收益|收票|带节奏|借.{0,8}平安夜|接.{0,8}(?:观察|这个点)|回避|身份声明|发言链|票型|压力)/.test(
    speech,
  );
}

function mentionsWolfTeammateAsBlack(view: AgentView, speech: string): boolean {
  return (view.privateKnowledge.wolfTeammates ?? []).some((teammate) => {
    const targetText = `${teammate.seatId}号`;
    return (
      new RegExp(`${targetText}.{0,6}查杀`).test(speech) ||
      new RegExp(`${targetText}.{0,8}(是|为|出)\\s*狼人`).test(speech) ||
      new RegExp(`(?:查验|验了|摸了|验)\\s*${targetText}.{0,8}(查杀|狼人)`).test(speech)
    );
  });
}

async function callOpenAiSpeech(input: LlmSpeechInput): Promise<string> {
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
            content: SPEECH_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI 请求失败：${response.status}`);
    }

    return extractResponseText(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function callRoutedModelSpeech(
  input: LlmSpeechInput,
  context?: AiSpeechProviderContext,
): Promise<RoutedLlmResponse> {
  const modelInput = stripSpeechRuntimeLlm(input);
  return callRoutedModelJsonWithFallbacks({
    personaName: input.persona?.name,
    fallbackPersonaNames: readSpeechFallbackPersonaNames(input),
    task: "speech",
    system: SPEECH_SYSTEM_PROMPT,
    input: modelInput,
    maxTokens: 900,
    customLlm: input.llmConfig,
    onTextDelta: context?.onTextDelta,
    onTextSnapshot: context?.onTextSnapshot,
  });
}

function stripSpeechRuntimeLlm(input: LlmSpeechInput): Omit<LlmSpeechInput, "llmConfig"> {
  const modelInput = { ...input };
  delete modelInput.llmConfig;
  return modelInput;
}

function readSpeechFallbackPersonaNames(input: Pick<LlmSpeechInput, "persona" | "characterRole">): string[] {
  if (input.characterRole?.theme === "class-trial") return [];

  const primaryPersonaName = input.persona?.name;
  const configured = process.env.AI_LLM_SPEECH_FALLBACK_PERSONAS?.trim();
  if (configured && /^(off|none|false|0)$/i.test(configured)) return [];
  const values = configured ? configured.split(",") : ["GPT", "Claude", "GLM"];
  const primary = primaryPersonaName?.trim().toLowerCase();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .filter((value) => value.toLowerCase() !== primary);
}

function createStructuredMockSpeech(view: AgentView, plan = createSpeechPlan(view)): string | undefined {
  const persona = `${view.persona?.name ?? ""} ${view.persona?.label ?? "稳健型"}`.trim();
  const target = selectMockSpeechTarget(view, plan);
  const debateAgenda = buildDebateAgenda(view, { plan, target });
  const opener = personaOpener(persona, view.mySeatId + view.day);
  const ordinaryLead = buildOrdinaryLiveIntentMockLead(view, plan, target);
  const dynamicText = renderSpeechDynamicText(view, plan);
  const evidence = buildStructuredMockEvidence(view, plan, target);
  const previous = buildPreviousSpeechReason(view, target);
  const audit = buildMockReasoningAudit(view);
  const condition = buildVoteCondition(view, plan, target);
  const tallyText = publicTallyText(view);
  const evidenceText = buildNaturalEvidenceSentence(evidence, dynamicText, mockSpeechSeed(view, target, 13), view);
  const dynamicSentence = dynamicText ? `${dynamicText}。` : "";
  const reasonedSpeech = (lead: string) =>
    composeReasonedMockSpeech({
      view,
      plan,
      opener,
      lead,
      target,
      dynamicText,
      evidence,
      previous,
      audit,
      condition,
      tallyText,
    });

  if (view.myRole === "SEER") {
    const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      if (plan.kind !== "claim-check" || plan.claimIntent?.claimedRole !== "SEER" || !plan.claimIntent.check) {
        return compactMockSpeech(
          `${opener}，我这里先不把话说满。${dynamicSentence}${previous ?? ""}${condition}`,
        );
      }
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const checkedTarget = toTargetFromSeatId(view, latestCheck.targetSeatId);
      const checkedText = seatText(checkedTarget);
      const checkEvidence = buildStructuredMockEvidence(view, plan, checkedTarget);
      const checkEvidenceText =
        latestCheck.result === "WEREWOLF" && checkEvidence.length > 0
          ? `我压他的点是：${checkEvidence.join("；")}。`
          : latestCheck.result === "GOOD"
            ? buildGoldWaterMockFollowup(view, checkedTarget, 41)
            : "";
      return compactMockSpeech(
        `${opener}，我跳预言家，${checkedText}是${resultText}。这是我昨晚验出来的，不是听感牌。${checkEvidenceText}${buildSeerCheckCondition(latestCheck.result, checkedTarget, mockSpeechSeed(view, checkedTarget, 43))}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, checkedTarget, 1), view)}`,
      );
    }
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles) && plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check) {
    const resultText = plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水";
    const checkedTarget = toTargetFromSeatId(view, plan.claimIntent.check.targetSeatId);
    const checkedText = seatText(checkedTarget);
    const checkEvidence = buildStructuredMockEvidence(view, plan, checkedTarget);
    const checkEvidenceText =
      plan.claimIntent.check.result === "GOOD"
        ? buildGoldWaterMockFollowup(view, checkedTarget, 47)
        : checkEvidence.length > 0
          ? `我压他的点是：${checkEvidence.join("；")}。`
          : "这条查杀线我先压出来，让外置位对照回应。";
    return compactMockSpeech(
      `${opener}，我跳预言家，${checkedText}是${resultText}。${plan.claimIntent.isCounterclaim ? "外置预言家我不认，" : ""}${checkEvidenceText}${buildSeerCheckCondition(plan.claimIntent.check.result, checkedTarget, mockSpeechSeed(view, checkedTarget, 49))}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, checkedTarget, 2), view)}`,
    );
  }

  if (view.myRole === "WITCH" && plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
    return compactMockSpeech(`${opener}，我拍女巫，${buildPublicRoleVoteLead(view, target, "WITCH")}。${dynamicSentence}${evidenceText}${condition}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, target, 3), view)}`);
  }

  if (view.myRole === "HUNTER" && plan.claimIntent?.claimedRole === "HUNTER" && plan.claimIntent.strength === "hard") {
    return compactMockSpeech(`${opener}，我拍猎人，${buildPublicRoleVoteLead(view, target, "HUNTER")}。${dynamicSentence}${evidenceText}${condition}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, target, 4), view)}`);
  }

  if (view.myRole === "KNIGHT" && plan.claimIntent?.claimedRole === "KNIGHT" && plan.claimIntent.strength === "hard") {
    return compactMockSpeech(`${opener}，我拍骑士，决斗不会替代推理，今天先把公开狼面说清楚。${dynamicSentence}${evidenceText}${condition}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, target, 5), view)}`);
  }

  if (view.myRole === "VILLAGER" && plan.claimIntent?.claimedRole === "WITCH") {
    return compactMockSpeech(
      `${opener}，我这里用偏女巫的口径挡一刀，但判断仍按公开信息来。${dynamicSentence}${evidenceText}${condition}`,
    );
  }

  if (view.myRole === "VILLAGER" && plan.claimIntent?.claimedRole === "HUNTER") {
    return compactMockSpeech(
      `${opener}，我这里不直接拍身份，只把自己放在能吃刀的位置。${dynamicSentence}${evidenceText}${condition}`,
    );
  }

  if (view.myRole === "WITCH") {
    const lastDeath = view.publicSummary.recentDeaths.at(-1);
    const potionText = view.privateKnowledge.witch?.poisonAvailable
      ? "药还在，我会留给强推但解释不清的位置"
      : "药线信息已经不灵活，今天更要靠发言和票型";
    return reasonedSpeech(`不急着拍身份。${lastDeath ? `死亡播报是：${lastDeath}。` : ""}${potionText}。`);
  }

  if (view.myRole === "HUNTER") {
    return reasonedSpeech("枪牌不用抢着拍，先听谁的站边讲不圆。");
  }

  if (view.myRole === "KNIGHT") {
    return reasonedSpeech("决斗不靠气势开，先把公开证据说到位。");
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    return reasonedSpeech(ordinaryLead ?? "只按当前公开发言和票型走。");
  }

  return reasonedSpeech(ordinaryLead ?? "我这轮按闭眼好人打，结论先留活口。");
}

function buildOrdinaryLiveIntentMockLead(
  view: AgentView,
  plan: SpeechPlan,
  target: ActionTarget | undefined,
): string | undefined {
  if (view.roleCard?.theme === "class-trial") return undefined;
  const intent = buildOrdinaryLiveIntent(view, plan);
  const rawFocus = intent.focusTarget ?? target;
  const focus = rawFocus && shouldSkipUnspokenLowInfoMockTarget(view, plan, rawFocus) ? undefined : rawFocus;
  const focusText = focus ? seatText(focus) : undefined;
  const rawReason = naturalizeOrdinaryIntentLine(intent.publicReason);
  const hasCurrentDaySpeech = view.publicSummary.recentSpeeches.some(
    (speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId,
  );
  const reason = !hasCurrentDaySpeech && /刚才|上一位|前面/.test(rawReason) ? "" : rawReason;
  const seed = mockSpeechSeed(view, focus, 31) + view.day * 103;

  if (intent.intent === "explain_pivot" && intent.previousTarget && focus) {
    return pickUnusedMockLine(view, seed, [
      `我上一轮点过${seatText(intent.previousTarget)}，这轮改看${focusText}，得先把新证据说清`,
      `从${seatText(intent.previousTarget)}转到${focusText}不是随手换票，我只认公开新增点`,
      `${focusText}如果要接替旧焦点，必须比${seatText(intent.previousTarget)}更能解释现在的局面`,
    ]);
  }
  if (intent.intent === "defend_self") {
    return focusText
      ? pickUnusedMockLine(view, seed, [
          `先接我身上的压力，再看${focusText}刚才哪句话站不住`,
          `我不只防守，${focusText}这边也要把自己理由说顺`,
          `打到我身上的点我会接，但${focusText}的票和话也要对上`,
        ])
      : "先接我身上的压力，再把问题落到大家都听得见的那句话";
  }
  if (intent.intent === "counter_push" && focusText) {
    return pickUnusedMockLine(view, seed, [
      `${focusText}这里我不顺手放过，先核他说过的话和投票动作`,
      `打回${focusText}不是情绪牌，我只看他说过的话和怎么落票`,
      `压力先留在${focusText}，看他说法和票型有没有接上`,
      `${focusText}这段我还没吃下，先听他怎么补前后过程`,
      `${focusText}别急着翻篇，我要听他把票口讲顺`,
      `${focusText}这里先挂着，等他自己补清楚为什么这么投`,
    ]);
  }
  if (intent.intent === "follow_vote_shape" && focusText) {
    return pickUnusedMockLine(view, seed, [
      `${focusText}这边我前面已经压过，这轮先看那个疑点有没有被解释`,
      `我上一轮打过${focusText}，今天先看他有没有把缺口补上`,
      `${focusText}如果还是接不上前面的票和话，我这轮不会轻放`,
    ]);
  }
  if (focusText) {
    return pickUnusedMockLine(view, seed, [
      `${focusText}先听一个硬点：他说法和投票能不能对上`,
      `我不铺全场，先问${focusText}刚才那段怎么接到票上`,
      `${focusText}先吃一点压力，理由只看他已经说出口的内容`,
      `${focusText}这边我只取一个没说顺的地方，不把全场都绕进去`,
      `我先把${focusText}放桌上，只问他说法哪一步没接住`,
      `${focusText}这里轻压一下，票口看他怎么回应`,
    ]);
  }
  return pickBySeat(seed, [
    "我现在信息少，先听一圈",
    "前面没人可接，我先不站死",
    reason ? `我先说自己的听感：${reason}` : "我先说自己的听感",
  ]);
}

function naturalizeOrdinaryIntentLine(text: string): string {
  return stripTerminalPunctuation(text)
    .replace(/^本轮把(.+?)作为主要观察位，只打一条公开切口$/, "$1已经说出口的内容先核一遍")
    .replace(/^先围绕(.+?)说一个具体公开疑点，别铺全场$/, "$1已经说出口的内容先核一遍")
    .replace(/^围绕(.+?)落一个能被公开复核的疑点，别铺全场$/, "$1已经说出口的内容先核一遍")
    .replace(/^发言只推进(.+?)的一条线，后续投票要接得上$/, "后面投不投这里，就看这个疑点能不能被接住")
    .replace(/^用公开发言或票型把压力转回(.+?)，不要只靠情绪反打$/, "回看$1已经说出口的发言和票型")
    .replace(/^回到(.+?)已经说出口的发言或票型，挑一个全桌能复核的压力点$/, "回看$1已经说出口的发言和票型")
    .replace(/^先从(.+?)说出口的句子和投票动作里找矛盾$/, "回看$1说出口的句子和投票动作")
    .replace(/^后面如果投(.+?)，就沿着同一个疑点走；如果换目标，要说出新的公开证据$/, "后面投不投$1，就看这个疑点能不能被解释");
}

type MockSpeechShape = "logic" | "boundary" | "pressure" | "compare" | "identity" | "emotion";

function composeReasonedMockSpeech(args: {
  view: AgentView;
  plan: SpeechPlan;
  opener: string;
  lead: string;
  target: ActionTarget | undefined;
  dynamicText: string;
  evidence: string[];
  previous: string | undefined;
  audit: string | undefined;
  condition: string;
  tallyText: string;
}): string {
  const targetText = args.target ? seatText(args.target) : "场上焦点位";
  const firstEvidence = args.evidence[0] ?? `${targetText}这段还没把话讲顺`;
  const secondEvidence = args.evidence[1];
  const dynamicSentence = args.dynamicText ? `${args.dynamicText}。` : "";
  const previousSentence = args.previous ? `${args.previous}。` : "";
  const auditSentence = args.audit ? `${args.audit}。` : "";
  const evidenceSentence = secondEvidence ? `${firstEvidence}，另外${secondEvidence}` : firstEvidence;
  const agendaTail = buildDebateAgendaTail(
    buildDebateAgenda(args.view, { plan: args.plan, target: args.target }),
    mockSpeechSeed(args.view, args.target, 6),
    args.view,
  );
  const tableSentence = `${buildMockTablePlayerLine(args.view, args.plan, args.target)}。`;
  const shape = getMockSpeechShape(args.view, args.plan);
  const opening = buildMockOpening(args.opener, args.lead);
  const contextLine = pickMockContextLine(args.view, args.target, auditSentence, previousSentence, tableSentence);
  const actionLine = pickMockActionLine(args.view, args.target, args.condition, agendaTail);

  switch (shape) {
    case "logic":
      return composeMockSpeechLines([
        opening,
        mergeDynamicEvidence(dynamicSentence, evidenceSentence),
        contextLine,
        actionLine,
        args.tallyText,
      ]);
    case "boundary":
      return composeMockSpeechLines([
        opening,
        `边界放清：不把${targetText}直接打死`,
        dynamicSentence || `${firstEvidence}，这是疑点不是定论`,
        actionLine,
        args.tallyText,
      ]);
    case "pressure":
      return composeMockSpeechLines([
        opening,
        `${targetText}这轮得把话讲实`,
        dynamicSentence || evidenceSentence,
        contextLine,
        actionLine,
        args.tallyText,
      ]);
    case "compare":
      return composeMockSpeechLines([
        opening,
        `前后两条线对一下：${args.previous ?? "前置位发言先记样本"}`,
        `再看${firstEvidence}`,
        actionLine,
        args.tallyText,
      ]);
    case "identity":
      return composeMockSpeechLines([
        opening,
        pickIdentityMockLine(args.view, args.target),
        evidenceSentence,
        actionLine,
        args.tallyText,
      ]);
    case "emotion":
      return composeMockSpeechLines([
        opening,
        "听感先保留，不只凭语气下结论",
        firstEvidence,
        actionLine,
        args.tallyText,
      ]);
  }
}

function composeMockSpeechLines(lines: Array<string | undefined>, maxLines = 4): string {
  const normalized = lines
    .map((line) => stripTerminalPunctuation(line ?? ""))
    .filter(Boolean)
    .filter((line, index, array) => array.findIndex((candidate) => candidate === line) === index)
    .slice(0, maxLines);
  return compactMockSpeech(normalized.map((line) => `${line}。`).join(""));
}

function buildNaturalEvidenceSentence(evidence: string[], dynamicText: string, seed = 0, view?: AgentView): string {
  const uniqueEvidence = evidence
    .map((item) => stripTerminalPunctuation(item))
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((candidate) => candidate === item) === index)
    .filter((item) => !sameSpeechPoint(item, dynamicText));

  if (uniqueEvidence.length === 0) return "";
  const evidenceText = uniqueEvidence.slice(0, 2).join("；");
  const options = [
    `我认这个点，是因为${evidenceText}`,
    `我不舒服的是${evidenceText}`,
    `这不是空踩，我卡的是${evidenceText}`,
    `这票不是空压，我听的是${evidenceText}`,
    "这个压力前面有人讲过，我不再原样复述",
    "这个点我先记成压力，等他自己接住",
    "前面这段先留桌上，我只看他怎么回",
  ];
  const picked = view
    ? pickUnusedMockLine(view, seed + simpleTextHash(evidenceText), options)
    : pickBySeat(seed + simpleTextHash(evidenceText), options);
  return `${picked}。`;
}

function naturalizeMockReasoningCueText(text: string, maxLength: number, seed = 0, view?: AgentView): string {
  const stripped = stripTerminalPunctuation(text);
  const pressureChain = stripped.match(/^([A-Za-z0-9\u4e00-\u9fa5]+?)对([A-Za-z0-9\u4e00-\u9fa5]+?)的压力被\d+名后续发言者接住$/);
  if (pressureChain) {
    const [, actor, target] = pressureChain;
    return clipBriefingText(
      pickNaturalizedCueLine(view, seed, [
        `${target}被${actor}点过，后面也有人跟压`,
        `${actor}先压过${target}，后面有人接了这个方向`,
        `${target}这边不是一个人单点，前后都有人看他`,
        `${actor}那一下没停在单点，后面还有人看${target}`,
        `${target}这条压力不是孤例，后面还有人顺着看`,
        `${actor}先开了${target}这条口子，后面有人继续接`,
      ]),
      maxLength,
    );
  }
  const followPressure = stripped.match(/^([A-Za-z0-9\u4e00-\u9fa5]+?)后续继续施压([A-Za-z0-9\u4e00-\u9fa5]+)$/);
  if (followPressure) {
    const [, actor, target] = followPressure;
    return clipBriefingText(
      pickNaturalizedCueLine(view, seed, [
        `${actor}后面又压了${target}`,
        `${actor}后面没有放过${target}`,
        `${actor}那票口还在往${target}身上靠`,
        `${actor}继续盯着${target}这条线`,
        `${actor}后续仍把${target}留在压力里`,
        `${actor}后面还在接${target}这条线`,
      ]),
      maxLength,
    );
  }
  const natural = stripped
    .replace(/被([A-Za-z\u4e00-\u9fa5]+)施压、被([A-Za-z\u4e00-\u9fa5]+)施压/g, "$1和$2都压过")
    .replace(/公开线索是/g, "")
    .replace(/后续发言者/g, "后面的人")
    .replace(/依据是/g, "");
  return clipBriefingText(natural, maxLength);
}

function pickNaturalizedCueLine(view: AgentView | undefined, seed: number, options: string[]): string {
  return view ? pickUnusedMockLine(view, seed, options) : pickBySeat(seed, options);
}

function buildPublicRoleVoteLead(view: AgentView, target: ActionTarget | undefined, role: "WITCH" | "HUNTER"): string {
  const seed = mockSpeechSeed(view, target, role === "WITCH" ? 71 : 73) + view.day * 103;
  if (role === "WITCH") {
    return pickUnusedMockLine(view, seed, [
      "今天别把票摊散",
      "我先把票口收窄一点",
      "出人方向今天要有人兜住",
      "票别乱飞，先听谁敢接我这张牌",
      "我这张牌先把票口压实",
      "今天先别散票，听反证再改",
      "我这张女巫先帮桌面收一下票",
      "票先别散，反证足够我再改",
    ]);
  }
  return pickUnusedMockLine(view, seed, [
    "今天别拿我这枪分票",
    "出人先收在一个能解释的位置",
    "我的枪先放桌上，票别散开",
    "我会盯着最后谁乱改票",
    "枪牌在这里，票口先别被冲散",
  ]);
}

function mergeDynamicEvidence(dynamicSentence: string, evidenceSentence: string): string {
  const dynamicText = stripTerminalPunctuation(dynamicSentence);
  const evidenceText = stripTerminalPunctuation(evidenceSentence);
  if (!dynamicText) return evidenceText;
  if (!evidenceText || sameSpeechPoint(dynamicText, evidenceText)) return dynamicText;
  return /^我/.test(evidenceText) ? `${dynamicText}，${evidenceText}` : `${dynamicText}，再看${evidenceText}`;
}

function sameSpeechPoint(left: string, right: string): boolean {
  const normalizedLeft = normalizeSpeechPoint(left);
  const normalizedRight = normalizeSpeechPoint(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight ||
        normalizedLeft.includes(normalizedRight) ||
        normalizedRight.includes(normalizedLeft)),
  );
}

function normalizeSpeechPoint(text: string): string {
  return stripTerminalPunctuation(text)
    .replace(/[，。；：:\s]/g, "")
    .replace(/^我认这个点是因为/, "")
    .replace(/^依据是/, "")
    .replace(/^理由是/, "");
}

function pickMockContextLine(
  view: AgentView,
  target: ActionTarget | undefined,
  audit: string | undefined,
  previous: string | undefined,
  table: string | undefined,
): string | undefined {
  const previousSpeaker = view.publicSummary.recentSpeeches.at(-1)?.speaker;
  if (previousSpeaker && target && previousSpeaker.seatId !== target.seatId) return previous ?? table;
  if (audit && /(对跳|查验链|票型|焦点)/.test(audit)) return audit;
  return table ?? previous ?? audit;
}

function pickMockActionLine(
  view: AgentView,
  target: ActionTarget | undefined,
  condition: string,
  agendaTail: string,
): string {
  const seed = mockSpeechSeed(view, target, 19);
  const agenda = stripTerminalPunctuation(agendaTail);
  const fallback = stripTerminalPunctuation(condition);
  if (!agenda) return fallback;
  if (!fallback) return agenda;
  return pickBySeat(seed, [agenda, fallback]);
}

function buildMockOpening(opener: string, lead: string): string {
  const openerText = stripTerminalPunctuation(opener);
  const leadText = stripTerminalPunctuation(lead);
  if (!leadText) return `${openerText}。`;
  return `${openerText}，${leadText}。`;
}

function buildDebateAgendaTail(agenda: AiDebateAgenda, seed = 0, view?: AgentView): string {
  let ask = cleanAgendaLine(agenda.crossExamination[0]);
  let vote = cleanAgendaLine(agenda.voteCommitments[0]);
  const usedText = view ? normalizeMockLineForReuse(mockReuseWindowText(view)) : "";
  if (usedText) {
    if (ask && usedText.includes(normalizeMockLineForReuse(ask))) ask = undefined;
    if (vote && usedText.includes(normalizeMockLineForReuse(vote))) vote = undefined;
  }
  ask = ask ? renderMockAgendaAsk(ask, seed, view) : undefined;
  if (ask && vote) {
    return pickMockLineWithOptionalReuse(view, seed, [
      `${ask}；${vote}。`,
      `这轮别空过，${ask}；${vote}。`,
      `先别急着收死，${ask}；${vote}。`,
      `我把改口空间留着，${ask}；${vote}。`,
      `等他把这段接上，${ask}；${vote}。`,
    ]);
  }
  if (ask) {
    return pickMockLineWithOptionalReuse(view, seed, [
      `这个点要回答：${ask}。`,
      `后置位先别空站边，先说清${ask}。`,
      `这个问题我先留在桌上：${ask}。`,
    ]);
  }
  if (vote) {
    return pickMockLineWithOptionalReuse(view, seed, [
      `今天收票先看这个标准：${vote}。`,
      `最后不要散，按这个标准收：${vote}。`,
      `这轮票别散，先按${vote}。`,
    ]);
  }
  return "";
}

function cleanAgendaLine(line: string | undefined): string | undefined {
  let clean = line?.replace(/[。！？；，、,.!\?\s]+$/g, "").trim();
  clean = clean
    ?.replace(/(\d+)号你/g, "$1号")
    .replace(/本轮围绕(.+?)给可改票条件[：:]\s*解释能闭环则后移焦点，继续只给结论则进票池/, "回看$1的站边和票口是否闭合")
    .replace(/^要求(.+?)补查验心路、(.+?)和今天明确票口$/, "$1先补验人顺序和今天票口")
    .replace(/^要求(.+?)补/, "$1补")
    .replace(/^追问\s*/, "")
    .replace(/^(.+?)：你现在站哪条身份线，今天票准备压谁，什么公开反证会让你改票$/, "$1说清站边和今天票口")
    .replace(/^(\d+号[^：:，。]*)[：:]\s*你/, "$1，")
    .replace(/^(\d+号[^：:，。]*)[：:]\s*/, "$1，")
    .replace(/^(\d+号[^，。]*)，现在站哪条身份线/, "$1要说清现在站哪条身份线");
  return clean || undefined;
}

function buildMockReasoningAudit(view: AgentView): string | undefined {
  const claimAudit = buildClaimAudit(view);
  const seerCounterclaim = view.publicSummary.tableMemory.counterclaims.find((group) => group.claimedRole === "SEER");
  if (seerCounterclaim) {
    const chain = claimAudit.checkChains[0] ? `，查验链先看${clipBriefingText(claimAudit.checkChains[0], 72)}` : "";
    return `${formatSeatList(seerCounterclaim.claimants)}这组预言家对跳我先不站死，不能只听谁声音大${chain}`;
  }

  if (claimAudit.protectedClaims.length > 0) {
    return `未对跳强身份先别急着动，${claimAudit.protectedClaims[0]}`;
  }

  const sheriffVote = view.publicSummary.sheriffVoteSnapshot;
  if (sheriffVote?.revealed && sheriffVote.tally.length > 0) {
    return `警徽票型要回看${sheriffVote.tally.map((item) => `${item.target.seatId}号${item.count}票`).join("、")}，看谁的票和站边能闭环`;
  }

  const latestVote = view.publicSummary.tableMemory.voteHistory.at(-1);
  if (latestVote?.tally.length) {
    return `上一轮投票先回看${latestVote.tally.map((item) => `${item.target.seatId}号${item.count}票`).join("、")}，看谁先把票带起来、谁顺着跟上`;
  }

  const seerClaim = view.publicSummary.claimBoard.find((claim) => claim.claimedRole === "SEER");
  if (seerClaim) {
    return `预言家线先验${seatText(seerClaim.claimant)}的报验、心路和票口是不是一致`;
  }

  const focus = view.publicSummary.tableMemory.focus[0];
  if (focus) {
    return `这轮压力落在${seatText(focus.seat)}身上，我要看他说法、站边和投票能不能接上`;
  }

  return undefined;
}

function buildMockTablePlayerLine(view: AgentView, plan: SpeechPlan, target: ActionTarget | undefined): string {
  const currentDaySpeeches = currentDaySpeechItems(view).filter(
    (speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId,
  );
  const previousSpeech = currentDaySpeeches.at(-1);
  const previousSpeaker = previousSpeech?.speaker;
  const targetText = target ? seatText(target) : "主焦点";
  const targetHasSpoken = getPlanTargetSpeechStatus(view, plan, target) === "spoken";
  const seed = mockSpeechSeed(view, target, 7);

  if (target && targetHasSpoken && currentDaySpeeches.length === 0) {
    return pickBySeat(seed, [
      `回看${targetText}已经说过的站边和票口`,
      `${targetText}按已发言内容先核，本轮不要求他补`,
      `我只回看${targetText}原话里的逻辑和票型`,
    ]);
  }

  if (currentDaySpeeches.length === 0) {
    return pickBySeat(seed, [
      target ? `前置位先说我怎么临时处理${targetText}` : "前置位先说自己的状态和处理边界",
      target ? `前面样本少，只说我暂时怎么听${targetText}` : "前面样本少，先说我暂时怎么听",
      target ? `${targetText}不定死，只说后面看这一条能不能说清楚` : "先说自己的听感，不假装已经听完全场",
    ]);
  }

  if (previousSpeaker && target && previousSpeaker.seatId === target.seatId) {
    const speechGap = previousSpeech ? describeSpeechGap(previousSpeech.message) : "过程还没完全闭合";
    return pickBySeat(seed, [
      `${targetText}刚发过言，我先抓他这段里${speechGap}的部分`,
      `我接着${targetText}刚才的话说，他的结论还要和后面票型对上`,
      `${targetText}这段我不急着定性，但刚才的理由还不够硬`,
    ]);
  }

  if (previousSpeaker && target && previousSpeaker.seatId !== target.seatId) {
    if (targetHasSpoken) {
      return pickBySeat(seed, [
        `刚才${seatText(previousSpeaker)}我先当成对照线，回看${targetText}已发言的站边和票型`,
        `上一位${previousSpeaker.name}的线我记下，但${targetText}本轮已经说过，只能先核他的原话`,
        `前置${previousSpeaker.name}提供了一个方向，我这里把${targetText}已经给过的站边和票型放一起核`,
      ]);
    }
    return pickBySeat(seed, [
      `刚才${seatText(previousSpeaker)}我先当成一条对照线，等${targetText}回应后再决定票口`,
      `上一位${previousSpeaker.name}的线我记下，但我不会顺着他直接改票，轮到${targetText}时再听他的过程`,
      `前置${previousSpeaker.name}提供了一个方向，我这里把${targetText}的站边和票型放一起核`,
    ]);
  }

  return pickBySeat(seed, [
    target ? `后面如果有人反驳，就拿公开信息补${target.seatId}号这一条过程` : "后面有更硬信息我再改",
    target ? `${targetText}这条线我先不封死，等下一轮用票型回验` : "我先给可改判断，后面看票型回验",
    target ? `这不是一锤定音，先用后面票型回验${target.seatId}号这条线` : "现在先不抢终局结论，等更多公开材料",
  ]);
}

function getMockSpeechShape(view: AgentView, plan: SpeechPlan): MockSpeechShape {
  const personaId = view.persona?.id ?? "";
  const personaName = view.persona?.name ?? "";
  const risk = view.persona?.riskTolerance ?? 0.45;

  if (plan.kind === "rally" || risk >= 0.66 || personaId.includes("strong")) return "pressure";
  if (personaId.includes("logic") || personaName.includes("DeepSeek") || personaName.includes("Mimo")) return "logic";
  if (personaId.includes("identity") || personaName.includes("Kimi")) return "identity";
  if (personaId.includes("emotion") || personaName.includes("豆包")) return "emotion";
  if (personaId.includes("careful") || personaId.includes("quiet") || personaName.includes("Claude") || personaName.includes("Gemini")) {
    return "boundary";
  }

  const fallbackShapes: MockSpeechShape[] = ["logic", "boundary", "compare", "identity"];
  return fallbackShapes[Math.abs(view.mySeatId + view.day) % fallbackShapes.length] ?? "logic";
}

function renderMockAgendaAsk(ask: string, seed: number, view?: AgentView): string {
  if (/^回看.+已发言的表态和票口/.test(ask)) {
    return pickMockLineWithOptionalReuse(view, seed, [
      "听他把前后表态和今天票口接起来",
      "只看他哪句话能真正落到投票上",
      "让他把刚才的态度和现在的票口说顺",
      "看他前面的话有没有一处能撑住今天这票",
    ]);
  }
  return ask;
}

function pickMockLineWithOptionalReuse(view: AgentView | undefined, seed: number, options: string[]): string {
  return view ? pickUnusedMockLine(view, seed, options) : pickBySeat(seed, options);
}

function buildStructuredMockEvidence(view: AgentView, plan: SpeechPlan, target: ActionTarget | undefined): string[] {
  const items: string[] = [];
  const plannedCheck = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check : undefined;
  if (plannedCheck?.result === "GOOD" && target?.seatId === plannedCheck.targetSeatId) {
    return [buildGoldWaterMockFollowup(view, target, 53)];
  }

  const targetMemory = target
    ? view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === target.seatId)
    : undefined;
  const focus = target
    ? view.publicSummary.tableMemory.focus.find((item) => item.seat.seatId === target.seatId)
    : view.publicSummary.tableMemory.focus[0];
  const reasoningCue = pickReasoningCueForMockSpeech(view.publicSummary.tableMemory, target);
  const targetSpeech = target
    ? [...view.publicSummary.recentSpeeches].reverse().find((speech) => speech.speaker?.seatId === target.seatId)
    : undefined;

  if (reasoningCue) {
    const cueTarget = reasoningCue.target ?? target;
    const cueTargetText = cueTarget ? seatText(cueTarget) : "这条公开线";
    if (reasoningCue.kind === "death_shape") {
      items.push(/平安夜/.test(reasoningCue.summary) ? "昨夜平安夜，我先当背景" : "天亮死讯先当背景，后面看谁借这个带票");
    } else {
      const naturalSeed = mockSpeechSeed(view, cueTarget ?? target, 43);
      const summary = naturalizeMockReasoningCueText(reasoningCue.summary, 58, naturalSeed, view);
      const evidence = reasoningCue.evidence[0] ? naturalizeMockReasoningCueText(reasoningCue.evidence[0], 42, naturalSeed + 7, view) : "";
      const evidenceTail = evidence ? `，再看${evidence}` : "";
      items.push(
        pickUnusedMockLine(view, naturalSeed, [
          `${cueTargetText}这里我主要看${summary}${evidenceTail}`,
          `${cueTargetText}这条线我先记成${summary}${evidenceTail}`,
          `${cueTargetText}被反复点到，我先看${summary}${evidenceTail}`,
          `${summary}这点先挂在${cueTargetText}身上${evidenceTail}`,
          `我不重讲${cueTargetText}，只把${summary}${evidenceTail}放进判断`,
          `${cueTargetText}不是单句问题，我先按${summary}${evidenceTail}听`,
        ]),
      );
    }
  }
  if (focus?.reasons.length) {
    const focusReason = focus.reasons.slice(0, 2).join("、");
    const focusText = seatText(focus.seat);
    const usedText = normalizeMockLineForReuse(mockReuseWindowText(view));
    const reasonAlreadyUsed = usedText.includes(normalizeMockLineForReuse(focusReason));
    items.push(
      reasonAlreadyUsed
        ? pickUnusedMockLine(view, mockSpeechSeed(view, focus.seat, 29), [
            `${focusText}这边已经被点过几轮，我先听他怎么回`,
            `${focusText}这个压力不用再复述，我只看他回应能不能接住`,
            `前面对${focusText}的压力先留桌上，我换成听票口怎么落`,
            `${focusText}的问题已经有人讲过，我不再原样复读`,
          ])
        : pickUnusedMockLine(view, mockSpeechSeed(view, focus.seat, 29), [
            `${focusText}现在吃压，主要因为${focusReason}`,
            `${focusText}被点到的是${focusReason}`,
            `${focusText}这边我先核${focusReason}`,
            `${focusText}这会儿被推到台前，主要卡在${focusReason}`,
          ]),
    );
  }
  if (targetMemory?.claimedByChecks.length) {
    const check = targetMemory.claimedByChecks.at(-1);
    if (check) items.push(`${check.claimant.name}公开给过${targetTextFromResult(check.result)}`);
  }
  if (targetMemory?.claims.length) {
    const targetMemoryText = seatText(targetMemory);
    items.push(
      pickBySeat(mockSpeechSeed(view, targetMemory, 37), [
        `${targetMemoryText}有身份声明，我要看他后面票怎么落`,
        `${targetMemoryText}已经报过身份，不能只听身份名，还要看处理顺序`,
        `${targetMemoryText}这张身份牌要和今天怎么投票对上`,
        `${targetMemoryText}的身份声明先记下，后面看谁围着它改票`,
      ]),
    );
  }
  if (targetMemory?.evasiveSpeechCount) {
    items.push(`${target ? seatText(target) : "这个位置"}前面有回避站边的记录`);
  }
  if (targetMemory?.shortSpeechCount) {
    items.push(`${target ? seatText(target) : "这个位置"}发言偏短，过程不够`);
  }
  if (targetSpeech?.message && !items.some((item) => item.includes("发言"))) {
    items.push(`${target ? seatText(target) : "这个位置"}上一段发言里${describeSpeechGap(targetSpeech.message)}`);
  }

  const hasCurrentDaySpeech = view.publicSummary.recentSpeeches.some(
    (speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId,
  );
  const planPoint = plan.talkingPoints.find(
    (point) =>
      !/队友|狼队|真实身份|隐藏身份/.test(point) &&
      !isInstructionalMockSpeechPoint(point) &&
      (hasCurrentDaySpeech || !/刚才|上一位|前面/.test(point)),
  );
  if (items.length === 0 && planPoint) {
    items.push(planPoint);
  }
  if (items.length === 0) {
    items.push(target ? `${seatText(target)}这段还没把话讲顺` : "场上还缺一段能说顺的话");
  }

  return [...new Set(items)].slice(0, 2);
}

function pickReasoningCueForMockSpeech(
  tableMemory: TableMemory,
  target: ActionTarget | undefined,
): PublicReasoningCue | undefined {
  const cues = tableMemory.reasoningCues
    .filter((cue) => !target || cue.target?.seatId === target.seatId)
    .sort((a, b) => reasoningCueSpeechWeight(b.weight) - reasoningCueSpeechWeight(a.weight));
  return cues[0];
}

function reasoningCueSpeechWeight(weight: PublicReasoningCue["weight"]): number {
  if (weight === "strong") return 3;
  if (weight === "medium") return 2;
  return 1;
}

function targetTextFromResult(result: "WEREWOLF" | "GOOD"): string {
  return result === "WEREWOLF" ? "查杀压力" : "金水信息";
}

function describeSpeechGap(message: string): string {
  if (
    /平安夜|女巫用药|用药/.test(message) &&
    /(?:谁急着|谁借|带票|带节奏|只卡|卡\d+\s*号|不把票压死|先不压死|不定人|不拿.*定人|暂放|先放|先不投|先记|有点滑|听着滑|听着有点滑|有点别扭|听着别扭|不舒服|怀疑谁|压谁|打谁)/.test(
      message,
    )
  ) {
    return "平安夜只算背景，我现在不跟着带票，也不把票压死";
  }
  if (message.length < 42) return "我先不跟着带票";
  if (/先听|不急|过一轮|不站死|不好说/.test(message)) return "我先暂放，等投票时看他怎么落";
  if (/(?:倒牌|死亡|死讯|夜死|被杀)/.test(message) && /(?:女巫用药|用药|药线|女巫)/.test(message)) {
    return "死讯推理和身份声明被揉在一起，公开理由没有分清";
  }
  if (/平安夜|女巫用药|用药/.test(message) && !/(我.{0,10}(女巫|用药|救)|女巫在这里|明牌女巫|拍女巫|女巫牌)/.test(message)) {
    return "只说了平安夜，但没说自己怀疑谁";
  }
  if (/查杀|金水|预言家|女巫|猎人/.test(message)) return "他提了身份，我先看今天怎么落票";
  return "我先暂放，等投票时看他怎么落";
}

function pickIdentityMockLine(view: AgentView, target: ActionTarget | undefined): string {
  const targetText = target ? seatText(target) : "这轮焦点";
  return pickBySeat(mockSpeechSeed(view, target, 23), [
    `${targetText}先和已公开身份说法对一下`,
    `我先看身份声明和今天投票能不能对上`,
    `${targetText}这边先别只听结论，要看站边怎么落票`,
  ]);
}

function buildPreviousSpeechReason(view: AgentView, target: ActionTarget | undefined): string | undefined {
  const previousSpeech = view.publicSummary.recentSpeeches.at(-1);
  const previousSpeaker = previousSpeech?.speaker;
  if (!previousSpeech || !previousSpeaker || previousSpeaker.seatId === view.mySeatId) return undefined;
  if (target && previousSpeaker.seatId === target.seatId) return undefined;

  const previousText = seatText(previousSpeaker);
  if (previousSpeech.message.length < 50) {
    return `${previousText}发言偏短，我只先记样本，不直接跟票`;
  }
  return pickUnusedMockLine(view, mockSpeechSeed(view, previousSpeaker, 61 + view.mySeatId * previousSpeaker.seatId), [
    `${previousText}的判断我先记成样本，但不直接照搬`,
    `${previousText}那段我听到了，但票还是看被点的人怎么回`,
    `${previousText}这轮我只当一份材料，不拿来替自己下结论`,
    `${previousText}这一段先放桌面，有反证我会改`,
    `${previousText}那段我先记着，票口还是按我自己的理由走`,
    `${previousText}说得有参考，但我不会跟着直接定人`,
    `${previousText}这段我先放旁边，我更想听被点的人怎么回`,
  ]);
}

function buildVoteCondition(view: AgentView, plan: SpeechPlan, target: ActionTarget | undefined): string {
  if (!target) return "所以这轮我先不压票，听一圈再看谁急着带节奏。";
  if (isFinalBlackCheckInteraction(plan, target)) {
    return buildSeerCheckCondition("WEREWOLF", target);
  }
  const plannedCheck = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check : undefined;
  if (plannedCheck && plannedCheck.targetSeatId === target.seatId) {
    return buildSeerCheckCondition(plannedCheck.result, target);
  }

  const targetText = seatText(target);
  const seed = mockSpeechSeed(view, target, 11);
  const targetHasSpoken = getPlanTargetSpeechStatus(view, plan, target) === "spoken";

  if (plan.kind === "rally") {
    return pickBySeat(seed, [
      `如果后置没有更强反证，今天可以先往${targetText}收票。`,
      `我这轮的票口先往${targetText}靠，后置位要改我就给更硬证据。`,
      `除非后面有人把这条线打断，不然${targetText}可以进今天主票口。`,
    ]);
  }

  if (plan.kind === "defend") {
    return pickBySeat(seed, [
      targetHasSpoken
        ? `${targetText}已经讲过，我只回看他原话里能不能和票型对上。`
        : `如果${targetText}轮到时能补出清楚逻辑，我会把他从第一焦点往后放。`,
      targetHasSpoken
        ? `${targetText}刚才的动机和票型要回看，今天先不靠想象补过程。`
        : `${targetText}只要把动机和票型讲顺，我这边可以先撤压力。`,
      targetHasSpoken
        ? `我保留观察空间，但只按${targetText}已经说出口的内容评估。`
        : `我保留可改空间，关键看${targetText}后面能不能把这段话讲顺。`,
    ]);
  }

  if (targetHasSpoken) {
    return pickBySeat(seed, [
      `${targetText}这段我先挂疑问，等投票前再看有没有人能补出反证。`,
      `我不会只凭一个点出${targetText}，但他刚才的过程在票型前还不够硬。`,
      `这票可以先压在${targetText}附近，除非后面有人给出更完整的反面解释。`,
    ]);
  }

  return pickBySeat(seed, [
    view.roleCard?.theme === "class-trial"
      ? `${targetText}还没开口，我不替他补证词；等他站上来，只看那句话能不能接住桌面的停顿。`
      : `等轮到${targetText}发言时，我要听他把站边理由和票口讲完整。`,
    view.roleCard?.theme === "class-trial"
      ? `${targetText}的证词还没到，我先不写判词；后面只认他说出口的公开理由。`
      : `轮到${targetText}时，我要听他把结论、依据和票口放在一起讲。`,
    view.roleCard?.theme === "class-trial"
      ? `${targetText}还没有声音，我先把判断留在裁判台上。`
      : `${targetText}发言前我先不定死，等他给完视角再决定票怎么落。`,
  ]);
}

function mockSpeechSeed(view: AgentView, target: ActionTarget | undefined, salt = 0): number {
  return view.day * 31 + view.mySeatId * 17 + (target?.seatId ?? 0) * 13 + salt;
}

function buildSeerCheckCondition(result: "WEREWOLF" | "GOOD", target: ActionTarget, seed = target.seatId): string {
  const targetText = seatText(target);
  if (result === "WEREWOLF") {
    return pickBySeat(seed, [
      `今天票口先压${targetText}，外置位只给硬身份反证，不要分票。`,
      `${targetText}先上主票口，除非有人给出更硬的身份反证。`,
      `这张查杀我会落票到${targetText}，外置位要改票就拿身份说法对撞。`,
    ]);
  }
  return pickBySeat(seed, [
    `${targetText}这张金水先从出人池拿掉，重点看谁逆着验人结果硬踩。`,
    `今天不从${targetText}开票，谁要打他就把反证摆清楚。`,
    `${targetText}我先按金水处理，票口转去看谁想强行推他。`,
    `这张金水不是今天的票口；有人要踩，就先给公开反证。`,
  ]);
}

function buildGoldWaterMockFollowup(view: AgentView, target: ActionTarget, salt = 0): string {
  const targetText = seatText(target);
  return pickBySeat(mockSpeechSeed(view, target, salt), [
    `${targetText}先按金水处理，今天别从这里开票。`,
    `这张金水先放桌面，真正要看的是谁逆着结果硬踩。`,
    `${targetText}这轮不进主票口，外置位先给反证。`,
    `我先把${targetText}从今天的怀疑池里拿掉，票口看外面。`,
  ]);
}

function selectMockSpeechTarget(view: AgentView, plan: SpeechPlan): ActionTarget | undefined {
  if (plan.target && !shouldSkipUnspokenLowInfoMockTarget(view, plan, plan.target)) return plan.target;
  const protectedGoldSeatIds = publicUnchallengedGoldSeatIds(view);
  if (view.phase === "DAY_SPEECH" && view.day === 1) {
    const spoken = currentDaySpeechItems(view).filter((speech) => speech.day === view.day && speech.speaker?.seatId !== view.mySeatId);
    if (spoken.length === 0) return undefined;
  }
  return (
    view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId && !protectedGoldSeatIds.has(seat.seatId)) ??
    view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId)
  );
}

function shouldSkipUnspokenLowInfoMockTarget(view: AgentView, plan: SpeechPlan, target: ActionTarget): boolean {
  if (view.phase !== "DAY_SPEECH" || view.day !== 1) return false;
  const spoken = currentDaySpeechItems(view).filter((speech) => speech.day === view.day && speech.speaker?.seatId !== view.mySeatId);
  if (spoken.length > 0) return false;
  if (getPlanTargetSpeechStatus(view, plan, target) === "spoken") return false;
  const checkTarget = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check?.targetSeatId : undefined;
  if (checkTarget === target.seatId) return false;
  const publicTargetHasHardInfo = view.publicSummary.claimBoard.some(
    (claim) => claim.claimant.seatId === target.seatId || claim.checks.some((check) => check.target.seatId === target.seatId),
  );
  return !publicTargetHasHardInfo;
}

function isInstructionalMockSpeechPoint(point: string): boolean {
  return /(?:首置位|前面没人可接|低信息|只作背景|不要|不能|只能|可以直接|桌面任务|处理边界|处理动作|交投票方向|立刻表态|药线|空刀|currentPressure|allowedSpeechMoves|tableObjects)/.test(point);
}

function protectPublicGoldReferences(view: AgentView, speech: string): string {
  const protectedGoldSeatIds = publicUnchallengedGoldSeatIds(view);
  if (protectedGoldSeatIds.size === 0) return speech;

  const protectedSpeech = speech
    .split(/([。！？；，、])/)
    .map((part) => {
      for (const seatId of protectedGoldSeatIds) {
        if (pressuresSeatInMockSpeech(part, seatId) && !isProtectiveGoldSpeechSegment(part)) {
          const target = view.aliveSeats.find((seat) => seat.seatId === seatId) ?? { seatId, name: `${seatId}号` };
          return pickBySeat(mockSpeechSeed(view, target, 67), [
            `${seatId}号这张公开金水先不进票口`,
            `${seatId}号按公开金水处理，票先看外面`,
            `今天先别从${seatId}号这张金水开票`,
            `${seatId}号金水先放好，重点看谁逆着结果打`,
          ]);
        }
      }
      return part;
    })
    .join("");
  return compactSpeech(protectedSpeech);
}

function publicUnchallengedGoldSeatIds(view: AgentView): Set<number> {
  const counterclaimSeatIds = new Set(
    view.publicSummary.tableMemory.counterclaims
      .filter((group) => group.claimedRole === "SEER")
      .flatMap((group) => group.claimants.map((claimant) => claimant.seatId)),
  );
  const seatIds = new Set<number>();
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimedRole !== "SEER" || counterclaimSeatIds.has(claim.claimant.seatId)) continue;
    for (const check of claim.checks) {
      if (check.result === "GOOD") seatIds.add(check.target.seatId);
    }
  }
  for (const seatId of deadSeerGoldSeatIds(view.publicSummary.tableMemory)) {
    seatIds.add(seatId);
  }
  return seatIds;
}

function pressuresSeatInMockSpeech(text: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*(?:号|號|seat|座|位)?`;
  return (
    new RegExp(`${seatPattern}[^。！？；，、]{0,28}(查杀|狼面|狼坑|悍跳|反打|不认|怀疑|焦点|抗推|归票|收票|出票|出人|出局|票口|票压|先压|硬踩|讲实|讲完整|补清楚|放进观察|挂疑问)`, "i").test(text) ||
    new RegExp(`(归票|收票|出票|出人|票口|票压|票型往|把票(?:型)?往|投给|压到|压向|先压|硬踩|不认|怀疑|焦点|观察位|放进观察|挂疑问)[^。！？；，、]{0,22}${seatPattern}`, "i").test(text)
  );
}

function isProtectiveGoldSpeechSegment(text: string): boolean {
  return /(金水|好人|先放|放一轮|不进|别进|不要进|不作为.*出人|不围绕|不直接打死|不把.*打死|不把票压|先不把票压|别乱出|别硬踩|无理由硬踩|保护|稳住|可信)/.test(text);
}

function createMockSpeech(view: AgentView, plan = createSpeechPlan(view)): string {
  const structuredSpeech = createStructuredMockSpeech(view, plan);
  if (structuredSpeech) return structuredSpeech;
  const persona = `${view.persona?.name ?? ""} ${view.persona?.label ?? "稳健型"}`.trim();
  const lastDeath = view.publicSummary.recentDeaths.at(-1);
  const target = plan.target;
  const targetName = target?.name ?? view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId)?.name ?? "场上玩家";
  const previousSpeech = view.publicSummary.recentSpeeches.at(-1);
  const previousSpeaker = previousSpeech?.speaker?.seatId === view.mySeatId ? undefined : previousSpeech?.speaker;
  const tallyText = publicTallyText(view);
  const opener = personaOpener(persona, view.mySeatId + view.day);
  const dynamicText = renderSpeechDynamicText(view, plan);
  const coreTalkingPoints = plan.talkingPoints.filter(
    (point) => point !== plan.interaction?.line && point !== plan.personaCue?.line,
  );
  const focusReason = coreTalkingPoints[0] ?? plan.talkingPoints[0] ?? "目前还缺少能落地的发言细节";
  const secondReason = coreTalkingPoints[1] ?? plan.talkingPoints[1] ?? "我会看后置位有没有补充过程";
  const talkingPointText = [dynamicText, ...coreTalkingPoints].filter(Boolean).join("。");
  const ordinaryLead = buildOrdinaryLiveIntentMockLead(view, plan, target);

  if (view.myRole === "SEER") {
    const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      if (plan.kind !== "claim-check" || plan.claimIntent?.claimedRole !== "SEER" || !plan.claimIntent.check) {
        return compactSpeech(`${opener}，我先不急着给死结论。${dynamicText ? `${dynamicText}。` : ""}${previousSpeaker ? `上一位 ${previousSpeaker.name} 的发言我会对照后面站边。` : ""}重点看谁回避昨夜信息和今天的焦点。`);
      }
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const checkedTarget = toTargetFromSeatId(view, latestCheck.targetSeatId);
      const checkFollowup =
        latestCheck.result === "GOOD"
          ? "我会看谁反打这张金水。"
          : "这条验人线我先压票口，外置位只给硬身份反证。";
      return compactSpeech(
        `${opener}，我跳预言家，${seatText(checkedTarget)}是${resultText}。${buildSeerCheckCondition(latestCheck.result, checkedTarget)}${dynamicText ? `${dynamicText}。` : ""}${checkFollowup}`,
      );
    }
    return compactSpeech(`${opener}，我先不急着给死结论。${dynamicText ? `${dynamicText}。` : ""}${previousSpeaker ? `上一位 ${previousSpeaker.name} 的发言我会对照后面站边。` : ""}重点看谁回避昨夜信息和今天的焦点。`);
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check) {
      const resultText = plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水";
      const counterText = plan.claimIntent.isCounterclaim ? "外置预言家我不认，" : "";
      const checkedTarget = toTargetFromSeatId(view, plan.claimIntent.check.targetSeatId);
      const talkingText =
        plan.claimIntent.check.result === "GOOD"
          ? "这张金水先不进今天出人池，后面看谁硬踩。"
          : talkingPointText || "这条查杀线先压出来，让外置位给反证。";
      return compactSpeech(
        `${opener}，我跳预言家，${seatText(checkedTarget)}是${resultText}。${counterText}${talkingText}。`,
      );
    }
    if (plan.kind === "rally" || plan.talkingPoints.some((point) => /我暂时认|我不完全认|今天先压/.test(point))) {
      return compactSpeech(`${opener}，${talkingPointText}。`);
    }
    const misdirect = pickBySeat(
      view.mySeatId + view.day,
      [
        `${targetName} 的发言缺少从信息到结论的过程，先压这里听反应。`,
        `我不认单点带队，但 ${targetName} 这个位置需要把视角讲完整。`,
        target && getPlanTargetSpeechStatus(view, plan, target) === "spoken"
          ? `${focusReason}，所以我今天先回看 ${targetName} 已经说过的逻辑。`
          : `${focusReason}，所以我今天更想听 ${targetName} 怎么补逻辑。`,
      ],
    );
    return compactSpeech(`${opener}，${ordinaryLead ?? "我按当前公开发言和票型走。"}${dynamicText ? `${dynamicText}。` : ""}${previousSpeaker ? `上一位 ${previousSpeaker.name} 没有把怀疑链讲透。` : ""}${misdirect}${tallyText}`);
  }

  if (view.myRole === "WITCH") {
    if (plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
      return compactSpeech(`${opener}，我拍女巫，今天票型别散。${dynamicText ? `${dynamicText}。` : ""}${talkingPointText || `${targetName} 先把站边理由说完整。`}`);
    }
    const potionTone = view.privateKnowledge.witch?.poisonAvailable ? "我会留意谁在强行带毒点" : "毒药信息已经没那么灵活";
    return compactSpeech(`${opener}，女巫牌先不急着跳。${dynamicText ? `${dynamicText}。` : ""}${lastDeath ? `死亡播报是：${lastDeath}` : "现在还没有足够死讯。"}${potionTone}，${targetName} 先给清楚站边原因。`);
  }

  if (view.myRole === "HUNTER") {
    if (plan.claimIntent?.claimedRole === "HUNTER" && plan.claimIntent.strength === "hard") {
      return compactSpeech(`${opener}，我拍猎人，今天不要分票。${dynamicText ? `${dynamicText}。` : ""}${talkingPointText || `${targetName} 如果只给结论，我会把票压过去。`}`);
    }
    return compactSpeech(`${opener}，我底牌不虚但不乱拍身份。${dynamicText ? `${dynamicText}。` : ""}${targetName} 如果只给结论不给过程，我会把票压过去。${previousSpeaker ? `也要回看 ${previousSpeaker.name} 有没有跟风。` : ""}`);
  }

  if (view.myRole === "KNIGHT") {
    if (plan.claimIntent?.claimedRole === "KNIGHT" && plan.claimIntent.strength === "hard") {
      return compactSpeech(`${opener}，我拍骑士，今天先把公开狼面说清楚。${dynamicText ? `${dynamicText}。` : ""}${talkingPointText || `${targetName} 如果解释不了，我会考虑决斗。`}`);
    }
    return compactSpeech(`${opener}，我底牌不虚但不急着交技能。${dynamicText ? `${dynamicText}。` : ""}${targetName} 的狼面必须从公开发言和票型坐实，证据不够我不会乱决斗。`);
  }

  if (view.myRole === "VILLAGER" && plan.claimIntent?.claimedRole === "WITCH") {
    return compactSpeech(`${opener}，我这里像女巫视角，狼夜里可以来试。${dynamicText ? `${dynamicText}。` : ""}${targetName} 先把发言逻辑补完整。`);
  }

  if (view.myRole === "VILLAGER" && plan.claimIntent?.claimedRole === "HUNTER") {
    return compactSpeech(`${opener}，我底牌不虚，狼夜里可以来试。${dynamicText ? `${dynamicText}。` : ""}${targetName} 先把发言逻辑补完整。`);
  }

  const stanceSentence = isStandaloneStance(focusReason) ? `${focusReason}。` : `${targetName} 需要解释${focusReason}。`;
  return compactSpeech(`${opener}，${ordinaryLead ?? "我是闭眼好人，只能按公开发言和死讯盘。"}${dynamicText ? `${dynamicText}。` : ""}${previousSpeaker ? `${previousSpeaker.name} 的发言先记一笔，` : ""}${stanceSentence}${tallyText || secondReason}`);
}

function renderSpeechDynamicText(view: AgentView, plan: SpeechPlan): string {
  const text = plan.interaction?.line ?? plan.personaCue?.line ?? "";
  if (!text) return "";
  const hasCurrentDaySpeech = view.publicSummary.recentSpeeches.some(
    (speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId,
  );
  if (!hasCurrentDaySpeech && /刚才|上一位|前面/.test(text)) return "";
  return text;
}

function personaOpener(persona: string, seed: number): string {
  if (persona.includes("DeepSeek")) {
    return pickBySeat(seed, ["按现在桌面看", "这轮我先不站死", "我把能听到的点摆一下"]);
  }
  if (persona.includes("Claude")) {
    return pickBySeat(seed, ["我先说听感", "这轮我先说票怎么放", "我先落一个边界"]);
  }
  if (persona.includes("GPT")) {
    return pickBySeat(seed, ["我先把态度说清", "我说一个不舒服的点", "我给一个暂时判断"]);
  }
  if (persona.includes("豆包")) {
    return pickBySeat(seed, ["我直接压节奏", "这个听感我先打出来", "我不想慢慢磨"]);
  }
  if (persona.includes("Mimo")) {
    return pickBySeat(seed, ["我先说听感", "我回看前后两轮", "我先说哪里别扭"]);
  }
  if (persona.includes("Gemini")) {
    return pickBySeat(seed, ["我先听两个点", "我不急着锁死", "前后说法先放桌面"]);
  }
  if (persona.includes("GLM")) {
    return pickBySeat(seed, ["我从结构上看", "这里我先轻记", "我先把桌面关系捋一下"]);
  }
  if (persona.includes("Kimi")) {
    return pickBySeat(seed, ["我按前后发言往回看", "前后关系先捋一下", "我回看前面的说法"]);
  }
  if (persona.includes("强势") || persona.includes("悍跳")) {
    return pickBySeat(seed, ["我直接说结论", "压力我先给出来", "这轮我不想打太散"]);
  }
  if (persona.includes("谨慎") || persona.includes("低调")) {
    return pickBySeat(seed, ["我保守一点", "我这里不站死边", "先把疑点拆开说"]);
  }
  if (persona.includes("细节")) {
    return pickBySeat(seed, ["我抓两个细节", "我按发言前后对照", "先校验这条逻辑链"]);
  }
  if (persona.includes("身份盘")) {
    return pickBySeat(seed, ["我先看公开身份说法", "先看这个身份怎么落票", "这轮看谁的身份说法最顺"]);
  }
  if (persona.includes("情绪")) {
    return pickBySeat(seed, ["我对刚才的语气有反应", "听感我先说", "这个节奏我有点不舒服"]);
  }
  return pickBySeat(seed, ["我给一个中性视角", "我按公开信息说", "先把这条逻辑摆出来"]);
}

function publicTallyText(view: AgentView): string {
  const tally = view.publicSummary.voteSnapshot.tally;
  if (!view.publicSummary.voteSnapshot.revealed || tally.length === 0) return "";
  return `上一轮公开票数是 ${tally.map((item) => `${item.target.name}${item.count}票`).join("、")}，这个结果要进今天的判断。`;
}

function isStandaloneStance(text: string): boolean {
  return /^(我不认|我暂时认|.+站边有变化|.+站边有变化，需要解释)/.test(text);
}

function pickBySeat(seed: number, options: string[]): string {
  return options[Math.abs(seed) % options.length] ?? options[0] ?? "";
}

function simpleTextHash(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return hash;
}

function pickUnusedMockLine(view: AgentView, seed: number, options: string[]): string {
  const usedText = mockReuseWindowText(view);
  const normalizedUsed = normalizeMockLineForReuse(usedText);
  const start = Math.abs(seed) % Math.max(1, options.length);
  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length] ?? options[0] ?? "";
    if (!normalizedUsed.includes(normalizeMockLineForReuse(option))) return option;
  }
  return options[start] ?? options[0] ?? "";
}

function mockReuseWindowText(view: AgentView): string {
  return [
    ...view.publicSummary.recentSpeeches.map((speech) => speech.message),
    ...view.publicSummary.tableMemory.seats.map((seat) => seat.lastSpeech ?? ""),
    ...view.publicSummary.tableMemory.speechInfluence.map((item) => item.summary),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeMockLineForReuse(text: string): string {
  return stripTerminalPunctuation(text)
    .replace(/[0-9一二三四五六七八九十两]+\s*号/g, "{seat}号")
    .replace(/(?:DeepSeek|Claude|Gemini|Kimi|Mimo|GPT|GLM|Human|豆包)\d*/gi, "{name}")
    .replace(/我先把/g, "我把")
    .replace(/[，。！？、,.!?;；:\s]+/g, "")
    .replace(/[\u4e00-\u9fa5A-Za-z0-9{}号]*\{seat\}号\{name\}这会儿被推到台前主要卡在[\u4e00-\u9fa5A-Za-z0-9{}号]+/g, "{pushedPressureFrame}");
}

function compactSpeech(speech: string): string {
  const clean = speech.replace(/\s+/g, " ").replace(/。。+/g, "。").trim();
  return compactSpeechToLimit(clean, AI_SPEECH_MAX_CHARS);
}

function compactMockSpeech(speech: string): string {
  const clean = limitRepeatedSeatLabels(polishMockSpeech(speech))
    .replace(/\s+/g, " ")
    .replace(/。。+/g, "。")
    .replace(/，我先我/g, "，我")
    .replace(/。我先我/g, "。我")
    .trim();
  return compactSpeechToLimit(limitSpeechSentences(dedupeSpeechSentences(clean), 4), AI_MOCK_SPEECH_MAX_CHARS);
}

function polishMockSpeech(speech: string): string {
  return speech
    .replace(/([^。！？；，]+)，依据是\1/g, "$1")
    .replace(/理由是：/g, "我认这个点，是因为")
    .replace(/依据是/g, "我没听明白的是")
    .replace(/我认的点是/g, "我没听明白的是")
    .replace(/，我认这个点，是因为/g, "，因为")
    .replace(/我认这个点，是因为(\d+号[^，。；]+)成为焦点是因为/g, "我认这里，是因为$1被")
    .replace(/我没听明白的是(\d+号[^，。；]+)成为焦点是因为/g, "我没听明白的是$1被")
    .replace(/我压他的点是：/g, "我打他的点是：")
    .replace(/我打他的点是：/g, "我打他的点是")
    .replace(/这个结论来自我的夜间查验，不是听感/g, "这是我昨晚验出来的，不是听感牌")
    .replace(/闭眼视角给个可改判断/g, "我先保留判断")
    .replace(/什么公开反证会让你改票/g, "今天票口怎么落")
    .replace(/给可改票条件/g, "说清今天怎么处理查杀或投票")
    .replace(/我先把能听到的点摆一下，不急着拍身份，先看发言链条/g, "我把能听到的点摆一下，枪牌不用抢着拍")
    .replace(/我会把发言顺序、票型和前后逻辑一起校验/g, "谁先把不确定说成确定，我会从那句反应往回听")
    .replace(/前置位先把(\d+号[^。]+?)放进观察位/g, "$1先挂观察")
    .replace(/后置位要改我就给更硬证据/g, "后置要改我票，就拿更硬的反证出来")
    .replace(/被被/g, "被")
    .replace(/(\d+号[^，。；]+)被处在身份对跳关系/g, "$1在身份对跳里")
    .replace(/(\d+号[^，。；]+)被回避站边/g, "$1回避站边")
    .replace(/我先按公开信息来，只按公开信息盘/g, "按现在桌面看，只按公开信息盘")
    .replace(/我先按公开信息来，不急着/g, "按现在桌面看，不急着")
    .replace(/我先把几个点合起来看，闭眼视角/g, "几个点合起来看，闭眼视角")
    .replace(/不靠一句话定人我/g, "不靠一句话定人。我")
    .replace(/有反证我会改(\d+号)/g, "有反证我会改。$1")
    .replace(/因为(\d+号[^。！？；]{0,20})我先暂放/g, "因为$1先暂放")
    .replace(/(看票和回应)(我(?:保留|主要|不会|这轮))/g, "$1。$2")
    .replace(/(下结论)(我(?:保留|主要|不会|这轮))/g, "$1。$2")
    .replace(/(照搬)(\d+号)/g, "$1。$2")
    .replace(/(直接定人)(\d+号)/g, "$1。$2")
    .replace(/，我先/g, "，我")
    .replace(/。我先/g, "。我");
}

function limitRepeatedSeatLabels(speech: string): string {
  const counts = new Map<string, number>();
  return speech.replace(/([1-9]\d?号(?:DeepSeek\d*|Claude|Gemini|Kimi|Mimo|GPT|GLM|Human|豆包))/g, (label: string) => {
    const count = counts.get(label) ?? 0;
    counts.set(label, count + 1);
    if (count === 0) return label;
    if (count === 1) return label.replace(/号.+$/, "号");
    return "他";
  });
}

function limitSpeechSentences(speech: string, maxSentences: number): string {
  const parts = speech.match(/[^。！？；]+[。！？；]?/g);
  if (!parts || parts.length <= maxSentences) return speech;
  return parts.slice(0, maxSentences).join("").replace(/[。！？；]?$/, "。");
}

function limitSpeechSentencesForPlan(
  speech: string,
  maxSentences: number,
  view?: AgentView,
  plan?: SpeechPlan,
): string {
  const parts = speech.match(/[^。！？；]+[。！？；]?/g);
  if (!parts || parts.length <= maxSentences) return speech;
  if (!view || !plan || view.roleCard?.theme !== "class-trial" || !isClassTrialHardInfoSpeech(view, plan)) {
    return limitSpeechSentences(speech, maxSentences);
  }

  const requiredIndexes = findClassTrialHardInfoSentenceIndexes(parts, plan);
  if (requiredIndexes.size === 0) return limitSpeechSentences(speech, maxSentences);

  const keptIndexes = new Set<number>(requiredIndexes);
  for (let index = 0; index < parts.length && keptIndexes.size < maxSentences; index += 1) {
    keptIndexes.add(index);
  }

  return [...keptIndexes]
    .sort((left, right) => left - right)
    .map((index) => parts[index])
    .join("")
    .replace(/[。！？；]?$/, "。");
}

function findClassTrialHardInfoSentenceIndexes(parts: string[], plan: SpeechPlan): Set<number> {
  const requiredIndexes = new Set<number>();
  const check = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check : undefined;
  if (!check) return requiredIndexes;

  for (const [index, part] of parts.entries()) {
    if (hasOwnSeerClaimSpeech(part, undefined)) requiredIndexes.add(index);
    if (containsCheckCue(part, check) || speechMentionsBlackCheck(part, check.targetSeatId)) requiredIndexes.add(index);
    if (hasSeerBlackCheckVoteBoundary(part, check.targetSeatId)) requiredIndexes.add(index);
  }
  return requiredIndexes;
}

function dedupeSpeechSentences(speech: string): string {
  const parts = speech.match(/[^。！？；]+[。！？；]?/g);
  if (!parts) return speech;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const key = stripTerminalPunctuation(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(part);
  }
  return kept.join("");
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

  throw new Error("OpenAI 响应中没有文本。");
}

function createLooseFallbackSpeech(view: AgentView, plan: SpeechPlan): string {
  if (view.roleCard?.theme === "class-trial") {
    return createClassTrialFallbackSpeech(view, plan);
  }

  const seed = view.mySeatId * 19 + view.day;
  const persona = `${view.persona?.name ?? ""} ${view.persona?.label ?? ""}`;
  const opener = personaOpener(persona, seed);
  const focus =
    plan.target ??
    view.publicSummary.tableMemory.focus.find((item) => item.seat.seatId !== view.mySeatId)?.seat ??
    view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId);
  const latestSpeech = [...currentDaySpeechItems(view)]
    .reverse()
    .find((speech) => speech.speaker && speech.speaker.seatId !== view.mySeatId);
  const latestSpeaker = latestSpeech?.speaker;
  const latestDeath = view.publicSummary.recentDeaths.at(-1);
  const currentDaySpeakers = currentDaySpokenSeats(view);
  const spokenFocus = focus && currentDaySpeakers.some((speaker) => speaker.seatId === focus.seatId) ? focus : undefined;
  const orderedFutureSeats =
    view.daySpeechOrder && view.daySpeechOrder.currentIndex >= 0
      ? view.daySpeechOrder.queue.slice(view.daySpeechOrder.currentIndex + 1)
      : undefined;
  const unspokenSeats =
    orderedFutureSeats && orderedFutureSeats.length > 0
      ? orderedFutureSeats
      : view.aliveSeats.filter(
          (seat) => seat.seatId !== view.mySeatId && !currentDaySpeakers.some((speaker) => speaker.seatId === seat.seatId),
        );
  const publicSeerClaims = view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === "SEER");
  const blackCheckOnMe = publicSeerClaims.find((claim) =>
    claim.checks.some((check) => check.target.seatId === view.mySeatId && check.result === "WEREWOLF"),
  );
  const latestPublicCheck = publicSeerClaims
    .flatMap((claim) => claim.checks.map((check) => ({ claim, check })))
    .at(-1);
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);
  const currentDeathShape = getCurrentDayDeathShape(view);
  const ordinarySpeechDirector = buildOrdinarySpeechDirector(view, plan, buildSpeechOrderContext(view));
  const plannedSeerClaimFallback = buildOrdinaryPlannedSeerClaimFallback(view, plan);
  if (plannedSeerClaimFallback) {
    return plannedSeerClaimFallback;
  }

  if (view.myRole === "SEER") {
      const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      if (plan.kind !== "claim-check" || plan.claimIntent?.claimedRole !== "SEER" || !plan.claimIntent.check) {
        return compactSpeech(`${opener}，我先不急着给死结论。${spokenFocus ? `我先盯${seatText(spokenFocus)}刚才那句，票先不压死。` : "这轮先留一个能回头验证的疑惑。"}`);
      }
      const target = toTargetFromSeatId(view, latestCheck.targetSeatId);
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const followup =
        latestCheck.result === "WEREWOLF"
          ? "今天我的票先压这条查杀；谁要保他，就公开和我的结果对撞。"
          : `${seatText(target)}先别进今天的出人焦点。`;
      return compactSpeech(`我这里先把验人说清楚：${seatText(target)}是${resultText}。${followup}`);
    }
  }

  if (blackCheckOnMe) {
    const claimant = blackCheckOnMe.claimant;
    const responseLine =
      isWolfRole(view.myRole, view.rules.wolfRoles)
        ? "我不接这个查杀，他一句话把我按死，我先说我哪里不接。"
        : "我不认这个查杀，他跳出来按死我，我先把不成立的地方说清。";
    const nextLine =
      unspokenSeats.length > 0
        ? `后面只需要接一个点：${seatText(claimant)}这张预言家牌可信度从哪里来。`
        : "现在先对照已经发过言的位置，看谁是在补逻辑、谁是在顺手跟票。";
    return compactSpeech(`${opener}，${seatText(claimant)}给我查杀，${responseLine}${nextLine}`);
  }

  if (ordinarySpeechDirector.currentPressure === "underQuestion") {
    return buildOrdinaryUnderQuestionFallback(view, ordinarySpeechDirector, latestSpeaker);
  }

  const plannedWitchClaimFallback = buildOrdinaryPlannedWitchClaimFallback(view, plan, focus);
  if (plannedWitchClaimFallback) {
    return plannedWitchClaimFallback;
  }

  if (view.myRole === "WITCH" && view.privateKnowledge.witch?.savedTarget) {
    return compactSpeech(
      deathShapeAlreadyDiscussed
        ? `${opener}，平安夜我不复读了。${spokenFocus ? `我先盯${seatText(spokenFocus)}刚才那句话，先不把票压死。` : "这轮我先不带票，听一圈再说。"}`
        : `昨晚平安夜这件事我先收住，不把药线讲死。${spokenFocus ? `我先盯${seatText(spokenFocus)}刚才那句话，先不把票压死。` : "这轮我先不带票，听一圈再说。"}`,
    );
  }

  if (!latestSpeaker && view.day <= 1) {
    if (currentDeathShape === "peaceful") {
      return compactSpeech("我现在信息少，平安夜先当背景。我先不压票，先听一圈。");
    }
    if (currentDeathShape === "death") {
      return compactSpeech(`${formatOrdinaryDeathShapeFallback(latestDeath)}我先不压票，听后面怎么说。`);
    }
    return compactSpeech("我现在信息少，先不急着定人。我先不压票，听一圈再说。");
  }

  const checkLine = latestPublicCheck ? buildOrdinaryPublicCheckFallbackLine(view, latestPublicCheck) : "";
  const tableLine = latestSpeaker
    ? pickBySeat(seed + 5, [
        `刚才${seatText(latestSpeaker)}这句话我先听到了，${describeSpeechGap(latestSpeech?.message ?? "")}。`,
        `上一位${seatText(latestSpeaker)}这个点我先不放大，${describeSpeechGap(latestSpeech?.message ?? "")}。`,
        `${seatText(latestSpeaker)}这里我先给个处理，${describeSpeechGap(latestSpeech?.message ?? "")}。`,
      ])
    : latestDeath
      ? currentDeathShape === "death"
        ? `${latestDeath}，狼刀成功，女巫没救；我只当背景，先不急着压票。`
        : currentDeathShape === "peaceful"
          ? `昨夜是平安夜，我先当背景，不拿这个直接定人。`
          : `昨夜死讯我先不展开，先不急着压票。`
      : "第一轮信息还没铺开，我先看谁的发言能真正落到位置。";
  const focusHasSpoken = focus ? hasCurrentDaySpeech(view, focus.seatId) : false;
  const focusIsLatestSpeaker = Boolean(focus && latestSpeaker && focus.seatId === latestSpeaker.seatId);
  const focusLine = focus
    ? focusIsLatestSpeaker
      ? ""
      : focusHasSpoken
      ? pickBySeat(seed + 3, [
          `${seatText(focus)}这里我听着有点别扭，先不投他。`,
          `${seatText(focus)}这里我先不跟着投，票先不压太死。`,
          `${seatText(focus)}这里我先不站死，今天先看大家票怎么落。`,
        ])
      : `${seatText(focus)}还没发言，我不提前评价。`
    : "我这票先不散，等后面有人把怀疑说具体再落。";
  const timelineLine = "";

  return compactSpeech(`${opener}。${checkLine}${tableLine}${focusLine}${timelineLine}`);
}

function buildOrdinaryPublicCheckFallbackLine(
  view: AgentView,
  latestPublicCheck: {
    claim: AgentView["publicSummary"]["claimBoard"][number];
    check: AgentView["publicSummary"]["claimBoard"][number]["checks"][number];
  },
): string {
  const claimant = seatText(latestPublicCheck.claim.claimant);
  const target = seatText(latestPublicCheck.check.target);
  const resultText = latestPublicCheck.check.result === "WEREWOLF" ? "查杀" : "金水";
  const seed = mockSpeechSeed(view, latestPublicCheck.check.target, 73);
  return pickUnusedMockLine(view, seed, [
    `${claimant}报${target}${resultText}，我先把这个结果放桌面，今天看有没有对跳和${target}怎么接。`,
    `${claimant}给出${target}${resultText}，我不急着复读站边，先听谁敢公开对撞这条结果。`,
    `${target}吃到${resultText}，我现在不替任何人结算；外置位要保或要压，都得给比这更硬的理由。`,
    `${claimant}这张身份先按公开声明处理，票口边界放在${target}和对跳反证上。`,
    `${resultText}已经摆出来了，我短水观望一下：没人对跳时，${target}必须正面接住。`,
    `这条${resultText}我先不机械跟票，我更想看谁借它省理由、谁愿意公开承担反对。`,
  ]);
}

function buildOrdinaryUnderQuestionFallback(
  view: AgentView,
  director: OrdinarySpeechDirector,
  challenger?: ActionTarget,
): string {
  const prefix = challenger && challenger.seatId !== view.mySeatId ? "刚才有人点到我，" : "";
  const tableText = director.tableObjects.join("\n");
  if (/平安夜|女巫用药|公开背景/.test(tableText)) {
    return compactSpeech(
      `${prefix}我先解释这个点：平安夜女巫用药是公开背景，不是我泄视角。今天我先不把票压死，看谁还拿这句话硬带。`,
    );
  }
  return compactSpeech(
    `${prefix}我先解释一句：我说的是公开听感，不是在报身份。今天我先不把票压死，谁要压我把依据说具体。`,
  );
}

function buildOrdinaryPlannedSeerClaimFallback(view: AgentView, plan: SpeechPlan): string | undefined {
  if (plan.claimIntent?.claimedRole !== "SEER" || !plan.claimIntent.check) return undefined;
  if (plan.claimIntent.strength !== "hard" && plan.speechMove !== "claim_black_check" && plan.speechMove !== "claim_gold_check") {
    return undefined;
  }
  const target =
    plan.target ??
    toTargetFromSeatId(view, plan.claimIntent.check.targetSeatId) ?? {
      seatId: plan.claimIntent.check.targetSeatId,
      name: "",
    };
  const resultText = plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水";
  const followup =
    plan.claimIntent.check.result === "WEREWOLF"
      ? `今天我的票先压${seatText(target)}。`
      : `${seatText(target)}今天先别进出人位。`;
  return compactSpeech(`我跳预言家，昨晚验了${seatText(target)}，${seatText(target)}是${resultText}。${followup}`);
}

function buildOrdinaryPlannedWitchClaimFallback(view: AgentView, plan: SpeechPlan, focus?: ActionTarget): string | undefined {
  if (view.myRole !== "WITCH") return undefined;
  if (plan.claimIntent?.claimedRole !== "WITCH" || plan.claimIntent.strength !== "hard") return undefined;
  const savedTarget = view.privateKnowledge.witch?.savedTarget;
  const saveTimeText = view.day <= 1 || view.privateKnowledge.witch?.antidoteUsedTonight ? "昨晚" : "首夜";
  const claimLine = savedTarget
    ? `我是女巫，${saveTimeText}救了${seatText(savedTarget)}，${seatText(savedTarget)}是银水。`
    : "我是女巫，药线我先明着报。";
  const focusLine = focus ? `${seatText(focus)}这个开场我先听着，今天票别散。` : "今天先别把票散开。";
  return compactSpeech(`${claimLine}${focusLine}`);
}

function createClassTrialFallbackSpeech(view: AgentView, plan: SpeechPlan): string {
  const roleCard = view.roleCard!;
  const latestSpeech = [...currentDaySpeechItems(view)]
    .reverse()
    .find((speech) => speech.speaker && speech.speaker.seatId !== view.mySeatId);
  const lens = getClassTrialCharacterLens(roleCard);
  if ((plan.speechMove === "claim_black_check" || plan.speechMove === "claim_gold_check") && plan.target) {
    const targetText = seatText(plan.target);
    const result = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check?.result ?? "WEREWOLF" : "WEREWOLF";
    const fallback = buildClassTrialBlackCheckClaimFallback(roleCard.id, targetText, result);
    const limits = resolveSpeechLimits(view);
    return compactSpeechToLimit(limitSpeechSentences(fallback, limits.maxSentences), limits.maxChars);
  }

  const blackCheckAgainstSelf = findPublicBlackCheckAgainstSelf(view);
  if (blackCheckAgainstSelf) {
    const claimantText = seatText(blackCheckAgainstSelf.claimant);
    const fallback = buildClassTrialBlackCheckAgainstSelfFallback(roleCard.id, claimantText);
    const limits = resolveSpeechLimits(view);
    return compactSpeechToLimit(limitSpeechSentences(fallback, limits.maxSentences), limits.maxChars);
  }

  const focus =
    plan.target ??
    latestSpeech?.speaker ??
    view.publicSummary.tableMemory.focus.find((item) => item.seat.seatId !== view.mySeatId)?.seat ??
    view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId);
  const focusText = focus ? seatText(focus) : "这个位置";
  const gap = latestSpeech ? describeSpeechGap(latestSpeech.message) : "公开证据还没有真正闭合";

  const identityFallback = buildClassTrialIdentityClaimFallback(view, plan, roleCard.id, focusText);
  if (identityFallback) {
    const limits = resolveSpeechLimits(view);
    return compactSpeechToLimit(limitSpeechSentences(identityFallback, limits.maxSentences), limits.maxChars);
  }

  const publicBlackCheck = findLatestPublicBlackCheck(view);
  const publicBlackCheckFallback =
    publicBlackCheck && publicBlackCheck.claimant.seatId !== view.mySeatId
      ? buildClassTrialPublicBlackCheckFallback(view, roleCard.id, publicBlackCheck)
      : undefined;
  if (publicBlackCheckFallback) {
    const limits = resolveSpeechLimits(view);
    return compactSpeechToLimit(limitSpeechSentences(publicBlackCheckFallback, limits.maxSentences), limits.maxChars);
  }

  if (lens && isLowInfoDayOneNoHardInfo(view) && !isClassTrialHardInfoSpeech(view, plan)) {
    return compactSpeechToLimit(
      limitSpeechSentences(buildClassTrialLowInfoFallbackSpeech(view, lens, latestSpeech), CLASS_TRIAL_FALLBACK_SPEECH_MAX_SENTENCES),
      CLASS_TRIAL_FALLBACK_SPEECH_MAX_CHARS,
    );
  }

  if (lens?.roleId === "fukawa" && !hasFukawaTogamiPublicTrigger(view)) {
    const fallback = `别笑，我不是在躲；${focusText}真正露出来的是${gap}，这才是我咬住的理由。`;
    const limits = resolveSpeechLimits(view);
    return compactSpeechToLimit(limitSpeechSentences(fallback, limits.maxSentences), limits.maxChars);
  }
  if (lens) {
    return compactSpeechToLimit(
      limitSpeechSentences(
        buildClassTrialLensFallbackSpeech(lens, {
          focusText,
          gap,
          includeDisplayName: false,
          seed: view.day * 100 + view.mySeatId + currentDaySpeechItems(view).length,
        }),
        CLASS_TRIAL_FALLBACK_SPEECH_MAX_SENTENCES,
      ),
      CLASS_TRIAL_FALLBACK_SPEECH_MAX_CHARS,
    );
  }

  return compactSpeechToLimit(
    limitSpeechSentences(
      view.day <= 1
        ? `${focusText}这段还有公开缺口：${gap}。`
        : `${focusText}这段还有公开缺口：${gap}。`,
      CLASS_TRIAL_FALLBACK_SPEECH_MAX_SENTENCES,
    ),
    CLASS_TRIAL_FALLBACK_SPEECH_MAX_CHARS,
  );
}

function buildClassTrialBlackCheckClaimFallback(roleId: string, targetText: string, result: "WEREWOLF" | "GOOD" = "WEREWOLF"): string {
  if (result === "GOOD") {
    switch (roleId) {
      case "naegi":
        return `我跳预言家，昨晚查验结果是${targetText}金水。这条结果先放桌面；今天别围绕这张金水出人，重点看谁无理由硬踩他。`;
      case "monokuma":
        return `噗，黑白该分出来了。我跳预言家，昨晚验出${targetText}金水。今天别把这张金水推上处刑台；谁急着反打他，就先把理由摆出来。`;
      case "enoshima":
        return `太有趣了，我跳预言家，昨晚验出${targetText}金水。舞台灯先照旁边；谁急着踩这张金水，那个反应才更绝望。`;
      case "celestia":
        return `我摊一张牌：预言家，昨晚验出${targetText}金水。这枚筹码先保下；今天不围绕他出人，看谁硬要逆着结果下注。`;
      default:
        return `我跳预言家，昨晚查验结果是${targetText}金水。今天先不围绕这张金水出人；谁要硬踩，就公开把理由讲清。`;
    }
  }
  switch (roleId) {
    case "naegi":
      return `我跳预言家，昨晚查验结果是${targetText}查杀。这句话很重，但今天不能绕开；我的票先压这里，谁要保查杀位，就公开和我的结果对撞。`;
    case "monokuma":
      return `噗，黑白该分出来了。我跳预言家，昨晚验出${targetText}查杀。今天票先压这里；谁要保这个查杀位，就上来和我的结果对撞。`;
    case "enoshima":
      return `太有趣了，我跳预言家，昨晚验出${targetText}查杀。舞台先照这里；谁想救这个查杀位，就把能对撞的证据摆出来。`;
    case "celestia":
      return `我摊一张牌：预言家，昨晚验出${targetText}查杀。今天这枚筹码先压这里；要救这个查杀位，请拿出能对撞的身份或证据。`;
    default:
      return `我跳预言家，昨晚查验结果是${targetText}查杀。今天我的票先压这里；谁要保查杀位，就公开和我的结果对撞。`;
  }
}

function buildClassTrialBlackCheckAgainstSelfFallback(roleId: string, claimantText: string): string {
  switch (roleId) {
    case "celestia":
      return `${claimantText}这枚筹码压到我身上？我不认。结果可以摆出来，但别替我结算；今天我先看谁跟注太急，谁只是借他的刀省解释成本。`;
    case "fukawa":
      return `我不认${claimantText}这条查杀；他一句话就想把我按死，我先说我哪里不接。今天别让他的结果替我把话说完。`;
    case "enoshima":
      return `哇，${claimantText}把查杀砸到我身上了？太有趣了，我不认。别急着替他鼓掌，先看谁借这刀把票推得最开心。`;
    case "monokuma":
      return `噗，${claimantText}给我贴黑牌？我不认。想审判我可以，先看谁跟着这把假锤子敲得最响。`;
    default:
      return `我不认${claimantText}这条查杀；他一句话就想把我按死，我先说我哪里不接。今天别让他的结果替我把话说完。`;
  }
}

function buildClassTrialIdentityClaimFallback(
  view: AgentView,
  plan: SpeechPlan,
  roleId: string,
  focusText: string,
): string | undefined {
  if (plan.speechMove !== "identity_claim" && !(plan.claimIntent?.strength === "hard" || plan.playMotive?.allowIdentityClaim)) {
    return undefined;
  }
  const claimedRole = plan.claimIntent?.claimedRole;
  if (!claimedRole) return undefined;

  if (claimedRole === "HUNTER") {
    if (roleId === "togami") {
      return `我拍猎人，枪在这里。${focusText}还没有达到能带队的标准；今天票别散，谁想让我改枪口，就拿出比这更硬的公开理由。`;
    }
    return `我拍猎人，底牌不虚。${focusText}这条线先别糊过去；今天票别散，谁要改我判断就拿公开理由来换。`;
  }

  if (claimedRole === "WITCH") {
    if (roleId === "kirigiri") {
      return `我拍女巫，药线我会按事实交代。${focusText}先别借身份空白带节奏；今天只看能被桌面核对的证词。`;
    }
    return `我拍女巫，药在我的事实边界里。${focusText}这条线先放桌面，别让身份空白替任何人脱身。`;
  }

  if (claimedRole === "SEER" && plan.target) {
    const result = plan.claimIntent?.check?.result ?? "WEREWOLF";
    return buildClassTrialBlackCheckClaimFallback(roleId, seatText(plan.target), result);
  }

  return undefined;
}

function buildClassTrialPublicBlackCheckFallback(
  view: AgentView,
  roleId: string,
  blackCheck: PublicBlackCheckContext,
): string {
  const claimantText = seatText(blackCheck.claimant);
  const checkedText = seatText(blackCheck.checked);
  const responseState = getPublicBlackCheckResponseState(view, blackCheck);

  if (responseState === "already_spoken_before_claim") {
    switch (roleId) {
      case "kirigiri":
        return `${claimantText}这条后置查杀先记下，但${checkedText}本轮已经说过，不能当场接刀。现在看谁认这条对跳、谁借它把票顺手改过去。`;
      case "fukawa":
        return `别笑，${checkedText}本轮已经过麦，接不了${claimantText}这刀。现在急着拿这条后置查杀压票的人，别想把责任塞给别人。`;
      case "monokuma":
        return `噗，${claimantText}后置砸查杀，${checkedText}本轮又接不了话。好玩的是外置位：谁立刻改站边，谁就先到审判灯下面。`;
      case "enoshima":
        return `太有趣了，${claimantText}把后置查杀砸出来，${checkedText}本轮已经没法回嘴。那我只看观众席，谁改站位改得最享受。`;
      case "celestia":
        return `${claimantText}这枚后置筹码已经落下，${checkedText}本轮不能再补牌。现在跟注太快的人，解释成本反而更高。`;
      case "togami":
        return `${claimantText}后置报${checkedText}查杀，不能假装${checkedText}还能当场自证。现在筛外置位，谁把这条后置查杀用得不达标，谁出列。`;
      case "tomori":
        return `${claimantText}和${checkedText}之间那一下断在发言顺序上。${checkedText}本轮已经接不上了；我现在听谁把这条后置压力拿得太顺。`;
      case "anon":
        return `等一下，${checkedText}本轮已经说过了，不能马上接${claimantText}这条查杀。现在别催他补话，我先看谁顺手改票。`;
      default:
        return `${claimantText}后置报${checkedText}查杀，${checkedText}本轮已经不能当场回应。先看谁认、谁救、谁借这条线改票。`;
    }
  }

  if (responseState === "unspoken") {
    switch (roleId) {
      case "kirigiri":
        return `${claimantText}的查杀先放桌面，我不替他加戏，也不替${checkedText}松绑。${checkedText}还没发言；轮到她时正面接，认不认、有没有对跳、谁急着救她。`;
      case "fukawa":
        return `别笑，我不是在保${claimantText}；${claimantText}报${checkedText}查杀这件事先放桌上。${checkedText}还没接之前，谁急着替她找台阶，我就先咬谁。`;
      case "monokuma":
        return `噗，查杀已经砸到${checkedText}头上了。她还没接呢，外置位谁急着给她铺台阶，谁就先站到审判灯下面。`;
      case "enoshima":
        return `哇，舞台开灯了。${claimantText}把查杀砸到${checkedText}身上，${checkedText}还没接；现在最有趣的是谁急着替她摆表情。`;
      case "celestia":
        return `${claimantText}把筹码压在${checkedText}身上，我先不替任何人结算。${checkedText}还没接注前，急着跟注或拆注的人更值得看。`;
      case "togami":
        return `${claimantText}报${checkedText}查杀，硬信息先合格。${checkedText}没接之前，外置位别拿空保留糊弄；谁想带队，先交出比这更硬的标准。`;
      case "tomori":
        return `我听到${claimantText}和${checkedText}之间那一下没接上。${checkedText}还没说话，先别把声音盖过去；我只等她接这条查杀。`;
      case "anon":
        return `等一下，这里气氛跑太快了。${claimantText}查杀${checkedText}先放在桌上，${checkedText}还没接前，我不跟着把票乱跑。`;
      default:
        return `${claimantText}的查杀先放桌面，${checkedText}还没正面接。现在先看谁救、谁对跳、谁急着把焦点改走。`;
    }
  }

  switch (roleId) {
    case "kirigiri":
      return `${claimantText}的查杀和${checkedText}的回应都在桌面上。现在不必重复问她认不认；我看谁借同一句话把票压得过顺，或者急着把焦点改走。`;
    case "fukawa":
      return `别笑，我刚才听完${checkedText}接杀了。别再把“认不认”丢给她当作业；谁顺手把票往她身上推又不担责，我就咬谁。`;
    case "monokuma":
      return `噗，${checkedText}已经接过这一刀了。还想复读查杀？没意思；我现在看谁跟票跟得最省力。`;
    case "enoshima":
      return `${checkedText}已经把查杀接到舞台中央了。接下来别重播同一句，我要看谁借她的反应偷偷换站位。`;
    case "celestia":
      return `${checkedText}已经接注了。现在这局赌的不是她认不认，而是谁跟注太快、谁拆注又舍不得付理由成本。`;
    case "togami":
      return `${checkedText}已经回应过查杀。重复逼她认不认没有价值；现在筛跟压者和救人者，谁的标准不达标谁出列。`;
    case "tomori":
      return `${checkedText}已经接过这条查杀了。我现在听的是后面谁的声音太顺，像把别人的压力直接拿来用。`;
    case "anon":
      return `等一下，${checkedText}已经接过查杀了。现在别绕回同一句话，我先看谁把票顺手往她身上一推。`;
    default:
      return `${checkedText}已经回应过查杀，现在别继续复读同一个问题。先看跟压者、救人者和改焦点的人。`;
  }
}

function getPublicBlackCheckResponseState(
  view: AgentView,
  blackCheck: PublicBlackCheckContext,
): "unspoken" | "already_spoken_before_claim" | "responded_after_claim" {
  const currentSpeeches = currentDaySpeechItems(view).filter((speech) => speech.speaker?.seatId === blackCheck.checked.seatId);
  if (currentSpeeches.length === 0) return "unspoken";
  const sourceSpeechSeq = blackCheck.sourceSpeechSeq;
  if (sourceSpeechSeq === undefined) return "responded_after_claim";
  return currentSpeeches.some((speech) => speech.seq > sourceSpeechSeq)
    ? "responded_after_claim"
    : "already_spoken_before_claim";
}

function buildClassTrialLowInfoFallbackSpeech(
  view: AgentView,
  lens: ClassTrialCharacterLens,
  latestSpeech: AgentView["publicSummary"]["recentSpeeches"][number] | undefined,
): string {
  const prefix = view.day <= 1 ? `${lens.displayName}。` : "";
  const latestText = latestSpeech?.speaker ? `${seatText(latestSpeech.speaker)}这句` : "这张低信息桌面";
  switch (lens.roleId) {
    case "naegi":
      return `${prefix}平安夜还没把答案交出来；我先把希望放在一个能共同验证的断点上：谁把不确定说成确定，谁就把依据说清楚。`;
    case "kirigiri":
      return `${prefix}平安夜只能当背景，空白部分是还没有共同核对点；我先只留这个断点。`;
    case "fukawa":
      return `${prefix}十神大人还坐在这张桌上，你们的空话就是在浪费时间；${latestText}我先盯着，看谁用含糊挡住公开逻辑。`;
    case "monokuma":
      return `${prefix}噗，信息少才好审判；谁把空话包装成安全发言，我就先盯谁。`;
    case "enoshima":
      return `${prefix}结构先摆出来：谁借平安夜的空白收益最大，谁就最像在伪装；绝望只是结论的甜点。`;
    case "celestia":
      return `${prefix}我先押一枚小筹码：谁借平安夜逃掉解释成本，谁就该付出理由。`;
    case "togami":
      return `${prefix}证据少也不是免考；我先划合格线，谁只给安全话术谁就不达标。`;
    case "tomori":
      return `${prefix}我只听到一个小小的不连贯；谁接平安夜时声音没接上，我先记住。`;
    case "anon":
      return `${prefix}先把气氛接住；谁和谁接话时关系链突然断掉，我就先看那个转折。`;
    default:
      return `${prefix}证据少也要有角色自己的公开动作；我先留一个能回头验证的断点。`;
  }
}

function fallbackSpeech(
  provider: string,
  view: AgentView,
  plan: SpeechPlan,
  error: string,
  rawOutput?: unknown,
  strictness: SpeechStrictness = readSpeechStrictness(),
): AiSpeechResult {
  const rawSpeech = createLooseFallbackSpeech(view, plan);
  const speech = view.roleCard?.theme === "class-trial" ? rawSpeech : compactSpeech(naturalizeOrdinarySpeechText(rawSpeech));
  const fallbackValidationErrors = validateRenderedSpeech(view, plan, speech, strictness);
  return {
    speech,
    provider,
    rawOutput,
    isFallback: true,
    error,
    validationErrors: fallbackValidationErrors.length > 0 ? fallbackValidationErrors : undefined,
  };
}

function normalizeSpeech(speech: string, view?: AgentView, plan?: SpeechPlan): string {
  const clean = repairDuplicatedWordSlipText(stripSpeechStageDirections(speech)).trim().replace(/\s+/g, " ");
  const limits = view && plan ? resolveSpeechLimits(view, plan) : { maxSentences: AI_SPEECH_MAX_SENTENCES, maxChars: AI_SPEECH_MAX_CHARS };
  const deduped = dedupeSpeechSentences(clean);
  return compactSpeechToLimit(limitSpeechSentencesForPlan(deduped, limits.maxSentences, view, plan), limits.maxChars);
}

function compactOverlongOrdinaryClassTrialSpeech(
  view: AgentView,
  plan: SpeechPlan,
  speech: string,
  validationErrors: string[],
): string | undefined {
  if (view.roleCard?.theme !== "class-trial") return undefined;
  if (isClassTrialHardInfoSpeech(view, plan)) return undefined;
  if (!validationErrors.includes("发言过于冗长或报告化")) return undefined;
  const compacted = compactSpeechToLimit(
    limitSpeechSentences(dedupeSpeechSentences(speech), CLASS_TRIAL_COMPACT_REPAIR_MAX_SENTENCES),
    CLASS_TRIAL_COMPACT_REPAIR_MAX_CHARS,
  );
  return compacted && compacted !== speech ? compacted : undefined;
}

function compactSpeechToLimit(speech: string, limit: number): string {
  if (speech.length <= limit) return repairDanglingSpeechEnding(speech);
  const head = speech.slice(0, limit);
  const sentenceEnd = Math.max(head.lastIndexOf("。"), head.lastIndexOf("！"), head.lastIndexOf("？"), head.lastIndexOf("；"));
  if (sentenceEnd >= Math.floor(limit * 0.55)) return repairDanglingSpeechEnding(head.slice(0, sentenceEnd + 1));
  const commaEnd = Math.max(head.lastIndexOf("，"), head.lastIndexOf("、"));
  if (commaEnd >= Math.floor(limit * 0.7)) return repairDanglingSpeechEnding(`${head.slice(0, commaEnd)}。`);
  return repairDanglingSpeechEnding(`${head.slice(0, Math.max(0, limit - 1))}。`);
}

function repairDanglingSpeechEnding(speech: string): string {
  const clean = speech.trim();
  const repaired = clean.replace(/[，,;；:：、-]+$/g, "").trim();
  return repaired && repaired !== clean ? `${repaired}。` : clean;
}

import { z } from "zod";
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
  AiFriendRuntimeLlmConfig,
  ClaimCheck,
  PublicReasoningCue,
  Role,
  SpeechPlan,
  TableMemory,
} from "@/game/types";
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
  formatPersonaStrategyForPrompt,
  type AdaptedPersonaStrategyCard,
  type AiOrdinaryLiveIntentState,
} from "./personaStrategyCards";
import type { AiSpeechProvider, AiSpeechProviderContext, AiSpeechResult } from "./types";

const SpeechSchema = z.object({
  speech: z.string().min(1),
});

const AI_SPEECH_MAX_CHARS = 520;
const AI_MOCK_SPEECH_MAX_CHARS = 380;
const AI_SPEECH_MAX_SENTENCES = 4;
const CLASS_TRIAL_COMPACT_REPAIR_MAX_CHARS = 360;
const CLASS_TRIAL_COMPACT_REPAIR_MAX_SENTENCES = 3;
const CLASS_TRIAL_FALLBACK_SPEECH_MAX_CHARS = 260;
const CLASS_TRIAL_FALLBACK_SPEECH_MAX_SENTENCES = 3;
const CLASS_TRIAL_HARD_INFO_SPEECH_MAX_CHARS = 760;
const CLASS_TRIAL_HARD_INFO_SPEECH_MAX_SENTENCES = 6;
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

export type SpeechStrictness = "strict" | "guided" | "loose";

type LlmSpeechContract = {
  move: Exclude<SpeechPlan["speechMove"], undefined>;
  target?: ActionTarget;
  targetSpeechStatus: Exclude<SpeechPlan["targetSpeechStatus"], undefined>;
  allowedInteraction: Exclude<SpeechPlan["allowedInteraction"], undefined>;
  mustSay: string[];
  mayAsk: string[];
  mustNotAsk: string[];
  voteBoundary?: string;
  maxSentences: number;
  maxChars: number;
};

export type OrdinarySpeechPressure =
  | "noInformation"
  | "respondToPrevious"
  | "underQuestion"
  | "publicRoleClaim"
  | "deathShape"
  | "voteBoundary";

export type OrdinarySpeechMove =
  | "waterPass"
  | "quoteOneLine"
  | "halfAccept"
  | "discomfort"
  | "followPressure"
  | "hold"
  | "defendSelf"
  | "clarifyMotive"
  | "counterQuestion"
  | "changeRead"
  | "roleHandle"
  | "voteBoundary";

export type OrdinarySpeechDirector = {
  currentPressure: OrdinarySpeechPressure;
  tableObjects: string[];
  allowedSpeechMoves: OrdinarySpeechMove[];
  recentSurfaceMoves: string[];
  playerVoiceCard: OrdinaryPlayerVoiceCard;
  selfHistory?: OrdinarySelfHistory;
  promptLines: string[];
};

type OrdinaryRepeatedPressureAxis = {
  target: ActionTarget;
  count: number;
  speakers: ActionTarget[];
};

export type OrdinaryPlayerVoiceCard = {
  label: string;
  traits: string[];
  mouthHabit: string;
  emotionTell: string;
  riskHabit: string;
  promptLines: string[];
};

export type OrdinarySelfHistory = {
  lastPublicSpeech?: string;
  lastSpeechTarget?: ActionTarget;
  lastSpeechStance?: string;
  lastVoteTarget?: ActionTarget;
  lastVoteReason?: string;
  promptLines: string[];
};

export type LlmSpeechInput = {
  day: number;
  mySeatId: number;
  myRole: Role;
  persona?: AgentView["persona"];
  characterRole?: NonNullable<AgentView["roleCard"]>;
  characterLens?: ClassTrialCharacterLens;
  classTrialLiveState?: ClassTrialLiveState;
  personaStrategyCard?: AdaptedPersonaStrategyCard;
  ordinaryLiveIntent?: AiOrdinaryLiveIntentState;
  ordinarySpeechDirector?: OrdinarySpeechDirector;
  aliveSeats: ActionTarget[];
  tableBriefing: {
    text: string;
    speechProgress: {
      currentSpeaker: ActionTarget;
      spokenSeatIds: number[];
      unspokenSeatIds: number[];
      spokenCount: number;
      aliveCount: number;
    };
    publicBoundary: string[];
    privateBoundary: string[];
    publicFacts: string[];
    privateFacts: string[];
    unknowns: string[];
    legalSpeechFocus: string[];
    publicReasoningCues: string[];
  };
  publicContext: {
    rules: {
      sheriffEnabled: boolean;
      note: string;
      deathInfoNote: string;
      speechTimelineNote: string;
      unavailableTerms: string[];
    };
    recentSpeeches: AgentView["publicSummary"]["recentSpeeches"];
    voteSnapshot: AgentView["publicSummary"]["voteSnapshot"];
    recentDeaths: string[];
    claimBoard: AgentView["publicSummary"]["claimBoard"];
    speechOrder: {
      currentSpeaker: ActionTarget;
      todaySpeechOrder: ActionTarget[];
      currentSpeakerOrderIndex: number;
      speakersAlreadyFinished: ActionTarget[];
      currentDaySpokenSeats: ActionTarget[];
      currentDayUnspokenSeats: ActionTarget[];
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
      | "deathAnnouncements"
      | "publicSignals"
    >;
  };
  privateContext: {
    role: Role;
    aiMemory?: AgentView["privateKnowledge"]["aiMemory"];
    seerChecks?: Array<{
      day: number;
      target: ActionTarget;
      result: ClaimCheck["result"];
    }>;
    witch?: {
      antidoteAvailable: boolean;
      poisonAvailable: boolean;
      currentVictim?: ActionTarget;
      savedTarget?: ActionTarget;
      poisonedTarget?: ActionTarget;
      antidoteUsedTonight?: boolean;
      poisonUsedTonight?: boolean;
    };
    wolfSpeechAssignment?: {
      taskLabel: string;
      target?: ActionTarget;
      supportSeat?: ActionTarget;
      publicInstruction: string;
      nightInstruction?: string;
    };
  };
  expertStrategy: string[];
  advancedReasoning: string[];
  inferenceLayers: PublicInferenceLayers;
  reasoningFrame: AiReasoningFrame;
  rolePlaybook: AiRolePlaybook;
  claimAudit: AiClaimAudit;
  debateAgenda: AiDebateAgenda;
  playerSpeechGuide: {
    tablePlayerStyle: string[];
    modelStyle: {
      modelName: string;
      softTendency: string;
      tendencies: string[];
    };
    tableTask?: NonNullable<SpeechPlan["tableTask"]>;
    softInteraction: string[];
    avoid: string[];
  };
  speechContract: LlmSpeechContract;
  speechPlan?: SpeechPlan;
  speechStrictness: SpeechStrictness;
  constraints?: string[];
  llmConfig?: AiFriendRuntimeLlmConfig;
  stability?: LlmOutputStabilityHint;
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

function splitSpeechValidationErrors(
  view: AgentView,
  errors: string[],
): { hard: string[]; soft: string[] } {
  if (view.roleCard?.theme === "class-trial") return { hard: errors, soft: [] };
  const soft = errors.filter(isOrdinarySoftSpeechValidationError);
  return {
    hard: errors.filter((error) => !isOrdinarySoftSpeechValidationError(error)),
    soft,
  };
}

function isOrdinarySoftSpeechValidationError(error: string): boolean {
  return (
    /^(?:普通局(?:发言不要像全桌复盘|发言黑话堆叠|发言不要套兜底模板链|不要把内部审稿词说出口|后置位不要复读同一发言缺口|不要连续围绕同一句做同质审计|不要用卡句式口癖|不要连续复读卡句式|强身份不要用审判腔|不要复刻前置位低信息开场|首置位不要用审稿元话术开场|首置位不要设置未来观察点|低信息首置位不要点名后置位布置任务|低信息不要跳过下一位直接布置后置任务|低信息首置位划水不应成为主要攻击点|短发言必须有自己的处理动作|不要复制前置位整段表述|认同一半必须说清落点|改口必须说清新判断|发言疑似被截断|不要用后置链路审计当前已过发言|发言不要出现重复口误|当前位不要把已过的后置反应说成还要看|不要用观察位模板继续等后面接线|不要重复追问已经给过的依据)|要求已发言的\d+号后续补充发言|speechContract要求只回看\d+号已发表内容|speechContract要求只能等待\d+号后续发言|把本轮未发言的\d+号当成已发言评价|提前评价未发言的\d+号站边或可信度)$/.test(
      error,
    )
  );
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

function buildSpeechContract(
  plan: SpeechPlan,
  speechOrder?: LlmSpeechInput["publicContext"]["speechOrder"],
  view?: AgentView,
): LlmSpeechContract {
  const move = resolveContractMove(plan);
  const isClassTrialSpeech = view?.roleCard?.theme === "class-trial";
  const limits = resolveSpeechLimits(view, plan);
  const isHardInfoSpeech = isClassTrialHardInfoSpeech(view, plan, move);
  const isOrdinaryLowInfoFirstSeat = isOrdinaryLowInfoFirstSeatWaterPass(view, plan, move);
  const targetSpeechStatus = plan.targetSpeechStatus ?? "none";
  const allowedInteraction = plan.allowedInteraction ?? "none";
  const targetLabel = plan.target ? seatText(plan.target) : "目标位";
  const talkingPoints = contractTalkingPoints(plan);
  const mustSay: string[] = [];
  const mayAsk: string[] = [];
  const mustNotAsk: string[] = [
    "不能列第一、第二、第三，也不要说“盘问议程”“票口条件”“可改票条件”。",
  ];
  const lowInfoNoHardInfoContractLine =
    "首日无硬信息阶段不要把任何已发言位“没站边、没给票口、没给怀疑对象”当攻击点；只能审计观察点是否有收益、谁在跟压或谁过早定身份。";
  let voteBoundary: string | undefined;

  if (isClassTrialSpeech) {
    mustNotAsk.push(
      view.day >= 2
        ? "第一天早上的自我介绍已经结束；不要再自我介绍，不要用“我是角色名/座位名”开头。"
        : "学级裁判自我介绍只允许第一天早上自然一次；不要每轮重复“我是角色名/座位名”。",
      "学级裁判发言不要套“身份-信息-站边-票口”四件套；禁止“我是闭眼好人”“信息不多先听后置”等普通狼人杀模板开场。",
    );
    if (view.day === 1 && !isHardInfoSpeech && hasPublicSeerCheck(view)) {
      mustNotAsk.push(
        "D1已有预言家报验后，不要追问或攻击首验理由；一张金水或查杀是正常首夜查验量。",
        "报金水后，金水天然暂不进出人焦点；不要把报验者正常放下金水说成提前保护或额外设防。",
        "平安夜和女巫用药只可短句带过，不能当主要攻击点或完整发言。",
      );
    }
  }

  if (targetSpeechStatus === "spoken" && plan.target) {
    mustNotAsk.push(`不能要求${targetLabel}后续补充、轮到时回应、后面解释、当场回答、再跳身份或再报查验。`);
  }
  if (targetSpeechStatus === "unspoken" && plan.target) {
    mustNotAsk.push(`不能评价${targetLabel}已经回应差、信息少、没站边或只给结论。`);
  }
  if (speechOrder?.speakersAlreadyFinished.length) {
    mustNotAsk.push(
      `已经发言的前置位包括${formatSeatNumberList(
        speechOrder.speakersAlreadyFinished,
      )}，这些位置本轮不会再轮到；只能回看原话，不能要求他们后续补充、轮到时回应、后面解释、当场回答、再跳身份或再报查验。`,
    );
  }
  if (speechOrder?.currentDayUnspokenSeats.length) {
    const nextUnspoken = speechOrder.currentDayUnspokenSeats[0];
    mustNotAsk.push(
      `未发言后置位按今日顺序是${formatSeatNumberList(
        speechOrder.currentDayUnspokenSeats,
      )}；如果只是留观察，默认不点具体后置位；如果确实要问人，优先只问“下一位${seatText(
        nextUnspoken,
      )}”一个具体问题；连续点多个后置位时按今日顺序连续，不要无理由跳过中间座位；不要把已发言位置写成“等他轮到”或“后面再补”；除非已有公开查验/身份声明，不能提前说更信、更疑、放好、狼坑、票口、焦点、先压或收票。`,
    );
  }
  if (view && !isHardInfoSpeech && isLowInfoDayOneOpening(view)) {
    const openingSpeaker = currentDaySpeechItems(view)[0]?.speaker;
    if (openingSpeaker) {
      mustNotAsk.push(`不要把${seatText(openingSpeaker)}没站边、没给票口或没给怀疑对象当攻击点；只能评价观察点是否过泛，或审计后续谁借这个点做收益。`);
      mustNotAsk.push(lowInfoNoHardInfoContractLine);
    } else {
      mustNotAsk.push("你是低信息首置位：只给自己的当前处理，默认不点名任何后置位，不要求下一位或远后置位立刻站边、给票口、报怀疑对象，也不要补“等后面看谁”的未来标准。");
    }
  }
  if (
    view &&
    !isHardInfoSpeech &&
    isLowInfoDayOneNoHardInfo(view) &&
    currentDaySpeechItems(view).length > 0 &&
    !mustNotAsk.includes(lowInfoNoHardInfoContractLine)
  ) {
    mustNotAsk.push(lowInfoNoHardInfoContractLine);
  }
  if (plan.claimIntent?.strength === "soft" && !plan.playMotive?.allowIdentityClaim) {
    const roleLabel = ROLE_LABELS[plan.claimIntent.claimedRole];
    mustNotAsk.push(`不要把软身份边界说成明确${roleLabel}身份。`);
    mayAsk.push(plan.playMotive?.line ?? "可以保留底牌威慑，但不要明拍身份。");
  }

  if (isOrdinaryLowInfoFirstSeat) {
    mustSay.length = 0;
    mayAsk.length = 0;
    mustSay.push("只说自己当前处理：信息少，先听一圈、暂放或不压票。");
    return {
      move,
      target: plan.target,
      targetSpeechStatus,
      allowedInteraction,
      mustSay: uniqueContractLines(mustSay).slice(0, 3),
      mayAsk: [],
      mustNotAsk: uniqueContractLines(mustNotAsk).slice(0, 6),
      voteBoundary,
      maxSentences: limits.maxSentences,
      maxChars: limits.maxChars,
    };
  }

  switch (move) {
    case "review_spoken_target":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints : [`回看${targetLabel}已经发表的公开内容。`]));
      mayAsk.push(`只能回看${targetLabel}已发表的内容是否闭合。`);
      break;
    case "ask_unspoken_target":
      mustSay.push(...talkingPoints.slice(0, 1));
      mayAsk.push(`可以要求${targetLabel}轮到时只回应一个具体公开点。`);
      break;
    case "claim_black_check":
      if (isClassTrialSpeech) {
        mustSay.push(
          `我是预言家，昨晚查验结果是${targetLabel}查杀。`,
          `今天我的票先压${targetLabel}。`,
          `谁要保${targetLabel}，就公开和我的结果对撞。`,
        );
      } else {
        mustSay.push("我是预言家。", `${targetLabel}是查杀。`, `今天票口先压${targetLabel}。`);
      }
      mayAsk.push(isClassTrialSpeech ? "谁要保查杀位，就公开和我的结果对撞。" : "外置位只给硬身份反证。");
      if (isClassTrialSpeech && view?.day === 1) {
        mustNotAsk.unshift("D1不要要求预言家解释首验理由；身份、查杀结果和今天如何处理查杀位足够。");
        mustNotAsk.unshift("平安夜只作公开背景，不能用它解释为什么要压查杀位。");
      }
      mustNotAsk.push(
        `不能说${targetLabel}解释闭环就改票。`,
        `不能把${targetLabel}自证当改票条件。`,
      );
      voteBoundary = isClassTrialSpeech
        ? `今天我的票先压住${targetLabel}这条查杀；谁要保查杀位，就公开和我的结果对撞。`
        : `今天先压${targetLabel}；只有外置更硬身份信息能改变结构。`;
      break;
    case "claim_gold_check":
      mustSay.push("我是预言家。", `${targetLabel}是金水。`);
      mayAsk.push(`看谁反打或硬踩${targetLabel}。`);
      mustNotAsk.push(`不能把${targetLabel}作为今天出人焦点、怀疑焦点或压票对象。`);
      break;
    case "identity_claim":
      if (isClassTrialSpeech && plan.claimIntent?.claimedRole === "HUNTER" && plan.claimIntent.strength === "hard") {
        mustSay.push("我拍猎人，枪在这里。");
      } else if (isClassTrialSpeech && plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
        mustSay.push("我拍女巫，药线由我来收。");
      } else {
        mustSay.push(plan.claimIntent ? `身份声明要与${ROLE_LABELS[plan.claimIntent.claimedRole]}一致。` : "身份声明必须和当前计划一致。");
      }
      if (plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
        const savedTarget = view?.myRole === "WITCH" ? view.privateKnowledge.witch?.savedTarget : undefined;
        if (savedTarget) mustSay.push(`平安夜我救了${savedTarget.seatId}号，${savedTarget.seatId}号是银水。`);
      }
      if (plan.playMotive?.line) mustSay.push(plan.playMotive.line);
      mayAsk.push(...(plan.target ? [`围绕${targetLabel}留下一个公开验证点。`] : ["围绕公开身份说法留下一个验证点。"]));
      break;
    case "lock_vote":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints : [`今天票口先围绕${targetLabel}。`]));
      voteBoundary = plan.target ? `票口优先压${targetLabel}，理由必须来自公开信息。` : undefined;
      break;
    case "explain_vote":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints : ["解释自己的站边或票口变化。"]));
      mayAsk.push("只留一个后续验证点。");
      break;
    case "soft_pressure":
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints.slice(0, 2) : [`回看${targetLabel}已经说出口的内容。`]));
      mayAsk.push(plan.target ? `围绕${targetLabel}留一个公开验证点。` : "围绕公开发言留一个验证点。");
      break;
    default:
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints.slice(0, 2) : ["只按公开信息给一条判断。"]));
      mayAsk.push("不强行制造目标，只留下公开验证点。");
      break;
  }

  return {
    move,
    target: plan.target,
    targetSpeechStatus,
    allowedInteraction,
    mustSay: uniqueContractLines(mustSay).slice(0, 3),
    mayAsk: uniqueContractLines(mayAsk).slice(0, 2),
    mustNotAsk: uniqueContractLines(mustNotAsk).slice(0, 6),
    voteBoundary,
    maxSentences: limits.maxSentences,
    maxChars: limits.maxChars,
  };
}

function resolveSpeechLimits(
  view: AgentView | undefined,
  plan?: SpeechPlan,
): Pick<LlmSpeechContract, "maxSentences" | "maxChars"> {
  if (view?.roleCard?.theme !== "class-trial") {
    if (isOrdinaryLowInfoFirstSeatWaterPass(view, plan)) {
      return { maxSentences: 2, maxChars: 90 };
    }
    return { maxSentences: AI_SPEECH_MAX_SENTENCES, maxChars: AI_SPEECH_MAX_CHARS };
  }
  return {
    maxSentences: CLASS_TRIAL_HARD_INFO_SPEECH_MAX_SENTENCES,
    maxChars: CLASS_TRIAL_HARD_INFO_SPEECH_MAX_CHARS,
  };
}

function isOrdinaryLowInfoFirstSeatWaterPass(
  view: AgentView | undefined,
  plan?: SpeechPlan,
  move: LlmSpeechContract["move"] | undefined = plan ? resolveContractMove(plan) : undefined,
): boolean {
  if (!view) return false;
  if (view.roleCard?.theme === "class-trial") return false;
  if (view.day !== 1) return false;
  if (!isLowInfoDayOneNoHardInfo(view)) return false;
  if (currentDaySpeechItems(view).length > 0) return false;
  if (getCurrentDayDeathShape(view) === "death") return false;
  if (move && move !== "none") return false;
  if (plan?.claimIntent?.strength === "hard" || plan?.playMotive?.allowIdentityClaim) return false;
  if (plan?.speechMove === "identity_claim") return false;
  return true;
}

function isClassTrialHardInfoSpeech(
  view: AgentView | undefined,
  plan: SpeechPlan,
  move: LlmSpeechContract["move"] = resolveContractMove(plan),
): boolean {
  if (view?.roleCard?.theme !== "class-trial") return false;
  if (move === "claim_black_check" || move === "claim_gold_check" || move === "identity_claim") return true;
  if (plan.claimIntent?.strength === "hard") return true;
  return Boolean(findPublicBlackCheckAgainstSelf(view));
}

function findPublicBlackCheckAgainstSelf(view: AgentView | undefined): { claimant: ActionTarget; day: number } | undefined {
  if (!view) return undefined;
  for (const claim of view.publicSummary.claimBoard) {
    if (claim.claimedRole !== "SEER") continue;
    const check = claim.checks.find((item) => item.target.seatId === view.mySeatId && item.result === "WEREWOLF");
    if (check) return { claimant: claim.claimant, day: check.day };
  }
  const selfMemory = view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === view.mySeatId);
  const directCheck = selfMemory?.claimedByChecks.find((check) => check.result === "WEREWOLF");
  return directCheck ? { claimant: directCheck.claimant, day: directCheck.day } : undefined;
}

type PublicBlackCheckContext = {
  claimant: ActionTarget;
  checked: ActionTarget;
  day: number;
  sourceSpeechSeq?: number;
};

function findLatestPublicBlackCheck(view: AgentView | undefined): PublicBlackCheckContext | undefined {
  if (!view) return undefined;
  let latest: PublicBlackCheckContext | undefined;
  const consider = (item: PublicBlackCheckContext) => {
    const itemRank = item.day * 100000 + (item.sourceSpeechSeq ?? 0);
    const latestRank = latest ? latest.day * 100000 + (latest.sourceSpeechSeq ?? 0) : -1;
    if (!latest || itemRank >= latestRank) latest = item;
  };

  for (const claim of [...view.publicSummary.claimBoard, ...view.publicSummary.tableMemory.claimBoard]) {
    if (claim.claimedRole !== "SEER") continue;
    for (const check of claim.checks) {
      if (check.result !== "WEREWOLF") continue;
      consider({
        claimant: claim.claimant,
        checked: check.target,
        day: check.day,
        sourceSpeechSeq: claim.sourceSpeechSeq,
      });
    }
  }

  for (const seat of view.publicSummary.tableMemory.seats) {
    for (const check of seat.claimedByChecks) {
      if (check.result !== "WEREWOLF") continue;
      consider({
        claimant: check.claimant,
        checked: { seatId: seat.seatId, name: seat.name },
        day: check.day,
      });
    }
  }

  return latest;
}

function resolveContractMove(plan: SpeechPlan): LlmSpeechContract["move"] {
  if (plan.speechMove) return plan.speechMove;
  if (plan.allowedInteraction === "finalize_black_check") return "claim_black_check";
  if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check?.result === "GOOD") return "claim_gold_check";
  if (plan.claimIntent && (plan.claimIntent.strength === "hard" || plan.playMotive?.allowIdentityClaim)) return "identity_claim";
  if (plan.kind === "rally") return "lock_vote";
  if (plan.allowedInteraction === "review_spoken") return "review_spoken_target";
  if (plan.allowedInteraction === "ask_future") return "ask_unspoken_target";
  if (plan.kind === "defend" || plan.kind === "explain-vote") return "explain_vote";
  if (plan.target) return "soft_pressure";
  return "none";
}

function contractTalkingPoints(plan: SpeechPlan): string[] {
  return plan.talkingPoints
    .filter((point) => point !== plan.interaction?.line && point !== plan.personaCue?.line)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function uniqueContractLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function buildSpeechRulesContext(view: AgentView): LlmSpeechInput["publicContext"]["rules"] {
  const unavailableTerms = view.privateKnowledge.sheriff ? [] : ["警上", "警下", "警徽", "警长"];
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);
  const deathShape = getCurrentDayDeathShape(view);
  return {
    sheriffEnabled: Boolean(view.privateKnowledge.sheriff),
    note: view.privateKnowledge.sheriff
      ? "本局启用警长竞选、警徽和警下投票；警长白天放逐投票计 1.5 票。"
      : "本局没有警长竞选、警徽、警上、警下流程。",
    deathInfoNote: buildDeathInfoNote(deathShape, deathShapeAlreadyDiscussed),
    speechTimelineNote:
      "本日发言有先后顺序。只能评价已经发过言的玩家；已经发过言的人不能被要求后续补充、轮到时回应或后面解释；尚未发言的后置位只能被点一个具体问题，不能说他们已经信息少、没站边或没回应，也不要把追问铺成一圈通用作业。",
    unavailableTerms,
  };
}

function withSpeechStabilityHint(
  input: LlmSpeechInput,
  attempt: number,
  previousIssue: string,
  previousOutput: string | undefined,
): LlmSpeechInput {
  if (attempt <= 1) return input;
  return {
    ...input,
    stability: {
      attempt,
      previousIssue,
      previousOutput: trimLlmOutputForRetry(previousOutput),
      expectedFormat: "{\"speech\":\"你的公开发言\"}",
      repairInstructions: buildSpeechRepairInstructions(input, previousIssue),
      speechContract: {
        move: input.speechContract.move,
        target: input.speechContract.target,
        mustSay: input.speechContract.mustSay,
        mayAsk: input.speechContract.mayAsk,
        mustNotAsk: input.speechContract.mustNotAsk,
        voteBoundary: input.speechContract.voteBoundary,
      },
    },
  };
}

function buildSpeechRepairInstructions(input: LlmSpeechInput, previousIssue = ""): string[] {
  const contract = input.speechContract;
  const targetText = contract.target ? seatText(contract.target) : "无目标";
  const lines = [
    `必须执行 speechContract.move=${contract.move}，不要改成其他发言动作。`,
    `目标=${targetText}；targetSpeechStatus=${contract.targetSpeechStatus}；allowedInteraction=${contract.allowedInteraction}。`,
  ];
  if (input.characterRole?.theme === "class-trial") {
    const displayName = input.characterLens?.displayName ?? input.characterRole.displayName;
    lines.push(
      `学级裁判角色修复：保留${displayName}的临场判断和角色语气，让 LLM 自由发挥；只修掉 previousIssue 指出的越界点，不要改成模板兜底句。`,
      "删除内部审计词；换成角色能说出口的一句具体压力、保留或验证条件。",
    );
    if (/D1首验理由不是主要攻击点/.test(previousIssue)) {
      lines.push(
        "修复D1查杀回应错误：不要围绕夜间选人过程发问或攻击。改成看查杀位如何回应、有没有预言家对跳、这条查杀今天怎么处理，或谁公开和结果对撞。",
        "首验理由相关词整句删除，连“先不追这个”也不要说；只看查杀位回应、有没有对跳、谁救或改焦点。",
      );
    }
    if (/平安夜女巫用药不能作为完整发言/.test(previousIssue)) {
      lines.push(
        "修复平安夜完整发言：不要把平安夜、女巫用药、药瓶、无人倒牌写成一整段；最多一句背景后立刻转到公开发言里没说清的地方。",
        "如果同时踩到首验理由和平安夜，整段重写为：接住查杀结果，只看查杀位怎么回应、谁救人、谁改焦点；不要再复用上一轮原文。",
      );
    }
    if (/D1首跳查杀未对跳前不要反压预言家/.test(previousIssue)) {
      lines.push(
        "修复雾切早期查杀反应：不要评价首跳预言家票压太死、查杀站不站得住或自己跟不跟。把查杀暂作桌面硬信息，点被查杀位正面接，再观察对跳、救人和改焦点的人。",
        "句子里不要对苗木诚说“为什么”“你急着”“封死”“归死”“不替你封死”。问题只留给查杀位、后续对跳者、救人者或改焦点者。",
      );
    }
    if (/被查杀位回应不要复述平安夜/.test(previousIssue)) {
      lines.push("修复被查杀回应：删掉平安夜、女巫用药、药线背景；只回应谁报你查杀、你为什么不认、你今天怎么反打或活下来。");
    }
    if (/D1平安夜只能作背景，不当主要疑点或查杀依据/.test(previousIssue)) {
      lines.push("修复平安夜攻击轴：整段删掉平安夜、女巫用药、药瓶、安全网；改审对跳时机、谁接话太顺、谁替查杀位改焦点，或本角色自己的舞台/标准/下注/声音动作。");
    }
    if (/学级裁判后置位不要复盘整条查杀流水账/.test(previousIssue)) {
      lines.push(
        "修复后置流水账：不要按顺序复盘平安夜、苗木、雾切、腐川、黑白熊；开头直接点一个目标，用角色自己的下注、标准、声音或关系压力推进。",
        "最多点两个座位或名字；不要写“从1号开始/后面三个人/2号、4号、7号、8号”这种名单式复盘。",
      );
    }
    if (/学级裁判后置位不要复读首跳查杀轴/.test(previousIssue)) {
      lines.push(
        "修复后置复读：不要再从“首置位跳预言家报查杀/查杀接法”开头。直接抓刚才跟压者、救人者、改焦点者，或用角色自己的欲望制造一个新压力点。",
      );
    }
    if (/学级裁判后置位不要继续追同一个查杀位自证问题/.test(previousIssue)) {
      lines.push(
        "修复连续追问：同一个查杀位已经被多人追问怎么自证/跳身份了；这轮改打跟压者、救人者、改焦点者，或指出谁在用同一个问题制造票压。",
      );
    }
    if (/学级裁判后置位不要连续追同一个跟压者/.test(previousIssue)) {
      lines.push(
        "修复连续转靶：同一个跟压者已经被多人追过同一处标准/看戏/两头站问题；这轮改审上一位为什么还在复读，或换到另一个救人、跟注、改焦点的人。",
      );
    }
    if (/学级裁判后置位不要复制前置发言句式/.test(previousIssue)) {
      lines.push(
        "修复复制句式：不要沿用前一位的问法、三连问、比喻或句子骨架。保留同一局势也必须换成本角色动作：雾切切证词、十神定合格线、江之岛推上舞台、塞蕾丝下注、高松听断点、爱音拉关系链。",
      );
    }
    if (/D2学级裁判不要复读同一票口问法链/.test(previousIssue)) {
      lines.push(
        "修复D2复读链：不要再复述票口、筹码、问句藏结论这套问法；改成揭示谁借问句回避，或换成本角色动作推进。",
        "如果你是在指出重复，必须给新的归因、压力或动作，不要尾句继续写“你自己呢”。",
      );
    }
    if (/误读前置位对未发言座位的保留态度/.test(previousIssue)) {
      lines.push(
        "修复未发言位误读：前置位明确说不提前压未发言位时，不要说他点了该未发言位；改成他压的是已发言目标，或评价他的急迫感、达标线、转焦点动作。",
      );
    }
    if (/把本轮未发言的\d+号当成已发言评价/.test(previousIssue)) {
      lines.push(
        "修复未发言位：该座位本轮还没开口，不能写“到现在没说/一个字没说/没回应/反应如何”；只能说“轮到他时正面接这个结果”，或改审已经发言者为什么提前替他定性。",
      );
    }
    if (/要求已发言的\d+号后续补充发言/.test(previousIssue)) {
      lines.push(
        "修复已过麦追问：被你点到的人本轮已经发言，不能再写“你补、你解释、你信不信、你改不改票、你票口在哪里”。",
        "改成按他已经说出口的内容下判断：我暂挂、我压票、我不认、我看谁借这句话跟风；如果要设条件，条件给后续未发言者或全桌票型，不给已过麦者补话任务。",
        "如果是在评论后置追问，记住后置追问发生在目标发言之后，不能写他没接完、没回应或等他补完；改成评价后置位如何制造压力。",
      );
    }
    if (/把\d+号发言后的追问说成\d+号未回应/.test(previousIssue)) {
      lines.push(
        "修复后置追问时间线：后置追问发生在目标发言之后，不能写他没接完、没回应、接不住或等他补完。",
        "改成评价后置位正在用这条追问制造压力，或看谁顺着这条后置压力跟票；不要把后置追问当成目标已经漏答。",
      );
    }
    if (/D1预言家不应主动展开首验理由/.test(previousIssue)) {
      lines.push("修复预言家D1报验错误：只说身份、目标、结果和今天处理方式；不要解释夜间选人过程，也不要声明自己为什么不解释。");
    }
    if (
      /(?:计划预言家声明没有说清身份线|没有覆盖计划中的查验结果|speechContract要求报出\d+号查杀|预言家查杀缺少今天如何处理查杀位)/.test(
        previousIssue,
      ) &&
      contract.move === "claim_black_check" &&
      contract.target
    ) {
      lines.push(
        `修复计划悍跳：第一句就跳预言家，明确说“${targetText}是查杀”，并给出今天票先压/谁保谁对撞；不要再点评别人来替代悍跳。`,
        `优先输出这条硬合同：我跳预言家，昨晚验出${targetText}查杀。今天票先压${contract.target.seatId}号；谁保${contract.target.seatId}号，就和我的结果对撞。`,
      );
    } else if (/计划预言家声明没有说清身份线/.test(previousIssue) && contract.move === "claim_gold_check" && contract.target) {
      lines.push(
        `修复预言家报金水：第一句明说“我是预言家”，再说“昨晚验了${targetText}，${targetText}是金水”。`,
        "不要只说“先报身份”或只报验人结果；普通玩家听到身份词才知道这是预言家声明。",
      );
    } else if (/speechContract要求报出\d+号查杀/.test(previousIssue) && contract.target) {
      lines.push(`修复查杀表达：必须自然说清“${targetText}是查杀”或“${targetText}结果是狼人”，不要只说重点观察或只说这张牌。`);
    }
    if (/腐川十神关系缺少公开触发/.test(previousIssue)) {
      lines.push("修复腐川越界：本轮没有公开十神触发时，不提十神；只回应当前查杀、质疑或公开发言。");
    }
    if (/把未公开身份的\d+号说成.+声明者/.test(previousIssue)) {
      lines.push("修复身份归属：没有公开身份声明的位置不要说跳、对跳、跟跳、明牌；改成点评、质疑、施压、保留或转移话题。");
    }
    if (/发言过于冗长或报告化/.test(previousIssue)) {
      lines.push("修复报告化：删掉列表和总结腔，保留角色反应、公开判断和一个可接住的动作。");
      if (contract.move === "identity_claim" && /猎人|枪/.test(contract.mustSay.join("\n"))) {
        lines.push("硬拍猎人修复：最多两句。第一句“我拍猎人，枪在这里。”第二句只给一个票口或压人标准。");
      }
    }
  }
  if (/普通局发言不要像全桌复盘|普通局发言黑话堆叠/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局修复口吻：改成普通玩家第一人称，只说我听到了什么、我为什么不舒服、我这轮先看谁。",
      "删掉全桌视角、上帝视角、收益来源、发言链、闭合、收口、压力源这些内部词；换成哪句话没听懂、谁把话说太满、我最后想压哪里。",
      "必要术语可以保留，例如平安夜、女巫、银水、对跳、查杀、金水、票口；但不要把术语堆成复盘报告。",
    );
  }
  if (/普通局不要把内部审稿词说出口/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
        "普通局审稿词修复：删掉“这句话本身、观察位、观察条件、发言缺口、身份空间、怎么用这个信息、起票补票最后跟票、划线、触线、收口、收一下票型”这类台下词。",
      "改成桌上玩家能说出口的动作：我听着怪、我没接住、我先不跟、我先暂放、我今天先压谁。",
      "如果引用前置位原话，引用后必须补一句自己怎么处理：先不跟、先暂放、先压票、改看后面谁借这个点带票。",
    );
  }
  if (/普通局改口必须说清新判断/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局改口修复：改口后必须立刻说新判断，例如“1号我先不压了”“我改看后面谁借这个点带票”“今天票先不跟2号”。",
      "不要只引用前置发言、不要只解释为什么要改；引用后必须给新的怀疑、暂放、投票边界或观察方向。",
    );
  }
  if (/普通局认同一半必须说清落点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局半接受修复：认一半后必须说清三件事：我认哪一半、我不全跟哪一半、我现在怎么处理。",
      "不要只说“我先认一半但不站死”；改成“身份我暂认，但票口我不跟；今天先不压4号/先听4号自己怎么说”。",
    );
  }
  if (/普通局不要连续围绕同一句做同质审计/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局同轴复读修复：同一句已经被多人打过，不要继续围绕同一个座位同一句话审计。",
      "这轮必须换动作或换焦点：看谁在跟票、谁没有新增理由、谁只复述身份说法，或把原焦点暂放一轮。",
    );
  }
  if (/普通局发言疑似被截断/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局截断修复：上一轮像半句话停住了，必须补完最后一个判断。",
      "如果最后是在引用别人原话，引用后必须接“所以我这轮怎么处理”：先不跟、先暂放、先压谁、或把票点落到谁。",
      "如果最后只是说“没听明白/不舒服/别扭”，必须补具体原因：哪句话没接住、它和前面哪句不一致、你这轮先暂放还是先压谁。",
      "如果最后只是“我主要想说/聊/点一下某号”，点名后必须补一句具体判断或处理动作：我信不信、暂不暂放、压不压、今天怎么处理。",
    );
  }
  if (/普通局死亡形态不要展开规则课|普通局发言必须推进一个游戏动作/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局死亡形态修复：只一句处理死亡形态，然后马上接一个具体游戏动作。",
      "无守卫女巫首夜单死写成“狼刀成功，女巫没救”；平安夜写成“女巫用了救药”。不要解释夜间规则前提、低概率药线、具体刀毒重合、空刀或首夜狼刀意图。",
      "后半句必须落到玩家动作：怀疑谁、暂放谁、追问谁、轻疑一个已发言的人，或给一个投票条件。不要只复述死讯或规则。",
    );
  }
  if (/平安夜女巫用药是公共死亡形态推理/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局平安夜公共常识修复：不要质疑别人说“女巫用了救药”的依据、信息来源或是不是纯推理；这是平安夜的公共死亡形态处理。",
      "如果要打这个人，只能打他拿平安夜之后做了什么：有没有马上硬压人、有没有跳过自己的判断去安排别人表态、有没有把自己的判断交给别人。",
    );
  }
  if (/普通局平安夜不要展开刀口和女巫行动规则课/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局平安夜修复：删掉狼队知道刀口、闭眼视角、女巫行动揣测这些夜间规则课。",
      "只保留一句“平安夜我先当背景/不拿它定人”，然后接自己的动作：暂放、先不定人、我现在听不出来；首置位不要问下一位或远后置位怎么看。",
    );
  }
  if (/普通局首置位不要设置未来观察点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局首置位修复：你是低信息第一麦，允许说完就停；不要再补“等后面说完我看谁前后不对/谁反应不自然/谁没说清楚”。",
      "改成一句自己的当前处理：我现在信息少，平安夜先当背景；这轮先不压票/先听一圈/我现在听不出来。",
    );
  }
  if (/普通局低信息首置位不要点名后置位布置任务|普通局低信息不要跳过下一位直接布置后置任务/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局首置位修复：你是低信息第一麦，删掉具体座位号和“轮到你/我想听你/你怎么看/你的回答”这类后置作业。",
      "改成只说自己的动作：平安夜先当背景、我先不定人、我先听一圈再说、这轮先不压票。",
      "如果已经有人发言，才可以接上一位原话问下一位一个具体问题；首置位没有原话可接，不要点名后置位。",
    );
  }
  if (/普通局低信息首置位划水不应成为主要攻击点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局低信息划水修复：首置位只说信息少、先听一圈、不急定人时，这是可接受的水发言，不要只因为短、没票口、没过程去压他。",
      "改成转回你自己的临时处理，或改看已经出现的身份声明、跟压重复、票口分歧；不要继续问首置位后面怎么补。",
    );
  }
  if (/普通局后置位不要复读同一发言缺口/.test(previousIssue)) {
    lines.push(
      "普通局修复复读链：不要再复述“只有一个人发言/压力源在哪/观察点没有来源”这句话。",
      "改成审刚才谁在复读、谁跟压却没有新增理由、谁借这条压力转票，或转向身份说法、票型动机、反应差。",
      "可以保留对原焦点的观察，但必须新增一个不同动作；不要把同一句质疑换座位号再说一遍。",
    );
  }
  if (/要求已发言的\d+号后续补充发言/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局修复时序：已经发过言的人本轮不会再立刻补充，不能写“你后面给方向/你再解释/你补站边/你打算怎么接”。",
      "改成直接按他已经说出口的原话下判断：先认、挂观察、压票、看谁跟风、或把条件交给尚未发言的后置位和之后票型。",
      "如果要保留问题，问题只能给尚未发言的人；对已发言的人只说“这句我先挂/我暂认/我不认/我按这个点压”。",
    );
  }
  if (/普通局非首发位不要自称首置位|普通局不要复刻前置位低信息开场/.test(previousIssue)) {
    lines.push(
      "普通局修复低信息复刻：如果前面已经有人发言，不能说“我首置位/我第一个发言/没前置发言可抓”。",
      "不要再复刻“平安夜，女巫用药了，这个先放着/看后置位整体/谁借平安夜带节奏”这套开场。",
      "改成接住上一位的具体原话、指出复制粘贴现象、审跟压收益、看身份收益或给一个新的票型验证条件。",
    );
  }
  if (contract.mustSay.length > 0) {
    lines.push(`必须说到：${contract.mustSay.join("；")}`);
  }
  if (contract.mayAsk.length > 0) {
    lines.push(`只能这样追问：${contract.mayAsk.join("；")}`);
  }
  if (contract.mustNotAsk.length > 0) {
    lines.push(`禁止：${contract.mustNotAsk.join("；")}`);
  }
  for (const attributionLine of buildClaimAttributionBoundaryLinesFromClaimBoard(input.publicContext.claimBoard)) {
    lines.push(`身份归属：${attributionLine}`);
  }
  lines.push("如果要打已经发过言的人，改写成“我按这个缺口压票/挂观察/不直接归死”，不要写“你再解释、你补、你复述、轮到你回应”。");
  if (contract.voteBoundary) {
    lines.push(`今天处理查杀或投票的说法：${contract.voteBoundary}`);
  }
  lines.push(`输出仍然最多${contract.maxSentences}句、${contract.maxChars}字，只返回 {"speech":"..."}`);
  return lines;
}

function buildSpeechOrderContext(view: AgentView): LlmSpeechInput["publicContext"]["speechOrder"] {
  const speakersAlreadyFinished = uniqueSeatOrder(
    currentDaySpeechItems(view)
      .filter((speech) => speech.speaker)
      .map((speech) => speech.speaker!),
  );
  const currentSpeaker = toTargetFromSeatId(view, view.mySeatId);
  const todaySpeechOrder = buildTodaySpeechOrder(view, speakersAlreadyFinished, currentSpeaker);
  const currentSpeakerOrderIndex = todaySpeechOrder.findIndex((seat) => seat.seatId === currentSpeaker.seatId);
  const currentDaySpokenSeatIds = new Set(
    speakersAlreadyFinished.map((seat) => seat.seatId),
  );
  return {
    currentSpeaker,
    todaySpeechOrder,
    currentSpeakerOrderIndex,
    speakersAlreadyFinished,
    currentDaySpokenSeats: todaySpeechOrder.filter((seat) => currentDaySpokenSeatIds.has(seat.seatId)),
    currentDayUnspokenSeats: todaySpeechOrder.filter(
      (seat) => seat.seatId !== view.mySeatId && !currentDaySpokenSeatIds.has(seat.seatId),
    ),
  };
}

function buildTodaySpeechOrder(view: AgentView, speakersAlreadyFinished: ActionTarget[], currentSpeaker: ActionTarget): ActionTarget[] {
  const projectedQueue = view.daySpeechOrder?.queue ?? [];
  const queueHasCurrentSpeaker = projectedQueue.some((seat) => seat.seatId === currentSpeaker.seatId);
  const baseOrder = queueHasCurrentSpeaker ? projectedQueue : view.aliveSeats;
  const missingFinishedSpeakers = speakersAlreadyFinished.filter(
    (speaker) => !baseOrder.some((seat) => seat.seatId === speaker.seatId),
  );
  const remainingAliveSeats = view.aliveSeats.filter(
    (seat) =>
      !missingFinishedSpeakers.some((speaker) => speaker.seatId === seat.seatId) &&
      !baseOrder.some((orderedSeat) => orderedSeat.seatId === seat.seatId),
  );
  return uniqueSeatOrder([...missingFinishedSpeakers, ...baseOrder, ...remainingAliveSeats]);
}

function currentDaySpeechItems(view: AgentView): AgentView["publicSummary"]["recentSpeeches"] {
  const bySeq = new Map<number, AgentView["publicSummary"]["recentSpeeches"][number]>();
  for (const speech of view.publicSummary.recentSpeeches) {
    if (speech.day !== view.day || !speech.speaker) continue;
    bySeq.set(speech.seq, speech);
  }
  for (const event of view.publicEvents) {
    if (event.day !== view.day || event.type !== "SPEECH_CREATED" || event.payload.sheriffSpeech === true) continue;
    const seatId = readNumberValue(event.payload.seatId) ?? event.actorSeatId;
    if (!seatId) continue;
    bySeq.set(event.seq, {
      seq: event.seq,
      day: event.day,
      speaker: toTargetFromSeatId(view, seatId),
      message: readStringValue(event.payload.message) ?? event.message,
    });
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

function uniqueSeatOrder(seats: ActionTarget[]): ActionTarget[] {
  const seen = new Set<number>();
  const result: ActionTarget[] = [];
  for (const seat of seats) {
    if (seen.has(seat.seatId)) continue;
    seen.add(seat.seatId);
    result.push(seat);
  }
  return result;
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

type CurrentDayDeathShape = "none" | "peaceful" | "death";

function buildDeathInfoNote(deathShape: CurrentDayDeathShape, deathShapeAlreadyDiscussed: boolean): string {
  const shared =
    "普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法；非女巫仍不能编造女巫是谁或具体救了几号。真女巫可以公开自己的真实救毒信息，但不能编错目标，也不要只说“我救过人”这种半公开私密状态。";
  if (deathShape === "death") {
    return [
      deathShapeAlreadyDiscussed
        ? "有夜死已作为背景处理，后续不要主动复读药线；把发言重心转到怀疑、暂放、追问或投票条件。"
        : "首夜单死只一句带过：狼刀成功，女巫没救。不要讲规则课，也不要追问首夜狼刀意图；说完必须接一个怀疑、暂放、追问或投票条件。",
      shared,
    ].join("");
  }
  if (deathShape === "peaceful") {
    return deathShapeAlreadyDiscussed
    ? `平安夜已作为背景处理，后续发言不要主动复读药线或空刀；只在和票型、身份说法直接相关时一句带过。${shared}`
      : `平安夜只作背景，一句带过：女巫用了救药。不要解释空刀概率或展开规则背景；说完必须接一个怀疑、暂放、追问或投票条件。${shared}`;
  }
  return `当前没有需要展开的死亡形态；不要主动编造平安夜、女巫用药、刀口、毒口或自刀。${shared}`;
}

function buildDeathBoundaryLine(deathShape: CurrentDayDeathShape, deathShapeAlreadyDiscussed: boolean): string {
  const shared =
    "普通玩家不要展开规则课；真女巫可以公开真实救毒信息，不能只说“我救过人”这种半公开私密状态。";
  if (deathShape === "death") {
    return deathShapeAlreadyDiscussed
      ? `有夜死已作为背景处理，后续不要主动复读药线；把发言重心转到怀疑、暂放、追问或投票条件；${shared}`
      : `首夜单死只一句带过：狼刀成功，女巫没救；说完必须接一个怀疑、暂放、追问或投票条件；不要追问首夜狼刀意图；${shared}`;
  }
  if (deathShape === "peaceful") {
    return deathShapeAlreadyDiscussed
      ? `平安夜已作为背景处理，不要主动复读药线或空刀；${shared}`
      : `平安夜只作背景，一句带过：女巫用了救药；说完必须接一个怀疑、暂放、追问或投票条件；不要解释空刀概率；${shared}`;
  }
  return `当前没有需要展开的死亡形态；${shared}`;
}

function hasCurrentDayDeathShapeMention(view: AgentView): boolean {
  const deathShape = getCurrentDayDeathShape(view);
  const currentSpeechText = currentDaySpeechItems(view)
    .map((speech) => speech.message)
    .join("\n");
  if (deathShape === "death") return /死亡|倒牌|出局|死因|女巫没救|女巫没用药|没用解药|刀口|毒口/.test(currentSpeechText);
  if (deathShape === "peaceful") return /平安夜|女巫用药|药线|空刀/.test(currentSpeechText);
  return false;
}

function getCurrentDayDeathShape(view: AgentView): CurrentDayDeathShape {
  const text = collectCurrentDayDeathLines(view).join("\n");
  if (/(死亡|倒牌|出局)/.test(text)) return "death";
  if (/(平安夜|无人死亡|没有人死亡|没人倒牌|无人倒牌)/.test(text)) return "peaceful";
  const currentSpeechText = currentDaySpeechItems(view)
    .map((speech) => speech.message)
    .join("\n");
  if (/(平安夜|女巫用药|药线|空刀)/.test(currentSpeechText)) return "peaceful";
  return "none";
}

function collectCurrentDayDeathLines(view: AgentView): string[] {
  const eventLines = view.publicEvents
    .filter((event) => event.day === view.day && event.type === "DAY_STARTED")
    .map((event) => event.message);
  return [
    ...eventLines,
    ...view.publicSummary.recentDeaths,
    ...view.publicSummary.tableMemory.deathAnnouncements,
  ].filter((line): line is string => typeof line === "string" && line.trim().length > 0);
}

function isLowInfoDayOneOpening(view: AgentView): boolean {
  if (view.day !== 1) return false;
  const currentDaySpeeches = currentDaySpeechItems(view);
  if (currentDaySpeeches.length > 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  return !currentDaySpeeches.some((speech) => hasHardDayOneOpeningInfo(speech.message));
}

function isLowInfoDayOneNoHardInfo(view: AgentView): boolean {
  if (view.day !== 1) return false;
  if (view.publicSummary.claimBoard.some((claim) => claim.lastUpdatedDay === view.day)) return false;
  if (view.publicSummary.voteSnapshot.revealed && view.publicSummary.voteSnapshot.votes.length > 0) return false;
  return !currentDaySpeechItems(view).some((speech) => hasHardDayOneOpeningInfo(speech.message));
}

function hasHardDayOneOpeningInfo(message: string): boolean {
  const withoutDeathShape = message.replace(/(?:平安夜[^。！？；]{0,20})?女巫用药(?:了|处理)?|按女巫用药处理/g, "");
  return /查杀|金水|预言家|我是女巫|我女巫|猎人|骑士|守卫|警徽/.test(withoutDeathShape) || hasConcreteDayOneVotePressure(withoutDeathShape);
}

function hasConcreteDayOneVotePressure(message: string): boolean {
  const withoutNegativeTicket = message.replace(/(?:没|没有|还没有|尚未|未|并未|不是|不急(?:着)?)[^。！？；]{0,18}(?:站边|票口|推票|催票)/g, "");
  return /归票|出人|票口[^。！？；]{0,10}(?:先|直接)?(?:压|落|锁|给到|放在)|(?:先|直接)?(?:压|投(?:给|出|向|到)?|票投|出)\s*(?:\d+|[一二三四五六七八九十两]+)\s*号/.test(
    withoutNegativeTicket,
  );
}

function hasActionableClassTrialPublicInfo(view: AgentView, currentDaySpeeches: ReturnType<typeof currentDaySpeechItems>): boolean {
  const summary = view.publicSummary;
  const memory = summary.tableMemory;
  return (
    currentDaySpeeches.some((speech) => speech.speaker?.seatId !== view.mySeatId) ||
    summary.claimBoard.length > 0 ||
    summary.recentVotes.length > 0 ||
    summary.voteSnapshot.votes.length > 0 ||
    summary.voteSnapshot.tally.length > 0 ||
    summary.voteSnapshot.revealed ||
    summary.recentDeaths.length > 0 ||
    summary.deathSummary.length > 0 ||
    memory.claimBoard.length > 0 ||
    memory.reasoningCues.length > 0 ||
    memory.counterclaims.length > 0 ||
    memory.focus.length > 0 ||
    memory.voteHistory.length > 0 ||
    memory.deathAnnouncements.length > 0 ||
    memory.publicSignals.length > 0
  );
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
      `${context.repeatedPressureAxis.target.seatId}号已被连续点到${context.repeatedPressureAxis.count}次；这轮不要继续沿着同一压力轴复读，换成暂放、票口边界、回应结果或自己的新对象。`,
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
    publicRoleClaim: ["roleHandle", "quoteOneLine", "hold", "voteBoundary"],
    deathShape: ["waterPass", "hold", "voteBoundary"],
    voteBoundary: ["voteBoundary", "quoteOneLine", "changeRead", "hold"],
  };
  const repeatedQuoteSurface = options.recentSurfaceMoves.some((move) =>
    /接上一位|我听到了|这句话本身|留疑问|卡\/卡一句|接线/.test(move),
  );
  const moves = [...byPressure[currentPressure]];
  if (repeatedQuoteSurface && currentPressure !== "underQuestion" && currentPressure !== "publicRoleClaim") {
    const shiftedMoves = moves.filter((move) => move !== "quoteOneLine" && move !== "halfAccept");
    shiftedMoves.push("discomfort", "hold", "voteBoundary");
    return uniqueOrdinarySpeechMoves(shiftedMoves).slice(0, 5);
  }
  if (options.repeatedPressureAxis && currentPressure !== "underQuestion") {
    const shiftedMoves = moves.filter(
      (move) => move !== "quoteOneLine" && move !== "halfAccept" && move !== "followPressure",
    );
    shiftedMoves.push("hold", "waterPass", "voteBoundary", "changeRead");
    return uniqueOrdinarySpeechMoves(shiftedMoves).slice(0, 5);
  }
  if (options.latestSpeech && currentPressure !== "underQuestion") moves.push("quoteOneLine", "halfAccept");
  return uniqueOrdinarySpeechMoves(moves).slice(0, 5);
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
  const promptLines = [
    `普通局玩家小传：${preset.label}，${preset.summary}`,
    `稳定特征：${traits.join("、")}。`,
    `口头习惯：${mouthHabit}`,
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
    ? toTargetFromSeatId(view, memory.lastSpeechTargetSeatId)
    : undefined;
  const lastVoteTarget = memory?.lastVoteTargetSeatId
    ? toTargetFromSeatId(view, memory.lastVoteTargetSeatId)
    : undefined;

  if (!lastPublicSpeech && !lastSpeechTarget && !memory?.lastSpeechStance && !lastVoteTarget && !memory?.lastVoteReason) {
    return undefined;
  }

  const promptLines = [
    "普通局自我历史：你要记得自己上一轮公开怎么站过；可以延续，也可以改口，但要用第一人称说为什么。",
    lastPublicSpeech ? `上一轮我说过：${lastPublicSpeech}` : undefined,
    lastSpeechTarget
      ? `上一轮我发言主要点过${seatText(lastSpeechTarget)}${memory?.lastSpeechStance ? `：${clipBriefingText(memory.lastSpeechStance, 72)}` : "。"}`
      : memory?.lastSpeechStance
        ? `上一轮我的发言立场：${clipBriefingText(memory.lastSpeechStance, 72)}`
        : undefined,
    lastVoteTarget
      ? `上一轮我投过${seatText(lastVoteTarget)}${memory?.lastVoteReason ? `：${clipBriefingText(memory.lastVoteReason, 72)}` : "。"}`
      : memory?.lastVoteReason
        ? `上一轮我的投票理由：${clipBriefingText(memory.lastVoteReason, 72)}`
        : undefined,
    "这轮如果换目标，不要直接换轴；说清是听到了哪条新公开发言或身份信息。",
  ].filter((line): line is string => Boolean(line));

  return {
    lastPublicSpeech,
    lastSpeechTarget,
    lastSpeechStance: memory?.lastSpeechStance,
    lastVoteTarget,
    lastVoteReason: memory?.lastVoteReason,
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
    currentPressure === "underQuestion"
      ? "被点名时先回应自己被打到的点，再决定要不要反问；如果对方把“平安夜女巫用药”当泄视角，先说明这是公开死亡形态背景。"
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
  if (repeatedPressureAxis) found.push(`同轴压力重复: ${repeatedPressureAxis.target.seatId}号`);
  return uniqueStrings(found).slice(0, 5);
}

function ordinarySpeechPressureLabel(pressure: OrdinarySpeechPressure): string {
  switch (pressure) {
    case "underQuestion":
      return "我被前置位点名或质疑";
    case "respondToPrevious":
      return "需要接上一位的公开原话";
    case "publicRoleClaim":
      return "桌上有公开身份声明或查验";
    case "deathShape":
      return "只有死亡形态可当背景";
    case "voteBoundary":
      return "需要给投票或改票边界";
    case "noInformation":
    default:
      return "低信息轮次，只能给自己的临时处理";
  }
}

function ordinarySpeechMoveLabel(move: OrdinarySpeechMove): string {
  switch (move) {
    case "waterPass":
      return "低信息过水：只说暂放/先听/不压票，说完就停";
    case "quoteOneLine":
      return "只接一句具体原话";
    case "halfAccept":
      return "半认同半保留";
    case "discomfort":
      return "说清不舒服点";
    case "followPressure":
      return "跟压但补自己的理由";
    case "hold":
      return "暂放不站死";
    case "defendSelf":
      return "先自辩";
    case "clarifyMotive":
      return "解释自己为什么这么说";
    case "counterQuestion":
      return "反问对方依据";
    case "changeRead":
      return "改口或调整判断";
    case "roleHandle":
      return "按公开身份说法处理";
    case "voteBoundary":
      return "给票口或改票条件";
    default:
      return move;
  }
}

function uniqueOrdinarySpeechMoves(moves: OrdinarySpeechMove[]): OrdinarySpeechMove[] {
  const seen = new Set<OrdinarySpeechMove>();
  return moves.filter((move) => {
    if (seen.has(move)) return false;
    seen.add(move);
    return true;
  });
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildUniversalDeTemplateGuide(view: AgentView): string {
  const speeches = currentDaySpeechItems(view).filter((speech) => speech.speaker?.seatId !== view.mySeatId).slice(-6);
  const repeatedEmptyStancePressure =
    speeches.filter((speech) =>
      /没给出?站边|没给出?票口|没有给出?站边|没有给出?票口|没给.*(?:票口|倾向|判断|位置)|没有.*(?:票口|倾向|判断|位置)|站边倾向|票口方向|证据链缺口|这个疑点|这个缺口|同一缺口/.test(
        speech.message,
      ),
    )
      .length >= 2;
  if (view.roleCard?.theme === "class-trial") {
    const roleAction = classTrialRoleActionText(view.roleCard.id);
    const shift = repeatedEmptyStancePressure
      ? `前置位已经在同一类空站边/空票口/空倾向压力里打转，不要继续复读没站边/没票口/没倾向；如果还碰同一焦点，必须改成${roleAction}。`
      : `不要连续套“我先按公开信息盘/这个疑点未解除/票口先放这里”，也不要把没站边/没票口当万能攻击；优先把公开事件改成${roleAction}。`;
    return `通用去模板：角色正在玩狼人杀，不是狼人杀玩家套角色皮。${shift} 可以诈、可以带节奏、可以制造压力，但说出口时先像${view.roleCard.displayName}在裁判场里抓人，而不是复读狼人杀模板骨架。`;
  }
  const shift = repeatedEmptyStancePressure
    ? "前置位已经在同一类空站边/空票口/空倾向压力里打转，不要继续复读没站边/没票口/没倾向；如果还碰同一焦点，必须改写成身份收益、票型动机、反应差、死亡形态、跟压收益或可验证条件。"
    : "不要连续套“我先按公开信息盘/这个疑点未解除/票口先放这里”，也不要把没站边/没票口当万能攻击；优先换成身份收益、票型动机、反应差、死亡形态、跟压收益或可验证条件。";
  return `通用去模板：${shift} 可以诈、可以带节奏、可以制造压力，但说出口时要像玩家临场抓一个公开切口，而不是复读模板骨架。`;
}

function buildOrdinaryPlayerMouthGuide(view: AgentView): string {
  const personaStrategy = adaptPersonaStrategyForView(view);
  return [
    `普通局玩家类型策略：${formatPersonaStrategyForPrompt(personaStrategy)}`,
    "第一人称发言：只说我听到了什么、我现在怎么想、我想问谁什么；不要像裁判、上帝视角或复盘工具总结全桌。",
    "真人微动作：每段只选一个主动作，例如认一句、追一句、暂放、跟压、防御、改口或护一手；不要把一段话写成全桌审计。",
    "普通玩家能听懂：必要术语可以保留，例如平安夜、女巫、银水、对跳、查杀、金水、票口。",
    "不要说内部黑话：收益来源、发言链、闭合、闭环、收口、压力源这些词不要出现在台词里；改成“我为什么现在怀疑他”“哪句话没听懂”“最后想投谁”。",
    "低信息首轮：承认信息少，只接一个公开点；首置位默认不点名任何后置位，只说“我先听/我暂放/我不压票”后可以停；已有前置发言后才最多问一个相关座位，且不要跳过下一位布置作业。",
    "平安夜首发：最多一句承认平安夜；不要说狼队知道刀口、不要说后置位越过闭眼视角，也不要盘女巫行动被谁看出来；直接转成自己的动作：暂放、先不定人、我先听一圈，首置位不要补“后面看谁反应”的未来标准。",
    "平安夜公共常识：别人说“女巫用药了/用了救药”不是女巫声明，也不是泄视角；不要追问凭什么知道、是不是替女巫说话，只能打他后续动作：突然硬压人、跳过自己判断去让别人表态、空过或带节奏；台词里别说“布置作业/划线/触线”。",
  ].join("\n");
}

function buildOrdinaryRepeatedPressureGuide(view: AgentView): string | undefined {
  const repeatedAxisCount = currentDaySpeechItems(view).filter((speech) => isOrdinaryPressureSourceQuestionAxis(speech.message)).length;
  if (repeatedAxisCount < 2) return undefined;
  const focusSeat = inferOrdinaryRepeatedPressureFocus(view);
  const focusText = focusSeat ? `${focusSeat.seatId}号${shortPublicName(focusSeat.name)}` : "首置位";
  return `普通局反复读：同一句压力源质疑已经被多人重复，同类“只有观察点没有结论/没给方向”也不能再复读；这轮不要再问${focusText}“压力源在哪/观察点没有来源/为什么没结论”，改审复读者、跟压者、谁没有新增理由，或转向身份说法、票型动机、反应差。`;
}

function buildOrdinaryOpeningAntiCopyGuide(view: AgentView): string | undefined {
  if (view.day !== 1) return undefined;
  const priorSpeeches = currentDaySpeechItems(view).filter((speech) => speech.speaker?.seatId !== view.mySeatId);
  if (!priorSpeeches.some((speech) => isOrdinaryLowInfoOpeningTemplate(speech.message))) return undefined;
  const previousSpeaker = priorSpeeches.at(-1)?.speaker;
  const previousText = previousSpeaker ? `${previousSpeaker.seatId}号${shortPublicName(previousSpeaker.name)}` : "前置位";
  return `普通局反复开场：前置位已经说过平安夜/女巫用药先放着和看后置位整体，不能再自称首置位，也不能复刻这套开场；你要从${previousText}原话、复制粘贴现象、跟压收益、身份收益或票型验证里换一个新动作。`;
}

function inferOrdinaryRepeatedPressureFocus(view: AgentView): ActionTarget | undefined {
  const directFocus = view.publicSummary.tableMemory.focus.find((item) => item.seat.seatId !== view.mySeatId)?.seat;
  if (directFocus) return directFocus;
  const priorSpeech = currentDaySpeechItems(view).find((speech) => isOrdinaryPressureSourceQuestionAxis(speech.message));
  if (!priorSpeech) return undefined;
  const match = priorSpeech.message.match(/(\d+)\s*号/);
  const seatId = match ? Number(match[1]) : undefined;
  return seatId ? toTargetFromSeatId(view, seatId) : undefined;
}

function classTrialRoleActionText(roleId: string): string {
  switch (roleId) {
    case "naegi":
      return "苗木式的希望验证点或共同确认";
    case "kirigiri":
      return "雾切式的证词切片和缺少前提";
    case "fukawa":
      return "腐川式的慌乱、偏执和被逼回应";
    case "monokuma":
      return "黑白熊式的审判挑衅或二选一压迫";
    case "enoshima":
      return "江之岛式的绝望伪装和混乱反应";
    case "celestia":
      return "塞蕾丝式的下注、筹码和代价";
    case "togami":
      return "十神式的合格线、资格和证词等级";
    case "tomori":
      return "高松灯式的声音断点和接不上的不安";
    case "anon":
      return "爱音式的关系链、接话感和社交转折";
    default:
      return "当前角色自己的反应、偏见和说话方式";
  }
}

function buildCheckResultSeerClaimGuide(view: AgentView): string | undefined {
  const hasPublicSeerCheck = view.publicSummary.claimBoard.some(
    (claim) => claim.claimedRole === "SEER" && claim.checks.length > 0 && claim.claimant.seatId !== view.mySeatId,
  );
  if (!hasPublicSeerCheck) return undefined;
  return "报查验结果、金水或查杀已经等同于预言家声明；D1不要要求首验理由；一张金水或查杀是正常首夜查验量；金水天然暂不进出人焦点，不要把报验者正常放下金水说成提前保护或额外设防。";
}

function buildNameAwareAddressingGuide(view: AgentView): string {
  const examples = view.aliveSeats
    .filter((seat) => seat.seatId !== view.mySeatId)
    .slice(0, 8)
    .map((seat) => `${seat.seatId}号${shortPublicName(seat.name)}`)
    .join("、");
  const classTrialLine =
    view.roleCard?.theme === "class-trial"
      ? "学级裁判主题局优先用短名或外号，例如 2号雾切、5号江之岛、6号塞蕾丝、9号爱音；自然接话时也可以直接叫雾切、黑白熊。"
      : "普通局也尽量说成座位号加名字，例如 2号Claude、3号GPT，而不是整段只说几号。";
  return `称呼别人尽量带名字或短名，查验、投票、目标定位仍保留座位号。${classTrialLine} 本局可用称呼示例：${examples}。`;
}

function shortPublicName(name: string): string {
  const clean = name.trim();
  const aliases: Record<string, string> = {
    苗木诚: "苗木",
    雾切响子: "雾切",
    腐川冬子: "腐川",
    黑白熊: "黑白熊",
    江之岛盾子: "江之岛",
    塞蕾丝缇雅: "塞蕾丝",
    十神白夜: "十神",
    高松灯: "高松",
    千早爱音: "爱音",
  };
  return aliases[clean] ?? clean;
}

function buildSelfIntroductionBoundaryLine(view: AgentView): string {
  if (view.roleCard?.theme === "class-trial") {
    return (
      buildClassTrialSelfIntroductionGuide(view) ??
      "学级裁判主题局：不要把自我介绍当成每轮固定开场，直接进入当前公开判断。"
    );
  }
  return "如果是首轮可按座位名报自己是谁；后续轮次不要把模型特点说成自我介绍、AI 身份、系统自述、模型口号或固定模板。";
}

function buildModelSpeechStyleGuide(view: AgentView): LlmSpeechInput["playerSpeechGuide"]["modelStyle"] {
  const persona = view.persona;
  const modelName = persona?.name ?? "AI玩家";
  const style = persona?.style ? `保留角色底色：${persona.style}` : "保持稳定、自然的桌游玩家口吻。";
  const goal = persona?.goal ? `打法目标：${persona.goal}` : "围绕公开事实形成可投票判断。";
  const preferences = persona?.preferences;

  if (modelName.includes("DeepSeek")) {
    return {
      modelName,
      softTendency: "偏逻辑链校验：把发言、站边、票型按因果顺序串起来，但不要变成判题报告。",
      tendencies: [style, goal, "优先指出前后不一致、结论缺过程、票型和发言是否闭环。"],
    };
  }

  if (modelName.includes("Claude")) {
    return {
      modelName,
      softTendency: "偏边界审查：先分清哪些是公开事实、哪些只是推测，再给审慎判断。",
      tendencies: [style, goal, "可以保留余地，但最后仍要给可执行的怀疑、暂放或票口。"],
    };
  }

  if (modelName.includes("GPT")) {
    return {
      modelName,
      softTendency: "偏综合组织：把多条公开信息收束成一个能推进桌面的判断。",
      tendencies: [style, goal, "适合把身份说法、发言顺序和票型放在同一段里归纳。"],
    };
  }

  if (modelName.includes("豆包")) {
    return {
      modelName,
      softTendency: "偏强压节奏：结论更早、追问更直接，但不能乱踩未发言位。",
      tendencies: [style, goal, "适合追一个具体目标没说清的地方，别一次索要站边、票口和身份说法。"],
    };
  }

  if (modelName.includes("Mimo")) {
    return {
      modelName,
      softTendency: "偏细节校验：抓一个公开细节反复核对，避免大段空泛站边。",
      tendencies: [style, goal, "适合从一句发言、一次投票或一个身份口径切入。"],
    };
  }

  if (modelName.includes("Gemini")) {
    return {
      modelName,
      softTendency: "偏多线观察：同时保留两条可能性，再给下一轮验证点。",
      tendencies: [style, goal, "适合说清楚哪些点暂放、哪个具体点需要后续验证。"],
    };
  }

  if (modelName.includes("GLM")) {
    return {
      modelName,
      softTendency: "偏结构站边：看阵营关系、身份冲突和谁在帮谁收口。",
      tendencies: [style, goal, "适合把人分成暂放、偏好和需要解释的位置。"],
    };
  }

  if (modelName.includes("Kimi")) {
    return {
      modelName,
      softTendency: "偏长线记忆：连接上一轮发言、票型和今天态度变化。",
      tendencies: [style, goal, "适合指出前后变化、旧疑点是否被解释、票型是否延续。"],
    };
  }

  const preferenceLine = preferences
    ? `按偏好取材：逻辑${preferences.logic.toFixed(2)}、身份${preferences.identity.toFixed(2)}、票型${preferences.vote.toFixed(
        2,
      )}、记忆${preferences.memory.toFixed(2)}，只作为软倾向。`
    : "没有固定模型标签，按当前局势选择最自然的狼人杀打法。";

  return {
    modelName,
    softTendency: "按当前人格的打法偏好表达，但局势判断优先于风格。",
    tendencies: [style, goal, preferenceLine],
  };
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
    .map((cue) => `${cue.summary}${cue.evidence.length > 0 ? `；依据：${cue.evidence.slice(0, 2).join("、")}` : ""}`);

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

function buildDeathBriefingLine(view: AgentView, deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view)): string {
  const deathShape = getCurrentDayDeathShape(view);
  const deaths = [
    ...new Set([
      ...view.publicSummary.recentDeaths,
      ...view.publicSummary.tableMemory.deathAnnouncements,
    ]),
  ].slice(-3);
  if (deaths.length === 0) return "公开死讯：目前没有需要引用的死亡播报。";
  if (deathShape === "death") {
    return deathShapeAlreadyDiscussed
      ? `公开死讯：${deaths.join("；")}。有夜死已作为背景处理；后续不要主动复读药线，把发言重心转到怀疑、暂放、追问或投票条件。`
      : `公开死讯：${deaths.join("；")}。首夜单死只一句带过：狼刀成功，女巫没救；不要追问首夜狼刀意图；说完必须接自己的游戏动作。`;
  }
  return deathShapeAlreadyDiscussed
    ? `公开死讯：${deaths.join("；")}。平安夜已作为背景处理，本轮不要主动复读药线或空刀；把发言重心转到怀疑、暂放、追问或投票条件。`
    : `公开死讯：${deaths.join("；")}。平安夜只作背景，一句带过：女巫用了救药；说完必须接自己的游戏动作。`;
}

function buildClaimBriefingLine(view: AgentView): string {
  const claims = view.publicSummary.claimBoard.slice(-5).map((claim) => {
    const checks =
      claim.checks.length > 0
        ? `，报${claim.checks
            .map((check) => `${seatText(check.target)}${check.result === "WEREWOLF" ? "查杀" : "金水"}`)
            .join("、")}`
        : "";
    return `${seatText(claim.claimant)}声称${claim.claimedRoleLabel}${checks}`;
  });
  return claims.length > 0 ? `公开身份声明：${claims.join("；")}。` : "公开身份声明：无。";
}

function buildSeerLegacyBriefingLine(view: AgentView): string {
  const legacies = view.publicSummary.tableMemory.seerLegacies.slice(0, 3).map((legacy) => legacy.summary);
  return legacies.length > 0
    ? `夜死预言家声明遗留：${legacies.join("；")}。这只是公开遗留视角，不等于系统确认真预言家。`
    : "夜死预言家声明遗留：无。";
}

function buildSheriffBriefingLine(view: AgentView): string {
  const sheriff = view.privateKnowledge.sheriff;
  if (!sheriff) return "警长流程：本局没有警上、警下、警徽、警长流程。";

  const activeCandidates = sheriff.candidates.filter((candidate) => !sheriff.withdrawnSeatIds.includes(candidate.seatId));
  const holderText = sheriff.badgeHolder
    ? `当前警徽持有人是${seatText(sheriff.badgeHolder)}`
    : sheriff.resolved
      ? "当前没有警徽持有人"
      : "警长竞选尚未结束";
  const candidateText = activeCandidates.length > 0 ? `候选人：${formatSeatList(activeCandidates)}` : undefined;
  const pkText = sheriff.pkCandidates?.length ? `PK席：${formatSeatList(sheriff.pkCandidates)}` : undefined;

  return ["警长流程：本局有警上、警下、警徽和警长投票。", holderText, candidateText, pkText].filter(Boolean).join(" ");
}

function buildSheriffVoteBriefingLine(view: AgentView): string {
  const snapshot = view.publicSummary.sheriffVoteSnapshot;
  if (!snapshot) return "警长票型：无。";
  if (!snapshot.revealed) return "警长票型：尚未公开。";

  const tally = snapshot.tally.map((item) => `${seatText(item.target)}${item.count}票`).join("、");
  const leaders = snapshot.leaders.length > 0 ? `领先：${formatSeatList(snapshot.leaders)}` : undefined;
  const abstain = snapshot.abstainCount ? `弃票${snapshot.abstainCount}票` : undefined;
  const details = [tally, leaders, abstain].filter(Boolean).join("；");
  return details ? `警长票型：${details}。` : "警长票型：无公开票。";
}

function buildPrivateBriefingLines(view: AgentView): string[] {
  switch (view.myRole) {
    case "SEER": {
      const checks = view.privateKnowledge.seerChecks ?? [];
      return checks.length > 0
        ? [
            `你的真实查验：${checks
              .map((check) => `${check.targetSeatId}号${check.result === "WEREWOLF" ? "狼人" : "好人"}`)
              .join("、")}。若公开查验，不能改目标或结果。`,
          ]
        : ["你是真预言家，但当前还没有可公开的查验记录。"];
    }
    case "WITCH": {
      const witch = view.privateKnowledge.witch;
      const lines = ["你是真女巫，药瓶信息只有你自己知道；没跳身份前，别人不能确定女巫是否用药。"];
      if (witch?.currentVictim) lines.push(`你看到的夜间刀口是${seatText(witch.currentVictim)}。`);
      if (witch?.savedTarget) lines.push(`你${view.day <= 1 ? "昨夜" : "首夜"}救过${seatText(witch.savedTarget)}。`);
      if (witch?.poisonedTarget) lines.push(`你昨夜毒过${seatText(witch.poisonedTarget)}。`);
      return lines;
    }
    case "WEREWOLF":
    case "WOLF_KING":
    case "WHITE_WOLF_KING":
    case "WOLF_BEAUTY": {
      const teammates = view.privateKnowledge.wolfTeammates ?? [];
      const assignment = view.privateKnowledge.wolfTeamPlan?.assignments.find((item) => item.seat.seatId === view.mySeatId);
      const roleLabel =
        view.myRole === "WOLF_KING"
          ? "狼王"
          : view.myRole === "WHITE_WOLF_KING"
            ? "白狼王"
            : view.myRole === "WOLF_BEAUTY"
              ? "狼美人"
              : "狼人";
      return [
        `你是${roleLabel}，狼队友是${formatSeatList(teammates)}；公开发言绝不能暴露狼队视角。`,
        assignment
          ? `你的狼队任务倾向：${assignment.taskLabel}，但理由必须伪装成公开发言、身份声明、票型或死讯判断。`
          : "你可以伪装好人、倒钩或带票，但理由只能来自公开信息。",
      ];
    }
    case "HUNTER":
      return ["你是真猎人，可以选择是否拍身份；没必要时可以只用闭眼好人口吻盘逻辑。"];
    case "IDIOT":
      return ["你是真白痴，被白天放逐会翻牌免死并失去投票权；发言要把抗推压力转成公开逻辑。"];
    case "KNIGHT":
      return ["你是真骑士，可以选择是否拍身份；决斗前必须先用公开证据把目标狼面讲清楚。"];
    case "GUARD":
      return ["你是真守卫，守护信息只有你自己知道；没跳身份前，别人不能确定守卫守护目标。"];
    case "VILLAGER":
      return ["你是闭眼平民，没有夜间信息；只能用公开发言、身份声明、死讯和票型做判断。"];
  }
}

function buildPrivateBoundaryLines(view: AgentView): string[] {
  const common = [
    `你的真实身份是${ROLE_LABELS[view.myRole]}，这是你的私有视角，不属于桌面公开事实。`,
    "私有视角可以影响你的判断和策略，但发言时必须包装成公开推理、身份声明或个人立场。",
  ];

  switch (view.myRole) {
    case "SEER":
      return [
        ...common,
        "如果公开查验，目标和结果必须来自你的真实查验记录，不能为了带节奏改报。",
      ];
    case "WITCH":
      return [
        ...common,
        "具体刀口、救毒目标和真实用药只有你知道；未跳身份前不要说成全桌都知道的事实。",
        ...(view.privateKnowledge.witch?.savedTarget
          ? ["如果你选择公开女巫救人，发言要同时报出救的几号/银水，不只说“我用药了”。"]
          : []),
      ];
    case "WEREWOLF":
    case "WOLF_KING":
    case "WHITE_WOLF_KING":
    case "WOLF_BEAUTY":
      return [
        ...common,
        "狼队友、狼队计划、夜间刀口和狼队特殊技能不能以私密信息说出口，只能伪装成公开逻辑。",
      ];
    case "HUNTER":
      return [...common, "猎人身份可以选择拍出或隐藏，但不能虚构夜间信息。"];
    case "IDIOT":
      return [...common, "白痴身份可以选择拍出或隐藏；翻牌免死是公开规则，不代表你能代替其他好人投票。"];
    case "KNIGHT":
      return [...common, "骑士身份可以选择拍出或隐藏；决斗判断必须包装成公开发言、身份声明和票型证据。"];
    case "GUARD":
      return [...common, "守卫身份可以选择拍出或隐藏，但不能把守护目标说成全桌公开事实。"];
    case "VILLAGER":
      return [...common, "闭眼平民没有夜间信息，不能伪造查验、具体刀口、救毒目标或狼队视角。"];
  }
}

function formatSeatList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map((seat) => seatText(seat)).join("、") : "无";
}

function buildClaimAttributionBoundaryLines(view: AgentView): string[] {
  return buildClaimAttributionBoundaryLinesFromClaimBoard(view.publicSummary.claimBoard);
}

function buildClaimAttributionContractLines(view: AgentView): string[] {
  return buildClaimAttributionBoundaryLines(view).map((line) => `身份归属硬约束：${line}`);
}

function buildClassTrialBlackCheckAgendaContractLines(view: AgentView): string[] {
  if (view.day !== 1 || view.roleCard?.theme !== "class-trial") return [];
  const hasPublicBlackCheck = view.publicSummary.claimBoard.some(
    (claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "WEREWOLF"),
  );
  if (!hasPublicBlackCheck) return [];
  return [
    "D1已有公开查杀时，后续查验安排不是本轮主线；先看有没有对跳、查杀位如何正面回应、谁公开对撞这条查杀。",
    "不能把查杀位的个人解释讲顺当成改判条件；反对这条查杀的人要公开承担反对理由，真预言家不会把自己的查杀说成别人再决定是否成立的材料。",
    "平安夜只作公开背景，不把它当成攻击预言家或查杀位的主要理由。",
  ];
}

function buildBlackCheckTimingFactLines(view: AgentView): string[] {
  return getPriorSpeechBlackCheckTimelines(view).map(
    ({ claimant, target }) =>
      `查杀时序：${seatText(target)}的本日发言发生在${seatText(claimant)}报查杀之前；评价这段时正确表述是“${target.seatId}号查杀前的发言/原话”，${target.seatId}号原话不是对${claimant.seatId}号查杀声明的回应或质疑；若要讨论查杀后的表现，只能引用公开记录中查杀之后的新发言。`,
  );
}

function buildTodaySpeechOrderBriefingLine(speechOrder: LlmSpeechInput["publicContext"]["speechOrder"]): string {
  return `今日完整发言顺序：${formatSeatList(speechOrder.todaySpeechOrder)}。`;
}

function buildCurrentSpeechOrderPositionLine(speechOrder: LlmSpeechInput["publicContext"]["speechOrder"]): string {
  const position = speechOrder.currentSpeakerOrderIndex >= 0 ? speechOrder.currentSpeakerOrderIndex + 1 : undefined;
  const previous = position ? speechOrder.todaySpeechOrder[position - 2] : undefined;
  const next = position ? speechOrder.todaySpeechOrder[position] : undefined;
  const previousText = previous ? `上一位是${seatText(previous)}` : "前面没有同日发言位";
  const nextText = next ? `下一位是${seatText(next)}` : "后面没有同日发言位";
  return position
    ? `当前是今日第${position}位发言，${previousText}，${nextText}。`
    : `当前发言席不在今日发言队列中；只按公开已发言记录和后续未发言名单判断。`;
}

function buildFirstSpeakerBriefingLine(speechOrder: LlmSpeechInput["publicContext"]["speechOrder"]): string | undefined {
  const first = speechOrder.todaySpeechOrder[0];
  if (!first) return undefined;
  return `今日首置位：${seatText(first)}；只有这个座位可称首置位，其他已发言座位请称前置位、上一位或具体座位。`;
}

function buildFutureSeatMentionOrderLine(speechOrder: LlmSpeechInput["publicContext"]["speechOrder"]): string | undefined {
  const nextUnspoken = speechOrder.currentDayUnspokenSeats[0];
  if (!nextUnspoken) return undefined;
  return `后置位点名顺序：如果只是保留观察，默认不点具体后置位；如果确实要问人，优先只问“下一位${seatText(
    nextUnspoken,
  )}”一个具体问题；若连续点多个后置位，按今日顺序连续点名，不要无理由跳过中间后置位。`;
}

function buildPostSpeechChallengeFactLines(view: AgentView): string[] {
  return getPostSpeechChallengeTimelines(view).map(({ target, challengers, theme }) => {
    const challengeLead = challengers.length >= 2 ? "后续多人" : `后续${formatSeatList(challengers)}`;
    return `追问时序：${challengeLead}追问${seatText(target)}的${theme}，但这些追问发生在${target.seatId}号本轮发言之后；${target.seatId}号本轮尚无再次发言机会。正确表述是“后置位持续追问/形成压力”，不是“${target.seatId}号没回/没回应”。`;
  });
}

function buildClaimAttributionBoundaryLinesFromClaimBoard(claimBoard: AgentView["publicSummary"]["claimBoard"]): string[] {
  const seerClaimantIds = new Set(
    claimBoard.filter((claim) => claim.claimedRole === "SEER").map((claim) => claim.claimant.seatId),
  );
  return claimBoard
    .filter((claim) => claim.claimedRole === "SEER")
    .flatMap((claim) =>
      claim.checks
        .filter((check) => check.result === "WEREWOLF" && !seerClaimantIds.has(check.target.seatId))
        .map(
          (check) =>
            `${seatText(claim.claimant)}才是预言家声明者；${seatText(check.target)}只是被报查杀对象，除非${check.target.seatId}号也公开跳预言家，否则不能说认${check.target.seatId}号预言家；如果你不信${claim.claimant.seatId}号，只能说“不认${claim.claimant.seatId}号预言家”或“保${check.target.seatId}号查杀位”。`,
        ),
    );
}

function formatSeatNumberList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map((seat) => `${seat.seatId}号`).join("、") : "无";
}

function clipBriefingText(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function parseSpeechDecision(rawOutput: string): { success: true; speech: string } | { success: false; issue: string } {
  if (looksLikeTransportArtifact(rawOutput)) {
    return { success: false, issue: "LLM speech output contained transport metadata instead of speech." };
  }

  try {
    const candidate = parseLlmJsonOutput(rawOutput);
    const coerced = coerceSpeechPayload(candidate);
    const parsed = SpeechSchema.safeParse(coerced);
    if (parsed.success) {
      return { success: true, speech: parsed.data.speech };
    }
  } catch {
    // Free-speech mode treats malformed JSON as text instead of rejecting it.
  }

  const looseSpeech = extractLooseSpeechField(rawOutput);
  if (looseSpeech) {
    return { success: true, speech: looseSpeech };
  }

  const plainSpeech = coercePlainSpeech(rawOutput);
  if (plainSpeech) {
    return { success: true, speech: plainSpeech };
  }

  return { success: false, issue: "LLM 输出格式不合法。" };
}

function looksLikeTransportArtifact(rawOutput: string): boolean {
  const clean = rawOutput.trim();
  return (
    /^data:\s*[{[]/i.test(clean) ||
    /"object"\s*:\s*"chat\.completion\.chunk"/i.test(clean) ||
    /"system_fingerprint"\s*:|"prompt_tokens"\s*:|"completion_tokens"\s*:/i.test(clean)
  );
}

function coerceSpeechPayload(value: unknown): { speech: string } | undefined {
  if (typeof value === "string") return { speech: value };
  if (!value || typeof value !== "object") return undefined;

  for (const key of ["speech", "message", "text", "utterance", "line"]) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === "string" && field.trim()) return { speech: field };
  }

  return undefined;
}

function extractLooseSpeechField(rawOutput: string): string | undefined {
  const clean = rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const quoted = clean.match(
    /(?:^|[\s{,])["']?speech["']?\s*[:：]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|“([^”]*)”)/i,
  );
  const unclosedQuoted = clean.match(/(?:^|[\s{,])["']?speech["']?\s*[:：]\s*(?:"([^"]*)$|'([^']*)$|“([^”]*)$)/i);
  const unquoted = clean.match(/^(?:发言|speech|输出|回答)\s*[:：]\s*([\s\S]+)$/i);
  const speech = (quoted?.[1] ?? quoted?.[2] ?? quoted?.[3] ?? unclosedQuoted?.[1] ?? unclosedQuoted?.[2] ?? unclosedQuoted?.[3] ?? unquoted?.[1])
    ?.replace(/\\n/g, " ")
    .replace(/\\"/g, "\"")
    .trim();
  if (!speech) return undefined;
  return speech;
}

function coercePlainSpeech(rawOutput: string): string | undefined {
  const stripped = rawOutput
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:发言|speech|输出|回答)\s*[:：]\s*/i, "")
    .trim()
    .replace(/^["“”']|["“”']$/g, "");
  if (!stripped) return undefined;
  if (/^[{[]?\s*["']?(?:speech|message|text|utterance|line)["']?\s*[:：]\s*["']?\s*[}\]]?$/i.test(stripped)) {
    return undefined;
  }
  return stripped;
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

function validatePlainSpeechFormatting(speech: string): string[] {
  if (/(?:\*\*|```|^>\s|\[[^\]]+\]\([^)]+\))/m.test(speech)) {
    return ["发言包含非对白Markdown格式"];
  }
  return [];
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
    if (!hasPublicCheck) return ["凭空引用未公开查验结果"];
  }
  return [];
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
  const numeric = value.match(/(\d{1,2})/);
  if (numeric) {
    const parsed = Number(numeric[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const clean = value.trim().toLowerCase();
  const match = seats.find((seat) => seat.name && seat.name.trim().toLowerCase() === clean);
  return match?.seatId;
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
        nightInstruction: view.privateKnowledge.wolfTeamPlan?.nightStrategy?.summary,
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

function buildSpeechConstraints(
  view: AgentView,
  plan: SpeechPlan,
  strictness: SpeechStrictness,
  speechContract: LlmSpeechContract,
): string[] {
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);
  const deathShapeConstraints = deathShapeAlreadyDiscussed
    ? [
        "狼人杀允许低信息推测：可以说“我猜/我倾向/大概率/按规则推”，并用这种推测推动追问、站边和票口。",
        "死亡形态已作为背景处理；本轮不要主动复读药线、刀口、毒口或空刀，只在直接相关时一句带过，然后接怀疑、暂放、追问或投票条件。",
        "普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态。",
      ]
    : [
        "狼人杀允许低信息推测：可以说“我猜/我倾向/大概率/按规则推”，并用这种推测推动追问、站边和票口。",
        "首夜单死只一句带过：狼刀成功，女巫没救。平安夜只一句带过：女巫用了救药。首夜狼刀通常没有公开意图信息，不追问别人为什么刀这个人。说完必须接自己的判断动作。",
        "普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态。",
        "正常发言不要展开空刀或药线；不要把死亡形态当成发言主线，也不要把它交给后置位重复解释。",
      ];
  const interactionConstraints = buildSpeechInteractionConstraints(plan, speechContract);
  const sharedConstraints = [...deathShapeConstraints, ...interactionConstraints];
  if (strictness === "strict") {
    const strictConstraints = [
      ...sharedConstraints,
      "只输出白天公开发言，不输出投票、夜晚动作或解释 JSON 之外的内容。",
      "必须遵守 speechPlan 的 kind、target、talkingPoints、interaction、personaCue 和 claimIntent，不新增身份声明或查验。",
      "每段发言必须锚定至少一个局内对象或公开事件：座位、上一段发言、死讯、票型、身份声明或查验；不要输出寒暄、规则解释或模型自述。",
      "currentDayUnspokenSeats 里的后置位只能被点一个具体问题，不得说他们已经发言少、信息量少、没站边、没回应死讯或只给结论；speakersAlreadyFinished 只能回看，不能要求后续补充。",
      "如果要打已经发过言的位置，直接落成“我按这个缺口压票/挂观察/不直接归死”；不要写“你再解释、你补、你复述、轮到你回应”。",
      "发言只像桌上玩家一样引用公开发言、死讯、票型和身份声明；不要解释信息来自哪里。",
      "可以质疑或站边公开声明，但必须写成公开判断，不写成确定真相。",
      "不要套固定模板；每句话都要服务于当前局面里的一个判断、保留、追问或公开动作。",
      "参考 expertStrategy 的博弈原则组织逻辑，但不要逐字复述成攻略。",
    ];

    if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check) {
      strictConstraints.push(
        `必须报出 ${plan.claimIntent.check.targetSeatId}号${
          plan.claimIntent.check.result === "WEREWOLF" ? "查杀" : "金水"
        }，不得改目标或结果。`,
      );
      if (plan.claimIntent.check.result === "GOOD") {
        strictConstraints.push("报金水后不得同段把该金水当出人焦点、怀疑焦点或压票对象；重点应转向谁反打或硬踩金水。");
      } else {
        strictConstraints.push("真预言家报查杀后不能让查杀位靠自证把今天焦点推走；先用自己的视角压住查杀，反对者必须公开和你的结果对撞。");
      }
    }

    if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
      strictConstraints.push("狼人视角只用于表达策略，不得在发言里暴露狼队或把狼队友报成查杀。");
    }

    const protectedDeadSeerGoldIds = [...deadSeerGoldSeatIds(view.publicSummary.tableMemory)];
    if (protectedDeadSeerGoldIds.length > 0) {
      strictConstraints.push(
        `Public dead seer gold protection: dead seer gold seat ${protectedDeadSeerGoldIds.join(
          ", ",
        )} should be treated as protected public gold water; do not pressure, exile, or make it today's vote focus unless you cite hard public counter-evidence.`,
      );
    }

    return strictConstraints;
  }

  return sharedConstraints;
}

function buildSpeechInteractionConstraints(plan: SpeechPlan, speechContract: LlmSpeechContract): string[] {
  const target = plan.target ? `${plan.target.seatId}号` : "无目标";
  const contract = `SpeechPlan interaction contract: speechContract.move=${speechContract.move}; target=${target}; targetSpeechStatus=${
    plan.targetSpeechStatus ?? "none"
  }; allowedInteraction=${plan.allowedInteraction ?? "none"}。`;
  switch (plan.allowedInteraction) {
    case "review_spoken":
      return [contract, "allowedInteraction=review_spoken：只能回看目标已发表内容，不能要求目标后续补充、轮到时回应或后面解释。"];
    case "ask_future":
      return [contract, "allowedInteraction=ask_future：目标尚未发言，只能留一个与当前发言链相关的具体问题；不能提前评价他已经回应差、信息少或只给结论。"];
    case "finalize_black_check":
      return [contract, "allowedInteraction=finalize_black_check：真预言家查杀先压住查杀位，不给查杀位靠自证推走今天焦点；反对者必须公开和你的结果对撞。"];
    default:
      return [contract];
  }
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
    .replace(/狼队冲锋位把票压向/g, "我想把票压向")
    .replace(/狼队倒钩位对/g, "我对")
    .replace(/狼队/g, "公开")
    .replace(/队友/g, "同边玩家")
    .replace(/WHITE_WOLF_KING|WOLF_BEAUTY|WEREWOLF|WOLF_KING|VILLAGER|SEER|WITCH|HUNTER|KNIGHT|GUARD/gi, "");
}

function toTargetFromSeatId(view: AgentView, seatId: number): ActionTarget {
  return (
    view.aliveSeats.find((seat) => seat.seatId === seatId) ??
    view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === seatId) ?? {
      seatId,
      name: `${seatId}号`,
    }
  );
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

function dilutesSeerBlackCheckWithObserverCondition(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const sentences = speech.split(/[。！？；]/).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.some((sentence) => {
    const mentionsTarget = new RegExp(targetText).test(sentence) || /查杀位|查杀/.test(sentence);
    if (!mentionsTarget && !/(?:外置位|有人|别人|之后|后面|后续)/.test(sentence)) return false;
    return (
      new RegExp(`(?:先别急着|别急着|不要急着|暂时别|先不急着).{0,18}(?:把|让)?${targetText}.{0,16}(?:放过去|轻放|放一轮|放掉|过掉)`).test(sentence) ||
      /(?:除非|只有|如果|要是)[^。！？；]{0,36}(?:更硬的?身份信息|硬身份反证|直接反跳预言家|反跳预言家|公开反证)[^。！？；]{0,24}(?:否则|才|改变结构|改结构|改变处理|改判)/.test(sentence) ||
      /(?:外置位|有人|别人)[^。！？；]{0,24}(?:更硬的?身份信息|硬身份反证|直接反跳预言家|反跳预言家|公开反证)/.test(sentence) ||
      /(?:讨论|桌面|结构)[^。！？；]{0,12}(?:应该|先)[^。！？；]{0,18}(?:压住|围绕|处理)[^。！？；]{0,12}(?:这个位置|查杀位)/.test(sentence)
    );
  });
}

function speechMentionsExplicitBlackCheck(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  return (
    new RegExp(`${targetText}[^。！？；]{0,20}(?:是|为|作为|这张牌是|这张)?.{0,6}查杀(?:位|牌|结果)?`).test(speech) ||
    new RegExp(`${targetText}[^。！？；]{0,24}(?:结果|查验结果|验出来|查出来)[^。！？；]{0,8}(?:是|为)?[^。！？；]{0,4}狼人`).test(speech) ||
    new RegExp(`${targetText}[^。！？；]{0,20}(?:是|为|作为|这张牌是|这张)?.{0,6}狼(?:人|牌)?`).test(speech) ||
    new RegExp(`查杀位[^。！？；]{0,8}${targetText}`).test(speech)
  );
}

function hasSeerBlackCheckVoteBoundary(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  return (
    new RegExp(`${targetText}[^。！？；]{0,56}(?:票口|归票|压票|落票|投|出|推|先压|先走|今天票|今天先|外置位|硬身份反证|不分票|不散票|改结构|改变结构)`).test(speech) ||
    new RegExp(`(?:票口|归票|压票|落票|投|出|推|走|先压|先走|全票|今天票|今天先|外置位|硬身份反证|不分票|不散票|改结构|改变结构)[^。！？；]{0,56}${targetText}`).test(speech) ||
    new RegExp(`(?:今天我的票|我的票|票口)[^。！？；]{0,24}(?:你|他|她)[^。！？；]{0,12}${targetText}`).test(speech) ||
    /(?:票口|归票|压票|落票|今天票|今天先|今天我投|我的票|我会投|我要投|全票|外置位|硬身份反证|不分票|不散票|改结构|改变结构)/.test(speech) ||
    new RegExp(`今天[^。！？；]{0,24}${targetText}[^。！？；]{0,24}(?:必须|要|先)?[^。！？；]{0,12}(?:正面)?(?:接|回应)[^。！？；]{0,18}(?:我的)?(?:查验|结果|查杀)`).test(speech) ||
    /今天[^。！？；]{0,24}(?:必须|要|先)?[^。！？；]{0,12}(?:正面)?(?:接|回应)[^。！？；]{0,18}(?:这个)?(?:结果|查杀)/.test(speech) ||
    /全桌[^。！？；]{0,24}(?:怎么处理|处理)[^。！？；]{0,24}(?:从|看)[^。！？；]{0,18}(?:回应|接)/.test(speech)
  );
}

function activelyExplainsFirstCheckMotive(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const makesFirstCheckTopic =
    /(?:不展开|不主动展开)[^。！？；]{0,18}(?:第一晚|首夜|首验)[^。！？；]{0,24}(?:为什么|理由|心路|选|验|查)/.test(
      speech,
    ) ||
    /(?:第一晚|首夜|首验)[^。！？；]{0,24}(?:为什么|理由|心路)[^。！？；]{0,24}(?:不展开|不主动展开|不聊|不说)/.test(
      speech,
    );
  if (makesFirstCheckTopic) {
    return true;
  }
  if (/(?:不作为(?:桌面)?主攻点|不是核心|不是主要|不是今天主线|不作(?:为)?今天主线|非今天主线)/.test(speech)) {
    return false;
  }
  return (
    new RegExp(`(?:选|选择|挑|查|验)[^。！？；]{0,18}${targetText}[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)`).test(speech) ||
    new RegExp(`${targetText}[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)`).test(speech) ||
    /(?:我选|选择|挑了|选她|选他|选这个位置|验她|验他|查她|查他)[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)/.test(
      speech,
    ) ||
    /(?:验人理由|首验理由|查验理由|选人理由)[^。！？；]{0,8}(?:是|因为|来自|在于)/.test(speech) ||
    /(?:首验选|首夜选|第一晚选|第一晚验)[^。！？；]{0,18}(?:是|因为|我自己的判断|判断)/.test(speech) ||
    /(?:首夜|第一晚)[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)/.test(speech)
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

function isOrdinaryLowInfoOpeningTemplate(text: string): boolean {
  const speech = normalizeDigits(text);
  const peacefulPutAside =
    /平安夜[^。！？；]{0,24}(?:女巫用药|用药)[^。！？；]{0,24}(?:这个)?先(?:放着|放一放|记着|记下)/.test(speech) ||
    /(?:女巫用药|用药)[^。！？；]{0,24}平安夜[^。！？；]{0,24}(?:这个)?先(?:放着|放一放|记着|记下)/.test(
      speech,
    );
  const backSeatWatch =
    /(?:先看|看)[^。！？；]{0,16}(?:后置位|后面|后续|全场|整体)/.test(speech) &&
    /(?:借平安夜|回避第一个压力|回避压力|带节奏)/.test(speech);
  const firstSeatSelfFrame = /(?:我首置位|我没(?:什么|有)?前置发言可抓|我第一个发言|我第一位发言)/.test(speech);
  return peacefulPutAside && (backSeatWatch || firstSeatSelfFrame);
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

function isOrdinaryPressureSourceQuestionAxis(text: string): boolean {
  const speech = normalizeDigits(text);
  const pressureSourceCue =
    /(?:只有|只(?:有)?|仅(?:有)?)[^。！？；]{0,18}(?:一个人|你自己|他自己)[^。！？；]{0,18}(?:发言|说话|开口)[^。！？；]{0,34}(?:压力源|观察点|来源|谁在|谁借|谁回避)/.test(
      speech,
    ) ||
    /(?:压力源|观察点|公开依据|来源)[^。！？；]{0,20}(?:在哪|在哪里|哪来|从哪来|没有来源|没来源|太空|太泛|不成立)/.test(
      speech,
    );
  const emptyDirectionCue =
    /(?:只有|只给|只留|只抛)[^。！？；]{0,18}(?:观察点|发言缺口|压力|问题)[^。！？；]{0,26}(?:没有|没|不给|没给)[^。！？；]{0,12}(?:结论|方向|站边|判断|票口)/.test(
      speech,
    ) ||
    /(?:没有|没|未|不给|没给)[^。！？；]{0,14}(?:站边|判断|结论|方向|票口)[^。！？；]{0,18}(?:只有|只给|只留|观察点|发言缺口)/.test(
      speech,
    ) ||
    /信息最少[^。！？；]{0,18}(?:敢|该|应该)[^。！？；]{0,8}给方向|(?:首置位|首位|前置位)[^。！？；]{0,24}(?:只有|只给|只留)[^。！？；]{0,10}观察点[^。！？；]{0,18}(?:没有|没)[^。！？；]{0,8}(?:结论|方向|判断)/.test(
      speech,
    );
  const borrowedCue = /(?:借平安夜带节奏|回避第一个压力|谁回避压力|谁在借平安夜)/.test(speech);
  return pressureSourceCue || emptyDirectionCue || borrowedCue;
}

function isOrdinaryPressureChainCalloutWithPivot(text: string): boolean {
  const speech = normalizeDigits(text);
  const callsOutRepeat = /(?:重复|复读|一样|同一|几乎一模一样|都在|连续|跟风|跟压)[^。！？；]{0,28}(?:压力源|观察点|结论|方向|这一句|这个点|缺口|发言缺口|同一句)/.test(
    speech,
  );
  const borrowedPeaceNightAxis = /(?:借平安夜带节奏|后置位有没有人借平安夜|谁在借平安夜)/.test(speech);
  const pivots =
    /(?:改审|转看|改看|先看|去看|我看|审一下|查一下|检查)[^。！？；]{0,32}(?:复读者|跟压者|跟风位|没有新增理由|新增理由|压力链|票型动机|反应差|身份线)/.test(
      speech,
    ) ||
    /(?:不把|不单点|不直接把|不直接归死)[^。！？；]{0,18}(?:1号|首置位|焦点位|他|她)/.test(speech) ||
    /(?:身份线|女巫线|银水|票型动机|反应差)[^。！？；]{0,36}(?:更值得先审|更值得审|先审|先看|先接|摆在这里)/.test(
      speech,
    ) ||
    /(?:转向|转回|说回)[^。！？；]{0,24}(?:身份线|女巫|银水)/.test(speech);
  return (callsOutRepeat || borrowedPeaceNightAxis) && pivots;
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

function normalizeOrdinarySurfaceForCopyCheck(text: string): string {
  return text
    .replace(/“[^”]{0,160}”/g, "")
    .replace(/"[^"]{0,160}"/g, "")
    .replace(/\d+\s*号[A-Za-z\u4e00-\u9fff_-]{0,18}/g, "X号")
    .replace(/(?:DeepSeek|Claude|GPT|豆包|Mimo|Gemini)/g, "")
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
}

function hasSharedSurfaceSpan(left: string, right: string, minLength: number): boolean {
  if (left.length < minLength || right.length < minLength) return false;
  let previous = new Array(right.length + 1).fill(0) as number[];
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array(right.length + 1).fill(0) as number[];
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] !== right[j - 1]) continue;
      current[j] = previous[j - 1] + 1;
      if (current[j] >= minLength) return true;
    }
    previous = current;
  }
  return false;
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

function hasOrdinaryCardSurface(text: string): boolean {
  return /(?:听着卡|有点卡|最卡|卡(?:的|住|得|了我一下|了一下|一下|这句|这个点|的是|在)|我卡|先卡)/.test(text);
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

function hasOrdinaryHandlingAction(speech: string): boolean {
  return /(?:先不(?:投|压|跟|定|打死|站死|归死)|不急(?:着)?(?:投|压|跟|定|站死|归死)|暂放|暂时放|先放一下|先认|我认|追问|问\d+\s*号|票(?:口|投|压)|投|压|跟压|解释|回应|改口|先过|我过|过了|带票|带节奏|带方向|出人|归票|保留|放一轮|听进来|不跟)/.test(
    speech,
  );
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

function hasPublicSeerCheck(view: AgentView): boolean {
  if (view.publicSummary.claimBoard.some((claim) => claim.claimedRole === "SEER" && claim.checks.length > 0)) {
    return true;
  }

  return currentDaySpeechItems(view).some((item) => {
    if (item.speaker?.seatId === view.mySeatId) return false;
    const message = item.message;
    return (
      /(?:预言家|我(?:昨晚)?(?:查验|验了|查了|报验)|查杀|金水)/.test(message) &&
      /(?:查杀|金水|验出[^。！？；]{0,12}(?:狼|好人)|结果是(?:狼|好人)|是狼人|是狼|是好人)/.test(message)
    );
  });
}

function hasPublicSeerBlackCheck(view: AgentView): boolean {
  if (
    view.publicSummary.claimBoard.some(
      (claim) => claim.claimedRole === "SEER" && claim.checks.some((check) => check.result === "WEREWOLF"),
    )
  ) {
    return true;
  }

  return currentDaySpeechItems(view).some((item) => {
    if (item.speaker?.seatId === view.mySeatId) return false;
    const message = item.message;
    return (
      /(?:预言家|我(?:昨晚)?(?:查验|验了|查了|报验)|查杀)/.test(message) &&
      /(?:查杀|验出[^。！？；]{0,12}狼|结果是狼|是狼人|是狼)/.test(message)
    );
  });
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

function repairGeneratedClassTrialSpeech(view: AgentView, speech: string): string {
  if (view.roleCard?.theme !== "class-trial") return speech;
  return speech
    .replace(/校验(?:没有|没|不)闭合/g, "话没接上")
    .replace(/证据链(?:没有|没|不)闭合/g, "说法没接上")
    .replace(/证词(?:没有|没|不)闭合/g, "证词没接上")
    .replace(/(?:没有|没|不)闭合/g, "没接上")
    .replace(/闭合|闭环/g, "接上")
    .replace(/身份动作和公开边界/g, "身份说法和公开发言")
    .replace(/公开边界的连接/g, "公开发言之间的连接")
    .replace(/外置硬身份反证/g, "外面有人拍硬身份反证")
    .replace(/票口边界/g, "今天要压哪里的界限")
    .replace(/起跳收益/g, "跳身份的收益")
    .replace(/唯一能接的线/g, "唯一说得通的路")
    .replace(/能接的线/g, "说得通的路")
    .replace(/结构接上|结构接线/g, "说法接上")
    .replace(/票口理由/g, "投票理由")
    .replace(/弱证据替代/g, "拿很薄的证据替自己下结论");
}

function naturalizeOrdinarySpeechText(text: string): string {
  return repairDuplicatedWordSlipText(text)
    .replace(/从全桌视角看/g, "按我现在听到的")
    .replace(/站在全桌视角/g, "按我现在听到的")
    .replace(/全桌视角/g, "我现在听到的")
    .replace(/上帝视角/g, "我自己这边听到的")
    .replace(/收益来源/g, "为什么现在怀疑他")
    .replace(/死亡形态/g, "这个死法")
    .replace(/死亡播报/g, "昨晚的死讯")
    .replace(/死亡名单/g, "昨晚的死讯")
    .replace(/反面可能性/g, "另一种可能")
    .replace(/按公开规则/g, "按大家都知道的规则")
    .replace(/按规则推/g, "按我理解")
    .replace(/规则推/g, "按我理解")
    .replace(/毒药重合刀口/g, "女巫毒的人刚好也是狼刀的人")
    .replace(/信息边界/g, "能确定的事")
    .replace(/我先报名单/g, "我先说我看到的")
    .replace(/铺全场/g, "把全场都盘一遍")
    .replace(/收票口/g, "把票往一个人身上带")
    .replace(/发言链条/g, "前后说法")
    .replace(/发言链/g, "前后说法")
    .replace(/证据链/g, "前后说法")
    .replace(/信息闭合/g, "说清楚")
    .replace(/过程闭合/g, "过程说清楚")
    .replace(/(?:没有|没|不)闭合/g, "没说清楚")
    .replace(/闭合|闭环/g, "说清楚")
    .replace(/当前先审你的发言缺口/g, "我先听你哪里没说清")
    .replace(/先审(.{0,18})的发言缺口/g, "先听$1哪里没说清")
    .replace(/发言缺口/g, "没说清的地方")
    .replace(/我先认这个身份空间/g, "这个身份我先认下来")
    .replace(/先认这个身份空间/g, "先认这个身份")
    .replace(/认了这个身份空间/g, "认了这个身份")
    .replace(/认这个身份空间/g, "认这个身份")
    .replace(/认了身份空间/g, "认了这个身份")
    .replace(/认身份空间/g, "认这个身份")
    .replace(/身份空间/g, "身份")
    .replace(/你打算怎么用这个信息/g, "你的票准备往哪放")
    .replace(/自己打算怎么用这个信息/g, "自己的票准备往哪放")
    .replace(/打算怎么用这个信息/g, "票准备往哪放")
    .replace(/怎么用这个信息/g, "票往哪放")
    .replace(/谁是起票的、谁是补票的、谁是最后跟票的/g, "谁先把票带起来、谁顺着跟上")
    .replace(/起票、补票、最后跟票/g, "谁先带票、谁顺着跟、谁最后补上")
    .replace(/起票和补票位置/g, "谁先把票带起来、谁顺着跟上")
    .replace(/最后跟票/g, "最后跟上")
    .replace(/起票/g, "先把票带起来")
    .replace(/补票/g, "顺着跟票")
    .replace(/收口/g, "最后想投谁")
    .replace(/压力源/g, "让人开始怀疑他的点")
    .replace(/这(?:句|段)?话本身/g, "这句话")
    .replace(/这(?:句|段)?话其实/g, "这句话")
    .replace(/这话本身/g, "这句话")
    .replace(/这个点卡得有道理/g, "这个点说得有道理")
    .replace(/卡得有道理/g, "说得有道理")
    .replace(/听着有点卡/g, "听着有点没听明白")
    .replace(/觉得有点卡/g, "有点没听明白")
    .replace(/有点卡/g, "有点没听明白")
    .replace(/我有个地方卡住了/g, "我有个地方没听明白")
    .replace(/有个地方卡住了/g, "有个地方没听明白")
    .replace(/卡住了/g, "没听明白")
    .replace(/有个地方卡我/g, "有个地方我没听明白")
    .replace(/这个点卡我/g, "这个点我没听明白")
    .replace(/我卡的点/g, "我没听明白的点")
    .replace(/卡我/g, "我没听明白")
    .replace(/(?:把|将)(\d+\s*号[^。！？；，,]{0,16})放进观察位/g, "先不把$1投死")
    .replace(/(?:把|将)(\d+\s*号[^。！？；，,]{0,16})放观察位/g, "先不把$1投死")
    .replace(/先放观察位/g, "先不急着投")
    .replace(/看前后理由能不能接上/g, "看后面能不能把话说清楚")
    .replace(/平安夜只是背景，真正的判断动作太轻/g, "只说了平安夜，但没说自己怀疑谁")
    .replace(/和刚才那段发言放一起核/g, "刚才那句话我先记下来")
    .replace(/放一起核/g, "放一起看")
    .replace(/昨夜死讯我先只当成死亡名单：[^。！？；]*[。！？；]?，?不直接反推狼刀、毒或自刀。?/g, "昨夜是平安夜，我先当背景，不拿这个直接定人。")
    .replace(/我先按公开信息盘/g, "我先说我听到的东西")
    .replace(/按当前公开发言和票型走/g, "按我听到的发言和投票来判断")
    .replace(/审计跟压收益/g, "看谁在跟着压人")
    .replace(/跟压收益/g, "跟着压人的理由")
    .replace(/身份收益/g, "身份说法对今天投票的影响");
}

function repairDuplicatedWordSlipText(text: string): string {
  return text
    .replace(/我先先/g, "我先")
    .replace(/先先/g, "先")
    .replace(/现在现在/g, "现在")
    .replace(/然后然后/g, "然后")
    .replace(/但是但是/g, "但是")
    .replace(/就是就是/g, "就是")
    .replace(/这个这个/g, "这个")
    .replace(/那句那句/g, "那句");
}

function misidentifiesSeatAsSeer(speech: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  const shortSameSeatPhrase = "(?:(?!\\d{1,2}\\s*号).)";
  return speech.split(/[。！？；]/).some((sentence) => {
    if (isNegativeSeerAttribution(sentence, seatPattern)) return false;
    return (
      new RegExp(
        `(?:暂时|先|更|比较|倾向)?(?:认|站|信|保|支持|认可)${shortSameSeatPhrase}{0,12}${seatPattern}${shortSameSeatPhrase}{0,12}(?:是|为)?\\s*(?:预言家|预言家牌)`,
      ).test(
        sentence,
      ) ||
      new RegExp(
        `${seatPattern}${shortSameSeatPhrase}{0,12}(?:这张|这个|这位)?(?:预言家|预言家牌)${shortSameSeatPhrase}{0,18}(?:可信|成立|像真|更真|我认|我站|先认|更信)`,
      ).test(
        sentence,
      ) ||
      new RegExp(
        `(?:我认为|我觉得|我判断|我暂时认|我先认)${shortSameSeatPhrase}{0,12}${seatPattern}${shortSameSeatPhrase}{0,8}(?:是|为)\\s*(?:预言家|预言家牌)`,
      ).test(
        sentence,
      )
    );
  });
}

function isNegativeSeerAttribution(sentence: string, seatPattern: string): boolean {
  return (
    new RegExp(`(?:不认|不站|不信|别认|别站|别信|不是|不像|不可能是).{0,12}${seatPattern}.{0,12}(?:预言家|预言家牌)`).test(sentence) ||
    new RegExp(`${seatPattern}.{0,12}(?:不是|不像|不可能是|不配认).{0,12}(?:预言家|预言家牌)`).test(sentence)
  );
}

function validateCompleteQuestionFragments(speech: string): string[] {
  const unfinishedQuestion = /(?:^|[。！？；])[^。！？；]{0,24}(?:为什么|凭什么|怎么)(?:验|查|出|打|认|站|压|跳|说|定|锁|拍)[^。！？；]{0,16}。/;
  const withoutQuotedQuestions = speech.replace(
    /[“‘"「『][^“”‘’"「」『』]{0,80}(?:为什么|凭什么|怎么)[^“”‘’"「」『』]{0,80}[”’"」』]/g,
    "",
  );
  return unfinishedQuestion.test(withoutQuotedQuestions) ? ["发言存在未完成的问题句"] : [];
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

function hasOrdinaryFinalLandingAction(speech: string): boolean {
  const tail = ordinaryFinalLandingWindow(speech);
  return /(?:所以|那我|我(?:这轮|今天|现在|先)?|这票|票)[^。！？；]{0,72}(?:先不(?:投|压|跟|定|打死|站死|归死)|不急(?:着)?(?:投|压|跟|定|站死|归死)|暂放|暂时放|先放一下|先认|我认|我先看|我改看|我先盯|我先压|我压|我投|我不跟|票(?:口|投|压)|先过|我过|过了|保留|放一轮|不跟)/.test(
    tail,
  );
}

function ordinaryFinalLandingWindow(speech: string): string {
  const tail = speech.slice(-190);
  const pivotIndex = [
    "但我想",
    "但今天",
    "但是我想",
    "不过我想",
    "问题是",
    "我想把镜头转一下",
    "我想顺着",
    "我想转回",
    "我重新听",
    "我回头看",
    "这个观察我听进去了",
  ].reduce((latest, marker) => Math.max(latest, tail.lastIndexOf(marker)), -1);
  return pivotIndex >= 0 ? tail.slice(pivotIndex) : tail.slice(-140);
}

function isOrdinaryTruncatedSpeechEnding(clean: string): boolean {
  if (!clean) return false;
  if (hasOrdinaryForwardCommitmentEnding(clean)) return true;
  if (hasOrdinaryForwardCommitmentOnlyRestatement(clean)) return true;
  if (
    /(?:我(?:这轮|现在)?主要想(?:说|聊|点(?:一下)?)|我重点想(?:说|聊|点(?:一下)?))\s*\d{1,2}号?(?:[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})[。！？!?]?$/.test(
      clean.slice(-72),
    )
  ) {
    return true;
  }
  if (hasUnresolvedOrdinaryContrast(clean)) return true;
  if (/[。！？!?」』”"）)]$/.test(clean)) return false;
  const tail = clean.slice(-36);
  return (
    /(?:我先把|我把|先把|我会把|我想把|我准备把|我这轮把)\s*\d{1,2}(?:号)?$/.test(tail) ||
    /(?:我先把|我把|先把|我会把|我想把|我准备把|我这轮把)\s*\d{1,2}号?[A-Za-z0-9_-]{0,16}$/.test(tail) ||
    /(?:卡住了|卡在|问题是|重点是|疑问是|我想问|我想听|听不懂的是|没接上的是)[:：,，、；;\s]*\d{1,2}(?:号)?[A-Za-z0-9_-]{0,16}$/.test(tail) ||
    /(?:我倒想知道|倒想知道|我想知道|想知道|我想听听|想听听)$/.test(tail) ||
    /(?:能撑住的)?(?:只有|只剩|剩下的只有|我能认的只有)$/.test(tail) ||
    /(?:我(?:现在|这轮)?想转一下视线|转一下视线|原话我再过一遍|刚才那段原话我再过一遍|我再过一遍)$/.test(tail) ||
    /(?:你|我|他|她|它|这里|这边)?(?:留了|留下|留着)$/.test(tail) ||
    /(?:你铺的|你说的|刚才那|前面那|这|那)(?:句|句话|段|个点|个观察点)$/.test(tail) ||
    /(?:说|提|讲)?(?:[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:那句|这句|那句话|这句话)$/.test(tail) ||
    /(?:^|[，,。！？!?；;\s])(?:你|他|她|它|[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:刚才|前面|后面)?(?:又)?说$/.test(tail) ||
    /(?:但|但是|不过|可是|可)[^。！？；]{0,32}(?:你|他|她|它|[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:后面|前面|刚才)?又说$/.test(tail) ||
    /(?:但|但是|不过|可是|然而|所以|因为|如果|而且|比如|例如|我想问|我想听|想听|我的问题是|卡我的是|重点是|先把|我先把)[:：,，、；;\s]*$/.test(tail)
  );
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

function trimOrdinaryForwardCommitmentEnding(speech: string): string | undefined {
  const clean = speech.trim();
  const tail = findOrdinaryForwardCommitmentTail(clean);
  if (!tail) return undefined;
  const head = clean.slice(0, tail.index).replace(/[，,;；:：、-]+$/g, "").trim();
  if (!head) return undefined;
  return /[。！？!?；;」』”"）)]$/.test(head) ? head : `${head}。`;
}

function hasOrdinaryForwardCommitmentEnding(clean: string): boolean {
  return Boolean(findOrdinaryForwardCommitmentTail(clean));
}

function findOrdinaryForwardCommitmentTail(clean: string): { index: number; sentence: string } | undefined {
  const withoutClosingPunctuation = clean.replace(/[。！？!?；;]+$/g, "").trim();
  if (!withoutClosingPunctuation) return undefined;
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
  const index = boundaryIndex >= 0 ? boundaryIndex + 1 : 0;
  const sentence = withoutClosingPunctuation.slice(index).trim();
  return isOrdinaryForwardCommitmentSentence(sentence) ? { index, sentence } : undefined;
}

function isOrdinaryForwardCommitmentSentence(sentence: string): boolean {
  const clean = sentence.replace(/\s+/g, "");
  return (
    /^(?:我)?(?:先)?(?:说|讲|解释|交代)(?:一下)?(?:我)?为什么(?:现在|这时候|这个时候)?(?:要)?(?:跳|拍|报)(?:身份|女巫|预言家|猎人)?$/.test(
      clean,
    ) ||
    /^(?:我)?(?:接下来|后面|下面)(?:先)?(?:说|讲|解释|聊)(?:一下)?(?:为什么|这个点|我的理由|我的想法)?$/.test(clean) ||
    /^(?:我)?(?:现在|这轮|今天)?(?:想|准备|打算)(?:换|转)(?:个|一个)?(?:方向|角度|视角)(?:看|聊|听)?$/.test(clean) ||
    /^(?:我)?(?:还)?有(?:个|一个)?(?:更)?(?:让|令)?我(?:更)?(?:不舒服|别扭|卡住|没听明白)(?:的)?(?:地方|点|一件事|问题)?$/.test(
      clean,
    )
  );
}

function hasOrdinaryForwardCommitmentOnlyRestatement(clean: string): boolean {
  const sentences = (clean.match(/[^。！？；;]+[。！？；;]?/g) ?? [])
    .map((sentence) => sentence.replace(/[。！？；;]+$/g, "").trim())
    .filter(Boolean);
  if (sentences.length < 2) return false;
  for (let index = 0; index < sentences.length - 1; index += 1) {
    if (!isOrdinaryForwardSetupSentence(sentences[index]!)) continue;
    const tail = sentences.slice(index + 1);
    if (tail.length === 0 || tail.length > 2) continue;
    if (tail.every(isPublicInfoRestatementWithoutOwnHandling)) return true;
  }
  return false;
}

function isOrdinaryForwardSetupSentence(sentence: string): boolean {
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

function hasUnresolvedOrdinaryContrast(clean: string): boolean {
  return (
    /(?:我(?:现在|这轮)?想转一下视线|转一下视线|原话我再过一遍|刚才那段原话我再过一遍|我再过一遍|背后藏着一个前提[^。！？；]{0,40}|我记到现在|(?:能撑住的)?(?:只有|只剩|剩下的只有|我能认的只有))[。！？!?]?$/.test(
      clean,
    ) ||
    /(?:有个点|有个地方|有一点|这点|这里)[^。！？；]{0,24}(?:没听明白|不明白|听不懂)[\s\S]{0,160}(?:这部分|这个部分|这里|这句|这一句)[^。！？；]{0,12}(?:我)?(?:理解|能理解|先认|听懂)[。！？]?$/.test(
      clean,
    ) ||
    /(?:但|但是|不过|可是)[^。！？；]{0,140}(?:方向|表态|追问|那句|这句|这句话|那个点|这个点)[^。！？；]{0,34}(?:有点|比较|确实){0,2}(?:问题|模糊|奇怪|怪|不对劲)[。！？]?$/.test(
      clean,
    ) ||
    /(?:重新听|回头再看|再看|听了几遍|我重新听)[\s\S]{0,180}(?:原话|那句|这句|句话)[\s\S]{0,120}(?:越想越不对|越听越不对|越想越怪|越听越怪|有点不对|不对劲|有点怪|奇怪|不舒服|别扭)[。！？]?$/.test(
      clean,
    ) ||
    /(?:[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?[^。！？；]{0,24}(?:刚才|前面)?(?:那句|这句|那句话|这句话|那段|这段|发言|话)[^。！？；]{0,30}(?:我)?(?:有点|比较|确实)?(?:没听明白|不明白|听不懂)[。！？]?$/.test(
      clean,
    ) ||
    /(?:听着|听起来|我觉得|我感觉)[^。！？；]{0,28}(?:有点|比较|挺)?(?:怪|奇怪|别扭|不舒服|不对劲)[\s\S]{0,180}(?:你说|他说|她说|刚才说)[^。！？；]{0,120}[”"」』][。！？]?$/.test(
      clean,
    )
  );
}

function speechMentionsBlackCheck(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}号`;
  return (
    new RegExp(`${targetText}.{0,10}(?:查杀|狼人)`).test(speech) ||
    new RegExp(`(?:查验|验了|验|摸了)\\s*${targetText}.{0,10}(?:查杀|狼人)`).test(speech)
  );
}

function offersBlackCheckReversalToTarget(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const targetOrPronoun = `(?:${targetText}|他|这张牌|查杀位)`;
  const explanationCue = "(?:解释|讲清|说清|闭环|补|回应|自证|讲顺)";
  const reversalCue = "(?:改票|重新考虑|撤压力|放一轮|后移焦点|先不出|不压|票口后移)";
  return (
    new RegExp(`(?:如果|只要)${targetOrPronoun}.{0,28}${explanationCue}.{0,36}${reversalCue}`).test(speech) ||
    new RegExp(`${targetText}.{0,36}(?:如果|只要|能).{0,28}${explanationCue}.{0,36}${reversalCue}`).test(speech) ||
    /查杀位.{0,24}(?:自证|解释).{0,24}(?:改票|重新考虑|后移焦点|放一轮)/.test(speech) ||
    /(?:可改票条件|改票条件|解释能闭环则后移焦点)/.test(speech)
  );
}

function currentDaySpokenSeats(view: AgentView): ActionTarget[] {
  return uniqueSeatOrder(currentDaySpeechItems(view).map((speech) => speech.speaker).filter((seat): seat is ActionTarget => Boolean(seat)));
}

function hasCurrentDaySpeech(view: AgentView, seatId: number): boolean {
  return currentDaySpeechItems(view).some((speech) => speech.speaker?.seatId === seatId);
}

function getPlanTargetSpeechStatus(
  view: AgentView,
  plan: SpeechPlan,
  target: ActionTarget | undefined,
): SpeechPlan["targetSpeechStatus"] {
  if (!target) return "none";
  if (plan.target?.seatId === target.seatId && plan.targetSpeechStatus) return plan.targetSpeechStatus;
  return hasCurrentDaySpeech(view, target.seatId) ? "spoken" : "unspoken";
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasClassTrialOpeningHook(speech: string): boolean {
  return /(?:谁|后置|观察|验证|查验|矛盾|断点|收益|收票|带节奏|借.{0,8}平安夜|接.{0,8}(?:观察|这个点)|回避|身份声明|发言链|票型|压力)/.test(
    speech,
  );
}

function countSentenceLikeUnits(speech: string): number {
  return speech.split(/[。！？；]/).filter((part) => part.trim().length > 0).length;
}

function containsOutOfGameSpeech(speech: string): boolean {
  return /作为(?:一个)?AI|语言模型|大模型|模型无法|我无法参与|无法直接参与|系统|提示词|prompt|JSON|assistant|user|developer|后台|根据提供的信息|这局游戏的规则|我会根据.*进行分析|以下是|总结如下/i.test(
    speech,
  );
}

function containsCheckCue(speech: string, check: ClaimCheck): boolean {
  const targetText = `${check.targetSeatId}号`;
  if (!speech.includes(targetText)) return false;
  return check.result === "WEREWOLF" ? /查杀|狼人/.test(speech) : /金水|好人/.test(speech);
}

function containsTargetReference(speech: string, target: ActionTarget): boolean {
  return speech.includes(`${target.seatId}号`) || speech.includes(target.name);
}

function containsPublicSeatReference(speech: string, target: ActionTarget): boolean {
  return speech.includes(`${target.seatId}号`) || (target.name !== "你" && speech.includes(target.name));
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

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
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

function naturalizeMockReasoningCueText(text: string, maxLength: number, seed = 0): string {
  const stripped = stripTerminalPunctuation(text);
  const pressureChain = stripped.match(/^([A-Za-z\u4e00-\u9fa5]+?)对([A-Za-z\u4e00-\u9fa5]+?)的压力被\d+名后续发言者接住$/);
  if (pressureChain) {
    const [, actor, target] = pressureChain;
    return clipBriefingText(
      pickBySeat(seed, [
        `${target}被${actor}点过，后面也有人跟压`,
        `${actor}先压过${target}，后面有人接了这个方向`,
        `${target}这边不是一个人单点，前后都有人看他`,
        `${actor}那一下没停在单点，后面还有人看${target}`,
      ]),
      maxLength,
    );
  }
  const followPressure = stripped.match(/^([A-Za-z\u4e00-\u9fa5]+?)后续继续施压([A-Za-z\u4e00-\u9fa5]+)$/);
  if (followPressure) {
    const [, actor, target] = followPressure;
    return clipBriefingText(
      pickBySeat(seed, [
        `${actor}后面又压了${target}`,
        `${actor}后面没有放过${target}`,
        `${actor}那票口还在往${target}身上靠`,
        `${actor}继续盯着${target}这条线`,
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

function seatText(seat: ActionTarget): string {
  const name = stripEvaluationModelSuffix(seat.name.trim());
  return name && name !== "你" ? `${seat.seatId}号${name}` : `${seat.seatId}号`;
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

function stripEvaluationModelSuffix(name: string): string {
  if (!/-mimo-/i.test(name)) return name;
  return name.replace(/-mimo-[A-Za-z0-9_.-]+$/i, "").replace(/[-_\s]+$/g, "");
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
      const summary = naturalizeMockReasoningCueText(reasoningCue.summary, 58, naturalSeed);
      const evidence = reasoningCue.evidence[0] ? naturalizeMockReasoningCueText(reasoningCue.evidence[0], 42, naturalSeed + 7) : "";
      const evidenceTail = evidence ? `，再看${evidence}` : "";
      items.push(
        pickBySeat(naturalSeed, [
          `${cueTargetText}这里我主要看${summary}${evidenceTail}`,
          `${cueTargetText}这条线我先记成${summary}${evidenceTail}`,
          `${cueTargetText}被反复点到，我先看${summary}${evidenceTail}`,
          `${summary}这点先挂在${cueTargetText}身上${evidenceTail}`,
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

function stripTerminalPunctuation(text: string): string {
  return text.replace(/[。！？；，、,.!\?\s]+$/g, "").trim();
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

  const checkLine = latestPublicCheck
    ? `${seatText(latestPublicCheck.claim.claimant)}报${seatText(latestPublicCheck.check.target)}${
        latestPublicCheck.check.result === "WEREWOLF" ? "查杀" : "金水"
      }，这条线我先看今天怎么站边，不急着只听一个结论。`
    : "";
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

function formatOrdinaryDeathShapeFallback(latestDeath: string | undefined): string {
  const deathText = latestDeath?.trim().replace(/[。！？!?,，、；;\s]+$/g, "") || "昨晚有人倒牌";
  return `${deathText}，狼刀成功，女巫没救。`;
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

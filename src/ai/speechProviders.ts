import { z } from "zod";
import { extractRoleClaimFromSpeech } from "@/game/claims";
import { ROLE_LABELS } from "@/game/labels";
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
import type { AiSpeechProvider, AiSpeechProviderContext, AiSpeechResult } from "./types";

const SpeechSchema = z.object({
  speech: z.string().min(1),
});

const AI_SPEECH_MAX_CHARS = 360;
const AI_MOCK_SPEECH_MAX_CHARS = 380;
const AI_SPEECH_MAX_SENTENCES = 3;
const SPEECH_SYSTEM_PROMPT =
  "你是狼人杀玩家本人。根据牌桌局势、你的身份信息和你的性格，自由发表这一轮公开发言。优先阅读 input.tableBriefing.text 和 input.publicContext.rules，它们是事实边界和当前板子规则，不是台词模板；input.speechContract 是最高优先级的短约束，必须优先遵守其中的 move、mustSay、mayAsk、mustNotAsk 和 voteBoundary；再参考 input.inferenceLayers、input.expertStrategy、input.advancedReasoning、input.reasoningFrame、input.rolePlaybook、input.claimAudit、input.debateAgenda 和 input.playerSpeechGuide，inferenceLayers 把公开事实、高概率推断、低概率边界和私密未知分开，expertStrategy 是高质量对局打法原则，advancedReasoning 是本局当前应该核验的逻辑清单，reasoningFrame 把硬证据、软信号、反面解释和验证问题拆开，rolePlaybook 是你当前角色的玩法分支和行动边界，claimAudit 专门审计身份坑、查验链和未对跳神职，debateAgenda 是本轮可以追问、收票和验证的动态议程，都不是固定话术。发言要像高阶玩家临场盘逻辑：2-3句短句，观点先落地，给1个公开依据，再留下一个追问或票口；优先串联验人、站边、票型、发言顺序和死亡播报，而不是只给情绪听感，也不要把座位、语气、短发言这类软信息当铁证。模型特点只是软性的打法倾向：例如 DeepSeek 偏逻辑链，Claude 偏边界审查，豆包偏强压，Kimi 偏长线记忆；可以按座位名报自己是谁，但不要说自己是 AI、语言模型或系统角色，也不要为了表现风格牺牲局势判断。不要把内部分析标签说出口，例如“拆因果”“第一点”“盘问议程”“票口条件”“可改票条件”；不要列第一、第二、第三；要把这些材料改写成自然的牌桌发言。只输出玩家实际说出口的台词，不写括号内动作、神态、语气或旁白描写。发言可以有个人风格和策略，但不能违背事实简报：只能评价本日已经发过言的人；已经发过言的人只能回看其已发表内容，不能说等他后面再补、轮到他再回应；对尚未发言的后置位如果必须追问，只点一个和当前发言链相关的位置，留一个具体问题，不能把问题铺成一圈通用作业，也不能说他们已经信息少或没回应；真预言家报查杀后，今天票口先压查杀位，只有外置硬身份反证可以改变结构，不给查杀位靠自证把票口推走的空间；天亮死讯只公开谁死亡，不公开狼刀、毒、自刀等具体死因，除非公开记录写明，不要把私密细节说死。狼人杀大多数时间没有足够硬信息，允许按公开规则和发言状态进行推测、猜测和施压；要把猜测说成“我倾向、我猜、按规则推”，并留下验证条件。无守卫女巫局里，平安夜作为公开死亡形态处理，发言里短句说“女巫用药了”即可；空刀只作为边界，不主动展开。若平安夜已被前置位讲过，就当作已结算背景，不主动复读药线或空刀；非女巫不能说自己知道女巫是谁、具体救了几号、刀口或毒口在哪；真女巫可以公开自己的真实救毒信息，但不能编错目标，也不要只说“我救过人”这种半公开私密状态。药瓶是否使用、是否还在可以按公开死亡形态推理，但不要伪装成私密直知。首夜单死后“女巫没救/没用解药”属于合理简称，不应只因“女巫没救/没用解药”这种说法质疑发言者。";

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

export type LlmSpeechInput = {
  day: number;
  mySeatId: number;
  myRole: Role;
  persona?: AgentView["persona"];
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
      let lastValidationErrors: string[] | undefined;
      let lastRawOutput: string | undefined;

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
            lastValidationErrors = undefined;
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue });
            continue;
          }

          const speech = normalizeSpeech(repairClaimAttributionSpeech(view, normalizeSpeech(parsed.speech)));
          const validationErrors = validateRenderedSpeech(view, plan, speech, strictness);
          if (validationErrors.length > 0) {
            lastIssue = `LLM 发言未通过约束：${validationErrors.join("；")}`;
            lastValidationErrors = validationErrors;
            attempts.push({ attempt, provider: providerId, rawOutput, issue: lastIssue, validationErrors });
            continue;
          }

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

      return fallbackSpeech(
        providerId,
        view,
        plan,
        lastIssue,
        packLlmOutputAttempts(attempts),
        lastValidationErrors,
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
  const constraints = buildSpeechConstraints(view, plan, strictness, speechContract);
  const advancedReasoning = buildAdvancedReasoningNotes(view);
  const reasoningFrame = buildReasoningFrame(view);
  const rolePlaybook = buildRolePlaybook(view);
  const claimAudit = buildClaimAudit(view);
  const debateAgenda = buildDebateAgenda(view, { plan, target: plan.target });
  return {
    day: view.day,
    mySeatId: view.mySeatId,
    myRole: view.myRole,
    persona: view.persona,
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
    playerSpeechGuide: buildPlayerSpeechGuide(view, plan, speechOrder),
    speechContract,
    speechPlan,
    speechStrictness: strictness,
    llmConfig: view.llmConfig,
    ...(constraints.length > 0 ? { constraints } : {}),
  };
}

function buildSpeechContract(
  plan: SpeechPlan,
  speechOrder?: LlmSpeechInput["publicContext"]["speechOrder"],
  view?: AgentView,
): LlmSpeechContract {
  const move = resolveContractMove(plan);
  const targetSpeechStatus = plan.targetSpeechStatus ?? "none";
  const allowedInteraction = plan.allowedInteraction ?? "none";
  const targetLabel = plan.target ? seatText(plan.target) : "目标位";
  const talkingPoints = contractTalkingPoints(plan);
  const mustSay: string[] = [];
  const mayAsk: string[] = [];
  const mustNotAsk: string[] = [
    "不能列第一、第二、第三，也不要说“盘问议程”“票口条件”“可改票条件”。",
  ];
  let voteBoundary: string | undefined;

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
      )}；如果只是留观察，默认说“后置位整体”或“下一位${seatText(
        nextUnspoken,
      )}”；连续点多个后置位时按今日顺序连续，不要无理由跳过中间座位；不要把已发言位置写成“等他轮到”或“后面再补”。`,
    );
  }
  if (view && isLowInfoDayOneOpening(view)) {
    const openingSpeaker = currentDaySpeechItems(view)[0]?.speaker;
    if (openingSpeaker) {
      mustNotAsk.push(`不要把${seatText(openingSpeaker)}没站边、没给票口或没给怀疑对象当攻击点；只能评价观察点是否过泛，或审计后续谁借这个点做收益。`);
    } else {
      mustNotAsk.push("你是低信息首置位：只给观察点即可，不要求自己或下一位立刻站边、给票口、报怀疑对象。");
    }
  }
  if (view && isLowInfoDayOneNoHardInfo(view) && currentDaySpeechItems(view).length > 0) {
    mustNotAsk.push("首日无硬信息阶段不要把任何已发言位“没站边、没给票口、没给怀疑对象”当攻击点；只能审计观察点是否有收益、谁在跟压或谁过早定身份。");
  }
  if (plan.claimIntent?.strength === "soft" && !plan.playMotive?.allowIdentityClaim) {
    const roleLabel = ROLE_LABELS[plan.claimIntent.claimedRole];
    mustNotAsk.push(`不要把软身份边界说成明确${roleLabel}身份。`);
    mayAsk.push(plan.playMotive?.line ?? "可以保留底牌威慑，但不要明拍身份。");
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
      mustSay.push(`${targetLabel}是查杀。`, `今天票口先压${targetLabel}。`);
      mayAsk.push("外置位只给硬身份反证。");
      mustNotAsk.push(`不能说${targetLabel}解释闭环就改票。`, `不能把${targetLabel}自证当改票条件。`);
      voteBoundary = `票口先压${targetLabel}；只有外置硬身份反证能改变结构。`;
      break;
    case "claim_gold_check":
      mustSay.push(`${targetLabel}是金水。`);
      mayAsk.push(`看谁反打或硬踩${targetLabel}。`);
      mustNotAsk.push(`不能把${targetLabel}作为今天出人焦点、怀疑焦点或压票对象。`);
      break;
    case "identity_claim":
      mustSay.push(plan.claimIntent ? `身份声明要与${ROLE_LABELS[plan.claimIntent.claimedRole]}一致。` : "身份声明必须和当前计划一致。");
      if (plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
        const savedTarget = view?.myRole === "WITCH" ? view.privateKnowledge.witch?.savedTarget : undefined;
        if (savedTarget) mustSay.push(`平安夜我救了${savedTarget.seatId}号，${savedTarget.seatId}号是银水。`);
      }
      if (plan.playMotive?.line) mustSay.push(plan.playMotive.line);
      mayAsk.push(...(plan.target ? [`围绕${targetLabel}留下一个公开验证点。`] : ["围绕公开身份线留下一个验证点。"]));
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
      mustSay.push(...(talkingPoints.length > 0 ? talkingPoints.slice(0, 2) : [`把${targetLabel}作为观察位。`]));
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
    maxSentences: AI_SPEECH_MAX_SENTENCES,
    maxChars: AI_SPEECH_MAX_CHARS,
  };
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
  return {
    sheriffEnabled: Boolean(view.privateKnowledge.sheriff),
    note: view.privateKnowledge.sheriff
      ? "本局启用警长竞选、警徽和警下投票；警长白天放逐投票计 1.5 票。"
      : "本局没有警长竞选、警徽、警上、警下流程。",
    deathInfoNote:
      deathShapeAlreadyDiscussed
        ? "平安夜已作为公开死亡形态处理，后续发言不要主动复读药线或空刀；只在和票型、身份线直接相关时一句带过。禁止把推测说成私密确定细节：非女巫不能确定女巫是谁、具体救了几号、刀口或毒口在哪；真女巫可以公开自己的真实救毒信息，但不能编错目标，也不要只说“我救过人”这种半公开私密状态。药瓶状态可以按公开死亡形态推理，但不要伪装成私密直知。无守卫首夜单死后，说“女巫没救/没用解药”属于合理简称，不应只因“女巫没救/没用解药”这种说法质疑发言者。"
        : "天亮死讯只公开死亡名单，不公开具体刀口、毒口、自刀位置或女巫身份；无守卫平安夜直接按公开死亡形态处理，发言里短句说“女巫用药了”即可，不主动展开空刀，也不要把平安夜本身交给后置位重复解释。禁止把推测说成私密确定细节：非女巫不能确定女巫是谁、具体救了几号、刀口或毒口在哪；真女巫可以公开自己的真实救毒信息，但不能编错目标，也不要只说“我救过人”这种半公开私密状态。药瓶状态可以按公开死亡形态推理，但不要伪装成私密直知。无守卫首夜单死后，说“女巫没救/没用解药”属于合理简称，不应只因“女巫没救/没用解药”这种说法质疑发言者。",
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
      repairInstructions: buildSpeechRepairInstructions(input),
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

function buildSpeechRepairInstructions(input: LlmSpeechInput): string[] {
  const contract = input.speechContract;
  const targetText = contract.target ? seatText(contract.target) : "无目标";
  const lines = [
    `必须执行 speechContract.move=${contract.move}，不要改成其他发言动作。`,
    `目标=${targetText}；targetSpeechStatus=${contract.targetSpeechStatus}；allowedInteraction=${contract.allowedInteraction}。`,
  ];
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
    lines.push(`票口边界：${contract.voteBoundary}`);
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

function hasCurrentDayDeathShapeMention(view: AgentView): boolean {
  return currentDaySpeechItems(view).some((speech) => /平安夜|女巫用药|药线|空刀/.test(speech.message));
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
  return /查杀|金水|预言家|我是女巫|我女巫|猎人|骑士|守卫|警徽|归票|出人|投/.test(withoutDeathShape);
}

function buildPlayerSpeechGuide(
  view: AgentView,
  plan: SpeechPlan,
  speechOrder: LlmSpeechInput["publicContext"]["speechOrder"],
): LlmSpeechInput["playerSpeechGuide"] {
  const previousSpeech = [...view.publicSummary.recentSpeeches]
    .reverse()
    .find((speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId);
  const targetLine = plan.target
    ? `本轮可以把${seatText(plan.target)}作为主要观察位；如果前置发言或身份线更重要，也可以自然转向。`
    : "本轮没有必须锁死的目标，可以从前置发言、公开身份线、票型或死亡播报里选最像玩家的切入点。";
  const stageLine =
    speechOrder.speakersAlreadyFinished.length > 0
      ? `你是已有人发言后的轮次，桌面材料来自${formatSeatList(speechOrder.speakersAlreadyFinished)}。`
      : "你是靠前发言位，先铺一个观察点，不要假装已经听完全场，也不要铺一圈通用作业。";
  const lowInfoOpeningLine = isLowInfoDayOneNoHardInfo(view)
    ? "低信息首轮不用强行站边或落票口：只给观察点、保留态度或审计跟压收益，不把前置位没站边当缺口。"
    : undefined;

  return {
    tablePlayerStyle: [
      lowInfoOpeningLine,
      lowInfoOpeningLine
        ? "像坐在桌边发言：2-3句短句，只抓一条主线；先给保留态度或观察点，再给1个公开理由，最后留下验证方向。"
        : "像坐在桌边发言：2-3句短句，只抓一条主线；先给当前站边或保留态度，再给1个公开理由，最后留下追问或票口。",
      "尽量形成一条因果链：为什么这样站、这个理由有多硬、下一轮看什么验证；不要把所有审计点都塞进同一段，不要列第一、第二、第三。",
      "允许牌桌口吻，例如“我先不站死”“这个点先记”“这轮票口先放这里”，但不要连续多句都用“我先”开头。",
      targetLine,
      stageLine,
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
    ],
    avoid: [
      "不要为了接话强行回应上一位；只有相关时自然承接。",
      "可以按座位名报自己是谁，但不要把模型特点说成自我介绍、AI 身份、系统自述、模型口号或固定模板。",
      "不要机械复述事实简报、公开边界或规则说明。",
      "少用报告腔词组，例如“理由是”“依据是”“这个结论来自”；把它们改成牌桌口吻，如“卡我的是”“我打他的点是”。",
      "不要把内部标签说成台词，例如“拆因果”“第一点”“盘问议程”“可改票条件”。",
      "不要列第一、第二、第三，也不要让别人一次回答两三个问题。",
      "不要面面俱到；身份坑、票型、发言顺序、死亡播报里选一个最能推进本轮的问题。",
      "已经发过言的位置只能回看其已发表内容，不要让他后面再补、轮到他再回应。",
      "不要把边角位、语气、短发言、划水这类软状态直接当铁狼证据。",
      "不要泄露私有身份信息；狼队视角、真实查验和女巫药瓶只能按角色策略决定是否公开。",
    ],
  };
}

function buildModelSpeechStyleGuide(view: AgentView): LlmSpeechInput["playerSpeechGuide"]["modelStyle"] {
  const persona = view.persona;
  const modelName = persona?.name ?? "AI玩家";
  const style = persona?.style ? `保留角色底色：${persona.style}` : "保持稳定、自然的桌游玩家口吻。";
  const goal = persona?.goal ? `打法目标：${persona.goal}` : "围绕公开事实形成可投票判断。";
  const preferences = persona?.preferences;
  const roleCardLines = roleCardSpeechTendencies(persona);

  if (modelName.includes("DeepSeek")) {
    return {
      modelName,
      softTendency: "偏逻辑链校验：把发言、站边、票型按因果顺序串起来，但不要变成判题报告。",
      tendencies: [style, goal, ...roleCardLines, "优先指出前后不一致、结论缺过程、票型和发言是否闭环。"],
    };
  }

  if (modelName.includes("Claude")) {
    return {
      modelName,
      softTendency: "偏边界审查：先分清哪些是公开事实、哪些只是推测，再给审慎判断。",
      tendencies: [style, goal, ...roleCardLines, "可以保留余地，但最后仍要给可执行的观察位或票口。"],
    };
  }

  if (modelName.includes("GPT")) {
    return {
      modelName,
      softTendency: "偏综合组织：把多条公开信息收束成一个能推进桌面的判断。",
      tendencies: [style, goal, ...roleCardLines, "适合把身份线、发言顺序和票型放在同一段里归纳。"],
    };
  }

  if (modelName.includes("豆包")) {
    return {
      modelName,
      softTendency: "偏强压节奏：结论更早、追问更直接，但不能乱踩未发言位。",
      tendencies: [style, goal, ...roleCardLines, "适合追一个具体目标的过程缺口，别一次索要站边、票口和身份线。"],
    };
  }

  if (modelName.includes("Mimo")) {
    return {
      modelName,
      softTendency: "偏细节校验：抓一个公开细节反复核对，避免大段空泛站边。",
      tendencies: [style, goal, ...roleCardLines, "适合从一句发言、一次投票或一个身份口径切入。"],
    };
  }

  if (modelName.includes("Gemini")) {
    return {
      modelName,
      softTendency: "偏多线观察：同时保留两条可能性，再给下一轮验证点。",
      tendencies: [style, goal, ...roleCardLines, "适合说清楚哪些点暂放、哪个具体点需要后续验证。"],
    };
  }

  if (modelName.includes("GLM")) {
    return {
      modelName,
      softTendency: "偏结构站边：看阵营关系、身份冲突和谁在帮谁收口。",
      tendencies: [style, goal, ...roleCardLines, "适合把人分成观察位、可信位和需要解释的位置。"],
    };
  }

  if (modelName.includes("Kimi")) {
    return {
      modelName,
      softTendency: "偏长线记忆：连接上一轮发言、票型和今天态度变化。",
      tendencies: [style, goal, ...roleCardLines, "适合指出前后变化、旧疑点是否被解释、票型是否延续。"],
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
    tendencies: [style, goal, preferenceLine, ...roleCardLines],
  };
}

function roleCardSpeechTendencies(persona: AgentView["persona"]): string[] {
  const roleCard = persona?.roleCard;
  if (!roleCard) return [];
  return [
    `角色扮演：你正在扮演${persona?.name ?? "当前角色"}；人物来源：${roleCard.source || persona?.name || "未填写"}。`,
    roleCard.speakingStyle ? `角色说话方式：${roleCard.speakingStyle}` : "",
    roleCard.reasoningStyle ? `角色推理习惯：${roleCard.reasoningStyle}` : "",
    roleCard.avoid ? `角色避免事项：${roleCard.avoid}` : "",
    "角色表现不能违背事实简报、私密身份边界、当前阶段规则或 speechContract；如果角色风格与这些边界冲突，以事实和 speechContract 为准。",
  ].filter((line): line is string => Boolean(line));
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
  const publicBoundary = [
    "公开信息只包括：已经公开的发言、死亡播报、身份声明、公开查验声明和已公开票型。",
    "本轮已发言玩家可以被评价，但只能回看其已发表内容，不能说等他后面再补；本轮未发言玩家只能被要求稍后表态。",
    "真预言家报查杀后，查杀位的个人解释不能把票口推走；只有外置硬身份反证或公开结构反证才会改变票口。",
    "死亡形态中的“女巫用药了”只是公开规则推理，不等于发言者自称女巫；只有明确说“我是女巫”、公开救毒目标或拍女巫身份，才算女巫声明。",
    ...buildClaimAttributionBoundaryLines(view),
    "空刀不作为平安夜发言主线；天亮死讯只公开倒牌结果，不公开狼刀、毒、自刀等具体死因。",
    deathShapeAlreadyDiscussed
      ? "平安夜已作为公开死亡形态处理，不要主动复读药线或空刀；非女巫不要把女巫是谁、具体救了几号、狼刀或毒口落点说成确定事实；真女巫可以公开真实救毒信息，不能只说“我救过人”这种半公开私密状态；药瓶状态可以按公开死亡形态推理。"
      : "平安夜直接按公开死亡形态处理，平安夜只需短句带过：可以说“女巫用药了”；不要把平安夜本身交给后置位重复解释；正常发言不要展开空刀；非女巫不要把女巫是谁、具体救了几号、狼刀或毒口落点说成确定事实；真女巫可以公开真实救毒信息，不能只说“我救过人”这种半公开私密状态；药瓶状态可以按公开死亡形态推理。",
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
    "不要把“平安夜女巫用药了”理解成某个发言者公开跳女巫；这只是死亡形态推理。",
    "公开死讯可以产生推测和压力，但非女巫不能擅自说成确定的具体刀口、毒口、自刀位置或女巫身份；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态；药瓶状态可以按公开死亡形态推理。",
    "尚未发言的后置位还没有给本轮态度，不能评价他们已经信息少、没回应或没站边；若要点人，只留一个具体问题。",
    "已经发过言的前置位本轮不会再次发言，不能要求他们稍后补充、后面回应或轮到时再解释。",
    ...(view.privateKnowledge.sheriff ? [] : ["没有警上、警下、警徽、警长流程，不要使用这些概念。"]),
    ...buildClaimAttributionBoundaryLines(view),
  ];
  const legalSpeechFocus = [
    speechOrder.speakersAlreadyFinished.length > 0
      ? `可以评价已发言的${formatSeatList(speechOrder.speakersAlreadyFinished)}，但只能回看已经说出口的内容。`
      : "你是本日靠前发言位，只能先铺自己的视角和观察点。",
    speechOrder.currentDayUnspokenSeats.length > 0
      ? `${buildFutureSeatMentionOrderLine(
          speechOrder,
        )} 如果必须点一个后置位，只选和当前发言链最相关的位置，只留一个具体问题；不要把站边、票口、身份线做成一圈通用作业。`
      : "本日已经没有后置位，可以开始收束今天的站边和票型。",
    deathShapeAlreadyDiscussed
      ? "平安夜已作为公开死亡形态处理，不要主动复读；把发言重心转到前置发言、身份线或票口。"
      : "平安夜只需短句带过：可以说“女巫用药了”，不要解释空刀概率或展开规则背景。",
    isLowInfoDayOneNoHardInfo(view)
      ? "低信息首轮不要因为任何前置位没站边或没给票口去硬打；可以评价观察点是否过泛、谁在跟压，或先记录等待身份/查验信息。"
      : undefined,
    plan.target
      ? `本轮可以围绕${seatText(plan.target)}展开判断，但不要把这个目标当成系统要求的固定模板。`
      : "本轮可以自由选择公开身份线、死讯、前置发言或票型作为切入点。",
  ].filter((line): line is string => Boolean(line));

  const publicReasoningCues = view.publicSummary.tableMemory.reasoningCues
    .filter((cue) => !(deathShapeAlreadyDiscussed && cue.kind === "death_shape"))
    .slice(0, 6)
    .map((cue) => `${cue.summary}${cue.evidence.length > 0 ? `；依据：${cue.evidence.slice(0, 2).join("、")}` : ""}`);

  return {
    text: [
      "【发言前牌桌事实简报】",
      ...publicBoundary.map((line) => `公开边界：${line}`),
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
      ...claimAudit.contestedClaims.map((line) => `身份审计-对跳：${line}`),
      ...claimAudit.protectedClaims.map((line) => `身份审计-保护：${line}`),
      ...claimAudit.checkChains.map((line) => `身份审计-查验链：${line}`),
      ...claimAudit.contradictions.map((line) => `身份审计-矛盾：${line}`),
      ...claimAudit.followupTests.map((line) => `身份审计-验证：${line}`),
      ...claimAudit.actionGuidance.map((line) => `身份审计-行动：${line}`),
      ...debateAgenda.crossExamination.map((line) => `盘问议程-追问：${line}`),
      ...debateAgenda.voteCommitments.map((line) => `盘问议程-票口：${line}`),
      ...debateAgenda.roleCoordination.map((line) => `盘问议程-角色联动：${line}`),
      ...debateAgenda.pressureLines.map((line) => `盘问议程-施压线：${line}`),
      ...debateAgenda.avoidTraps.map((line) => `盘问议程-避免陷阱：${line}`),
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
  const deaths = [
    ...new Set([
      ...view.publicSummary.recentDeaths,
      ...view.publicSummary.tableMemory.deathAnnouncements,
    ]),
  ].slice(-3);
  return deaths.length > 0
    ? deathShapeAlreadyDiscussed
      ? `公开死讯：${deaths.join("；")}。平安夜已作为公开死亡形态处理，本轮不要主动复读药线或空刀；死因仍未公开，不能直接确认狼刀、毒药归属或自刀。`
      : `公开死讯：${deaths.join("；")}。死因仍未公开，不能直接确认狼刀、毒药归属或自刀；平安夜直接按公开死亡形态处理，发言里短句说“女巫用药了”即可，不要把平安夜本身交给后置位重复解释。`
    : "公开死讯：目前没有需要引用的死亡播报。";
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
      if (witch?.savedTarget) lines.push(`你昨夜救过${seatText(witch.savedTarget)}。`);
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

function buildBlackCheckTimingFactLines(view: AgentView): string[] {
  return getPriorSpeechBlackCheckTimelines(view).map(
    ({ claimant, target }) =>
      `查杀时序：${seatText(target)}的本日发言发生在${seatText(claimant)}报查杀之前；评价这段时正确表述是“${target.seatId}号查杀前的发言/原话”，${target.seatId}号原话不是对${claimant.seatId}号查杀/验人理由的回应或质疑；若要讨论查杀后的表现，只能引用公开记录中查杀之后的新发言。`,
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
  return `后置位点名顺序：如果只是保留观察，默认说“后置位整体”或“下一位${seatText(
    nextUnspoken,
  )}”；若连续点多个后置位，按今日顺序连续点名，不要无理由跳过中间后置位。`;
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
  });
  errors.push(...validateDeathCauseBoundaries(view, normalized));
  errors.push(...validateWitchClaimAttribution(view, normalized));
  errors.push(...validateSpeechTimeline(view, normalized));
  errors.push(...validateAlreadySpokenFutureAsk(view, normalized));
  errors.push(...validateFutureSeatMentionOrder(view, normalized));
  errors.push(...validateSeerBlackCheckFinality(view, plan, publicClaim, normalized));
  errors.push(...validateBlackCheckReactionTimeline(view, normalized));
  errors.push(...validatePreClaimTargetInteractionTimeline(view, normalized));
  errors.push(...validatePostSpeechChallengeTimeline(view, normalized));
  errors.push(...validateClaimAttribution(view, normalized));
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
  errors.push(...validateConciseTableSpeech(normalized));
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

  const overCertainDeathDetail = /(?:确定|肯定|必然|一定|铁定|就是).{0,12}(刀口|毒口|自刀|女巫身份|被救的是|救的是)/.test(
    speech,
  );
  if (overCertainDeathDetail) {
    errors.push("发言把私密死因细节说成确定事实");
  }

  return errors;
}

function hasForbiddenWitchStatusLeak(view: AgentView, speech: string): boolean {
  const selfPotionLeak =
    /(?:我|本人|这张牌|我这里).{0,12}(?:救过人|救了人|有救人信息|有药线信息|用过解药|开过解药|用了解药|解药已经用|解药没了|手里没解药|毒过人|用过毒|开过毒)/.test(
      speech,
    ) ||
    /(?:救过人的信息|我救人的信息|我的救人信息|我的药线信息)/.test(speech);
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

function hasForbiddenPotionTargetDetail(view: AgentView, speech: string): boolean {
  const publiclyClaimed = collectPubliclyClaimedPotionTargets(view);
  const saveTargets = [
    ...collectPotionTargetIds(speech, /女巫.{0,18}(?:救的是|救了|救中的是)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
    ...collectPotionTargetIds(speech, /(?:我|昨晚|昨夜|夜里).{0,10}(?:救的是|救了)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
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
    hasForbiddenKnownTarget(view, poisonTargets, [view.privateKnowledge.witch?.poisonedTarget?.seatId, ...publiclyClaimed.poisoned]) ||
    hasForbiddenKnownTarget(view, knifeTargets, [
      view.privateKnowledge.witch?.currentVictim?.seatId,
      view.privateKnowledge.witch?.savedTarget?.seatId,
    ]) ||
    hasForbiddenKnownTarget(view, poisonMouthTargets, [view.privateKnowledge.witch?.poisonedTarget?.seatId])
  );
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
      if (!aliveSeatIds.has(seatId) || claimedWitchSeatIds.has(seatId)) continue;
      return [`把${seatId}号的女巫用药表述错当女巫声明`];
    }
  }
  return [];
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
    const window = sentence.slice(match.index ?? 0, (match.index ?? 0) + 56);
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

function collectPubliclyClaimedPotionTargets(view: AgentView): { saved: number[]; poisoned: number[] } {
  const messages = view.publicEvents
    .filter((event) => event.type === "SPEECH_CREATED" || event.type === "LAST_WORDS_CREATED")
    .map((event) => String(event.payload?.message ?? event.message ?? ""));
  return {
    saved: [
      ...new Set(
        messages.flatMap((message) => [
          ...collectPotionTargetIds(message, /(?:女巫|我|昨晚|昨夜|夜里).{0,24}(?:救的是|救了|救过|救中的是)\s*([0-9]+|[一二三四五六七八九十两]+)\s*号?/g),
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
        "平安夜已作为公开死亡形态处理；本轮不要主动复读“按女巫用药”或空刀，只在直接相关时一句带过。",
        "非女巫不要把女巫是谁、具体救了几号、狼刀刀口在哪、毒口在哪说成确定事实；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态；药瓶状态可以按公开死亡形态推理，但不要伪装成私密直知。",
      ]
    : [
        "狼人杀允许低信息推测：可以说“我猜/我倾向/大概率/按规则推”，并用这种推测推动追问、站边和票口。",
        "死亡/平安夜直接按公开死亡形态处理：无守卫平安夜发言里短句说“女巫用药了”即可；不要展开空刀，也不要把平安夜本身交给后置位重复解释。",
        "非女巫不要把女巫是谁、具体救了几号、狼刀刀口在哪、毒口在哪说成确定事实；真女巫可以公开真实救毒信息，但不能只说“我救过人”这种半公开私密状态；药瓶状态可以按公开死亡形态推理，但不要伪装成私密直知。",
        "正常发言不要展开空刀；不要把空刀说成规则绝对不可能，也不要把空刀当成平安夜主线解释。",
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
      "不要套固定模板；每句话都要服务于当前局面里的一个判断、保留、追问或身份动作。",
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
        strictConstraints.push("真预言家报查杀后不能让查杀位靠自证把票口推走；票口先压查杀，只有外置硬身份反证能改变结构。");
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
      return [contract, "allowedInteraction=finalize_black_check：真预言家查杀先落票口，不给查杀位靠自证推走票口；只有外置硬身份反证能改变结构。"];
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

function validateSpeechTimeline(view: AgentView, speech: string): string[] {
  const unspokenSeats = view.publicSummary.tableMemory.seats.filter(
    (seat) => seat.alive && seat.seatId !== view.mySeatId && seat.lastSpeechDay !== view.day,
  );
  for (const seat of unspokenSeats) {
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => mentionsSeatReference(sentence, seat));
    if (targetSentences.length === 0) continue;

    const saysAlreadyLowInfo = targetSentences.some((sentence) => {
      if (isFutureListeningTask(sentence, seat.seatId)) return false;
      if (isExplicitHistoricalSpeechReview(sentence)) return false;
      return (
        /(到现在|目前|现在|本轮|今天|已经|一直|刚刚).{0,16}(信息量|发言|站边|态度|死讯|回应|解释|判断)/.test(sentence) ||
        /(信息量|发言).{0,10}(太少|少|偏少|不足|太空|空|低)/.test(sentence) ||
        /(没有|没|未).{0,10}(明确站边|站边|态度|回应|解释|判断|对死讯|对昨夜|给信息)/.test(sentence) ||
        /(?:查杀|反打|攻击|踩|打|压|归票|带票).{0,18}(?:之后|以后|完|了)/.test(sentence) ||
        /拿.{0,10}(?:短发言|发言短|发言).{0,14}(?:做文章|攻击|打|踩)/.test(sentence) ||
        /只给结论|发言偏短|过程不够|回避站边/.test(sentence)
      );
    });

    const framesAsFuture = /(后置|后面|等.{0,6}发言|轮到|如果.{0,18}(发言|后面|后置)|稍后|一会儿)/.test(speech);
    if (saysAlreadyLowInfo && !framesAsFuture) {
      return [`把本轮未发言的${seat.seatId}号当成已发言评价`];
    }
  }

  return [];
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
    const seatPattern = `${seat.seatId}\\s*号`;
    const futureCue = "(?:后置(?:位)?|后面|后续|稍后|等下|一会儿|接下来|轮到|等.{0,8}(?:发言|说|回应|补|报|跳|给))";
    const responseCue =
      "(?:补(?:结论|方向|过程|逻辑|站边|票口)?|回(?:我|一个点|一下|应)|回应|回答(?:我|一下|这个问题)?|答(?:我|一下)?|解释|说清|讲清|表态|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)|给(?:出)?(?:站边|票口|查验|验人|判断标准|信息)|发言|开口|闭环|报(?:完)?(?:查验链|验|查验|信息)|跳(?:身份|预言家))";
    const directCue =
      "(?:(?:要么|必须|需要|得|要|该|先|再|你)\\s*(?:补(?:结论|方向|过程|逻辑|站边|票口)|说清|讲清|解释|回应|回答(?:我|一下|这个问题)?|答(?:我|一下)?|回(?:我|一个点|一下|应)|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)|给(?:出)?(?:站边|票口|查验|验人|判断标准|信息)|闭环)|(?:补(?:结论|方向|过程|逻辑|站边|票口)|说清|讲清|解释(?:一下|清楚)|回应一下|回答(?:我|一下|这个问题)|答(?:我|一下)|回(?:我|一个点|一下|应)|接(?:话|后置位(?:的话|发言)?|这个点|逻辑|发言链)))";
    const targetSentences = speech.split(/[。！？；]/).filter((sentence) => new RegExp(seatPattern).test(sentence));
    const asksAgain = targetSentences.some((sentence) => {
      if (isWaitingOnOtherSpeakers(sentence)) return false;
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
    if (uniqueOrder.length < 2) continue;

    const sortedOrder = [...uniqueOrder].sort((a, b) => a - b);
    const skipsMiddleSeat = sortedOrder.some((orderIndex, index) => index > 0 && orderIndex !== sortedOrder[index - 1]! + 1);
    const reversesSpeechOrder = uniqueOrder.some((orderIndex, index) => index > 0 && orderIndex < uniqueOrder[index - 1]!);
    if (skipsMiddleSeat || reversesSpeechOrder) {
      return ["无理由跨过中间后置位点名"];
    }
  }

  return [];
}

function isFutureSeatGroupSentence(sentence: string): boolean {
  return /(?:后置|后面|后续|接下来|轮到|稍后|一会儿|等|过完|过去|这一圈|一圈|这一段)/.test(sentence);
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
  if (isMissingInfoReview(sentence, seatId) && !hasExplicitFutureDemand(sentence, seatId)) return false;
  if (isReviewingSpokenSeatFutureReference(sentence, seatId)) return false;
  if (new RegExp(`${futureCue}.{0,36}${seatPattern}.{0,36}${responseCue}`).test(sentence)) return true;
  const targetMatch = new RegExp(seatPattern).exec(sentence);
  if (!targetMatch) return false;
  const afterTarget = sentence.slice(targetMatch.index + targetMatch[0].length);
  const secondPersonDemand = /你(?:自己)?[^。！？；]{0,18}(?:至少|现在|这轮|今天|也)?[^。！？；]{0,6}(?:得|要|需要|该|必须)[^。！？；]{0,10}(?:说清|讲清|交代|给(?:出)?|回答|回我|解释|表态)/.exec(afterTarget);
  if (secondPersonDemand && !mentionsOtherSeat(afterTarget.slice(0, secondPersonDemand.index), seatId)) return true;
  const directQuestion = /(?:我直接问|直接问|问你|我想问)[^。！？；]{0,24}你(?:自己)?[^。！？；]{0,48}(?:打算|准备|怎么|为什么|凭什么|拿什么|是否|是不是|有没有)/.exec(afterTarget);
  if (directQuestion && !mentionsOtherSeat(afterTarget.slice(0, directQuestion.index), seatId)) return true;
  const futureMatch = new RegExp(`${futureCue}.{0,30}${responseCue}`).exec(afterTarget);
  if (futureMatch && !mentionsOtherSeat(afterTarget.slice(0, futureMatch.index), seatId)) return true;
  const directMatch = new RegExp(directCue).exec(afterTarget);
  return Boolean(directMatch && !mentionsOtherSeat(afterTarget.slice(0, directMatch.index), seatId));
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
  if (view.myRole !== "SEER") return [];
  const blackCheckTargetIds = new Set<number>();
  if (plan.claimIntent?.claimedRole === "SEER" && plan.claimIntent.check?.result === "WEREWOLF") {
    blackCheckTargetIds.add(plan.claimIntent.check.targetSeatId);
  }
  for (const check of view.privateKnowledge.seerChecks ?? []) {
    if (check.result === "WEREWOLF" && speechMentionsBlackCheck(speech, check.targetSeatId)) {
      blackCheckTargetIds.add(check.targetSeatId);
    }
  }
  if (publicClaim?.claimedRole === "SEER") {
    for (const check of publicClaim.checks) {
      if (check.result === "WEREWOLF") blackCheckTargetIds.add(check.targetSeatId);
    }
  }

  for (const targetSeatId of blackCheckTargetIds) {
    if (offersBlackCheckReversalToTarget(speech, targetSeatId)) {
      return ["真预言家查杀不能让查杀位靠自证改票"];
    }
  }
  return [];
}

function validateClaimAttribution(view: AgentView, speech: string): string[] {
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
  return [];
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
  if (seerClaim) return "验人理由";
  return "发言缺口";
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
  if (theme === "验人理由") {
    return /(?:验人|查验|首夜验|为什么验|依据|思路|理由|只给结论|没有解释|缺口)/.test(message);
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

  const challengerMentionCount = timeline.challengers.filter((challenger) =>
    new RegExp(`${challenger.seatId}\\s*号`).test(normalized),
  ).length;
  const hasChallengeActorCue =
    challengerMentionCount > 0 ||
    /(?:后续|后置|多人|全|都|也).{0,32}(?:问|追问|施压|压|点过|指出|卡|质疑)/.test(normalized);
  if (!hasChallengeActorCue) return false;

  const hasChallengeContent = /(?:问|追问|施压|压|点过|指出|卡|质疑).{0,48}(?:验人|依据|思路|理由|缺口|解释)|(?:验人|依据|思路|理由|缺口|解释).{0,48}(?:问|追问|施压|压|点过|指出|卡|质疑)/.test(
    normalized,
  );
  if (!hasChallengeContent) return false;

  const targetText = `${timeline.target.seatId}\\s*号`;
  return new RegExp(
    `(?:你|他|该位置|这张牌|${targetText}).{0,24}(?:一个字没回|没(?:有)?回(?:应)?|未回(?:应)?|没接|没解释|没给(?:出)?(?:回复|回应|解释|验人理由|思路))`,
  ).test(normalized);
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
      repaired = repaired
        .replace(
          new RegExp(`我?(?:暂时|先|更|比较|倾向)?(?:认|站|信|保|支持|认可)\\s*${targetPattern}\\s*(?:是|为)?\\s*(?:预言家|预言家牌)`, "g"),
          replacement,
        )
        .replace(
          new RegExp(`${targetPattern}\\s*(?:这张|这个|这位)?(?:预言家|预言家牌).{0,12}(?:可信|成立|像真|更真|我认|我站|先认|更信)`, "g"),
          replacement,
        );
    }
  }
  return repaired;
}

function misidentifiesSeatAsSeer(speech: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  return speech.split(/[。！？；]/).some((sentence) => {
    if (isNegativeSeerAttribution(sentence, seatPattern)) return false;
    return (
      new RegExp(`(?:暂时|先|更|比较|倾向)?(?:认|站|信|保|支持|认可).{0,12}${seatPattern}.{0,12}(?:是|为)?\\s*(?:预言家|预言家牌)`).test(
        sentence,
      ) ||
      new RegExp(`${seatPattern}.{0,12}(?:这张|这个|这位)?(?:预言家|预言家牌).{0,18}(?:可信|成立|像真|更真|我认|我站|先认|更信)`).test(
        sentence,
      ) ||
      new RegExp(`(?:我认为|我觉得|我判断|我暂时认|我先认).{0,12}${seatPattern}.{0,8}(?:是|为)\\s*(?:预言家|预言家牌)`).test(
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
  return unfinishedQuestion.test(speech) ? ["发言存在未完成的问题句"] : [];
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

function validateConciseTableSpeech(speech: string): string[] {
  const reportStyle =
    /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚)/.test(
      speech,
    );
  const tooManySentences = countSentenceLikeUnits(speech) > AI_SPEECH_MAX_SENTENCES;
  const tooLong = speech.length > AI_SPEECH_MAX_CHARS;
  return reportStyle || tooManySentences || tooLong ? ["发言过于冗长或报告化"] : [];
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
    fallbackPersonaNames: readSpeechFallbackPersonaNames(input.persona?.name),
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

function readSpeechFallbackPersonaNames(primaryPersonaName: string | undefined): string[] {
  const configured = process.env.AI_LLM_SPEECH_FALLBACK_PERSONAS?.trim();
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

function createStructuredMockSpeech(view: AgentView, plan = createSpeechPlan(view)): string | undefined {
  const persona = `${view.persona?.name ?? ""} ${view.persona?.label ?? "稳健型"}`.trim();
  const target = selectMockSpeechTarget(view, plan);
  const debateAgenda = buildDebateAgenda(view, { plan, target });
  const opener = personaOpener(persona, view.mySeatId + view.day);
  const dynamicText = renderSpeechDynamicText(plan);
  const evidence = buildStructuredMockEvidence(view, plan, target);
  const previous = buildPreviousSpeechReason(view, target);
  const audit = buildMockReasoningAudit(view);
  const condition = buildVoteCondition(view, plan, target);
  const tallyText = publicTallyText(view);
  const evidenceText = buildNaturalEvidenceSentence(evidence, dynamicText);
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
          `${opener}，我这里先不把身份线打满。${dynamicSentence}${previous ?? ""}${condition}`,
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
            ? "这轮我不围绕金水出人，重点看谁没理由硬踩他。"
            : "";
      return compactMockSpeech(
        `${opener}，我跳预言家，${checkedText}是${resultText}。这是我昨晚验出来的，不是听感牌。${checkEvidenceText}${buildSeerCheckCondition(latestCheck.result, checkedTarget)}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, checkedTarget, 1))}`,
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
        ? "先把这条金水信息摆出来，今天不围绕他出人。"
        : checkEvidence.length > 0
          ? `我压他的点是：${checkEvidence.join("；")}。`
          : "这条查杀线我先压出来，让外置位对照回应。";
    return compactMockSpeech(
      `${opener}，我跳预言家，${checkedText}是${resultText}。${plan.claimIntent.isCounterclaim ? "外置预言家我不认，" : ""}${checkEvidenceText}${buildSeerCheckCondition(plan.claimIntent.check.result, checkedTarget)}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, checkedTarget, 2))}`,
    );
  }

  if (view.myRole === "WITCH" && plan.claimIntent?.claimedRole === "WITCH" && plan.claimIntent.strength === "hard") {
    return compactMockSpeech(`${opener}，我拍女巫，今天票型别散。${dynamicSentence}${evidenceText}${condition}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, target, 3))}`);
  }

  if (view.myRole === "HUNTER" && plan.claimIntent?.claimedRole === "HUNTER" && plan.claimIntent.strength === "hard") {
    return compactMockSpeech(`${opener}，我拍猎人，先把归票收住。${dynamicSentence}${evidenceText}${condition}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, target, 4))}`);
  }

  if (view.myRole === "KNIGHT" && plan.claimIntent?.claimedRole === "KNIGHT" && plan.claimIntent.strength === "hard") {
    return compactMockSpeech(`${opener}，我拍骑士，决斗不会替代推理，今天先把公开狼面说清楚。${dynamicSentence}${evidenceText}${condition}${buildDebateAgendaTail(debateAgenda, mockSpeechSeed(view, target, 5))}`);
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
    return reasonedSpeech("只按公开信息盘。");
  }

  return reasonedSpeech("我这轮按闭眼好人打，结论先留活口。");
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
  const firstEvidence = args.evidence[0] ?? `${targetText}还没有形成能闭环的公开过程`;
  const secondEvidence = args.evidence[1];
  const dynamicSentence = args.dynamicText ? `${args.dynamicText}。` : "";
  const previousSentence = args.previous ? `${args.previous}。` : "";
  const auditSentence = args.audit ? `${args.audit}。` : "";
  const evidenceSentence = secondEvidence ? `${firstEvidence}，另外${secondEvidence}` : firstEvidence;
  const agendaTail = buildDebateAgendaTail(
    buildDebateAgenda(args.view, { plan: args.plan, target: args.target }),
    mockSpeechSeed(args.view, args.target, 6),
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
        "身份和站边先对一下",
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

function buildNaturalEvidenceSentence(evidence: string[], dynamicText: string): string {
  const uniqueEvidence = evidence
    .map((item) => stripTerminalPunctuation(item))
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((candidate) => candidate === item) === index)
    .filter((item) => !sameSpeechPoint(item, dynamicText));

  if (uniqueEvidence.length === 0) return "";
  return `我认这个点，是因为${uniqueEvidence.slice(0, 2).join("；")}。`;
}

function mergeDynamicEvidence(dynamicSentence: string, evidenceSentence: string): string {
  const dynamicText = stripTerminalPunctuation(dynamicSentence);
  const evidenceText = stripTerminalPunctuation(evidenceSentence);
  if (!dynamicText) return evidenceText;
  if (!evidenceText || sameSpeechPoint(dynamicText, evidenceText)) return dynamicText;
  return `${dynamicText}，我认的点是${evidenceText}`;
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

function buildDebateAgendaTail(agenda: AiDebateAgenda, seed = 0): string {
  const ask = cleanAgendaLine(agenda.crossExamination[0]);
  const vote = cleanAgendaLine(agenda.voteCommitments[0]);
  if (ask && vote) {
    return pickBySeat(seed, [
      `${ask}；${vote}。`,
      `这轮别空过，${ask}；${vote}。`,
      `我主要听回应，${ask}；${vote}。`,
    ]);
  }
  if (ask) {
    return pickBySeat(seed, [
      `这个点要回答：${ask}。`,
      `后置位先别空站边，先说清${ask}。`,
      `这个问题我先留在桌上：${ask}。`,
    ]);
  }
  if (vote) {
    return pickBySeat(seed, [
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
    return `上一轮票型要复盘${latestVote.tally.map((item) => `${item.target.seatId}号${item.count}票`).join("、")}，尤其看起票和补票位置`;
  }

  const seerClaim = view.publicSummary.claimBoard.find((claim) => claim.claimedRole === "SEER");
  if (seerClaim) {
    return `预言家线先验${seatText(seerClaim.claimant)}的报验、心路和票口是不是一致`;
  }

  const focus = view.publicSummary.tableMemory.focus[0];
  if (focus) {
    return `当前焦点是${seatText(focus.seat)}，原因要和公开发言及站边一起校验`;
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
      target ? `前置位先把${targetText}放进观察位` : "前置位先把观察点摆出来",
      target ? `前面样本少，先留一个关于${targetText}的具体观察点` : "前面样本少，先给一个可验证观察点",
      target ? `${targetText}不定死，只说后面看这一条能不能闭合` : "先铺视角，不假装已经听完全场",
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
  const name = seat.name.trim();
  return name && name !== "你" ? `${seat.seatId}号${name}` : `${seat.seatId}号`;
}

function buildStructuredMockEvidence(view: AgentView, plan: SpeechPlan, target: ActionTarget | undefined): string[] {
  const items: string[] = [];
  const plannedCheck = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check : undefined;
  if (plannedCheck?.result === "GOOD" && target?.seatId === plannedCheck.targetSeatId) {
    return [`${seatText(target)}是我报出的金水，这轮不把他当出人焦点`];
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
    const evidence = reasoningCue.evidence[0] ? `，依据是${clipBriefingText(reasoningCue.evidence[0], 42)}` : "";
    items.push(`${cueTargetText}的公开线索是${clipBriefingText(reasoningCue.summary, 58)}${evidence}`);
  }
  if (focus?.reasons.length) {
    items.push(`${seatText(focus.seat)}被放到焦点里，卡我的是${focus.reasons.slice(0, 2).join("、")}`);
  }
  if (targetMemory?.claimedByChecks.length) {
    const check = targetMemory.claimedByChecks.at(-1);
    if (check) items.push(`${check.claimant.name}公开给过${targetTextFromResult(check.result)}`);
  }
  if (targetMemory?.claims.length) {
    items.push(`${seatText(targetMemory)}有身份声明，后面要和发言过程对照`);
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

  const planPoint = plan.talkingPoints.find((point) => !/队友|狼队|真实身份|隐藏身份/.test(point));
  if (items.length === 0 && planPoint) {
    items.push(planPoint);
  }
  if (items.length === 0) {
    items.push(target ? `${seatText(target)}还没有形成能闭环的公开过程` : "场上还缺少能闭环的公开过程");
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
  if (message.length < 42) return "信息量偏少";
  if (/先听|不急|过一轮|不站死|不好说/.test(message)) return "保留很多但没有给清楚边界";
  if (/查杀|金水|预言家|女巫|猎人/.test(message)) return "给过身份信息，需要核对前后是否一致";
  return "结论和依据还需要再对照";
}

function buildPreviousSpeechReason(view: AgentView, target: ActionTarget | undefined): string | undefined {
  const previousSpeech = view.publicSummary.recentSpeeches.at(-1);
  const previousSpeaker = previousSpeech?.speaker;
  if (!previousSpeech || !previousSpeaker || previousSpeaker.seatId === view.mySeatId) return undefined;
  if (target && previousSpeaker.seatId === target.seatId) return undefined;

  const previousText = seatText(previousSpeaker);
  if (previousSpeech.message.length < 50) {
    return `上一位${previousText}发言偏短，我只先记样本，不直接跟票`;
  }
  return `上一位${previousText}给过一条线，我会拿后置回应去校验`;
}

function buildVoteCondition(view: AgentView, plan: SpeechPlan, target: ActionTarget | undefined): string {
  if (!target) return "所以这轮我先不散票，等后置位把过程补出来。";
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
        : `我保留可改空间，关键看${targetText}后面能不能把公开过程接上。`,
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
    `等轮到${targetText}发言时，我要听他把站边理由和票口讲完整。`,
    `轮到${targetText}时，我要听他把结论、依据和票口放在一起讲。`,
    `${targetText}发言前我先不定死，等他给完视角再决定票怎么落。`,
  ]);
}

function mockSpeechSeed(view: AgentView, target: ActionTarget | undefined, salt = 0): number {
  return view.day * 31 + view.mySeatId * 17 + (target?.seatId ?? 0) * 13 + salt;
}

function buildSeerCheckCondition(result: "WEREWOLF" | "GOOD", target: ActionTarget): string {
  const targetText = seatText(target);
  if (result === "WEREWOLF") {
    return `今天票口先压${targetText}，外置位只给硬身份反证，不要分票。`;
  }
  return `${targetText}先放一轮，不作为今天出人焦点；后面谁无理由硬踩金水位，我再重点看。`;
}

function selectMockSpeechTarget(view: AgentView, plan: SpeechPlan): ActionTarget | undefined {
  if (plan.target) return plan.target;
  const protectedGoldSeatIds = publicUnchallengedGoldSeatIds(view);
  return (
    view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId && !protectedGoldSeatIds.has(seat.seatId)) ??
    view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId)
  );
}

function protectPublicGoldReferences(view: AgentView, speech: string): string {
  const protectedGoldSeatIds = publicUnchallengedGoldSeatIds(view);
  if (protectedGoldSeatIds.size === 0) return speech;

  const protectedSpeech = speech
    .split(/([。！？；，、])/)
    .map((part) => {
      for (const seatId of protectedGoldSeatIds) {
        if (pressuresSeatInMockSpeech(part, seatId) && !isProtectiveGoldSpeechSegment(part)) {
          return `${seatId}号先按公开金水放一轮`;
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
  const dynamicText = renderSpeechDynamicText(plan);
  const coreTalkingPoints = plan.talkingPoints.filter(
    (point) => point !== plan.interaction?.line && point !== plan.personaCue?.line,
  );
  const focusReason = coreTalkingPoints[0] ?? plan.talkingPoints[0] ?? "目前还缺少能落地的发言细节";
  const secondReason = coreTalkingPoints[1] ?? plan.talkingPoints[1] ?? "我会看后置位有没有补充过程";
  const talkingPointText = [dynamicText, ...coreTalkingPoints].filter(Boolean).join("。");

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
    return compactSpeech(`${opener}，我先按公开信息盘。${dynamicText ? `${dynamicText}。` : ""}${previousSpeaker ? `上一位 ${previousSpeaker.name} 没有把怀疑链讲透。` : ""}${misdirect}${tallyText}`);
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
  return compactSpeech(`${opener}，我是闭眼好人，只能按公开发言和死讯盘。${dynamicText ? `${dynamicText}。` : ""}${previousSpeaker ? `${previousSpeaker.name} 的发言先记一笔，` : ""}${stanceSentence}${tallyText || secondReason}`);
}

function renderSpeechDynamicText(plan: SpeechPlan): string {
  return plan.interaction?.line ?? plan.personaCue?.line ?? "";
}

function personaOpener(persona: string, seed: number): string {
  if (persona.includes("DeepSeek")) {
    return pickBySeat(seed, ["按现在桌面看", "这轮我先不站死", "我把能听到的点摆一下"]);
  }
  if (persona.includes("Claude")) {
    return pickBySeat(seed, ["我给一个边界", "这轮我来收一下票型", "桌面先理清楚"]);
  }
  if (persona.includes("GPT")) {
    return pickBySeat(seed, ["我综合一下当前信息", "几个点合起来看", "我给一个折中判断"]);
  }
  if (persona.includes("豆包")) {
    return pickBySeat(seed, ["我直接压节奏", "这个听感我先打出来", "我不想慢慢磨"]);
  }
  if (persona.includes("Mimo")) {
    return pickBySeat(seed, ["我抓一个细节", "我回看前后两轮", "这个点要校验一下"]);
  }
  if (persona.includes("Gemini")) {
    return pickBySeat(seed, ["我开两个观察位", "我不急着锁死", "多条线先放桌面"]);
  }
  if (persona.includes("GLM")) {
    return pickBySeat(seed, ["我从结构上看", "这里我先轻记", "我先接一下前面的发言"]);
  }
  if (persona.includes("Kimi")) {
    return pickBySeat(seed, ["我按身份线往回盘", "身份关系先捋一下", "我从长线记忆看"]);
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
    return pickBySeat(seed, ["我从身份格局盘", "先看身份收益", "这轮要看谁的身份叙事最顺"]);
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

function stripTerminalPunctuation(text: string): string {
  return text.replace(/[。！？；，、,.!\?\s]+$/g, "").trim();
}

function compactSpeech(speech: string): string {
  const clean = speech.replace(/\s+/g, " ").replace(/。。+/g, "。").trim();
  return compactSpeechToLimit(clean, AI_SPEECH_MAX_CHARS);
}

function compactMockSpeech(speech: string): string {
  const clean = polishMockSpeech(speech)
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
    .replace(/依据是/g, "卡我的地方是")
    .replace(/我认的点是/g, "卡我的地方是")
    .replace(/，我认这个点，是因为/g, "，因为")
    .replace(/我认这个点，是因为(\d+号[^，。；]+)成为焦点是因为/g, "我认这里，是因为$1被")
    .replace(/卡我的地方是(\d+号[^，。；]+)成为焦点是因为/g, "卡我的是$1被")
    .replace(/我压他的点是：/g, "我打他的点是：")
    .replace(/我打他的点是：/g, "我打他的点是")
    .replace(/这个结论来自我的夜间查验，不是听感/g, "这是我昨晚验出来的，不是听感牌")
    .replace(/闭眼视角给个可改判断/g, "我这轮按闭眼好人打")
    .replace(/什么公开反证会让你改票/g, "今天票口怎么落")
    .replace(/给可改票条件/g, "把票口边界落清楚")
    .replace(/我先把能听到的点摆一下，不急着拍身份，先看发言链条/g, "我把能听到的点摆一下，枪牌不用抢着拍")
    .replace(/我会把发言顺序、票型和前后逻辑一起校验/g, "发言顺序和票型我会一起看")
    .replace(/前置位先把(\d+号[^。]+?)放进观察位/g, "$1先挂观察")
    .replace(/后置位要改我就给更硬证据/g, "后置要改我票，就拿更硬的反证出来")
    .replace(/被被/g, "被")
    .replace(/(\d+号[^，。；]+)被处在身份对跳关系/g, "$1在身份对跳里")
    .replace(/(\d+号[^，。；]+)被回避站边/g, "$1回避站边")
    .replace(/我先按公开信息来，只按公开信息盘/g, "按现在桌面看，只按公开信息盘")
    .replace(/我先按公开信息来，不急着/g, "按现在桌面看，不急着")
    .replace(/我先把几个点合起来看，闭眼视角/g, "几个点合起来看，闭眼视角")
    .replace(/，我先/g, "，我")
    .replace(/。我先/g, "。我");
}

function limitSpeechSentences(speech: string, maxSentences: number): string {
  const parts = speech.match(/[^。！？]+[。！？]?/g);
  if (!parts || parts.length <= maxSentences) return speech;
  return parts.slice(0, maxSentences).join("").replace(/[。！？]?$/, "。");
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

  if (view.myRole === "SEER") {
    const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      if (plan.kind !== "claim-check" || plan.claimIntent?.claimedRole !== "SEER" || !plan.claimIntent.check) {
        return compactSpeech(`${opener}，我先不急着给死结论。${focus ? `我把${seatText(focus)}放观察位，看前后理由能不能接上。` : "这轮先找一条能验证的发言链。"}`);
      }
      const target = toTargetFromSeatId(view, latestCheck.targetSeatId);
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const followup =
        latestCheck.result === "WEREWOLF"
          ? "今天票口先压这条查杀线，外置位只给硬身份反证。"
          : `${seatText(target)}先别进今天的出人焦点。`;
      return compactSpeech(`我这里先把验人说清楚：${seatText(target)}是${resultText}。${followup}`);
    }
  }

  if (blackCheckOnMe) {
    const claimant = blackCheckOnMe.claimant;
    const responseLine =
      isWolfRole(view.myRole, view.rules.wolfRoles)
        ? "我不接这个查杀，先要求他把起跳时机和验人理由讲完整。"
        : "我不认这个查杀，我的票会先看他这张预言家牌能不能讲出完整验人链。";
    const nextLine =
      unspokenSeats.length > 0
        ? `后面只需要接一个点：${seatText(claimant)}这张预言家牌可信度从哪里来。`
        : "现在先对照已经发过言的位置，看谁是在补逻辑、谁是在顺手跟票。";
    return compactSpeech(`${opener}，${seatText(claimant)}给我查杀，${responseLine}${nextLine}`);
  }

  if (view.myRole === "WITCH" && view.privateKnowledge.witch?.savedTarget) {
    return compactSpeech(
      deathShapeAlreadyDiscussed
        ? `${opener}，平安夜我不复读了。${focus ? `我把${seatText(focus)}放观察位，看前后理由能不能接上。` : "这轮先看谁急着带方向。"}`
        : `昨晚平安夜这件事我先收住，不把药线讲死。${focus ? `我把${seatText(focus)}放观察位，看前后理由能不能接上。` : "这轮先看谁急着带方向。"}`,
    );
  }

  const checkLine = latestPublicCheck
    ? `${seatText(latestPublicCheck.claim.claimant)}报${seatText(latestPublicCheck.check.target)}${
        latestPublicCheck.check.result === "WEREWOLF" ? "查杀" : "金水"
      }，这条线我先看回应和站边，不急着只听一个结论。`
    : "";
  const tableLine = latestSpeaker
    ? `刚才${seatText(latestSpeaker)}这段我只抓一个点：${describeSpeechGap(latestSpeech?.message ?? "")}。`
    : latestDeath
      ? deathShapeAlreadyDiscussed
        ? `昨夜死讯和平安夜已经当背景处理，我不再复读药线。`
        : `昨夜死讯我先只当成死亡名单：${latestDeath}，不直接反推狼刀、毒或自刀。`
      : "第一轮信息还没铺开，我先看谁的发言能真正落到位置。";
  const focusHasSpoken = focus ? hasCurrentDaySpeech(view, focus.seatId) : false;
  const focusLine = focus
    ? focusHasSpoken
      ? pickBySeat(seed + 3, [
          `${seatText(focus)}先放观察位，我不直接归死。`,
          `我把${seatText(focus)}和刚才那段发言放一起核。`,
          `${seatText(focus)}这条线先留着，票口看后面有没有硬证据。`,
        ])
      : `${seatText(focus)}还没发言，我不提前评价，只等他轮到时接一个具体点。`
    : "我这票先不散，等发言链条更完整再落。";
  const timelineLine =
    unspokenSeats.length > 0
      ? pickBySeat(seed + 5, [
          "",
          `后面我只等${seatText(unspokenSeats[0]!)}接刚才这个点。`,
          `轮到${seatText(unspokenSeats[0]!)}时，接一下这条发言链就够。`,
        ])
      : "";

  return compactSpeech(`${opener}。${checkLine}${tableLine}${focusLine}${timelineLine}`);
}

function fallbackSpeech(
  provider: string,
  view: AgentView,
  plan: SpeechPlan,
  error: string,
  rawOutput?: unknown,
  validationErrors?: string[],
): AiSpeechResult {
  return {
    speech: createLooseFallbackSpeech(view, plan),
    provider,
    rawOutput,
    isFallback: true,
    error,
    validationErrors,
  };
}

function normalizeSpeech(speech: string): string {
  const clean = stripSpeechStageDirections(speech).trim().replace(/\s+/g, " ");
  return compactSpeechToLimit(limitSpeechSentences(dedupeSpeechSentences(clean), AI_SPEECH_MAX_SENTENCES), AI_SPEECH_MAX_CHARS);
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

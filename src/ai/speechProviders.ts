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
import { createSpeechPlan } from "./tableRead";
import type { AiSpeechProvider, AiSpeechProviderContext, AiSpeechResult } from "./types";

const SpeechSchema = z.object({
  speech: z.string().min(1),
});

const AI_SPEECH_MAX_CHARS = 800;
const AI_MOCK_SPEECH_MAX_CHARS = 380;
const SPEECH_SYSTEM_PROMPT =
  "你是狼人杀玩家本人。根据牌桌局势、你的身份信息和你的性格，自由发表这一轮公开发言。优先阅读 input.tableBriefing.text 和 input.publicContext.rules，它们是事实边界和当前板子规则，不是台词模板；再参考 input.expertStrategy、input.advancedReasoning、input.reasoningFrame、input.rolePlaybook、input.claimAudit、input.debateAgenda 和 input.playerSpeechGuide，expertStrategy 是高质量对局打法原则，advancedReasoning 是本局当前应该核验的逻辑清单，reasoningFrame 把硬证据、软信号、反面解释和验证问题拆开，rolePlaybook 是你当前角色的玩法分支和行动边界，claimAudit 专门审计身份坑、查验链和未对跳神职，debateAgenda 是本轮可以追问、收票和验证的动态议程，都不是固定话术。发言要像高阶玩家临场盘逻辑：观点先落地，随后给公开依据，补一句证据硬度或反面可能，再留下可验证的追问、改票条件或票口；优先串联验人、站边、票型、发言顺序和死亡播报，而不是只给情绪听感，也不要把座位、语气、短发言这类软信息当铁证。模型特点只是软性的打法倾向：例如 DeepSeek 偏逻辑链，Claude 偏边界审查，豆包偏强压，Kimi 偏长线记忆；不要自称模型，也不要为了表现风格牺牲局势判断。不要把内部分析标签说出口，例如“拆因果”“第一点”“盘问议程”“票口条件”“可改票条件”；要把这些材料改写成自然的牌桌发言。只输出玩家实际说出口的台词，不写括号内动作、神态、语气或旁白描写。发言可以有个人风格和策略，但不能违背事实简报：只能评价本日已经发过言的人；对尚未发言的后置位只能要求稍后表态，不能说他们已经信息少或没回应；天亮死讯只公开谁死亡，不公开狼刀、毒、自刀等具体死因，除非公开记录写明，不要把死因说死；无守卫女巫局可以把首夜单死或平安夜当公开死亡形态提出药线假设，但只能说成可能性。";

export type SpeechStrictness = "strict" | "guided" | "loose";

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
    };
  };
  expertStrategy: string[];
  advancedReasoning: string[];
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
    softInteraction: string[];
    avoid: string[];
  };
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
      speech: createMockSpeech(view, plan),
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
    return routedModelSpeechProvider;
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

          const speech = normalizeSpeech(parsed.speech);
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
  const strictSpeechPlan = strictness === "strict" ? sanitizeSpeechPlanForLlm(view, plan) : undefined;
  const constraints = buildSpeechConstraints(view, plan, strictness);
  const speechOrder = buildSpeechOrderContext(view);
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
    reasoningFrame,
    rolePlaybook,
    claimAudit,
    debateAgenda,
    playerSpeechGuide: buildPlayerSpeechGuide(view, plan, speechOrder),
    speechStrictness: strictness,
    llmConfig: view.llmConfig,
    ...(strictSpeechPlan ? { speechPlan: strictSpeechPlan } : {}),
    ...(constraints.length > 0 ? { constraints } : {}),
  };
}

function buildSpeechRulesContext(view: AgentView): LlmSpeechInput["publicContext"]["rules"] {
  const unavailableTerms = view.privateKnowledge.sheriff ? [] : ["警上", "警下", "警徽", "警长"];
  return {
    sheriffEnabled: Boolean(view.privateKnowledge.sheriff),
    note: view.privateKnowledge.sheriff
      ? "本局启用警长竞选、警徽和警下投票；警长白天放逐投票计 1.5 票。"
      : "本局没有警长竞选、警徽、警上、警下流程。",
    deathInfoNote: "天亮死讯只公开死亡名单，不公开狼刀、毒、自刀等具体死因；可以讨论公开死亡形态带来的合理假设，但不能把假设说成确定死因。",
    speechTimelineNote: "本日发言有先后顺序。只能评价已经发过言的玩家；尚未发言的后置位只能要求稍后补视角，不能说他们已经信息少、没站边或没回应。",
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
    },
  };
}

function buildSpeechOrderContext(view: AgentView): LlmSpeechInput["publicContext"]["speechOrder"] {
  const speakersAlreadyFinished = view.publicSummary.recentSpeeches
    .filter((speech) => speech.day === view.day && speech.speaker)
    .map((speech) => speech.speaker!);
  const currentDaySpokenSeatIds = new Set(
    speakersAlreadyFinished.map((seat) => seat.seatId),
  );
  return {
    currentSpeaker: toTargetFromSeatId(view, view.mySeatId),
    speakersAlreadyFinished,
    currentDaySpokenSeats: view.aliveSeats.filter((seat) => currentDaySpokenSeatIds.has(seat.seatId)),
    currentDayUnspokenSeats: view.aliveSeats.filter(
      (seat) => seat.seatId !== view.mySeatId && !currentDaySpokenSeatIds.has(seat.seatId),
    ),
  };
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
      : "你是靠前发言位，先铺视角、观察点和后置位任务，不要假装已经听完全场。";

  return {
    tablePlayerStyle: [
      "像坐在桌边发言：2-4句短句，只抓一条主线；先给当前站边或保留态度，再给1个公开理由，最后留下追问、票口或后置位任务。",
      "尽量形成一条因果链：为什么这样站、这个理由有多硬、下一轮看什么验证；不要把所有审计点都塞进同一段。",
      "允许牌桌口吻，例如“我先不站死”“这个点先记”“这轮票口先放这里”，但不要连续多句都用“我先”开头。",
      targetLine,
      stageLine,
    ],
    modelStyle: buildModelSpeechStyleGuide(view),
    softInteraction: [
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
      "不要把模型特点说成自我介绍、模型名口号或固定模板。",
      "不要机械复述事实简报、公开边界或规则说明。",
      "少用报告腔词组，例如“理由是”“依据是”“这个结论来自”；把它们改成牌桌口吻，如“卡我的是”“我打他的点是”。",
      "不要把内部标签说成台词，例如“拆因果”“第一点”“盘问议程”“可改票条件”。",
      "不要面面俱到；身份坑、票型、发言顺序、死亡播报里选一个最能推进本轮的问题。",
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
      tendencies: [style, goal, "可以保留余地，但最后仍要给可执行的观察位或票口。"],
    };
  }

  if (modelName.includes("GPT")) {
    return {
      modelName,
      softTendency: "偏综合组织：把多条公开信息收束成一个能推进桌面的判断。",
      tendencies: [style, goal, "适合把身份线、发言顺序和票型放在同一段里归纳。"],
    };
  }

  if (modelName.includes("豆包")) {
    return {
      modelName,
      softTendency: "偏强压节奏：结论更早、追问更直接，但不能乱踩未发言位。",
      tendencies: [style, goal, "适合要求目标正面补过程、补站边或解释票口。"],
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
      tendencies: [style, goal, "适合说清楚哪些点暂放、哪些点需要后置位回答。"],
    };
  }

  if (modelName.includes("GLM")) {
    return {
      modelName,
      softTendency: "偏结构站边：看阵营关系、身份冲突和谁在帮谁收口。",
      tendencies: [style, goal, "适合把人分成观察位、可信位和需要解释的位置。"],
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
  const publicBoundary = [
    "公开信息只包括：已经公开的发言、死亡播报、身份声明、公开查验声明和已公开票型。",
    "本轮已发言玩家可以被评价；本轮未发言玩家只能被要求稍后表态。",
    "天亮死讯只公开倒牌结果，不公开狼刀、毒、自刀等具体死因；可以讨论死亡形态的公开假设，不能说成确定死因。",
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
    buildDeathBriefingLine(view),
    buildSheriffBriefingLine(view),
    buildSheriffVoteBriefingLine(view),
    buildClaimBriefingLine(view),
    buildSeerLegacyBriefingLine(view),
    ...recentCurrentDaySpeeches.map(
      (speech) => `${seatText(speech.speaker!)}刚才说：${clipBriefingText(speech.message, 90)}`,
    ),
  ].filter((line) => line && !line.endsWith("：无。"));

  const privateFacts = buildPrivateBriefingLines(view);
  const unknowns = [
    "你不能知道其他玩家真实身份，除非这是你自己的身份、狼队视角或真实预言家查验。",
    "公开死讯不能擅自说成确定的狼刀、毒、自刀或女巫用药；若板子无守卫，只能以假设方式讨论死亡形态和药线。",
    "尚未发言的后置位还没有给本轮态度，不能评价他们已经信息少、没回应或没站边。",
    ...(view.privateKnowledge.sheriff ? [] : ["没有警上、警下、警徽、警长流程，不要使用这些概念。"]),
  ];
  const legalSpeechFocus = [
    speechOrder.speakersAlreadyFinished.length > 0
      ? `可以评价已发言的${formatSeatList(speechOrder.speakersAlreadyFinished)}。`
      : "你是本日靠前发言位，只能先铺自己的视角和观察点。",
    speechOrder.currentDayUnspokenSeats.length > 0
      ? `可以要求后置位${formatSeatList(speechOrder.currentDayUnspokenSeats)}稍后补视角。`
      : "本日已经没有后置位，可以开始收束今天的站边和票型。",
    plan.target
      ? `本轮可以围绕${seatText(plan.target)}展开判断，但不要把这个目标当成系统要求的固定模板。`
      : "本轮可以自由选择公开身份线、死讯、前置发言或票型作为切入点。",
  ];

  const publicReasoningCues = view.publicSummary.tableMemory.reasoningCues
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

function buildDeathBriefingLine(view: AgentView): string {
  const deaths = [
    ...new Set([
      ...view.publicSummary.recentDeaths,
      ...view.publicSummary.tableMemory.deathAnnouncements,
    ]),
  ].slice(-3);
  return deaths.length > 0
    ? `公开死讯：${deaths.join("；")}。死因未知，不能直接反推狼刀、毒或自刀；可按板子讨论公开死亡形态假设。`
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
        "药瓶、刀口和用药信息只有你知道；未跳身份前不要说成全桌都知道的事实。",
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
      return [...common, "闭眼平民没有夜间信息，不能伪造查验、药瓶、刀口或狼队视角。"];
  }
}

function formatSeatList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map((seat) => seatText(seat)).join("、") : "无";
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
  if (strictness !== "strict") return [];

  const errors: string[] = [];
  const normalized = normalizeDigits(speech);
  const validSeatIds = new Set(view.aliveSeats.map((seat) => seat.seatId));
  const publicClaim = extractRoleClaimFromSpeech({
    day: view.day,
    claimantSeatId: view.mySeatId,
    message: normalized,
    validSeatIds,
  });

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

function buildSpeechConstraints(view: AgentView, plan: SpeechPlan, strictness: SpeechStrictness): string[] {
  if (strictness === "strict") {
    const strictConstraints = [
      "只输出白天公开发言，不输出投票、夜晚动作或解释 JSON 之外的内容。",
      "必须遵守 speechPlan 的 kind、target、talkingPoints、interaction、personaCue 和 claimIntent，不新增身份声明或查验。",
      "每段发言必须锚定至少一个局内对象或公开事件：座位、上一段发言、死讯、票型、身份声明或查验；不要输出寒暄、规则解释或模型自述。",
      "可以要求 currentDayUnspokenSeats 里的后置位稍后补视角，但不得说他们已经发言少、信息量少、没站边、没回应死讯或只给结论。",
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
      }
    }

    if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
      strictConstraints.push("狼人视角只用于表达策略，不得在发言里暴露狼队或把狼队友报成查杀。");
    }

    return strictConstraints;
  }

  return [];
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

  errors.push(...validateSpeechTimeline(view, speech));

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
    const targetMentioned = speech.includes(`${seat.seatId}号`) || (seat.name !== "你" && speech.includes(seat.name));
    if (!targetMentioned) continue;

    const saysAlreadyLowInfo =
      /(到现在|目前|现在|已经|一直|前面|刚刚).{0,16}(信息量|发言|站边|态度|死讯|回应|解释|判断)/.test(speech) ||
      /(信息量|发言).{0,10}(太少|少|偏少|不足|太空|空|低)/.test(speech) ||
      /(没有|没|未).{0,10}(明确站边|站边|态度|回应|解释|判断|对死讯|对昨夜|给信息)/.test(speech) ||
      /只给结论|发言偏短|过程不够|回避站边/.test(speech);

    const framesAsFuture = /(后置|后面|等.{0,6}发言|轮到|如果.{0,18}(发言|后面|后置)|稍后|一会儿)/.test(speech);
    if (saysAlreadyLowInfo && !framesAsFuture) {
      return [`把本轮未发言的${seat.seatId}号当成已发言评价`];
    }
  }

  return [];
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
  const target = plan.target ?? view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId);
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
  const tableSentence = `${buildMockTablePlayerLine(args.view, args.target)}。`;
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
    .replace(/本轮围绕(.+?)给可改票条件[：:]\s*解释能闭环则后移焦点，继续只给结论则进票池/, "$1讲得通我放一轮，讲不通就收票")
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

function buildMockTablePlayerLine(view: AgentView, target: ActionTarget | undefined): string {
  const currentDaySpeeches = view.publicSummary.recentSpeeches.filter(
    (speech) => speech.day === view.day && speech.speaker && speech.speaker.seatId !== view.mySeatId,
  );
  const previousSpeech = currentDaySpeeches.at(-1);
  const previousSpeaker = previousSpeech?.speaker;
  const targetText = target ? seatText(target) : "主焦点";
  const seed = mockSpeechSeed(view, target, 7);

  if (currentDaySpeeches.length === 0) {
    return pickBySeat(seed, [
      target ? `前置位先把${targetText}放进观察位` : "前置位先把观察点摆出来",
      target ? `前面样本少，后面重点听${targetText}怎么补站边和票` : "前面样本少，给后置位留任务",
      target ? `${targetText}不定死，只说后面要看他的站边和票` : "先铺视角，不假装已经听完全场",
    ]);
  }

  if (previousSpeaker && target && previousSpeaker.seatId === target.seatId) {
    const speechGap = previousSpeech ? describeSpeechGap(previousSpeech.message) : "过程还没完全闭合";
    return pickBySeat(seed, [
      `${targetText}刚发过言，我先抓他这段里${speechGap}的部分`,
      `我接着${targetText}刚才的话说，他的结论还要和后面票型对上`,
      `${targetText}这段我不急着定性，先看他能不能把理由补硬`,
    ]);
  }

  if (previousSpeaker && target && previousSpeaker.seatId !== target.seatId) {
    return pickBySeat(seed, [
      `刚才${seatText(previousSpeaker)}我先当成一条对照线，等${targetText}回应后再决定票口`,
      `上一位${previousSpeaker.name}的线我记下，但我不会顺着他直接改票，先看${targetText}能不能补过程`,
      `前置${previousSpeaker.name}提供了一个方向，我这里把${targetText}的站边和票型放一起核`,
    ]);
  }

  return pickBySeat(seed, [
    target ? `后置位可以反驳我，但要拿公开信息补${target.seatId}号的过程` : "后置位有更硬信息我再改",
    target ? `${targetText}这条线我先不封死，等下一轮用票型回验` : "我先给可改判断，后面看票型回验",
    target ? `这不是一锤定音，后面谁能把${target.seatId}号的逻辑补上我会听` : "现在先不抢终局结论，等更多公开材料",
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
    items.push(`${seatText(focus.seat)}成为焦点是因为${focus.reasons.slice(0, 2).join("、")}`);
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
  const plannedCheck = plan.claimIntent?.claimedRole === "SEER" ? plan.claimIntent.check : undefined;
  if (plannedCheck && plannedCheck.targetSeatId === target.seatId) {
    return buildSeerCheckCondition(plannedCheck.result, target);
  }

  const targetText = seatText(target);
  const seed = mockSpeechSeed(view, target, 11);
  const targetHasSpoken = view.publicSummary.recentSpeeches.some(
    (speech) => speech.day === view.day && speech.speaker?.seatId === target.seatId,
  );

  if (plan.kind === "rally") {
    return pickBySeat(seed, [
      `如果后置没有更强反证，今天可以先往${targetText}收票。`,
      `我这轮的票口先往${targetText}靠，后置位要改我就给更硬证据。`,
      `除非后面有人把这条线打断，不然${targetText}可以进今天主票口。`,
    ]);
  }

  if (plan.kind === "defend") {
    return pickBySeat(seed, [
      `如果${targetText}能补出清楚逻辑，我会把他从第一焦点往后放。`,
      `${targetText}只要把动机和票型讲顺，我这边可以先撤压力。`,
      `我保留可改空间，关键看${targetText}后面能不能把公开过程接上。`,
    ]);
  }

  if (targetHasSpoken) {
    return pickBySeat(seed, [
      `${targetText}这段我先挂疑问，等投票前再看有没有人能补出反证。`,
      `我不会只凭一个点出${targetText}，但他刚才的过程需要在票型前补硬。`,
      `这票可以先压在${targetText}附近，除非后面有人给出更完整的反面解释。`,
    ]);
  }

  return pickBySeat(seed, [
    `等轮到${targetText}发言时，我要听他把站边理由和票口讲完整。`,
    `${targetText}还没发言，我就看他能不能别只给结论，把过程补出来。`,
    `如果${targetText}后面只给态度不给依据，我会把票往他身上收；讲得通我再换焦点。`,
  ]);
}

function mockSpeechSeed(view: AgentView, target: ActionTarget | undefined, salt = 0): number {
  return view.day * 31 + view.mySeatId * 17 + (target?.seatId ?? 0) * 13 + salt;
}

function buildSeerCheckCondition(result: "WEREWOLF" | "GOOD", target: ActionTarget): string {
  const targetText = seatText(target);
  if (result === "WEREWOLF") {
    return `今天先让${targetText}正面解释，外置位不要分票。`;
  }
  return `${targetText}先放一轮，不作为今天出人焦点；后面谁无理由硬踩金水位，我再重点看。`;
}

function createMockSpeech(view: AgentView, plan = createSpeechPlan(view)): string {
  const structuredSpeech = createStructuredMockSpeech(view, plan);
  if (structuredSpeech) return structuredSpeech;
  const persona = `${view.persona?.name ?? ""} ${view.persona?.label ?? "稳健型"}`.trim();
  const lastDeath = view.publicSummary.recentDeaths.at(-1);
  const targetName = plan.target?.name ?? view.aliveSeats.find((seat) => seat.seatId !== view.mySeatId)?.name ?? "场上玩家";
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
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const checkedTarget = toTargetFromSeatId(view, latestCheck.targetSeatId);
      return compactSpeech(
        `${opener}，我跳预言家，${seatText(checkedTarget)}是${resultText}。${buildSeerCheckCondition(latestCheck.result, checkedTarget)}${dynamicText ? `${dynamicText}。` : ""}${latestCheck.result === "GOOD" ? "我会看谁反打这张金水。" : secondReason}。`,
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
        `${focusReason}，所以我今天更想听 ${targetName} 怎么补逻辑。`,
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
    return pickBySeat(seed, ["我从结构上看", "这里的态度不太自然", "先拆站边结构"]);
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
    .replace(/什么公开反证会让你改票/g, "有没有反证能让我改票")
    .replace(/给可改票条件/g, "给能落地的改票条件")
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
  const latestSpeech = [...view.publicSummary.recentSpeeches]
    .reverse()
    .find((speech) => speech.speaker && speech.speaker.seatId !== view.mySeatId);
  const latestSpeaker = latestSpeech?.speaker;
  const latestDeath = view.publicSummary.recentDeaths.at(-1);
  const currentDaySpeakers = view.publicSummary.recentSpeeches
    .filter((speech) => speech.day === view.day && speech.speaker)
    .map((speech) => speech.speaker!);
  const unspokenSeats = view.aliveSeats.filter(
    (seat) => seat.seatId !== view.mySeatId && !currentDaySpeakers.some((speaker) => speaker.seatId === seat.seatId),
  );
  const publicSeerClaims = view.publicSummary.claimBoard.filter((claim) => claim.claimedRole === "SEER");
  const blackCheckOnMe = publicSeerClaims.find((claim) =>
    claim.checks.some((check) => check.target.seatId === view.mySeatId && check.result === "WEREWOLF"),
  );
  const latestPublicCheck = publicSeerClaims
    .flatMap((claim) => claim.checks.map((check) => ({ claim, check })))
    .at(-1);

  if (view.myRole === "SEER") {
    const latestCheck = view.privateKnowledge.seerChecks?.at(-1);
    if (latestCheck) {
      const target = toTargetFromSeatId(view, latestCheck.targetSeatId);
      const resultText = latestCheck.result === "WEREWOLF" ? "查杀" : "金水";
      const followup =
        latestCheck.result === "WEREWOLF"
          ? `今天我想先听${seatText(target)}怎么回应。`
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
        ? `后置位先别只跟结论，等你们发言时把对${seatText(claimant)}的可信度说清楚。`
        : "现在先对照已经发过言的位置，看谁是在补逻辑、谁是在顺手跟票。";
    return compactSpeech(`${opener}，${seatText(claimant)}给我查杀，${responseLine}${nextLine}`);
  }

  if (view.myRole === "WITCH" && view.privateKnowledge.witch?.savedTarget) {
    return compactSpeech(
      `昨晚平安夜这件事我先收住，不把药线讲死。${focus ? `我更想听${seatText(focus)}把站边和票型说完整。` : "这轮先看谁急着带方向。"}`,
    );
  }

  const checkLine = latestPublicCheck
    ? `${seatText(latestPublicCheck.claim.claimant)}报${seatText(latestPublicCheck.check.target)}${
        latestPublicCheck.check.result === "WEREWOLF" ? "查杀" : "金水"
      }，这条线我先看回应和站边，不急着只听一个结论。`
    : "";
  const tableLine = latestSpeaker
    ? `刚才${seatText(latestSpeaker)}的发言我先按时间顺序记下来，只评价他已经说出口的部分。`
    : latestDeath
      ? `昨夜死讯我先只当成死亡名单：${latestDeath}，不直接反推狼刀、毒或自刀。`
      : "第一轮信息还没铺开，我先看谁的发言能真正落到位置。";
  const focusLine = focus
    ? `目前我想多听${seatText(focus)}的视角，票先跟着公开发言质量走。`
    : "我这票先不散，等发言链条更完整再落。";
  const timelineLine =
    unspokenSeats.length > 0
      ? `后置位${unspokenSeats
          .slice(0, 3)
          .map((seat) => `${seat.seatId}号`)
          .join("、")}还没发言，我只要求他们后面给态度，不提前给他们扣信息少。`
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
  return compactSpeechToLimit(clean, AI_SPEECH_MAX_CHARS);
}

function compactSpeechToLimit(speech: string, limit: number): string {
  if (speech.length <= limit) return speech;
  const head = speech.slice(0, limit);
  const sentenceEnd = Math.max(head.lastIndexOf("。"), head.lastIndexOf("！"), head.lastIndexOf("？"), head.lastIndexOf("；"));
  if (sentenceEnd >= Math.floor(limit * 0.55)) return head.slice(0, sentenceEnd + 1);
  const commaEnd = Math.max(head.lastIndexOf("，"), head.lastIndexOf("、"));
  if (commaEnd >= Math.floor(limit * 0.7)) return `${head.slice(0, commaEnd)}。`;
  return `${head.slice(0, Math.max(0, limit - 1))}。`;
}

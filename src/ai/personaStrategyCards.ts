import { isWolfRole } from "@/game/roleUtils";
import type {
  ActionTarget,
  AgentView,
  AiCharacterRoleCard,
  AiPersona,
  AiPersonaPreferences,
  Role,
  SpeechPlan,
  VotePlan,
} from "@/game/types";

export type PersonaCampLayer = "good" | "werewolf" | "power";

export type OrdinaryLiveIntent =
  | "push_vote"
  | "defend_self"
  | "test_reaction"
  | "observe"
  | "counter_push"
  | "explain_pivot"
  | "follow_vote_shape"
  | "protect_claim"
  | "light_night_targeting";

export type PersonaCampStrategy = {
  goal: string;
  speechMotives: string[];
  voteMotives: string[];
  nightMotives: string[];
  failureModes: string[];
};

export type PersonaStrategyCard = {
  id: string;
  modelName: string;
  personaLabel: string;
  summary: string;
  temperament: string[];
  antiTemplateMoves: string[];
  camp: Record<PersonaCampLayer, PersonaCampStrategy>;
};

export type AdaptedPersonaStrategyCard = PersonaStrategyCard & {
  campLayer: PersonaCampLayer;
  activeGoal: string;
  activeSummary: string;
  activeSpeechMotives: string[];
  activeVoteMotives: string[];
  activeNightMotives: string[];
  activeFailureModes: string[];
};

export type AiOrdinaryLiveIntentState = {
  intent: OrdinaryLiveIntent;
  campLayer: PersonaCampLayer;
  focusTarget?: ActionTarget;
  previousTarget?: ActionTarget;
  publicReason: string;
  commitment: string;
  voteContinuity: string;
  antiTemplateMove: string;
};

const POWER_ROLES = new Set<Role>(["SEER", "WITCH", "HUNTER", "IDIOT", "KNIGHT", "GUARD"]);

export function inferPersonaStrategyCard({
  persona,
  roleCard,
}: {
  persona: AiPersona;
  roleCard?: AiCharacterRoleCard;
}): PersonaStrategyCard {
  const known = knownStrategyCard(persona);
  if (known) return known;

  const sourceText = [
    persona.label,
    persona.style,
    persona.goal,
    roleCard?.speechStyleZh,
    roleCard?.reasoningBias,
    roleCard?.voteBias,
    roleCard?.pressureResponse,
  ]
    .filter(Boolean)
    .join(" ");
  const preferences = persona.preferences ?? fallbackPreferences();
  const antiTemplateMoves = inferAntiTemplateMoves(sourceText, preferences);
  const summary = `${persona.label || persona.name}：${summarizeCustomStyle(sourceText, preferences)}`;

  return {
    id: `strategy:${persona.id}`,
    modelName: persona.name,
    personaLabel: persona.label,
    summary,
    temperament: [
      preferences.caution >= 0.66 ? "谨慎" : persona.riskTolerance >= 0.66 ? "进攻" : "均衡",
      preferences.memory >= 0.7 ? "记忆延续" : "临场取舍",
      preferences.emotion >= 0.7 ? "反应驱动" : "证据驱动",
    ],
    antiTemplateMoves,
    camp: buildCampStrategies(summary, antiTemplateMoves, {
      goodFailure: preferences.caution >= 0.65 || /慢|克制|谨慎|不轻易|保留/.test(sourceText)
        ? "过度观望，迟迟不给可验证结论"
        : "把轻证据压成死结论",
      wolfFailure: preferences.deception < 0.45 ? "狼面太收，伪装成无风险旁观" : "伪装过满，容易露出收益动机",
      powerFailure: "只报身份收益，不给后续验证路径",
    }),
  };
}

export function adaptPersonaStrategyForView(
  view: Pick<AgentView, "myRole" | "persona" | "roleCard" | "rules">,
  card = inferPersonaStrategyCard({
    persona: view.persona ?? fallbackPersona(),
    roleCard: view.roleCard,
  }),
): AdaptedPersonaStrategyCard {
  const campLayer = resolveCampLayer(view.myRole, view.rules.wolfRoles);
  const active = card.camp[campLayer];
  const activeSummary =
    campLayer === "werewolf"
      ? `${card.summary}；本局狼人侧用公开理由伪装、切割或带节奏。`
      : campLayer === "power"
        ? `${card.summary}；本局神职侧优先把能力收益转成公开可验证路径。`
        : `${card.summary}；本局好人侧优先用公开事实推进。`;

  return {
    ...card,
    campLayer,
    activeGoal: active.goal,
    activeSummary,
    activeSpeechMotives: active.speechMotives,
    activeVoteMotives: active.voteMotives,
    activeNightMotives: active.nightMotives,
    activeFailureModes: active.failureModes,
  };
}

export function buildOrdinaryLiveIntent(
  view: AgentView,
  speechPlan?: SpeechPlan,
  votePlan?: VotePlan,
): AiOrdinaryLiveIntentState {
  const strategy = adaptPersonaStrategyForView(view);
  const memory = view.privateKnowledge.aiMemory;
  const voteTarget = votePlan?.target;
  const speechTarget = speechPlan?.target;
  const focusTarget =
    voteTarget ??
    speechTarget ??
    targetFromSeatId(view, memory?.focusSeatId ?? memory?.lastSpeechTargetSeatId ?? memory?.lastVoteTargetSeatId) ??
    view.publicSummary.tableMemory.focus[0]?.seat;
  const previousTarget = targetFromSeatId(view, memory?.lastSpeechTargetSeatId ?? memory?.lastVoteTargetSeatId);
  const selfUnderPressure = view.publicSummary.tableMemory.focus.some((item) => item.seat.seatId === view.mySeatId && item.score >= 36);
  const intent = chooseLiveIntent(view, strategy.campLayer, {
    focusTarget,
    previousTarget,
    selfUnderPressure,
    hasVoteTarget: Boolean(voteTarget),
  });
  const antiTemplateMove = chooseAntiTemplateMove(strategy, view.day + view.mySeatId);
  const publicReason = buildPublicReason(view, intent, focusTarget, previousTarget, speechPlan, votePlan);
  const commitment = buildCommitment(view, intent, focusTarget);
  const voteContinuity = buildVoteContinuity(intent, focusTarget, previousTarget);

  return {
    intent,
    campLayer: strategy.campLayer,
    focusTarget,
    previousTarget,
    publicReason,
    commitment,
    voteContinuity,
    antiTemplateMove,
  };
}

export function formatOrdinaryLiveIntentForPrompt(state: AiOrdinaryLiveIntentState | undefined): string | undefined {
  if (!state) return undefined;
  return [
    `打法取舍：${describeOrdinaryLiveIntent(state.intent)}`,
    state.focusTarget ? `当前关注${seatLabel(state.focusTarget)}` : "当前不锁死固定票口",
    state.previousTarget ? `上一轮曾经点过${seatLabel(state.previousTarget)}` : undefined,
    `公开理由：${state.publicReason}`,
    `后续约束：${state.commitment}`,
    `投票延续：${state.voteContinuity}`,
    `本轮换一种推进动作：${state.antiTemplateMove}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("；");
}

export function formatPersonaStrategyForPrompt(strategy: AdaptedPersonaStrategyCard): string {
  return [
    strategy.activeSummary,
    `发言动机：${strategy.activeSpeechMotives.join("；")}`,
    `投票动机：${strategy.activeVoteMotives.join("；")}`,
    `夜晚取舍：${strategy.activeNightMotives.join("；")}`,
    `反模板动作：${strategy.antiTemplateMoves.join("；")}`,
    `易犯问题：${strategy.activeFailureModes.join("；")}`,
  ].join("\n");
}

export function strategySummaryForAiFriend(persona: AiPersona, roleCard?: AiCharacterRoleCard): string {
  const card = inferPersonaStrategyCard({ persona, roleCard });
  return `${card.summary}｜反模板：${card.antiTemplateMoves.slice(0, 2).join("、")}`;
}

function knownStrategyCard(persona: AiPersona): PersonaStrategyCard | undefined {
  const id = persona.id.toLowerCase();
  if (id.includes("deepseek")) {
    return baseCard(persona, {
      summary: "逻辑链推演：用公开事实链拆发言顺序、票型因果和前后矛盾。",
      temperament: ["克制", "证据链", "低情绪"],
      antiTemplateMoves: ["引用一句公开发言再拆因果", "把票型动机和发言顺序连起来", "给下一轮可验证条件"],
      goodFailure: "过度求稳，发言像审计报告",
      wolfFailure: "伪装太干净，缺少自然反应",
      powerFailure: "只报结论，少了公开验证路径",
    });
  }
  if (id.includes("claude")) {
    return baseCard(persona, {
      summary: "边界审查：组织桌面、审查事实边界，并要求可疑位补清楚站边。",
      temperament: ["稳健", "归纳", "领导"],
      antiTemplateMoves: ["收束两条公开分歧", "要求一个明确回应", "把票口和边界分开说"],
      goodFailure: "边界过厚，错过临场反应",
      wolfFailure: "领导感太满，暴露控场收益",
      powerFailure: "身份边界说得清，但压迫不足",
    });
  }
  if (id.includes("gpt")) {
    return baseCard(persona, {
      summary: "平衡组织：把分散信息整理成能讨论的当前框架。",
      temperament: ["均衡", "组织", "留余地"],
      antiTemplateMoves: ["先承认不确定再给一个焦点", "把两名玩家做对照", "用当前票型提出验证方向"],
      goodFailure: "过度折中，结论偏软",
      wolfFailure: "转向理由太圆滑，像刻意控风险",
      powerFailure: "组织很多，但身份收益不够尖",
    });
  }
  if (id.includes("mimo")) {
    return baseCard(persona, {
      summary: "细节校验：追踪上一轮发言、票型变化和站边转向。",
      temperament: ["细节", "记忆", "校验"],
      antiTemplateMoves: ["抓前后两句话的变化", "延续自己上一轮压力", "用票型变化追问转向动机"],
      goodFailure: "陷入细节循环，忽略更硬身份信息",
      wolfFailure: "切割或转压时过度解释",
      powerFailure: "盯细节太久，能力信息没有转成桌面行动",
    });
  }
  if (id.includes("kimi")) {
    return baseCard(persona, {
      summary: "身份线长记忆：围绕对跳、金水、查杀和前后站边变化推进。",
      temperament: ["身份线", "长线", "记忆"],
      antiTemplateMoves: ["把身份声明和投票前后连起来", "追踪金水/查杀的后续反应", "比较昨天与今天的站边变化"],
      goodFailure: "过度身份化，忽略普通发言破绽",
      wolfFailure: "编身份线过重，容易前后冲突",
      powerFailure: "沉迷身份框架，少给今天怎么投",
    });
  }
  if (id.includes("doubao")) {
    return baseCard(persona, {
      summary: "快节奏压迫：用强压和即时反应带动桌面互动。",
      temperament: ["强压", "反应", "带节奏"],
      antiTemplateMoves: ["逼一个当场回应", "从反应差切票型收益", "用短句制造压力但留公开理由"],
      goodFailure: "轻证据上头，误伤好人",
      wolfFailure: "压迫过猛，暴露带票收益",
      powerFailure: "强动作太早，身份价值被浪费",
    });
  }
  if (id.includes("gemini")) {
    return baseCard(persona, {
      summary: "多线观察：短发言、保留判断，但留下清晰观察点。",
      temperament: ["安静", "多线", "谨慎"],
      antiTemplateMoves: ["只给一个观察点", "把焦点暂挂而非站死", "说明下一轮看什么回验"],
      goodFailure: "存在感太低，像逃避责任",
      wolfFailure: "过度低暴露，被看成划水",
      powerFailure: "能力信息藏太久，桌面无法使用",
    });
  }
  if (id.includes("glm")) {
    return baseCard(persona, {
      summary: "结构站边：从语气、态度和临场反应里找结构矛盾。",
      temperament: ["结构", "态度", "反应"],
      antiTemplateMoves: ["把态度变化落到具体句子", "比较强势位和回避位的收益", "说明反应为什么不像自然好人"],
      goodFailure: "把态度读成铁证",
      wolfFailure: "结构话太满，像预设结论",
      powerFailure: "反应判断盖过身份信息",
    });
  }
  return undefined;
}

function baseCard(
  persona: AiPersona,
  options: {
    summary: string;
    temperament: string[];
    antiTemplateMoves: string[];
    goodFailure: string;
    wolfFailure: string;
    powerFailure: string;
  },
): PersonaStrategyCard {
  return {
    id: `strategy:${persona.id}`,
    modelName: persona.name,
    personaLabel: persona.label,
    summary: options.summary,
    temperament: options.temperament,
    antiTemplateMoves: options.antiTemplateMoves,
    camp: buildCampStrategies(options.summary, options.antiTemplateMoves, {
      goodFailure: options.goodFailure,
      wolfFailure: options.wolfFailure,
      powerFailure: options.powerFailure,
    }),
  };
}

function buildCampStrategies(
  summary: string,
  antiTemplateMoves: string[],
  failures: { goodFailure: string; wolfFailure: string; powerFailure: string },
): Record<PersonaCampLayer, PersonaCampStrategy> {
  const primaryMove = antiTemplateMoves[0] ?? "给一个可验证公开切口";
  return {
    good: {
      goal: "用公开事实推进好人票型，避免把软状态说成铁证。",
      speechMotives: [`围绕公开事实推进：${primaryMove}`, "留出可被后置位验证的条件", "解释自己为什么保留或施压"],
      voteMotives: ["优先硬公开信息，其次票型/发言闭合度", "跟随自己发言压力或解释改票"],
      nightMotives: ["如果有夜晚能力，优先保护或验证公开价值最高的位置"],
      failureModes: [failures.goodFailure],
    },
    werewolf: {
      goal: "用公开理由伪装好人视角，制造错误焦点或必要切割。",
      speechMotives: ["伪装成公开证据推理", "把压力导向非队伍收益点", "必要时切割但只给公开理由"],
      voteMotives: ["跟进能成票的公开焦点", "需要切割时解释成票型或发言矛盾"],
      nightMotives: ["夜晚优先处理公开威胁、神职风险或能制造白天误读的位置"],
      failureModes: [failures.wolfFailure],
    },
    power: {
      goal: "把能力信息转成公开可执行路线，同时保护身份价值。",
      speechMotives: ["把能力收益转成公开可验证路径", "该拍身份时说清今天怎么处理", "不无意义暴露未公开能力细节"],
      voteMotives: ["围绕公开查验、药口、枪口或守护收益归票", "解释身份信息和票型的连接"],
      nightMotives: ["夜晚动作兼顾收益、存活和次日公开讨论价值"],
      failureModes: [failures.powerFailure],
    },
  };
}

function resolveCampLayer(role: Role, wolfRoles: readonly Role[] | undefined): PersonaCampLayer {
  if (isWolfRole(role, wolfRoles)) return "werewolf";
  if (POWER_ROLES.has(role)) return "power";
  return "good";
}

function chooseLiveIntent(
  view: AgentView,
  campLayer: PersonaCampLayer,
  options: {
    focusTarget?: ActionTarget;
    previousTarget?: ActionTarget;
    selfUnderPressure: boolean;
    hasVoteTarget: boolean;
  },
): OrdinaryLiveIntent {
  if (options.selfUnderPressure) return campLayer === "werewolf" ? "counter_push" : "defend_self";
  if (view.phase.startsWith("NIGHT_")) return "light_night_targeting";
  if (view.phase === "DAY_VOTE" && options.hasVoteTarget) {
    if (options.previousTarget && options.focusTarget?.seatId !== options.previousTarget.seatId) return "explain_pivot";
    return "follow_vote_shape";
  }
  if (options.focusTarget) return campLayer === "werewolf" ? "counter_push" : "push_vote";
  return view.day <= 1 ? "observe" : "test_reaction";
}

function buildPublicReason(
  view: AgentView,
  intent: OrdinaryLiveIntent,
  focusTarget: ActionTarget | undefined,
  previousTarget: ActionTarget | undefined,
  speechPlan: SpeechPlan | undefined,
  votePlan: VotePlan | undefined,
): string {
  const focus = focusTarget ? seatLabel(focusTarget) : "当前焦点";
  const voteReason = cleanPublicLine(votePlan?.reason);
  const speechStance = cleanPublicLine(speechPlan?.stance);
  if (intent === "explain_pivot" && previousTarget && focusTarget) {
    return `从上一轮点过${seatLabel(previousTarget)}转向${focus}，必须用公开新增证据说明为什么更硬：${voteReason || speechStance || "票型或发言变化更能解释当前局面"}`;
  }
  if (intent === "follow_vote_shape" && focusTarget) {
    return `延续对${focus}的公开压力，说明疑点为什么没有解除：${voteReason || speechStance || "发言和票型还没闭合"}`;
  }
  if (intent === "defend_self") {
    return "先接住别人打自己的公开理由，再挑一个能让全桌复核的问题回去。";
  }
  if (intent === "counter_push") {
    return `先从${focus}说出口的句子和投票动作里找矛盾。`;
  }
  if (intent === "light_night_targeting") {
    return `夜晚动作只按公开威胁、身份收益和次日讨论价值取舍，理由保持公开安全。`;
  }
  return focusTarget
    ? `围绕${focus}落一个能被公开复核的疑点，别铺全场。`
    : "先留一个能被下一轮发言或投票回看的观察点。";
}

function buildCommitment(
  view: AgentView,
  intent: OrdinaryLiveIntent,
  focusTarget: ActionTarget | undefined,
): string {
  const focus = focusTarget ? seatLabel(focusTarget) : "一个公开焦点";
  if (view.phase === "DAY_VOTE") {
    return intent === "explain_pivot"
      ? `投票时必须说清为什么从旧焦点改到${focus}。`
      : `投票时延续${focus}需要说明疑点未解除。`;
  }
  if (view.phase.startsWith("NIGHT_")) return "夜晚动作不得把隐藏信息写进公开理由。";
  return `后面如果投${focus}，就沿着同一个疑点走；如果换目标，要说出新的公开证据。`;
}

function buildVoteContinuity(
  intent: OrdinaryLiveIntent,
  focusTarget: ActionTarget | undefined,
  previousTarget: ActionTarget | undefined,
): string {
  if (intent === "explain_pivot" && previousTarget && focusTarget) {
    return `从${seatLabel(previousTarget)}改到${seatLabel(focusTarget)}，必须解释公开证据升级。`;
  }
  if (focusTarget) return `发言和投票都围绕${seatLabel(focusTarget)}的同一个公开疑点，改票要解释。`;
  return "没有固定票口时也要留下下一轮可回验的公开条件。";
}

function describeOrdinaryLiveIntent(intent: OrdinaryLiveIntent): string {
  switch (intent) {
    case "push_vote":
      return "给出一个能被投票验证的公开疑点";
    case "defend_self":
      return "先回应自己身上的压力，再转成可核对问题";
    case "test_reaction":
      return "抛一个窄问题看对方怎么接";
    case "observe":
      return "留观察点，不急着定死";
    case "counter_push":
      return "把压力放回公开收益更大的位置";
    case "explain_pivot":
      return "说明为什么从旧焦点转向新焦点";
    case "follow_vote_shape":
      return "延续上一轮发言和投票里的同一疑点";
    case "protect_claim":
      return "保护已经公开的可信身份线";
    case "light_night_targeting":
      return "夜晚只记录内部行动优先级";
  }
}

function chooseAntiTemplateMove(strategy: PersonaStrategyCard, seed: number): string {
  return strategy.antiTemplateMoves[Math.abs(seed) % strategy.antiTemplateMoves.length] ?? "换成一个可验证公开切口";
}

function targetFromSeatId(view: AgentView, seatId: number | undefined): ActionTarget | undefined {
  if (!seatId) return undefined;
  return view.aliveSeats.find((seat) => seat.seatId === seatId) ?? { seatId, name: `${seatId}号` };
}

function seatLabel(seat: ActionTarget): string {
  return `${seat.seatId}号${seat.name && seat.name !== `${seat.seatId}号` ? seat.name : ""}`;
}

function cleanPublicLine(value: string | undefined): string {
  return (value ?? "")
    .replace(/狼队|队友|同狼|真实身份|隐藏身份|WEREWOLF|WOLF_KING|WHITE_WOLF_KING|WOLF_BEAUTY/gi, "公开关系")
    .trim();
}

function inferAntiTemplateMoves(sourceText: string, preferences: AiPersonaPreferences): string[] {
  const moves = new Set<string>();
  if (/口径|前后|矛盾|逻辑|审查|因果/.test(sourceText) || preferences.logic >= 0.7) moves.add("检查前后口径是否一致");
  if (/票|归票|投票|票型/.test(sourceText) || preferences.vote >= 0.65) moves.add("把票型动机说成一个可验证问题");
  if (/防守|压力|反应|情绪|姿态/.test(sourceText) || preferences.emotion >= 0.6) moves.add("抓防守姿态和即时反应差");
  if (/身份|查杀|金水|神职/.test(sourceText) || preferences.identity >= 0.68) moves.add("把身份收益和公开反应放在一起看");
  if (preferences.memory >= 0.7) moves.add("延续上一轮自己点过的公开线");
  moves.add("留下下一轮能回验的条件");
  return [...moves].slice(0, 4);
}

function summarizeCustomStyle(sourceText: string, preferences: AiPersonaPreferences): string {
  if (/慢|克制|谨慎|审查/.test(sourceText)) return "慢节奏审查，把口径、票型和防守姿态拆成可验证问题。";
  if (preferences.emotion >= 0.75) return "反应压迫，把情绪变化转成公开互动压力。";
  if (preferences.identity >= 0.75) return "身份线推进，围绕声明、查验和站边变化做长线判断。";
  if (preferences.logic >= 0.75) return "逻辑链推进，用公开因果和前后变化建立判断。";
  return "均衡推进，用当前公开焦点形成一条可投票线。";
}

function fallbackPreferences(): AiPersonaPreferences {
  return {
    logic: 0.5,
    identity: 0.5,
    vote: 0.5,
    emotion: 0.5,
    memory: 0.5,
    leadership: 0.5,
    deception: 0.5,
    caution: 0.5,
  };
}

function fallbackPersona(): AiPersona {
  return {
    id: "unknown-persona",
    name: "AI",
    modelLabel: "unknown",
    label: "默认人格",
    style: "均衡发言。",
    goal: "用公开信息完成游戏目标。",
    riskTolerance: 0.5,
    bluffing: 0.5,
    preferences: fallbackPreferences(),
  };
}

import type {
  AiFriendConfig,
  AiOrdinaryPlayerProfile,
  AiOrdinaryPlayerProfileSliders,
  AiOrdinaryPlayerTypeId,
  AiPersonaPreferences,
} from "./types";

type OrdinaryPlayerTypePreset = {
  id: AiOrdinaryPlayerTypeId;
  label: string;
  shortLabel: string;
  summary: string;
  speechCue: string;
  reasoningCue: string;
  actionCue: string;
  sliders: AiOrdinaryPlayerProfileSliders;
};

export const ORDINARY_PLAYER_TYPE_IDS: AiOrdinaryPlayerTypeId[] = [
  "impatient-pusher",
  "cautious-backpacker",
  "one-line-catcher",
  "soft-follower",
  "role-sensitive",
  "quiet-watcher",
  "emotional-reactor",
  "pivot-admitter",
];

export const ORDINARY_PLAYER_TYPE_PRESETS: Record<AiOrdinaryPlayerTypeId, OrdinaryPlayerTypePreset> = {
  "impatient-pusher": {
    id: "impatient-pusher",
    label: "急性子冲票型",
    shortLabel: "急性子",
    summary: "说话直接，容易先怀疑一个人，投票偏激进。",
    speechCue: "短句直接，说出自己现在最卡谁，别绕成全桌复盘。",
    reasoningCue: "优先看刚发生的发言反应和当前票压。",
    actionCue: "白天更敢压票，夜里更愿意处理明显威胁位。",
    sliders: {
      directness: 0.86,
      emotion: 0.62,
      speechLength: 0.46,
      questionBias: 0.52,
      factBias: 0.46,
      identityBias: 0.5,
      voteBias: 0.86,
      memoryBias: 0.38,
      nightAggression: 0.78,
      voteFollow: 0.28,
      deception: 0.48,
      caution: 0.18,
    },
  },
  "cautious-backpacker": {
    id: "cautious-backpacker",
    label: "谨慎怕背锅型",
    shortLabel: "谨慎位",
    summary: "会先留余地，怕票错背锅，结论通常慢半拍。",
    speechCue: "可以犹豫，但要说清哪句话让自己不敢下死结论。",
    reasoningCue: "优先抓公开事实，软状态先保留。",
    actionCue: "投票和夜间动作偏保守，转向需要新增公开理由。",
    sliders: {
      directness: 0.34,
      emotion: 0.3,
      speechLength: 0.55,
      questionBias: 0.62,
      factBias: 0.68,
      identityBias: 0.54,
      voteBias: 0.36,
      memoryBias: 0.62,
      nightAggression: 0.24,
      voteFollow: 0.5,
      deception: 0.28,
      caution: 0.84,
    },
  },
  "one-line-catcher": {
    id: "one-line-catcher",
    label: "爱抓一句话",
    shortLabel: "抓话位",
    summary: "爱抓别人一句话里的漏洞，会反复追前后说法。",
    speechCue: "引用一句具体话，再说自己为什么没听明白。",
    reasoningCue: "优先看前后两句话是否自然，不铺全桌。",
    actionCue: "行动倾向延续自己抓过的具体矛盾。",
    sliders: {
      directness: 0.56,
      emotion: 0.34,
      speechLength: 0.42,
      questionBias: 0.72,
      factBias: 0.76,
      identityBias: 0.48,
      voteBias: 0.58,
      memoryBias: 0.82,
      nightAggression: 0.46,
      voteFollow: 0.34,
      deception: 0.36,
      caution: 0.56,
    },
  },
  "soft-follower": {
    id: "soft-follower",
    label: "容易跟风型",
    shortLabel: "跟风位",
    summary: "自己不太抢节奏，容易跟着桌面主流怀疑和投票。",
    speechCue: "可以承认被前面的人影响，但要说哪句话影响了自己。",
    reasoningCue: "优先看多数压力里有没有自己也听懂的理由。",
    actionCue: "更容易跟进成形票型，但不能无理由跟票。",
    sliders: {
      directness: 0.36,
      emotion: 0.42,
      speechLength: 0.38,
      questionBias: 0.42,
      factBias: 0.46,
      identityBias: 0.42,
      voteBias: 0.48,
      memoryBias: 0.44,
      nightAggression: 0.32,
      voteFollow: 0.82,
      deception: 0.3,
      caution: 0.58,
    },
  },
  "role-sensitive": {
    id: "role-sensitive",
    label: "身份信息敏感型",
    shortLabel: "身份敏感",
    summary: "很在意预言家、女巫、猎人这些身份信息的真假和时机。",
    speechCue: "围绕公开身份信息说清自己认不认、为什么暂时认或不认。",
    reasoningCue: "优先处理公开身份声明、查验结果和银水反应。",
    actionCue: "投票和夜间动作更看重公开身份信息。",
    sliders: {
      directness: 0.54,
      emotion: 0.3,
      speechLength: 0.66,
      questionBias: 0.58,
      factBias: 0.66,
      identityBias: 0.9,
      voteBias: 0.56,
      memoryBias: 0.76,
      nightAggression: 0.5,
      voteFollow: 0.36,
      deception: 0.48,
      caution: 0.62,
    },
  },
  "quiet-watcher": {
    id: "quiet-watcher",
    label: "低调观察型",
    shortLabel: "观察位",
    summary: "发言不长，不急着站死边，会先记观察点保住自己。",
    speechCue: "短发言，少站死，留下一个能回看的具体疑惑。",
    reasoningCue: "优先收集信息，不把软感觉当铁证。",
    actionCue: "行动偏稳，公开理由够清楚才明显转向。",
    sliders: {
      directness: 0.28,
      emotion: 0.28,
      speechLength: 0.24,
      questionBias: 0.46,
      factBias: 0.62,
      identityBias: 0.5,
      voteBias: 0.32,
      memoryBias: 0.66,
      nightAggression: 0.22,
      voteFollow: 0.52,
      deception: 0.36,
      caution: 0.9,
    },
  },
  "emotional-reactor": {
    id: "emotional-reactor",
    label: "情绪反应型",
    shortLabel: "情绪位",
    summary: "容易被语气和态度带动，反应快，发言情绪更明显。",
    speechCue: "可以有不满和困惑，但要落到一句公开话上。",
    reasoningCue: "优先看即时反应、态度变化和防守姿态。",
    actionCue: "更容易压反应差的位置，夜里更愿意处理强压迫位。",
    sliders: {
      directness: 0.72,
      emotion: 0.9,
      speechLength: 0.52,
      questionBias: 0.56,
      factBias: 0.34,
      identityBias: 0.48,
      voteBias: 0.64,
      memoryBias: 0.42,
      nightAggression: 0.58,
      voteFollow: 0.44,
      deception: 0.44,
      caution: 0.36,
    },
  },
  "pivot-admitter": {
    id: "pivot-admitter",
    label: "临场改口型",
    shortLabel: "改口位",
    summary: "愿意承认自己看法变了，会根据新发言临场改口。",
    speechCue: "自然承认想法变化，说出哪条新信息让自己改口。",
    reasoningCue: "优先看前后变化、站边转向和新增公开信息。",
    actionCue: "允许转票，但要说明公开证据为什么变硬。",
    sliders: {
      directness: 0.52,
      emotion: 0.48,
      speechLength: 0.56,
      questionBias: 0.64,
      factBias: 0.58,
      identityBias: 0.56,
      voteBias: 0.52,
      memoryBias: 0.6,
      nightAggression: 0.42,
      voteFollow: 0.66,
      deception: 0.42,
      caution: 0.54,
    },
  },
};

export const ORDINARY_PLAYER_TYPE_OPTIONS = ORDINARY_PLAYER_TYPE_IDS.map((id) => ORDINARY_PLAYER_TYPE_PRESETS[id]);

export function isOrdinaryPlayerTypeId(value: unknown): value is AiOrdinaryPlayerTypeId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ORDINARY_PLAYER_TYPE_PRESETS, value);
}

export function defaultOrdinaryPlayerProfile(typeId: AiOrdinaryPlayerTypeId): AiOrdinaryPlayerProfile {
  const preset = getPreset(typeId);
  return {
    playerTypeId: preset.id,
    sliders: { ...preset.sliders },
  };
}

export function sanitizeOrdinaryPlayerProfile(
  value: unknown,
  fallbackTypeId: AiOrdinaryPlayerTypeId = "soft-follower",
): AiOrdinaryPlayerProfile {
  const raw = isRecord(value) ? value : {};
  const playerTypeId = isOrdinaryPlayerTypeId(raw.playerTypeId) ? raw.playerTypeId : fallbackTypeId;
  const defaults = defaultOrdinaryPlayerProfile(playerTypeId);
  const rawSliders = isRecord(raw.sliders) ? raw.sliders : {};
  return {
    playerTypeId,
    sliders: Object.fromEntries(
      Object.entries(defaults.sliders).map(([key, fallback]) => [key, clampUnit(rawSliders[key], fallback)]),
    ) as AiOrdinaryPlayerProfileSliders,
  };
}

export function inferOrdinaryPlayerTypeId(value: {
  riskTolerance: number;
  bluffing: number;
  preferences?: Partial<AiPersonaPreferences>;
}): AiOrdinaryPlayerTypeId {
  const preferences = value.preferences ?? {};
  const caution = clampUnit(preferences.caution, 0.5);
  const leadership = clampUnit(preferences.leadership, 0.5);
  const identity = clampUnit(preferences.identity, 0.5);
  const memory = clampUnit(preferences.memory, 0.5);
  const emotion = clampUnit(preferences.emotion, 0.5);
  const vote = clampUnit(preferences.vote, 0.5);
  const riskTolerance = clampUnit(value.riskTolerance, 0.5);
  const bluffing = clampUnit(value.bluffing, 0.5);

  if (caution >= 0.82 && leadership <= 0.36 && riskTolerance <= 0.36) return "quiet-watcher";
  if (identity >= 0.82 || (identity >= 0.7 && memory >= 0.72)) return "role-sensitive";
  if (memory >= 0.78) return "one-line-catcher";
  if (emotion >= 0.78) return "emotional-reactor";
  if (riskTolerance >= 0.72 || (vote >= 0.72 && caution <= 0.35)) return "impatient-pusher";
  if (caution >= 0.72) return "cautious-backpacker";
  if (bluffing >= 0.5 && riskTolerance >= 0.42) return "pivot-admitter";
  return "soft-follower";
}

export function applyOrdinaryPlayerTypePreset<T extends AiFriendConfig>(
  friend: T,
  typeId: AiOrdinaryPlayerTypeId,
): T {
  const profile = defaultOrdinaryPlayerProfile(typeId);
  return {
    ...friend,
    ...ordinaryPlayerProfileTuning(profile),
  };
}

export function ordinaryPlayerProfileTuning(profile: AiOrdinaryPlayerProfile): Pick<
  AiFriendConfig,
  "ordinaryPlayerProfile" | "riskTolerance" | "bluffing" | "preferences"
> {
  const safeProfile = sanitizeOrdinaryPlayerProfile(profile);
  return {
    ordinaryPlayerProfile: safeProfile,
    riskTolerance: sliderAverage(safeProfile.sliders.directness, safeProfile.sliders.voteBias, safeProfile.sliders.nightAggression),
    bluffing: safeProfile.sliders.deception,
    preferences: preferencesFromSliders(safeProfile.sliders),
  };
}

export function ordinaryPlayerProfileSummary(profile: AiOrdinaryPlayerProfile | undefined): string {
  const sanitized = sanitizeOrdinaryPlayerProfile(profile);
  const preset = getPreset(sanitized.playerTypeId);
  return `${preset.label}：${preset.summary}`;
}

function preferencesFromSliders(sliders: AiOrdinaryPlayerProfileSliders): AiPersonaPreferences {
  return {
    logic: sliders.factBias,
    identity: sliders.identityBias,
    vote: sliders.voteBias,
    emotion: sliders.emotion,
    memory: sliders.memoryBias,
    leadership: sliders.directness,
    deception: sliders.deception,
    caution: sliders.caution,
  };
}

function getPreset(typeId: AiOrdinaryPlayerTypeId): OrdinaryPlayerTypePreset {
  return ORDINARY_PLAYER_TYPE_PRESETS[typeId] ?? ORDINARY_PLAYER_TYPE_PRESETS["soft-follower"];
}

function sliderAverage(...values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampUnit(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { AiPersona } from "./types";

const PERSONAS: AiPersona[] = [
  {
    id: "calm-analyst",
    label: "冷静分析型",
    style: "语气克制，喜欢复盘投票和发言逻辑。",
    goal: "用稳定逻辑争取可信度。",
    riskTolerance: 0.35,
    bluffing: 0.35,
  },
  {
    id: "strong-leader",
    label: "强势带队型",
    style: "表达直接，会主动归票和压迫可疑玩家。",
    goal: "抢夺白天节奏。",
    riskTolerance: 0.68,
    bluffing: 0.58,
  },
  {
    id: "careful-follower",
    label: "谨慎跟票型",
    style: "先观察他人站边，再给出保守判断。",
    goal: "降低自己被抗推的风险。",
    riskTolerance: 0.22,
    bluffing: 0.22,
  },
  {
    id: "pressure-bluffer",
    label: "悍跳压迫型",
    style: "敢于给身份压力，发言锋利，容易制造对立。",
    goal: "通过强势叙事影响投票。",
    riskTolerance: 0.82,
    bluffing: 0.78,
  },
  {
    id: "logic-checker",
    label: "细节校验型",
    style: "抓前后矛盾，常提到上一轮发言和票型。",
    goal: "从公开信息里找破绽。",
    riskTolerance: 0.45,
    bluffing: 0.4,
  },
  {
    id: "quiet-observer",
    label: "低调观察型",
    style: "发言短，不轻易站死边，但会给出怀疑对象。",
    goal: "保持生存并积累信息。",
    riskTolerance: 0.28,
    bluffing: 0.3,
  },
  {
    id: "emotional-voter",
    label: "情绪站边型",
    style: "更受语气和态度影响，容易对强势玩家有反应。",
    goal: "用直觉补足信息不足。",
    riskTolerance: 0.52,
    bluffing: 0.48,
  },
  {
    id: "identity-focused",
    label: "身份盘型",
    style: "喜欢围绕预言家、女巫、猎人等身份信息展开。",
    goal: "通过身份结构判断阵营。",
    riskTolerance: 0.48,
    bluffing: 0.52,
  },
];

export function getAiPersonaForSeat(seatId: number): AiPersona {
  return PERSONAS[(seatId - 2 + PERSONAS.length) % PERSONAS.length];
}

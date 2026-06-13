import type { OrdinarySpeechMove, OrdinarySpeechPressure } from "./types";

export function collectRepeatedQuotedSpeechFragments(messages: string[]): string[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const message of messages) {
    for (const match of message.matchAll(/[“"「『]([^”"」』]{10,80})[”"」』]/g)) {
      const text = match[1]?.trim();
      if (!text) continue;
      const key = normalizeRepeatedQuoteFragment(text);
      if (key.length < 10) continue;
      const item = counts.get(key) ?? { text, count: 0 };
      item.count += 1;
      counts.set(key, item);
    }
  }
  return [...counts.values()].filter((item) => item.count >= 2).map((item) => item.text);
}

export function ordinarySpeechPressureLabel(pressure: OrdinarySpeechPressure): string {
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

export function ordinarySpeechMoveLabel(move: OrdinarySpeechMove): string {
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

export function uniqueOrdinarySpeechMoves(moves: OrdinarySpeechMove[]): OrdinarySpeechMove[] {
  const seen = new Set<OrdinarySpeechMove>();
  return moves.filter((move) => {
    if (seen.has(move)) return false;
    seen.add(move);
    return true;
  });
}

export function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRepeatedQuoteFragment(text: string): string {
  return text
    .replace(/[0-9一二三四五六七八九十两]+\s*号/g, "{seat}号")
    .replace(/(?:DeepSeek|Claude|Gemini|Kimi|Mimo|GPT|GLM|Human|豆包)\d*/gi, "{name}")
    .replace(/[，。！？、,.!?;；:\s]+/g, "")
    .trim();
}

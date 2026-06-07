import type { AiCharacterRoleCard } from "@/game/types";
import { callRoutedModelJsonWithFallbacks, parseLlmJsonOutput, readRenderedText } from "./modelLlms";

type RewriteRenderer = (input: { system: string; input: unknown }) => Promise<string>;

export type ClassTrialSpeechRewriteMode = "cache" | "fast" | "local" | "llm";

export type ClassTrialSpeechRewriteResult = {
  textJa: string;
  mode: ClassTrialSpeechRewriteMode;
};

const rewriteCache = new Map<string, string>();

export function clearClassTrialSpeechRewriteCache(): void {
  rewriteCache.clear();
}

export async function rewriteClassTrialSpeechForJapaneseTts(
  options: {
    sourceZh: string;
    roleCard: AiCharacterRoleCard;
  },
  renderer: RewriteRenderer = defaultRewriteRenderer,
): Promise<string> {
  return (await rewriteClassTrialSpeechForJapaneseTtsWithMeta(options, renderer)).textJa;
}

export async function rewriteClassTrialSpeechForJapaneseTtsWithMeta(
  options: {
    sourceZh: string;
    roleCard: AiCharacterRoleCard;
  },
  renderer: RewriteRenderer = defaultRewriteRenderer,
): Promise<ClassTrialSpeechRewriteResult> {
  const sourceZh = options.sourceZh.trim();
  if (!sourceZh) throw new Error("日语改写不可用：中文台词为空。");

  const cacheKey = buildRewriteCacheKey(options.roleCard, sourceZh);
  const cached = rewriteCache.get(cacheKey);
  if (cached) return { textJa: cached, mode: "cache" };

  const fast = tryFastRewriteClassTrialSpeech(sourceZh);
  if (fast) {
    validateRewrite(sourceZh, fast, options.roleCard);
    rewriteCache.set(cacheKey, fast);
    return { textJa: fast, mode: "fast" };
  }

  const local = tryLocalRewriteClassTrialSpeech(sourceZh, options.roleCard);
  if (local) {
    validateRewrite(sourceZh, local, options.roleCard);
    rewriteCache.set(cacheKey, local);
    return { textJa: local, mode: "local" };
  }

  const raw = await renderer({
    system: [
      "你把中文狼人杀公开发言改写成自然日语朗读稿。",
      '只输出 JSON：{"textJa":"..."}。',
      "不要解释，不要添加括号动作，不要新增身份、死因、查验、投票目标等事实。",
      "保留所有座位号，例如 3号 改为 3番。",
      `角色：${options.roleCard.displayName}。风格：${options.roleCard.speechStyleZh}`,
      options.roleCard.voiceRewritePolicy ? `改写策略：${options.roleCard.voiceRewritePolicy}` : "",
      ...buildRoleSpecificRewriteLines(options.roleCard),
    ]
      .filter(Boolean)
      .join("\n"),
    input: {
      sourceZh,
      character: options.roleCard.displayName,
    },
  });
  const textJa = readTextJa(raw);
  validateRewrite(sourceZh, textJa, options.roleCard);
  rewriteCache.set(cacheKey, textJa);
  return { textJa, mode: "llm" };
}

async function defaultRewriteRenderer(input: { system: string; input: unknown }): Promise<string> {
  const rendered = await callRoutedModelJsonWithFallbacks({
    task: "speech",
    personaName: "GPT",
    fallbackPersonaNames: ["DeepSeek", "Kimi"],
    system: input.system,
    input: input.input,
    maxTokens: 220,
  });
  return readRenderedText(rendered);
}

function readTextJa(raw: string): string {
  const parsed = parseLlmJsonOutput(raw) as { textJa?: unknown };
  return typeof parsed.textJa === "string" ? parsed.textJa.trim() : "";
}

function validateRewrite(sourceZh: string, textJa: string, roleCard: AiCharacterRoleCard): void {
  if (!textJa) throw new Error("日语改写不可用：输出为空。");
  if (/以下|翻译|日语|JSON|textJa|改写/.test(textJa)) {
    throw new Error("日语改写不可用：输出包含解释性前缀。");
  }
  const sourceSeatNumbers = new Set([...sourceZh.matchAll(/(\d{1,2})号/g)].map((match) => match[1]));
  for (const seatNumber of sourceSeatNumbers) {
    if (!new RegExp(`${seatNumber}\\s*番`).test(textJa)) {
      throw new Error(`日语改写不可用：缺少座位号 ${seatNumber}号。`);
    }
  }
  if (roleCard.id === "anon") {
    const fillers = textJa.match(/えっと|あの|うん|んー|えー|あー|まあ/g) ?? [];
    if (fillers.length > 1) {
      throw new Error("日语改写不可用：千早爱音语气词过多。");
    }
    if (/(?:\d{1,2}\s*番|投票|占い|処刑|吊り).{0,4}(?:えっと|あの|うん|んー|えー|あー|まあ)/.test(textJa)) {
      throw new Error("日语改写不可用：千早爱音语气词位置不自然。");
    }
  }
}

function buildRoleSpecificRewriteLines(roleCard: AiCharacterRoleCard): string[] {
  if (roleCard.id === "monokuma") {
    return [
      "黑白熊日语朗读：必须保留极短怪笑口癖，例如中文“噗/噗噗”自然改为“うぷぷ”。",
      "不要把黑白熊的怪笑当作多余语气词删除；怪笑只能短促出现一次，不要连续堆叠。",
    ];
  }
  if (roleCard.id !== "anon") return [];
  return [
    "千早爱音日语朗读：语气词最多一次，只能放在句首、轻微转折前或缓和压力处。",
    "不要把语气词塞在数字座位、查验、投票目标中间；不要连续使用 えっと、あの、うん、あー。",
  ];
}

function buildRewriteCacheKey(roleCard: AiCharacterRoleCard, sourceZh: string): string {
  return `${roleCard.id}:${sourceZh.trim().replace(/\s+/g, " ")}`;
}

function tryFastRewriteClassTrialSpeech(sourceZh: string): string | undefined {
  const compact = sourceZh
    .trim()
    .replace(/\s+/g, "")
    .replace(/[。！？!?，,、；;：:]/g, "");
  if (!compact || compact.length > 24) return undefined;

  const explanation = compact.match(/^(?:我)?(?:想|先想|想先|要|先)?听(\d{1,2})号(?:解释|发言)$/);
  if (explanation) return `${explanation[1]}番の説明を聞きたい。`;

  const vote = compact.match(/^(?:我)?(?:会|先|今天|这轮)?投(?:给)?(\d{1,2})号$/);
  if (vote) return `${vote[1]}番に投票する。`;

  const suspicion = compact.match(/^(?:我)?(?:觉得|认为|怀疑)?(\d{1,2})号(?:有点|很)?(?:可疑|像狼)$/);
  if (suspicion) return `${suspicion[1]}番が怪しいと思う。`;

  if (/^(?:这里|这个发言|刚才的发言|发言|这段发言)(?:有|存在)?矛盾$/.test(compact)) {
    return "今の発言には矛盾があると思う。";
  }

  return undefined;
}

function tryLocalRewriteClassTrialSpeech(sourceZh: string, roleCard?: AiCharacterRoleCard): string | undefined {
  const normalized = sourceZh.trim().replace(/\s+/g, " ");
  if (Array.from(normalized).length < 20) return undefined;

  const seatNumbers = [...new Set([...normalized.matchAll(/(\d{1,2})号/g)].map((match) => match[1]))];
  const lines: string[] = [];
  const push = (line: string) => {
    const clean = line.trim();
    if (clean && !lines.includes(clean)) lines.push(clean);
  };

  if (roleCard?.id === "monokuma" && /噗|怪笑|好笑|闹剧|糊弄|有意思/.test(normalized)) {
    push("うぷぷ。");
  }
  if (/平安夜|女巫用药|用药|轮次没亏/.test(normalized)) {
    push("平和な夜だ。魔女が薬を使ったと見て、少なくとも縄は減っていない。");
  }
  if (/首置位|首位|第一(?:个)?发言|没太多信息|信息不多/.test(normalized)) {
    push("私は最初の発言位置だから、まだ情報は多くない。");
  }
  if (/前后|前後|逻辑|闭环|理由|票型|对不上|不闭合/.test(normalized)) {
    push("発言の前後、理由、投票筋がつながるかを見る。");
  }
  if (/听感|语气|感觉|印象/.test(normalized)) {
    push("印象だけより、公開情報で一緒に検証したい。");
  }
  if (/解释|讲清|说清|回应/.test(normalized)) {
    push(`${formatSeatSubject(seatNumbers)}の説明を聞きたい。`);
  }
  if (/可疑|怀疑|像狼|狼面|怪/.test(normalized)) {
    push(`${formatSeatSubject(seatNumbers)}が気になる。理由は公開発言から見たい。`);
  }
  if (/票口|投票|跟票|归票|压票|投/.test(normalized)) {
    push(`${formatSeatSubject(seatNumbers)}への投票筋を急がず、公開理由で合わせたい。`);
  }
  if (/查杀|金水|预言家|验人|查验/.test(normalized)) {
    push("占い結果と公開発言のつながりを確認したい。");
  }
  if (/矛盾|漏洞|缺口|跳步/.test(normalized)) {
    push("矛盾や抜けている部分を一つずつ確認する。");
  }

  if (lines.length === 0) {
    push(`${formatSeatSubject(seatNumbers)}について、公開情報で確認したい。`);
    push("今は一つの矛盾だけを見て、投票できる理由に絞る。");
  }

  const text = compactJapaneseRewrite(lines.join(""));
  return text ? ensureSeatNumbers(text, seatNumbers) : undefined;
}

function formatSeatSubject(seatNumbers: string[]): string {
  if (seatNumbers.length === 0) return "その位置";
  return seatNumbers.map((seatNumber) => `${seatNumber}番`).join("と");
}

function ensureSeatNumbers(textJa: string, seatNumbers: string[]): string {
  const missing = seatNumbers.filter((seatNumber) => !new RegExp(`${seatNumber}\\s*番`).test(textJa));
  if (missing.length === 0) return textJa;
  return `${missing.map((seatNumber) => `${seatNumber}番`).join("と")}について。${textJa}`;
}

function compactJapaneseRewrite(text: string): string {
  const sentences = text.match(/[^。！？]+[。！？]?/g) ?? [text];
  const compact = sentences.join("").replace(/[。！？]?$/, "。");
  return compact.replace(/[、，,：:；;]+$/u, "。");
}

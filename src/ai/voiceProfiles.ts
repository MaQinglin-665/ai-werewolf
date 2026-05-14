export type MimoAiVoiceProfile = {
  id: string;
  personaName: string;
  voice: "mimo_default" | "default_zh" | "default_en";
  voiceEnvKey: string;
  style: string;
  tacticalVoice: string;
  prosody: string;
  stageCue: string;
  midSpeechCue: string;
};

const AI_VOICE_PROFILES: MimoAiVoiceProfile[] = [
  {
    id: "deepseek",
    personaName: "DeepSeek",
    voice: "mimo_default",
    voiceEnvKey: "MIMO_AI_VOICE_DEEPSEEK",
    style: "冷静 清晰 稍快 逻辑锋利，关键判断加重音，短句之间有干净停顿",
    tacticalVoice: "像逻辑链型玩家，先给结论，再按公开事实逐层压人；不要卖情绪，证据词和归票词更硬。",
    prosody: "每条证据之间短停，因果词前后断开；结论句收得短而稳。",
    stageCue: "（沉稳，先停顿半拍）",
    midSpeechCue: "（短暂停顿，压低声音）",
  },
  {
    id: "claude",
    personaName: "Claude",
    voice: "mimo_default",
    voiceEnvKey: "MIMO_AI_VOICE_CLAUDE",
    style: "温和 坚定 清晰 稍快，转折处有轻微情绪推进，追问句上扬",
    tacticalVoice: "像边界审查型玩家，先承认不确定性，再指出谁的发言越界、跳步或偷换概念。",
    prosody: "让步句温和，质疑句稍微上扬；转折词后留一个轻停顿。",
    stageCue: "（温和但坚定，像在认真规劝）",
    midSpeechCue: "（停顿一下，语气更稳）",
  },
  {
    id: "gpt",
    personaName: "GPT",
    voice: "default_zh",
    voiceEnvKey: "MIMO_AI_VOICE_GPT",
    style: "自然 清晰 稍快 组织感，分层时停顿清楚，结论句更有力度",
    tacticalVoice: "像控场归纳型玩家，把零散发言整理成两三条清晰判断，再给下一步建议。",
    prosody: "列点时每点清楚断开，归纳句更平稳，最终建议更明确。",
    stageCue: "（自然，先把信息整理清楚）",
    midSpeechCue: "（换一口气，继续归纳）",
  },
  {
    id: "doubao",
    personaName: "豆包",
    voice: "default_zh",
    voiceEnvKey: "MIMO_AI_VOICE_DOUBAO",
    style: "灵动 偏快 情绪起伏 强互动，质疑和反问更有现场压迫感",
    tacticalVoice: "像强压推进型玩家，抓住一个矛盾连续追问，逼对方给明确立场。",
    prosody: "短句更密，反问句更有压迫感；不要拖尾，连压时节奏更快。",
    stageCue: "（反应很快，带一点临场感）",
    midSpeechCue: "（轻快停顿，马上追问）",
  },
  {
    id: "mimo",
    personaName: "Mimo",
    voice: "mimo_default",
    voiceEnvKey: "MIMO_AI_VOICE_MIMO",
    style: "沉浸 清晰 稍快 悬疑但不拖慢，重点词压住，句尾收干净",
    tacticalVoice: "像拆局型玩家，先压低场面噪音，再把疑点和身份线逐条摆出来。",
    prosody: "疑点之间留短停，关键身份词压住；不要故作神秘到拖慢。",
    stageCue: "（像主持人压低声音，逐条拆解）",
    midSpeechCue: "（短暂停顿，制造一点悬疑感）",
  },
  {
    id: "gemini",
    personaName: "Gemini",
    voice: "mimo_default",
    voiceEnvKey: "MIMO_AI_VOICE_GEMINI",
    style: "清亮 开阔 稍快 联想感，列举多条线时断句分明",
    tacticalVoice: "像多线并行型玩家，同时展开票型、站边和发言顺序，再比较哪条线更可信。",
    prosody: "切换线索时明显转折，枚举项要分开读；不要把多条线粘成一整句。",
    stageCue: "（语气开阔，像在展开多条线索）",
    midSpeechCue: "（轻轻转折，换一条线索）",
  },
  {
    id: "glm",
    personaName: "GLM",
    voice: "default_zh",
    voiceEnvKey: "MIMO_AI_VOICE_GLM",
    style: "理性 稳定 稍快 结构化，层次之间短暂停顿，归票句加重",
    tacticalVoice: "像结构化归票型玩家，把身份声明、票型和行为分层评估，再稳定给票口。",
    prosody: "层级词后清楚停顿，票口和阵营判断加重；整体不飘。",
    stageCue: "（稳定，按层次推进）",
    midSpeechCue: "（停顿，补充结构判断）",
  },
  {
    id: "kimi",
    personaName: "Kimi",
    voice: "mimo_default",
    voiceEnvKey: "MIMO_AI_VOICE_KIMI",
    style: "沉着 清晰 稍快 长线思考，回忆线索时稳，结论处更明确",
    tacticalVoice: "像长线记忆型玩家，会把前后发言、票型变化和站边变化接起来看。",
    prosody: "回溯时放稳，连接前后信息时稍停；结论不要拖，直接落点。",
    stageCue: "（沉着，像在翻阅长线记忆）",
    midSpeechCue: "（停顿片刻，把前后信息接上）",
  },
];

const FALLBACK_PROFILE = AI_VOICE_PROFILES[0];

export function getAiVoiceProfileByName(name: string | undefined): MimoAiVoiceProfile {
  return AI_VOICE_PROFILES.find((profile) => profile.personaName === name) ?? FALLBACK_PROFILE;
}

export function getAiVoiceProfiles(): MimoAiVoiceProfile[] {
  return AI_VOICE_PROFILES.map((profile) => ({ ...profile }));
}

export function composeAiSpeechTtsText(text: string, profile: MimoAiVoiceProfile): string {
  return normalizeSpeechForTts(stripTtsControlText(text, profile));
}

export function composeAiSpeechTtsInstruction(profile: MimoAiVoiceProfile): string {
  return [
    `请以 ${profile.personaName} 的狼人杀玩家口吻朗读 assistant 消息里的公开发言。`,
    `风格要求：${profile.style}。`,
    `打法声线：${profile.tacticalVoice}`,
    `断句要求：${profile.prosody}`,
    "整体语速比默认中文朗读快约 12%，但不要抢字；逗号短停，句号明显停，问句和质疑句要有情绪起伏。",
    "遇到座位号、查杀、金水、归票、弃票、预言家、女巫、狼人等关键词时稍微加重，像桌游现场发言，不要像新闻播报。",
    "只合成 assistant 消息里的台词，不要朗读风格要求、括号提示、标签、系统说明，也不要改写或续写台词。",
    "读到文本最后一个字后立即停止，不要补充随机音节、口癖、乱码、尾音或任何额外句子。",
  ].join("");
}

function normalizeSpeechForTts(text: string): string {
  const trimmed = addNaturalTtsBreaks(text)
    .replace(/\s+/g, " ")
    .replace(/([。！？；])，/g, "$1")
    .replace(/，([。！？；])/g, "$1")
    .replace(/，{2,}/g, "，")
    .replace(/^，/, "")
    .replace(/([。！？；])(?=\S)/g, "$1 ")
    .replace(/[,，]{2,}/g, "，")
    .replace(/[.。]{2,}/g, "。")
    .trim();

  if (!trimmed) return "我先过。";
  return /[。！？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function addNaturalTtsBreaks(text: string): string {
  return text
    .replace(
      /(我?先说(?:一|两|三|四)?点|我分(?:一|两|三|四)?点|我的结论是|结论是|第一|第二|第三|第四|另外|然后|因为|如果|现在|但是|但我|不过|所以|因此|总结一句|我的建议是)/g,
      "，$1",
    )
    .replace(/(第一|第二|第三|第四)，(?=[^，。！？；\s])/g, "$1，")
    .replace(/(第一|第二|第三|第四)(?=[^，。！？；\s])/g, "$1，")
    .replace(/(查杀|金水|归票|弃票|预言家|女巫|猎人|狼人)(但是|但我|不过|所以|因此)/g, "$1，$2");
}

function stripTtsControlText(text: string, profile: MimoAiVoiceProfile): string {
  return [profile.stageCue, profile.midSpeechCue]
    .reduce((current, cue) => current.replace(new RegExp(escapeRegExp(cue), "g"), " "), text)
    .replace(/<style>[\s\S]*?<\/style>/gi, " ")
    .replace(/^\s*[（(][^）)]{0,48}(?:风格|语气|声音|停顿|朗读|低沉|温和|自然|悬疑|清晰|变慢)[^）)]*[）)]\s*/g, "")
    .replace(/[（(][^）)]{0,48}(?:停顿|压低声音|换一口气|语气|声音|朗读|风格|悬疑感)[^）)]*[）)]/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
